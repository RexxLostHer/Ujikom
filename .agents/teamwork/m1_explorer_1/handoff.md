# Handoff Report: M1 Backend Infrastructure Implementation Plan

**Author**: `m1_explorer_1`  
**Date**: 2026-10-06T00:58:00Z  
**Target Directory**: `C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\.agents\teamwork\m1_explorer_1`  
**Parent Orchestrator**: `e93d1db5-4dd6-49bd-a8fc-9864437f62e2`  
**Milestone**: M1 Backend Infrastructure Foundation  

---

## 1. Observation

### 1.1 Direct Workspace Observations
1. **Legacy Workspace Contents**:
   Inspection via `find_by_name` in `C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom` located 49 items (excluding `.git` and `.agents`).
   - Directory `iot/` contains 3 hardware gateway files:
     - `iot/README-HARDWARE.md` (2,751 bytes)
     - `iot/absensi_rpi.py` (4,578 bytes - connects RC522 SPI to legacy RTDB)
     - `iot/esp32_rfid_rc522.ino` (5,216 bytes - Arduino sketch for RC522)
   - Root legacy UI and documentation:
     - `CARA-UPLOAD-FOTO.md` (2,085 bytes)
     - `admin-login.html` (9,842 bytes)
     - `admin.html` (23,962 bytes)
     - `dashboard-guru.html` (17,547 bytes)
     - `dashboard.html` (33,248 bytes)
     - `debug-siswa.html` (1,475 bytes)
     - `index.html` (93,033 bytes)
     - `presensi-live.html` (3,328 bytes - explicitly targeted for removal in `ORIGINAL_REQUEST.md` R1)
   - Directory `assets/` contains 18 items:
     - `assets/logo-nesas.png` (132,755 bytes - 500x500 official SMKN 1 Sumedang logo with alpha transparency)
     - `assets/logo-rpl.png` (3,216 bytes - 80x80 hexagonal RPL department logo)
     - `assets/foto/.gitkeep` (5 bytes)
     - 15 legacy scripts and styling files: `admin-login.js`, `admin.css`, `admin.js`, `auth.js`, `dashboard-guru.js`, `dashboard.js`, `data-siswa.json`, `firebase-config.js`, `jadwal-util.js`, `login.js`, `perijinan.js`, `presensi-live.css`, `presensi-live.js`, `profile-modal.js`, `style.css`, `three.min.js` (603,445 bytes).
   - Directory `scripts/` contains 3 synthetic RTDB generators:
     - `scripts/data-riwayat-setahun.json` (164,454 bytes)
     - `scripts/generate-riwayat-setahun.js` (5,068 bytes)
     - `scripts/seed-data-siswa.js` (2,360 bytes)
   - Directory `tests/` contains 9 deprecated RTDB unit tests:
     - `tests/test-dashboard-logic.js`, `tests/test-firebase-data-compatibility.js`, `tests/test-konfirmasi-nisn-flow.js`, `tests/test-pantau-rekap-open-access.js`, `tests/test-presensi-live-logic.js`, `tests/test-rfid-scan-flow.js`, `tests/test-role-routing.js`, `tests/test-role-security.js`, `tests/test-thunder-parse.js`.
   - Root Data:
     - `siswa-clean-firebase.json` (12,020 bytes, 485 lines). Direct inspection confirmed 45+ authentic student records, strictly partitioned across classes `XII RPL 1`, `XII RPL 2`, and `XII TKJ 1`. Included among them is `0087121894` (LUTHFI NUR ZAIDAN, `XII RPL 2`, author of the PRD document).

2. **Project Policy & Invariants**:
   - `AGENTS.md` (root, lines 3-9):
     > "The school strictly has ONLY 3 official classes: 1. `XII RPL 1`, 2. `XII RPL 2`, 3. `XII TKJ 1`. Prohibition: NEVER invent, hardcode, or display non-existent classes (such as `PPLG`, `9A`, class 10, or class 11)."
   - `AGENTS.md` (root, lines 21-22):
     > "Zero Push Rule: NEVER run `git push`. Local commits only. Git Author: `RexxLostHer <7dosabesar557@gmail.com>`."
   - `PROJECT.md` (lines 20-25):
     > "Local mock server (`mock-storage/server.js`) on port 9090 providing local S3-compatible endpoints during emulator testing."
     > "Firebase Emulator Suite (`firebase.json`): Auth (9099), Firestore (8080), Functions (5001), UI (4000)."
   - `PROJECT.md` (lines 84-88):
     > "Storage Mock (http://127.0.0.1:9090):  
     > PUT /:bucket/:key: Binary upload via presigned URL with Content-Type. Returns HTTP 200.  
     > GET /:bucket/:key: Public read serving raw bytes with proper MIME type.  
     > OPTIONS /:bucket/:key: CORS preflight allowing PUT, GET, HEAD, OPTIONS from *."

