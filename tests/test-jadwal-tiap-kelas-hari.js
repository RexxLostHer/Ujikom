// ===================================================================
// TEST SUITE: JADWAL PELAJARAN PER KELAS & PER HARI (SENIN - JUMAT)
// Memverifikasi kelengkapan jadwal 3 Kelas Pilot SMKN 1 Sumedang:
// 1. XII RPL 1 (Walas: Rijal Nur Rahmat, S.T)
// 2. XII RPL 2 (Walas: Muhammad Echa Putra, S.Kom.Gr)
// 3. XII TKJ 1 (Walas: Heri Anggara, S.Kom)
// ===================================================================

const assert = require('assert');
const path = require('path');
const {
  MASTER_JADWAL_RESMI,
  JAM_PULANG_RESMI,
  ambilJadwalKelasHariIni,
  cariJamKeAktif
} = require('../assets/jadwal-util.js');

console.log('=== MEMULAI TEST JADWAL PELAJARAN TIAP KELAS & TIAP HARI ===\n');

// 1. Verifikasi 3 Kelas Pilot Terdaftar
const daftarKelas = ['XII RPL 1', 'XII RPL 2', 'XII TKJ 1'];
daftarKelas.forEach(kelas => {
  assert.ok(MASTER_JADWAL_RESMI[kelas], `Kelas ${kelas} harus terdaftar di MASTER_JADWAL_RESMI`);
  console.log(`✓ [Test 1] Kelas ${kelas} terdaftar dengan struktur jadwal resmi.`);
});

// 2. Verifikasi 5 Hari Belajar Aktif (Senin s/d Jumat) per Kelas
const hariAktif = ['senin', 'selasa', 'rabu', 'kamis', 'jumat'];
daftarKelas.forEach(kelas => {
  hariAktif.forEach(hari => {
    const jadwalHari = MASTER_JADWAL_RESMI[kelas][hari];
    assert.ok(jadwalHari, `Jadwal hari ${hari} untuk kelas ${kelas} harus ada`);
    const totalJam = Object.keys(jadwalHari).length;
    assert.ok(totalJam >= 5, `Hari ${hari} kelas ${kelas} harus memiliki minimal 5 jam KBM (ditemukan: ${totalJam})`);
    
    // Verifikasi kelengkapan data tiap jam ke
    Object.keys(jadwalHari).forEach(jamKe => {
      const p = jadwalHari[jamKe];
      assert.ok(p.mapel, `Jam ke-${jamKe} hari ${hari} kelas ${kelas} harus memiliki mapel`);
      assert.ok(p.mulai, `Jam ke-${jamKe} hari ${hari} kelas ${kelas} harus memiliki jam mulai`);
      assert.ok(p.selesai, `Jam ke-${jamKe} hari ${hari} kelas ${kelas} harus memiliki jam selesai`);
      assert.ok(p.mulai < p.selesai, `Jam mulai (${p.mulai}) harus lebih awal dari jam selesai (${p.selesai})`);
    });
  });
  console.log(`✓ [Test 2] Kelas ${kelas} lengkap memiliki jadwal untuk 5 hari (Senin s/d Jumat).`);
});

// 3. Verifikasi Jam Pulang Resmi (Senin-Kamis 15:30, Jumat 11:45)
assert.strictEqual(JAM_PULANG_RESMI['senin'], '15:30');
assert.strictEqual(JAM_PULANG_RESMI['selasa'], '15:30');
assert.strictEqual(JAM_PULANG_RESMI['rabu'], '15:30');
assert.strictEqual(JAM_PULANG_RESMI['kamis'], '15:30');
assert.strictEqual(JAM_PULANG_RESMI['jumat'], '11:45');
console.log('✓ [Test 3] Jam kepulangan sekolah sesuai ketetapan kurikulum (Jumat 11:45, Senin-Kamis 15:30).');

// 4. Uji Fungsi Pembantu ambilJadwalKelasHariIni
const resSeninRpl2 = ambilJadwalKelasHariIni(null, 'XII RPL 2', 'senin');
assert.strictEqual(resSeninRpl2.hari, 'senin');
assert.strictEqual(resSeninRpl2.jamPulang, '15:30');
assert.ok(Object.keys(resSeninRpl2.jadwal).length >= 8);

const resJumatRpl2 = ambilJadwalKelasHariIni(null, 'XII RPL 2', 'jumat');
assert.strictEqual(resJumatRpl2.hari, 'jumat');
assert.strictEqual(resJumatRpl2.jamPulang, '11:45');
assert.strictEqual(resJumatRpl2.jadwal['1'].mapel, 'Pendidikan Agama Islam & Budi Pekerti');
console.log('✓ [Test 4] Fungsi ambilJadwalKelasHariIni sukses mengekstrak jadwal dinamis per-hari.');

// 5. Uji Pencarian Jam Aktif di Hari Tertentu
const resAktif = cariJamKeAktif(resSeninRpl2.jadwal, '08:00');
assert.ok(resAktif, 'Pukul 08:00 Senin harus ada jam pelajaran aktif');
assert.strictEqual(resAktif.jam_ke, '2');
console.log(`✓ [Test 5] Deteksi slot KBM aktif berhasil (Pukul 08:00: Jam Ke-${resAktif.jam_ke} - ${resAktif.mapel}).`);

console.log('\n======================================================');
console.log('🎉 SEMUA PENGUJIAN JADWAL TIAP KELAS & HARI 100% SUKSES!');
console.log('======================================================');
