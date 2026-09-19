// Test logic dashboard.js pakai db & DOM palsu -- nggak butuh koneksi Firebase asli.
// Jalankan: node test-dashboard-logic.js

const vm = require('vm');
const fs = require('fs');
const assert = require('assert');

const src = fs.readFileSync('assets/dashboard.js', 'utf8');
const srcUtil = fs.readFileSync('assets/jadwal-util.js', 'utf8');

function tanggalHariIni() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function tanggalKemarin() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function buatElement() {
  return {
    className: '',
    textContent: '',
    innerHTML: '',
    children: [],
    appendChild(child) { this.children.push(child); },
    addEventListener() {},
    scrollIntoView() {},
  };
}

async function jalankanSkenario(nama, { nisn, siswa, jadwal, absensi }) {
  const elements = {
    namaAnak: buatElement(),
    statusHariIni: buatElement(),
    riwayat: buatElement(),
    logoutBtn: buatElement(),
  };

  const dbPaths = {
    ['siswa/' + nisn]: siswa,
    ['jadwal/' + (siswa && siswa.kelas)]: jadwal,
    ['absensi/' + nisn]: absensi,
  };

  function buatRef(path) {
    return {
      limitToLast() { return this; },
      once() {
        return Promise.resolve({ val: () => dbPaths[path] === undefined ? null : dbPaths[path] });
      },
      on(_event, cb) {
        const val = dbPaths[path];
        cb({ val: () => val === undefined ? null : val });
      },
    };
  }

  const context = {
    document: {
      getElementById: (id) => elements[id],
      createElement: () => buatElement(),
    },
    localStorage: { getItem: () => nisn, removeItem() {}, setItem() {} },
    window: { location: { href: '' } },
    db: { ref: buatRef },
    console,
  };
  vm.createContext(context);
  vm.runInContext(srcUtil, context);
  vm.runInContext(src, context);

  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));

  console.log(`--- ${nama} ---`);
  console.log('statusHariIni:', elements.statusHariIni.className, '|', elements.statusHariIni.innerHTML);
  console.log('riwayat item count:', elements.riwayat.children.length);
  elements.riwayat.children.forEach((c) => console.log('  ', c.className, '|', c.innerHTML));
  console.log();

  return elements;
}

