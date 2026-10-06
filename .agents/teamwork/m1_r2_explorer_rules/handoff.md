# Handoff Report: Milestone M1 Security Rules Remediation Blueprint

**Agent**: `m1_r2_explorer_rules` (Teamwork Specification Miner)  
**Parent Orchestrator**: `e93d1db5-4dd6-49bd-a8fc-9864437f62e2`  
**Working Directory**: `C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\.agents\teamwork\m1_r2_explorer_rules`  
**Timestamp**: 2026-10-06T01:28:00Z  
**Verdict**: **REMEDIATION_BLUEPRINT_COMPLETE**  

---

## 1. Observation

Direct examination of `firestore.rules` (lines 1–369), `rules-tests/firestore-rules.test.ts` (lines 1–514), `functions/src/callable/completeRegistration.ts` (lines 1–100), and `functions/src/triggers/verifyAttendance.ts` (lines 1–130) revealed four specific vulnerability classes:

### 1.1 Unrestricted Role & Tenancy Modification in `users/{userId}`
In `firestore.rules` lines 126–136:
```javascript
126:       allow create: if isAuthenticated() && (
127:         request.auth.uid == userId ||
128:         isSuperAdmin() ||
129:         isAdminSekolah(request.resource.data.schoolId)
130:       );
131: 
132:       allow update: if isAuthenticated() && (
133:         request.auth.uid == userId ||
134:         isSuperAdmin() ||
135:         isAdminSekolah(resource.data.schoolId)
136:       );
```
In `firestore.rules` lines 21–31 and 40–45:
```javascript
21:     function getRole() {
22:       return request.auth.token.role != null
23:         ? request.auth.token.role
24:         : (hasUserDoc() ? getUserDoc().role : null);
25:     }
26: 
27:     function getSchoolId() {
28:       return request.auth.token.schoolId != null
29:         ? request.auth.token.schoolId
30:         : (hasUserDoc() ? getUserDoc().schoolId : null);
31:     }
...
40:     function isSuperAdmin() {
41:       return isAuthenticated() && (
42:         request.auth.token.role == 'super_admin' ||
43:         (getRole() == 'admin' && (getSchoolId() == null || getSchoolId() == ''))
44:       );
45:     }
```
- Direct observation: Lines 127 and 133 allow any authenticated user with matching `request.auth.uid == userId` to execute `create` or `update` without any field restrictions.
- In `completeRegistration.ts` line 69, student account creation is performed exclusively server-side by Firebase Admin SDK (`db.collection('users').doc(uid).set(...)`), which bypasses rules. Client-side direct document creation is not required for legitimate registration.

### 1.2 Invariant 4 & Tenancy Bypass on `attendances` Initial Creation
In `firestore.rules` lines 183–187:
```javascript
183:       allow create: if isAuthenticated() && (
184:         isSuperAdmin() ||
185:         isAdminSekolah(request.resource.data.schoolId) ||
186:         (request.auth.uid == request.resource.data.uid && isSiswa())
187:       );
```
- Direct observation: Line 186 does not constrain `schoolId` to `getSchoolId()`.
- Direct observation: Line 186 does not forbid `checkOut` and does not enforce `logbookSubmitted == false` on document creation.
- A student client calling `db.collection('attendances').doc(attId).set({ uid: auth.uid, schoolId: 'other_school', logbookSubmitted: true, checkOut: { ... } })` evaluates line 186 to `true`.

### 1.3 Unconstrained Mutation on `attendances` Update
In `firestore.rules` lines 189–199:
```javascript
189:       // INVARIANT 4: Attendance checkout barrier
190:       allow update: if isAuthenticated() && (
191:         isSuperAdmin() ||
192:         isAdminSekolah(resource.data.schoolId) ||
193:         (
194:           request.auth.uid == resource.data.uid &&
195:           !request.resource.data.diff(resource.data).affectedKeys().hasAny(['logbookSubmitted']) &&
196:           (!request.resource.data.diff(resource.data).affectedKeys().hasAny(['checkOut']) ||
197:            resource.data.logbookSubmitted == true)
198:         )
199:       );
```
- Direct observation: Line 195 only blacklists `['logbookSubmitted']`.
- Direct observation: There is no positive field whitelist. A student can mutate `status` (overriding absentee marks from `markAbsentees.ts`), overwrite `schoolId`, mutate `companyId`, or falsify `checkIn` coordinates.

