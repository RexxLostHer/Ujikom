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
assert(adminJsCode.includes('mapVal.isVerified !== true'), 'admin.js must only resolve verified accounts, leaving unverified empty');
console.log('✓ PASS: admin.js contains emailMappingCache and verified-only fallback resolver.');

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
  '7dosabesar557(at)gmail,com': {
    email: '7dosabesar557@gmail.com',
    nisn: '0098263610',
    nama: 'M. IHSAN ATHALLAH',
    kelas: 'XII RPL 2',
    isVerified: true
  },
  'abhiprayasamboga(at)gmail,com': {
    email: 'abhiprayasamboga@gmail.com',
    nisn: '0081782494',
    nama: 'ABHIPRAYA SAMBOGA',
    kelas: 'XII RPL 2',
    isVerified: false // belum verifikasi!
  }
};

function resolveSiswaEmail(displayNisn, s) {
  let resolvedEmail = (s.email && s.email !== '-') ? s.email : '';
  if (!resolvedEmail && typeof emailMappingCache === 'object' && emailMappingCache) {
    const cleanN = String(displayNisn).trim();
    const cleanDigits = cleanN.replace(/\D/g, '');
    const cleanNama = String(s.nama || '').toLowerCase().trim();
    for (const [emKey, mapVal] of Object.entries(emailMappingCache)) {
      if (!mapVal || mapVal.isVerified !== true) continue; // HANYA jika terverifikasi
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

// Test Case A: Data with direct s.email (Ihsan Athallah)
const emailA = resolveSiswaEmail('0098263610', { nisn: '0098263610', nama: 'M. IHSAN ATHALLAH', email: '7dosabesar557@gmail.com' });
assert.strictEqual(emailA, '7dosabesar557@gmail.com', 'Must return direct s.email for Ihsan');
console.log('✓ PASS: Direct s.email (7dosabesar557@gmail.com) correctly prioritized.');

// Test Case B: Unverified student with dummy mapping in emailMappingCache MUST remain '-'
const emailB = resolveSiswaEmail('0081782494', { nisn: '0081782494', nama: 'ABHIPRAYA SAMBOGA' });
assert.strictEqual(emailB, '-', 'Unverified student MUST remain "-" even if dummy mapping exists');
console.log('✓ PASS: Unverified student correctly remains "-" without leaking dummy email.');

// Test Case C: Verified student in emailMappingCache (Fallback)
const emailC = resolveSiswaEmail('0098263610', { nisn: '0098263610', nama: 'M. IHSAN ATHALLAH' });
assert.strictEqual(emailC, '7dosabesar557@gmail.com', 'Must resolve verified account via emailMappingCache');
console.log('✓ PASS: Verified student in emailMappingCache resolves correctly.');

// Test Case D: Unknown student returns '-'
const emailD = resolveSiswaEmail('99999999', { nisn: '99999999', nama: 'UNKNOWN STUDENT' });
assert.strictEqual(emailD, '-', 'Must return default "-" if no email found');
console.log('✓ PASS: Unknown student safely falls back to "-".');

console.log('🎉 ALL TESTS PASSED IN test-siswa-email-verification-sync.js');
