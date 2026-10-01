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

// 1. Google 1-Click Login Khusus Staff & Admin
async function handleGoogleStaffLogin() {
  clearAdminNotif();
  const btnGoogle = document.getElementById('btnGoogleStaff');
  const originalText = btnGoogle ? btnGoogle.innerHTML : '';
  if (btnGoogle) {
    btnGoogle.disabled = true;
    btnGoogle.innerHTML = '<span>⏳ Menghubungkan Google Auth...</span>';
  }

  try {
    const cred = await loginDenganGoogle();
    const fbUser = cred.user;
    const userData = await prosesLoginUser(fbUser);

    if (userData.role === 'admin') {
      showAdminNotif('success', '✓ Akses Administrator Terverifikasi. Mengalihkan ke Panel Admin...');
      setTimeout(() => { window.location.href = 'admin.html'; }, 900);
    } else if (userData.role === 'guru') {
      showAdminNotif('success', '✓ Akses Guru Terverifikasi. Mengalihkan ke Portal Guru...');
      setTimeout(() => { window.location.href = 'dashboard-guru.html'; }, 900);
    } else {
      showAdminNotif('warning', `⚠️ Akses Ditolak: Akun <strong>${userData.email}</strong> terdaftar sebagai Siswa/Pengunjung. Portal ini khusus untuk Guru dan Administrator.`);
      setTimeout(async () => {
        await firebase.auth().signOut();
        window.location.href = 'index.html';
      }, 3000);
    }
  } catch (err) {
    if (err.code === 'auth/popup-closed-by-user') {
      showAdminNotif('warning', 'Login Google dibatalkan oleh pengguna.');
    } else {
      showAdminNotif('error', 'Gagal masuk dengan Google: ' + (err.message || 'Terjadi kesalahan sistem.'));
    }
  } finally {
    if (btnGoogle) {
      btnGoogle.disabled = false;
      btnGoogle.innerHTML = originalText;
    }
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
    } else if (userData.role === 'guru') {
      showAdminNotif('success', '✓ Akses Guru Terverifikasi. Mengalihkan ke Portal Guru...');
      setTimeout(() => { window.location.href = 'dashboard-guru.html'; }, 900);
    } else {
      showAdminNotif('warning', `⚠️ Akses Ditolak: Akun <strong>${userData.email}</strong> terdaftar sebagai Siswa. Portal ini khusus untuk Guru dan Administrator. Mengalihkan ke portal siswa...`);
      setTimeout(async () => {
        await firebase.auth().signOut();
        window.location.href = 'index.html';
      }, 3000);
    }
  } catch (err) {
    if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
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