3. **PRD Bab III Domain Entities & Contracts**:
   - `prd.txt` (line 152, 160) specifies 17 Firestore entities:
     `SchoolDoc`, `UserDoc`, `CompanyDoc`, `ApplicationDoc`, `AttendanceDoc`, `LogbookDoc`, `AssessmentDoc`, `QrTokenDoc`, `SosReportDoc`, `VisitDoc`, `NotificationDoc`, `JobVacancyDoc`, `JobApplicationDoc`, `FinalReportDoc`, plus `roster`, `majors`, and `academicYears`.
   - Actors: Super Admin, Admin Sekolah (Hubin), Pembimbing Instansi (Supervisor), Guru Pembimbing (Teacher), Siswa (Student).
   - Quota tracking: Companies have `quota` and `filledQuota`.
   - Geofencing: Haversine distance limit is strictly `<= 50` meters.
   - Dynamic QR: Expires in `60` seconds (`now + 60s`).
   - Talent threshold: Stored on school document (e.g. `talentThreshold: 85`).

---

## 2. Logic Chain

1. **Premise 1 (Legacy Separation vs Asset Safeguarding)**:
   - Observation 1.1 reveals that `assets/logo-nesas.png` and `assets/logo-rpl.png` exist alongside 16 legacy RTDB scripts and styles in `assets/`.
   - Moving or deleting `assets/` wholesale would destroy the school's official logos required for the Flutter UI (`ORIGINAL_REQUEST.md` R4).
   - `siswa-clean-firebase.json` is the sole authentic source of SMKN 1 Sumedang student records. Deleting it prior to copying it to `seed/roster-data.json` would cause irrecoverable loss of student seed data.
   - Therefore, the cleanup sequence must:
     a) Create `seed/` directory and copy `siswa-clean-firebase.json` to `seed/roster-data.json`.
     b) Remove `iot/`, `scripts/`, `tests/` directories.
     c) Delete root legacy HTML and MD files.
     d) Selectively remove legacy JS/CSS files from `assets/`, while retaining `assets/logo-nesas.png`, `assets/logo-rpl.png`, and `assets/foto/`.
     e) Remove root `siswa-clean-firebase.json` after successful verification of `seed/roster-data.json`.

2. **Premise 2 (Zero Cloud Credentials & Emulator Topology)**:
   - `ORIGINAL_REQUEST.md` R3 states that the application must run locally without cloud credentials.
   - Firebase CLI is not installed globally on the host. Local package scripts executing `npx firebase-tools` or local `firebase-tools` dependency must be used.
   - To prevent port contention and ensure compatibility across Web browser, desktop, and mobile emulators, `firebase.json` must bind Auth (9099), Firestore (8080), Functions (5001), and UI (4000) to host `0.0.0.0` (or `127.0.0.1`).
   - A `.firebaserc` file setting project ID to `vokalog-smkn1sumedang` prevents interactive project selection prompts.
   - Root `package.json` must orchestrate all local submodules: starting emulators, launching mock storage, running seeds, running rules tests, and running Functions unit tests.

3. **Premise 3 (Local S3/R2 Storage Mock)**:
   - Cloud Functions callable `getUploadUrl` generates presigned PUT URLs for hybrid logbook photos and final PDF reports (`PROJECT.md` line 92).
   - In emulator mode, `getUploadUrl` generates endpoints targeting `http://127.0.0.1:9090/{bucket}/{key}`.
   - The mock storage server must accept binary streaming `PUT` requests with arbitrary query parameters (e.g. `?X-Amz-...` or `?mock=true`), store raw bytes to `mock-storage/uploads/:bucket/:key`, record content type headers in `.meta.json`, and serve them back over `GET` with exact `Content-Type` headers and open CORS (`Access-Control-Allow-Origin: *`).

