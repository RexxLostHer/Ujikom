// ===================================================================
// TEST SUITE: test-presensi-default-kehadiran.js
// Menguji implementasi presensi default:
// 1. Seluruh siswa otomatis Hadir tepat waktu (06:12 - 06:28 WIB)
// 2. KECUALI M. Ihsan Athallah (0098263610) & Rizky Ramadhani (0082104129)
//    yang berstatus "Belum Absen / Belum Scan" untuk pengujian kartu live
// 3. Rekonsiliasi dinamis saat kartu Ihsan atau Rizky di-tap secara live
// ===================================================================

const assert = require('assert');
const path = require('path');
const fb = require('../assets/firebase-config.js');

console.log('====================================================');
console.log('🧪 PENGUJIAN STATUS KEHADIRAN DEFAULT KELAS UJIKOM');
console.log('====================================================\n');

// 1. Verifikasi Eksklusi Ihsan & Rizky
console.log('[Test 1] Evaluasi Konstanta Eksklusi Belum Absen...');
assert.ok(Array.isArray(fb.EXCLUDED_BELUM_ABSEN_NISN), 'EXCLUDED_BELUM_ABSEN_NISN harus berupa array');
assert.ok(fb.EXCLUDED_BELUM_ABSEN_NISN.includes('0098263610'), 'M. Ihsan Athallah (0098263610) harus termasuk dalam pengecualian');
assert.ok(fb.EXCLUDED_BELUM_ABSEN_NISN.includes('0082104129'), 'Rizky Ramadhani (0082104129) harus termasuk dalam pengecualian');
assert.strictEqual(fb.EXCLUDED_BELUM_ABSEN_NISN.length, 2, 'Hanya ada 2 siswa dalam pengecualian belum absen');
console.log('✓ [Test 1] Konstanta pengecualian Ihsan & Rizky terverifikasi akurat.\n');

// 2. Verifikasi Kehadiran Kelas XII RPL 2
console.log('[Test 2] Evaluasi Presensi Kelas XII RPL 2 (34 Siswa: 32 Hadir, 2 Belum Absen)...');
const defRpl2 = fb.generateDefaultPresensiResmi('XII RPL 2', '2026-10-15');
const allRpl2 = Object.values(fb.MASTER_DATA_SISWA_RESMI).filter(s => fb.normalisasiKelas(fb.ambilKelasSiswa(s)) === 'XII RPL 2');
assert.strictEqual(allRpl2.length, 34, 'Total siswa XII RPL 2 harus tepat 34');

const hadirRpl2 = allRpl2.filter(s => defRpl2[s.nisn] && defRpl2[s.nisn].status === 'hadir');
const belumRpl2 = allRpl2.filter(s => !defRpl2[s.nisn]);

assert.strictEqual(hadirRpl2.length, 32, 'Harus ada 32 siswa XII RPL 2 yang Sudah Hadir');
assert.strictEqual(belumRpl2.length, 2, 'Harus ada tepat 2 siswa XII RPL 2 yang Belum Absen');

const belumNisns = belumRpl2.map(s => s.nisn).sort();
assert.deepStrictEqual(belumNisns, ['0082104129', '0098263610'], 'Dua siswa yang belum absen wajib Ihsan & Rizky');
console.log('✓ [Test 2] XII RPL 2 terverifikasi: 32 Hadir, 2 Belum Absen (M. Ihsan Athallah & Rizky Ramadhani).\n');

// 3. Verifikasi Kehadiran Kelas XII RPL 1
console.log('[Test 3] Evaluasi Presensi Kelas XII RPL 1 (33 Siswa: Seluruhnya Hadir)...');
const defRpl1 = fb.generateDefaultPresensiResmi('XII RPL 1', '2026-10-15');
const allRpl1 = Object.values(fb.MASTER_DATA_SISWA_RESMI).filter(s => fb.normalisasiKelas(fb.ambilKelasSiswa(s)) === 'XII RPL 1');
assert.strictEqual(allRpl1.length, 33, 'Total siswa XII RPL 1 harus tepat 33');

const hadirRpl1 = allRpl1.filter(s => defRpl1[s.nisn] && defRpl1[s.nisn].status === 'hadir');
const belumRpl1 = allRpl1.filter(s => !defRpl1[s.nisn]);

assert.strictEqual(hadirRpl1.length, 33, 'Seluruh 33 siswa XII RPL 1 harus Sudah Hadir');
assert.strictEqual(belumRpl1.length, 0, 'Tidak boleh ada siswa XII RPL 1 yang Belum Absen');
console.log('✓ [Test 3] XII RPL 1 terverifikasi: Seluruh 33 siswa Sudah Hadir.\n');

// 4. Verifikasi Kehadiran Kelas XII TKJ 1
console.log('[Test 4] Evaluasi Presensi Kelas XII TKJ 1 (2 Siswa: Seluruhnya Hadir)...');
const defTkj1 = fb.generateDefaultPresensiResmi('XII TKJ 1', '2026-10-15');
const allTkj1 = Object.values(fb.MASTER_DATA_SISWA_RESMI).filter(s => fb.normalisasiKelas(fb.ambilKelasSiswa(s)) === 'XII TKJ 1');
assert.strictEqual(allTkj1.length, 2, 'Total siswa XII TKJ 1 harus tepat 2');

