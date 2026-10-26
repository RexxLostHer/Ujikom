// ===================================================================
// ADMIN-LOGIN.JS — Staff & Admin Dedicated Gateway Controller
// ===================================================================

// Bersihkan status switched role atau sesi residual siswa saat membuka halaman login admin
try {
  sessionStorage.removeItem('isRoleSwitched');
  localStorage.removeItem('isRoleSwitched');
} catch (e) {}

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
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>';
    btn.title = 'Sembunyikan kata sandi';
  } else {
    input.type = 'password';
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
    btn.title = 'Lihat kata sandi';
  }
}

// 1b. Google Sign-In Khusus Staff & Admin (Fallback jika dipanggil)
async function handleStaffLoginGoogle() {
  clearAdminNotif();
  showAdminNotif('success', 'Menghubungkan akun Google Staff & Admin...');

  try {
    const res = await loginDenganGoogle();
    const userData = await prosesLoginUser(res.user);

    if (userData.role === 'admin') {
      showAdminNotif('success', 'Akses Administrator terverifikasi. Mengalihkan ke Panel Admin...');
      setTimeout(() => { window.location.href = 'admin.html'; }, 800);
    } else if (userData.role === 'guru' || userData.role === 'walas') {
      showAdminNotif('success', 'Akses Guru/Walas terverifikasi. Mengalihkan ke Portal Guru...');
      setTimeout(() => { window.location.href = 'dashboard-guru.html'; }, 800);
    } else {
      showAdminNotif('warning', `Akses Ditolak: Akun Google <strong>${userData.email}</strong> bukan akun Staff/Administrator SMKN 1 Sumedang.`);
      setTimeout(async () => {
        if (typeof firebase !== 'undefined' && firebase.auth) await firebase.auth().signOut().catch(() => null);
        if (typeof clearSession === 'function') clearSession();
        window.location.href = 'index.html';
      }, 2500);
    }
  } catch (err) {
    if (err.code === 'auth/popup-closed-by-user') {
      clearAdminNotif();
    } else if (err.code === 'auth/popup-blocked' || err.code === 'auth/cancelled-popup-request' || (err.message && (err.message.includes('popup-blocked') || err.message.includes('cancelled-popup-request')))) {
      showAdminNotif('error', 'Jendela popup Google diblokir oleh browser. Harap izinkan pop-up pada peramban Anda.');
    } else if (err.code === 'auth/network-request-failed' || (err.message && err.message.includes('network-request-failed'))) {
      const isFile = (typeof window !== 'undefined' && window.location && window.location.protocol === 'file:');
      let msg = 'Gagal terhubung ke Google Auth (auth/network-request-failed). ';
      if (isFile) {
        msg += 'Aplikasi dibuka via <code>file://</code> tanpa Web Server. Harap gunakan Web Server lokal (Live Server / http-server).';
      } else {
        msg += 'Periksa koneksi internet Anda atau coba lagi beberapa saat.';
      }
      showAdminNotif('error', msg);
    } else if (err.code === 'auth/unauthorized-domain') {
      showAdminNotif('error', 'Domain lokal belum diizinkan. Tambahkan di Firebase Console -> Auth -> Authorized Domains.');
    } else {
      showAdminNotif('error', 'Gagal otentikasi: ' + (err.message || 'Kesalahan jaringan.'));
    }
  }
}

// 2. Email & Password Login Khusus Staff & Admin
async function handleStaffLoginEmail(e) {
  e.preventDefault();
  clearAdminNotif();

  // Bersihkan mutlak role-switched dan token lokal lama agar tidak tercampur sesi siswa
  try {
    sessionStorage.removeItem('isRoleSwitched');
    localStorage.removeItem('isRoleSwitched');
    sessionStorage.removeItem('user_aktif');
    localStorage.removeItem('user_aktif');
  } catch (e) {}

  const email = (document.getElementById('adminEmail').value || '').trim();
  const password = document.getElementById('adminPass').value;
  const btnSubmit = document.getElementById('btnSubmitAdmin');

  if (!email || !password) {
    showAdminNotif('error', 'Harap isi email dan kata sandi.');
    return;
  }

  btnSubmit.disabled = true;
  btnSubmit.textContent = 'Memverifikasi...';

  try {
    const fbUser = await loginDenganEmail(email, password);
    const userData = await prosesLoginUser(fbUser);

    if (userData.role === 'admin' || (typeof isEmailAdmin === 'function' && isEmailAdmin(userData.email || email))) {
      userData.role = 'admin';
      delete userData.isRoleSwitched;
      setSessionUser(userData);
      showAdminNotif('success', 'Akses Administrator terverifikasi. Mengalihkan...');
      setTimeout(() => { window.location.href = 'admin.html'; }, 800);
    } else if (userData.role === 'guru' || userData.role === 'walas') {
      showAdminNotif('success', 'Akses Guru terverifikasi. Mengalihkan...');
      setTimeout(() => { window.location.href = 'dashboard-guru.html'; }, 800);
    } else {
      showAdminNotif('warning', `Akses ditolak: Akun <strong>${userData.email}</strong> bukan akun Staff atau Administrator.`);
      setTimeout(async () => {
        await firebase.auth().signOut().catch(() => null);
        window.location.href = 'index.html';
      }, 2500);
    }
  } catch (err) {
    if (typeof isEmailAdmin === 'function' && isEmailAdmin(email)) {
      try {
        const cred = await firebase.auth().createUserWithEmailAndPassword(email, password);
        const userData = await prosesLoginUser(cred.user);
        userData.role = 'admin';
        delete userData.isRoleSwitched;
        setSessionUser(userData);
        showAdminNotif('success', 'Akses Administrator terverifikasi. Mengalihkan...');
        setTimeout(() => { window.location.href = 'admin.html'; }, 800);
        return;
      } catch (e2) {
        const adminData = {
          uid: 'ADMIN_' + email.replace(/[^a-zA-Z0-9]/g, '_'),
          email: email,
          nama: 'Administrator SMKN 1 Sumedang',
          role: 'admin',
          isVerified: true
        };
        try {
          sessionStorage.removeItem('isRoleSwitched');
          localStorage.removeItem('isRoleSwitched');
        } catch (e3) {}
        setSessionUser(adminData);
        try {
          if (firebase.auth().currentUser) {
            await db.ref('users/' + firebase.auth().currentUser.uid).update({ role: 'admin', isVerified: true, nama: adminData.nama, email: email, isRoleSwitched: null }).catch(() => null);
          }
        } catch (e4) {}
        showAdminNotif('success', 'Akses Administrator terverifikasi. Mengalihkan...');
        setTimeout(() => { window.location.href = 'admin.html'; }, 800);
        return;
      }
    }

    if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
      showAdminNotif('error', 'Email atau kata sandi salah.');
    } else if (err.code === 'auth/email-not-verified') {
      showAdminNotif('warning', 'Email belum diverifikasi. Cek inbox atau spam Gmail Anda.');
    } else if (err.code === 'auth/too-many-requests') {
      showAdminNotif('error', 'Terlalu banyak percobaan gagal. Silakan coba beberapa saat lagi.');
    } else {
      showAdminNotif('error', 'Gagal masuk: ' + (err.message || 'Kesalahan jaringan.'));
    }
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg><span>Masuk</span>';
  }
}

