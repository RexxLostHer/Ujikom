import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { createNotification } from '../utils/notify';

export const onSosStatusChanged = onDocumentUpdated('sosReports/{sosId}', async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();

  if (!before || !after) return;

  // Trigger if status or followUpNote changes
  if (before.status === after.status && before.followUpNote === after.followUpNote) {
    return;
  }

  const isResolved = after.status === 'selesai';
  const title = isResolved ? 'Laporan SOS Selesai Ditangani' : 'Laporan SOS Sedang Ditinjau';
  const body = after.followUpNote
    ? `Tindak lanjut guru pembimbing: "${after.followUpNote}"`
    : isResolved
    ? 'Laporan darurat SOS Anda telah diselesaikan oleh guru pembimbing.'
    : 'Laporan darurat SOS Anda sedang ditindaklanjuti oleh guru pembimbing.';

  await createNotification(after.studentId, {
    type: 'sos',
    title,
    body,
    relatedPath: `/sos/${event.params.sosId}`,
  });
});