const hadirTkj1 = allTkj1.filter(s => defTkj1[s.nisn] && defTkj1[s.nisn].status === 'hadir');
const belumTkj1 = allTkj1.filter(s => !defTkj1[s.nisn]);

assert.strictEqual(hadirTkj1.length, 2, 'Seluruh 2 siswa XII TKJ 1 harus Sudah Hadir');
assert.strictEqual(belumTkj1.length, 0, 'Tidak boleh ada siswa XII TKJ 1 yang Belum Absen');
console.log('✓ [Test 4] XII TKJ 1 terverifikasi: Seluruh 2 siswa Sudah Hadir.\n');

// 5. Total Kumulatif 69 Siswa
console.log('[Test 5] Evaluasi Total Kumulatif 3 Kelas (69 Siswa: 67 Hadir, 2 Belum Absen)...');
const defSemua = fb.generateDefaultPresensiResmi(null, '2026-10-15');
const totalSiswaResmi = Object.keys(fb.MASTER_DATA_SISWA_RESMI).length;
const totalHadir = Object.keys(defSemua).length;

assert.strictEqual(totalSiswaResmi, 69, 'Total siswa resmi harus tepat 69');
assert.strictEqual(totalHadir, 67, 'Total siswa hadir harus tepat 67');
assert.strictEqual(totalSiswaResmi - totalHadir, 2, 'Tepat selisih 2 siswa belum absen');
console.log('✓ [Test 5] Total kumulatif terverifikasi: 67 Hadir, 2 Belum Absen.\n');

// 6. Simulasi Tap RFID Live M. Ihsan Athallah
console.log('[Test 6] Simulasi Tap RFID Live M. Ihsan Athallah (0098263610)...');
let livePresensi = Object.assign({}, defRpl2);
assert.strictEqual(livePresensi['0098263610'], undefined, 'Sebelum tap, Ihsan tidak ada di list presensi');

// Tap terjadi
const tapIhsan = { nisn: '0098263610', nama: 'M. IHSAN ATHALLAH', status: 'hadir', waktu: '06:55:00', metode: 'rfid' };
const gabunganFromFirebase = { '0098263610': tapIhsan };

// Merge logic
const finalPresensi = Object.assign({}, defRpl2, gabunganFromFirebase);
if (!gabunganFromFirebase['0098263610']) delete finalPresensi['0098263610'];
if (!gabunganFromFirebase['0082104129']) delete finalPresensi['0082104129'];

assert.ok(finalPresensi['0098263610'], 'Setelah tap, Ihsan masuk ke list Sudah Hadir');
assert.strictEqual(finalPresensi['0098263610'].waktu, '06:55:00', 'Jam tap Ihsan tercatat tepat');
assert.strictEqual(finalPresensi['0082104129'], undefined, 'Rizky tetap Belum Absen karena belum di-tap');

const hitungSudahSetelahTap = Object.keys(finalPresensi).length;
assert.strictEqual(hitungSudahSetelahTap, 33, 'Setelah Ihsan tap, jumlah hadir naik jadi 33');
console.log('✓ [Test 6] Transisi live tap RFID Ihsan terverifikasi mulus.\n');

// 7. Normalisasi Prefix Kelas & Sanitasi Input Dropdown
console.log('[Test 7] Evaluasi Normalisasi Variasi Input Dropdown (Prefix "Kelas")...');
['Kelas XII RPL 1', 'kelas  xii-rpl-1', '12 RPL 1', 'XII RPL 1'].forEach(input => {
  assert.strictEqual(fb.normalisasiKelas(input), 'XII RPL 1', `Input "${input}" harus dinormalisasi menjadi "XII RPL 1"`);
  const res = fb.generateDefaultPresensiResmi(input, '2026-10-15');
  assert.strictEqual(Object.keys(res).length, 33, `Hasil presensi untuk input "${input}" harus tetap 33 siswa`);
});

['Kelas XII RPL 2', 'kelas  xii-rpl-2', '12 RPL 2', 'XII RPL 2'].forEach(input => {
  assert.strictEqual(fb.normalisasiKelas(input), 'XII RPL 2', `Input "${input}" harus dinormalisasi menjadi "XII RPL 2"`);
  const res = fb.generateDefaultPresensiResmi(input, '2026-10-15');
  assert.strictEqual(Object.keys(res).length, 32, `Hasil presensi untuk input "${input}" harus tetap 32 siswa (minus Ihsan & Rizky)`);
});

['Kelas XII TKJ 1', 'kelas  xii-tkj-1', '12 TKJ 1', 'XII TKJ 1'].forEach(input => {
  assert.strictEqual(fb.normalisasiKelas(input), 'XII TKJ 1', `Input "${input}" harus dinormalisasi menjadi "XII TKJ 1"`);
  const res = fb.generateDefaultPresensiResmi(input, '2026-10-15');
  assert.strictEqual(Object.keys(res).length, 2, `Hasil presensi untuk input "${input}" harus tetap 2 siswa`);
});
console.log('✓ [Test 7] Sanitasi dan normalisasi prefix "Kelas " 100% valid & konsisten.\n');

console.log('====================================================');
console.log('🎉 SEMUA PENGUJIAN STATUS KEHADIRAN DEFAULT LULUS 100%');
console.log('====================================================');

