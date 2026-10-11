const fs = require('fs');
const path = require('path');
const assert = require('assert');

const defaultThunderPath = 'C:/Users/SMKN 1 SMD -WEB TECH/Downloads/thunder-file_19325038.json';
const localCandidates = [
  path.join(__dirname, '..', 'siswa-clean-firebase.json'),
  path.join(__dirname, '..', 'assets', 'data-siswa.json')
];

let thunderData;
if (fs.existsSync(defaultThunderPath)) {
  thunderData = JSON.parse(fs.readFileSync(defaultThunderPath, 'utf8'));
} else {
  const found = localCandidates.find(p => fs.existsSync(p));
  if (found) {
    thunderData = JSON.parse(fs.readFileSync(found, 'utf8'));
  } else {
    throw new Error('File data siswa untuk pengujian thunder-parse tidak ditemukan');
  }
}

function ambilKelasSiswa(s) {
  if (!s || typeof s !== 'object') return '';
  if (s.kelas && typeof s.kelas === 'object') {
    return s.kelas.nama_kelas || s.kelas.nama || s.kelas.name || '';
  }
  return s.kelas || s.Kelas || s.KELAS || s.rombel || s.Rombel || s.kelas_nama || s.kelasNama || '';
}

function normalisasiKelas(k) {
  if (!k) return '';
  let str = String(k).trim().toUpperCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ');
  str = str.replace(/XII\s*TKJ\s*2/gi, 'XII TKJ 1');
  str = str.replace(/(?:XII|12)\s*(RPL|TKJ)\s*([12])/gi, 'XII $1 $2');
  str = str.replace(/\b12\s+/g, 'XII ').replace(/\b12([A-Z])/g, 'XII $1');
  return str;
}

function parseSiswaSnapshot(rawVal) {
  const result = {};
  if (!rawVal) return result;

  // Jika format data dibungkus { status: 'success', data: [...] } dari thunder client / export REST API
  let listData = rawVal;
  if (rawVal && typeof rawVal === 'object' && !Array.isArray(rawVal) && rawVal.data) {
    listData = rawVal.data;
  }

  function processItem(s, fallbackKey) {
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
    nisn = String(nisn);

    const nama = s.nama_lengkap || s.nama || s.Nama || s.name || s.NAMA || (s.user && (s.user.name || s.user.nama)) || ('Siswa ' + nisn);
    const kelas = normalisasiKelas(ambilKelasSiswa(s));
    result[nisn] = { ...s, nisn, nama, kelas, _key: String(fallbackKey) };
  }

  if (Array.isArray(listData)) {
    listData.forEach((s, idx) => processItem(s, idx));
  } else if (typeof listData === 'object') {
    Object.entries(listData).forEach(([k, s]) => {
      if (s && typeof s === 'object') {
        processItem(s, k);
      } else if (typeof s === 'string') {
        result[k] = { nama: s, nisn: k, kelas: 'XII RPL 2', _key: k };
      }
    });
  }

  return result;
}

console.log('Testing thunderData (wrapped):');
const p1 = parseSiswaSnapshot(thunderData);
console.log('Total parsed:', Object.keys(p1).length);
const c1 = {};
Object.values(p1).forEach(s => c1[s.kelas] = (c1[s.kelas] || 0) + 1);
console.log('Class count:', c1);

console.log('\nSample Ihsan:', p1['0098263610']);
console.log('\nSample Rizky:', p1['0082104129']);

assert.ok(Object.keys(p1).length > 0, 'Harus ada data siswa yang berhasil diparsing');
assert.ok(p1['0098263610'], 'Siswa M. Ihsan Athallah (0098263610) harus ditemukan');
assert.strictEqual(p1['0098263610'].kelas, 'XII RPL 2', 'Kelas Ihsan harus XII RPL 2');
assert.ok(p1['0082104129'], 'Siswa Rizky Ramadani (0082104129) harus ditemukan');
assert.strictEqual(p1['0082104129'].kelas, 'XII RPL 2', 'Kelas Rizky harus XII RPL 2');

console.log('\nSEMUA TEST THUNDER PARSE SUKSES 100% ✅');
