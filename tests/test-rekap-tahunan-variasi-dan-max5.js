/**
 * TEST SUITE: Variasi Data Rekapitulasi Tahunan Siswa & Batasan Maksimal 5 Duplikat
 * Presensia IoT - SMK Negeri 1 Sumedang
 *
 * Menguji:
 * 1. Data rekapitulasi tahunan 3 kelas resmi tidak seragam/kembar.
 * 2. Maksimal kombinasi (h, s, i, a) identik dalam satu kelas <= 5 orang.
 * 3. Pola kehadiran terdistribusi non-sekuensial (bukan monotonik/mekanik).
 * 4. Terdapat contoh evaluasi kedisiplinan (1-2 siswa per kelas dengan Peringatan Disiplin < 85% untuk rombel >= 10 siswa).
 * 5. M. Ihsan Athallah (0098263610) berstatus Memenuhi Syarat prima (≥ 85%).
 * 6. Integrasi pembacaan database Firebase RTDB & generator offline fallback di admin.js.
 */

const assert = require('assert');
const path = require('path');

// Setup Mock DOM & Storage Environment BEFORE requiring admin.js
const createdElements = {};
function createMockEl(tag, id) {
  const el = {
    tagName: tag.toUpperCase(),
    id: id || '',
    innerHTML: '',
    textContent: '',
    value: '',
    options: [],
    style: {},
    children: [],
    appendChild: function(child) {
      if (!this.children) this.children = [];
      this.children.push(child);
    },
    addEventListener: function() {},
    classList: {
      _classes: new Set(),
      add: function(...c) { c.forEach(x => this._classes.add(x)); },
      remove: function(...c) { c.forEach(x => this._classes.delete(x)); },
      contains: function(c) { return this._classes.has(c); }
    }
  };
  if (id) createdElements[id] = el;
  return el;
}

global.window = {
  addEventListener: function() {},
  removeEventListener: function() {},
  location: { href: 'http://localhost/admin.html' }
};

global.document = {
  addEventListener: function() {},
  removeEventListener: function() {},
  getElementById: function(id) {
    if (createdElements[id]) return createdElements[id];
    return createMockEl('div', id);
  },
  createElement: function(tag) {
    return createMockEl(tag);
  },
  querySelector: function() { return null; },
  querySelectorAll: function() { return []; }
};

global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
global.sessionStorage = {
  getItem: () => JSON.stringify({ role: 'admin', email: 'admin@smkn1sumedang.sch.id' }),
  setItem: () => {},
  removeItem: () => {}
};

const { MASTER_DATA_SISWA_RESMI } = require('../assets/firebase-config.js');
const {
  generateProfilKelasTahunan,
  stringHashRekap,
  PROFIL_NORMAL_REKAP,
  PROFIL_PERINGATAN_REKAP,
  muatRekapPresensi
} = require('../assets/admin.js');

console.log('--- TEST SUITE: REKAPITULASI TAHUNAN VARIASI & MAX 5 DUPLIKAT ---');

const classes = ['XII RPL 1', 'XII RPL 2', 'XII TKJ 1'];

classes.forEach(cls => {
  console.log(`\n▶ [Test 1] Menguji profil variasi dan batasan duplicate untuk kelas ${cls}...`);
  const students = Object.values(MASTER_DATA_SISWA_RESMI).filter(s => {
    if (cls === 'XII TKJ 1') return s.kelas === 'XII TKJ 1' || (s.kelas && s.kelas.includes('TKJ'));
    return s.kelas === cls;
  });

  assert.ok(students.length > 0, `Siswa kelas ${cls} harus ditemukan di master data`);

  const profileMap = generateProfilKelasTahunan(students, cls);
  const tupleCounts = {};
  const values = [];

  students.forEach((s, idx) => {
    const p = profileMap[s.nisn];
    assert.ok(p, `Profil untuk siswa ${s.nama} (${s.nisn}) harus ter-generate`);
    assert.ok(typeof p.h === 'number' && p.h > 180, 'Hari hadir harus realistis (> 180 hari)');
    assert.ok(typeof p.s === 'number', 'Hari sakit harus berupa angka');
    assert.ok(typeof p.i === 'number', 'Hari izin harus berupa angka');
    assert.ok(typeof p.a === 'number', 'Hari alpa harus berupa angka');

    const key = `${p.h}-${p.s}-${p.i}-${p.a}`;
    tupleCounts[key] = (tupleCounts[key] || 0) + 1;
    values.push(p);

    if (s.nisn === '0098263610') {
      const tot = p.h + p.s + p.i + p.a;
      const pct = Math.round((p.h / tot) * 100);
      assert.strictEqual(p.h, 246, 'M. Ihsan Athallah harus memiliki 246 hari hadir');
      assert.strictEqual(p.a, 0, 'M. Ihsan Athallah tidak boleh memiliki alpa');
      assert.ok(pct >= 85, 'M. Ihsan Athallah harus memenuhi syarat kelulusan (>= 85%)');
      console.log(`  ✓ Verifikasi Siswa M. Ihsan Athallah: Hadir=${p.h}, Sakit=${p.s}, Izin=${p.i}, Alpa=${p.a} (${pct}%) -> Memenuhi Syarat`);
    }
  });

  // Verifikasi variasi (maksimal variasi sesuai jumlah siswa, min 5 untuk rombel normal)
  const uniqueTuples = Object.keys(tupleCounts);
  const expectedMinTuples = Math.min(students.length, 5);
  assert.ok(uniqueTuples.length >= expectedMinTuples, `Harus ada minimal ${expectedMinTuples} variasi tuple kehadiran berbeda di kelas ${cls} (ditemukan: ${uniqueTuples.length})`);

  // Verifikasi maksimal 5 orang kembar identik
  Object.entries(tupleCounts).forEach(([combo, count]) => {
    assert.ok(count <= 5, `Kombinasi kehadiran "${combo}" di kelas ${cls} melebihi batas 5 orang (ditemukan: ${count} orang)`);
  });
  console.log(`  ✓ Batasan Terpenuhi: Maksimal kembar <= 5 orang untuk seluruh ${students.length} siswa (variasi tuple: ${uniqueTuples.length}).`);

  // Verifikasi non-sekuensial untuk kelas dengan data banyak
  if (values.length > 5) {
    let monotonicIncreases = 0;
    let monotonicDecreases = 0;
    for (let i = 1; i < values.length; i++) {
      if (values[i].h > values[i - 1].h) monotonicIncreases++;
      if (values[i].h < values[i - 1].h) monotonicDecreases++;
    }
    assert.ok(monotonicIncreases > 0 && monotonicDecreases > 0, `Pola kehadiran di kelas ${cls} harus non-sekuensial / fluktuatif`);
    console.log(`  ✓ Verifikasi Distribusi: Non-sekuensial fluktuatif (naik: ${monotonicIncreases}, turun: ${monotonicDecreases}).`);
  }

  // Verifikasi peringatan disiplin (< 85%) untuk rombel >= 10 siswa
  if (students.length >= 10) {
    const warningList = students.filter(s => {
      const p = profileMap[s.nisn];
      const tot = p.h + p.s + p.i + p.a;
      return Math.round((p.h / tot) * 100) < 85;
    });
    assert.ok(warningList.length >= 1 && warningList.length <= 2, `Harus terdapat 1-2 siswa per kelas dengan Peringatan Disiplin (ditemukan: ${warningList.length})`);
    console.log(`  ✓ Kasus Peringatan Disiplin Terpenuhi: ${warningList.map(w => w.nama).join(', ')} (< 85%).`);
  }
});

