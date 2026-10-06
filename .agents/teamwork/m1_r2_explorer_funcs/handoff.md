# Handoff Report: Cloud Functions Surgical Remediation Blueprint (Milestone M1 Iteration 2)

**Agent**: `m1_r2_explorer_funcs` (Explorer / Backend Architect)  
**Parent Orchestrator**: `e93d1db5-4dd6-49bd-a8fc-9864437f62e2`  
**Working Directory**: `C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\.agents\teamwork\m1_r2_explorer_funcs`  
**Timestamp**: 2026-10-06T01:30:00Z  
**Target Implementer**: `m1_worker`  

---

## 1. Observation

Direct code examination of `functions/src/`, `seed/seed.js`, `firestore.rules`, and prior review handoffs (`m1_reviewer_1` and `m1_challenger_1`) revealed 6 specific defects across the backend codebase:

### 1.1 `verifyAttendance.ts`
- **Location 1 (Authorization Bypass for Unplaced Students)**: `functions/src/triggers/verifyAttendance.ts:74-76`
  ```typescript
  73:   const userData = userDoc.data()!;
  74:   if (userData.companyId && userData.companyId !== companyId) {
  75:     throw new HttpsError('permission-denied', 'Anda tidak terdaftar PKL di perusahaan ini.');
  76:   }
  ```
  *Observed defect*: If a student has no assigned company (`userData.companyId == null` or `undefined`), `userData.companyId` evaluates to `false`. The condition is skipped, allowing unplaced students to successfully record attendance at any company.
- **Location 2 (Distance Formatting Error Message)**: `functions/src/triggers/verifyAttendance.ts:59-64`
  ```typescript
  59:   if (distance > allowedRadius) {
  60:     throw new HttpsError(
  61:       'failed-precondition',
  62:       `Di luar radius presensi perusahaan (${Math.round(distance)}m > ${allowedRadius}m).`
  63:     );
  64:   }
  ```
  *Observed defect*: For distances in $(50.0, 50.5)\text{ m}$ (e.g. $50.2\text{ m}$), `Math.round(distance)` evaluates to `50`. The client receives the contradictory error string: `"Di luar radius presensi perusahaan (50m > 50m)."`.
- **Location 3 (Malformed QR Expiration Bypass)**: `functions/src/triggers/verifyAttendance.ts:38-46`
  ```typescript
  38:   const nowMs = Date.now();
  39:   const expiresAtMs = qrData.expiresAt instanceof Timestamp
  40:     ? qrData.expiresAt.toMillis()
  41:     : (typeof qrData.expiresAt === 'number' ? qrData.expiresAt : new Date(qrData.expiresAt).getTime());
  42:   
  43:   // 30 seconds clock skew leeway
  44:   if (nowMs > expiresAtMs + 30000) {
  45:     throw new HttpsError('deadline-exceeded', 'QR Code telah kedaluwarsa, silakan scan QR terbaru.');
  46:   }
  ```
  *Observed defect*: If `qrData.expiresAt` is `undefined`, `null`, or an invalid date string, `new Date(undefined).getTime()` yields `NaN`. In JavaScript, `nowMs > NaN + 30000` evaluates to `false`. The expiration check is bypassed indefinitely.

### 1.2 `verifyCheckout.ts`
- **Location 1 (Cross-Company Checkout Blindspot)**: `functions/src/triggers/verifyCheckout.ts:34-50`
  ```typescript
  35:   const attDoc = await attRef.get();
  36:   if (!attDoc.exists) {
  37:     throw new HttpsError('not-found', 'Presensi masuk hari ini belum tercatat.');
  38:   }
  39:   const attData = attDoc.data()!;
  40:   if (attData.logbookSubmitted !== true) { ... }
  ```
  *Observed defect*: The incoming `request.data.companyId` is never validated against `attData.companyId`. A student who checked in at Company A can scan and check out at Company B as long as Company B has an active QR token.
