const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('================================================================');
console.log('🧪 PENGUJIAN SINKRONISASI REALTIME APPROVAL / PENOLAKAN KE FORM SISWA');
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
  addEventListener() {}
  removeEventListener() {}
}

const domElements = {};
function getOrCreateElem(id, tagName = 'div') {
  if (!domElements[id]) domElements[id] = new MockElement(id, tagName);
  return domElements[id];
}

const eventListeners = {};
const mockWindow = {
  addEventListener(event, fn) {
    if (!eventListeners[event]) eventListeners[event] = [];
    eventListeners[event].push(fn);
  },
  removeEventListener(event, fn) {
    if (!eventListeners[event]) return;
    eventListeners[event] = eventListeners[event].filter(f => f !== fn);
  },
  dispatchEvent(evt) {
    const list = eventListeners[evt.type] || [];
    list.forEach(fn => fn(evt));
  },
  location: { pathname: '/dashboard.html' }
};

const mockDocument = {
  getElementById: (id) => getOrCreateElem(id),
  querySelector: (sel) => {
    if (sel.startsWith('#')) return getOrCreateElem(sel.slice(1));
    return new MockElement();
  },
  querySelectorAll: () => [],
  createElement: (tag) => new MockElement('', tag),
  addEventListener: (event, fn) => mockWindow.addEventListener(event, fn),
  removeEventListener: (event, fn) => mockWindow.removeEventListener(event, fn),
  body: new MockElement('body')
};

const mockLocalStorage = {
  store: {},
  getItem(k) { return this.store[k] || null; },
  setItem(k, v) { this.store[k] = String(v); },
  removeItem(k) { delete this.store[k]; },
  clear() { this.store = {}; }
};

// Mock RTDB Realtime Node Bus
const rtdbStore = {
  perijinan: {},
  perizinan: {}
};
const rtdbListeners = [];

const mockDb = {
  ref(p) {
    const pathStr = p || '';
    return {
      set: async (val) => {
        if (pathStr.startsWith('perijinan/') || pathStr.startsWith('perizinan/')) {
          const parts = pathStr.split('/');
          const node = parts[0];
          const id = parts[1];
          rtdbStore[node][id] = val;
          rtdbListeners.forEach(l => l({ val: () => rtdbStore['perijinan'] }));
        }
        return true;
      },
      update: async (val) => {
        if (pathStr.startsWith('perijinan/') || pathStr.startsWith('perizinan/')) {
          const parts = pathStr.split('/');
          const node = parts[0];
          const id = parts[1];
          rtdbStore[node][id] = Object.assign({}, rtdbStore[node][id] || {}, val);
          rtdbListeners.forEach(l => l({ val: () => rtdbStore['perijinan'] }));
        }
        return true;
      },
      push: () => {
        const generatedKey = '-OePermit_' + Date.now();
        return {
          key: generatedKey,
          set: async (val) => {
            rtdbStore['perijinan'][generatedKey] = val;
            rtdbStore['perizinan'][generatedKey] = val;
            rtdbListeners.forEach(l => l({ val: () => rtdbStore['perijinan'] }));
            return true;
          }
        };
      },
      once: async () => ({ val: () => ({}) }),
      on: (ev, fn) => {
        if (ev === 'value') {
          rtdbListeners.push(fn);
          fn({ val: () => rtdbStore['perijinan'] });
        }
      },
      orderByChild: () => ({
        equalTo: () => ({
          on: (ev, fn) => {
            if (ev === 'value') {
              rtdbListeners.push(fn);
              fn({ val: () => rtdbStore['perijinan'] });
            }
          }
        })
      }),
      off: () => {}
    };
  }
};

// Mock BroadcastChannel
const broadcastSubscribers = [];
class MockBroadcastChannel {
  constructor(name) {
    this.name = name;
    broadcastSubscribers.push(this);
  }
  postMessage(data) {
    broadcastSubscribers.forEach(sub => {
      if (sub !== this && sub.name === this.name && typeof sub.onmessage === 'function') {
        sub.onmessage({ data });
      }
    });
  }
  close() {
    const idx = broadcastSubscribers.indexOf(this);
    if (idx !== -1) broadcastSubscribers.splice(idx, 1);
  }
  unref() {}
}

const context = {
  document: mockDocument,
  window: mockWindow,
  localStorage: mockLocalStorage,
  sessionStorage: mockLocalStorage,
  db: mockDb,
  BroadcastChannel: MockBroadcastChannel,
  CustomEvent: class {
    constructor(type, init) {
      this.type = type;
      this.detail = init && init.detail;
    }
  },
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
    readAsDataURL() { this.onload && this.onload({ target: { result: 'data:image/jpeg;base64,mockphoto' } }); }
  }
};

vm.createContext(context);

// Load source files
const fbConfigCode = fs.readFileSync(path.join(__dirname, '..', 'assets', 'firebase-config.js'), 'utf8');
const perijinanCode = fs.readFileSync(path.join(__dirname, '..', 'assets', 'perijinan.js'), 'utf8');
const dashCode = fs.readFileSync(path.join(__dirname, '..', 'assets', 'dashboard.js'), 'utf8');
const guruCode = fs.readFileSync(path.join(__dirname, '..', 'assets', 'dashboard-guru.js'), 'utf8');

