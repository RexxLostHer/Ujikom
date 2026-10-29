/**
 * test-pengajuan-izin-siswa-permission-resilience.js
 * Memvalidasi ketahanan pengajuan izin siswa terhadap error Firebase RTDB:
 * "permission_denied at /siswa/0098263610: Client doesn't have permission to access the desired data."
 *
 * Verifikasi:
 * 1. Form pengajuan izin siswa (M. Ihsan Athallah - 0098263610) tetap berhasil dikirim
 *    meskipun Firebase RTDB menolak akses baca/tulis ke node master /siswa/{nisn}.
 * 2. Pesan sukses hijau ditampilkan dan form di-reset dengan benar.
 * 3. Data izin tersimpan di node cloud /perizinan & /perijinan dan antrean localStorage:
 *    local_perizinan, local_perijinan, daftar_perizinan_lokal.
 * 4. Tab Riwayat Siswa (daftarPerijinanSaya) seketika menampilkan pengajuan status 'Menunggu'.
 * 5. Portal Admin (daftarPerijinanAdmin) seketika menerima pengajuan dengan badge [SISWA].
 * 6. Admin dapat menyetujui izin siswa secara resilient tanpa gagal saat sinkronisasi /siswa.
 * 7. Perlindungan role: Akun tamu/pengunjung dilarang submit form perizinan.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('=== TEST SUITE: RESILIENSI PENGAJUAN IZIN SISWA TERHADAP PERMISSION_DENIED ===\n');

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
      this.textContent = '';
      this.value = '';
      this.disabled = false;
      this.style = {};
      this.files = [];
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
    addEventListener() {}
    removeEventListener() {}
  }

  const mockStorage = new MockLocalStorage();
  global.localStorage = mockStorage;
  global.sessionStorage = new MockLocalStorage();
  global.window = {
    addEventListener: () => {},
    removeEventListener: () => {},
    localStorage: mockStorage,
    sessionStorage: global.sessionStorage
  };

  const domElements = {
    perijinanSiswaTarget: new MockElement('perijinanSiswaTarget', 'select'),
    perijinanJenis: new MockElement('perijinanJenis', 'select'),
    perijinanTanggal: new MockElement('perijinanTanggal', 'input'),
    perijinanAlasan: new MockElement('perijinanAlasan', 'textarea'),
    perijinanFile: new MockElement('perijinanFile', 'input'),
    btnSubmitPerijinan: new MockElement('btnSubmitPerijinan', 'button'),
    perijinanMsg: new MockElement('perijinanMsg', 'p'),
    daftarPerijinanSaya: new MockElement('daftarPerijinanSaya', 'div'),
    daftarPerijinanAdmin: new MockElement('daftarPerijinanAdmin', 'div'),
    notifPerijinanBanner: new MockElement('notifPerijinanBanner', 'div'),
    jumlahPending: new MockElement('jumlahPending', 'span'),
    badgePerijinan: new MockElement('badgePerijinan', 'span')
  };

  global.document = {
    getElementById: (id) => domElements[id] || new MockElement(id),
    createElement: (tag) => new MockElement('', tag),
    querySelectorAll: () => [],
    querySelector: () => new MockElement(),
    addEventListener: () => {},
    removeEventListener: () => {}
  };

  // Mock FileReader untuk simulasi fallback upload dokumen
  global.FileReader = class {
    readAsDataURL(file) {
      setTimeout(() => {
        if (this.onload) {
          this.onload({ target: { result: 'data:image/jpeg;base64,mockImageBase64DataForNinjaH2R' } });
        }
      }, 5);
    }
  };

  // 3. Mock Firebase RTDB dengan simulasi ATURAN KETAT:
  // Node /siswa/{nisn} DITOLAK (permission_denied)
  const mockDbData = {
    perijinan: {},
    perizinan: {},
    chat_perijinan: {},
    jadwal_pelajaran: {
      'XII RPL 2': { '1': true, '2': true, '3': true, '4': true }
    },
    presensi_jam: {}
  };

  function createMockRef(pathStr) {
    pathStr = pathStr || '';
    // SIMULASI AKAR MASALAH PENGGUNA:
    // Firebase Rules memblokir akses ke /siswa/{nisn} bagi client siswa
    if (pathStr.startsWith('siswa/') || pathStr === 'siswa') {
      const deniedErr = new Error("permission_denied at /" + pathStr + ": Client doesn't have permission to access the desired data.");
      return {
        once: async () => Promise.reject(deniedErr),
        set: async () => Promise.reject(deniedErr),
        update: async () => Promise.reject(deniedErr),
        on: (ev, cb, errCb) => {
          if (typeof errCb === 'function') errCb(deniedErr);
        }
      };
    }

    return {
      push: (val) => {
        const newKey = 'PERMIT-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
        if (val !== undefined) {
          mockDbData[pathStr] = mockDbData[pathStr] || {};
          mockDbData[pathStr][newKey] = JSON.parse(JSON.stringify(val));
          const p = Promise.resolve({ key: newKey });
          p.key = newKey;
          return p;
        }
        return {
          key: newKey,
          set: async (v) => {
            mockDbData[pathStr] = mockDbData[pathStr] || {};
            mockDbData[pathStr][newKey] = JSON.parse(JSON.stringify(v));
            return Promise.resolve();
          }
        };
      },
      set: async (val) => {
        const parts = pathStr.split('/');
        if (parts.length === 1) {
          mockDbData[parts[0]] = JSON.parse(JSON.stringify(val));
        } else if (parts.length === 2) {
          if (!mockDbData[parts[0]]) mockDbData[parts[0]] = {};
          mockDbData[parts[0]][parts[1]] = JSON.parse(JSON.stringify(val));
        } else if (parts.length === 3) {
          if (!mockDbData[parts[0]]) mockDbData[parts[0]] = {};
          if (!mockDbData[parts[0]][parts[1]]) mockDbData[parts[0]][parts[1]] = {};
          mockDbData[parts[0]][parts[1]][parts[2]] = JSON.parse(JSON.stringify(val));
        }
        return Promise.resolve();
      },
      update: async (val) => {
        Object.keys(val || {}).forEach(k => {
          const fullPath = pathStr ? (pathStr + '/' + k) : k;
          const segments = fullPath.split('/').filter(Boolean);
          let curr = mockDbData;
          for (let i = 0; i < segments.length - 1; i++) {
            if (!curr[segments[i]]) curr[segments[i]] = {};
            curr = curr[segments[i]];
          }
          if (segments.length > 0) {
            curr[segments[segments.length - 1]] = JSON.parse(JSON.stringify(val[k]));
          }
        });
        return Promise.resolve();
      },
      orderByChild: (childProp) => ({
        equalTo: (matchVal) => ({
          on: (ev, cb) => {
            const nodeData = mockDbData[pathStr] || {};
            const filtered = {};
            Object.keys(nodeData).forEach(k => {
              if (nodeData[k] && nodeData[k][childProp] === matchVal) {
                filtered[k] = nodeData[k];
              }
            });
            cb({ val: () => filtered });
          }
        })
      }),
      on: (ev, cb) => {
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
    ref: (p) => createMockRef(p)
  };

  // Mock Firebase Storage yang gagal / offline untuk menguji fallback FileReader
  global.firebase = {
    storage: () => ({
      ref: () => ({
        put: async () => Promise.reject(new Error('Firebase Storage: unauthorized / quota exceeded'))
      })
    })
  };

  // Muat master data konfigurasi
  const firebaseConfig = require('../assets/firebase-config.js');
  global.MASTER_DATA_SISWA_RESMI = firebaseConfig.MASTER_DATA_SISWA_RESMI;
  global.DAFTAR_KELAS_RESMI = firebaseConfig.DAFTAR_KELAS_RESMI;
  global.normalisasiKelas = firebaseConfig.normalisasiKelas;
  global.tanggalHariIni = () => '2026-10-23';

  // Muat perijinan.js & dashboard.js
  const perijinanCode = fs.readFileSync(path.join(__dirname, '../assets/perijinan.js'), 'utf8');
  eval(perijinanCode);

  const dashboardCode = fs.readFileSync(path.join(__dirname, '../assets/dashboard.js'), 'utf8');
  eval(dashboardCode);

  // -------------------------------------------------------------------
  // TEST 1: Simulasi Kasus Nyata Tangkapan Layar Pengguna
  // Siswa M. Ihsan Athallah mengajukan izin saat /siswa/0098263610 permission_denied
  // -------------------------------------------------------------------
  console.log('▶ [Test 1] Simulasi Kasus Nyata Pengguna (M. Ihsan Athallah - NISN 0098263610)...');

  // Set user aktif sebagai siswa terverifikasi M. Ihsan Athallah
  const userIhsan = {
    uid: 'UID_IHSAN_ATHALLAH_123',
    nisn: '0098263610',
    nama: 'M. IHSAN ATHALLAH',
    kelas: 'XII RPL 2',
    role: 'siswa'
  };
  global.currentUser = userIhsan;
  global.getSessionUser = () => userIhsan;

  // Isi formulir sesuai kasus pengguna di tangkapan layar
  domElements.perijinanJenis.value = 'sakit';
  domElements.perijinanTanggal.value = '10/23/2026';
  domElements.perijinanAlasan.value = 'tidur cape';
  domElements.perijinanFile.files = [
    { name: 'wp6291944-kawasaki-ninja-h2r-4k-wallpapers.jpg', size: 1024 * 1024, type: 'image/jpeg' }
  ];

  // Eksekusi submit izin siswa
  await handleSubmitPerijinan();

  // Validasi tidak ada pesan error merah mentah permission_denied
  assert.ok(!domElements.perijinanMsg.textContent.includes('permission_denied'),
    'Pesan error tidak boleh menampilkan permission_denied');
  assert.ok(!domElements.perijinanMsg.textContent.includes('Gagal:'),
    'Pesan tidak boleh berstatus Gagal');

  // Validasi notifikasi sukses hijau ramah
  assert.strictEqual(domElements.perijinanMsg.style.color, '#10b981', 'Warna notifikasi harus hijau sukses');
  assert.ok(domElements.perijinanMsg.textContent.includes('Pengajuan berhasil dikirim') ||
            domElements.perijinanMsg.textContent.includes('Pengajuan izin berhasil tersimpan'),
    'Harus menampilkan pesan konfirmasi berhasil');

  // Validasi tombol submit terkunci otomatis (Anti Double-Send)
  assert.strictEqual(domElements.btnSubmitPerijinan.disabled, true, 'Tombol submit harus terkunci setelah izin terkirim (pending)');
  assert.strictEqual(domElements.btnSubmitPerijinan.textContent, 'Menunggu Konfirmasi Wali Kelas...', 'Label tombol harus menunggu konfirmasi');

  // Validasi field alasan dikosongkan setelah sukses
  assert.strictEqual(domElements.perijinanAlasan.value, '', 'Field alasan harus di-reset');

  console.log('  ✓ Form submit berhasil tanpa terganggu oleh permission_denied pada path /siswa.\n');

  // -------------------------------------------------------------------
  // TEST 2: Verifikasi Penyimpanan Data di LocalStorage & Firebase RTDB
  // -------------------------------------------------------------------
  console.log('▶ [Test 2] Verifikasi Penyimpanan Antrean Lokal (LocalStorage) & RTDB...');

  const localPerizinan = JSON.parse(mockStorage.getItem('local_perizinan') || '[]');
  const localPerijinan = JSON.parse(mockStorage.getItem('local_perijinan') || '[]');
  const daftarLokal = JSON.parse(mockStorage.getItem('daftar_perizinan_lokal') || '[]');

  assert.ok(localPerizinan.length > 0, 'local_perizinan harus berisi data pengajuan');
  assert.ok(localPerijinan.length > 0, 'local_perijinan harus berisi data pengajuan');
  assert.ok(daftarLokal.length > 0, 'daftar_perizinan_lokal harus berisi data pengajuan');

  const itemDisimpan = localPerizinan[0];
  assert.strictEqual(itemDisimpan.nisn, '0098263610', 'NISN harus 0098263610');
  assert.strictEqual(itemDisimpan.nama, 'M. IHSAN ATHALLAH', 'Nama siswa harus M. IHSAN ATHALLAH');
  assert.strictEqual(itemDisimpan.kelas, 'XII RPL 2', 'Kelas harus XII RPL 2');
  assert.strictEqual(itemDisimpan.jenis, 'sakit', 'Kategori izin harus sakit');
  assert.strictEqual(itemDisimpan.status, 'pending', 'Status awal harus pending');
  assert.ok(itemDisimpan.dokumen_url.startsWith('data:image/jpeg;base64,'), 'Dokumen lampiran harus tersimpan via fallback DataURL');

  // Cek juga tersimpan di RTDB /perijinan & /perizinan
  const rtdbKeys = Object.keys(mockDbData.perijinan || {});
  assert.ok(rtdbKeys.length > 0, 'Firebase RTDB node perijinan harus menerima pengajuan');
  const rtdbItem = mockDbData.perijinan[rtdbKeys[0]];
  assert.strictEqual(rtdbItem.nisn, '0098263610', 'NISN di RTDB harus cocok');

  console.log('  ✓ Data perizinan tersimpan lengkap di 3 antrean local storage dan cloud RTDB.\n');

  // -------------------------------------------------------------------
  // TEST 3: Riwayat Siswa di Dashboard (renderDaftarPerijinanSaya)
  // -------------------------------------------------------------------
  console.log('▶ [Test 3] Verifikasi Tab Riwayat Izin Siswa Terupdate...');

  renderDaftarPerijinanSaya('daftarPerijinanSaya', userIhsan);
  assert.ok(domElements.daftarPerijinanSaya.children.length > 0, 'Riwayat perizinan saya harus menampilkan kartu');
  const cardSiswa = domElements.daftarPerijinanSaya.children[0];

  assert.ok(cardSiswa.innerHTML.includes('Sakit'), 'Jenis perizinan Sakit harus tampil');
  assert.ok(cardSiswa.innerHTML.includes('Menunggu'), 'Status Menunggu harus tampil');
  assert.ok(cardSiswa.innerHTML.includes('10/23/2026'), 'Tanggal izin harus tampil');
  assert.ok(cardSiswa.innerHTML.includes('tidur cape'), 'Alasan izin harus tampil');
  assert.ok(cardSiswa.innerHTML.includes('Chat Admin'), 'Tombol chat admin harus ada');

  console.log('  ✓ Tab Riwayat Siswa menampilkan pengajuan yang baru saja dibuat dengan status Menunggu.\n');

  // -------------------------------------------------------------------
  // TEST 4: Verifikasi Portal Admin (renderDaftarPerijinanAdmin)
  // -------------------------------------------------------------------
  console.log('▶ [Test 4] Verifikasi Masuk ke Portal Admin dengan Badge [SISWA]...');

  renderDaftarPerijinanAdmin('daftarPerijinanAdmin', 'pending');
  assert.ok(domElements.daftarPerijinanAdmin.children.length > 0, 'Daftar perizinan admin harus terisi');

  const cardAdmin = domElements.daftarPerijinanAdmin.children[0];
  assert.ok(cardAdmin.innerHTML.includes('[SISWA]'), 'Kartu harus memiliki badge [SISWA]');
  assert.ok(cardAdmin.innerHTML.includes('M. IHSAN ATHALLAH'), 'Nama siswa harus tampil di admin');
  assert.ok(cardAdmin.innerHTML.includes('0098263610'), 'NISN siswa harus tampil di admin');
  assert.ok(cardAdmin.innerHTML.includes('XII RPL 2'), 'Kelas siswa harus tampil di admin');
  assert.ok(cardAdmin.innerHTML.includes('Setujui'), 'Harus memiliki tombol Setujui');
  assert.ok(cardAdmin.innerHTML.includes('Tolak'), 'Harus memiliki tombol Tolak');

  console.log('  ✓ Pengajuan izin siswa langsung muncul di portal admin dengan badge [SISWA].\n');

  // -------------------------------------------------------------------
  // TEST 5: Admin Menyetujui Izin Siswa (adminApprovePerizinanItem)
  // -------------------------------------------------------------------
  console.log('▶ [Test 5] Admin Menyetujui Izin Siswa saat path /siswa permission_denied...');

  global.getSessionUser = () => ({ role: 'admin', nama: 'Admin Kurikulum' });
  await adminApprovePerizinanItem(itemDisimpan.id, false, '0098263610', '10/23/2026', 'sakit');

  // Cek status lokal terupdate menjadi disetujui
  const localUpdated = JSON.parse(mockStorage.getItem('local_perizinan') || '[]');
  const itemDisetujui = localUpdated.find(p => p.id === itemDisimpan.id);
  assert.strictEqual(itemDisetujui.status, 'disetujui', 'Status lokal harus menjadi disetujui');

  // Cek tab riwayat siswa terupdate menjadi Disetujui
  renderDaftarPerijinanSaya('daftarPerijinanSaya', userIhsan);
  const cardDisetujui = domElements.daftarPerijinanSaya.children[0];
  assert.ok(cardDisetujui.innerHTML.includes('Disetujui'), 'Status di riwayat siswa harus Disetujui');

  console.log('  ✓ Persetujuan admin berhasil mengupdate status ke Disetujui tanpa terhalang permission_denied.\n');

  // -------------------------------------------------------------------
  // TEST 6: Isolasi Tamu / Pengunjung (Akses Ditolak)
  // -------------------------------------------------------------------
  console.log('▶ [Test 6] Perlindungan Role: Tamu / Pengunjung Dilarang Submit Izin...');

  const userTamu = { role: 'pengunjung', nama: 'Tamu Umum' };
  global.currentUser = userTamu;
  global.getSessionUser = () => userTamu;

  domElements.perijinanMsg.textContent = '';
  await handleSubmitPerijinan();

  assert.ok(domElements.perijinanMsg.textContent.includes('Akses Ditolak'),
    'Tamu/pengunjung harus ditolak mengakses pengajuan izin');
  assert.strictEqual(domElements.btnSubmitPerijinan.disabled, true, 'Tombol submit harus disabled untuk tamu');

  console.log('  ✓ Proteksi role pengunjung / tamu berjalan 100% aman.\n');

  // -------------------------------------------------------------------
  // TEST 7: Ketahanan terhadap Kuota Penuh LocalStorage (QuotaExceededError)
  // -------------------------------------------------------------------
  console.log('▶ [Test 7] Ketahanan Kuota LocalStorage saat unggah wallpaper 4K berukuran besar...');

  global.currentUser = userIhsan;
  global.getSessionUser = () => userIhsan;

  // Bersihkan status izin terselesaikan sebelumnya agar siswa dapat mengajukan form baru untuk pengujian kuota
  ['local_perizinan', 'local_perijinan', 'daftar_perizinan_lokal', 'antrean_perijinan', 'pengajuan_perizinan'].forEach(k => {
    mockStorage.removeItem(k);
  });
  mockStorage.removeItem('status_izin_0098263610');
  mockStorage.removeItem('last_submission_0098263610');

  // Pasang mock QuotaExceededError jika payload dataURL terlalu besar
  const originalSetItem = mockStorage.setItem.bind(mockStorage);
  let quotaHitCount = 0;
  mockStorage.setItem = function(key, val) {
    if (typeof val === 'string' && val.includes('demam istirahat') && val.includes('data:image')) {
      quotaHitCount++;
      const quotaErr = new Error("Failed to execute 'setItem' on 'Storage': Setting the value exceeded the quota.");
      quotaErr.name = 'QuotaExceededError';
      throw quotaErr;
    }
    return originalSetItem(key, val);
  };

  domElements.perijinanJenis.value = 'sakit';
  domElements.perijinanTanggal.value = '2026-10-23';
  domElements.perijinanAlasan.value = 'demam istirahat';
  domElements.perijinanFile.files = [
    { name: 'heavy_4k_wallpaper.jpg', size: 4 * 1024 * 1024, type: 'image/jpeg' }
  ];

  await handleSubmitPerijinan();

  // Kembalikan setItem normal
  mockStorage.setItem = originalSetItem;

  assert.ok(quotaHitCount > 0, 'Harus mensimulasikan QuotaExceededError pada dataURL berat');
  assert.strictEqual(domElements.perijinanMsg.style.color, '#10b981', 'Form submit harus tetap sukses meski kuota localStorage penuh');
  const storedAfterQuota = JSON.parse(mockStorage.getItem('local_perizinan') || '[]');
  const recentItem = storedAfterQuota.find(p => p.alasan.includes('demam istirahat'));
  assert.ok(recentItem, 'Item perizinan tetap harus tersimpan di local_perizinan');
  console.log('  ✓ QuotaExceededError ditangani aman dengan fallback compact metadata tanpa kehilangan data perizinan.\n');

  // -------------------------------------------------------------------
  // TEST 8: Normalisasi Tanggal 10/23/2026 -> 2026-10-23 pada presensi_jam
  // -------------------------------------------------------------------
  console.log('▶ [Test 8] Normalisasi Tanggal 10/23/2026 ke Format ISO 2026-10-23...');

  // Admin approve perizinan item dengan format tanggal US 10/23/2026
  await adminApprovePerizinanItem(itemDisimpan.id, false, '0098263610', '10/23/2026', 'sakit');
  assert.ok(mockDbData.presensi_jam['XII RPL 2'], 'Data presensi_jam kelas XII RPL 2 harus ada');
  const jamUpdates = mockDbData.presensi_jam['XII RPL 2']['2026-10-23'];
  assert.ok(jamUpdates, 'presensi_jam harus tersimpan di path tanggal ISO 2026-10-23');
  assert.strictEqual(jamUpdates['1']['0098263610'].status, 'sakit', 'Status jam ke-1 harus sakit');
  console.log('  ✓ Tanggal 10/23/2026 sukses dinormalisasi ke 2026-10-23 pada jadwal presensi_jam.\n');

  // -------------------------------------------------------------------
  // TEST 9: Walas Approval di dashboard-guru.js Tahan Terhadap permission_denied
  // -------------------------------------------------------------------
  console.log('▶ [Test 9] Walas Approval di dashboard-guru.js Tahan Terhadap permission_denied at /siswa...');

  const guruCode = fs.readFileSync(path.join(__dirname, '../assets/dashboard-guru.js'), 'utf8');
  // Pastikan dashboard-guru.js memuat try/catch fallback untuk master data siswa
  assert.ok(guruCode.includes('MASTER_DATA_SISWA_RESMI[iz.nisn]'),
    'dashboard-guru.js harus memiliki fallback MASTER_DATA_SISWA_RESMI untuk iz.nisn');
  assert.ok(guruCode.includes("db.ref('siswa/' + iz.nisn).once('value').catch("),
    'dashboard-guru.js harus menangkap error permission_denied pada db.ref siswa');
  console.log('  ✓ Approval Walas di dashboard-guru.js tahan terhadap pembatasan permission_denied pada path /siswa.\n');

  // -------------------------------------------------------------------
  // TEST 10: Pengenalan Otomatis Siswa Google Auth (sisMatch) di auth.js
  // -------------------------------------------------------------------
  console.log('▶ [Test 10] Pengenalan Otomatis Siswa Google Auth zemapk15@gmail.com ke M. Ihsan Athallah...');

  const authCode = fs.readFileSync(path.join(__dirname, '../assets/auth.js'), 'utf8');
  assert.ok(authCode.includes('else if (sisMatch)'), 'auth.js harus memiliki cabang pengenalan sisMatch');
  const authModule = require('../assets/auth.js');
  const sisIhsan = authModule.cariSiswaByEmail('zemapk15@gmail.com');
  assert.ok(sisIhsan, 'Siswa zemapk15@gmail.com harus ditemukan');
  assert.strictEqual(sisIhsan.nisn, '0098263610', 'NISN harus 0098263610');
  assert.strictEqual(sisIhsan.nama, 'M. IHSAN ATHALLAH', 'Nama harus M. IHSAN ATHALLAH');

  // Uji prosesLoginUser dengan mock user Google baru
  const mockFbUser = {
    uid: 'UID_GOOGLE_NEW_IHSAN',
    email: 'zemapk15@gmail.com',
    displayName: 'M. Ihsan Athallah',
    photoURL: 'https://lh3.googleusercontent.com/photo.jpg'
  };
  mockDbData['users'] = {};
  const loggedUser = await authModule.prosesLoginUser(mockFbUser);
  assert.strictEqual(loggedUser.role, 'siswa', 'Akun login Google siswa harus mendapat role siswa');
  assert.strictEqual(loggedUser.nisn, '0098263610', 'Akun login Google siswa harus otomatis tertaut NISN');
  assert.strictEqual(loggedUser.isVerified, true, 'Akun siswa resmi harus berstatus isVerified');
  console.log('  ✓ Akun Google siswa langsung dipetakan ke role siswa resmi (NISN: 0098263610) tanpa terlempar ke pengunjung.\n');

  console.log('========================================================================');
  console.log('🎉 SEMUA PENGUJIAN KETAHANAN PERMISSION_DENIED LULUS (100% PASSED)!');
  console.log('========================================================================\n');
}

main().catch(err => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
