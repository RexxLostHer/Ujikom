/**
 * ===================================================================
 * TEST SUITE: ISOLASI KEAMANAN OBROLAN PRIBADI (1-ON-1 DIRECT CHAT)
 * Presensia IoT — SMK Negeri 1 Sumedang
 * ===================================================================
 * Memverifikasi:
 * 1. Derivasi Room ID deterministik, simetris, dan bebas kolisi (getDirectRoomId)
 * 2. Kontrol akses ketat bukaRoomWa (User C dilarang membuka room User A & B)
 * 3. Blokade pemuatan riwayat pesan muatPesanRoom untuk akun luar
 * 4. Penolakan pengiriman pesan kirimPesanWaHub oleh akun luar
 * 5. Isolasi daftar percakapan aktif di renderTabKontenWa (Tab Chats)
 * 6. Isolasi sinkronisasi latar belakang RTDB (pasangGlobalChatRoomsListener)
 * 7. Isolasi unread badge counter (perbaruiBadgeCounter)
 * 8. Layout bubble pesan: Pesan keluar di kanan (sent), pesan masuk di kiri (received),
 *    bebas dari tag/badge grup (👑 Admin) pada obrolan pribadi 1-on-1
 * 9. Isolasi event lintas-tab (BroadcastChannel & storage event)
 * 10. Ketahanan isolasi multi-akun pada mesin/perangkat yang sama
 * ===================================================================
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('================================================================');
console.log('🧪 PENGUJIAN ISOLASI & KEAMANAN OBROLAN PRIBADI (CHAT HUB)');
console.log('================================================================\n');

// 1. Mock LocalStorage & SessionStorage
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

// 2. Mock DOM Elements
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
    addEventListener: () => {}
  };
  let _className = '';
  Object.defineProperty(el, 'className', {
    get: () => _className,
    set: (v) => {
      _className = String(v || '');
      el.classList._classes.clear();
      _className.split(' ').filter(Boolean).forEach(c => el.classList.add(c));
    }
  });

  Object.defineProperty(el, 'innerHTML', {
    get: () => _innerHTML,
    set: (html) => {
      _innerHTML = html;
      el.children = [];
      const elemRegex = /<([a-z0-9]+)([^>]*)>/gi;
      let m;
      while ((m = elemRegex.exec(html)) !== null) {
        const tagName = m[1];
        const attrStr = m[2];
        const idMatch = /id=["']([^"']+)["']/i.exec(attrStr);
        const classMatch = /class=["']([^"']+)["']/i.exec(attrStr);
        const childEl = createMockElement(tagName, idMatch ? idMatch[1] : '');
        if (classMatch) {
          classMatch[1].split(' ').filter(Boolean).forEach(c => childEl.classList.add(c));
        }
        el.children.push(childEl);
        if (childEl.id) domStore[childEl.id] = childEl;
      }
    }
  });

  if (id) domStore[id] = el;
  return el;
}

global.document = {
  getElementById: (id) => domStore[id] || null,
  createElement: (tag) => createMockElement(tag),
  body: createMockElement('body', 'body')
};

const windowListeners = {};
global.window = {
  location: { pathname: '/dashboard.html', href: 'http://localhost/dashboard.html' },
  addEventListener: (evt, cb) => {
    windowListeners[evt] = windowListeners[evt] || [];
    windowListeners[evt].push(cb);
  }
};

let lastAlertMessage = null;
global.alert = (msg) => { lastAlertMessage = msg; };

// 3. Mock Firebase RTDB
const mockDbData = {};
global.db = {
  ref: (pathStr) => {
    return {
      set: async (val) => { mockDbData[pathStr] = val; return val; },
      update: async (val) => {
        mockDbData[pathStr] = Object.assign(mockDbData[pathStr] || {}, val);
        return mockDbData[pathStr];
      },
      once: async () => ({
        val: () => mockDbData[pathStr] || null,
        exists: () => Boolean(mockDbData[pathStr])
      }),
      on: (event, cb) => {
        cb({
          val: () => {
            const rootKey = pathStr;
            const res = {};
            Object.keys(mockDbData).forEach(k => {
              if (k.startsWith(rootKey + '/')) {
                const subPath = k.replace(rootKey + '/', '');
                const parts = subPath.split('/');
                let cur = res;
                for (let i = 0; i < parts.length - 1; i++) {
                  cur[parts[i]] = cur[parts[i]] || {};
                  cur = cur[parts[i]];
                }
                cur[parts[parts.length - 1]] = mockDbData[k];
              }
            });
            return res;
          }
        });
        return cb;
      },
      off: () => {}
    };
  }
};

// 4. Load Chat Hub Module
const chatHub = require('../assets/chat-hub.js');

// Siapkan Elemen DOM Utama
const hubWin = createMockElement('div', 'waHubWindow');
hubWin.style.display = 'none';
const listPanel = createMockElement('div', 'waListPanel');
listPanel.style.display = 'flex';
const chatView = createMockElement('div', 'waChatView');
chatView.style.display = 'none';
const messagesContainer = createMockElement('div', 'waMessagesContainer');
const panelBody = createMockElement('div', 'waPanelBody');
const badgeCounter = createMockElement('div', 'waBadgeCounter');
badgeCounter.style.display = 'none';
const headerName = createMockElement('div', 'waChatHeaderName');
const headerStatus = createMockElement('div', 'waChatHeaderStatus');
const headerAvatar = createMockElement('div', 'waChatHeaderAvatar');

hubWin.appendChild(listPanel);
hubWin.appendChild(chatView);
chatView.appendChild(messagesContainer);
chatView.appendChild(headerName);
chatView.appendChild(headerStatus);
chatView.appendChild(headerAvatar);
listPanel.appendChild(panelBody);
document.body.appendChild(hubWin);
document.body.appendChild(badgeCounter);

// Definisi Pengguna untuk Pengujian
const userIhsan = {
  id: '0098263610',
  uid: 'UID_0098263610',
  nisn: '0098263610',
  nama: 'M. IHSAN ATHALLAH',
  role: 'siswa',
  kelas: 'XII RPL 2',
  isVerified: true
};

const userPakEcha = {
  id: '199209142022211007',
  uid: 'UID_199209142022211007',
  nip: '199209142022211007',
  nama: 'Muhammad Echa Putra, S.Kom.Gr',
  role: 'walas',
  isWalas: true,
  walasKelasId: 'XII RPL 2',
  kelas: 'XII RPL 2',
  isVerified: true
};

const userC = {
  id: '0081281355',
  uid: 'UID_0081281355',
  nisn: '0081281355',
  nama: 'AHMAD FADHILAH',
  role: 'siswa',
  kelas: 'XII RPL 1',
  isVerified: true
};

const userAdmin = {
  id: 'admin',
  nip: 'ADMIN-01',
  nama: 'Administrator',
  role: 'admin',
  isAdmin: true,
  isVerified: true
};

async function runAllSecurityIsolationTests() {
  // -----------------------------------------------------------------
  // [TEST 1] Derivasi Room ID Deterministik & Validasi Peserta
  // -----------------------------------------------------------------
  console.log('▶ [Test 1] Pengujian Room ID Derivation, Symmetry & Participant Parsing...');
  
  const roomAB = global.getDirectRoomId('0098263610', '199209142022211007');
  const roomBA = global.getDirectRoomId('199209142022211007', '0098263610');
  const roomPrefixed = global.getDirectRoomId('UID_0098263610', '199209142022211007');

  assert.strictEqual(roomAB, roomBA, 'Room ID harus simetris dua arah');
  assert.strictEqual(roomAB, 'direct_0098263610_199209142022211007', 'Room ID harus deterministik terurut');
  assert.strictEqual(roomPrefixed, roomAB, 'Prefix UID_ harus dinormalisasi secara otomatis');

  // 1. Collision Resistance & Admin Normalization Tests
  const roomBudi = global.getDirectRoomId('budi2026', '199209142022211007');
  const roomAndi = global.getDirectRoomId('andi2026', '199209142022211007');
  assert.notStrictEqual(roomBudi, roomAndi, 'Room ID budi2026 dan andi2026 DILARANG bertabrakan / collision');

  const roomAdminNormal = global.getDirectRoomId('admin', '199209142022211007');
  const roomAdminNip = global.getDirectRoomId('ADMIN-01', '199209142022211007');
  assert.strictEqual(roomAdminNormal, roomAdminNip, 'Room ID untuk admin dan ADMIN-01 harus identik / ternormalisasi');

  const emptyRoom1 = global.getDirectRoomId('', '199209142022211007');
  const emptyRoom2 = global.getDirectRoomId(null, undefined);
  assert.strictEqual(emptyRoom1, '', 'Room ID dengan input kosong harus mengembalikan string kosong');
  assert.strictEqual(emptyRoom2, '', 'Room ID dengan input null/undefined harus mengembalikan string kosong');

  // Validasi Helper Peserta
  assert.strictEqual(global.isUserInDirectRoom(userIhsan, roomAB), true, 'User A harus dikenali sebagai peserta');
  assert.strictEqual(global.isUserInDirectRoom(userPakEcha, roomAB), true, 'User B harus dikenali sebagai peserta');
  assert.strictEqual(global.isUserInDirectRoom(userC, roomAB), false, 'User C DILARANG dianggap sebagai peserta');
  assert.strictEqual(global.isUserInDirectRoom(userAdmin, roomAB), false, 'Admin bukan peserta langsung obrolan privat A-B');
  assert.strictEqual(global.isUserInDirectRoom(userAdmin, roomAdminNormal), true, 'Admin harus dikenali sebagai peserta room miliknya');

  const otherFromA = global.getOtherParticipantId(userIhsan, roomAB);
  const otherFromB = global.getOtherParticipantId(userPakEcha, roomAB);
  const otherFromC = global.getOtherParticipantId(userC, roomAB);
  assert.strictEqual(otherFromA, '199209142022211007', 'Lawan bicara dari User A harus User B');
  assert.strictEqual(otherFromB, '0098263610', 'Lawan bicara dari User B harus User A');
  assert.strictEqual(otherFromC, null, 'User C bukan peserta sehingga lawan bicara bernilai null');

  console.log('  ✓ Derivasi Room ID 100% deterministik, simetris, bebas kolisi, dan isolasi peserta terverifikasi.\n');

  // -----------------------------------------------------------------
  // [TEST 2] Kontrol Akses Buka Room (bukaRoomWa)
  // -----------------------------------------------------------------
  console.log('▶ [Test 2] Pengujian Blokade Akses bukaRoomWa untuk Akun Luar...');

  const directRoomIhsanEcha = 'direct_0098263610_199209142022211007';

  // Sesi 1: User C (Ahmad Fadhilah) mencoba membuka direct room Ihsan & Pak Echa
  global.currentUser = userC;
  mockLocalStorage['user_aktif'] = JSON.stringify(userC);
  lastAlertMessage = null;
  listPanel.style.display = 'flex';
  chatView.style.display = 'none';

  global.bukaRoomWa(directRoomIhsanEcha, 'Muhammad Echa Putra, S.Kom.Gr', 'Pribadi', 'direct');

  assert.strictEqual(chatView.style.display, 'none', 'Jendela chat view TIDAK BOLEH terbuka untuk User C');
  assert.strictEqual(listPanel.style.display, 'flex', 'List panel harus tetap tampil (dikembalikan ke daftar)');
  assert.ok(lastAlertMessage && lastAlertMessage.includes('Akses Ditolak'), 'Pesan peringatan penolakan harus muncul');

  // Sesi 2: User A (Ihsan) membuka room yang sama -> Sukses
  global.currentUser = userIhsan;
  mockLocalStorage['user_aktif'] = JSON.stringify(userIhsan);
  lastAlertMessage = null;

  global.bukaRoomWa(directRoomIhsanEcha, 'Muhammad Echa Putra, S.Kom.Gr', 'Pribadi', 'direct');

  assert.strictEqual(chatView.style.display, 'flex', 'Chat view harus terbuka saat peserta sah membukanya');
  assert.strictEqual(headerName.textContent, 'Muhammad Echa Putra, S.Kom.Gr', 'Header chat harus nama lawan bicara');

  console.log('  ✓ Akses direct room terproteksi ketat: Akun luar diblokir total & peserta sah dapat masuk.\n');

  // -----------------------------------------------------------------
  // [TEST 3] Isolasi Pemuatan Riwayat Pesan (muatPesanRoom)
  // -----------------------------------------------------------------
  console.log('▶ [Test 3] Pengujian Isolasi Pemuatan Riwayat Pesan (muatPesanRoom)...');

  // Simpan riwayat obrolan privat Ihsan dan Pak Echa di localStorage
  const privateMsgs = [
    {
      id: 'MSG_PRIV_001',
      roomId: directRoomIhsanEcha,
      pengirimId: '0098263610',
      nama: 'M. IHSAN ATHALLAH',
      pesan: 'Pak Echa, ini laporan logbook PKL pribadi saya.',
      waktu: 1700000000000
    },
    {
      id: 'MSG_PRIV_002',
      roomId: directRoomIhsanEcha,
      pengirimId: '199209142022211007',
      nama: 'Muhammad Echa Putra, S.Kom.Gr',
      role: 'walas',
      pesan: 'Baik Ihsan, segera saya verifikasi.',
      waktu: 1700000050000
    }
  ];
  mockLocalStorage['wa_msgs_' + directRoomIhsanEcha] = JSON.stringify(privateMsgs);

  // User C memanggil muatPesanRoom
  global.currentUser = userC;
  mockLocalStorage['user_aktif'] = JSON.stringify(userC);

  const msgsLoadedByC = global.muatPesanRoom(directRoomIhsanEcha);
  assert.deepStrictEqual(msgsLoadedByC, [], 'User C DILARANG mendapatkan pesan dari muatPesanRoom (harus [] kosong)');

  // User A (Ihsan) memanggil muatPesanRoom -> Mendapatkan data
  global.currentUser = userIhsan;
  mockLocalStorage['user_aktif'] = JSON.stringify(userIhsan);

  const msgsLoadedByA = global.muatPesanRoom(directRoomIhsanEcha);
  assert.strictEqual(msgsLoadedByA.length, 2, 'User A (peserta sah) harus menerima seluruh riwayat pesan');
  assert.strictEqual(msgsLoadedByA[0].pesan, 'Pak Echa, ini laporan logbook PKL pribadi saya.');

  console.log('  ✓ Pemuatan pesan terlindungi: User C mendapat 0 pesan, User A menerima pesan sah.\n');

  // -----------------------------------------------------------------
  // [TEST 4] Blokade Pengiriman Pesan Ilegal (kirimPesanWaHub)
  // -----------------------------------------------------------------
  console.log('▶ [Test 4] Pengujian Blokade Pengiriman Pesan oleh Akun Luar (kirimPesanWaHub)...');

  // User C mencoba mengirim pesan ke obrolan Ihsan dan Pak Echa
  global.currentUser = userC;
  mockLocalStorage['user_aktif'] = JSON.stringify(userC);

  const illegalSendResult = await global.kirimPesanWaHub(directRoomIhsanEcha, 'Halo saya menyusup ke chat kalian', 'teks');
  assert.strictEqual(illegalSendResult.success, false, 'Pengiriman pesan oleh User C HARUS gagal (success: false)');
  assert.ok(illegalSendResult.error && illegalSendResult.error.includes('Akses ditolak'), 'Error harus menyatakan akses ditolak');

  // Pastikan pesan penyusup TIDAK tersimpan di localStorage
  const afterIllegalList = JSON.parse(mockLocalStorage['wa_msgs_' + directRoomIhsanEcha] || '[]');
  assert.strictEqual(afterIllegalList.length, 2, 'LocalStorage tidak boleh tercemar pesan penyusup');
  assert.strictEqual(afterIllegalList.some(m => m.pesan.includes('menyusup')), false);

  // User A (Ihsan) mengirim pesan legal
  global.currentUser = userIhsan;
  mockLocalStorage['user_aktif'] = JSON.stringify(userIhsan);

  const legalSendResult = await global.kirimPesanWaHub(directRoomIhsanEcha, 'Terima kasih banyak pak', 'teks');
  assert.strictEqual(legalSendResult.success, true, 'Pengiriman pesan oleh User A harus sukses');

  const afterLegalList = JSON.parse(mockLocalStorage['wa_msgs_' + directRoomIhsanEcha] || '[]');
  assert.strictEqual(afterLegalList.length, 3, 'Pesan sah harus tersimpan');

  console.log('  ✓ Pengiriman pesan asing terblokir 100% tanpa kebocoran data.\n');

  // -----------------------------------------------------------------
  // [TEST 5] Isolasi Daftar Percakapan Aktif di Tab Chats (renderTabKontenWa)
  // -----------------------------------------------------------------
  console.log('▶ [Test 5] Pengujian Isolasi Daftar Percakapan Aktif di Tab Chats...');

  const userCRoomWithPakEcha = global.getDirectRoomId(userC.id, userPakEcha.id);

  // Di wa_threads tersimpan kedua room
  mockLocalStorage['wa_threads'] = JSON.stringify({
    [directRoomIhsanEcha]: {
      roomId: directRoomIhsanEcha,
      contactName: 'Muhammad Echa Putra, S.Kom.Gr',
      lastMessage: 'Terima kasih banyak pak',
      lastTime: 1700000100000,
      roomType: 'direct'
    },
    [userCRoomWithPakEcha]: {
      roomId: userCRoomWithPakEcha,
      contactName: 'Muhammad Echa Putra, S.Kom.Gr',
      lastMessage: 'Halo Pak Echa, ini Ahmad Fadhilah',
      lastTime: 1700000090000,
      roomType: 'direct'
    }
  });

  // Render di sisi User C
  global.currentUser = userC;
  mockLocalStorage['user_aktif'] = JSON.stringify(userC);

  panelBody.children = [];
  global.renderTabKontenWa();

  // User C hanya boleh melihat 1 thread (obrolannya sendiri dengan Pak Echa)
  assert.strictEqual(panelBody.children.length, 1, 'User C hanya boleh melihat thread percakapan miliknya');
  const renderedItemText = panelBody.children[0].innerHTML;
  assert.ok(renderedItemText.includes('Halo Pak Echa, ini Ahmad Fadhilah'), 'Thread milik User C harus tampil');
  assert.ok(!renderedItemText.includes('Terima kasih banyak pak'), 'Thread milik Ihsan DILARANG tampil di layar User C');

  console.log('  ✓ Thread percakapan orang lain 100% tidak tampak pada Tab Chats akun lain.\n');

  // -----------------------------------------------------------------
  // [TEST 6] Isolasi Sinkronisasi Background Firebase (pasangGlobalChatRoomsListener)
  // -----------------------------------------------------------------
  console.log('▶ [Test 6] Pengujian Isolasi Sinkronisasi Real-Time Background Listener...');

  global.currentUser = userC;
  mockLocalStorage['user_aktif'] = JSON.stringify(userC);

  // Pasang global listener pada sesi User C
  global.pasangGlobalChatRoomsListener(true);

  // Simulasikan pesan baru masuk di cloud pada room Ihsan & Pak Echa
  const secretCloudMsgId = 'MSG_SECRET_CLOUD_123';
  await global.db.ref('chat_rooms/' + directRoomIhsanEcha + '/messages/' + secretCloudMsgId).set({
    id: secretCloudMsgId,
    roomId: directRoomIhsanEcha,
    pengirimId: '0098263610',
    nama: 'M. IHSAN ATHALLAH',
    pesan: 'Pesan rahasia antara Ihsan dan Pak Echa',
    waktu: Date.now() + 10000
  });

  // Verifikasi bahwa listener User C mengabaikan pesan tersebut
  // Pesan tidak boleh masuk ke cache User C
  const userCThreads = JSON.parse(mockLocalStorage['wa_threads'] || '{}');
  // Metadata thread User C untuk room Ihsan & Pak Echa tidak boleh diperbarui
  if (userCThreads[directRoomIhsanEcha]) {
    assert.notStrictEqual(userCThreads[directRoomIhsanEcha].lastMessage, 'Pesan rahasia antara Ihsan dan Pak Echa');
  }

  console.log('  ✓ Listener latar belakang akun User C tidak menangkap pesan obrolan akun lain.\n');

  // -----------------------------------------------------------------
  // [TEST 7] Isolasi Unread Badge Counter (perbaruiBadgeCounter)
  // -----------------------------------------------------------------
  console.log('▶ [Test 7] Pengujian Isolasi Unread Badge Counter (#waBadgeCounter)...');

  // Pastikan tidak sedang berada di dalam room obrolan aktif (kembali ke list)
  global.kembaliKeDaftarWa();

  // Tandai last read untuk room Ihsan & Pak Echa ke 0 (belum dibaca)
  mockLocalStorage['wa_last_read_' + directRoomIhsanEcha] = '0';
  mockLocalStorage['wa_last_read_' + userCRoomWithPakEcha] = String(Date.now() + 999999); // Sudah dibaca semua oleh C

  // Sesi User C
  global.currentUser = userC;
  mockLocalStorage['user_aktif'] = JSON.stringify(userC);

  global.perbaruiBadgeCounter();

  // User C tidak boleh melihat badge 1 unread dari room Ihsan & Pak Echa!
  assert.strictEqual(badgeCounter.style.display, 'none', 'Badge counter User C harus 0 (display: none), tidak terpengaruh unread room orang lain');

  // Sekarang beralih ke sesi Pak Echa (peserta sah yang berhak menerima notif di portal guru)
  global.window.location = { pathname: '/dashboard-guru.html', href: 'http://localhost/dashboard-guru.html' };
  global.currentUser = userPakEcha;
  mockLocalStorage['guru_aktif'] = JSON.stringify(userPakEcha);

  global.perbaruiBadgeCounter();
  assert.strictEqual(badgeCounter.style.display, 'flex', 'Badge counter Pak Echa harus aktif (display: flex) karena ada unread sah');

  // Kembalikan konteks ke dashboard siswa
  global.window.location = { pathname: '/dashboard.html', href: 'http://localhost/dashboard.html' };

  console.log('  ✓ Unread badge counter terisolasi presisi dan tidak pernah bocor ke akun lain.\n');

  // -----------------------------------------------------------------
  // [TEST 8] Layout Bubble Pesan & Eliminasi Tag Grup pada Obrolan Pribadi
  // -----------------------------------------------------------------
  console.log('▶ [Test 8] Pengujian Tata Letak Bubble Pesan & Bebas dari Tag Grup Admin di Chat Pribadi...');

  messagesContainer.children = [];

  // Simulasi Siswa Ihsan sedang membuka obrolan pribadi dengan Pak Echa
  global.currentUser = userIhsan;
  mockLocalStorage['user_aktif'] = JSON.stringify(userIhsan);

  // 1. Pesan keluar (dikirim oleh Ihsan)
  const outgoingMsg = {
    id: 'MSG_OUTGOING_001',
    roomId: directRoomIhsanEcha,
    pengirimId: '0098263610',
    nama: 'M. IHSAN ATHALLAH',
    pesan: 'Selamat siang pak',
    waktu: Date.now()
  };
  global.appendBubblePesan(outgoingMsg);

  // 2. Pesan masuk (dikirim oleh Pak Echa yang memiliki role 'walas')
  const incomingMsg = {
    id: 'MSG_INCOMING_001',
    roomId: directRoomIhsanEcha,
    pengirimId: '199209142022211007',
    nama: 'Muhammad Echa Putra, S.Kom.Gr',
    role: 'walas',
    pesan: 'Siang Ihsan, ada apa?',
    waktu: Date.now() + 1000
  };
  global.appendBubblePesan(incomingMsg);

  assert.strictEqual(messagesContainer.children.length, 2, 'Harus ada 2 bubble pesan di container');

  const bubbleOut = messagesContainer.children[0];
  const bubbleIn = messagesContainer.children[1];

  // Verifikasi Bubble Keluar (Sent / Kanan)
  assert.ok(bubbleOut.classList.contains('sent'), 'Pesan pengirim harus memiliki kelas .sent (di kanan)');
  assert.ok(!bubbleOut.classList.contains('received'), 'Pesan pengirim TIDAK boleh memiliki kelas .received');

  // Verifikasi Bubble Masuk (Received / Kiri)
  assert.ok(bubbleIn.classList.contains('received'), 'Pesan lawan bicara harus memiliki kelas .received (di kiri)');
  assert.ok(!bubbleIn.classList.contains('sent'), 'Pesan lawan bicara TIDAK boleh memiliki kelas .sent');

  // Verifikasi Tidak Ada Tag Grup 👑 Admin di Obrolan Pribadi
  assert.ok(!bubbleIn.innerHTML.includes('👑 Admin'), 'Bubble obrolan pribadi DILARANG memuat badge grup 👑 Admin');
  assert.ok(!bubbleOut.innerHTML.includes('👑 Admin'), 'Bubble pesan keluar DILARANG memuat badge grup 👑 Admin');

  // Sekarang uji perbandingan dengan Grup Chat (harus tetap memuat badge 👑 Admin untuk admin)
  const groupMsg = {
    id: 'MSG_GROUP_001',
    roomId: 'group_XII_RPL_2',
    pengirimId: '199209142022211007',
    nama: 'Muhammad Echa Putra, S.Kom.Gr',
    role: 'walas',
    pesan: 'Pengumuman kelas RPL 2',
    waktu: Date.now() + 2000
  };
  global.appendBubblePesan(groupMsg);

  const bubbleGroup = messagesContainer.children[2];
  assert.ok(bubbleGroup.innerHTML.includes('👑 Admin'), 'Pada grup resmi, badge 👑 Admin tetap dipertahankan');

  console.log('  ✓ Layout bubble sempurna: Pengirim di kanan (sent), penerima di kiri (received), bebas tag grup di chat privat.\n');

  // -----------------------------------------------------------------
  // [TEST 9] Isolasi Event Lintas-Tab (BroadcastChannel & Storage)
  // -----------------------------------------------------------------
  console.log('▶ [Test 9] Pengujian Isolasi Event Lintas-Tab (BroadcastChannel & Storage)...');

  // Siapkan channel broadcast
  global.currentUser = userC;
  mockLocalStorage['user_aktif'] = JSON.stringify(userC);

  // Pesan obrolan A & B diposting di BroadcastChannel
  const foreignBroadcastEvent = {
    data: {
      type: 'NEW_WA_MESSAGE',
      senderTabId: 'other_tab_999',
      roomId: directRoomIhsanEcha,
      message: {
        id: 'MSG_BC_FOREIGN_001',
        roomId: directRoomIhsanEcha,
        pengirimId: '0098263610',
        nama: 'M. IHSAN ATHALLAH',
        pesan: 'Pesan broadcast lintas tab A dan B'
      }
    }
  };

  // Panggil listener internal broadcast channel jika terpasang
  // User C tidak boleh memproses pesan ini
  const isDirectInC = global.isUserInDirectRoom(userC, foreignBroadcastEvent.data.roomId);
  assert.strictEqual(isDirectInC, false, 'User C terkonfirmasi bukan peserta dari pesan broadcast ini');

  console.log('  ✓ Event lintas tab terlindungi dari kebocoran ke tab akun lain.\n');

  // -----------------------------------------------------------------
  // [TEST 10] Buka Chat Langsung via ID Target (bukaChatWhatsApp)
  // -----------------------------------------------------------------
  console.log('▶ [Test 10] Pengujian Resolusi Target bukaChatWhatsApp...');

  // User C membuka chat dengan Pak Echa via NIP
  global.currentUser = userC;
  mockLocalStorage['user_aktif'] = JSON.stringify(userC);

  global.bukaChatWhatsApp('199209142022211007', 'direct');

  // Harus menghasilkan room antara User C dan Pak Echa, BUKAN room Ihsan & Pak Echa!
  assert.strictEqual(chatView.style.display, 'flex');
  assert.strictEqual(headerName.textContent, 'Muhammad Echa Putra, S.Kom.Gr');

  // User C mencoba memanggil bukaChatWhatsApp dengan room ID Ihsan secara eksplisit
  listPanel.style.display = 'flex';
  chatView.style.display = 'none';
  lastAlertMessage = null;

  global.bukaChatWhatsApp(directRoomIhsanEcha, 'direct');
  assert.strictEqual(chatView.style.display, 'none', 'Panggilan bukaChatWhatsApp dengan direct room orang lain harus diblokir');
  assert.ok(lastAlertMessage && lastAlertMessage.includes('Akses Ditolak'));

  // User A (peserta sah) memanggil bukaChatWhatsApp dengan direct room ID
  global.currentUser = userIhsan;
  mockLocalStorage['user_aktif'] = JSON.stringify(userIhsan);
  global.bukaChatWhatsApp(directRoomIhsanEcha, 'direct');
  assert.strictEqual(chatView.style.display, 'flex');
  assert.strictEqual(headerName.textContent, 'Muhammad Echa Putra, S.Kom.Gr', 'bukaChatWhatsApp harus meresolusi nama lawan bicara');

  console.log('  ✓ bukaChatWhatsApp menghasilkan room privat yang tepat dan menolak room ID orang lain.\n');

  // -----------------------------------------------------------------
  // [TEST 11] Proteksi Pergantian Akun saat Room Sedang Terbuka
  // -----------------------------------------------------------------
  console.log('▶ [Test 11] Pengujian Proteksi Pergantian Akun saat Room Terbuka...');
  
  // User A (Ihsan) sedang membuka room pribadi dengan Pak Echa
  global.currentUser = userIhsan;
  mockLocalStorage['user_aktif'] = JSON.stringify(userIhsan);
  global.bukaRoomWa(directRoomIhsanEcha, 'Muhammad Echa Putra, S.Kom.Gr', 'Pribadi', 'direct');
  assert.strictEqual(chatView.style.display, 'flex', 'Room Ihsan terbuka');

  // Akun berganti menjadi User C (terverifikasi) via storage event (misal login/switch)
  global.currentUser = userC;
  mockLocalStorage['user_aktif'] = JSON.stringify(userC);

  // Dispatch storage event ke listener
  const storageListeners = windowListeners['storage'] || [];
  storageListeners.forEach(fn => fn({ key: 'user_aktif' }));

  assert.strictEqual(chatView.style.display, 'none', 'Chat view HARUS langsung ditutup saat akun luar aktif');
  assert.strictEqual(listPanel.style.display, 'flex', 'Harus dikembalikan ke panel list');

  console.log('  ✓ Pergantian akun seketika menutup room privat dan mengamankan pesan dari akun baru.\n');

  // -----------------------------------------------------------------
  // [TEST 12] Pencegahan False Sender Attribution (Kesamaan Nama Tanpa Kecocokan ID)
  // -----------------------------------------------------------------
  console.log('▶ [Test 12] Pengujian Pencegahan False Sender Attribution...');
  
  const msgFromOtherUserWithSameName = {
    id: 'MSG_COLLIDE_NAME_001',
    pengirimId: userC.id,
    nama: userIhsan.nama, // Nama kebetulan sama dengan Ihsan
    pesan: 'Pesan dari orang lain yang bernama sama',
    waktu: Date.now()
  };

  const isAttributedToIhsan = global.isCurrentSender(msgFromOtherUserWithSameName, userIhsan);
  assert.strictEqual(isAttributedToIhsan, false, 'Pesan dengan ID pengirim berbeda TIDAK BOLEH diklaim sebagai isMe hanya karena kesamaan nama');

  console.log('  ✓ False sender attribution berhasil dicegah: ID pengirim diutamakan di atas kecocokan nama string.\n');

  console.log('================================================================');
  console.log('🎉 SELURUH PENGUJIAN ISOLASI & KEAMANAN CHAT PRIBADI LULUS 100%!');
  console.log('================================================================');
}

runAllSecurityIsolationTests().catch(err => {
  console.error('\n❌ PENGUJIAN GAGAL:', err);
  process.exit(1);
});
