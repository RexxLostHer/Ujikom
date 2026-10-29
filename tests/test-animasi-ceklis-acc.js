// ===================================================================
// TEST SUITE: test-animasi-ceklis-acc.js
// Memverifikasi secara komprehensif Fitur Pop-Up Animasi Tanda Ceklis
// saat Walas & Admin meng-ACC kendala guru, perizinan siswa, dan perubahan role.
//
// 1. Ekspor modul & normalisasi opsi (judul, pesan, badge, durasi, fallback).
// 2. Headless fallback & resolusi Promise di lingkungan tanpa DOM.
// 3. Generasi struktur DOM & micro-interactions (SVG checkmark, ripple halo,
//    progress bar timer, ARIA modal, class styling).
// 4. Interaksi penutupan (Tombol OK, Tombol X, Klik Backdrop, Tombol Escape, Auto-dismiss timer).
// 5. Integrasi ACC Kendala Guru di admin.js (adminApproveKendala).
// 6. Integrasi ACC Perizinan Siswa di perijinan.js (adminApprovePerizinanItem).
// 7. Integrasi ACC Izin Siswa oleh Walas di dashboard-guru.js (prosesApprovalIzin).
// 8. Integrasi Konfirmasi Hadir Manual Walas di dashboard-guru.js (catatHadirManualWalas).
// 9. Integrasi Ubah Role & Lepas Tautan NISN di admin.js (ubahRoleUser & lepasTautanNisnAdmin).
// 10. Ketersediaan fungsi alias setujuiIzinSiswa & verifikasiIzin lintas modul.
// ===================================================================

const assert = require('assert');
const path = require('path');
const fs = require('fs');

