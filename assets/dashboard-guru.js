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

firebase.auth().onAuthStateChanged(async function(fbUser) {
  if (!fbUser) {
    window.location.href = 'index.html';
    return;
  }
  const user = await prosesLoginUser(fbUser);
  if (user.role !== 'guru' && user.role !== 'walas' && user.role !== 'admin') {
    alert('Akses Terbatas: Halaman ini khusus Bapak/Ibu Guru dan Wali Kelas.');
    window.location.href = 'dashboard.html';
    return;
  }
  guruAktif = user;
  initPortalGuru(guruAktif);
});

function switchGuruTab(id, btn) {
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
}

async function initPortalGuru(user) {
  const isWalas = user.role === 'walas' || user.isWalas;
  const walasKelas = user.walasKelasId || 'XII RPL 2';

  // Update Header
  document.getElementById('namaUser').textContent = user.nama || 'Guru Pengajar';
  const roleBadge = document.querySelector('.badge-role-guru');
  if (roleBadge) {
    if (isWalas) {
      roleBadge.textContent = 'WALI KELAS ' + walasKelas;
      roleBadge.style.background = '#dcfce7';
      roleBadge.style.color = '#15803d';
    } else {
      roleBadge.textContent = 'GURU PENGAJAR';
    }
  }

  document.getElementById('infoSubUser').textContent =
    `NIP: ${user.nip || '-'} • Mapel: ${user.mapel || 'Pengajar'} • ${isWalas ? 'Binaan: ' + walasKelas : 'Guru Mata Pelajaran'}`;

  document.getElementById('labelTanggalHariIni').textContent = tanggalHariIni();
  const labelTglGuru = document.getElementById('labelTglAbsenGuru');
  if (labelTglGuru) labelTglGuru.textContent = tanggalHariIni();
  document.getElementById('rekapTanggal').value = tanggalHariIni();

  const kendalaTgl = document.getElementById('kendalaTanggal');
  if (kendalaTgl) kendalaTgl.value = tanggalHariIni();

  const selWalas = document.getElementById('selectKelasWalasPilihan');
  if (selWalas && isWalas) selWalas.value = walasKelas;

  // Sesuaikan tab awal
  if (isWalas) {
    const btnWalas = document.getElementById('btnTabMonitoringWalas');
    if (btnWalas) switchGuruTab('tabMonitoringWalas', btnWalas);
  } else {
    const btnAbsen = document.getElementById('btnTabAbsenGuru');
    if (btnAbsen) switchGuruTab('tabAbsenGuru', btnAbsen);
  }

  // Muat status presensi dinas guru mandiri
  await muatStatusAbsenGuruHariIni();
  muatRiwayatAbsenGuru();

  // Muat daftar kelas
  await muatDaftarKelas();

  // Dengarkan perizinan realtime
  initListenerPerizinan();

  // Muat fitur Walas & Kendala
  muatStatistikWalas();
  muatLiveAlertWalas();
  muatRiwayatKendalaGuru();
}

// ===== FITUR 1: PRESENSI DINAS GURU MANDIRI =====
function getGuruKey() {
  if (guruAktif.uid) return guruAktif.uid;
  return guruAktif.email.replace(/\./g, ',').replace(/@/g, '(at)');
}

async function muatStatusAbsenGuruHariIni() {
  const today = tanggalHariIni();
  const key = getGuruKey();
  const snap = await db.ref(`presensi_guru/${today}/${key}`).once('value');
  const data = snap.val();

  const elMasuk = document.getElementById('guruJamMasuk');
  const elStatusMasuk = document.getElementById('guruStatusMasuk');
  const elPulang = document.getElementById('guruJamPulang');
  const elStatusPulang = document.getElementById('guruStatusPulang');
  const elHarian = document.getElementById('guruStatusHarian');
  const elKet = document.getElementById('guruKeteranganDinas');

  if (data) {
    if (data.waktu_masuk) {
      elMasuk.textContent = data.waktu_masuk + ' WIB';
      elStatusMasuk.textContent = '✓ Sudah Check-In';
      document.getElementById('btnCheckInGuru').disabled = true;
      document.getElementById('btnCheckInGuru').style.opacity = '0.6';
    }
    if (data.waktu_pulang) {
      elPulang.textContent = data.waktu_pulang + ' WIB';
      elStatusPulang.textContent = '✓ Sudah Check-Out';
      document.getElementById('btnCheckOutGuru').disabled = true;
      document.getElementById('btnCheckOutGuru').style.opacity = '0.6';
    }
    elHarian.textContent = data.status ? data.status.toUpperCase() : 'HADIR';
    elKet.textContent = data.catatan || (data.waktu_masuk ? 'Hadir dinas mengajar di sekolah' : '-');
  } else {
    elMasuk.textContent = '--:--:--';
    elStatusMasuk.textContent = 'Belum Absen Masuk';
    elPulang.textContent = '--:--:--';
    elStatusPulang.textContent = 'Belum Absen Pulang';
    elHarian.textContent = 'Belum Hadir';
    elKet.textContent = 'Silakan lakukan Check-In masuk dinas';
  }
}

