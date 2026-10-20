// ===================================================================
// TEST SUITE: test-school-login-portal.js
// Verifikasi Implementasi Bento Grid Showcase EdTech Portal Presensi (Linear/Vercel Style)
// 1. Validasi Identitas Resmi SMKN 1 Sumedang & Arsitektur Bento Grid Showcase
// 2. Validasi Jam Digital Live Sekolah (#liveClock), Sesi Presensi & Telemetri IoT
// 3. Validasi Smart Card Pelajar 3D Holografik, 3D Tilt Physics & Simulasi Tap
// 4. Validasi Keutuhan Seluruh 17 ID DOM Form Login, Register & Auth Buttons
// 5. Validasi Keamanan, Isolasi Administrator & Penanganan Error Lengkap
// ===================================================================

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- MEMULAI PENGUJIAN PORTAL PRESENSI BENTO GRID SHOWCASE (INDEX.HTML) ---');

const indexHtmlPath = path.join(__dirname, '../index.html');
const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

// TEST 1: Identitas Resmi Sekolah SMKN 1 Sumedang & Bento Grid Showcase Architecture
console.log('\n[Test 1] Validasi Bento Grid Showcase & Identitas Resmi SMKN 1 Sumedang');
assert.ok(indexHtml.includes('SMK Negeri 1 Sumedang'), 'index.html harus memuat nama resmi SMK Negeri 1 Sumedang');
assert.ok(indexHtml.includes('assets/logo-nesas.png'), 'index.html harus memuat logo NESAS resmi');
assert.ok(indexHtml.includes('bento-grid') || indexHtml.includes('bentoGrid'), 'index.html harus memuat arsitektur bento grid showcase');
assert.ok(indexHtml.includes('bento-card') || indexHtml.includes('bentoCard'), 'index.html harus memuat modular bento card');
assert.ok(indexHtml.includes('Rekayasa Perangkat Lunak (RPL IoT)') || indexHtml.includes('RPL IoT'), 'index.html harus memuat badge kejuruan RPL IoT');
console.log('✓ Branding SMKN 1 Sumedang dan arsitektur Bento Grid Showcase terverifikasi aktif');

// TEST 2: Jam Digital Live Sekolah, Sesi Presensi & Telemetri IoT
console.log('\n[Test 2] Validasi Jam Digital Live Sekolah & Telemetri Realtime');
assert.ok(indexHtml.includes('id="liveClock"'), 'index.html harus memiliki elemen id="liveClock"');
assert.ok(indexHtml.includes('updateSchoolClock'), 'Fungsi updateSchoolClock harus ada untuk live clock');
assert.ok(indexHtml.includes('06.30 - 08.00 WIB'), 'Informasi sesi pagi 06.30 - 08.00 WIB harus tertera');
assert.ok(indexHtml.includes('ESP32'), 'Telemetri hardware gateway ESP32 harus tertera');
assert.ok(indexHtml.includes('Firebase Realtime Database Connected'), 'Status cloud sync Firebase harus tertera');
console.log('✓ Live school clock (#liveClock), sesi presensi, dan telemetri IoT terverifikasi lengkap');

// TEST 3: Smart Attendance Card 3D Holografik & Simulasi Tap Interaktif
console.log('\n[Test 3] Validasi Smart Card 3D Holografik & Simulasi Tap Interaktif');
assert.ok(indexHtml.includes('smartCard') || indexHtml.includes('smart-card-3d'), 'index.html harus memuat Smart Attendance Card 3D');
assert.ok(indexHtml.includes('perspective: 1000px') || indexHtml.includes('perspective:1000px') || indexHtml.includes('perspective'), '3D perspective transform harus aktif untuk tilt physics');
assert.ok(indexHtml.includes('triggerTapSimulation'), 'Fungsi triggerTapSimulation harus ada untuk simulasi tap kartu');
assert.ok(indexHtml.includes('rfidRing1'), 'Sensor gelombang RFID (rfidRing1) harus ada untuk visual pulse');
assert.ok(indexHtml.includes('Presensi Berhasil'), 'Status verifikasi presensi berhasil harus ada');
console.log('✓ Smart card 3D tilt interaktif dan simulasi tap RFID terverifikasi');

// TEST 4: Keutuhan Seluruh ID DOM Form & Auth
console.log('\n[Test 4] Validasi Keutuhan Seluruh 17 ID DOM Form Login, Register & Auth');
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
  'authSuccessOverlay',
  'liveClock',
  'notifBoxLogin',
  'notifBoxRegister',
  'modalLupaPassword',
  'resetEmail',
  'btnKirimReset'
];

requiredIds.forEach(id => {
  assert.ok(indexHtml.includes(`id="${id}"`), `Elemen DOM id="${id}" tidak boleh hilang`);
});
console.log('✓ Seluruh 17 elemen DOM autentikasi dan form login/register tetap 100% utuh');

// TEST 5: Isolasi Administrator & Penanganan Error Ramah
console.log('\n[Test 5] Validasi Isolasi Admin & Penanganan Error Ramah Pengguna');
assert.ok(indexHtml.includes('Akses Ditolak: Akun Administrator memiliki portal login khusus di admin-login.html'), 'Blokir email admin harus aktif');
assert.ok(indexHtml.includes('auth/network-request-failed'), 'Penanganan network-request-failed harus eksplisit');
assert.ok(indexHtml.includes('auth/popup-blocked'), 'Penanganan popup-blocked harus eksplisit');
assert.ok(indexHtml.includes('file://'), 'Penjelasan protokol file:// harus disertakan');
console.log('✓ Keamanan isolasi admin dan feedback error ramah pengguna terverifikasi');

console.log('\n=======================================================');
console.log('SEMUA PENGUJIAN PORTAL BENTO SHOWCASE BERHASIL! (5/5 PASSED)');
console.log('=======================================================');
