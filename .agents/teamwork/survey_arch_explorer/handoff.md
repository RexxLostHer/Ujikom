# Architecture and Test Strategy Report — VokaLog System

**Author**: `survey_arch_explorer`  
**Date**: 2026-10-06T00:39:00Z  
**Target Project**: VokaLog (SMKN 1 Sumedang PKL Attendance & Hybrid Logbook System)  
**Parent Orchestrator**: `e93d1db5-4dd6-49bd-a8fc-9864437f62e2`

---

## 1. Observation

1. **Original Request (`ORIGINAL_REQUEST.md`)**:
   - Line 14–15: Replace legacy RFID app with VokaLog on the PRD stack: Flutter mobile app for Siswa, Flutter Web portal for Super Admin, Admin Sekolah, Pembimbing Instansi, Guru Pembimbing, Firebase Cloud Functions (TypeScript), Firestore Security Rules, and Cloudflare R2 storage via presigned URLs. Flutter 3.35.7 and Node 25 installed; Firebase CLI not installed yet.
   - Line 17–18: Implement all 21 PRD BAB III flows across five actors and 17 Firestore entities from class diagram/ERD.
   - Line 20–21: Local execution against Firebase Emulator Suite (Auth, Firestore, Functions) and local S3-compatible mock standing in for R2. Seed data for school, staff of each role, roster NISNs (`XII RPL 1`, `XII RPL 2`, `XII TKJ 1`), companies.
   - Line 23–24: Professional UI/UX: consistent spacing scale, WCAG 4.5:1 contrast, visible focus, >=44px touch targets, visible form labels with inline errors, SVG/Material icons (no emoji), responsive at 390px (mobile) and 1440px (desktop) without horizontal scroll, 150–250ms transitions.
   - Line 31–43: Acceptance Criteria:
     - `flutter analyze` 0 errors; `flutter build web` succeeds; `flutter build apk --debug` succeeds.
     - Functions `npm run build` succeeds with 0 errors.
     - Functions unit tests: haversine/geofence, expired/replaced QR token, `lookupNisn`, `completeRegistration`, `onApplicationDecided` quota increment, `onLogbookCreated`, `onAssessmentFinalized`, `getUploadUrl`.
     - Firestore Security Rules tests (`@firebase/rules-unit-testing`): company delete only Super Admin, company edit field whitelist, application studentId == auth uid with initial status menunggu, checkOut denied unless `logbookSubmitted == true`, logbook review only by Pembimbing Instansi of same company, finalReports admin update limited to status/certificateUrl/reviewedBy/reviewedAt, cross-school reads denied.
     - Flutter widget tests: registration, logbook form validation, checkout button disabled until logbook submitted.
     - E2E browser runner: walks through all 21 flows, records screenshots, verifies document state in emulators.

2. **PRD Specification (`prd.txt`)**:
   - Lines 46–48, 140–147: Dual verification presensi (Dynamic QR code refreshed every 60s + GPS geofencing max 50m haversine formula) and Hybrid Logbook (photo of physically signed logbook uploaded to R2 via presigned URL as prerequisite before check-out).
   - Lines 151–152 (Class Diagram): WebSupervisorPortal, WebAdminPortal, MobileApp, Callable Functions (`lookupNisn`, `completeRegistration`, `getUploadUrl`), Firestore Triggers (`verifyAttendance`, `verifyCheckout`, `onLogbookCreated`, `onLogbookReviewed`, `onApplicationDecided`, `onAssessmentFinalized`, `onSosStatusChanged`, `markAbsentees`), helper modules (`geo.ts`, `notify.ts`, `r2.ts`).
   - Lines 157–160 (ERD): Multi-tenant root `SchoolDoc` with `schoolId`, platform-level `CompanyDoc`, single `UserDoc` collection differentiated by `role`, and 17 core entities.
   - Lines 161–300: 21 detailed flows from 3.4 through 3.21.

