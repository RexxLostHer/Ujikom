const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- TEST SUITE: SINKRONISASI KELAS BINAAN & LIVE ALERT WALAS ---');

// Mock Environment
const { MASTER_DATA_SISWA_RESMI, normalisasiKelas, ambilKelasSiswa, generateDefaultPresensiResmi } = require('../assets/firebase-config.js');

global.MASTER_DATA_SISWA_RESMI = MASTER_DATA_SISWA_RESMI;
global.normalisasiKelas = normalisasiKelas;
global.ambilKelasSiswa = ambilKelasSiswa;
global.generateDefaultPresensiResmi = generateDefaultPresensiResmi;
global.tanggalHariIni = () => '2026-11-16';
global.jamSekarang = () => '07:15:00';
global.getJamSekarangWIB = () => '07:15:00';
global.evaluasiAmbangBatasWaktu = (jam) => (jam && jam <= '06:30:00' ? 'hadir' : 'terlambat');
global.ambilSemuaPerizinanOnce = async () => ({});

// Mock DOM
const domNodes = {};
function createMockNode(id, tag = 'div') {
  return {
    id,
    tagName: tag.toUpperCase(),
    textContent: '',
    _rawHtml: '',
    value: '',
    style: {
      display: '',
      background: '',
      color: '',
      width: ''
    },
    classList: {
      _classes: new Set(),
      add: function(c) { this._classes.add(c); },
      remove: function(c) { this._classes.delete(c); },
      contains: function(c) { return this._classes.has(c); }
    },
    get innerHTML() {
      const childHtml = this.children.map(c => c.innerHTML || c.textContent || '').join(' ');
      return (this._rawHtml || '') + (childHtml ? ' ' + childHtml : '');
    },
    set innerHTML(val) {
      this._rawHtml = val;
      if (val === '') this.children = [];
    },
    children: [],
    appendChild: function(c) { this.children.push(c); },
    setAttribute: function(k, v) { this[k] = v; },
    getAttribute: function(k) { return this[k] || ''; },
    addEventListener: function() {},
    removeEventListener: function() {}
  };
}

global.document = {
  getElementById: (id) => {
    if (!domNodes[id]) domNodes[id] = createMockNode(id);
    return domNodes[id];
  },
  createElement: (tag) => createMockNode('', tag),
  querySelectorAll: () => [],
  addEventListener: () => {},
  removeEventListener: () => {}
};

global.window = {
  document: global.document,
  addEventListener: () => {},
  removeEventListener: () => {}
};

// Mock Firebase Realtime Database
const rtdbStore = {};
global.db = {
  ref: (p) => ({
    once: async () => ({
      val: () => rtdbStore[p] || null,
      exists: () => !!rtdbStore[p]
    }),
    on: (evt, cb) => cb({ val: () => ({ status: 'belajar' }) }),
    set: async (val) => { rtdbStore[p] = val; },
    transaction: async (fn) => {
      rtdbStore[p] = fn(rtdbStore[p]);
    }
  })
};

// Muat dashboard-guru.js
const guruModule = require('../assets/dashboard-guru.js');
const {
  hitungStatusPresensiKelas,
  muatStatistikWalas,
  muatLiveAlertWalas,
  gantiKelasBinaanWalas,
  switchGuruTab
} = guruModule;

