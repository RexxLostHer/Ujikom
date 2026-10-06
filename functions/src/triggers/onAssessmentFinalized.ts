import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { db, FieldValue } from '../utils/admin';
import { createNotification } from '../utils/notify';

export async function handleAssessmentFinalized(
  before: any,
  after: any,
  assessmentId: string,
  database = db,
  notifyFn = createNotification
): Promise<void> {
  if (!before || !after) return;

  // Trigger when status becomes 'final'
  if (before.status === 'final' || after.status !== 'final') {
    return;
  }

  const { schoolId, studentId, finalScore } = after;

  let talentThreshold = 85;
  if (schoolId) {
    const schoolDoc = await database.collection('schools').doc(schoolId).get();
    if (schoolDoc.exists) {
      talentThreshold = schoolDoc.data()?.talentThreshold ?? 85;
    }
  }

  const isRecommendedTalent = typeof finalScore === 'number' && finalScore >= talentThreshold;

  await database.collection('assessments').doc(assessmentId).update({
    isRecommendedTalent,
    updatedAt: FieldValue.serverTimestamp(),
  });

  const body = isRecommendedTalent
    ? `Selamat! Nilai akhir PKL Anda adalah ${finalScore}. Anda memenuhi syarat Program Rekomendasi Talenta Unggulan!`
    : `Penilaian akhir PKL Anda telah selesai dengan nilai akhir ${finalScore}.`;

  await notifyFn(studentId, {
    type: 'assessment',
    title: 'Penilaian Akhir PKL Selesai',
    body,
    relatedPath: '/assessment',
  });
}

export const onAssessmentFinalized = onDocumentUpdated(
  'assessments/{assessmentId}',
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    const { assessmentId } = event.params;
    await handleAssessmentFinalized(before, after, assessmentId);
  }
);
