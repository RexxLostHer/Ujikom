// ===================================================================
// TEST SUITE: test-rfid-scan-flow.js
// Verifikasi End-to-End Simulasi RFID Scan Flow untuk:
// 1. M. Ihsan Athallah (NISN: 0098263610, UID: 04A1B2C3)
// 2. Rizky Ramadhani (NISN: 0082104129, UID: 04D4E5F6)
// 3. Validasi Anti-Double Tap (Cooldown)
// 4. Validasi Kartu Belum Terdaftar (Reject Unmapped UID)
// 5. Validasi Sinkronisasi Realtime ke Snapshot Presensi Dashboard
// ===================================================================

const assert = require('assert');

// 1. Mock Database In-Memory
const mockDb = {
  kartu: {
    '04A1B2C3': { nisn: '0098263610' },
    '04D4E5F6': { nisn: '0082104129' },
    'CORRUPT01': {} // Data kartu tanpa NISN
  },
  siswa: {
    '0098263610': {
      nama: 'M. Ihsan Athallah',
      kelas: 'XII RPL 2',
      email: 'ihsanathallah@gmail.com',
      foto: 'assets/foto/0098263610.jpg'
    },
    '0082104129': {
      nama: 'Rizky Ramadhani',
      kelas: 'XII RPL 2',
      email: 'rizkyramadhani@gmail.com',
      foto: 'assets/foto/0082104129.jpg'
    }
  },
  absensi: {},
  presensi_jam: {}
};

// 2. Mock Gateway RFID Processor Engine (mirroring esp32 & python gateway)
class MockRfidGateway {
  constructor(db, cooldownSeconds = 5) {
    this.db = db;
    this.cooldownSeconds = cooldownSeconds;
    this.riwayatTap = {};
  }

  tap(uidKartu, simulatedTimestamp = Date.now(), jamKe = 1) {
    const uid = uidKartu.trim().toUpperCase();
    const nowSec = simulatedTimestamp / 1000;

    // Check Cooldown Anti-Double Tap
    if (this.riwayatTap[uid] && (nowSec - this.riwayatTap[uid]) < this.cooldownSeconds) {
      return {
        success: false,
        reason: 'COOLDOWN_ACTIVE',
        message: `Kartu ${uid} baru saja di-tap (Anti-Double Tap).`
      };
    }

    this.riwayatTap[uid] = nowSec;

    // 1. Lookup Kartu
    const kartu = this.db.kartu[uid];
    if (!kartu) {
      return {
        success: false,
        reason: 'UNREGISTERED_CARD',
        message: `Kartu ${uid} belum terdaftar di sistem.`
      };
    }

    const nisn = typeof kartu === 'string' ? kartu : kartu.nisn;
    if (!nisn) {
      return {
        success: false,
        reason: 'CORRUPTED_CARD_DATA',
        message: `Data kartu ${uid} tidak memiliki field NISN.`
      };
    }

    // 2. Lookup Siswa
    const siswa = this.db.siswa[nisn];
    const namaSiswa = siswa ? siswa.nama : nisn;
    const kelas = siswa ? siswa.kelas : 'XII RPL 2';
    const tanggal = '2026-10-01';
    const waktu = '07:05:00';

    // 3. Simpan ke absensi/{nisn}
    if (!this.db.absensi[nisn]) {
      this.db.absensi[nisn] = [];
    }
    const recordAbsensi = {
      tanggal,
      waktu,
      status: 'hadir',
      device_id: 'gateway-rc522-mock'
    };
    this.db.absensi[nisn].push(recordAbsensi);

    // 4. Simpan ke presensi_jam/{kelas}/{tanggal}/{jamKe}/{nisn}
    if (!this.db.presensi_jam[kelas]) this.db.presensi_jam[kelas] = {};
    if (!this.db.presensi_jam[kelas][tanggal]) this.db.presensi_jam[kelas][tanggal] = {};
    if (!this.db.presensi_jam[kelas][tanggal][jamKe]) this.db.presensi_jam[kelas][tanggal][jamKe] = {};

    this.db.presensi_jam[kelas][tanggal][jamKe][nisn] = {
      waktu,
      status: 'hadir'
    };

    return {
      success: true,
      nisn,
      nama: namaSiswa,
      kelas,
      tanggal,
      waktu,
      status: 'hadir'
    };
  }
}

// 3. Mock Dashboard Presence State Evaluator
function evaluateDashboardStudentStatus(db, kelas, tanggal, jamKe, nisn) {
  const jamData = db.presensi_jam[kelas] &&
                  db.presensi_jam[kelas][tanggal] &&
                  db.presensi_jam[kelas][tanggal][jamKe];
  const record = jamData ? jamData[nisn] : null;

  if (record && record.status === 'hadir') {
    return {
      terdaftarHadir: true,
      status: 'hadir',
      waktu: record.waktu,
      badge: 'Sudah Hadir'
    };
  }
  return {
    terdaftarHadir: false,
    status: 'belum_absen',
    waktu: null,
    badge: 'Belum Absen'
  };
}

console.log('--- MEMULAI AUTOMATED TEST RFID SCAN FLOW ---');

const gateway = new MockRfidGateway(mockDb, 5);
const t0 = 1790650000000; // Mock timestamp awal

