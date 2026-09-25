// ===== PERIJINAN MODULE =====
// Submit ijin, upload surat, chat dengan admin

const JENIS_PERIJINAN = {
  sakit: { label: 'Sakit', icon: '🤒', dokumenWajib: false },
  dispensasi: { label: 'Dispensasi', icon: '📄', dokumenWajib: true },
  ijin_kegiatan: { label: 'Ijin Kegiatan', icon: '🏆', dokumenWajib: true }
};

// ===================================================================
// SUBMIT PERIJINAN BARU
// ===================================================================
async function submitPerijinan(user, jenis, alasan, tanggal, fileInput) {
  const perijinanRef = db.ref('perijinan').push();
  const pid = perijinanRef.key;
  let dokumen_url = null;

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
    pid, uid: user.uid,
    nisn: user.nisn || '',
    nama: user.nama,
    kelas: user.kelas || '',
    jenis, alasan, tanggal,
    status: 'pending',
    dokumen_url,
    dibuat_pada: Date.now()
  };

  await perijinanRef.set(data);
  await kirimChatPerijinan(pid, user, 'Saya mengajukan ' + (JENIS_PERIJINAN[jenis]?.label || jenis) + ': ' + alasan);
  return pid;
}

// ===================================================================
// CHAT PERIJINAN
// ===================================================================
async function kirimChatPerijinan(pid, user, pesan) {
  await db.ref('chat_perijinan/' + pid).push({
    pengirim: user.role === 'admin' ? 'admin' : 'siswa',
    nama_pengirim: user.nama,
    pesan,
    waktu: Date.now()
  });
}

// ===================================================================
// RENDER PERIJINAN — USER (dashboard)
// ===================================================================
function renderDaftarPerijinanSaya(containerId, user) {
  const container = document.getElementById(containerId);
  if (!container) return;

  db.ref('perijinan').orderByChild('uid').equalTo(user.uid).on('value', function (snapshot) {
    const data = snapshot.val() || {};
    const list = Object.values(data).sort((a, b) => b.dibuat_pada - a.dibuat_pada);
    container.innerHTML = '';

    if (list.length === 0) {
      container.innerHTML = '<p style="color:#94a3b8;font-size:14px;text-align:center;padding:24px;">Belum ada pengajuan perijinan.</p>';
      return;
    }

    list.forEach(function (p) {
      const jn = JENIS_PERIJINAN[p.jenis] || { label: p.jenis, icon: '📋' };
      const statusLabel = p.status === 'disetujui' ? '✅ Disetujui' : p.status === 'ditolak' ? '❌ Ditolak' : '⏳ Menunggu';
      const el = document.createElement('div');
      el.className = 'perijinan-card status-' + (p.status || 'pending');
      el.innerHTML =
        '<div class="perijinan-card-top">' +
          '<span class="perijinan-jenis-badge">' + jn.icon + ' ' + jn.label + '</span>' +
          '<span class="status-pill ' + (p.status || 'pending') + '">' + statusLabel + '</span>' +
        '</div>' +
        '<div class="perijinan-meta">📅 Tanggal: <strong>' + p.tanggal + '</strong></div>' +
        '<div class="perijinan-alasan-box">' + p.alasan + '</div>' +
        (p.dokumen_url ? '<a class="perijinan-dok-link" href="' + p.dokumen_url + '" target="_blank">📎 Lihat Dokumen</a>' : '') +
        '<div class="action-row"><button class="btn-chat" onclick="bukaModalChat(\'' + p.pid + '\', \'' + p.nama + '\')">💬 Chat Admin</button></div>';
      container.appendChild(el);
    });
  });
}

// ===================================================================
// RENDER PERIJINAN — ADMIN
// ===================================================================
function renderDaftarPerijinanAdmin(containerId, filterStatus) {
  const container = document.getElementById(containerId);
  if (!container) return;

  let ref = db.ref('perijinan');
  if (filterStatus && filterStatus !== 'semua') {
    ref = ref.orderByChild('status').equalTo(filterStatus);
  }

  ref.on('value', function (snapshot) {
    const data = snapshot.val() || {};
    const list = Object.values(data).sort((a, b) => b.dibuat_pada - a.dibuat_pada);
    container.innerHTML = '';

    const filtered = filterStatus && filterStatus !== 'semua'
      ? list.filter(p => p.status === filterStatus)
      : list;

    if (filtered.length === 0) {
      container.innerHTML =
        '<div class="empty-state">' +
          '<div class="empty-icon">📋</div>' +
          '<p>' + (filterStatus === 'pending' ? 'Tidak ada perijinan yang menunggu. 🎉' : 'Belum ada data perijinan.') + '</p>' +
        '</div>';
      return;
    }

    filtered.forEach(function (p) {
      const jn = JENIS_PERIJINAN[p.jenis] || { label: p.jenis, icon: '📋' };
      const statusLabel = p.status === 'disetujui' ? '✅ Disetujui' : p.status === 'ditolak' ? '❌ Ditolak' : '⏳ Menunggu';

      const el = document.createElement('div');
      el.className = 'perijinan-card status-' + (p.status || 'pending');
      el.innerHTML =
        '<div class="perijinan-card-top">' +
          '<div>' +
            '<span class="perijinan-nama">' + p.nama + '</span>' +
            '<span class="perijinan-kelas-tag">' + (p.kelas || '-') + '</span>' +
          '</div>' +
          '<span class="status-pill ' + (p.status || 'pending') + '">' + statusLabel + '</span>' +
        '</div>' +
        '<div class="perijinan-jenis-badge">' + jn.icon + ' ' + jn.label + '</div>' +
        '<div class="perijinan-meta">📅 Tanggal: <strong>' + p.tanggal + '</strong></div>' +
        '<div class="perijinan-alasan-box">' + p.alasan + '</div>' +
        (p.dokumen_url
          ? '<a class="perijinan-dok-link" href="' + p.dokumen_url + '" target="_blank">📎 Lihat Dokumen/Surat</a>'
          : '') +
        '<div class="action-row">' +
          (p.status === 'pending'
            ? '<button class="btn-approve" onclick="adminApprove(\'' + p.pid + '\', \'' + p.nisn + '\', \'' + p.tanggal + '\', \'' + p.jenis + '\')">✅ Setujui</button>' +
              '<button class="btn-tolak" onclick="adminTolak(\'' + p.pid + '\')">❌ Tolak</button>'
            : '') +
          '<button class="btn-chat" onclick="bukaModalChat(\'' + p.pid + '\', \'' + p.nama + '\')">💬 Chat</button>' +
        '</div>';
      container.appendChild(el);
    });
  });
}

