const nisn = localStorage.getItem('nisn_aktif');

if (!nisn) {
  window.location.href = 'index.html';
}

document.getElementById('logoutBtn').addEventListener('click', function () {
  localStorage.removeItem('nisn_aktif');
  window.location.href = 'index.html';
});

// jam pulang resmi kelas anak ini
let jamPulangKelas = null;

// entry.waktu formatnya "HH:MM:SS" atau "HH:MM" -> bandingkan cuma HH:MM-nya
function pulangLebihAwal(entry) {
  if (entry.status !== 'pulang' || !jamPulangKelas) return false;
  return entry.waktu.slice(0, 5) < jamPulangKelas;
}

function labelStatus(entry) {
  if (entry.status === 'hadir') return 'Hadir';
  if (entry.status === 'pulang') {
    return pulangLebihAwal(entry) ? 'Pulang lebih awal' : 'Pulang';
  }
  return entry.status;
}

function mulaiDengarAbsensi() {
  // Ambil data absensi realtime -> otomatis update kalau ada tap kartu baru
  // Struktur data: absensi/{nisn atau id_kartu}/{waktu, status}
  db.ref('absensi/' + nisn).limitToLast(1).on('value', function (snapshot) {
    const statusEl = document.getElementById('statusHariIni');
    const data = snapshot.val();

    if (!data) {
      statusEl.className = 'status-card belum';
      statusEl.innerHTML = '<p>Belum ada data absensi hari ini.</p>';
      return;
    }

    const entry = Object.values(data)[0];
    statusEl.className = 'status-card' + (pulangLebihAwal(entry) ? ' peringatan' : '');
    statusEl.innerHTML = `<p><strong>${labelStatus(entry)}</strong> pada ${entry.waktu}</p>`;
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
      item.innerHTML = `<span>${entry.waktu}</span><span>${labelStatus(entry)}</span>`;
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
  if (snapshot) jamPulangKelas = snapshot.val(); // format "HH:MM", null kalau belum diset admin
  mulaiDengarAbsensi();
});
