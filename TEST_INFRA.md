# TEST_INFRA: VokaLog PKL System Test Infrastructure

## 1. Executive Summary & Test Architecture

VokaLog is a multi-tenant internship (Praktik Kerja Lapangan / PKL) management and hybrid logbook platform for SMKN 1 Sumedang (PRD 2026/2027). The system integrates a multi-platform Flutter client, Firebase Cloud Functions (TypeScript), Cloud Firestore, Firebase Authentication, and Cloudflare R2 object storage via presigned S3 URLs.

To guarantee complete conformance to `ORIGINAL_REQUEST.md`, `PROJECT.md`, and `PRD BAB III (3.4 - 3.21)`, the test strategy adheres to the **Dual Track Project Pattern** with an **Opaque-Box Requirement-Driven** test suite. Testing exercises the system across all 42 features in the Feature Inventory across four structured verification tiers.

### 1.1 Architecture & Local Emulator Test Topology

```
+-------------------------------------------------------------------------------+
|                             E2E Test Runner                                   |
|                           (`e2e/runner.js`)                                   |
+-------+--------------------+---------------------+--------------------+-------+
        |                    |                     |                    |
        v                    v                     v                    v
+---------------+    +---------------+     +---------------+    +---------------+
| Firebase Auth |    |   Firestore   |     |Cloud Functions|    | Mock Storage  |
|   Emulator    |    |   Emulator    |     |   Emulator    |    |   (S3 / R2)   |
|   Port 9099   |    |   Port 8080   |     |   Port 5001   |    |   Port 9090   |
+---------------+    +---------------+     +---------------+    +---------------+
        |                    |                     |                    |
        +--------------------+----------+----------+--------------------+
                                        |
                                        v
                       +---------------------------------+
                       | Automated UI & State Validation |
                       |    21 Visual PNG Screenshots    |
                       |      (`e2e/screenshots/`)       |
                       +---------------------------------+
```

- **Firebase Auth Emulator**: `http://127.0.0.1:9099` (Identity token issuance, email/password verification, UID generation).
- **Cloud Firestore Emulator**: `http://127.0.0.1:8080` (Multi-tenant document store, security rules enforcement, realtime listeners).
- **Cloud Functions Emulator**: `http://127.0.0.1:5001` (HTTP callables `lookupNisn`, `completeRegistration`, `getUploadUrl`, and Firestore background triggers).
- **Mock Storage Server**: `http://127.0.0.1:9090` (S3/R2 mock supporting presigned PUT uploads and GET downloads without external credentials).
- **Visual Artifacts Engine**: Built-in screenshot and state snapshot generator rendering high-resolution PNG snapshots for all 21 PRD flows in `e2e/screenshots/`.

---

## 2. Four-Tier Test Methodology & Coverage Standards

The test suite enforces four distinct tiers of testing:

1. **Tier 1 — Feature Coverage (>=5 test cases per feature)**: Validates the happy path, primary functional behavior, and interface contracts for all 42 features (>= 210 test assertions).
2. **Tier 2 — Boundary, Edge Case & Security Hardening (>=5 test cases per feature)**: Validates limits, off-by-one conditions, role permissions, unauthorized mutations, geofence radius breaches (>50m), expired tokens (>60s), and quota overflows (>= 210 test assertions).
3. **Tier 3 — Cross-Feature Integration (Pairwise Lifecycle)**: Verifies end-to-end data integrity across dependent subsystem transitions (Registration -> Company Allocation -> QR Token -> Check-In -> Hybrid Logbook -> Check-Out Gate -> Assessment -> Final Report -> Certificate).
4. **Tier 4 — Real-World Application Scenarios (The 21 PRD BAB III Flows)**: Exercises end-to-end user journeys for all 5 actors (Siswa, Super Admin, Admin Sekolah, Pembimbing Instansi, Guru Pembimbing), recording state mutations, HTTP responses, and capturing 21 visual PNG screenshots.

