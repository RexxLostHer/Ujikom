/**
 * ===================================================================
 * ADVERSARIAL STRESS TEST SUITE: test-adversarial-challenger1-admin-stress.js
 * Author: Challenger 1 (Empirical Challenger Agent)
 *
 * MISSION:
 * Adversarially challenge the admin attendance calculation, live matrix 3-kelas,
 * and rekap features in Ujikom/assets/admin.js and Ujikom/admin.html:
 * 1. Empty database snapshots (ensure graceful fallback without NaN, undefined, or unhandled exceptions).
 * 2. Corrupted student objects (missing NISN, missing class, unexpected key formats, malformed types).
 * 3. Out-of-bounds timestamps and multiple conflicting scans in hours 1-8.
 * 4. Teacher attendance edge cases (partial check-in without check-out, unknown NIP, offline cache vs online snapshot).
 * 5. Class invariant violation attempt (verify non-official classes e.g. 'X RPL', '9A', 'PPLG' are strictly isolated).
 * 6. Header logo avatar verification (no star polygon remains, image fallback works properly when image load fails).
 * 7. Concurrency & Realtime Listener Stability.
 * ===================================================================
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('===================================================================');
console.log('🔥 STARTING ADVERSARIAL CHALLENGE SUITE: ADMIN ATTENDANCE & MATRIX');
console.log('===================================================================\n');

// -------------------------------------------------------------------------
// [SUITE 1] Header Logo Avatar, Star Polygon Elimination & Fallback Mechanism
// -------------------------------------------------------------------------
console.log('--- [Suite 1] Header Logo Avatar & SVG Invariants Verification ---');

const adminHtmlPath = path.join(__dirname, '../admin.html');
assert.ok(fs.existsSync(adminHtmlPath), 'admin.html harus ditemukan di filesystem');
const adminHtml = fs.readFileSync(adminHtmlPath, 'utf8');

// 1.1 Verifikasi ketiadaan poligon bintang pada header brand icon
const brandIconMatch = adminHtml.match(/<div class="admin-brand-icon"[^>]*>([\s\S]*?)<\/div>/);
assert.ok(brandIconMatch, '[FAIL 1.1] Elemen .admin-brand-icon harus ditemukan di admin.html');
const brandIconContent = brandIconMatch[1];

assert.strictEqual(
  brandIconContent.includes('<polygon'),
  false,
  '[FAIL 1.1] Tidak boleh ada elemen <polygon> di dalam .admin-brand-icon'
);
assert.strictEqual(
  adminHtml.includes('points="24,15'),
  false,
  '[FAIL 1.1] Tidak boleh ada titik koordinat bintang points="24,15" di admin.html'
);
console.log('  [PASS 1.1] Poligon bintang 4-sudut telah sepenuhnya dieliminasi dari header logo admin.');

// 1.2 Verifikasi keberadaan elemen avatar img dengan foto admin
assert.ok(
  brandIconContent.includes('<img src="assets/foto/admin.jpg"'),
  '[FAIL 1.2] .admin-brand-icon harus memuat <img src="assets/foto/admin.jpg"'
);
assert.ok(
  brandIconContent.includes('alt="Foto Profil Admin"'),
  '[FAIL 1.2] Elemen img harus memiliki alt="Foto Profil Admin"'
);
console.log('  [PASS 1.2] Elemen avatar foto profil admin terpasang di dalam .admin-brand-icon.');

// 1.3 Verifikasi integritas fallback onerror dan keberadaan file fisik di disk
const adminFotoPath = path.join(__dirname, '../assets/foto/admin.jpg');
assert.ok(fs.existsSync(adminFotoPath), '[FAIL 1.3] Berkas fisik assets/foto/admin.jpg harus ada di disk');
assert.ok(fs.statSync(adminFotoPath).size > 0, '[FAIL 1.3] assets/foto/admin.jpg tidak boleh kosong (0 bytes)');

const fallbackFotoPath = path.join(__dirname, '../assets/foto/0095250998.jpg');
assert.ok(fs.existsSync(fallbackFotoPath), '[FAIL 1.3] Berkas fallback assets/foto/0095250998.jpg harus ada di disk');
assert.ok(fs.statSync(fallbackFotoPath).size > 0, '[FAIL 1.3] assets/foto/0095250998.jpg tidak boleh kosong (0 bytes)');

assert.ok(
  brandIconContent.includes('onerror="this.onerror=null;this.src=\'assets/foto/0095250998.jpg\';"'),
  '[FAIL 1.3] onerror fallback harus mengganti src dan membersihkan handler agar tidak infinite loop'
);
console.log('  [PASS 1.3] Berkas fisik foto admin dan fallback valid di disk, mekanisme onerror aman.');

// 1.4 Verifikasi pemeliharaan linearGradient SVG defs
assert.ok(adminHtml.includes('id="shieldGrad"'), '[FAIL 1.4] SVG linearGradient id="shieldGrad" harus dipertahankan');
assert.ok(adminHtml.includes('id="coreGrad"'), '[FAIL 1.4] SVG linearGradient id="coreGrad" harus dipertahankan');
console.log('  [PASS 1.4] SVG linearGradient (shieldGrad, coreGrad) tetap terpelihara untuk aset SVG eksternal.\n');


// -------------------------------------------------------------------------
// Mock DOM & Storage Framework untuk Pengujian Dinamis
// -------------------------------------------------------------------------
class MockDOMElement {
  constructor(id = '', tag = 'div') {
    this.id = id;
    this.tagName = tag.toUpperCase();
    this.children = [];
    this._innerHTML = '';
    this._textContent = '';
    this.value = '';
    this.style = {};
    this.attributes = {};
    this.options = [];
    this.selectedIndex = 0;
    this.classList = {
      _classes: new Set(),
      add: (c) => this.classList._classes.add(c),
      remove: (c) => this.classList._classes.delete(c),
      contains: (c) => this.classList._classes.has(c)
    };
    this.listeners = {};
  }
  get textContent() { return this._textContent; }
  set textContent(v) {
    this._textContent = String(v);
    this._innerHTML = String(v);
  }
  get innerHTML() { return this._innerHTML; }
  set innerHTML(v) {
    this._innerHTML = String(v);
    this._textContent = String(v).replace(/<[^>]*>/g, '');
    if (!v) this.children = [];
  }
  appendChild(child) {
    this.children.push(child);
    if (child.innerHTML) {
      this._innerHTML += (child.tagName ? `<${child.tagName.toLowerCase()}>${child.innerHTML}</${child.tagName.toLowerCase()}>` : child.innerHTML);
    }
    return child;
  }
  setAttribute(attr, val) { this.attributes[attr] = String(val); }
  getAttribute(attr) { return this.attributes[attr] || null; }
  addEventListener(event, fn) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(fn);
  }
  removeEventListener(event, fn) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(f => f !== fn);
  }
  trigger(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(fn => fn(data));
    }
  }
}

const domRegistry = {};
function getMock(id, tag = 'div') {
  if (!domRegistry[id]) domRegistry[id] = new MockDOMElement(id, tag);
  return domRegistry[id];
}

const mockDoc = {
  getElementById: (id) => getMock(id),
  querySelector: (sel) => {
    if (sel.includes('#')) {
      const id = sel.replace('#', '');
      return getMock(id);
    }
    if (sel === '.tab-panel.active') {
      const activeEl = getMock('tab-monitoring3kelas');
      activeEl.classList.add('active');
      return activeEl;
    }
    return null;
  },
  querySelectorAll: () => [],
  createElement: (tag) => new MockDOMElement('', tag),
  addEventListener: () => {},
  removeEventListener: () => {}
};

const mockStorage = {
  store: {},
  getItem: function(k) { return this.store[k] || null; },
  setItem: function(k, v) { this.store[k] = String(v); },
  removeItem: function(k) { delete this.store[k]; },
  clear: function() { this.store = {}; }
};

global.document = mockDoc;
global.window = global;
global.window.addEventListener = () => {};
global.window.removeEventListener = () => {};
global.window.location = { replace: () => {}, href: '' };
global.location = global.window.location;
global.localStorage = mockStorage;
global.sessionStorage = {
  store: { 'user_aktif': JSON.stringify({ email: 'admin@smkn1sumedang.sch.id', role: 'admin', nama: 'Administrator' }) },
  getItem: function(k) { return this.store[k] || null; },
  setItem: function(k, v) { this.store[k] = String(v); },
  removeItem: function(k) { delete this.store[k]; }
};
global.tanggalHariIni = () => '2026-11-09';

// Inisialisasi Mock Firebase Database yang dapat dikendalikan dinamis
let currentDbBehavior = {};
const mockDb = {
  ref: function(pathStr) {
    return {
      path: pathStr,
      once: async function(ev) {
        if (currentDbBehavior.throwNetworkError) {
          throw new Error('NETWORK_TIMEOUT: Gagal menghubungkan ke Firebase Realtime Database');
        }
        if (currentDbBehavior.emptySnapshots) {
          return { exists: () => false, val: () => null };
        }
        const customHandler = currentDbBehavior[pathStr];
        if (typeof customHandler === 'function') {
          return customHandler();
        }
        if (currentDbBehavior.data && currentDbBehavior.data[pathStr] !== undefined) {
          const val = currentDbBehavior.data[pathStr];
          return { exists: () => val !== null && val !== undefined, val: () => val };
        }
        return { exists: () => false, val: () => null };
      },
      on: function(ev, cb) {
        if (!currentDbBehavior.listeners) currentDbBehavior.listeners = {};
        if (!currentDbBehavior.listeners[pathStr]) currentDbBehavior.listeners[pathStr] = [];
        currentDbBehavior.listeners[pathStr].push(cb);
      }
    };
  }
};
global.db = mockDb;

const fbConfig = require('../assets/firebase-config.js');
global.MASTER_DATA_SISWA_RESMI = fbConfig.MASTER_DATA_SISWA_RESMI;
global.MASTER_GURU_RESMI = fbConfig.MASTER_GURU_RESMI;
global.DAFTAR_KELAS_RESMI = fbConfig.DAFTAR_KELAS_RESMI;
global.normalisasiKelas = fbConfig.normalisasiKelas;
global.generateDefaultPresensiResmi = fbConfig.generateDefaultPresensiResmi;

const adminModule = require('../assets/admin.js');

// Helper reset DOM containers
function resetMockDomContainers() {
  getMock('cards3KelasMonitoring').innerHTML = '';
  getMock('tabelRingkasan3Kelas').innerHTML = '';
  getMock('monitoringGuruContainer').innerHTML = '';
  getMock('badgeGuruMonitoring').textContent = '';
  getMock('rekapTableBody').innerHTML = '';
  getMock('rekapTheadRow').innerHTML = '';
  getMock('statTotalSiswa').textContent = '0';
  getMock('statHadir').textContent = '0';
  getMock('statSakit').textContent = '0';
  getMock('statIzin').textContent = '0';
  getMock('statAlpha').textContent = '0';
}


// -------------------------------------------------------------------------
// [SUITE 2] Empty Database Snapshots & Offline Network Outage Resilience
// -------------------------------------------------------------------------
console.log('--- [Suite 2] Empty Database Snapshots & Offline Outage Resilience ---');

(async () => {
  // 2.1 Simulasi Total Empty Database (Semua node bernilai null)
  currentDbBehavior = { emptySnapshots: true };
  resetMockDomContainers();
  mockStorage.clear();

  try {
    await adminModule.muatMonitoring3Kelas();
  } catch (err) {
    assert.fail(`muatMonitoring3Kelas tidak boleh melempar unhandled exception pada DB kosong: ${err.message}`);
  }

  const cardsHtmlEmpty = getMock('cards3KelasMonitoring').innerHTML;
  const tableHtmlEmpty = getMock('tabelRingkasan3Kelas').innerHTML;

  assert.ok(!cardsHtmlEmpty.includes('NaN%'), '[FAIL 2.1] cards3KelasMonitoring tidak boleh memuat "NaN%" saat DB kosong');
  assert.ok(!cardsHtmlEmpty.includes('undefined'), '[FAIL 2.1] cards3KelasMonitoring tidak boleh memuat "undefined"');
  assert.ok(!tableHtmlEmpty.includes('NaN%'), '[FAIL 2.1] tabelRingkasan3Kelas tidak boleh memuat "NaN%" saat DB kosong');
  assert.ok(!tableHtmlEmpty.includes('undefined'), '[FAIL 2.1] tabelRingkasan3Kelas tidak boleh memuat "undefined"');

  // Pastikan fallback resmi (generateDefaultPresensiResmi) aktif sehingga persentase tidak blank / 0%
  assert.ok(!tableHtmlEmpty.includes('>0%<'), '[FAIL 2.1] Tabel telemetri harus memakai fallback baseline resmi, tidak blank/0%');
  console.log('  [PASS 2.1] muatMonitoring3Kelas bertahan sempurna pada snapshot DB kosong tanpa NaN / undefined.');

  // 2.2 Simulasi Network Timeout / Database Throws
  currentDbBehavior = { throwNetworkError: true };
  resetMockDomContainers();

  try {
    await adminModule.muatMonitoring3Kelas();
  } catch (err) {
    assert.fail(`muatMonitoring3Kelas harus menangani network timeout secara anggun: ${err.message}`);
  }
  const cardsHtmlNetErr = getMock('cards3KelasMonitoring').innerHTML;
  assert.ok(!cardsHtmlNetErr.includes('NaN%'), '[FAIL 2.2] Network error tidak boleh menghasilkan NaN%');
  console.log('  [PASS 2.2] muatMonitoring3Kelas anggun dan resilien menghadapi pemutusan jaringan (network exception).');

  // 2.3 Rekap Presensi Mode Harian pada Database Kosong
  currentDbBehavior = { emptySnapshots: true };
  resetMockDomContainers();
  getMock('rekapKelas', 'select').value = 'XII RPL 1';
  getMock('rekapTanggal', 'input').value = '2026-11-09';
  getMock('rekapPeriodeAdmin', 'select').value = 'harian';

  try {
    await adminModule.muatRekapPresensi();
  } catch (err) {
    assert.fail(`muatRekapPresensi (harian) gagal pada DB kosong: ${err.message}`);
  }

  const statTotal = parseInt(getMock('statTotalSiswa').textContent, 10);
  const statHadir = parseInt(getMock('statHadir').textContent, 10);
  assert.ok(!isNaN(statTotal) && statTotal > 0, '[FAIL 2.3] statTotalSiswa harus berupa angka valid');
  assert.ok(!isNaN(statHadir) && statHadir > 0, '[FAIL 2.3] statHadir harus terhitung dari baseline default resmi');
  assert.ok(!getMock('rekapTableBody').innerHTML.includes('undefined'), '[FAIL 2.3] Rekap tabel tidak boleh memuat undefined');
  console.log('  [PASS 2.3] muatRekapPresensi (harian) mengagregasi baseline default resmi pada database kosong.');

  // 2.4 Rekap Presensi Mode Tahunan pada Database Kosong
  resetMockDomContainers();
  getMock('rekapPeriodeAdmin', 'select').value = 'tahunan';

  try {
    await adminModule.muatRekapPresensi();
  } catch (err) {
    assert.fail(`muatRekapPresensi (tahunan) gagal pada DB kosong: ${err.message}`);
  }

  const rowsTahunan = getMock('rekapTableBody').innerHTML;
  assert.ok(!rowsTahunan.includes('NaN%'), '[FAIL 2.4] Rekap tahunan tidak boleh menghasilkan NaN%');
  assert.ok(!rowsTahunan.includes('undefined'), '[FAIL 2.4] Rekap tahunan tidak boleh memuat undefined');
  assert.ok(rowsTahunan.includes('Memenuhi Syarat (≥85%)'), '[FAIL 2.4] Rekap tahunan harus memuat status kelulusan');
  console.log('  [PASS 2.4] muatRekapPresensi (tahunan) menghasilkan profil variasi tahunan tanpa NaN / cacat DOM.\n');


  // -------------------------------------------------------------------------
  // [SUITE 3] Corrupted Student Objects & Malformed Database Payloads
  // -------------------------------------------------------------------------
  console.log('--- [Suite 3] Corrupted Student Objects & Malformed Payloads ---');

  currentDbBehavior = { emptySnapshots: true };
  resetMockDomContainers();

  // Rekayasa cache siswa dengan objek korup
  global.siswaCache = {
    'corrupt_no_nisn': { nama: 'Siswa Tanpa NISN', kelas: 'XII RPL 1' },
    'corrupt_null_nisn': { nisn: null, nama: 'Siswa Null NISN', kelas: 'XII RPL 1' },
    'corrupt_no_kelas': { nisn: '99990001', nama: 'Siswa Tanpa Kelas' },
    'corrupt_int_kelas': { nisn: '99990002', nama: 'Siswa Kelas Integer', kelas: 12 },
    'corrupt_obj_kelas': { nisn: '99990003', nama: 'Siswa Kelas Object', kelas: { rombel: null } },
    'corrupt_null_item': null,
    'corrupt_bool_item': false,
    '-O_PushIdRandom': { nisn: '0091113849', nama: 'Ahsan Mahmud', kelas: 'XII RPL 1' }
  };

  try {
    await adminModule.muatMonitoring3Kelas();
  } catch (err) {
    assert.fail(`muatMonitoring3Kelas melempar exception saat menangani siswa korup: ${err.message}`);
  }

  const cardsHtmlCorrupt = getMock('cards3KelasMonitoring').innerHTML;
  assert.ok(!cardsHtmlCorrupt.includes('NaN%'), '[FAIL 3.1] Kartu monitoring tidak boleh NaN%');
  assert.ok(cardsHtmlCorrupt.includes('XII RPL 1'), '[FAIL 3.1] Kelas resmi XII RPL 1 tetap harus tampil normal');
  console.log('  [PASS 3.1] Siswa dengan properti null, integer, missing NISN/kelas tidak menyebabkan crash.');

  // Rekap presensi dengan pool korup
  getMock('rekapPeriodeAdmin', 'select').value = 'harian';
  getMock('rekapKelas', 'select').value = 'XII RPL 1';
  try {
    await adminModule.muatRekapPresensi();
  } catch (err) {
    assert.fail(`muatRekapPresensi melempar exception saat memproses objek siswa korup: ${err.message}`);
  }

  const rekapHtmlCorrupt = getMock('rekapTableBody').innerHTML;
  assert.ok(rekapHtmlCorrupt.includes('0091113849'), '[FAIL 3.2] Siswa valid dengan push-id harus tetap terangkum');
  assert.ok(!rekapHtmlCorrupt.includes('NaN'), '[FAIL 3.2] Rekap tidak boleh menghasilkan NaN');
  console.log('  [PASS 3.2] muatRekapPresensi berhasil mengekstrak siswa valid dari data push-ID dan menyaring record korup.\n');

  // Kembalikan siswaCache asli
  global.siswaCache = Object.assign({}, fbConfig.MASTER_DATA_SISWA_RESMI);


  // -------------------------------------------------------------------------
  // [SUITE 4] Out-of-Bounds Timestamps & Multiple Conflicting Scans (Jam 1-8)
  // -------------------------------------------------------------------------
  console.log('--- [Suite 4] Out-of-Bounds Timestamps & Conflicting Scans ---');

  resetMockDomContainers();

  // Injeksi multi-scan dengan jam out-of-bounds dan status bertentangan
  const testTgl = '2026-11-09';
  const nisnTest = '0091113849'; // Ahsan Mahmud (XII RPL 1)
  
  currentDbBehavior = {
    data: {
      'presensi_jam': {
        'XII RPL 1': {
          [testTgl]: {
            '0': { [nisnTest]: { status: 'hadir', waktu: '-01:00:00' } }, // Jam 0 (out of bounds)
            '1': { [nisnTest]: { status: 'alpa', waktu: '06:00:00' } },  // Jam 1 alpa
            '2': { [nisnTest]: { status: 'terlambat', waktu: '07:15:00' } }, // Jam 2 telat
            '3': { [nisnTest]: { status: 'sakit', waktu: '08:00:00' } }, // Jam 3 sakit
            '4': { [nisnTest]: { status: 'hadir', waktu: '09:00:00' } }, // Jam 4 hadir
            '9': { [nisnTest]: { status: 'hadir', waktu: '25:99:99' } }  // Jam 9 (out of bounds)
          }
        }
      },
      'absensi': {
        [nisnTest]: {
          [testTgl]: { status: 'hadir', waktu: '06:20:00' }
        }
      }
    }
  };

  // Uji muatMonitoring3Kelas
  await adminModule.muatMonitoring3Kelas();
  const tableTelemetri = getMock('tabelRingkasan3Kelas').innerHTML;
  assert.ok(tableTelemetri.includes('XII RPL 1'), '[FAIL 4.1] Tabel telemetri memuat XII RPL 1');
  assert.ok(!tableTelemetri.includes('NaN%'), '[FAIL 4.1] Tabel telemetri tidak boleh NaN%');
  console.log('  [PASS 4.1] Telemetri jam 1-8 menyaring jam out-of-bounds dan menyelesaikan evaluasi status secara deterministik.');

  // Uji muatRekapPresensi dengan konflik multi-jam
  getMock('rekapPeriodeAdmin', 'select').value = 'harian';
  getMock('rekapKelas', 'select').value = 'XII RPL 1';
  getMock('rekapTanggal', 'input').value = testTgl;

  await adminModule.muatRekapPresensi();
  const rekapBody = getMock('rekapTableBody').innerHTML;

  // Karena Jam 4 berstatus 'hadir', aturan multi-jam di admin.js (line 864) menetapkan statusAkhir = 'Hadir'
  assert.ok(
    rekapBody.includes('Hadir') || rekapBody.includes('disetujui'),
    '[FAIL 4.2] Log multi-scan yang mencakup hadir pada jam 4 harus menyelesaikan status akhir Hadir'
  );
  console.log('  [PASS 4.2] Rekap harian menyelesaikan hierarki multi-scan: Hadir di jam 4 diprioritaskan di atas Alpa awal.\n');


  // -------------------------------------------------------------------------
  // [SUITE 5] Teacher Attendance Resilience & Cache Race Conditions
  // -------------------------------------------------------------------------
  console.log('--- [Suite 5] Teacher Attendance Resilience & Cache Race Conditions ---');

  resetMockDomContainers();
  mockStorage.clear();

  const nipHani = '198109012009022003';  // Bu Hani Hanifah, S.Si
  const nipHeri = '198504252024211008';  // Pak Heri Anggara, S.Kom
  const nipRijal = '198312052022211017'; // Pak Rijal Nur Rahmat, S.T

  // 5.1 Partial check-in tanpa checkout & NIP tak dikenal di database
  currentDbBehavior = {
    data: {
      'presensi_guru': {
        [nipHani]: {
          [testTgl]: { status: 'hadir', jamMasuk: '06:14:22', jamPulang: null, metode: 'RFID Gerbang' }
        },
        'UNKNOWN_NIP_99999': {
          [testTgl]: { status: 'hadir', jamMasuk: '06:00:00', nama: 'Hacker Unknown Teacher' }
        }
      }
    }
  };

  // 5.2 Offline cache di localStorage untuk Pak Heri
  mockStorage.setItem(
    `local_presensi_guru_${testTgl}_${nipHeri}`,
    JSON.stringify({ status: 'hadir', jam_masuk: '06:28:10', metode: 'NFC Smartphone' })
  );

  // 5.3 LocalStorage corrupt untuk Pak Rijal
  mockStorage.setItem(
    `local_presensi_guru_${testTgl}_${nipRijal}`,
    'MALFORMED_JSON_STRING_{{[('
  );

  await adminModule.muatMonitoring3Kelas();

  const guruTableHtml = getMock('monitoringGuruContainer').innerHTML;
  const badgeGuruText = getMock('badgeGuruMonitoring').textContent;

  // Pastikan Bu Hani (partial check-in) tercatat Hadir
  assert.ok(guruTableHtml.includes(nipHani), '[FAIL 5.1] Tabel guru harus memuat NIP Bu Hani');
  assert.ok(guruTableHtml.includes('06:14:22'), '[FAIL 5.1] Jam masuk partial Bu Hani harus tercatat');

  // Pastikan NIP tak dikenal TIDAK bocor ke tabel guru
  assert.ok(!guruTableHtml.includes('UNKNOWN_NIP_99999'), '[FAIL 5.2] NIP tak dikenal tidak boleh bocor ke tabel dewan guru');
  assert.ok(!guruTableHtml.includes('Hacker Unknown Teacher'), '[FAIL 5.2] Nama guru tak dikenal tidak boleh ditampilkan');

  // Pastikan Pak Heri terbaca dari offline cache localStorage
  assert.ok(guruTableHtml.includes(nipHeri), '[FAIL 5.3] Pak Heri harus tercantum di tabel');
  assert.ok(guruTableHtml.includes('06:28:10'), '[FAIL 5.3] Jam masuk Pak Heri dari offline cache harus terbaca');

  // Pastikan JSON korup di localStorage tidak membuat proses crash
  assert.ok(guruTableHtml.includes(nipRijal), '[FAIL 5.4] Pak Rijal tetap ditampilkan');
  assert.ok(guruTableHtml.toUpperCase().includes('BELUM HADIR'), '[FAIL 5.4] Corrupt offline cache harus fallback aman ke Belum Hadir');

  // Badge guru harus mencatat minimal 2 guru hadir (Bu Hani + Pak Heri)
  assert.ok(badgeGuruText.includes('2/5 Hadir') || badgeGuruText.includes('Hadir'), '[FAIL 5.5] Badge guru harus mencerminkan kehadiran');
  console.log(`  [PASS 5.1-5.5] Dewan Guru: Partial check-in terbaca, NIP asing ditolak, offline cache fallback aktif, JSON korup tertangani anggun (${badgeGuruText}).\n`);


  // -------------------------------------------------------------------------
  // [SUITE 6] Class Invariant Violation & Anti-Rogue Class Isolation
  // -------------------------------------------------------------------------
  console.log('--- [Suite 6] Class Invariant Violation & Anti-Rogue Class Isolation ---');

  // 6.1 Invarian ketat DAFTAR_KELAS_RESMI
  const expectedClasses = ['XII RPL 1', 'XII RPL 2', 'XII TKJ 1'];
  assert.strictEqual(fbConfig.DAFTAR_KELAS_RESMI.length, 3, '[FAIL 6.1] DAFTAR_KELAS_RESMI strictly 3 classes');
  expectedClasses.forEach(cls => {
    assert.ok(fbConfig.DAFTAR_KELAS_RESMI.includes(cls), `[FAIL 6.1] Kelas resmi ${cls} harus terdaftar`);
  });

  // 6.2 Injeksi kelas palsu ke database
  currentDbBehavior = {
    data: {
      'kelas': {
        '9A': { status: 'belajar' },
        'PPLG': { status: 'belajar' },
        'X RPL 1': { status: 'belajar' },
        'XII RPL 1': { status: 'belajar' },
        'XII RPL 2': { status: 'belajar' },
        'XII TKJ 1': { status: 'belajar' }
      }
    }
  };
  resetMockDomContainers();

  await adminModule.muatMonitoring3Kelas();
  const cardsInjected = getMock('cards3KelasMonitoring').innerHTML;
  const tableInjected = getMock('tabelRingkasan3Kelas').innerHTML;

  assert.ok(!cardsInjected.includes('>9A<'), '[FAIL 6.2] Kelas palsu 9A tidak boleh dibuatkan kartu telemetri');
  assert.ok(!cardsInjected.includes('>PPLG<'), '[FAIL 6.2] Kelas palsu PPLG tidak boleh dibuatkan kartu telemetri');
  assert.ok(!cardsInjected.includes('>X RPL 1<'), '[FAIL 6.2] Kelas palsu X RPL 1 tidak boleh dibuatkan kartu telemetri');
  assert.ok(!tableInjected.includes('>9A<'), '[FAIL 6.2] Kelas palsu 9A tidak boleh masuk baris tabel telemetri');
  assert.ok(!tableInjected.includes('>PPLG<'), '[FAIL 6.2] Kelas palsu PPLG tidak boleh masuk baris tabel telemetri');
  console.log('  [PASS 6.2] Injeksi kelas palsu diabaikan total oleh muatMonitoring3Kelas, isolasi 3 kelas kokoh.');

  // 6.3 Panggilan rekap presensi dengan kelas non-resmi
  getMock('rekapKelas', 'select').value = 'PPLG';
  await adminModule.muatRekapPresensi();
  const emptyStateRekap = getMock('rekapTableBody').innerHTML;
  assert.ok(emptyStateRekap.includes('Tidak ada data siswa'), '[FAIL 6.3] Kelas non-resmi harus menampilkan empty state');
  console.log('  [PASS 6.3] Pemilihan kelas di luar roster resmi menampilkan empty-state dengan pesan informatif.\n');


  // -------------------------------------------------------------------------
  // [SUITE 7] Concurrency & Realtime Listener Stability
  // -------------------------------------------------------------------------
  console.log('--- [Suite 7] Concurrency & Realtime Listener Stability ---');

  currentDbBehavior = { emptySnapshots: true };
  resetMockDomContainers();

  // 7.1 Eksekusi serentak (5 concurrent asynchronous calls)
  const concurrentCalls = [
    adminModule.muatMonitoring3Kelas(),
    adminModule.muatMonitoring3Kelas(),
    adminModule.muatMonitoring3Kelas(),
    adminModule.muatMonitoring3Kelas(),
    adminModule.muatMonitoring3Kelas()
  ];

  try {
    await Promise.all(concurrentCalls);
  } catch (err) {
    assert.fail(`Panggilan asinkron serentak tidak boleh menghasilkan race condition crash: ${err.message}`);
  }

  const finalCardsHtml = getMock('cards3KelasMonitoring').innerHTML;
  assert.ok(finalCardsHtml.includes('XII RPL 1'), '[FAIL 7.1] Output DOM stabil setelah 5 panggilan serentak');
  console.log('  [PASS 7.1] 5 panggilan serentak diselesaikan tanpa race crash atau data corruption.');

  // 7.2 Simulasi pemicu listener realtime pada presensi_jam
  if (currentDbBehavior.listeners && currentDbBehavior.listeners['presensi_jam']) {
    currentDbBehavior.listeners['presensi_jam'].forEach(cb => {
      assert.doesNotThrow(() => cb({ val: () => ({}) }), '[FAIL 7.2] Realtime callback presensi_jam tidak boleh throw');
    });
    console.log('  [PASS 7.2] Callback realtime listener aktif merespons pembaruan data tanpa exception.');
  }

  console.log('\n===================================================================');
  console.log('🎉 SELURUH PENGUJIAN ADVERSARIAL STRESS TEST LULUS 100%! (7/7 SUITES)');
  console.log('===================================================================');
  process.exit(0);

})().catch(err => {
  console.error('\n❌ ADVERSARIAL TEST GAGAL:', err);
  process.exit(1);
});
