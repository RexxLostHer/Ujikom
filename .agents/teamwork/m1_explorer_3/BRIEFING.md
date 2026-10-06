# BRIEFING — 2026-10-06T00:57:00Z

## Mission
Investigate and design exact implementation plan and specification for firestore.rules and rules-tests/ test suite verifying all 7 security invariants against Firestore emulator.

## 🔒 My Identity
- Archetype: teamwork_preview_spec_miner
- Roles: Specification Miner, Security Rules Specialist
- Working directory: C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\.agents\teamwork\m1_explorer_3
- Original parent: e93d1db5-4dd6-49bd-a8fc-9864437f62e2
- Milestone: M1 - Foundation & Security Rules

## 🔒 Key Constraints
- Multi-tenant school isolation (schoolId)
- Role-based permissions across all 17 entities for all 5 actors
- Company deletion permitted exclusively for Super Admin (role == 'admin' && schoolId == null)
- Company update restricted via affectedKeys().hasOnly(['name', 'address', 'lat', 'lng', 'geofenceRadiusMeters', 'jurusanAllowed', 'quota'])
- Application creation: studentId must match auth.uid, status must be 'menunggu'
- Attendance checkout gate: update containing checkOut is rejected unless resource.data.logbookSubmitted == true
- Logbook review: only Pembimbing Instansi belonging to the same companyId
- Final report review: only Admin Sekolah from same school, restricted to affectedKeys().hasOnly(['status', 'certificateUrl', 'reviewedBy', 'reviewedAt'])
- @firebase/rules-unit-testing test suite in rules-tests/ verifying all 7 security invariants against Firestore Emulator
- No implementation, read-only / plan-and-specification mining only; output findings to handoff.md and report to parent

## Current Parent
- Conversation ID: e93d1db5-4dd6-49bd-a8fc-9864437f62e2
- Updated: 2026-10-06T00:57:00Z

## Task Summary
- **What to build**: Specification and implementation plan for `firestore.rules` and `rules-tests/` test suite
- **Success criteria**: Exhaustive schema and rule analysis for all 17 collections and 5 roles; concrete rule logic adhering to all 7 security invariants; complete `@firebase/rules-unit-testing` configuration and test specification runnable against Firestore emulator.
- **Interface contracts**: PROJECT.md, ORIGINAL_REQUEST.md, survey_spec_miner/handoff.md
- **Code layout**: C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom

## Key Decisions Made
- Fully analyzed and synthesized all 17 Firestore collections across the 5 actors.
- Adopted hybrid token + doc fallback for authentication evaluation to ensure zero-cost claim evaluation in tests while supporting live client users.
- Formulated concrete, complete, drop-in ready `firestore.rules`.
- Formulated complete test suite using `@firebase/rules-unit-testing` in `rules-tests/firestore-rules.test.ts` covering positive and negative cases for all 7 invariants.
- Produced self-contained handoff report in `handoff.md`.

## Artifact Index
- `DISPATCH.md` — Task assignment and incoming messages
- `BRIEFING.md` — Identity, constraints, and current context
- `progress.md` — Liveness heartbeat and progress tracker
- `handoff.md` — Full specification and implementation blueprints for `firestore.rules` and `rules-tests/`
