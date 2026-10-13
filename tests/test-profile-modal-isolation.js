// ===================================================================
// TEST SUITE: test-profile-modal-isolation.js
// Memverifikasi isolasi modal profil dan penghapusan mutlak switcher preset
// dari dashboard publik (dashboard.html) sesuai instruksi UJIKOM 2026.
// ===================================================================

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('=== MEMULAI TEST ISOLASI MODAL PROFIL & ANTI-SWITCHER PUBLIK ===\n');

// 1. Verifikasi Statis dashboard.html
const dashHtml = fs.readFileSync(path.join(__dirname, '../dashboard.html'), 'utf8');
const authCode = fs.readFileSync(path.join(__dirname, '../assets/auth.js'), 'utf8');
const modalCode = fs.readFileSync(path.join(__dirname, '../assets/profile-modal.js'), 'utf8');

console.log('[Test 1] Evaluasi Eliminasi Preset Switcher pada DOM dashboard.html...');
assert.ok(!dashHtml.includes('pilihPresetRole'), 'dashboard.html tidak boleh memuat fungsi pilihPresetRole');
assert.ok(!dashHtml.includes('1-Click Preset'), 'dashboard.html tidak boleh memuat teks 1-Click Preset');
assert.ok(!dashHtml.includes('Beralih Peran & Mode Pengujian UJIKOM'), 'dashboard.html tidak boleh memuat judul panel switcher pengujian');
console.log('✓ DOM dashboard.html bersih 100% dari switcher peran publik.\n');

// 2. Simulasi DOM & Runtime untuk Modal Profil pada Lingkungan dashboard.html (Publik / Tamu)
console.log('[Test 2] Evaluasi Modal Profil pada Akun Pengunjung di dashboard.html...');

function createMockEnvironment(pathname, userSession) {
  let innerHtmlStore = '';
  const mockElement = {
    id: '',
    className: '',
    style: { display: '' },
    innerHTML: '',
    onclick: null,
    appendChild: () => {},
    focus: () => {}
  };

  const elementsById = {
    modalProfilOverlay: mockElement,
    profilNotifBox: { style: { display: 'none' }, className: '', textContent: '' }
  };

  const sessStore = { user_aktif: JSON.stringify(userSession) };
  const localStore = {};

  const mockWindow = {
    location: {
      pathname: pathname,
      href: 'http://localhost/' + pathname
    },
    sessionStorage: {
      getItem: (key) => sessStore[key] || null,
      setItem: (key, val) => { sessStore[key] = String(val); },
      removeItem: (key) => { delete sessStore[key]; }
    },
    localStorage: {
      getItem: (key) => localStore[key] || null,
      setItem: (key, val) => { localStore[key] = String(val); },
      removeItem: (key) => { delete localStore[key]; }
    }
  };

  const mockDocument = {
    body: {
      appendChild: () => {}
    },
    getElementById: (id) => elementsById[id] || mockElement,
    createElement: (tag) => mockElement
  };

  const ctx = vm.createContext({
    window: mockWindow,
    document: mockDocument,
    sessionStorage: mockWindow.sessionStorage,
    localStorage: mockWindow.localStorage,
    console: console,
    setTimeout: (fn) => fn(),
    clearTimeout: () => {},
    firebase: { auth: () => ({ currentUser: null }) }
  });

  vm.runInContext(authCode, ctx);
  vm.runInContext(modalCode, ctx);

  return { ctx, mockElement, elementsById, mockWindow, sessStore, localStore };
}

// Uji Akun Pengunjung di dashboard.html
const guestUser = {
  role: 'pengunjung',
  nama: 'Pengunjung / Tamu Sekolah',
  email: 'tamu@gmail.com',
  isVerified: false
};

const guestEnv = createMockEnvironment('dashboard.html', guestUser);
guestEnv.ctx.bukaModalProfil();
const guestModalHtml = guestEnv.mockElement.innerHTML;

