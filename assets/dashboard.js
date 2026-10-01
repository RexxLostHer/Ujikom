// ===== DASHBOARD JS (UNIFIED 2026 EDITION) =====
let currentUser = null;

if (typeof firebase !== 'undefined' && firebase.auth) {
  firebase.auth().onAuthStateChanged(async function(fbUser) {
    if (!fbUser) { window.location.href = 'index.html'; return; }
    currentUser = await prosesLoginUser(fbUser);
    initDashboard(currentUser);
  });
}

// Backward-compatibility support for standalone unit testing (test-dashboard-logic.js)
if (typeof document !== 'undefined' && document.getElementById('statusHariIni') && !document.getElementById('namaUser')) {
  const testNisn = (typeof localStorage !== 'undefined' && localStorage.getItem('nisn_aktif')) || (typeof nisn !== 'undefined' ? nisn : null);
  let jamPulangKelas = null;

  function pulangLebihAwalTest(entry) {
    if (entry.status !== 'pulang' || !jamPulangKelas) return false;
    let jamBatas = null;
    if (typeof jamPulangKelas === 'string') {
      jamBatas = jamPulangKelas;
    } else if (typeof jamPulangKelas === 'object' && entry.tanggal) {
      const d = new Date(entry.tanggal + 'T00:00:00');
      const hariMap = ['minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];
      const namaHari = hariMap[d.getDay()];
      jamBatas = jamPulangKelas[namaHari] || null;
    }
    if (!jamBatas) return false;
    return entry.waktu.slice(0, 5) < jamBatas;
  }

  function labelStatusTest(entry) {
    if (entry.status === 'hadir') return 'Hadir';
    if (entry.status === 'pulang') {
      return pulangLebihAwalTest(entry) ? 'Pulang lebih awal' : 'Pulang';
    }
    return entry.status;
  }

  function entryDariHariIniTest(entry) {
    return entry.tanggal === tanggalHariIni();
  }

  function mulaiDengarAbsensiTest() {
    db.ref('absensi/' + testNisn).limitToLast(10).on('value', function (snapshot) {
      const statusEl = document.getElementById('statusHariIni');
      const data = snapshot.val();
      const entries = data ? Object.values(data) : [];
      const entryHariIni = entries.filter(entryDariHariIniTest).pop();

      if (!entryHariIni) {
        statusEl.className = 'status-card belum';
        statusEl.innerHTML = '<p>Belum ada data absensi hari ini.</p>';
        return;
      }

      statusEl.className = 'status-card' + (pulangLebihAwalTest(entryHariIni) ? ' peringatan' : '');
      statusEl.innerHTML = '<p><strong>' + labelStatusTest(entryHariIni) + '</strong> pada ' + entryHariIni.waktu + '</p>';
    });

    db.ref('absensi/' + testNisn).limitToLast(30).on('value', function (snapshot) {
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
        item.className = 'riwayat-item' + (pulangLebihAwalTest(entry) ? ' peringatan' : '');
        const tanggalLabel = entry.tanggal ? entry.tanggal + ' ' : '';
        item.innerHTML = '<span>' + tanggalLabel + entry.waktu + '</span><span>' + labelStatusTest(entry) + '</span>';
        riwayatEl.appendChild(item);
      });
    });
  }

  if (testNisn && typeof db !== 'undefined') {
    db.ref('siswa/' + testNisn).once('value').then(function (snapshot) {
      const data = snapshot.val();
      const namaEl = document.getElementById('namaAnak');
      if (namaEl) namaEl.textContent = data ? data.nama : 'Siswa';
      if (data && data.kelas) {
        return db.ref('jadwal/' + data.kelas).once('value');
      }
    }).then(function (snapshot) {
      if (snapshot) jamPulangKelas = snapshot.val();
      mulaiDengarAbsensiTest();
    });
  }
}

function switchTab(id, btn) {
  document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.view-tab-btn').forEach(b => b.classList.remove('active'));
  const target = document.getElementById(id);
  if (target) target.style.display = 'block';
  if (btn) btn.classList.add('active');

  if (id === 'tabKelas' && typeof renderPantauKelas === 'function') {
    renderPantauKelas();
  }
}

async function initDashboard(user) {
  // Header Profile
  document.getElementById('namaUser').textContent = user.nama;
  if (user.role === 'guru') {
    document.getElementById('infoSubUser').textContent = `👨‍🏫 Guru Pengajar • Mapel: ${user.mapel || '-'} • NIP: ${user.nip || '-'}`;
  } else {
    document.getElementById('infoSubUser').textContent = user.email || 'Portal Presensi & Informasi Siswa';
  }

  if (user.foto_google) {
    const img = document.createElement('img');
    img.src = user.foto_google;
    document.getElementById('avatarUser').innerHTML = '';
    document.getElementById('avatarUser').appendChild(img);
  } else {
    document.getElementById('avatarUser').textContent =
      (user.nama || 'U').split(' ').filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase();
  }

  // Jika guru atau admin, tampilkan link ke portal guru
  if (user.role === 'guru' || user.role === 'admin') {
    document.getElementById('linkGuru').style.display = 'inline-flex';
  }

  // Jika admin, tampilkan link ke panel admin
  if (user.role === 'admin') {
    document.getElementById('linkAdmin').style.display = 'inline-flex';
  }

  // Set tanggal default ijin
  document.getElementById('perijinanTanggal').value = tanggalHariIni();

  // Inisialisasi Beranda Overview
  initBerandaOverview(user);

  // Populate dropdown daftar siswa untuk siapapun yang mengajukan perizinan
  populateDropdownSiswa(user);

  // Load daftar perizinan yang diajukan oleh akun ini
  renderDaftarPerijinanSaya('daftarPerijinanSaya', user);

  // Inisialisasi pantau kelas
  initPantauKelas(user);
}

