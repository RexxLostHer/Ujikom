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

// Fallback stub ketahanan offline jika script CDN Firebase gagal dimuat di browser
if (typeof window !== 'undefined' && typeof window.firebase === 'undefined') {
  window.firebase = {
    apps: [],
    initializeApp: function() { return this; },
    auth: function() {
      return {
        currentUser: null,
        onAuthStateChanged: function(cb) {
          if (typeof cb === 'function') setTimeout(function() { cb(null); }, 10);
          return function() {};
        },
        signInWithEmailAndPassword: function() {
          var err = new Error('Koneksi offline atau Firebase SDK tidak tersedia.');
          err.code = 'auth/network-request-failed';
          return Promise.reject(err);
        },
        createUserWithEmailAndPassword: function() {
          var err = new Error('Koneksi offline atau Firebase SDK tidak tersedia.');
          err.code = 'auth/network-request-failed';
          return Promise.reject(err);
        },
        sendPasswordResetEmail: function() {
          var err = new Error('Koneksi offline atau Firebase SDK tidak tersedia.');
          err.code = 'auth/network-request-failed';
          return Promise.reject(err);
        },
        signInWithPopup: function() {
          var err = new Error('Koneksi offline atau Firebase SDK tidak tersedia.');
          err.code = 'auth/network-request-failed';
          return Promise.reject(err);
        },
        signOut: function() { return Promise.resolve(); }
      };
    },
    database: function() {
      return {
        ref: function(path) {
          return {
            path: path,
            on: function() {},
            off: function() {},
            once: function() { return Promise.resolve({ val: function() { return null; }, exists: function() { return false; } }); },
            set: function() { return Promise.resolve(); },
            update: function() { return Promise.resolve(); },
            push: function() { return { key: 'local_' + Date.now(), set: function() { return Promise.resolve(); } }; },
            remove: function() { return Promise.resolve(); }
          };
        }
      };
    }
  };
  window.firebase.auth.GoogleAuthProvider = function() {
    this.setCustomParameters = function() {};
  };
  window.firebase.auth.EmailAuthProvider = {
    credential: function(email, pass) { return { email: email, pass: pass }; }
  };
}
if (typeof firebase !== 'undefined' && firebase.initializeApp) {
  firebase.initializeApp(firebaseConfig);
}
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
  str = str.replace(/^KELAS\s+/i, '');
  // Standarisasi variasi rombel XII RPL 1, XII RPL 2, XII TKJ 1, XII TKJ 2
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

