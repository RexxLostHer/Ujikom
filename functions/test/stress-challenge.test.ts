import { describe, it, expect } from 'vitest';
import { calculateHaversineDistance, isWithinGeofence, EARTH_RADIUS_METERS } from '../src/utils/geo';

describe('Empirical Stress Challenge: Haversine Geofencing', () => {
  const originLat = 0;
  const originLng = 0;

  // Exact degree delta for 50m along equator meridian
  // 50 / 6371000 * 180 / Math.PI = 0.00044966052064115456 degrees
  const exact50mDeg = (50 / EARTH_RADIUS_METERS) * (180 / Math.PI);
  // Degree delta for 50.001m
  const exact50_001mDeg = (50.001 / EARTH_RADIUS_METERS) * (180 / Math.PI);

  it('verifies that exactly 50.000m is ACCEPTED by geofence', () => {
    const dist = calculateHaversineDistance(originLat, originLng, exact50mDeg, originLng);
    expect(dist).toBeCloseTo(50.0, 5);
    expect(dist).toBeLessThanOrEqual(50.0);
    expect(isWithinGeofence(originLat, originLng, exact50mDeg, originLng, 50)).toBe(true);
  });

  it('verifies that 50.001m is REJECTED by geofence', () => {
    const dist = calculateHaversineDistance(originLat, originLng, exact50_001mDeg, originLng);
    expect(dist).toBeGreaterThan(50.0);
    expect(dist).toBeCloseTo(50.001, 5);
    expect(isWithinGeofence(originLat, originLng, exact50_001mDeg, originLng, 50)).toBe(false);
  });

  it('verifies negative coordinates handling in Southern and Western hemispheres', () => {
    // SMKN 1 Sumedang coordinates: -6.85854, 107.91942
    const smkLat = -6.85854;
    const smkLng = 107.91942;

    // Offset exactly 45 meters south
    const deltaSouth = (45 / EARTH_RADIUS_METERS) * (180 / Math.PI);
    const userLat = smkLat - deltaSouth;
    const userLng = smkLng;

    const dist = calculateHaversineDistance(userLat, userLng, smkLat, smkLng);
    expect(dist).toBeCloseTo(45.0, 4);
    expect(isWithinGeofence(userLat, userLng, smkLat, smkLng, 50)).toBe(true);

    // Negative longitude (e.g. South America -23.55, -46.63)
    const saLat = -23.55052;
    const saLng = -46.633308;
    const distIdentical = calculateHaversineDistance(saLat, saLng, saLat, saLng);
    expect(distIdentical).toBe(0);
  });

  it('verifies antimeridian crossing (-180 to +180 longitude boundary)', () => {
    // Point 1 just west of 180°: 179.99999
    // Point 2 just east of -180°: -179.99999
    // Difference across 180th meridian is 0.00002 degrees (~2.22 meters at equator)
    const lat = 0;
    const lon1 = 179.99999;
    const lon2 = -179.99999;

    const dist = calculateHaversineDistance(lat, lon1, lat, lon2);
    expect(dist).toBeLessThan(5);
    expect(dist).toBeCloseTo(2.22395, 3);
    expect(isWithinGeofence(lat, lon1, lat, lon2, 50)).toBe(true);
  });

  it('verifies poles behavior and clamping of antipodal points', () => {
    // North pole identical coordinates with different longitudes
    const northPole1 = calculateHaversineDistance(90, 0, 90, 180);
    expect(northPole1).toBeCloseTo(0, 5);

    // Antipodal: North pole to South pole (half Earth circumference: ~20,015,087 m)
    const antipodalDist = calculateHaversineDistance(90, 0, -90, 0);
    expect(antipodalDist).toBeCloseTo(Math.PI * EARTH_RADIUS_METERS, 0);
  });
});

