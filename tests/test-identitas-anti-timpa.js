/**
 * TEST SUITE: IDENTITAS ANTI-TIMPA (HARDENING PHASE 1.5)
 * -----------------------------------------------------
 * Memastikan satu NISN/NIP hanya bisa dimiliki satu akun dan role terverifikasi
 * tidak bisa dipalsukan lewat tulisan langsung ke Firebase:
 *  - Rules mewajibkan klaim (nisn_claimed / guru_claimed) sebelum role disimpan.
 *  - Node klaim hanya bisa dibuat/diubah oleh pemilik uid.
 *  - auth.js menulis klaim lebih dulu, menolak bentrok, dan menurunkan akun
 *    yang mencoba memakai identitas milik akun lain menjadi pengunjung.
 *  - Jalur impersonasi berbasis displayName Google sudah dihapus.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT_DIR = path.resolve(__dirname, '..');
const baca = (rel) => fs.readFileSync(path.join(ROOT_DIR, rel), 'utf8');

const rules = JSON.parse(baca('database.rules.json')).rules;
const authSrc = baca('assets/auth.js');

console.log('===================================================================');
console.log('🔐 TEST IDENTITAS ANTI-TIMPA & KLAIM NISN/NIP');
console.log('===================================================================\n');

let lulus = 0;
function ok(nama, kondisi) {
  if (arguments.length > 1) assert.ok(kondisi, nama);
  lulus++;
  console.log('  ✓ ' + nama);
}

// =================================================================
console.log('[Test 1] Rules mewajibkan klaim identitas...');
// =================================================================
const usersWrite = rules.users['$uid']['.write'];

ok('users/{uid} hanya boleh dibuat sebagai pengunjung tanpa klaim',
  usersWrite.includes("newData.child('role').val() === 'pengunjung'"));
ok('Role siswa wajib punya klaim NISN milik auth.uid',
  usersWrite.includes("root.child('nisn_claimed').child(newData.child('nisn').val()).child('uid').val() === auth.uid"));
ok('Role guru/walas wajib punya klaim NIP milik auth.uid',
  usersWrite.includes("root.child('guru_claimed').child(newData.child('nip').val()).child('uid').val() === auth.uid"));
ok('Role siswa wajib terdaftar di /siswa',
  usersWrite.includes("root.child('siswa').child(newData.child('nisn').val()).exists()"));
ok('Role guru/walas wajib terdaftar di /guru',
  usersWrite.includes("root.child('guru').child(newData.child('nip').val()).exists()"));
ok('Pengguna boleh menurunkan dirinya sendiri ke pengunjung (tanpa akses data)',
  usersWrite.includes("newData.child('role').val() === 'pengunjung'"));

for (const node of ['nisn_claimed', 'guru_claimed']) {
  assert.ok(rules[node], `rules.${node} wajib ada`);
  const child = rules[node][node === 'nisn_claimed' ? '$nisn' : '$nip'];
  ok(`${node} hanya bisa ditulis bila uid baru = auth.uid`,
    child['.write'].includes('newData.child(\'uid\').val() === auth.uid'));
  ok(`${node} tidak bisa ditimpa pemilik lain`,
    child['.write'].includes("data.child('uid').val() === auth.uid"));
  ok(`${node} tidak terbuka untuk baca massal`,
    rules[node]['.read'].includes("=== 'admin'") && child['.read'] === 'auth != null');
}

ok('email_mapping hanya bisa ditulis bila klaim identitas cocok',
  rules.email_mapping['$encoded']['.write'].includes("root.child('nisn_claimed')") &&
  rules.email_mapping['$encoded']['.write'].includes("root.child('guru_claimed')"));
ok('email_mapping root tidak terbaca oleh pengunjung',
  rules.email_mapping['.read'] !== 'auth != null' &&
  rules.email_mapping['.read'].includes("=== 'admin'") &&
  rules.email_mapping['.read'].includes("=== 'guru'"));

// =================================================================
console.log('\n[Test 2] Direktori guru tidak lagi terbuka untuk pengunjung...');
// =================================================================
ok('/guru root hanya untuk staff',
  rules.guru['.read'] !== 'auth != null' &&
  rules.guru['.read'].includes("=== 'admin'") &&
  rules.guru['.read'].includes("=== 'guru'") &&
  rules.guru['.read'].includes("=== 'walas'"));
ok('/guru/{nip} tetap bisa dibaca untuk verifikasi NIP',
  rules.guru['$nip']['.read'] === 'auth != null');
ok('/guru/{nip} hanya bisa ditulis admin atau guru pemilik NIP',
  rules.guru['$nip']['.write'].includes("=== 'admin'") &&
  rules.guru['$nip']['.write'].includes("child('nip').val() === $nip"));

// =================================================================
console.log('\n[Test 3] auth.js tidak lagi memakai displayName Google...');
// =================================================================
ok('Heuristik displayName (ihsan/athallah/rizky) sudah dihapus',
  !authSrc.includes("dispName.includes('ihsan')") &&
  !authSrc.includes("dispName.includes('rizky')") &&
  !/displayName[^\n]{0,80}includes\('athallah'\)/.test(authSrc));
ok('Klaim identitas ditulis sebelum profil (pastikanKlaimIdentitas -> tulisProfilUser)',
  authSrc.includes('async function pastikanKlaimIdentitas') &&
  authSrc.includes('async function tulisProfilUser') &&
  authSrc.indexOf('await siapkanKlaimSesi(data, uid)') !== -1);
ok('Konfirmasi NISN menolak klaim milik akun lain',
  authSrc.includes('NISN ini sudah ditautkan ke akun lain'));
ok('Konfirmasi NIP menolak klaim milik akun lain',
  authSrc.includes('NIP ini sudah ditautkan ke akun lain'));

// =================================================================
console.log('\n[Test 4] Simulasi klaim & anti-timpa (fake RTDB)...');
// =================================================================
function buatDb(awal) {
  const store = JSON.parse(JSON.stringify(awal || {}));
  const bacaPath = (p) => p.split('/').reduce((o, k) => (o && typeof o === 'object') ? o[k] : undefined, store);
  const tulisPath = (p, v) => {
    const parts = p.split('/');
    let o = store;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!o[parts[i]] || typeof o[parts[i]] !== 'object') o[parts[i]] = {};
      o = o[parts[i]];
    }
    o[parts[parts.length - 1]] = v;
  };
  return {
    store,
    ref(p) {
      return {
        once: async () => ({ val: () => { const v = bacaPath(p); return v === undefined ? null : v; } }),
        set: async (v) => { tulisPath(p, v); },
        update: async (patch) => {
          const cur = bacaPath(p);
          tulisPath(p, Object.assign({}, (cur && typeof cur === 'object') ? cur : {}, patch));
        }
      };
    }
  };
}

const auth = require('../assets/auth.js');

(async () => {
  global.db = buatDb({ users: {} });

  const klaimA = await auth.pastikanKlaimIdentitas('nisn_claimed', '0098263610', 'uid_A', { nama: 'M. Ihsan Athallah' });
  assert.strictEqual(klaimA, 'ok', 'Akun pertama harus berhasil mengklaim NISN');
  assert.strictEqual(global.db.store.nisn_claimed['0098263610'].uid, 'uid_A');
  ok('Akun pertama berhasil mengklaim NISN');

  const klaimB = await auth.pastikanKlaimIdentitas('nisn_claimed', '0098263610', 'uid_B', { nama: 'Penyusup' });
  assert.strictEqual(klaimB, 'conflict', 'Akun kedua harus ditolak (konflik)');
  assert.strictEqual(global.db.store.nisn_claimed['0098263610'].uid, 'uid_A', 'Klaim tidak boleh tertimpa');
  assert.notStrictEqual(global.db.store.nisn_claimed['0098263610'].nama, 'Penyusup');
  ok('Akun kedua ditolak & klaim tidak tertimpa');

  const statusTulis = await auth.tulisProfilUser('uid_B', {
    uid: 'uid_B', email: 'penyusup@gmail.com', nama: 'M. IHSAN ATHALLAH',
    nisn: '0098263610', kelas: 'XII RPL 2', role: 'siswa', isVerified: true
  }, 'update');
  assert.strictEqual(statusTulis, 'conflict', 'Penulisan role siswa oleh akun penimpa harus gagal');
  assert.strictEqual(global.db.store.users['uid_B'].role, 'pengunjung', 'Akun penimpa harus diturunkan ke pengunjung');
  assert.strictEqual(global.db.store.users['uid_B'].nisn, null, 'NISN penimpa harus dikosongkan');
  assert.strictEqual(global.db.store.users['uid_B'].isVerified, false, 'Status verifikasi penimpa harus dicabut');
  ok('Role siswa palsu otomatis diturunkan ke pengunjung tanpa data');

  // Sesi demo (admin role switcher) tidak boleh mengklaim identitas siswa asli.
  const sebelum = JSON.stringify(global.db.store.nisn_claimed);
  const klaimDemo = await auth.siapkanKlaimSesi({
    role: 'siswa', nisn: '0098263610', isRoleSwitched: true
  }, 'uid_admin_demo');
  assert.strictEqual(klaimDemo, 'ok');
  assert.strictEqual(JSON.stringify(global.db.store.nisn_claimed), sebelum, 'Sesi demo tidak boleh menulis klaim');
  ok('Sesi demo/role-switch tidak menulis klaim identitas');

  const turun = auth.turunkanKePengunjung({ uid: 'u', email: 'a@gmail.com', nama: 'M. IHSAN ATHALLAH', nisn: '0098263610', kelas: 'XII RPL 2', nip: null, role: 'siswa', isVerified: true });
  assert.strictEqual(turun.role, 'pengunjung');
  assert.strictEqual(turun.nisn, null);
  assert.strictEqual(turun.kelas, null);
  assert.strictEqual(turun.nama, 'a', 'Nama korban tidak boleh ikut terbawa');
  ok('Data identitas korban tidak terbawa saat penurunan role');

  console.log('\n===================================================================');
  console.log(`🎉 SELURUH ${lulus} PEMERIKSAAN IDENTITAS ANTI-TIMPA LOLOS 100%!`);
  console.log('===================================================================');
})().catch((err) => {
  console.error('\n✗ TEST GAGAL:', err && err.message);
  process.exit(1);
});