// Verifikasi ketiadaan switcher di dashboard.html
assert.ok(!guestModalHtml.includes('sectionPresetAdmin'), 'Modal pengunjung TIDAK boleh memiliki sectionPresetAdmin');
assert.ok(!guestModalHtml.includes('1-Click Preset'), 'Modal pengunjung TIDAK boleh memiliki 1-Click Preset');
assert.ok(!guestModalHtml.includes('Beralih Peran & Mode Pengujian UJIKOM'), 'Modal pengunjung TIDAK boleh memuat panel switcher UJIKOM');
assert.ok(!guestModalHtml.includes('pilihPresetRole'), 'Modal pengunjung TIDAK boleh memiliki tombol pilihPresetRole');

// Verifikasi formulir verifikasi resmi (NISN / NIP) tetap hadir
assert.ok(guestModalHtml.includes('Verifikasi Identitas Resmi'), 'Modal pengunjung HARUS menyediakan formulir verifikasi resmi');
assert.ok(guestModalHtml.includes('inputNisnVerif'), 'Modal pengunjung HARUS menyediakan input NISN');
assert.ok(guestModalHtml.includes('inputNipVerif'), 'Modal pengunjung HARUS menyediakan input NIP');
console.log('✓ Akun Pengunjung pada dashboard.html hanya melihat profil dan form verifikasi resmi (tanpa switcher).\n');

// 3. Evaluasi Penolakan Pemanggilan pilihPresetRole pada dashboard.html
console.log('[Test 3] Evaluasi Proteksi Pemanggilan Langsung pilihPresetRole di dashboard.html...');
guestEnv.ctx.pilihPresetRole('walas');
const notifGuest = guestEnv.elementsById.profilNotifBox.textContent;
assert.ok(notifGuest.includes('Akses Ditolak'), 'Pemanggilan pilihPresetRole pada dashboard.html harus memunculkan Akses Ditolak');
console.log('✓ Pemanggilan switcher instan dari dashboard.html berhasil diblokir 100%.\n');

// 4. Evaluasi Akses Administrator pada admin.html
console.log('[Test 4] Evaluasi Modal Profil untuk Administrator pada admin.html...');
const adminUser = {
  role: 'admin',
  nama: 'Administrator Sistem',
  email: 'admin@smkn1sumedang.sch.id',
  isVerified: true
};

const adminEnv = createMockEnvironment('admin.html', adminUser);
adminEnv.ctx.bukaModalProfil();
const adminModalHtml = adminEnv.mockElement.innerHTML;

// Verifikasi bahwa admin pada admin.html memiliki akses switcher pengujian
assert.ok(adminModalHtml.includes('sectionPresetAdmin'), 'Modal admin di admin.html harus memuat sectionPresetAdmin');
assert.ok(adminModalHtml.includes('1-Click Preset'), 'Modal admin di admin.html harus memuat 1-Click Preset untuk pengujian');
assert.ok(adminModalHtml.includes('pilihPresetRole(\'walas\''), 'Modal admin di admin.html harus menyediakan preset walas');
assert.ok(adminModalHtml.includes('pilihPresetRole(\'guru\''), 'Modal admin di admin.html harus menyediakan preset guru');
assert.ok(adminModalHtml.includes('pilihPresetRole(\'siswa\''), 'Modal admin di admin.html harus menyediakan preset siswa');

// Verifikasi eksekusi nyata switcher role pada admin.html berhasil 100%
const switchedWalas = adminEnv.ctx.gantiRoleSesi('walas');
assert.strictEqual(switchedWalas.role, 'walas', 'Eksekusi switcher role walas harus sukses');
assert.strictEqual(switchedWalas.isRoleSwitched, true, 'isRoleSwitched harus aktif');
assert.strictEqual(adminEnv.mockWindow.location.href, 'dashboard-guru.html', 'Admin ganti role walas harus diarahkan ke dashboard-guru.html');
console.log('✓ Administrator asli pada admin.html dapat mengakses dan mengeksekusi preset pengujian secara aman.\n');