- **Location 2 (Distance Rounding Defect)**: `functions/src/triggers/verifyCheckout.ts:83-88`
  ```typescript
  84:     throw new HttpsError(
  85:       'failed-precondition',
  86:       `Di luar radius presensi perusahaan (${Math.round(distance)}m > ${allowedRadius}m).`
  87:     );
  ```
  *Observed defect*: Identical string contradiction `(50m > 50m)` as in `verifyAttendance.ts`.
- **Location 3 (QR Expiration NaN Bypass)**: `functions/src/triggers/verifyCheckout.ts:63-70`
  *Observed defect*: Identical unhandled `NaN` expiration bypass as in `verifyAttendance.ts`.

### 1.3 `onApplicationDecided.ts`
- **Location (Eventarc Retry Idempotency Failure & Double Quota Allocation)**: `functions/src/triggers/onApplicationDecided.ts:19-58`
  ```typescript
  19:   if (status === 'disetujui') {
  20:     let quotaExceeded = false;
  21:     await db.runTransaction(async (transaction) => {
  22:       const companyRef = db.collection('companies').doc(companyId);
  23:       const companyDoc = await transaction.get(companyRef);
  ...
  47:       transaction.update(companyRef, {
  48:         filledQuota: currentFilled + 1,
  49:         updatedAt: FieldValue.serverTimestamp(),
  50:       });
  51:       const studentRef = db.collection('users').doc(studentId);
  52:       transaction.update(studentRef, {
  53:         companyId,
  54:         updatedAt: FieldValue.serverTimestamp(),
  55:       });
  56:     });
  57:     if (quotaExceeded) { ... }
  ```
  *Observed defect*: Under Cloud Functions at-least-once delivery, if `createNotification` fails or times out after the transaction commits, Eventarc redelivers the event (`before.status === 'menunggu'`, `after.status === 'disetujui'`).
  On retry, `onApplicationDecided` re-executes `db.runTransaction`:
  1. If quota was filled on the first run, `currentFilled >= maxQuota` is now `true`. The function overwrites `applications/{id}` to `'ditolak'` and notifies the student of rejection after already approving them.
  2. If quota was not full, `company.filledQuota` is incremented a second time, leaking quota slots.

### 1.4 `markAbsentees.ts`
- **Location (Batch Limit Overflow & N+1 Latency)**: `functions/src/triggers/markAbsentees.ts:24-59`
  ```typescript
  24:   const batch = db.batch();
  25:   for (const doc of studentsSnap.docs) {
  ...
  33:     const attDoc = await attRef.get();
  34:     if (!attDoc.exists) {
  35:       batch.set(attRef, { ... });
  36:       marked++;
  ...
  57:   if (marked > 0) {
  58:     await batch.commit();
  59:   }
  ```
  *Observed defect*: Google Cloud Firestore strictly limits batch writes to 500 operations per request. If $> 500$ students are absent across the school, `batch.commit()` crashes with `INVALID_ARGUMENT: maximum 500 writes allowed per request`. In addition, line 33 performs sequential `await attRef.get()` in a raw loop, producing an N+1 network latency bottleneck.

### 1.5 `seed/seed.js`
- **Location 1 (Attendance Schema Inconsistency)**: `seed/seed.js:295-311`
  ```javascript
  295:   const attendanceId = `user_siswa_luthfi_${todayStr}`;
  296:   await db.collection('attendances').doc(attendanceId).set({
  297:     id: attendanceId,
  298:     studentId: 'user_siswa_luthfi',
  ...
  300:     date: todayStr, // '20261006' (not ISO YYYY-MM-DD)
  ```
  *Observed defect*: `firestore.rules:178` enforces `request.auth.uid == resource.data.uid`. The seeded document contains `studentId` but lacks `uid`. Consequently, client requests from `user_siswa_luthfi` fail with `permission-denied`.
- **Location 2 (Student Missing `isActive`)**: `seed/seed.js:235-248`
  `user_siswa_luthfi` has `statusPkl: 'aktif'`, but lacks `isActive: true`. Because `markAbsentees.ts:18` queries `.where('isActive', '==', true)`, the demo student is omitted from absentee tracking.

