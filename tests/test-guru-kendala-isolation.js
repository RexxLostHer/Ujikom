/**
 * test-guru-kendala-isolation.js
 * Memvalidasi isolasi izin/kendala mengajar guru dari antrean validasi izin siswa:
 * 1. isItemIzinGuru mendeteksi payload laporan kendala guru (KENDALA-*, tipe: 'kendala_guru', jenis: 'sakit_mendadak', dsb.)
 * 2. Laporan kendala guru TIDAK masuk ke muatPerizinanSiswaWalas (Tab Validasi Izin Siswa)
 * 3. Guru yang login (Pak Echa) TIDAK melihat izinnya sendiri di daftar "Pengajuan Izin & Sakit Siswa"
 * 4. Badge countPendingIzin pada tab Validasi Izin TIDAK menghitung laporan kendala guru
 * 5. Laporan kendala guru tetap masuk dan tampil dengan benar di muatRiwayatKendalaGuru (Tab Lapor Kendala)
 * 6. Izin siswa asli (misal M. Ihsan Athallah) tetap tampil normal dan dapat divalidasi oleh Walas
 */

const assert = require('assert');
const path = require('path');

async function testGuruKendalaIsolation() {
  console.log('=== TEST SUITE: ISOLASI LAPORAN KENDALA GURU DARI VALIDASI IZIN SISWA ===\n');

  // Mock DOM & Storage
  class MockLocalStorage {
    constructor() { this.store = {}; }
    getItem(key) { return this.store[key] || null; }
    setItem(key, value) { this.store[key] = String(value); }
    removeItem(key) { delete this.store[key]; }
    clear() { this.store = {}; }
  }

  class MockElement {
    constructor(id = '', tagName = 'div') {
      this.id = id;
      this.tagName = tagName.toUpperCase();
      this._children = [];
      this._innerHTML = '';
      this._textContent = '';
      this.value = '';
      this.disabled = false;
      this.style = {};
      this.classList = {
        classes: new Set(),
        add: (c) => this.classList.classes.add(c),
        remove: (c) => this.classList.classes.delete(c),
        contains: (c) => this.classList.classes.has(c)
      };
    }
    get textContent() { return this._textContent; }
    set textContent(val) { this._textContent = String(val); }
    get children() { return this._children; }
    get innerHTML() {
      let html = this._innerHTML || '';
      if (this._children.length > 0) {
        html += this._children.map(c => c.innerHTML).join('');
      }
      return html;
    }
    set innerHTML(val) {
      this._innerHTML = String(val);
      this._children = [];
    }
    appendChild(child) {
      if (child) this._children.push(child);
      return child;
    }
    addEventListener() {}
    removeEventListener() {}
  }

  const mockStorage = new MockLocalStorage();
  const domStore = {
    listApprovalIzin: new MockElement('listApprovalIzin'),
    listRiwayatKendalaGuru: new MockElement('listRiwayatKendalaGuru'),
    countPendingIzin: new MockElement('countPendingIzin'),
    btnFilterIzinSemua: new MockElement('btnFilterIzinSemua'),
    btnFilterIzinPending: new MockElement('btnFilterIzinPending'),
    btnFilterIzinDisetujui: new MockElement('btnFilterIzinDisetujui'),
    btnFilterIzinDitolak: new MockElement('btnFilterIzinDitolak'),
    btnTabApprovalIzin: new MockElement('btnTabApprovalIzin'),
    btnTabValidasiIzin: new MockElement('btnTabValidasiIzin')
  };

  global.localStorage = mockStorage;
  global.window = {
    localStorage: mockStorage,
    addEventListener: () => {},
    removeEventListener: () => {}
  };
  global.document = {
    getElementById: (id) => domStore[id] || new MockElement(id),
    createElement: (tag) => new MockElement('', tag),
    addEventListener: () => {},
    readyState: 'complete'
  };

  // Mock DB
  const mockDbData = {
    perijinan: {},
    perizinan: {},
    kendala_guru: {},
    kendala_mengajar: {}
  };
  global.db = {
    ref: (pathStr) => ({
      once: (event) => Promise.resolve({
        val: () => mockDbData[pathStr] || {}
      }),
      on: () => {},
      set: (val) => {
        mockDbData[pathStr] = val;
        return Promise.resolve();
      }
    })
  };

  // Import dashboard-guru.js
  const dg = require('../assets/dashboard-guru.js');
  const { isItemIzinGuru, muatPerizinanSiswaWalas, muatRiwayatKendalaGuru } = dg;

  assert.strictEqual(typeof isItemIzinGuru, 'function', 'isItemIzinGuru harus diekspor sebagai fungsi');

  // =================================================================
  // TEST 1: isItemIzinGuru mendeteksi kendala guru secara akurat
  // =================================================================
  console.log('[Test 1] Pengujian fungsi isItemIzinGuru...');
  const kendalaEchaLapar = {
    id: 'KENDALA-1794107096999-lapar',
    guruId: '199209142022211007',
    guru_nip: '199209142022211007',
    nama_guru: 'Muhammad Echa Putra, S.Kom.Gr',
    nama: 'Muhammad Echa Putra, S.Kom.Gr',
    rolePengaju: 'guru',
    tipe: 'kendala_guru',
    jenisPermit: 'kendala_guru',
    kelas: 'XII RPL 2',
    jenis: 'sakit_mendadak',
    alasan: 'lapar',
    status: 'pending'
  };

  const izinSiswaIhsan = {
    id: 'PERMIT-IHSAN-REAL-01',
    nisn: '0098263610',
    nama: 'M. Ihsan Athallah',
    nama_siswa: 'M. Ihsan Athallah',
    rolePengaju: 'siswa',
    tipe: 'izin',
    kelas: 'XII RPL 2',
    jenis: 'sakit',
    alasan: 'Demam dan flu',
    status: 'pending'
  };

  assert.strictEqual(isItemIzinGuru(kendalaEchaLapar), true, 'kendalaEchaLapar harus dideteksi sebagai item izin guru');
  assert.strictEqual(isItemIzinGuru(izinSiswaIhsan), false, 'izinSiswaIhsan TIDAK boleh dideteksi sebagai izin guru');
  console.log('✓ isItemIzinGuru berhasil membedakan izin guru dan izin siswa secara tepat.\n');

  // =================================================================
  // TEST 2: Laporan kendala guru tidak masuk ke antrean validasi izin siswa
  // =================================================================
  console.log('[Test 2] Walas Pak Echa membuka tab Validasi Izin Siswa...');
  global.guruAktif = {
    role: 'walas',
    nip: '199209142022211007',
    nama: 'Muhammad Echa Putra, S.Kom.Gr',
    walasKelasId: 'XII RPL 2'
  };

  // Simpan kendala guru ke localStorage dan Cloud
  mockStorage.setItem('local_kendala_guru', JSON.stringify([kendalaEchaLapar]));
  // Simpan juga kendala guru di perizinan (seperti yang dilakukan submitKendalaGuru)
  mockDbData.perizinan[kendalaEchaLapar.id] = kendalaEchaLapar;

  // Jalankan muatPerizinanSiswaWalas
  muatPerizinanSiswaWalas(false);

  // Verifikasi bahwa kendala guru TIDAK tampil di antrean persetujuan siswa
  const renderedApproval = domStore.listApprovalIzin.innerHTML;
  assert.ok(
    !renderedApproval.includes('lapar'),
    'Laporan kendala guru (alasan: lapar) TIDAK BOLEH tampil di listApprovalIzin'
  );
  assert.ok(
    !renderedApproval.includes('Muhammad Echa Putra, S.Kom.Gr (XII RPL 2)'),
    'Nama guru Pak Echa TIDAK BOLEH tampil sebagai pemohon di kartu izin siswa'
  );
  assert.ok(
    !renderedApproval.includes('SAKIT_MENDADAK'),
    'Jenis kendala guru SAKIT_MENDADAK TIDAK BOLEH tampil di kartu izin siswa'
  );
  assert.strictEqual(
    domStore.countPendingIzin.style.display,
    'none',
    'Badge pending izin harus tersembunyi (0 pending siswa)'
  );
  console.log('✓ Kendala guru tidak masuk ke antrean validasi siswa dan badge pending tetap 0.\n');

  // =================================================================
  // TEST 3: Izin siswa asli tetap tampil dan dihitung di Validasi Izin
  // =================================================================
  console.log('[Test 3] Siswa M. Ihsan Athallah mengajukan izin sakit...');
  mockStorage.setItem('local_perizinan', JSON.stringify([izinSiswaIhsan]));
  mockDbData.perizinan[izinSiswaIhsan.id] = izinSiswaIhsan;

  muatPerizinanSiswaWalas(false);

  const renderedWithStudent = domStore.listApprovalIzin.innerHTML;
  assert.ok(
    renderedWithStudent.includes('M. Ihsan Athallah'),
    'Nama siswa M. Ihsan Athallah HARUS tampil di kartu izin siswa'
  );
  assert.ok(
    renderedWithStudent.includes('0098263610'),
    'NISN siswa HARUS tampil di kartu izin siswa'
  );
  assert.ok(
    renderedWithStudent.includes('Demam dan flu'),
    'Alasan izin siswa HARUS tampil'
  );
  assert.ok(
    renderedWithStudent.includes('✓ Setujui Izin'),
    'Tombol Setujui Izin untuk siswa HARUS tersedia bagi Walas'
  );
  assert.strictEqual(
    domStore.countPendingIzin.textContent,
    '1',
    'Badge pending izin siswa harus bernilai 1'
  );
  assert.strictEqual(
    domStore.countPendingIzin.style.display,
    'inline-block',
    'Badge pending izin siswa harus aktif ditampilkan'
  );
  console.log('✓ Izin siswa berhasil dimuat dengan benar dan badge pending bernilai 1.\n');

  // =================================================================
  // TEST 4: Kendala guru tampil di Riwayat Laporan Izin (Tab Kendala Guru)
  // =================================================================
  console.log('[Test 4] Memverifikasi tampilan kendala guru di Riwayat Laporan Izin Guru...');
  muatRiwayatKendalaGuru(false);

  const renderedKendala = domStore.listRiwayatKendalaGuru.innerHTML;
  assert.ok(
    renderedKendala.includes('lapar'),
    'Alasan kendala guru "lapar" HARUS tampil di listRiwayatKendalaGuru'
  );
  assert.ok(
    renderedKendala.includes('Menunggu Persetujuan'),
    'Status kendala guru harus "Menunggu Persetujuan" (oleh Admin)'
  );
  console.log('✓ Laporan kendala guru tampil sempurna pada Riwayat Laporan Izin Guru di tab Lapor Kendala.\n');

  console.log('================================================================');
  console.log('🎉 SELURUH TEST ISOLASI KENDALA GURU BERHASIL 100%!');
  console.log('================================================================');
}

if (require.main === module) {
  testGuruKendalaIsolation().catch(err => {
    console.error('Test gagal:', err);
    process.exit(1);
  });
}

module.exports = { testGuruKendalaIsolation };
