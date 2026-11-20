/**
 * TEST SUITE: PENGUNJUNG ZERO-DATA LOCKDOWN (Phase 1)
 * ---------------------------------------------------
 * Memastikan akun `pengunjung` / belum terverifikasi tidak dapat melihat data
 * apa pun sampai NISN (siswa) atau NIP (guru) diverifikasi:
 *  - Rules: tidak ada node data yang memberikan `.read` kepada role pengunjung.
 *  - Dashboard: flag sinkron, layar kunci, guard tab & inisialisasi data.
 *  - Data historis 1 tahun tidak lagi dimuat eager untuk pengunjung.
 *  - Presensi Live (TV) tertutup untuk publik, hanya staff & IoT gateway.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT_DIR = path.resolve(__dirname, '..');
const baca = (rel) => fs.readFileSync(path.join(ROOT_DIR, rel), 'utf8');

const rules = JSON.parse(baca('database.rules.json')).rules;
const dashJs = baca('assets/dashboard.js');
const dashHtml = baca('dashboard.html');
const liveJs = baca('assets/presensi-live.js');
const liveHtml = baca('presensi-live.html');
const styleCss = baca('assets/style.css');

let lulus = 0;
function ok(nama, kondisi, pesan) {
  if (arguments.length > 1) assert.ok(kondisi, pesan || nama);
  lulus++;
  console.log('  ✓ ' + nama);
}

console.log('===================================================================');
console.log('🔒 TEST PENGUNJUNG ZERO-DATA LOCKDOWN (PHASE 1)');
console.log('===================================================================\n');

// =================================================================
console.log('[Test 1] Rules: tidak ada data untuk role pengunjung...');
// =================================================================
const nodeData = [
  'siswa', 'absensi', 'kartu', 'rfid_map', 'kelas', 'jadwal_pelajaran',
  'presensi_jam', 'presensi_guru', 'riwayat', 'perizinan', 'chat_rooms',
  'status_kelas', 'presensi_harian', 'tap_realtime', 'pairing_request',
  'stats', 'hwid_map', 'gateway_status', 'nfc_session'
];

for (const node of nodeData) {
  assert.ok(rules[node], `rules.${node} wajib terdefinisi`);
  const readRule = rules[node]['.read'];
  if (readRule === undefined) continue;
  assert.notStrictEqual(readRule, true, `${node} tidak boleh punya .read: true`);
  assert.ok(
    !readRule.includes(") === 'pengunjung'") ||
    readRule.includes("!== 'pengunjung'"),
    `${node} tidak boleh memberi akses baca ke role pengunjung`
  );
  assert.ok(
    readRule.trim() !== 'auth != null',
    `${node} .read tidak boleh hanya mensyaratkan login (pengunjung juga login)`
  );
}

ok('Semua node data menolak role pengunjung dan bukan sekadar "auth != null"');

// Root rules tetap default-deny
assert.strictEqual(rules['.read'], false, 'Root .read harus false');
assert.strictEqual(rules['.write'], false, 'Root .write harus false');
ok('Root .read/.write tetap default-deny');

// /users hanya boleh dibaca staff atau pemilik akun
const usersRead = rules.users['.read'];
assert.ok(usersRead.includes('admin') && usersRead.includes('guru') && usersRead.includes('walas'),
  '/users root read harus staff-only');
assert.strictEqual(rules.users['$uid']['.read'], 'auth != null && auth.uid === $uid',
  'Pengunjung hanya boleh membaca profilnya sendiri, bukan direktori pengguna lain');
ok('Pengunjung hanya bisa membaca profilnya sendiri di /users/{uid}');

// =================================================================
console.log('\n[Test 2] Dashboard: flag sinkron + layar kunci...');
// =================================================================
ok('Fungsi deteksi kunci tersedia', dashJs.includes('function apakahPengunjungTerkunci(user)'));
ok('Flag sinkron MODE_TERKUNCI_PENGUNJUNG tersedia', dashJs.includes('let MODE_TERKUNCI_PENGUNJUNG'));
ok('Flag dibaca langsung dari sessionStorage/localStorage sebelum listener jalan',
  /sessionStorage\.getItem\('user_aktif'\)/.test(dashJs) && dashJs.includes('JSON.parse(raw)'));
ok('Role pengunjung selalu terkunci',
  dashJs.includes("if (user.role === 'pengunjung') return true;"));
ok('Akun belum terverifikasi selalu terkunci',
  dashJs.includes('if (user.isVerified === false) return true;'));
ok('Panel tabTerkunci dirender', dashJs.includes("getElementById('tabTerkunci')") ||
  dashJs.includes('getElementById("tabTerkunci")'));
ok('Semua tab konten disembunyikan saat terkunci',
  dashJs.includes("document.querySelectorAll('.tab-content').forEach"));
ok('Navigasi tab disembunyikan', dashJs.includes("document.querySelector('.view-tabs')"));

const switchTabStart = dashJs.indexOf('function switchTab(id, btn)');
const switchTabGuard = dashJs.indexOf('if (MODE_TERKUNCI_PENGUNJUNG)', switchTabStart);
assert.ok(switchTabStart !== -1 && switchTabGuard !== -1 && switchTabGuard < switchTabStart + 300,
  'switchTab harus menolak perpindahan tab saat mode terkunci');
ok('switchTab diblokir saat terkunci');

const initDash = dashJs.indexOf('async function initDashboard(user)');
const initDashNext = dashJs.indexOf('async function ', initDash + 10);
const initDashBody = dashJs.slice(initDash, initDashNext === -1 ? initDash + 6000 : initDashNext);
const lockBranch = initDashBody.indexOf('if (apakahPengunjungTerkunci(user))');
const berandaCall = initDashBody.indexOf('initBerandaOverview(');
assert.ok(lockBranch !== -1, 'initDashboard wajib punya cabang pengunjung terkunci');
assert.ok(berandaCall === -1 || lockBranch < berandaCall,
  'Cabang kunci harus return sebelum initBerandaOverview dijalankan');
ok('initDashboard berhenti sebelum inisialisasi data beranda');

ok('inisialisasiPantauAwal diblokir',
  /function inisialisasiPantauAwal\(\)[\s\S]{0,240}MODE_TERKUNCI_PENGUNJUNG/.test(dashJs));
ok('inisialisasiJadwalAwal diblokir',
  /function inisialisasiJadwalAwal\(\)[\s\S]{0,240}MODE_TERKUNCI_PENGUNJUNG/.test(dashJs));

ok('Data riwayat 1 tahun dimuat lazy (tidak eager)',
  dashJs.includes('function muatDataRiwayatSetahunLazy') &&
  dashJs.includes("sc.src = 'assets/data-riwayat-setahun.js"));
ok('dashboard.html tidak lagi memuat data-riwayat-setahun.js secara eager',
  !dashHtml.includes('src="assets/data-riwayat-setahun.js'));
ok('dashboard.html tidak lagi mengklaim data terbuka untuk pengunjung',
  !dashHtml.includes('Terbuka transparan untuk Pengunjung'));

// =================================================================
console.log('\n[Test 3] CSS: tab & chat disembunyikan saat terkunci...');
// =================================================================
ok('Navigasi tab disembunyikan via CSS',
  styleCss.includes('body.mode-terkunci-pengunjung .view-tabs'));
ok('Widget chat disembunyikan via CSS',
  styleCss.includes('body.mode-terkunci-pengunjung #waFloatingBtn') &&
  styleCss.includes('body.mode-terkunci-pengunjung #modalChat'));

// =================================================================
console.log('\n[Test 4] Presensi Live: tertutup untuk publik...');
// =================================================================
ok('presensi-live.html memuat auth.js',
  liveHtml.includes('src="assets/auth.js'));
const idxAuth = liveHtml.indexOf('src="assets/auth.js');
const idxLive = liveHtml.indexOf('src="assets/presensi-live.js');
assert.ok(idxAuth !== -1 && idxLive !== -1 && idxAuth < idxLive,
  'auth.js wajib dimuat sebelum presensi-live.js agar getSessionUser tersedia');
ok('auth.js dimuat sebelum presensi-live.js');

ok('Header tidak lagi menyatakan AKSES TERBUKA',
  !liveHtml.includes('AKSES TERBUKA (SISWA, GURU & PENGUNJUNG)'));
ok('Guard AKSES_LIVE_DITOLAK tersedia', liveJs.includes('var AKSES_LIVE_DITOLAK = false;'));
ok('Hanya admin/guru/walas/iot_gateway yang diizinkan',
  /\[[\s\S]{0,40}'admin',\s*'guru',\s*'walas',\s*'iot_gateway'[\s\S]{0,20}\]\.indexOf\(role\) !== -1/.test(liveJs));

const guardCount = (liveJs.match(/AKSES_LIVE_DITOLAK/g) || []).length;
assert.ok(guardCount >= 5, `Guard AKSES_LIVE_DITOLAK harus dipakai di semua listener utama (ditemukan ${guardCount})`);
ok(`Semua listener utama Presensi Live dijaga (${guardCount} referensi guard)`);

for (const [label, pola] of [
  ['listener kelas', /if \(!AKSES_LIVE_DITOLAK[^\n]*\n\s*try \{\n\s*db\.ref\('kelas'\)/],
  ['listener siswa/rfid_map/kartu', /if \(!AKSES_LIVE_DITOLAK[^\n]*\n\s*try \{\n\s*db\.ref\('siswa'\)/],
  ['dropdown kelas', /if \(!AKSES_LIVE_DITOLAK[^\n]*kelasSelect\.addEventListener/],
  ['interval jam', /if \(!AKSES_LIVE_DITOLAK[^\n]*\n\s*setInterval\(cekJamAktifTerkini/]
]) {
  assert.ok(pola.test(liveJs), `Listener ${label} wajib dijaga AKSES_LIVE_DITOLAK`);
}
ok('Tidak ada listener data yang berjalan untuk tamu');

// =================================================================
console.log('\n[Test 5] Integrasi halaman & invarian kelas...');
// =================================================================
ok('dashboard.js dimuat di dashboard.html sebelum profile-modal.js',
  dashHtml.indexOf('src="assets/dashboard.js') !== -1 &&
  dashHtml.indexOf('src="assets/dashboard.js') < dashHtml.indexOf('src="assets/profile-modal.js'));
ok('Hanya 3 kelas resmi dipakai di dashboard.html',
  dashHtml.includes('XII RPL 1') && dashHtml.includes('XII RPL 2') && dashHtml.includes('XII TKJ 1') &&
  !dashHtml.includes('PPLG'));

console.log('\n===================================================================');
console.log(`🎉 SELURUH ${lulus} PEMERIKSAAN ZERO-DATA LOCKDOWN LOLOS 100%!`);
console.log('===================================================================');
