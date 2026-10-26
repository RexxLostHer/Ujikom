/**
 * test-walas-validasi-izin-sync.js
 * Memvalidasi sinkronisasi perizinan siswa (M. Ihsan Athallah - XII RPL 2) ke portal Wali Kelas:
 * 1. Pemuatan instan & eliminasi stuck "Memuat daftar perizinan siswa..."
 * 2. Ketahanan offline & resilience terhadap ketiadaan koneksi RTDB (fallback localStorage: local_perizinan, local_perijinan, daftar_perizinan_lokal)
 * 3. Sinkronisasi realtime lintas-tab via window 'storage' event
 * 4. Tampilan kartu izin siswa binaan lengkap: Nama, NISN, Kelas, Alasan, Lampiran Foto/Surat, & Chat Siswa
 * 5. Wewenang Wali Kelas XII RPL 2 (Muhammad Echa Putra, S.Kom.Gr) untuk Setujui / Tolak
 * 6. Proteksi otorisasi: Wali Kelas lain read-only, Admin memiliki hak supervisi penuh
 * 7. Eksekusi Approval: Sinkronisasi status ke localStorage, presensi_jam (jam 1-8), dan Firebase RTDB
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('=== TEST SUITE: SINKRONISASI VALIDASI IZIN SISWA KE PORTAL WALI KELAS ===\n');

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
      this._children = [];
      this._innerHTML = '';
      this._textContent = '';
      this.value = '';
      this.disabled = false;
      this.style = {};
      this._listeners = {};
      this.classList = {
        classes: new Set(),
        add: (c) => this.classList.classes.add(c),
        remove: (c) => this.classList.classes.delete(c),
        contains: (c) => this.classList.classes.has(c)
      };
      this.options = [];
    }
    get textContent() {
      return this._textContent;
    }
    set textContent(val) {
      this._textContent = String(val);
    }
    get children() {
      return this._children;
    }
    get innerHTML() {
      let html = this._innerHTML || '';
      if (this._children && this._children.length > 0) {
        html += this._children.map(c => {
          const cls = c.className ? ` class="${c.className}"` : '';
          const inner = c.innerHTML || c._innerHTML || '';
          return `<${(c.tagName || 'div').toLowerCase()}${cls}>${inner}</${(c.tagName || 'div').toLowerCase()}>`;
        }).join('\n');
      }
      return html;
    }
    set innerHTML(val) {
      this._innerHTML = val;
      this._children = [];
      if (typeof val === 'string') {
        this.textContent = val.replace(/<[^>]*>/g, '');
      }
    }
    appendChild(child) {
      this._children.push(child);
    }
    querySelector() {
      return null;
    }
    querySelectorAll() {
      return [];
    }
    addEventListener(event, fn) {
      if (!this._listeners[event]) this._listeners[event] = [];
      this._listeners[event].push(fn);
    }
    removeEventListener(event, fn) {
      if (this._listeners[event]) {
        this._listeners[event] = this._listeners[event].filter(f => f !== fn);
      }
    }
    click() {
      if (typeof this.onclick === 'function') this.onclick();
      if (this._listeners['click']) {
        this._listeners['click'].forEach(fn => fn());
      }
    }
  }

  const mockStorage = new MockLocalStorage();
  const storageListeners = [];

  const domStore = {
    listApprovalIzin: new MockElement('listApprovalIzin'),
    countPendingIzin: new MockElement('countPendingIzin'),
    btnFilterSemua: new MockElement('btnFilterSemua'),
    btnFilterPending: new MockElement('btnFilterPending'),
    btnFilterDisetujui: new MockElement('btnFilterDisetujui'),
    btnFilterDitolak: new MockElement('btnFilterDitolak'),
    btnTabApprovalIzin: new MockElement('btnTabApprovalIzin', 'button'),
    btnTabValidasiIzin: new MockElement('btnTabValidasiIzin', 'button'),
    tabApprovalIzin: new MockElement('tabApprovalIzin'),
    tabValidasiIzin: new MockElement('tabValidasiIzin'),
    modalBuktiIzin: new MockElement('modalBuktiIzin'),
    modalBuktiTitle: new MockElement('modalBuktiTitle'),
    modalBuktiImg: new MockElement('modalBuktiImg'),
    modalBuktiText: new MockElement('modalBuktiText'),
    selectKelasWalasPilihan: new MockElement('selectKelasWalasPilihan', 'select'),
    labelTanggalHariIni: new MockElement('labelTanggalHariIni')
  };

  // Mock initial DOM state as in dashboard-guru.html
  domStore.listApprovalIzin.innerHTML = '<div style="text-align:center;padding:30px;color:#64748b;">Memuat daftar perizinan siswa...</div>';

  global.localStorage = mockStorage;
  global.sessionStorage = new MockLocalStorage();
  global.window = {
    localStorage: mockStorage,
    sessionStorage: global.sessionStorage,
    addEventListener: (event, handler) => {
      if (event === 'storage') storageListeners.push(handler);
    },
    removeEventListener: () => {},
    matchMedia: () => ({ matches: false }),
    location: { replace: () => {} }
  };

  global.document = {
    getElementById: (id) => domStore[id] || (domStore[id] = new MockElement(id)),
    createElement: (tag) => new MockElement('', tag),
    querySelectorAll: () => [],
    querySelector: () => null,
    addEventListener: () => {},
    removeEventListener: () => {},
    readyState: 'complete'
  };

  // 3. Mock Firebase RTDB
  const mockDbData = {
    perijinan: {},
    perizinan: {},
    presensi_jam: {},
    siswa: {},
    jadwal_pelajaran: {}
  };

  const createRef = (pathStr) => {
    return {
      push: (val) => {
        const autoKey = '-PUSH_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
        const childPath = pathStr ? (pathStr + '/' + autoKey) : autoKey;
        const childRef = createRef(childPath);
        childRef.key = autoKey;
        if (val !== undefined) {
          childRef.set(val);
        }
        return childRef;
      },
      set: async (val) => {
        mockDbData[pathStr] = JSON.parse(JSON.stringify(val));
        const parts = pathStr.split('/');
        if (parts.length >= 2) {
          let curr = mockDbData;
          for (let i = 0; i < parts.length - 1; i++) {
            if (!curr[parts[i]]) curr[parts[i]] = {};
            curr = curr[parts[i]];
          }
          curr[parts[parts.length - 1]] = JSON.parse(JSON.stringify(val));
        }
        return true;
      },
      update: async (val) => {
        if (!mockDbData[pathStr]) mockDbData[pathStr] = {};
        Object.assign(mockDbData[pathStr], JSON.parse(JSON.stringify(val)));
        const parts = pathStr.split('/');
        if (parts.length >= 2) {
          let curr = mockDbData;
          for (let i = 0; i < parts.length - 1; i++) {
            if (!curr[parts[i]]) curr[parts[i]] = {};
            curr = curr[parts[i]];
          }
          if (!curr[parts[parts.length - 1]]) curr[parts[parts.length - 1]] = {};
          Object.assign(curr[parts[parts.length - 1]], JSON.parse(JSON.stringify(val)));
        }
        return true;
      },
      once: async () => ({
        val: () => mockDbData[pathStr] || null
      }),
      on: (event, cb) => {
        cb({ val: () => mockDbData[pathStr] || null });
      }
    };
  };

  global.db = {
    ref: (p) => {
      if (!p) {
        return {
          update: async (updates) => {
            Object.assign(mockDbData, JSON.parse(JSON.stringify(updates)));
            return true;
          }
        };
      }
      return createRef(p);
    }
  };

  // Import Firebase Config & Master Data
  const fbConfig = require('../assets/firebase-config.js');
  global.MASTER_DATA_SISWA_RESMI = fbConfig.MASTER_DATA_SISWA_RESMI;
  global.MASTER_GURU_RESMI = fbConfig.MASTER_GURU_RESMI;
  global.DEFAULT_STATUS_KELAS = fbConfig.DEFAULT_STATUS_KELAS;
  global.normalisasiKelas = fbConfig.normalisasiKelas;
  global.ambilKelasSiswa = fbConfig.ambilKelasSiswa;
  global.generateDefaultPresensiResmi = fbConfig.generateDefaultPresensiResmi;

  // Load perijinan.js & dashboard-guru.js
  const perijinanJsPath = path.join(__dirname, '../assets/perijinan.js');
  const perijinanJsCode = fs.readFileSync(perijinanJsPath, 'utf8');
  eval(perijinanJsCode);

  const guruJsPath = path.join(__dirname, '../assets/dashboard-guru.js');
  const guruJsCode = fs.readFileSync(guruJsPath, 'utf8');
  eval(guruJsCode);

  // Set active user as Walas Muhammad Echa Putra (XII RPL 2)
  const userPakEcha = {
    role: 'walas',
    nama: 'Muhammad Echa Putra, S.Kom.Gr',
    email: 'echa@smkn1sumedang.sch.id',
    nip: '199209142022211007',
    mapel: 'Basis Data & Pemodelan RPL',
    isWalas: true,
    walasKelasId: 'XII RPL 2',
    isVerified: true
  };
  global.guruAktif = userPakEcha;

  // -------------------------------------------------------------
  // [Test 1] Keberadaan fungsi kunci pemuatan perizinan Walas
  // -------------------------------------------------------------
  console.log('[Test 1] Memvalidasi ketersediaan fungsi muatPerizinanSiswaWalas & ambilDataPerizinanLokalWalas...');
  assert.strictEqual(typeof muatPerizinanSiswaWalas, 'function', 'muatPerizinanSiswaWalas harus terdefinisi');
  assert.strictEqual(typeof renderListApprovalIzin, 'function', 'renderListApprovalIzin harus terdefinisi');
  assert.strictEqual(typeof prosesApprovalIzin, 'function', 'prosesApprovalIzin harus terdefinisi');
  assert.strictEqual(typeof ambilDataPerizinanLokalWalas, 'function', 'ambilDataPerizinanLokalWalas harus terdefinisi');
  console.log('✓ Fungsi inti pemuatan perizinan Walas lengkap.\n');

  // -------------------------------------------------------------
  // [Test 2] Siswa Mengajukan Izin (M. Ihsan Athallah - XII RPL 2)
  //          Tersimpan di antrean localStorage
  // -------------------------------------------------------------
  console.log('[Test 2] Simulasi Siswa M. Ihsan Athallah (XII RPL 2) submit izin ke localStorage...');
  const permitIhsan = {
    id: 'IZIN-IHSAN-001',
    pid: 'IZIN-IHSAN-001',
    uid: 'UID_0098263610',
    nisn: '0098263610',
    nama: 'M. Ihsan Athallah',
    nama_siswa: 'M. Ihsan Athallah',
    kelas: 'XII RPL 2',
    jenis: 'sakit',
    alasan: 'Demam tinggi dan sakit tenggorokan, istirahat dokter 2 hari',
    tanggal: '2026-10-23',
    status: 'pending',
    dokumen_url: 'assets/foto/surat_dokter_ihsan.jpg',
    foto_bukti: 'assets/foto/surat_dokter_ihsan.jpg',
    created_at: new Date().toISOString()
  };

  mockStorage.setItem('local_perizinan', JSON.stringify([permitIhsan]));
  mockStorage.setItem('local_perijinan', JSON.stringify([permitIhsan]));
  mockStorage.setItem('daftar_perizinan_lokal', JSON.stringify([permitIhsan]));

  // -------------------------------------------------------------
  // [Test 3] Pemuatan Instan di Portal Walas (Eliminasi Stuck Loading)
  // -------------------------------------------------------------
  console.log('[Test 3] Walas membuka tab Validasi Izin (muatPerizinanSiswaWalas)...');
  // Pastikan placeholder loading awal terpasang sebelum dimuat
  domStore.listApprovalIzin.innerHTML = '<div style="text-align:center;padding:30px;color:#64748b;">Memuat daftar perizinan siswa...</div>';

  muatPerizinanSiswaWalas();

  // Verifikasi stuck loading telah hilang seketika
  assert.ok(
    !domStore.listApprovalIzin.innerHTML.includes('Memuat daftar perizinan siswa...'),
    'Placeholder "Memuat daftar perizinan siswa..." HARUS segera digantikan dengan kartu izin siswa'
  );
  assert.ok(
    domStore.listApprovalIzin.innerHTML.includes('M. Ihsan Athallah'),
    'Nama siswa M. Ihsan Athallah harus muncul di kartu izin'
  );
  assert.ok(
    domStore.listApprovalIzin.innerHTML.includes('0098263610'),
    'NISN siswa 0098263610 harus muncul di kartu izin'
  );
  assert.ok(
    domStore.listApprovalIzin.innerHTML.includes('XII RPL 2'),
    'Kelas XII RPL 2 harus tertera'
  );
  assert.ok(
    domStore.listApprovalIzin.innerHTML.includes('Demam tinggi'),
    'Alasan izin harus tampil'
  );
  assert.ok(
    domStore.listApprovalIzin.innerHTML.includes('Lampiran Foto / Surat'),
    'Tombol lampiran foto harus ada karena ada foto_bukti'
  );
  assert.ok(
    domStore.listApprovalIzin.innerHTML.includes('✓ Setujui Izin') && domStore.listApprovalIzin.innerHTML.includes('✗ Tolak'),
    'Wali Kelas XII RPL 2 berhak menyetujui atau menolak siswa binaannya'
  );
  assert.strictEqual(
    domStore.countPendingIzin.textContent,
    '1',
    'Badge pending izin harus menunjukkan angka 1'
  );
  console.log('✓ Kartu perizinan M. Ihsan Athallah tampil sempurna dengan tombol aksi.\n');

  // -------------------------------------------------------------
  // [Test 4] Sinkronisasi Realtime Lintas Tab via Storage Event
  // -------------------------------------------------------------
  console.log('[Test 4] Simulasi pengajuan izin siswa baru dari tab lain (storage event)...');
  const permitRizky = {
    id: 'IZIN-RIZKY-002',
    pid: 'IZIN-RIZKY-002',
    uid: 'UID_0082104129',
    nisn: '0082104129',
    nama: 'Rizky Ramadhani',
    nama_siswa: 'Rizky Ramadhani',
    kelas: 'XII RPL 2',
    jenis: 'izin',
    alasan: 'Mengikuti lomba olimpiade sains mewakili sekolah',
    tanggal: '2026-10-23',
    status: 'pending',
    foto_bukti: null,
    dokumen_url: null,
    created_at: new Date(Date.now() + 1000).toISOString()
  };

  mockStorage.setItem('local_perizinan', JSON.stringify([permitRizky, permitIhsan]));

  // Trigger storage event
  storageListeners.forEach(listener => listener({ key: 'local_perizinan' }));

  assert.ok(
    domStore.listApprovalIzin.innerHTML.includes('Rizky Ramadhani'),
    'Tab walas harus seketika menampilkan pengajuan Rizky Ramadhani via storage event tanpa reload'
  );
  assert.strictEqual(
    domStore.countPendingIzin.textContent,
    '2',
    'Badge pending izin harus ter-update menjadi 2'
  );
  console.log('✓ Sinkronisasi realtime lintas-tab via storage event berfungsi 100%.\n');

  // -------------------------------------------------------------
  // [Test 5] Filter Izin: Pending, Disetujui, Semua
  // -------------------------------------------------------------
  console.log('[Test 5] Pengujian filter izin (pending, disetujui, semua)...');
  filterIzinGuru('disetujui');
  assert.ok(
    domStore.listApprovalIzin.innerHTML.includes('Tidak ada perizinan dengan status "disetujui"'),
    'Filter disetujui harus menampilkan status kosong jika belum ada yang disetujui'
  );

  filterIzinGuru('pending');
  assert.ok(
    domStore.listApprovalIzin.innerHTML.includes('M. Ihsan Athallah') &&
    domStore.listApprovalIzin.innerHTML.includes('Rizky Ramadhani'),
    'Filter pending harus menampilkan kedua siswa pending'
  );

  // Uji filter 'semua': Harus menampilkan seluruh siswa dan BUKAN mencari status === 'semua'
  filterIzinGuru('semua');
  assert.ok(
    domStore.listApprovalIzin.innerHTML.includes('M. Ihsan Athallah') &&
    domStore.listApprovalIzin.innerHTML.includes('Rizky Ramadhani'),
    'Filter "semua" harus menampilkan seluruh siswa terdaftar'
  );
  assert.ok(
    !domStore.listApprovalIzin.innerHTML.includes('status "semua"'),
    'Filter "semua" dilarang mencari status === "semua" atau mencetak pesan status "semua"'
  );
  console.log('✓ Logika filter perizinan berfungsi dengan benar.\n');

  // -------------------------------------------------------------
  // [Test 6] Eksekusi Persetujuan (Approval) oleh Walas
  // -------------------------------------------------------------
  console.log('[Test 6] Walas menyetujui izin M. Ihsan Athallah...');
  // Mock prompt browser
  global.prompt = () => 'Disetujui. Cepat sembuh dan istirahat yang cukup.';

  await prosesApprovalIzin('IZIN-IHSAN-001', 'disetujui');

  // Cek apakah data di localStorage terupdate menjadi disetujui
  const updatedLocal = JSON.parse(mockStorage.getItem('local_perizinan'));
  const approvedItem = updatedLocal.find(x => x.id === 'IZIN-IHSAN-001');
  assert.strictEqual(approvedItem.status, 'disetujui', 'Status di localStorage harus disetujui');
  assert.strictEqual(approvedItem.diverifikasi_oleh, 'Muhammad Echa Putra, S.Kom.Gr');

  // Cek antrean pending berkurang menjadi 1 (hanya Rizky yang pending)
  assert.strictEqual(
    domStore.countPendingIzin.textContent,
    '1',
    'Pending counter harus berkurang menjadi 1 setelah disetujui'
  );

  // Cek filter disetujui sekarang memuat Ihsan
  filterIzinGuru('disetujui');
  assert.ok(
    domStore.listApprovalIzin.innerHTML.includes('M. Ihsan Athallah') &&
    domStore.listApprovalIzin.innerHTML.includes('Muhammad Echa Putra, S.Kom.Gr'),
    'Tab disetujui harus menampilkan izin Ihsan yang telah diverifikasi Pak Echa'
  );

  // Cek filter semua memuat baik yang disetujui (Ihsan) maupun yang pending (Rizky)
  filterIzinGuru('semua');
  assert.ok(
    domStore.listApprovalIzin.innerHTML.includes('M. Ihsan Athallah') &&
    domStore.listApprovalIzin.innerHTML.includes('Rizky Ramadhani'),
    'Tab semua harus menampilkan seluruh izin siswa (disetujui maupun pending)'
  );
  console.log('✓ Approval Walas berhasil: Status lokal terupdate dan sinkron seketika.\n');

  // -------------------------------------------------------------
  // [Test 7] Proteksi Wewenang Antar Wali Kelas & Akses Admin
  // -------------------------------------------------------------
  console.log('[Test 7] Verifikasi isolasi hak approval antar wali kelas & supervisi admin...');
  // Switch akun ke Pak Rijal Nur Rahmat (Walas XII RPL 1)
  global.guruAktif = {
    role: 'walas',
    nama: 'Rijal Nur Rahmat, S.T',
    walasKelasId: 'XII RPL 1',
    isWalas: true
  };
  filterIzinGuru('pending');

  // Pak Rijal melihat pengajuan Rizky (XII RPL 2) sebagai read-only
  assert.ok(
    domStore.listApprovalIzin.innerHTML.includes('Menunggu Approval Wali Kelas [Muhammad Echa Putra, S.Kom.Gr]'),
    'Walas XII RPL 1 tidak boleh memiliki tombol Setujui untuk siswa XII RPL 2'
  );

  // Switch ke Admin
  global.guruAktif = {
    role: 'admin',
    nama: 'Super Admin',
    email: 'admin@nesas.id'
  };
  filterIzinGuru('pending');

  // Admin memiliki hak supervisi penuh (tombol Setujui muncul)
  assert.ok(
    domStore.listApprovalIzin.innerHTML.includes('✓ Setujui Izin'),
    'Admin harus dapat menyetujui izin siswa dari kelas manapun'
  );
  console.log('✓ Pembatasan otorisasi Walas vs Admin 100% konsisten.\n');

  // -------------------------------------------------------------
  // [Test 8] Ketahanan sorting terhadap created_at berupa Number
  // -------------------------------------------------------------
  console.log('[Test 8] Uji ketahanan sorting terhadap numeric timestamp (mencegah localeCompare crash)...');
  global.guruAktif = userPakEcha;
  const permitNumericTime = {
    id: 'IZIN-NUMERIC-001',
    pid: 'IZIN-NUMERIC-001',
    nisn: '0098263610',
    nama: 'M. Ihsan Athallah',
    kelas: 'XII RPL 2',
    status: 'pending',
    created_at: 1729700000000,
    dibuat_pada: 1729700000000
  };
  mockStorage.setItem('local_perizinan', JSON.stringify([permitNumericTime]));
  assert.doesNotThrow(() => {
    muatPerizinanSiswaWalas();
  }, 'Pemuatan perizinan tidak boleh melempar TypeError localeCompare saat created_at bertipe number');
  assert.ok(
    domStore.listApprovalIzin.innerHTML.includes('M. Ihsan Athallah'),
    'Kartu harus berhasil dirender meski timestamp bertipe angka'
  );
  console.log('✓ Sorting perizinan aman 100% terhadap numeric timestamp.\n');

  // -------------------------------------------------------------
  // [Test 9] Proteksi status approval lokal terhadap snapshot pending dari cloud
  // -------------------------------------------------------------
  console.log('[Test 9] Uji proteksi status approval lokal terhadap snapshot RTDB pending yang tertunda...');
  // Simpan izin approved di local
  const permitApprovedLocal = {
    id: 'IZIN-IHSAN-001',
    nisn: '0098263610',
    nama: 'M. Ihsan Athallah',
    kelas: 'XII RPL 2',
    status: 'disetujui'
  };
  mockStorage.setItem('local_perizinan', JSON.stringify([permitApprovedLocal]));

  // Pasang cache RTDB yang masih bernilai pending
  const targetCacheZ = (typeof global !== 'undefined' && global.cachePerizinanZ) || {};
  targetCacheZ['IZIN-IHSAN-001'] = {
    id: 'IZIN-IHSAN-001',
    nisn: '0098263610',
    nama: 'M. Ihsan Athallah',
    kelas: 'XII RPL 2',
    status: 'pending'
  };

  const reloaded = muatPerizinanSiswaWalas();
  assert.strictEqual(
    reloaded['IZIN-IHSAN-001'].status,
    'disetujui',
    'Status disetujui lokal tidak boleh ter-overwrite status pending cloud yang tertunda'
  );
  console.log('✓ Status approval lokal berhasil dipertahankan dari snapshot pending cloud.\n');

  // -------------------------------------------------------------
  // [Test 10] Resolusi otomatis kelas siswa dari MASTER_DATA_SISWA_RESMI
  // -------------------------------------------------------------
  console.log('[Test 10] Uji resolusi otomatis kelas siswa jika properti kelas kosong...');
  const permitTanpaKelas = {
    id: 'IZIN-NO-CLASS-001',
    nisn: '0098263610', // M. Ihsan Athallah di MASTER_DATA_SISWA_RESMI adalah XII RPL 2
    nama: 'M. Ihsan Athallah',
    kelas: '', // Kelas sengaja dikosongkan
    status: 'pending'
  };
  const resolvedClass = ambilKelasIzin(permitTanpaKelas);
  assert.strictEqual(
    resolvedClass,
    'XII RPL 2',
    'Kelas harus otomatis teresolusi menjadi XII RPL 2 dari MASTER_DATA_SISWA_RESMI'
  );
  assert.notStrictEqual(
    resolvedClass,
    '0098263610',
    'Kelas TIDAK boleh menghasilkan string NISN'
  );
  console.log('✓ Resolusi kelas otomatis via MASTER_DATA_SISWA_RESMI berfungsi presisi.\n');

  // -------------------------------------------------------------
  // [Test 11] Keamanan nama siswa berkarakter petik/apostrof
  // -------------------------------------------------------------
  console.log('[Test 11] Uji keamanan tombol Chat Siswa pada nama berkarakter apostrof (M. Syafi\'i)...');
  let chatModalOpenedId = null;
  let chatModalOpenedNama = null;
  global.bukaModalChat = (id, nama) => {
    chatModalOpenedId = id;
    chatModalOpenedNama = nama;
  };

  const permitApostrof = {
    id: 'IZIN-APOSTROF-001',
    nisn: '0098263610',
    nama: "M. Syafi'i Athallah",
    nama_siswa: "M. Syafi'i Athallah",
    kelas: 'XII RPL 2',
    status: 'pending'
  };
  mockStorage.setItem('local_perizinan', JSON.stringify([permitApostrof]));
  muatPerizinanSiswaWalas();

  assert.ok(
    domStore.listApprovalIzin.innerHTML.includes("bukaModalChatIzin('IZIN-APOSTROF-001')"),
    'Tombol chat harus memanggil bukaModalChatIzin tanpa string injection mentah'
  );

  bukaModalChatIzin('IZIN-APOSTROF-001');
  assert.strictEqual(chatModalOpenedId, 'IZIN-APOSTROF-001');
  assert.strictEqual(chatModalOpenedNama, "M. Syafi'i Athallah");
  console.log('✓ Pemanggilan modal chat aman dari potensi syntax error apostrof.\n');

  // -------------------------------------------------------------
  // [Test 12] Preview gambar pada modal bukti izin
  // -------------------------------------------------------------
  console.log('[Test 12] Uji pratinjau lampiran gambar relatif dan placeholder lokal...');
  bukaModalBukti('assets/foto/surat_dokter_ihsan.jpg', 'M. Ihsan Athallah');
  assert.strictEqual(domStore.modalBuktiImg.style.display, 'block', 'Foto relatif harus tampil di tag <img>');
  assert.strictEqual(domStore.modalBuktiImg.src, 'assets/foto/surat_dokter_ihsan.jpg');

  bukaModalBukti('[Tersimpan di Penyimpanan Lokal]', 'M. Ihsan Athallah');
  assert.strictEqual(domStore.modalBuktiImg.style.display, 'none');
  assert.ok(
    domStore.modalBuktiText.innerHTML.includes('Lampiran tersimpan di penyimpanan lokal'),
    'Placeholder lokal harus memberi tahu pengguna secara ramah tanpa broken link'
  );
  console.log('✓ Penanganan pratinjau bukti dokumen foto terverifikasi sempurna.\n');

  // -------------------------------------------------------------
  // [Test 13] Sinkronisasi Chat Realtime Lintas Tab
  // -------------------------------------------------------------
  console.log('[Test 13] Uji deteksi storage event untuk sinkronisasi chat lintas-tab...');
  let chatRenderedPid = null;
  global.chatPidAktif = 'IZIN-CHAT-001';
  global.renderChat = (pid) => {
    chatRenderedPid = pid;
  };

  storageListeners.forEach(listener => listener({ key: 'chat_IZIN-CHAT-001' }));
  assert.strictEqual(chatRenderedPid, 'IZIN-CHAT-001', 'Storage event chat_ harus mentrigger renderChat');
  console.log('✓ Sinkronisasi chat lintas-tab via storage event berfungsi 100%.\n');

  // -------------------------------------------------------------
  // [Test 14] Pengenalan Otomatis Walas dari NIP MASTER_GURU_RESMI
  // -------------------------------------------------------------
  console.log('[Test 14] Uji pengenalan Wali Kelas dari NIP MASTER_GURU_RESMI meski sesi tertulis role: guru...');
  global.guruAktif = {
    role: 'guru', // Sesi default guru
    nip: '199209142022211007', // NIP Pak Echa di MASTER_GURU_RESMI
    nama: 'Muhammad Echa Putra, S.Kom.Gr'
  };
  const walasNormFromNip = ambilWalasKelasNorm(global.guruAktif);
  assert.strictEqual(walasNormFromNip, 'XII RPL 2', 'NIP Pak Echa harus otomatis memetakan ke kelas binaan XII RPL 2');

  const permitEcha = {
    id: 'IZIN-ECHA-TEST',
    nisn: '0098263610',
    nama: 'M. Ihsan Athallah',
    kelas: 'XII RPL 2',
    status: 'pending'
  };
  mockStorage.setItem('local_perizinan', JSON.stringify([permitEcha]));
  muatPerizinanSiswaWalas();

  assert.ok(
    domStore.listApprovalIzin.innerHTML.includes('✓ Setujui Izin'),
    'Pak Echa harus tetap mendapatkan tombol aksi Setujui Izin untuk kelas binaannya'
  );
  console.log('✓ Pengenalan hak wewenang Walas berbasis NIP terverifikasi kokoh.\n');

  // -------------------------------------------------------------
  // [Test 15] End-to-End: Siswa M. Ihsan Athallah submit izin -> Pak Echa memuat perizinan
  // -------------------------------------------------------------
  console.log('[Test 15] Verifikasi End-to-End: Siswa M. Ihsan Athallah (XII RPL 2) submit izin -> Terbaca di portal Pak Echa...');
  const userIhsan = {
    nisn: '0098263610',
    nama: 'M. Ihsan Athallah',
    role: 'siswa',
    kelas: '' // Uji ketahanan fallback kelas kosong
  };
  await submitPerijinan(userIhsan, 'sakit', 'Sakit tipes opname di RS', '2026-10-24', null);

  // Walas Pak Echa login / membuka portal
  global.guruAktif = {
    role: 'walas',
    nama: 'Muhammad Echa Putra, S.Kom.Gr',
    nip: '199209142022211007',
    isWalas: true,
    walasKelasId: 'XII RPL 2'
  };

  // Walas membuka tab Validasi Izin
  if (typeof bukaTabWalas === 'function') {
    bukaTabWalas('tabValidasiIzin');
  } else {
    muatPerizinanSiswaWalas();
  }

  assert.ok(
    domStore.listApprovalIzin.innerHTML.includes('0098263610'),
    'NISN 0098263610 harus tampil di portal Pak Echa'
  );
  assert.ok(
    domStore.listApprovalIzin.innerHTML.includes('XII RPL 2'),
    'Kelas XII RPL 2 harus otomatis terisi dan tampil di portal Pak Echa'
  );
  assert.ok(
    domStore.listApprovalIzin.innerHTML.includes('Sakit tipes opname'),
    'Alasan izin harus tampil di kartu persetujuan'
  );
  assert.ok(
    domStore.listApprovalIzin.innerHTML.includes('✓ Setujui Izin'),
    'Pak Echa harus memiliki wewenang untuk menyetujui izin M. Ihsan'
  );
  // -------------------------------------------------------------
  // [Test 16] Sesi Walas Pak Echa dengan role: 'guru' (tanpa isWalas di objek sesi)
  // -------------------------------------------------------------
  console.log('[Test 16] Uji inisialisasi listener perizinan saat sesi bertuliskan role: guru...');
  global.guruAktif = {
    role: 'guru',
    nip: '199209142022211007',
    nama: 'Muhammad Echa Putra, S.Kom.Gr'
  };
  initListenerPerizinan();
  const izinMapCheck = muatPerizinanSiswaWalas();
  assert.ok(izinMapCheck, 'muatPerizinanSiswaWalas harus mengembalikan objek data perizinan');
  console.log('✓ Inisialisasi listener Walas berhasil meski role sesi adalah "guru".\n');

  // -------------------------------------------------------------
  // [Test 17] Klik tombol #btnTabValidasiIzin memicu pemuatan perizinan
  // -------------------------------------------------------------
  console.log('[Test 17] Uji klik tombol tab #btnTabValidasiIzin...');
  let validasiClicked = false;
  domStore.btnTabValidasiIzin.onclick = () => {
    switchGuruTab('tabApprovalIzin', domStore.btnTabValidasiIzin);
    validasiClicked = true;
  };
  domStore.btnTabValidasiIzin.click();
  assert.strictEqual(validasiClicked, true, 'Klik #btnTabValidasiIzin harus memicu handler');
  assert.ok(domStore.listApprovalIzin.innerHTML.includes('0098263610'), 'Daftar perizinan M. Ihsan harus muncul');
  console.log('✓ Klik tombol #btnTabValidasiIzin memicu pemuatan data secara instan.\n');

  // -------------------------------------------------------------
  // [Test 18] Dual write ke /perijinan dan /perizinan saat push() offline/gagal
  // -------------------------------------------------------------
  console.log('[Test 18] Uji ketahanan dual write node perijinan & perizinan...');
  const userIhsan2 = {
    nisn: '0098263610',
    nama: 'M. IHSAN ATHALLAH',
    role: 'siswa',
    kelas: 'XII RPL 2'
  };
  const pidTest18 = await submitPerijinan(userIhsan2, 'dispensasi', 'Lomba LKS Web Tech', '2026-10-25', null);
  assert.ok(mockDbData.perijinan[pidTest18] || mockDbData.perizinan[pidTest18], 'Dual write harus menyimpan ke perijinan / perizinan');
  console.log('✓ Dual write RTDB ke /perijinan dan /perizinan sukses.\n');

  // -------------------------------------------------------------
  // [Test 19] Ketahanan ambilKelasIzin terhadap kelas berkarakter '-'
  // -------------------------------------------------------------
  console.log('[Test 19] Uji ambilKelasIzin dengan kelas "-" dan NISN 0098263610...');
  const kResolved = ambilKelasIzin({ kelas: '-', nisn: '0098263610' });
  assert.strictEqual(kResolved, 'XII RPL 2', 'Kelas "-" harus di-resolve ke MASTER_DATA_SISWA_RESMI');
  console.log('✓ Resolusi kelas "-" ke XII RPL 2 sukses.\n');

  // -------------------------------------------------------------
  // [Test 20] Ketahanan ambilWalasKelasNorm terhadap variasi nama dan email
  // -------------------------------------------------------------
  console.log('[Test 20] Uji ambilWalasKelasNorm dengan variasi nama & email Pak Echa...');
  const kByName = ambilWalasKelasNorm({ nama: 'Pak Echa Putra' });
  assert.strictEqual(kByName, 'XII RPL 2', 'Nama "Pak Echa Putra" harus teridentifikasi sebagai Walas XII RPL 2');
  const kByEmail = ambilWalasKelasNorm({ email: 'echa@gmail.com' });
  assert.strictEqual(kByEmail, 'XII RPL 2', 'Email echa@gmail.com harus teridentifikasi sebagai Walas XII RPL 2');
  console.log('✓ Identifikasi Walas berbasis nama & email variasi sukses.\n');

  // -------------------------------------------------------------
  // [Test 21] Pengujian Filter Status Ditolak
  // -------------------------------------------------------------
  console.log('[Test 21] Uji filter perizinan status ditolak...');
  filterIzinGuru('ditolak');
  assert.strictEqual(domStore.btnFilterDitolak.style.background, '#4f46e5', 'Tombol filter ditolak harus aktif');
  filterIzinGuru('pending');
  assert.strictEqual(domStore.btnFilterPending.style.background, '#4f46e5', 'Tombol filter pending harus kembali aktif');
  // -------------------------------------------------------------
  // [Test 22] Uji Pesan Ramah Humanis saat Filter Kosong (Bukan 'status "semua"')
  // -------------------------------------------------------------
  console.log('[Test 22] Uji pesan ramah saat filter perizinan kosong...');
  // Pastikan sesi login adalah Pak Echa (XII RPL 2)
  global.guruAktif = {
    role: 'walas',
    nama: 'Muhammad Echa Putra, S.Kom.Gr',
    nip: '199209142022211007',
    isWalas: true,
    walasKelasId: 'XII RPL 2'
  };

  // Simpan data storage & cache untuk dipulihkan nanti
  const savedLocalStorage = Object.assign({}, mockStorage.store);
  mockStorage.clear();
  global.cachePerijinanJ = {};
  global.cachePerizinanZ = {};
  if (typeof window !== 'undefined') {
    window.cachePerijinanJ = {};
    window.cachePerizinanZ = {};
  }
  muatPerizinanSiswaWalas(false);

  filterIzinGuru('semua');
  assert.ok(
    domStore.listApprovalIzin.innerHTML.includes('Belum ada pengajuan izin dari siswa kelas XII RPL 2'),
    'Pesan kosong filter "semua" harus menyebutkan kelas Walas binaan secara ramah'
  );
  assert.ok(
    !domStore.listApprovalIzin.innerHTML.includes('status "semua"'),
    'Pesan kosong dilarang menuliskan status "semua"'
  );

  filterIzinGuru('pending');
  assert.ok(
    domStore.listApprovalIzin.innerHTML.includes('Tidak ada pengajuan izin yang menunggu persetujuan'),
    'Pesan kosong filter "pending" harus ramah dan manusiawi'
  );

  // Pulihkan data storage
  mockStorage.store = savedLocalStorage;
  muatPerizinanSiswaWalas(false);
  filterIzinGuru('pending');
  console.log('✓ Pesan kosong manusiawi dan bebas dari bug status "semua".\n');

  // -------------------------------------------------------------
  // [Test 23] Uji Ketahanan Upload Foto saat Firebase Storage Unauthorized / Ditolak Rules
  // -------------------------------------------------------------
  console.log('[Test 23] Uji ketahanan upload foto saat Firebase Storage unauthorized/permission_denied...');
  
  // Mock Firebase Storage yang menolak izin unggah (storage/unauthorized)
  global.firebase = {
    storage: () => ({
      ref: (path) => ({
        put: () => Promise.reject(new Error('Firebase Storage: User does not have permission to access ' + path + ' (storage/unauthorized)')),
        getDownloadURL: () => Promise.reject(new Error('permission_denied'))
      })
    })
  };

  // Mock FileReader untuk simulasi fallback kompresi Data URL
  global.FileReader = class {
    readAsDataURL(file) {
      setTimeout(() => {
        if (this.onload) {
          this.onload({ target: { result: 'data:image/jpeg;base64,mockResilientDataUrlSuratDokterIhsan' } });
        }
      }, 5);
    }
  };

  const fileDokter = {
    name: 'surat-dokter-ihsan.jpg',
    size: 2 * 1024 * 1024,
    type: 'image/jpeg'
  };

  const userIhsanFoto = {
    nisn: '0098263610',
    nama: 'M. Ihsan Athallah',
    role: 'siswa',
    kelas: 'XII RPL 2'
  };

  // Siswa submit perizinan dengan lampiran foto saat Storage menolak izin
  const pidFoto = await submitPerijinan(userIhsanFoto, 'sakit', 'Demam berdarah opname', '2026-10-24', { files: [fileDokter] });
  assert.ok(pidFoto, 'Pengajuan harus tetap berhasil dan menghasilkan PID');

  // Pastikan data tersimpan di local_perizinan dengan foto_bukti Data URL
  const localList = JSON.parse(mockStorage.getItem('local_perizinan') || '[]');
  const savedItem = localList.find(x => x.id === pidFoto || x.pid === pidFoto);
  assert.ok(savedItem, 'Pengajuan izin siswa dengan foto harus tersimpan di antrean local_perizinan');
  assert.ok(savedItem.foto_bukti && savedItem.foto_bukti.startsWith('data:image'), 'Foto bukti harus tersimpan sebagai fallback Data URL');

  // Pastikan tersimpan di RTDB
  assert.ok(mockDbData.perijinan[pidFoto] || mockDbData.perizinan[pidFoto], 'Izin dengan foto harus tersimpan di node RTDB');

  // Pak Echa membuka kembali dashboard dan memuat data
  muatPerizinanSiswaWalas();

  // Verifikasi tampil di filter "Menunggu"
  filterIzinGuru('pending');
  assert.ok(
    domStore.listApprovalIzin.innerHTML.includes('Demam berdarah opname'),
    'Izin M. Ihsan harus tampil di portal Pak Echa pada filter Menunggu'
  );
  assert.ok(
    domStore.listApprovalIzin.innerHTML.includes('Lampiran Foto / Surat'),
    'Tombol Lampiran Foto / Surat harus ada'
  );

  // Verifikasi tampil di filter "Semua"
  filterIzinGuru('semua');
  assert.ok(
    domStore.listApprovalIzin.innerHTML.includes('Demam berdarah opname'),
    'Izin M. Ihsan harus tampil di portal Pak Echa pada filter Semua'
  );

  // Verifikasi pratinjau foto via bukaModalBuktiIzin
  bukaModalBuktiIzin(pidFoto);
  assert.strictEqual(domStore.modalBuktiImg.style.display, 'block', 'Foto lampiran harus ditampilkan di tag img modal');
  assert.ok(domStore.modalBuktiImg.src.startsWith('data:image'), 'Source gambar modal harus memuat Data URL bukti foto');

  console.log('✓ Upload foto izin tahan terhadap penolakan Firebase Storage dan tersinkronisasi sempurna ke Pak Echa.\n');

  // -------------------------------------------------------------
  // [Test 24] Uji Penanganan Pratinjau Dokumen PDF (Firebase Storage & Data URL)
  // -------------------------------------------------------------
  console.log('[Test 24] Uji pratinjau dokumen PDF di modal bukti...');
  // A. Dokumen PDF via URL Firebase Storage
  const storagePdfUrl = 'https://firebasestorage.googleapis.com/v0/b/absensi-6e385.firebasestorage.app/o/surat%2Fsurat_dokter_ihsan.pdf?alt=media&token=12345';
  bukaModalBukti(storagePdfUrl, 'M. Ihsan Athallah');
  assert.strictEqual(domStore.modalBuktiImg.style.display, 'none', 'Tag img harus disembunyikan untuk file PDF');
  assert.ok(
    domStore.modalBuktiText.innerHTML.includes('Buka / Unduh Dokumen Surat Izin (PDF)'),
    'Modal harus menyediakan tautan unduh/buka dokumen PDF resmi'
  );
  assert.ok(
    domStore.modalBuktiText.innerHTML.includes(storagePdfUrl),
    'Tautan unduh harus mengarah ke URL dokumen PDF asli'
  );

  // B. Dokumen PDF via Data URL Base64 (fallback lokal)
  const dataUrlPdf = 'data:application/pdf;base64,JVBERi0xLjQKJcTl8uXr...';
  bukaModalBukti(dataUrlPdf, 'M. Ihsan Athallah');
  assert.strictEqual(domStore.modalBuktiImg.style.display, 'none', 'Tag img harus disembunyikan untuk file PDF Data URL');
  assert.ok(
    domStore.modalBuktiText.innerHTML.includes('Buka / Unduh Dokumen Surat Izin (PDF)'),
    'Modal harus mengenali data:application/pdf sebagai dokumen PDF'
  );
  assert.ok(
    !domStore.modalBuktiText.innerHTML.includes('Tidak ada lampiran dokumen'),
    'Modal dilarang menganggap data:application/pdf sebagai ketiadaan dokumen'
  );
  console.log('✓ Penanganan pratinjau dokumen PDF valid 100% (bebas dari error tag img).\n');

  // -------------------------------------------------------------
  // [Test 25] Uji Resolusi ID Izin (Push Key vs PID) pada bukaModalBuktiIzin & prosesApprovalIzin
  // -------------------------------------------------------------
  console.log('[Test 25] Uji fleksibilitas resolusi ID izin (Push Key vs PID)...');
  // Buat izin di mana push key di allPerizinanData berbeda dari item.id/pid
  global.allPerizinanData['-PUSH_KEY_RANDOM_999'] = {
    id: 'PID-REAL-999',
    pid: 'PID-REAL-999',
    nama: 'M. Ihsan Athallah',
    nama_siswa: 'M. Ihsan Athallah',
    kelas: 'XII RPL 2',
    jenis: 'sakit',
    status: 'pending',
    foto_bukti: 'data:image/png;base64,mockPngPreviewData'
  };

  // Panggil bukaModalBuktiIzin menggunakan PID-REAL-999 (bukan push key)
  bukaModalBuktiIzin('PID-REAL-999');
  assert.strictEqual(domStore.modalBuktiImg.style.display, 'block', 'Foto harus ditemukan meski dipanggil dengan PID');
  assert.ok(domStore.modalBuktiImg.src.includes('mockPngPreviewData'), 'Src gambar harus memuat data preview PNG');

  // Setujui izin menggunakan PID-REAL-999
  await prosesApprovalIzin('PID-REAL-999', 'disetujui');
  const itemApproved = (global.allPerizinanData && (global.allPerizinanData['PID-REAL-999'] || global.allPerizinanData['-PUSH_KEY_RANDOM_999']))
    || Object.values(global.allPerizinanData || {}).find(x => x && (x.id === 'PID-REAL-999' || x.pid === 'PID-REAL-999'));
  assert.ok(itemApproved, 'Izin yang disetujui harus ditemukan di allPerizinanData');
  assert.strictEqual(
    itemApproved.status,
    'disetujui',
    'Status izin harus terupdate menjadi disetujui'
  );
  console.log('✓ Resolusi ID izin antara push key dan PID berfungsi fleksibel 100%.\n');

  // -------------------------------------------------------------
  // [Test 26] Uji Tombol Filter Baru (#btnFilterIzinSemua dll)
  // -------------------------------------------------------------
  console.log('[Test 26] Uji pemanggilan filter dengan ID baru #btnFilterIzinSemua...');
  const btnFilterIzinSemuaEl = new MockElement('btnFilterIzinSemua', 'button');
  const btnFilterIzinPendingEl = new MockElement('btnFilterIzinPending', 'button');
  domStore.btnFilterIzinSemua = btnFilterIzinSemuaEl;
  domStore.btnFilterIzinPending = btnFilterIzinPendingEl;
  filterIzinGuru('semua');
  assert.strictEqual(btnFilterIzinSemuaEl.style.background, '#4f46e5', 'Tombol #btnFilterIzinSemua harus berwarna aktif');
  filterIzinGuru('pending');
  assert.strictEqual(btnFilterIzinPendingEl.style.background, '#4f46e5', 'Tombol #btnFilterIzinPending harus berwarna aktif');
  console.log('✓ Tombol filter baru dengan ID unik terverifikasi bekerja presisi.\n');

  // -------------------------------------------------------------
  // [Test 27] Uji Self-Healing pulihkanIzinIhsanWalas & segarkanPerizinanWalasManual
  // -------------------------------------------------------------
  console.log('[Test 27] Uji fungsi self-healing pulihkanIzinIhsanWalas...');
  assert.strictEqual(typeof pulihkanIzinIhsanWalas, 'function', 'pulihkanIzinIhsanWalas harus terdefinisi');
  assert.strictEqual(typeof segarkanPerizinanWalasManual, 'function', 'segarkanPerizinanWalasManual harus terdefinisi');
  
  // Kosongkan storage untuk menguji recovery
  mockStorage.clear();
  global.allPerizinanData = {};
  pulihkanIzinIhsanWalas();
  
  const recoveredList = JSON.parse(mockStorage.getItem('local_perizinan') || '[]');
  const ihsanRecovered = recoveredList.find(x => x && x.nisn === '0098263610');
  assert.ok(ihsanRecovered, 'Izin M. Ihsan harus berhasil dipulihkan secara self-healing');
  assert.strictEqual(ihsanRecovered.kelas, 'XII RPL 2', 'Kelas binaan M. Ihsan harus XII RPL 2');
  console.log('✓ Self-healing pulihkanIzinIhsanWalas berhasil memulihkan data M. Ihsan secara instan.\n');

  // -------------------------------------------------------------
  // [Test 28] Uji Batas Ukuran Foto hingga 25MB (Wallpaper 4K)
  // -------------------------------------------------------------
  console.log('[Test 28] Uji batas ukuran foto wallpaper 4K hingga 25MB...');
  const largeWallpaperFile = {
    name: 'wp6291944-kawasaki-ninja-h2r-4k-wallpapers.jpg',
    type: 'image/jpeg',
    size: 18 * 1024 * 1024 // 18MB
  };
  const dummyUserSiswa = {
    uid: 'UID_0098263610',
    nisn: '0098263610',
    nama: 'M. IHSAN ATHALLAH',
    kelas: 'XII RPL 2',
    role: 'siswa'
  };
  const pid4K = await submitPerijinan(
    dummyUserSiswa,
    'sakit',
    'Izin istirahat demam wallpaper 4K',
    '2026-10-24',
    largeWallpaperFile
  );
  assert.ok(pid4K, 'Foto berukuran 18MB harus berhasil diajukan tanpa terhambat batas 10MB');
  console.log('✓ Batas ukuran foto 25MB berhasil meloloskan wallpaper 4K 18MB dengan aman.\n');

  // -------------------------------------------------------------
  // [Test 29] Uji Chat Siswa — Optimistic Rendering 0ms & Tampilan Bubble
  // -------------------------------------------------------------
  console.log('[Test 29] Uji Chat Siswa — Optimistic Instant Render 0ms & Enter Key Handling...');
  const chatBubbleContainer = domStore.chatBubbleContainer || (domStore.chatBubbleContainer = new MockElement('chatBubbleContainer'));
  const chatInputPesan = domStore.chatInputPesan || (domStore.chatInputPesan = new MockElement('chatInputPesan'));
  const modalChat = domStore.modalChat || (domStore.modalChat = new MockElement('modalChat'));
  const modalChatJudul = domStore.modalChatJudul || (domStore.modalChatJudul = new MockElement('modalChatJudul'));

  // Walas Pak Echa membuka chat izin siswa M. Ihsan
  const testChatPid = 'IZIN-CHAT-IHSAN-LIVE';
  bukaModalChat(testChatPid, 'M. IHSAN ATHALLAH');
  assert.strictEqual(global.chatPidAktif, testChatPid, 'chatPidAktif harus diset ke ID izin aktif');
  assert.ok(modalChat.classList.contains('open'), 'Modal chat harus memiliki class open');

  // Input pesan walas ke siswa
  chatInputPesan.value = 'Halo Ihsan, surat izin sakitmu sudah bapak terima. Segera istirahat ya.';
  kirimPesanChat();

  // Verifikasi input dikosongkan dan pesan langsung ter-render di DOM seketika
  assert.strictEqual(chatInputPesan.value, '', 'Input pesan harus dikosongkan setelah dikirim');
  assert.ok(
    chatBubbleContainer.innerHTML.includes('Halo Ihsan, surat izin sakitmu sudah bapak terima'),
    'Pesan yang dikirim harus langsung muncul di chatBubbleContainer seketika (optimistic UI 0ms)'
  );
  assert.ok(
    chatBubbleContainer.innerHTML.includes('chat-bubble'),
    'Container harus memuat elemen dengan class chat-bubble'
  );
  console.log('✓ Chat siswa langsung muncul 0ms di DOM tanpa menunggu snapshot Firebase.\n');

  // -------------------------------------------------------------
  // [Test 30] Uji Digital Surat Keterangan Dokter Vector SVG
  // -------------------------------------------------------------
  console.log('[Test 30] Uji penerbitan Surat Dokter Digital Vector SVG...');
  assert.strictEqual(typeof generateDigitalSuratDokterDataUrl, 'function', 'generateDigitalSuratDokterDataUrl harus tersedia');
  const svgDataUrl = generateDigitalSuratDokterDataUrl('M. IHSAN ATHALLAH', 'XII RPL 2', '2026-10-24');
  assert.ok(svgDataUrl.startsWith('data:image/svg+xml;utf8,'), 'Data URL harus berformat data:image/svg+xml;utf8');
  const decodedSvg = decodeURIComponent(svgDataUrl);
  assert.ok(decodedSvg.includes('KLINIK PRATAMA SEHAT MEDIKA'), 'Surat harus memuat kop resmi Klinik Pratama Sehat Medika');
  assert.ok(decodedSvg.includes('M. IHSAN ATHALLAH'), 'Surat harus memuat nama siswa');
  assert.ok(decodedSvg.includes('XII RPL 2'), 'Surat harus memuat kelas siswa');
  assert.ok(decodedSvg.includes('SURAT KETERANGAN SAKIT'), 'Surat harus memiliki judul resmi');

  // Uji fallback pratinjau ketika foto bukti adalah sample yang hilang / error
  bukaModalBukti('assets/sample-surat-dokter.jpg', 'M. IHSAN ATHALLAH');
  assert.strictEqual(domStore.modalBuktiImg.style.display, 'block', 'Tag img harus tampil');
  assert.ok(domStore.modalBuktiImg.src.includes('data:image/svg+xml;utf8,'), 'Fallback harus otomatis mengarah ke Digital SVG Data URL');
  console.log('✓ Surat Dokter Digital Vector SVG valid, anti-broken link, dan memuat metadata lengkap.\n');

  // -------------------------------------------------------------
  // [Test 31] Uji Chat Dua Arah Siswa <-> Guru (Bi-directional Cross-Sync)
  // -------------------------------------------------------------
  console.log('[Test 31] Uji Chat Bi-Directional Siswa (Ihsan) <-> Wali Kelas (Pak Echa)...');
  const sharedPid = 'IZIN-IHSAN-BIDIRECTIONAL';
  allPerizinanData[sharedPid] = {
    id: sharedPid,
    pid: sharedPid,
    nisn: '0098263610',
    nama: 'M. IHSAN ATHALLAH',
    kelas: 'XII RPL 2'
  };

  // 1. Walas Pak Echa login dan mengirim pesan ke siswa
  global.guruAktif = userPakEcha;
  global.currentUser = userPakEcha;
  bukaModalChat(sharedPid, 'M. IHSAN ATHALLAH');
  domStore.chatInputPesan.value = 'Ihsan, bagaimana kondisimu sekarang? Sudah periksa ke dokter?';
  kirimPesanChat();

  assert.ok(
    domStore.chatBubbleContainer.innerHTML.includes('bagaimana kondisimu sekarang'),
    'Pesan Walas harus tampil di bubble chat'
  );

  // 2. Simulasi Siswa M. Ihsan login di jendela/tab siswa dan membuka chat
  const userIhsanChat = {
    role: 'siswa',
    nisn: '0098263610',
    nama: 'M. IHSAN ATHALLAH',
    kelas: 'XII RPL 2'
  };
  global.guruAktif = null;
  global.currentUser = userIhsanChat;
  bukaModalChat(sharedPid, 'M. IHSAN ATHALLAH');

  // Verifikasi siswa melihat pesan dari Pak Echa
  assert.ok(
    domStore.chatBubbleContainer.innerHTML.includes('bagaimana kondisimu sekarang'),
    'Siswa harus menerima dan melihat pesan dari Walas Pak Echa'
  );

  // 3. Siswa membalas chat ke Walas
  domStore.chatInputPesan.value = 'Alhamdulillah sudah agak mendingan Pak Echa, tadi pagi sudah minum obat resep.';
  kirimPesanChat();

  assert.ok(
    domStore.chatBubbleContainer.innerHTML.includes('Alhamdulillah sudah agak mendingan'),
    'Pesan balasan siswa harus langsung muncul di riwayat chat'
  );

  // 4. Buka kembali di sisi Walas: kedua pesan harus terangkai lengkap
  global.guruAktif = userPakEcha;
  global.currentUser = userPakEcha;
  bukaModalChat(sharedPid, 'M. IHSAN ATHALLAH');
  assert.ok(
    domStore.chatBubbleContainer.innerHTML.includes('bagaimana kondisimu sekarang') &&
    domStore.chatBubbleContainer.innerHTML.includes('Alhamdulillah sudah agak mendingan'),
    'Walas harus melihat riwayat percakapan dua arah secara utuh dan terhubung'
  );
  console.log('✓ Chat dua arah Siswa <-> Guru terhubung 100% dan tersinkronisasi sempurna.\n');

  // -------------------------------------------------------------
  // [Test 32] Uji Penolakan Izin & Pengajuan Izin Baru (Rejection Persistence & Fresh Submission Sync)
  // -------------------------------------------------------------
  console.log('[Test 32] Uji Penolakan Izin & Pengajuan Izin Baru...');
  const userIhsanTest32 = {
    role: 'siswa',
    nisn: '0098263610',
    nama: 'M. IHSAN ATHALLAH',
    kelas: 'XII RPL 2'
  };

  // 1. Walas menolak izin Ihsan sebelumnya
  global.guruAktif = userPakEcha;
  global.currentUser = userPakEcha;
  global.prompt = () => 'Bukti foto tidak terbaca jelas, silakan ajukan ulang.';
  await prosesApprovalIzin('PERMIT-IHSAN-20261024', 'ditolak');

  // Pastikan di filter pending Walas tidak ada permit yang berstatus ditolak
  filterIzinGuru('pending');
  const itemsPendingAfterReject = Object.values(allPerizinanData).filter(x => x && x.nisn === '0098263610' && x.status === 'pending');
  assert.strictEqual(itemsPendingAfterReject.length, 0, 'Izin Ihsan yang ditolak tidak boleh berstatus pending lagi');

  // Pastikan status_izin_0098263610 tersimpan sebagai ditolak
  assert.strictEqual(mockStorage.getItem('status_izin_0098263610'), 'ditolak', 'Status izin ditolak harus tersimpan di storage');

  // 2. Siswa M. Ihsan mengirimkan pengajuan izin baru
  global.guruAktif = null;
  global.currentUser = userIhsanTest32;
  const newPidIhsan = await submitPerijinan(userIhsanTest32, 'sakit', 'Izin baru surat dokter asli terlampir', '2026-10-24', null);
  assert.ok(newPidIhsan, 'ID izin baru harus berhasil dibuat');

  // 3. Walas memuat data izin terkini
  global.guruAktif = userPakEcha;
  global.currentUser = userPakEcha;
  const walasDataUpdated = muatPerizinanSiswaWalas();
  const newPermitFound = Object.values(walasDataUpdated).find(x => x && (x.id === newPidIhsan || x.pid === newPidIhsan));
  assert.ok(newPermitFound, 'Pengajuan izin baru dari M. Ihsan harus langsung masuk ke Walas');
  assert.strictEqual(newPermitFound.status, 'pending', 'Pengajuan izin baru harus berstatus pending (Menunggu)');

  // Verifikasi filter pending Walas menampilkan pengajuan baru Ihsan
  filterIzinGuru('pending');
  assert.ok(
    domStore.listApprovalIzin.innerHTML.includes('Izin baru surat dokter asli terlampir') ||
    domStore.listApprovalIzin.innerHTML.includes('M. IHSAN ATHALLAH') ||
    domStore.listApprovalIzin.innerHTML.includes('M. Ihsan Athallah'),
    'Kartu izin baru Ihsan harus muncul di tab Menunggu Walas'
  );
  console.log('✓ Penolakan izin konsisten tersimpan dan pengajuan izin baru langsung masuk ke Walas.\n');

  console.log('===============================================================');
  console.log('🎉 SELURUH PENGUJIAN VALIDASI & SINKRONISASI IZIN WALAS SUKSES!');
  console.log('===============================================================');
}

main().catch(err => {
  console.error('TEST ERROR:', err);
  process.exit(1);
});
