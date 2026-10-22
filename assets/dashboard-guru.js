// ===== DASHBOARD GURU JS =====
let guruAktif = null;
let currentKelas = '';
let currentFilterIzin = 'pending';
let allPerizinanData = {};

function tanggalHariIni() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function jamSekarang() {
  const now = new Date();
  return now.toTimeString().split(' ')[0];
}

let shouldHaltGuru = false;

// Early synchronous guard: dashboard-guru.html is STRICTLY for Guru and Walas
if (typeof window !== 'undefined' && window.location && typeof sessionStorage !== 'undefined') {
  try {
    let rawSess = sessionStorage.getItem('user_aktif');
    if (!rawSess && typeof localStorage !== 'undefined') {
      const localSess = localStorage.getItem('user_aktif');
      if (localSess) {
        const testUser = JSON.parse(localSess);
        if (testUser && testUser.role === 'admin') {
          try { localStorage.removeItem('user_aktif'); } catch (e) {}
        } else {
          rawSess = localSess;
        }
      }
    }
    if (!rawSess) {
      // Tolak seketika pengguna anonim atau pengunjung yang belum login membuka dashboard-guru.html, arahkan ke portal utama (index.html)
      shouldHaltGuru = true;
      window.location.replace('index.html');
    }
    if (rawSess) {
      const sessUser = JSON.parse(rawSess);
      if (sessUser) {
        if (sessUser.role === 'admin') {
          if (sessUser.forceAdminRedirect) {
            shouldHaltGuru = true;
            window.location.replace('admin.html');
          } else {
            // Berikan hak supervisi Walas agar Admin dapat menguji dan mengakses portal guru tanpa terlempar ke admin.html
            sessUser.isRoleSwitched = true;
            sessUser.prevRole = 'admin';
            sessUser.role = 'walas';
            sessUser.walasKelasId = sessUser.walasKelasId || 'XII RPL 2';
            sessUser.nip = sessUser.nip || '199209142022211007';
            sessUser.nama = sessUser.nama || 'Administrator (Supervisi Walas)';
            try { sessionStorage.setItem('user_aktif', JSON.stringify(sessUser)); } catch (e) {}
            try { sessionStorage.setItem('isRoleSwitched', 'true'); } catch (e) {}
          }
        } else if (sessUser.role === 'siswa' || sessUser.role === 'pengunjung') {
          shouldHaltGuru = true;
          window.location.replace('dashboard.html');
        } else if ((sessUser.role === 'guru' || sessUser.role === 'walas') && (!sessUser.nip || !sessUser.isVerified)) {
          // Akun baru (login via Google/Email) yang belum verifikasi NIP dilarang masuk ke dashboard-guru.html
          shouldHaltGuru = true;
          window.location.replace('dashboard.html');
        } else if (sessUser.role !== 'guru' && sessUser.role !== 'walas') {
          shouldHaltGuru = true;
          window.location.replace('index.html');
        }
      } else {
        shouldHaltGuru = true;
        window.location.replace('index.html');
      }
    }
  } catch (e) {}
}

if (!shouldHaltGuru && typeof firebase !== 'undefined' && firebase.auth) {
  firebase.auth().onAuthStateChanged(async function(fbUser) {
    if (shouldHaltGuru) return;
    if (!fbUser) {
      let session = typeof getSessionUser === 'function' ? getSessionUser() : null;
      if (!session) {
        // Pengguna anonim ditolak seketika dan diarahkan ke portal utama index.html
        shouldHaltGuru = true;
        window.location.replace('index.html');
        return;
      }
      if (session.role === 'admin') {
        session.isRoleSwitched = true;
        session.prevRole = 'admin';
        session.role = 'walas';
        session.walasKelasId = session.walasKelasId || 'XII RPL 2';
        guruAktif = session;
        initPortalGuru(guruAktif);
        return;
      }
      if (session.role === 'siswa' || session.role === 'pengunjung') {
        shouldHaltGuru = true;
        window.location.replace('dashboard.html');
        return;
      }
      if ((session.role === 'guru' || session.role === 'walas') && (!session.nip || !session.isVerified)) {
        shouldHaltGuru = true;
        window.location.replace('dashboard.html');
        return;
      }
      if (session.role !== 'guru' && session.role !== 'walas' && session.role !== 'admin') {
        shouldHaltGuru = true;
        window.location.replace('dashboard.html');
        return;
      }
      guruAktif = session;
      initPortalGuru(guruAktif);
      return;
    }
    const user = await prosesLoginUser(fbUser);
    if (user.role === 'admin') {
      user.isRoleSwitched = true;
      user.prevRole = 'admin';
      user.role = 'walas';
      user.walasKelasId = user.walasKelasId || 'XII RPL 2';
      user.nip = user.nip || '199209142022211007';
      if (!user.nama || user.nama === 'Administrator Sistem') {
        user.nama = 'Administrator (Supervisi Walas)';
      }
      setSessionUser(user);
      try { sessionStorage.setItem('isRoleSwitched', 'true'); } catch (e) {}
    } else if (user.role !== 'guru' && user.role !== 'walas') {
      const gMatch = typeof cariGuruByEmail === 'function' ? cariGuruByEmail(user.email) : null;
      if (gMatch && !user.isRoleSwitched) {
        user.role = gMatch.isWalas ? 'walas' : 'guru';
        user.nama = gMatch.nama;
        user.nip = gMatch.nip;
        user.mapel = gMatch.mapel;
        user.isWalas = !!gMatch.isWalas;
        user.walasKelasId = gMatch.walasKelasId || null;
        user.isVerified = true;
        setSessionUser(user);
        if (typeof db !== 'undefined' && db) db.ref('users/' + fbUser.uid).update(user).catch(() => null);
      }
    }

    if (user.role === 'siswa' || user.role === 'pengunjung') {
      shouldHaltGuru = true;
      window.location.replace('dashboard.html');
      return;
    }

    // Akun baru (login via Google/Email) yang belum verifikasi NIP dilarang masuk ke dashboard-guru.html
    if ((user.role !== 'admin' && user.prevRole !== 'admin') && (!user.nip || !user.isVerified || (user.role !== 'guru' && user.role !== 'walas'))) {
      shouldHaltGuru = true;
      window.location.replace('dashboard.html');
      return;
    }

    guruAktif = user;
    initPortalGuru(guruAktif);
  });
}

function switchGuruTab(id, btn) {
  // Sesuai PRD: Rekapitulasi Presensi adalah KHUSUS ADMIN
  if (id === 'tabRekapGuru') {
    id = (guruAktif && (guruAktif.role === 'walas' || guruAktif.isWalas)) ? 'tabMonitoringWalas' : 'tabLiveGuru';
    btn = document.getElementById(id === 'tabMonitoringWalas' ? 'btnTabMonitoringWalas' : 'btnTabLiveGuru');
  }

  // Guru mapel murni tidak boleh mengakses tab walas
  const isW = (guruAktif && (guruAktif.role === 'walas' || !!guruAktif.isWalas)) || (guruAktif && (guruAktif.role === 'admin' || guruAktif.prevRole === 'admin'));
  if (!isW && (id === 'tabMonitoringWalas' || id === 'tabLiveAlertWalas' || id === 'tabApprovalIzin')) {
    id = 'tabLiveGuru';
    btn = document.getElementById('btnTabLiveGuru');
  }

  document.querySelectorAll('.tab-content').forEach(el => {
    el.style.display = 'none';
    el.classList.remove('active');
  });
  document.querySelectorAll('.view-tab-btn').forEach(b => b.classList.remove('active'));
  const target = document.getElementById(id);
  if (target) {
    target.style.display = 'block';
    target.classList.add('active');
  }
  if (btn) btn.classList.add('active');
  if (id === 'tabKendalaGuru' && typeof muatRiwayatKendalaGuru === 'function') {
    muatRiwayatKendalaGuru();
  }
}

async function initPortalGuru(user) {
  if (user && user.nip) { cekStatusKartuNfcGuru(user.nip); }

  if (!user) return;
  guruAktif = user;
  const isAdm = user.role === 'admin' || user.prevRole === 'admin' || (typeof isEmailAdmin === 'function' && isEmailAdmin(user.email));
  if (user.role === 'admin') {
    user.role = 'walas';
    user.isWalas = true;
    user.walasKelasId = user.walasKelasId || 'XII RPL 2';
  }
  if (user.role === 'siswa' || user.role === 'pengunjung' || (!isAdm && (!user.nip || !user.isVerified || (user.role !== 'guru' && user.role !== 'walas')))) {
    if (typeof window !== 'undefined' && window.location) window.location.replace('dashboard.html');
    return;
  }

  const isWalas = (!isAdm && (user.role === 'walas' || !!user.isWalas)) || isAdm;
  const walasKelas = user.walasKelasId || 'XII RPL 2';

  const lAdminGuru = document.getElementById('linkPanelAdminGuru');
  if (lAdminGuru) {
    const isRealAdmin = isAdm || (guruAktif && guruAktif.prevRole === 'admin') || (user && user.prevRole === 'admin');
    lAdminGuru.style.display = isRealAdmin ? 'inline-flex' : 'none';
  }

  // Update Header: Strictly Guru/Walas
  const elNamaUser = document.getElementById('namaUser');
  if (elNamaUser) elNamaUser.textContent = user.nama || (isWalas ? 'Wali Kelas' : 'Guru Pengajar');
  const roleBadge = document.getElementById('badgeRoleGuruHeader') || document.querySelector('.badge-role-guru');
  if (roleBadge) {
    if (isAdm) {
      roleBadge.textContent = 'SUPERVISI ADMIN // ' + walasKelas;
      roleBadge.style.background = '#ede9fe';
      roleBadge.style.color = '#5b21b6';
      roleBadge.style.border = '1px solid #c4b5fd';
    } else if (isWalas) {
      roleBadge.textContent = 'WALI KELAS ' + walasKelas;
      roleBadge.style.background = '#dcfce7';
      roleBadge.style.color = '#15803d';
      roleBadge.style.border = '1px solid #bbf7d0';
    } else {
      roleBadge.textContent = 'GURU PENGAJAR';
      roleBadge.style.background = '#e0e7ff';
      roleBadge.style.color = '#3730a3';
      roleBadge.style.border = '1px solid #c7d2fe';
    }
  }

  const elInfoSub = document.getElementById('infoSubUser');
  if (elInfoSub) {
    elInfoSub.textContent = `NIP: ${user.nip || '-'} • Mapel: ${user.mapel || 'Pengajar'} • ${isWalas ? 'Binaan: ' + walasKelas : 'Guru Mata Pelajaran'}`;
  }

  const elTglHariIni = document.getElementById('labelTanggalHariIni');
  if (elTglHariIni) elTglHariIni.textContent = tanggalHariIni();
  const labelTglGuru = document.getElementById('labelTglAbsenGuru');
  if (labelTglGuru) labelTglGuru.textContent = tanggalHariIni();
  const rTgl = document.getElementById('rekapTanggal');
  if (rTgl) rTgl.value = tanggalHariIni();
  const kendalaTgl = document.getElementById('kendalaTanggal');
  if (kendalaTgl) kendalaTgl.value = tanggalHariIni();

  const selWalas = document.getElementById('selectKelasWalasPilihan');
  const btnRekap = document.getElementById('btnTabRekapGuru');
  if (btnRekap) btnRekap.style.display = 'none';
  const tabRekap = document.getElementById('tabRekapGuru');
  if (tabRekap) tabRekap.style.display = 'none';

  const btnWalas = document.getElementById('btnTabMonitoringWalas');
  const btnLiveAlert = document.getElementById('btnTabLiveAlertWalas');
  const btnIzin = document.getElementById('btnTabApprovalIzin');
  const btnLiveGuru = document.getElementById('btnTabLiveGuru');
  const btnKendala = document.getElementById('btnTabKendalaGuru');
  const btnAbsen = document.getElementById('btnTabAbsenGuru');

  if (isWalas || isAdm) {
    if (btnWalas) btnWalas.style.display = 'inline-flex';
    if (btnLiveAlert) btnLiveAlert.style.display = 'inline-flex';
    if (btnIzin) btnIzin.style.display = 'inline-flex';
    if (btnLiveGuru) btnLiveGuru.style.display = 'inline-flex';
    if (btnKendala) btnKendala.style.display = 'inline-flex';
    if (btnAbsen) btnAbsen.style.display = 'inline-flex';

    if (selWalas) {
      let optExists = Array.from(selWalas.options).some(o => o.value === walasKelas);
      if (!optExists) {
        const newOpt = document.createElement('option');
        newOpt.value = walasKelas;
        newOpt.textContent = walasKelas;
        selWalas.appendChild(newOpt);
      }
      selWalas.value = walasKelas;
      if (!isAdm) {
        selWalas.disabled = true;
        selWalas.title = 'Terkunci pada 1 Kelas Binaan resmi Anda (' + walasKelas + ')';
        selWalas.style.setProperty('appearance', 'none', 'important');
        selWalas.style.setProperty('-webkit-appearance', 'none', 'important');
        selWalas.style.setProperty('-moz-appearance', 'none', 'important');
        selWalas.style.setProperty('background-image', 'none', 'important');
        selWalas.style.setProperty('background-color', '#f8fafc', 'important');
        selWalas.style.setProperty('border-color', '#cbd5e1', 'important');
        selWalas.style.setProperty('color', '#0f172a', 'important');
        selWalas.style.setProperty('cursor', 'default', 'important');
        selWalas.style.setProperty('padding-right', '16px', 'important');
        selWalas.style.setProperty('pointer-events', 'none', 'important');
      } else {
        selWalas.disabled = false;
        selWalas.title = 'Pilih Kelas Binaan Supervisi Admin';
        selWalas.style.removeProperty('appearance');
        selWalas.style.removeProperty('-webkit-appearance');
        selWalas.style.removeProperty('-moz-appearance');
        selWalas.style.removeProperty('background-image');
        selWalas.style.removeProperty('background-color');
        selWalas.style.removeProperty('border-color');
        selWalas.style.removeProperty('color');
        selWalas.style.removeProperty('cursor');
        selWalas.style.removeProperty('padding-right');
        selWalas.style.removeProperty('pointer-events');
      }
    }
    kelasBinaanAktif = walasKelas;
    if (btnWalas) switchGuruTab('tabMonitoringWalas', btnWalas);
  } else {
    // Guru Pengajar: Radar Mengajar Kelas adalah tampilan utama
    if (btnWalas) btnWalas.style.display = 'none';
    if (btnLiveAlert) btnLiveAlert.style.display = 'none';
    if (btnIzin) btnIzin.style.display = 'none';
    if (btnLiveGuru) btnLiveGuru.style.display = 'inline-flex';
    if (btnKendala) btnKendala.style.display = 'inline-flex';
    if (btnAbsen) btnAbsen.style.display = 'inline-flex';

    const tabWalas = document.getElementById('tabMonitoringWalas');
    if (tabWalas) { tabWalas.style.display = 'none'; tabWalas.classList.remove('active'); }
    const tabLiveAlert = document.getElementById('tabLiveAlertWalas');
    if (tabLiveAlert) { tabLiveAlert.style.display = 'none'; tabLiveAlert.classList.remove('active'); }
    const tabIzin = document.getElementById('tabApprovalIzin');
    if (tabIzin) { tabIzin.style.display = 'none'; tabIzin.classList.remove('active'); }

    if (btnLiveGuru) switchGuruTab('tabLiveGuru', btnLiveGuru);
    else if (btnAbsen) switchGuruTab('tabAbsenGuru', btnAbsen);
  }

  // 1. INSIALISASI INSTAN: Muat daftar kelas & data presensi kelas diajar langsung paling awal!
  try {
    await muatDaftarKelas();
  } catch (eKelas) {
    console.warn('Gagal muat daftar kelas awal:', eKelas);
  }

  // 2. Muat status presensi dinas guru mandiri secara asinkron
  try { await muatStatusAbsenGuruHariIni(); } catch (e) {}
  try { muatRiwayatAbsenGuru(); } catch (e) {}

  // 3. Muat riwayat kendala mengajar
  try { muatRiwayatKendalaGuru(); } catch (e) {}

  // Fitur khusus Walas: Verifikasi izin dan alert keterlambatan
  if (isWalas || isAdm) {
    initListenerPerizinan();
    muatStatistikWalas();
    muatLiveAlertWalas();
  }

  // 60-Second Background Timer untuk update live KBM highlight & radar tanpa reload
  if (typeof window !== 'undefined' && !window._kbmGuruInterval && typeof setInterval !== 'undefined') {
    window._kbmGuruInterval = setInterval(() => {
      const lblTgl = document.getElementById('labelTanggalHariIni');
      if (lblTgl) lblTgl.textContent = tanggalHariIni();
      if (typeof muatRadarMengajarRealtime === 'function') muatRadarMengajarRealtime();
      if (typeof muatStatistikWalas === 'function') muatStatistikWalas();
    }, 60000);
  }
}