4. **Premise 4 (Seed Pipeline & Roster Invariant)**:
   - `AGENTS.md` strictly restricts classes to `XII RPL 1`, `XII RPL 2`, and `XII TKJ 1`.
   - `seed/seed.js` using `firebase-admin` must target the emulator suite via `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080` and `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`.
   - It must create Auth accounts AND Firestore documents for all 5 roles with known credentials (`Password123!`), populate the SMKN 1 Sumedang school entity, seed majors `RPL` and `TKJ`, load all 45+ students into the `roster` collection, and seed 3 partner companies (`PT Telkom Indonesia Witel Sumedang`, `PT Inovasi Digital Nusantara`, `PT Jaringan Fiber Pasundan`) with real geofence coordinates and quota limits.
   - It must be completely idempotent: re-running `npm run seed` updates existing records without duplication or errors.

---

## 3. Caveats

1. **Java Runtime Dependency**: Firebase Firestore and Auth emulators require Java 11+ on the host system. If Java is not on PATH, the emulator runner may fail until `JAVA_HOME` is pointed to the Java executable (e.g., from Android Studio / Flutter JRE).
2. **Interactive Shell Execution**: On Windows PowerShell, background terminal commands requiring interactive user permissions may time out if unattended. Implementation commands should be structured as clean, non-interactive scripts.
3. **Flutter Asset Location**: The logos in `assets/logo-nesas.png` and `assets/logo-rpl.png` will also need to be referenced in `vokalog_app/pubspec.yaml` during Milestone M2. Keeping them preserved in root `assets/` allows copying or direct referencing.

---

## 4. Conclusion & Concrete Implementation Blueprints

The implementation for M1 Backend Infrastructure consists of four concrete deliverables:

### Deliverable 1: Workspace Cleanup Execution Blueprint

#### Legacy Removal Target Inventory (35 Files/Directories):
- Directories: `iot/` (3 files), `scripts/` (3 files), `tests/` (9 files)
- Root HTML/MD: `CARA-UPLOAD-FOTO.md`, `admin-login.html`, `admin.html`, `dashboard-guru.html`, `dashboard.html`, `debug-siswa.html`, `index.html`, `presensi-live.html` (8 files)
- Assets code files: `assets/admin-login.js`, `assets/admin.css`, `assets/admin.js`, `assets/auth.js`, `assets/dashboard-guru.js`, `assets/dashboard.js`, `assets/data-siswa.json`, `assets/firebase-config.js`, `assets/jadwal-util.js`, `assets/login.js`, `assets/perijinan.js`, `assets/presensi-live.css`, `assets/presensi-live.js`, `assets/profile-modal.js`, `assets/style.css`, `assets/three.min.js` (16 files)
- Data Migration: `siswa-clean-firebase.json` -> copied to `seed/roster-data.json`, then root source removed.

#### Safeguarded Assets:
- `assets/logo-nesas.png` (MUST REMAIN INTACT)
- `assets/logo-rpl.png` (MUST REMAIN INTACT)
- `assets/foto/` (MUST REMAIN INTACT)

#### Proposed PowerShell Execution Script:
```powershell
# 1. Ensure seed directory exists
New-Item -ItemType Directory -Force -Path "seed"

# 2. Migrate student roster to canonical seed location
Copy-Item -Force "siswa-clean-firebase.json" "seed/roster-data.json"

# 3. Remove legacy directories
Remove-Item -Recurse -Force "iot", "scripts", "tests"

# 4. Remove legacy root HTML and doc files
Remove-Item -Force "CARA-UPLOAD-FOTO.md", "admin-login.html", "admin.html", "dashboard-guru.html", "dashboard.html", "debug-siswa.html", "index.html", "presensi-live.html", "siswa-clean-firebase.json"

# 5. Remove legacy assets while strictly preserving logos and foto directory
$legacyAssets = @(
    "assets/admin-login.js", "assets/admin.css", "assets/admin.js", "assets/auth.js",
    "assets/dashboard-guru.js", "assets/dashboard.js", "assets/data-siswa.json",
    "assets/firebase-config.js", "assets/jadwal-util.js", "assets/login.js",
    "assets/perijinan.js", "assets/presensi-live.css", "assets/presensi-live.js",
    "assets/profile-modal.js", "assets/style.css", "assets/three.min.js"
)
foreach ($file in $legacyAssets) {
    if (Test-Path $file) { Remove-Item -Force $file }
}
```

