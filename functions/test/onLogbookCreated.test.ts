import { describe, it, expect } from 'vitest';
import { handleLogbookCreated } from '../src/triggers/onLogbookCreated';

describe('Trigger onLogbookCreated (Direct src/ Import)', () => {
  it('sets logbookSubmitted = true on attendance doc via explicit attendanceId', async () => {
    let targetDocId = '';
    let updatedData: any = null;
    let mergeOption: any = null;

    const mockDb = {
      collection: (col: string) => {
        expect(col).toBe('attendances');
        return {
          doc: (id: string) => {
            targetDocId = id;
            return {
              set: async (data: any, options: any) => {
                updatedData = data;
                mergeOption = options;
              },
            };
          },
        };
      },
    } as any;

    await handleLogbookCreated(
      { attendanceId: 'student1_20261006', title: 'Perakitan Server' },
      'log-1',
      mockDb
    );

    expect(targetDocId).toBe('student1_20261006');
    expect(updatedData.logbookSubmitted).toBe(true);
    expect(mergeOption).toEqual({ merge: true });
  });

  it('constructs attendanceId from uid and date if attendanceId is omitted', async () => {
    let targetDocId = '';
    const mockDb = {
      collection: () => ({
        doc: (id: string) => {
          targetDocId = id;
          return {
            set: async () => {},
          };
        },
      }),
    } as any;

    await handleLogbookCreated(
      { uid: 'student_xyz', date: '2026-10-06' },
      'log-2',
      mockDb
    );

    expect(targetDocId).toBe('student_xyz_20261006');
  });

  it('safely handles missing snapshot data', async () => {
    const mockDb = { collection: () => ({ doc: () => ({ set: async () => {} }) }) } as any;
    await expect(handleLogbookCreated(null, 'log-3', mockDb)).resolves.not.toThrow();
  });
});
