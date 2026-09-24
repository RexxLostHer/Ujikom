// ===== PERIJINAN MODULE =====
// Submit izin, upload surat, chat dengan admin

// Jenis perijinan
const JENIS_PERIJINAN = {
  sakit: { label: 'Sakit', icon: '🤒', dokumenWajib: false },
  dispensasi: { label: 'Dispensasi', icon: '📄', dokumenWajib: true },
  ijin_kegiatan: { label: 'Ijin Kegiatan', icon: '🏆', dokumenWajib: true }
};

const STATUS_LABEL = {
  pending: { label: 'Menunggu Respon', color: '#d97706', bg: '#fef3c7' },
  disetujui: { label: 'Disetujui ✓', color: '#059669', bg: '#ecfdf5' },
  ditolak: { label: 'Ditolak ✗', color: '#dc2626', bg: '#fef2f2' }
};

// Submit perijinan baru
async function submitPerijinan(user, jenis, alasan, tanggal, fileInput) {
  const perijinanRef = db.ref('perijinan').push();
  const pid = perijinanRef.key;
  let dokumen_url = null;

  // Upload dokumen jika ada (Firebase Storage)
  if (fileInput && fileInput.files && fileInput.files[0]) {
    try {
      const file = fileInput.files[0];
      if (file.size > 5 * 1024 * 1024) throw new Error('Ukuran file maksimal 5MB');
      const storageRef = firebase.storage().ref('surat/' + pid + '_' + file.name);
      const uploadTask = await storageRef.put(file);
      dokumen_url = await uploadTask.ref.getDownloadURL();
    } catch (e) {
      throw new Error('Gagal upload dokumen: ' + e.message);
    }
  }

  const data = {
    pid: pid,
    uid: user.uid,
    nisn: user.nisn || '',
    nama: user.nama,
    kelas: user.kelas || '',
    jenis: jenis,
    alasan: alasan,
    tanggal: tanggal,
    status: 'pending',
    dokumen_url: dokumen_url,
    dibuat_pada: Date.now()
  };

  await perijinanRef.set(data);

  // Kirim pesan pertama di chat (auto)
  await kirimChatPerijinan(pid, user, 'Saya mengajukan ' + JENIS_PERIJINAN[jenis].label + ': ' + alasan);

  return pid;
}

// Kirim pesan chat di thread perijinan
async function kirimChatPerijinan(pid, user, pesan) {
  await db.ref('chat_perijinan/' + pid).push({
    pengirim: user.role === 'admin' ? 'admin' : 'siswa',
    nama_pengirim: user.nama,
    pesan: pesan,
    waktu: Date.now()
  });
}

// Render daftar perijinan saya
function renderDaftarPerijinanSaya(containerId, user) {
  const container = document.getElementById(containerId);
  if (!container) return;

  db.ref('perijinan').orderByChild('uid').equalTo(user.uid).on('value', function(snapshot) {
    const data = snapshot.val() || {};
    const list = Object.values(data).sort((a, b) => b.dibuat_pada - a.dibuat_pada);
    container.innerHTML = '';

    if (list.length === 0) {
      container.innerHTML = '<p class="kosong-msg">Belum ada pengajuan perijinan.</p>';
      return;
    }

    list.forEach(function(p) {
      const st = STATUS_LABEL[p.status] || STATUS_LABEL.pending;
      const jn = JENIS_PERIJINAN[p.jenis] || { label: p.jenis, icon: '📋' };
      const el = document.createElement('div');
      el.className = 'perijinan-card';
      el.innerHTML =
        '<div class="perijinan-card-top">' +
          '<span class="perijinan-jenis">' + jn.icon + ' ' + jn.label + '</span>' +
          '<span class="perijinan-status-pill" style="background:' + st.bg + ';color:' + st.color + ';">' + st.label + '</span>' +
        '</div>' +
        '<div class="perijinan-tanggal">📅 ' + p.tanggal + '</div>' +
        '<div class="perijinan-alasan">' + p.alasan + '</div>' +
        (p.dokumen_url ? '<a class="perijinan-dok-link" href="' + p.dokumen_url + '" target="_blank">📎 Lihat Dokumen</a>' : '') +
        '<button class="btn-chat-open" onclick="bukaModalChat(\'' + p.pid + '\', \'' + p.nama + '\')">💬 Lihat / Balas Chat</button>';
      container.appendChild(el);
    });
  });
}

