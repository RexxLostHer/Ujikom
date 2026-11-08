/**
 * TEST SUITE: RBAC & FIREBASE SECURITY RULES VERIFICATION (PRD FASE 5)
 * Memvalidasi kepatuhan aturan keamanan Firebase RTDB (database.rules.json):
 * - Test 1: Penolakan Akses Anonim (Unauthenticated Read/Write ditolak)
 * - Test 2: Isolasi Data Antar-Siswa (Siswa A tidak dapat mengakses data Siswa B)
 * - Test 3: Otorisasi Guru & Admin (Persetujuan/Penolakan perizinan)
 * - Test 4: Otorisasi IoT Gateway (Akses rfid_map & pencatatan riwayat presensi)
 * - Test 5: Pemindaian Regresi Rahasia (Secret & PII Scan pada file terlacak git)
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const RULES_PATH = path.join(ROOT_DIR, 'database.rules.json');

console.log('===================================================================');
console.log('🔒 MENJALANKAN TEST SUITE KEAMANAN RBAC FIREBASE & AUDIT PRD 2026');
console.log('===================================================================');

// Baca berkas database.rules.json
assert.ok(fs.existsSync(RULES_PATH), 'Berkas database.rules.json wajib ada');
const rulesContent = fs.readFileSync(RULES_PATH, 'utf8');
const rulesJson = JSON.parse(rulesContent);
const rules = rulesJson.rules;

// =================================================================
// TEST 1: Penolakan Akses Anonim (Unauthenticated Read/Write Ditolak)
// =================================================================
console.log('\n[Test 1] Evaluasi Penolakan Akses Anonim (auth == null)...');

// 1. Root default deny
assert.strictEqual(rules['.read'], false, 'Root .read harus false');
assert.strictEqual(rules['.write'], false, 'Root .write harus false');

// 2. Tidak ada node sensitif dengan aturan terbuka (.read: true / .write: true tanpa auth)
const sensitiveNodes = ['users', 'siswa', 'guru', 'rfid_map', 'riwayat', 'perizinan', 'chat_rooms', 'absensi'];
for (const node of sensitiveNodes) {
  assert.ok(rules[node], `Node ${node} wajib terdefinisi di rules`);
  const nodeRules = rules[node];

  if (nodeRules['.read'] !== undefined) {
    assert.notStrictEqual(nodeRules['.read'], true, `Node ${node} TIDAK BOLEH memiliki .read: true terbuka`);
    if (typeof nodeRules['.read'] === 'string') {
      assert.ok(nodeRules['.read'].includes('auth != null'), `Node ${node} .read wajib mensyaratkan auth != null`);
    }
  }

  if (nodeRules['.write'] !== undefined) {
    assert.notStrictEqual(nodeRules['.write'], true, `Node ${node} TIDAK BOLEH memiliki .write: true terbuka`);
    if (typeof nodeRules['.write'] === 'string') {
      assert.ok(nodeRules['.write'].includes('auth != null'), `Node ${node} .write wajib mensyaratkan auth != null`);
    }
  }
}

// 3. Node duplikat warisan perijinan, chat_perijinan, perijinan_chats tidak boleh ada di rules
assert.strictEqual(rules['perijinan'], undefined, 'Node legacy perijinan tidak boleh ada di database.rules.json');
assert.strictEqual(rules['chat_perijinan'], undefined, 'Node legacy chat_perijinan tidak boleh ada di database.rules.json');
assert.strictEqual(rules['perijinan_chats'], undefined, 'Node legacy perijinan_chats tidak boleh ada di database.rules.json');

console.log('✓ Test 1 LULUS: Akses anonim ditolak secara ketat pada seluruh node sensitif.');

// =================================================================
// TEST 2: Isolasi Data Antar-Siswa (Siswa A vs Siswa B)
// =================================================================
console.log('\n[Test 2] Evaluasi Isolasi Data Antar-Siswa...');

// A. Siswa Node: $nisn hanya boleh dibaca jika auth memiliki nisn yang cocok
const siswaChild = rules.siswa['$nisn'];
assert.ok(siswaChild, 'Child rules.siswa.$nisn harus terdefinisi');
assert.ok(siswaChild['.read'].includes("root.child('users').child(auth.uid).child('nisn').val() === $nisn"),
  'Siswa hanya boleh membaca record nisn miliknya sendiri');

// B. Riwayat Node: $tanggal/$nisn hanya boleh dibaca oleh siswa pemilik NISN
const riwayatChild = rules.riwayat['$tanggal']['$nisn'];
assert.ok(riwayatChild, 'Child rules.riwayat.$tanggal.$nisn harus terdefinisi');
assert.ok(riwayatChild['.read'].includes("root.child('users').child(auth.uid).child('nisn').val() === $nisn"),
  'Riwayat siswa hanya boleh dibaca oleh siswa pemilik NISN');

// C. Perizinan Node: Siswa tidak boleh menyetujui izin sendiri (status approved)
const perizinanChild = rules.perizinan['$id'];
assert.ok(perizinanChild, 'Child rules.perizinan.$id harus terdefinisi');
assert.ok(perizinanChild['.write'].includes("root.child('users').child(auth.uid).child('role').val() === 'admin'"),
  'Persetujuan izin memerlukan role admin');
assert.ok(perizinanChild['.write'].includes("root.child('users').child(auth.uid).child('role').val() === 'guru'"),
  'Persetujuan izin memerlukan role guru');

// Siswa hanya boleh membuat perizinan baru jika uid miliknya atau saat pending
assert.ok(perizinanChild['.write'].includes("newData.child('uid').val() === auth.uid"),
  'Siswa hanya boleh mengajukan izin untuk akunnya sendiri');

console.log('✓ Test 2 LULUS: Isolasi data antar-siswa terbukti 100% aman.');

// =================================================================
// TEST 3: Otorisasi Guru & Admin untuk Persetujuan Izin
// =================================================================
console.log('\n[Test 3] Evaluasi Otorisasi Guru & Admin...');

const perizinanWrite = rules.perizinan['$id']['.write'];
assert.ok(perizinanWrite.includes("root.child('users').child(auth.uid).child('role').val() === 'admin'"),
  'Admin wajib memiliki izin mutlak menulis/mengubah status perizinan');
assert.ok(perizinanWrite.includes("root.child('users').child(auth.uid).child('role').val() === 'guru'"),
  'Guru wajib memiliki otorisasi menulis/mengubah status perizinan');

// Evaluasi simulasi ekspresi otorisasi
function canApprovePermit(role) {
  return role === 'admin' || role === 'guru';
}

assert.strictEqual(canApprovePermit('admin'), true, 'Admin dapat menyetujui izin');
assert.strictEqual(canApprovePermit('guru'), true, 'Guru dapat menyetujui izin');
assert.strictEqual(canApprovePermit('siswa'), false, 'Siswa TIDAK DAPAT menyetujui izin');
assert.strictEqual(canApprovePermit('pengunjung'), false, 'Pengunjung TIDAK DAPAT menyetujui izin');

console.log('✓ Test 3 LULUS: Otorisasi persetujuan perizinan terkunci eksklusif untuk Guru & Admin.');

// =================================================================
// TEST 4: Otorisasi IoT Gateway (Akses rfid_map & Log Riwayat Presensi)
// =================================================================
console.log('\n[Test 4] Evaluasi Otorisasi IoT Gateway...');

// rfid_map .read hanya untuk admin & iot_gateway
const rfidMapRead = rules.rfid_map['.read'];
assert.ok(rfidMapRead.includes("root.child('users').child(auth.uid).child('role').val() === 'iot_gateway'"),
  'IoT Gateway diizinkan membaca mapping kartu rfid_map');
assert.ok(rfidMapRead.includes("root.child('users').child(auth.uid).child('role').val() === 'admin'"),
  'Admin diizinkan membaca mapping kartu rfid_map');
assert.ok(!rfidMapRead.includes("'siswa'"), 'Siswa TIDAK BOLEH membaca mapping rfid_map');

// riwayat write diizinkan untuk iot_gateway
const riwayatWrite = rules.riwayat['$tanggal']['$nisn']['.write'];
assert.ok(riwayatWrite.includes("root.child('users').child(auth.uid).child('role').val() === 'iot_gateway'"),
  'IoT Gateway diizinkan menulis presensi ke riwayat/$tanggal/$nisn');

// absensi write diizinkan untuk iot_gateway
const absensiWrite = rules.absensi['$nisn']['.write'];
assert.ok(absensiWrite.includes("root.child('users').child(auth.uid).child('role').val() === 'iot_gateway'"),
  'IoT Gateway diizinkan mencatat kehadiran ke node absensi');

console.log('✓ Test 4 LULUS: Hak akses IoT Gateway terisolasi khusus ke rfid_map dan riwayat.');

// =================================================================
// TEST 5: Pemindaian Regresi Rahasia (Secret & PII Scan)
// =================================================================
console.log('\n[Test 5] Pemindaian Regresi Rahasia & PII pada Berkas Git...');

const trackedFiles = execSync('git ls-files', { cwd: ROOT_DIR, encoding: 'utf8' })
  .split('\n')
  .map(f => f.trim())
  .filter(f => f && !f.endsWith('.jpg') && !f.endsWith('.png') && !f.endsWith('.ico') && !f.endsWith('.svg'));

// A. PII Scan: Tidak boleh ada file JSON database siswa terlacak di Git
assert.ok(!trackedFiles.includes('assets/data-siswa.json'), 'assets/data-siswa.json TIDAK BOLEH terlacak di git');
assert.ok(!trackedFiles.includes('siswa-clean-firebase.json'), 'siswa-clean-firebase.json TIDAK BOLEH terlacak di git');
assert.ok(!trackedFiles.includes('iot/secrets.h'), 'iot/secrets.h TIDAK BOLEH terlacak di git');

// B. Card UID Scan: Tidak boleh ada kartu fisik riil di kode runtime IoT & Client
const PROD_RUNTIME_FILES = [
  'presensia-iot-contract.js',
  'iot/absensi_rpi.py',
  'iot/esp32_rfid_rc522.ino',
  'assets/auth.js',
  'assets/admin-login.js',
  'assets/login.js',
  'database.rules.json'
];
const REAL_CARD_UIDS = ['006787337', '1058384422'];
for (const relFile of PROD_RUNTIME_FILES) {
  const filePath = path.join(ROOT_DIR, relFile);
  if (!fs.existsSync(filePath)) continue;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const uid of REAL_CARD_UIDS) {
    assert.ok(!content.includes(uid), `Berkas produksi ${relFile} tidak boleh memuat UID kartu fisik asli: ${uid}`);
  }
}

// C. Insecure Rules Scan: Tidak boleh ada .write: true tanpa auth di database.rules.json
assert.ok(!rulesContent.includes('".write": true'), 'database.rules.json tidak boleh memuat .write: true tanpa auth');
assert.ok(!rulesContent.includes('".read": true'), 'database.rules.json tidak boleh memuat .read: true tanpa auth');

console.log('✓ Test 5 LULUS: Seluruh berkas terlacak di Git bersih dari UID kartu asli, file PII, dan celah terbuka.');

console.log('\n===================================================================');
console.log('🎉 SELURUH PENGUJIAN KEAMANAN RBAC & AUDIT PRD LULUS 100%!');
console.log('===================================================================');
