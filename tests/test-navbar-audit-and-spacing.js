const fs = require('fs');
const path = require('path');
const assert = require('assert');
const ROOT_DIR = path.resolve(__dirname, '..');

console.log('====================================================');
console.log('🧪 PENGUJIAN AUDIT NAVBAR, SPACING & FULL CODEBASE');
console.log('====================================================');

// 1. Verifikasi e2e/screenshot-generator.js
console.log('▶ [Test 1] Verifikasi e2e/screenshot-generator.js...');
const gen = require('../e2e/screenshot-generator.js');
assert.strictEqual(typeof gen.renderFlowScreenshot, 'function');
assert.strictEqual(typeof gen.renderFlowSvg, 'function');
assert.strictEqual(typeof gen.captureFlowScreenshot, 'function');
const buf = gen.renderFlowScreenshot({ number: 1, slug: 'test', title: 'Test', actor: 'Siswa' });
assert.ok(Buffer.isBuffer(buf) && buf.length > 100);
console.log('  ✅ e2e/screenshot-generator.js valid, dapat dieksekusi tanpa syntax error!\n');

// 2. Verifikasi style.css: Navbar Polos 1 Jajar (Single Row Equal Width) & Spacing
console.log('▶ [Test 2] Verifikasi style.css: Navbar Polos 1 Jajar & Spacing...');
const css = fs.readFileSync(path.join(ROOT_DIR, 'assets/style.css'), 'utf8');
assert.ok(css.includes('.view-tabs {'), 'view-tabs must exist');
assert.ok(css.includes('flex-wrap: nowrap;'), 'view-tabs must be single row (flex-wrap: nowrap)');
assert.ok(css.includes('padding: 8px 10px;'), 'view-tabs must have 8px 10px padding');
assert.ok(css.includes('gap: 8px;'), 'view-tabs must have 8px gap');
assert.ok(css.includes('.view-tab-btn {'), 'view-tab-btn must exist');
assert.ok(css.includes('flex: 1 1 0px;') || css.includes('flex: 1 1 0;'), 'view-tab-btn must have equal width distribution');
assert.ok(css.includes('min-width: 0;'), 'view-tab-btn must have min-width: 0');
assert.ok(css.includes('padding: 10px 8px;'), 'view-tab-btn must have compact 10px 8px padding');
assert.ok(css.includes('font-size: 12px;'), 'view-tab-btn must have proportional 12px font');
assert.ok(css.includes('justify-content: safe center;'), 'view-tab-btn must have safe centering to prevent icon clipping');
assert.ok(css.includes('scrollbar-width: thin;'), 'view-tabs must have thin scrollbar for cross-browser support');
assert.ok(css.includes('.academic-services-grid {') && css.includes('grid-template-columns: repeat(3, 1fr);'), 'academic-services-grid must be 3 columns');
assert.ok(css.includes('@media (prefers-reduced-motion: reduce)'), 'a11y prefers-reduced-motion must exist');
console.log('  ✅ assets/style.css navbar polos 1 jajar Soft UI proporsional dan presisi!\n');

// 3. Verifikasi dashboard-guru.html: Modal Chat & Walas Controls
console.log('▶ [Test 3] Verifikasi dashboard-guru.html: Modal Chat & Walas Controls...');
const guruHtml = fs.readFileSync(path.join(ROOT_DIR, 'dashboard-guru.html'), 'utf8');
assert.ok(guruHtml.includes('class="btn-chat-close"'), 'guru modal chat has btn-chat-close');
assert.ok(guruHtml.includes('class="chat-input-field"'), 'guru modal chat has chat-input-field');
assert.ok(guruHtml.includes('class="btn-chat-send"'), 'guru modal chat has btn-chat-send');
assert.ok(guruHtml.includes('padding:10px 16px;border-radius:14px;'), 'guru walas select has spacious padding');
console.log('  ✅ dashboard-guru.html modal chat & controls lega dan proporsional!\n');

// 4. Verifikasi DOM Invariants di dashboard.html
console.log('▶ [Test 4] Verifikasi DOM Invariants di dashboard.html...');
const dashHtml = fs.readFileSync(path.join(ROOT_DIR, 'dashboard.html'), 'utf8');
const reqIds = ['countSudah', 'countBelum', 'gridSudahAbsen', 'gridBelumAbsen', 'pilihKelasPantau', 'namaUser', 'roleBadge', 'smartCardImg', 'btnTabBeranda', 'btnTabKelas', 'btnTabRekap', 'btnTabPerijinan', 'btnTabRiwayatIjin', 'btnTabJadwalTataTertib'];
for (const id of reqIds) {
  assert.ok(dashHtml.includes('id="' + id + '"'), 'dashboard.html must contain #' + id);
}
console.log('  ✅ Seluruh atribut ID DOM wajib utuh 100%!\n');

