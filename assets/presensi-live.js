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
let kartuNisnSet = new Set();
let kartuDataLoaded = false;

const kelasSelect = document.getElementById('kelasSelect');
const infoJam = document.getElementById('infoJam');

// ---- Helper Foto ----
function buatSiswaCard(nisn, s, statusSudah, isDummy) {
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
    if (isDummy) {
      pill.textContent = '✓ Hadir (Otomatis)';
    } else {
      const waktu = detailAbsensi[nisn]?.waktu || '';
      pill.textContent = '✓ Hadir' + (waktu ? ' pukul ' + waktu.slice(0, 5) : '');
    }
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
    const punyaKartu = kartuDataLoaded ? kartuNisnSet.has(nisn) : true;
    const isSudah = punyaKartu ? sudahAbsenSet.has(nisn) : true;
    const isDummy = !punyaKartu;
    const card = buatSiswaCard(nisn, s, isSudah, isDummy);
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

  // Dengarkan seluruh data presensi jam hari ini secara kumulatif
  const path = 'presensi_jam/' + kelas + '/' + tanggalHariIni();
  const ref = db.ref(path);
  const callback = function (snapshot) {
    const semuaJam = snapshot.val() || {};
    const gabungan = {};

    ['1', '2', '3', '4', '5', '6', '7', '8'].forEach(function(j) {
      const jamData = semuaJam[j];
      if (jamData && typeof jamData === 'object') {
        Object.entries(jamData).forEach(function([n, v]) {
          if (v && typeof v === 'object') {
            gabungan[n] = v;
          }
        });
      }
    });

    Object.entries(semuaJam).forEach(function([k, v]) {
      if (v && typeof v === 'object' && v.status) {
        gabungan[k] = v;
      }
    });

    sudahAbsenSet = new Set(Object.keys(gabungan));
    detailAbsensi = gabungan;
    renderRoster();
  };
  ref.on('value', callback);
  listenerPresensiJam = { ref, callback };
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

db.ref('kartu').on('value', function (snapshot) {
  kartuNisnSet = new Set();
  var data = snapshot.val() || {};
  Object.values(data).forEach(function(v) {
    if (v && typeof v === 'object' && v.nisn) {
      kartuNisnSet.add(String(v.nisn));
    } else if (typeof v === 'string') {
      kartuNisnSet.add(v);
    }
  });
  kartuDataLoaded = true;
  renderRoster();
});
