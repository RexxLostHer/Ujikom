import { describe, it, expect } from 'vitest';
import { handleVerifyAttendance } from '../src/triggers/verifyAttendance';
import { handleVerifyCheckout } from '../src/triggers/verifyCheckout';

describe('Presensi Callables (Direct src/ Import & Geofence / Check-out Gates)', () => {
  const companyA = {
    id: 'comp_a',
    lat: -6.85854,
    lng: 107.91942,
    geofenceRadiusMeters: 50,
  };
  const companyB = {
    id: 'comp_b',
    lat: -6.85854,
    lng: 107.91942,
    geofenceRadiusMeters: 50,
  };

  const setupPresensiDb = (options: {
    userCompanyId?: string | null;
    qrToken?: string;
    expiresAt?: any;
    existingAttendance?: any;
  } = {}) => {
    const {
      userCompanyId = 'comp_a',
      qrToken = 'valid_token_123',
      expiresAt = Date.now() + 45000,
      existingAttendance = null,
    } = options;

    let savedAttendance: any = null;
    let updatedAttendance: any = null;

    const mockDb = {
      collection: (col: string) => ({
        doc: (id: string) => ({
          id,
          get: async () => {
            if (col === 'qrTokens') {
              return {
                exists: true,
                data: () => ({ token: qrToken, expiresAt }),
              };
            }
            if (col === 'companies') {
              const comp = id === 'comp_a' ? companyA : companyB;
              return {
                exists: true,
                data: () => comp,
              };
            }
            if (col === 'users') {
              return {
                exists: true,
                data: () => ({
                  uid: id,
                  companyId: userCompanyId,
                  schoolId: 'school_1',
                }),
              };
            }
            if (col === 'attendances') {
              return {
                exists: !!existingAttendance,
                data: () => existingAttendance,
              };
            }
            return { exists: false, data: () => null };
          },
          set: async (data: any) => {
            savedAttendance = data;
          },
          update: async (data: any) => {
            updatedAttendance = data;
          },
        }),
      }),
    } as any;

    return {
      mockDb,
      getSavedAttendance: () => savedAttendance,
      getUpdatedAttendance: () => updatedAttendance,
    };
  };

  const studentAuth = { uid: 'student_1' };

  describe('handleVerifyAttendance', () => {
    it('rejects unplaced student (userData.companyId == null)', async () => {
      const { mockDb } = setupPresensiDb({ userCompanyId: null });
      await expect(
        handleVerifyAttendance(
          {
            auth: studentAuth,
            data: {
              companyId: 'comp_a',
              token: 'valid_token_123',
              coords: { lat: companyA.lat, lng: companyA.lng },
            },
          },
          mockDb
        )
      ).rejects.toThrow('Anda belum ditempatkan');
    });

    it('rejects student placed at Company A trying to check in at Company B', async () => {
      const { mockDb } = setupPresensiDb({ userCompanyId: 'comp_a' });
      await expect(
        handleVerifyAttendance(
          {
            auth: studentAuth,
            data: {
              companyId: 'comp_b',
              token: 'valid_token_123',
              coords: { lat: companyB.lat, lng: companyB.lng },
            },
          },
          mockDb
        )
      ).rejects.toThrow('Anda belum ditempatkan di perusahaan ini');
    });

    it('formats distance nicely when outside geofence radius', async () => {
      const { mockDb } = setupPresensiDb();
      // Latitude offset ~0.0006 degrees (~66m)
      const outsideCoords = { lat: companyA.lat + 0.0006, lng: companyA.lng };
      await expect(
        handleVerifyAttendance(
          {
            auth: studentAuth,
            data: {
              companyId: 'comp_a',
              token: 'valid_token_123',
              coords: outsideCoords,
            },
          },
          mockDb
        )
      ).rejects.toThrow(/Di luar radius presensi perusahaan \(\d+\.\d+m > 50m\)/);
    });

    it('successfully records check-in when within geofence and valid token', async () => {
      const ctx = setupPresensiDb();
      const res = await handleVerifyAttendance(
        {
          auth: studentAuth,
          data: {
            companyId: 'comp_a',
            token: 'valid_token_123',
            coords: { lat: companyA.lat, lng: companyA.lng },
          },
        },
        ctx.mockDb
      );

      expect(res.success).toBe(true);
      expect(res.distanceMeters).toBe(0);

      const saved = ctx.getSavedAttendance();
      expect(saved.status).toBe('hadir');
      expect(saved.companyId).toBe('comp_a');
      expect(saved.checkIn.verifiedServerSide).toBe(true);
    });
  });

  describe('handleVerifyCheckout', () => {
    it('rejects checkout when logbookSubmitted is false', async () => {
      const { mockDb } = setupPresensiDb({
        existingAttendance: {
          uid: 'student_1',
          companyId: 'comp_a',
          logbookSubmitted: false,
          checkIn: { lat: companyA.lat, lng: companyA.lng },
        },
      });

      await expect(
        handleVerifyCheckout(
          {
            auth: studentAuth,
            data: {
              companyId: 'comp_a',
              token: 'valid_token_123',
              coords: { lat: companyA.lat, lng: companyA.lng },
            },
          },
          mockDb
        )
      ).rejects.toThrow('Presensi pulang terkunci');
    });

    it('rejects checkout if scanning at a different company than check-in', async () => {
      const { mockDb } = setupPresensiDb({
        existingAttendance: {
          uid: 'student_1',
          companyId: 'comp_a', // Checked in at Comp A
          logbookSubmitted: true,
          checkIn: { lat: companyA.lat, lng: companyA.lng },
        },
      });

      await expect(
        handleVerifyCheckout(
          {
            auth: studentAuth,
            data: {
              companyId: 'comp_b', // Scanning Comp B
              token: 'valid_token_123',
              coords: { lat: companyB.lat, lng: companyB.lng },
            },
          },
          mockDb
        )
      ).rejects.toThrow('Perusahaan presensi pulang tidak sesuai');
    });

    it('successfully records check-out when logbookSubmitted is true and company matches', async () => {
      const ctx = setupPresensiDb({
        existingAttendance: {
          uid: 'student_1',
          companyId: 'comp_a',
          logbookSubmitted: true,
          checkIn: { lat: companyA.lat, lng: companyA.lng },
        },
      });

      const res = await handleVerifyCheckout(
        {
          auth: studentAuth,
          data: {
            companyId: 'comp_a',
            token: 'valid_token_123',
            coords: { lat: companyA.lat, lng: companyA.lng },
          },
        },
        ctx.mockDb
      );

      expect(res.success).toBe(true);
      const updated = ctx.getUpdatedAttendance();
      expect(updated.checkOut.verifiedServerSide).toBe(true);
    });
  });
});
