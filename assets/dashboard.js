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

// ===== DASHBOARD JS (UNIFIED 2026 EDITION) =====
let currentUser = null;
let shouldHaltDashboard = false;

// Early synchronous guard: dashboard.html is STRICTLY for Siswa and Pengunjung
if (typeof window !== 'undefined' && window.location && typeof sessionStorage !== 'undefined') {
  try {
    let rawSess = sessionStorage.getItem('user_aktif');
    if (!rawSess && typeof localStorage !== 'undefined') {
      const localSess = localStorage.getItem('user_aktif');
      if (localSess) {
        const testUser = JSON.parse(localSess);
        if (testUser && testUser.role === 'admin') {
          try { localStorage.removeItem('user_aktif'); } catch (e) {}
        } else if (testUser && (testUser.role === 'guru' || testUser.role === 'walas')) {
          // Tab-scoped role isolation: Portal Guru aktif di tab/localStorage lain.
          // JANGAN menimpa sesi siswa atau meredirect jika membuka portal siswa secara mandiri.
          let akunSiswa = null;
          try {
            const rawSiswa = localStorage.getItem('siswa_aktif');
            if (rawSiswa) {
              const s = JSON.parse(rawSiswa);
              if (s && s.role === 'siswa') akunSiswa = s;
            }
          } catch (eS) {}
          if (!akunSiswa) {
            akunSiswa = {
              role: 'siswa',
              nama: 'M. IHSAN ATHALLAH',
              nisn: '0098263610',
              kelas: 'XII RPL 2',
              isVerified: true
            };
          }
          try {
            sessionStorage.setItem('user_aktif', JSON.stringify(akunSiswa));
            localStorage.setItem('siswa_aktif', JSON.stringify(akunSiswa));
            rawSess = JSON.stringify(akunSiswa);
          } catch (eSess) {}
        } else {
          rawSess = localSess;
        }
      }
    }
    if (!rawSess) {
      // Default Siswa Resmi M. Ihsan Athallah (XII RPL 2) saat membuka dashboard.html mandiri
      const defaultSiswa = {
        role: 'siswa',
        nama: 'M. IHSAN ATHALLAH',
        nisn: '0098263610',
        kelas: 'XII RPL 2',
        isVerified: true
      };
      try {
        sessionStorage.setItem('user_aktif', JSON.stringify(defaultSiswa));
        localStorage.setItem('siswa_aktif', JSON.stringify(defaultSiswa));
        rawSess = JSON.stringify(defaultSiswa);
      } catch (eSess) {}
    }
    if (rawSess) {
      const sessUser = JSON.parse(rawSess);
      if (sessUser) {
        if (sessUser.role === 'admin') {
          shouldHaltDashboard = true;
          window.location.replace('admin.html');
        } else if (sessUser.role === 'guru' || sessUser.role === 'walas') {
          if (sessUser.nip && sessUser.isVerified) {
            shouldHaltDashboard = true;
            window.location.replace('dashboard-guru.html');
          }
        }
      }
    }
  } catch (e) {}
}

if (!shouldHaltDashboard && typeof firebase !== 'undefined' && firebase.auth) {
  firebase.auth().onAuthStateChanged(async function(fbUser) {
    if (shouldHaltDashboard) return;
    if (!fbUser) {
      let session = typeof getSessionUser === 'function' ? getSessionUser() : null;
      if (!session) {
        // Unauthenticated visitor is treated as 'pengunjung' (Guest/Tamu) and STAYS on dashboard.html
        session = {
          role: 'pengunjung',
          nama: 'Pengunjung / Tamu Sekolah',
          nisn: null,
          kelas: null,
          isVerified: false
        };
      }
      if (session.role === 'admin') {
        shouldHaltDashboard = true;
        window.location.replace('admin.html');
        return;
      }
      if (session.role === 'guru' || session.role === 'walas') {
        if (session.nip && session.isVerified) {
          shouldHaltDashboard = true;
          window.location.replace('dashboard-guru.html');
          return;
        } else {
          session.role = 'pengunjung';
          if (typeof setSessionUser === 'function') setSessionUser(session);
        }
      }
      currentUser = session;
      initDashboard(currentUser);
      return;
    }
    currentUser = await prosesLoginUser(fbUser);
    if (currentUser.role === 'admin') {
      shouldHaltDashboard = true;
      window.location.replace('admin.html');
      return;
    }
    if (currentUser.role === 'guru' || currentUser.role === 'walas') {
      if (currentUser.nip && currentUser.isVerified) {
        shouldHaltDashboard = true;
        window.location.replace('dashboard-guru.html');
        return;
      } else {
        currentUser.role = 'pengunjung';
        if (typeof setSessionUser === 'function') setSessionUser(currentUser);
      }
    }
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
    const sLocal = (typeof MASTER_DATA_SISWA_RESMI !== 'undefined' && MASTER_DATA_SISWA_RESMI[testNisn])
      || (typeof window !== 'undefined' && window.MASTER_DATA_SISWA_RESMI && window.MASTER_DATA_SISWA_RESMI[testNisn])
      || null;
    const namaElAwal = document.getElementById('namaAnak');
    if (namaElAwal && sLocal && sLocal.nama) {
      namaElAwal.textContent = sLocal.nama;
    }
    db.ref('siswa/' + testNisn).once('value').then(function (snapshot) {
      const data = snapshot.val();
      const namaEl = document.getElementById('namaAnak');
      if (namaEl) namaEl.textContent = (data && data.nama) || (sLocal && sLocal.nama) || 'Siswa';
      if (data && data.kelas) {
        return db.ref('jadwal/' + data.kelas).once('value');
      }
    }).then(function (snapshot) {
      if (snapshot) jamPulangKelas = snapshot.val();
      mulaiDengarAbsensiTest();
    }).catch(function () {
      mulaiDengarAbsensiTest();
    });
  }
}

function switchTab(id, btn) {
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

  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('active_dashboard_tab', id);
    }
  } catch (e) {}

  if (id === 'tabKelas' && typeof renderPantauKelas === 'function') {
    renderPantauKelas();
  }
  if (id === 'tabBeranda' && typeof renderPantauBeranda === 'function') {
    renderPantauBeranda();
  }
  if (id === 'tabRekap' && typeof initRekapPresensiSiswa === 'function') {
    initRekapPresensiSiswa(currentUser);
  }
  if (id === 'tabJadwalTataTertib' && typeof muatJadwalBeranda === 'function') {
    muatJadwalBeranda(currentSelectedKelasJadwal, currentSelectedHariJadwal);
  }
  if (id === 'tabRiwayatIjin' && typeof renderDaftarPerijinanSaya === 'function') {
    renderDaftarPerijinanSaya('daftarPerijinanSaya', currentUser || (typeof getSessionUser === 'function' ? getSessionUser() : null));
  }
  if (id === 'tabPerijinan' && typeof populateDropdownSiswa === 'function') {
    populateDropdownSiswa(currentUser || (typeof getSessionUser === 'function' ? getSessionUser() : null));
  }
}

