import { describe, it, expect } from 'vitest';
import { calculateHaversineDistance, isWithinGeofence, EARTH_RADIUS_METERS } from '../src/utils/geo';

describe('Geo Utilities (Haversine Formula)', () => {
  const companyLat = -6.85854;
  const companyLng = 107.91942;

  it('calculates 0 distance for identical points', () => {
    const dist = calculateHaversineDistance(companyLat, companyLng, companyLat, companyLng);
    expect(dist).toBe(0);
  });

  it('accepts points inside 50m geofence radius', () => {
    // Offset ~28 meters north (~0.00025 degrees latitude)
    const userLat = companyLat + 0.00025;
    const userLng = companyLng;
    const distance = calculateHaversineDistance(userLat, userLng, companyLat, companyLng);

    expect(distance).toBeLessThan(50);
    expect(isWithinGeofence(userLat, userLng, companyLat, companyLng, 50)).toBe(true);
  });

  it('rejects points outside 50m geofence radius', () => {
    // Offset ~78 meters north (~0.0007 degrees latitude)
    const userLat = companyLat + 0.0007;
    const userLng = companyLng;
    const distance = calculateHaversineDistance(userLat, userLng, companyLat, companyLng);

    expect(distance).toBeGreaterThan(50);
    expect(isWithinGeofence(userLat, userLng, companyLat, companyLng, 50)).toBe(false);
  });

  it('accurately calculates known physical benchmark distance', () => {
    // Benchmark: SMKN 1 Sumedang to Alun-Alun Sumedang (~400-450m)
    const alunAlunLat = -6.85720;
    const alunAlunLng = 107.92280;
    const distance = calculateHaversineDistance(companyLat, companyLng, alunAlunLat, alunAlunLng);

    expect(distance).toBeGreaterThan(350);
    expect(distance).toBeLessThan(500);
  });

  it('throws error on non-numeric or NaN coordinates', () => {
    expect(() => calculateHaversineDistance(NaN, 107, -6, 107)).toThrow();
  });
});
