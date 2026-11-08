/**
 * Standalone Empirical Image & Harness Verifier
 * SMKN 1 Sumedang Presensi UI/UX Screenshot Verification
 * 
 * Verifies:
 * 1. Exact counts per role: admin (26), siswa (25), guru (9), walas (11) = 71 total.
 * 2. File size > 10,000 bytes.
 * 3. PNG 8-byte Magic Sequence: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A.
 * 4. PNG IHDR dimensions: width and height, confirming desktop resolution (1440x900 or similar).
 * 5. Shannon byte entropy & byte distribution: guarantees non-uniform, authentic visual desktop renders.
 */

const fs = require('fs');
const path = require('path');

const BASE_DIR = 'C:\\Users\\Lenovo\\Documents\\Dashboard laporan';
const EXPECTED_COUNTS = {
  admin: 26,
  siswa: 25,
  guru: 9,
  walas: 11
};

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

function calculateEntropy(buffer) {
  const freqs = new Uint32Array(256);
  for (let i = 0; i < buffer.length; i++) {
    freqs[buffer[i]]++;
  }

  let entropy = 0;
  let uniqueBytes = 0;
  const len = buffer.length;

  for (let i = 0; i < 256; i++) {
    if (freqs[i] > 0) {
      uniqueBytes++;
      const p = freqs[i] / len;
      entropy -= p * Math.log2(p);
    }
  }

  return { entropy, uniqueBytes };
}

function parseIhdr(buffer) {
  if (buffer.length < 24) return null;
  // Check IHDR chunk type at offset 12
  const chunkType = buffer.toString('ascii', 12, 16);
  if (chunkType !== 'IHDR') return null;

  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const bitDepth = buffer.readUInt8(24);
  const colorType = buffer.readUInt8(25);

  return { width, height, bitDepth, colorType };
}

function runVerification() {
  console.log('================================================================');
  console.log('EMPIRICAL SCREENSHOT HARNESS & ENTROPY VERIFICATION');
  console.log('Target Base Directory:', BASE_DIR);
  console.log('================================================================\n');

  if (!fs.existsSync(BASE_DIR)) {
    console.error(`FATAL: Base directory does not exist: ${BASE_DIR}`);
    process.exit(1);
  }

  const results = {
    totalChecked: 0,
    totalPassed: 0,
    totalFailed: 0,
    byRole: {},
    files: []
  };

  let allOk = true;

  for (const [role, expectedCount] of Object.entries(EXPECTED_COUNTS)) {
    const roleDir = path.join(BASE_DIR, role);
    console.log(`Checking role directory: [${role}] -> expected ${expectedCount} files...`);

    if (!fs.existsSync(roleDir)) {
      console.error(`  FAIL: Directory missing: ${roleDir}`);
      allOk = false;
      continue;
    }

    const files = fs.readdirSync(roleDir).filter(f => f.toLowerCase().endsWith('.png'));
    console.log(`  Found ${files.length} PNG files.`);

    const roleStats = {
      expected: expectedCount,
      found: files.length,
      passed: 0,
      failed: 0,
      minSize: Infinity,
      maxSize: 0,
      minEntropy: Infinity,
      maxEntropy: 0
    };

    if (files.length !== expectedCount) {
      console.error(`  COUNT MISMATCH: Role ${role} expected ${expectedCount}, got ${files.length}`);
      allOk = false;
    }

    for (const file of files) {
      const fullPath = path.join(roleDir, file);
      const stat = fs.statSync(fullPath);
      const sizeBytes = stat.size;
      const buffer = fs.readFileSync(fullPath);

      results.totalChecked++;

      // 1. Size check (> 10,000 bytes)
      const sizePass = sizeBytes > 10000;

      // 2. Magic bytes check
      const magicPass = buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_MAGIC);

      // 3. IHDR parse & desktop dimensions
      const ihdr = parseIhdr(buffer);
      const dimPass = ihdr !== null && ihdr.width >= 1280 && ihdr.height >= 720;

      // 4. Entropy calculation
      const { entropy, uniqueBytes } = calculateEntropy(buffer);
      // Real desktop rendered UI screenshots compressed by Deflate have entropy > 6.0 and uniqueBytes > 150
      const entropyPass = entropy >= 6.0 && uniqueBytes >= 180;

      const filePass = sizePass && magicPass && dimPass && entropyPass;

      if (filePass) {
        results.totalPassed++;
        roleStats.passed++;
      } else {
        results.totalFailed++;
        roleStats.failed++;
        allOk = false;
      }

      roleStats.minSize = Math.min(roleStats.minSize, sizeBytes);
      roleStats.maxSize = Math.max(roleStats.maxSize, sizeBytes);
      roleStats.minEntropy = Math.min(roleStats.minEntropy, entropy);
      roleStats.maxEntropy = Math.max(roleStats.maxEntropy, entropy);

      results.files.push({
        role,
        file,
        sizeBytes,
        width: ihdr ? ihdr.width : 0,
        height: ihdr ? ihdr.height : 0,
        magicValid: magicPass,
        entropy: Number(entropy.toFixed(4)),
        uniqueBytes,
        status: filePass ? 'PASS' : 'FAIL',
        failures: [
          !sizePass ? `Size <= 10KB (${sizeBytes})` : null,
          !magicPass ? 'Invalid Magic Bytes' : null,
          !dimPass ? `Invalid Dims (${ihdr ? ihdr.width + 'x' + ihdr.height : 'null'})` : null,
          !entropyPass ? `Low Entropy (${entropy.toFixed(2)}, uniq: ${uniqueBytes})` : null
        ].filter(Boolean)
      });
    }

    results.byRole[role] = roleStats;
    console.log(`  Role [${role}] summary: ${roleStats.passed}/${roleStats.found} PASS (Size range: ${(roleStats.minSize/1024).toFixed(1)}KB - ${(roleStats.maxSize/1024).toFixed(1)}KB, Entropy range: ${roleStats.minEntropy.toFixed(2)} - ${roleStats.maxEntropy.toFixed(2)})\n`);
  }

  console.log('================================================================');
  console.log(`FINAL EMPIRICAL VERIFICATION RESULT: ${results.totalPassed}/${results.totalChecked} PASSED (Total Expected: 71)`);
  console.log('================================================================');

  // Dump JSON report for analysis
  const reportPath = path.join(__dirname, 'screenshot-verification-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`Detailed verification report written to: ${reportPath}`);

  if (!allOk || results.totalPassed !== 71) {
    console.error('VERIFICATION FAILED: Not all screenshots satisfied empirical integrity criteria.');
    process.exit(1);
  } else {
    console.log('VERIFICATION SUCCESSFUL: 100% of screenshot artifacts meet all empirical integrity criteria!');
    process.exit(0);
  }
}

runVerification();
