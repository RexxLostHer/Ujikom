import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { db, FieldValue } from '../utils/admin';

export async function handleLogbookCreated(
  logbook: any,
  logbookId: string,
  database = db
): Promise<void> {
  if (!logbook) return;

  // Resolve attendance document ID
  let attendanceId = logbook.attendanceId;
  if (!attendanceId && logbook.uid && logbook.date) {
    attendanceId = `${logbook.uid}_${logbook.date.replace(/-/g, '')}`;
  }

  if (!attendanceId) {
    console.warn(`[onLogbookCreated] Logbook ${logbookId} missing attendanceId.`);
    return;
  }

  const attRef = database.collection('attendances').doc(attendanceId);
  await attRef.set(
    {
      logbookSubmitted: true,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  console.log(`[onLogbookCreated] Set logbookSubmitted=true on attendances/${attendanceId}`);
}

export const onLogbookCreated = onDocumentCreated('logbooks/{logbookId}', async (event) => {
  const snapshot = event.data;
  if (!snapshot) return;

  const logbook = snapshot.data();
  await handleLogbookCreated(logbook, event.params.logbookId);
});
