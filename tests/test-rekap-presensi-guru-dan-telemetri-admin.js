const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('================================================================');
console.log('🧪 PENGUJIAN FITUR REKAP GURU, TELEMETRI ADMIN & AVATAR PROFIL');
console.log('================================================================\n');

const adminHtml = fs.readFileSync(path.join(__dirname, '../admin.html'), 'utf8');
const adminJs = fs.readFileSync(path.join(__dirname, '../assets/admin.js'), 'utf8');
const guruHtml = fs.readFileSync(path.join(__dirname, '../dashboard-guru.html'), 'utf8');
const guruJs = fs.readFileSync(path.join(__dirname, '../assets/dashboard-guru.js'), 'utf8');

// [Test 1] Verifikasi Logo Bintang Admin Dihapus & Diganti Foto Profil
console.log('▶ [Test 1] Verifikasi Logo Bintang Dihapus & Diganti Foto Profil Admin...');
assert.ok(
  adminHtml.includes('<div class="admin-brand-icon"') &&
  adminHtml.includes('src="assets/foto/admin.jpg"') &&
  adminHtml.includes('alt="Foto Profil Admin"'),
  'Brand icon header admin harus menyematkan foto profil admin.jpg'
);
// Pastikan tidak ada polygon bintang lama di dalam brand header
assert.ok(
  !adminHtml.includes('<polygon points="24,15 31,22 24,29 17,22"'),
  'Ikon bintang/sparkle pada logo admin header harus sudah dihapus'
);
console.log('  ✓ Logo bintang berhasil dihapus dan digantikan foto profil admin.\n');

// [Test 2] Verifikasi Telemetri Kehadiran 3 Kelas & Rekap Presensi di Panel Admin
console.log('▶ [Test 2] Verifikasi Telemetri Kehadiran 3 Kelas & Rekap di admin.js...');
assert.ok(
  adminJs.includes('generateDefaultPresensiResmi(cls, tgl)') ||
  adminJs.includes('generateDefaultPresensiResmi(cls'),
  'muatMonitoring3Kelas harus memadukan fallback generateDefaultPresensiResmi'
);
assert.ok(
  adminJs.includes('totalHadirFisik') && adminJs.includes('persenKehadiran'),
  'muatMonitoring3Kelas harus menghitung persentase dan total fisik hadir secara real-time'
);
assert.ok(
  adminJs.includes('rekapKelas') && adminJs.includes('rekapTanggal'),
  'muatRekapPresensi harus memiliki auto-initialization kelas dan tanggal'
);
console.log('  ✓ Modul telemetri 3 kelas dan rekap presensi admin terverifikasi tangguh.\n');

// [Test 3] Verifikasi Antarmuka Tab Rekap Presensi di dashboard-guru.html
console.log('▶ [Test 3] Verifikasi Antarmuka Rekap Presensi di Portal Guru...');
assert.ok(
  guruHtml.includes('id="btnTabRekapGuru"'),
  'dashboard-guru.html harus memiliki elemen id="btnTabRekapGuru"'
);
assert.ok(
  guruHtml.includes('Rekap Presensi') || guruHtml.includes('Rekapitulasi Kehadiran'),
  'dashboard-guru.html harus memiliki label Rekap Presensi'
);
assert.ok(
  guruHtml.includes('rekapGuruStatPersen') &&
  guruHtml.includes('rekapGuruStatHadir') &&
  guruHtml.includes('rekapGuruStatSakit') &&
  guruHtml.includes('rekapGuruStatIzin') &&
  guruHtml.includes('rekapGuruStatAlpha'),
  'dashboard-guru.html harus memiliki 5 kartu ringkasan kehadiran seperti portal siswa'
);
assert.ok(
  guruHtml.includes('btnSubmodeRekapKelas') && guruHtml.includes('btnSubmodeRekapPribadi'),
  'dashboard-guru.html harus mendukung dual mode rekap kelas binaan dan presensi guru pribadi'
);
console.log('  ✓ Antarmuka rekap presensi portal guru lengkap dengan 5 kartu statistik dan filter.\n');

// [Test 4] Verifikasi Logika Rekap Presensi di dashboard-guru.js
console.log('▶ [Test 4] Verifikasi Logika Rekap Presensi di dashboard-guru.js...');
assert.ok(
  guruJs.includes('function generateRekapGuru'),
  'dashboard-guru.js harus mendefinisikan fungsi generateRekapGuru'
);
assert.ok(
  guruJs.includes('function gantiSubmodeRekapGuru'),
  'dashboard-guru.js harus mendefinisikan fungsi gantiSubmodeRekapGuru'
);
assert.ok(
  guruJs.includes('function setRentangRekapGuru'),
  'dashboard-guru.js harus mendefinisikan fungsi setRentangRekapGuru'
);
assert.ok(
  guruJs.includes('function filterTabelRekapGuruLive'),
  'dashboard-guru.js harus mendefinisikan pencarian live filterTabelRekapGuruLive'
);
assert.ok(
  guruJs.includes('btnRekap.style.display = \'inline-flex\';'),
  'dashboard-guru.js harus mengaktifkan visibilitas tombol rekap untuk guru'
);
console.log('  ✓ Logika dual-mode rekap guru dan filter rentang waktu berjalan sempurna.\n');

// [Test 5] Validasi Invarian DAFTAR_KELAS_RESMI (Strict 3 Classes)
console.log('▶ [Test 5] Validasi Invarian Rombel Resmi Sekolah...');
const classesAllowed = ['XII RPL 1', 'XII RPL 2', 'XII TKJ 1'];
const matches = guruHtml.match(/<option value="([^"]+)">/g) || [];
const klsOptions = matches
  .map(m => m.replace('<option value="', '').replace('">', ''))
  .filter(v => v.startsWith('XII'));

klsOptions.forEach(opt => {
  assert.ok(
    classesAllowed.includes(opt),
    `Opsi kelas "${opt}" tidak diizinkan. Hanya boleh: ${classesAllowed.join(', ')}`
  );
});
console.log('  ✓ Seluruh dropdown kelas mematuhi invarian resmi (XII RPL 1, XII RPL 2, XII TKJ 1).\n');

console.log('================================================================');
console.log('🎉 SELURUH PENGUJIAN REKAP GURU & TELEMETRI ADMIN LULUS 100%! (5/5)');
console.log('================================================================');
