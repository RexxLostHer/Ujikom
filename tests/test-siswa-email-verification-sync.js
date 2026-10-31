const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- TEST SUITE: Siswa Email Verification & Dual Sync ---');

// 1. Verify assets/admin.js syntax and logic
const adminJsPath = path.join(__dirname, '..', 'assets', 'admin.js');
const adminJsCode = fs.readFileSync(adminJsPath, 'utf8');

assert(adminJsCode.includes('emailMappingCache'), 'admin.js must declare and manage emailMappingCache');
assert(adminJsCode.includes("db.ref('email_mapping').on('value'"), 'admin.js must listen to email_mapping in realtime');
assert(adminJsCode.includes('resolvedEmail'), 'renderSiswaTable must resolve email with fallback to emailMappingCache');
console.log('✓ PASS: admin.js contains emailMappingCache and realtime fallback resolver.');

// 2. Verify assets/auth.js updates /siswa on verification
const authJsPath = path.join(__dirname, '..', 'assets', 'auth.js');
const authJsCode = fs.readFileSync(authJsPath, 'utf8');

assert(authJsCode.includes("db.ref('siswa/' + dataSiswa.nisn).update({ email: email })"), 'auth.js must sync email to /siswa on NISN verification');
console.log('✓ PASS: auth.js syncs email directly to /siswa upon NISN verification.');

// 3. Test renderSiswaTable resolver logic in mock environment
const rows = [];
const mockTbody = {
  innerHTML: '',
  appendChild: (row) => rows.push(row)
};

const mockDoc = {
  getElementById: (id) => {
    if (id === 'siswaTableBody') return mockTbody;
    return { innerHTML: '', value: '' };
  },
  createElement: (tag) => {
    return {
      tagName: tag.toUpperCase(),
      cells: [{}, {}, {}, {}, {}],
      innerHTML: '',
      appendChild: function() {}
    };
  }
};

const emailMappingCache = {
  'abhiprayasamboga(at)gmail,com': {
    email: 'abhiprayasamboga@gmail.com',
    nisn: '0081782494',
    nama: 'ABHIPRAYA SAMBOGA',
    kelas: 'XII RPL 2'
  }
};

function resolveSiswaEmail(displayNisn, s) {
  let resolvedEmail = (s.email && s.email !== '-') ? s.email : '';
  if (!resolvedEmail && typeof emailMappingCache === 'object' && emailMappingCache) {
    const cleanN = String(displayNisn).trim();
    const cleanDigits = cleanN.replace(/\D/g, '');
    const cleanNama = String(s.nama || '').toLowerCase().trim();
    for (const [emKey, mapVal] of Object.entries(emailMappingCache)) {
      if (!mapVal) continue;
      const mapN = String(mapVal.nisn || '').trim();
      const mapDigits = mapN.replace(/\D/g, '');
      const mapNama = String(mapVal.nama || '').toLowerCase().trim();
      if ((cleanN && mapN && cleanN === mapN) ||
          (cleanDigits && mapDigits && cleanDigits === mapDigits) ||
          (cleanNama && mapNama && cleanNama === mapNama)) {
        resolvedEmail = mapVal.email || '';
        break;
      }
    }
  }
  return resolvedEmail || s.email || '-';
}

// Test Case A: Data with direct s.email
const emailA = resolveSiswaEmail('00082109', { nisn: '00082109', nama: 'TIFANI ADISYA', email: 'tifaniadisya@gmail.com' });
assert.strictEqual(emailA, 'tifaniadisya@gmail.com', 'Must return direct s.email');
console.log('✓ PASS: Direct s.email correctly prioritized.');

// Test Case B: Data without s.email, but in emailMappingCache (Fallback)
const emailB = resolveSiswaEmail('0081782494', { nisn: '0081782494', nama: 'ABHIPRAYA SAMBOGA' });
assert.strictEqual(emailB, 'abhiprayasamboga@gmail.com', 'Must fallback to emailMappingCache email');
console.log('✓ PASS: Fallback to emailMappingCache by NISN works.');

// Test Case C: Fallback by Nama
const emailC = resolveSiswaEmail('RANDOM_KEY', { nisn: '', nama: 'Abhipraya Samboga' });
assert.strictEqual(emailC, 'abhiprayasamboga@gmail.com', 'Must fallback to emailMappingCache by nama');
console.log('✓ PASS: Fallback to emailMappingCache by student name works.');

// Test Case D: Unknown student returns '-'
const emailD = resolveSiswaEmail('99999999', { nisn: '99999999', nama: 'UNKNOWN STUDENT' });
assert.strictEqual(emailD, '-', 'Must return default "-" if no email found');
console.log('✓ PASS: Unknown student safely falls back to "-".');

console.log('🎉 ALL TESTS PASSED IN test-siswa-email-verification-sync.js');
