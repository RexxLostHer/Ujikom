// ===================================================================
// ADMIN.JS — Panel Admin 2026
// Auth guard Firebase + seluruh logika CRUD admin
// ===================================================================

const db = firebase.database();
let adminSessionUser = null;
let siswaCache = {};
let kartuCache = {};

// ===== AUTH GUARD =====
firebase.auth().onAuthStateChanged(async function (fbUser) {
  if (!fbUser) { window.location.href = 'index.html'; return; }
  const userData = await prosesLoginUser(fbUser);
  if (userData.role !== 'admin') { window.location.href = 'dashboard.html'; return; }
  adminSessionUser = userData;
  document.getElementById('adminNamaBadge').textContent = userData.nama || 'Administrator';
  initAdmin();
});

document.getElementById('logoutBtn').addEventListener('click', function () {
  logout();
});

function initAdmin() {
  // Populate tanggal default di Edit Presensi & Rekap
  const tgl = document.getElementById('presensiTanggal');
  if (tgl) tgl.value = tanggalHariIni();
  const tglRekap = document.getElementById('rekapTanggal');
  if (tglRekap) tglRekap.value = tanggalHariIni();

  // Listeners realtime
  db.ref('siswa').on('value', function (snapshot) {
    siswaCache = snapshot.val() || {};
    renderSiswaTable(siswaCache);
    renderKartuTable(kartuCache);
    populatePresensiKelas();
  });

  db.ref('kartu').on('value', function (snapshot) {
    kartuCache = snapshot.val() || {};
    renderKartuTable(kartuCache);
  });

  db.ref('jadwal').on('value', function (snapshot) {
    renderJadwalTable(snapshot.val() || {});
  });

  listenPendingCount();
  loadUsers();
  renderDaftarPerijinanAdmin('daftarPerijinanAdmin', 'pending');
}

// ===== TAB NAVIGATION =====
function switchToTab(tabName) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.remove('active'));
  const panel = document.getElementById('tab-' + tabName);
  if (panel) panel.classList.add('active');
  const btn = document.querySelector('.sidebar-btn[data-tab="' + tabName + '"]');
  if (btn) btn.classList.add('active');

  // Lazy load jadwal pelajaran saat pertama kali tab dibuka
  if (tabName === 'pelajaran') {
    const sel = document.getElementById('pelajaranKelas');
    if (sel && sel.value) pasangListenerPelajaran(sel.value);
  }

  // Auto load rekap saat tab rekap dibuka
  if (tabName === 'rekap') {
    muatRekapPresensi();
  }
}

// ===== MSG HELPER =====
function showMsg(elId, text, type) {
  const el = typeof elId === 'string' ? document.getElementById(elId) : elId;
  if (!el) return;
  el.textContent = text;
  el.className = 'msg ' + type;
  setTimeout(function () { if (el) { el.textContent = ''; el.className = 'msg'; } }, 3500);
}

// ===================================================================
// TAB: PERIJINAN MASUK
// ===================================================================
let filterPerijinanAktif = 'pending';

function setFilterPerijinan(btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  filterPerijinanAktif = btn.dataset.filter;
  renderDaftarPerijinanAdmin('daftarPerijinanAdmin', filterPerijinanAktif);
}

function listenPendingCount() {
  db.ref('perijinan').orderByChild('status').equalTo('pending').on('value', function (snap) {
    const n = snap.numChildren();
    const banner = document.getElementById('notifPerijinanBanner');
    const jml = document.getElementById('jumlahPending');
    const badge = document.getElementById('badgePerijinan');
    if (n > 0) {
      banner.classList.add('show');
      jml.textContent = n;
      badge.textContent = n;
      badge.style.display = 'inline-block';
    } else {
      banner.classList.remove('show');
      badge.style.display = 'none';
    }
  });
}

