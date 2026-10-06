# Handoff Report: Cloud Functions Test Suite Refactoring & Firestore Rules Negative Test Plan

**Agent**: `m1_r2_explorer_tests` (Test Suite Remediation Explorer)  
**Parent Orchestrator**: `e93d1db5-4dd6-49bd-a8fc-9864437f62e2`  
**Working Directory**: `C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\.agents\teamwork\m1_r2_explorer_tests`  
**Timestamp**: 2026-10-06T01:30:00Z  
**Verdict**: **REMEDIATION_PLAN_READY**

---

## 1. Observation

Direct code examination of `functions/src/`, `functions/test/`, `rules-tests/`, and `firestore.rules` revealed the following structural facts:

### 1.1 Facade & Mock Replica Test Implementations in `functions/test/`
Inspection confirmed Reviewer 1's findings: 7 out of 8 unit test suites in `functions/test/` test local mock replicas or perform tautological in-memory state mutations without importing any production files from `src/`:

1. **`functions/test/completeRegistration.test.ts` (lines 1–41)**:
   - Imports: Only `import { describe, it, expect } from 'vitest'`.
   - Logic: Mutates local objects `roster.isRegistered = true; school.studentQuotaUsed += 1;` (lines 20–33) and verifies `expect(roster.isRegistered).toBe(true)`.
   - Never imports or invokes `functions/src/callable/completeRegistration.ts`.
2. **`functions/test/lookupNisn.test.ts` (lines 1–75)**:
   - Defines a local duplicate mock function `function mockLookupNisn(nisn: string)` (lines 23–46) querying a static in-memory array `mockRoster`.
   - Never imports or invokes `functions/src/callable/lookupNisn.ts`.
3. **`functions/test/getUploadUrl.test.ts` (lines 1–38)**:
   - Defines local duplicate arrays `allowedFolders`, `whitelist` and local function `validateUploadRequest` (lines 4–20).
   - Never imports `functions/src/callable/getUploadUrl.ts` or its constants.
4. **`functions/test/onApplicationDecided.test.ts` (lines 1–31)**:
   - Evaluates local integer increment `company.filledQuota += 1` and status assignment.
   - Never imports `functions/src/triggers/onApplicationDecided.ts`.
5. **`functions/test/onAssessmentFinalized.test.ts` (lines 1–24)**:
   - Evaluates local numeric comparison `score >= talentThreshold`.
   - Never imports `functions/src/triggers/onAssessmentFinalized.ts`.
6. **`functions/test/onLogbookCreated.test.ts` (lines 1–21)**:
   - Mutates local object `attendance.logbookSubmitted = true`.
   - Never imports `functions/src/triggers/onLogbookCreated.ts`.
7. **`functions/test/qr.test.ts` (lines 1–50)**:
   - Defines an isolated inline function `function validateQrToken(...)` (lines 4–18).
   - In production, QR verification logic is duplicated in `functions/src/triggers/verifyAttendance.ts` (lines 33–46) and `functions/src/triggers/verifyCheckout.ts` (lines 58–70), neither of which is imported by `qr.test.ts`.
8. **Missing Test Coverage for Key Triggers**:
   - `functions/src/triggers/markAbsentees.ts` (batch write and absentee cron) has zero test file in `functions/test/`.
   - `functions/src/triggers/verifyAttendance.ts` and `functions/src/triggers/verifyCheckout.ts` have zero trigger integration test files.

### 1.2 Blindspots in `rules-tests/firestore-rules.test.ts`
Inspection of `rules-tests/firestore-rules.test.ts` (514 lines) against `firestore.rules` (369 lines) confirmed:
1. **No Negative Test for User Self-Escalation**:
   - `firestore.rules` line 133 allows `request.auth.uid == userId` to update `/users/{userId}` without field restriction.
   - `rules-tests` has zero assertions checking whether a student (`student_a_uid`) can update `role: 'admin'`, `role: 'super_admin'`, `schoolId: null`, or `companyId: '...'`.
