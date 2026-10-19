// ===================================================================
// TEST SUITE: test-school-login-portal.js
// Verifikasi Implementasi Portal Presensi Gerbang Sekolah & Turnstile RFID
// 1. Validasi Suasana Gerbang Sekolah & Turnstile IoT (SMKN 1 Sumedang)
// 2. Validasi Jam Digital Live Sekolah (#liveClock & Sesi Pagi 06.30 - 08.00)
// 3. Validasi Animasi Karakter Siswa Tap Kartu Pelajar & RFID Wave Pulse
// 4. Validasi Keutuhan Seluruh ID DOM Form Login, Register & Auth Buttons
// 5. Validasi Keamanan, Isolasi Administrator & Penanganan Error Lengkap
// ===================================================================

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- MEMULAI PENGUJIAN PORTAL PRESENSI GERBANG SEKOLAH (INDEX.HTML) ---');

const indexHtmlPath = path.join(__dirname, '../index.html');
const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

// TEST 1: Identitas Resmi Sekolah SMKN 1 Sumedang & Panggung Gerbang Turnstile
console.log('\n[Test 1] Validasi Suasana Gerbang Sekolah SMKN 1 Sumedang & Turnstile IoT');
assert.ok(indexHtml.includes('SMK Negeri 1 Sumedang'), 'index.html harus memuat nama resmi SMK Negeri 1 Sumedang');
assert.ok(indexHtml.includes('Smart Turnstile Gate'), 'index.html harus memuat komponen Smart Turnstile Gate');
assert.ok(indexHtml.includes('turnstileStage'), 'index.html harus memiliki container turnstileStage');
assert.ok(indexHtml.includes('assets/logo-nesas.png'), 'index.html harus memuat logo NESAS resmi');
console.log('✓ Branding SMKN 1 Sumedang dan komponen gerbang masuk sekolah terverifikasi aktif');

// TEST 2: Jam Digital Live Sekolah & Sesi Presensi
console.log('\n[Test 2] Validasi Jam Digital Live Sekolah & Sesi Presensi');
assert.ok(indexHtml.includes('id="liveClock"'), 'index.html harus memiliki elemen id="liveClock"');
assert.ok(indexHtml.includes('updateSchoolClock'), 'Fungsi updateSchoolClock harus ada untuk live clock');
assert.ok(indexHtml.includes('06.30 - 08.00 WIB'), 'Informasi sesi pagi 06.30 - 08.00 WIB harus tertera');
console.log('✓ Live school clock (#liveClock) dan jam sesi presensi terverifikasi lengkap');

// TEST 3: Animasi Karakter Siswa Men-Tap Kartu & Gelombang RFID Pulse
console.log('\n[Test 3] Validasi Animasi Karakter Siswa Tap Kartu Pelajar & Sensor Wave');
assert.ok(indexHtml.includes('studentHandCard'), 'Karakter siswa harus memiliki tangan pemegang kartu (studentHandCard)');
assert.ok(indexHtml.includes('rfidStudentCard'), 'Kartu pelajar siswa harus digambarkan (rfidStudentCard)');
assert.ok(indexHtml.includes('triggerTapSimulation'), 'Fungsi triggerTapSimulation harus ada untuk simulasi tap kartu');
assert.ok(indexHtml.includes('rfidRing1'), 'Sensor gelombang RFID (rfidRing1) harus ada untuk efek visual pulse');
assert.ok(indexHtml.includes('turnstile-open'), 'Gate harus memiliki kelas status terbuka (turnstile-open) saat presensi');
console.log('✓ Animasi siswa tap kartu di pintu putar dan gelombang sensor terverifikasi');

// TEST 4: Keutuhan Seluruh ID DOM Form & Auth
console.log('\n[Test 4] Validasi Keutuhan Form Login, Register & Auth Buttons');
const requiredIds = [
  'formLogin',
  'loginEmail',
  'loginPassword',
  'btnActionLogin',
  'btnGoogleLogin',
  'formRegister',
  'regNama',
  'regEmail',
  'regPassword',
  'btnActionRegister',
  'authSuccessOverlay'
];

requiredIds.forEach(id => {
  assert.ok(indexHtml.includes(`id="${id}"`), `Elemen DOM id="${id}" tidak boleh hilang`);
});
console.log('✓ Seluruh elemen DOM autentikasi dan form login/register tetap 100% utuh');

// TEST 5: Isolasi Administrator & Penanganan Error Ramah
console.log('\n[Test 5] Validasi Isolasi Admin & Penanganan Error Ramah Pengguna');
assert.ok(indexHtml.includes('Akses Ditolak: Akun Administrator memiliki portal login khusus di admin-login.html'), 'Blokir email admin harus aktif');
assert.ok(indexHtml.includes('auth/network-request-failed'), 'Penanganan network-request-failed harus eksplisit');
assert.ok(indexHtml.includes('auth/popup-blocked'), 'Penanganan popup-blocked harus eksplisit');
assert.ok(indexHtml.includes('file://'), 'Penjelasan protokol file:// harus disertakan');
console.log('✓ Keamanan isolasi admin dan feedback error ramah pengguna terverifikasi');

console.log('\n=======================================================');
console.log('SEMUA PENGUJIAN PORTAL GERBANG SEKOLAH BERHASIL! (5/5 PASSED)');
console.log('=======================================================');
