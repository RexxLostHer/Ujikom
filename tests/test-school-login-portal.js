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
assert.ok(indexHtml.includes('max-width: 500px'), 'Kartu auth-form-card harus berukuran lapang max-width 500px');
assert.ok(indexHtml.includes('padding: 2.5rem 2.4rem'), 'Kartu auth-form-card harus memiliki padding lapang 2.5rem 2.4rem');
assert.ok(indexHtml.includes('grid-template-columns: 1fr 1.1fr'), 'Container harus menggunakan grid-template-columns 1fr 1.1fr yang seimbang dan lapang');
console.log('✓ Branding SMKN 1 Sumedang, Split 2-Slide Portal Layout, dan Kartu Lapang terverifikasi aktif');

// TEST 2: Jam Digital Live Sekolah, Sesi Presensi & Telemetri IoT
console.log('\n[Test 2] Validasi Jam Digital Live Sekolah & Telemetri Realtime');
assert.ok(indexHtml.includes('id="liveClock"'), 'index.html harus memiliki elemen id="liveClock"');
assert.ok(indexHtml.includes('updateSchoolClock'), 'Fungsi updateSchoolClock harus ada untuk live clock');
assert.ok(indexHtml.includes('06.30 - 08.00 WIB'), 'Informasi sesi pagi 06.30 - 08.00 WIB harus tertera');
assert.ok(indexHtml.includes('ESP32'), 'Telemetri hardware gateway ESP32 harus tertera');
assert.ok(indexHtml.includes('Firebase Realtime Database Connected'), 'Status cloud sync Firebase harus tertera');
console.log('✓ Live school clock (#liveClock), sesi presensi, dan telemetri IoT terverifikasi lengkap');

// TEST 3: Maskot Robot Presensi Cerdas "Robo-NESAS" (Full Robotic Body Chassis, Clean Closed Eyes & One-Eye Peek)
console.log('\n[Test 3] Validasi Maskot Robot Robo-NESAS: Full Body Chassis, Eye Tracking ke Kanan, Clean Closed Eyes & Peeking');
assert.ok(indexHtml.includes('id="roboNesasMascot"'), 'index.html harus memuat elemen SVG maskot #roboNesasMascot');
assert.ok(indexHtml.includes('id="mascotStage"'), 'index.html harus memuat panggung maskot #mascotStage');
assert.ok(indexHtml.includes('id="pupilLeft"') && indexHtml.includes('id="pupilRight"'), 'Maskot harus memiliki pupil kiri dan kanan');
assert.ok(indexHtml.includes('id="closedEyesGroup"'), 'Maskot harus memiliki elemen/state mata tertutup (#closedEyesGroup)');
assert.ok(indexHtml.includes('id="peekEyesGroup"'), 'Maskot harus memiliki elemen/state satu mata mengintip (#peekEyesGroup)');
assert.ok(!indexHtml.includes('id="blushCheeksGroup"'), 'Efek blush / rona pipi (#blushCheeksGroup) harus sudah dihapus total');
assert.ok(!indexHtml.includes('pinkBlushGlow'), 'Filter rona pink (#pinkBlushGlow) harus sudah dihapus total');

// Validasi Full Body Chassis Robot
assert.ok(indexHtml.includes('id="neckJoint"'), 'Maskot harus memiliki leher mekanik / collar joint (#neckJoint)');
assert.ok(indexHtml.includes('id="roboTorso"'), 'Maskot harus memiliki panel dada / torso chassis (#roboTorso)');
assert.ok(indexHtml.includes('id="upperBodyChassis"'), 'Maskot harus memiliki container sasis tubuh atas (#upperBodyChassis)');
assert.ok(indexHtml.includes('id="powerCore"'), 'Maskot harus memiliki glowing power core reactor (#powerCore)');
assert.ok(indexHtml.includes('id="shoulderLeft"') && indexHtml.includes('id="shoulderRight"'), 'Maskot harus memiliki bahu mekanik (shoulder pads)');
assert.ok(indexHtml.includes('id="roboWaist"'), 'Maskot harus memiliki pinggang mekanik (#roboWaist)');
assert.ok(indexHtml.includes('id="hoverPodBase"') && indexHtml.includes('id="robotLegs"'), 'Maskot harus memiliki base hover pod dan kaki robotik');

