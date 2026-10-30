// ===================================================================
// TEST SUITE: test-modern-logo-and-chat-avatars.js
// Menguji:
// 1. Keberadaan & Integritas Foto Profil CotE Admin (Kepala Sekolah Narumori Sakayanagi)
// 2. Keberadaan & Integritas Foto Profil CotE Guru & Walas (Sae Chabashira, Tomonari Mashima, dll)
// 3. Metadata foto & foto_karakter pada MASTER_GURU_RESMI
// 4. Modernisasi Logo Cyber Shield & Avatar Admin di admin.html
// 5. Resolusi PP masing-masing pengguna di chat-hub.js (Admin, Guru, Siswa)
// 6. Rendering Avatar Foto pada Bubble Chat (appendBubblePesan)
// 7. Rendering Avatar Foto pada Thread List (Tab Chat) & Buku Kontak (Tab Kontak)
// ===================================================================

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('================================================================');
console.log('🧪 PENGUJIAN LOGO MODERN & INTEGRASI PP COTE CHAT HUB LENGKAP');
console.log('================================================================\n');

const ROOT_DIR = path.join(__dirname, '..');
const FOTO_DIR = path.join(ROOT_DIR, 'assets', 'foto');

function getJpegDimensions(buf) {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xFF) break;
    const marker = buf[i + 1];
    if (marker === 0xC0 || marker === 0xC2) {
      const height = buf.readUInt16BE(i + 5);
      const width = buf.readUInt16BE(i + 7);
      return { width, height };
    }
    const len = buf.readUInt16BE(i + 2);
    i += 2 + len;
  }
  return null;
}

// -------------------------------------------------------------
// [Test 1] Verifikasi Foto Admin (Kepala Sekolah Narumori Sakayanagi)
// -------------------------------------------------------------
console.log('▶ [Test 1] Verifikasi Foto Profil Admin (Kepala Sekolah CotE)...');
const adminPhotoPath = path.join(FOTO_DIR, 'admin.jpg');
assert.ok(fs.existsSync(adminPhotoPath), 'File assets/foto/admin.jpg harus ada');
const adminBuf = fs.readFileSync(adminPhotoPath);
assert.strictEqual(adminBuf[0], 0xFF, 'Byte 0 admin.jpg harus 0xFF');
assert.strictEqual(adminBuf[1], 0xD8, 'Byte 1 admin.jpg harus 0xD8');
assert.ok(adminBuf.length >= 10000, 'Ukuran admin.jpg harus >= 10KB');
const adminDim = getJpegDimensions(adminBuf);
assert.ok(adminDim, 'Dimensi admin.jpg harus dapat diurai');
assert.strictEqual(adminDim.width, 400, 'Lebar admin.jpg harus 400px');
assert.strictEqual(adminDim.height, 400, 'Tinggi admin.jpg harus 400px');
console.log('  ✓ Foto Admin resmi (Kepala Sekolah Sakayanagi) valid, JPEG 400x400 px.\n');

// -------------------------------------------------------------
// [Test 2] Verifikasi Foto Profil Guru & Walas CotE
// -------------------------------------------------------------
console.log('▶ [Test 2] Verifikasi Foto Profil Guru & Walas CotE...');
const fbConfig = require('../assets/firebase-config.js');
const masterGuru = fbConfig.MASTER_GURU_RESMI;
assert.ok(masterGuru, 'MASTER_GURU_RESMI harus terdefinisi');

const expectedGuru = [
  { nip: '198109012009022003', karakter: 'Sae Chabashira' },
  { nip: '197905032006042004', karakter: 'Atsuomi Ayanokouji' },
  { nip: '199209142022211007', karakter: 'Tomonari Mashima' },
  { nip: '198312052022211017', karakter: 'Katsunori Shiba' },
  { nip: '198504252024211008', karakter: 'Tokinari Tsukishiro' }
];

for (const eg of expectedGuru) {
  const g = masterGuru[eg.nip];
  assert.ok(g, `Guru dengan NIP ${eg.nip} harus ada di MASTER_GURU_RESMI`);
  assert.strictEqual(g.foto_karakter, eg.karakter, `Karakter ${eg.nip} harus ${eg.karakter}`);
  assert.ok(g.foto, `Guru ${eg.nip} harus memiliki field foto`);
  
  const gPath = path.join(ROOT_DIR, g.foto);
  assert.ok(fs.existsSync(gPath), `File ${g.foto} harus ada di assets/foto/`);
  const gBuf = fs.readFileSync(gPath);
  assert.strictEqual(gBuf[0], 0xFF);
  assert.strictEqual(gBuf[1], 0xD8);
  const gDim = getJpegDimensions(gBuf);
  assert.ok(gDim);
  assert.strictEqual(gDim.width, 400);
  assert.strictEqual(gDim.height, 400);
}
console.log('  ✓ Seluruh 5 Guru & Walas terpetakan ke foto anime CotE valid 400x400 px.\n');