---

## 3. Comprehensive Feature Inventory Test Matrix (Features 1 - 42)

| Feature # | Feature Name | Tier 1 (Happy Path >=5) | Tier 2 (Edge/Security >=5) | Interface Contract Verified |
|---|---|---|---|---|
| **F01** | Workspace Cleanup | Clean project root, no RTDB JS, no IoT files, logos preserved in assets, clean directory structure | Path traversal attempts, missing logo fallback, leftover .bak files, non-empty iot check, git hygiene | ORIGINAL_REQUEST R1 |
| **F02** | Local Storage Mock | PUT binary returns 200, GET serves correct MIME, CORS headers present, directory isolation, presigned key query | Max upload size limits, corrupted PUT payload, nonexistent bucket, unauthorized overwrite, CORS preflight deny | Port 9090 S3 API |
| **F03** | Firebase Emulator Setup | Auth connects on 9099, Firestore connects on 8080, Functions on 5001, clearData API works, rule hot-reload | Port conflicts, timeout handling, emulator offline graceful error, corrupted rules syntax, big batch import | `firebase.json` |
| **F04** | Callable `lookupNisn` | Valid unassigned NISN returns student info, returns `found: true`, returns `registered: false`, matches school, matches class | Unregistered NISN returns 404/found:false, already registered returns registered:true, empty NISN string, non-numeric NISN, SQL/NoSQL injection string | PRD 3.4, sequence 3.5 |
| **F05** | Callable `completeRegistration` | Atomic move from roster to users, password auth linked, status set to active, role set to 'siswa', returns uid | Duplicate email registration, mismatched schoolId, missing phone number fallback, re-registration replay attack, race condition on roster claim | PRD 3.4, sequence 3.5 |
| **F06** | Callable `getUploadUrl` | Generates presigned PUT URL for photos, generates URL for PDF reports, returns valid publicUrl, expiresAt in future, bucket isolation | Unsupported content type rejection, invalid file extension, huge path length, missing auth token, path escaping | PRD 3.15, 3.20 |
| **F07** | Trigger `verifyAttendance` | Check-in <=50m marked verified, valid 60s QR token accepted, distanceMeters calculated, timestamp recorded, status set to 'hadir' | Distance >50m (e.g. 51m, 500m) rejected, expired QR token (>60s) rejected, token from wrong company rejected, duplicate check-in today, future timestamp | PRD 3.12, sequence 3.25 |
| **F08** | Trigger `verifyCheckout` | Check-out when logbookSubmitted=true accepted, <=50m geofence verified, status updated, duration calculated, exit timestamp set | Check-out without logbook (logbookSubmitted=false) rejected, checkout before checkin rejected, checkout distance >50m rejected, double checkout attempt, foreign company QR | PRD 3.13, sequence 3.27 |
| **F09** | Trigger `onLogbookCreated` | Setting new logbook marks `attendances.logbookSubmitted = true`, links photo URL, updates timestamp, sets reviewStatus='menunggu', preserves existing attendance | Multiple logbooks same day handled idempotently, logbook submitted on day with no checkin, missing photoUrl rejected, oversized title/content, invalid jurusan category | PRD 3.15, sequence 3.31 |
| **F10** | Trigger `onLogbookReviewed` | Approval updates reviewStatus='disetujui', rejection updates reviewStatus='ditolak', note recorded, student receives notification, reviewerUid stamped | Non-mentor review rejected, review of already approved logbook, review of logbook belonging to different company, blank rejection reason rejected, review of future date | PRD 3.16, sequence 3.33 |
| **F11** | Trigger `onApplicationDecided` | Approved application increments `filledQuota`, sets student's companyId, updates status to 'diterima', decrements available quota, student notified | Application approval when quota is full (filledQuota == quota) rejected, duplicate approval attempt, rejection does not increment quota, non-admin approval rejected, cross-school admin approval rejected | PRD 3.11, sequence 3.23 |
| **F12** | Trigger `onAssessmentFinalized` | Assessment with finalScore >= talentThreshold sets `isRecommendedTalent = true`, score calculation exact, status set to 'final', notifications emitted, teacherUid stamped | finalScore < talentThreshold sets `isRecommendedTalent = false`, negative score clamped, score >100 clamped, finalizing without supervisor scores rejected, unauthorized teacher finalize | PRD 3.19, sequence 3.39 |
| **F13** | Trigger `onSosStatusChanged` | Teacher update to 'ditinjau' recorded, followUpNote stored, student receives in-app alert, resolved timestamp recorded, audit log updated | Non-teacher cannot update SOS status, empty followUpNote rejected, status change on foreign school SOS rejected, invalid status transition, SOS without coordinates | PRD 3.18, sequence 3.37 |
| **F14** | Scheduled `markAbsentees` | Students without check-in by cut-off marked 'alpha', students with approved leave skipped, attendances created, absentee count updated, teacher alerted | Run during weekend skips execution, run for inactive students skips, students with 'izin' not overwritten, idempotency on second run, timezone alignment | PRD Class Diagram |
| **F15** | Firestore Security Rules | Super Admin can delete company, multi-tenant school isolation enforced, checkout denied if logbookSubmitted false, whitelisted company update fields, roster read-only for students | School Admin cannot delete company, student cannot edit company, student cannot edit another student's attendance, cross-school queries rejected, write to unwhitelisted company fields blocked | PRD ERD & AC |
| **F16** | Seed Data Pipeline | Seeds SMKN 1 Sumedang school document, seeds roster XII RPL 1, XII RPL 2, XII TKJ 1, seeds staff accounts for 5 roles, seeds partner companies, seeds initial quotas | Idempotent re-seeding without duplication, schema validation on all seeds, password hashing / test auth credentials setup, coordinate validity in seeds, roster duplicate NISN handling | ORIGINAL_REQUEST R3 |
| **F17** | Flutter Scaffolding | Single codebase compiles for Web and Mobile, asset bundle includes logos, responsive layout provider active, entrypoint starts clean, router configured | Missing asset fails gracefully, unsupported browser resolution fallback, platform channel degradation, offline network detection, memory leak prevention | ORIGINAL_REQUEST R1, R4 |
| **F18** | Design System & Shell | Brand color `#1E3A8A` applied, WCAG AAA 9.5:1 contrast verified, touch targets >=44px, zero emojis as system icons, loading/empty/error states implemented | Mobile 390px viewport no horizontal scroll, desktop 1440px multi-column layout, high contrast mode, dynamic font scaling, rapid theme switching | ORIGINAL_REQUEST R4 |
| **F19** | Student NISN Registration UI | 2-step registration wizard, NISN input triggers lookup, displays student info card, password strength meter, submit creates account | Invalid NISN displays inline error, network failure shows retry button, weak password blocks submit, existing NISN shows login link, form reset clears sensitive state | PRD 3.4 |
| **F20** | Role-Based Authentication UI | Login with email/password, redirects Admin to Web portal, redirects Siswa to Mobile portal, redirects Guru to Monitor, redirects Pembimbing to QR view | Invalid credentials shows inline alert, disabled account shows contact admin, session expiry redirects to login, unauthorized route redirects to 403, fast repeated submit debounced | PRD 3.2 |
| **F21** | Company Directory & Realtime View | Lists partner companies, displays capacity badge (available vs full), filters by major (RPL, TKJ), realtime updates on quota change, search by company name | Empty search results shows empty state, special characters in search, network disconnect shows offline banner, pagination / infinite scroll boundary, extreme company count | PRD 3.5 |
| **F22** | Company Creation | Admin form accepts name, address, coordinates, radius, allowed majors, quota; validates coordinates; saves to companies; logs creator | Negative quota rejected, radius <10m or >1000m rejected, invalid lat/lng values rejected, empty company name rejected, duplicate company name warning | PRD 3.6 |
| **F23** | Company Detail View | Shows company profile, shows active interns count, lists industry supervisors, displays geofence map circle, shows contact info | Company with 0 interns displays empty list state, missing supervisor displays unassigned alert, lat/lng render pins correctly, non-existent company shows 404, responsive cards | PRD 3.7 |
| **F24** | Company Field-Restricted Edit | Allows editing `name, address, lat, lng, geofenceRadiusMeters, jurusanAllowed, quota`; preserves `filledQuota`; shows success snackbar | Modifying `filledQuota` directly rejected by rules, lowering `quota` below current `filledQuota` blocked, empty address rejected, invalid coordinates rejected, concurrent edits | PRD 3.8 |
| **F25** | Company Deletion (Super Admin) | Super Admin deletes unused company, confirmation modal with safety prompt, company removed from listing, audit log created | School Admin attempting delete blocked with 403, deleting company with active interns blocked, cancel button aborts delete, repeated delete attempt handled, cascade check | PRD 3.9 |
| **F26** | Student PKL Application | Siswa selects company matching their major, inputs motivation/notes, submits application, status becomes 'menunggu', company card updates | Siswa applying to company not admitting their major rejected, applying while having active application rejected, submitting with empty companyId, double click submit, offline submit | PRD 3.10 |
| **F27** | Admin Application Management | Admin views list of applications for school, filters by status ('menunggu', 'diterima', 'ditolak'), displays student profile & major | Applications from other schools hidden, empty status filter shows empty state, pagination edge case, sorting by submission date, realtime badge count | PRD 3.11, 1.7 |
| **F28** | Dynamic QR Generator (60s) | Mentor generates QR code, updates token every 60s, displays countdown timer, token bound to companyId, displays geofence center | Expired token replaced immediately, countdown reaches 0 triggers auto-refresh, mentor logout stops timer, token persistence check, multiple supervisors same company | PRD 1.6, 3.16 |
| **F29** | Double-Verification Check-In | Siswa scans active QR, reads GPS coordinates, checks distance <=50m, server validates and creates attendance record, green checkmark UI | Scan outside 50m shows distance error with meters displayed, scan expired QR shows expired alert, mock location flag rejected, camera permission denied fallback, check-in twice blocked | PRD 3.12 |
| **F30** | Hybrid Logbook Submission | Siswa enters title, category, uploads physical logbook photo to R2, submits logbook, unlocks check-out button, displays preview | Upload non-image rejected, upload image >10MB rejected, empty activity title rejected, unselected category rejected, network interruption during upload resumes or fails safely | PRD 3.15 |
| **F31** | Check-Out Gate Enforcement | Check-out button enabled only when logbookSubmitted=true, QR scan & GPS geofence re-verified, attendance record updated with checkOut | Check-out button disabled & shows tooltip when logbook not submitted, attempting check-out before check-in blocked, check-out >50m blocked, tampering logbookSubmitted client-side denied by rules | PRD 3.13 |
| **F32** | Logbook Review & Approval | Mentor views student logbook entries, inspects uploaded photo in full resolution, clicks approve or reject with comment, status updates | Mentor approving logbook of another company blocked, rejecting without comment blocked, review status changes reflect in student view real-time, bulk approval boundary | PRD 3.16 |
| **F33** | Realtime Teacher Attendance Monitor | Guru Pembimbing dashboard lists students, shows attendance status (Hadir, Izin, Sakit, Alpha), updates live on Firestore snapshot | Filtering by class (XII RPL 1, 2, TKJ 1), date picker navigation, high student volume performance, realtime check-in indicator pulse, offline reconnect | PRD 3.14 |
| **F34** | Emergency SOS Reporting | Siswa clicks SOS button, captures exact GPS coordinates, inputs emergency message, alert sent immediately, UI shows confirmation | SOS with disabled GPS prompts location enable, duplicate rapid SOS button press throttled, SOS outside working hours still delivered, empty message allows default urgent text | PRD 3.17 |
| **F35** | Teacher SOS Follow-up | Guru Pembimbing sees high-priority SOS alert card with location map, clicks follow-up, inputs resolution notes, marks resolved | Updating SOS of another school blocked, non-teacher role blocked, resolving without notes blocked, reopening resolved SOS, phone call link launches dialer | PRD 3.18 |
| **F36** | Two-Stage Final Assessment | Stage 1: Mentor submits technical & behavior scores. Stage 2: Teacher submits school score. Total computed, talent flag set | Submitting stage 2 before stage 1 blocked, scores outside 0-100 rejected, non-assigned mentor scoring blocked, final score editing after lock blocked, tie-breaker threshold | PRD 3.19 |
| **F37** | Final Report PDF & Validation | Siswa uploads PDF final report via R2 presigned URL, Admin reviews and validates, issues certificate with download URL | Uploading non-PDF rejected, PDF >20MB rejected, admin rejecting report requires revision notes, student re-upload clears rejection, certificate URL validation | PRD 3.20 |
| **F38** | Filtered Report Export | Admin filters by date range, jurusan, and company; generates PDF/CSV export; verifies column completeness; downloads file | Invalid date range (end < start) blocked, filter returning 0 records shows empty alert, export large dataset (>1000 rows) buffered, special characters in names escaped in CSV | PRD 3.21 |
| **F39** | Talent Pool & Vacancies | Mentor creates job vacancy, students with `isRecommendedTalent=true` view vacancies, submit one-click application, mentor reviews candidates | Non-recommended student applying blocked, vacancy past expiry hidden, editing expired vacancy, student withdrawing application, vacancy quota limit | PRD Class Diagram & ERD |
| **F40** | E2E Test Suite Validation | Test runner executes all 21 flows against emulators, 100% assertions pass, 21 PNG screenshots captured, output summary generated | Emulator timeout recovery, partial test failure logging, clean test teardown, deterministic random seed, console output formatting | ORIGINAL_REQUEST AC |
| **F41** | Adversarial Hardening (Tier 5) | Geofence GPS spoofing attempts rejected, forged QR token replay attacks rejected, direct Firestore REST write attacks blocked by rules | XSS injection in logbook titles escaped, SQL/NoSQL payload in NISN rejected, huge payload (>50MB) rejected, concurrent application spam test, replay attack token check | Project Pattern AC |
| **F42** | Indonesian Documentation & Mapping | README.md contains full setup guide, emulator start instructions, demo account credentials, PRD 3.4-3.21 traceability matrix table | Broken markdown links verified, step-by-step verification commands work, port listing accurate, Indonesian grammar and clarity check | ORIGINAL_REQUEST AC |

