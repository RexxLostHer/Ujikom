# Adversarial Analysis: Firestore Security Rules Bypass Vectors

**Target**: `firestore.rules` (369 lines)  
**Evaluator**: `m1_challenger_2` (Empirical Challenger / Critic)  
**Date**: 2026-10-06  

---

## 1. Executive Summary

We conducted an adversarial security challenge against `firestore.rules` focusing on the bypass vectors specified in the assignment dispatch:
1. `checkOut` update when `logbookSubmitted == false`
2. Direct write of `logbookSubmitted: true`
3. Cross-school access and `schoolId` spoofing in attendances and logbooks
4. Direct application creation with status `'disetujui'`
5. Company deletion by non-super-admin (School Admin)
6. Direct `filledQuota` mutation on companies
7. Cross-company logbook review by mentors

### Verdict: **REQUEST_CHANGES**

While several critical defenses are structurally secure (company deletion, `filledQuota` mutation, application auto-approval, and `checkOut` gate on `update`), we identified **3 confirmed bypass vectors and 1 critical privilege escalation flaw**:
- **Bypass Vector 1**: `schoolId` spoofing is permitted during attendance creation (`allow create`) and on attendance update (`allow update`), because `schoolId` is not constrained against `getSchoolId()`.
- **Bypass Vector 2**: Direct creation of attendance documents with `logbookSubmitted: true` and pre-populated `checkOut` is permitted during `allow create` because `logbookSubmitted` and `checkOut` barriers only exist on `allow update`.
- **Bypass Vector 3**: Unrestricted field tampering on `attendances` update (`allow update`) allows students to alter `status` (clearing `alpha` marks), `checkIn` GPS coordinates, and `date` due to a lack of an affected-keys whitelist.
- **Critical Flaw 4**: User profile self-update (`users/{userId}`) has no field blacklist/whitelist, allowing any student without custom claims to set `role: 'admin'` and `schoolId: null`, escalating directly to `isSuperAdmin()`.

---

## 2. In-Depth Vector Breakdown

### Vector 1: Attendance `checkOut` update when `logbookSubmitted == false`
- **Rule Lines**: 190–199 (`firestore.rules`)
```javascript
// INVARIANT 4: Attendance checkout barrier
allow update: if isAuthenticated() && (
  isSuperAdmin() ||
  isAdminSekolah(resource.data.schoolId) ||
  (
    request.auth.uid == resource.data.uid &&
    !request.resource.data.diff(resource.data).affectedKeys().hasAny(['logbookSubmitted']) &&
    (!request.resource.data.diff(resource.data).affectedKeys().hasAny(['checkOut']) ||
     resource.data.logbookSubmitted == true)
  )
);
```
- **Analysis**:
  When a student updates an existing attendance document where `resource.data.logbookSubmitted == false`:
  - `affectedKeys()` contains `'checkOut'` $\rightarrow$ `!hasAny(['checkOut'])` is `false`.
  - `resource.data.logbookSubmitted == true` is `false`.
  - `(false || false)` is `false`.
  - Whole expression evaluates to `false`.
- **Empirical Evidence**: Covered by unit test `rules-tests/firestore-rules.test.ts:272-283` (`assertFails`).
- **Verdict**: **SECURE** on `update`.

---

### Vector 2: Directly write `logbookSubmitted: true`
- **Update Path**:
  - `!request.resource.data.diff(resource.data).affectedKeys().hasAny(['logbookSubmitted'])`
  - Any update containing `logbookSubmitted` is rejected.
  - Covered by unit test `rules-tests/firestore-rules.test.ts:298-309` (`assertFails`).
- **Create Path (BYPASS FOUND)**:
  - Lines 183–187 (`firestore.rules`):
```javascript
allow create: if isAuthenticated() && (
  isSuperAdmin() ||
  isAdminSekolah(request.resource.data.schoolId) ||
  (request.auth.uid == request.resource.data.uid && isSiswa())
);
```
  - **Attack Scenario**: A malicious student directly calls `set()` on a new doc path (e.g., `attendances/{student_uid}_{today}` before check-in or any arbitrary ID):
```json
{
  "uid": "student_a_uid",
  "schoolId": "smkn1_sumedang",
  "status": "hadir",
  "logbookSubmitted": true,
  "checkIn": { "time": "2026-10-06T07:00:00Z" }
}
```
  - The evaluation:
    - `request.auth.uid == request.resource.data.uid` is `true`.
    - `isSiswa()` is `true`.
    - There is **no condition** checking `logbookSubmitted == false` or preventing `logbookSubmitted` during `create`.
  - **Result**: Document is created with `logbookSubmitted: true`. Subsequent checkout or callable checks (`attData.logbookSubmitted === true`) are completely bypassed!
- **Verdict**: **VULNERABLE (Bypass via CREATE)**.

---

### Vector 3: Cross-school access and `schoolId` spoofing
- **Read Access**:
  - `attendances` (lines 177–181) requires `request.auth.uid == resource.data.uid` for students, and `getSchoolId() == resource.data.schoolId` for staff.
  - `logbooks` (lines 209–214) requires `request.auth.uid == resource.data.uid` for students, and matching company/school ID for mentors/staff.
  - Cross-school reading is **SECURE**. Covered by `rules-tests/firestore-rules.test.ts:475-501`.
- **Write / Spoofing in `logbooks`**:
  - Line 219: `(getSchoolId() == null || request.resource.data.schoolId == getSchoolId())`.
  - A registered student cannot set `schoolId` to another school. **SECURE**.
