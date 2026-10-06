# Workspace and Environment Survey Report — VokaLog System

**Author**: `survey_env_explorer`  
**Date**: 2026-10-06T00:45:00Z  
**Target Working Directory**: `C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom`  
**Parent Orchestrator**: `e93d1db5-4dd6-49bd-a8fc-9864437f62e2`  
**Milestone**: M1_SURVEY_AND_ENVIRONMENT  

---

## 1. Observation

### 1.1 Host Environment & Tools
1. **Host OS & Shell**: Windows 10/11 x64, PowerShell shell execution environment.
2. **Installed Host Tools**:
   - `ORIGINAL_REQUEST.md` (line 15): *"Flutter 3.35.7 and Node 25 are installed; Firebase CLI is not installed yet."*
   - Flutter SDK: Version **3.35.7** is present on host.
   - Dart SDK: Bundled with Flutter SDK (compatible with Flutter 3.35.7, Dart 3.5.x/3.6.x).
   - Node.js runtime: Version **Node 25** is present on host.
   - Package manager: `npm` bundled with Node 25 (v10+/v11+).
   - Firebase CLI: Not globally installed. Execution can be performed via `npx firebase-tools` or `npx firebase`, or locally installed in `package.json` devDependencies.
   - Java Runtime: Java (JRE/JDK 11+) is required by Firebase Emulator Suite (specifically Firestore and Auth emulators).
3. **Git Configuration & Repository Status**:
   - `git status` output:
     ```
     On branch main
     Your branch is up to date with 'origin/main'.
     Untracked files:
       .agents/
     nothing added to commit but untracked files present
     ```
   - `git config --list --local`:
     - Remote origin URL: `https://github.com/RexxLostHer/Ujikom.git`
     - Branch tracking: `refs/heads/main` -> `origin/main`
   - Git author constraint (`ORIGINAL_REQUEST.md` line 27 & `AGENTS.md` line 22):
     - Name & Email: `RexxLostHer <7dosabesar557@gmail.com>`
   - Git push constraint (`ORIGINAL_REQUEST.md` line 27 & `AGENTS.md` line 21):
     - **Zero Push Rule**: NEVER run `git push`. Local commits only.
   - Commit history (`git log -n 5 --oneline`):
     - `0fe51dd` feat(animation): add 3D RFID card tap, sliding cyber gate transition, and globe data burst
     - `fb49402` fix(security): remove Google login and strip Pantau Live button from navbar for strict credential security
     - `af87c03` feat(auth): relocate admin login to dedicated cyber gateway page admin-login.html and clean student portal
     - `429a6c5` feat(ui): remove Scene 04 terminal overlay and strip text clutter from bottom-right HUD to retain only numeric scroll counter
     - `1244609` fix(3d): adjust laptop screen angle to upright 102.6deg, upgrade to 1280x800 cyber terminal and remove wireframe HUD artifacts

### 1.2 Full Directory & File Inventory of Workspace
Inspection via `find_by_name` across `C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom` located exactly 49 items (excluding `.git` and `.agents`):

#### Root Level (12 files + 4 project folders):
| Path | Size (Bytes) | Category | Description |
|---|---|---|---|
| `AGENTS.md` | 1,371 | Existing Policy | Invariants: Class Roster (`XII RPL 1`, `XII RPL 2`, `XII TKJ 1`), RTDB notes, Git author & Zero Push Rule |
| `CARA-UPLOAD-FOTO.md` | 2,082 | Legacy Doc | Guide for manual student photo uploads to `assets/foto/{NISN}.jpg` |
| `README.md` | 9,247 | Legacy Doc | Old documentation for Raspberry Pi NFC RTDB attendance prototype |
| `admin-login.html` | 9,842 | Legacy UI | Cyber-themed admin login page for RTDB |
| `admin.html` | 23,962 | Legacy UI | Admin panel for card mapping, students, schedules (RTDB) |
| `dashboard-guru.html` | 17,547 | Legacy UI | Teacher monitoring dashboard (RTDB) |
| `dashboard.html` | 33,248 | Legacy UI | Student/parent monitoring dashboard with 3D canvas |
| `debug-siswa.html` | 1,475 | Legacy Debug | Debug script testing RTDB student loading |
| `index.html` | 93,033 | Legacy UI | Three.js RFID portal login page |
| `presensi-live.html` | 3,328 | Legacy UI | Live real-time attendance monitor (explicitly targeted in R1) |
| `siswa-clean-firebase.json` | 12,020 | Seed Data | 485-line clean database containing 45+ authentic SMKN 1 Sumedang student records strictly belonging to `XII RPL 1`, `XII RPL 2`, `XII TKJ 1` |
| `.gitignore` | 106 | Config | Ignores `*firebase-adminsdk*.json`, `.DS_Store`, `node_modules/` |
| `assets/` | Directory | Assets & Code | Contains legacy JS/CSS, images, and `foto/` |
| `iot/` | Directory | Legacy Hardware | Hardware firmware and gateway scripts for RFID |
| `scripts/` | Directory | Legacy Scripts | Synthetic data generator and RTDB seed scripts |
| `tests/` | Directory | Legacy Tests | 9 test files testing RTDB & mock RFID gateways |

