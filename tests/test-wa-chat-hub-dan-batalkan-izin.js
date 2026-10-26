/**
 * ===================================================================
 * TEST SUITE: FITUR BATALKAN KIRIM IZIN & WHATSAPP CHAT HUB V3
 * Presensia IoT — SMK Negeri 1 Sumedang
 * ===================================================================
 */

const assert = require('assert');

console.log('================================================================');
console.log('🧪 PENGUJIAN BATALKAN KIRIM IZIN & WHATSAPP CHAT HUB V3');
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
  const el = {
    tagName: tag,
    id: id,
    value: '',
    textContent: '',
    innerHTML: '',
    style: {},
    children: [],
    classList: {
      _classes: new Set(),
      add: function (...args) { args.forEach(c => this._classes.add(c)); },
      remove: function (...args) { args.forEach(c => this._classes.delete(c)); },
      contains: function (c) { return this._classes.has(c); }
    },
    querySelectorAll: () => [],
    appendChild: function (child) {
      this.children.push(child);
      if (child.id) domStore[child.id] = child;
    },
    focus: () => {}
  };
  if (id) domStore[id] = el;
  return el;
}

const KNOWN_CHAT_DOM_IDS = ['waMessagesContainer', 'waInputText', 'waInputBar', 'waBtnSend', 'waBtnMic', 'waListPanel', 'waChatView', 'waPanelBody', 'waSearchInput', 'waGroupInfoModal', 'waMentionPopup', 'waChatHeaderName', 'waChatHeaderStatus', 'waBtnGroupInfo', 'waFloatingBtn', 'waHubWindow', 'waHeaderUserDisplay'];

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
  addEventListener: () => {}
};

global.window = {
  location: { pathname: '/dashboard.html', href: 'http://localhost/dashboard.html' },
  document: global.document,
  localStorage: global.localStorage,
  sessionStorage: global.sessionStorage,
  addEventListener: () => {},
  dispatchEvent: () => {}
};

global.confirm = () => true;
global.alert = () => {};

// Mock Database
const mockDb = {
  perijinan: {},
  perizinan: {},
  chat_rooms: {}
};

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
    update: async (val) => {
      const parts = path.split('/');
      let cur = mockDb;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!cur[parts[i]]) cur[parts[i]] = {};
        cur = cur[parts[i]];
      }
      const last = parts[parts.length - 1];
      cur[last] = Object.assign(cur[last] || {}, val);
      return true;
    },
    remove: async () => {
      const parts = path.split('/');
      let cur = mockDb;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!cur[parts[i]]) return;
        cur = cur[parts[i]];
      }
      delete cur[parts[parts.length - 1]];
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
      },
      forEach: (cb) => {
        const val = this.val ? this.val() : null;
        if (val && typeof val === 'object') {
          Object.keys(val).forEach(k => cb({ key: k, ref: { remove: async () => {} } }));
        }
      }
    }),
    on: () => {},
    limitToLast: () => ({ on: () => {} }),
    push: () => ({ key: 'PUSH_' + Date.now(), set: async () => {} })
  })
};

// -------------------------------------------------------------
// [TEST 1] Pengujian "Batalkan Kirim" pada Izin Pending
// -------------------------------------------------------------
console.log('▶ [Test 1] Pengujian Fitur "Batalkan Kirim" Izin...');

const perijinanMod = require('../assets/perijinan.js');
const dashboardMod = require('../assets/dashboard.js');
Object.assign(global, perijinanMod);
Object.assign(global, dashboardMod);

