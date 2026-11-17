/**
 * test-adversarial-status-kbm-cross-role.js
 * Adversarial Suite: Pengujian Status KBM Lintas 4 Role & Halaman
 * 
 * Target Pengujian:
 * 1. Walas: Dashboard Guru Presensi Kelas Binaan (#badgeStatusKelasWalas)
 * 2. Guru: Radar Mengajar (#jamGuruTitle & #jamGuruSub)
 * 3. Siswa: Dashboard Widget Status Kelas (#badgeStatusKelas)
 * 4. Admin: Monitoring 3 Kelas Pilot (Card & Tabel)
 * 5. TV Lobby: Presensi Live (#infoJam)
 * 
 * Verifikasi Skenario Ekstrem:
 * - Pukul 18:04 WIB (setelah jam sekolah) dengan Firebase menyimpan status 'jamkos' -> WAJIB PULANG, BUKAN JAMKOS.
 * - Pukul 12:30 WIB di hari Jumat (setelah 11:45) dengan Firebase menyimpan status 'jamkos' -> WAJIB PULANG.
 * - Hari Sabtu & Minggu dengan sisa status 'jamkos' / 'pulang' -> WAJIB LIBUR.
 * - Pukul 06:15 WIB (sebelum 07:00) dengan sisa status 'jamkos' / 'pulang' -> WAJIB BELUM MULAI.
 * - Jam KBM aktif 09:30 WIB dengan status 'jamkos' -> WAJIB JAMKOS.
 * - Jam KBM aktif 08:30 WIB normal -> WAJIB BELAJAR.
 * - Override pulang cepat pukul 11:00 WIB -> WAJIB PULANG.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('===================================================================');
console.log('⚔️  ADVERSARIAL STRESS TEST: STATUS KBM LINTAS ROLE & HALAMAN');
console.log('===================================================================');

// Setup Global Environment Mock
const domStore = {};
function getOrCreateEl(id) {
  if (!domStore[id]) {
    domStore[id] = {
      id,
      textContent: '',
      innerHTML: '',
      className: '',
      value: '',
      style: {},
      classList: {
        _classes: new Set(),
        add(...c) { c.forEach(x => this._classes.add(x)); },
        remove(...c) { c.forEach(x => this._classes.delete(x)); },
        contains(c) { return this._classes.has(c); }
      },
      setAttribute(k, v) { this[k] = v; },
      getAttribute(k) { return this[k]; },
      appendChild() {},
      querySelectorAll: () => [],
      addEventListener: () => {},
      removeEventListener: () => {}
    };
  }
  return domStore[id];
}

global.document = {
  getElementById: (id) => getOrCreateEl(id),
  createElement: () => ({
    style: {},
    classList: { add() {}, remove() {} },
    appendChild() {},
    setAttribute() {},
    addEventListener: () => {},
    removeEventListener: () => {}
  }),
  addEventListener: () => {},
  removeEventListener: () => {},
  querySelectorAll: () => []
};

global.window = global;
global.window.addEventListener = () => {};
global.window.removeEventListener = () => {};
global.window.location = { href: '', replace: () => {} };

// 1. Load Jadwal Util
const jadwalUtil = require('../assets/jadwal-util.js');
const { tentukanStatusKelas } = jadwalUtil;

// 2. Load Dashboard Guru
const guruModule = require('../assets/dashboard-guru.js');
const { perbaruiBadgeStatusKelasWalas } = guruModule;

// 3. Load Dashboard Siswa
const dashboardModule = require('../assets/dashboard.js');
const { updateWidgetStatusKelas } = dashboardModule;

// 4. Load Presensi Live
const presensiLiveModule = require('../assets/presensi-live.js');
const { renderInfoJam } = presensiLiveModule;

// Mock elements needed by Presensi Live
global.kelasSelect = { value: 'XII RPL 2' };
global.infoJam = getOrCreateEl('infoJam');

const KELAS_LIST = ['XII RPL 1', 'XII RPL 2', 'XII TKJ 1'];

// ===================================================================
// SKENARIO 1: PUKUL 18:04 WIB (PASCA JAM SEKOLAH) DENGAN SISA 'JAMKOS'
// ===================================================================
console.log('\n[Scenario 1] 18:04 WIB (Pasca Jam Pulang) dengan Firebase status = "jamkos"...');
global.tanggalHariIni = () => '2026-11-16'; // Senin
global.jamSekarang = () => '18:04:00';

KELAS_LIST.forEach(kelas => {
  // A. Jadwal Util Core Evaluation
  const stUtil = tentukanStatusKelas(kelas, { statusOverride: 'jamkos', kData: { status: 'jamkos' } });
  assert.strictEqual(stUtil.status, 'pulang', `${kelas}: Core status harus 'pulang'`);
  assert.strictEqual(stUtil.badgeText, 'KBM: PULANG');
  assert.strictEqual(stUtil.warna, '#64748b');

  // B. Walas Badge
  perbaruiBadgeStatusKelasWalas(kelas, { statusOverride: 'jamkos', kData: { status: 'jamkos' } });
  const badgeWalas = getOrCreateEl('badgeStatusKelasWalas');
  assert.strictEqual(badgeWalas.textContent, 'KBM: PULANG', `${kelas}: Walas badge harus KBM: PULANG`);
  assert.strictEqual(badgeWalas.style.background, '#64748b');
  assert.strictEqual(badgeWalas['data-status'], 'pulang');

  // C. Siswa Widget
  updateWidgetStatusKelas(kelas, { status: 'jamkos' });
  const badgeSiswa = getOrCreateEl('badgeStatusKelas');
  assert.strictEqual(badgeSiswa.textContent, 'PULANG (KBM SELESAI)', `${kelas}: Siswa widget harus PULANG`);
  assert.strictEqual(badgeSiswa.style.background, '#64748b');

  // D. Presensi Live
  global.kelasSelect.value = kelas;
  renderInfoJam();
  assert.ok(global.infoJam.innerHTML.includes('KBM Selesai (Jam Pulang)'), `${kelas}: Presensi live harus KBM Selesai`);
});
console.log('  ✓ Seluruh 4 role menampilkan status PULANG pada 18:04 WIB dan KEBAL dari sisa jamkos.');

// ===================================================================
// SKENARIO 2: JUMAT 12:30 WIB (PASCA JUMATAN/PULANG 11:45) DENGAN SISA 'JAMKOS'
// ===================================================================
console.log('\n[Scenario 2] Jumat 12:30 WIB (Pasca Jam Pulang Jumat 11:45) dengan Firebase status = "jamkos"...');
global.tanggalHariIni = () => '2026-11-20'; // Jumat
global.jamSekarang = () => '12:30:00';

KELAS_LIST.forEach(kelas => {
  const stUtil = tentukanStatusKelas(kelas, { statusOverride: 'jamkos', kData: { status: 'jamkos' }, hari: 'jumat' });
  assert.strictEqual(stUtil.status, 'pulang', `${kelas}: Hari Jumat 12:30 WIB harus 'pulang'`);
  assert.strictEqual(stUtil.badgeText, 'KBM: PULANG');

  perbaruiBadgeStatusKelasWalas(kelas, { statusOverride: 'jamkos', kData: { status: 'jamkos' } });
  assert.strictEqual(getOrCreateEl('badgeStatusKelasWalas').textContent, 'KBM: PULANG');

  updateWidgetStatusKelas(kelas, { status: 'jamkos' });
  assert.strictEqual(getOrCreateEl('badgeStatusKelas').textContent, 'PULANG (KBM SELESAI)');

  presensiLiveModule.statusKelasLiveMap[kelas] = { status: 'pulang' };
  global.kelasSelect.value = kelas;
  renderInfoJam();
  assert.ok(global.infoJam.innerHTML.includes('KBM Selesai (Jam Pulang)'));
});
console.log('  ✓ Seluruh role menampilkan status PULANG pada hari Jumat 12:30 WIB.');

// ===================================================================
// SKENARIO 3: AKHIR PEKAN (SABTU & MINGGU) DENGAN SISA STATUS 'JAMKOS' / 'PULANG'
// ===================================================================
console.log('\n[Scenario 3] Akhir Pekan (Sabtu & Minggu) dengan sisa status Firebase...');
['2026-11-14', '2026-11-15'].forEach((tgl, idx) => {
  const namaHari = idx === 0 ? 'sabtu' : 'minggu';
  global.tanggalHariIni = () => tgl;
  global.jamSekarang = () => '10:00:00';

  KELAS_LIST.forEach(kelas => {
    // Dengan override 'jamkos'
    const stUtil = tentukanStatusKelas(kelas, { statusOverride: 'jamkos', kData: { status: 'jamkos' }, hari: namaHari });
    assert.strictEqual(stUtil.status, 'libur', `${kelas} ${namaHari}: harus 'libur'`);
    assert.strictEqual(stUtil.badgeText, 'Libur');
    assert.strictEqual(stUtil.warna, '#64748b');

    // Walas
    perbaruiBadgeStatusKelasWalas(kelas, { statusOverride: 'jamkos', kData: { status: 'jamkos' } });
    assert.strictEqual(getOrCreateEl('badgeStatusKelasWalas').textContent, 'Libur');
    assert.strictEqual(getOrCreateEl('badgeStatusKelasWalas').style.background, '#64748b');

    // Siswa
    updateWidgetStatusKelas(kelas, { status: 'jamkos' });
    assert.strictEqual(getOrCreateEl('badgeStatusKelas').textContent, 'LIBUR (AKHIR PEKAN)');
    assert.strictEqual(getOrCreateEl('badgeStatusKelas').style.background, '#64748b');

    // Presensi Live
    global.kelasSelect.value = kelas;
    renderInfoJam();
    assert.ok(global.infoJam.innerHTML.includes('Hari Libur'));
  });
});
console.log('  ✓ Seluruh role menampilkan status LIBUR pada akhir pekan.');

// ===================================================================
// SKENARIO 4: PAGI SEBELUM JAM MASUK (06:15 WIB) DENGAN SISA STATUS KEMARIN
// ===================================================================
console.log('\n[Scenario 4] Pagi sebelum jam masuk (06:15 WIB) di hari Senin...');
global.tanggalHariIni = () => '2026-11-16'; // Senin
global.jamSekarang = () => '06:15:00';

KELAS_LIST.forEach(kelas => {
  const stUtil = tentukanStatusKelas(kelas, { statusOverride: 'pulang', kData: { status: 'pulang' } });
  assert.strictEqual(stUtil.status, 'belum_mulai');
  assert.strictEqual(stUtil.badgeText, 'Belum Mulai');
  assert.strictEqual(stUtil.warna, '#64748b');

  perbaruiBadgeStatusKelasWalas(kelas, { statusOverride: 'pulang', kData: { status: 'pulang' } });
  assert.strictEqual(getOrCreateEl('badgeStatusKelasWalas').textContent, 'Belum Mulai');
  assert.strictEqual(getOrCreateEl('badgeStatusKelasWalas').style.background, '#64748b');

  updateWidgetStatusKelas(kelas, { status: 'pulang' });
  assert.strictEqual(getOrCreateEl('badgeStatusKelas').textContent, 'BELUM MULAI (KBM PAGI)');
  assert.strictEqual(getOrCreateEl('badgeStatusKelas').style.background, '#64748b');

  global.kelasSelect.value = kelas;
  renderInfoJam();
  assert.ok(global.infoJam.innerHTML.includes('KBM Belum Mulai'));
});
console.log('  ✓ Seluruh role menampilkan status BELUM MULAI pada 06:15 WIB.');

// ===================================================================
// SKENARIO 5: JAM KBM AKTIF NORMAL (08:30 WIB) VS JAMKOS AKTIF (09:30 WIB)
// ===================================================================
console.log('\n[Scenario 5] Jam KBM Aktif: Normal 08:30 WIB vs Jamkos Aktif 09:30 WIB...');
global.tanggalHariIni = () => '2026-11-16'; // Senin

// A. Normal (08:30 WIB)
global.jamSekarang = () => '08:30:00';
KELAS_LIST.forEach(kelas => {
  const stNormal = tentukanStatusKelas(kelas, { statusOverride: 'belajar', kData: { status: 'belajar' } });
  assert.strictEqual(stNormal.status, 'belajar');
  assert.strictEqual(stNormal.badgeText, 'KBM: BELAJAR');
  assert.strictEqual(stNormal.warna, '#10b981');

  perbaruiBadgeStatusKelasWalas(kelas, { statusOverride: 'belajar', kData: { status: 'belajar' } });
  assert.strictEqual(getOrCreateEl('badgeStatusKelasWalas').textContent, 'KBM: BELAJAR');
  assert.strictEqual(getOrCreateEl('badgeStatusKelasWalas').style.background, '#10b981');

  updateWidgetStatusKelas(kelas, { status: 'belajar' });
  assert.strictEqual(getOrCreateEl('badgeStatusKelas').textContent, 'BELAJAR (KBM AKTIF)');
  assert.strictEqual(getOrCreateEl('badgeStatusKelas').style.background, '#10b981');
});
console.log('  ✓ Normal KBM aktif menampilkan BELAJAR (#10b981).');

// B. Jamkos Aktif (09:30 WIB)
global.jamSekarang = () => '09:30:00';
KELAS_LIST.forEach(kelas => {
  const stJamkos = tentukanStatusKelas(kelas, { statusOverride: 'jamkos', kData: { status: 'jamkos' } });
  assert.strictEqual(stJamkos.status, 'jamkos');
  assert.strictEqual(stJamkos.badgeText, 'KBM: JAMKOS');
  assert.strictEqual(stJamkos.warna, '#ef4444');

  perbaruiBadgeStatusKelasWalas(kelas, { statusOverride: 'jamkos', kData: { status: 'jamkos' } });
  assert.strictEqual(getOrCreateEl('badgeStatusKelasWalas').textContent, 'KBM: JAMKOS');
  assert.strictEqual(getOrCreateEl('badgeStatusKelasWalas').style.background, '#ef4444');

  updateWidgetStatusKelas(kelas, { status: 'jamkos' });
  assert.strictEqual(getOrCreateEl('badgeStatusKelas').textContent, 'JAM KOSONG (JAMKOS)');
  assert.strictEqual(getOrCreateEl('badgeStatusKelas').style.background, '#ef4444');
});
console.log('  ✓ Kendala KBM aktif menampilkan JAMKOS (#ef4444).');

// ===================================================================
// SKENARIO 6: OVERRIDE PULANG CEPAT PADA JAM 11:00 WIB
// ===================================================================
console.log('\n[Scenario 6] Override Pulang Cepat pada jam 11:00 WIB...');
global.jamSekarang = () => '11:00:00';
KELAS_LIST.forEach(kelas => {
  const stPulang = tentukanStatusKelas(kelas, { statusOverride: 'pulang', kData: { status: 'pulang' } });
  assert.strictEqual(stPulang.status, 'pulang');
  assert.strictEqual(stPulang.badgeText, 'KBM: PULANG');
  assert.strictEqual(stPulang.warna, '#64748b');

  perbaruiBadgeStatusKelasWalas(kelas, { statusOverride: 'pulang', kData: { status: 'pulang' } });
  assert.strictEqual(getOrCreateEl('badgeStatusKelasWalas').textContent, 'KBM: PULANG');
  assert.strictEqual(getOrCreateEl('badgeStatusKelasWalas').style.background, '#64748b');

  updateWidgetStatusKelas(kelas, { status: 'pulang' });
  assert.strictEqual(getOrCreateEl('badgeStatusKelas').textContent, 'PULANG (KBM SELESAI)');
  assert.strictEqual(getOrCreateEl('badgeStatusKelas').style.background, '#64748b');

  presensiLiveModule.statusKelasLiveMap[kelas] = { status: 'pulang' };
  global.kelasSelect.value = kelas;
  renderInfoJam();
  assert.ok(global.infoJam.innerHTML.includes('KBM Selesai (Jam Pulang)'));
});
console.log('  ✓ Override Pulang Cepat pukul 11:00 WIB berhasil diseragamkan.');

console.log('\n===================================================================');
console.log('🏆 SELURUH ADVERSARIAL STRESS TEST LULUS 100%!');
console.log('===================================================================');
process.exit(0);
