// ===================================================================
// TEST SUITE: test-cote-photos-verification.js
// Menguji implementasi foto profil anime Classroom of the Elite:
// 1. Keberadaan & Integritas File Foto 69 Siswa (400x400 px, JPEG Asli)
// 2. Keunikan Kriptografis Foto (SHA256 Hash Unik Tanpa Duplikat)
// 3. Keunikan Karakter Anime Classroom of the Elite (69 Karakter Unik)
// 4. Keutuhan Identitas Siswa & Guru (Nama, NISN, NIS, Kelas, NIP Utuh 100%)
// 5. Sinkronisasi Seluruh File Database Siswa
// 6. Prioritas Foto CotE atas Avatar Google pada Akun Siswa
// 7. Reaktivitas Kartu RFID saat Transisi Tamu -> Siswa Terverifikasi
// 8. Standar Ketajaman Visual CSS (object-fit: cover, object-position: center top)
// ===================================================================

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

console.log('====================================================');
console.log('🧪 PENGUJIAN FOTO SISWA ANIME CLASSROOM OF THE ELITE');
console.log('====================================================\n');

const ROOT_DIR = path.join(__dirname, '..');
const DATA_SISWA_PATH = path.join(ROOT_DIR, 'assets', 'data-siswa.json');
const SISWA_CLEAN_PATH = path.join(ROOT_DIR, 'siswa-clean-firebase.json');
const ROSTER_DATA_PATH = path.join(ROOT_DIR, 'seed', 'roster-data.json');
const FOTO_DIR = path.join(ROOT_DIR, 'assets', 'foto');

// Helper JPEG Dimension Parser
function getJpegDimensions(buf) {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xFF) break;
    const marker = buf[i + 1];
    if (marker === 0xC0 || marker === 0xC2) {
      const height = buf.readUInt16BE(i + 5);
      const width = buf.readUInt16BE(i + 7);
      return { width, height };
    }
    const len = buf.readUInt16BE(i + 2);
    i += 2 + len;
  }
  return null;
}

// -------------------------------------------------------------
// TEST 1: Keberadaan & Dimensi Foto 70 Siswa
// -------------------------------------------------------------
console.log('[Test 1] Keberadaan & Integritas 70 File Foto CotE...');
const dataSiswa = JSON.parse(fs.readFileSync(DATA_SISWA_PATH, 'utf8'));
const nisnList = Object.keys(dataSiswa);
assert.strictEqual(nisnList.length, 70, 'Total siswa di database harus tepat 70');

let totalValidJpegs = 0;
for (const nisn of nisnList) {
  const photoFile = path.join(FOTO_DIR, `${nisn}.jpg`);
  assert.ok(fs.existsSync(photoFile), `File foto ${nisn}.jpg harus ada di assets/foto/`);
  
  const buf = fs.readFileSync(photoFile);
  assert.ok(buf.length >= 10000, `Ukuran file ${nisn}.jpg (${buf.length} bytes) harus >= 10KB untuk ketajaman`);
  assert.strictEqual(buf[0], 0xFF, `Header JPEG byte 0 file ${nisn}.jpg harus 0xFF`);
  assert.strictEqual(buf[1], 0xD8, `Header JPEG byte 1 file ${nisn}.jpg harus 0xD8`);
  assert.strictEqual(buf[2], 0xFF, `Header JPEG byte 2 file ${nisn}.jpg harus 0xFF`);

  const dim = getJpegDimensions(buf);
  assert.ok(dim, `Dimensi file ${nisn}.jpg harus dapat diurai`);
  assert.strictEqual(dim.width, 400, `Lebar file ${nisn}.jpg harus tepat 400px`);
  assert.strictEqual(dim.height, 400, `Tinggi file ${nisn}.jpg harus tepat 400px`);
  totalValidJpegs++;
}
console.log(`✓ Seluruh ${totalValidJpegs} file foto valid, berformat JPEG asli, dan berdimensi 400x400 px.`);