// Master Data 69 Siswa Resmi SMKN 1 Sumedang (Sinkron 100% dengan assets/data-siswa.json & siswa-clean-firebase.json)
var MASTER_DATA_SISWA_RESMI = {
  "3083030644": {
    "nisn": "3083030644",
    "nama": "ARIF WIJAKSANA",
    "kelas": "XII RPL 2",
    "nis": "24.25.X.653",
    "email": "awijaksana04@gmail.com",
    "foto": "assets/foto/3083030644.jpg",
    "foto_karakter": "Yousuke Hirata"
  },
  "0091113849": {
    "nisn": "0091113849",
    "nama": "AHSAN MAHMUD FAUZI YUSRY",
    "kelas": "XII RPL 1",
    "nis": "24.25.X.613",
    "email": "mahmudfauziyusri@gmail.com",
    "foto": "assets/foto/0091113849.jpg",
    "foto_karakter": "Manabu Horikita"
  },
  "0081953923": {
    "nisn": "0081953923",
    "nama": "AIDA SAHARAWATI",
    "kelas": "XII RPL 1",
    "nis": "24.25.X.614",
    "email": "saharaaida084@gmail.com",
    "foto": "assets/foto/0081953923.jpg",
    "foto_karakter": "Suzune Horikita"
  },
  "0094812111": {
    "nisn": "0094812111",
    "nama": "BANGKIT FAIZ SYARIFUDDIN",
    "kelas": "XII RPL 1",
    "nis": "24.25.X.615",
    "email": "bangkitfaiz7@gmail.com",
    "foto": "assets/foto/0094812111.jpg",
    "foto_karakter": "Rokusuke Kouenji"
  },
  "0096396686": {
    "nisn": "0096396686",
    "nama": "CAHYA MUHAMAD RIFAN",
    "kelas": "XII RPL 1",
    "nis": "24.25.X.616",
    "email": "cahyasipmeme@gmail.com",
    "foto": "assets/foto/0096396686.jpg",
    "foto_karakter": "Ken Sudou"
  },
  "0088101365": {
    "nisn": "0088101365",
    "nama": "DESTIKA",
    "kelas": "XII RPL 1",
    "nis": "24.25.X.617",
    "email": "destika1903@gmail.com",
    "foto": "assets/foto/0088101365.jpg",
    "foto_karakter": "Kikyou Kushida"
  },
  "0093165149": {
    "nisn": "0093165149",
    "nama": "EKA OSA PRASETYO",
    "kelas": "XII RPL 1",
    "nis": "24.25.X.618",
    "email": "0093165149@gmail.com",
    "foto": "assets/foto/0093165149.jpg",
    "foto_karakter": "Kanji Ike"
  },
  "0093346005": {
    "nisn": "0093346005",
    "nama": "FAHRI AL FAUZI",
    "kelas": "XII RPL 1",
    "nis": "24.25.X.619",
    "email": "fahrialfauzi111@gmail.com",
    "foto": "assets/foto/0093346005.jpg",
    "foto_karakter": "Haruki Yamauchi"
  },
  "0091670887": {
    "nisn": "0091670887",
    "nama": "FIKRI RIDWANULLOH",
    "kelas": "XII RPL 1",
    "nis": "24.25.X.620",
    "email": "0091670887@gmail.com",
    "foto": "assets/foto/0091670887.jpg",
    "foto_karakter": "Teruhiko Yukimura"
  },
  "0091543636": {
    "nisn": "0091543636",
    "nama": "HAFIDZ FAYYADH ARKAN",
    "kelas": "XII RPL 1",
    "nis": "24.25.X.622",
    "email": "fayadarkan073@gmail.com",
    "foto": "assets/foto/0091543636.jpg",
    "foto_karakter": "Akito Miyake"
  },
  "0095806933": {
    "nisn": "0095806933",
    "nama": "HANIF AKMA AZIB",
    "kelas": "XII RPL 1",
    "nis": "24.25.X.623",
    "email": "akmahaniff07@gmail.com",
    "foto": "assets/foto/0095806933.jpg",
    "foto_karakter": "Hideo Sotomura"
  },
  "0084091049": {
    "nisn": "0084091049",
    "nama": "KEYSHAR AL IHSANIDHIA WAFFI",
    "kelas": "XII RPL 1",
    "nis": "24.25.X.624",
    "email": "0084091049@gmail.com",
    "foto": "assets/foto/0084091049.jpg",
    "foto_karakter": "Masayoshi Hashimoto"
  },
  "0092945323": {
    "nisn": "0092945323",
    "nama": "MUHAMAD DAFFA RAFASYA",
    "kelas": "XII RPL 1",
    "nis": "24.25.X.625",
    "email": "daffarafasya007@gmail.com",
    "foto": "assets/foto/0092945323.jpg",
    "foto_karakter": "Ryuuji Kanzaki"
  },
  "0093579207": {
    "nisn": "0093579207",
    "nama": "MUHAMMAD RIZKI RAMADHAN",
    "kelas": "XII RPL 1",
    "nis": "24.25.X.626",
    "email": "rizkiramadhan20009@gmail.com",
    "foto": "assets/foto/0093579207.jpg",
    "foto_karakter": "Sou Shibata"
  },
  "0089025956": {
    "nisn": "0089025956",
    "nama": "NAAILA LUTHFI NAFIISA",
    "kelas": "XII RPL 1",
    "nis": "24.25.X.627",
    "email": "naaila368@gmail.com",
    "foto": "assets/foto/0089025956.jpg",
    "foto_karakter": "Airi Sakura"
  },
  "0087369704": {
    "nisn": "0087369704",
    "nama": "NUR JAMILAH",
    "kelas": "XII RPL 1",
    "nis": "24.25.X.629",
    "email": "0087369704@gmail.com",
    "foto": "assets/foto/0087369704.jpg",
    "foto_karakter": "Honami Ichinose"
  },
  "0082852058": {
    "nisn": "0082852058",
    "nama": "PASHYA PRASETYO WIBOWO",
    "kelas": "XII RPL 1",
    "nis": "24.25.X.630",
    "email": "pashyaprasetyow@gmail.com",
    "foto": "assets/foto/0082852058.jpg",
    "foto_karakter": "Kouhei Katsuragi"
  },
  "0093176594": {
    "nisn": "0093176594",
    "nama": "PUTRI NABILA RAMADHANI",
    "kelas": "XII RPL 1",
    "nis": "24.25.X.631",
    "email": "incessputri23@gmail.com",
    "foto": "assets/foto/0093176594.jpg",
    "foto_karakter": "Kei Karuizawa"
  },
  "0089822982": {
    "nisn": "0089822982",
    "nama": "RAFLI MUHAMMAD GHOJALI",
    "kelas": "XII RPL 1",
    "nis": "24.25.X.632",
    "email": "raflimuhammadghojali12@gmail.com",
    "foto": "assets/foto/0089822982.jpg",
    "foto_karakter": "Albert Yamada"
  },
  "0084202991": {
    "nisn": "0084202991",
    "nama": "RAKA FAIZA BILLAH",
    "kelas": "XII RPL 1",
    "nis": "24.25.X.633",
    "email": "faidzaraka@gmail.com",
    "foto": "assets/foto/0084202991.jpg",
    "foto_karakter": "Daichi Ishizaki"
  },
  "0081131116": {
    "nisn": "0081131116",
    "nama": "RAY SAJUTA PRAJA",
    "kelas": "XII RPL 1",
    "nis": "24.25.X.634",
    "email": "rayaajuta6009@gmail.com",
    "foto": "assets/foto/0081131116.jpg",
    "foto_karakter": "Hayato Kitou"
  },
  "0088738345": {
    "nisn": "0088738345",
    "nama": "REVA AYUNADIA",
    "kelas": "XII RPL 1",
    "nis": "24.25.X.635",
    "email": "reva.ayunadia08@gmail.com",
    "foto": "assets/foto/0088738345.jpg",
    "foto_karakter": "Arisu Sakayanagi"
  },
  "0083707720": {
    "nisn": "0083707720",
    "nama": "REZQI MAULANA YUSUP",
    "kelas": "XII RPL 1",
    "nis": "24.25.X.636",
    "email": "rezqimaulana05@gmail.com",
    "foto": "assets/foto/0083707720.jpg",
    "foto_karakter": "Yahiko Totsuka"
  },
  "0097000545": {
    "nisn": "0097000545",
    "nama": "RIANTO",
    "kelas": "XII RPL 1",
    "nis": "24.25.X.637",
    "email": "riantojr.101213@gmail.com",
    "foto": "assets/foto/0097000545.jpg",
    "foto_karakter": "Miyabi Nagumo"
  },
  "0084987133": {
    "nisn": "0084987133",
    "nama": "RIDWAN FHATURROHMAN",
    "kelas": "XII RPL 1",
    "nis": "24.25.X.638",
    "email": "iwanfhatur25@gmail.com",
    "foto": "assets/foto/0084987133.jpg",
    "foto_karakter": "Ikuto Kiriyama"
  },
  "0083606520": {
    "nisn": "0083606520",
    "nama": "RIFA AULIA DAMAYANTI",
    "kelas": "XII RPL 1",
    "nis": "24.25.X.639",
    "email": "expialidocioouss@gmail.com",
    "foto": "assets/foto/0083606520.jpg",
    "foto_karakter": "Hiyori Shiina"
  },
  "0087321172": {
    "nisn": "0087321172",
    "nama": "RIZKIA SUCI RAMADHANI",
    "kelas": "XII RPL 1",
    "nis": "24.25.X.640",
    "email": "suciramadhanirizkia@gmail.com",
    "foto": "assets/foto/0087321172.jpg",
    "foto_karakter": "Mio Ibuki"
  },
  "0087949581": {
    "nisn": "0087949581",
    "nama": "SARAH SABILA KHOERUNNISA",
    "kelas": "XII RPL 1",
    "nis": "24.25.X.641",
    "email": "khoirunnisasalsabila749@gmail.com",
    "foto": "assets/foto/0087949581.jpg",
    "foto_karakter": "Haruka Hasebe"
  },
  "0088938544": {
    "nisn": "0088938544",
    "nama": "SOFYAN RAFI ISKANDAR",
    "kelas": "XII RPL 1",
    "nis": "24.25.X.642",
    "email": "sofyyannrafi@gmail.com",
    "foto": "assets/foto/0088938544.jpg",
    "foto_karakter": "Tomonari Mashima"
  },
  "0097682754": {
    "nisn": "0097682754",
    "nama": "TIA APRILIA KUSWARA",
    "kelas": "XII RPL 1",
    "nis": "24.25.X.644",
    "email": "0097682754@gmail.com",
    "foto": "assets/foto/0097682754.jpg",
    "foto_karakter": "Maya Satou"
  },
  "0085991563": {
    "nisn": "0085991563",
    "nama": "TIARA SULISTIA NINGRUM",
    "kelas": "XII RPL 1",
    "nis": "24.25.X.645",
    "email": "arsendimas5@gmail.com",
    "foto": "assets/foto/0085991563.jpg",
    "foto_karakter": "Chiaki Matsushita"
  },
  "0095039675": {
    "nisn": "0095039675",
    "nama": "VIVI HANIFAH FEBRIYANTI",
    "kelas": "XII RPL 1",
    "nis": "24.25.X.646",
    "email": "vivihanifah91@gmail.com",
    "foto": "assets/foto/0095039675.jpg",
    "foto_karakter": "Akane Tachibana"
  },
  "0087607700": {
    "nisn": "0087607700",
    "nama": "WULAN KARTIKA SARI",
    "kelas": "XII RPL 1",
    "nis": "24.25.X.647",
    "email": "0087607700@gmail.com",
    "foto": "assets/foto/0087607700.jpg",
    "foto_karakter": "Masumi Kamuro"
  },
  "0096619392": {
    "nisn": "0096619392",
    "nama": "ZAIDAN HASBI AKBAR",
    "kelas": "XII RPL 1",
    "nis": "24.25.X.648",
    "email": "zaidanhasbiakbar349@gmail.com",
    "foto": "assets/foto/0096619392.jpg",
    "foto_karakter": "Tokinari Tsukishiro"
  },
  "0081782494": {
    "nisn": "0081782494",
    "nama": "ABHIPRAYA SAMBOGA",
    "kelas": "XII RPL 2",
    "nis": "24.25.X.649",
    "email": "abhiprayasamboga@gmail.com",
    "foto": "assets/foto/0081782494.jpg",
    "foto_karakter": "Atsuomi Ayanokouji"
  },
  "0095250998": {
    "nisn": "0095250998",
    "nama": "AGUS RIZKY NURFADIL",
    "kelas": "XII RPL 2",
    "nis": "24.25.X.650",
    "email": "agusrizkynurfadil@gmail.com",
    "foto": "assets/foto/0095250998.jpg",
    "foto_karakter": "Narumori Sakayanagi"
  },
  "0084736069": {
    "nisn": "0084736069",
    "nama": "ALIFAH DZAAKIROH",
    "kelas": "XII RPL 2",
    "nis": "24.25.X.651",
    "email": "alifazakiroh@gmail.com",
    "foto": "assets/foto/0084736069.jpg",
    "foto_karakter": "Sae Chabashira"
  },
  "0092418049": {
    "nisn": "0092418049",
    "nama": "ALYA FUTRI SALSABILA",
    "kelas": "XII RPL 2",
    "nis": "24.25.X.652",
    "email": "cuankiebasomanguyun@gmail.com",
    "foto": "assets/foto/0092418049.jpg",
    "foto_karakter": "Chie Hoshinomiya"
  },
  "0098205255": {
    "nisn": "0098205255",
    "nama": "CHERYL PUTRI RAHMADYA",
    "kelas": "XII RPL 2",
    "nis": "24.25.X.654",
    "email": "cherilsaskhia@gmail.com",
    "foto": "assets/foto/0098205255.jpg",
    "foto_karakter": "Mei-Yu Wang"
  },
  "0086172155": {
    "nisn": "0086172155",
    "nama": "DANDI RIZIQ KAHARUDIN",
    "kelas": "XII RPL 2",
    "nis": "24.25.X.655",
    "email": "dandiiriziq@gmail.com",
    "foto": "assets/foto/0086172155.jpg",
    "foto_karakter": "Kouji Machida"
  },
  "0096081488": {
    "nisn": "0096081488",
    "nama": "DEVI NURUL AZIZAH",
    "kelas": "XII RPL 2",
    "nis": "24.25.X.656",
    "email": "devinurulazizah74@gmail.com",
    "foto": "assets/foto/0096081488.jpg",
    "foto_karakter": "Yume Kobashi"
  },
  "0082773779": {
    "nisn": "0082773779",
    "nama": "DHINDA PUTRI ARYANI",
    "kelas": "XII RPL 2",
    "nis": "24.25.X.657",
    "email": "dipaaboy@gmail.com",
    "foto": "assets/foto/0082773779.jpg",
    "foto_karakter": "Satsuki Shinohara"
  },
  "0091923585": {
    "nisn": "0091923585",
    "nama": "DINDA ZAHRA NUR AFIFAH",
    "kelas": "XII RPL 2",
    "nis": "24.25.X.658",
    "email": "zahraaanrr@gmail.com",
    "foto": "assets/foto/0091923585.jpg",
    "foto_karakter": "Mako Amikura"
  },
  "0088435506": {
    "nisn": "0088435506",
    "nama": "FULAN MUHAMMAD",
    "kelas": "XII RPL 2",
    "nis": "24.25.X.659",
    "email": "fulanmuhammad32@gmail.com",
    "foto": "assets/foto/0088435506.jpg",
    "foto_karakter": "Tetsuya Hamaguchi"
  },
  "0087828183": {
    "nisn": "0087828183",
    "nama": "IQBAL MAULANA SIDIK",
    "kelas": "XII RPL 2",
    "nis": "24.25.X.660",
    "email": "iqbalmaulanasidik990@gmail.com",
    "foto": "assets/foto/0087828183.jpg",
    "foto_karakter": "Hiroya Tokitou"
  },
  "0085340789": {
    "nisn": "0085340789",
    "nama": "KURNIAWAN SUDRAJAT",
    "kelas": "XII RPL 2",
    "nis": "24.25.X.661",
    "email": "kurniawansudrajat12@gmail.com",
    "foto": "assets/foto/0085340789.jpg",
    "foto_karakter": "Susumu Moriyama"
  },
  "0087121894": {
    "nisn": "0087121894",
    "nama": "LUTHFI NUR ZAIDAN",
    "kelas": "XII RPL 2",
    "nis": "24.25.X.662",
    "email": "zaidan1095@gmail.com",
    "foto": "assets/foto/0087121894.jpg",
    "foto_karakter": "Kyou Ishigami"
  },
  "0098263610": {
    "nisn": "0098263610",
    "nama": "M. IHSAN ATHALLAH",
    "kelas": "XII RPL 2",
    "nis": "24.25.X.663",
    "email": "zemapk15@gmail.com",
    "foto": "assets/foto/0098263610.jpg",
    "foto_karakter": "Kiyotaka Ayanokouji"
  },
  "00082109": {
    "nisn": "00082109",
    "nama": "TIFANI ADISYA RAMADHANI",
    "kelas": "XII RPL 2",
    "nis": "24.25.X.664",
    "email": "tifaniadisya@gmail.com",
    "foto": "assets/foto/00082109.jpg",
    "foto_karakter": "Kei Karuizawa"
  },
  "0094996233": {
    "nisn": "0094996233",
    "nama": "MUHAMMAD ARDAN ZAQUAN AL KAHFI",
    "kelas": "XII RPL 2",
    "nis": "24.25.X.665",
    "email": "ardanzaquan@gmail.com",
    "foto": "assets/foto/0094996233.jpg",
    "foto_karakter": "Makoto Sumida"
  },
  "0089471184": {
    "nisn": "0089471184",
    "nama": "MUHAMMAD FARHAN NASRULLAH",
    "kelas": "XII RPL 2",
    "nis": "24.25.X.666",
    "email": "mfarhan231008@gmail.com",
    "foto": "assets/foto/0089471184.jpg",
    "foto_karakter": "Kazuomi Housen"
  },
  "0092047785": {
    "nisn": "0092047785",
    "nama": "MUHAMMAD RIFKY FAUZIA SHONHAJI",
    "kelas": "XII RPL 2",
    "nis": "24.25.X.667",
    "email": "ajirifki694@gmail.com",
    "foto": "assets/foto/0092047785.jpg",
    "foto_karakter": "Takuya Yagami"
  },
  "0089511928": {
    "nisn": "0089511928",
    "nama": "NABILA AINUN AL ZAHRANI",
    "kelas": "XII RPL 2",
    "nis": "24.25.X.668",
    "email": "nabilaainunalzahrani@gmail.com",
    "foto": "assets/foto/0089511928.jpg",
    "foto_karakter": "Kayano Onodera"
  },
  "0092427440": {
    "nisn": "0092427440",
    "nama": "NAUVAL EAGAN PURNAMA",
    "kelas": "XII RPL 2",
    "nis": "24.25.X.669",
    "email": "nauvalpurnama07@gmail.com",
    "foto": "assets/foto/0092427440.jpg",
    "foto_karakter": "Riku Utomiya"
  },
  "0093940421": {
    "nisn": "0093940421",
    "nama": "NIA KARUNIA",
    "kelas": "XII RPL 2",
    "nis": "24.25.X.670",
    "email": "karuniania614@gmail.com",
    "foto": "assets/foto/0093940421.jpg",
    "foto_karakter": "Chihiro Shiranami"
  },
  "0089603330": {
    "nisn": "0089603330",
    "nama": "NOVA PUSPITASARI",
    "kelas": "XII RPL 2",
    "nis": "24.25.X.671",
    "email": "annurnadila@gmail.com",
    "foto": "assets/foto/0089603330.jpg",
    "foto_karakter": "Nene Mori"
  },
  "0081281355": {
    "nisn": "0081281355",
    "nama": "RAFLY NOVIADY",
    "kelas": "XII RPL 2",
    "nis": "24.25.X.672",
    "email": "9f.raflynoviady@gmail.com",
    "foto": "assets/foto/0081281355.jpg",
    "foto_karakter": "Katsunori Shiba"
  },
  "0093489720": {
    "nisn": "0093489720",
    "nama": "RAKA",
    "kelas": "XII RPL 2",
    "nis": "24.25.X.673",
    "email": "0093489720@gmail.com",
    "foto": "assets/foto/0093489720.jpg",
    "foto_karakter": "Soushi Miyamoto"
  },
  "0081714691": {
    "nisn": "0081714691",
    "nama": "RIKA NOVIYANTIKA",
    "kelas": "XII RPL 2",
    "nis": "24.25.X.675",
    "email": "rikaanoviyantika@gmail.com",
    "foto": "assets/foto/0081714691.jpg",
    "foto_karakter": "Nazuna Asahina"
  },
  "0091835189": {
    "nisn": "0091835189",
    "nama": "RIKI",
    "kelas": "XII RPL 2",
    "nis": "24.25.X.676",
    "email": "0091835189@gmail.com",
    "foto": "assets/foto/0091835189.jpg",
    "foto_karakter": "Setsuya Minami"
  },
  "0087989875": {
    "nisn": "0087989875",
    "nama": "RINRIN RINAWATI",
    "kelas": "XII RPL 2",
    "nis": "24.25.X.677",
    "email": "rinrinrinawati272@gmail.com",
    "foto": "assets/foto/0087989875.jpg",
    "foto_karakter": "Nanami Yabu"
  },
  "0082578655": {
    "nisn": "0082578655",
    "nama": "RIRIN DWI RIYANTO",
    "kelas": "XII RPL 2",
    "nis": "24.25.X.678",
    "email": "ririndwir3011@gmail.com",
    "foto": "assets/foto/0082578655.jpg",
    "foto_karakter": "Shiho Manabe"
  },
  "0083044841": {
    "nisn": "0083044841",
    "nama": "RISMA RISTIANTI",
    "kelas": "XII RPL 2",
    "nis": "24.25.X.679",
    "email": "moyyprivate@gmail.com",
    "foto": "assets/foto/0083044841.jpg",
    "foto_karakter": "Saki Yamashita"
  },
  "0082104129": {
    "nisn": "0082104129",
    "nama": "RIZKY RAMADANI",
    "kelas": "XII RPL 2",
    "nis": "24.25.X.680",
    "email": "rizkybmw.3@gmail.com",
    "foto": "assets/foto/0082104129.jpg",
    "foto_karakter": "Kakeru Ryuuen"
  },
  "0081607221": {
    "nisn": "0081607221",
    "nama": "SOLEH WAHYUDIN",
    "kelas": "XII RPL 2",
    "nis": "24.25.X.681",
    "email": "swahyudin902@gmail.com",
    "foto": "assets/foto/0081607221.jpg",
    "foto_karakter": "Kyougo Komiya"
  },
  "0097169063": {
    "nisn": "0097169063",
    "nama": "SRIYANTI DEVIE",
    "kelas": "XII RPL 2",
    "nis": "24.25.X.682",
    "email": "sriyantidevie.24@gmail.com",
    "foto": "assets/foto/0097169063.jpg",
    "foto_karakter": "Minori Kinoshita"
  },
  "0085206927": {
    "nisn": "0085206927",
    "nama": "TALITA APRILIANA",
    "kelas": "XII RPL 2",
    "nis": "24.25.X.683",
    "email": "lianatalita21@gmail.com",
    "foto": "assets/foto/0085206927.jpg",
    "foto_karakter": "Takeko Nishino"
  },
  "0089565003": {
    "nisn": "0089565003",
    "nama": "WILLY HAFFIDIN",
    "kelas": "XII RPL 2",
    "nis": "24.25.X.684",
    "email": "haffidinwilly@gmail.com",
    "foto": "assets/foto/0089565003.jpg",
    "foto_karakter": "Osamu Takahashi"
  },
  "0081876173": {
    "nisn": "0081876173",
    "nama": "Nita Nuraini",
    "kelas": "XII TKJ 1",
    "nis": "24.25.X.598",
    "email": "0081876173@gmail.com",
    "foto": "assets/foto/0081876173.jpg",
    "foto_karakter": "Ichika Amasawa"
  },
  "0088082306": {
    "nisn": "0088082306",
    "nama": "WIDIA SRI ANDAYANI",
    "kelas": "XII TKJ 1",
    "nis": "0088082306",
    "email": "0088082306@gmail.com",
    "foto": "assets/foto/0088082306.jpg",
    "foto_karakter": "Fuuka Kiryuuin"
  }
};