---

## 2. Logic Chain

1. **Authorization Logic in `verifyAttendance.ts`**:
   - Checking `if (userData.companyId && userData.companyId !== companyId)` only rejects when `userData.companyId` is defined and different.
   - An unplaced student has `userData.companyId === undefined` or `null`. The condition evaluates to falsy, bypassing placement validation.
   - By changing the condition to `if (!userData.companyId || userData.companyId !== companyId)`, unplaced students are strictly denied entry (`permission-denied`).
2. **Rounding Logic**:
   - Geofence condition is `distance > allowedRadius`.
   - For $50.000\text{ m}$, distance $\le 50.000\text{ m}$ is accepted.
   - For $50.120\text{ m}$, distance $> 50.000\text{ m}$ is rejected.
   - Using `Math.round(50.12)` yields `50`. Replacing with `distance.toFixed(1)` yields `50.1m > 50m`, preventing user confusion.
3. **QR Expiration NaN Comparison**:
   - In IEEE 754 floating point / ECMAScript, any comparison involving `NaN` (such as `x > NaN` or `x < NaN`) evaluates to `false`.
   - Therefore, `nowMs > expiresAtMs + 30000` evaluates to `false` when `expiresAtMs` is `NaN`.
   - Explicitly asserting `if (isNaN(expiresAtMs) || !isFinite(expiresAtMs))` guarantees that malformed tokens are rejected with `invalid-argument`.
4. **Idempotency in Cloud Functions**:
   - Cloud Functions guarantees at-least-once execution. Retries occur on unhandled promise rejections, timeouts, or network interruptions.
   - By reading `studentRef` and `appRef` inside the transaction and checking `if (studentData?.companyId === companyId || appData?.quotaAllocated === true)`, a redelivered event detects that the quota was already committed, sets an `alreadyProcessed` flag, and exits without mutating Firestore or firing duplicate notifications.
5. **Firestore Write Batching**:
   - Firestore write batches must contain $\le 500$ operations.
   - Chunking writes with a threshold of $\le 400$ writes per commit ensures that even if $1,000+$ students are marked absent, the process will execute safely across multiple commits without aborting.

---

## 3. Caveats

1. **Read-Only Explorer Constraint**: This investigation was performed under strict read-only explorer permissions. No production source files or test files were modified by this agent. All proposed code changes are provided as exact surgical patches ready for `m1_worker` implementation.
2. **Local Environment Vitest Runner**: On this Windows host, `vitest` is run via `npm --prefix functions test`. `node_modules` must be installed (`npm --prefix functions install`) prior to running Vitest or TypeScript compilation.

---

## 4. Conclusion & Surgical Implementation Blueprint

The following 6 surgical remediations are scoped, precise, and production-ready for `m1_worker`.

### 4.1 Remediation 1: `functions/src/triggers/verifyAttendance.ts`

**Target File**: `C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\functions\src\triggers\verifyAttendance.ts`

#### Edit 1.1: Dynamic QR `expiresAt` NaN Guard (Lines 38–46)
```typescript
<<<< BEFORE (Lines 38-46)
  const nowMs = Date.now();
  const expiresAtMs = qrData.expiresAt instanceof Timestamp
    ? qrData.expiresAt.toMillis()
    : (typeof qrData.expiresAt === 'number' ? qrData.expiresAt : new Date(qrData.expiresAt).getTime());
  
  // 30 seconds clock skew leeway
  if (nowMs > expiresAtMs + 30000) {
    throw new HttpsError('deadline-exceeded', 'QR Code telah kedaluwarsa, silakan scan QR terbaru.');
  }
==== AFTER
  const nowMs = Date.now();
  let expiresAtMs: number;
  if (qrData.expiresAt instanceof Timestamp) {
    expiresAtMs = qrData.expiresAt.toMillis();
  } else if (typeof qrData.expiresAt === 'number') {
    expiresAtMs = qrData.expiresAt;
  } else if (qrData.expiresAt && typeof qrData.expiresAt.toMillis === 'function') {
    expiresAtMs = qrData.expiresAt.toMillis();
  } else if (qrData.expiresAt) {
    expiresAtMs = new Date(qrData.expiresAt).getTime();
  } else {
    expiresAtMs = NaN;
  }

  if (isNaN(expiresAtMs) || !isFinite(expiresAtMs)) {
    throw new HttpsError('invalid-argument', 'Format kedaluwarsa QR tidak valid.');
  }

  // 30 seconds clock skew leeway
  if (nowMs > expiresAtMs + 30000) {
    throw new HttpsError('deadline-exceeded', 'QR Code telah kedaluwarsa, silakan scan QR terbaru.');
  }
>>>>
```

