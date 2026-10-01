# SMKN 1 Sumedang Project Invariants & Class Scope

## 1. Class Roster Invariant (Strict Enforcement)
- The school strictly has ONLY 3 official classes:
  1. `XII RPL 1`
  2. `XII RPL 2`
  3. `XII TKJ 1`
- **Prohibition**: NEVER invent, hardcode, or display non-existent classes (such as `PPLG`, `9A`, class 10, or class 11).
- All UI dropdowns (`dashboard.html`, `admin.html`, `presensi-live.html`, `dashboard-guru.html`) and backend logic must strictly adhere to `DAFTAR_KELAS_RESMI = ['XII RPL 1', 'XII RPL 2', 'XII TKJ 1']`.

## 2. Firebase Realtime Database Data Handling
- **Source of Truth**: Live Firebase Realtime Database (`/siswa`, `/absensi`, `/kartu`, `/jadwal_pelajaran`, `/presensi_jam`).
- **Data Normalization**:
  - Always normalize class strings via `normalisasiKelas()` to match `XII RPL 1`, `XII RPL 2`, or `XII TKJ 1`.
  - Parse student snapshots using `parseSiswaSnapshot()` to seamlessly handle both Array and Key-Value Object structures.
  - Never discard student records with non-digit keys or push IDs.
- **Rendering Invariant**:
  - Always call `renderPantauKelas()` immediately on tab switch (`switchTab('tabKelas')`) and when receiving realtime snapshots to prevent empty/blank states.

## 3. Git Workflow Constraints
- **Zero Push Rule**: NEVER run `git push`. Local commits only.
- **Git Author**: `RexxLostHer <7dosabesar557@gmail.com>`.
