/**
 * test-bubble-skeleton-dan-struktur-animasi.js
 * Verifikasi Komprehensif:
 * 1. Shimmer skeleton structure loader (placeholder bars & avatar circle) di chat-hub.js & chat-hub.css
 * 2. Staggered card reveal animation (.wa-stagger-in) & Online beacon
 * 3. Re-triggerable spring entrance & exit animations (.is-animating-in, .is-closing)
 * 4. Glowing header accent bar (.wa-header-accent)
 * 5. Cache-busting version query ?v=20261029_02 di admin.html, dashboard.html, dashboard-guru.html
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');

console.log('================================================================');
console.log('🧪 PENGUJIAN SKELETON LOADER, STRUKTUR ANIMASI & CACHE BUSTING');
console.log('================================================================\n');

// 1. Verifikasi CSS Skeleton, Shimmer, dan Accent Bar di chat-hub.css
console.log('▶ [Test 1] Evaluasi CSS Shimmer Skeleton, Motion Stagger & Accent...');
const cssContent = fs.readFileSync(path.join(ROOT_DIR, 'assets', 'chat-hub.css'), 'utf8');

assert.ok(cssContent.includes('.wa-skeleton-wrap'), 'chat-hub.css harus memuat .wa-skeleton-wrap');
assert.ok(cssContent.includes('.wa-skeleton-avatar'), 'chat-hub.css harus memuat .wa-skeleton-avatar');
assert.ok(cssContent.includes('.wa-skeleton-line'), 'chat-hub.css harus memuat .wa-skeleton-line');
assert.ok(cssContent.includes('@keyframes waShimmerSweep'), 'chat-hub.css harus memuat @keyframes waShimmerSweep');
assert.ok(cssContent.includes('.wa-list-item.wa-stagger-in'), 'chat-hub.css harus memuat .wa-list-item.wa-stagger-in');
assert.ok(cssContent.includes('@keyframes waCardUnfurl'), 'chat-hub.css harus memuat @keyframes waCardUnfurl');
assert.ok(cssContent.includes('.wa-header-accent'), 'chat-hub.css harus memuat .wa-header-accent');
assert.ok(cssContent.includes('.wa-online-beacon'), 'chat-hub.css harus memuat .wa-online-beacon');
assert.ok(cssContent.includes('.wa-hub-window.is-animating-in'), 'chat-hub.css harus memuat .wa-hub-window.is-animating-in');
assert.ok(cssContent.includes('.wa-hub-window.is-closing'), 'chat-hub.css harus memuat .wa-hub-window.is-closing');
// Verifikasi anti-miring: FAB open state TIDAK boleh merotasi ikon SVG
assert.ok(!cssContent.includes('.wa-floating-btn.is-open svg {\n  transform: rotate'), 'Ikon SVG FAB saat open DILARANG diputar rotate agar tidak miring');
console.log('  ✓ Seluruh token CSS Skeleton Shimmer, Stagger Motion, dan Ambient Accent lengkap & valid (Anti-Miring Aktif).\n');

// 2. Verifikasi Implementasi Skeleton & Dynamic Loading di chat-hub.js
console.log('▶ [Test 2] Evaluasi Logika Skeleton Loader & Dynamic Stagger di chat-hub.js...');
const jsContent = fs.readFileSync(path.join(ROOT_DIR, 'assets', 'chat-hub.js'), 'utf8');

assert.ok(jsContent.includes('function buatSkeletonHtml('), 'chat-hub.js harus memuat fungsi buatSkeletonHtml');
assert.ok(jsContent.includes('wa-skeleton-status-pill'), 'chat-hub.js harus merender status pill skeleton');
assert.ok(jsContent.includes('function isiKontenTabAktif('), 'chat-hub.js harus memisahkan isiKontenTabAktif');
assert.ok(jsContent.includes('item.className = \'wa-list-item wa-stagger-in\';'), 'chat-hub.js harus menyematkan kelas wa-stagger-in');
assert.ok(jsContent.includes('wa-online-beacon'), 'chat-hub.js harus menyematkan online beacon pada avatar');
assert.ok(jsContent.includes('wa-header-accent'), 'chat-hub.js harus menyertakan bar glowing accent');
assert.ok(jsContent.includes('wa-chat-skeleton-wrap'), 'chat-hub.js harus menyertakan skeleton room obrolan');
console.log('  ✓ Logika struktural load dan skeleton rendering di chat-hub.js terverifikasi aktif.\n');

// 3. Verifikasi Cache-Busting Version Query pada Dokumen HTML
console.log('▶ [Test 3] Evaluasi Cache Busting Query Parameter (?v=20261029_03)...');
const adminHtml = fs.readFileSync(path.join(ROOT_DIR, 'admin.html'), 'utf8');
const guruHtml = fs.readFileSync(path.join(ROOT_DIR, 'dashboard-guru.html'), 'utf8');
const dashHtml = fs.readFileSync(path.join(ROOT_DIR, 'dashboard.html'), 'utf8');

assert.ok(/assets\/chat-hub\.css\?v=20261029_0[3456]/.test(adminHtml), 'admin.html harus memuat chat-hub.css versi terbaru');
assert.ok(/assets\/chat-hub\.js\?v=20261029_0[3456]/.test(adminHtml), 'admin.html harus memuat chat-hub.js versi terbaru');

assert.ok(/assets\/chat-hub\.css\?v=20261029_0[3456]/.test(guruHtml), 'dashboard-guru.html harus memuat chat-hub.css versi terbaru');
assert.ok(/assets\/chat-hub\.js\?v=20261029_0[3456]/.test(guruHtml), 'dashboard-guru.html harus memuat chat-hub.js versi terbaru');

assert.ok(/assets\/chat-hub\.css\?v=20261029_0[3456]/.test(dashHtml), 'dashboard.html harus memuat chat-hub.css versi terbaru');
assert.ok(/assets\/chat-hub\.js\?v=20261029_0[3456]/.test(dashHtml), 'dashboard.html harus memuat chat-hub.js versi terbaru');
console.log('  ✓ Cache-busting query parameter aktif di admin.html, dashboard.html, dan dashboard-guru.html.\n');

console.log('================================================================');
console.log('🎉 SEMUA PENGUJIAN SKELETON LOADER & STRUKTUR ANIMASI LULUS 100%! (3/3)');
console.log('================================================================');