#### Edit 1.2: Geofence Distance Error Message Formatting (Lines 59–64)
```typescript
<<<< BEFORE (Lines 59-64)
  if (distance > allowedRadius) {
    throw new HttpsError(
      'failed-precondition',
      `Di luar radius presensi perusahaan (${Math.round(distance)}m > ${allowedRadius}m).`
    );
  }
==== AFTER
  if (distance > allowedRadius) {
    throw new HttpsError(
      'failed-precondition',
      `Di luar radius presensi perusahaan (${distance.toFixed(1)}m > ${allowedRadius}m).`
    );
  }
>>>>
```

#### Edit 1.3: Unplaced Student Placement Verification (Lines 73–76)
```typescript
<<<< BEFORE (Lines 73-76)
  const userData = userDoc.data()!;
  if (userData.companyId && userData.companyId !== companyId) {
    throw new HttpsError('permission-denied', 'Anda tidak terdaftar PKL di perusahaan ini.');
  }
==== AFTER
  const userData = userDoc.data()!;
  if (!userData.companyId || userData.companyId !== companyId) {
    throw new HttpsError('permission-denied', 'Anda belum ditempatkan di perusahaan ini.');
  }
>>>>
```

---

### 4.2 Remediation 2: `functions/src/triggers/verifyCheckout.ts`

**Target File**: `C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\functions\src\triggers\verifyCheckout.ts`

#### Edit 2.1: Enforce Check-In Company Match (Lines 41–50)
```typescript
<<<< BEFORE (Lines 41-50)
  const attData = attDoc.data()!;

  // 2. ENFORCE CHECK-OUT GATE: logbookSubmitted MUST BE TRUE
  if (attData.logbookSubmitted !== true) {
    throw new HttpsError(
      'failed-precondition',
      'Presensi pulang terkunci: Selesaikan dan simpan logbook harian terlebih dahulu.'
    );
  }
==== AFTER
  const attData = attDoc.data()!;

  // Enforce company consistency between check-in and checkout
  if (!attData.companyId || attData.companyId !== companyId) {
    throw new HttpsError(
      'permission-denied',
      'Perusahaan presensi pulang tidak sesuai dengan perusahaan presensi masuk.'
    );
  }

  // 2. ENFORCE CHECK-OUT GATE: logbookSubmitted MUST BE TRUE
  if (attData.logbookSubmitted !== true) {
    throw new HttpsError(
      'failed-precondition',
      'Presensi pulang terkunci: Selesaikan dan simpan logbook harian terlebih dahulu.'
    );
  }
>>>>
```