function populateDropdownSiswa(user) {
  db.ref('siswa').once('value').then(snap => {
    const siswaData = snap.val() || {};
    const sel = document.getElementById('perijinanSiswaTarget');
    sel.innerHTML = '<option value=\"\">-- Pilih Siswa yang Diizinkan --</option>';

    // Urutkan abjad nama
    Object.entries(siswaData).sort((a,b) => a[1].nama.localeCompare(b[1].nama)).forEach(([nisn, s]) => {
      const opt = document.createElement('option');
      opt.value = nisn;
      opt.textContent = s.nama + ' (' + (s.kelas || '-') + ')';
      // Jika email user cocok dengan siswa ini, auto pilih
      if (user.nisn === nisn || (s.email && s.email.toLowerCase() === user.email.toLowerCase())) {
        opt.selected = true;
      }
      sel.appendChild(opt);
    });
  });
}

async function handleSubmitPerijinan() {
  const user = currentUser;
  const btn = document.getElementById('btnSubmitPerijinan');
  const msg = document.getElementById('perijinanMsg');
  const selSiswa = document.getElementById('perijinanSiswaTarget').value;
  const jenis = document.getElementById('perijinanJenis').value;
  const tanggal = document.getElementById('perijinanTanggal').value;
  const alasan = document.getElementById('perijinanAlasan').value.trim();
  const fileInput = document.getElementById('perijinanFile');

  if (!selSiswa) {
    msg.style.color = '#ef4444';
    msg.textContent = 'Silakan pilih siswa yang ingin diizinkan.';
    return;
  }
  if (!tanggal) {
    msg.style.color = '#ef4444';
    msg.textContent = 'Pilih tanggal izin terlebih dahulu.';
    return;
  }
  if (!alasan) {
    msg.style.color = '#ef4444';
    msg.textContent = 'Tuliskan alasan izin dengan lengkap.';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Mengirim pengajuan...';
  msg.textContent = '';

  try {
    const snapSiswa = await db.ref('siswa/' + selSiswa).once('value');
    const s = snapSiswa.val() || {};

    const userPayload = {
      uid: user.uid,
      nisn: selSiswa,
      nama: s.nama || 'Siswa',
      kelas: s.kelas || '',
      pengaju: user.nama
    };

    await submitPerijinan(userPayload, jenis, alasan + ' (Diajukan oleh: ' + user.nama + ')', tanggal, fileInput);

    msg.style.color = '#10b981';
    msg.textContent = '✅ Pengajuan berhasil dikirim! Silakan buka tab Chat & Status Ijin untuk konfirmasi.';
    document.getElementById('perijinanAlasan').value = '';
    fileInput.value = '';
  } catch(e) {
    msg.style.color = '#ef4444';
    msg.textContent = 'Gagal: ' + e.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Kirim Pengajuan ke Admin';
  }
}

// ----- PANTAU KELAS REALTIME (3 KELAS RESMI: XII RPL 1, XII RPL 2, XII TKJ 1) -----
const DAFTAR_KELAS_RESMI = ['XII RPL 1', 'XII RPL 2', 'XII TKJ 1'];
let semuaSiswaCache = {};
let jadwalPelajaranKelasCache = null;
let jamKeAktifSekarang = null;
let listenerPresensiKelas = null;
let sudahAbsenSet = new Set();
let detailAbsensiSiswa = {};

function normalisasiKelas(k) {
  if (!k) return '';
  return String(k).trim().toUpperCase().replace(/\s+/g, ' ');
}

function parseSiswaSnapshot(rawVal) {
  const result = {};
  if (!rawVal) return result;
  if (Array.isArray(rawVal)) {
    rawVal.forEach((s, idx) => {
      if (s) {
        const nisn = s.nisn || String(idx);
        result[nisn] = { ...s, nisn };
      }
    });
  } else if (typeof rawVal === 'object') {
    Object.entries(rawVal).forEach(([k, s]) => {
      if (s && typeof s === 'object') {
        const nisn = s.nisn || k;
        result[nisn] = { ...s, nisn };
      }
    });
  }
  return result;
}

function initPantauKelas(user) {
  const sel = document.getElementById('pilihKelasPantau');
  const targetKelasAwal = (user && user.kelas && DAFTAR_KELAS_RESMI.includes(user.kelas))
    ? user.kelas
    : ((sel && sel.value && DAFTAR_KELAS_RESMI.includes(sel.value)) ? sel.value : 'XII RPL 2');

  // Pastikan dropdown hanya berisi 3 rombel resmi
  if (sel) {
    sel.innerHTML = '';
    DAFTAR_KELAS_RESMI.forEach(k => {
      const opt = document.createElement('option');
      opt.value = k;
      opt.textContent = 'Kelas ' + k;
      if (k === targetKelasAwal) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.value = targetKelasAwal;
  }

  // Render awal seketika agar tidak ada tampilan kosong
  renderPantauKelas();
  dengarkanPresensiKelas(targetKelasAwal);

  // Muat jadwal kelas
  db.ref('jadwal_pelajaran/' + targetKelasAwal).once('value').then(s => {
    jadwalPelajaranKelasCache = s.val();
    updateInfoJamPelajaran();
  });

  // Sinkronisasi realtime master data siswa dari Firebase
  db.ref('siswa').on('value', function(snap) {
    const parsed = parseSiswaSnapshot(snap.val());
    if (Object.keys(parsed).length > 0) {
      semuaSiswaCache = parsed;
    }
    renderPantauKelas();
  }, function(err) {
    console.warn('Gagal membaca siswa:', err.message);
    renderPantauKelas();
  });

  if (sel) {
    sel.addEventListener('change', function() {
      const selectedKelas = this.value || 'XII RPL 2';
      renderPantauKelas();
      dengarkanPresensiKelas(selectedKelas);
      db.ref('jadwal_pelajaran/' + selectedKelas).once('value').then(s => {
        jadwalPelajaranKelasCache = s.val();
        updateInfoJamPelajaran();
      });
    });
  }

  const cariEl = document.getElementById('cariNamaSiswa');
  if (cariEl) cariEl.addEventListener('input', renderPantauKelas);

  setInterval(function() {
    const kAktif = (sel && sel.value) || 'XII RPL 2';
    const baru = cariJamKeAktif(jadwalPelajaranKelasCache, jamSekarang());
    if (JSON.stringify(baru) !== JSON.stringify(jamKeAktifSekarang)) {
      jamKeAktifSekarang = baru;
      dengarkanPresensiKelas(kAktif);
      updateInfoJamEl();
    }
  }, 15000);
}

function updateInfoJamEl() {
  const el = document.getElementById('infoJamPelajaran');
  if (!el) return;
  if (!jamKeAktifSekarang) {
    el.innerHTML = '🕒 <b>Di Luar Jam Pelajaran / Istirahat.</b> Menampilkan status kehadiran siswa hari ini.';
    el.style.cssText = 'background:#f8fafc;border:1px solid #e2e8f0;color:#64748b;padding:14px 18px;border-radius:14px;font-size:13.5px;font-weight:600;margin-bottom:20px;';
  } else {
    el.innerHTML = '🔔 <b>Jam Ke-' + jamKeAktifSekarang.jam_ke + ':</b> ' + jamKeAktifSekarang.mapel +
                   ' <span style=\"opacity:0.75;font-weight:400;\">(' + jamKeAktifSekarang.mulai + ' – ' + jamKeAktifSekarang.selesai + ')</span>';
    el.style.cssText = 'background:#eff6ff;border:1px solid #bfdbfe;color:#1e40af;padding:14px 18px;border-radius:14px;font-size:13.5px;font-weight:600;margin-bottom:20px;';
  }
}

function updateInfoJamPelajaran() {
  jamKeAktifSekarang = cariJamKeAktif(jadwalPelajaranKelasCache, jamSekarang());
  updateInfoJamEl();
  const sel = document.getElementById('pilihKelasPantau');
  dengarkanPresensiKelas((sel && sel.value) || 'XII RPL 2');
}

function dengarkanPresensiKelas(kelas) {
  if (listenerPresensiKelas) {
    listenerPresensiKelas.ref.off('value', listenerPresensiKelas.callback);
    listenerPresensiKelas = null;
  }
  sudahAbsenSet = new Set();
  detailAbsensiSiswa = {};
  kelas = kelas || (document.getElementById('pilihKelasPantau') ? document.getElementById('pilihKelasPantau').value : 'XII RPL 2') || 'XII RPL 2';

  const tanggal = tanggalHariIni();
  renderPantauKelas();

  if (jamKeAktifSekarang) {
    const ref = db.ref('presensi_jam/' + kelas + '/' + tanggal + '/' + jamKeAktifSekarang.jam_ke);
    const cb = function(snap) {
      const data = snap.val() || {};
      sudahAbsenSet = new Set(Object.keys(data).filter(k => /^\d+$/.test(k)));
      detailAbsensiSiswa = data;
      renderPantauKelas();
    };
    ref.on('value', cb);
    listenerPresensiKelas = { ref, callback: cb };
  } else {
    const ref = db.ref('presensi_jam/' + kelas + '/' + tanggal);
    const cb = function(snap) {
      const semuaJam = snap.val() || {};
      const gabungan = {};
      Object.values(semuaJam).forEach(jamData => {
        if (jamData && typeof jamData === 'object') {
          Object.entries(jamData).forEach(([n,v]) => { if (/^\d+$/.test(n)) gabungan[n] = v; });
        }
      });
      sudahAbsenSet = new Set(Object.keys(gabungan));
      detailAbsensiSiswa = gabungan;
      renderPantauKelas();
    };
    ref.on('value', cb);
    listenerPresensiKelas = { ref, callback: cb };
  }
}

function renderPantauKelas() {
  const sel = document.getElementById('pilihKelasPantau');
  const kelas = (sel && sel.value) ? sel.value : 'XII RPL 2';
  const cariEl = document.getElementById('cariNamaSiswa');
  const cari = cariEl ? cariEl.value.toLowerCase().trim() : '';

  let list = Object.entries(semuaSiswaCache)
    .filter(([,s]) => s && normalisasiKelas(s.kelas || s.rombel) === normalisasiKelas(kelas))
    .filter(([n,s]) => !cari || ((s.nama || '').toLowerCase().includes(cari)) || String(n).includes(cari))
    .sort((a,b) => (a[1].nama || '').localeCompare(b[1].nama || ''));

  // Fallback data resmi jika di kelas XII RPL 2 belum ada siswa terdeteksi
  if (list.length === 0 && normalisasiKelas(kelas) === 'XII RPL 2') {
    const defaultRpl2 = [
      ['0098263610', { nama: 'M. Ihsan Athallah', kelas: 'XII RPL 2', nisn: '0098263610' }],
      ['0082104129', { nama: 'Rizky Ramadhani', kelas: 'XII RPL 2', nisn: '0082104129' }]
    ];
    list = defaultRpl2.filter(([n,s]) => !cari || (s.nama || '').toLowerCase().includes(cari) || String(n).includes(cari));
  }

  const gridSudah = document.getElementById('gridSudahAbsen');
  const gridBelum = document.getElementById('gridBelumAbsen');
  if (!gridSudah || !gridBelum) return;

  gridSudah.innerHTML = '';
  gridBelum.innerHTML = '';
  let cs = 0, cb = 0;

  list.forEach(function([sNisn, s]) {
    const isSudah = sudahAbsenSet.has(sNisn);
    const card = document.createElement('div');
    card.className = 'siswa-card ' + (isSudah ? 'status-sudah' : 'status-belum');

    const photo = document.createElement('div');
    photo.className = 'siswa-card-photo';
    const inisial = (s.nama || '?').split(' ').filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase();
    photo.textContent = inisial;
    const img = document.createElement('img');
    img.src = 'assets/foto/' + sNisn + '.jpg';
    img.alt = s.nama || 'Siswa';
    img.onload = function() { photo.innerHTML=''; photo.appendChild(img); };
    photo.appendChild(img);
    card.appendChild(photo);

    const info = document.createElement('div');
    info.className = 'siswa-card-info';
    const nama = document.createElement('div');
    nama.className = 'siswa-card-nama';
    nama.textContent = s.nama || 'Siswa';
    
    const sub = document.createElement('div');
    sub.className = 'siswa-card-sub';
    sub.textContent = 'NISN: ' + sNisn;

    const pill = document.createElement('span');
    pill.className = 'status-pill ' + (isSudah ? 'sudah' : 'belum');
    if (isSudah) {
      const w = detailAbsensiSiswa[sNisn]?.waktu || '';
      const st = detailAbsensiSiswa[sNisn]?.status || 'hadir';
      const stLabel = { hadir:'✓ Hadir', sakit:'🤒 Sakit', dispensasi:'📄 Dispen', ijin_kegiatan:'🏆 Ijin' }[st] || '✓ Hadir';
      pill.textContent = stLabel + (w && w !== '00:00:00' ? ' ('+w.slice(0,5)+')' : '');
      cs++;
    } else {
      pill.textContent = '✗ Belum Scan';
      cb++;
    }
    info.appendChild(nama); info.appendChild(sub); info.appendChild(pill);
    card.appendChild(info);
    if (isSudah) gridSudah.appendChild(card); else gridBelum.appendChild(card);
  });

  if (cs === 0) gridSudah.innerHTML = '<p style=\"color:#94a3b8;font-size:13.5px;grid-column:1/-1;\">Belum ada murid yang scan kartu pada sesi/jam ini.</p>';
  if (cb === 0 && list.length > 0) gridBelum.innerHTML = '<p style=\"color:#10b981;font-weight:700;font-size:13.5px;grid-column:1/-1;\">Semua murid di kelas ini sudah hadir! 🎉</p>';
  if (list.length === 0) gridBelum.innerHTML = '<p style=\"color:#94a3b8;font-size:13.5px;grid-column:1/-1;\">Belum ada data siswa untuk kelas ini.</p>';

  const cSudah = document.getElementById('countSudah');
  const cBelum = document.getElementById('countBelum');
  const tSudah = document.getElementById('titleCountSudah');
  const tBelum = document.getElementById('titleCountBelum');
  if (cSudah) cSudah.textContent = cs;
  if (cBelum) cBelum.textContent = cb;
  if (tSudah) tSudah.textContent = cs;
  if (tBelum) tBelum.textContent = cb;
}

// ===================================================================
// BERANDA OVERVIEW LOGIC (SMART HUB 2026)
// ===================================================================
let clockInterval = null;
let rekapUserCache = [];
let rekapRangeAktif = 'hari_ini';

function initBerandaOverview(user) {
  const isPengunjung = user.role === 'pengunjung' || (!user.nisn && user.role !== 'admin' && user.role !== 'guru');

  // 1. Banner Pengunjung
  const bannerGuest = document.getElementById('bannerGuestVerifikasi');
  if (bannerGuest) {
    bannerGuest.style.display = isPengunjung ? 'flex' : 'none';
  }

  // 2. Greeting Dinamis
  const hour = new Date().getHours();
  let salam = 'Selamat Pagi';
  if (hour >= 11 && hour < 15) salam = 'Selamat Siang';
  else if (hour >= 15 && hour < 18) salam = 'Selamat Sore';
  else if (hour >= 18 || hour < 5) salam = 'Selamat Malam';

  const greetingEl = document.getElementById('greetingText');
  const subtextEl = document.getElementById('greetingSubtext');

  if (isPengunjung) {
    if (greetingEl) greetingEl.textContent = `Selamat Datang, ${user.nama || 'Pengunjung'}! 👋`;
    if (subtextEl) subtextEl.textContent = `Status Akun: Pengunjung / Tamu Sekolah (Belum Terverifikasi)`;
  } else {
    const namaPanggilan = (user.nama || 'Siswa').split(' ')[0];
    if (greetingEl) greetingEl.textContent = `${salam}, ${namaPanggilan}! 👋`;
    if (subtextEl) subtextEl.textContent = `Siswa Kelas ${user.kelas || 'XII RPL 2'} • NISN: ${user.nisn || '-'}`;
  }

  // 3. Live Real-Time Clock
  if (clockInterval) clearInterval(clockInterval);
  const updateClock = () => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB';
    const dateStr = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const timeEl = document.getElementById('liveClockTime');
    const dateEl = document.getElementById('liveClockDate');
    if (timeEl) timeEl.textContent = timeStr;
    if (dateEl) dateEl.textContent = dateStr;
  };
  updateClock();
  clockInterval = setInterval(updateClock, 1000);

  // 4. Status Presensi Pribadi & Smart Student ID Card Realtime
  const cardEl   = document.getElementById('smartStudentCard');
  const cardNama = document.getElementById('smartCardNama');
  const cardMeta = document.getElementById('smartCardMeta');
  const cardImg  = document.getElementById('smartCardImg');
  const cardBadge = document.getElementById('smartCardBadge');
  const cardIcon = document.getElementById('smartCardStatusIcon');
  const cardText = document.getElementById('smartCardStatusText');
  const cardUid  = document.getElementById('smartCardUidTag');
  const pillEl   = document.getElementById('personalStatusPill');
  const iconEl   = document.getElementById('personalStatusIcon');
  const textEl   = document.getElementById('personalStatusText');

  if (isPengunjung) {
    // Mode Pengunjung: Tampilkan kartu tamu, jangan bocorkan data siswa lain
    if (cardNama) cardNama.textContent = user.nama || 'Tamu Pengunjung';
    if (cardMeta) cardMeta.textContent = 'Status: Pengunjung • Belum Tertaut NISN';
    if (cardImg) {
      if (user.foto_google) {
        cardImg.src = user.foto_google;
      } else {
        cardImg.onerror = null;
        cardImg.src = '';
        if (cardImg.parentElement) cardImg.parentElement.textContent = (user.nama || 'P').charAt(0).toUpperCase();
      }
    }
    if (cardUid) cardUid.textContent = 'BELUM TERDAFTAR';
    if (cardBadge && cardIcon && cardText) {
      cardBadge.className = 'smart-card-status-badge belum';
      cardIcon.textContent = '⚡';
      cardText.textContent = 'Akun Pengunjung (Belum Terverifikasi)';
    }
    if (cardEl) {
      cardEl.style.cursor = 'pointer';
      cardEl.title = 'Klik untuk Konfirmasi NISN Siswa di Menu Profil';
      cardEl.onclick = function() {
        if (typeof bukaModalProfilDenganTabNisn === 'function') bukaModalProfilDenganTabNisn();
        else bukaModalProfil();
      };
    }

    // Inisialisasi status rekap untuk pengunjung
    initRekapPresensiSiswa(user);
  } else {
    // Mode Siswa Terverifikasi
    const nisnAktif = user.nisn;
    const kelasAktif = user.kelas || 'XII RPL 2';
    const namaAktif = user.nama;

    if (cardNama) cardNama.textContent = namaAktif;
    if (cardMeta) cardMeta.textContent = `NISN: ${nisnAktif} • ${kelasAktif}`;
    if (cardImg) {
      cardImg.src = `assets/foto/${nisnAktif}.jpg`;
      cardImg.alt = namaAktif;
    }
    if (cardUid) {
      cardUid.textContent = (nisnAktif === '0082104129') ? '04D4E5F6' : '04A1B2C3';
    }
    if (cardEl) {
      cardEl.style.cursor = 'default';
      cardEl.onclick = null;
      cardEl.title = '';
    }

    const today = tanggalHariIni();
    db.ref(`presensi_jam/${kelasAktif}/${today}`).on('value', snapshot => {
      const data = snapshot.val() || {};
      let waktuHadir = null;
      let statusDitemukan = null;

      ['1', '2', '3', '4', '5', '6', '7', '8'].forEach(jam => {
        if (data[jam] && data[jam][nisnAktif]) {
          waktuHadir = data[jam][nisnAktif].waktu;
          statusDitemukan = data[jam][nisnAktif].status;
        }
      });

      const isHadir = (statusDitemukan === 'hadir' || (statusDitemukan && statusDitemukan !== 'alpha'));
      const jamStr = waktuHadir && waktuHadir !== '00:00:00' ? ` (${waktuHadir.slice(0, 5)} WIB)` : '';

      if (cardBadge && cardIcon && cardText) {
        if (isHadir) {
          cardBadge.className = 'smart-card-status-badge hadir';
          cardIcon.textContent = '✓';
          cardText.textContent = `Terverifikasi Hadir${jamStr}`;
        } else {
          cardBadge.className = 'smart-card-status-badge belum';
          cardIcon.textContent = '⚡';
          cardText.textContent = 'Belum Scan Hari Ini';
        }
      }

      if (pillEl && iconEl && textEl) {
        if (isHadir) {
          pillEl.className = 'personal-status-pill hadir';
          iconEl.textContent = '✓';
          textEl.textContent = `Sudah Hadir di Kelas${jamStr}`;
        } else {
          pillEl.className = 'personal-status-pill belum';
          iconEl.textContent = '⚡';
          textEl.textContent = 'Belum Scan Kartu Hari Ini';
        }
      }
    });

    // Inisialisasi Rekap & Riwayat Presensi Siswa (1 Tahun Terakhir)
    initRekapPresensiSiswa(user);
  }

  // 5. Inisialisasi Class Chips Selector
  initClassChipsSelector(user);
}

// ===================================================================
// SISTEM REKAPITULASI PRESENSI 1 TAHUN TERAKHIR (TERBUKA UNTUK SEMUA)
// ===================================================================
let listenerRekapPresensi = null;
let activeNisnRekap = null;

function initRekapPresensiSiswa(user) {
  const alertPengunjung = document.getElementById('rekapPengunjungAlert');
  const contentSiswa = document.getElementById('rekapContentSiswa');
  const selSiswaRekap = document.getElementById('pilihSiswaRekap');

  // Konten rekap presensi selalu terbuka dan dapat ditinjau oleh siapa saja
  if (contentSiswa) contentSiswa.style.display = 'block';

  const isPengunjung = !user || !user.nisn;
  if (alertPengunjung) {
    if (isPengunjung) {
      alertPengunjung.style.display = 'flex';
      const strongEl = alertPengunjung.querySelector('strong');
      const pEl = alertPengunjung.querySelector('p');
      if (strongEl) strongEl.textContent = 'Mode Peninjau Presensi Terbuka';
      if (pEl) pEl.textContent = 'Anda dapat melihat ringkasan statistik dan riwayat presensi RFID siswa di bawah ini secara transparan.';
    } else {
      alertPengunjung.style.display = 'none';
    }
  }

  // Muat opsi daftar siswa ke dropdown pilihan rekap
  db.ref('siswa').once('value').then(snap => {
    const data = snap.val() || {};
    let siswaList = Object.entries(data).map(([n, s]) => ({ nisn: n, nama: s.nama, kelas: s.kelas }));

    // Fallback awal jika database siswa belum tersinkronisasi
    if (siswaList.length === 0) {
      siswaList = [
        { nisn: '0098263610', nama: 'M. Ihsan Athallah', kelas: 'XII RPL 2' },
        { nisn: '0082104129', nama: 'Rizky Ramadhani', kelas: 'XII RPL 2' }
      ];
    } else {
      siswaList.sort((a,b) => (a.nama || '').localeCompare(b.nama || ''));
    }

    if (selSiswaRekap) {
      selSiswaRekap.innerHTML = '';
      siswaList.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.nisn;
        opt.textContent = `${s.nama} (${s.kelas || '-'}) — NISN: ${s.nisn}`;
        selSiswaRekap.appendChild(opt);
      });

      // Siswa login otomatis melihat NISN sendiri, akun pengunjung default ke siswa pertama / Ihsan
      const targetNisn = (user && user.nisn) ? user.nisn : (siswaList.some(s => s.nisn === '0098263610') ? '0098263610' : siswaList[0].nisn);
      selSiswaRekap.value = targetNisn;
      muatDataRekapNisn(targetNisn);

      selSiswaRekap.onchange = function() {
        muatDataRekapNisn(this.value);
      };
    } else {
      const targetNisn = (user && user.nisn) ? user.nisn : '0098263610';
      muatDataRekapNisn(targetNisn);
    }
  });
}