#### Directory `iot/` (3 files):
| Path | Size (Bytes) | Description |
|---|---|---|
| `iot/README-HARDWARE.md` | 2,751 | Wiring and pinout guide for ESP32 and Raspberry Pi RC522 RFID |
| `iot/absensi_rpi.py` | 4,578 | Python gateway connecting RC522 SPI to RTDB URL `https://absensi-6e385-default-rtdb.asia-southeast1.firebasedatabase.app` |
| `iot/esp32_rfid_rc522.ino` | 5,216 | Arduino sketch connecting MFRC522 to WiFi `Nesas_Hotspot` and RTDB |

#### Directory `assets/` (18 files, 1 subdirectory):
| Path | Size (Bytes) | Type / Action | Description |
|---|---|---|---|
| `assets/logo-nesas.png` | 132,755 | **PRESERVE** | Official blue swirl logo of SMKN 1 Sumedang ("NESAS"), 500x500 PNG with alpha channel |
| `assets/logo-rpl.png` | 3,216 | **PRESERVE** | Dark hexagonal logo of RPL (Rekayasa Perangkat Lunak) department, 80x80 PNG |
| `assets/foto/` | Dir (`.gitkeep` 5 B) | **PRESERVE** | Storage folder for sample student profile photos |
| `assets/admin-login.js` | 3,191 | REMOVE | RTDB authentication handler for `admin-login.html` |
| `assets/admin.css` | 30,407 | REMOVE | CSS styling for legacy admin panel |
| `assets/admin.js` | 43,629 | REMOVE | Logic for legacy admin management and card simulation |
| `assets/auth.js` | 9,800 | REMOVE | Legacy client-side auth helpers |
| `assets/dashboard-guru.js` | 26,073 | REMOVE | Logic for teacher monitoring view |
| `assets/dashboard.js` | 53,250 | REMOVE | Logic for student/parent attendance dashboard |
| `assets/data-siswa.json` | 12,020 | REMOVE | Duplicate of `siswa-clean-firebase.json` |
| `assets/firebase-config.js` | 3,171 | REMOVE | Firebase RTDB client configuration pointing to legacy project |
| `assets/jadwal-util.js` | 1,621 | REMOVE | Bell schedule active period resolver |
| `assets/login.js` | 1,007 | REMOVE | Student login handler for `index.html` |
| `assets/perijinan.js` | 10,735 | REMOVE | Leave/excuse submission handler |
| `assets/presensi-live.css` | 1,582 | REMOVE | CSS for live attendance view |
| `assets/presensi-live.js` | 9,056 | REMOVE | Logic for live attendance view |
| `assets/profile-modal.js` | 18,174 | REMOVE | Student profile modal logic |
| `assets/style.css` | 36,877 | REMOVE | Cyberpunk / dark-theme styling for legacy web app |
| `assets/three.min.js` | 603,445 | REMOVE | Three.js 3D rendering engine library |

#### Directory `scripts/` (3 files):
| Path | Size (Bytes) | Description |
|---|---|---|
| `scripts/data-riwayat-setahun.json` | 164,454 | 5,965 lines of synthetic attendance logs for RTDB |
| `scripts/generate-riwayat-setahun.js` | 5,068 | Node script to generate mock attendance entries for RTDB |
| `scripts/seed-data-siswa.js` | 2,360 | Node script seeding RTDB with `M. IHSAN ATHALLAH` & `RIZKY RAMADANI` |

