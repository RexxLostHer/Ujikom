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

// [Test 2] Verifikasi Tap Tepat Waktu (Hadir <= 06:30 WIB)
console.log('▶ [Test 2] Verifikasi Evaluasi Status Hadir Tepat Waktu...');
const resHadir = contract.processCardTap('006787337', {
  timestamp: new Date('2026-10-29T06:20:00+07:00'),
  deviceId: 'esp32-gerbang-depan',
  cooldownSeconds: 0
});
assert.strictEqual(resHadir.success, true);
assert.strictEqual(resHadir.status, 'hadir');
assert.strictEqual(resHadir.nisn, '0098263610');
assert.strictEqual(resHadir.nama, 'M. IHSAN ATHALLAH');
assert.ok(resHadir.firebasePaths['absensi/0098263610/2026-10-29'], 'Path absensi siswa harus terbuat');
console.log('  ✓ Tap sebelum 06:30 WIB menghasilkan status HADIR dengan path Firebase valid.\n');

// [Test 3] Verifikasi Tap Terlambat (> 06:30 WIB)
console.log('▶ [Test 3] Verifikasi Evaluasi Status Terlambat...');
const resTerlambat = contract.processCardTap('1058384422', {
  timestamp: new Date('2026-10-29T07:15:00+07:00'),
  deviceId: 'esp32-gerbang-depan',
  cooldownSeconds: 0
});
assert.strictEqual(resTerlambat.success, true);
assert.strictEqual(resTerlambat.status, 'terlambat');
assert.strictEqual(resTerlambat.nisn, '0082104129');
assert.strictEqual(resTerlambat.nama, 'RIZKY RAMADANI');
console.log('  ✓ Tap setelah 06:30 WIB menghasilkan status TERLAMBAT.\n');

// [Test 4] Verifikasi Proteksi Izin/Sakit (Immutability Rule)
console.log('▶ [Test 4] Verifikasi Proteksi Izin/Sakit Sah Tidak Tertimpa Tap RFID...');
const resIzin = contract.processCardTap('006787337', {
  timestamp: new Date('2026-10-29T06:20:00+07:00'),
  cooldownSeconds: 0,
  permitList: [
    {
      nisn: '0098263610',
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
contract.processCardTap('A1B2C3D4', {
  timestamp: new Date('2026-10-29T06:10:00+07:00'),
  cooldownSeconds: 5
});
const tapCepat = contract.processCardTap('A1B2C3D4', {
  timestamp: new Date('2026-10-29T06:10:02+07:00'),
  cooldownSeconds: 5
});
assert.strictEqual(tapCepat.success, false);
assert.strictEqual(tapCepat.error, 'COOLDOWN_ACTIVE');
console.log('  ✓ Cooldown aktif: Tap kedua dalam selang 2 detik berhasil diblokir.\n');

// [Test 6] Verifikasi Format Endpoint ESP32 REST API
console.log('▶ [Test 6] Verifikasi Format Endpoint ESP32 REST API...');
const esp32Rest = contract.getEsp32RestEndpoint('0098263610', '2026-10-29', { status: 'hadir' });
assert.ok(esp32Rest.url.endsWith('/absensi/0098263610/2026-10-29.json'), 'URL REST API Firebase harus berakhiran .json');
assert.strictEqual(esp32Rest.method, 'PATCH');
console.log('  ✓ Endpoint REST API untuk ESP32 Arduino HTTPClient terbentuk dengan benar.\n');

// [Test 7] Verifikasi Penautan Kartu Mandiri (Pairing Completion)
console.log('▶ [Test 7] Verifikasi Alur Pairing Kartu Baru...');
const reqPairing = {
  active: true,
  userId: '00082109', // Tifani Adisya Ramadhani
  role: 'siswa',
  nama: 'TIFANI ADISYA RAMADHANI',
  kelas: 'XII RPL 2',
  status: 'waiting'
};
const resPairing = contract.resolvePairingCompletion(reqPairing, '99EE88FF');
assert.ok(resPairing, 'Hasil pairing harus terbuat');
assert.strictEqual(resPairing.pairingUpdate.status, 'success');
assert.strictEqual(resPairing.pairingUpdate.cardUid, '99EE88FF');
assert.strictEqual(resPairing.kartuUpdate['kartu/99EE88FF'].nisn, '00082109');
console.log('  ✓ Alur pairing kartu baru siswa Tifani sukses dipetakan ke kartu/99EE88FF.\n');

console.log('================================================================');
console.log('🎉 SEMUA PENGUJIAN PRESENSIA IoT CONTRACT LULUS 100%!');
console.log('================================================================');
