# Project: VokaLog PKL Attendance & Hybrid Logbook System

## Architecture
VokaLog is a multi-tenant PKL (internship) management platform built for SMKN 1 Sumedang adhering to the official 2026/2027 PRD.
The architecture comprises:
1. **Frontend Client (`vokalog_app/`)**:
   - Single multi-platform Flutter 3.35.7 project targeting both Mobile (Android/iOS for Siswa) and Web (Super Admin, Admin Sekolah, Pembimbing Instansi, Guru Pembimbing).
   - Responsive design: 390px mobile viewport (bottom navigation, single column cards) and 1440px desktop viewport (navigation rail/sidebar, multi-column dashboard).
   - Design System: Primary `#1E3A8A` (Vocational Navy Blue, WCAG AAA 9.5:1), >=44px touch targets, visible floating labels with inline validation, SVG/Material icons (0 emojis), triple-state UI (Loading, Empty, Error) across all data views.
2. **Backend & Cloud Functions (`functions/`)**:
   - TypeScript-based Firebase Cloud Functions v2.
   - Callable Functions: `lookupNisn`, `completeRegistration`, `getUploadUrl`.
   - Firestore Triggers: `verifyAttendance`, `verifyCheckout`, `onLogbookCreated`, `onLogbookReviewed`, `onApplicationDecided`, `onAssessmentFinalized`, `onSosStatusChanged`, `markAbsentees`.
   - Utilities: `geo.ts` (50m Haversine formula), `notify.ts` (FCM/in-app notifications), `r2.ts` (S3/R2 presigned URL client), `admin.ts`.
3. **Database & Security (`firestore.rules`)**:
   - Multi-tenant Firestore scoped by `schoolId`, with platform-level `companies`.
   - Field-level mutation restrictions (e.g. company update whitelist: `name, address, lat, lng, geofenceRadiusMeters, jurusanAllowed, quota`).
   - Strict check-out barrier: `logbookSubmitted == true` required before `checkOut` write is permitted.
   - Company deletion permitted exclusively for Super Admin (`role == 'admin' && schoolId == null`).
4. **Zero-Cost Object Storage**:
   - Cloudflare R2 via S3 API with presigned PUT URLs for photos and PDF reports (zero client credentials).
   - Local mock server (`mock-storage/server.js`) on port 9090 providing local S3-compatible endpoints during emulator testing.
