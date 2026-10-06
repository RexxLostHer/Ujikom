# BRIEFING — 2026-10-06T01:23:30Z

## Mission
Design surgical fixes for firestore.rules to remediate all security rules vulnerabilities identified in Milestone M1 (Iteration 2).

## 🔒 My Identity
- Archetype: specification_miner
- Roles: Specification Miner, Rules Security Architect
- Working directory: C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\.agents\teamwork\m1_r2_explorer_rules
- Original parent: e93d1db5-4dd6-49bd-a8fc-9864437f62e2
- Milestone: M1_R2

## 🔒 Key Constraints
- Read-only on production source code: do not implement directly, design surgical fixes and document them.
- Output high-signal, production-grade recommendations adhering to zero-trust Firestore security rules v2.
- Write findings to handoff.md following 5-component report protocol.
- Communicate completion to parent via send_message.

## Current Parent
- Conversation ID: e93d1db5-4dd6-49bd-a8fc-9864437f62e2
- Updated: 2026-10-06T01:23:30Z

## Task Summary
- **What to build**: Concrete specification and exact diff recommendations for `firestore.rules` addressing:
  1. `users/{userId}`: Block self-escalation of `role`, `schoolId`, `companyId`, `isRegistered`, `isActive`. Restrict client update to safe profile fields (`name`, `phone`, `fcmToken`, `photoUrl`, `updatedAt`).
  2. `attendances` `create`: Require student auth match, tenancy `schoolId == getSchoolId()`, logbookSubmitted either false or absent, and ban `checkOut`.
  3. `attendances` `update`: Positive field whitelist for students (`notes`, `checkOut`, `updatedAt`) preserving checkout invariant condition.
  4. Secondary collections (`academicYears`, `majors`, `mentorships`, `visits`, `jobVacancies`, `roster`): Decouple create/update/delete. Use `resource.data` on delete and update, avoiding `request.resource.data` runtime null errors on delete and tenancy spoofing on update.
- **Success criteria**: Exhaustive AST specification, exact code blocks, edge-case probing, and corresponding unit test specifications for `rules-tests/firestore-rules.test.ts`.
- **Interface contracts**: `firestore.rules` rules_version = '2'.

## Key Decisions Made
- Fully probed all 14 collections in firestore.rules for `delete` runtime errors and unconstrained updates.
- Designed positive field whitelist for users self-profile update (`['name', 'displayName', 'phone', 'fcmToken', 'photoUrl', 'updatedAt']`) and attendance student update (`['notes', 'checkOut', 'updatedAt']`).
- Removed direct client creation from `users/{userId}` to prevent privilege escalation on initial signup; registration delegated to Admin SDK.
- Decoupled `create`, `update`, and `delete` across `academicYears`, `majors`, `mentorships`, `visits`, `jobVacancies`, and `roster` to use `resource.data` on delete and enforce tenancy locks on update.

## Artifact Index
- `C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\.agents\teamwork\m1_r2_explorer_rules\handoff.md` — Complete 5-component handoff report with exact code replacements and test suite additions.
- `C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\.agents\teamwork\m1_r2_explorer_rules\progress.md` — Progress execution log.