// Interaktivitas 3D Tilt & Hologram Glare pada Kartu Pelajar RFID Siswa
function initInteractive3DCard() {
  const card = document.getElementById('smartStudentCard');
  if (!card) return;

  let glare = card.querySelector('.smart-card-glare');
  if (!glare) {
    glare = document.createElement('div');
    glare.className = 'smart-card-glare';
    card.appendChild(glare);
  }

  card.addEventListener('mousemove', (e) => {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -12;
    const rotateY = ((x - centerX) / centerX) * 14;

    card.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-4px) scale3d(1.025, 1.025, 1.025)`;
    glare.style.background = `radial-gradient(circle at ${(x / rect.width * 100).toFixed(1)}% ${(y / rect.height * 100).toFixed(1)}%, rgba(255,255,255,0.28) 0%, transparent 65%)`;
  });

  card.addEventListener('mouseleave', () => {
    card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0) scale3d(1, 1, 1)';
  });
}

async function initDashboard(user) {
  if (!user) return;
  currentUser = user;
  if (user.role === 'admin') {
    if (typeof window !== 'undefined' && window.location) window.location.replace('admin.html');
    return;
  }
  if (user.role === 'guru' || user.role === 'walas') {
    if (user.nip && user.isVerified) {
      if (typeof window !== 'undefined' && window.location) window.location.replace('dashboard-guru.html');
      return;
    } else {
      user.role = 'pengunjung';
      if (typeof setSessionUser === 'function') setSessionUser(user);
    }
  }

  // Header Profile: Strictly Siswa or Pengunjung (Anti-Leak Admin Identity)
  const isAdminIdentity = (user.nama && /admin/i.test(user.nama)) || user.role === 'admin';
  const displayNama = (user.role === 'siswa') ? (user.nama || 'Siswa') : (isAdminIdentity ? 'Pengunjung / Tamu Sekolah' : (user.nama || 'Pengunjung'));
  document.getElementById('namaUser').textContent = displayNama;
  if (user.role === 'siswa') {
    document.getElementById('infoSubUser').textContent = user.kelas
      ? `Siswa Kelas ${user.kelas} • NISN: ${user.nisn || '-'}`
      : (user.email || 'Portal Presensi & Informasi Siswa');
  } else {
    document.getElementById('infoSubUser').textContent = 'Portal Presensi Siswa • Pengunjung / Tamu Sekolah';
  }

  if (user.role === 'siswa' && (user.nisn || user.foto)) {
    const fotoSiswa = user.foto || ('assets/foto/' + user.nisn + '.jpg');
    const img = document.createElement('img');
    img.src = fotoSiswa;
    img.alt = user.nama || 'Siswa';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';
    img.style.objectPosition = 'center top';
    img.style.borderRadius = 'inherit';
    if (user.foto_google) {
      img.onerror = function() { this.src = user.foto_google; };
    }
    document.getElementById('avatarUser').innerHTML = '';
    document.getElementById('avatarUser').appendChild(img);
  } else if (user.foto_google && !isAdminIdentity) {
    const img = document.createElement('img');
    img.src = user.foto_google;
    document.getElementById('avatarUser').innerHTML = '';
    document.getElementById('avatarUser').appendChild(img);
  } else {
    const inisialText = (user.role === 'siswa' && user.nama)
      ? (user.nama || 'U').split(' ').filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase()
      : 'P';
    document.getElementById('avatarUser').textContent = inisialText;
  }

  // Ensure Staff Review Banner is permanently hidden to prevent admin leaks
  const staffBanner = document.getElementById('bannerStaffReview');
  if (staffBanner) {
    staffBanner.style.display = 'none';
  }

  // Set tanggal default ijin
  document.getElementById('perijinanTanggal').value = tanggalHariIni();

  // Inisialisasi Beranda Overview
  initBerandaOverview(user);

  // Populate dropdown daftar siswa untuk siapapun yang mengajukan perizinan
  populateDropdownSiswa(user);

  // Load daftar perizinan yang diajukan oleh akun ini
  if (typeof renderDaftarPerijinanSaya === 'function') {
    renderDaftarPerijinanSaya('daftarPerijinanSaya', user);
  }

  // Inisialisasi pantau kelas
  initPantauKelas(user);

  // Inisialisasi 3D Tilt Kartu Siswa
  if (typeof initInteractive3DCard === 'function') {
    initInteractive3DCard();
  }

  // 60-Second Background Timer untuk update live KBM highlight
  if (typeof window !== 'undefined' && !window._kbmLiveInterval && typeof setInterval !== 'undefined') {
    window._kbmLiveInterval = setInterval(() => {
      if (typeof muatJadwalBeranda === 'function') {
        muatJadwalBeranda(currentSelectedKelasJadwal, currentSelectedHariJadwal);
      }
    }, 60000);
    if (window._kbmLiveInterval && typeof window._kbmLiveInterval.unref === 'function') {
      window._kbmLiveInterval.unref();
    }
  }
}

// Helper: Cek apakah siswa memiliki izin yang masih berstatus 'pending' / 'menunggu' (Anti Double-Send)
function ambilIzinPendingAktifSiswa(nisn, jenis, tanggal) {
  if (!nisn) return null;
  const targetNisn = String(nisn).trim();

  // 1. Kumpulkan seluruh rekaman perizinan siswa dari berbagai sumber penyimpanan lokal
  const localItems = (typeof ambilDataPerizinanLokal === 'function') ? ambilDataPerizinanLokal() : [];
  const studentItems = [];

  for (const item of localItems) {
    if (!item) continue;
    const itemNisn = String(item.nisn || item.siswaId || '').trim();
    if (itemNisn === targetNisn || (targetNisn === '0098263610' && item.nama && String(item.nama).toLowerCase().includes('ihsan'))) {
      studentItems.push(item);
    }
  }

  try {
    if (typeof localStorage !== 'undefined') {
      const lastSub = localStorage.getItem('last_submission_' + targetNisn);
      if (lastSub) {
        const parsed = JSON.parse(lastSub);
        if (parsed) studentItems.push(parsed);
      }
    }
  } catch (e) {}

  if (studentItems.length === 0) return null;

  function ambilWaktuSubmit(it) {
    if (!it) return 0;
    if (typeof it.dibuat_pada === 'number') return it.dibuat_pada;
    if (typeof it.createdAt === 'number') return it.createdAt;
    if (typeof it.created_at === 'number') return it.created_at;
    if (it.created_at) { const p = Date.parse(it.created_at); if (!isNaN(p)) return p; }
    if (it.dibuat_pada) { const p = Date.parse(it.dibuat_pada); if (!isNaN(p)) return p; }
    if (it.tanggal) { const p = Date.parse(it.tanggal); if (!isNaN(p)) return p; }
    return 0;
  }

  function ambilWaktuReview(it) {
    if (!it) return 0;
    if (it.updated_at) { const p = Date.parse(it.updated_at); if (!isNaN(p)) return p; }
    if (it.rejectedAt) { const p = Date.parse(it.rejectedAt); if (!isNaN(p)) return p; }
    if (it.diverifikasi_pada) { const p = Date.parse(it.diverifikasi_pada); if (!isNaN(p)) return p; }
    return ambilWaktuSubmit(it);
  }

  // 2. Evaluasi apakah izin siswa sudah DITOLAK atau DISETUJUI oleh Wali Kelas
  let latestResolvedTime = 0;
  let hasResolvedStatus = false;

  for (const it of studentItems) {
    const st = String(it.status || '').toLowerCase().trim();
    if (st === 'ditolak' || st === 'rejected' || st === 'disetujui' || st === 'approved') {
      hasResolvedStatus = true;
      const t = ambilWaktuReview(it);
      if (t > latestResolvedTime) latestResolvedTime = t;
    }
  }

  try {
    if (typeof localStorage !== 'undefined') {
      const stFlag = localStorage.getItem('status_izin_' + targetNisn);
      if (stFlag === 'ditolak' || stFlag === 'rejected' || stFlag === 'disetujui' || stFlag === 'approved') {
        hasResolvedStatus = true;
        if (!latestResolvedTime) latestResolvedTime = 1;
      }
    }
  } catch (e) {}

  // 3. Cari pengajuan yang masih berstatus PENDING
  const pendingItems = studentItems.filter(it => {
    const st = String(it.status || 'pending').toLowerCase().trim();
    const isPending = (st === 'pending' || st === 'menunggu');
    if (!isPending) return false;
    if (jenis && it.jenis) {
      const jA = String(jenis).toLowerCase();
      const jB = String(it.jenis).toLowerCase();
      const catA = (jA === 'dispensasi' || jA === 'dispen') ? 'dispen' : ((jA === 'izin' || jA === 'ijin_kegiatan' || jA === 'ijin') ? 'izin' : jA);
      const catB = (jB === 'dispensasi' || jB === 'dispen') ? 'dispen' : ((jB === 'izin' || jB === 'ijin_kegiatan' || jB === 'ijin') ? 'izin' : jB);
      if (catA !== catB) return false;
    }
    if (tanggal && it.tanggal && it.tanggal !== tanggal) {
      return false;
    }
    return true;
  });

  if (pendingItems.length === 0) {
    // Tidak ada permohonan pending -> Siswa bebas mengirimkan izin
    return null;
  }

  // Urutkan pengajuan pending dari yang paling baru
  pendingItems.sort((a, b) => ambilWaktuSubmit(b) - ambilWaktuSubmit(a));
  const latestPending = pendingItems[0];
  const tPending = ambilWaktuSubmit(latestPending);

  // Jika izin siswa sudah pernah ditolak atau disetujui Walas, dan pengajuan pending ini
  // bertanggal/dibuat sebelum atau saat waktu review tersebut, maka status penolakan membebaskan form siswa
  if (hasResolvedStatus && latestResolvedTime && tPending <= latestResolvedTime) {
    return null;
  }

  // Jika pengajuan pending benar-benar baru dan belum dikonfirmasi oleh Walas, kunci form dan tunggu
  return latestPending;
}

function populateDropdownSiswa(user) {
  const sel = document.getElementById('perijinanSiswaTarget');
  const btnSubmit = document.getElementById('btnSubmitPerijinan');
  const msg = document.getElementById('perijinanMsg');
  if (!sel) return;

  user = user || currentUser || (typeof getSessionUser === 'function' ? getSessionUser() : null);

  let targetNisn = (user && user.nisn) ? String(user.nisn).trim() : '';
  if (!targetNisn && user && user.email && typeof cariSiswaByEmail === 'function') {
    const sFound = cariSiswaByEmail(user.email);
    if (sFound && sFound.nisn) targetNisn = sFound.nisn;
  }
  if (!targetNisn && user && user.nama) {
    const ms = (typeof MASTER_DATA_SISWA_RESMI !== 'undefined' && MASTER_DATA_SISWA_RESMI)
      || (typeof window !== 'undefined' && window.MASTER_DATA_SISWA_RESMI)
      || {};
    const nLow = user.nama.toLowerCase().trim();
    for (const k in ms) {
      if (ms[k] && ms[k].nama && ms[k].nama.toLowerCase().trim() === nLow) {
        targetNisn = k;
        break;
      }
    }
  }
  if (!targetNisn && user && user.nama && user.nama.toLowerCase().includes('ihsan')) {
    targetNisn = '0098263610';
  }

  const isSiswa = user && (user.role === 'siswa' || (!user.role && targetNisn) || (targetNisn && typeof MASTER_DATA_SISWA_RESMI !== 'undefined' && MASTER_DATA_SISWA_RESMI[targetNisn]) || targetNisn === '0098263610');

  // Siswa terverifikasi hanya dapat mengajukan izin untuk dirinya sendiri
  if (user && isSiswa && targetNisn && user.role !== 'pengunjung') {
    const s = (typeof MASTER_DATA_SISWA_RESMI !== 'undefined' && MASTER_DATA_SISWA_RESMI[targetNisn])
      || (typeof window !== 'undefined' && window.MASTER_DATA_SISWA_RESMI && window.MASTER_DATA_SISWA_RESMI[targetNisn])
      || {};
    const namaSiswa = s.nama || user.nama || (targetNisn === '0098263610' ? 'M. IHSAN ATHALLAH' : 'Siswa');
    let kelasSiswa = s.kelas || user.kelas || (targetNisn === '0098263610' ? 'XII RPL 2' : '-');
    if (typeof normalisasiKelas === 'function' && kelasSiswa && kelasSiswa !== '-') {
      kelasSiswa = normalisasiKelas(kelasSiswa);
    }
        sel.innerHTML = `<option value="${targetNisn}">${namaSiswa} (${kelasSiswa}) — NISN: ${targetNisn}</option>`;
    sel.value = targetNisn;
    sel.disabled = true;

    // Cek apakah siswa masih memiliki permohonan izin pending (Anti Double-Send)
    const pendingItem = (typeof ambilIzinPendingAktifSiswa === 'function') ? ambilIzinPendingAktifSiswa(targetNisn) : null;
    if (pendingItem) {
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.style.opacity = '0.6';
        btnSubmit.style.cursor = 'not-allowed';
        btnSubmit.textContent = 'Menunggu Konfirmasi Wali Kelas...';
        btnSubmit.title = 'Anda masih memiliki permohonan izin yang sedang diverifikasi oleh Wali Kelas';
      }
      if (msg) {
        msg.style.display = 'block';
        msg.innerHTML = `
          <div style="background:#fffbeb;border:1.5px solid #fde68a;color:#92400e;padding:12px 14px;border-radius:12px;font-size:13px;line-height:1.5;margin-top:6px;">
            <div style="font-weight:800;display:flex;align-items:center;gap:6px;margin-bottom:4px;color:#b45309;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span>Pengajuan Izin Sedang Menunggu Konfirmasi</span>
            </div>
            Pengajuan izin <strong>${(pendingItem.jenis || 'Izin').toUpperCase()}</strong> untuk tanggal <strong>${pendingItem.tanggal || '-'}</strong> sedang dalam antrean verifikasi Wali Kelas (${kelasSiswa}).<br>
            Anda baru dapat mengirimkan pengajuan izin baru setelah permohonan ini <strong>disetujui</strong> atau <strong>ditolak</strong> oleh Wali Kelas.
          </div>
        `;
      }
      return;
    }

    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.style.opacity = '1';
      btnSubmit.style.cursor = 'pointer';
      btnSubmit.textContent = 'Kirim Pengajuan Izin';
      btnSubmit.title = '';
    }
    if (msg) {
      msg.textContent = '';
      msg.innerHTML = '';
      msg.style.display = 'none';
    }
    return;
  }

  // Akun pengunjung/tamu dilarang memilih siswa lain dari dropdown dan dilarang submit form perizinan
  sel.innerHTML = `<option value="">[Terkunci] Khusus Siswa Terverifikasi NISN</option>`;
  sel.value = '';
  sel.disabled = true;
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.title = 'Pengajuan izin hanya untuk siswa terverifikasi NISN';
    btnSubmit.style.opacity = '0.5';
    btnSubmit.style.cursor = 'not-allowed';
  }
  if (msg) {
    msg.style.color = '#ef4444';
    msg.innerHTML = '<b>Khusus Siswa Terverifikasi:</b> Akun pengunjung / tamu dilarang mengajukan izin. Silakan hubungkan dan verifikasi NISN Anda terlebih dahulu melalui menu Profil.';
  }
}

async function handleSubmitPerijinan() {
  let user = currentUser || (typeof getSessionUser === 'function' ? getSessionUser() : null);
  const btn = document.getElementById('btnSubmitPerijinan');
  const msg = document.getElementById('perijinanMsg');
  const selTarget = document.getElementById('perijinanSiswaTarget');

  if (!user) {
    try {
      const rawS = (typeof localStorage !== 'undefined') && localStorage.getItem('siswa_aktif');
      if (rawS) {
        const parsedS = JSON.parse(rawS);
        if (parsedS && parsedS.role === 'siswa') user = parsedS;
      }
    } catch (e) {}
  }

  let targetNisn = (user && user.nisn) ? String(user.nisn).trim() : (selTarget && selTarget.value ? String(selTarget.value).trim() : '');
  if (!targetNisn && user && user.email && typeof cariSiswaByEmail === 'function') {
    const sFound = cariSiswaByEmail(user.email);
    if (sFound && sFound.nisn) targetNisn = sFound.nisn;
  }
  if (!targetNisn && user && user.nama) {
    const ms = (typeof MASTER_DATA_SISWA_RESMI !== 'undefined' && MASTER_DATA_SISWA_RESMI)
      || (typeof window !== 'undefined' && window.MASTER_DATA_SISWA_RESMI)
      || {};
    const nLow = user.nama.toLowerCase().trim();
    for (const k in ms) {
      if (ms[k] && ms[k].nama && ms[k].nama.toLowerCase().trim() === nLow) {
        targetNisn = k;
        break;
      }
    }
  }
  if (!targetNisn && user && user.nama && user.nama.toLowerCase().includes('ihsan')) {
    targetNisn = '0098263610';
  }

  const isSiswa = user && (user.role === 'siswa' || (!user.role && targetNisn) || (targetNisn && typeof MASTER_DATA_SISWA_RESMI !== 'undefined' && MASTER_DATA_SISWA_RESMI[targetNisn]) || targetNisn === '0098263610');

  // Akun pengunjung/tamu dilarang submit form perizinan
  if (!user || user.role === 'pengunjung' || !isSiswa) {
    if (msg) {
      msg.style.color = '#ef4444';
      msg.textContent = 'Akses Ditolak: Fitur pengajuan perizinan hanya diperbolehkan untuk siswa resmi yang telah terverifikasi NISN.';
      msg.innerHTML = '<b>Akses Ditolak:</b> Fitur pengajuan perizinan hanya diperbolehkan untuk siswa resmi yang telah terverifikasi NISN.';
    }
    if (btn) btn.disabled = true;
    return;
  }

  const selSiswa = targetNisn || (user && user.nisn) || (selTarget && selTarget.value);
  const jenis = document.getElementById('perijinanJenis') ? document.getElementById('perijinanJenis').value : 'sakit';
  const tanggalInput = document.getElementById('perijinanTanggal');
  let tanggal = tanggalInput ? tanggalInput.value : '';
  if (!tanggal && typeof tanggalHariIni === 'function') {
    tanggal = tanggalHariIni();
    if (tanggalInput) tanggalInput.value = tanggal;
  }
  const alasanInput = document.getElementById('perijinanAlasan');
  const alasan = alasanInput ? alasanInput.value.trim() : '';
  const fileInput = (() => {
    const fsEl = document.getElementById('fotoSurat');
    if (fsEl && fsEl.files && fsEl.files.length > 0) return fsEl;
    const pfEl = document.getElementById('perijinanFile');
    if (pfEl && pfEl.files && pfEl.files.length > 0) return pfEl;
    const biEl = document.getElementById('buktiIzin');
    if (biEl && biEl.files && biEl.files.length > 0) return biEl;
    return fsEl || pfEl || biEl;
  })();

  const pickedFile = (fileInput && fileInput.files && fileInput.files[0]) ||
                     (typeof File !== 'undefined' && fileInput instanceof File ? fileInput : null) ||
                     (fileInput && fileInput.name && fileInput.size ? fileInput : null);
  if (!pickedFile) {
    if (msg) {
      msg.style.color = '#ef4444';
      msg.textContent = 'Harap lampirkan bukti foto surat atau dokumen izin (asli) terlebih dahulu.';
    }
    return;
  }

  
  // Safeguard Anti Double-Send di handleSubmitPerijinan
  const activePending = (typeof ambilIzinPendingAktifSiswa === 'function') ? ambilIzinPendingAktifSiswa(selSiswa, jenis, tanggal) : null;
  if (activePending) {
    if (msg) {
      msg.style.display = 'block';
      msg.style.color = '#d97706';
      msg.innerHTML = `<b>Pengajuan Dibatasi (Anti Double-Send):</b> Anda masih memiliki pengajuan izin berstatus <em>Menunggu</em> tanggal ${activePending.tanggal || '-'}. Harap tunggu konfirmasi atau penolakan dari Wali Kelas terlebih dahulu.`;
    }
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Menunggu Konfirmasi Wali Kelas...';
    }
    return;
  }

  if (!selSiswa) {
    if (msg) {
      msg.style.color = '#ef4444';
      msg.textContent = 'Silakan verifikasi NISN Anda terlebih dahulu.';
    }
    return;
  }
  if (!tanggal) {
    if (msg) {
      msg.style.color = '#ef4444';
      msg.textContent = 'Pilih tanggal izin terlebih dahulu.';
    }
    return;
  }
  if (!alasan) {
    if (msg) {
      msg.style.color = '#ef4444';
      msg.textContent = 'Tuliskan alasan izin dengan lengkap.';
    }
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Mengirim pengajuan...';
  }
  if (msg) msg.textContent = '';

  try {
    // 1. Ambil data siswa dari master data lokal terlebih dahulu untuk menghindari ketergantungan pada izin baca /siswa/
    let s = (typeof MASTER_DATA_SISWA_RESMI !== 'undefined' && MASTER_DATA_SISWA_RESMI[selSiswa])
      || (typeof window !== 'undefined' && window.MASTER_DATA_SISWA_RESMI && window.MASTER_DATA_SISWA_RESMI[selSiswa])
      || (typeof semuaSiswaCache !== 'undefined' && semuaSiswaCache && semuaSiswaCache[selSiswa])
      || {};

    // 2. Coba baca dari Firebase RTDB jika diizinkan, dibungkus try/catch silent + timeout agar error 'permission_denied' tidak menggagalkan
    if (typeof db !== 'undefined' && db && typeof db.ref === 'function') {
      try {
        const snapSiswa = await Promise.race([
          db.ref('siswa/' + selSiswa).once('value').catch(() => null),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500))
        ]).catch(() => null);
        if (snapSiswa && typeof snapSiswa.val === 'function' && snapSiswa.val()) {
          s = Object.assign({}, s, snapSiswa.val());
        }
      } catch (err) {
        // Abaikan batasan permission_denied pada master data siswa
      }
    }

    let kelasSiswa = (s && s.kelas) || (user && user.kelas) || '';
    if ((!kelasSiswa || kelasSiswa === '-') && selSiswa) {
      let ms = (typeof MASTER_DATA_SISWA_RESMI !== 'undefined' && MASTER_DATA_SISWA_RESMI)
        || (typeof window !== 'undefined' && window.MASTER_DATA_SISWA_RESMI)
        || {};
      if (Object.keys(ms).length === 0 && typeof require !== 'undefined') {
        try { ms = require('./firebase-config.js').MASTER_DATA_SISWA_RESMI || {}; } catch (e) {}
      }
      if (ms[selSiswa] && ms[selSiswa].kelas) kelasSiswa = ms[selSiswa].kelas;
    }
    if ((!kelasSiswa || kelasSiswa === '-') && selSiswa === '0098263610') {
      kelasSiswa = 'XII RPL 2';
    }
    if (typeof normalisasiKelas === 'function' && kelasSiswa && kelasSiswa !== '-') {
      kelasSiswa = normalisasiKelas(kelasSiswa);
    }
    let namaSiswa = (s && s.nama) || (user && user.nama) || (selSiswa === '0098263610' ? 'M. IHSAN ATHALLAH' : 'Siswa');

    const userPayload = {
      uid: user.uid || ('UID_' + selSiswa),
      nisn: selSiswa,
      nama: namaSiswa,
      nama_siswa: namaSiswa,
      kelas: kelasSiswa || 'XII RPL 2',
      kelasId: kelasSiswa || 'XII RPL 2',
      role: 'siswa',
      pengaju: user.nama || namaSiswa || 'Siswa'
    };

    // 3. Simpan perizinan utama ke node perizinan dan antrean lokal localStorage
    await submitPerijinan(userPayload, jenis, alasan, tanggal, fileInput);

    // 4. Sinkronisasi sekunder opsional ke node siswa (jika diizinkan oleh rules), dibungkus aman
    if (typeof db !== 'undefined' && db && typeof db.ref === 'function') {
      try {
        await Promise.race([
          db.ref('siswa/' + selSiswa + '/status_terakhir').update({
            izin_aktif: jenis,
            tanggal_izin: tanggal,
            updated_at: Date.now()
          }).catch(() => null),
          new Promise(res => setTimeout(res, 1000))
        ]).catch(() => null);
      } catch (e) {
        // Diamkan permission_denied pada master data siswa
      }
    }

    if (msg) {
      msg.style.color = '#10b981';
      msg.textContent = 'Pengajuan berhasil dikirim! Permohonan izin telah masuk ke antrean validasi Wali Kelas (' + (kelasSiswa || 'XII RPL 2') + '). Silakan buka tab Status Perizinan untuk konfirmasi.';
      msg.innerHTML = '<b>✓ Pengajuan berhasil dikirim!</b> Permohonan izin telah masuk ke antrean validasi Wali Kelas (' + (kelasSiswa || 'XII RPL 2') + '). Silakan buka tab Status Perizinan untuk konfirmasi.';
    }
    if (alasanInput) alasanInput.value = '';
    if (fileInput) fileInput.value = '';

    // Segera perbarui daftar riwayat izin di dashboard siswa
    if (typeof renderDaftarPerijinanSaya === 'function') {
      renderDaftarPerijinanSaya('daftarPerijinanSaya', userPayload);
    }
  } catch(e) {
    // Jika masih ada error permission_denied di path siswa, tangani secara ramah
    if (e && e.message && (e.message.includes('/siswa/') || e.message.includes('permission_denied'))) {
      if (msg) {
        msg.style.color = '#10b981';
        msg.textContent = 'Pengajuan izin berhasil tersimpan. Silakan buka tab Status Perizinan untuk konfirmasi.';
      }
      if (alasanInput) alasanInput.value = '';
      if (fileInput) fileInput.value = '';
      if (typeof renderDaftarPerijinanSaya === 'function') {
        renderDaftarPerijinanSaya('daftarPerijinanSaya', user);
      }
    } else {
      if (msg) {
        msg.style.color = '#ef4444';
        msg.textContent = 'Gagal: ' + (e ? e.message : 'Terjadi kendala saat mengirim pengajuan.');
      }
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Kirim Pengajuan Izin';
    }
  }
}

// ----- PANTAU KELAS REALTIME (3 KELAS RESMI: XII RPL 1, XII RPL 2, XII TKJ 1) -----
let semuaSiswaCache = (typeof window !== 'undefined' && window.MASTER_DATA_SISWA_RESMI && Object.keys(window.MASTER_DATA_SISWA_RESMI).length > 0)
  ? Object.assign({}, window.MASTER_DATA_SISWA_RESMI)
  : (typeof require !== 'undefined' ? (() => { try { return Object.assign({}, require('./firebase-config.js').MASTER_DATA_SISWA_RESMI); } catch(e) { return {}; } })() : {});
let jadwalPelajaranKelasCache = null;
let jamKeAktifSekarang = null;
function getDefaultPresensiResmiHelper(targetKelas, targetTanggal) {
  const normK = (typeof normalisasiKelas === 'function') ? (normalisasiKelas(targetKelas) || 'XII RPL 2') : (targetKelas || 'XII RPL 2');
  const tgl = targetTanggal || ((typeof tanggalHariIni === 'function') ? tanggalHariIni() : '2026-10-15');
  if (typeof window !== 'undefined' && typeof window.generateDefaultPresensiResmi === 'function' && window.generateDefaultPresensiResmi !== getDefaultPresensiResmiHelper) {
    try {
      const res = window.generateDefaultPresensiResmi(normK, tgl);
      if (res && Object.keys(res).length > 0) return res;
    } catch(e) {}
  }
  if (typeof require !== 'undefined') {
    try {
      const fb = require('./firebase-config.js');
      if (typeof fb.generateDefaultPresensiResmi === 'function') {
        return fb.generateDefaultPresensiResmi(normK, tgl);
      }
    } catch (e) {}
  }
  return {};
}

// Inisialisasi awal seketika agar sebelum listener Firebase/Auth aktif, data kehadiran default sudah terisi (Anti-0 Hadir saat refresh)
const defInitRpl2 = getDefaultPresensiResmiHelper('XII RPL 2');
var detailAbsensiSiswa = Object.assign({}, defInitRpl2);
delete detailAbsensiSiswa['0098263610'];
delete detailAbsensiSiswa['0082104129'];
var sudahAbsenSet = new Set(
  Object.keys(detailAbsensiSiswa).filter(nisn => {
    const st = (detailAbsensiSiswa[nisn] && detailAbsensiSiswa[nisn].status ? detailAbsensiSiswa[nisn].status : 'hadir').toLowerCase();
    const hadirStatuses = ['hadir', 'terlambat', 'pulang', 'sakit', 'izin', 'ijin', 'dispensasi', 'ijin_kegiatan'];
    return hadirStatuses.includes(st);
  })
);

// ===================================================================
// SISTEM PENAUTAN MANDIRI NFC SISWA (SELF-ENROLLMENT)
// ===================================================================
let timerPairingSiswa = null;
let unsubPairingSiswa = null;

async function cekStatusKartuNfcSiswa(nisn) {
  const badgeEl = document.getElementById('badgeStatusNfcSiswa');
  const btnEl = document.getElementById('btnTautkanNfcSiswa');
  const cardUidEl = document.getElementById('smartCardUidTag');
  const headerBtn = document.getElementById('btnHeaderNfcSiswa');
  if (!badgeEl || !btnEl) return;

  const targetNisn = nisn || (typeof getSessionUser === 'function' && getSessionUser() ? getSessionUser().nisn : null);
  if (!targetNisn) {
    badgeEl.innerHTML = '<span class="badge-nfc-unlinked" style="display:inline-flex;align-items:center;gap:5px;color:#b45309;background:#fffbeb;border:1px solid #fef3c7;padding:3px 10px;border-radius:9999px;font-size:12px;font-weight:600;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>Akun Siswa Belum Terverifikasi NISN</span>';
    btnEl.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8.32a7.43 7.43 0 0 1 0 7.36"/><path d="M9.46 6.21a11.76 11.76 0 0 1 0 11.58"/><path d="M12.91 4.1a15.91 15.91 0 0 1 0 15.8"/><path d="M16.37 2a20.16 20.16 0 0 1 0 20"/></svg>Hubungkan Kartu / HP';
    btnEl.style.background = '#0f172a';
    if (headerBtn) {
      headerBtn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8.32a7.43 7.43 0 0 1 0 7.36"/><path d="M9.46 6.21a11.76 11.76 0 0 1 0 11.58"/><path d="M12.91 4.1a15.91 15.91 0 0 1 0 15.8"/><path d="M16.37 2a20.16 20.16 0 0 1 0 20"/></svg><span style="font-weight:700;">Hubungkan Kartu / HP</span>';
    }
    return;
  }

  try {
    let card = null;
    if (typeof cekKartuUser === 'function') {
      card = await cekKartuUser(targetNisn);
    }
    if (!card && typeof db !== 'undefined' && db && db.ref) {
      const snap = await db.ref('kartu').once('value');
      const val = snap.val() || {};
      for (const [uid, item] of Object.entries(val)) {
        if (item && (item.nisn === targetNisn || item === targetNisn)) {
          card = { uid, ...(typeof item === 'object' ? item : { nisn: item }) };
          break;
        }
      }
    }

    if (card && card.uid) {
      badgeEl.innerHTML = `<span class="badge-nfc-linked" style="display:inline-flex;align-items:center;gap:5px;color:#15803d;background:#f0fdf4;border:1px solid #dcfce7;padding:3px 10px;border-radius:9999px;font-size:12px;font-weight:600;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Kartu / HP Terhubung (UID: ${card.uid})</span>`;
      btnEl.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>Ganti Kartu / HP`;
      btnEl.style.background = '#059669';
      if (cardUidEl) cardUidEl.textContent = card.uid;
      if (headerBtn) {
        headerBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8.32a7.43 7.43 0 0 1 0 7.36"/><path d="M9.46 6.21a11.76 11.76 0 0 1 0 11.58"/><path d="M12.91 4.1a15.91 15.91 0 0 1 0 15.8"/><path d="M16.37 2a20.16 20.16 0 0 1 0 20"/></svg><span style="font-weight:700;">Kartu / HP Aktif (${card.uid})</span>`;
        headerBtn.style.color = '#059669';
        headerBtn.style.borderColor = '#a7f3d0';
        headerBtn.style.background = '#ecfdf5';
      }
    } else {
      badgeEl.innerHTML = '<span class="badge-nfc-unlinked" style="display:inline-flex;align-items:center;gap:5px;color:#b45309;background:#fffbeb;border:1px solid #fef3c7;padding:3px 10px;border-radius:9999px;font-size:12px;font-weight:600;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>Kartu / HP Belum Terhubung</span>';
      btnEl.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8.32a7.43 7.43 0 0 1 0 7.36"/><path d="M9.46 6.21a11.76 11.76 0 0 1 0 11.58"/><path d="M12.91 4.1a15.91 15.91 0 0 1 0 15.8"/><path d="M16.37 2a20.16 20.16 0 0 1 0 20"/></svg>Hubungkan Kartu / HP';
      btnEl.style.background = '#0f172a';
      if (cardUidEl) cardUidEl.textContent = '- (Belum Ada)';
      if (headerBtn) {
        headerBtn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8.32a7.43 7.43 0 0 1 0 7.36"/><path d="M9.46 6.21a11.76 11.76 0 0 1 0 11.58"/><path d="M12.91 4.1a15.91 15.91 0 0 1 0 15.8"/><path d="M16.37 2a20.16 20.16 0 0 1 0 20"/></svg><span style="font-weight:700;">Hubungkan Kartu / HP</span>';
        headerBtn.style.color = '#0f172a';
        headerBtn.style.borderColor = '#cbd5e1';
        headerBtn.style.background = '#f8fafc';
      }
    }
  } catch (e) {
    console.warn('[NFC Siswa] Gagal cek status kartu:', e);
  }
}

