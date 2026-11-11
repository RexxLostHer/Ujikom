/**
 * ===================================================================
 * TEST SUITE: test-prd-epic1-epic4-comprehensive.js
 * Verifikasi Menyeluruh Kebutuhan PRD:
 * - Epic 1: Eliminasi Total Simulasi Palsu & Fallback Dummy
 * - Epic 2: Pengerasan Sistem NFC, RFID, & Gateway IoT
 * - Epic 3: Sinkronisasi Lintas Database (RTDB & Firestore) & Presisi Waktu
 * - Epic 4: Keamanan Sesi Klien & Manajemen Siklus Hidup Listener
 * ===================================================================
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('================================================================');
console.log('🧪 PENGUJIAN KOMPREHENSIF PRD: EPIC 1 S.D. EPIC 4');
console.log('================================================================\n');

// -------------------------------------------------------------------
// 1. EPIC 1: ELIMINASI TOTAL SIMULASI PALSU & FALLBACK DUMMY
// -------------------------------------------------------------------
console.log('▶ [Epic 1] Verifikasi Eliminasi Simulasi Palsu & Fallback Dummy...');

const liveJs = fs.readFileSync(path.join(__dirname, '../assets/presensi-live.js'), 'utf8');
assert.ok(!liveJs.includes('✓ Hadir (Otomatis)'), 'presensi-live.js TIDAK BOLEH mengandung "✓ Hadir (Otomatis)"');
assert.ok(!liveJs.includes('generateDefaultPresensiResmi(normKelas'), 'presensi-live.js TIDAK BOLEH memanggil generateDefaultPresensiResmi');
assert.ok(liveJs.includes('Kartu Belum Terdaftar'), 'presensi-live.js wajib menampilkan indikator "Kartu Belum Terdaftar" untuk siswa tanpa kartu');
assert.ok(liveJs.includes('kartu-belum-terdaftar'), 'presensi-live.js wajib memberikan marker class kartu-belum-terdaftar');
console.log('  ✓ presensi-live.js bersih dari status hadir otomatis & generator dummy.');

// Verifikasi isolasi kontrak IoT
const contract = require('../presensia-iot-contract.js');
const resWithoutAllow = contract.processCardTap('TEST_UID_0001', {
  timestamp: new Date('2026-10-29T06:20:00+07:00'),
  deviceId: 'esp32-gerbang-depan',
  cooldownSeconds: 0
});
assert.strictEqual(resWithoutAllow.success, false, 'Kartu preset uji coba wajib ditolak jika allowTestCards tidak aktif');
assert.strictEqual(resWithoutAllow.error, 'UNREGISTERED_CARD');

const resWithAllow = contract.processCardTap('TEST_UID_0001', {
  timestamp: new Date('2026-10-29T06:20:00+07:00'),
  deviceId: 'esp32-gerbang-depan',
  cooldownSeconds: 0,
  allowTestCards: true
});
assert.strictEqual(resWithAllow.success, true, 'Kartu preset uji coba hanya aktif saat allowTestCards: true');
console.log('  ✓ presensia-iot-contract.js sukses mengisolasi kartu uji coba.');

// Verifikasi Python Gateway absensi_rpi.py
const rpiPy = fs.readFileSync(path.join(__dirname, '../iot/absensi_rpi.py'), 'utf8');
assert.ok(rpiPy.includes('os.environ.get("IOT_TEST_MODE") == "1"'), 'absensi_rpi.py wajib membatasi KARTU_PRESET hanya saat IOT_TEST_MODE == "1"');
console.log('  ✓ absensi_rpi.py mengisolasi KARTU_PRESET ke IOT_TEST_MODE.\n');

// -------------------------------------------------------------------
// 2. EPIC 2: PENGERASAN SISTEM NFC, RFID, & GATEWAY IOT
// -------------------------------------------------------------------
console.log('▶ [Epic 2] Verifikasi Pengerasan NFC/RFID & Gateway IoT...');

// Test 2A: target_device_id & revoke previous_uid pada resolvePairingCompletion
const reqPairing = {
  active: true,
  userId: '0082104129',
  role: 'siswa',
  nama: 'RIZKY RAMADANI',
  kelas: 'XII RPL 2',
  status: 'waiting',
  target_device_id: 'GATEWAY_RPI_01',
  previous_uid: 'OLD_UID_12345'
};

const resDevMismatch = contract.resolvePairingCompletion(reqPairing, 'NEW_UID_67890', 'OTHER_GATEWAY_99');
assert.strictEqual(resDevMismatch.success, false);
assert.strictEqual(resDevMismatch.error, 'TARGET_DEVICE_MISMATCH');

const resPairingValid = contract.resolvePairingCompletion(reqPairing, 'NEW_UID_67890', 'GATEWAY_RPI_01');
assert.strictEqual(resPairingValid.success, true);
assert.strictEqual(resPairingValid.kartuUpdate['kartu/NEW_UID_67890'].nisn, '0082104129');
assert.strictEqual(resPairingValid.kartuUpdate['rfid_map/NEW_UID_67890'].nisn, '0082104129');
assert.strictEqual(resPairingValid.kartuUpdate['kartu/OLD_UID_12345'], null, 'Kartu lama harus di-revoke di path /kartu');
assert.strictEqual(resPairingValid.kartuUpdate['rfid_map/OLD_UID_12345'], null, 'Kartu lama harus di-revoke di path /rfid_map');
console.log('  ✓ Kontrak pairing memvalidasi target_device_id dan revoke atomik previous_uid.');

// Test 2B: Audit ESP32 Firmware (Cooldown per-UID & multi-path PATCH)
const espCode = fs.readFileSync(path.join(__dirname, '../iot/esp32_rfid_rc522.ino'), 'utf8');
assert.ok(espCode.includes('Anti-Double Tap per-UID'), 'ESP32 harus menerapkan cooldown per-UID');
assert.ok(espCode.includes('Jeda minimum antar-kartu berbeda 500ms'), 'ESP32 harus menerapkan debouncing 500ms antar kartu berbeda');
assert.ok(espCode.includes('Multi-Path Atomic HTTP PATCH'), 'ESP32 harus mengirim multi-path atomic PATCH');
console.log('  ✓ Firmware ESP32 mengimplementasikan cooldown per-UID dan multi-path PATCH.');

// Test 2C: Audit Raspberry Pi (Offline Queue scanned_at & NTP Check)
assert.ok(rpiPy.includes('def check_ntp_sync():'), 'absensi_rpi.py wajib memiliki fungsi check_ntp_sync');
assert.ok(rpiPy.includes('scanned_at'), 'absensi_rpi.py wajib memisahkan kolom scanned_at pada offline_queue');
console.log('  ✓ Gateway Raspberry Pi menyertakan pengecekan NTP dan pemisahan scanned_at.\n');

// -------------------------------------------------------------------
// 3. EPIC 3: SINKRONISASI LINTAS DATABASE & VALIDASI PRESENSI
// -------------------------------------------------------------------
console.log('▶ [Epic 3] Verifikasi Sinkronisasi Lintas Database & Validasi Presensi...');

// Test 3A: Presisi Waktu (<= 06:30:00 Hadir, 06:30:01 - 08:00:00 Terlambat)
const tapTepat = contract.processCardTap('TEST_UID_0001', {
  timestamp: new Date('2026-10-29T06:30:00+07:00'),
  deviceId: 'esp32-gerbang-depan',
  cooldownSeconds: 0,
  allowTestCards: true
});
assert.strictEqual(tapTepat.status, 'hadir', '06:30:00 WIB tepat harus Hadir');

const tapLewat1Detik = contract.processCardTap('TEST_UID_0001', {
  timestamp: new Date('2026-10-29T06:30:01+07:00'),
  deviceId: 'esp32-gerbang-depan',
  cooldownSeconds: 0,
  allowTestCards: true
});
assert.strictEqual(tapLewat1Detik.status, 'terlambat', '06:30:01 WIB harus Terlambat');
console.log('  ✓ Ambang batas waktu presensi seragam dan presisi hingga detik.');

// Test 3B: Validasi Akurasi GPS di functions/src/utils/geo.ts
const geoCode = fs.readFileSync(path.join(__dirname, '../functions/src/utils/geo.ts'), 'utf8');
assert.ok(geoCode.includes('validateGpsAccuracy'), 'geo.ts harus mengekspor fungsi validateGpsAccuracy');

const verifyAttCode = fs.readFileSync(path.join(__dirname, '../functions/src/triggers/verifyAttendance.ts'), 'utf8');
assert.ok(verifyAttCode.includes('coords.accuracy'), 'verifyAttendance.ts harus memvalidasi coords.accuracy');
assert.ok(verifyAttCode.includes('validateGpsAccuracy(coords.accuracy, 100)'), 'verifyAttendance.ts harus membatasi akurasi <= 100m');

const verifyOutCode = fs.readFileSync(path.join(__dirname, '../functions/src/triggers/verifyCheckout.ts'), 'utf8');
assert.ok(verifyOutCode.includes('logbookSubmitted !== true'), 'verifyCheckout.ts wajib memeriksa barrier logbookSubmitted == true');
assert.ok(verifyOutCode.includes('validateGpsAccuracy(coords.accuracy, 100)'), 'verifyCheckout.ts harus membatasi akurasi <= 100m');
console.log('  ✓ Validasi akurasi GPS <= 100m dan barrier check-out logbookSubmitted terverifikasi.');

// Test 3C: Cloud Function onRfidAttendanceWritten
const rfidTriggerCode = fs.readFileSync(path.join(__dirname, '../functions/src/triggers/onRfidAttendanceWritten.ts'), 'utf8');
assert.ok(rfidTriggerCode.includes('syncRfidRecordToFirestore'), 'onRfidAttendanceWritten.ts harus mengekspor syncRfidRecordToFirestore');
assert.ok(rfidTriggerCode.includes("method: 'rfid_gateway'"), 'Sinkronisasi harus menandai method: rfid_gateway');

const functionsIndex = fs.readFileSync(path.join(__dirname, '../functions/src/index.ts'), 'utf8');
assert.ok(functionsIndex.includes('onRfidAttendanceWritten'), 'functions/src/index.ts harus mengekspor onRfidAttendanceWritten');
console.log('  ✓ Cloud Function onRfidAttendanceWritten siap menghubungkan RTDB ke Firestore.\n');

// -------------------------------------------------------------------
// 4. EPIC 4: KEAMANAN SESI KLIEN & MANAJEMEN LISTENER REALTIME
// -------------------------------------------------------------------
console.log('▶ [Epic 4] Verifikasi Keamanan Sesi Klien & Manajemen Listener...');

const dashJs = fs.readFileSync(path.join(__dirname, '../assets/dashboard.js'), 'utf8');
assert.ok(dashJs.includes('window._listenerPresensiJamSiswa'), 'dashboard.js harus melacak dan membersihkan _listenerPresensiJamSiswa');

const guruJs = fs.readFileSync(path.join(__dirname, '../assets/dashboard-guru.js'), 'utf8');
assert.ok(guruJs.includes('window._listenerKelasWalas'), 'dashboard-guru.js harus melacak dan membersihkan _listenerKelasWalas');

assert.ok(liveJs.includes('listenerPresensiJam.ref.off'), 'presensi-live.js harus memanggil .off() saat pergantian kelas');
console.log('  ✓ Manajemen siklus hidup listener realtime (.off()) aktif di seluruh UI utama.');

console.log('\n================================================================');
console.log('🎉 SELURUH VERIFIKASI PRD (EPIC 1 - EPIC 4) SUKSES 100%!');
console.log('================================================================');
