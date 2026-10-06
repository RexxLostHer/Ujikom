import { describe, it, expect } from 'vitest';
import { handleCompleteRegistration } from '../src/callable/completeRegistration';

describe('Callable completeRegistration (Direct src/ Import)', () => {
  const setupMockDb = (options: {
    userExists?: boolean;
    userAlreadyRegistered?: boolean;
    rosterExists?: boolean;
    rosterAlreadyRegistered?: boolean;
  } = {}) => {
    const {
      userExists = false,
      userAlreadyRegistered = false,
      rosterExists = true,
      rosterAlreadyRegistered = false,
    } = options;

    const rosterDocData = rosterExists
      ? {
          nisn: '0091113849',
          name: 'Ahsan Mahmud Fauzi',
          schoolId: 'smkn1_sumedang',
          jurusanId: 'major_rpl',
          kelas: 'XII RPL 1',
          isRegistered: rosterAlreadyRegistered,
        }
      : null;

    const userDocData = userExists
      ? {
          uid: 'test-uid-123',
          isRegistered: userAlreadyRegistered,
        }
      : null;

    let transactionUpdatedRoster: any = null;
    let transactionSetUser: any = null;
    let transactionUpdatedSchool: any = null;

    const mockDb = {
      collection: (col: string) => ({
        doc: (docId: string) => ({ id: docId }),
        where: () => ({
          limit: () => ({}),
        }),
      }),
      runTransaction: async (updateFunction: (tx: any) => Promise<any>) => {
        const tx = {
          get: async (ref: any) => {
            // Check if ref is query or doc
            if (ref.id === 'test-uid-123') {
              return {
                exists: userExists,
                data: () => userDocData,
              };
            }
            if (ref.id === '0091113849') {
              return {
                exists: rosterExists,
                data: () => rosterDocData,
              };
            }
            // fallback for query
            return {
              empty: !rosterExists,
              docs: rosterExists ? [{ ref: { id: '0091113849' }, data: () => rosterDocData }] : [],
            };
          },
          update: (ref: any, data: any) => {
            if (ref.id === '0091113849') {
              transactionUpdatedRoster = data;
            } else if (ref.id === 'smkn1_sumedang') {
              transactionUpdatedSchool = data;
            }
          },
          set: (ref: any, data: any) => {
            if (ref.id === 'test-uid-123') {
              transactionSetUser = data;
            }
          },
        };
        return await updateFunction(tx);
      },
    } as any;

    return {
      mockDb,
      getUpdatedRoster: () => transactionUpdatedRoster,
      getSetUser: () => transactionSetUser,
      getUpdatedSchool: () => transactionUpdatedSchool,
    };
  };

  const validAuth = { uid: 'test-uid-123', email: 'ahsan@smkn1sumedang.sch.id' };

  it('rejects unauthenticated requests', async () => {
    const { mockDb } = setupMockDb();
    await expect(
      handleCompleteRegistration({ nisn: '0091113849' }, null, mockDb)
    ).rejects.toThrow();
  });

  it('rejects invalid NISN format', async () => {
    const { mockDb } = setupMockDb();
    await expect(
      handleCompleteRegistration({ nisn: '123' }, validAuth, mockDb)
    ).rejects.toThrow();
  });

  it('rejects if user is already registered', async () => {
    const { mockDb } = setupMockDb({ userExists: true, userAlreadyRegistered: true });
    await expect(
      handleCompleteRegistration({ nisn: '0091113849' }, validAuth, mockDb)
    ).rejects.toThrow();
  });

  it('rejects if NISN is not found in roster', async () => {
    const { mockDb } = setupMockDb({ rosterExists: false });
    await expect(
      handleCompleteRegistration({ nisn: '0091113849' }, validAuth, mockDb)
    ).rejects.toThrow();
  });

  it('rejects if NISN has already been registered by another account', async () => {
    const { mockDb } = setupMockDb({ rosterAlreadyRegistered: true });
    await expect(
      handleCompleteRegistration({ nisn: '0091113849' }, validAuth, mockDb)
    ).rejects.toThrow();
  });

  it('atomically moves roster record to user doc and increments quota on success', async () => {
    const ctx = setupMockDb();
    const res = await handleCompleteRegistration(
      { nisn: '0091113849', phone: '08123456789' },
      validAuth,
      ctx.mockDb
    );

    expect(res.success).toBe(true);
    expect(res.uid).toBe('test-uid-123');

    const updatedRoster = ctx.getUpdatedRoster();
    expect(updatedRoster.isRegistered).toBe(true);
    expect(updatedRoster.registeredUid).toBe('test-uid-123');

    const createdUser = ctx.getSetUser();
    expect(createdUser.uid).toBe('test-uid-123');
    expect(createdUser.role).toBe('siswa');
    expect(createdUser.name).toBe('Ahsan Mahmud Fauzi');
    expect(createdUser.isRegistered).toBe(true);
    expect(createdUser.isActive).toBe(true);
    expect(createdUser.schoolId).toBe('smkn1_sumedang');

    const updatedSchool = ctx.getUpdatedSchool();
    expect(updatedSchool).not.toBeNull();
  });
});