// Master Guru & Walas Resmi SMKN 1 Sumedang (PRD & Penetapan Resmi)
var MASTER_GURU_RESMI = {
  "198109012009022003": {
    "nip": "198109012009022003",
    "nama": "Hani Hanifah, S.Si",
    "mapel": "Pemrograman Web & Perangkat Bergerak",
    "rfidUid": "E5F6A7B8",
    "isWalas": false,
    "walasKelasId": null,
    "foto": "assets/foto/guru_198109012009022003.jpg",
    "foto_karakter": "Sae Chabashira"
  },
  "197905032006042004": {
    "nip": "197905032006042004",
    "nama": "Hali, ST",
    "mapel": "Informatika & Rekayasa Perangkat Lunak",
    "rfidUid": "S1T2U3V4",
    "isWalas": false,
    "walasKelasId": null,
    "foto": "assets/foto/guru_197905032006042004.jpg",
    "foto_karakter": "Atsuomi Ayanokouji"
  },
  "199209142022211007": {
    "nip": "199209142022211007",
    "nama": "Muhammad Echa Putra, S.Kom.Gr",
    "mapel": "Basis Data & Pemodelan RPL",
    "rfidUid": "G9H0I1J2",
    "isWalas": true,
    "walasKelasId": "XII RPL 2",
    "foto": "assets/foto/guru_199209142022211007.jpg",
    "foto_karakter": "Tomonari Mashima"
  },
  "198312052022211017": {
    "nip": "198312052022211017",
    "nama": "Rijal Nur Rahmat, S.T",
    "mapel": "Administrasi Infrastruktur Jaringan",
    "rfidUid": "K3L4M5N6",
    "isWalas": true,
    "walasKelasId": "XII RPL 1",
    "foto": "assets/foto/guru_198312052022211017.jpg",
    "foto_karakter": "Katsunori Shiba"
  },
  "198504252024211008": {
    "nip": "198504252024211008",
    "nama": "Heri Anggara, S.Kom",
    "mapel": "Teknologi Jaringan & Komputer",
    "rfidUid": "O7P8Q9R0",
    "isWalas": true,
    "walasKelasId": "XII TKJ 2",
    "foto": "assets/foto/guru_198504252024211008.jpg",
    "foto_karakter": "Tokinari Tsukishiro"
  }
};

var ADMIN_IDENTITY_RESMI = {
  id: "admin",
  nip: "ADMIN-01",
  nomorKontak: "ADMIN",
  nama: "Administrator SMKN 1 Sumedang",
  role: "admin",
  foto: "assets/foto/admin.jpg",
  foto_karakter: "Narumori Sakayanagi",
  jabatan: "Kepala Sekolah & Administrator Utama"
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
    activeMapel: 'Administrasi Infrastruktur Jaringan',
    activeTeacherId: '198312052022211017',
    activeTeacherNama: 'Rijal Nur Rahmat, S.T',
    walasNama: 'Rijal Nur Rahmat, S.T',
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
    activeMapel: 'Teknologi Jaringan & Komputer',
    activeTeacherId: '198504252024211008',
    activeTeacherNama: 'Heri Anggara, S.Kom',
    walasNama: 'Heri Anggara, S.Kom',
    updatedAt: new Date().toISOString()
  },
  'XII TKJ 2': {
    id: 'XII_TKJ_2',
    nama: 'XII TKJ 2',
    status: 'belajar',
    activeMapel: 'Teknologi Jaringan & Komputer',
    activeTeacherId: '198504252024211008',
    activeTeacherNama: 'Heri Anggara, S.Kom',
    walasNama: 'Heri Anggara, S.Kom',
    updatedAt: new Date().toISOString()
  }
};

// Timezone Helper: Waktu Lokal Indonesia Barat (Asia/Jakarta / WIB)
function getWIBTime(d) {
  return getJamSekarangWIB(d);
}

function getJamSekarangWIB(d) {
  const dateObj = d || new Date();
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(dateObj);
  } catch (e) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}:${pad(dateObj.getSeconds())}`;
  }
}

function getTanggalHariIniWIB(d) {
  const dateObj = d || new Date();
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(dateObj);
  } catch (e) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}`;
  }
}

// Helper pemformat status perizinan manusiawi (PRD & Humanized Status)
function formatHumanStatusIzin(jenis) {
  if (!jenis) return 'Izin';
  let j = String(jenis).trim();
  // Bersihkan karakter robotic seperti (izin), (sakit), prefix Izin Resmi, dll.
  const lower = j.toLowerCase();
  if (lower.includes('sakit')) return 'Sakit';
  if (lower.includes('dispen')) return 'Dispensasi';
  if (lower.includes('izin') || lower.includes('ijin')) return 'Izin';
  // Hapus tanda kurung dan prefix redundan jika ada jenis lain
  j = j.replace(/\s*\([^)]*\)/g, '').replace(/^(izin|ijin|sakit)\s+resmi\s*/i, '').trim();
  return j ? (j.charAt(0).toUpperCase() + j.slice(1)) : 'Izin';
}