5. **Firebase Emulator Suite (`firebase.json`)**:
   - Auth (9099), Firestore (8080), Functions (5001), UI (4000).

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---|---|---|---|
| 1 | Workspace Cleanup | Remove 35 legacy IoT/RFID and RTDB prototype files; retain logos | M1 | ORIGINAL_REQUEST R1 |
| 2 | Local Storage Mock | S3-compatible mock server on port 9090 with presigned PUT & GET | M1 | ORIGINAL_REQUEST R3, PRD 2.4 |
| 3 | Firebase Emulator Setup | Configure Auth, Firestore, Functions emulators in `firebase.json` | M1 | ORIGINAL_REQUEST R3 |
| 4 | Callable `lookupNisn` | Validate student NISN against school roster | M1 | PRD 3.4, sequence 3.5 |
| 5 | Callable `completeRegistration` | Atomically migrate roster record to `users/{uid}` and activate account | M1 | PRD 3.4, sequence 3.5 |
| 6 | Callable `getUploadUrl` | Generate presigned PUT URL for Cloudflare R2 / mock S3 | M1 | PRD 3.15, 3.20 |
| 7 | Trigger `verifyAttendance` | Server-side Haversine geofence (<=50m) & QR token validity check | M1 | PRD 3.12, sequence 3.25 |
| 8 | Trigger `verifyCheckout` | Server-side geofence & enforce `logbookSubmitted == true` | M1 | PRD 3.13, sequence 3.27 |
| 9 | Trigger `onLogbookCreated` | Automatically mark `attendances.logbookSubmitted = true` | M1 | PRD 3.15, sequence 3.31 |
| 10 | Trigger `onLogbookReviewed` | Notify student on logbook approval/rejection | M1 | PRD 3.16, sequence 3.33 |
| 11 | Trigger `onApplicationDecided` | Atomic transaction updating company `filledQuota` and student assignment | M1 | PRD 3.11, sequence 3.23 |
| 12 | Trigger `onAssessmentFinalized` | Evaluate final score against school `talentThreshold` for talent pool | M1 | PRD 3.19, sequence 3.39 |
| 13 | Trigger `onSosStatusChanged` | Notify student when teacher reviews or resolves SOS | M1 | PRD 3.18, sequence 3.37 |
| 14 | Scheduled `markAbsentees` | Mark students who did not check in as alpha | M1 | PRD Class Diagram |
| 15 | Firestore Security Rules | Multi-tenant isolation, role checks, checkout gate, company whitelist | M1 | PRD ERD & AC |
| 16 | Seed Data Pipeline | Seed SMKN 1 Sumedang, roster (`XII RPL 1, 2`, `XII TKJ 1`), staff & companies | M1 | ORIGINAL_REQUEST R3 |
| 17 | Flutter Project Scaffolding | Single multi-platform Flutter app (`vokalog_app`) supporting Web & Mobile | M2 | ORIGINAL_REQUEST R1, R4 |
| 18 | Design System & Shell | Color tokens (`#1E3A8A`), >=44px touch targets, responsive adaptive nav | M2 | ORIGINAL_REQUEST R4 |
| 19 | Student NISN Registration UI | Two-step NISN lookup and account creation form | M2 | PRD 3.4 |
| 20 | Role-Based Authentication UI | Multi-role login supporting all 5 actors with role-based routing | M2 | PRD 3.2 |
| 21 | Company Directory & Realtime View | Admin view of partner companies with live capacity indicators | M3 | PRD 3.5 |
| 22 | Company Creation | Admin form to register partner company with geofence coordinates | M3 | PRD 3.6 |
| 23 | Company Detail View | View company profile, placed interns, and supervisors | M3 | PRD 3.7 |
| 24 | Company Field-Restricted Edit | Edit company details restricted to allowed fields | M3 | PRD 3.8 |
| 25 | Company Deletion (Super Admin) | Exclusive Super Admin action with confirmation dialog | M3 | PRD 3.9 |
| 26 | Student PKL Application | Student browses eligible companies by major and submits application | M3 | PRD 3.10 |
| 27 | Admin Application Management | Admin reviews applications, approves or rejects with reason & quota check | M3 | PRD 3.11, 1.7 |
| 28 | Dynamic QR Generator (60s) | Pembimbing Instansi generates auto-refreshing QR token | M4 | PRD 1.6, 3.16 |
| 29 | Double-Verification Check-In | Student scans QR + GPS geofencing (<=50m haversine validation) | M4 | PRD 3.12 |
| 30 | Hybrid Logbook Submission | Student logs daily entry, attaches physical page photo uploaded to R2 | M4 | PRD 3.15 |
| 31 | Check-Out Gate Enforcement | Student check-out unlocked only after logbook is submitted | M4 | PRD 3.13 |
| 32 | Logbook Review & Approval | Pembimbing Instansi reviews and approves/rejects logbook entries | M4 | PRD 3.16 |
| 33 | Realtime Teacher Attendance Monitor | Guru Pembimbing dashboard tracking student attendance live | M4 | PRD 3.14 |
| 34 | Emergency SOS Reporting | Student triggers SOS alert with realtime GPS coordinates | M5 | PRD 3.17 |
| 35 | Teacher SOS Follow-up | Guru Pembimbing views SOS, updates status, and adds follow-up notes | M5 | PRD 3.18 |
| 36 | Two-Stage Final Assessment | Stage 1 (Industry Mentor) + Stage 2 (Teacher) with talent flag calculation | M5 | PRD 3.19 |
| 37 | Final Report PDF & Validation | Student uploads report PDF to R2; Admin validates and issues certificate | M5 | PRD 3.20 |
| 38 | Filtered Report Export | Admin exports attendance/PKL recap filtered by date, major, and company | M5 | PRD 3.21 |
| 39 | Talent Pool & Vacancies | Pembimbing Instansi posts jobs; recommended talent students apply | M5 | PRD Class Diagram & ERD |
| 40 | E2E Test Suite Validation (Tiers 1-4) | Pass 100% of automated E2E tests against local emulators & mock R2 | M6 | ORIGINAL_REQUEST AC |
| 41 | Adversarial Hardening (Tier 5) | Challenger coverage stress tests & edge-case hardening | M6 | Project Pattern AC |
| 42 | Indonesian Documentation & Mapping | Complete README.md and PRD 3.4-3.21 traceability matrix | M6 | ORIGINAL_REQUEST AC |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| M1 | Backend Foundation, Storage Mock & Seeds | Legacy cleanup, `mock-storage`, `functions/` (callables & triggers), `firestore.rules`, seeds, functions unit tests & rules tests | none | PLANNED |
| M2 | Flutter Scaffolding, Design Tokens & Auth Shell | `vokalog_app`, theme tokens, responsive layouts, NISN registration, login, role routing | M1 | PLANNED |
| M3 | Company Management & PKL Applications | Company CRUD (Super Admin vs Admin Sekolah), Student application, Admin decision | M2 | PLANNED |
| M4 | Dynamic QR, Double-Verification & Hybrid Logbook | 60s Dynamic QR, Check-In, Hybrid Logbook with R2 upload, Check-Out barrier, Review, Realtime Monitor | M3 | PLANNED |
| M5 | SOS Alert, Assessment, Final Reports, Export & Talent Pool | SOS workflow, two-stage assessment & talent threshold, PDF upload & certificate, export filters, job vacancies | M4 | PLANNED |
| M6 | Final Verification, Full E2E Test Pass & Documentation | Pass 100% E2E tests, Tier 5 hardening, Playwright browser runner with 21 screenshots, README.md | M5 | PLANNED |

