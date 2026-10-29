const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const testDir = path.join(__dirname);
const testFiles = fs.readdirSync(testDir).filter(f => f.startsWith('test-') && f.endsWith('.js'));

console.log(`Menjalankan total ${testFiles.length} berkas test suites...\n`);

let passedCount = 0;
let failedCount = 0;
const failures = [];

testFiles.forEach((file, idx) => {
  const filePath = path.join(testDir, file);
  try {
    execSync(`node "${filePath}"`, { stdio: 'pipe', encoding: 'utf8', timeout: 30000 });
    passedCount++;
    console.log(`[PASS ${passedCount}/${testFiles.length}] ${file}`);
  } catch (err) {
    failedCount++;
    failures.push({ file, err: err.stderr || err.stdout || err.message });
    console.log(`[FAIL] ${file}`);
  }
});

console.log('\n================================================================');
console.log(`RINGKASAN PENGUJIAN: ${passedCount} LULUS, ${failedCount} GAGAL dari total ${testFiles.length} tests.`);
console.log('================================================================');

if (failures.length > 0) {
  console.log('\nDetail kegagalan:');
  failures.forEach(f => {
    console.log(`--- ${f.file} ---`);
    console.log(f.err.slice(0, 500));
  });
  process.exit(1);
} else {
  console.log('🎉 SELURUH TEST SUITES LULUS 100%!');
}
