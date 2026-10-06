# VokaLog E2E Test Suite & Test Runner

Opaque-box automated test suite for **VokaLog** (PKL attendance & hybrid logbook system, SMKN 1 Sumedang, 2026/2027).

## Architecture & Coverage

The test runner (`e2e/runner.js`) validates all **21 PRD BAB III flows** across **4 verification tiers**:
- **Tier 1 (Happy Path)**: Primary behavior and interface contracts.
- **Tier 2 (Boundary & Security)**: Geofence radius limits (>50m rejected), 60s QR expiry, quota capacity constraints, role permissions, and check-out gate enforcement.
- **Tier 3 (Cross-Feature Pairwise)**: Multi-stage lifecycle state transitions.
- **Tier 4 (Real-World Application Scenarios)**: Complete user journeys for all 5 actors.

## Execution

```bash
# Run all 21 PRD flows, check all assertions, and generate 21 PNG screenshots
node e2e/runner.js

# Or using npm
npm test --prefix e2e
```

## The 21 PRD Flows

1. **Flow 01 (PRD 3.4)**: Registrasi Akun Siswa Baru (`lookupNisn` & `completeRegistration`)
2. **Flow 02 (PRD 3.5)**: Admin Melihat Daftar Perusahaan
3. **Flow 03 (PRD 3.6)**: Admin Menambah Perusahaan Baru
4. **Flow 04 (PRD 3.7)**: Admin Melihat Detail Perusahaan
5. **Flow 05 (PRD 3.8)**: Admin Mengedit Data Perusahaan (Whitelisted Fields)
6. **Flow 06 (PRD 3.9)**: Admin Menghapus Perusahaan (Super Admin Only)
7. **Flow 07 (PRD 1.6)**: Pembimbing Instansi Membuat QR Presensi Dinamis (60s TTL)
8. **Flow 08 (PRD 3.10)**: Siswa Mengajukan Lamaran PKL
9. **Flow 09 (PRD 3.11)**: Admin Melihat Daftar Lamaran Masuk
10. **Flow 10 (PRD 1.7)**: Admin Menyetujui atau Menolak Lamaran (Quota Check)
11. **Flow 11 (PRD 3.12)**: Siswa Presensi Masuk (Scan QR & Geofencing <=50m)
12. **Flow 12 (PRD 3.13)**: Siswa Presensi Pulang (Gate Enforced: `logbookSubmitted == true`)
13. **Flow 13 (PRD 3.14)**: Guru Pembimbing Memantau Presensi Realtime
14. **Flow 14 (PRD 3.15)**: Siswa Mengisi Logbook Harian Hybrid (Upload Foto ke R2 Mock)
15. **Flow 15 (PRD 3.16)**: Pembimbing Instansi Review Logbook
16. **Flow 16 (PRD 3.17)**: Siswa Mengirim Laporan SOS (GPS Coordinates)
17. **Flow 17 (PRD 3.18)**: Guru Pembimbing Menindaklanjuti Laporan SOS
18. **Flow 18 (PRD 3.19)**: Penilaian Akhir PKL (Two-Stage & Talent Threshold >=85)
19. **Flow 19 (PRD 3.20)**: Unggah dan Validasi Laporan Akhir (PDF & Sertifikat)
20. **Flow 20 (PRD 3.21)**: Export Laporan dengan Filter (Date, Jurusan, Perusahaan)
21. **Flow 21 (PRD Class/ERD)**: Talent Pool & Lowongan Kerja Khusus

## Visual Artifacts

Screenshots are saved as high-resolution PNG files in `e2e/screenshots/`:
- `flow_01_registrasi_siswa.png`
- `flow_02_daftar_perusahaan.png`
- ...
- `flow_21_talent_pool.png`
