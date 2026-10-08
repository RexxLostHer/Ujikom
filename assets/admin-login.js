// ===================================================================
// ADMIN-LOGIN.JS — Staff & Admin Dedicated Gateway Controller
// ===================================================================

function showAdminNotif(type, message) {
  const box = document.getElementById('adminNotifBox');
  if (!box) return;
  box.className = 'notif-box ' + type;
  box.innerHTML = message;
  box.style.display = 'block';
}

function clearAdminNotif() {
  const box = document.getElementById('adminNotifBox');
  if (!box) return;
  box.style.display = 'none';
  box.className = 'notif-box';
  box.innerHTML = '';
}

function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = '🙈';
  } else {
    input.type = 'password';
    btn.textContent = '👁️';
  }
}

// 2. Email & Password Login Khusus Staff & Admin
async function handleStaffLoginEmail(e) {
  e.preventDefault();
  clearAdminNotif();

  const email = (document.getElementById('adminEmail').value || '').trim();
  const password = document.getElementById('adminPass').value;
  const btnSubmit = document.getElementById('btnSubmitAdmin');

  if (!email || !password) {
    showAdminNotif('error', 'Harap isi alamat email kedinasan dan kata sandi.');
    return;
  }

  btnSubmit.disabled = true;
  btnSubmit.textContent = '⏳ Memverifikasi Kredensial...';

  try {
    const fbUser = await loginDenganEmail(email, password);
    const userData = await prosesLoginUser(fbUser);

    if (userData.role === 'admin') {
      showAdminNotif('success', '✓ Akses Administrator Terverifikasi. Mengalihkan ke Panel Admin...');
      setTimeout(() => { window.location.href = 'admin.html'; }, 900);
    } else if (userData.role === 'guru' || userData.role === 'walas') {
      showAdminNotif('success', '✓ Akses Guru/Walas Terverifikasi. Mengalihkan ke Portal Guru...');
      setTimeout(() => { window.location.href = 'dashboard-guru.html'; }, 900);
    } else {
      showAdminNotif('warning', `⚠️ Akses Ditolak: Akun <strong>${userData.email}</strong> terdaftar sebagai Siswa/Pengunjung. Portal ini khusus untuk Guru dan Administrator.`);
      setTimeout(async () => {
        await firebase.auth().signOut();
        window.location.href = 'index.html';
      }, 3000);
    }
  } catch (err) {
    if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
      if (typeof isEmailAdmin === 'function' && isEmailAdmin(email)) {
        try {
          const cred = await firebase.auth().createUserWithEmailAndPassword(email, password);
          await prosesLoginUser(cred.user);
          showAdminNotif('success', '✓ Akun Administrator Baru Berhasil Didaftarkan. Mengalihkan ke Panel Admin...');
          setTimeout(() => { window.location.href = 'admin.html'; }, 900);
          return;
        } catch (e2) {}
      }
      showAdminNotif('error', 'Email kedinasan atau kata sandi tidak sesuai. Periksa kembali kredensial Anda.');
    } else if (err.code === 'auth/email-not-verified') {
      showAdminNotif('warning', 'Email kedinasan belum diverifikasi. Cek inbox/spam Gmail Anda.');
    } else if (err.code === 'auth/too-many-requests') {
      showAdminNotif('error', 'Terlalu banyak percobaan login gagal. Harap tunggu beberapa saat sebelum mencoba lagi.');
    } else {
      showAdminNotif('error', 'Gagal otentikasi: ' + (err.message || 'Kesalahan jaringan.'));
    }
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = '🔐 Otentikasi & Masuk ke Panel';
  }
}

// 3. Akses Cepat Mode Evaluasi / Demo UJIKOM 2026
async function masukSebagaiAdminDemo() {
  showAdminNotif('success', '⚡ Mengaktifkan sesi Administrator Sistem...');
  const adminData = {
    uid: 'ADMIN_UJIKOM_2026',
    email: 'admin@smkn1sumedang.sch.id',
    nama: 'Administrator Sistem SMKN 1 Sumedang',
    role: 'admin',
    isVerified: true
  };
  setSessionUser(adminData);
  try {
    if (firebase.auth().currentUser) {
      await db.ref('users/' + firebase.auth().currentUser.uid).update({ role: 'admin', isVerified: true, nama: adminData.nama });
    }
  } catch (e) {}
  setTimeout(() => { window.location.href = 'admin.html'; }, 600);
}

async function masukSebagaiGuruDemo(nipPilihan) {
  const nip = nipPilihan || '198109012009022003';
  const g = (typeof MASTER_GURU_RESMI !== 'undefined' && MASTER_GURU_RESMI[nip]) || {
    nip: nip,
    nama: 'Hani Hanifah, S.Si',
    mapel: 'Pemrograman Web & Perangkat Bergerak',
    isWalas: true,
    walasKelasId: 'XII RPL 1'
  };
  showAdminNotif('success', `⚡ Mengaktifkan sesi Wali Kelas (${g.nama})...`);
  const guruData = {
    uid: 'GURU_' + nip,
    email: g.email || 'hani@smkn1sumedang.sch.id',
    nama: g.nama,
    nip: g.nip,
    mapel: g.mapel,
    isWalas: !!g.isWalas,
    walasKelasId: g.walasKelasId || 'XII RPL 1',
    role: g.isWalas ? 'walas' : 'guru',
    isVerified: true
  };
  setSessionUser(guruData);
  try {
    if (firebase.auth().currentUser) {
      await db.ref('users/' + firebase.auth().currentUser.uid).update(guruData);
    }
  } catch (e) {}
  setTimeout(() => { window.location.href = 'dashboard-guru.html'; }, 600);
}
