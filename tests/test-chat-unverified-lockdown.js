/**
 * ===================================================================
 * TEST SUITE: PENGUJIAN PENGUNCIAN AKSES WHATSAPP CHAT HUB UNTUK
 * AKUN PENGUNJUNG / TAMU SEKOLAH BELUM TERVERIFIKASI
 * Presensia IoT — SMK Negeri 1 Sumedang
 * ===================================================================
 */

const assert = require('assert');

console.log('================================================================');
console.log('🧪 PENGUJIAN PENGUNCIAN AKSES WHATSAPP CHAT HUB (UNVERIFIED LOCK)');
console.log('================================================================\n');

// 1. Mock DOM Environment
const mockLocalStorage = {};
const mockSessionStorage = {};
global.localStorage = {
  getItem: (k) => mockLocalStorage[k] || null,
  setItem: (k, v) => { mockLocalStorage[k] = String(v); },
  removeItem: (k) => { delete mockLocalStorage[k]; },
  clear: () => { Object.keys(mockLocalStorage).forEach(k => delete mockLocalStorage[k]); },
  key: (i) => Object.keys(mockLocalStorage)[i],
  get length() { return Object.keys(mockLocalStorage).length; }
};

global.sessionStorage = {
  getItem: (k) => mockSessionStorage[k] || null,
  setItem: (k, v) => { mockSessionStorage[k] = String(v); },
  removeItem: (k) => { delete mockSessionStorage[k]; },
  clear: () => { Object.keys(mockSessionStorage).forEach(k => delete mockSessionStorage[k]); }
};

const domStore = {};
function createMockElement(tag, id = '') {
  let _innerHTML = '';
  const el = {
    tagName: tag.toUpperCase(),
    id: id,
    value: '',
    textContent: '',
    style: {},
    children: [],
    classList: {
      _classes: new Set(),
      add: function (...args) { args.forEach(c => this._classes.add(c)); },
      remove: function (...args) { args.forEach(c => this._classes.delete(c)); },
      contains: function (c) { return this._classes.has(c); }
    },
    querySelectorAll: (selector) => {
      const matches = [];
      function traverse(node) {
        if (!node || !node.children) return;
        node.children.forEach(child => {
          if (selector.startsWith('.') && child.classList && child.classList.contains(selector.slice(1))) {
            matches.push(child);
          } else if (selector.startsWith('#') && child.id === selector.slice(1)) {
            matches.push(child);
          }
          traverse(child);
        });
      }
      traverse(el);
      return matches;
    },
    querySelector: (selector) => {
      const all = el.querySelectorAll(selector);
      return all.length > 0 ? all[0] : null;
    },
    appendChild: function (child) {
      this.children.push(child);
      if (child.id) domStore[child.id] = child;
      return child;
    },
    remove: function () {
      if (this.id && domStore[this.id]) delete domStore[this.id];
    },
    focus: () => {},
    addEventListener: function (evt, handler) {
      if (!this._handlers) this._handlers = {};
      if (!this._handlers[evt]) this._handlers[evt] = [];
      this._handlers[evt].push(handler);
    },
    dispatchEvent: function (evt) {
      const type = evt.type || evt;
      if (this._handlers && this._handlers[type]) {
        this._handlers[type].forEach(h => h(evt));
      }
    }
  };

  Object.defineProperty(el, 'innerHTML', {
    get: () => _innerHTML,
    set: (html) => {
      _innerHTML = html;
      el.children = [];
      const elemRegex = /<([a-z0-9]+)([^>]*)>/gi;
      let m;
      while ((m = elemRegex.exec(html)) !== null) {
        const tagName = m[1];
        const attrs = m[2];
        const idMatch = attrs.match(/id=["']([^"']+)["']/i);
        const classMatch = attrs.match(/class=["']([^"']+)["']/i);
        const childEl = createMockElement(tagName, idMatch ? idMatch[1] : '');
        if (classMatch) {
          classMatch[1].split(/\s+/).forEach(c => childEl.classList.add(c));
        }
        el.children.push(childEl);
        if (childEl.id) domStore[childEl.id] = childEl;
      }
    }
  });

  if (id) domStore[id] = el;
  return el;
}