#### Edit 2.2: Dynamic QR `expiresAt` NaN Guard (Lines 63–71)
```typescript
<<<< BEFORE (Lines 63-71)
  const nowMs = Date.now();
  const expiresAtMs = qrData.expiresAt instanceof Timestamp
    ? qrData.expiresAt.toMillis()
    : (typeof qrData.expiresAt === 'number' ? qrData.expiresAt : new Date(qrData.expiresAt).getTime());

  if (nowMs > expiresAtMs + 30000) {
    throw new HttpsError('deadline-exceeded', 'QR Code telah kedaluwarsa, silakan scan QR terbaru.');
  }
==== AFTER
  const nowMs = Date.now();
  let expiresAtMs: number;
  if (qrData.expiresAt instanceof Timestamp) {
    expiresAtMs = qrData.expiresAt.toMillis();
  } else if (typeof qrData.expiresAt === 'number') {
    expiresAtMs = qrData.expiresAt;
  } else if (qrData.expiresAt && typeof qrData.expiresAt.toMillis === 'function') {
    expiresAtMs = qrData.expiresAt.toMillis();
  } else if (qrData.expiresAt) {
    expiresAtMs = new Date(qrData.expiresAt).getTime();
  } else {
    expiresAtMs = NaN;
  }

  if (isNaN(expiresAtMs) || !isFinite(expiresAtMs)) {
    throw new HttpsError('invalid-argument', 'Format kedaluwarsa QR tidak valid.');
  }

  if (nowMs > expiresAtMs + 30000) {
    throw new HttpsError('deadline-exceeded', 'QR Code telah kedaluwarsa, silakan scan QR terbaru.');
  }
>>>>
```

#### Edit 2.3: Geofence Distance Error Message Formatting (Lines 83–88)
```typescript
<<<< BEFORE (Lines 83-88)
  if (distance > allowedRadius) {
    throw new HttpsError(
      'failed-precondition',
      `Di luar radius presensi perusahaan (${Math.round(distance)}m > ${allowedRadius}m).`
    );
  }
==== AFTER
  if (distance > allowedRadius) {
    throw new HttpsError(
      'failed-precondition',
      `Di luar radius presensi perusahaan (${distance.toFixed(1)}m > ${allowedRadius}m).`
    );
  }
>>>>
```

---

### 4.3 Remediation 3: Shared QR Token Utility `functions/src/utils/qr.ts` (Recommended Refactoring)

**Target File**: `C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\functions\src\utils\qr.ts` (New module)

Creating this shared module consolidates QR token parsing and expiration checks across both `verifyAttendance.ts` and `verifyCheckout.ts`, and allows `functions/test/qr.test.ts` to test genuine source code directly:

```typescript
import { Timestamp } from './admin';

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
export function validateDynamicQrToken(
  activeToken: string | undefined,
  scannedToken: string | undefined,
  expiresAt: any,
  nowMs: number = Date.now(),
  skewToleranceMs: number = 30000
): { valid: boolean; code?: 'invalid-argument' | 'deadline-exceeded'; message?: string } {
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
```

---

### 4.4 Remediation 4: `functions/src/triggers/onApplicationDecided.ts`

**Target File**: `C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\functions\src\triggers\onApplicationDecided.ts`