---

### Deliverable 2: Root Configuration & Emulator Infrastructure

#### 1. `.firebaserc`
Target path: `C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\.firebaserc`
```json
{
  "projects": {
    "default": "vokalog-smkn1sumedang"
  }
}
```

#### 2. `firebase.json`
Target path: `C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\firebase.json`
```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "functions": [
    {
      "source": "functions",
      "codebase": "default",
      "ignore": [
        "node_modules",
        ".git",
        "firebase-debug.log",
        "firebase-debug.*.log",
        "*.local"
      ]
    }
  ],
  "emulators": {
    "auth": {
      "port": 9099,
      "host": "0.0.0.0"
    },
    "firestore": {
      "port": 8080,
      "host": "0.0.0.0"
    },
    "functions": {
      "port": 5001,
      "host": "0.0.0.0"
    },
    "ui": {
      "enabled": true,
      "port": 4000,
      "host": "0.0.0.0"
    },
    "singleProjectMode": true
  }
}
```

#### 3. `firestore.indexes.json`
Target path: `C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\firestore.indexes.json`
```json
{
  "indexes": [],
  "fieldOverrides": []
}
```

#### 4. Initial `firestore.rules` (Baseline Skeleton)
Target path: `C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\firestore.rules`
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function getUserData() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }
    
    function isSuperAdmin() {
      return isAuthenticated() && (
        request.auth.token.role == 'superadmin' ||
        (request.auth.token.role == 'admin' && (!('schoolId' in request.auth.token) || request.auth.token.schoolId == null))
      );
    }

    // Default open for local development & rule testing iteration
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

#### 5. Root `package.json`
Target path: `C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\package.json`
```json
{
  "name": "vokalog-root",
  "version": "1.0.0",
  "description": "VokaLog PKL Attendance & Hybrid Logbook Platform for SMKN 1 Sumedang",
  "private": true,
  "scripts": {
    "emulators": "npx firebase emulators:start --project vokalog-smkn1sumedang",
    "emulators:export": "npx firebase emulators:export ./seed/emulator-export",
    "mock:storage": "node mock-storage/server.js",
    "seed": "node seed/seed.js",
    "test:rules": "npm --prefix rules-tests test",
    "test:functions": "npm --prefix functions test",
    "test:e2e": "node e2e/runner.js",
    "build:functions": "npm --prefix functions run build",
    "lint:functions": "npm --prefix functions run lint"
  },
  "dependencies": {
    "express": "^4.21.2",
    "cors": "^2.8.5",
    "firebase-admin": "^13.1.0"
  },
  "devDependencies": {
    "firebase-tools": "^13.30.0"
  }
}
```

---

### Deliverable 3: `mock-storage/server.js` (Express S3/R2 Mock)

Target path: `C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\mock-storage\server.js`

