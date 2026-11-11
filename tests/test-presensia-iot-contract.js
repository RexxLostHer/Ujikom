/**
 * ===================================================================
 * TEST SUITE: test-presensia-iot-contract.js
 * Verifikasi Modul Integrasi IoT Gateway & Presensia Bridge SDK
 * ===================================================================
 */

const assert = require('assert');
const contract = require('../presensia-iot-contract.js');

console.log('================================================================');
console.log('🧪 PENGUJIAN PRESENSIA IoT CONTRACT & BRIDGE SDK');
console.log('================================================================\n');

// [Test 1] Verifikasi Konfigurasi Dasar
console.log('▶ [Test 1] Verifikasi Konfigurasi Database Firebase RTDB...');
assert.ok(contract.FIREBASE_IOT_CONFIG.databaseURL.includes('absensi-6e385'), 'URL Firebase RTDB harus valid');
assert.strictEqual(contract.ATURAN_WAKTU_PRESENSI.TIMEZONE, 'Asia/Jakarta', 'Timezone harus WIB');
console.log('  ✓ Konfigurasi Firebase RTDB dan zona waktu WIB valid.\n');

// [Test 1B] Verifikasi Isolasi Zero-Dummy (PRD FR-1.3)
console.log('▶ [Test 1B] Verifikasi Isolasi Kartu Dummy Tanpa allowTestCards...');
const resUnregistered = contract.processCardTap('TEST_UID_0001', {
  timestamp: new Date('2026-10-29T06:20:00+07:00'),
  deviceId: 'esp32-gerbang-depan',
  cooldownSeconds: 0
});
assert.strictEqual(resUnregistered.success, false, 'Kartu mock tidak boleh lolos tanpa allowTestCards');
assert.strictEqual(resUnregistered.error, 'UNREGISTERED_CARD', 'Harus mengembalikan error UNREGISTERED_CARD');
console.log('  ✓ Kartu dummy berhasil diisolasi dari alur produksi normal.\n');

// [Test 2] Verifikasi Tap Tepat Waktu (Hadir <= 06:30 WIB) dengan Dummy UID Sintetis (PRD Bab 5.1 & FR-1.3)
console.log('▶ [Test 2] Verifikasi Evaluasi Status Hadir Tepat Waktu (dengan allowTestCards)...');
const resHadir = contract.processCardTap('TEST_UID_0001', {
  timestamp: new Date('2026-10-29T06:20:00+07:00'),
  deviceId: 'esp32-gerbang-depan',
  cooldownSeconds: 0,
  allowTestCards: true
});
assert.strictEqual(resHadir.success, true);
assert.strictEqual(resHadir.status, 'hadir');
assert.strictEqual(resHadir.nisn, '9999999991');
assert.strictEqual(resHadir.nama, 'Siswa Uji 01');
assert.ok(resHadir.firebasePaths['absensi/9999999991/2026-10-29'], 'Path absensi siswa harus terbuat');
console.log('  ✓ Tap sebelum 06:30 WIB menghasilkan status HADIR dengan path Firebase valid.\n');

// [Test 3] Verifikasi Tap Terlambat (> 06:30 WIB)
console.log('▶ [Test 3] Verifikasi Evaluasi Status Terlambat...');
const resTerlambat = contract.processCardTap('TEST_UID_0002', {
  timestamp: new Date('2026-10-29T07:15:00+07:00'),
  deviceId: 'esp32-gerbang-depan',
  cooldownSeconds: 0,
  allowTestCards: true
});
assert.strictEqual(resTerlambat.success, true);
assert.strictEqual(resTerlambat.status, 'terlambat');
assert.strictEqual(resTerlambat.nisn, '9999999992');
assert.strictEqual(resTerlambat.nama, 'Siswa Uji 02');
console.log('  ✓ Tap setelah 06:30 WIB menghasilkan status TERLAMBAT.\n');

// [Test 4] Verifikasi Proteksi Izin/Sakit (Immutability Rule)
console.log('▶ [Test 4] Verifikasi Proteksi Izin/Sakit Sah Tidak Tertimpa Tap RFID...');
const resIzin = contract.processCardTap('TEST_UID_0001', {
  timestamp: new Date('2026-10-29T06:20:00+07:00'),
  cooldownSeconds: 0,
  allowTestCards: true,
  permitList: [
    {
      nisn: '9999999991',
      jenis: 'sakit',
      status: 'disetujui',
      tanggal_mulai: '2026-10-29',
      tanggal_selesai: '2026-10-29'
    }
  ]
});
assert.strictEqual(resIzin.success, true);
assert.strictEqual(resIzin.ignored, true);
assert.strictEqual(resIzin.status, 'sakit');
assert.strictEqual(resIzin.reason, 'APPROVED_PERMIT_ACTIVE');
console.log('  ✓ Siswa dengan izin sakit resmi yang disetujui tidak tertimpa tap RFID (LULUS).\n');

