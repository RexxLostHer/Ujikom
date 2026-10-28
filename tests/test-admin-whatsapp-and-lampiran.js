/**
 * ===================================================================
 * TEST SUITE: PERBAIKAN P4 IS NOT DEFINED, LAMPIRAN BUKTI ADMIN,
 * DAN INTEGRASI WHATSAPP CHAT HUB ADMIN
 * Presensia IoT — SMK Negeri 1 Sumedang
 * ===================================================================
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('================================================================');
console.log('🧪 PENGUJIAN PERBAIKAN P4, LAMPIRAN BUKTI ADMIN, & WA CHAT HUB');
console.log('================================================================\n');

// Setup Mock DOM & Storage Environment
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
    tagName: tag.toUpperCase(),
    id: id,
    value: '',
    textContent: '',
    innerHTML: '',
    style: {},
    children: [],
    disabled: false,
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
    focus: () => {},
    addEventListener: () => {},
    removeEventListener: () => {}
  };
  if (id) domStore[id] = el;
  return el;
}

global.document = {
  getElementById: (id) => domStore[id] || (domStore[id] = createMockElement('div', id)),
  createElement: (tag) => createMockElement(tag),
  body: createMockElement('body', 'body'),
  addEventListener: () => {},
  removeEventListener: () => {},
  readyState: 'complete'
};

global.window = {
  localStorage: global.localStorage,
  sessionStorage: global.sessionStorage,
  location: { pathname: '/admin.html', href: 'http://localhost:3000/admin.html' },
  addEventListener: () => {},
  removeEventListener: () => {},
  matchMedia: () => ({ matches: false }),
  open: (url) => { window.lastOpenedUrl = url; }
};

global.navigator = {
  userAgent: 'Node.js Automated Test',
  mediaDevices: null
};

// Mock RTDB
const mockDbData = {};
global.db = {
  ref: (path) => ({
    set: async (val) => {
      mockDbData[path] = val;
      return true;
    },
    update: async (val) => {
      mockDbData[path] = Object.assign(mockDbData[path] || {}, val);
      return true;
    },
    once: async () => ({
      val: () => mockDbData[path] || null,
      forEach: (cb) => {
        const val = mockDbData[path] || {};
        Object.keys(val).forEach(k => cb({ key: k, val: () => val[k] }));
      }
    }),
    push: () => ({
      key: 'MOCK-KEY-' + Date.now(),
      set: async (val) => {
        mockDbData[path + '/MOCK-KEY'] = val;
        return true;
      }
    }),
    on: () => {},
    off: () => {}
  })
};

global.firebase = {
  database: () => global.db,
  auth: () => ({
    onAuthStateChanged: () => {},
    currentUser: { uid: 'admin-01', email: 'admin@smkn1sumedang.sch.id' }
  })
};
global.firebase.database.ServerValue = { TIMESTAMP: Date.now() };

// Pre-create modal and badge DOM elements
createMockElement('div', 'modalBuktiIzin');
createMockElement('h3', 'modalBuktiTitle');
createMockElement('img', 'modalBuktiImg');
createMockElement('div', 'modalBuktiText');
createMockElement('button', 'btnBukaDiTabBaru');
createMockElement('span', 'waBadgeCounter');
createMockElement('span', 'waAppbarBadge');
createMockElement('span', 'badgeWaHubSidebar');
createMockElement('span', 'adminNamaBadge');
createMockElement('div', 'daftarKendalaGuru');

// ===================================================================
// PENGUJIAN 1: VERIFIKASI PERBAIKAN "p4 is not defined"
// ===================================================================
console.log('▶ [Test 1] Pengujian Bebas Error "p4 is not defined" pada submitKendalaGuru...');

const dashboardGuru = require('../assets/dashboard-guru.js');
assert(typeof dashboardGuru.submitKendalaGuru === 'function', 'submitKendalaGuru harus berupa fungsi');

(async () => {
  // Setup input form mock
  const kKelas = createMockElement('select', 'kendalaKelas');
  kKelas.value = 'XII RPL 2';
  const kMapel = createMockElement('input', 'kendalaMapel');
  kMapel.value = 'Pemodelan Perangkat Lunak';
  const kTanggal = createMockElement('input', 'kendalaTanggal');
  kTanggal.value = '2026-10-27';
  const kJenis = createMockElement('select', 'kendalaJenis');
  kJenis.value = 'Izin Dinas';
  const kAlasan = createMockElement('textarea', 'kendalaAlasan');
  kAlasan.value = 'Menghadiri Rapat Koordinasi Kurikulum SMK di Dinas Pendidikan.';
  const kMsg = createMockElement('div', 'msgKendalaGuru');
  const kBtn = createMockElement('button', 'btnSubmitKendala');

  const testGuru = {
    nip: '198503152010011012',
    nama: 'Pak Guru Budi',
    role: 'guru',
    email: 'budi@smkn1sumedang.sch.id'
  };
  global.guruAktif = testGuru;
  global.window.guruAktif = testGuru;
  global.getSessionUser = () => testGuru;
  mockSessionStorage['guru_aktif'] = JSON.stringify(testGuru);

  let didThrow = false;
  let result = null;
  try {
    result = await dashboardGuru.submitKendalaGuru({ preventDefault: () => {} });
  } catch (err) {
    didThrow = true;
    console.error('Error saat submit kendala:', err);
  }

  assert.strictEqual(didThrow, false, 'submitKendalaGuru tidak boleh melempar ReferenceError (p4 is not defined)');
  assert.ok(result && result.success !== false, 'submitKendalaGuru harus berhasil');

  // Verifikasi tersimpan di localStorage local_kendala_guru
  const savedKendala = JSON.parse(mockLocalStorage['local_kendala_guru'] || '[]');
  assert.ok(savedKendala.length > 0, 'Data kendala harus tersimpan di local_kendala_guru');
  assert.strictEqual(savedKendala[0].mapel, 'Pemodelan Perangkat Lunak');
  assert.strictEqual(savedKendala[0].guruNip, '198503152010011012');

  console.log('  ✓ submitKendalaGuru berhasil 100% tanpa error "p4 is not defined"');

  // ===================================================================
  // PENGUJIAN 2: VERIFIKASI INTEGRITAS LAMPIRAN & DATA PERIZINAN ADMIN
  // ===================================================================
  console.log('\n▶ [Test 2] Pengujian Penanganan Lampiran & Modal Bukti di Admin...');

  const perijinan = require('../assets/perijinan.js');
  const admin = require('../assets/admin.js');

  assert(typeof admin.bukaModalBuktiKendalaAdmin === 'function', 'bukaModalBuktiKendalaAdmin harus tersedia di admin.js');
  assert(typeof perijinan.bukaModalBuktiIzinAdmin === 'function', 'bukaModalBuktiIzinAdmin harus tersedia di perijinan.js');
  assert(typeof perijinan.bukaModalBukti === 'function', 'bukaModalBukti harus tersedia di perijinan.js');

  // Simpan kendala dengan lampiran data URL dan bare filename
  const testId1 = 'KENDALA-TEST-001';
  const testDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  mockLocalStorage['local_kendala_guru'] = JSON.stringify([{
    id: testId1,
    nama: 'Pak Guru Budi',
    guruNama: 'Pak Guru Budi',
    mapel: 'Matematika',
    alasan: 'Sakit flu',
    lampiran: 'Screenshot 2026-10-27 083832.png',
    buktiKendala: testDataUrl
  }]);
  mockLocalStorage['lampiran_kendala_' + testId1] = testDataUrl;

  createMockElement('div', 'daftarKendalaAdmin');
  createMockElement('span', 'badgeKendalaGuru');

  if (typeof admin.listenKendalaGuruAdmin === 'function') {
    admin.listenKendalaGuruAdmin();
  } else {
    admin.renderKendalaGuruAdmin('pending');
  }

  const containerKendala = domStore['daftarKendalaAdmin'];
  assert.ok(containerKendala.children.length > 0, 'Container kendala guru harus memuat kartu kendala');
  const renderedHtml = containerKendala.children[0].innerHTML;

  // Verifikasi tombol bukti kendala tidak memakai raw <a href="...png"> atau <a href="data:...">
  assert.ok(renderedHtml.includes('bukaModalBuktiKendalaAdmin'), 'Kartu kendala harus memanggil bukaModalBuktiKendalaAdmin');
  assert.ok(!renderedHtml.includes('<a href="Screenshot 2026-10-27 083832.png"'), 'Tidak boleh ada tag <a href> menuju bare filename');

  // Buka modal bukti via bukaModalBuktiKendalaAdmin
  admin.bukaModalBuktiKendalaAdmin(testId1);

  const modalImg = domStore['modalBuktiImg'];
  const modalTxt = domStore['modalBuktiText'];
  const modalTitle = domStore['modalBuktiTitle'];
  const modalBuktiIzin = domStore['modalBuktiIzin'];

  assert.strictEqual(modalBuktiIzin.style.display, 'flex', 'Modal bukti harus terbuka (display: flex)');
  assert.strictEqual(modalImg.src, testDataUrl, 'Gambar modal bukti harus memuat data URL lampiran');
  console.log('  ✓ Lampiran gambar data URL terbuka di modal preview admin tanpa error top-frame');

  // Test buka lampiran dengan bare filename lokal (tanpa URL)
  perijinan.bukaModalBukti('Screenshot 2026-10-27 083832.png', 'M. Ihsan Athallah', 'Screenshot 2026-10-27 083832.png');
  assert.strictEqual(modalImg.style.display, 'none', 'Gambar harus disembunyikan untuk bare filename lokal');
  assert.ok(modalTxt.innerHTML.includes('Screenshot 2026-10-27 083832.png'), 'Modal harus menampilkan nama file ramah pengguna');
  assert.ok(modalTxt.innerHTML.includes('tersimpan di penyimpanan lokal'), 'Modal harus menjelaskan lampiran ada di lokal');
  console.log('  ✓ Bare filename ditangani secara aman di modal tanpa navigasi domain 404');

  // ===================================================================
  // PENGUJIAN 3: VERIFIKASI WHATSAPP CHAT HUB UNTUK ADMINISTRATOR
  // ===================================================================
  console.log('\n▶ [Test 3] Pengujian Fitur WhatsApp Chat Hub untuk Administrator...');

  // Set sesi admin aktif
  mockSessionStorage['user_aktif'] = JSON.stringify({
    role: 'admin',
    nama: 'Administrator',
    email: 'admin@smkn1sumedang.sch.id',
    id: 'ADMIN-01'
  });

  const chatHub = require('../assets/chat-hub.js');
  const user = chatHub.getActiveUserChat();

  assert.strictEqual(user.role, 'admin', 'User aktif chat-hub harus ber-role admin');
  assert.strictEqual(user.isAdmin, true, 'Flag isAdmin pada user aktif harus bernilai true');
  console.log('  ✓ Deteksi Admin di chat-hub.js berhasil (role: admin, isAdmin: true)');

  // Verifikasi Hak Akses Grup: Admin memiliki otoritas ke Dewan Guru, Walas, dan Kelas Binaan
  const daftarGrup = chatHub.getDaftarGrupResmi();
  assert.ok(daftarGrup['group_walas_sumedang'], 'Grup Wali Kelas harus terdaftar');
  assert.ok(daftarGrup['group_dewan_guru'], 'Grup Dewan Guru harus terdaftar');

  const aksesWalas = chatHub.cekAksesGrup(user, daftarGrup['group_walas_sumedang']);
  const aksesGuru = chatHub.cekAksesGrup(user, daftarGrup['group_dewan_guru']);
  const grupKelas = daftarGrup['group_XII_RPL_2'] || Object.values(daftarGrup).find(g => g.kategori === 'kelas');
  const aksesKelas = chatHub.cekAksesGrup(user, grupKelas);

  assert.strictEqual(aksesWalas, true, 'Administrator harus memiliki akses penuh ke Grup Wali Kelas');
  assert.strictEqual(aksesGuru, true, 'Administrator harus memiliki akses penuh ke Grup Dewan Guru');
  assert.strictEqual(aksesKelas, true, 'Administrator harus memiliki akses ke grup kelas siswa');
  console.log('  ✓ Hak akses Administrator ke seluruh grup resmi sekolah terverifikasi 100%');

  // Verifikasi Kontak Resmi memuat Administrator
  const kontakList = chatHub.getSemuaKontak();
  const adminKontak = kontakList.find(k => k.nomorKontak === 'ADMIN' || k.id === 'admin' || k.role === 'admin');
  assert.ok(adminKontak, 'Daftar kontak chat harus memuat kontak Administrator');
  console.log('  ✓ Kontak Administrator terdaftar resmi di menu Kontak');

  // Verifikasi Unread Badge Counter tersinkronisasi ke badge appbar dan sidebar
  mockLocalStorage['wa_threads'] = JSON.stringify({
    'group_walas_sumedang': { lastMsg: 'Rapat koordinasi jam 10' }
  });
  mockLocalStorage['wa_msgs_group_walas_sumedang'] = JSON.stringify([
    { id: 'm1', pengirimId: 'WALAS-01', pengirimNama: 'Pak Echa', teks: 'Selamat pagi admin', waktu: Date.now() + 1000 }
  ]);
  mockLocalStorage['wa_last_read_group_walas_sumedang'] = '0';

  chatHub.perbaruiBadgeCounter();

  const badgeHub = domStore['waBadgeCounter'];
  const badgeAppbar = domStore['waAppbarBadge'];
  const badgeSidebar = domStore['badgeWaHubSidebar'];

  assert.strictEqual(badgeHub.textContent, '1', 'Floating badge WA harus menampilkan 1 unread');
  assert.strictEqual(badgeAppbar.textContent, '1', 'Appbar badge WA harus menampilkan 1 unread');
  assert.strictEqual(badgeSidebar.textContent, '1', 'Sidebar badge WA harus menampilkan 1 unread');
  console.log('  ✓ Unread badge counter tersinkronisasi presisi di floating button, appbar, dan sidebar');

  // ===================================================================
  // PENGUJIAN 4: VERIFIKASI STRUKTUR HTML & ASSET ADMIN.HTML
  // ===================================================================
  console.log('\n▶ [Test 4] Pengujian Validasi Markup admin.html...');

  const adminHtmlPath = path.join(__dirname, '..', 'admin.html');
  const adminHtml = fs.readFileSync(adminHtmlPath, 'utf8');

  assert.ok(adminHtml.includes('assets/chat-hub.css'), 'admin.html harus menyertakan assets/chat-hub.css');
  assert.ok(adminHtml.includes('assets/chat-hub.js'), 'admin.html harus menyertakan assets/chat-hub.js');
  assert.ok(adminHtml.includes('id="btnWaHubAdmin"'), 'admin.html harus memiliki tombol #btnWaHubAdmin di appbar');
  assert.ok(adminHtml.includes('id="sidebarBtnWaHub"'), 'admin.html harus memiliki tombol #sidebarBtnWaHub di sidebar');
  assert.ok(adminHtml.includes('id="modalBuktiIzin"'), 'admin.html harus memiliki modal pratinjau #modalBuktiIzin');
  assert.ok(adminHtml.includes('id="modalBuktiImg"'), 'admin.html harus memiliki elemen #modalBuktiImg');
  assert.ok(adminHtml.includes('id="modalBuktiText"'), 'admin.html harus memiliki elemen #modalBuktiText');
  assert.ok(adminHtml.includes('id="btnBukaDiTabBaru"'), 'admin.html harus memiliki tombol #btnBukaDiTabBaru');

  console.log('  ✓ Semua elemen DOM WhatsApp Hub & Modal Bukti terintegrasi sempurna di admin.html');

  // ===================================================================
  // PENGUJIAN 5: VERIFIKASI WA HUB TANPA ARGUMEN, INFO GRUP & RESOLUSI BARE FILENAME
  // ===================================================================
  console.log('\n▶ [Test 5] Pengujian WA Hub Default View, Group Info Member Mapping & Bare File Resolution...');

  createMockElement('div', 'waHubWindow');
  createMockElement('div', 'waGroupInfoModal');
  createMockElement('div', 'waGroupInfoTitle');
  createMockElement('div', 'waGroupInfoDesc');
  createMockElement('div', 'waGroupInfoCount');
  createMockElement('div', 'waGroupMemberList');
  createMockElement('div', 'waGroupAddMemberWrap');

  // 1. bukaChatWhatsApp() tanpa parameter harus membuka window WA Hub dan tidak error
  window.lastOpenedUrl = null;
  chatHub.bukaChatWhatsApp();
  assert.strictEqual(domStore['waHubWindow'].style.display, 'flex', 'WA Hub Window harus ditampilkan saat bukaChatWhatsApp() dipanggil');
  assert.strictEqual(window.lastOpenedUrl, null, 'Tidak boleh membuka room undefined saat targetId kosong');
  console.log('  ✓ bukaChatWhatsApp() tanpa parameter membuka tampilan Hub utama secara aman');

  // 2. Info Grup Dewan Guru harus memetakan Administrator tanpa duplikasi atau fallback "Pengguna ID"
  chatHub.bukaChatWhatsApp('group_dewan_guru', 'group');
  if (typeof chatHub.bukaInfoGrupWa === 'function') {
    chatHub.bukaInfoGrupWa();
    const memberListEl = domStore['waGroupMemberList'];
    const memberText = memberListEl.children.map(c => c.innerHTML).join(' ');
    assert.ok(memberText.includes('Administrator'), 'Daftar anggota grup dewan guru harus memuat Administrator');
    assert.ok(memberText.includes('👑 Admin Grup'), 'Administrator harus ditandai sebagai 👑 Admin Grup');
    assert.ok(!memberText.includes('Pengguna ID ADMIN-01'), 'Tidak boleh ada anggota redundan Pengguna ID ADMIN-01');
    console.log('  ✓ Modal info grup memetakan kontak Administrator secara valid tanpa duplikasi ID');
  }

  // 3. Resolusi Bare Filename di bukaModalBuktiIzinAdmin dari LocalStorage
  const bareTestId = 'KENDALA-TEST-BARE-99';
  const bareDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  mockLocalStorage['local_kendala_guru'] = JSON.stringify([{
    id: bareTestId,
    guruNama: 'Pak Echa Guru',
    mapel: 'Basis Data',
    alasan: 'Sakit gigi',
    lampiran: 'Surat_Izin_Dokter.png',
    dokumen_url: 'Surat_Izin_Dokter.png'
  }]);
  mockLocalStorage['lampiran_kendala_' + bareTestId] = bareDataUrl;

  perijinan.bukaModalBuktiIzinAdmin(bareTestId);
  assert.strictEqual(modalImg.src, bareDataUrl, 'bukaModalBuktiIzinAdmin harus mengambil base64 dari localStorage saat dokumen_url berupa bare filename');
  console.log('  ✓ bukaModalBuktiIzinAdmin sukses menyelesaikan data URL asli dari localStorage untuk bare filename');

  // ===================================================================
  // PENGUJIAN 6: VERIFIKASI RIWAYAT KENDALA GURU & PROTEKSI TAB BARU
  // ===================================================================
  console.log('\n▶ [Test 6] Pengujian Tombol Lampiran Riwayat Kendala Guru & Proteksi Tab Baru...');

  // 1. Proteksi bukaLampiranAktifDiTabBaru terhadap bare filename
  window.lastOpenedUrl = null;
  perijinan.bukaModalBukti('Surat_Izin_Dokter.png', 'Pak Echa', 'Surat_Izin_Dokter.png');
  perijinan.bukaLampiranAktifDiTabBaru();
  assert.strictEqual(window.lastOpenedUrl, null, 'bukaLampiranAktifDiTabBaru tidak boleh melakukan window.open terhadap bare filename');
  console.log('  ✓ bukaLampiranAktifDiTabBaru terlindungi dari navigasi domain 404 pada bare filename');

  // 2. Tombol Lihat Lampiran di riwayat kendala guru
  createMockElement('div', 'listRiwayatKendalaGuru');
  dashboardGuru.muatRiwayatKendalaGuru(false);
  const riwayatContainer = domStore['listRiwayatKendalaGuru'];
  assert.ok(riwayatContainer.children.length > 0, 'Riwayat kendala guru harus memuat item');
  const riwayatCardHtml = riwayatContainer.children[0].innerHTML;
  assert.ok(riwayatCardHtml.includes('Lihat Lampiran'), 'Riwayat kendala guru harus memiliki tombol Lihat Lampiran');
  assert.ok(riwayatCardHtml.includes('bukaModalBuktiIzin'), 'Tombol harus memanggil bukaModalBuktiIzin');
  console.log('  ✓ Riwayat kendala guru di dashboard-guru menampilkan tombol Lihat Lampiran yang interaktif');

  console.log('\n================================================================');
  console.log('🎉 SEMUA PENGUJIAN SELESAI DENGAN STATUS 100% SUKSES!');
  console.log('================================================================\n');
  process.exit(0);
})();