async function runTest1() {
  const userIhsan = { uid: 'UID_0098263610', nisn: '0098263610', nama: 'M. IHSAN ATHALLAH', kelas: 'XII RPL 2', role: 'siswa' };
  global.currentUser = userIhsan;

  // 1. Submit izin baru
  const mockFile = { name: 'surat-izin.jpg', size: 1024, type: 'image/jpeg' };
  const pid = await submitPerijinan(userIhsan, 'sakit', 'Demam tinggi perlu istirahat', '2026-10-26', mockFile);

  assert.ok(pid, 'PID izin harus dibuat');
  assert.strictEqual(mockDb.perijinan[pid].status, 'pending', 'Status awal harus pending');

  // Verifikasi Anti Double-Send mengunci form saat izin pending
  const activePending = ambilIzinPendingAktifSiswa('0098263610', 'sakit', '2026-10-26');
  assert.ok(activePending, 'Form izin harus terkunci saat ada izin pending');

  // 2. Siswa membatalkan izin via batalkanPengajuanIzin
  const batalSuccess = await batalkanPengajuanIzin(pid);
  assert.strictEqual(batalSuccess, true, 'Pembatalan izin harus sukses');

  // Verifikasi status di perijinan & perizinan menjadi dibatalkan
  assert.strictEqual(mockDb.perijinan[pid].status, 'dibatalkan', 'Status di perijinan harus dibatalkan');
  assert.strictEqual(mockDb.perizinan[pid].status, 'dibatalkan', 'Status di perizinan harus dibatalkan');
  assert.ok(mockDb.perijinan[pid].catatan_guru.includes('Dibatalkan oleh siswa'), 'Catatan pembatalan harus ada');

  // 3. Verifikasi Anti Double-Send terbuka seketika setelah pembatalan
  const checkAfterBatal = ambilIzinPendingAktifSiswa('0098263610', 'sakit', '2026-10-26');
  assert.strictEqual(checkAfterBatal, null, 'Kunci form izin harus dilepaskan seketika setelah izin dibatalkan');
  console.log('  ✓ Fitur "Batalkan Kirim" berhasil mengubah status menjadi "dibatalkan" & membuka kunci form re-submit.\n');
}

// -------------------------------------------------------------
// [TEST 2] Pengujian Modul WhatsApp Chat Hub Dasar
// -------------------------------------------------------------
console.log('▶ [Test 2] Pengujian Modul WhatsApp Chat Hub (Kontak, 3 Grup, Voice Note, Mention)...');

require('../assets/chat-hub.js');

async function runTest2() {
  // 1. Verifikasi Pengambilan Kontak Siswa & Guru
  const kontakList = global.getSemuaKontak();
  assert.ok(kontakList.length > 0, 'Daftar kontak harus berisi guru dan siswa');
  const kontakIhsan = kontakList.find(c => c.nomorKontak === '0098263610');
  assert.ok(kontakIhsan, 'Siswa M. Ihsan harus terdaftar sebagai kontak dengan nomor kontak NISN');
  assert.strictEqual(kontakIhsan.nomorKontak, '0098263610');

  const kontakEcha = kontakList.find(c => c.nomorKontak === '199209142022211007');
  assert.ok(kontakEcha, 'Pak Echa harus terdaftar sebagai kontak dengan NIP');

  // 2. Verifikasi 3 Kategori Grup
  const groups = global.getDaftarGrupResmi();
  assert.ok(groups['group_XII_RPL_2'], 'Grup Kelas XII RPL 2 (Siswa & Walas) harus ada');
  assert.ok(groups['group_walas_sumedang'], 'Grup Khusus Walas harus ada');
  assert.ok(groups['group_dewan_guru'], 'Grup Dewan Guru & Walas harus ada');

  // Verifikasi Guru sebagai Admin Grup
  const grupRpl2 = groups['group_XII_RPL_2'];
  assert.ok(grupRpl2.adminIds.includes('199209142022211007'), 'Pak Echa harus berstatus 👑 Admin Grup XII RPL 2');

  // 3. Verifikasi Pengiriman Pesan Teks & Mention (@)
  await global.kirimPesanWaHub('group_XII_RPL_2', 'Halo @M. IHSAN ATHALLAH selamat pagi', 'teks');
  const storedMsgs = JSON.parse(mockLocalStorage['wa_msgs_group_XII_RPL_2'] || '[]');
  assert.ok(storedMsgs.length > 0, 'Pesan teks harus tersimpan di grup');
  const lastMsg = storedMsgs[storedMsgs.length - 1];
  assert.ok(lastMsg.mentions.includes('M. IHSAN ATHALLAH'), 'Mention @M. IHSAN ATHALLAH harus terdeteksi');

  // 4. Verifikasi Pengiriman Pesan Suara / Voice Note (VN)
  const fakeAudioUrl = 'data:audio/webm;base64,GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRChYECGFOAZwE=';
  await global.kirimPesanWaHub('direct_0098263610_199209142022211007', 'Pesan Suara', 'audio', {
    audio_url: fakeAudioUrl,
    audio_durasi: 5
  });
  const directMsgs = JSON.parse(mockLocalStorage['wa_msgs_direct_0098263610_199209142022211007'] || '[]');
  const audioMsg = directMsgs.find(m => m.tipe === 'audio');
  assert.ok(audioMsg, 'Pesan audio Voice Note harus tersimpan');
  assert.strictEqual(audioMsg.audio_durasi, 5, 'Durasi rekaman suara harus 5 detik');

  console.log('  ✓ Kontak NISN/NIP, 3 Kategori Grup, Mention @, dan Voice Note (VN) berfungsi 100% sempurna.\n');
}