// 5. Evaluasi Penolakan gantiRoleSesi pada Halaman Publik
console.log('[Test 5] Evaluasi Proteksi Eksekusi gantiRoleSesi di Lingkungan dashboard.html...');
let errorCaught = false;
try {
  const res = guestEnv.ctx.gantiRoleSesi('walas');
  if (res && typeof res.then === 'function') {
    res.then(() => {
      assert.fail('gantiRoleSesi pada dashboard publik harus ditolak');
    }).catch(e => {
      errorCaught = true;
      assert.ok(e.message.includes('Akses Ditolak'), 'Pesan error gantiRoleSesi harus Akses Ditolak');
    });
  }
} catch (e) {
  errorCaught = true;
  assert.ok(e.message.includes('Akses Ditolak'), 'Pesan error gantiRoleSesi harus Akses Ditolak');
}
assert.ok(errorCaught, 'gantiRoleSesi harus melempar error saat dipanggil di dashboard publik');

// Evaluasi Tambahan: Administrator di dashboard.html juga harus ditolak beralih peran
const adminOnDash = createMockEnvironment('dashboard.html', adminUser);
let adminDashCaught = false;
try {
  adminOnDash.ctx.gantiRoleSesi('walas');
} catch (e) {
  adminDashCaught = true;
  assert.ok(e.message.includes('Akses Ditolak'), 'Admin di dashboard publik juga harus ditolak switcher perannya');
}
assert.ok(adminDashCaught, 'Administrator tidak boleh mengeksekusi switcher peran dari dashboard publik');
console.log('✓ gantiRoleSesi terproteksi dari eksekusi liar pada dashboard publik baik untuk tamu maupun admin.\n');

// 6. Evaluasi Akun Siswa Terverifikasi pada dashboard.html
console.log('[Test 6] Evaluasi Modal Profil untuk Akun Siswa Resmi di dashboard.html...');
const siswaUser = {
  role: 'siswa',
  nama: 'M. Ihsan Athallah',
  nisn: '0098263610',
  kelas: 'XII RPL 2',
  email: 'ihsanathallah@gmail.com',
  isVerified: true
};
const siswaEnv = createMockEnvironment('dashboard.html', siswaUser);
siswaEnv.ctx.bukaModalProfil();
const siswaModalHtml = siswaEnv.mockElement.innerHTML;

assert.ok(!siswaModalHtml.includes('sectionPresetAdmin'), 'Modal siswa resmi TIDAK boleh memuat sectionPresetAdmin');
assert.ok(!siswaModalHtml.includes('1-Click Preset'), 'Modal siswa resmi TIDAK boleh memuat 1-Click Preset');
assert.ok(!siswaModalHtml.includes('pilihPresetRole'), 'Modal siswa resmi TIDAK boleh memuat fungsi pilihPresetRole');
console.log('✓ Akun Siswa resmi pada dashboard.html bebas 100% dari switcher peran pengujian.\n');

// 7. Evaluasi Sanitasi Flag isRoleSwitched saat Reset ke Pengunjung
console.log('[Test 7] Evaluasi Pembersihan Flag isRoleSwitched saat Reset ke Pengunjung...');
let storedSession = {};
let storedLocal = {};
const trackingWindow = {
  location: { pathname: 'admin.html', href: 'http://localhost/admin.html' },
  sessionStorage: {
    getItem: (k) => storedSession[k] || null,
    setItem: (k, v) => { storedSession[k] = String(v); },
    removeItem: (k) => { delete storedSession[k]; }
  },
  localStorage: {
    getItem: (k) => storedLocal[k] || null,
    setItem: (k, v) => { storedLocal[k] = String(v); },
    removeItem: (k) => { delete storedLocal[k]; }
  }
};
const trackingCtx = vm.createContext({
  window: trackingWindow,
  document: { body: { appendChild: () => {} }, getElementById: () => ({ style: {} }), createElement: () => ({}) },
  sessionStorage: trackingWindow.sessionStorage,
  localStorage: trackingWindow.localStorage,
  console: console,
  setTimeout: (fn) => fn(),
  clearTimeout: () => {},
  firebase: { auth: () => ({ currentUser: null }) }
});
vm.runInContext(authCode, trackingCtx);
vm.runInContext(modalCode, trackingCtx);

