/**
 * Test Suite: Kunci Form Pengajuan Izin Saat ACC dan Buka Kunci Saat Ditolak
 * 
 * Verifikasi spesifik:
 * 1. Saat siswa memiliki izin berstatus 'disetujui' (ACC) -> Form pengajuan TERKUNCI (disabled = true).
 * 2. Label tombol submit berubah menjadi "Izin Telah Disetujui Resmi (Terkunci)".
 * 3. Siswa tidak dapat mengajukan izin / keluhan lagi selama izin berstatus ACC.
 * 4. Saat izin siswa ditolak oleh Wali Kelas / Admin -> Form DIBUKA KEMBALI (disabled = false).
 * 5. Label tombol submit kembali menjadi "Kirim Pengajuan Izin" dan siswa dapat submit pengajuan baru.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('================================================================');
console.log('🧪 TEST KHUSUS: KUNCI FORM SAAT DI-ACC & BUKA SAAT DITOLAK');
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
    kelas: 'XII RPL 1'
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

// Muat dashboard.js
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
    kelas: 'XII RPL 1'
  };

  mockLocalStorage.setItem('user_aktif', JSON.stringify(userSiswa));
  mockLocalStorage.setItem('session_user', JSON.stringify(userSiswa));
  mockLocalStorage.setItem('siswa_aktif', JSON.stringify(userSiswa));

  // Test 1: Kondisi Normal
  console.log('▶ [Kasus 1] Kondisi awal tanpa pengajuan izin...');
  mockLocalStorage.setItem('user_aktif', JSON.stringify(userSiswa));
  mockLocalStorage.setItem('session_user', JSON.stringify(userSiswa));
  mockLocalStorage.setItem('siswa_aktif', JSON.stringify(userSiswa));
  await context.populateDropdownSiswa(userSiswa);
  assert.strictEqual(btnSubmit.disabled, false, 'Tombol harus aktif saat tidak ada izin');
  assert.strictEqual(btnSubmit.textContent, 'Kirim Pengajuan Izin');
  console.log('  ✓ Tombol aktif ("Kirim Pengajuan Izin")\n');

  // Test 2: Izin Disetujui (ACC) -> Form Terkunci
  console.log('▶ [Kasus 2] Siswa memiliki izin yang telah di-ACC...');
  mockLocalStorage.setItem('status_izin_0098263610', 'disetujui');
  mockLocalStorage.setItem('local_perijinan', JSON.stringify([{
    nisn: '0098263610',
    nama: 'M. IHSAN ATHALLAH',
    status: 'disetujui',
    tanggal: '2026-10-29',
    catatan_guru: 'Di-ACC oleh Admin'
  }]));

  await context.populateDropdownSiswa(userSiswa);
  assert.strictEqual(btnSubmit.disabled, true, 'Tombol harus terkunci saat izin sudah di-ACC');
  assert.strictEqual(btnSubmit.textContent, 'Izin Telah Disetujui Resmi (Terkunci)');
  console.log('  ✓ Tombol TERKUNCI dengan label "Izin Telah Disetujui Resmi (Terkunci)"\n');

  // Test 3: Siswa mencoba submit saat status sudah di-ACC -> Ditolak
  console.log('▶ [Kasus 3] Siswa mencoba kirim izin / kendala saat izin sudah di-ACC...');
  let prevented = false;
  await context.handleSubmitPerijinan({ preventDefault: () => { prevented = true; } });
  assert.ok(msgEl.innerHTML.toLowerCase().includes('disetujui resmi'), 'Pesan error harus memberi tahu izin sudah disetujui resmi');
  assert.strictEqual(btnSubmit.disabled, true, 'Tombol harus tetap terkunci');
  console.log('  ✓ Sistem menolak tegas pengajuan baru jika izin telah di-ACC\n');

  // Test 4: Walas / Admin Menolak Izin -> Form Terbuka Kembali
  console.log('▶ [Kasus 4] Walas / Admin menolak izin siswa...');
  mockLocalStorage.setItem('status_izin_0098263610', 'ditolak');
  mockLocalStorage.setItem('local_perijinan', JSON.stringify([{
    nisn: '0098263610',
    nama: 'M. IHSAN ATHALLAH',
    status: 'ditolak',
    tanggal: '2026-10-29',
    alasanTolak: 'Surat dokter buram, mohon lampirkan ulang yang jelas'
  }]));

  context.bukaKunciFormPengajuanSiswa({
    status: 'ditolak',
    alasanTolak: 'Surat dokter buram, mohon lampirkan ulang yang jelas'
  }, userSiswa);

  assert.strictEqual(btnSubmit.disabled, false, 'Tombol harus kembali aktif saat ditolak');
  assert.strictEqual(btnSubmit.textContent, 'Kirim Pengajuan Izin');
  assert.ok(msgEl.innerHTML.includes('Pengajuan Izin Telah Ditolak'), 'Banner penolakan merah harus muncul');
  assert.ok(msgEl.innerHTML.includes('Surat dokter buram'), 'Alasan penolakan harus tercantum');
  console.log('  ✓ Tombol TERBUKA KEMBALI ("Kirim Pengajuan Izin") saat izin ditolak');
  console.log('  ✓ Siswa sekarang dapat mengirimkan perbaikan izin\n');

  console.log('================================================================');
  console.log('🎉 SEMUA ATURAN KUNCI SAAT ACC & BUKA SAAT DITOLAK LULUS 100%!');
  console.log('================================================================');
}

runTests().catch(err => {
  console.error('❌ Gagal dalam pengujian:', err);
  process.exit(1);
});
