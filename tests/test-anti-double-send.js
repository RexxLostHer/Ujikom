const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('================================================================');
console.log('🧪 PENGUJIAN FITUR ANTI DOUBLE-SEND & PRESERVASI STATUS WALAS');
console.log('================================================================\n');

// Mock DOM
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
  addEventListener(event, fn) {}
  removeEventListener(event, fn) {}
}

const domElements = {};
function getOrCreateElem(id, tagName = 'div') {
  if (!domElements[id]) domElements[id] = new MockElement(id, tagName);
  return domElements[id];
}

const mockDocument = {
  getElementById: (id) => getOrCreateElem(id),
  querySelectorAll: () => [],
  createElement: (tag) => new MockElement('', tag),
  addEventListener: () => {},
  removeEventListener: () => {},
  body: new MockElement('body')
};

const mockLocalStorage = {
  store: {},
  getItem(k) { return this.store[k] || null; },
  setItem(k, v) { this.store[k] = String(v); },
  removeItem(k) { delete this.store[k]; },
  clear() { this.store = {}; }
};

const mockDb = {
  ref(p) {
    return {
      set: async () => true,
      update: async () => true,
      push: () => ({ key: 'MOCK_KEY_' + Date.now(), set: async () => true }),
      once: async () => ({ val: () => ({}) }),
      on: () => {},
      off: () => {}
    };
  }
};

const context = {
  document: mockDocument,
  window: {
    addEventListener: () => {},
    dispatchEvent: () => {},
    location: { pathname: '/dashboard.html' }
  },
  localStorage: mockLocalStorage,
  sessionStorage: mockLocalStorage,
  db: mockDb,
  console: console,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  Date: Date,
  JSON: JSON,
  Math: Math,
  String: String,
  Array: Array,
  Object: Object,
  Set: Set,
  Promise: Promise,
  FileReader: class {
    readAsDataURL() { this.onload && this.onload({ target: { result: 'data:image/jpeg;base64,mock' } }); }
  }
};

vm.createContext(context);

// Load configs & scripts
const fbConfigCode = fs.readFileSync(path.join(__dirname, '..', 'assets', 'firebase-config.js'), 'utf8');
const perijinanCode = fs.readFileSync(path.join(__dirname, '..', 'assets', 'perijinan.js'), 'utf8');
const dashCode = fs.readFileSync(path.join(__dirname, '..', 'assets', 'dashboard.js'), 'utf8');
const guruCode = fs.readFileSync(path.join(__dirname, '..', 'assets', 'dashboard-guru.js'), 'utf8');

vm.runInContext(fbConfigCode, context);
vm.runInContext(perijinanCode, context);
vm.runInContext(dashCode, context);
vm.runInContext(guruCode, context);

