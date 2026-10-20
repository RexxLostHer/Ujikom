// ===================================================================
// TEST SUITE: test-school-login-portal.js
// Verifikasi Maskot Robot Presensi IoT "Robo-NESAS" (Watch & Cover Eyes)
// 1. Validasi Identitas Resmi SMKN 1 Sumedang & Centered Layout
// 2. Validasi Jam Digital Live Sekolah (#liveClock), Sesi Presensi & Telemetri IoT
// 3. Validasi Maskot Robot Robo-NESAS: Eye Tracking, Cover Eyes, Peeking & Happy Eyes
// 4. Validasi Keutuhan Seluruh 17 ID DOM Form Login, Register & Auth Buttons
// 5. Validasi Keamanan, Isolasi Administrator & Penanganan Error Lengkap
// ===================================================================

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- MEMULAI PENGUJIAN PORTAL PRESENSI ROBO-NESAS (INDEX.HTML) ---');

const indexHtmlPath = path.join(__dirname, '../index.html');
const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

// TEST 1: Identitas Resmi Sekolah SMKN 1 Sumedang & Split 2-Slide Layout
console.log('\n[Test 1] Validasi Identitas Resmi SMKN 1 Sumedang & Split 2-Slide Portal Layout');
assert.ok(indexHtml.includes('SMK Negeri 1 Sumedang'), 'index.html harus memuat nama resmi SMK Negeri 1 Sumedang');
assert.ok(indexHtml.includes('assets/logo-nesas.png'), 'index.html harus memuat logo NESAS resmi');
assert.ok(indexHtml.includes('Rekayasa Perangkat Lunak (RPL IoT)') || indexHtml.includes('RPL IoT'), 'index.html harus memuat badge kejuruan RPL IoT');
assert.ok(indexHtml.includes('#080e1a'), 'index.html harus menggunakan palet Obsidian Dark base #080e1a');
assert.ok(indexHtml.includes('#0f172a'), 'index.html harus menggunakan palet Obsidian surface #0f172a');
assert.ok(indexHtml.includes('school-portal-split-container') || indexHtml.includes('portal-left-slide'), 'index.html harus memuat class split layout 2 slide / 2 kolom');
assert.ok(indexHtml.includes('portal-right-slide'), 'index.html harus memiliki wadah kolom kanan portal-right-slide');
console.log('✓ Branding SMKN 1 Sumedang dan Split 2-Slide Portal Layout terverifikasi aktif');

// TEST 2: Jam Digital Live Sekolah, Sesi Presensi & Telemetri IoT
console.log('\n[Test 2] Validasi Jam Digital Live Sekolah & Telemetri Realtime');
assert.ok(indexHtml.includes('id="liveClock"'), 'index.html harus memiliki elemen id="liveClock"');
assert.ok(indexHtml.includes('updateSchoolClock'), 'Fungsi updateSchoolClock harus ada untuk live clock');
assert.ok(indexHtml.includes('06.30 - 08.00 WIB'), 'Informasi sesi pagi 06.30 - 08.00 WIB harus tertera');
assert.ok(indexHtml.includes('ESP32'), 'Telemetri hardware gateway ESP32 harus tertera');
assert.ok(indexHtml.includes('Firebase Realtime Database Connected'), 'Status cloud sync Firebase harus tertera');
console.log('✓ Live school clock (#liveClock), sesi presensi, dan telemetri IoT terverifikasi lengkap');