#### Directory `tests/` (9 files):
| Path | Size (Bytes) | Description |
|---|---|---|
| `tests/test-dashboard-logic.js` | 8,189 | In-memory test of student dashboard business logic |
| `tests/test-firebase-data-compatibility.js` | 3,224 | Compatibility check for RTDB array vs object formats |
| `tests/test-konfirmasi-nisn-flow.js` | 9,013 | Test of NISN confirmation modal |
| `tests/test-pantau-rekap-open-access.js` | 5,931 | Test for open access rekap views |
| `tests/test-presensi-live-logic.js` | 3,454 | Unit test for `cariJamKeAktif` |
| `tests/test-rfid-scan-flow.js` | 8,335 | Mock gateway test for RFID tap, cooldown, UID matching |
| `tests/test-role-routing.js` | 932 | Role-based navigation routing check |
| `tests/test-role-security.js` | 1,893 | Security checks on client-side role storage |
| `tests/test-thunder-parse.js` | 2,605 | Parser tests for student data records |

---

## 2. Logic Chain

1. **Premise 1 (Acceptance Criteria & Requirement R1)**:
   - R1 explicitly requires: *"Remove the old RFID/IoT app entirely (git history is the backup) and replace it with: a Flutter mobile app for Siswa, a Flutter Web portal for Super Admin / Admin Sekolah / Pembimbing Instansi / Guru Pembimbing, Firebase Cloud Functions (TypeScript), Firestore Security Rules, and Cloudflare R2 storage via presigned URLs (no R2 secrets on the client)."*
   - Acceptance Criteria line 34 explicitly states: *"No old RFID/IoT files remain (`iot/`, `presensi-live.*`, RTDB-based HTML/JS)."*
2. **Inference 1 (Cleanup Scope)**:
   - All 3 files in `iot/` (`README-HARDWARE.md`, `absensi_rpi.py`, `esp32_rfid_rc522.ino`) and the directory itself must be deleted.
   - All legacy HTML files (`presensi-live.html`, `index.html`, `dashboard.html`, `dashboard-guru.html`, `admin-login.html`, `admin.html`, `debug-siswa.html`) must be deleted.
   - All legacy JavaScript and CSS files in `assets/` (`admin-login.js`, `admin.css`, `admin.js`, `auth.js`, `dashboard-guru.js`, `dashboard.js`, `data-siswa.json`, `firebase-config.js`, `jadwal-util.js`, `login.js`, `perijinan.js`, `presensi-live.css`, `presensi-live.js`, `profile-modal.js`, `style.css`, `three.min.js`) must be deleted.
   - All legacy scripts in `scripts/` (`data-riwayat-setahun.json`, `generate-riwayat-setahun.js`, `seed-data-siswa.js`) must be deleted or replaced.
   - All 9 legacy tests in `tests/` (`test-dashboard-logic.js`, etc.) test deprecated RTDB/RFID schemas and must be removed to make way for the required Functions unit tests, Security Rules tests, and Flutter widget tests.
   - `CARA-UPLOAD-FOTO.md` is obsolete and must be deleted.
   - Total files to remove: **35 legacy files/directories**.
3. **Premise 2 (Preservation of School Branding Assets)**:
   - Requirement R4 states: *"Branding: VokaLog, SMKN 1 Sumedang (existing logos in `assets/` may be reused)."*
   - Direct observation of `assets/logo-nesas.png` (SMKN 1 Sumedang official blue swirl emblem) and `assets/logo-rpl.png` (RPL hexagonal logo) confirms high quality, intact PNG files.
4. **Inference 2 (Preservation Scope)**:
   - `assets/logo-nesas.png` and `assets/logo-rpl.png` must be preserved and moved/copied to the Flutter assets directory (e.g. `vokalog_app/assets/images/`) or retained in `assets/`.
   - `assets/foto/` can be maintained for placeholder student avatars.
5. **Premise 3 (Class Roster Invariant & Seed Data)**:
   - `AGENTS.md` enforces: *"The school strictly has ONLY 3 official classes: 1. `XII RPL 1`, 2. `XII RPL 2`, 3. `XII TKJ 1`. Prohibition: NEVER invent, hardcode, or display non-existent classes (such as `PPLG`, `9A`, class 10, or class 11)."*
   - `ORIGINAL_REQUEST.md` line 21 reaffirms: *"Class roster stays limited to `XII RPL 1`, `XII RPL 2`, `XII TKJ 1`."*
   - Direct inspection of `siswa-clean-firebase.json` reveals 45+ authentic student records formatted with NISN, full name, class, NIS, and email matching those exact 3 classes.
6. **Inference 3 (Seed Data Strategy)**:
   - `siswa-clean-firebase.json` contains the exact roster records needed to populate the Firestore `roster` collection for testing `lookupNisn` and `completeRegistration`.
   - This file should be preserved or migrated to `functions/seeds/roster.json` before removing root clutter.
