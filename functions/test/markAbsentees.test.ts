import { describe, it, expect } from 'vitest';
import { executeMarkAbsentees } from '../src/triggers/markAbsentees';

describe('Scheduled markAbsentees (Direct src/ Import & Batch Chunking)', () => {
  it('marks placed absent students as alpha and skips unplaced students', async () => {
    const students = [
      { id: 'placed_1', data: { role: 'siswa', isActive: true, companyId: 'comp_1', schoolId: 'school_1' } },
      { id: 'unplaced_1', data: { role: 'siswa', isActive: true, companyId: null, schoolId: 'school_1' } },
      { id: 'placed_2', data: { role: 'siswa', isActive: true, companyId: 'comp_2', schoolId: 'school_1' } },
    ];

    const attendances: Record<string, any> = {
      'placed_2_20261006': { status: 'hadir' }, // Already checked in
    };

    const committedSets: any[] = [];
    const committedUpdates: any[] = [];

    const mockDb = {
      collection: (col: string) => {
        if (col === 'users') {
          return {
            where: () => ({
              where: () => ({
                get: async () => ({
                  docs: students.map((s) => ({ id: s.id, data: () => s.data })),
                }),
              }),
            }),
          };
        }
        if (col === 'attendances') {
          return {
            doc: (id: string) => ({
              id,
              ref: { id },
              get: async () => ({
                id,
                ref: { id },
                exists: !!attendances[id],
                data: () => attendances[id],
              }),
            }),
          };
        }
        return {};
      },
      batch: () => {
        const ops: any[] = [];
        return {
          set: (ref: any, data: any) => {
            ops.push({ type: 'set', ref, data });
          },
          update: (ref: any, data: any) => {
            ops.push({ type: 'update', ref, data });
          },
          commit: async () => {
            for (const op of ops) {
              if (op.type === 'set') committedSets.push(op);
              if (op.type === 'update') committedUpdates.push(op);
            }
          },
        };
      },
    } as any;

    const res = await executeMarkAbsentees('2026-10-06', mockDb);
    expect(res.processed).toBe(2); // Only placed_1 and placed_2
    expect(res.marked).toBe(1); // placed_1 was absent, placed_2 was hadir
    expect(committedSets.length).toBe(1);
    expect(committedSets[0].ref.id).toBe('placed_1_20261006');
    expect(committedSets[0].data.status).toBe('alpha');
    expect(committedSets[0].data.companyId).toBe('comp_1');
  });

  it('updates pending attendance records to alpha', async () => {
    const students = [
      { id: 'student_pending', data: { role: 'siswa', isActive: true, companyId: 'comp_1', schoolId: 'school_1' } },
    ];

    const attendances: Record<string, any> = {
      'student_pending_20261006': { status: 'pending' },
    };

    const committedUpdates: any[] = [];

    const mockDb = {
      collection: (col: string) => {
        if (col === 'users') {
          return {
            where: () => ({
              where: () => ({
                get: async () => ({
                  docs: students.map((s) => ({ id: s.id, data: () => s.data })),
                }),
              }),
            }),
          };
        }
        if (col === 'attendances') {
          return {
            doc: (id: string) => ({
              id,
              ref: { id },
              get: async () => ({
                id,
                ref: { id },
                exists: !!attendances[id],
                data: () => attendances[id],
              }),
            }),
          };
        }
        return {};
      },
      batch: () => ({
        set: () => {},
        update: (ref: any, data: any) => committedUpdates.push({ ref, data }),
        commit: async () => {},
      }),
    } as any;

    const res = await executeMarkAbsentees('2026-10-06', mockDb);
    expect(res.marked).toBe(1);
    expect(committedUpdates.length).toBe(1);
    expect(committedUpdates[0].data.status).toBe('alpha');
  });

  it('splits batch commits when exceeding BATCH_LIMIT (400 operations)', async () => {
    const studentCount = 450;
    const students = Array.from({ length: studentCount }, (_, i) => ({
      id: `student_${i}`,
      data: { role: 'siswa', isActive: true, companyId: 'comp_test', schoolId: 'school_1' },
    }));

    let batchCommitCount = 0;
    let totalOpsCommitted = 0;

    const mockDb = {
      collection: (col: string) => {
        if (col === 'users') {
          return {
            where: () => ({
              where: () => ({
                get: async () => ({
                  docs: students.map((s) => ({ id: s.id, data: () => s.data })),
                }),
              }),
            }),
          };
        }
        if (col === 'attendances') {
          return {
            doc: (id: string) => ({
              id,
              ref: { id },
              get: async () => ({
                id,
                ref: { id },
                exists: false,
                data: () => null,
              }),
            }),
          };
        }
        return {};
      },
      batch: () => {
        let count = 0;
        return {
          set: () => {
            count++;
          },
          update: () => {
            count++;
          },
          commit: async () => {
            batchCommitCount++;
            totalOpsCommitted += count;
          },
        };
      },
    } as any;

    const res = await executeMarkAbsentees('2026-10-06', mockDb);
    expect(res.processed).toBe(450);
    expect(res.marked).toBe(450);
    // 450 items with 400 limit should trigger 2 batch commits (400 + 50)
    expect(batchCommitCount).toBe(2);
    expect(totalOpsCommitted).toBe(450);
  });
});