// TEST 3: Maskot Robot Presensi Cerdas "Robo-NESAS" (Watch, Closed Eyes Blushing & One-Eye Peek)
console.log('\n[Test 3] Validasi Maskot Robot Robo-NESAS: Eye Tracking ke Kanan, Closed Eyes Blushing, Peeking & Happy Eyes');
assert.ok(indexHtml.includes('id="roboNesasMascot"'), 'index.html harus memuat elemen SVG maskot #roboNesasMascot');
assert.ok(indexHtml.includes('id="mascotStage"'), 'index.html harus memuat panggung maskot #mascotStage');
assert.ok(indexHtml.includes('id="pupilLeft"') && indexHtml.includes('id="pupilRight"'), 'Maskot harus memiliki pupil kiri dan kanan');
assert.ok(indexHtml.includes('id="closedEyesGroup"'), 'Maskot harus memiliki elemen/state mata tertutup (#closedEyesGroup)');
assert.ok(indexHtml.includes('id="peekEyesGroup"'), 'Maskot harus memiliki elemen/state satu mata mengintip (#peekEyesGroup)');
assert.ok(indexHtml.includes('id="blushCheeksGroup"'), 'Maskot harus memiliki elemen rona pipi merona (#blushCheeksGroup)');
assert.ok(indexHtml.includes('id="armLeft"') && indexHtml.includes('id="armRight"'), 'Maskot harus memiliki lengan mekanik kiri dan kanan di posisi santai');
assert.ok(indexHtml.includes('id="fingersLeft"') && indexHtml.includes('id="fingersRight"'), 'Maskot harus memiliki jari robotik kiri dan kanan');
assert.ok(indexHtml.includes('id="happyEyesGroup"'), 'Maskot harus memiliki happy arc eyes untuk selebrasi sukses');
assert.ok(indexHtml.includes('closeEyes') || indexHtml.includes('coverEyes'), 'Logika menutup mata (closeEyes/coverEyes) saat password focused harus ada');
assert.ok(indexHtml.includes('peekEyes') || indexHtml.includes('peekMascotEyes'), 'Logika mengintip (peekEyes) saat toggle password diklik harus ada');
assert.ok(indexHtml.includes('triggerHappyEyes') || indexHtml.includes('happyMascotEyes'), 'Logika happy eyes saat sukses presensi harus ada');
assert.ok(indexHtml.includes('Robo-NESAS Malu-Malu Menutup Mata... (Blushing)') || indexHtml.includes('Robo-NESAS Menutup Mata...'), 'Pesan status tutup mata malu-malu blushing harus ada');
assert.ok(indexHtml.includes('Robo-NESAS Mengintip Malu-Malu...') || indexHtml.includes('Robo-NESAS Mengintip'), 'Pesan status mengintip malu-malu harus ada');

// Deep Functional Simulation: DOM & Event Loop Validation
const vm = require('vm');
const elements = {
  mascotRoot: { style: {} },
  mascotStatusText: { textContent: '' },
  mascotStatusDot: { style: {} },
  normalEyesGroup: { style: { opacity: '1' } },
  closedEyesGroup: { style: { opacity: '0' } },
  peekEyesGroup: { style: { opacity: '0' } },
  happyEyesGroup: { style: { opacity: '0' } },
  blushCheeksGroup: { style: { opacity: '0' } },
  pupilLeft: { style: {} },
  pupilRight: { style: {} },
  mascotHead: { style: {} },
  armLeft: { style: {} },
  armRight: { style: {} },
  fingersLeft: { style: {} },
  fingersRight: { style: {} },
  antennaLight: { style: {} },
  loginEmail: { value: '', type: 'email', eventListeners: {}, addEventListener(e, fn) { this.eventListeners[e] = fn; } },
  regNama: { value: '', type: 'text', eventListeners: {}, addEventListener(e, fn) { this.eventListeners[e] = fn; } },
  regEmail: { value: '', type: 'email', eventListeners: {}, addEventListener(e, fn) { this.eventListeners[e] = fn; } },
  loginPassword: { value: '', type: 'password', eventListeners: {}, addEventListener(e, fn) { this.eventListeners[e] = fn; }, focus() { mockDoc.activeElement = this; } },
  regPassword: { value: '', type: 'password', eventListeners: {}, addEventListener(e, fn) { this.eventListeners[e] = fn; }, focus() { mockDoc.activeElement = this; } }
};

const mockDoc = {
  activeElement: null,
  getElementById: (id) => elements[id] || null,
  querySelector: (sel) => sel.includes('mascot-status-dot') ? elements.mascotStatusDot : null,
  addEventListener: () => {}
};

const mockGsap = {
  to: (targets, props) => {
    const list = Array.isArray(targets) ? targets : [targets];
    list.forEach(t => {
      const id = typeof t === 'string' ? t.replace('#', '') : t;
      if (elements[id]) {
        if (props.opacity !== undefined) elements[id].style.opacity = String(props.opacity);
        if (props.x !== undefined) elements[id].style.x = props.x;
        if (props.y !== undefined) elements[id].style.y = props.y;
        if (props.rotation !== undefined) elements[id].style.rotation = props.rotation;
      }
    });
  },
  fromTo: (targets, fromProps, toProps) => {
    const list = Array.isArray(targets) ? targets : [targets];
    list.forEach(t => {
      const id = typeof t === 'string' ? t.replace('#', '') : t;
      if (elements[id] && toProps.opacity !== undefined) {
        elements[id].style.opacity = String(toProps.opacity);
      }
    });
  },
  set: (targets, props) => {
    mockGsap.to(targets, props);
  },
  timeline: () => ({
    to: () => ({ to: () => {} })
  })
};

// Extract mascot script from index.html
const mascotScriptMatch = indexHtml.match(/\/\/ ===== 3\. ROBO-NESAS INTERACTIVE MASCOT ENGINE =====([\s\S]*?)\/\/ ===== 4\. SWITCH AUTH TAB/);
assert.ok(mascotScriptMatch, 'Blok kode mesin maskot Robo-NESAS harus ditemukan di index.html');

