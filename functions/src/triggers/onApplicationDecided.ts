import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { db, FieldValue } from '../utils/admin';
import { createNotification } from '../utils/notify';

export async function handleApplicationDecided(
  before: any,
  after: any,
  applicationId: string,
  database = db,
  notifyFn = createNotification
) {
  if (!before || !after) return;

  // Trigger only when transitioning from 'menunggu' to 'disetujui' or 'ditolak'
  if (before.status !== 'menunggu' || (after.status !== 'disetujui' && after.status !== 'ditolak')) {
    return;
  }

  const { studentId, companyId, status, rejectionReason } = after;

  if (status === 'disetujui') {
    let quotaExceeded = false;
    let alreadyProcessed = false;
    let crossPlacementConflict = false;

    await database.runTransaction(async (transaction) => {
      const studentRef = database.collection('users').doc(studentId);
      const studentDoc = await transaction.get(studentRef);

      const appRef = database.collection('applications').doc(applicationId);
      const appDoc = await transaction.get(appRef);

      const companyRef = database.collection('companies').doc(companyId);
      const companyDoc = await transaction.get(companyRef);

      if (!companyDoc.exists) {
        throw new Error(`Company ${companyId} not found`);
      }

      const studentData = studentDoc.data();
      const appData = appDoc.data();

      // 1. Idempotency Check:
      // If student is already assigned to this company OR application was already finalized,
      // exit early as a no-op to prevent duplicate quota increments on Cloud Function retries.
      if (studentData?.companyId === companyId || appData?.quotaAllocated === true) {
        alreadyProcessed = true;
        return;
      }

      // If application was already rejected in a prior attempt (e.g. quota full), exit idempotently.
      if (appData?.status === 'ditolak') {
        alreadyProcessed = true;
        return;
      }

      // 2. Prevent active placement across multiple companies:
      if (studentData?.companyId && studentData.companyId !== companyId) {
        crossPlacementConflict = true;
        transaction.update(appRef, {
          status: 'ditolak',
          rejectionReason: 'Siswa sudah memiliki penempatan aktif di perusahaan lain.',
          updatedAt: FieldValue.serverTimestamp(),
        });
        return;
      }

      // 3. Check Quota
      const compData = companyDoc.data()!;
      const currentFilled = compData.filledQuota || 0;
      const maxQuota = compData.quota || 0;

      if (currentFilled >= maxQuota) {
        quotaExceeded = true;
        transaction.update(appRef, {
          status: 'ditolak',
          rejectionReason: 'Kuota perusahaan telah penuh saat konfirmasi persetujuan.',
          updatedAt: FieldValue.serverTimestamp(),
        });
        return;
      }

      // 4. Atomic Commit
      transaction.update(companyRef, {
        filledQuota: currentFilled + 1,
        updatedAt: FieldValue.serverTimestamp(),
      });

      transaction.update(studentRef, {
        companyId,
        updatedAt: FieldValue.serverTimestamp(),
      });

      transaction.update(appRef, {
        quotaAllocated: true,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    if (alreadyProcessed) {
      console.log(`[onApplicationDecided] Application ${applicationId} already processed (idempotent no-op).`);
      return;
    }

    if (crossPlacementConflict) {
      await notifyFn(studentId, {
        type: 'application',
        title: 'Lamaran PKL Ditolak',
        body: 'Lamaran ditolak karena Anda sudah memiliki penempatan aktif di perusahaan lain.',
        relatedPath: '/applications',
      });
      return;
    }

    if (quotaExceeded) {
      await notifyFn(studentId, {
        type: 'application',
        title: 'Lamaran PKL Ditolak',
        body: 'Mohon maaf, kuota penerimaan perusahaan telah penuh.',
        relatedPath: '/applications',
      });
      return;
    }

    await notifyFn(studentId, {
      type: 'application',
      title: 'Lamaran PKL Disetujui',
      body: 'Selamat! Lamaran PKL Anda telah disetujui. Silakan cek detail penempatan di profil Anda.',
      relatedPath: '/profile',
    });
  } else if (status === 'ditolak') {
    await notifyFn(studentId, {
      type: 'application',
      title: 'Lamaran PKL Ditolak',
      body: rejectionReason
        ? `Lamaran PKL Anda belum disetujui: ${rejectionReason}`
        : 'Lamaran PKL Anda belum disetujui. Silakan ajukan ke perusahaan lain.',
      relatedPath: '/applications',
    });
  }
}

export const onApplicationDecided = onDocumentUpdated(
  'applications/{applicationId}',
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    const { applicationId } = event.params;
    await handleApplicationDecided(before, after, applicationId);
  }
);