(async () => {
  const hariIni = tanggalHariIni();
  const kemarin = tanggalKemarin();

  // Skenario 1: pulang tepat waktu, hari ini
  let el = await jalankanSkenario('Pulang tepat waktu (hari ini)', {
    nisn: '111',
    siswa: { nama: 'Andi', kelas: '9A' },
    jadwal: '15:30',
    absensi: { a: { tanggal: hariIni, waktu: '15:35:00', status: 'pulang' } },
  });
  assert(!el.statusHariIni.className.includes('peringatan'));
  assert(el.statusHariIni.innerHTML.includes('Pulang</strong>'));

  // Skenario 2: pulang lebih awal, hari ini
  el = await jalankanSkenario('Pulang lebih awal (hari ini)', {
    nisn: '112',
    siswa: { nama: 'Budi', kelas: '9A' },
    jadwal: '15:30',
    absensi: { a: { tanggal: hariIni, waktu: '14:00:00', status: 'pulang' } },
  });
  assert(el.statusHariIni.className.includes('peringatan'));
  assert(el.statusHariIni.innerHTML.includes('Pulang lebih awal'));

  // Skenario 3 (INI YANG TADINYA BUG): satu-satunya entry itu dari KEMARIN, hari ini belum tap sama sekali
  // -> harus muncul "Belum ada data absensi hari ini", BUKAN nampilin data kemarin seolah hari ini
  el = await jalankanSkenario('Cuma ada data kemarin, hari ini kosong', {
    nisn: '113',
    siswa: { nama: 'Citra', kelas: '9A' },
    jadwal: '15:30',
    absensi: { a: { tanggal: kemarin, waktu: '14:00:00', status: 'pulang' } },
  });
  assert(el.statusHariIni.className.includes('belum'), 'FIX GAGAL: data kemarin harusnya nggak dianggap "hari ini"');
  assert(el.statusHariIni.innerHTML.includes('Belum ada data'));
  assert.strictEqual(el.riwayat.children.length, 1);

  // Skenario 4: ada entry kemarin DAN hari ini -> yang ditampilkan di statusHariIni harus yang hari ini
  el = await jalankanSkenario('Ada data kemarin + hari ini, ambil yang hari ini', {
    nisn: '114',
    siswa: { nama: 'Dewi', kelas: '9A' },
    jadwal: '15:30',
    absensi: {
      a: { tanggal: kemarin, waktu: '14:00:00', status: 'pulang' },
      b: { tanggal: hariIni, waktu: '06:45:00', status: 'hadir' },
    },
  });
  assert(el.statusHariIni.innerHTML.includes('Hadir</strong>'), 'harusnya ambil entry hari ini (hadir), bukan entry kemarin');
  assert(el.statusHariIni.innerHTML.includes('06:45:00'));

  // Skenario 5: entry lama tanpa field tanggal sama sekali (data sebelum fix ini ada) -> jangan dianggap hari ini
  el = await jalankanSkenario('Entry lama tanpa field tanggal', {
    nisn: '115',
    siswa: { nama: 'Eka', kelas: '9A' },
    jadwal: '15:30',
    absensi: { a: { waktu: '14:00:00', status: 'pulang' } }, // no tanggal field
  });
  assert(el.statusHariIni.className.includes('belum'), 'entry tanpa tanggal jangan dianggap data hari ini');

  // Skenario 6: belum ada data sama sekali
  el = await jalankanSkenario('Belum ada data sama sekali', {
    nisn: '116',
    siswa: { nama: 'Fajar', kelas: '9A' },
    jadwal: '15:30',
    absensi: null,
  });
  assert(el.statusHariIni.className.includes('belum'));

  // ===== Skenario jadwal pulang PER HARI (bisa beda tiap hari) =====
  // 2024-01-01 = Senin, 2024-01-03 = Rabu (tanggal tetap biar hari-nya pasti)
  const jadwalPerHari = { senin: '14:20', rabu: '10:45' };

  // Skenario 7: pulang Senin jam 12:00, jadwal Senin 14:20 -> lebih awal
  el = await jalankanSkenario('Per-hari: Senin pulang lebih awal', {
    nisn: '117',
    siswa: { nama: 'Gita', kelas: 'XII RPL 2' },
    jadwal: jadwalPerHari,
    absensi: { a: { tanggal: '2024-01-01', waktu: '12:00:00', status: 'pulang' } },
  });
  assert(el.riwayat.children[0].className.includes('peringatan'), 'Senin 12:00 < jadwal Senin 14:20 -> harusnya kena peringatan');

  // Skenario 8: entry SAMA JAMNYA (12:00) tapi di hari RABU, jadwal Rabu cuma 10:45 -> 12:00 udah lewat jadwal, BUKAN lebih awal
  // Ini bukti kalau perbandingannya bener-bener per-hari, bukan pake 1 angka global
  el = await jalankanSkenario('Per-hari: jam sama tapi beda hari -> hasil beda', {
    nisn: '118',
    siswa: { nama: 'Hadi', kelas: 'XII RPL 2' },
    jadwal: jadwalPerHari,
    absensi: { a: { tanggal: '2024-01-03', waktu: '12:00:00', status: 'pulang' } },
  });
  assert(!el.riwayat.children[0].className.includes('peringatan'), 'Rabu 12:00 >= jadwal Rabu 10:45 -> harusnya TIDAK peringatan');

  // Skenario 9: hari yang belum diset jadwalnya di admin -> jangan asal tandain lebih awal
  el = await jalankanSkenario('Per-hari: hari belum ada jadwal -> jangan ditandain', {
    nisn: '119',
    siswa: { nama: 'Ida', kelas: 'XII RPL 2' },
    jadwal: jadwalPerHari, // cuma ada senin & rabu
    absensi: { a: { tanggal: '2024-01-02', waktu: '08:00:00', status: 'pulang' } }, // 2024-01-02 = Selasa
  });
  assert(!el.riwayat.children[0].className.includes('peringatan'), 'Selasa belum diset jadwalnya -> jangan ditandain lebih awal');

  // Skenario 10: format LAMA (jadwal masih string polos, belum per-hari) -- pastiin backward compatible
  el = await jalankanSkenario('Backward compat: format jadwal lama (string)', {
    nisn: '120',
    siswa: { nama: 'Joko', kelas: '9A' },
    jadwal: '15:30', // format lama
    absensi: { a: { tanggal: '2024-01-01', waktu: '14:00:00', status: 'pulang' } },
  });
  assert(el.riwayat.children[0].className.includes('peringatan'), 'format lama (string) masih harus jalan seperti sebelumnya');

  console.log('SEMUA SKENARIO LOLOS \u2705 (termasuk jadwal pulang per-hari & backward compat format lama)');
})().catch((err) => {
  console.error('TEST GAGAL:', err.message);
  process.exit(1);
});