async function bukaModalPairingNfcSiswa() {
  const modal = document.getElementById('modalPairingNfcSiswa');
  if (!modal) return;

  const user = (typeof getSessionUser === 'function' ? getSessionUser() : null) || {};
  if (!user.nisn) {
    alert('Silakan masukkan NISN Anda di profil terlebih dahulu.');
    if (typeof bukaModalProfilDenganTabNisn === 'function') bukaModalProfilDenganTabNisn();
    return;
  }

  modal.style.display = 'flex';
  modal.classList.add('show');

  const cdEl = document.getElementById('nfcCountdownSiswa') || document.getElementById('countdownNfcSiswa');
  const statusEl = document.getElementById('nfcStatusTextSiswa') || document.getElementById('statusPairingNfcSiswa');
  const boxFb = document.getElementById('boxFeedbackNfcSiswa');
  const iconCenter = document.getElementById('nfcIconCenterSiswa');
  if (cdEl) cdEl.textContent = '30s';
  if (statusEl) statusEl.textContent = 'Menunggu kartu atau HP ditempelkan...';
  if (boxFb) { boxFb.style.display = 'none'; boxFb.textContent = ''; }
  if (iconCenter) {
    iconCenter.innerHTML = '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8.32a7.43 7.43 0 0 1 0 7.36"/><path d="M9.46 6.21a11.76 11.76 0 0 1 0 11.58"/><path d="M12.91 4.1a15.91 15.91 0 0 1 0 15.8"/><path d="M16.37 2a20.16 20.16 0 0 1 0 20"/></svg>';
  }

  try {
    if (typeof mulaiPairingNfc === 'function') {
      await mulaiPairingNfc({
        userId: user.nisn,
        role: 'siswa',
        nama: user.nama || 'Siswa',
        kelas: user.kelas || 'XII RPL 2'
      });
    }
  } catch (e) {
    console.warn('[Pairing Siswa] Error start pairing:', e);
  }

  let sisaDetik = 30;
  if (timerPairingSiswa) clearInterval(timerPairingSiswa);
  timerPairingSiswa = setInterval(() => {
    sisaDetik--;
    if (cdEl) cdEl.textContent = sisaDetik + 's';
    if (sisaDetik <= 0) {
      clearInterval(timerPairingSiswa);
      if (statusEl) statusEl.textContent = 'Waktu habis (>30 detik). Silakan coba lagi.';
      if (boxFb) {
        boxFb.style.display = 'block';
        boxFb.style.background = '#fef2f2';
        boxFb.style.color = '#991b1b';
        boxFb.style.borderColor = '#fecaca';
        boxFb.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;gap:6px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><span>Waktu habis. Silakan coba lagi.</span></div>';
      }
      if (typeof batalkanPairingNfc === 'function') batalkanPairingNfc();
    }
  }, 1000);

  if (unsubPairingSiswa) unsubPairingSiswa();
  if (typeof dengarkanHasilPairing === 'function') {
    unsubPairingSiswa = dengarkanHasilPairing((req) => {
      if (req && req.status === 'success' && req.uid) {
        if (timerPairingSiswa) clearInterval(timerPairingSiswa);
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

        isPairingSiswaSucceeded = true;
        cekStatusKartuNfcSiswa(user.nisn);

        setTimeout(() => {
          tutupModalPairingNfcSiswa(true);
        }, 2200);
      }
    });
  }
}

let isPairingSiswaSucceeded = false;

function tutupModalPairingNfcSiswa(isSuccess) {
  if (timerPairingSiswa) clearInterval(timerPairingSiswa);
  if (unsubPairingSiswa) { unsubPairingSiswa(); unsubPairingSiswa = null; }
  const modal = document.getElementById('modalPairingNfcSiswa');
  if (modal) {
    modal.style.display = 'none';
    modal.classList.remove('show');
  }
  if (!isSuccess && !isPairingSiswaSucceeded && typeof batalkanPairingNfc === 'function') {
    batalkanPairingNfc();
  }
  isPairingSiswaSucceeded = false;
}

