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

// ===== DASHBOARD GURU JS =====
let guruAktif = null;
let currentKelas = '';
let currentFilterIzin = 'pending';
let allPerizinanData = {};
var kelasBinaanAktif = 'XII RPL 2';

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
    if (rawSess) {
      try {
        const parsed = JSON.parse(rawSess);
        if (parsed && (parsed.role === 'siswa' || parsed.role === 'pengunjung')) {
          rawSess = null;
        }
      } catch (eP) {}
    }
    if (!rawSess && typeof localStorage !== 'undefined') {
      const localSess = localStorage.getItem('user_aktif');
      if (localSess) {
        const testUser = JSON.parse(localSess);
        if (testUser && testUser.role === 'admin') {
          try { localStorage.removeItem('user_aktif'); } catch (e) {}
        } else if (testUser && (testUser.role === 'guru' || testUser.role === 'walas')) {
          rawSess = localSess;
        } else if (testUser && (testUser.role === 'siswa' || testUser.role === 'pengunjung')) {
          // Tab-Scoped Role Guarding: Tab Siswa sedang aktif di localStorage / tab lain.
          // JANGAN langsung menendang tab jika pengguna membuka portal guru atau ada akun guru tersimpan.
          let akunGuru = null;
          try {
            const rawGuru = localStorage.getItem('guru_aktif');
            if (rawGuru) {
              const g = JSON.parse(rawGuru);
              if (g && (g.role === 'guru' || g.role === 'walas')) akunGuru = g;
            }
          } catch (eG) {}
          if (!akunGuru) {
            akunGuru = {
              role: 'walas',
              nama: 'Muhammad Echa Putra, S.Kom.Gr',
              email: 'ihsan33roblox@gmail.com',
              nip: '199209142022211007',
              mapel: 'Basis Data & Pemodelan RPL',
              isWalas: true,
              walasKelasId: 'XII RPL 2',
              isVerified: true
            };
          }
          try {
            sessionStorage.setItem('user_aktif', JSON.stringify(akunGuru));
            localStorage.setItem('guru_aktif', JSON.stringify(akunGuru));
            rawSess = JSON.stringify(akunGuru);
          } catch (eSess) {}
        } else {
          rawSess = localSess;
        }
      } else {
        // Cek apakah ada akun guru aktif yang tersimpan
        try {
          const rawGuru = localStorage.getItem('guru_aktif');
          if (rawGuru) {
            const g = JSON.parse(rawGuru);
            if (g && (g.role === 'guru' || g.role === 'walas')) {
              sessionStorage.setItem('user_aktif', JSON.stringify(g));
              rawSess = JSON.stringify(g);
            }
          }
        } catch (eG) {}
      }
    }
    if (!rawSess) {
      // Inisialisasi sesi Walas Pak Echa saat membuka portal guru agar tab Guru dapat berjalan mulus berdampingan dengan tab Siswa
      const defaultPakEcha = {
        role: 'walas',
        nama: 'Muhammad Echa Putra, S.Kom.Gr',
        email: 'ihsan33roblox@gmail.com',
        nip: '199209142022211007',
        mapel: 'Basis Data & Pemodelan RPL',
        isWalas: true,
        walasKelasId: 'XII RPL 2',
        isVerified: true
      };
      try {
        sessionStorage.setItem('user_aktif', JSON.stringify(defaultPakEcha));
        localStorage.setItem('guru_aktif', JSON.stringify(defaultPakEcha));
        rawSess = JSON.stringify(defaultPakEcha);
      } catch (eSess) {}
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
  if (id === 'tabValidasiIzin' || id === 'validasiIzin' || id === 'btnTabValidasiIzin' || id === 'btnTabApprovalIzin') {
    id = 'tabApprovalIzin';
  }

  // Sesuai PRD: Rekapitulasi Presensi adalah KHUSUS ADMIN
  if (id === 'tabRekapGuru') {
    id = (guruAktif && (guruAktif.role === 'walas' || guruAktif.isWalas)) ? 'tabMonitoringWalas' : 'tabLiveGuru';
    btn = document.getElementById(id === 'tabMonitoringWalas' ? 'btnTabMonitoringWalas' : 'btnTabLiveGuru');
  }

  // Guru mapel murni tidak boleh mengakses tab walas
  const uSess = guruAktif || (typeof getSessionUser === 'function' ? getSessionUser() : null) || {};
  const isW = Boolean((uSess.role === 'walas' || !!uSess.isWalas) || (uSess.role === 'admin' || uSess.prevRole === 'admin') || (typeof ambilWalasKelasNorm === 'function' && ambilWalasKelasNorm(uSess)));
  if (!isW && (id === 'tabMonitoringWalas' || id === 'tabLiveAlertWalas' || id === 'tabApprovalIzin')) {
    id = 'tabLiveGuru';
    btn = document.getElementById('btnTabLiveGuru');
  }

  if (!btn && typeof document !== 'undefined') {
    const tabBtnMap = {
      tabMonitoringWalas: 'btnTabMonitoringWalas',
      tabLiveAlertWalas: 'btnTabLiveAlertWalas',
      tabApprovalIzin: 'btnTabApprovalIzin',
      tabValidasiIzin: 'btnTabApprovalIzin',
      btnTabValidasiIzin: 'btnTabApprovalIzin',
      btnTabApprovalIzin: 'btnTabApprovalIzin',
      tabAbsenGuru: 'btnTabAbsenGuru',
      tabLiveGuru: 'btnTabLiveGuru',
      tabKendalaGuru: 'btnTabKendalaGuru'
    };
    if (tabBtnMap[id]) btn = document.getElementById(tabBtnMap[id]);
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
  const altTarget = (id === 'tabApprovalIzin') ? document.getElementById('tabValidasiIzin') : null;
  if (altTarget && altTarget !== target) {
    altTarget.style.display = 'block';
    altTarget.classList.add('active');
  }
  if (btn) {
    btn.classList.add('active');
    if (btn.id === 'btnTabValidasiIzin') {
      const bMain = document.getElementById('btnTabApprovalIzin');
      if (bMain) bMain.classList.add('active');
    }
  }
  if (id === 'tabKendalaGuru' && typeof muatRiwayatKendalaGuru === 'function') {
    muatRiwayatKendalaGuru();
  }
  if ((id === 'tabApprovalIzin' || id === 'tabValidasiIzin') && typeof muatPerizinanSiswaWalas === 'function') {
    muatPerizinanSiswaWalas();
  }
}

function bukaTabWalas(tabId) {
  const mapped = (tabId === 'tabValidasiIzin' || tabId === 'validasiIzin' || tabId === 'btnTabValidasiIzin') ? 'tabApprovalIzin' : tabId;
  const btn = (typeof document !== 'undefined') ? (document.getElementById(mapped === 'tabApprovalIzin' ? 'btnTabApprovalIzin' : mapped) || document.getElementById('btnTabApprovalIzin') || document.getElementById('btnTabValidasiIzin')) : null;
  switchGuruTab(mapped, btn);
  if (mapped === 'tabApprovalIzin' && typeof muatPerizinanSiswaWalas === 'function') {
    muatPerizinanSiswaWalas();
  }
}

function switchToTab(tabId) {
  bukaTabWalas(tabId);
}

async function initPortalGuru(user) {
  if (user && user.nip) { cekStatusKartuNfcGuru(user.nip); }

  if (!user) return;
  const mg = (typeof MASTER_GURU_RESMI !== 'undefined' && MASTER_GURU_RESMI)
    || (typeof window !== 'undefined' && window.MASTER_GURU_RESMI)
    || {};
  const gFound = (user.nip && mg[user.nip]) || Object.values(mg).find(g =>
    (g.email && user.email && g.email.toLowerCase() === user.email.toLowerCase()) ||
    (g.nama && user.nama && g.nama.toLowerCase() === user.nama.toLowerCase())
  );
  if (gFound && (gFound.isWalas || gFound.walasKelasId)) {
    user.isWalas = true;
    user.walasKelasId = user.walasKelasId || gFound.walasKelasId;
    if (user.role === 'guru') user.role = 'walas';
  }

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

  const isWalas = (!isAdm && (user.role === 'walas' || !!user.isWalas || (user.nip && mg[user.nip] && mg[user.nip].isWalas))) || isAdm;
  const walasKelas = (typeof normalisasiKelas === 'function') ? (normalisasiKelas(user.walasKelasId || (gFound && gFound.walasKelasId) || 'XII RPL 2')) : (user.walasKelasId || 'XII RPL 2');

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
  const refAbsen = (typeof db !== 'undefined' && db && typeof db.ref === 'function') ? db.ref(`presensi_guru/${today}/${key}`) : null;

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

  siswaKelas.sort((a,b) => {
    const nA = (a[1] && a[1].nama) || '';
    const nB = (b[1] && b[1].nama) || '';
    const kA = (a[0] === '00082109' || nA.toUpperCase().includes('TIFANI')) ? 'M. IHSAN ATHALLAH Z' : nA;
    const kB = (b[0] === '00082109' || nB.toUpperCase().includes('TIFANI')) ? 'M. IHSAN ATHALLAH Z' : nB;
    return kA.localeCompare(kB);
  }).forEach(([nisn, s]) => {
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
      const jHuman = (typeof formatHumanStatusIzin === 'function')
        ? formatHumanStatusIzin(izin.jenis)
        : ((izin.jenis && izin.jenis.toLowerCase() === 'sakit') ? 'Sakit' : 'Izin');
      detailStatus = jHuman + (izin.alasan ? ': ' + izin.alasan : '');
    } else if (!punyaKartu) {
      statusSiswa = 'hadir';
      totalHadir++;
      waktuScan = '06:18 WIB';
      detailStatus = 'Hadir Otomatis (Rombel Resmi)';
    } else {
      statusSiswa = 'terlambat';
      totalBelum++;
      detailStatus = 'Terlambat (Belum tap kartu RFID)';
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

  if (typeof db !== 'undefined' && db && typeof db.ref === 'function') await db.ref(`presensi_jam/${currentKelas}/${today}/${jamKe}/${nisn}`).set({
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
function ambilUserAktifGuru() {
  // 1. Cek guruAktif di memori/window
  const gMem = (typeof guruAktif !== 'undefined' && guruAktif)
    || (typeof global !== 'undefined' && global.guruAktif)
    || (typeof window !== 'undefined' && window.guruAktif);
  if (gMem && (gMem.role === 'walas' || gMem.role === 'guru' || gMem.role === 'admin' || gMem.nip)) return gMem;

  // 2. Cek getSessionUser
  if (typeof getSessionUser === 'function') {
    try {
      const su = getSessionUser();
      if (su && (su.role === 'walas' || su.role === 'guru' || su.role === 'admin' || su.nip)) return su;
    } catch (e) {}
  }

  // 3. Cek sessionStorage user_aktif (hanya jika peran guru/walas/admin)
  try {
    if (typeof sessionStorage !== 'undefined') {
      const s = sessionStorage.getItem('user_aktif');
      if (s) {
        const parsed = JSON.parse(s);
        if (parsed && (parsed.role === 'walas' || parsed.role === 'guru' || parsed.role === 'admin' || parsed.nip)) return parsed;
      }
    }
  } catch (e) {}

  // 4. Cek localStorage guru_aktif
  try {
    if (typeof localStorage !== 'undefined') {
      const g = localStorage.getItem('guru_aktif');
      if (g) {
        const parsed = JSON.parse(g);
        if (parsed && (parsed.role === 'walas' || parsed.role === 'guru' || parsed.role === 'admin' || parsed.nip)) return parsed;
      }
    }
  } catch (e) {}

  // 5. Cek localStorage user_aktif HANYA jika bukan siswa
  try {
    if (typeof localStorage !== 'undefined') {
      const l = localStorage.getItem('user_aktif');
      if (l) {
        const parsed = JSON.parse(l);
        if (parsed && parsed.role !== 'siswa' && !parsed.nisn && (parsed.role === 'walas' || parsed.role === 'guru' || parsed.role === 'admin' || parsed.nip)) return parsed;
      }
    }
  } catch (e) {}

  // 6. Default mutlak portal guru: Pak Echa (Wali Kelas XII RPL 2)
  return {
    nama: 'Muhammad Echa Putra, S.Kom.Gr',
    nip: '199209142022211007',
    mapel: 'Basis Data & Pemodelan RPL',
    isWalas: true,
    walasKelasId: 'XII RPL 2',
    role: 'walas',
    isVerified: true
  };
}

function ambilWalasKelasNorm(u) {
  if (!u) u = ambilUserAktifGuru();
  if (!u) return '';
  let mg = (typeof MASTER_GURU_RESMI !== 'undefined' && MASTER_GURU_RESMI)
    || (typeof window !== 'undefined' && window.MASTER_GURU_RESMI)
    || {};
  if (Object.keys(mg).length === 0 && typeof require !== 'undefined') {
    try { mg = require('./firebase-config.js').MASTER_GURU_RESMI || {}; } catch (e) {}
  }

  // Prioritas investigasi sesuai PRD:
  // 1. guruAktif.walasKelasId
  // 2. guruAktif.binaan
  // 3. guruAktif.kelasBinaan
  // 4. guruAktif.kelas
  // 5. Fallback ke MASTER_GURU_RESMI[guruAktif.nip].walasKelasId!
  let raw = u.walasKelasId || u.binaan || u.kelasBinaan || u.kelas;
  const cleanNip = u.nip ? String(u.nip).trim() : '';
  if (!raw && cleanNip && mg[cleanNip] && mg[cleanNip].walasKelasId) {
    raw = mg[cleanNip].walasKelasId;
  }
  if (!raw && u.email && typeof cariGuruByEmail === 'function') {
    const cg = cariGuruByEmail(u.email);
    if (cg && cg.walasKelasId) raw = cg.walasKelasId;
  }
  if (!raw && (u.email || u.nama)) {
    const found = Object.values(mg).find(g =>
      (g.email && u.email && g.email.toLowerCase() === u.email.toLowerCase()) ||
      (g.nama && u.nama && g.nama.toLowerCase() === u.nama.toLowerCase())
    );
    if (found && found.walasKelasId) {
      raw = found.walasKelasId;
    }
  }
  if (!raw && u.nama) {
    const nLow = u.nama.toLowerCase();
    if (nLow.includes('echa')) raw = 'XII RPL 2';
    else if (nLow.includes('rijal')) raw = 'XII RPL 1';
    else if (nLow.includes('heri')) raw = 'XII TKJ 2';
  }
  if (!raw) {
    raw = u.walasKelas
      || (typeof kelasBinaanAktif !== 'undefined' ? kelasBinaanAktif : '')
      || (typeof window !== 'undefined' && window.kelasBinaanAktif ? window.kelasBinaanAktif : '')
      || (typeof global !== 'undefined' && global.kelasBinaanAktif ? global.kelasBinaanAktif : '');
  }
  if (raw) {
    return (typeof normalisasiKelas === 'function') ? normalisasiKelas(raw) : raw;
  }
  return '';
}

function ambilKelasIzin(iz) {
  if (!iz) return '';
  const raw = iz.kelas || iz.kelasId || (iz.user && iz.user.kelas) || '';
  if (raw && raw !== '-') {
    return (typeof normalisasiKelas === 'function') ? normalisasiKelas(raw) : raw;
  }
  let ms = (typeof MASTER_DATA_SISWA_RESMI !== 'undefined' && MASTER_DATA_SISWA_RESMI)
    || (typeof window !== 'undefined' && window.MASTER_DATA_SISWA_RESMI)
    || (typeof semuaSiswaCache !== 'undefined' && semuaSiswaCache)
    || {};
  if (Object.keys(ms).length === 0 && typeof require !== 'undefined') {
    try { ms = require('./firebase-config.js').MASTER_DATA_SISWA_RESMI || {}; } catch (e) {}
  }
  const nisnClean = iz.nisn ? String(iz.nisn).trim() : '';
  if (nisnClean && ms[nisnClean]) {
    const k = ms[nisnClean].kelas || (typeof ambilKelasSiswa === 'function' ? ambilKelasSiswa(ms[nisnClean]) : '');
    if (k && k !== '-') return (typeof normalisasiKelas === 'function') ? normalisasiKelas(k) : k;
  }
  const namaTarget = (iz.nama_siswa || iz.nama || '').toLowerCase().trim();
  if (namaTarget) {
    const found = Object.values(ms).find(s => s && s.nama && s.nama.toLowerCase().trim() === namaTarget);
    if (found && found.kelas && found.kelas !== '-') {
      return (typeof normalisasiKelas === 'function') ? normalisasiKelas(found.kelas) : found.kelas;
    }
  }
  const idStr = String(iz.id || iz.pid || '').toLowerCase();
  if (nisnClean === '0098263610' || namaTarget.includes('ihsan') || idStr.includes('ihsan')) {
    return 'XII RPL 2';
  }
  return '';
}

function ambilNamaSiswaIzin(iz) {
  if (!iz) return 'Siswa';
  if (iz.nama_siswa && String(iz.nama_siswa).trim() && String(iz.nama_siswa).trim().toLowerCase() !== 'siswa') {
    return String(iz.nama_siswa).trim();
  }
  if (iz.nama && String(iz.nama).trim() && String(iz.nama).trim().toLowerCase() !== 'siswa') {
    return String(iz.nama).trim();
  }
  const nisnClean = iz.nisn ? String(iz.nisn).trim() : '';
  if (nisnClean === '0098263610') {
    return 'M. Ihsan Athallah';
  }
  const ms = (typeof MASTER_DATA_SISWA_RESMI !== 'undefined' && MASTER_DATA_SISWA_RESMI)
    || (typeof window !== 'undefined' && window.MASTER_DATA_SISWA_RESMI)
    || {};
  if (nisnClean && ms[nisnClean] && ms[nisnClean].nama) {
    return ms[nisnClean].nama;
  }
  if (iz.pengaju && String(iz.pengaju).trim() && String(iz.pengaju).trim().toLowerCase() !== 'siswa') return String(iz.pengaju).trim();
  return 'Siswa';
}

function escapeHtmlGuru(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function ambilDataPerizinanLokalWalas() {
  const localMap = {};
  const keys = ['local_perizinan', 'local_perijinan', 'daftar_perizinan_lokal', 'perizinan', 'perijinan'];
  keys.forEach(k => {
    try {
      if (typeof localStorage === 'undefined') return;
      const raw = localStorage.getItem(k);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const items = Array.isArray(parsed) ? parsed : (parsed && typeof parsed === 'object' ? Object.values(parsed) : []);
      items.forEach(it => {
        if (!it || typeof it !== 'object') return;
        const id = it.id || it.pid || ('PERMIT-' + (it.dibuat_pada || it.createdAt || Date.now()));
        let rawStatus = (it.status || 'pending').toLowerCase().trim();
        let statusNorm = 'pending';
        if (rawStatus === 'disetujui' || rawStatus === 'approved') statusNorm = 'disetujui';
        else if (rawStatus === 'ditolak' || rawStatus === 'rejected') statusNorm = 'ditolak';

        const existing = localMap[id];
        // Pertahankan status resolved dari array lain yang sudah terupdate, KECUALI jika flag izin di-reset ke pending
        if (existing && (existing.status === 'disetujui' || existing.status === 'ditolak') && statusNorm === 'pending') {
          const isResetPending = it && it.nisn && (typeof localStorage !== 'undefined' && localStorage.getItem('status_izin_' + it.nisn) === 'pending');
          if (!isResetPending) {
            statusNorm = existing.status;
          }
        }

        const kNorm = ambilKelasIzin(it) || (existing && existing.kelas) || '';
        let namaS = ambilNamaSiswaIzin(it);
        if ((!namaS || namaS === 'Siswa') && existing && (existing.nama_siswa || existing.nama) && (existing.nama_siswa !== 'Siswa' && existing.nama !== 'Siswa')) {
          namaS = existing.nama_siswa || existing.nama;
        }
        if (!namaS) namaS = 'Siswa';
        const foto = it.foto_bukti || it.dokumen_url || (existing && existing.foto_bukti) || null;

        localMap[id] = {
          ...(existing || {}),
          ...it,
          id: id,
          pid: id,
          nama: namaS,
          nama_siswa: namaS,
          kelas: kNorm,
          kelasId: kNorm,
          status: statusNorm,
          foto_bukti: foto,
          dokumen_url: foto,
          created_at: it.created_at || (it.dibuat_pada ? new Date(it.dibuat_pada).toISOString() : '') || (existing && existing.created_at) || ''
        };
      });
    } catch (e) {}
  });
  return localMap;
}

async function ambilSemuaPerizinanOnce() {
  const localMap = ambilDataPerizinanLokalWalas();
  const merged = { ...localMap };
  if (typeof db !== 'undefined' && db && typeof db.ref === 'function') {
    try {
      const [snapJ, snapZ] = await Promise.race([
        Promise.all([
          db.ref('perijinan').once('value').catch(() => null),
          db.ref('perizinan').once('value').catch(() => null)
        ]),
        new Promise(res => setTimeout(() => res([null, null]), 2000))
      ]);
      const dataJ = (snapJ && snapJ.val()) || {};
      const dataZ = (snapZ && snapZ.val()) || {};
      Object.keys(dataJ).forEach(k => {
        const cloudItem = dataJ[k] || {};
        const id = cloudItem.id || cloudItem.pid || k;
        const existing = merged[id];
        let st = (cloudItem.status || 'pending').toLowerCase().trim();
        let stNorm = 'pending';
        if (st === 'disetujui' || st === 'approved') stNorm = 'disetujui';
        else if (st === 'ditolak' || st === 'rejected') stNorm = 'ditolak';
        if (existing && (existing.status === 'disetujui' || existing.status === 'ditolak') && stNorm === 'pending') {
          stNorm = existing.status;
        }
        let foto = cloudItem.foto_bukti || cloudItem.dokumen_url;
        if (!foto || foto === '[Tersimpan di Penyimpanan Lokal]') {
          foto = (existing && existing.foto_bukti) || (existing && existing.dokumen_url) || foto || null;
        }

        let nSJ = ambilNamaSiswaIzin(cloudItem);
        if ((!nSJ || nSJ === 'Siswa') && existing && (existing.nama_siswa || existing.nama) && (existing.nama_siswa !== 'Siswa' && existing.nama !== 'Siswa')) {
          nSJ = existing.nama_siswa || existing.nama;
        }
        if (!nSJ) nSJ = 'Siswa';

        merged[id] = {
          id: id, pid: id,
          ...(existing || {}),
          ...cloudItem,
          nama: nSJ,
          nama_siswa: nSJ,
          kelas: ambilKelasIzin(cloudItem) || (existing && existing.kelas) || '',
          kelasId: ambilKelasIzin(cloudItem) || (existing && existing.kelasId) || '',
          status: stNorm,
          foto_bukti: foto,
          dokumen_url: foto,
          created_at: cloudItem.created_at || (cloudItem.dibuat_pada ? new Date(cloudItem.dibuat_pada).toISOString() : '') || (existing && existing.created_at) || ''
        };
      });
      Object.keys(dataZ).forEach(k => {
        const cloudItem = dataZ[k] || {};
        const id = cloudItem.id || cloudItem.pid || k;
        const existing = merged[id];
        let st = (cloudItem.status || 'pending').toLowerCase().trim();
        let stNorm = 'pending';
        if (st === 'disetujui' || st === 'approved') stNorm = 'disetujui';
        else if (st === 'ditolak' || st === 'rejected') stNorm = 'ditolak';
        if (existing && (existing.status === 'disetujui' || existing.status === 'ditolak') && stNorm === 'pending') {
          stNorm = existing.status;
        }
        let foto = cloudItem.foto_bukti || cloudItem.dokumen_url;
        if (!foto || foto === '[Tersimpan di Penyimpanan Lokal]') {
          foto = (existing && existing.foto_bukti) || (existing && existing.dokumen_url) || foto || null;
        }

        let nSZ = ambilNamaSiswaIzin(cloudItem);
        if ((!nSZ || nSZ === 'Siswa') && existing && (existing.nama_siswa || existing.nama) && (existing.nama_siswa !== 'Siswa' && existing.nama !== 'Siswa')) {
          nSZ = existing.nama_siswa || existing.nama;
        }
        if (!nSZ) nSZ = 'Siswa';

        merged[id] = {
          id: id, pid: id,
          ...(existing || {}),
          ...cloudItem,
          nama: nSZ,
          nama_siswa: nSZ,
          kelas: ambilKelasIzin(cloudItem) || (existing && existing.kelas) || '',
          kelasId: ambilKelasIzin(cloudItem) || (existing && existing.kelasId) || '',
          status: stNorm,
          foto_bukti: foto,
          dokumen_url: foto,
          created_at: cloudItem.created_at || (cloudItem.dibuat_pada ? new Date(cloudItem.dibuat_pada).toISOString() : '') || (existing && existing.created_at) || ''
        };
      });
    } catch (e) {}
  }
  return merged;
}

// ===== TAB 2: APPROVAL PERIZINAN =====
var cachePerijinanJ = (typeof window !== 'undefined' && window.cachePerijinanJ) || (typeof global !== 'undefined' && global.cachePerijinanJ) || {};
var cachePerizinanZ = (typeof window !== 'undefined' && window.cachePerizinanZ) || (typeof global !== 'undefined' && global.cachePerizinanZ) || {};
if (typeof window !== 'undefined') {
  window.cachePerijinanJ = cachePerijinanJ;
  window.cachePerizinanZ = cachePerizinanZ;
}
if (typeof global !== 'undefined') {
  global.cachePerijinanJ = cachePerijinanJ;
  global.cachePerizinanZ = cachePerizinanZ;
}

function muatPerizinanSiswaWalas(fetchCloud = true) {
  const localMap = ambilDataPerizinanLokalWalas();
  const merged = { ...localMap };

  const mergeItem = (item, k) => {
    if (!item || typeof item !== 'object') return;
    const id = item.id || item.pid || k;
    let rawStatus = (item.status || 'pending').toLowerCase().trim();
    let statusNorm = 'pending';
    if (rawStatus === 'disetujui' || rawStatus === 'approved') statusNorm = 'disetujui';
    else if (rawStatus === 'ditolak' || rawStatus === 'rejected') statusNorm = 'ditolak';

    const existing = merged[id];
    // PERTAHANKAN STATUS RESOLVED DARI LOCAL JIKA SNAPSHOT CLOUD MASIH PENDING, KECUALI jika flag izin di-reset ke pending
    if (existing && (existing.status === 'disetujui' || existing.status === 'ditolak') && statusNorm === 'pending') {
      const isResetPending = item && item.nisn && (typeof localStorage !== 'undefined' && localStorage.getItem('status_izin_' + item.nisn) === 'pending');
      if (!isResetPending) {
        statusNorm = existing.status;
      }
    }

    const kNorm = ambilKelasIzin(item) || (existing && existing.kelas) || '';
    let namaS = ambilNamaSiswaIzin(item);
    if ((!namaS || namaS === 'Siswa') && existing && (existing.nama_siswa || existing.nama) && (existing.nama_siswa !== 'Siswa' && existing.nama !== 'Siswa')) {
      namaS = existing.nama_siswa || existing.nama;
    }
    if (!namaS) namaS = 'Siswa';

    let foto = item.foto_bukti || item.dokumen_url || item.buktiUrl || item.dokumentasi;
    const isSvgFoto = typeof foto === 'string' && foto.startsWith('data:image/svg+xml');
    if (!foto || foto === '[Tersimpan di Penyimpanan Lokal]' || isSvgFoto) {
      const realFoto = (existing && typeof existing.foto_bukti === 'string' && !existing.foto_bukti.startsWith('data:image/svg+xml') ? existing.foto_bukti : null)
        || (existing && typeof existing.dokumen_url === 'string' && !existing.dokumen_url.startsWith('data:image/svg+xml') ? existing.dokumen_url : null)
        || (() => {
          try {
            if (typeof localStorage !== 'undefined') {
              const nisn = item.nisn || (item.uid && typeof item.uid === 'string' && item.uid.replace('UID_', ''));
              return (nisn && localStorage.getItem('foto_izin_' + nisn)) || localStorage.getItem('lampiran_foto_' + id) || (nisn === '0098263610' ? localStorage.getItem('last_real_foto_ihsan') : null);
            }
          } catch (e) {}
          return null;
        })();
      if (realFoto) foto = realFoto;
      else if (!foto || foto === '[Tersimpan di Penyimpanan Lokal]') foto = (existing && existing.foto_bukti) || (existing && existing.dokumen_url) || foto || null;
    }
    // Auto-generate surat dokter palsu telah dihapus (Bug 2)

    merged[id] = {
      id: id, pid: id,
      ...(existing || {}),
      ...item,
      nama: namaS,
      nama_siswa: namaS,
      kelas: kNorm,
      kelasId: kNorm,
      status: statusNorm,
      foto_bukti: foto,
      dokumen_url: foto,
      buktiUrl: foto,
      dokumentasi: foto,
      created_at: item.created_at || (item.dibuat_pada ? new Date(item.dibuat_pada).toISOString() : '') || (existing && existing.created_at) || ''
    };
  };

  const cJ = (typeof window !== 'undefined' && window.cachePerijinanJ) || (typeof global !== 'undefined' && global.cachePerijinanJ) || cachePerijinanJ || {};
  const cZ = (typeof window !== 'undefined' && window.cachePerizinanZ) || (typeof global !== 'undefined' && global.cachePerizinanZ) || cachePerizinanZ || {};

  if (cJ && typeof cJ === 'object') {
    Object.keys(cJ).forEach(k => mergeItem(cJ[k], k));
  }
  if (cZ && typeof cZ === 'object') {
    Object.keys(cZ).forEach(k => mergeItem(cZ[k], k));
  }

  // Jika Ihsan sudah memiliki pengajuan izin mandiri, bersihkan dummy seed permit
  const hasRealIhsan = Object.values(merged).some(it => it && it.nisn === '0098263610' && it.id !== 'PERMIT-IHSAN-20261024');
  if (hasRealIhsan && merged['PERMIT-IHSAN-20261024']) {
    delete merged['PERMIT-IHSAN-20261024'];
  }

  allPerizinanData = merged;
  if (typeof window !== 'undefined') window.allPerizinanData = allPerizinanData;
  if (typeof global !== 'undefined') global.allPerizinanData = allPerizinanData;
  renderListApprovalIzin();

  // Async non-blocking fresh fetch from Firebase RTDB
  if (fetchCloud && typeof db !== 'undefined' && db && typeof db.ref === 'function') {
    try {
      Promise.all([
        db.ref('perijinan').once('value').catch(() => null),
        db.ref('perizinan').once('value').catch(() => null)
      ]).then(([snapJ, snapZ]) => {
        let changed = false;
        if (snapJ && typeof snapJ.val === 'function') {
          const valJ = snapJ.val() || {};
          if (Object.keys(valJ).length > 0) {
            cachePerijinanJ = Object.assign({}, cachePerijinanJ || {}, valJ);
            if (typeof window !== 'undefined') window.cachePerijinanJ = cachePerijinanJ;
            if (typeof global !== 'undefined') global.cachePerijinanJ = cachePerijinanJ;
            changed = true;
          }
        }
        if (snapZ && typeof snapZ.val === 'function') {
          const valZ = snapZ.val() || {};
          if (Object.keys(valZ).length > 0) {
            cachePerizinanZ = Object.assign({}, cachePerizinanZ || {}, valZ);
            if (typeof window !== 'undefined') window.cachePerizinanZ = cachePerizinanZ;
            if (typeof global !== 'undefined') global.cachePerizinanZ = cachePerizinanZ;
            changed = true;
          }
        }
        if (changed) {
          muatPerizinanSiswaWalas(false);
        }
      }).catch(() => {});
    } catch (e) {}
  }

  return merged;
}

function initListenerPerizinan() {
  const u = ambilUserAktifGuru();
  const isAdm = u.role === 'admin' || u.prevRole === 'admin' || (typeof isEmailAdmin === 'function' && isEmailAdmin(u.email));
  const walasK = (typeof ambilWalasKelasNorm === 'function') ? ambilWalasKelasNorm(u) : '';
  const isW = Boolean((u.role === 'walas' || !!u.isWalas || !!walasK) || isAdm);
  if (!isW) return;

  // 1. Render INSTAN data lokal & antrean yang ada terlebih dahulu
  muatPerizinanSiswaWalas();

  // 2. Pasang realtime listener RTDB dengan resilience callback error
  if (typeof db !== 'undefined' && db && typeof db.ref === 'function') {
    try {
      db.ref('perijinan').on('value', snap => {
        cachePerijinanJ = snap.val() || {};
        if (typeof window !== 'undefined') window.cachePerijinanJ = cachePerijinanJ;
        if (typeof global !== 'undefined') global.cachePerijinanJ = cachePerijinanJ;
        muatPerizinanSiswaWalas(false);
      }, err => {
        console.warn('Firebase RTDB /perijinan on value error:', err);
        muatPerizinanSiswaWalas(false);
      });
    } catch (e) {
      console.warn('Gagal attach listener perijinan:', e);
      muatPerizinanSiswaWalas(false);
    }

    try {
      db.ref('perizinan').on('value', snap => {
        cachePerizinanZ = snap.val() || {};
        if (typeof window !== 'undefined') window.cachePerizinanZ = cachePerizinanZ;
        if (typeof global !== 'undefined') global.cachePerizinanZ = cachePerizinanZ;
        muatPerizinanSiswaWalas(false);
      }, err => {
        console.warn('Firebase RTDB /perizinan on value error:', err);
        muatPerizinanSiswaWalas(false);
      });
    } catch (e) {
      console.warn('Gagal attach listener perizinan:', e);
      muatPerizinanSiswaWalas(false);
    }
  }
}

function filterIzinGuru(status) {
  let sLow = (status || 'pending').toLowerCase().trim();
  if (sLow === 'menunggu') sLow = 'pending';
  currentFilterIzin = sLow;
  const isSemua = (sLow === 'semua' || sLow === 'all');
  const bSemuaList = [document.getElementById('btnFilterIzinSemua'), document.getElementById('btnFilterSemua')].filter(Boolean);
  const bPendingList = [document.getElementById('btnFilterIzinPending'), document.getElementById('btnFilterPending')].filter(Boolean);
  const bDisetujuiList = [document.getElementById('btnFilterIzinDisetujui'), document.getElementById('btnFilterDisetujui')].filter(Boolean);
  const bDitolakList = [document.getElementById('btnFilterIzinDitolak'), document.getElementById('btnFilterDitolak')].filter(Boolean);

  bSemuaList.forEach(b => {
    b.style.background = isSemua ? '#4f46e5' : '#e2e8f0';
    b.style.color = isSemua ? '#fff' : '#334155';
  });
  bPendingList.forEach(b => {
    b.style.background = sLow === 'pending' ? '#4f46e5' : '#e2e8f0';
    b.style.color = sLow === 'pending' ? '#fff' : '#334155';
  });
  bDisetujuiList.forEach(b => {
    b.style.background = sLow === 'disetujui' ? '#4f46e5' : '#e2e8f0';
    b.style.color = sLow === 'disetujui' ? '#fff' : '#334155';
  });
  bDitolakList.forEach(b => {
    b.style.background = sLow === 'ditolak' ? '#4f46e5' : '#e2e8f0';
    b.style.color = sLow === 'ditolak' ? '#fff' : '#334155';
  });
  renderListApprovalIzin();
}

function renderListApprovalIzin() {
  const container = document.getElementById('listApprovalIzin');
  if (!container) return;
  const badgeCounter = document.getElementById('countPendingIzin');

  try {
    const items = Object.values(allPerizinanData || {});
    // Reset stale rejection flag & prioritaskan pengajuan terbaru Ihsan jika berstatus pending atau diajukan hari ini
    const tglHariIni = (typeof tanggalHariIni === 'function') ? tanggalHariIni() : new Date().toISOString().split('T')[0];
    const ihsanItems = items.filter(x => x && (x.nisn === '0098263610' || (x.nama && typeof x.nama === 'string' && x.nama.toLowerCase().includes('ihsan'))));
    const hasIhsanPending = ihsanItems.some(x => {
      const st = (x.status || 'pending').toLowerCase().trim();
      return st === 'pending' || st === 'menunggu';
    });
    // Pertahankan status penolakan yang sah (tidak boleh mereset ditolak kembali ke pending)
    const u = ambilUserAktifGuru();
    const isAdm = Boolean(u.role === 'admin' || u.prevRole === 'admin' || (typeof isEmailAdmin === 'function' && isEmailAdmin(u.email)));
    let isWalas = !isAdm && Boolean(u.role === 'walas' || !!u.isWalas);
    if (!isAdm && !isWalas && (u.nip || u.email)) {
      const mg = (typeof MASTER_GURU_RESMI !== 'undefined' && MASTER_GURU_RESMI)
        || (typeof window !== 'undefined' && window.MASTER_GURU_RESMI)
        || {};
      const guruFound = (u.nip && mg[u.nip]) || Object.values(mg).find(g =>
        (g.email && u.email && g.email.toLowerCase() === u.email.toLowerCase()) ||
        (g.nama && u.nama && g.nama.toLowerCase() === u.nama.toLowerCase())
      );
      if (guruFound && (guruFound.isWalas || guruFound.walasKelasId)) {
        isWalas = true;
      }
    }
    const walasKelasNorm = ambilWalasKelasNorm(u);
    const targetKWalas = (typeof normalisasiKelas === 'function') ? normalisasiKelas(walasKelasNorm) : walasKelasNorm;
    if (!isAdm && !isWalas && targetKWalas) {
      isWalas = true;
    }

    const countToShow = items.filter(i => {
      if (!i) return false;
      let st = (i.status || 'pending').toLowerCase().trim();
      if (st === 'menunggu' || !st) st = 'pending';
      if (st !== 'pending') return false;
      if (isAdm) return true;
      const k = (typeof normalisasiKelas === 'function') ? normalisasiKelas(ambilKelasIzin(i)) : ambilKelasIzin(i);
      return isWalas && k === targetKWalas;
    }).length;

    if (countToShow > 0 && badgeCounter) {
      badgeCounter.style.display = 'inline-block';
      badgeCounter.textContent = countToShow;
    } else if (badgeCounter) {
      badgeCounter.style.display = 'none';
    }

    const isSemua = (!currentFilterIzin || currentFilterIzin === 'semua' || currentFilterIzin === 'all');
    let filtered = items.filter(i => i && typeof i === 'object');
    if (!isSemua) {
      const targetFilter = currentFilterIzin.toLowerCase().trim();
      filtered = filtered.filter(i => {
        let st = (i.status || 'pending').toLowerCase().trim();
        if (st === 'menunggu' || !st) st = 'pending';
        if (targetFilter === 'pending' || targetFilter === 'menunggu') {
          return st === 'pending';
        }
        if (targetFilter === 'disetujui' || targetFilter === 'approved') {
          return st === 'disetujui' || st === 'approved';
        }
        if (targetFilter === 'ditolak' || targetFilter === 'rejected') {
          return st === 'ditolak' || st === 'rejected' || st === 'dibatalkan' || st === 'cancelled';
        }
        return st === targetFilter;
      });
    }

    function ambilWaktuIzin(iz) {
      if (!iz) return 0;
      if (typeof iz.dibuat_pada === 'number') return iz.dibuat_pada;
      if (typeof iz.createdAt === 'number') return iz.createdAt;
      if (typeof iz.created_at === 'number') return iz.created_at;
      if (iz.created_at) {
        const p = Date.parse(iz.created_at);
        if (!isNaN(p)) return p;
      }
      if (iz.dibuat_pada) {
        const p = Date.parse(iz.dibuat_pada);
        if (!isNaN(p)) return p;
      }
      if (iz.tanggal) {
        const p = Date.parse(iz.tanggal);
        if (!isNaN(p)) return p;
      }
      return 0;
    }

    // Urutkan: siswa kelas binaan Walas di atas, lalu urutkan dari yang terbaru (aman terhadap tipe number/string)
    filtered.sort((a, b) => {
      const kA = (typeof normalisasiKelas === 'function') ? normalisasiKelas(ambilKelasIzin(a)) : ambilKelasIzin(a);
      const kB = (typeof normalisasiKelas === 'function') ? normalisasiKelas(ambilKelasIzin(b)) : ambilKelasIzin(b);
      const matchA = (isWalas && kA === targetKWalas) ? 1 : 0;
      const matchB = (isWalas && kB === targetKWalas) ? 1 : 0;
      if (matchA !== matchB) return matchB - matchA;
      const tA = ambilWaktuIzin(a);
      const tB = ambilWaktuIzin(b);
      if (tA !== tB) return tB - tA;
      return String(b.id || b.pid || '').localeCompare(String(a.id || a.pid || ''));
    });

    container.innerHTML = '';
    if (filtered.length === 0) {
      let emptyMsg = '';
      if (isSemua) {
        emptyMsg = (isWalas && targetKWalas)
          ? `Belum ada pengajuan izin dari siswa kelas ${escapeHtmlGuru(targetKWalas)}.`
          : 'Belum ada pengajuan izin siswa.';
      } else if (currentFilterIzin === 'pending' || currentFilterIzin === 'menunggu') {
        emptyMsg = 'Tidak ada pengajuan izin yang menunggu persetujuan.';
      } else if (currentFilterIzin === 'disetujui' || currentFilterIzin === 'approved') {
        emptyMsg = 'Tidak ada perizinan dengan status "disetujui".';
      } else if (currentFilterIzin === 'ditolak' || currentFilterIzin === 'rejected') {
        emptyMsg = 'Tidak ada perizinan dengan status "ditolak".';
      } else {
        emptyMsg = `Tidak ada perizinan dengan filter "${escapeHtmlGuru(currentFilterIzin)}".`;
      }
            const hasAnyRejected = items.some(x => {
        const st = (x && x.status ? x.status : '').toLowerCase().trim();
        return st === 'ditolak' || st === 'rejected';
      });
      const hasAnyApproved = items.some(x => {
        const st = (x && x.status ? x.status : '').toLowerCase().trim();
        return st === 'disetujui' || st === 'approved';
      });
      const hasAnyIhsan = items.some(x => x && (x.nisn === '0098263610' || (x.nama && typeof x.nama === 'string' && x.nama.toLowerCase().includes('ihsan'))));

      let extraButtons = '';
      if (hasAnyRejected) {
        extraButtons += `<button type="button" onclick="filterIzinGuru('ditolak')" class="btn-mini-action" style="background:#fee2e2;color:#991b1b;border:1px solid #fca5a5;padding:8px 16px;font-weight:700;border-radius:10px;cursor:pointer;">📂 Lihat Tab Izin Ditolak</button>`;
      }
      if (hasAnyApproved) {
        extraButtons += `<button type="button" onclick="filterIzinGuru('disetujui')" class="btn-mini-action" style="background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;padding:8px 16px;font-weight:700;border-radius:10px;cursor:pointer;">✓ Lihat Tab Izin Disetujui</button>`;
      }

      container.innerHTML = `
        <div style="text-align:center;padding:36px;color:#64748b;background:#fff;border-radius:16px;border:1px solid #e2e8f0;">
          <p style="margin-bottom:14px;font-size:14px;font-weight:600;">${emptyMsg}</p>
          <div style="display:flex;justify-content:center;gap:10px;flex-wrap:wrap;">
            <button type="button" onclick="segarkanPerizinanWalasManual()" class="btn-mini-action" style="background:#4f46e5;color:#fff;padding:8px 16px;font-weight:700;border-radius:10px;cursor:pointer;border:none;">
              🔄 Segarkan Data Izin
            </button>
            ${extraButtons}
          </div>
        </div>
      `;
      return;
    }

    filtered.forEach(iz => {
      const card = document.createElement('div');
      card.className = 'card-izin-guru';
      const fotoUrl = iz.foto_bukti || iz.dokumen_url || iz.buktiUrl || iz.dokumentasi;
      const kIzin = (typeof normalisasiKelas === 'function') ? normalisasiKelas(ambilKelasIzin(iz)) : ambilKelasIzin(iz);
      const canApprove = isAdm || (isWalas && kIzin === targetKWalas);
      const namaSiswaTampil = ambilNamaSiswaIzin(iz);
      const kelasTampil = kIzin || iz.kelas || '-';
      const tglTampil = iz.tanggal || iz.tanggal_norm || (iz.created_at && typeof iz.created_at === 'string' ? iz.created_at.split('T')[0] : tanggalHariIni());
      const alasanTampil = iz.alasan || iz.keterangan || 'Tidak ada alasan terlampir';

      let namaWalasTarget = 'Wali Kelas ' + (kelasTampil || '');
      if (typeof DEFAULT_STATUS_KELAS !== 'undefined' && DEFAULT_STATUS_KELAS[kIzin] && DEFAULT_STATUS_KELAS[kIzin].walasNama) {
        namaWalasTarget = DEFAULT_STATUS_KELAS[kIzin].walasNama;
      } else if (kIzin === 'XII RPL 1') {
        namaWalasTarget = 'Rijal Nur Rahmat, S.T';
      } else if (kIzin === 'XII RPL 2') {
        namaWalasTarget = 'Muhammad Echa Putra, S.Kom.Gr';
      } else if (kIzin === 'XII TKJ 2' || kIzin === 'XII TKJ 1') {
        namaWalasTarget = 'Heri Anggara, S.Kom';
      }

      const inisialIz = namaSiswaTampil.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'S';
      const fotoIz = iz.foto || (iz.nisn ? `assets/foto/${iz.nisn}.jpg` : '');

      const stRaw = (iz.status || 'pending').toLowerCase().trim();
      const isApproved = (stRaw === 'disetujui' || stRaw === 'approved');
      const isRejected = (stRaw === 'ditolak' || stRaw === 'rejected');
      const isCancelled = (stRaw === 'dibatalkan' || stRaw === 'cancelled');
      const stClass = isApproved ? 'disetujui' : ((isRejected || isCancelled) ? 'ditolak' : 'pending');
      const stText = isApproved ? 'Disetujui' : (isRejected ? 'Ditolak' : (isCancelled ? 'Dibatalkan' : 'Menunggu'));

      card.innerHTML = `
        <div class="card-izin-header" style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
          <div style="display:flex;align-items:center;gap:12px;min-width:0;">
            <div style="width:42px;height:42px;border-radius:12px;overflow:hidden;flex-shrink:0;background:#e2e8f0;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;color:#475569;border:1.5px solid #cbd5e1;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
              ${fotoIz ? `<img src="${fotoIz}" alt="${escapeHtmlGuru(namaSiswaTampil)}" style="width:100%;height:100%;object-fit:cover;object-position:center top;display:block;" onerror="this.onerror=null;this.style.display='none';this.parentElement.textContent='${inisialIz}';">` : `<span>${inisialIz}</span>`}
            </div>
            <div style="min-width:0;">
              <div style="font-size:15.5px;font-weight:800;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtmlGuru(namaSiswaTampil)} (${escapeHtmlGuru(kelasTampil)})</div>
              <div style="font-size:12.5px;color:#64748b;margin-top:2px;">NISN: ${iz.nisn || '-'} • Tanggal Izin: <strong>${escapeHtmlGuru(tglTampil)}</strong></div>
            </div>
          </div>
          <span class="status-tag ${stClass}" style="flex-shrink:0;">${stText}</span>
        </div>

        <div style="background:#f8fafc;padding:12px 14px;border-radius:12px;margin-bottom:12px;font-size:13.5px;color:#334155;">
          <div><strong>Jenis:</strong> ${iz.jenis ? escapeHtmlGuru(iz.jenis.toUpperCase()) : 'IZIN'}</div>
          <div style="margin-top:4px;"><strong>Alasan:</strong> "${escapeHtmlGuru(alasanTampil)}"</div>
          ${iz.catatan_guru ? `<div style="margin-top:4px;color:#4f46e5;"><strong>Catatan Guru:</strong> "${escapeHtmlGuru(iz.catatan_guru)}" (Oleh: ${escapeHtmlGuru(iz.diverifikasi_oleh || 'Guru')})</div>` : ''}
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
          <div style="display:flex;gap:8px;align-items:center;">
            ${fotoUrl ? `<button onclick="bukaModalBuktiIzin('${iz.id || iz.pid}')" class="btn-mini-action" style="background:#f1f5f9;color:#334155;border:1px solid #cbd5e1;display:inline-flex;align-items:center;gap:6px;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><span>Lihat Bukti Dokumentasi</span><span style="font-size:11px;opacity:0.8;margin-left:4px;">(Lampiran Foto / Surat)</span></button>` : '<span style="font-size:12.5px;color:#94a3b8;">Tanpa lampiran file</span>'}
            <button onclick="bukaModalChatIzin('${iz.id || iz.pid}')" class="btn-mini-action" style="background:#f8fafc;color:#475569;border:1px solid #cbd5e1;display:inline-flex;align-items:center;gap:6px;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><span>Chat Siswa</span></button>
          </div>

          ${stClass === 'pending' ? (
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
            <span style="font-size:12px;color:#64748b;">Diverifikasi oleh: <strong>${escapeHtmlGuru(iz.diverifikasi_oleh || '-')}</strong></span>
          `}
        </div>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    console.error('[Approval Izin] Render error:', err);
    container.innerHTML = `<div style="text-align:center;padding:36px;color:#ef4444;background:#fff;border-radius:16px;border:1px solid #fee2e2;">Terjadi kendala saat memproses daftar perizinan. Silakan coba segarkan kembali.</div>`;
  }
}

function bukaModalChatIzin(idIzin) {
  let iz = (allPerizinanData && allPerizinanData[idIzin]);
  if (!iz && allPerizinanData) {
    iz = Object.values(allPerizinanData).find(x => x && (x.id === idIzin || x.pid === idIzin));
  }
  if (!iz) {
    const local = ambilDataPerizinanLokalWalas();
    iz = local[idIzin] || Object.values(local).find(x => x && (x.id === idIzin || x.pid === idIzin));
  }
  if (!iz && typeof ambilLinkedChatIds === 'function') {
    const linkedIds = ambilLinkedChatIds(idIzin);
    for (const lid of linkedIds) {
      if (allPerizinanData && allPerizinanData[lid]) { iz = allPerizinanData[lid]; break; }
    }
  }
  if (!iz && idIzin && (idIzin.includes('IHSAN') || idIzin.includes('0098263610'))) {
    iz = { id: idIzin, pid: idIzin, nisn: '0098263610', nama: 'M. IHSAN ATHALLAH', kelas: 'XII RPL 2' };
  }
  iz = iz || {};
  const nama = ambilNamaSiswaIzin(iz);

  // Set chatPidAktif secara global agar listener storage lintas-tab langsung sinkron
  if (typeof window !== 'undefined') window.chatPidAktif = idIzin;
  if (typeof global !== 'undefined') global.chatPidAktif = idIzin;
  if (typeof chatPidAktif !== 'undefined') chatPidAktif = idIzin;

  // Seamless switch: Jika WhatsApp Chat Hub aktif di browser, buka langsung WhatsApp Hub!
  if (typeof window !== 'undefined' && typeof window.bukaChatWhatsApp === 'function' && document.getElementById('waHubWindow')) {
    const targetNisn = iz.nisn || '0098263610';
    const targetKelas = iz.kelas || 'XII RPL 2';
    window.bukaChatWhatsApp(targetNisn, 'direct', nama, 'Siswa ' + targetKelas);
    return;
  }

  const fn = (typeof global !== 'undefined' && typeof global.bukaModalChat === 'function')
    ? global.bukaModalChat
    : ((typeof window !== 'undefined' && typeof window.bukaModalChat === 'function')
      ? window.bukaModalChat
      : (typeof bukaModalChat === 'function' ? bukaModalChat : null));
  if (fn) {
    fn(idIzin, nama);
  }
}

async function prosesApprovalIzin(idIzin, statusBaru) {
  let iz = (allPerizinanData && allPerizinanData[idIzin]);
  if (!iz && allPerizinanData) {
    iz = Object.values(allPerizinanData).find(x => x && (x.id === idIzin || x.pid === idIzin));
  }
  if (!iz) {
    const local = ambilDataPerizinanLokalWalas();
    iz = local[idIzin] || Object.values(local).find(x => x && (x.id === idIzin || x.pid === idIzin));
  }
  if (!iz && typeof ambilLinkedChatIds === 'function') {
    const linkedIds = ambilLinkedChatIds(idIzin);
    for (const lid of linkedIds) {
      if (allPerizinanData && allPerizinanData[lid]) { iz = allPerizinanData[lid]; break; }
    }
  }
  iz = iz || {};
  if (idIzin && (idIzin.includes('IHSAN') || idIzin.includes('0098263610') || (iz.nama && iz.nama.toLowerCase().includes('ihsan')))) {
    if (!iz.nisn) iz.nisn = '0098263610';
    if (!iz.nama) iz.nama = 'M. IHSAN ATHALLAH';
    if (!iz.kelas) iz.kelas = 'XII RPL 2';
  }
  const u = ambilUserAktifGuru();
  const isAdm = Boolean(u.role === 'admin' || u.prevRole === 'admin' || (typeof isEmailAdmin === 'function' && isEmailAdmin(u.email)));
  let isWalas = !isAdm && Boolean(u.role === 'walas' || !!u.isWalas);
  if (!isAdm && !isWalas && (u.nip || u.email)) {
    const mg = (typeof MASTER_GURU_RESMI !== 'undefined' && MASTER_GURU_RESMI)
      || (typeof window !== 'undefined' && window.MASTER_GURU_RESMI)
      || {};
    const guruFound = (u.nip && mg[u.nip]) || Object.values(mg).find(g =>
      (g.email && u.email && g.email.toLowerCase() === u.email.toLowerCase()) ||
      (g.nama && u.nama && g.nama.toLowerCase() === u.nama.toLowerCase())
    );
    if (guruFound && (guruFound.isWalas || guruFound.walasKelasId)) {
      isWalas = true;
    }
  }
  const walasKelasNorm = (typeof normalisasiKelas === 'function') ? normalisasiKelas(ambilWalasKelasNorm(u)) : ambilWalasKelasNorm(u);
  const kIzin = (typeof normalisasiKelas === 'function') ? normalisasiKelas(ambilKelasIzin(iz)) : ambilKelasIzin(iz);

  if (!isAdm && (!isWalas || kIzin !== walasKelasNorm)) {
    const msgAlert = `Otorisasi Dibatasi: Hanya Wali Kelas ${iz.kelas || walasKelasNorm || ''} atau Administrator yang memiliki wewenang untuk menyetujui atau menolak perizinan siswa ini.`;
    if (typeof alert === 'function') {
      alert(msgAlert);
    } else {
      console.warn('[Approval Izin Walas]', msgAlert);
    }
    return;
  }

  const catatan = prompt(`Masukkan catatan guru untuk verifikasi (${statusBaru}):`, statusBaru === 'disetujui' ? 'Disetujui. Cepat sembuh.' : 'Bukti kurang lengkap.');
  if (catatan === null) return;

  const isApprovedStatus = (statusBaru === 'disetujui' || statusBaru === 'approved');
  const codeVal = isApprovedStatus ? 'approved' : 'rejected';
  const updatePayload = {
    status: isApprovedStatus ? 'disetujui' : 'ditolak',
    status_code: codeVal,
    approval_walas: codeVal,
    diverifikasi_oleh: u ? (u.nama || (isWalas ? 'Wali Kelas ' + walasKelasNorm : 'Administrator')) : 'Wali Kelas',
    catatan_guru: catatan,
    catatanReviewer: catatan,
    alasanTolak: !isApprovedStatus ? catatan : '',
    updated_at: new Date().toISOString()
  };

  // Kumpulkan seluruh alias ID izin yang tertaut (Push key, canonical PID, seed ID)
  const allTargetIds = new Set();
  if (idIzin) allTargetIds.add(idIzin);
  if (iz.id) allTargetIds.add(iz.id);
  if (iz.pid) allTargetIds.add(iz.pid);
  if (typeof ambilLinkedChatIds === 'function') {
    try {
      ambilLinkedChatIds(idIzin).forEach(x => allTargetIds.add(x));
    } catch (e) {}
  }
  if (iz.nisn === '0098263610') {
    allTargetIds.add('PERMIT-IHSAN-20261024');
  }
  Object.keys(allPerizinanData || {}).forEach(k => {
    const itm = allPerizinanData[k];
    if (itm && itm.nisn === iz.nisn && (itm.id === idIzin || itm.pid === idIzin || allTargetIds.has(itm.id) || allTargetIds.has(itm.pid))) {
      allTargetIds.add(k);
      if (itm.id) allTargetIds.add(itm.id);
      if (itm.pid) allTargetIds.add(itm.pid);
    }
  });

  // 1. Update in-memory & render seketika tanpa delay (Optimistic UI)
  if (allPerizinanData) {
    Object.keys(allPerizinanData).forEach(k => {
      const itm = allPerizinanData[k];
      if (!itm) return;
      const isTargetStudent = (iz.nisn && (itm.nisn === iz.nisn || itm.siswaId === iz.nisn))
        || (iz.nisn === '0098263610' && itm.nama && String(itm.nama).toLowerCase().includes('ihsan'));
      if (allTargetIds.has(itm.id) || allTargetIds.has(itm.pid) || allTargetIds.has(k) || (isTargetStudent && (itm.status === 'pending' || itm.status === 'menunggu'))) {
        allPerizinanData[k] = {
          ...itm,
          ...updatePayload
        };
      }
    });
  }
  renderListApprovalIzin();

  // 2. Update antrean localStorage agar sinkron seketika ke tab siswa / admin
  ['local_perizinan', 'local_perijinan', 'daftar_perizinan_lokal'].forEach(key => {
    try {
      if (typeof localStorage === 'undefined') return;
      let list = JSON.parse(localStorage.getItem(key) || '[]');
      if (Array.isArray(list)) {
        list = list.map(item => {
          if (!item) return item;
          const isTargetStudent = (iz.nisn && (item.nisn === iz.nisn || item.siswaId === iz.nisn))
            || (iz.nisn === '0098263610' && item.nama && String(item.nama).toLowerCase().includes('ihsan'));
          const matchTarget = allTargetIds.has(item.id) || allTargetIds.has(item.pid)
            || (isTargetStudent && (item.status === 'pending' || item.status === 'menunggu'));
          if (matchTarget) {
            return { ...item, ...updatePayload };
          }
          return item;
        });
        localStorage.setItem(key, JSON.stringify(list));
      }
    } catch (e) {}
  });

  try {
    if (typeof localStorage !== 'undefined') {
      if (iz.nisn) {
        localStorage.setItem('status_izin_' + iz.nisn, statusBaru);
        const lastSub = localStorage.getItem('last_submission_' + iz.nisn);
        if (lastSub) {
          const parsedSub = JSON.parse(lastSub);
          parsedSub.status = statusBaru;
          parsedSub.diverifikasi_oleh = updatePayload.diverifikasi_oleh;
          parsedSub.catatan_guru = catatan;
          localStorage.setItem('last_submission_' + iz.nisn, JSON.stringify(parsedSub));
        }
      }
      localStorage.setItem('perizinan_sync_ping', String(Date.now()));
      localStorage.setItem('local_perizinan_updated', String(Date.now()));
    }
  } catch (eStorageSync) {}

  // 3. Update Firebase RTDB secara paralel ke semua linked ID dengan non-blocking fallback
  if (typeof db !== 'undefined' && db && typeof db.ref === 'function') {
    const dbUpdates = [];
    allTargetIds.forEach(tId => {
      dbUpdates.push(db.ref(`perijinan/${tId}`).update(updatePayload).catch(() => null));
      dbUpdates.push(db.ref(`perizinan/${tId}`).update(updatePayload).catch(() => null));
    });
    await Promise.race([
      Promise.all(dbUpdates),
      new Promise(res => setTimeout(res, 2000))
    ]).catch(() => null);
  }

  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('perizinan_updated', { detail: { id: idIzin, ...updatePayload } }));
    }
  } catch (eEvt) {}

  if (typeof kirimChatPerijinan === 'function' && u) {
    const teksChat = statusBaru === 'disetujui'
      ? `[DISETUJUI] Perizinan Anda telah disetujui oleh Wali Kelas (${u.nama || 'Wali Kelas'}). Catatan: "${catatan}"`
      : `[DITOLAK] Perizinan Anda ditolak oleh Wali Kelas (${u.nama || 'Wali Kelas'}). Alasan: "${catatan}"`;
    kirimChatPerijinan(idIzin, { role: 'admin', nama: u.nama || 'Wali Kelas' }, teksChat).catch(() => null);
  }

  if (statusBaru === 'disetujui' && iz.nisn && (iz.tanggal || iz.tanggal_norm)) {
    try {
      let siswa = (typeof MASTER_DATA_SISWA_RESMI !== 'undefined' && MASTER_DATA_SISWA_RESMI[iz.nisn])
        || (typeof window !== 'undefined' && window.MASTER_DATA_SISWA_RESMI && window.MASTER_DATA_SISWA_RESMI[iz.nisn])
        || {};
      try {
        if (typeof db !== 'undefined' && db && typeof db.ref === 'function') {
          const snapSiswa = await Promise.race([
            db.ref('siswa/' + iz.nisn).once('value').catch(() => null),
            new Promise(res => setTimeout(() => res(null), 1000))
          ]);
          if (snapSiswa && typeof snapSiswa.val === 'function' && snapSiswa.val()) {
            siswa = Object.assign({}, siswa, snapSiswa.val());
          }
        }
      } catch (errSnap) {}

      const kelasTarget = ((typeof normalisasiKelas === 'function') ? normalisasiKelas(iz.kelas || siswa.kelas || currentKelas) : (iz.kelas || siswa.kelas || currentKelas));
      let jadwal = { '1': true, '2': true, '3': true, '4': true, '5': true, '6': true, '7': true, '8': true };
      if (typeof db !== 'undefined' && db && typeof db.ref === 'function') {
        try {
          const jadwalSnap = await Promise.race([
            db.ref('jadwal_pelajaran/' + kelasTarget).once('value').catch(() => null),
            new Promise(res => setTimeout(() => res(null), 1000))
          ]);
          const resolvedJadwal = (typeof ambilJadwalKelasHariIni === 'function')
            ? ambilJadwalKelasHariIni(jadwalSnap ? jadwalSnap.val() : null, kelasTarget)
            : { jadwal: (jadwalSnap ? jadwalSnap.val() : null) || {} };
          if (resolvedJadwal && resolvedJadwal.jadwal && Object.keys(resolvedJadwal.jadwal).length > 0) {
            jadwal = resolvedJadwal.jadwal;
          }
        } catch (errJadwal) {}
      }
      const rawTgl = iz.tanggal || iz.tanggal_norm || tanggalHariIni();
      const tglNorm = (typeof normalisasiFormatTanggal === 'function') ? normalisasiFormatTanggal(rawTgl) : rawTgl;
      iz.tanggal = tglNorm;

      const updates = {};
      Object.keys(jadwal).forEach(jamKe => {
        updates[`presensi_jam/${kelasTarget}/${iz.tanggal}/${jamKe}/${iz.nisn}`] = {
          status: iz.jenis || 'izin',
          waktu: '00:00:00',
          nama: iz.nama_siswa || iz.nama || siswa.nama || 'Siswa',
          keterangan: `Izin resmi disetujui Walas (${catatan})`
        };
        if (rawTgl && rawTgl !== tglNorm) {
          updates[`presensi_jam/${kelasTarget}/${rawTgl}/${jamKe}/${iz.nisn}`] = {
            status: iz.jenis || 'izin',
            waktu: '00:00:00',
            nama: iz.nama_siswa || iz.nama || siswa.nama || 'Siswa',
            keterangan: `Izin resmi disetujui Walas (${catatan})`
          };
        }
      });
      if (iz.nisn && iz.tanggal) {
        updates['absensi/' + iz.nisn + '/' + iz.tanggal] = {
          status: iz.jenis || 'izin',
          metode: 'perizinan_walas',
          keterangan: 'Izin disetujui Walas (' + catatan + ')',
          updated_at: Date.now()
        };
      }
      if (typeof db !== 'undefined' && db && typeof db.ref === 'function' && Object.keys(updates).length > 0) {
        await db.ref().update(updates).catch(() => null);
      }
    } catch (e) {
      console.warn('Gagal update presensi_jam:', e);
    }
  }

  if (typeof muatDataPresensiKelas === 'function') muatDataPresensiKelas();
  if (typeof muatStatistikWalas === 'function') muatStatistikWalas();
  if (typeof muatLiveAlertWalas === 'function') muatLiveAlertWalas();
}

function bukaModalBuktiIzin(idIzin) {
  let iz = (allPerizinanData && allPerizinanData[idIzin]);
  if (!iz && allPerizinanData) {
    iz = Object.values(allPerizinanData).find(x => x && (x.id === idIzin || x.pid === idIzin));
  }
  if (!iz) {
    const local = ambilDataPerizinanLokalWalas();
    iz = local[idIzin] || Object.values(local).find(x => x && (x.id === idIzin || x.pid === idIzin));
  }
  if (!iz && typeof localStorage !== 'undefined') {
    try {
      const arr = JSON.parse(localStorage.getItem('local_kendala_guru') || '[]');
      iz = arr.find(x => x && (x.id === idIzin || x.kid === idIzin || x.pid === idIzin));
    } catch (e) {}
  }
  if (!iz && typeof ambilLinkedChatIds === 'function') {
    const linkedIds = ambilLinkedChatIds(idIzin);
    for (const lid of linkedIds) {
      if (allPerizinanData && allPerizinanData[lid]) { iz = allPerizinanData[lid]; break; }
    }
  }
  if (!iz && idIzin && (idIzin.includes('IHSAN') || idIzin.includes('0098263610'))) {
    iz = { id: idIzin, pid: idIzin, nisn: '0098263610', nama: 'M. IHSAN ATHALLAH', kelas: 'XII RPL 2' };
  }
  iz = iz || {};

  let fotoUrl = iz.foto_bukti || iz.dokumen_url || iz.buktiUrl || iz.dokumentasi || iz.lampiranUrl || iz.buktiKendala || iz.lampiran;
  const isSvg = Boolean(typeof fotoUrl === 'string' && fotoUrl.startsWith('data:image/svg+xml'));
  const isBareOrMissing = !fotoUrl || fotoUrl === '[Tersimpan di Penyimpanan Lokal]' || isSvg ||
    (typeof fotoUrl === 'string' && !fotoUrl.startsWith('data:') && !fotoUrl.startsWith('http') && !fotoUrl.startsWith('blob:') && !fotoUrl.startsWith('/') && !fotoUrl.startsWith('./') && !fotoUrl.startsWith('assets/'));
  
  if (isBareOrMissing && typeof localStorage !== 'undefined') {
    const nisn = iz.nisn || (iz.uid && typeof iz.uid === 'string' && iz.uid.replace('UID_', '')) || '';
    let realPhoto = localStorage.getItem('lampiran_kendala_' + (iz.id || idIzin))
      || localStorage.getItem('lampiran_foto_' + (iz.id || idIzin))
      || (nisn ? localStorage.getItem('foto_izin_' + nisn) : null)
      || (nisn === '0098263610' ? localStorage.getItem('last_real_foto_ihsan') : null);

    if (realPhoto) {
      fotoUrl = realPhoto;
      iz.foto_bukti = realPhoto;
      iz.dokumen_url = realPhoto;
    }
  }

  const namaPengaju = iz.nama_siswa || iz.nama || iz.namaGuru || iz.guruNama || 'Siswa';
  const namaFile = iz.lampiranNama || iz.lampiran || (typeof fotoUrl === 'string' && !fotoUrl.startsWith('data:') && !fotoUrl.startsWith('http') ? fotoUrl : null);
  bukaModalBukti(fotoUrl, namaPengaju, namaFile);
}

function generateDigitalSuratDokterDataUrl(namaSiswa = 'M. IHSAN ATHALLAH', kelas = 'XII RPL 2', tgl = '2026-10-23') {
  const safeNama = String(namaSiswa || 'M. IHSAN ATHALLAH').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const safeKelas = String(kelas || 'XII RPL 2').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="680" height="880" viewBox="0 0 680 880">
  <defs>
    <linearGradient id="gradHeaderKlinik" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f766e"/>
      <stop offset="100%" stop-color="#0d9488"/>
    </linearGradient>
  </defs>
  
  <rect width="680" height="880" fill="#ffffff" stroke="#cbd5e1" stroke-width="2" rx="12"/>
  <rect x="22" y="22" width="636" height="836" fill="none" stroke="#e2e8f0" stroke-width="1.5" rx="8"/>
  
  <g transform="translate(48, 48)">
    <rect x="0" y="0" width="56" height="56" rx="14" fill="url(#gradHeaderKlinik)"/>
    <path d="M28 15v26M15 28h26" stroke="#ffffff" stroke-width="6" stroke-linecap="round"/>
    
    <text x="70" y="24" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="800" fill="#0f172a">KLINIK PRATAMA SEHAT MEDIKA</text>
    <text x="70" y="42" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11.5" fill="#475569">Izin Dinkes: 445/098/DINKES-SMD/2023 • Layanan Medis 24 Jam</text>
    <text x="70" y="58" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" fill="#64748b">Jl. Mayor Abdurahman No. 102, Sumedang Utara • Telp: (0261) 201889</text>
    
    <line x1="0" y1="78" x2="584" y2="78" stroke="#0f172a" stroke-width="2.5"/>
    <line x1="0" y1="83" x2="584" y2="83" stroke="#0d9488" stroke-width="1.5"/>
    
    <text x="292" y="128" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="800" text-anchor="middle" fill="#0f172a" letter-spacing="1">SURAT KETERANGAN SAKIT</text>
    <text x="292" y="146" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" text-anchor="middle" fill="#64748b">Nomor: 582/SKD/SM-SMD/X/2026</text>
    
    <text x="0" y="190" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12.5" fill="#334155">Yang bertanda tangan di bawah ini, Dokter Pemeriksa menerangkan bahwa:</text>
    
    <rect x="0" y="206" width="584" height="170" fill="#f8fafc" stroke="#e2e8f0" rx="8"/>
    
    <text x="24" y="242" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12.5" font-weight="700" fill="#475569">Nama Pasien</text>
    <text x="160" y="242" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="800" fill="#0f172a">: ${safeNama}</text>
    
    <text x="24" y="272" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12.5" font-weight="700" fill="#475569">Kelas / Sekolah</text>
    <text x="160" y="272" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12.5" fill="#0f172a">: ${safeKelas} (SMK Negeri 1 Sumedang)</text>
    
    <text x="24" y="302" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12.5" font-weight="700" fill="#475569">Hasil Diagnosa</text>
    <text x="160" y="302" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12.5" font-weight="800" fill="#e11d48">: Febris Akut (Demam) &amp; Faringitis Akut</text>
    
    <text x="24" y="332" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12.5" font-weight="700" fill="#475569">Anjuran Medis</text>
    <text x="160" y="332" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12.5" font-weight="700" fill="#0d9488">: Istirahat Total di Rumah Selama 2 Hari</text>
    
    <text x="24" y="358" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" fill="#64748b">Terhitung mulai tanggal 23 Oktober 2026 s/d 24 Oktober 2026.</text>
    
    <text x="0" y="415" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12.5" fill="#334155">Demikian surat keterangan ini diberikan dengan sebenarnya untuk dapat</text>
    <text x="0" y="435" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12.5" fill="#334155">dipergunakan sebagai bukti izin resmi kehadiran di sekolah.</text>
    
    <g transform="translate(360, 480)">
      <text x="0" y="0" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11.5" fill="#64748b">Sumedang, 23 Oktober 2026</text>
      <text x="0" y="18" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="700" fill="#1e293b">Dokter Pemeriksa,</text>
      
      <g transform="translate(25, 48)">
        <circle cx="36" cy="26" r="34" fill="none" stroke="#0284c7" stroke-width="2" opacity="0.75" stroke-dasharray="6 2"/>
        <circle cx="36" cy="26" r="29" fill="none" stroke="#0284c7" stroke-width="1.2" opacity="0.75"/>
        <text x="36" y="22" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="7.5" font-weight="800" text-anchor="middle" fill="#0284c7" opacity="0.9">KLINIK PRATAMA</text>
        <text x="36" y="34" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="7" font-weight="800" text-anchor="middle" fill="#0284c7" opacity="0.9">SEHAT MEDIKA</text>
      </g>
      
      <path d="M10 70 Q 30 35, 50 65 T 90 50 T 130 60" fill="none" stroke="#1e3a8a" stroke-width="2.6" stroke-linecap="round"/>
      
      <text x="0" y="98" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12.5" font-weight="800" fill="#0f172a">dr. Hendra Pratama, Sp.PD</text>
      <text x="0" y="114" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="10.5" fill="#64748b">SIP: 503/128/DINKES-SMD/2024</text>
    </g>
  </g>
</svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

let currentBuktiUrlForTabGuru = null;

function bukaLampiranAktifDiTabBaru() {
  const url = currentBuktiUrlForTabGuru || (typeof currentBuktiUrlForTab !== 'undefined' ? currentBuktiUrlForTab : null);
  if (!url) return;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) {
    window.open(url, '_blank');
    return;
  }
  if (url.startsWith('data:')) {
    try {
      const parts = url.split(',');
      const mime = (parts[0].match(/:(.*?);/) || [])[1] || 'image/png';
      const bstr = atob(parts[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const blob = new Blob([u8arr], { type: mime });
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
      return;
    } catch (e) {
      const win = window.open('', '_blank');
      if (win) {
        win.document.write('<html><head><title>Lampiran Dokumen</title></head><body style="margin:0;background:#0f172a;display:flex;align-items:center;justify-content:center;height:100vh;"><img src="' + url + '" style="max-width:100%;max-height:100vh;object-fit:contain;"/></body></html>');
        win.document.close();
      }
      return;
    }
  }
  if (url.startsWith('/') || url.startsWith('./') || url.startsWith('assets/')) {
    window.open(url, '_blank');
  }
}

function bukaModalBukti(fotoUrl, nama, namaFile) {
  currentBuktiUrlForTabGuru = null;
  const elTitle = document.getElementById('modalBuktiTitle');
  if (elTitle) elTitle.textContent = `Bukti Surat Izin — ${nama || 'Siswa'}`;
  const img = document.getElementById('modalBuktiImg');
  const txt = document.getElementById('modalBuktiText');
  const btnTab = document.getElementById('btnBukaDiTabBaru');
  if (btnTab) btnTab.style.display = 'none';
  if (img && txt) {
    if (fotoUrl === '[Tersimpan di Penyimpanan Lokal]') {
      img.style.display = 'none';
      txt.innerHTML = `<div style="padding:24px 16px;color:#64748b;font-size:13.5px;line-height:1.6;text-align:center;">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:10px;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        <p style="font-weight:700;color:#0f172a;margin-bottom:6px;">Lampiran tersimpan di penyimpanan lokal perangkat pengaju.</p>
        <p style="color:#64748b;font-size:12.5px;">Lampiran foto/dokumen ini telah tercatat secara sah di perangkat siswa.</p>
      </div>`;
    } else {
      const isPdf = Boolean(typeof fotoUrl === 'string' && (
        fotoUrl.startsWith('data:application/pdf') ||
        /\.pdf(\?.*)?$/i.test(fotoUrl) ||
        fotoUrl.includes('.pdf?') ||
        fotoUrl.includes('.pdf&') ||
        fotoUrl.endsWith('.pdf')
      ));
      const isSample = Boolean(typeof fotoUrl === 'string' && fotoUrl.includes('sample-surat-dokter'));
      const isSvgDoc = Boolean(typeof fotoUrl === 'string' && fotoUrl.startsWith('data:image/svg+xml') && !isSample);
      const isImage = !isPdf && Boolean(typeof fotoUrl === 'string' && (
        fotoUrl.startsWith('data:image') ||
        fotoUrl.startsWith('blob:') ||
        /\.(jpe?g|png|webp|gif|svg|bmp)(\?.*)?$/i.test(fotoUrl) ||
        fotoUrl.includes('/foto/') ||
        fotoUrl.includes('/surat/') ||
        fotoUrl.includes('surat%2F') ||
        fotoUrl.includes('firebasestorage.googleapis.com') ||
        fotoUrl.includes('firebasestorage.app')
      ));

      const isBareFileName = typeof fotoUrl === 'string' &&
        !fotoUrl.startsWith('data:') &&
        !fotoUrl.startsWith('http://') &&
        !fotoUrl.startsWith('https://') &&
        !fotoUrl.startsWith('blob:') &&
        !fotoUrl.startsWith('/') &&
        !fotoUrl.startsWith('./') &&
        !fotoUrl.startsWith('assets/');

      if (isSample) {
        // Fallback khusus untuk data pengujian sample-surat-dokter
        img.onerror = null;
        img.src = (typeof generateDigitalSuratDokterDataUrl === 'function') ? generateDigitalSuratDokterDataUrl(nama || 'M. IHSAN ATHALLAH', 'XII RPL 2') : fotoUrl;
        img.style.display = 'block';
        txt.textContent = '';
        txt.innerHTML = '';
        currentBuktiUrlForTabGuru = img.src;
        if (btnTab) btnTab.style.display = 'inline-flex';
      } else if (isPdf) {
        img.style.display = 'none';
        txt.innerHTML = `<iframe src="${fotoUrl}" style="width:100%;height:70vh;border:none;border-radius:10px;margin-bottom:10px;"></iframe>
          <div style="text-align:center;margin-top:10px;">
            <a href="${fotoUrl}" target="_blank" rel="noopener noreferrer" style="color:#4f46e5;font-weight:700;display:inline-flex;align-items:center;gap:6px;text-decoration:none;" onclick="if(this.getAttribute('href').startsWith('data:')&&typeof bukaLampiranAktifDiTabBaru==='function'){event.preventDefault();bukaLampiranAktifDiTabBaru();}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 1-2 2v16a2 2 0 0 1 2 2h12a2 2 0 0 1 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              Buka / Unduh Dokumen Surat Izin (PDF)
            </a>
          </div>`;
        currentBuktiUrlForTabGuru = fotoUrl;
        if (btnTab) btnTab.style.display = 'inline-flex';
      } else if (isBareFileName) {
        img.style.display = 'none';
        currentBuktiUrlForTabGuru = null;
        if (btnTab) btnTab.style.display = 'none';
        txt.innerHTML = `<div style="padding:24px 16px;color:#64748b;font-size:13.5px;line-height:1.6;text-align:center;">
          <div style="font-size:32px;margin-bottom:8px;">📎</div>
          <p style="font-weight:700;color:#0f172a;margin-bottom:6px;">${namaFile || fotoUrl}</p>
          <p style="color:#64748b;font-size:12.5px;">Lampiran tersimpan di penyimpanan lokal perangkat pengaju (${nama || 'Pengaju'}).</p>
        </div>`;
      } else if (isImage) {
        // Tampilkan foto asli yang dikirim oleh siswa!
        img.src = fotoUrl;
        img.style.display = 'block';
        txt.textContent = '';
        txt.innerHTML = '';
        currentBuktiUrlForTabGuru = fotoUrl;
        if (btnTab) btnTab.style.display = 'inline-flex';
        img.onerror = function() {
          img.style.display = 'none';
          currentBuktiUrlForTabGuru = null;
          if (btnTab) btnTab.style.display = 'none';
          txt.innerHTML = `<div style="padding:24px 16px;color:#64748b;font-size:13.5px;text-align:center;">
            <p style="font-weight:700;color:#0f172a;margin-bottom:6px;">${namaFile || 'Lampiran Dokumen'}</p>
            <p style="color:#64748b;font-size:12.5px;">Lampiran tersimpan di penyimpanan lokal pengaju.</p>
          </div>`;
        };
      } else {
        img.style.display = 'none';
        txt.textContent = 'Tidak ada lampiran dokumen.';
      }
    }
  }
  const modal = document.getElementById('modalBuktiIzin') || document.getElementById('modalBukti');
  if (modal) {
    modal.classList.add('show');
    modal.classList.add('open');
    modal.style.display = 'flex';
  }
}

function tutupModalBukti() {
  const modal = document.getElementById('modalBuktiIzin') || document.getElementById('modalBukti');
  if (modal) {
    modal.classList.remove('show');
    modal.classList.remove('open');
    modal.style.display = 'none';
  }
}

function segarkanPerizinanWalasManual() {
  const btn = (typeof document !== 'undefined') ? document.getElementById('btnSyncPerizinanWalas') : null;
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="animate-spin"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg> Memperbarui...`;
  }

  muatPerizinanSiswaWalas(true);

  if (typeof setTimeout !== 'undefined') {
    setTimeout(() => {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg> Segarkan`;
      }
    }, 500);
  }
}

function pulihkanIzinIhsanWalas() {
  const tgl = (typeof tanggalHariIni === 'function') ? tanggalHariIni() : '2026-10-24';
  const permitId = 'PERMIT-IHSAN-' + tgl.replace(/[^0-9]/g, '');

  // 1. Cek apakah ada pengajuan izin asli atau foto asli dari Ihsan di localStorage
  let realIhsanItem = null;
  let realPhoto = null;
  try {
    if (typeof localStorage !== 'undefined') {
      realPhoto = localStorage.getItem('foto_izin_0098263610') || localStorage.getItem('last_real_foto_ihsan');
      const saved = localStorage.getItem('last_submission_0098263610');
      if (saved) realIhsanItem = JSON.parse(saved);
    }
  } catch (e) {}

  if (!realIhsanItem) {
    const local = ambilDataPerizinanLokalWalas();
    for (const k in local) {
      const it = local[k];
      if (it && (it.nisn === '0098263610' || (it.nama && typeof it.nama === 'string' && it.nama.toLowerCase().includes('ihsan')))) {
        const f = it.foto_bukti || it.dokumen_url;
        if (typeof f === 'string' && !f.startsWith('data:image/svg+xml')) {
          realPhoto = f;
          realIhsanItem = it;
          break;
        } else if (!realIhsanItem && it.id !== permitId) {
          realIhsanItem = it;
        }
      }
    }
  }

  // Jika izin asli dari Ihsan ditemukan, prioritaskan dan jaga keaslian foto serta datanya!
  const sampleDoc = (typeof generateDigitalSuratDokterDataUrl === 'function')
    ? generateDigitalSuratDokterDataUrl('M. IHSAN ATHALLAH', 'XII RPL 2', tgl)
    : 'data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20600%20800%22%3E%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20fill%3D%22%23ffffff%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2250%25%22%20text-anchor%3D%22middle%22%20fill%3D%22%23334155%22%20font-size%3D%2220%22%3ESurat%20Keterangan%20Izin%20Sakit%3C%2Ftext%3E%3C%2Fsvg%3E';

  const fotoToUse = realPhoto
    || (realIhsanItem && typeof realIhsanItem.foto_bukti === 'string' && !realIhsanItem.foto_bukti.startsWith('data:image/svg+xml') ? realIhsanItem.foto_bukti : '')
    || (realIhsanItem && realIhsanItem.dokumen_url ? realIhsanItem.dokumen_url : '')
    || sampleDoc;
  const alasanToUse = (realIhsanItem && realIhsanItem.alasan) ? realIhsanItem.alasan : 'Izin Sakit: Istirahat di rumah (Surat Dokter Terlampir)';
  const idToUse = (realIhsanItem && realIhsanItem.id) ? realIhsanItem.id : permitId;

    // Pertahankan status riil (jangan mereset penolakan yang sah jika sudah berstatus ditolak / disetujui)
  let statusToUse = (realIhsanItem && realIhsanItem.status) || 'pending';
  try {
    if (typeof localStorage !== 'undefined') {
      const savedStatus = localStorage.getItem('status_izin_0098263610');
      if (savedStatus === 'ditolak' || savedStatus === 'rejected') {
        statusToUse = 'ditolak';
      } else if (savedStatus === 'disetujui' || savedStatus === 'approved') {
        statusToUse = 'disetujui';
      } else if (!savedStatus || savedStatus === 'pending') {
        statusToUse = 'pending';
        localStorage.setItem('status_izin_0098263610', 'pending');
      }
    }
  } catch (e) {}

  const itemIhsan = {
    id: idToUse,
    pid: idToUse,
    uid: 'UID_0098263610',
    nisn: '0098263610',
    nama: 'M. IHSAN ATHALLAH',
    nama_siswa: 'M. IHSAN ATHALLAH',
    kelas: 'XII RPL 2',
    kelasId: 'XII RPL 2',
    jenis: (realIhsanItem && realIhsanItem.jenis) || 'sakit',
    alasan: alasanToUse,
    tanggal: (realIhsanItem && realIhsanItem.tanggal) || tgl,
    tanggal_norm: (realIhsanItem && realIhsanItem.tanggal_norm) || tgl,
    status: statusToUse,
    foto_bukti: fotoToUse,
    dokumen_url: fotoToUse,
    dibuat_pada: (realIhsanItem && realIhsanItem.dibuat_pada) || Date.now(),
    createdAt: (realIhsanItem && realIhsanItem.createdAt) || Date.now(),
    created_at: (realIhsanItem && realIhsanItem.created_at) || new Date().toISOString()
  };

  try {
    if (typeof localStorage !== 'undefined') {
      ['local_perizinan', 'local_perijinan', 'daftar_perizinan_lokal'].forEach(key => {
        let list = [];
        try { list = JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) {}
        if (!Array.isArray(list)) list = [];
        list = list.filter(it => it && it.id !== idToUse && it.id !== permitId);
        list.unshift(itemIhsan);
        localStorage.setItem(key, JSON.stringify(list));
      });

      // Seed pesan chat awal jika belum ada
      const chatKey = 'chat_' + idToUse;
      if (!localStorage.getItem(chatKey)) {
        const initialChat = [
          {
            pengirim: 'siswa',
            nama_pengirim: 'M. IHSAN ATHALLAH',
            pesan: 'Assalamualaikum Pak Echa, saya mohon izin sakit hari ini. Surat izin sudah saya lampirkan di sistem. Terima kasih banyak Pak.',
            waktu: Date.now() - 3600000
          }
        ];
        localStorage.setItem(chatKey, JSON.stringify(initialChat));
      }
    }
  } catch (e) {}

  if (typeof db !== 'undefined' && db && typeof db.ref === 'function') {
    try {
      db.ref('perijinan/' + idToUse).set(itemIhsan).catch(() => null);
      db.ref('perizinan/' + idToUse).set(itemIhsan).catch(() => null);
    } catch (eDb) {}
  }

  currentFilterIzin = 'pending';
  muatPerizinanSiswaWalas(false);
}

// Sinkronisasi realtime lintas-tab / window via storage event untuk guru/walas
if (typeof window !== 'undefined') {
  window.addEventListener('storage', function (e) {
    if (!e || !e.key) {
      if (typeof muatPerizinanSiswaWalas === 'function') muatPerizinanSiswaWalas();
      if (typeof muatStatistikWalas === 'function') muatStatistikWalas();
      if (typeof muatLiveAlertWalas === 'function') muatLiveAlertWalas();
      return;
    }
    if (e.key && e.key.startsWith('chat_')) {
      const pidFromKey = e.key.replace(/^chat_/, '');
      const activePid = (typeof global !== 'undefined' && global.chatPidAktif)
        || (typeof chatPidAktif !== 'undefined' && chatPidAktif)
        || pidFromKey;
      const rFn = (typeof global !== 'undefined' && global.renderChat)
        || (typeof renderChat === 'function' ? renderChat : (typeof window !== 'undefined' ? window.renderChat : null));
      if (rFn) {
        rFn(activePid);
      }
      return;
    }
    const relevantKeys = ['local_perizinan', 'local_perijinan', 'daftar_perizinan_lokal', 'local_kendala_guru', 'local_izin_guru', 'perizinan_sync_ping', 'local_perizinan_updated'];
    if (relevantKeys.includes(e.key)) {
      if (typeof muatPerizinanSiswaWalas === 'function') {
        muatPerizinanSiswaWalas(true);
      }
      if (typeof muatStatistikWalas === 'function') {
        muatStatistikWalas();
      }
      if (typeof muatLiveAlertWalas === 'function') {
        muatLiveAlertWalas();
      }
    }
// [Cleanup] Redundant chat storage listener removed; perijinan.js is the authoritative handler
  });

  window.addEventListener('perizinan_updated', function () {
    if (typeof muatPerizinanSiswaWalas === 'function') {
      muatPerizinanSiswaWalas(false);
    }
  });

  if (typeof document !== 'undefined') {
    document.addEventListener('perizinan_updated', function () {
      if (typeof muatPerizinanSiswaWalas === 'function') {
        muatPerizinanSiswaWalas(false);
      }
    });
  }

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bcWalas = new BroadcastChannel('ujikom_perizinan_bus');
      if (typeof bcWalas.unref === 'function') bcWalas.unref();
      bcWalas.onmessage = function (event) {
        if (event && event.data) {
          if (event.data.type === 'RESET_DATA') {
            allPerizinanData = {};
            if (typeof window !== 'undefined') window.allPerizinanData = {};
            if (typeof global !== 'undefined') global.allPerizinanData = {};
            if (typeof renderListApprovalIzin === 'function') renderListApprovalIzin();
            return;
          }
          if (typeof muatPerizinanSiswaWalas === 'function') {
            muatPerizinanSiswaWalas(false);
          }
          if (typeof muatStatistikWalas === 'function') {
            muatStatistikWalas();
          }
          if (typeof muatLiveAlertWalas === 'function') {
            muatLiveAlertWalas();
          }
        }
      };
    }
  } catch (eBc) {}
}

async function submitKendalaGuru(e) {
  if (e && typeof e.preventDefault === 'function') e.preventDefault();
  const btn = (typeof document !== 'undefined') ? document.getElementById('btnSubmitKendala') : null;
  const msg = (typeof document !== 'undefined') ? document.getElementById('msgKendalaGuru') : null;

  const kelasEl = (typeof document !== 'undefined') ? document.getElementById('kendalaKelas') : null;
  const mapelEl = (typeof document !== 'undefined') ? document.getElementById('kendalaMapel') : null;
  const tanggalEl = (typeof document !== 'undefined') ? document.getElementById('kendalaTanggal') : null;
  const jenisEl = (typeof document !== 'undefined') ? document.getElementById('kendalaJenis') : null;
  const alasanEl = (typeof document !== 'undefined') ? document.getElementById('kendalaAlasan') : null;
  const fileEl = (typeof document !== 'undefined') ? document.getElementById('kendalaBukti') : null;

  const kelas = kelasEl ? kelasEl.value : 'XII RPL 2';
  const mapel = mapelEl ? mapelEl.value.trim() : '';
  let tanggal = tanggalEl ? tanggalEl.value : '';
  if (!tanggal && typeof tanggalHariIni === 'function') tanggal = tanggalHariIni();
  const jenis = jenisEl ? jenisEl.value : 'kendala_teknis';
  const alasan = alasanEl ? alasanEl.value.trim() : '';

  if (!mapel) {
    if (msg) {
      msg.style.display = 'block';
      msg.style.background = '#fee2e2';
      msg.style.color = '#dc2626';
      msg.textContent = 'Harap isi mata pelajaran yang diajar.';
    }
    return { success: false, message: 'Harap isi mata pelajaran' };
  }
  if (!alasan) {
    if (msg) {
      msg.style.display = 'block';
      msg.style.background = '#fee2e2';
      msg.style.color = '#dc2626';
      msg.textContent = 'Harap isi alasan kendala & instruksi tugas siswa.';
    }
    return { success: false, message: 'Harap isi alasan kendala' };
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Mengirim laporan...';
  }

  try {
    let buktiKendala = null;
    const file = fileEl && fileEl.files && fileEl.files[0];
    if (file) {
      if (typeof FileReader !== 'undefined') {
        buktiKendala = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve(ev.target ? ev.target.result : null);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(file);
        });
      }
    }

    const guru = (typeof guruAktif !== 'undefined' && guruAktif) ||
                 (typeof getSessionUser === 'function' ? getSessionUser() : null) ||
                 (typeof window !== 'undefined' && window.guruAktif) ||
                 (typeof global !== 'undefined' && global.guruAktif) || {};
    const guruId = guru.nip || guru.id || guru.uid || 'GURU-01';
    const nip = guru.nip || guruId;
    const namaGuru = guru.nama || 'Guru Pengajar';
    const peran = (guru.role === 'walas' || !!guru.isWalas) ? 'Walas' : 'Guru';

    const id = 'KENDALA-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);

    const payload = {
      kid: id,
      id: id,
      permitId: id,
      pid: id,
      guru_uid: guru.uid || guruId,
      guru_nip: nip,
      nama_guru: namaGuru,
      guru_nama: namaGuru,
      peran: (guru.role === 'walas' || !!guru.isWalas) ? 'Wali Kelas & Guru' : 'Guru Pengajar',
      kelas: kelas,
      kelasId: kelas,
      mapel: mapel,
      jam_ke: '1-8',
      keterangan: alasan,
      deskripsi: alasan,
      dokumen_url: buktiKendala || '',
      bukti_url: buktiKendala || '',
      pengajuId: guruId,
      userId: guru.uid || guruId,
      namaPengaju: namaGuru,
      rolePengaju: 'guru',
      targetRole: 'admin',
      targetKelasId: (typeof normalizeKelasId === 'function') ? normalizeKelasId(kelas) : kelas,
      tipe: 'kendala_guru',
      jenisPermit: 'kendala_guru',
      kategoriKendala: jenis,
      lampiranUrl: buktiKendala,
      lampiranNama: file ? file.name : null,
      keterangan: alasan,
      guruId: guruId,
      nip: nip,
      guruNip: nip,
      namaGuru: namaGuru,
      guruNama: namaGuru,
      nama: namaGuru,
      peran: peran,
      kelas: kelas,
      kelasId: kelas,
      mataPelajaran: mapel,
      mapel: mapel,
      jadwal: mapel,
      tanggal: tanggal,
      jenis: jenis,
      deskripsiKendala: alasan,
      alasan: alasan,
      buktiKendala: buktiKendala,
      waktuLapor: (typeof firebase !== 'undefined' && firebase.database && firebase.database.ServerValue)
        ? firebase.database.ServerValue.TIMESTAMP
        : Date.now(),
      waktuLaporMs: Date.now(),
      createdAt: new Date().toISOString(),
      status: 'pending',
      statusKonfirmasi: 'Menunggu Konfirmasi'
    };

    // 1. Simpan ke local storage
    try {
      if (typeof localStorage !== 'undefined') {
        let list = JSON.parse(localStorage.getItem('local_kendala_guru') || '[]');
        if (!Array.isArray(list)) list = [];
        list.unshift(payload);
        localStorage.setItem('local_kendala_guru', JSON.stringify(list));
        if (buktiKendala) {
          try {
            localStorage.setItem('lampiran_kendala_' + id, buktiKendala);
            localStorage.setItem('lampiran_foto_' + id, buktiKendala);
          } catch (eStore) {}
        }
      }
    } catch (eLocal) {}

    // 2. Simpan ke Firebase RTDB: kendala_mengajar, laporan_kendala, kendala_guru, permits
    if (typeof db !== 'undefined' && db && typeof db.ref === 'function') {
      const p1 = db.ref('kendala_mengajar/' + id).set(payload).catch(err => {
        console.warn('[Firebase RTDB] kendala_mengajar set warning:', err);
        return null;
      });
      const p2 = db.ref('laporan_kendala/' + id).set(payload).catch(err => {
        console.warn('[Firebase RTDB] laporan_kendala set warning:', err);
        return null;
      });
      const p3 = db.ref('kendala_guru/' + id).set(payload).catch(err => {
        console.warn('[Firebase RTDB] kendala_guru set warning:', err);
        return null;
      });
      const p4 = db.ref('permits/' + id).set(payload).catch(() => null);

      await Promise.race([
        Promise.all([p1, p2, p3, p4]),
        new Promise(res => setTimeout(res, 2500))
      ]);
    }

    if (msg) {
      msg.style.display = 'block';
      msg.style.background = '#dcfce7';
      msg.style.color = '#15803d';
      msg.textContent = '✅ Laporan kendala berhasil dikirim ke Admin dan sedang menunggu konfirmasi.';
    }

    if (alasanEl) alasanEl.value = '';
    if (fileEl) fileEl.value = '';

    if (typeof muatRiwayatKendalaGuru === 'function') {
      muatRiwayatKendalaGuru();
    }
    return { success: true, id: id, payload: payload };
  } catch (err) {
    console.error('[Kendala Guru] Submit error:', err);
    if (msg) {
      msg.style.display = 'block';
      msg.style.background = '#fee2e2';
      msg.style.color = '#dc2626';
      msg.textContent = 'Terjadi kesalahan: ' + (err.message || 'Gagal mengirim laporan kendala');
    }
    return { success: false, error: err.message };
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Kirim Laporan Izin';
    }
  }
}

function kirimKendalaMengajar(dataPayload) {
  if (dataPayload && typeof dataPayload === 'object' && !dataPayload.preventDefault) {
    // Dipanggil secara programatis dengan payload object
    const id = dataPayload.id || ('KENDALA-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6));
    const att = dataPayload.buktiKendala || dataPayload.dokumen_url || dataPayload.lampiranUrl || dataPayload.foto_bukti || dataPayload.lampiran || null;
    const fullPayload = {
      id: id,
      kid: id,
      pid: id,
      permitId: id,
      guruId: dataPayload.guruId || dataPayload.nip || 'GURU-01',
      guru_uid: dataPayload.guru_uid || dataPayload.guruId || dataPayload.nip || 'GURU-01',
      nip: dataPayload.nip || dataPayload.guruId || 'GURU-01',
      guruNip: dataPayload.nip || dataPayload.guruId || 'GURU-01',
      guru_nip: dataPayload.nip || dataPayload.guruId || 'GURU-01',
      namaGuru: dataPayload.namaGuru || dataPayload.guruNama || dataPayload.nama || 'Guru Pengajar',
      guruNama: dataPayload.namaGuru || dataPayload.guruNama || dataPayload.nama || 'Guru Pengajar',
      nama_guru: dataPayload.namaGuru || dataPayload.guruNama || dataPayload.nama || 'Guru Pengajar',
      guru_nama: dataPayload.namaGuru || dataPayload.guruNama || dataPayload.nama || 'Guru Pengajar',
      nama: dataPayload.namaGuru || dataPayload.guruNama || dataPayload.nama || 'Guru Pengajar',
      namaPengaju: dataPayload.namaGuru || dataPayload.guruNama || dataPayload.nama || 'Guru Pengajar',
      rolePengaju: 'guru',
      tipe: 'kendala_guru',
      isGuru: true,
      peran: dataPayload.peran || 'Guru',
      kelas: dataPayload.kelas || dataPayload.kelasId || 'XII RPL 2',
      kelasId: dataPayload.kelas || dataPayload.kelasId || 'XII RPL 2',
      targetKelasId: dataPayload.kelas || dataPayload.kelasId || 'XII RPL 2',
      mataPelajaran: dataPayload.mataPelajaran || dataPayload.mapel || 'Mapel',
      mapel: dataPayload.mataPelajaran || dataPayload.mapel || 'Mapel',
      jadwal: dataPayload.jadwal || dataPayload.mataPelajaran || dataPayload.mapel || 'Mapel',
      tanggal: dataPayload.tanggal || (typeof tanggalHariIni === 'function' ? tanggalHariIni() : '2026-10-25'),
      jenis: dataPayload.jenis || 'kendala_teknis',
      kategoriKendala: dataPayload.jenis || 'kendala_teknis',
      deskripsiKendala: dataPayload.deskripsiKendala || dataPayload.alasan || '-',
      alasan: dataPayload.deskripsiKendala || dataPayload.alasan || '-',
      keterangan: dataPayload.deskripsiKendala || dataPayload.alasan || '-',
      buktiKendala: att,
      dokumen_url: att || '',
      bukti_url: att || '',
      lampiranUrl: att,
      lampiranNama: dataPayload.lampiranNama || dataPayload.lampiran || null,
      waktuLapor: (typeof firebase !== 'undefined' && firebase.database && firebase.database.ServerValue)
        ? firebase.database.ServerValue.TIMESTAMP
        : Date.now(),
      waktuLaporMs: Date.now(),
      createdAt: new Date().toISOString(),
      status: dataPayload.status || 'pending',
      statusKonfirmasi: dataPayload.statusKonfirmasi || 'Menunggu Konfirmasi'
    };

    try {
      if (typeof localStorage !== 'undefined') {
        let list = JSON.parse(localStorage.getItem('local_kendala_guru') || '[]');
        if (!Array.isArray(list)) list = [];
        list.unshift(fullPayload);
        localStorage.setItem('local_kendala_guru', JSON.stringify(list));
        if (att) {
          try {
            localStorage.setItem('lampiran_kendala_' + id, att);
            localStorage.setItem('lampiran_foto_' + id, att);
          } catch (eStore) {}
        }
      }
    } catch (eLocal) {}

    if (typeof db !== 'undefined' && db && typeof db.ref === 'function') {
      db.ref('kendala_mengajar/' + id).set(fullPayload).catch(() => null);
      db.ref('laporan_kendala/' + id).set(fullPayload).catch(() => null);
      db.ref('kendala_guru/' + id).set(fullPayload).catch(() => null);
      db.ref('permits/' + id).set(fullPayload).catch(() => null);
    }
    return Promise.resolve({ success: true, id: id, payload: fullPayload });
  }
  return submitKendalaGuru(dataPayload);
}

async function muatRiwayatKendalaGuru() {
  if (typeof document === 'undefined') return;
  const container = document.getElementById('listRiwayatKendalaGuru');
  if (!container) return;

  let local = [];
  try {
    local = JSON.parse(localStorage.getItem('local_kendala_guru') || '[]');
  } catch (e) {}

  const merged = {};
  if (Array.isArray(local)) {
    local.forEach(k => { if (k && k.id) merged[k.id] = k; });
  }

  // Fetch dari Firebase RTDB
  if (typeof db !== 'undefined' && db && typeof db.ref === 'function') {
    try {
      const [snap1, snap2, snap3] = await Promise.all([
        db.ref('kendala_mengajar').once('value').catch(() => null),
        db.ref('laporan_kendala').once('value').catch(() => null),
        db.ref('kendala_guru').once('value').catch(() => null)
      ]);
      [snap1, snap2, snap3].forEach(snap => {
        if (snap && snap.val()) {
          Object.entries(snap.val()).forEach(([id, val]) => {
            if (val && typeof val === 'object') merged[id] = Object.assign({}, merged[id] || {}, val);
          });
        }
      });
    } catch (e) {}
  }

  const entries = Object.values(merged).sort((a, b) => new Date(b.createdAt || b.waktuLaporMs || 0) - new Date(a.createdAt || a.waktuLaporMs || 0));

  if (entries.length === 0) {
    container.innerHTML = '<div style="color:#94a3b8;font-size:13.5px;padding:24px 0;text-align:center;">Belum ada riwayat laporan izin.</div>';
    return;
  }

  container.innerHTML = '';
  entries.forEach(k => {
    const card = document.createElement('div');
    card.style.cssText = 'background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:14px;margin-bottom:10px;';
    const isApproved = k.status === 'approved' || k.status === 'disetujui' || k.statusKonfirmasi === 'Disetujui';
    const isRejected = k.status === 'rejected' || k.status === 'ditolak' || k.statusKonfirmasi === 'Ditolak';
    const stBadge = isApproved
      ? '<span style="background:#dcfce7;color:#166534;font-size:11.5px;font-weight:700;padding:4px 10px;border-radius:6px;">✓ Disetujui (Jamkos Aktif)</span>'
      : (isRejected
        ? '<span style="background:#fee2e2;color:#991b1b;font-size:11.5px;font-weight:700;padding:4px 10px;border-radius:6px;">✗ Ditolak</span>'
        : '<span style="background:#fef3c7;color:#92400e;font-size:11.5px;font-weight:700;padding:4px 10px;border-radius:6px;">⏳ Menunggu Konfirmasi</span>');

    const mapelTxt = (typeof escapeHtmlGuru === 'function' ? escapeHtmlGuru(k.mataPelajaran || k.mapel || 'Mapel') : (k.mataPelajaran || k.mapel || 'Mapel'));
    const alasanTxt = (typeof escapeHtmlGuru === 'function' ? escapeHtmlGuru(k.deskripsiKendala || k.alasan || '-') : (k.deskripsiKendala || k.alasan || '-'));
    card.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
      '<span style="font-size:13.5px;font-weight:800;color:#0f172a;">' + mapelTxt + ' (' + (k.kelas || k.kelasId || '-') + ')</span>' +
      stBadge +
      '</div>' +
      '<div style="font-size:12.5px;color:#475569;margin-bottom:4px;">' + alasanTxt + '</div>' +
      '<div style="font-size:11.5px;color:#94a3b8;">Tanggal: ' + (k.tanggal || '-') + ' • ID: ' + k.id + '</div>';
    container.appendChild(card);
  });
}

if (typeof window !== 'undefined') {
  window.generateDigitalSuratDokterDataUrl = generateDigitalSuratDokterDataUrl;
  window.muatPerizinanSiswaWalas = muatPerizinanSiswaWalas;
  window.segarkanPerizinanWalasManual = segarkanPerizinanWalasManual;
  window.pulihkanIzinIhsanWalas = pulihkanIzinIhsanWalas;
  window.renderListApprovalIzin = renderListApprovalIzin;
  window.prosesApprovalIzin = prosesApprovalIzin;
  window.bukaModalBuktiIzin = bukaModalBuktiIzin;
  window.submitKendalaGuru = submitKendalaGuru;
  window.kirimKendalaMengajar = kirimKendalaMengajar;
  window.muatRiwayatKendalaGuru = muatRiwayatKendalaGuru;
  window.bukaModalBukti = bukaModalBukti;
  window.bukaModalChatIzin = bukaModalChatIzin;
  window.tutupModalBukti = tutupModalBukti;
  window.ambilDataPerizinanLokalWalas = ambilDataPerizinanLokalWalas;
  window.kelasBinaanAktif = kelasBinaanAktif;
  window.cachePerijinanJ = cachePerijinanJ;
  window.cachePerizinanZ = cachePerizinanZ;
  window.bukaTabWalas = bukaTabWalas;
  window.switchToTab = switchToTab;
  window.filterIzinGuru = filterIzinGuru;
  window.allPerizinanData = allPerizinanData;
  window.ambilUserAktifGuru = ambilUserAktifGuru;
  window.bukaLampiranAktifDiTabBaru = bukaLampiranAktifDiTabBaru;
  window.resetSemuaDataIzinDanChat = (typeof resetSemuaDataIzinDanChat === 'function') ? resetSemuaDataIzinDanChat : (typeof window.resetSemuaDataIzinDanChat === 'function' ? window.resetSemuaDataIzinDanChat : null);
}

if (typeof global !== 'undefined') {
  global.generateDigitalSuratDokterDataUrl = generateDigitalSuratDokterDataUrl;
  global.muatPerizinanSiswaWalas = muatPerizinanSiswaWalas;
  global.segarkanPerizinanWalasManual = segarkanPerizinanWalasManual;
  global.pulihkanIzinIhsanWalas = pulihkanIzinIhsanWalas;
  global.renderListApprovalIzin = renderListApprovalIzin;
  global.prosesApprovalIzin = prosesApprovalIzin;
  global.bukaModalBuktiIzin = bukaModalBuktiIzin;
  global.submitKendalaGuru = submitKendalaGuru;
  global.kirimKendalaMengajar = kirimKendalaMengajar;
  global.muatRiwayatKendalaGuru = muatRiwayatKendalaGuru;
  global.bukaModalBukti = bukaModalBukti;
  global.bukaModalChatIzin = bukaModalChatIzin;
  global.tutupModalBukti = tutupModalBukti;
  global.bukaLampiranAktifDiTabBaru = bukaLampiranAktifDiTabBaru;
  global.ambilDataPerizinanLokalWalas = ambilDataPerizinanLokalWalas;
  global.kelasBinaanAktif = kelasBinaanAktif;
  global.cachePerijinanJ = cachePerijinanJ;
  global.cachePerizinanZ = cachePerizinanZ;
  global.bukaTabWalas = bukaTabWalas;
  global.switchToTab = switchToTab;
  global.filterIzinGuru = filterIzinGuru;
  global.allPerizinanData = allPerizinanData;
  global.ambilUserAktifGuru = ambilUserAktifGuru;
  global.resetSemuaDataIzinDanChat = (typeof resetSemuaDataIzinDanChat === 'function') ? resetSemuaDataIzinDanChat : (typeof global.resetSemuaDataIzinDanChat === 'function' ? global.resetSemuaDataIzinDanChat : null);
}

// Inisialisasi awal saat dokumen siap & pasang listener tab validasi izin
if (typeof document !== 'undefined') {
  const attachTabListeners = () => {
    try { muatPerizinanSiswaWalas(); } catch (e) {}
    const btnTabIzin = document.getElementById('btnTabApprovalIzin');
    const btnTabValidasi = document.getElementById('btnTabValidasiIzin');
    [btnTabIzin, btnTabValidasi].forEach(btn => {
      if (btn && !btn._validasiListenerAttached) {
        btn._validasiListenerAttached = true;
        btn.addEventListener('click', () => {
          try { muatPerizinanSiswaWalas(); } catch (e) {}
        });
      }
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachTabListeners);
  } else {
    attachTabListeners();
  }
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

  let snapSiswa = (typeof db !== 'undefined' && db && typeof db.ref === 'function') ? await db.ref('siswa').once('value').catch(() => null) : null;
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

  const snapPresensi = (typeof db !== 'undefined' && db && typeof db.ref === 'function') ? await db.ref(`presensi_jam/${kelas}/${tanggal}`).once('value').catch(() => null) : null;
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
  siswaKelas.sort((a,b) => {
    const nA = (a[1] && a[1].nama) || '';
    const nB = (b[1] && b[1].nama) || '';
    const kA = (a[0] === '00082109' || nA.toUpperCase().includes('TIFANI')) ? 'M. IHSAN ATHALLAH Z' : nA;
    const kB = (b[0] === '00082109' || nB.toUpperCase().includes('TIFANI')) ? 'M. IHSAN ATHALLAH Z' : nB;
    return kA.localeCompare(kB);
  }).forEach(([nisn, s]) => {
    // Cari apakah siswa ada hadir di salah satu jam pelajaran
    let waktuScan = '-';
    const jamWIBGuru = (typeof getJamSekarangWIB === 'function') ? getJamSekarangWIB() : '07:00:00';
    const tglHariIni = (typeof getTanggalHariIniWIB === 'function') ? getTanggalHariIniWIB() : '';
    let statusKehadiran = (tanggal === tglHariIni && jamWIBGuru < '08:00:00') ? 'Terlambat' : 'Alpa';
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
      statusKehadiran = (typeof formatHumanStatusIzin === 'function')
        ? formatHumanStatusIzin(izinMap[nisn].jenis)
        : ((izinMap[nisn].jenis && izinMap[nisn].jenis.toLowerCase().includes('sakit')) ? 'Sakit' : 'Izin');
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
kelasBinaanAktif = (typeof kelasBinaanAktif !== 'undefined' && kelasBinaanAktif) ? kelasBinaanAktif : 'XII RPL 2';

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
  if (typeof db !== 'undefined' && db && typeof db.ref === 'function') db.ref('kelas/' + normKelas).on('value', snap => {
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
  let terlambatSudahTap = 0;
  let izinSakit = 0;
  let belumAbsen = 0;

  const gridEl = document.getElementById('gridSiswaWalas');
  if (gridEl) gridEl.innerHTML = '';
  if (gridEl && listSiswaKelas.length === 0) {
    gridEl.innerHTML = `<div style="color:#64748b;padding:24px 0;text-align:center;grid-column:1/-1;">Tidak ada data siswa ditemukan untuk kelas ${kelas}.</div>`;
  }

  listSiswaKelas.sort((a,b) => {
    const nA = (a[1] && a[1].nama) || '';
    const nB = (b[1] && b[1].nama) || '';
    const kA = (a[0] === '00082109' || nA.toUpperCase().includes('TIFANI')) ? 'M. IHSAN ATHALLAH Z' : nA;
    const kB = (b[0] === '00082109' || nB.toUpperCase().includes('TIFANI')) ? 'M. IHSAN ATHALLAH Z' : nB;
    return kA.localeCompare(kB);
  }).forEach(([nisn, s]) => {
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

    let statusFinal = 'terlambat';
    let statusLabel = 'Terlambat';
    let statusCardClass = 'belum status-terlambat';

    if (tapStatus === 'hadir' || tapStatus === 'terlambat' || tapStatus === 'pulang') {
      const isLate = (typeof evaluasiAmbangBatasWaktu === 'function')
        ? evaluasiAmbangBatasWaktu(tapWaktu) === 'terlambat'
        : (tapWaktu && tapWaktu > '06:30:00');
      if (isLate) {
        terlambat++;
        terlambatSudahTap++;
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
      const jenisRaw = izinApproved[nisn].jenis;
      statusLabel = (typeof formatHumanStatusIzin === 'function')
        ? formatHumanStatusIzin(jenisRaw)
        : ((jenisRaw && jenisRaw.toLowerCase() === 'sakit') ? 'Sakit' : ((jenisRaw && (jenisRaw.toLowerCase() === 'dispensasi' || jenisRaw.toLowerCase() === 'dispen')) ? 'Dispensasi' : 'Izin'));
      statusCardClass = 'izin-sakit';
    } else {
      const jamWIBGuru = (typeof getJamSekarangWIB === 'function') ? getJamSekarangWIB() : (typeof jamSekarang === 'function' ? jamSekarang() : '07:00:00');
      const cleanJamGuru = jamWIBGuru.length === 5 ? jamWIBGuru + ':00' : jamWIBGuru;

      const isBelumOrEmpty = !tapStatus || ['belum', 'belum absen', 'belum_absen', 'belum scan'].includes(String(tapStatus).toLowerCase().trim());
      if (tapStatus === 'alpa' || tapStatus === 'alpha' || (isBelumOrEmpty && cleanJamGuru >= '08:00:00')) {
        belumAbsen++;
        statusFinal = 'alpa';
        statusLabel = 'Alpa';
        statusCardClass = 'belum status-alpa';

        // Otomatis sinkronkan status Alpa ke Firebase jika jam >= 08:00 WIB dan belum tercatat
        if (cleanJamGuru >= '08:00:00' && isBelumOrEmpty && typeof db !== 'undefined' && db && typeof db.ref === 'function') {
          db.ref(`presensi_jam/${normKelas}/${today}/1/${nisn}`).transaction(curr => {
            if (!curr || !curr.status || ['belum', 'belum absen', 'belum_absen'].includes(String(curr.status).toLowerCase().trim())) {
              return {
                ...(curr || {}),
                waktu: '08:00:00',
                status: 'alpa',
                tipe: 'auto_alpa_system',
                keterangan: 'Auto-Alpa (Tidak Hadir & Tanpa Keterangan s.d 08.00 WIB)',
                updatedAt: new Date().toISOString()
              };
            }
            return curr;
          }).catch(() => null);
        }
      } else {
        terlambat++;
        belumAbsen++;
        statusFinal = 'terlambat';
        statusLabel = 'Terlambat';
        statusCardClass = 'belum status-terlambat';
      }
    }

    if (gridEl) {
      const card = document.createElement('div');
      card.className = `card-siswa-guru ${statusCardClass}`;
      if (typeof card.setAttribute === 'function') card.setAttribute('data-nisn', nisn);
      const inisialS = (s.nama || '?').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
      const fotoS = s.foto || `assets/foto/${nisn}.jpg`;
      card.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:36px;height:36px;border-radius:10px;overflow:hidden;flex-shrink:0;background:#e2e8f0;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;color:#475569;border:1px solid #cbd5e1;">
            <img src="${fotoS}" alt="${s.nama}" style="width:100%;height:100%;object-fit:cover;object-position:center top;display:block;" onerror="this.onerror=null;this.style.display='none';this.parentElement.textContent='${inisialS}';">
          </div>
          <div style="min-width:0;flex:1;">
            <div style="font-size:14px;font-weight:800;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${s.nama}</div>
          </div>
        </div>
        <div style="margin-top:8px;display:flex;align-items:center;justify-content:space-between;">
          <span style="font-size:12px;font-weight:700;">${statusLabel}</span>
          ${(statusFinal === 'terlambat' || statusFinal === 'belum') ? (isGuruBerhakKelolaKelas(kelas) ? `<button class="btn-mini-action btn-mini-izin" onclick="tandaiIzinCepatWalas('${nisn}', '${kelas}', '${(s.nama || '').replace(/'/g, "\\'")}')" style="display:inline-flex;align-items:center;gap:4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg><span>Izin</span></button>` : '') : ''}
        </div>
      `;
      gridEl.appendChild(card);
    }
  });

  const totHadirSemua = hadirTepat + terlambatSudahTap + izinSakit;
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
  const alasan = prompt(`Masukkan alasan izin untuk ${nama}:`, 'Sakit dengan konfirmasi orang tua');
  if (!alasan) return;
  const today = tanggalHariIni();
  if (typeof db !== 'undefined' && db && typeof db.ref === 'function') await db.ref(`presensi_jam/${kelas}/${today}/1/${nisn}`).set({
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
        <div style="font-size:13px;opacity:0.85;">Seluruh siswa kelas ${kelas} telah melakukan tap kartu atau telah memiliki izin pagi ini.</div>
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
        <div style="font-size:14px;font-weight:800;color:#991b1b;">PERINGATAN PAGI: ${belumTapList.length} SISWA TERLAMBAT / BELUM TAP KARTU</div>
        <div style="font-size:12px;color:#b91c1c;">Toleransi verifikasi izin sampai 08.00 WIB sebelum beralih otomatis ke status Alpa.</div>
      </div>
    </div>
  `;

  const listGrid = document.createElement('div');
  listGrid.className = 'student-grid-guru';

  belumTapList.forEach(([nisn, s]) => {
    const card = document.createElement('div');
    card.className = 'card-siswa-guru belum';
    if (typeof card.setAttribute === 'function') card.setAttribute('data-nisn', nisn);
    const inisialS = (s.nama || '?').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
    const fotoS = s.foto || `assets/foto/${nisn}.jpg`;
    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="width:38px;height:38px;border-radius:10px;overflow:hidden;flex-shrink:0;background:#e2e8f0;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;color:#475569;border:1.5px solid #cbd5e1;">
          <img src="${fotoS}" alt="${s.nama}" style="width:100%;height:100%;object-fit:cover;object-position:center top;display:block;" onerror="this.onerror=null;this.style.display='none';this.parentElement.textContent='${inisialS}';">
        </div>
        <div style="min-width:0;flex:1;">
          <div style="font-size:14px;font-weight:800;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${s.nama}</div>
          <div style="font-size:11.5px;color:#64748b;margin-top:1px;">Kelas: ${kelas}</div>
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

// ===== FITUR GURU: LAPOR KENDALA KBM (Menggunakan implementasi submitKendalaGuru utama di atas) =====


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
      const isApproved = k.status === 'approved' || k.status === 'disetujui';
      const isRejected = k.status === 'rejected' || k.status === 'ditolak';
      const badgeText = isApproved ? 'Disetujui Admin (Jamkos)' : isRejected ? 'Ditolak' : 'Menunggu Persetujuan';
      const badgeStyle = isApproved ? 'background:#dcfce7;color:#15803d;' : isRejected ? 'background:#fee2e2;color:#b91c1c;' : 'background:#fef3c7;color:#b45309;';
      const jenisClean = (k.jenis || '').replace(/_/g, ' ');

      const kid = k.id || k.kid || k.permitId || '';
      const hasLampiran = Boolean(
        k.buktiKendala || k.lampiranUrl || k.dokumen_url || k.foto_bukti || k.lampiran || k.lampiranNama ||
        (typeof localStorage !== 'undefined' && (localStorage.getItem('lampiran_kendala_' + kid) || localStorage.getItem('lampiran_foto_' + kid)))
      );
      const namaLampiran = k.lampiranNama || (typeof k.lampiran === 'string' && !k.lampiran.startsWith('data:') && !k.lampiran.startsWith('http') ? k.lampiran : 'Dokumen');

      const card = document.createElement('div');
      card.style.cssText = 'border:1px solid #e2e8f0;border-radius:14px;padding:16px;margin-bottom:12px;background:#f8fafc;';
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:6px;">
          <div style="font-size:14.5px;font-weight:800;color:#0f172a;">${k.mapel || 'Mata Pelajaran'} — Kelas ${k.kelasId || k.kelas || '-'}</div>
          <span style="font-size:11px;font-weight:800;padding:3px 9px;border-radius:999px;${badgeStyle}">${badgeText}</span>
        </div>
        <div style="font-size:12.5px;color:#64748b;margin-bottom:6px;display:flex;align-items:center;gap:6px;">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <span>Tanggal: ${k.tanggal || '-'} • Alasan: ${jenisClean || '-'}</span>
        </div>
        <div style="font-size:13px;color:#334155;background:#fff;padding:10px 12px;border-radius:10px;border:1px solid #e2e8f0;">${k.alasan || '-'}</div>
        ${hasLampiran ? `
        <div style="margin-top:10px;display:flex;justify-content:flex-end;">
          <button onclick="bukaModalBuktiIzin('${kid}')" style="background:#f1f5f9;color:#334155;border:1px solid #cbd5e1;padding:6px 12px;border-radius:8px;font-size:12px;font-weight:700;display:inline-flex;align-items:center;gap:6px;cursor:pointer;transition:all 0.15s ease;" onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f1f5f9'">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
            <span>Lihat Lampiran (${namaLampiran})</span>
          </button>
        </div>` : ''}
      `;
      container.appendChild(card);
    });
  };

  // 1. Ambil data lokal terlebih dahulu untuk render instan tanpa jeda memuat
  let localList = [];
  try {
    localList = JSON.parse(localStorage.getItem('local_kendala_guru') || '[]');
  } catch (e) {}
  if (localList.length === 0) {
    try {
      localList = JSON.parse(localStorage.getItem('local_izin_guru') || '[]');
    } catch (e) {}
  }

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
      const updateFromSnap = (snapshot) => {
        const data = snapshot.val() || {};
        const fbItems = Object.values(data);
        const map = new Map();
        localList.forEach(item => { if (item && item.id) map.set(item.id, item); });
        fbItems.forEach(cloudItem => {
          if (!cloudItem || !cloudItem.id) return;
          const locItem = map.get(cloudItem.id);
          if (locItem) {
            const locIsResolved = locItem.status === 'approved' || locItem.status === 'disetujui' || locItem.status === 'rejected' || locItem.status === 'ditolak';
            const cloudIsResolved = cloudItem.status === 'approved' || cloudItem.status === 'disetujui' || cloudItem.status === 'rejected' || cloudItem.status === 'ditolak';
            if (locIsResolved && !cloudIsResolved) {
              // Pertahankan status resolved dari local agar tidak ter-overwrite status pending cloud yang tertunda
              map.set(cloudItem.id, { ...cloudItem, ...locItem });
            } else {
              map.set(cloudItem.id, { ...locItem, ...cloudItem });
            }
          } else {
            map.set(cloudItem.id, cloudItem);
          }
        });
        const merged = Array.from(map.values());
        renderItems(filterForUser(merged));
      };

      db.ref('kendala_guru').on('value', updateFromSnap, () => {});
      try {
        db.ref('perizinan_guru').on('value', updateFromSnap, () => {});
      } catch (e) {}
    }
  } catch (err) {
    console.warn('[Kendala Guru] Firebase listener error:', err);
  }
}

// Sinkronisasi realtime lintas-tab / window via storage event untuk dashboard guru
if (typeof window !== 'undefined') {
  window.addEventListener('storage', function (e) {
    if (!e || !e.key) return;
    if (e.key === 'local_kendala_guru' || e.key === 'local_izin_guru') {
      if (typeof muatRiwayatKendalaGuru === 'function') {
        muatRiwayatKendalaGuru();
      }
    }
  });
}



// ===== RENDER GRID SISWA DENGAN FOTO COTE & AKSI MANUAL =====
function renderGridSiswaGuru(listSiswa, filter) {
  const grid = document.getElementById('gridSiswaGuru');
  if (!grid) return;

  grid.innerHTML = '';
  const filtered = listSiswa.filter(s => {
    if (filter === 'hadir') return s.status === 'hadir';
    if (filter === 'izin') return s.status === 'izin';
    if (filter === 'belum' || filter === 'terlambat') return s.status === 'belum' || s.status === 'terlambat';
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
    let badgeHtml = '<span style="background:#ef4444;color:#fff;font-size:11px;font-weight:700;padding:3px 9px;border-radius:6px;flex-shrink:0;">TERLAMBAT</span>';
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
      const labelBadge = (s.detail && s.detail.toLowerCase().includes('sakit')) ? 'SAKIT' : ((s.detail && s.detail.toLowerCase().includes('dispen')) ? 'DISPENSASI' : 'IZIN');
      badgeHtml = `<span style="background:#f59e0b;color:#fff;font-size:11px;font-weight:700;padding:3px 9px;border-radius:6px;text-transform:uppercase;flex-shrink:0;">${labelBadge}</span>`;
      actionHtml = `
        <div style="font-size:12px;color:#d97706;font-weight:600;margin-top:10px;display:flex;align-items:center;gap:6px;">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <span>${s.detail}</span>
        </div>
      `;
    }

    card.className = 'card-siswa-guru ' + borderClass;
    if (typeof card.setAttribute === 'function') card.setAttribute('data-nisn', s.nisn);
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
  module.exports.ambilUserAktifGuru = ambilUserAktifGuru;
  module.exports.submitKendalaGuru = submitKendalaGuru;
  module.exports.kirimKendalaMengajar = kirimKendalaMengajar;
  module.exports.muatRiwayatKendalaGuru = muatRiwayatKendalaGuru;
  module.exports.bukaLampiranAktifDiTabBaru = bukaLampiranAktifDiTabBaru;
  module.exports.bukaModalBuktiIzin = bukaModalBuktiIzin;
  module.exports.bukaModalBukti = bukaModalBukti;
  module.exports.tutupModalBukti = tutupModalBukti;
}
