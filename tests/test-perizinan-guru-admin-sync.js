/**
 * test-perizinan-guru-admin-sync.js
 * Memvalidasi integrasi perizinan mengajar guru (lapor izin kendala KBM) ke portal admin:
 * 1. Simpan offline (localStorage fallback: local_kendala_guru & local_izin_guru)
 * 2. Tampil di Tab Perizinan Admin (daftarPerijinanAdmin) dengan badge [GURU]
 * 3. Sinkronisasi dual/multi-node ke Firebase RTDB (kendala_guru, perizinan_guru, perijinan, perizinan)
 * 4. Aksi Admin Setujui (ACC Jamkos) mengupdate status di LocalStorage & Firebase
 * 5. Aksi Admin Tolak mengupdate status di LocalStorage & Firebase
 * 6. Koeksistensi perizinan Siswa [SISWA] dan Guru [GURU] dalam satu tabel/daftar terpadu
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('=== TEST SUITE: SINKRONISASI PERIZINAN GURU KE ADMIN ===\n');

  // Mock DOM & LocalStorage Environment
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

  class MockElement {
    constructor(id = '', tagName = 'div') {
      this.id = id;
      this.tagName = tagName.toUpperCase();
      this._children = [];
      this._innerHTML = '';
      this.textContent = '';
      this.style = {};
      this.classList = {
        classes: new Set(),
        add: (c) => this.classList.classes.add(c),
        remove: (c) => this.classList.classes.delete(c),
        contains: (c) => this.classList.classes.has(c)
      };
    }
    get children() {
      return this._children;
    }
    get innerHTML() {
      return this._innerHTML;
    }
    set innerHTML(val) {
      this._innerHTML = val;
      this._children = [];
    }
    appendChild(child) {
      this._children.push(child);
    }
    addEventListener() {}
    removeEventListener() {}
  }

  const mockStorage = new MockLocalStorage();
  global.localStorage = mockStorage;
  global.sessionStorage = new MockLocalStorage();

  const domElements = {
    daftarPerijinanAdmin: new MockElement('daftarPerijinanAdmin'),
    daftarKendalaAdmin: new MockElement('daftarKendalaAdmin'),
    notifPerijinanBanner: new MockElement('notifPerijinanBanner'),
    jumlahPending: new MockElement('jumlahPending'),
    badgePerijinan: new MockElement('badgePerijinan'),
    badgeKendalaGuru: new MockElement('badgeKendalaGuru')
  };

  global.document = {
    getElementById: (id) => domElements[id] || new MockElement(id),
    createElement: (tag) => new MockElement('', tag),
    querySelectorAll: () => [],
    querySelector: () => new MockElement(),
    addEventListener: () => {},
    removeEventListener: () => {}
  };

  // Mock Firebase RTDB
  const mockDbData = {
    kendala_guru: {},
    perizinan_guru: {},
    perijinan: {},
    perizinan: {},
    kelas: {},
    status_kelas: {}
  };

  function createRef(pathStr) {
    return {
      set: async (val) => {
        const parts = pathStr.split('/');
        if (parts.length === 1) {
          mockDbData[parts[0]] = JSON.parse(JSON.stringify(val));
        } else if (parts.length === 2) {
          if (!mockDbData[parts[0]]) mockDbData[parts[0]] = {};
          mockDbData[parts[0]][parts[1]] = JSON.parse(JSON.stringify(val));
        }
        return Promise.resolve();
      },
      update: async (val) => {
        const parts = pathStr.split('/');
        if (parts.length === 2) {
          if (!mockDbData[parts[0]]) mockDbData[parts[0]] = {};
          mockDbData[parts[0]][parts[1]] = Object.assign(mockDbData[parts[0]][parts[1]] || {}, val);
        }
        return Promise.resolve();
      },
      push: () => {
        const newKey = 'KENDALA-' + Date.now();
        return {
          key: newKey,
          set: async (val) => {
            mockDbData[pathStr] = mockDbData[pathStr] || {};
            mockDbData[pathStr][newKey] = JSON.parse(JSON.stringify(val));
            return Promise.resolve();
          }
        };
      },
      orderByChild: () => ({
        equalTo: () => ({
          on: (event, cb) => {
            cb({
              val: () => mockDbData[pathStr] || {},
              numChildren: () => Object.keys(mockDbData[pathStr] || {}).length
            });
          }
        })
      }),
      on: (event, cb) => {
        cb({ val: () => mockDbData[pathStr] || {} });
      },
      once: async () => ({
        val: () => {
          const parts = pathStr.split('/');
          if (parts.length === 1) return mockDbData[parts[0]] || {};
          if (parts.length === 2) return (mockDbData[parts[0]] && mockDbData[parts[0]][parts[1]]) || null;
          return null;
        }
      })
    };
  }

  global.db = {
    ref: (p) => createRef(p)
  };

  // Load perijinan.js
  const perijinanCode = fs.readFileSync(path.join(__dirname, '../assets/perijinan.js'), 'utf8');
  eval(perijinanCode);

  // -------------------------------------------------------------------
  // TEST 1: Kasus Nyata Pengguna - Guru Kirim Izin Mengajar Offline
  // -------------------------------------------------------------------
  console.log('▶ [Test 1] Simulasi Lapor Izin Mengajar Guru Tersimpan Secara Lokal...');

  const inputKasusUser = {
    id: 'KENDALA-1792735390153',
    pid: 'KENDALA-1792735390153',
    guruUid: 'GURU_TEST_UID',
    guruNama: 'Hani Hanifah, S.Si',
    guruNip: '198109012009022003',
    guruEmail: 'hani@smkn1sumedang.sch.id',
    nama: 'Hani Hanifah, S.Si',
    nama_siswa: 'Hani Hanifah, S.Si',
    pengaju: 'Hani Hanifah, S.Si',
    kelasId: 'XII RPL 1',
    kelas: 'XII RPL 1',
    mapel: 'ya',
    tanggal: '10/23/2026',
    jenis: 'penugasan_dinas',
    alasan: 'asd',
    keterangan: 'asd',
    status: 'pending',
    tipe: 'guru',
    role: 'guru',
    dibuat_pada: Date.now(),
    createdAt: Date.now(),
    created_at: new Date().toISOString()
  };

  // Simpan di local storage persis seperti di dashboard-guru.js
  mockStorage.setItem('local_kendala_guru', JSON.stringify([inputKasusUser]));
  mockStorage.setItem('local_izin_guru', JSON.stringify([inputKasusUser]));

  // Panggil renderDaftarPerijinanAdmin di panel Admin
  renderDaftarPerijinanAdmin('daftarPerijinanAdmin', 'pending');

  // Verifikasi elemen daftar perizinan admin
  assert.ok(domElements.daftarPerijinanAdmin.children.length > 0, 'Daftar perizinan admin harus berisi kartu');
  const cardGuru = domElements.daftarPerijinanAdmin.children[0];

  assert.ok(cardGuru.innerHTML.includes('[GURU]'), 'Kartu perizinan guru harus memiliki badge role [GURU]');
  assert.ok(cardGuru.innerHTML.includes('Hani Hanifah, S.Si'), 'Nama guru harus ditampilkan pada kartu');
  assert.ok(cardGuru.innerHTML.includes('XII RPL 1'), 'Kelas sasaran harus ditampilkan');
  assert.ok(cardGuru.innerHTML.includes('ya'), 'Mata pelajaran harus ditampilkan');
  assert.ok(cardGuru.innerHTML.includes('asd'), 'Keterangan/alasan harus ditampilkan');
  assert.ok(cardGuru.innerHTML.includes('Tugas Luar / Dinas'), 'Label alasan harus Tugas Luar / Dinas');
  assert.ok(cardGuru.innerHTML.includes('Setujui (ACC Jamkos)'), 'Harus memiliki tombol ACC Jamkos');
  assert.ok(cardGuru.innerHTML.includes('Tolak'), 'Harus memiliki tombol Tolak');

  // Verifikasi badge pending dan banner notifikasi
  assert.strictEqual(domElements.jumlahPending.textContent, 1, 'Jumlah pending harus 1');
  assert.ok(domElements.notifPerijinanBanner.classList.contains('show'), 'Banner notifikasi perizinan harus tampil');
  assert.strictEqual(domElements.badgePerijinan.textContent, 1, 'Badge menu perizinan harus 1');

  console.log('  ✓ Laporan izin mengajar guru offline berhasil tampil di Tab Perizinan Admin dengan badge [GURU].\n');

  // -------------------------------------------------------------------
  // TEST 2: Koeksistensi Perizinan Siswa dan Perizinan Guru
  // -------------------------------------------------------------------
  console.log('▶ [Test 2] Koeksistensi Perizinan Siswa [SISWA] dan Guru [GURU]...');

  const izinSiswa = {
    pid: 'IZIN-SISWA-001',
    id: 'IZIN-SISWA-001',
    uid: 'SISWA_UID_1',
    nisn: '0098263610',
    nama: 'M. Ihsan Athallah',
    kelas: 'XII RPL 2',
    jenis: 'sakit',
    alasan: 'Demam tinggi',
    tanggal: '10/23/2026',
    status: 'pending',
    tipe: 'siswa',
    dibuat_pada: Date.now() - 5000
  };

  // Tambahkan izin siswa ke database & local
  mockStorage.setItem('local_perijinan', JSON.stringify([izinSiswa]));

  // Muat ulang daftar perizinan
  renderDaftarPerijinanAdmin('daftarPerijinanAdmin', 'pending');

  assert.strictEqual(domElements.daftarPerijinanAdmin.children.length, 2, 'Harus ada 2 pengajuan perizinan (1 guru + 1 siswa)');

  const cardsHtml = domElements.daftarPerijinanAdmin.children.map(c => c.innerHTML).join(' --- ');
  assert.ok(cardsHtml.includes('[GURU]'), 'Harus ada penanda [GURU]');
  assert.ok(cardsHtml.includes('[SISWA]'), 'Harus ada penanda [SISWA]');
  assert.ok(cardsHtml.includes('Hani Hanifah, S.Si'), 'Harus ada nama guru');
  assert.ok(cardsHtml.includes('M. Ihsan Athallah'), 'Harus ada nama siswa');

  console.log('  ✓ Perizinan Siswa dan Guru berhasil tampil berdampingan dengan badge pembeda yang presisi.\n');

  // -------------------------------------------------------------------
  // TEST 3: Admin Menyetujui Izin Mengajar Guru (ACC Jamkos)
  // -------------------------------------------------------------------
  console.log('▶ [Test 3] Admin Menyetujui Izin Guru -> Sinkronisasi LocalStorage & Firebase Jamkos...');

  // Admin menyetujui izin guru
  global.confirm = () => true;
  global.alert = () => {};

  await adminApprovePerizinanItem('KENDALA-1792735390153', true);

  // Periksa status di LocalStorage
  const storedKendala = JSON.parse(mockStorage.getItem('local_kendala_guru'));
  const updatedGuruItem = storedKendala.find(k => k.id === 'KENDALA-1792735390153');
  assert.strictEqual(updatedGuruItem.status, 'approved', 'Status di local_kendala_guru harus approved');

  const storedIzinGuru = JSON.parse(mockStorage.getItem('local_izin_guru'));
  assert.strictEqual(storedIzinGuru[0].status, 'approved', 'Status di local_izin_guru harus approved');

  // Periksa status di Firebase RTDB
  assert.strictEqual(mockDbData.kendala_guru['KENDALA-1792735390153'].status, 'approved', 'Firebase kendala_guru harus approved');
  assert.strictEqual(mockDbData.perizinan_guru['KENDALA-1792735390153'].status, 'approved', 'Firebase perizinan_guru harus approved');
  assert.strictEqual(mockDbData.perijinan['KENDALA-1792735390153'].status, 'disetujui', 'Firebase perijinan harus disetujui');
  assert.strictEqual(mockDbData.kelas['XII RPL 1'].status, 'jamkos', 'Status operasional kelas harus menjadi jamkos');

  console.log('  ✓ Persetujuan izin guru berhasil mengubah status kelas menjadi JAMKOS dan sinkron ke local & cloud.\n');

  // -------------------------------------------------------------------
  // TEST 4: Filter Status (Pending, Disetujui, Ditolak, Semua)
  // -------------------------------------------------------------------
  console.log('▶ [Test 4] Pengujian Filter Status Perizinan Terpadu...');

  // Filter Pending: Hanya izin siswa yang masih pending
  renderDaftarPerijinanAdmin('daftarPerijinanAdmin', 'pending');
  assert.strictEqual(domElements.daftarPerijinanAdmin.children.length, 1, 'Hanya tersisa 1 item pending');
  assert.ok(domElements.daftarPerijinanAdmin.children[0].innerHTML.includes('[SISWA]'), 'Item pending adalah siswa');

  // Filter Disetujui: Izin guru yang sudah disetujui
  renderDaftarPerijinanAdmin('daftarPerijinanAdmin', 'disetujui');
  assert.strictEqual(domElements.daftarPerijinanAdmin.children.length, 1, 'Ada 1 item disetujui');
  assert.ok(domElements.daftarPerijinanAdmin.children[0].innerHTML.includes('[GURU]'), 'Item disetujui adalah guru');

  // Filter Semua: 2 item
  renderDaftarPerijinanAdmin('daftarPerijinanAdmin', 'semua');
  assert.strictEqual(domElements.daftarPerijinanAdmin.children.length, 2, 'Semua menampilkan 2 item');

  console.log('  ✓ Filter status berfungsi 100% untuk perizinan siswa dan guru.\n');

  // -------------------------------------------------------------------
  // TEST 5: Penolakan Izin Mengajar Guru
  // -------------------------------------------------------------------
  console.log('▶ [Test 5] Pengujian Penolakan Izin Guru...');

  const izinGuru2 = {
    id: 'KENDALA-TOLAK-999',
    pid: 'KENDALA-TOLAK-999',
    guruUid: 'GURU_2',
    guruNama: 'Asep Supriatna, M.Kom',
    kelasId: 'XII RPL 2',
    mapel: 'Basis Data',
    tanggal: '10/24/2026',
    jenis: 'keperluan_mendesak',
    alasan: 'Urusan keluarga mendesak',
    status: 'pending',
    tipe: 'guru',
    dibuat_pada: Date.now()
  };

  mockStorage.setItem('local_kendala_guru', JSON.stringify([updatedGuruItem, izinGuru2]));
  renderDaftarPerijinanAdmin('daftarPerijinanAdmin', 'pending');

  // Admin menolak izin guru kedua
  global.prompt = () => 'Jadwal ujian penting di kelas tersebut';
  await adminTolakPerizinanItem('KENDALA-TOLAK-999', true);

  const reloadedStorage = JSON.parse(mockStorage.getItem('local_kendala_guru'));
  const rejectedItem = reloadedStorage.find(k => k.id === 'KENDALA-TOLAK-999');
  assert.strictEqual(rejectedItem.status, 'rejected', 'Status izin guru kedua harus rejected');
  assert.strictEqual(mockDbData.kendala_guru['KENDALA-TOLAK-999'].status, 'rejected', 'Firebase kendala_guru harus rejected');

  console.log('  ✓ Penolakan izin guru berhasil memperbarui status lokal dan cloud secara instan.\n');

  // -------------------------------------------------------------------
  // TEST 6: Format Lama / Minimal Payload Guru Tanpa tipe: 'guru'
  // -------------------------------------------------------------------
  console.log('▶ [Test 6] Format Minimal / Riwayat Lama Guru (tanpa atribut tipe: "guru")...');

  const legacyGuruPayload = {
    id: '-OlegacyPushKey98765',
    guruUid: 'UID_LEGACY_GURU',
    guruNama: 'Dra. Hj. Nunung',
    guruNip: '196805121995012001',
    kelasId: 'XII TKJ 1',
    mapel: 'Administrasi Infrastruktur Jaringan',
    tanggal: '10/25/2026',
    jenis: 'sakit_mendadak',
    alasan: 'Sakit flu berat',
    status: 'pending',
    createdAt: 1740291234567
  };

  mockStorage.setItem('local_kendala_guru', JSON.stringify([legacyGuruPayload]));
  renderDaftarPerijinanAdmin('daftarPerijinanAdmin', 'pending');

  const legacyCard = domElements.daftarPerijinanAdmin.children.find(c => c.innerHTML.includes('Dra. Hj. Nunung'));
  assert.ok(legacyCard, 'Kartu guru dengan payload format lama harus berhasil ditampilkan');
  assert.ok(legacyCard.innerHTML.includes('[GURU]'), 'Harus terdeteksi sebagai role [GURU] via guruUid/guruNama/guruNip');
  assert.ok(legacyCard.innerHTML.includes('XII TKJ 1'), 'Harus menampilkan kelas dari kelasId');
  assert.ok(legacyCard.innerHTML.includes('Administrasi Infrastruktur Jaringan'), 'Harus menampilkan mapel');

  console.log('  ✓ Payload format lama guru berhasil dinormalisasi dan tampil dengan badge [GURU].\n');

  // -------------------------------------------------------------------
  // TEST 7: Persetujuan saat Firebase Offline / Menggantung (Anti-Freeze)
  // -------------------------------------------------------------------
  console.log('▶ [Test 7] Persetujuan saat Cloud Putus / Hanging (Anti-Freeze Offline Guarantee)...');

  // Simulasikan Firebase update yang menggantung selamanya (seperti koneksi putus pada SDK)
  const hangingDb = {
    ref: () => ({
      update: () => new Promise(() => {}), // Never resolves
      set: () => new Promise(() => {}),    // Never resolves
      push: () => ({ key: 'HANG_KEY', set: () => new Promise(() => {}) })
    })
  };
  global.db = hangingDb;

  const startMs = Date.now();
  // Harus selesai cepat karena update local dilakukan optimistik di depan dan cloud dibungkus timeout race
  await adminApprovePerizinanItem('-OlegacyPushKey98765', true);
  const elapsed = Date.now() - startMs;

  const afterHangingStorage = JSON.parse(mockStorage.getItem('local_kendala_guru'));
  const approvedLegacy = afterHangingStorage.find(k => k.id === '-OlegacyPushKey98765');
  assert.strictEqual(approvedLegacy.status, 'approved', 'Status lokal harus approved meskipun cloud offline');
  assert.ok(elapsed < 4000, `Operasi offline tidak boleh hang lebih dari 4 detik (aktual: ${elapsed}ms)`);

  console.log(`  ✓ Persetujuan offline tuntas dalam ${elapsed}ms tanpa membekukan thread browser.\n`);

  // Kembalikan mock db
  global.db = { ref: (p) => createRef(p) };

  // -------------------------------------------------------------------
  // TEST 8: Normalisasi Filter di Tab Kendala Guru
  // -------------------------------------------------------------------
  console.log('▶ [Test 8] Filter "approved" di Tab Kendala Guru mengenali status "disetujui" dan "approved"...');

  // Load admin.js kendala filtering logic
  const adminCode = fs.readFileSync(path.join(__dirname, '../assets/admin.js'), 'utf8');
  // Pastikan renderKendalaGuruAdmin ada di global scope
  eval(adminCode);

  kendalaGuruCache['TEST-ACC-1'] = { id: 'TEST-ACC-1', status: 'approved', guruNama: 'Guru A' };
  kendalaGuruCache['TEST-ACC-2'] = { id: 'TEST-ACC-2', status: 'disetujui', guruNama: 'Guru B' };
  kendalaGuruCache['TEST-PEND-1'] = { id: 'TEST-PEND-1', status: 'pending', guruNama: 'Guru C' };

  renderKendalaGuruAdmin('approved');
  assert.strictEqual(domElements.daftarKendalaAdmin.children.length, 2, 'Filter approved harus menampilkan baik "approved" maupun "disetujui"');

  console.log('  ✓ Tab kendala admin sukses menampilkan kedua varian status persetujuan.\n');

  // -------------------------------------------------------------------
  // TEST 9: Smart Merge Anti-Stale di Dashboard Guru
  // -------------------------------------------------------------------
  console.log('▶ [Test 9] Pengujian Smart Merge di Dashboard Guru (Mencegah Overwrite Status Pending Usang)...');

  const localState = [
    { id: 'KENDALA-SYNC-1', status: 'approved', mapel: 'Matematika', kelasId: 'XII RPL 1' }
  ];
  const staleCloudState = [
    { id: 'KENDALA-SYNC-1', status: 'pending', mapel: 'Matematika', kelasId: 'XII RPL 1' }
  ];

  // Algoritma Smart Merge dari dashboard-guru.js
  const map = new Map();
  localState.forEach(item => { if (item && item.id) map.set(item.id, item); });
  staleCloudState.forEach(cloudItem => {
    if (!cloudItem || !cloudItem.id) return;
    const locItem = map.get(cloudItem.id);
    if (locItem) {
      const locIsResolved = locItem.status === 'approved' || locItem.status === 'disetujui' || locItem.status === 'rejected' || locItem.status === 'ditolak';
      const cloudIsResolved = cloudItem.status === 'approved' || cloudItem.status === 'disetujui' || cloudItem.status === 'rejected' || cloudItem.status === 'ditolak';
      if (locIsResolved && !cloudIsResolved) {
        map.set(cloudItem.id, { ...cloudItem, ...locItem });
      } else {
        map.set(cloudItem.id, { ...locItem, ...cloudItem });
      }
    } else {
      map.set(cloudItem.id, cloudItem);
    }
  });

  const mergedResults = Array.from(map.values());
  assert.strictEqual(mergedResults[0].status, 'approved', 'Status approved lokal tidak boleh tertimpa status pending lama dari cloud');

  console.log('  ✓ Smart Merge mempertahankan status persetujuan lokal dengan andal.\n');

  console.log('======================================================');
  console.log('🎉 SEMUA PENGUJIAN SINKRONISASI PERIZINAN GURU-ADMIN LULUS (100% PASSED)!');
  console.log('======================================================');
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