// -------------------------------------------------------------
// [TEST 3] Pengujian Isolasi Sesi Halaman (Siswa vs Guru)
// -------------------------------------------------------------
console.log('▶ [Test 3] Pengujian Isolasi Kredensial Halaman (Siswa vs Guru)...');

async function runTest3() {
  // Simulasi: localStorage memiliki guru_aktif (karena guru membuka tab guru di browser yang sama)
  mockLocalStorage['guru_aktif'] = JSON.stringify({
    nip: '199209142022211007',
    nama: 'Muhammad Echa Putra, S.Kom.Gr',
    role: 'walas',
    kelas: 'XII RPL 2'
  });
  mockLocalStorage['siswa_aktif'] = JSON.stringify({
    nisn: '0098263610',
    nama: 'M. IHSAN ATHALLAH',
    role: 'siswa',
    kelas: 'XII RPL 2'
  });

  // Halaman Siswa: window.location.pathname = '/dashboard.html'
  global.window.location = { pathname: '/dashboard.html', href: 'http://localhost/dashboard.html' };
  global.currentUser = null;
  global.guruAktif = null;

  const userOnSiswaPage = global.getActiveUserChat();
  assert.strictEqual(userOnSiswaPage.role, 'siswa', 'Di dashboard.html, user HARUS siswa');
  assert.strictEqual(userOnSiswaPage.nomorKontak, '0098263610', 'Di dashboard.html, NISN Ihsan harus terpilih');
  assert.notStrictEqual(userOnSiswaPage.nomorKontak, '199209142022211007', 'Di dashboard.html, TIDAK BOLEH tertimpa guru_aktif');

  // Halaman Guru: window.location.pathname = '/dashboard-guru.html'
  global.window.location = { pathname: '/dashboard-guru.html', href: 'http://localhost/dashboard-guru.html' };
  const userOnGuruPage = global.getActiveUserChat();
  assert.strictEqual(userOnGuruPage.isGuru, true, 'Di dashboard-guru.html, user HARUS guru/walas');
  assert.strictEqual(userOnGuruPage.nomorKontak, '199209142022211007', 'Di dashboard-guru.html, NIP Pak Echa harus terpilih');

  console.log('  ✓ Isolasi kredensial halaman sukses: Tab Siswa tidak pernah tertimpa guru_aktif dari tab Guru.\n');
}

// -------------------------------------------------------------
// [TEST 4] Pengujian Anti Double-Render Bubble Pesan
// -------------------------------------------------------------
console.log('▶ [Test 4] Pengujian Pencegahan Double-Render Bubble Pesan...');

