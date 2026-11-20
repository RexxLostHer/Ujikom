const assert = require('assert');
const fs = require('fs');

console.log('=== TEST MULTI-ANAK ORTU & PEMILIH ANAK AKTIF ===\n');

const roster = JSON.parse(fs.readFileSync('seed/roster-data.json', 'utf8'));
assert.strictEqual(roster['00082109'], undefined, 'Data Tifani harus sudah terhapus');
console.log('[PASS 1] Data Tifani Adisya Ramadhani terverifikasi bersih/terhapus dari roster.');

// Mock sessionStorage & localStorage untuk Node.js test environment
const mockStorage = {};
global.sessionStorage = {
  getItem: (k) => mockStorage[k] || null,
  setItem: (k, v) => { mockStorage[k] = String(v); },
  removeItem: (k) => { delete mockStorage[k]; }
};
global.localStorage = {
  getItem: (k) => mockStorage[k] || null,
  setItem: (k, v) => { mockStorage[k] = String(v); },
  removeItem: (k) => { delete mockStorage[k]; }
};

const auth = require('../assets/auth.js');
const { konfirmasiTautkanOrtu } = auth;

// Simulasi akun ortu menautkan anak ke-1 (M. Ihsan Athallah)
const ihsan = roster['0098263610'];
assert.ok(ihsan, 'Ihsan harus ada');

// Ambil anak ke-2 (contoh: Ahsan Mahmud Fauzi Yusry NISN 0091113849)
const ahsan = roster['0091113849'];
assert.ok(ahsan, 'Ahsan harus ada');

(async () => {
  // 1. Tautkan anak ke-1
  const sess1 = await konfirmasiTautkanOrtu(ihsan.nik, ihsan.tanggal_lahir, 'Bpk. Hendra');
  assert.strictEqual(sess1.role, 'orangtua');
  assert.strictEqual(sess1.nisn_anak, '0098263610');
  assert.ok(sess1.daftar_anak['0098263610']);
  console.log('[PASS 2] Penautan anak pertama (Ihsan) berhasil.');

  // 2. Tautkan anak ke-2 pada akun yang sama
  const sess2 = await konfirmasiTautkanOrtu(ahsan.nik, ahsan.tanggal_lahir, 'Bpk. Hendra');
  assert.strictEqual(sess2.nisn_anak, '0091113849');
  assert.ok(sess2.daftar_anak['0098263610'], 'Anak pertama (Ihsan) harus tetap tersimpan');
  assert.ok(sess2.daftar_anak['0091113849'], 'Anak kedua (Ahsan) harus tersimpan');
  assert.strictEqual(Object.keys(sess2.daftar_anak).length, 2, 'Total anak ditautkan harus 2');
  console.log('[PASS 3] Penautan anak kedua (Ahsan) berhasil mempertahankan anak pertama (Multi-Anak 100% Aktif).');

  // 3. Verifikasi file dashboard-ortu.html memiliki tombol tambah anak & selector
  const html = fs.readFileSync('dashboard-ortu.html', 'utf8');
  assert.ok(html.includes('id="selectAnakAktif"'), 'Selector anak aktif harus ada di dashboard-ortu.html');
  assert.ok(html.includes('id="modalTambahAnak"'), 'Modal tambah anak harus ada di dashboard-ortu.html');
  assert.ok(html.includes('gantiAnakAktif'), 'Fungsi ganti anak aktif harus ada');
  console.log('[PASS 4] Markup & script dashboard-ortu.html valid untuk navigasi multi-anak.');

  console.log('\n🎉 SEMUA PENGUJIAN FITUR MULTI-ANAK 100% BERHASIL!');
})();