// ===================================================================
// TAB: EDIT PRESENSI MANUAL
// ===================================================================
function populatePresensiKelas() {
  const selKelas = document.getElementById('presensiKelas');
  const selRekapKelas = document.getElementById('rekapKelas');
  if (!selKelas && !selRekapKelas) return;
  
  const kelasBefore = selKelas ? selKelas.value : '';
  const rekapBefore = selRekapKelas ? selRekapKelas.value : '';
  const kelasSet = new Set(Object.values(siswaCache).map(s => s.kelas).filter(Boolean));
  
  if (selKelas) {
    selKelas.innerHTML = '';
    Array.from(kelasSet).sort().forEach(k => {
      const opt = document.createElement('option');
      opt.value = k; opt.textContent = k;
      selKelas.appendChild(opt);
    });
    if (kelasBefore && kelasSet.has(kelasBefore)) selKelas.value = kelasBefore;
    populatePresensiSiswa();
    selKelas.onchange = populatePresensiSiswa;
  }

  if (selRekapKelas) {
    selRekapKelas.innerHTML = '';
    Array.from(kelasSet).sort().forEach(k => {
      const opt = document.createElement('option');
      opt.value = k; opt.textContent = k;
      selRekapKelas.appendChild(opt);
    });
    if (rekapBefore && kelasSet.has(rekapBefore)) selRekapKelas.value = rekapBefore;
  }
}

function populatePresensiSiswa() {
  const kelas = document.getElementById('presensiKelas').value;
  const selSiswa = document.getElementById('presensiSiswa');
  selSiswa.innerHTML = '<option value="">-- Pilih siswa --</option>';
  Object.entries(siswaCache)
    .filter(([, s]) => s.kelas === kelas)
    .sort(([, a], [, b]) => a.nama.localeCompare(b.nama))
    .forEach(([nisn, s]) => {
      const opt = document.createElement('option');
      opt.value = nisn; opt.textContent = s.nama + ' (' + nisn + ')';
      selSiswa.appendChild(opt);
    });
}

function simpanPresensiManual() {
  const kelas  = document.getElementById('presensiKelas').value;
  const tgl    = document.getElementById('presensiTanggal').value;
  const jamKe  = document.getElementById('presensiJamKe').value;
  const nisn   = document.getElementById('presensiSiswa').value;
  const status = document.getElementById('presensiStatus').value;

  if (!kelas || !tgl || !jamKe || !nisn || !status) {
    showMsg('presensiManualMsg', 'Isi semua field dulu ya.', 'error');
    return;
  }

  const pad = n => String(n).padStart(2, '0');
  const now = new Date();
  const waktu = pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());

  const path = 'presensi_jam/' + kelas + '/' + tgl + '/' + jamKe + '/' + nisn;
  db.ref(path).set({ status, waktu, manual: true, oleh: adminSessionUser ? adminSessionUser.uid : 'admin' })
    .then(function () {
      const namaSiswa = (siswaCache[nisn] && siswaCache[nisn].nama) || nisn;
      showMsg('presensiManualMsg',
        '✅ Status ' + namaSiswa + ' jam ke-' + jamKe + ' diubah menjadi "' + status + '".',
        'success');
    })
    .catch(function (err) {
      showMsg('presensiManualMsg', 'Gagal: ' + err.message, 'error');
    });
}

// ===================================================================
// TAB: REKAP & LAPORAN PRESENSI
// ===================================================================
let rekapCacheData = [];

