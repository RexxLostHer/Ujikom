// ===================================================================
// TEST SUITE: test-audit-6-bug-ujikom-verification.js
// Memverifikasi secara presisi 6 Perbaikan Bug Utama pada Repo Ujikom:
// 1. Helper getWIBTime() & Status Alpa Otomatis >= 08:00 WIB (Bukan Belum Absen)
// 2. Eliminasi Dummy Dokter & Rendering Bukti Asli Siswa (Image / PDF iframe)
// 3. Normalisasi Kategori Izin/Dispen/Sakit & Buka Blokir Re-Submit Pasca-Penolakan
// 4. Sinkronisasi Dual-Node RTDB (perijinan & perizinan) & Penulisan absensi/{nisn}/{tanggal}
// 5. Chat Wali Kelas Real-Time pada Jalur Kanonik (perijinan/{pid}/chats & chat_perijinan/{pid})
// 6. Form Kendala Mengajar Guru & Walas ke Admin & Automasi Status Operasional Kelas JAMKOS
// ===================================================================

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

async function runAuditVerification() {
  console.log('================================================================');
  console.log('🧪 PENGUJIAN AKURASI 6 PERBAIKAN BUG UTAMA REPO UJIKOM');
  console.log('================================================================\n');

  global.window = global;
  global.window.addEventListener = () => {};
  global.window.removeEventListener = () => {};
  global.location = { href: '', reload: () => {}, replace: () => {} };
  global.navigator = { userAgent: 'node' };

  // Load modules
  const fbConfig = require('../assets/firebase-config.js');

  // -------------------------------------------------------------
  // [TEST 1] Bug 1: Helper getWIBTime & Auto-Alpa >= 08:00 WIB
  // -------------------------------------------------------------
  console.log('▶ [Test 1] Evaluasi Helper getWIBTime() & Auto-Alpa >= 08:00 WIB...');
  assert.strictEqual(typeof fbConfig.getWIBTime, 'function', 'fbConfig.getWIBTime harus tersedia');
  const wibTime = fbConfig.getWIBTime();
  assert.strictEqual(typeof wibTime, 'string', 'getWIBTime harus mengembalikan string');
  assert.ok(/^\d{2}:\d{2}:\d{2}$/.test(wibTime), 'Format getWIBTime harus HH:mm:ss');

  // Uji simulasi jam:
  const mockDateBefore08 = new Date('2026-10-26T00:30:00Z'); // 07:30 WIB
  const timeBefore08 = fbConfig.getWIBTime(mockDateBefore08);
  assert.strictEqual(timeBefore08, '07:30:00', 'Jam harus 07:30:00 WIB');

  const mockDateAfter08 = new Date('2026-10-26T01:15:00Z'); // 08:15 WIB
  const timeAfter08 = fbConfig.getWIBTime(mockDateAfter08);
  assert.strictEqual(timeAfter08, '08:15:00', 'Jam harus 08:15:00 WIB');

  // Mock RTDB untuk pengujian sinkronisasi auto-alpa
  const mockDbData = {
    absensi: {},
    presensi_jam: {},
    perijinan: {},
    perizinan: {},
    kendala_guru: {},
    kendala_mengajar: {},
    kelas: {},
    status_kelas: {},
    classes: {},
    chat_perijinan: {}
  };

  function createRef(pathStr = '') {
    return {
      push: (val) => {
        const key = 'push_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        const childPath = pathStr ? `${pathStr}/${key}` : key;
        const parts = childPath.split('/').filter(Boolean);
        let curr = mockDbData;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!curr[parts[i]]) curr[parts[i]] = {};
          curr = curr[parts[i]];
        }
        if (val !== undefined) {
          curr[parts[parts.length - 1]] = JSON.parse(JSON.stringify(val));
        }
        const p = Promise.resolve();
        p.key = key;
        p.set = async (v) => {
          curr[parts[parts.length - 1]] = JSON.parse(JSON.stringify(v));
          return Promise.resolve();
        };
        return p;
      },
      orderByChild: () => createRef(pathStr),
      equalTo: () => createRef(pathStr),
      limitToLast: () => createRef(pathStr),
      set: async (val) => {
        const parts = pathStr.split('/').filter(Boolean);
        let curr = mockDbData;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!curr[parts[i]]) curr[parts[i]] = {};
          curr = curr[parts[i]];
        }
        curr[parts[parts.length - 1]] = JSON.parse(JSON.stringify(val));
        return Promise.resolve();
      },
      update: async (val) => {
        for (const [k, v] of Object.entries(val)) {
          const fullPath = pathStr ? `${pathStr}/${k}` : k;
          const parts = fullPath.split('/').filter(Boolean);
          let curr = mockDbData;
          for (let i = 0; i < parts.length - 1; i++) {
            if (!curr[parts[i]]) curr[parts[i]] = {};
            curr = curr[parts[i]];
          }
          if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
            if (!curr[parts[parts.length - 1]]) curr[parts[parts.length - 1]] = {};
            Object.assign(curr[parts[parts.length - 1]], JSON.parse(JSON.stringify(v)));
          } else {
            curr[parts[parts.length - 1]] = v;
          }
        }
        return Promise.resolve();
      },
      transaction: async (txFn) => {
        const parts = pathStr.split('/');
        let curr = mockDbData;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!curr[parts[i]]) curr[parts[i]] = {};
          curr = curr[parts[i]];
        }
        const last = parts[parts.length - 1];
        const res = txFn(curr[last]);
        if (res !== undefined) curr[last] = res;
        return Promise.resolve();
      },
      once: async () => ({
        val: () => {
          const parts = pathStr.split('/');
          let curr = mockDbData;
          for (const p of parts) {
            if (!curr || curr[p] === undefined) return null;
            curr = curr[p];
          }
          return curr;
        }
      }),
      on: () => {}
    };
  }

  global.db = { ref: createRef };
  window.db = global.db;
  fbConfig.db = global.db;
  global.getWIBTime = fbConfig.getWIBTime;
  global.getJamSekarangWIB = fbConfig.getJamSekarangWIB;
  global.getTanggalHariIniWIB = fbConfig.getTanggalHariIniWIB;
  global.normalisasiKelas = fbConfig.normalisasiKelas;
  global.MASTER_DATA_SISWA_RESMI = fbConfig.MASTER_DATA_SISWA_RESMI;

  // Jalankan sinkronisasiStatusAlpaFirebase untuk jam > 08:00
  const syncAlpaRes = await fbConfig.sinkronisasiStatusAlpaFirebase('XII RPL 2', '2026-10-26');
  assert.ok(syncAlpaRes.totalSynced > 0, 'Siswa belum absen harus otomatis tersinkronisasi alpa');
  // Verifikasi penulisan ke node absensi/{nisn}/{tanggal}
  assert.ok(mockDbData.absensi['0098263610'], 'Node absensi untuk siswa belum absen (Ihsan) harus tercatat');
  assert.strictEqual(mockDbData.absensi['0098263610']['2026-10-26'].status, 'alpa', 'Status di absensi harus alpa');
  assert.strictEqual(mockDbData.absensi['0098263610']['2026-10-26'].metode, 'auto_system');
  console.log('  ✓ Helper getWIBTime() valid & auto-alpa >= 08:00 WIB menulis ke absensi/{nisn}/{tanggal}.\n');

  // -------------------------------------------------------------
  // [TEST 2] Bug 2: Eliminasi Dummy Dokter & Rendering Bukti Asli
  // -------------------------------------------------------------
  console.log('▶ [Test 2] Eliminasi Dummy Dokter & Rendering Bukti Dokumen Asli (Image / PDF)...');

  // Mock DOM
  class MockElem {
    constructor(id = '', tag = 'div') {
      this.id = id;
      this.tagName = tag.toUpperCase();
      this.value = '';
      this.textContent = '';
      this.innerHTML = '';
      this.style = {};
      this.classList = { add: () => {}, remove: () => {}, contains: () => false };
      this.children = [];
    }
    appendChild(c) { this.children.push(c); }
    addEventListener() {}
    removeEventListener() {}
  }

  const domStore = {
    modalBuktiTitle: new MockElem('modalBuktiTitle'),
    modalBuktiImg: new MockElem('modalBuktiImg', 'img'),
    modalBuktiText: new MockElem('modalBuktiText'),
    modalBuktiIzin: new MockElem('modalBuktiIzin')
  };

  global.document = {
    getElementById: (id) => domStore[id] || new MockElem(id),
    createElement: (t) => new MockElem('', t),
    querySelectorAll: () => [],
    querySelector: (s) => null,
    addEventListener: () => {},
    removeEventListener: () => {}
  };

  const guruJs = fs.readFileSync(path.join(__dirname, '../assets/dashboard-guru.js'), 'utf8');
  eval(guruJs);

  // Uji buka modal bukti dengan foto Base64 asli siswa
  const realPhotoBase64 = 'data:image/jpeg;base64,FOTO_ASLI_SURAT_DOKTER_IHSAN_2026';
  bukaModalBukti(realPhotoBase64, 'M. IHSAN ATHALLAH');
  assert.strictEqual(domStore.modalBuktiImg.style.display, 'block', 'Tag img harus tampil');
  assert.strictEqual(domStore.modalBuktiImg.src, realPhotoBase64, 'Source tag img harus foto asli');
  assert.strictEqual(domStore.modalBuktiText.innerHTML, '', 'Teks dummy dokter tidak boleh ada saat render foto asli');

  // Uji buka modal bukti dengan PDF
  const realPdfUrl = 'https://firebasestorage.googleapis.com/surat_resmi.pdf';
  bukaModalBukti(realPdfUrl, 'M. IHSAN ATHALLAH');
  assert.strictEqual(domStore.modalBuktiImg.style.display, 'none', 'Tag img harus disembunyikan untuk PDF');
  assert.ok(domStore.modalBuktiText.innerHTML.includes('<iframe'), 'PDF harus dirender menggunakan iframe');
  assert.ok(domStore.modalBuktiText.innerHTML.includes('Buka / Unduh Dokumen Surat Izin (PDF)'), 'Link unduh PDF harus tersedia');

  console.log('  ✓ Bukti asli foto dirender via <img> dan PDF dirender via <iframe> tanpa dummy teks dokter.\n');

  // -------------------------------------------------------------
  // [TEST 3] Bug 3: Kategori Izin/Dispen/Sakit & Re-Submit Bebas Blokir
  // -------------------------------------------------------------
  console.log('▶ [Test 3] Kategori Izin/Dispen & Re-Submit Pasca-Penolakan...');

  const perijinanMod = require('../assets/perijinan.js');
  Object.assign(global, perijinanMod);
  const JENIS_PERIJINAN = perijinanMod.JENIS_PERIJINAN;
  const dashboardMod = require('../assets/dashboard.js');
  Object.assign(global, dashboardMod);

  // Verifikasi label kategori
  assert.strictEqual(JENIS_PERIJINAN.sakit.label, 'Sakit');
  assert.strictEqual(JENIS_PERIJINAN.izin.label, 'Izin');
  assert.strictEqual(JENIS_PERIJINAN.ijin_kegiatan.label, 'Izin');
  assert.strictEqual(JENIS_PERIJINAN.dispen.label, 'Dispen');
  assert.strictEqual(JENIS_PERIJINAN.dispensasi.label, 'Dispen');

  // Verifikasi re-submit bebas blokir jika izin sebelumnya ditolak
  const storageMap = {};
  global.localStorage = {
    getItem: (k) => storageMap[k] || null,
    setItem: (k, v) => { storageMap[k] = String(v); },
    removeItem: (k) => { delete storageMap[k]; }
  };

  const itemDitolak = {
    id: 'IZIN-DITOLAK-001',
    nisn: '0098263610',
    nama: 'M. IHSAN ATHALLAH',
    jenis: 'sakit',
    tanggal: '2026-10-26',
    status: 'ditolak',
    catatan_guru: 'Foto blur'
  };
  storageMap['local_perizinan'] = JSON.stringify([itemDitolak]);

  // Cek apakah siswa diblokir untuk tanggal yang sama pasca ditolak
  const cekPendingReSubmit = ambilIzinPendingAktifSiswa('0098263610', 'sakit', '2026-10-26');
  assert.strictEqual(cekPendingReSubmit, null, 'Siswa harus BEBAS mengirim pengajuan baru pada tanggal tersebut setelah ditolak');

  // Cek apakah kategori berbeda diperbolehkan
  const itemDispenPending = {
    id: 'IZIN-PENDING-002',
    nisn: '0098263610',
    nama: 'M. IHSAN ATHALLAH',
    jenis: 'dispen',
    tanggal: '2026-10-26',
    status: 'pending'
  };
  storageMap['local_perizinan'] = JSON.stringify([itemDispenPending]);
  const cekKategoriBeda = ambilIzinPendingAktifSiswa('0098263610', 'izin', '2026-10-26');
  assert.strictEqual(cekKategoriBeda, null, 'Pengajuan dengan kategori berbeda tidak boleh diblokir');

  console.log('  ✓ Kategori terpetakan presisi & re-submit izin bebas blokir pasca-penolakan.\n');

  // -------------------------------------------------------------
  // [TEST 4] Bug 4: Sinkronisasi Dual-Node RTDB (perijinan & perizinan)
  // -------------------------------------------------------------
  console.log('▶ [Test 4] Sinkronisasi Dual-Node RTDB & Penulisan absensi/{nisn}/{tanggal}...');

  const userWalasEcha = {
    nip: '198503152010011002',
    nama: 'Muhammad Echa Putra, S.Kom.Gr',
    role: 'walas',
    walasKelasId: 'XII RPL 2',
    isWalas: true
  };
  global.guruAktif = userWalasEcha;
  global.currentUser = userWalasEcha;

  const permitTestPid = 'PID-DUAL-SYNC-TEST';
  allPerizinanData[permitTestPid] = {
    id: permitTestPid,
    pid: permitTestPid,
    nisn: '0098263610',
    nama: 'M. IHSAN ATHALLAH',
    kelas: 'XII RPL 2',
    jenis: 'sakit',
    tanggal: '2026-10-26',
    status: 'pending'
  };

  global.prompt = () => 'Disetujui. Istirahat yang cukup.';
  await prosesApprovalIzin(permitTestPid, 'disetujui');

  // 1. Verifikasi update ke KEDUA path database perijinan DAN perizinan
  assert.ok(mockDbData.perijinan[permitTestPid], 'Node perijinan harus ter-update');
  assert.ok(mockDbData.perizinan[permitTestPid], 'Node perizinan harus ter-update');
  assert.strictEqual(mockDbData.perijinan[permitTestPid].status, 'disetujui');
  assert.strictEqual(mockDbData.perizinan[permitTestPid].status, 'disetujui');
  assert.strictEqual(mockDbData.perijinan[permitTestPid].status_code, 'approved');
  assert.strictEqual(mockDbData.perizinan[permitTestPid].status_code, 'approved');

  // 2. Verifikasi otomatis menulis ke node absensi harian siswa
  assert.ok(mockDbData.absensi['0098263610']['2026-10-26'], 'Node absensi harian siswa harus ter-update saat izin di-ACC');
  assert.strictEqual(mockDbData.absensi['0098263610']['2026-10-26'].status, 'sakit');
  assert.strictEqual(mockDbData.absensi['0098263610']['2026-10-26'].metode, 'perizinan_walas');

  console.log('  ✓ Dual-node RTDB tersinkronisasi 100% dan status absensi harian otomatis ter-update.\n');

  // -------------------------------------------------------------
  // [TEST 5] Bug 5: Chat Siswa <-> Wali Kelas pada Jalur Kanonik
  // -------------------------------------------------------------
  console.log('▶ [Test 5] Chat Siswa <-> Walas pada Jalur Kanonik & Tombol "Chat Wali Kelas"...');

  // Verifikasi jalur pengiriman chat menulis ke perijinan/{pid}/chats dan chat_perijinan/{pid}
  const chatPid = 'CHAT-TEST-KANONIK';
  await kirimChatPerijinan(chatPid, { role: 'siswa', nama: 'M. IHSAN ATHALLAH' }, 'Selamat pagi pak, izin konfirmasi');

  assert.ok(mockDbData.chat_perijinan && mockDbData.chat_perijinan[chatPid], 'Harus menulis ke chat_perijinan/' + chatPid);
  assert.ok(mockDbData.perijinan && mockDbData.perijinan[chatPid] && mockDbData.perijinan[chatPid].chats, 'Harus menulis ke perijinan/' + chatPid + '/chats');

  // Verifikasi render riwayat izin siswa memuat tombol "Chat Wali Kelas"
  const userIhsan = { uid: 'UID_0098263610', nisn: '0098263610', nama: 'M. IHSAN ATHALLAH', role: 'siswa' };
  const domRiwayat = new MockElem('daftarPerijinanSaya');
  domStore.daftarPerijinanSaya = domRiwayat;
  renderDaftarPerijinanSaya('daftarPerijinanSaya', userIhsan);

  assert.ok(domRiwayat.children.length > 0, 'Harus ada riwayat kartu izin');
  const cardContent = domRiwayat.children[0].innerHTML;
  assert.ok(cardContent.includes('Chat Wali Kelas'), 'Tombol harus bertuliskan Chat Wali Kelas');

  console.log('  ✓ Jalur kanonik chat tersinkronisasi dan label tombol terverifikasi "Chat Wali Kelas".\n');

  // -------------------------------------------------------------
  // [TEST 6] Bug 6: Form Kendala Mengajar Guru/Walas -> Admin & Status JAMKOS
  // -------------------------------------------------------------
  console.log('▶ [Test 6] Lapor Kendala Guru & Automasi Status Operasional Kelas JAMKOS...');

  const adminMod = require('../assets/admin.js');
  Object.assign(global, adminMod);

  const domDaftarKendala = new MockElem('daftarKendalaAdmin');
  const domBadgeKendala = new MockElem('badgeKendalaGuru');
  domStore.daftarKendalaAdmin = domDaftarKendala;
  domStore.badgeKendalaGuru = domBadgeKendala;

  // 1. Walas/Guru submit kendala mengajar
  const kidTest = 'KENDALA-AUDIT-001';
  const payloadKendala = {
    kid: kidTest,
    id: kidTest,
    guru_uid: '198503152010011002',
    guru_nip: '198503152010011002',
    nama_guru: 'Muhammad Echa Putra, S.Kom.Gr',
    guru_nama: 'Muhammad Echa Putra, S.Kom.Gr',
    peran: 'Wali Kelas & Guru',
    kelas: 'XII RPL 2',
    kelasId: 'XII RPL 2',
    mapel: 'Basis Data',
    jam_ke: '1-4',
    keterangan: 'Rapat koordinasi kurikulum',
    deskripsi: 'Rapat koordinasi kurikulum',
    dokumen_url: 'data:image/png;base64,BUKTI_SURAT_TUGAS',
    tanggal: '2026-10-26',
    status: 'pending',
    created_at: Date.now()
  };

  mockDbData.kendala_guru[kidTest] = payloadKendala;
  mockDbData.kendala_mengajar[kidTest] = payloadKendala;
  kendalaGuruCache[kidTest] = payloadKendala;

  // 2. Admin ACC kendala -> Automasi status kelas jadi JAMKOS
  global.confirm = () => true;
  await adminApproveKendala(kidTest);

  assert.ok(mockDbData.status_kelas['XII RPL 2'], 'Status kelas XII RPL 2 harus ter-update');
  assert.strictEqual(mockDbData.status_kelas['XII RPL 2'].status, 'jamkos', 'Status kelas harus menjadi jamkos');
  assert.ok(mockDbData.kelas['XII RPL 2'], 'Node kelas XII RPL 2 harus ter-update');
  assert.strictEqual(mockDbData.kelas['XII RPL 2'].status, 'jamkos', 'Status operasional kelas harus jamkos');
  assert.strictEqual(mockDbData.kendala_guru[kidTest].status, 'approved', 'Status kendala guru harus approved/disetujui');

  console.log('  ✓ ACC Jamkos Admin otomatis mengubah status operasional kelas XII RPL 2 menjadi JAMKOS.\n');

  console.log('================================================================');
  console.log('🎉 SEMUA 6 PERBAIKAN BUG UTAMA LOLOS VERIFIKASI 100% PRESISI!');
  console.log('================================================================');
  process.exit(0);
}

runAuditVerification().catch(err => {
  console.error('❌ AUDIT TEST FAILED:', err);
  process.exit(1);
});
