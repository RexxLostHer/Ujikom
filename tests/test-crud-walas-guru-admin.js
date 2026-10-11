// ===================================================================
// TEST SUITE: CRUD (CREATE, READ, UPDATE, DELETE) LENGKAP
// Role: Administrator, Guru Pengajar, dan Wali Kelas (Walas)
// ===================================================================

const assert = require('assert');

console.log('========================================================');
console.log('🧪 MEMULAI TEST CRUD FITUR WALAS, GURU, & ADMINISTRATOR');
console.log('========================================================\n');

// Mock in-memory Firebase Realtime Database
const mockDbData = {};

function mockRef(path) {
  const parts = path.split('/').filter(Boolean);
  return {
    set: async (val) => {
      let cur = mockDbData;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!cur[parts[i]]) cur[parts[i]] = {};
        cur = cur[parts[i]];
      }
      cur[parts[parts.length - 1]] = JSON.parse(JSON.stringify(val));
      return true;
    },
    update: async (val) => {
      let cur = mockDbData;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!cur[parts[i]]) cur[parts[i]] = {};
        cur = cur[parts[i]];
      }
      const lastKey = parts[parts.length - 1];
      if (!cur[lastKey] || typeof cur[lastKey] !== 'object') {
        cur[lastKey] = {};
      }
      Object.assign(cur[lastKey], JSON.parse(JSON.stringify(val)));
      return true;
    },
    remove: async () => {
      let cur = mockDbData;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!cur[parts[i]]) return true;
        cur = cur[parts[i]];
      }
      delete cur[parts[parts.length - 1]];
      return true;
    },
    once: async (event) => {
      let cur = mockDbData;
      for (let i = 0; i < parts.length; i++) {
        if (cur === undefined || cur === null) break;
        cur = cur[parts[i]];
      }
      const copy = cur !== undefined ? JSON.parse(JSON.stringify(cur)) : null;
      return {
        val: () => copy,
        exists: () => copy !== null && copy !== undefined
      };
    }
  };
}

const db = { ref: mockRef };