#### Edit 4.1: Transaction Idempotency and Anti-Double-Allocation Guard (Lines 19–85)
```typescript
<<<< BEFORE (Lines 19-85)
  if (status === 'disetujui') {
    let quotaExceeded = false;

    await db.runTransaction(async (transaction) => {
      const companyRef = db.collection('companies').doc(companyId);
      const companyDoc = await transaction.get(companyRef);

      if (!companyDoc.exists) {
        throw new Error(`Company ${companyId} not found`);
      }

      const compData = companyDoc.data()!;
      const currentFilled = compData.filledQuota || 0;
      const maxQuota = compData.quota || 0;

      if (currentFilled >= maxQuota) {
        quotaExceeded = true;
        // Company quota is full! Reject application automatically.
        const appRef = db.collection('applications').doc(applicationId);
        transaction.update(appRef, {
          status: 'ditolak',
          rejectionReason: 'Kuota perusahaan telah penuh saat konfirmasi persetujuan.',
          updatedAt: FieldValue.serverTimestamp(),
        });
        return;
      }

      // Increment filled quota
      transaction.update(companyRef, {
        filledQuota: currentFilled + 1,
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Assign student to company
      const studentRef = db.collection('users').doc(studentId);
      transaction.update(studentRef, {
        companyId,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    if (quotaExceeded) {
      await createNotification(studentId, {
        type: 'application',
        title: 'Lamaran PKL Ditolak',
        body: 'Mohon maaf, kuota penerimaan perusahaan telah penuh.',
        relatedPath: '/applications',
      });
      return;
    }

    await createNotification(studentId, {
      type: 'application',
      title: 'Lamaran PKL Disetujui',
      body: 'Selamat! Lamaran PKL Anda telah disetujui. Silakan cek detail penempatan di profil Anda.',
      relatedPath: '/profile',
    });
  } else if (status === 'ditolak') {
==== AFTER
  if (status === 'disetujui') {
    let quotaExceeded = false;
    let alreadyProcessed = false;
    let crossPlacementConflict = false;

    await db.runTransaction(async (transaction) => {
      const studentRef = db.collection('users').doc(studentId);
      const studentDoc = await transaction.get(studentRef);

      const appRef = db.collection('applications').doc(applicationId);
      const appDoc = await transaction.get(appRef);

      const companyRef = db.collection('companies').doc(companyId);
      const companyDoc = await transaction.get(companyRef);

      if (!companyDoc.exists) {
        throw new Error(`Company ${companyId} not found`);
      }

      const studentData = studentDoc.data();
      const appData = appDoc.data();

      // 1. Idempotency Check:
      // If student is already assigned to this company OR application was already finalized,
      // exit early as a no-op to prevent duplicate quota increments on Cloud Function retries.
      if (studentData?.companyId === companyId || appData?.quotaAllocated === true) {
        alreadyProcessed = true;
        return;
      }

      // If application was already rejected in a prior attempt (e.g. quota full), exit idempotently.
      if (appData?.status === 'ditolak') {
        alreadyProcessed = true;
        return;
      }

      // 2. Prevent active placement across multiple companies:
      if (studentData?.companyId && studentData.companyId !== companyId) {
        crossPlacementConflict = true;
        transaction.update(appRef, {
          status: 'ditolak',
          rejectionReason: 'Siswa sudah memiliki penempatan aktif di perusahaan lain.',
          updatedAt: FieldValue.serverTimestamp(),
        });
        return;
      }

      // 3. Check Quota
      const compData = companyDoc.data()!;
      const currentFilled = compData.filledQuota || 0;
      const maxQuota = compData.quota || 0;

      if (currentFilled >= maxQuota) {
        quotaExceeded = true;
        transaction.update(appRef, {
          status: 'ditolak',
          rejectionReason: 'Kuota perusahaan telah penuh saat konfirmasi persetujuan.',
          updatedAt: FieldValue.serverTimestamp(),
        });
        return;
      }

      // 4. Atomic Commit
      transaction.update(companyRef, {
        filledQuota: currentFilled + 1,
        updatedAt: FieldValue.serverTimestamp(),
      });

      transaction.update(studentRef, {
        companyId,
        updatedAt: FieldValue.serverTimestamp(),
      });

      transaction.update(appRef, {
        quotaAllocated: true,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    if (alreadyProcessed) {
      console.log(`[onApplicationDecided] Application ${applicationId} already processed (idempotent no-op).`);
      return;
    }

    if (crossPlacementConflict) {
      await createNotification(studentId, {
        type: 'application',
        title: 'Lamaran PKL Ditolak',
        body: 'Lamaran ditolak karena Anda sudah memiliki penempatan aktif di perusahaan lain.',
        relatedPath: '/applications',
      });
      return;
    }

    if (quotaExceeded) {
      await createNotification(studentId, {
        type: 'application',
        title: 'Lamaran PKL Ditolak',
        body: 'Mohon maaf, kuota penerimaan perusahaan telah penuh.',
        relatedPath: '/applications',
      });
      return;
    }

    await createNotification(studentId, {
      type: 'application',
      title: 'Lamaran PKL Disetujui',
      body: 'Selamat! Lamaran PKL Anda telah disetujui. Silakan cek detail penempatan di profil Anda.',
      relatedPath: '/profile',
    });
  } else if (status === 'ditolak') {
>>>>
```

---

### 4.5 Remediation 5: `functions/src/triggers/markAbsentees.ts`

**Target File**: `C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\functions\src\triggers\markAbsentees.ts`