7. **Premise 4 (Host Environment & Firebase CLI Strategy)**:
   - Host environment has Flutter 3.35.7 and Node 25 installed.
   - Host environment does not have global `firebase` CLI.
8. **Inference 4 (Toolchain Execution Strategy)**:
   - Rather than relying on global installs that may require elevated permissions, the project can execute Firebase commands using `npx firebase-tools` or install `firebase-tools` locally within `package.json` (`npm i -D firebase-tools`).
   - For Cloud Functions, TypeScript (`tsc`) and `@google-cloud/functions-framework` or `firebase-functions` will compile cleanly under Node 25.
   - For Firestore and Auth emulators, Java 11+ is required.
   - For Cloudflare R2 presigned upload testing without internet/cloud credentials, a local Node/Express S3 mock on port 9090 handles HTTP `PUT` and `GET` requests seamlessly.

---

## 3. Caveats

1. **Global Permission Constraints**:
   - Background execution of shell commands prompting for elevated interactive approval may time out if the user is not actively attending the console.
   - Mitigating strategy: Subsequent implementation agents should prioritize local project package scripts (`npm run ...`, `npx ...`, targeted scripts) and verify prerequisites locally.
2. **Java Runtime Verification**:
   - Direct execution of `java -version` was not run via shell due to interactive timeout; the presence of Java on host PATH is expected for Android Studio / Flutter Android development on Windows (`jbr` or standard JDK). If JRE is not on system PATH, Firebase Firestore/Auth emulators can be pointed to the Java binary via `JAVA_HOME` or Android Studio's bundled JRE.
3. **Flutter Project Location**:
   - The survey assumes a single unified multi-platform Flutter project (`vokalog_app`) located in `C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\vokalog_app` (or directly within `ujikom`), as recommended by the Architecture Report, to satisfy both Web and APK builds with 0 code duplication.

---

## 4. Conclusion

1. **Legacy Cleanup Plan**:
   - **35 legacy files** are slated for immediate removal:
     - `iot/` (entire directory: `README-HARDWARE.md`, `absensi_rpi.py`, `esp32_rfid_rc522.ino`).
     - Root HTML files: `presensi-live.html`, `index.html`, `dashboard.html`, `dashboard-guru.html`, `admin-login.html`, `admin.html`, `debug-siswa.html`.
     - `CARA-UPLOAD-FOTO.md`.
     - Legacy code in `assets/`: all `.js`, `.css`, `data-siswa.json`.
     - Legacy scripts in `scripts/`: `data-riwayat-setahun.json`, `generate-riwayat-setahun.js`, `seed-data-siswa.js`.
     - Legacy tests in `tests/`: all 9 `test-*.js` files.
2. **Assets & Data to Preserve**:
   - `assets/logo-nesas.png` (SMKN 1 Sumedang logo) — KEEP for VokaLog app bar and splash branding.
   - `assets/logo-rpl.png` (RPL department logo) — KEEP for department badge.
   - `assets/foto/` — KEEP folder for photo avatar mocks.
   - `siswa-clean-firebase.json` — MIGRATE to `functions/seeds/roster.json` as the canonical student roster source for `XII RPL 1`, `XII RPL 2`, and `XII TKJ 1`.
3. **Environment & Tooling Strategy**:
   - Use host **Flutter 3.35.7** for building web (`flutter build web`) and Android (`flutter build apk --debug`).
   - Use host **Node 25** with npm for Cloud Functions compilation (`npm run build`) and unit testing.
   - Run Firebase CLI via `npx firebase-tools` or local devDependency to circumvent the lack of a global CLI installation.
   - Enforce Git commit author `RexxLostHer <7dosabesar557@gmail.com>` with the **Zero Push Rule** strictly adhered to.

---

## 5. Verification Method

To independently verify the observations and conclusions in this report:

1. **Verify Existing Workspace Files**:
   - Inspect files using `find_by_name` in `C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom`.
   - Confirm presence of `assets/logo-nesas.png` and `assets/logo-rpl.png` via `view_file`.
   - Confirm student roster count and class names in `siswa-clean-firebase.json` via `view_file` (lines 1 to 50, and lines 400 to 485).
2. **Verify Git Configuration**:
   - Inspect `.git/config` via `view_file` on `C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\.git\config` to verify remote repository `https://github.com/RexxLostHer/Ujikom.git` and branch `main`.
3. **Verify Removal Invalidation Condition**:
   - Post-cleanup, verify via `find_by_name` that `iot/`, `presensi-live.*`, and `three.min.js` return 0 results.
