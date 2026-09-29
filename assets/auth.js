// ===== AUTH MODULE =====

function encodeEmail(email) {
  return email.toLowerCase().replace(/\./g, ',').replace(/@/g, '(at)');
}

function getSessionUser() {
  const raw = sessionStorage.getItem('user_aktif');
  return raw ? JSON.parse(raw) : null;
}

function setSessionUser(data) {
  sessionStorage.setItem('user_aktif', JSON.stringify(data));
}

function clearSession() {
  sessionStorage.removeItem('user_aktif');
}

// 1. Google Sign-In
function loginDenganGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return firebase.auth().signInWithPopup(provider);
}

// 2. Register Email/Password + Kirim Verifikasi
async function registerDenganEmail(email, password, nama) {
  const cred = await firebase.auth().createUserWithEmailAndPassword(email, password);
  const fbUser = cred.user;

  // Action Code Settings agar link verifikasi mengarah kembali ke web kita
  const actionCodeSettings = {
    url: window.location.origin + '/index.html?verified=true',
    handleCodeInApp: false
  };

  await fbUser.sendEmailVerification(actionCodeSettings);

  const uid = fbUser.uid;
  const encoded = encodeEmail(email);

  let mapped = null;
  try {
    const mapSnap = await db.ref('email_mapping/' + encoded).once('value');
    mapped = mapSnap.val();
  } catch (errRule) {
    console.warn('Pengecekan email_mapping dilewati:', errRule.message);
  }

  const userData = {
    uid: uid,
    email: email,
    nama: nama || (mapped ? mapped.nama : email.split('@')[0]),
    nisn: mapped ? mapped.nisn : null,
    kelas: mapped ? mapped.kelas : null,
    nip: mapped ? mapped.nip : null,
    mapel: mapped ? mapped.mapel : null,
    role: (mapped && (mapped.role === 'guru' || mapped.role === 'admin')) ? mapped.role : 'siswa',
    foto_google: null
  };

  try {
    await db.ref('users/' + uid).set(userData);
  } catch (errUser) {
    console.warn('Simpan users/{uid} gagal/dibatasi:', errUser.message);
  }

  // Tunggu jeda sejenak agar background trigger Firebase selesai
  await new Promise(r => setTimeout(r, 1000));
  await firebase.auth().signOut();
  return fbUser;
}

// 3. Kirim Ulang Link Verifikasi
async function kirimUlangVerifikasi(email, password) {
  const cred = await firebase.auth().signInWithEmailAndPassword(email, password);
  const user = cred.user;
  if (user.emailVerified) {
    return { sudahVerif: true, user };
  }
  await user.sendEmailVerification({
    url: window.location.origin + '/index.html?verified=true',
    handleCodeInApp: false
  });
  await firebase.auth().signOut();
  return { sudahVerif: false };
}

// 4. Login Email/Password (Cek Verifikasi)
async function loginDenganEmail(email, password) {
  const cred = await firebase.auth().signInWithEmailAndPassword(email, password);
  const fbUser = cred.user;

  // Muat ulang status user terkini dari server
  await fbUser.reload();

  if (!fbUser.emailVerified) {
    await firebase.auth().signOut();
    const err = new Error('Email belum diverifikasi. Cek inbox/spam Gmail Anda.');
    err.code = 'auth/email-not-verified';
    err.email = email;
    err.password = password;
    throw err;
  }

  return fbUser;
}

// 5. Proses Session
async function prosesLoginUser(firebaseUser) {
  const uid = firebaseUser.uid;
  const email = firebaseUser.email || '';
  const encoded = encodeEmail(email);

  let userData = null;
  try {
    const snap = await db.ref('users/' + uid).once('value');
    userData = snap.val();
  } catch (err) {
    console.warn('Baca data users/{uid} dibatasi:', err.message);
  }

  if (!userData) {
    let mapped = null;
    try {
      const mapSnap = await db.ref('email_mapping/' + encoded).once('value');
      mapped = mapSnap.val();
    } catch (errRule) {
      console.warn('Pengecekan email_mapping dilewati:', errRule.message);
    }

    if (mapped) {
      userData = {
        uid: uid,
        email: email,
        nama: mapped.nama,
        nisn: mapped.nisn || null,
        kelas: mapped.kelas || null,
        nip: mapped.nip || null,
        mapel: mapped.mapel || null,
        role: mapped.role,
        foto_google: firebaseUser.photoURL || null
      };
    } else {
      userData = {
        uid: uid,
        email: email,
        nama: firebaseUser.displayName || (email ? email.split('@')[0] : 'Pengguna'),
        nisn: null,
        kelas: null,
        role: 'siswa',
        foto_google: firebaseUser.photoURL || null
      };
    }

    try {
      await db.ref('users/' + uid).set(userData);
    } catch (errWrite) {
      console.warn('Penyimpanan users/{uid} dilewati:', errWrite.message);
    }
  } else {
    if (firebaseUser.photoURL && userData.foto_google !== firebaseUser.photoURL) {
      try {
        await db.ref('users/' + uid + '/foto_google').set(firebaseUser.photoURL);
      } catch (e) {}
      userData.foto_google = firebaseUser.photoURL;
    }
  }

  setSessionUser(userData);
  return userData;
}

function getDashboardUrlByRole(role) {
  if (role === 'admin') return 'admin.html';
  if (role === 'guru') return 'dashboard-guru.html';
  return 'dashboard.html';
}

function logout() {
  clearSession();
  firebase.auth().signOut().then(() => {
    window.location.href = 'index.html';
  });
}

// 6. Reset Kata Sandi via Email Gmail
async function kirimResetPassword(email) {
  if (!email || !email.trim()) throw new Error('Harap masukkan alamat email Gmail Anda.');
  return firebase.auth().sendPasswordResetEmail(email.trim());
}

// 7. Ubah Kata Sandi Akun (User Sedang Login)
async function ubahKataSandi(passwordBaru) {
  const user = firebase.auth().currentUser;
  if (!user) throw new Error('Sesi pengguna tidak aktif. Harap masuk kembali.');
  if (!passwordBaru || passwordBaru.length < 6) {
    throw new Error('Kata sandi baru minimal 6 karakter.');
  }
  return user.updatePassword(passwordBaru);
}

// 8. Perbarui Profil Pengguna (Nama Lengkap)
async function ubahProfilPengguna(namaBaru) {
  const user = firebase.auth().currentUser;
  if (!user) throw new Error('Sesi pengguna tidak aktif. Harap masuk kembali.');
  const namaTrim = (namaBaru || '').trim();
  if (!namaTrim) throw new Error('Nama lengkap tidak boleh kosong.');
  
  await user.updateProfile({ displayName: namaTrim });
  
  const userAktif = getSessionUser() || {};
  userAktif.nama = namaTrim;
  setSessionUser(userAktif);
  
  try {
    await db.ref('users/' + user.uid + '/nama').set(namaTrim);
  } catch (err) {
    console.warn('Simpan nama profil ke database dilewati:', err.message);
  }
  return userAktif;
}