// Logika Evaluasi Status Kehadiran Real-Time (WIB):
// - Jika siswa sudah scan / hadir: status 'hadir' atau 'terlambat'
// - Jika siswa ada perizinan/sakit yang disetujui: status 'izin' atau 'sakit' (tidak boleh ditimpa alpa/scan)
// - Jika belum scan & tidak izin/sakit:
//     * Waktu < 08:00 WIB  -> "Terlambat" (Dihitung Terlambat, bukan lagi Belum Absen)
//     * Waktu >= 08:00 WIB -> "Alpa" (Otomatis)
function evaluasiStatusKehadiranRealtime(params) {
  const p = params || {};
  if (p.hasApprovedIzin) {
    const j = p.jenisIzin || 'izin';
    const humanLabel = formatHumanStatusIzin(j);
    const cleanJ = String(j).trim().toLowerCase();
    const finalStatus = cleanJ.includes('sakit') ? 'sakit'
      : (cleanJ.includes('dispen') ? 'dispensasi' : 'izin');
    return {
      status: finalStatus,
      label: humanLabel,
      cardClass: 'izin-sakit',
      isAlpa: false
    };
  }
  const cleanScanStatus = (p.statusScan ? String(p.statusScan).toLowerCase().trim() : '');
  const isValidScan = p.hasScan && (cleanScanStatus === 'hadir' || cleanScanStatus === 'terlambat' || cleanScanStatus === 'pulang');
  if (isValidScan) {
    const isLate = (typeof evaluasiAmbangBatasWaktu === 'function')
      ? evaluasiAmbangBatasWaktu(p.waktuScan) === 'terlambat'
      : (p.waktuScan && p.waktuScan > '06:30:00');
    return {
      status: isLate ? 'terlambat' : 'hadir',
      label: isLate ? 'Terlambat (' + (p.waktuScan ? p.waktuScan.slice(0, 5) : '') + ')' : 'Hadir Tepat Waktu (' + (p.waktuScan ? p.waktuScan.slice(0, 5) : '') + ')',
      cardClass: isLate ? 'izin-sakit' : 'hadir',
      isAlpa: false
    };
  }
  if (cleanScanStatus === 'alpa' || cleanScanStatus === 'alpha') {
    return {
      status: 'alpa',
      label: 'Alpa (Tanpa Keterangan)',
      cardClass: 'belum status-alpa',
      isAlpa: true
    };
  }
  const getJamFn = (typeof global !== 'undefined' && typeof global.getJamSekarangWIB === 'function')
    ? global.getJamSekarangWIB
    : getJamSekarangWIB;
  const jam = p.waktuSekarangWIB || (getJamFn ? getJamFn() : '07:00:00');
  const cleanJam = jam.length === 5 ? jam + ':00' : jam;
  if (cleanJam >= '08:00:00') {
    return {
      status: 'alpa',
      label: 'Alpa',
      cardClass: 'belum status-alpa',
      isAlpa: true
    };
  }
  return {
    status: 'terlambat',
    label: 'Terlambat',
    cardClass: 'status-terlambat terlambat',
    isAlpa: false
  };
}

// Fungsi Sinkronisasi Status Otomatis Alpa ke Firebase Realtime Database
// Dijalankan jika waktu sekarang >= 08:00:00 WIB
// Memeriksa seluruh siswa di kelas. Jika belum memiliki record kehadiran
// atau berstatus 'belum' / 'belum absen' (dan tidak sedang Izin/Sakit disetujui),
// otomatis mengubah dan menyimpan statusnya di Firebase menjadi 'alpa'.
async function sinkronisasiStatusAlpaFirebase(kelasInput, tanggalInput, jamInput) {
  const getJamFn = (typeof global !== 'undefined' && typeof global.getJamSekarangWIB === 'function')
    ? global.getJamSekarangWIB
    : getJamSekarangWIB;
  const jamWIB = jamInput || (getJamFn ? getJamFn() : '07:00:00');
  const cleanJamWIB = jamWIB.length === 5 ? jamWIB + ':00' : jamWIB;
  if (cleanJamWIB < '08:00:00') {
    return { success: false, synced: 0, totalSynced: 0, reason: 'BELUM_08_00_WIB', jamWIB: jamWIB };
  }

  const tanggal = tanggalInput || getTanggalHariIniWIB();
  const targetKelasList = kelasInput
    ? [normalisasiKelas(kelasInput)]
    : (typeof DAFTAR_KELAS_RESMI !== 'undefined' ? DAFTAR_KELAS_RESMI : ['XII RPL 1', 'XII RPL 2', 'XII TKJ 1']);

  const msSiswa = (typeof MASTER_DATA_SISWA_RESMI !== 'undefined' && MASTER_DATA_SISWA_RESMI) ? MASTER_DATA_SISWA_RESMI : {};
  let perizinanDisetujuiSet = new Set();

  const activeDb = (typeof global !== 'undefined' && global.db && typeof global.db.ref === 'function')
    ? global.db
    : ((typeof window !== 'undefined' && window.db && typeof window.db.ref === 'function')
      ? window.db
      : ((typeof db !== 'undefined' && db && typeof db.ref === 'function') ? db : null));

  if (activeDb) {
    try {
      const [snapJ, snapZ] = await Promise.all([
        activeDb.ref('perijinan').once('value').catch(() => null),
        activeDb.ref('perizinan').once('value').catch(() => null)
      ]);
      const processSnap = (snap) => {
        if (snap && snap.val()) {
          Object.values(snap.val()).forEach(iz => {
            if (iz && typeof iz === 'object') {
              const sNisn = String(iz.nisn || iz.siswaId || '').trim();
              const sTgl = iz.tanggal || iz.tanggal_norm;
              const sStatus = String(iz.status || '').toLowerCase().trim();
              if (sNisn && sTgl === tanggal && (sStatus === 'disetujui' || sStatus === 'approved')) {
                perizinanDisetujuiSet.add(sNisn);
              }
            }
          });
        }
      };
      processSnap(snapJ);
      processSnap(snapZ);
    } catch (eSnap) {}
  }

  let totalSynced = 0;
  const alpaNisns = [];

  for (const k of targetKelasList) {
    const normK = normalisasiKelas(k);
    if (!normK) continue;

    const siswaKelas = Object.entries(msSiswa).filter(([, s]) => {
      const sKelas = (s && (s.kelas || s.Kelas || s.rombel)) || '';
      return normalisasiKelas(sKelas) === normK;
    });

    if (siswaKelas.length === 0) continue;

    let presensiSnapVal = null;
    if (activeDb) {
      try {
        const snapP = await activeDb.ref('presensi_jam/' + normK + '/' + tanggal + '/1').once('value').catch(() => null);
        presensiSnapVal = snapP ? (snapP.val() || {}) : {};
      } catch (e) {
        presensiSnapVal = {};
      }
    } else {
      presensiSnapVal = {};
    }

    const updates = {};
    for (const [nisn] of siswaKelas) {
      if (perizinanDisetujuiSet.has(nisn)) {
        continue;
      }
      const existing = presensiSnapVal[nisn];
      const st = existing && existing.status ? String(existing.status).toLowerCase().trim() : '';
      const isSudah = existing && (st === 'hadir' || st === 'terlambat' || st === 'pulang' || st === 'sakit' || st === 'izin' || st === 'dispensasi');
      if (isSudah) {
        continue;
      }

      const isBelum = !existing || st === 'belum' || st === 'belum absen' || st === 'belum_absen' || st === '';
      if (isBelum) {
        const alpaRecord = {
          waktu: '08:00:00',
          status: 'alpa',
          tipe: 'auto_alpa_system',
          keterangan: 'Auto-Alpa (Tidak Hadir & Tanpa Keterangan s.d 08.00 WIB)',
          updatedAt: new Date().toISOString()
        };
        updates['presensi_jam/' + normK + '/' + tanggal + '/1/' + nisn] = alpaRecord;
        updates['absensi/' + nisn + '/' + tanggal] = {
          status: 'alpa',
          metode: 'auto_system',
          keterangan: 'Otomatis Alpa (Melewati 08:00 WIB)',
          updated_at: Date.now()
        };
        if (typeof firestoreDb !== 'undefined' && firestoreDb && typeof firestoreDb.collection === 'function') {
          try {
            firestoreDb.collection('attendances').doc(nisn + '_' + tanggal).set({
              status: 'alpa',
              metode: 'auto_system',
              keterangan: 'Otomatis Alpa (Melewati 08:00 WIB)',
              updated_at: Date.now()
            }, { merge: true }).catch(() => null);
          } catch (eFs) {}
        }
        totalSynced++;
        alpaNisns.push(nisn);
      }
    }

    if (Object.keys(updates).length > 0 && activeDb) {
      try {
        await activeDb.ref().update(updates).catch(() => null);
      } catch (eUp) {}
    }
  }

  return { success: true, synced: totalSynced, totalSynced: totalSynced, alpaNisns: alpaNisns, jamWIB: jamWIB };
}

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

// Konfigurasi Pengecualian Presensi Default (Hanya M. Ihsan Athallah & Rizky Ramadhani yang Belum Absen)
var EXCLUDED_BELUM_ABSEN_NISN = ['0098263610', '0082104129'];

function generateDefaultPresensiResmi(targetKelas, targetTanggal) {
  const normTarget = targetKelas ? normalisasiKelas(targetKelas) : null;
  const result = {};
  const tgl = targetTanggal || (typeof tanggalHariIni === 'function' ? tanggalHariIni() : new Date().toISOString().slice(0, 10));

  let counter = 0;
  Object.entries(MASTER_DATA_SISWA_RESMI).forEach(([nisn, s]) => {
    if (!s || typeof s !== 'object') return;
    const sKelas = normalisasiKelas(ambilKelasSiswa(s));
    if (normTarget && sKelas !== normTarget) return;

    // Siswa M. Ihsan Athallah (0098263610) dan Rizky Ramadhani (0082104129) TETAP Belum Absen
    if (EXCLUDED_BELUM_ABSEN_NISN.includes(String(nisn).trim())) {
      return;
    }

    // Variasi jam hadir pagi tepat waktu antara 06:12:00 s.d 06:28:00 WIB
    counter++;
    const minute = 12 + (counter % 16);
    const second = (counter * 7) % 60;
    const mStr = String(minute).padStart(2, '0');
    const sStr = String(second).padStart(2, '0');
    const waktu = '06:' + mStr + ':' + sStr;

    result[nisn] = {
      nisn: String(nisn),
      nama: s.nama,
      kelas: sKelas,
      status: 'hadir',
      waktu: waktu,
      metode: 'rfid',
      tanggal: tgl
    };
  });

  return result;
}

