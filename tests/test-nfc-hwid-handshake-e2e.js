/**
 * ===================================================================
 * TEST SUITE: NFC SMARTPHONE HWID HANDSHAKE — ORDER & FAILURE PATHS
 * SMK Negeri 1 Sumedang — Presensia IoT
 * ===================================================================
 * Mengunci perilaku yang membuat "NFC HP tidak jalan":
 * 1. Sesi handshake MENANG atas kartu RFID terdaftar (UID HP tidak dipakai sebagai kunci)
 * 2. UID HP berbeda tiap tap tetap tercatat untuk NISN yang sama
 * 3. Sesi kedaluwarsa jatuh ke kartu fisik (dual-mode tidak mati)
 * 4. HWID milik siswa lain ditolak
 * 5. Izin disetujui tidak ditimpa, tetapi sesi tetap ditutup
 * 6. Kartu fisik tanpa sesi tetap jalan
 * 7. Gateway Pi: urutan sesi-sebelum-kartu & penutupan sesi di semua jalur keluar
 * 8. Gateway Pi: worker SPI tidak lagi gagal senyap + heartbeat tersedia
 * 9. Dashboard: window 60s, timer dari expiresAt, deteksi gateway offline
 * ===================================================================
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { processCardTap } = require('../presensia-iot-contract.js');

const rpiSrc = fs.readFileSync(path.join(__dirname, '../iot/absensi_rpi.py'), 'utf8');
const dashboardSrc = fs.readFileSync(path.join(__dirname, '../assets/dashboard.js'), 'utf8');
const dashboardHtml = fs.readFileSync(path.join(__dirname, '../dashboard.html'), 'utf8');

let pass = 0;
let total = 0;
function test(name, fn) {
  total++;
  try {
    fn();
    pass++;
    console.log(`  OK  ${name}`);
  } catch (e) {
    console.error(`  GAGAL  ${name}`);
    console.error(`     ${e.message}`);
    process.exitCode = 1;
  }
}

const DEVICE = 'gateway-rpi-01';
const NISN = '0098263610';

function sesi(over = {}) {
  const now = Date.now();
  return {
    active: true,
    status: 'waiting',
    hwid: 'HWID-SMKN1-TESTSESSION01',
    nisn: NISN,
    nama: 'M. Ihsan Athallah',
    kelas: 'XII RPL 2',
    timestamp: now,
    expiresAt: now + 60000,
    ...over
  };
}

console.log('='.repeat(70));
console.log('TEST: NFC SMARTPHONE HWID HANDSHAKE (ORDER & FAILURE PATHS)');
console.log('='.repeat(70));

// 1. Sesi menang atas kartu terdaftar
test('1. Sesi aktif menang atas UID yang kebetulan terdaftar sebagai kartu siswa lain', () => {
  const kartuOrangLain = { 'AA11BB22': { nisn: '0082104129', nama: 'Rizky Ramadhani', kelas: 'XII RPL 2', tipe: 'siswa' } };
  const r = processCardTap('AA11BB22', {
    deviceId: DEVICE,
    nfcSession: sesi(),
    rfidMap: kartuOrangLain,
    hwidMap: {},
    allowTestCards: false
  });
  assert.strictEqual(r.success, true, 'harus sukses');
  assert.strictEqual(r.nisn, NISN, 'NISN harus dari sesi, bukan dari kartu terdaftar');
  assert.strictEqual(r.nama, 'M. Ihsan Athallah');
  assert.strictEqual(r.firebasePaths[`absensi/${NISN}/${r.tanggal}`].metode, 'nfc_hwid');
});

// 2. UID berubah tiap tap
test('2. Dua UID HP berbeda dalam satu sesi tetap tercatat untuk NISN yang sama', () => {
  const opsi = { deviceId: DEVICE, hwidMap: {}, allowTestCards: false };
  const a = processCardTap('BB22CC33', { ...opsi, nfcSession: sesi() });
  const b = processCardTap('CC33DD44', { ...opsi, nfcSession: sesi() });
  assert.strictEqual(a.nisn, NISN);
  assert.strictEqual(b.nisn, NISN);
  assert.notStrictEqual(a.uid, b.uid, 'UID mentah memang berbeda');
  assert.strictEqual(a.firebasePaths[`absensi/${NISN}/${a.tanggal}`].uid_kartu, 'BB22CC33');
  assert.strictEqual(b.firebasePaths[`absensi/${NISN}/${b.tanggal}`].uid_kartu, 'CC33DD44');
});

// 3. Sesi kedaluwarsa -> fallback kartu fisik
test('3. Sesi kedaluwarsa jatuh ke jalur kartu fisik, bukan ditolak', () => {
  const expired = sesi({ expiresAt: Date.now() - 5000 });
  const r = processCardTap('TEST_UID_0002', {
    deviceId: DEVICE,
    nfcSession: expired,
    hwidMap: {},
    allowTestCards: true
  });
  assert.strictEqual(r.success, true, 'kartu fisik harus tetap terbaca');
  assert.strictEqual(r.nisn, '9999999992');
  assert.strictEqual(r.firebasePaths[`absensi/9999999992/${r.tanggal}`].metode, 'rfid_gateway');
});

// 4. HWID terikat siswa lain
test('4. HWID yang sudah terikat siswa lain ditolak', () => {
  const r = processCardTap('DD44EE55', {
    deviceId: DEVICE,
    nfcSession: sesi({ hwid: 'HWID-SMKN1-MILIKORANG' }),
    hwidMap: { 'HWID-SMKN1-MILIKORANG': { nisn: '0082104129', nama: 'Rizky Ramadhani' } },
    allowTestCards: false
  });
  assert.strictEqual(r.success, false);
  assert.strictEqual(r.error, 'HWID_USED_BY_OTHER');
  assert.ok(r.message.includes('Rizky'), 'pesan harus menyebut pemilik sah');
});

// 5. Izin disetujui tidak ditimpa
test('5. Izin disetujui: tap diabaikan dan status tidak ditimpa', () => {
  const tgl = new Date().toISOString().slice(0, 10);
  const r = processCardTap('EE55FF66', {
    deviceId: DEVICE,
    nfcSession: sesi(),
    hwidMap: {},
    allowTestCards: false,
    permitList: [{ nisn: NISN, status: 'disetujui', jenis: 'sakit', tanggal_mulai: tgl, tanggal_selesai: tgl }]
  });
  assert.strictEqual(r.success, true);
  assert.strictEqual(r.ignored, true);
  assert.strictEqual(r.reason, 'APPROVED_PERMIT_ACTIVE');
  assert.strictEqual(r.firebasePaths, undefined, 'tidak boleh ada payload presensi');
});

// 6. Kartu fisik tanpa sesi
test('6. Kartu RFID fisik tanpa sesi web tetap berfungsi (dual-mode)', () => {
  const r = processCardTap('TEST_UID_0001', { deviceId: DEVICE, allowTestCards: true });
  assert.strictEqual(r.success, true);
  assert.strictEqual(r.nisn, '9999999991');
  assert.strictEqual(r.firebasePaths[`absensi/9999999991/${r.tanggal}`].metode, 'rfid_gateway');
});

// 7. Urutan & penutupan sesi di gateway Pi
test('7. Gateway Pi: sesi dievaluasi sebelum lookup /rfid_map dan sesi ditutup di semua jalur keluar', () => {
  const idxSesi = rpiSrc.indexOf('sesi = baca_sesi_nfc()');
  const idxLookup = rpiSrc.indexOf('kartu_data = get_firebase(f"rfid_map/{uid_kartu}")');
  assert.ok(idxSesi > 0, 'baca_sesi_nfc harus dipanggil');
  assert.ok(idxLookup > idxSesi, 'lookup kartu harus SETELAH evaluasi sesi');

  assert.ok(rpiSrc.includes('def selesaikan_sesi('), 'helper selesaikan_sesi harus ada');
  assert.ok(rpiSrc.includes('def sesi_masih_berlaku('), 'helper sesi_masih_berlaku harus ada');
  assert.ok(rpiSrc.includes('if not sesi_dipakai:'), 'lookup kartu harus dilewati saat sesi dipakai');
  assert.ok(rpiSrc.includes('pairing_req = None if sesi_dipakai'), 'pairing tidak boleh membajak sesi');

  assert.ok(rpiSrc.includes('selesaikan_sesi("rejected_used_by_other")'), 'HWID siswa lain menutup sesi');
  assert.ok(rpiSrc.includes('selesaikan_sesi("rejected_unregistered")'), 'kartu tak terdaftar menutup sesi');
  assert.ok(rpiSrc.includes('selesaikan_sesi("expired")'), 'sesi kedaluwarsa ditutup');
  assert.ok(rpiSrc.includes('"ignored": True'), 'izin disetujui menutup sesi dengan ignored=true');
  assert.ok(rpiSrc.includes('selesaikan_sesi("completed"'), 'sukses menutup sesi');
});

// 8. SPI tidak gagal senyap + heartbeat
test('8. Gateway Pi: worker SPI melaporkan kegagalan dan heartbeat /gateway_status tersedia', () => {
  assert.ok(rpiSrc.includes('[SPI FATAL]'), 'kegagalan import reader harus dilaporkan');
  assert.ok(rpiSrc.includes('pip install mfrc522'), 'pesan perbaikan harus menyebut paket yang kurang');
  assert.ok(rpiSrc.includes('def worker_gateway_heartbeat('), 'worker heartbeat harus ada');
  assert.ok(rpiSrc.includes('gateway_status/{DEVICE_ID}'), 'heartbeat menulis ke /gateway_status');
  assert.ok(rpiSrc.includes('worker_gateway_heartbeat, daemon=True'), 'heartbeat harus dijalankan');
  assert.ok(!/except Exception:\s*\n\s*pass\s*\n\s*\n?def main/.test(rpiSrc), 'worker SPI tidak boleh except/pass senyap');
});

// 9. Sisi web
test('9. Dashboard: window sesi 60s, timer dari expiresAt, dan gateway offline terdeteksi', () => {
  assert.ok(dashboardSrc.includes('NFC_SESSION_WINDOW_MS = 60000'), 'window sesi harus 60 detik');
  assert.ok(dashboardSrc.includes('expiresAt: expiresAtMs'), 'payload harus memakai expiresAtMs');
  assert.ok(dashboardSrc.includes('Math.ceil((expiresAtMs - Date.now()) / 1000)'), 'timer harus turunan expiresAt');
  assert.ok(dashboardSrc.includes('gateway_status/${NFC_GATEWAY_DEVICE_ID}'), 'dashboard harus cek gateway');
  assert.ok(dashboardSrc.includes('NFC_GATEWAY_STALE_MS = 30000'), 'ambang offline harus 30 detik');
  assert.ok(dashboardSrc.includes('rejected_unregistered'), 'status rejected_unregistered harus ditangani');
});

// 10. URL builder meng-encode spasi pada nama kelas
test('10. Gateway Pi: path Firebase di-encode agar nama kelas "XII RPL 2" valid', () => {
  assert.ok(rpiSrc.includes('import urllib.parse'), 'urllib.parse harus diimpor');
  assert.ok(rpiSrc.includes('urllib.parse.quote(path.strip("/"), safe="/-_.~")'),
    'build_firebase_url harus meng-encode path');
  assert.ok(!rpiSrc.includes('f"{DATABASE_URL}/{path}.json{sep}auth={token}"'),
    'path mentah tidak boleh dipakai langsung di URL');
});

// 11. Satu tombol utama -> sheet dua opsi
test('11. Dashboard: widget NFC memakai satu tombol utama yang membuka sheet dua opsi', () => {
  assert.ok(dashboardHtml.includes('id="btnNfcAksiUtama"'), 'tombol utama harus ada');
  assert.ok(dashboardHtml.includes('onclick="bukaPilihanNfcSiswa()"'), 'tombol utama membuka sheet');
  assert.ok(dashboardHtml.includes('id="modalPilihanNfc"'), 'sheet pilihan harus ada');
  assert.ok(dashboardHtml.includes('id="btnMulaiTapNfcHp"'), 'opsi tap NFC HP harus tetap ada');
  assert.ok(dashboardHtml.includes('id="btnTautkanNfcSiswa"'), 'opsi tautkan kartu harus tetap ada');
  assert.ok(dashboardHtml.includes('id="labelAksiTautkanNfc"'), 'label opsi harus punya span sendiri');
  // Hanya satu tombol di baris aksi widget
  const barisAksi = dashboardHtml.split('class="nfc-actions-row"')[1].split('</div>')[0];
  assert.strictEqual((barisAksi.match(/<button/g) || []).length, 1, 'baris aksi hanya boleh 1 tombol');
  assert.ok(dashboardSrc.includes('function bukaPilihanNfcSiswa()'), 'fungsi buka sheet harus ada');
  assert.ok(dashboardSrc.includes('function tutupPilihanNfcSiswa()'), 'fungsi tutup sheet harus ada');
});

console.log('='.repeat(70));
console.log('='.repeat(70));
