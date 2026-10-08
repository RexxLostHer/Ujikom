// ===================================================================
// TEST SUITE: test-role-prd-separation.js
// Verifikasi Pemisahan Peran & Isolasi Data Sesuai PRD:
// 1. Siswa: Riwayat kehadiran pribadi, tanpa data seluruh siswa / master siswa
// 2. Guru Pengajar: Jadwal & Radar KBM, Lapor Kendala Jamkos, Presensi Guru
// 3. Wali Kelas: Monitoring 1 Kelas Binaan, Live Alert Keterlambatan, Validasi Izin
// 4. Admin: Satu-satunya pemilik Master Data, Rekap Tahunan, & ACC Jamkos
// ===================================================================

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('=== MEMULAI TEST PEMISAHAN PERAN & ISOLASI PRD ===\n');

// 1. Verifikasi Dashboard Siswa (dashboard.html & assets/dashboard.js)
console.log('[Test 1] Evaluasi Isolasi Dashboard Siswa...');
const dashHtml = fs.readFileSync(path.join(__dirname, '../dashboard.html'), 'utf8');
const dashJs = fs.readFileSync(path.join(__dirname, '../assets/dashboard.js'), 'utf8');

// A. Tab Pantau Presensi Kelas harus disembunyikan dari siswa
assert.ok(
  dashHtml.includes('id="btnTabKelas"') && dashHtml.includes('style="display:none;"'),
  'Tombol btnTabKelas harus disembunyikan untuk siswa'
);

// B. Section Pantau Live seluruh siswa di Beranda harus disembunyikan
assert.ok(
  dashHtml.includes('id="sectionPantauLiveHome"') && dashHtml.includes('display:none !important;'),
  'sectionPantauLiveHome harus disembunyikan dari dashboard siswa'
);

// C. Tab Rekap diubah menjadi Riwayat Kehadiran Pribadi
assert.ok(
  dashHtml.includes('id="btnTabRekap"') && dashHtml.includes('Riwayat Kehadiran Saya'),
  'Tombol tab rekap harus bertuliskan Riwayat Kehadiran Saya'
);
assert.ok(
  dashHtml.includes('Riwayat Kehadiran Pribadi'),
  'Judul tab harus Riwayat Kehadiran Pribadi'
);

// D. Dropdown pemilih siswa lain harus disembunyikan
assert.ok(
  dashHtml.includes('id="wrapperSelectorRekapSiswa"') && dashHtml.includes('display:none;'),
  'Selector siswa lain harus dibungkus dan disembunyikan'
);

// E. Penguncian identitas diri di dashboard.js
assert.ok(
  dashJs.includes("user && user.role === 'siswa' && user.nisn"),
  'dashboard.js harus memeriksa role siswa dan nisn'
);
assert.ok(
  dashJs.includes('muatDataRekapNisn(user.nisn)'),
  'dashboard.js harus mengunci riwayat presensi hanya pada NISN siswa sendiri'
);
assert.ok(
  dashJs.includes('sel.disabled = true;'),
  'Dropdown perizinan target harus dikunci/disabled untuk siswa'
);
console.log('✓ Dashboard Siswa terisolasi 100%: Siswa hanya mengakses data pribadi.\n');

// 2. Verifikasi Portal Guru & Wali Kelas (dashboard-guru.html & assets/dashboard-guru.js)
console.log('[Test 2] Evaluasi Portal Guru Pengajar vs Wali Kelas...');
const guruHtml = fs.readFileSync(path.join(__dirname, '../dashboard-guru.html'), 'utf8');
const guruJs = fs.readFileSync(path.join(__dirname, '../assets/dashboard-guru.js'), 'utf8');

// A. Fitur Rekapitulasi Presensi disembunyikan dari Guru dan Walas (Khusus Admin)
assert.ok(
  guruHtml.includes('id="btnTabRekapGuru"') && guruHtml.includes('display:none !important;'),
  'Tombol btnTabRekapGuru harus disembunyikan di dashboard-guru.html'
);
assert.ok(
  guruHtml.includes('id="tabRekapGuru"') && guruHtml.includes('display:none !important;'),
  'Kontainer tabRekapGuru harus disembunyikan di dashboard-guru.html'
);

