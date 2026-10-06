import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';

const PROJECT_ID = 'vokalog-security-test';
const RULES_PATH = resolve(__dirname, '../firestore.rules');

describe('VokaLog Firestore Security Rules', () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        host: '127.0.0.1',
        port: 8080,
        rules: readFileSync(RULES_PATH, 'utf8'),
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();

    // Baseline seed with security rules bypassed
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();

      // Seed schools
      await db.doc('schools/smkn1_sumedang').set({
        name: 'SMK Negeri 1 Sumedang',
        npsn: '20208393',
        talentThreshold: 85,
      });
      await db.doc('schools/smkn2_sumedang').set({
        name: 'SMK Negeri 2 Sumedang',
        npsn: '20208394',
        talentThreshold: 80,
      });

      // Seed companies
      await db.doc('companies/pt_inovasi_digital').set({
        name: 'PT Inovasi Digital Sumedang',
        address: 'Jl. Angkrek No. 10',
        lat: -6.85854,
        lng: 107.91942,
        geofenceRadiusMeters: 50,
        jurusanAllowed: ['RPL'],
        quota: 5,
        filledQuota: 2,
        createdBySchoolId: 'smkn1_sumedang',
      });

      // Seed user profiles
      await db.doc('users/superadmin_uid').set({
        role: 'admin',
        schoolId: null,
      });
      await db.doc('users/admin_school_a_uid').set({
        role: 'admin',
        schoolId: 'smkn1_sumedang',
      });
      await db.doc('users/admin_school_b_uid').set({
        role: 'admin',
        schoolId: 'smkn2_sumedang',
      });
      await db.doc('users/student_a_uid').set({
        role: 'siswa',
        schoolId: 'smkn1_sumedang',
      });
      await db.doc('users/mentor_comp_1_uid').set({
        role: 'pembimbing instansi',
        companyId: 'pt_inovasi_digital',
      });
    });
  });

  // ===========================================================================
  // INVARIANT 1: COMPANY DELETION EXCLUSIVELY FOR SUPER ADMIN
  // ===========================================================================
  describe('Invariant 1: Company deletion exclusively for Super Admin', () => {
    it('allows Super Admin (role=admin, schoolId=null) to delete a company', async () => {
      const superAdminDb = testEnv.authenticatedContext('superadmin_uid', {
        role: 'admin',
        schoolId: null,
      }).firestore();

      await assertSucceeds(superAdminDb.doc('companies/pt_inovasi_digital').delete());
    });

    it('denies Admin Sekolah (role=admin, schoolId=smkn1_sumedang) from deleting a company', async () => {
      const adminSchoolDb = testEnv.authenticatedContext('admin_school_a_uid', {
        role: 'admin',
        schoolId: 'smkn1_sumedang',
      }).firestore();

      await assertFails(adminSchoolDb.doc('companies/pt_inovasi_digital').delete());
    });

    it('denies Siswa from deleting a company', async () => {
      const studentDb = testEnv.authenticatedContext('student_a_uid', {
        role: 'siswa',
        schoolId: 'smkn1_sumedang',
      }).firestore();

      await assertFails(studentDb.doc('companies/pt_inovasi_digital').delete());
    });

    it('denies unauthenticated client from deleting a company', async () => {
      const unauthDb = testEnv.unauthenticatedContext().firestore();
      await assertFails(unauthDb.doc('companies/pt_inovasi_digital').delete());
    });
  });

  // ===========================================================================
  // INVARIANT 2: COMPANY EDIT FIELD WHITELIST
  // ===========================================================================
  describe('Invariant 2: Company edit restricted to field whitelist', () => {
    it('allows Admin Sekolah to update whitelisted descriptive fields', async () => {
      const adminSchoolDb = testEnv.authenticatedContext('admin_school_a_uid', {
        role: 'admin',
        schoolId: 'smkn1_sumedang',
      }).firestore();

      await assertSucceeds(
        adminSchoolDb.doc('companies/pt_inovasi_digital').update({
          name: 'PT Inovasi Digital Baru',
          address: 'Jl. Prabu Geusan Ulun No. 20',
          quota: 8,
          geofenceRadiusMeters: 60,
        })
      );
    });

    it('denies Admin Sekolah from modifying filledQuota directly', async () => {
      const adminSchoolDb = testEnv.authenticatedContext('admin_school_a_uid', {
        role: 'admin',
        schoolId: 'smkn1_sumedang',
      }).firestore();

      await assertFails(
        adminSchoolDb.doc('companies/pt_inovasi_digital').update({
          filledQuota: 0,
        })
      );
    });

    it('denies Admin Sekolah from modifying createdBySchoolId', async () => {
      const adminSchoolDb = testEnv.authenticatedContext('admin_school_a_uid', {
        role: 'admin',
        schoolId: 'smkn1_sumedang',
      }).firestore();

      await assertFails(
        adminSchoolDb.doc('companies/pt_inovasi_digital').update({
          createdBySchoolId: 'smkn2_sumedang',
        })
      );
    });

    it('denies Admin Sekolah from injecting arbitrary unknown fields', async () => {
      const adminSchoolDb = testEnv.authenticatedContext('admin_school_a_uid', {
        role: 'admin',
        schoolId: 'smkn1_sumedang',
      }).firestore();

      await assertFails(
        adminSchoolDb.doc('companies/pt_inovasi_digital').update({
          isVerifiedPartner: true,
        })
      );
    });
  });

  // ===========================================================================
  // INVARIANT 3: APPLICATION CREATION CONSTRAINTS
  // ===========================================================================
  describe('Invariant 3: Application studentId must equal auth.uid with status "menunggu"', () => {
    it('allows Siswa to create application with own uid and status menunggu', async () => {
      const studentDb = testEnv.authenticatedContext('student_a_uid', {
        role: 'siswa',
        schoolId: 'smkn1_sumedang',
      }).firestore();

      await assertSucceeds(
        studentDb.doc('applications/app_1').set({
          schoolId: 'smkn1_sumedang',
          studentId: 'student_a_uid',
          companyId: 'pt_inovasi_digital',
          status: 'menunggu',
          createdAt: new Date(),
        })
      );
    });

    it('denies Siswa from spoofing studentId on application creation', async () => {
      const studentDb = testEnv.authenticatedContext('student_a_uid', {
        role: 'siswa',
        schoolId: 'smkn1_sumedang',
      }).firestore();

      await assertFails(
        studentDb.doc('applications/app_2').set({
          schoolId: 'smkn1_sumedang',
          studentId: 'student_spoofed_uid',
          companyId: 'pt_inovasi_digital',
          status: 'menunggu',
          createdAt: new Date(),
        })
      );
    });

    it('denies Siswa from creating application with initial status disetujui', async () => {
      const studentDb = testEnv.authenticatedContext('student_a_uid', {
        role: 'siswa',
        schoolId: 'smkn1_sumedang',
      }).firestore();

      await assertFails(
        studentDb.doc('applications/app_3').set({
          schoolId: 'smkn1_sumedang',
          studentId: 'student_a_uid',
          companyId: 'pt_inovasi_digital',
          status: 'disetujui',
          createdAt: new Date(),
        })
      );
    });
  });

  // ===========================================================================
  // INVARIANT 4: ATTENDANCE CHECKOUT GATE (logbookSubmitted == true)
  // ===========================================================================
  describe('Invariant 4: Attendance checkout barrier (logbookSubmitted == true)', () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        // Attendance with logbook NOT yet submitted
        await db.doc('attendances/att_pending_logbook').set({
          schoolId: 'smkn1_sumedang',
          uid: 'student_a_uid',
          companyId: 'pt_inovasi_digital',
          date: '2026-10-06',
          status: 'hadir',
          logbookSubmitted: false,
          checkIn: { time: new Date() },
        });

        // Attendance with logbook submitted
        await db.doc('attendances/att_ready_checkout').set({
          schoolId: 'smkn1_sumedang',
          uid: 'student_a_uid',
          companyId: 'pt_inovasi_digital',
          date: '2026-10-06',
          status: 'hadir',
          logbookSubmitted: true,
          checkIn: { time: new Date() },
        });
      });
    });

    it('denies Siswa from updating checkOut when logbookSubmitted is false', async () => {
      const studentDb = testEnv.authenticatedContext('student_a_uid', {
        role: 'siswa',
        schoolId: 'smkn1_sumedang',
      }).firestore();

      await assertFails(
        studentDb.doc('attendances/att_pending_logbook').update({
          checkOut: { time: new Date(), lat: -6.85854, lng: 107.91942 },
        })
      );
    });

    it('allows Siswa to update checkOut when logbookSubmitted is true', async () => {
      const studentDb = testEnv.authenticatedContext('student_a_uid', {
        role: 'siswa',
        schoolId: 'smkn1_sumedang',
      }).firestore();

      await assertSucceeds(
        studentDb.doc('attendances/att_ready_checkout').update({
          checkOut: { time: new Date(), lat: -6.85854, lng: 107.91942 },
        })
      );
    });

    it('denies Siswa from directly altering logbookSubmitted to true', async () => {
      const studentDb = testEnv.authenticatedContext('student_a_uid', {
        role: 'siswa',
        schoolId: 'smkn1_sumedang',
      }).firestore();

      await assertFails(
        studentDb.doc('attendances/att_pending_logbook').update({
          logbookSubmitted: true,
        })
      );
    });

    it('allows Siswa to update non-checkout fields (notes) even if logbookSubmitted is false', async () => {
      const studentDb = testEnv.authenticatedContext('student_a_uid', {
        role: 'siswa',
        schoolId: 'smkn1_sumedang',
      }).firestore();

      await assertSucceeds(
        studentDb.doc('attendances/att_pending_logbook').update({
          notes: 'Sedang menyelesaikan tugas jurnal fisik',
        })
      );
    });
  });

  // ===========================================================================
  // INVARIANT 5: LOGBOOK REVIEW RESTRICTED TO SAME COMPANY MENTOR
  // ===========================================================================
  describe('Invariant 5: Logbook review only by Pembimbing Instansi of same companyId', () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db.doc('logbooks/lb_1').set({
          schoolId: 'smkn1_sumedang',
          uid: 'student_a_uid',
          companyId: 'pt_inovasi_digital',
          title: 'Membuat modul autentikasi',
          category: 'sesuai jurusan',
          reviewStatus: 'menunggu',
        });
      });
    });

    it('allows Pembimbing Instansi from the SAME company to review logbook', async () => {
      const mentorSameCompDb = testEnv.authenticatedContext('mentor_comp_1_uid', {
        role: 'pembimbing instansi',
        companyId: 'pt_inovasi_digital',
      }).firestore();

      await assertSucceeds(
        mentorSameCompDb.doc('logbooks/lb_1').update({
          reviewStatus: 'disetujui',
          catatan: 'Bagus, paraf fisik telah diverifikasi',
          reviewedBy: 'mentor_comp_1_uid',
          reviewedAt: new Date(),
        })
      );
    });

    it('denies Pembimbing Instansi from a DIFFERENT company from reviewing logbook', async () => {
      const mentorDiffCompDb = testEnv.authenticatedContext('mentor_other_uid', {
        role: 'pembimbing instansi',
        companyId: 'pt_telekomunikasi_seluler',
      }).firestore();

      await assertFails(
        mentorDiffCompDb.doc('logbooks/lb_1').update({
          reviewStatus: 'disetujui',
          reviewedBy: 'mentor_other_uid',
        })
      );
    });

    it('denies Siswa from self-approving their own logbook', async () => {
      const studentDb = testEnv.authenticatedContext('student_a_uid', {
        role: 'siswa',
        schoolId: 'smkn1_sumedang',
      }).firestore();

      await assertFails(
        studentDb.doc('logbooks/lb_1').update({
          reviewStatus: 'disetujui',
        })
      );
    });
  });

  // ===========================================================================
  // INVARIANT 6: FINAL REPORT ADMIN REVIEW WHITELIST
  // ===========================================================================
  describe('Invariant 6: Final report admin update limited to status, certificateUrl, reviewedBy, reviewedAt', () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db.doc('finalReports/fr_1').set({
          schoolId: 'smkn1_sumedang',
          studentId: 'student_a_uid',
          applicationId: 'app_1',
          fileUrl: 'https://r2.vokalog.id/reports/student_a.pdf',
          status: 'menunggu',
        });
      });
    });

    it('allows Admin Sekolah from same school to approve and attach certificateUrl', async () => {
      const adminSchoolADb = testEnv.authenticatedContext('admin_school_a_uid', {
        role: 'admin',
        schoolId: 'smkn1_sumedang',
      }).firestore();

      await assertSucceeds(
        adminSchoolADb.doc('finalReports/fr_1').update({
          status: 'disetujui',
          certificateUrl: 'https://r2.vokalog.id/certs/student_a_cert.pdf',
          reviewedBy: 'admin_school_a_uid',
          reviewedAt: new Date(),
        })
      );
    });

    it('denies Admin Sekolah from altering submitted student fileUrl or studentId', async () => {
      const adminSchoolADb = testEnv.authenticatedContext('admin_school_a_uid', {
        role: 'admin',
        schoolId: 'smkn1_sumedang',
      }).firestore();

      await assertFails(
        adminSchoolADb.doc('finalReports/fr_1').update({
          fileUrl: 'https://malicious-site.com/fake.pdf',
        })
      );
    });

    it('denies Admin Sekolah from a DIFFERENT school from validating final report', async () => {
      const adminSchoolBDb = testEnv.authenticatedContext('admin_school_b_uid', {
        role: 'admin',
        schoolId: 'smkn2_sumedang',
      }).firestore();

      await assertFails(
        adminSchoolBDb.doc('finalReports/fr_1').update({
          status: 'disetujui',
          certificateUrl: 'https://r2.vokalog.id/certs/test.pdf',
          reviewedBy: 'admin_school_b_uid',
        })
      );
    });
  });

  // ===========================================================================
  // INVARIANT 7: MULTI-TENANT CROSS-SCHOOL ISOLATION
  // ===========================================================================
  describe('Invariant 7: Cross-school reads and writes denied', () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db.doc('applications/app_school_a').set({
          schoolId: 'smkn1_sumedang',
          studentId: 'student_a_uid',
          status: 'menunggu',
        });
        await db.doc('attendances/att_school_a').set({
          schoolId: 'smkn1_sumedang',
          uid: 'student_a_uid',
          status: 'hadir',
        });
        await db.doc('logbooks/lb_school_a').set({
          schoolId: 'smkn1_sumedang',
          uid: 'student_a_uid',
          companyId: 'pt_inovasi_digital',
          reviewStatus: 'menunggu',
        });
      });
    });

    it('denies user from School B from reading School A applications', async () => {
      const userSchoolBDb = testEnv.authenticatedContext('admin_school_b_uid', {
        role: 'admin',
        schoolId: 'smkn2_sumedang',
      }).firestore();

      await assertFails(userSchoolBDb.doc('applications/app_school_a').get());
    });

    it('denies user from School B from reading School A attendances', async () => {
      const userSchoolBDb = testEnv.authenticatedContext('admin_school_b_uid', {
        role: 'admin',
        schoolId: 'smkn2_sumedang',
      }).firestore();

      await assertFails(userSchoolBDb.doc('attendances/att_school_a').get());
    });

    it('denies user from School B from reading School A logbooks', async () => {
      const userSchoolBDb = testEnv.authenticatedContext('admin_school_b_uid', {
        role: 'admin',
        schoolId: 'smkn2_sumedang',
      }).firestore();

      await assertFails(userSchoolBDb.doc('logbooks/lb_school_a').get());
    });

    it('allows Super Admin to read documents across different schools', async () => {
      const superAdminDb = testEnv.authenticatedContext('superadmin_uid', {
        role: 'admin',
        schoolId: null,
      }).firestore();

      await assertSucceeds(superAdminDb.doc('applications/app_school_a').get());
      await assertSucceeds(superAdminDb.doc('attendances/att_school_a').get());
      await assertSucceeds(superAdminDb.doc('logbooks/lb_school_a').get());
    });
  });

  // ===========================================================================
  // INVARIANT 8: USER SELF-ESCALATION & PROFILE IMMUTABILITY
  // ===========================================================================
  describe('Invariant 8: User self-escalation & sensitive field immutability', () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db.doc('users/student_a_uid').set({
          uid: 'student_a_uid',
          name: 'Student A',
          displayName: 'Student A',
          role: 'siswa',
          schoolId: 'smkn1_sumedang',
          companyId: 'pt_inovasi_digital',
          phone: '08123456789',
          isActive: true,
        });
      });
    });

    it('denies Siswa from elevating their own role to admin', async () => {
      const studentDb = testEnv.authenticatedContext('student_a_uid', {
        role: 'siswa',
        schoolId: 'smkn1_sumedang',
      }).firestore();

      await assertFails(
        studentDb.doc('users/student_a_uid').update({
          role: 'admin',
        })
      );
    });

    it('denies Siswa from elevating their own role to super_admin or clearing schoolId', async () => {
      const studentDb = testEnv.authenticatedContext('student_a_uid', {
        role: 'siswa',
        schoolId: 'smkn1_sumedang',
      }).firestore();

      await assertFails(
        studentDb.doc('users/student_a_uid').update({
          role: 'super_admin',
          schoolId: null,
        })
      );
    });

    it('denies Siswa from altering their schoolId to escape tenant boundary', async () => {
      const studentDb = testEnv.authenticatedContext('student_a_uid', {
        role: 'siswa',
        schoolId: 'smkn1_sumedang',
      }).firestore();

      await assertFails(
        studentDb.doc('users/student_a_uid').update({
          schoolId: 'smkn2_sumedang',
        })
      );
    });

    it('denies Siswa from altering their assigned companyId', async () => {
      const studentDb = testEnv.authenticatedContext('student_a_uid', {
        role: 'siswa',
        schoolId: 'smkn1_sumedang',
      }).firestore();

      await assertFails(
        studentDb.doc('users/student_a_uid').update({
          companyId: 'pt_other_company',
        })
      );
    });

    it('denies unprivileged authenticated user from creating users/{userId} directly', async () => {
      const studentDb = testEnv.authenticatedContext('student_new_uid', {
        role: 'siswa',
        schoolId: 'smkn1_sumedang',
      }).firestore();

      await assertFails(
        studentDb.doc('users/student_new_uid').set({
          role: 'admin',
          schoolId: null,
        })
      );
    });

    it('allows Siswa to update benign profile fields (phone, address, avatarUrl)', async () => {
      const studentDb = testEnv.authenticatedContext('student_a_uid', {
        role: 'siswa',
        schoolId: 'smkn1_sumedang',
      }).firestore();

      await assertSucceeds(
        studentDb.doc('users/student_a_uid').update({
          phone: '081234567890',
          address: 'Jl. Sumedang No. 12',
          avatarUrl: 'https://storage.example.com/avatar.jpg',
        })
      );
    });
  });

  // ===========================================================================
  // INVARIANT 9: ATTENDANCE CREATION RESTRAINTS
  // ===========================================================================
  describe('Invariant 9: Attendance document creation security constraints', () => {
    it('denies Siswa from creating attendance with pre-filled checkOut object', async () => {
      const studentDb = testEnv.authenticatedContext('student_a_uid', {
        role: 'siswa',
        schoolId: 'smkn1_sumedang',
      }).firestore();

      await assertFails(
        studentDb.doc('attendances/att_create_hack_1').set({
          schoolId: 'smkn1_sumedang',
          uid: 'student_a_uid',
          companyId: 'pt_inovasi_digital',
          date: '2026-10-06',
          status: 'hadir',
          logbookSubmitted: false,
          checkIn: { time: new Date() },
          checkOut: { time: new Date(), distanceMeters: 10 },
        })
      );
    });

    it('denies Siswa from creating attendance with logbookSubmitted = true', async () => {
      const studentDb = testEnv.authenticatedContext('student_a_uid', {
        role: 'siswa',
        schoolId: 'smkn1_sumedang',
      }).firestore();

      await assertFails(
        studentDb.doc('attendances/att_create_hack_2').set({
          schoolId: 'smkn1_sumedang',
          uid: 'student_a_uid',
          companyId: 'pt_inovasi_digital',
          date: '2026-10-06',
          status: 'hadir',
          logbookSubmitted: true,
          checkIn: { time: new Date() },
        })
      );
    });

    it('denies Siswa from creating attendance for another student uid', async () => {
      const studentDb = testEnv.authenticatedContext('student_a_uid', {
        role: 'siswa',
        schoolId: 'smkn1_sumedang',
      }).firestore();

      await assertFails(
        studentDb.doc('attendances/att_create_hack_3').set({
          schoolId: 'smkn1_sumedang',
          uid: 'student_spoofed_uid',
          companyId: 'pt_inovasi_digital',
          date: '2026-10-06',
          status: 'hadir',
          logbookSubmitted: false,
        })
      );
    });

    it('denies Siswa from creating attendance with mismatched schoolId', async () => {
      const studentDb = testEnv.authenticatedContext('student_a_uid', {
        role: 'siswa',
        schoolId: 'smkn1_sumedang',
      }).firestore();

      await assertFails(
        studentDb.doc('attendances/att_create_hack_4').set({
          schoolId: 'smkn2_sumedang',
          uid: 'student_a_uid',
          companyId: 'pt_inovasi_digital',
          date: '2026-10-06',
          status: 'hadir',
          logbookSubmitted: false,
        })
      );
    });

    it('allows Siswa to create legitimate initial attendance record', async () => {
      const studentDb = testEnv.authenticatedContext('student_a_uid', {
        role: 'siswa',
        schoolId: 'smkn1_sumedang',
      }).firestore();

      await assertSucceeds(
        studentDb.doc('attendances/att_legit_create').set({
          schoolId: 'smkn1_sumedang',
          uid: 'student_a_uid',
          companyId: 'pt_inovasi_digital',
          date: '2026-10-06',
          status: 'hadir',
          logbookSubmitted: false,
        })
      );
    });
  });

  // ===========================================================================
  // INVARIANT 10: ATTENDANCE UPDATE FIELD WHITELIST
  // ===========================================================================
  describe('Invariant 10: Attendance update tampering prevention', () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db.doc('attendances/att_alpha_record').set({
          schoolId: 'smkn1_sumedang',
          uid: 'student_a_uid',
          companyId: 'pt_inovasi_digital',
          date: '2026-10-06',
          status: 'alpha',
          logbookSubmitted: false,
        });
      });
    });

    it('denies Siswa from manually changing status from alpha to hadir', async () => {
      const studentDb = testEnv.authenticatedContext('student_a_uid', {
        role: 'siswa',
        schoolId: 'smkn1_sumedang',
      }).firestore();

      await assertFails(
        studentDb.doc('attendances/att_alpha_record').update({
          status: 'hadir',
        })
      );
    });

    it('denies Siswa from tampering with checkIn verification stamps', async () => {
      const studentDb = testEnv.authenticatedContext('student_a_uid', {
        role: 'siswa',
        schoolId: 'smkn1_sumedang',
      }).firestore();

      await assertFails(
        studentDb.doc('attendances/att_alpha_record').update({
          'checkIn.verifiedServerSide': true,
        })
      );
    });

    it('allows Siswa to update notes', async () => {
      const studentDb = testEnv.authenticatedContext('student_a_uid', {
        role: 'siswa',
        schoolId: 'smkn1_sumedang',
      }).firestore();

      await assertSucceeds(
        studentDb.doc('attendances/att_alpha_record').update({
          notes: 'Izin terlambat karena kendala transportasi',
        })
      );
    });
  });

  // ===========================================================================
  // INVARIANT 11: MASTER DATA DELETION TENANT ISOLATION
  // ===========================================================================
  describe('Invariant 11: Master & Auxiliary data deletion scoped to same school', () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db.doc('academicYears/ay_school_a').set({
          schoolId: 'smkn1_sumedang',
          year: '2026/2027',
        });
        await db.doc('academicYears/ay_school_b').set({
          schoolId: 'smkn2_sumedang',
          year: '2026/2027',
        });
        await db.doc('majors/major_school_a').set({
          schoolId: 'smkn1_sumedang',
          name: 'Rekayasa Perangkat Lunak',
        });
        await db.doc('roster/roster_school_a').set({
          schoolId: 'smkn1_sumedang',
          nisn: '0091113849',
        });
      });
    });

    it('allows Admin Sekolah of SAME school to delete academicYears', async () => {
      const adminSchoolADb = testEnv.authenticatedContext('admin_school_a_uid', {
        role: 'admin',
        schoolId: 'smkn1_sumedang',
      }).firestore();

      await assertSucceeds(adminSchoolADb.doc('academicYears/ay_school_a').delete());
    });

    it('denies Admin Sekolah of DIFFERENT school from deleting academicYears', async () => {
      const adminSchoolBDb = testEnv.authenticatedContext('admin_school_b_uid', {
        role: 'admin',
        schoolId: 'smkn2_sumedang',
      }).firestore();

      await assertFails(adminSchoolBDb.doc('academicYears/ay_school_a').delete());
    });

    it('denies Admin Sekolah of School B from hijacking School A academicYears on update', async () => {
      const adminSchoolBDb = testEnv.authenticatedContext('admin_school_b_uid', {
        role: 'admin',
        schoolId: 'smkn2_sumedang',
      }).firestore();

      await assertFails(
        adminSchoolBDb.doc('academicYears/ay_school_a').update({
          year: '2027/2028',
          schoolId: 'smkn2_sumedang',
        })
      );
    });

    it('allows Admin Sekolah of SAME school to delete majors and roster', async () => {
      const adminSchoolADb = testEnv.authenticatedContext('admin_school_a_uid', {
        role: 'admin',
        schoolId: 'smkn1_sumedang',
      }).firestore();

      await assertSucceeds(adminSchoolADb.doc('majors/major_school_a').delete());
      await assertSucceeds(adminSchoolADb.doc('roster/roster_school_a').delete());
    });

    it('denies Siswa from deleting academicYears, majors, or roster', async () => {
      const studentDb = testEnv.authenticatedContext('student_a_uid', {
        role: 'siswa',
        schoolId: 'smkn1_sumedang',
      }).firestore();

      await assertFails(studentDb.doc('academicYears/ay_school_a').delete());
      await assertFails(studentDb.doc('majors/major_school_a').delete());
      await assertFails(studentDb.doc('roster/roster_school_a').delete());
    });
  });
});
