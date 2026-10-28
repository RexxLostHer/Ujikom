function getWIBTime(d) {
  if (typeof getJamSekarangWIB === 'function') return getJamSekarangWIB(d);
  const dateObj = d || new Date();
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }).format(dateObj);
  } catch (e) {
    const pad = (n) => String(n).padStart(2, '0');
    return pad(dateObj.getHours()) + ':' + pad(dateObj.getMinutes()) + ':' + pad(dateObj.getSeconds());
  }
}

// Monitoring Presensi RFID — Akses Terbuka (Siswa, Guru & Pengunjung)
const adminUser = localStorage.getItem('admin_aktif') || (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('user_aktif'));

const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', function () {
    try {
      localStorage.removeItem('admin_aktif');
      if (typeof clearSession === 'function') clearSession();
    } catch (e) {}
    window.location.href = 'index.html';
  });
}

// ---- State ----
let siswaCache = (typeof MASTER_DATA_SISWA_RESMI !== 'undefined' && Object.keys(MASTER_DATA_SISWA_RESMI).length > 0)
  ? Object.assign({}, MASTER_DATA_SISWA_RESMI)
  : ((typeof window !== 'undefined' && window.MASTER_DATA_SISWA_RESMI) ? Object.assign({}, window.MASTER_DATA_SISWA_RESMI) : {});
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
  if (typeof card.setAttribute === 'function') card.setAttribute('data-nisn', nisn);

  // Foto / Avatar Inisial
  const photoEl = document.createElement('div');
  photoEl.className = 'siswa-card-photo';
  photoEl.textContent = inisial;
  const fotoSrc = s.foto || ('assets/foto/' + nisn + '.jpg');
  const img = document.createElement('img');
  img.src = fotoSrc;
  img.alt = s.nama || 'Siswa';
  img.style.width = '100%';
  img.style.height = '100%';
  img.style.objectFit = 'cover';
  img.style.objectPosition = 'center top';
  img.onload = function() {
    photoEl.innerHTML = '';
    photoEl.appendChild(img);
  };
  img.onerror = function() {
    photoEl.textContent = inisial;
  };
  card.appendChild(photoEl);

  // Info
  const info = document.createElement('div');
  info.className = 'siswa-card-info';

  const nama = document.createElement('div');
  nama.className = 'siswa-card-nama';
  nama.textContent = s.nama;

  const jamWIB = (typeof getWIBTime === 'function') ? getWIBTime() : ((typeof getJamSekarangWIB === 'function') ? getJamSekarangWIB() : '07:00:00');
  const cleanJamWIB = (jamWIB && jamWIB.length === 5) ? jamWIB + ':00' : (jamWIB || '07:00:00');
  const isLewat08 = cleanJamWIB >= '08:00:00';

  const pill = document.createElement('span');
  if (statusSudah) {
    const entry = detailAbsensi[nisn];
    const stEntry = entry && entry.status ? String(entry.status).toLowerCase().trim() : '';
    if (stEntry.includes('sakit')) {
      pill.className = 'status-pill izin';
      pill.textContent = 'Sakit';
      card.className = 'siswa-card status-sudah status-izin';
    } else if (stEntry.includes('dispen')) {
      pill.className = 'status-pill izin';
      pill.textContent = 'Dispensasi';
      card.className = 'siswa-card status-sudah status-izin';
    } else if (stEntry.includes('izin') || stEntry.includes('ijin')) {
      pill.className = 'status-pill izin';
      pill.textContent = 'Izin';
      card.className = 'siswa-card status-sudah status-izin';
    } else if (stEntry === 'terlambat' || ((entry?.waktu) && entry.waktu > '06:30:00')) {
      pill.className = 'status-pill terlambat';
      pill.textContent = 'Terlambat' + (entry?.waktu ? ' (' + entry.waktu.slice(0, 5) + ')' : '');
    } else if (isDummy) {
      pill.className = 'status-pill sudah';
      pill.textContent = '✓ Hadir (Otomatis)';
    } else {
      pill.className = 'status-pill sudah';
      const waktu = entry?.waktu || '';
      pill.textContent = '✓ Hadir' + (waktu ? ' pukul ' + waktu.slice(0, 5) : '');
    }
  } else {
    if (isLewat08) {
      pill.className = 'status-pill alpa danger';
      pill.textContent = '❌ Alpa';
      if (typeof db !== 'undefined' && db && typeof db.ref === 'function') {
        const todayTgl = (typeof tanggalHariIni === 'function') ? tanggalHariIni() : new Date().toISOString().slice(0, 10);
        db.ref('absensi/' + nisn + '/' + todayTgl).transaction(cur => {
          if (!cur || !cur.status || ['belum', 'belum absen', 'belum_absen'].includes(String(cur.status).toLowerCase())) {
            return { status: 'alpa', metode: 'auto_system', keterangan: 'Otomatis Alpa (Melewati 08:00 WIB)', updated_at: Date.now() };
          }
          return cur;
        }).catch(() => null);
      }
    } else if (cleanJamWIB >= '06:30:00') {
      pill.className = 'status-pill terlambat peringatan';
      pill.textContent = 'Terlambat (Pantauan Walas)';
    } else {
      pill.className = 'status-pill terlambat belum';
      pill.textContent = '⏱ Terlambat';
    }
  }

  info.appendChild(nama);
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
  const normKelas = (typeof normalisasiKelas === 'function') ? normalisasiKelas(kelas) : kelas;
  const defaultPresensi = (typeof generateDefaultPresensiResmi === 'function')
    ? generateDefaultPresensiResmi(normKelas, tanggalHariIni())
    : {};
  detailAbsensi = Object.assign({}, defaultPresensi);
  delete detailAbsensi['0098263610'];
  delete detailAbsensi['0082104129'];
  sudahAbsenSet = new Set(Object.keys(detailAbsensi));

  if (!normKelas) {
    renderRoster();
    return;
  }

  renderRoster();
  const path = 'presensi_jam/' + normKelas + '/' + tanggalHariIni();
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

    const mergedLive = Object.assign({}, defaultPresensi, gabungan);
    if (!gabungan['0098263610']) {
      delete mergedLive['0098263610'];
    }
    if (!gabungan['0082104129']) {
      delete mergedLive['0082104129'];
    }

    sudahAbsenSet = new Set(Object.keys(mergedLive));
    detailAbsensi = mergedLive;
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
  const normKelas = (typeof normalisasiKelas === 'function') ? normalisasiKelas(kelas) : kelas;
  if (!normKelas) return;

  const ref = db.ref('jadwal_pelajaran/' + normKelas);
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
function perbaruiSiswaLive(parsed) {
  if (parsed && Object.keys(parsed).length > 0) {
    siswaCache = Object.assign({}, siswaCache, parsed);
  }

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
}

db.ref('siswa').on('value', function (snapshot) {
  const parsed = (typeof parseSiswaSnapshot === 'function')
    ? parseSiswaSnapshot(snapshot.val())
    : (snapshot.val() || {});
  perbaruiSiswaLive(parsed);

  if (Object.keys(parsed).length < 50) {
    db.ref('data').once('value').then(function(snapData) {
      if (snapData.exists()) {
        perbaruiSiswaLive(parseSiswaSnapshot(snapData.val()));
      }
    }).catch(function() {});

    if (typeof fetch === 'function') {
      fetch('assets/data-siswa.json')
        .then(r => r.json())
        .then(loc => perbaruiSiswaLive(parseSiswaSnapshot(loc)))
        .catch(function() {});
    }
  }
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