async function catatAbsenGuru(tipe) {
  const today = tanggalHariIni();
  const now = jamSekarang();
  const key = getGuruKey();
  const refAbsen = db.ref(`presensi_guru/${today}/${key}`);
  const snap = await refAbsen.once('value');
  const existing = snap.val() || {};

  const msg = document.getElementById('msgAbsenGuru');
  msg.style.display = 'block';

  if (tipe === 'masuk') {
    if (existing.waktu_masuk) {
      msg.style.color = '#f59e0b';
      msg.textContent = '⚠️ Anda sudah melakukan Check-In masuk hari ini.';
      return;
    }
    existing.waktu_masuk = now;
    existing.status = 'hadir';
    existing.nama = guruAktif.nama;
    existing.nip = guruAktif.nip || '-';
    existing.email = guruAktif.email;
    existing.tanggal = today;
    existing.catatan = 'Hadir mengajar di sekolah';
    await refAbsen.set(existing);

    msg.style.color = '#10b981';
    msg.textContent = `✅ Berhasil Check-In Masuk pada ${now} WIB. Selamat mengajar!`;
  } else if (tipe === 'pulang') {
    if (!existing.waktu_masuk) {
      if (!confirm('Anda belum melakukan Check-In masuk. Tetap lanjutkan Check-Out pulang?')) return;
    }
    existing.waktu_pulang = now;
    existing.status = existing.status || 'hadir';
    existing.nama = guruAktif.nama;
    existing.nip = guruAktif.nip || '-';
    existing.email = guruAktif.email;
    existing.tanggal = today;
    await refAbsen.set(existing);

    msg.style.color = '#3b82f6';
    msg.textContent = `✅ Berhasil Check-Out Pulang pada ${now} WIB. Terima kasih atas dedikasi Anda!`;
  }

  await muatStatusAbsenGuruHariIni();
  muatRiwayatAbsenGuru();
}

async function catatIzinDinasGuru() {
  const keterangan = prompt('Masukkan keterangan Tugas Luar / Izin Dinas:', 'Dinas Pelatihan Kurikulum / MGMP');
  if (!keterangan) return;

  const today = tanggalHariIni();
  const key = getGuruKey();
  const now = jamSekarang();
  const refAbsen = db.ref(`presensi_guru/${today}/${key}`);

  await refAbsen.set({
    waktu_masuk: now,
    waktu_pulang: now,
    status: 'izin_dinas',
    nama: guruAktif.nama,
    nip: guruAktif.nip || '-',
    email: guruAktif.email,
    tanggal: today,
    catatan: keterangan
  });

  const msg = document.getElementById('msgAbsenGuru');
  msg.style.display = 'block';
  msg.style.color = '#f59e0b';
  msg.textContent = `📋 Status Dinas Guru dicatat: "${keterangan}"`;

  await muatStatusAbsenGuruHariIni();
  muatRiwayatAbsenGuru();
}

