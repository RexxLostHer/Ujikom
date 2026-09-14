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
  tbody.innerHTML = '';
  selectKartu.innerHTML = '<option value="">-- Pilih siswa --</option>';

  const nisnList = Object.keys(data).sort();
  if (nisnList.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="color:#999;">Belum ada data siswa.</td></tr>';
    return;
  }

  nisnList.forEach(function (nisn) {
    const s = data[nisn];
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
  });
}

db.ref('siswa').on('value', function (snapshot) {
  siswaCache = snapshot.val() || {};
  renderSiswaTable(siswaCache);
  renderKartuTable(kartuCache); // refresh nama siswa di tabel kartu kalau data siswa berubah
});

// ===== TAB: Mapping Kartu NFC =====
// Struktur data: kartu/{id_kartu} = nisn
const formKartu = document.getElementById('formKartu');
const kartuMsg = document.getElementById('kartuMsg');
let kartuCache = {};

formKartu.addEventListener('submit', function (e) {
  e.preventDefault();

  const idKartu = document.getElementById('kartuId').value.trim();
  const nisn = document.getElementById('kartuNisn').value;

  if (!nisn) {
    showMsg(kartuMsg, 'Pilih siswa dulu.', 'error');
    return;
  }

  db.ref('kartu/' + idKartu).set(nisn)
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

function renderKartuTable(data) {
  const tbody = document.getElementById('kartuTableBody');
  tbody.innerHTML = '';

  const idList = Object.keys(data).sort();
  if (idList.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="color:#999;">Belum ada mapping kartu.</td></tr>';
    return;
  }

  idList.forEach(function (idKartu) {
    const nisn = data[idKartu];
    const nama = (siswaCache[nisn] && siswaCache[nisn].nama) || '(siswa tidak ditemukan)';
    const tr = document.createElement('tr');
    tr.innerHTML = '<td>' + idKartu + '</td><td>' + nisn + '</td><td>' + nama + '</td><td class="row-actions"></td>';

    const delBtn = document.createElement('button');
    delBtn.textContent = 'Hapus';
    delBtn.className = 'btn-danger';
    delBtn.addEventListener('click', function () { hapusKartu(idKartu); });

    tr.querySelector('.row-actions').appendChild(delBtn);
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