console.log('\n▶ [Test 2] Menguji simulasi fungsi muatRekapPresensi() di admin.js...');

const selKelas = createMockEl('select', 'rekapKelas');
selKelas.value = 'XII RPL 1';
selKelas.options = [{ value: 'XII RPL 1' }];

const selPeriode = createMockEl('select', 'rekapPeriodeAdmin');
selPeriode.value = 'tahunan';

const tbody = createMockEl('tbody', 'rekapTableBody');
const theadRow = createMockEl('tr', 'rekapTheadRow');
const statTotal = createMockEl('h3', 'statTotalSiswa');
const statHadir = createMockEl('h3', 'statHadir');
const statSakit = createMockEl('h3', 'statSakit');
const statIzin  = createMockEl('h3', 'statIzin');
const statAlpha = createMockEl('h3', 'statAlpha');

global.siswaCache = MASTER_DATA_SISWA_RESMI;
global.normalisasiKelas = function(k) { return k; };

// Mock Firebase RTDB
global.db = {
  ref: function(pathStr) {
    return {
      once: async function(eventType) {
        if (pathStr === 'rekap_tahunan') {
          // Kembalikan seeded snapshot
          const mockData = {};
          Object.values(MASTER_DATA_SISWA_RESMI).forEach(s => {
            mockData[s.nisn] = {
              h: 240 + (stringHashRekap(s.nisn) % 8),
              s: 3 + (stringHashRekap(s.nisn) % 4),
              i: 2 + (stringHashRekap(s.nisn) % 3),
              a: stringHashRekap(s.nisn) % 2
            };
          });
          return {
            exists: () => true,
            val: () => mockData
          };
        }
        return {
          exists: () => false,
          val: () => null
        };
      }
    };
  }
};

(async () => {
  const fnMuat = global.muatRekapPresensi || window.muatRekapPresensi || (typeof muatRekapPresensi === 'function' ? muatRekapPresensi : null);
  assert.ok(typeof fnMuat === 'function', 'muatRekapPresensi harus terdefinisi sebagai fungsi');

  await fnMuat();

  assert.ok(theadRow.innerHTML.includes('Alpa'), 'Header tabel harus menyertakan kolom Alpa');
  assert.ok(theadRow.innerHTML.includes('Persentase'), 'Header tabel harus menyertakan kolom Persentase');
  assert.ok(theadRow.innerHTML.includes('Status Kelulusan'), 'Header tabel harus menyertakan kolom Status Kelulusan');

  const totalSiswaRPL1 = Object.values(MASTER_DATA_SISWA_RESMI).filter(s => s.kelas === 'XII RPL 1').length;
  assert.strictEqual(parseInt(statTotal.textContent, 10), totalSiswaRPL1, 'Total siswa di kartu summary harus sesuai');

  const totalHadir = parseInt(statHadir.textContent, 10);
  assert.notStrictEqual(totalHadir, totalSiswaRPL1 * 244, 'Total hadir tidak boleh hardcoded seragam 33 * 244 = 8052');
  assert.ok(totalHadir > 7000 && totalHadir < 8500, `Total hadir realistis (tercatat: ${totalHadir})`);

  const totalAlpha = parseInt(statAlpha.textContent, 10);
  assert.ok(totalAlpha >= 0, 'Total alpa harus terhitung di kartu summary');

  console.log(`  ✓ muatRekapPresensi() Berhasil: Total Siswa=${statTotal.textContent}, Hadir=${statHadir.textContent}, Sakit=${statSakit.textContent}, Izin=${statIzin.textContent}, Alpa=${statAlpha.textContent}`);
  console.log('\n🎉 SELURUH PENGUJIAN REKAPITULASI VARIASI & MAX 5 DUPLIKAT LULUS 100%!\n');
})().catch(err => {
  console.error('❌ Test gagal:', err);
  process.exit(1);
});