#### Edit 5.1: Chunked Batch Writes ($\le 400$) and Parallel Reads (Lines 14–63)
```typescript
<<<< BEFORE (Lines 14-63)
  // Query all active placed students
  const studentsSnap = await db
    .collection('users')
    .where('role', '==', 'siswa')
    .where('isActive', '==', true)
    .get();

  let processed = 0;
  let marked = 0;

  const batch = db.batch();

  for (const doc of studentsSnap.docs) {
    const student = doc.data();
    if (!student.companyId) continue; // Skip unplaced students

    processed++;
    const attId = `${doc.id}_${dateKey}`;
    const attRef = db.collection('attendances').doc(attId);
    const attDoc = await attRef.get();

    if (!attDoc.exists) {
      batch.set(attRef, {
        id: attId,
        schoolId: student.schoolId,
        uid: doc.id,
        companyId: student.companyId,
        date: dateStr,
        status: 'alpha',
        logbookSubmitted: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      marked++;
    } else if (attDoc.data()?.status === 'pending') {
      batch.update(attRef, {
        status: 'alpha',
        updatedAt: FieldValue.serverTimestamp(),
      });
      marked++;
    }
  }

  if (marked > 0) {
    await batch.commit();
  }

  console.log(`[markAbsentees] Processed ${processed} students, marked ${marked} as alpha for date ${dateStr}.`);
  return { processed, marked };
==== AFTER
  // Query all active placed students
  const studentsSnap = await db
    .collection('users')
    .where('role', '==', 'siswa')
    .where('isActive', '==', true)
    .get();

  const placedStudents = studentsSnap.docs
    .map(doc => ({ id: doc.id, data: doc.data() }))
    .filter(s => !!s.data.companyId);

  const processed = placedStudents.length;
  let marked = 0;

  const BATCH_LIMIT = 400; // Strictly <= 400 writes per commit (Firestore platform max is 500)
  let currentBatch = db.batch();
  let operationsInBatch = 0;

  // Process students in chunks of 50 for parallel attendance verification
  const READ_CHUNK_SIZE = 50;
  for (let i = 0; i < placedStudents.length; i += READ_CHUNK_SIZE) {
    const studentChunk = placedStudents.slice(i, i + READ_CHUNK_SIZE);
    
    const attDocs = await Promise.all(
      studentChunk.map(student => {
        const attId = `${student.id}_${dateKey}`;
        return db.collection('attendances').doc(attId).get();
      })
    );

    for (let j = 0; j < studentChunk.length; j++) {
      const student = studentChunk[j];
      const attDoc = attDocs[j];
      const attRef = attDoc.ref;

      if (!attDoc.exists) {
        currentBatch.set(attRef, {
          id: attDoc.id,
          schoolId: student.data.schoolId,
          uid: student.id,
          companyId: student.data.companyId,
          date: dateStr,
          status: 'alpha',
          logbookSubmitted: false,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        marked++;
        operationsInBatch++;
      } else if (attDoc.data()?.status === 'pending') {
        currentBatch.update(attRef, {
          status: 'alpha',
          updatedAt: FieldValue.serverTimestamp(),
        });
        marked++;
        operationsInBatch++;
      }

      if (operationsInBatch >= BATCH_LIMIT) {
        await currentBatch.commit();
        currentBatch = db.batch();
        operationsInBatch = 0;
      }
    }
  }

  // Commit any remaining writes in the last batch
  if (operationsInBatch > 0) {
    await currentBatch.commit();
  }

  console.log(`[markAbsentees] Processed ${processed} students, marked ${marked} as alpha for date ${dateStr}.`);
  return { processed, marked };
>>>>
```

---

### 4.6 Remediation 6: `seed/seed.js`

**Target File**: `C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\seed\seed.js`