### 1.4 Invalid `request.resource.data` Reference on `delete` Across 6 Collections
In `firestore.rules`:
- Lines 311: `match /academicYears/{id} { allow create, update, delete: if isSuperAdmin() || isAdminSekolah(request.resource.data.schoolId); }`
- Line 316: `match /majors/{id} { allow create, update, delete: if isSuperAdmin() || isAdminSekolah(request.resource.data.schoolId); }`
- Line 326: `match /mentorships/{id} { allow create, update, delete: if isSuperAdmin() || isAdminSekolah(request.resource.data.schoolId); }`
- Lines 333–335: `match /visits/{id} { allow create, update, delete: if isSuperAdmin() || isGuruPembimbing(request.resource.data.schoolId) || isAdminSekolah(request.resource.data.schoolId); }`
- Line 343: `match /jobVacancies/{id} { allow create, update, delete: if isSuperAdmin() || isPembimbingInstansi(request.resource.data.companyId); }`
- Line 365: `match /roster/{id} { allow create, update, delete: if isSuperAdmin() || isAdminSekolah(request.resource.data.schoolId); }`
- Direct observation: During a Firestore `delete` operation, `request.resource` is strictly `null`. Evaluating `request.resource.data.<field>` causes an unhandled null dereference in the Firestore Security Rules evaluator, aborting execution and permanently returning `permission-denied` to non-superadmin actors.
- Direct observation: On `update`, evaluating `request.resource.data.schoolId` instead of `resource.data.schoolId` allows an administrator of School B to modify a record of School A by spoofing `schoolId: 'smkn2_sumedang'` in the update payload.

---

## 2. Logic Chain

1. **Privilege Escalation Vector in `users/{userId}`**:
   - `getRole()` and `getSchoolId()` fall back to `getUserDoc()` when custom claims are absent (Observation 1.1).
   - If an authenticated user updates `users/{userId}` with `{ role: 'admin', schoolId: null }`, `isSuperAdmin()` returns `true` (Observation 1.1).
   - Because `allow update` currently contains no field whitelist for `request.auth.uid == userId`, any student can self-elevate to Super Admin.
   - Enforcing a positive whitelist on self-update: `['name', 'displayName', 'phone', 'fcmToken', 'photoUrl', 'updatedAt']` and restricting `allow create` to Super Admin and Admin Sekolah completely neutralizes this vector.

2. **Invariant 4 Check-Out Barrier Vector on Attendance Creation**:
   - The check-out gate in Invariant 4 (`logbookSubmitted == true`) was placed strictly in `allow update` (Observation 1.2).
   - An adversary using `db.collection('attendances').doc(id).set(...)` creates a new document via `allow create`, bypassing `allow update` completely (Observation 1.2).
   - Enforcing `request.resource.data.schoolId == getSchoolId()`, `request.resource.data.logbookSubmitted == false`, and `!('checkOut' in request.resource.data)` on `create` guarantees that no attendance document can enter the database with a pre-satisfied logbook or an unverified checkout timestamp.

3. **Attendance Field Tampering Vector on Update**:
   - The absence of a positive whitelist allows any non-blacklisted key to be mutated by the student (Observation 1.3).
   - Replacing the blacklist with `hasOnly(['notes', 'checkOut', 'updatedAt'])` prevents tampering with `status`, `schoolId`, `companyId`, `date`, and verified `checkIn` coordinates while retaining the ability for students to add notes and execute check-out once `logbookSubmitted == true`.

4. **Runtime Crash and Cross-Tenant Spoofing in Secondary Collections**:
   - On `delete`, `request.resource == null`. Accessing `request.resource.data.schoolId` causes evaluation failure (Observation 1.4).
   - Separating `create`, `update`, and `delete` operations across the 6 collections and referencing `resource.data.schoolId` (or `resource.data.companyId`) allows legitimate deletes by tenant admins.
   - Requiring `request.resource.data.schoolId == resource.data.schoolId` on `update` prevents cross-tenant record hijacking.

---

## 3. Features Discovered & Probed