// TEST 1: Initial state (Belum Hadir)
console.log('\n[Test 1] Cek Status Awal Siswa Sebelum Tap');
const initialIhsan = evaluateDashboardStudentStatus(mockDb, 'XII RPL 2', '2026-10-01', 1, '0098263610');
const initialRizky = evaluateDashboardStudentStatus(mockDb, 'XII RPL 2', '2026-10-01', 1, '0082104129');

assert.strictEqual(initialIhsan.terdaftarHadir, false, 'Ihsan harusnya Belum Hadir sebelum scan');
assert.strictEqual(initialRizky.terdaftarHadir, false, 'Rizky harusnya Belum Hadir sebelum scan');
console.log('✓ Status awal: M. Ihsan Athallah & Rizky Ramadhani terkonfirmasi [Belum Absen]');

// TEST 2: Scan Kartu M. Ihsan Athallah (UID: 04A1B2C3)
console.log('\n[Test 2] Scan Kartu Fisik M. Ihsan Athallah (04A1B2C3)');
const resIhsan = gateway.tap('04A1B2C3', t0, 1);
assert.strictEqual(resIhsan.success, true, 'Scan Ihsan harus berhasil');
assert.strictEqual(resIhsan.nisn, '0098263610', 'NISN harus 0098263610');
assert.strictEqual(resIhsan.nama, 'M. Ihsan Athallah', 'Nama harus M. Ihsan Athallah');
assert.strictEqual(resIhsan.status, 'hadir', 'Status harus hadir');

const postScanIhsan = evaluateDashboardStudentStatus(mockDb, 'XII RPL 2', '2026-10-01', 1, '0098263610');
assert.strictEqual(postScanIhsan.terdaftarHadir, true, 'Ihsan harus langsung terdaftar Hadir di Dashboard');
assert.strictEqual(postScanIhsan.badge, 'Sudah Hadir');
console.log(`✓ Kartu Ihsan (04A1B2C3) sukses diproses: ${postScanIhsan.badge} pukul ${postScanIhsan.waktu}`);

// TEST 3: Anti-Double Tap Cooldown Test
console.log('\n[Test 3] Verifikasi Anti-Double Tap (Tap ulang Ihsan dalam 2 detik)');
const resDoubleTap = gateway.tap('04A1B2C3', t0 + 2000, 1);
assert.strictEqual(resDoubleTap.success, false, 'Double tap cepat harus ditolak');
assert.strictEqual(resDoubleTap.reason, 'COOLDOWN_ACTIVE');
console.log(`✓ Anti-Double Tap aktif: Ditolak dengan alasan [${resDoubleTap.reason}]`);

// TEST 4: Scan Kartu Rizky Ramadhani (UID: 04D4E5F6)
console.log('\n[Test 4] Scan Kartu Fisik Rizky Ramadhani (04D4E5F6)');
const resRizky = gateway.tap('04D4E5F6', t0 + 3000, 1);
assert.strictEqual(resRizky.success, true, 'Scan Rizky harus berhasil');
assert.strictEqual(resRizky.nisn, '0082104129', 'NISN harus 0082104129');
assert.strictEqual(resRizky.nama, 'Rizky Ramadhani', 'Nama harus Rizky Ramadhani');
assert.strictEqual(resRizky.status, 'hadir', 'Status harus hadir');

const postScanRizky = evaluateDashboardStudentStatus(mockDb, 'XII RPL 2', '2026-10-01', 1, '0082104129');
assert.strictEqual(postScanRizky.terdaftarHadir, true, 'Rizky harus langsung terdaftar Hadir di Dashboard');
assert.strictEqual(postScanRizky.badge, 'Sudah Hadir');
console.log(`✓ Kartu Rizky (04D4E5F6) sukses diproses: ${postScanRizky.badge} pukul ${postScanRizky.waktu}`);

// TEST 5: Scan Kartu Tidak Terdaftar (Reject Unmapped UID)
console.log('\n[Test 5] Scan Kartu Tidak Terdaftar (UID: 99AA88BB)');
const resUnmapped = gateway.tap('99AA88BB', t0 + 6000, 1);
assert.strictEqual(resUnmapped.success, false, 'Kartu acak harus ditolak');
assert.strictEqual(resUnmapped.reason, 'UNREGISTERED_CARD');
console.log(`✓ Kartu acak ditolak dengan tepat: [${resUnmapped.reason}]`);

// TEST 6: Proteksi Data Corrupt (UID terdaftar tapi tidak punya NISN)
console.log('\n[Test 6] Scan Kartu Data Rusak (UID: CORRUPT01)');
const resCorrupt = gateway.tap('CORRUPT01', t0 + 7000, 1);
assert.strictEqual(resCorrupt.success, false, 'Kartu tanpa NISN harus ditolak');
assert.strictEqual(resCorrupt.reason, 'CORRUPTED_CARD_DATA');
console.log(`✓ Proteksi data rusak lolos: [${resCorrupt.reason}]`);

// TEST 7: Scan Ulang Setelah Cooldown Habis (> 5 detik)
console.log('\n[Test 7] Scan Ulang Ihsan Setelah Cooldown Expired (6 detik kemudian)');
const resAfterCooldown = gateway.tap('04A1B2C3', t0 + 7500, 1);
assert.strictEqual(resAfterCooldown.success, true, 'Tap setelah cooldown habis harus diterima');
console.log('✓ Tap setelah cooldown sukses diterima kembali.');

console.log('\n======================================================');
console.log('🎉 SEMUA TEST RFID SCAN FLOW BERHASIL 100% LOLOS!');
console.log('======================================================');
