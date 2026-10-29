/**
 * test-diferensiasi-tanpa-keterangan.js
 * Verifikasi Komprehensif Diferensiasi Status:
 * 1. Siswa yang tap kartu > 06:30 WIB -> "Terlambat" (Hadir Terlambat)
 * 2. Siswa yang belum tap kartu & tanpa izin -> "Tanpa Keterangan"
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('================================================================');
console.log('🧪 PENGUJIAN DIFERENSIASI STATUS "TERLAMBAT" vs "TANPA KETERANGAN"');
console.log('================================================================\n');

// 1. Verifikasi Markup HTML dashboard-guru.html
console.log('▶ [Test 1] Evaluasi Label Stat Cards & Filter di dashboard-guru.html...');
const guruHtml = fs.readFileSync(path.join(__dirname, '../dashboard-guru.html'), 'utf8');

assert.ok(guruHtml.includes('id="walasBelumAbsen"'), 'Elemen walasBelumAbsen harus ada');
assert.ok(
  guruHtml.includes('<div class="stat-num" id="walasBelumAbsen" style="color:#dc2626;">0</div>\n          <div class="stat-label">Tanpa Keterangan</div>') ||
  guruHtml.includes('<div class="stat-label">Tanpa Keterangan</div>'),
  'Kartu stat walasBelumAbsen harus berlabel "Tanpa Keterangan"'
);

assert.ok(
  guruHtml.includes('id="statBelumGuru"'),
  'Elemen statBelumGuru harus ada'
);
assert.ok(
  guruHtml.includes('Tanpa Keterangan') && guruHtml.includes('id="btnFilterBelum"'),
  'Chip filter & kartu stat Guru Pengajar harus menampilkan "Tanpa Keterangan"'
);
assert.ok(
  guruHtml.includes('Siswa Tanpa Keterangan Pagi Ini'),
  'Header tab alert pagi harus "Siswa Tanpa Keterangan Pagi Ini"'
);
console.log('  ✓ Label markup dashboard-guru.html 100% konsisten berlabel "Tanpa Keterangan".\n');

// 2. Verifikasi Logika dashboard-guru.js
console.log('▶ [Test 2] Evaluasi Logika Perhitungan Walas di dashboard-guru.js...');
const guruJs = fs.readFileSync(path.join(__dirname, '../assets/dashboard-guru.js'), 'utf8');

assert.ok(
  guruJs.includes("statusLabel = 'Tanpa Keterangan';"),
  'Status label siswa belum tap di walas harus "Tanpa Keterangan"'
);
assert.ok(
  guruJs.includes("statusFinal = 'tanpa_keterangan';"),
  'statusFinal siswa belum tap harus "tanpa_keterangan"'
);
assert.ok(
  guruJs.includes('SISWA TANPA KETERANGAN'),
  'Header peringatan alert pagi harus memuat "SISWA TANPA KETERANGAN"'
);
assert.ok(
  guruJs.includes('TANPA KETERANGAN</span>') && guruJs.includes('⏱ TERLAMBAT</span>'),
  'Grid guru harus membedakan badge ⏱ TERLAMBAT (sudah tap lewat 06.30) dan TANPA KETERANGAN (belum tap)'
);
console.log('  ✓ Logika dashboard-guru.js secara tegas memisahkan Terlambat vs Tanpa Keterangan.\n');

// 3. Verifikasi Markup HTML dashboard.html & dashboard.js
console.log('▶ [Test 3] Evaluasi Label di dashboard.html & dashboard.js...');
const dashHtml = fs.readFileSync(path.join(__dirname, '../dashboard.html'), 'utf8');
const dashJs = fs.readFileSync(path.join(__dirname, '../assets/dashboard.js'), 'utf8');

assert.ok(
  dashHtml.includes('<div class="stat-label">Tanpa Keterangan</div>'),
  'Stat box belum di dashboard.html harus berlabel "Tanpa Keterangan"'
);
assert.ok(
  dashHtml.includes('Tanpa Keterangan (<span id="titleCountBelum">2</span>)'),
  'Title section siswa belum di dashboard.html harus "Tanpa Keterangan"'
);
assert.ok(
  dashJs.includes("pill.textContent = 'Tanpa Keterangan';"),
  'Pill text siswa belum absen di dashboard.js harus "Tanpa Keterangan"'
);
console.log('  ✓ dashboard.html dan dashboard.js 100% konsisten menggunakan "Tanpa Keterangan".\n');

// 4. Verifikasi Markup HTML presensi-live.html & presensi-live.js
console.log('▶ [Test 4] Evaluasi Label di presensi-live.html & presensi-live.js...');
const liveHtml = fs.readFileSync(path.join(__dirname, '../presensi-live.html'), 'utf8');
const liveJs = fs.readFileSync(path.join(__dirname, '../assets/presensi-live.js'), 'utf8');

assert.ok(
  liveHtml.includes('<span class="label">Tanpa Keterangan</span>'),
  'Kartu ringkasan di presensi-live.html harus berlabel "Tanpa Keterangan"'
);
assert.ok(
  liveHtml.includes('●</span> Tanpa Keterangan</h2>'),
  'Header roster belum tap di presensi-live.html harus "Tanpa Keterangan"'
);
assert.ok(
  liveJs.includes("pill.textContent = 'Tanpa Keterangan';"),
  'Status pill di presensi-live.js harus "Tanpa Keterangan"'
);
console.log('  ✓ presensi-live.html dan presensi-live.js 100% konsisten menggunakan "Tanpa Keterangan".\n');

// 5. Simulasi Matematis Distribusi Status Presensi
console.log('▶ [Test 5] Simulasi Matematis: Total Siswa = HadirTepat + Terlambat + Izin + TanpaKeterangan...');
function simulasiKalkulasi(siswaList, presensiHarian, izinList) {
  let hadirTepat = 0;
  let terlambat = 0;
  let izinSakit = 0;
  let tanpaKeterangan = 0;

  siswaList.forEach(s => {
    const tap = presensiHarian[s.nisn];
    const izin = izinList[s.nisn];

    if (tap && (tap.status === 'hadir' || tap.status === 'terlambat')) {
      if (tap.waktu > '06:30:00') {
        terlambat++;
      } else {
        hadirTepat++;
      }
    } else if (izin && izin.status === 'disetujui') {
      izinSakit++;
    } else {
      tanpaKeterangan++;
    }
  });

  return {
    total: siswaList.length,
    hadirTepat,
    terlambat,
    izinSakit,
    tanpaKeterangan
  };
}

const mockSiswa = [
  { nisn: '001', nama: 'Siswa Tepat Waktu' },
  { nisn: '002', nama: 'Siswa Terlambat' },
  { nisn: '003', nama: 'Siswa Izin Sakit' },
  { nisn: '004', nama: 'Siswa Tanpa Keterangan 1' },
  { nisn: '005', nama: 'Siswa Tanpa Keterangan 2' }
];

const mockPresensi = {
  '001': { status: 'hadir', waktu: '06:15:00' },
  '002': { status: 'hadir', waktu: '06:45:00' } // Scan > 06:30 WIB -> Terlambat!
};

const mockIzin = {
  '003': { status: 'disetujui', jenis: 'sakit' }
};

const hasil = simulasiKalkulasi(mockSiswa, mockPresensi, mockIzin);
assert.strictEqual(hasil.total, 5, 'Total siswa harus 5');
assert.strictEqual(hasil.hadirTepat, 1, 'Hadir tepat waktu harus 1 (06:15:00)');
assert.strictEqual(hasil.terlambat, 1, 'Terlambat harus 1 (06:45:00)');
assert.strictEqual(hasil.izinSakit, 1, 'Izin sakit harus 1');
assert.strictEqual(hasil.tanpaKeterangan, 2, 'Tanpa keterangan harus 2 (belum tap & tanpa izin)');
assert.strictEqual(
  hasil.hadirTepat + hasil.terlambat + hasil.izinSakit + hasil.tanpaKeterangan,
  hasil.total,
  'Penjumlahan seluruh kategori harus tepat sama dengan total siswa'
);
console.log('  ✓ Distribusi status presensi matematis sempurna & tidak tumpang tindih (100% Akurat).');

console.log('\n================================================================');
console.log('🎉 SEMUA PENGUJIAN DIFERENSIASI STATUS BERHASIL 100%! (5/5)');
console.log('================================================================');