2. **No Negative Test for Attendance Initial Creation Integrity**:
   - `firestore.rules` line 186 allows `request.auth.uid == request.resource.data.uid && isSiswa()` on create.
   - `rules-tests` has zero assertions checking whether a student can create an attendance doc with `checkOut` pre-populated or `logbookSubmitted: true` pre-set.
3. **No Negative Test for Tenant Deletion on Auxiliary Collections**:
   - `firestore.rules` lines 311, 316, 326, 333, 343, 365 contain `delete: if isSuperAdmin() || isAdminSekolah(request.resource.data.schoolId)`.
   - On a delete operation, `request.resource.data` is `null`. `rules-tests` has zero assertions testing delete operations on `academicYears`, `majors`, `roster`, or `mentorships`.

---

## 2. Logic Chain

1. **Root Cause of Facade Tests**:
   - Firebase Functions v2 wraps callable functions with `onCall(...)` and triggers with `onDocumentUpdated(...)` / `onDocumentCreated(...)`.
   - Because the core business logic was authored entirely inside the anonymous callback closures of `onCall` and `onDocumentUpdated`, the previous developer took the shortcut of re-creating mock functions and local objects inside the test files rather than exporting testable handler functions.
2. **Resolution Strategy for Cloud Functions Testing**:
   - To achieve genuine production testing with Vitest without requiring live Firebase emulators or network connectivity, each Cloud Function module must separate:
     a. **The Handler Core Function**: Accepts explicit arguments (request payload, auth context, database instance / mocks) and returns the domain result.
     b. **The Cloud Function Trigger Wrapper**: Invokes the core handler inside `onCall` or `onDocumentUpdated`.
   - For shared algorithms (such as Dynamic QR verification with clock skew leeway and timestamp parsing), extract the logic into a pure utility module `src/utils/qr.ts`, import it in `verifyAttendance.ts` and `verifyCheckout.ts`, and test it directly in `qr.test.ts`.
3. **Resolution Strategy for Security Rules Testing**:
   - When `firestore.rules` is patched (by `m1_r2_explorer_rules` / `m1_worker`) to:
     a. Restrict `/users/{userId}` updates so users cannot self-escalate `role`, `schoolId`, `companyId`, or `isActive`.
     b. Restrict `/attendances/{id}` creates so students cannot inject `checkOut` or `logbookSubmitted == true`.
     c. Fix delete rules to check `resource.data.schoolId`.
   - `rules-tests/firestore-rules.test.ts` must be expanded with corresponding `assertFails` and `assertSucceeds` test blocks verifying these boundaries.

---

## 3. Surgical Refactoring Blueprint

### 3.1 Cloud Functions Test Suite Refactoring (`functions/test/`)

#### Suite 1: `functions/test/geo.test.ts`
- **Source Module Under Test**: `../src/utils/geo.ts`
- **Imports**: `import { calculateHaversineDistance, isWithinGeofence, EARTH_RADIUS_METERS } from '../src/utils/geo'`
- **Test Scenarios**:
  1. Exact boundary at 50.000m: degree offset $\Delta = (50 / 6371000) \times (180 / \pi)^\circ \approx 0.00044966^\circ$. Asserts `isWithinGeofence` is `true`.
  2. Exact boundary at 50.001m: degree offset $\Delta = (50.001 / 6371000) \times (180 / \pi)^\circ$. Asserts `isWithinGeofence` is `false`.
  3. Negative coordinates handling: Southern hemisphere (Sumedang: -6.85854, 107.91942) and Western hemisphere.
  4. Antimeridian crossing: coordinates spanning 179.99999° and -179.99999° (distance < 5m).
  5. Antipodal points and clamping: pole to pole distance equals $\pi \times R$.
  6. Input sanitization: throws Error when coordinates are non-numeric, `NaN`, `null`, or `undefined`.

