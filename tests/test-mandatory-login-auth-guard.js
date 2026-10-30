// ===================================================================
// TEST SUITE: test-mandatory-login-auth-guard.js
// Memverifikasi Penegakan Wajib Login (Mandatory Authentication Guard):
// 1. Cold load tanpa sesi pada dashboard.html -> seketika redirect ke index.html
// 2. Cold load tanpa sesi pada dashboard-guru.html -> seketika redirect ke index.html
// 3. Cold load tanpa sesi pada admin.html -> seketika redirect ke admin-login.html
// 4. Tidak ada auto-injected dummy session (defaultSiswa & defaultPakEcha telah dihapus)
// 5. Cross-role protection: Siswa di dashboard-guru.html -> redirect ke dashboard.html
// 6. Cross-role protection: Non-admin di admin.html -> redirect ke dashboard role terkait
// 7. Presensi Live TV Display (presensi-live.html) tetap publik tanpa barrier login
// ===================================================================

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

console.log('=== MEMULAI TEST PENEGAKAN WAJIB LOGIN (MANDATORY AUTH GUARD) ===\n');

const dashJsCode = fs.readFileSync(path.join(__dirname, '../assets/dashboard.js'), 'utf8');
const guruJsCode = fs.readFileSync(path.join(__dirname, '../assets/dashboard-guru.js'), 'utf8');
const adminJsCode = fs.readFileSync(path.join(__dirname, '../assets/admin.js'), 'utf8');
const liveJsCode = fs.readFileSync(path.join(__dirname, '../assets/presensi-live.js'), 'utf8');

// [Test 1] Verifikasi ketiadaan auto-injected dummy session
console.log('[Test 1] Memeriksa pembersihan auto-injected dummy session...');
assert.ok(
  !dashJsCode.includes('defaultSiswa'),
  'dashboard.js tidak boleh lagi memiliki variabel atau fallback defaultSiswa'
);
assert.ok(
  !guruJsCode.includes('defaultPakEcha'),
  'dashboard-guru.js tidak boleh lagi memiliki variabel atau fallback defaultPakEcha'
);
console.log('✓ Tidak ada dummy session yang disuntikkan secara otomatis.\n');

// Helper to create browser-like sandbox
function createMockWindow(initialStorage = {}) {
  const sessionStorageMap = Object.assign({}, initialStorage.session || {});
  const localStorageMap = Object.assign({}, initialStorage.local || {});
  let redirectedTo = null;

  const mockWindow = {
    location: {
      href: 'http://localhost/',
      replace: function (url) { redirectedTo = url; }
    },
    sessionStorage: {
      getItem: (k) => sessionStorageMap[k] !== undefined ? sessionStorageMap[k] : null,
      setItem: (k, v) => { sessionStorageMap[k] = String(v); },
      removeItem: (k) => { delete sessionStorageMap[k]; }
    },
    localStorage: {
      getItem: (k) => localStorageMap[k] !== undefined ? localStorageMap[k] : null,
      setItem: (k, v) => { localStorageMap[k] = String(v); },
      removeItem: (k) => { delete localStorageMap[k]; }
    },
    document: {
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: () => {}
    },
    addEventListener: () => {},
    removeEventListener: () => {}
  };

  return {
    window: mockWindow,
    getRedirected: () => redirectedTo,
    sessionStorageMap,
    localStorageMap
  };
}