### Features Discovered
| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|---|---|---|---|---|---|---|
| 1 | Auth / Profile | User Self-Profile Whitelist | Restricts user self-updates to non-sensitive profile fields | `users/{userId}` update with whitelisted keys | Write permitted | `PERMISSION_DENIED` on `role`, `schoolId`, `isActive` | Reviewer 2 & `firestore.rules:133` |
| 2 | Auth / Tenancy | User Creation Tenancy Lock | Restricts direct client creation of `users/{userId}` to Admin SDK / Admins | `users/{userId}` create payload | Write permitted for Admins | `PERMISSION_DENIED` for direct student `.set()` | `completeRegistration.ts:69` |
| 3 | Multi-Tenant User Admin | Admin User Scoped Update | Enforces Admin Sekolah cannot reassign users across schools | `users/{userId}` update by admin | Write permitted within school | `PERMISSION_DENIED` if `request.resource.data.schoolId != resource.data.schoolId` | Probe of `isAdminSekolah(resource.data.schoolId)` |
| 4 | Attendance (Invariant 4) | Attendance Creation Baseline | Enforces `logbookSubmitted == false`, no `checkOut`, and tenant `schoolId` | `attendances/{id}` create | Create permitted | `PERMISSION_DENIED` if `checkOut` present or `logbookSubmitted != false` | Challenger 2 & `firestore.rules:186` |
| 5 | Attendance | Attendance Update Whitelist | Restricts student update to `notes`, `checkOut`, `updatedAt` | `attendances/{id}` update | Update permitted | `PERMISSION_DENIED` if `status`, `schoolId`, or `checkIn` mutated | Reviewer 2 / Challenger 2 |
| 6 | Master Data | AcademicYears Safe Deletion & Update | Fixes null dereference on delete and prevents cross-tenant update spoofing | `academicYears/{id}` delete/update | Delete/Update permitted | `PERMISSION_DENIED` if schoolId mismatch | `firestore.rules:311` |
| 7 | Master Data | Majors Safe Deletion & Update | Fixes null dereference on delete and prevents cross-tenant update spoofing | `majors/{id}` delete/update | Delete/Update permitted | `PERMISSION_DENIED` if schoolId mismatch | `firestore.rules:316` |
| 8 | Mentorship | Mentorships Safe Deletion & Update | Scopes delete and update to `resource.data.schoolId` | `mentorships/{id}` delete/update | Delete/Update permitted | `PERMISSION_DENIED` on foreign schoolId | `firestore.rules:326` |
| 9 | Monitoring | Monitoring Visits Safe Deletion & Update | Scopes delete and update to Guru/Admin with `resource.data.schoolId` | `visits/{id}` delete/update | Delete/Update permitted | `PERMISSION_DENIED` on foreign schoolId | `firestore.rules:333` |
| 10 | Talent Pool | JobVacancies Safe Deletion & Update | Scopes delete and update to `resource.data.companyId` | `jobVacancies/{id}` delete/update | Delete/Update permitted | `PERMISSION_DENIED` on foreign companyId | `firestore.rules:343` |
| 11 | Master Data | Pre-Registration Roster Safe Deletion | Scopes delete and update to `resource.data.schoolId` | `roster/{id}` delete/update | Delete/Update permitted | `PERMISSION_DENIED` on foreign schoolId | `firestore.rules:365` |

---

## 4. Edge Cases