#### Suite 2: `functions/test/qr.test.ts`
- **Source Module Under Test**: `../src/utils/qr.ts` (extracted pure validation utility)
- **Module Design in `src/utils/qr.ts`**:
  ```typescript
  export interface ValidateQrResult {
    valid: boolean;
    code?: string;
    message?: string;
  }

  export function validateQrToken(
    activeToken: string,
    scannedToken: string,
    expiresAt: any,
    nowMs: number = Date.now(),
    skewToleranceMs: number = 30000
  ): ValidateQrResult {
    if (!activeToken || !scannedToken || activeToken !== scannedToken) {
      return { valid: false, code: 'invalid-argument', message: 'Token QR tidak valid atau telah diperbarui.' };
    }

    if (expiresAt === null || expiresAt === undefined) {
      return { valid: false, code: 'invalid-argument', message: 'Format waktu kedaluwarsa QR tidak valid.' };
    }

    let expMs: number;
    if (typeof expiresAt === 'number') {
      expMs = expiresAt;
    } else if (typeof expiresAt?.toMillis === 'function') {
      expMs = expiresAt.toMillis();
    } else {
      expMs = new Date(expiresAt).getTime();
    }

    if (isNaN(expMs)) {
      return { valid: false, code: 'invalid-argument', message: 'Waktu kedaluwarsa QR tidak dapat diparsing.' };
    }

    if (nowMs > expMs + skewToleranceMs) {
      return { valid: false, code: 'deadline-exceeded', message: 'QR Code telah kedaluwarsa, silakan scan QR terbaru.' };
    }

    return { valid: true };
  }
  ```
- **Direct Import in `test/qr.test.ts`**:
  `import { validateQrToken } from '../src/utils/qr'`
- **Test Scenarios**:
  1. Matching token within 60s TTL -> `{ valid: true }`.
  2. Mismatched token (regenerated or wrong company) -> `{ valid: false, code: 'invalid-argument' }`.
  3. Expired token within 30s clock skew tolerance (e.g. 75s after generation) -> `{ valid: true }`.
  4. Expired token past 30s skew tolerance (e.g. 91s after generation) -> `{ valid: false, code: 'deadline-exceeded' }`.
  5. Security Edge Case (Challenger 1 Finding): `expiresAt` is `undefined`, `null`, `'invalid-date'`, or `NaN` -> rejects with `invalid-argument` rather than bypassing expiration.
  6. Support for Firestore `Timestamp` objects (`toMillis()`) and raw numeric epoch timestamps.

#### Suite 3: `functions/test/lookupNisn.test.ts`
- **Source Module Under Test**: `../src/callable/lookupNisn.ts`
- **Module Interface**: Export handler `handleLookupNisn(data: LookupNisnRequest, database = db): Promise<LookupNisnResponse>`.
- **Direct Import in `test/lookupNisn.test.ts`**:
  `import { handleLookupNisn } from '../src/callable/lookupNisn'`
- **Test Scenarios**:
  1. Invalid NISN validation: throws `HttpsError('invalid-argument')` for empty string, 9 digits, 11 digits, alphanumeric characters (e.g. `'008712189A'`).
  2. Direct roster doc lookup (`roster/{cleanNisn}`):
     - Found & unregistered: returns `{ found: true, registered: false, status: 'valid', student: { ... } }`.
     - Found & registered (`isRegistered: true`): returns `{ found: true, registered: true, status: 'already-registered' }`.
  3. Fallback query lookup (`db.collection('roster').where('nisn', '==', cleanNisn)`):
     - Resolves student doc when document ID is not NISN.
     - With `schoolId` filter matching vs mismatching.
  4. Roster record not found in doc or query: returns `{ found: false, registered: false, status: 'not-found' }`.

#### Suite 4: `functions/test/completeRegistration.test.ts`
- **Source Module Under Test**: `../src/callable/completeRegistration.ts`
- **Module Interface**: Export handler `handleCompleteRegistration(data: CompleteRegistrationRequest, auth: any, database = db): Promise<CompleteRegistrationResponse>`.
- **Direct Import in `test/completeRegistration.test.ts`**:
  `import { handleCompleteRegistration } from '../src/callable/completeRegistration'`