// [Test 5] Verifikasi Anti-Double Tap (Cooldown)
console.log('▶ [Test 5] Verifikasi Anti-Double Tap / Cooldown...');
contract.processCardTap('TEST_UID_0001', {
  timestamp: new Date('2026-10-29T06:10:00+07:00'),
  cooldownSeconds: 5,
  allowTestCards: true
});
const tapCepat = contract.processCardTap('TEST_UID_0001', {
  timestamp: new Date('2026-10-29T06:10:02+07:00'),
  cooldownSeconds: 5,
  allowTestCards: true
});
assert.strictEqual(tapCepat.success, false);
assert.strictEqual(tapCepat.error, 'COOLDOWN_ACTIVE');
console.log('  ✓ Cooldown aktif: Tap kedua dalam selang 2 detik berhasil diblokir.\n');

// [Test 6] Verifikasi Format Endpoint ESP32 REST API (Dengan & Tanpa Token Autentikasi)
console.log('▶ [Test 6] Verifikasi Format Endpoint ESP32 REST API...');
const esp32Rest = contract.getEsp32RestEndpoint('9999999991', '2026-10-29', { status: 'hadir' });
assert.ok(esp32Rest.url.endsWith('/absensi/9999999991/2026-10-29.json'), 'URL REST API Firebase harus berakhiran .json');
assert.strictEqual(esp32Rest.method, 'PATCH');

const esp32RestAuth = contract.getEsp32RestEndpoint('9999999991', '2026-10-29', { status: 'hadir' }, 'SAMPLE_FIREBASE_ID_TOKEN');
assert.ok(esp32RestAuth.url.includes('?auth=SAMPLE_FIREBASE_ID_TOKEN'), 'Endpoint REST harus menyertakan token autentikasi ?auth=');
console.log('  ✓ Endpoint REST API untuk ESP32 Arduino HTTPClient terbentuk dengan benar.\n');

// [Test 7] Verifikasi Penautan Kartu Mandiri (Pairing Completion) & Pencabutan Kartu Lama (FR-2.1 & FR-2.2)
console.log('▶ [Test 7] Verifikasi Alur Pairing Kartu Baru & Revoke Kartu Lama...');
const reqPairing = {
  active: true,
  userId: '00082109',
  role: 'siswa',
  nama: 'TIFANI ADISYA RAMADHANI',
  kelas: 'XII RPL 2',
  status: 'waiting',
  target_device_id: 'ESP32_READER_01',
  previous_uid: 'OLD_CARD_999'
};

// Sub-test 7A: Target Device Mismatch
const resMismatch = contract.resolvePairingCompletion(reqPairing, '99EE88FF', 'WRONG_READER_02');
assert.strictEqual(resMismatch.success, false, 'Harus gagal jika target_device_id tidak cocok');
assert.strictEqual(resMismatch.error, 'TARGET_DEVICE_MISMATCH');

// Sub-test 7B: Pairing Sukses & Revoke Kartu Lama
const resPairing = contract.resolvePairingCompletion(reqPairing, '99EE88FF', 'ESP32_READER_01');
assert.ok(resPairing, 'Hasil pairing harus terbuat');
assert.strictEqual(resPairing.pairingUpdate.status, 'success');
assert.strictEqual(resPairing.pairingUpdate.cardUid, '99EE88FF');
assert.strictEqual(resPairing.kartuUpdate['kartu/99EE88FF'].nisn, '00082109');
assert.strictEqual(resPairing.kartuUpdate['rfid_map/99EE88FF'].nisn, '00082109');
assert.strictEqual(resPairing.kartuUpdate['kartu/OLD_CARD_999'], null, 'Kartu lama wajib di-revoke (set null)');
assert.strictEqual(resPairing.kartuUpdate['rfid_map/OLD_CARD_999'], null, 'rfid_map lama wajib di-revoke (set null)');
console.log('  ✓ Alur pairing kartu baru siswa sukses dipetakan dan kartu lama di-revoke secara atomik.\n');

console.log('================================================================');
console.log('🎉 SEMUA PENGUJIAN PRESENSIA IoT CONTRACT LULUS 100%!');
console.log('================================================================');
