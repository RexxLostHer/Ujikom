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
async function registerDenganEmail(email, password, nama, roleDefault = 'ortu') {
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

  let mapSnap = await db.ref('email_mapping/' + encoded).once('value');
  let mapped = mapSnap.val();

  const userData = {
    uid: uid,
    email: email,
    nama: nama || (mapped ? mapped.nama : email.split('@')[0]),
    nisn: mapped ? mapped.nisn : null,
    kelas: mapped ? mapped.kelas : null,
    role: mapped ? mapped.role : roleDefault,
    foto_google: null
  };

  await db.ref('users/' + uid).set(userData);

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
  const email = firebaseUser.email;
  const encoded = encodeEmail(email);

  let snap = await db.ref('users/' + uid).once('value');
  let userData = snap.val();

  if (!userData) {
    let mapSnap = await db.ref('email_mapping/' + encoded).once('value');
    let mapped = mapSnap.val();

    if (mapped) {
      userData = {
        uid: uid,
        email: email,
        nama: mapped.nama,
        nisn: mapped.nisn || null,
        kelas: mapped.kelas || null,
        role: mapped.role,
        foto_google: firebaseUser.photoURL || null
      };
    } else {
      userData = {
        uid: uid,
        email: email,
        nama: firebaseUser.displayName || email.split('@')[0],
        nisn: null,
        kelas: null,
        role: 'ortu',
        foto_google: firebaseUser.photoURL || null
      };
    }
    await db.ref('users/' + uid).set(userData);
  } else {
    if (firebaseUser.photoURL && userData.foto_google !== firebaseUser.photoURL) {
      await db.ref('users/' + uid + '/foto_google').set(firebaseUser.photoURL);
      userData.foto_google = firebaseUser.photoURL;
    }
  }

  setSessionUser(userData);
  return userData;
}

function logout() {
  clearSession();
  firebase.auth().signOut().then(() => {
    window.location.href = 'index.html';
  });
}