3. **Current Workspace (`ujikom/`)**:
   - Root contains old HTML/JS files (`admin.html`, `dashboard.html`, `index.html`), `iot/` directory (`absensi_rpi.py`, `esp32_rfid_rc522.ino`), legacy tests (`tests/test-rfid-scan-flow.js`), and student roster data (`siswa-clean-firebase.json`, `assets/data-siswa.json`).
   - Assets folder contains valid school logos: `assets/logo-nesas.png` (SMKN 1 Sumedang) and `assets/logo-rpl.png`.

---

## 2. Logic Chain

### 2.1 Flutter Client Architecture: Single Multi-Platform App vs. Separate Projects
- **Reasoning**:
  1. *Observation 1 & 2* specify 5 actors sharing 17 identical Firestore data models, validation logic (NISN, GPS geofencing calculation), and Firebase Auth mechanisms.
  2. If split into separate projects (`vokalog_mobile` and `vokalog_web`), every data model, DTO, Firestore serialization mapper, and network service must either be duplicated or extracted into a third local package (`vokalog_shared`). This would require running `flutter analyze` across 3 distinct packages, triples maintenance cost, and complicates local testing.
  3. Acceptance criteria requires "`flutter analyze` reports 0 errors for the Flutter project(s); `flutter build web` succeeds; `flutter build apk --debug` succeeds".
  4. Flutter's `go_router` combined with an `AdaptiveScaffold` / `ResponsiveLayout` cleanly handles viewport switches between mobile (390px) and desktop web (1440px) from a single codebase:
     - On mobile widths (<768px): Renders bottom navigation bar, single-column full-width cards, touch-optimized dialogs.
     - On desktop widths (>=768px): Renders persistent navigation rail / sidebar, multi-column dashboard grid, data tables.
  5. Furthermore, Super Admin and Guru Pembimbing can access their portals on tablet/mobile browsers responsively, and students can view their attendance dashboard on desktop web without needing separate apps.
- **Deduction**: A **single multi-platform Flutter project** (`vokalog_app`) is the superior, highly maintainable architecture that fulfills both mobile APK and Web build criteria with 0 duplicate code.

### 2.2 UI/UX System & Accessibility Design
- **Color Palette & Contrast (WCAG 2.1 AA >= 4.5:1)**:
  - Primary Brand: `Color(0xFF1E3A8A)` (Vocational Navy Blue). Contrast against white `#FFFFFF` is 9.5:1 (passes AAA).
  - Primary Accent: `Color(0xFF2563EB)` (Royal Blue 600) / `Color(0xFF0D9488)` (Teal 600).
  - Background: `Color(0xFFF8FAFC)` (Slate 50), Surface/Cards: `Color(0xFFFFFFFF)`, Borders: `Color(0xFFE2E8F0)`.
  - Text: Primary `Color(0xFF0F172A)` (Slate 900, contrast 16.1:1), Secondary `Color(0xFF475569)` (Slate 600, contrast 5.4:1).
  - Semantic Status Colors:
    - Success (Hadir / Disetujui / Diterima): `#16A34A` (Green 600) on `#DCFCE7` (Green 100).
    - Warning (Terlambat / Menunggu): `#D97706` (Amber 600) on `#FEF3C7` (Amber 100).
    - Danger (Alpa / Ditolak / SOS Darurat): `#DC2626` (Red 600) on `#FEE2E2` (Red 100).
    - Info: `#2563EB` (Blue 600) on `#DBEAFE` (Blue 100).
- **Touch Target & Layout Spacing**:
  - Minimum touch target: 44x44 dp enforced via `minimumSize: Size(44, 44)` on all buttons and `IconButton` padding.
  - Spacing scale: 4, 8, 12, 16, 24, 32, 48 dp tokens.
  - Responsive breakpoints: Mobile (`< 768px`, tested at 390px), Tablet (`768px - 1024px`), Desktop (`>= 1024px`, tested at 1440px). No horizontal scrolling at 390px.
- **Form Controls & States**:
  - Always-visible floating labels with inline error text under inputs.
  - High-contrast 2px focus border on active input fields.
  - Material Icons only (e.g. `Icons.qr_code_scanner`, `Icons.location_on`, `Icons.assignment_turned_in`, `Icons.warning_amber_rounded`); strictly 0 emoji as icons.
  - Triple-state handling on all data views: Loading (skeleton/spinner), Empty (informative title + helper text + illustration), Error (error message + "Coba Lagi" action).