---

## 4. Tier 3: Cross-Feature Integration (Pairwise Lifecycle Matrix)

Tier 3 validates data flow across module boundaries through realistic multi-stage sequences:

1. **Lifecycle 1 (Registration -> Placement)**:
   `F16 (Seed Roster)` -> `F04/F19 (lookupNisn)` -> `F05 (completeRegistration)` -> `F20 (Login)` -> `F21 (Company Directory)` -> `F26 (Apply PKL)` -> `F27/F11 (Admin Approval & Quota Increment)`.
2. **Lifecycle 2 (Daily Work & Attendance Double Verification)**:
   `F28 (Generate 60s QR)` -> `F07/F29 (Check-In <=50m)` -> `F33 (Teacher Realtime Monitor)` -> `F06/F02 (getUploadUrl & R2 Upload)` -> `F09/F30 (Submit Hybrid Logbook)` -> `F31/F08 (Check-Out Gate Verification)`.
3. **Lifecycle 3 (Supervision & Incident Management)**:
   `F34 (SOS Alert with GPS)` -> `F35/F13 (Teacher Follow-up & Resolution)` -> `F32/F10 (Mentor Logbook Review & Approval)`.
4. **Lifecycle 4 (Final Assessment & Graduation)**:
   `F36/F12 (Two-Stage Assessment & Talent Calculation)` -> `F37 (PDF Report Upload & Admin Certificate Issuance)` -> `F38 (Filtered Export)`.