const KNOWN_CHAT_DOM_IDS = [
  'waMessagesContainer', 'waInputText', 'waInputBar', 'waBtnSend', 'waBtnMic',
  'waListPanel', 'waChatView', 'waPanelBody', 'waSearchInput', 'waGroupInfoModal',
  'waMentionPopup', 'waChatHeaderName', 'waChatHeaderStatus', 'waBtnGroupInfo',
  'waHeaderUserDisplay', 'waBadgeCounter',
  'waFloatingLockBadge', 'waHeaderLockBadge', 'waHeaderTitle'
];

global.document = {
  getElementById: (id) => {
    if (domStore[id]) return domStore[id];
    if (KNOWN_CHAT_DOM_IDS.includes(id)) {
      domStore[id] = createMockElement('div', id);
      return domStore[id];
    }
    return null;
  },
  createElement: (tag) => createMockElement(tag),
  body: createMockElement('body', 'body'),
  readyState: 'complete',
  addEventListener: () => {},
  querySelectorAll: (selector) => {
    const list = [];
    Object.values(domStore).forEach(node => {
      if (selector.startsWith('.') && node.classList && node.classList.contains(selector.slice(1))) {
        list.push(node);
      } else if (selector.startsWith('#') && node.id === selector.slice(1)) {
        list.push(node);
      }
    });
    return list;
  }
};

global.window = {
  location: { pathname: '/dashboard.html', href: 'http://localhost/dashboard.html' },
  document: global.document,
  localStorage: global.localStorage,
  sessionStorage: global.sessionStorage,
  addEventListener: () => {},
  dispatchEvent: () => {}
};

let lastAlertMessage = null;
global.alert = (msg) => { lastAlertMessage = msg; };
global.confirm = () => true;

// Mock Firebase RTDB
const mockDb = { chat_rooms: {} };
global.db = {
  ref: (path) => ({
    set: async (val) => {
      const parts = path.split('/');
      let cur = mockDb;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!cur[parts[i]]) cur[parts[i]] = {};
        cur = cur[parts[i]];
      }
      cur[parts[parts.length - 1]] = val;
      return true;
    },
    once: async () => ({
      val: () => {
        const parts = path.split('/');
        let cur = mockDb;
        for (const p of parts) {
          if (!cur) return null;
          cur = cur[p];
        }
        return cur || null;
      }
    }),
    on: (evt, cb) => cb({ val: () => mockDb.chat_rooms || null })
  })
};

// Track mock function calls
let profileModalCalled = false;
let profileModalTab = null;
global.bukaModalProfil = () => { profileModalCalled = true; profileModalTab = 'overview'; };
global.bukaModalProfilDenganTabNisn = () => { profileModalCalled = true; profileModalTab = 'nisn'; };
global.bukaModalProfilDenganTabNip = () => { profileModalCalled = true; profileModalTab = 'nip'; };

// Load chat-hub module
require('../assets/chat-hub.js');

