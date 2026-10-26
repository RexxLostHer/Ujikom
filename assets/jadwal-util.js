// Fungsi bersama seputar tanggal/jam pelajaran -- dipakai admin.js (fitur simulasi absen)
// dan presensi-live.js, biar logicnya konsisten di satu tempat aja.

function tanggalHariIni() {
  if (typeof getTanggalHariIniWIB === 'function') return getTanggalHariIniWIB();
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function jamSekarang() {
  if (typeof getJamSekarangWIB === 'function') return getJamSekarangWIB().slice(0, 5);
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// "2026-09-15" -> "selasa". Dipakai buat lookup jadwal pulang per-hari (jadwal/{kelas}/{hari}),
// karena jam pulang beda-beda tiap hari (misal Rabu bisa lebih pendek/panjang dari hari lain).
function namaHariDariTanggal(tanggalStr) {
  const namaHariList = ['minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];
  const d = new Date(tanggalStr + 'T00:00:00');
  return namaHariList[d.getDay()];
}

// Cari jam ke berapa yang sedang aktif berdasarkan waktu sekarang.
// Mendukung format flat { "1": {...} } maupun format pohon multi-hari { "senin": {...} }
// return null kalau nggak lagi ada jam pelajaran (istirahat/di luar jam sekolah)
function cariJamKeAktif(jadwalPelajaran, waktuSekarang) {
  if (!jadwalPelajaran) return null;
  let target = jadwalPelajaran;
  const listHari = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'];
  if (typeof target === 'object' && listHari.some(h => target[h] && typeof target[h] === 'object')) {
    const hariIni = (typeof namaHariDariTanggal === 'function') ? namaHariDariTanggal(tanggalHariIni()) : 'senin';
    const hariAktif = (hariIni === 'sabtu' || hariIni === 'minggu') ? 'senin' : hariIni;
    target = target[hariAktif] || {};
  }
  const jamKeList = Object.keys(target);
  for (let i = 0; i < jamKeList.length; i++) {
    const jamKe = jamKeList[i];
    const p = target[jamKe];
    if (p && p.mulai && p.selesai && waktuSekarang >= p.mulai && waktuSekarang < p.selesai) {
      return { jam_ke: jamKe, mapel: p.mapel, mulai: p.mulai, selesai: p.selesai, guru: p.guru };
    }
  }
  return null;
}

// ===================================================================
// MASTER JADWAL PELAJARAN RESMI 3 KELAS PILOT (SENIN s/d JUMAT)
// Kurikulum Resmi Rekayasa Perangkat Lunak & TKJ SMKN 1 Sumedang
// ===================================================================
var JAM_PULANG_RESMI = {
  'senin': '15:30',
  'selasa': '15:30',
  'rabu': '15:30',
  'kamis': '15:30',
  'jumat': '11:45'
};

var MASTER_JADWAL_RESMI = {
  'XII RPL 1': {
    'senin': {
      '1': { mapel: 'Upacara Bendera & Penguatan Karakter', guru: 'Pembina Upacara', mulai: '07:00', selesai: '07:45' },
      '2': { mapel: 'Administrasi Infrastruktur Jaringan', guru: 'Rijal Nur Rahmat, S.T', mulai: '07:45', selesai: '08:30' },
      '3': { mapel: 'Administrasi Infrastruktur Jaringan', guru: 'Rijal Nur Rahmat, S.T', mulai: '08:30', selesai: '09:15' },
      '4': { mapel: 'Administrasi Infrastruktur Jaringan', guru: 'Rijal Nur Rahmat, S.T', mulai: '09:30', selesai: '10:15' },
      '5': { mapel: 'Pemrograman Web Lanjut', guru: 'Hani Hanifah, S.Si', mulai: '10:15', selesai: '11:00' },
      '6': { mapel: 'Pemrograman Web Lanjut', guru: 'Hani Hanifah, S.Si', mulai: '11:00', selesai: '11:45' },
      '7': { mapel: 'Produk Kreatif & Kewirausahaan (PKK)', guru: 'Guru Pengajar RPL', mulai: '12:45', selesai: '13:30' },
      '8': { mapel: 'Produk Kreatif & Kewirausahaan (PKK)', guru: 'Guru Pengajar RPL', mulai: '13:30', selesai: '14:15' },
      '9': { mapel: 'Produk Kreatif & Kewirausahaan (PKK)', guru: 'Guru Pengajar RPL', mulai: '14:15', selesai: '15:30' }
    },
    'selasa': {
      '1': { mapel: 'Pemrograman Berorientasi Objek', guru: 'Hali, ST', mulai: '07:00', selesai: '07:45' },
      '2': { mapel: 'Pemrograman Berorientasi Objek', guru: 'Hali, ST', mulai: '07:45', selesai: '08:30' },
      '3': { mapel: 'Pemrograman Berorientasi Objek', guru: 'Hali, ST', mulai: '08:30', selesai: '09:15' },
      '4': { mapel: 'Basis Data Relasional', guru: 'Muhammad Echa Putra, S.Kom.Gr', mulai: '09:30', selesai: '10:15' },
      '5': { mapel: 'Basis Data Relasional', guru: 'Muhammad Echa Putra, S.Kom.Gr', mulai: '10:15', selesai: '11:00' },
      '6': { mapel: 'Bahasa Indonesia', guru: 'Guru Mapel Umum', mulai: '11:00', selesai: '11:45' },
      '7': { mapel: 'Bahasa Indonesia', guru: 'Guru Mapel Umum', mulai: '12:45', selesai: '13:30' },
      '8': { mapel: 'Matematika Terapan', guru: 'Guru Mapel Umum', mulai: '13:30', selesai: '14:15' },
      '9': { mapel: 'Matematika Terapan', guru: 'Guru Mapel Umum', mulai: '14:15', selesai: '15:30' }
    },
    'rabu': {
      '1': { mapel: 'Pemrograman Web & Perangkat Bergerak', guru: 'Hani Hanifah, S.Si', mulai: '07:00', selesai: '07:45' },
      '2': { mapel: 'Pemrograman Web & Perangkat Bergerak', guru: 'Hani Hanifah, S.Si', mulai: '07:45', selesai: '08:30' },
      '3': { mapel: 'Pemrograman Web & Perangkat Bergerak', guru: 'Hani Hanifah, S.Si', mulai: '08:30', selesai: '09:15' },
      '4': { mapel: 'Pemrograman Web & Perangkat Bergerak', guru: 'Hani Hanifah, S.Si', mulai: '09:30', selesai: '10:15' },
      '5': { mapel: 'Cloud Architecture & Server', guru: 'Rijal Nur Rahmat, S.T', mulai: '10:15', selesai: '11:00' },
      '6': { mapel: 'Cloud Architecture & Server', guru: 'Rijal Nur Rahmat, S.T', mulai: '11:00', selesai: '11:45' },
      '7': { mapel: 'UKK Lab & Asesmen Mandiri RPL', guru: 'Rijal Nur Rahmat, S.T', mulai: '12:45', selesai: '13:30' },
      '8': { mapel: 'UKK Lab & Asesmen Mandiri RPL', guru: 'Rijal Nur Rahmat, S.T', mulai: '13:30', selesai: '14:15' },
      '9': { mapel: 'UKK Lab & Asesmen Mandiri RPL', guru: 'Rijal Nur Rahmat, S.T', mulai: '14:15', selesai: '15:30' }
    },
    'kamis': {
      '1': { mapel: 'Produk Kreatif & Kewirausahaan (PKK)', guru: 'Guru Pengajar RPL', mulai: '07:00', selesai: '07:45' },
      '2': { mapel: 'Produk Kreatif & Kewirausahaan (PKK)', guru: 'Guru Pengajar RPL', mulai: '07:45', selesai: '08:30' },
      '3': { mapel: 'Produk Kreatif & Kewirausahaan (PKK)', guru: 'Guru Pengajar RPL', mulai: '08:30', selesai: '09:15' },
      '4': { mapel: 'Pemodelan Perangkat Lunak (UML)', guru: 'Hali, ST', mulai: '09:30', selesai: '10:15' },
      '5': { mapel: 'Pemodelan Perangkat Lunak (UML)', guru: 'Hali, ST', mulai: '10:15', selesai: '11:00' },
      '6': { mapel: 'Bahasa Inggris Kejuruan', guru: 'Guru Mapel Umum', mulai: '11:00', selesai: '11:45' },
      '7': { mapel: 'Bahasa Inggris Kejuruan', guru: 'Guru Mapel Umum', mulai: '12:45', selesai: '13:30' },
      '8': { mapel: 'Pengujian & QA Perangkat Lunak', guru: 'Rijal Nur Rahmat, S.T', mulai: '13:30', selesai: '14:15' },
      '9': { mapel: 'Pengujian & QA Perangkat Lunak', guru: 'Rijal Nur Rahmat, S.T', mulai: '14:15', selesai: '15:30' }
    },
    'jumat': {
      '1': { mapel: 'Pendidikan Agama Islam & Budi Pekerti', guru: 'Guru PAI', mulai: '07:00', selesai: '07:45' },
      '2': { mapel: 'Pendidikan Agama Islam & Budi Pekerti', guru: 'Guru PAI', mulai: '07:45', selesai: '08:30' },
      '3': { mapel: 'Penjasorkes (Kebugaran Jasmani)', guru: 'Guru PJOK', mulai: '08:30', selesai: '09:15' },
      '4': { mapel: 'Penjasorkes (Kebugaran Jasmani)', guru: 'Guru PJOK', mulai: '09:30', selesai: '10:15' },
      '5': { mapel: 'Bimbingan Wali Kelas XII RPL 1', guru: 'Rijal Nur Rahmat, S.T', mulai: '10:15', selesai: '11:00' },
      '6': { mapel: 'Evaluasi Disiplin Mingguan', guru: 'Rijal Nur Rahmat, S.T', mulai: '11:00', selesai: '11:45' }
    }
  },
  'XII RPL 2': {
    'senin': {
      '1': { mapel: 'Upacara Bendera & Penguatan Karakter', guru: 'Pembina Upacara', mulai: '07:00', selesai: '07:45' },
      '2': { mapel: 'Pemrograman Web & Perangkat Bergerak', guru: 'Hani Hanifah, S.Si', mulai: '07:45', selesai: '08:30' },
      '3': { mapel: 'Pemrograman Web & Perangkat Bergerak', guru: 'Hani Hanifah, S.Si', mulai: '08:30', selesai: '09:15' },
      '4': { mapel: 'Pemrograman Web & Perangkat Bergerak', guru: 'Hani Hanifah, S.Si', mulai: '09:30', selesai: '10:15' },
      '5': { mapel: 'Basis Data & Cloud Architecture', guru: 'Muhammad Echa Putra, S.Kom.Gr', mulai: '10:15', selesai: '11:00' },
      '6': { mapel: 'Basis Data & Cloud Architecture', guru: 'Muhammad Echa Putra, S.Kom.Gr', mulai: '11:00', selesai: '11:45' },
      '7': { mapel: 'Produk Kreatif & Kewirausahaan (PKK)', guru: 'Guru Pengajar RPL', mulai: '12:45', selesai: '13:30' },
      '8': { mapel: 'Produk Kreatif & Kewirausahaan (PKK)', guru: 'Guru Pengajar RPL', mulai: '13:30', selesai: '14:15' },
      '9': { mapel: 'Produk Kreatif & Kewirausahaan (PKK)', guru: 'Guru Pengajar RPL', mulai: '14:15', selesai: '15:30' }
    },
    'selasa': {
      '1': { mapel: 'Basis Data & Pemodelan RPL', guru: 'Muhammad Echa Putra, S.Kom.Gr', mulai: '07:00', selesai: '07:45' },
      '2': { mapel: 'Basis Data & Pemodelan RPL', guru: 'Muhammad Echa Putra, S.Kom.Gr', mulai: '07:45', selesai: '08:30' },
      '3': { mapel: 'Pemrograman Berorientasi Objek', guru: 'Hali, ST', mulai: '08:30', selesai: '09:15' },
      '4': { mapel: 'Pemrograman Berorientasi Objek', guru: 'Hali, ST', mulai: '09:30', selesai: '10:15' },
      '5': { mapel: 'Pemrograman Berorientasi Objek', guru: 'Hali, ST', mulai: '10:15', selesai: '11:00' },
      '6': { mapel: 'Bahasa Indonesia', guru: 'Guru Mapel Umum', mulai: '11:00', selesai: '11:45' },
      '7': { mapel: 'Bahasa Indonesia', guru: 'Guru Mapel Umum', mulai: '12:45', selesai: '13:30' },
      '8': { mapel: 'Matematika Terapan', guru: 'Guru Mapel Umum', mulai: '13:30', selesai: '14:15' },
      '9': { mapel: 'Matematika Terapan', guru: 'Guru Mapel Umum', mulai: '14:15', selesai: '15:30' }
    },
    'rabu': {
      '1': { mapel: 'Pemrograman Web & Perangkat Bergerak', guru: 'Hani Hanifah, S.Si', mulai: '07:00', selesai: '07:45' },
      '2': { mapel: 'Pemrograman Web & Perangkat Bergerak', guru: 'Hani Hanifah, S.Si', mulai: '07:45', selesai: '08:30' },
      '3': { mapel: 'Pemrograman Web & Perangkat Bergerak', guru: 'Hani Hanifah, S.Si', mulai: '08:30', selesai: '09:15' },
      '4': { mapel: 'Pemrograman Web & Perangkat Bergerak', guru: 'Hani Hanifah, S.Si', mulai: '09:30', selesai: '10:15' },
      '5': { mapel: 'Uji Kompetensi Keahlian (UKK Lab)', guru: 'Hani Hanifah, S.Si', mulai: '10:15', selesai: '11:00' },
      '6': { mapel: 'Uji Kompetensi Keahlian (UKK Lab)', guru: 'Hani Hanifah, S.Si', mulai: '11:00', selesai: '11:45' },
      '7': { mapel: 'Praktik Sistem IoT RFID & Presensi', guru: 'Tim Asesor UJIKOM', mulai: '12:45', selesai: '13:30' },
      '8': { mapel: 'Praktik Sistem IoT RFID & Presensi', guru: 'Tim Asesor UJIKOM', mulai: '13:30', selesai: '14:15' },
      '9': { mapel: 'Praktik Sistem IoT RFID & Presensi', guru: 'Tim Asesor UJIKOM', mulai: '14:15', selesai: '15:30' }
    },
    'kamis': {
      '1': { mapel: 'Pemodelan Perangkat Lunak (UML)', guru: 'Muhammad Echa Putra, S.Kom.Gr', mulai: '07:00', selesai: '07:45' },
      '2': { mapel: 'Pemodelan Perangkat Lunak (UML)', guru: 'Muhammad Echa Putra, S.Kom.Gr', mulai: '07:45', selesai: '08:30' },
      '3': { mapel: 'Pemodelan Perangkat Lunak (UML)', guru: 'Muhammad Echa Putra, S.Kom.Gr', mulai: '08:30', selesai: '09:15' },
      '4': { mapel: 'Produk Kreatif & Kewirausahaan', guru: 'Guru Pengajar RPL', mulai: '09:30', selesai: '10:15' },
      '5': { mapel: 'Produk Kreatif & Kewirausahaan', guru: 'Guru Pengajar RPL', mulai: '10:15', selesai: '11:00' },
      '6': { mapel: 'Bahasa Inggris Kejuruan', guru: 'Guru Mapel Umum', mulai: '11:00', selesai: '11:45' },
      '7': { mapel: 'Bahasa Inggris Kejuruan', guru: 'Guru Mapel Umum', mulai: '12:45', selesai: '13:30' },
      '8': { mapel: 'Proyek Kreatif Rekayasa Perangkat Lunak', guru: 'Muhammad Echa Putra, S.Kom.Gr', mulai: '13:30', selesai: '14:15' },
      '9': { mapel: 'Proyek Kreatif Rekayasa Perangkat Lunak', guru: 'Muhammad Echa Putra, S.Kom.Gr', mulai: '14:15', selesai: '15:30' }
    },
    'jumat': {
      '1': { mapel: 'Pendidikan Agama Islam & Budi Pekerti', guru: 'Guru PAI', mulai: '07:00', selesai: '07:45' },
      '2': { mapel: 'Pendidikan Agama Islam & Budi Pekerti', guru: 'Guru PAI', mulai: '07:45', selesai: '08:30' },
      '3': { mapel: 'Penjasorkes (Kebugaran Jasmani)', guru: 'Guru PJOK', mulai: '08:30', selesai: '09:15' },
      '4': { mapel: 'Penjasorkes (Kebugaran Jasmani)', guru: 'Guru PJOK', mulai: '09:30', selesai: '10:15' },
      '5': { mapel: 'Bimbingan Wali Kelas XII RPL 2', guru: 'Muhammad Echa Putra, S.Kom.Gr', mulai: '10:15', selesai: '11:00' },
      '6': { mapel: 'Evaluasi Mingguan KBM & Presensi', guru: 'Muhammad Echa Putra, S.Kom.Gr', mulai: '11:00', selesai: '11:45' }
    }
  },
  'XII TKJ 1': {
    'senin': {
      '1': { mapel: 'Upacara Bendera & Penguatan Karakter', guru: 'Pembina Upacara', mulai: '07:00', selesai: '07:45' },
      '2': { mapel: 'Teknologi Layanan Jaringan', guru: 'Heri Anggara, S.Kom', mulai: '07:45', selesai: '08:30' },
      '3': { mapel: 'Teknologi Layanan Jaringan', guru: 'Heri Anggara, S.Kom', mulai: '08:30', selesai: '09:15' },
      '4': { mapel: 'Teknologi Layanan Jaringan', guru: 'Heri Anggara, S.Kom', mulai: '09:30', selesai: '10:15' },
      '5': { mapel: 'Administrasi Sistem Jaringan (Linux)', guru: 'Heri Anggara, S.Kom', mulai: '10:15', selesai: '11:00' },
      '6': { mapel: 'Administrasi Sistem Jaringan (Linux)', guru: 'Heri Anggara, S.Kom', mulai: '11:00', selesai: '11:45' },
      '7': { mapel: 'Produk Kreatif & Kewirausahaan (PKK)', guru: 'Guru Pengajar TKJ', mulai: '12:45', selesai: '13:30' },
      '8': { mapel: 'Produk Kreatif & Kewirausahaan (PKK)', guru: 'Guru Pengajar TKJ', mulai: '13:30', selesai: '14:15' },
      '9': { mapel: 'Produk Kreatif & Kewirausahaan (PKK)', guru: 'Guru Pengajar TKJ', mulai: '14:15', selesai: '15:30' }
    },
    'selasa': {
      '1': { mapel: 'Administrasi Server & Cloud Network', guru: 'Heri Anggara, S.Kom', mulai: '07:00', selesai: '07:45' },
      '2': { mapel: 'Administrasi Server & Cloud Network', guru: 'Heri Anggara, S.Kom', mulai: '07:45', selesai: '08:30' },
      '3': { mapel: 'Administrasi Server & Cloud Network', guru: 'Heri Anggara, S.Kom', mulai: '08:30', selesai: '09:15' },
      '4': { mapel: 'Keamanan Jaringan & Firewall Cyber', guru: 'Heri Anggara, S.Kom', mulai: '09:30', selesai: '10:15' },
      '5': { mapel: 'Keamanan Jaringan & Firewall Cyber', guru: 'Heri Anggara, S.Kom', mulai: '10:15', selesai: '11:00' },
      '6': { mapel: 'Bahasa Indonesia', guru: 'Guru Mapel Umum', mulai: '11:00', selesai: '11:45' },
      '7': { mapel: 'Bahasa Indonesia', guru: 'Guru Mapel Umum', mulai: '12:45', selesai: '13:30' },
      '8': { mapel: 'Matematika Terapan', guru: 'Guru Mapel Umum', mulai: '13:30', selesai: '14:15' },
      '9': { mapel: 'Matematika Terapan', guru: 'Guru Mapel Umum', mulai: '14:15', selesai: '15:30' }
    },
    'rabu': {
      '1': { mapel: 'Teknologi Jaringan Berbasis Luas (WAN)', guru: 'Heri Anggara, S.Kom', mulai: '07:00', selesai: '07:45' },
      '2': { mapel: 'Teknologi Jaringan Berbasis Luas (WAN)', guru: 'Heri Anggara, S.Kom', mulai: '07:45', selesai: '08:30' },
      '3': { mapel: 'Teknologi Jaringan Berbasis Luas (WAN)', guru: 'Heri Anggara, S.Kom', mulai: '08:30', selesai: '09:15' },
      '4': { mapel: 'Teknologi Jaringan Berbasis Luas (WAN)', guru: 'Heri Anggara, S.Kom', mulai: '09:30', selesai: '10:15' },
      '5': { mapel: 'Praktik Router Mikrotik & Cisco', guru: 'Heri Anggara, S.Kom', mulai: '10:15', selesai: '11:00' },
      '6': { mapel: 'Praktik Router Mikrotik & Cisco', guru: 'Heri Anggara, S.Kom', mulai: '11:00', selesai: '11:45' },
      '7': { mapel: 'Troubleshooting Jaringan Lab', guru: 'Heri Anggara, S.Kom', mulai: '12:45', selesai: '13:30' },
      '8': { mapel: 'Troubleshooting Jaringan Lab', guru: 'Heri Anggara, S.Kom', mulai: '13:30', selesai: '14:15' },
      '9': { mapel: 'Troubleshooting Jaringan Lab', guru: 'Heri Anggara, S.Kom', mulai: '14:15', selesai: '15:30' }
    },
    'kamis': {
      '1': { mapel: 'Fiber Optic & Wireless Communication', guru: 'Heri Anggara, S.Kom', mulai: '07:00', selesai: '07:45' },
      '2': { mapel: 'Fiber Optic & Wireless Communication', guru: 'Heri Anggara, S.Kom', mulai: '07:45', selesai: '08:30' },
      '3': { mapel: 'Fiber Optic & Wireless Communication', guru: 'Heri Anggara, S.Kom', mulai: '08:30', selesai: '09:15' },
      '4': { mapel: 'Produk Kreatif & Kewirausahaan (PKK)', guru: 'Guru Pengajar TKJ', mulai: '09:30', selesai: '10:15' },
      '5': { mapel: 'Produk Kreatif & Kewirausahaan (PKK)', guru: 'Guru Pengajar TKJ', mulai: '10:15', selesai: '11:00' },
      '6': { mapel: 'Bahasa Inggris Kejuruan', guru: 'Guru Mapel Umum', mulai: '11:00', selesai: '11:45' },
      '7': { mapel: 'Bahasa Inggris Kejuruan', guru: 'Guru Mapel Umum', mulai: '12:45', selesai: '13:30' },
      '8': { mapel: 'Sistem IoT & Sensor Jaringan', guru: 'Heri Anggara, S.Kom', mulai: '13:30', selesai: '14:15' },
      '9': { mapel: 'Sistem IoT & Sensor Jaringan', guru: 'Heri Anggara, S.Kom', mulai: '14:15', selesai: '15:30' }
    },
    'jumat': {
      '1': { mapel: 'Pendidikan Agama Islam & Budi Pekerti', guru: 'Guru PAI', mulai: '07:00', selesai: '07:45' },
      '2': { mapel: 'Pendidikan Agama Islam & Budi Pekerti', guru: 'Guru PAI', mulai: '07:45', selesai: '08:30' },
      '3': { mapel: 'Penjasorkes (Kebugaran Jasmani)', guru: 'Guru PJOK', mulai: '08:30', selesai: '09:15' },
      '4': { mapel: 'Penjasorkes (Kebugaran Jasmani)', guru: 'Guru PJOK', mulai: '09:30', selesai: '10:15' },
      '5': { mapel: 'Bimbingan Wali Kelas XII TKJ 1', guru: 'Heri Anggara, S.Kom', mulai: '10:15', selesai: '11:00' },
      '6': { mapel: 'Evaluasi Mingguan KBM & Lab TKJ', guru: 'Heri Anggara, S.Kom', mulai: '11:00', selesai: '11:45' }
    }
  }
};

function ambilJadwalKelasHariIni(jadwalData, kelas, hari) {
  const normKelas = (typeof normalisasiKelas === 'function') ? normalisasiKelas(kelas) : (kelas || 'XII RPL 2');
  const namaHari = hari ? String(hari).toLowerCase() : namaHariDariTanggal(tanggalHariIni());
  const hariAktif = (namaHari === 'sabtu' || namaHari === 'minggu') ? 'senin' : namaHari;

  let targetData = jadwalData;
  if (targetData && typeof targetData === 'object') {
    if (targetData[normKelas] && typeof targetData[normKelas] === 'object') {
      targetData = targetData[normKelas];
    } else if (kelas && targetData[kelas] && typeof targetData[kelas] === 'object') {
      targetData = targetData[kelas];
    }
  }

  // Master schedule fallback reference
  const masterKelas = MASTER_JADWAL_RESMI[normKelas] || MASTER_JADWAL_RESMI['XII RPL 2'] || {};
  const masterHariIni = (masterKelas && masterKelas[hariAktif]) ? masterKelas[hariAktif] : ((masterKelas && masterKelas['senin']) || {});

  const listHari = ['senin', 'selasa', 'rabu', 'kamis', 'jumat'];
  const hasDayStructure = targetData && typeof targetData === 'object' && listHari.some(d => targetData[d] && typeof targetData[d] === 'object');

  // 1. Jika data terstruktur per-hari dan memiliki jam pelajaran di hariAktif
  if (hasDayStructure) {
    const dataHariIni = targetData[hariAktif];
    if (dataHariIni && typeof dataHariIni === 'object' && Object.keys(dataHariIni).length > 0) {
      // Gabungkan dengan master data agar tidak ada jam yang terputus
      const merged = Object.assign({}, masterHariIni, dataHariIni);
      return { hari: hariAktif, jadwal: merged, jamPulang: JAM_PULANG_RESMI[hariAktif] || '15:30' };
    }
    // Jika hariAktif belum ada di data target, gunakan master jadwal resmi hariAktif
    return {
      hari: hariAktif,
      jadwal: masterHariIni,
      jamPulang: JAM_PULANG_RESMI[hariAktif] || '15:30'
    };
  }

  // 2. Jika data flat (key '1', '2', dll.) tanpa struktur hari
  if (targetData && typeof targetData === 'object' && Object.keys(targetData).some(k => !isNaN(Number(k)))) {
    const hariIniReal = (typeof namaHariDariTanggal === 'function') ? namaHariDariTanggal(tanggalHariIni()) : 'senin';
    const isTodayOrSenin = (hariAktif === hariIniReal || hariAktif === 'senin');
    if (isTodayOrSenin) {
      const merged = Object.assign({}, masterHariIni, targetData);
      return { hari: hariAktif, jadwal: merged, jamPulang: JAM_PULANG_RESMI[hariAktif] || '15:30' };
    }
  }

  // 3. Fallback cerdas ke MASTER_JADWAL_RESMI
  return {
    hari: hariAktif,
    jadwal: masterHariIni,
    jamPulang: JAM_PULANG_RESMI[hariAktif] || '15:30'
  };
}

if (typeof window !== 'undefined') {
  window.tanggalHariIni = tanggalHariIni;
  window.jamSekarang = jamSekarang;
  window.namaHariDariTanggal = namaHariDariTanggal;
  window.cariJamKeAktif = cariJamKeAktif;
  window.MASTER_JADWAL_RESMI = MASTER_JADWAL_RESMI;
  window.JAM_PULANG_RESMI = JAM_PULANG_RESMI;
  window.ambilJadwalKelasHariIni = ambilJadwalKelasHariIni;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    tanggalHariIni,
    jamSekarang,
    namaHariDariTanggal,
    cariJamKeAktif,
    MASTER_JADWAL_RESMI,
    JAM_PULANG_RESMI,
    ambilJadwalKelasHariIni
  };
}

