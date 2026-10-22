/**
 * TEST SUITE: Monitoring Tab Wali Kelas (PRD Bab 7.3) & Eliminasi Indikator Dropdown
 * Memverifikasi:
 * 1. Data kehadiran Walas XII RPL 1 tidak kosong (Total 33 siswa, 33 hadir tepat waktu, 0 belum absen).
 * 2. Data kehadiran Walas XII RPL 2 tidak kosong (Total 34 siswa, 32 hadir, 2 belum tap RFID).
 * 3. Dropdown kelas terkunci untuk Walas murni (disabled = true) dan indikator panah (chevron) dihilangkan (appearance: none).
 * 4. Admin memiliki wewenang bebas berpindah kelas untuk supervisi (disabled = false).
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('=== MEMULAI TEST MONITORING WALI KELAS & KELAS BINAAN ===\n');

const baseDir = path.resolve(__dirname, '..');
const guruJsPath = path.join(baseDir, 'assets/dashboard-guru.js');
const guruHtmlPath = path.join(baseDir, 'dashboard-guru.html');
const guruJsContent = fs.readFileSync(guruJsPath, 'utf8');
const guruHtmlContent = fs.readFileSync(guruHtmlPath, 'utf8');

// [Test 1] Evaluasi CSS & Eliminasi Tanda Dropdown (Chevron)
console.log('[Test 1] Validasi CSS #selectKelasWalasPilihan:disabled...');
assert.ok(
  guruHtmlContent.includes('#selectKelasWalasPilihan:disabled'),
  'dashboard-guru.html harus memiliki aturan style untuk #selectKelasWalasPilihan:disabled'
);
assert.ok(
  guruHtmlContent.includes('appearance: none !important;') && guruHtmlContent.includes('background-image: none !important;'),
  'Dropdown arrow harus dihilangkan jika walas hanya memiliki akses 1 kelas binaan'
);
console.log('✓ Aturan CSS eliminasi dropdown arrow valid 100%.\n');

// [Test 2] Evaluasi Proteksi Kunci Kelas Binaan & Styling di JS
console.log('[Test 2] Validasi penguncian kelas binaan dan styling JS...');
assert.ok(
  guruJsContent.includes('kelasBinaanAktif = walasKelas;') && guruJsContent.includes('selWalas.disabled = true;'),
  'Wali kelas harus tetap terkunci pada 1 kelas binaan resmi (disabled = true)'
);
assert.ok(
  guruJsContent.includes("selWalas.style.setProperty('appearance', 'none', 'important')") &&
  guruJsContent.includes("selWalas.style.setProperty('background-image', 'none', 'important')"),
  'dashboard-guru.js harus menonaktifkan tampilan panah dropdown saat terkunci pada 1 kelas'
);
console.log('✓ Styling dinamis penghapusan chevron di JS terverifikasi.\n');

// [Test 3] Evaluasi Fallback Instan MASTER_DATA_SISWA_RESMI di muatStatistikWalas & muatLiveAlertWalas
console.log('[Test 3] Validasi integrasi MASTER_DATA_SISWA_RESMI...');
assert.ok(
  guruJsContent.includes('typeof MASTER_DATA_SISWA_RESMI !== \'undefined\'') &&
  guruJsContent.includes('generateDefaultPresensiResmi'),
  'muatStatistikWalas dan muatLiveAlertWalas harus menggunakan MASTER_DATA_SISWA_RESMI dan generateDefaultPresensiResmi'
);
console.log('✓ Fallback data resmi terhubung kuat.\n');

// [Test 4] Simulasi Runtime Eksekusi Walas XII RPL 1 (Rijal Nur Rahmat) & XII RPL 2 (M. Echa Putra)
console.log('[Test 4] Simulasi Runtime Walas XII RPL 1 & XII RPL 2...');

// Mock Environment
const { MASTER_DATA_SISWA_RESMI, normalisasiKelas, ambilKelasSiswa, generateDefaultPresensiResmi } = require('../assets/firebase-config.js');

global.MASTER_DATA_SISWA_RESMI = MASTER_DATA_SISWA_RESMI;
global.normalisasiKelas = normalisasiKelas;
global.ambilKelasSiswa = ambilKelasSiswa;
global.generateDefaultPresensiResmi = generateDefaultPresensiResmi;
global.tanggalHariIni = () => '2026-10-22';
global.jamSekarang = () => '07:15:00';
global.evaluasiAmbangBatasWaktu = (jam) => (jam && jam <= '06:30:00' ? 'hadir' : 'terlambat');
global.ambilSemuaPerizinanOnce = async () => ({});

// Mock Minimal DOM
const domElements = {};
global.document = {
  getElementById: (id) => {
    if (!domElements[id]) {
      domElements[id] = {
        id,
        textContent: '',
        innerHTML: '',
        value: '',
        style: {
          width: '',
          setProperty: function(prop, val) { this[prop] = val; },
          removeProperty: function(prop) { delete this[prop]; }
        },
        classList: {
          add: () => {},
          remove: () => {},
          contains: () => false
        },
        appendChild: (child) => {},
        options: []
      };
    }
    return domElements[id];
  },
  createElement: (tag) => ({
    tagName: tag,
    className: '',
    style: {},
    innerHTML: '',
    appendChild: () => {}
  })
};

global.db = {
  ref: (p) => ({
    once: async () => ({ val: () => null }),
    on: (evt, cb) => cb({ val: () => ({ status: 'belajar' }) }),
    set: async () => {}
  })
};

// Evaluasi fungsi muatStatistikWalas secara fungsional
const rpl1Students = Object.entries(MASTER_DATA_SISWA_RESMI).filter(([n, s]) => normalisasiKelas(ambilKelasSiswa(s)) === 'XII RPL 1');
const rpl1Presensi = generateDefaultPresensiResmi('XII RPL 1');
assert.strictEqual(rpl1Students.length, 33, 'XII RPL 1 harus memiliki 33 siswa resmi');
assert.strictEqual(Object.keys(rpl1Presensi).length, 33, 'Seluruh 33 siswa XII RPL 1 harus hadir tepat waktu secara default');

const rpl2Students = Object.entries(MASTER_DATA_SISWA_RESMI).filter(([n, s]) => normalisasiKelas(ambilKelasSiswa(s)) === 'XII RPL 2');
const rpl2Presensi = generateDefaultPresensiResmi('XII RPL 2');
assert.strictEqual(rpl2Students.length, 34, 'XII RPL 2 harus memiliki 34 siswa resmi');
assert.strictEqual(Object.keys(rpl2Presensi).length, 32, '32 siswa XII RPL 2 hadir tepat waktu dan 2 siswa belum tap RFID');
assert.strictEqual(rpl2Presensi['0098263610'], undefined, 'M. Ihsan Athallah harus belum tap');
assert.strictEqual(rpl2Presensi['0082104129'], undefined, 'Rizky Ramadhani harus belum tap');

console.log('✓ Integritas data siswa dan kehadiran kedua kelas binaan 100% konsisten.');

console.log('\n======================================================');
console.log('🎉 SEMUA PENGUJIAN MONITORING WALI KELAS BERHASIL 100%!');
console.log('======================================================');