async function runTest4() {
  const container = document.getElementById('waMessagesContainer');
  container.children = [];

  const testMsg = {
    id: 'MSG_TEST_DEDUPLICATE_001',
    pengirimId: '0098263610',
    nama: 'M. IHSAN ATHALLAH',
    role: 'siswa',
    pesan: 'Tes pesan satu kali',
    waktu: Date.now()
  };

  // Render pertama
  global.appendBubblePesan(testMsg);
  const countFirst = container.children.length;
  assert.strictEqual(countFirst, 1, 'Pesan pertama harus berhasil dimasukkan ke DOM');

  // Render kedua dengan ID pesan yang sama (simulasi event RTDB / BroadcastChannel simultan)
  global.appendBubblePesan(testMsg);
  const countSecond = container.children.length;
  assert.strictEqual(countSecond, 1, 'Pesan duplikat dengan ID sama HARUS diabaikan (tidak boleh double render)');

  console.log('  ✓ Guard anti double-render sukses: Pesan hanya ter-render 1 kali di DOM.\n');
}

// -------------------------------------------------------------
// [TEST 5] Pengujian Isolasi Grup Ketat (Siswa vs Walas vs Guru)
// -------------------------------------------------------------
console.log('▶ [Test 5] Pengujian Hak Akses Grup Ketat (Pemisahan Siswa, Walas, Guru)...');

async function runTest5() {
  const groups = global.getDaftarGrupResmi();
  const grupRpl2 = groups['group_XII_RPL_2'];
  const grupRpl1 = groups['group_XII_RPL_1'];
  const grupTkj1 = groups['group_XII_TKJ_1'];
  const grupWalas = groups['group_walas_sumedang'];
  const grupDewanGuru = groups['group_dewan_guru'];

  // A. Siswa XII RPL 2
  const siswaRpl2 = { id: '0098263610', role: 'siswa', kelas: 'XII RPL 2' };
  assert.strictEqual(global.cekAksesGrup(siswaRpl2, grupRpl2), true, 'Siswa XII RPL 2 boleh melihat grup kelasnya sendiri');
  assert.strictEqual(global.cekAksesGrup(siswaRpl2, grupRpl1), false, 'Siswa XII RPL 2 DILARANG melihat grup XII RPL 1');
  assert.strictEqual(global.cekAksesGrup(siswaRpl2, grupTkj1), false, 'Siswa XII RPL 2 DILARANG melihat grup XII TKJ 1');
  assert.strictEqual(global.cekAksesGrup(siswaRpl2, grupWalas), false, 'Siswa DILARANG melihat forum khusus walas');
  assert.strictEqual(global.cekAksesGrup(siswaRpl2, grupDewanGuru), false, 'Siswa DILARANG melihat forum dewan guru');

  // B. Wali Kelas XII RPL 2 (Pak Echa)
  const walasRpl2 = { id: '199209142022211007', role: 'walas', isWalas: true, walasKelasId: 'XII RPL 2', kelas: 'XII RPL 2' };
  assert.strictEqual(global.cekAksesGrup(walasRpl2, grupRpl2), true, 'Walas XII RPL 2 boleh melihat grup kelas binaannya');
  assert.strictEqual(global.cekAksesGrup(walasRpl2, grupRpl1), false, 'Walas XII RPL 2 DILARANG melihat grup kelas walas lain');
  assert.strictEqual(global.cekAksesGrup(walasRpl2, grupWalas), true, 'Walas boleh melihat forum koordinasi wali kelas');
  assert.strictEqual(global.cekAksesGrup(walasRpl2, grupDewanGuru), true, 'Walas boleh melihat forum dewan guru');

  // C. Guru Pengajar Non-Walas (Bu Hani)
  const guruPengajar = { id: '198109012009022003', role: 'guru', isWalas: false, isGuru: true };
  assert.strictEqual(global.cekAksesGrup(guruPengajar, grupDewanGuru), true, 'Guru pengajar boleh melihat dewan guru');
  assert.strictEqual(global.cekAksesGrup(guruPengajar, grupWalas), false, 'Guru non-walas DILARANG masuk forum walas');
  assert.strictEqual(global.cekAksesGrup(guruPengajar, grupRpl2), false, 'Guru non-walas tidak melihat kelas tanpa hak mengajar');

  console.log('  ✓ Hak akses grup terisolasi sempurna berdasarkan role & kelas sesuai data Firebase.\n');
}