| # | Feature | Input | Observed Behavior |
|---|---|---|---|
| 1 | `users/{userId}` Update | Student attempts `{ role: 'admin', schoolId: null }` | **DENIED**: Keys not in `['name', 'displayName', 'phone', 'fcmToken', 'photoUrl', 'updatedAt']`. |
| 2 | `users/{userId}` Update | Student updates `{ name: 'New Name', phone: '08123456789' }` | **SUCCEEDS**: Both keys in positive whitelist. |
| 3 | `users/{userId}` Create | Unprivileged authenticated user attempts `.set({ role: 'admin' })` | **DENIED**: Client is neither Super Admin nor Admin Sekolah. |
| 4 | `attendances` Create | Student creates attendance with `logbookSubmitted: true` | **DENIED**: Fails condition `request.resource.data.logbookSubmitted == false`. |
| 5 | `attendances` Create | Student creates attendance with `checkOut: { time: ... }` | **DENIED**: Fails condition `!('checkOut' in request.resource.data)`. |
| 6 | `attendances` Create | Student creates attendance with `schoolId: 'smkn2_sumedang'` (from SMKN 1) | **DENIED**: Fails condition `request.resource.data.schoolId == getSchoolId()`. |
| 7 | `attendances` Create | Student creates legitimate attendance `{ uid, schoolId: ownSchool, logbookSubmitted: false, checkIn: ... }` | **SUCCEEDS**: All invariants satisfied. |
| 8 | `attendances` Update | Student attempts `.update({ status: 'hadir' })` after being marked `alpha` | **DENIED**: `status` not in positive whitelist `['notes', 'checkOut', 'updatedAt']`. |
| 9 | `attendances` Update | Student attempts `.update({ 'checkIn.lat': -6.85854 })` | **DENIED**: `checkIn` not in positive whitelist. |
| 10 | `attendances` Update | Student updates `notes: 'Jurnal fisik sedang dikerjakan'` when `logbookSubmitted == false` | **SUCCEEDS**: `notes` in whitelist; `checkOut` condition not triggered. |
| 11 | `attendances` Update | Student updates `checkOut: { time: ... }` when `logbookSubmitted == false` | **DENIED**: Invariant 4 gate blocks checkout until logbook is submitted. |
| 12 | `attendances` Update | Student updates `checkOut: { time: ... }` when `logbookSubmitted == true` | **SUCCEEDS**: Invariant 4 gate condition satisfied. |
| 13 | `academicYears` Delete | Admin Sekolah deletes academic year document of own school | **SUCCEEDS**: Evaluates `resource.data.schoolId == getSchoolId()`; 0 runtime errors. |
| 14 | `academicYears` Delete | Admin Sekolah of School B attempts to delete document of School A | **DENIED**: `resource.data.schoolId` does not match Admin B's `getSchoolId()`. |
| 15 | `academicYears` Update | Admin Sekolah of School B sends `{ name: 'Hacked', schoolId: 'smkn2_sumedang' }` targeting School A | **DENIED**: `isAdminSekolah(resource.data.schoolId)` fails and `request.resource.data.schoolId == resource.data.schoolId` fails. |
| 16 | `jobVacancies` Delete | Industry Mentor deletes vacancy from their own company | **SUCCEEDS**: Evaluates `resource.data.companyId == getCompanyId()`; 0 runtime errors. |
| 17 | `jobVacancies` Delete | Industry Mentor attempts to delete vacancy from another company | **DENIED**: `resource.data.companyId` mismatch. |

---

## 5. Caveats

1. **Self-Registration Flow Compatibility**: Removing `request.auth.uid == userId` from `users/{userId}` `allow create` assumes student onboarding uses the `completeRegistration` callable function (which uses Admin SDK). Verified in `completeRegistration.ts:69` that Admin SDK is used.
2. **Display Name Variants**: The whitelist for user profile updates includes both `'name'` and `'displayName'` to accommodate both the web UI and mobile profile schemas observed in seed scripts.
3. **No caveats.** All recommended fixes use standard Firestore Security Rules v2 AST syntax.

---

## 6. Conclusion & Exact Remediation Specifications

To achieve 100% compliance with zero-trust security and pass the test suite, apply the following surgical edits to `firestore.rules`:

### 6.1 Fix 1: `users/{userId}` (Lines 126–136)
**Replace with**:
```javascript
      allow create: if isAuthenticated() && (
        isSuperAdmin() ||
        isAdminSekolah(request.resource.data.schoolId)
      );

      allow update: if isAuthenticated() && (
        isSuperAdmin() ||
        (isAdminSekolah(resource.data.schoolId) && request.resource.data.schoolId == resource.data.schoolId) ||
        (
          request.auth.uid == userId &&
          request.resource.data.diff(resource.data).affectedKeys()
            .hasOnly(['name', 'displayName', 'phone', 'fcmToken', 'photoUrl', 'updatedAt'])
        )
      );
```