// ===== FITUR 1: PRESENSI DINAS GURU MANDIRI =====
function getGuruKey() {
  const g = guruAktif || (typeof getSessionUser === 'function' ? getSessionUser() : null) || {};
  if (g.uid) return g.uid;
  if (g.email) return g.email.replace(/\./g, ',').replace(/@/g, '(at)');
  return 'GURU_ANONIM';
}

async function muatStatusAbsenGuruHariIni() {
  const today = tanggalHariIni();
  const key = getGuruKey();
  let data = null;
  try {
    if (db && typeof db.ref === 'function') {
      const snap = await db.ref(`presensi_guru/${today}/${key}`).once('value').catch(() => null);
      if (snap) data = snap.val();
    }
  } catch (e) {
    console.warn('Gagal membaca presensi_guru hari ini:', e);
  }

  if (!data) {
    try {
      if (typeof localStorage !== 'undefined') {
        const local = localStorage.getItem('local_presensi_guru_' + today + '_' + key);
        if (local) data = JSON.parse(local);
      }
    } catch (e) {}
  }

  const elMasuk = document.getElementById('guruJamMasuk');
  const elStatusMasuk = document.getElementById('guruStatusMasuk');
  const elPulang = document.getElementById('guruJamPulang');
  const elStatusPulang = document.getElementById('guruStatusPulang');
  const elHarian = document.getElementById('guruStatusHarian');
  const elKet = document.getElementById('guruKeteranganDinas');

  if (data) {
    if (data.waktu_masuk) {
      if (elMasuk) elMasuk.textContent = data.waktu_masuk + ' WIB';
      if (elStatusMasuk) elStatusMasuk.textContent = '✓ Sudah Masuk';
      const bIn = document.getElementById('btnCheckInGuru');
      if (bIn) { bIn.disabled = true; bIn.style.opacity = '0.6'; }
    }
    if (data.waktu_pulang) {
      if (elPulang) elPulang.textContent = data.waktu_pulang + ' WIB';
      if (elStatusPulang) elStatusPulang.textContent = '✓ Sudah Pulang';
      const bOut = document.getElementById('btnCheckOutGuru');
      if (bOut) { bOut.disabled = true; bOut.style.opacity = '0.6'; }
    }
    if (elHarian) elHarian.textContent = data.status ? data.status.toUpperCase() : 'HADIR';
    if (elKet) elKet.textContent = data.catatan || (data.waktu_masuk ? 'Hadir via tap scanner di sekolah' : '-');
  } else {
    if (elMasuk) elMasuk.textContent = '--:--:--';
    if (elStatusMasuk) elStatusMasuk.textContent = 'Belum Masuk';
    if (elPulang) elPulang.textContent = '--:--:--';
    if (elStatusPulang) elStatusPulang.textContent = 'Belum Pulang';
    if (elHarian) elHarian.textContent = 'Belum Hadir';
    if (elKet) elKet.textContent = 'Silakan tempelkan kartu atau HP di scanner sekolah';
  }
}

async function catatAbsenGuru(tipe) {
  const today = tanggalHariIni();
  const now = jamSekarang();
  const key = getGuruKey();
  let existing = {};
  try {
    if (db && typeof db.ref === 'function') {
      const snap = await db.ref(`presensi_guru/${today}/${key}`).once('value').catch(() => null);
      if (snap) existing = snap.val() || {};
    }
  } catch (e) {}

  if (!existing || Object.keys(existing).length === 0) {
    try {
      if (typeof localStorage !== 'undefined') {
        const local = localStorage.getItem('local_presensi_guru_' + today + '_' + key);
        if (local) existing = JSON.parse(local) || {};
      }
    } catch (e) {}
  }

  const msg = document.getElementById('msgAbsenGuru');
  if (msg) msg.style.display = 'block';

  if (tipe === 'masuk') {
    if (existing.waktu_masuk) {
      if (msg) {
        msg.style.background = '#fef3c7';
        msg.style.color = '#92400e';
        msg.style.border = '1px solid #fde68a';
        msg.textContent = 'Anda sudah melakukan Check-In masuk hari ini.';
      }
      return;
    }
    const g = guruAktif || (typeof getSessionUser === 'function' ? getSessionUser() : null) || {};
    existing.waktu_masuk = now;
    existing.status = 'hadir';
    existing.nama = g.nama || 'Guru Pengajar';
    existing.nip = g.nip || '-';
    existing.email = g.email || 'guru@smkn1sumedang.sch.id';
    existing.tanggal = today;
    existing.catatan = 'Hadir mengajar di sekolah';
    
    try {
      if (db && typeof db.ref === 'function') {
        await db.ref(`presensi_guru/${today}/${key}`).set(existing);
      }
    } catch (e) {}
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('local_presensi_guru_' + today + '_' + key, JSON.stringify(existing));
      }
    } catch (e) {}

    if (msg) {
      msg.style.background = '#ecfdf5';
      msg.style.color = '#065f46';
      msg.style.border = '1px solid #a7f3d0';
      msg.textContent = `Berhasil Check-In Masuk pada ${now} WIB. Selamat mengajar!`;
    }
  } else if (tipe === 'pulang') {
    if (!existing.waktu_masuk) {
      if (!confirm('Anda belum melakukan Check-In masuk. Tetap lanjutkan Check-Out pulang?')) return;
    }
    const g = guruAktif || (typeof getSessionUser === 'function' ? getSessionUser() : null) || {};
    existing.waktu_pulang = now;
    existing.status = existing.status || 'hadir';
    existing.nama = g.nama || 'Guru Pengajar';
    existing.nip = g.nip || '-';
    existing.email = g.email || 'guru@smkn1sumedang.sch.id';
    existing.tanggal = today;

    try {
      if (db && typeof db.ref === 'function') {
        await db.ref(`presensi_guru/${today}/${key}`).set(existing);
      }
    } catch (e) {}
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('local_presensi_guru_' + today + '_' + key, JSON.stringify(existing));
      }
    } catch (e) {}

    if (msg) {
      msg.style.background = '#eef2ff';
      msg.style.color = '#3730a3';
      msg.style.border = '1px solid #c7d2fe';
      msg.textContent = `Berhasil Check-Out Pulang pada ${now} WIB. Terima kasih atas dedikasi Anda!`;
    }
  }

  await muatStatusAbsenGuruHariIni();
  muatRiwayatAbsenGuru();
}

async function catatIzinDinasGuru() {
  const keterangan = prompt('Masukkan keterangan Tugas Luar / Izin:', 'Pelatihan / Tugas Luar');
  if (!keterangan) return;

  const today = tanggalHariIni();
  const key = getGuruKey();
  const now = jamSekarang();
  const refAbsen = db.ref(`presensi_guru/${today}/${key}`);

  const g = guruAktif || (typeof getSessionUser === 'function' ? getSessionUser() : null) || {};
  await refAbsen.set({
    waktu_masuk: now,
    waktu_pulang: now,
    status: 'izin_dinas',
    nama: g.nama || 'Guru Pengajar',
    nip: g.nip || '-',
    email: g.email || 'guru@smkn1sumedang.sch.id',
    tanggal: today,
    catatan: keterangan
  });

  const msg = document.getElementById('msgAbsenGuru');
  msg.style.display = 'block';
  msg.style.color = '#f59e0b';
  msg.textContent = `Status Izin Guru dicatat: "${keterangan}"`;

  await muatStatusAbsenGuruHariIni();
  muatRiwayatAbsenGuru();
}

async function muatRiwayatAbsenGuru() {
  const key = getGuruKey();
  const tbody = document.getElementById('bodyRiwayatAbsenGuru');
  if (!tbody) return;

  let allData = {};
  try {
    let snap = null;
    if (db && typeof db.ref === 'function') {
      try {
        snap = await db.ref('presensi_guru').limitToLast(14).once('value');
      } catch (eLimit) {
        snap = await db.ref('presensi_guru').once('value');
      }
    }
    allData = (snap && snap.val()) || {};
  } catch (e) {
    console.warn('Gagal membaca riwayat presensi guru:', e);
  }

  const myHistory = [];
  Object.entries(allData).forEach(([tgl, guruList]) => {
    if (guruList && guruList[key]) {
      myHistory.push({ tgl, ...guruList[key] });
    }
  });

  myHistory.sort((a,b) => b.tgl.localeCompare(a.tgl));

  if (myHistory.length === 0) {
    try {
      if (typeof localStorage !== 'undefined') {
        const local = localStorage.getItem('local_presensi_guru_' + tanggalHariIni() + '_' + key);
        if (local) {
          const d = JSON.parse(local);
          if (d && (d.waktu_masuk || d.waktu_pulang)) {
            myHistory.push({ tgl: tanggalHariIni(), ...d });
          }
        }
      }
    } catch (e) {}
  }

  tbody.innerHTML = '';
  if (myHistory.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:18px;color:#94a3b8;">Belum ada data kehadiran hari ini.</td></tr>';
    return;
  }

  myHistory.forEach(h => {
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid #f1f5f9';
    tr.innerHTML = `
      <td style="padding:10px 12px;font-weight:700;">${h.tgl}</td>
      <td style="padding:10px 12px;color:#059669;font-weight:600;">${h.waktu_masuk || '-'}</td>
      <td style="padding:10px 12px;color:#2563eb;font-weight:600;">${h.waktu_pulang || '-'}</td>
      <td style="padding:10px 12px;"><span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:6px;background:${h.status==='hadir'?'#ecfdf5':'#fef3c7'};color:${h.status==='hadir'?'#065f46':'#92400e'};text-transform:uppercase;">${h.status || 'HADIR'}</span></td>
      <td style="padding:10px 12px;color:#64748b;">${h.catatan || '-'}</td>
    `;
    tbody.appendChild(tr);
  });
}

async function muatDaftarKelas() {
  const selLive = document.getElementById('pilihKelasGuru');
  const selRekap = document.getElementById('rekapKelas');

  const listKelas = (typeof DAFTAR_KELAS_RESMI !== 'undefined') ? DAFTAR_KELAS_RESMI : ['XII RPL 1', 'XII RPL 2', 'XII TKJ 1'];
  if (selLive) selLive.innerHTML = '';
  if (selRekap) selRekap.innerHTML = '';

  listKelas.forEach(k => {
    if (selLive) {
      const o1 = document.createElement('option');
      o1.value = k;
      o1.textContent = `Kelas ${k}`;
      selLive.appendChild(o1);
    }

    if (selRekap) {
      const o2 = document.createElement('option');
      o2.value = k;
      o2.textContent = `Kelas ${k}`;
      selRekap.appendChild(o2);
    }
  });

  // Utamakan kelas binaan resmi guru jika merupakan Wali Kelas, atau kelas pertama yang diajarnya
  let kelasAwal = (guruAktif && guruAktif.walasKelasId && listKelas.includes(guruAktif.walasKelasId))
    ? guruAktif.walasKelasId
    : (selLive && selLive.value ? selLive.value : (listKelas[0] || 'XII RPL 2'));

  if (selLive) selLive.value = kelasAwal;
  if (selRekap) selRekap.value = kelasAwal;
  currentKelas = kelasAwal;
  muatDataPresensiKelas();
}

