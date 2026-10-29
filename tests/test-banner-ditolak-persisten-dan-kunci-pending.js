/**
 * test-banner-ditolak-persisten-dan-kunci-pending.js
 * Memverifikasi:
 * 1. Banner penolakan tidak hilang sekilas saat Walas menolak permohonan.
 * 2. PopulateDropdownSiswa tidak menghapus banner merah penolakan.
 * 3. Saat siswa submit izin baru, tombol submit langsung terkunci "Menunggu Konfirmasi Wali Kelas..."
 *    dan tidak terbuka kembali di blok finally.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('================================================================');
console.log('🧪 PENGUJIAN BANNER DITOLAK PERSISTEN & KUNCI SUBMIT PENDING');
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

  mockLocalStorage.setItem('user_aktif', JSON.stringify(userIhsan));
  mockLocalStorage.setItem('session_user', JSON.stringify(userIhsan));
  mockLocalStorage.setItem('siswa_aktif', JSON.stringify(userIhsan));

  // 1. Verifikasi Banner Ditolak Persisten (tidak hilang sekilas saat populateDropdownSiswa)
  console.log('▶ [Kasus 1] Wali Kelas menolak izin siswa...');
  mockLocalStorage.setItem('status_izin_0098263610', 'ditolak');
  mockLocalStorage.setItem('last_submission_0098263610', JSON.stringify({
    nisn: '0098263610',
    nama: 'M. IHSAN ATHALLAH',
    status: 'ditolak',
    tanggal: '2026-10-29',
    jenis: 'sakit',
    alasanTolak: 'Surat dokter buram, harap kirim ulang'
  }));

  // Panggil bukaKunciFormPengajuanSiswa
  context.bukaKunciFormPengajuanSiswa({
    status: 'ditolak',
    alasanTolak: 'Surat dokter buram, harap kirim ulang'
  }, userIhsan);

  assert.strictEqual(btnSubmit.disabled, false, 'Tombol submit harus aktif setelah ditolak');
  assert.ok(msgEl.innerHTML.includes('Pengajuan Izin Telah Ditolak'), 'Banner merah penolakan harus tampil');
  console.log('  ✓ Banner merah penolakan berhasil ditampilkan');

  // Panggil populateDropdownSiswa berkali-kali (mensimulasikan event bus/storage)
  context.populateDropdownSiswa(userIhsan);
  context.populateDropdownSiswa(userIhsan);

  assert.strictEqual(btnSubmit.disabled, false, 'Tombol submit tetap aktif');
  assert.ok(msgEl.innerHTML.includes('Pengajuan Izin Telah Ditolak'), 'Banner penolakan TIDAK BOLEH HILANG sekilas!');
  assert.ok(msgEl.innerHTML.includes('Surat dokter buram'), 'Alasan penolakan tetap tercantum di layar');
  console.log('  ✓ Banner penolakan terbukti PERSISTEN dan TIDAK HILANG sekilas saat re-render.\n');

  // 2. Verifikasi Submit Izin Baru -> Tombol Submit Otomatis Terkunci (Pending)
  console.log('▶ [Kasus 2] Siswa submit pengajuan perbaikan baru...');
  getOrCreateElem('perijinanJenis').value = 'izin';
  getOrCreateElem('perijinanTanggal').value = '2026-10-29';
  getOrCreateElem('perijinanAlasan').value = 'Permohonan ulang dengan surat yang jelas';
  getOrCreateElem('fotoSurat').files = [{ name: 'surat_jelas.jpg', size: 1024, type: 'image/jpeg' }];

  await context.handleSubmitPerijinan();

  assert.strictEqual(btnSubmit.disabled, true, 'Tombol submit HARUS TERKUNCI setelah submit');
  assert.strictEqual(btnSubmit.textContent, 'Menunggu Konfirmasi Wali Kelas...', 'Label tombol harus Menunggu Konfirmasi');
  assert.strictEqual(mockLocalStorage.getItem('status_izin_0098263610'), 'pending', 'Status izin lokal harus menjadi pending');
  console.log('  ✓ Tombol submit LANGSUNG TERKUNCI ("Menunggu Konfirmasi...") dan TIDAK BISA diklik lagi.');

  console.log('\n================================================================');
  console.log('🎉 PENGUJIAN BANNER PERSISTEN & KUNCI SUBMIT PENDING SUKSES 100%!');
  console.log('================================================================');
}

runTests().catch(err => {
  console.error('❌ Gagal dalam pengujian:', err);
  process.exit(1);
});
