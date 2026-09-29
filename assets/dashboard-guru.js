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
  if (user.role !== 'guru' && user.role !== 'admin') {
    alert('Akses Terbatas: Halaman ini khusus Bapak/Ibu Guru dan Tenaga Pengajar.');
    window.location.href = 'dashboard.html';
    return;
  }
  guruAktif = user;
  initPortalGuru(guruAktif);
});

function switchGuruTab(id, btn) {
  document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.view-tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(id).style.display = 'block';
  btn.classList.add('active');
}

async function initPortalGuru(user) {
  // Update Header
  document.getElementById('namaUser').textContent = user.nama || 'Guru Pengajar';
  document.getElementById('infoSubUser').textContent =
    `NIP: ${user.nip || '-'} • Mapel: ${user.mapel || 'Pengajar'} • Email: ${user.email}`;

  document.getElementById('labelTanggalHariIni').textContent = tanggalHariIni();
  const labelTglGuru = document.getElementById('labelTglAbsenGuru');
  if (labelTglGuru) labelTglGuru.textContent = tanggalHariIni();
  document.getElementById('rekapTanggal').value = tanggalHariIni();

  // Muat status presensi dinas guru mandiri
  await muatStatusAbsenGuruHariIni();
  muatRiwayatAbsenGuru();

  // Muat daftar kelas
  await muatDaftarKelas();

  // Dengarkan perizinan realtime
  initListenerPerizinan();
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

  const snap = await db.ref('siswa').once('value');
  const siswaData = snap.val() || {};

  const kelasSet = new Set();
  Object.values(siswaData).forEach(s => {
    if (s.kelas) kelasSet.add(s.kelas);
  });

  const listKelas = Array.from(kelasSet).sort();
  selLive.innerHTML = '';
  selRekap.innerHTML = '';

  if (listKelas.length === 0) {
    listKelas.push('9A');
  }

  listKelas.forEach(k => {
    const o1 = document.createElement('option');
    o1.value = k;
    o1.textContent = `Kelas ${k}`;
    selLive.appendChild(o1);

    const o2 = document.createElement('option');
    o2.value = k;
    o2.textContent = `Kelas ${k}`;
    selRekap.appendChild(o2);
  });

  currentKelas = selLive.value;
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
  const snapSiswa = await db.ref('siswa').once('value');
  const semuaSiswa = snapSiswa.val() || {};
  const siswaKelas = Object.entries(semuaSiswa).filter(([nisn, s]) => s.kelas === currentKelas);

  // 3. Ambil data presensi jam berjalan
  const snapPresensi = await db.ref(`presensi_jam/${currentKelas}/${today}/${jamKeAktif}`).once('value');
  const presensiHariIni = snapPresensi.val() || {};

  // 4. Ambil perizinan disetujui untuk hari ini
  const snapIzin = await db.ref('perizinan').once('value');
  const dataIzin = snapIzin.val() || {};
  const izinHariIni = {};
  Object.values(dataIzin).forEach(iz => {
    if (iz.kelas === currentKelas && iz.tanggal === today && iz.status === 'disetujui') {
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

  siswaKelas.sort((a,b) => a[1].nama.localeCompare(b[1].nama)).forEach(([nisn, s]) => {
    const card = document.createElement('div');
    const absen = presensiHariIni[nisn];
    const izin = izinHariIni[nisn];

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

  await db.ref(`perizinan/${izinId}`).set({
    id: izinId,
    nisn: nisn,
    nama_siswa: namaSiswa,
    kelas: currentKelas,
    tanggal: today,
    jenis: 'izin',
    alasan: alasan,
    foto_bukti: null,
    status: 'disetujui',
    diverifikasi_oleh: guruAktif ? guruAktif.nama : 'Guru',
    catatan_guru: 'Diizinkan langsung oleh guru di kelas',
    created_at: new Date().toISOString()
  });

  muatDataPresensiKelas();
}

// ===== TAB 2: APPROVAL PERIZINAN =====
function initListenerPerizinan() {
  db.ref('perizinan').on('value', snap => {
    allPerizinanData = snap.val() || {};
    renderListApprovalIzin();
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
    card.innerHTML = `
      <div class="card-izin-header">
        <div>
          <div style="font-size:16px;font-weight:800;color:#0f172a;">${iz.nama_siswa || 'Siswa'} (${iz.kelas || '-'})</div>
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
        <div>
          ${iz.foto_bukti ? `<button onclick="bukaModalBukti('${iz.foto_bukti}', '${iz.nama_siswa}')" class="btn-mini-action" style="background:#e0e7ff;color:#4338ca;">🔍 Lihat Lampiran Foto</button>` : '<span style="font-size:12.5px;color:#94a3b8;">Tanpa lampiran foto</span>'}
        </div>

        ${iz.status === 'pending' ? `
          <div style="display:flex;gap:8px;">
            <button onclick="prosesApprovalIzin('${iz.id}', 'ditolak')" class="btn-mini-action" style="background:#ef4444;color:#fff;">✗ Tolak</button>
            <button onclick="prosesApprovalIzin('${iz.id}', 'disetujui')" class="btn-mini-action btn-mini-hadir">✓ Setujui Izin</button>
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
  const catatan = prompt(`Masukkan catatan guru untuk verifikasi (${statusBaru}):`, statusBaru === 'disetujui' ? 'Disetujui. Cepat sembuh.' : 'Bukti kurang lengkap.');
  if (catatan === null) return;

  await db.ref(`perizinan/${idIzin}`).update({
    status: statusBaru,
    diverifikasi_oleh: guruAktif ? guruAktif.nama : 'Guru',
    catatan_guru: catatan,
    updated_at: new Date().toISOString()
  });

  if (statusBaru === 'disetujui') {
    muatDataPresensiKelas();
  }
}

function bukaModalBukti(fotoBase64, nama) {
  document.getElementById('modalBuktiTitle').textContent = `Bukti Surat Izin — ${nama}`;
  const img = document.getElementById('modalBuktiImg');
  const txt = document.getElementById('modalBuktiText');
  if (fotoBase64 && fotoBase64.startsWith('data:image')) {
    img.src = fotoBase64;
    img.style.display = 'block';
    txt.textContent = '';
  } else {
    img.style.display = 'none';
    txt.textContent = 'Lampiran tidak dalam format gambar yang didukung.';
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

  const snapSiswa = await db.ref('siswa').once('value');
  const semuaSiswa = snapSiswa.val() || {};
  const siswaKelas = Object.entries(semuaSiswa).filter(([nisn, s]) => s.kelas === kelas);

  const snapPresensi = await db.ref(`presensi_jam/${kelas}/${tanggal}`).once('value');
  const presensiTgl = snapPresensi.val() || {};

  const snapIzin = await db.ref('perizinan').once('value');
  const allIzin = snapIzin.val() || {};
  const izinMap = {};
  Object.values(allIzin).forEach(iz => {
    if (iz.kelas === kelas && iz.tanggal === tanggal && iz.status === 'disetujui') {
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
