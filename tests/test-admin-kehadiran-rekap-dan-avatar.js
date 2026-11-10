/**
 * TEST SUITE: TELEMETRI KEHADIRAN 3 KELAS, REKAP PRESENSI & HEADER AVATAR ADMIN
 * Presensia IoT - SMK Negeri 1 Sumedang
 *
 * Menguji:
 * 1. Header logo admin mengganti poligon bintang dengan foto profil avatar admin (assets/foto/admin.jpg).
 * 2. Gradient defs (shieldGrad, coreGrad) tetap dipertahankan untuk kompatibilitas.
 * 3. Matriks live kehadiran 3 kelas pilot (muatMonitoring3Kelas) memadukan data presensi_jam (jam 1-8),
 *    absensi personal, izin disetujui, dan fallback resmi (generateDefaultPresensiResmi), tidak blank / 0.
 * 4. Pemantauan kehadiran Dewan Guru (5 MASTER_GURU_RESMI) terintegrasi secara real-time.
 * 5. Tab Rekap Presensi (muatRekapPresensi) menginisialisasi kelas resmi & tanggal hari ini,
 *    dan menghitung kartu statistik serta log presensi siswa secara akurat.
 * 6. Kepatuhan invarian sekolah: strictly 3 kelas resmi ('XII RPL 1', 'XII RPL 2', 'XII TKJ 1').
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('================================================================');
console.log('🧪 TEST SUITE: ADMIN KEHADIRAN, REKAP PRESENSI & AVATAR PROFIL');
console.log('================================================================\n');

const adminHtmlPath = path.join(__dirname, '../admin.html');
const adminHtml = fs.readFileSync(adminHtmlPath, 'utf8');

// -------------------------------------------------------------------------
// [TEST 1] Verifikasi Header Avatar Admin & Penghapusan Ikon Bintang
// -------------------------------------------------------------------------
console.log('▶ [Test 1] Verifikasi Header Avatar Admin & Penghapusan Ikon Bintang...');

assert.ok(
  adminHtml.includes('<div class="admin-brand-icon"'),
  'admin.html harus memuat elemen kontainer .admin-brand-icon'
);
assert.ok(
  adminHtml.includes('src="assets/foto/admin.jpg"'),
  'Header brand icon harus memuat berkas foto profil avatar admin (assets/foto/admin.jpg)'
);
assert.ok(
  adminHtml.includes('alt="Foto Profil Admin"'),
  'Elemen img foto profil harus memiliki alt deskriptif "Foto Profil Admin"'
);
assert.ok(
  adminHtml.includes('onerror="this.onerror=null;this.src=\'assets/foto/0095250998.jpg\';"') ||
  adminHtml.includes('assets/foto/0095250998.jpg'),
  'Elemen avatar foto profil admin harus memiliki mekanisme fallback yang rapi'
);

// Pastikan poligon bintang lama telah dihapus
assert.ok(
  !adminHtml.includes('<polygon points="24,15 31,22 24,29 17,22"'),
  'Poligon bintang 4 sudut pada header admin harus sudah dihapus'
);
assert.ok(
  !adminHtml.includes('<polygon points="24,15'),
  'Tidak boleh ada polygon bintang di header logo admin'
);

// Pastikan gradient defs shieldGrad dan coreGrad tetap dipertahankan
assert.ok(
  adminHtml.includes('id="shieldGrad"'),
  'admin.html harus mempertahankan linearGradient id="shieldGrad"'
);
assert.ok(
  adminHtml.includes('id="coreGrad"'),
  'admin.html harus mempertahankan linearGradient id="coreGrad"'
);

console.log('  ✓ Ikon bintang berhasil diganti foto profil avatar admin dan gradient defs dipertahankan.\n');

// -------------------------------------------------------------------------
// [TEST 2] Verifikasi Inisialisasi Sinkron Dropdown Rekap & Tanggal Default
// -------------------------------------------------------------------------
console.log('▶ [Test 2] Verifikasi Dropdown Rekap & Tanggal Default...');

// Dropdown kelas di admin.html
assert.ok(
  adminHtml.includes('id="rekapKelas"'),
  'admin.html harus memuat dropdown id="rekapKelas"'
);
assert.ok(
  adminHtml.includes('id="rekapTanggal"'),
  'admin.html harus memuat input tanggal id="rekapTanggal"'
);
assert.ok(
  adminHtml.includes('id="cards3KelasMonitoring"'),
  'admin.html harus memuat kontainer #cards3KelasMonitoring'
);
assert.ok(
  adminHtml.includes('id="tabelRingkasan3Kelas"'),
  'admin.html harus memuat kontainer #tabelRingkasan3Kelas'
);
assert.ok(
  adminHtml.includes('id="monitoringGuruContainer"'),
  'admin.html harus memuat kontainer #monitoringGuruContainer untuk dewan guru'
);

// Validasi invarian 3 rombel resmi pada HTML dropdown
const officialClasses = ['XII RPL 1', 'XII RPL 2', 'XII TKJ 1'];
const rekapSelectMatch = adminHtml.match(/<select[^>]*id="rekapKelas"[^>]*>([\s\S]*?)<\/select>/);
assert.ok(rekapSelectMatch, 'Elemen select #rekapKelas harus ada');
officialClasses.forEach(cls => {
  assert.ok(
    rekapSelectMatch[1].includes(cls),
    `Select #rekapKelas harus memuat kelas resmi: ${cls}`
  );
});
assert.ok(!rekapSelectMatch[1].includes('PPLG'), 'Select #rekapKelas TIDAK boleh memuat kelas palsu PPLG');
assert.ok(!rekapSelectMatch[1].includes('9A'), 'Select #rekapKelas TIDAK boleh memuat kelas palsu 9A');

console.log('  ✓ Dropdown rekap pre-populated dengan 3 rombel resmi sekolah.\n');

// -------------------------------------------------------------------------
// Mock Environment untuk Pengujian Dinamis admin.js
// -------------------------------------------------------------------------
class MockDOMElement {
  constructor(id = '', tag = 'div') {
    this.id = id;
    this.tagName = tag.toUpperCase();
    this.children = [];
    this._innerHTML = '';
    this._textContent = '';
    this.value = '';
    this.style = {};
    this.attributes = {};
    this.options = [];
    this.classList = {
      _classes: new Set(),
      add: (c) => this.classList._classes.add(c),
      remove: (c) => this.classList._classes.delete(c),
      contains: (c) => this.classList._classes.has(c)
    };
    this.addEventListener = () => {};
    this.removeEventListener = () => {};
  }
  get textContent() { return this._textContent; }
  set textContent(v) {
    this._textContent = String(v);
    this._innerHTML = String(v);
  }
  get innerHTML() { return this._innerHTML; }
  set innerHTML(v) {
    this._innerHTML = String(v);
    this._textContent = String(v).replace(/<[^>]*>/g, '');
    if (!v) this.children = [];
  }
  appendChild(child) {
    this.children.push(child);
    if (child.innerHTML) {
      this._innerHTML += (child.tagName ? `<${child.tagName.toLowerCase()}>${child.innerHTML}</${child.tagName.toLowerCase()}>` : child.innerHTML);
    }
    return child;
  }
  setAttribute(attr, val) { this.attributes[attr] = String(val); }
  getAttribute(attr) { return this.attributes[attr] || null; }
}

const domRegistry = {};
function getMock(id, tag = 'div') {
  if (!domRegistry[id]) domRegistry[id] = new MockDOMElement(id, tag);
  return domRegistry[id];
}

const mockDoc = {
  getElementById: (id) => getMock(id),
  querySelector: (sel) => {
    if (sel.includes('#')) {
      const id = sel.replace('#', '');
      return getMock(id);
    }
    if (sel === '.tab-panel.active') {
      const activeEl = getMock('tab-monitoring3kelas');
      activeEl.classList.add('active');
      return activeEl;
    }
    return null;
  },
  querySelectorAll: () => [],
  createElement: (tag) => new MockDOMElement('', tag),
  addEventListener: () => {},
  removeEventListener: () => {}
};

const mockStorage = {
  store: {},
  getItem: function(k) { return this.store[k] || null; },
  setItem: function(k, v) { this.store[k] = String(v); },
  removeItem: function(k) { delete this.store[k]; },
  clear: function() { this.store = {}; }
};

global.document = mockDoc;
global.window = global;
global.window.addEventListener = () => {};
global.window.removeEventListener = () => {};
global.window.location = { replace: () => {}, href: '' };
global.location = global.window.location;
global.localStorage = mockStorage;
global.tanggalHariIni = () => '2026-11-09';

const fbConfig = require('../assets/firebase-config.js');
global.MASTER_DATA_SISWA_RESMI = fbConfig.MASTER_DATA_SISWA_RESMI;
global.MASTER_GURU_RESMI = fbConfig.MASTER_GURU_RESMI;
global.DAFTAR_KELAS_RESMI = fbConfig.DAFTAR_KELAS_RESMI;
global.normalisasiKelas = fbConfig.normalisasiKelas;
global.generateDefaultPresensiResmi = fbConfig.generateDefaultPresensiResmi;

const adminModule = require('../assets/admin.js');

// -------------------------------------------------------------------------
// [TEST 3] Verifikasi Telemetri Live Kehadiran 3 Kelas (muatMonitoring3Kelas)
// -------------------------------------------------------------------------
console.log('▶ [Test 3] Verifikasi Telemetri Live 3 Kelas (muatMonitoring3Kelas)...');

(async () => {
  const cardsContainer = getMock('cards3KelasMonitoring');
  const tableContainer = getMock('tabelRingkasan3Kelas');
  const guruContainer = getMock('monitoringGuruContainer');
  const badgeGuru = getMock('badgeGuruMonitoring');

  // Setup mock database dengan presensi_jam jam 1-8 dan absensi
  global.db = {
    ref: function(pathStr) {
      return {
        once: async function() {
          if (pathStr === 'kelas') {
            return {
              exists: () => true,
              val: () => ({
                'XII RPL 1': { status: 'belajar', activeMapel: 'Pemrograman Web', activeTeacherNama: 'Rijal Nur Rahmat, S.T' },
                'XII RPL 2': { status: 'belajar', activeMapel: 'Basis Data', activeTeacherNama: 'Muhammad Echa Putra, S.Kom.Gr' },
                'XII TKJ 1': { status: 'belajar', activeMapel: 'Infrastruktur Jaringan', activeTeacherNama: 'Heri Anggara, S.Kom' }
              })
            };
          }
          if (pathStr === 'presensi_jam') {
            return {
              exists: () => true,
              val: () => ({
                'XII RPL 1': {
                  '2026-11-09': {
                    '1': { '0091113849': { status: 'hadir', waktu: '06:25:00' } },
                    '2': { '0081953923': { status: 'hadir', waktu: '07:15:00' } }
                  }
                }
              })
            };
          }
          if (pathStr === 'absensi') {
            return {
              exists: () => true,
              val: () => ({
                '0098263610': { '2026-11-09': { status: 'hadir', waktu: '06:15:00' } }
              })
            };
          }
          if (pathStr === 'presensi_guru') {
            return {
              exists: () => true,
              val: () => ({
                '198109012009022003': {
                  '2026-11-09': { status: 'hadir', jamMasuk: '06:20:00', metode: 'RFID Gerbang' }
                }
              })
            };
          }
          return { exists: () => false, val: () => null };
        },
        on: function(ev, cb) {
          // Mock listener
        }
      };
    }
  };

  assert.strictEqual(typeof adminModule.muatMonitoring3Kelas, 'function', 'muatMonitoring3Kelas harus diekspor');

  await adminModule.muatMonitoring3Kelas();

  // Verifikasi container terisi
  assert.ok(cardsContainer.innerHTML.length > 50, 'cards3KelasMonitoring harus terisi HTML');
  assert.ok(tableContainer.innerHTML.length > 50, 'tabelRingkasan3Kelas harus terisi HTML');

  // Pastikan ketiga kelas resmi tercantum
  officialClasses.forEach(cls => {
    assert.ok(cardsContainer.innerHTML.includes(cls), `cards3KelasMonitoring harus memuat ${cls}`);
    assert.ok(tableContainer.innerHTML.includes(cls), `tabelRingkasan3Kelas harus memuat ${cls}`);
  });

  // Pastikan tidak ada persentase bernilai 0% saat data default presensi tersedia
  assert.ok(
    !tableContainer.innerHTML.includes('>0%<'),
    'Tabel ringkasan tidak boleh bernilai 0% kehadiran saat fallback resmi aktif'
  );

  console.log('  ✓ Telemetri 3 kelas pilot teragregasi presisi dan tidak kosong / 0%.\n');

  // -------------------------------------------------------------------------
  // [TEST 4] Verifikasi Monitoring Kehadiran Dewan Guru di Panel Admin
  // -------------------------------------------------------------------------
  console.log('▶ [Test 4] Verifikasi Monitoring Kehadiran Dewan Guru...');

  assert.ok(guruContainer.innerHTML.length > 50, 'monitoringGuruContainer harus terisi tabel');
  assert.ok(badgeGuru.textContent.includes('Hadir'), 'badgeGuruMonitoring harus menampilkan jumlah guru hadir');

  // Periksa bahwa 5 guru resmi ada di dalam tabel
  const guruNips = ['198109012009022003', '197905032006042004', '199209142022211007', '198312052022211017', '198504252024211008'];
  guruNips.forEach(nip => {
    assert.ok(
      guruContainer.innerHTML.includes(nip),
      `monitoringGuruContainer harus memuat guru dengan NIP ${nip}`
    );
  });

  // Bu Hani Hanifah tercatat Hadir
  assert.ok(
    guruContainer.innerHTML.includes('06:20:00'),
    'Jam presensi masuk Bu Hani (06:20:00) harus tercatat di tabel guru'
  );

  console.log('  ✓ Monitoring Dewan Guru terintegrasi dengan data live presensi_guru.\n');

  // -------------------------------------------------------------------------
  // [TEST 5] Verifikasi Tab Rekap Presensi (muatRekapPresensi)
  // -------------------------------------------------------------------------
  console.log('▶ [Test 5] Verifikasi Tab Rekap Presensi (muatRekapPresensi)...');

  const selRekap = getMock('rekapKelas', 'select');
  selRekap.value = 'XII RPL 1';
  selRekap.options = [{ value: 'XII RPL 1' }];

  const tglInput = getMock('rekapTanggal', 'input');
  tglInput.value = '2026-11-09';

  const selPeriode = getMock('rekapPeriodeAdmin', 'select');
  selPeriode.value = 'harian';

  const tbody = getMock('rekapTableBody');
  const theadRow = getMock('rekapTheadRow');
  const statTotal = getMock('statTotalSiswa');
  const statHadir = getMock('statHadir');
  const statSakit = getMock('statSakit');
  const statIzin  = getMock('statIzin');
  const statAlpha = getMock('statAlpha');

  assert.strictEqual(typeof adminModule.muatRekapPresensi, 'function', 'muatRekapPresensi harus diekspor');

  await adminModule.muatRekapPresensi();

  const totalSiswaRPL1 = Object.values(fbConfig.MASTER_DATA_SISWA_RESMI).filter(s => s.kelas === 'XII RPL 1').length;
  assert.strictEqual(parseInt(statTotal.textContent, 10), totalSiswaRPL1, `Total siswa rekap harus ${totalSiswaRPL1}`);
  assert.ok(parseInt(statHadir.textContent, 10) > 0, 'Stat hadir rekap harian harus lebih dari 0');
  assert.ok(tbody.innerHTML.includes('0091113849'), 'Tabel rekap harus memuat siswa Ahsan Mahmud');

  console.log(`  ✓ Rekap Presensi Sukses: Total Siswa=${statTotal.textContent}, Hadir=${statHadir.textContent}, Sakit=${statSakit.textContent}, Izin=${statIzin.textContent}, Alpa=${statAlpha.textContent}.\n`);

  // -------------------------------------------------------------------------
  // [TEST 6] Validasi Invarian DAFTAR_KELAS_RESMI (Strictly 3 Classes)
  // -------------------------------------------------------------------------
  console.log('▶ [Test 6] Validasi Invarian Rombel Resmi...');
  const permittedClasses = ['XII RPL 1', 'XII RPL 2', 'XII TKJ 1'];
  assert.deepStrictEqual(
    fbConfig.DAFTAR_KELAS_RESMI.sort(),
    permittedClasses.sort(),
    'DAFTAR_KELAS_RESMI strictly 3 classes'
  );
  console.log('  ✓ Invarian rombel sekolah terjaga kokoh (XII RPL 1, XII RPL 2, XII TKJ 1).\n');

  console.log('================================================================');
  console.log('🎉 SELURUH PENGUJIAN TELEMETRI KEHADIRAN & REKAP ADMIN LULUS 100%! (6/6)');
  console.log('================================================================');
  process.exit(0);
})().catch(err => {
  console.error('❌ Test gagal:', err);
  process.exit(1);
});
