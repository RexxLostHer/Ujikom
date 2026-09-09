const nisn = localStorage.getItem('nisn_aktif');

if (!nisn) {
  window.location.href = 'index.html';
}

document.getElementById('logoutBtn').addEventListener('click', function () {
  localStorage.removeItem('nisn_aktif');
  window.location.href = 'index.html';
});

// Ambil data siswa (nama, kelas, dll)
db.ref('siswa/' + nisn).once('value').then(function (snapshot) {
  const data = snapshot.val();
  document.getElementById('namaAnak').textContent = data ? data.nama : 'Siswa';
});

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
  statusEl.className = 'status-card';
  statusEl.innerHTML = `<p><strong>${entry.status === 'hadir' ? 'Hadir' : entry.status}</strong> pada ${entry.waktu}</p>`;
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
    item.className = 'riwayat-item';
    item.innerHTML = `<span>${entry.waktu}</span><span>${entry.status}</span>`;
    riwayatEl.appendChild(item);
  });
});
