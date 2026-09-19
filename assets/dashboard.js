const nisn = localStorage.getItem('nisn_aktif');

if (!nisn) {
  window.location.href = 'index.html';
}

document.getElementById('logoutBtn').addEventListener('click', function () {
  localStorage.removeItem('nisn_aktif');
  window.location.href = 'index.html';
});

// jam pulang resmi kelas ini. Bisa 2 format:
// - string "HH:MM" (format lama, sama buat semua hari)
// - object { senin: "HH:MM", selasa: "HH:MM", ... } (format baru, per hari -- karena jam pulang bisa beda tiap hari)
let jadwalPulangKelas = null;

// entry.waktu formatnya "HH:MM:SS" atau "HH:MM" -> bandingkan cuma HH:MM-nya
function pulangLebihAwal(entry) {
  if (entry.status !== 'pulang' || !jadwalPulangKelas || !entry.tanggal) return false;

  const jamPulangHariItu = typeof jadwalPulangKelas === 'string'
    ? jadwalPulangKelas
    : jadwalPulangKelas[namaHariDariTanggal(entry.tanggal)];

  if (!jamPulangHariItu) return false; // hari itu belum diset jadwalnya -> jangan asal tandain
  return entry.waktu.slice(0, 5) < jamPulangHariItu;
}

function labelStatus(entry) {
  if (entry.status === 'hadir') return 'Hadir';
  if (entry.status === 'pulang') {
    return pulangLebihAwal(entry) ? 'Pulang lebih awal' : 'Pulang';
  }
  return entry.status;
}

function tanggalHariIni() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Entry lama (sebelum ada field tanggal) nggak punya properti ini -> anggap "tanggal tidak diketahui",
// jangan dianggap sebagai hari ini biar nggak salah nampilin data basi sebagai status hari ini.
function entryDariHariIni(entry) {
  return entry.tanggal === tanggalHariIni();
}

function mulaiDengarAbsensi() {
  // Ambil data absensi realtime -> otomatis update kalau ada tap kartu baru
  // Struktur data: absensi/{nisn}/{push_id}: {tanggal, waktu, status}
  db.ref('absensi/' + nisn).limitToLast(10).on('value', function (snapshot) {
    const statusEl = document.getElementById('statusHariIni');
    const data = snapshot.val();
    const entries = data ? Object.values(data) : [];

    // cari entry TERBARU yang tanggalnya hari ini -- bukan cuma entry terakhir apapun tanggalnya
    const entryHariIni = entries.filter(entryDariHariIni).pop();

    if (!entryHariIni) {
      statusEl.className = 'status-card belum';
      statusEl.innerHTML = '<p>Belum ada data absensi hari ini.</p>';
      return;
    }

    statusEl.className = 'status-card' + (pulangLebihAwal(entryHariIni) ? ' peringatan' : '');
    statusEl.innerHTML = `<p><strong>${labelStatus(entryHariIni)}</strong> pada ${entryHariIni.waktu}</p>`;
  });

  // Ambil riwayat lengkap (30 terakhir)
  db.ref('absensi/' + nisn).limitToLast(30).on('value', function (snapshot) {
    const riwayatEl = document.getElementById('riwayat');
    const data = snapshot.val();
    riwayatEl.innerHTML = '';

    if (!data) {
      riwayatEl.innerHTML = '<p style="color:#999; font-size:14px;">Belum ada riwayat.</p>';
      return;
    }

    const entries = Object.values(data).reverse();
    entries.forEach(function (entry) {
      const item = document.createElement('div');
      item.className = 'riwayat-item' + (pulangLebihAwal(entry) ? ' peringatan' : '');
      const tanggalLabel = entry.tanggal ? entry.tanggal + ' ' : '';
      item.innerHTML = `<span>${tanggalLabel}${entry.waktu}</span><span>${labelStatus(entry)}</span>`;
      riwayatEl.appendChild(item);
    });
  });
}

// Ambil data siswa (nama, kelas, dll), lalu jadwal pulang kelasnya,
// baru mulai dengarkan absensi -- supaya render pertama sudah tau jam pulang kelas
db.ref('siswa/' + nisn).once('value').then(function (snapshot) {
  const data = snapshot.val();
  document.getElementById('namaAnak').textContent = data ? data.nama : 'Siswa';

  if (data && data.kelas) {
    return db.ref('jadwal/' + data.kelas).once('value');
  }
}).then(function (snapshot) {
  if (snapshot) jadwalPulangKelas = snapshot.val();
  mulaiDengarAbsensi();
});