// Inisialisasi data penting jika belum ada di Firebase
async function bootstrapSistemUjikom() {
  if (typeof db === 'undefined' || !db) return;
  try {
    const snapKelas = await db.ref('kelas').once('value').catch(() => null);
    if (snapKelas && !snapKelas.exists()) {
      await db.ref('kelas').set(DEFAULT_STATUS_KELAS).catch(() => null);
    }
    const snapSiswa = await db.ref('siswa').once('value').catch(() => null);
    if (snapSiswa && (!snapSiswa.exists() || Object.keys(snapSiswa.val() || {}).length < 50)) {
      const current = snapSiswa.val() || {};
      const merged = Object.assign({}, MASTER_DATA_SISWA_RESMI, current);
      await db.ref('siswa').update(merged).catch(() => null);
    }
    const snapGuru = await db.ref('guru').once('value').catch(() => null);
    if (snapGuru && !snapGuru.exists()) {
      await db.ref('guru').set(MASTER_GURU_RESMI).catch(() => null);
    }
    const snapKartuA = await db.ref('kartu/' + KARTU_UJI_COBA.kartuA.uid).once('value').catch(() => null);
    if (snapKartuA && !snapKartuA.exists()) {
      await db.ref('kartu/' + KARTU_UJI_COBA.kartuA.uid).set({
        nisn: KARTU_UJI_COBA.kartuA.nisn,
        tipe: 'siswa',
        device_id: 'rpi-gateway-01'
      }).catch(() => null);
    }
    const snapKartuB = await db.ref('kartu/' + KARTU_UJI_COBA.kartuB.uid).once('value').catch(() => null);
    if (snapKartuB && !snapKartuB.exists()) {
      await db.ref('kartu/' + KARTU_UJI_COBA.kartuB.uid).set({
        nip: KARTU_UJI_COBA.kartuB.nip,
        tipe: 'guru',
        device_id: 'rpi-gateway-01'
      }).catch(() => null);
    }
    // Mapping Kartu RFID Fisik Ihsan (006787337) & Rizky (1058384422)
    await db.ref('kartu/006787337').update({
      nisn: '0098263610',
      nama: 'M. IHSAN ATHALLAH',
      kelas: 'XII RPL 2',
      tipe: 'siswa',
      device_id: 'rpi-gateway-01'
    }).catch(() => null);
    await db.ref('kartu/1058384422').update({
      nisn: '0082104129',
      nama: 'RIZKY RAMADANI',
      kelas: 'XII RPL 2',
      tipe: 'siswa',
      device_id: 'rpi-gateway-01'
    }).catch(() => null);
  } catch (err) {
    console.warn('[Bootstrap] Dilewati:', err.message);
  }
}


// Helper untuk mendapatkan referensi database Firebase Realtime
function getDbRef() {
  if (typeof db !== 'undefined' && db && db.ref) return db;
  if (typeof window !== 'undefined' && window.db && window.db.ref) return window.db;
  if (typeof global !== 'undefined' && global.db && global.db.ref) return global.db;
  return null;
}

// 1. Memulai permintaan penautan (pairing) kartu NFC/RFID di Firebase RTDB
async function mulaiPairingNfc(userData) {
  if (!userData) throw new Error('Data pengguna wajib diisi untuk pairing NFC');
  const userId = String(userData.userId || userData.nisn || userData.nip || '').trim();
  if (!userId) {
    throw new Error('User ID (NISN/NIP) wajib diisi untuk penautan kartu NFC.');
  }
  const rawRole = String(userData.role || '').toLowerCase();
  const isWalas = Boolean(userData.isWalas || rawRole === 'walas');
  const role = isWalas ? 'walas' : (rawRole === 'guru' || userData.nip ? 'guru' : 'siswa');
  const nama = String(userData.nama || userData.nama_lengkap || '').trim();
  const kelas = userData.kelas || (isWalas ? (userData.walasKelasId || '') : '');
  const mapel = userData.mapel || '';
  const walasKelasId = userData.walasKelasId || (isWalas ? kelas : '');
  const timestamp = Date.now();

  const pairingData = {
    active: true,
    userId: userId,
    role: role,
    nama: nama,
    kelas: kelas,
    mapel: mapel,
    isWalas: isWalas,
    walasKelasId: walasKelasId,
    timestamp: timestamp,
    status: 'waiting'
  };

  

if (typeof window !== 'undefined') {
    window._lastPairingRequest = pairingData;
  }
  if (typeof global !== 'undefined') {
    global.getWIBTime = getWIBTime;
    global._lastPairingRequest = pairingData;
  }

  const rtdb = getDbRef();
  if (rtdb && typeof rtdb.ref === 'function') {
    try {
      await rtdb.ref('pairing_request').set(pairingData);
    } catch (e) {
      console.warn('[Pairing] Gagal set pairing_request ke Firebase:', e.message);
    }
  }

  return pairingData;
}

// 2. Membatalkan permintaan penautan kartu NFC/RFID
async function batalkanPairingNfc() {
  const rtdb = getDbRef();
  let currentReq = null;
  if (rtdb && typeof rtdb.ref === 'function') {
    try {
      const snap = await rtdb.ref('pairing_request').once('value');
      currentReq = snap ? (typeof snap.val === 'function' ? snap.val() : snap.val) : null;
    } catch (e) {}
  }
  if (!currentReq) {
    currentReq = (typeof window !== 'undefined' && window._lastPairingRequest) ||
                 (typeof global !== 'undefined' && global._lastPairingRequest) || null;
  }

  // Jika pairing sudah sukses, jangan timpa status dengan 'cancelled'
  if (currentReq && currentReq.status === 'success') {
    return currentReq;
  }

  const cancelData = {
    active: false,
    status: 'cancelled',
    cancelledAt: Date.now()
  };

  if (typeof window !== 'undefined' && window._lastPairingRequest) {
    Object.assign(window._lastPairingRequest, cancelData);
  }
  if (typeof global !== 'undefined' && global._lastPairingRequest) {
    Object.assign(global._lastPairingRequest, cancelData);
  }

  if (rtdb && typeof rtdb.ref === 'function') {
    try {
      await rtdb.ref('pairing_request').update(cancelData);
    } catch (e) {
      console.warn('[Pairing] Gagal batalkan pairing_request:', e.message);
    }
  }

  return cancelData;
}

// 3. Mendengarkan status atau hasil penautan NFC secara realtime
function dengarkanHasilPairing(callback) {
  if (typeof callback !== 'function') return () => {};
  const rtdb = getDbRef();
  if (rtdb && typeof rtdb.ref === 'function') {
    const ref = rtdb.ref('pairing_request');
    const onVal = (snap) => {
      const val = snap ? (typeof snap.val === 'function' ? snap.val() : snap.val) : null;
      callback(val);
    };
    ref.on('value', onVal);
    return () => ref.off('value', onVal);
  }

  let prevValJson = '';
  const interval = setInterval(() => {
    const current = (typeof window !== 'undefined' && window._lastPairingRequest) ||
                    (typeof global !== 'undefined' && global._lastPairingRequest) || null;
    const curJson = JSON.stringify(current);
    if (curJson !== prevValJson) {
      prevValJson = curJson;
      callback(current);
    }
  }, 200);
  return () => clearInterval(interval);
}

// 4. Simulasi Tap Kartu Pairing (Web & Hardware simulation)
async function simulasiTapPairing(uid) {
  const now = Date.now();
  let cleanUid = uid ? String(uid).trim().toUpperCase() : '';
  if (!cleanUid) {
    cleanUid = '04' + Math.random().toString(16).substring(2, 8).toUpperCase();
  }

  const rtdb = getDbRef();
  let req = null;
  if (rtdb && typeof rtdb.ref === 'function') {
    try {
      const snap = await rtdb.ref('pairing_request').once('value');
      req = snap ? (typeof snap.val === 'function' ? snap.val() : snap.val) : null;
    } catch (e) {
      console.warn('[Pairing] Gagal membaca pairing_request:', e.message);
    }
  }

  if (!req) {
    req = (typeof window !== 'undefined' && window._lastPairingRequest) ||
          (typeof global !== 'undefined' && global._lastPairingRequest);
  }

  if (!req || req.active !== true || req.status !== 'waiting') {
    return {
      success: false,
      reason: 'NO_ACTIVE_REQUEST',
      message: 'Tidak ada permintaan penautan NFC yang sedang aktif.'
    };
  }

  const elapsed = now - (req.timestamp || 0);
  if (elapsed > 30000) {
    const expiredData = { active: false, status: 'expired', expiredAt: now };
    if (rtdb && typeof rtdb.ref === 'function') {
      try { await rtdb.ref('pairing_request').update(expiredData); } catch (e) {}
    }
    if (typeof window !== 'undefined' && window._lastPairingRequest) {
      Object.assign(window._lastPairingRequest, expiredData);
    }
    if (typeof global !== 'undefined' && global._lastPairingRequest) {
      Object.assign(global._lastPairingRequest, expiredData);
    }
    return {
      success: false,
      reason: 'EXPIRED',
      message: 'Permintaan penautan kartu telah kedaluwarsa (>30 detik).'
    };
  }

  const role = String(req.role || '').toLowerCase();
  const isGuru = role === 'guru' || role === 'walas' || Boolean(req.isWalas);
  let cardData = {
    uid: cleanUid,
    tipe: isGuru ? 'guru' : 'siswa',
    nama: req.nama,
    linkedAt: now
  };

  if (isGuru) {
    cardData.nip = req.userId || req.nip || '';
    cardData.mapel = req.mapel || '-';
    cardData.isWalas = Boolean(req.isWalas || role === 'walas');
    cardData.walasKelasId = req.walasKelasId || (cardData.isWalas ? req.kelas : '');
    if (req.kelas) cardData.kelas = req.kelas;
  } else {
    cardData.nisn = req.userId || req.nisn || '';
    cardData.kelas = req.kelas || 'XII RPL 2';
  }

  if (rtdb && typeof rtdb.ref === 'function') {
    try {
      // Bersihkan kartu lama pengguna jika ada (re-assignment / perbarui kartu)
      const snapKartu = await rtdb.ref('kartu').once('value');
      const allCards = snapKartu ? (typeof snapKartu.val === 'function' ? snapKartu.val() : snapKartu.val) : null;
      const targetUserId = String(cardData.nip || cardData.nisn || req.userId || '').trim();
      if (allCards && typeof allCards === 'object' && targetUserId) {
        for (const [kUid, item] of Object.entries(allCards)) {
          if (!item || kUid === cleanUid) continue;
          const itemId = String(typeof item === 'string' ? item : (item.nisn || item.nip || item.userId || '')).trim();
          if (itemId === targetUserId) {
            const oldRef = rtdb.ref('kartu/' + kUid);
            if (typeof oldRef.remove === 'function') {
              await oldRef.remove();
            } else {
              await oldRef.set(null);
            }
          }
        }
      }

      await rtdb.ref('kartu/' + cleanUid).set(cardData);
    } catch (e) {
      console.warn('[Pairing] Gagal simpan kartu ke Firebase:', e.message);
    }
  }

  const successData = {
    active: false,
    status: 'success',
    uid: cleanUid,
    linkedCard: cardData,
    completedAt: now
  };

  if (rtdb && typeof rtdb.ref === 'function') {
    try {
      await rtdb.ref('pairing_request').update(successData);
    } catch (e) {}
  }
  if (typeof window !== 'undefined' && window._lastPairingRequest) {
    Object.assign(window._lastPairingRequest, successData);
  }
  if (typeof global !== 'undefined' && global._lastPairingRequest) {
    Object.assign(global._lastPairingRequest, successData);
  }

  return {
    success: true,
    uid: cleanUid,
    cardData: cardData
  };
}