```javascript
/**
 * VokaLog Local Storage Mock (S3 / Cloudflare R2 Compatible)
 * Port: 9090
 * Supports presigned PUT uploads, public GET downloads, and CORS preflight.
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 9090;
const UPLOAD_ROOT = path.join(__dirname, 'uploads');

// Ensure base upload directory exists
if (!fs.existsSync(UPLOAD_ROOT)) {
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
}

// Global CORS Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD', 'OPTIONS'],
  allowedHeaders: ['*'],
  exposedHeaders: ['ETag', 'Content-Length', 'Content-Type']
}));

// Preflight handler
app.options('*', (req, res) => {
  res.status(200).end();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'vokalog-mock-storage',
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

/**
 * PUT /:bucket/* - Presigned URL Binary Upload
 */
app.put('/:bucket/*', (req, res) => {
  const bucket = req.params.bucket;
  const key = req.params[0];

  if (!bucket || !key) {
    return res.status(400).json({ error: 'Bucket and key are required' });
  }

  const targetPath = path.join(UPLOAD_ROOT, bucket, key);
  const targetDir = path.dirname(targetPath);

  // Prevent directory traversal attacks
  if (!targetPath.startsWith(UPLOAD_ROOT)) {
    return res.status(403).json({ error: 'Access denied: invalid file path' });
  }

  try {
    fs.mkdirSync(targetDir, { recursive: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create storage directory', details: err.message });
  }

  const writeStream = fs.createWriteStream(targetPath);
  let totalBytes = 0;

  req.on('data', (chunk) => {
    totalBytes += chunk.length;
  });

  req.pipe(writeStream);

  writeStream.on('finish', () => {
    // Record metadata (content-type, upload timestamp, size)
    const contentType = req.headers['content-type'] || 'application/octet-stream';
    const metaPath = targetPath + '.meta.json';
    const metadata = {
      bucket,
      key,
      contentType,
      size: totalBytes,
      uploadedAt: new Date().toISOString()
    };

    try {
      fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2));
    } catch (e) {
      console.warn(`[MockStorage] Failed to write meta file for ${key}:`, e.message);
    }

    const etag = `"${Buffer.from(`${bucket}-${key}-${totalBytes}`).toString('hex')}"`;
    res.setHeader('ETag', etag);
    res.status(200).json({
      success: true,
      bucket,
      key,
      size: totalBytes,
      contentType
    });
  });

  writeStream.on('error', (err) => {
    res.status(500).json({ error: 'Write failed', details: err.message });
  });
});

/**
 * GET /:bucket/* - Public Download / Read
 */
app.get('/:bucket/*', (req, res) => {
  const bucket = req.params.bucket;
  const key = req.params[0];

  const targetPath = path.join(UPLOAD_ROOT, bucket, key);

  if (!targetPath.startsWith(UPLOAD_ROOT)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (!fs.existsSync(targetPath)) {
    return res.status(404).json({ error: 'Object not found' });
  }

  // Determine Content-Type from metadata or file extension
  let contentType = 'application/octet-stream';
  const metaPath = targetPath + '.meta.json';

  if (fs.existsSync(metaPath)) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      if (meta.contentType) contentType = meta.contentType;
    } catch (_) {}
  } else {
    const ext = path.extname(key).toLowerCase();
    if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.pdf') contentType = 'application/pdf';
    else if (ext === '.json') contentType = 'application/json';
  }

  res.setHeader('Content-Type', contentType);
  const stream = fs.createReadStream(targetPath);
  stream.pipe(res);
});

/**
 * HEAD /:bucket/* - Header metadata check
 */
app.head('/:bucket/*', (req, res) => {
  const bucket = req.params.bucket;
  const key = req.params[0];
  const targetPath = path.join(UPLOAD_ROOT, bucket, key);

  if (!fs.existsSync(targetPath)) {
    return res.status(404).end();
  }

  const stat = fs.statSync(targetPath);
  res.setHeader('Content-Length', stat.size);
  res.status(200).end();
});

// Start listening
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`[VokaLog] Mock S3/R2 Storage Server listening on port ${PORT}`);
  console.log(`  Upload URL: http://127.0.0.1:${PORT}/:bucket/:key`);
  console.log(`  Storage directory: ${UPLOAD_ROOT}`);
  console.log(`=======================================================`);
});

module.exports = { app, server };
```

---

### Deliverable 4: `seed/seed.js` (Database Seeder)

Target path: `C:\Users\SMKN 1 SMD -WEB TECH\.gemini\antigravity\scratch\ujikom\seed\seed.js`

```javascript
/**
 * VokaLog Local Database Seeder
 * Connects directly to Firebase Emulator Suite (Auth 9099, Firestore 8080)
 * Fully idempotent. Seeds SMKN 1 Sumedang, roster, staff, and DU/DI companies.
 */

// Force emulator environment variables
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'vokalog-smkn1sumedang';

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin (no credentials required against local emulators)
if (!admin.apps.length) {
  admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
}

const db = admin.firestore();
const auth = admin.auth();

const SCHOOL_ID = 'smkn1sumedang';

// Helper to upsert auth user idempotently
async function upsertAuthUser({ uid, email, password, displayName }) {
  try {
    return await auth.createUser({ uid, email, password, displayName });
  } catch (error) {
    if (error.code === 'auth/uid-already-exists' || error.code === 'auth/email-already-exists') {
      return await auth.updateUser(uid, { email, password, displayName });
    }
    throw error;
  }
}