assert.ok(indexHtml.includes('id="armLeft"') && indexHtml.includes('id="armRight"'), 'Maskot harus memiliki lengan mekanik kiri dan kanan di posisi santai');
assert.ok(indexHtml.includes('id="fingersLeft"') && indexHtml.includes('id="fingersRight"'), 'Maskot harus memiliki jari robotik kiri dan kanan');
assert.ok(indexHtml.includes('id="mascotAntenna"') && indexHtml.includes('id="antennaLight"'), 'Maskot harus memiliki antena dan lampu beacon (#mascotAntenna, #antennaLight)');
assert.ok(/<g id="mascotHead">[\s\S]*?id="mascotAntenna"/.test(indexHtml), 'Antena harus terintegrasi di dalam #mascotHead agar bergerak selaras saat kepala tilt');
assert.ok(indexHtml.includes('id="happyEyesGroup"'), 'Maskot harus memiliki happy arc eyes untuk selebrasi sukses');
assert.ok(indexHtml.includes('closeEyes') || indexHtml.includes('coverEyes'), 'Logika menutup mata (closeEyes/coverEyes) saat password focused harus ada');
assert.ok(indexHtml.includes('peekEyes') || indexHtml.includes('peekMascotEyes'), 'Logika mengintip (peekEyes) saat toggle password diklik harus ada');
assert.ok(indexHtml.includes('triggerHappyEyes') || indexHtml.includes('happyMascotEyes'), 'Logika happy eyes saat sukses presensi harus ada');
assert.ok(indexHtml.includes('🙈 Robo-NESAS Menutup Mata... (Sensor Nonaktif)'), 'Pesan status tutup mata bersih (Sensor Nonaktif) harus ada');
assert.ok(indexHtml.includes('👀 Robo-NESAS Mengintip Sandi...'), 'Pesan status mengintip sandi bersih harus ada');

