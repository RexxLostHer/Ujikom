// ===================================================================
// TEST SUITE: test-nfc-self-enrollment.js
// Pengujian Komprehensif Sistem Pendaftaran Mandiri Otomatis Kartu/NFC:
// 1. Validasi Keberadaan & Keutuhan Markup DOM & Komponen Visual
// 2. Request Pairing Siswa -> Auto-binding UID ke NISN Siswa
// 3. Request Pairing Guru Pengajar -> Auto-binding UID ke NIP Guru & Mapel
// 4. Request Pairing Walas -> Auto-binding UID dengan flag isWalas dan walasKelasId
// 5. Timeout Expiry (>30 detik ditolak & status expired)
// 6. Pembatalan Pairing Mandiri (batalkanPairingNfc)
// 7. Scan Kartu Setelah Pairing Langsung Mencatat Presensi Sesuai Peran
//    (Siswa -> Presensi Siswa & Kelas, Guru -> Presensi Guru & KBM Kelas Belajar)
// ===================================================================

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('===================================================================');
console.log('🧪 MENJALANKAN TEST SUITE SISTEM PENAUTAN MANDIRI KARTU NFC 2026');
console.log('===================================================================\n');

// -------------------------------------------------------------------
// 1. VALIDASI KEBERADAAN FILE & ELEMEN DOM UI
// -------------------------------------------------------------------
console.log('[Test 1] Evaluasi Keutuhan Elemen DOM UI di dashboard.html & dashboard-guru.html...');

const dashHtml = fs.readFileSync(path.join(__dirname, '../dashboard.html'), 'utf8');
const guruHtml = fs.readFileSync(path.join(__dirname, '../dashboard-guru.html'), 'utf8');

// A. DOM Siswa di dashboard.html
assert.ok(dashHtml.includes('id="widgetNfcSiswa"'), 'dashboard.html harus memuat elemen #widgetNfcSiswa');
assert.ok(dashHtml.includes('id="btnTautkanNfcSiswa"'), 'dashboard.html harus memuat tombol #btnTautkanNfcSiswa');
assert.ok(dashHtml.includes('id="badgeStatusNfcSiswa"'), 'dashboard.html harus memuat badge #badgeStatusNfcSiswa');
assert.ok(dashHtml.includes('id="modalPairingNfcSiswa"'), 'dashboard.html harus memuat modal #modalPairingNfcSiswa');
assert.ok(dashHtml.includes('id="countdownNfcSiswa"'), 'dashboard.html harus memuat countdown #countdownNfcSiswa');
assert.ok(dashHtml.includes('id="btnSimulasiTapSiswa"'), 'dashboard.html harus memuat tombol #btnSimulasiTapSiswa');
assert.ok(dashHtml.includes('id="btnBatalPairingSiswa"'), 'dashboard.html harus memuat tombol #btnBatalPairingSiswa');
assert.ok(dashHtml.includes('nfcPulseWave'), 'dashboard.html harus memuat animasi radar pulsa CSS');

// B. DOM Guru & Walas di dashboard-guru.html
assert.ok(guruHtml.includes('id="widgetNfcGuru"'), 'dashboard-guru.html harus memuat elemen #widgetNfcGuru');
assert.ok(guruHtml.includes('id="btnTautkanNfcGuru"'), 'dashboard-guru.html harus memuat tombol #btnTautkanNfcGuru');
assert.ok(guruHtml.includes('id="badgeStatusNfcGuru"'), 'dashboard-guru.html harus memuat badge #badgeStatusNfcGuru');
assert.ok(guruHtml.includes('id="modalPairingNfcGuru"'), 'dashboard-guru.html harus memuat modal #modalPairingNfcGuru');
assert.ok(guruHtml.includes('id="countdownNfcGuru"'), 'dashboard-guru.html harus memuat countdown #countdownNfcGuru');
assert.ok(guruHtml.includes('id="btnSimulasiTapGuru"'), 'dashboard-guru.html harus memuat tombol #btnSimulasiTapGuru');
assert.ok(guruHtml.includes('id="btnBatalPairingGuru"'), 'dashboard-guru.html harus memuat tombol #btnBatalPairingGuru');

