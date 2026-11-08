// ===================================================================
// ADVERSARIAL EMPIRICAL TEST SUITE: test-challenger2-verification-sync-adversarial.js
// Author: Challenger 2 (Verification Sync Adversarial Challenger)
// Purpose: Empirically stress-test teacher/student verification sync in admin.js,
//          case/trim insensitivity, role & class invariants, two-way RTDB persistence,
//          and privilege escalation resistance for 7dosabesar557@gmail.com.
// ===================================================================

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('===================================================================');
console.log('🔥 STARTING CHALLENGER 2 ADVERSARIAL VERIFICATION SYNC SUITE');
console.log('===================================================================\n');

// -------------------------------------------------------------
// Setup Mock DOM & Environment
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
  setsLog: [],
  reset() {
    this.data = {};
    this.updatesLog = [];
    this.removesLog = [];
    this.setsLog = [];
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
    this.callback = cb;
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
    mockDb.setsLog.push({ path: this.path, val });
    deepSet(mockDb.data, this.path, val);
    return val;
  }
  async update(val) {
    mockDb.updatesLog.push({ path: this.path, val });
    deepSet(mockDb.data, this.path, val);
    return val;
  }
  async remove() {
    mockDb.removesLog.push({ path: this.path });
    deepDelete(mockDb.data, this.path);
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

// Global confirm and alert mocks
global.confirm = () => true;
global.alert = () => {};

// Load Official School Master Rosters
const { MASTER_GURU_RESMI, MASTER_DATA_SISWA_RESMI, DAFTAR_KELAS_RESMI, normalisasiKelas } = require('../assets/firebase-config.js');
global.MASTER_GURU_RESMI = MASTER_GURU_RESMI;
global.MASTER_DATA_SISWA_RESMI = MASTER_DATA_SISWA_RESMI;
global.DAFTAR_KELAS_RESMI = DAFTAR_KELAS_RESMI;
global.normalisasiKelas = normalisasiKelas;
global.window.MASTER_GURU_RESMI = MASTER_GURU_RESMI;
global.window.MASTER_DATA_SISWA_RESMI = MASTER_DATA_SISWA_RESMI;
global.window.DAFTAR_KELAS_RESMI = DAFTAR_KELAS_RESMI;
global.window.normalisasiKelas = normalisasiKelas;

// Load auth.js
const authCode = fs.readFileSync(path.join(__dirname, '../assets/auth.js'), 'utf8');
eval(authCode);

// Load admin.js
const adminCode = fs.readFileSync(path.join(__dirname, '../assets/admin.js'), 'utf8');
eval(adminCode);

async function runAdversarialSyncSuite() {
  console.log('--- [Suite 1] Teacher Auto-Linkage & Role/Class Resolution ---');

  // 1.1 Muhammad Echa Putra, S.Kom.Gr (ihsan33roblox@gmail.com)
  mockDb.reset();
  const unlinkedEcha = {
    uid: 'uid_echa_adversarial',
    email: 'ihsan33roblox@gmail.com',
    nama: 'Muhammad Echa Putra',
    role: 'pengunjung',
    nip: null,
    isVerified: false
  };

  const resolvedEcha = resolveUserVerification(Object.assign({}, unlinkedEcha), 'uid_echa_adversarial');

  assert.strictEqual(resolvedEcha.role, 'walas', 'Echa must be resolved to role walas');
  assert.strictEqual(resolvedEcha.nip, '199209142022211007', 'Echa NIP must be 199209142022211007');
  assert.strictEqual(resolvedEcha.isWalas, true, 'Echa isWalas flag must be true');
  assert.strictEqual(resolvedEcha.walasKelasId, 'XII RPL 2', 'Echa walas class must be XII RPL 2');
  assert.strictEqual(resolvedEcha.isVerified, true, 'isVerified must be true');
  assert.strictEqual(resolvedEcha.nisn, undefined, 'Teacher record must not contain nisn');
  assert.strictEqual(resolvedEcha.kelas, undefined, 'Teacher record must not contain student kelas');

  // Check RTDB synchronization for Echa
  const userUpdateEcha = mockDb.updatesLog.find(u => u.path === 'users/uid_echa_adversarial');
  assert.ok(userUpdateEcha, 'RTDB update must be dispatched to users/uid_echa_adversarial');
  assert.strictEqual(userUpdateEcha.val.role, 'walas');
  assert.strictEqual(userUpdateEcha.val.nip, '199209142022211007');
  assert.strictEqual(userUpdateEcha.val.isWalas, true);
  assert.strictEqual(userUpdateEcha.val.walasKelasId, 'XII RPL 2');
  assert.strictEqual(userUpdateEcha.val.isVerified, true);
  assert.strictEqual(userUpdateEcha.val.nisn, null);
  assert.strictEqual(userUpdateEcha.val.kelas, null);

  const guruClaimedUpdate = mockDb.updatesLog.find(u => u.path === 'guru_claimed/199209142022211007');
  assert.ok(guruClaimedUpdate, 'guru_claimed node must be updated for Echa');
  assert.strictEqual(guruClaimedUpdate.val.role, 'walas');

  // Test DOM Table Rendering for Echa
  mockTbody.children = [];
  renderTabelPengguna({ 'uid_echa_adversarial': resolvedEcha });
  assert.strictEqual(mockTbody.children.length, 1);
  const rowEcha = mockTbody.children[0];

  const roleSelectEcha = rowEcha.children[2].children[0];
  assert.strictEqual(roleSelectEcha.className, 'role-select');
  assert.strictEqual(roleSelectEcha.children.length, 4, 'Must have strictly 4 options in role select');
  assert.ok(!roleSelectEcha.children.some(o => o.value === 'ortu'), 'No ortu option allowed');
  const selectedEchaOpt = roleSelectEcha.children.find(o => o.selected);
  assert.strictEqual(selectedEchaOpt.value, 'walas', 'Selected role must be walas');

  const statusColEcha = rowEcha.children[3];
  assert.ok(!statusColEcha.innerHTML.includes('- Belum Tertaut'), 'Echa must NOT render as - Belum Tertaut');
  assert.ok(statusColEcha.innerHTML.includes('199209142022211007'), 'Status column must display NIP');
  assert.ok(statusColEcha.innerHTML.includes('Walas XII RPL 2'), 'Status badge must display Walas XII RPL 2');
  assert.ok(statusColEcha.innerHTML.includes('✓ NIP: 199209142022211007 (Walas XII RPL 2)'), 'Full badge text match');

  const actionColEcha = rowEcha.children[4];
  assert.ok(actionColEcha.children.some(b => b.innerHTML.includes('Lepas NIP')), 'Action column must provide Lepas NIP');

  console.log('  [PASS 1.1] Muhammad Echa Putra auto-links to NIP 199209142022211007, walas, XII RPL 2 with correct badge.');

  // 1.2 Walas vs Non-Walas Teacher Differentiation
  // Test Non-Walas Teacher: Hani Hanifah, S.Si (198109012009022003)
  const unlinkedHani = {
    uid: 'uid_hani',
    email: 'hani@smkn1sumedang.sch.id',
    nama: 'Hani Hanifah',
    role: 'pengunjung',
    nip: null
  };
  const resolvedHani = resolveUserVerification(Object.assign({}, unlinkedHani), 'uid_hani');
  assert.strictEqual(resolvedHani.role, 'guru', 'Hani Hanifah must resolve to role guru (not walas)');
  assert.strictEqual(resolvedHani.nip, '198109012009022003');
  assert.strictEqual(resolvedHani.isWalas, false);

  mockTbody.children = [];
  renderTabelPengguna({ 'uid_hani': resolvedHani });
  const statusColHani = mockTbody.children[0].children[3];
  assert.ok(statusColHani.innerHTML.includes('✓ NIP: 198109012009022003 (Guru)'), 'Non-walas badge must display (Guru)');

  // Test Walas Teacher: Rijal Nur Rahmat, S.T (198312052022211017)
  const unlinkedRijal = {
    uid: 'uid_rijal',
    email: 'rijal@smkn1sumedang.sch.id',
    nama: 'Rijal Nur Rahmat',
    role: 'pengunjung',
    nip: null
  };
  const resolvedRijal = resolveUserVerification(Object.assign({}, unlinkedRijal), 'uid_rijal');
  assert.strictEqual(resolvedRijal.role, 'walas', 'Rijal must resolve to role walas');
  assert.strictEqual(resolvedRijal.walasKelasId, 'XII RPL 1');
  assert.strictEqual(resolvedRijal.isWalas, true);

  mockTbody.children = [];
  renderTabelPengguna({ 'uid_rijal': resolvedRijal });
  const statusColRijal = mockTbody.children[0].children[3];
  assert.ok(statusColRijal.innerHTML.includes('✓ NIP: 198312052022211017 (Walas XII RPL 1)'), 'Walas badge must display Walas XII RPL 1');

  console.log('  [PASS 1.2] Teacher roles (guru vs walas) and class badges are accurately differentiated.\n');

  // -------------------------------------------------------------
  // [Suite 2] Case Insensitivity & Whitespace Resiliency
  // -------------------------------------------------------------
  console.log('--- [Suite 2] Case Insensitivity & Whitespace Resiliency (Trimming) ---');

  // 2.1 Adversarial Teacher Email with mixed case, spaces, tabs
  const noisyTeacherEmails = [
    '  IHSAN33ROBLOX@GMAIL.COM  ',
    'ihsan33roblox@gmail.com ',
    ' Ihsan33Roblox@Gmail.Com ',
    '\tihsan33roblox@gmail.com\n'
  ];

  noisyTeacherEmails.forEach((emailVariant, idx) => {
    const user = { uid: `uid_echa_variant_${idx}`, email: emailVariant, role: 'pengunjung' };
    const res = resolveUserVerification(user, `uid_echa_variant_${idx}`);
    assert.strictEqual(res.role, 'walas', `Variant ${emailVariant} must resolve to walas`);
    assert.strictEqual(res.nip, '199209142022211007', `Variant ${emailVariant} must resolve to NIP 199209142022211007`);
    assert.strictEqual(res.walasKelasId, 'XII RPL 2');
  });
  console.log('  [PASS 2.1] Echa email variations (uppercase, spaces, tabs, newlines) pass 100%.');

  // 2.2 Other Teachers with whitespace/uppercase
  const noisyHani = { uid: 'uid_h_noise', email: '  HANI.HANIFAH@GMAIL.COM  ', role: 'pengunjung' };
  const resHaniNoise = resolveUserVerification(noisyHani, 'uid_h_noise');
  assert.strictEqual(resHaniNoise.role, 'guru');
  assert.strictEqual(resHaniNoise.nip, '198109012009022003');

  const noisyRijal = { uid: 'uid_r_noise', email: '  RIJAL@GMAIL.COM  ', role: 'pengunjung' };
  const resRijalNoise = resolveUserVerification(noisyRijal, 'uid_r_noise');
  assert.strictEqual(resRijalNoise.role, 'walas');
  assert.strictEqual(resRijalNoise.nip, '198312052022211017');
  console.log('  [PASS 2.2] All teacher rosters resolve accurately under adversarial whitespace/casing.');

  // 2.3 Student Email with mixed case & spaces
  const noisyStudentEmails = [
    '  7DOSABESAR557@GMAIL.COM  ',
    '7dosabesar557@gmail.com ',
    ' 7DosaBesar557@Gmail.com\t',
    '  RIZKYRAMADHANI@GMAIL.COM  '
  ];

  const resIhsanNoise = resolveUserVerification({ uid: 'uid_i1', email: noisyStudentEmails[0], role: 'pengunjung' }, 'uid_i1');
  assert.strictEqual(resIhsanNoise.role, 'siswa');
  assert.strictEqual(resIhsanNoise.nisn, '0098263610');
  assert.strictEqual(resIhsanNoise.kelas, 'XII RPL 2');

  const resIhsanNoise2 = resolveUserVerification({ uid: 'uid_i2', email: noisyStudentEmails[2], role: 'pengunjung' }, 'uid_i2');
  assert.strictEqual(resIhsanNoise2.role, 'siswa');
  assert.strictEqual(resIhsanNoise2.nisn, '0098263610');

  const resRizkyNoise = resolveUserVerification({ uid: 'uid_r1', email: noisyStudentEmails[3], role: 'pengunjung' }, 'uid_r1');
  assert.strictEqual(resRizkyNoise.role, 'siswa');
  assert.strictEqual(resRizkyNoise.nisn, '0082104129');
  assert.strictEqual(resRizkyNoise.kelas, 'XII RPL 2');
  console.log('  [PASS 2.3] Student emails resolve accurately under adversarial whitespace/casing.\n');

  // -------------------------------------------------------------
  // [Suite 3] Student Account & Role Isolation (M. Ihsan Athallah - 7dosabesar557@gmail.com)
  // -------------------------------------------------------------
  console.log('--- [Suite 3] Student Account & Role Isolation (M. Ihsan Athallah) ---');

  // 3.1 Normal unlinked student resolution
  mockDb.reset();
  const unlinkedIhsan = {
    uid: 'uid_ihsan_student',
    email: '7dosabesar557@gmail.com',
    nama: 'Ihsan Athallah',
    role: 'pengunjung',
    nisn: null
  };
  const resolvedIhsan = resolveUserVerification(Object.assign({}, unlinkedIhsan), 'uid_ihsan_student');
  assert.strictEqual(resolvedIhsan.role, 'siswa');
  assert.strictEqual(resolvedIhsan.nisn, '0098263610');
  assert.strictEqual(resolvedIhsan.kelas, 'XII RPL 2');
  assert.strictEqual(resolvedIhsan.isVerified, true);

  mockTbody.children = [];
  renderTabelPengguna({ 'uid_ihsan_student': resolvedIhsan });
  const rowIhsan = mockTbody.children[0];
  const statusColIhsan = rowIhsan.children[3];
  assert.ok(statusColIhsan.innerHTML.includes('✓ NISN: 0098263610 (XII RPL 2)'));
  assert.ok(rowIhsan.children[4].children.some(b => b.innerHTML.includes('Lepas NISN')));
  console.log('  [PASS 3.1] M. Ihsan Athallah correctly auto-links to NISN 0098263610, XII RPL 2, role siswa.');

  // 3.2 Hostile Attack: Admin role escalation attempt
  const hostileAdminIhsan = {
    uid: 'uid_ihsan_hacked',
    email: '7dosabesar557@gmail.com',
    nama: 'M. IHSAN ATHALLAH',
    role: 'admin' // Malicious attempt to escalate to admin
  };
  const resolvedHostileAdmin = resolveUserVerification(Object.assign({}, hostileAdminIhsan), 'uid_ihsan_hacked');
  assert.strictEqual(resolvedHostileAdmin.role, 'siswa', '7dosabesar557@gmail.com CANNOT remain admin; must resolve to siswa');
  assert.strictEqual(resolvedHostileAdmin.nisn, '0098263610');
  assert.strictEqual(resolvedHostileAdmin.kelas, 'XII RPL 2');

  const adminPurgeUpdate = mockDb.updatesLog.find(u => u.path === 'users/uid_ihsan_hacked');
  assert.ok(adminPurgeUpdate, 'Database update must overwrite malicious admin role');
  assert.strictEqual(adminPurgeUpdate.val.role, 'siswa');
  console.log('  [PASS 3.2] Malicious admin role escalation on 7dosabesar557@gmail.com is completely thwarted.');

  // 3.3 Hostile Attack: Teacher/NIP spoofing injection attempt
  const hostileTeacherIhsan = {
    uid: 'uid_ihsan_spoofed',
    email: '7dosabesar557@gmail.com',
    nama: 'M. IHSAN ATHALLAH',
    role: 'walas',
    nip: '199209142022211007', // Injected Echa's NIP
    isWalas: true,
    walasKelasId: 'XII RPL 2'
  };
  const resolvedHostileTeacher = resolveUserVerification(Object.assign({}, hostileTeacherIhsan), 'uid_ihsan_spoofed');
  assert.strictEqual(resolvedHostileTeacher.role, 'siswa', '7dosabesar557@gmail.com must NEVER become walas or guru');
  assert.strictEqual(resolvedHostileTeacher.nisn, '0098263610');
  assert.strictEqual(resolvedHostileTeacher.nip, undefined, 'Spoofed nip must be deleted');
  assert.strictEqual(resolvedHostileTeacher.isWalas, undefined, 'Spoofed isWalas must be deleted');
  assert.strictEqual(resolvedHostileTeacher.walasKelasId, undefined, 'Spoofed walasKelasId must be deleted');

  const teacherPurgeUpdate = mockDb.updatesLog.find(u => u.path === 'users/uid_ihsan_spoofed');
  assert.ok(teacherPurgeUpdate, 'Database update must clear spoofed teacher attributes');
  assert.strictEqual(teacherPurgeUpdate.val.nip, null);
  assert.strictEqual(teacherPurgeUpdate.val.isWalas, null);
  assert.strictEqual(teacherPurgeUpdate.val.walasKelasId, null);
  assert.strictEqual(teacherPurgeUpdate.val.role, 'siswa');
  console.log('  [PASS 3.3] Spoofed teacher/NIP attributes on 7dosabesar557@gmail.com are completely purged.');

  // 3.4 Hostile Attack: Direct ubahRoleUser escalation attempt
  await ubahRoleUser('uid_ihsan_student', 'admin');
  assert.ok(!mockDb.updatesLog.some(u => u.path === 'users/uid_ihsan_student' && u.val.role === 'admin'), 'admin role cannot be set via ubahRoleUser');
  await ubahRoleUser('uid_ihsan_student', 'ortu');
  assert.ok(!mockDb.updatesLog.some(u => u.path === 'users/uid_ihsan_student' && u.val.role === 'ortu'), 'ortu role cannot be set via ubahRoleUser');
  console.log('  [PASS 3.4] ubahRoleUser strictly blocks invalid role transitions on student account.\n');

  // -------------------------------------------------------------
  // [Suite 4] Class Scope & Invariant Preservation
  // -------------------------------------------------------------
  console.log('--- [Suite 4] Class Scope & Invariant Preservation ---');

  // 4.1 Strict 3 official classes check
  assert.strictEqual(DAFTAR_KELAS_RESMI.length, 3);
  assert.deepStrictEqual(DAFTAR_KELAS_RESMI, ['XII RPL 1', 'XII RPL 2', 'XII TKJ 1']);

  // Verify all 70 students in MASTER_DATA_SISWA_RESMI belong exclusively to official classes
  for (const [nisn, student] of Object.entries(MASTER_DATA_SISWA_RESMI)) {
    assert.ok(
      DAFTAR_KELAS_RESMI.includes(student.kelas),
      `Student ${nisn} (${student.nama}) has non-official class: ${student.kelas}`
    );
  }
  console.log('  [PASS 4.1] All 70 official students belong strictly to the 3 official classes.');

  // 4.2 Normalization function tests
  assert.strictEqual(normalisasiKelas('12 RPL 1'), 'XII RPL 1');
  assert.strictEqual(normalisasiKelas('xii rpl 2'), 'XII RPL 2');
  assert.strictEqual(normalisasiKelas('KELAS XII TKJ 1'), 'XII TKJ 1');
  assert.strictEqual(normalisasiKelas('XII-RPL-1'), 'XII RPL 1');
  assert.strictEqual(normalisasiKelas('12_TKJ_1'), 'XII TKJ 1');
  console.log('  [PASS 4.2] normalisasiKelas correctly standardizes class naming variants.');

  // 4.3 Static HTML dropdown audits
  const adminHtml = fs.readFileSync(path.join(__dirname, '../admin.html'), 'utf8');
  assert.ok(!adminHtml.includes('PPLG'), 'admin.html must never contain non-existent class PPLG');
  assert.ok(!adminHtml.includes('XII TKJ 2'), 'admin.html must never contain non-existent class XII TKJ 2');
  assert.ok(!adminHtml.includes('Kelas 10'), 'admin.html must never contain Kelas 10');
  assert.ok(!adminHtml.includes('Kelas 11'), 'admin.html must never contain Kelas 11');
  console.log('  [PASS 4.3] admin.html contains zero traces of non-existent or obsolete classes.\n');

  // -------------------------------------------------------------
  // [Suite 5] Two-Way Synchronization to Firebase RTDB (/users/{uid})
  // -------------------------------------------------------------
  console.log('--- [Suite 5] Two-Way Synchronization to Firebase RTDB (/users/{uid}) ---');

  // 5.1 Verification that changes trigger RTDB writes
  mockDb.reset();
  const unlinkedUser = {
    uid: 'uid_test_sync',
    email: 'ihsan33roblox@gmail.com',
    role: 'pengunjung',
    nip: null
  };
  resolveUserVerification(unlinkedUser, 'uid_test_sync');
  assert.strictEqual(mockDb.updatesLog.length, 3, 'Must trigger 3 updates: users/{uid}, guru_claimed, guru');
  assert.strictEqual(mockDb.updatesLog[0].path, 'users/uid_test_sync');

  // 5.2 Idempotence Check: Already synchronized record must NOT spam RTDB
  mockDb.reset();
  const syncedUser = {
    uid: 'uid_already_synced',
    email: 'ihsan33roblox@gmail.com',
    nama: 'Muhammad Echa Putra, S.Kom.Gr',
    role: 'walas',
    nip: '199209142022211007',
    mapel: 'Basis Data & Pemodelan RPL',
    isWalas: true,
    walasKelasId: 'XII RPL 2',
    isVerified: true
  };
  resolveUserVerification(syncedUser, 'uid_already_synced');
  assert.strictEqual(mockDb.updatesLog.length, 0, 'Idempotent resolve must NOT issue duplicate DB updates');
  console.log('  [PASS 5.2] Verification resolution is fully idempotent and prevents DB update loops.');

  // 5.3 Unlink Handlers Two-Way Sync
  mockDb.reset();
  await lepasTautanNipAdmin('uid_echa_unlink', '199209142022211007', 'ihsan33roblox@gmail.com');
  assert.ok(mockDb.updatesLog.some(u => u.path === 'users/uid_echa_unlink' && u.val.role === 'pengunjung' && u.val.nip === null));
  assert.ok(mockDb.removesLog.some(r => r.path === 'guru_claimed/199209142022211007'));
  assert.ok(mockDb.removesLog.some(r => r.path === 'email_mapping/ihsan33roblox(at)gmail,com'));
  console.log('  [PASS 5.3] lepasTautanNipAdmin propagates cleanups across users, guru_claimed, and email_mapping.');

  mockDb.reset();
  await lepasTautanNisnAdmin('uid_ihsan_unlink', '0098263610', '7dosabesar557@gmail.com');
  assert.ok(mockDb.updatesLog.some(u => u.path === 'users/uid_ihsan_unlink' && u.val.role === 'pengunjung' && u.val.nisn === null));
  assert.ok(mockDb.removesLog.some(r => r.path === 'nisn_claimed/0098263610'));
  assert.ok(mockDb.removesLog.some(r => r.path === 'email_mapping/7dosabesar557(at)gmail,com'));
  console.log('  [PASS 5.4] lepasTautanNisnAdmin propagates cleanups across users, nisn_claimed, and email_mapping.\n');

  // -------------------------------------------------------------
  // [Suite 6] Edge Cases, Null Safety, & Corrupt Data Resistance
  // -------------------------------------------------------------
  console.log('--- [Suite 6] Edge Cases, Null Safety, & Corrupt Data Resistance ---');

  // 6.1 Null, undefined, primitive inputs
  assert.strictEqual(resolveUserVerification(null, 'u_null'), null);
  assert.strictEqual(resolveUserVerification(undefined, 'u_undef'), undefined);
  assert.strictEqual(resolveUserVerification('string', 'u_str'), 'string');
  assert.strictEqual(resolveUserVerification(42, 'u_num'), 42);

  // 6.2 Pure guest with no credentials
  const pureGuest = { uid: 'uid_guest', email: 'guest@example.com', role: 'pengunjung' };
  const resGuest = resolveUserVerification(Object.assign({}, pureGuest), 'uid_guest');
  assert.strictEqual(resGuest.role, 'pengunjung');
  assert.strictEqual(resGuest.nip, undefined);
  assert.strictEqual(resGuest.nisn, undefined);

  mockTbody.children = [];
  renderTabelPengguna({ 'uid_guest': resGuest });
  assert.ok(mockTbody.children[0].children[3].innerHTML.includes('- Belum Tertaut'));

  // 6.3 Corrupt role without credentials -> normalized to pengunjung
  mockDb.reset();
  const corruptUser = { uid: 'uid_corrupt', email: 'unknown@example.com', role: 'hacker' };
  const resCorrupt = resolveUserVerification(Object.assign({}, corruptUser), 'uid_corrupt');
  assert.strictEqual(resCorrupt.role, 'pengunjung', 'Corrupt role must normalize to pengunjung');
  assert.ok(mockDb.updatesLog.some(u => u.path === 'users/uid_corrupt' && u.val.role === 'pengunjung'));

  // 6.4 zemapk16 sanitization invariant
  mockDb.reset();
  const zemapk = { uid: 'uid_zemapk', email: 'zemapk16@gmail.com', role: 'siswa', nisn: '0098263610', nama: 'M. IHSAN ATHALLAH' };
  const resZemapk = resolveUserVerification(Object.assign({}, zemapk), 'uid_zemapk');
  assert.strictEqual(resZemapk.role, 'pengunjung');
  assert.strictEqual(resZemapk.nisn, null);
  assert.strictEqual(resZemapk.nama, 'Pengunjung');
  assert.ok(mockDb.updatesLog.some(u => u.path === 'users/uid_zemapk' && u.val.role === 'pengunjung'));
  assert.ok(mockDb.removesLog.some(r => r.path === 'email_mapping/zemapk16(at)gmail,com'));
  console.log('  [PASS 6.4] zemapk16 auto-cleanup invariant properly enforced.');

  console.log('\n===================================================================');
  console.log('🎉 ALL CHALLENGER 2 ADVERSARIAL STRESS TESTS PASSED 100%! (6/6)');
  console.log('===================================================================');
}

runAdversarialSyncSuite().catch(err => {
  console.error('\n❌ ADVERSARIAL CHALLENGE FAILED:', err);
  process.exit(1);
});