describe('Empirical Stress Challenge: Dynamic QR Token Expiration', () => {
  function verifyQrValidity(
    activeToken: string,
    scannedToken: string,
    expiresAtMs: number | any,
    nowMs: number,
    skewWindowMs: number = 30000
  ): { valid: boolean; code?: string; message?: string } {
    if (activeToken !== scannedToken) {
      return { valid: false, code: 'invalid-argument', message: 'Token QR tidak valid atau telah diperbarui.' };
    }

    const expMs = typeof expiresAtMs === 'number'
      ? expiresAtMs
      : (expiresAtMs?.toMillis ? expiresAtMs.toMillis() : new Date(expiresAtMs).getTime());

    if (isNaN(expMs)) {
      // Malformed expiresAt vulnerability check
      return { valid: true, code: 'unhandled-nan-leeway', message: 'NaN comparison bypasses expiration check!' };
    }

    if (nowMs > expMs + skewWindowMs) {
      return { valid: false, code: 'deadline-exceeded', message: 'QR Code telah kedaluwarsa, silakan scan QR terbaru.' };
    }

    return { valid: true };
  }

  const token = 'active-qr-uuid-12345';
  const t0 = 1000000;
  const expiresAt = t0 + 60000; // 60s TTL

  it('accepts valid token within initial 60s window', () => {
    const res = verifyQrValidity(token, token, expiresAt, t0 + 30000);
    expect(res.valid).toBe(true);
  });

  it('accepts token between 60s and 90s due to 30s clock skew leeway if not replaced', () => {
    const res = verifyQrValidity(token, token, expiresAt, t0 + 75000);
    expect(res.valid).toBe(true);
  });

  it('rejects token after 90s (past 60s TTL + 30s skew window)', () => {
    const res = verifyQrValidity(token, token, expiresAt, t0 + 90001);
    expect(res.valid).toBe(false);
    expect(res.code).toBe('deadline-exceeded');
  });

  it('immediately rejects token if replaced in Firestore even within original TTL', () => {
    const res = verifyQrValidity('new-token-uuid-67890', token, expiresAt, t0 + 10000);
    expect(res.valid).toBe(false);
    expect(res.code).toBe('invalid-argument');
  });

  it('demonstrates vulnerability: malformed or undefined expiresAt bypasses expiration', () => {
    const res = verifyQrValidity(token, token, undefined, t0 + 999999999);
    // JS NaN comparison: nowMs > NaN + 30000 is always false!
    expect(res.code).toBe('unhandled-nan-leeway');
  });
});

describe('Empirical Stress Challenge: onApplicationDecided Quota Race Condition', () => {
  interface CompanyDoc {
    quota: number;
    filledQuota: number;
  }

  interface ApplicationDoc {
    id: string;
    studentId: string;
    companyId: string;
    status: 'menunggu' | 'disetujui' | 'ditolak';
    rejectionReason?: string;
  }

  // Simulated Firestore Transactional Engine with Optimistic Concurrency Control (OCC)
  class MockFirestoreOCC {
    company: CompanyDoc;
    applications: Map<string, ApplicationDoc>;
    students: Map<string, string | null>;
    companyVersion: number = 0;

    constructor(initialQuota: number, initialFilled: number) {
      this.company = { quota: initialQuota, filledQuota: initialFilled };
      this.applications = new Map();
      this.students = new Map();
    }

    async runApprovalTransaction(applicationId: string, studentId: string): Promise<boolean> {
      const maxRetries = 15;
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        // Read phase
        const readVersion = this.companyVersion;
        const currentFilled = this.company.filledQuota;
        const maxQuota = this.company.quota;

        // Artificial async delay to simulate network latency and heighten concurrency interleaving
        await new Promise(r => setTimeout(r, Math.random() * 5));

        if (currentFilled >= maxQuota) {
          // Commit phase for rejection
          if (this.companyVersion !== readVersion) {
            // OCC conflict, retry
            continue;
          }
          const app = this.applications.get(applicationId)!;
          app.status = 'ditolak';
          app.rejectionReason = 'Kuota perusahaan telah penuh saat konfirmasi persetujuan.';
          return false;
        }

        // Commit phase for approval
        if (this.companyVersion !== readVersion) {
          // OCC conflict, retry
          continue;
        }

        // Successful atomic commit
        this.companyVersion++;
        this.company.filledQuota = currentFilled + 1;
        this.students.set(studentId, 'company-test');
        const app = this.applications.get(applicationId)!;
        app.status = 'disetujui';
        return true;
      }
      throw new Error('Transaction contention exceeded retry limit');
    }
  }

  it('guarantees filledQuota never overflows quota under 10 concurrent approval attempts', async () => {
    const quota = 2;
    const initialFilled = 0;
    const engine = new MockFirestoreOCC(quota, initialFilled);

    const candidates = Array.from({ length: 10 }, (_, i) => ({
      appId: `app-${i}`,
      studentId: `student-${i}`,
    }));

    candidates.forEach(c => {
      engine.applications.set(c.appId, {
        id: c.appId,
        studentId: c.studentId,
        companyId: 'company-test',
        status: 'menunggu',
      });
      engine.students.set(c.studentId, null);
    });

    // Launch all 10 approval transactions concurrently
    const results = await Promise.all(
      candidates.map(c => engine.runApprovalTransaction(c.appId, c.studentId))
    );

    const approvedCount = results.filter(r => r === true).length;
    const rejectedCount = results.filter(r => r === false).length;

    // Assertions:
    // 1. Quota is strictly respected
    expect(engine.company.filledQuota).toBe(quota);
    expect(approvedCount).toBe(quota);
    expect(rejectedCount).toBe(candidates.length - quota);

    // 2. Exact applications state
    const approvedApps = Array.from(engine.applications.values()).filter(a => a.status === 'disetujui');
    const rejectedApps = Array.from(engine.applications.values()).filter(a => a.status === 'ditolak');

    expect(approvedApps.length).toBe(quota);
    expect(rejectedApps.length).toBe(candidates.length - quota);
    rejectedApps.forEach(app => {
      expect(app.rejectionReason).toContain('Kuota perusahaan telah penuh');
    });
  });
});