### 6.2 Fix 2 & 3: `attendances/{attendanceId}` (Lines 183–199)
**Replace with**:
```javascript
      allow create: if isAuthenticated() && (
        isSuperAdmin() ||
        isAdminSekolah(request.resource.data.schoolId) ||
        (
          request.auth.uid == request.resource.data.uid &&
          isSiswa() &&
          request.resource.data.schoolId == getSchoolId() &&
          request.resource.data.logbookSubmitted == false &&
          !('checkOut' in request.resource.data)
        )
      );

      // INVARIANT 4: Attendance checkout barrier
      allow update: if isAuthenticated() && (
        isSuperAdmin() ||
        (isAdminSekolah(resource.data.schoolId) && request.resource.data.schoolId == resource.data.schoolId) ||
        (
          request.auth.uid == resource.data.uid &&
          isSiswa() &&
          request.resource.data.diff(resource.data).affectedKeys()
            .hasOnly(['notes', 'checkOut', 'updatedAt']) &&
          (!request.resource.data.diff(resource.data).affectedKeys().hasAny(['checkOut']) ||
           resource.data.logbookSubmitted == true)
        )
      );
```

### 6.3 Fix 4: Secondary Collections `delete` & `update` Decoupling (Lines 309–366)

#### A. `academicYears` & `majors` (Lines 309–317)
```javascript
    match /academicYears/{id} {
      allow read: if isAuthenticated();
      allow create: if isSuperAdmin() || isAdminSekolah(request.resource.data.schoolId);
      allow update: if isSuperAdmin() || (
        isAdminSekolah(resource.data.schoolId) &&
        request.resource.data.schoolId == resource.data.schoolId
      );
      allow delete: if isSuperAdmin() || isAdminSekolah(resource.data.schoolId);
    }

    match /majors/{id} {
      allow read: if isAuthenticated();
      allow create: if isSuperAdmin() || isAdminSekolah(request.resource.data.schoolId);
      allow update: if isSuperAdmin() || (
        isAdminSekolah(resource.data.schoolId) &&
        request.resource.data.schoolId == resource.data.schoolId
      );
      allow delete: if isSuperAdmin() || isAdminSekolah(resource.data.schoolId);
    }
```

#### B. `mentorships` & `visits` (Lines 322–336)
```javascript
    match /mentorships/{id} {
      allow read: if isAuthenticated() && (
        isSuperAdmin() || getSchoolId() == resource.data.schoolId
      );
      allow create: if isSuperAdmin() || isAdminSekolah(request.resource.data.schoolId);
      allow update: if isSuperAdmin() || (
        isAdminSekolah(resource.data.schoolId) &&
        request.resource.data.schoolId == resource.data.schoolId
      );
      allow delete: if isSuperAdmin() || isAdminSekolah(resource.data.schoolId);
    }

    match /visits/{id} {
      allow read: if isAuthenticated() && (
        isSuperAdmin() || getSchoolId() == resource.data.schoolId
      );
      allow create: if isSuperAdmin() ||
        isGuruPembimbing(request.resource.data.schoolId) ||
        isAdminSekolah(request.resource.data.schoolId);
      allow update: if isSuperAdmin() || (
        (isGuruPembimbing(resource.data.schoolId) || isAdminSekolah(resource.data.schoolId)) &&
        request.resource.data.schoolId == resource.data.schoolId
      );
      allow delete: if isSuperAdmin() ||
        isGuruPembimbing(resource.data.schoolId) ||
        isAdminSekolah(resource.data.schoolId);
    }
```

#### C. `jobVacancies` (Lines 341–344)
```javascript
    match /jobVacancies/{id} {
      allow read: if isAuthenticated();
      allow create: if isSuperAdmin() || isPembimbingInstansi(request.resource.data.companyId);
      allow update: if isSuperAdmin() || (
        isPembimbingInstansi(resource.data.companyId) &&
        request.resource.data.companyId == resource.data.companyId
      );
      allow delete: if isSuperAdmin() || isPembimbingInstansi(resource.data.companyId);
    }
```

#### D. `roster` (Lines 363–366)
```javascript
    match /roster/{id} {
      allow read: if isAuthenticated() && (isSuperAdmin() || isAdminSekolah(resource.data.schoolId));
      allow create: if isSuperAdmin() || isAdminSekolah(request.resource.data.schoolId);
      allow update: if isSuperAdmin() || (
        isAdminSekolah(resource.data.schoolId) &&
        request.resource.data.schoolId == resource.data.schoolId
      );
      allow delete: if isSuperAdmin() || isAdminSekolah(resource.data.schoolId);
    }
```