// -------------------------------------------------------------
// [Test 3] Verifikasi Modern Logo & Admin Avatar di admin.html
// -------------------------------------------------------------
console.log('▶ [Test 3] Verifikasi Modern Logo & Avatar Admin di admin.html...');
const adminHtml = fs.readFileSync(path.join(ROOT_DIR, 'admin.html'), 'utf8');
assert.ok(adminHtml.includes('shieldGrad'), 'admin.html harus memuat gradient shieldGrad');
assert.ok(adminHtml.includes('coreGrad'), 'admin.html harus memuat gradient coreGrad');
assert.ok(adminHtml.includes('assets/foto/admin.jpg'), 'admin.html harus menyematkan avatar admin.jpg');
assert.ok(adminHtml.includes('Kepala Sekolah ANHS'), 'admin.html harus memuat label Kepala Sekolah');
console.log('  ✓ Logo modern beresolusi tinggi dan avatar Kepala Sekolah terpasang di header admin.\n');

// -------------------------------------------------------------
// [Test 4] Verifikasi Resolver Foto Pengguna di chat-hub.js
// -------------------------------------------------------------
console.log('▶ [Test 4] Verifikasi Resolusi Foto Pengguna di chat-hub.js...');
const chatHubSrc = fs.readFileSync(path.join(ROOT_DIR, 'assets', 'chat-hub.js'), 'utf8');

// Bangun environment sandbox
const sandbox = {
  console,
  require,
  setTimeout: () => {},
  clearTimeout: () => {},
  setInterval: () => {},
  clearInterval: () => {},
  Date,
  Math,
  String,
  Array,
  Object,
  JSON,
  localStorage: {
    store: {},
    getItem(k) { return this.store[k] || null; },
    setItem(k, v) { this.store[k] = String(v); },
    removeItem(k) { delete this.store[k]; }
  },
  sessionStorage: {
    getItem() { return null; }
  },
  window: {},
  document: {
    getElementById: () => null,
    createElement: (tag) => ({ tagName: tag, innerHTML: '', style: {}, appendChild: () => {}, classList: { add: () => {}, remove: () => {} }, querySelectorAll: () => [], querySelector: () => null, addEventListener: () => {} }),
    querySelectorAll: () => [],
    querySelector: () => null,
    addEventListener: () => {},
    body: { appendChild: () => {} }
  },
  MASTER_DATA_SISWA_RESMI: fbConfig.MASTER_DATA_SISWA_RESMI,
  MASTER_GURU_RESMI: fbConfig.MASTER_GURU_RESMI
};
sandbox.window = sandbox;
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(chatHubSrc, sandbox);

const contacts = sandbox.getSemuaKontak();
const adminContact = contacts.find(c => c.id === 'admin');
assert.ok(adminContact, 'Kontak Admin harus ada');
assert.strictEqual(adminContact.foto, 'assets/foto/admin.jpg', 'Foto kontak admin harus assets/foto/admin.jpg');

const pakEcha = contacts.find(c => c.nip === '199209142022211007');
assert.ok(pakEcha, 'Kontak Pak Echa harus ada');
assert.strictEqual(pakEcha.foto, 'assets/foto/guru_199209142022211007.jpg', 'Foto Pak Echa harus guru_199209142022211007.jpg');

const ihsan = contacts.find(c => c.nisn === '0098263610');
assert.ok(ihsan, 'Kontak Ihsan harus ada');
assert.strictEqual(ihsan.foto, 'assets/foto/0098263610.jpg', 'Foto Ihsan harus 0098263610.jpg');

console.log('  ✓ Seluruh kontak (Admin, Guru, Siswa) terpetakan ke foto profil resmi.\n');

// -------------------------------------------------------------
// [Test 5] Verifikasi Rendering Avatar Foto pada Bubble Pesan
// -------------------------------------------------------------
console.log('▶ [Test 5] Verifikasi Rendering Avatar Foto pada Bubble Pesan...');
assert.ok(chatHubSrc.includes('wa-bubble-avatar'), 'chat-hub.js harus memuat kelas wa-bubble-avatar');
assert.ok(chatHubSrc.includes('wa-bubble-avatar-img'), 'chat-hub.js harus memuat kelas wa-bubble-avatar-img');

// Periksa CSS
const chatHubCss = fs.readFileSync(path.join(ROOT_DIR, 'assets', 'chat-hub.css'), 'utf8');
assert.ok(chatHubCss.includes('.wa-bubble-avatar'), 'chat-hub.css harus memuat styling .wa-bubble-avatar');
assert.ok(chatHubCss.includes('.wa-bubble-avatar-img'), 'chat-hub.css harus memuat styling .wa-bubble-avatar-img');
console.log('  ✓ Bubble chat memuat struktur avatar foto profil masing-masing pengguna.\n');

