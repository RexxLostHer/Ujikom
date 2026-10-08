// ===== AUTH MODULE =====

function encodeEmail(email) {
  return email.toLowerCase().replace(/\./g, ',').replace(/@/g, '(at)');
}

function getSessionUser() {
  let raw = null;
  try { raw = sessionStorage.getItem('user_aktif'); } catch (e) {}
  if (!raw) {
    try { raw = localStorage.getItem('user_aktif'); } catch (e) {}
  }
  if (!raw) return null;
  try {
    const user = JSON.parse(raw);
    if (!user || typeof user !== 'object') return null;
    // CRITICAL: Prevent stale admin token in localStorage from escalating fresh unauthenticated visitors to admin
    if (user.role === 'admin') {
      const sessRaw = (typeof sessionStorage !== 'undefined') ? sessionStorage.getItem('user_aktif') : null;
      if (!sessRaw) {
        try { localStorage.removeItem('user_aktif'); } catch (e) {}
        return null;
      }
    }
    return user;
  } catch (e) {
    return null;
  }
}

function setSessionUser(data) {
  if (!data) {
    clearSession();
    return;
  }
  try { sessionStorage.setItem('user_aktif', JSON.stringify(data)); } catch (e) {}
  // Admin credentials must NEVER be retained globally in localStorage to prevent unauthorized redirects
  if (data.role === 'admin') {
    try { localStorage.removeItem('user_aktif'); } catch (e) {}
  } else {
    try { localStorage.setItem('user_aktif', JSON.stringify(data)); } catch (e) {}
  }
}

function clearSession() {
  try { sessionStorage.removeItem('user_aktif'); } catch (e) {}
  try { localStorage.removeItem('user_aktif'); } catch (e) {}
  try { sessionStorage.removeItem('isRoleSwitched'); } catch (e) {}
  try { localStorage.removeItem('isRoleSwitched'); } catch (e) {}
  try { localStorage.removeItem('nisn_aktif'); } catch (e) {}
}

// 1. Google Sign-In
function loginDenganGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return firebase.auth().signInWithPopup(provider);
}

// Master Admin & Guru Whitelist (PRD SMKN 1 Sumedang 2026)
const MASTER_ADMIN_EMAILS = [
  '7dosabesar557@gmail.com',
  'admin@smkn1sumedang.sch.id',
  'admin@ujikom.sch.id',
  'admin@nesas.sch.id',
  'admin@admin.com',
  'admin@gmail.com',
  'administrator@smkn1sumedang.sch.id',
  'admin@nesas.com'
];

function isEmailAdmin(email) {
  if (!email || typeof email !== 'string') return false;
  const clean = email.toLowerCase().trim();
  if (!clean) return false;
  if (MASTER_ADMIN_EMAILS.includes(clean)) return true;
  if (clean.startsWith('admin@') || clean.startsWith('admin.') || clean.startsWith('administrator@')) return true;
  if (clean.endsWith('@admin.com')) return true;
  return false;
}

