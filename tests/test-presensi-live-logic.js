// Test logic presensi-live.js pakai DOM & db palsu -- nggak butuh koneksi Firebase asli.
// Jalankan: node tests/test-presensi-live-logic.js

const vm = require('vm');
const fs = require('fs');
const assert = require('assert');

const src = fs.readFileSync('assets/presensi-live.js', 'utf8');

function buatElement() {
  return {
    className: '', textContent: '', innerHTML: '', value: '',
    children: [],
    appendChild(child) { this.children.push(child); },
    addEventListener() {},
  };
}

function buatContext() {
  const elements = {
    logoutBtn: buatElement(),
    kelasSelect: buatElement(),
    infoJam: buatElement(),
    jumlahSudah: buatElement(),
    jumlahBelum: buatElement(),
    daftarBelum: buatElement(),
    daftarSudah: buatElement(),
  };
  const context = {
    document: {
      getElementById: (id) => elements[id],
      createElement: () => buatElement(),
    },
    localStorage: { getItem: () => 'admin_test', removeItem() {}, setItem() {} },
    window: { location: { href: '' } },
    db: { ref: () => ({ on() {}, off() {} }) }, // nggak dipakai buat test fungsi murni ini
    setInterval: () => {}, // biar nggak beneran jalan timer pas di-load
    console,
  };
  vm.createContext(context);
  vm.runInContext(src, context);
  return context;
}

// objek hasil dari dalam vm context beda "realm" sama objek di file test ini,
// jadi assert.deepStrictEqual nolak walau isinya sama persis -> bandingin lewat JSON string aja
function sama(actual, expected, pesan) {
  assert.strictEqual(JSON.stringify(actual), JSON.stringify(expected), pesan);
}

const jadwalContoh = {
  '1': { mapel: 'Matematika', mulai: '07:00', selesai: '07:45' },
  '2': { mapel: 'B. Indonesia', mulai: '07:45', selesai: '08:30' },
  '3': { mapel: 'IPA', mulai: '09:00', selesai: '09:45' }, // ada jeda istirahat 08:30-09:00
};

const ctx = buatContext();
const cariJamKeAktif = ctx.cariJamKeAktif;

// Skenario 1: waktu di tengah jam ke-1
sama(
  cariJamKeAktif(jadwalContoh, '07:20'),
  { jam_ke: '1', mapel: 'Matematika', mulai: '07:00', selesai: '07:45' },
  'harusnya jam ke-1'
);

// Skenario 2: tepat di jam mulai -> harus MASUK jam itu (inklusif di awal)
sama(
  cariJamKeAktif(jadwalContoh, '07:45'),
  { jam_ke: '2', mapel: 'B. Indonesia', mulai: '07:45', selesai: '08:30' },
  'tepat jam mulai harusnya inklusif, masuk jam ke-2'
);

// Skenario 3: tepat di jam selesai -> harus SUDAH KELUAR jam itu (eksklusif di akhir), masuk ke jeda
sama(cariJamKeAktif(jadwalContoh, '08:30'), null, 'jam selesai harusnya eksklusif');

// Skenario 4: waktu di jeda istirahat (antara jam ke-2 selesai dan jam ke-3 mulai)
sama(cariJamKeAktif(jadwalContoh, '08:45'), null, 'harusnya null pas jeda istirahat');

// Skenario 5: sebelum jam sekolah mulai
sama(cariJamKeAktif(jadwalContoh, '06:00'), null, 'harusnya null sebelum sekolah mulai');

// Skenario 6: setelah semua jam pelajaran selesai
sama(cariJamKeAktif(jadwalContoh, '15:00'), null, 'harusnya null setelah semua jam selesai');

// Skenario 7: kelas belum punya jadwal pelajaran sama sekali
sama(cariJamKeAktif(null, '07:20'), null, 'jadwal null harusnya null');
sama(cariJamKeAktif({}, '07:20'), null, 'jadwal kosong harusnya null');

console.log('SEMUA SKENARIO cariJamKeAktif LOLOS \u2705');