// -------------------------------------------------------------
// [TEST 6] Pengujian Hubungan Kontak & Room ID Dua Arah
// -------------------------------------------------------------
console.log('▶ [Test 6] Pengujian Deterministik Room ID & Eksklusi Diri Sendiri di Kontak...');

async function runTest6() {
  const roomIdSiswaToGuru = global.getDirectRoomId('0098263610', '199209142022211007');
  const roomIdGuruToSiswa = global.getDirectRoomId('199209142022211007', '0098263610');

  assert.strictEqual(roomIdSiswaToGuru, roomIdGuruToSiswa, 'Room ID dari sisi siswa dan guru HARUS sama persis (deterministik)');
  assert.strictEqual(roomIdSiswaToGuru, 'direct_0098263610_199209142022211007', 'Format Room ID direct_0098263610_199209142022211007 valid');

  console.log('  ✓ Room ID direct terbukti 100% simetris & kedua belah pihak masuk ke ruangan obrolan yang sama persis.\n');
}

// -------------------------------------------------------------
// [TEST 7] Pengujian Display Name Thread Obrolan (Lawan Bicara, BUKAN Diri Sendiri)
// -------------------------------------------------------------
console.log('▶ [Test 7] Pengujian Display Name Thread Obrolan (Lawan Bicara vs Diri Sendiri)...');

async function runTest7() {
  // Simulasi Siswa Ihsan di dashboard.html
  global.window.location = { pathname: '/dashboard.html', href: 'http://localhost/dashboard.html' };
  global.currentUser = { uid: 'UID_0098263610', nisn: '0098263610', nama: 'M. IHSAN ATHALLAH', role: 'siswa', kelas: 'XII RPL 2' };

  const directRoomId = global.getDirectRoomId('0098263610', '199209142022211007');

  // Siswa mengirim pesan "halo pak echa"
  await global.kirimPesanWaHub(directRoomId, 'halo pak echa', 'teks');

  const threads = JSON.parse(mockLocalStorage['wa_threads'] || '{}');
  const threadPakEcha = threads[directRoomId];

  assert.ok(threadPakEcha, 'Thread chat dengan Pak Echa harus terdaftar di wa_threads');
  assert.strictEqual(threadPakEcha.contactName, 'Muhammad Echa Putra, S.Kom.Gr', 'Judul thread HARUS nama lawan bicara (Pak Echa), BUKAN nama siswa sendiri!');
  assert.notStrictEqual(threadPakEcha.contactName, 'M. IHSAN ATHALLAH', 'Judul thread DILARANG menampilkan nama diri sendiri');

  console.log('  ✓ Thread obrolan terbukti menampilkan nama lawan bicara (Pak Echa) dan bebas dari bug nama diri sendiri.\n');
}

(async () => {
  try {
    await runTest1();
    await runTest2();
    await runTest3();
    await runTest4();
    await runTest5();
    await runTest6();
    await runTest7();
    console.log('================================================================');
    console.log('🎉 SELURUH PENGUJIAN BATALKAN KIRIM & WHATSAPP CHAT LULUS 100%!');
    console.log('================================================================');
    process.exit(0);
  } catch (err) {
    console.error('❌ PENGUJIAN GAGAL:', err);
    process.exit(1);
  }
})();
