/**
 * test-jadwal-opsi-guru-dan-acc-jamkos.js
 *
 * Menguji:
 * 1. Opsi jadwal mengajar guru per hari (Senin - Jumat) dari MASTER_JADWAL_RESMI.
 * 2. Pemilihan sesi jadwal otomatis mengisi Kelas (XII RPL 2), Mapel, dan Jam Pembelajaran.
 * 3. Eliminasi salah target kelas saat ACC: Menyetujui izin Pak Echa di XII RPL 2
 *    HANYA mengubah status kelas XII RPL 2 menjadi JAMKOS, sementara XII RPL 1 tetap KBM AKTIF.
 * 4. Invariant: Tidak ada kelas fiktif XII TKJ 2 di form izin guru.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Mock DOM Environment
class MockElement {
  constructor(tag = 'div', id = '') {
    this.tagName = tag.toUpperCase();
    this.id = id;
    this.value = '';
    this.innerHTML = '';
    this.textContent = '';
    this.style = {};
    this.classList = {
      _classes: new Set(),
      add(c) { this._classes.add(c); },
      remove(c) { this._classes.delete(c); },
      contains(c) { return this._classes.has(c); }
    };
    this.children = [];
    this.files = [];
    this.disabled = false;
    this.setAttribute = () => {};
    this.getAttribute = () => null;
  }
  appendChild(child) {
    this.children.push(child);
    return child;
  }
  querySelector(selector) {
    if (selector.startsWith('#')) {
      const targetId = selector.slice(1);
      return this.children.find(c => c.id === targetId) || null;
    }
    return this.children[0] || null;
  }
  querySelectorAll(selector) {
    return this.children;
  }
  addEventListener() {}
  removeEventListener() {}
}

const elements = {};
global.document = {
  getElementById: (id) => {
    if (!elements[id]) {
      elements[id] = new MockElement('div', id);
    }
    return elements[id];
  },
  createElement: (tag) => new MockElement(tag),
  querySelectorAll: (selector) => {
    if (selector.includes('btn-hari-kendala')) {
      return ['senin', 'selasa', 'rabu', 'kamis', 'jumat'].map(h => {
        const el = new MockElement('button', 'btn_' + h);
        el.setAttribute = () => {};
        return el;
      });
    }
    return [];
  },
  querySelector: () => null,
  addEventListener: () => {},
  removeEventListener: () => {}
};
global.window = global;
global.window.location = { replace: () => {}, href: '' };
global.window.addEventListener = () => {};
global.window.removeEventListener = () => {};

// Mock LocalStorage
const store = {};
global.localStorage = {
  getItem: (k) => store[k] || null,
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); }
};

// Mock Firebase RTDB
const rtdbData = {};
global.db = {
  ref: (node) => ({
    set: async (val) => {
      rtdbData[node] = JSON.parse(JSON.stringify(val));
      return true;
    },
    update: async (val) => {
      rtdbData[node] = Object.assign({}, rtdbData[node] || {}, JSON.parse(JSON.stringify(val)));
      return true;
    },
    once: async () => ({
      val: () => rtdbData[node] || null,
      exists: () => !!rtdbData[node]
    }),
    on: () => {},
    off: () => {}
  })
};

// Muat modul
require('../assets/firebase-config.js');
require('../assets/jadwal-util.js');
const dg = require('../assets/dashboard-guru.js');
const admin = require('../assets/admin.js');

async function runTests() {
  console.log('================================================================');
  console.log('🧪 PENGUJIAN OPSI JADWAL GURU & AKURASI TARGET KELAS ACC JAMKOS');
  console.log('================================================================\n');

  // [Test 1] Evaluasi Invariant Kelas pada dashboard-guru.html
  console.log('▶ [Test 1] Evaluasi Eliminasi Kelas Fiktif XII TKJ 2 pada Form...');
  const htmlContent = fs.readFileSync(path.join(__dirname, '../dashboard-guru.html'), 'utf8');
  assert.strictEqual(htmlContent.includes('XII TKJ 2'), false, 'Form kendala tidak boleh memiliki opsi XII TKJ 2');
  console.log('  ✓ Invariant resmi 3 kelas terjaga (XII TKJ 2 telah dihapus total).\n');

  // [Test 2] Evaluasi Pengambilan Opsi Jadwal Guru Echa (Muhammad Echa Putra)
  console.log('▶ [Test 2] Evaluasi Opsi Jadwal Mengajar Guru Echa...');
  const guruEcha = {
    nip: '199209142022211007',
    nama: 'Muhammad Echa Putra, S.Kom.Gr',
    isWalas: true,
    walasKelasId: 'XII RPL 2',
    kelas: 'XII RPL 2',
    role: 'walas'
  };

  const jadwalSelasaEcha = dg.ambilDaftarJadwalGuru(guruEcha, 'selasa');
  assert.ok(Array.isArray(jadwalSelasaEcha), 'Jadwal harus berupa array');
  assert.ok(jadwalSelasaEcha.length >= 2, 'Guru Echa mengajar di minimal 2 sesi pada hari Selasa');

  const sesiRpl2 = jadwalSelasaEcha.find(s => s.kelas === 'XII RPL 2');
  assert.ok(sesiRpl2, 'Harus ada jadwal mengajar di kelas XII RPL 2');
  assert.strictEqual(sesiRpl2.mapel, 'Basis Data & Pemodelan RPL', 'Mapel di XII RPL 2 harus Basis Data & Pemodelan RPL');
  assert.strictEqual(sesiRpl2.mulai, '07:00', 'Jam mulai harus 07:00');
  assert.strictEqual(sesiRpl2.selesai, '08:30', 'Jam selesai harus 08:30');
  console.log(`  ✓ Terdeteksi sesi mengajar Echa: ${sesiRpl2.kelas} - ${sesiRpl2.mapel} (${sesiRpl2.mulai} - ${sesiRpl2.selesai}).\n`);

  // [Test 3] Evaluasi Pemilihan Sesi Jadwal (Auto-fill Form)
  console.log('▶ [Test 3] Evaluasi Auto-fill Form saat Guru Memilih Sesi Jadwal...');
  const elKelas = global.document.getElementById('kendalaKelas');
  const elMapel = global.document.getElementById('kendalaMapel');
  const elJam = global.document.getElementById('kendalaJamPelajaran');
  const elMulai = global.document.getElementById('kendalaJamMulai');
  const elSelesai = global.document.getElementById('kendalaJamSelesai');

  // Simulasi awal form berada di default lama
  elKelas.value = 'XII RPL 1';
  elMapel.value = 'web';

  // Guru memilih sesi XII RPL 2
  dg.pilihJadwalKendalaGuru(sesiRpl2, null);

  assert.strictEqual(elKelas.value, 'XII RPL 2', 'Kelas otomatis berganti menjadi XII RPL 2');
  assert.strictEqual(elMapel.value, 'Basis Data & Pemodelan RPL', 'Mapel otomatis berganti menjadi Basis Data & Pemodelan RPL');
  assert.ok(elJam.value.includes('07:00 - 08:30'), 'Jam pembelajaran otomatis terisi rentang jam');
  assert.strictEqual(elMulai.value, '07:00');
  assert.strictEqual(elSelesai.value, '08:30');
  console.log('  ✓ Form sukses auto-fill ke XII RPL 2, Basis Data & Pemodelan RPL, 07:00 - 08:30.\n');

  // [Test 4] Evaluasi Submit Kendala Membawa Data Akurat
  console.log('▶ [Test 4] Evaluasi Submit Kendala Mengajar Guru Echa...');
  global.guruAktif = guruEcha;
  const elAlasan = global.document.getElementById('kendalaAlasan');
  const elJenis = global.document.getElementById('kendalaJenis');
  elAlasan.value = 'Demam dan perlu istirahat. Tugas: Kerjakan Modul DDL Halaman 45.';
  elJenis.value = 'sakit_mendadak';

  const submitRes = await dg.submitKendalaGuru({ preventDefault: () => {} });
  assert.strictEqual(submitRes.success, true, 'Submit kendala harus sukses');
  assert.ok(submitRes.id, 'Harus menghasilkan ID laporan');
  assert.strictEqual(submitRes.payload.kelasId, 'XII RPL 2', 'Target kelas di payload harus XII RPL 2');
  assert.strictEqual(submitRes.payload.mapel, 'Basis Data & Pemodelan RPL', 'Target mapel harus akurat');
  assert.ok(submitRes.payload.jamPelajaran.includes('07:00 - 08:30'), 'Jam pelajaran harus tercatat di payload');
  console.log(`  ✓ Payload kendala tersimpan dengan ID: ${submitRes.id} (Kelas: ${submitRes.payload.kelasId}).\n`);

  // [Test 5] Evaluasi Admin ACC Hanya Mengubah Kelas yang Diajukan (XII RPL 2)
  console.log('▶ [Test 5] Evaluasi Admin ACC Jamkos Tepat Sasaran pada XII RPL 2...');
  
  // Inisialisasi status 3 kelas di database awal (Semua Belajar / KBM Aktif)
  rtdbData['kelas/XII RPL 1'] = { status: 'belajar', activeMapel: 'Administrasi Infrastruktur Jaringan' };
  rtdbData['kelas/XII RPL 2'] = { status: 'belajar', activeMapel: 'Basis Data & Pemodelan RPL' };
  rtdbData['kelas/XII TKJ 1'] = { status: 'belajar', activeMapel: 'Teknologi Jaringan & Komputer' };

  // Set di cache kendala admin
  global.kendalaGuruCache = global.kendalaGuruCache || {};
  global.kendalaGuruCache[submitRes.id] = submitRes.payload;
  if (admin && admin.kendalaGuruCache) {
    admin.kendalaGuruCache[submitRes.id] = submitRes.payload;
  }

  // Admin mengeksekusi ACC
  await admin.adminApproveKendala(submitRes.id);

  // Verifikasi status kelas di database
  assert.strictEqual(rtdbData['kelas/XII RPL 2'].status, 'jamkos', 'Kelas XII RPL 2 HARUS menjadi status JAMKOS');
  assert.strictEqual(rtdbData['kelas/XII RPL 1'].status, 'belajar', 'Kelas XII RPL 1 HARUS TETAP berstatus BELAJAR (KBM Aktif)');
  assert.strictEqual(rtdbData['kelas/XII TKJ 1'].status, 'belajar', 'Kelas XII TKJ 1 HARUS TETAP berstatus BELAJAR (KBM Aktif)');

  console.log('  ✓ Kelas XII RPL 2 berhasil beralih status ke: JAMKOS');
  console.log('  ✓ Kelas XII RPL 1 aman & tetap berstatus: BELAJAR (KBM AKTIF)');
  console.log('  ✓ Kelas XII TKJ 1 aman & tetap berstatus: BELAJAR (KBM AKTIF)\n');

  console.log('================================================================');
  console.log('🎉 SELURUH PENGUJIAN OPSI JADWAL GURU & ACC JAMKOS LULUS 100%!');
  console.log('================================================================');
}

runTests().catch(err => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