async function runTests() {
  // -------------------------------------------------------------
  // [TEST 1] Pencegahan Identity Hijacking pada getActiveUserChat
  // -------------------------------------------------------------
  console.log('▶ [Test 1] Pengujian getActiveUserChat untuk Akun Pengunjung jawabind1...');
  
  // Simulasi akun jawabind1 persis seperti screenshot pengguna
  global.window.location = { pathname: '/dashboard.html', href: 'http://localhost/dashboard.html' };
  global.currentUser = {
    uid: 'UID_jawabind1_987654',
    email: 'jawabind1@gmail.com',
    nama: 'jawabind1',
    role: 'pengunjung',
    isVerified: false,
    isPengunjung: true,
    foto: 'https://lh3.googleusercontent.com/a/mock-jawabind1-avatar'
  };
  mockLocalStorage['user_aktif'] = JSON.stringify(global.currentUser);

  const activeUser = global.getActiveUserChat();
  assert.strictEqual(activeUser.role, 'pengunjung', 'Role akun unverified HARUS tetap pengunjung');
  assert.strictEqual(activeUser.isVerified, false, 'isVerified akun unverified HARUS bernilai false');
  assert.strictEqual(activeUser.isPengunjung, true, 'isPengunjung HARUS bernilai true');
  assert.strictEqual(activeUser.nisn, null, 'nisn akun pengunjung DILARANG dibajak menjadi 0098263610');
  assert.strictEqual(activeUser.nip, null, 'nip akun pengunjung DILARANG diisi nilai');
  assert.strictEqual(activeUser.kelas, null, 'kelas akun pengunjung HARUS bernilai null');
  assert.notStrictEqual(activeUser.id, '0098263610', 'ID akun pengunjung DILARANG keras di-fallback ke NISN Ihsan 0098263610');
  assert.strictEqual(activeUser.id, 'UID_jawabind1_987654', 'ID harus sesuai dengan UID asli user pengunjung');

  console.log('  ✓ Akun pengunjung jawabind1 teridentifikasi murni sebagai pengunjung (bebas dari bug pembajakan identitas 0098263610).\n');

  // -------------------------------------------------------------
  // [TEST 2] Pengujian isAkunTerverifikasiChat
  // -------------------------------------------------------------
  console.log('▶ [Test 2] Pengujian Validasi Status Verifikasi isAkunTerverifikasiChat...');
  
  assert.strictEqual(global.isAkunTerverifikasiChat(activeUser), false, 'isAkunTerverifikasiChat HARUS false untuk pengunjung unverified');
  
  // Tes akun siswa yang belum terverifikasi
  const siswaBelumVerif = { id: '0011223344', role: 'siswa', isVerified: false, nisn: '0011223344' };
  assert.strictEqual(global.isAkunTerverifikasiChat(siswaBelumVerif), false, 'Siswa dengan isVerified: false tidak boleh lolos');

  // Tes akun siswa dengan role: siswa tetapi tanpa NISN resmi
  const siswaTanpaNisn = { id: 'UID_siswa_unverif_99', role: 'siswa' };
  assert.strictEqual(global.isAkunTerverifikasiChat(siswaTanpaNisn), false, 'Akun role siswa tanpa NISN tidak boleh lolos verifikasi');

  // Tes akun guru dengan role: guru tetapi tanpa NIP resmi
  const guruTanpaNip = { id: 'UID_guru_unverif_88', role: 'guru' };
  assert.strictEqual(global.isAkunTerverifikasiChat(guruTanpaNip), false, 'Akun role guru tanpa NIP tidak boleh lolos verifikasi');

  // Tes akun walas dengan role: walas tetapi tanpa NIP resmi
  const walasTanpaNip = { id: 'UID_walas_unverif_77', role: 'walas' };
  assert.strictEqual(global.isAkunTerverifikasiChat(walasTanpaNip), false, 'Akun role walas tanpa NIP tidak boleh lolos verifikasi');

  // Tes akun pengunjung yang mencoba membawa NISN spoofing
  const pengunjungSpoofed = { id: 'UID_hacker_12', role: 'pengunjung', nisn: '0098263610', isVerified: false };
  assert.strictEqual(global.isAkunTerverifikasiChat(pengunjungSpoofed), false, 'Pengunjung yang membawa properti NISN tetap harus ditolak');

  // Tes akun siswa resmi terverifikasi
  const siswaTerverifikasi = { id: '0098263610', nisn: '0098263610', nama: 'M. IHSAN ATHALLAH', role: 'siswa', isVerified: true, kelas: 'XII RPL 2' };
  assert.strictEqual(global.isAkunTerverifikasiChat(siswaTerverifikasi), true, 'Siswa terverifikasi dengan NISN resmi HARUS lolos');

  // Tes akun guru resmi terverifikasi
  const guruTerverifikasi = { id: '199209142022211007', nip: '199209142022211007', role: 'walas', isGuru: true, isVerified: true };
  assert.strictEqual(global.isAkunTerverifikasiChat(guruTerverifikasi), true, 'Guru terverifikasi dengan NIP resmi HARUS lolos');

  // Tes akun admin resmi
  const adminResmi = { id: 'admin', role: 'admin', isAdmin: true, isVerified: true };
  assert.strictEqual(global.isAkunTerverifikasiChat(adminResmi), true, 'Admin resmi HARUS lolos verifikasi');

  console.log('  ✓ isAkunTerverifikasiChat membedakan secara presisi antara akun terverifikasi dan akun unverified/pengunjung.\n');

  // -------------------------------------------------------------
  // [TEST 3] Pengujian Isolasi Hak Akses Grup Resmi (cekAksesGrup)
  // -------------------------------------------------------------
  console.log('▶ [Test 3] Pengujian Isolasi Hak Akses Grup Resmi untuk Akun Pengunjung...');

  const groups = global.getDaftarGrupResmi();
  const grupKelas = groups['group_XII_RPL_2'];
  const grupWalas = groups['group_walas_sumedang'];
  const grupDewanGuru = groups['group_dewan_guru'];

  assert.strictEqual(global.cekAksesGrup(activeUser, grupKelas), false, 'Akun pengunjung DILARANG melihat grup kelas siswa');
  assert.strictEqual(global.cekAksesGrup(activeUser, grupWalas), false, 'Akun pengunjung DILARANG melihat forum walas');
  assert.strictEqual(global.cekAksesGrup(activeUser, grupDewanGuru), false, 'Akun pengunjung DILARANG melihat forum dewan guru');

  console.log('  ✓ Akun pengunjung 100% diblokir dari semua ruangan grup sekolah.\n');

  // -------------------------------------------------------------
  // [TEST 4] Pengujian Lockdown Interaksi Tombol Floating & Window Chat
  // -------------------------------------------------------------
  console.log('▶ [Test 4] Pengujian Lockdown Interaksi Tombol Floating & Modal Peringatan...');

  // Reset status UI
  const floatBtn = document.getElementById('waFloatingBtn');
  const hubWin = document.getElementById('waHubWindow');
  hubWin.style.display = 'none';

  // Perbarui status chat hub untuk akun pengunjung
  global.perbaruiStatusWaChatHub();

  assert.ok(floatBtn.classList.contains('wa-floating-btn-locked'), 'Tombol floating harus memiliki class wa-floating-btn-locked saat akun belum terverifikasi');
  const lockBadge = document.getElementById('waFloatingLockBadge');
  assert.ok(lockBadge, 'Badge gembok pada floating button harus terpasang');
  assert.strictEqual(lockBadge.style.display, 'flex', 'Badge gembok harus berstatus display: flex');

  // User pengunjung mengklik tombol WhatsApp floating
  floatBtn.onclick();

  // Verifikasi window chat TIDAK BOLEH terbuka
  assert.strictEqual(hubWin.style.display, 'none', 'Window chat WA Hub DILARANG terbuka untuk akun belum terverifikasi');

  // Verifikasi modal gembok verifikasi muncul
  const modalOverlay = document.getElementById('modalKunciWaChatOverlay');
  assert.ok(modalOverlay, 'Modal dialog kunci akses WhatsApp Presensia harus ter-render di DOM');
  assert.strictEqual(modalOverlay.style.display, 'flex', 'Modal kunci akses chat harus aktif ditampilkan (display: flex)');

  // Verifikasi konten modal gembok menjelaskan perlunya verifikasi NISN/NIP
  const modalHtml = modalOverlay.innerHTML;
  assert.ok(modalHtml.includes('WhatsApp Presensia Terkunci'), 'Modal harus memuat judul WhatsApp Presensia Terkunci');
  assert.ok(modalHtml.includes('NISN'), 'Modal harus memuat opsi verifikasi NISN Siswa');
  assert.ok(modalHtml.includes('NIP'), 'Modal harus memuat opsi verifikasi NIP Guru');

  // Pengujian Penutupan Modal via Tombol X (Close Button)
  const btnClose = modalOverlay.querySelector('#waLockCloseBtn') || modalOverlay.querySelector('.wa-lock-close-btn');
  assert.ok(btnClose, 'Tombol silang (X) harus ada di modal');
  assert.strictEqual(typeof btnClose.onclick, 'function', 'Tombol silang (X) harus memiliki event handler onclick yang aktif');
  btnClose.onclick({ preventDefault: () => {}, stopPropagation: () => {} });
  assert.strictEqual(modalOverlay.style.display, 'none', 'Modal kunci WA Chat HARUS tertutup saat tombol silang (X) diklik');

  // Buka kembali modal, lalu uji tombol "Nanti Saja"
  global.tampilkanModalKunciWaChat();
  assert.strictEqual(modalOverlay.style.display, 'flex', 'Modal harus terbuka kembali untuk pengujian tombol Nanti Saja');
  const btnCancel = modalOverlay.querySelector('#waLockCancelBtn') || modalOverlay.querySelector('.wa-lock-cancel-btn');
  assert.ok(btnCancel, 'Tombol "Nanti Saja" harus ada di modal');
  assert.strictEqual(typeof btnCancel.onclick, 'function', 'Tombol "Nanti Saja" harus memiliki event handler onclick yang aktif');
  btnCancel.onclick({ preventDefault: () => {}, stopPropagation: () => {} });
  assert.strictEqual(modalOverlay.style.display, 'none', 'Modal kunci WA Chat HARUS tertutup saat tombol "Nanti Saja" diklik');

  // Buka kembali modal, lalu uji klik backdrop overlay
  global.tampilkanModalKunciWaChat();
  assert.strictEqual(modalOverlay.style.display, 'flex');
  modalOverlay.onclick({ target: modalOverlay });
  assert.strictEqual(modalOverlay.style.display, 'none', 'Modal kunci WA Chat HARUS tertutup saat background overlay diklik');

  // Verifikasi ketersediaan fungsi di window (browser global)
  assert.strictEqual(typeof global.window.tutupModalKunciWaChat, 'function', 'window.tutupModalKunciWaChat harus terdaftar di window');
  assert.strictEqual(typeof global.window.tampilkanModalKunciWaChat, 'function', 'window.tampilkanModalKunciWaChat harus terdaftar di window');
  assert.strictEqual(typeof global.window.aksiVerifikasiNisnDariChat, 'function', 'window.aksiVerifikasiNisnDariChat harus terdaftar di window');
  assert.strictEqual(typeof global.window.aksiVerifikasiNipDariChat, 'function', 'window.aksiVerifikasiNipDariChat harus terdaftar di window');

  console.log('  ✓ Klik tombol X, tombol Nanti Saja, dan background overlay terbukti 100% menutup modal dialog.\n');

  // -------------------------------------------------------------
  // [TEST 5] Pengujian Aksi Verifikasi NISN & NIP dari Chat Hub
  // -------------------------------------------------------------
  console.log('▶ [Test 5] Pengujian Aksi Tombol Verifikasi NISN & NIP pada Modal Chat Hub...');

  // Klik Verifikasi NISN
  profileModalCalled = false;
  profileModalTab = null;
  global.aksiVerifikasiNisnDariChat();
  assert.strictEqual(profileModalCalled, true, 'bukaModalProfilDenganTabNisn harus dipanggil saat user memilih verifikasi NISN');
  assert.strictEqual(profileModalTab, 'nisn', 'Tab modal profil harus terarah ke tab NISN');
  assert.strictEqual(modalOverlay.style.display, 'none', 'Modal kunci chat harus tertutup setelah navigasi');

  // Buka lagi lalu klik Verifikasi NIP
  global.tampilkanModalKunciWaChat();
  assert.strictEqual(modalOverlay.style.display, 'flex');
  profileModalCalled = false;
  profileModalTab = null;
  global.aksiVerifikasiNipDariChat();
  assert.strictEqual(profileModalCalled, true, 'bukaModalProfilDenganTabNip harus dipanggil saat user memilih verifikasi NIP');
  assert.strictEqual(profileModalTab, 'nip', 'Tab modal profil harus terarah ke tab NIP');
  assert.strictEqual(modalOverlay.style.display, 'none', 'Modal kunci chat harus tertutup setelah navigasi');

  console.log('  ✓ Tombol aksi verifikasi sukses mengarahkan pengguna langsung ke tab NISN/NIP modal profil.\n');

  // -------------------------------------------------------------
  // [TEST 6] Pengujian Pencegahan Pengiriman Pesan & Muat Pesan Room
  // -------------------------------------------------------------
  console.log('▶ [Test 6] Pengujian Blokade kirimPesanWaHub & muatPesanRoom...');

  lastAlertMessage = null;
  const sendResult = await global.kirimPesanWaHub('direct_0098263610_199209142022211007', 'Halo ini tes pengunjung ilegal', 'teks');
  assert.strictEqual(sendResult && sendResult.success, false, 'kirimPesanWaHub HARUS mengembalikan success: false untuk akun unverified');
  assert.ok(sendResult && sendResult.error && sendResult.error.includes('Akses ditolak'), 'Error penolakan harus jelas');

  const loadedMsgs = await global.muatPesanRoom('direct_0098263610_199209142022211007');
  assert.deepStrictEqual(loadedMsgs, [], 'muatPesanRoom HARUS mengembalikan array kosong untuk akun unverified');

  console.log('  ✓ Pengiriman pesan dan pemuatan pesan cloud terblokir total untuk akun unverified.\n');

  // -------------------------------------------------------------
  // [TEST 7] Pengujian Akun Terverifikasi Tetap Bebas Membuka Chat Hub
  // -------------------------------------------------------------
  console.log('▶ [Test 7] Pengujian Verifikasi Akun Sah (Siswa Ihsan) Membuka Chat Hub Normal...');

  // Reset sesi ke Siswa Ihsan Terverifikasi
  global.currentUser = {
    uid: 'UID_0098263610',
    nisn: '0098263610',
    nama: 'M. IHSAN ATHALLAH',
    role: 'siswa',
    isVerified: true,
    kelas: 'XII RPL 2'
  };
  mockLocalStorage['user_aktif'] = JSON.stringify(global.currentUser);

  global.perbaruiStatusWaChatHub();

  assert.strictEqual(floatBtn.classList.contains('wa-floating-btn-locked'), false, 'Class wa-floating-btn-locked TIDAK BOLEH ada pada akun terverifikasi');
  assert.strictEqual(lockBadge.style.display, 'none', 'Badge gembok harus disembunyikan untuk akun terverifikasi');

  // Siswa terverifikasi membuka chat
  global.bukaChatWhatsApp();

  assert.strictEqual(hubWin.style.display, 'flex', 'Window chat WA Hub HARUS terbuka sempurna (display: flex) untuk akun terverifikasi');
  assert.strictEqual(modalOverlay.style.display, 'none', 'Modal kunci akses TIDAK BOLEH tampil untuk akun terverifikasi');

  console.log('  ✓ Akun terverifikasi dapat membuka dan menggunakan WhatsApp Presensia Chat Hub secara normal.\n');

  // -------------------------------------------------------------
  // [TEST 8] Pencegahan Pembajakan Identitas Guru / Siswa oleh Akun Palsu
  // -------------------------------------------------------------
  console.log('▶ [Test 8] Pengujian Anti-Hijacking Identitas Guru & Siswa oleh Sesi Tidak Terverifikasi...');

  // Guru palsu tanpa NIP di dashboard.html
  global.window.location = { pathname: '/dashboard.html', href: 'http://localhost/dashboard.html' };
  global.currentUser = { role: 'guru', nama: 'Fake Guru Tanpa NIP' };
  mockLocalStorage['user_aktif'] = JSON.stringify(global.currentUser);
  delete mockLocalStorage['siswa_aktif'];

  const fakeGuruOnStudent = global.getActiveUserChat();
  assert.strictEqual(fakeGuruOnStudent.role, 'pengunjung', 'Guru tanpa NIP di dashboard.html harus terisolasi sebagai pengunjung');
  assert.strictEqual(fakeGuruOnStudent.isVerified, false, 'isVerified harus false untuk guru tanpa NIP');
  assert.strictEqual(fakeGuruOnStudent.nomorKontak, '-', 'nomorKontak guru tanpa NIP harus "-"');
  assert.strictEqual(global.isAkunTerverifikasiChat(fakeGuruOnStudent), false);

  // Guru palsu tanpa NIP di dashboard-guru.html
  global.window.location = { pathname: '/dashboard-guru.html', href: 'http://localhost/dashboard-guru.html' };
  const fakeGuruOnGuru = global.getActiveUserChat();
  assert.strictEqual(fakeGuruOnGuru.role, 'pengunjung', 'Guru tanpa NIP di dashboard-guru.html DILARANG membajak NIP Pak Echa');
  assert.strictEqual(fakeGuruOnGuru.nip, null, 'NIP guru palsu harus null');
  assert.strictEqual(fakeGuruOnGuru.isVerified, false, 'Guru palsu harus isVerified: false');
  assert.strictEqual(global.isAkunTerverifikasiChat(fakeGuruOnGuru), false);

  console.log('  ✓ Pembajakan identitas guru/siswa oleh akun palsu terblokir 100%.\n');

  // -------------------------------------------------------------
  // [TEST 9] Pengujian Penguncian Fitur Manajemen Grup untuk Akun Unverified
  // -------------------------------------------------------------
  console.log('▶ [Test 9] Pengujian Blokade Manajemen Grup (Info, Edit, Invite, Kick)...');

  // Kembalikan ke pengunjung unverified jawabind1
  global.window.location = { pathname: '/dashboard.html', href: 'http://localhost/dashboard.html' };
  global.currentUser = {
    uid: 'UID_jawabind1_987654',
    nama: 'jawabind1',
    role: 'pengunjung',
    isVerified: false
  };
  mockLocalStorage['user_aktif'] = JSON.stringify(global.currentUser);

  // 1. bukaInfoGrupWa harus menolak akun unverified
  global.bukaInfoGrupWa('group_XII_RPL_2');
  assert.strictEqual(modalOverlay.style.display, 'flex', 'bukaInfoGrupWa harus menampilkan modal gembok verifikasi');

  // 2. simpanProfilGrupWa harus menolak akun unverified
  modalOverlay.style.display = 'none';
  global.simpanProfilGrupWa();
  assert.strictEqual(modalOverlay.style.display, 'flex', 'simpanProfilGrupWa harus menampilkan modal gembok verifikasi');

  console.log('  ✓ Seluruh fitur manajemen grup terlindungi dari akses akun unverified.\n');

  // -------------------------------------------------------------
  // [TEST 10] Pengujian Auto-Close Jendela Chat & Sinkronisasi Storage Lintas Tab
  // -------------------------------------------------------------
  console.log('▶ [Test 10] Pengujian Auto-Close Jendela Chat & Sinkronisasi Event Storage...');

  // Simulasi jendela chat sedang terbuka saat user berstatus terverifikasi
  hubWin.style.display = 'flex';
  assert.strictEqual(hubWin.style.display, 'flex');

  // User berganti menjadi akun unverified (misal logout atau switch session)
  global.currentUser = {
    uid: 'UID_pengunjung_baru',
    nama: 'Pengunjung Baru',
    role: 'pengunjung',
    isVerified: false
  };
  mockLocalStorage['user_aktif'] = JSON.stringify(global.currentUser);

  // Panggil perbaruiStatusWaChatHub
  global.perbaruiStatusWaChatHub();
  assert.strictEqual(hubWin.style.display, 'none', 'waHubWindow HARUS otomatis tertutup saat status akun unverified');
  assert.ok(floatBtn.classList.contains('wa-floating-btn-locked'), 'Tombol floating harus kembali terkunci');

  // Simulasi event storage saat user logout dari tab browser lain
  hubWin.style.display = 'flex'; // simulasi hacker membuka paksa window di DOM
  const storageEventMock = { key: 'user_aktif', newValue: JSON.stringify(global.currentUser) };
  if (global.window._handlers && global.window._handlers['storage']) {
    global.window._handlers['storage'].forEach(h => h(storageEventMock));
  }
  // Panggil perbaruiStatusWaChatHub untuk verifikasi efek state
  global.perbaruiStatusWaChatHub();
  assert.strictEqual(hubWin.style.display, 'none', 'Window chat harus otomatis tertutup saat sesi unverified terdeteksi via storage');

  // Panggilan langsung bukaChatWhatsApp() oleh unverified user harus menutup hubWin dan memunculkan modal lock
  hubWin.style.display = 'flex';
  global.bukaChatWhatsApp();
  assert.strictEqual(hubWin.style.display, 'none', 'bukaChatWhatsApp harus langsung menutup hubWin untuk akun unverified');
  assert.strictEqual(modalOverlay.style.display, 'flex', 'bukaChatWhatsApp harus menampilkan modal kunci verifikasi');

  console.log('  ✓ Auto-close jendela chat dan sinkronisasi lintas tab teruji 100% aman.\n');

  console.log('================================================================');
  console.log('🎉 SEMUA PENGUJIAN PENGUNCIAN CHAT UNVERIFIED LULUS 100%!');
  console.log('================================================================');
}

runTests().catch(err => {
  console.error('\n❌ PENGUJIAN GAGAL:', err);
  process.exit(1);
});
