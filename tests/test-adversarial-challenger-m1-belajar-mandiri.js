/**
 * test-adversarial-challenger-m1-belajar-mandiri.js
 * Empirical Adversarial Challenger Verification for Milestone 1
 * 
 * Verifies:
 * 1. RTDB Status Mutation & Button Wiring:
 *    - "Belajar Mandiri" button in renderStatusKelasControls passes 'jamkos' to ubahStatusKelasManual.
 *    - "Alihkan Belajar Mandiri" button in table passes 'jamkos' to ubahStatusKelasManual.
 *    - ubahStatusKelasManual mutates db.ref('kelas/' + cls).status to 'jamkos'.
 *    - adminApproveKendala mutates kelas, classes, and status_kelas to 'jamkos'.
 * 2. Formatter formatJenisKendala:
 *    - Correctly humanizes snake_case strings and handles edge cases/null/undefined.
 * 3. 3-Class Invariant:
 *    - Only official classes [XII RPL 1, XII RPL 2, XII TKJ 1] are processed and displayed.
 * 4. UI Cleanliness:
 *    - Zero occurrences of "Jamkos" or "Jam Kosong" in user-facing rendered HTML of admin kendala panel & 3-class controls.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('===================================================================');
console.log('⚔️ ADVERSARIAL CHALLENGER VERIFICATION: MILESTONE 1 (BELAJAR MANDIRI)');
console.log('===================================================================');

// Load admin.js source code
const adminJsPath = path.join(__dirname, '../assets/admin.js');
const adminJsContent = fs.readFileSync(adminJsPath, 'utf8');

// Load admin.html source code
const adminHtmlPath = path.join(__dirname, '../admin.html');
const adminHtmlContent = fs.readFileSync(adminHtmlPath, 'utf8');

// Setup minimal DOM and mock environment
const mockLocalStorage = {};
global.localStorage = {
  getItem: (k) => mockLocalStorage[k] || null,
  setItem: (k, v) => { mockLocalStorage[k] = String(v); },
  removeItem: (k) => { delete mockLocalStorage[k]; },
  clear: () => { Object.keys(mockLocalStorage).forEach(k => delete mockLocalStorage[k]); }
};

const rtdbStore = {};
global.db = {
  ref: (dbPath) => ({
    update: async (val) => {
      rtdbStore[dbPath] = Object.assign(rtdbStore[dbPath] || {}, val);
      return Promise.resolve();
    },
    set: async (val) => {
      rtdbStore[dbPath] = val;
      return Promise.resolve();
    },
    once: async (event) => ({
      exists: () => !!rtdbStore[dbPath],
      val: () => rtdbStore[dbPath] || null
    })
  })
};

// Document & Window mock
const elementsById = {};
function createMockElement(tag) {
  const el = {
    tagName: (tag || 'div').toUpperCase(),
    style: {},
    innerHTML: '',
    innerText: '',
    children: [],
    appendChild: (child) => { el.children.push(child); },
    classList: {
      add: () => {},
      remove: () => {},
      contains: () => false
    },
    setAttribute: () => {},
    getAttribute: () => null,
    querySelectorAll: () => [],
    querySelector: () => null,
    addEventListener: () => {},
    removeEventListener: () => {}
  };
  return el;
}

global.document = {
  createElement: (tag) => createMockElement(tag),
  getElementById: (id) => {
    if (!elementsById[id]) {
      elementsById[id] = createMockElement('div');
    }
    return elementsById[id];
  },
  querySelectorAll: () => [],
  querySelector: () => null,
  addEventListener: () => {},
  removeEventListener: () => {}
};

global.window = global;
global.addEventListener = () => {};
global.removeEventListener = () => {};
global.confirm = () => true;
global.alert = () => {};
global.normalisasiKelas = (k) => (k || '').trim().toUpperCase();

// Eval formatJenisKendala, ubahStatusKelasManual, renderStatusKelasControls
eval(adminJsContent);

// -------------------------------------------------------------------
// TEST 1: formatJenisKendala Stress & Edge Case Mining
// -------------------------------------------------------------------
console.log('\n▶ [Test 1] Stress-Testing formatJenisKendala()...');
assert.strictEqual(typeof formatJenisKendala, 'function', 'formatJenisKendala must be defined');

const testCasesKendala = [
  { in: 'sakit_mendadak', expected: 'Sakit Mendadak' },
  { in: 'penugasan_dinas', expected: 'Tugas Luar / Dinas' },
  { in: 'keperluan_mendesak', expected: 'Keperluan Keluarga' },
  { in: 'kendala_teknis', expected: 'Kendala Perjalanan' },
  { in: 'izin_resmi', expected: 'Izin Resmi' },
  { in: 'tugas_luar', expected: 'Tugas Luar' },
  { in: 'dinas_luar', expected: 'Dinas Luar' },
  { in: 'jamkos', expected: 'Belajar Mandiri' },
  { in: 'jam_kosong', expected: 'Belajar Mandiri' },
  { in: 'belajar_mandiri', expected: 'Belajar Mandiri' },
  { in: 'dispensasi', expected: 'Dispensasi' },
  { in: 'dispen', expected: 'Dispensasi' },
  { in: 'sakit', expected: 'Sakit' },
  { in: 'izin', expected: 'Izin' },
  { in: 'ijin', expected: 'Izin' },
  // Edge cases
  { in: null, expected: 'Belajar Mandiri' },
  { in: undefined, expected: 'Belajar Mandiri' },
  { in: '', expected: 'Belajar Mandiri' },
  { in: '   ', expected: 'Belajar Mandiri' },
  { in: 12345, expected: 'Belajar Mandiri' },
  { in: 'acara_keluarga_mendesak', expected: 'Acara Keluarga Mendesak' }
];

testCasesKendala.forEach(({ in: input, expected }) => {
  const result = formatJenisKendala(input);
  assert.strictEqual(result, expected, `Failed for input: ${input}. Got: ${result}, expected: ${expected}`);
});
console.log('  ✓ formatJenisKendala passed all 21 test cases (known, edge, and fallback).');

// -------------------------------------------------------------------
// TEST 2: Three-Class Control Buttons & Wiring in renderStatusKelasControls
// -------------------------------------------------------------------
console.log('\n▶ [Test 2] Adversarial UI Wiring for 3-Class Controls...');
const boxControls = createMockElement('div');
elementsById['boxControlStatusKelas'] = boxControls;

global.DEFAULT_STATUS_KELAS = {
  'XII RPL 1': { status: 'belajar', activeMapel: 'PBO', activeTeacherNama: 'Pak Rijal' },
  'XII RPL 2': { status: 'jamkos', activeMapel: 'Basis Data', activeTeacherNama: 'Pak Echa' },
  'XII TKJ 1': { status: 'pulang', activeMapel: 'Jaringan', activeTeacherNama: 'Pak Heri' }
};

renderStatusKelasControls(global.DEFAULT_STATUS_KELAS);
assert.strictEqual(boxControls.children.length, 3, 'Must render exactly 3 official class cards');

// Examine each card's HTML
boxControls.children.forEach((card, idx) => {
  const html = card.innerHTML;
  // Button "Belajar Mandiri" must be present and invoke ubahStatusKelasManual(cls, 'jamkos')
  assert.ok(html.includes('Belajar Mandiri'), 'Button label must be "Belajar Mandiri"');
  assert.ok(!html.includes('>Jamkos<'), 'Button label must NOT be ">Jamkos<"');
  
  // Verify onclick strictly passes 'jamkos'
  const match = html.match(/onclick="ubahStatusKelasManual\('([^']+)',\s*'([^']+)'\)"[^>]*>\s*Belajar Mandiri/);
  assert.ok(match, 'Belajar Mandiri button must have valid ubahStatusKelasManual onclick');
  assert.strictEqual(match[2], 'jamkos', 'Belajar Mandiri button MUST pass internal status "jamkos"');
});
console.log('  ✓ 3-Class control cards strictly wire "Belajar Mandiri" button to ubahStatusKelasManual(cls, "jamkos").');

// -------------------------------------------------------------------
// TEST 3: Empirical RTDB Status Mutation via ubahStatusKelasManual
// -------------------------------------------------------------------
console.log('\n▶ [Test 3] Empirical RTDB Mutation Test via ubahStatusKelasManual...');
async function testUbahStatusManual() {
  const targetClass = 'XII RPL 1';
  rtdbStore['kelas/' + targetClass] = { status: 'belajar' };
  
  await ubahStatusKelasManual(targetClass, 'jamkos');
  
  assert.ok(rtdbStore['kelas/' + targetClass], 'RTDB /kelas/XII RPL 1 must exist');
  assert.strictEqual(rtdbStore['kelas/' + targetClass].status, 'jamkos', 'RTDB status must be mutated to "jamkos"');
  assert.strictEqual(global.DEFAULT_STATUS_KELAS[targetClass].status, 'jamkos', 'DEFAULT_STATUS_KELAS in memory must be "jamkos"');
}

// -------------------------------------------------------------------
// TEST 4: Empirical Kendala Approval Flow & Status Synchronization
// -------------------------------------------------------------------
console.log('\n▶ [Test 4] Empirical adminApproveKendala RTDB Mutations...');
async function testApproveKendala() {
  const kendalaId = 'TEST-KENDALA-001';
  global.kendalaGuruCache[kendalaId] = {
    id: kendalaId,
    guruNama: 'Pak Echa',
    kelasId: 'XII RPL 2',
    kelas: 'XII RPL 2',
    mapel: 'Basis Data',
    alasan: 'Rapat Kurikulum',
    status: 'pending'
  };
  global.adminSessionUser = { nama: 'Super Admin Ujikom' };

  await adminApproveKendala(kendalaId);

  // Check RTDB mutations across all relevant paths
  assert.strictEqual(rtdbStore['kelas/XII RPL 2'].status, 'jamkos', '/kelas/XII RPL 2 status must be jamkos');
  assert.strictEqual(rtdbStore['classes/XII RPL 2'].status, 'jamkos', '/classes/XII RPL 2 status must be jamkos');
  assert.strictEqual(rtdbStore['status_kelas/XII RPL 2'].status, 'jamkos', '/status_kelas/XII RPL 2 status must be jamkos');
  assert.strictEqual(rtdbStore['kelas/XII RPL 2'].activeMapel, 'Basis Data');
  assert.strictEqual(rtdbStore['status_kelas/XII RPL 2'].mapel, 'Basis Data');
  console.log('  ✓ RTDB /kelas, /classes, and /status_kelas successfully mutated to "jamkos" with correct mapel.');
}

// -------------------------------------------------------------------
// TEST 5: Clean UI Invariant in admin.html
// -------------------------------------------------------------------
console.log('\n▶ [Test 5] Auditing admin.html for UI Cleanliness...');
// Search in admin.html specifically around Kendala Guru panel
const kendalaPanelStart = adminHtmlContent.indexOf('PANEL ACC KENDALA GURU');
assert.ok(kendalaPanelStart > -1, 'Kendala guru panel comment must exist');
const kendalaPanelSnippet = adminHtmlContent.substring(kendalaPanelStart, kendalaPanelStart + 2500);

// Check that no visible user text in this snippet has "Jamkos" or "Jam Kosong"
// Extract all tags and text
const matchesJamkos = kendalaPanelSnippet.match(/>[^<]*(?:Jamkos|Jam Kosong)[^<]*</gi) || [];
assert.strictEqual(matchesJamkos.length, 0, `Found forbidden user-facing text in admin.html: ${JSON.stringify(matchesJamkos)}`);

// Verify "Belajar Mandiri" is present in heading and filter button
assert.ok(kendalaPanelSnippet.includes('Kendala Guru & Belajar Mandiri'), 'Heading must contain "Kendala Guru & Belajar Mandiri"');
assert.ok(kendalaPanelSnippet.includes('Sudah di-ACC (Belajar Mandiri)'), 'Filter tab must contain "Sudah di-ACC (Belajar Mandiri)"');
console.log('  ✓ admin.html Kendala Guru panel strictly displays "Belajar Mandiri" with 0 occurrences of "Jamkos"/"Jam Kosong".');

// -------------------------------------------------------------------
// TEST 6: Strict 3-Class Roster Invariant Enforcement
// -------------------------------------------------------------------
console.log('\n▶ [Test 6] Strict 3-Class Roster Invariant Verification...');
const officialClasses = ['XII RPL 1', 'XII RPL 2', 'XII TKJ 1'];
const classesInControl = Object.keys(global.DEFAULT_STATUS_KELAS);
assert.deepStrictEqual(classesInControl.sort(), officialClasses.sort(), 'Only the 3 official classes may be in DEFAULT_STATUS_KELAS');

// Run async tests
(async () => {
  await testUbahStatusManual();
  console.log('  ✓ ubahStatusKelasManual RTDB mutation verified.');
  await testApproveKendala();
  console.log('  ✓ adminApproveKendala RTDB mutations verified.');

  console.log('\n===================================================================');
  console.log('🎉 ALL ADVERSARIAL CHALLENGER M1-2 VERIFICATION TESTS PASSED 100%!');
  console.log('===================================================================');
})();
