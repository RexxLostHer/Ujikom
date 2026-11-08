// ===================================================================
// TEST SUITE: test-admin-role-and-sync.js
// Verifikasi:
// 1. Penghapusan total role 'ortu' dari antarmuka Admin (admin.html & admin.js)
// 2. Strict permitted roles: 'pengunjung', 'guru', 'siswa', 'walas'
// 3. Sinkronisasi otomatis verifikasi & penautan status Guru (termasuk Muhammad Echa Putra)
// 4. Sinkronisasi otomatis verifikasi & penautan status Siswa (NISN & Kelas M. Ihsan)
// 5. Isolasi akun pengunjung murni (Belum Tertaut)
// 6. Validasi ketat ubahRoleUser & pembersihan credential
// 7. Pemeliharaan ketat Invarian Sekolah (3 kelas resmi, auth guard, isolasi siswa)
// ===================================================================

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('=== MEMULAI TEST PENGHAPUSAN ROLE ORTU & SINKRONISASI VERIFIKASI ADMIN ===\n');

// -------------------------------------------------------------
// [Test 1] Evaluasi Statis: Eliminasi 'ortu' & Role Resmi di admin.html dan admin.js
// -------------------------------------------------------------
console.log('[Test 1] Evaluasi Statis Berkas admin.html & assets/admin.js...');
const adminHtmlPath = path.join(__dirname, '../admin.html');
const adminJsPath = path.join(__dirname, '../assets/admin.js');

const adminHtml = fs.readFileSync(adminHtmlPath, 'utf8');
const adminJs = fs.readFileSync(adminJsPath, 'utf8');

// A. admin.html tidak boleh memuat 'ortu' atau 'Orang Tua'
assert.ok(!adminHtml.includes("'ortu'"), "admin.html tidak boleh memuat string literal 'ortu'");
assert.ok(!adminHtml.includes('"ortu"'), 'admin.html tidak boleh memuat string literal "ortu"');
assert.ok(!adminHtml.includes('>Orang Tua<'), 'admin.html tidak boleh memuat opsi teks Orang Tua');
console.log('  ✓ admin.html 100% bebas dari referensi role ortu.');

// B. assets/admin.js tidak boleh memuat 'ortu' dalam role dropdown
assert.ok(!adminJs.includes("['pengunjung', 'siswa', 'ortu'"), "assets/admin.js dilarang memuat opsi ortu dalam role select");
assert.ok(!adminJs.includes("'ortu'"), "assets/admin.js dilarang memuat role ortu");

// C. Periksa permitted roles dalam admin.js
const permittedRoles = ['pengunjung', 'guru', 'siswa', 'walas'];
permittedRoles.forEach(role => {
  assert.ok(adminJs.includes(`'${role}'`) || adminJs.includes(`"${role}"`), `assets/admin.js harus memuat role '${role}'`);
});
assert.ok(adminJs.includes("const PERMITTED_ROLES = ['pengunjung', 'guru', 'siswa', 'walas'];"), 'assets/admin.js harus mendefinisikan PERMITTED_ROLES');
console.log('  ✓ assets/admin.js menerapkan strict permitted roles: pengunjung, guru, siswa, walas.\n');

// -------------------------------------------------------------
// [Test 2] Evaluasi Dinamis: Dropdown Role & Sanitasi Akun Legacy 'ortu'
// -------------------------------------------------------------
console.log('[Test 2] Evaluasi Pembuatan Opsi Dropdown Role & Sanitasi Akun Legacy...');

// Setup Mock DOM
class MockElement {
  constructor(tagName) {
    this.tagName = (tagName || '').toUpperCase();
    this.children = [];
    this.attributes = {};
    this.className = '';
    this.innerHTML = '';
    this.textContent = '';
    this.style = {};
    this.value = '';
    this.selected = false;
    this.onchange = null;
    this.onclick = null;
    this.classList = {
      add: () => {},
      remove: () => {},
      contains: () => false
    };
  }
  appendChild(child) {
    this.children.push(child);
    return child;
  }
  setAttribute(k, v) { this.attributes[k] = String(v); }
  getAttribute(k) { return this.attributes[k] || null; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  addEventListener() {}
  removeEventListener() {}
}

const mockTbody = new MockElement('tbody');
global.document = {
  getElementById: (id) => {
    if (id === 'userTableBody') return mockTbody;
    return new MockElement('div');
  },
  createElement: (tag) => new MockElement(tag),
  querySelectorAll: () => [],
  addEventListener: () => {}
};

// Setup Mock RTDB
const mockDbData = {};
const updatedRecords = {};
const removedRecords = [];

function getNode(root, p) {
  if (root[p] !== undefined) return root[p];
  const parts = p.split('/').filter(Boolean);
  let cur = root;
  for (const part of parts) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = cur[part];
  }
  return cur;
}