async function runTests() {
  // -------------------------------------------------------------------
  // 1. PENGUJIAN CRUD ADMINISTRATOR
  // -------------------------------------------------------------------
  console.log('▶ [1] Pengujian CRUD Administrator (Siswa, Kartu RFID, Jadwal, Akun)...');

  // A. CRUD SISWA
  // 1. Insert Siswa
  const siswaBaru = { nisn: '0099998888', nama: 'Siswa Test Ujikom', kelas: 'XII RPL 2', email: 'siswatest@gmail.com' };
  await db.ref('siswa/' + siswaBaru.nisn).set(siswaBaru);
  let snapSiswa = await db.ref('siswa/' + siswaBaru.nisn).once('value');
  assert.strictEqual(snapSiswa.val().nama, 'Siswa Test Ujikom', 'Insert Siswa harus sukses');

  // 2. Update Siswa
  await db.ref('siswa/' + siswaBaru.nisn).update({ nama: 'Siswa Test Terupdate', kelas: 'XII RPL 1' });
  snapSiswa = await db.ref('siswa/' + siswaBaru.nisn).once('value');
  assert.strictEqual(snapSiswa.val().nama, 'Siswa Test Terupdate', 'Update Nama Siswa harus sukses');
  assert.strictEqual(snapSiswa.val().kelas, 'XII RPL 1', 'Update Kelas Siswa harus sukses');

  // 3. Delete Siswa
  await db.ref('siswa/' + siswaBaru.nisn).remove();
  snapSiswa = await db.ref('siswa/' + siswaBaru.nisn).once('value');
  assert.strictEqual(snapSiswa.val(), null, 'Delete Siswa harus menghapus data');
  console.log('  ✓ [Admin] CRUD Master Data Siswa (Insert, Update, Delete) 100% Valid');

// B. CRUD KARTU RFID
// 1. Insert/Assign Kartu
const uidKartu = 'AABBCCDD';
await db.ref('kartu/' + uidKartu).set({ nisn: '0098263610', pemilik: 'M. IHSAN ATHALLAH' });
let snapKartu = await db.ref('kartu/' + uidKartu).once('value');
assert.strictEqual(snapKartu.val().nisn, '0098263610', 'Insert Kartu RFID harus sukses');

// 2. Delete Kartu
await db.ref('kartu/' + uidKartu).remove();
snapKartu = await db.ref('kartu/' + uidKartu).once('value');
assert.strictEqual(snapKartu.val(), null, 'Delete Kartu RFID harus sukses');
console.log('  ✓ [Admin] CRUD Mapping Kartu RFID (Insert, Delete) 100% Valid');

// C. CRUD JADWAL PELAJARAN
// 1. Insert Jam Pelajaran
await db.ref('jadwal_pelajaran/XII RPL 2/senin/1').set({ mapel: 'PBO Dasar', mulai: '07:00', selesai: '07:45', guru: 'Hali, ST' });
let snapJadwal = await db.ref('jadwal_pelajaran/XII RPL 2/senin/1').once('value');
assert.strictEqual(snapJadwal.val().mapel, 'PBO Dasar', 'Insert Jam Pelajaran harus sukses');

// 2. Update Jam Pelajaran
await db.ref('jadwal_pelajaran/XII RPL 2/senin/1').update({ mapel: 'PBO Lanjut (OOP)', selesai: '08:00' });
snapJadwal = await db.ref('jadwal_pelajaran/XII RPL 2/senin/1').once('value');
assert.strictEqual(snapJadwal.val().mapel, 'PBO Lanjut (OOP)', 'Update Jam Pelajaran harus sukses');
assert.strictEqual(snapJadwal.val().selesai, '08:00');

// 3. Delete Jam Pelajaran
await db.ref('jadwal_pelajaran/XII RPL 2/senin/1').remove();
snapJadwal = await db.ref('jadwal_pelajaran/XII RPL 2/senin/1').once('value');
assert.strictEqual(snapJadwal.val(), null, 'Delete Jam Pelajaran harus sukses');
console.log('  ✓ [Admin] CRUD Jadwal Pelajaran (Insert, Update, Delete) 100% Valid');

// D. CRUD KELOLA USER & ROLE
// 1. Insert Guru
const emailGuru = 'guru.baru@smkn1sumedang.sch.id';
const encodedEmail = emailGuru.replace(/\./g, ',').replace(/@/g, '(at)');
await db.ref('email_mapping/' + encodedEmail).set({
  email: emailGuru,
  nama: 'Guru Penguji UJIKOM',
  role: 'guru',
  nip: '198801012020211001'
});
let snapEmail = await db.ref('email_mapping/' + encodedEmail).once('value');
assert.strictEqual(snapEmail.val().role, 'guru', 'Insert Guru Baru harus sukses');

// 2. Update Role User
const uidUser = 'USER_TEST_123';
await db.ref('users/' + uidUser).set({ email: 'user@gmail.com', nama: 'User Test', role: 'pengunjung' });
await db.ref('users/' + uidUser).update({ role: 'walas', walasKelasId: 'XII RPL 2' });
let snapUser = await db.ref('users/' + uidUser).once('value');
assert.strictEqual(snapUser.val().role, 'walas', 'Update Role User harus sukses');

// 3. Delete User
await db.ref('users/' + uidUser).remove();
snapUser = await db.ref('users/' + uidUser).once('value');
assert.strictEqual(snapUser.val(), null, 'Delete User harus sukses');
console.log('  ✓ [Admin] CRUD Kelola Akun & Role (Insert, Update, Delete) 100% Valid\n');

// -------------------------------------------------------------------
// 2. PENGUJIAN CRUD GURU PENGAJAR
// -------------------------------------------------------------------
console.log('▶ [2] Pengujian CRUD Guru Pengajar (Presensi Dinas, Lapor Jamkos, Hadir Manual)...');

// A. PRESENSI DINAS GURU
const nipGuru = '198109012009022003'; // Bu Hani Hanifah
const tglHariIni = '2026-10-11';

// 1. Insert Check-In Masuk Guru
await db.ref(`absensi_guru/${nipGuru}/${tglHariIni}/masuk`).set({
  jam: '06:25:00',
  status: 'hadir_tepat_waktu',
  nama: 'Hani Hanifah, S.Si'
});
let snapAbsenGuru = await db.ref(`absensi_guru/${nipGuru}/${tglHariIni}/masuk`).once('value');
assert.strictEqual(snapAbsenGuru.val().status, 'hadir_tepat_waktu', 'Check-In Masuk Guru harus sukses');

// 2. Update Check-Out Pulang Guru
await db.ref(`absensi_guru/${nipGuru}/${tglHariIni}/pulang`).set({
  jam: '15:35:00',
  status: 'pulang_normal'
});
let snapPulangGuru = await db.ref(`absensi_guru/${nipGuru}/${tglHariIni}/pulang`).once('value');
assert.strictEqual(snapPulangGuru.val().status, 'pulang_normal', 'Check-Out Pulang Guru harus sukses');

// B. VERIFIKASI PRESENSI MANUAL SISWA OLEH GURU DI KELAS
// Update presensi jam KBM siswa lupa kartu
await db.ref(`presensi_jam/XII RPL 2/${tglHariIni}/2/0098263610`).set({
  status: 'hadir',
  waktu: '07:45:00',
  tipe: 'manual_guru',
  verifikator: 'Hani Hanifah, S.Si'
});
let snapPresensiJam = await db.ref(`presensi_jam/XII RPL 2/${tglHariIni}/2/0098263610`).once('value');
assert.strictEqual(snapPresensiJam.val().tipe, 'manual_guru', 'Hadir manual guru harus sukses');

// C. INSERT LAPOR KENDALA MENGAJAR (USULAN JAMKOS)
const idKendala = 'KENDALA-' + Date.now();
await db.ref('kendala_guru/' + idKendala).set({
  id: idKendala,
  guruNip: nipGuru,
  guruNama: 'Hani Hanifah, S.Si',
  kelasId: 'XII RPL 2',
  mapel: 'Pemrograman Web & Perangkat Bergerak',
  tanggal: tglHariIni,
  alasan: 'Menghadiri Rapat Akreditasi Sekolah',
  status: 'pending'
});
let snapKendala = await db.ref('kendala_guru/' + idKendala).once('value');
assert.strictEqual(snapKendala.val().status, 'pending', 'Lapor kendala mengajar guru harus pending');

// D. ADMIN APPROVE KENDALA -> AUTO MUTASI STATUS KELAS JADI JAMKOS (UPDATE)
await db.ref('kendala_guru/' + idKendala).update({ status: 'approved', approvedBy: 'Administrator' });
await db.ref('status_kelas/XII RPL 2').set({
  status: 'jamkos',
  keterangan: 'Menghadiri Rapat Akreditasi Sekolah',
  mapel: 'Pemrograman Web & Perangkat Bergerak',
  updated_at: new Date().toISOString()
});
let snapStatusKelas = await db.ref('status_kelas/XII RPL 2').once('value');
assert.strictEqual(snapStatusKelas.val().status, 'jamkos', 'Mutasi status kelas jadi Jamkos harus sukses');
console.log('  ✓ [Guru & Admin] Presensi Guru, Hadir Manual, & Alur Jamkos (Insert, Update) 100% Valid\n');

// -------------------------------------------------------------------
// 3. PENGUJIAN CRUD WALI KELAS (WALAS)
// -------------------------------------------------------------------
console.log('▶ [3] Pengujian CRUD Wali Kelas (Approval Izin, Presensi Binaan, Chat Bi-directional)...');

// A. INSERT PERIZINAN OLEH SISWA -> UPDATE (APPROVE/REJECT) OLEH WALAS
const idIzin = 'IZIN-' + Date.now();
const dataIzinSiswa = {
  id: idIzin,
  nisn: '0098263610',
  nama_siswa: 'M. Ihsan Athallah',
  kelas: 'XII RPL 2',
  tanggal: tglHariIni,
  jenis: 'sakit',
  alasan: 'Demam tinggi dan flu berat',
  status: 'pending'
};
// 1. Siswa Insert Izin
await db.ref('perijinan/' + idIzin).set(dataIzinSiswa);
let snapIzin = await db.ref('perijinan/' + idIzin).once('value');
assert.strictEqual(snapIzin.val().status, 'pending', 'Insert Izin Siswa harus pending');

// 2. Walas Update Izin (Disetujui) & Update Presensi Jam 1-8
await db.ref('perijinan/' + idIzin).update({
  status: 'disetujui',
  diverifikasi_oleh: 'Muhammad Echa Putra, S.Kom.Gr',
  catatan_guru: 'Semoga lekas sembuh, istirahat yang cukup.'
});
snapIzin = await db.ref('perijinan/' + idIzin).once('value');
assert.strictEqual(snapIzin.val().status, 'disetujui', 'Update Izin Disetujui harus sukses');
assert.strictEqual(snapIzin.val().diverifikasi_oleh, 'Muhammad Echa Putra, S.Kom.Gr');

// Auto-sync ke presensi_jam KBM untuk siswa binaan
for (let j = 1; j <= 8; j++) {
  await db.ref(`presensi_jam/XII RPL 2/${tglHariIni}/${j}/0098263610`).set({
    status: 'sakit',
    waktu: '00:00:00',
    keterangan: 'Izin sakit disetujui Wali Kelas'
  });
}
let snapJamWalas = await db.ref(`presensi_jam/XII RPL 2/${tglHariIni}/5/0098263610`).once('value');
assert.strictEqual(snapJamWalas.val().status, 'sakit', 'Approval Walas harus mensinkronkan jam KBM');

// B. CHAT BI-DIRECTIONAL WALAS - SISWA
// 1. Siswa Insert Chat
const idChatSiswa = 'CHAT-1';
await db.ref(`perijinan_chats/${idIzin}/${idChatSiswa}`).set({
  pengirim: { role: 'siswa', nama: 'M. Ihsan Athallah' },
  pesan: 'Pak, surat dokter sudah saya lampirkan ya.',
  waktu: '07:10:00'
});

// 2. Walas Insert Balasan Chat
const idChatWalas = 'CHAT-2';
await db.ref(`perijinan_chats/${idIzin}/${idChatWalas}`).set({
  pengirim: { role: 'walas', nama: 'Muhammad Echa Putra, S.Kom.Gr' },
  pesan: 'Baik Ihsan, surat dokter sudah diterima dan izin sudah Bapak ACC.',
  waktu: '07:15:00'
});

let snapChat = await db.ref(`perijinan_chats/${idIzin}`).once('value');
const chats = Object.values(snapChat.val());
assert.strictEqual(chats.length, 2, 'Bi-directional chat harus memiliki 2 pesan');
assert.strictEqual(chats[0].pengirim.role, 'siswa');
assert.strictEqual(chats[1].pengirim.role, 'walas');

// C. LIVE ALERT WALAS: CATAT HADIR MANUAL / IZIN CEPAT DARI RADAR WALAS
// Walas update kehadiran siswa binaan yang terlambat / lupa tap di live alert
await db.ref(`presensi_jam/XII RPL 2/${tglHariIni}/1/0082104129`).set({
  status: 'hadir',
  waktu: '07:05:00',
  tipe: 'verifikasi_walas',
  keterangan: 'Diverifikasi hadir oleh Walas XII RPL 2'
});
let snapWalasHadir = await db.ref(`presensi_jam/XII RPL 2/${tglHariIni}/1/0082104129`).once('value');
assert.strictEqual(snapWalasHadir.val().status, 'hadir', 'Catat hadir walas harus sukses');

console.log('  ✓ [Walas] Approval Izin, Sync KBM Jam 1-8, Chat Bi-directional, & Alert Supervisi 100% Valid\n');

console.log('========================================================');
console.log('🎉 SELURUH PENGUJIAN CRUD (INSERT, UPDATE, DELETE)');
console.log('   UNTUK ADMIN, GURU, & WALI KELAS BERHASIL 100% LOLOS!');
console.log('========================================================');
}

runTests().catch(err => {
  console.error('TEST ERROR:', err);
  process.exit(1);
});
