// Gate akses: harus login admin dulu
const adminUser = localStorage.getItem('admin_aktif');
if (!adminUser) {
  window.location.href = 'admin-login.html';
}

document.getElementById('logoutBtn').addEventListener('click', function () {
  localStorage.removeItem('admin_aktif');
  window.location.href = 'admin-login.html';
});

// ===== Tab switching =====
document.querySelectorAll('.tab-btn').forEach(function (btn) {
  btn.addEventListener('click', function () {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

// cache data siswa biar bisa dipakai buat dropdown & lookup nama di tab kartu
let siswaCache = {};

// ===== TAB: Data Siswa =====
const formSiswa = document.getElementById('formSiswa');
const siswaMsg = document.getElementById('siswaMsg');
const siswaSubmitBtn = document.getElementById('siswaSubmitBtn');
const siswaCancelBtn = document.getElementById('siswaCancelBtn');
const siswaEditingKey = document.getElementById('siswaEditingKey');

function showMsg(el, text, type) {
  el.textContent = text;
  el.className = 'msg ' + type;
  setTimeout(function () { el.textContent = ''; el.className = 'msg'; }, 3000);
}

function resetFormSiswa() {
  formSiswa.reset();
  siswaEditingKey.value = '';
  document.getElementById('siswaNisn').disabled = false;
  siswaSubmitBtn.textContent = 'Tambah Siswa';
  siswaCancelBtn.classList.add('hidden');
}

formSiswa.addEventListener('submit', function (e) {
  e.preventDefault();

  const nisn = document.getElementById('siswaNisn').value.trim();
  const nama = document.getElementById('siswaNama').value.trim();
  const kelas = document.getElementById('siswaKelas').value.trim();
  const password = document.getElementById('siswaPassword').value;

  db.ref('siswa/' + nisn).set({ nama, kelas, password })
    .then(function () {
      showMsg(siswaMsg, siswaEditingKey.value ? 'Data siswa diperbarui.' : 'Siswa ditambahkan.', 'success');
      resetFormSiswa();
    })
    .catch(function (err) {
      showMsg(siswaMsg, 'Gagal menyimpan: ' + err.message, 'error');
    });
});

siswaCancelBtn.addEventListener('click', resetFormSiswa);

function editSiswa(nisn) {
  const data = siswaCache[nisn];
  if (!data) return;
  document.getElementById('siswaNisn').value = nisn;
  document.getElementById('siswaNisn').disabled = true; // NISN jadi key, jangan diubah pas edit
  document.getElementById('siswaNama').value = data.nama || '';
  document.getElementById('siswaKelas').value = data.kelas || '';
  document.getElementById('siswaPassword').value = data.password || '';
  siswaEditingKey.value = nisn;
  siswaSubmitBtn.textContent = 'Simpan Perubahan';
  siswaCancelBtn.classList.remove('hidden');
  document.getElementById('tab-siswa').scrollIntoView({ behavior: 'smooth' });
}

function hapusSiswa(nisn) {
  if (!confirm('Hapus siswa dengan NISN ' + nisn + '? Mapping kartu yang terhubung tidak otomatis terhapus.')) return;
  db.ref('siswa/' + nisn).remove()
    .then(function () { showMsg(siswaMsg, 'Siswa dihapus.', 'success'); })
    .catch(function (err) { showMsg(siswaMsg, 'Gagal menghapus: ' + err.message, 'error'); });
}

function renderSiswaTable(data) {
  const tbody = document.getElementById('siswaTableBody');
  const selectKartu = document.getElementById('kartuNisn');
  const selectSimulasi = document.getElementById('simulasiNisn');
  const selectPelajaranKelas = document.getElementById('pelajaranKelas');
  const kelasSebelumnya = selectPelajaranKelas.value;
  tbody.innerHTML = '';
  selectKartu.innerHTML = '<option value="">-- Pilih siswa --</option>';
  selectSimulasi.innerHTML = '<option value="">-- Pilih siswa --</option>';

  const nisnList = Object.keys(data).sort();
  if (nisnList.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="color:#999;">Belum ada data siswa.</td></tr>';
    selectPelajaranKelas.innerHTML = '<option value="">-- Belum ada kelas --</option>';
    return;
  }

  const kelasSet = new Set();

  nisnList.forEach(function (nisn) {
    const s = data[nisn];
    kelasSet.add(s.kelas);
    const tr = document.createElement('tr');
    tr.innerHTML = '<td>' + nisn + '</td><td>' + s.nama + '</td><td>' + s.kelas + '</td><td class="row-actions"></td>';
    const actionsTd = tr.querySelector('.row-actions');

    const editBtn = document.createElement('button');
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', function () { editSiswa(nisn); });

    const delBtn = document.createElement('button');
    delBtn.textContent = 'Hapus';
    delBtn.className = 'btn-danger';
    delBtn.addEventListener('click', function () { hapusSiswa(nisn); });

    actionsTd.appendChild(editBtn);
    actionsTd.appendChild(delBtn);
    tbody.appendChild(tr);

    const opt = document.createElement('option');
    opt.value = nisn;
    opt.textContent = nisn + ' - ' + s.nama;
    selectKartu.appendChild(opt);

    const optSim = document.createElement('option');
    optSim.value = nisn;
    optSim.textContent = nisn + ' - ' + s.nama + ' (' + s.kelas + ')';
    selectSimulasi.appendChild(optSim);
  });

  selectPelajaranKelas.innerHTML = '';
  Array.from(kelasSet).sort().forEach(function (kelas) {
    const opt = document.createElement('option');
    opt.value = kelas;
    opt.textContent = kelas;
    selectPelajaranKelas.appendChild(opt);
  });
  // pertahanin kelas yang lagi dipilih user kalau masih ada di list
  if (kelasSet.has(kelasSebelumnya)) selectPelajaranKelas.value = kelasSebelumnya;

  // kelas yang lagi aktif berubah (termasuk pas pertama kali kebaca) -> attach listener jadwal pelajarannya
  if (selectPelajaranKelas.value !== kelasSebelumnya) {
    pasangListenerPelajaran(selectPelajaranKelas.value);
  }
}

db.ref('siswa').on('value', function (snapshot) {
  siswaCache = snapshot.val() || {};
  renderSiswaTable(siswaCache);
  renderKartuTable(kartuCache); // refresh nama siswa di tabel kartu kalau data siswa berubah
});

// ===== TAB: Mapping Kartu NFC =====
// Struktur data (BARU): kartu/{id_kartu} = { nisn, device_id }
// device_id dipakai anti-cloning: kartu cuma diterima kalau device yang scan cocok.
const formKartu = document.getElementById('formKartu');
const kartuMsg = document.getElementById('kartuMsg');
let kartuCache = {};

formKartu.addEventListener('submit', function (e) {
  e.preventDefault();

  const idKartu = document.getElementById('kartuId').value.trim();
  const nisn = document.getElementById('kartuNisn').value;
  const deviceId = document.getElementById('kartuDeviceId').value.trim();

  if (!nisn) {
    showMsg(kartuMsg, 'Pilih siswa dulu.', 'error');
    return;
  }

  const payload = { nisn: nisn };
  if (deviceId) payload.device_id = deviceId;

  db.ref('kartu/' + idKartu).set(payload)
    .then(function () {
      showMsg(kartuMsg, 'Mapping kartu disimpan.', 'success');
      formKartu.reset();
    })
    .catch(function (err) {
      showMsg(kartuMsg, 'Gagal menyimpan: ' + err.message, 'error');
    });
});

function hapusKartu(idKartu) {
  if (!confirm('Hapus mapping kartu ' + idKartu + '?')) return;
  db.ref('kartu/' + idKartu).remove()
    .then(function () { showMsg(kartuMsg, 'Mapping dihapus.', 'success'); })
    .catch(function (err) { showMsg(kartuMsg, 'Gagal menghapus: ' + err.message, 'error'); });
}

function lepasDeviceKartu(idKartu) {
  if (!confirm('Lepas ikatan device dari kartu ' + idKartu + '? Kartu ini nanti akan otomatis terikat ke device berikutnya yang dipakai buat tap.')) return;
  db.ref('kartu/' + idKartu + '/device_id').remove()
    .then(function () { showMsg(kartuMsg, 'Ikatan device dilepas.', 'success'); })
    .catch(function (err) { showMsg(kartuMsg, 'Gagal: ' + err.message, 'error'); });
}

function renderKartuTable(data) {
  const tbody = document.getElementById('kartuTableBody');
  tbody.innerHTML = '';

  const idList = Object.keys(data).sort();
  if (idList.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="color:#999;">Belum ada mapping kartu.</td></tr>';
    return;
  }

  idList.forEach(function (idKartu) {
    // dukung data lama yang masih format string polos (nisn doang, tanpa device_id)
    const raw = data[idKartu];
    const nisn = typeof raw === 'string' ? raw : raw.nisn;
    const deviceId = typeof raw === 'string' ? null : raw.device_id;
    const nama = (siswaCache[nisn] && siswaCache[nisn].nama) || '(siswa tidak ditemukan)';

    const tr = document.createElement('tr');
    tr.innerHTML = '<td>' + idKartu + '</td><td>' + nisn + '</td><td>' + nama + '</td>' +
      '<td>' + (deviceId ? deviceId : '<span style="color:#999;">belum terikat</span>') + '</td>' +
      '<td class="row-actions"></td>';

    const actionsTd = tr.querySelector('.row-actions');

    if (deviceId) {
      const lepasBtn = document.createElement('button');
      lepasBtn.textContent = 'Lepas Device';
      lepasBtn.className = 'btn-secondary';
      lepasBtn.addEventListener('click', function () { lepasDeviceKartu(idKartu); });
      actionsTd.appendChild(lepasBtn);
    }

    const delBtn = document.createElement('button');
    delBtn.textContent = 'Hapus';
    delBtn.className = 'btn-danger';
    delBtn.addEventListener('click', function () { hapusKartu(idKartu); });
    actionsTd.appendChild(delBtn);

    tbody.appendChild(tr);
  });
}

db.ref('kartu').on('value', function (snapshot) {
  kartuCache = snapshot.val() || {};
  renderKartuTable(kartuCache);
});

// ===== TAB: Jadwal Pulang =====
// Struktur data: jadwal/{kelas} = "HH:MM"
const formJadwal = document.getElementById('formJadwal');
const jadwalMsg = document.getElementById('jadwalMsg');

formJadwal.addEventListener('submit', function (e) {
  e.preventDefault();

  const kelas = document.getElementById('jadwalKelas').value.trim();
  const jam = document.getElementById('jadwalJam').value;

  db.ref('jadwal/' + kelas).set(jam)
    .then(function () {
      showMsg(jadwalMsg, 'Jadwal pulang kelas ' + kelas + ' disimpan.', 'success');
      formJadwal.reset();
    })
    .catch(function (err) {
      showMsg(jadwalMsg, 'Gagal menyimpan: ' + err.message, 'error');
    });
});

function hapusJadwal(kelas) {
  if (!confirm('Hapus jadwal pulang kelas ' + kelas + '?')) return;
  db.ref('jadwal/' + kelas).remove()
    .then(function () { showMsg(jadwalMsg, 'Jadwal dihapus.', 'success'); })
    .catch(function (err) { showMsg(jadwalMsg, 'Gagal menghapus: ' + err.message, 'error'); });
}

function renderJadwalTable(data) {
  const tbody = document.getElementById('jadwalTableBody');
  tbody.innerHTML = '';

  const kelasList = Object.keys(data).sort();
  if (kelasList.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="color:#999;">Belum ada jadwal pulang.</td></tr>';
    return;
  }

  kelasList.forEach(function (kelas) {
    const jam = data[kelas];
    const tr = document.createElement('tr');
    tr.innerHTML = '<td>' + kelas + '</td><td>' + jam + '</td><td class="row-actions"></td>';

    const delBtn = document.createElement('button');
    delBtn.textContent = 'Hapus';
    delBtn.className = 'btn-danger';
    delBtn.addEventListener('click', function () { hapusJadwal(kelas); });

    tr.querySelector('.row-actions').appendChild(delBtn);
    tbody.appendChild(tr);
  });
}

db.ref('jadwal').on('value', function (snapshot) {
  renderJadwalTable(snapshot.val() || {});
});

// ===== TAB: Jadwal Pelajaran =====
// Struktur data: jadwal_pelajaran/{kelas}/{jam_ke} = { mapel, mulai: "HH:MM", selesai: "HH:MM" }
const formPelajaran = document.getElementById('formPelajaran');
const pelajaranMsg = document.getElementById('pelajaranMsg');
const pelajaranKelasSelect = document.getElementById('pelajaranKelas');

formPelajaran.addEventListener('submit', function (e) {
  e.preventDefault();

  const kelas = pelajaranKelasSelect.value;
  if (!kelas) {
    showMsg(pelajaranMsg, 'Belum ada kelas terdaftar -- tambahin data siswa dulu di tab Data Siswa.', 'error');
    return;
  }

  const jamKe = document.getElementById('pelajaranJamKe').value.trim();
  const mapel = document.getElementById('pelajaranMapel').value.trim();
  const mulai = document.getElementById('pelajaranMulai').value;
  const selesai = document.getElementById('pelajaranSelesai').value;

  if (mulai >= selesai) {
    showMsg(pelajaranMsg, 'Jam selesai harus lebih besar dari jam mulai.', 'error');
    return;
  }

  db.ref('jadwal_pelajaran/' + kelas + '/' + jamKe).set({ mapel, mulai, selesai })
    .then(function () {
      showMsg(pelajaranMsg, 'Jam ke-' + jamKe + ' buat kelas ' + kelas + ' disimpan.', 'success');
      formPelajaran.reset();
    })
    .catch(function (err) {
      showMsg(pelajaranMsg, 'Gagal menyimpan: ' + err.message, 'error');
    });
});

function hapusPelajaran(kelas, jamKe) {
  if (!confirm('Hapus jam ke-' + jamKe + ' dari kelas ' + kelas + '?')) return;
  db.ref('jadwal_pelajaran/' + kelas + '/' + jamKe).remove()
    .then(function () { showMsg(pelajaranMsg, 'Jam ke-' + jamKe + ' dihapus.', 'success'); })
    .catch(function (err) { showMsg(pelajaranMsg, 'Gagal menghapus: ' + err.message, 'error'); });
}

function renderPelajaranTable(kelas, data) {
  const tbody = document.getElementById('pelajaranTableBody');
  tbody.innerHTML = '';

  if (!data) {
    tbody.innerHTML = '<tr><td colspan="5" style="color:#999;">Belum ada jadwal pelajaran buat kelas ' + kelas + '.</td></tr>';
    return;
  }

  const jamKeList = Object.keys(data).sort(function (a, b) { return Number(a) - Number(b); });
  jamKeList.forEach(function (jamKe) {
    const p = data[jamKe];
    const tr = document.createElement('tr');
    tr.innerHTML = '<td>' + jamKe + '</td><td>' + p.mapel + '</td><td>' + p.mulai + '</td><td>' + p.selesai + '</td><td class="row-actions"></td>';

    const delBtn = document.createElement('button');
    delBtn.textContent = 'Hapus';
    delBtn.className = 'btn-danger';
    delBtn.addEventListener('click', function () { hapusPelajaran(kelas, jamKe); });

    tr.querySelector('.row-actions').appendChild(delBtn);
    tbody.appendChild(tr);
  });
}

let pelajaranListenerAktif = null; // buat detach listener lama pas ganti kelas

function pasangListenerPelajaran(kelas) {
  if (pelajaranListenerAktif) {
    db.ref('jadwal_pelajaran/' + pelajaranListenerAktif.kelas).off('value', pelajaranListenerAktif.callback);
  }
  if (!kelas) {
    renderPelajaranTable(kelas, null);
    return;
  }
  const callback = function (snapshot) {
    renderPelajaranTable(kelas, snapshot.val());
  };
  db.ref('jadwal_pelajaran/' + kelas).on('value', callback);
  pelajaranListenerAktif = { kelas, callback };
}

pelajaranKelasSelect.addEventListener('change', function () {
  pasangListenerPelajaran(pelajaranKelasSelect.value);
});

// ===== TAB: Simulasi Absen =====
// Buat siswa yang belum kebagian kartu NFC fisik. Nulis data PERSIS kayak
// alur absensi.py asli (absensi/{nisn} + presensi_jam/{kelas}/{tanggal}/{jam_ke}/{nisn}),
// jadi hasilnya kebaca sama di dashboard ortu maupun Presensi Live.
const simulasiBtn = document.getElementById('simulasiBtn');
const simulasiMsg = document.getElementById('simulasiMsg');
const simulasiInfoJam = document.getElementById('simulasiInfoJam');

simulasiBtn.addEventListener('click', function () {
  const nisn = document.getElementById('simulasiNisn').value;
  const status = document.getElementById('simulasiStatus').value;

  if (!nisn) {
    showMsg(simulasiMsg, 'Pilih siswa dulu.', 'error');
    return;
  }

  const siswa = siswaCache[nisn];
  const kelas = siswa && siswa.kelas;
  simulasiBtn.disabled = true;

  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const tanggal = tanggalHariIni();
  const waktu = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

  const tulisAbsensi = function (jamKeInfo) {
    const entry = { tanggal, waktu, status };
    if (jamKeInfo) entry.jam_ke = jamKeInfo.jam_ke;

    const tugas = [db.ref('absensi/' + nisn).push(entry)];
    if (kelas && jamKeInfo) {
      tugas.push(db.ref('presensi_jam/' + kelas + '/' + tanggal + '/' + jamKeInfo.jam_ke + '/' + nisn).set({ waktu, status }));
    }

    Promise.all(tugas)
      .then(function () {
        showMsg(simulasiMsg, 'Absen ' + siswa.nama + ' berhasil disimulasikan (' + status + ', ' + waktu + ').', 'success');
        simulasiInfoJam.textContent = jamKeInfo
          ? 'Tercatat sebagai jam ke-' + jamKeInfo.jam_ke + ' (' + jamKeInfo.mapel + ').'
          : 'Nggak lagi ada jam pelajaran aktif buat kelas ' + kelas + ' sekarang, tercatat tanpa jam_ke.';
      })
      .catch(function (err) {
        showMsg(simulasiMsg, 'Gagal: ' + err.message, 'error');
      })
      .finally(function () {
        simulasiBtn.disabled = false;
      });
  };

  if (!kelas) {
    tulisAbsensi(null);
    return;
  }

  db.ref('jadwal_pelajaran/' + kelas).once('value').then(function (snapshot) {
    const jamKeInfo = cariJamKeAktif(snapshot.val(), jamSekarang());
    tulisAbsensi(jamKeInfo);
  }).catch(function (err) {
    simulasiBtn.disabled = false;
    showMsg(simulasiMsg, 'Gagal ambil jadwal pelajaran: ' + err.message, 'error');
  });
});