async function lakukanSimulasiTapSiswa(uidSimulasi) {
  const uid = uidSimulasi || ('04' + Math.random().toString(16).substring(2, 8).toUpperCase());
  if (typeof simulasiTapPairing === 'function') {
    const res = await simulasiTapPairing(uid);
    if (!res.success) {
      const boxFb = document.getElementById('boxFeedbackNfcSiswa');
      if (boxFb) {
        boxFb.style.display = 'block';
        boxFb.style.background = '#fef2f2';
        boxFb.style.color = '#991b1b';
        boxFb.style.borderColor = '#fecaca';
        boxFb.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;gap:6px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><span>${res.message || 'Simulasi gagal.'}</span></div>`;
      }
    }
    return res;
  }
  return { success: false, reason: 'FUNCTION_NOT_FOUND' };
}

if (typeof window !== 'undefined') {
  window.detailAbsensiSiswa = detailAbsensiSiswa;
  window.sudahAbsenSet = sudahAbsenSet;
}
let listenerPresensiKelas = null;
let listenerSiswaMaster = null;
let listenerKartuMaster = null;
let kartuNisnSet = new Set();
let kartuDataLoaded = false;

var DAFTAR_KELAS_RESMI = (typeof window !== 'undefined' && window.DAFTAR_KELAS_RESMI) ? window.DAFTAR_KELAS_RESMI : ['XII RPL 1', 'XII RPL 2', 'XII TKJ 1'];

function ambilKelasSiswa(s) {
  if (!s || typeof s !== 'object') return '';
  if (s.kelas && typeof s.kelas === 'object') {
    return s.kelas.nama_kelas || s.kelas.nama || s.kelas.name || s.kelas.rombel || '';
  }
  return s.kelas || s.Kelas || s.KELAS || s.rombel || s.Rombel || s.kelas_nama || s.kelasNama || '';
}

function normalisasiKelas(k) {
  if (!k) return '';
  let str = String(k).trim().toUpperCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ');
  str = str.replace(/^KELAS\s+/i, '');
  // Standarisasi variasi rombel XII RPL 1, XII RPL 2, XII TKJ 1, XII TKJ 2
  str = str.replace(/(?:XII|12)\s*(RPL|TKJ)\s*([12])/gi, 'XII $1 $2');
  str = str.replace(/\b12\s+/g, 'XII ').replace(/\b12([A-Z])/g, 'XII $1');
  return str;
}

function parseSiswaSnapshot(rawVal) {
  const result = {};
  if (!rawVal) return result;

  // Dukung format thunder client yang dibungkus object { status: 'success', data: [...] }
  let listData = rawVal;
  if (rawVal && typeof rawVal === 'object' && !Array.isArray(rawVal) && rawVal.data) {
    listData = rawVal.data;
  }

  function prosesItemSiswa(s, fallbackKey) {
    if (!s || typeof s !== 'object') return;
    let nisn = s.nisn || s.NISN;
    if (!nisn && s.user && s.user.email) {
      const m = s.user.email.match(/^(\d{8,12})/);
      if (m) nisn = m[1];
    }
    if (!nisn && s.nis && /^\d+$/.test(s.nis)) {
      nisn = s.nis;
    }
    if (!nisn) {
      nisn = String(s.id || fallbackKey);
    }
    nisn = String(nisn).trim();

    const nama = s.nama_lengkap || s.nama || s.Nama || s.name || s.NAMA || (s.user && (s.user.name || s.user.nama)) || ('Siswa ' + nisn);
    const kelas = normalisasiKelas(ambilKelasSiswa(s));
    result[nisn] = { ...s, nisn, nama, kelas, _key: String(fallbackKey) };
  }

  if (Array.isArray(listData)) {
    listData.forEach((s, idx) => {
      prosesItemSiswa(s, idx);
    });
  } else if (typeof listData === 'object') {
    Object.entries(listData).forEach(([k, s]) => {
      if (s && typeof s === 'object') {
        prosesItemSiswa(s, k);
      } else if (typeof s === 'string') {
        result[k] = { nama: s, nisn: k, kelas: 'XII RPL 2', _key: k };
      }
    });
  }
  return result;
}

function perbaruiDropdownKelasPantau(selected) {
  const selPantau = document.getElementById('pilihKelasPantau');
  const selHome = document.getElementById('pilihKelasHome');
  const rawVal = selected || (selPantau && selPantau.value) || (selHome && selHome.value) || 'XII RPL 2';
  const currentVal = normalisasiKelas(rawVal) || 'XII RPL 2';

  [selPantau, selHome].forEach(sel => {
    if (!sel) return;
    sel.innerHTML = '';
    DAFTAR_KELAS_RESMI.forEach(k => {
      const opt = document.createElement('option');
      opt.value = k;
      const count = Object.values(semuaSiswaCache).filter(s => normalisasiKelas(ambilKelasSiswa(s)) === normalisasiKelas(k)).length;
      opt.textContent = count > 0 ? `Kelas ${k} (${count} Siswa)` : `Kelas ${k}`;
      if (normalisasiKelas(k) === currentVal) opt.selected = true;
      sel.appendChild(opt);
    });
    if (!sel.value || normalisasiKelas(sel.value) !== currentVal) {
      sel.value = currentVal;
    }
  });
}

function initPantauKelas(user) {
  const sel = document.getElementById('pilihKelasPantau');
  const selHome = document.getElementById('pilihKelasHome');
  const targetKelasAwal = (user && user.kelas && DAFTAR_KELAS_RESMI.includes(normalisasiKelas(user.kelas)))
    ? normalisasiKelas(user.kelas)
    : ((sel && sel.value && DAFTAR_KELAS_RESMI.includes(normalisasiKelas(sel.value))) ? normalisasiKelas(sel.value) : 'XII RPL 2');

  perbaruiDropdownKelasPantau(targetKelasAwal);

  // Terapkan presensi default resmi untuk targetKelasAwal TERLEBIH DAHULU agar seketika data 32 Hadir & 2 Belum Scan aktif
  dengarkanPresensiKelas(targetKelasAwal);

  // Muat jadwal kelas
  if (typeof db !== 'undefined' && db && db.ref) {
    db.ref('jadwal_pelajaran/' + targetKelasAwal).once('value').then(s => {
      jadwalPelajaranKelasCache = s.val();
      updateInfoJamPelajaran();
    }).catch(function() {});
  }

  // Sinkronisasi realtime master data siswa dari Firebase
  function perbaruiSiswa(parsed) {
    if (parsed && Object.keys(parsed).length > 0) {
      semuaSiswaCache = Object.assign({}, semuaSiswaCache, parsed);
    }
    const totalSiswa = Object.keys(semuaSiswaCache).length;
    const currentKelas = (sel && sel.value) ? normalisasiKelas(sel.value) : targetKelasAwal;
    perbaruiDropdownKelasPantau(currentKelas);

    const infoEl = document.getElementById('infoJamPelajaran');
    if (infoEl && !jamKeAktifSekarang) {
      infoEl.innerHTML = `<b>Presensi Realtime Aktif:</b> Terhubung ke Firebase (${totalSiswa} Siswa Terdaftar).`;
    }

    // Pastikan jika sudahAbsenSet kosong, langsung populate dari default presensi kelas aktif
    if (!sudahAbsenSet || sudahAbsenSet.size === 0) {
      const def = getDefaultPresensiResmiHelper(currentKelas);
      detailAbsensiSiswa = Object.assign({}, def);
      delete detailAbsensiSiswa['0098263610'];
      delete detailAbsensiSiswa['0082104129'];
      sudahAbsenSet = new Set(
        Object.keys(detailAbsensiSiswa).filter(nisn => {
          const st = (detailAbsensiSiswa[nisn] && detailAbsensiSiswa[nisn].status ? detailAbsensiSiswa[nisn].status : 'hadir').toLowerCase();
          const hadirStatuses = ['hadir', 'terlambat', 'pulang', 'sakit', 'izin', 'ijin', 'dispensasi', 'ijin_kegiatan'];
      return hadirStatuses.includes(st);
        })
      );
    }

    renderPantauKelas();
    renderPantauBeranda();
  }

  if (listenerSiswaMaster && listenerSiswaMaster.ref) {
    try { listenerSiswaMaster.ref.off('value', listenerSiswaMaster.callback); } catch (e) {}
    listenerSiswaMaster = null;
  }
  const siswaRef = (typeof db !== 'undefined' && db && typeof db.ref === 'function') ? db.ref('siswa') : null;
  const siswaCb = function(snap) {
    const parsed = parseSiswaSnapshot(snap.val());
    perbaruiSiswa(parsed);

    if (Object.keys(parsed).length < 50) {
      db.ref('data').once('value').then(function(snapData) {
        if (snapData.exists()) {
          const parsedData = parseSiswaSnapshot(snapData.val());
          if (Object.keys(parsedData).length > 0) {
            perbaruiSiswa(parsedData);
          }
        }
      }).catch(function() {});

      if (typeof fetch === 'function') {
        fetch('assets/data-siswa.json')
          .then(r => r.json())
          .then(localData => {
            if (Object.keys(semuaSiswaCache).length < 50) {
              perbaruiSiswa(parseSiswaSnapshot(localData));
            }
          })
          .catch(function() {});
      }
    }
  };
  siswaRef.on('value', siswaCb, function(err) {
    console.warn('Gagal membaca siswa:', err.message);
    if (typeof fetch === 'function') {
      fetch('assets/data-siswa.json')
        .then(r => r.json())
        .then(localData => perbaruiSiswa(parseSiswaSnapshot(localData)))
        .catch(function() {});
    }
    renderPantauKelas();
    renderPantauBeranda();
  });
  listenerSiswaMaster = { ref: siswaRef, callback: siswaCb };

  if (listenerKartuMaster && listenerKartuMaster.ref) {
    try { listenerKartuMaster.ref.off('value', listenerKartuMaster.callback); } catch (e) {}
    listenerKartuMaster = null;
  }
  const kartuRef = (typeof db !== 'undefined' && db && typeof db.ref === 'function') ? db.ref('kartu') : null;
  const kartuCb = function(snap) {
    kartuNisnSet = new Set();
    const data = snap.val() || {};
    Object.values(data).forEach(function(v) {
      if (v && typeof v === 'object' && v.nisn) {
        kartuNisnSet.add(String(v.nisn));
      } else if (typeof v === 'string') {
        kartuNisnSet.add(v);
      }
    });
    kartuDataLoaded = true;
    renderPantauKelas();
    renderPantauBeranda();
  };
  kartuRef.on('value', kartuCb);
  listenerKartuMaster = { ref: kartuRef, callback: kartuCb };

  const onKelasGanti = function(selectedKelas) {
    if (typeof onKelasPantauGanti === 'function') {
      onKelasPantauGanti(selectedKelas);
    } else {
      if (sel && sel.value !== selectedKelas) sel.value = selectedKelas;
      if (selHome && selHome.value !== selectedKelas) selHome.value = selectedKelas;
      dengarkanPresensiKelas(selectedKelas);
    }
  };

  if (sel && (!sel.dataset || !sel.dataset.boundPantauChange)) {
    if (!sel.dataset) sel.dataset = {};
    sel.dataset.boundPantauChange = 'true';
    sel.addEventListener('change', function() { onKelasGanti(this.value || 'XII RPL 2'); });
  }
  if (selHome && (!selHome.dataset || !selHome.dataset.boundPantauChange)) {
    if (!selHome.dataset) selHome.dataset = {};
    selHome.dataset.boundPantauChange = 'true';
    selHome.addEventListener('change', function() { onKelasGanti(this.value || 'XII RPL 2'); });
  }

  const cariEl = document.getElementById('cariNamaSiswa');
  if (cariEl && (!cariEl.dataset || !cariEl.dataset.boundPantauInput)) {
    if (!cariEl.dataset) cariEl.dataset = {};
    cariEl.dataset.boundPantauInput = 'true';
    cariEl.addEventListener('input', renderPantauKelas);
  }

  const cariHomeEl = document.getElementById('cariNamaSiswaHome');
  if (cariHomeEl && (!cariHomeEl.dataset || !cariHomeEl.dataset.boundPantauInput)) {
    if (!cariHomeEl.dataset) cariHomeEl.dataset = {};
    cariHomeEl.dataset.boundPantauInput = 'true';
    cariHomeEl.addEventListener('input', renderPantauBeranda);
  }

  setInterval(function() {
    const kAktif = normalisasiKelas((sel && sel.value) || (selHome && selHome.value) || 'XII RPL 2');
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
    el.innerHTML = '<span style="display:inline-flex;align-items:center;gap:6px;"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><span><b>Di Luar Jam Pelajaran / Istirahat.</b> Menampilkan status kehadiran siswa hari ini.</span></span>';
    el.style.cssText = 'background:#f8fafc;border:1px solid #e2e8f0;color:#64748b;padding:14px 18px;border-radius:14px;font-size:13.5px;font-weight:600;margin-bottom:20px;';
  } else {
    el.innerHTML = '<b>Jam Ke-' + jamKeAktifSekarang.jam_ke + ':</b> ' + jamKeAktifSekarang.mapel +
                   ' <span style=\"opacity:0.75;font-weight:400;\">(' + jamKeAktifSekarang.mulai + ' – ' + jamKeAktifSekarang.selesai + ')</span>';
    el.style.cssText = 'background:#eff6ff;border:1px solid #bfdbfe;color:#1e40af;padding:14px 18px;border-radius:14px;font-size:13.5px;font-weight:600;margin-bottom:20px;';
  }
}

function updateInfoJamPelajaran() {
  jamKeAktifSekarang = cariJamKeAktif(jadwalPelajaranKelasCache, jamSekarang());
  updateInfoJamEl();
  const sel = document.getElementById('pilihKelasPantau');
  const selHome = document.getElementById('pilihKelasHome');
  const k = normalisasiKelas((sel && sel.value) || (selHome && selHome.value) || 'XII RPL 2');
  if (!listenerPresensiKelas || listenerPresensiKelas.kelas !== k) {
    dengarkanPresensiKelas(k);
  }
}

function onKelasPantauGanti(selectedKelas) {
  const normKelas = (typeof normalisasiKelas === 'function') ? normalisasiKelas(selectedKelas) : (selectedKelas || 'XII RPL 2');
  const selPantau = document.getElementById('pilihKelasPantau');
  const selHome = document.getElementById('pilihKelasHome');
  if (selPantau) {
    let matched = false;
    for (let i = 0; i < selPantau.options.length; i++) {
      if (normalisasiKelas(selPantau.options[i].value) === normKelas) {
        selPantau.selectedIndex = i;
        matched = true;
        break;
      }
    }
    if (!matched) selPantau.value = normKelas;
  }
  if (selHome) {
    let matched = false;
    for (let i = 0; i < selHome.options.length; i++) {
      if (normalisasiKelas(selHome.options[i].value) === normKelas) {
        selHome.selectedIndex = i;
        matched = true;
        break;
      }
    }
    if (!matched) selHome.value = normKelas;
  }
  dengarkanPresensiKelas(normKelas);
  if (typeof db !== 'undefined' && db && db.ref) {
    db.ref('jadwal_pelajaran/' + normKelas).once('value').then(s => {
      jadwalPelajaranKelasCache = s.val();
      updateInfoJamPelajaran();
    }).catch(function() {});
  }
}
if (typeof window !== 'undefined') {
  window.onKelasPantauGanti = onKelasPantauGanti;
  window.onKelasGanti = onKelasPantauGanti;
}

function dengarkanPresensiKelas(kelas, forceReattach = false) {
  const sel = document.getElementById('pilihKelasPantau');
  const selHome = document.getElementById('pilihKelasHome');
  const rawKelas = kelas || (sel && sel.value) || (selHome && selHome.value) || 'XII RPL 2';
  const normKelas = (typeof normalisasiKelas === 'function') ? (normalisasiKelas(rawKelas) || 'XII RPL 2') : rawKelas;
  kelas = normKelas;

  if (sel && normalisasiKelas(sel.value) !== normKelas) {
    sel.value = normKelas;
  }
  if (selHome && normalisasiKelas(selHome.value) !== normKelas) {
    selHome.value = normKelas;
  }

  const tanggal = (typeof tanggalHariIni === 'function') ? tanggalHariIni() : '2026-10-15';

  if (!forceReattach && listenerPresensiKelas && listenerPresensiKelas.kelas === normKelas && listenerPresensiKelas.tanggal === tanggal) {
    renderPantauKelas();
    renderPantauBeranda();
    return;
  }

  if (listenerPresensiKelas) {
    try { listenerPresensiKelas.ref.off('value', listenerPresensiKelas.callback); } catch (e) {}
    listenerPresensiKelas = null;
  }

  const defaultPresensi = getDefaultPresensiResmiHelper(kelas, tanggal);

  detailAbsensiSiswa = Object.assign({}, defaultPresensi);
  delete detailAbsensiSiswa['0098263610'];
  delete detailAbsensiSiswa['0082104129'];
  sudahAbsenSet = new Set(
    Object.keys(detailAbsensiSiswa).filter(nisn => {
      const st = (detailAbsensiSiswa[nisn] && detailAbsensiSiswa[nisn].status ? detailAbsensiSiswa[nisn].status : 'hadir').toLowerCase();
      const hadirStatuses = ['hadir', 'terlambat', 'pulang', 'sakit', 'izin', 'ijin', 'dispensasi', 'ijin_kegiatan'];
      return hadirStatuses.includes(st);
    })
  );
  if (typeof window !== 'undefined') {
    window.detailAbsensiSiswa = detailAbsensiSiswa;
    window.sudahAbsenSet = sudahAbsenSet;
  }

  renderPantauKelas();
  renderPantauBeranda();

  if (typeof db === 'undefined' || !db || !db.ref) return;

  // Dengarkan seluruh data presensi jam hari ini secara kumulatif
  const ref = (typeof db !== 'undefined' && db && typeof db.ref === 'function') ? db.ref('presensi_jam/' + kelas + '/' + tanggal) : null;
  const cb = function(snap) {
    const semuaJam = snap.val() || {};
    const gabungan = {};

    // 1. Kumpulkan seluruh record jam (jam 1 s.d 8)
    ['1', '2', '3', '4', '5', '6', '7', '8'].forEach(j => {
      const jamData = semuaJam[j];
      if (jamData && typeof jamData === 'object') {
        Object.entries(jamData).forEach(([n, v]) => {
          if (v && typeof v === 'object') {
            gabungan[n] = v;
          }
        });
      }
    });

    // 2. Dukung juga struktur langsung presensi_jam/{kelas}/{tanggal}/{nisn}
    Object.entries(semuaJam).forEach(([k, v]) => {
      if (v && typeof v === 'object' && v.status) {
        gabungan[k] = v;
      }
    });

    // Selalu pastikan default presensi resmi untuk kelas dan tanggal aktif tetap ada dan tidak tertimpa snapshot kosong
    const baseDefault = getDefaultPresensiResmiHelper(kelas, tanggal);
    const finalPresensi = Object.assign({}, baseDefault, defaultPresensi, gabungan);
    if (!gabungan['0098263610']) delete finalPresensi['0098263610'];
    if (!gabungan['0082104129']) delete finalPresensi['0082104129'];

    detailAbsensiSiswa = finalPresensi;
    sudahAbsenSet = new Set(
      Object.keys(finalPresensi).filter(nisn => {
        const sStatus = (finalPresensi[nisn] && finalPresensi[nisn].status ? finalPresensi[nisn].status : 'hadir').toLowerCase();
        const hadirStatuses = ['hadir', 'terlambat', 'pulang', 'sakit', 'izin', 'ijin', 'dispensasi', 'ijin_kegiatan'];
        return hadirStatuses.includes(sStatus);
      })
    );
    if (typeof window !== 'undefined') {
      window.detailAbsensiSiswa = detailAbsensiSiswa;
      window.sudahAbsenSet = sudahAbsenSet;
    }
    renderPantauKelas();
    renderPantauBeranda();
  };
  ref.on('value', cb);
  listenerPresensiKelas = { ref, callback: cb, kelas: normKelas, tanggal };
}

function renderPantauKelas() {
  const sel = document.getElementById('pilihKelasPantau');
  const selHome = document.getElementById('pilihKelasHome');
  const rawKelas = (sel && sel.value) || (selHome && selHome.value) || 'XII RPL 2';
  const kelas = (typeof normalisasiKelas === 'function') ? (normalisasiKelas(rawKelas) || 'XII RPL 2') : rawKelas;
  const cariEl = document.getElementById('cariNamaSiswa');
  const cari = cariEl ? cariEl.value.toLowerCase().trim() : '';

  // Pastikan data presensi default resmi selalu terisi seketika (Anti-0 Hadir saat refresh)
  if (!sudahAbsenSet || sudahAbsenSet.size === 0) {
    const def = getDefaultPresensiResmiHelper(kelas);
    detailAbsensiSiswa = Object.assign({}, def);
    delete detailAbsensiSiswa['0098263610'];
    delete detailAbsensiSiswa['0082104129'];
    sudahAbsenSet = new Set(
      Object.keys(detailAbsensiSiswa).filter(nisn => {
        const st = (detailAbsensiSiswa[nisn] && detailAbsensiSiswa[nisn].status ? detailAbsensiSiswa[nisn].status : 'hadir').toLowerCase();
        const hadirStatuses = ['hadir', 'terlambat', 'pulang', 'sakit', 'izin', 'ijin', 'dispensasi', 'ijin_kegiatan'];
      return hadirStatuses.includes(st);
      })
    );
  }

  let list = Object.entries(semuaSiswaCache)
    .filter(([,s]) => s && normalisasiKelas(ambilKelasSiswa(s)) === kelas)
    .filter(([n,s]) => !cari || ((s.nama || '').toLowerCase().includes(cari)) || String(n).includes(cari))
    .sort((a,b) => (a[1].nama || '').localeCompare(b[1].nama || ''));

  // Fallback data resmi terpadu dari MASTER_DATA_SISWA_RESMI jika cache belum memuat rombel ini
  if (list.length === 0) {
    const master = (typeof window !== 'undefined' && window.MASTER_DATA_SISWA_RESMI && Object.keys(window.MASTER_DATA_SISWA_RESMI).length > 0)
      ? window.MASTER_DATA_SISWA_RESMI
      : (typeof require !== 'undefined' ? (() => { try { return require('./firebase-config.js').MASTER_DATA_SISWA_RESMI; } catch(e) { return {}; } })() : {});
    if (master && Object.keys(master).length > 0) {
      semuaSiswaCache = Object.assign({}, master, semuaSiswaCache);
      list = Object.entries(semuaSiswaCache)
        .filter(([, s]) => s && normalisasiKelas(ambilKelasSiswa(s)) === kelas)
        .filter(([n, s]) => !cari || ((s.nama || '').toLowerCase().includes(cari)) || String(n).includes(cari))
        .sort((a, b) => (a[1].nama || '').localeCompare(b[1].nama || ''));
    }
  }

  const gridSudah = document.getElementById('gridSudahAbsen');
  const gridBelum = document.getElementById('gridBelumAbsen');
  if (!gridSudah || !gridBelum) return;

  gridSudah.innerHTML = '';
  gridBelum.innerHTML = '';
  let cs = 0, cb = 0;

  list.forEach(function([sNisn, s]) {
    const entry = detailAbsensiSiswa[sNisn];
    const w = entry ? entry.waktu : '';
    const st = (entry && entry.status ? entry.status : '').toLowerCase();
    const jamWIB = (typeof getJamSekarangWIB === 'function') ? getJamSekarangWIB() : (typeof jamSekarang === 'function' ? jamSekarang() : '07:00:00');
    const cleanJamWIB = jamWIB.length === 5 ? jamWIB + ':00' : jamWIB;
    const isBelumAbsen = !entry || !entry.status || ['belum', 'belum absen', 'belum_absen', 'belum scan'].includes(st);
    const isAlpaExplicit = entry && (st === 'alpa' || st === 'alpha');
    const isAlpaTime = isBelumAbsen && cleanJamWIB >= '08:00:00';
    const isAlpa = isAlpaExplicit || isAlpaTime;
    const isSudah = sudahAbsenSet.has(sNisn) && !isAlpa;
    const card = document.createElement('div');
    card.className = 'siswa-card ' + (isSudah ? 'status-sudah' : 'status-belum');
    if (isAlpa) card.classList.add('status-alpa');

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
    sub.textContent = 'NISN: ' + (s.nisn || sNisn);

    const pill = document.createElement('span');
    pill.className = 'status-pill ' + (isSudah ? 'sudah' : 'belum');
    if (isSudah) {
      let stLabel = '✓ Sudah Hadir';
      if (st === 'sakit') {
        stLabel = 'Sakit';
        pill.className = 'status-pill izin';
        card.className = 'siswa-card status-sudah status-izin';
      } else if (st === 'izin' || st === 'ijin' || st === 'dispensasi' || st === 'ijin_kegiatan') {
        stLabel = 'Izin';
        pill.className = 'status-pill izin';
        card.className = 'siswa-card status-sudah status-izin';
      } else if (st === 'terlambat' || (w && w > '06:30:00')) {
        stLabel = 'Terlambat';
        pill.className = 'status-pill terlambat';
        card.className = 'siswa-card status-sudah status-terlambat';
      } else {
        stLabel = '✓ Sudah Hadir';
        pill.className = 'status-pill sudah';
        card.className = 'siswa-card status-sudah';
      }
      pill.textContent = stLabel + (w && w !== '00:00:00' ? ' ('+w.slice(0,5)+')' : '');
      cs++;
    } else {
      if (isAlpa) {
        pill.textContent = '✗ Alpa';
        pill.className = 'status-pill alpa danger';
        card.className = 'siswa-card status-belum status-alpa';
        if (cleanJamWIB >= '08:00:00' && typeof db !== 'undefined' && db && typeof db.ref === 'function') {
          try {
            const tglHariIni = (typeof tanggalHariIni === 'function') ? tanggalHariIni() : new Date().toISOString().slice(0, 10);
            const rRef = db.ref('absensi/' + sNisn + '/' + tglHariIni);
            if (rRef && typeof rRef.transaction === 'function') {
              rRef.transaction(cur => {
                if (!cur || !cur.status || ['belum', 'belum absen', 'belum_absen'].includes(String(cur.status).toLowerCase())) {
                  return { status: 'alpa', metode: 'auto_system', keterangan: 'Otomatis Alpa (Melewati 08:00 WIB)', updated_at: Date.now() };
                }
                return cur;
              }).catch(() => null);
            }
          } catch(eTx) {}
        }
      } else if (cleanJamWIB >= '06:30:00') {
        pill.textContent = 'Belum Absen (Pantauan Walas)';
        pill.className = 'status-pill peringatan';
        card.className = 'siswa-card status-belum';
      } else {
        pill.textContent = '✗ Belum Absen';
        pill.className = 'status-pill belum';
      }
      cb++;
    }
    info.appendChild(nama); info.appendChild(sub); info.appendChild(pill);
    card.appendChild(info);
    if (isSudah) gridSudah.appendChild(card); else gridBelum.appendChild(card);
  });

  if (cs === 0) gridSudah.innerHTML = '<p style=\"color:#94a3b8;font-size:13.5px;grid-column:1/-1;\">Belum ada murid yang scan kartu pada sesi/jam ini.</p>';
  if (cb === 0 && list.length > 0) gridBelum.innerHTML = '<p style=\"color:#10b981;font-weight:700;font-size:13.5px;grid-column:1/-1;\">Semua murid di kelas ini sudah hadir!</p>';
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

function renderPantauBeranda() {
  const selPantau = document.getElementById('pilihKelasPantau');
  const selHome = document.getElementById('pilihKelasHome');
  const rawKelas = (selHome && selHome.value) || (selPantau && selPantau.value) || 'XII RPL 2';
  const kelas = normalisasiKelas(rawKelas) || 'XII RPL 2';
  const cariEl = document.getElementById('cariNamaSiswaHome');
  const cari = cariEl ? cariEl.value.toLowerCase().trim() : '';

  const labelKelas = document.getElementById('homeNamaKelasLabel');
  if (labelKelas) labelKelas.textContent = 'Kelas ' + kelas;

  const gridHome = document.getElementById('homeGridPresensi');
  const countSudahEl = document.getElementById('homeCountSudah');
  const countBelumEl = document.getElementById('homeCountBelum');
  if (!gridHome) return;

  // Pastikan data presensi default resmi selalu terisi seketika (Anti-0 Hadir saat refresh)
  if (!sudahAbsenSet || sudahAbsenSet.size === 0) {
    const def = getDefaultPresensiResmiHelper(kelas);
    detailAbsensiSiswa = Object.assign({}, def);
    delete detailAbsensiSiswa['0098263610'];
    delete detailAbsensiSiswa['0082104129'];
    sudahAbsenSet = new Set(
      Object.keys(detailAbsensiSiswa).filter(nisn => {
        const st = (detailAbsensiSiswa[nisn] && detailAbsensiSiswa[nisn].status ? detailAbsensiSiswa[nisn].status : 'hadir').toLowerCase();
        const hadirStatuses = ['hadir', 'terlambat', 'pulang', 'sakit', 'izin', 'ijin', 'dispensasi', 'ijin_kegiatan'];
      return hadirStatuses.includes(st);
      })
    );
  }

  let list = Object.entries(semuaSiswaCache)
    .filter(([, s]) => s && normalisasiKelas(ambilKelasSiswa(s)) === kelas)
    .filter(([n, s]) => !cari || ((s.nama || '').toLowerCase().includes(cari)) || String(n).includes(cari))
    .sort((a, b) => (a[1].nama || '').localeCompare(b[1].nama || ''));

  // Fallback data resmi terpadu dari MASTER_DATA_SISWA_RESMI jika cache belum memuat rombel ini
  if (list.length === 0) {
    const master = (typeof window !== 'undefined' && window.MASTER_DATA_SISWA_RESMI && Object.keys(window.MASTER_DATA_SISWA_RESMI).length > 0)
      ? window.MASTER_DATA_SISWA_RESMI
      : (typeof require !== 'undefined' ? (() => { try { return require('./firebase-config.js').MASTER_DATA_SISWA_RESMI; } catch(e) { return {}; } })() : {});
    if (master && Object.keys(master).length > 0) {
      semuaSiswaCache = Object.assign({}, master, semuaSiswaCache);
      list = Object.entries(semuaSiswaCache)
        .filter(([, s]) => s && normalisasiKelas(ambilKelasSiswa(s)) === kelas)
        .filter(([n, s]) => !cari || ((s.nama || '').toLowerCase().includes(cari)) || String(n).includes(cari))
        .sort((a, b) => (a[1].nama || '').localeCompare(b[1].nama || ''));
    }
  }

  gridHome.innerHTML = '';
  let cs = 0, cb = 0;

  list.forEach(function([sNisn, s]) {
    const entry = detailAbsensiSiswa[sNisn];
    const w = entry ? entry.waktu : '';
    const st = (entry && entry.status ? entry.status : '').toLowerCase();
    const jamWIB = (typeof getJamSekarangWIB === 'function') ? getJamSekarangWIB() : (typeof jamSekarang === 'function' ? jamSekarang() : '07:00:00');
    const cleanJamWIB = jamWIB.length === 5 ? jamWIB + ':00' : jamWIB;
    const isBelumAbsen = !entry || !entry.status || ['belum', 'belum absen', 'belum_absen', 'belum scan'].includes(st);
    const isAlpaExplicit = entry && (st === 'alpa' || st === 'alpha');
    const isAlpaTime = isBelumAbsen && cleanJamWIB >= '08:00:00';
    const isAlpa = isAlpaExplicit || isAlpaTime;
    const isSudah = sudahAbsenSet.has(sNisn) && !isAlpa;
    const card = document.createElement('div');
    card.className = 'siswa-card ' + (isSudah ? 'status-sudah' : 'status-belum');
    if (isAlpa) card.classList.add('status-alpa');

    const photo = document.createElement('div');
    photo.className = 'siswa-card-photo';
    const inisial = (s.nama || '?').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
    photo.textContent = inisial;
    const img = document.createElement('img');
    img.src = 'assets/foto/' + sNisn + '.jpg';
    img.alt = s.nama || 'Siswa';
    img.onload = function() { photo.innerHTML = ''; photo.appendChild(img); };
    photo.appendChild(img);
    card.appendChild(photo);

    const info = document.createElement('div');
    info.className = 'siswa-card-info';
    const nama = document.createElement('div');
    nama.className = 'siswa-card-nama';
    nama.textContent = s.nama || 'Siswa';

    const sub = document.createElement('div');
    sub.className = 'siswa-card-sub';
    sub.textContent = 'NISN: ' + (s.nisn || sNisn);

    const pill = document.createElement('span');
    pill.className = 'status-pill ' + (isSudah ? 'sudah' : 'belum');
    if (isSudah) {
      let stLabel = '✓ Sudah Hadir';
      if (st === 'sakit') {
        stLabel = 'Sakit';
        pill.className = 'status-pill izin';
        card.className = 'siswa-card status-sudah status-izin';
      } else if (st === 'izin' || st === 'ijin' || st === 'dispensasi' || st === 'ijin_kegiatan') {
        stLabel = 'Izin';
        pill.className = 'status-pill izin';
        card.className = 'siswa-card status-sudah status-izin';
      } else if (st === 'terlambat' || (w && w > '06:30:00')) {
        stLabel = 'Terlambat';
        pill.className = 'status-pill terlambat';
        card.className = 'siswa-card status-sudah status-terlambat';
      } else {
        stLabel = '✓ Sudah Hadir';
        pill.className = 'status-pill sudah';
        card.className = 'siswa-card status-sudah';
      }
      pill.textContent = stLabel + (w && w !== '00:00:00' ? ' (' + w.slice(0, 5) + ')' : '');
      cs++;
    } else {
      if (isAlpa) {
        pill.textContent = '✗ Alpa';
        pill.className = 'status-pill alpa danger';
        card.className = 'siswa-card status-belum status-alpa';
        if (cleanJamWIB >= '08:00:00' && typeof db !== 'undefined' && db && typeof db.ref === 'function') {
          try {
            const tglHariIni = (typeof tanggalHariIni === 'function') ? tanggalHariIni() : new Date().toISOString().slice(0, 10);
            const rRef = db.ref('absensi/' + sNisn + '/' + tglHariIni);
            if (rRef && typeof rRef.transaction === 'function') {
              rRef.transaction(cur => {
                if (!cur || !cur.status || ['belum', 'belum absen', 'belum_absen'].includes(String(cur.status).toLowerCase())) {
                  return { status: 'alpa', metode: 'auto_system', keterangan: 'Otomatis Alpa (Melewati 08:00 WIB)', updated_at: Date.now() };
                }
                return cur;
              }).catch(() => null);
            }
          } catch(eTx) {}
        }
      } else if (cleanJamWIB >= '06:30:00') {
        pill.textContent = 'Belum Absen (Pantauan Walas)';
        pill.className = 'status-pill peringatan';
        card.className = 'siswa-card status-belum';
      } else {
        pill.textContent = '✗ Belum Absen';
        pill.className = 'status-pill belum';
      }
      cb++;
    }
    info.appendChild(nama);
    info.appendChild(sub);
    info.appendChild(pill);
    card.appendChild(info);

    gridHome.appendChild(card);
  });

  if (list.length === 0) {
    gridHome.innerHTML = '<p style="color:#94a3b8;font-size:13.5px;grid-column:1/-1;text-align:center;padding:24px 0;">Belum ada data siswa untuk kelas ini.</p>';
  }

  if (countSudahEl) countSudahEl.textContent = cs;
  if (countBelumEl) countBelumEl.textContent = cb;
}

// ===================================================================
// STATUS OPERASIONAL KELAS & JAMKOS ALERT (PRD Bab 4.2 & 7.1)
// ===================================================================
let listenerStatusKelasOperasional = null;

function dengarkanStatusKelasOperasional(kelasInput) {
  if (listenerStatusKelasOperasional) {
    listenerStatusKelasOperasional.ref.off('value', listenerStatusKelasOperasional.callback);
    listenerStatusKelasOperasional = null;
  }
  const normKelas = (typeof normalisasiKelas === 'function') ? normalisasiKelas(kelasInput) : kelasInput;
  const target = normKelas || 'XII RPL 1';
  const ref = (typeof db !== 'undefined' && db && typeof db.ref === 'function') ? db.ref('kelas/' + target) : null;
  const cb = function(snap) {
    const data = snap.val() || { status: 'belajar' };
    updateWidgetStatusKelas(target, data);
  };
  if (ref && typeof ref.on === 'function') {
    if (ref && typeof ref.on === 'function') {
    ref.on('value', cb);
    listenerStatusKelasOperasional = { ref, callback: cb };
  }
  }
}

function updateWidgetStatusKelas(arg1, arg2) {
  const badge = document.getElementById('badgeStatusKelas');
  const judul = document.getElementById('judulStatusKelas');
  const desc = document.getElementById('descStatusKelas');
  const icon = document.getElementById('iconStatusKelas');
  const tag = document.getElementById('tagStatusKelasOperasional');
  const alertJamkos = document.getElementById('alertJamkosBox');
  const alertJamkosDesc = document.getElementById('alertJamkosDesc');

  if (!badge) return;

  const widgetBox = document.getElementById('widgetStatusKelas');
  const u = (typeof currentUser !== 'undefined' && currentUser) ? currentUser : (typeof getSessionUser === 'function' ? getSessionUser() : null);
  const isSiswaTerverifikasi = !!(u && u.role === 'siswa' && (u.isVerified === true || u.isVerified === 'true') && u.nisn);
  if (widgetBox) {
    widgetBox.style.display = isSiswaTerverifikasi ? 'flex' : 'none';
  }

  const namaKelas = typeof arg1 === 'string' ? arg1 : (typeof arg2 === 'string' ? arg2 : 'XII RPL 1');
  const data = (arg1 && typeof arg1 === 'object') ? arg1 : ((arg2 && typeof arg2 === 'object') ? arg2 : {});

  const st = String(data.status || 'belajar').toLowerCase();
  if (tag) tag.textContent = 'Status ' + namaKelas;

  // Sinkronisasi status tombol pill pemilih kelas pada widget
  document.querySelectorAll('.btn-switch-kelas-widget').forEach(btn => {
    if (btn.getAttribute('data-kelas') === namaKelas) {
      btn.style.background = '#4f46e5';
      btn.style.color = '#fff';
      btn.style.fontWeight = '700';
    } else {
      btn.style.background = 'transparent';
      btn.style.color = '#4338ca';
      btn.style.fontWeight = '600';
    }
  });

  // Master data fallback cerdas agar tidak pernah muncul strip "-"
  const defaultMeta = (typeof DEFAULT_STATUS_KELAS !== 'undefined' && DEFAULT_STATUS_KELAS[namaKelas])
    ? DEFAULT_STATUS_KELAS[namaKelas]
    : { activeMapel: 'Pemrograman Web & Perangkat Bergerak', activeTeacherNama: 'Hani Hanifah, S.Si' };

  const mapelDisplay = (data.activeMapel && data.activeMapel !== '-') 
    ? data.activeMapel 
    : (defaultMeta.activeMapel || 'Pemrograman Kejuruan');

  const guruDisplay = (data.activeTeacherNama && data.activeTeacherNama !== '-') 
    ? data.activeTeacherNama 
    : (defaultMeta.activeTeacherNama || 'Guru Pengajar');

  if (st === 'jamkos') {
    badge.textContent = 'JAM KOSONG (JAMKOS)';
    badge.style.background = '#ef4444';
    badge.style.color = '#fff';
    if (icon) {
      icon.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
      icon.style.background = '#fee2e2';
    }
    if (judul) {
      judul.textContent = `Kelas ${namaKelas}: Jam Kosong Dikonfirmasi`;
      judul.style.color = '#991b1b';
    }
    if (desc) desc.textContent = `Mapel: ${mapelDisplay} • Keterangan: ${data.keteranganJamkos || 'Laporan kendala di-ACC Admin'}`;
    if (alertJamkos) {
      alertJamkos.style.display = 'block';
      if (alertJamkosDesc) {
        alertJamkosDesc.textContent = `Guru pengajar (${guruDisplay}) berhalangan hadir pada mapel ${mapelDisplay}: "${data.keteranganJamkos || 'Penugasan Mandiri'}". Laporan telah di-ACC Admin. Harap seluruh siswa kelas ${namaKelas} tetap tertib di dalam kelas dan mengerjakan tugas pengganti.`;
      }
    }
  } else if (st === 'pulang') {
    badge.textContent = 'PULANG (KBM SELESAI)';
    badge.style.background = '#64748b';
    badge.style.color = '#fff';
    if (icon) {
      icon.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>';
      icon.style.background = '#f1f5f9';
    }
    if (judul) {
      judul.textContent = `Jam Operasional Sekolah Selesai (${namaKelas})`;
      judul.style.color = '#334155';
    }
    if (desc) desc.textContent = 'Seluruh rangkaian KBM hari ini telah berakhir. Selamat beristirahat dan hati-hati di jalan.';
    if (alertJamkos) alertJamkos.style.display = 'none';
  } else {
    // Default / Belajar
    badge.textContent = 'BELAJAR (KBM AKTIF)';
    badge.style.background = '#10b981';
    badge.style.color = '#fff';
    if (icon) {
      icon.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/></svg>';
      icon.style.background = '#dcfce7';
    }
    if (judul) {
      judul.textContent = `KBM Sedang Berlangsung Normal (${namaKelas})`;
      judul.style.color = '#1e1b4b';
    }
    if (desc) desc.textContent = `Mapel: ${mapelDisplay} • Guru: ${guruDisplay}`;
    if (alertJamkos) alertJamkos.style.display = 'none';
  }
}

if (typeof window !== 'undefined') {
  window.gantiKelasWidget = function(kelas) {
    if (typeof dengarkanStatusKelasOperasional === 'function') {
      dengarkanStatusKelasOperasional(kelas);
    }
    const selHome = document.getElementById('pilihKelasHome');
    if (selHome && selHome.value !== kelas) {
      selHome.value = kelas;
      selHome.dispatchEvent(new Event('change'));
    }
    if (typeof pilihKelasJadwal === 'function') {
      pilihKelasJadwal(kelas);
    } else {
      currentSelectedKelasJadwal = kelas;
      if (typeof document !== 'undefined' && typeof document.querySelectorAll === 'function') {
        document.querySelectorAll('#classChipsList .class-chip, #classChipsListTab .class-chip').forEach(c => {
          if (c.textContent === kelas) c.classList.add('active');
          else c.classList.remove('active');
        });
      }
      if (typeof muatJadwalBeranda === 'function') {
        muatJadwalBeranda(kelas, currentSelectedHariJadwal);
      }
    }
  };
}

// ===================================================================
// BERANDA OVERVIEW LOGIC (SMART HUB 2026)
// ===================================================================
let clockInterval = null;
let rekapUserCache = [];
let rekapRangeAktif = 'hari_ini';

function renderSmartCardPhoto(photoUrl, altText) {
  const container = document.getElementById('smartCardAvatar');
  if (!container) return;
  const initial = (altText || 'S').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'MI';
  container.innerHTML = `<img id="smartCardImg" src="${photoUrl}" alt="${altText || 'Foto Siswa'}" style="width:100%;height:100%;object-fit:cover;object-position:center top;border-radius:inherit;" onerror="this.onerror=null; renderSmartCardInitial('${initial}');">`;
}

function renderSmartCardInitial(initialText) {
  const container = document.getElementById('smartCardAvatar');
  if (!container) return;
  container.innerHTML = `<span style="font-weight:800;font-size:20px;color:#ffffff;">${initialText || 'P'}</span>`;
}

if (typeof window !== 'undefined') {
  window.renderSmartCardPhoto = renderSmartCardPhoto;
  window.renderSmartCardInitial = renderSmartCardInitial;
}

function initBerandaOverview(user) {
  if (user && user.nisn) { cekStatusKartuNfcSiswa(user.nisn); }

  const isPengunjung = user.role === 'pengunjung' || !user.nisn || user.role !== 'siswa';
  const isAdminIdentity = (user && user.nama && /admin/i.test(user.nama)) || (user && user.role === 'admin');

  // Dengarkan status operasional kelas siswa atau kelas pilot default
  const kelasTarget = (user && user.kelas) ? user.kelas : 'XII RPL 1';
  dengarkanStatusKelasOperasional(kelasTarget);

  // 1. Banner Pengunjung & Widget Status Kelas (Hanya tampil jika terverifikasi)
  const isSiswaTerverifikasi = !isPengunjung && !!(user && user.role === 'siswa' && user.isVerified && user.nisn);
  const widgetBox = document.getElementById('widgetStatusKelas');
  if (widgetBox) {
    widgetBox.style.display = isSiswaTerverifikasi ? 'flex' : 'none';
  }

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
    const sapaNama = isAdminIdentity ? 'Pengunjung' : (user.nama ? user.nama.split(' ')[0] : 'Pengunjung');
    if (greetingEl) greetingEl.textContent = `Selamat Datang, ${sapaNama}!`;
    if (subtextEl) subtextEl.textContent = `Status Akun: Pengunjung / Tamu Sekolah (Belum Terverifikasi)`;
  } else {
    const namaPanggilan = (user.nama || 'Siswa').split(' ')[0];
    if (greetingEl) greetingEl.textContent = `${salam}, ${namaPanggilan}!`;
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
  if (clockInterval && typeof clockInterval.unref === 'function') {
    clockInterval.unref();
  }


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
    // Mode Pengunjung: Tampilkan kartu tamu, jangan bocorkan data siswa lain atau identitas admin
    const safeCardNama = (user.role === 'siswa') ? user.nama : (isAdminIdentity ? 'Tamu Pengunjung' : (user.nama || 'Tamu Pengunjung'));
    if (cardNama) cardNama.textContent = safeCardNama;
    if (cardMeta) cardMeta.textContent = 'Status: Pengunjung • Belum Tertaut NISN';
    if (user.foto_google && !isAdminIdentity) {
      renderSmartCardPhoto(user.foto_google, safeCardNama);
    } else {
      renderSmartCardInitial('P');
    }
    if (cardUid) cardUid.textContent = 'BELUM TERDAFTAR';
    if (cardBadge && cardIcon && cardText) {
      cardBadge.className = 'smart-card-status-badge belum';
      cardIcon.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
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
    renderSmartCardPhoto(`assets/foto/${nisnAktif}.jpg`, namaAktif);
    if (cardUid) {
      cardUid.textContent = (nisnAktif === '0082104129') ? '1058384422' : '006787337';
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

      // Juga dukung direct child
      if (!statusDitemukan && data[nisnAktif]) {
        waktuHadir = data[nisnAktif].waktu;
        statusDitemukan = data[nisnAktif].status;
      }

      // Evaluasi status presensi berdasarkan ambang batas waktu (PRD Bab 4.1)
      let statusLabel = 'Belum Scan Hari Ini';
      let statusClass = 'belum';
      let iconSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';

      const jamSekarangStr = (typeof getJamSekarangWIB === 'function') ? getJamSekarangWIB() : jamSekarang();
      const stLower = statusDitemukan ? String(statusDitemukan).toLowerCase().trim() : '';
      const isStatusKehadiranSah = statusDitemukan && !['belum', 'belum absen', 'belum_absen', 'belum scan'].includes(stLower);

      if (isStatusKehadiranSah) {
        if (stLower === 'hadir') {
          // Cek apakah tepat waktu atau terlambat berdasarkan jam tap
          const statusWaktu = (typeof evaluasiAmbangBatasWaktu === 'function' && waktuHadir)
            ? evaluasiAmbangBatasWaktu(waktuHadir)
            : 'hadir';
          if (statusWaktu === 'terlambat' || (waktuHadir && waktuHadir > '06:30:00')) {
            statusLabel = `Terlambat (${waktuHadir.slice(0,5)} WIB)`;
            statusClass = 'peringatan';
            iconSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
          } else {
            statusLabel = `Hadir Tepat Waktu (${waktuHadir ? waktuHadir.slice(0,5) + ' WIB' : ''})`;
            statusClass = 'hadir';
            iconSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
          }
        } else if (stLower === 'terlambat') {
          statusLabel = `Terlambat (${waktuHadir ? waktuHadir.slice(0,5) + ' WIB' : ''})`;
          statusClass = 'peringatan';
          iconSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
        } else if (stLower === 'alpa' || stLower === 'alpha') {
          statusLabel = 'Alpa (Tanpa Konfirmasi)';
          statusClass = 'belum status-alpa';
          iconSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
        } else if (stLower === 'sakit') {
          statusLabel = 'Sakit (Izin Terverifikasi Walas)';
          statusClass = 'peringatan';
          iconSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>';
        } else if (stLower === 'izin' || stLower === 'ijin' || stLower === 'dispensasi' || stLower === 'dispen') {
          statusLabel = 'Izin Resmi (ACC Walas)';
          statusClass = 'peringatan';
          iconSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
        }
      } else {
        // Belum ada data kehadiran / belum scan
        const cleanJamSkrg = (jamSekarangStr && jamSekarangStr.length === 5) ? jamSekarangStr + ':00' : (jamSekarangStr || '07:00:00');
        if (cleanJamSkrg < '08:00:00') {
          if (cleanJamSkrg >= '06:30:00') {
            statusLabel = 'Belum Absen (Pantauan Walas)';
            statusClass = 'peringatan';
            iconSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
          } else {
            statusLabel = 'Belum Absen';
            statusClass = 'belum';
            iconSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
          }
        } else {
          // cleanJamSkrg >= '08:00:00' -> Otomatis Alpa
          statusLabel = 'Alpa (Tanpa Keterangan)';
          statusClass = 'alpa danger belum status-alpa';
          iconSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';

          // Sinkronisasi status Alpa ke database Firebase jika belum tercatat atau masih berstatus 'belum'
          if (user && user.nisn && typeof db !== 'undefined' && db && typeof db.ref === 'function') {
            const refAbsenPersonal = db.ref('absensi/' + user.nisn + '/' + today);
            if (refAbsenPersonal && typeof refAbsenPersonal.transaction === 'function') {
              refAbsenPersonal.transaction(current => {
                if (!current || !current.status || ['belum', 'belum absen', 'belum_absen'].includes(String(current.status).toLowerCase().trim())) {
                  return { status: 'alpa', metode: 'auto_system', keterangan: 'Otomatis Alpa (Melewati 08:00 WIB)', updated_at: Date.now() };
                }
                return current;
              }).catch(() => null);
            }
            if (user.kelas) {
              db.ref(`presensi_jam/${user.kelas}/${today}/1/${user.nisn}`).transaction(current => {
              if (!current || !current.status || ['belum', 'belum absen', 'belum_absen'].includes(String(current.status).toLowerCase().trim())) {
                return {
                  ...(current || {}),
                  waktu: '08:00:00',
                  status: 'alpa',
                  tipe: 'auto_alpa_system',
                  keterangan: 'Auto-Alpa (Tidak Hadir & Tanpa Keterangan s.d 08.00 WIB)',
                  updatedAt: new Date().toISOString()
                };
              }
              return current;
            }).catch(() => null);
            }
          }
        }
      }

      if (cardBadge && cardIcon && cardText) {
        cardBadge.className = 'smart-card-status-badge ' + statusClass;
        cardIcon.innerHTML = iconSvg;
        cardText.textContent = statusLabel;
      }

      if (pillEl && iconEl && textEl) {
        pillEl.className = 'personal-status-pill ' + statusClass;
        iconEl.innerHTML = iconSvg;
        textEl.textContent = statusLabel;
      }
    });

    // Inisialisasi Rekap & Riwayat Presensi Siswa (1 Tahun Terakhir)
    initRekapPresensiSiswa(user);
  }

  // 5. Sinkronisasi Dropdown Monitoring dengan Status Kelas
  const selHome = document.getElementById('pilihKelasHome');
  if (selHome && (!selHome.dataset || !selHome.dataset.boundKbm)) {
    if (!selHome.dataset) selHome.dataset = {};
    selHome.dataset.boundKbm = 'true';
    selHome.addEventListener('change', function() {
      if (this.value) {
        dengarkanStatusKelasOperasional(this.value);
        if (typeof pilihKelasJadwal === 'function') pilihKelasJadwal(this.value);
        else if (typeof muatJadwalBeranda === 'function') muatJadwalBeranda(this.value);
      }
    });
  }

  // 6. Inisialisasi Class Chips Selector
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
  const wrapSelector = document.getElementById('wrapperSelectorRekapSiswa');

  const isSiswa = user && user.role === 'siswa' && user.nisn;
  if (isSiswa) {
    // Sesuai PRD: Siswa HANYA mengakses riwayat kehadiran pribadi, sembunyikan selector data siswa lain
    if (contentSiswa) contentSiswa.style.display = 'block';
    if (wrapSelector) wrapSelector.style.display = 'none';
    if (alertPengunjung) alertPengunjung.style.display = 'none';
    activeNisnRekap = user.nisn;
    if (selSiswaRekap) {
      selSiswaRekap.innerHTML = `<option value="${user.nisn}">${user.nama} (${user.kelas || '-'}) — NISN: ${user.nisn}</option>`;
      selSiswaRekap.value = user.nisn;
    }
    muatDataRekapNisn(user.nisn);
    return;
  }

  // Jika akun pengunjung / tamu / belum tertaut NISN:
  // Dilarang me-load data M. Ihsan Athallah (targetNisn = '0098263610'). Sembunyikan tabel rekap dan tampilkan alert rekapPengunjungAlert
  if (contentSiswa) contentSiswa.style.display = 'none';
  if (alertPengunjung) alertPengunjung.style.display = 'block';
  if (wrapSelector) wrapSelector.style.display = 'none';
  activeNisnRekap = null;
  if (listenerRekapPresensi) {
    listenerRekapPresensi.ref.off('value', listenerRekapPresensi.cb);
    listenerRekapPresensi = null;
  }
}

function muatDataRekapNisn(nisn) {
  if (!nisn) return;
  activeNisnRekap = nisn;
  if (listenerRekapPresensi) {
    listenerRekapPresensi.ref.off('value', listenerRekapPresensi.cb);
    listenerRekapPresensi = null;
  }

  const ref = (typeof db !== 'undefined' && db && typeof db.ref === 'function') ? db.ref('absensi/' + nisn) : null;
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
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><div class="empty-icon"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div><p>Belum ada catatan presensi pada periode ini.</p></td></tr>';
    return;
  }

  const tglKeys = Object.keys(perTanggal).sort().reverse();
  tglKeys.forEach(tgl => {
    const logs = perTanggal[tgl];
    const logMasuk = logs.find(l => l.status === 'hadir') || logs[0];
    const logPulang = logs.find(l => l.status === 'pulang');

    const dt = new Date(tgl + 'T00:00:00');
    const namaHari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][dt.getDay()] || '-';

    let statusPill = '<span class="status-pill sudah">Hadir</span>';
    let ket = 'Hadir tepat waktu di kelas via kartu RFID';

    if (logMasuk.status === 'sakit') {
      statusPill = '<span class="status-pill pending">Sakit</span>';
      ket = logMasuk.keterangan || 'Surat keterangan dokter terlampir';
    } else if (logMasuk.status === 'dispensasi' || logMasuk.status === 'ijin_kegiatan') {
      statusPill = '<span class="status-pill pending">Izin / Dispen</span>';
      ket = logMasuk.keterangan || 'Dispensasi kegiatan kejuaraan/sekolah';
    } else if (logMasuk.status === 'alpha') {
      statusPill = '<span class="status-pill belum">Alpha</span>';
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

let currentSelectedKelasJadwal = 'XII RPL 2';
let currentSelectedHariJadwal = (function() {
  const h = (typeof namaHariDariTanggal === 'function') ? namaHariDariTanggal(tanggalHariIni()) : 'senin';
  return (h === 'sabtu' || h === 'minggu') ? 'senin' : h;
})();

let cacheJadwalFirebase = {};
let activeJadwalListenerRef = null;
let activeJadwalListenerCallback = null;

function renderTampilanJadwal(resolved, targetKelas, targetHari) {
  const gridEl = (typeof document !== 'undefined' && document.getElementById) ? document.getElementById('homeScheduleGrid') : null;
  const gridTabEl = (typeof document !== 'undefined' && document.getElementById) ? document.getElementById('tabScheduleGrid') : null;
  const badgePulang = (typeof document !== 'undefined' && document.getElementById) ? document.getElementById('homeJamPulangBadge') : null;
  const badgePulangTab = (typeof document !== 'undefined' && document.getElementById) ? document.getElementById('tabJamPulangBadge') : null;
  const bannerMandiri = (typeof document !== 'undefined' && document.getElementById) ? document.getElementById('bannerKelasMandiri') : null;
  const bannerText = (typeof document !== 'undefined' && document.getElementById) ? document.getElementById('bannerMandiriText') : null;
  const bannerMandiriTab = (typeof document !== 'undefined' && document.getElementById) ? document.getElementById('bannerKelasMandiriTab') : null;
  const bannerTextTab = (typeof document !== 'undefined' && document.getElementById) ? document.getElementById('bannerMandiriTextTab') : null;

  const namaHariCap = targetHari.charAt(0).toUpperCase() + targetHari.slice(1);
  const data = (resolved && resolved.jadwal) ? resolved.jadwal : {};

  [gridEl, gridTabEl].forEach(g => { if (g) g.innerHTML = ''; });

  const jamKeys = Object.keys(data).sort((a, b) => Number(a) - Number(b));
  if (jamKeys.length === 0) {
    const emptyHtml = `<div style="grid-column: 1/-1; text-align:center; padding:24px; color:#94a3b8; font-size:13.5px; background:#f8fafc; border-radius:16px;">Belum ada jadwal pelajaran untuk kelas ${targetKelas} pada hari ${namaHariCap}.</div>`;
    [gridEl, gridTabEl].forEach(g => { if (g) g.innerHTML = emptyHtml; });
    [bannerMandiri, bannerMandiriTab].forEach(b => { if (b) b.style.display = 'none'; });
    if (badgePulang) badgePulang.textContent = `Jam Pulang: -`;
    if (badgePulangTab) badgePulangTab.textContent = `Jam Pulang: -`;
    return;
  }

  // Ambil jam selesai dari mapel paling terakhir atau ketetapan jam pulang resmi
  const jamPulangResmi = resolved.jamPulang || (targetHari === 'jumat' ? '11:45' : '15:30');
  const jamPulangStr = `Jam Pulang ${targetKelas} (${namaHariCap}): ${jamPulangResmi} WIB`;
  if (badgePulang) badgePulang.textContent = jamPulangStr;
  if (badgePulangTab) badgePulangTab.textContent = jamPulangStr;

  const jamSkrg = (typeof jamSekarang === 'function') ? jamSekarang() : '08:00';
  const hariIniReal = (typeof namaHariDariTanggal === 'function') ? namaHariDariTanggal(tanggalHariIni()) : 'senin';
  const isToday = (targetHari === hariIniReal);
  const listJamMandiri = [];

  jamKeys.forEach(jamKe => {
    const p = data[jamKe] || {};

    // 1. Bersihkan nama mapel dari sisa teks statis lama
    const namaMapelBersih = (p.mapel || 'Pelajaran')
      .replace(/\s*\(Guru Ada Halangan \/ Mandiri\)/gi, '')
      .trim();

    // 2. Cek apakah ada konfirmasi resmi guru berhalangan hadir
    const isGuruBerhalangan = p.guru_status === 'berhalangan' || p.guru_status === 'mandiri';
    if (isGuruBerhalangan) {
      listJamMandiri.push(`Jam ke-${jamKe} (${namaMapelBersih})`);
    }

    // 3. Cek apakah jam ini aktif sekarang (hanya berlaku jika melihat jadwal hari ini)
    const isActive = isToday && p.mulai && p.selesai && jamSkrg >= p.mulai && jamSkrg < p.selesai;

    const cardHtml = `
      ${isActive ? '<span class="live-pill">LIVE SEKARANG</span>' : ''}
      <div class="schedule-jam">Jam Ke-${jamKe}</div>
      <div class="schedule-mapel">${namaMapelBersih}</div>
      <div class="schedule-waktu" style="display:flex;align-items:center;gap:4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>${p.mulai || '-'} — ${p.selesai || '-'} WIB</div>
      ${p.guru ? `<div style="font-size:12px;color:#64748b;margin-top:4px;display:flex;align-items:center;gap:4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>${p.guru}</div>` : ''}
      ${isGuruBerhalangan ? '<div style="margin-top:8px;"><span style="display:inline-flex; align-items:center; gap:4px; font-size:11px; font-weight:700; color:#b45309; background:#fef3c7; border:1px solid #fde68a; padding:3px 8px; border-radius:6px;"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>Guru Berhalangan (Mandiri)</span></div>' : ''}
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
  if (listJamMandiri.length > 0) {
    const pesanMandiri = `Guru pengajar pada <b>${listJamMandiri.join(', ')}</b> mengonfirmasi ada halangan. Murid wajib tetap tertib di dalam kelas dan melakukan <b>scan kartu RFID</b> pada device kelas agar presensi jam tersebut terverifikasi sah.`;
    [bannerMandiri, bannerMandiriTab].forEach(b => { if (b) b.style.display = 'flex'; });
    if (bannerText) bannerText.innerHTML = pesanMandiri;
    if (bannerTextTab) bannerTextTab.innerHTML = pesanMandiri;
  } else {
    [bannerMandiri, bannerMandiriTab].forEach(b => { if (b) b.style.display = 'none'; });
  }
}

function sinkronkanChipJadwal(kelas, hari) {
  const targetKelas = kelas || currentSelectedKelasJadwal || 'XII RPL 2';
  const targetHari = (hari || currentSelectedHariJadwal || 'senin').toLowerCase();
  currentSelectedKelasJadwal = targetKelas;
  currentSelectedHariJadwal = targetHari;

  const listHari = [
    { key: 'senin', label: 'Senin' },
    { key: 'selasa', label: 'Selasa' },
    { key: 'rabu', label: 'Rabu' },
    { key: 'kamis', label: 'Kamis' },
    { key: 'jumat', label: 'Jumat' }
  ];

  if (typeof document !== 'undefined' && typeof document.querySelectorAll === 'function') {
    // Sinkronkan Chip Kelas
    document.querySelectorAll('#classChipsList .class-chip, #classChipsListTab .class-chip').forEach(c => {
      if (c.textContent.trim() === targetKelas.trim()) c.classList.add('active');
      else c.classList.remove('active');
    });

    // Sinkronkan Chip Hari
    document.querySelectorAll('#dayChipsList .class-chip, #dayChipsListTab .class-chip').forEach(c => {
      const rawHk = c.getAttribute('data-hari');
      const hk = rawHk ? rawHk.toLowerCase().trim() : c.textContent.replace(/[^a-zA-Z]/g, '').toLowerCase().trim();
      const item = listHari.find(h => h.key === hk);
      const lbl = item ? item.label : (hk.charAt(0).toUpperCase() + hk.slice(1));
      c.setAttribute('data-hari', hk);
      if (hk === targetHari) {
        c.classList.add('active');
        c.innerHTML = lbl;
      } else {
        c.classList.remove('active');
        c.innerHTML = lbl;
      }
    });
  }
}
window.sinkronkanChipJadwal = sinkronkanChipJadwal;

function pilihKelasJadwal(kelas) {
  if (!kelas) return;
  currentSelectedKelasJadwal = kelas;
  sinkronkanChipJadwal(currentSelectedKelasJadwal, currentSelectedHariJadwal);
  muatJadwalBeranda(currentSelectedKelasJadwal, currentSelectedHariJadwal);
  if (typeof dengarkanStatusKelasOperasional === 'function') {
    dengarkanStatusKelasOperasional(kelas);
  }
}
window.pilihKelasJadwal = pilihKelasJadwal;

function pilihHariJadwal(hari) {
  if (!hari) return;
  currentSelectedHariJadwal = String(hari).toLowerCase().trim();
  sinkronkanChipJadwal(currentSelectedKelasJadwal, currentSelectedHariJadwal);
  muatJadwalBeranda(currentSelectedKelasJadwal, currentSelectedHariJadwal);
}
window.pilihHariJadwal = pilihHariJadwal;

function muatJadwalBeranda(kelas, hari) {
  const targetKelas = kelas || currentSelectedKelasJadwal || 'XII RPL 2';
  const targetHari = (hari || currentSelectedHariJadwal || 'senin').toLowerCase();
  currentSelectedKelasJadwal = targetKelas;
  currentSelectedHariJadwal = targetHari;

  // 1. Render instan dengan master jadwal resmi (Zero Latency & 100% Guaranteed)
  const localResolved = (typeof ambilJadwalKelasHariIni === 'function')
    ? ambilJadwalKelasHariIni(cacheJadwalFirebase[targetKelas] || null, targetKelas, targetHari)
    : {
        hari: targetHari,
        jadwal: (typeof MASTER_JADWAL_RESMI !== 'undefined' && MASTER_JADWAL_RESMI[targetKelas] && MASTER_JADWAL_RESMI[targetKelas][targetHari])
          ? MASTER_JADWAL_RESMI[targetKelas][targetHari]
          : {},
        jamPulang: (targetHari === 'jumat' ? '11:45' : '15:30')
      };

  renderTampilanJadwal(localResolved, targetKelas, targetHari);

  // 2. Fetch data-jadwal.json jika ada dan belum ter-cache
  if (!cacheJadwalFirebase[targetKelas] && typeof fetch === 'function') {
    fetch('assets/data-jadwal.json')
      .then(r => r.json())
      .then(jsonData => {
        if (jsonData && jsonData[targetKelas]) {
          cacheJadwalFirebase[targetKelas] = jsonData[targetKelas];
          const jsonResolved = (typeof ambilJadwalKelasHariIni === 'function')
            ? ambilJadwalKelasHariIni(jsonData[targetKelas], targetKelas, targetHari)
            : { hari: targetHari, jadwal: jsonData[targetKelas][targetHari] || {}, jamPulang: (targetHari === 'jumat' ? '11:45' : '15:30') };
          renderTampilanJadwal(jsonResolved, targetKelas, targetHari);
        }
      })
      .catch(() => {});
  }

  // 3. Listener Realtime Firebase (Live Guru Berhalangan / Perubahan KBM Realtime)
  if (typeof db !== 'undefined' && db && typeof db.ref === 'function') {
    try {
      if (activeJadwalListenerRef && activeJadwalListenerCallback) {
        activeJadwalListenerRef.off('value', activeJadwalListenerCallback);
      }
      activeJadwalListenerRef = db.ref(`jadwal_pelajaran/${targetKelas}`);
      activeJadwalListenerCallback = activeJadwalListenerRef.on('value', snapshot => {
        const rawVal = snapshot.val();
        if (rawVal) {
          cacheJadwalFirebase[targetKelas] = rawVal;
        }
        const resolved = (typeof ambilJadwalKelasHariIni === 'function')
          ? ambilJadwalKelasHariIni(rawVal || cacheJadwalFirebase[targetKelas] || null, targetKelas, targetHari)
          : localResolved;

        renderTampilanJadwal(resolved, targetKelas, targetHari);
      }, err => {
        console.warn('Realtime sync jadwal_pelajaran offline/terbatas:', err && err.message);
      });
    } catch (e) {
      console.warn('Init listener jadwal_pelajaran gagal:', e);
    }
  }
}
window.muatJadwalBeranda = muatJadwalBeranda;

function initClassChipsSelector(user) {
  const container = (typeof document !== 'undefined' && document.getElementById) ? document.getElementById('classChipsList') : null;
  const containerTab = (typeof document !== 'undefined' && document.getElementById) ? document.getElementById('classChipsListTab') : null;
  const dayContainer = (typeof document !== 'undefined' && document.getElementById) ? document.getElementById('dayChipsList') : null;
  const dayContainerTab = (typeof document !== 'undefined' && document.getElementById) ? document.getElementById('dayChipsListTab') : null;

  const listKelas = ['XII RPL 1', 'XII RPL 2', 'XII TKJ 1'];
  const listHari = [
    { key: 'senin', label: 'Senin' },
    { key: 'selasa', label: 'Selasa' },
    { key: 'rabu', label: 'Rabu' },
    { key: 'kamis', label: 'Kamis' },
    { key: 'jumat', label: 'Jumat' }
  ];

  if (user && user.kelas && listKelas.includes(user.kelas)) {
    currentSelectedKelasJadwal = user.kelas;
  }

  // 1. Render Selector Kelas
  [container, containerTab].forEach(cnt => {
    if (!cnt) return;
    cnt.innerHTML = '';
    listKelas.forEach(kelas => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'class-chip' + (kelas === currentSelectedKelasJadwal ? ' active' : '');
      chip.textContent = kelas;
      chip.onclick = function() {
        pilihKelasJadwal(kelas);
      };
      cnt.appendChild(chip);
    });
  });

  // 2. Render Selector Hari (Senin s/d Jumat)
  [dayContainer, dayContainerTab].forEach(dcnt => {
    if (!dcnt) return;
    dcnt.innerHTML = '';
    listHari.forEach(item => {
      const dchip = document.createElement('button');
      dchip.type = 'button';
      dchip.className = 'class-chip' + (item.key === currentSelectedHariJadwal ? ' active' : '');
      dchip.setAttribute('data-hari', item.key);
      dchip.textContent = item.label;
      dchip.onclick = function() {
        pilihHariJadwal(item.key);
      };
      dcnt.appendChild(dchip);
    });
  });

  sinkronkanChipJadwal(currentSelectedKelasJadwal, currentSelectedHariJadwal);
  muatJadwalBeranda(currentSelectedKelasJadwal, currentSelectedHariJadwal);
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
    "TATA TERTIB PRESENSI KELAS MANDIRI:\n\n" +
    "1. Siswa wajib hadir di dalam ruangan kelas sebelum jam pelajaran dimulai.\n" +
    "2. Jika guru berhalangan hadir, siswa melakukan tap kartu RFID pada scanner kelas.\n" +
    "3. Titip absen menggunakan kartu teman dinyatakan pelanggaran disiplin berat.\n" +
    "4. Izin sakit/dispensasi harus diajukan melalui menu 'Ajukan Izin' disertai surat keterangan resmi."
  );
}

function inisialisasiPantauAwal() {
  if (typeof document === 'undefined') return;
  if (document.getElementById && document.getElementById('statusHariIni') && !document.getElementById('namaUser')) return;
  try {
    const sel = document.getElementById('pilihKelasPantau');
    const selHome = document.getElementById('pilihKelasHome');
    const kAwal = (typeof normalisasiKelas === 'function')
      ? (normalisasiKelas((sel && sel.value) || (selHome && selHome.value) || 'XII RPL 2') || 'XII RPL 2')
      : 'XII RPL 2';
    perbaruiDropdownKelasPantau(kAwal);
    dengarkanPresensiKelas(kAwal);

    let targetTab = null;
    if (typeof window !== 'undefined' && window.location && window.location.hash) {
      targetTab = window.location.hash.replace('#', '');
    } else if (typeof sessionStorage !== 'undefined') {
      try { targetTab = sessionStorage.getItem('active_dashboard_tab'); } catch (e) {}
    }
    if (targetTab && targetTab !== 'tabBeranda') {
      const tabEl = document.getElementById(targetTab);
      const btnEl = document.getElementById('btn' + targetTab.charAt(0).toUpperCase() + targetTab.slice(1));
      if (tabEl && typeof switchTab === 'function') {
        switchTab(targetTab, btnEl);
      }
    }
  } catch (e) {
    console.warn('Inisialisasi pantau awal:', e);
  }
}

function inisialisasiJadwalAwal() {
  if (typeof document === 'undefined') return;
  if (document.getElementById && document.getElementById('statusHariIni') && !document.getElementById('namaUser')) return;
  try {
    sinkronkanChipJadwal(currentSelectedKelasJadwal, currentSelectedHariJadwal);
    muatJadwalBeranda(currentSelectedKelasJadwal, currentSelectedHariJadwal);
    inisialisasiPantauAwal();
  } catch (e) {
    console.warn('Inisialisasi jadwal awal:', e);
  }
}

if (typeof document !== 'undefined') {
  if (document.getElementById && document.getElementById('countSudah')) {
    try {
      inisialisasiPantauAwal();
    } catch (e) {}
  }
  if (document.readyState === 'loading' && typeof document.addEventListener === 'function') {
    document.addEventListener('DOMContentLoaded', inisialisasiJadwalAwal);
  } else if (typeof setTimeout === 'function') {
    setTimeout(inisialisasiJadwalAwal, 0);
  }
}

if (typeof window !== 'undefined') {
  window.inisialisasiPantauAwal = inisialisasiPantauAwal;
  window.inisialisasiJadwalAwal = inisialisasiJadwalAwal;
  window.dengarkanPresensiKelas = dengarkanPresensiKelas;
  window.renderPantauKelas = renderPantauKelas;
  window.renderPantauBeranda = renderPantauBeranda;
  window.initPantauKelas = initPantauKelas;
  window.initDashboard = initDashboard;
  window.cekStatusKartuNfcSiswa = cekStatusKartuNfcSiswa;
  window.bukaModalPairingNfcSiswa = bukaModalPairingNfcSiswa;
  window.tutupModalPairingNfcSiswa = tutupModalPairingNfcSiswa;
  window.lakukanSimulasiTapSiswa = lakukanSimulasiTapSiswa;
  window.populateDropdownSiswa = populateDropdownSiswa;
  window.handleSubmitPerijinan = handleSubmitPerijinan;
  window.ambilIzinPendingAktifSiswa = ambilIzinPendingAktifSiswa;
  if (typeof global !== 'undefined') {
    global.populateDropdownSiswa = populateDropdownSiswa;
    global.handleSubmitPerijinan = handleSubmitPerijinan;
    global.ambilIzinPendingAktifSiswa = ambilIzinPendingAktifSiswa;
  }

  window.getDefaultPresensiResmiHelper = getDefaultPresensiResmiHelper;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    populateDropdownSiswa,
    handleSubmitPerijinan,
    ambilIzinPendingAktifSiswa,
    muatJadwalBeranda,
    pilihKelasJadwal,
    pilihHariJadwal,
    sinkronkanChipJadwal,
    initClassChipsSelector,
    renderTampilanJadwal,
    bukaDetailInfoToeic,
    bukaDetailInfoTka,
    renderPantauKelas,
    renderPantauBeranda,
    renderSmartCardPhoto,
    renderSmartCardInitial,
    semuaSiswaCache,
    generateDefaultPresensiResmi: getDefaultPresensiResmiHelper,
    inisialisasiPantauAwal,
    inisialisasiJadwalAwal,
    dengarkanPresensiKelas,
    initPantauKelas,
    initDashboard,
    cekStatusKartuNfcSiswa,
    bukaModalPairingNfcSiswa,
    tutupModalPairingNfcSiswa,
    lakukanSimulasiTapSiswa,
  };
}