### 2.3 Backend Architecture (Firebase Functions TypeScript)
- **Directory Layout (`functions/`)**:
  - `functions/src/callable/`:
    - `lookupNisn.ts`: Verifies student NISN against `roster` collection.
    - `completeRegistration.ts`: Atomically creates `users/{uid}` and marks `roster/{nisn}.isRegistered = true`.
    - `getUploadUrl.ts`: Issues S3/R2 presigned `PUT` URL for logbook photos and PDF reports.
  - `functions/src/triggers/`:
    - `verifyAttendance.ts`: Validates QR token and recalculates server-side Haversine distance (<= 50m).
    - `verifyCheckout.ts`: Enforces `logbookSubmitted == true` before permitting check-out.
    - `onLogbookCreated.ts`: Sets `attendances.logbookSubmitted = true` upon logbook document insertion.
    - `onLogbookReviewed.ts`: Emits notification to student upon review status change.
    - `onApplicationDecided.ts`: Atomically updates company `filledQuota` (checks against `quota`) and assigns student `companyId`.
    - `onAssessmentFinalized.ts`: Evaluates score against school `talentThreshold` and sets `isRecommendedTalent = true`.
    - `onSosStatusChanged.ts`: Dispatches notification to student upon SOS status or note update.
    - `markAbsentees.ts`: Scheduled / callable function marking non-checked-in students as `alpa`.
  - `functions/src/utils/`:
    - `geo.ts`: Pure Haversine distance formula implementation.
    - `r2.ts`: AWS SDK S3 client configured for either Cloudflare R2 or local mock (`http://127.0.0.1:9090`).
    - `notify.ts`: Helper creating Firestore `notifications` documents.

### 2.4 Local Cloudflare R2 / S3 Mock Server
- **Problem**: Cloudflare R2 requires cloud API credentials and internet connectivity. Requirement R3 mandates local operation with zero cloud credentials.
- **Solution**:
  - Create a lightweight Express/Node S3 mock server running locally at `http://127.0.0.1:9090`.
  - Implements:
    - `PUT /:bucket/:key(*)`: Accepts binary upload, stores file to `mock-storage/uploads/:bucket/:key`, returns HTTP 200 with CORS headers (`Access-Control-Allow-Origin: *`).
    - `GET /:bucket/:key(*)`: Serves the uploaded file with correct `Content-Type` header (`image/jpeg`, `application/pdf`).
    - `OPTIONS /:bucket/:key(*)`: Handles browser CORS preflight.
  - `getUploadUrl` in Cloud Functions uses `@aws-sdk/s3-request-presigner` targeting `endpoint: process.env.R2_ENDPOINT || 'http://127.0.0.1:9090'` with `forcePathStyle: true`.
  - Client uploads directly to the presigned URL via standard HTTP PUT; public URLs resolve directly to `http://127.0.0.1:9090/...`, allowing Flutter Web and Mobile to display images and download PDFs locally without code changes.

### 2.5 Firebase Emulators Setup (`firebase.json`)
- Ports allocation:
  - Auth: `9099`
  - Firestore: `8080`
  - Functions: `5001`
  - Emulator UI: `4000`
  - Local S3/R2 Mock: `9090`
  - Web Dev Server: `8000` (or `5000` if Hosting Emulator is used)
- Because Firebase CLI is not globally installed, use local `npx firebase-tools` or install `firebase-tools` in root `devDependencies`.