async function muatRiwayatAbsenGuru() {
  const key = getGuruKey();
  const tbody = document.getElementById('bodyRiwayatAbsenGuru');
  if (!tbody) return;

  const snap = await db.ref('presensi_guru').limitToLast(14).once('value');
  const allData = snap.val() || {};

  const myHistory = [];
  Object.entries(allData).forEach(([tgl, guruList]) => {
    if (guruList && guruList[key]) {
      myHistory.push({ tgl, ...guruList[key] });
    }
  });

  myHistory.sort((a,b) => b.tgl.localeCompare(a.tgl));

  tbody.innerHTML = '';
  if (myHistory.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:18px;color:#94a3b8;">Belum ada riwayat presensi.</td></tr>';
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

  currentKelas = selLive ? selLive.value : (listKelas[0] || 'XII RPL 2');
  muatDataPresensiKelas();
}

async function muatDataPresensiKelas() {
  currentKelas = document.getElementById('pilihKelasGuru').value;
  const today = tanggalHariIni();
  const grid = document.getElementById('gridSiswaGuru');
  grid.innerHTML = '<div style="color:#64748b;font-size:14px;padding:20px 0;">Memuat data kehadiran kelas...</div>';

  // 1. Ambil jadwal pelajaran untuk mencari jam ke aktif
  let jamKeAktif = 1;
  let mapelAktif = 'Jam Bebas / Istirahat';
  try {
    const snapJadwal = await db.ref('jadwal_pelajaran/' + currentKelas).once('value');
    const jadwalKelas = snapJadwal.val();
    if (typeof cariJamKeAktif === 'function' && jadwalKelas) {
      const aktif = cariJamKeAktif(jadwalKelas, jamSekarang());
      if (aktif) {
        jamKeAktif = aktif.jamKe;
        mapelAktif = aktif.mapel;
        document.getElementById('jamGuruTitle').textContent = `🕒 Jam Ke-${jamKeAktif}: ${mapelAktif} (${aktif.mulai} - ${aktif.selesai})`;
        document.getElementById('jamGuruSub').textContent = `Kelas ${currentKelas} sedang berlangsung. Memantau kehadiran aktif.`;
      } else {
        document.getElementById('jamGuruTitle').textContent = `🕒 Di Luar Jam Pelajaran Terjadwal`;
        document.getElementById('jamGuruSub').textContent = `Kelas ${currentKelas}: Menampilkan rekapan presensi hari ini.`;
      }
    }
  } catch (e) {
    console.warn('Jadwal util error:', e);
  }

  // 2. Ambil data siswa di kelas ini
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
  const siswaKelas = Object.entries(semuaSiswa).filter(([nisn, s]) => (typeof normalisasiKelas === 'function' ? normalisasiKelas(s.kelas) : s.kelas) === (typeof normalisasiKelas === 'function' ? normalisasiKelas(currentKelas) : currentKelas));

  // 3. Ambil data presensi jam berjalan
  const snapPresensi = await db.ref(`presensi_jam/${currentKelas}/${today}/${jamKeAktif}`).once('value');
  const presensiHariIni = snapPresensi.val() || {};

  // 4. Ambil perizinan disetujui untuk hari ini
  const dataIzin = await ambilSemuaPerizinanOnce();
  const izinHariIni = {};
  Object.values(dataIzin).forEach(iz => {
    const k = (typeof normalisasiKelas === 'function') ? normalisasiKelas(iz.kelas) : iz.kelas;
    if (k === currentKelas && iz.tanggal === today && iz.status === 'disetujui') {
      izinHariIni[iz.nisn] = iz;
    }
  });

  let totalHadir = 0;
  let totalIzin = 0;
  let totalBelum = 0;

  grid.innerHTML = '';
  if (siswaKelas.length === 0) {
    grid.innerHTML = '<div style="color:#64748b;padding:20px;">Tidak ada data siswa untuk kelas ini.</div>';
    return;
  }

  const snapKartu = await db.ref('kartu').once('value');
  const dataKartu = snapKartu.val() || {};
  const kartuNisnGuruSet = new Set();
  Object.values(dataKartu).forEach(v => {
    if (v && typeof v === 'object' && v.nisn) kartuNisnGuruSet.add(String(v.nisn));
    else if (typeof v === 'string') kartuNisnGuruSet.add(v);
  });

  siswaKelas.sort((a,b) => a[1].nama.localeCompare(b[1].nama)).forEach(([nisn, s]) => {
    const card = document.createElement('div');
    const absen = presensiHariIni[nisn];
    const izin = izinHariIni[nisn];
    const punyaKartu = kartuNisnGuruSet.has(nisn);

    if (absen && absen.status === 'hadir') {
      totalHadir++;
      card.className = 'card-siswa-guru hadir';
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <div>
            <div style="font-weight:800;font-size:15px;color:#0f172a;">${s.nama}</div>
            <div style="font-size:12px;color:#64748b;margin-top:2px;">NISN: ${nisn}</div>
          </div>
          <span style="background:#10b981;color:#fff;font-size:11px;font-weight:700;padding:3px 8px;border-radius:6px;">✓ HADIR</span>
        </div>
        <div style="font-size:12px;color:#059669;font-weight:600;margin-top:10px;">
          ⏱️ Scan: ${absen.waktu || '-'} ${absen.tipe === 'manual_guru' ? '(Manual Guru)' : '(Tap NFC)'}
        </div>
      `;
    } else if (izin) {
      totalIzin++;
      card.className = 'card-siswa-guru izin-sakit';
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <div>
            <div style="font-weight:800;font-size:15px;color:#0f172a;">${s.nama}</div>
            <div style="font-size:12px;color:#64748b;margin-top:2px;">NISN: ${nisn}</div>
          </div>
          <span style="background:#f59e0b;color:#fff;font-size:11px;font-weight:700;padding:3px 8px;border-radius:6px;text-transform:uppercase;">${izin.jenis}</span>
        </div>
        <div style="font-size:12px;color:#d97706;font-weight:600;margin-top:10px;">
          📝 Izin Disetujui: "${izin.alasan}"
        </div>
      `;
    } else if (!punyaKartu) {
      totalHadir++;
      card.className = 'card-siswa-guru hadir';
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <div>
            <div style="font-weight:800;font-size:15px;color:#0f172a;">${s.nama}</div>
            <div style="font-size:12px;color:#64748b;margin-top:2px;">NISN: ${nisn}</div>
          </div>
          <span style="background:#10b981;color:#fff;font-size:11px;font-weight:700;padding:3px 8px;border-radius:6px;">✓ HADIR</span>
        </div>
        <div style="font-size:12px;color:#059669;font-weight:600;margin-top:10px;">
          ✓ Hadir Otomatis (Tanpa Kartu RFID)
        </div>
      `;
    } else {
      totalBelum++;
      card.className = 'card-siswa-guru belum';
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <div>
            <div style="font-weight:800;font-size:15px;color:#0f172a;">${s.nama}</div>
            <div style="font-size:12px;color:#64748b;margin-top:2px;">NISN: ${nisn}</div>
          </div>
          <span style="background:#ef4444;color:#fff;font-size:11px;font-weight:700;padding:3px 8px;border-radius:6px;">BELUM SCAN</span>
        </div>
        <div style="display:flex;gap:6px;margin-top:12px;">
          <button onclick="hadirkanManual('${nisn}', '${s.nama}', ${jamKeAktif})" class="btn-mini-action btn-mini-hadir" title="Hadirkan Manual jika siswa lupa kartu">✓ Hadir Manual</button>
          <button onclick="beriIzinCepat('${nisn}', '${s.nama}')" class="btn-mini-action btn-mini-izin" title="Beri Izin">📝 Izin/Sakit</button>
        </div>
      `;
    }

    grid.appendChild(card);
  });

  document.getElementById('statHadirGuru').textContent = totalHadir;
  document.getElementById('statIzinGuru').textContent = totalIzin;
  document.getElementById('statBelumGuru').textContent = totalBelum;
}

// Tindakan Manual Guru
async function hadirkanManual(nisn, namaSiswa, jamKe) {
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
  const pendingCount = items.filter(i => i.status === 'pending').length;

  if (pendingCount > 0) {
    badgeCounter.style.display = 'inline-block';
    badgeCounter.textContent = pendingCount;
  } else {
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
    card.innerHTML = `
      <div class="card-izin-header">
        <div>
          <div style="font-size:16px;font-weight:800;color:#0f172a;">${iz.nama_siswa || iz.nama || 'Siswa'} (${iz.kelas || '-'})</div>
          <div style="font-size:13px;color:#64748b;margin-top:2px;">NISN: ${iz.nisn || '-'} • Tanggal Izin: <strong>${iz.tanggal}</strong></div>
        </div>
        <span class="status-tag ${iz.status}">${iz.status}</span>
      </div>

      <div style="background:#f8fafc;padding:12px 14px;border-radius:12px;margin-bottom:12px;font-size:13.5px;color:#334155;">
        <div><strong>Jenis:</strong> ${iz.jenis ? iz.jenis.toUpperCase() : 'IZIN'}</div>
        <div style="margin-top:4px;"><strong>Alasan:</strong> "${iz.alasan}"</div>
        ${iz.catatan_guru ? `<div style="margin-top:4px;color:#4f46e5;"><strong>Catatan Guru:</strong> "${iz.catatan_guru}" (Oleh: ${iz.diverifikasi_oleh || 'Guru'})</div>` : ''}
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
        <div style="display:flex;gap:8px;align-items:center;">
          ${fotoUrl ? `<button onclick="bukaModalBukti('${fotoUrl}', '${iz.nama_siswa || iz.nama}')" class="btn-mini-action" style="background:#e0e7ff;color:#4338ca;">🔍 Lampiran Foto / Surat</button>` : '<span style="font-size:12.5px;color:#94a3b8;">Tanpa lampiran file</span>'}
          <button onclick="if(typeof bukaModalChat==='function') bukaModalChat('${iz.id || iz.pid}', '${iz.nama_siswa || iz.nama}')" class="btn-mini-action" style="background:#f3e8ff;color:#7c3aed;border:1px solid #ddd6fe;">💬 Chat Siswa</button>
        </div>

        ${iz.status === 'pending' ? `
          <div style="display:flex;gap:8px;">
            <button onclick="prosesApprovalIzin('${iz.id || iz.pid}', 'ditolak')" class="btn-mini-action" style="background:#ef4444;color:#fff;">✗ Tolak</button>
            <button onclick="prosesApprovalIzin('${iz.id || iz.pid}', 'disetujui')" class="btn-mini-action btn-mini-hadir">✓ Setujui Izin</button>
          </div>
        ` : `
          <span style="font-size:12px;color:#64748b;">Diverifikasi oleh: <strong>${iz.diverifikasi_oleh || '-'}</strong></span>
        `}
      </div>
    `;
    container.appendChild(card);
  });
}