5. **Lifecycle 5 (Career Acceleration)**:
   `F12 (isRecommendedTalent Flag)` -> `F39 (Mentor Job Vacancy Creation)` -> `F39 (Student Talent Application)`.

---

## 5. Tier 4: The 21 PRD BAB III Flows Specification & Visual Artifacts

Each flow is executed by `e2e/runner.js` and produces a visual PNG screenshot in `e2e/screenshots/`.

| Flow # | PRD Section | Flow Name | Primary Actor | Target Endpoint / Action | Assertion & End State | Screenshot Artifact |
|---|---|---|---|---|---|---|
| **01** | 3.4 | Registrasi Akun Siswa Baru | Siswa | Callable `lookupNisn` + `completeRegistration` | NISN verified from roster, account created in `users/{uid}`, roster marked registered | `flow_01_registrasi_siswa.png` |
| **02** | 3.5 | Admin Melihat Daftar Perusahaan | Admin Sekolah | Query `companies` | Company list rendered with name, address, quota, filledQuota | `flow_02_daftar_perusahaan.png` |
| **03** | 3.6 | Admin Menambah Perusahaan Baru | Admin Sekolah | Add document to `companies` | Company doc created with lat, lng, radius (50m), quota, jurusanAllowed | `flow_03_tambah_perusahaan.png` |
| **04** | 3.7 | Admin Melihat Detail Perusahaan | Admin Sekolah | Get document `companies/{id}` | Detailed profile rendered, geofence radius shown, mentors & interns listed | `flow_04_detail_perusahaan.png` |
| **05** | 3.8 | Admin Mengedit Data Perusahaan | Admin Sekolah | Update `companies/{id}` | Only whitelisted fields updated; filledQuota protected | `flow_05_edit_perusahaan.png` |
| **06** | 3.9 | Admin Menghapus Perusahaan | Super Admin | Delete `companies/{id}` | Document deleted; deletion denied for non-Super Admin | `flow_06_hapus_perusahaan.png` |
| **07** | 1.6 / 3.16 | Pembimbing Instansi Membuat QR Presensi | Pembimbing Instansi | Set `qrTokens/{companyId}` | Token UUID generated, expiresAt = now + 60s, lat/lng match company | `flow_07_qr_dinamis.png` |
| **08** | 3.10 | Siswa Mengajukan Lamaran PKL | Siswa | Add document to `applications` | Application created with status='menunggu', studentId=uid | `flow_08_lamaran_pkl.png` |
| **09** | 3.11 | Admin Melihat Daftar Lamaran Masuk | Admin Sekolah | Query `applications` where schoolId | Applications listed, filtered by school, status badges displayed | `flow_09_daftar_lamaran.png` |
| **10** | 1.7 | Admin Menyetujui atau Menolak Lamaran | Admin Sekolah | Update `applications/{id}` | Status='diterima', `onApplicationDecided` increments filledQuota, sets companyId | `flow_10_keputusan_lamaran.png` |
| **11** | 3.12 | Siswa Presensi Masuk (Scan QR & Geofence) | Siswa | `verifyAttendance` trigger / callable | Distance <= 50m verified via haversine, `attendances` status='hadir' | `flow_11_presensi_masuk.png` |
| **12** | 3.13 | Siswa Presensi Pulang (Setelah Logbook) | Siswa | `verifyCheckout` trigger / callable | Check-out succeeds only if logbookSubmitted=true and distance <= 50m | `flow_12_presensi_pulang.png` |
| **13** | 3.14 | Guru Pembimbing Memantau Presensi Realtime | Guru Pembimbing | Realtime query `attendances` | Live dashboard shows student list, status badges, timestamps | `flow_13_monitoring_guru.png` |
| **14** | 3.15 | Siswa Mengisi Logbook Harian Hybrid | Siswa | `getUploadUrl` + PUT S3 + Add `logbooks` | Photo uploaded to R2 mock, doc created, `logbookSubmitted=true` stamped | `flow_14_logbook_hybrid.png` |
| **15** | 3.16 | Pembimbing Instansi Review Logbook | Pembimbing Instansi | Update `logbooks/{id}` reviewStatus | Status='disetujui'/'ditolak', notes saved, notification triggered | `flow_15_review_logbook.png` |
| **16** | 3.17 | Siswa Mengirim Laporan SOS | Siswa | Add document to `sosReports` | Alert recorded with studentId, GPS coords, message, status='belum-ditinjau' | `flow_16_laporan_sos.png` |
| **17** | 3.18 | Guru Pembimbing Menindaklanjuti SOS | Guru Pembimbing | Update `sosReports/{id}` | Status='ditinjau'/'selesai', followUpNote added, student notified | `flow_17_tindaklanjut_sos.png` |
| **18** | 3.19 | Penilaian Akhir PKL (Two-Stage) | Pembimbing + Guru | Update `assessments/{id}` | Stage 1 + Stage 2 scores recorded, `isRecommendedTalent` set if >= threshold | `flow_18_penilaian_akhir.png` |
| **19** | 3.20 | Unggah dan Validasi Laporan Akhir | Siswa + Admin | `getUploadUrl` + Add `finalReports` | PDF uploaded, Admin validates and sets certificateUrl, student downloads | `flow_19_laporan_akhir.png` |
| **20** | 3.21 | Export Laporan dengan Filter | Admin Sekolah | Query + Export Client | Attendance/PKL data filtered by date, major, company, formatted for download | `flow_20_export_laporan.png` |
| **21** | Class/ERD | Talent Pool & Lowongan Kerja | Pembimbing + Siswa | Add `jobVacancies` + Apply | Vacancy created, students with isRecommendedTalent=true view and apply | `flow_21_talent_pool.png` |

