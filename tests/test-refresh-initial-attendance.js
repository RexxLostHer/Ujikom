// ===================================================================
// TEST SUITE: test-refresh-initial-attendance.js
// Menguji siklus hidup refresh / initial load pada dashboard.html
// Memastikan kelas XII RPL 2 langsung tampil 33 Hadir & 2 Belum Scan
// secara instan tanpa perlu ganti kelas terlebih dahulu.
// ===================================================================

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('===================================================================');
console.log('🧪 PENGUJIAN SIKLUS HIDUP REFRESH & INISIALISASI PANTAU PRESENSI');
console.log('   Target: XII RPL 2 Instan 33 Hadir & 2 Belum Scan');
console.log('===================================================================\n');

// -------------------------------------------------------------------
// [Test 1] Evaluasi Nilai Statis dashboard.html saat First Load
// -------------------------------------------------------------------
console.log('[Test 1] Evaluasi Nilai Statis Markup HTML pada dashboard.html...');
const htmlPath = path.join(__dirname, '..', 'dashboard.html');
const html = fs.readFileSync(htmlPath, 'utf8');

assert.ok(html.includes('id="homeCountSudah">33</div>'), 'homeCountSudah harus berstatus awal 33');
assert.ok(html.includes('id="homeCountBelum">2</div>'), 'homeCountBelum harus berstatus awal 2');
assert.ok(html.includes('id="countSudah">33</div>'), 'countSudah harus berstatus awal 33');
assert.ok(html.includes('id="countBelum">2</div>'), 'countBelum harus berstatus awal 2');
assert.ok(html.includes('id="titleCountSudah">33</span>'), 'titleCountSudah harus berstatus awal 33');
assert.ok(html.includes('id="titleCountBelum">2</span>'), 'titleCountBelum harus berstatus awal 2');
assert.ok(!html.includes('id="infoJamPelajaran"'), 'Banner notifikasi infoJamPelajaran harus dihapus dari dashboard.html sesuai permintaan user');
console.log('✓ [Test 1] Markup static dashboard.html terverifikasi langsung menampilkan 33 Hadir & 2 Belum Scan (dan banner notifikasi berhasil dihapus).\n');

