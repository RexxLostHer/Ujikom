import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db } from '../utils/admin';

export interface LookupNisnRequest {
  nisn: string;
  schoolId?: string;
}

export interface LookupNisnResponse {
  found: boolean;
  registered: boolean;
  status: 'valid' | 'already-registered' | 'not-found';
  student?: {
    name: string;
    nisn: string;
    schoolId: string;
    jurusanId: string;
    kelas: string;
  };
  message?: string;
}

export async function handleLookupNisn(
  data: LookupNisnRequest,
  database = db
): Promise<LookupNisnResponse> {
  const { nisn, schoolId } = data || {};

  if (!nisn || typeof nisn !== 'string') {
    throw new HttpsError('invalid-argument', 'NISN wajib diisi.');
  }

  const cleanNisn = nisn.trim();
  if (!/^\d{10}$/.test(cleanNisn)) {
    throw new HttpsError('invalid-argument', 'NISN harus terdiri dari 10 digit angka.');
  }

  let dataResult: any = null;
  const directDoc = await database.collection('roster').doc(cleanNisn).get();
  if (directDoc.exists) {
    const docData = directDoc.data()!;
    if (!schoolId || docData.schoolId === schoolId) {
      dataResult = docData;
    }
  }

  if (!dataResult) {
    let query = database.collection('roster').where('nisn', '==', cleanNisn);
    if (schoolId) {
      query = query.where('schoolId', '==', schoolId);
    }
    const snapshot = await query.limit(1).get();
    if (!snapshot.empty) {
      dataResult = snapshot.docs[0].data();
    }
  }

  if (!dataResult) {
    return {
      found: false,
      registered: false,
      status: 'not-found',
      message: 'NISN tidak terdaftar pada data sekolah.',
    };
  }

  if (dataResult.isRegistered === true) {
    return {
      found: true,
      registered: true,
      status: 'already-registered',
      message: 'NISN telah digunakan, silakan login ke akun Anda.',
    };
  }

  return {
    found: true,
    registered: false,
    status: 'valid',
    student: {
      name: dataResult.name || dataResult.nama,
      nisn: dataResult.nisn,
      schoolId: dataResult.schoolId,
      jurusanId: dataResult.jurusanId,
      kelas: dataResult.kelas,
    },
    message: 'Data siswa valid dan siap didaftarkan.',
  };
}

export const lookupNisn = onCall<LookupNisnRequest>((request) =>
  handleLookupNisn(request.data)
);
