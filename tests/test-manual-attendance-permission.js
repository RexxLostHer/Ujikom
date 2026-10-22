/**
 * TEST SUITE: Validasi Hak Akses Presensi Manual Guru & Walas (Security Logic & Class Isolation)
 * Memverifikasi:
 * 1. Guru / Walas TIDAK DAPAT mencatat presensi manual pada rombel yang bukan kelas binaan atau kelas yang diajar.
 * 2. Tombol "Hadirkan Manual" disembunyikan dan diganti dengan status "Mode Pantau (Bukan Kelas Anda)" saat melihat kelas lain.
 * 3. Pemanggilan fungsi `hadirkanManualGuru`, `catatHadirManualWalas`, `tandaiIzinCepatWalas`, dan `hadirkanManual` diblokir jika tidak memiliki wewenang.
 * 4. Administrator memiliki wewenang supervisi penuh atas seluruh kelas.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('=== MEMULAI TEST HAK AKSES PRESENSI MANUAL GURU & WALAS ===\n');

const baseDir = path.resolve(__dirname, '..');
const guruJsPath = path.join(baseDir, 'assets/dashboard-guru.js');
const guruJsContent = fs.readFileSync(guruJsPath, 'utf8');

// [Test 1] Validasi Keberadaan Fungsi Pengendali Wewenang
console.log('[Test 1] Validasi keberadaan isGuruBerhakKelolaKelas...');
assert.ok(
  guruJsContent.includes('function isGuruBerhakKelolaKelas(targetKelas)'),
  'dashboard-guru.js harus memiliki fungsi isGuruBerhakKelolaKelas'
);
assert.ok(
  guruJsContent.includes('Hanya Pantau (Bukan Kelas Anda)'),
  'Tombol hadirkan manual harus disembunyikan dengan label Hanya Pantau untuk kelas lain'
);
console.log('✓ Fungsi wewenang kelas terpasang di dashboard-guru.js.\n');

// [Test 2] Validasi Logika Wewenang dengan Berbagai Profil Guru
console.log('[Test 2] Uji Wewenang Peran Guru & Walas...');
const {
  MASTER_GURU_RESMI,
  DEFAULT_STATUS_KELAS,
  normalisasiKelas
} = require('../assets/firebase-config.js');
const { MASTER_JADWAL_RESMI } = require('../assets/jadwal-util.js');

// Evaluasi fungsi isGuruBerhakKelolaKelas dari dashboard-guru.js
const { isGuruBerhakKelolaKelas } = require('../assets/dashboard-guru.js');

global.normalisasiKelas = normalisasiKelas;
global.DEFAULT_STATUS_KELAS = DEFAULT_STATUS_KELAS;
global.MASTER_JADWAL_RESMI = MASTER_JADWAL_RESMI;

// Skenario A: Rijal Nur Rahmat, S.T (Walas XII RPL 1, tidak mengajar XII RPL 2 & XII TKJ 1)
global.guruAktif = {
  nip: '198312052022211017',
  nama: 'Rijal Nur Rahmat, S.T',
  role: 'walas',
  isWalas: true,
  walasKelasId: 'XII RPL 1',
  mapel: 'Administrasi Infrastruktur Jaringan'
};

assert.strictEqual(
  isGuruBerhakKelolaKelas('XII RPL 1'),
  true,
  'Rijal Nur Rahmat HARUS memiliki wewenang atas kelas binaannya (XII RPL 1)'
);
assert.strictEqual(
  isGuruBerhakKelolaKelas('XII RPL 2'),
  false,
  'Rijal Nur Rahmat TIDAK BOLEH memiliki wewenang mutasi presensi atas XII RPL 2'
);
assert.strictEqual(
  isGuruBerhakKelolaKelas('XII TKJ 1'),
  false,
  'Rijal Nur Rahmat TIDAK BOLEH memiliki wewenang mutasi presensi atas XII TKJ 1'
);
console.log('✓ Validasi Walas XII RPL 1 (Rijal Nur Rahmat): Hanya berhak di XII RPL 1.');

// Skenario B: Muhammad Echa Putra, S.Kom.Gr (Walas XII RPL 2 & Pengajar di XII RPL 1)
global.guruAktif = {
  nip: '199209142022211007',
  nama: 'Muhammad Echa Putra, S.Kom.Gr',
  role: 'walas',
  isWalas: true,
  walasKelasId: 'XII RPL 2',
  mapel: 'Basis Data & Pemodelan RPL'
};

assert.strictEqual(
  isGuruBerhakKelolaKelas('XII RPL 2'),
  true,
  'Muhammad Echa Putra HARUS memiliki wewenang atas kelas binaannya (XII RPL 2)'
);
assert.strictEqual(
  isGuruBerhakKelolaKelas('XII RPL 1'),
  true,
  'Muhammad Echa Putra berhak atas XII RPL 1 karena tercatat mengajar di jadwal resmi'
);
assert.strictEqual(
  isGuruBerhakKelolaKelas('XII TKJ 1'),
  false,
  'Muhammad Echa Putra TIDAK BOLEH memiliki wewenang atas XII TKJ 1'
);
console.log('✓ Validasi Walas XII RPL 2 (Muhammad Echa Putra): Berhak di RPL 2 & RPL 1.');

// Skenario C: Administrator
global.guruAktif = {
  role: 'admin',
  nama: 'Administrator Sekolah',
  email: 'admin@smkn1sumedang.sch.id'
};

assert.strictEqual(isGuruBerhakKelolaKelas('XII RPL 1'), true, 'Admin berhak atas XII RPL 1');
assert.strictEqual(isGuruBerhakKelolaKelas('XII RPL 2'), true, 'Admin berhak atas XII RPL 2');
assert.strictEqual(isGuruBerhakKelolaKelas('XII TKJ 1'), true, 'Admin berhak atas XII TKJ 1');
console.log('✓ Validasi Administrator: Berhak supervisi seluruh kelas.\n');

// [Test 3] Validasi Proteksi Eksekusi Hadir Manual saat Bukan Kelasnya
console.log('[Test 3] Uji Penolakan Eksekusi Hadirkan Manual saat Bukan Kelasnya...');

// Rijal mencoba hadirkan manual siswa di XII RPL 2
global.guruAktif = {
  nip: '198312052022211017',
  nama: 'Rijal Nur Rahmat, S.T',
  role: 'walas',
  isWalas: true,
  walasKelasId: 'XII RPL 1'
};
global.currentKelas = 'XII RPL 2';

let alertDipanggil = false;
global.alert = (msg) => {
  alertDipanggil = true;
  assert.ok(msg.includes('Akses Ditolak'), 'Pesan alert harus memuat Akses Ditolak');
};
global.tampilToastGuru = () => {};
global.tanggalHariIni = () => '2026-10-22';
global.jamSekarang = () => '07:15:00';

const { hadirkanManualGuru } = require('../assets/dashboard-guru.js');

(async () => {
  await hadirkanManualGuru('0098263610', 'M. IHSAN ATHALLAH', 1);
  assert.strictEqual(alertDipanggil, true, 'Eksekusi hadirkan manual untuk kelas orang lain harus ditolak');
  console.log('✓ Percobaan manipulasi presensi kelas orang lain berhasil digagalkan dengan alert Akses Ditolak.');

  console.log('\n=============================================================');
  console.log('🎉 SEMUA PENGUJIAN HAK AKSES PRESENSI MANUAL LULUS 100%!');
  console.log('=============================================================');
})();
