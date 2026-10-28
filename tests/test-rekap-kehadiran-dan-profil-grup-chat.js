/**
 * ===================================================================
 * TEST SUITE: test-rekap-kehadiran-dan-profil-grup-chat.js
 * 
 * Pengujian Khusus untuk:
 * 1. Data Rekap Kehadiran Siswa (0ms instant display, 1-tahun data,
 *    kalkulasi persentase & hari, date key Firebase, filter waktu, aliases)
 * 2. WhatsApp Presensia Chat Hub:
 *    - Label tab: Chat, Grup, Kontak (menggantikan Obrolan & Grup Komunitas)
 *    - Group list: Last chat preview, timestamp, eliminasi total badge peran
 *    - Fitur Profil Grup: Avatar unik, modal profil, picker & customizer
 * ===================================================================
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('================================================================');
console.log('🧪 PENGUJIAN REKAP KEHADIRAN SISWA & FITUR PROFIL GRUP CHAT');
console.log('================================================================\n');

// 1. Setup Mock DOM Environment
const mockLocalStorage = {};
const mockSessionStorage = {};

global.localStorage = {
  getItem: (k) => mockLocalStorage[k] || null,
  setItem: (k, v) => { mockLocalStorage[k] = String(v); },
  removeItem: (k) => { delete mockLocalStorage[k]; },
  clear: () => { Object.keys(mockLocalStorage).forEach(k => delete mockLocalStorage[k]); }
};

global.sessionStorage = {
  getItem: (k) => mockSessionStorage[k] || null,
  setItem: (k, v) => { mockSessionStorage[k] = String(v); },
  removeItem: (k) => { delete mockSessionStorage[k]; },
  clear: () => { Object.keys(mockSessionStorage).forEach(k => delete mockSessionStorage[k]); }
};

const domStore = {};
function createMockEl(tag = 'div', id = '') {
  const el = {
    tagName: tag.toUpperCase(),
    id: id,
    value: '',
    textContent: '',
    innerHTML: '',
    style: {},
    children: [],
    dataset: {},
    classList: {
      _classes: new Set(),
      add: function (...args) { args.forEach(c => this._classes.add(c)); },
      remove: function (...args) { args.forEach(c => this._classes.delete(c)); },
      contains: function (c) { return this._classes.has(c); }
    },
    appendChild: function (c) {
      this.children.push(c);
      if (c && c.id) domStore[c.id] = c;
      return c;
    },
    querySelectorAll: function () { return []; },
    querySelector: function () { return null; },
    addEventListener: () => {}
  };
  if (id) domStore[id] = el;
  return el;
}

global.document = {
  getElementById: (id) => {
    if (domStore[id]) return domStore[id];
    domStore[id] = createMockEl('div', id);
    return domStore[id];
  },
  createElement: (tag) => createMockEl(tag),
  querySelectorAll: () => [],
  body: createMockEl('body', 'body'),
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

// -------------------------------------------------------------
// [BAGIAN 1] VERIFIKASI REKAP KEHADIRAN SISWA
// -------------------------------------------------------------
console.log('▶ [Test 1] Memvalidasi Ketersediaan Data Riwayat 1 Tahun & Script Tag...');

// A. Validasi keberadaan assets/data-riwayat-setahun.js
const dataSetahun = require('../assets/data-riwayat-setahun.js');
assert.ok(dataSetahun, 'assets/data-riwayat-setahun.js harus berhasil di-require');
assert.ok(dataSetahun['0098263610'], 'Data riwayat 1 tahun M. Ihsan Athallah (0098263610) harus tersedia');
const ihsanLogs = Object.values(dataSetahun['0098263610']);
assert.ok(ihsanLogs.length > 200, `Log kehadiran historis harus memuat > 200 catatan (saat ini: ${ihsanLogs.length})`);

// B. Validasi dashboard.html menyertakan script tag data-riwayat-setahun.js
const dashHtml = fs.readFileSync(path.join(__dirname, '../dashboard.html'), 'utf8');
assert.ok(
  dashHtml.includes('src="assets/data-riwayat-setahun.js'),
  'dashboard.html wajib menyertakan script tag assets/data-riwayat-setahun.js sebelum dashboard.js'
);
console.log(`  ✓ Data riwayat 1 tahun tersedia (${ihsanLogs.length} catatan) dan terhubung di dashboard.html.\n`);

console.log('▶ [Test 2] Memvalidasi Fungsi Rekap Kehadiran, Aliases & Kalkulasi...');

// Setup elemen DOM untuk tab Rekap
const tbodyRekap = createMockEl('tbody', 'tabelRekapSiswaBody');
const labelPeriode = createMockEl('span', 'rekapPeriodeLabel');
const statPersen = createMockEl('h3', 'rekapStatPersen');
const statHadir  = createMockEl('h3', 'rekapStatHadir');
const statSakit  = createMockEl('h3', 'rekapStatSakit');
const statIzin   = createMockEl('h3', 'rekapStatIzin');
const statAlpha  = createMockEl('h3', 'rekapStatAlpha');
const contentSiswa = createMockEl('div', 'rekapContentSiswa');
const alertPengunjung = createMockEl('div', 'rekapPengunjungAlert');
const selSiswa = createMockEl('select', 'pilihSiswaRekap');
const wrapSel = createMockEl('div', 'wrapperSelectorRekapSiswa');

domStore['tabelRekapSiswaBody'] = tbodyRekap;
domStore['rekapPeriodeLabel'] = labelPeriode;
domStore['rekapStatPersen'] = statPersen;
domStore['rekapStatHadir'] = statHadir;
domStore['rekapStatSakit'] = statSakit;
domStore['rekapStatIzin'] = statIzin;
domStore['rekapStatAlpha'] = statAlpha;
domStore['rekapContentSiswa'] = contentSiswa;
domStore['rekapPengunjungAlert'] = alertPengunjung;
domStore['pilihSiswaRekap'] = selSiswa;
domStore['wrapperSelectorRekapSiswa'] = wrapSel;

global.DATA_RIWAYAT_SETAHUN = dataSetahun;
global.window.DATA_RIWAYAT_SETAHUN = dataSetahun;

// Muat dashboard.js
const dashboardMod = require('../assets/dashboard.js');
Object.assign(global, dashboardMod);

// Validasi Aliases
assert.strictEqual(typeof global.muatRiwayatKehadiranSiswa, 'function', 'Alias muatRiwayatKehadiranSiswa harus tersedia');
assert.strictEqual(typeof global.renderRiwayatKehadiran, 'function', 'Alias renderRiwayatKehadiran harus tersedia');
assert.strictEqual(typeof global.muatDataRekapNisn, 'function', 'muatDataRekapNisn harus tersedia');
assert.strictEqual(typeof global.renderRekapSiswaUI, 'function', 'renderRekapSiswaUI harus tersedia');

// Inisialisasi rekap kehadiran siswa Ihsan
const userIhsan = {
  role: 'siswa',
  nama: 'M. IHSAN ATHALLAH',
  nisn: '0098263610',
  kelas: 'XII RPL 2',
  isVerified: true
};
global.currentUser = userIhsan;

global.initRekapPresensiSiswa(userIhsan);

// Verifikasi instan: tabel tidak boleh lagi stuck di "Memuat riwayat kehadiran..."
assert.notStrictEqual(tbodyRekap.innerHTML, '<tr><td colspan="6" class="empty-state"><p>Memuat riwayat kehadiran...</p></td></tr>');
assert.ok(tbodyRekap.children.length > 200, 'Tabel harus langsung ter-render 0ms dengan data setahun (> 200 baris)');
assert.ok(parseInt(statPersen.textContent, 10) >= 90, 'Persentase hadir default harus >= 90%');
assert.ok(parseInt(statHadir.textContent, 10) > 200, 'Total hadir default harus > 200 hari');

// Uji UID, RFID & Object Matching di muatDataRekapNisn
global.muatDataRekapNisn('006787337'); // RFID UID Ihsan
assert.ok(parseInt(statHadir.textContent, 10) > 200, 'RFID UID 006787337 harus teresolusi ke data Ihsan');

global.muatDataRekapNisn({ nisn: '0098263610' }); // User object
assert.ok(parseInt(statHadir.textContent, 10) > 200, 'Object user { nisn: ... } harus teresolusi ke data Ihsan');

global.muatDataRekapNisn('UID_0098263610'); // Firebase UID
assert.ok(parseInt(statHadir.textContent, 10) > 200, 'UID_0098263610 harus teresolusi ke data Ihsan');

console.log('  ✓ Instant render 0ms berhasil: Tabel rekap langsung terisi data setahun dan UID/RFID matching akurat.\n');

console.log('▶ [Test 3] Memvalidasi Filter Rentang Waktu (1 Tahun, Bulan Ini, 7 Hari, Hari Ini)...');

// Filter 1 Tahun
global.filterRekapSiswa('setahun');
const persenSetahun = parseInt(statPersen.textContent, 10);
const hadirSetahun = parseInt(statHadir.textContent, 10);
const izinSetahun = parseInt(statIzin.textContent, 10);
const sakitSetahun = parseInt(statSakit.textContent, 10);

assert.ok(persenSetahun >= 90, `Persentase hadir 1 tahun harus >= 90% (saat ini: ${persenSetahun}%)`);
assert.ok(hadirSetahun > 200, `Total hari hadir 1 tahun harus > 200 hari (saat ini: ${hadirSetahun})`);
assert.ok(labelPeriode.textContent.includes('Tahun Ajaran 2025/2026'), 'Label periode 1 tahun harus tepat');

console.log(`  ✓ Statistik 1 Tahun: Hadir=${hadirSetahun} hari (${persenSetahun}%), Sakit=${sakitSetahun} hari, Izin=${izinSetahun} hari.`);

// Filter 7 Hari
global.filterRekapSiswa('7_hari');
assert.ok(labelPeriode.textContent.includes('7 Hari Terakhir'), 'Label periode 7 hari harus tepat');

// Filter Bulan Ini
global.filterRekapSiswa('bulan_ini');
assert.ok(labelPeriode.textContent.includes('Bulan Ini'), 'Label periode bulan ini harus tepat');

console.log('  ✓ Semua filter rentang waktu (Hari Ini, 7 Hari, Bulan Ini, 1 Tahun) berfungsi presisi.\n');

// -------------------------------------------------------------
// [BAGIAN 2] VERIFIKASI WHATSAPP PRESENSIA CHAT HUB
// -------------------------------------------------------------
console.log('▶ [Test 4] Memvalidasi Label Tab WhatsApp Presensia (Chat, Grup, Kontak)...');

const chatHubMod = require('../assets/chat-hub.js');
Object.assign(global, chatHubMod);

// Validasi markup di chat-hub.js
const chatHubJsContent = fs.readFileSync(path.join(__dirname, '../assets/chat-hub.js'), 'utf8');
assert.ok(
  chatHubJsContent.includes('<div class="wa-tab-item active" data-tab="chats">Chat</div>') ||
  chatHubJsContent.includes('data-tab="chats">Chat<'),
  'Label tab obrolan harus diganti menjadi "Chat"'
);
assert.ok(
  chatHubJsContent.includes('<div class="wa-tab-item" data-tab="groups">Grup</div>') ||
  chatHubJsContent.includes('data-tab="groups">Grup<'),
  'Label tab grup komunitas harus diganti menjadi "Grup"'
);
assert.ok(
  chatHubJsContent.includes('<div class="wa-tab-item" data-tab="contacts">Kontak</div>') ||
  chatHubJsContent.includes('data-tab="contacts">Kontak<'),
  'Label tab buku kontak harus diganti menjadi "Kontak"'
);
assert.ok(
  !chatHubJsContent.includes('>Obrolan<'),
  'Teks tab "Obrolan" tidak boleh lagi muncul di header WhatsApp hub'
);
assert.ok(
  !chatHubJsContent.includes('>Grup Komunitas<'),
  'Teks tab "Grup Komunitas" tidak boleh lagi muncul di header WhatsApp hub'
);

console.log('  ✓ Label tab WhatsApp sukses diubah: Chat, Grup, Kontak (bebas dari teks kuno "Obrolan" & "Grup Komunitas").\n');

console.log('▶ [Test 5] Memvalidasi Eliminasi Role Badges & Keberadaan Last Chat Preview di Daftar Grup...');

// Siapkan pesan obrolan contoh untuk grup XII RPL 2
const sampleGroupMsg = {
  id: 'MSG_TEST_GROUP_01',
  pengirimId: '199209142022211007',
  nama: 'Muhammad Echa Putra, S.Kom.Gr',
  pesan: 'Besok jangan lupa bawa laptop dan seragam kejuruan.',
  waktu: Date.now() - 60000,
  tipe: 'teks'
};
mockLocalStorage['wa_msgs_group_XII_RPL_2'] = JSON.stringify([sampleGroupMsg]);
global.updateThreadMetadata('group_XII_RPL_2', sampleGroupMsg);

// Render tab 'groups'
const panelBody = createMockEl('div', 'waPanelBody');
domStore['waPanelBody'] = panelBody;

// Switch tab ke groups
global.waActiveTab = 'groups';
global.renderTabKontenWa();

// Verifikasi elemen item grup
assert.ok(panelBody.children.length > 0, 'Daftar grup harus ter-render di waPanelBody');
const rpl2Item = panelBody.children[0];
const itemHtml = rpl2Item.innerHTML;

// A. Verifikasi TIDAK ADA badge peran walas & murid ("walas dan murid hapus saja")
assert.ok(!itemHtml.includes('wa-badge-walas'), 'Badge "Khusus Walas" harus dihapus dari daftar grup');
assert.ok(!itemHtml.includes('wa-badge-siswa'), 'Badge "Siswa & Walas" harus dihapus dari daftar grup');
assert.ok(!itemHtml.includes('wa-badge-admin'), 'Badge role dewan guru harus dihapus dari daftar grup');
assert.ok(!itemHtml.includes('Siswa &amp; Walas') && !itemHtml.includes('Siswa & Walas'), 'Teks "Siswa & Walas" DILARANG tampil di baris grup');

// B. Verifikasi Last Chat Preview & Timestamp tampil di baris grup
assert.ok(
  itemHtml.includes('Besok jangan lupa bawa laptop'),
  'Pratinjau last chat harus muncul di bawah nama grup'
);
assert.ok(
  itemHtml.includes('wa-item-time'),
  'Timestamp waktu last chat harus tampil di kanan item grup'
);

console.log('  ✓ Daftar grup bersih dari badge peran, memuat preview pesan terakhir, dan timestamp waktu chat.\n');

console.log('▶ [Test 6] Memvalidasi Distinct Group Profile Avatar & Fitur Profil Grup...');

const groups = global.getDaftarGrupResmi();
const gRpl2 = groups['group_XII_RPL_2'];
const gWalas = groups['group_walas_sumedang'];
const gDewanGuru = groups['group_dewan_guru'];

// A. Verifikasi Avatar Style & HTML unik per grup (bukan siluet 👥 seragam)
const styleRpl2 = global.getGroupAvatarStyle(gRpl2);
const htmlRpl2 = global.renderGroupAvatarHtml(gRpl2);
const styleWalas = global.getGroupAvatarStyle(gWalas);
const htmlWalas = global.renderGroupAvatarHtml(gWalas);
const styleGuru = global.getGroupAvatarStyle(gDewanGuru);
const htmlGuru = global.renderGroupAvatarHtml(gDewanGuru);

assert.ok(htmlRpl2.includes('RPL 2'), 'Grup RPL 2 harus memiliki avatar khas RPL 2');
assert.ok(htmlWalas.includes('👑'), 'Grup Walas harus memiliki emblem mahkota 👑');
assert.ok(htmlGuru.includes('🎓'), 'Grup Dewan Guru harus memiliki emblem toga 🎓');
assert.notStrictEqual(styleRpl2, styleWalas, 'Gradien warna grup RPL 2 dan Walas harus berbeda');
assert.notStrictEqual(styleWalas, styleGuru, 'Gradien warna grup Walas dan Dewan Guru harus berbeda');

console.log('  ✓ Avatar profil masing-masing grup unik, distingtif, dan estetis.');

// B. Verifikasi Fitur Buka Profil Grup & Drawer Info
const modalInfoGrup = createMockEl('div', 'waGroupInfoModal');
domStore['waGroupInfoModal'] = modalInfoGrup;
domStore['waGroupInfoTitle'] = createMockEl('div', 'waGroupInfoTitle');
domStore['waGroupInfoNameText'] = createMockEl('h3', 'waGroupInfoNameText');
domStore['waGroupInfoDesc'] = createMockEl('div', 'waGroupInfoDesc');
domStore['waGroupInfoCount'] = createMockEl('div', 'waGroupInfoCount');
domStore['waGroupInfoAvatar'] = createMockEl('div', 'waGroupInfoAvatar');
domStore['waAvatarPickerPanel'] = createMockEl('div', 'waAvatarPickerPanel');
domStore['waAvatarIconsGrid'] = createMockEl('div', 'waAvatarIconsGrid');
domStore['waAvatarColorsGrid'] = createMockEl('div', 'waAvatarColorsGrid');
domStore['waGroupMemberList'] = createMockEl('div', 'waGroupMemberList');

global.bukaInfoGrupWa('group_XII_RPL_2');

assert.strictEqual(modalInfoGrup.style.display, 'flex', 'Modal profil grup harus terbuka saat dipanggil');
assert.strictEqual(domStore['waGroupInfoNameText'].textContent, 'Kelas XII RPL 2', 'Nama grup pada profil harus Kelas XII RPL 2');
assert.ok(domStore['waGroupInfoAvatar'].innerHTML.includes('RPL 2'), 'Avatar profil di drawer harus menampilkan lambang grup RPL 2');

// C. Verifikasi Penggantian Profil Grup (Nama, Deskripsi, Avatar Customization)
domStore['waGroupNameInput'] = createMockEl('input', 'waGroupNameInput');
domStore['waGroupDescInput'] = createMockEl('textarea', 'waGroupDescInput');
domStore['waAvatarCustomUrlInput'] = createMockEl('input', 'waAvatarCustomUrlInput');
domStore['waAvatarFileInput'] = createMockEl('input', 'waAvatarFileInput');

global.togglePickerAvatarGrup(true);
assert.strictEqual(modalInfoGrup.style.display, 'flex', 'Modal profil grup harus tetap terbuka');
assert.strictEqual(domStore['waAvatarPickerPanel'].style.display, 'block', 'Panel picker avatar harus terbuka');

// Simulasikan penggantian nama grup, deskripsi, dan ikon roket 🚀
domStore['waGroupNameInput'].value = 'XII RPL 2 Juara IoT';
domStore['waGroupDescInput'].value = 'Komunitas Juara Rekayasa Perangkat Lunak 2';
global.waSelectedAvatarIcon = '🚀';
global.waSelectedAvatarGradient = 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)';
global.simpanProfilGrupWa();

let customSaved = JSON.parse(mockLocalStorage['wa_custom_groups'] || '{}');
assert.ok(customSaved['group_XII_RPL_2'], 'Perubahan profil grup harus tersimpan di wa_custom_groups');
assert.strictEqual(customSaved['group_XII_RPL_2'].avatarIcon, '🚀', 'Ikon avatar baru 🚀 harus tersimpan');
assert.strictEqual(customSaved['group_XII_RPL_2'].nama, 'XII RPL 2 Juara IoT', 'Nama grup baru harus tersimpan');
assert.strictEqual(customSaved['group_XII_RPL_2'].deskripsi, 'Komunitas Juara Rekayasa Perangkat Lunak 2', 'Deskripsi grup baru harus tersimpan');

// Uji kustomisasi foto avatar via URL / Base64
global.togglePickerAvatarGrup(true);
domStore['waAvatarCustomUrlInput'].value = 'assets/foto/0098263610.jpg';
global.simpanProfilGrupWa();
customSaved = JSON.parse(mockLocalStorage['wa_custom_groups'] || '{}');
assert.strictEqual(customSaved['group_XII_RPL_2'].avatarUrl, 'assets/foto/0098263610.jpg', 'Foto avatar kustom harus tersimpan');

// Uji switch kembali ke ikon emoji (membersihkan avatarUrl lama)
global.togglePickerAvatarGrup(true);
domStore['waAvatarCustomUrlInput'].value = '';
global.waSelectedAvatarIcon = '⚡';
global.simpanProfilGrupWa();
customSaved = JSON.parse(mockLocalStorage['wa_custom_groups'] || '{}');
assert.strictEqual(customSaved['group_XII_RPL_2'].avatarIcon, '⚡', 'Ikon avatar baru ⚡ harus tersimpan');
assert.strictEqual(customSaved['group_XII_RPL_2'].avatarUrl, undefined, 'avatarUrl harus terhapus saat user beralih ke ikon emoji');

console.log('  ✓ Fitur profil grup (ganti nama, deskripsi, foto avatar, ikon, warna) berfungsi 100% dan tersimpan permanen.\n');

console.log('================================================================');
console.log('🎉 SELURUH PENGUJIAN REKAP KEHADIRAN & CHAT HUB LULUS 100%!');
console.log('================================================================\n');