async function runSeed() {
  console.log(`[Seed] Starting VokaLog database seeding...`);
  console.log(`  Firestore: ${process.env.FIRESTORE_EMULATOR_HOST}`);
  console.log(`  Auth:      ${process.env.FIREBASE_AUTH_EMULATOR_HOST}`);
  console.log(`  Project:   ${process.env.GCLOUD_PROJECT}\n`);

  const now = admin.firestore.Timestamp.now();

  // 1. Seed School Root Document
  console.log(`[1/7] Seeding School: SMK Negeri 1 Sumedang...`);
  await db.collection('schools').doc(SCHOOL_ID).set({
    id: SCHOOL_ID,
    name: 'SMK Negeri 1 Sumedang',
    npsn: '20208393',
    address: 'Jl. Mayor Abdurakhman No. 209, Kotakaler, Sumedang Utara, Jawa Barat 45322',
    phone: '(0261) 202056',
    email: 'smkn1smd@gmail.com',
    website: 'www.smkn1sumedang.sch.id',
    talentThreshold: 85,
    activeAcademicYearId: '2026-2027',
    createdAt: now,
    updatedAt: now
  }, { merge: true });

  // 2. Seed Academic Year
  console.log(`[2/7] Seeding Academic Year 2026/2027...`);
  await db.collection('academicYears').doc('2026-2027').set({
    id: '2026-2027',
    schoolId: SCHOOL_ID,
    name: 'Tahun Pelajaran 2026/2027',
    semester: 'Ganjil',
    isActive: true,
    startDate: '2026-07-15',
    endDate: '2026-12-20',
    createdAt: now
  }, { merge: true });

  // 3. Seed Majors (Strict Invariant: RPL and TKJ only)
  console.log(`[3/7] Seeding Majors (RPL & TKJ)...`);
  const majors = [
    {
      id: 'RPL',
      schoolId: SCHOOL_ID,
      code: 'RPL',
      name: 'Rekayasa Perangkat Lunak',
      headOfMajor: 'Muhammad Echa Putra, S.Kom.Gr',
      officialClasses: ['XII RPL 1', 'XII RPL 2']
    },
    {
      id: 'TKJ',
      schoolId: SCHOOL_ID,
      code: 'TKJ',
      name: 'Teknik Komputer dan Jaringan',
      headOfMajor: 'Rijal Nur Rahmat, S.T',
      officialClasses: ['XII TKJ 1']
    }
  ];
  for (const major of majors) {
    await db.collection('majors').doc(major.id).set(major, { merge: true });
  }

  // 4. Seed DU/DI Partner Companies
  console.log(`[4/7] Seeding Partner Companies (Platform-Level)...`);
  const companies = [
    {
      id: 'comp_telkom_smd',
      name: 'PT Telkom Indonesia (Witel Sumedang)',
      address: 'Jl. Mayor Abdurakhman No. 120, Kotakaler, Kec. Sumedang Utara, Kabupaten Sumedang, Jawa Barat 45322',
      lat: -6.8584,
      lng: 107.9212,
      geofenceRadiusMeters: 50,
      jurusanAllowed: ['RPL', 'TKJ'],
      quota: 10,
      filledQuota: 1, // Student Luthfi placed here
      createdBySchoolId: SCHOOL_ID,
      contactPerson: 'Budi Santoso, S.T.',
      contactPhone: '08122334455',
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'comp_inovatech',
      name: 'PT Inovasi Digital Nusantara (InovaTech)',
      address: 'Jl. Prabu Geusan Ulun No. 45, Sumedang Selatan, Jawa Barat 45311',
      lat: -6.8595,
      lng: 107.9230,
      geofenceRadiusMeters: 50,
      jurusanAllowed: ['RPL'],
      quota: 5,
      filledQuota: 0,
      createdBySchoolId: SCHOOL_ID,
      contactPerson: 'Hendra Gunawan',
      contactPhone: '08571234567',
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'comp_netpass',
      name: 'PT Jaringan Fiber Pasundan (NetPass)',
      address: 'Jl. Angkrek No. 18, Sumedang Utara, Jawa Barat 45323',
      lat: -6.8550,
      lng: 107.9180,
      geofenceRadiusMeters: 50,
      jurusanAllowed: ['TKJ'],
      quota: 6,
      filledQuota: 0,
      createdBySchoolId: SCHOOL_ID,
      contactPerson: 'Ahmad Sofyan',
      contactPhone: '08781234999',
      createdAt: now,
      updatedAt: now
    }
  ];
  for (const comp of companies) {
    await db.collection('companies').doc(comp.id).set(comp, { merge: true });
  }

  // 5. Seed Roster Data from seed/roster-data.json
  console.log(`[5/7] Seeding Student Roster (XII RPL 1, XII RPL 2, XII TKJ 1)...`);
  const rosterPath = path.join(__dirname, 'roster-data.json');
  let rosterData = {};
  if (fs.existsSync(rosterPath)) {
    rosterData = JSON.parse(fs.readFileSync(rosterPath, 'utf8'));
  } else {
    // Fallback to siswa-clean-firebase.json if not yet moved
    const legacyPath = path.join(__dirname, '..', 'siswa-clean-firebase.json');
    if (fs.existsSync(legacyPath)) {
      rosterData = JSON.parse(fs.readFileSync(legacyPath, 'utf8'));
    }
  }

  const batch = db.batch();
  let rosterCount = 0;

  for (const [nisn, student] of Object.entries(rosterData)) {
    const isDemoLuthfi = (nisn === '0087121894');
    const jurusanId = (student.kelas && student.kelas.includes('TKJ')) ? 'TKJ' : 'RPL';
    
    const rosterRef = db.collection('roster').doc(nisn);
    batch.set(rosterRef, {
      nisn: student.nisn || nisn,
      nama: student.nama,
      name: student.nama,
      kelas: student.kelas,
      nis: student.nis || '',
      email: student.email || `${nisn}@smkn1sumedang.sch.id`,
      schoolId: SCHOOL_ID,
      jurusanId,
      isRegistered: isDemoLuthfi, // Luthfi pre-registered as demo student
      createdAt: now
    }, { merge: true });
    rosterCount++;
  }
  await batch.commit();
  console.log(`  -> Successfully seeded ${rosterCount} roster records.`);

  // 6. Seed Demo Users for All 5 Actors
  console.log(`[6/7] Seeding Demo Accounts (5 Roles in Auth & Firestore)...`);
  const demoUsers = [
    {
      uid: 'user_superadmin_01',
      email: 'superadmin@vokalog.id',
      password: 'Password123!',
      displayName: 'Super Administrator',
      role: 'admin',
      schoolId: null, // Platform Super Admin
      phone: '08110000001'
    },
    {
      uid: 'user_admin_smkn1smd',
      email: 'admin@smkn1sumedang.sch.id',
      password: 'Password123!',
      displayName: 'Admin Hubin SMKN 1 Sumedang',
      role: 'admin',
      schoolId: SCHOOL_ID,
      phone: '08110000002'
    },
    {
      uid: 'user_guru_hery',
      email: 'guru@smkn1sumedang.sch.id',
      password: 'Password123!',
      displayName: 'Heri Anggara, S.Kom',
      role: 'guru',
      schoolId: SCHOOL_ID,
      nip: '198504252024211008',
      phone: '08110000003'
    },
    {
      uid: 'user_pembimbing_telkom',
      email: 'pembimbing@telkom.co.id',
      password: 'Password123!',
      displayName: 'Budi Santoso, S.T.',
      role: 'pembimbing',
      schoolId: SCHOOL_ID,
      companyId: 'comp_telkom_smd',
      phone: '08110000004'
    },
    {
      uid: 'user_siswa_luthfi',
      email: 'siswa@smkn1sumedang.sch.id',
      password: 'Password123!',
      displayName: 'Luthfi Nur Zaidan',
      role: 'siswa',
      schoolId: SCHOOL_ID,
      nisn: '0087121894',
      kelas: 'XII RPL 2',
      jurusanId: 'RPL',
      nis: '24.25.X.662',
      companyId: 'comp_telkom_smd',
      statusPkl: 'aktif',
      phone: '08110000005'
    }
  ];

  for (const user of demoUsers) {
    // Upsert Auth user
    await upsertAuthUser({
      uid: user.uid,
      email: user.email,
      password: user.password,
      displayName: user.displayName
    });

    // Set Custom Claims for security rules
    await auth.setCustomUserClaims(user.uid, {
      role: user.role,
      schoolId: user.schoolId,
      companyId: user.companyId || null
    });

    // Save Firestore UserDoc
    const userDocData = { ...user };
    delete userDocData.password;
    userDocData.createdAt = now;
    userDocData.updatedAt = now;

    await db.collection('users').doc(user.uid).set(userDocData, { merge: true });
    console.log(`  -> Seeded ${user.role.toUpperCase()}: ${user.email} (UID: ${user.uid})`);
  }

  // 7. Seed Active Demo State Records (for immediate flow testing)
  console.log(`[7/7] Seeding Active Demo State Records (QR Token, Attendance)...`);
  
  // Active QR Token for PT Telkom valid for 60s
  const qrExpiresAt = new admin.firestore.Timestamp(now.seconds + 60, 0);
  await db.collection('qrTokens').doc('comp_telkom_smd').set({
    token: 'token-telkom-demo-active',
    companyId: 'comp_telkom_smd',
    lat: -6.8584,
    lng: 107.9212,
    expiresAt: qrExpiresAt,
    generatedBy: 'user_pembimbing_telkom',
    createdAt: now
  });

  // Sample Today's Attendance Record for Luthfi
  const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const attendanceId = `user_siswa_luthfi_${todayStr}`;
  await db.collection('attendances').doc(attendanceId).set({
    id: attendanceId,
    studentId: 'user_siswa_luthfi',
    schoolId: SCHOOL_ID,
    companyId: 'comp_telkom_smd',
    date: todayStr,
    status: 'hadir',
    logbookSubmitted: false, // Initially false to verify checkout gate
    checkIn: {
      time: now,
      lat: -6.8584,
      lng: 107.9212,
      distanceMeters: 12.5,
      verifiedServerSide: true
    },
    createdAt: now
  }, { merge: true });

  console.log(`\n=======================================================`);
  console.log(`[Seed Complete] VokaLog local database seeded successfully!`);
  console.log(`Demo Logins:`);
  console.log(`  Super Admin:         superadmin@vokalog.id      / Password123!`);
  console.log(`  Admin Sekolah:       admin@smkn1sumedang.sch.id / Password123!`);
  console.log(`  Guru Pembimbing:     guru@smkn1sumedang.sch.id  / Password123!`);
  console.log(`  Pembimbing Instansi: pembimbing@telkom.co.id    / Password123!`);
  console.log(`  Siswa:               siswa@smkn1sumedang.sch.id / Password123!`);
  console.log(`=======================================================\n`);
}

