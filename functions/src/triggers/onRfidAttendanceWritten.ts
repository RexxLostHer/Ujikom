import { onValueWritten } from 'firebase-functions/v2/database';
import { db, FieldValue } from '../utils/admin';

export interface RfidAttendanceRecord {
  id?: string;
  nisn?: string;
  nama?: string;
  kelas?: string;
  tipe?: string;
  tanggal?: string;
  waktu?: string;
  jam?: string;
  status?: string;
  metode?: string;
  uid_kartu?: string;
  device_id?: string;
  timestamp?: number;
}

/**
 * Synchronizes an RFID tap event from RTDB /absensi/{tanggal}/{userId} to Firestore attendances (FR-3.2).
 */
export async function syncRfidRecordToFirestore(
  tanggal: string,
  userId: string,
  record: RfidAttendanceRecord | null,
  database = db
): Promise<boolean> {
  if (!record || !record.status) {
    return false;
  }

  const normalizedStatus = String(record.status).toLowerCase().trim();
  // Only sync verified presence events (hadir / terlambat)
  if (!['hadir', 'terlambat'].includes(normalizedStatus)) {
    return false;
  }

  const dateKey = tanggal.replace(/-/g, '');
  const nisn = record.nisn || userId;

  // Resolve target Firestore user ID by checking users collection
  let firestoreUid = userId;
  const userByNisn = await database
    .collection('users')
    .where('nisn', '==', nisn)
    .limit(1)
    .get();

  if (!userByNisn.empty) {
    firestoreUid = userByNisn.docs[0].id;
  }

  const attendanceDocId = `${firestoreUid}_${dateKey}`;
  const attRef = database.collection('attendances').doc(attendanceDocId);

  await attRef.set(
    {
      userId: firestoreUid,
      nisn: nisn,
      studentName: record.nama || '',
      date: tanggal,
      status: normalizedStatus,
      method: 'rfid_gateway',
      deviceId: record.device_id || 'unknown',
      cardUid: record.uid_kartu || '',
      verified: true,
      checkInTime: record.waktu ? `${tanggal}T${record.waktu}+07:00` : FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  return true;
}

export const onRfidAttendanceWritten = onValueWritten(
  '/absensi/{tanggal}/{userId}',
  async (event) => {
    const afterData = event.data.after.val() as RfidAttendanceRecord | null;
    const { tanggal, userId } = event.params;
    await syncRfidRecordToFirestore(tanggal, userId, afterData);
  }
);
