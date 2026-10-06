import { describe, it, expect } from 'vitest';
import { handleApplicationDecided } from '../src/triggers/onApplicationDecided';

describe('Trigger onApplicationDecided (Direct src/ Import)', () => {
  const setupTestEnv = (options: {
    quota?: number;
    filledQuota?: number;
    studentCompanyId?: string | null;
    appQuotaAllocated?: boolean;
  } = {}) => {
    const {
      quota = 5,
      filledQuota = 2,
      studentCompanyId = null,
      appQuotaAllocated = false,
    } = options;

    const companyData = { quota, filledQuota };
    const studentData = { uid: 'student-1', companyId: studentCompanyId };
    const appData = {
      status: 'disetujui',
      studentId: 'student-1',
      companyId: 'company-abc',
      quotaAllocated: appQuotaAllocated,
    };

    let updatedCompany: any = null;
    let updatedStudent: any = null;
    let updatedApp: any = null;
    const notifications: any[] = [];

    const mockDb = {
      collection: (col: string) => ({
        doc: (id: string) => ({ id }),
      }),
      runTransaction: async (updateFunction: (tx: any) => Promise<any>) => {
        const tx = {
          get: async (ref: any) => {
            if (ref.id === 'company-abc') {
              return { exists: true, data: () => companyData };
            }
            if (ref.id === 'student-1') {
              return { exists: true, data: () => studentData };
            }
            if (ref.id === 'app-1') {
              return { exists: true, data: () => appData };
            }
            return { exists: false, data: () => null };
          },
          update: (ref: any, data: any) => {
            if (ref.id === 'company-abc') updatedCompany = data;
            if (ref.id === 'student-1') updatedStudent = data;
            if (ref.id === 'app-1') updatedApp = data;
          },
        };
        return await updateFunction(tx);
      },
    } as any;

    const mockNotify = async (uid: string, notif: any) => {
      notifications.push({ uid, notif });
    };

    return {
      mockDb,
      mockNotify,
      getUpdatedCompany: () => updatedCompany,
      getUpdatedStudent: () => updatedStudent,
      getUpdatedApp: () => updatedApp,
      getNotifications: () => notifications,
    };
  };

  it('ignores event if before status is not menunggu', async () => {
    const env = setupTestEnv();
    await handleApplicationDecided(
      { status: 'disetujui' },
      { status: 'disetujui' },
      'app-1',
      env.mockDb,
      env.mockNotify
    );
    expect(env.getUpdatedCompany()).toBeNull();
    expect(env.getNotifications().length).toBe(0);
  });

  it('increments filledQuota and assigns student companyId when quota is available', async () => {
    const env = setupTestEnv({ quota: 5, filledQuota: 2 });
    await handleApplicationDecided(
      { status: 'menunggu' },
      { status: 'disetujui', studentId: 'student-1', companyId: 'company-abc' },
      'app-1',
      env.mockDb,
      env.mockNotify
    );

    const comp = env.getUpdatedCompany();
    expect(comp.filledQuota).toBe(3);

    const stu = env.getUpdatedStudent();
    expect(stu.companyId).toBe('company-abc');

    const app = env.getUpdatedApp();
    expect(app.quotaAllocated).toBe(true);

    const notifs = env.getNotifications();
    expect(notifs.length).toBe(1);
    expect(notifs[0].notif.title).toBe('Lamaran PKL Disetujui');
  });

  it('rejects application without incrementing quota when company is full', async () => {
    const env = setupTestEnv({ quota: 5, filledQuota: 5 });
    await handleApplicationDecided(
      { status: 'menunggu' },
      { status: 'disetujui', studentId: 'student-1', companyId: 'company-abc' },
      'app-1',
      env.mockDb,
      env.mockNotify
    );

    expect(env.getUpdatedCompany()).toBeNull();

    const app = env.getUpdatedApp();
    expect(app.status).toBe('ditolak');
    expect(app.rejectionReason).toContain('Kuota perusahaan telah penuh');

    const notifs = env.getNotifications();
    expect(notifs.length).toBe(1);
    expect(notifs[0].notif.title).toBe('Lamaran PKL Ditolak');
  });

  it('handles idempotency cleanly on Cloud Function retry', async () => {
    // Student already placed in this company, or quota already allocated
    const env = setupTestEnv({
      quota: 5,
      filledQuota: 3,
      studentCompanyId: 'company-abc',
      appQuotaAllocated: true,
    });

    await handleApplicationDecided(
      { status: 'menunggu' },
      { status: 'disetujui', studentId: 'student-1', companyId: 'company-abc' },
      'app-1',
      env.mockDb,
      env.mockNotify
    );

    // Should NOT mutate or send duplicate notification
    expect(env.getUpdatedCompany()).toBeNull();
    expect(env.getUpdatedStudent()).toBeNull();
    expect(env.getNotifications().length).toBe(0);
  });

  it('notifies student when application is explicitly ditolak', async () => {
    const env = setupTestEnv();
    await handleApplicationDecided(
      { status: 'menunggu' },
      {
        status: 'ditolak',
        studentId: 'student-1',
        companyId: 'company-abc',
        rejectionReason: 'Jurusan tidak sesuai',
      },
      'app-1',
      env.mockDb,
      env.mockNotify
    );

    const notifs = env.getNotifications();
    expect(notifs.length).toBe(1);
    expect(notifs[0].notif.title).toBe('Lamaran PKL Ditolak');
    expect(notifs[0].notif.body).toContain('Jurusan tidak sesuai');
  });
});
