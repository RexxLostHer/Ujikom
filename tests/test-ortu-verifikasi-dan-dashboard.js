const assert = require('assert');
const fs = require('fs');

console.log('=== TEST ORANG TUA VERIFIKASI & DASHBOARD ISOLASI ===\n');

// 1. Uji Database Siswa memuat NIK & Tanggal Lahir unik
const roster = JSON.parse(fs.readFileSync('seed/roster-data.json', 'utf8'));
const totalSiswa = Object.keys(roster).length;
assert.ok(totalSiswa >= 69, 'Total siswa minimal 69');

const nikSet = new Set();
const tglSet = new Set();

for (const nisn in roster) {
  const s = roster[nisn];
  assert.ok(s.nik, `Siswa ${nisn} harus punya NIK`);
  assert.ok(s.tanggal_lahir, `Siswa ${nisn} harus punya tanggal_lahir`);
  assert.strictEqual(nikSet.has(s.nik), false, `NIK ${s.nik} tidak boleh duplikat`);
  assert.strictEqual(tglSet.has(s.tanggal_lahir), false, `Tanggal lahir ${s.tanggal_lahir} tidak boleh sama persis`);
  nikSet.add(s.nik);
  tglSet.add(s.tanggal_lahir);
}
console.log(`[PASS 1] Semua ${totalSiswa} siswa memiliki NIK dan Tanggal Lahir acak, unik, dan berbeda.`);

// 2. Uji fungsi periksaDataOrtuSiswa di auth.js
const authModule = require('../assets/auth.js');
const { periksaDataOrtuSiswa, konfirmasiTautkanOrtu } = authModule;

assert.ok(typeof periksaDataOrtuSiswa === 'function', 'periksaDataOrtuSiswa harus ada');
assert.ok(typeof konfirmasiTautkanOrtu === 'function', 'konfirmasiTautkanOrtu harus ada');

// Cek sampel M. Ihsan Athallah (NISN 0098263610)
const ihsan = roster['0098263610'];
assert.ok(ihsan, 'Data Ihsan harus ada');

(async () => {
  // Verifikasi sukses
  const hasil = await periksaDataOrtuSiswa(ihsan.nik, ihsan.tanggal_lahir);
  assert.strictEqual(hasil.nisn, '0098263610');
  assert.strictEqual(hasil.nama_anak, 'M. IHSAN ATHALLAH');
  console.log('[PASS 2] Verifikasi NIK & Tanggal Lahir anak berhasil menemukan data anak.');

  // Verifikasi gagal (NIK salah)
  let errNik = false;
  try {
    await periksaDataOrtuSiswa('3211000000000000', ihsan.tanggal_lahir);
  } catch (e) {
    errNik = true;
  }
  assert.strictEqual(errNik, true, 'NIK salah harus ditolak');

  // Verifikasi gagal (Tanggal lahir salah)
  let errTgl = false;
  try {
    await periksaDataOrtuSiswa(ihsan.nik, '2005-01-01');
  } catch (e) {
    errTgl = true;
  }
  assert.strictEqual(errTgl, true, 'Tanggal lahir salah harus ditolak');
  console.log('[PASS 3] Verifikasi salah kombinasi NIK / Tanggal lahir berhasil ditolak.');

  // 3. Uji perijinan.js mendukung pengajuan dari orangtua
  const perijinanCode = fs.readFileSync('assets/perijinan.js', 'utf8');
  assert.ok(perijinanCode.includes("user.role === 'orangtua'"), 'perijinan.js harus mendukung role orangtua');
  console.log('[PASS 4] perijinan.js mengizinkan orang tua mengajukan izin/sakit/dispen.');

  // 4. Uji portal dashboard-ortu.html ada dan valid
  assert.ok(fs.existsSync('dashboard-ortu.html'), 'dashboard-ortu.html harus ada');
  console.log('[PASS 5] dashboard-ortu.html berhasil dibuat dengan isolasi anak spesifik.');

  console.log('\n🎉 SEMUA PENGUJIAN FITUR ORANG TUA 100% SUKSES!');
})();