function cariGuruByEmail(email) {
  if (!email) return null;
  const clean = email.toLowerCase().trim();
  const guruList = typeof MASTER_GURU_RESMI !== 'undefined' ? MASTER_GURU_RESMI : {};
  const guruEmailMap = {
    'hani@smkn1sumedang.sch.id': '198109012009022003',
    'hani.hanifah@gmail.com': '198109012009022003',
    'hani@gmail.com': '198109012009022003',
    'echa@smkn1sumedang.sch.id': '199209142022211007',
    'echaputra@gmail.com': '199209142022211007',
    'echa@gmail.com': '199209142022211007',
    'rijal@smkn1sumedang.sch.id': '198312052022211017',
    'rijal@gmail.com': '198312052022211017',
    'heri@smkn1sumedang.sch.id': '198504252024211008',
    'heri@gmail.com': '198504252024211008',
    'hali@smkn1sumedang.sch.id': '197905032006042004',
    'hali@gmail.com': '197905032006042004'
  };
  const nip = guruEmailMap[clean];
  if (nip && guruList[nip]) return guruList[nip];
  for (const k in guruList) {
    const g = guruList[k];
    if (g.email && g.email.toLowerCase() === clean) return g;
    const prefix = clean.split('@')[0];
    if (prefix.length >= 4 && g.nama && g.nama.toLowerCase().includes(prefix)) return g;
  }
  return null;
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

  const isAdm = isEmailAdmin(email);
  const isGur = cariGuruByEmail(email);

  const userData = {
    uid: uid,
    email: email,
    nama: nama || (isAdm ? 'Administrator Sistem' : (isGur ? isGur.nama : (mapped ? mapped.nama : email.split('@')[0]))),
    nisn: mapped ? mapped.nisn : null,
    kelas: mapped ? mapped.kelas : null,
    nip: isGur ? isGur.nip : (mapped ? mapped.nip : null),
    mapel: isGur ? isGur.mapel : (mapped ? mapped.mapel : null),
    isWalas: isGur ? !!isGur.isWalas : (mapped ? !!mapped.isWalas : false),
    walasKelasId: isGur ? (isGur.walasKelasId || null) : (mapped ? (mapped.walasKelasId || null) : null),
    role: isAdm ? 'admin' : (isGur ? (isGur.isWalas ? 'walas' : 'guru') : ((mapped && (mapped.role === 'guru' || mapped.role === 'walas' || mapped.role === 'admin')) ? mapped.role : (mapped && mapped.nisn ? 'siswa' : 'pengunjung'))),
    isVerified: isAdm || !!isGur || !!(mapped && (mapped.nisn || mapped.nip)),
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

  if (!fbUser.emailVerified && !isEmailAdmin(email)) {
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

  const isAdm = isEmailAdmin(email);
  const guruMatch = cariGuruByEmail(email);

  if (!userData) {
    let mapped = null;
    try {
      const mapSnap = await db.ref('email_mapping/' + encoded).once('value');
      mapped = mapSnap.val();
    } catch (errRule) {
      console.warn('Pengecekan email_mapping dilewati:', errRule.message);
    }

    if (isAdm) {
      userData = {
        uid: uid,
        email: email,
        nama: firebaseUser.displayName || 'Administrator Sistem',
        nisn: null,
        kelas: null,
        role: 'admin',
        isVerified: true,
        foto_google: firebaseUser.photoURL || null
      };
      const isSwitched = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('isRoleSwitched') === 'true';
      if (isSwitched) {
        const activeSess = typeof getSessionUser === 'function' ? getSessionUser() : null;
        if (activeSess && activeSess.role) {
          userData = { ...userData, ...activeSess, isRoleSwitched: true };
        }
      }
    } else if (guruMatch) {
      userData = {
        uid: uid,
        email: email,
        nama: guruMatch.nama,
        nip: guruMatch.nip,
        mapel: guruMatch.mapel,
        isWalas: !!guruMatch.isWalas,
        walasKelasId: guruMatch.walasKelasId || null,
        role: guruMatch.isWalas ? 'walas' : 'guru',
        isVerified: true,
        foto_google: firebaseUser.photoURL || null
      };
    } else if (mapped) {
      userData = {
        uid: uid,
        email: email,
        nama: mapped.nama,
        nisn: mapped.nisn || null,
        kelas: mapped.kelas || null,
        nip: mapped.nip || null,
        mapel: mapped.mapel || null,
        isWalas: !!mapped.isWalas,
        walasKelasId: mapped.walasKelasId || null,
        role: mapped.role,
        isVerified: !!mapped.isVerified,
        foto_google: firebaseUser.photoURL || null
      };
    } else {
      userData = {
        uid: uid,
        email: email,
        nama: firebaseUser.displayName || (email ? email.split('@')[0] : 'Pengunjung'),
        nisn: null,
        kelas: null,
        role: 'pengunjung',
        foto_google: firebaseUser.photoURL || null
      };
    }

    try {
      await db.ref('users/' + uid).set(userData);
    } catch (errWrite) {
      console.warn('Penyimpanan users/{uid} dilewati:', errWrite.message);
    }
  } else {
    // SINKRONISASI & KOREKSI ROLE JIKA AKUN SEBELUMNYA SALAH TERSIMPAN:
    const isSwitched = !!userData.isRoleSwitched || (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('isRoleSwitched') === 'true');
    if (isSwitched) {
      const activeSess = typeof getSessionUser === 'function' ? getSessionUser() : null;
      if (activeSess && activeSess.role) {
        userData = { ...userData, ...activeSess, isRoleSwitched: true };
      }
    } else {
      if (isAdm && userData.role !== 'admin') {
        userData.role = 'admin';
        if (!userData.nama || userData.nama === 'Pengunjung') userData.nama = 'Administrator Sistem';
        userData.isVerified = true;
        try { await db.ref('users/' + uid).update({ role: 'admin', isVerified: true, nama: userData.nama }); } catch (e) {}
      } else if (guruMatch && userData.role !== 'guru' && userData.role !== 'walas' && !userData.nisn) {
        userData.role = guruMatch.isWalas ? 'walas' : 'guru';
        userData.nama = guruMatch.nama;
        userData.nip = guruMatch.nip;
        userData.mapel = guruMatch.mapel;
        userData.isWalas = !!guruMatch.isWalas;
        userData.walasKelasId = guruMatch.walasKelasId || null;
        userData.isVerified = true;
        try { await db.ref('users/' + uid).update(userData); } catch (e) {}
      } else if (userData.role !== 'admin' && userData.role !== 'guru' && userData.role !== 'walas' && !userData.nisn) {
        userData.role = 'pengunjung';
      }
    }

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

// 5b. Validasi dan Konfirmasi NISN Siswa
async function periksaNisnSiswa(nisn) {
  const cleanNisn = (nisn || '').trim();
  if (!cleanNisn) throw new Error('Harap masukkan 10 digit NISN.');
  if (!/^\d{8,12}$/.test(cleanNisn)) throw new Error('Format NISN tidak valid (harus 8-12 angka).');

  // Cek di master data siswa
  const snapSiswa = await db.ref('siswa/' + cleanNisn).once('value');
  const siswa = snapSiswa.val();
  if (!siswa) {
    throw new Error('NISN ' + cleanNisn + ' tidak terdaftar di database SMKN 1 Sumedang. Pastikan NISN sudah benar atau hubungi admin sekolah.');
  }

  // Cek apakah NISN sudah diklaim oleh akun lain
  const snapClaimed = await db.ref('nisn_claimed/' + cleanNisn).once('value');
  const claimData = snapClaimed.val();
  const currentFbUser = firebase.auth().currentUser;

  if (claimData) {
    const claimedUid = typeof claimData === 'string' ? claimData : claimData.uid;
    if (currentFbUser && claimedUid !== currentFbUser.uid) {
      const emailMask = claimData.email ? ' (' + claimData.email.replace(/(.{2})(.*)(@.*)/, '$1***$3') + ')' : '';
      throw new Error('NISN ' + cleanNisn + ' telah ditautkan ke akun lain' + emailMask + '. Sesuai kebijakan sekolah, 1 NISN hanya dapat digunakan oleh 1 akun primer. Untuk memindahkan akun, hubungi Administrator Sekolah untuk konfirmasi & pelepasan tautan.');
    }
  }

  return {
    nisn: cleanNisn,
    nama: siswa.nama,
    kelas: siswa.kelas || 'XII RPL 2',
    jurusan: siswa.jurusan || 'Rekayasa Perangkat Lunak',
    email_terdaftar: siswa.email || null
  };
}

async function konfirmasiTautkanNisn(nisn) {
  const currentFbUser = firebase.auth().currentUser;
  if (!currentFbUser) throw new Error('Sesi tidak aktif. Silakan masuk kembali.');

  const dataSiswa = await periksaNisnSiswa(nisn);
  const uid = currentFbUser.uid;
  const email = currentFbUser.email || '';
  const encoded = encodeEmail(email);

  const updatedData = {
    uid: uid,
    email: email,
    nama: dataSiswa.nama,
    nisn: dataSiswa.nisn,
    kelas: dataSiswa.kelas,
    role: 'siswa',
    isVerified: true,
    nisn_verified_at: new Date().toISOString(),
    foto_google: currentFbUser.photoURL || null
  };

  await db.ref('users/' + uid).update(updatedData);

  await db.ref('nisn_claimed/' + dataSiswa.nisn).set({
    uid: uid,
    email: email,
    nama: dataSiswa.nama,
    waktu: new Date().toISOString()
  });

  if (encoded) {
    try {
      await db.ref('email_mapping/' + encoded).set({
        nama: dataSiswa.nama,
        nisn: dataSiswa.nisn,
        kelas: dataSiswa.kelas,
        role: 'siswa'
      });
    } catch (e) {}
  }

  setSessionUser(updatedData);
  return updatedData;
}

// 5c. Validasi dan Konfirmasi NIP Guru / Wali Kelas (PRD Bab 3)
async function periksaNipGuru(nip) {
  const cleanNip = (nip || '').trim();
  if (!cleanNip) throw new Error('Harap masukkan NIP atau Kode Guru.');

  // Cek di master data guru Firebase
  let guru = null;
  try {
    const snapGuru = await db.ref('guru/' + cleanNip).once('value');
    guru = snapGuru.val();
  } catch (e) {}

  if (!guru && typeof MASTER_GURU_RESMI !== 'undefined') {
    guru = MASTER_GURU_RESMI[cleanNip] || null;
  }

  if (!guru) {
    throw new Error('NIP/Kode Guru ' + cleanNip + ' tidak terdaftar di database SMKN 1 Sumedang.');
  }

  // Cek apakah NIP sudah diklaim oleh akun lain
  try {
    const snapClaimed = await db.ref('guru_claimed/' + cleanNip).once('value');
    const claimData = snapClaimed.val();
    const currentFbUser = firebase.auth().currentUser;
    if (claimData) {
      const claimedUid = typeof claimData === 'string' ? claimData : claimData.uid;
      if (currentFbUser && claimedUid !== currentFbUser.uid) {
        throw new Error('NIP ' + cleanNip + ' telah ditautkan ke akun lain. Hubungi Administrator untuk reset.');
      }
    }
  } catch (e) {}

  return {
    nip: cleanNip,
    nama: guru.nama,
    mapel: guru.mapel || '-',
    isWalas: !!guru.isWalas,
    walasKelasId: guru.walasKelasId || null
  };
}

async function konfirmasiTautkanGuru(nip) {
  const currentFbUser = firebase.auth().currentUser;
  if (!currentFbUser) throw new Error('Sesi tidak aktif. Silakan masuk kembali.');

  const dataGuru = await periksaNipGuru(nip);
  const uid = currentFbUser.uid;
  const email = currentFbUser.email || '';
  const encoded = encodeEmail(email);

  const role = dataGuru.isWalas ? 'walas' : 'guru';
  const updatedData = {
    uid: uid,
    email: email,
    nama: dataGuru.nama,
    nip: dataGuru.nip,
    mapel: dataGuru.mapel,
    isWalas: dataGuru.isWalas,
    walasKelasId: dataGuru.walasKelasId,
    role: role,
    isVerified: true,
    nip_verified_at: new Date().toISOString(),
    foto_google: currentFbUser.photoURL || null
  };

  await db.ref('users/' + uid).update(updatedData);

  await db.ref('guru_claimed/' + dataGuru.nip).set({
    uid: uid,
    email: email,
    nama: dataGuru.nama,
    role: role,
    waktu: new Date().toISOString()
  });

  if (encoded) {
    try {
      await db.ref('email_mapping/' + encoded).set({
        nama: dataGuru.nama,
        nip: dataGuru.nip,
        role: role,
        isWalas: dataGuru.isWalas,
        walasKelasId: dataGuru.walasKelasId
      });
    } catch (e) {}
  }

  setSessionUser(updatedData);
  return updatedData;
}

// 5d. Validasi dan Konfirmasi Administrator (PRD Bab 3)
async function konfirmasiTautkanAdmin(kodeAdmin) {
  const currentFbUser = firebase.auth().currentUser;
  if (!currentFbUser) throw new Error('Sesi tidak aktif. Silakan masuk kembali.');

  const KODE_VALID = ['admin2026', 'nesas2026', 'admin123', 'ujikom2026', 'smkn1sumedang'];
  const cleanCode = (kodeAdmin || '').trim().toLowerCase();
  if (!KODE_VALID.includes(cleanCode)) {
    throw new Error('Kode sandi administrator salah. Gunakan kode admin yang sah (misal: admin2026 atau nesas2026).');
  }

  const uid = currentFbUser.uid;
  const email = currentFbUser.email || '';
  const encoded = encodeEmail(email);

  const updatedData = {
    uid: uid,
    email: email,
    nama: currentFbUser.displayName || 'Administrator Sistem',
    role: 'admin',
    isVerified: true,
    admin_verified_at: new Date().toISOString(),
    foto_google: currentFbUser.photoURL || null
  };

  await db.ref('users/' + uid).update(updatedData);

  if (encoded) {
    try {
      await db.ref('email_mapping/' + encoded).set({
        nama: updatedData.nama,
        role: 'admin'
      });
    } catch (e) {}
  }

  setSessionUser(updatedData);
  return updatedData;
}

function getDashboardUrlByRole(role) {
  if (role === 'admin') return 'admin.html';
  if (role === 'guru' || role === 'walas') return 'dashboard-guru.html';
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

// 9. Unified Role Switcher (PRD UJIKOM 2026)
async function gantiRoleSesi(targetRole, payload = {}) {
  const currentFbUser = (typeof firebase !== 'undefined' && firebase.auth) ? firebase.auth().currentUser : null;
  const currentSession = (typeof getSessionUser === 'function' ? getSessionUser() : null) || {};
  const uid = (currentFbUser && currentFbUser.uid) || currentSession.uid || ('DEMO_' + Date.now());
  const email = (currentFbUser && currentFbUser.email) || currentSession.email || (targetRole + '@smkn1sumedang.sch.id');
  const encoded = encodeEmail(email);

  let defaultData = {};
  if (targetRole === 'admin') {
    defaultData = {
      role: 'admin',
      nama: 'Administrator Sistem',
      isVerified: true,
      nisn: null,
      kelas: null,
      nip: null,
      mapel: null,
      isWalas: false,
      walasKelasId: null
    };
  } else if (targetRole === 'walas') {
    defaultData = {
      role: 'walas',
      nama: 'Muhammad Echa Putra, S.Kom.Gr',
      nip: '199209142022211007',
      mapel: 'Basis Data & Pemodelan RPL',
      isWalas: true,
      walasKelasId: 'XII RPL 2',
      isVerified: true,
      nisn: null,
      kelas: null
    };
  } else if (targetRole === 'guru') {
    defaultData = {
      role: 'guru',
      nama: 'Hani Hanifah, S.Si',
      nip: '198109012009022003',
      mapel: 'Pemrograman Web & Perangkat Bergerak',
      isWalas: false,
      walasKelasId: null,
      isVerified: true,
      nisn: null,
      kelas: null
    };
  } else if (targetRole === 'siswa') {
    defaultData = {
      role: 'siswa',
      nama: 'M. Ihsan Athallah',
      nisn: '0098263610',
      kelas: 'XII RPL 2',
      isVerified: true,
      nip: null,
      mapel: null,
      isWalas: false,
      walasKelasId: null
    };
  } else {
    targetRole = 'pengunjung';
    defaultData = {
      role: 'pengunjung',
      nama: (currentFbUser && currentFbUser.displayName) || currentSession.nama || 'Pengunjung / Tamu Sekolah',
      nisn: null,
      kelas: null,
      nip: null,
      mapel: null,
      isWalas: false,
      walasKelasId: null,
      isVerified: false
    };
  }

  const isSwitched = (targetRole !== 'admin');
  const updatedData = {
    uid: uid,
    email: email,
    foto_google: (currentFbUser && currentFbUser.photoURL) || currentSession.foto_google || null,
    ...defaultData,
    ...payload,
    role: targetRole,
    isRoleSwitched: isSwitched,
    switched_at: new Date().toISOString()
  };

  // 1. Simpan di sessionStorage & localStorage
  setSessionUser(updatedData);
  try {
    if (isSwitched) {
      sessionStorage.setItem('isRoleSwitched', 'true');
      localStorage.setItem('isRoleSwitched', 'true');
    } else {
      sessionStorage.removeItem('isRoleSwitched');
      localStorage.removeItem('isRoleSwitched');
    }
    if (updatedData.nisn) {
      localStorage.setItem('nisn_aktif', updatedData.nisn);
    } else {
      localStorage.removeItem('nisn_aktif');
    }
  } catch (e) {}

  // 2. Simpan di Firebase RTDB jika db tersedia (non-blocking)
  if (typeof db !== 'undefined' && db) {
    try {
      db.ref('users/' + uid).update(updatedData).catch(e => {
        console.warn('Update users/{uid} dilewati:', e.message);
      });
    } catch (e) {}

    if (encoded && (!isSwitched || (typeof isEmailAdmin === 'function' && !isEmailAdmin(email)))) {
      try {
        db.ref('email_mapping/' + encoded).set({
          nama: updatedData.nama,
          role: updatedData.role,
          nisn: updatedData.nisn || null,
          kelas: updatedData.kelas || null,
          nip: updatedData.nip || null,
          isWalas: !!updatedData.isWalas,
          walasKelasId: updatedData.walasKelasId || null
        }).catch(() => {});
      } catch (e) {}
    }
  }

  // 3. Clean redirect ke dashboard URL sesuai targetRole
  const targetUrl = (typeof getDashboardUrlByRole === 'function')
    ? getDashboardUrlByRole(targetRole)
    : (targetRole === 'admin' ? 'admin.html' : ((targetRole === 'guru' || targetRole === 'walas') ? 'dashboard-guru.html' : 'dashboard.html'));

  if (typeof window !== 'undefined' && window.location) {
    window.location.href = targetUrl;
  }

  return updatedData;
}

// 10. Guard Helper Akses Halaman
function verifikasiAksesHalaman(allowedRoles) {
  const user = (typeof getSessionUser === 'function') ? getSessionUser() : null;
  if (!user || !user.role) {
    if (typeof window !== 'undefined' && window.location) {
      window.location.href = 'index.html';
    }
    return false;
  }
  if (Array.isArray(allowedRoles) && !allowedRoles.includes(user.role)) {
    const targetUrl = (typeof getDashboardUrlByRole === 'function') ? getDashboardUrlByRole(user.role) : 'dashboard.html';
    if (typeof window !== 'undefined' && window.location) {
      window.location.href = targetUrl;
    }
    return false;
  }
  return true;
}

if (typeof window !== 'undefined') {
  window.getDashboardUrlByRole = getDashboardUrlByRole;
  window.gantiRoleSesi = gantiRoleSesi;
  window.verifikasiAksesHalaman = verifikasiAksesHalaman;
}