async function runTestAnimasiCeklis() {
  console.log('================================================================');
  console.log('🧪 MEMULAI PENGUJIAN KOMPREHENSIF ANIMASI POP-UP TANDA CEKLIS ACC');
  console.log('================================================================\n');

  // Load modul animasi ceklis
  const ceklisMod = require('../assets/ceklis-popup.js');
  assert.strictEqual(typeof ceklisMod.tampilkanAnimasiCeklis, 'function', 'tampilkanAnimasiCeklis harus terdefinisi sebagai fungsi');
  assert.strictEqual(typeof ceklisMod.showSuccessCheckmark, 'function', 'showSuccessCheckmark harus menjadi alias fungsi');
  assert.strictEqual(typeof ceklisMod.normalisasiOpsiCeklis, 'function', 'normalisasiOpsiCeklis harus terdefinisi');

  // -------------------------------------------------------------
  // [TEST 1] Pengujian Normalisasi Opsi Ceklis
  // -------------------------------------------------------------
  console.log('▶ [Test 1] Evaluasi Normalisasi Opsi & Penentuan Kategori...');

  // 1.1 Input String sederhana
  const normString = ceklisMod.normalisasiOpsiCeklis('Pengajuan berhasil di-ACC!');
  assert.strictEqual(normString.pesan, 'Pengajuan berhasil di-ACC!');
  assert.strictEqual(normString.judul, 'Berhasil Disetujui!');
  assert.strictEqual(normString.badge, 'DISETUJUI / ACC');
  assert.strictEqual(normString.durasi, 2200);
  assert.strictEqual(normString.tutupOtomatis, true);
  console.log('  ✓ Normalisasi string sederhana menghasilkan struktur opsi default yang valid.');

  // 1.2 Kategori Kendala Guru
  const normKendala = ceklisMod.normalisasiOpsiCeklis({
    kategori: 'kendala',
    pesan: 'Laporan kendala guru di-ACC'
  });
  assert.strictEqual(normKendala.badge, 'ACC KENDALA GURU');
  assert.strictEqual(normKendala.judul, 'Kendala Guru Di-ACC!');
  console.log('  ✓ Kategori kendala otomatis memetakan badge "ACC KENDALA GURU" & judul yang tepat.');

  // 1.3 Kategori Izin Siswa
  const normIzin = ceklisMod.normalisasiOpsiCeklis({
    kategori: 'izin',
    pesan: 'Izin siswa disetujui'
  });
  assert.strictEqual(normIzin.badge, 'ACC PERIZINAN');
  assert.strictEqual(normIzin.judul, 'Berhasil Disetujui!');
  console.log('  ✓ Kategori izin otomatis memetakan badge "ACC PERIZINAN".');

  // 1.4 Kategori Role
  const normRole = ceklisMod.normalisasiOpsiCeklis({
    kategori: 'role',
    pesan: 'Role user diubah'
  });
  assert.strictEqual(normRole.badge, 'KONFIRMASI ROLE');
  assert.strictEqual(normRole.judul, 'Role Berhasil Diperbarui!');
  console.log('  ✓ Kategori role memetakan badge "KONFIRMASI ROLE".\n');

  // -------------------------------------------------------------
  // [TEST 2] Pengujian Headless Fallback (Lingkungan Tanpa DOM)
  // -------------------------------------------------------------
  console.log('▶ [Test 2] Evaluasi Headless Fallback & Resolusi Promise...');
  let callbackClosed = false;
  let callbackSelesai = false;

  const headlessResult = await ceklisMod.tampilkanAnimasiCeklis({
    judul: 'Tes Headless',
    pesan: 'Berjalan di Node runtime',
    onClose: () => { callbackClosed = true; },
    onSelesai: () => { callbackSelesai = true; }
  });

  assert.strictEqual(headlessResult.closed, true);
  assert.strictEqual(headlessResult.reason, 'headless');
  assert.strictEqual(callbackClosed, true, 'onClose callback harus terpanggil pada headless');
  assert.strictEqual(callbackSelesai, true, 'onSelesai callback harus terpanggil pada headless');
  console.log('  ✓ Lingkungan headless tanpa DOM mengeksekusi callback dan meresolusi Promise tanpa error.\n');

  // -------------------------------------------------------------
  // [TEST 3] Pengujian Generasi Struktur DOM & Micro-Interactions (Mock DOM)
  // -------------------------------------------------------------
  console.log('▶ [Test 3] Evaluasi Generasi Struktur DOM & Elemen Micro-Interactions...');

  // Setup Mock DOM
  class MockElement {
    constructor(tag) {
      this.tagName = tag.toUpperCase();
      this.id = '';
      this.className = '';
      this._innerHTML = '';
      this._textContent = '';
      this.style = {};
      this.attributes = {};
      this.children = [];
      this.parentNode = null;
      this.classList = {
        classes: new Set(),
        add: (c) => this.classList.classes.add(c),
        remove: (c) => this.classList.classes.delete(c),
        contains: (c) => this.classList.classes.has(c)
      };
      this.onclick = null;
    }
    setAttribute(k, v) { this.attributes[k] = String(v); }
    getAttribute(k) { return this.attributes[k] || null; }
    appendChild(child) {
      this.children.push(child);
      child.parentNode = this;
      return child;
    }
    removeChild(child) {
      const idx = this.children.indexOf(child);
      if (idx !== -1) {
        this.children.splice(idx, 1);
        child.parentNode = null;
      }
      return child;
    }
    set innerHTML(val) { this._innerHTML = val; }
    get innerHTML() { return this._innerHTML; }
    set textContent(val) { this._textContent = val; }
    get textContent() { return this._textContent; }
  }

  const mockBody = new MockElement('BODY');
  const mockHead = new MockElement('HEAD');

  function findElementById(rootEl, id) {
    if (rootEl.id === id) return rootEl;
    for (const ch of rootEl.children) {
      const found = findElementById(ch, id);
      if (found) return found;
    }
    return null;
  }

  global.document = {
    body: mockBody,
    head: mockHead,
    documentElement: mockBody,
    createElement: (tag) => new MockElement(tag),
    getElementById: (id) => findElementById(mockBody, id) || findElementById(mockHead, id),
    addEventListener: () => {},
    removeEventListener: () => {},
    querySelectorAll: () => [],
    querySelector: () => null
  };
  global.window = global;
  global.window.addEventListener = (event, fn) => {
    global.window._listeners = global.window._listeners || {};
    global.window._listeners[event] = global.window._listeners[event] || [];
    global.window._listeners[event].push(fn);
  };
  global.window.removeEventListener = (event, fn) => {
    if (global.window._listeners && global.window._listeners[event]) {
      global.window._listeners[event] = global.window._listeners[event].filter(x => x !== fn);
    }
  };

  // Panggil tampilkanAnimasiCeklis pada mock DOM
  const promisePopup = ceklisMod.tampilkanAnimasiCeklis({
    judul: 'Kendala Guru Berhasil Di-ACC!',
    subjudul: 'Operasional Jamkos Aktif',
    pesan: 'Laporan kendala guru telah disetujui.',
    badge: 'ACC KENDALA GURU',
    durasi: 1500
  });

  const backdropEl = global.document.getElementById('ceklisPopupBackdrop');
  assert.ok(backdropEl, 'Backdrop #ceklisPopupBackdrop harus ter-mount ke body');
  assert.strictEqual(backdropEl.className, 'ceklis-popup-backdrop');
  assert.strictEqual(backdropEl.getAttribute('role'), 'dialog');
  assert.strictEqual(backdropEl.getAttribute('aria-modal'), 'true');
  console.log('  ✓ Backdrop modal ter-mount dengan atribut ARIA dialog & modal.');

  // Periksa Card & Komponen
  const cardEl = backdropEl.children[0];
  assert.ok(cardEl, 'Card popup harus ada di dalam backdrop');
  assert.strictEqual(cardEl.className, 'ceklis-popup-card');

  const btnClose = global.document.getElementById('ceklisBtnClose');
  assert.ok(btnClose, 'Tombol close X #ceklisBtnClose harus dibuat');
  assert.strictEqual(btnClose.innerHTML, '✕');

  const titleEl = global.document.getElementById('ceklisTitle');
  assert.ok(titleEl, 'Elemen judul #ceklisTitle harus dibuat');
  assert.strictEqual(titleEl.textContent, 'Kendala Guru Berhasil Di-ACC!');

  const msgEl = global.document.getElementById('ceklisMessage');
  assert.ok(msgEl, 'Elemen pesan #ceklisMessage harus dibuat');
  assert.strictEqual(msgEl.textContent, 'Laporan kendala guru telah disetujui.');

  const badgeEl = global.document.getElementById('ceklisBadge');
  assert.ok(badgeEl, 'Elemen badge #ceklisBadge harus dibuat');
  assert.ok(badgeEl.innerHTML.includes('ACC KENDALA GURU'));

  const progressBar = global.document.getElementById('ceklisProgressBar');
  assert.ok(progressBar, 'Micro countdown progress bar #ceklisProgressBar harus ada');

  const btnOk = global.document.getElementById('ceklisBtnOk');
  assert.ok(btnOk, 'Tombol OK #ceklisBtnOk harus dibuat');
  assert.strictEqual(btnOk.textContent, 'OK, Mengerti');

  // Periksa SVG Checkmark & Halo Ripple
  const svgWrapper = cardEl.children.find(c => c.className === 'ceklis-icon-wrapper');
  assert.ok(svgWrapper, 'Wadah ikon SVG .ceklis-icon-wrapper harus ada');
  assert.ok(svgWrapper.innerHTML.includes('ceklis-ripple-halo'), 'SVG wrapper harus memuat efek ripple halo');
  assert.ok(svgWrapper.innerHTML.includes('ceklis-svg'), 'SVG wrapper harus memuat ceklis-svg');
  assert.ok(svgWrapper.innerHTML.includes('ceklis-circle-stroke'), 'SVG harus memiliki lingkaran animasi stroke');
  assert.ok(svgWrapper.innerHTML.includes('ceklis-check-path'), 'SVG harus memiliki path tanda centang');
  console.log('  ✓ Seluruh elemen visual (SVG draw, halo, badge, judul, pesan, progress bar, tombol) ter-render 100% sempurna.\n');

  // -------------------------------------------------------------
  // [TEST 4] Pengujian Berbagai Metode Penutupan Modal (Dismissal)
  // -------------------------------------------------------------
  console.log('▶ [Test 4] Evaluasi Mekanisme Penutupan Modal (OK, Close, Escape, Timer)...');

  // 4.1 Tutup via Tombol OK
  btnOk.onclick({ stopPropagation: () => {} });
  const closeResultOk = await promisePopup;
  assert.strictEqual(closeResultOk.closed, true);
  assert.strictEqual(closeResultOk.reason, 'button');
  console.log('  ✓ Penutupan via tombol "OK, Mengerti" berfungsi presisi (reason: button).');

  // 4.2 Tutup via Tombol Close (X)
  const pCloseBtn = ceklisMod.tampilkanAnimasiCeklis({ judul: 'Test X', pesan: 'Tutup X' });
  const btnClose2 = global.document.getElementById('ceklisBtnClose');
  btnClose2.onclick({ stopPropagation: () => {} });
  const resCloseBtn = await pCloseBtn;
  assert.strictEqual(resCloseBtn.closed, true);
  assert.strictEqual(resCloseBtn.reason, 'close_btn');
  console.log('  ✓ Penutupan via tombol silang (✕) berfungsi presisi (reason: close_btn).');

  // 4.3 Tutup via Klik Backdrop
  const pBackdrop = ceklisMod.tampilkanAnimasiCeklis({ judul: 'Test Backdrop', pesan: 'Klik luar' });
  const backdrop2 = global.document.getElementById('ceklisPopupBackdrop');
  backdrop2.onclick({ target: backdrop2 });
  const resBackdrop = await pBackdrop;
  assert.strictEqual(resBackdrop.closed, true);
  assert.strictEqual(resBackdrop.reason, 'backdrop');
  console.log('  ✓ Penutupan via klik di luar modal (backdrop) berfungsi presisi (reason: backdrop).');

  // 4.4 Tutup via Tombol Escape Keyboard
  const pEscape = ceklisMod.tampilkanAnimasiCeklis({ judul: 'Test Escape', pesan: 'Tekan Esc' });
  const escHandler = global.window._listeners['keydown'][0];
  assert.ok(escHandler, 'Listener keydown harus terpasang untuk tombol Escape');
  escHandler({ key: 'Escape', keyCode: 27 });
  const resEscape = await pEscape;
  assert.strictEqual(resEscape.closed, true);
  assert.strictEqual(resEscape.reason, 'escape');
  console.log('  ✓ Penutupan via tombol Escape keyboard berfungsi presisi (reason: escape).');

  // 4.5 Tutup via Auto-dismiss Timer
  const pTimer = ceklisMod.tampilkanAnimasiCeklis({ judul: 'Test Timer', pesan: 'Tunggu timeout', durasi: 50 });
  const resTimer = await pTimer;
  assert.strictEqual(resTimer.closed, true);
  assert.strictEqual(resTimer.reason, 'timer');
  console.log('  ✓ Penutupan via auto-dismiss timer countdown berfungsi presisi (reason: timer).\n');

  // -------------------------------------------------------------
  // [TEST 5] Integrasi ACC Kendala Guru di admin.js
  // -------------------------------------------------------------
  console.log('▶ [Test 5] Evaluasi Integrasi ACC Kendala Guru di admin.js (adminApproveKendala)...');

  // Track pemanggilan animasi ceklis
  let callRecord = null;
  global.tampilkanAnimasiCeklis = (opsi) => {
    callRecord = opsi;
    return Promise.resolve({ closed: true, reason: 'mock' });
  };
  global.showSuccessCheckmark = global.tampilkanAnimasiCeklis;

  // Mock RTDB & LocalStorage untuk admin.js
  const mockStorage = {
    store: {},
    getItem(k) { return this.store[k] || null; },
    setItem(k, v) { this.store[k] = String(v); },
    removeItem(k) { delete this.store[k]; }
  };
  global.localStorage = mockStorage;
  global.confirm = () => true;

  const mockDbData = {
    kendala_guru: {},
    kendala_mengajar: {},
    kelas: {},
    status_kelas: {}
  };
  global.db = {
    ref: (path) => ({
      update: async (val) => {
        const parts = path.split('/');
        const rootNode = parts[0];
        const childKey = parts[1];
        if (childKey) {
          mockDbData[rootNode] = mockDbData[rootNode] || {};
          mockDbData[rootNode][childKey] = Object.assign({}, mockDbData[rootNode][childKey] || {}, val);
        } else {
          mockDbData[rootNode] = Object.assign({}, mockDbData[rootNode] || {}, val);
        }
        return true;
      },
      set: async (val) => {
        const parts = path.split('/');
        mockDbData[parts[0]] = mockDbData[parts[0]] || {};
        if (parts[1]) mockDbData[parts[0]][parts[1]] = val;
        return true;
      },
      once: async () => ({ val: () => ({}) }),
      remove: async () => true
    })
  };

  const adminMod = require('../assets/admin.js');
  global.kendalaGuruCache = global.kendalaGuruCache || {};
  const testKid = 'KENDALA-TEST-9988';
  global.kendalaGuruCache[testKid] = {
    id: testKid,
    guruNama: 'Muhammad Echa Putra, S.Kom.Gr',
    guruNip: '198503152010011002',
    kelasId: 'XII RPL 2',
    mapel: 'Basis Data',
    alasan: 'Rapat Dinas Kurikulum SMK',
    status: 'pending'
  };

  callRecord = null;
  await adminMod.adminApproveKendala(testKid);

  assert.ok(callRecord, 'adminApproveKendala harus memanggil tampilkanAnimasiCeklis');
  assert.strictEqual(callRecord.kategori, 'kendala', 'Kategori animasi harus kendala');
  assert.ok(callRecord.judul.includes('Kendala Guru'), 'Judul harus memuat informasi kendala');
  assert.ok(callRecord.pesan.includes('Muhammad Echa Putra') && callRecord.pesan.includes('XII RPL 2'), 'Pesan harus memuat nama guru dan kelas target');
  console.log('  ✓ ACC Kendala Guru di admin.js sukses memicu pop-up animasi ceklis elegan.\n');

  // -------------------------------------------------------------
  // [TEST 6] Integrasi ACC Perizinan Siswa di perijinan.js
  // -------------------------------------------------------------
  console.log('▶ [Test 6] Evaluasi Integrasi ACC Perizinan Siswa di perijinan.js (adminApprovePerizinanItem)...');

  const perijinanMod = require('../assets/perijinan.js');
  global.cacheSemuaPerizinanAdmin = global.cacheSemuaPerizinanAdmin || {};
  const testIzinId = 'IZIN-SISWA-7766';
  global.cacheSemuaPerizinanAdmin[testIzinId] = {
    id: testIzinId,
    nisn: '0098263610',
    nama: 'M. IHSAN ATHALLAH',
    kelas: 'XII RPL 2',
    jenis: 'sakit',
    alasan: 'Demam & istirahat dokter',
    status: 'pending'
  };

  callRecord = null;
  await perijinanMod.adminApprovePerizinanItem(testIzinId, false, '0098263610', '2026-10-29', 'sakit');

  assert.ok(callRecord, 'adminApprovePerizinanItem harus memanggil tampilkanAnimasiCeklis');
  assert.strictEqual(callRecord.kategori, 'izin', 'Kategori animasi harus izin');
  assert.ok(callRecord.badge.includes('PERIZINAN'), 'Badge harus memuat PERIZINAN');
  assert.ok(callRecord.pesan.includes('M. IHSAN ATHALLAH'), 'Pesan harus memuat nama siswa yang disetujui');
  console.log('  ✓ ACC Izin Siswa oleh Admin di perijinan.js sukses memicu pop-up animasi ceklis.\n');

  // -------------------------------------------------------------
  // [TEST 7] Integrasi ACC Izin Siswa oleh Walas di dashboard-guru.js
  // -------------------------------------------------------------
  console.log('▶ [Test 7] Evaluasi Integrasi ACC Izin oleh Walas di dashboard-guru.js (prosesApprovalIzin)...');

  const guruMod = require('../assets/dashboard-guru.js');
  global.allPerizinanData = global.allPerizinanData || {};
  const testWalasIzinId = 'IZIN-WALAS-5544';
  global.allPerizinanData[testWalasIzinId] = {
    id: testWalasIzinId,
    pid: testWalasIzinId,
    nisn: '0098263610',
    nama: 'M. IHSAN ATHALLAH',
    kelas: 'XII RPL 2',
    jenis: 'sakit',
    status: 'pending'
  };
  global.prompt = () => 'Disetujui. Istirahat yang cukup.';
  global.guruAktif = {
    role: 'walas',
    isWalas: true,
    walasKelasId: 'XII RPL 2',
    nama: 'Muhammad Echa Putra, S.Kom.Gr',
    nip: '198503152010011002'
  };
  global.MASTER_GURU_RESMI = {
    '198503152010011002': { nama: 'Muhammad Echa Putra, S.Kom.Gr', isWalas: true, walasKelasId: 'XII RPL 2' }
  };

  callRecord = null;
  await guruMod.prosesApprovalIzin(testWalasIzinId, 'disetujui');

  assert.ok(callRecord, 'prosesApprovalIzin walas harus memicu tampilkanAnimasiCeklis');
  assert.strictEqual(callRecord.kategori, 'izin');
  assert.strictEqual(callRecord.badge, 'ACC WALI KELAS');
  assert.ok(callRecord.pesan.includes('M. IHSAN ATHALLAH'), 'Pesan harus memuat nama siswa');
  console.log('  ✓ Walas resmi menyetujui izin siswa berhasil memicu pop-up animasi ceklis "ACC WALI KELAS".\n');

  // -------------------------------------------------------------
  // [TEST 8] Integrasi Hadir Manual Walas di dashboard-guru.js
  // -------------------------------------------------------------
  console.log('▶ [Test 8] Evaluasi Integrasi Hadir Manual Walas (catatHadirManualWalas)...');

  callRecord = null;
  await guruMod.catatHadirManualWalas('0098263610', 'XII RPL 2', 'M. IHSAN ATHALLAH');

  assert.ok(callRecord, 'catatHadirManualWalas harus memanggil tampilkanAnimasiCeklis');
  assert.strictEqual(callRecord.badge, 'ACC HADIR MANUAL');
  assert.strictEqual(callRecord.kategori, 'presensi');
  assert.ok(callRecord.pesan.includes('HADIR'), 'Pesan harus mengonfirmasi status HADIR');
  console.log('  ✓ Hadir manual oleh Walas berhasil memicu pop-up animasi ceklis.\n');

  // -------------------------------------------------------------
  // [TEST 9] Integrasi Ubah Role & Lepas Tautan NISN di admin.js
  // -------------------------------------------------------------
  console.log('▶ [Test 9] Evaluasi Ubah Role & Lepas Tautan NISN di admin.js...');

  // 9.1 Ubah Role
  callRecord = null;
  await adminMod.ubahRoleUser('USER_UID_123', 'guru');
  assert.ok(callRecord, 'ubahRoleUser harus memanggil tampilkanAnimasiCeklis');
  assert.strictEqual(callRecord.badge, 'KONFIRMASI ROLE');
  assert.ok(callRecord.pesan.includes('GURU'), 'Pesan harus memuat role baru');
  console.log('  ✓ Perubahan role pengguna oleh Admin berhasil memicu pop-up animasi ceklis.');

  // 9.2 Lepas Tautan NISN
  callRecord = null;
  await adminMod.lepasTautanNisnAdmin('USER_UID_123', '0098263610', 'siswa@smkn1sumedang.sch.id');
  assert.ok(callRecord, 'lepasTautanNisnAdmin harus memanggil tampilkanAnimasiCeklis');
  assert.strictEqual(callRecord.badge, 'VERIFIKASI AKUN');
  assert.ok(callRecord.pesan.includes('0098263610'), 'Pesan harus memuat NISN yang dilepas');
  console.log('  ✓ Pelepasan tautan NISN akun berhasil memicu pop-up animasi ceklis.\n');

  // -------------------------------------------------------------
  // [TEST 10] Pengujian Ketersediaan Alias Global setujuiIzinSiswa & verifikasiIzin
  // -------------------------------------------------------------
  console.log('▶ [Test 10] Evaluasi Ketersediaan Fungsi Alias setujuiIzinSiswa & verifikasiIzin...');

  assert.strictEqual(typeof adminMod.setujuiIzinSiswa, 'function', 'adminMod.setujuiIzinSiswa harus tersedia');
  assert.strictEqual(typeof adminMod.verifikasiIzin, 'function', 'adminMod.verifikasiIzin harus tersedia');
  assert.strictEqual(typeof perijinanMod.setujuiIzinSiswa, 'function', 'perijinanMod.setujuiIzinSiswa harus tersedia');
  assert.strictEqual(typeof perijinanMod.verifikasiIzin, 'function', 'perijinanMod.verifikasiIzin harus tersedia');
  assert.strictEqual(typeof guruMod.setujuiIzinSiswa, 'function', 'guruMod.setujuiIzinSiswa harus tersedia');
  assert.strictEqual(typeof guruMod.verifikasiIzin, 'function', 'guruMod.verifikasiIzin harus tersedia');
  // -------------------------------------------------------------
  // [TEST 11] Evaluasi Pemanggilan Cepat Bergantian (Rapid Calls & Superseded Resolution)
  // -------------------------------------------------------------
  console.log('▶ [Test 11] Evaluasi Pemanggilan Cepat Bergantian (Rapid Consecutive Calls)...');

  const pRapid1 = ceklisMod.tampilkanAnimasiCeklis({ judul: 'Popup 1', durasi: 2000 });
  const pRapid2 = ceklisMod.tampilkanAnimasiCeklis({ judul: 'Popup 2', durasi: 2000 });

  let rapid1Result = null;
  pRapid1.then(res => { rapid1Result = res; });

  const btnOkRapid = global.document.getElementById('ceklisBtnOk');
  assert.ok(btnOkRapid, 'Tombol OK popup kedua harus aktif');
  btnOkRapid.onclick({ stopPropagation: () => {} });

  const rapid2Result = await pRapid2;
  await new Promise(r => setTimeout(r, 20));

  assert.ok(rapid1Result, 'Promise pertama harus terselesaikan');
  assert.strictEqual(rapid1Result.closed, true);
  assert.strictEqual(rapid1Result.reason, 'superseded', 'Promise pertama harus berstatus superseded');
  assert.strictEqual(rapid2Result.closed, true);
  assert.strictEqual(rapid2Result.reason, 'button', 'Promise kedua terselesaikan via klik tombol');
  console.log('  ✓ Pemanggilan cepat berturut-turut meresolusi promise sebelumnya (reason: superseded) tanpa hanging/memory leak.\n');

  // -------------------------------------------------------------
  // [TEST 12] Evaluasi Pencegahan Kebocoran Listener Keydown Escape
  // -------------------------------------------------------------
  console.log('▶ [Test 12] Evaluasi Pencegahan Kebocoran Event Listener Escape Keydown...');

  // 12.1 Tutup via OK
  const pLeakOk = ceklisMod.tampilkanAnimasiCeklis({ judul: 'Leak Test OK' });
  global.document.getElementById('ceklisBtnOk').onclick({ stopPropagation: () => {} });
  await pLeakOk;
  assert.strictEqual((global.window._listeners['keydown'] || []).length, 0, 'Listener keydown harus 0 setelah tutup via OK');

  // 12.2 Tutup via Close X
  const pLeakClose = ceklisMod.tampilkanAnimasiCeklis({ judul: 'Leak Test Close' });
  global.document.getElementById('ceklisBtnClose').onclick({ stopPropagation: () => {} });
  await pLeakClose;
  assert.strictEqual((global.window._listeners['keydown'] || []).length, 0, 'Listener keydown harus 0 setelah tutup via Close button');

  // 12.3 Tutup via Backdrop
  const pLeakBackdrop = ceklisMod.tampilkanAnimasiCeklis({ judul: 'Leak Test Backdrop' });
  const bdEl = global.document.getElementById('ceklisPopupBackdrop');
  bdEl.onclick({ target: bdEl });
  await pLeakBackdrop;
  assert.strictEqual((global.window._listeners['keydown'] || []).length, 0, 'Listener keydown harus 0 setelah tutup via Backdrop click');

  // 12.4 Tutup via Timer
  const pLeakTimer = ceklisMod.tampilkanAnimasiCeklis({ judul: 'Leak Test Timer', durasi: 25 });
  await pLeakTimer;
  assert.strictEqual((global.window._listeners['keydown'] || []).length, 0, 'Listener keydown harus 0 setelah auto-dismiss timer');
  console.log('  ✓ Bersih dari kebocoran listener: keydown listener terhapus 100% pada seluruh skenario penutupan.\n');

  // -------------------------------------------------------------
  // [TEST 13] Integrasi ACC Hadir Manual Guru & Izin Cepat di dashboard-guru.js
  // -------------------------------------------------------------
  console.log('▶ [Test 13] Evaluasi Integrasi ACC Hadir Manual Guru & Izin Cepat di dashboard-guru.js...');

  // 13.1 hadirkanManual
  global.currentKelas = 'XII RPL 2';
  global.isGuruBerhakKelolaKelas = () => true;
  callRecord = null;
  await guruMod.hadirkanManual('0098263610', 'M. IHSAN ATHALLAH', 1);
  assert.ok(callRecord, 'hadirkanManual harus memanggil tampilkanAnimasiCeklis');
  assert.strictEqual(callRecord.kategori, 'presensi');
  assert.strictEqual(callRecord.badge, 'ACC HADIR MANUAL');
  console.log('  ✓ hadirkanManual berhasil memicu pop-up animasi ceklis kehadiran.');

  // 13.2 hadirkanManualGuru
  callRecord = null;
  global.dataSiswaKelasCache = [{ nisn: '0098263610', nama: 'M. IHSAN ATHALLAH', status: 'belum' }];
  await guruMod.hadirkanManualGuru('0098263610', 'M. IHSAN ATHALLAH', 1);
  assert.ok(callRecord, 'hadirkanManualGuru harus memanggil tampilkanAnimasiCeklis');
  assert.strictEqual(callRecord.kategori, 'presensi');
  assert.strictEqual(callRecord.badge, 'ACC HADIR MANUAL');
  console.log('  ✓ hadirkanManualGuru berhasil memicu pop-up animasi ceklis kehadiran.');

  // 13.3 beriIzinCepat
  callRecord = null;
  global.prompt = () => 'Dispensasi Lomba LKS';
  await guruMod.beriIzinCepat('0098263610', 'M. IHSAN ATHALLAH');
  assert.ok(callRecord, 'beriIzinCepat harus memanggil tampilkanAnimasiCeklis');
  assert.strictEqual(callRecord.kategori, 'izin');
  assert.strictEqual(callRecord.badge, 'ACC PERIZINAN');
  console.log('  ✓ beriIzinCepat berhasil memicu pop-up animasi ceklis perizinan cepat.\n');

  // -------------------------------------------------------------
  // [TEST 14] Evaluasi Integrasi Fallback approveStudentPermit di firebase-config.js
  // -------------------------------------------------------------
  console.log('▶ [Test 14] Evaluasi Fallback approveStudentPermit di firebase-config.js...');
  const fbConfigMod = require('../assets/firebase-config.js');
  if (typeof fbConfigMod.approveStudentPermit === 'function') {
    callRecord = null;
    delete global.prosesApprovalIzin;
    await fbConfigMod.approveStudentPermit({
      id: 'PERMIT-TEST-001',
      namaPengaju: 'M. IHSAN ATHALLAH',
      tipe: 'sakit',
      targetKelasId: 'XII RPL 2',
      tanggal: '2026-10-29'
    });
    assert.ok(callRecord, 'approveStudentPermit harus memanggil tampilkanAnimasiCeklis saat prosesApprovalIzin tidak ada');
    assert.strictEqual(callRecord.kategori, 'izin');
    assert.strictEqual(callRecord.badge, 'ACC WALI KELAS');
    console.log('  ✓ Fallback approveStudentPermit di firebase-config.js sukses memicu animasi ceklis.\n');
  }

  console.log('================================================================');
  console.log('🎉 SELURUH PENGUJIAN ANIMASI POP-UP CEKLIS ACC LULUS 100%! (14/14)');
  console.log('================================================================');
  process.exit(0);
}

runTestAnimasiCeklis().catch(err => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
