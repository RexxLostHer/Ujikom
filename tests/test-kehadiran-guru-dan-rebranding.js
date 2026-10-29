/**
 * test-kehadiran-guru-dan-rebranding.js
 * Test Suite untuk:
 * 1. Rebranding navbar "Pantau Kelas" -> "Kehadiran" di dashboard.html & admin.html.
 * 2. Sub-tab switcher modern "Kehadiran Siswa" & "Kehadiran Guru" di dalam #tabKelas.
 * 3. Tampilan presensi guru terbuka (open access publik) realtime berbasis scan NFC (5 MASTER_GURU_RESMI).
 * 4. Filter pencarian dewan guru berdasarkan nama & mata pelajaran.
 * 5. Pengetatan Anti-Double Send Siswa: 1 siswa hanya bisa mengajukan 1 kali izin selama pending,
 *    rapid click debounce, guard validasi submitPerijinan, dan auto-lock tombol & pending alert.
 * 6. Class roster invariant: strictly 3 kelas resmi (XII RPL 1, XII RPL 2, XII TKJ 1).
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

// 1. Mock LocalStorage
class MockLocalStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] || null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

// 2. Mock DOM Element
class MockElement {
  constructor(id = '', tagName = 'div') {
    this.id = id;
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this._innerHTML = '';
    this._textContent = '';
    this.value = '';
    this.disabled = false;
    this.style = {};
    this.attributes = {};
    this.classList = {
      _classes: new Set(),
      add: (c) => this.classList._classes.add(c),
      remove: (c) => this.classList._classes.delete(c),
      contains: (c) => this.classList._classes.has(c)
    };
    this.options = [];
  }
  get textContent() {
    return this._textContent;
  }
  set textContent(val) {
    this._textContent = String(val);
    this._innerHTML = String(val);
  }
  get innerHTML() {
    return this._innerHTML;
  }
  set innerHTML(val) {
    this._innerHTML = String(val);
    this._textContent = String(val).replace(/<[^>]*>/g, '');
    if (!val) {
      this.children = [];
    }
  }
  appendChild(child) {
    this.children.push(child);
    return child;
  }
  setAttribute(attr, val) {
    this.attributes[attr] = String(val);
  }
  getAttribute(attr) {
    return this.attributes[attr] || null;
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('🧪 TEST SUITE: KEHADIRAN DEWAN GURU, REBRANDING & ANTI-DOUBLE SEND');
  console.log('================================================================\n');

  const dashHtml = fs.readFileSync(path.join(ROOT_DIR, 'dashboard.html'), 'utf8');
  const adminHtml = fs.readFileSync(path.join(ROOT_DIR, 'admin.html'), 'utf8');
  const styleCss = fs.readFileSync(path.join(ROOT_DIR, 'assets/style.css'), 'utf8');

  // ---------------------------------------------------------------------------
  // [TEST 1] Rebranding Label Tab "Pantau Kelas" -> "Kehadiran"
  // ---------------------------------------------------------------------------
  console.log('▶ [Test 1] Verifikasi Rebranding Label Tab "Kehadiran"...');
  
  // 1.1 Navbar dashboard.html
  assert.ok(dashHtml.includes('id="btnTabKelas"'), 'dashboard.html harus memiliki button #btnTabKelas');
  const btnKelasRegex = /<button[^>]*id="btnTabKelas"[^>]*>([\s\S]*?)<\/button>/;
  const matchBtnKelas = dashHtml.match(btnKelasRegex);
  assert.ok(matchBtnKelas, 'Button #btnTabKelas harus ditemukan di dashboard.html');
  assert.ok(matchBtnKelas[1].includes('Kehadiran'), 'Navbar siswa #btnTabKelas harus berlabel "Kehadiran"');
  assert.ok(!matchBtnKelas[1].includes('Pantau Kelas'), 'Navbar siswa #btnTabKelas TIDAK boleh lagi berlabel "Pantau Kelas"');

  // 1.2 Sidebar admin.html
  assert.ok(adminHtml.includes('data-tab="monitoring3kelas"'), 'admin.html harus memiliki button monitoring3kelas');
  const adminBtnRegex = /<button[^>]*data-tab="monitoring3kelas"[^>]*>([\s\S]*?)<\/button>/;
  const matchAdminBtn = adminHtml.match(adminBtnRegex);
  assert.ok(matchAdminBtn, 'Button sidebar monitoring3kelas harus ditemukan di admin.html');
  assert.ok(matchAdminBtn[1].includes('Kehadiran'), 'Sidebar admin harus menampilkan label "Kehadiran"');
  assert.ok(!matchAdminBtn[1].includes('Pantau Kelas'), 'Sidebar admin TIDAK boleh lagi memuat teks "Pantau Kelas"');

  // 1.3 Heading admin.html
  assert.ok(adminHtml.includes('Kehadiran Siswa & Guru'), 'Header admin harus memuat "Kehadiran Siswa & Guru"');

  console.log('  ✓ Label navbar dashboard.html dan sidebar admin.html berhasil direbrand menjadi "Kehadiran".\n');

  // ---------------------------------------------------------------------------
  // [TEST 2] Sub-Tab Switcher Modern (Kehadiran Siswa vs Kehadiran Guru)
  // ---------------------------------------------------------------------------
  console.log('▶ [Test 2] Verifikasi Sub-Tab Switcher di Tab Kehadiran...');

  assert.ok(dashHtml.includes('class="subtab-kehadiran-wrap"'), 'dashboard.html harus memuat container .subtab-kehadiran-wrap');
  assert.ok(dashHtml.includes('id="btnSubtabSiswa"'), 'dashboard.html harus memuat button #btnSubtabSiswa');
  assert.ok(dashHtml.includes('id="btnSubtabGuru"'), 'dashboard.html harus memuat button #btnSubtabGuru');
  assert.ok(dashHtml.includes('id="kontenKehadiranSiswa"'), 'dashboard.html harus memuat kontainer #kontenKehadiranSiswa');
  assert.ok(dashHtml.includes('id="kontenKehadiranGuru"'), 'dashboard.html harus memuat kontainer #kontenKehadiranGuru');

  assert.ok(styleCss.includes('.subtab-kehadiran-wrap'), 'style.css harus mendefinisikan .subtab-kehadiran-wrap');
  assert.ok(styleCss.includes('.subtab-kehadiran-btn'), 'style.css harus mendefinisikan .subtab-kehadiran-btn');

  // Invariant 3 kelas resmi di dropdown siswa
  const matchRombel = dashHtml.match(/<select[^>]*id="pilihKelasPantau"[^>]*>([\s\S]*?)<\/select>/);
  assert.ok(matchRombel, 'Select #pilihKelasPantau harus ditemukan');
  assert.ok(matchRombel[1].includes('XII RPL 1'), 'Dropdown harus memuat XII RPL 1');
  assert.ok(matchRombel[1].includes('XII RPL 2'), 'Dropdown harus memuat XII RPL 2');
  assert.ok(matchRombel[1].includes('XII TKJ 1'), 'Dropdown harus memuat XII TKJ 1');
  assert.ok(!matchRombel[1].includes('PPLG'), 'Dropdown TIDAK boleh memuat kelas palsu PPLG');
  assert.ok(!matchRombel[1].includes('9A'), 'Dropdown TIDAK boleh memuat kelas 9A');

  console.log('  ✓ Struktur sub-tab switcher, styling CSS, dan invariant 3 kelas resmi terverifikasi presisi.\n');

  // ---------------------------------------------------------------------------
  // [TEST 3] Presensi Guru Terbuka (Public Realtime) & Pencarian Mapel
  // ---------------------------------------------------------------------------
  console.log('▶ [Test 3] Verifikasi Presensi Guru Terbuka (Public NFC Read-Only)...');

  const mockStorage = new MockLocalStorage();
  const domElements = {};

  function getOrCreateElem(id, tagName = 'div') {
    if (!domElements[id]) {
      domElements[id] = new MockElement(id, tagName);
    }
    return domElements[id];
  }

  // Siapkan DOM untuk Kehadiran Guru
  const btnSubtabSiswa = getOrCreateElem('btnSubtabSiswa', 'button');
  const btnSubtabGuru = getOrCreateElem('btnSubtabGuru', 'button');
  const kontenSiswa = getOrCreateElem('kontenKehadiranSiswa');
  const kontenGuru = getOrCreateElem('kontenKehadiranGuru');
  const gridGuruHadir = getOrCreateElem('gridGuruHadir');
  const gridGuruBelum = getOrCreateElem('gridGuruBelum');
  const countGuruHadir = getOrCreateElem('countGuruHadir');
  const countGuruBelum = getOrCreateElem('countGuruBelum');
  const titleCountGuruHadir = getOrCreateElem('titleCountGuruHadir');
  const titleCountGuruBelum = getOrCreateElem('titleCountGuruBelum');
  const cariNamaGuru = getOrCreateElem('cariNamaGuru', 'input');

  const mockDocument = {
    getElementById: (id) => getOrCreateElem(id),
    querySelectorAll: (sel) => [],
    createElement: (tag) => new MockElement('', tag),
    readyState: 'complete'
  };

  const fbConfig = require('../assets/firebase-config.js');
  const MASTER_GURU_RESMI = fbConfig.MASTER_GURU_RESMI;

  global.document = mockDocument;
  global.window = global;
  global.localStorage = mockStorage;
  global.MASTER_GURU_RESMI = MASTER_GURU_RESMI;
  global.tanggalHariIni = () => '2026-10-29';

  const dashboardMod = require('../assets/dashboard.js');
  Object.assign(global, dashboardMod);

  // 3.1 Uji switchSubtabKehadiran
  assert.strictEqual(typeof switchSubtabKehadiran, 'function', 'switchSubtabKehadiran harus diekspor');
  assert.strictEqual(typeof renderKehadiranGuru, 'function', 'renderKehadiranGuru harus diekspor');

  switchSubtabKehadiran('guru');
  assert.strictEqual(kontenSiswa.style.display, 'none', 'Konten siswa harus disembunyikan saat tab guru aktif');
  assert.strictEqual(kontenGuru.style.display, 'block', 'Konten guru harus ditampilkan saat tab guru aktif');
  assert.strictEqual(btnSubtabGuru.classList.contains('active'), true, 'Tombol subtab guru harus memiliki class active');

  // 3.2 Uji status awal: semua 5 guru belum hadir
  mockStorage.clear();
  renderKehadiranGuru();
  assert.strictEqual(Number(countGuruHadir.textContent), 0, 'Guru hadir harus 0');
  assert.strictEqual(Number(countGuruBelum.textContent), 5, 'Guru belum hadir harus 5');
  assert.strictEqual(gridGuruBelum.children.length, 5, 'Grid belum hadir harus berisi 5 kartu guru');

  // 3.3 Uji tap NFC Realtime: Bu Hani Hanifah tap kartu NFC hadir pukul 06:20 WIB
  mockStorage.setItem('local_presensi_guru_2026-10-29_198109012009022003', JSON.stringify({
    nip: '198109012009022003',
    status: 'hadir',
    jam_masuk: '06:20:00',
    waktu: '06:20:00',
    tanggal: '2026-10-29'
  }));

  renderKehadiranGuru();
  assert.strictEqual(Number(countGuruHadir.textContent), 1, 'Guru hadir harus bertambah menjadi 1');
  assert.strictEqual(Number(countGuruBelum.textContent), 4, 'Guru belum hadir harus berkurang menjadi 4');
  assert.strictEqual(gridGuruHadir.children.length, 1, 'Grid guru hadir harus berisi 1 kartu guru');
  assert.strictEqual(gridGuruHadir.children[0].attributes['data-nip'], '198109012009022003', 'Kartu guru hadir adalah Bu Hani');

  // 3.4 Uji Pencarian Nama & Mata Pelajaran
  // Cari "Basis Data" -> Menampilkan Pak Muhammad Echa Putra
  cariNamaGuru.value = 'Basis Data';
  renderKehadiranGuru();
  assert.strictEqual(gridGuruBelum.children.length, 1, 'Pencarian "Basis Data" harus menemukan 1 guru');
  assert.strictEqual(gridGuruBelum.children[0].attributes['data-nip'], '199209142022211007', 'Guru pengampu Basis Data adalah Pak Echa');

  // Cari "Hali" -> Menampilkan Pak Hali
  cariNamaGuru.value = 'Hali';
  renderKehadiranGuru();
  assert.strictEqual(gridGuruBelum.children.length, 1, 'Pencarian "Hali" harus menemukan 1 guru');
  assert.strictEqual(gridGuruBelum.children[0].attributes['data-nip'], '197905032006042004', 'Guru ditemukan harus Pak Hali');

  // Reset pencarian
  cariNamaGuru.value = '';
  renderKehadiranGuru();

  console.log('  ✓ Presensi dewan guru terbuka realtime via NFC & fitur pencarian mapel berfungsi sempurna.\n');

  // ---------------------------------------------------------------------------
  // [TEST 4] Pengetatan Anti-Double Send Siswa (Single Submission Lock)
  // ---------------------------------------------------------------------------
  console.log('▶ [Test 4] Pengetatan Anti-Double Send: Siswa Hanya Bisa Mengajukan Sekali Izin...');

  const perijinanMod = require('../assets/perijinan.js');
  Object.assign(global, perijinanMod);

  const btnSubmit = getOrCreateElem('btnSubmitPerijinan', 'button');
  const msgEl = getOrCreateElem('perijinanMsg');
  const selTarget = getOrCreateElem('perijinanSiswaTarget', 'select');
  const selJenis = getOrCreateElem('perijinanJenis', 'select');
  const selTanggal = getOrCreateElem('perijinanTanggal', 'input');
  const txtAlasan = getOrCreateElem('perijinanAlasan', 'textarea');
  const fileFoto = getOrCreateElem('fotoSurat', 'input');

  const userIhsan = {
    uid: 'UID_0098263610',
    nisn: '0098263610',
    nama: 'M. IHSAN ATHALLAH',
    kelas: 'XII RPL 2',
    role: 'siswa'
  };

  global.currentUser = userIhsan;
  global.getSessionUser = () => userIhsan;
  mockStorage.clear();
  mockStorage.setItem('user_aktif', JSON.stringify(userIhsan));
  mockStorage.setItem('session_user', JSON.stringify(userIhsan));
  mockStorage.setItem('local_perizinan', '[]');
  mockStorage.setItem('local_perijinan', '[]');
  mockStorage.setItem('daftar_perizinan_lokal', '[]');

  // Kondisi awal: tombol harus aktif
  populateDropdownSiswa(userIhsan);
  assert.strictEqual(btnSubmit.disabled, false, 'Tombol submit harus aktif untuk pengajuan pertama');
  assert.strictEqual(btnSubmit.textContent, 'Kirim Pengajuan Izin', 'Label tombol awal adalah "Kirim Pengajuan Izin"');

  // 4.1 Siswa mengajukan izin pertama
  selJenis.value = 'sakit';
  selTanggal.value = '2026-10-29';
  txtAlasan.value = 'Demam tinggi dan istirahat dokter.';
  fileFoto.files = [{ name: 'surat_dokter.jpg', size: 1024, type: 'image/jpeg' }];

  await handleSubmitPerijinan();

  // Verifikasi form langsung TERKUNCI seketika saat render status siswa aktif
  populateDropdownSiswa(userIhsan);
  assert.strictEqual(btnSubmit.disabled, true, 'Tombol submit HARUS terkunci (disabled = true) setelah berhasil kirim');
  assert.strictEqual(btnSubmit.textContent, 'Menunggu Konfirmasi Wali Kelas...', 'Label tombol harus "Menunggu Konfirmasi Wali Kelas..."');
  assert.ok(msgEl.innerHTML.includes('Pengajuan Izin Sedang Menunggu Konfirmasi'), 'Pesan peringatan pending kuning harus muncul');

  const pendingCheck = ambilIzinPendingAktifSiswa('0098263610');
  assert.ok(pendingCheck, 'Izin pending harus tercatat di antrean');
  assert.strictEqual(pendingCheck.status, 'pending', 'Status izin harus pending');

  // 4.2 Siswa mencoba submit kedua kali (Anti Double-Send di handleSubmitPerijinan)
  txtAlasan.value = 'Mencoba kirim dobel izin lagi.';
  await handleSubmitPerijinan();
  assert.strictEqual(btnSubmit.disabled, true, 'Tombol submit harus tetap terkunci pada percobaan kedua');
  assert.ok(msgEl.innerHTML.includes('Anti Double-Send'), 'Pesan proteksi Anti Double-Send harus ditampilkan');

  // 4.3 Siswa mencoba submit dengan tanggal & kategori berbeda (tetap dilarang sesuai aturan user)
  selJenis.value = 'dispen';
  selTanggal.value = '2026-10-30';
  await handleSubmitPerijinan();
  assert.strictEqual(btnSubmit.disabled, true, 'Siswa dilarang mengajukan izin tanggal berbeda saat masih ada izin pending');

  // 4.4 Uji Guard Validasi di submitPerijinan (Low-level Protection)
  let guardError = null;
  try {
    await submitPerijinan(userIhsan, 'izin', 'Mencoba bypass via API submitPerijinan', '2026-10-29', null);
  } catch (err) {
    guardError = err;
  }
  assert.ok(guardError, 'submitPerijinan harus melempar error tegas jika siswa masih memiliki izin pending');
  assert.ok(guardError.message.includes('menunggu konfirmasi Wali Kelas'), 'Pesan error harus memuat larangan permohonan ganda');

  // 4.5 Wali Kelas menolak izin -> Form siswa terbuka kembali
  const permitId = pendingCheck.id || pendingCheck.pid;
  mockStorage.setItem('status_izin_0098263610', 'ditolak');

  // Update status item di local_perizinan menjadi ditolak
  const listPer = JSON.parse(mockStorage.getItem('local_perizinan') || '[]');
  const updatedList = listPer.map(x => (x.id === permitId || x.pid === permitId) ? Object.assign({}, x, { status: 'ditolak', updated_at: new Date().toISOString() }) : x);
  mockStorage.setItem('local_perizinan', JSON.stringify(updatedList));

  populateDropdownSiswa(userIhsan);
  assert.strictEqual(btnSubmit.disabled, false, 'Tombol submit siswa harus aktif kembali setelah izin sebelumnya ditolak Walas');
  assert.strictEqual(btnSubmit.textContent, 'Kirim Pengajuan Izin', 'Label tombol kembali menjadi "Kirim Pengajuan Izin"');

  console.log('  ✓ Pengetatan Anti-Double Send sukses: Siswa hanya bisa submit sekali izin selama pending, dan form terkunci total.\n');

  console.log('================================================================');
  console.log('🎉 SEMUA PENGUJIAN KEHADIRAN GURU, REBRANDING & ANTI DOUBLE-SEND SUKSES 100%!');
  console.log('================================================================');
}

runTests().catch(err => {
  console.error('❌ Gagal dalam pengujian:', err);
  process.exit(1);
});
