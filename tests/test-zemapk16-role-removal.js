/**
 * Test Suite: Verifikasi Pelepasan Role M. Ihsan dari zemapk16 dan Isolasi ke 7dosabesar557
 * Memastikan tidak ada duplikasi akun siswa antara zemapk16@gmail.com dan 7dosabesar557@gmail.com
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('=== TEST SUITE: PELEPASAN ROLE ZEMAPK16 & PEMETAAN TUNGGAL 7DOSABESAR557 ===\n');

// Mock localStorage & sessionStorage
class MockStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] || null;
  }
  setItem(key, val) {
    this.store[key] = String(val);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

global.localStorage = new MockStorage();
global.sessionStorage = new MockStorage();

// Load firebase-config and auth modules
const { MASTER_DATA_SISWA_RESMI } = require('../assets/firebase-config.js');
global.MASTER_DATA_SISWA_RESMI = MASTER_DATA_SISWA_RESMI;

// Mock window & document
global.window = {
  MASTER_DATA_SISWA_RESMI,
  localStorage: global.localStorage,
  sessionStorage: global.sessionStorage,
  location: { href: '' },
  addEventListener: () => {}
};
global.document = {
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {}
};

// Evaluate auth.js
const authCode = fs.readFileSync(path.join(__dirname, '../assets/auth.js'), 'utf8');
eval(authCode);

// Mock Firebase RTDB
class MockFirebaseRef {
  constructor(pathStr, dbInstance) {
    this.path = pathStr;
    this.db = dbInstance;
  }
  async once(event) {
    const val = this.db.data[this.path];
    return {
      val: () => (val !== undefined ? val : null),
      exists: () => val !== undefined && val !== null
    };
  }
  async set(val) {
    this.db.data[this.path] = val;
    return val;
  }
  async update(val) {
    if (!this.db.data[this.path] || typeof this.db.data[this.path] !== 'object') {
      this.db.data[this.path] = {};
    }
    Object.assign(this.db.data[this.path], val);
    return val;
  }
  async remove() {
    delete this.db.data[this.path];
    return true;
  }
}

class MockFirebaseDB {
  constructor() {
    this.data = {};
  }
  ref(p) {
    return new MockFirebaseRef(p, this);
  }
}

async function runTests() {
  // ==========================================
  // [Test 1] Pemetaan Email Siswa
  // ==========================================
  console.log('[Test 1] Verifikasi fungsi cariSiswaByEmail...');
  const resZemapk = cariSiswaByEmail('zemapk16@gmail.com');
  assert.strictEqual(resZemapk, null, 'zemapk16@gmail.com harus menghasilkan null (tidak terikat siswa)');

  const res7Dosa = cariSiswaByEmail('7dosabesar557@gmail.com');
  assert.ok(res7Dosa, '7dosabesar557@gmail.com harus ditemukan');
  assert.strictEqual(res7Dosa.nisn, '0098263610', 'NISN harus 0098263610 (M. Ihsan Athallah)');
  assert.strictEqual(res7Dosa.kelas, 'XII RPL 2', 'Kelas harus XII RPL 2');
  console.log('✓ cariSiswaByEmail: zemapk16=null, 7dosabesar557=0098263610 (PASSED)\n');

  // ==========================================
  // [Test 2] Sanitasi Session Stale zemapk16
  // ==========================================
  console.log('[Test 2] Verifikasi sanitasi session getSessionUser untuk zemapk16...');
  // Simulasikan session usang di mana zemapk16 tercatat sebagai M. Ihsan
  const staleSession = {
    uid: 'uid-zemapk16-old',
    email: 'zemapk16@gmail.com',
    nama: 'M. IHSAN ATHALLAH',
    role: 'siswa',
    nisn: '0098263610',
    kelas: 'XII RPL 2',
    isVerified: true
  };
  localStorage.setItem('user_aktif', JSON.stringify(staleSession));
  sessionStorage.setItem('user_aktif', JSON.stringify(staleSession));

  const sanitizedUser = getSessionUser();
  assert.ok(sanitizedUser, 'User session harus terbaca');
  assert.strictEqual(sanitizedUser.email, 'zemapk16@gmail.com');
  assert.strictEqual(sanitizedUser.role, 'pengunjung', 'Role harus di-sanitize menjadi pengunjung');
  assert.strictEqual(sanitizedUser.nisn, null, 'NISN harus dinull-kan');
  assert.strictEqual(sanitizedUser.kelas, null, 'Kelas harus dinull-kan');
  assert.strictEqual(sanitizedUser.nama, 'Pengunjung', 'Nama harus dinetralkan');
  console.log('✓ getSessionUser auto-sanitize: Stale role zemapk16 dibersihkan ke pengunjung (PASSED)\n');

  // ==========================================
  // [Test 3] prosesLoginUser untuk zemapk16 (New Login & Stale DB Login)
  // ==========================================
  console.log('[Test 3] Verifikasi prosesLoginUser untuk zemapk16...');
  const mockDb = new MockFirebaseDB();
  global.db = mockDb;
  global.window.db = mockDb;
  global.firebase = { database: () => mockDb };

  // Kasus A: Akun baru zemapk16 login dengan Google displayName "M. Ihsan Athallah"
  const fbUserNew = {
    uid: 'uid-zemapk16-new',
    email: 'zemapk16@gmail.com',
    displayName: 'M. Ihsan Athallah',
    photoURL: 'https://example.com/photo.jpg'
  };
  const loggedNew = await prosesLoginUser(fbUserNew);
  assert.strictEqual(loggedNew.role, 'pengunjung', 'Role akun baru zemapk16 harus pengunjung');
  assert.strictEqual(loggedNew.nisn, null, 'NISN harus null meskipun displayName Ihsan Athallah');
  assert.strictEqual(loggedNew.kelas, null, 'Kelas harus null');

  // Kasus B: Akun lama zemapk16 yang di DB tersimpan sebagai siswa
  mockDb.data['users/uid-zemapk16-stale'] = {
    uid: 'uid-zemapk16-stale',
    email: 'zemapk16@gmail.com',
    nama: 'M. IHSAN ATHALLAH',
    role: 'siswa',
    nisn: '0098263610',
    kelas: 'XII RPL 2',
    isVerified: true
  };
  mockDb.data['email_mapping/zemapk16(at)gmail,com'] = {
    role: 'siswa',
    nisn: '0098263610',
    kelas: 'XII RPL 2'
  };
  mockDb.data['nisn_claimed/0098263610'] = {
    email: 'zemapk16@gmail.com',
    uid: 'uid-zemapk16-stale'
  };

  const fbUserStale = {
    uid: 'uid-zemapk16-stale',
    email: 'zemapk16@gmail.com',
    displayName: 'M. Ihsan Athallah'
  };
  const loggedStale = await prosesLoginUser(fbUserStale);
  assert.strictEqual(loggedStale.role, 'pengunjung', 'Role lama harus diturunkan ke pengunjung');
  assert.strictEqual(loggedStale.nisn, null, 'NISN harus dibersihkan dari DB dan objek user');
  assert.strictEqual(loggedStale.kelas, null, 'Kelas harus dinull-kan');

  // Periksa bahwa RTDB juga telah dibersihkan
  assert.strictEqual(mockDb.data['users/uid-zemapk16-stale'].role, 'pengunjung');
  assert.strictEqual(mockDb.data['users/uid-zemapk16-stale'].nisn, null);
  assert.strictEqual(mockDb.data['email_mapping/zemapk16(at)gmail,com'], undefined, 'email_mapping harus dihapus');
  assert.strictEqual(mockDb.data['nisn_claimed/0098263610'], undefined, 'Klaim NISN lama oleh zemapk16 harus dihapus');
  console.log('✓ prosesLoginUser: zemapk16 ditolak dari role siswa & DB dibersihkan (PASSED)\n');

  // ==========================================
  // [Test 4] prosesLoginUser untuk 7dosabesar557@gmail.com
  // ==========================================
  console.log('[Test 4] Verifikasi prosesLoginUser untuk 7dosabesar557...');
  const fbUser7Dosa = {
    uid: 'uid-7dosabesar557',
    email: '7dosabesar557@gmail.com',
    displayName: '7 dosa Besar',
    photoURL: 'https://example.com/ihsan.jpg'
  };
  const logged7Dosa = await prosesLoginUser(fbUser7Dosa);
  assert.strictEqual(logged7Dosa.role, 'siswa', 'Role 7dosabesar557 harus siswa');
  assert.strictEqual(logged7Dosa.nisn, '0098263610', 'NISN harus 0098263610');
  assert.strictEqual(logged7Dosa.nama, 'M. IHSAN ATHALLAH', 'Nama harus M. IHSAN ATHALLAH');
  assert.strictEqual(logged7Dosa.kelas, 'XII RPL 2', 'Kelas harus XII RPL 2');
  console.log('✓ prosesLoginUser: 7dosabesar557 berhasil terpetakan sebagai siswa tunggal M. Ihsan (PASSED)\n');

  // ==========================================
  // [Test 5] Anti-Collision & Legacy Claim Resolution di periksaNisnSiswa
  // ==========================================
  console.log('[Test 5] Verifikasi periksaNisnSiswa dengan klaim legacy zemapk16...');
  // Simulasikan jika ada klaim legacy zemapk16 di database
  mockDb.data['nisn_claimed/0098263610'] = {
    email: 'zemapk16@gmail.com',
    uid: 'uid-zemapk16-old'
  };

  // Simulasikan session aktif 7dosabesar557
  sessionStorage.setItem('user_aktif', JSON.stringify({
    uid: 'uid-7dosabesar557',
    email: '7dosabesar557@gmail.com'
  }));

  const resClaim = await periksaNisnSiswa('0098263610');
  assert.ok(resClaim, 'Klaim legacy zemapk16 tidak boleh memblokir 7dosabesar557');
  assert.strictEqual(resClaim.nama, 'M. IHSAN ATHALLAH');
  assert.strictEqual(resClaim.nisn, '0098263610');
  console.log('✓ periksaNisnSiswa: Klaim legacy zemapk16 otomatis diizinkan untuk 7dosabesar557 (PASSED)\n');

  // ==========================================
  // [Test 6] Evaluasi Admin ubahRoleUser ke pengunjung
  // ==========================================
  console.log('[Test 6] Verifikasi ubahRoleUser(uid, "pengunjung") di admin.js...');
  const adminCode = fs.readFileSync(path.join(__dirname, '../assets/admin.js'), 'utf8');
  eval(adminCode);

  mockDb.data['users/uid-test-murid'] = {
    uid: 'uid-test-murid',
    email: 'murid@smkn1sumedang.sch.id',
    role: 'siswa',
    nisn: '0098263610',
    kelas: 'XII RPL 2'
  };
  mockDb.data['nisn_claimed/0098263610'] = {
    uid: 'uid-test-murid',
    email: 'murid@smkn1sumedang.sch.id'
  };
  mockDb.data['email_mapping/murid(at)smkn1sumedang,sch,id'] = {
    role: 'siswa',
    nisn: '0098263610'
  };

  await ubahRoleUser('uid-test-murid', 'pengunjung');
  assert.strictEqual(mockDb.data['users/uid-test-murid'].role, 'pengunjung');
  assert.strictEqual(mockDb.data['users/uid-test-murid'].nisn, null, 'nisn harus dihapus saat ubah role ke pengunjung');
  assert.strictEqual(mockDb.data['users/uid-test-murid'].kelas, null, 'kelas harus dihapus saat ubah role ke pengunjung');
  assert.strictEqual(mockDb.data['nisn_claimed/0098263610'], undefined, 'nisn_claimed harus dihapus');
  assert.strictEqual(mockDb.data['email_mapping/murid(at)smkn1sumedang,sch,id'], undefined, 'email_mapping harus dihapus');
  console.log('✓ ubahRoleUser: Membersihkan nisn, kelas, dan klaim database saat diubah ke pengunjung (PASSED)\n');

  console.log('======================================================================');
  console.log('🎉 SEMUA PENGUJIAN PELEPASAN ROLE ZEMAPK16 BERHASIL 100%! (6/6 PASSED)');
  console.log('======================================================================');
}

runTests().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
