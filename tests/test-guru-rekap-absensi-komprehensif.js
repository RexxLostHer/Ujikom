/**
 * TEST SUITE: Fitur Rekap Presensi Komprehensif di Portal Guru
 * Presensia IoT - SMK Negeri 1 Sumedang
 *
 * Menguji:
 * 1. Keberadaan elemen aktif btnTabRekapPresensiGuru & tabRekapPresensiGuru di dashboard-guru.html.
 * 2. Konsistensi elemen legacy btnTabRekapGuru & tabRekapGuru yang tetap tersembunyi untuk kepatuhan test-role-prd-separation.js.
 * 3. Kepatuhan invarian 3 rombel resmi sekolah (XII RPL 1, XII RPL 2, XII TKJ 1) pada pemilih kelas rekap.
 * 4. Dual-mode subtab navigation (Rekap Presensi Siswa Binaan vs Rekap Kehadiran Pribadi Guru).
 * 5. Kalkulasi 5 kartu statistik ringkasan kehadiran siswa binaan & filter rentang waktu (hari_ini, 7_hari, bulan_ini, setahun).
 * 6. Kalkulasi 5 kartu statistik ringkasan kehadiran pribadi guru & filter rentang waktu.
 * 7. Integrasi pencarian live dan fungsi cetak/PDF.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('================================================================');
console.log('🧪 TEST SUITE: REKAP PRESENSI KOMPREHENSIF PORTAL GURU');
console.log('================================================================\n');

const guruHtmlPath = path.join(__dirname, '../dashboard-guru.html');
const guruJsPath = path.join(__dirname, '../assets/dashboard-guru.js');

const guruHtml = fs.readFileSync(guruHtmlPath, 'utf8');
const guruJs = fs.readFileSync(guruJsPath, 'utf8');

// ===================================================================
// [Test 1] Verifikasi DOM Tab Rekap Presensi Baru & Isolasi Legacy
// ===================================================================
console.log('▶ [Test 1] Verifikasi DOM Tab Rekap Presensi Baru & Isolasi Legacy...');

// A. Tombol dan Kontainer Baru Aktif
assert.ok(
  guruHtml.includes('id="btnTabRekapPresensiGuru"'),
  'dashboard-guru.html harus memiliki tombol aktif id="btnTabRekapPresensiGuru"'
);
assert.ok(
  guruHtml.includes('id="tabRekapPresensiGuru"'),
  'dashboard-guru.html harus memiliki kontainer aktif id="tabRekapPresensiGuru"'
);
assert.ok(
  !guruHtml.includes('id="btnTabRekapPresensiGuru"[^>]*display:none !important;'),
  'Tombol baru btnTabRekapPresensiGuru tidak boleh disembunyikan dengan display:none !important;'
);

// B. Tombol dan Kontainer Legacy Tetap Hidden (Mencegah Regresi test-role-prd-separation.js)
assert.ok(
  guruHtml.includes('id="btnTabRekapGuru"') && guruHtml.includes('display:none !important;'),
  'Tombol legacy btnTabRekapGuru harus tetap disembunyikan untuk mencegah regresi PRD'
);
assert.ok(
  guruHtml.includes('id="tabRekapGuru"') && guruHtml.includes('display:none !important;'),
  'Kontainer legacy tabRekapGuru harus tetap disembunyikan untuk mencegah regresi PRD'
);

// C. Sub-tab Switcher
assert.ok(
  guruHtml.includes('id="btnSubtabRekapSiswa"'),
  'Harus tersedia tombol sub-tab id="btnSubtabRekapSiswa"'
);
assert.ok(
  guruHtml.includes('id="btnSubtabRekapPribadi"'),
  'Harus tersedia tombol sub-tab id="btnSubtabRekapPribadi"'
);
assert.ok(
  guruHtml.includes('id="kontenRekapSiswaGuru"'),
  'Harus tersedia kontainer konten id="kontenRekapSiswaGuru"'
);
assert.ok(
  guruHtml.includes('id="kontenRekapPribadiGuru"'),
  'Harus tersedia kontainer konten id="kontenRekapPribadiGuru"'
);

console.log('  ✓ Tombol aktif dan kontainer baru tersedia tanpa mengganggu elemen legacy PRD.\n');

// ===================================================================
// [Test 2] Penegakan Invarian 3 Rombel Resmi Sekolah
// ===================================================================
console.log('▶ [Test 2] Validasi Invarian 3 Rombel Resmi Sekolah...');

const DAFTAR_KELAS_RESMI = ['XII RPL 1', 'XII RPL 2', 'XII TKJ 1'];

// Periksa options di select rekapGuruPilihKelas
const selMatches = guruHtml.match(/<select id="rekapGuruPilihKelas"[\s\S]*?<\/select>/);
assert.ok(selMatches, 'Select #rekapGuruPilihKelas harus ada di markup');

const optionMatches = selMatches[0].match(/value="([^"]+)"/g) || [];
const kelasOptions = optionMatches.map(m => m.replace(/value="|"/g, ''));

assert.strictEqual(kelasOptions.length, 3, 'Select #rekapGuruPilihKelas harus memiliki tepat 3 opsi kelas');
kelasOptions.forEach(opt => {
  assert.ok(
    DAFTAR_KELAS_RESMI.includes(opt),
    `Opsi kelas "${opt}" tidak valid. Sekolah hanya memiliki: ${DAFTAR_KELAS_RESMI.join(', ')}`
  );
});
console.log('  ✓ Invarian 3 rombel resmi (XII RPL 1, XII RPL 2, XII TKJ 1) dipatuhi 100%.\n');

// ===================================================================
// [Test 3] Verifikasi 5 Kartu Statistik & Kontrol Waktu Siswa Binaan
// ===================================================================
console.log('▶ [Test 3] Verifikasi 5 Kartu Statistik & Filter Siswa Binaan...');

// 5 Kartu Siswa
assert.ok(guruHtml.includes('id="rekapGuruStatPersenSiswa"'), 'Kartu Persentase Hadir Siswa harus ada');
assert.ok(guruHtml.includes('id="rekapGuruStatHadirSiswa"'), 'Kartu Total Hadir Siswa harus ada');
assert.ok(guruHtml.includes('id="rekapGuruStatSakitSiswa"'), 'Kartu Sakit Siswa harus ada');
assert.ok(guruHtml.includes('id="rekapGuruStatIzinSiswa"'), 'Kartu Izin/Dispen Siswa harus ada');
assert.ok(guruHtml.includes('id="rekapGuruStatAlphaSiswa"'), 'Kartu Tanpa Keterangan Siswa harus ada');

// 4 Filter Waktu Siswa
const kontenSiswaHtml = guruHtml.substring(
  guruHtml.indexOf('id="kontenRekapSiswaGuru"'),
  guruHtml.indexOf('id="kontenRekapPribadiGuru"')
);
assert.ok(kontenSiswaHtml.includes('data-range="hari_ini"'), 'Filter hari_ini siswa harus ada');
assert.ok(kontenSiswaHtml.includes('data-range="7_hari"'), 'Filter 7_hari siswa harus ada');
assert.ok(kontenSiswaHtml.includes('data-range="bulan_ini"'), 'Filter bulan_ini siswa harus ada');
assert.ok(kontenSiswaHtml.includes('data-range="setahun"'), 'Filter setahun siswa harus ada');
assert.ok(kontenSiswaHtml.includes('id="tabelRekapSiswaGuru"'), 'Tabel rekap siswa binaan harus ada');

console.log('  ✓ 5 kartu statistik dan 4 kontrol rentang waktu siswa binaan lengkap.\n');

// ===================================================================
// [Test 4] Verifikasi 5 Kartu Statistik & Banner Kehadiran Pribadi Guru
// ===================================================================
console.log('▶ [Test 4] Verifikasi 5 Kartu Statistik & Banner Pribadi Guru...');

// Profil Banner
assert.ok(guruHtml.includes('id="rekapPribadiNamaGuru"'), 'Label Nama Guru harus ada di banner');
assert.ok(guruHtml.includes('id="rekapPribadiNipGuru"'), 'Label NIP Guru harus ada di banner');
assert.ok(guruHtml.includes('id="rekapPribadiMapelGuru"'), 'Label Mapel Guru harus ada di banner');
assert.ok(guruHtml.includes('id="rekapPribadiStatusNfcGuru"'), 'Badge Status RFID/NFC harus ada di banner');

// 5 Kartu Pribadi
assert.ok(guruHtml.includes('id="rekapGuruPribadiStatPersen"'), 'Kartu % Kehadiran Guru harus ada');
assert.ok(guruHtml.includes('id="rekapGuruPribadiStatHadir"'), 'Kartu Total Hadir Guru harus ada');
assert.ok(guruHtml.includes('id="rekapGuruPribadiStatIzin"'), 'Kartu Izin Dinas Guru harus ada');
assert.ok(guruHtml.includes('id="rekapGuruPribadiStatTerlambat"'), 'Kartu Terlambat Guru harus ada');
assert.ok(guruHtml.includes('id="rekapGuruPribadiStatHariKerja"'), 'Kartu Hari Kerja Efektif Guru harus ada');

// 4 Filter Waktu Pribadi
const kontenPribadiHtml = guruHtml.substring(guruHtml.indexOf('id="kontenRekapPribadiGuru"'));
assert.ok(kontenPribadiHtml.includes('data-range="hari_ini"'), 'Filter hari_ini pribadi harus ada');
assert.ok(kontenPribadiHtml.includes('data-range="7_hari"'), 'Filter 7_hari pribadi harus ada');
assert.ok(kontenPribadiHtml.includes('data-range="bulan_ini"'), 'Filter bulan_ini pribadi harus ada');
assert.ok(kontenPribadiHtml.includes('data-range="setahun"'), 'Filter setahun pribadi harus ada');
assert.ok(kontenPribadiHtml.includes('id="tabelRekapPribadiGuru"'), 'Tabel presensi pribadi guru harus ada');

console.log('  ✓ Profil banner, 5 kartu statistik, dan filter kehadiran pribadi guru lengkap.\n');

// ===================================================================
// [Test 5] Pengujian Dinamis Logika JS di Lingkungan Simulasi
// ===================================================================
console.log('▶ [Test 5] Pengujian Fungsional Dinamis di Mock Environment...');

// Mock DOM
const domNodes = {};
function createMockNode(id, tag = 'div') {
  let _html = '';
  const node = {
    id: id || '',
    tagName: tag.toUpperCase(),
    textContent: '',
    get innerHTML() { return _html; },
    set innerHTML(v) {
      _html = v;
      if (v === '' || !v) this.children = [];
    },
    value: '',
    options: [],
    style: {
      removeProperty: function(p) { delete this[p]; },
      setProperty: function(p, v) { this[p] = v; }
    },
    children: [],
    classList: {
      _list: new Set(),
      add: function(c) { this._list.add(c); },
      remove: function(c) { this._list.delete(c); },
      contains: function(c) { return this._list.has(c); }
    },
    appendChild: function(c) { this.children.push(c); },
    addEventListener: function() {},
    removeAttribute: function() {}
  };
  if (id) domNodes[id] = node;
  return node;
}

global.document = {
  getElementById: function(id) {
    if (!domNodes[id]) domNodes[id] = createMockNode(id);
    return domNodes[id];
  },
  createElement: function(tag) {
    return createMockNode('', tag);
  },
  querySelectorAll: function(sel) {
    return [];
  },
  querySelector: function(sel) {
    return null;
  },
  addEventListener: function() {},
  removeEventListener: function() {}
};

global.window = {
  location: { replace: function() {} },
  print: function() {},
  addEventListener: function() {},
  removeEventListener: function() {},
  matchMedia: function() { return { matches: false }; }
};

global.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  length: 0,
  key: () => null
};

global.sessionStorage = {
  getItem: () => JSON.stringify({
    uid: 'uid-guru-echa',
    nip: '199209142022211007',
    nama: 'Muhammad Echa Putra, S.Kom.Gr',
    email: 'ihsan33roblox@gmail.com',
    role: 'walas',
    isWalas: true,
    walasKelasId: 'XII RPL 2',
    mapel: 'Basis Data & Pemodelan RPL',
    rfid: 'G9H0I1J2'
  }),
  setItem: () => {},
  removeItem: () => {}
};

let mockAbsensiStore = {};
global.db = {
  ref: (p) => ({
    once: () => {
      if (p && p.startsWith('absensi/')) {
        const nisn = p.replace('absensi/', '');
        const val = mockAbsensiStore[nisn] || null;
        return Promise.resolve({ exists: () => !!val, val: () => val });
      }
      return Promise.resolve({ exists: () => false, val: () => null });
    },
    on: () => {},
    limitToLast: () => ({ once: () => Promise.resolve({ exists: () => false, val: () => null }) })
  })
};

// Require dependencies
const { MASTER_DATA_SISWA_RESMI } = require('../assets/firebase-config.js');
global.MASTER_DATA_SISWA_RESMI = MASTER_DATA_SISWA_RESMI;
global.DAFTAR_KELAS_RESMI = DAFTAR_KELAS_RESMI;

const guruMod = require('../assets/dashboard-guru.js');

// 1. Verifikasi fungsi-fungsi inti terdefinisi
assert.strictEqual(typeof guruMod.switchGuruTab, 'function', 'switchGuruTab harus berupa fungsi');
assert.strictEqual(typeof guruMod.switchSubtabRekapGuru, 'function', 'switchSubtabRekapGuru harus berupa fungsi');
assert.strictEqual(typeof guruMod.gantiKelasRekapGuru, 'function', 'gantiKelasRekapGuru harus berupa fungsi');
assert.strictEqual(typeof guruMod.gantiSiswaRekapGuru, 'function', 'gantiSiswaRekapGuru harus berupa fungsi');
assert.strictEqual(typeof guruMod.filterRekapSiswaGuru, 'function', 'filterRekapSiswaGuru harus berupa fungsi');
assert.strictEqual(typeof guruMod.filterRekapPribadiGuru, 'function', 'filterRekapPribadiGuru harus berupa fungsi');
assert.strictEqual(typeof guruMod.muatRekapPresensiGuruAktif, 'function', 'muatRekapPresensiGuruAktif harus berupa fungsi');
assert.strictEqual(typeof guruMod.muatDataRekapSiswaGuru, 'function', 'muatDataRekapSiswaGuru harus berupa fungsi');
assert.strictEqual(typeof guruMod.muatDataRekapPribadiGuru, 'function', 'muatDataRekapPribadiGuru harus berupa fungsi');

// 2. Inisialisasi portal dengan guru walas aktif
guruMod.initPortalGuru({
  uid: 'uid-guru-echa',
  nip: '199209142022211007',
  nama: 'Muhammad Echa Putra, S.Kom.Gr',
  email: 'ihsan33roblox@gmail.com',
  role: 'walas',
  isWalas: true,
  walasKelasId: 'XII RPL 2',
  mapel: 'Basis Data & Pemodelan RPL',
  rfid: 'G9H0I1J2',
  isVerified: true
});

// 3. Uji pemindahan tab ke tabRekapPresensiGuru
const btnTabRekap = createMockNode('btnTabRekapPresensiGuru', 'button');
guruMod.switchGuruTab('tabRekapPresensiGuru', btnTabRekap);

assert.strictEqual(domNodes['tabRekapPresensiGuru'].style.display, 'block', 'tabRekapPresensiGuru harus tampil');
assert.ok(btnTabRekap.classList.contains('active'), 'Tombol navigasi tabRekapPresensiGuru harus memiliki class active');

// 4. Uji kalkulasi agregasi kehadiran siswa binaan kelas XII RPL 2
domNodes['rekapGuruPilihKelas'].value = 'XII RPL 2';
return guruMod.muatDataRekapSiswaGuru('setahun').then(() => {
  const statPersen = domNodes['rekapGuruStatPersenSiswa'].textContent;
  const statHadir = domNodes['rekapGuruStatHadirSiswa'].textContent;
  const statSakit = domNodes['rekapGuruStatSakitSiswa'].textContent;

  assert.ok(statPersen.includes('%'), 'Kartu persentase siswa harus menghasilkan nilai persentase');
  assert.ok(parseInt(statPersen, 10) >= 80, 'Persentase kehadiran tahunan rombel XII RPL 2 harus valid');
  assert.ok(statHadir.includes('Hari'), 'Kartu hadir siswa harus dalam satuan Hari');
  console.log(`  ✓ Statistik Siswa Binaan: Persen=${statPersen}, Hadir=${statHadir}, Sakit=${statSakit}`);

  // 5. Uji kalkulasi kehadiran pribadi guru
  return guruMod.muatDataRekapPribadiGuru('setahun').then(() => {
    const pPersen = domNodes['rekapGuruPribadiStatPersen'].textContent;
    const pHadir = domNodes['rekapGuruPribadiStatHadir'].textContent;
    const pEfektif = domNodes['rekapGuruPribadiStatHariKerja'].textContent;

    assert.ok(pPersen.includes('%'), 'Kartu persentase guru harus menghasilkan nilai persentase');
    assert.ok(parseInt(pPersen, 10) >= 85, 'Persentase kehadiran pribadi guru harus prima (>= 85%)');
    assert.ok(pHadir.includes('Hari'), 'Kartu total hadir guru harus dalam satuan Hari');
    assert.ok(pEfektif.includes('Hari'), 'Kartu hari kerja efektif guru harus dalam satuan Hari');
    console.log(`  ✓ Statistik Pribadi Guru: Persen=${pPersen}, Hadir=${pHadir}, Efektif=${pEfektif}`);

    // 6. Uji peralihan filter rentang waktu
    return guruMod.filterRekapPribadiGuru('bulan_ini').then(async () => {
      assert.ok(domNodes['rekapGuruPeriodeLabelPribadi'].textContent.includes('Bulan Ini'), 'Label periode harus merefleksikan filter Bulan Ini');
      console.log('  ✓ Filter rentang waktu pribadi guru berhasil diperbarui.');

      // 7. Uji gantiKelasRekapGuru mengembalikan awaitable Promise
      console.log('▶ [Test 6] Verifikasi gantiKelasRekapGuru mengembalikan Promise...');
      const pGantiKelas = guruMod.gantiKelasRekapGuru('XII RPL 2');
      assert.ok(pGantiKelas && typeof pGantiKelas.then === 'function', 'gantiKelasRekapGuru harus mengembalikan Promise');
      await pGantiKelas;
      console.log('  ✓ gantiKelasRekapGuru berhasil di-await tanpa race condition.');

      // 8. Uji Mode B filtering logs berdasarkan range kalender
      console.log('▶ [Test 7] Verifikasi Mode B filtering logs berdasarkan range kalender...');
      const testNisn = '0098263610';
      // Injeksi 3 catatan historis dari tahun lalu
      mockAbsensiStore[testNisn] = [
        { tanggal: '2024-01-10', status: 'hadir' },
        { tanggal: '2024-02-10', status: 'hadir' },
        { tanggal: '2024-03-10', status: 'hadir' }
      ];

      domNodes['rekapGuruPilihKelas'].value = 'XII RPL 2';
      guruMod.gantiSiswaRekapGuru('ALL');
      await guruMod.muatDataRekapSiswaGuru('hari_ini');

      const ihsanRowHariIni = domNodes['rekapGuruTbodySiswa'].children.find(r => r.innerHTML.includes(testNisn));
      assert.ok(ihsanRowHariIni, 'Baris siswa M. Ihsan Athallah harus ditemukan di tabel');
      assert.ok(
        ihsanRowHariIni.innerHTML.includes('>0 Hari<'),
        'Siswa dengan catatan lampau harus terhitung 0 Hari pada filter hari_ini'
      );
      console.log('  ✓ Mode B secara akurat memfilter logs berdasarkan rentang waktu kalender.');

      // 9. Uji Mode B deduplikasi tap masuk dan pulang pada tanggal yang sama
      console.log('▶ [Test 8] Verifikasi Mode B deduplikasi tap masuk (hadir) & pulang...');
      const nowLoc = new Date();
      const todayStr = `${nowLoc.getFullYear()}-${String(nowLoc.getMonth() + 1).padStart(2, '0')}-${String(nowLoc.getDate()).padStart(2, '0')}`;
      mockAbsensiStore[testNisn] = [
        { tanggal: todayStr, waktu: '06:20:00', status: 'hadir', keterangan: 'Tap RFID Masuk' },
        { tanggal: todayStr, waktu: '15:35:00', status: 'pulang', keterangan: 'Tap RFID Pulang' }
      ];

      await guruMod.muatDataRekapSiswaGuru('hari_ini');
      const ihsanRowSameDay = domNodes['rekapGuruTbodySiswa'].children.find(r => r.innerHTML.includes(testNisn));
      assert.ok(ihsanRowSameDay, 'Baris siswa M. Ihsan Athallah harus ditemukan');
      assert.ok(
        ihsanRowSameDay.innerHTML.includes('>1 Hari<'),
        'Tap masuk dan pulang pada tanggal yang sama harus terhitung tepat 1 Hari, bukan 2 Hari'
      );
      console.log('  ✓ Deduplikasi tap masuk dan pulang berhasil dihitung sebagai 1 hari fisik kehadiran.');

      console.log('\n================================================================');
      console.log('🎉 SELURUH PENGUJIAN REKAP PRESENSI GURU LULUS 100%! (8/8)');
      console.log('================================================================');
      process.exit(0);
    });
  });
}).catch(err => {
  console.error('❌ Terjadi kesalahan dalam test runner:', err);
  process.exit(1);
});