async function runTests() {
  const userIhsan = {
    uid: 'UID_0098263610',
    nisn: '0098263610',
    nama: 'M. IHSAN ATHALLAH',
    kelas: 'XII RPL 2',
    role: 'siswa'
  };

  mockLocalStorage.setItem('user_aktif', JSON.stringify(userIhsan));
  mockLocalStorage.setItem('session_user', JSON.stringify(userIhsan));
  context.currentUser = userIhsan;
  context.getSessionUser = () => userIhsan;

  // -------------------------------------------------------------------------
  // TEST 1: Kondisi Awal (Belum ada izin) -> Form Harus Terbuka
  // -------------------------------------------------------------------------
  console.log('▶ [Test 1] Kondisi awal tanpa izin pending: Form harus terbuka & aktif...');
  mockLocalStorage.clear();
  mockLocalStorage.setItem('user_aktif', JSON.stringify(userIhsan));
  mockLocalStorage.setItem('session_user', JSON.stringify(userIhsan));
  mockLocalStorage.setItem('local_perizinan', '[]');
  mockLocalStorage.setItem('local_perijinan', '[]');
  mockLocalStorage.setItem('daftar_perizinan_lokal', '[]');
  context.allPerizinanData = {};
  await context.populateDropdownSiswa();

  const btnSubmit = domElements['btnSubmitPerijinan'];
  const msgEl = domElements['perijinanMsg'];
  assert.strictEqual(btnSubmit.disabled, false, 'Tombol submit harus aktif');
  assert.strictEqual(btnSubmit.textContent, 'Kirim Pengajuan Izin', 'Label tombol harus "Kirim Pengajuan Izin"');
  console.log('  ✓ Form terbuka dan tombol submit aktif untuk pengajuan pertama.\n');

  // -------------------------------------------------------------------------
  // TEST 2: Siswa Mengajukan Izin Pertama -> Masuk Status Pending
  // -------------------------------------------------------------------------
  console.log('▶ [Test 2] Siswa submit izin pertama -> Masuk ke antrean lokal & pending...');
  getOrCreateElem('perijinanJenis').value = 'izin';
  getOrCreateElem('perijinanTanggal').value = '2026-10-25';
  getOrCreateElem('perijinanAlasan').value = 'Ada urusan keluarga penting.';
  getOrCreateElem('fotoSurat').files = [{ name: 'bukti.jpg', size: 1024, type: 'image/jpeg' }];

  await context.handleSubmitPerijinan();

  const pendingCheck1 = context.ambilIzinPendingAktifSiswa('0098263610');
  assert.ok(pendingCheck1, 'Izin pending harus ditemukan');
  assert.strictEqual(pendingCheck1.status, 'pending', 'Status izin harus pending');
  console.log('  ✓ Izin pertama berhasil diajukan dengan status pending.\n');

  // -------------------------------------------------------------------------
  // TEST 3: Anti Double-Send -> Form Terkunci & Menolak Pengajuan Kedua
  // -------------------------------------------------------------------------
  console.log('▶ [Test 3] Anti Double-Send: Form terkunci & submit kedua ditolak tegas...');
  await context.populateDropdownSiswa();
  assert.strictEqual(btnSubmit.disabled, true, 'Tombol submit harus dikunci (disabled)');
  assert.strictEqual(btnSubmit.textContent, 'Menunggu Konfirmasi Wali Kelas...', 'Label tombol harus menandakan sedang menunggu konfirmasi');
  assert.ok(msgEl.innerHTML.includes('Pengajuan Izin Sedang Menunggu Konfirmasi'), 'Pesan peringatan anti double-send harus muncul');

  // Coba paksa submit kedua
  getOrCreateElem('perijinanAlasan').value = 'Mencoba kirim dobel izin.';
  await context.handleSubmitPerijinan();
  assert.ok(msgEl.innerHTML.includes('Anti Double-Send'), 'Pesan blokir Anti Double-Send harus ditampilkan');
  console.log('  ✓ Proteksi Anti Double-Send sukses: Pengajuan ganda berhasil dicegah 100%.\n');

  // -------------------------------------------------------------------------
  // TEST 4: Walas Menolak Izin -> Izin Pindah ke Tab Ditolak & Tidak Reset
  // -------------------------------------------------------------------------
  console.log('▶ [Test 4] Wali Kelas menolak izin -> Status menjadi ditolak...');
  context.window.location.pathname = '/dashboard-guru.html';
  const userPakEcha = {
    uid: 'UID_ECHA_199209142022211007',
    nip: '199209142022211007',
    nama: 'Muhammad Echa Putra, S.Kom.Gr',
    email: 'ihsan33roblox@gmail.com',
    role: 'walas',
    isWalas: true,
    walasKelasId: 'XII RPL 2'
  };
  context.ambilUserAktifGuru = () => userPakEcha;
  context.guruAktif = userPakEcha;

  // Muat data di Walas
  context.muatPerizinanSiswaWalas();
  const pidIhsan = pendingCheck1.id || pendingCheck1.pid;
  context.prompt = () => 'Bukti foto kurang jelas, silakan ajukan ulang';
  await context.prosesApprovalIzin(pidIhsan, 'ditolak');

  // Cek tab pending Walas
  context.filterIzinGuru('pending');
  const emptyContainer = getOrCreateElem('listApprovalIzin');
  assert.ok(
    emptyContainer.innerHTML.includes('Tidak ada pengajuan izin yang menunggu persetujuan'),
    'Tab pending harus kosong setelah ditolak'
  );
  assert.ok(
    emptyContainer.innerHTML.includes('Lihat Tab Izin Ditolak'),
    'Pintasan ke tab Ditolak harus muncul di empty state'
  );

  // Verifikasi pemanggilan pulihkanIzinIhsanWalas TIDAK mereset status penolakan
  context.pulihkanIzinIhsanWalas();
  assert.strictEqual(
    mockLocalStorage.getItem('status_izin_0098263610'),
    'ditolak',
    'Status penolakan tidak boleh ter-reset kembali ke pending'
  );
  console.log('  ✓ Status ditolak konsisten tersimpan dan shortcut navigasi tersedia.\n');

  // -------------------------------------------------------------------------
  // TEST 5: Siswa Membuka Form Pasca-Penolakan -> Form Otomatis Terbuka Kembali
  // -------------------------------------------------------------------------
  console.log('▶ [Test 5] Siswa membuka form setelah izin ditolak: Form harus otomatis terbuka...');
  context.window.location.pathname = '/dashboard.html';
  context.currentUser = userIhsan;
  await context.populateDropdownSiswa();

  assert.strictEqual(btnSubmit.disabled, false, 'Tombol submit harus aktif kembali setelah izin sebelumnya ditolak');
  assert.strictEqual(btnSubmit.textContent, 'Kirim Pengajuan Izin', 'Tombol kembali menampilkan "Kirim Pengajuan Izin"');
  console.log('  ✓ Form siswa otomatis terbuka kembali setelah izin ditolak.\n');

  // -------------------------------------------------------------------------
  // TEST 6: Siswa Mengajukan Izin Baru Pasca-Penolakan -> Masuk Berhasil
  // -------------------------------------------------------------------------
  console.log('▶ [Test 6] Siswa mengirimkan permohonan izin baru setelah penolakan...');
  getOrCreateElem('perijinanJenis').value = 'izin';
  getOrCreateElem('perijinanTanggal').value = '2026-10-25';
  getOrCreateElem('perijinanAlasan').value = 'Mengajukan izin ulang dengan alasan yang lebih lengkap.';
  getOrCreateElem('fotoSurat').files = [{ name: 'bukti_baru.jpg', size: 2048, type: 'image/jpeg' }];

  await context.handleSubmitPerijinan();

  const pendingCheck2 = context.ambilIzinPendingAktifSiswa('0098263610');
  assert.ok(pendingCheck2, 'Izin baru harus berhasil diajukan');
  assert.strictEqual(pendingCheck2.status, 'pending', 'Izin baru harus berstatus pending');
  assert.notStrictEqual(pendingCheck2.id, pidIhsan, 'Izin baru harus memiliki Unique ID berbeda dari izin yang ditolak');
  console.log('  ✓ Pengajuan izin baru berhasil dibuat dan masuk antrean.\n');

  console.log('================================================================');
  console.log('🎉 SEMUA PENGUJIAN ANTI DOUBLE-SEND & STATUS WALAS SUKSES 100%!');
  console.log('================================================================');
}

runTests().catch(err => {
  console.error('TEST ERROR:', err);
  process.exit(1);
});
