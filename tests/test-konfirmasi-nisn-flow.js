// ===================================================================
// TEST SUITE: test-konfirmasi-nisn-flow.js
// Menguji alur lengkap:
// 1. Akun Pengunjung (Tanpa NISN default/bocor)
// 2. Proteksi & Validasi NISN Master Data SMKN 1 Sumedang
// 3. Proteksi Anti-Double Claim (NISN tidak bisa diklaim 2 akun berbeda)
// 4. Sukses Konfirmasi Identitas Siswa -> Upgrade ke role 'siswa'
// 5. Verifikasi Agregasi Rekap Presensi 1 Tahun Terakhir
// ===================================================================

const assert = require('assert');
const { generateDatasetSetahun } = require('../scripts/generate-riwayat-setahun');

// 1. Mock DB In-Memory
const mockDb = {
  siswa: {
    '0098263610': {
      nama: 'M. Ihsan Athallah',
      kelas: 'XII RPL 2',
      jurusan: 'Rekayasa Perangkat Lunak',
      email: 'ihsanathallah@gmail.com'
    },
    '0082104129': {
      nama: 'Rizky Ramadhani',
      kelas: 'XII RPL 2',
      jurusan: 'Rekayasa Perangkat Lunak',
      email: 'rizkyramadhani@gmail.com'
    }
  },
  users: {},
  nisn_claimed: {},
  email_mapping: {},
  absensi: {}
};

// 2. Fungsi Logika Login (Replika auth.js)
function prosesLoginMock(fbUser) {
  const uid = fbUser.uid;
  const email = fbUser.email || '';
  const encoded = email.toLowerCase().replace(/\./g, ',').replace(/@/g, '(at)');

  let userData = mockDb.users[uid];
  if (!userData) {
    const mapped = mockDb.email_mapping[encoded];
    if (mapped) {
      userData = {
        uid: uid,
        email: email,
        nama: mapped.nama,
        nisn: mapped.nisn || null,
        kelas: mapped.kelas || null,
        role: mapped.role,
        foto_google: fbUser.photoURL || null
      };
    } else {
      userData = {
        uid: uid,
        email: email,
        nama: fbUser.displayName || (email ? email.split('@')[0] : 'Pengunjung'),
        nisn: null,
        kelas: null,
        role: 'pengunjung',
        foto_google: fbUser.photoURL || null
      };
    }
    mockDb.users[uid] = userData;
  } else {
    if (userData.role !== 'admin' && userData.role !== 'guru' && !userData.nisn) {
      userData.role = 'pengunjung';
    }
  }
  return userData;
}

// 3. Fungsi Periksa NISN & Konfirmasi NISN
function periksaNisnMock(nisn, currentUid) {
  const cleanNisn = (nisn || '').trim();
  if (!cleanNisn) throw new Error('Harap masukkan 10 digit NISN.');
  if (!/^\d{8,12}$/.test(cleanNisn)) throw new Error('Format NISN tidak valid (harus 8-12 angka).');

  const siswa = mockDb.siswa[cleanNisn];
  if (!siswa) {
    throw new Error('NISN tidak terdaftar di database.');
  }

  const claim = mockDb.nisn_claimed[cleanNisn];
  if (claim && claim.uid !== currentUid) {
    throw new Error('NISN telah ditautkan ke akun lain.');
  }

  return {
    nisn: cleanNisn,
    nama: siswa.nama,
    kelas: siswa.kelas,
    jurusan: siswa.jurusan
  };
}

function konfirmasiNisnMock(currentUid, nisn) {
  const dataSiswa = periksaNisnMock(nisn, currentUid);
  const user = mockDb.users[currentUid];
  if (!user) throw new Error('User tidak ditemukan.');

  user.nama = dataSiswa.nama;
  user.nisn = dataSiswa.nisn;
  user.kelas = dataSiswa.kelas;
  user.role = 'siswa';
  user.nisn_verified_at = new Date().toISOString();

  mockDb.nisn_claimed[dataSiswa.nisn] = {
    uid: currentUid,
    email: user.email,
    nama: dataSiswa.nama,
    waktu: new Date().toISOString()
  };

  const encoded = user.email.toLowerCase().replace(/\./g, ',').replace(/@/g, '(at)');
  mockDb.email_mapping[encoded] = {
    nama: dataSiswa.nama,
    nisn: dataSiswa.nisn,
    kelas: dataSiswa.kelas,
    role: 'siswa'
  };

  return user;
}

console.log('=== MEMULAI TEST ALUR KONFIRMASI NISN & REKAP TAHUNAN ===');

// TEST 1: User Login Baru dengan Akun Google (7 dosa Besar)
console.log('\n[Test 1] User baru masuk via Google (7dosabesar557@gmail.com)');
const userBaru = {
  uid: 'uid_rexx_123',
  email: '7dosabesar557@gmail.com',
  displayName: '7 dosa Besar',
  photoURL: 'https://lh3.googleusercontent.com/test'
};

const sessionUser = prosesLoginMock(userBaru);
assert.strictEqual(sessionUser.role, 'pengunjung', 'Role akun baru harus pengunjung');
assert.strictEqual(sessionUser.nisn, null, 'NISN akun baru harus null');
assert.strictEqual(sessionUser.kelas, null, 'Kelas akun baru harus null');
assert.strictEqual(sessionUser.nama, '7 dosa Besar');
console.log('✓ Akun baru berhasil diklasifikasikan sebagai Pengunjung (Tanpa NISN default).');

// TEST 2: Validasi NISN - Format Salah & NISN Tidak Terdaftar
console.log('\n[Test 2] Uji Validasi Input NISN');
assert.throws(() => {
  periksaNisnMock('abc', userBaru.uid);
}, /Format NISN tidak valid/, 'Harus menolak format huruf');