async function muatRekapPresensi() {
  const kelas = document.getElementById('rekapKelas') ? document.getElementById('rekapKelas').value : '';
  const tgl = document.getElementById('rekapTanggal') ? document.getElementById('rekapTanggal').value : '';
  const tbody = document.getElementById('rekapTableBody');
  if (!tbody) return;

  if (!kelas || !tgl) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-state"><div class="empty-icon">⚠️</div><p>Pilih kelas dan tanggal terlebih dahulu.</p></td></tr>';
    return;
  }

  tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px; color:#64748b;">⏳ Memuat data rekapitulasi...</td></tr>';

  // 1. Ambil daftar siswa kelas terkait dari cache
  const daftarSiswa = Object.entries(siswaCache)
    .filter(([, s]) => s.kelas === kelas)
    .map(([nisn, s]) => ({ nisn, nama: s.nama }))
    .sort((a, b) => a.nama.localeCompare(b.nama));

  // 2. Ambil data presensi_jam/{kelas}/{tanggal}
  let dataPresensi = {};
  try {
    const snap = await db.ref('presensi_jam/' + kelas + '/' + tgl).once('value');
    dataPresensi = snap.val() || {};
  } catch (e) {
    console.error('Gagal mengambil presensi_jam:', e);
  }

  rekapCacheData = [];
  let hitungHadir = 0;
  let hitungSakit = 0;
  let hitungIzin = 0;
  let hitungAlpha = 0;

  tbody.innerHTML = '';
  if (daftarSiswa.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-state"><div class="empty-icon">👥</div><p>Tidak ada data siswa di kelas ' + kelas + '.</p></td></tr>';
    return;
  }

  daftarSiswa.forEach((siswa, index) => {
    // Cek status tiap jam (jam 1, 2, 3, 4)
    const jam1 = (dataPresensi['1'] && dataPresensi['1'][siswa.nisn]) ? dataPresensi['1'][siswa.nisn].status : '-';
    const jam2 = (dataPresensi['2'] && dataPresensi['2'][siswa.nisn]) ? dataPresensi['2'][siswa.nisn].status : '-';
    const jam3 = (dataPresensi['3'] && dataPresensi['3'][siswa.nisn]) ? dataPresensi['3'][siswa.nisn].status : '-';
    const jam4 = (dataPresensi['4'] && dataPresensi['4'][siswa.nisn]) ? dataPresensi['4'][siswa.nisn].status : '-';

    const semuaStatus = [jam1, jam2, jam3, jam4].filter(s => s !== '-');

    let statusAkhir = 'Alpha';
    let badgeClass = 'ditolak';

    if (semuaStatus.some(s => s === 'hadir')) {
      statusAkhir = 'Hadir';
      badgeClass = 'disetujui';
      hitungHadir++;
    } else if (semuaStatus.some(s => s === 'sakit')) {
      statusAkhir = 'Sakit';
      badgeClass = 'pending';
      hitungSakit++;
    } else if (semuaStatus.some(s => s === 'dispensasi' || s === 'ijin_kegiatan')) {
      statusAkhir = 'Izin/Disp';
      badgeClass = 'pending';
      hitungIzin++;
    } else {
      statusAkhir = 'Alpha';
      badgeClass = 'ditolak';
      hitungAlpha++;
    }

    rekapCacheData.push({
      no: index + 1,
      nisn: siswa.nisn,
      nama: siswa.nama,
      jam1, jam2, jam3, jam4,
      statusAkhir
    });

    const formatBadgeJam = (val) => {
      if (val === '-') return '<span style="color:#94a3b8;">-</span>';
      if (val === 'hadir') return '<span style="color:#059669; font-weight:700;">✓ Hadir</span>';
      if (val === 'sakit') return '<span style="color:#2563eb; font-weight:700;">🤒 Sakit</span>';
      if (val === 'dispensasi' || val === 'ijin_kegiatan') return '<span style="color:#d97706; font-weight:700;">📄 Izin</span>';
      return '<span style="color:#dc2626; font-weight:700;">✗ ' + val + '</span>';
    };

    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td>' + (index + 1) + '</td>' +
      '<td><code>' + siswa.nisn + '</code></td>' +
      '<td><strong>' + siswa.nama + '</strong></td>' +
      '<td>' + formatBadgeJam(jam1) + '</td>' +
      '<td>' + formatBadgeJam(jam2) + '</td>' +
      '<td>' + formatBadgeJam(jam3) + '</td>' +
      '<td>' + formatBadgeJam(jam4) + '</td>' +
      '<td><span class="status-pill ' + badgeClass + '">' + statusAkhir + '</span></td>';

    tbody.appendChild(tr);
  });

  // Update Summary Cards
  document.getElementById('statTotalSiswa').textContent = daftarSiswa.length;
  document.getElementById('statHadir').textContent = hitungHadir;
  document.getElementById('statSakit').textContent = hitungSakit;
  document.getElementById('statIzin').textContent = hitungIzin;
  document.getElementById('statAlpha').textContent = hitungAlpha;
}