const activeTimers = [];
const mockSetTimeout = (fn, ms) => {
  const t = setTimeout(fn, ms);
  if (t && typeof t.unref === 'function') t.unref();
  activeTimers.push(t);
  return t;
};
const mockClearTimeout = (id) => {
  clearTimeout(id);
};

const sandbox = {
  document: mockDoc,
  window: {},
  gsap: mockGsap,
  setTimeout: mockSetTimeout,
  clearTimeout: mockClearTimeout,
  Math: Math,
  console: console
};
vm.createContext(sandbox);
vm.runInContext(mascotScriptMatch[1], sandbox);

// 3.1 Initial State Validation
sandbox.initRoboNesasMascot();
let st = sandbox.window.getMascotState();
assert.strictEqual(st.isEyesClosed, false, 'Awalnya mata robot tidak tertutup');
assert.strictEqual(st.isPeeking, false, 'Awalnya robot tidak mengintip');
assert.strictEqual(st.isBlushing, false, 'Awalnya robot tidak blushing');

// 3.2 Focus on Password Field -> Robot Closes Eyes (> <) & Blushing Pose Malu-Malu
sandbox.handlePasswordFocus({ target: elements.loginPassword });
st = sandbox.window.getMascotState();
assert.strictEqual(st.isEyesClosed, true, 'isEyesClosed harus true saat password focus');
assert.strictEqual(st.isPeeking, false, 'isPeeking harus false saat mata tertutup rapat');
assert.strictEqual(st.isBlushing, true, 'isBlushing harus true saat password focus');
assert.strictEqual(elements.closedEyesGroup.style.opacity, '1', 'closedEyesGroup harus tampak (opacity 1)');
assert.strictEqual(elements.blushCheeksGroup.style.opacity, '1', 'blushCheeksGroup harus tampak (opacity 1) saat pose malu-malu');
assert.strictEqual(elements.normalEyesGroup.style.opacity, '0', 'normalEyesGroup harus redup (opacity 0)');
assert.ok(elements.mascotStatusText.textContent.includes('Malu-Malu') || elements.mascotStatusText.textContent.includes('Menutup Mata'), 'Status text harus memuat pesan menutup mata / malu-malu');
assert.ok(elements.mascotHead.style.rotation < 0, 'Kepala robot harus tilt malu-malu ke samping');

// 3.3 Toggle Password Visibility (password -> text) -> One-Eye Peek (o <) with Blushing Still Active
sandbox.peekEyes(true);
st = sandbox.window.getMascotState();
assert.strictEqual(st.isPeeking, true, 'isPeeking harus true saat password visible');
assert.strictEqual(st.isBlushing, true, 'isBlushing tetap true saat mengintip malu-malu');
assert.strictEqual(elements.peekEyesGroup.style.opacity, '1', 'peekEyesGroup harus tampak (opacity 1)');
assert.strictEqual(elements.blushCheeksGroup.style.opacity, '1', 'blushCheeksGroup tetap tampak saat mengintip malu-malu');
assert.strictEqual(elements.closedEyesGroup.style.opacity, '0', 'closedEyesGroup harus redup saat mengintip');
assert.ok(elements.mascotStatusText.textContent.includes('Mengintip'), 'Status text harus memuat pesan mengintip');

// 3.4 Toggle Back (text -> password) -> Squeeze Eyes Closed Again (> <) & Blushing
sandbox.peekEyes(false);
st = sandbox.window.getMascotState();
assert.strictEqual(st.isPeeking, false, 'isPeeking harus false saat kembali ke masked');
assert.strictEqual(st.isEyesClosed, true, 'isEyesClosed tetap true saat kembali ke masked');
assert.strictEqual(st.isBlushing, true, 'isBlushing tetap true saat kembali ke masked');
assert.strictEqual(elements.closedEyesGroup.style.opacity, '1', 'closedEyesGroup harus kembali tampak (opacity 1)');
assert.strictEqual(elements.blushCheeksGroup.style.opacity, '1', 'blushCheeksGroup tetap tampak saat kembali ke masked');
assert.strictEqual(elements.peekEyesGroup.style.opacity, '0', 'peekEyesGroup harus redup');