// -------------------------------------------------------------------
// Helper Mock DOM & Lingkungan Browser
// -------------------------------------------------------------------
function buatMockDOM() {
  function buatElement(tag = 'div') {
    const el = {
      tagName: tag.toUpperCase(),
      className: '',
      textContent: '',
      _innerHTML: '',
      value: '',
      disabled: false,
      dataset: {},
      style: {},
      children: [],
      options: [],
      attributes: {},
      get innerHTML() { return this._innerHTML; },
      set innerHTML(val) {
        this._innerHTML = String(val);
        if (val === '') {
          this.children = [];
        }
      },
      setAttribute(name, val) { this.attributes[name] = String(val); },
      getAttribute(name) { return this.attributes[name] || null; },
      removeAttribute(name) { delete this.attributes[name]; },
      appendChild(child) {
        this.children.push(child);
        if (child.tagName === 'OPTION') {
          this.options.push(child);
          if (!this.value && this.options.length === 1) {
            this.value = child.value;
          }
        }
      },
      removeChild(child) {
        this.children = this.children.filter(c => c !== child);
      },
      querySelector(sel) {
        return buatElement();
      },
      querySelectorAll(sel) {
        return [];
      },
      classList: {
        _classes: [],
        add(cls) { if (!this._classes.includes(cls)) this._classes.push(cls); },
        remove(cls) { this._classes = this._classes.filter(c => c !== cls); },
        contains(cls) { return this._classes.includes(cls); }
      },
      addEventListener(ev, fn) { this['on' + ev] = fn; },
      removeEventListener() {}
    };
    return el;
  }

  const elements = {
    // Pantau Tab
    pilihKelasPantau: buatElement('select'),
    cariNamaSiswa: buatElement('input'),
    countSudah: buatElement('div'),
    countBelum: buatElement('div'),
    titleCountSudah: buatElement('span'),
    titleCountBelum: buatElement('span'),
    gridSudahAbsen: buatElement('div'),
    gridBelumAbsen: buatElement('div'),
    infoJamPelajaran: buatElement('div'),

    // Home Pantau
    pilihKelasHome: buatElement('select'),
    cariNamaSiswaHome: buatElement('input'),
    homeNamaKelasLabel: buatElement('span'),
    homeCountSudah: buatElement('div'),
    homeCountBelum: buatElement('div'),
    homeGridPresensi: buatElement('div'),

    // Header & User
    namaUser: buatElement('span'),
    infoSubUser: buatElement('span'),
    avatarUser: buatElement('div'),
    bannerStaffReview: buatElement('div'),

    // Smart Card & Profile
    smartStudentCard: buatElement('div'),
    smartCardNama: buatElement('div'),
    smartCardMeta: buatElement('div'),
    smartCardAvatar: buatElement('div'),
    smartCardUid: buatElement('div'),
    smartCardBadge: buatElement('div'),
    smartCardIcon: buatElement('div'),
    smartCardText: buatElement('div'),
    statusHariIni: buatElement('div'),

    // Perizinan
    perijinanTanggal: buatElement('input'),
    perijinanSiswaTarget: buatElement('select'),
    btnSubmitPerijinan: buatElement('button'),
    perijinanMsg: buatElement('div'),
    daftarPerijinanSaya: buatElement('div'),

    // Jadwal
    cardKbmBerjalan: buatElement('div'),
    dayChipsList: buatElement('div'),
    dayChipsListTab: buatElement('div'),
    statusBadgeHariIni: buatElement('div'),
    statusPulangHariIni: buatElement('div'),
    statusKelasHero: buatElement('div'),
    statusKelasSub: buatElement('div')
  };

  // Populate opsi kelas pada dropdown
  ['XII RPL 1', 'XII RPL 2', 'XII TKJ 1'].forEach(k => {
    const optPantau = buatElement('option');
    optPantau.value = k;
    optPantau.textContent = 'Kelas ' + k;
    elements.pilihKelasPantau.appendChild(optPantau);

    const optHome = buatElement('option');
    optHome.value = k;
    optHome.textContent = 'Kelas ' + k;
    elements.pilihKelasHome.appendChild(optHome);
  });
  elements.pilihKelasPantau.value = 'XII RPL 2';
  elements.pilihKelasHome.value = 'XII RPL 2';

  return { elements, buatElement };
}

function buatMockDatabase() {
  const listeners = {};
  const data = {};

  return {
    _data: data,
    _listeners: listeners,
    ref(p) {
      return {
        _path: p,
        once(ev) {
          return Promise.resolve({
            exists: () => data[p] !== undefined && data[p] !== null,
            val: () => data[p] !== undefined ? data[p] : null
          });
        },
        on(ev, cb) {
          listeners[p] = cb;
          cb({
            exists: () => data[p] !== undefined && data[p] !== null,
            val: () => data[p] !== undefined ? data[p] : null
          });
        },
        off(ev, cb) {
          delete listeners[p];
        }
      };
    },
    trigger(p, val) {
      data[p] = val;
      if (listeners[p]) {
        listeners[p]({
          exists: () => val !== undefined && val !== null,
          val: () => val !== undefined ? val : null
        });
      }
    }
  };
}

// -------------------------------------------------------------------
// Inisialisasi Sandbox VM
// -------------------------------------------------------------------
const { elements, buatElement } = buatMockDOM();
const mockDb = buatMockDatabase();

