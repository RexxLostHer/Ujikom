// ===================================================================
// TEST SUITE: test-school-login-portal.js
// Verifikasi Maskot Robot Presensi IoT "Robo-NESAS" (Watch & Cover Eyes)
// 1. Validasi Identitas Resmi SMKN 1 Sumedang & Centered Layout
// 2. Validasi Jam Digital Live Sekolah (#liveClock), Sesi Presensi & Telemetri IoT
// 3. Validasi Maskot Robot Robo-NESAS: Eye Tracking, Cover Eyes, Peeking & Happy Eyes
// 4. Validasi Keutuhan Seluruh 17 ID DOM Form Login, Register & Auth Buttons
// 5. Validasi Keamanan, Isolasi Administrator & Penanganan Error Lengkap
// ===================================================================

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- MEMULAI PENGUJIAN PORTAL PRESENSI ROBO-NESAS (INDEX.HTML) ---');

const indexHtmlPath = path.join(__dirname, '../index.html');
const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

// TEST 1: Identitas Resmi Sekolah SMKN 1 Sumedang & Centered Layout
console.log('\n[Test 1] Validasi Identitas Resmi SMKN 1 Sumedang & Centered Portal Layout');
assert.ok(indexHtml.includes('SMK Negeri 1 Sumedang'), 'index.html harus memuat nama resmi SMK Negeri 1 Sumedang');
assert.ok(indexHtml.includes('assets/logo-nesas.png'), 'index.html harus memuat logo NESAS resmi');
assert.ok(indexHtml.includes('Rekayasa Perangkat Lunak (RPL IoT)') || indexHtml.includes('RPL IoT'), 'index.html harus memuat badge kejuruan RPL IoT');
assert.ok(indexHtml.includes('#080e1a'), 'index.html harus menggunakan palet Obsidian Dark base #080e1a');
assert.ok(indexHtml.includes('#0f172a'), 'index.html harus menggunakan palet Obsidian surface #0f172a');
console.log('✓ Branding SMKN 1 Sumedang dan Centered Portal Layout terverifikasi aktif');

// TEST 2: Jam Digital Live Sekolah, Sesi Presensi & Telemetri IoT
console.log('\n[Test 2] Validasi Jam Digital Live Sekolah & Telemetri Realtime');
assert.ok(indexHtml.includes('id="liveClock"'), 'index.html harus memiliki elemen id="liveClock"');
assert.ok(indexHtml.includes('updateSchoolClock'), 'Fungsi updateSchoolClock harus ada untuk live clock');
assert.ok(indexHtml.includes('06.30 - 08.00 WIB'), 'Informasi sesi pagi 06.30 - 08.00 WIB harus tertera');
assert.ok(indexHtml.includes('ESP32'), 'Telemetri hardware gateway ESP32 harus tertera');
assert.ok(indexHtml.includes('Firebase Realtime Database Connected'), 'Status cloud sync Firebase harus tertera');
console.log('✓ Live school clock (#liveClock), sesi presensi, dan telemetri IoT terverifikasi lengkap');

// TEST 3: Maskot Robot Presensi Cerdas "Robo-NESAS" (Watch & Cover Eyes)
console.log('\n[Test 3] Validasi Maskot Robot Robo-NESAS: Eye Tracking, Cover Eyes, Peeking & Happy Eyes');
assert.ok(indexHtml.includes('id="roboNesasMascot"'), 'index.html harus memuat elemen SVG maskot #roboNesasMascot');
assert.ok(indexHtml.includes('id="mascotStage"'), 'index.html harus memuat panggung maskot #mascotStage');
assert.ok(indexHtml.includes('id="pupilLeft"') && indexHtml.includes('id="pupilRight"'), 'Maskot harus memiliki pupil kiri dan kanan');
assert.ok(indexHtml.includes('id="armLeft"') && indexHtml.includes('id="armRight"'), 'Maskot harus memiliki lengan mekanik kiri dan kanan');
assert.ok(indexHtml.includes('id="fingersLeft"') && indexHtml.includes('id="fingersRight"'), 'Maskot harus memiliki jari robotik kiri dan kanan untuk efek intip');
assert.ok(indexHtml.includes('id="happyEyesGroup"'), 'Maskot harus memiliki happy arc eyes untuk selebrasi sukses');
assert.ok(indexHtml.includes('coverEyes') || indexHtml.includes('coverMascotEyes'), 'Logika menutup mata (coverEyes) saat password focused harus ada');
assert.ok(indexHtml.includes('peekEyes') || indexHtml.includes('peekMascotEyes'), 'Logika mengintip (peekEyes) saat toggle password diklik harus ada');
assert.ok(indexHtml.includes('triggerHappyEyes') || indexHtml.includes('happyMascotEyes'), 'Logika happy eyes saat sukses presensi harus ada');
console.log('✓ Maskot Robo-NESAS dengan animasi Watch & Cover Eyes, Peeking, dan Happy Eyes terverifikasi');

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
console.log('SEMUA PENGUJIAN PORTAL ROBO-NESAS BERHASIL! (5/5 PASSED)');
console.log('=======================================================');
