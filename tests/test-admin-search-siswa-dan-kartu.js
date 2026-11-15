/**
 * Test Suite: Fitur Search Siswa di Admin & Penanganan Kartu RFID Guru/Siswa
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('--- TEST SUITE: SEARCH SISWA ADMIN & PERAPIAN KARTU RFID ---');

// 1. Verifikasi admin.html tidak lagi memiliki admin-user-pill
const adminHtmlPath = path.join(__dirname, '../admin.html');
const adminHtmlContent = fs.readFileSync(adminHtmlPath, 'utf8');

assert.strictEqual(adminHtmlContent.includes('class="admin-user-pill"'), false, 'admin-user-pill harus sudah terhapus dari admin.html');
assert.strictEqual(adminHtmlContent.includes('id="cariSiswaAdmin"'), true, 'Input cariSiswaAdmin harus ada di admin.html');
assert.strictEqual(adminHtmlContent.includes('id="countSiswaAdmin"'), true, 'Counter countSiswaAdmin harus ada di admin.html');
console.log('✓ [Test 1] Header admin pill berhasil dihapus dan elemen search terpasang di admin.html');

// 2. Mock DOM & Verifikasi filterDataSiswaAdminLive
const mockTableBody = {
  innerHTML: '',
  appendChild: function(node) {
    this.rows.push(node);
  },
  rows: []
};

const mockCount = { textContent: '0' };
const mockInput = { value: '' };

global.document = {
  addEventListener: function() {},
  removeEventListener: function() {},
  getElementById: function(id) {
    if (id === 'siswaTableBody') return mockTableBody;
    if (id === 'countSiswaAdmin') return mockCount;
    if (id === 'cariSiswaAdmin') return mockInput;
    if (id === 'kartuTableBody') return { innerHTML: '', appendChild: () => {} };
    if (id === 'kartuNisn' || id === 'simulasiNisn' || id === 'pelajaranKelas') {
      return { innerHTML: '', appendChild: () => {}, options: [] };
    }
    return null;
  },
  createElement: function(tag) {
    return {
      tagName: tag,
      cells: [
        { appendChild: () => {} },
        { appendChild: () => {} },
        { appendChild: () => {} },
        { appendChild: () => {} },
        { appendChild: () => {} }
      ],
      appendChild: function() {}
    };
  }
};

const { renderSiswaTable, filterDataSiswaAdminLive, renderKartuTable } = require('../assets/admin.js');

const mockSiswaData = {
  '0098263610': { nisn: '0098263610', nama: 'M. IHSAN ATHALLAH', kelas: 'XII RPL 2', email: '7dosabesar557@gmail.com' },
  '0082104129': { nisn: '0082104129', nama: 'RIZKY RAMADANI', kelas: 'XII RPL 2', email: '' },
  '0091113849': { nisn: '0091113849', nama: 'AHSAN MAHMUD FAUZI YUSRY', kelas: 'XII RPL 1', email: '' }
};

// Test render tanpa filter
global.siswaCache = mockSiswaData;
renderSiswaTable(mockSiswaData);
assert.strictEqual(mockCount.textContent, 3, 'Total siswa sebelum filter harus 3');
console.log('✓ [Test 2] renderSiswaTable() berhasil menampilkan seluruh siswa (count: 3)');

// Test filter pencarian NISN
mockInput.value = '0098263610';
filterDataSiswaAdminLive();
assert.strictEqual(mockCount.textContent, 1, 'Pencarian NISN 0098263610 harus menyisakan 1 siswa');
console.log('✓ [Test 3] filterDataSiswaAdminLive() dengan pencarian NISN akurat (count: 1)');

// Test filter pencarian Nama (case-insensitive)
mockInput.value = 'hsan';
filterDataSiswaAdminLive();
assert.strictEqual(mockCount.textContent, 2, 'Pencarian nama "hsan" harus menemukan M. Ihsan dan Ahsan Mahmud (count: 2)');
console.log('✓ [Test 4] filterDataSiswaAdminLive() dengan pencarian nama case-insensitive akurat (count: 2)');

// Test filter tidak ditemukan
mockInput.value = 'xyz999';
filterDataSiswaAdminLive();
assert.strictEqual(mockCount.textContent, 0, 'Pencarian tidak ada harus menghasilkan 0');
assert.strictEqual(mockTableBody.innerHTML.includes('Tidak ada siswa yang sesuai'), true, 'Empty state khusus pencarian harus muncul');
console.log('✓ [Test 5] filterDataSiswaAdminLive() empty state berfungsi dengan baik');

// 3. Test renderKartuTable dengan kartu guru
const mockKartuData = {
  'E5F6A7B8': { uid: 'E5F6A7B8', nip: '198109012009022003', tipe: 'guru', nama: 'Hani Hanifah, S.Si' }
};
global.guruCache = {
  '198109012009022003': { nip: '198109012009022003', nama: 'Hani Hanifah, S.Si' }
};

let capturedKartuRows = [];
const mockKartuBody = {
  innerHTML: '',
  appendChild: function(tr) { capturedKartuRows.push(tr); }
};
global.document.getElementById = function(id) {
  if (id === 'kartuTableBody') return mockKartuBody;
  return null;
};

renderKartuTable(mockKartuData);
assert.strictEqual(capturedKartuRows.length, 1, 'Harus ada 1 row kartu terdaftar');
assert.strictEqual(capturedKartuRows[0].innerHTML.includes('Hani Hanifah, S.Si'), true, 'Nama guru harus ter-resolve dan bukan "(tidak ditemukan)"');
assert.strictEqual(capturedKartuRows[0].innerHTML.includes('GURU'), true, 'Badge GURU harus ditampilkan');
console.log('✓ [Test 6] renderKartuTable() berhasil me-resolve kartu guru tanpa fallback "(tidak ditemukan)"');

console.log('🎉 SEMUA PENGUJIAN SEARCH SISWA & KARTU RFID LULUS 100%!');