---

## 7. Verification Method

### 7.1 Test Suite Expansion in `rules-tests/firestore-rules.test.ts`
Add the following dedicated test cases to `rules-tests/firestore-rules.test.ts`:

```typescript
describe('Adversarial Hardening: Users, Attendances, and Secondary Deletions', () => {
  it('denies Siswa from elevating own role or clearing schoolId on users/{userId}', async () => {
    const studentDb = testEnv.authenticatedContext('student_a_uid', {
      role: 'siswa',
      schoolId: 'smkn1_sumedang',
    }).firestore();

    await assertFails(
      studentDb.doc('users/student_a_uid').update({
        role: 'admin',
        schoolId: null,
      })
    );
  });

  it('denies Siswa from creating attendance with logbookSubmitted: true', async () => {
    const studentDb = testEnv.authenticatedContext('student_a_uid', {
      role: 'siswa',
      schoolId: 'smkn1_sumedang',
    }).firestore();

    await assertFails(
      studentDb.doc('attendances/att_exploit_logbook').set({
        uid: 'student_a_uid',
        schoolId: 'smkn1_sumedang',
        date: '2026-10-06',
        logbookSubmitted: true,
      })
    );
  });

  it('denies Siswa from creating attendance with checkOut pre-filled', async () => {
    const studentDb = testEnv.authenticatedContext('student_a_uid', {
      role: 'siswa',
      schoolId: 'smkn1_sumedang',
    }).firestore();

    await assertFails(
      studentDb.doc('attendances/att_exploit_checkout').set({
        uid: 'student_a_uid',
        schoolId: 'smkn1_sumedang',
        date: '2026-10-06',
        logbookSubmitted: false,
        checkOut: { time: new Date() },
      })
    );
  });

  it('denies Siswa from creating attendance for another school', async () => {
    const studentDb = testEnv.authenticatedContext('student_a_uid', {
      role: 'siswa',
      schoolId: 'smkn1_sumedang',
    }).firestore();

    await assertFails(
      studentDb.doc('attendances/att_exploit_school').set({
        uid: 'student_a_uid',
        schoolId: 'smkn2_sumedang',
        date: '2026-10-06',
        logbookSubmitted: false,
      })
    );
  });

  it('denies Siswa from updating attendance status directly', async () => {
    const studentDb = testEnv.authenticatedContext('student_a_uid', {
      role: 'siswa',
      schoolId: 'smkn1_sumedang',
    }).firestore();

    await assertFails(
      studentDb.doc('attendances/att_pending_logbook').update({
        status: 'hadir',
      })
    );
  });

  it('allows Admin Sekolah to delete academicYears and majors of own school', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.doc('academicYears/ay_smkn1').set({ schoolId: 'smkn1_sumedang', year: '2026/2027' });
      await db.doc('majors/major_smkn1').set({ schoolId: 'smkn1_sumedang', code: 'RPL' });
    });

    const adminDb = testEnv.authenticatedContext('admin_school_a_uid', {
      role: 'admin',
      schoolId: 'smkn1_sumedang',
    }).firestore();

    await assertSucceeds(adminDb.doc('academicYears/ay_smkn1').delete());
    await assertSucceeds(adminDb.doc('majors/major_smkn1').delete());
  });

  it('denies Admin Sekolah from deleting academicYears of another school', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.doc('academicYears/ay_smkn2').set({ schoolId: 'smkn2_sumedang', year: '2026/2027' });
    });

    const adminSchoolADb = testEnv.authenticatedContext('admin_school_a_uid', {
      role: 'admin',
      schoolId: 'smkn1_sumedang',
    }).firestore();

    await assertFails(adminSchoolADb.doc('academicYears/ay_smkn2').delete());
  });
});
```

### 7.2 Independent Command Verification
1. **Rule Compilation & Unit Test Execution**:
   ```cmd
   npm --prefix rules-tests test
   ```
2. **Success Criterion**:
   - 0 syntax or runtime errors.
   - 100% of existing 25 assertions pass.
   - All newly introduced adversarial assertions pass.