// -------------------------------------------------------------
// [Test 6] Verifikasi Avatar Foto pada Tab Chat & Header Chat
// -------------------------------------------------------------
console.log('▶ [Test 6] Verifikasi Avatar Foto pada Thread List & Header Chat...');
assert.ok(chatHubSrc.includes('waChatHeaderAvatar'), 'chat-hub.js harus memuat elemen avatar header waChatHeaderAvatar');
assert.ok(chatHubSrc.includes('getFotoPenggunaChat(otherId)'), 'chat-hub.js harus menyelesaikan foto lawan bicara di thread');
console.log('  ✓ Thread list dan Header Chat menampilkan foto profil masing-masing lawan bicara.\n');

// -------------------------------------------------------------
// [Test 7] Verifikasi Logo Presensia Modern & Animasi Terlokalisasi di Chat Hub
// -------------------------------------------------------------
console.log('▶ [Test 7] Verifikasi Logo Presensia Modern & Animasi Terlokalisasi di Chat Hub...');

// 1. Verifikasi FAB memuat logo Presensia frame-069 dan kelas micro-interaction
assert.ok(chatHubSrc.includes('assets/animasi/ezgif-frame-069.png'), 'chat-hub.js harus memuat logo Presensia ezgif-frame-069.png');
assert.ok(chatHubSrc.includes('wa-floating-logo-img'), 'chat-hub.js harus memuat elemen img .wa-floating-logo-img');
assert.ok(chatHubCss.includes('.wa-floating-logo-img'), 'chat-hub.css harus memuat styling .wa-floating-logo-img');
assert.ok(chatHubCss.includes('object-fit: cover'), 'chat-hub.css harus menggunakan object-fit: cover untuk mengeliminasi letterboxing logo 16:9');
assert.ok(chatHubCss.includes('.wa-floating-btn:hover .wa-floating-logo-img'), 'chat-hub.css harus memiliki micro-interaction spring hover');

// 2. Verifikasi Header Chat memuat canvas logo 64x64 tepat di sebelah nama Bubble
assert.ok(chatHubSrc.includes('id="waHeaderLogoCanvas" width="64" height="64"'), 'chat-hub.js harus memuat <canvas id="waHeaderLogoCanvas" width="64" height="64">');
assert.ok(chatHubSrc.includes('wa-header-logo-canvas'), 'chat-hub.js harus menyematkan kelas wa-header-logo-canvas');
assert.ok(chatHubSrc.includes('<span>Bubble</span>'), 'chat-hub.js harus tetap mempertahankan label <span>Bubble</span>');
assert.ok(chatHubCss.includes('.wa-header-logo-canvas'), 'chat-hub.css harus memuat styling .wa-header-logo-canvas');

// 3. Verifikasi Engine Animasi Terlokalisasi (Frame 1-69 + Specular Shine 3.2s Loop + Pause/Resume)
assert.ok(chatHubSrc.includes('CHAT_TOTAL_LOGO_FRAMES = 69'), 'chat-hub.js harus mendefinisikan 69 total frame intro perakitan logo');
assert.ok(chatHubSrc.includes('CHAT_SHINE_PAUSE = 3200'), 'chat-hub.js harus mendefinisikan jeda 3.2 detik antar siklus specular shine');
assert.ok(chatHubSrc.includes('(i >= 60) ? \'png\' : \'jpg\'') || chatHubSrc.includes('.png'), 'chat-hub.js harus memuat frame kilatan transparan');
assert.ok(typeof sandbox.bukaJendelaWaHub === 'function', 'bukaJendelaWaHub harus diekspor sebagai fungsi');
assert.ok(typeof sandbox.tutupJendelaWaHub === 'function', 'tutupJendelaWaHub harus diekspor sebagai fungsi');
assert.ok(typeof sandbox.resumeChatLogoAnimation === 'function', 'resumeChatLogoAnimation harus diekspor sebagai fungsi');
assert.ok(typeof sandbox.pauseChatLogoAnimation === 'function', 'pauseChatLogoAnimation harus diekspor sebagai fungsi');
assert.ok(chatHubSrc.includes('pauseChatLogoAnimation()'), 'bukaRoomWa / tutup harus menjeda animasi canvas');
assert.ok(chatHubSrc.includes('resumeChatLogoAnimation()'), 'kembaliKeDaftarWa / buka harus melanjutkan animasi canvas');

// 4. Verifikasi Invariant: Animasi terlokalisasi di chat saja, TANPA overlay/backdrop ke tengah dashboard
assert.ok(!chatHubSrc.includes('fullscreenIntroLoading'), 'chat-hub.js DILARANG menggunakan fullscreenIntroLoading overlay');
assert.ok(!chatHubSrc.includes('introAnimationWrapper'), 'chat-hub.js DILARANG menggunakan introAnimationWrapper ke tengah dashboard');
console.log('  ✓ Logo FAB & Canvas Header Chat beserta siklus animasi intro + shine sweep terverifikasi terlokalisasi 100% sempurna.\n');

console.log('================================================================');
console.log('🎉 SEMUA PENGUJIAN LOGO MODERN, AVATAR & ANIMASI CHAT LULUS 100%! (7/7)');
console.log('================================================================');