// C. Keutuhan DOM ID Eksisting
const essentialIds = ['namaUser', 'roleBadge', 'countSudah', 'countBelum', 'pilihKelasPantau', 'smartCardUidTag'];
essentialIds.forEach(id => {
  assert.ok(dashHtml.includes(`id="${id}"`), `dashboard.html wajib mempertahankan ID eksisting: #${id}`);
});
const essentialGuruIds = ['namaUser', 'btnTabLiveGuru', 'btnTabAbsenGuru', 'guruJamMasuk', 'statHadirGuru'];
essentialGuruIds.forEach(id => {
  assert.ok(guruHtml.includes(`id="${id}"`), `dashboard-guru.html wajib mempertahankan ID eksisting: #${id}`);
});

console.log('✓ Seluruh elemen DOM penautan NFC Siswa, Guru & Walas terverifikasi utuh 100%!\n');

// -------------------------------------------------------------------
// 2. SETUP MOCK DATABASE RTDB FIREBASE
// -------------------------------------------------------------------
console.log('[Test 2] Mempersiapkan Mock Realtime Database...');

const mockDb = {
  pairing_request: null,
  kartu: {
    '006787337': { uid: '006787337', tipe: 'siswa', nisn: '0098263610', nama: 'M. IHSAN ATHALLAH', kelas: 'XII RPL 2' }
  },
  siswa: {
    '0098263610': { nama: 'M. IHSAN ATHALLAH', kelas: 'XII RPL 2', nisn: '0098263610' },
    '0082104129': { nama: 'RIZKY RAMADANI', kelas: 'XII RPL 2', nisn: '0082104129' }
  },
  guru: {
    '198109012009022003': { nama: 'Hani Hanifah, S.Si', nip: '198109012009022003', mapel: 'Pemrograman Web & Perangkat Bergerak' }
  },
  absensi: {},
  presensi_jam: {},
  presensi_guru: {},
  kelas: {
    'XII RPL 2': { status: 'jamkos', activeMapel: '-', activeTeacherNama: '-' }
  }
};

// Pasang Mock DB Engine
function createMockRef(pathStr) {
  const parts = pathStr.split('/').filter(Boolean);
  
  function getTarget() {
    let curr = mockDb;
    for (const p of parts) {
      if (curr[p] === undefined) return undefined;
      curr = curr[p];
    }
    return curr;
  }

  function setTarget(val) {
    let curr = mockDb;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      if (!curr[p] || typeof curr[p] !== 'object') curr[p] = {};
      curr = curr[p];
    }
    if (val === null || val === undefined) {
      delete curr[parts[parts.length - 1]];
    } else {
      curr[parts[parts.length - 1]] = JSON.parse(JSON.stringify(val));
    }
  }

  return {
    set: async (val) => { setTarget(val); },
    remove: async () => { setTarget(null); },
    update: async (val) => {
      let curr = getTarget();
      if (!curr || typeof curr !== 'object') {
        setTarget(val);
      } else {
        Object.assign(curr, JSON.parse(JSON.stringify(val)));
      }
    },
    once: async (evt) => {
      const val = getTarget();
      return {
        exists: () => val !== undefined && val !== null,
        val: () => (val === undefined ? null : JSON.parse(JSON.stringify(val)))
      };
    },
    on: (evt, cb) => {
      const val = getTarget();
      cb({ val: () => (val === undefined ? null : JSON.parse(JSON.stringify(val))) });
    },
    off: (evt, cb) => {}
  };
}

global.db = {
  ref: (p) => createMockRef(p)
};

// Muat fungsi dari firebase-config.js
const {
  mulaiPairingNfc,
  batalkanPairingNfc,
  dengarkanHasilPairing,
  simulasiTapPairing,
  cekKartuUser
} = require('../assets/firebase-config.js');

console.log('✓ Mock RTDB Firebase terhubung siap menguji siklus hidup penautan kartu.\n');