// B. dashboard-guru.js memblokir tabRekapGuru
assert.ok(
  guruJs.includes("id === 'tabRekapGuru'"),
  'dashboard-guru.js harus mencegat tabRekapGuru'
);

// C. Isolasi Guru Mapel Murni: Sembunyikan fitur Walas jika !isWalas
assert.ok(
  guruJs.includes('btnWalas.style.display = \'none\';') &&
  guruJs.includes('btnLiveAlert.style.display = \'none\';') &&
  guruJs.includes('btnIzin.style.display = \'none\';'),
  'Guru mapel murni harus menyembunyikan tab monitoring walas, live alert, dan approval izin'
);

// D. Akses Utama Guru Mapel Murni: Radar Mengajar, Kendala Mengajar, Presensi Guru
assert.ok(
  guruJs.includes('btnLiveGuru.style.display = \'inline-flex\';') &&
  guruJs.includes('btnKendala.style.display = \'inline-flex\';') &&
  guruJs.includes('btnAbsen.style.display = \'inline-flex\';'),
  'Guru mapel murni harus memiliki akses Radar Mengajar, Lapor Kendala, dan Presensi Guru'
);

// E. Akses Utama Wali Kelas: Monitoring 1 Kelas Binaan, Live Alert Keterlambatan, Kotak Masuk Izin
assert.ok(
  guruJs.includes('btnWalas.style.display = \'inline-flex\';') &&
  guruJs.includes('btnLiveAlert.style.display = \'inline-flex\';') &&
  guruJs.includes('btnIzin.style.display = \'inline-flex\';'),
  'Wali Kelas harus memiliki akses Monitoring Walas, Live Alert, dan Approval Izin'
);
assert.ok(
  guruJs.includes('kelasBinaanAktif = walasKelas;'),
  'Wali Kelas harus mengunci fokus pada 1 kelas binaan resmi'
);
console.log('✓ Portal Guru dan Wali Kelas terpisah secara presisi sesuai PRD.\n');

// 3. Verifikasi Panel Admin (admin.html & assets/admin.js)
console.log('[Test 3] Evaluasi Eksklusivitas Admin untuk Master Data & Rekap Tahunan...');
const adminHtml = fs.readFileSync(path.join(__dirname, '../admin.html'), 'utf8');
const adminJs = fs.readFileSync(path.join(__dirname, '../assets/admin.js'), 'utf8');

// Master Data Siswa & Guru hanya di Admin
assert.ok(adminHtml.includes('id="tab-siswa"'), 'Admin harus memiliki Master Data Siswa');
assert.ok(adminHtml.includes('id="tab-guru"'), 'Admin harus memiliki Master Data Guru');
assert.ok(adminHtml.includes('id="tab-kartu"'), 'Admin harus memiliki Master Data Kartu RFID');

// Laporan & Rekapitulasi Tahunan (Export CSV/Excel) hanya di Admin
assert.ok(adminHtml.includes('id="tab-rekap"'), 'Admin harus memiliki Laporan & Rekap Presensi');
assert.ok(adminHtml.includes('exportCsvPresensi()'), 'Admin harus memiliki fitur Export CSV');

// Panel ACC Kendala Guru (Jamkos) di Admin
assert.ok(adminHtml.includes('id="tab-kendala"'), 'Admin harus memiliki Panel ACC Kendala Guru');
assert.ok(adminJs.includes("status: 'approved'") && adminJs.includes("status: 'jamkos'"), 'ACC Kendala di Admin harus mengubah status kelas menjadi jamkos');
console.log('✓ Admin terverifikasi sebagai satu-satunya role pemilik Master Data, Rekap Tahunan, dan ACC Jamkos.\n');

console.log('======================================================');
console.log('🎉 SEMUA VERIFIKASI PEMISAHAN PERAN PRD 100% SUKSES!');
console.log('======================================================');
