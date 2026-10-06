# Original User Request

## 2026-10-06T00:31:33Z

Rebuild the existing `ujikom` project (currently a vanilla HTML/JS + Firebase Realtime Database RFID school-attendance web app) into **VokaLog** — a PKL (internship) attendance and hybrid-logbook system — so that it matches the PRD (UJIKOM project report, SMKN 1 Sumedang, 2026/2027) in every functional point. Purpose: UJIKOM final assessment deliverable that must run as a working demo.

Working directory: `C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom`
Integrity mode: development

Reference material: full PRD text at `C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\brain\e42361f2-42b6-4619-823e-980ca4511aed\scratch\prd.txt` (original .docx at `C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\brain\e42361f2-42b6-4619-823e-980ca4511aed\.user_uploaded\media_1791246464413.docx`). The PRD is the source of truth for actors, entities, function names, field names, and flows.

## Requirements

### R1. Replace the old app with VokaLog on the PRD's stack
Remove the old RFID/IoT app entirely (git history is the backup) and replace it with: a Flutter mobile app for Siswa, a Flutter Web portal for Super Admin / Admin Sekolah / Pembimbing Instansi / Guru Pembimbing, Firebase Cloud Functions (TypeScript), Firestore Security Rules, and Cloudflare R2 storage via presigned URLs (no R2 secrets on the client). Flutter 3.35.7 and Node 25 are installed; Firebase CLI is not installed yet.

### R2. Implement all 21 PRD BAB III flows
Five actors and the 17 Firestore entities from the class diagram/ERD (multi-tenant via `schoolId`, `companies` platform-level). Flows: NISN self-registration (`lookupNisn`, `completeRegistration`); company list/add/detail/edit (field-restricted)/delete (Super Admin only); dynamic QR refreshed every 60 s (one active token per company in `qrTokens`); student PKL application + admin approve/reject with quota (`onApplicationDecided`); check-in with QR + GPS geofencing (default 50 m, haversine, re-verified server-side in `verifyAttendance`); check-out only after the day's logbook (`onLogbookCreated` -> `logbookSubmitted`, `verifyCheckout`); hybrid logbook (title, category sesuai/tidak sesuai jurusan, photo of signed physical page uploaded via `getUploadUrl`); logbook review (`onLogbookReviewed`); SOS report + follow-up (`onSosStatusChanged`); two-stage final assessment + talent flag (`onAssessmentFinalized`, `talentThreshold`); final report PDF upload + validation + certificate; filtered export (date range, jurusan, company); realtime attendance monitoring for Guru Pembimbing; `markAbsentees`; notifications.

### R3. Runs locally without real cloud credentials
Everything must run against the Firebase Emulator Suite (Auth, Firestore, Functions) and a local S3-compatible mock standing in for R2. Real Firebase/R2 config goes into documented placeholders / `.env` so the user can switch to production later. Provide seed data (school, staff of each role, roster NISNs, companies) and a README in Indonesian explaining setup and demo accounts. Class roster stays limited to `XII RPL 1`, `XII RPL 2`, `XII TKJ 1`.

### R4. Professional UI/UX
Clean operational portal design (no marketing landing page bloat): consistent spacing scale, WCAG 4.5:1 contrast, visible focus, >=44 px touch targets, visible form labels with inline errors, SVG/Material icons (no emoji as icons), responsive without horizontal scroll on mobile widths, smooth 150-250 ms transitions, loading/empty/error states on every data view. Branding: VokaLog, SMKN 1 Sumedang (existing logos in `assets/` may be reused).

### R5. Git constraints
Never run `git push`. Local commits only, author `RexxLostHer <7dosabesar557@gmail.com>`.

## Acceptance Criteria

### Build & static checks
- [ ] `flutter analyze` reports 0 errors for the Flutter project(s); `flutter build web` succeeds; `flutter build apk --debug` succeeds or a documented, environment-only reason is given.
- [ ] Cloud Functions `npm run build` (tsc) succeeds with 0 errors and lint passes.
- [ ] No old RFID/IoT files remain (`iot/`, `presensi-live.*`, RTDB-based HTML/JS).

### Automated tests (must all pass, run against emulators)
- [ ] Functions unit tests: haversine/geofence (inside 50 m accepted, outside rejected), expired/replaced QR token rejected, `lookupNisn` (unknown / already-registered / valid), `completeRegistration` atomic move, `onApplicationDecided` quota increment + rejection when full, `onLogbookCreated` sets `logbookSubmitted`, `onAssessmentFinalized` talent flag, `getUploadUrl` returns a presigned URL usable against the R2 mock.
- [ ] Firestore Security Rules tests (`@firebase/rules-unit-testing`): company delete only Super Admin; company edit limited to `name, address, lat, lng, geofenceRadiusMeters, jurusanAllowed, quota`; application `studentId` must equal auth uid with initial status menunggu; checkOut denied unless `logbookSubmitted == true`; logbook review only by Pembimbing Instansi of same `companyId`; finalReports admin update limited to `status, certificateUrl, reviewedBy, reviewedAt`; cross-school reads denied.
- [ ] Flutter widget tests for at least registration, logbook form validation, and check-out button disabled until logbook submitted.

### End-to-end browser verification (independent agent, Flutter web + emulators)
- [ ] A browser agent walks through every one of the 21 flows with seeded accounts and records screenshots per flow; each flow reaches its expected end state (document visible in Emulator UI / UI reflects change without reload for realtime views).
- [ ] UI rubric checked per main screen by an independent reviewer: contrast, focus visibility, labels, touch target size, responsive at 390 px and 1440 px with no horizontal scroll, loading/empty/error states present. Any failure is fixed and re-checked.

### Documentation
- [ ] README (Indonesian) lets a fresh user install, start emulators + R2 mock, seed, and run both apps with listed demo accounts; a mapping table links every PRD section 3.4-3.21 to the implementing screen/function/test.
