import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db, FieldValue } from '../utils/admin';
import { calculateHaversineDistance } from '../utils/geo';
import { validateQrToken } from '../utils/qr';

export interface VerifyCheckoutRequest {
  companyId: string;
  token: string;
  coords: {
    lat: number;
    lng: number;
  };
}

export async function handleVerifyCheckout(
  request: { auth?: { uid: string } | null; data: VerifyCheckoutRequest },
  database = db
) {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Autentikasi diperlukan untuk presensi pulang.');
  }

  const uid = request.auth.uid;
  const { companyId, token, coords } = request.data || {};

  if (!companyId || !token || !coords || typeof coords.lat !== 'number' || typeof coords.lng !== 'number') {
    throw new HttpsError('invalid-argument', 'Data presensi pulang tidak lengkap.');
  }

  // 1. Calculate today's attendance ID
  const now = new Date();
  const wibTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const yyyy = wibTime.getUTCFullYear();
  const mm = String(wibTime.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(wibTime.getUTCDate()).padStart(2, '0');
  const attendanceId = `${uid}_${yyyy}${mm}${dd}`;

  const attRef = database.collection('attendances').doc(attendanceId);
  const attDoc = await attRef.get();

  if (!attDoc.exists) {
    throw new HttpsError('not-found', 'Presensi masuk hari ini belum tercatat.');
  }

  const attData = attDoc.data()!;

  // Enforce company consistency between check-in and checkout
  if (!attData.companyId || attData.companyId !== companyId) {
    throw new HttpsError(
      'permission-denied',
      'Perusahaan presensi pulang tidak sesuai dengan perusahaan presensi masuk.'
    );
  }

  // 2. ENFORCE CHECK-OUT GATE: logbookSubmitted MUST BE TRUE
  if (attData.logbookSubmitted !== true) {
    throw new HttpsError(
      'failed-precondition',
      'Presensi pulang terkunci: Selesaikan dan simpan logbook harian terlebih dahulu.'
    );
  }

  // 3. Verify Dynamic QR Token
  const qrRef = database.collection('qrTokens').doc(companyId);
  const qrDoc = await qrRef.get();
  if (!qrDoc.exists) {
    throw new HttpsError('not-found', 'QR Presensi belum diaktifkan.');
  }

  const qrData = qrDoc.data()!;
  const qrValidation = validateQrToken(qrData.token, token, qrData.expiresAt, Date.now(), 30000);
  if (!qrValidation.valid) {
    throw new HttpsError(
      (qrValidation.code as any) || 'invalid-argument',
      qrValidation.message || 'Token QR tidak valid.'
    );
  }

  // 4. Verify Geofence
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

  const roundedDistance = Math.round(distance * 10) / 10;

  // 5. Update Check-Out Record
  await attRef.update({
    checkOut: {
      time: FieldValue.serverTimestamp(),
      lat: coords.lat,
      lng: coords.lng,
      distanceMeters: roundedDistance,
      verifiedServerSide: true,
    },
    updatedAt: FieldValue.serverTimestamp(),
  });

  return {
    success: true,
    distanceMeters: roundedDistance,
    attendanceId,
    message: 'Presensi pulang berhasil diverifikasi.',
  };
}

export const verifyCheckout = onCall<VerifyCheckoutRequest>((request) =>
  handleVerifyCheckout(request)
);