async function prosesApprovalIzin(idIzin, statusBaru) {
  const iz = allPerizinanData[idIzin] || {};
  const catatan = prompt(`Masukkan catatan guru untuk verifikasi (${statusBaru}):`, statusBaru === 'disetujui' ? 'Disetujui. Cepat sembuh.' : 'Bukti kurang lengkap.');
  if (catatan === null) return;

  const updatePayload = {
    status: statusBaru,
    diverifikasi_oleh: guruAktif ? guruAktif.nama : 'Wali Kelas',
    catatan_guru: catatan,
    updated_at: new Date().toISOString()
  };

  await Promise.all([
    db.ref(`perijinan/${idIzin}`).update(updatePayload).catch(() => null),
    db.ref(`perizinan/${idIzin}`).update(updatePayload).catch(() => null)
  ]);

  if (typeof kirimChatPerijinan === 'function' && guruAktif) {
    const teksChat = statusBaru === 'disetujui'
      ? `✅ Perizinan Anda telah DISETUJUI oleh Wali Kelas (${guruAktif.nama}). Catatan: "${catatan}"`
      : `❌ Perizinan Anda DITOLAK oleh Wali Kelas (${guruAktif.nama}). Alasan: "${catatan}"`;
    kirimChatPerijinan(idIzin, { role: 'admin', nama: guruAktif.nama }, teksChat).catch(() => null);
  }

  if (statusBaru === 'disetujui' && iz.nisn && iz.tanggal) {
    try {
      const snapSiswa = await db.ref('siswa/' + iz.nisn).once('value');
      const siswa = snapSiswa.val() || {};
      const kelasTarget = ((typeof normalisasiKelas === 'function') ? normalisasiKelas(iz.kelas || siswa.kelas || currentKelas) : (iz.kelas || siswa.kelas || currentKelas));
      const jadwalSnap = await db.ref('jadwal_pelajaran/' + kelasTarget).once('value');
      const jadwal = jadwalSnap.val() || { '1': true, '2': true, '3': true, '4': true };
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
    txt.innerHTML = `<a href="${fotoUrl}" target="_blank" style="color:#4f46e5;font-weight:700;text-decoration:underline;">📎 Buka Tautan Lampiran Dokumen</a>`;
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
        stBadge.textContent = 'KBM: JAMKOS ⚠️';
        stBadge.style.background = '#ef4444';
      } else if (st === 'pulang') {
        stBadge.textContent = 'KBM: PULANG 🏠';
        stBadge.style.background = '#64748b';
      } else {
        stBadge.textContent = 'KBM: BELAJAR 🟢';
        stBadge.style.background = '#10b981';
      }
    }
  });

  // 2. Ambil Semua Siswa di Kelas Binaan
  let semuaSiswa = {};
  try {
    const snap = await db.ref('siswa').once('value');
    semuaSiswa = (typeof parseSiswaSnapshot === 'function') ? parseSiswaSnapshot(snap.val()) : (snap.val() || {});
  } catch (e) {}

  if (Object.keys(semuaSiswa).length < 20) {
    try {
      const res = await fetch('assets/data-siswa.json');
      const local = await res.json();
      semuaSiswa = Object.assign({}, parseSiswaSnapshot(local), semuaSiswa);
    } catch (e) {}
  }

  const listSiswaKelas = Object.entries(semuaSiswa).filter(([nisn, s]) =>
    ((typeof normalisasiKelas === 'function') ? normalisasiKelas(s.kelas) : s.kelas) === normKelas
  );

  // 3. Ambil Presensi Jam Hari Ini & Izin Disetujui
  const snapPresensi = await db.ref(`presensi_jam/${kelas}/${today}`).once('value');
  const presensiData = snapPresensi.val() || {};

  const allIzin = await ambilSemuaPerizinanOnce();
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

    let statusFinal = 'belum';
    let statusLabel = 'Belum Absen';
    let statusCardClass = 'belum';

    if (tapStatus === 'hadir' || tapStatus === 'terlambat') {
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
      card.innerHTML = `
        <div style="font-size:14.5px;font-weight:800;color:#1e293b;">${s.nama}</div>
        <div style="font-size:12px;color:#64748b;margin-top:2px;">NISN: ${nisn}</div>
        <div style="margin-top:8px;display:flex;align-items:center;justify-content:space-between;">
          <span style="font-size:12px;font-weight:700;">${statusLabel}</span>
          ${statusFinal === 'belum' ? `<button class="btn-mini-action btn-mini-izin" onclick="tandaiIzinCepatWalas('${nisn}', '${kelas}', '${s.nama}')">📝 Izin</button>` : ''}
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
  const container = document.getElementById('boxAlertWalasContainer');
  if (!container) return;
  const kelas = kelasBinaanAktif || (guruAktif && guruAktif.walasKelasId) || 'XII RPL 2';
  const normKelas = (typeof normalisasiKelas === 'function') ? normalisasiKelas(kelas) : kelas;
  const today = tanggalHariIni();

  let semuaSiswa = {};
  try {
    const snap = await db.ref('siswa').once('value');
    semuaSiswa = (typeof parseSiswaSnapshot === 'function') ? parseSiswaSnapshot(snap.val()) : (snap.val() || {});
  } catch (e) {}

  if (Object.keys(semuaSiswa).length < 20) {
    try {
      const res = await fetch('assets/data-siswa.json');
      const local = await res.json();
      semuaSiswa = Object.assign({}, parseSiswaSnapshot(local), semuaSiswa);
    } catch (e) {}
  }

  const listSiswaKelas = Object.entries(semuaSiswa).filter(([nisn, s]) =>
    ((typeof normalisasiKelas === 'function') ? normalisasiKelas(s.kelas) : s.kelas) === normKelas
  );

  const snapPresensi = await db.ref(`presensi_jam/${kelas}/${today}`).once('value');
  const presensiData = snapPresensi.val() || {};

  const allIzin = await ambilSemuaPerizinanOnce();
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
    if (izinApproved[nisn]) hasTap = true;
    return !hasTap;
  });

  container.innerHTML = '';
  if (belumTapList.length === 0) {
    container.innerHTML = `
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;padding:20px;border-radius:14px;text-align:center;color:#166534;">
        <span style="font-size:24px;">🎉</span>
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
      <span style="font-size:22px;">⚠️</span>
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
    card.innerHTML = `
      <div style="font-size:14px;font-weight:800;color:#0f172a;">${s.nama}</div>
      <div style="font-size:12px;color:#64748b;margin-top:2px;">NISN: ${nisn} • Kelas: ${kelas}</div>
      <div style="margin-top:10px;display:flex;gap:8px;">
        <button class="btn-mini-action btn-mini-hadir" onclick="catatHadirManualWalas('${nisn}', '${kelas}', '${s.nama}')">✓ Hadir Manual</button>
        <button class="btn-mini-action btn-mini-izin" onclick="tandaiIzinCepatWalas('${nisn}', '${kelas}', '${s.nama}')">📝 Catat Izin</button>
      </div>
    `;
    listGrid.appendChild(card);
  });

  alertBox.appendChild(listGrid);
  container.appendChild(alertBox);
}

