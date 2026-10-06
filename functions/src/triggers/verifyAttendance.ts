import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db, FieldValue } from '../utils/admin';
import { calculateHaversineDistance } from '../utils/geo';
import { validateQrToken } from '../utils/qr';

export interface VerifyAttendanceRequest {
  companyId: string;
  token: string;
  coords: {
    lat: number;
    lng: number;
  };
}

export async function handleVerifyAttendance(
  request: { auth?: { uid: string } | null; data: VerifyAttendanceRequest },
  database = db
) {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Autentikasi diperlukan untuk presensi masuk.');
  }

  const uid = request.auth.uid;
  const { companyId, token, coords } = request.data || {};

  if (!companyId || !token || !coords || typeof coords.lat !== 'number' || typeof coords.lng !== 'number') {
    throw new HttpsError('invalid-argument', 'Data presensi tidak lengkap.');
  }

  // 1. Verify Dynamic QR Token
  const qrRef = database.collection('qrTokens').doc(companyId);
  const qrDoc = await qrRef.get();
  if (!qrDoc.exists) {
    throw new HttpsError('not-found', 'QR Presensi untuk perusahaan ini belum diaktifkan.');
  }

  const qrData = qrDoc.data()!;
  const qrValidation = validateQrToken(qrData.token, token, qrData.expiresAt, Date.now(), 30000);
  if (!qrValidation.valid) {
    throw new HttpsError(
      (qrValidation.code as any) || 'invalid-argument',
      qrValidation.message || 'Token QR tidak valid.'
    );
  }

  // 2. Fetch Company Coordinates and verify Geofence
  const compRef = database.collection('companies').doc(companyId);
  const compDoc = await compRef.get();
  if (!compDoc.exists) {
    throw new HttpsError('not-found', 'Data perusahaan tidak ditemukan.');
  }

  const company = compDoc.data()!;
  const allowedRadius = company.geofenceRadiusMeters || 50;
  const distance = calculateHaversineDistance(coords.lat, coords.lng, company.lat, company.lng);

  if (distance > allowedRadius) {
    throw new HttpsError(
      'failed-precondition',
      `Di luar radius presensi perusahaan (${distance.toFixed(1)}m > ${allowedRadius}m).`
    );
  }

  // 3. Verify Student Profile & Placement
  const userRef = database.collection('users').doc(uid);
  const userDoc = await userRef.get();
  if (!userDoc.exists) {
    throw new HttpsError('not-found', 'Profil siswa tidak ditemukan.');
  }

  const userData = userDoc.data()!;
  if (!userData.companyId || userData.companyId !== companyId) {
    throw new HttpsError('permission-denied', 'Anda belum ditempatkan di perusahaan ini.');
  }

  // 4. Construct Attendance Record ID: {uid}_{yyyyMMdd} in WIB (UTC+7)
  const now = new Date();
  const wibTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const yyyy = wibTime.getUTCFullYear();
  const mm = String(wibTime.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(wibTime.getUTCDate()).padStart(2, '0');
  const dateStr = `${yyyy}-${mm}-${dd}`;
  const attendanceId = `${uid}_${yyyy}${mm}${dd}`;

  const attRef = database.collection('attendances').doc(attendanceId);
  const existingAtt = await attRef.get();

  const roundedDistance = Math.round(distance * 10) / 10;

  if (existingAtt.exists && existingAtt.data()?.checkIn) {
    return {
      success: true,
      message: 'Presensi masuk hari ini sudah tercatat.',
      distanceMeters: roundedDistance,
      attendanceId,
    };
  }

  await attRef.set(
    {
      id: attendanceId,
      schoolId: userData.schoolId,
      uid,
      companyId,
      date: dateStr,
      status: 'hadir',
      logbookSubmitted: existingAtt.exists ? existingAtt.data()?.logbookSubmitted || false : false,
      checkIn: {
        time: FieldValue.serverTimestamp(),
        lat: coords.lat,
        lng: coords.lng,
        distanceMeters: roundedDistance,
        verifiedServerSide: true,
      },
      updatedAt: FieldValue.serverTimestamp(),
      ...(existingAtt.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
    },
    { merge: true }
  );

  return {
    success: true,
    distanceMeters: roundedDistance,
    attendanceId,
    message: 'Presensi masuk berhasil diverifikasi.',
  };
}

export const verifyAttendance = onCall<VerifyAttendanceRequest>((request) =>
  handleVerifyAttendance(request)
);
