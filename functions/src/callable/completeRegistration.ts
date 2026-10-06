import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db, FieldValue } from '../utils/admin';

export interface CompleteRegistrationRequest {
  nisn: string;
  phone?: string;
}

export interface CompleteRegistrationResponse {
  success: boolean;
  uid: string;
  message?: string;
}

export async function handleCompleteRegistration(
  data: CompleteRegistrationRequest,
  authContext: any,
  database = db
): Promise<CompleteRegistrationResponse> {
  if (!authContext) {
    throw new HttpsError('unauthenticated', 'Pengguna harus login untuk menyelesaikan registrasi.');
  }

  const uid = authContext.uid;
  const email = authContext.token?.email || authContext.email || '';
  const { nisn, phone } = data || {};

  if (!nisn || typeof nisn !== 'string' || !/^\d{10}$/.test(nisn.trim())) {
    throw new HttpsError('invalid-argument', 'NISN tidak valid.');
  }

  const cleanNisn = nisn.trim();

  return await database.runTransaction(async (transaction) => {
    // 1. Check if user profile already exists
    const userRef = database.collection('users').doc(uid);
    const userDoc = await transaction.get(userRef);
    if (userDoc.exists && userDoc.data()?.isRegistered === true) {
      throw new HttpsError('already-exists', 'Akun pengguna ini sudah terdaftar.');
    }

    // 2. Query roster for NISN
    const directDocRef = database.collection('roster').doc(cleanNisn);
    const directDoc = await transaction.get(directDocRef);
    let rosterDocRef = directDocRef;
    let rosterData: any = null;

    if (directDoc.exists) {
      rosterData = directDoc.data();
    } else {
      const rosterQuery = database.collection('roster').where('nisn', '==', cleanNisn).limit(1);
      const rosterSnap = await transaction.get(rosterQuery);
      if (rosterSnap.empty) {
        throw new HttpsError('not-found', 'Data siswa dengan NISN ini tidak ditemukan di buku induk.');
      }
      rosterDocRef = rosterSnap.docs[0].ref;
      rosterData = rosterSnap.docs[0].data();
    }

    if (rosterData.isRegistered === true) {
      throw new HttpsError('already-exists', 'NISN ini sudah didaftarkan oleh akun lain.');
    }

    // 3. Mark roster record as registered
    transaction.update(rosterDocRef, {
      isRegistered: true,
      registeredUid: uid,
      registeredAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // 4. Create user profile in users/{uid}
    transaction.set(userRef, {
      uid,
      role: 'siswa',
      schoolId: rosterData.schoolId,
      jurusanId: rosterData.jurusanId,
      nisn: rosterData.nisn,
      name: rosterData.name || rosterData.nama,
      email,
      phone: phone || null,
      kelas: rosterData.kelas,
      companyId: null,
      isRegistered: true,
      isActive: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // 5. Increment school registered quota
    const schoolRef = database.collection('schools').doc(rosterData.schoolId);
    transaction.update(schoolRef, {
      studentQuotaUsed: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      uid,
      message: 'Registrasi akun siswa berhasil diselesaikan.',
    };
  });
}

export const completeRegistration = onCall<CompleteRegistrationRequest>((request) =>
  handleCompleteRegistration(request.data, request.auth)
);