vm.runInContext(fbConfigCode, context);
vm.runInContext(perijinanCode, context);
vm.runInContext(dashCode, context);
vm.runInContext(guruCode, context);

// Ensure test mockDb is bound
context.db = mockDb;

async function runTestSuites() {
  const userIhsan = {
    uid: 'UID_0098263610',
    nisn: '0098263610',
    nama: 'M. IHSAN ATHALLAH',
    kelas: 'XII RPL 2',
    role: 'siswa'
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

  context.currentUser = userIhsan;
  context.getSessionUser = () => userIhsan;
  mockLocalStorage.setItem('user_aktif', JSON.stringify(userIhsan));
  mockLocalStorage.setItem('session_user', JSON.stringify(userIhsan));
  context.inisialisasiSinkronisasiPerizinanSiswa(userIhsan);

  const btnSubmit = getOrCreateElem('btnSubmitPerijinan', 'button');
  const msgEl = getOrCreateElem('perijinanMsg', 'div');
  const selTarget = getOrCreateElem('perijinanSiswaTarget', 'select');

  // =========================================================================
  // SKENARIO 1: Pengajuan Izin Pertama oleh Siswa -> Form Terkunci Pending
  // =========================================================================
  console.log('▶ [Skenario 1] Siswa M. Ihsan Athallah mengajukan izin sakit untuk 2026-10-29...');
  mockLocalStorage.clear();
  mockLocalStorage.setItem('user_aktif', JSON.stringify(userIhsan));
  mockLocalStorage.setItem('session_user', JSON.stringify(userIhsan));
  mockLocalStorage.setItem('local_perizinan', '[]');
  mockLocalStorage.setItem('local_perijinan', '[]');
  mockLocalStorage.setItem('daftar_perizinan_lokal', '[]');

  getOrCreateElem('perijinanJenis').value = 'izin';
  getOrCreateElem('perijinanTanggal').value = '2026-10-29';
  getOrCreateElem('perijinanAlasan').value = 'Izin ada keperluan mendesak keluarga.';
  getOrCreateElem('fotoSurat').files = [{ name: 'surat_izin.jpg', size: 1024, type: 'image/jpeg' }];

  await context.handleSubmitPerijinan();

  const pendingItem = context.ambilIzinPendingAktifSiswa('0098263610');
  assert.ok(pendingItem, 'Permohonan izin harus tercatat dalam antrean');
  assert.strictEqual(pendingItem.status, 'pending', 'Status permohonan harus pending');

  await context.populateDropdownSiswa();
  assert.strictEqual(btnSubmit.disabled, true, 'Tombol submit harus dikunci (disabled)');
  assert.strictEqual(btnSubmit.textContent, 'Menunggu Konfirmasi Wali Kelas...', 'Label tombol harus menunggu konfirmasi');
  assert.ok(msgEl.innerHTML.includes('Pengajuan Izin Sedang Menunggu Konfirmasi'), 'Banner peringatan pending harus ditampilkan');
  console.log('  ✓ Form siswa terkunci "Menunggu Konfirmasi Wali Kelas..." dengan benar.\n');

  // =========================================================================
  // SKENARIO 2: Wali Kelas Menyetujui Izin -> Sinkronisasi Realtime & Unlock
  // =========================================================================
  console.log('▶ [Skenario 2] Wali Kelas Muhammad Echa Putra, S.Kom.Gr menyetujui (ACC) izin...');
  context.ambilUserAktifGuru = () => userWalas;
  context.guruAktif = userWalas;
  context.prompt = () => 'Disetujui. Cepat sembuh.';

  // Muat di dashboard guru dan proses approval
  context.muatPerizinanSiswaWalas();
  const permitId = pendingItem.id || pendingItem.pid;
  await context.prosesApprovalIzin(permitId, 'disetujui');

  // Verifikasi status tersimpan sebagai disetujui di localStorage
  assert.strictEqual(mockLocalStorage.getItem('status_izin_0098263610'), 'disetujui', 'Flag status_izin_0098263610 harus disetujui');

  // Form siswa otomatis terbuka kembali
  await context.populateDropdownSiswa();
  assert.strictEqual(btnSubmit.disabled, false, 'Tombol submit form siswa harus otomatis aktif kembali (disabled = false)');
  assert.strictEqual(btnSubmit.textContent, 'Kirim Pengajuan Izin', 'Label tombol submit harus kembali "Kirim Pengajuan Izin"');
  assert.strictEqual(context.ambilIzinPendingAktifSiswa('0098263610'), null, 'Tidak boleh ada izin pending yang menahan form siswa');
  console.log('  ✓ Form siswa otomatis TERBUKA kembali saat izin di-ACC oleh Wali Kelas.\n');

  // =========================================================================
  // SKENARIO 3: Banner Notifikasi Persetujuan Ditampilkan Bersahabat
  // =========================================================================
  console.log('▶ [Skenario 3] Banner info konfirmasi disetujui ditampilkan...');
  context.bukaKunciFormPengajuanSiswa({
    status: 'disetujui',
    jenis: 'IZIN',
    tanggal: '2026-10-29',
    catatan_guru: 'Disetujui. Cepat sembuh.'
  });
  assert.ok(msgEl.innerHTML.includes('Pengajuan Izin Telah Disetujui'), 'Banner harus memuat judul Pengajuan Izin Telah Disetujui');
  assert.ok(msgEl.innerHTML.includes('Disetujui. Cepat sembuh.'), 'Banner harus menampilkan catatan guru yang diberikan Walas');
  console.log('  ✓ Banner konfirmasi disetujui dengan catatan Walas sukses ditampilkan.\n');

  // =========================================================================
  // SKENARIO 4: Siswa Mengajukan Izin Baru Pasca-Approval -> Berhasil Terkirim
  // =========================================================================
  console.log('▶ [Skenario 4] Siswa mengajukan izin baru setelah permohonan pertama disetujui...');
  getOrCreateElem('perijinanJenis').value = 'izin';
  getOrCreateElem('perijinanTanggal').value = '2026-10-30';
  getOrCreateElem('perijinanAlasan').value = 'Izin kontrol dokter lanjutan.';
  getOrCreateElem('fotoSurat').files = [{ name: 'surat_kontrol.jpg', size: 1024, type: 'image/jpeg' }];

  await context.handleSubmitPerijinan();

  const pendingItemBaru = context.ambilIzinPendingAktifSiswa('0098263610');
  assert.ok(pendingItemBaru, 'Izin baru harus berhasil tercatat');
  assert.strictEqual(pendingItemBaru.status, 'pending', 'Izin baru berstatus pending');
  console.log('  ✓ Siswa berhasil mengirimkan permohonan izin baru pasca-approval.\n');

  // =========================================================================
  // SKENARIO 5: Wali Kelas Menolak Izin -> Form Terbuka & Pesan Penolakan Muncul
  // =========================================================================
  console.log('▶ [Skenario 5] Wali Kelas menolak permohonan izin baru...');
  context.prompt = () => 'Bukti surat dokter tidak terbaca, mohon foto ulang';
  const permitBaruId = pendingItemBaru.id || pendingItemBaru.pid;
  await context.prosesApprovalIzin(permitBaruId, 'ditolak');

  assert.strictEqual(mockLocalStorage.getItem('status_izin_0098263610'), 'ditolak', 'Status izin harus menjadi ditolak');

  await context.populateDropdownSiswa();
  assert.strictEqual(btnSubmit.disabled, false, 'Tombol submit siswa harus aktif setelah ditolak');
  assert.strictEqual(btnSubmit.textContent, 'Kirim Pengajuan Izin', 'Tombol kembali menampilkan "Kirim Pengajuan Izin"');

  context.bukaKunciFormPengajuanSiswa({
    status: 'ditolak',
    jenis: 'IZIN',
    tanggal: '2026-10-30',
    alasanTolak: 'Bukti surat dokter tidak terbaca, mohon foto ulang'
  });
  assert.ok(msgEl.innerHTML.includes('Pengajuan Izin Telah Ditolak'), 'Banner harus memuat status Pengajuan Izin Telah Ditolak');
  assert.ok(msgEl.innerHTML.includes('Bukti surat dokter tidak terbaca'), 'Banner harus memuat alasan penolakan dari Wali Kelas');
  console.log('  ✓ Form siswa otomatis TERBUKA kembali saat izin ditolak Walas.\n');

  // =========================================================================
  // SKENARIO 6: Cross-Device / Cross-Browser RTDB Event Sinkronisasi
  // =========================================================================
  console.log('▶ [Skenario 6] Simulasi update RTDB dari perangkat guru eksternal...');
  // Simulasikan event snapshot realtime Firebase
  const rtdbPermit = {
    id: '-OeCloudPermit999',
    pid: '-OeCloudPermit999',
    nisn: '0098263610',
    nama: 'M. IHSAN ATHALLAH',
    status: 'disetujui',
    tanggal: '2026-10-29',
    jenis: 'izin',
    catatan_guru: 'ACC via Cloud Firebase',
    dibuat_pada: Date.now(),
    updated_at: new Date(Date.now() + 1000).toISOString()
  };

  rtdbListeners.forEach(listener => {
    listener({
      val: () => ({ '-OeCloudPermit999': rtdbPermit })
    });
  });

  assert.strictEqual(btnSubmit.disabled, false, 'Form siswa harus tetap aktif setelah event RTDB masuk');
  assert.strictEqual(mockLocalStorage.getItem('status_izin_0098263610'), 'disetujui', 'Status di localStorage harus tersinkron dari RTDB');
  console.log('  ✓ Event realtime Firebase RTDB berhasil membuka kunci form siswa secara instan.\n');

  console.log('================================================================');
  console.log('🎉 SELURUH PENGUJIAN SINKRONISASI APPROVAL FORM SISWA SUKSES 100%!');
  console.log('================================================================');
}

runTestSuites().catch(err => {
  console.error('❌ Gagal dalam pengujian:', err);
  process.exit(1);
});
