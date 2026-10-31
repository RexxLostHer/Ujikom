/**
 * ===================================================================
 * TEST SUITE: test-phantom-chat-badge-fix.js
 * VERIFIKASI PERBAIKAN NOTIFIKASI PHANTOM CHAT PADA LOGIN (R1)
 * Presensia IoT — SMK Negeri 1 Sumedang
 * ===================================================================
 * Memverifikasi 5 Kriteria Penerimaan Milestone 1:
 * - Kriteria A1: Siswa login fresh dengan pesan historis -> Badge TIDAK tampil (display: none, text: '0')
 * - Kriteria A2: Pengunjung / Tamu unverified login -> Badge TIDAK tampil (display: none, text: '0') & lock badge aktif
 * - Kriteria B: Guru/Walas login di dashboard-guru.html -> Badge TIDAK tampil (display: none, text: '0')
 * - Kriteria C: Pesan masuk baru (real-time) -> Badge ter-increment dan tampil presisi (display: flex)
 * - Kriteria D1: Membuka room obrolan aktif -> Badge otomatis direset (display: none, text: '0')
 * - Kriteria D2: Membuka jendela Chat Hub list view -> Badge otomatis direset (display: none, text: '0')
 * - Kriteria E: Kompatibilitas mundur dengan test lama yang mengeset wa_last_read = '0'
 * - Ekstra: Isolasi multi-akun pada perangkat bersama (anti-leak storage)
 * ===================================================================
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('================================================================');
console.log('🧪 PENGUJIAN PERBAIKAN NOTIFIKASI PHANTOM CHAT PADA LOGIN (R1)');
console.log('================================================================\n');

// -------------------------------------------------------------
// 1. SETUP MOCK DOM & ENVIRONMENT
// -------------------------------------------------------------
const mockLocalStorage = {};
const mockSessionStorage = {};
const domStore = {};

function createMockElement(tag, id = '') {
  let _innerHTML = '';
  const el = {
    tagName: tag.toUpperCase(),
    id: id,
    value: '',
    textContent: '0',
    title: '',
    style: {},
    children: [],
    dataset: {},
    classList: {
      _classes: new Set(),
      add: function (...args) { args.forEach(c => this._classes.add(c)); },
      remove: function (...args) { args.forEach(c => this._classes.delete(c)); },
      contains: function (c) { return this._classes.has(c); }
    },
    appendChild: function (child) {
      if (!child) return child;
      this.children.push(child);
      if (child.id) domStore[child.id] = child;
      return child;
    },
    removeChild: function (child) {
      this.children = this.children.filter(c => c !== child);
      if (child && child.id && domStore[child.id] === child) delete domStore[child.id];
      return child;
    },
    querySelectorAll: (selector) => {
      const list = [];
      function traverse(n) {
        if (!n || !n.children) return;
        n.children.forEach(ch => {
          if (selector.startsWith('.') && ch.classList && ch.classList.contains(selector.slice(1))) list.push(ch);
          else if (selector.startsWith('#') && ch.id === selector.slice(1)) list.push(ch);
          traverse(ch);
        });
      }
      traverse(el);
      return list;
    },
    querySelector: (selector) => {
      const res = el.querySelectorAll(selector);
      return res.length > 0 ? res[0] : null;
    },
    focus: () => {},
    addEventListener: () => {},
    removeEventListener: () => {}
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
        const childEl = createMockElement(tagName, idMatch ? idMatch[1] : '');
        el.children.push(childEl);
        if (childEl.id) domStore[childEl.id] = childEl;
      }
    }
  });

  if (id) domStore[id] = el;
  return el;
}

global.window = global;
global.window.location = { pathname: '/dashboard.html', href: 'http://localhost/dashboard.html' };
global.window.addEventListener = () => {};
global.window.removeEventListener = () => {};
global.navigator = { userAgent: 'node' };

global.document = {
  readyState: 'complete',
  getElementById: (id) => domStore[id] || null,
  createElement: (t) => createMockElement(t),
  body: createMockElement('body', 'body'),
  addEventListener: () => {},
  removeEventListener: () => {},
  querySelectorAll: (selector) => {
    const list = [];
    Object.values(domStore).forEach(n => {
      if (selector.startsWith('.') && n.classList && n.classList.contains(selector.slice(1))) list.push(n);
      else if (selector.startsWith('#') && n.id === selector.slice(1)) list.push(n);
    });
    return list;
  }
};

global.localStorage = {
  getItem: (k) => (k in mockLocalStorage ? mockLocalStorage[k] : null),
  setItem: (k, v) => { mockLocalStorage[k] = String(v); },
  removeItem: (k) => { delete mockLocalStorage[k]; },
  clear: () => { Object.keys(mockLocalStorage).forEach(k => delete mockLocalStorage[k]); }
};

global.sessionStorage = {
  getItem: (k) => (k in mockSessionStorage ? mockSessionStorage[k] : null),
  setItem: (k, v) => { mockSessionStorage[k] = String(v); },
  removeItem: (k) => { delete mockSessionStorage[k]; },
  clear: () => { Object.keys(mockSessionStorage).forEach(k => delete mockSessionStorage[k]); }
};

// Siapkan Elemen DOM Inti
const btnFloat = createMockElement('div', 'waFloatingBtn');
const badgeCounter = createMockElement('div', 'waBadgeCounter');
badgeCounter.style.display = 'none';
badgeCounter.textContent = '0';
btnFloat.appendChild(badgeCounter);

const hubWin = createMockElement('div', 'waHubWindow');
hubWin.style.display = 'none';

const appbarBadge = createMockElement('span', 'waAppbarBadge');
appbarBadge.style.display = 'none';
appbarBadge.textContent = '0';

const sidebarBadge = createMockElement('span', 'badgeWaHubSidebar');
sidebarBadge.style.display = 'none';
sidebarBadge.textContent = '0';

// Mock Firebase RTDB
const mockDbStore = {};
global.db = {
  ref: (p) => ({
    set: async (v) => { mockDbStore[p] = v; return v; },
    update: async (v) => { mockDbStore[p] = Object.assign(mockDbStore[p] || {}, v); return mockDbStore[p]; },
    once: async () => ({ val: () => mockDbStore[p] || null }),
    on: (evt, cb) => {
      cb({ val: () => mockDbStore[p] || null });
      return cb;
    },
    off: () => {}
  })
};

// Muat modul chat-hub.js
const chatHub = require('../assets/chat-hub.js');

async function runVerification() {
  // =================================================================
  // [TEST 1] KRITERIA A1: LOGIN SISWA FRESH DENGAN PESAN HISTORIS
  // =================================================================
  console.log('▶ [Test 1] Pengujian Kriteria A1: Login Siswa Baru (Bebas Notifikasi Phantom)...');

  // Bersihkan storage total
  global.localStorage.clear();
  global.sessionStorage.clear();
  global.window.location = { pathname: '/dashboard.html', href: 'http://localhost/dashboard.html' };

  // Set sesi Siswa Terverifikasi M. Ihsan (XII RPL 2)
  const siswaIhsan = {
    uid: 'UID_0098263610',
    nisn: '0098263610',
    nama: 'M. IHSAN ATHALLAH',
    role: 'siswa',
    isVerified: true,
    kelas: 'XII RPL 2'
  };
  mockSessionStorage['user_aktif'] = JSON.stringify(siswaIhsan);
  mockLocalStorage['user_aktif'] = JSON.stringify(siswaIhsan);

  // Simulasikan pesan historis dari cloud Firebase yang telah ada di grup kelas XII RPL 2
  const pastTimestamp = Date.now() - (24 * 60 * 60 * 1000); // 1 hari lalu
  mockLocalStorage['wa_threads'] = JSON.stringify({
    'group_XII_RPL_2': { lastMsg: 'Tugas basis data minggu lalu', waktu: pastTimestamp }
  });
  mockLocalStorage['wa_msgs_group_XII_RPL_2'] = JSON.stringify([
    {
      id: 'msg_old_1',
      pengirimId: '199209142022211007',
      nama: 'Pak Echa',
      pesan: 'Tugas basis data minggu lalu',
      waktu: pastTimestamp,
      status: 'read'
    },
    {
      id: 'msg_old_2',
      pengirimId: '0098263611',
      nama: 'Teman Sekelas',
      pesan: 'Sudah saya kumpulkan pak',
      waktu: pastTimestamp + 1000,
      status: 'sent'
    }
  ]);

  // Pastikan TIDAK ADA kunci wa_last_read sebelumnya di localStorage
  assert.strictEqual(mockLocalStorage['wa_last_read_group_XII_RPL_2'], undefined);
  assert.strictEqual(mockLocalStorage['wa_last_read_0098263610_group_XII_RPL_2'], undefined);

  // Jalankan kalkulasi badge saat sesi login diinisialisasi
  const unreadCount1 = chatHub.perbaruiBadgeCounter();

  // Asersi Kriteria A1
  assert.strictEqual(badgeCounter.style.display, 'none', 'Badge counter #waBadgeCounter HARUS display: none pada fresh login');
  assert.strictEqual(badgeCounter.textContent, '0', 'Badge counter #waBadgeCounter HARUS berisi teks "0" pada fresh login');
  assert.strictEqual(unreadCount1, 0, 'Kalkulasi unread harus tepat 0 pesan');

  console.log('  ✓ Siswa login fresh terbukti 100% bebas dari notifikasi phantom chat badge.\n');

  // =================================================================
  // [TEST 2] KRITERIA A2: LOGIN PENGUNJUNG / TAMU (UNVERIFIED LOCKDOWN)
  // =================================================================
  console.log('▶ [Test 2] Pengujian Kriteria A2: Login Pengunjung (Bebas Badge & Lock Terpasang)...');

  // Simulasikan kasus residu: terdapat siswa_aktif tersisa di storage dari sesi siswa sebelumnya
  mockLocalStorage['siswa_aktif'] = JSON.stringify(siswaIhsan);

  // Sesi pengunjung baru
  const userTamu = {
    uid: 'UID_TAMU_9999',
    email: 'tamu@sekolah.sch.id',
    nama: 'Pengunjung Tamu',
    role: 'pengunjung',
    isVerified: false
  };
  mockSessionStorage['user_aktif'] = JSON.stringify(userTamu);
  mockLocalStorage['user_aktif'] = JSON.stringify(userTamu);

  // Jika auth.js diterapkan benar, sesi kotor dibersihkan
  try {
    const authMod = require('../assets/auth.js');
    if (typeof authMod.clearSession === 'function') {
      authMod.clearSession();
      mockSessionStorage['user_aktif'] = JSON.stringify(userTamu);
      mockLocalStorage['user_aktif'] = JSON.stringify(userTamu);
    }
  } catch (e) {}

  chatHub.perbaruiStatusWaChatHub();
  const unreadCountTamu = chatHub.perbaruiBadgeCounter();

  // Asersi Kriteria A2
  assert.strictEqual(badgeCounter.style.display, 'none', 'Pengunjung TIDAK BOLEH melihat unread badge');
  assert.strictEqual(badgeCounter.textContent, '0', 'Badge counter pengunjung harus teks "0"');
  assert.strictEqual(unreadCountTamu, 0, 'Unread pengunjung harus 0');

  // Gembok verifikasi harus aktif
  const lockBadge = domStore['waFloatingLockBadge'];
  assert.ok(lockBadge || btnFloat.classList.contains('wa-floating-btn-locked'), 'Tombol floating pengunjung harus terkunci gembok verifikasi');

  console.log('  ✓ Pengunjung / Tamu terbukti 100% bebas dari badge dan akses chat terkunci sempurna.\n');

  // =================================================================
  // [TEST 3] KRITERIA B: LOGIN GURU DI DASHBOARD-GURU.HTML
  // =================================================================
  console.log('▶ [Test 3] Pengujian Kriteria B: Login Guru di dashboard-guru.html...');

  global.localStorage.clear();
  global.sessionStorage.clear();
  global.window.location = { pathname: '/dashboard-guru.html', href: 'http://localhost/dashboard-guru.html' };

  const guruEcha = {
    uid: 'UID_199209142022211007',
    nip: '199209142022211007',
    nama: 'Muhammad Echa Putra, S.Kom.Gr',
    role: 'walas',
    isWalas: true,
    walasKelasId: 'XII RPL 2',
    isVerified: true
  };
  mockSessionStorage['user_aktif'] = JSON.stringify(guruEcha);
  mockLocalStorage['guru_aktif'] = JSON.stringify(guruEcha);
  global.window.guruAktif = guruEcha;

  // Grup dewan guru memiliki pesan lama
  mockLocalStorage['wa_threads'] = JSON.stringify({
    'group_dewan_guru': { lastMsg: 'Undangan rapat pembagian jam mengajar', waktu: pastTimestamp }
  });
  mockLocalStorage['wa_msgs_group_dewan_guru'] = JSON.stringify([
    {
      id: 'm_guru_old',
      pengirimId: 'ADMIN',
      nama: 'Kepala Sekolah',
      pesan: 'Undangan rapat pembagian jam mengajar',
      waktu: pastTimestamp,
      status: 'read'
    }
  ]);

  chatHub.perbaruiStatusWaChatHub();
  const unreadCountGuru = chatHub.perbaruiBadgeCounter();

  // Asersi Kriteria B
  assert.strictEqual(badgeCounter.style.display, 'none', 'Portal Guru HARUS bebas phantom badge pada login awal');
  assert.strictEqual(badgeCounter.textContent, '0', 'Badge counter guru harus berisi "0"');
  assert.strictEqual(unreadCountGuru, 0, 'Unread guru harus 0');

  console.log('  ✓ Portal Guru dashboard-guru.html terbukti 100% bebas dari notifikasi phantom.\n');

  // =================================================================
  // [TEST 4] KRITERIA C: PESAN MASUK BARU SECARA REAL-TIME (INCREMENT)
  // =================================================================
  console.log('▶ [Test 4] Pengujian Kriteria C: Pesan Masuk Baru Real-Time (Badge Increments)...');

  // Kembali ke sesi Siswa Ihsan
  global.window.location = { pathname: '/dashboard.html', href: 'http://localhost/dashboard.html' };
  mockSessionStorage['user_aktif'] = JSON.stringify(siswaIhsan);
  mockLocalStorage['user_aktif'] = JSON.stringify(siswaIhsan);
  chatHub.setRoomLastRead(siswaIhsan, 'group_XII_RPL_2', Date.now());
  chatHub.perbaruiStatusWaChatHub();

  // 1. Pesan baru masuk dari Pak Echa ke grup kelas XII RPL 2
  const newMsgTimestamp = Date.now() + 5000;
  const currentGroupMsgs = JSON.parse(mockLocalStorage['wa_msgs_group_XII_RPL_2'] || '[]');
  currentGroupMsgs.push({
    id: 'msg_incoming_001',
    pengirimId: '199209142022211007',
    nama: 'Pak Echa',
    pesan: 'PENGUMUMAN PENTING: Besok Ujikom Praktik dimulai jam 07:00 WIB',
    waktu: newMsgTimestamp,
    status: 'sent'
  });
  mockLocalStorage['wa_msgs_group_XII_RPL_2'] = JSON.stringify(currentGroupMsgs);
  chatHub.updateThreadMetadata('group_XII_RPL_2', currentGroupMsgs[currentGroupMsgs.length - 1]);

  // RTDB listener memicu perbaruiBadgeCounter
  const countNew1 = chatHub.perbaruiBadgeCounter();

  // Asersi Kriteria C (Pesan 1)
  assert.strictEqual(countNew1, 1, 'Unread count harus bertambah menjadi 1');
  assert.strictEqual(badgeCounter.style.display, 'flex', 'Badge counter harus tampil (display: flex) saat ada pesan baru');
  assert.strictEqual(badgeCounter.textContent, '1', 'Badge counter harus menampilkan teks "1"');

  // 2. Pesan kedua masuk dari direct chat wali kelas
  const directRoomId = 'direct_0098263610_199209142022211007';
  const threads = JSON.parse(mockLocalStorage['wa_threads'] || '{}');
  threads[directRoomId] = { contactName: 'Pak Echa', lastMsg: 'Ihsan, bawa kartu RFID besok', waktu: newMsgTimestamp + 1000 };
  mockLocalStorage['wa_threads'] = JSON.stringify(threads);

  mockLocalStorage['wa_msgs_' + directRoomId] = JSON.stringify([
    {
      id: 'msg_incoming_002',
      pengirimId: '199209142022211007',
      nama: 'Pak Echa',
      pesan: 'Ihsan, bawa kartu RFID besok',
      waktu: newMsgTimestamp + 1000,
      status: 'sent'
    }
  ]);

  const countNew2 = chatHub.perbaruiBadgeCounter();

  // Asersi Kriteria C (Pesan 2)
  assert.strictEqual(countNew2, 2, 'Unread count harus bertambah menjadi 2');
  assert.strictEqual(badgeCounter.style.display, 'flex');
  assert.strictEqual(badgeCounter.textContent, '2', 'Badge counter harus menampilkan teks "2"');

  // 3. Pesan keluar (dikirim sendiri oleh Ihsan) tidak boleh menambah unread
  const msgsDirect = JSON.parse(mockLocalStorage['wa_msgs_' + directRoomId]);
  msgsDirect.push({
    id: 'msg_self_001',
    pengirimId: '0098263610',
    nama: 'M. IHSAN ATHALLAH',
    pesan: 'Siap pak, kartu RFID sudah siap di saku',
    waktu: newMsgTimestamp + 2000,
    status: 'sent'
  });
  mockLocalStorage['wa_msgs_' + directRoomId] = JSON.stringify(msgsDirect);

  const countAfterSelf = chatHub.perbaruiBadgeCounter();
  assert.strictEqual(countAfterSelf, 2, 'Pesan keluar milik pengguna aktif DILARANG menambah unread counter');

  console.log('  ✓ Pesan baru real-time terbukti presisi meng-increment counter dan mengabaikan pesan sendiri.\n');

  // =================================================================
  // [TEST 5] KRITERIA D1: MEMBUKA ROOM OBROLAN MERESET BADGE
  // =================================================================
  console.log('▶ [Test 5] Pengujian Kriteria D1: Membuka Room Chat Spesifik Mereset Badge...');

  // Buka room direct Ihsan & Pak Echa
  chatHub.bukaChatWhatsApp('199209142022211007', 'direct');

  // Unread di direct room harus ter-cleared, tersisa 1 unread dari group_XII_RPL_2
  const countAfterOpenDirect = chatHub.perbaruiBadgeCounter();
  assert.strictEqual(countAfterOpenDirect, 1, 'Unread berkurang dari 2 menjadi 1 setelah 1 room dibaca');
  assert.strictEqual(badgeCounter.textContent, '1');

  // Sekarang buka room group_XII_RPL_2
  chatHub.bukaChatWhatsApp('group_XII_RPL_2', 'group');

  const countAfterAllRead = chatHub.perbaruiBadgeCounter();
  assert.strictEqual(countAfterAllRead, 0, 'Seluruh pesan telah dibaca, unread count harus 0');
  assert.strictEqual(badgeCounter.style.display, 'none', 'Badge counter harus disembunyikan (display: none) saat seluruh pesan telah dibuka');
  assert.strictEqual(badgeCounter.textContent, '0', 'Badge counter harus berisi "0"');

  console.log('  ✓ Membuka room obrolan terbukti 100% akurat membersihkan badge counter.\n');

  // =================================================================
  // [TEST 6] KRITERIA D2: MEMBUKA JENDELA CHAT HUB (LIST VIEW)
  // =================================================================
  console.log('▶ [Test 6] Pengujian Kriteria D2: Membuka Jendela Chat Hub (bukaJendelaWaHub)...');

  // Simulasikan pesan baru masuk saat jendela chat tertutup
  hubWin.style.display = 'none';
  global.waActiveRoomId = null;
  const msgsGroup = JSON.parse(mockLocalStorage['wa_msgs_group_XII_RPL_2']);
  msgsGroup.push({
    id: 'msg_incoming_003',
    pengirimId: '199209142022211007',
    nama: 'Pak Echa',
    pesan: 'Pengumuman tambahan',
    waktu: Date.now() + 10000,
    status: 'sent'
  });
  mockLocalStorage['wa_msgs_group_XII_RPL_2'] = JSON.stringify(msgsGroup);

  chatHub.perbaruiBadgeCounter();
  assert.strictEqual(badgeCounter.style.display, 'flex');

  // Pengguna menekan tombol floating untuk membuka jendela Chat Hub
  chatHub.bukaJendelaWaHub();

  assert.strictEqual(hubWin.style.display, 'flex', 'Jendela Chat Hub harus terbuka (display: flex)');
  assert.strictEqual(badgeCounter.style.display, 'none', 'Membuka jendela chat hub harus menyembunyikan badge counter');
  assert.strictEqual(badgeCounter.textContent, '0');

  console.log('  ✓ Membuka jendela Chat Hub terbukti mereset status badge mengambang.\n');

  // =================================================================
  // [TEST 7] KRITERIA E: KOMPATIBILITAS MUNDUR DENGAN TEST LAMA (wa_last_read = '0')
  // =================================================================
  console.log('▶ [Test 7] Pengujian Kriteria E: Kompatibilitas Mundur (Explicit wa_last_read = "0")...');

  // Simulasikan persis seperti yang dilakukan oleh test-private-chat-isolation-security.js dan test-admin-whatsapp-and-lampiran.js
  hubWin.style.display = 'none';
  global.waActiveRoomId = null;

  mockLocalStorage['wa_threads'] = JSON.stringify({
    'group_walas_sumedang': { lastMsg: 'Rapat koordinasi jam 10' }
  });
  mockLocalStorage['wa_msgs_group_walas_sumedang'] = JSON.stringify([
    { id: 'm_legacy_1', pengirimId: 'WALAS-01', pengirimNama: 'Pak Echa', teks: 'Selamat pagi admin', waktu: Date.now() + 1000 }
  ]);
  // Test suite lama mengeset last read eksplisit '0'
  mockLocalStorage['wa_last_read_group_walas_sumedang'] = '0';

  // Sesi Admin
  global.window.location = { pathname: '/admin.html', href: 'http://localhost/admin.html' };
  delete mockLocalStorage['siswa_aktif'];
  delete mockLocalStorage['guru_aktif'];
  const adminUser = {
    id: 'admin',
    nip: 'ADMIN-01',
    nama: 'Administrator',
    role: 'admin',
    isVerified: true
  };
  mockSessionStorage['user_aktif'] = JSON.stringify(adminUser);
  mockLocalStorage['user_aktif'] = JSON.stringify(adminUser);
  mockLocalStorage['admin_aktif'] = JSON.stringify(adminUser);
  chatHub.perbaruiStatusWaChatHub();

  const countLegacy = chatHub.perbaruiBadgeCounter();

  // Asersi Kriteria E: Harus tetap menghitung 1 unread dan menyinkronkan ketiga badge
  assert.strictEqual(countLegacy, 1, 'Pengaturan eksplisit wa_last_read="0" oleh unit test harus tetap dihitung unread');
  assert.strictEqual(badgeCounter.textContent, '1', 'Floating badge WA harus menampilkan 1');
  assert.strictEqual(appbarBadge.textContent, '1', 'Appbar badge WA harus menampilkan 1');
  assert.strictEqual(sidebarBadge.textContent, '1', 'Sidebar badge WA harus menampilkan 1');

  console.log('  ✓ Kompatibilitas mundur dengan test suite lama terjamin 100% sukses.\n');

  // =================================================================
  // [TEST 8] EKSTRA: ISOLASI MULTI-USER PADA SATU PERANGKAT (USER-SCOPED KEYS)
  // =================================================================
  // Sesi User A (Siswa Ihsan) di dashboard.html
  global.window.location = { pathname: '/dashboard.html', href: 'http://localhost/dashboard.html' };
  delete mockLocalStorage['admin_aktif'];
  delete mockLocalStorage['guru_aktif'];
  mockSessionStorage['user_aktif'] = JSON.stringify(siswaIhsan);
  mockLocalStorage['user_aktif'] = JSON.stringify(siswaIhsan);
  chatHub.perbaruiStatusWaChatHub();

  // User A (Siswa Ihsan) telah membaca semua pesan
  chatHub.bukaChatWhatsApp('group_XII_RPL_2', 'group');
  assert.strictEqual(chatHub.perbaruiBadgeCounter(), 0);

  // User A logout: clearSession membersihkan user_aktif dan siswa_aktif
  global.sessionStorage.clear();
  delete mockLocalStorage['user_aktif'];
  delete mockLocalStorage['siswa_aktif'];

  // User B (Siswa Bima, XII RPL 1) login di browser yang sama
  const siswaBima = {
    uid: 'UID_0098263699',
    nisn: '0098263699',
    nama: 'BIMA ARDIANSYAH',
    role: 'siswa',
    isVerified: true,
    kelas: 'XII RPL 1'
  };
  mockSessionStorage['user_aktif'] = JSON.stringify(siswaBima);
  mockLocalStorage['user_aktif'] = JSON.stringify(siswaBima);

  // Siswa Bima belum pernah membuka room kelasnya (fresh baseline)
  mockLocalStorage['wa_threads'] = JSON.stringify({
    'group_XII_RPL_1': { lastMsg: 'Materi TKJ & RPL', waktu: pastTimestamp }
  });
  mockLocalStorage['wa_msgs_group_XII_RPL_1'] = JSON.stringify([
    { id: 'mb_1', pengirimId: 'GURU-02', nama: 'Bu Guru', pesan: 'Materi', waktu: pastTimestamp, status: 'read' }
  ]);

  const countBima = chatHub.perbaruiBadgeCounter();
  assert.strictEqual(countBima, 0, 'Siswa Bima login fresh di perangkat yang sama tidak boleh tertular unread user lain');
  assert.strictEqual(badgeCounter.style.display, 'none');

  console.log('  ✓ Isolasi multi-user dengan user-scoped storage key terbukti 100% aman.\n');

  console.log('================================================================');
  console.log('🎉 SELURUH VERIFIKASI PERBAIKAN PHANTOM CHAT BADGE LULUS 100%!');
  console.log('================================================================');
}

runVerification().catch(err => {
  console.error('\n❌ VERIFIKASI GAGAL:', err);
  process.exit(1);
});