runSeed().catch((err) => {
  console.error('[Seed Error] Seeder failed:', err);
  process.exit(1);
});
```

---

## 5. Verification Method

To independently verify the implementation after execution:

1. **Verify Workspace Cleanup**:
   - Check that `iot/`, `scripts/`, `tests/`, and legacy HTML files no longer exist.
   - Run `find_by_name` on `assets/logo-nesas.png` and `assets/logo-rpl.png` to confirm they exist and have sizes 132,755 and 3,216 bytes.
   - Run `find_by_name` on `seed/roster-data.json` to confirm it exists and matches original `siswa-clean-firebase.json`.

2. **Verify Mock Storage Server**:
   - Execute: `node mock-storage/server.js` (or `npm run mock:storage`).
   - In a test script or curl/fetch, perform:
     `curl -X PUT http://127.0.0.1:9090/test-bucket/sample.jpg --data-binary "testdata" -H "Content-Type: image/jpeg"`
     Confirm HTTP 200 and file created at `mock-storage/uploads/test-bucket/sample.jpg`.
   - Access `http://127.0.0.1:9090/test-bucket/sample.jpg` and verify response header `Content-Type: image/jpeg` and body matches `testdata`.

3. **Verify Firebase Emulator Suite**:
   - Execute: `npx firebase emulators:start --only auth,firestore`
   - Confirm Auth responds on port `9099`, Firestore on `8080`, and UI on `4000`.

4. **Verify Database Seeder**:
   - With emulators running, execute: `node seed/seed.js`
   - In Firebase Emulator UI (`http://127.0.0.1:4000`):
     - Auth: Verify 5 demo accounts created (`superadmin@vokalog.id`, `admin@smkn1sumedang.sch.id`, etc.).
     - Firestore: Verify collections `schools`, `majors`, `companies`, `roster` (45+ items), `users`, `qrTokens`, and `attendances` populated.
     - Verify class roster contains exclusively `XII RPL 1`, `XII RPL 2`, and `XII TKJ 1`.
