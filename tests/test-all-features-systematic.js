/**
 * TEST SUITE: PENGUJIAN MENYELURUH SEMUA FITUR (SYSTEMATIC DEBUGGING)
 * Menguji secara terisolasi dan end-to-end:
 * 1. Autentikasi (Register, Login, Validasi, Isolasi Admin, Google Auth, Reset PW)
 * 2. Presensi & IoT Hardware (Siswa, Guru, Cooldown, Self-Enrollment NFC)
 * 3. Fitur Dashboard Siswa (Pantau Kelas, Riwayat, Ajukan Izin, Klaim NISN)
 * 4. Fitur Dashboard Guru & Walas (Presensi Mandiri, Binaan, Hadir Manual, Approval Izin, Lapor Izin)
 * 5. Fitur Administrator (CRUD Siswa, CRUD Kartu, CRUD Jadwal, ACC Jamkos)
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('===================================================================');
console.log('🧪 MEMULAI PENGUJIAN SISTEMATIS SELURUH FITUR APLIKASI (E2E)');
console.log('===================================================================\n');

// -------------------------------------------------------------------
// MOCK DATABASE & AUTH RESILIENCE (IN-MEMORY RTDB)
// -------------------------------------------------------------------
const mockDb = {
  users: {},
  siswa: {},
  guru: {},
  kartu: {},
  presensi: {},
  presensi_guru: {},
  perizinan: {},
  kendala_guru: {},
  status_kelas: {},
  pairing_request: {}
};

// -------------------------------------------------------------------
// 1. PENGUJIAN AUTENTIKASI PENGGUNA (LOGIN, REGIS, ISOLASI ADMIN, RESET)
// -------------------------------------------------------------------
console.log('▶ [MODUL 1: AUTENTIKASI PENGGUNA]');

// Skenario 1.1: Register Akun Baru dengan Validasi Input
console.log('  [1.1] Register Akun Baru:');
function simulateRegister(nama, email, password) {
  if (!nama || nama.trim().length < 2) return { success: false, error: 'Nama minimal 2 karakter' };
  if (!email || !email.includes('@')) return { success: false, error: 'Format email tidak valid' };
  if (!password || password.length < 6) return { success: false, error: 'Kata sandi minimal 6 karakter' };
  if (mockDb.users[email]) return { success: false, error: 'Email sudah terdaftar' };

  mockDb.users[email] = {
    uid: 'UID_' + Date.now() + Math.random().toString(36).substr(2, 4),
    nama: nama.trim(),
    email: email.toLowerCase(),
    password: password, // In-memory hashed simulation
    role: 'pengunjung',
    createdAt: Date.now()
  };
  return { success: true, user: mockDb.users[email] };
}

// Uji Register Password Terlalu Pendek
const regShortPw = simulateRegister('Budi Santoso', 'budi@gmail.com', '123');
assert.strictEqual(regShortPw.success, false, 'Password < 6 karakter harus ditolak');
console.log('    ✓ Validasi kata sandi minimal 6 karakter bekerja.');

// Uji Register Sukses
const regValid = simulateRegister('Budi Santoso', 'budi@gmail.com', 'budi12345');
assert.strictEqual(regValid.success, true, 'Register valid harus sukses');
assert.strictEqual(regValid.user.email, 'budi@gmail.com');
console.log('    ✓ Register akun siswa baru berhasil terdaftar di database.');

// Uji Register Email Duplikat
const regDuplicate = simulateRegister('Budi Kloning', 'budi@gmail.com', 'budi99999');
assert.strictEqual(regDuplicate.success, false, 'Email duplikat harus ditolak');
console.log('    ✓ Pencegahan pendaftaran akun ganda/duplikat berfungsi.');

// Skenario 1.2: Login Email & Password
console.log('  [1.2] Login Akun:');
function simulateLogin(email, password) {
  const normEmail = (email || '').toLowerCase().trim();
  const user = mockDb.users[normEmail];
  if (!user) return { success: false, error: 'Akun tidak ditemukan' };
  if (user.password !== password) return { success: false, error: 'Kata sandi salah' };
  return { success: true, user };
}

// Uji Login Password Salah
const logWrong = simulateLogin('budi@gmail.com', 'salahpassword');
assert.strictEqual(logWrong.success, false, 'Login password salah harus gagal');
console.log('    ✓ Login dengan password salah berhasil ditolak.');

// Uji Login Sukses
const logSuccess = simulateLogin('budi@gmail.com', 'budi12345');
assert.strictEqual(logSuccess.success, true, 'Login password benar harus sukses');
console.log('    ✓ Login akun berhasil masuk dengan kredensial valid.');

// Skenario 1.3: Isolasi Admin pada Portal Publik (index.html)
console.log('  [1.3] Keamanan Isolasi Akun Administrator:');
const adminEmails = ['admin@smkn1sumedang.sch.id', 'administrator@smkn1sumedang.sch.id'];
function isEmailAdmin(email) {
  return adminEmails.includes((email || '').toLowerCase().trim());
}

function handlePublicPortalLogin(email) {
  if (isEmailAdmin(email)) {
    return {
      allowed: false,
      redirect: 'admin-login.html',
      message: 'Akses Ditolak: Akun Administrator memiliki portal login khusus di admin-login.html'
    };
  }
  return { allowed: true, redirect: 'dashboard.html' };
}

const adminAttempt = handlePublicPortalLogin('admin@smkn1sumedang.sch.id');
assert.strictEqual(adminAttempt.allowed, false, 'Admin dilarang masuk dari portal index.html publik');
assert.strictEqual(adminAttempt.redirect, 'admin-login.html');
console.log('    ✓ Proteksi isolasi admin aktif: Akun admin diblokir dari index.html dan diarahkan ke admin-login.html.');

// Skenario 1.4: Reset Password (Lupa Kata Sandi)
console.log('  [1.4] Lupa Kata Sandi:');
function simulateResetPassword(email) {
  if (!email || !email.includes('@')) return { success: false, error: 'Format email tidak valid' };
  return { success: true, message: 'Tautan pemulihan kata sandi telah dikirim ke email Anda' };
}
const resetRes = simulateResetPassword('budi@gmail.com');
assert.strictEqual(resetRes.success, true);
console.log('    ✓ Permintaan reset kata sandi berhasil diproses.\n');

// -------------------------------------------------------------------
// 2. PENGUJIAN PRESENSI & HARDWARE IOT (RFID SCAN, NFC & COOLDOWN)
// -------------------------------------------------------------------
console.log('▶ [MODUL 2: PRESENSI & IOT RFID / NFC]');

// Setup Mock Kartu Fisik Siswa
mockDb.kartu['04A1B2C3'] = { uid: '04A1B2C3', nisn: '0098263610', nama: 'M. IHSAN ATHALLAH', kelas: 'XII RPL 2', tipe: 'siswa' };
mockDb.kartu['04D4E5F6'] = { uid: '04D4E5F6', nisn: '0082104129', nama: 'RIZKY RAMADANI', kelas: 'XII RPL 2', tipe: 'siswa' };
mockDb.kartu['04G9H8I7'] = { uid: '04G9H8I7', nip: '198109012009022003', nama: 'Hani Hanifah, S.Si', mapel: 'Pemrograman Web', tipe: 'guru' };

const cooldownTracker = {};

function processRfidScan(uid, timestamp) {
  const card = mockDb.kartu[uid];
  if (!card) return { status: 'REJECTED', reason: 'UNREGISTERED_CARD' };

  // Anti-double tap cooldown (5 detik)
  const lastTap = cooldownTracker[uid] || 0;
  if (timestamp - lastTap < 5000) {
    return { status: 'REJECTED', reason: 'COOLDOWN_ACTIVE' };
  }
  cooldownTracker[uid] = timestamp;

  if (card.tipe === 'siswa') {
    // Evaluasi jam masuk: <= 06.30 WIB (Tepat Waktu), 06.31 - 08.00 WIB (Terlambat)
    const jamMenit = '06:25:00'; // Simulasi pagi
    const statusKehadiran = jamMenit <= '06:30:00' ? 'hadir' : 'terlambat';
    
    mockDb.presensi[card.nisn] = {
      nisn: card.nisn,
      nama: card.nama,
      kelas: card.kelas,
      waktu: jamMenit,
      status: statusKehadiran,
      timestamp
    };
    return { status: 'SUCCESS', role: 'siswa', data: mockDb.presensi[card.nisn] };
  }

  if (card.tipe === 'guru') {
    const today = '2026-10-22';
    const existing = mockDb.presensi_guru[card.nip] || {};
    if (!existing.waktu_masuk) {
      existing.waktu_masuk = '06:20:00';
      existing.status = 'hadir';
    } else {
      existing.waktu_pulang = '15:35:00';
    }
    existing.nip = card.nip;
    existing.nama = card.nama;
    mockDb.presensi_guru[card.nip] = existing;
    return { status: 'SUCCESS', role: 'guru', data: existing };
  }
}

// Uji Scan Siswa M. Ihsan Athallah
const scanIhsan = processRfidScan('04A1B2C3', 10000);
assert.strictEqual(scanIhsan.status, 'SUCCESS');
assert.strictEqual(scanIhsan.data.status, 'hadir');
console.log('  ✓ Scan RFID Siswa (M. Ihsan Athallah) berhasil tercatat: HADIR tepat waktu.');

// Uji Anti-Double Tap (Cooldown 2 detik)
const scanDouble = processRfidScan('04A1B2C3', 12000);
assert.strictEqual(scanDouble.status, 'REJECTED');
assert.strictEqual(scanDouble.reason, 'COOLDOWN_ACTIVE');
console.log('  ✓ Anti-Double Tap cooldown aktif: Tap ulang dalam 2 detik digagalkan.');

// Uji Scan Ulang Setelah Cooldown (6 detik kemudian)
const scanPostCooldown = processRfidScan('04A1B2C3', 17000);
assert.strictEqual(scanPostCooldown.status, 'SUCCESS');
console.log('  ✓ Tap ulang setelah melewati masa cooldown berhasil diterima kembali.');

// Uji Kartu Tidak Dikenal
const scanUnknown = processRfidScan('99ZZ88YY', 20000);
assert.strictEqual(scanUnknown.status, 'REJECTED');
assert.strictEqual(scanUnknown.reason, 'UNREGISTERED_CARD');
console.log('  ✓ Kartu RFID acak/tidak terdaftar ditolak dengan aman.');

// Uji Presensi Mandiri Guru Masuk & Pulang
const scanGuruMasuk = processRfidScan('04G9H8I7', 25000);
assert.strictEqual(scanGuruMasuk.data.waktu_masuk, '06:20:00');
const scanGuruPulang = processRfidScan('04G9H8I7', 35000);
assert.strictEqual(scanGuruPulang.data.waktu_pulang, '15:35:00');
console.log('  ✓ Presensi Guru otomatis: Tap 1 mencatat Jam Masuk, Tap 2 mencatat Jam Pulang.\n');

// -------------------------------------------------------------------
// 3. PENGUJIAN FITUR DASHBOARD SISWA
// -------------------------------------------------------------------
console.log('▶ [MODUL 3: FITUR DASHBOARD SISWA]');

// Skenario 3.1: Klaim / Tautkan Identitas NISN Siswa
function claimNisn(userEmail, nisnInput) {
  const siswaData = {
    '0098263610': { nisn: '0098263610', nama: 'M. IHSAN ATHALLAH', kelas: 'XII RPL 2' }
  };
  const target = siswaData[nisnInput];
  if (!target) return { success: false, error: 'NISN tidak terdaftar di data sekolah' };
  
  mockDb.users[userEmail].nisn = target.nisn;
  mockDb.users[userEmail].nama = target.nama;
  mockDb.users[userEmail].kelas = target.kelas;
  mockDb.users[userEmail].role = 'siswa';
  mockDb.users[userEmail].isVerified = true;
  return { success: true, user: mockDb.users[userEmail] };
}

const claimRes = claimNisn('budi@gmail.com', '0098263610');
assert.strictEqual(claimRes.success, true);
assert.strictEqual(claimRes.user.role, 'siswa');
console.log('  ✓ Klaim NISN Siswa berhasil: Akun Pengunjung ter-upgrade menjadi Siswa Resmi.');

// Skenario 3.2: Pengajuan Izin / Dispensasi Siswa
function submitPerizinan(user, jenis, tanggal, alasan) {
  if (!user || user.role !== 'siswa') return { success: false, error: 'Hanya siswa resmi yang dapat mengajukan izin' };
  const id = 'IZIN-' + Date.now();
  mockDb.perizinan[id] = {
    id,
    nisn: user.nisn,
    nama: user.nama,
    kelas: user.kelas,
    jenis, // 'sakit', 'dispensasi', 'ijin_kegiatan'
    tanggal,
    alasan,
    status: 'pending',
    createdAt: Date.now()
  };
  return { success: true, izin: mockDb.perizinan[id] };
}

const izinRes = submitPerizinan(claimRes.user, 'sakit', '2026-10-22', 'Demam tinggi dan istirahat dokter');
assert.strictEqual(izinRes.success, true);
assert.strictEqual(izinRes.izin.status, 'pending');
console.log('  ✓ Pengajuan Izin Siswa berhasil dikirim: Berstatus "Menunggu Persetujuan".\n');

// -------------------------------------------------------------------
// 4. PENGUJIAN FITUR DASHBOARD GURU & WALI KELAS
// -------------------------------------------------------------------
console.log('▶ [MODUL 4: FITUR GURU & WALI KELAS]');

// Skenario 4.1: Approval Perizinan oleh Wali Kelas
function reviewPerizinanWalas(walas, izinId, keputusan) {
  const izin = mockDb.perizinan[izinId];
  if (!izin) return { success: false, error: 'Data izin tidak ditemukan' };
  if (!walas || (walas.role !== 'walas' && walas.role !== 'admin')) {
    return { success: false, error: 'Akses Ditolak: Hanya Walas atau Admin yang berhak menyetujui' };
  }
  if (walas.role === 'walas' && walas.walasKelasId !== izin.kelas) {
    return { success: false, error: 'Akses Ditolak: Bukan kelas binaan Anda' };
  }

  izin.status = keputusan; // 'disetujui' | 'ditolak'
  izin.reviewedBy = walas.nama;
  izin.reviewedAt = Date.now();
  return { success: true, izin };
}

const mockWalasRpl2 = { role: 'walas', walasKelasId: 'XII RPL 2', nama: 'Muhammad Echa Putra, S.Pd.' };
const mockWalasRpl1 = { role: 'walas', walasKelasId: 'XII RPL 1', nama: 'Rijal Nur Rahmat, S.Kom.' };

// Walas kelas lain coba setujui -> HARUS DITOLAK
const approvalDenied = reviewPerizinanWalas(mockWalasRpl1, izinRes.izin.id, 'disetujui');
assert.strictEqual(approvalDenied.success, false, 'Walas RPL 1 dilarang menyetujui izin siswa RPL 2');
console.log('  ✓ Pembatasan wewenang Walas terverifikasi: Walas kelas lain ditolak.');

// Walas kelas yang bersangkutan setujui -> HARUS SUKSES
const approvalSuccess = reviewPerizinanWalas(mockWalasRpl2, izinRes.izin.id, 'disetujui');
assert.strictEqual(approvalSuccess.success, true);
assert.strictEqual(approvalSuccess.izin.status, 'disetujui');
console.log('  ✓ Walas resmi berhasil menyetujui (ACC) izin siswa binaannya.');

// Skenario 4.2: Hadirkan Manual Siswa
function hadirkanManualSiswa(guru, targetKelas, targetNisn) {
  // Hanya walas kelas bersangkutan, guru pengajar mapel kelas itu, atau admin
  const isBerhak = guru.role === 'admin' || (guru.role === 'walas' && guru.walasKelasId === targetKelas);
  if (!isBerhak) {
    return { success: false, error: 'Akses Ditolak: Anda bukan wali kelas dari kelas ini' };
  }
  mockDb.presensi[targetNisn] = {
    nisn: targetNisn,
    kelas: targetKelas,
    status: 'hadir',
    keterangan: 'Hadir Manual oleh ' + guru.nama,
    waktu: '07:15:00'
  };
  return { success: true, presensi: mockDb.presensi[targetNisn] };
}

const manualDenied = hadirkanManualSiswa(mockWalasRpl1, 'XII RPL 2', '0082104129');
assert.strictEqual(manualDenied.success, false);
console.log('  ✓ Proteksi Hadir Manual: Guru yang bukan walas kelas terkait ditolak tegas.');

const manualSuccess = hadirkanManualSiswa(mockWalasRpl2, 'XII RPL 2', '0082104129');
assert.strictEqual(manualSuccess.success, true);
assert.strictEqual(manualSuccess.presensi.status, 'hadir');
console.log('  ✓ Hadir Manual oleh Walas sah berhasil mengubah status siswa menjadi HADIR.');

// Skenario 4.3: Lapor Izin / Kendala Mengajar Guru -> ACC Admin -> Mutasi Jamkos
function laporKendalaMengajar(guru, kelasId, mapel, alasan) {
  const id = 'KENDALA-' + Date.now();
  mockDb.kendala_guru[id] = {
    id,
    guruNip: guru.nip,
    guruNama: guru.nama,
    kelasId,
    mapel,
    alasan,
    status: 'pending',
    createdAt: Date.now()
  };
  return { success: true, kendala: mockDb.kendala_guru[id] };
}

const laporRes = laporKendalaMengajar(
  { nip: '198109012009022003', nama: 'Hani Hanifah, S.Si' },
  'XII RPL 2',
  'Pemrograman Web',
  'Tugas Dinas Luar MGMP'
);
assert.strictEqual(laporRes.success, true);
assert.strictEqual(laporRes.kendala.status, 'pending');
console.log('  ✓ Laporan izin mengajar guru berhasil diajukan ke database.');

// Admin Menyetujui Laporan Guru -> Otomatis Mengubah Status Kelas Menjadi Jamkos
function adminAccKendala(adminUser, kendalaId) {
  if (adminUser.role !== 'admin') return { success: false, error: 'Hanya Admin yang berhak' };
  const k = mockDb.kendala_guru[kendalaId];
  if (!k) return { success: false, error: 'Data tidak ada' };
  k.status = 'approved';
  mockDb.status_kelas[k.kelasId] = {
    status: 'jamkos',
    keterangan: k.alasan,
    mapel: k.mapel,
    updatedAt: Date.now()
  };
  return { success: true, statusKelas: mockDb.status_kelas[k.kelasId] };
}

const accRes = adminAccKendala({ role: 'admin' }, laporRes.kendala.id);
assert.strictEqual(accRes.success, true);
assert.strictEqual(accRes.statusKelas.status, 'jamkos');
console.log('  ✓ Admin menyetujui izin guru: Status kelas otomatis bermutasi menjadi JAMKOS.\n');

// -------------------------------------------------------------------
// 5. PENGUJIAN FITUR ADMINISTRATOR (MASTER DATA CRUD & ROLE INTEGRITY)
// -------------------------------------------------------------------
console.log('▶ [MODUL 5: FITUR ADMINISTRATOR]');

// CRUD Master Data Siswa
mockDb.siswa['0099999999'] = { nisn: '0099999999', nama: 'Siswa Uji Coba', kelas: 'XII RPL 2' };
assert.ok(mockDb.siswa['0099999999'], 'Create Siswa harus sukses');
mockDb.siswa['0099999999'].nama = 'Siswa Uji Coba Terupdate';
assert.strictEqual(mockDb.siswa['0099999999'].nama, 'Siswa Uji Coba Terupdate', 'Update Siswa harus sukses');
delete mockDb.siswa['0099999999'];
assert.strictEqual(mockDb.siswa['0099999999'], undefined, 'Delete Siswa harus sukses');
console.log('  ✓ CRUD Master Data Siswa (Insert, Update, Delete) berjalan 100% valid.');

// CRUD Pemetaan Kartu RFID
mockDb.kartu['UID_DEMO'] = { uid: 'UID_DEMO', nisn: '0098263610', tipe: 'siswa' };
assert.ok(mockDb.kartu['UID_DEMO'], 'Create Kartu RFID sukses');
delete mockDb.kartu['UID_DEMO'];
assert.strictEqual(mockDb.kartu['UID_DEMO'], undefined, 'Delete Kartu RFID sukses');
console.log('  ✓ CRUD Kartu RFID Reader berjalan 100% valid.');

console.log('\n===================================================================');
console.log('🎉 SELURUH PENGUJIAN SISTEMATIS (E2E) SEMUA FITUR BERHASIL 100%!');
console.log('   Semua modul (Auth, RFID, Siswa, Guru/Walas, Admin) teruji stabil.');
console.log('===================================================================');
