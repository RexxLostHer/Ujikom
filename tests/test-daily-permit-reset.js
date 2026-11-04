/**
 * Test Suite: Auto-Reset Harian Izin Siswa (Daily Permit Rollover)
 * 
 * Verifikasi spesifik:
 * 1. Izin disetujui (ACC) dari hari lampau (>12 jam lalu & tanggal sebelum hari ini) TIDAK BOLEH mengunci form hari ini.
 * 2. Pada pergantian hari / reload, fungsi resetStatusIzinHarianJikaPerlu membersihkan status_izin dan last_submission yang kedaluwarsa.
 * 3. bukaKunciFormPengajuanSiswa membuka form (disabled = false) dan mereset tombol menjadi "Kirim Pengajuan Izin".
 * 4. Pengajuan izin hari ini tetap berfungsi normal (terkunci saat pending atau ACC di hari yang sama).
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('================================================================');
console.log('🧪 TEST: AUTO-RESET HARIAN IZIN SISWA (DAILY PERMIT ROLLOVER)');
console.log('================================================================\n');

class MockClassList extends Set {
  add(c) { super.add(c); }
  remove(c) { super.delete(c); }
  contains(c) { return super.has(c); }
}

class MockElement {
  constructor(id = '', tagName = 'div') {
    this.id = id;
    this.tagName = tagName.toUpperCase();
    this.value = '';
    this.textContent = '';
    this.innerHTML = '';
    this.style = {};
    this.classList = new MockClassList();
    this.files = [];
    this.disabled = false;
    this.title = '';
    this.children = [];
  }
  appendChild(el) {
    this.children.push(el);
    return el;
  }
  addEventListener() {}
  removeEventListener() {}
}

const domElements = {};
function getOrCreateElem(id, tagName = 'div') {
  if (!domElements[id]) domElements[id] = new MockElement(id, tagName);
  return domElements[id];
}

const mockLocalStorage = {
  store: {},
  getItem(k) { return this.store[k] || null; },
  setItem(k, v) { this.store[k] = String(v); },
  removeItem(k) { delete this.store[k]; },
  clear() { this.store = {}; }
};

const mockDocument = {
  getElementById: (id) => getOrCreateElem(id),
  querySelector: (sel) => {
    if (sel.startsWith('#')) return getOrCreateElem(sel.slice(1));
    return new MockElement();
  },
  querySelectorAll: () => [],
  createElement: (tag) => new MockElement('', tag),
  addEventListener: () => {},
  removeEventListener: () => {},
  body: new MockElement('body')
};

const mockWindow = {
  localStorage: mockLocalStorage,
  location: { pathname: '/dashboard.html' },
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => {}
};

const sandbox = {
  console,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  Date,
  Math,
  String,
  Number,
  Boolean,
  Array,
  Object,
  JSON,
  RegExp,
  Set,
  Map,
  window: mockWindow,
  document: mockDocument,
  localStorage: mockLocalStorage,
  sessionStorage: mockLocalStorage,
  currentUser: {
    role: 'siswa',
    nisn: '0098263610',
    nama: 'M. IHSAN ATHALLAH',
    kelas: 'XII RPL 2'
  },
  db: {
    ref: () => ({
      once: () => Promise.resolve({ exists: () => false, val: () => null }),
      on: () => {},
      off: () => {},
      set: () => Promise.resolve(),
      update: () => Promise.resolve(),
      push: () => ({ key: 'mock-key', set: () => Promise.resolve() }),
      orderByChild: () => ({
        equalTo: () => ({
          on: () => {},
          once: () => Promise.resolve({ exists: () => false, val: () => null })
        })
      })
    })
  }
};
sandbox.global = sandbox;
sandbox.globalThis = sandbox;

const context = vm.createContext(sandbox);

const perijinanCode = fs.readFileSync(path.join(__dirname, '../assets/perijinan.js'), 'utf8');
vm.runInContext(perijinanCode, context);

const dashboardCode = fs.readFileSync(path.join(__dirname, '../assets/dashboard.js'), 'utf8');
vm.runInContext(dashboardCode, context);

async function runTests() {
  const btnSubmit = getOrCreateElem('btnSubmitPerijinan');
  const msgEl = getOrCreateElem('perijinanMsg');
  const selSiswa = getOrCreateElem('ijinSiswa');
  selSiswa.value = '0098263610';

  const userSiswa = {
    role: 'siswa',
    nisn: '0098263610',
    nama: 'M. IHSAN ATHALLAH',
    kelas: 'XII RPL 2'
  };

  mockLocalStorage.setItem('user_aktif', JSON.stringify(userSiswa));
  mockLocalStorage.setItem('session_user', JSON.stringify(userSiswa));
  mockLocalStorage.setItem('siswa_aktif', JSON.stringify(userSiswa));

  // Kasus 1: Siswa memiliki cache izin ACC dari hari lampau (misal 2026-10-29)
  console.log('▶ [Kasus 1] Cache izin lampau (2026-10-29) harus direset otomatis...');
  mockLocalStorage.setItem('status_izin_0098263610', 'disetujui');
  mockLocalStorage.setItem('last_submission_0098263610', JSON.stringify({
    nisn: '0098263610',
    tanggal: '2026-10-29',
    timestamp: Date.now() - (6 * 24 * 3600 * 1000), // 6 hari lalu
    status: 'disetujui'
  }));

  // Jalankan reset harian
  const direset = context.resetStatusIzinHarianJikaPerlu('0098263610');
  assert.strictEqual(direset, true, 'resetStatusIzinHarianJikaPerlu harus mengembalikan true saat membersihkan status lampau');
  assert.strictEqual(mockLocalStorage.getItem('status_izin_0098263610'), null, 'status_izin lampau harus dihapus dari localStorage');
  assert.strictEqual(mockLocalStorage.getItem('last_submission_0098263610'), null, 'last_submission lampau harus dihapus');
  assert.strictEqual(btnSubmit.disabled, false, 'Tombol pengajuan izin harus dibuka kembali');
  assert.strictEqual(btnSubmit.textContent, 'Kirim Pengajuan Izin', 'Teks tombol harus kembali "Kirim Pengajuan Izin"');
  console.log('  ✔ Cache izin lampau berhasil direset.');

  // Kasus 2: Local data hanya memiliki data izin lampau (2026-10-29)
  console.log('\n▶ [Kasus 2] Filter izin disetujui aktif mengabaikan izin dari hari lampau...');
  mockLocalStorage.setItem('local_perijinan', JSON.stringify([{
    nisn: '0098263610',
    nama: 'M. IHSAN ATHALLAH',
    kelas: 'XII RPL 2',
    jenis: 'IZIN',
    status: 'disetujui',
    tanggal: '2026-10-29',
    dibuat_pada: Date.now() - (6 * 24 * 3600 * 1000)
  }]));

  const izinAktif = context.ambilIzinDisetujuiAktifSiswa('0098263610');
  assert.strictEqual(izinAktif, null, 'Izin disetujui dari hari lampau harus diabaikan (return null)');

  // Verifikasi bukaKunciFormPengajuanSiswa dengan kondisi ini
  context.bukaKunciFormPengajuanSiswa(null, userSiswa);
  assert.strictEqual(btnSubmit.disabled, false, 'Form TIDAK BOLEH terkunci oleh izin hari lampau');
  assert.strictEqual(btnSubmit.textContent, 'Kirim Pengajuan Izin', 'Tombol harus tetap aktif untuk hari baru');
  console.log('  ✔ Data hari lampau tidak mengunci form siswa hari ini.');

  // Kasus 3: Pengajuan baru hari ini berstatus disetujui
  console.log('\n▶ [Kasus 3] Izin disetujui hari ini tetap mengunci form secara benar...');
  const tglHariIni = context.tanggalHariIni();
  mockLocalStorage.setItem('status_izin_0098263610', 'disetujui');
  mockLocalStorage.setItem('local_perijinan', JSON.stringify([{
    nisn: '0098263610',
    nama: 'M. IHSAN ATHALLAH',
    kelas: 'XII RPL 2',
    jenis: 'IZIN',
    status: 'disetujui',
    tanggal: tglHariIni,
    dibuat_pada: Date.now()
  }]));

  const izinHariIni = context.ambilIzinDisetujuiAktifSiswa('0098263610');
  assert.notStrictEqual(izinHariIni, null, 'Izin disetujui hari ini harus terdeteksi');
  assert.strictEqual(izinHariIni.status, 'disetujui');

  context.bukaKunciFormPengajuanSiswa(null, userSiswa);
  assert.strictEqual(btnSubmit.disabled, true, 'Form HARUS terkunci saat ada izin ACC hari ini');
  assert.strictEqual(btnSubmit.textContent, 'Izin Telah Disetujui Resmi (Terkunci)', 'Label tombol harus terkunci');
  console.log('  ✔ Izin hari ini berhasil mengunci form secara presisi.');

  // Kasus 4: Pengajuan hari ini berstatus pending (anti-double-send)
  console.log('\n▶ [Kasus 4] Pengajuan pending hari ini mengunci tombol pending...');
  mockLocalStorage.setItem('status_izin_0098263610', 'pending');
  mockLocalStorage.setItem('local_perijinan', JSON.stringify([{
    nisn: '0098263610',
    nama: 'M. IHSAN ATHALLAH',
    kelas: 'XII RPL 2',
    jenis: 'IZIN',
    status: 'pending',
    tanggal: tglHariIni,
    dibuat_pada: Date.now()
  }]));

  const izinPending = context.ambilIzinPendingAktifSiswa('0098263610');
  assert.notStrictEqual(izinPending, null, 'Izin pending hari ini harus terdeteksi');

  context.populateDropdownSiswa(userSiswa);
  assert.strictEqual(btnSubmit.disabled, true, 'Tombol harus terkunci saat ada pengajuan pending hari ini');
  assert.strictEqual(btnSubmit.textContent, 'Menunggu Konfirmasi Wali Kelas...', 'Label tombol harus menunjukkan sedang diproses');
  console.log('  ✔ Pengajuan pending hari ini mengunci tombol dengan benar.');

  console.log('\n================================================================');
  console.log('🎉 SELURUH SKENARIO AUTO-RESET HARIAN IZIN LULUS 100%!');
  console.log('================================================================\n');
}

runTests().catch(err => {
  console.error('❌ GAGAL PENGUJIAN:', err);
  process.exit(1);
});
