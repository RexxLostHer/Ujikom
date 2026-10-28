const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const ROOT_DIR = path.resolve(__dirname, '..');

console.log('================================================================');
console.log('🧪 PENGUJIAN SISTEM AUDIO VOICE NOTE (DUAL-ENGINE & WAVEFORM)');
console.log('================================================================\n');

// -------------------------------------------------------------
// [Test 1] Verifikasi CSS Dancing Waveform di chat-hub.css
// -------------------------------------------------------------
console.log('▶ [Test 1] Verifikasi Animasi Waveform di chat-hub.css...');
const cssContent = fs.readFileSync(path.join(ROOT_DIR, 'assets', 'chat-hub.css'), 'utf8');
assert.ok(cssContent.includes('.wa-vn-bar.is-animating'), 'CSS harus memuat kelas .wa-vn-bar.is-animating');
assert.ok(cssContent.includes('@keyframes waWaveDance'), 'CSS harus memuat @keyframes waWaveDance');
assert.ok(cssContent.includes('transform: scaleY('), 'Animasi waWaveDance harus menganimasikan ketinggian gelombang (scaleY)');
console.log('  ✓ Animasi CSS dancing waveform terverifikasi lengkap dan presisi.\n');

// -------------------------------------------------------------
// [Test 2] Verifikasi Multi-Format MediaRecorder & Timeslice 250ms
// -------------------------------------------------------------
console.log('▶ [Test 2] Verifikasi Konfigurasi Perekam Suara (MediaRecorder)...');
const jsContent = fs.readFileSync(path.join(ROOT_DIR, 'assets', 'chat-hub.js'), 'utf8');
assert.ok(jsContent.includes('waCurrentMediaRecorder.start(250)'), 'Perekaman harus menggunakan timeslice 250ms agar data tidak terputus');
assert.ok(jsContent.includes('audio/webm;codecs=opus'), 'Perekaman harus mendukung audio/webm;codecs=opus');
assert.ok(jsContent.includes('audio/mp4'), 'Perekaman harus mendukung audio/mp4 untuk browser non-webm');
assert.ok(jsContent.includes('echoCancellation: true'), 'Media stream harus mengaktifkan echoCancellation');
assert.ok(jsContent.includes('autoGainControl: true'), 'Media stream harus mengaktifkan autoGainControl untuk suara jelas');
console.log('  ✓ Konfigurasi MediaRecorder multi-format dan timeslice 250ms valid 100%.\n');

// -------------------------------------------------------------
// [Test 3] Verifikasi Audio Registry & Keamanan HTML Bubble
// -------------------------------------------------------------
console.log('▶ [Test 3] Verifikasi Audio Registry & Pencegahan Kebocoran Base64...');
assert.ok(jsContent.includes('const waAudioRegistry = new Map()'), 'Registry memori waAudioRegistry harus terdefinisi');
assert.ok(jsContent.includes('waAudioRegistry.set(String(msg.id), msg.audio_url)'), 'Data URL audio harus disimpan ke waAudioRegistry');
assert.ok(!jsContent.includes("onclick=\"putarAudioWa(this, '${msg.audio_url}')\""), 'Dilarang menaruh string Base64 mentah ke inline HTML onclick');
console.log('  ✓ Audio Registry terisolasi sempurna dan bebas dari injeksi Base64 di inline HTML.\n');

// -------------------------------------------------------------
// [Test 4] Verifikasi Lingkungan Runtime & Dual-Engine Playback
// -------------------------------------------------------------
console.log('▶ [Test 4] Pengujian Eksekusi Runtime putarAudioWa & Web Audio Fallback...');

// Bangun Mock DOM
class MockElement {
  constructor(tag) {
    this.tagName = (tag || 'div').toUpperCase();
    this.innerHTML = '';
    this.children = [];
    this.classList = {
      classes: new Set(),
      add: (c) => this.classList.classes.add(c),
      remove: (c) => this.classList.classes.delete(c),
      contains: (c) => this.classList.classes.has(c)
    };
    this.dataset = {};
    this.style = {};
  }
  appendChild(child) {
    this.children.push(child);
    return child;
  }
  closest(selector) {
    if (selector === '.wa-vn-player' && this.tagName === 'DIV') return this;
    if (this.parent) return this.parent.closest(selector);
    return null;
  }
  querySelectorAll(selector) {
    if (selector === '.wa-vn-bar') {
      return this.children.filter(c => c.classList.contains('wa-vn-bar'));
    }
    return [];
  }
}

// Mock Web Audio Context
let audioCtxCreated = false;
let oscStarted = 0;
class MockAudioContext {
  constructor() {
    audioCtxCreated = true;
    this.state = 'running';
    this.currentTime = 0;
    this.destination = {};
  }
  resume() { this.state = 'running'; }
  createGain() {
    return {
      connect: () => {},
      gain: {
        setValueAtTime: () => {},
        exponentialRampToValueAtTime: () => {}
      }
    };
  }
  createOscillator() {
    return {
      type: 'sine',
      frequency: {
        setValueAtTime: () => {},
        linearRampToValueAtTime: () => {}
      },
      connect: () => {},
      start: () => { oscStarted++; },
      stop: () => {},
      disconnect: () => {}
    };
  }
  createBiquadFilter() {
    return {
      type: 'bandpass',
      frequency: { setValueAtTime: () => {} },
      Q: { setValueAtTime: () => {} },
      connect: () => {}
    };
  }
}

