// ===================================================================
// ADVERSARIAL CHALLENGE TEST SUITE: test-adversarial-admin-role-challenge.js
// Author: Challenger 1 (Empirical Challenger Agent)
// Purpose: Adversarially probe and stress-test the elimination of 'ortu' role,
//          strict whitelist validation, legacy DB normalization, DOM select compliance,
//          and privilege escalation resistance in admin.js.
// ===================================================================

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('===================================================================');
console.log('🔥 STARTING ADVERSARIAL CHALLENGE SUITE: ADMIN ROLE & SECURITY');
console.log('===================================================================\n');

// -------------------------------------------------------------
// [Suite 1] Static Code Audit & Whitelist Invariant Verification
// -------------------------------------------------------------
console.log('--- [Suite 1] Static Code Audit & Whitelist Invariant ---');
const adminJsPath = path.join(__dirname, '../assets/admin.js');
const adminHtmlPath = path.join(__dirname, '../admin.html');

const adminJs = fs.readFileSync(adminJsPath, 'utf8');
const adminHtml = fs.readFileSync(adminHtmlPath, 'utf8');

// 1.1 admin.html static check
assert.strictEqual(adminHtml.includes("'ortu'"), false, "admin.html must not contain 'ortu'");
assert.strictEqual(adminHtml.includes('"ortu"'), false, 'admin.html must not contain "ortu"');
assert.strictEqual(adminHtml.includes('>Orang Tua<'), false, 'admin.html must not contain >Orang Tua<');
assert.strictEqual(adminHtml.toLowerCase().includes('role="ortu"'), false, 'admin.html must not contain role="ortu"');
console.log('  [PASS 1.1] admin.html contains zero traces of ortu / Orang Tua.');

// 1.2 admin.js static check
assert.strictEqual(adminJs.includes("'ortu'"), false, "admin.js must not contain string literal 'ortu'");
assert.strictEqual(adminJs.includes('"ortu"'), false, 'admin.js must not contain string literal "ortu"');
assert.ok(adminJs.includes("const PERMITTED_ROLES = ['pengunjung', 'guru', 'siswa', 'walas'];"), 'PERMITTED_ROLES constant must be strictly defined');
assert.ok(adminJs.includes('if (!PERMITTED_ROLES.includes(role))'), 'ubahRoleUser must contain strict whitelist guard');
console.log('  [PASS 1.2] admin.js has zero ortu literals and strictly declares PERMITTED_ROLES whitelist.');

// -------------------------------------------------------------
// Setup Mock Environment for Dynamic & Attack Probing
// -------------------------------------------------------------
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
    this.title = '';
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

// Database Mocking Engine
const mockDb = {
  data: {},
  updatesLog: [],
  removesLog: [],
  reset() {
    this.data = {};
    this.updatesLog = [];
    this.removesLog = [];
  }
};

function deepGet(root, p) {
  if (root[p] !== undefined) return root[p];
  const parts = p.split('/').filter(Boolean);
  let cur = root;
  for (const part of parts) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = cur[part];
  }
  return cur;
}

