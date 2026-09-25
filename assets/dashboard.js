// ===== DASHBOARD JS (UNIFIED 2026 EDITION) =====
let currentUser = null;

firebase.auth().onAuthStateChanged(async function(fbUser) {
  if (!fbUser) { window.location.href = 'index.html'; return; }
  currentUser = await prosesLoginUser(fbUser);
  initDashboard(currentUser);
});

function switchTab(id, btn) {
  document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.view-tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(id).style.display = 'block';
  btn.classList.add('active');
}

async function initDashboard(user) {
  // Header Profile
  document.getElementById('namaUser').textContent = user.nama;
  document.getElementById('infoSubUser').textContent = user.email || 'Pengguna Terverifikasi';

  if (user.foto_google) {
    const img = document.createElement('img');
    img.src = user.foto_google;
    document.getElementById('avatarUser').innerHTML = '';
    document.getElementById('avatarUser').appendChild(img);
  } else {
    document.getElementById('avatarUser').textContent =
      (user.nama || 'U').split(' ').filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase();
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

// ----- PANTAU KELAS REALTIME -----
let semuaSiswaCache = {};
let jadwalPelajaranKelasCache = null;
let jamKeAktifSekarang = null;
let listenerPresensiKelas = null;
let sudahAbsenSet = new Set();
let detailAbsensiSiswa = {};

function initPantauKelas(user) {
  db.ref('siswa').on('value', function(snap) {
    semuaSiswaCache = snap.val() || {};
    const kelasSet = new Set(Object.values(semuaSiswaCache).filter(s=>s.kelas).map(s=>s.kelas));
    const sel = document.getElementById('pilihKelasPantau');
    const prev = sel.value || (user.kelas && kelasSet.has(user.kelas) ? user.kelas : 'XII RPL 2');
    sel.innerHTML = '';
    Array.from(kelasSet).sort().forEach(k => {
      const opt = document.createElement('option');
      opt.value = k; opt.textContent = 'Kelas ' + k;
      if (k === prev) opt.selected = true;
      sel.appendChild(opt);
    });

    db.ref('jadwal_pelajaran/' + sel.value).once('value').then(s => {
      jadwalPelajaranKelasCache = s.val();
      updateInfoJamPelajaran();
    });
  });

  document.getElementById('pilihKelasPantau').addEventListener('change', function() {
    db.ref('jadwal_pelajaran/' + this.value).once('value').then(s => {
      jadwalPelajaranKelasCache = s.val();
      updateInfoJamPelajaran();
    });
  });

  document.getElementById('cariNamaSiswa').addEventListener('input', renderPantauKelas);
  setInterval(function() {
    const baru = cariJamKeAktif(jadwalPelajaranKelasCache, jamSekarang());
    if (JSON.stringify(baru) !== JSON.stringify(jamKeAktifSekarang)) {
      jamKeAktifSekarang = baru;
      dengarkanPresensiKelas(document.getElementById('pilihKelasPantau').value);
      updateInfoJamEl();
    }
  }, 15000);
}

function updateInfoJamEl() {
  const el = document.getElementById('infoJamPelajaran');
  if (!jamKeAktifSekarang) {
    el.innerHTML = '🕒 <b>Di Luar Jam Belajar / Istirahat.</b> Menampilkan kehadiran kumulatif hari ini.';
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
  dengarkanPresensiKelas(document.getElementById('pilihKelasPantau').value);
}

function dengarkanPresensiKelas(kelas) {
  if (listenerPresensiKelas) {
    listenerPresensiKelas.ref.off('value', listenerPresensiKelas.callback);
    listenerPresensiKelas = null;
  }
  sudahAbsenSet = new Set();
  detailAbsensiSiswa = {};
  if (!kelas) { renderPantauKelas(); return; }

  const tanggal = tanggalHariIni();

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
  const kelas = document.getElementById('pilihKelasPantau').value;
  const cari = document.getElementById('cariNamaSiswa').value.toLowerCase().trim();

  let list = Object.entries(semuaSiswaCache)
    .filter(([,s]) => s.kelas === kelas)
    .filter(([n,s]) => !cari || s.nama.toLowerCase().includes(cari) || n.includes(cari))
    .sort((a,b) => a[1].nama.localeCompare(b[1].nama));

  const gridSudah = document.getElementById('gridSudahAbsen');
  const gridBelum = document.getElementById('gridBelumAbsen');
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
    img.alt = s.nama;
    img.onload = function() { photo.innerHTML=''; photo.appendChild(img); };
    photo.appendChild(img);
    card.appendChild(photo);

    const info = document.createElement('div');
    info.className = 'siswa-card-info';
    const nama = document.createElement('div');
    nama.className = 'siswa-card-nama';
    nama.textContent = s.nama;
    
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

  if (cs === 0) gridSudah.innerHTML = '<p style=\"color:#94a3b8;font-size:13.5px;grid-column:1/-1;\">Belum ada murid yang scan kartu.</p>';
  if (cb === 0 && list.length > 0) gridBelum.innerHTML = '<p style=\"color:#10b981;font-weight:700;font-size:13.5px;grid-column:1/-1;\">Semua murid di kelas ini sudah hadir! 🎉</p>';

  document.getElementById('countSudah').textContent = cs;
  document.getElementById('countBelum').textContent = cb;
  document.getElementById('titleCountSudah').textContent = cs;
  document.getElementById('titleCountBelum').textContent = cb;
}

// ===================================================================
// BERANDA OVERVIEW LOGIC (SMART HUB 2026)
// ===================================================================
let clockInterval = null;

function initBerandaOverview(user) {
  // 1. Greeting Dinamis
  const hour = new Date().getHours();
  let salam = 'Selamat Pagi';
  if (hour >= 11 && hour < 15) salam = 'Selamat Siang';
  else if (hour >= 15 && hour < 18) salam = 'Selamat Sore';
  else if (hour >= 18 || hour < 5) salam = 'Selamat Malam';

  const namaPanggilan = (user.nama || 'Siswa').split(' ')[0];
  const greetingEl = document.getElementById('greetingText');
  if (greetingEl) greetingEl.textContent = `${salam}, ${namaPanggilan}! 👋`;

  const subtextEl = document.getElementById('greetingSubtext');
  if (subtextEl) {
    if (user.kelas) {
      subtextEl.textContent = `Siswa Kelas ${user.kelas} • NISN: ${user.nisn || '-'}`;
    } else {
      subtextEl.textContent = `Selamat datang di Smart School Presensi Hub.`;
    }
  }

  // 2. Live Real-Time Clock
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

  // 3. Status Presensi Pribadi Hari Ini
  const pillEl = document.getElementById('personalStatusPill');
  const iconEl = document.getElementById('personalStatusIcon');
  const textEl = document.getElementById('personalStatusText');

  if (user.nisn && user.kelas) {
    const today = tanggalHariIni();
    db.ref(`presensi_jam/${user.kelas}/${today}`).on('value', snapshot => {
      const data = snapshot.val() || {};
      let waktuHadir = null;
      let statusDitemukan = null;

      // Cari status dari jam 1 s/d 4
      ['1', '2', '3', '4'].forEach(jam => {
        if (data[jam] && data[jam][user.nisn]) {
          waktuHadir = data[jam][user.nisn].waktu;
          statusDitemukan = data[jam][user.nisn].status;
        }
      });

      if (pillEl && iconEl && textEl) {
        if (statusDitemukan === 'hadir' || (statusDitemukan && statusDitemukan !== 'alpha')) {
          pillEl.className = 'personal-status-pill hadir';
          iconEl.textContent = '✓';
          const jamStr = waktuHadir && waktuHadir !== '00:00:00' ? ` (${waktuHadir.slice(0, 5)} WIB)` : '';
          textEl.textContent = `Sudah Hadir di Kelas${jamStr}`;
        } else {
          pillEl.className = 'personal-status-pill belum';
          iconEl.textContent = '⚡';
          textEl.textContent = 'Belum Scan Kartu Hari Ini';
        }
      }
    });
  } else {
    // Mode ortu / umum
    if (pillEl && iconEl && textEl) {
      pillEl.className = 'personal-status-pill hadir';
      iconEl.textContent = '👁️';
      textEl.textContent = 'Mode Pemantau Aktif';
    }
  }

  // 4. Inisialisasi Class Chips Selector (Tidak todong jadwal otomatis)
  initClassChipsSelector(user);
}

function initClassChipsSelector(user) {
  const container = document.getElementById('classChipsList');
  if (!container) return;

  db.ref('siswa').once('value').then(snap => {
    const data = snap.val() || {};
    const kelasSet = new Set(Object.values(data).map(s => s.kelas).filter(Boolean));
    const listKelas = Array.from(kelasSet).sort();

    container.innerHTML = '';
    if (listKelas.length === 0) {
      container.innerHTML = '<span style="color:#94a3b8; font-size:13px;">Belum ada kelas terdaftar.</span>';
      return;
    }

    listKelas.forEach(kelas => {
      const chip = document.createElement('button');
      chip.className = 'class-chip';
      chip.textContent = kelas;
      chip.onclick = function() {
        document.querySelectorAll('.class-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        muatJadwalBeranda(kelas);
      };
      container.appendChild(chip);
    });

    // Jika user punya kelas terdaftar, kita highlight chip miliknya tapi biarkan dia bebas klik kelas lain
    if (user.kelas && kelasSet.has(user.kelas)) {
      const defaultChip = Array.from(container.children).find(c => c.textContent === user.kelas);
      if (defaultChip) {
        defaultChip.classList.add('active');
        muatJadwalBeranda(user.kelas);
      }
    }
  });
}

function muatJadwalBeranda(kelas) {
  const gridEl = document.getElementById('homeScheduleGrid');
  const badgePulang = document.getElementById('homeJamPulangBadge');
  const bannerMandiri = document.getElementById('bannerKelasMandiri');
  const bannerText = document.getElementById('bannerMandiriText');

  if (badgePulang) {
    badgePulang.textContent = `Memeriksa ${kelas}...`;
  }

  // Jadwal Pelajaran & Auto-Sync Jam Pulang
  db.ref(`jadwal_pelajaran/${kelas}`).on('value', snapshot => {
    if (!gridEl) return;
    const data = snapshot.val() || {};
    gridEl.innerHTML = '';

    const jamKeys = Object.keys(data).sort((a, b) => Number(a) - Number(b));
    if (jamKeys.length === 0) {
      gridEl.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:24px; color:#94a3b8; font-size:13.5px; background:#f8fafc; border-radius:16px;">Belum ada jadwal pelajaran untuk kelas ${kelas}.</div>`;
      if (bannerMandiri) bannerMandiri.style.display = 'none';
      if (badgePulang) badgePulang.textContent = `Jam Pulang ${kelas}: -`;
      return;
    }

    // Ambil jam selesai dari mapel paling terakhir
    const keyTerakhir = jamKeys[jamKeys.length - 1];
    const mapelTerakhir = data[keyTerakhir];
    const jamSelesaiAkhir = (mapelTerakhir && mapelTerakhir.selesai) ? mapelTerakhir.selesai : '15:15';

    if (badgePulang) {
      badgePulang.textContent = `Jam Pulang ${kelas}: ${jamSelesaiAkhir} WIB`;
    }

    const jamSkrg = jamSekarang();
    const listJamMandiri = [];

    jamKeys.forEach(jamKe => {
      const p = data[jamKe];
      const card = document.createElement('div');
      card.className = 'schedule-card';

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
      if (isActive) {
        card.classList.add('is-active');
      }

      card.innerHTML = `
        ${isActive ? '<span class="live-pill">LIVE SEKARANG</span>' : ''}
        <div class="schedule-jam">Jam Ke-${jamKe}</div>
        <div class="schedule-mapel">${namaMapelBersih}</div>
        <div class="schedule-waktu">⏰ ${p.mulai || '-'} — ${p.selesai || '-'} WIB</div>
        ${isGuruBerhalangan ? '<div style="margin-top:8px;"><span style="display:inline-flex; align-items:center; gap:4px; font-size:11px; font-weight:700; color:#b45309; background:#fef3c7; border:1px solid #fde68a; padding:3px 8px; border-radius:6px;">⚡ Guru Berhalangan (Mandiri)</span></div>' : ''}
      `;

      gridEl.appendChild(card);
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
