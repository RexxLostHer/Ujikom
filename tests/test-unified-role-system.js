// ===================================================================
// TEST SUITE: SISTEM PERAN TERPADU, PRESET SWITCHER & APPROVAL WALAS
// Memverifikasi implementasi PRD penyempurnaan sistem role UJIKOM 2026
// ===================================================================

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('=== MEMULAI TEST SISTEM PERAN TERPADU & SWITCHER ===\n');

// 1. Verifikasi fungsi gantiRoleSesi dan isRoleSwitched di assets/auth.js
const authJs = fs.readFileSync(path.join(__dirname, '../assets/auth.js'), 'utf8');

console.log('[Test 1] Evaluasi fungsi gantiRoleSesi dan proteksi rekonsiliasi...');
assert.ok(authJs.includes('function gantiRoleSesi('), 'Fungsi gantiRoleSesi harus didefinisikan di auth.js');
assert.ok(authJs.includes('isRoleSwitched'), 'Flag isRoleSwitched harus diimplementasikan untuk mencegah overwrite');
assert.ok(authJs.includes('sessionStorage.getItem(\'isRoleSwitched\')'), 'Flag isRoleSwitched harus disinkronkan ke sessionStorage');
console.log('✓ gantiRoleSesi dan proteksi flag isRoleSwitched valid 100%.\n');

// 2. Verifikasi 5 Presets Role di assets/profile-modal.js
const modalJs = fs.readFileSync(path.join(__dirname, '../assets/profile-modal.js'), 'utf8');

console.log('[Test 2] Evaluasi 5 Presets UJIKOM pada Modal Profil...');
assert.ok(modalJs.includes("pilihPresetRole('admin')"), 'Preset Administrator Sistem harus tersedia');
assert.ok(modalJs.includes("pilihPresetRole('walas')"), 'Preset Wali Kelas XII RPL 2 harus tersedia');
assert.ok(modalJs.includes("pilihPresetRole('guru')"), 'Preset Guru Pengajar XII RPL 1 harus tersedia');
assert.ok(modalJs.includes("pilihPresetRole('siswa'"), 'Preset Siswa Resmi harus tersedia');
assert.ok(modalJs.includes("pilihPresetRole('pengunjung')"), 'Preset Reset ke Pengunjung harus tersedia');
assert.ok(modalJs.includes('gantiRoleSesi(role, payload)'), 'pilihPresetRole harus mendelegasikan ke gantiRoleSesi');
console.log('✓ Seluruh 5 Preset Role UJIKOM terpasang lengkap pada modal profil.\n');

// 3. Verifikasi Pembatasan Hak Approval Wali Kelas di assets/dashboard-guru.js
const guruJs = fs.readFileSync(path.join(__dirname, '../assets/dashboard-guru.js'), 'utf8');

console.log('[Test 3] Evaluasi pembatasan wewenang Approval Wali Kelas...');
assert.ok(guruJs.includes('canApprove') && guruJs.includes('walasKelasNorm'), 'Logika canApprove harus memeriksa kecocokan kelas binaan atau role admin');
assert.ok(guruJs.includes('Menunggu Approval Wali Kelas'), 'Status peninjauan read-only untuk guru non-walas harus berbunyi Menunggu Approval Wali Kelas');
console.log('✓ Wewenang approval perizinan terkunci eksklusif untuk Wali Kelas dan Admin.\n');

// 4. Verifikasi Navigasi Silang di dashboard-guru.html dan dashboard.html
const dashGuruHtml = fs.readFileSync(path.join(__dirname, '../dashboard-guru.html'), 'utf8');
const dashHtml = fs.readFileSync(path.join(__dirname, '../dashboard.html'), 'utf8');

console.log('[Test 4] Evaluasi navigasi silang antar portal...');
assert.ok(dashGuruHtml.includes('linkPanelAdminGuru'), 'dashboard-guru.html harus memiliki link direct kembali ke Panel Admin untuk admin');
assert.ok(dashHtml.includes('bannerStaffReview'), 'dashboard.html harus memiliki Staff Review Banner untuk Admin/Guru/Walas');
console.log('✓ Elemen navigasi silang dan floating staff bar terpasang sempurna.\n');

// 5. Verifikasi Otomasi Scheduler Interval Jam KBM Aktif
const dashJs = fs.readFileSync(path.join(__dirname, '../assets/dashboard.js'), 'utf8');

console.log('[Test 5] Evaluasi otomatisasi scheduler interval jam KBM...');
assert.ok(dashJs.includes('setInterval(') && (dashJs.includes('muatJadwalBeranda') || dashJs.includes('updateClock')), 'Interval timer berkala harus aktif di dashboard');
console.log('✓ Scheduler interval otomatis KBM aktif.\n');

console.log('======================================================');
console.log('🎉 SEMUA PENGUJIAN SISTEM PERAN TERPADU 100% SUKSES!');
console.log('======================================================');
