import { describe, it, expect } from 'vitest';
import { handleAssessmentFinalized } from '../src/triggers/onAssessmentFinalized';

describe('Trigger onAssessmentFinalized (Direct src/ Import)', () => {
  const setupEnv = (schoolThreshold?: number) => {
    let updatedAssessment: any = null;
    const notifications: any[] = [];

    const mockDb = {
      collection: (col: string) => ({
        doc: (id: string) => {
          if (col === 'schools') {
            return {
              get: async () => ({
                exists: schoolThreshold !== undefined,
                data: () =>
                  schoolThreshold !== undefined ? { talentThreshold: schoolThreshold } : null,
              }),
            };
          }
          if (col === 'assessments') {
            return {
              update: async (data: any) => {
                updatedAssessment = data;
              },
            };
          }
          return {};
        },
      }),
    } as any;

    const mockNotify = async (uid: string, notif: any) => {
      notifications.push({ uid, notif });
    };

    return {
      mockDb,
      mockNotify,
      getUpdatedAssessment: () => updatedAssessment,
      getNotifications: () => notifications,
    };
  };

  it('ignores event when status is not newly final', async () => {
    const env = setupEnv();
    await handleAssessmentFinalized(
      { status: 'final' },
      { status: 'final', finalScore: 90 },
      'ass-1',
      env.mockDb,
      env.mockNotify
    );
    expect(env.getUpdatedAssessment()).toBeNull();
    expect(env.getNotifications().length).toBe(0);
  });

  it('sets isRecommendedTalent = true when score meets default threshold (85)', async () => {
    const env = setupEnv(); // Default threshold 85
    await handleAssessmentFinalized(
      { status: 'draft' },
      { status: 'final', schoolId: 'smkn1', studentId: 'stu-1', finalScore: 85 },
      'ass-1',
      env.mockDb,
      env.mockNotify
    );

    const updated = env.getUpdatedAssessment();
    expect(updated.isRecommendedTalent).toBe(true);

    const notifs = env.getNotifications();
    expect(notifs.length).toBe(1);
    expect(notifs[0].notif.body).toContain('Program Rekomendasi Talenta');
  });

  it('sets isRecommendedTalent = false when score is below default threshold (84)', async () => {
    const env = setupEnv();
    await handleAssessmentFinalized(
      { status: 'draft' },
      { status: 'final', schoolId: 'smkn1', studentId: 'stu-1', finalScore: 84 },
      'ass-1',
      env.mockDb,
      env.mockNotify
    );

    const updated = env.getUpdatedAssessment();
    expect(updated.isRecommendedTalent).toBe(false);
  });

  it('honors custom talentThreshold configured by school', async () => {
    const env = setupEnv(90); // School sets threshold to 90
    await handleAssessmentFinalized(
      { status: 'draft' },
      { status: 'final', schoolId: 'smkn1', studentId: 'stu-1', finalScore: 88 },
      'ass-1',
      env.mockDb,
      env.mockNotify
    );

    const updated = env.getUpdatedAssessment();
    expect(updated.isRecommendedTalent).toBe(false); // 88 < 90
  });
});