async function catatHadirManualWalas(nisn, kelas, nama) {
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

  const ref = db.ref('kendala_guru').push();
  const id = ref.key;
  const payload = {
    id,
    guruUid: guruAktif.uid,
    guruNama: guruAktif.nama,
    guruNip: guruAktif.nip || '',
    kelasId: kelas,
    mapel: mapel,
    tanggal: tanggal,
    jenis: jenis,
    alasan: alasan,
    status: 'pending',
    createdAt: Date.now()
  };

  try {
    await ref.set(payload);
    msgEl.style.display = 'block';
    msgEl.style.background = '#ecfdf5';
    msgEl.style.color = '#065f46';
    msgEl.style.border = '1px solid #a7f3d0';
    msgEl.textContent = '✅ Laporan kendala mengajar berhasil dikirim ke Admin! Menunggu persetujuan (ACC) Jamkos.';
    document.getElementById('kendalaAlasan').value = '';
    muatRiwayatKendalaGuru();
  } catch (err) {
    msgEl.style.display = 'block';
    msgEl.style.background = '#fef2f2';
    msgEl.style.color = '#991b1b';
    msgEl.style.border = '1px solid #fecaca';
    msgEl.textContent = 'Gagal mengirim: ' + err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = '🚀 Kirim Laporan Kendala (Usulkan Jamkos ke Admin)';
  }
}

