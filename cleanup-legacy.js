/**
 * VokaLog Legacy Workspace Cleanup Script
 * Safely removes 35 legacy files/directories from the old RFID prototype,
 * while preserving assets/logo-nesas.png, assets/logo-rpl.png, and assets/foto/
 */

const fs = require('fs');
const path = require('path');

const rootDir = __dirname;

const legacyTargets = [
  // Legacy directories
  'iot',
  'scripts/data-riwayat-setahun.json',
  'scripts/generate-riwayat-setahun.js',
  'scripts/seed-data-siswa.js',
  'tests',
  
  // Legacy root documentation & HTML
  'CARA-UPLOAD-FOTO.md',
  'admin-login.html',
  'admin.html',
  'dashboard-guru.html',
  'dashboard.html',
  'debug-siswa.html',
  'index.html',
  'presensi-live.html',
  'siswa-clean-firebase.json', // Migrated to seed/roster-data.json

  // Legacy assets (keeping logo-nesas.png, logo-rpl.png, foto/)
  'assets/admin-login.js',
  'assets/admin.css',
  'assets/admin.js',
  'assets/auth.js',
  'assets/dashboard-guru.js',
  'assets/dashboard.js',
  'assets/data-siswa.json',
  'assets/firebase-config.js',
  'assets/jadwal-util.js',
  'assets/login.js',
  'assets/perijinan.js',
  'assets/presensi-live.css',
  'assets/presensi-live.js',
  'assets/profile-modal.js',
  'assets/style.css',
  'assets/three.min.js',
];

let removedCount = 0;
for (const target of legacyTargets) {
  const fullPath = path.join(rootDir, target);
  if (fs.existsSync(fullPath)) {
    try {
      fs.rmSync(fullPath, { recursive: true, force: true });
      console.log(`[Cleaned] ${target}`);
      removedCount++;
    } catch (err) {
      console.error(`[Error removing ${target}]:`, err.message);
    }
  } else {
    console.log(`[Already removed/not found] ${target}`);
  }
}

// Remove empty scripts directory if empty
const scriptsDir = path.join(rootDir, 'scripts');
if (fs.existsSync(scriptsDir) && fs.readdirSync(scriptsDir).length === 0) {
  fs.rmdirSync(scriptsDir);
  console.log('[Cleaned] empty scripts/ directory');
}

console.log(`\nCleanup complete. Total targets removed: ${removedCount}`);
console.log('Safeguarded assets verified:');
console.log('  assets/logo-nesas.png:', fs.existsSync(path.join(rootDir, 'assets/logo-nesas.png')));
console.log('  assets/logo-rpl.png:  ', fs.existsSync(path.join(rootDir, 'assets/logo-rpl.png')));
console.log('  seed/roster-data.json:', fs.existsSync(path.join(rootDir, 'seed/roster-data.json')));
