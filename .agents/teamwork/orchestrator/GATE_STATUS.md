# Gate Status: Milestone M1 (Backend Foundation, Storage Mock & Seeds)

## Gate — Iteration 1
| Agent | Role | Verdict | Source |
|---|---|---|---|
| m1_worker | teamwork_preview_worker | DONE (Initial implementation delivered) | handoff.md |
| m1_reviewer_1 | teamwork_preview_reviewer | REQUEST_CHANGES | handoff.md |
| m1_reviewer_2 | teamwork_preview_reviewer | REQUEST_CHANGES | handoff.md |
| m1_challenger_1 | teamwork_preview_challenger | REQUEST_CHANGES | handoff.md |
| m1_challenger_2 | teamwork_preview_challenger | REQUEST_CHANGES | handoff.md |
| m1_auditor | teamwork_preview_auditor | CLEAN | handoff.md |

Gate Result: **FAIL** (Security rules bypass vectors, Cloud Functions edge cases, and unit test handler imports)

### Required Remediation Items for Iteration 2:
1. **`firestore.rules` Security Patches**:
   - `users/{userId}`: Block self-escalation of `role` and `schoolId` (must not allow changing role or clearing schoolId to become Super Admin).
   - `attendances` `create`: Enforce `schoolId == getSchoolId()`, `request.resource.data.logbookSubmitted == false`, and `!('checkOut' in request.resource.data)`.
   - `attendances` `update`: Add positive field whitelist to prevent students from tampering with `status`, `schoolId`, or server verification stamps.
   - Deletion rules in `academicYears`, `majors`, `mentorships`, `visits`, `jobVacancies`, `roster`: Fix `delete` rule to inspect `resource.data.schoolId` instead of `request.resource.data.schoolId` (preventing null pointer crashes during document deletion).
2. **Cloud Functions Robustness**:
   - `verifyAttendance.ts`: Enforce student must be placed at the target company (`userData.companyId == companyId`). Fix error message rounding for distances in (50, 50.5]m.
   - `verifyCheckout.ts`: Ensure check-out company matches attendance document `companyId`.
   - Dynamic QR: Add explicit check that `expiresAt` is a valid timestamp / number, rejecting missing/NaN timestamps.
   - `onApplicationDecided.ts`: Guard against duplicate processing / ensure idempotency.
   - `markAbsentees.ts`: Batch chunking for >500 documents.
3. **Seed Data Corrections**:
   - `seed/seed.js`: Ensure seeded attendance document includes `uid` so client rules permit reading.
4. **Unit Test Handler Imports**:
   - In `functions/test/`: Import actual functions or shared core logic modules from `src/` directly rather than relying solely on local mocked replicas.