function muatRiwayatKendalaGuru() {
  const container = document.getElementById('listRiwayatKendalaGuru');
  if (!container || !guruAktif) return;

  db.ref('kendala_guru').on('value', snapshot => {
    const data = snapshot.val() || {};
    const list = Object.values(data)
      .filter(k => k.guruUid === guruAktif.uid || guruAktif.role === 'admin')
      .sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0));

    container.innerHTML = '';
    if (list.length === 0) {
      container.innerHTML = '<p style="color:#94a3b8;font-size:13.5px;text-align:center;padding:20px;">Belum pernah mengajukan laporan kendala mengajar.</p>';
      return;
    }

    list.forEach(k => {
      const isApproved = k.status === 'approved';
      const isRejected = k.status === 'rejected';
      const badgeText = isApproved ? '✅ DISETUJUI ADMIN (JAMKOS AKTIF)' : isRejected ? '❌ DITOLAK' : '⏳ MENUNGGU VERIFIKASI ADMIN';
      const badgeStyle = isApproved ? 'background:#dcfce7;color:#15803d;' : isRejected ? 'background:#fee2e2;color:#b91c1c;' : 'background:#fef3c7;color:#b45309;';

      const card = document.createElement('div');
      card.style.cssText = 'border:1px solid #e2e8f0;border-radius:14px;padding:16px;margin-bottom:12px;background:#f8fafc;';
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:6px;">
          <div style="font-size:14.5px;font-weight:800;color:#0f172a;">${k.mapel} — Kelas ${k.kelasId}</div>
          <span style="font-size:11px;font-weight:800;padding:3px 9px;border-radius:999px;${badgeStyle}">${badgeText}</span>
        </div>
        <div style="font-size:12.5px;color:#64748b;margin-bottom:6px;">📅 Tanggal: ${k.tanggal} • Jenis: ${k.jenis.replace(/_/g, ' ')}</div>
        <div style="font-size:13px;color:#334155;background:#fff;padding:10px 12px;border-radius:10px;border:1px solid #e2e8f0;">${k.alasan}</div>
      `;
      container.appendChild(card);
    });
  });
}