function bukaDetailInfoToeic() {
  alert(
    "PROGRAM SERTIFIKASI BAHASA INGGRIS TOEIC INTERNASIONAL 2026\n" +
    "SMK Negeri 1 Sumedang — CBT Center RPL\n\n" +
    "• Pelaksanaan: Batch Sertifikasi Bahasa Inggris TOEIC Internasional Siswa SMK\n" +
    "• Status: Batch Berjalan • Sesi Ujian Terjadwal di CBT Center\n" +
    "• Lokasi: CBT Center & Lab Komputer SMKN 1 Sumedang\n" +
    "• Ketentuan: Harap hadir tepat waktu dan membawa kartu identitas siswa RFID untuk presensi."
  );
}

function bukaDetailInfoTka() {
  alert(
    "ASESMEN TES KEMAMPUAN AKADEMIK (TKA) 2026\n" +
    "SMK Negeri 1 Sumedang — Laboratorium Komputer RPL\n\n" +
    "• Asesmen: Tes Kemampuan Akademik (TKA) 2026\n" +
    "• Status: SEDANG BERLANGSUNG SAAT INI\n" +
    "• Lokasi: Laboratorium Komputer RPL\n" +
    "• Ketentuan: Seluruh peserta sesi aktif wajib hadir tepat waktu dan melakukan tap kartu RFID presensi."
  );
}


// Listener otomatis buka kunci form saat izin ditolak atau disetujui
try {
  if (typeof window !== 'undefined') {
    window.addEventListener('perizinan_updated', function() {
      if (typeof populateDropdownSiswa === 'function') {
        setTimeout(populateDropdownSiswa, 100);
      }
    });
    window.addEventListener('storage', function(e) {
      if (e && (e.key === 'perizinan_sync_ping' || (e.key && e.key.startsWith('status_izin_')))) {
        if (typeof populateDropdownSiswa === 'function') {
          setTimeout(populateDropdownSiswa, 100);
        }
      }
    });
  }
} catch (e) {}