- **Write / Spoofing in `attendances` (BYPASS FOUND)**:
  - On `create` (line 186):
    `(request.auth.uid == request.resource.data.uid && isSiswa())`
    Notice: **Zero validation of `request.resource.data.schoolId`**!
    A student from `smkn1_sumedang` can create an attendance record with `schoolId: 'smkn2_sumedang'`.
  - On `update` (lines 193–198):
    There is no field whitelist. The rule only checks `!affectedKeys().hasAny(['logbookSubmitted'])`.
    A student can update `schoolId: 'smkn2_sumedang'` on their existing attendance doc.
- **Verdict**: **VULNERABLE (Bypass via attendance CREATE and UPDATE)**.

---

### Vector 4: Student creating application with status `'disetujui'` directly
- **Rule Lines**: 162–170 (`firestore.rules`)
```javascript
allow create: if isSiswa() &&
  request.resource.data.studentId == request.auth.uid &&
  request.resource.data.status == 'menunggu' &&
  (getSchoolId() == null || request.resource.data.schoolId == getSchoolId());
```
- **Analysis**:
  - `request.resource.data.status == 'menunggu'` is strictly checked. If set to `'disetujui'`, creation is denied.
  - Students have no `allow update` permissions on applications (restricted to `isSuperAdmin()` and `isAdminSekolah()`).
- **Empirical Evidence**: Covered by `rules-tests/firestore-rules.test.ts:223-238` (`assertFails`).
- **Verdict**: **SECURE**.

---

### Vector 5: School Admin deleting a company
- **Rule Lines**: 103–105 (`firestore.rules`)
```javascript
allow delete: if isSuperAdmin();
```
- **Analysis**:
  - `isSuperAdmin()` requires `request.auth.token.role == 'super_admin'` OR `(getRole() == 'admin' && (getSchoolId() == null || getSchoolId() == ''))`.
  - A School Admin has `schoolId != null` (e.g. `'smkn1_sumedang'`).
  - Thus `isSuperAdmin()` is `false`. Deletion is denied.
- **Empirical Evidence**: Covered by `rules-tests/firestore-rules.test.ts:101-108` (`assertFails`).
- **Verdict**: **SECURE**.

---

### Vector 6: Direct mutation of company `filledQuota`
- **Rule Lines**: 96–101 (`firestore.rules`)
```javascript
allow update: if isSuperAdmin() || (
  isAdminRole() &&
  request.resource.data.diff(resource.data).affectedKeys()
    .hasOnly(['name', 'address', 'lat', 'lng', 'geofenceRadiusMeters', 'jurusanAllowed', 'quota', 'updatedAt'])
);
```
- **Analysis**:
  - The whitelist contains strictly 8 fields: `name`, `address`, `lat`, `lng`, `geofenceRadiusMeters`, `jurusanAllowed`, `quota`, `updatedAt`.
  - `'filledQuota'` is excluded. Any update containing `filledQuota` fails `hasOnly(...)`.
- **Empirical Evidence**: Covered by `rules-tests/firestore-rules.test.ts:145-156` (`assertFails`).
- **Verdict**: **SECURE**.

---

### Vector 7: Mentor reviewing logbooks of another company
- **Rule Lines**: 221–226 (`firestore.rules`)
```javascript
allow update: if isSuperAdmin() || (
  isPembimbingInstansi(resource.data.companyId) &&
  request.resource.data.diff(resource.data).affectedKeys()
    .hasOnly(['reviewStatus', 'catatan', 'reviewedBy', 'reviewedAt', 'updatedAt'])
);
```
- **Analysis**:
  - `isPembimbingInstansi(resource.data.companyId)` checks `getCompanyId() == resource.data.companyId`.
  - If a mentor from Company B attempts to update a logbook belonging to Company A, the condition evaluates to `false`.
- **Empirical Evidence**: Covered by `rules-tests/firestore-rules.test.ts:359-371` (`assertFails`).
- **Verdict**: **SECURE**.

---

## 3. Additional Severe Findings

### Finding A: Unrestricted Attendances Field Modification on Update
- In lines 193–198, unlike `companies`, `logbooks`, and `assessments`, `attendances` has NO field whitelist on update.
- A student can modify:
  - `status`: Change an auto-generated `'alpha'` or `'pending'` to `'hadir'`.
  - `checkIn`: Overwrite fake coordinates, distance, and timestamps.
  - `companyId`: Move attendance record to another company.
- **Recommendation**: Replace blacklist with a strict whitelist:
```javascript
request.resource.data.diff(resource.data).affectedKeys().hasOnly(['notes', 'checkOut', 'updatedAt'])
```

### Finding B: Privilege Escalation via `users/{userId}` Self-Update
- Lines 132–136 (`firestore.rules`):
```javascript
allow update: if isAuthenticated() && (
  request.auth.uid == userId ||
  isSuperAdmin() ||
  isAdminSekolah(resource.data.schoolId)
);
```
- A user can update their own user profile document without any key restrictions.
- In `functions/src/callable/completeRegistration.ts`, custom claims (`setCustomUserClaims`) are never set.
- Consequently, `getRole()` (lines 21–25) and `getSchoolId()` (lines 27–31) fall back to `getUserDoc().role` and `getUserDoc().schoolId`.
- An authenticated student can execute:
```javascript
await db.doc(`users/${uid}`).update({
  role: 'admin',
  schoolId: null
});
```
- Immediately, `isSuperAdmin()` evaluates to `true` for all subsequent operations, granting platform-wide Super Admin privileges!
- **Recommendation**: Disallow client-side modification of critical identity fields:
```javascript
(
  request.auth.uid == userId &&
  !request.resource.data.diff(resource.data).affectedKeys().hasAny(['role', 'schoolId', 'companyId', 'isRegistered', 'isActive'])
)
```
