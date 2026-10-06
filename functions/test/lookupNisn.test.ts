import { describe, it, expect } from 'vitest';
import { handleLookupNisn } from '../src/callable/lookupNisn';

describe('Callable lookupNisn (Direct src/ Import)', () => {
  const rosterData: Record<string, any> = {
    '0087121894': {
      nisn: '0087121894',
      name: 'Luthfi Nur Zaidan',
      schoolId: 'smkn1_sumedang',
      jurusanId: 'major_rpl',
      kelas: 'XII RPL 2',
      isRegistered: true,
    },
    '0091113849': {
      nisn: '0091113849',
      name: 'Ahsan Mahmud Fauzi',
      schoolId: 'smkn1_sumedang',
      jurusanId: 'major_rpl',
      kelas: 'XII RPL 1',
      isRegistered: false,
    },
  };

  const createMockDb = () => {
    return {
      collection: (colName: string) => {
        if (colName !== 'roster') throw new Error(`Unknown collection ${colName}`);
        return {
          doc: (docId: string) => ({
            get: async () => ({
              exists: !!rosterData[docId],
              data: () => rosterData[docId],
            }),
          }),
          where: (field: string, op: string, val: any) => {
            let filtered = Object.values(rosterData).filter((r: any) => r[field] === val);
            const queryObj: any = {
              where: (f2: string, op2: string, v2: any) => {
                filtered = filtered.filter((r: any) => r[f2] === v2);
                return queryObj;
              },
              limit: () => ({
                get: async () => ({
                  empty: filtered.length === 0,
                  docs: filtered.map((d: any) => ({ data: () => d })),
                }),
              }),
              get: async () => ({
                empty: filtered.length === 0,
                docs: filtered.map((d: any) => ({ data: () => d })),
              }),
            };
            return queryObj;
          },
        };
      },
    } as any;
  };

  it('rejects invalid NISN formats with invalid-argument error', async () => {
    const mockDb = createMockDb();
    await expect(handleLookupNisn({ nisn: '12345' }, mockDb)).rejects.toThrow();
    await expect(handleLookupNisn({ nisn: '008712189A' }, mockDb)).rejects.toThrow();
    await expect(handleLookupNisn({ nisn: '' }, mockDb)).rejects.toThrow();
  });

  it('returns not-found for unknown NISN', async () => {
    const mockDb = createMockDb();
    const res = await handleLookupNisn({ nisn: '9999999999' }, mockDb);
    expect(res.found).toBe(false);
    expect(res.status).toBe('not-found');
  });

  it('returns already-registered for pre-registered NISN', async () => {
    const mockDb = createMockDb();
    const res = await handleLookupNisn({ nisn: '0087121894' }, mockDb);
    expect(res.found).toBe(true);
    expect(res.registered).toBe(true);
    expect(res.status).toBe('already-registered');
  });

  it('returns valid student metadata for unregistered valid NISN', async () => {
    const mockDb = createMockDb();
    const res = await handleLookupNisn({ nisn: '0091113849' }, mockDb);
    expect(res.found).toBe(true);
    expect(res.registered).toBe(false);
    expect(res.status).toBe('valid');
    expect(res.student?.name).toBe('Ahsan Mahmud Fauzi');
    expect(res.student?.kelas).toBe('XII RPL 1');
  });

  it('honors schoolId filter', async () => {
    const mockDb = createMockDb();
    const matchRes = await handleLookupNisn(
      { nisn: '0091113849', schoolId: 'smkn1_sumedang' },
      mockDb
    );
    expect(matchRes.found).toBe(true);

    const mismatchRes = await handleLookupNisn(
      { nisn: '0091113849', schoolId: 'smkn2_sumedang' },
      mockDb
    );
    expect(mismatchRes.found).toBe(false);
  });
});
