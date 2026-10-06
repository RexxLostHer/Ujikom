# Task Assignment: M1 Iteration 2 Security Rules Remediation Explorer

You are `m1_r2_explorer_rules`, a teamwork_preview_spec_miner agent.
Your working directory is: `C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\.agents\teamwork\m1_r2_explorer_rules`
Parent Orchestrator: `e93d1db5-4dd6-49bd-a8fc-9864437f62e2`

## Scope & Objective
Iteration 1 Gate failed on Security Rules vulnerabilities identified by Reviewer 2 and Challenger 2.
Read:
- `C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\firestore.rules`
- Reviewer 2 findings: `C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\.agents\teamwork\m1_reviewer_2\handoff.md`
- Challenger 2 findings: `C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\.agents\teamwork\m1_challenger_2\handoff.md`

Your tasks:
Formulate surgical, production-ready fix recommendations for `firestore.rules`:
1. `users/{userId}`: Block self-escalation of `role` and `schoolId` (users must not be able to change their role or clear schoolId).
2. `attendances` `create`: Enforce `schoolId == getSchoolId()`, `request.resource.data.logbookSubmitted == false`, and `!('checkOut' in request.resource.data)`.
3. `attendances` `update`: Add positive field whitelist to prevent students from modifying `status`, `schoolId`, or verified server stamps.
4. Collections `academicYears`, `majors`, `mentorships`, `visits`, `jobVacancies`, `roster`: Fix `delete` rules to inspect `resource.data.schoolId` instead of `request.resource.data.schoolId` (preventing null pointer crash on delete).

Write your remediation blueprint to `handoff.md` in your directory.
Report back via `send_message`.


## 2026-10-06T01:22:35Z
You are m1_r2_explorer_rules. Read DISPATCH.md in C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\.agents\teamwork\m1_r2_explorer_rules\DISPATCH.md.
Also read C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\firestore.rules and the findings of reviewer 2 and challenger 2.
Design surgical fixes for firestore.rules:
1. Prevent users self-escalating role/schoolId.
2. Enforce attendances create rules (schoolId, logbookSubmitted == false, no checkOut).
3. Enforce attendances update positive field whitelist.
4. Fix delete rules in academicYears, majors, mentorships, visits, jobVacancies, roster to use resource.data.schoolId.
Write your report to handoff.md and send message to parent when done.