// Deep Functional Simulation: DOM & Event Loop Validation
const vm = require('vm');
const elements = {
  roboNesasMascot: {
    getBoundingClientRect: () => ({ left: 100, top: 100, width: 280, height: 330 })
  },
  upperBodyChassis: { style: {} },
  roboTorso: { style: {} },
  neckJoint: { style: {} },
  mascotRoot: { style: {} },
  mascotStatusText: { textContent: '' },
  mascotStatusDot: { style: {} },
  normalEyesGroup: { style: { opacity: '1' } },
  closedEyesGroup: { style: { opacity: '0' } },
  peekEyesGroup: { style: { opacity: '0' } },
  happyEyesGroup: { style: { opacity: '0' } },
  pupilLeft: { style: {} },
  pupilRight: { style: {} },
  mascotHead: { style: {} },
  armLeft: { style: {} },
  armRight: { style: {} },
  fingersLeft: { style: {} },
  fingersRight: { style: {} },
  antennaLight: { style: {} },
  powerCoreCenter: { style: {} },
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
        if (props.fill !== undefined) elements[id].style.fill = props.fill;
        if (props.scale !== undefined) elements[id].style.scale = props.scale;
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

const windowEventListeners = {};
const sandbox = {
  document: mockDoc,
  window: {
    innerWidth: 1200,
    innerHeight: 800,
    addEventListener: (evt, fn) => { windowEventListeners[evt] = fn; },
    requestAnimationFrame: (fn) => setTimeout(fn, 0)
  },
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

// 3.2 Focus on Password Field -> Robot Closes Eyes (> <) Clean Without Blush
sandbox.handlePasswordFocus({ target: elements.loginPassword });
st = sandbox.window.getMascotState();
assert.strictEqual(st.isEyesClosed, true, 'isEyesClosed harus true saat password focus');
assert.strictEqual(st.isPeeking, false, 'isPeeking harus false saat mata tertutup rapat');
assert.strictEqual(elements.closedEyesGroup.style.opacity, '1', 'closedEyesGroup harus tampak (opacity 1)');
assert.strictEqual(elements.normalEyesGroup.style.opacity, '0', 'normalEyesGroup harus redup (opacity 0)');
assert.ok(elements.mascotStatusText.textContent.includes('🙈 Robo-NESAS Menutup Mata... (Sensor Nonaktif)'), 'Status text harus memuat pesan menutup mata sensor nonaktif');
assert.strictEqual(elements.mascotHead.style.rotation, -8, 'Kepala robot harus tilt -8deg');
assert.strictEqual(elements.armLeft.style.x, 2, 'Lengan kiri merapat ke bodi');
assert.strictEqual(elements.armRight.style.x, -2, 'Lengan kanan merapat ke bodi');
assert.ok((elements.upperBodyChassis.style.x < 0) || (elements.roboTorso.style.x < 0), 'Badan robot condong santai/malu ke kiri saat password focus');
assert.ok(elements.neckJoint.style.x < 0, 'Leher robot condong santai/malu ke kiri saat password focus');

// 3.3 Toggle Password Visibility (password -> text) -> One-Eye Peek (o <) Clean
sandbox.peekEyes(true);
st = sandbox.window.getMascotState();
assert.strictEqual(st.isPeeking, true, 'isPeeking harus true saat password visible');
assert.strictEqual(elements.peekEyesGroup.style.opacity, '1', 'peekEyesGroup harus tampak (opacity 1)');
assert.strictEqual(elements.closedEyesGroup.style.opacity, '0', 'closedEyesGroup harus redup saat mengintip');
assert.ok(elements.mascotStatusText.textContent.includes('👀 Robo-NESAS Mengintip Sandi...'), 'Status text harus memuat pesan mengintip sandi');

// 3.4 Toggle Back (text -> password) -> Squeeze Eyes Closed Again (> <) Clean
sandbox.peekEyes(false);
st = sandbox.window.getMascotState();
assert.strictEqual(st.isPeeking, false, 'isPeeking harus false saat kembali ke masked');
assert.strictEqual(st.isEyesClosed, true, 'isEyesClosed tetap true saat kembali ke masked');
assert.strictEqual(elements.closedEyesGroup.style.opacity, '1', 'closedEyesGroup harus kembali tampak (opacity 1)');
assert.strictEqual(elements.peekEyesGroup.style.opacity, '0', 'peekEyesGroup harus redup');
assert.strictEqual(elements.mascotHead.style.rotation, -8, 'Kepala robot tetap tilt -8deg saat kembali masked');

// 3.5 Blur from Password to Outside -> Open Eyes Normal
mockDoc.activeElement = elements.loginEmail;
sandbox.openEyes();
st = sandbox.window.getMascotState();
assert.strictEqual(st.isEyesClosed, false, 'isEyesClosed harus false saat blur ke luar');
assert.strictEqual(st.isPeeking, false, 'isPeeking harus false saat mata terbuka');
assert.strictEqual(elements.normalEyesGroup.style.opacity, '1', 'normalEyesGroup harus tampak (opacity 1)');
assert.strictEqual(elements.closedEyesGroup.style.opacity, '0', 'closedEyesGroup harus redup (opacity 0)');
assert.strictEqual(elements.mascotHead.style.rotation, 0, 'Kepala robot kembali tegak');
assert.strictEqual(elements.upperBodyChassis.style.x ?? elements.roboTorso.style.x, 0, 'Badan robot kembali tegak');
assert.strictEqual(elements.neckJoint.style.x, 0, 'Leher robot kembali tegak');
assert.ok(elements.mascotStatusText.textContent.includes('Siap Mengawasi Presensi'), 'Status text harus kembali ke siap mengawasi');

// 3.6 Focus Transition: Password -> Gmail Input (Validasi Fix Bug Mata Tertutup)
sandbox.handlePasswordFocus({ target: elements.loginPassword });
assert.strictEqual(sandbox.window.getMascotState().isEyesClosed, true, 'Mata robot harus tertutup saat di password field');

// User kemudian klik field email Gmail (loginEmail)
mockDoc.activeElement = elements.loginEmail;
if (elements.loginEmail.eventListeners['focus']) {
  elements.loginEmail.eventListeners['focus']({ target: elements.loginEmail });
}
st = sandbox.window.getMascotState();
assert.strictEqual(st.isEyesClosed, false, 'Mata robot HARUS otomatis terbuka saat pindah dari password ke email');
assert.strictEqual(elements.normalEyesGroup.style.opacity, '1', 'normalEyesGroup harus kembali tampak (opacity 1)');
assert.ok(elements.pupilLeft.style.x > 0, 'Pupil melirik memperhatikan email');

// 3.7 Focus & Input on Register Form Fields (regPassword, regNama, regEmail)
sandbox.handlePasswordFocus({ target: elements.regPassword });
st = sandbox.window.getMascotState();
assert.strictEqual(st.isEyesClosed, true, 'isEyesClosed harus true saat regPassword focus');

sandbox.openEyes();

if (elements.regNama.eventListeners['input']) {
  elements.regNama.eventListeners['input']({ target: { value: 'Asep Saepuloh' } });
  assert.ok(elements.pupilLeft.style.x > 0, 'Pupil kiri harus melirik ke arah formulir');
  assert.ok(elements.mascotHead.style.rotation > 0, 'Kepala tilt ke arah formulir saat regNama input');
}

if (elements.regEmail.eventListeners['input']) {
  elements.regEmail.eventListeners['input']({ target: { value: 'asep@gmail.com' } });
  assert.ok(elements.pupilLeft.style.x > 0, 'Pupil kiri harus melirik ke arah formulir');
  assert.ok(elements.mascotHead.style.rotation > 0, 'Kepala tilt ke arah formulir saat regEmail input');
}

// 3.8 Dynamic Eye Tracking & Body Leaning on Typing in Right Column
if (elements.loginEmail.eventListeners['input']) {
  elements.loginEmail.eventListeners['input']({ target: { value: 'siswa@gmail.com' } });
  assert.ok(elements.pupilLeft.style.x >= 7, 'Pupil kiri harus melirik ke kanan ke arah kartu formulir (x >= 7px)');
  assert.ok(elements.pupilRight.style.x >= 7, 'Pupil kanan harus melirik ke kanan ke arah kartu formulir (x >= 7px)');
  assert.ok(elements.mascotHead.style.rotation >= 5, 'Kepala robot harus tilt ke kanan menghadap formulir input (rotation >= 5deg)');
  assert.ok((elements.upperBodyChassis.style.x >= 4) || (elements.roboTorso.style.x >= 4), 'Badan/torso robot harus condong ke kanan (x >= 4px) saat mengetik');
  assert.ok((elements.upperBodyChassis.style.rotation >= 2.5) || (elements.roboTorso.style.rotation >= 2.5), 'Badan/torso robot harus rotasi ke kanan (rotation >= 2.5deg) saat mengetik');
  assert.ok(elements.neckJoint.style.x >= 3, 'Leher robot harus condong ke kanan (x >= 3px) saat mengetik');
  assert.ok(elements.neckJoint.style.rotation >= 2, 'Leher robot harus rotasi ke kanan (rotation >= 2deg) saat mengetik');
  assert.ok(elements.mascotStatusText.textContent.includes('Memperhatikan'), 'Status robot memperhatikan saat user mengetik');
}

// 3.8.1 Interactive Mouse Tracking (Opsi 2)
if (typeof sandbox.window.updateMouseGaze === 'function') {
  if (elements.loginEmail.eventListeners['blur']) {
    elements.loginEmail.eventListeners['blur']();
  }
  // Gaze to right
  sandbox.window.updateMouseGaze(900, 200);
  assert.ok(elements.pupilLeft.style.x > 0, 'Pupil kiri melacak kursor mouse ke arah kanan');
  assert.ok(elements.mascotHead.style.rotation > 0, 'Kepala robot menoleh ke arah kursor mouse (kanan)');
  assert.ok((elements.upperBodyChassis.style.x > 0) || (elements.roboTorso.style.x > 0), 'Badan robot condong mikro mengikuti kursor mouse');
  assert.ok(elements.neckJoint.style.x > 0, 'Leher robot condong mikro mengikuti kursor mouse');

  // Gaze to left
  sandbox.window.updateMouseGaze(50, 200);
  assert.ok(elements.pupilLeft.style.x < 0, 'Pupil kiri melacak kursor mouse ke arah kiri');
  assert.ok(elements.mascotHead.style.rotation < 0, 'Kepala robot menoleh ke arah kursor mouse (kiri)');
  assert.ok((elements.upperBodyChassis.style.x < 0) || (elements.roboTorso.style.x < 0), 'Badan robot condong mikro ke kiri');
  assert.ok(elements.neckJoint.style.x < 0, 'Leher robot condong mikro ke kiri');

  // Focus immunity: input focus overrides mouse tracking
  mockDoc.activeElement = elements.loginEmail;
  elements.loginEmail.eventListeners['focus']({ target: elements.loginEmail });
  elements.loginEmail.eventListeners['input']({ target: { value: 'test@gmail.com' } });
  const torsoLeaningX = elements.upperBodyChassis.style.x ?? elements.roboTorso.style.x;
  assert.ok(torsoLeaningX >= 4, 'Badan harus condong ke kanan (x >= 4px) saat input fokus');
  
  // Try to move mouse to left while input is focused -> must be ignored!
  sandbox.window.updateMouseGaze(50, 200);
  assert.strictEqual(elements.upperBodyChassis.style.x ?? elements.roboTorso.style.x, torsoLeaningX, 'Mouse tracking tidak boleh menginterupsi mode fokus input formulir');
  
  // Blur resets back
  elements.loginEmail.eventListeners['blur']();
  mockDoc.activeElement = null;
}

// 3.9 Success Authentication -> Happy Arc Eyes (^ _ ^)
sandbox.triggerHappyEyes();
st = sandbox.window.getMascotState();
assert.strictEqual(st.isHappySuccess, true, 'isHappySuccess harus true saat autentikasi sukses');
assert.strictEqual(elements.happyEyesGroup.style.opacity, '1', 'happyEyesGroup harus tampak (opacity 1)');
assert.strictEqual(elements.normalEyesGroup.style.opacity, '0', 'normalEyesGroup harus redup saat happy eyes');
assert.strictEqual(elements.antennaLight.style.fill, '#10b981', 'Beacon antenna harus pulse hijau saat selebrasi sukses');
assert.strictEqual(elements.powerCoreCenter.style.fill, '#10b981', 'Power core reactor harus pulse hijau saat selebrasi sukses');
assert.ok(elements.mascotStatusText.textContent.includes('Presensi Berhasil'), 'Status text harus selebrasi presensi berhasil');

// Reset to openEyes -> Antenna beacon & power core glow return to cyan #38bdf8
sandbox.openEyes();
st = sandbox.window.getMascotState();
assert.strictEqual(st.isHappySuccess, false, 'isHappySuccess kembali false');
assert.strictEqual(elements.antennaLight.style.fill, '#38bdf8', 'Antenna beacon kembali ke cyan saat openEyes');
assert.strictEqual(elements.powerCoreCenter.style.fill, '#38bdf8', 'Power core reactor kembali ke cyan saat openEyes');

// 3.10 Validation of Fallback Mode without GSAP
const fallbackElements = {
  roboNesasMascot: {
    getBoundingClientRect: () => ({ left: 100, top: 100, width: 280, height: 330 })
  },
  upperBodyChassis: { style: {} },
  roboTorso: { style: {} },
  neckJoint: { style: {} },
  mascotRoot: { style: {} },
  mascotStatusText: { textContent: '' },
  mascotStatusDot: { style: {} },
  normalEyesGroup: { style: { opacity: '1' } },
  closedEyesGroup: { style: { opacity: '0' } },
  peekEyesGroup: { style: { opacity: '0' } },
  happyEyesGroup: { style: { opacity: '0' } },
  mascotHead: { style: {} },
  armLeft: { style: {} },
  armRight: { style: {} },
  pupilLeft: { style: {} },
  pupilRight: { style: {} }
};
const fallbackSandbox = {
  document: {
    getElementById: (id) => fallbackElements[id] || null,
    querySelector: () => fallbackElements.mascotStatusDot,
    addEventListener: () => {}
  },
  window: {
    innerWidth: 1200,
    innerHeight: 800,
    addEventListener: () => {}
  },
  setTimeout: () => {},
  clearTimeout: () => {}
};
vm.createContext(fallbackSandbox);
vm.runInContext(mascotScriptMatch[1], fallbackSandbox);

fallbackSandbox.closeEyes();
assert.strictEqual(fallbackElements.closedEyesGroup.style.opacity, '1', 'Fallback closed eyes harus opacity 1');
assert.ok(fallbackElements.mascotHead.style.transform.includes('-8deg'), 'Fallback mascotHead transform harus tilt -8deg');
assert.ok(fallbackElements.armLeft.style.transform.includes('2px'), 'Fallback armLeft transform harus merapat');
assert.ok(fallbackElements.upperBodyChassis.style.transform.includes('-1.5deg') || fallbackElements.roboTorso.style.transform.includes('-1.5deg'), 'Fallback upper body transform harus condong malu saat closedEyes');
assert.ok(fallbackElements.neckJoint.style.transform.includes('-1.2deg'), 'Fallback neckJoint transform harus condong saat closedEyes');

// Fallback Peek mode
fallbackSandbox.peekEyes(true);
assert.strictEqual(fallbackElements.peekEyesGroup.style.opacity, '1', 'Fallback peek eyes harus opacity 1');
assert.ok(fallbackElements.upperBodyChassis.style.transform.includes('1.2deg') || fallbackElements.roboTorso.style.transform.includes('1.2deg'), 'Fallback upper body transform harus nongol mengintip (1.2deg) saat peekEyes');
assert.ok(fallbackElements.neckJoint.style.transform.includes('1.0deg'), 'Fallback neckJoint transform harus condong mengintip (1.0deg) saat peekEyes');

fallbackSandbox.openEyes();
assert.strictEqual(fallbackElements.normalEyesGroup.style.opacity, '1', 'Fallback normal eyes harus opacity 1');
assert.strictEqual(fallbackElements.mascotHead.style.transform, 'none', 'Fallback mascotHead transform harus none');
assert.strictEqual(fallbackElements.upperBodyChassis.style.transform || fallbackElements.roboTorso.style.transform, 'none', 'Fallback upper body transform harus none');
assert.strictEqual(fallbackElements.neckJoint.style.transform, 'none', 'Fallback neckJoint transform harus none');
assert.strictEqual(fallbackElements.pupilLeft.style.transform, 'none', 'Fallback pupilLeft transform harus reset none saat openEyes');

// Fallback mouse tracking test
if (typeof fallbackSandbox.window.updateMouseGaze === 'function') {
  fallbackSandbox.window.updateMouseGaze(900, 200);
  assert.ok(fallbackElements.pupilLeft.style.x > 0, 'Fallback pupilLeft melacak mouse');
  assert.ok(fallbackElements.pupilLeft.style.transform.includes('px'), 'Fallback pupilLeft style.transform harus translate px');
  assert.ok(fallbackElements.mascotHead.style.rotation > 0, 'Fallback mascotHead rotation melacak mouse');
  assert.ok(fallbackElements.upperBodyChassis.style.rotation > 0 || fallbackElements.roboTorso.style.rotation > 0, 'Fallback upper body rotation melacak mouse');
  assert.ok(fallbackElements.neckJoint.style.rotation > 0, 'Fallback neckJoint rotation melacak mouse');

  fallbackSandbox.window.updateMouseGaze(50, 200);
  assert.ok(fallbackElements.pupilLeft.style.x < 0, 'Fallback pupilLeft melacak mouse ke kiri');
  assert.ok(fallbackElements.mascotHead.style.rotation < 0, 'Fallback mascotHead menoleh ke kiri');
}

console.log('✓ Maskot Robo-NESAS: Full Body Chassis, Watch ke Kanan, Condong Tubuh & Leher, Clean Closed Eyes (> <), One-Eye Peek (o <), dan Happy Eyes (^ _ ^) teruji secara fungsional 100%');

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
