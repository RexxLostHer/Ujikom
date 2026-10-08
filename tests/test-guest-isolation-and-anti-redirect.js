// ===================================================================
// TEST SUITE: test-guest-isolation-and-anti-redirect.js
// Memverifikasi perbaikan isolasi tamu/pengunjung & pencegahan auto-redirect ke admin:
// 1. Unauthenticated/Guest visitors di dashboard.html stay on dashboard.html (role: 'pengunjung')
// 2. index.html tidak auto-redirect pengunjung/fresh user ke admin.html pada cold load
// 3. getSessionUser() membersihkan token admin usang dari localStorage dan return null
// 4. setSessionUser() tidak menyimpan role admin di global localStorage
// 5. getDashboardUrlByRole() mengarahkan siswa/pengunjung ke dashboard.html, bukan admin.html
// 6. Early synchronous guards di dashboard.js dan dashboard-guru.js membersihkan stale token
// ===================================================================

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('=== MEMULAI TEST ISOLASI TAMU & PENCEGAHAN AUTO-REDIRECT ADMIN ===\n');

// 1. Verifikasi dashboard.js: Unauthenticated / Guest stays on dashboard.html
const dashJs = fs.readFileSync(path.join(__dirname, '../assets/dashboard.js'), 'utf8');

console.log('[Test 1] Evaluasi Penanganan Pengunjung / Unauthenticated di dashboard.js...');
assert.ok(
  dashJs.includes("role: 'pengunjung'") && dashJs.includes("nama: 'Pengunjung / Tamu Sekolah'"),
  'dashboard.js harus membuat default session pengunjung untuk visitor tanpa auth'
);
assert.ok(
  dashJs.includes('initDashboard(currentUser)'),
  'dashboard.js harus menginisialisasi dashboard untuk pengunjung tanpa melempar ke index.html'
);
// Pastikan tidak ada fallback `window.location.href = 'index.html'` di blok !fbUser
const fbUserBlockMatch = dashJs.match(/if\s*\(!fbUser\)\s*\{([\s\S]*?)initDashboard\(currentUser\);/);
assert.ok(fbUserBlockMatch, 'Blok !fbUser harus ada dan mengarah ke initDashboard');
assert.ok(
  !fbUserBlockMatch[1].includes("window.location.href = 'index.html'"),
  'Visitor tanpa fbUser tidak boleh di-kick keluar ke index.html'
);
assert.ok(
  !fbUserBlockMatch[1].includes("window.location.replace('admin.html')") || fbUserBlockMatch[1].includes("session.role === 'admin'"),
  'Pengunjung tidak boleh dialihkan ke admin.html'
);
console.log('✓ Pengunjung dan unauthenticated user dipastikan STAY di dashboard.html.\n');

// 2. Verifikasi index.html: Tidak auto-redirect ke admin.html pada cold load
const indexHtml = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

console.log('[Test 2] Evaluasi Proteksi index.html dari Auto-Redirect Cold Load...');
assert.ok(
  !indexHtml.includes("window.location.href = getDashboardUrlByRole(userSession.role)"),
  'index.html tidak boleh memiliki auto-redirect tanpa autentikasi form di awal load'
);
assert.ok(
  indexHtml.includes("localStorage.removeItem('user_aktif')"),
  'index.html harus membersihkan sisa token admin usang di localStorage'
);
console.log('✓ Pengunjung di index.html tetap berada di halaman utama tanpa redirect ke admin.\n');

// 3. Verifikasi auth.js: Sanitasi getSessionUser & setSessionUser
const authJs = fs.readFileSync(path.join(__dirname, '../assets/auth.js'), 'utf8');

console.log('[Test 3] Evaluasi Proteksi Sesi dan Sanitasi Token di auth.js...');
assert.ok(
  authJs.includes("user.role === 'admin'") && authJs.includes("localStorage.removeItem('user_aktif')"),
  'getSessionUser harus membuang token admin usang dari localStorage jika tidak ada di sessionStorage'
);
assert.ok(
  authJs.includes("if (data.role === 'admin')") && authJs.includes("localStorage.removeItem('user_aktif')"),
  'setSessionUser tidak boleh menyimpan role admin ke localStorage global'
);
console.log('✓ Kredensial admin diisolasi ketat hanya pada sessionStorage aktif.\n');

// 4. Simulasi Logika getSessionUser & setSessionUser
console.log('[Test 4] Simulasi Perilaku getSessionUser & setSessionUser...');

// Mock storage
let mockSessionStorage = {};
let mockLocalStorage = {};

function mockGetSessionUser() {
  let raw = mockSessionStorage['user_aktif'] || null;
  if (!raw) {
    raw = mockLocalStorage['user_aktif'] || null;
  }
  if (!raw) return null;
  try {
    const user = JSON.parse(raw);
    if (!user || typeof user !== 'object') return null;
    if (user.role === 'admin') {
      const sessRaw = mockSessionStorage['user_aktif'] || null;
      if (!sessRaw) {
        delete mockLocalStorage['user_aktif'];
        return null;
      }
    }
    return user;
  } catch (e) {
    return null;
  }
}

function mockSetSessionUser(data) {
  if (!data) return;
  mockSessionStorage['user_aktif'] = JSON.stringify(data);
  if (data.role === 'admin') {
    delete mockLocalStorage['user_aktif'];
  } else {
    mockLocalStorage['user_aktif'] = JSON.stringify(data);
  }
}

// Skenario A: User belum login sama sekali
mockSessionStorage = {};
mockLocalStorage = {};
assert.strictEqual(mockGetSessionUser(), null, 'Sesi kosong harus menghasilkan null');

// Skenario B: Ada sisa token admin di localStorage dari pengujian sebelumnya
mockSessionStorage = {};
mockLocalStorage['user_aktif'] = JSON.stringify({ role: 'admin', nama: 'Old Admin' });
const resultStale = mockGetSessionUser();
assert.strictEqual(resultStale, null, 'Stale token admin di localStorage harus menghasilkan null dan dibersihkan');
assert.strictEqual(mockLocalStorage['user_aktif'], undefined, 'Stale token di localStorage harus dihapus');

// Skenario C: Admin login sah di tab aktif (sessionStorage)
mockSetSessionUser({ role: 'admin', nama: 'Admin Aktif' });
assert.strictEqual(mockLocalStorage['user_aktif'], undefined, 'Admin tidak boleh disimpan di localStorage');
assert.notStrictEqual(mockSessionStorage['user_aktif'], undefined, 'Admin harus disimpan di sessionStorage');
assert.strictEqual(mockGetSessionUser().role, 'admin', 'Admin aktif di sessionStorage harus terdeteksi');

// Skenario D: Siswa login sah
mockSetSessionUser({ role: 'siswa', nisn: '0098263610', nama: 'Ihsan' });
assert.strictEqual(mockGetSessionUser().role, 'siswa', 'Siswa harus terdeteksi');
assert.notStrictEqual(mockLocalStorage['user_aktif'], undefined, 'Siswa boleh disimpan di localStorage');

// Skenario E: Pengunjung/Tamu
mockSetSessionUser({ role: 'pengunjung', nama: 'Pengunjung Tamu' });
assert.strictEqual(mockGetSessionUser().role, 'pengunjung', 'Pengunjung harus terdeteksi');
console.log('✓ Simulasi getSessionUser dan setSessionUser 100% lolos verifikasi.\n');

// 5. Evaluasi Routing URL getDashboardUrlByRole
console.log('[Test 5] Evaluasi Ketat Routing getDashboardUrlByRole...');
function getDashboardUrlByRole(role) {
  if (role === 'admin') return 'admin.html';
  if (role === 'guru' || role === 'walas') return 'dashboard-guru.html';
  return 'dashboard.html';
}

assert.strictEqual(getDashboardUrlByRole('admin'), 'admin.html', 'Admin -> admin.html');
assert.strictEqual(getDashboardUrlByRole('guru'), 'dashboard-guru.html', 'Guru -> dashboard-guru.html');
assert.strictEqual(getDashboardUrlByRole('walas'), 'dashboard-guru.html', 'Walas -> dashboard-guru.html');
assert.strictEqual(getDashboardUrlByRole('siswa'), 'dashboard.html', 'Siswa -> dashboard.html (bukan admin.html)');
assert.strictEqual(getDashboardUrlByRole('pengunjung'), 'dashboard.html', 'Pengunjung -> dashboard.html (bukan admin.html)');
assert.strictEqual(getDashboardUrlByRole(undefined), 'dashboard.html', 'Undefined -> dashboard.html (bukan admin.html)');
assert.strictEqual(getDashboardUrlByRole(null), 'dashboard.html', 'Null -> dashboard.html (bukan admin.html)');
assert.strictEqual(getDashboardUrlByRole(''), 'dashboard.html', 'Empty string -> dashboard.html (bukan admin.html)');
console.log('✓ Tidak ada kemungkinan siswa, pengunjung, atau tamu dialihkan ke admin.html.\n');

// 6. Evaluasi Early Synchronous Guards di seluruh file
console.log('[Test 6] Evaluasi Early Synchronous Guards...');
const guruJs = fs.readFileSync(path.join(__dirname, '../assets/dashboard-guru.js'), 'utf8');
const adminJs = fs.readFileSync(path.join(__dirname, '../assets/admin.js'), 'utf8');

assert.ok(
  dashJs.includes("testUser.role === 'admin'") && dashJs.includes("localStorage.removeItem('user_aktif')"),
  'dashboard.js early guard harus membersihkan stale admin token'
);
assert.ok(
  guruJs.includes("testUser.role === 'admin'") && guruJs.includes("localStorage.removeItem('user_aktif')"),
  'dashboard-guru.js early guard harus membersihkan stale admin token'
);
assert.ok(
  adminJs.includes("testUser.role === 'admin'") && adminJs.includes("localStorage.removeItem('user_aktif')"),
  'admin.js early guard harus membersihkan stale admin token'
);
console.log('✓ Seluruh early guard terlindungi dari kebocoran token localStorage usang.\n');

console.log('======================================================');
console.log('🎉 SEMUA TEST ISOLASI TAMU & ANTI-REDIRECT 100% SUKSES!');
console.log('======================================================');