// 5. Cek apakah pengguna sudah memiliki kartu terdaftar di /kartu
async function cekKartuUser(userId) {
  if (!userId) return null;
  const cleanId = String(userId).trim();
  const rtdb = getDbRef();
  if (rtdb && typeof rtdb.ref === 'function') {
    try {
      const snap = await rtdb.ref('kartu').once('value');
      const val = snap ? (typeof snap.val === 'function' ? snap.val() : snap.val) : null;
      if (val && typeof val === 'object') {
        const matches = [];
        for (const [uid, item] of Object.entries(val)) {
          if (!item) continue;
          if (typeof item === 'string' && item === cleanId) {
            matches.push({ uid, nisn: item, tipe: 'siswa', linkedAt: 0 });
          } else if (item.nisn === cleanId || item.nip === cleanId || item.userId === cleanId) {
            matches.push({ uid, ...item, linkedAt: item.linkedAt || 0 });
          }
        }
        if (matches.length > 0) {
          // Pilih kartu dengan timestamp linkedAt paling baru
          matches.sort((a, b) => (b.linkedAt || 0) - (a.linkedAt || 0));
          return matches[0];
        }
      }
    } catch (e) {
      console.warn('[Pairing] Gagal cek kartu di Firebase:', e.message);
    }
  }
  return null;
}

// ===================================================================
// BAGIAN 1: LAPISAN FONDASI & HELPER KANONIK (PRESENSIA IOT UJIKOM)
// ===================================================================

function getWIBDateTime() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(now);

  const map = {};
  parts.forEach(p => { map[p.type] = p.value; });

  const hour = parseInt(map.hour === '24' ? '00' : map.hour, 10);
  const minute = parseInt(map.minute, 10);
  const second = parseInt(map.second, 10);
  const tanggal = `${map.year}-${map.month}-${map.day}`;
  const jam = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
  const menitTotal = hour * 60 + minute;

  const namaHariList = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const wibDateObj = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  const hari = namaHariList[wibDateObj.getDay()];

  return {
    tanggal,
    jam,
    hour,
    minute,
    second,
    menitTotal,
    hari,
    isTepatWaktu: menitTotal <= 390,
    isWindowTerlambat: menitTotal > 390 && menitTotal < 480,
    isAfterCutoffAlpa: menitTotal >= 480
  };
}

function normalizeKelasId(rawKelas) {
  if (!rawKelas) return 'XII_RPL_2';
  return String(rawKelas).trim().toUpperCase().replace(/\s+/g, '_').replace(/-/g, '_');
}

function normalizePermit(docSnap) {
  const d = (docSnap && typeof docSnap.data === 'function') ? docSnap.data() : (docSnap || {});
  const id = (docSnap && docSnap.id) || d.id || d.permitId || d.pid || '';
  const rawTipe = String(d.tipe || d.jenisPermit || d.kategori || d.jenis || 'izin').toLowerCase().trim();
  const rawStatus = String(d.status || 'pending').toLowerCase().trim();

  let status = 'pending';
  if (['approved', 'disetujui', 'acc', 'diterima'].includes(rawStatus)) status = 'approved';
  else if (['rejected', 'ditolak', 'tolak'].includes(rawStatus)) status = 'rejected';

  const rolePengaju = (rawTipe === 'kendala_guru' || d.rolePengaju === 'guru' || d.rolePengaju === 'walas' || d.targetRole === 'admin' || d.isGuru)
    ? 'guru'
    : 'siswa';

  const wibTgl = (typeof getWIBDateTime === 'function') ? getWIBDateTime().tanggal : new Date().toISOString().slice(0, 10);
  const tanggal = d.tanggal || d.tanggal_norm || wibTgl;

  return {
    ...d,
    id,
    permitId: id,
    pid: id,
    pengajuId: d.pengajuId || d.studentId || d.nisn || d.nip || d.userId || '',
    userId: d.userId || d.pengajuId || '',
    nisn: d.nisn || d.pengajuId || d.studentId || '',
    namaPengaju: d.namaPengaju || d.namaSiswa || d.namaGuru || d.nama || 'Tanpa Nama',
    nama: d.nama || d.namaPengaju || d.namaSiswa || 'Tanpa Nama',
    nama_siswa: d.nama_siswa || d.namaPengaju || d.namaSiswa || d.nama || 'Tanpa Nama',
    rolePengaju,
    targetRole: rolePengaju === 'guru' ? 'admin' : 'walas',
    targetKelasId: normalizeKelasId(d.targetKelasId || d.kelasId || d.kelas || 'XII_RPL_2'),
    kelasId: normalizeKelasId(d.targetKelasId || d.kelasId || d.kelas || 'XII_RPL_2'),
    kelas: (d.kelas && d.kelas !== '-') ? d.kelas : normalizeKelasId(d.targetKelasId || d.kelasId || 'XII_RPL_2').replace(/_/g, ' '),
    tipe: rawTipe,
    jenis: rawTipe,
    jenisPermit: rawTipe,
    labelTipe: rawTipe === 'sakit' ? 'Sakit' : rawTipe === 'dispen' ? 'Dispen' : rawTipe === 'kendala_guru' ? 'Kendala Mengajar' : 'Izin',
    tanggal: tanggal,
    tanggal_norm: tanggal,
    alasan: d.alasan || d.keterangan || d.deskripsiKendala || '-',
    lampiranUrl: d.lampiranUrl || d.fileBuktiUrl || d.buktiUrl || d.dokumen_url || d.foto_bukti || d.dokumentasi || null,
    dokumen_url: d.lampiranUrl || d.fileBuktiUrl || d.buktiUrl || d.dokumen_url || d.foto_bukti || d.dokumentasi || null,
    foto_bukti: d.lampiranUrl || d.fileBuktiUrl || d.buktiUrl || d.dokumen_url || d.foto_bukti || d.dokumentasi || null,
    lampiranNama: d.lampiranNama || 'Bukti_Dokumen',
    lampiranTipe: d.lampiranTipe || '',
    status,
    labelStatus: status === 'approved' ? 'Disetujui' : status === 'rejected' ? 'Ditolak' : 'Menunggu',
    catatanReviewer: d.catatanReviewer || d.alasanTolak || d.catatan_guru || null,
    approvedBy: d.approvedBy || d.diverifikasi_oleh || null,
    createdAtMs: (d.createdAt && typeof d.createdAt.toMillis === 'function') ? d.createdAt.toMillis() : (d.createdAt || d.dibuat_pada || d.timestamp || 0)
  };
}

function normalizeAttendance(docSnap) {
  const d = (docSnap && typeof docSnap.data === 'function') ? docSnap.data() : (docSnap || {});
  const id = (docSnap && docSnap.id) || d.id || d.attendanceId || '';
  const rawStatus = String(d.status || 'belum_absen').toLowerCase().trim();
  return {
    ...d,
    id,
    attendanceId: id,
    userId: d.userId || d.studentId || d.nisn || '',
    studentId: d.studentId || d.userId || d.nisn || '',
    nisn: d.nisn || d.studentId || d.userId || '',
    nama: d.nama || d.namaSiswa || '-',
    namaSiswa: d.namaSiswa || d.nama || '-',
    role: d.role || 'siswa',
    kelasId: normalizeKelasId(d.kelasId || d.kelas),
    tanggal: d.tanggal || (typeof getWIBDateTime === 'function' ? getWIBDateTime().tanggal : ''),
    jamMasuk: d.jamMasuk || d.waktu || '-',
    status: rawStatus,
    metode: d.metode || 'rfid',
    keterangan: d.keterangan || '-',
    approvedBy: d.approvedBy || null
  };
}

function normalizeClass(docSnap) {
  const d = (docSnap && typeof docSnap.data === 'function') ? docSnap.data() : (docSnap || {});
  const id = normalizeKelasId((docSnap && docSnap.id) || d.id || d.kelasId);
  const rawStatus = String(d.status || d.statusKelas || 'belajar').toLowerCase().trim();
  return {
    ...d,
    id,
    kelasId: id,
    nama: d.nama || d.namaKelas || id.replace(/_/g, ' '),
    namaKelas: d.namaKelas || d.nama || id.replace(/_/g, ' '),
    status: rawStatus,
    statusKelas: rawStatus,
    activeMapel: d.activeMapel || d.mapel || '-',
    activeTeacherId: d.activeTeacherId || d.walasId || null,
    activeTeacherNama: d.activeTeacherNama || d.namaGuru || '-',
    keteranganStatus: d.keteranganStatus || ''
  };
}

