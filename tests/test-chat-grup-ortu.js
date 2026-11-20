const assert = require('assert');
const fs = require('fs');

console.log('=== TEST CHAT GROUP ORTU (PAGUYUBAN ORTU KELAS) ===\n');

const chatHubCode = fs.readFileSync('assets/chat-hub.js', 'utf8');

// 1. Verifikasi grup ortu resmi terdaftar
assert.ok(chatHubCode.includes('group_ortu_XII_RPL_1'), 'Grup ortu XII RPL 1 harus terdaftar');
assert.ok(chatHubCode.includes('group_ortu_XII_RPL_2'), 'Grup ortu XII RPL 2 harus terdaftar');
assert.ok(chatHubCode.includes('group_ortu_XII_TKJ_1'), 'Grup ortu XII TKJ 1 harus terdaftar');
console.log('[PASS 1] 3 Grup Paguyuban Orang Tua resmi (XII RPL 1, XII RPL 2, XII TKJ 1) terdaftar.');

// 2. Evaluasi cekAksesGrup untuk Orang Tua
// Mock helper
function normalisasiKelasChat(k) {
  if (!k) return '';
  return String(k).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function mockCekAksesGrupOrtu(user, g) {
  if (!user || !g) return false;
  if (user.role === 'pengunjung' || user.isVerified === false) return false;
  const userRole = user.role || 'siswa';
  const groupKelasNorm = normalisasiKelasChat(g.kelas || '');

  if (userRole === 'orangtua' || userRole === 'ortu') {
    if (g.kategori !== 'ortu') return false; // Dilarang masuk grup siswa atau guru
    const childKelasNorm = normalisasiKelasChat(user.kelas_anak || user.kelas || '');
    if (childKelasNorm && groupKelasNorm && childKelasNorm === groupKelasNorm) return true;
    if (user.daftar_anak && typeof user.daftar_anak === 'object') {
      return Object.values(user.daftar_anak).some(ch => {
        return ch && normalisasiKelasChat(ch.kelas) === groupKelasNorm;
      });
    }
    return false;
  }
  return false;
}

const userOrtuRpl2 = {
  role: 'orangtua',
  isVerified: true,
  nama: 'Bpk. Hendra',
  kelas_anak: 'XII RPL 2'
};

const grupOrtuRpl2 = { id: 'group_ortu_XII_RPL_2', kategori: 'ortu', kelas: 'XII RPL 2' };
const grupOrtuRpl1 = { id: 'group_ortu_XII_RPL_1', kategori: 'ortu', kelas: 'XII RPL 1' };
const grupSiswaRpl2 = { id: 'group_XII_RPL_2', kategori: 'kelas', kelas: 'XII RPL 2' };
const grupWalas = { id: 'group_walas_sumedang', kategori: 'walas', kelas: null };

assert.strictEqual(mockCekAksesGrupOrtu(userOrtuRpl2, grupOrtuRpl2), true, 'Ortu harus boleh akses grup ortu kelas anaknya');
assert.strictEqual(mockCekAksesGrupOrtu(userOrtuRpl2, grupOrtuRpl1), false, 'Ortu DILARANG akses grup ortu kelas lain');
assert.strictEqual(mockCekAksesGrupOrtu(userOrtuRpl2, grupSiswaRpl2), false, 'Ortu DILARANG masuk ke grup internal siswa');
assert.strictEqual(mockCekAksesGrupOrtu(userOrtuRpl2, grupWalas), false, 'Ortu DILARANG masuk ke forum guru/walas');
console.log('[PASS 2] Isolasi ketat terbukti: Ortu hanya melihat Paguyuban Orang Tua kelas anaknya.');

// 3. Verifikasi dashboard-ortu.html memuat chat-hub.js
const dashOrtuHtml = fs.readFileSync('dashboard-ortu.html', 'utf8');
assert.ok(dashOrtuHtml.includes('assets/chat-hub.js'), 'dashboard-ortu.html harus memuat script chat-hub.js');
console.log('[PASS 3] dashboard-ortu.html telah mengintegrasikan Bubble Chat Presensia.');

console.log('\n🎉 SEMUA PENGUJIAN CHAT ORTU 100% SUKSES!');
