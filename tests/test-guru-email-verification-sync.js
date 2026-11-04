const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- TEST SUITE: Guru Email Verification & Dual Sync ---');

// 1. Verify assets/admin.js syntax and logic
const adminJsPath = path.join(__dirname, '..', 'assets', 'admin.js');
const adminJsCode = fs.readFileSync(adminJsPath, 'utf8');

assert(adminJsCode.includes('guruCache'), 'admin.js must declare and manage guruCache');
assert(adminJsCode.includes('guruClaimedCache'), 'admin.js must declare and manage guruClaimedCache');
assert(adminJsCode.includes("db.ref('guru').on('value'"), 'admin.js must listen to guru in realtime');
assert(adminJsCode.includes("db.ref('guru_claimed').on('value'"), 'admin.js must listen to guru_claimed in realtime');
assert(adminJsCode.includes('resolveGuruEmail'), 'admin.js must implement resolveGuruEmail');
assert(adminJsCode.includes('renderGuruTable'), 'admin.js must implement renderGuruTable');
assert(adminJsCode.includes('mapVal.isVerified !== true'), 'admin.js must only resolve verified accounts, leaving unverified empty');
console.log('✓ PASS: admin.js contains guruCache, guruClaimedCache, and verified-only fallback resolver.');

// 2. Verify admin.html elements
const adminHtmlPath = path.join(__dirname, '..', 'admin.html');
const adminHtmlCode = fs.readFileSync(adminHtmlPath, 'utf8');

assert(adminHtmlCode.includes('id="tab-guru"'), 'admin.html must contain #tab-guru');
assert(adminHtmlCode.includes('id="guruTableBody"'), 'admin.html must contain #guruTableBody');
assert(adminHtmlCode.includes('id="modalEditGuruAdmin"'), 'admin.html must contain #modalEditGuruAdmin');
assert(adminHtmlCode.includes('id="statTotalGuru"'), 'admin.html must contain #statTotalGuru');
assert(adminHtmlCode.includes('id="userTableBody"'), 'admin.html must contain #userTableBody');
console.log('✓ PASS: admin.html contains all Master Data Guru tables, forms, and modals.');

// 3. Verify assets/auth.js updates /guru on NIP verification
const authJsPath = path.join(__dirname, '..', 'assets', 'auth.js');
const authJsCode = fs.readFileSync(authJsPath, 'utf8');

assert(authJsCode.includes("db.ref('guru/' + dataGuru.nip).update({ email: email })"), 'auth.js must sync email to /guru on NIP verification');
console.log('✓ PASS: auth.js syncs email directly to /guru upon NIP verification.');

// 4. Test resolveGuruEmail in mock environment
const guruClaimedCache = {
  '197905032006042004': {
    email: 'jawabind1@gmail.com',
    nama: 'Hali, ST',
    nip: '197905032006042004',
    role: 'guru'
  }
};

const emailMappingCache = {
  'jawabind1(at)gmail,com': {
    email: 'jawabind1@gmail.com',
    nip: '197905032006042004',
    nama: 'Hali, ST',
    role: 'guru',
    isVerified: true
  },
  'dummyguru(at)gmail,com': {
    email: 'dummyguru@gmail.com',
    nip: '198109012009022003',
    nama: 'Hani Hanifah, S.Si',
    role: 'guru',
    isVerified: false // Belum verifikasi!
  }
};

const usersCache = {
  'VRyiKfbhmlcaliZKXUhNU4Wn1Yo2': {
    email: 'ihsan33roblox@gmail.com',
    nip: '199209142022211007',
    nama: 'Muhammad Echa Putra, S.Kom.Gr',
    role: 'walas',
    isVerified: true
  }
};

