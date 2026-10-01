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
const db = firebase.database();

// Master Konfigurasi & Normalisasi Data Siswa Resmi SMKN 1 Sumedang
var DAFTAR_KELAS_RESMI = ['XII RPL 1', 'XII RPL 2', 'XII TKJ 1'];

function ambilKelasSiswa(s) {
  if (!s || typeof s !== 'object') return '';
  return s.kelas || s.Kelas || s.KELAS || s.rombel || s.Rombel || s.kelas_nama || s.kelasNama || '';
}

function normalisasiKelas(k) {
  if (!k) return '';
  let str = String(k).trim().toUpperCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ');
  // Standarisasi variasi rombel XII RPL 1, XII RPL 2, XII TKJ 1
  str = str.replace(/(?:XII|12)\s*(RPL|TKJ)\s*([12])/gi, 'XII $1 $2');
  str = str.replace(/\b12\s+/g, 'XII ').replace(/\b12([A-Z])/g, 'XII $1');
  return str;
}

function parseSiswaSnapshot(rawVal) {
  const result = {};
  if (!rawVal) return result;
  if (Array.isArray(rawVal)) {
    rawVal.forEach((s, idx) => {
      if (s && typeof s === 'object') {
        const nisn = String(s.nisn || s.NISN || s.id || (idx + 1));
        const nama = s.nama || s.Nama || s.name || s.NAMA || ('Siswa ' + nisn);
        const kelas = normalisasiKelas(ambilKelasSiswa(s));
        result[nisn] = { ...s, nisn, nama, kelas, _key: String(idx) };
      }
    });
  } else if (typeof rawVal === 'object') {
    Object.entries(rawVal).forEach(([k, s]) => {
      if (s && typeof s === 'object') {
        const nisn = String(s.nisn || s.NISN || s.id || k);
        const nama = s.nama || s.Nama || s.name || s.NAMA || ('Siswa ' + nisn);
        const kelas = normalisasiKelas(ambilKelasSiswa(s));
        result[nisn] = { ...s, nisn, nama, kelas, _key: k };
      } else if (typeof s === 'string') {
        result[k] = { nama: s, nisn: k, kelas: 'XII RPL 2', _key: k };
      }
    });
  }
  return result;
}

if (typeof window !== 'undefined') {
  window.DAFTAR_KELAS_RESMI = DAFTAR_KELAS_RESMI;
  window.ambilKelasSiswa = ambilKelasSiswa;
  window.normalisasiKelas = normalisasiKelas;
  window.parseSiswaSnapshot = parseSiswaSnapshot;
}