// Render daftar semua perijinan (admin)
function renderDaftarPerijinanAdmin(containerId, filterStatus) {
  const container = document.getElementById(containerId);
  if (!container) return;

  let ref = db.ref('perijinan');
  if (filterStatus && filterStatus !== 'semua') {
    ref = ref.orderByChild('status').equalTo(filterStatus);
  }

  ref.on('value', function(snapshot) {
    const data = snapshot.val() || {};
    const list = Object.values(data).sort((a, b) => b.dibuat_pada - a.dibuat_pada);
    container.innerHTML = '';

    const filtered = filterStatus && filterStatus !== 'semua'
      ? list.filter(p => p.status === filterStatus)
      : list;

    if (filtered.length === 0) {
      container.innerHTML = '<p class="kosong-msg">Tidak ada perijinan ' + (filterStatus === 'pending' ? 'yang menunggu respon' : '') + '.</p>';
      return;
    }

    filtered.forEach(function(p) {
      const st = STATUS_LABEL[p.status] || STATUS_LABEL.pending;
      const jn = JENIS_PERIJINAN[p.jenis] || { label: p.jenis, icon: '📋' };
      const el = document.createElement('div');
      el.className = 'perijinan-card admin-card';
      el.innerHTML =
        '<div class="perijinan-card-top">' +
          '<div>' +
            '<span class="perijinan-nama-siswa">' + p.nama + '</span>' +
            '<span class="perijinan-kelas-badge">' + (p.kelas || '-') + '</span>' +
          '</div>' +
          '<span class="perijinan-status-pill" style="background:' + st.bg + ';color:' + st.color + ';">' + st.label + '</span>' +
        '</div>' +
        '<div class="perijinan-jenis">' + jn.icon + ' ' + jn.label + ' — 📅 ' + p.tanggal + '</div>' +
        '<div class="perijinan-alasan">' + p.alasan + '</div>' +
        (p.dokumen_url ? '<a class="perijinan-dok-link" href="' + p.dokumen_url + '" target="_blank">📎 Lihat Dokumen/Surat</a>' : '') +
        '<div class="admin-action-row">' +
          (p.status === 'pending'
            ? '<button class="btn-approve" onclick="adminApprove(\'' + p.pid + '\', \'' + p.nisn + '\', \'' + p.tanggal + '\', \'' + p.jenis + '\')">✅ Setujui</button>' +
              '<button class="btn-tolak" onclick="adminTolak(\'' + p.pid + '\')">❌ Tolak</button>'
            : '') +
          '<button class="btn-chat-open" onclick="bukaModalChat(\'' + p.pid + '\', \'' + p.nama + '\')">💬 Chat</button>' +
        '</div>';
      container.appendChild(el);
    });
  });
}

// Admin: approve perijinan → update status + update presensi_jam
async function adminApprove(pid, nisn, tanggal, jenis) {
  const adminUser = getSessionUser();
  if (!adminUser) return;

  await db.ref('perijinan/' + pid + '/status').set('disetujui');
  await kirimChatPerijinan(pid, adminUser, 'Perijinan Anda telah DISETUJUI. Kehadiran Anda tercatat sebagai ' + (JENIS_PERIJINAN[jenis]?.label || jenis) + '.');

  // Update presensi_jam semua jam pada tanggal tersebut
  if (nisn && tanggal) {
    // Cari kelas siswa
    const siswaSnap = await db.ref('siswa/' + nisn).once('value');
    const siswa = siswaSnap.val();
    if (siswa && siswa.kelas) {
      const kelas = siswa.kelas;
      const jadwalSnap = await db.ref('jadwal_pelajaran/' + kelas).once('value');
      const jadwal = jadwalSnap.val() || {};
      const jamList = Object.keys(jadwal);
      const updates = {};
      jamList.forEach(function(jamKe) {
        updates['presensi_jam/' + kelas + '/' + tanggal + '/' + jamKe + '/' + nisn] = {
          status: jenis,
          waktu: '00:00:00'
        };
      });
      if (Object.keys(updates).length > 0) {
        await db.ref().update(updates);
      }
    }
  }
  alert('Perijinan disetujui dan status kehadiran diperbarui.');
}

// Admin: tolak perijinan
async function adminTolak(pid) {
  const adminUser = getSessionUser();
  if (!adminUser) return;
  const alasan = prompt('Alasan penolakan (opsional):') || 'Perijinan ditolak.';
  await db.ref('perijinan/' + pid + '/status').set('ditolak');
  await kirimChatPerijinan(pid, adminUser, 'Maaf, perijinan Anda DITOLAK. ' + alasan);
  alert('Perijinan ditolak.');
}

// ===== MODAL CHAT =====
let chatListener = null;
let chatPidAktif = null;

function bukaModalChat(pid, namaSiswa) {
  chatPidAktif = pid;
  document.getElementById('modalChatJudul').textContent = '💬 Chat — ' + namaSiswa;
  document.getElementById('modalChat').style.display = 'flex';
  renderChat(pid);
}

function tutupModalChat() {
  if (chatListener) {
    db.ref('chat_perijinan/' + chatPidAktif).off('value', chatListener);
    chatListener = null;
  }
  chatPidAktif = null;
  document.getElementById('modalChat').style.display = 'none';
}

function renderChat(pid) {
  const container = document.getElementById('chatBubbleContainer');
  container.innerHTML = '';

  if (chatListener) {
    db.ref('chat_perijinan/' + chatPidAktif).off('value', chatListener);
  }

  const user = getSessionUser();
  chatListener = function(snapshot) {
    const data = snapshot.val() || {};
    const pesan = Object.values(data).sort((a, b) => a.waktu - b.waktu);
    container.innerHTML = '';
    pesan.forEach(function(m) {
      const isSaya = (user.role === 'admin' && m.pengirim === 'admin') ||
                     (user.role !== 'admin' && m.pengirim === 'siswa');
      const bubble = document.createElement('div');
      bubble.className = 'chat-bubble ' + (isSaya ? 'saya' : 'lawan');
      const waktu = new Date(m.waktu).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      bubble.innerHTML =
        '<div class="chat-nama">' + m.nama_pengirim + '</div>' +
        '<div class="chat-pesan">' + m.pesan + '</div>' +
        '<div class="chat-waktu">' + waktu + '</div>';
      container.appendChild(bubble);
    });
    container.scrollTop = container.scrollHeight;
  };
  db.ref('chat_perijinan/' + pid).on('value', chatListener);
}

function kirimPesanChat() {
  const input = document.getElementById('chatInputPesan');
  const pesan = input.value.trim();
  if (!pesan || !chatPidAktif) return;
  const user = getSessionUser();
  kirimChatPerijinan(chatPidAktif, user, pesan);
  input.value = '';
}