async function runTests() {
  // Setup user aktif: Wali Kelas XII RPL 2 (M. Echa Putra)
  global.guruAktif = {
    nama: 'Muhammad Echa Putra, S.Kom.Gr',
    nip: '199209142022211007',
    email: 'echaputra@smkn1sumedang.sch.id',
    role: 'walas',
    isWalas: true,
    walasKelasId: 'XII RPL 2'
  };
  global.window.guruAktif = global.guruAktif;
  if (typeof guruModule.setGuruAktif === 'function') {
    guruModule.setGuruAktif(global.guruAktif);
  }

  // Test 1: Fungsi hitungStatusPresensiKelas mengembalikan Single Source of Truth
  console.log('▶ [Test 1] Pengujian helper hitungStatusPresensiKelas...');
  const hasil = await hitungStatusPresensiKelas('XII RPL 2', '2026-11-16');

  assert.strictEqual(hasil.kelas, 'XII RPL 2', 'Kelas harus XII RPL 2');
  assert.strictEqual(hasil.totalSiswa, 35, 'Total siswa XII RPL 2 harus 35');
  assert.strictEqual(hasil.rekap.hadirTepat, 33, 'Hadir tepat waktu harus 33');
  assert.strictEqual(hasil.rekap.belumAbsen, 2, 'Belum absen / Tanpa Keterangan harus 2');
  assert.strictEqual(hasil.daftar.tanpaKeterangan.length, 2, 'Jumlah daftar siswa Tanpa Keterangan harus sama dengan rekap (2 siswa)');

  const nisnTanpaKet = hasil.daftar.tanpaKeterangan.map(item => item[0]);
  assert.ok(nisnTanpaKet.includes('0098263610'), 'M. Ihsan Athallah harus ada di daftar Tanpa Keterangan');
  assert.ok(nisnTanpaKet.includes('0082104129'), 'Rizky Ramadhani harus ada di daftar Tanpa Keterangan');
  console.log('  ✓ [PASS] hitungStatusPresensiKelas mengembalikan 33 Hadir & 2 Tanpa Keterangan secara akurat.');

  // Test 2: Eksekusi muatStatistikWalas() dan muatLiveAlertWalas() menghasilkan data identik
  console.log('▶ [Test 2] Validasi sinkronisasi render Kelas Binaan dan Alert Terlambat...');
  await muatStatistikWalas();
  await muatLiveAlertWalas();

  // Validasi tab Kelas Binaan
  const walasBelumAbsenEl = domNodes['walasBelumAbsen'];
  assert.strictEqual(walasBelumAbsenEl.textContent, 2, 'Statistik Tanpa Keterangan di Kelas Binaan harus 2');

  // Validasi tab Alert Terlambat
  const container = domNodes['boxAlertWalasContainer'];
  assert.ok(container.innerHTML.includes('PERINGATAN PAGI: 2 SISWA TANPA KETERANGAN'), 'Alert Terlambat harus menampilkan 2 Siswa Tanpa Keterangan');
  assert.ok(!container.innerHTML.includes('Luar Biasa! Tidak Ada Siswa Tertinggal'), 'DILARANG menampilkan banner Luar Biasa jika masih ada siswa tanpa keterangan');
  
  // Periksa kedua kartu siswa di Alert Terlambat
  const alertHtml = container.children.map(c => c.innerHTML).join(' ');
  assert.ok(alertHtml.includes('IHSAN') || alertHtml.includes('0098263610'), 'Kartu Ihsan harus dirender di Alert Terlambat');
  assert.ok(alertHtml.includes('RIZKY') || alertHtml.includes('0082104129'), 'Kartu Rizky harus dirender di Alert Terlambat');
  console.log('  ✓ [PASS] Tab Kelas Binaan (2 Siswa) dan Alert Terlambat (2 Siswa) sinkron 100%.');

  // Test 3: Skenario 1 Siswa tap hadir -> Keduanya otomatis berkurang menjadi 1
  console.log('▶ [Test 3] Uji Tap Hadir 1 siswa (M. Ihsan Athallah)...');
  rtdbStore['presensi_jam/XII RPL 2/2026-11-16'] = {
    '1': {
      '0098263610': { status: 'hadir', waktu: '06:22:00' }
    }
  };

  await muatStatistikWalas();
  await muatLiveAlertWalas();

  assert.strictEqual(domNodes['walasBelumAbsen'].textContent, 1, 'Setelah Ihsan tap, Kelas Binaan harus 1 siswa');
  assert.ok(domNodes['boxAlertWalasContainer'].innerHTML.includes('PERINGATAN PAGI: 1 SISWA TANPA KETERANGAN'), 'Alert Terlambat harus menampilkan 1 Siswa');
  console.log('  ✓ [PASS] Update realtime tap hadir langsung tersinkronisasi di kedua tab.');

  // Test 4: Skenario Semua Siswa Tap / Izin -> Keduanya sinkron menjadi 0 & Banner Luar Biasa muncul
  console.log('▶ [Test 4] Uji Semua Siswa Selesai Presensi (0 Tanpa Keterangan)...');
  rtdbStore['presensi_jam/XII RPL 2/2026-11-16']['1']['0082104129'] = { status: 'hadir', waktu: '06:25:00' };

  await muatStatistikWalas();
  await muatLiveAlertWalas();

  assert.strictEqual(domNodes['walasBelumAbsen'].textContent, 0, 'Kelas Binaan harus 0 siswa');
  assert.ok(domNodes['boxAlertWalasContainer'].innerHTML.includes('Luar Biasa! Tidak Ada Siswa Tertinggal'), 'Banner Luar Biasa harus muncul saat 0 siswa');
  console.log('  ✓ [PASS] Saat 0 siswa tanpa keterangan, banner "Luar Biasa" muncul konsisten.');

  // Test 5: Perpindahan tab memicu render ulang data terbaru
  console.log('▶ [Test 5] Uji Perpindahan Tab (switchGuruTab)...');
  rtdbStore['presensi_jam/XII RPL 2/2026-11-16'] = {}; // Reset kembali ke belum absen (2 siswa)
  
  // Pindah ke tab Live Alert
  switchGuruTab('tabLiveAlertWalas');
  await new Promise(r => setTimeout(r, 50));
  assert.ok(domNodes['boxAlertWalasContainer'].innerHTML.includes('PERINGATAN PAGI: 2 SISWA TANPA KETERANGAN'), 'Pindah ke tabLiveAlertWalas harus langsung me-refresh data');

  // Pindah ke tab Monitoring Walas
  switchGuruTab('tabMonitoringWalas');
  await new Promise(r => setTimeout(r, 50));
  assert.strictEqual(domNodes['walasBelumAbsen'].textContent, 2, 'Pindah ke tabMonitoringWalas harus langsung me-refresh data');
  console.log('  ✓ [PASS] Event switchGuruTab memicu sinkronisasi otomatis.');

  console.log('\n================================================================');
  console.log('🎉 SEMUA PENGUJIAN SINKRONISASI KELAS BINAAN & ALERT WALAS LULUS 100%!');
  console.log('================================================================');
}

runTests().catch(err => {
  console.error('❌ GAGAL PENGUJIAN:', err);
  process.exit(1);
});
