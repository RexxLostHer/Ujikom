import { describe, it, expect } from 'vitest';
import { validateQrToken, parseExpiresAtMs } from '../src/utils/qr';
import { Timestamp } from '../src/utils/admin';

describe('Dynamic QR Token Verification Logic', () => {
  const activeToken = 'd7b1a23e-8f24-4e20-b4d2-3158c558c740';
  const now = 1728172800000;

  it('validates matching active token within 60s', () => {
    const expiresAt = now + 45000;
    const res = validateQrToken(activeToken, activeToken, expiresAt, now);
    expect(res.valid).toBe(true);
  });

  it('rejects token mismatch (replaced QR)', () => {
    const replacedToken = 'abcde-12345';
    const expiresAt = now + 45000;
    const res = validateQrToken(activeToken, replacedToken, expiresAt, now);
    expect(res.valid).toBe(false);
    expect(res.code).toBe('invalid-argument');
  });

  it('rejects expired token beyond skew window', () => {
    const expiresAt = now - 35000; // Expired 35 seconds ago
    const res = validateQrToken(activeToken, activeToken, expiresAt, now);
    expect(res.valid).toBe(false);
    expect(res.code).toBe('deadline-exceeded');
  });

  it('accepts token within 30s clock skew tolerance window', () => {
    const expiresAt = now - 15000; // Expired 15s ago, within 30s skew
    const res = validateQrToken(activeToken, activeToken, expiresAt, now);
    expect(res.valid).toBe(true);
  });

  it('rejects undefined, null, or malformed expiresAt', () => {
    expect(validateQrToken(activeToken, activeToken, undefined, now).valid).toBe(false);
    expect(validateQrToken(activeToken, activeToken, null, now).valid).toBe(false);
    expect(validateQrToken(activeToken, activeToken, 'invalid-date', now).valid).toBe(false);
    expect(validateQrToken(activeToken, activeToken, NaN, now).valid).toBe(false);
  });

  it('correctly parses Firestore Timestamp objects', () => {
    const seconds = Math.floor(now / 1000) + 60;
    const ts = new Timestamp(seconds, 0);
    const ms = parseExpiresAtMs(ts);
    expect(ms).toBe(seconds * 1000);
    const res = validateQrToken(activeToken, activeToken, ts, now);
    expect(res.valid).toBe(true);
  });
});