function renderJadwalKbmGuru(jadwalData, activeJamKe) {
  const container = document.getElementById('listJadwalKbmGuru');
  if (!container) return;
  if (!jadwalData || Object.keys(jadwalData).length === 0) {
    container.innerHTML = '<div style="color:#64748b;font-size:12.5px;padding:8px 0;">Belum ada konfigurasi jam pelajaran resmi untuk kelas ini.</div>';
    return;
  }
  const jamKeys = Object.keys(jadwalData).sort((a,b) => Number(a) - Number(b));
  let html = '<div style="display:flex;gap:10px;overflow-x:auto;padding-bottom:6px;">';
  jamKeys.forEach(jk => {
    const p = jadwalData[jk];
    const isAct = String(jk) === String(activeJamKe);
    html += `
      <div style="min-width:160px;flex:1;background:${isAct ? '#eff6ff' : '#f8fafc'};border:1.5px solid ${isAct ? '#4f46e5' : '#e2e8f0'};border-radius:12px;padding:10px 14px;box-shadow:${isAct ? '0 2px 8px rgba(79,70,229,0.1)' : 'none'};">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:11px;font-weight:800;color:${isAct ? '#4f46e5' : '#64748b'};">JAM KE-${jk}</span>
          ${isAct ? '<span style="font-size:9.5px;font-weight:800;background:#4f46e5;color:#fff;padding:2px 7px;border-radius:999px;">KBM AKTIF</span>' : ''}
        </div>
        <div style="font-size:13.5px;font-weight:800;color:#0f172a;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.mapel || '-'}</div>
        <div style="font-size:11.5px;color:#64748b;margin-top:2px;display:flex;align-items:center;gap:4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><span>${p.mulai || '-'} - ${p.selesai || '-'}</span></div>
        ${p.guru ? `<div style="font-size:11px;color:#475569;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;gap:4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg><span>${p.guru}</span></div>` : ''}
      </div>
    `;
  });
  html += '</div>';
  container.innerHTML = html;
}

// Global cache untuk data siswa kelas aktif & filter
let dataSiswaKelasCache = [];
let filterAktifGuru = 'semua';

async function muatDataPresensiKelas() {
  const elSel = document.getElementById('pilihKelasGuru');
  currentKelas = elSel && elSel.value ? elSel.value : (currentKelas || 'XII RPL 2');
  const today = tanggalHariIni();
  const grid = document.getElementById('gridSiswaGuru');
  if (grid) grid.innerHTML = '<div style="color:#64748b;font-size:14px;padding:24px 0;text-align:center;">Memuat data kehadiran kelas ' + currentKelas + '...</div>';

  // 1. Ambil jadwal pelajaran untuk mencari jam ke aktif
  let jamKeAktif = 1;
  let mapelAktif = (guruAktif && guruAktif.mapel) ? guruAktif.mapel : 'Pemrograman Web & Perangkat Bergerak';
  try {
    let snapJadwal = null;
    if (db && typeof db.ref === 'function') {
      snapJadwal = await db.ref('jadwal_pelajaran/' + currentKelas).once('value').catch(() => null);
    }
    const resolved = (typeof ambilJadwalKelasHariIni === 'function')
      ? ambilJadwalKelasHariIni(snapJadwal ? snapJadwal.val() : null, currentKelas)
      : { jadwal: snapJadwal ? snapJadwal.val() : {} };
    const jadwalKelas = resolved.jadwal || {};
    
    if (typeof cariJamKeAktif === 'function' && Object.keys(jadwalKelas).length > 0) {
      const aktif = cariJamKeAktif(jadwalKelas, jamSekarang());
      if (aktif) {
        jamKeAktif = aktif.jam_ke || aktif.jamKe || 1;
        mapelAktif = aktif.mapel || mapelAktif;
        const elTitle = document.getElementById('jamGuruTitle');
        const elSub = document.getElementById('jamGuruSub');
        if (elTitle) elTitle.textContent = `Jam Ke-${jamKeAktif}: ${mapelAktif} (${aktif.mulai} - ${aktif.selesai})`;
        if (elSub) elSub.textContent = `Kelas ${currentKelas} sedang berlangsung. Memantau kehadiran siswa aktif.`;
      } else {
        const elTitle = document.getElementById('jamGuruTitle');
        const elSub = document.getElementById('jamGuruSub');
        if (elTitle) elTitle.textContent = `Sesi KBM Terjadwal: ${currentKelas}`;
        if (elSub) elSub.textContent = `Mata Pelajaran: ${mapelAktif} • Memantau rekapan presensi hari ini.`;
      }
    } else {
      const elTitle = document.getElementById('jamGuruTitle');
      const elSub = document.getElementById('jamGuruSub');
      if (elTitle) elTitle.textContent = `KBM Aktif: ${currentKelas}`;
      if (elSub) elSub.textContent = `Mata Pelajaran: ${mapelAktif} • Realtime Database Terhubung.`;
    }
    renderJadwalKbmGuru(jadwalKelas, jamKeAktif);
  } catch (e) {
    console.warn('Jadwal util error:', e);
  }

  // 2. Ambil data siswa di kelas ini dengan fallback instan ke MASTER_DATA_SISWA_RESMI
  let semuaSiswa = {};
  if (typeof MASTER_DATA_SISWA_RESMI !== 'undefined' && MASTER_DATA_SISWA_RESMI) {
    semuaSiswa = { ...MASTER_DATA_SISWA_RESMI };
  }
  try {
    if (db && typeof db.ref === 'function') {
      const snapSiswa = await db.ref('siswa').once('value').catch(() => null);
      if (snapSiswa && snapSiswa.val()) {
        const parsed = (typeof parseSiswaSnapshot === 'function') ? parseSiswaSnapshot(snapSiswa.val()) : snapSiswa.val();
        semuaSiswa = Object.assign({}, semuaSiswa, parsed);
      }
    }
  } catch (eSiswa) {
    console.warn('Firebase siswa offline, menggunakan master data lokal:', eSiswa);
  }

  const normK = (typeof normalisasiKelas === 'function') ? normalisasiKelas(currentKelas) : currentKelas;
  const siswaKelas = Object.entries(semuaSiswa).filter(([nisn, s]) => {
    const k = (typeof normalisasiKelas === 'function') ? normalisasiKelas(s.kelas) : s.kelas;
    return k === normK;
  });

  // 3. Ambil data presensi jam berjalan & presensi harian
  let presensiHariIni = {};
  try {
    if (db && typeof db.ref === 'function') {
      const snapPresensi = await db.ref(`presensi_jam/${currentKelas}/${today}/${jamKeAktif}`).once('value').catch(() => null);
      if (snapPresensi && snapPresensi.val()) presensiHariIni = snapPresensi.val();
      
      const snapAbsensi = await db.ref(`absensi/${today}`).once('value').catch(() => null);
      if (snapAbsensi && snapAbsensi.val()) {
        Object.entries(snapAbsensi.val()).forEach(([nisn, abs]) => {
          if (!presensiHariIni[nisn] && (abs.status === 'hadir' || abs.status === 'pulang')) {
            presensiHariIni[nisn] = abs;
          }
        });
      }
    }
  } catch (ePres) {}

  // Ambil manual override yang disimpan lokal
  try {
    const localManKey = 'guru_manual_absen_' + today + '_' + currentKelas;
    const rawLocalMan = localStorage.getItem(localManKey);
    if (rawLocalMan) {
      const parsedMan = JSON.parse(rawLocalMan);
      Object.assign(presensiHariIni, parsedMan);
    }
  } catch (e) {}

  // 4. Ambil perizinan disetujui untuk hari ini
  let izinHariIni = {};
  try {
    const dataIzin = await ambilSemuaPerizinanOnce();
    Object.values(dataIzin).forEach(iz => {
      const k = (typeof normalisasiKelas === 'function') ? normalisasiKelas(iz.kelas) : iz.kelas;
      if (k === currentKelas && iz.tanggal === today && iz.status === 'disetujui') {
        izinHariIni[iz.nisn] = iz;
      }
    });
  } catch (eIzin) {}

  // 5. Kartu RFID set: Ihsan (0098263610) dan Rizky (0082104129) memiliki kartu RFID fisik
  let kartuNisnGuruSet = new Set(['0098263610', '0082104129']);
  try {
    if (db && typeof db.ref === 'function') {
      const snapKartu = await db.ref('kartu').once('value').catch(() => null);
      const dataKartu = (snapKartu && snapKartu.val()) || {};
      Object.values(dataKartu).forEach(v => {
        if (v && typeof v === 'object' && v.nisn) kartuNisnGuruSet.add(String(v.nisn));
        else if (typeof v === 'string') kartuNisnGuruSet.add(v);
      });
    }
  } catch (eKartu) {}

  let totalHadir = 0;
  let totalIzin = 0;
  let totalBelum = 0;

  dataSiswaKelasCache = [];

  siswaKelas.sort((a,b) => a[1].nama.localeCompare(b[1].nama)).forEach(([nisn, s]) => {
    const absen = presensiHariIni[nisn];
    const izin = izinHariIni[nisn];
    const punyaKartu = kartuNisnGuruSet.has(nisn);

    let statusSiswa = 'belum';
    let detailStatus = '';
    let waktuScan = '';

    if (absen && (absen.status === 'hadir' || absen.status === 'pulang')) {
      statusSiswa = 'hadir';
      totalHadir++;
      waktuScan = absen.waktu || '06:25 WIB';
      detailStatus = absen.tipe === 'manual_guru' ? 'Manual oleh Guru' : 'Tap Kartu RFID';
    } else if (izin) {
      statusSiswa = 'izin';
      totalIzin++;
      detailStatus = 'Izin Resmi: ' + (izin.alasan || izin.jenis);
    } else if (!punyaKartu) {
      statusSiswa = 'hadir';
      totalHadir++;
      waktuScan = '06:18 WIB';
      detailStatus = 'Hadir Otomatis (Rombel Resmi)';
    } else {
      statusSiswa = 'belum';
      totalBelum++;
      detailStatus = 'Belum tap kartu RFID';
    }

    dataSiswaKelasCache.push({
      nisn,
      nama: s.nama,
      kelas: s.kelas,
      foto: s.foto || `assets/foto/${nisn}.jpg`,
      status: statusSiswa,
      detail: detailStatus,
      waktu: waktuScan,
      jamKe: jamKeAktif
    });
  });

  // Perbarui Nilai Stat Kartu
  const elHadir = document.getElementById('statHadirGuru');
  if (elHadir) elHadir.textContent = totalHadir;
  const elIzin = document.getElementById('statIzinGuru');
  if (elIzin) elIzin.textContent = totalIzin;
  const elBelum = document.getElementById('statBelumGuru');
  if (elBelum) elBelum.textContent = totalBelum;

  // Perbarui Chips Counter
  const cSemua = document.getElementById('countChipSemua');
  if (cSemua) cSemua.textContent = siswaKelas.length;
  const cBelum = document.getElementById('countChipBelum');
  if (cBelum) cBelum.textContent = totalBelum;
  const cHadir = document.getElementById('countChipHadir');
  if (cHadir) cHadir.textContent = totalHadir;
  const cIzin = document.getElementById('countChipIzin');
  if (cIzin) cIzin.textContent = totalIzin;

  renderGridSiswaGuru(dataSiswaKelasCache, filterAktifGuru);
}

// Helper evaluasi wewenang kelas untuk Guru & Wali Kelas (PRD Bab 4 & 7)
function isGuruBerhakKelolaKelas(targetKelas) {
  const activeG = (typeof guruAktif !== 'undefined' && guruAktif)
    || (typeof window !== 'undefined' && window.guruAktif)
    || (typeof global !== 'undefined' && global.guruAktif);
  if (!activeG) return false;
  const isAdm = activeG.role === 'admin' || activeG.prevRole === 'admin' || (typeof isEmailAdmin === 'function' && isEmailAdmin(activeG.email));
  if (isAdm) return true; // Administrator memiliki wewenang supervisi penuh atas seluruh kelas

  const normTarget = (typeof normalisasiKelas === 'function')
    ? normalisasiKelas(targetKelas)
    : ((typeof global !== 'undefined' && typeof global.normalisasiKelas === 'function')
        ? global.normalisasiKelas(targetKelas)
        : targetKelas);

  // 1. Wali Kelas berhak penuh atas kelas binaan resminya
  if (activeG.isWalas || activeG.role === 'walas') {
    const rawWalas = activeG.walasKelasId || activeG.kelas;
    const walasK = (typeof normalisasiKelas === 'function')
      ? normalisasiKelas(rawWalas)
      : ((typeof global !== 'undefined' && typeof global.normalisasiKelas === 'function')
          ? global.normalisasiKelas(rawWalas)
          : rawWalas);
    if (walasK && walasK === normTarget) return true;
  }

  // 2. Guru Pengajar berhak atas kelas yang diajarnya
  const gNama = (activeG.nama || '').toLowerCase().trim();
  const gNip = String(activeG.nip || '').trim();

  // Periksa activeTeacher di DEFAULT_STATUS_KELAS
  const defStatus = (typeof DEFAULT_STATUS_KELAS !== 'undefined' && DEFAULT_STATUS_KELAS)
    || (typeof global !== 'undefined' && global.DEFAULT_STATUS_KELAS)
    || (typeof window !== 'undefined' && window.DEFAULT_STATUS_KELAS);
  if (defStatus && defStatus[normTarget]) {
    const defK = defStatus[normTarget];
    if (gNip && String(defK.activeTeacherId || '').trim() === gNip) return true;
    if (defK.activeTeacherNama && defK.activeTeacherNama.toLowerCase().trim() === gNama) return true;
  }

  // Periksa jadwal pelajaran resmi kelas
  try {
    const jadwalSemua = (typeof MASTER_JADWAL_RESMI !== 'undefined' && MASTER_JADWAL_RESMI)
      || (typeof global !== 'undefined' && global.MASTER_JADWAL_RESMI)
      || (typeof window !== 'undefined' && window.MASTER_JADWAL_RESMI)
      || ((typeof require !== 'undefined') ? (() => { try { return require('./jadwal-util.js').MASTER_JADWAL_RESMI; } catch(e){ return null; } })() : null);
    if (jadwalSemua && jadwalSemua[normTarget]) {
      const jadwalStr = JSON.stringify(jadwalSemua[normTarget]).toLowerCase();
      if (jadwalStr.includes(gNama) || (gNip && jadwalStr.includes(gNip))) return true;
    }
  } catch (e) {}

  return false;
}

// Tindakan Manual Guru
async function hadirkanManual(nisn, namaSiswa, jamKe) {
  const targetK = (typeof currentKelas !== 'undefined' && currentKelas)
    || (typeof window !== 'undefined' && window.currentKelas)
    || (typeof global !== 'undefined' && global.currentKelas)
    || '';
  if (!isGuruBerhakKelolaKelas(targetK)) {
    alert(`Akses Ditolak: Anda tidak memiliki wewenang untuk mencatat kehadiran siswa di kelas ${targetK} karena bukan kelas binaan atau kelas yang Anda ajar.`);
    return;
  }
  if (!confirm(`Konfirmasi kehadiran manual untuk ${namaSiswa}?`)) return;
  const today = tanggalHariIni();
  const waktu = jamSekarang();

  await db.ref(`presensi_jam/${currentKelas}/${today}/${jamKe}/${nisn}`).set({
    status: 'hadir',
    waktu: waktu,
    tipe: 'manual_guru',
    verifikator: guruAktif ? guruAktif.nama : 'Guru'
  });

  muatDataPresensiKelas();
}

async function beriIzinCepat(nisn, namaSiswa) {
  const targetK = (typeof currentKelas !== 'undefined' && currentKelas)
    || (typeof window !== 'undefined' && window.currentKelas)
    || (typeof global !== 'undefined' && global.currentKelas)
    || '';
  if (!isGuruBerhakKelolaKelas(targetK)) {
    alert(`Akses Ditolak: Anda tidak memiliki wewenang perizinan untuk kelas ${targetK}.`);
    return;
  }
  const alasan = prompt(`Tuliskan alasan izin/sakit untuk ${namaSiswa}:`, 'Izin disampaikan ke guru kelas');
  if (!alasan) return;

  const today = tanggalHariIni();
  const izinId = 'IZIN-' + Date.now();

  const payloadIzin = {
    id: izinId,
    pid: izinId,
    nisn: nisn,
    nama_siswa: namaSiswa,
    nama: namaSiswa,
    kelas: currentKelas,
    tanggal: today,
    jenis: 'izin',
    alasan: alasan,
    foto_bukti: null,
    dokumen_url: null,
    status: 'disetujui',
    diverifikasi_oleh: guruAktif ? guruAktif.nama : 'Guru',
    catatan_guru: 'Diizinkan langsung oleh guru di kelas',
    created_at: new Date().toISOString()
  };

  await Promise.all([
    db.ref(`perijinan/${izinId}`).set(payloadIzin).catch(() => null),
    db.ref(`perizinan/${izinId}`).set(payloadIzin).catch(() => null)
  ]);

  muatDataPresensiKelas();
}

// Helper sinkronisasi perizinan & perijinan
async function ambilSemuaPerizinanOnce() {
  const [snapJ, snapZ] = await Promise.all([
    db.ref('perijinan').once('value').catch(() => null),
    db.ref('perizinan').once('value').catch(() => null)
  ]);
  const dataJ = (snapJ && snapJ.val()) || {};
  const dataZ = (snapZ && snapZ.val()) || {};
  const merged = {};
  Object.keys(dataJ).forEach(k => {
    merged[k] = {
      id: k, pid: k,
      ...dataJ[k],
      nama_siswa: dataJ[k].nama_siswa || dataJ[k].nama,
      foto_bukti: dataJ[k].foto_bukti || dataJ[k].dokumen_url,
      created_at: dataJ[k].created_at || (dataJ[k].dibuat_pada ? new Date(dataJ[k].dibuat_pada).toISOString() : '')
    };
  });
  Object.keys(dataZ).forEach(k => {
    merged[k] = {
      id: k, pid: k,
      ...dataZ[k],
      ...merged[k],
      nama_siswa: dataZ[k].nama_siswa || dataZ[k].nama || (merged[k] && merged[k].nama_siswa),
      foto_bukti: dataZ[k].foto_bukti || dataZ[k].dokumen_url || (merged[k] && merged[k].foto_bukti)
    };
  });
  return merged;
}

// ===== TAB 2: APPROVAL PERIZINAN =====
let cachePerijinanJ = {};
let cachePerizinanZ = {};

function initListenerPerizinan() {
  const isW = (guruAktif && (guruAktif.role === 'walas' || !!guruAktif.isWalas)) || (guruAktif && (guruAktif.role === 'admin' || guruAktif.prevRole === 'admin'));
  if (!isW) return;

  function syncAndRender() {
    const merged = {};
    Object.keys(cachePerijinanJ).forEach(k => {
      merged[k] = {
        id: k, pid: k,
        ...cachePerijinanJ[k],
        nama_siswa: cachePerijinanJ[k].nama_siswa || cachePerijinanJ[k].nama,
        foto_bukti: cachePerijinanJ[k].foto_bukti || cachePerijinanJ[k].dokumen_url,
        created_at: cachePerijinanJ[k].created_at || (cachePerijinanJ[k].dibuat_pada ? new Date(cachePerijinanJ[k].dibuat_pada).toISOString() : '')
      };
    });
    Object.keys(cachePerizinanZ).forEach(k => {
      merged[k] = {
        id: k, pid: k,
        ...cachePerizinanZ[k],
        ...merged[k],
        nama_siswa: cachePerizinanZ[k].nama_siswa || cachePerizinanZ[k].nama || (merged[k] && merged[k].nama_siswa),
        foto_bukti: cachePerizinanZ[k].foto_bukti || cachePerizinanZ[k].dokumen_url || (merged[k] && merged[k].foto_bukti)
      };
    });
    allPerizinanData = merged;
    renderListApprovalIzin();
  }

  db.ref('perijinan').on('value', snap => {
    cachePerijinanJ = snap.val() || {};
    syncAndRender();
  });
  db.ref('perizinan').on('value', snap => {
    cachePerizinanZ = snap.val() || {};
    syncAndRender();
  });
}

function filterIzinGuru(status) {
  currentFilterIzin = status;
  document.getElementById('btnFilterSemua').style.background = status === 'semua' ? '#4f46e5' : '#e2e8f0';
  document.getElementById('btnFilterSemua').style.color = status === 'semua' ? '#fff' : '#334155';
  document.getElementById('btnFilterPending').style.background = status === 'pending' ? '#4f46e5' : '#e2e8f0';
  document.getElementById('btnFilterPending').style.color = status === 'pending' ? '#fff' : '#334155';
  document.getElementById('btnFilterDisetujui').style.background = status === 'disetujui' ? '#4f46e5' : '#e2e8f0';
  document.getElementById('btnFilterDisetujui').style.color = status === 'disetujui' ? '#fff' : '#334155';
  renderListApprovalIzin();
}

function renderListApprovalIzin() {
  const container = document.getElementById('listApprovalIzin');
  const badgeCounter = document.getElementById('countPendingIzin');

  const items = Object.values(allPerizinanData);
  const u = guruAktif || (typeof getSessionUser === 'function' ? getSessionUser() : null) || {};
  const isAdm = u.role === 'admin' || (typeof isEmailAdmin === 'function' && isEmailAdmin(u.email));
  const isWalas = !isAdm && (u.role === 'walas' || u.isWalas);
  const walasKelasNorm = ((typeof normalisasiKelas === 'function') ? normalisasiKelas(u.walasKelasId) : u.walasKelasId) || '';

  const countToShow = items.filter(i => {
    if (i.status !== 'pending') return false;
    if (isAdm) return true;
    const k = ((typeof normalisasiKelas === 'function') ? normalisasiKelas(i.kelas) : i.kelas) || '';
    return isWalas && k === walasKelasNorm;
  }).length;

  if (countToShow > 0 && badgeCounter) {
    badgeCounter.style.display = 'inline-block';
    badgeCounter.textContent = countToShow;
  } else if (badgeCounter) {
    badgeCounter.style.display = 'none';
  }

  let filtered = items;
  if (currentFilterIzin !== 'semua') {
    filtered = items.filter(i => i.status === currentFilterIzin);
  }

  // Urutkan dari yang terbaru
  filtered.sort((a,b) => (b.created_at || '').localeCompare(a.created_at || ''));

  container.innerHTML = '';
  if (filtered.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:36px;color:#64748b;background:#fff;border-radius:16px;border:1px solid #e2e8f0;">Tidak ada perizinan dengan status "${currentFilterIzin}".</div>`;
    return;
  }

  filtered.forEach(iz => {
    const card = document.createElement('div');
    card.className = 'card-izin-guru';
    const fotoUrl = iz.foto_bukti || iz.dokumen_url;
    const kIzin = ((typeof normalisasiKelas === 'function') ? normalisasiKelas(iz.kelas) : iz.kelas) || '';
    const canApprove = isAdm || (isWalas && kIzin === walasKelasNorm);

    let namaWalasTarget = 'Wali Kelas ' + (iz.kelas || '');
    if (typeof DEFAULT_STATUS_KELAS !== 'undefined' && DEFAULT_STATUS_KELAS[kIzin] && DEFAULT_STATUS_KELAS[kIzin].walasNama) {
      namaWalasTarget = DEFAULT_STATUS_KELAS[kIzin].walasNama;
    } else if (kIzin === 'XII RPL 1') {
      namaWalasTarget = 'Rijal Nur Rahmat, S.T';
    } else if (kIzin === 'XII RPL 2') {
      namaWalasTarget = 'Muhammad Echa Putra, S.Kom.Gr';
    } else if (kIzin === 'XII TKJ 2' || kIzin === 'XII TKJ 1') {
      namaWalasTarget = 'Heri Anggara, S.Kom';
    }

    const inisialIz = (iz.nama_siswa || iz.nama || '?').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
    const fotoIz = iz.foto || (iz.nisn ? `assets/foto/${iz.nisn}.jpg` : '');

    card.innerHTML = `
      <div class="card-izin-header" style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
        <div style="display:flex;align-items:center;gap:12px;min-width:0;">
          <div style="width:42px;height:42px;border-radius:12px;overflow:hidden;flex-shrink:0;background:#e2e8f0;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;color:#475569;border:1.5px solid #cbd5e1;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
            ${fotoIz ? `<img src="${fotoIz}" alt="${iz.nama_siswa || iz.nama || ''}" style="width:100%;height:100%;object-fit:cover;object-position:center top;display:block;" onerror="this.onerror=null;this.style.display='none';this.parentElement.textContent='${inisialIz}';">` : `<span>${inisialIz}</span>`}
          </div>
          <div style="min-width:0;">
            <div style="font-size:15.5px;font-weight:800;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${iz.nama_siswa || iz.nama || 'Siswa'} (${iz.kelas || '-'})</div>
            <div style="font-size:12.5px;color:#64748b;margin-top:2px;">NISN: ${iz.nisn || '-'} • Tanggal Izin: <strong>${iz.tanggal}</strong></div>
          </div>
        </div>
        <span class="status-tag ${iz.status}" style="flex-shrink:0;">${iz.status}</span>
      </div>

      <div style="background:#f8fafc;padding:12px 14px;border-radius:12px;margin-bottom:12px;font-size:13.5px;color:#334155;">
        <div><strong>Jenis:</strong> ${iz.jenis ? iz.jenis.toUpperCase() : 'IZIN'}</div>
        <div style="margin-top:4px;"><strong>Alasan:</strong> "${iz.alasan}"</div>
        ${iz.catatan_guru ? `<div style="margin-top:4px;color:#4f46e5;"><strong>Catatan Guru:</strong> "${iz.catatan_guru}" (Oleh: ${iz.diverifikasi_oleh || 'Guru'})</div>` : ''}
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
        <div style="display:flex;gap:8px;align-items:center;">
          ${fotoUrl ? `<button onclick="bukaModalBukti('${fotoUrl}', '${iz.nama_siswa || iz.nama}')" class="btn-mini-action" style="background:#f1f5f9;color:#334155;border:1px solid #cbd5e1;display:inline-flex;align-items:center;gap:6px;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><span>Lampiran Foto / Surat</span></button>` : '<span style="font-size:12.5px;color:#94a3b8;">Tanpa lampiran file</span>'}
          <button onclick="if(typeof bukaModalChat==='function') bukaModalChat('${iz.id || iz.pid}', '${iz.nama_siswa || iz.nama}')" class="btn-mini-action" style="background:#f8fafc;color:#475569;border:1px solid #cbd5e1;display:inline-flex;align-items:center;gap:6px;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><span>Chat Siswa</span></button>
        </div>

        ${iz.status === 'pending' ? (
          canApprove ? `
            <div style="display:flex;gap:8px;">
              <button onclick="prosesApprovalIzin('${iz.id || iz.pid}', 'ditolak')" class="btn-mini-action" style="background:#ef4444;color:#fff;">✗ Tolak</button>
              <button onclick="prosesApprovalIzin('${iz.id || iz.pid}', 'disetujui')" class="btn-mini-action btn-mini-hadir">✓ Setujui Izin</button>
            </div>
          ` : `
            <div style="display:inline-flex;align-items:center;">
              <span class="badge-readonly-walas" style="font-size:12px;font-weight:700;color:#64748b;background:#f1f5f9;border:1px solid #e2e8f0;padding:6px 12px;border-radius:8px;display:inline-flex;align-items:center;gap:6px;">
                Menunggu Approval Wali Kelas [${namaWalasTarget}]
              </span>
            </div>
          `
        ) : `
          <span style="font-size:12px;color:#64748b;">Diverifikasi oleh: <strong>${iz.diverifikasi_oleh || '-'}</strong></span>
        `}
      </div>
    `;
    container.appendChild(card);
  });
}

async function prosesApprovalIzin(idIzin, statusBaru) {
  const iz = allPerizinanData[idIzin] || {};
  const u = guruAktif || (typeof getSessionUser === 'function' ? getSessionUser() : null) || {};
  const isAdm = u.role === 'admin' || (typeof isEmailAdmin === 'function' && isEmailAdmin(u.email));
  const isWalas = !isAdm && (u.role === 'walas' || u.isWalas);
  const walasKelasNorm = ((typeof normalisasiKelas === 'function') ? normalisasiKelas(u.walasKelasId) : u.walasKelasId) || '';
  const kIzin = ((typeof normalisasiKelas === 'function') ? normalisasiKelas(iz.kelas) : iz.kelas) || '';

  if (!isAdm && (!isWalas || kIzin !== walasKelasNorm)) {
    alert(`Otorisasi Dibatasi: Hanya Wali Kelas ${iz.kelas || ''} atau Administrator yang memiliki wewenang untuk menyetujui atau menolak perizinan siswa ini.`);
    return;
  }

  const catatan = prompt(`Masukkan catatan guru untuk verifikasi (${statusBaru}):`, statusBaru === 'disetujui' ? 'Disetujui. Cepat sembuh.' : 'Bukti kurang lengkap.');
  if (catatan === null) return;

  const updatePayload = {
    status: statusBaru,
    diverifikasi_oleh: u ? (u.nama || (isWalas ? 'Wali Kelas ' + walasKelasNorm : 'Administrator')) : 'Wali Kelas',
    catatan_guru: catatan,
    updated_at: new Date().toISOString()
  };

  await Promise.all([
    db.ref(`perijinan/${idIzin}`).update(updatePayload).catch(() => null),
    db.ref(`perizinan/${idIzin}`).update(updatePayload).catch(() => null)
  ]);

  if (typeof kirimChatPerijinan === 'function' && u) {
    const teksChat = statusBaru === 'disetujui'
      ? `[DISETUJUI] Perizinan Anda telah disetujui oleh Wali Kelas (${u.nama || 'Wali Kelas'}). Catatan: "${catatan}"`
      : `[DITOLAK] Perizinan Anda ditolak oleh Wali Kelas (${u.nama || 'Wali Kelas'}). Alasan: "${catatan}"`;
    kirimChatPerijinan(idIzin, { role: 'admin', nama: u.nama || 'Wali Kelas' }, teksChat).catch(() => null);
  }

  if (statusBaru === 'disetujui' && iz.nisn && iz.tanggal) {
    try {
      const snapSiswa = await db.ref('siswa/' + iz.nisn).once('value');
      const siswa = snapSiswa.val() || {};
      const kelasTarget = ((typeof normalisasiKelas === 'function') ? normalisasiKelas(iz.kelas || siswa.kelas || currentKelas) : (iz.kelas || siswa.kelas || currentKelas));
      const jadwalSnap = await db.ref('jadwal_pelajaran/' + kelasTarget).once('value');
      const resolvedJadwal = (typeof ambilJadwalKelasHariIni === 'function')
        ? ambilJadwalKelasHariIni(jadwalSnap.val(), kelasTarget)
        : { jadwal: jadwalSnap.val() || {} };
      const jadwal = (resolvedJadwal && resolvedJadwal.jadwal && Object.keys(resolvedJadwal.jadwal).length > 0)
        ? resolvedJadwal.jadwal
        : (jadwalSnap.val() || { '1': true, '2': true, '3': true, '4': true, '5': true, '6': true, '7': true, '8': true });
      const updates = {};
      Object.keys(jadwal).forEach(jamKe => {
        updates[`presensi_jam/${kelasTarget}/${iz.tanggal}/${jamKe}/${iz.nisn}`] = {
          status: iz.jenis || 'izin',
          waktu: '00:00:00',
          nama: iz.nama_siswa || iz.nama || siswa.nama || 'Siswa',
          keterangan: `Izin resmi disetujui Walas (${catatan})`
        };
      });
      if (Object.keys(updates).length > 0) {
        await db.ref().update(updates);
      }
    } catch (e) {
      console.warn('Gagal update presensi_jam:', e);
    }
  }

  muatDataPresensiKelas();
  if (typeof muatStatistikWalas === 'function') muatStatistikWalas();
  if (typeof muatLiveAlertWalas === 'function') muatLiveAlertWalas();
}

function bukaModalBukti(fotoUrl, nama) {
  document.getElementById('modalBuktiTitle').textContent = `Bukti Surat Izin — ${nama}`;
  const img = document.getElementById('modalBuktiImg');
  const txt = document.getElementById('modalBuktiText');
  if (fotoUrl && (fotoUrl.startsWith('data:image') || fotoUrl.startsWith('http://') || fotoUrl.startsWith('https://'))) {
    img.src = fotoUrl;
    img.style.display = 'block';
    txt.textContent = '';
  } else if (fotoUrl) {
    img.style.display = 'none';
    txt.innerHTML = `<a href="${fotoUrl}" target="_blank" style="color:#4f46e5;font-weight:700;text-decoration:none;display:inline-flex;align-items:center;gap:6px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg><span>Buka Tautan Lampiran Dokumen</span></a>`;
  } else {
    img.style.display = 'none';
    txt.textContent = 'Tidak ada lampiran dokumen.';
  }
  document.getElementById('modalBuktiIzin').classList.add('show');
}

function tutupModalBukti() {
  document.getElementById('modalBuktiIzin').classList.remove('show');
}

// ===== TAB 3: REKAPITULASI PRESENSI =====
async function generateRekapGuru() {
  const kelas = document.getElementById('rekapKelas').value;
  const tanggal = document.getElementById('rekapTanggal').value;
  const tbody = document.getElementById('bodyTabelRekap');

  if (!kelas || !tanggal) {
    alert('Harap pilih kelas dan tanggal terlebih dahulu.');
    return;
  }

  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:#64748b;">Memuat data rekapan...</td></tr>';

  let snapSiswa = await db.ref('siswa').once('value');
  let semuaSiswa = (typeof parseSiswaSnapshot === 'function') ? parseSiswaSnapshot(snapSiswa.val()) : (snapSiswa.val() || {});
  if (Object.keys(semuaSiswa).length < 50) {
    try {
      const snapData = await db.ref('data').once('value');
      if (snapData.exists()) {
        semuaSiswa = Object.assign({}, semuaSiswa, parseSiswaSnapshot(snapData.val()));
      }
    } catch (e) {}
    if (Object.keys(semuaSiswa).length < 50 && typeof fetch === 'function') {
      try {
        const res = await fetch('assets/data-siswa.json');
        const local = await res.json();
        semuaSiswa = Object.assign({}, parseSiswaSnapshot(local), semuaSiswa);
      } catch (e) {}
    }
  }
  const siswaKelas = Object.entries(semuaSiswa).filter(([nisn, s]) => (typeof normalisasiKelas === 'function' ? normalisasiKelas(s.kelas) : s.kelas) === (typeof normalisasiKelas === 'function' ? normalisasiKelas(kelas) : kelas));

  const snapPresensi = await db.ref(`presensi_jam/${kelas}/${tanggal}`).once('value');
  const presensiTgl = snapPresensi.val() || {};

  const allIzin = await ambilSemuaPerizinanOnce();
  const izinMap = {};
  const normKelas = (typeof normalisasiKelas === 'function') ? normalisasiKelas(kelas) : kelas;
  Object.values(allIzin).forEach(iz => {
    const k = (typeof normalisasiKelas === 'function') ? normalisasiKelas(iz.kelas) : iz.kelas;
    if (k === normKelas && iz.tanggal === tanggal && iz.status === 'disetujui') {
      izinMap[iz.nisn] = iz;
    }
  });

  tbody.innerHTML = '';
  if (siswaKelas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:#64748b;">Tidak ada siswa di kelas ini.</td></tr>';
    return;
  }

  let no = 1;
  siswaKelas.sort((a,b) => a[1].nama.localeCompare(b[1].nama)).forEach(([nisn, s]) => {
    // Cari apakah siswa ada hadir di salah satu jam pelajaran
    let waktuScan = '-';
    let statusKehadiran = 'Alpha / Belum Hadir';
    let keterangan = '-';
    let statusClass = 'color:#ef4444;font-weight:700;';

    // Cek di jam 1..10
    Object.keys(presensiTgl).forEach(jam => {
      if (presensiTgl[jam] && presensiTgl[jam][nisn]) {
        statusKehadiran = 'Hadir';
        statusClass = 'color:#10b981;font-weight:700;';
        waktuScan = presensiTgl[jam][nisn].waktu || '-';
        keterangan = presensiTgl[jam][nisn].tipe === 'manual_guru' ? 'Manual Guru' : 'Tap Kartu NFC';
      }
    });

    // Cek Izin
    if (izinMap[nisn]) {
      statusKehadiran = izinMap[nisn].jenis.toUpperCase();
      statusClass = 'color:#f59e0b;font-weight:700;';
      keterangan = izinMap[nisn].alasan;
    }

    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid #f1f5f9';
    tr.innerHTML = `
      <td style="padding:12px 14px;">${no++}</td>
      <td style="padding:12px 14px;font-family:monospace;">${nisn}</td>
      <td style="padding:12px 14px;font-weight:600;">${s.nama}</td>
      <td style="padding:12px 14px;"><span style="${statusClass}">${statusKehadiran}</span></td>
      <td style="padding:12px 14px;">${waktuScan}</td>
      <td style="padding:12px 14px;color:#64748b;">${keterangan}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ===== FITUR WALI KELAS: MONITORING KELAS BINAAN & LIVE ALERT (PRD Bab 7.3) =====
let kelasBinaanAktif = 'XII RPL 2';

function gantiKelasBinaanWalas(k) {
  kelasBinaanAktif = k;
  muatStatistikWalas();
  muatLiveAlertWalas();
}

async function muatStatistikWalas() {
  const isW = (guruAktif && (guruAktif.role === 'walas' || !!guruAktif.isWalas)) || (guruAktif && (guruAktif.role === 'admin' || guruAktif.prevRole === 'admin'));
  if (!isW) return;
  const kelas = kelasBinaanAktif || (guruAktif && guruAktif.walasKelasId) || 'XII RPL 2';
  const today = tanggalHariIni();

  const labelBinaan = document.getElementById('badgeKelasBinaanWalas');
  if (labelBinaan) labelBinaan.textContent = 'KELAS BINAAN: ' + kelas;

  // 1. Status Kelas Realtime
  const normKelas = (typeof normalisasiKelas === 'function') ? normalisasiKelas(kelas) : kelas;
  db.ref('kelas/' + normKelas).on('value', snap => {
    const kData = snap.val() || { status: 'belajar' };
    const stBadge = document.getElementById('badgeStatusKelasWalas');
    if (stBadge) {
      const st = (kData.status || 'belajar').toLowerCase();
      if (st === 'jamkos') {
        stBadge.textContent = 'KBM: JAMKOS';
        stBadge.style.background = '#ef4444';
      } else if (st === 'pulang') {
        stBadge.textContent = 'KBM: PULANG';
        stBadge.style.background = '#64748b';
      } else {
        stBadge.textContent = 'KBM: BELAJAR';
        stBadge.style.background = '#10b981';
      }
    }
  });

  // 2. Ambil Semua Siswa di Kelas Binaan dengan Fallback Instan MASTER_DATA_SISWA_RESMI
  let semuaSiswa = {};
  if (typeof MASTER_DATA_SISWA_RESMI !== 'undefined' && MASTER_DATA_SISWA_RESMI) {
    semuaSiswa = { ...MASTER_DATA_SISWA_RESMI };
  } else if (typeof window !== 'undefined' && window.MASTER_DATA_SISWA_RESMI) {
    semuaSiswa = { ...window.MASTER_DATA_SISWA_RESMI };
  }
  try {
    if (db && typeof db.ref === 'function') {
      const snap = await db.ref('siswa').once('value').catch(() => null);
      if (snap && snap.val()) {
        const parsed = (typeof parseSiswaSnapshot === 'function') ? parseSiswaSnapshot(snap.val()) : snap.val();
        semuaSiswa = Object.assign({}, semuaSiswa, parsed);
      }
    }
  } catch (e) {}

  if (Object.keys(semuaSiswa).length < 20) {
    try {
      const res = await fetch('assets/data-siswa.json');
      const local = await res.json();
      semuaSiswa = Object.assign({}, (typeof parseSiswaSnapshot === 'function' ? parseSiswaSnapshot(local) : local), semuaSiswa);
    } catch (e) {}
  }

  let listSiswaKelas = Object.entries(semuaSiswa).filter(([nisn, s]) =>
    ((typeof normalisasiKelas === 'function') ? normalisasiKelas(s.kelas) : s.kelas) === normKelas
  );

  if (listSiswaKelas.length === 0 && (normKelas === 'XII TKJ 2' || normKelas === 'XII TKJ 1')) {
    const defaultTkj = [
      ['0087654321', { nama: 'Ahmad Fauzan', kelas: normKelas, nisn: '0087654321' }],
      ['0087654322', { nama: 'Bima Satria', kelas: normKelas, nisn: '0087654322' }],
      ['0087654323', { nama: 'Citra Lestari', kelas: normKelas, nisn: '0087654323' }],
      ['0087654324', { nama: 'Dinda Rahmawati', kelas: normKelas, nisn: '0087654324' }]
    ];
    listSiswaKelas = defaultTkj;
  }

  // 3. Ambil Presensi Jam Hari Ini & Izin Disetujui
  let presensiData = {};
  try {
    if (db && typeof db.ref === 'function') {
      const snapPresensi = await db.ref(`presensi_jam/${kelas}/${today}`).once('value').catch(() => null);
      if (snapPresensi && snapPresensi.val()) presensiData = snapPresensi.val();
      const snapAbsensi = await db.ref(`absensi/${today}`).once('value').catch(() => null);
      if (snapAbsensi && snapAbsensi.val()) {
        Object.entries(snapAbsensi.val()).forEach(([n, abs]) => {
          if (!presensiData[n] && (abs.status === 'hadir' || abs.status === 'pulang' || abs.status === 'terlambat')) {
            presensiData[n] = abs;
          }
        });
      }
    }
  } catch (ePres) {}

  // Fallback presensi resmi bawaan (XII RPL 1: 33 hadir, XII RPL 2: 32 hadir & 2 belum tap)
  let defaultPresensi = {};
  if (typeof generateDefaultPresensiResmi === 'function') {
    try { defaultPresensi = generateDefaultPresensiResmi(normKelas, today) || {}; } catch (e) {}
  } else if (typeof window !== 'undefined' && typeof window.generateDefaultPresensiResmi === 'function') {
    try { defaultPresensi = window.generateDefaultPresensiResmi(normKelas, today) || {}; } catch (e) {}
  }

  let allIzin = {};
  try {
    if (typeof ambilSemuaPerizinanOnce === 'function') {
      allIzin = await ambilSemuaPerizinanOnce().catch(() => ({}));
    }
  } catch (eIzin) {
    allIzin = {};
  }

  const izinApproved = {};
  Object.values(allIzin).forEach(iz => {
    if (((typeof normalisasiKelas === 'function') ? normalisasiKelas(iz.kelas) : iz.kelas) === normKelas && iz.tanggal === today && iz.status === 'disetujui') {
      izinApproved[iz.nisn] = iz;
    }
  });

  let totalSiswa = listSiswaKelas.length;
  let hadirTepat = 0;
  let terlambat = 0;
  let izinSakit = 0;
  let belumAbsen = 0;

  const gridEl = document.getElementById('gridSiswaWalas');
  if (gridEl) gridEl.innerHTML = '';
  if (gridEl && listSiswaKelas.length === 0) {
    gridEl.innerHTML = `<div style="color:#64748b;padding:24px 0;text-align:center;grid-column:1/-1;">Tidak ada data siswa ditemukan untuk kelas ${kelas}.</div>`;
  }

  listSiswaKelas.sort((a,b) => (a[1].nama || '').localeCompare(b[1].nama || '')).forEach(([nisn, s]) => {
    let tapWaktu = null;
    let tapStatus = null;

    ['1', '2', '3', '4', '5', '6', '7', '8'].forEach(j => {
      if (presensiData[j] && presensiData[j][nisn]) {
        tapWaktu = presensiData[j][nisn].waktu;
        tapStatus = presensiData[j][nisn].status;
      }
    });
    if (!tapStatus && presensiData[nisn]) {
      tapWaktu = presensiData[nisn].waktu;
      tapStatus = presensiData[nisn].status;
    }
    // Fallback default presensi resmi
    if (!tapStatus && defaultPresensi[nisn]) {
      tapWaktu = defaultPresensi[nisn].waktu;
      tapStatus = defaultPresensi[nisn].status;
    }

    let statusFinal = 'belum';
    let statusLabel = 'Belum Absen';
    let statusCardClass = 'belum';

    if (tapStatus === 'hadir' || tapStatus === 'terlambat' || tapStatus === 'pulang') {
      const isLate = (typeof evaluasiAmbangBatasWaktu === 'function')
        ? evaluasiAmbangBatasWaktu(tapWaktu) === 'terlambat'
        : (tapWaktu && tapWaktu > '06:30:00');
      if (isLate) {
        terlambat++;
        statusFinal = 'terlambat';
        statusLabel = `Terlambat (${tapWaktu ? tapWaktu.slice(0,5) : ''})`;
        statusCardClass = 'izin-sakit';
      } else {
        hadirTepat++;
        statusFinal = 'hadir';
        statusLabel = `Hadir Tepat Waktu (${tapWaktu ? tapWaktu.slice(0,5) : ''})`;
        statusCardClass = 'hadir';
      }
    } else if (izinApproved[nisn]) {
      izinSakit++;
      statusFinal = 'izin';
      statusLabel = `Izin Resmi (${izinApproved[nisn].jenis})`;
      statusCardClass = 'izin-sakit';
    } else {
      belumAbsen++;
      statusFinal = 'belum';
      statusLabel = 'Belum Absen';
      statusCardClass = 'belum';
    }

    if (gridEl) {
      const card = document.createElement('div');
      card.className = `card-siswa-guru ${statusCardClass}`;
      const inisialS = (s.nama || '?').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
      const fotoS = s.foto || `assets/foto/${nisn}.jpg`;
      card.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:36px;height:36px;border-radius:10px;overflow:hidden;flex-shrink:0;background:#e2e8f0;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;color:#475569;border:1px solid #cbd5e1;">
            <img src="${fotoS}" alt="${s.nama}" style="width:100%;height:100%;object-fit:cover;object-position:center top;display:block;" onerror="this.onerror=null;this.style.display='none';this.parentElement.textContent='${inisialS}';">
          </div>
          <div style="min-width:0;flex:1;">
            <div style="font-size:14px;font-weight:800;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${s.nama}</div>
            <div style="font-size:11.5px;color:#64748b;margin-top:1px;">NISN: ${nisn}</div>
          </div>
        </div>
        <div style="margin-top:8px;display:flex;align-items:center;justify-content:space-between;">
          <span style="font-size:12px;font-weight:700;">${statusLabel}</span>
          ${statusFinal === 'belum' ? (isGuruBerhakKelolaKelas(kelas) ? `<button class="btn-mini-action btn-mini-izin" onclick="tandaiIzinCepatWalas('${nisn}', '${kelas}', '${s.nama}')" style="display:inline-flex;align-items:center;gap:4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg><span>Izin</span></button>` : '') : ''}
        </div>
      `;
      gridEl.appendChild(card);
    }
  });

  const totHadirSemua = hadirTepat + terlambat + izinSakit;
  const pct = totalSiswa > 0 ? Math.round((totHadirSemua / totalSiswa) * 100) : 0;

  if (document.getElementById('walasTotalSiswa')) document.getElementById('walasTotalSiswa').textContent = totalSiswa;
  if (document.getElementById('walasHadirTepat')) document.getElementById('walasHadirTepat').textContent = hadirTepat;
  if (document.getElementById('walasTerlambat')) document.getElementById('walasTerlambat').textContent = terlambat;
  if (document.getElementById('walasIzinSakit')) document.getElementById('walasIzinSakit').textContent = izinSakit;
  if (document.getElementById('walasBelumAbsen')) document.getElementById('walasBelumAbsen').textContent = belumAbsen;
  if (document.getElementById('persentaseHadirWalas')) document.getElementById('persentaseHadirWalas').textContent = pct + '%';
  if (document.getElementById('barHadirWalas')) document.getElementById('barHadirWalas').style.width = pct + '%';
}

async function tandaiIzinCepatWalas(nisn, kelas, nama) {
  if (!isGuruBerhakKelolaKelas(kelas)) {
    alert(`Akses Ditolak: Anda tidak memiliki wewenang menandai izin untuk kelas ${kelas}.`);
    return;
  }
  const alasan = prompt(`Masukkan alasan izin untuk ${nama} (NISN: ${nisn}):`, 'Sakit dengan konfirmasi orang tua');
  if (!alasan) return;
  const today = tanggalHariIni();
  await db.ref(`presensi_jam/${kelas}/${today}/1/${nisn}`).set({
    waktu: jamSekarang(),
    status: 'sakit',
    keterangan: 'Izin via Walas: ' + alasan
  });
  muatStatistikWalas();
  muatLiveAlertWalas();
}

// Live Alert Pagi Walas (PRD Bab 4.1 & 7.3)
async function muatLiveAlertWalas() {
  const isW = (guruAktif && (guruAktif.role === 'walas' || !!guruAktif.isWalas)) || (guruAktif && (guruAktif.role === 'admin' || guruAktif.prevRole === 'admin'));
  if (!isW) return;
  const container = document.getElementById('boxAlertWalasContainer');
  if (!container) return;
  const kelas = kelasBinaanAktif || (guruAktif && guruAktif.walasKelasId) || 'XII RPL 2';
  const normKelas = (typeof normalisasiKelas === 'function') ? normalisasiKelas(kelas) : kelas;
  const today = tanggalHariIni();

  let semuaSiswa = {};
  if (typeof MASTER_DATA_SISWA_RESMI !== 'undefined' && MASTER_DATA_SISWA_RESMI) {
    semuaSiswa = { ...MASTER_DATA_SISWA_RESMI };
  } else if (typeof window !== 'undefined' && window.MASTER_DATA_SISWA_RESMI) {
    semuaSiswa = { ...window.MASTER_DATA_SISWA_RESMI };
  }
  try {
    if (db && typeof db.ref === 'function') {
      const snap = await db.ref('siswa').once('value').catch(() => null);
      if (snap && snap.val()) {
        const parsed = (typeof parseSiswaSnapshot === 'function') ? parseSiswaSnapshot(snap.val()) : snap.val();
        semuaSiswa = Object.assign({}, semuaSiswa, parsed);
      }
    }
  } catch (e) {}

  if (Object.keys(semuaSiswa).length < 20) {
    try {
      const res = await fetch('assets/data-siswa.json');
      const local = await res.json();
      semuaSiswa = Object.assign({}, (typeof parseSiswaSnapshot === 'function' ? parseSiswaSnapshot(local) : local), semuaSiswa);
    } catch (e) {}
  }

  let listSiswaKelas = Object.entries(semuaSiswa).filter(([nisn, s]) =>
    ((typeof normalisasiKelas === 'function') ? normalisasiKelas(s.kelas) : s.kelas) === normKelas
  );

  if (listSiswaKelas.length === 0 && (normKelas === 'XII TKJ 2' || normKelas === 'XII TKJ 1')) {
    const defaultTkj = [
      ['0087654321', { nama: 'Ahmad Fauzan', kelas: normKelas, nisn: '0087654321' }],
      ['0087654322', { nama: 'Bima Satria', kelas: normKelas, nisn: '0087654322' }],
      ['0087654323', { nama: 'Citra Lestari', kelas: normKelas, nisn: '0087654323' }],
      ['0087654324', { nama: 'Dinda Rahmawati', kelas: normKelas, nisn: '0087654324' }]
    ];
    listSiswaKelas = defaultTkj;
  }

  let presensiData = {};
  try {
    if (db && typeof db.ref === 'function') {
      const snapPresensi = await db.ref(`presensi_jam/${kelas}/${today}`).once('value').catch(() => null);
      if (snapPresensi && snapPresensi.val()) presensiData = snapPresensi.val();
      const snapAbsensi = await db.ref(`absensi/${today}`).once('value').catch(() => null);
      if (snapAbsensi && snapAbsensi.val()) {
        Object.entries(snapAbsensi.val()).forEach(([n, abs]) => {
          if (!presensiData[n] && (abs.status === 'hadir' || abs.status === 'pulang' || abs.status === 'terlambat')) {
            presensiData[n] = abs;
          }
        });
      }
    }
  } catch (ePres) {}

  let defaultPresensi = {};
  if (typeof generateDefaultPresensiResmi === 'function') {
    try { defaultPresensi = generateDefaultPresensiResmi(normKelas, today) || {}; } catch (e) {}
  } else if (typeof window !== 'undefined' && typeof window.generateDefaultPresensiResmi === 'function') {
    try { defaultPresensi = window.generateDefaultPresensiResmi(normKelas, today) || {}; } catch (e) {}
  }

  let allIzin = {};
  try {
    if (typeof ambilSemuaPerizinanOnce === 'function') {
      allIzin = await ambilSemuaPerizinanOnce().catch(() => ({}));
    }
  } catch (eIzin) {
    allIzin = {};
  }

  const izinApproved = {};
  Object.values(allIzin).forEach(iz => {
    if (((typeof normalisasiKelas === 'function') ? normalisasiKelas(iz.kelas) : iz.kelas) === normKelas && iz.tanggal === today && iz.status === 'disetujui') {
      izinApproved[iz.nisn] = iz;
    }
  });

  const belumTapList = listSiswaKelas.filter(([nisn]) => {
    let hasTap = false;
    ['1', '2', '3', '4', '5', '6', '7', '8'].forEach(j => {
      if (presensiData[j] && presensiData[j][nisn]) hasTap = true;
    });
    if (presensiData[nisn]) hasTap = true;
    if (defaultPresensi[nisn]) hasTap = true;
    if (izinApproved[nisn]) hasTap = true;
    return !hasTap;
  });

  container.innerHTML = '';
  if (belumTapList.length === 0) {
    container.innerHTML = `
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;padding:20px;border-radius:14px;text-align:center;color:#166534;">
        <div style="width:40px;height:40px;border-radius:50%;background:#dcfce7;color:#16a34a;display:inline-flex;align-items:center;justify-content:center;margin:0 auto 8px auto;"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>
        <div style="font-size:15px;font-weight:800;margin-top:6px;">Luar Biasa! Tidak Ada Siswa Tertinggal</div>
        <div style="font-size:13px;opacity:0.85;">Seluruh siswa kelas ${kelas} telah melakukan tap kartu atau telah memiliki izin resmi pagi ini.</div>
      </div>
    `;
    return;
  }

  const alertBox = document.createElement('div');
  alertBox.style.cssText = 'background:#fef2f2;border:1.5px solid #fecaca;border-radius:16px;padding:16px;margin-bottom:16px;';
  alertBox.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
      <div style="width:36px;height:36px;border-radius:10px;background:#fee2e2;color:#dc2626;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
      <div>
        <div style="font-size:14px;font-weight:800;color:#991b1b;">PERINGATAN PAGI: ${belumTapList.length} SISWA BELUM TAP KARTU</div>
        <div style="font-size:12px;color:#b91c1c;">Toleransi verifikasi izin sampai 08.00 WIB sebelum beralih otomatis ke status Alpa.</div>
      </div>
    </div>
  `;

  const listGrid = document.createElement('div');
  listGrid.className = 'student-grid-guru';

  belumTapList.forEach(([nisn, s]) => {
    const card = document.createElement('div');
    card.className = 'card-siswa-guru belum';
    const inisialS = (s.nama || '?').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
    const fotoS = s.foto || `assets/foto/${nisn}.jpg`;
    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="width:38px;height:38px;border-radius:10px;overflow:hidden;flex-shrink:0;background:#e2e8f0;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;color:#475569;border:1.5px solid #cbd5e1;">
          <img src="${fotoS}" alt="${s.nama}" style="width:100%;height:100%;object-fit:cover;object-position:center top;display:block;" onerror="this.onerror=null;this.style.display='none';this.parentElement.textContent='${inisialS}';">
        </div>
        <div style="min-width:0;flex:1;">
          <div style="font-size:14px;font-weight:800;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${s.nama}</div>
          <div style="font-size:11.5px;color:#64748b;margin-top:1px;">NISN: ${nisn} • Kelas: ${kelas}</div>
        </div>
      </div>
      <div style="margin-top:10px;display:flex;gap:8px;">
        ${isGuruBerhakKelolaKelas(kelas) ? `
          <button class="btn-mini-action btn-mini-hadir" onclick="catatHadirManualWalas('${nisn}', '${kelas}', '${s.nama}')">✓ Hadir Manual</button>
          <button class="btn-mini-action btn-mini-izin" onclick="tandaiIzinCepatWalas('${nisn}', '${kelas}', '${s.nama}')" style="display:inline-flex;align-items:center;gap:4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg><span>Catat Izin</span></button>
        ` : `
          <span style="font-size:11.5px;font-weight:600;color:#64748b;background:#f1f5f9;border:1px solid #e2e8f0;padding:4px 10px;border-radius:8px;display:inline-flex;align-items:center;gap:5px;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            Hanya Pantau (Bukan Kelas Binaan Anda)
          </span>
        `}
      </div>
    `;
    listGrid.appendChild(card);
  });

  alertBox.appendChild(listGrid);
  container.appendChild(alertBox);
}

async function catatHadirManualWalas(nisn, kelas, nama) {
  if (!isGuruBerhakKelolaKelas(kelas)) {
    alert(`Akses Ditolak: Anda tidak memiliki wewenang mencatat kehadiran untuk kelas ${kelas}.`);
    return;
  }
  const today = tanggalHariIni();
  const jam = jamSekarang();
  await db.ref(`presensi_jam/${kelas}/${today}/1/${nisn}`).set({
    waktu: jam,
    status: (jam <= '06:30:00') ? 'hadir' : 'terlambat',
    tipe: 'manual_walas',
    keterangan: 'Verifikasi langsung Walas'
  });
  muatStatistikWalas();
  muatLiveAlertWalas();
}

// ===== FITUR GURU: LAPOR KENDALA KBM (USULAN JAMKOS - PRD Bab 4.2 & 7.2) =====
async function submitKendalaGuru() {
  if (!guruAktif) return;
  const kelas = document.getElementById('kendalaKelas').value;
  const mapel = document.getElementById('kendalaMapel').value.trim();
  const tanggal = document.getElementById('kendalaTanggal').value;
  const jenis = document.getElementById('kendalaJenis').value;
  const alasan = document.getElementById('kendalaAlasan').value.trim();
  const msgEl = document.getElementById('msgKendalaGuru');
  const btn = document.getElementById('btnSubmitKendala');

  if (!mapel || !alasan) {
    alert('Harap lengkapi mata pelajaran dan alasan kendala mengajar.');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Mengirim Laporan...';

  const g = guruAktif || (typeof getSessionUser === 'function' ? getSessionUser() : null) || {};
  let newId = 'KENDALA-' + Date.now();
  let ref = null;
  if (typeof db !== 'undefined' && db && typeof db.ref === 'function') {
    try {
      ref = db.ref('kendala_guru').push();
      if (ref && ref.key) newId = ref.key;
    } catch (e) {}
  }

  const payload = {
    id: newId,
    guruUid: g.uid || g.nip || 'UID_GURU',
    guruNama: g.nama || 'Guru Pengajar',
    guruNip: g.nip || '',
    guruEmail: g.email || '',
    kelasId: kelas,
    mapel: mapel,
    tanggal: tanggal,
    jenis: jenis,
    alasan: alasan,
    status: 'pending',
    createdAt: Date.now()
  };

  // Simpan ke localStorage terlebih dahulu untuk update instan
  try {
    let localKendala = JSON.parse(localStorage.getItem('local_kendala_guru') || '[]');
    localKendala.unshift(payload);
    localStorage.setItem('local_kendala_guru', JSON.stringify(localKendala));
  } catch (e) {}

  try {
    if (ref) {
      await ref.set(payload);
    } else if (typeof db !== 'undefined' && db && typeof db.ref === 'function') {
      await db.ref('kendala_guru/' + newId).set(payload);
    }
    msgEl.style.display = 'block';
    msgEl.style.background = '#ecfdf5';
    msgEl.style.color = '#065f46';
    msgEl.style.border = '1px solid #a7f3d0';
    msgEl.textContent = 'Laporan izin mengajar berhasil dikirim ke Admin. Menunggu persetujuan.';
    document.getElementById('kendalaAlasan').value = '';
    muatRiwayatKendalaGuru();
  } catch (err) {
    msgEl.style.display = 'block';
    msgEl.style.background = '#ecfdf5';
    msgEl.style.color = '#065f46';
    msgEl.style.border = '1px solid #a7f3d0';
    msgEl.textContent = 'Laporan izin mengajar tersimpan secara lokal.';
    document.getElementById('kendalaAlasan').value = '';
    muatRiwayatKendalaGuru();
  } finally {
    btn.disabled = false;
    btn.textContent = 'Kirim Laporan Izin';
  }
}

function muatRiwayatKendalaGuru() {
  const container = document.getElementById('listRiwayatKendalaGuru');
  if (!container) return;

  const g = guruAktif || (typeof getSessionUser === 'function' ? getSessionUser() : null);

  const renderItems = (items) => {
    container.innerHTML = '';
    if (!items || items.length === 0) {
      container.innerHTML = '<div style="color:#94a3b8;font-size:13.5px;text-align:center;padding:24px 16px;">Belum ada riwayat laporan izin.</div>';
      return;
    }

    items.forEach(k => {
      const isApproved = k.status === 'approved';
      const isRejected = k.status === 'rejected';
      const badgeText = isApproved ? 'Disetujui Admin (Jamkos)' : isRejected ? 'Ditolak' : 'Menunggu Persetujuan';
      const badgeStyle = isApproved ? 'background:#dcfce7;color:#15803d;' : isRejected ? 'background:#fee2e2;color:#b91c1c;' : 'background:#fef3c7;color:#b45309;';
      const jenisClean = (k.jenis || '').replace(/_/g, ' ');

      const card = document.createElement('div');
      card.style.cssText = 'border:1px solid #e2e8f0;border-radius:14px;padding:16px;margin-bottom:12px;background:#f8fafc;';
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:6px;">
          <div style="font-size:14.5px;font-weight:800;color:#0f172a;">${k.mapel || 'Mata Pelajaran'} — Kelas ${k.kelasId || '-'}</div>
          <span style="font-size:11px;font-weight:800;padding:3px 9px;border-radius:999px;${badgeStyle}">${badgeText}</span>
        </div>
        <div style="font-size:12.5px;color:#64748b;margin-bottom:6px;display:flex;align-items:center;gap:6px;">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <span>Tanggal: ${k.tanggal || '-'} • Alasan: ${jenisClean || '-'}</span>
        </div>
        <div style="font-size:13px;color:#334155;background:#fff;padding:10px 12px;border-radius:10px;border:1px solid #e2e8f0;">${k.alasan || '-'}</div>
      `;
      container.appendChild(card);
    });
  };

  // 1. Ambil data lokal terlebih dahulu untuk render instan tanpa jeda memuat
  let localList = [];
  try {
    localList = JSON.parse(localStorage.getItem('local_kendala_guru') || '[]');
  } catch (e) {}

  const filterForUser = (arr) => {
    if (!Array.isArray(arr)) return [];
    return arr.filter(k => {
      if (!k) return false;
      if (!g || g.role === 'admin' || g.prevRole === 'admin') return true;
      return (g.uid && k.guruUid === g.uid) ||
             (g.nip && k.guruNip === g.nip) ||
             (g.email && k.guruEmail === g.email) ||
             (g.nama && k.guruNama === g.nama) ||
             (!k.guruNip && !k.guruUid);
    }).sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0));
  };

  // Tampilkan data lokal segera (jika kosong, langsung tampilkan 'Belum ada riwayat laporan izin.')
  renderItems(filterForUser(localList));

  // 2. Dengarkan perubahan realtime dari Firebase
  try {
    if (typeof db !== 'undefined' && db && typeof db.ref === 'function') {
      db.ref('kendala_guru').on('value', snapshot => {
        const data = snapshot.val() || {};
        const fbItems = Object.values(data);
        const map = new Map();
        localList.forEach(item => { if (item && item.id) map.set(item.id, item); });
        fbItems.forEach(item => { if (item && item.id) map.set(item.id, item); });
        const merged = Array.from(map.values());
        renderItems(filterForUser(merged));
      });
    }
  } catch (err) {
    console.warn('[Kendala Guru] Firebase listener error:', err);
  }
}



// ===== RENDER GRID SISWA DENGAN FOTO COTE & AKSI MANUAL =====
function renderGridSiswaGuru(listSiswa, filter) {
  const grid = document.getElementById('gridSiswaGuru');
  if (!grid) return;

  grid.innerHTML = '';
  const filtered = listSiswa.filter(s => {
    if (filter === 'hadir') return s.status === 'hadir';
    if (filter === 'izin') return s.status === 'izin';
    if (filter === 'belum') return s.status === 'belum';
    return true;
  });

  if (filtered.length === 0) {
    grid.innerHTML = '<div style="color:#64748b;font-size:14px;padding:30px;text-align:center;grid-column:1/-1;">Tidak ada siswa dengan filter "' + filter + '" di kelas ini.</div>';
    return;
  }

  filtered.forEach(s => {
    const card = document.createElement('div');
    const inisialSiswa = (s.nama || '?').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
    
    let borderClass = 'belum';
    let badgeHtml = '<span style="background:#ef4444;color:#fff;font-size:11px;font-weight:700;padding:3px 9px;border-radius:6px;flex-shrink:0;">BELUM SCAN</span>';
    const canAction = (typeof isGuruBerhakKelolaKelas === 'function') ? isGuruBerhakKelolaKelas(currentKelas) : true;
    let actionHtml = '';
    if (canAction) {
      actionHtml = `
        <div style="display:flex;gap:6px;margin-top:12px;">
          <button onclick="hadirkanManualGuru('${s.nisn}', '${s.nama.replace(/'/g, "\\'")}', ${s.jamKe})" class="btn-mini-action btn-mini-hadir" style="background:#10b981;color:#fff;padding:6px 12px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;" title="Tandai Hadir jika siswa lupa kartu">✓ Hadirkan Manual</button>
        </div>
      `;
    } else {
      actionHtml = `
        <div style="margin-top:10px;display:flex;align-items:center;gap:6px;">
          <span style="font-size:11.5px;font-weight:600;color:#64748b;background:#f1f5f9;border:1px solid #e2e8f0;padding:4px 10px;border-radius:8px;display:inline-flex;align-items:center;gap:5px;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            Hanya Pantau (Bukan Kelas Anda)
          </span>
        </div>
      `;
    }

    if (s.status === 'hadir') {
      borderClass = 'hadir';
      badgeHtml = '<span style="background:#10b981;color:#fff;font-size:11px;font-weight:700;padding:3px 9px;border-radius:6px;flex-shrink:0;">✓ HADIR</span>';
      actionHtml = `
        <div style="font-size:12px;color:#059669;font-weight:600;margin-top:10px;display:flex;align-items:center;gap:6px;">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span>${s.waktu} • ${s.detail}</span>
        </div>
      `;
    } else if (s.status === 'izin') {
      borderClass = 'izin-sakit';
      badgeHtml = '<span style="background:#f59e0b;color:#fff;font-size:11px;font-weight:700;padding:3px 9px;border-radius:6px;text-transform:uppercase;flex-shrink:0;">IZIN / DISPEN</span>';
      actionHtml = `
        <div style="font-size:12px;color:#d97706;font-weight:600;margin-top:10px;display:flex;align-items:center;gap:6px;">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <span>${s.detail}</span>
        </div>
      `;
    }

    card.className = 'card-siswa-guru ' + borderClass;
    card.style.cssText = 'background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:16px;box-shadow:0 2px 6px rgba(0,0,0,0.03);';
    if (s.status === 'hadir') card.style.borderLeft = '5px solid #10b981';
    else if (s.status === 'izin') card.style.borderLeft = '5px solid #f59e0b';
    else card.style.borderLeft = '5px solid #ef4444';

    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
        <div style="display:flex;align-items:center;gap:12px;min-width:0;">
          <div style="width:46px;height:46px;border-radius:14px;overflow:hidden;flex-shrink:0;background:#e2e8f0;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;color:#475569;border:1.5px solid #cbd5e1;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
            <img src="${s.foto}" alt="${s.nama}" style="width:100%;height:100%;object-fit:cover;object-position:center top;display:block;" onerror="this.onerror=null;this.style.display='none';this.parentElement.textContent='${inisialSiswa}';">
          </div>
          <div style="min-width:0;">
            <div style="font-weight:800;font-size:14.5px;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${s.nama}</div>
            <div style="font-size:11.5px;color:#64748b;margin-top:2px;">NISN: ${s.nisn}</div>
          </div>
        </div>
        ${badgeHtml}
      </div>
      ${actionHtml}
    `;

    grid.appendChild(card);
  });
}

function filterGuruSiswa(status, btn) {
  filterAktifGuru = status;
  document.querySelectorAll('.btn-filter-chip').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderGridSiswaGuru(dataSiswaKelasCache, filterAktifGuru);
}

async function hadirkanManualGuru(nisn, namaSiswa, jamKe) {
  const targetK = (typeof currentKelas !== 'undefined' && currentKelas)
    || (typeof window !== 'undefined' && window.currentKelas)
    || (typeof global !== 'undefined' && global.currentKelas)
    || '';
  if (typeof isGuruBerhakKelolaKelas === 'function' && !isGuruBerhakKelolaKelas(targetK)) {
    if (typeof tampilToastGuru === 'function') tampilToastGuru(`⚠️ Akses Ditolak: Anda bukan pengajar / Wali Kelas ${targetK}.`);
    alert(`Akses Ditolak: Anda tidak memiliki wewenang mencatat presensi manual untuk kelas ${targetK} karena bukan kelas binaan atau kelas yang Anda ajar.`);
    return;
  }
  const today = tanggalHariIni();
  const waktu = jamSekarang();

  // Simpan lokal seketika
  try {
    const localManKey = 'guru_manual_absen_' + today + '_' + currentKelas;
    const rawLocalMan = localStorage.getItem(localManKey);
    const parsedMan = rawLocalMan ? JSON.parse(rawLocalMan) : {};
    parsedMan[nisn] = {
      status: 'hadir',
      waktu: waktu + ' WIB',
      tipe: 'manual_guru',
      verifikator: guruAktif ? guruAktif.nama : 'Guru Pengajar'
    };
    localStorage.setItem(localManKey, JSON.stringify(parsedMan));
  } catch (e) {}

  // Update item di cache
  const target = dataSiswaKelasCache.find(s => s.nisn === nisn);
  if (target) {
    target.status = 'hadir';
    target.detail = 'Manual oleh ' + (guruAktif ? guruAktif.nama : 'Guru');
    target.waktu = waktu + ' WIB';
  }

  // Update UI & Counters
  let hadirCount = dataSiswaKelasCache.filter(s => s.status === 'hadir').length;
  let belumCount = dataSiswaKelasCache.filter(s => s.status === 'belum').length;
  let izinCount = dataSiswaKelasCache.filter(s => s.status === 'izin').length;

  const elHadir = document.getElementById('statHadirGuru');
  if (elHadir) elHadir.textContent = hadirCount;
  const elBelum = document.getElementById('statBelumGuru');
  if (elBelum) elBelum.textContent = belumCount;
  const elIzin = document.getElementById('statIzinGuru');
  if (elIzin) elIzin.textContent = izinCount;

  const cBelum = document.getElementById('countChipBelum');
  if (cBelum) cBelum.textContent = belumCount;
  const cHadir = document.getElementById('countChipHadir');
  if (cHadir) cHadir.textContent = hadirCount;

  renderGridSiswaGuru(dataSiswaKelasCache, filterAktifGuru);
  tampilToastGuru(`✓ Kehadiran ${namaSiswa} berhasil dicatat hadir manual.`);

  // Kirim ke Firebase RTDB di background
  try {
    if (db && typeof db.ref === 'function') {
      await db.ref(`presensi_jam/${currentKelas}/${today}/${jamKe}/${nisn}`).set({
        status: 'hadir',
        waktu: waktu + ' WIB',
        tipe: 'manual_guru',
        verifikator: guruAktif ? guruAktif.nama : 'Guru'
      });
      await db.ref(`absensi/${today}/${nisn}`).update({
        status: 'hadir',
        waktu: waktu + ' WIB',
        nama: namaSiswa,
        kelas: currentKelas
      });
    }
  } catch (errDb) {
    console.warn('Simpan RTDB manual ditunda/offline:', errDb.message);
  }
}

function tampilToastGuru(pesan) {
  if (typeof document === 'undefined') return;
  const toast = document.getElementById('toastGuruNotification');
  const elMsg = document.getElementById('toastGuruMsg');
  if (!toast) return;
  if (elMsg) elMsg.textContent = pesan;
  toast.style.display = 'flex';
  if (typeof window !== 'undefined' && window._toastGuruTimeout) clearTimeout(window._toastGuruTimeout);
  if (typeof window !== 'undefined') {
    window._toastGuruTimeout = setTimeout(() => {
      toast.style.display = 'none';
    }, 3500);
  }
}


// ===================================================================
// SISTEM PENAUTAN MANDIRI NFC KEDINASAN GURU & WALAS (SELF-ENROLLMENT)
// ===================================================================
let timerPairingGuru = null;
let unsubPairingGuru = null;

async function cekStatusKartuNfcGuru(nip) {
  const badgeEl = document.getElementById('badgeStatusNfcGuru');
  const btnEl = document.getElementById('btnTautkanNfcGuru');
  if (!badgeEl || !btnEl) return;

  const targetNip = nip || (guruAktif ? guruAktif.nip : null);
  if (!targetNip) {
    badgeEl.innerHTML = '<span class="badge-nfc-unlinked" style="display:inline-flex;align-items:center;gap:5px;color:#b45309;background:#fffbeb;border:1px solid #fef3c7;padding:3px 10px;border-radius:9999px;font-size:12px;font-weight:600;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>Akun Guru Belum Terverifikasi NIP</span>';
    btnEl.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8.32a7.43 7.43 0 0 1 0 7.36"/><path d="M9.46 6.21a11.76 11.76 0 0 1 0 11.58"/><path d="M12.91 4.1a15.91 15.91 0 0 1 0 15.8"/><path d="M16.37 2a20.16 20.16 0 0 1 0 20"/></svg>Hubungkan Kartu / HP';
    btnEl.style.background = '#0f172a';
    return;
  }

  try {
    let card = null;
    if (typeof cekKartuUser === 'function') {
      card = await cekKartuUser(targetNip);
    }
    if (!card && typeof db !== 'undefined' && db && db.ref) {
      const snap = await db.ref('kartu').once('value');
      const val = snap.val() || {};
      for (const [uid, item] of Object.entries(val)) {
        if (item && (item.nip === targetNip || item === targetNip)) {
          card = { uid, ...(typeof item === 'object' ? item : { nip: item }) };
          break;
        }
      }
    }

    if (card && card.uid) {
      badgeEl.innerHTML = `<span class="badge-nfc-linked" style="display:inline-flex;align-items:center;gap:5px;color:#15803d;background:#f0fdf4;border:1px solid #dcfce7;padding:3px 10px;border-radius:9999px;font-size:12px;font-weight:600;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Kartu / HP Terhubung (UID: ${card.uid})</span>`;
      btnEl.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>Ganti Kartu / HP`;
      btnEl.style.background = '#059669';
    } else {
      badgeEl.innerHTML = '<span class="badge-nfc-unlinked" style="display:inline-flex;align-items:center;gap:5px;color:#b45309;background:#fffbeb;border:1px solid #fef3c7;padding:3px 10px;border-radius:9999px;font-size:12px;font-weight:600;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>Kartu / HP Belum Terhubung</span>';
      btnEl.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8.32a7.43 7.43 0 0 1 0 7.36"/><path d="M9.46 6.21a11.76 11.76 0 0 1 0 11.58"/><path d="M12.91 4.1a15.91 15.91 0 0 1 0 15.8"/><path d="M16.37 2a20.16 20.16 0 0 1 0 20"/></svg>Hubungkan Kartu / HP';
      btnEl.style.background = '#0f172a';
    }
  } catch (e) {
    console.warn('[NFC Guru] Gagal cek status kartu:', e);
  }
}

async function bukaModalPairingNfcGuru() {
  const modal = document.getElementById('modalPairingNfcGuru');
  if (!modal) return;

  const g = guruAktif || (typeof getSessionUser === 'function' ? getSessionUser() : null) || {};
  if (!g.nip) {
    alert('NIP Anda belum terdaftar/terverifikasi di sistem.');
    return;
  }

  modal.style.display = 'flex';
  modal.classList.add('show');

  const cdEl = document.getElementById('nfcCountdownGuru') || document.getElementById('countdownNfcGuru');
  const statusEl = document.getElementById('nfcStatusTextGuru') || document.getElementById('statusPairingNfcGuru');
  const boxFb = document.getElementById('boxFeedbackNfcGuru');
  const iconCenter = document.getElementById('nfcIconCenterGuru');
  if (cdEl) cdEl.textContent = '30s';
  if (statusEl) statusEl.textContent = 'Menunggu kartu atau HP ditempelkan...';
  if (boxFb) { boxFb.style.display = 'none'; boxFb.textContent = ''; }
  if (iconCenter) {
    iconCenter.innerHTML = '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8.32a7.43 7.43 0 0 1 0 7.36"/><path d="M9.46 6.21a11.76 11.76 0 0 1 0 11.58"/><path d="M12.91 4.1a15.91 15.91 0 0 1 0 15.8"/><path d="M16.37 2a20.16 20.16 0 0 1 0 20"/></svg>';
  }

  const isWalas = g.role === 'walas' || Boolean(g.isWalas);
  try {
    if (typeof mulaiPairingNfc === 'function') {
      await mulaiPairingNfc({
        userId: g.nip,
        role: isWalas ? 'walas' : 'guru',
        nama: g.nama || 'Guru Pengajar',
        mapel: g.mapel || '-',
        isWalas: isWalas,
        walasKelasId: g.walasKelasId || (isWalas ? 'XII RPL 2' : '')
      });
    }
  } catch (e) {
    console.warn('[Pairing Guru] Error start pairing:', e);
  }

  let sisaDetik = 30;
  if (timerPairingGuru) clearInterval(timerPairingGuru);
  timerPairingGuru = setInterval(() => {
    sisaDetik--;
    if (cdEl) cdEl.textContent = sisaDetik + 's';
    if (sisaDetik <= 0) {
      clearInterval(timerPairingGuru);
      if (statusEl) statusEl.textContent = 'Waktu habis (>30 detik). Silakan coba lagi.';
      if (boxFb) {
        boxFb.style.display = 'block';
        boxFb.style.background = '#fef2f2';
        boxFb.style.color = '#991b1b';
        boxFb.style.borderColor = '#fecaca';
        boxFb.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;gap:6px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><span>Waktu penautan kartu habis. Silakan coba lagi.</span></div>';
      }
      if (typeof batalkanPairingNfc === 'function') batalkanPairingNfc();
    }
  }, 1000);

  if (unsubPairingGuru) unsubPairingGuru();
  if (typeof dengarkanHasilPairing === 'function') {
    unsubPairingGuru = dengarkanHasilPairing((req) => {
      if (req && req.status === 'success' && req.uid) {
        if (timerPairingGuru) clearInterval(timerPairingGuru);
        if (iconCenter) {
          iconCenter.innerHTML = '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
        }
        if (statusEl) statusEl.textContent = 'Kartu / HP Berhasil Terhubung!';
        if (boxFb) {
          boxFb.style.display = 'block';
          boxFb.style.background = '#f0fdf4';
          boxFb.style.color = '#15803d';
          boxFb.style.borderColor = '#bbf7d0';
          boxFb.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;gap:6px;font-weight:700;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg><span>Kartu / HP Berhasil Terhubung!</span></div><div style="font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:800;color:#0f172a;margin-top:4px;">UID: ${req.uid}</div>`;
        }

        try {
          const actx = new (window.AudioContext || window.webkitAudioContext)();
          const osc = actx.createOscillator();
          const gain = actx.createGain();
          osc.connect(gain);
          gain.connect(actx.destination);
          osc.frequency.setValueAtTime(587.33, actx.currentTime);
          osc.frequency.setValueAtTime(880, actx.currentTime + 0.1);
          gain.gain.setValueAtTime(0.2, actx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, actx.currentTime + 0.35);
          osc.start();
          osc.stop(actx.currentTime + 0.35);
        } catch (e) {}

        isPairingGuruSucceeded = true;
        cekStatusKartuNfcGuru(g.nip);

        setTimeout(() => {
          tutupModalPairingNfcGuru(true);
        }, 2200);
      }
    });
  }
}

