// Gate akses: pakai login admin yang sama (lihat catatan di README soal ini)
const adminUser = localStorage.getItem('admin_aktif');
if (!adminUser) {
  window.location.href = 'admin-login.html';
}

document.getElementById('logoutBtn').addEventListener('click', function () {
  localStorage.removeItem('admin_aktif');
  window.location.href = 'admin-login.html';
});

// tanggalHariIni(), jamSekarang(), dan cariJamKeAktif() sekarang ada di assets/jadwal-util.js
// (di-load sebelum file ini lewat <script> tag di presensi-live.html)

let siswaCache = {};
let jadwalPelajaranKelas = null;
let jamKeAktifSekarang = null; // { jam_ke, mapel, mulai, selesai } | null
let listenerPresensiJam = null; // { ref, callback }
let sudahAbsenSet = new Set();

const kelasSelect = document.getElementById('kelasSelect');
const infoJam = document.getElementById('infoJam');

function renderInfoJam() {
  if (!jamKeAktifSekarang) {
    infoJam.className = 'info-jam kosong';
    infoJam.textContent = 'Bukan jam pelajaran sekarang (istirahat / di luar jadwal).';
    return;
  }
  infoJam.className = 'info-jam';
  infoJam.textContent = `Jam ke-${jamKeAktifSekarang.jam_ke}: ${jamKeAktifSekarang.mapel} (${jamKeAktifSekarang.mulai}-${jamKeAktifSekarang.selesai})`;
}

function renderRoster() {
  const kelas = kelasSelect.value;
  const daftarSiswaKelas = Object.entries(siswaCache).filter(function ([, s]) { return s.kelas === kelas; });

  const belumEl = document.getElementById('daftarBelum');
  const sudahEl = document.getElementById('daftarSudah');
  belumEl.innerHTML = '';
  sudahEl.innerHTML = '';

  let jumlahSudah = 0;
  let jumlahBelum = 0;

  if (!jamKeAktifSekarang) {
    belumEl.innerHTML = '<p class="kosong-msg">Nggak lagi jam pelajaran, nggak ada yang perlu dicek.</p>';
    sudahEl.innerHTML = '<p class="kosong-msg">-</p>';
    document.getElementById('jumlahSudah').textContent = '0';
    document.getElementById('jumlahBelum').textContent = '0';
    return;
  }

  daftarSiswaKelas.sort(function (a, b) { return a[1].nama.localeCompare(b[1].nama); });

  daftarSiswaKelas.forEach(function ([nisn, s]) {
    const chip = document.createElement('span');
    if (sudahAbsenSet.has(nisn)) {
      chip.className = 'chip-siswa sudah';
      chip.textContent = s.nama;
      sudahEl.appendChild(chip);
      jumlahSudah++;
    } else {
      chip.className = 'chip-siswa belum';
      chip.textContent = s.nama;
      belumEl.appendChild(chip);
      jumlahBelum++;
    }
  });

  if (jumlahBelum === 0) belumEl.innerHTML = '<p class="kosong-msg">Semua udah absen jam ini 🎉</p>';
  if (jumlahSudah === 0) sudahEl.innerHTML = '<p class="kosong-msg">Belum ada yang absen jam ini.</p>';

  document.getElementById('jumlahSudah').textContent = jumlahSudah;
  document.getElementById('jumlahBelum').textContent = jumlahBelum;
}

// Pasang listener realtime ke presensi_jam/{kelas}/{tanggal}/{jam_ke} -- ini path denormalisasi
// yang ditulis Python pas siswa tap kartu, biar halaman ini nggak perlu listen ke tiap siswa satu-satu.
function pasangListenerPresensiJam(kelas) {
  if (listenerPresensiJam) {
    listenerPresensiJam.ref.off('value', listenerPresensiJam.callback);
    listenerPresensiJam = null;
  }
  sudahAbsenSet = new Set();

  if (!kelas || !jamKeAktifSekarang) {
    renderRoster();
    return;
  }

  const path = 'presensi_jam/' + kelas + '/' + tanggalHariIni() + '/' + jamKeAktifSekarang.jam_ke;
  const ref = db.ref(path);
  const callback = function (snapshot) {
    const data = snapshot.val() || {};
    sudahAbsenSet = new Set(Object.keys(data));
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

// cek ulang jam aktif tiap 15 detik -- nangkep pergantian jam pelajaran otomatis tanpa reload
setInterval(cekJamAktifTerkini, 15000);

db.ref('siswa').on('value', function (snapshot) {
  siswaCache = snapshot.val() || {};

  const kelasSebelumnya = kelasSelect.value;
  const kelasSet = new Set(Object.values(siswaCache).map(function (s) { return s.kelas; }));
  kelasSelect.innerHTML = '';
  Array.from(kelasSet).sort().forEach(function (kelas) {
    const opt = document.createElement('option');
    opt.value = kelas;
    opt.textContent = kelas;
    kelasSelect.appendChild(opt);
  });
  if (kelasSet.has(kelasSebelumnya)) kelasSelect.value = kelasSebelumnya;

  if (kelasSelect.value !== kelasSebelumnya) {
    pindahKelas(kelasSelect.value);
  } else {
    renderRoster();
  }
});