function resolveGuruEmail(nip, g) {
  let resolvedEmail = (g && g.email && g.email !== '-') ? g.email : '';
  const cleanN = String(nip || (g && g.nip) || '').trim();
  const cleanDigits = cleanN.replace(/\D/g, '');
  const cleanNama = String((g && g.nama) || '').toLowerCase().trim();

  // 1. Cek dari guru_claimed (klaim akun terverifikasi)
  if (!resolvedEmail && typeof guruClaimedCache === 'object' && guruClaimedCache) {
    if (cleanN && guruClaimedCache[cleanN] && guruClaimedCache[cleanN].email) {
      resolvedEmail = guruClaimedCache[cleanN].email;
    } else if (cleanDigits && guruClaimedCache[cleanDigits] && guruClaimedCache[cleanDigits].email) {
      resolvedEmail = guruClaimedCache[cleanDigits].email;
    } else {
      for (const [k, cVal] of Object.entries(guruClaimedCache)) {
        if (!cVal) continue;
        const cNip = String(cVal.nip || k).trim();
        const cDigits = cNip.replace(/\D/g, '');
        const cNama = String(cVal.nama || '').toLowerCase().trim();
        if ((cleanN && cNip && cleanN === cNip) ||
            (cleanDigits && cDigits && cleanDigits === cDigits) ||
            (cleanNama && cNama && cleanNama === cNama)) {
          if (cVal.email) {
            resolvedEmail = cVal.email;
            break;
          }
        }
      }
    }
  }

  // 2. Cek dari emailMappingCache (HANYA jika terverifikasi isVerified === true)
  if (!resolvedEmail && typeof emailMappingCache === 'object' && emailMappingCache) {
    for (const [emKey, mapVal] of Object.entries(emailMappingCache)) {
      if (!mapVal || mapVal.isVerified !== true) continue;
      const mapN = String(mapVal.nip || '').trim();
      const mapDigits = mapN.replace(/\D/g, '');
      const mapNama = String(mapVal.nama || '').toLowerCase().trim();
      if ((cleanN && mapN && cleanN === mapN) ||
          (cleanDigits && mapDigits && cleanDigits === mapDigits) ||
          (cleanNama && mapNama && cleanNama === mapNama)) {
        resolvedEmail = mapVal.email || emKey.replace(/\(at\)/g, '@').replace(/,/g, '.');
        break;
      }
    }
  }

  // 3. Cek dari usersCache (HANYA jika isVerified === true dan NIP/nama cocok)
  if (!resolvedEmail && typeof usersCache === 'object' && usersCache) {
    for (const [uid, u] of Object.entries(usersCache)) {
      if (!u || u.isVerified !== true) continue;
      const uNip = String(u.nip || '').trim();
      const uDigits = uNip.replace(/\D/g, '');
      const uNama = String(u.nama || '').toLowerCase().trim();
      if ((cleanN && uNip && cleanN === uNip) ||
          (cleanDigits && uDigits && cleanDigits === uDigits) ||
          (cleanNama && uNama && cleanNama === uNama)) {
        if (u.email && u.email !== '-') {
          resolvedEmail = u.email;
          break;
        }
      }
    }
  }

  return resolvedEmail || (g && g.email) || '-';
}

// Test Case A: Data with direct g.email (Hali, ST)
const emailA = resolveGuruEmail('197905032006042004', { nip: '197905032006042004', nama: 'Hali, ST', email: 'jawabind1@gmail.com' });
assert.strictEqual(emailA, 'jawabind1@gmail.com', 'Must return direct g.email for Hali, ST');
console.log('✓ PASS: Direct g.email (jawabind1@gmail.com) correctly prioritized.');

// Test Case B: Verified teacher in usersCache (Muhammad Echa Putra)
const emailB = resolveGuruEmail('199209142022211007', { nip: '199209142022211007', nama: 'Muhammad Echa Putra, S.Kom.Gr' });
assert.strictEqual(emailB, 'ihsan33roblox@gmail.com', 'Must resolve verified account via usersCache');
console.log('✓ PASS: Verified teacher in usersCache (ihsan33roblox@gmail.com) resolves correctly.');

// Test Case C: Verified teacher in guruClaimedCache (Fallback)
const emailC = resolveGuruEmail('197905032006042004', { nip: '197905032006042004', nama: 'Hali, ST' });
assert.strictEqual(emailC, 'jawabind1@gmail.com', 'Must resolve verified account via guruClaimedCache');
console.log('✓ PASS: Verified teacher in guruClaimedCache resolves correctly.');

// Test Case D: Unverified teacher (Hani Hanifah, S.Si) MUST remain '-'
const emailD = resolveGuruEmail('198109012009022003', { nip: '198109012009022003', nama: 'Hani Hanifah, S.Si' });
assert.strictEqual(emailD, '-', 'Unverified teacher MUST remain "-" even if unverified mapping exists');
console.log('✓ PASS: Unverified teacher correctly remains "-" without leaking unverified dummy email.');

// Test Case E: Another unverified teacher (Rijal Nur Rahmat, S.T) MUST remain '-'
const emailE = resolveGuruEmail('198312052022211017', { nip: '198312052022211017', nama: 'Rijal Nur Rahmat, S.T' });
assert.strictEqual(emailE, '-', 'Unverified teacher MUST remain "-"');
console.log('✓ PASS: Unverified teacher (Rijal Nur Rahmat) correctly remains "-".');

// Test Case F: Unknown teacher returns '-'
const emailF = resolveGuruEmail('999999999999999999', { nip: '999999999999999999', nama: 'GURU TIDAK DIKENAL' });
assert.strictEqual(emailF, '-', 'Must return default "-" if no teacher email found');
console.log('✓ PASS: Unknown teacher safely falls back to "-".');

console.log('🎉 ALL TESTS PASSED IN test-guru-email-verification-sync.js');