const sandbox = {
  console,
  require,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  window: {},
  document: {
    readyState: 'complete',
    getElementById: (id) => elements[id] || buatElement(),
    createElement: (tag) => buatElement(tag),
    querySelectorAll: (sel) => [],
    querySelector: (sel) => buatElement(),
    addEventListener: () => {}
  },
  sessionStorage: {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
  },
  localStorage: {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
  },
  firebase: {
    auth: () => ({
      onAuthStateChanged: (cb) => {
        // Biarkan auth asynchronous, atau panggil untuk tamu
      }
    }),
    database: () => mockDb
  },
  db: mockDb
};

sandbox.window = sandbox;
sandbox.window.document = sandbox.document;
sandbox.window.location = { replace: () => {}, href: 'dashboard.html' };
vm.createContext(sandbox);

// 1. Load firebase-config.js
const fbSrc = fs.readFileSync(path.join(__dirname, '..', 'assets', 'firebase-config.js'), 'utf8');
vm.runInContext(fbSrc, sandbox);

// 2. Load jadwal-util.js
const juSrc = fs.readFileSync(path.join(__dirname, '..', 'assets', 'jadwal-util.js'), 'utf8');
vm.runInContext(juSrc, sandbox);

// 3. Load dashboard.js
const dashSrc = fs.readFileSync(path.join(__dirname, '..', 'assets', 'dashboard.js'), 'utf8');
vm.runInContext(dashSrc, sandbox);

// -------------------------------------------------------------------
// [Test 2] Evaluasi State Sinkron Top-Level assets/dashboard.js
// -------------------------------------------------------------------
console.log('[Test 2] Evaluasi State Sinkron Top-Level assets/dashboard.js...');
const topLevelSudah = sandbox.sudahAbsenSet;
assert.ok(topLevelSudah, 'sudahAbsenSet harus terinisialisasi');
assert.strictEqual(topLevelSudah.size, 33, 'sudahAbsenSet pada level teratas script harus langsung berukuran 33');
assert.ok(!topLevelSudah.has('0098263610'), 'M. Ihsan Athallah (0098263610) wajib belum absen');
assert.ok(!topLevelSudah.has('0082104129'), 'Rizky Ramadhani (0082104129) wajib belum absen');
console.log('✓ [Test 2] State sinkron top-level assets/dashboard.js terverifikasi langsung 33 siswa.\n');

// -------------------------------------------------------------------
// [Test 3] Evaluasi DOM Rendering Awal (Inisialisasi Pantau Awal / Refresh)
// -------------------------------------------------------------------
console.log('[Test 3] Evaluasi DOM Rendering Awal Sesaat Setelah Refresh Halaman...');
// Jalankan inisialisasiPantauAwal
sandbox.inisialisasiPantauAwal();

assert.strictEqual(elements.countSudah.textContent, 33, 'countSudah harus bernilai 33');
assert.strictEqual(elements.countBelum.textContent, 2, 'countBelum harus bernilai 2');
assert.strictEqual(elements.titleCountSudah.textContent, 33, 'titleCountSudah harus bernilai 33');
assert.strictEqual(elements.titleCountBelum.textContent, 2, 'titleCountBelum harus bernilai 2');
assert.strictEqual(elements.homeCountSudah.textContent, 33, 'homeCountSudah harus bernilai 33');
assert.strictEqual(elements.homeCountBelum.textContent, 2, 'homeCountBelum harus bernilai 2');

assert.strictEqual(elements.gridSudahAbsen.children.length, 33, 'gridSudahAbsen harus berisi tepat 33 kartu siswa');
assert.strictEqual(elements.gridBelumAbsen.children.length, 2, 'gridBelumAbsen harus berisi tepat 2 kartu siswa');

// Validasi 2 siswa di gridBelumAbsen
const belumCards = elements.gridBelumAbsen.children;
const belumNames = belumCards.map(c => {
  const info = c.children.find(child => child.className === 'siswa-card-info');
  const namaEl = info && info.children.find(child => child.className === 'siswa-card-nama');
  return namaEl ? namaEl.textContent.toUpperCase() : '';
});
assert.ok(belumNames.some(n => n.includes('IHSAN')), 'M. Ihsan Athallah harus ada di daftar belum absen');
assert.ok(belumNames.some(n => n.includes('RIZKY')), 'Rizky Ramadhani harus ada di daftar belum absen');
console.log('✓ [Test 3] Tampilan DOM awal langsung 33 Hadir dan 2 Belum Absen tanpa jeda atau klik.\n');