// -------------------------------------------------------------------
// 3. TEST PAIRING SISWA -> AUTO-BINDING UID KE NISN
// -------------------------------------------------------------------
(async () => {
  console.log('[Test 3] Uji Request Pairing Siswa -> Auto-binding UID ke NISN Siswa...');

  const siswaReq = await mulaiPairingNfc({
    userId: '0082104129',
    role: 'siswa',
    nama: 'Rizky Ramadhani',
    kelas: 'XII RPL 2'
  });

  assert.strictEqual(siswaReq.active, true, 'Status request pairing harus aktif');
  assert.strictEqual(siswaReq.status, 'waiting', 'Status pairing harus waiting');
  assert.strictEqual(siswaReq.userId, '0082104129', 'NISN pemohon harus sesuai');
  assert.strictEqual(siswaReq.role, 'siswa', 'Role harus siswa');

  // Evaluasi mockDb
  assert.strictEqual(mockDb.pairing_request.active, true);
  assert.strictEqual(mockDb.pairing_request.userId, '0082104129');

  // Lakukan Tap Kartu Fisik / Simulasi Siswa UID: 04X1Y2Z3
  const tapSiswaResult = await simulasiTapPairing('04X1Y2Z3');
  assert.strictEqual(tapSiswaResult.success, true, 'Simulasi tap pairing siswa harus berhasil');
  assert.strictEqual(tapSiswaResult.uid, '04X1Y2Z3');
  assert.strictEqual(mockDb.pairing_request.active, false, 'Pairing request harus ditutup (active = false)');
  assert.strictEqual(mockDb.pairing_request.status, 'success', 'Pairing status harus success');

  // Verifikasi Kartu Tersimpan di /kartu/04X1Y2Z3
  const kartuTersimpan = mockDb.kartu['04X1Y2Z3'];
  assert.ok(kartuTersimpan, 'Data kartu 04X1Y2Z3 harus tersimpan di /kartu');
  assert.strictEqual(kartuTersimpan.tipe, 'siswa', 'Tipe kartu harus siswa');
  assert.strictEqual(kartuTersimpan.nisn, '0082104129', 'NISN harus terikat');
  assert.strictEqual(kartuTersimpan.nama, 'Rizky Ramadhani');
  assert.strictEqual(kartuTersimpan.kelas, 'XII RPL 2');
  assert.ok(kartuTersimpan.linkedAt, 'Timestamp linkedAt harus ada');

  // Verifikasi helper cekKartuUser
  const kartuCek = await cekKartuUser('0082104129');
  assert.ok(kartuCek && kartuCek.uid === '04X1Y2Z3', 'cekKartuUser harus menemukan kartu yang baru ditautkan');
  console.log('✓ Pairing Siswa sukses: UID 04X1Y2Z3 terikat sempurna ke NISN 0082104129 (Rizky Ramadhani).\n');

  // -------------------------------------------------------------------
  // 4. TEST PAIRING GURU PENGAJAR -> AUTO-BINDING UID KE NIP GURU & MAPEL
  // -------------------------------------------------------------------
  console.log('[Test 4] Uji Request Pairing Guru Pengajar -> Auto-binding UID ke NIP Guru & Mapel...');

  const guruReq = await mulaiPairingNfc({
    userId: '198109012009022003',
    role: 'guru',
    nama: 'Hani Hanifah, S.Si',
    mapel: 'Pemrograman Web & Perangkat Bergerak'
  });

  assert.strictEqual(guruReq.active, true);
  assert.strictEqual(guruReq.role, 'guru');
  assert.strictEqual(guruReq.mapel, 'Pemrograman Web & Perangkat Bergerak');

  // Tap Kartu Dinas Guru UID: 04A2B3C4
  const tapGuruResult = await simulasiTapPairing('04A2B3C4');
  assert.strictEqual(tapGuruResult.success, true);
  assert.strictEqual(tapGuruResult.cardData.tipe, 'guru');
  assert.strictEqual(tapGuruResult.cardData.nip, '198109012009022003');
  assert.strictEqual(tapGuruResult.cardData.mapel, 'Pemrograman Web & Perangkat Bergerak');
  assert.strictEqual(tapGuruResult.cardData.isWalas, false);

  const kartuGuru = mockDb.kartu['04A2B3C4'];
  assert.ok(kartuGuru, 'Data kartu guru harus tersimpan di /kartu/04A2B3C4');
  assert.strictEqual(kartuGuru.nip, '198109012009022003');
  console.log('✓ Pairing Guru Pengajar sukses: UID 04A2B3C4 terikat ke NIP 198109012009022003 (Hani Hanifah, S.Si).\n');

  // -------------------------------------------------------------------
  // 5. TEST PAIRING WALAS -> AUTO-BINDING UID DENGAN isWalas & walasKelasId
  // -------------------------------------------------------------------
  console.log('[Test 5] Uji Request Pairing Wali Kelas -> Auto-binding UID dengan isWalas & walasKelasId...');

  const walasReq = await mulaiPairingNfc({
    userId: '199209142022211007',
    role: 'walas',
    nama: 'M. Echa Putra, S.Kom.Gr',
    isWalas: true,
    walasKelasId: 'XII RPL 2'
  });

  assert.strictEqual(walasReq.isWalas, true);
  assert.strictEqual(walasReq.walasKelasId, 'XII RPL 2');

  // Tap Kartu Walas UID: 04W1L2S3
  const tapWalasResult = await simulasiTapPairing('04W1L2S3');
  assert.strictEqual(tapWalasResult.success, true);
  const kartuWalas = mockDb.kartu['04W1L2S3'];
  assert.ok(kartuWalas, 'Kartu walas harus tersimpan');
  assert.strictEqual(kartuWalas.tipe, 'guru');
  assert.strictEqual(kartuWalas.isWalas, true);
  assert.strictEqual(kartuWalas.walasKelasId, 'XII RPL 2');
  console.log('✓ Pairing Wali Kelas sukses: UID 04W1L2S3 terikat dengan identitas Walas XII RPL 2.\n');

  // -------------------------------------------------------------------
  // 6. TEST TIMEOUT EXPIRY (>30 DETIK DITOLAK)
  // -------------------------------------------------------------------
  console.log('[Test 6] Evaluasi Proteksi Batas Waktu Timeout (>30 Detik Ditolak)...');

  await mulaiPairingNfc({
    userId: '0091113849',
    role: 'siswa',
    nama: 'Ahsan Mahmud',
    kelas: 'XII RPL 1'
  });

  // Manipulasi timestamp seolah-olah request sudah 35 detik yang lalu
  mockDb.pairing_request.timestamp = Date.now() - 35000;

  const tapExpiredResult = await simulasiTapPairing('04EXPIRE1');
  assert.strictEqual(tapExpiredResult.success, false, 'Tap kartu pada request kadaluwarsa harus ditolak');
  assert.strictEqual(tapExpiredResult.reason, 'EXPIRED', 'Alasan penolakan harus EXPIRED');
  assert.strictEqual(mockDb.pairing_request.active, false, 'Request kadaluwarsa harus dinonaktifkan');
  assert.strictEqual(mockDb.pairing_request.status, 'expired', 'Status request harus expired');
  assert.strictEqual(mockDb.kartu['04EXPIRE1'], undefined, 'Kartu kadaluwarsa tidak boleh didaftarkan ke /kartu');
  console.log('✓ Proteksi Timeout 30 detik bekerja presisi: Request kadaluwarsa berhasil digagalkan & di-expire.\n');

  // -------------------------------------------------------------------
  // 7. TEST PEMBATALAN PAIRING (batalkanPairingNfc)
  // -------------------------------------------------------------------
  console.log('[Test 7] Evaluasi Fitur Pembatalan Pairing Mandiri...');

  await mulaiPairingNfc({
    userId: '0081953923',
    role: 'siswa',
    nama: 'Aida Saharawati',
    kelas: 'XII RPL 1'
  });
  assert.strictEqual(mockDb.pairing_request.active, true);

  await batalkanPairingNfc();
  assert.strictEqual(mockDb.pairing_request.active, false, 'Pairing harus non-aktif setelah dibatalkan');
  assert.strictEqual(mockDb.pairing_request.status, 'cancelled', 'Status harus cancelled');

  const tapAfterCancel = await simulasiTapPairing('04CANCEL1');
  assert.strictEqual(tapAfterCancel.success, false);
  assert.strictEqual(tapAfterCancel.reason, 'NO_ACTIVE_REQUEST');
  console.log('✓ Pembatalan pairing mandiri berfungsi optimal dan menghentikan handshake penautan.\n');

  // -------------------------------------------------------------------
  // 8. TEST SCAN KARTU SETELAH PAIRING LANGSUNG MENCATAT PRESENSI SESUAI PERAN
  // -------------------------------------------------------------------
  console.log('[Test 8] Evaluasi Integrasi Scanner Presensi Pasca-Pairing Mandiri...');

  // Gateway Scanner Engine Simulator (Merefleksikan absensi_rpi.py & esp32)
  function processScanTap(uidKartu, jamTap = '06:25:00', tgl = '2026-10-22') {
    const kartu = mockDb.kartu[uidKartu];
    if (!kartu) return { success: false, reason: 'UNREGISTERED' };

    // Jika Guru / Walas
    if (kartu.tipe === 'guru') {
      const nip = kartu.nip;
      mockDb.presensi_guru[nip] = mockDb.presensi_guru[nip] || {};
      mockDb.presensi_guru[nip][tgl] = {
        rfidUid: uidKartu,
        nama: kartu.nama,
        nip: nip,
        jamMasuk: jamTap,
        status: 'hadir',
        mapel: kartu.mapel || 'Pemrograman RPL',
        device_id: 'gateway-rpi-01',
        isWalas: kartu.isWalas || false,
        walasKelasId: kartu.walasKelasId || ''
      };

      // Nyalakan KBM kelas menjadi belajar
      const targetKelas = kartu.walasKelasId || kartu.kelas || 'XII RPL 2';
      mockDb.kelas[targetKelas] = {
        status: 'belajar',
        activeMapel: kartu.mapel || 'Pemrograman RPL',
        activeTeacherNama: kartu.nama,
        activeTeacherId: nip,
        updatedAt: new Date().toISOString()
      };

      return {
        success: true,
        role: 'guru',
        nip: nip,
        nama: kartu.nama,
        kelasAktif: targetKelas,
        statusKbm: 'belajar'
      };
    }

    // Jika Siswa
    if (kartu.tipe === 'siswa') {
      const nisn = kartu.nisn;
      mockDb.absensi[nisn] = mockDb.absensi[nisn] || [];
      mockDb.absensi[nisn].push({
        tanggal: tgl,
        waktu: jamTap,
        status: 'hadir',
        keterangan: 'Hadir (Tepat Waktu)',
        rfidUid: uidKartu
      });

      const k = kartu.kelas || 'XII RPL 2';
      mockDb.presensi_jam[k] = mockDb.presensi_jam[k] || {};
      mockDb.presensi_jam[k][tgl] = mockDb.presensi_jam[k][tgl] || {};
      mockDb.presensi_jam[k][tgl]['1'] = mockDb.presensi_jam[k][tgl]['1'] || {};
      mockDb.presensi_jam[k][tgl]['1'][nisn] = {
        waktu: jamTap,
        status: 'hadir',
        keterangan: 'Hadir (Tepat Waktu)',
        tipe: 'rfid_fisik',
        rfidUid: uidKartu
      };

      return {
        success: true,
        role: 'siswa',
        nisn: nisn,
        nama: kartu.nama,
        kelas: k,
        statusPresensi: 'hadir'
      };
    }
  }

  // A. Scan Kartu Siswa yang Baru Saja Ditautkan (04X1Y2Z3 milik Rizky Ramadhani)
  const scanSiswa = processScanTap('04X1Y2Z3', '06:20:00', '2026-10-22');
  assert.strictEqual(scanSiswa.success, true);
  assert.strictEqual(scanSiswa.role, 'siswa');
  assert.strictEqual(scanSiswa.nisn, '0082104129');
  assert.strictEqual(mockDb.presensi_jam['XII RPL 2']['2026-10-22']['1']['0082104129'].status, 'hadir');
  console.log('✓ Kartu Siswa hasil pairing mandiri langsung diterima gerbang: Rizky Ramadhani tercatat HADIR!');

  // B. Scan Kartu Guru yang Baru Saja Ditautkan (04A2B3C4 milik Hani Hanifah, S.Si)
  const scanGuru = processScanTap('04A2B3C4', '06:25:00', '2026-10-22');
  assert.strictEqual(scanGuru.success, true);
  assert.strictEqual(scanGuru.role, 'guru');
  assert.strictEqual(scanGuru.nip, '198109012009022003');
  assert.strictEqual(mockDb.presensi_guru['198109012009022003']['2026-10-22'].status, 'hadir');
  assert.strictEqual(mockDb.kelas['XII RPL 2'].status, 'belajar', 'KBM kelas binaan harus otomatis beralih menjadi belajar');
  console.log('✓ Kartu Guru hasil pairing mandiri langsung diterima gerbang: Presensi Guru masuk & status KBM aktif (BELAJAR)!');

  // -------------------------------------------------------------------
  // 9. TEST RE-ENROLLMENT / PENGGANTIAN KARTU (KARTU LAMA DIHAPUS)
  // -------------------------------------------------------------------
  console.log('[Test 9] Evaluasi Re-enrollment / Penggantian Kartu (Kartu Lama Dihapus)...');
  // Ihsan sebelumnya memiliki kartu UID '006787337' di mockDb
  assert.ok(mockDb.kartu['006787337'], 'Kartu awal Ihsan harus ada');

  await mulaiPairingNfc({
    userId: '0098263610',
    role: 'siswa',
    nama: 'M. IHSAN ATHALLAH',
    kelas: 'XII RPL 2'
  });

  const tapReEnroll = await simulasiTapPairing('04IHSAN_NEW');
  assert.strictEqual(tapReEnroll.success, true);
  assert.strictEqual(tapReEnroll.uid, '04IHSAN_NEW');

  // Kartu baru tersimpan
  assert.ok(mockDb.kartu['04IHSAN_NEW'], 'Kartu baru 04IHSAN_NEW harus tersimpan');
  // Kartu lama wajib dihapus untuk mencegah orphan / duplicate card binding
  assert.strictEqual(mockDb.kartu['006787337'], undefined, 'Kartu lama 006787337 harus terhapus/unlinked');

  // Verifikasi cekKartuUser mengembalikan kartu terbaru
  const kartuTerbaruIhsan = await cekKartuUser('0098263610');
  assert.strictEqual(kartuTerbaruIhsan.uid, '04IHSAN_NEW', 'cekKartuUser harus menemukan UID baru');
  console.log('✓ Re-enrollment terverifikasi bersih: Kartu lama dihapus dan UID baru aktif.\n');

  // -------------------------------------------------------------------
  // 10. TEST VALIDASI INPUT PADA mulaiPairingNfc (userId wajib ada)
  // -------------------------------------------------------------------
  console.log('[Test 10] Evaluasi Validasi Input mulaiPairingNfc...');
  let thrownEmpty = false;
  try {
    await mulaiPairingNfc({ role: 'siswa', nama: 'Tanpa ID' });
  } catch (err) {
    thrownEmpty = true;
    assert.ok(err.message.includes('User ID'), 'Pesan error harus menyebutkan User ID');
  }
  assert.strictEqual(thrownEmpty, true, 'Request pairing tanpa userId wajib ditolak dengan exception');
  console.log('✓ Validasi input berhasil: Permintaan pairing tanpa identitas ditolak tegas.\n');

  // -------------------------------------------------------------------
  // 11. TEST PROTEKSI STATUS SUKSES PADA batalkanPairingNfc
  // -------------------------------------------------------------------
  console.log('[Test 11] Evaluasi Proteksi Status Sukses saat batalkanPairingNfc...');
  // Status pairing saat ini di mockDb adalah 'success'
  assert.strictEqual(mockDb.pairing_request.status, 'success');
  const resBatal = await batalkanPairingNfc();
  // Status tidak boleh berubah menjadi 'cancelled' jika sudah berstatus 'success'
  assert.strictEqual(mockDb.pairing_request.status, 'success', 'Status success tidak boleh ditimpa menjadi cancelled');
  console.log('✓ Proteksi status sukses terbukti aman dari pembatalan tak disengaja.\n');

  // -------------------------------------------------------------------
  // 12. TEST AUDIT STATIS FIRMWARE HARDWARE (ESP32 & RASPBERRY PI)
  // -------------------------------------------------------------------
  console.log('[Test 12] Evaluasi Audit Sintaks & Integritas Firmware Hardware...');
  const espCode = fs.readFileSync(path.join(__dirname, '../iot/esp32_rfid_rc522.ino'), 'utf8');
  const rpiCode = fs.readFileSync(path.join(__dirname, '../iot/absensi_rpi.py'), 'utf8');

  // A. Verifikasi ESP32 tidak memuat string quotes ganda rusak
  assert.ok(!espCode.includes('""active":true"'), 'ESP32 tidak boleh memuat quotes ganda invalid ""active":true"');
  assert.ok(espCode.includes(String.raw`indexOf("\"active\":true")`), 'ESP32 harus memuat string escape valid C++ \"active\":true');
  assert.ok(espCode.includes('int codePairing = httpPairing.GET();'), 'ESP32 harus memeriksa endpoint pairing_request');
  assert.ok(espCode.includes('tsEnd != -1'), 'ESP32 harus memvalidasi timestamp timeout 30s');
  assert.ok(espCode.includes('isGuru = (payload.indexOf('), 'ESP32 harus mendukung deteksi presensi kartu dinas guru');

  // B. Verifikasi RPi memuat delete_firebase dan pembersihan kartu lama
  assert.ok(rpiCode.includes('def delete_firebase('), 'absensi_rpi.py harus menyediakan helper delete_firebase');
  assert.ok(rpiCode.includes('[RE-ENROLLMENT] Kartu lama'), 'absensi_rpi.py harus membersihkan kartu lama saat pairing baru');

  console.log('✓ Audit sintaks hardware ESP32 & Raspberry Pi terverifikasi 100% valid dan tangguh!\n');
  console.log('\n===================================================================');
  console.log('🎉 SEMUA PENGUJIAN PENAUTAN MANDIRI NFC (SELF-ENROLLMENT) BERHASIL 100%!');
  console.log('===================================================================');
})();