- **Test Scenarios**:
  1. Unauthenticated request (`auth == null`): throws `HttpsError('unauthenticated')`.
  2. Invalid NISN: throws `HttpsError('invalid-argument')`.
  3. User profile already registered (`userDoc.exists && userDoc.data().isRegistered === true`): throws `HttpsError('already-exists')`.
  4. NISN not found in roster: throws `HttpsError('not-found')`.
  5. NISN already registered by another account: throws `HttpsError('already-exists')`.
  6. Atomic transaction verification:
     - Marks roster record: `transaction.update(rosterRef, { isRegistered: true, registeredUid: uid, ... })`.
     - Creates user doc: `transaction.set(userRef, { uid, role: 'siswa', schoolId, jurusanId, nisn, name, email, phone, kelas, companyId: null, isRegistered: true, isActive: true, ... })`.
     - Increments school quota: `transaction.update(schoolRef, { studentQuotaUsed: FieldValue.increment(1), ... })`.
     - Returns `{ success: true, uid, message: ... }`.

#### Suite 5: `functions/test/getUploadUrl.test.ts`
- **Source Module Under Test**: `../src/callable/getUploadUrl.ts`
- **Module Interface**: Export `ALLOWED_FOLDERS`, `FOLDER_MIME_WHITELIST`, and `handleGetUploadUrl(data: GetUploadUrlRequest, auth: any, urlSignerFn?: any): Promise<GetUploadUrlResponse>`.
- **Direct Import in `test/getUploadUrl.test.ts`**:
  `import { handleGetUploadUrl, ALLOWED_FOLDERS, FOLDER_MIME_WHITELIST } from '../src/callable/getUploadUrl'`
- **Test Scenarios**:
  1. Unauthenticated request: throws `HttpsError('unauthenticated')`.
  2. Disallowed folder (e.g. `'binaries'`, `'executables'`, `''`): throws `HttpsError('invalid-argument')`.
  3. Disallowed MIME type for folder:
     - `image/png` for `finalReports` (only `application/pdf` allowed) -> throws `HttpsError('invalid-argument')`.
     - `application/zip` for `logbooks` -> throws `HttpsError('invalid-argument')`.
  4. Allowed MIME types:
     - `image/jpeg`, `image/png`, `image/webp` for `logbooks`, `avatars`, `proofs`.
     - `application/pdf` for `finalReports`.
  5. Path parsing: when `data.path = 'logbooks/foto.png'`, correctly resolves folder and filename.
  6. Storage key structure: verifies format `${folder}/${uid}/${timestamp}_${uuid}_${cleanFilename}`.
  7. Returns `{ uploadUrl, publicUrl, key, expiresAt }`.

#### Suite 6: `functions/test/onApplicationDecided.test.ts`
- **Source Module Under Test**: `../src/triggers/onApplicationDecided.ts`
- **Module Interface**: Export `handleApplicationDecided(before: any, after: any, applicationId: string, database = db, notifyFn = createNotification): Promise<void>`.
- **Direct Import in `test/onApplicationDecided.test.ts`**:
  `import { handleApplicationDecided } from '../src/triggers/onApplicationDecided'`
- **Test Scenarios**:
  1. Status transition filter: ignores events if `before.status !== 'menunggu'` or `after.status` is neither `'disetujui'` nor `'ditolak'`.
  2. Transition to `'disetujui'` with available quota:
     - Atomically increments company `filledQuota` (`currentFilled + 1`).
     - Updates student document: `users/{studentId}` set `companyId = companyId`.
     - Dispatches notification to student with title `'Lamaran PKL Disetujui'` and link `/profile`.
  3. Transition to `'disetujui'` when company quota is FULL (`currentFilled >= maxQuota`):
     - Automatically rejects application: updates application to `status = 'ditolak'`.
     - Sets rejectionReason: `'Kuota perusahaan telah penuh saat konfirmasi persetujuan.'`.
     - Does NOT increment `filledQuota`.
     - Does NOT assign student `companyId`.
     - Dispatches notification to student indicating quota full.
  4. Transition to `'ditolak'`:
     - Dispatches rejection notification with reason provided.
  5. Idempotency handling: gracefully handles retried invocations without double-incrementing quota.