// Login as admin first
storedSession['user_aktif'] = JSON.stringify(adminUser);

// 1. Eksekusi ganti peran ke walas untuk memverifikasi set token switcher
trackingCtx.gantiRoleSesi('walas');
assert.strictEqual(storedSession['isRoleSwitched'], 'true', 'isRoleSwitched harus diset ke true di sessionStorage');
assert.strictEqual(storedLocal['isRoleSwitched'], 'true', 'isRoleSwitched harus diset ke true di localStorage');

// 2. Reset ke pengunjung untuk memverifikasi pembersihan token
trackingCtx.gantiRoleSesi('pengunjung');
assert.strictEqual(storedSession['isRoleSwitched'], undefined, 'isRoleSwitched harus dihapus saat targetRole adalah pengunjung');
assert.strictEqual(storedLocal['isRoleSwitched'], undefined, 'isRoleSwitched harus dihapus dari localStorage saat reset ke pengunjung');
console.log('✓ Siklus hidup token switcher terverifikasi: terpasang saat switch peran dan dibersihkan mutlak saat reset.\n');

// 8. Evaluasi Modal Profil untuk Guru di dashboard-guru.html
console.log('[Test 8] Evaluasi Modal Profil Guru di dashboard-guru.html...');
const guruUser = {
  role: 'guru',
  nama: 'Hani Hanifah, S.Si',
  nip: '198109012009022003',
  email: 'hani@smkn1sumedang.sch.id',
  isVerified: true
};
const guruEnv = createMockEnvironment('dashboard-guru.html', guruUser);
guruEnv.ctx.bukaModalProfil();
const guruModalHtml = guruEnv.mockElement.innerHTML;
assert.ok(!guruModalHtml.includes('sectionPresetAdmin'), 'Modal guru TIDAK boleh memuat sectionPresetAdmin');
assert.ok(!guruModalHtml.includes('1-Click Preset'), 'Modal guru TIDAK boleh memuat 1-Click Preset');

// Evaluasi proteksi eksekusi gantiRoleSesi dari portal guru
let guruSwitchError = false;
try {
  guruEnv.ctx.gantiRoleSesi('walas');
} catch (e) {
  guruSwitchError = true;
  assert.ok(e.message.includes('Akses Ditolak'), 'Guru di portal guru tidak boleh ganti peran instan');
}
assert.ok(guruSwitchError, 'gantiRoleSesi harus ditolak saat dipanggil di dashboard-guru.html');
console.log('✓ Modal profil Guru di dashboard-guru.html terkunci tanpa panel switcher admin dan gantiRoleSesi ditolak.\n');

// 9. Evaluasi Isolasi Mutlak pada Halaman Publik index.html
console.log('[Test 9] Evaluasi Isolasi Mutlak gantiRoleSesi pada Halaman Publik index.html...');
const indexGuestEnv = createMockEnvironment('index.html', guestUser);
let indexErrorCaught = false;
try {
  indexGuestEnv.ctx.gantiRoleSesi('walas');
} catch (e) {
  indexErrorCaught = true;
  assert.ok(e.message.includes('Akses Ditolak'), 'gantiRoleSesi pada index.html harus melempar Akses Ditolak');
}
assert.ok(indexErrorCaught, 'index.html publik harus memblokir eksekusi gantiRoleSesi');
console.log('✓ Portal publik index.html 100% terisolasi dari fitur role switcher.\n');

console.log('======================================================');
console.log('🎉 SEMUA PENGUJIAN ISOLASI MODAL PROFIL 100% LULUS!');
console.log('======================================================');