// [Test 2] Cold Load Tanpa Login di dashboard.js -> wajib redirect ke index.html
console.log('[Test 2] Uji cold load tanpa sesi login di dashboard.js...');
{
  const env = createMockWindow();
  const sandbox = {
    window: env.window,
    sessionStorage: env.window.sessionStorage,
    localStorage: env.window.localStorage,
    document: env.window.document,
    location: env.window.location,
    console: { log: () => {}, warn: () => {}, error: () => {} },
    setTimeout: () => {},
    clearTimeout: () => {},
    setInterval: () => {},
    clearInterval: () => {}
  };

  // Jalankan bagian guard awal dashboard.js
  const earlyGuardMatch = dashJsCode.match(/(let shouldHaltDashboard = false;[\s\S]*?)(if \(!shouldHaltDashboard && typeof firebase)/);
  assert.ok(earlyGuardMatch, 'Early guard dashboard.js harus ditemukan');
  const halted = vm.runInNewContext(earlyGuardMatch[1] + '; shouldHaltDashboard;', sandbox); assert.strictEqual(halted, true, 'shouldHaltDashboard harus bernilai true saat tanpa sesi');
  assert.strictEqual(env.getRedirected(), 'index.html', 'Cold load tanpa sesi di dashboard.js harus dialihkan ke index.html');
  console.log('✓ Pengunjung anonim di dashboard.html langsung ditolak dan dialihkan ke index.html.\n');
}

// [Test 3] Cold Load Tanpa Login di dashboard-guru.js -> wajib redirect ke index.html
console.log('[Test 3] Uji cold load tanpa sesi login di dashboard-guru.js...');
{
  const env = createMockWindow();
  const sandbox = {
    window: env.window,
    sessionStorage: env.window.sessionStorage,
    localStorage: env.window.localStorage,
    document: env.window.document,
    location: env.window.location,
    console: { log: () => {}, warn: () => {}, error: () => {} },
    setTimeout: () => {},
    clearTimeout: () => {},
    setInterval: () => {},
    clearInterval: () => {}
  };

  const earlyGuardMatch = guruJsCode.match(/(let shouldHaltGuru = false;[\s\S]*?)(if \(!shouldHaltGuru && typeof firebase)/);
  assert.ok(earlyGuardMatch, 'Early guard dashboard-guru.js harus ditemukan');
  const halted = vm.runInNewContext(earlyGuardMatch[1] + '; shouldHaltGuru;', sandbox); assert.strictEqual(halted, true, 'shouldHaltGuru harus bernilai true saat tanpa sesi');
  assert.strictEqual(env.getRedirected(), 'index.html', 'Cold load tanpa sesi di dashboard-guru.js harus dialihkan ke index.html');
  console.log('✓ Pengunjung anonim di dashboard-guru.html langsung ditolak dan dialihkan ke index.html.\n');
}

// [Test 4] Cold Load Tanpa Login di admin.js -> wajib redirect ke admin-login.html
console.log('[Test 4] Uji cold load tanpa sesi login di admin.js...');
{
  const env = createMockWindow();
  const sandbox = {
    window: env.window,
    sessionStorage: env.window.sessionStorage,
    localStorage: env.window.localStorage,
    document: env.window.document,
    location: env.window.location,
    console: { log: () => {}, warn: () => {}, error: () => {} },
    setTimeout: () => {},
    clearTimeout: () => {},
    setInterval: () => {},
    clearInterval: () => {}
  };

  const earlyGuardMatch = adminJsCode.match(/(let shouldHaltAdmin = false;[\s\S]*?)(if \(!shouldHaltAdmin && typeof firebase)/);
  assert.ok(earlyGuardMatch, 'Early guard admin.js harus ditemukan');
  const halted = vm.runInNewContext(earlyGuardMatch[1] + '; shouldHaltAdmin;', sandbox); assert.strictEqual(halted, true, 'shouldHaltAdmin harus bernilai true saat tanpa sesi');
  assert.strictEqual(env.getRedirected(), 'admin-login.html', 'Cold load tanpa sesi di admin.js harus dialihkan ke admin-login.html');
  console.log('✓ Pengunjung anonim di admin.html langsung ditolak dan dialihkan ke admin-login.html.\n');
}

// [Test 5] Cross-role protection: Siswa membuka portal guru tanpa sesi guru
console.log('[Test 5] Uji isolasi peran siswa yang mencoba membuka portal guru...');
{
  const env = createMockWindow({
    local: {
      user_aktif: JSON.stringify({ role: 'siswa', nama: 'M. IHSAN ATHALLAH', nisn: '0098263610', kelas: 'XII RPL 2' })
    }
  });
  const sandbox = {
    window: env.window,
    sessionStorage: env.window.sessionStorage,
    localStorage: env.window.localStorage,
    document: env.window.document,
    location: env.window.location,
    console: { log: () => {}, warn: () => {}, error: () => {} },
    setTimeout: () => {},
    clearTimeout: () => {},
    setInterval: () => {},
    clearInterval: () => {}
  };

  const earlyGuardMatch = guruJsCode.match(/(let shouldHaltGuru = false;[\s\S]*?)(if \(!shouldHaltGuru && typeof firebase)/);
  const halted = vm.runInNewContext(earlyGuardMatch[1] + '; shouldHaltGuru;', sandbox); assert.strictEqual(halted, true, 'Siswa harus dihentikan dari portal guru');
  assert.strictEqual(env.getRedirected(), 'dashboard.html', 'Siswa harus ditendang kembali ke dashboard.html');
  console.log('✓ Siswa yang mencoba mengakses portal guru ditendang kembali ke dashboard.html.\n');
}

// [Test 6] Cross-role protection: Siswa membuka portal admin
console.log('[Test 6] Uji isolasi peran siswa yang mencoba membuka portal admin...');
{
  const env = createMockWindow({
    local: {
      user_aktif: JSON.stringify({ role: 'siswa', nama: 'M. IHSAN ATHALLAH', nisn: '0098263610' })
    }
  });
  const sandbox = {
    window: env.window,
    sessionStorage: env.window.sessionStorage,
    localStorage: env.window.localStorage,
    document: env.window.document,
    location: env.window.location,
    console: { log: () => {}, warn: () => {}, error: () => {} },
    setTimeout: () => {},
    clearTimeout: () => {},
    setInterval: () => {},
    clearInterval: () => {}
  };

  const earlyGuardMatch = adminJsCode.match(/(let shouldHaltAdmin = false;[\s\S]*?)(if \(!shouldHaltAdmin && typeof firebase)/);
  const halted = vm.runInNewContext(earlyGuardMatch[1] + '; shouldHaltAdmin;', sandbox); assert.strictEqual(halted, true, 'Siswa harus dihentikan dari portal admin');
  assert.strictEqual(env.getRedirected(), 'dashboard.html', 'Siswa harus dialihkan ke dashboard.html');
  console.log('✓ Siswa yang mencoba mengakses portal admin dialihkan ke dashboard.html.\n');
}

// [Test 7] Pengguna sah dapat mengakses dashboard masing-masing
console.log('[Test 7] Uji akses pengguna sah ke dashboard masing-masing...');
{
  // Siswa sah di dashboard.js
  const envSiswa = createMockWindow({
    session: {
      user_aktif: JSON.stringify({ role: 'siswa', nama: 'M. IHSAN ATHALLAH', nisn: '0098263610', kelas: 'XII RPL 2' })
    }
  });
  const sbSiswa = {
    window: envSiswa.window,
    sessionStorage: envSiswa.window.sessionStorage,
    localStorage: envSiswa.window.localStorage,
    document: envSiswa.window.document,
    location: envSiswa.window.location,
    console: { log: () => {} }
  };
  const earlyGuardSiswa = dashJsCode.match(/(let shouldHaltDashboard = false;[\s\S]*?)(if \(!shouldHaltDashboard && typeof firebase)/);
  const haltedSiswa = vm.runInNewContext(earlyGuardSiswa[1] + '; shouldHaltDashboard;', sbSiswa); assert.strictEqual(haltedSiswa, false, 'Siswa sah tidak boleh dihentikan di dashboard.js');
  assert.strictEqual(envSiswa.getRedirected(), null, 'Siswa sah tidak boleh di-redirect dari dashboard.js');

  // Guru sah di dashboard-guru.js
  const envGuru = createMockWindow({
    session: {
      user_aktif: JSON.stringify({ role: 'walas', nama: 'Muhammad Echa Putra, S.Kom.Gr', nip: '199209142022211007', isVerified: true })
    }
  });
  const sbGuru = {
    window: envGuru.window,
    sessionStorage: envGuru.window.sessionStorage,
    localStorage: envGuru.window.localStorage,
    document: envGuru.window.document,
    location: envGuru.window.location,
    console: { log: () => {} }
  };
  const earlyGuardGuru = guruJsCode.match(/(let shouldHaltGuru = false;[\s\S]*?)(if \(!shouldHaltGuru && typeof firebase)/);
  const haltedGuru = vm.runInNewContext(earlyGuardGuru[1] + '; shouldHaltGuru;', sbGuru); assert.strictEqual(haltedGuru, false, 'Guru sah tidak boleh dihentikan di dashboard-guru.js');
  assert.strictEqual(envGuru.getRedirected(), null, 'Guru sah tidak boleh di-redirect dari dashboard-guru.js');

  // Admin sah di admin.js
  const envAdmin = createMockWindow({
    session: {
      user_aktif: JSON.stringify({ role: 'admin', nama: 'Administrator SMKN 1 Sumedang', email: 'admin@smkn1sumedang.sch.id' })
    }
  });
  const sbAdmin = {
    window: envAdmin.window,
    sessionStorage: envAdmin.window.sessionStorage,
    localStorage: envAdmin.window.localStorage,
    document: envAdmin.window.document,
    location: envAdmin.window.location,
    console: { log: () => {} }
  };
  const earlyGuardAdmin = adminJsCode.match(/(let shouldHaltAdmin = false;[\s\S]*?)(if \(!shouldHaltAdmin && typeof firebase)/);
  const haltedAdmin = vm.runInNewContext(earlyGuardAdmin[1] + '; shouldHaltAdmin;', sbAdmin); assert.strictEqual(haltedAdmin, false, 'Admin sah tidak boleh dihentikan di admin.js');
  assert.strictEqual(envAdmin.getRedirected(), null, 'Admin sah tidak boleh di-redirect dari admin.js');

  console.log('✓ Seluruh pengguna sah (siswa, guru, admin) dapat mengakses dashboard masing-masing.\n');
}

// [Test 8] Presensi Live TV Display (presensi-live.html) tetap publik
console.log('[Test 8] Memastikan presensi-live.html tidak memiliki blocking login guard...');
assert.ok(
  !liveJsCode.includes("window.location.replace('index.html')") &&
  !liveJsCode.includes("window.location.replace('admin-login.html')"),
  'presensi-live.js tidak boleh memblokir display TV sekolah dengan redirect login'
);
console.log('✓ Presensi Live TV Display tetap terbuka untuk pemantauan publik sekolah.\n');

console.log('======================================================');
console.log('🎉 SEMUA TEST PENEGAKAN WAJIB LOGIN 100% SUKSES!');
console.log('======================================================');
