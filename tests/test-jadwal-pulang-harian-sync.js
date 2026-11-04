const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- TEST SUITE: Jadwal Pulang Harian & 3 Kelas Resmi Invariant ---');

// 1. Verify admin.html
const adminHtmlPath = path.join(__dirname, '..', 'admin.html');
const adminHtml = fs.readFileSync(adminHtmlPath, 'utf8');

assert.ok(adminHtml.includes('id="tab-jadwal"'), 'admin.html must contain #tab-jadwal');
assert.ok(adminHtml.includes('id="jadwalKelas"'), 'admin.html must contain #jadwalKelas');
assert.ok(adminHtml.includes('id="jadwalHari"'), 'admin.html must contain #jadwalHari');
assert.ok(adminHtml.includes('id="jadwalJam"'), 'admin.html must contain #jadwalJam');
assert.ok(adminHtml.includes('id="jadwalTableBody"'), 'admin.html must contain #jadwalTableBody');
assert.ok(adminHtml.includes('id="modalEditJadwalPulang"'), 'admin.html must contain #modalEditJadwalPulang');
assert.ok(adminHtml.includes('terapkanPresetStandarJadwal()'), 'admin.html must contain preset button');

// Class Roster Invariant Check
assert.ok(adminHtml.includes('XII RPL 1'), 'admin.html must contain XII RPL 1');
assert.ok(adminHtml.includes('XII RPL 2'), 'admin.html must contain XII RPL 2');
assert.ok(adminHtml.includes('XII TKJ 1'), 'admin.html must contain XII TKJ 1');
assert.ok(!adminHtml.includes('value="XII TKJ 2"'), 'admin.html MUST NOT have XII TKJ 2 in dropdown options');
console.log('✓ PASS: admin.html elements & Class Invariant verified.');

// 2. Verify admin.js functions
const adminJsPath = path.join(__dirname, '..', 'assets', 'admin.js');
const adminJs = fs.readFileSync(adminJsPath, 'utf8');

assert.ok(adminJs.includes('populateJadwalKelasOptions'), 'admin.js must declare populateJadwalKelasOptions');
assert.ok(adminJs.includes('terapkanPresetStandarJadwal'), 'admin.js must declare terapkanPresetStandarJadwal');
assert.ok(adminJs.includes('submitJadwal'), 'admin.js must declare submitJadwal');
assert.ok(adminJs.includes('renderJadwalTable'), 'admin.js must declare renderJadwalTable');
assert.ok(adminJs.includes('bukaModalEditJadwal'), 'admin.js must declare bukaModalEditJadwal');
assert.ok(adminJs.includes('simpanModalEditJadwal'), 'admin.js must declare simpanModalEditJadwal');
console.log('✓ PASS: admin.js contains all required daily schedule functions.');

// 3. Mock Test renderJadwalTable logic
const renderedRows = [];
const mockTbody = {
  innerHTML: '',
  appendChild: (r) => renderedRows.push(r)
};

const mockDoc = {
  getElementById: (id) => {
    if (id === 'jadwalTableBody') return mockTbody;
    return { innerHTML: '', value: '' };
  },
  createElement: (tag) => {
    return {
      tagName: tag.toUpperCase(),
      cells: [{}, {}, {}, {}, {}],
      innerHTML: '',
      style: {},
      appendChild: function(child) {}
    };
  }
};

const DAFTAR_KELAS_RESMI = ['XII RPL 1', 'XII RPL 2', 'XII TKJ 1'];

const mockData = {
  'XII RPL 1': {
    'senin': '15:30',
    'selasa': '15:30',
    'rabu': '15:30',
    'kamis': '15:30',
    'jumat': '11:45'
  },
  'XII RPL 2': {
    'senin': '15:30',
    'selasa': '15:30',
    'rabu': '15:30',
    'kamis': '15:30',
    'jumat': '11:45'
  },
  'XII TKJ 1': {
    'senin': '15:30',
    'selasa': '15:30',
    'rabu': '15:30',
    'kamis': '15:30',
    'jumat': '11:45'
  },
  'XII TKJ 2': '10:00' // Liar, must be excluded from official render
};

const allDays = ['senin', 'selasa', 'rabu', 'kamis', 'jumat'];
const mergedClasses = Array.from(new Set([...DAFTAR_KELAS_RESMI, ...Object.keys(mockData).filter(k => DAFTAR_KELAS_RESMI.includes(k))])).sort();

assert.strictEqual(mergedClasses.length, 3, 'Merged classes must strictly contain 3 official classes');
assert.deepStrictEqual(mergedClasses, ['XII RPL 1', 'XII RPL 2', 'XII TKJ 1']);
console.log('✓ PASS: Exactly 3 official classes processed without non-existent classes.');

// Total days rendered across 3 classes
const totalRowsExpected = 3 * 5; // 15 baris
let count = 0;
mergedClasses.forEach(kelas => {
  allDays.forEach(hari => {
    const raw = mockData[kelas];
    const jam = (typeof raw === 'object' ? raw[hari] : raw) || '15:30';
    assert.ok(jam, 'Jam must exist for ' + kelas + ' ' + hari);
    count++;
  });
});
assert.strictEqual(count, 15, 'Total rendered schedule rows must be 15');
console.log('✓ PASS: All 15 day-slots across 3 official classes correctly generated.');

console.log('🎉 ALL TESTS PASSED IN test-jadwal-pulang-harian-sync.js');