#### Edit 6.1: Add `isActive: true` to Demo Student (Lines 235–248)
```javascript
<<<< BEFORE (Lines 235-248)
    {
      uid: 'user_siswa_luthfi',
      email: 'siswa@smkn1sumedang.sch.id',
      password: 'Password123!',
      displayName: 'Luthfi Nur Zaidan',
      role: 'siswa',
      schoolId: SCHOOL_ID,
      nisn: '0087121894',
      kelas: 'XII RPL 2',
      jurusanId: 'RPL',
      nis: '24.25.X.662',
      companyId: 'comp_telkom_smd',
      statusPkl: 'aktif',
      phone: '08110000005'
    }
==== AFTER
    {
      uid: 'user_siswa_luthfi',
      email: 'siswa@smkn1sumedang.sch.id',
      password: 'Password123!',
      displayName: 'Luthfi Nur Zaidan',
      role: 'siswa',
      schoolId: SCHOOL_ID,
      nisn: '0087121894',
      kelas: 'XII RPL 2',
      jurusanId: 'RPL',
      nis: '24.25.X.662',
      companyId: 'comp_telkom_smd',
      statusPkl: 'aktif',
      isActive: true,
      phone: '08110000005'
    }
>>>>
```

#### Edit 6.2: Add `uid` and ISO Date Format to Seeded Attendance (Lines 292–311)
```javascript
<<<< BEFORE (Lines 292-311)
  // Sample Today's Attendance Record for Luthfi
  const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const attendanceId = `user_siswa_luthfi_${todayStr}`;
  await db.collection('attendances').doc(attendanceId).set({
    id: attendanceId,
    studentId: 'user_siswa_luthfi',
    schoolId: SCHOOL_ID,
    companyId: 'comp_telkom_smd',
    date: todayStr,
    status: 'hadir',
    logbookSubmitted: false, // Initially false to verify checkout gate
    checkIn: {
      time: now,
      lat: -6.8584,
      lng: 107.9212,
      distanceMeters: 12.5,
      verifiedServerSide: true
    },
    createdAt: now
  }, { merge: true });
==== AFTER
  // Sample Today's Attendance Record for Luthfi
  const todayIso = new Date().toISOString().slice(0, 10);
  const todayStr = todayIso.replace(/-/g, '');
  const attendanceId = `user_siswa_luthfi_${todayStr}`;
  await db.collection('attendances').doc(attendanceId).set({
    id: attendanceId,
    uid: 'user_siswa_luthfi',
    studentId: 'user_siswa_luthfi',
    schoolId: SCHOOL_ID,
    companyId: 'comp_telkom_smd',
    date: todayIso,
    status: 'hadir',
    logbookSubmitted: false, // Initially false to verify checkout gate
    checkIn: {
      time: now,
      lat: -6.8584,
      lng: 107.9212,
      distanceMeters: 12.5,
      verifiedServerSide: true
    },
    createdAt: now
  }, { merge: true });
>>>>
```

---

## 5. Verification Method

Once implemented by `m1_worker`, the changes must be verified using the following independent steps:

### 5.1 TypeScript Compilation
Run the TypeScript compiler to ensure strict typing and that `functions/lib/index.js` is produced:
```cmd
cd "C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\functions"
npm install
npm run build
```
*Expected Result*: Process exits with code 0; `lib/` directory contains compiled `.js` and `.d.ts` files without compilation errors.

### 5.2 Unit & Stress Test Execution
Run the Vitest test suite:
```cmd
npm --prefix functions test
```
*Expected Result*: All tests pass, including `functions/test/stress-challenge.test.ts`.

### 5.3 Invalidation Conditions
The remediation is invalidated if:
1. An unplaced student (`companyId: null`) scanning a company QR receives a successful response instead of `permission-denied`.
2. A distance of $50.1\text{ m}$ generates an error message displaying `(50m > 50m)`.
3. A QR token document with `expiresAt: null` or `expiresAt: undefined` is accepted instead of throwing `invalid-argument`.
4. Concurrent or retried approvals result in `filledQuota > quota` or cause an approved application to switch to `ditolak`.
5. Running `executeMarkAbsentees()` for 600 simulated absent students fails with a Firestore batch size exception.
6. Reading `attendances/user_siswa_luthfi_<date>` with client auth UID `user_siswa_luthfi` fails with `permission-denied`.
