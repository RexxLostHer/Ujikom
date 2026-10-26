// ===================================================================
// TEST SUITE: test-perbaikan-4-bug-ujikom.js
// Memverifikasi secara mendalam 4 Perbaikan Bug Sistem Absensi IoT & Web:
// 1. Logika Status Otomatis "Alpa" Setelah Jam 08:00 WIB (Bukan "Belum Absen")
// 2. Upload Dokumentasi Bukti Izin Asli (Validasi & Tanpa Auto-Generate Dummy)
// 3. Alur Pengiriman Bukti Dokumentasi Izin Siswa -> Wali Kelas
// 4. Fitur Konfirmasi Kendala Mengajar Guru/Walas -> Admin (RTDB & Listener)
// ===================================================================

const assert = require('assert');
const fs = require('fs');
const path = require('path');

async function runTests() {
  console.log('================================================================');
  console.log('🧪 PENGUJIAN 4 PERBAIKAN BUG SISTEM ABSENSI IOT & WEB (FIREBASE)');
  console.log('================================================================\n');

  // Load config & utilities
  const fbConfig = require('../assets/firebase-config.js');
  global.getJamSekarangWIB = fbConfig.getJamSekarangWIB;
  global.getTanggalHariIniWIB = fbConfig.getTanggalHariIniWIB;
  global.evaluasiAmbangBatasWaktu = fbConfig.evaluasiAmbangBatasWaktu;
  global.evaluasiStatusKehadiranRealtime = fbConfig.evaluasiStatusKehadiranRealtime;
  global.MASTER_DATA_SISWA_RESMI = fbConfig.MASTER_DATA_SISWA_RESMI;
  global.normalisasiKelas = fbConfig.normalisasiKelas;

  // -------------------------------------------------------------------
  // [TEST 1] BUG 1: Verifikasi Timezone Asia/Jakarta (WIB) & Logika 08:00 WIB
  // -------------------------------------------------------------------
  console.log('▶ [Test 1] Evaluasi Ambang Batas Waktu Real-Time Asia/Jakarta (WIB)...');

  // A. Pengecekan Timezone WIB
  const jamWIB = getJamSekarangWIB();
  assert.strictEqual(typeof jamWIB, 'string', 'getJamSekarangWIB harus mengembalikan string');
  assert.ok(/^\d{2}:\d{2}:\d{2}$/.test(jamWIB), 'Format jam WIB harus HH:mm:ss');

  const tglWIB = getTanggalHariIniWIB();
  assert.strictEqual(typeof tglWIB, 'string', 'getTanggalHariIniWIB harus mengembalikan string');
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(tglWIB), 'Format tanggal WIB harus YYYY-MM-DD');

  // B. Evaluasi < 08:00 WIB: Siswa belum scan -> Status "Belum Absen"
  const evalSebelum08 = evaluasiStatusKehadiranRealtime({
    hasScan: false,
    hasApprovedIzin: false,
    waktuSekarangWIB: '07:15:00'
  });
  assert.strictEqual(evalSebelum08.status, 'belum', 'Status sebelum 08:00 harus belum');
  assert.strictEqual(evalSebelum08.label, 'Belum Absen', 'Label sebelum 08:00 harus "Belum Absen"');
  assert.strictEqual(evalSebelum08.isAlpa, false, 'isAlpa sebelum 08:00 harus false');

  // C. Evaluasi >= 08:00 WIB: Siswa belum scan -> Otomatis Status "Alpa"
  const evalSetelah08 = evaluasiStatusKehadiranRealtime({
    hasScan: false,
    hasApprovedIzin: false,
    waktuSekarangWIB: '08:01:00'
  });
  assert.strictEqual(evalSetelah08.status, 'alpa', 'Status setelah 08:00 harus alpa');
  assert.strictEqual(evalSetelah08.label, 'Alpa', 'Label setelah 08:00 harus "Alpa"');
  assert.strictEqual(evalSetelah08.isAlpa, true, 'isAlpa setelah 08:00 harus true');

  // D. Siswa dengan status Izin/Sakit yang disetujui DILARANG DITIMPA oleh Alpa
  const evalIzin = evaluasiStatusKehadiranRealtime({
    hasScan: false,
    hasApprovedIzin: true,
    jenisIzin: 'sakit',
    waktuSekarangWIB: '08:30:00'
  });
  assert.strictEqual(evalIzin.status, 'sakit', 'Status izin/sakit tidak boleh ditimpa Alpa');
  assert.strictEqual(evalIzin.isAlpa, false, 'isAlpa pada siswa sakit harus false');

  // E. Scan IoT sebelum 08:00 WIB
  const evalScanPagi = evaluasiStatusKehadiranRealtime({
    hasScan: true,
    waktuScan: '06:25:00',
    statusScan: 'hadir',
    hasApprovedIzin: false,
    waktuSekarangWIB: '08:30:00'
  });
  assert.strictEqual(evalScanPagi.status, 'hadir', 'Scan tepat waktu pagi harus berstatus hadir');
  assert.ok(evalScanPagi.label.includes('Hadir Tepat Waktu'), 'Label harus Hadir Tepat Waktu');

  // F. Evaluasi status 'belum' / 'belum absen' pada record kehadiran
  const evalBelumSebelum08 = evaluasiStatusKehadiranRealtime({
    hasScan: true,
    statusScan: 'belum',
    waktuSekarangWIB: '07:30:00'
  });
  assert.strictEqual(evalBelumSebelum08.status, 'belum', 'Status scan belum sebelum 08:00 harus "belum"');
  assert.strictEqual(evalBelumSebelum08.isAlpa, false, 'isAlpa harus false');

  const evalBelumSetelah08 = evaluasiStatusKehadiranRealtime({
    hasScan: true,
    statusScan: 'belum',
    waktuSekarangWIB: '08:15:00'
  });
  assert.strictEqual(evalBelumSetelah08.status, 'alpa', 'Status scan belum setelah 08:00 harus "alpa"');
  assert.strictEqual(evalBelumSetelah08.isAlpa, true, 'isAlpa harus true');

  // G. Verifikasi fungsi sinkronisasiStatusAlpaFirebase
  global.sinkronisasiStatusAlpaFirebase = fbConfig.sinkronisasiStatusAlpaFirebase;
  assert.strictEqual(typeof sinkronisasiStatusAlpaFirebase, 'function', 'sinkronisasiStatusAlpaFirebase harus tersedia');

  console.log('  ✓ Ambang batas waktu WIB & transisi dinamis Alpa >= 08:00 WIB 100% valid.\n');

  // -------------------------------------------------------------------
  // [TEST 2] BUG 2: Validasi File Wajib Dipilih & Tidak Ada Dummy/Auto-Generate
  // -------------------------------------------------------------------
  console.log('▶ [Test 2] Validasi Form Izin & Eliminasi Dummy/Auto-Generate Surat...');

  // Mock DOM Environment
  class MockElement {
    constructor(id = '', tag = 'div') {
      this.id = id;
      this.tagName = tag.toUpperCase();
      this.value = '';
      this.disabled = false;
      this.textContent = '';
      this.innerHTML = '';
      this.style = {};
      this.children = [];
      this.classList = {
        add: () => {},
        remove: () => {},
        contains: () => false
      };
    }
    appendChild(child) { this.children.push(child); }
    addEventListener() {}
    removeEventListener() {}
  }

  const domElements = {
    fotoSurat: new MockElement('fotoSurat', 'input'),
    perijinanFile: new MockElement('perijinanFile', 'input'),
    perijinanJenis: new MockElement('perijinanJenis', 'select'),
    perijinanTanggal: new MockElement('perijinanTanggal', 'input'),
    perijinanAlasan: new MockElement('perijinanAlasan', 'textarea'),
    btnSubmitPerijinan: new MockElement('btnSubmitPerijinan', 'button'),
    perijinanMsg: new MockElement('perijinanMsg', 'p'),
    perijinanSiswaTarget: new MockElement('perijinanSiswaTarget', 'select')
  };

  global.document = {
    getElementById: (id) => domElements[id] || new MockElement(id),
    createElement: (tag) => new MockElement('', tag),
    querySelectorAll: () => [],
    addEventListener: () => {}
  };

  global.window = global;
  global.window.location = { href: '' };
  global.window.addEventListener = () => {};
  global.window.removeEventListener = () => {};
  global.location = global.window.location;
  global.BroadcastChannel = class { postMessage() {} unref() {} };

  const mockDbData = {
    perijinan: {},
    perizinan: {},
    kendala_mengajar: {},
    laporan_kendala: {},
    kendala_guru: {},
    presensi_jam: {}
  };

  function createRef(pathStr) {
    return {
      set: async (val) => {
        const parts = pathStr.split('/');
        if (parts.length === 1) mockDbData[parts[0]] = JSON.parse(JSON.stringify(val));
        else if (parts.length === 2) {
          if (!mockDbData[parts[0]]) mockDbData[parts[0]] = {};
          mockDbData[parts[0]][parts[1]] = JSON.parse(JSON.stringify(val));
        } else {
          let curr = mockDbData;
          for (let i = 0; i < parts.length - 1; i++) {
            if (!curr[parts[i]]) curr[parts[i]] = {};
            curr = curr[parts[i]];
          }
          curr[parts[parts.length - 1]] = JSON.parse(JSON.stringify(val));
        }
        return Promise.resolve();
      },
      update: async (val) => {
        let curr = mockDbData;
        const parts = pathStr.split('/');
        for (let i = 0; i < parts.length; i++) {
          if (!curr[parts[i]]) curr[parts[i]] = {};
          curr = curr[parts[i]];
        }
        Object.assign(curr, JSON.parse(JSON.stringify(val)));
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
      on: (ev, cb) => {
        cb({ val: () => mockDbData[pathStr] || {} });
      },
      transaction: async (updateFn) => {
        const parts = pathStr.split('/');
        let curr = mockDbData;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!curr[parts[i]]) curr[parts[i]] = {};
          curr = curr[parts[i]];
        }
        const lastPart = parts[parts.length - 1];
        const updated = updateFn(curr[lastPart]);
        if (updated !== undefined) curr[lastPart] = updated;
        return Promise.resolve();
      }
    };
  }

  global.db = { ref: (p) => createRef(p) };

  const storageStore = {};
  global.localStorage = {
    getItem: (k) => storageStore[k] || null,
    setItem: (k, v) => { storageStore[k] = String(v); },
    removeItem: (k) => { delete storageStore[k]; }
  };

  // Mock FileReader
  global.FileReader = class {
    readAsDataURL(file) {
      setTimeout(() => {
        if (this.onload) {
          this.onload({ target: { result: 'data:image/jpeg;base64,ASLI_SURAT_DOKTER_REAL_USER_123' } });
        }
      }, 5);
    }
  };

  // Muat dashboard.js & perijinan.js
  const perijinanCode = fs.readFileSync(path.join(__dirname, '../assets/perijinan.js'), 'utf8');
  eval(perijinanCode);
  const dashboardCode = fs.readFileSync(path.join(__dirname, '../assets/dashboard.js'), 'utf8');
  eval(dashboardCode);

  const userIhsan = {
    uid: 'UID_0098263610',
    nisn: '0098263610',
    nama: 'M. IHSAN ATHALLAH',
    kelas: 'XII RPL 2',
    role: 'siswa'
  };
  global.currentUser = userIhsan;
  global.getSessionUser = () => userIhsan;

  // Kasus A: Submit form tanpa memilih file -> WAJIB DITOLAK
  domElements.perijinanJenis.value = 'sakit';
  domElements.perijinanTanggal.value = '2026-10-25';
  domElements.perijinanAlasan.value = 'Demam tinggi istirahat';
  domElements.fotoSurat.files = [];
  domElements.perijinanFile.files = [];

  await handleSubmitPerijinan();
  assert.ok(
    domElements.perijinanMsg.textContent.includes('Harap lampirkan bukti'),
    'Form harus memvalidasi agar file bukti wajib dipilih'
  );
  console.log('  ✓ Validasi file bukti wajib dipilih berhasil menolak submit tanpa file.');

  // Kasus B: Submit dengan file asli pilihan pengguna
  const dummyFileAsli = {
    name: 'surat_keterangan_sakit_asli.jpg',
    size: 512 * 1024,
    type: 'image/jpeg'
  };
  domElements.fotoSurat.files = [dummyFileAsli];

  await handleSubmitPerijinan();
  assert.ok(
    domElements.perijinanMsg.textContent.includes('Pengajuan berhasil') ||
    domElements.perijinanMsg.textContent.includes('berhasil'),
    'Submit form izin dengan file asli harus sukses'
  );

  // Verifikasi file yang tersimpan adalah Base64 dari file asli (bukan SVG dummy dokter)
  const localList = JSON.parse(storageStore.local_perizinan || '[]');
  assert.ok(localList.length > 0, 'Data harus tersimpan di local_perizinan');
  const permitTersimpan = localList[0];
  assert.strictEqual(permitTersimpan.foto_bukti, 'data:image/jpeg;base64,ASLI_SURAT_DOKTER_REAL_USER_123',
    'Foto bukti harus berupa data URL asli dari FileReader');
  assert.ok(!permitTersimpan.foto_bukti.includes('svg+xml'),
    'Dilarang menghasilkan SVG dummy generator saat user upload foto');

  console.log('  ✓ File asli tersimpan sempurna via FileReader Base64 tanpa dummy SVG.\n');

  // -------------------------------------------------------------------
  // [TEST 3] BUG 3: Pengiriman Bukti Siswa -> Wali Kelas (Walas)
  // -------------------------------------------------------------------
  console.log('▶ [Test 3] Verifikasi Alur Pengiriman Bukti Izin Siswa ke Walas...');

  // A. Periksa payload di node RTDB perijinan
  const rtdbKeys = Object.keys(mockDbData.perijinan || {});
  assert.ok(rtdbKeys.length > 0, 'Node perijinan RTDB harus memuat data izin');
  const rtdbItem = mockDbData.perijinan[rtdbKeys[0]];

  assert.strictEqual(rtdbItem.siswaId, '0098263610', 'Payload harus memuat siswaId');
  assert.strictEqual(rtdbItem.namaSiswa, 'M. IHSAN ATHALLAH', 'Payload harus memuat namaSiswa');
  assert.strictEqual(rtdbItem.kelas, 'XII RPL 2', 'Payload harus memuat kelas');
  assert.ok(rtdbItem.walasId, 'Payload harus memuat walasId');
  assert.strictEqual(rtdbItem.status, 'pending', 'Status awal harus pending');
  assert.strictEqual(rtdbItem.buktiUrl, 'data:image/jpeg;base64,ASLI_SURAT_DOKTER_REAL_USER_123',
    'Payload harus menyertakan buktiUrl asli');
  assert.strictEqual(rtdbItem.dokumentasi, 'data:image/jpeg;base64,ASLI_SURAT_DOKTER_REAL_USER_123',
    'Payload harus menyertakan dokumentasi asli');

  // B. Sisi Wali Kelas memuat data dan melihat preview
  const guruCode = fs.readFileSync(path.join(__dirname, '../assets/dashboard-guru.js'), 'utf8');
  eval(guruCode);

  const userPakEcha = {
    nip: '198503152010011002',
    nama: 'Muhammad Echa Putra, S.Kom.Gr',
    role: 'walas',
    walasKelasId: 'XII RPL 2',
    isWalas: true
  };
  global.guruAktif = userPakEcha;

  // Render modal bukti pada sisi walas
  const domModalBuktiImg = new MockElement('modalBuktiImg', 'img');
  const domModalBuktiText = new MockElement('modalBuktiText', 'div');
  const domModalBukti = new MockElement('modalBuktiIzin', 'div');
  domElements.modalBuktiImg = domModalBuktiImg;
  domElements.modalBuktiText = domModalBuktiText;
  domElements.modalBuktiIzin = domModalBukti;

  bukaModalBuktiIzin(rtdbItem.id);
  assert.strictEqual(domModalBuktiImg.src, 'data:image/jpeg;base64,ASLI_SURAT_DOKTER_REAL_USER_123',
    'Modal bukti di Walas harus menampilkan URL/DataURL asli dari siswa');

  // B.2 Verifikasi item dengan field buktiUrl / dokumentasi saja (tanpa foto_bukti / dokumen_url)
  const itemBuktiUrlOnly = {
    id: 'PERMIT-TEST-BUKTI-ONLY',
    pid: 'PERMIT-TEST-BUKTI-ONLY',
    siswaId: '0098263610',
    namaSiswa: 'M. IHSAN ATHALLAH',
    kelas: 'XII RPL 2',
    walasId: 'XII RPL 2',
    status: 'pending',
    buktiUrl: 'https://storage.googleapis.com/real_bucket/bukti_izin_resmi.pdf',
    dokumentasi: 'https://storage.googleapis.com/real_bucket/bukti_izin_resmi.pdf'
  };
  allPerizinanData['PERMIT-TEST-BUKTI-ONLY'] = itemBuktiUrlOnly;
  bukaModalBuktiIzin('PERMIT-TEST-BUKTI-ONLY');
  assert.ok(
    domModalBuktiText.innerHTML.includes('bukti_izin_resmi.pdf'),
    'Modal bukti di Walas harus mampu merender link dokumen dari field buktiUrl / dokumentasi'
  );

  console.log('  ✓ Data izin & bukti asli berhasil diterima dan ditampilkan di portal Walas.\n');

  // -------------------------------------------------------------------
  // [TEST 4] BUG 4: Konfirmasi Kendala Mengajar Guru/Walas -> Admin
  // -------------------------------------------------------------------
  console.log('▶ [Test 4] Verifikasi Form Kendala Mengajar Guru -> Admin (RTDB & Listener)...');

  // A. Kirim laporan kendala mengajar
  const kendalaPayload = {
    guruId: '198503152010011002',
    nip: '198503152010011002',
    namaGuru: 'Muhammad Echa Putra, S.Kom.Gr',
    peran: 'Walas',
    kelas: 'XII RPL 2',
    mataPelajaran: 'Pemrograman Web',
    deskripsiKendala: 'Menghadiri rapat kurikulum dinas pendidikan, tugas modul 4 di LMS',
    buktiKendala: 'data:image/png;base64,SURAT_TUGAS_DINAS_789'
  };

  const kirimRes = await kirimKendalaMengajar(kendalaPayload);
  assert.ok(kirimRes.success, 'Fungsi kirimKendalaMengajar harus berhasil mengirim data');
  const kendalaId = kirimRes.id;

  // B. Verifikasi masuk ke path kendala_mengajar, laporan_kendala, kendala_guru, dan local_kendala_guru
  assert.ok(mockDbData.kendala_mengajar[kendalaId], 'Harus masuk ke path RTDB kendala_mengajar');
  assert.ok(mockDbData.laporan_kendala[kendalaId], 'Harus masuk ke path RTDB laporan_kendala');
  assert.ok(mockDbData.kendala_guru[kendalaId], 'Harus masuk ke path RTDB kendala_guru');

  const savedKendala = mockDbData.kendala_mengajar[kendalaId];
  assert.strictEqual(savedKendala.guruId, '198503152010011002', 'guruId harus sesuai');
  assert.strictEqual(savedKendala.peran, 'Walas', 'peran harus Walas');
  assert.strictEqual(savedKendala.statusKonfirmasi, 'Menunggu Konfirmasi', 'statusKonfirmasi harus Menunggu Konfirmasi');
  assert.strictEqual(savedKendala.status, 'pending', 'status harus pending');

  // C. Sisi Admin: muat admin.js dan listener realtime
  const adminCode = fs.readFileSync(path.join(__dirname, '../assets/admin.js'), 'utf8');
  eval(adminCode);

  const domDaftarKendalaAdmin = new MockElement('daftarKendalaAdmin', 'div');
  const domBadgeKendalaGuru = new MockElement('badgeKendalaGuru', 'span');
  domElements.daftarKendalaAdmin = domDaftarKendalaAdmin;
  domElements.badgeKendalaGuru = domBadgeKendalaGuru;

  listenKendalaGuruAdmin();
  assert.ok(kendalaGuruCache[kendalaId], 'Listener Admin harus menerima kendalaId');
  assert.strictEqual(kendalaGuruCache[kendalaId].status, 'pending', 'Status di cache Admin harus pending');

  // D. Admin mengonfirmasi / menyetujui kendala mengajar
  global.confirm = () => true;
  await adminApproveKendala(kendalaId);

  assert.strictEqual(mockDbData.kendala_mengajar[kendalaId].status, 'approved', 'Path kendala_mengajar harus approved');
  assert.strictEqual(mockDbData.kendala_mengajar[kendalaId].statusKonfirmasi, 'Disetujui', 'statusKonfirmasi harus Disetujui');
  assert.strictEqual(mockDbData.laporan_kendala[kendalaId].status, 'approved', 'Path laporan_kendala harus approved');
  assert.strictEqual(mockDbData.kendala_guru[kendalaId].status, 'approved', 'Path kendala_guru harus approved');

  // D.2 Verifikasi aksi adminRejectKendala
  const kendalaTolakId = 'KENDALA-TOLAK-' + Date.now();
  mockDbData.kendala_mengajar[kendalaTolakId] = { id: kendalaTolakId, status: 'pending', statusKonfirmasi: 'Menunggu Konfirmasi' };
  kendalaGuruCache[kendalaTolakId] = mockDbData.kendala_mengajar[kendalaTolakId];
  await adminRejectKendala(kendalaTolakId);
  assert.strictEqual(mockDbData.kendala_mengajar[kendalaTolakId].status, 'rejected', 'Status harus rejected');
  assert.strictEqual(mockDbData.kendala_mengajar[kendalaTolakId].statusKonfirmasi, 'Ditolak', 'statusKonfirmasi harus Ditolak');

  // E. Verifikasi database.rules.json mengizinkan kendala_mengajar & laporan_kendala
  const rulesJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../database.rules.json'), 'utf8'));
  assert.ok(rulesJson.rules.kendala_mengajar, 'Rules harus memiliki node kendala_mengajar');
  assert.strictEqual(rulesJson.rules.kendala_mengajar['.read'], true, 'kendala_mengajar .read harus true');
  assert.strictEqual(rulesJson.rules.kendala_mengajar['.write'], true, 'kendala_mengajar .write harus true');
  assert.ok(rulesJson.rules.laporan_kendala, 'Rules harus memiliki node laporan_kendala');
  assert.strictEqual(rulesJson.rules.laporan_kendala['.read'], true, 'laporan_kendala .read harus true');
  assert.strictEqual(rulesJson.rules.laporan_kendala['.write'], true, 'laporan_kendala .write harus true');

  console.log('  ✓ Laporan kendala guru -> Admin -> ACC Jamkos terverifikasi 100% konsisten.\n');

  console.log('================================================================');
  console.log('🎉 SELURUH PENGUJIAN 4 PERBAIKAN BUG UTAMA SUKSES 100%!');
  console.log('================================================================');
}

runTests().catch(err => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