function muatDataRekapNisn(nisn) {
  if (!nisn) return;
  activeNisnRekap = nisn;
  if (listenerRekapPresensi) {
    listenerRekapPresensi.ref.off('value', listenerRekapPresensi.cb);
    listenerRekapPresensi = null;
  }

  const ref = db.ref('absensi/' + nisn);
  const cb = function(snapshot) {
    const rawData = snapshot.val() || {};
    let list = [];
    if (Array.isArray(rawData)) {
      list = rawData.filter(Boolean);
    } else {
      list = Object.values(rawData);
    }

    list.sort((a, b) => {
      const da = (a.tanggal || '') + ' ' + (a.waktu || '');
      const db_ = (b.tanggal || '') + ' ' + (b.waktu || '');
      return db_.localeCompare(da);
    });

    rekapUserCache = list;
    renderRekapSiswaUI(rekapRangeAktif);
  };

  ref.on('value', cb);
  listenerRekapPresensi = { ref, cb };
}

function filterRekapSiswa(range, btn) {
  document.querySelectorAll('#tabRekap .filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  rekapRangeAktif = range;
  renderRekapSiswaUI(range);
}

function renderRekapSiswaUI(range) {
  const tbody = document.getElementById('tabelRekapSiswaBody');
  const labelPeriode = document.getElementById('rekapPeriodeLabel');
  if (!tbody) return;

  const today = tanggalHariIni();
  const dToday = new Date(today + 'T00:00:00');

  let filtered = [];
  let periodeText = '';

  if (range === 'hari_ini') {
    filtered = rekapUserCache.filter(e => e.tanggal === today);
    periodeText = 'Data Hari Ini (' + formatTanggalIndo(today) + ')';
  } else if (range === '7_hari') {
    const d7 = new Date(dToday.getTime() - 7 * 24 * 60 * 60 * 1000);
    filtered = rekapUserCache.filter(e => {
      if (!e.tanggal) return false;
      const d = new Date(e.tanggal + 'T00:00:00');
      return d >= d7 && d <= dToday;
    });
    periodeText = '7 Hari Terakhir';
  } else if (range === 'bulan_ini') {
    const yyyymm = today.slice(0, 7);
    filtered = rekapUserCache.filter(e => e.tanggal && e.tanggal.startsWith(yyyymm));
    periodeText = 'Bulan Ini (' + yyyymm + ')';
  } else {
    // 1 Tahun Terakhir / Penuh
    const d365 = new Date(dToday.getTime() - 365 * 24 * 60 * 60 * 1000);
    filtered = rekapUserCache.filter(e => {
      if (!e.tanggal) return false;
      const d = new Date(e.tanggal + 'T00:00:00');
      return d >= d365 && d <= dToday;
    });
    periodeText = 'Tahun Ajaran 2025/2026 (1 Tahun Terakhir)';
  }

  if (labelPeriode) labelPeriode.textContent = periodeText + ' • Total ' + filtered.length + ' Catatan';

  // Hitung Statistik
  let hitungHadir = 0;
  let hitungSakit = 0;
  let hitungIzin = 0;
  let hitungAlpha = 0;

  const perTanggal = {};
  filtered.forEach(e => {
    const t = e.tanggal || 'unknown';
    if (!perTanggal[t]) perTanggal[t] = [];
    perTanggal[t].push(e);
  });

  Object.values(perTanggal).forEach(logs => {
    const statuses = logs.map(l => l.status);
    if (statuses.includes('hadir') || statuses.includes('pulang')) {
      hitungHadir++;
    } else if (statuses.includes('sakit')) {
      hitungSakit++;
    } else if (statuses.includes('dispensasi') || statuses.includes('ijin') || statuses.includes('ijin_kegiatan')) {
      hitungIzin++;
    } else {
      hitungAlpha++;
    }
  });

  const totalHari = hitungHadir + hitungSakit + hitungIzin + hitungAlpha;
  const persen = totalHari > 0 ? Math.round((hitungHadir / totalHari) * 100) : 100;

  const statPersen = document.getElementById('rekapStatPersen');
  const statHadir  = document.getElementById('rekapStatHadir');
  const statSakit  = document.getElementById('rekapStatSakit');
  const statIzin   = document.getElementById('rekapStatIzin');
  const statAlpha  = document.getElementById('rekapStatAlpha');

  if (statPersen) statPersen.textContent = persen + '%';
  if (statHadir) statHadir.textContent = hitungHadir + ' Hari';
  if (statSakit) statSakit.textContent = hitungSakit + ' Hari';
  if (statIzin) statIzin.textContent = hitungIzin + ' Hari';
  if (statAlpha) statAlpha.textContent = hitungAlpha + ' Hari';

  tbody.innerHTML = '';
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><div class="empty-icon">📅</div><p>Belum ada catatan presensi pada periode ini.</p></td></tr>';
    return;
  }

  const tglKeys = Object.keys(perTanggal).sort().reverse();
  tglKeys.forEach(tgl => {
    const logs = perTanggal[tgl];
    const logMasuk = logs.find(l => l.status === 'hadir') || logs[0];
    const logPulang = logs.find(l => l.status === 'pulang');

    const dt = new Date(tgl + 'T00:00:00');
    const namaHari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][dt.getDay()] || '-';

    let statusPill = '<span class="status-pill sudah">✓ Hadir</span>';
    let ket = 'Hadir tepat waktu di kelas via kartu RFID';

    if (logMasuk.status === 'sakit') {
      statusPill = '<span class="status-pill pending">🤒 Sakit</span>';
      ket = logMasuk.keterangan || 'Surat keterangan dokter terlampir';
    } else if (logMasuk.status === 'dispensasi' || logMasuk.status === 'ijin_kegiatan') {
      statusPill = '<span class="status-pill pending">📄 Izin / Dispen</span>';
      ket = logMasuk.keterangan || 'Dispensasi kegiatan kejuaraan/sekolah';
    } else if (logMasuk.status === 'alpha') {
      statusPill = '<span class="status-pill belum">✗ Alpha</span>';
      ket = 'Tanpa keterangan';
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${tgl}</strong></td>
      <td>${namaHari}</td>
      <td><span style="color:#059669; font-weight:700;">${logMasuk.waktu ? logMasuk.waktu.slice(0, 5) + ' WIB' : '-'}</span></td>
      <td><span style="color:#6366f1; font-weight:700;">${logPulang && logPulang.waktu ? logPulang.waktu.slice(0, 5) + ' WIB' : '15:30 WIB'}</span></td>
      <td>${statusPill}</td>
      <td style="font-size:12.5px; color:#64748b;">${ket}</td>
    `;
    tbody.appendChild(tr);
  });
}

function initClassChipsSelector(user) {
  const container = document.getElementById('classChipsList');
  const containerTab = document.getElementById('classChipsListTab');
  const listKelas = ['XII RPL 1', 'XII RPL 2', 'XII TKJ 1'];

  [container, containerTab].forEach(cnt => {
    if (!cnt) return;
    cnt.innerHTML = '';
    listKelas.forEach(kelas => {
      const chip = document.createElement('button');
      chip.className = 'class-chip';
      chip.textContent = kelas;
      chip.onclick = function() {
        document.querySelectorAll('.class-chip').forEach(c => {
          if (c.textContent === kelas) c.classList.add('active');
          else c.classList.remove('active');
        });
        muatJadwalBeranda(kelas);
      };
      cnt.appendChild(chip);
    });

    const targetKelas = (user && user.kelas && listKelas.includes(user.kelas)) ? user.kelas : 'XII RPL 2';
    const defaultChip = Array.from(cnt.children).find(c => c.textContent === targetKelas);
    if (defaultChip) {
      defaultChip.classList.add('active');
    }
  });

  const targetAwal = (user && user.kelas && listKelas.includes(user.kelas)) ? user.kelas : 'XII RPL 2';
  muatJadwalBeranda(targetAwal);
}

function muatJadwalBeranda(kelas) {
  const gridEl = document.getElementById('homeScheduleGrid');
  const gridTabEl = document.getElementById('tabScheduleGrid');
  const badgePulang = document.getElementById('homeJamPulangBadge');
  const badgePulangTab = document.getElementById('tabJamPulangBadge');
  const bannerMandiri = document.getElementById('bannerKelasMandiri');
  const bannerText = document.getElementById('bannerMandiriText');

  if (badgePulang) badgePulang.textContent = `Memeriksa ${kelas}...`;
  if (badgePulangTab) badgePulangTab.textContent = `Memeriksa ${kelas}...`;

  // Jadwal Pelajaran & Auto-Sync Jam Pulang
  db.ref(`jadwal_pelajaran/${kelas}`).on('value', snapshot => {
    const data = snapshot.val() || {};
    [gridEl, gridTabEl].forEach(g => { if (g) g.innerHTML = ''; });

    const jamKeys = Object.keys(data).sort((a, b) => Number(a) - Number(b));
    if (jamKeys.length === 0) {
      const emptyHtml = `<div style="grid-column: 1/-1; text-align:center; padding:24px; color:#94a3b8; font-size:13.5px; background:#f8fafc; border-radius:16px;">Belum ada jadwal pelajaran untuk kelas ${kelas}.</div>`;
      [gridEl, gridTabEl].forEach(g => { if (g) g.innerHTML = emptyHtml; });
      if (bannerMandiri) bannerMandiri.style.display = 'none';
      if (badgePulang) badgePulang.textContent = `Jam Pulang: -`;
      if (badgePulangTab) badgePulangTab.textContent = `Jam Pulang: -`;
      return;
    }

    // Ambil jam selesai dari mapel paling terakhir
    const keyTerakhir = jamKeys[jamKeys.length - 1];
    const mapelTerakhir = data[keyTerakhir];
    const jamSelesaiAkhir = (mapelTerakhir && mapelTerakhir.selesai) ? mapelTerakhir.selesai : '15:15';

    const jamPulangStr = `Jam Pulang ${kelas}: ${jamSelesaiAkhir} WIB`;
    if (badgePulang) badgePulang.textContent = jamPulangStr;
    if (badgePulangTab) badgePulangTab.textContent = jamPulangStr;

    const jamSkrg = jamSekarang();
    const listJamMandiri = [];

    jamKeys.forEach(jamKe => {
      const p = data[jamKe];

      // 1. Bersihkan nama mapel dari sisa teks statis lama
      const namaMapelBersih = (p.mapel || 'Pelajaran')
        .replace(/\s*\(Guru Ada Halangan \/ Mandiri\)/gi, '')
        .trim();

      // 2. Cek apakah ada konfirmasi resmi guru berhalangan hadir
      const isGuruBerhalangan = p.guru_status === 'berhalangan' || p.guru_status === 'mandiri';
      if (isGuruBerhalangan) {
        listJamMandiri.push(`Jam ke-${jamKe} (${namaMapelBersih})`);
      }

      // 3. Cek apakah jam ini aktif sekarang
      const isActive = p.mulai && p.selesai && jamSkrg >= p.mulai && jamSkrg <= p.selesai;

      const cardHtml = `
        ${isActive ? '<span class="live-pill">LIVE SEKARANG</span>' : ''}
        <div class="schedule-jam">Jam Ke-${jamKe}</div>
        <div class="schedule-mapel">${namaMapelBersih}</div>
        <div class="schedule-waktu">⏰ ${p.mulai || '-'} — ${p.selesai || '-'} WIB</div>
        ${p.guru ? `<div style="font-size:12px;color:#64748b;margin-top:4px;">👨‍🏫 ${p.guru}</div>` : ''}
        ${isGuruBerhalangan ? '<div style="margin-top:8px;"><span style="display:inline-flex; align-items:center; gap:4px; font-size:11px; font-weight:700; color:#b45309; background:#fef3c7; border:1px solid #fde68a; padding:3px 8px; border-radius:6px;">⚡ Guru Berhalangan (Mandiri)</span></div>' : ''}
      `;

      [gridEl, gridTabEl].forEach(g => {
        if (!g) return;
        const card = document.createElement('div');
        card.className = 'schedule-card' + (isActive ? ' is-active' : '');
        card.innerHTML = cardHtml;
        g.appendChild(card);
      });
    });

    // 4. Atur tampilan banner secara dinamis
    if (bannerMandiri) {
      if (listJamMandiri.length > 0) {
        bannerMandiri.style.display = 'flex';
        if (bannerText) {
          bannerText.innerHTML = `Guru pengajar pada <b>${listJamMandiri.join(', ')}</b> mengonfirmasi ada halangan. Murid wajib tetap tertib di dalam kelas dan melakukan <b>scan kartu RFID</b> pada device kelas agar presensi jam tersebut terverifikasi sah.`;
        }
      } else {
        bannerMandiri.style.display = 'none';
      }
    }
  });
}

// ===== HELPER ACTIONS DARI SERVICE GRID =====
function pilihTabCekJadwal() {
  const target = document.getElementById('sectionJadwalHome');
  if (target) {
    target.scrollIntoView({ behavior: 'smooth' });
  }
}

function bukaModalJadwalPulang() {
  db.ref('jadwal').once('value').then(snap => {
    const data = snap.val() || {};
    let info = 'Jadwal Kepulangan Resmi Sekolah:\n\n';
    Object.entries(data).forEach(([kls, val]) => {
      const jam = typeof val === 'string' ? val : '15:15';
      info += `• ${kls}: Pukul ${jam} WIB\n`;
    });
    alert(info || 'Jam pulang resmi seluruh kelas: 15:15 WIB.');
  });
}

function bukaModalTataTertib() {
  alert(
    "📜 TATA TERTIB PRESENSI KELAS MANDIRI:\n\n" +
    "1. Siswa wajib hadir di dalam ruangan kelas sebelum jam pelajaran dimulai.\n" +
    "2. Jika guru berhalangan hadir, siswa melakukan tap kartu RFID pada scanner kelas.\n" +
    "3. Titip absen menggunakan kartu teman dinyatakan pelanggaran disiplin berat.\n" +
    "4. Izin sakit/dispensasi harus diajukan melalui menu 'Ajukan Izin' disertai surat keterangan resmi."
  );
}