assert.throws(() => {
  periksaNisnMock('0011223344', userBaru.uid);
}, /NISN tidak terdaftar/, 'Harus menolak NISN yang tidak ada di master data');
console.log('✓ Validasi format dan master data NISN berfungsi dengan baik.');

// TEST 3: Periksa NISN Asli (M. Ihsan Athallah - 0098263610)
console.log('\n[Test 3] Periksa NISN Ihsan (0098263610)');
const hasilCek = periksaNisnMock('0098263610', userBaru.uid);
assert.strictEqual(hasilCek.nama, 'M. Ihsan Athallah');
assert.strictEqual(hasilCek.kelas, 'XII RPL 2');
console.log(`✓ Data siswa ditemukan: ${hasilCek.nama} (${hasilCek.kelas})`);

// TEST 4: Konfirmasi & Tautkan NISN Siswa
console.log('\n[Test 4] Konfirmasi Tautkan NISN ke Akun 7 dosa Besar');
const userTerverifikasi = konfirmasiNisnMock(userBaru.uid, '0098263610');
assert.strictEqual(userTerverifikasi.role, 'siswa', 'Role harus berubah menjadi siswa');
assert.strictEqual(userTerverifikasi.nisn, '0098263610');
assert.strictEqual(userTerverifikasi.kelas, 'XII RPL 2');
assert.strictEqual(userTerverifikasi.nama, 'M. Ihsan Athallah');
assert.ok(mockDb.nisn_claimed['0098263610'], 'NISN harus tercatat di nisn_claimed');
console.log('✓ Akun berhasil di-upgrade menjadi Siswa Terverifikasi Resmi.');

// TEST 5: Proteksi Double Claim (User Lain Mencoba Klaim NISN yang Sama)
console.log('\n[Test 5] Uji Proteksi Double Claim NISN');
const userLain = {
  uid: 'uid_orang_lain_999',
  email: 'imposter@gmail.com',
  displayName: 'Akun Asing'
};
prosesLoginMock(userLain);

assert.throws(() => {
  periksaNisnMock('0098263610', userLain.uid);
}, /telah ditautkan ke akun lain/, 'Harus menolak klaim NISN yang sudah dipakai');
console.log('✓ Proteksi anti-double claim aktif: Akun lain ditolak saat klaim NISN terpakai.');

// TEST 6: Admin Melepas Tautan NISN (Konfirmasi Admin untuk Pindah Akun)
console.log('\n[Test 6] Admin Melepas Tautan NISN (Konfirmasi Admin untuk Pindah Akun)');
function lepasTautanAdminMock(uid, nisn, email) {
  delete mockDb.nisn_claimed[nisn];
  if (mockDb.users[uid]) {
    mockDb.users[uid].nisn = null;
    mockDb.users[uid].kelas = null;
    mockDb.users[uid].role = 'pengunjung';
  }
  const encoded = email.toLowerCase().replace(/\./g, ',').replace(/@/g, '(at)');
  delete mockDb.email_mapping[encoded];
}

lepasTautanAdminMock(userBaru.uid, '0098263610', userBaru.email);
assert.strictEqual(mockDb.users[userBaru.uid].role, 'pengunjung', 'Akun lama kembali menjadi pengunjung');
assert.strictEqual(mockDb.users[userBaru.uid].nisn, null, 'NISN akun lama menjadi null');
assert.strictEqual(mockDb.nisn_claimed['0098263610'], undefined, 'NISN claimed harus terhapus');

const userLainKlaim = konfirmasiNisnMock(userLain.uid, '0098263610');
assert.strictEqual(userLainKlaim.role, 'siswa', 'Akun baru berhasil mengklaim setelah dilepas admin');
assert.strictEqual(userLainKlaim.nisn, '0098263610');
console.log('✓ Konfirmasi Admin untuk pindah akun berhasil: NISN berhasil dipindahkan ke akun baru.');

// TEST 7: Rekapitulasi Presensi 1 Tahun Terakhir
console.log('\n[Test 7] Agregasi Data Presensi Historis 1 Tahun Terakhir');
const dataset = generateDatasetSetahun();
const logsIhsan = Object.values(dataset['0098263610']);

// Kelompokkan per tanggal
const perTanggal = {};
logsIhsan.forEach(l => {
  if (!perTanggal[l.tanggal]) perTanggal[l.tanggal] = [];
  perTanggal[l.tanggal].push(l);
});

let countHadir = 0, countSakit = 0, countDispen = 0;
Object.values(perTanggal).forEach(entries => {
  const st = entries.map(e => e.status);
  if (st.includes('hadir') || st.includes('pulang')) countHadir++;
  else if (st.includes('sakit')) countSakit++;
  else if (st.includes('dispensasi')) countDispen++;
});

const totalHariAktif = countHadir + countSakit + countDispen;
const persenHadir = Math.round((countHadir / totalHariAktif) * 100);

assert.ok(totalHariAktif >= 200, 'Jumlah hari sekolah setahun harus ≥ 200 hari');
assert.ok(persenHadir >= 95, 'Persentase kehadiran harus realistis ≥ 95%');
console.log(`✓ Statistik Presensi 1 Tahun: ${countHadir}/${totalHariAktif} Hari Hadir (${persenHadir}%), Sakit: ${countSakit}, Dispen: ${countDispen}`);

console.log('\n======================================================');
console.log('🎉 SEMUA TEST ALUR KONFIRMASI NISN & REKAP TAHUNAN LOLOS 100%!');
console.log('======================================================');
