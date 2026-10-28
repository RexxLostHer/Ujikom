const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('=== TEST SUITE: PEMULIHAN KATA SANDI & OFFLINE RESILIENCE ===\n');

// 1. Mock minimal browser environment
global.localStorage = {
  _store: {},
  getItem(key) { return this._store[key] || null; },
  setItem(key, val) { this._store[key] = String(val); },
  removeItem(key) { delete this._store[key]; },
  clear() { this._store = {}; }
};

// Pastikan firebase tidak didefinisikan secara global saat pengujian awal
delete global.firebase;

// Muat master data & auth module
const firebaseConfig = require('../assets/firebase-config.js');
global.MASTER_DATA_SISWA_RESMI = firebaseConfig.MASTER_DATA_SISWA_RESMI;
const authModule = require('../assets/auth.js');
const { cariSiswaByEmail, kirimResetPassword } = authModule;

// [Test 1] Pengenalan Email Siswa M. Ihsan Athallah & Pelepasan Role zemapk16
console.log('[Test 1] Validasi pemetaan email 7dosabesar557@gmail.com & pelepasan zemapk16@gmail.com');
const siswa7Dosa = cariSiswaByEmail('7dosabesar557@gmail.com');
assert.ok(siswa7Dosa, 'Siswa 7dosabesar557@gmail.com harus ditemukan sebagai M. Ihsan');
assert.strictEqual(siswa7Dosa.nisn, '0098263610', 'NISN harus 0098263610 (M. Ihsan Athallah)');
assert.strictEqual(siswa7Dosa.kelas, 'XII RPL 2', 'Kelas harus XII RPL 2');

// Verifikasi zemapk16@gmail.com bebas dari peran M. Ihsan (tidak ada duplikasi)
const siswaZemapk16 = cariSiswaByEmail('zemapk16@gmail.com');
assert.strictEqual(siswaZemapk16, null, 'zemapk16@gmail.com TIDAK boleh terpetakan ke M. Ihsan lagi');
console.log('✓ Email 7dosabesar557@gmail.com berhasil dipetakan ke M. Ihsan Athallah & zemapk16@gmail.com bersih dari duplikasi.\n');

// [Test 2] Reset Password saat Firebase belum didefinisikan (Offline Resilience)
console.log('[Test 2] Pengujian kirimResetPassword saat Firebase SDK tidak tersedia (bebas ReferenceError)');
(async () => {
  try {
    const res = await kirimResetPassword('7dosabesar557@gmail.com');
    assert.ok(res, 'Hasil reset password harus ada');
    assert.strictEqual(res.success, true, 'Status success harus true');
    assert.strictEqual(res.isOffline, true, 'Harus masuk ke mode isOffline resilience');
    assert.ok(res.user, 'Informasi user harus disertakan dalam response');
    assert.strictEqual(res.user.nisn, '0098263610', 'Response user harus cocok dengan NISN siswa');
    
    // Periksa apakah tersimpan di local_password_reset_requests
    const reqs = JSON.parse(global.localStorage.getItem('local_password_reset_requests') || '[]');
    assert.ok(reqs.length > 0, 'Permintaan reset harus tersimpan di local_password_reset_requests');
    assert.strictEqual(reqs[0].email, '7dosabesar557@gmail.com');
    console.log('✓ kirimResetPassword sukses menangani mode offline tanpa melempar ReferenceError\n');

    // [Test 3] Validasi Format Email Tidak Valid
    console.log('[Test 3] Pengujian validasi format email tidak valid');
    let formatErrCaught = false;
    try {
      await kirimResetPassword('bukan_email');
    } catch (err) {
      formatErrCaught = true;
      assert.strictEqual(err.code, 'auth/invalid-email', 'Error code harus auth/invalid-email');
    }
    assert.ok(formatErrCaught, 'Format email salah harus melempar error auth/invalid-email');
    console.log('✓ Validasi format email berhasil menolak format salah\n');

    // [Test 4] Validasi Email Tidak Dikenal
    console.log('[Test 4] Pengujian validasi email yang belum terdaftar');
    let notFoundCaught = false;
    try {
      await kirimResetPassword('akun_asing_palsu_999@gmail.com');
    } catch (err) {
      notFoundCaught = true;
      assert.strictEqual(err.code, 'auth/user-not-found', 'Error code harus auth/user-not-found');
    }
    assert.ok(notFoundCaught, 'Email tidak terdaftar harus melempar error auth/user-not-found');
    console.log('✓ Validasi email tidak terdaftar berhasil melempar error auth/user-not-found\n');

    // [Test 5] Validasi Keutuhan File index.html
    console.log('[Test 5] Validasi keutuhan markup pemulihan kata sandi di index.html');
    const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
    assert.ok(indexHtml.includes('id="modalLupaPassword"'), 'Modal lupa password harus ada');
    assert.ok(indexHtml.includes('id="resetEmail"'), 'Field resetEmail harus ada');
    assert.ok(indexHtml.includes('id="btnKirimReset"'), 'Tombol btnKirimReset harus ada');
    assert.ok(indexHtml.includes('handleKirimResetPassword(event)'), 'Form submit handler harus ada');
    console.log('✓ Seluruh elemen DOM dan event handler di index.html 100% utuh dan valid\n');

    console.log('======================================================================');
    console.log('SEMUA PENGUJIAN PEMULIHAN KATA SANDI BERHASIL! (5/5 PASSED)');
    console.log('======================================================================');
    process.exit(0);
  } catch (e) {
    console.error('Pengujian gagal:', e);
    process.exit(1);
  }
})();
