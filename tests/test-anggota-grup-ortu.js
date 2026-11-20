const assert = require('assert');
const fs = require('fs');

console.log('=== TEST DETAIL ANGGOTA GRUP ORTU (3 MEMBER & 2 ADMIN) ===\n');

// Mock localStorage
const mockStorage = {
  user_aktif: JSON.stringify({
    uid: 'USER_ORTU_0098263610',
    id: 'USER_ORTU_0098263610',
    nama: 'M Fazjar Alamsyah',
    role: 'orangtua',
    isVerified: true,
    kelas_anak: 'XII RPL 2',
    nisn_anak: '0098263610'
  })
};

global.localStorage = {
  getItem: (k) => mockStorage[k] || null,
  setItem: (k, v) => { mockStorage[k] = String(v); },
  removeItem: (k) => { delete mockStorage[k]; }
};

global.sessionStorage = {
  getItem: (k) => mockStorage[k] || null,
  setItem: (k, v) => { mockStorage[k] = String(v); },
  removeItem: (k) => { delete mockStorage[k]; }
};

global.window = {
  location: { pathname: '/dashboard-ortu.html', href: 'http://localhost/dashboard-ortu.html' }
};
global.document = {
  body: { appendChild: () => {} },
  getElementById: () => null,
  createElement: () => ({ style: {}, appendChild: () => {}, querySelectorAll: () => [], setAttribute: () => {} }),
  addEventListener: () => {}
};

const chatHub = require('../assets/chat-hub.js');
const { getDaftarGrupResmi, getActiveUserChat } = chatHub;

const cur = getActiveUserChat();
assert.strictEqual(cur.role, 'orangtua', 'Role harus orangtua');
assert.strictEqual(cur.nama, 'M Fazjar Alamsyah');

const groups = getDaftarGrupResmi();
const grupRpl2 = groups['group_ortu_XII_RPL_2'];

assert.ok(grupRpl2, 'Grup Paguyuban XII RPL 2 harus ada');
assert.strictEqual(grupRpl2.adminIds.length, 2, 'Admin grup harus tepat 2 (Walas Pak Echa & Admin Sekolah)');
assert.ok(grupRpl2.adminIds.includes('199209142022211007'), 'Pak Echa harus admin grup');
assert.ok(grupRpl2.adminIds.includes('admin'), 'Admin sekolah harus admin grup');

assert.strictEqual(grupRpl2.memberIds.length, 3, 'Total member harus tepat 3 (1 Walas, 1 Admin, 1 Ortu M Fazjar Alamsyah)');
assert.ok(grupRpl2.memberIds.includes('USER_ORTU_0098263610'), 'Akun ortu M Fazjar Alamsyah harus masuk ke memberIds');

console.log('[PASS 1] Total admin grup ortu tepat 2 orang (Walas & Admin).');
console.log('[PASS 2] Total anggota grup ortu tepat 3 orang: Wali Kelas, Admin, dan Orang Tua (M Fazjar Alamsyah).');

console.log('\n🎉 SEMUA PENGUJIAN DETAIL GRUP ORTU 100% SUKSES!');