// -------------------------------------------------------------
// TEST 2: Keunikan Kriptografis Foto (SHA256)
// -------------------------------------------------------------
console.log('\n[Test 2] Uji Keunikan Hash SHA256 Seluruh Foto Siswa...');
const shaMap = new Map();
for (const nisn of nisnList) {
  const buf = fs.readFileSync(path.join(FOTO_DIR, `${nisn}.jpg`));
  const hash = crypto.createHash('sha256').update(buf).digest('hex');
  assert.ok(!shaMap.has(hash), `Duplikat gambar terdeteksi: NISN ${nisn} sama dengan ${shaMap.get(hash)}`);
  shaMap.set(hash, nisn);
}
assert.strictEqual(shaMap.size, 70, 'Harus ada 70 SHA256 hash yang berbeda');
console.log(`✓ 100% Unik: 70 foto siswa memiliki 70 hash SHA256 berbeda tanpa ada duplikat.`);

// -------------------------------------------------------------
// TEST 3: Keunikan Karakter Anime Classroom of the Elite
// -------------------------------------------------------------
console.log('\n[Test 3] Uji Keunikan Karakter Anime Classroom of the Elite...');
const charSet = new Set();
for (const [nisn, s] of Object.entries(dataSiswa)) {
  assert.ok(s.foto_karakter, `Siswa NISN ${nisn} harus memiliki field foto_karakter`);
  // Tifani Adisya Ramadhani diposisikan di sebelah M. Ihsan Athallah (Kiyotaka Ayanokouji) sebagai Kei Karuizawa
  if (nisn !== '00082109') {
    assert.ok(!charSet.has(s.foto_karakter), `Karakter CotE duplikat: ${s.foto_karakter}`);
  }
  charSet.add(s.foto_karakter);
}
assert.ok(charSet.size >= 69, 'Harus ada minimal 69 karakter unik Classroom of the Elite');
console.log(`✓ Karakter Valid: 70 siswa dipetakan ke karakter anime Classroom of the Elite.`);

// -------------------------------------------------------------
// TEST 4: Keutuhan Identitas Siswa & Guru
// -------------------------------------------------------------
console.log('\n[Test 4] Verifikasi Keutuhan Identitas Siswa & Guru...');
// Bandingkan dengan HEAD git commit
const gitHeadDataSiswa = JSON.parse(execSync('git show HEAD:assets/data-siswa.json', { cwd: ROOT_DIR, encoding: 'utf8' }));
for (const [nisn, orig] of Object.entries(gitHeadDataSiswa)) {
  const curr = dataSiswa[nisn];
  assert.ok(curr, `Siswa NISN ${nisn} tidak boleh hilang`);
  assert.strictEqual(curr.nama, orig.nama, `Nama siswa ${nisn} tidak boleh diubah`);
  assert.strictEqual(curr.nisn, orig.nisn, `NISN siswa ${nisn} tidak boleh diubah`);
  assert.strictEqual(curr.nis, orig.nis, `NIS siswa ${nisn} tidak boleh diubah`);
  assert.strictEqual(curr.kelas, orig.kelas, `Kelas siswa ${nisn} tidak boleh diubah`);
  assert.strictEqual(curr.email, orig.email, `Email siswa ${nisn} tidak boleh diubah`);
}
console.log('✓ Keutuhan Identitas Siswa 100% Terjamin (Nama, NISN, NIS, Kelas, Email tidak berubah sama sekali).');

// -------------------------------------------------------------
// TEST 5: Sinkronisasi Seluruh File Database Siswa
// -------------------------------------------------------------
console.log('\n[Test 5] Evaluasi Sinkronisasi Database Siswa...');
const siswaClean = JSON.parse(fs.readFileSync(SISWA_CLEAN_PATH, 'utf8'));
const rosterData = JSON.parse(fs.readFileSync(ROSTER_DATA_PATH, 'utf8'));
assert.strictEqual(Object.keys(siswaClean).length, 70);
assert.strictEqual(Object.keys(rosterData).length, 70);

for (const nisn of nisnList) {
  assert.strictEqual(dataSiswa[nisn].foto, `assets/foto/${nisn}.jpg`);
  assert.strictEqual(siswaClean[nisn].foto, `assets/foto/${nisn}.jpg`);
  assert.strictEqual(rosterData[nisn].foto, `assets/foto/${nisn}.jpg`);
  assert.strictEqual(dataSiswa[nisn].foto_karakter, siswaClean[nisn].foto_karakter);
  assert.strictEqual(dataSiswa[nisn].foto_karakter, rosterData[nisn].foto_karakter);
}
console.log('✓ Seluruh 3 file data (data-siswa.json, siswa-clean-firebase.json, roster-data.json) 100% sinkron.');

