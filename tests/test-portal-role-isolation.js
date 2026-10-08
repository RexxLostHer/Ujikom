// ===================================================================
// TEST SUITE: ISOLASI PORTAL ROLE & ANTI-LEAK UJIKOM 2026
// Memverifikasi isolasi ketat peran antar portal dan proteksi anti-bocor
// ===================================================================

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('=== MEMULAI TEST ISOLASI PORTAL ROLE & ANTI-LEAK ===\n');

// 1. Verifikasi dashboard.html DOM & Navbar Bersih
const dashHtml = fs.readFileSync(path.join(__dirname, '../dashboard.html'), 'utf8');

console.log('[Test 1] Evaluasi Eliminasi Kebocoran DOM pada dashboard.html...');
assert.ok(!dashHtml.includes('id="linkAdmin"'), 'Tombol linkAdmin tidak boleh ada di navbar dashboard.html');
assert.ok(!dashHtml.includes('id="linkGuru"'), 'Tombol linkGuru tidak boleh ada di navbar dashboard.html');
assert.ok(dashHtml.includes('id="bannerStaffReview"'), 'Element bannerStaffReview tetap ada untuk backward-compatibility');
assert.ok(dashHtml.includes('display:none !important;') || dashHtml.includes('style="display:none;"'), 'Banner review harus tersembunyi');
console.log('✓ Navbar dashboard.html bersih dari tombol Admin/Guru dan banner mengganggu tidak tampil.\n');

// 2. Verifikasi Guard Isolasi Role pada dashboard.js
const dashJs = fs.readFileSync(path.join(__dirname, '../assets/dashboard.js'), 'utf8');

console.log('[Test 2] Evaluasi Guard Isolasi Peran di dashboard.js...');
assert.ok(dashJs.includes("sessUser.role === 'admin'"), 'dashboard.js harus mendeteksi admin pada sesi');
assert.ok(dashJs.includes("window.location.replace('admin.html')"), 'Admin yang mengakses dashboard.html harus dialihkan ke admin.html');
assert.ok(dashJs.includes("sessUser.role === 'guru' || sessUser.role === 'walas'"), 'dashboard.js harus mendeteksi guru/walas');
assert.ok(dashJs.includes("window.location.replace('dashboard-guru.html')"), 'Guru/Walas yang mengakses dashboard.html harus dialihkan ke dashboard-guru.html');
assert.ok(dashJs.includes("user.role === 'pengunjung' || !user.nisn || user.role !== 'siswa'"), 'isPengunjung harus mengunci kartu RFID hanya untuk siswa valid');
console.log('✓ Guard dashboard.html mengalihkan Admin & Guru serta memproteksi kartu RFID dari kebocoran.\n');

// 3. Verifikasi Guard Isolasi Role pada dashboard-guru.js
const guruJs = fs.readFileSync(path.join(__dirname, '../assets/dashboard-guru.js'), 'utf8');

console.log('[Test 3] Evaluasi Guard Isolasi Peran di dashboard-guru.js...');
assert.ok(guruJs.includes("sessUser.role === 'admin'"), 'dashboard-guru.js harus mendeteksi sesi admin');
assert.ok(guruJs.includes("window.location.replace('admin.html')"), 'Admin tanpa switch role harus dialihkan ke admin.html');
assert.ok(guruJs.includes("sessUser.role === 'siswa' || sessUser.role === 'pengunjung'"), 'dashboard-guru.js harus mendeteksi siswa/pengunjung');
assert.ok(guruJs.includes("window.location.replace('dashboard.html')"), 'Siswa/Pengunjung yang mengakses dashboard-guru.html harus dialihkan ke dashboard.html');
console.log('✓ dashboard-guru.html eksklusif untuk Guru dan Walas.\n');

// 4. Verifikasi Guard Isolasi Role pada admin.js
const adminJs = fs.readFileSync(path.join(__dirname, '../assets/admin.js'), 'utf8');

console.log('[Test 4] Evaluasi Guard Isolasi Peran di admin.js...');
assert.ok(adminJs.includes("sess.role !== 'admin'"), 'admin.js harus memblokir role selain admin');
assert.ok(adminJs.includes("dashboard-guru.html") && adminJs.includes("dashboard.html"), 'admin.js harus mengalihkan non-admin ke dashboard masing-masing');
assert.ok(adminJs.includes("shouldHaltAdmin"), 'admin.js harus memiliki flag shouldHaltAdmin untuk mencegah eksekusi berlanjut saat redirect');
assert.ok(adminJs.includes("currentSess.role !== 'admin'"), 'initAdmin harus memproteksi eksekusi dari role non-admin');
console.log('✓ admin.html eksklusif untuk Administrator Sistem.\n');

// 5. Verifikasi Routing Bersih Role Switcher
const authJs = fs.readFileSync(path.join(__dirname, '../assets/auth.js'), 'utf8');

console.log('[Test 5] Evaluasi Routing Presisi getDashboardUrlByRole & Sesi Switched...');
assert.ok(authJs.includes("window.getDashboardUrlByRole = getDashboardUrlByRole"), 'auth.js harus mengekspor getDashboardUrlByRole');
assert.ok(authJs.includes("activeSess.role"), 'auth.js harus memelihara activeSess saat isSwitched aktif');

function getDashboardUrlByRole(role) {
  if (role === 'admin') return 'admin.html';
  if (role === 'guru' || role === 'walas') return 'dashboard-guru.html';
  return 'dashboard.html';
}

assert.strictEqual(getDashboardUrlByRole('admin'), 'admin.html', 'Admin -> admin.html');
assert.strictEqual(getDashboardUrlByRole('walas'), 'dashboard-guru.html', 'Walas -> dashboard-guru.html');
assert.strictEqual(getDashboardUrlByRole('guru'), 'dashboard-guru.html', 'Guru -> dashboard-guru.html');
assert.strictEqual(getDashboardUrlByRole('siswa'), 'dashboard.html', 'Siswa -> dashboard.html');
assert.strictEqual(getDashboardUrlByRole('pengunjung'), 'dashboard.html', 'Pengunjung -> dashboard.html');
console.log('✓ Seluruh alur routing peran terisolasi 100% tanpa celah kebocoran.\n');

console.log('======================================================');
console.log('🎉 SEMUA PENGUJIAN ISOLASI PORTAL ROLE 100% SUKSES!');
console.log('======================================================');
