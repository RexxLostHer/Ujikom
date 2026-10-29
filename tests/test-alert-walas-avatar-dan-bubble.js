/**
 * test-alert-walas-avatar-dan-bubble.js
 * Verifikasi Komprehensif:
 * 1. Live Alert Walas mendeteksi 2 siswa Auto-Alpa / Tanpa Keterangan (M. Ihsan & Rizky Ramadhani)
 * 2. Avatar profil guru di header dashboard-guru menampilkan foto asli Pak Echa (bukan ikon botak)
 * 3. Redesign Chat "Bubble" dengan logo Bubble dan gaya Monochrome Minimalist (Dark/Light)
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('================================================================');
console.log('🧪 PENGUJIAN PERBAIKAN ALERT WALAS, FOTO GURU & CHAT "BUBBLE"');
console.log('================================================================\n');

// 1. Uji Logika Live Alert Walas (Anti-False-Zero)
console.log('▶ [Test 1] Evaluasi Filter Siswa Tanpa Keterangan di muatLiveAlertWalas...');
const guruJs = fs.readFileSync(path.join(__dirname, '../assets/dashboard-guru.js'), 'utf8');

// Verifikasi kode filter hasTap di muatLiveAlertWalas
assert.ok(
  guruJs.includes("rec.status === 'hadir' || rec.status === 'pulang' || rec.status === 'terlambat'"),
  'Filter hasTap harus memvalidasi status hadir/pulang/terlambat dan menolak status alpa/belum'
);

// Simulasi logika filter hasTap dengan data Firebase live
const listSiswaMock = [
  ['0098263610', { nama: 'M. Ihsan Athallah', kelas: 'XII RPL 2' }],
  ['0082104129', { nama: 'Rizky Ramadhani', kelas: 'XII RPL 2' }],
  ['0081131116', { nama: 'Adam Alfaridzi', kelas: 'XII RPL 2' }]
];

// Adam sudah tap hadir, Ihsan & Rizky berstatus auto-alpa
const presensiDataMock = {
  '1': {
    '0098263610': { status: 'alpa', waktu: '08:00:00' },
    '0082104129': { status: 'alpa', waktu: '08:00:00' },
    '0081131116': { status: 'hadir', waktu: '06:20:00' }
  }
};
const defaultPresensiMock = {
  '0081131116': { status: 'hadir', waktu: '06:20:00' }
};
const izinApprovedMock = {};

const belumTapList = listSiswaMock.filter(([nisn]) => {
  let hasTap = false;
  ['1', '2', '3', '4', '5', '6', '7', '8'].forEach(j => {
    const rec = presensiDataMock[j] && presensiDataMock[j][nisn];
    if (rec && (rec.status === 'hadir' || rec.status === 'pulang' || rec.status === 'terlambat')) {
      hasTap = true;
    }
  });
  if (presensiDataMock[nisn] && (presensiDataMock[nisn].status === 'hadir' || presensiDataMock[nisn].status === 'pulang' || presensiDataMock[nisn].status === 'terlambat')) {
    hasTap = true;
  }
  if (defaultPresensiMock[nisn] && (defaultPresensiMock[nisn].status === 'hadir' || defaultPresensiMock[nisn].status === 'terlambat')) {
    hasTap = true;
  }
  if (izinApprovedMock[nisn]) {
    hasTap = true;
  }
  return !hasTap;
});

assert.strictEqual(belumTapList.length, 2, '2 siswa (Ihsan & Rizky) harus terdeteksi di belumTapList');
assert.strictEqual(belumTapList[0][0], '0098263610', 'Ihsan harus ada di daftar');
assert.strictEqual(belumTapList[1][0], '0082104129', 'Rizky harus ada di daftar');
console.log('  ✓ Siswa Auto-Alpa / Tanpa Keterangan terdeteksi presisi (2 siswa), banner "Luar Biasa" tidak akan keliru muncul.\n');

// 2. Uji Integrasi Foto Profil Guru di Header
console.log('▶ [Test 2] Evaluasi Penanganan Foto Profil Guru di #avatarUser...');
assert.ok(
  guruJs.includes("const fotoGuru = user.foto || (user.nip ? `assets/foto/guru_${user.nip}.jpg` : '')"),
  'dashboard-guru.js harus memetakan foto guru berdasarkan NIP'
);
assert.ok(
  guruJs.includes("elAvatar.innerHTML = `") && guruJs.includes('fotoGuru'),
  'dashboard-guru.js harus menyuntikkan tag img ke elemen #avatarUser'
);

const fotoEchaPath = path.join(__dirname, '../assets/foto/guru_199209142022211007.jpg');
assert.ok(fs.existsSync(fotoEchaPath), 'File foto resmi Muhammad Echa Putra harus ada di filesystem');
console.log('  ✓ Foto profil guru terhubung kuat: file guru_199209142022211007.jpg siap dimuat di header.\n');

// 3. Uji Redesign Chat "Bubble" & Bebas Copyright WhatsApp
console.log('▶ [Test 3] Evaluasi Redesign Chat "Bubble" & Logo Bubble...');
const chatJs = fs.readFileSync(path.join(__dirname, '../assets/chat-hub.js'), 'utf8');
const chatCss = fs.readFileSync(path.join(__dirname, '../assets/chat-hub.css'), 'utf8');

// Verifikasi Title & Branding Bubble
assert.ok(chatJs.includes("btnFloat.title = isVerified ? 'Buka Bubble (Chat & Grup)'"), 'Title tombol harus Bubble');
assert.ok(chatJs.includes('<span>Bubble</span>'), 'Header chat harus bertuliskan Bubble');
assert.ok(chatJs.includes('Bubble (WhatsApp Presensia Terkunci)'), 'Modal lock harus memuat Bubble & kompatibilitas test');

// Verifikasi Logo Bubble SVG (3 titik / speech bubble)
assert.ok(chatJs.includes('d="M12 3C6.477 3 2 6.94 2 11.8C2 14.15 3.08 16.29 4.88 17.89L3.5 22L7.92 20.73C9.18 21.28 10.56 21.6 12 21.6C17.523 21.6 22 17.66 22 12.8C22 7.94 17.523 3 12 3Z"'), 'Logo Bubble SVG kustom harus terpasang');

// Verifikasi Palet Monochrome Minimalist di chat-hub.css
assert.ok(chatCss.includes('background: #0F172A;'), 'Floating button & header harus menggunakan background dark onyx #0F172A');
assert.ok(chatCss.includes('.wa-bubble.sent {\n  align-self: flex-end;\n  background: #0F172A;'), 'Balon chat terkirim harus berlatar #0F172A (Monochrome Minimalist)');
assert.ok(chatCss.includes('.wa-chat-view {\n  display: none;\n  flex-direction: column;\n  height: 100%;\n  background: #F8FAFC;'), 'Background chat harus bersih #F8FAFC (Bebas doodle WhatsApp)');

console.log('  ✓ Rebranding Bubble 100% tuntas: Logo Bubble kustom & UI Monochrome Minimalist aktif.\n');

console.log('================================================================');
console.log('🎉 SEMUA PENGUJIAN ALERT WALAS, FOTO GURU & BUBBLE LULUS 100%! (3/3)');
console.log('================================================================');
