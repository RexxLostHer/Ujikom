// Gate akses: harus login admin dulu
const adminUser = localStorage.getItem('admin_aktif');
if (!adminUser) {
  window.location.href = 'admin-login.html';
}

document.getElementById('logoutBtn').addEventListener('click', function () {
  localStorage.removeItem('admin_aktif');
  window.location.href = 'admin-login.html';
});

// ---- State ----
let siswaCache = {};
let jadwalPelajaranKelas = null;
let jamKeAktifSekarang = null;
let listenerPresensiJam = null;
let sudahAbsenSet = new Set();
let detailAbsensi = {};

const kelasSelect = document.getElementById('kelasSelect');
const infoJam = document.getElementById('infoJam');

// ---- Helper Foto ----
function buatSiswaCard(nisn, s, statusSudah) {
  const inisial = (s.nama || '?').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

  const card = document.createElement('div');
  card.className = 'siswa-card ' + (statusSudah ? 'status-sudah' : 'status-belum');

  // Foto / Avatar Inisial
  const photoEl = document.createElement('div');
  photoEl.className = 'siswa-card-photo';
  const img = document.createElement('img');
  img.src = 'assets/foto/' + nisn + '.jpg';
  img.alt = s.nama;
  photoEl.textContent = inisial;
  img.onload = function() {
    photoEl.textContent = '';
    photoEl.appendChild(img);
  };
  img.onerror = function() { /* biarkan inisial */ };
  photoEl.appendChild(img);
  card.appendChild(photoEl);

  // Info
  const info = document.createElement('div');
  info.className = 'siswa-card-info';

  const nama = document.createElement('div');
  nama.className = 'siswa-card-nama';
  nama.textContent = s.nama;

  const sub = document.createElement('div');
  sub.className = 'siswa-card-sub';
  sub.textContent = 'NISN: ' + nisn;

  const pill = document.createElement('span');
  pill.className = 'status-pill ' + (statusSudah ? 'sudah' : 'belum');
  if (statusSudah) {
    const waktu = detailAbsensi[nisn]?.waktu || '';
    pill.textContent = '✓ Hadir' + (waktu ? ' pukul ' + waktu.slice(0, 5) : '');
  } else {
    pill.textContent = '✗ Belum Scan Kartu';
  }

  info.appendChild(nama);
  info.appendChild(sub);
  info.appendChild(pill);
  card.appendChild(info);

  return card;
}

// ---- Render Roster ----
function renderRoster() {
  const kelas = kelasSelect.value;
  const daftarSiswaKelas = Object.entries(siswaCache)
    .filter(function ([, s]) {
      return (typeof normalisasiKelas === 'function' ? normalisasiKelas(s.kelas) : s.kelas) === (typeof normalisasiKelas === 'function' ? normalisasiKelas(kelas) : kelas);
    })
    .sort(function (a, b) { return (a[1].nama || '').localeCompare(b[1].nama || ''); });

  const sudahEl = document.getElementById('daftarSudah');
  const belumEl = document.getElementById('daftarBelum');
  sudahEl.innerHTML = '';
  belumEl.innerHTML = '';

  let jumlahSudah = 0;
  let jumlahBelum = 0;

  const labelWaktu = jamKeAktifSekarang
    ? 'Jam ke-' + jamKeAktifSekarang.jam_ke
    : 'Rekap Hari Ini';

  daftarSiswaKelas.forEach(function ([nisn, s]) {
    const isSudah = sudahAbsenSet.has(nisn);
    const card = buatSiswaCard(nisn, s, isSudah);
    if (isSudah) {
      sudahEl.appendChild(card);
      jumlahSudah++;
    } else {
      belumEl.appendChild(card);
      jumlahBelum++;
    }
  });

  if (jumlahSudah === 0) {
    sudahEl.innerHTML = '<p class="kosong-msg">Belum ada murid yang scan kartu ' + (jamKeAktifSekarang ? 'jam ini' : 'hari ini') + '.</p>';
  }
  if (jumlahBelum === 0 && daftarSiswaKelas.length > 0) {
    belumEl.innerHTML = '<p style="color:#10b981; font-weight:600; font-size:13px; grid-column:1/-1;">Semua murid sudah hadir! 🎉</p>';
  }

  document.getElementById('jumlahSudah').textContent = jumlahSudah;
  document.getElementById('jumlahBelum').textContent = jumlahBelum;
}