function updateNode(root, p, val) {
  const parts = p.split('/').filter(Boolean);
  let cur = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!cur[part] || typeof cur[part] !== 'object') cur[part] = {};
    cur = cur[part];
  }
  const last = parts[parts.length - 1];
  if (!cur[last] || typeof cur[last] !== 'object') cur[last] = {};
  Object.assign(cur[last], val);
  root[p] = Object.assign(root[p] || {}, val);
}

function removeNode(root, p) {
  delete root[p];
  const parts = p.split('/').filter(Boolean);
  let cur = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!cur || typeof cur !== 'object') return;
    cur = cur[part];
  }
  if (cur && typeof cur === 'object') {
    delete cur[parts[parts.length - 1]];
  }
}

class MockFirebaseRef {
  constructor(pathStr) {
    this.path = pathStr;
  }
  on(evt, cb) {
    this.callback = cb;
    const val = getNode(mockDbData, this.path);
    cb({ val: () => (val !== undefined ? val : null) });
  }
  async once() {
    const val = getNode(mockDbData, this.path);
    return { val: () => (val !== undefined ? val : null), exists: () => val !== null && val !== undefined };
  }
  async set(val) {
    updateNode(mockDbData, this.path, val);
    updatedRecords[this.path] = val;
    return val;
  }
  async update(val) {
    updateNode(mockDbData, this.path, val);
    updatedRecords[this.path] = Object.assign(updatedRecords[this.path] || {}, val);
    return val;
  }
  async remove() {
    removeNode(mockDbData, this.path);
    removedRecords.push(this.path);
    return true;
  }
}

global.db = {
  ref: (p) => new MockFirebaseRef(p)
};
global.window = {
  db: global.db,
  document: global.document,
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  location: { href: '', replace: () => {} },
  addEventListener: () => {}
};

// Load dependencies
const { MASTER_GURU_RESMI, MASTER_DATA_SISWA_RESMI, DAFTAR_KELAS_RESMI } = require('../assets/firebase-config.js');
global.MASTER_GURU_RESMI = MASTER_GURU_RESMI;
global.MASTER_DATA_SISWA_RESMI = MASTER_DATA_SISWA_RESMI;
global.window.MASTER_GURU_RESMI = MASTER_GURU_RESMI;
global.window.MASTER_DATA_SISWA_RESMI = MASTER_DATA_SISWA_RESMI;

const authCode = fs.readFileSync(path.join(__dirname, '../assets/auth.js'), 'utf8');
eval(authCode);

const adminCode = fs.readFileSync(path.join(__dirname, '../assets/admin.js'), 'utf8');
eval(adminCode);

