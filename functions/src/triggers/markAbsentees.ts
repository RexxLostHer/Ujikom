import { onSchedule } from 'firebase-functions/v2/scheduler';
import { db, FieldValue } from '../utils/admin';

export async function executeMarkAbsentees(
  customDate?: string,
  database = db
): Promise<{ processed: number; marked: number }> {
  const now = new Date();
  const wibTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const yyyy = wibTime.getUTCFullYear();
  const mm = String(wibTime.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(wibTime.getUTCDate()).padStart(2, '0');

  const dateStr = customDate || `${yyyy}-${mm}-${dd}`;
  const dateKey = dateStr.replace(/-/g, '');

  // Query all active placed students
  const studentsSnap = await database
    .collection('users')
    .where('role', '==', 'siswa')
    .where('isActive', '==', true)
    .get();

  const placedStudents = studentsSnap.docs
    .map((doc) => ({ id: doc.id, data: doc.data() }))
    .filter((s) => !!s.data.companyId);

  const processed = placedStudents.length;
  let marked = 0;

  const BATCH_LIMIT = 400; // Strictly <= 400 writes per commit (Firestore platform max is 500)
  let currentBatch = database.batch();
  let operationsInBatch = 0;

  // Process students in chunks of 50 for parallel attendance verification
  const READ_CHUNK_SIZE = 50;
  for (let i = 0; i < placedStudents.length; i += READ_CHUNK_SIZE) {
    const studentChunk = placedStudents.slice(i, i + READ_CHUNK_SIZE);

    const attDocs = await Promise.all(
      studentChunk.map((student) => {
        const attId = `${student.id}_${dateKey}`;
        return database.collection('attendances').doc(attId).get();
      })
    );

    for (let j = 0; j < studentChunk.length; j++) {
      const student = studentChunk[j];
      const attDoc = attDocs[j];
      const attRef = attDoc.ref;

      if (!attDoc.exists) {
        currentBatch.set(attRef, {
          id: attDoc.id,
          schoolId: student.data.schoolId,
          uid: student.id,
          companyId: student.data.companyId,
          date: dateStr,
          status: 'alpha',
          logbookSubmitted: false,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        marked++;
        operationsInBatch++;
      } else if (attDoc.data()?.status === 'pending') {
        currentBatch.update(attRef, {
          status: 'alpha',
          updatedAt: FieldValue.serverTimestamp(),
        });
        marked++;
        operationsInBatch++;
      }

      if (operationsInBatch >= BATCH_LIMIT) {
        await currentBatch.commit();
        currentBatch = database.batch();
        operationsInBatch = 0;
      }
    }
  }

  // Commit any remaining writes in the last batch
  if (operationsInBatch > 0) {
    await currentBatch.commit();
  }

  console.log(
    `[markAbsentees] Processed ${processed} students, marked ${marked} as alpha for date ${dateStr}.`
  );
  return { processed, marked };
}

export const markAbsentees = onSchedule(
  {
    schedule: '0 18 * * *',
    timeZone: 'Asia/Jakarta',
  },
  async () => {
    await executeMarkAbsentees();
  }
);