#### Suite 7: `functions/test/onAssessmentFinalized.test.ts`
- **Source Module Under Test**: `../src/triggers/onAssessmentFinalized.ts`
- **Module Interface**: Export `handleAssessmentFinalized(before: any, after: any, assessmentId: string, database = db, notifyFn = createNotification): Promise<void>`.
- **Direct Import in `test/onAssessmentFinalized.test.ts`**:
  `import { handleAssessmentFinalized } from '../src/triggers/onAssessmentFinalized'`
- **Test Scenarios**:
  1. Trigger guard: ignores events if `before.status === 'final'` or `after.status !== 'final'`.
  2. Custom school talent threshold:
     - School document sets `talentThreshold = 90`. Score = 88 -> `isRecommendedTalent = false`.
     - School document sets `talentThreshold = 80`. Score = 85 -> `isRecommendedTalent = true`.
  3. Default threshold fallback: if school doc does not exist or has no threshold, defaults to 85.
  4. Score >= threshold sets `isRecommendedTalent: true` on `assessments/{assessmentId}` and dispatches talent recommendation notification.
  5. Score < threshold sets `isRecommendedTalent: false` and dispatches standard completion notification.

#### Suite 8: `functions/test/onLogbookCreated.test.ts`
- **Source Module Under Test**: `../src/triggers/onLogbookCreated.ts`
- **Module Interface**: Export `handleLogbookCreated(logbook: any, logbookId: string, database = db): Promise<void>`.
- **Direct Import in `test/onLogbookCreated.test.ts`**:
  `import { handleLogbookCreated } from '../src/triggers/onLogbookCreated'`
- **Test Scenarios**:
  1. Missing snapshot data: returns early without error.
  2. Explicit `attendanceId`: updates `attendances/{attendanceId}` with `logbookSubmitted: true`.
  3. Fallback resolution: constructs `attendanceId = ${uid}_${date.replace(/-/g, '')}` when `attendanceId` is missing from logbook.
  4. Missing both `attendanceId` and date/uid: logs warning and exits safely.
  5. Merges update onto attendance doc preserving existing fields (`{ merge: true }`).

#### Suite 9: `functions/test/markAbsentees.test.ts` (New Dedicated Suite)
- **Source Module Under Test**: `../src/triggers/markAbsentees.ts`
- **Function**: `export async function executeMarkAbsentees(customDate?: string, database = db): Promise<{ processed: number; marked: number }>`
- **Direct Import in `test/markAbsentees.test.ts`**:
  `import { executeMarkAbsentees } from '../src/triggers/markAbsentees'`
- **Test Scenarios**:
  1. Student filtering: processes only active placed students (`role == 'siswa'` and `isActive == true` and `companyId != null`).
  2. Skips unplaced students (`companyId == null`).
  3. Creates `attendances/{studentId}_{yyyyMMdd}` with `status: 'alpha'` for students with no attendance doc.
  4. Updates attendance docs with `status: 'pending'` to `'alpha'`.
  5. Preserves existing attendance records with `status: 'hadir'`, `'izin'`, or `'sakit'`.
  6. **Scalability Batch Chunking**: Simulates 600 absent students; verifies operations are chunked in batches of $\le 400$ writes, calling `batch.commit()` multiple times without hitting Firestore's 500-write limit.

#### Suite 10: `functions/test/presensi.test.ts` (New Callable Handlers Suite)
- **Source Modules Under Test**: `../src/triggers/verifyAttendance.ts` and `../src/triggers/verifyCheckout.ts`
- **Module Interface**: Export `handleVerifyAttendance(...)` and `handleVerifyCheckout(...)`.
- **Direct Imports**:
  `import { handleVerifyAttendance } from '../src/triggers/verifyAttendance'`  
  `import { handleVerifyCheckout } from '../src/triggers/verifyCheckout'`