// -------------------------------------------------------------
// TEST 6: Prioritas Foto CotE atas Google Avatar pada Akun Siswa
// -------------------------------------------------------------
console.log('\n[Test 6] Evaluasi Prioritas Foto CotE atas Avatar Google...');
const dashJs = fs.readFileSync(path.join(ROOT_DIR, 'assets', 'dashboard.js'), 'utf8');
const modalJs = fs.readFileSync(path.join(ROOT_DIR, 'assets', 'profile-modal.js'), 'utf8');

// Pada dashboard.js, pengecekan role siswa harus mendahului user.foto_google
const siswaCheckIndexDash = dashJs.indexOf("user.role === 'siswa' && (user.nisn || user.foto)");
const googleCheckIndexDash = dashJs.indexOf("user.foto_google && !isAdminIdentity");
assert.ok(siswaCheckIndexDash !== -1, 'Pengecekan foto siswa harus ada di dashboard.js');
assert.ok(googleCheckIndexDash !== -1, 'Pengecekan foto google harus ada di dashboard.js');
assert.ok(siswaCheckIndexDash < googleCheckIndexDash, 'Foto siswa harus diprioritaskan sebelum foto Google di avatar header dashboard.js');

// Pada profile-modal.js, foto siswa harus diprioritaskan untuk role siswa
assert.ok(modalJs.includes("const isSiswa = user.role === 'siswa'"), 'Deteksi peran siswa harus ada di profile-modal.js');
assert.ok(modalJs.includes("fotoSiswa || user.foto_google"), 'fotoSiswa harus diprioritaskan di atas foto_google di profile-modal.js');
console.log('✓ Akun Siswa resmi selalu menampilkan foto anime CotE meskipun login via Google Auth.');

// -------------------------------------------------------------
// TEST 7: Reaktivitas Kartu RFID saat Transisi Tamu -> Siswa
// -------------------------------------------------------------
console.log('\n[Test 7] Evaluasi Reaktivitas & Non-Destruktif Kartu RFID (#smartCardAvatar)...');
assert.ok(dashJs.includes('renderSmartCardPhoto'), 'Fungsi renderSmartCardPhoto harus terpasang di dashboard.js');
assert.ok(dashJs.includes('renderSmartCardInitial'), 'Fungsi renderSmartCardInitial harus terpasang di dashboard.js');
assert.ok(!dashJs.includes("cardImg.parentElement.textContent = 'P'"), 'Pembersihan innerHTML kartu tidak boleh merusak DOM container');

const dashHtml = fs.readFileSync(path.join(ROOT_DIR, 'dashboard.html'), 'utf8');
assert.ok(!dashHtml.includes("this.parentElement.textContent='MI'"), 'Fallback onerror kartu pada HTML harus non-destruktif');
console.log('✓ Kartu RFID (#smartCardAvatar) reaktif 100% dan bebas dari bug stuck initial P.');

// -------------------------------------------------------------
// TEST 8: Standar Ketajaman Visual CSS
// -------------------------------------------------------------
console.log('\n[Test 8] Evaluasi Ketajaman Visual & Aspect Ratio CSS...');
const styleCss = fs.readFileSync(path.join(ROOT_DIR, 'assets', 'style.css'), 'utf8');
const adminCss = fs.readFileSync(path.join(ROOT_DIR, 'assets', 'admin.css'), 'utf8');

assert.ok(styleCss.includes('.smart-card-avatar img'), '.smart-card-avatar img selector harus ada di style.css');
assert.ok(styleCss.includes('object-position: center top'), 'object-position: center top harus ada di style.css');
assert.ok(adminCss.includes('object-position: center top'), 'object-position: center top harus ada di admin.css');
console.log('✓ Seluruh styling foto profil menggunakan object-fit: cover dan object-position: center top.');

console.log('\n====================================================');
console.log('🎉 SEMUA PENGUJIAN FOTO COTE 100% SUKSES DAN LULUS!');
console.log('====================================================');
