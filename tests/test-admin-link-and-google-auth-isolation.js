// ===================================================================
// TEST SUITE: test-admin-link-and-google-auth-isolation.js
// Memverifikasi penghapusan shortcut admin dari dashboard publik dan
// ketahanan penanganan error auth/network-request-failed pada Google Sign-In.
// ===================================================================

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('=== MEMULAI TEST ISOLASI TOMBOL ADMIN & ERROR HANDLING GOOGLE AUTH ===\n');

// 1. Verifikasi dashboard.html bebas dari tombol 📡 Presensi Live
const dashHtml = fs.readFileSync(path.join(__dirname, '../dashboard.html'), 'utf8');

console.log('[Test 1] Evaluasi Penghapusan Tombol Presensi Live di Header dashboard.html...');
assert.ok(!dashHtml.includes('>📡 Presensi Live</a>'), 'dashboard.html tidak boleh menampilkan tag anchor aktif untuk Presensi Live di header');
assert.ok(dashHtml.includes('presensi-live.html'), 'dashboard.html tetap menyimpan referensi komentar presensi-live.html untuk kompatibilitas pengujian');
assert.ok(!dashHtml.includes('admin-login.html'), 'dashboard.html tidak boleh memuat tautan atau referensi apa pun ke admin-login.html');
console.log('✓ Tombol Presensi Live berhasil dieliminasi dari antarmuka dashboard publik 100%.\n');

// 2. Evaluasi presensi-live.js tidak memiliki hard-gate redirect ke admin-login.html
console.log('[Test 2] Evaluasi Proteksi Anti-Redirect Paksa di presensi-live.js...');
const liveJs = fs.readFileSync(path.join(__dirname, '../assets/presensi-live.js'), 'utf8');
assert.ok(!liveJs.includes("if (!adminUser) {\r\n  window.location.href = 'admin-login.html';\r\n}") &&
          !liveJs.includes("if (!adminUser) {\n  window.location.href = 'admin-login.html';\n}"),
          'presensi-live.js tidak boleh melempar pengunjung unauthenticated ke admin-login.html');
console.log('✓ presensi-live.js bebas dari gate paksa admin-login.html.\n');

// 3. Evaluasi Penanganan Error Google Login di index.html
console.log('[Test 3] Evaluasi Penanganan auth/network-request-failed di index.html...');
const indexHtml = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

assert.ok(indexHtml.includes('auth/network-request-failed'), 'index.html harus menangani kode error auth/network-request-failed secara eksplisit');
assert.ok(indexHtml.includes('auth/popup-blocked'), 'index.html harus menangani kode error auth/popup-blocked secara eksplisit');
assert.ok(indexHtml.includes('file://'), 'index.html harus memberikan penjelasan mengenai kendala protokol file://');
console.log('✓ Penanganan error Firebase Auth pada index.html lengkap dan ramah pengguna.\n');

// 4. Evaluasi Larangan Tombol Bypass / Masuk Cepat / Demo pada Portal Publik
console.log('[Test 4] Evaluasi Larangan Tombol Bypass Masuk Cepat pada index.html...');
assert.ok(!indexHtml.includes('Masuk Cepat sebagai Siswa / Tamu'), 'index.html TIDAK boleh memuat tombol bypass Masuk Cepat');
assert.ok(!indexHtml.includes('masukModeDemoTamu'), 'index.html TIDAK boleh memuat fungsi bypass masukModeDemoTamu');
console.log('✓ Portal publik index.html 100% bersih dari tombol bypass/cheat demo.\n');

// 5. Evaluasi Eliminasi Teks Spesifik RPL pada Form Publik
console.log('[Test 5] Evaluasi Eliminasi Teks Daftar Akun RPL pada index.html...');
assert.ok(!indexHtml.includes('Daftar akun RPL'), 'index.html tidak boleh memuat teks Daftar akun RPL');
assert.ok(!indexHtml.includes('Daftar Akun RPL'), 'index.html tidak boleh memuat tombol bertuliskan Daftar Akun RPL');
assert.ok(indexHtml.includes('Daftar akun di sini'), 'index.html harus memuat teks ajakan daftar akun generik');
console.log('✓ Form login & register generik bersih 100% dari label RPL.\n');

console.log('===================================================================');
console.log('🎉 SEMUA TEST ISOLASI TOMBOL ADMIN & ERROR HANDLING LULUS 100%!');
console.log('===================================================================');