### 2.6 Firestore Security Rules Architecture (`firestore.rules`)
- Multi-tenancy achieved via `schoolId` match on user token and document data:
  ```javascript
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      function isSignedIn() { return request.auth != null; }
      function getUserData() { return get(/databases/$(database)/documents/users/$(request.auth.uid)).data; }
      function isRole(role) { return isSignedIn() && getUserData().role == role; }
      function isSameSchool(schoolId) { return isSignedIn() && getUserData().schoolId == schoolId; }

      // Companies: Platform-level
      match /companies/{companyId} {
        allow read: if isSignedIn();
        allow create: if isRole('admin_sekolah') || isRole('super_admin');
        allow update: if (isRole('admin_sekolah') || isRole('super_admin'))
          && request.resource.data.diff(resource.data).affectedKeys()
             .hasOnly(['name', 'address', 'lat', 'lng', 'geofenceRadiusMeters', 'jurusanAllowed', 'quota']);
        allow delete: if isRole('super_admin');
      }

      // Applications
      match /applications/{appId} {
        allow create: if isSignedIn()
          && request.auth.uid == request.resource.data.studentId
          && request.resource.data.status == 'menunggu';
        allow read: if isSignedIn() && (
          request.auth.uid == resource.data.studentId ||
          (isRole('admin_sekolah') && isSameSchool(resource.data.schoolId))
        );
        allow update: if isRole('admin_sekolah') && isSameSchool(resource.data.schoolId);
      }

      // Attendances
      match /attendances/{attId} {
        allow read: if isSignedIn() && isSameSchool(resource.data.schoolId);
        allow create: if isSignedIn() && request.auth.uid == request.resource.data.studentId;
        allow update: if isSignedIn() && (
          // Deny checkout if logbookSubmitted != true
          (!('checkOutTime' in request.resource.data) || resource.data.logbookSubmitted == true)
        );
      }

      // Logbooks
      match /logbooks/{logId} {
        allow create: if isSignedIn() && request.auth.uid == request.resource.data.studentId;
        allow read: if isSignedIn() && (
          request.auth.uid == resource.data.studentId ||
          (isRole('pembimbing_instansi') && getUserData().companyId == resource.data.companyId) ||
          (isRole('guru_pembimbing') && isSameSchool(resource.data.schoolId))
        );
        allow update: if isRole('pembimbing_instansi') && getUserData().companyId == resource.data.companyId;
      }

      // Final Reports
      match /finalReports/{repId} {
        allow create: if isSignedIn() && request.auth.uid == request.resource.data.studentId;
        allow read: if isSignedIn() && (
          request.auth.uid == resource.data.studentId ||
          (isRole('admin_sekolah') && isSameSchool(resource.data.schoolId))
        );
        allow update: if isRole('admin_sekolah') && isSameSchool(resource.data.schoolId)
          && request.resource.data.diff(resource.data).affectedKeys()
             .hasOnly(['status', 'certificateUrl', 'reviewedBy', 'reviewedAt']);
      }
    }
  }
  ```

### 2.7 Testing Architecture
1. **Functions Unit Tests**:
   - Implemented in `functions/test/` using Vitest / Mocha.
   - Tests:
     - `geo.test.ts`: Point within 50m radius passes; point at 75m distance rejected.
     - `qr.test.ts`: Token older than 60s rejected; mismatched token rejected.
     - `lookupNisn.test.ts`: Unknown NISN returns not-found; registered NISN returns already-registered; valid NISN returns student info.
     - `completeRegistration.test.ts`: Transactionally transfers roster record to user document.
     - `onApplicationDecided.test.ts`: Atomically updates quota; rejects when `filledQuota >= quota`.
     - `onLogbookCreated.test.ts`: Updates `attendances.logbookSubmitted = true`.
     - `onAssessmentFinalized.test.ts`: Validates threshold and sets `isRecommendedTalent = true`.
     - `getUploadUrl.test.ts`: Generates presigned URL and verifies file upload to local S3 mock.
2. **Firestore Security Rules Tests (`rules-tests/`)**:
   - Uses `@firebase/rules-unit-testing` connecting to Firestore Emulator (port 8080).
   - Validates all 7 security invariants from the acceptance criteria.
3. **Flutter Widget Tests (`vokalog_app/test/widget/`)**:
   - `registration_test.dart`: NISN input validation, error message visibility, disabled state.
   - `logbook_form_test.dart`: Title, category, and photo attachment validation.
   - `checkout_button_test.dart`: Validates button is disabled with warning text when `logbookSubmitted == false`; enabled when `true`.