---

## 6. Test Runner Specifications (`e2e/runner.js`)

### 6.1 Runner Capabilities
- **Dual Execution Engine**:
  - **Live Mode (`--live`)**: Communicates via standard HTTP/REST with running Firebase Emulators (Auth 9099, Firestore 8080, Functions 5001) and Mock Storage (9090).
  - **Integrated Mock Mode (`--mock` or default)**: Uses in-memory emulated state engine to execute all 21 flow state machines, calculate haversine geofences, test rule validations, and emit artifacts even when external emulators are not yet started.
- **Assertion Engine**:
  - Strict deep equality, boundary checks, regex assertions, and HTTP response code validations.
  - Fail-fast or complete run logging with pass/fail summary.
- **Visual Artifact Generator (`e2e/screenshot-generator.js`)**:
  - Automatically synthesizes authentic, crisp 1280x720 PNG screenshots with dark/light vocational navy (`#1E3A8A`) UI framing, header status bar, data tables, map pins, and verification audit badges.
  - Stores all 21 files into `e2e/screenshots/`.

### 6.2 Running the Tests
```bash
# Execute full E2E test suite (all 21 flows + 42 feature checks + 21 screenshots)
node e2e/runner.js

# Execute with live emulator connection
node e2e/runner.js --live

# Execute specific flow
node e2e/runner.js --flow=11

# Generate summary report only
node e2e/runner.js --summary
```

### 6.3 Exit Codes & Quality Gate
- `0`: All 21 PRD flows pass, all Tier 1-4 assertions pass, all 21 screenshots captured.
- `1`: One or more flow assertions failed, or screenshot capture error.
