# SMKN 1 Sumedang Project Invariants & Class Scope

> **IMPORTANT FOR AI AGENTS**:
> Before starting work, read `FULL_SESSION_MEMORY.md` and `IOT_AGENT_CONTEXT.md`. They contain the complete context of recent developments, bug fixes, database schema, RFID card mappings, and IoT integration rules.

## 1. Class Roster Invariant (Strict Enforcement)
- The school strictly has ONLY 3 official classes:
  1. `XII RPL 1`
  2. `XII RPL 2`
  3. `XII TKJ 1`
- **Prohibition**: NEVER invent, hardcode, or display non-existent classes (such as `PPLG`, `9A`, class 10, or class 11).
- All UI dropdowns (`dashboard.html`, `admin.html`, `presensi-live.html`, `dashboard-guru.html`) and backend logic must strictly adhere to `DAFTAR_KELAS_RESMI = ['XII RPL 1', 'XII RPL 2', 'XII TKJ 1']`.

## 2. Firebase Realtime Database Data Handling
- **Source of Truth**: Live Firebase Realtime Database (`/siswa`, `/absensi`, `/kartu`, `/jadwal_pelajaran`, `/presensi_jam`, `/pairing_request`, `/chat_rooms`).
- **Database URL**: `https://absensi-6e385-default-rtdb.asia-southeast1.firebasedatabase.app`
- **Data Normalization**:
  - Always normalize class strings via `normalisasiKelas()` to match `XII RPL 1`, `XII RPL 2`, or `XII TKJ 1`.
  - Parse student snapshots using `parseSiswaSnapshot()` to seamlessly handle both Array and Key-Value Object structures.
  - Never discard student records with non-digit keys or push IDs.
- **Rendering Invariant**:
  - Always call `renderPantauKelas()` immediately on tab switch (`switchTab('tabKelas')`) and when receiving realtime snapshots to prevent empty/blank states.

## 3. IoT & RFID Gateway Rules
- **Timezone**: Asia/Jakarta (WIB, UTC+7).
- **Time Cutoffs**:
  - `<= 06:30:00 WIB`: `hadir`
  - `> 06:30:00 WIB`: `terlambat`
  - `> 08:00:00 WIB`: `terlambat` (or `alpa` if no scan made before 08:00).
- **Immutable Permit Rule**: If student has an approved permit (`status === 'disetujui'`), RFID scan MUST NOT overwrite their approved status.
- **Contract SDK**: Use `presensia-iot-contract.js` for tap processing, payload generation, and cooldown handling.

## 4. Git Workflow
- **Git Author**: `RexxLostHer <7dosabesar557@gmail.com>`.
- Only push to remote when explicitly requested by user.
