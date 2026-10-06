import { Timestamp } from './admin';

export interface ValidateQrResult {
  valid: boolean;
  code?: 'invalid-argument' | 'deadline-exceeded' | string;
  message?: string;
}

/**
 * Robustly parses Firestore Timestamp, numeric timestamp, or ISO string to milliseconds.
 * Returns NaN if input is missing, null, undefined, or invalid date format.
 */
export function parseExpiresAtMs(expiresAt: any): number {
  if (expiresAt === null || expiresAt === undefined) return NaN;
  if (expiresAt instanceof Timestamp) return expiresAt.toMillis();
  if (typeof expiresAt === 'number') return expiresAt;
  if (typeof expiresAt?.toMillis === 'function') return expiresAt.toMillis();
  return new Date(expiresAt).getTime();
}

/**
 * Validates dynamic QR token match and expiration with 30s clock skew leeway.
 */
export function validateQrToken(
  activeToken: string | undefined,
  scannedToken: string | undefined,
  expiresAt: any,
  nowMs: number = Date.now(),
  skewToleranceMs: number = 30000
): ValidateQrResult {
  if (!activeToken || !scannedToken || activeToken !== scannedToken) {
    return {
      valid: false,
      code: 'invalid-argument',
      message: 'Token QR tidak valid atau telah diperbarui.',
    };
  }

  const expMs = parseExpiresAtMs(expiresAt);
  if (isNaN(expMs) || !isFinite(expMs)) {
    return {
      valid: false,
      code: 'invalid-argument',
      message: 'Format kedaluwarsa QR tidak valid.',
    };
  }

  if (nowMs > expMs + skewToleranceMs) {
    return {
      valid: false,
      code: 'deadline-exceeded',
      message: 'QR Code telah kedaluwarsa, silakan scan QR terbaru.',
    };
  }

  return { valid: true };
}

export const validateDynamicQrToken = validateQrToken;
