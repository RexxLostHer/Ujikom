/**
 * Test Suite: Sinkronisasi Status Rekap Presensi Walas & Penghapusan Simulasi Admin
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('--- TEST SUITE: SINKRONISASI REKAP WALAS & PENGHAPUSAN SIMULASI ADMIN ---');

// ============================================================================
// 1. UJI PENGHAPUSAN SIMULASI DI ADMIN.HTML
// ============================================================================
const adminHtmlPath = path.join(__dirname, '../admin.html');
const adminHtml = fs.readFileSync(adminHtmlPath, 'utf8');

assert.strictEqual(adminHtml.includes('data-tab="simulasi"'), false, 'Menu tab simulasi tidak boleh ada di admin.html');
assert.strictEqual(adminHtml.includes('id="tab-simulasi"'), false, 'Kontainer tab-simulasi tidak boleh ada di admin.html');
assert.strictEqual(adminHtml.includes('Simulasi Presensi'), false, 'Teks Simulasi Presensi tidak boleh ada di admin.html');
assert.strictEqual(adminHtml.includes('SIMULASI SISTEM'), false, 'Section SIMULASI SISTEM tidak boleh ada di admin.html');

// Pastikan tab operasional utama admin tetap utuh
assert.strictEqual(adminHtml.includes('id="tab-perijinan"'), true, 'tab-perijinan harus tetap ada');
assert.strictEqual(adminHtml.includes('id="tab-kendala"'), true, 'tab-kendala harus tetap ada');
assert.strictEqual(adminHtml.includes('id="tab-monitoring3kelas"'), true, 'tab-monitoring3kelas harus tetap ada');
assert.strictEqual(adminHtml.includes('id="tab-presensi"'), true, 'tab-presensi harus tetap ada');
assert.strictEqual(adminHtml.includes('id="tab-rekap"'), true, 'tab-rekap harus tetap ada');
assert.strictEqual(adminHtml.includes('id="tab-siswa"'), true, 'tab-siswa harus tetap ada');
assert.strictEqual(adminHtml.includes('id="tab-kartu"'), true, 'tab-kartu harus tetap ada');
assert.strictEqual(adminHtml.includes('id="tab-jadwal"'), true, 'tab-jadwal harus tetap ada');
assert.strictEqual(adminHtml.includes('id="tab-pelajaran"'), true, 'tab-pelajaran harus tetap ada');
assert.strictEqual(adminHtml.includes('id="tab-guru"'), true, 'tab-guru harus tetap ada');

console.log('✓ [Test 1] Fitur Simulasi Presensi berhasil dihapus penuh dari admin.html tanpa merusak tab lainnya');

// ============================================================================
// 2. UJI SINKRONISASI STATUS REKAP PRESENSI WALAS (DASHBOARD-GURU.JS)
// ============================================================================
// Mock DOM minimal untuk pengujian generateRekapGuru
const createdRows = [];
const mockTbody = {
  innerHTML: '',
  appendChild: function (node) {
    createdRows.push(node);
  }
};

const mockThead = { innerHTML: '' };
const mockStats = {
  persen: { textContent: '' },
  hadir: { textContent: '' },
  sakit: { textContent: '' },
  izin: { textContent: '' },
  alpha: { textContent: '' }
};

global.document = {
  getElementById: function (id) {
    if (id === 'bodyTabelRekap') return mockTbody;
    if (id === 'headTabelRekapGuru') return mockThead;
    if (id === 'rekapKelas' || id === 'rekapGuruPilihKelas') return { value: 'XII RPL 2' };
    if (id === 'rekapTanggal' || id === 'rekapGuruTanggal') return { value: '2026-11-15' };
    if (id === 'rekapGuruStatPersen') return mockStats.persen;
    if (id === 'rekapGuruStatHadir') return mockStats.hadir;
    if (id === 'rekapGuruStatSakit') return mockStats.sakit;
    if (id === 'rekapGuruStatIzin') return mockStats.izin;
    if (id === 'rekapGuruStatAlpha') return mockStats.alpha;
    return null;
  },
  createElement: function (tag) {
    return {
      tagName: tag,
      innerHTML: '',
      style: {}
    };
  },
  addEventListener: function () {},
  removeEventListener: function () {},
  querySelectorAll: function () { return []; }
};

global.window = {
  addEventListener: function () {},
  removeEventListener: function () {},
  document: global.document
};
global.addEventListener = function () {};
global.removeEventListener = function () {};

let dbMockHandler = null;
global.db = {
  ref: function (pathStr) {
    if (dbMockHandler) return dbMockHandler(pathStr);
    return { once: async () => ({ exists: () => false, val: () => null }) };
  }
};
global.window.db = global.db;

// Muat helper firebase-config & dashboard-guru
const fbConfigCode = fs.readFileSync(path.join(__dirname, '../assets/firebase-config.js'), 'utf8');
eval(fbConfigCode);
db = global.db;
window.db = global.db;

const guruJsCode = fs.readFileSync(path.join(__dirname, '../assets/dashboard-guru.js'), 'utf8');
eval(guruJsCode);

// Skenario A: Siswa Rizky Ramadani (0082104129) tercatat status 'alpa' di presensi_jam
// M. Ihsan Athallah (0098263610) memiliki izin disetujui
// 33 siswa lainnya memiliki default presensi hadir
async function runRekapGuruTest() {
  dbMockHandler = function (pathStr) {
    return {
      once: async function () {
        if (pathStr.includes('presensi_jam/XII RPL 2/2026-11-15')) {
            return {
              exists: () => true,
              val: () => ({
                '1': {
                  '0082104129': {
                    status: 'alpa',
                    waktu: '08:00:00',
                    tipe: 'auto_alpa_system',
                    keterangan: 'Auto-Alpa (Tidak Hadir & Tanpa Keterangan s.d 08.00 WIB)'
                  }
                }
              })
            };
          }
          if (pathStr.includes('perijinan') || pathStr.includes('perizinan')) {
            return {
              exists: () => true,
              val: () => ({
                'izin_ihsan': {
                  id: 'izin_ihsan',
                  nisn: '0098263610',
                  nama: 'M. IHSAN ATHALLAH',
                  kelas: 'XII RPL 2',
                  tanggal: '2026-11-15',
                  status: 'disetujui',
                  jenis: 'izin',
                  alasan: 'Keperluan Keluarga'
                }
              })
            };
          }
          if (pathStr === 'siswa') {
            return {
              exists: () => true,
              val: () => MASTER_DATA_SISWA_RESMI
            };
          }
          return { exists: () => false, val: () => null };
        }
      };
    };

  global.ambilSemuaPerizinanOnce = async function () {
    return {
      'izin_ihsan': {
        nisn: '0098263610',
        kelas: 'XII RPL 2',
        tanggal: '2026-11-15',
        status: 'disetujui',
        jenis: 'izin',
        alasan: 'Keperluan Keluarga'
      }
    };
  };

  await setRentangRekapGuru('hari_ini');

  // Validasi statistik rekapitulasi harian
  assert.strictEqual(mockStats.hadir.textContent, '33 Siswa', 'Total Hadir harus 33 siswa');
  assert.strictEqual(mockStats.izin.textContent, '1 Siswa', 'Izin harus 1 siswa (M. Ihsan Athallah)');
  assert.strictEqual(mockStats.alpha.textContent, '1 Siswa', 'Tanpa Keterangan harus 1 siswa (Rizky Ramadani), TIDAK BOLEH 0!');
  assert.strictEqual(mockStats.sakit.textContent, '0 Siswa', 'Sakit harus 0 siswa');
  assert.strictEqual(mockStats.persen.textContent, '94%', 'Persentase hadir harus 33 / 35 = 94%');

  // Validasi isi baris Rizky Ramadani
  const rizkyRow = createdRows.find(r => r.innerHTML.includes('0082104129') || r.innerHTML.includes('RIZKY RAMADANI'));
  assert.ok(rizkyRow, 'Baris Rizky Ramadani harus ada di tabel rekap');
  assert.ok(rizkyRow.innerHTML.includes('Tanpa Keterangan'), 'Status Rizky Ramadani harus Tanpa Keterangan');
  assert.ok(!rizkyRow.innerHTML.includes('>Hadir<'), 'Status Rizky Ramadani DILARANG menjadi Hadir');
  assert.ok(rizkyRow.innerHTML.includes('color:#ef4444'), 'Status Rizky Ramadani harus bertuliskan warna merah');

  console.log('✓ [Test 2] generateRekapGuru() dengan status alpa/tanpa_keterangan terhitung akurat (Alpha: 1, Hadir: 33)');

  // Skenario B: Belum tap sama sekali (presensi_jam kosong) & tanpa perizinan
  // Rizky (0082104129) dan Ihsan (0098263610) masuk EXCLUDED_BELUM_ABSEN_NISN -> TETAP Tanpa Keterangan (total 2)
  global.db.ref = function (pathStr) {
    return {
      once: async function () {
        if (pathStr.includes('presensi_jam')) {
          return { exists: () => false, val: () => null };
        }
        if (pathStr === 'siswa') {
          return { exists: () => true, val: () => MASTER_DATA_SISWA_RESMI };
        }
        return { exists: () => false, val: () => null };
      }
    };
  };

  createdRows.length = 0;
  await generateRekapGuru();

  assert.strictEqual(mockStats.alpha.textContent, '2 Siswa', 'Kedua siswa di EXCLUDED_BELUM_ABSEN_NISN (Rizky & Ihsan) tetap Tanpa Keterangan');
  assert.strictEqual(mockStats.hadir.textContent, '33 Siswa', 'Hadir tetap 33 siswa');

  const rizkyRowB = createdRows.find(r => r.innerHTML.includes('0082104129'));
  assert.ok(rizkyRowB.innerHTML.includes('Tanpa Keterangan'), 'Rizky Ramadani tetap berstatus Tanpa Keterangan tanpa fallback hadir');
  const ihsanRowB = createdRows.find(r => r.innerHTML.includes('0098263610'));
  assert.ok(ihsanRowB.innerHTML.includes('Tanpa Keterangan'), 'M. Ihsan Athallah tetap berstatus Tanpa Keterangan tanpa fallback hadir');

  console.log('✓ [Test 3] Siswa dalam EXCLUDED_BELUM_ABSEN_NISN tidak tertimpa default presensi hadir');
}

runRekapGuruTest().then(() => {
  console.log('\n============================================================');
  console.log('🎉 SELURUH PENGUJIAN SINKRONISASI REKAP & SIMULASI LULUS 100%!');
  console.log('============================================================');
}).catch(err => {
  console.error('❌ GAGAL PENGUJIAN:', err);
  process.exit(1);
});
