/**
 * ===================================================================
 * TEST SUITE: test-animasi-tolak-dan-minimalis-ceklis.js
 * Memverifikasi:
 * 1. Penghapusan total tombol "Reset Data Izin (Testing)" dari HTML.
 * 2. Desain minimalis pop-up ceklis & terbebas dari AI slop (clean vector, no neon rave).
 * 3. Fitur baru Animasi Pop-Up Penolakan (tampilkanAnimasiTolak & showRejectedAlert).
 * 4. Integrasi penolakan izin oleh Walas di dashboard-guru.js.
 * 5. Integrasi penolakan izin siswa & guru di perijinan.js.
 * 6. Integrasi penolakan kendala guru di admin.js.
 * ===================================================================
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

async function runTests() {
  console.log('================================================================');
  console.log('🧪 PENGUJIAN ANIMASI MINIMALIS, PENOLAKAN & PEMBERSIHAN TESTING UI');
  console.log('================================================================\n');

  // -------------------------------------------------------------
  // [TEST 1] Verifikasi Penghapusan Tombol Reset Data Izin (Testing)
  // -------------------------------------------------------------
  console.log('▶ [Test 1] Evaluasi Penghapusan Tombol Reset Data Izin (Testing) dari Markup...');
  const guruHtml = fs.readFileSync(path.join(__dirname, '../dashboard-guru.html'), 'utf8');
  const adminHtml = fs.readFileSync(path.join(__dirname, '../admin.html'), 'utf8');
  const dashHtml = fs.readFileSync(path.join(__dirname, '../dashboard.html'), 'utf8');

  assert.ok(!guruHtml.includes('btnResetIzinTesting'), 'dashboard-guru.html TIDAK boleh memuat #btnResetIzinTesting');
  assert.ok(!guruHtml.includes('Reset Data Izin (Testing)'), 'dashboard-guru.html TIDAK boleh memuat teks "Reset Data Izin (Testing)"');
  assert.ok(!adminHtml.includes('btnResetIzinTestingAdmin'), 'admin.html TIDAK boleh memuat #btnResetIzinTestingAdmin');
  assert.ok(!adminHtml.includes('Reset Data Izin (Testing)'), 'admin.html TIDAK boleh memuat teks "Reset Data Izin (Testing)"');
  assert.ok(!dashHtml.includes('Reset Data Izin (Testing)'), 'dashboard.html TIDAK boleh memuat teks "Reset Data Izin (Testing)"');
  console.log('  ✓ Tombol "Reset Data Izin (Testing)" 100% bersih dan terhapus dari seluruh antarmuka.\n');

  // -------------------------------------------------------------
  // [TEST 2] Verifikasi Desain Minimalis & Ketiadaan AI Slop
  // -------------------------------------------------------------
  console.log('▶ [Test 2] Evaluasi Desain Minimalis pada ceklis-popup.css & ceklis-popup.js...');
  const popupCss = fs.readFileSync(path.join(__dirname, '../assets/ceklis-popup.css'), 'utf8');
  const popupJs = fs.readFileSync(path.join(__dirname, '../assets/ceklis-popup.js'), 'utf8');

  // Pastikan tidak ada heavy multi-layer neon dropshadow pada SVG
  assert.ok(!popupCss.includes('filter: drop-shadow(0 10px 18px rgba(16, 185, 129, 0.35))'), 'drop-shadow neon slop harus dihilangkan');
  // Pastikan card menggunakan proporsi modern minimalis (max-width 360px & border-radius 20px)
  assert.ok(popupCss.includes('max-width: 360px'), 'Card popup harus menggunakan max-width compact 360px');
  assert.ok(popupCss.includes('border-radius: 20px'), 'Card popup harus menggunakan border-radius 20px yang rapi');
  // Pastikan ada kelas tolak dan micro-shake
  assert.ok(popupCss.includes('ceklis-card-tolak'), 'CSS harus memuat styling .ceklis-card-tolak');
  assert.ok(popupCss.includes('tolakMicroShake'), 'CSS harus memuat animasi tolakMicroShake');
  console.log('  ✓ Desain pop-up centang dan silang bersih, modern, dan terbebas dari artefak AI slop.\n');

  // -------------------------------------------------------------
  // [TEST 3] Verifikasi Fungsi Animasi Penolakan (tampilkanAnimasiTolak)
  // -------------------------------------------------------------
  console.log('▶ [Test 3] Evaluasi Fungsi tampilkanAnimasiTolak & showRejectedAlert...');
  const ceklisMod = require('../assets/ceklis-popup.js');

  assert.strictEqual(typeof ceklisMod.tampilkanAnimasiTolak, 'function', 'tampilkanAnimasiTolak harus tersedia');
  assert.strictEqual(typeof ceklisMod.showRejectedAlert, 'function', 'showRejectedAlert harus menjadi alias fungsi');

  // Headless test untuk tampilkanAnimasiTolak
  let tolakOnCloseCalled = false;
  let tolakOnSelesaiCalled = false;
  const resTolakHeadless = await ceklisMod.tampilkanAnimasiTolak({
    judul: 'Izin Ditolak',
    pesan: 'Surat dokter tidak valid',
    onClose: () => { tolakOnCloseCalled = true; },
    onSelesai: () => { tolakOnSelesaiCalled = true; }
  });

  assert.strictEqual(resTolakHeadless.closed, true);
  assert.strictEqual(resTolakHeadless.reason, 'headless');
  assert.strictEqual(resTolakHeadless.data.isTolak, true);
  assert.strictEqual(resTolakHeadless.data.badge, 'DITOLAK');
  assert.strictEqual(tolakOnCloseCalled, true);
  assert.strictEqual(tolakOnSelesaiCalled, true);
  console.log('  ✓ Fungsi tampilkanAnimasiTolak berjalan presisi pada lingkungan headless.\n');

  // -------------------------------------------------------------
  // [TEST 4] Evaluasi DOM Animasi Penolakan (Mock DOM)
  // -------------------------------------------------------------
  console.log('▶ [Test 4] Evaluasi Elemen DOM untuk Mode Penolakan...');

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

  const promiseTolak = ceklisMod.tampilkanAnimasiTolak({
    judul: 'Permohonan Ditolak',
    pesan: 'Alasan: Berkas surat tidak lengkap',
    badge: 'PENOLAKAN WALAS'
  });

  const backdropEl = global.document.getElementById('ceklisPopupBackdrop');
  assert.ok(backdropEl, 'Backdrop penolakan harus ter-mount ke body');
  const cardEl = backdropEl.children[0];
  assert.ok(cardEl.className.includes('ceklis-card-tolak'), 'Card harus memiliki kelas ceklis-card-tolak');

  const badgeEl = global.document.getElementById('ceklisBadge');
  assert.ok(badgeEl.innerHTML.includes('✕'), 'Badge penolakan harus memuat simbol silang ✕');
  assert.ok(badgeEl.innerHTML.includes('PENOLAKAN WALAS'));

  const svgWrapper = cardEl.children.find(c => c.className === 'ceklis-icon-wrapper');
  assert.ok(svgWrapper, 'Icon wrapper penolakan harus ada');
  assert.ok(svgWrapper.innerHTML.includes('ceklis-cross-path'), 'Icon wrapper harus memuat ceklis-cross-path');
  assert.ok(svgWrapper.innerHTML.includes('stroke="#f43f5e"') || svgWrapper.innerHTML.includes('stroke="#e11d48"'), 'Warna icon harus bertema rose/red');

  // Dismiss via OK
  const btnOk = global.document.getElementById('ceklisBtnOk');
  btnOk.onclick({ stopPropagation: () => {} });
  const resDismissTolak = await promiseTolak;
  assert.strictEqual(resDismissTolak.closed, true);
  assert.strictEqual(resDismissTolak.reason, 'button');
  console.log('  ✓ Elemen visual penolakan (cross-path, rose badge, card-tolak) ter-render dan ter-dismiss secara presisi.\n');

  // -------------------------------------------------------------
  // [TEST 5] Integrasi Penolakan Izin Walas di dashboard-guru.js
  // -------------------------------------------------------------
  console.log('▶ [Test 5] Evaluasi Integrasi Penolakan Izin oleh Walas di dashboard-guru.js...');
  const guruMod = require('../assets/dashboard-guru.js');
  let calledTolakWalas = null;

  global.tampilkanAnimasiTolak = (opsi) => {
    calledTolakWalas = opsi;
    return Promise.resolve({ closed: true, reason: 'mock' });
  };

  const testWalasIzinId = 'IZIN-WALAS-TOLAK-IHSAN';
  global.allPerizinanData = global.allPerizinanData || {};
  global.allPerizinanData[testWalasIzinId] = {
    id: testWalasIzinId,
    pid: testWalasIzinId,
    nisn: '0098263610',
    nama: 'M. IHSAN ATHALLAH',
    kelas: 'XII RPL 2',
    jenis: 'sakit',
    status: 'pending'
  };
  global.prompt = () => 'Bukti surat dokter tidak jelas.';
  global.guruAktif = {
    role: 'walas',
    isWalas: true,
    walasKelasId: 'XII RPL 2',
    nama: 'Muhammad Echa Putra, S.Kom.Gr',
    nip: '198503152010011002'
  };
  global.window.guruAktif = global.guruAktif;
  global.MASTER_GURU_RESMI = {
    '198503152010011002': { nama: 'Muhammad Echa Putra, S.Kom.Gr', isWalas: true, walasKelasId: 'XII RPL 2' }
  };
  global.window.MASTER_GURU_RESMI = global.MASTER_GURU_RESMI;

  await guruMod.prosesApprovalIzin(testWalasIzinId, 'ditolak');

  assert.ok(calledTolakWalas, 'prosesApprovalIzin status ditolak harus memanggil tampilkanAnimasiTolak');
  assert.ok(calledTolakWalas.badge.includes('DITOLAK'), 'Badge harus memuat DITOLAK');
  assert.ok(calledTolakWalas.pesan.includes('M. IHSAN ATHALLAH'), 'Pesan penolakan harus memuat nama siswa');
  assert.ok(calledTolakWalas.pesan.includes('Bukti surat dokter tidak jelas.'), 'Pesan harus memuat catatan penolakan');
  console.log('  ✓ Walas menolak izin siswa sukses memicu animasi penolakan interaktif.\n');

  // -------------------------------------------------------------
  // [TEST 6] Integrasi Penolakan Izin di perijinan.js & Kendala di admin.js
  // -------------------------------------------------------------
  console.log('▶ [Test 6] Evaluasi Penolakan di perijinan.js & admin.js...');
  const perijinanMod = require('../assets/perijinan.js');
  const adminMod = require('../assets/admin.js');

  let calledTolakPerijinan = null;
  global.tampilkanAnimasiTolak = (opsi) => {
    calledTolakPerijinan = opsi;
    return Promise.resolve({ closed: true, reason: 'mock' });
  };

  global.cacheSemuaPerizinanAdmin = {
    'IZIN-ADMIN-TOLAK': {
      id: 'IZIN-ADMIN-TOLAK',
      nisn: '0098263610',
      nama: 'M. IHSAN ATHALLAH',
      kelas: 'XII RPL 2',
      jenis: 'izin',
      status: 'pending'
    }
  };
  global.adminUser = { nama: 'Administrator Presensia' };
  global.prompt = () => 'Tidak ada surat pengantar orang tua.';

  await perijinanMod.adminTolakPerizinanItem('IZIN-ADMIN-TOLAK', false);
  assert.ok(calledTolakPerijinan, 'adminTolakPerizinanItem siswa harus memicu animasi penolakan');
  assert.ok(calledTolakPerijinan.badge.includes('DITOLAK'));
  assert.ok(calledTolakPerijinan.pesan.includes('M. IHSAN ATHALLAH'));

  // Test admin tolak kendala guru
  let calledTolakKendala = null;
  global.tampilkanAnimasiTolak = (opsi) => {
    calledTolakKendala = opsi;
    return Promise.resolve({ closed: true, reason: 'mock' });
  };

  global.kendalaGuruCache = {
    'KENDALA-TOLAK-1': {
      id: 'KENDALA-TOLAK-1',
      guruNama: 'Hani Hanifah, S.Si',
      kelasId: 'XII RPL 1',
      status: 'pending'
    }
  };

  await adminMod.adminRejectKendala('KENDALA-TOLAK-1');
  assert.ok(calledTolakKendala, 'adminRejectKendala harus memicu animasi penolakan');
  assert.ok(calledTolakKendala.badge.includes('DITOLAK'));
  assert.ok(calledTolakKendala.pesan.includes('Hani Hanifah, S.Si'));

  console.log('  ✓ Penolakan di perijinan.js dan admin.js sukses memicu animasi penolakan.\n');

  console.log('================================================================');
  console.log('🎉 SELURUH PENGUJIAN ANIMASI TOLAK & MINIMALIS LULUS 100%! (6/6)');
  console.log('================================================================');
}

runTests().catch(err => {
  console.error('❌ PENGUJIAN GAGAL:', err);
  process.exit(1);
});