async function processAttachmentFile(file) {
  if (!file) throw new Error('Silakan pilih file bukti dokumen terlebih dahulu.');

  const isImage = (file.type && file.type.startsWith('image/')) || (file.name && /\.(jpe?g|png|webp|gif|bmp)$/i.test(file.name));
  if (isImage) {
    if (typeof document === 'undefined') {
      return {
        lampiranUrl: 'data:image/jpeg;base64,mockImageBase64',
        lampiranNama: file.name || 'bukti.jpg',
        lampiranTipe: 'image/jpeg'
      };
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = () => reject(new Error('Format gambar tidak valid.'));
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;
          let { width, height } = img;

          if (width > MAX_WIDTH || height > MAX_HEIGHT) {
            const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.78);
          resolve({
            lampiranUrl: compressedDataUrl,
            lampiranNama: file.name || 'bukti.jpg',
            lampiranTipe: 'image/jpeg'
          });
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  const isPdf = file.type === 'application/pdf' || (file.name && /\.pdf$/i.test(file.name));
  if (isPdf) {
    if (file.size > 750 * 1024) {
      throw new Error('Ukuran PDF maksimal 750 KB, atau silakan unggah tangkapan layar (foto/JPG/PNG) surat izin.');
    }
    if (typeof FileReader === 'undefined') {
      return {
        lampiranUrl: 'data:application/pdf;base64,mockPdfBase64',
        lampiranNama: file.name || 'surat.pdf',
        lampiranTipe: 'application/pdf'
      };
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Gagal membaca file PDF.'));
      reader.onload = (e) => resolve({
        lampiranUrl: e.target.result,
        lampiranNama: file.name || 'surat.pdf',
        lampiranTipe: 'application/pdf'
      });
      reader.readAsDataURL(file);
    });
  }

  throw new Error('Format file harus berupa Gambar (JPG/PNG) atau PDF.');
}

function openDocumentModal(permitIdOrObj) {
  if (!permitIdOrObj) return;
  let permit = null;
  if (typeof permitIdOrObj === 'object') {
    permit = normalizePermit(permitIdOrObj);
  } else {
    let found = null;
    if (typeof ambilDataPerizinanLokalWalas === 'function') {
      const all = ambilDataPerizinanLokalWalas();
      found = all[permitIdOrObj] || Object.values(all).find(p => p.id === permitIdOrObj || p.pid === permitIdOrObj);
    }
    if (!found && typeof perijinanStore !== 'undefined' && perijinanStore.daftar) {
      found = perijinanStore.daftar.find(p => p.id === permitIdOrObj || p.pid === permitIdOrObj);
    }
    permit = normalizePermit(found || { id: permitIdOrObj, namaPengaju: 'Siswa' });
  }

  if (typeof document === 'undefined') return;

  let modal = document.getElementById('modalDokumenPresensia');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modalDokumenPresensia';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.75);backdrop-filter:blur(5px);z-index:999999;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;';
    document.body.appendChild(modal);
  }

  const badgeColor = permit.status === 'approved' ? '#059669' : (permit.status === 'rejected' ? '#dc2626' : '#d97706');
  const badgeBg = permit.status === 'approved' ? '#d1fae5' : (permit.status === 'rejected' ? '#fee2e2' : '#fef3c7');

  let fileContentHtml = '';
  const url = permit.lampiranUrl;
  if (url && typeof url === 'string' && url !== '[Tersimpan di Penyimpanan Lokal]') {
    const isPdf = url.startsWith('data:application/pdf') || url.toLowerCase().includes('.pdf');
    if (isPdf) {
      fileContentHtml = `
        <div style="margin-top:14px;border-radius:10px;overflow:hidden;border:1px solid #e2e8f0;background:#ffffff;">
          <iframe src="${url}" style="width:100%;height:65vh;border:none;"></iframe>
        </div>
        <div style="margin-top:10px;text-align:right;">
          <a href="${url}" download="${permit.lampiranNama || 'Dokumen_Bukti.pdf'}" target="_blank" style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;background:#2563eb;color:#ffffff;border-radius:8px;font-size:13px;text-decoration:none;font-weight:700;">
            Unduh Dokumen PDF
          </a>
        </div>
      `;
    } else {
      fileContentHtml = `
        <div style="margin-top:14px;text-align:center;background:#0f172a;border-radius:10px;padding:12px;overflow:hidden;">
          <img src="${url}" alt="${permit.lampiranNama || 'Bukti Dokumen'}" style="width:100%;max-height:65vh;object-fit:contain;border-radius:6px;" />
        </div>
        <div style="margin-top:10px;text-align:right;">
          <a href="${url}" download="${permit.lampiranNama || 'Bukti_Dokumen.jpg'}" target="_blank" style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;background:#2563eb;color:#ffffff;border-radius:8px;font-size:13px;text-decoration:none;font-weight:700;">
            Buka Gambar Penuh / Unduh
          </a>
        </div>
      `;
    }
  } else {
    fileContentHtml = `
      <div style="padding:36px 16px;text-align:center;background:#f8fafc;border-radius:10px;border:1.5px dashed #cbd5e1;margin-top:14px;">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:10px;">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
        </svg>
        <p style="font-weight:800;color:#0f172a;font-size:14px;margin-bottom:4px;">Tidak Ada Lampiran Dokumen</p>
        <p style="color:#64748b;font-size:13px;margin:0;">Pengajuan ini tidak menyertakan file lampiran.</p>
      </div>
    `;
  }

  modal.innerHTML = `
    <div style="background:#ffffff;border-radius:16px;max-width:700px;width:100%;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);overflow:hidden;font-family:system-ui,-apple-system,sans-serif;">
      <div style="padding:16px 22px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;background:#f8fafc;">
        <div>
          <h3 style="font-size:16px;font-weight:800;color:#0f172a;margin:0;">Bukti Surat Izin — ${permit.namaPengaju}</h3>
          <p style="font-size:12px;color:#64748b;margin:3px 0 0 0;">Kelas: ${permit.targetKelasId.replace(/_/g, ' ')} • Tanggal: ${permit.tanggal}</p>
        </div>
        <button onclick="document.getElementById('modalDokumenPresensia').style.display='none'" style="background:#e2e8f0;border:none;cursor:pointer;color:#475569;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div style="padding:18px 22px;overflow-y:auto;flex:1;">
        <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:14px;">
          <span style="font-size:12px;font-weight:800;padding:4px 12px;border-radius:999px;background:#e0e7ff;color:#3730a3;">${permit.labelTipe}</span>
          <span style="font-size:12px;font-weight:800;padding:4px 12px;border-radius:999px;background:${badgeBg};color:${badgeColor};">${permit.labelStatus}</span>
          <span style="font-size:12.5px;color:#475569;margin-left:auto;">Alasan: <strong>${permit.alasan}</strong></span>
        </div>
        ${permit.catatanReviewer ? `<div style="background:#fee2e2;border-left:4px solid #ef4444;padding:10px 14px;border-radius:6px;font-size:12.5px;color:#991b1b;margin-bottom:14px;"><strong>Catatan Reviewer:</strong> ${permit.catatanReviewer}</div>` : ''}
        ${fileContentHtml}
      </div>
      <div style="padding:14px 22px;border-top:1px solid #f1f5f9;background:#f8fafc;text-align:right;">
        <button onclick="document.getElementById('modalDokumenPresensia').style.display='none'" style="padding:8px 18px;background:#0f172a;color:#ffffff;border:none;border-radius:8px;font-weight:700;font-size:13px;cursor:pointer;">Tutup</button>
      </div>
    </div>
  `;
  modal.style.display = 'flex';
}

async function enforceAttendanceCutoffAndSync(kelasIdList) {
  const wib = getWIBDateTime();
  const targetKelasList = (kelasIdList && kelasIdList.length > 0)
    ? kelasIdList.map(k => normalizeKelasId(k))
    : ['XII_RPL_1', 'XII_RPL_2', 'XII_TKJ_1'];

  if (typeof sinkronisasiStatusAlpaFirebase === 'function') {
    for (const k of targetKelasList) {
      try {
        await sinkronisasiStatusAlpaFirebase(k, wib.tanggal);
      } catch (e) {}
    }
  }

  const msSiswa = (typeof MASTER_DATA_SISWA_RESMI !== 'undefined') ? MASTER_DATA_SISWA_RESMI : {};
  let totalAlpaSynced = 0;

  const approvedPermitsMap = {};
  if (typeof ambilDataPerizinanLokal === 'function') {
    const list = ambilDataPerizinanLokal();
    (Array.isArray(list) ? list : Object.values(list)).forEach(p => {
      if (p && (p.status === 'approved' || p.status === 'disetujui') && (p.tanggal === wib.tanggal || p.tanggal_norm === wib.tanggal)) {
        const nisn = String(p.nisn || p.pengajuId || p.siswaId || '').trim();
        if (nisn) approvedPermitsMap[nisn] = normalizePermit(p);
      }
    });
  }

  for (const [nisn, s] of Object.entries(msSiswa)) {
    if (!s) continue;
    const sKelasNorm = normalizeKelasId(s.kelas || s.rombel);
    if (!targetKelasList.includes(sKelasNorm)) continue;

    if (approvedPermitsMap[nisn]) {
      const p = approvedPermitsMap[nisn];
      if (typeof firestoreDb !== 'undefined' && firestoreDb && typeof firestoreDb.collection === 'function') {
        try {
          await firestoreDb.collection('attendances').doc(`${nisn}_${wib.tanggal}`).set({
            attendanceId: `${nisn}_${wib.tanggal}`,
            userId: nisn,
            studentId: nisn,
            nama: s.nama,
            namaSiswa: s.nama,
            role: 'siswa',
            kelasId: sKelasNorm,
            tanggal: wib.tanggal,
            jamMasuk: '-',
            status: p.tipe,
            metode: 'izin_walas',
            keterangan: `Izin resmi disetujui Walas (${p.alasan})`,
            approvedBy: p.approvedBy || 'Wali Kelas',
            updatedAt: (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue) ? firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString()
          }, { merge: true });
        } catch (e) {}
      }
      continue;
    }

    if (wib.isAfterCutoffAlpa) {
      if (typeof firestoreDb !== 'undefined' && firestoreDb && typeof firestoreDb.collection === 'function') {
        try {
          const docRef = firestoreDb.collection('attendances').doc(`${nisn}_${wib.tanggal}`);
          const snap = await docRef.get();
          const curData = snap.exists ? snap.data() : null;
          const curStatus = curData ? String(curData.status || '').toLowerCase() : '';

          if (!curData || curStatus === 'belum_absen' || curStatus === '') {
            await docRef.set({
              attendanceId: `${nisn}_${wib.tanggal}`,
              userId: nisn,
              studentId: nisn,
              nama: s.nama,
              namaSiswa: s.nama,
              role: 'siswa',
              kelasId: sKelasNorm,
              tanggal: wib.tanggal,
              jamMasuk: '-',
              status: 'alpa',
              metode: 'auto_system',
              keterangan: 'Otomatis Alpa (Cut-off 08:00 WIB)',
              updatedAt: (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue) ? firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString()
            }, { merge: true });
            totalAlpaSynced++;
          }
        } catch (e) {}
      }
    }
  }

  return { success: true, wib, totalAlpaSynced };
}

