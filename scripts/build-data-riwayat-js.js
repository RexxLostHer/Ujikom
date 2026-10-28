const fs = require('fs');
const path = require('path');

const jsonPath = path.join(__dirname, 'data-riwayat-setahun.json');
const outPath = path.join(__dirname, '..', 'assets', 'data-riwayat-setahun.js');

const raw = fs.readFileSync(jsonPath, 'utf8');
const content = `/**
 * DATA HISTORIS PRESENSI 1 TAHUN TERAKHIR (TA 2025/2026)
 * Presensia IoT - SMK Negeri 1 Sumedang
 */
(function() {
  'use strict';
  const data = ${raw.trim()};
  if (typeof window !== 'undefined') window.DATA_RIWAYAT_SETAHUN = data;
  if (typeof global !== 'undefined') global.DATA_RIWAYAT_SETAHUN = data;
  if (typeof module !== 'undefined' && module.exports) module.exports = data;
})();
`;

fs.writeFileSync(outPath, content, 'utf8');
console.log('Successfully generated assets/data-riwayat-setahun.js:', fs.statSync(outPath).size, 'bytes');