async function runDynamicTests() {
  // Inject sample users: pengunjung, walas, and legacy ortu
  mockDbData['users'] = {
    'uid_tamu': { uid: 'uid_tamu', email: 'tamu@gmail.com', nama: 'Tamu Ujikom', role: 'pengunjung' },
    'uid_walas': { uid: 'uid_walas', email: 'walas@smkn1sumedang.sch.id', nama: 'Hani Hanifah, S.Si', role: 'walas', nip: '198109012009022003', isWalas: true, walasKelasId: 'XII RPL 1' },
    'uid_legacy_ortu': { uid: 'uid_legacy_ortu', email: 'ortu@gmail.com', nama: 'Orang Tua Siswa', role: 'ortu' }
  };

  // Panggil loadUsers()
  loadUsers();

  // Periksa setiap baris yang dirender
  assert.ok(mockTbody.children.length >= 3, 'Harus merender seluruh pengguna');
  mockTbody.children.forEach(tr => {
    const select = tr.children[2].children[0];
    assert.ok(select, 'Kolom role harus memiliki dropdown select');
    assert.strictEqual(select.className, 'role-select');
    
    const optionValues = select.children.map(o => o.value);
    assert.strictEqual(optionValues.length, 4, 'Dropdown role harus memiliki tepat 4 opsi');
    assert.ok(!optionValues.includes('ortu'), 'Dropdown role dilarang keras memuat opsi ortu');
    assert.ok(optionValues.includes('pengunjung'), 'Opsi pengunjung harus ada');
    assert.ok(optionValues.includes('guru'), 'Opsi guru harus ada');
    assert.ok(optionValues.includes('siswa'), 'Opsi siswa harus ada');
    assert.ok(optionValues.includes('walas'), 'Opsi walas harus ada');
  });

  // Periksa sanitasi akun legacy ortu
  assert.strictEqual(mockDbData['users']['uid_legacy_ortu'].role, 'pengunjung', 'Akun role ortu harus dinormalisasi menjadi pengunjung');
  console.log('  ✓ Seluruh baris tabel user hanya memuat 4 role resmi & akun ortu dinormalisasi ke pengunjung.\n');

  // -------------------------------------------------------------
  // [Test 3] Evaluasi Sinkronisasi Otomatis Guru (Muhammad Echa Putra)
  // -------------------------------------------------------------
  console.log('[Test 3] Evaluasi Penautan Otomatis NIP Guru Muhammad Echa Putra (ihsan33roblox@gmail.com)...');

  // Simulasi user Muhammad Echa Putra yang belum tertaut di RTDB (role pengunjung, nip null)
  mockDbData['users']['uid_echa'] = {
    uid: 'uid_echa',
    email: 'ihsan33roblox@gmail.com',
    nama: 'Muhammad Echa Putra',
    role: 'pengunjung'
  };

  // Jalankan loadUsers()
  loadUsers();

  // Periksa update di RTDB
  const echaUpdated = mockDbData['users']['uid_echa'];
  assert.strictEqual(echaUpdated.nip, '199209142022211007', 'NIP harus tersinkronisasi ke 199209142022211007');
  assert.strictEqual(echaUpdated.role, 'walas', 'Role harus tersinkronisasi ke walas');
  assert.strictEqual(echaUpdated.walasKelasId, 'XII RPL 2', 'Kelas walas harus XII RPL 2');
  assert.strictEqual(echaUpdated.isVerified, true, 'isVerified harus true');

  // Periksa elemen DOM yang dirender untuk baris Echa
  const echaTr = mockTbody.children.find(tr => tr.children[1].textContent === 'ihsan33roblox@gmail.com');
  assert.ok(echaTr, 'Baris Muhammad Echa Putra harus ditemukan di tabel');
  assert.ok(!echaTr.children[3].innerHTML.includes('- Belum Tertaut'), 'Status NIP tidak boleh "- Belum Tertaut"');
  assert.ok(echaTr.children[3].innerHTML.includes('199209142022211007'), 'Status NIP harus memuat NIP 199209142022211007');
  assert.ok(echaTr.children[3].innerHTML.includes('Walas XII RPL 2'), 'Status NIP harus memuat badge Walas XII RPL 2');
  assert.ok(echaTr.children[4].children.some(b => b.innerHTML.includes('Lepas NIP')), 'Kolom aksi harus menyediakan tombol Lepas NIP');
  console.log('  ✓ Guru Muhammad Echa Putra otomatis tertaut NIP 199209142022211007, role walas, dan badge Walas XII RPL 2.\n');

  // -------------------------------------------------------------
  // [Test 4] Evaluasi Sinkronisasi Otomatis Siswa (M. Ihsan Athallah)
  // -------------------------------------------------------------
  console.log('[Test 4] Evaluasi Penautan Otomatis NISN Siswa M. Ihsan Athallah (7dosabesar557@gmail.com)...');

  // Simulasi user Ihsan yang belum tertaut di RTDB (role pengunjung, nisn null)
  mockDbData['users']['uid_ihsan'] = {
    uid: 'uid_ihsan',
    email: '7dosabesar557@gmail.com',
    nama: 'Ihsan Siswa',
    role: 'pengunjung'
  };

  loadUsers();

  const ihsanUpdated = mockDbData['users']['uid_ihsan'];
  assert.strictEqual(ihsanUpdated.nisn, '0098263610', 'NISN harus tersinkronisasi ke 0098263610');
  assert.strictEqual(ihsanUpdated.kelas, 'XII RPL 2', 'Kelas harus XII RPL 2');
  assert.strictEqual(ihsanUpdated.role, 'siswa', 'Role harus siswa');

  const ihsanTr = mockTbody.children.find(tr => tr.children[1].textContent === '7dosabesar557@gmail.com');
  assert.ok(ihsanTr, 'Baris M. Ihsan Athallah harus ditemukan');
  assert.ok(!ihsanTr.children[3].innerHTML.includes('- Belum Tertaut'), 'Status NISN tidak boleh "- Belum Tertaut"');
  assert.ok(ihsanTr.children[3].innerHTML.includes('0098263610'), 'Status harus memuat NISN 0098263610');
  assert.ok(ihsanTr.children[3].innerHTML.includes('XII RPL 2'), 'Status harus memuat kelas XII RPL 2');
  assert.ok(ihsanTr.children[4].children.some(b => b.innerHTML.includes('Lepas NISN')), 'Kolom aksi harus menyediakan tombol Lepas NISN');
  console.log('  ✓ Siswa M. Ihsan Athallah otomatis tertaut NISN 0098263610 dan kelas XII RPL 2.\n');

  // -------------------------------------------------------------
  // [Test 5] Evaluasi Isolasi Pengunjung Murni (guest@example.com)...
  // -------------------------------------------------------------
  console.log('[Test 5] Evaluasi Isolasi Pengunjung Murni (guest@example.com)...');
  mockDbData['users']['uid_guest_pure'] = {
    uid: 'uid_guest_pure',
    email: 'guest@example.com',
    nama: 'Pengunjung Luar',
    role: 'pengunjung'
  };

  loadUsers();

  const guestTr = mockTbody.children.find(tr => tr.children[1].textContent === 'guest@example.com');
  assert.ok(guestTr, 'Baris guest harus ada');
  assert.ok(guestTr.children[3].innerHTML.includes('- Belum Tertaut'), 'Pengunjung tanpa NIP/NISN harus berstatus - Belum Tertaut');
  const selectedOpt = guestTr.children[2].children[0].children.find(o => o.selected);
  assert.strictEqual(selectedOpt ? selectedOpt.value : guestTr.children[2].children[0].value, 'pengunjung');
  console.log('  ✓ Pengunjung murni tetap terisolasi dengan status - Belum Tertaut.\n');

  // -------------------------------------------------------------
  // [Test 6] Evaluasi Fungsi ubahRoleUser Permitted Role Mutation & Safe Cleanup
  // -------------------------------------------------------------
  console.log('[Test 6] Evaluasi ubahRoleUser(uid, role) & Sanitasi...');
  
  // A. Mengubah role ke pengunjung membersihkan NIP & status walas
  await ubahRoleUser('uid_walas', 'pengunjung');
  const walasDemoted = mockDbData['users']['uid_walas'];
  assert.strictEqual(walasDemoted.role, 'pengunjung', 'Role harus turun ke pengunjung');
  assert.strictEqual(walasDemoted.nip, null, 'NIP harus dibersihkan saat role pengunjung');
  assert.strictEqual(walasDemoted.walasKelasId, null, 'walasKelasId harus dinull-kan');

  // B. Menolak role ilegal (seperti 'ortu')
  const beforeIllegal = mockDbData['users']['uid_tamu'].role;
  await ubahRoleUser('uid_tamu', 'ortu');
  assert.strictEqual(mockDbData['users']['uid_tamu'].role, beforeIllegal, 'Role ilegal ortu harus ditolak dan tidak diubah');
  console.log('  ✓ ubahRoleUser sukses membersihkan credential dan menolak role ilegal.\n');

  // -------------------------------------------------------------
  // [Test 7] Evaluasi Pemeliharaan Seluruh Invarian Proyek
  // -------------------------------------------------------------
  console.log('[Test 7] Evaluasi Pemeliharaan Ketat Invarian SMKN 1 Sumedang...');
  // A. Invarian 3 Kelas Resmi
  assert.strictEqual(DAFTAR_KELAS_RESMI.length, 3, 'Hanya boleh ada 3 kelas resmi');
  assert.deepStrictEqual(DAFTAR_KELAS_RESMI, ['XII RPL 1', 'XII RPL 2', 'XII TKJ 1']);
  assert.ok(!adminHtml.includes('PPLG'), 'admin.html dilarang memuat kelas fiktif PPLG');
  assert.ok(!adminHtml.includes('Kelas 10'), 'admin.html dilarang memuat Kelas 10');

  // B. Invarian Mandatory Auth Guard
  const earlyGuardMatch = adminJs.match(/(let shouldHaltAdmin = false;[\s\S]*?)(if \(!shouldHaltAdmin && typeof firebase)/);
  assert.ok(earlyGuardMatch, 'Early guard admin.js harus ada');
  assert.ok(
    earlyGuardMatch[1].includes("window.location.replace('admin-login.html')") ||
    earlyGuardMatch[1].includes("location.href = 'admin-login.html'"),
    'Guard harus melempar anonymous ke admin-login.html'
  );

  // C. Invarian Isolasi Siswa 7dosabesar557@gmail.com
  const fnIsAdmin = typeof isEmailAdmin === 'function' ? isEmailAdmin : global.isEmailAdmin;
  assert.ok(!fnIsAdmin('7dosabesar557@gmail.com'), '7dosabesar557@gmail.com tidak boleh menjadi admin');
  console.log('  ✓ Seluruh invarian sekolah (3 kelas, auth guard, isolasi akun siswa) 100% terjaga.\n');

  console.log('===================================================================');
  console.log('🎉 SEMUA PENGUJIAN ROLE & SINKRONISASI ADMIN BERHASIL 100%! (7/7)');
  console.log('===================================================================');
}

runDynamicTests().catch(err => {
  console.error('❌ GAGAL PENGUJIAN:', err);
  process.exit(1);
});
