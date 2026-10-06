/**
 * VokaLog Local Database Seeder
 * Connects directly to Firebase Emulator Suite (Auth 9099, Firestore 8080)
 * Fully idempotent. Seeds SMKN 1 Sumedang, roster, staff, and DU/DI companies.
 */

// Force emulator environment variables
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'vokalog-smkn1sumedang';

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin (no credentials required against local emulators)
if (!admin.apps.length) {
  admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
}

const db = admin.firestore();
const auth = admin.auth();

const SCHOOL_ID = 'smkn1sumedang';

// Helper to upsert auth user idempotently
async function upsertAuthUser({ uid, email, password, displayName }) {
  try {
    return await auth.createUser({ uid, email, password, displayName });
  } catch (error) {
    if (error.code === 'auth/uid-already-exists' || error.code === 'auth/email-already-exists') {
      return await auth.updateUser(uid, { email, password, displayName });
    }
    throw error;
  }
}

async function runSeed() {
  console.log(`[Seed] Starting VokaLog database seeding...`);
  console.log(`  Firestore: ${process.env.FIRESTORE_EMULATOR_HOST}`);
  console.log(`  Auth:      ${process.env.FIREBASE_AUTH_EMULATOR_HOST}`);
  console.log(`  Project:   ${process.env.GCLOUD_PROJECT}\n`);

  const now = admin.firestore.Timestamp.now();

  // 1. Seed School Root Document
  console.log(`[1/7] Seeding School: SMK Negeri 1 Sumedang...`);
  await db.collection('schools').doc(SCHOOL_ID).set({
    id: SCHOOL_ID,
    name: 'SMK Negeri 1 Sumedang',
    npsn: '20208393',
    address: 'Jl. Mayor Abdurakhman No. 209, Kotakaler, Sumedang Utara, Jawa Barat 45322',
    phone: '(0261) 202056',
    email: 'smkn1smd@gmail.com',
    website: 'www.smkn1sumedang.sch.id',
    talentThreshold: 85,
    activeAcademicYearId: '2026-2027',
    createdAt: now,
    updatedAt: now
  }, { merge: true });

  // 2. Seed Academic Year
  console.log(`[2/7] Seeding Academic Year 2026/2027...`);
  await db.collection('academicYears').doc('2026-2027').set({
    id: '2026-2027',
    schoolId: SCHOOL_ID,
    name: 'Tahun Pelajaran 2026/2027',
    semester: 'Ganjil',
    isActive: true,
    startDate: '2026-07-15',
    endDate: '2026-12-20',
    createdAt: now
  }, { merge: true });

  // 3. Seed Majors (Strict Invariant: RPL and TKJ only)
  console.log(`[3/7] Seeding Majors (RPL & TKJ)...`);
  const majors = [
    {
      id: 'RPL',
      schoolId: SCHOOL_ID,
      code: 'RPL',
      name: 'Rekayasa Perangkat Lunak',
      headOfMajor: 'Muhammad Echa Putra, S.Kom.Gr',
      officialClasses: ['XII RPL 1', 'XII RPL 2']
    },
    {
      id: 'TKJ',
      schoolId: SCHOOL_ID,
      code: 'TKJ',
      name: 'Teknik Komputer dan Jaringan',
      headOfMajor: 'Rijal Nur Rahmat, S.T',
      officialClasses: ['XII TKJ 1']
    }
  ];
  for (const major of majors) {
    await db.collection('majors').doc(major.id).set(major, { merge: true });
  }

  // 4. Seed DU/DI Partner Companies
  console.log(`[4/7] Seeding Partner Companies (Platform-Level)...`);
  const companies = [
    {
      id: 'comp_telkom_smd',
      name: 'PT Telkom Indonesia (Witel Sumedang)',
      address: 'Jl. Mayor Abdurakhman No. 120, Kotakaler, Kec. Sumedang Utara, Kabupaten Sumedang, Jawa Barat 45322',
      lat: -6.8584,
      lng: 107.9212,
      geofenceRadiusMeters: 50,
      jurusanAllowed: ['RPL', 'TKJ'],
      quota: 10,
      filledQuota: 1, // Student Luthfi placed here
      createdBySchoolId: SCHOOL_ID,
      contactPerson: 'Budi Santoso, S.T.',
      contactPhone: '08122334455',
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'comp_inovatech',
      name: 'PT Inovasi Digital Nusantara (InovaTech)',
      address: 'Jl. Prabu Geusan Ulun No. 45, Sumedang Selatan, Jawa Barat 45311',
      lat: -6.8595,
      lng: 107.9230,
      geofenceRadiusMeters: 50,
      jurusanAllowed: ['RPL'],
      quota: 5,
      filledQuota: 0,
      createdBySchoolId: SCHOOL_ID,
      contactPerson: 'Hendra Gunawan',
      contactPhone: '08571234567',
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'comp_netpass',
      name: 'PT Jaringan Fiber Pasundan (NetPass)',
      address: 'Jl. Angkrek No. 18, Sumedang Utara, Jawa Barat 45323',
      lat: -6.8550,
      lng: 107.9180,
      geofenceRadiusMeters: 50,
      jurusanAllowed: ['TKJ'],
      quota: 6,
      filledQuota: 0,
      createdBySchoolId: SCHOOL_ID,
      contactPerson: 'Ahmad Sofyan',
      contactPhone: '08781234999',
      createdAt: now,
      updatedAt: now
    }
  ];
  for (const comp of companies) {
    await db.collection('companies').doc(comp.id).set(comp, { merge: true });
  }

  // 5. Seed Roster Data from seed/roster-data.json
  console.log(`[5/7] Seeding Student Roster (XII RPL 1, XII RPL 2, XII TKJ 1)...`);
  const rosterPath = path.join(__dirname, 'roster-data.json');
  let rosterData = {};
  if (fs.existsSync(rosterPath)) {
    rosterData = JSON.parse(fs.readFileSync(rosterPath, 'utf8'));
  } else {
    const legacyPath = path.join(__dirname, '..', 'siswa-clean-firebase.json');
    if (fs.existsSync(legacyPath)) {
      rosterData = JSON.parse(fs.readFileSync(legacyPath, 'utf8'));
    }
  }

  const batch = db.batch();
  let rosterCount = 0;

  for (const [nisn, student] of Object.entries(rosterData)) {
    const isDemoLuthfi = (nisn === '0087121894');
    const jurusanId = (student.kelas && student.kelas.includes('TKJ')) ? 'TKJ' : 'RPL';
    
    const rosterRef = db.collection('roster').doc(nisn);
    batch.set(rosterRef, {
      nisn: student.nisn || nisn,
      nama: student.nama,
      name: student.nama,
      kelas: student.kelas,
      nis: student.nis || '',
      email: student.email || `${nisn}@smkn1sumedang.sch.id`,
      schoolId: SCHOOL_ID,
      jurusanId,
      isRegistered: isDemoLuthfi, // Luthfi pre-registered as demo student
      createdAt: now
    }, { merge: true });
    rosterCount++;
  }
  await batch.commit();
  console.log(`  -> Successfully seeded ${rosterCount} roster records.`);

  // 6. Seed Demo Users for All 5 Actors
  console.log(`[6/7] Seeding Demo Accounts (5 Roles in Auth & Firestore)...`);
  const demoUsers = [
    {
      uid: 'user_superadmin_01',
      email: 'superadmin@vokalog.id',
      password: 'Password123!',
      displayName: 'Super Administrator',
      role: 'admin',
      schoolId: null, // Platform Super Admin
      phone: '08110000001'
    },
    {
      uid: 'user_admin_smkn1smd',
      email: 'admin@smkn1sumedang.sch.id',
      password: 'Password123!',
      displayName: 'Admin Hubin SMKN 1 Sumedang',
      role: 'admin',
      schoolId: SCHOOL_ID,
      phone: '08110000002'
    },
    {
      uid: 'user_guru_hery',
      email: 'guru@smkn1sumedang.sch.id',
      password: 'Password123!',
      displayName: 'Heri Anggara, S.Kom',
      role: 'guru',
      schoolId: SCHOOL_ID,
      nip: '198504252024211008',
      phone: '08110000003'
    },
    {
      uid: 'user_pembimbing_telkom',
      email: 'pembimbing@telkom.co.id',
      password: 'Password123!',
      displayName: 'Budi Santoso, S.T.',
      role: 'pembimbing',
      schoolId: SCHOOL_ID,
      companyId: 'comp_telkom_smd',
      phone: '08110000004'
    },
    {
      uid: 'user_siswa_luthfi',
      email: 'siswa@smkn1sumedang.sch.id',
      password: 'Password123!',
      displayName: 'Luthfi Nur Zaidan',
      role: 'siswa',
      schoolId: SCHOOL_ID,
      nisn: '0087121894',
      kelas: 'XII RPL 2',
      jurusanId: 'RPL',
      nis: '24.25.X.662',
      companyId: 'comp_telkom_smd',
      statusPkl: 'aktif',
      isActive: true,
      phone: '08110000005'
    }
  ];

  for (const user of demoUsers) {
    // Upsert Auth user
    await upsertAuthUser({
      uid: user.uid,
      email: user.email,
      password: user.password,
      displayName: user.displayName
    });

    // Set Custom Claims for security rules
    await auth.setCustomUserClaims(user.uid, {
      role: user.role,
      schoolId: user.schoolId,
      companyId: user.companyId || null
    });

    // Save Firestore UserDoc
    const userDocData = { ...user };
    delete userDocData.password;
    userDocData.createdAt = now;
    userDocData.updatedAt = now;

    await db.collection('users').doc(user.uid).set(userDocData, { merge: true });
    console.log(`  -> Seeded ${user.role.toUpperCase()}: ${user.email} (UID: ${user.uid})`);
  }

  // 7. Seed Active Demo State Records (for immediate flow testing)
  console.log(`[7/7] Seeding Active Demo State Records (QR Token, Attendance)...`);
  
  // Active QR Token for PT Telkom valid for 60s
  const qrExpiresAt = new admin.firestore.Timestamp(now.seconds + 60, 0);
  await db.collection('qrTokens').doc('comp_telkom_smd').set({
    token: 'token-telkom-demo-active',
    companyId: 'comp_telkom_smd',
    lat: -6.8584,
    lng: 107.9212,
    expiresAt: qrExpiresAt,
    generatedBy: 'user_pembimbing_telkom',
    createdAt: now
  });

  // Sample Today's Attendance Record for Luthfi
  const todayIso = new Date().toISOString().slice(0, 10);
  const todayStr = todayIso.replace(/-/g, '');
  const attendanceId = `user_siswa_luthfi_${todayStr}`;
  await db.collection('attendances').doc(attendanceId).set({
    id: attendanceId,
    uid: 'user_siswa_luthfi',
    studentId: 'user_siswa_luthfi',
    schoolId: SCHOOL_ID,
    companyId: 'comp_telkom_smd',
    date: todayIso,
    status: 'hadir',
    logbookSubmitted: false, // Initially false to verify checkout gate
    checkIn: {
      time: now,
      lat: -6.8584,
      lng: 107.9212,
      distanceMeters: 12.5,
      verifiedServerSide: true
    },
    createdAt: now
  }, { merge: true });

  console.log(`\n=======================================================`);
  console.log(`[Seed Complete] VokaLog local database seeded successfully!`);
  console.log(`Demo Logins:`);
  console.log(`  Super Admin:         superadmin@vokalog.id      / Password123!`);
  console.log(`  Admin Sekolah:       admin@smkn1sumedang.sch.id / Password123!`);
  console.log(`  Guru Pembimbing:     guru@smkn1sumedang.sch.id  / Password123!`);
  console.log(`  Pembimbing Instansi: pembimbing@telkom.co.id    / Password123!`);
  console.log(`  Siswa:               siswa@smkn1sumedang.sch.id / Password123!`);
  console.log(`=======================================================\n`);
}

runSeed().catch((err) => {
  console.error('[Seed Error] Seeder failed:', err);
  process.exit(1);
});
