# Plan: VokaLog PKL System

## Objective
Rebuild `ujikom` into VokaLog — a complete PKL attendance and hybrid-logbook system conforming to SMKN 1 Sumedang PRD (2026/2027) and ORIGINAL_REQUEST.md.

## Execution Strategy (Dual Track Project Pattern)
- **Phase 0: Survey**:
  - Explorer 1 (Environment & Existing Workspace): Inspect current workspace (`ujikom`), existing git status, Node/Flutter/Firebase CLI presence, existing assets (`assets/` logo).
  - Explorer 2 / Spec Miner (PRD Deep Dive): Extract all 17 Firestore entities, 21 BAB III flows, function signatures, validation logic, geofence parameters, R2 presigned URL flow, role permissions.
  - Explorer 3 (Architecture & Test Strategy): Plan emulator setup (Firestore, Auth, Functions), mock S3/R2 server, unit test harness (@firebase/rules-unit-testing, functions tests, flutter tests), and E2E browser runner.
- **Phase 1: Decomposition & Global Index (PROJECT.md)**:
  - Synthesize survey findings.
  - Create PROJECT.md (Architecture, Feature Inventory 1..N, Milestones M1..M5, Interface Contracts, Code Layout).
  - Spawn E2E Testing Track Orchestrator.
- **Phase 2: Implementation Track Milestones**:
  - M1: Backend Foundation (Firebase Functions, Emulators, Security Rules, Mock R2, Seeds).
  - M2: Core Authentication, Multi-tenant Schools & Companies Management.
  - M3: Student PKL Lifecycle (Application, Double-Verification Check-in/Check-out, QR Generator).
  - M4: Hybrid Logbook & Monitoring (Upload to R2, Review, Realtime Monitoring, SOS Reports).
  - M5: Assessments, Final Reports, Exports, and E2E Test Suite Validation.
- **Phase 3: Final Verification & Handover**:
  - Run full test suite, automated E2E browser verification across all 21 flows with screenshots.
  - Generate README.md with setup guide and demo accounts.