// ===================================================================
// APPROVE / TOLAK
// ===================================================================
async function adminApprove(pid, nisn, tanggal, jenis) {
  const adminUser = getSessionUser();
  if (!adminUser) return;

  await db.ref('perijinan/' + pid + '/status').set('disetujui');
  await kirimChatPerijinan(pid, adminUser,
    'Perijinan Anda telah DISETUJUI ✅. Kehadiran tercatat sebagai ' + (JENIS_PERIJINAN[jenis]?.label || jenis) + '.');

  if (nisn && tanggal) {
    const siswaSnap = await db.ref('siswa/' + nisn).once('value');
    const siswa = siswaSnap.val();
    if (siswa && siswa.kelas) {
      const kelas = siswa.kelas;
      const jadwalSnap = await db.ref('jadwal_pelajaran/' + kelas).once('value');
      const jadwal = jadwalSnap.val() || {};
      const updates = {};
      Object.keys(jadwal).forEach(function (jamKe) {
        updates['presensi_jam/' + kelas + '/' + tanggal + '/' + jamKe + '/' + nisn] = {
          status: jenis,
          waktu: '00:00:00'
        };
      });
      if (Object.keys(updates).length > 0) await db.ref().update(updates);
    }
  }
}

async function adminTolak(pid) {
  const adminUser = getSessionUser();
  if (!adminUser) return;
  const alasan = prompt('Alasan penolakan (opsional):') || 'Perijinan ditolak.';
  await db.ref('perijinan/' + pid + '/status').set('ditolak');
  await kirimChatPerijinan(pid, adminUser, 'Maaf, perijinan Anda DITOLAK ❌. ' + alasan);
}

// ===================================================================
// MODAL CHAT
// ===================================================================
let chatListener = null;
let chatPidAktif = null;

function bukaModalChat(pid, namaSiswa) {
  chatPidAktif = pid;
  const judul = document.getElementById('modalChatJudul');
  if (judul) judul.textContent = '💬 Chat — ' + namaSiswa;
  const overlay = document.getElementById('modalChat');
  if (overlay) overlay.classList.add('open');
  renderChat(pid);
}

function tutupModalChat() {
  if (chatListener && chatPidAktif) {
    db.ref('chat_perijinan/' + chatPidAktif).off('value', chatListener);
    chatListener = null;
  }
  chatPidAktif = null;
  const overlay = document.getElementById('modalChat');
  if (overlay) overlay.classList.remove('open');
}

function renderChat(pid) {
  const container = document.getElementById('chatBubbleContainer');
  if (!container) return;
  container.innerHTML = '';

  if (chatListener && chatPidAktif) {
    db.ref('chat_perijinan/' + chatPidAktif).off('value', chatListener);
  }

  const user = getSessionUser();
  chatListener = function (snapshot) {
    const data = snapshot.val() || {};
    const pesan = Object.values(data).sort((a, b) => a.waktu - b.waktu);
    container.innerHTML = '';
    pesan.forEach(function (m) {
      const isSaya = (user && user.role === 'admin' && m.pengirim === 'admin') ||
                     (user && user.role !== 'admin' && m.pengirim === 'siswa');
      const bubble = document.createElement('div');
      bubble.className = 'chat-bubble ' + (isSaya ? 'saya' : 'lawan');
      const waktu = new Date(m.waktu).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      bubble.innerHTML =
        '<span class="bubble-name">' + m.nama_pengirim + '</span>' +
        m.pesan +
        '<div class="bubble-time">' + waktu + '</div>';
      container.appendChild(bubble);
    });
    container.scrollTop = container.scrollHeight;
  };
  db.ref('chat_perijinan/' + pid).on('value', chatListener);
}

function kirimPesanChat() {
  const input = document.getElementById('chatInputPesan');
  if (!input) return;
  const pesan = input.value.trim();
  if (!pesan || !chatPidAktif) return;
  const user = getSessionUser();
  kirimChatPerijinan(chatPidAktif, user, pesan);
  input.value = '';
}
