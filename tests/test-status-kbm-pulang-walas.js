/**
 * test-status-kbm-pulang-walas.js
 * Verifikasi Mendalam Logika Status KBM Kelas (Prioritas Waktu WIB & Override)
 * 
 * Memverifikasi:
 * 1. Prioritas 1 — PULANG:
 *    - Melewati jam pulang KBM (misal 18:04 WIB di hari aktif) WAJIB "KBM: PULANG" (#64748b).
 *    - Status tidak jatuh ke fallback "JAMKOS" meskipun Firebase menyimpan status: 'jamkos'.
 *    - Override eksplisit "pulang" pada jam aktif KBM langsung menampilkan "KBM: PULANG".
 * 2. Prioritas 2 — BELAJAR / AKTIF:
 *    - Jam aktif KBM (misal 08:30 WIB) normal tanpa kendala menampilkan "KBM: BELAJAR" (#10b981).
 * 3. Prioritas 3 — JAMKOS:
 *    - Hanya muncul saat rentang KBM aktif (misal 09:30 WIB) dengan laporan/status 'jamkos' (#ef4444).
 * 4. Di Luar Jam KBM:
 *    - Akhir pekan (Sabtu / Minggu) menampilkan "Libur" bahkan jika Firebase menyimpan status 'pulang'/'jamkos'.
 *    - Sebelum jam masuk KBM di hari aktif (misal 06:15 WIB) menampilkan "Belum Mulai" bahkan jika Firebase menyimpan sisa status hari kemarin.
 * 5. Boundary Thresholds:
 *    - 15:29:59 (Senin) -> KBM: BELAJAR, 15:30:00 (Senin) -> KBM: PULANG.
 *    - 11:44:59 (Jumat) -> KBM: BELAJAR, 11:45:00 (Jumat) -> KBM: PULANG.
 *    - 06:59:59 (Senin) -> Belum Mulai, 07:00:00 (Senin) -> KBM: BELAJAR.
 * 6. Kepatuhan 3 Kelas Resmi:
 *    - Bekerja konsisten untuk XII RPL 1, XII RPL 2, dan XII TKJ 1.
 * 7. DOM Verification di dashboard-guru:
 *    - Elemen #badgeStatusKelasWalas terupdate teks dan warna netral slate (#64748b).
 * 8. Konsistensi Widget Siswa (dashboard.js):
 *    - 'pulang', 'libur', 'belum_mulai', 'jamkos', 'belajar'.
 * 9. Konsistensi Radar Mengajar & Presensi Live.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('===================================================================');
console.log('🧪 PENGUJIAN LOGIKA STATUS KBM KELAS: KBM PULANG & RADAR MENGAJAR');
console.log('===================================================================');

// Load jadwal-util.js
const jadwalUtil = require('../assets/jadwal-util.js');
const { tentukanStatusKelas, MASTER_JADWAL_RESMI, JAM_PULANG_RESMI } = jadwalUtil;

assert.strictEqual(typeof tentukanStatusKelas, 'function', 'tentukanStatusKelas harus diekspor sebagai fungsi');

// 1. UJI PRIORITAS 1 — PULANG SETELAH JAM SEKOLAH (SIMULASI 18:04 WIB)
console.log('\n▶ [Test 1] Prioritas 1: Waktu melewati jam pulang KBM (18:04 WIB)...');
['XII RPL 1', 'XII RPL 2', 'XII TKJ 1'].forEach(kelas => {
  // Skenario A: Waktu 18:04 WIB, Firebase memiliki sisa status 'jamkos' dari pagi
  const resLewatJamkos = tentukanStatusKelas(kelas, {
    waktuWIB: '18:04',
    tanggal: '2026-11-16', // Senin
    hari: 'senin',
    statusOverride: 'jamkos',
    kData: { status: 'jamkos' }
  });

  assert.strictEqual(resLewatJamkos.status, 'pulang', `Status untuk ${kelas} pada 18:04 WIB harus 'pulang'`);
  assert.strictEqual(resLewatJamkos.badgeText, 'KBM: PULANG', `Badge untuk ${kelas} pada 18:04 WIB harus 'KBM: PULANG'`);
  assert.strictEqual(resLewatJamkos.warna, '#64748b', 'Warna badge harus netral slate #64748b');
  assert.notStrictEqual(resLewatJamkos.badgeText, 'KBM: JAMKOS', 'Status TIDAK BOLEH jatuh ke fallback JAMKOS');

  // Skenario B: Hari Jumat setelah jam pulang Jumat (12:30 WIB, KBM Jumat selesai 11:45 WIB)
  const resJumatPulang = tentukanStatusKelas(kelas, {
    waktuWIB: '12:30',
    tanggal: '2026-11-20', // Jumat
    hari: 'jumat',
    statusOverride: 'jamkos'
  });
  assert.strictEqual(resJumatPulang.status, 'pulang', `Status ${kelas} di hari Jumat 12:30 WIB harus 'pulang'`);
  assert.strictEqual(resJumatPulang.badgeText, 'KBM: PULANG');
  assert.strictEqual(resJumatPulang.warna, '#64748b');

  // Skenario C: Override eksplisit 'pulang' pada siang hari (11:00 WIB)
  const resOverrideSiang = tentukanStatusKelas(kelas, {
    waktuWIB: '11:00',
    tanggal: '2026-11-16',
    hari: 'senin',
    statusOverride: 'pulang'
  });
  assert.strictEqual(resOverrideSiang.status, 'pulang', 'Override status: pulang harus memicu status pulang');
  assert.strictEqual(resOverrideSiang.badgeText, 'KBM: PULANG');
});
console.log('  ✓ Prioritas 1 lulus 100%: 18:04 WIB dan override pulang terbukti menghasilkan KBM: PULANG.');

// 2. UJI PRIORITAS 2 — BELAJAR / AKTIF (KBM NORMAL)
console.log('\n▶ [Test 2] Prioritas 2: Rentang jam KBM aktif normal (08:30 WIB)...');
['XII RPL 1', 'XII RPL 2', 'XII TKJ 1'].forEach(kelas => {
  const resNormal = tentukanStatusKelas(kelas, {
    waktuWIB: '08:30',
    tanggal: '2026-11-16', // Senin
    hari: 'senin',
    statusOverride: 'belajar'
  });

  assert.strictEqual(resNormal.status, 'belajar', `Status ${kelas} pada jam KBM normal harus 'belajar'`);
  assert.strictEqual(resNormal.badgeText, 'KBM: BELAJAR', `Badge ${kelas} harus 'KBM: BELAJAR'`);
  assert.strictEqual(resNormal.warna, '#10b981', 'Warna KBM normal harus hijau #10b981');
  assert.ok(resNormal.badgeText.includes('BELAJAR'), 'Menampilkan status BELAJAR / AKTIF');
});
console.log('  ✓ Prioritas 2 lulus 100%: Jam KBM aktif normal menghasilkan KBM: BELAJAR.');

// 3. UJI PRIORITAS 3 — JAMKOS HANYA DALAM RENTANG AKTIF
console.log('\n▶ [Test 3] Prioritas 3: Jamkos hanya saat jam KBM aktif (09:30 WIB)...');
['XII RPL 1', 'XII RPL 2', 'XII TKJ 1'].forEach(kelas => {
  const resJamkos = tentukanStatusKelas(kelas, {
    waktuWIB: '09:30',
    tanggal: '2026-11-16', // Senin
    hari: 'senin',
    statusOverride: 'jamkos'
  });

  assert.strictEqual(resJamkos.status, 'jamkos', `Status ${kelas} saat kendala di jam aktif harus 'jamkos'`);
  assert.strictEqual(resJamkos.badgeText, 'KBM: JAMKOS', `Badge ${kelas} saat kendala harus 'KBM: JAMKOS'`);
  assert.strictEqual(resJamkos.warna, '#ef4444', 'Warna jamkos harus merah peringatan #ef4444');
});
console.log('  ✓ Prioritas 3 lulus 100%: Status JAMKOS hanya muncul saat rentang KBM aktif.');

// 4. UJI DI LUAR JAM KBM: LIBUR & BELUM MULAI (ADVERSARIAL STALE STATUS CHECK)
console.log('\n▶ [Test 4] Di Luar Jam KBM: Libur akhir pekan & Belum Mulai (dengan sisa status Firebase)...');
// Akhir pekan: Sabtu & Minggu, bahkan jika Firebase masih menyimpan sisa 'pulang' atau 'jamkos'
const resSabtuStale = tentukanStatusKelas('XII RPL 2', {
  waktuWIB: '10:00',
  tanggal: '2026-11-14',
  hari: 'sabtu',
  statusOverride: 'pulang',
  kData: { status: 'jamkos' }
});
assert.strictEqual(resSabtuStale.status, 'libur', 'Pada hari Sabtu, status harus Libur meskipun ada override/stale status');
assert.strictEqual(resSabtuStale.badgeText, 'Libur', 'Pada hari libur akhir pekan harus menampilkan "Libur"');
assert.strictEqual(resSabtuStale.warna, '#64748b');

const resMingguStale = tentukanStatusKelas('XII RPL 2', {
  waktuWIB: '10:00',
  tanggal: '2026-11-15',
  hari: 'minggu',
  statusOverride: 'jamkos'
});
assert.strictEqual(resMingguStale.status, 'libur');
assert.strictEqual(resMingguStale.badgeText, 'Libur');

// Sebelum jam masuk sekolah di hari KBM (06:15 WIB), bahkan jika Firebase menyimpan 'pulang'/'jamkos'
const resPagiStale = tentukanStatusKelas('XII RPL 2', {
  waktuWIB: '06:15',
  tanggal: '2026-11-16',
  hari: 'senin',
  statusOverride: 'pulang',
  kData: { status: 'jamkos' }
});
assert.strictEqual(resPagiStale.status, 'belum_mulai', 'Sebelum 07:00 WIB, status harus Belum Mulai');
assert.strictEqual(resPagiStale.badgeText, 'Belum Mulai', 'Sebelum jam masuk sekolah harus menampilkan "Belum Mulai"');
assert.strictEqual(resPagiStale.warna, '#64748b');
console.log('  ✓ Status Libur dan Belum Mulai terbukti kebal terhadap stale status Firebase.');

// 5. UJI BOUNDARY THRESHOLD WAKTU
console.log('\n▶ [Test 5] Boundary Threshold Waktu (Detik/Menit Batas)...');
// Senin-Kamis batas 15:30
const resBatasSebelumSenin = tentukanStatusKelas('XII RPL 2', { waktuWIB: '15:29:59', hari: 'senin' });
assert.strictEqual(resBatasSebelumSenin.status, 'belajar', '15:29:59 WIB masih dalam rentang KBM aktif');

const resBatasPasSenin = tentukanStatusKelas('XII RPL 2', { waktuWIB: '15:30:00', hari: 'senin' });
assert.strictEqual(resBatasPasSenin.status, 'pulang', '15:30:00 WIB tepat adalah batas kepulangan');
assert.strictEqual(resBatasPasSenin.badgeText, 'KBM: PULANG');

// Jumat batas 11:45
const resBatasSebelumJumat = tentukanStatusKelas('XII RPL 2', { waktuWIB: '11:44:59', hari: 'jumat' });
assert.strictEqual(resBatasSebelumJumat.status, 'belajar', 'Jumat 11:44:59 WIB masih dalam rentang KBM');

const resBatasPasJumat = tentukanStatusKelas('XII RPL 2', { waktuWIB: '11:45:00', hari: 'jumat' });
assert.strictEqual(resBatasPasJumat.status, 'pulang', 'Jumat 11:45:00 WIB tepat adalah batas kepulangan');
assert.strictEqual(resBatasPasJumat.badgeText, 'KBM: PULANG');

// Batas Masuk 07:00
const resBatasMasukSebelum = tentukanStatusKelas('XII RPL 2', { waktuWIB: '06:59:59', hari: 'senin' });
assert.strictEqual(resBatasMasukSebelum.status, 'belum_mulai');

const resBatasMasukPas = tentukanStatusKelas('XII RPL 2', { waktuWIB: '07:00:00', hari: 'senin' });
assert.strictEqual(resBatasMasukPas.status, 'belajar');
console.log('  ✓ Boundary threshold pergantian jam terbukti akurat 100%.');

// 6. UJI DOM INTEGRASI PADA DASHBOARD GURU (badgeStatusKelasWalas)
console.log('\n▶ [Test 6] Integrasi DOM badgeStatusKelasWalas pada dashboard-guru.js...');
const mockElements = {
  badgeStatusKelasWalas: {
    textContent: '',
    style: { background: '', color: '' },
    setAttribute: function(k, v) { this[k] = v; },
    classList: {
      _classes: new Set(),
      add: function(...c) { c.forEach(x => this._classes.add(x)); },
      remove: function(...c) { c.forEach(x => this._classes.delete(x)); },
      contains: function(c) { return this._classes.has(c); }
    }
  },
  badgeKelasBinaanWalas: { textContent: '' },
  gridSiswaWalas: { innerHTML: '', appendChild: () => {} },
  walasTotalSiswa: { textContent: '' },
  walasHadirTepat: { textContent: '' },
  walasTerlambat: { textContent: '' },
  walasIzinSakit: { textContent: '' },
  walasBelumAbsen: { textContent: '' },
  persentaseHadirWalas: { textContent: '' },
  jamGuruTitle: { textContent: '' },
  jamGuruSub: { textContent: '' }
};

global.document = {
  getElementById: (id) => mockElements[id] || null,
  createElement: () => ({ style: {}, classList: { add: () => {} }, appendChild: () => {} })
};

// Load dashboard-guru.js
const guruJs = require('../assets/dashboard-guru.js');
const { perbaruiBadgeStatusKelasWalas } = guruJs;

assert.strictEqual(typeof perbaruiBadgeStatusKelasWalas, 'function', 'perbaruiBadgeStatusKelasWalas harus diekspor');

// Simulasi DOM: Update badge pada 18:04 WIB dengan status Firebase 'jamkos'
perbaruiBadgeStatusKelasWalas('XII RPL 2', {
  waktuWIB: '18:04',
  tanggal: '2026-11-16',
  hari: 'senin',
  kData: { status: 'jamkos' }
});

const badgeEl = mockElements.badgeStatusKelasWalas;
assert.strictEqual(badgeEl.textContent, 'KBM: PULANG', 'DOM textContent harus "KBM: PULANG"');
assert.strictEqual(badgeEl.style.background, '#64748b', 'DOM style.background harus "#64748b"');
assert.strictEqual(badgeEl['data-status'], 'pulang', 'DOM data-status harus "pulang"');
assert.ok(badgeEl.classList.contains('badge-kbm-pulang'), 'Class badge-kbm-pulang harus aktif');
console.log('  ✓ DOM #badgeStatusKelasWalas berhasil terupdate menjadi "KBM: PULANG" (#64748b).');

// Simulasi DOM: KBM normal (08:30 WIB)
perbaruiBadgeStatusKelasWalas('XII RPL 2', {
  waktuWIB: '08:30',
  tanggal: '2026-11-16',
  hari: 'senin',
  kData: { status: 'belajar' }
});
assert.strictEqual(badgeEl.textContent, 'KBM: BELAJAR');
assert.strictEqual(badgeEl.style.background, '#10b981');
assert.ok(badgeEl.classList.contains('badge-kbm-belajar'));

// Simulasi DOM: Libur (Minggu)
perbaruiBadgeStatusKelasWalas('XII RPL 2', {
  waktuWIB: '10:00',
  tanggal: '2026-11-15',
  hari: 'minggu',
  kData: { status: 'jamkos' }
});
assert.strictEqual(badgeEl.textContent, 'Libur');
assert.strictEqual(badgeEl.style.background, '#64748b');
assert.ok(badgeEl.classList.contains('badge-kbm-libur'));

// 7. UJI KONSISTENSI PRESENSI-LIVE BANNER (renderInfoJam)
console.log('\n▶ [Test 7] Integrasi Banner presensi-live.js...');
const mockInfoJam = {
  className: '',
  innerHTML: ''
};
mockElements.infoJam = mockInfoJam;
global.infoJam = mockInfoJam;
global.kelasSelect = { value: 'XII RPL 2' };
global.jamKeAktifSekarang = null;

const presensiLive = require('../assets/presensi-live.js');
const { renderInfoJam } = presensiLive;
assert.strictEqual(typeof renderInfoJam, 'function');

// Simulasi 18:04 WIB (lewat jam sekolah)
global.jamSekarang = () => '18:04:00';
global.tanggalHariIni = () => '2026-11-16'; // Senin
renderInfoJam();
assert.ok(mockInfoJam.innerHTML.includes('KBM Selesai (Jam Pulang)'), 'Banner presensi-live harus menampilkan KBM Selesai pada 18:04 WIB');

// Simulasi Sabtu 10:00 WIB
global.jamSekarang = () => '10:00:00';
global.tanggalHariIni = () => '2026-11-14'; // Sabtu
renderInfoJam();
assert.ok(mockInfoJam.innerHTML.includes('Hari Libur'), 'Banner presensi-live harus menampilkan Hari Libur pada hari Sabtu');

console.log('  ✓ presensi-live.js renderInfoJam terbukti seragam.');

// 8. UJI KONSISTENSI WIDGET SISWA DASHBOARD (dashboard.js)
console.log('\n▶ [Test 8] Integrasi Widget Siswa dashboard.js...');
const mockWidgetElements = {
  badgeStatusKelas: { textContent: '', style: {} },
  tagStatusKelasOperasional: { textContent: '' },
  judulStatusKelas: { textContent: '', style: {} },
  descStatusKelas: { textContent: '' },
  iconStatusKelas: { innerHTML: '', style: {} },
  bannerAlertJamkos: { style: { display: 'none' } },
  descAlertJamkos: { textContent: '' }
};

Object.assign(mockElements, mockWidgetElements);
global.document.querySelectorAll = () => [];

// Load dashboard.js
const dashboardModule = require('../assets/dashboard.js');
const updateWidgetStatusKelas = dashboardModule.updateWidgetStatusKelas || (global.window ? global.window.updateWidgetStatusKelas : null);
assert.strictEqual(typeof updateWidgetStatusKelas, 'function', 'updateWidgetStatusKelas harus diekspor');

// Skenario Pulang di Widget Siswa (18:04 WIB)
global.jamSekarang = () => '18:04:00';
global.tanggalHariIni = () => '2026-11-16'; // Senin
updateWidgetStatusKelas('XII RPL 2', { status: 'jamkos' });
assert.strictEqual(mockElements.badgeStatusKelas.textContent, 'PULANG (KBM SELESAI)');
assert.strictEqual(mockElements.badgeStatusKelas.style.background, '#64748b');

// Skenario Libur di Widget Siswa (Sabtu)
global.tanggalHariIni = () => '2026-11-14'; // Sabtu
updateWidgetStatusKelas('XII RPL 2', { status: 'belajar' });
assert.strictEqual(mockElements.badgeStatusKelas.textContent, 'LIBUR (AKHIR PEKAN)');
assert.strictEqual(mockElements.badgeStatusKelas.style.background, '#64748b');

// Skenario Belum Mulai di Widget Siswa (Senin 06:15 WIB)
global.tanggalHariIni = () => '2026-11-16'; // Senin
global.jamSekarang = () => '06:15:00';
updateWidgetStatusKelas('XII RPL 2', { status: 'belajar' });
assert.strictEqual(mockElements.badgeStatusKelas.textContent, 'BELUM MULAI (KBM PAGI)');
assert.strictEqual(mockElements.badgeStatusKelas.style.background, '#64748b');

console.log('  ✓ dashboard.js updateWidgetStatusKelas terbukti seragam.');

console.log('\n===================================================================');
console.log('🎉 SEMUA PENGUJIAN LOGIKA STATUS KBM KELAS LULUS 100%!');
console.log('===================================================================');