function deepSet(root, p, val) {
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

function deepDelete(root, p) {
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

class MockRef {
  constructor(pathStr) {
    this.path = pathStr;
  }
  on(evt, cb) {
    this.cb = cb;
    const val = deepGet(mockDb.data, this.path);
    cb({ val: () => (val !== undefined ? val : null) });
  }
  async once() {
    const val = deepGet(mockDb.data, this.path);
    return {
      val: () => (val !== undefined ? val : null),
      exists: () => val !== null && val !== undefined
    };
  }
  async set(val) {
    deepSet(mockDb.data, this.path, val);
    mockDb.updatesLog.push({ action: 'set', path: this.path, val });
    return val;
  }
  async update(val) {
    deepSet(mockDb.data, this.path, val);
    mockDb.updatesLog.push({ action: 'update', path: this.path, val });
    return val;
  }
  async remove() {
    deepDelete(mockDb.data, this.path);
    mockDb.removesLog.push({ action: 'remove', path: this.path });
    return true;
  }
}

global.db = {
  ref: (p) => new MockRef(p)
};

global.window = {
  db: global.db,
  document: global.document,
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  location: { href: '', replace: () => {} },
  addEventListener: () => {}
};

// Mock visual animation functions
let lastCeklisCall = null;
global.tampilkanAnimasiCeklis = (payload) => { lastCeklisCall = payload; };
global.window.tampilkanAnimasiCeklis = global.tampilkanAnimasiCeklis;

// Load firebase-config
const { MASTER_GURU_RESMI, MASTER_DATA_SISWA_RESMI, DAFTAR_KELAS_RESMI } = require('../assets/firebase-config.js');
global.MASTER_GURU_RESMI = MASTER_GURU_RESMI;
global.MASTER_DATA_SISWA_RESMI = MASTER_DATA_SISWA_RESMI;
global.DAFTAR_KELAS_RESMI = DAFTAR_KELAS_RESMI;
global.window.MASTER_GURU_RESMI = MASTER_GURU_RESMI;
global.window.MASTER_DATA_SISWA_RESMI = MASTER_DATA_SISWA_RESMI;

// Load auth.js
const authCode = fs.readFileSync(path.join(__dirname, '../assets/auth.js'), 'utf8');
eval(authCode);

// Load admin.js
eval(adminJs);

async function runAdversarialChallenge() {
  // -------------------------------------------------------------
  // [Suite 2] Adversarial Role Injection Attacks on ubahRoleUser
  // -------------------------------------------------------------
  console.log('\n--- [Suite 2] Adversarial Role Injection Attacks on ubahRoleUser ---');
  
  const testUid = 'target_user_test_99';
  const initialUserData = {
    uid: testUid,
    email: 'normal_user@example.com',
    nama: 'Target User',
    role: 'pengunjung',
    isVerified: false
  };

  const maliciousPayloads = [
    { name: 'Deprecated ortu role', value: 'ortu' },
    { name: 'Uppercase ORTU', value: 'ORTU' },
    { name: 'Mixed case OrTu', value: 'OrTu' },
    { name: 'Whitespace padded ortu', value: ' ortu ' },
    { name: 'Privilege escalation superadmin', value: 'superadmin' },
    { name: 'Privilege escalation admin', value: 'admin' },
    { name: 'Privilege escalation root', value: 'root' },
    { name: 'Privilege escalation developer', value: 'developer' },
    { name: 'Privilege escalation sysadmin', value: 'sysadmin' },
    { name: 'XSS script injection', value: '<script>alert("hacked")</script>' },
    { name: 'HTML attribute injection', value: 'pengunjung" autofocus onfocus="alert(1)' },
    { name: 'Empty string', value: '' },
    { name: 'Whitespace string', value: '   ' },
    { name: 'Null value', value: null },
    { name: 'Undefined value', value: undefined },
    { name: 'Numeric value', value: 1337 },
    { name: 'Boolean true', value: true },
    { name: 'Object injection', value: { role: 'admin' } },
    { name: 'Array injection', value: ['guru'] },
    { name: 'Prototype pollution __proto__', value: '__proto__' },
    { name: 'Prototype pollution constructor', value: 'constructor' },
    { name: 'Path traversal ../users/admin', value: '../users/admin' },
    { name: 'SQL injection payload', value: "pengunjung'; DROP TABLE users;--" }
  ];

  let rejectedCount = 0;

  for (const attack of maliciousPayloads) {
    mockDb.reset();
    mockDb.data['users'] = { [testUid]: Object.assign({}, initialUserData) };
    const initialLogLen = mockDb.updatesLog.length;

    try {
      await ubahRoleUser(testUid, attack.value);
    } catch (err) {
      assert.fail(`ubahRoleUser threw unexpected exception on payload "${attack.name}": ${err.message}`);
    }

    // Verify database was NOT modified
    const currentRole = mockDb.data['users'][testUid].role;
    assert.strictEqual(
      currentRole,
      'pengunjung',
      `Attack "${attack.name}" (${JSON.stringify(attack.value)}) breached role barrier! Role became: ${currentRole}`
    );

    // Verify no updates logged to RTDB
    const updatesSince = mockDb.updatesLog.slice(initialLogLen);
    assert.strictEqual(
      updatesSince.length,
      0,
      `Attack "${attack.name}" triggered database update: ${JSON.stringify(updatesSince)}`
    );

    rejectedCount++;
  }

  console.log(`  [PASS 2.1] Successfully blocked ${rejectedCount}/${maliciousPayloads.length} adversarial role injection vectors!`);

  // -------------------------------------------------------------
  // [Suite 3] Authorized Role Transition Matrix & Cascading Cleanup
  // -------------------------------------------------------------
  console.log('\n--- [Suite 3] Authorized Role Transitions & Cascading Cleanup ---');

  // 3.1 Transition to walas
  mockDb.reset();
  mockDb.data['users'] = {
    'uid_guru_1': {
      uid: 'uid_guru_1',
      email: 'guru1@smkn1sumedang.sch.id',
      nama: 'Guru Satu',
      role: 'guru',
      nip: '198109012009022003',
      isWalas: false
    }
  };
  await ubahRoleUser('uid_guru_1', 'walas');
  assert.strictEqual(mockDb.data['users']['uid_guru_1'].role, 'walas');
  assert.strictEqual(mockDb.data['users']['uid_guru_1'].isWalas, true);
  console.log('  [PASS 3.1] Transition to walas sets role: walas and isWalas: true.');

  // 3.2 Transition to guru
  await ubahRoleUser('uid_guru_1', 'guru');
  assert.strictEqual(mockDb.data['users']['uid_guru_1'].role, 'guru');
  assert.strictEqual(mockDb.data['users']['uid_guru_1'].isWalas, false);
  console.log('  [PASS 3.2] Transition to guru sets role: guru and isWalas: false.');

  // 3.3 Transition to siswa
  mockDb.data['users']['uid_siswa_1'] = {
    uid: 'uid_siswa_1',
    email: 'siswa1@gmail.com',
    nama: 'Siswa Satu',
    role: 'pengunjung'
  };
  await ubahRoleUser('uid_siswa_1', 'siswa');
  assert.strictEqual(mockDb.data['users']['uid_siswa_1'].role, 'siswa');
  console.log('  [PASS 3.3] Transition to siswa sets role: siswa.');

  // 3.4 Downgrade to pengunjung: Cascading credential & claim cleanup
  const emailVal = 'target_downgrade@smkn1sumedang.sch.id';
  const encodedEmail = emailVal.toLowerCase().replace(/\./g, ',').replace(/@/g, '(at)');
  mockDb.data['users']['uid_downgrade'] = {
    uid: 'uid_downgrade',
    email: emailVal,
    nama: 'Akun Lengkap',
    role: 'walas',
    nip: '198109012009022003',
    nisn: '0082104129',
    kelas: 'XII RPL 1',
    mapel: 'Pemrograman Web',
    isWalas: true,
    walasKelasId: 'XII RPL 1',
    isVerified: true
  };
  mockDb.data['guru_claimed'] = { '198109012009022003': { uid: 'uid_downgrade' } };
  mockDb.data['nisn_claimed'] = { '0082104129': { uid: 'uid_downgrade' } };
  mockDb.data['email_mapping'] = { [encodedEmail]: { uid: 'uid_downgrade' } };

  await ubahRoleUser('uid_downgrade', 'pengunjung');
  const downgraded = mockDb.data['users']['uid_downgrade'];
  assert.strictEqual(downgraded.role, 'pengunjung');
  assert.strictEqual(downgraded.nip, null);
  assert.strictEqual(downgraded.nisn, null);
  assert.strictEqual(downgraded.kelas, null);
  assert.strictEqual(downgraded.mapel, null);
  assert.strictEqual(downgraded.isWalas, null);
  assert.strictEqual(downgraded.walasKelasId, null);
  assert.strictEqual(downgraded.isVerified, false);

  // Verify external claimed nodes revoked
  assert.strictEqual(deepGet(mockDb.data, 'guru_claimed/198109012009022003'), undefined);
  assert.strictEqual(deepGet(mockDb.data, 'nisn_claimed/0082104129'), undefined);
  assert.strictEqual(deepGet(mockDb.data, 'email_mapping/' + encodedEmail), undefined);
  console.log('  [PASS 3.4] Downgrade to pengunjung thoroughly purges credentials & RTDB claim nodes.');

  // -------------------------------------------------------------
  // [Suite 4] Legacy Database Role Normalization via resolveUserVerification
  // -------------------------------------------------------------
  console.log('\n--- [Suite 4] Legacy Database Role Normalization ---');

  // 4.1 Legacy 'ortu' user with NO credentials -> normalized to 'pengunjung'
  mockDb.reset();
  const legacyOrtuNoCreds = {
    uid: 'uid_legacy_1',
    email: 'ortu_murni@gmail.com',
    nama: 'Bapak Subarjo',
    role: 'ortu'
  };
  const resolved1 = resolveUserVerification(Object.assign({}, legacyOrtuNoCreds), 'uid_legacy_1');
  assert.strictEqual(resolved1.role, 'pengunjung', 'Legacy ortu without creds must become pengunjung');
  assert.strictEqual(mockDb.data['users']['uid_legacy_1'].role, 'pengunjung', 'RTDB must be updated to pengunjung');
  console.log('  [PASS 4.1] Legacy ortu without credentials normalized to pengunjung.');

  // 4.2 Legacy 'ortu' user with student NISN -> normalized to 'siswa'
  const legacyOrtuWithNisn = {
    uid: 'uid_legacy_2',
    email: 'ortu_anak@gmail.com',
    nama: 'Bapak Ahmad',
    role: 'ortu',
    nisn: '0082104129' // RIZKY RAMADHANI (XII RPL 2)
  };
  const resolved2 = resolveUserVerification(Object.assign({}, legacyOrtuWithNisn), 'uid_legacy_2');
  assert.strictEqual(resolved2.role, 'siswa', 'Legacy ortu with student NISN must become siswa');
  assert.strictEqual(resolved2.nisn, '0082104129');
  assert.strictEqual(resolved2.kelas, 'XII RPL 2');
  console.log('  [PASS 4.2] Legacy ortu with valid student NISN normalized to siswa with class XII RPL 2.');

  // 4.3A Legacy 'ortu' user with non-walas teacher NIP -> normalized to 'guru'
  const legacyOrtuWithNipGuru = {
    uid: 'uid_legacy_3a',
    email: 'guru_legacy@smkn1sumedang.sch.id',
    nama: 'Ibu Hani',
    role: 'ortu',
    nip: '198109012009022003' // Hani Hanifah: isWalas is false
  };
  const resolved3a = resolveUserVerification(Object.assign({}, legacyOrtuWithNipGuru), 'uid_legacy_3a');
  assert.strictEqual(resolved3a.role, 'guru', 'Legacy ortu with non-walas teacher NIP must become guru');
  assert.strictEqual(resolved3a.nip, '198109012009022003');
  console.log('  [PASS 4.3A] Legacy ortu with non-walas teacher NIP normalized to guru.');

  // 4.3B Legacy 'ortu' user with walas teacher NIP -> normalized to 'walas'
  const legacyOrtuWithNipWalas = {
    uid: 'uid_legacy_3b',
    email: 'walas_legacy@smkn1sumedang.sch.id',
    nama: 'Pak Rijal',
    role: 'ortu',
    nip: '198312052022211017' // Rijal Nur Rahmat: isWalas is true (XII RPL 1)
  };
  const resolved3b = resolveUserVerification(Object.assign({}, legacyOrtuWithNipWalas), 'uid_legacy_3b');
  assert.strictEqual(resolved3b.role, 'walas', 'Legacy ortu with walas teacher NIP must become walas');
  assert.strictEqual(resolved3b.nip, '198312052022211017');
  assert.strictEqual(resolved3b.walasKelasId, 'XII RPL 1');
  console.log('  [PASS 4.3B] Legacy ortu with walas teacher NIP normalized to walas with class XII RPL 1.');

  // 4.4 Arbitrary corrupt role in DB (e.g. 'alien_role') -> normalized to 'pengunjung'
  const corruptRoleUser = {
    uid: 'uid_corrupt',
    email: 'corrupt@example.com',
    nama: 'User Corrupt',
    role: 'alien_role'
  };
  const resolved4 = resolveUserVerification(Object.assign({}, corruptRoleUser), 'uid_corrupt');
  assert.strictEqual(resolved4.role, 'pengunjung', 'Corrupt role must be normalized to pengunjung');
  console.log('  [PASS 4.4] Corrupt/unknown role normalized to pengunjung.');

  // 4.5 Robustness against null/undefined/non-object
  assert.strictEqual(resolveUserVerification(null, 'null_uid'), null);
  assert.strictEqual(resolveUserVerification(undefined, 'undef_uid'), undefined);
  assert.strictEqual(resolveUserVerification(12345, 'num_uid'), 12345);
  console.log('  [PASS 4.5] resolveUserVerification gracefully handles null, undefined, and non-object inputs.');

  // -------------------------------------------------------------
  // [Suite 5] UI Rendering & DOM Select Options Strict Compliance
  // -------------------------------------------------------------
  console.log('\n--- [Suite 5] UI Rendering & DOM Select Strict Options Compliance ---');

  mockDb.reset();
  mockTbody.children = [];

  const mixedUsers = {
    'u_tamu': { uid: 'u_tamu', email: 'tamu@gmail.com', nama: 'Tamu', role: 'pengunjung' },
    'u_legacy_ortu': { uid: 'u_legacy_ortu', email: 'ortu_old@gmail.com', nama: 'Orang Tua Lama', role: 'ortu' },
    'u_guru': { uid: 'u_guru', email: 'guru@sch.id', nama: 'Guru Resmi', role: 'guru', nip: '198109012009022003' },
    'u_walas': { uid: 'u_walas', email: 'ihsan33roblox@gmail.com', nama: 'Muhammad Echa Putra', role: 'pengunjung' },
    'u_siswa': { uid: 'u_siswa', email: '7dosabesar557@gmail.com', nama: 'M. Ihsan Athallah', role: 'pengunjung' },
    'u_hack': { uid: 'u_hack', email: 'hacker@dark.web', nama: 'Hacker', role: 'superadmin' }
  };

  renderTabelPengguna(mixedUsers);

  assert.strictEqual(mockTbody.children.length, 6, 'All 6 user rows must be rendered in table');

  let totalSelectsVerified = 0;
  mockTbody.children.forEach((tr, idx) => {
    const tdRole = tr.children[2];
    assert.ok(tdRole, `Row ${idx} must have role cell`);
    const select = tdRole.children[0];
    assert.ok(select, `Row ${idx} must contain select element`);
    assert.strictEqual(select.className, 'role-select');

    // Check options
    const optionValues = select.children.map(o => o.value);
    assert.deepStrictEqual(
      optionValues,
      ['pengunjung', 'guru', 'siswa', 'walas'],
      `Row ${idx} select options must strictly match permitted roles in order`
    );

    // Verify 'ortu' is completely absent from all options
    assert.strictEqual(optionValues.includes('ortu'), false);
    assert.strictEqual(select.children.some(o => o.textContent.toLowerCase().includes('ortu')), false);

    // Verify onchange hook exists
    assert.strictEqual(typeof select.onchange, 'function');

    totalSelectsVerified++;
  });

  console.log(`  [PASS 5.1] All ${totalSelectsVerified} rendered table rows strictly contain 4 permitted options and zero 'ortu'.`);

  // 5.2 Adversarial DOM Tampering: Attacker injects <option value="ortu"> into DOM and triggers onchange
  console.log('  [Subtest 5.2] Simulating client-side DOM injection of <option value="ortu">...');
  const firstTr = mockTbody.children[0];
  const selectEl = firstTr.children[2].children[0];

  // Attacker adds fake ortu option
  const fakeOption = new MockElement('option');
  fakeOption.value = 'ortu';
  fakeOption.textContent = 'ortu';
  selectEl.appendChild(fakeOption);
  selectEl.value = 'ortu';

  mockDb.reset();
  mockDb.data['users'] = { 'u_tamu': { uid: 'u_tamu', role: 'pengunjung' } };

  // Trigger onchange with tampered value
  selectEl.onchange();

  // Verify that backend ubahRoleUser rejected the tampered value
  assert.strictEqual(mockDb.data['users']['u_tamu'].role, 'pengunjung', 'Injected DOM value "ortu" must be rejected by handler');
  assert.strictEqual(mockDb.updatesLog.length, 0, 'No updates must be written for injected ortu option');
  console.log('  [PASS 5.2] Client-side DOM injection of <option value="ortu"> was successfully blocked by ubahRoleUser.');

  // -------------------------------------------------------------
  // [Suite 6] Invariant & Role Isolation Verification
  // -------------------------------------------------------------
  console.log('\n--- [Suite 6] School Invariant & Role Isolation Checks ---');

  // 6.1 Class list invariant
  assert.deepStrictEqual(DAFTAR_KELAS_RESMI, ['XII RPL 1', 'XII RPL 2', 'XII TKJ 1']);
  console.log('  [PASS 6.1] School class roster invariant strictly preserved (3 classes).');

  // 6.2 Student email 7dosabesar557@gmail.com escalation resistance
  const studentEmailUser = {
    uid: 'uid_ihsan_test',
    email: '7dosabesar557@gmail.com',
    nama: 'M. IHSAN ATHALLAH',
    role: 'admin' // Attempt illegal role escalation
  };
  const resolvedStudent = resolveUserVerification(studentEmailUser, 'uid_ihsan_test');
  assert.strictEqual(resolvedStudent.role, 'siswa', 'Student 7dosabesar557@gmail.com must NEVER be admin or teacher');
  assert.strictEqual(resolvedStudent.nisn, '0098263610');
  assert.strictEqual(resolvedStudent.kelas, 'XII RPL 2');
  console.log('  [PASS 6.2] Student 7dosabesar557@gmail.com role escalation to admin is completely defeated.');

  // 6.3 Teacher Muhammad Echa Putra linkage check
  const teacherEmailUser = {
    uid: 'uid_echa_test',
    email: 'ihsan33roblox@gmail.com',
    nama: 'Muhammad Echa Putra',
    role: 'pengunjung'
  };
  const resolvedTeacher = resolveUserVerification(teacherEmailUser, 'uid_echa_test');
  assert.strictEqual(resolvedTeacher.role, 'walas');
  assert.strictEqual(resolvedTeacher.nip, '199209142022211007');
  assert.strictEqual(resolvedTeacher.walasKelasId, 'XII RPL 2');
  console.log('  [PASS 6.3] Teacher Muhammad Echa Putra (ihsan33roblox@gmail.com) verified with NIP 199209142022211007.');

  console.log('\n===================================================================');
  console.log('🏆 ALL ADVERSARIAL CHALLENGES PASSED! VERDICT: 100% SECURE & COMPLIANT');
  console.log('===================================================================');
}

runAdversarialChallenge().catch(err => {
  console.error('\n💥 ADVERSARIAL CHALLENGE FAILURE:', err);
  process.exit(1);
});
