// GANTI dengan konfigurasi Firebase project kamu sendiri.
const firebaseConfig = {
  apiKey: "AIzaSyBOQFp5SOvBTMpA_FEaMQyp0G4mmHfFa_c",
  authDomain: "absensi-6e385.firebaseapp.com",
  databaseURL: "https://absensi-6e385-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "absensi-6e385",
  storageBucket: "absensi-6e385.firebasestorage.app",
  messagingSenderId: "632114437491",
  appId: "1:632114437491:web:4b0c90ec78669e7cc0b906"
};

firebase.initializeApp(firebaseConfig);
var db = (typeof firebase !== 'undefined' && firebase.database) ? firebase.database() : null;

// Master Konfigurasi & Normalisasi Data Siswa Resmi SMKN 1 Sumedang
var DAFTAR_KELAS_RESMI = ['XII RPL 1', 'XII RPL 2', 'XII TKJ 1'];

function ambilKelasSiswa(s) {
  if (!s || typeof s !== 'object') return '';
  if (s.kelas && typeof s.kelas === 'object') {
    return s.kelas.nama_kelas || s.kelas.nama || s.kelas.name || s.kelas.rombel || '';
  }
  return s.kelas || s.Kelas || s.KELAS || s.rombel || s.Rombel || s.kelas_nama || s.kelasNama || '';
}

function normalisasiKelas(k) {
  if (!k) return '';
  let str = String(k).trim().toUpperCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ');
  // Standarisasi variasi rombel XII RPL 1, XII RPL 2, XII TKJ 1
  str = str.replace(/(?:XII|12)\s*TKJ\s*2/gi, 'XII TKJ 1');
  str = str.replace(/(?:XII|12)\s*(RPL|TKJ)\s*([12])/gi, 'XII $1 $2');
  str = str.replace(/\b12\s+/g, 'XII ').replace(/\b12([A-Z])/g, 'XII $1');
  return str;
}

function parseSiswaSnapshot(rawVal) {
  const result = {};
  if (!rawVal) return result;

  // Dukung format thunder client yang dibungkus object { status: 'success', data: [...] }
  let listData = rawVal;
  if (rawVal && typeof rawVal === 'object' && !Array.isArray(rawVal) && rawVal.data) {
    listData = rawVal.data;
  }

  function prosesItemSiswa(s, fallbackKey) {
    if (!s || typeof s !== 'object') return;
    let nisn = s.nisn || s.NISN;
    if (!nisn && s.user && s.user.email) {
      const m = s.user.email.match(/^(\d{8,12})/);
      if (m) nisn = m[1];
    }
    if (!nisn && s.nis && /^\d+$/.test(s.nis)) {
      nisn = s.nis;
    }
    if (!nisn) {
      nisn = String(s.id || fallbackKey);
    }
    nisn = String(nisn).trim();

    const nama = s.nama_lengkap || s.nama || s.Nama || s.name || s.NAMA || (s.user && (s.user.name || s.user.nama)) || ('Siswa ' + nisn);
    const kelas = normalisasiKelas(ambilKelasSiswa(s));
    result[nisn] = { ...s, nisn, nama, kelas, _key: String(fallbackKey) };
  }

  if (Array.isArray(listData)) {
    listData.forEach((s, idx) => {
      prosesItemSiswa(s, idx);
    });
  } else if (typeof listData === 'object') {
    Object.entries(listData).forEach(([k, s]) => {
      if (s && typeof s === 'object') {
        prosesItemSiswa(s, k);
      } else if (typeof s === 'string') {
        result[k] = { nama: s, nisn: k, kelas: 'XII RPL 2', _key: k };
      }
    });
  }
  return result;
}

// Master Guru & Walas Resmi SMKN 1 Sumedang (PRD & Laporan Projek)
var MASTER_GURU_RESMI = {
  '198109012009022003': {
    nip: '198109012009022003',
    nama: 'Hani Hanifah, S.Si',
    mapel: 'Pemrograman Web & Perangkat Bergerak',
    rfidUid: 'E5F6A7B8',
    isWalas: true,
    walasKelasId: 'XII RPL 1'
  },
  '199209142022211007': {
    nip: '199209142022211007',
    nama: 'Muhammad Echa Putra, S.Kom.Gr',
    mapel: 'Basis Data & Pemodelan RPL',
    rfidUid: 'G9H0I1J2',
    isWalas: true,
    walasKelasId: 'XII RPL 2'
  },
  '198312052022211017': {
    nip: '198312052022211017',
    nama: 'Rijal Nur Rahmat, S.T',
    mapel: 'Administrasi Infrastruktur Jaringan',
    rfidUid: 'K3L4M5N6',
    isWalas: true,
    walasKelasId: 'XII TKJ 1'
  },
  '198504252024211008': {
    nip: '198504252024211008',
    nama: 'Heri Anggara, S.Kom',
    mapel: 'Produk Kreatif & Kewirausahaan RPL',
    rfidUid: 'O7P8Q9R0',
    isWalas: false,
    walasKelasId: null
  },
  '197905032006042004': {
    nip: '197905032006042004',
    nama: 'Hali, ST',
    mapel: 'Informatika & Rekayasa Perangkat Lunak',
    rfidUid: 'S1T2U3V4',
    isWalas: false,
    walasKelasId: null
  }
};

