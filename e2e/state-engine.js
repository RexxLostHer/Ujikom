/**
 * VokaLog E2E State Engine & Emulated Interface Contract
 * Enforces all business logic, Firestore security rule barriers, and callable contracts
 * as specified in PROJECT.md, ORIGINAL_REQUEST.md, and PRD BAB III.
 */

const crypto = require('crypto');

/**
 * Standard Haversine distance formula between two GPS coordinates (meters)
 * PRD 2.5 & PROJECT.md Interface Contract 4
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in metres
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

class VokaLogStateEngine {
  constructor() {
    this.reset();
  }

  reset() {
    // 1. Schools (Multi-tenant root)
    this.schools = {
      'smkn1-sumedang': {
        id: 'smkn1-sumedang',
        name: 'SMK Negeri 1 Sumedang',
        address: 'Jl. Mayor Abdurakhman No. 209 Sumedang',
        phone: '(0261) 202056',
        talentThreshold: 85,
        majors: ['RPL', 'TKJ']
      }
    };

    // 2. Pre-seeded Roster (PRD 3.4 & R3: XII RPL 1, XII RPL 2, XII TKJ 1)
    this.roster = {
      '0087121894': {
        nisn: '0087121894',
        name: 'Luthfi Nur Zaidan',
        schoolId: 'smkn1-sumedang',
        jurusanId: 'RPL',
        kelas: 'XII RPL 2',
        registered: false
      },
      '0087121895': {
        nisn: '0087121895',
        name: 'Ahmad Fauzi',
        schoolId: 'smkn1-sumedang',
        jurusanId: 'RPL',
        kelas: 'XII RPL 1',
        registered: false
      },
      '0087121896': {
        nisn: '0087121896',
        name: 'Budi Santoso',
        schoolId: 'smkn1-sumedang',
        jurusanId: 'TKJ',
        kelas: 'XII TKJ 1',
        registered: false
      }
    };

    // 3. User Accounts (5 Roles)
    this.users = {
      'superadmin-01': {
        uid: 'superadmin-01',
        email: 'superadmin@vokalog.id',
        role: 'superadmin',
        schoolId: null,
        name: 'Platform Super Administrator'
      },
      'admin-school-01': {
        uid: 'admin-school-01',
        email: 'admin.smkn1@vokalog.sch.id',
        role: 'admin',
        schoolId: 'smkn1-sumedang',
        name: 'Admin Hubin SMKN 1 Sumedang'
      },
      'supervisor-01': {
        uid: 'supervisor-01',
        email: 'mentor.telkom@telkom.co.id',
        role: 'pembimbing_instansi',
        companyId: 'comp-telkom-01',
        schoolId: null,
        name: 'Pembimbing Industri PT Telkom'
      },
      'teacher-01': {
        uid: 'teacher-01',
        email: 'guru.hani@smkn1smd.sch.id',
        role: 'guru_pembimbing',
        schoolId: 'smkn1-sumedang',
        name: 'Hani Hanifah, S.Si'
      }
    };

    // 4. Partner Companies (Platform-level)
    this.companies = {
      'comp-telkom-01': {
        id: 'comp-telkom-01',
        name: 'PT Telkom Indonesia Witel Sumedang',
        address: 'Jl. Geusan Ulun No. 45 Sumedang',
        lat: -6.8585,
        lng: 107.9234,
        geofenceRadiusMeters: 50,
        quota: 4,
        filledQuota: 0,
        jurusanAllowed: ['RPL', 'TKJ'],
        createdBySchoolId: 'smkn1-sumedang'
      },
      'comp-inti-02': {
        id: 'comp-inti-02',
        name: 'PT Industri Telekomunikasi Indonesia (INTI)',
        address: 'Jl. Moch. Toha No. 77 Bandung',
        lat: -6.9452,
        lng: 107.6083,
        geofenceRadiusMeters: 50,
        quota: 2,
        filledQuota: 2, // Full quota test case
        jurusanAllowed: ['TKJ'],
        createdBySchoolId: 'smkn1-sumedang'
      }
    };

    // 5. Dynamic QR Tokens (qrTokens/{companyId})
    this.qrTokens = {};

    // 6. Applications (applications/{id})
    this.applications = {};

    // 7. Attendances (attendances/{uid_yyyyMMdd})
    this.attendances = {};

    // 8. Logbooks (logbooks/{id})
    this.logbooks = {};

    // 9. SOS Reports (sosReports/{id})
    this.sosReports = {};

    // 10. Assessments (assessments/{id})
    this.assessments = {};

    // 11. Final Reports (finalReports/{id})
    this.finalReports = {};

    // 12. Job Vacancies & Applications (Talent pool)
    this.jobVacancies = {};
    this.jobApplications = {};

    // Notifications log
    this.notifications = [];
  }

  // --- FLOW 01: PRD 3.4 NISN Lookup & Registration ---
  lookupNisn(nisn, schoolId) {
    if (!nisn || typeof nisn !== 'string' || nisn.trim().length === 0) {
      throw new Error('NISN parameter is required and must be non-empty string');
    }
    const cleanNisn = nisn.trim();
    const student = this.roster[cleanNisn];
    if (!student) {
      return { found: false, registered: false };
    }
    if (schoolId && student.schoolId !== schoolId) {
      return { found: false, registered: false };
    }
    return {
      found: true,
      registered: student.registered,
      student: {
        nisn: student.nisn,
        name: student.name,
        schoolId: student.schoolId,
        jurusanId: student.jurusanId,
        kelas: student.kelas
      }
    };
  }

  completeRegistration({ nisn, name, schoolId, jurusanId, kelas, email, password }) {
    const lookup = this.lookupNisn(nisn, schoolId);
    if (!lookup.found) throw new Error('NISN tidak ditemukan pada data roster sekolah');
    if (lookup.registered) throw new Error('Akun dengan NISN ini sudah terdaftar sebelumnya');
    if (!email || !password || password.length < 6) {
      throw new Error('Email dan password minimal 6 karakter diperlukan');
    }

    const uid = `student-${nisn}`;
    // Atomic move from roster to users
    this.roster[nisn].registered = true;
    this.users[uid] = {
      uid,
      email,
      role: 'siswa',
      nisn,
      name,
      schoolId,
      jurusanId,
      kelas,
      createdAt: new Date().toISOString()
    };
    return { success: true, uid };
  }

  // --- FLOW 02: PRD 3.5 Admin Company Directory ---
  getCompanies(filter = {}) {
    let list = Object.values(this.companies);
    if (filter.jurusan) {
      list = list.filter(c => c.jurusanAllowed.includes(filter.jurusan));
    }
    if (filter.availableOnly) {
      list = list.filter(c => c.filledQuota < c.quota);
    }
    return list;
  }

  // --- FLOW 03: PRD 3.6 Admin Add Partner Company ---
  addCompany(companyData, actor) {
    if (actor.role !== 'admin' && actor.role !== 'superadmin') {
      throw new Error('Permission Denied: Only Admin can add company');
    }
    if (!companyData.name || !companyData.lat || !companyData.lng || !companyData.quota) {
      throw new Error('Missing required fields for company registration');
    }
    const id = companyData.id || `comp-${Date.now()}`;
    const newComp = {
      id,
      name: companyData.name,
      address: companyData.address || '',
      lat: Number(companyData.lat),
      lng: Number(companyData.lng),
      geofenceRadiusMeters: companyData.geofenceRadiusMeters || 50,
      quota: Number(companyData.quota),
      filledQuota: 0,
      jurusanAllowed: companyData.jurusanAllowed || ['RPL'],
      createdBySchoolId: actor.schoolId || 'platform'
    };
    this.companies[id] = newComp;
    return newComp;
  }

  // --- FLOW 04: PRD 3.7 Admin Company Detail ---
  getCompanyDetail(companyId) {
    const comp = this.companies[companyId];
    if (!comp) throw new Error('Company not found');
    const interns = Object.values(this.users).filter(u => u.companyId === companyId);
    const supervisors = Object.values(this.users).filter(
      u => u.role === 'pembimbing_instansi' && u.companyId === companyId
    );
    return {
      ...comp,
      interns,
      supervisors,
      availableQuota: comp.quota - comp.filledQuota
    };
  }

  // --- FLOW 05: PRD 3.8 Admin Edit Company ---
  editCompany(companyId, updateData, actor) {
    if (actor.role !== 'admin' && actor.role !== 'superadmin') {
      throw new Error('Permission Denied: Only Admin can edit company');
    }
    const comp = this.companies[companyId];
    if (!comp) throw new Error('Company not found');

    // Security Rules Whitelist: only name, address, lat, lng, geofenceRadiusMeters, jurusanAllowed, quota
    const whitelist = ['name', 'address', 'lat', 'lng', 'geofenceRadiusMeters', 'jurusanAllowed', 'quota'];
    for (const key of Object.keys(updateData)) {
      if (!whitelist.includes(key)) {
        throw new Error(`Permission Denied: Field ${key} cannot be modified directly via updateDoc`);
      }
    }

    if (updateData.quota !== undefined && updateData.quota < comp.filledQuota) {
      throw new Error('Cannot reduce quota below current filledQuota');
    }

    Object.assign(comp, updateData);
    return comp;
  }

  // --- FLOW 06: PRD 3.9 Admin Delete Company (Super Admin only) ---
  deleteCompany(companyId, actor) {
    if (actor.role !== 'superadmin') {
      throw new Error('Permission Denied: Only Super Admin can delete company (platform-level)');
    }
    const comp = this.companies[companyId];
    if (!comp) throw new Error('Company not found');
    if (comp.filledQuota > 0) {
      throw new Error('Cannot delete company with active placed interns');
    }
    delete this.companies[companyId];
    return { success: true };
  }

  // --- FLOW 07: PRD 1.6 / 3.16 Pembimbing Instansi Dynamic QR ---
  generateQrToken(companyId, actor) {
    if (actor.role !== 'pembimbing_instansi' && actor.role !== 'admin') {
      throw new Error('Permission Denied: Only company supervisor or admin can generate QR');
    }
    const comp = this.companies[companyId];
    if (!comp) throw new Error('Company not found');

    const token = crypto.randomUUID();
    const expiresAt = Date.now() + 60 * 1000; // 60 seconds TTL

    const qrData = {
      companyId,
      token,
      lat: comp.lat,
      lng: comp.lng,
      expiresAt,
      generatedBy: actor.uid
    };
    this.qrTokens[companyId] = qrData;
    return qrData;
  }

  // --- FLOW 08: PRD 3.10 Siswa Apply PKL ---
  applyPkl(studentId, companyId, notes = '') {
    const student = this.users[studentId];
    if (!student || student.role !== 'siswa') throw new Error('Invalid student actor');

    // Check for existing active application
    const existing = Object.values(this.applications).find(
      a => a.studentId === studentId && (a.status === 'menunggu' || a.status === 'diterima')
    );
    if (existing) {
      throw new Error('Student already has an active or approved application');
    }

    const comp = this.companies[companyId];
    if (!comp) throw new Error('Company not found');
    if (!comp.jurusanAllowed.includes(student.jurusanId)) {
      throw new Error(`Company does not accept students from major ${student.jurusanId}`);
    }

    const appId = `app-${studentId}-${Date.now()}`;
    const application = {
      id: appId,
      studentId,
      companyId,
      schoolId: student.schoolId,
      status: 'menunggu', // strictly 'menunggu' at creation
      notes,
      appliedAt: new Date().toISOString()
    };
    this.applications[appId] = application;
    return application;
  }

  // --- FLOW 09: PRD 3.11 Admin List Applications ---
  listApplications(schoolId, filterStatus) {
    let list = Object.values(this.applications).filter(a => a.schoolId === schoolId);
    if (filterStatus) {
      list = list.filter(a => a.status === filterStatus);
    }
    return list;
  }

  // --- FLOW 10: PRD 1.7 Admin Decide Application ---
  decideApplication(applicationId, decision, rejectionReason = '', actor) {
    if (actor.role !== 'admin') {
      throw new Error('Permission Denied: Only School Admin can decide application');
    }
    const app = this.applications[applicationId];
    if (!app) throw new Error('Application not found');
    if (app.status !== 'menunggu') throw new Error('Application has already been decided');

    const comp = this.companies[app.companyId];
    if (decision === 'diterima') {
      if (comp.filledQuota >= comp.quota) {
        throw new Error('Company quota is full. Cannot approve application');
      }
      comp.filledQuota += 1;
      app.status = 'diterima';
      this.users[app.studentId].companyId = app.companyId;
    } else if (decision === 'ditolak') {
      app.status = 'ditolak';
      app.rejectionReason = rejectionReason;
    } else {
      throw new Error('Invalid decision');
    }

    app.decidedBy = actor.uid;
    app.decidedAt = new Date().toISOString();

    this.notifications.push({
      recipient: app.studentId,
      title: `Lamaran PKL ${decision.toUpperCase()}`,
      message: `Lamaran Anda ke ${comp.name} telah ${decision}.`
    });

    return app;
  }

  // --- FLOW 11: PRD 3.12 Check-In (Scan QR & Geofencing) ---
  checkIn({ studentId, qrToken, lat, lng, dateString }) {
    const student = this.users[studentId];
    if (!student || !student.companyId) {
      throw new Error('Student is not placed in any company');
    }
    const comp = this.companies[student.companyId];
    const activeQr = this.qrTokens[student.companyId];

    if (!activeQr || activeQr.token !== qrToken) {
      throw new Error('Invalid QR Token for placed company');
    }
    if (Date.now() > activeQr.expiresAt) {
      throw new Error('QR Token has expired (>60s)');
    }

    const distance = haversineDistance(lat, lng, comp.lat, comp.lng);
    if (distance > comp.geofenceRadiusMeters) {
      throw new Error(`Geofence validation failed: Distance ${distance.toFixed(1)}m exceeds limit of ${comp.geofenceRadiusMeters}m`);
    }

    const dateKey = dateString || new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const docId = `${studentId}_${dateKey}`;

    if (this.attendances[docId] && this.attendances[docId].checkIn) {
      throw new Error('Student has already checked in today');
    }

    const attendance = {
      id: docId,
      studentId,
      schoolId: student.schoolId,
      companyId: student.companyId,
      date: dateKey,
      status: 'hadir',
      logbookSubmitted: false, // strictly false initially
      checkIn: {
        time: new Date().toISOString(),
        lat,
        lng,
        distanceMeters: Math.round(distance * 10) / 10,
        verifiedServerSide: true
      }
    };
    this.attendances[docId] = attendance;
    return attendance;
  }

  // --- FLOW 14: PRD 3.15 Hybrid Logbook Submission ---
  getUploadUrl({ bucket, path: filePath, contentType }) {
    if (!bucket || !filePath) throw new Error('Bucket and path required');
    const validMimes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!validMimes.includes(contentType)) {
      throw new Error(`Unsupported contentType: ${contentType}`);
    }

    // Local Mock S3/R2 storage endpoint on port 9090
    const uploadUrl = `http://127.0.0.1:9090/${bucket}/${filePath}?sig=${crypto.randomUUID()}`;
    const publicUrl = `http://127.0.0.1:9090/${bucket}/${filePath}`;
    return { uploadUrl, publicUrl, expiresAt: Date.now() + 300 * 1000 };
  }

  submitLogbook({ studentId, title, category, photoUrl, dateString }) {
    const student = this.users[studentId];
    if (!student || !student.companyId) throw new Error('Student not placed');
    if (!title || !category || !photoUrl) {
      throw new Error('Title, category, and photoUrl are required for Hybrid Logbook');
    }

    const dateKey = dateString || new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const attendanceId = `${studentId}_${dateKey}`;

    if (!this.attendances[attendanceId]) {
      throw new Error('Cannot submit logbook without checking in first');
    }

    const logbookId = `log-${studentId}-${dateKey}`;
    const logbook = {
      id: logbookId,
      studentId,
      schoolId: student.schoolId,
      companyId: student.companyId,
      date: dateKey,
      title,
      category,
      photoUrl,
      reviewStatus: 'menunggu',
      submittedAt: new Date().toISOString()
    };
    this.logbooks[logbookId] = logbook;

    // Trigger onLogbookCreated: updates attendance.logbookSubmitted = true
    this.attendances[attendanceId].logbookSubmitted = true;

    return logbook;
  }

  // --- FLOW 12: PRD 3.13 Check-Out (Gate Enforcement) ---
  checkOut({ studentId, qrToken, lat, lng, dateString }) {
    const student = this.users[studentId];
    const dateKey = dateString || new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const docId = `${studentId}_${dateKey}`;

    const attendance = this.attendances[docId];
    if (!attendance || !attendance.checkIn) {
      throw new Error('Cannot check out without checking in first');
    }

    // Strict Gate Enforcement: logbookSubmitted MUST be true
    if (attendance.logbookSubmitted !== true) {
      throw new Error('Check-Out Barrier Denied: Daily Hybrid Logbook must be submitted before checking out');
    }

    const comp = this.companies[student.companyId];
    const activeQr = this.qrTokens[student.companyId];
    if (!activeQr || activeQr.token !== qrToken) {
      throw new Error('Invalid QR Token for check-out');
    }
    if (Date.now() > activeQr.expiresAt) {
      throw new Error('QR Token has expired (>60s)');
    }

    const distance = haversineDistance(lat, lng, comp.lat, comp.lng);
    if (distance > comp.geofenceRadiusMeters) {
      throw new Error(`Geofence validation failed: Distance ${distance.toFixed(1)}m exceeds limit of ${comp.geofenceRadiusMeters}m`);
    }

    attendance.checkOut = {
      time: new Date().toISOString(),
      lat,
      lng,
      distanceMeters: Math.round(distance * 10) / 10,
      verifiedServerSide: true
    };
    return attendance;
  }

  // --- FLOW 13: PRD 3.14 Guru Realtime Attendance Monitor ---
  monitorAttendances(schoolId, dateString) {
    const dateKey = dateString || new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return Object.values(this.attendances).filter(
      a => a.schoolId === schoolId && a.date === dateKey
    );
  }

  // --- FLOW 15: PRD 3.16 Pembimbing Review Logbook ---
  reviewLogbook(logbookId, reviewStatus, notes, actor) {
    if (actor.role !== 'pembimbing_instansi') {
      throw new Error('Permission Denied: Only Industry Supervisor can review logbook');
    }
    const logbook = this.logbooks[logbookId];
    if (!logbook) throw new Error('Logbook not found');
    if (actor.companyId !== logbook.companyId) {
      throw new Error('Cannot review logbook belonging to another company');
    }

    if (reviewStatus !== 'disetujui' && reviewStatus !== 'ditolak') {
      throw new Error('Invalid reviewStatus');
    }

    logbook.reviewStatus = reviewStatus;
    logbook.notes = notes || '';
    logbook.reviewedBy = actor.uid;
    logbook.reviewedAt = new Date().toISOString();

    // Trigger onLogbookReviewed: Notification sent to student
    this.notifications.push({
      recipient: logbook.studentId,
      title: `Logbook ${reviewStatus.toUpperCase()}`,
      message: `Logbook kegiatan Anda telah ${reviewStatus} oleh pembimbing industri.`
    });

    return logbook;
  }

  // --- FLOW 16: PRD 3.17 Siswa Kirim SOS ---
  submitSosReport({ studentId, lat, lng, message }) {
    const student = this.users[studentId];
    if (!student) throw new Error('Invalid student');

    const id = `sos-${studentId}-${Date.now()}`;
    const report = {
      id,
      studentId,
      schoolId: student.schoolId,
      companyId: student.companyId || null,
      lat,
      lng,
      message: message || 'Laporan Darurat / Kendala PKL',
      status: 'belum-ditinjau',
      createdAt: new Date().toISOString()
    };
    this.sosReports[id] = report;
    return report;
  }

  // --- FLOW 17: PRD 3.18 Guru Tindaklanjut SOS ---
  followupSosReport(sosId, status, followUpNote, actor) {
    if (actor.role !== 'guru_pembimbing' && actor.role !== 'admin') {
      throw new Error('Permission Denied: Only Guru Pembimbing or Admin can followup SOS');
    }
    const report = this.sosReports[sosId];
    if (!report) throw new Error('SOS Report not found');
    if (report.schoolId !== actor.schoolId) {
      throw new Error('Cross-school SOS modification denied');
    }

    report.status = status;
    report.followUpNote = followUpNote;
    report.followedUpBy = actor.uid;
    report.followedUpAt = new Date().toISOString();

    // Trigger onSosStatusChanged: Notification sent to student
    this.notifications.push({
      recipient: report.studentId,
      title: `Laporan Darurat: ${status.toUpperCase()}`,
      message: `Guru Pembimbing telah menindaklanjuti laporan darurat Anda: "${followUpNote}"`
    });

    return report;
  }

  // --- FLOW 18: PRD 3.19 Penilaian Akhir PKL (Two-Stage) ---
  submitAssessment({ studentId, technicalScore, behaviorScore, finalScore, status, actor }) {
    const student = this.users[studentId];
    if (!student) throw new Error('Student not found');
    const school = this.schools[student.schoolId];

    let assessment = Object.values(this.assessments).find(a => a.studentId === studentId);
    if (!assessment) {
      assessment = {
        id: `ass-${studentId}`,
        studentId,
        schoolId: student.schoolId,
        companyId: student.companyId,
        technicalScore: null,
        behaviorScore: null,
        finalScore: null,
        status: 'draft',
        isRecommendedTalent: false
      };
      this.assessments[assessment.id] = assessment;
    }

    // Stage 1: Pembimbing Instansi sets technical and behavior
    if (actor.role === 'pembimbing_instansi') {
      if (technicalScore !== undefined) assessment.technicalScore = Math.max(0, Math.min(100, technicalScore));
      if (behaviorScore !== undefined) assessment.behaviorScore = Math.max(0, Math.min(100, behaviorScore));
      assessment.supervisorGradedBy = actor.uid;
    }

    // Stage 2: Guru Pembimbing / Admin sets finalScore
    if (actor.role === 'guru_pembimbing' || actor.role === 'admin') {
      if (assessment.technicalScore === null || assessment.behaviorScore === null) {
        throw new Error('Cannot submit stage 2 assessment before supervisor completes stage 1');
      }
      if (finalScore !== undefined) {
        assessment.finalScore = Math.max(0, Math.min(100, finalScore));
      }
      if (status === 'final') {
        assessment.status = 'final';
        // Trigger onAssessmentFinalized: evaluate talentThreshold
        assessment.isRecommendedTalent = assessment.finalScore >= school.talentThreshold;
      }
      assessment.teacherGradedBy = actor.uid;
    }

    return assessment;
  }

  // --- FLOW 19: PRD 3.20 Final Report PDF Upload & Admin Validation ---
  uploadFinalReport({ studentId, pdfUrl }) {
    const student = this.users[studentId];
    if (!student) throw new Error('Student not found');

    const id = `rep-${studentId}`;
    const report = {
      id,
      studentId,
      schoolId: student.schoolId,
      pdfUrl,
      status: 'menunggu',
      certificateUrl: null,
      uploadedAt: new Date().toISOString()
    };
    this.finalReports[id] = report;
    return report;
  }

  validateFinalReport(reportId, status, certificateUrl, actor) {
    if (actor.role !== 'admin') {
      throw new Error('Permission Denied: Only School Admin can validate final report');
    }
    const report = this.finalReports[reportId];
    if (!report) throw new Error('Final report not found');

    report.status = status;
    report.certificateUrl = certificateUrl || null;
    report.reviewedBy = actor.uid;
    report.reviewedAt = new Date().toISOString();
    return report;
  }

  // --- FLOW 20: PRD 3.21 Export Laporan dengan Filter ---
  exportReport({ schoolId, startDate, endDate, jurusan, companyId }) {
    let attendances = Object.values(this.attendances).filter(a => a.schoolId === schoolId);
    if (startDate && endDate) {
      attendances = attendances.filter(a => a.date >= startDate && a.date <= endDate);
    }
    if (companyId) {
      attendances = attendances.filter(a => a.companyId === companyId);
    }

    // Enrich with student data
    const records = attendances.map(a => {
      const student = this.users[a.studentId] || {};
      const company = this.companies[a.companyId] || {};
      return {
        date: a.date,
        nisn: student.nisn || '',
        name: student.name || '',
        kelas: student.kelas || '',
        jurusan: student.jurusanId || '',
        company: company.name || '',
        status: a.status,
        logbookSubmitted: a.logbookSubmitted ? 'Ya' : 'Tidak',
        checkInTime: a.checkIn ? a.checkIn.time : '-',
        checkOutTime: a.checkOut ? a.checkOut.time : '-'
      };
    });

    if (jurusan) {
      return records.filter(r => r.jurusan === jurusan);
    }
    return records;
  }

  // --- FLOW 21: Talent Pool & Lowongan Kerja (Class Diagram / ERD) ---
  createJobVacancy(companyId, vacancyData, actor) {
    if (actor.role !== 'pembimbing_instansi') {
      throw new Error('Permission Denied: Only company supervisor can post job vacancy');
    }
    const id = `vac-${Date.now()}`;
    const vacancy = {
      id,
      companyId,
      title: vacancyData.title,
      description: vacancyData.description || '',
      majorRequired: vacancyData.majorRequired || 'RPL',
      quota: vacancyData.quota || 1,
      postedBy: actor.uid,
      createdAt: new Date().toISOString()
    };
    this.jobVacancies[id] = vacancy;
    return vacancy;
  }

  applyJobVacancy(vacancyId, studentId) {
    const student = this.users[studentId];
    if (!student) throw new Error('Student not found');

    const assessment = Object.values(this.assessments).find(a => a.studentId === studentId);
    if (!assessment || !assessment.isRecommendedTalent) {
      throw new Error('Talent Pool Barrier: Only students recommended as talent can apply to exclusive vacancies');
    }

    const vacancy = this.jobVacancies[vacancyId];
    if (!vacancy) throw new Error('Vacancy not found');

    const appId = `jobapp-${studentId}-${vacancyId}`;
    const jobApp = {
      id: appId,
      vacancyId,
      studentId,
      studentName: student.name,
      appliedAt: new Date().toISOString(),
      status: 'melamar'
    };
    this.jobApplications[appId] = jobApp;
    return jobApp;
  }
}

module.exports = {
  VokaLogStateEngine,
  haversineDistance
};