async function approveStudentPermit(permitIdOrObj) {
  const permit = normalizePermit(permitIdOrObj);
  const currentUserId = (typeof getSessionUser === 'function' && getSessionUser() ? getSessionUser().uid : null) || 'walas_resmi';

  if (typeof prosesApprovalIzin === 'function') {
    await prosesApprovalIzin(permit.id, 'disetujui');
  }

  if (typeof firestoreDb !== 'undefined' && firestoreDb && typeof firestoreDb.collection === 'function') {
    try {
      const serverTs = (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue) ? firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString();
      await firestoreDb.collection('permits').doc(permit.id).set({
        status: 'approved',
        approvedBy: currentUserId,
        approvedAt: serverTs
      }, { merge: true });

      await firestoreDb.collection('attendances').doc(`${permit.pengajuId}_${permit.tanggal}`).set({
        attendanceId: `${permit.pengajuId}_${permit.tanggal}`,
        userId: permit.pengajuId,
        studentId: permit.pengajuId,
        nama: permit.namaPengaju,
        namaSiswa: permit.namaPengaju,
        role: 'siswa',
        kelasId: permit.targetKelasId,
        tanggal: permit.tanggal,
        jamMasuk: '-',
        status: permit.tipe,
        metode: 'izin_walas',
        keterangan: permit.alasan,
        approvedBy: currentUserId,
        updatedAt: serverTs
      }, { merge: true });
    } catch (e) {}
  }

  const notifMsg = `✅ Pengajuan ${permit.labelTipe} tanggal ${permit.tanggal} telah DISETUJUI oleh Wali Kelas.`;
  if (typeof kirimChatPerijinan === 'function') {
    try {
      await kirimChatPerijinan(permit.id, { role: 'walas', nama: 'Wali Kelas' }, notifMsg);
    } catch (e) {}
  }

  return { success: true, permitId: permit.id, status: 'approved' };
}

async function rejectStudentPermit(permitIdOrObj, alasanTolak) {
  const permit = normalizePermit(permitIdOrObj);
  const currentUserId = (typeof getSessionUser === 'function' && getSessionUser() ? getSessionUser().uid : null) || 'walas_resmi';
  const catatan = alasanTolak || 'Dokumen bukti kurang jelas / tidak valid';

  if (typeof prosesApprovalIzin === 'function') {
    await prosesApprovalIzin(permit.id, 'ditolak');
  }

  if (typeof firestoreDb !== 'undefined' && firestoreDb && typeof firestoreDb.collection === 'function') {
    try {
      const serverTs = (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue) ? firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString();
      await firestoreDb.collection('permits').doc(permit.id).set({
        status: 'rejected',
        catatanReviewer: catatan,
        approvedBy: currentUserId,
        approvedAt: serverTs
      }, { merge: true });
    } catch (e) {}
  }

  const notifMsg = `❌ Pengajuan ${permit.labelTipe} tanggal ${permit.tanggal} DITOLAK oleh Wali Kelas. Catatan: ${catatan}`;
  if (typeof kirimChatPerijinan === 'function') {
    try {
      await kirimChatPerijinan(permit.id, { role: 'walas', nama: 'Wali Kelas' }, notifMsg);
    } catch (e) {}
  }

  return { success: true, permitId: permit.id, status: 'rejected', catatanReviewer: catatan };
}

async function approveTeacherObstacle(permitIdOrObj) {
  const permit = normalizePermit(permitIdOrObj);
  const currentAdmin = (typeof getSessionUser === 'function' && getSessionUser() ? getSessionUser() : null) || { uid: 'admin_presensia', nama: 'Administrator' };
  const targetKelasId = normalizeKelasId(permit.targetKelasId || permit.kelasId || 'XII_RPL_2');

  if (typeof konfirmasiKendalaGuruAdmin === 'function') {
    await konfirmasiKendalaGuruAdmin(permit.id, 'approved', targetKelasId);
  }

  if (typeof firestoreDb !== 'undefined' && firestoreDb && typeof firestoreDb.collection === 'function') {
    try {
      const serverTs = (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue) ? firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString();
      await firestoreDb.collection('permits').doc(permit.id).set({
        status: 'approved',
        approvedBy: currentAdmin.uid,
        approvedAt: serverTs
      }, { merge: true });

      await firestoreDb.collection('classes').doc(targetKelasId).set({
        id: targetKelasId,
        kelasId: targetKelasId,
        nama: targetKelasId.replace(/_/g, ' '),
        namaKelas: targetKelasId.replace(/_/g, ' '),
        status: 'jamkos',
        statusKelas: 'jamkos',
        activeMapel: permit.mapel || 'Jam Kosong Terkonfirmasi',
        activeTeacherNama: permit.namaPengaju,
        keteranganStatus: `Jamkos (${permit.namaPengaju}: ${permit.alasan})`,
        updatedAt: serverTs
      }, { merge: true });
    } catch (e) {}
  }

  if (typeof db !== 'undefined' && db && typeof db.ref === 'function') {
    try {
      const updateData = {
        status: 'jamkos',
        statusKelas: 'jamkos',
        activeMapel: permit.mapel || 'Jam Kosong Terkonfirmasi',
        activeTeacherNama: permit.namaPengaju,
        keteranganStatus: `Jamkos (${permit.namaPengaju}: ${permit.alasan})`,
        updatedAt: Date.now()
      };
      await Promise.all([
        db.ref('classes/' + targetKelasId).update(updateData).catch(() => null),
        db.ref('status_kelas/' + targetKelasId).update(updateData).catch(() => null),
        db.ref('kelas/' + targetKelasId).update(updateData).catch(() => null)
      ]);
    } catch (e) {}
  }

  return { success: true, targetKelasId, status: 'jamkos' };
}

if (typeof window !== 'undefined') {
  window.DAFTAR_KELAS_RESMI = DAFTAR_KELAS_RESMI;
  window.MASTER_GURU_RESMI = MASTER_GURU_RESMI;
  window.KARTU_UJI_COBA = KARTU_UJI_COBA;
  window.DEFAULT_STATUS_KELAS = DEFAULT_STATUS_KELAS;
  window.MASTER_DATA_SISWA_RESMI = MASTER_DATA_SISWA_RESMI;
  window.DATA_SISWA_RESMI = MASTER_DATA_SISWA_RESMI;
  window.dataSiswaCache = MASTER_DATA_SISWA_RESMI;
  window.EXCLUDED_BELUM_ABSEN_NISN = EXCLUDED_BELUM_ABSEN_NISN;
  window.generateDefaultPresensiResmi = generateDefaultPresensiResmi;
  window.ambilKelasSiswa = ambilKelasSiswa;
  window.normalisasiKelas = normalisasiKelas;
  window.parseSiswaSnapshot = parseSiswaSnapshot;
  window.evaluasiAmbangBatasWaktu = evaluasiAmbangBatasWaktu;
  window.getWIBTime = getWIBTime;
  window.getJamSekarangWIB = getJamSekarangWIB;
  window.getTanggalHariIniWIB = getTanggalHariIniWIB;
  window.formatHumanStatusIzin = formatHumanStatusIzin;
  window.evaluasiStatusKehadiranRealtime = evaluasiStatusKehadiranRealtime;
  window.sinkronisasiStatusAlpaFirebase = sinkronisasiStatusAlpaFirebase;
  window.bootstrapSistemUjikom = bootstrapSistemUjikom;
  window.mulaiPairingNfc = mulaiPairingNfc;
  window.batalkanPairingNfc = batalkanPairingNfc;
  window.dengarkanHasilPairing = dengarkanHasilPairing;
  window.simulasiTapPairing = simulasiTapPairing;
  window.cekKartuUser = cekKartuUser;

  window.getWIBDateTime = getWIBDateTime;
  window.normalizeKelasId = normalizeKelasId;
  window.normalizePermit = normalizePermit;
  window.normalizeAttendance = normalizeAttendance;
  window.normalizeClass = normalizeClass;
  window.processAttachmentFile = processAttachmentFile;
  window.openDocumentModal = openDocumentModal;
  window.enforceAttendanceCutoffAndSync = enforceAttendanceCutoffAndSync;
  window.approveStudentPermit = approveStudentPermit;
  window.rejectStudentPermit = rejectStudentPermit;
  window.approveTeacherObstacle = approveTeacherObstacle;
  if (typeof global !== 'undefined') {
    global.getWIBDateTime = getWIBDateTime;
    global.normalizeKelasId = normalizeKelasId;
    global.normalizePermit = normalizePermit;
    global.normalizeAttendance = normalizeAttendance;
    global.normalizeClass = normalizeClass;
    global.processAttachmentFile = processAttachmentFile;
    global.openDocumentModal = openDocumentModal;
    global.enforceAttendanceCutoffAndSync = enforceAttendanceCutoffAndSync;
    global.approveStudentPermit = approveStudentPermit;
    global.rejectStudentPermit = rejectStudentPermit;
    global.formatHumanStatusIzin = formatHumanStatusIzin;
    global.approveTeacherObstacle = approveTeacherObstacle;
  }

    bootstrapSistemUjikom();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    firebaseConfig,
    DAFTAR_KELAS_RESMI,
    MASTER_GURU_RESMI,
    ADMIN_IDENTITY_RESMI,
    KARTU_UJI_COBA,
    DEFAULT_STATUS_KELAS,
    MASTER_DATA_SISWA_RESMI,
    DATA_SISWA_RESMI: MASTER_DATA_SISWA_RESMI,
    dataSiswaCache: MASTER_DATA_SISWA_RESMI,
    EXCLUDED_BELUM_ABSEN_NISN,
    generateDefaultPresensiResmi,
    ambilKelasSiswa,
    normalisasiKelas,
    parseSiswaSnapshot,
    evaluasiAmbangBatasWaktu,
    getWIBTime,
    getJamSekarangWIB,
    getTanggalHariIniWIB,
    formatHumanStatusIzin,
    evaluasiStatusKehadiranRealtime,
    sinkronisasiStatusAlpaFirebase,
    bootstrapSistemUjikom,
    mulaiPairingNfc,
    batalkanPairingNfc,
    dengarkanHasilPairing,
    simulasiTapPairing,
    cekKartuUser,
    getWIBDateTime,
    normalizeKelasId,
    normalizePermit,
    normalizeAttendance,
    normalizeClass,
    processAttachmentFile,
    openDocumentModal,
    enforceAttendanceCutoffAndSync,
    approveStudentPermit,
    rejectStudentPermit,
    approveTeacherObstacle
  };
}