- **Test Scenarios**:
  1. `verifyAttendance`:
     - Unassigned student (`userData.companyId == null`): throws `permission-denied` (Reviewer 1 Finding 2.4).
     - Student assigned to Company A scanning Company B QR: throws `permission-denied`.
     - Scan distance > 50m (e.g. 50.3m): throws `failed-precondition` with error formatted as `50.3m > 50m` (Challenger 1 Finding 1.1).
     - Valid scan: writes `status: 'hadir'`, `verifiedServerSide: true`, returns `success: true`.
     - Repeated scan on same day: returns existing check-in without duplicate write.
  2. `verifyCheckout`:
     - Check-out with `logbookSubmitted == false`: throws `failed-precondition` (check-out gate locked).
     - Check-out with different `companyId` than check-in attendance: throws `permission-denied` (Reviewer 1 Finding 2.5).
     - Check-out with valid QR and geofence: writes `checkOut` object to attendance doc.

---

### 3.2 Security Rules Negative Test Design (`rules-tests/firestore-rules.test.ts`)

The following test suites must be added to `rules-tests/firestore-rules.test.ts` to test newly patched rules:

```typescript
// ===========================================================================
// INVARIANT 8: USER SELF-ESCALATION & PROFILE IMMUTABILITY
// ===========================================================================
describe('Invariant 8: User self-escalation & sensitive field immutability', () => {
  it('denies Siswa from elevating their own role to "admin"', async () => {
    const studentDb = testEnv.authenticatedContext('student_a_uid', {
      role: 'siswa',
      schoolId: 'smkn1_sumedang',
    }).firestore();

    await assertFails(
      studentDb.doc('users/student_a_uid').update({
        role: 'admin',
      })
    );
  });

  it('denies Siswa from elevating their own role to "super_admin"', async () => {
    const studentDb = testEnv.authenticatedContext('student_a_uid', {
      role: 'siswa',
      schoolId: 'smkn1_sumedang',
    }).firestore();

    await assertFails(
      studentDb.doc('users/student_a_uid').update({
        role: 'super_admin',
      })
    );
  });

  it('denies Siswa from altering their schoolId to escape tenant boundary', async () => {
    const studentDb = testEnv.authenticatedContext('student_a_uid', {
      role: 'siswa',
      schoolId: 'smkn1_sumedang',
    }).firestore();

    await assertFails(
      studentDb.doc('users/student_a_uid').update({
        schoolId: 'smkn2_sumedang',
      })
    );
  });

  it('denies Siswa from altering their assigned companyId', async () => {
    const studentDb = testEnv.authenticatedContext('student_a_uid', {
      role: 'siswa',
      schoolId: 'smkn1_sumedang',
    }).firestore();

    await assertFails(
      studentDb.doc('users/student_a_uid').update({
        companyId: 'pt_unassigned_company',
      })
    );
  });

  it('allows Siswa to update benign profile fields (phone, address, avatarUrl)', async () => {
    const studentDb = testEnv.authenticatedContext('student_a_uid', {
      role: 'siswa',
      schoolId: 'smkn1_sumedang',
    }).firestore();

    await assertSucceeds(
      studentDb.doc('users/student_a_uid').update({
        phone: '081234567890',
        address: 'Jl. Sumedang No. 12',
      })
    );
  });
});

// ===========================================================================
// INVARIANT 9: ATTENDANCE CREATION RESTRAINTS
// ===========================================================================
describe('Invariant 9: Attendance document creation security constraints', () => {
  it('denies Siswa from creating attendance with pre-filled checkOut object', async () => {
    const studentDb = testEnv.authenticatedContext('student_a_uid', {
      role: 'siswa',
      schoolId: 'smkn1_sumedang',
    }).firestore();

    await assertFails(
      studentDb.doc('attendances/att_create_hack_1').set({
        schoolId: 'smkn1_sumedang',
        uid: 'student_a_uid',
        companyId: 'pt_inovasi_digital',
        date: '2026-10-06',
        status: 'hadir',
        logbookSubmitted: false,
        checkIn: { time: new Date() },
        checkOut: { time: new Date(), distanceMeters: 10 },
      })
    );
  });

  it('denies Siswa from creating attendance with logbookSubmitted = true', async () => {
    const studentDb = testEnv.authenticatedContext('student_a_uid', {
      role: 'siswa',
      schoolId: 'smkn1_sumedang',
    }).firestore();

    await assertFails(
      studentDb.doc('attendances/att_create_hack_2').set({
        schoolId: 'smkn1_sumedang',
        uid: 'student_a_uid',
        companyId: 'pt_inovasi_digital',
        date: '2026-10-06',
        status: 'hadir',
        logbookSubmitted: true,
        checkIn: { time: new Date() },
      })
    );
  });

  it('denies Siswa from creating attendance for another student uid', async () => {
    const studentDb = testEnv.authenticatedContext('student_a_uid', {
      role: 'siswa',
      schoolId: 'smkn1_sumedang',
    }).firestore();

    await assertFails(
      studentDb.doc('attendances/att_create_hack_3').set({
        schoolId: 'smkn1_sumedang',
        uid: 'student_spoofed_uid',
        companyId: 'pt_inovasi_digital',
        date: '2026-10-06',
        status: 'hadir',
        logbookSubmitted: false,
      })
    );
  });

  it('denies Siswa from creating attendance with mismatched schoolId', async () => {
    const studentDb = testEnv.authenticatedContext('student_a_uid', {
      role: 'siswa',
      schoolId: 'smkn1_sumedang',
    }).firestore();

    await assertFails(
      studentDb.doc('attendances/att_create_hack_4').set({
        schoolId: 'smkn2_sumedang',
        uid: 'student_a_uid',
        companyId: 'pt_inovasi_digital',
        date: '2026-10-06',
        status: 'hadir',
        logbookSubmitted: false,
      })
    );
  });
});

// ===========================================================================
// INVARIANT 10: ATTENDANCE UPDATE FIELD WHITELIST
// ===========================================================================
describe('Invariant 10: Attendance update tampering prevention', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.doc('attendances/att_alpha_record').set({
        schoolId: 'smkn1_sumedang',
        uid: 'student_a_uid',
        companyId: 'pt_inovasi_digital',
        date: '2026-10-06',
        status: 'alpha',
        logbookSubmitted: false,
      });
    });
  });

  it('denies Siswa from manually changing status from alpha to hadir', async () => {
    const studentDb = testEnv.authenticatedContext('student_a_uid', {
      role: 'siswa',
      schoolId: 'smkn1_sumedang',
    }).firestore();

    await assertFails(
      studentDb.doc('attendances/att_alpha_record').update({
        status: 'hadir',
      })
    );
  });

  it('denies Siswa from tampering with checkIn verification stamps', async () => {
    const studentDb = testEnv.authenticatedContext('student_a_uid', {
      role: 'siswa',
      schoolId: 'smkn1_sumedang',
    }).firestore();

    await assertFails(
      studentDb.doc('attendances/att_alpha_record').update({
        'checkIn.verifiedServerSide': true,
      })
    );
  });
});

// ===========================================================================
// INVARIANT 11: MASTER DATA DELETION TENANT ISOLATION
// ===========================================================================
describe('Invariant 11: Master & Auxiliary data deletion scoped to same school', () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.doc('academicYears/ay_school_a').set({
        schoolId: 'smkn1_sumedang',
        year: '2026/2027',
      });
      await db.doc('majors/major_school_a').set({
        schoolId: 'smkn1_sumedang',
        name: 'Rekayasa Perangkat Lunak',
      });
      await db.doc('roster/roster_school_a').set({
        schoolId: 'smkn1_sumedang',
        nisn: '0091113849',
      });
    });
  });

  it('allows Admin Sekolah of SAME school to delete academicYears', async () => {
    const adminSchoolADb = testEnv.authenticatedContext('admin_school_a_uid', {
      role: 'admin',
      schoolId: 'smkn1_sumedang',
    }).firestore();

    await assertSucceeds(adminSchoolADb.doc('academicYears/ay_school_a').delete());
  });

  it('denies Admin Sekolah of DIFFERENT school from deleting academicYears', async () => {
    const adminSchoolBDb = testEnv.authenticatedContext('admin_school_b_uid', {
      role: 'admin',
      schoolId: 'smkn2_sumedang',
    }).firestore();

    await assertFails(adminSchoolBDb.doc('academicYears/ay_school_a').delete());
  });

  it('allows Admin Sekolah of SAME school to delete majors and roster', async () => {
    const adminSchoolADb = testEnv.authenticatedContext('admin_school_a_uid', {
      role: 'admin',
      schoolId: 'smkn1_sumedang',
    }).firestore();

    await assertSucceeds(adminSchoolADb.doc('majors/major_school_a').delete());
    await assertSucceeds(adminSchoolADb.doc('roster/roster_school_a').delete());
  });

  it('denies Siswa from deleting academicYears, majors, or roster', async () => {
    const studentDb = testEnv.authenticatedContext('student_a_uid', {
      role: 'siswa',
      schoolId: 'smkn1_sumedang',
    }).firestore();

    await assertFails(studentDb.doc('academicYears/ay_school_a').delete());
    await assertFails(studentDb.doc('majors/major_school_a').delete());
    await assertFails(studentDb.doc('roster/roster_school_a').delete());
  });
});
```

