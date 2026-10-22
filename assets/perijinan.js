// ===== PERIJINAN MODULE =====
// Submit ijin, upload surat, chat dengan admin

const JENIS_PERIJINAN = {
  sakit: { label: 'Sakit', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-2px;margin-right:4px;"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>', dokumenWajib: false },
  dispensasi: { label: 'Dispensasi', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-2px;margin-right:4px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>', dokumenWajib: true },
  ijin_kegiatan: { label: 'Ijin Kegiatan', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-2px;margin-right:4px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>', dokumenWajib: true }
};

// ===================================================================
// SUBMIT PERIJINAN BARU
// ===================================================================
async function submitPerijinan(user, jenis, alasan, tanggal, fileInput) {
  if (!user || user.role === 'pengunjung' || !user.nisn || user.role !== 'siswa') {
    throw new Error('Akses Ditolak: Fitur pengajuan perizinan hanya diperbolehkan untuk siswa resmi yang telah terverifikasi NISN.');
  }
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
  await db.ref('perizinan/' + pid).set({
    ...data,
    id: pid,
    nama_siswa: data.nama,
    foto_bukti: data.dokumen_url,
    created_at: new Date(data.dibuat_pada).toISOString()
  }).catch(() => null);

  await kirimChatPerijinan(pid, user, 'Saya mengajukan ' + (JENIS_PERIJINAN[jenis]?.label || jenis) + ': ' + alasan);
  return pid;
}

// ===================================================================
// CHAT PERIJINAN
// ===================================================================
async function kirimChatPerijinan(pid, user, pesan) {
  const isStaff = user && (user.role === 'admin' || user.role === 'guru' || user.role === 'walas');
  await db.ref('chat_perijinan/' + pid).push({
    pengirim: isStaff ? 'admin' : 'siswa',
    nama_pengirim: (user && user.nama) ? user.nama : (isStaff ? 'Wali Kelas / Guru' : 'Siswa'),
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
      const jn = JENIS_PERIJINAN[p.jenis] || { label: p.jenis, icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-2px;margin-right:4px;"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>' };
      const statusLabel = p.status === 'disetujui' ? 'Disetujui' : p.status === 'ditolak' ? 'Ditolak' : 'Menunggu';
      const el = document.createElement('div');
      el.className = 'perijinan-card status-' + (p.status || 'pending');
      el.innerHTML =
        '<div class="perijinan-card-top">' +
          '<span class="perijinan-jenis-badge">' + jn.icon + ' ' + jn.label + '</span>' +
          '<span class="status-pill ' + (p.status || 'pending') + '">' + statusLabel + '</span>' +
        '</div>' +
        '<div class="perijinan-meta"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-1px;margin-right:4px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>Tanggal: <strong>' + p.tanggal + '</strong></div>' +
        '<div class="perijinan-alasan-box">' + p.alasan + '</div>' +
        (p.dokumen_url ? '<a class="perijinan-dok-link" href="' + p.dokumen_url + '" target="_blank"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-1px;margin-right:4px;"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>Lihat Dokumen</a>' : '') +
        '<div class="action-row"><button class="btn-chat" onclick="bukaModalChat(\'' + p.pid + '\', \'' + p.nama + '\')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-1px;margin-right:4px;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>Chat Admin</button></div>';
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
          '<div class="empty-icon"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg></div>' +
          '<p>' + (filterStatus === 'pending' ? 'Tidak ada perijinan yang menunggu.' : 'Belum ada data perijinan.') + '</p>' +
        '</div>';
      return;
    }

    filtered.forEach(function (p) {
      const jn = JENIS_PERIJINAN[p.jenis] || { label: p.jenis, icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-2px;margin-right:4px;"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>' };
      const statusLabel = p.status === 'disetujui' ? 'Disetujui' : p.status === 'ditolak' ? 'Ditolak' : 'Menunggu';

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
        '<div class="perijinan-meta"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-1px;margin-right:4px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>Tanggal: <strong>' + p.tanggal + '</strong></div>' +
        '<div class="perijinan-alasan-box">' + p.alasan + '</div>' +
        (p.dokumen_url
          ? '<a class="perijinan-dok-link" href="' + p.dokumen_url + '" target="_blank"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-1px;margin-right:4px;"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>Lihat Dokumen/Surat</a>'
          : '') +
        '<div class="action-row">' +
          (p.status === 'pending'
            ? '<button class="btn-approve" onclick="adminApprove(\'' + p.pid + '\', \'' + p.nisn + '\', \'' + p.tanggal + '\', \'' + p.jenis + '\')">Setujui</button>' +
              '<button class="btn-tolak" onclick="adminTolak(\'' + p.pid + '\')">Tolak</button>'
            : '') +
          '<button class="btn-chat" onclick="bukaModalChat(\'' + p.pid + '\', \'' + p.nama + '\')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-1px;margin-right:4px;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>Chat</button>' +
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

  await Promise.all([
    db.ref('perijinan/' + pid + '/status').set('disetujui'),
    db.ref('perizinan/' + pid + '/status').set('disetujui').catch(() => null)
  ]);
  await kirimChatPerijinan(pid, adminUser,
    'Perijinan Anda telah DISETUJUI. Kehadiran tercatat sebagai ' + (JENIS_PERIJINAN[jenis]?.label || jenis) + '.');

  if (nisn && tanggal) {
    const siswaSnap = await db.ref('siswa/' + nisn).once('value');
    const siswa = siswaSnap.val();
    if (siswa && siswa.kelas) {
      const kelas = siswa.kelas;
      const jadwalSnap = await db.ref('jadwal_pelajaran/' + kelas).once('value');
      const resolvedJadwal = (typeof ambilJadwalKelasHariIni === 'function')
        ? ambilJadwalKelasHariIni(jadwalSnap.val(), kelas)
        : { jadwal: jadwalSnap.val() || {} };
      const jadwal = (resolvedJadwal && resolvedJadwal.jadwal && Object.keys(resolvedJadwal.jadwal).length > 0)
        ? resolvedJadwal.jadwal
        : (jadwalSnap.val() || { '1': true, '2': true, '3': true, '4': true, '5': true, '6': true, '7': true, '8': true });
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
  await Promise.all([
    db.ref('perijinan/' + pid + '/status').set('ditolak'),
    db.ref('perizinan/' + pid + '/status').set('ditolak').catch(() => null)
  ]);
  await kirimChatPerijinan(pid, adminUser, 'Maaf, perijinan Anda DITOLAK. ' + alasan);
}

// ===================================================================
// MODAL CHAT
// ===================================================================
let chatListener = null;
let chatPidAktif = null;

function bukaModalChat(pid, namaSiswa) {
  chatPidAktif = pid;
  const judul = document.getElementById('modalChatJudul');
  if (judul) judul.textContent = 'Chat — ' + namaSiswa;
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
      const isStaff = user && (user.role === 'admin' || user.role === 'guru' || user.role === 'walas');
      const isSaya = (isStaff && (m.pengirim === 'admin' || m.pengirim === 'guru')) ||
                     (!isStaff && m.pengirim === 'siswa');
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
