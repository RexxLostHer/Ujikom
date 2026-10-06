# Scope: Milestone M1 — Backend Foundation, Storage Mock & Seeds

## Objective
Implement Milestone M1 as defined in `PROJECT.md`:
1. Clean up legacy IoT/RFID files per R1/Acceptance Criteria (35 legacy files, removing `iot/`, `presensi-live.*`, RTDB HTML/JS, legacy tests/scripts), retaining `assets/logo-nesas.png` and `assets/logo-rpl.png`.
2. Configure root `package.json` and `firebase.json` for Firebase Emulators (Auth on 9099, Firestore on 8080, Functions on 5001, UI on 4000).
3. Build local S3/R2 mock server in `mock-storage/server.js` running on port 9090 with presigned PUT upload and public GET retrieval with CORS support.
4. Build Firebase Functions TypeScript project in `functions/`:
   - Callables: `lookupNisn`, `completeRegistration`, `getUploadUrl`.
   - Triggers: `verifyAttendance`, `verifyCheckout`, `onLogbookCreated`, `onLogbookReviewed`, `onApplicationDecided`, `onAssessmentFinalized`, `onSosStatusChanged`, `markAbsentees`.
   - Helpers: `geo.ts` (50m Haversine), `notify.ts`, `r2.ts`, `admin.ts`.
5. Implement `firestore.rules` adhering to multi-tenant isolation, role checks, field-restricted company updates, and checkout gate (`logbookSubmitted == true`).
6. Build seed script in `seed/seed.js` using authentic SMKN 1 Sumedang data (roster strictly limited to `XII RPL 1`, `XII RPL 2`, `XII TKJ 1`).
7. Write and run automated unit tests:
   - Functions unit tests (Haversine/geofence, QR token expiration, lookupNisn, completeRegistration, onApplicationDecided quota, onLogbookCreated, onAssessmentFinalized, getUploadUrl).
   - Firestore Security Rules tests (`@firebase/rules-unit-testing`).
8. Ensure `npm run build` in `functions/` succeeds with 0 errors and all unit tests pass.

## Architecture & Interfaces
Follow Interface Contracts in `PROJECT.md`.
Code boundary: owns `mock-storage/`, `functions/`, `seed/`, `firestore.rules`, `firebase.json`, `package.json`, `rules-tests/`.
Does NOT touch `vokalog_app/`.