// ---- Render Info Jam ----
function renderInfoJam() {
  if (!jamKeAktifSekarang) {
    infoJam.className = 'jam-aktif-banner kosong';
    infoJam.innerHTML = '<span class="icon">🕒</span><div>Bukan jam pelajaran sekarang (istirahat / di luar jadwal).</div>';
    return;
  }
  infoJam.className = 'jam-aktif-banner';
  infoJam.innerHTML =
    '<span class="icon">🔔</span>' +
    '<div>' +
      '<div>Jam ke-' + jamKeAktifSekarang.jam_ke + ': <b>' + jamKeAktifSekarang.mapel + '</b></div>' +
      '<div class="sub">' + jamKeAktifSekarang.mulai + ' – ' + jamKeAktifSekarang.selesai + '</div>' +
    '</div>';
}

// ---- Listener Presensi Jam ----
function pasangListenerPresensiJam(kelas) {
  if (listenerPresensiJam) {
    listenerPresensiJam.ref.off('value', listenerPresensiJam.callback);
    listenerPresensiJam = null;
  }
  sudahAbsenSet = new Set();
  detailAbsensi = {};

  if (!kelas) {
    renderRoster();
    return;
  }

  if (jamKeAktifSekarang) {
    // Jam aktif → pantau jam ini saja secara real-time
    const path = 'presensi_jam/' + kelas + '/' + tanggalHariIni() + '/' + jamKeAktifSekarang.jam_ke;
    const ref = db.ref(path);
    const callback = function (snapshot) {
      const data = snapshot.val() || {};
      sudahAbsenSet = new Set(Object.keys(data).filter(k => /^\d+$/.test(k)));
      detailAbsensi = data;
      renderRoster();
    };
    ref.on('value', callback);
    listenerPresensiJam = { ref, callback };
  } else {
    // Di luar jam → gabungkan semua jam hari ini (kumulatif)
    const path = 'presensi_jam/' + kelas + '/' + tanggalHariIni();
    const ref = db.ref(path);
    const callback = function (snapshot) {
      const semuaJam = snapshot.val() || {};
      const gabungan = {};
      Object.values(semuaJam).forEach(function(jamData) {
        if (jamData && typeof jamData === 'object') {
          Object.entries(jamData).forEach(function([n, v]) {
            if (/^\d+$/.test(n)) gabungan[n] = v;
          });
        }
      });
      sudahAbsenSet = new Set(Object.keys(gabungan));
      detailAbsensi = gabungan;
      renderRoster();
    };
    ref.on('value', callback);
    listenerPresensiJam = { ref, callback };
  }
}

function cekJamAktifTerkini() {
  const baru = cariJamKeAktif(jadwalPelajaranKelas, jamSekarang());
  const berubah = JSON.stringify(baru) !== JSON.stringify(jamKeAktifSekarang);
  jamKeAktifSekarang = baru;
  renderInfoJam();
  if (berubah) {
    pasangListenerPresensiJam(kelasSelect.value);
  }
}

let listenerJadwalPelajaran = null;

function pindahKelas(kelas) {
  if (listenerJadwalPelajaran) {
    listenerJadwalPelajaran.ref.off('value', listenerJadwalPelajaran.callback);
    listenerJadwalPelajaran = null;
  }
  jadwalPelajaranKelas = null;
  if (!kelas) return;

  const ref = db.ref('jadwal_pelajaran/' + kelas);
  const callback = function (snapshot) {
    jadwalPelajaranKelas = snapshot.val();
    cekJamAktifTerkini();
  };
  ref.on('value', callback);
  listenerJadwalPelajaran = { ref, callback };
}

kelasSelect.addEventListener('change', function () {
  pindahKelas(kelasSelect.value);
});

// Cek pergantian jam tiap 15 detik
setInterval(cekJamAktifTerkini, 15000);

// Load semua siswa & populate dropdown kelas
db.ref('siswa').on('value', function (snapshot) {
  siswaCache = (typeof parseSiswaSnapshot === 'function')
    ? parseSiswaSnapshot(snapshot.val())
    : (snapshot.val() || {});

  const kelasSebelumnya = kelasSelect.value;
  const daftarKelas = (typeof DAFTAR_KELAS_RESMI !== 'undefined') ? DAFTAR_KELAS_RESMI : ['XII RPL 1', 'XII RPL 2', 'XII TKJ 1'];
  kelasSelect.innerHTML = '';

  daftarKelas.forEach(function (kelas) {
    const opt = document.createElement('option');
    opt.value = kelas;
    opt.textContent = 'Kelas ' + kelas;
    kelasSelect.appendChild(opt);
  });

  if (kelasSebelumnya && daftarKelas.includes(kelasSebelumnya)) {
    kelasSelect.value = kelasSebelumnya;
  } else {
    kelasSelect.value = daftarKelas[0] || 'XII RPL 2';
  }

  pindahKelas(kelasSelect.value);
});
