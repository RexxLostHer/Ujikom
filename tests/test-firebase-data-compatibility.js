const assert = require('assert');
const fs = require('fs');

// Baca konfigurasi dan fungsi parsing
global.firebase = { initializeApp: () => {}, database: () => ({}) };
const configCode = fs.readFileSync('assets/firebase-config.js', 'utf8');
eval(configCode);

console.log('=== MEMULAI TEST KOMPATIBILITAS DATA FIREBASE & 3 KELAS RESMI ===\n');

// 1. Uji Standarisasi 3 Kelas Resmi
console.log('[Test 1] Verifikasi 3 Kelas Resmi');
assert.deepStrictEqual(DAFTAR_KELAS_RESMI, ['XII RPL 1', 'XII RPL 2', 'XII TKJ 1']);
console.log('✓ 3 Kelas Resmi Terverifikasi: ' + DAFTAR_KELAS_RESMI.join(', '));

// 2. Uji Normalisasi Variasi Penulisan Kelas
console.log('\n[Test 2] Uji Normalisasi Berbagai Format Kelas');
assert.strictEqual(normalisasiKelas('12 RPL 1'), 'XII RPL 1');
assert.strictEqual(normalisasiKelas('XII-RPL-1'), 'XII RPL 1');
assert.strictEqual(normalisasiKelas('12RPL2'), 'XII RPL 2');
assert.strictEqual(normalisasiKelas('xii rpl 2'), 'XII RPL 2');
assert.strictEqual(normalisasiKelas('12 TKJ 1'), 'XII TKJ 1');
assert.strictEqual(normalisasiKelas('XII-TKJ-1'), 'XII TKJ 1');
console.log('✓ Normalisasi variasi format kelas lulus 100%');

// 3. Uji Parsing 69 Data Siswa Snapshot (Format Array & Object dari Firebase RTDB)
console.log('\n[Test 3] Uji Parsing 69 Data Siswa Simulasi Firebase RTDB');
const mockFirebaseSiswa = {};
for (let i = 1; i <= 69; i++) {
  const nisn = '008' + String(1000000 + i);
  const kelas = (i <= 25) ? 'XII RPL 1' : ((i <= 50) ? '12-RPL-2' : '12 TKJ 1');
  mockFirebaseSiswa[nisn] = {
    nama: 'Siswa Contoh ' + i,
    rombel: kelas,
    nisn: nisn
  };
}

const hasilParsed = parseSiswaSnapshot(mockFirebaseSiswa);
const totalParsed = Object.keys(hasilParsed).length;
assert.strictEqual(totalParsed, 69, 'Semua 69 siswa harus berhasil diparsing');

const rpl1Count = Object.values(hasilParsed).filter(s => s.kelas === 'XII RPL 1').length;
const rpl2Count = Object.values(hasilParsed).filter(s => s.kelas === 'XII RPL 2').length;
const tkj1Count = Object.values(hasilParsed).filter(s => s.kelas === 'XII TKJ 1').length;

assert.strictEqual(rpl1Count, 25);
assert.strictEqual(rpl2Count, 25);
assert.strictEqual(tkj1Count, 19);

console.log(`✓ 69 Data Siswa sukses dipetakan:`);
console.log(`  - XII RPL 1: ${rpl1Count} siswa`);
console.log(`  - XII RPL 2: ${rpl2Count} siswa`);
console.log(`  - XII TKJ 1: ${tkj1Count} siswa`);

// 4. Uji Format Array Firebase RTDB
console.log('\n[Test 4] Uji Format Array Firebase RTDB');
const mockArraySiswa = [
  null, // Firebase array 1-based index
  { nisn: '0098263610', Nama: 'M. Ihsan Athallah', Kelas: '12 RPL 2' },
  { nisn: '0082104129', Nama: 'Rizky Ramadhani', Kelas: '12 RPL 2' }
];
const arrayParsed = parseSiswaSnapshot(mockArraySiswa);
assert.strictEqual(Object.keys(arrayParsed).length, 2);
assert.strictEqual(arrayParsed['0098263610'].kelas, 'XII RPL 2');
assert.strictEqual(arrayParsed['0082104129'].nama, 'Rizky Ramadhani');
console.log('✓ Format array Firebase RTDB berhasil diparsing normal.');

console.log('\n======================================================');
console.log('🎉 SEMUA TEST KOMPATIBILITAS DATA FIREBASE LOLOS 100%!');
console.log('======================================================');