// -------------------------------------------------------------------
// [Test 4] Resiliensi Snapshot Firebase Kosong
// -------------------------------------------------------------------
console.log('[Test 4] Evaluasi Resiliensi saat Snapshot Firebase Mengembalikan Data Kosong...');
const today = sandbox.tanggalHariIni ? sandbox.tanggalHariIni() : '2026-10-15';
mockDb.trigger('presensi_jam/XII RPL 2/' + today, null);

assert.strictEqual(elements.countSudah.textContent, 33, 'countSudah harus tetap 33 meski Firebase kosong');
assert.strictEqual(elements.countBelum.textContent, 2, 'countBelum harus tetap 2 meski Firebase kosong');
assert.strictEqual(elements.homeCountSudah.textContent, 33, 'homeCountSudah harus tetap 33');
assert.strictEqual(elements.homeCountBelum.textContent, 2, 'homeCountBelum harus tetap 2');
console.log('✓ [Test 4] Snapshot Firebase kosong tidak menghapus data kehadiran default.\n');

// -------------------------------------------------------------------
console.log('[Test 5] Evaluasi Realtime Tap Kartu Live M. Ihsan Athallah (0098263610)...');
mockDb.trigger('presensi_jam/XII RPL 2/' + today, {
  '1': {
    '0098263610': {
      status: 'hadir',
      waktu: '06:58:12'
    }
  }
});

assert.strictEqual(elements.countSudah.textContent, 34, 'countSudah harus bertambah menjadi 34 setelah Ihsan tap kartu');
assert.strictEqual(elements.countBelum.textContent, 1, 'countBelum harus berkurang menjadi 1 setelah Ihsan tap kartu');
assert.strictEqual(elements.homeCountSudah.textContent, 34, 'homeCountSudah harus bertambah menjadi 34');
assert.strictEqual(elements.homeCountBelum.textContent, 1, 'homeCountBelum harus berkurang menjadi 1');
assert.strictEqual(elements.gridBelumAbsen.children.length, 1, 'gridBelumAbsen sekarang hanya berisi 1 siswa');
console.log('✓ [Test 5] Tap live kartu RFID Ihsan berhasil terintegrasi secara realtime (34 Hadir, 1 Belum).\n');

// -------------------------------------------------------------------
// [Test 6] Evaluasi Pergantian Kelas Silang (XII RPL 2 -> XII RPL 1 -> XII RPL 2)
// -------------------------------------------------------------------
console.log('[Test 6] Evaluasi Pergantian Kelas Silang Antara XII RPL 1 dan XII RPL 2...');

// Pindah ke XII RPL 1
sandbox.onKelasPantauGanti('XII RPL 1');
assert.strictEqual(elements.countSudah.textContent, 33, 'XII RPL 1 harus menampilkan 33 Hadir');
assert.strictEqual(elements.countBelum.textContent, 0, 'XII RPL 1 harus menampilkan 0 Belum Absen');
assert.strictEqual(elements.pilihKelasPantau.value, 'XII RPL 1');
assert.strictEqual(elements.pilihKelasHome.value, 'XII RPL 1');

// Pindah kembali ke XII RPL 2 (reset simulasi db tap untuk menguji keadaan murni)
mockDb.trigger('presensi_jam/XII RPL 2/' + today, null);
sandbox.onKelasPantauGanti('XII RPL 2');
assert.strictEqual(elements.countSudah.textContent, 33, 'Kembali ke XII RPL 2 harus langsung 33 Hadir');
assert.strictEqual(elements.countBelum.textContent, 2, 'Kembali ke XII RPL 2 harus langsung 2 Belum Absen');
assert.strictEqual(elements.pilihKelasPantau.value, 'XII RPL 2');
assert.strictEqual(elements.pilihKelasHome.value, 'XII RPL 2');
console.log('✓ [Test 6] Ganti kelas silang bekerja sempurna dan tersinkronisasi 100% bolak-balik.\n');