// 3.5 Blur from Password to Outside -> Open Eyes Normal & Reset Blush
mockDoc.activeElement = elements.loginEmail;
sandbox.openEyes();
st = sandbox.window.getMascotState();
assert.strictEqual(st.isEyesClosed, false, 'isEyesClosed harus false saat blur ke luar');
assert.strictEqual(st.isPeeking, false, 'isPeeking harus false saat mata terbuka');
assert.strictEqual(st.isBlushing, false, 'isBlushing harus false saat mata terbuka');
assert.strictEqual(elements.normalEyesGroup.style.opacity, '1', 'normalEyesGroup harus tampak (opacity 1)');
assert.strictEqual(elements.blushCheeksGroup.style.opacity, '0', 'blushCheeksGroup harus redup (opacity 0)');
assert.strictEqual(elements.closedEyesGroup.style.opacity, '0', 'closedEyesGroup harus redup (opacity 0)');
assert.strictEqual(elements.mascotHead.style.rotation, 0, 'Kepala robot kembali tegak');
assert.ok(elements.mascotStatusText.textContent.includes('Siap Mengawasi Presensi'), 'Status text harus kembali ke siap mengawasi');

// 3.6 Dynamic Eye Tracking on Typing in Right Column
if (elements.loginEmail.eventListeners['input']) {
  elements.loginEmail.eventListeners['input']({ target: { value: 'siswa@gmail.com' } });
  assert.ok(elements.pupilLeft.style.x > 0, 'Pupil kiri harus melirik ke kanan ke arah kartu formulir');
  assert.ok(elements.pupilRight.style.x > 0, 'Pupil kanan harus melirik ke kanan ke arah kartu formulir');
  assert.ok(elements.mascotHead.style.rotation > 0, 'Kepala robot harus tilt ke kanan menghadap formulir input');
  assert.ok(elements.mascotStatusText.textContent.includes('Memperhatikan'), 'Status robot memperhatikan saat user mengetik');
}

// 3.7 Success Authentication -> Happy Arc Eyes (^ _ ^)
sandbox.triggerHappyEyes();
st = sandbox.window.getMascotState();
assert.strictEqual(st.isHappySuccess, true, 'isHappySuccess harus true saat autentikasi sukses');
assert.strictEqual(st.isBlushing, false, 'isBlushing harus false saat happy eyes');
assert.strictEqual(elements.happyEyesGroup.style.opacity, '1', 'happyEyesGroup harus tampak (opacity 1)');
assert.strictEqual(elements.blushCheeksGroup.style.opacity, '0', 'blushCheeksGroup harus redup saat happy eyes');
assert.strictEqual(elements.normalEyesGroup.style.opacity, '0', 'normalEyesGroup harus redup saat happy eyes');
assert.ok(elements.mascotStatusText.textContent.includes('Presensi Berhasil'), 'Status text harus selebrasi presensi berhasil');

console.log('✓ Maskot Robo-NESAS: Watch ke Kanan, Closed Eyes Blushing (> <), One-Eye Peek (o <), dan Happy Eyes (^ _ ^) teruji secara fungsional 100%');

// TEST 4: Keutuhan Seluruh ID DOM Form & Auth
console.log('\n[Test 4] Validasi Keutuhan Seluruh 17 ID DOM Form Login, Register & Auth');
const requiredIds = [
  'formLogin',
  'loginEmail',
  'loginPassword',
  'btnActionLogin',
  'btnGoogleLogin',
  'formRegister',
  'regNama',
  'regEmail',
  'regPassword',
  'btnActionRegister',
  'authSuccessOverlay',
  'liveClock',
  'notifBoxLogin',
  'notifBoxRegister',
  'modalLupaPassword',
  'resetEmail',
  'btnKirimReset'
];

requiredIds.forEach(id => {
  assert.ok(indexHtml.includes(`id="${id}"`), `Elemen DOM id="${id}" tidak boleh hilang`);
});
console.log('✓ Seluruh 17 elemen DOM autentikasi dan form login/register tetap 100% utuh');

// TEST 5: Isolasi Administrator & Penanganan Error Ramah
console.log('\n[Test 5] Validasi Isolasi Admin & Penanganan Error Ramah Pengguna');
assert.ok(indexHtml.includes('Akses Ditolak: Akun Administrator memiliki portal login khusus di admin-login.html'), 'Blokir email admin harus aktif');
assert.ok(indexHtml.includes('auth/network-request-failed'), 'Penanganan network-request-failed harus eksplisit');
assert.ok(indexHtml.includes('auth/popup-blocked'), 'Penanganan popup-blocked harus eksplisit');
assert.ok(indexHtml.includes('file://'), 'Penjelasan protokol file:// harus disertakan');
console.log('✓ Keamanan isolasi admin dan feedback error ramah pengguna terverifikasi');

console.log('\n=======================================================');
console.log('SEMUA PENGUJIAN PORTAL ROBO-NESAS BERHASIL! (5/5 PASSED)');
console.log('=======================================================');
