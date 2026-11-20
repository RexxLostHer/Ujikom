const assert = require('assert');
const fs = require('fs');

console.log('=== TEST KALENDER LIBUR & AKHIR PEKAN STATUS KBM ===\n');

const jadwalUtil = require('../assets/jadwal-util.js');
const { tentukanStatusKelas } = jadwalUtil;

// 1. Uji Akhir Pekan (Sabtu & Minggu)
const statusSabtu = tentukanStatusKelas('XII RPL 2', { hari: 'sabtu', waktuWIB: '09:00' });
assert.strictEqual(statusSabtu.status, 'libur');
assert.strictEqual(statusSabtu.badgeText, 'Libur');
console.log('[PASS 1] Hari Sabtu otomatis berstatus Libur.');

const statusMinggu = tentukanStatusKelas('XII RPL 2', { hari: 'minggu', waktuWIB: '10:00' });
assert.strictEqual(statusMinggu.status, 'libur');
assert.strictEqual(statusMinggu.badgeText, 'Libur');
console.log('[PASS 2] Hari Minggu otomatis berstatus Libur.');

// 2. Uji Tanggal Merah Nasional (Contoh: 17 Agustus / Hari Kemerdekaan RI)
const status17Agustus = tentukanStatusKelas('XII RPL 2', {
  tanggal: '2026-08-17',
  hari: 'senin',
  waktuWIB: '09:00'
});
assert.strictEqual(status17Agustus.status, 'libur');
assert.ok(status17Agustus.deskripsi.includes('HUT RI') || status17Agustus.deskripsi.includes('Kemerdekaan'));
console.log('[PASS 3] Tanggal Merah 17 Agustus (HUT RI) pada hari Senin otomatis berstatus Libur Nasional.');

// 3. Uji Tanggal Merah Lain (Contoh: 1 Mei / Hari Buruh)
const status1Mei = tentukanStatusKelas('XII RPL 2', {
  tanggal: '2026-05-01',
  hari: 'jumat',
  waktuWIB: '08:00'
});
assert.strictEqual(status1Mei.status, 'libur');
assert.ok(status1Mei.deskripsi.includes('Hari Buruh'));
console.log('[PASS 4] Tanggal Merah 1 Mei (Hari Buruh) otomatis berstatus Libur.');

// 4. Uji Hari Belajar Normal (Bukan akhir pekan, bukan tanggal merah)
const statusSeninBiasa = tentukanStatusKelas('XII RPL 2', {
  tanggal: '2026-08-10',
  hari: 'senin',
  waktuWIB: '08:30'
});
assert.strictEqual(statusSeninBiasa.status, 'belajar');
console.log('[PASS 5] Hari Senin biasa di jam aktif KBM tetap berstatus KBM: BELAJAR.');

console.log('\n🎉 SEMUA PENGUJIAN STATUS LIBUR & TANGGAL MERAH 100% SUKSES!');