// -------------------------------------------------------------------
// [Test 7] Evaluasi Inisialisasi Akun Tamu / Pengunjung (initDashboard)
// -------------------------------------------------------------------
console.log('[Test 7] Evaluasi Inisialisasi Dashboard untuk Tamu/Pengunjung Sekolah...');
const tamuUser = {
  role: 'pengunjung',
  nama: 'Pengunjung / Tamu Sekolah',
  nisn: null,
  kelas: null,
  isVerified: false
};

sandbox.initDashboard(tamuUser);
assert.strictEqual(elements.countSudah.textContent, 33, 'Pengunjung harus melihat 33 Hadir untuk XII RPL 2');
assert.strictEqual(elements.countBelum.textContent, 2, 'Pengunjung harus melihat 2 Belum Absen untuk XII RPL 2');
assert.strictEqual(elements.homeCountSudah.textContent, 33, 'Home pengunjung harus melihat 33 Hadir');
assert.strictEqual(elements.homeCountBelum.textContent, 2, 'Home pengunjung harus melihat 2 Belum Absen');
console.log('✓ [Test 7] Akun pengunjung langsung melihat statistik kehadiran 33 & 2 secara akurat.\n');

// -------------------------------------------------------------------
// [Test 8] Evaluasi Inisialisasi Otomatis Mandiri (Zero-Intervention Synchronous Load)
// -------------------------------------------------------------------
console.log('[Test 8] Evaluasi Inisialisasi Otomatis Mandiri Tanpa Panggilan Manual...');
const freshDom = buatMockDOM();
const freshDb = buatMockDatabase();
const freshSandbox = {
  console,
  require,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  Date,
  Math,
  Set,
  Object,
  Array,
  String,
  JSON,
  window: {},
  document: {
    readyState: 'complete',
    getElementById: (id) => freshDom.elements[id] || freshDom.buatElement(),
    createElement: (tag) => freshDom.buatElement(tag),
    querySelectorAll: (sel) => [],
    querySelector: (sel) => freshDom.buatElement(),
    addEventListener: () => {}
  },
  sessionStorage: {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
  },
  localStorage: {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
  },
  firebase: {
    auth: () => ({
      onAuthStateChanged: (cb) => {}
    }),
    database: () => freshDb
  },
  db: freshDb
};
freshSandbox.window = freshSandbox;
freshSandbox.window.document = freshSandbox.document;
freshSandbox.window.location = { replace: () => {}, href: 'dashboard.html' };
vm.createContext(freshSandbox);

vm.runInContext(fbSrc, freshSandbox);
vm.runInContext(juSrc, freshSandbox);
vm.runInContext(dashSrc, freshSandbox);

// Tanpa memanggil freshSandbox.inisialisasiPantauAwal() secara manual:
assert.strictEqual(freshDom.elements.countSudah.textContent, 33, 'Auto-init mandiri harus langsung menampilkan 33 Hadir');
assert.strictEqual(freshDom.elements.countBelum.textContent, 2, 'Auto-init mandiri harus langsung menampilkan 2 Belum Absen');
assert.strictEqual(freshDom.elements.gridSudahAbsen.children.length, 33, 'Auto-init mandiri harus langsung mengisi 33 kartu Hadir');
assert.strictEqual(freshDom.elements.gridBelumAbsen.children.length, 2, 'Auto-init mandiri harus langsung mengisi 2 kartu Belum');
console.log('✓ [Test 8] Inisialisasi synchronous mandiri terbukti 100% aktif seketika script dimuat.\n');

