const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- TEST SUITE: Isolasi Role Siswa 7dosabesar557@gmail.com & Anti-Admin Leakage ---');

const authJsPath = path.join(__dirname, '..', 'assets', 'auth.js');
const authJsCode = fs.readFileSync(authJsPath, 'utf8');

// 1. Static assertion: 7dosabesar557@gmail.com is NOT in MASTER_ADMIN_EMAILS
assert(!authJsCode.includes("'7dosabesar557@gmail.com' in MASTER_ADMIN_EMAILS"), '7dosabesar must not be in MASTER_ADMIN_EMAILS');

// 2. Functional test
global.window = {};
global.sessionStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

const updatedDbRecords = {};
global.db = {
  ref: (p) => ({
    once: () => Promise.resolve({
      val: () => {
        if (p === 'users/uid_7dosa_test') {
          // Simulasi residu admin dari riwayat lama
          return {
            email: 'admin@smkn1sumedang.sch.id',
            isVerified: true,
            nip: '197905032006042004',
            role: 'admin',
            uid: 'uid_7dosa_test'
          };
        }
        return null;
      }
    }),
    set: (val) => { updatedDbRecords[p] = val; return Promise.resolve(); },
    update: (val) => { updatedDbRecords[p] = Object.assign(updatedDbRecords[p] || {}, val); return Promise.resolve(); }
  })
};

const config = require('../assets/firebase-config.js');
global.MASTER_DATA_SISWA_RESMI = config.MASTER_DATA_SISWA_RESMI;

eval(authJsCode);

// Assert isEmailAdmin returns false for 7dosabesar557@gmail.com
assert.strictEqual(isEmailAdmin('7dosabesar557@gmail.com'), false, '7dosabesar557@gmail.com must NOT be an admin email');
console.log('✓ PASS: isEmailAdmin("7dosabesar557@gmail.com") returns false.');

// Assert isEmailAdmin returns true for real admin
assert.strictEqual(isEmailAdmin('admin@smkn1sumedang.sch.id'), true, 'admin@smkn1sumedang.sch.id MUST be admin email');
console.log('✓ PASS: isEmailAdmin("admin@smkn1sumedang.sch.id") returns true.');

// Assert cariSiswaByEmail finds M. Ihsan Athallah
const studentMatch = cariSiswaByEmail('7dosabesar557@gmail.com');
assert.ok(studentMatch, 'Must find student match for 7dosabesar557@gmail.com');
assert.strictEqual(studentMatch.nisn, '0098263610', 'NISN must be 0098263610');
assert.strictEqual(studentMatch.nama, 'M. IHSAN ATHALLAH', 'Nama must be M. IHSAN ATHALLAH');
assert.strictEqual(studentMatch.kelas, 'XII RPL 2', 'Kelas must be XII RPL 2');
console.log('✓ PASS: cariSiswaByEmail correctly maps 7dosabesar557@gmail.com to M. Ihsan Athallah (XII RPL 2).');

// Assert prosesLoginUser cleanses residual admin role
(async () => {
  const userObj = await prosesLoginUser({
    uid: 'uid_7dosa_test',
    email: '7dosabesar557@gmail.com'
  });

  assert.strictEqual(userObj.role, 'siswa', 'Role MUST be strictly siswa');
  assert.strictEqual(userObj.nisn, '0098263610', 'NISN MUST be 0098263610');
  assert.strictEqual(userObj.nip, undefined, 'NIP must be purged');
  assert.strictEqual(userObj.email, '7dosabesar557@gmail.com', 'Email must be 7dosabesar557@gmail.com');
  console.log('✓ PASS: prosesLoginUser purges residual admin/NIP and resolves strictly to role: siswa.');

  console.log('🎉 ALL TESTS PASSED IN test-7dosa-siswa-role-isolation.js');
})();