4. **End-to-End Browser Verification (`e2e/`)**:
   - Headless Playwright script executing each of the 21 flows sequentially with seeded accounts.
   - Captures screenshots for each flow in `e2e/screenshots/flow_3_XX.png`.
   - Directly checks Firestore Emulator REST API (`http://127.0.0.1:8080/emulator/v1/...`) to verify backend document state after each action.
   - Asserts mobile (390px) and desktop (1440px) viewport responsiveness.

---

## 3. Caveats

1. **Firebase CLI Global Installation**:
   - Global `firebase` CLI is not installed on the host machine. The design uses `npx firebase-tools` or `package.json` dev dependency scripts to guarantee execution without host-level permissions.
2. **Flutter Web QR Scanner**:
   - Pembimbing Instansi displays QR codes on web (`qr_flutter` package); Siswa scans QR codes primarily on mobile. For testing/demo on web, the student QR screen should also provide a camera fallback / mock QR input option so E2E browser tests can submit QR tokens programmatically.
3. **Local S3 Mock SSL**:
   - Local S3 mock runs over HTTP (`http://127.0.0.1:9090`). Cloudflare R2 in production runs over HTTPS. In Flutter Web and Android, cleartext traffic to `127.0.0.1` / `localhost` must be permitted in Android network security config and web CSP.

---

## 4. Conclusion

1. **Flutter Client**: A **single multi-platform Flutter app** (`vokalog_app`) located in `vokalog_app/` inside `ujikom/` provides the cleanest architecture, avoiding code duplication across models, DTOs, and services while satisfying all build checks (`flutter analyze`, `flutter build web`, `flutter build apk --debug`).
2. **Backend**: Firebase Cloud Functions in TypeScript (`functions/`) with explicit separation between callable endpoints and triggers, paired with fine-grained multi-tenant Firestore Security Rules (`firestore.rules`).
3. **Local Storage Mock**: A Node/Express S3 mock (`mock-storage/server.js`) on port 9090 provides zero-cloud-credential R2 simulation with presigned PUT and static GET capabilities.
4. **Testing Suite**: Four discrete test harnesses:
   - Functions unit tests (Vitest / Mocha)
   - Rules unit tests (`@firebase/rules-unit-testing`)
   - Flutter widget tests (`flutter test`)
   - Playwright E2E browser runner (`e2e/runner.js`) with screenshot capture across all 21 PRD flows.

---

## 5. Verification Method

To independently verify the proposed architecture and test setups:
1. **Static Analysis & Build Verification**:
   - `cd vokalog_app && flutter analyze` (Expectation: 0 errors).
   - `cd vokalog_app && flutter build web` (Expectation: Successful build in `build/web`).
   - `cd functions && npm run build` (Expectation: TypeScript compilation succeeds with 0 errors).
2. **Test Harness Verification**:
   - `cd functions && npm test` (Expectation: Haversine, QR expiry, NISN lookup, and trigger tests pass).
   - `npm run test:rules` (Expectation: All Firestore Security Rules tests pass against Firestore emulator).
   - `cd vokalog_app && flutter test` (Expectation: Registration, logbook validation, and checkout button widget tests pass).
3. **Local Stack Integration Verification**:
   - Start emulators: `npx firebase emulators:start --only auth,firestore,functions`.
   - Start S3 mock: `node mock-storage/server.js`.
   - Run seed script: `node seed/seed.js`.
   - Run E2E runner: `node e2e/runner.js` (Expectation: All 21 flows complete, screenshots saved in `e2e/screenshots/`).
4. **Invalidation Conditions**:
   - If Flutter Web requires completely separate native plugins incompatible with mobile, separate targets would be needed (invalidated as modern packages `image_picker`, `go_router`, and `cloud_firestore` support both Web and Android natively).
   - If Firestore Security Rules cannot enforce `hasOnly` on affected keys, rule syntax would need refactoring (verified: `affectedKeys().hasOnly(...)` is official Firebase Rules syntax).