function cetakLaporanPresensi() {
  const kelas = document.getElementById('rekapKelas') ? document.getElementById('rekapKelas').value : '';
  const tgl = document.getElementById('rekapTanggal') ? document.getElementById('rekapTanggal').value : '';
  if (!rekapCacheData || rekapCacheData.length === 0) {
    alert('Tampilkan rekap terlebih dahulu sebelum mencetak.');
    return;
  }
  window.print();
}

function exportCsvPresensi() {
  const kelas = document.getElementById('rekapKelas') ? document.getElementById('rekapKelas').value : 'Kelas';
  const tgl = document.getElementById('rekapTanggal') ? document.getElementById('rekapTanggal').value : 'Tanggal';
  
  if (!rekapCacheData || rekapCacheData.length === 0) {
    alert('Tampilkan rekap terlebih dahulu sebelum export.');
    return;
  }

  let csvContent = 'data:text/csv;charset=utf-8,';
  csvContent += 'REKAPITULASI PRESENSI KELAS ' + kelas + ' - TANGGAL ' + tgl + '\r\n\r\n';
  csvContent += 'No,NISN,Nama Siswa,Jam 1,Jam 2,Jam 3,Jam 4,Status Akhir\r\n';

  rekapCacheData.forEach(row => {
    const namaClean = '"' + row.nama.replace(/"/g, '""') + '"';
    csvContent += [row.no, row.nisn, namaClean, row.jam1, row.jam2, row.jam3, row.jam4, row.statusAkhir].join(',') + '\r\n';
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', 'Rekap_Presensi_' + kelas.replace(/\s+/g, '_') + '_' + tgl + '.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ===================================================================
// TAB: DATA SISWA
// ===================================================================
function resetFormSiswa() {
  document.getElementById('siswaEditingKey').value = '';
  document.getElementById('siswaNisn').value = '';
  document.getElementById('siswaNisn').disabled = false;
  document.getElementById('siswaNama').value = '';
  document.getElementById('siswaKelas').value = '';
  document.getElementById('siswaEmail').value = '';
  document.getElementById('siswaFormTitle').textContent = 'Tambah Siswa Baru';
  document.getElementById('siswaSubmitBtn').textContent = '+ Tambah Siswa';
  document.getElementById('siswaCancelBtn').classList.add('hidden');
}

function editSiswa(nisn) {
  const data = siswaCache[nisn];
  if (!data) return;
  document.getElementById('siswaEditingKey').value = nisn;
  document.getElementById('siswaNisn').value = nisn;
  document.getElementById('siswaNisn').disabled = true;
  document.getElementById('siswaNama').value = data.nama || '';
  document.getElementById('siswaKelas').value = data.kelas || '';
  document.getElementById('siswaEmail').value = data.email || '';
  document.getElementById('siswaFormTitle').textContent = 'Edit Data Siswa';
  document.getElementById('siswaSubmitBtn').textContent = '💾 Simpan Perubahan';
  document.getElementById('siswaCancelBtn').classList.remove('hidden');
  switchToTab('siswa');
  document.querySelector('.admin-content').scrollTop = 0;
}

function hapusSiswa(nisn) {
  const nama = (siswaCache[nisn] && siswaCache[nisn].nama) || nisn;
  if (!confirm('Hapus siswa ' + nama + ' (NISN: ' + nisn + ')?\nMapping kartu tidak otomatis terhapus.')) return;
  db.ref('siswa/' + nisn).remove()
    .then(function () { showMsg('siswaMsg', 'Siswa dihapus.', 'success'); })
    .catch(function (err) { showMsg('siswaMsg', 'Gagal: ' + err.message, 'error'); });
}

function submitSiswa() {
  const editingKey = document.getElementById('siswaEditingKey').value;
  const nisn  = document.getElementById('siswaNisn').value.trim();
  const nama  = document.getElementById('siswaNama').value.trim();
  const kelas = document.getElementById('siswaKelas').value.trim();
  const email = document.getElementById('siswaEmail').value.trim().toLowerCase();

  if (!nisn || !nama || !kelas) {
    showMsg('siswaMsg', 'NISN, Nama, dan Kelas wajib diisi.', 'error');
    return;
  }

  const payload = { nama, kelas };
  if (email) payload.email = email;

  const key = editingKey || nisn;
  db.ref('siswa/' + key).update(payload)
    .then(function () {
      showMsg('siswaMsg', editingKey ? 'Data diperbarui.' : 'Siswa ditambahkan.', 'success');
      // Update email_mapping juga supaya bisa login Google
      if (email) {
        const encoded = email.replace(/\./g, ',').replace(/@/g, '(at)');
        db.ref('email_mapping/' + encoded).update({ nisn: key, nama, kelas, email });
      }
      resetFormSiswa();
    })
    .catch(function (err) { showMsg('siswaMsg', 'Gagal: ' + err.message, 'error'); });
}

function renderSiswaTable(data) {
  const tbody = document.getElementById('siswaTableBody');
  const selKartu  = document.getElementById('kartuNisn');
  const selSim    = document.getElementById('simulasiNisn');
  const selPelKls = document.getElementById('pelajaranKelas');
  if (!tbody) return;

  const kelasBefore = selPelKls ? selPelKls.value : '';
  tbody.innerHTML = '';

  if (selKartu) selKartu.innerHTML = '<option value="">-- Pilih siswa --</option>';
  if (selSim) selSim.innerHTML = '<option value="">-- Pilih siswa --</option>';

  const nisnList = Object.keys(data).filter(k => /^\d+$/.test(k)).sort();
  const kelasSet = new Set();

  if (nisnList.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state"><div class="empty-icon">🧑‍🎓</div><p>Belum ada data siswa.</p></td></tr>';
  } else {
    nisnList.forEach(function (nisn) {
      const s = data[nisn];
      kelasSet.add(s.kelas);

      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' + nisn + '</td>' +
        '<td>' + (s.nama || '') + '</td>' +
        '<td>' + (s.kelas || '') + '</td>' +
        '<td style="font-size:12px;color:#64748b;">' + (s.email || '-') + '</td>' +
        '<td></td>';

      const actionsTd = tr.cells[4];

      const editBtn = document.createElement('button');
      editBtn.textContent = 'Edit';
      editBtn.className = 'btn-row-edit';
      editBtn.onclick = function () { editSiswa(nisn); };

      const delBtn = document.createElement('button');
      delBtn.textContent = 'Hapus';
      delBtn.className = 'btn-row-delete';
      delBtn.onclick = function () { hapusSiswa(nisn); };

      actionsTd.appendChild(editBtn);
      actionsTd.appendChild(delBtn);
      tbody.appendChild(tr);

      if (selKartu) {
        const opt = document.createElement('option');
        opt.value = nisn;
        opt.textContent = nisn + ' — ' + (s.nama || '');
        selKartu.appendChild(opt);
      }

      if (selSim) {
        const opt2 = document.createElement('option');
        opt2.value = nisn;
        opt2.textContent = (s.nama || nisn) + ' (' + (s.kelas || '') + ')';
        selSim.appendChild(opt2);
      }
    });
  }

  // Populate dropdown kelas jadwal pelajaran
  if (selPelKls) {
    selPelKls.innerHTML = '';
    Array.from(kelasSet).sort().forEach(k => {
      const opt = document.createElement('option');
      opt.value = k; opt.textContent = k;
      selPelKls.appendChild(opt);
    });
    if (kelasBefore && kelasSet.has(kelasBefore)) {
      selPelKls.value = kelasBefore;
    } else if (selPelKls.value) {
      pasangListenerPelajaran(selPelKls.value);
    }
  }

  populatePresensiKelas();
}

// ===================================================================
// TAB: KARTU NFC
// ===================================================================
function submitKartu() {
  const idKartu = document.getElementById('kartuId').value.trim();
  const nisn    = document.getElementById('kartuNisn').value;

  if (!idKartu || !nisn) {
    showMsg('kartuMsg', 'Isi UID kartu dan pilih siswa.', 'error');
    return;
  }

  db.ref('kartu/' + idKartu).set({ nisn })
    .then(function () {
      showMsg('kartuMsg', 'Mapping kartu disimpan.', 'success');
      document.getElementById('kartuId').value = '';
    })
    .catch(function (err) { showMsg('kartuMsg', 'Gagal: ' + err.message, 'error'); });
}

function hapusKartu(idKartu) {
  if (!confirm('Hapus mapping kartu ' + idKartu + '?')) return;
  db.ref('kartu/' + idKartu).remove()
    .then(function () { showMsg('kartuMsg', 'Mapping dihapus.', 'success'); })
    .catch(function (err) { showMsg('kartuMsg', 'Gagal: ' + err.message, 'error'); });
}

function renderKartuTable(data) {
  const tbody = document.getElementById('kartuTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const idList = Object.keys(data).sort();
  if (idList.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state"><div class="empty-icon">🪪</div><p>Belum ada mapping kartu.</p></div></td></tr>';
    return;
  }

  idList.forEach(function (idKartu) {
    const raw  = data[idKartu];
    const nisn = typeof raw === 'string' ? raw : (raw && raw.nisn);
    const nama = (siswaCache[nisn] && siswaCache[nisn].nama) || '(tidak ditemukan)';

    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td><code style="font-size:13px;">' + idKartu + '</code></td>' +
      '<td>' + (nisn || '-') + '</td>' +
      '<td>' + nama + '</td>' +
      '<td></td>';

    const delBtn = document.createElement('button');
    delBtn.textContent = 'Hapus';
    delBtn.className = 'btn-row-delete';
    delBtn.onclick = function () { hapusKartu(idKartu); };
    tr.cells[3].appendChild(delBtn);
    tbody.appendChild(tr);
  });
}

// ===================================================================
// TAB: JADWAL PULANG
// ===================================================================
function submitJadwal() {
  const kelas = document.getElementById('jadwalKelas').value.trim();
  const jam   = document.getElementById('jadwalJam').value;

  if (!kelas || !jam) {
    showMsg('jadwalMsg', 'Isi kelas dan jam pulang.', 'error');
    return;
  }

  db.ref('jadwal/' + kelas).set(jam)
    .then(function () {
      showMsg('jadwalMsg', 'Jadwal ' + kelas + ' → ' + jam + ' disimpan.', 'success');
      document.getElementById('jadwalKelas').value = '';
      document.getElementById('jadwalJam').value = '';
    })
    .catch(function (err) { showMsg('jadwalMsg', 'Gagal: ' + err.message, 'error'); });
}

function hapusJadwal(kelas) {
  if (!confirm('Hapus jadwal kelas ' + kelas + '?')) return;
  db.ref('jadwal/' + kelas).remove()
    .then(function () { showMsg('jadwalMsg', 'Jadwal dihapus.', 'success'); })
    .catch(function (err) { showMsg('jadwalMsg', 'Gagal: ' + err.message, 'error'); });
}

function renderJadwalTable(data) {
  const tbody = document.getElementById('jadwalTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const kelasList = Object.keys(data).sort();
  if (kelasList.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3"><div class="empty-state"><div class="empty-icon">🕐</div><p>Belum ada jadwal pulang.</p></div></td></tr>';
    return;
  }

  kelasList.forEach(function (kelas) {
    const nilai = data[kelas];
    // Format lama: string langsung
    const jam = typeof nilai === 'string' ? nilai : JSON.stringify(nilai);

    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td>' + kelas + '</td>' +
      '<td><strong>' + jam + '</strong></td>' +
      '<td></td>';

    const delBtn = document.createElement('button');
    delBtn.textContent = 'Hapus';
    delBtn.className = 'btn-row-delete';
    delBtn.onclick = function () { hapusJadwal(kelas); };
    tr.cells[2].appendChild(delBtn);
    tbody.appendChild(tr);
  });
}

// ===================================================================
// TAB: JADWAL PELAJARAN
// ===================================================================
let pelajaranListenerAktif = null;

function submitPelajaran() {
  const kelas   = document.getElementById('pelajaranKelas').value;
  const jamKe   = document.getElementById('pelajaranJamKe').value.trim();
  const mapel   = document.getElementById('pelajaranMapel').value.trim();
  const mulai   = document.getElementById('pelajaranMulai').value;
  const selesai = document.getElementById('pelajaranSelesai').value;

  if (!kelas || !jamKe || !mapel || !mulai || !selesai) {
    showMsg('pelajaranMsg', 'Isi semua field jadwal pelajaran.', 'error');
    return;
  }
  if (mulai >= selesai) {
    showMsg('pelajaranMsg', 'Jam selesai harus lebih besar dari jam mulai.', 'error');
    return;
  }

  db.ref('jadwal_pelajaran/' + kelas + '/' + jamKe).set({ mapel, mulai, selesai })
    .then(function () {
      showMsg('pelajaranMsg', 'Jam ke-' + jamKe + ' kelas ' + kelas + ' disimpan.', 'success');
      document.getElementById('pelajaranJamKe').value = '';
      document.getElementById('pelajaranMapel').value = '';
      document.getElementById('pelajaranMulai').value = '';
      document.getElementById('pelajaranSelesai').value = '';
    })
    .catch(function (err) { showMsg('pelajaranMsg', 'Gagal: ' + err.message, 'error'); });
}

function hapusPelajaran(kelas, jamKe) {
  if (!confirm('Hapus jam ke-' + jamKe + ' dari kelas ' + kelas + '?')) return;
  db.ref('jadwal_pelajaran/' + kelas + '/' + jamKe).remove()
    .then(function () { showMsg('pelajaranMsg', 'Jam ke-' + jamKe + ' dihapus.', 'success'); })
    .catch(function (err) { showMsg('pelajaranMsg', 'Gagal: ' + err.message, 'error'); });
}

function renderPelajaranTable(kelas, data) {
  const tbody = document.getElementById('pelajaranTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!data) {
    tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">📚</div><p>Belum ada jadwal untuk kelas ' + kelas + '.</p></div></td></tr>';
    return;
  }

  const jamKeList = Object.keys(data).sort((a, b) => Number(a) - Number(b));
  jamKeList.forEach(function (jamKe) {
    const p = data[jamKe];
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td><strong>Jam ke-' + jamKe + '</strong></td>' +
      '<td>' + (p.mapel || '') + '</td>' +
      '<td>' + (p.mulai || '') + '</td>' +
      '<td>' + (p.selesai || '') + '</td>' +
      '<td></td>';

    const delBtn = document.createElement('button');
    delBtn.textContent = 'Hapus';
    delBtn.className = 'btn-row-delete';
    delBtn.onclick = function () { hapusPelajaran(kelas, jamKe); };
    tr.cells[4].appendChild(delBtn);
    tbody.appendChild(tr);
  });
}

function pasangListenerPelajaran(kelas) {
  if (pelajaranListenerAktif) {
    db.ref('jadwal_pelajaran/' + pelajaranListenerAktif.kelas).off('value', pelajaranListenerAktif.callback);
  }
  if (!kelas) { renderPelajaranTable(kelas, null); return; }
  const callback = function (snapshot) { renderPelajaranTable(kelas, snapshot.val()); };
  db.ref('jadwal_pelajaran/' + kelas).on('value', callback);
  pelajaranListenerAktif = { kelas, callback };
}

document.addEventListener('DOMContentLoaded', function () {
  const selPelKls = document.getElementById('pelajaranKelas');
  if (selPelKls) {
    selPelKls.addEventListener('change', function () {
      pasangListenerPelajaran(selPelKls.value);
    });
  }
});

// ===================================================================
// TAB: SIMULASI ABSEN
// ===================================================================
function submitSimulasi() {
  const nisn   = document.getElementById('simulasiNisn').value;
  const status = document.getElementById('simulasiStatus').value;
  const msgEl  = document.getElementById('simulasiMsg');

  if (!nisn) { showMsg('simulasiMsg', 'Pilih siswa dulu.', 'error'); return; }

  const siswa = siswaCache[nisn];
  const kelas = siswa && siswa.kelas;

  const pad = n => String(n).padStart(2, '0');
  const now = new Date();
  const tanggal = tanggalHariIni();
  const waktu   = pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());

  const tulis = function (jamKeInfo) {
    const entry = { tanggal, waktu, status };
    if (jamKeInfo) entry.jam_ke = jamKeInfo.jam_ke;

    const tugas = [db.ref('absensi/' + nisn).push(entry)];
    if (kelas && jamKeInfo) {
      tugas.push(
        db.ref('presensi_jam/' + kelas + '/' + tanggal + '/' + jamKeInfo.jam_ke + '/' + nisn)
          .set({ waktu, status })
      );
    }

    Promise.all(tugas)
      .then(function () {
        showMsg('simulasiMsg',
          '✅ Absen ' + (siswa ? siswa.nama : nisn) + ' berhasil (' + status + ', ' + waktu + ').' +
          (jamKeInfo ? ' Jam ke-' + jamKeInfo.jam_ke + ' — ' + jamKeInfo.mapel + '.' : ''),
          'success');
      })
      .catch(function (err) { showMsg('simulasiMsg', 'Gagal: ' + err.message, 'error'); });
  };

  if (!kelas) { tulis(null); return; }

  db.ref('jadwal_pelajaran/' + kelas).once('value').then(function (snapshot) {
    const jamKeInfo = cariJamKeAktif(snapshot.val(), jamSekarang());
    tulis(jamKeInfo);
  }).catch(function () { tulis(null); });
}

// ===================================================================
// TAB: KELOLA AKUN / GURU
// ===================================================================
function submitGuru() {
  const email = document.getElementById('guruEmail').value.trim().toLowerCase();
  const nama  = document.getElementById('guruNama').value.trim();

  if (!email || !nama) {
    showMsg('guruMsg', 'Email dan nama wajib diisi.', 'error');
    return;
  }

  const encoded = email.replace(/\./g, ',').replace(/@/g, '(at)');
  db.ref('email_mapping/' + encoded).set({ nisn: null, nama, kelas: null, role: 'guru', email })
    .then(function () {
      showMsg('guruMsg', '✅ ' + nama + ' berhasil didaftarkan sebagai guru.', 'success');
      document.getElementById('guruEmail').value = '';
      document.getElementById('guruNama').value = '';
    })
    .catch(function (err) { showMsg('guruMsg', 'Gagal: ' + err.message, 'error'); });
}

function loadUsers() {
  db.ref('users').on('value', function (snap) {
    const tbody = document.getElementById('userTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const data = snap.val() || {};
    const entries = Object.entries(data);

    if (entries.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state"><div class="empty-icon">👥</div><p>Belum ada pengguna.</p></div></td></tr>';
      return;
    }

    entries.forEach(function ([uid, u]) {
      const tr = document.createElement('tr');

      // Role select
      const select = document.createElement('select');
      select.className = 'role-select';
      ['siswa', 'ortu', 'guru', 'admin'].forEach(function (r) {
        const opt = document.createElement('option');
        opt.value = r; opt.textContent = r;
        if (u.role === r) opt.selected = true;
        select.appendChild(opt);
      });
      select.onchange = function () { ubahRoleUser(uid, select.value); };

      // Hapus button
      const delBtn = document.createElement('button');
      delBtn.textContent = 'Hapus';
      delBtn.className = 'btn-row-delete';
      delBtn.onclick = function () { hapusUser(uid); };

      const tdNama  = document.createElement('td');
      const tdEmail = document.createElement('td');
      const tdRole  = document.createElement('td');
      const tdAksi  = document.createElement('td');

      tdNama.textContent  = u.nama  || '-';
      tdEmail.textContent = u.email || '-';
      tdEmail.style.fontSize = '12.5px';
      tdRole.appendChild(select);
      tdAksi.appendChild(delBtn);

      tr.appendChild(tdNama);
      tr.appendChild(tdEmail);
      tr.appendChild(tdRole);
      tr.appendChild(tdAksi);
      tbody.appendChild(tr);
    });
  });
}

async function ubahRoleUser(uid, role) {
  await db.ref('users/' + uid + '/role').set(role);
}

async function hapusUser(uid) {
  if (!confirm('Hapus user ini dari daftar terdaftar?')) return;
  await db.ref('users/' + uid).remove();
}

// ===================================================================
// MODAL CHAT PERIJINAN (delegate dari perijinan.js)
// ===================================================================
function tutupModalChat() {
  const overlay = document.getElementById('modalChat');
  if (overlay) overlay.classList.remove('open');
}

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') tutupModalChat();
});

const chatInput = document.getElementById('chatInputPesan');
if (chatInput) {
  chatInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') kirimPesanChat();
  });
}