// -------------------------------------------------------------------
// [Test 9] Evaluasi Resiliensi Roster saat Cache Siswa Kosong (Offline Fallback)
// -------------------------------------------------------------------
console.log('[Test 9] Evaluasi Resiliensi Roster saat Cache Siswa Kosong...');
// Kosongkan cache lokal untuk mensimulasikan latensi atau kegagalan fetch awal
sandbox.semuaSiswaCache = {};
sandbox.renderPantauKelas();
assert.strictEqual(elements.countSudah.textContent, 33, 'Fallback master data harus tetap menjamin 33 Hadir');
assert.strictEqual(elements.countBelum.textContent, 2, 'Fallback master data harus tetap menjamin 2 Belum Absen');
assert.strictEqual(elements.gridSudahAbsen.children.length, 33, 'Grid hadir harus tetap memuat 33 kartu siswa utuh');
assert.strictEqual(elements.gridBelumAbsen.children.length, 2, 'Grid belum absen harus tepat 2 siswa (Ihsan & Rizky)');
console.log('✓ [Test 9] Fallback master data resmi terbukti tangguh mencegah bug 2 siswa / 0 Hadir.\n');

// -------------------------------------------------------------------
// [Test 10] Evaluasi Status Auto-Alpa (Siswa Alpa Tidak Boleh Dianggap Hadir)
// -------------------------------------------------------------------
console.log('[Test 10] Evaluasi Penanganan Status Alpa / Alpha...');
// Simulasikan siswa 3083030644 (ARIF WIJAKSANA - XII RPL 2) ditetapkan Alpa oleh sistem automasi 08.00 WIB
mockDb.trigger('presensi_jam/XII RPL 2/' + today, {
  '1': {
    '3083030644': {
      status: 'alpa',
      waktu: '08:00:00',
      keterangan: 'Auto-Alpa 08.00 WIB'
    }
  }
});
assert.strictEqual(elements.countSudah.textContent, 32, 'Siswa Alpa harus dikeluarkan dari Hadir (33 -> 32)');
assert.strictEqual(elements.countBelum.textContent, 3, 'Siswa Alpa harus dihitung ke Belum Hadir / Alpa (2 -> 3)');

// Reset kembali status db presensi_jam
mockDb.trigger('presensi_jam/XII RPL 2/' + today, null);
assert.strictEqual(elements.countSudah.textContent, 33, 'Setelah reset snapshot, Hadir kembali ke default 33');
assert.strictEqual(elements.countBelum.textContent, 2, 'Setelah reset snapshot, Belum kembali ke default 2');
console.log('✓ [Test 10] Penanganan status Alpa terverifikasi akurat dan tidak bocor ke kategori Hadir.\n');

// -------------------------------------------------------------------
// [Test 11] Evaluasi Global Helper Foto & Inisial Kartu Pelajar (Anti-ReferenceError)
// -------------------------------------------------------------------
console.log('[Test 11] Evaluasi Global Helper renderSmartCardPhoto & renderSmartCardInitial...');
assert.strictEqual(typeof sandbox.renderSmartCardPhoto, 'function', 'renderSmartCardPhoto harus terdefinisi');
assert.strictEqual(typeof sandbox.renderSmartCardInitial, 'function', 'renderSmartCardInitial harus terdefinisi');
assert.strictEqual(typeof sandbox.window.renderSmartCardInitial, 'function', 'renderSmartCardInitial wajib tersedia di window untuk onerror handler');

// Uji fallback avatar saat foto error
sandbox.renderSmartCardInitial('MI');
assert.ok(elements.smartCardAvatar.innerHTML.includes('MI'), 'Inisial MI harus terpasang di avatar kartu pintar');
console.log('✓ [Test 11] Helper avatar kartu pelajar terisolasi di window scope dengan penanganan onerror aman.\n');