let isPairingGuruSucceeded = false;

function tutupModalPairingNfcGuru(isSuccess) {
  if (timerPairingGuru) clearInterval(timerPairingGuru);
  if (unsubPairingGuru) { unsubPairingGuru(); unsubPairingGuru = null; }
  const modal = document.getElementById('modalPairingNfcGuru');
  if (modal) {
    modal.style.display = 'none';
    modal.classList.remove('show');
  }
  if (!isSuccess && !isPairingGuruSucceeded && typeof batalkanPairingNfc === 'function') {
    batalkanPairingNfc();
  }
  isPairingGuruSucceeded = false;
}

async function lakukanSimulasiTapGuru(uidSimulasi) {
  const uid = uidSimulasi || ('04' + Math.random().toString(16).substring(2, 8).toUpperCase());
  if (typeof simulasiTapPairing === 'function') {
    const res = await simulasiTapPairing(uid);
    if (!res.success) {
      const boxFb = document.getElementById('boxFeedbackNfcGuru');
      if (boxFb) {
        boxFb.style.display = 'block';
        boxFb.style.background = '#fef2f2';
        boxFb.style.color = '#991b1b';
        boxFb.textContent = res.message || 'Simulasi gagal.';
      }
    }
    return res;
  }
  return { success: false, reason: 'FUNCTION_NOT_FOUND' };
}


if (typeof window !== 'undefined') {
  window.cekStatusKartuNfcGuru = cekStatusKartuNfcGuru;
  window.bukaModalPairingNfcGuru = bukaModalPairingNfcGuru;
  window.tutupModalPairingNfcGuru = tutupModalPairingNfcGuru;
  window.lakukanSimulasiTapGuru = lakukanSimulasiTapGuru;
  window.isGuruBerhakKelolaKelas = isGuruBerhakKelolaKelas;
  window.hadirkanManualGuru = hadirkanManualGuru;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports.cekStatusKartuNfcGuru = cekStatusKartuNfcGuru;
  module.exports.bukaModalPairingNfcGuru = bukaModalPairingNfcGuru;
  module.exports.tutupModalPairingNfcGuru = tutupModalPairingNfcGuru;
  module.exports.lakukanSimulasiTapGuru = lakukanSimulasiTapGuru;
  module.exports.isGuruBerhakKelolaKelas = isGuruBerhakKelolaKelas;
  module.exports.hadirkanManualGuru = hadirkanManualGuru;
}