// Prototipe 2 Kartu RFID Fisik & Uji Coba (PRD Bab 5.2)
var KARTU_UJI_COBA = {
  kartuA: {
    uid: 'A1B2C3D4',
    tipe: 'siswa',
    nisn: '0091113849',
    nama: 'AHSAN MAHMUD FAUZI YUSRY',
    kelas: 'XII RPL 1',
    label: 'Kartu A (Siswa Uji Coba Fisik - XII RPL 1)'
  },
  kartuB: {
    uid: 'E5F6A7B8',
    tipe: 'guru',
    nip: '198109012009022003',
    nama: 'Hani Hanifah, S.Si',
    mapel: 'Pemrograman Web & Perangkat Bergerak',
    label: 'Kartu B (Guru Pengajar Uji Coba Fisik)'
  }
};

// 3 Status Operasional Kelas: 'belajar' | 'jamkos' | 'pulang' (PRD Bab 4.2)
var DEFAULT_STATUS_KELAS = {
  'XII RPL 1': {
    id: 'XII_RPL_1',
    nama: 'XII RPL 1',
    status: 'belajar',
    activeMapel: 'Pemrograman Web & Perangkat Bergerak',
    activeTeacherId: '198109012009022003',
    activeTeacherNama: 'Hani Hanifah, S.Si',
    walasNama: 'Hani Hanifah, S.Si',
    updatedAt: new Date().toISOString()
  },
  'XII RPL 2': {
    id: 'XII_RPL_2',
    nama: 'XII RPL 2',
    status: 'belajar',
    activeMapel: 'Basis Data & Pemodelan RPL',
    activeTeacherId: '199209142022211007',
    activeTeacherNama: 'Muhammad Echa Putra, S.Kom.Gr',
    walasNama: 'Muhammad Echa Putra, S.Kom.Gr',
    updatedAt: new Date().toISOString()
  },
  'XII TKJ 1': {
    id: 'XII_TKJ_1',
    nama: 'XII TKJ 1',
    status: 'belajar',
    activeMapel: 'Administrasi Infrastruktur Jaringan',
    activeTeacherId: '198312052022211017',
    activeTeacherNama: 'Rijal Nur Rahmat, S.T',
    walasNama: 'Rijal Nur Rahmat, S.T',
    updatedAt: new Date().toISOString()
  }
};

// Evaluasi Ambang Batas Waktu Siswa (PRD Bab 4.1):
// <= 06.30 WIB: Hadir
// 06.31 – 08.00 WIB: Terlambat
// > 08.00 WIB: Terlambat / Auto-Alpa
function evaluasiAmbangBatasWaktu(waktuStr) {
  if (!waktuStr) return 'hadir';
  const clean = waktuStr.length === 5 ? waktuStr + ':00' : waktuStr;
  if (clean <= '06:30:00') {
    return 'hadir';
  } else if (clean <= '08:00:00') {
    return 'terlambat';
  } else {
    return 'terlambat';
  }
}

// Inisialisasi data penting jika belum ada di Firebase
async function bootstrapSistemUjikom() {
  if (typeof db === 'undefined') return;
  try {
    const snapKelas = await db.ref('kelas').once('value');
    if (!snapKelas.exists()) {
      await db.ref('kelas').set(DEFAULT_STATUS_KELAS);
    }
    const snapGuru = await db.ref('guru').once('value');
    if (!snapGuru.exists()) {
      await db.ref('guru').set(MASTER_GURU_RESMI);
    }
    const snapKartuA = await db.ref('kartu/' + KARTU_UJI_COBA.kartuA.uid).once('value');
    if (!snapKartuA.exists()) {
      await db.ref('kartu/' + KARTU_UJI_COBA.kartuA.uid).set({
        nisn: KARTU_UJI_COBA.kartuA.nisn,
        tipe: 'siswa',
        device_id: 'rpi-gateway-01'
      });
    }
    const snapKartuB = await db.ref('kartu/' + KARTU_UJI_COBA.kartuB.uid).once('value');
    if (!snapKartuB.exists()) {
      await db.ref('kartu/' + KARTU_UJI_COBA.kartuB.uid).set({
        nip: KARTU_UJI_COBA.kartuB.nip,
        tipe: 'guru',
        device_id: 'rpi-gateway-01'
      });
    }
  } catch (err) {
    console.warn('[Bootstrap] Dilewati:', err.message);
  }
}

if (typeof window !== 'undefined') {
  window.DAFTAR_KELAS_RESMI = DAFTAR_KELAS_RESMI;
  window.MASTER_GURU_RESMI = MASTER_GURU_RESMI;
  window.KARTU_UJI_COBA = KARTU_UJI_COBA;
  window.DEFAULT_STATUS_KELAS = DEFAULT_STATUS_KELAS;
  window.ambilKelasSiswa = ambilKelasSiswa;
  window.normalisasiKelas = normalisasiKelas;
  window.parseSiswaSnapshot = parseSiswaSnapshot;
  window.evaluasiAmbangBatasWaktu = evaluasiAmbangBatasWaktu;
  window.bootstrapSistemUjikom = bootstrapSistemUjikom;
  bootstrapSistemUjikom();
}