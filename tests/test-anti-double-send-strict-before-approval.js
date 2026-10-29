/**
 * test-anti-double-send-strict-before-approval.js
 * Memverifikasi skenario nyata:
 * Siswa dilarang mengirim izin kedua sebelum izin pertama di-ACC atau ditolak oleh Wali Kelas.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('================================================================');
console.log('🧪 PENGUJIAN KETAT: ANTI DOUBLE-SEND SEBELUM ACC / PENOLAKAN');
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
  addEventListener() {}
  removeEventListener() {}
  appendChild(el) {
    this.children.push(el);
    return el;
  }
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
  window: { localStorage: mockLocalStorage, location: { pathname: '/dashboard.html' }, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => {} },
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

const guruCode = fs.readFileSync(path.join(__dirname, '../assets/dashboard-guru.js'), 'utf8');
vm.runInContext(guruCode, context);

async function runTests() {
  const btnSubmit = getOrCreateElem('btnSubmitPerijinan');
  const msgEl = getOrCreateElem('perijinanMsg');
  const selSiswa = getOrCreateElem('perijinanSiswaTarget');
  selSiswa.value = '0098263610';

  const userIhsan = {
    role: 'siswa',
    nisn: '0098263610',
    nama: 'M. IHSAN ATHALLAH',
    kelas: 'XII RPL 2'
  };

  const userWalas = {
    uid: 'UID_ECHA_199209142022211007',
    nip: '199209142022211007',
    nama: 'Muhammad Echa Putra, S.Kom.Gr',
    email: 'ihsan33roblox@gmail.com',
    role: 'walas',
    isWalas: true,
    walasKelasId: 'XII RPL 2'
  };

  mockLocalStorage.setItem('user_aktif', JSON.stringify(userIhsan));
  mockLocalStorage.setItem('session_user', JSON.stringify(userIhsan));
  mockLocalStorage.setItem('siswa_aktif', JSON.stringify(userIhsan));

  // -------------------------------------------------------------
  // Test Case 1: Siswa mengirim izin pertama ("asd")
  // -------------------------------------------------------------
  console.log('▶ [Kasus 1] Siswa submit pengajuan izin pertama ("asd")...');
  getOrCreateElem('perijinanJenis').value = 'izin';
  getOrCreateElem('perijinanTanggal').value = '2026-10-29';
  getOrCreateElem('perijinanAlasan').value = 'asd';
  getOrCreateElem('fotoSurat').files = [{ name: 'surat1.jpg', size: 1024, type: 'image/jpeg' }];

  await context.handleSubmitPerijinan();

  assert.strictEqual(btnSubmit.disabled, true, 'Tombol submit HARUS LANGSUNG TERKUNCI setelah submit pertama');
  assert.strictEqual(btnSubmit.textContent, 'Menunggu Konfirmasi Wali Kelas...', 'Label tombol harus Menunggu Konfirmasi');
  console.log('  ✓ Tombol submit TERKUNCI ("Menunggu Konfirmasi Wali Kelas...")\n');

  // -------------------------------------------------------------
  // Test Case 2: Siswa mencoba submit izin KEDUA sebelum di-ACC/Tolak -> DITOLAK
  // -------------------------------------------------------------
  console.log('▶ [Kasus 2] Siswa mencoba kirim izin kedua sebelum izin pertama diproses...');
  getOrCreateElem('perijinanAlasan').value = 'asd lagi mau coba submit lagi';
  getOrCreateElem('fotoSurat').files = [{ name: 'surat2.jpg', size: 1024, type: 'image/jpeg' }];

  await context.handleSubmitPerijinan();

  assert.strictEqual(btnSubmit.disabled, true, 'Tombol submit HARUS TETAP TERKUNCI');
  assert.ok(msgEl.innerHTML.includes('Dibatasi') || msgEl.innerHTML.includes('menunggu konfirmasi'), 'Pesan blokir pending harus muncul');
  console.log('  ✓ Sistem menolak tegas pengajuan kedua saat masih pending (Anti Double-Send bekerja sempurna)\n');

  // -------------------------------------------------------------
  // Test Case 3: Wali Kelas menolak izin pertama -> Form Terbuka Kembali
  // -------------------------------------------------------------
  console.log('▶ [Kasus 3] Wali Kelas menolak permohonan...');
  context.ambilUserAktifGuru = () => userWalas;
  context.guruAktif = userWalas;
  context.prompt = () => 'Surat kurang jelas, mohon foto ulang';

  const pendingItem = context.ambilIzinPendingAktifSiswa('0098263610');
  assert.ok(pendingItem, 'Item pending harus terdeteksi');

  context.muatPerizinanSiswaWalas();
  await context.prosesApprovalIzin(pendingItem.id || pendingItem.pid, 'ditolak');

  context.populateDropdownSiswa(userIhsan);
  assert.strictEqual(btnSubmit.disabled, false, 'Tombol submit harus terbuka kembali setelah ditolak');
  assert.strictEqual(btnSubmit.textContent, 'Kirim Pengajuan Izin', 'Label tombol kembali Kirim Pengajuan Izin');
  assert.ok(msgEl.innerHTML.includes('Pengajuan Izin Telah Ditolak'), 'Banner penolakan merah harus tampil');
  console.log('  ✓ Tombol submit TERBUKA KEMBALI ("Kirim Pengajuan Izin") setelah ditolak\n');

  // -------------------------------------------------------------
  // Test Case 4: Siswa mengirimkan permohonan baru setelah ditolak -> Berhasil & Terkunci
  // -------------------------------------------------------------
  console.log('▶ [Kasus 4] Siswa submit pengajuan baru yang sudah diperbaiki...');
  getOrCreateElem('perijinanAlasan').value = 'Surat dokter yang sudah jelas';
  getOrCreateElem('fotoSurat').files = [{ name: 'surat_jelas.jpg', size: 1024, type: 'image/jpeg' }];

  await context.handleSubmitPerijinan();

  assert.strictEqual(btnSubmit.disabled, true, 'Tombol submit harus kembali terkunci setelah submit baru');
  assert.strictEqual(btnSubmit.textContent, 'Menunggu Konfirmasi Wali Kelas...', 'Label tombol harus Menunggu Konfirmasi');
  console.log('  ✓ Pengajuan baru berhasil terkirim dan form kembali TERKUNCI.\n');

  console.log('================================================================');
  console.log('🎉 SEMUA PENGUJIAN ANTI DOUBLE-SEND SEBELUM ACC/TOLAK LULUS 100%!');
  console.log('================================================================');
}

runTests().catch(err => {
  console.error('❌ Gagal dalam pengujian:', err);
  process.exit(1);
});