const sandbox = {
  console,
  require,
  Date,
  Math,
  String,
  Array,
  Object,
  JSON,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  AudioContext: MockAudioContext,
  localStorage: {
    store: {},
    getItem(k) { return this.store[k] || null; },
    setItem(k, v) { this.store[k] = String(v); },
    removeItem(k) { delete this.store[k]; }
  },
  sessionStorage: { getItem() { return null; } },
  window: {},
  document: {
    getElementById: () => null,
    createElement: (tag) => new MockElement(tag),
    querySelectorAll: () => [],
    querySelector: () => null,
    addEventListener: () => {},
    body: new MockElement('body')
  }
};
sandbox.window = sandbox;
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(jsContent, sandbox);

assert.strictEqual(typeof sandbox.putarAudioWa, 'function', 'Fungsi putarAudioWa harus terdefinisi');
assert.strictEqual(typeof sandbox.putarWebAudioFallback, 'function', 'Fungsi putarWebAudioFallback harus terdefinisi');
assert.strictEqual(typeof sandbox.stopAllWaAudio, 'function', 'Fungsi stopAllWaAudio harus terdefinisi');

// Siapkan komponen player mock
const playerDiv = new MockElement('div');
playerDiv.classList.add('wa-vn-player');
playerDiv.dataset.msgId = 'MSG_VN_TEST_01';

const btnPlay = new MockElement('button');
btnPlay.classList.add('wa-vn-play-btn');
btnPlay.parent = playerDiv;
playerDiv.appendChild(btnPlay);

const bars = [];
for (let i = 0; i < 6; i++) {
  const b = new MockElement('div');
  b.classList.add('wa-vn-bar');
  b.parent = playerDiv;
  playerDiv.appendChild(b);
  bars.push(b);
}

// 1. Uji pemutaran data dummy/kosong (Harus otomatis memicu Web Audio API Fallback)
sandbox.putarAudioWa(btnPlay, 'MSG_VN_TEST_01', 3);

assert.ok(btnPlay.innerHTML.includes('<rect'), 'Tombol harus berubah menjadi ikon Pause');
assert.ok(bars.every(b => b.classList.contains('is-animating')), 'Semua batang gelombang suara harus memiliki kelas is-animating');
assert.ok(audioCtxCreated, 'AudioContext harus diinisialisasi untuk fallback bersuara');
assert.ok(oscStarted >= 3, 'Oscillator harmonik (carrier, formant, vibrato) harus aktif berbunyi');
console.log('  ✓ Web Audio API Fallback berhasil aktif saat data audio kosong/dummy.');
console.log('  ✓ Batang waveform terbukti menganimasikan kelas is-animating saat suara berputar.');

// 2. Uji klik jeda (Pause) pada tombol yang sama
sandbox.putarAudioWa(btnPlay, 'MSG_VN_TEST_01', 3);
assert.ok(btnPlay.innerHTML.includes('<polygon'), 'Tombol harus kembali menjadi ikon Play saat dijeda');
assert.ok(bars.every(b => !b.classList.contains('is-animating')), 'Kelas is-animating harus dicabut dari semua batang saat dijeda');
console.log('  ✓ Klik ulang pada tombol berhasil melakukan jeda (Pause) & mereset animasi waveform.\n');

// -------------------------------------------------------------
// [Test 5] Verifikasi Registrasi Dinamis Bubble Voice Note
// -------------------------------------------------------------
console.log('▶ [Test 5] Pengujian Registrasi Audio Bubble Otomatis...');
const testAudioPayload = {
  id: 'MSG_VN_REAL_99',
  roomId: 'group_xii_rpl_2',
  pengirimId: '0098263610',
  nama: 'M. IHSAN ATHALLAH',
  role: 'siswa',
  pesan: 'Voice Note (4s)',
  tipe: 'audio',
  audio_url: 'data:audio/webm;base64,GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRChYECGFOAZwE=REAL_AUDIO_PAYLOAD',
  audio_durasi: 4,
  waktu: Date.now()
};

sandbox.appendBubblePesan(testAudioPayload);
const storedUrl = sandbox.waAudioRegistry.get('MSG_VN_REAL_99');
assert.strictEqual(storedUrl, testAudioPayload.audio_url, 'Audio URL harus tersimpan di registry dengan key ID pesan');
console.log('  ✓ Bubble audio berhasil mendaftarkan audio_url ke waAudioRegistry secara otomatis.\n');

console.log('================================================================');
console.log('🎉 SEMUA PENGUJIAN SISTEM AUDIO VOICE NOTE LULUS 100%!');
console.log('================================================================');
process.exit(0);