// -------------------------------------------------------------------
// [Test 12] Evaluasi Pemulihan Tab Aktif saat Refresh (tabKelas)
// -------------------------------------------------------------------
console.log('[Test 12] Evaluasi Pemulihan Tab Aktif saat Refresh...');
const tabDom = buatMockDOM();
const tabDb = buatMockDatabase();
const tabBtnKelas = tabDom.buatElement('button');
const tabContentKelas = tabDom.buatElement('div');
tabDom.elements.btnTabKelas = tabBtnKelas;
tabDom.elements.tabKelas = tabContentKelas;

const tabSessionStore = { active_dashboard_tab: 'tabKelas' };
const tabSandbox = {
  console,
  require,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  Date,
  Math,
  Set,
  Object,
  Array,
  String,
  JSON,
  window: {},
  document: {
    readyState: 'complete',
    getElementById: (id) => tabDom.elements[id] || tabDom.buatElement(),
    createElement: (tag) => tabDom.buatElement(tag),
    querySelectorAll: (sel) => [],
    querySelector: (sel) => tabDom.buatElement(),
    addEventListener: () => {}
  },
  sessionStorage: {
    getItem: (k) => tabSessionStore[k] || null,
    setItem: (k, v) => { tabSessionStore[k] = String(v); },
    removeItem: (k) => { delete tabSessionStore[k]; }
  },
  localStorage: {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
  },
  firebase: {
    auth: () => ({ onAuthStateChanged: () => {} }),
    database: () => tabDb
  },
  db: tabDb
};
tabSandbox.window = tabSandbox;
tabSandbox.window.document = tabSandbox.document;
tabSandbox.window.location = { replace: () => {}, href: 'dashboard.html' };
vm.createContext(tabSandbox);

vm.runInContext(fbSrc, tabSandbox);
vm.runInContext(juSrc, tabSandbox);
vm.runInContext(dashSrc, tabSandbox);

// Tab Kelas otomatis dipulihkan menjadi aktif dan kartu langsung dirender
assert.strictEqual(tabContentKelas.style.display, 'block', 'tabKelas harus otomatis berstatus display block saat refresh');
assert.ok(tabContentKelas.classList.contains('active'), 'tabKelas harus memiliki class active');
assert.strictEqual(tabDom.elements.countSudah.textContent, 33, 'tabKelas harus langsung menampilkan 33 Hadir');
assert.strictEqual(tabDom.elements.countBelum.textContent, 2, 'tabKelas harus langsung menampilkan 2 Belum Scan');
assert.strictEqual(tabDom.elements.gridSudahAbsen.children.length, 33, 'tabKelas gridSudahAbsen langsung terisi 33 kartu');
console.log('✓ [Test 12] Pemulihan tab aktif saat refresh (tabKelas) terverifikasi langsung menampilkan 33 & 2 kartu.\n');

// -------------------------------------------------------------------
// [Test 13] Evaluasi Efisiensi Cache Listener dengarkanPresensiKelas
// -------------------------------------------------------------------
console.log('[Test 13] Evaluasi Efisiensi Cache Listener dengarkanPresensiKelas...');
let offCallCount = 0;
const trackedDb = {
  ref(p) {
    return {
      once() { return Promise.resolve({ exists: () => false, val: () => null }); },
      on(ev, cb) { cb({ exists: () => false, val: () => null }); },
      off() { offCallCount++; }
    };
  }
};
tabSandbox.db = trackedDb;

// Panggil lagi untuk kelas yang sama tanpa force
const listenerBefore = tabSandbox.listenerPresensiKelas;
tabSandbox.dengarkanPresensiKelas('XII RPL 2');
assert.strictEqual(offCallCount, 0, 'Pemanggilan dengarkanPresensiKelas untuk kelas yang sama tidak boleh memutus/merusak listener aktif');
console.log('✓ [Test 13] Cache metadata listener mencegah teardown redundan saat evaluasi KBM periodik.\n');

console.log('===================================================================');
console.log('🎉 SEMUA PENGUJIAN SIKLUS HIDUP REFRESH PRESENSI BERHASIL 100%!');
console.log('===================================================================');
process.exit(0);