---

## 4. Caveats

1. **Read-Only Explorer Scope**: In accordance with the Teamwork Explorer protocol, this report presents specifications and designs without directly editing source code or rules. Implementation is assigned to `m1_worker`.
2. **Mocking Granularity**: Unit tests in `functions/test/` should mock Firebase Admin / Firestore SDK services at the service boundary (`vi.mock('../src/utils/admin')`) to maintain fast (<2s), self-contained test execution without emulator daemon dependencies. Full emulator verification is executed separately by `rules-tests/` and `e2e/`.
3. **Synchronization with Rule Changes**: The additional negative assertions for Firestore rules depend on `m1_r2_explorer_rules`'s recommended patches being applied to `firestore.rules` (specifically user self-escalation blocks and attendance create restrictions). Running the new assertions against the unpatched rules will properly fail, validating the test suite's adversarial detection power.

---

## 5. Conclusion

1. **Integrity Remediation Path**: All 7 self-certifying mock test files in `functions/test/` can be refactored into genuine unit tests by exporting core handlers from `src/` modules and importing them directly in `test/`.
2. **Extracted Pure QR Utility**: Extracting `validateQrToken` into `functions/src/utils/qr.ts` eliminates code duplication across `verifyAttendance.ts` and `verifyCheckout.ts` while allowing `test/qr.test.ts` to test genuine production logic (including the `NaN` / missing expiration vulnerability).
3. **New Test Suites**:
   - `functions/test/markAbsentees.test.ts` tests absentee cron logic and batch write partitioning (<=400 operations).
   - `functions/test/presensi.test.ts` tests double-verification callables with unassigned student and cross-company checkout edge cases.
4. **Enhanced Security Rules Suite**: Adding 4 negative test suites (14 concrete assertions) to `rules-tests/firestore-rules.test.ts` closes all security blindspots identified by Reviewer 2 and Challenger 2.

---

## 6. Verification Method

Once implemented by `m1_worker`:

1. **Static AST & Import Verification**:
   Verify that all test files in `functions/test/` import their target functions and constants directly from `../src/`:
   ```powershell
   Select-String -Path "functions/test/*.test.ts" -Pattern "from '\.\./src/"
   ```
   *Expected*: Every test file (10 files) must contain at least one import statement targeting `../src/`.

2. **Run Cloud Functions Build & Vitest Suite**:
   ```powershell
   npm --prefix functions run build
   npm --prefix functions test
   ```
   *Expected*: Zero TypeScript compilation errors; 10 test suites pass with 100% genuine assertion coverage.

3. **Run Firestore Security Rules Test Suite**:
   ```powershell
   npm --prefix rules-tests test
   ```
   *Expected*: 11 Invariant suites (including newly added Invariants 8, 9, 10, 11) pass against the local Firestore emulator.