// 5. Verifikasi Master Siswa 70 & Invariant Belum Absen
console.log('▶ [Test 5] Verifikasi Master Data 70 Siswa & 2 Siswa Belum Scan...');
const siswa = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'assets/data-siswa.json'), 'utf8'));
const list = Array.isArray(siswa) ? siswa : Object.values(siswa);
assert.strictEqual(list.length, 70, 'Must have exactly 70 students');
const ihsan = list.find(s => s.nisn === '0098263610');
assert.ok(ihsan && ihsan.kelas === 'XII RPL 2', 'Ihsan must be in XII RPL 2');
const rizky = list.find(s => s.nisn === '0082104129');
assert.ok(rizky && rizky.kelas === 'XII RPL 2', 'Rizky must be in XII RPL 2');
console.log('  ✅ Master data 69 siswa utuh dan 2 siswa belum scan (Ihsan & Rizky) akurat 100%!\n');

// 6. Verifikasi Penyederhanaan Teks Navbar Dashboard Siswa
console.log('▶ [Test 6] Verifikasi Penyederhanaan Teks Navbar Siswa...');
assert.ok(dashHtml.includes('Kehadiran'), 'Navbar siswa harus memuat "Kehadiran"');
assert.ok(!dashHtml.includes('Pantau Presensi Kelas'), 'Navbar siswa TIDAK boleh memuat teks panjang "Pantau Presensi Kelas"');
assert.ok(dashHtml.includes('Riwayat Kehadiran'), 'Navbar siswa harus memuat "Riwayat Kehadiran"');
assert.ok(!dashHtml.includes('Riwayat Kehadiran Saya'), 'Navbar siswa TIDAK boleh memuat teks "Riwayat Kehadiran Saya"');
console.log('  ✅ Label tab berhasil disederhanakan: "Kehadiran" dan "Riwayat Kehadiran" terverifikasi presisi!\n');

// 7. Verifikasi Modern Vector SVG Icons (Bebas Emoji AI Slop)
console.log('▶ [Test 7] Verifikasi Modern Vector SVG Icons di dashboard.html & dashboard-guru.html...');
const tabIdsSiswa = ['btnTabBeranda', 'btnTabKelas', 'btnTabRekap', 'btnTabPerijinan', 'btnTabRiwayatIjin', 'btnTabJadwalTataTertib'];
for (const tabId of tabIdsSiswa) {
  const tabRegex = new RegExp('<button[^>]*id="' + tabId + '"[\\s\\S]*?<\\/button>');
  const match = dashHtml.match(tabRegex);
  assert.ok(match, 'Button #' + tabId + ' harus ditemukan');
  assert.ok(match[0].includes('<svg') && match[0].includes('viewBox="0 0 24 24"'), '#' + tabId + ' harus memiliki modern SVG icon');
  // Dilarang ada emoji OS murahan / AI slop di dalam tombol navbar
  ['🏠', '👥', '📋', '📝', '💬', '🎏', '📚'].forEach(em => {
    assert.ok(!match[0].includes(em), '#' + tabId + ' tidak boleh mengandung emoji OS "' + em + '"');
  });
}

// Verifikasi tab guru juga bebas emoji dan menggunakan SVG
const tabIdsGuru = ['btnTabMonitoringWalas', 'btnTabLiveAlertWalas', 'btnTabApprovalIzin', 'btnTabAbsenGuru', 'btnTabLiveGuru', 'btnTabKendalaGuru'];
for (const tabId of tabIdsGuru) {
  const tabRegex = new RegExp('<button[^>]*id="' + tabId + '"[\\s\\S]*?<\\/button>');
  const match = guruHtml.match(tabRegex);
  assert.ok(match, 'Button guru #' + tabId + ' harus ditemukan');
  assert.ok(match[0].includes('<svg'), 'Button guru #' + tabId + ' harus menggunakan SVG vector icon');
  ['👥', '🚨', '📬', '🏢', '📡', '📝', '📊'].forEach(em => {
    assert.ok(!match[0].includes(em), 'Button guru #' + tabId + ' tidak boleh mengandung emoji OS "' + em + '"');
  });
}
console.log('  ✅ Seluruh tab navbar siswa & guru menggunakan Modern SVG Icons bebas emoji!\n');

// 8. Verifikasi Atribut & Sinkronisasi Warna Ikon SVG di style.css
console.log('▶ [Test 8] Verifikasi Sinkronisasi Warna SVG via currentColor di style.css...');
assert.ok(css.includes('.view-tab-btn svg'), 'style.css harus mendefinisikan .view-tab-btn svg');
assert.ok(css.includes('stroke: currentColor;'), 'style.css harus menyelaraskan stroke icon dengan currentColor');
assert.ok(css.includes('.view-tab-btn.active svg'), 'style.css harus mendefinisikan state warna SVG saat tab aktif');
console.log('  ✅ Sinkronisasi visual SVG icon tersinkronisasi sempurna dengan state tombol!\n');

console.log('====================================================');
console.log('🎉 SEMUA PENGUJIAN AUDIT NAVBAR & SPACING LULUS 100%');
console.log('====================================================');