## Interface Contracts

### 1. Storage Mock (`http://127.0.0.1:9090`)
- `PUT /:bucket/:key`: Binary upload via presigned URL with `Content-Type`. Returns HTTP 200.
- `GET /:bucket/:key`: Public read serving raw bytes with proper MIME type (`image/jpeg`, `application/pdf`).
- `OPTIONS /:bucket/:key`: CORS preflight allowing `PUT, GET, HEAD, OPTIONS` from `*`.

### 2. Callable Functions Contract (`functions/src/callable/`)
- `lookupNisn({ nisn: string, schoolId?: string })` -> `{ found: boolean, registered: boolean, student?: { name: string, nisn: string, schoolId: string, jurusanId: string, kelas: string } }`
- `completeRegistration({ nisn: string, name: string, schoolId: string, jurusanId: string, kelas: string, phone?: string })` -> `{ success: boolean, uid: string }`
- `getUploadUrl({ bucket: string, path: string, contentType: string })` -> `{ uploadUrl: string, publicUrl: string, expiresAt: number }`

### 3. QR Token Schema (`qrTokens/{companyId}`)
- `token`: Cryptographically secure random UUID string.
- `lat`: Number (company latitude).
- `lng`: Number (company longitude).
- `expiresAt`: Timestamp (`now + 60s`).
- `generatedBy`: String (`users.uid` of supervisor).

### 4. Attendance Document Contract (`attendances/{uid_yyyyMMdd}`)
- `status`: `"pending" | "hadir" | "izin" | "sakit" | "alpha"`
- `logbookSubmitted`: `boolean` (Set to true exclusively by `onLogbookCreated`)
- `checkIn`: `{ time: Timestamp, lat: number, lng: number, distanceMeters: number, verifiedServerSide: boolean }`
- `checkOut`: `{ time: Timestamp, lat: number, lng: number, distanceMeters: number, verifiedServerSide: boolean }`

### 5. Final Assessment Contract (`assessments/{assessmentId}`)
- `technicalScore`: number (0-100, set by supervisor)
- `behaviorScore`: number (0-100, set by supervisor)
- `finalScore`: number (0-100, set by teacher)
- `status`: `"draft" | "final"`
- `isRecommendedTalent`: boolean (Automated by `onAssessmentFinalized` when `finalScore >= school.talentThreshold`)

## Code Layout
```
C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom/
├── PROJECT.md
├── README.md
├── firebase.json
├── firestore.rules
├── firestore.indexes.json
├── package.json
├── mock-storage/
│   ├── server.js
│   └── uploads/
├── functions/
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts
│   │   ├── callable/
│   │   │   ├── lookupNisn.ts
│   │   │   ├── completeRegistration.ts
│   │   │   └── getUploadUrl.ts
│   │   ├── triggers/
│   │   │   ├── verifyAttendance.ts
│   │   │   ├── verifyCheckout.ts
│   │   │   ├── onLogbookCreated.ts
│   │   │   ├── onLogbookReviewed.ts
│   │   │   ├── onApplicationDecided.ts
│   │   │   ├── onAssessmentFinalized.ts
│   │   │   ├── onSosStatusChanged.ts
│   │   │   └── markAbsentees.ts
│   │   └── utils/
│   │       ├── geo.ts
│   │       ├── notify.ts
│   │       ├── r2.ts
│   │       └── admin.ts
│   └── test/
│       ├── geo.test.ts
│       ├── qr.test.ts
│       ├── lookupNisn.test.ts
│       ├── completeRegistration.test.ts
│       ├── onApplicationDecided.test.ts
│       ├── onLogbookCreated.test.ts
│       └── onAssessmentFinalized.test.ts
├── rules-tests/
│   ├── package.json
│   └── firestore-rules.test.ts
├── seed/
│   ├── seed.js
│   └── roster-data.json
├── e2e/
│   ├── runner.js
│   └── screenshots/
└── vokalog_app/
    ├── pubspec.yaml
    ├── analysis_options.yaml
    ├── lib/
    │   ├── main.dart
    │   ├── config/
    │   │   ├── routes.dart
    │   │   └── theme.dart
    │   ├── models/
    │   ├── services/
    │   │   ├── auth_service.dart
    │   │   ├── firestore_service.dart
    │   │   ├── storage_service.dart
    │   │   └── location_service.dart
    │   ├── widgets/
    │   └── screens/
    │       ├── auth/
    │       ├── student/
    │       ├── supervisor/
    │       └── admin/
    └── test/
        └── widget/
            ├── registration_test.dart
            ├── logbook_form_test.dart
            └── checkout_button_test.dart
```
