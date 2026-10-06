import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { createNotification } from '../utils/notify';

export const onLogbookReviewed = onDocumentUpdated('logbooks/{logbookId}', async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();

  if (!before || !after) return;

  // Trigger only on reviewStatus state transition
  if (before.reviewStatus === after.reviewStatus) return;

  if (after.reviewStatus === 'disetujui' || after.reviewStatus === 'ditolak') {
    const isApproved = after.reviewStatus === 'disetujui';
    const title = isApproved ? 'Logbook Disetujui' : 'Logbook Perlu Revisi';
    const body = after.catatan
      ? `Catatan pembimbing: "${after.catatan}"`
      : isApproved
      ? 'Logbook harian Anda telah disetujui oleh pembimbing industri.'
      : 'Logbook harian Anda belum disetujui oleh pembimbing industri.';

    await createNotification(after.uid, {
      type: 'logbook',
      title,
      body,
      relatedPath: `/logbooks/${event.params.logbookId}`,
    });

    console.log(`[onLogbookReviewed] Dispatched notification to user ${after.uid} for logbook ${event.params.logbookId}`);
  }
});
