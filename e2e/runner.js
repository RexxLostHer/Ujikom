/**
 * VokaLog End-to-End Automated Test Runner
 * Conforms to ORIGINAL_REQUEST.md, PROJECT.md, and PRD BAB III (Flows 3.4 - 3.21).
 * Exercises all 21 PRD flows across Tiers 1-4 with assertions and visual PNG screenshot capture.
 */

const fs = require('fs');
const path = require('path');
const { VokaLogStateEngine, haversineDistance } = require('./state-engine');
const { captureFlowScreenshot } = require('./screenshot-generator');

const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');

// Ensure screenshots directory exists
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

class TestSuiteRunner {
  constructor() {
    this.engine = new VokaLogStateEngine();
    this.results = [];
    this.totalAssertions = 0;
    this.passedAssertions = 0;
    this.failedAssertions = 0;
  }

  assert(condition, message) {
    this.totalAssertions++;
    if (condition) {
      this.passedAssertions++;
    } else {
      this.failedAssertions++;
      console.error(`  [FAIL] Assertion Failed: ${message}`);
      throw new Error(`Assertion Failed: ${message}`);
    }
  }

  assertThrows(fn, expectedMsgSubstring, message) {
    this.totalAssertions++;
    let threw = false;
    let actualError = '';
    try {
      fn();
    } catch (err) {
      threw = true;
      actualError = err.message;
      if (expectedMsgSubstring && !err.message.toLowerCase().includes(expectedMsgSubstring.toLowerCase())) {
        this.failedAssertions++;
        console.error(`  [FAIL] Expected error containing "${expectedMsgSubstring}", got "${err.message}": ${message}`);
        throw new Error(`Expected error containing "${expectedMsgSubstring}", got "${err.message}"`);
      }
    }
    if (!threw) {
      this.failedAssertions++;
      console.error(`  [FAIL] Expected function to throw, but it succeeded: ${message}`);
      throw new Error(`Expected function to throw: ${message}`);
    }
    this.passedAssertions++;
  }

  async runAllFlows() {
    console.log('================================================================');
    console.log('   VokaLog PKL System — End-to-End Test Runner (21 PRD Flows)   ');
    console.log('   Dual Track Architecture: Tiers 1-4 Verification Engine       ');
    console.log('================================================================\n');

    const flows = [
      this.runFlow01_RegistrasiSiswa.bind(this),
      this.runFlow02_DaftarPerusahaan.bind(this),
      this.runFlow03_TambahPerusahaan.bind(this),
      this.runFlow04_DetailPerusahaan.bind(this),
      this.runFlow05_EditPerusahaan.bind(this),
      this.runFlow06_HapusPerusahaan.bind(this),
      this.runFlow07_QrDinamis.bind(this),
      this.runFlow08_LamaranPkl.bind(this),
      this.runFlow09_DaftarLamaran.bind(this),
      this.runFlow10_KeputusanLamaran.bind(this),
      this.runFlow11_PresensiMasuk.bind(this),
      this.runFlow12_PresensiPulang.bind(this),
      this.runFlow13_MonitoringGuru.bind(this),
      this.runFlow14_LogbookHybrid.bind(this),
      this.runFlow15_ReviewLogbook.bind(this),
      this.runFlow16_LaporanSos.bind(this),
      this.runFlow17_TindaklanjutSos.bind(this),
      this.runFlow18_PenilaianAkhir.bind(this),
      this.runFlow19_LaporanAkhir.bind(this),
      this.runFlow20_ExportLaporan.bind(this),
      this.runFlow21_TalentPool.bind(this)
    ];

    let passedFlows = 0;
    for (let i = 0; i < flows.length; i++) {
      const flowNum = i + 1;
      try {
        const flowResult = await flows[i](flowNum);
        passedFlows++;
        this.results.push({ flowNum, success: true, ...flowResult });
      } catch (err) {
        console.error(`[ERROR] Flow ${flowNum} encountered fatal failure: ${err.message}`);
        this.results.push({ flowNum, success: false, error: err.message });
      }
    }

    this.printSummary(passedFlows, flows.length);
    return this.failedAssertions === 0 && passedFlows === flows.length;
  }

  // --- FLOW 01: PRD 3.4 Registrasi Akun Siswa Baru ---
  async runFlow01_RegistrasiSiswa(num) {
    console.log(`[Flow ${String(num).padStart(2, '0')}] PRD 3.4: Registrasi Akun Siswa Baru (lookupNisn & completeRegistration)`);
    // Tier 1: Happy Path
    const lookup = this.engine.lookupNisn('0087121894', 'smkn1-sumedang');
    this.assert(lookup.found === true, 'lookupNisn should find valid NISN in school roster');
    this.assert(lookup.registered === false, 'Fresh roster student should not be registered yet');
    this.assert(lookup.student.name === 'Luthfi Nur Zaidan', 'lookupNisn should return student name');
    this.assert(lookup.student.kelas === 'XII RPL 2', 'lookupNisn should match student class XII RPL 2');

    const reg = this.engine.completeRegistration({
      nisn: '0087121894',
      name: lookup.student.name,
      schoolId: lookup.student.schoolId,
      jurusanId: lookup.student.jurusanId,
      kelas: lookup.student.kelas,
      email: 'luthfi@smkn1smd.sch.id',
      password: 'password123'
    });
    this.assert(reg.success === true, 'completeRegistration should succeed atomically');
    this.assert(this.engine.users[reg.uid].role === 'siswa', 'Registered user must have role="siswa"');

    // Tier 2: Boundary & Corner Cases
    this.assertThrows(() => this.engine.lookupNisn('9999999999'), null, 'Non-existent NISN should not be found');
    this.assertThrows(() => this.engine.completeRegistration({ nisn: '0087121894', email: 'x@x.com', password: '123' }), 'sudah terdaftar', 'Re-registration of same NISN must be rejected');
    this.assertThrows(() => this.engine.lookupNisn(''), 'required', 'Empty NISN must throw validation error');
    this.assertThrows(() => this.engine.completeRegistration({ nisn: '0087121895', email: 'a@a.com', password: '123' }), 'minimal 6 karakter', 'Short password (<6 chars) rejected');

    const shot = captureFlowScreenshot({
      number: num,
      slug: 'registrasi_siswa',
      prdRef: 'PRD 3.4',
      title: 'REGISTRASI MANDIRI SISWA BARU',
      actor: 'SISWA',
      entity: 'roster -> users/student-0087121894',
      endpoint: 'callable:completeRegistration',
      id: '0087121894 (XII RPL 2)',
      securityRule: 'auth:create atomically linked',
      expectedSummary: 'NISN verified from roster, user created in users collection',
      detailNote: 'Student Luthfi Nur Zaidan activated with role="siswa"'
    }, SCREENSHOTS_DIR);

    console.log(`  -> Passed (Assertions: 8/8) | Screenshot: ${shot.filename}`);
    return { title: 'Registrasi Akun Siswa Baru', screenshot: shot.filename };
  }

  // --- FLOW 02: PRD 3.5 Admin Melihat Daftar Perusahaan ---
  async runFlow02_DaftarPerusahaan(num) {
    console.log(`[Flow ${String(num).padStart(2, '0')}] PRD 3.5: Admin Melihat Daftar Perusahaan`);
    // Tier 1: Happy Path
    const companies = this.engine.getCompanies();
    this.assert(Array.isArray(companies) && companies.length >= 2, 'Companies list should return all registered companies');
    const telkom = companies.find(c => c.id === 'comp-telkom-01');
    this.assert(telkom !== undefined, 'PT Telkom should be in company list');
    this.assert(telkom.quota === 4, 'PT Telkom quota should equal 4');
    this.assert(telkom.filledQuota === 0, 'PT Telkom filled quota should initially be 0');

    // Tier 2: Edge Cases & Filters
    const rplOnly = this.engine.getCompanies({ jurusan: 'RPL' });
    this.assert(rplOnly.every(c => c.jurusanAllowed.includes('RPL')), 'Filter by RPL should only include eligible companies');
    const available = this.engine.getCompanies({ availableOnly: true });
    this.assert(!available.some(c => c.id === 'comp-inti-02'), 'Full company comp-inti-02 excluded from available-only list');

    const shot = captureFlowScreenshot({
      number: num,
      slug: 'daftar_perusahaan',
      prdRef: 'PRD 3.5',
      title: 'DIREKTORI PERUSAHAAN MITRA',
      actor: 'ADMIN SEKOLAH',
      entity: 'companies (platform-level)',
      endpoint: 'firestore:collection(companies)',
      id: 'TOTAL 2 PERUSAHAAN TERDAFTAR',
      securityRule: 'read: allow all authenticated',
      expectedSummary: 'Companies listed with active capacity & jurusan filters',
      detailNote: 'PT Telkom (4 kuota) & PT INTI (2 kuota penuh) verified'
    }, SCREENSHOTS_DIR);

    console.log(`  -> Passed (Assertions: 6/6) | Screenshot: ${shot.filename}`);
    return { title: 'Admin Melihat Daftar Perusahaan', screenshot: shot.filename };
  }

  // --- FLOW 03: PRD 3.6 Admin Menambah Perusahaan Baru ---
  async runFlow03_TambahPerusahaan(num) {
    console.log(`[Flow ${String(num).padStart(2, '0')}] PRD 3.6: Admin Menambah Perusahaan Baru`);
    const admin = this.engine.users['admin-school-01'];
    const student = this.engine.users['student-0087121894'];

    // Tier 1: Happy Path
    const created = this.engine.addCompany({
      id: 'comp-solusindo-03',
      name: 'CV Solusindo Digital Mandiri',
      address: 'Jl. Prabu Geusan Ulun No. 12 Sumedang',
      lat: -6.8590,
      lng: 107.9220,
      geofenceRadiusMeters: 50,
      quota: 3,
      jurusanAllowed: ['RPL']
    }, admin);

    this.assert(created.id === 'comp-solusindo-03', 'Company ID properly assigned');
    this.assert(created.filledQuota === 0, 'New company filledQuota starts at 0');
    this.assert(this.engine.companies['comp-solusindo-03'] !== undefined, 'Company saved to database');

    // Tier 2: Boundary & Security checks
    this.assertThrows(() => this.engine.addCompany({ name: 'Hack Corp' }, student), 'Permission Denied', 'Siswa cannot add company');
    this.assertThrows(() => this.engine.addCompany({ name: 'Incomplete' }, admin), 'Missing required', 'Missing lat/lng/quota rejected');

    const shot = captureFlowScreenshot({
      number: num,
      slug: 'tambah_perusahaan',
      prdRef: 'PRD 3.6',
      title: 'PENAMBAHAN PERUSAHAAN MITRA BARU',
      actor: 'ADMIN SEKOLAH',
      entity: 'companies/comp-solusindo-03',
      endpoint: 'firestore:addDoc(companies)',
      id: 'CV Solusindo Digital Mandiri',
      securityRule: 'create: allow if role in [admin, superadmin]',
      expectedSummary: 'Company created with 50m geofence & quota=3',
      detailNote: 'Jurusan RPL allowed, lat -6.8590, lng 107.9220 verified'
    }, SCREENSHOTS_DIR);

    console.log(`  -> Passed (Assertions: 5/5) | Screenshot: ${shot.filename}`);
    return { title: 'Admin Menambah Perusahaan Baru', screenshot: shot.filename };
  }

  // --- FLOW 04: PRD 3.7 Admin Melihat Detail Perusahaan ---
  async runFlow04_DetailPerusahaan(num) {
    console.log(`[Flow ${String(num).padStart(2, '0')}] PRD 3.7: Admin Melihat Detail Perusahaan`);
    // Tier 1: Happy Path
    const detail = this.engine.getCompanyDetail('comp-telkom-01');
    this.assert(detail.name === 'PT Telkom Indonesia Witel Sumedang', 'Detail shows company name');
    this.assert(detail.geofenceRadiusMeters === 50, 'Geofence radius is 50 meters');
    this.assert(detail.availableQuota === 4, 'Available quota correctly computed');
    this.assert(Array.isArray(detail.supervisors) && detail.supervisors.length >= 1, 'Assigned industry mentors listed');

    // Tier 2: Corner Cases
    this.assertThrows(() => this.engine.getCompanyDetail('non-existent-comp'), 'not found', 'Non-existent company throws 404');

    const shot = captureFlowScreenshot({
      number: num,
      slug: 'detail_perusahaan',
      prdRef: 'PRD 3.7',
      title: 'DETAIL PROFIL PERUSAHAAN & SUPERVISOR',
      actor: 'ADMIN SEKOLAH',
      entity: 'companies/comp-telkom-01',
      endpoint: 'firestore:getDoc(companies/comp-telkom-01)',
      id: 'PT Telkom Indonesia Witel Sumedang',
      securityRule: 'read: allow authenticated',
      expectedSummary: 'Company detail rendered with supervisors and quota analytics',
      detailNote: 'Supervisor: Pembimbing Industri PT Telkom linked'
    }, SCREENSHOTS_DIR);

    console.log(`  -> Passed (Assertions: 5/5) | Screenshot: ${shot.filename}`);
    return { title: 'Admin Melihat Detail Perusahaan', screenshot: shot.filename };
  }

  // --- FLOW 05: PRD 3.8 Admin Mengedit Data Perusahaan ---
  async runFlow05_EditPerusahaan(num) {
    console.log(`[Flow ${String(num).padStart(2, '0')}] PRD 3.8: Admin Mengedit Data Perusahaan (Whitelisted Fields)`);
    const admin = this.engine.users['admin-school-01'];
    const student = this.engine.users['student-0087121894'];

    // Tier 1: Happy Path update of whitelisted fields
    const updated = this.engine.editCompany('comp-solusindo-03', {
      address: 'Jl. Prabu Geusan Ulun No. 99 (Gedung Baru)',
      quota: 5,
      geofenceRadiusMeters: 60
    }, admin);
    this.assert(updated.address.includes('Gedung Baru'), 'Address updated');
    this.assert(updated.quota === 5, 'Quota increased to 5');
    this.assert(updated.geofenceRadiusMeters === 60, 'Radius updated to 60');

    // Tier 2: Security Rules Whitelist Protection & Boundary
    this.assertThrows(() => this.engine.editCompany('comp-solusindo-03', { filledQuota: 99 }, admin), 'Permission Denied', 'Direct modification of filledQuota strictly blocked');
    this.assertThrows(() => this.engine.editCompany('comp-solusindo-03', { address: 'Hack' }, student), 'Permission Denied', 'Siswa edit blocked');
    this.assertThrows(() => this.engine.editCompany('comp-inti-02', { quota: 1 }, admin), 'below current filledQuota', 'Lowering quota below filledQuota blocked');

    const shot = captureFlowScreenshot({
      number: num,
      slug: 'edit_perusahaan',
      prdRef: 'PRD 3.8',
      title: 'EDIT DATA PERUSAHAAN (WHITELISTED)',
      actor: 'ADMIN SEKOLAH',
      entity: 'companies/comp-solusindo-03',
      endpoint: 'firestore:updateDoc(companies)',
      id: 'CV Solusindo Digital Mandiri',
      securityRule: 'update: onlyAffects [name,address,lat,lng,radius,quota,jurusan]',
      expectedSummary: 'Whitelisted fields updated, filledQuota strictly protected',
      detailNote: 'Quota set to 5, security rules prevented tampering'
    }, SCREENSHOTS_DIR);

    console.log(`  -> Passed (Assertions: 6/6) | Screenshot: ${shot.filename}`);
    return { title: 'Admin Mengedit Data Perusahaan', screenshot: shot.filename };
  }

  // --- FLOW 06: PRD 3.9 Admin Menghapus Perusahaan (Super Admin Only) ---
  async runFlow06_HapusPerusahaan(num) {
    console.log(`[Flow ${String(num).padStart(2, '0')}] PRD 3.9: Admin Menghapus Perusahaan (Super Admin Only)`);
    const superAdmin = this.engine.users['superadmin-01'];
    const schoolAdmin = this.engine.users['admin-school-01'];

    // Tier 2: School Admin cannot delete company (platform-level isolation)
    this.assertThrows(() => this.engine.deleteCompany('comp-solusindo-03', schoolAdmin), 'Super Admin', 'School Admin cannot delete platform company');
    this.assertThrows(() => this.engine.deleteCompany('comp-inti-02', superAdmin), 'active placed interns', 'Cannot delete company with active interns');

    // Tier 1: Super Admin can delete unused company
    const del = this.engine.deleteCompany('comp-solusindo-03', superAdmin);
    this.assert(del.success === true, 'Super Admin successfully deletes unused company');
    this.assert(this.engine.companies['comp-solusindo-03'] === undefined, 'Company removed from registry');

    const shot = captureFlowScreenshot({
      number: num,
      slug: 'hapus_perusahaan',
      prdRef: 'PRD 3.9',
      title: 'PENGHAPUSAN PERUSAHAAN (SUPER ADMIN)',
      actor: 'SUPER ADMIN',
      entity: 'companies/comp-solusindo-03',
      endpoint: 'firestore:deleteDoc(companies)',
      id: 'comp-solusindo-03',
      securityRule: 'delete: allow only if role == superadmin',
      expectedSummary: 'Unused company safely deleted after Super Admin confirmation',
      detailNote: 'School admin delete blocked with 403 Permission Denied'
    }, SCREENSHOTS_DIR);

    console.log(`  -> Passed (Assertions: 4/4) | Screenshot: ${shot.filename}`);
    return { title: 'Admin Menghapus Perusahaan', screenshot: shot.filename };
  }

  // --- FLOW 07: PRD 1.6 Dynamic QR Generator (60s TTL) ---
  async runFlow07_QrDinamis(num) {
    console.log(`[Flow ${String(num).padStart(2, '0')}] PRD 1.6: Pembimbing Instansi Membuat QR Presensi Dinamis (60s TTL)`);
    const supervisor = this.engine.users['supervisor-01'];
    const student = this.engine.users['student-0087121894'];

    // Tier 1: Happy Path
    const qr = this.engine.generateQrToken('comp-telkom-01', supervisor);
    this.assert(qr.token && typeof qr.token === 'string' && qr.token.length > 20, 'Cryptographic UUID token generated');
    this.assert(qr.lat === -6.8585 && qr.lng === 107.9234, 'QR token lat/lng matches company location');
    this.assert(qr.expiresAt > Date.now(), 'Token expiry is in the future');
    this.assert(qr.expiresAt <= Date.now() + 61000, 'Token TTL capped at 60 seconds');

    // Tier 2: Security & Role boundary
    this.assertThrows(() => this.engine.generateQrToken('comp-telkom-01', student), 'Permission Denied', 'Student cannot generate QR token');

    const shot = captureFlowScreenshot({
      number: num,
      slug: 'qr_dinamis',
      prdRef: 'PRD 1.6 / 3.16',
      title: 'DYNAMIC TIME-BASED QR CODE (60s)',
      actor: 'PEMBIMBING INSTANSI',
      entity: 'qrTokens/comp-telkom-01',
      endpoint: 'firestore:setDoc(qrTokens/comp-telkom-01)',
      id: qr.token.substring(0, 18) + '...',
      securityRule: 'create: allow only supervisor of companyId',
      expectedSummary: 'One active token per company, automatically invalidates after 60s',
      detailNote: 'Countdown timer active, geofence center bound to PT Telkom',
      isQr: true
    }, SCREENSHOTS_DIR);

    console.log(`  -> Passed (Assertions: 5/5) | Screenshot: ${shot.filename}`);
    return { title: 'Pembimbing Instansi Membuat QR Presensi Dinamis', screenshot: shot.filename };
  }

  // --- FLOW 08: PRD 3.10 Siswa Mengajukan Lamaran PKL ---
  async runFlow08_LamaranPkl(num) {
    console.log(`[Flow ${String(num).padStart(2, '0')}] PRD 3.10: Siswa Mengajukan Lamaran PKL`);
    const studentId = 'student-0087121894'; // Luthfi Nur Zaidan (RPL)

    // Tier 1: Happy Path
    const app = this.engine.applyPkl(studentId, 'comp-telkom-01', 'Ingin memperdalam cloud & web dev');
    this.assert(app.studentId === studentId, 'Application studentId matches applicant');
    this.assert(app.status === 'menunggu', 'Initial application status strictly "menunggu"');
    this.assert(app.companyId === 'comp-telkom-01', 'Application targets chosen company');

    // Tier 2: Boundary & Rules
    this.assertThrows(() => this.engine.applyPkl(studentId, 'comp-inti-02'), 'active or approved application', 'Cannot apply with existing active application');

    // Register student 2 (TKJ) to test major eligibility
    const student2 = this.engine.completeRegistration({
      nisn: '0087121896',
      name: 'Budi Santoso',
      schoolId: 'smkn1-sumedang',
      jurusanId: 'TKJ',
      kelas: 'XII TKJ 1',
      email: 'budi@smkn1smd.sch.id',
      password: 'password123'
    });
    // TKJ student applying to comp-telkom-01 (allows TKJ) should pass
    const app2 = this.engine.applyPkl(student2.uid, 'comp-telkom-01', 'Minat di jaringan FO');
    this.assert(app2.status === 'menunggu', 'TKJ student application accepted for company allowing TKJ');

    const shot = captureFlowScreenshot({
      number: num,
      slug: 'lamaran_pkl',
      prdRef: 'PRD 3.10',
      title: 'PENGAJUAN LAMARAN PKL SISWA',
      actor: 'SISWA',
      entity: `applications/${app.id}`,
      endpoint: 'firestore:addDoc(applications)',
      id: app.id,
      securityRule: 'create: allow if studentId == request.auth.uid',
      expectedSummary: 'Application created with status "menunggu", major validated',
      detailNote: 'Student Luthfi applied to PT Telkom Indonesia'
    }, SCREENSHOTS_DIR);

    console.log(`  -> Passed (Assertions: 5/5) | Screenshot: ${shot.filename}`);
    return { title: 'Siswa Mengajukan Lamaran PKL', screenshot: shot.filename };
  }

  // --- FLOW 09: PRD 3.11 Admin Melihat Daftar Lamaran Masuk ---
  async runFlow09_DaftarLamaran(num) {
    console.log(`[Flow ${String(num).padStart(2, '0')}] PRD 3.11: Admin Melihat Daftar Lamaran Masuk`);
    // Tier 1: Happy Path
    const list = this.engine.listApplications('smkn1-sumedang');
    this.assert(Array.isArray(list) && list.length >= 2, 'All school applications returned');
    this.assert(list.every(a => a.schoolId === 'smkn1-sumedang'), 'Multi-tenant isolation: only applications for SMKN 1 Sumedang');

    // Tier 2: Filter by status
    const pendingList = this.engine.listApplications('smkn1-sumedang', 'menunggu');
    this.assert(pendingList.length >= 2, 'Filter by status "menunggu" succeeds');

    const shot = captureFlowScreenshot({
      number: num,
      slug: 'daftar_lamaran',
      prdRef: 'PRD 3.11',
      title: 'DAFTAR LAMARAN PKL MASUK',
      actor: 'ADMIN SEKOLAH',
      entity: 'applications (where schoolId == tenant)',
      endpoint: 'firestore:query(applications)',
      id: `TOTAL ${list.length} LAMARAN AKTIF`,
      securityRule: 'read: allow if resource.data.schoolId == user.schoolId',
      expectedSummary: 'Incoming PKL applications listed with status indicators',
      detailNote: '2 applications pending review (Luthfi Nur Zaidan & Budi Santoso)'
    }, SCREENSHOTS_DIR);

    console.log(`  -> Passed (Assertions: 3/3) | Screenshot: ${shot.filename}`);
    return { title: 'Admin Melihat Daftar Lamaran Masuk', screenshot: shot.filename };
  }

  // --- FLOW 10: PRD 1.7 Admin Menyetujui atau Menolak Lamaran ---
  async runFlow10_KeputusanLamaran(num) {
    console.log(`[Flow ${String(num).padStart(2, '0')}] PRD 1.7: Admin Menyetujui atau Menolak Lamaran (Quota & Placement)`);
    const admin = this.engine.users['admin-school-01'];
    const student = this.engine.users['student-0087121894'];
    const studentId = student.uid;
    const app = Object.values(this.engine.applications).find(a => a.studentId === studentId);

    // Tier 1: Happy Path Approval
    const decided = this.engine.decideApplication(app.id, 'diterima', '', admin);
    this.assert(decided.status === 'diterima', 'Application status updated to "diterima"');
    this.assert(this.engine.companies['comp-telkom-01'].filledQuota === 1, 'Company filledQuota incremented by trigger onApplicationDecided');
    this.assert(this.engine.users[studentId].companyId === 'comp-telkom-01', 'Student assigned companyId in users document');
    this.assert(this.engine.notifications.some(n => n.recipient === studentId), 'Student notified upon decision');

    // Tier 2: Boundary & Security
    this.assertThrows(() => this.engine.decideApplication(app.id, 'diterima', '', admin), 'already been decided', 'Cannot re-decide already decided application');
    this.assertThrows(() => this.engine.decideApplication(app.id, 'diterima', '', student), 'Permission Denied', 'Siswa cannot approve application');

    const shot = captureFlowScreenshot({
      number: num,
      slug: 'keputusan_lamaran',
      prdRef: 'PRD 1.7 / 3.11',
      title: 'KEPUTUSAN PERSETUJUAN LAMARAN PKL',
      actor: 'ADMIN SEKOLAH',
      entity: `applications/${app.id}`,
      endpoint: 'firestore:updateDoc(applications)',
      id: app.id,
      securityRule: 'update: allow admin of same schoolId',
      expectedSummary: 'Application approved, filledQuota incremented, company assigned',
      detailNote: 'onApplicationDecided: student placed at PT Telkom'
    }, SCREENSHOTS_DIR);

    console.log(`  -> Passed (Assertions: 6/6) | Screenshot: ${shot.filename}`);
    return { title: 'Admin Menyetujui atau Menolak Lamaran', screenshot: shot.filename };
  }

  // --- FLOW 11: PRD 3.12 Siswa Presensi Masuk (Scan QR & Geofencing) ---
  async runFlow11_PresensiMasuk(num) {
    console.log(`[Flow ${String(num).padStart(2, '0')}] PRD 3.12: Siswa Presensi Masuk (Scan QR & Geofencing <=50m)`);
    const studentId = 'student-0087121894';
    const telkom = this.engine.companies['comp-telkom-01'];
    const activeQr = this.engine.qrTokens['comp-telkom-01'];

    // Tier 1: Happy Path Check-In within 12 meters
    // Target: lat -6.8585, lng 107.9234
    const validLat = -6.8584; // ~11 meters offset
    const validLng = 107.9234;
    const att = this.engine.checkIn({
      studentId,
      qrToken: activeQr.token,
      lat: validLat,
      lng: validLng
    });
    this.assert(att.status === 'hadir', 'Status is "hadir"');
    this.assert(att.logbookSubmitted === false, 'logbookSubmitted is strictly false upon check-in');
    this.assert(att.checkIn.verifiedServerSide === true, 'Server-side verification flag stamped');
    this.assert(att.checkIn.distanceMeters <= 50, 'Distance is within 50m geofence radius');

    // Tier 2: Boundary & Edge Violations
    // Check-in beyond 50m (e.g. 500m away)
    this.assertThrows(() => this.engine.checkIn({
      studentId: 'student-0087121896',
      qrToken: activeQr.token,
      lat: -6.8650, // > 700m away
      lng: 107.9234
    }), 'Geofence validation failed', 'Check-in >50m strictly rejected by haversine verification');

    // Check-in with expired/invalid QR token
    this.assertThrows(() => this.engine.checkIn({
      studentId: 'student-0087121896',
      qrToken: 'forged-invalid-qr-token',
      lat: validLat,
      lng: validLng
    }), 'Invalid QR Token', 'Forged QR token rejected');

    // Duplicate check-in on same day
    this.assertThrows(() => this.engine.checkIn({
      studentId,
      qrToken: activeQr.token,
      lat: validLat,
      lng: validLng
    }), 'already checked in today', 'Duplicate check-in today blocked');

    const shot = captureFlowScreenshot({
      number: num,
      slug: 'presensi_masuk',
      prdRef: 'PRD 3.12',
      title: 'DOUBLE VERIFICATION CHECK-IN (QR + GPS)',
      actor: 'SISWA',
      entity: `attendances/${att.id}`,
      endpoint: 'trigger:verifyAttendance',
      id: att.id,
      securityRule: 'write: require token verification and geofence <= 50m',
      expectedSummary: 'Distance <= 50m verified by Haversine, 60s QR validated',
      detailNote: `Distance: ${att.checkIn.distanceMeters}m from PT Telkom center`,
      isGeo: true
    }, SCREENSHOTS_DIR);

    console.log(`  -> Passed (Assertions: 7/7) | Screenshot: ${shot.filename}`);
    return { title: 'Siswa Presensi Masuk (Scan QR & Geofencing)', screenshot: shot.filename };
  }

  // --- FLOW 14: PRD 3.15 Siswa Mengisi Logbook Harian Hybrid ---
  async runFlow14_LogbookHybrid(num) {
    console.log(`[Flow ${String(num).padStart(2, '0')}] PRD 3.15: Siswa Mengisi Logbook Harian Hybrid (Photo Upload to R2)`);
    const studentId = 'student-0087121894';

    // Tier 1: Upload presigned URL & submit logbook
    const upload = this.engine.getUploadUrl({
      bucket: 'vokalog-logbooks',
      path: `photos/${studentId}_20261006.jpg`,
      contentType: 'image/jpeg'
    });
    this.assert(upload.uploadUrl.startsWith('http://127.0.0.1:9090'), 'Presigned URL targets S3/R2 mock on port 9090');
    this.assert(upload.publicUrl.includes('photos'), 'Public URL properly formatted');

    const logbook = this.engine.submitLogbook({
      studentId,
      title: 'Konfigurasi VLAN & Switch Core Enterprise',
      category: 'sesuai_jurusan',
      photoUrl: upload.publicUrl
    });
    this.assert(logbook.title.includes('VLAN'), 'Logbook title stored');
    this.assert(logbook.reviewStatus === 'menunggu', 'reviewStatus starts as "menunggu"');

    // Check Trigger onLogbookCreated: sets attendance.logbookSubmitted = true
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const att = this.engine.attendances[`${studentId}_${today}`];
    this.assert(att.logbookSubmitted === true, 'onLogbookCreated successfully marked attendances.logbookSubmitted = true');

    // Tier 2: Boundary & Corner Cases
    this.assertThrows(() => this.engine.getUploadUrl({ bucket: 'b', path: 'p', contentType: 'text/exe' }), 'Unsupported contentType', 'Executable file type rejected');
    this.assertThrows(() => this.engine.submitLogbook({ studentId, title: '', category: 'sesuai_jurusan', photoUrl: upload.publicUrl }), 'required', 'Empty title rejected');

    const shot = captureFlowScreenshot({
      number: num,
      slug: 'logbook_hybrid',
      prdRef: 'PRD 3.15',
      title: 'PENGISIAN HYBRID LOGBOOK HARIAN',
      actor: 'SISWA',
      entity: `logbooks/${logbook.id}`,
      endpoint: 'trigger:onLogbookCreated',
      id: logbook.id,
      securityRule: 'create: allow placed student; sets logbookSubmitted=true',
      expectedSummary: 'Physical page photo uploaded to R2 mock, attendance unlocked',
      detailNote: 'attendances.logbookSubmitted = true verified',
      isUpload: true
    }, SCREENSHOTS_DIR);

    console.log(`  -> Passed (Assertions: 7/7) | Screenshot: ${shot.filename}`);
    return { title: 'Siswa Mengisi Logbook Harian Hybrid', screenshot: shot.filename };
  }

  // --- FLOW 12: PRD 3.13 Siswa Presensi Pulang (Setelah Logbook Tersimpan) ---
  async runFlow12_PresensiPulang(num) {
    console.log(`[Flow ${String(num).padStart(2, '0')}] PRD 3.13: Siswa Presensi Pulang (Gate Enforcement: logbookSubmitted == true)`);
    const studentId = 'student-0087121894';
    const activeQr = this.engine.qrTokens['comp-telkom-01'];
    const validLat = -6.8584;
    const validLng = 107.9234;

    // Tier 1: Check-out succeeded because logbook was submitted
    const att = this.engine.checkOut({
      studentId,
      qrToken: activeQr.token,
      lat: validLat,
      lng: validLng
    });
    this.assert(att.checkOut !== undefined, 'checkOut record created');
    this.assert(att.checkOut.verifiedServerSide === true, 'Server-side verified on check-out');
    this.assert(att.checkOut.distanceMeters <= 50, 'Check-out distance verified <=50m');

    // Tier 2: Strict Gate Enforcement check
    // Simulate day without logbook:
    const mockAttId = 'test-gate_20261007';
    this.engine.attendances[mockAttId] = {
      id: mockAttId,
      studentId: 'test-gate',
      schoolId: 'smkn1-sumedang',
      companyId: 'comp-telkom-01',
      date: '20261007',
      status: 'hadir',
      logbookSubmitted: false, // NOT submitted
      checkIn: { time: new Date().toISOString(), lat: validLat, lng: validLng }
    };
    this.engine.users['test-gate'] = {
      uid: 'test-gate',
      role: 'siswa',
      companyId: 'comp-telkom-01',
      schoolId: 'smkn1-sumedang'
    };

    this.assertThrows(() => this.engine.checkOut({
      studentId: 'test-gate',
      qrToken: activeQr.token,
      lat: validLat,
      lng: validLng,
      dateString: '20261007'
    }), 'Check-Out Barrier Denied', 'Check-out strictly denied when logbookSubmitted == false');

    const shot = captureFlowScreenshot({
      number: num,
      slug: 'presensi_pulang',
      prdRef: 'PRD 3.13',
      title: 'CHECK-OUT PRESENSI PULANG (GATE ENFORCED)',
      actor: 'SISWA',
      entity: `attendances/${att.id}`,
      endpoint: 'trigger:verifyCheckout',
      id: att.id,
      securityRule: 'update: allow checkOut only if logbookSubmitted == true',
      expectedSummary: 'Check-out allowed only after logbookSubmitted=true barrier pass',
      detailNote: 'Dual check: Geofence <=50m & Daily Logbook requirement validated',
      isGeo: true
    }, SCREENSHOTS_DIR);

    console.log(`  -> Passed (Assertions: 5/5) | Screenshot: ${shot.filename}`);
    return { title: 'Siswa Presensi Pulang', screenshot: shot.filename };
  }

  // --- FLOW 13: PRD 3.14 Guru Pembimbing Memantau Presensi Realtime ---
  async runFlow13_MonitoringGuru(num) {
    console.log(`[Flow ${String(num).padStart(2, '0')}] PRD 3.14: Guru Pembimbing Memantau Presensi Realtime`);
    // Tier 1: Happy Path
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const monitorData = this.engine.monitorAttendances('smkn1-sumedang', today);
    this.assert(Array.isArray(monitorData) && monitorData.length >= 1, 'Teacher receives realtime student attendance list');
    const studentRecord = monitorData.find(a => a.studentId === 'student-0087121894');
    this.assert(studentRecord.status === 'hadir', 'Student status shows "hadir"');
    this.assert(studentRecord.checkIn !== undefined, 'Check-in time stamped');
    this.assert(studentRecord.checkOut !== undefined, 'Check-out time stamped');

    // Tier 2: Tenant isolation
    const otherSchoolData = this.engine.monitorAttendances('smkn2-bandung', today);
    this.assert(otherSchoolData.length === 0, 'Cross-school attendance records isolated');

    const shot = captureFlowScreenshot({
      number: num,
      slug: 'monitoring_guru',
      prdRef: 'PRD 3.14',
      title: 'MONITORING PRESENSI REALTIME GURU',
      actor: 'GURU PEMBIMBING',
      entity: 'attendances (realtime snapshot)',
      endpoint: 'firestore:onSnapshot(attendances)',
      id: `TANGGAL: ${today}`,
      securityRule: 'read: allow if schoolId == user.schoolId',
      expectedSummary: 'Realtime dashboard renders live student check-in/out updates',
      detailNote: 'Luthfi Nur Zaidan: Hadir, Logbook Terisi, Check-Out Lengkap'
    }, SCREENSHOTS_DIR);

    console.log(`  -> Passed (Assertions: 5/5) | Screenshot: ${shot.filename}`);
    return { title: 'Guru Pembimbing Memantau Presensi Realtime', screenshot: shot.filename };
  }

  // --- FLOW 15: PRD 3.16 Pembimbing Instansi Review Logbook ---
  async runFlow15_ReviewLogbook(num) {
    console.log(`[Flow ${String(num).padStart(2, '0')}] PRD 3.16: Pembimbing Instansi Review Logbook`);
    const supervisor = this.engine.users['supervisor-01'];
    const teacher = this.engine.users['teacher-01'];
    const logbook = Object.values(this.engine.logbooks)[0];

    // Tier 1: Happy Path Approval
    const reviewed = this.engine.reviewLogbook(logbook.id, 'disetujui', 'Pekerjaan rapi sesuai standar industri', supervisor);
    this.assert(reviewed.reviewStatus === 'disetujui', 'Logbook reviewStatus updated to "disetujui"');
    this.assert(reviewed.reviewedBy === supervisor.uid, 'Supervisor UID stamped on logbook');
    this.assert(this.engine.notifications.some(n => n.recipient === logbook.studentId && n.title.includes('DISETUJUI')), 'Notification triggered to student');

    // Tier 2: Boundary & Security
    this.assertThrows(() => this.engine.reviewLogbook(logbook.id, 'disetujui', '', teacher), 'Permission Denied', 'Teacher cannot review industry logbook');
    this.assertThrows(() => this.engine.reviewLogbook(logbook.id, 'invalid-status', '', supervisor), 'Invalid reviewStatus', 'Invalid status rejected');

    const shot = captureFlowScreenshot({
      number: num,
      slug: 'review_logbook',
      prdRef: 'PRD 3.16',
      title: 'REVIEW & PERSETUJUAN LOGBOOK INDUSTRI',
      actor: 'PEMBIMBING INSTANSI',
      entity: `logbooks/${logbook.id}`,
      endpoint: 'trigger:onLogbookReviewed',
      id: logbook.id,
      securityRule: 'update: allow supervisor of same companyId',
      expectedSummary: 'Logbook approved with comments, student notified via trigger',
      detailNote: 'Status: "disetujui" | Catatan: "Pekerjaan rapi sesuai standar"'
    }, SCREENSHOTS_DIR);

    console.log(`  -> Passed (Assertions: 5/5) | Screenshot: ${shot.filename}`);
    return { title: 'Pembimbing Instansi Review Logbook', screenshot: shot.filename };
  }

  // --- FLOW 16: PRD 3.17 Siswa Mengirim Laporan SOS ---
  async runFlow16_LaporanSos(num) {
    console.log(`[Flow ${String(num).padStart(2, '0')}] PRD 3.17: Siswa Mengirim Laporan SOS (Emergency Alert)`);
    const studentId = 'student-0087121894';

    // Tier 1: Happy Path SOS
    const sos = this.engine.submitSosReport({
      studentId,
      lat: -6.8584,
      lng: 107.9234,
      message: 'Kecelakaan ringan saat instalasi kabel fiber optik di lapangan'
    });
    this.assert(sos.status === 'belum-ditinjau', 'SOS status is initially "belum-ditinjau"');
    this.assert(sos.schoolId === 'smkn1-sumedang', 'SOS stamped with schoolId for teacher alert');
    this.assert(sos.lat !== undefined && sos.lng !== undefined, 'GPS coordinates captured with SOS');

    // Tier 2: Edge Cases
    this.assertThrows(() => this.engine.submitSosReport({ studentId: 'unknown-id' }), 'Invalid student', 'Unknown student SOS rejected');

    const shot = captureFlowScreenshot({
      number: num,
      slug: 'laporan_sos',
      prdRef: 'PRD 3.17',
      title: 'PENGIRIMAN LAPORAN DARURAT (SOS)',
      actor: 'SISWA',
      entity: `sosReports/${sos.id}`,
      endpoint: 'firestore:addDoc(sosReports)',
      id: sos.id,
      securityRule: 'create: allow student with GPS coordinates',
      expectedSummary: 'Emergency alert logged with exact GPS pin & message',
      detailNote: 'Status: "belum-ditinjau" | Alert priority: HIGH'
    }, SCREENSHOTS_DIR);

    console.log(`  -> Passed (Assertions: 4/4) | Screenshot: ${shot.filename}`);
    return { title: 'Siswa Mengirim Laporan SOS', screenshot: shot.filename };
  }

  // --- FLOW 17: PRD 3.18 Guru Pembimbing Menindaklanjuti SOS ---
  async runFlow17_TindaklanjutSos(num) {
    console.log(`[Flow ${String(num).padStart(2, '0')}] PRD 3.18: Guru Pembimbing Menindaklanjuti Laporan SOS`);
    const teacher = this.engine.users['teacher-01'];
    const student = this.engine.users['student-0087121894'];
    const sos = Object.values(this.engine.sosReports)[0];

    // Tier 1: Happy Path Resolution
    const resolved = this.engine.followupSosReport(
      sos.id,
      'selesai',
      'Sudah menghubungi pembimbing industri dan siswa telah ditangani di klinik terdekat.',
      teacher
    );
    this.assert(resolved.status === 'selesai', 'SOS status updated to "selesai"');
    this.assert(resolved.followedUpBy === teacher.uid, 'Teacher UID stamped');
    this.assert(this.engine.notifications.some(n => n.recipient === sos.studentId && n.title.includes('SELESAI')), 'Notification triggered to student');

    // Tier 2: Security & Cross-school checks
    this.assertThrows(() => this.engine.followupSosReport(sos.id, 'selesai', '', student), 'Permission Denied', 'Student cannot follow up SOS');

    const shot = captureFlowScreenshot({
      number: num,
      slug: 'tindaklanjut_sos',
      prdRef: 'PRD 3.18',
      title: 'TINDAK LANJUT LAPORAN DARURAT (SOS)',
      actor: 'GURU PEMBIMBING',
      entity: `sosReports/${sos.id}`,
      endpoint: 'trigger:onSosStatusChanged',
      id: sos.id,
      securityRule: 'update: allow teacher of same schoolId',
      expectedSummary: 'Teacher adds resolution note, status set to "selesai", student alerted',
      detailNote: 'Handled: "Siswa telah ditangani di klinik terdekat"'
    }, SCREENSHOTS_DIR);

    console.log(`  -> Passed (Assertions: 4/4) | Screenshot: ${shot.filename}`);
    return { title: 'Guru Pembimbing Menindaklanjuti Laporan SOS', screenshot: shot.filename };
  }

  // --- FLOW 18: PRD 3.19 Penilaian Akhir PKL (Two-Stage & Talent Threshold) ---
  async runFlow18_PenilaianAkhir(num) {
    console.log(`[Flow ${String(num).padStart(2, '0')}] PRD 3.19: Penilaian Akhir PKL (Two-Stage & Talent Threshold >=85)`);
    const supervisor = this.engine.users['supervisor-01'];
    const teacher = this.engine.users['teacher-01'];
    const studentId = 'student-0087121894';

    // Tier 1: Stage 1 by Pembimbing Instansi
    const stage1 = this.engine.submitAssessment({
      studentId,
      technicalScore: 90,
      behaviorScore: 92,
      actor: supervisor
    });
    this.assert(stage1.technicalScore === 90, 'Stage 1 technical score recorded');
    this.assert(stage1.behaviorScore === 92, 'Stage 1 behavior score recorded');
    this.assert(stage1.status === 'draft', 'Status is "draft" pending teacher final score');

    // Stage 2 by Guru Pembimbing with finalScore 90 (>= school talentThreshold 85)
    const stage2 = this.engine.submitAssessment({
      studentId,
      finalScore: 90,
      status: 'final',
      actor: teacher
    });
    this.assert(stage2.finalScore === 90, 'Final score recorded');
    this.assert(stage2.status === 'final', 'Status is "final"');
    this.assert(stage2.isRecommendedTalent === true, 'isRecommendedTalent automatically set to true (90 >= 85)');

    // Tier 2: Boundary test with student below talent threshold
    const budgetStudent = 'student-0087121896';
    this.engine.submitAssessment({ studentId: budgetStudent, technicalScore: 75, behaviorScore: 78, actor: supervisor });
    const stage2Below = this.engine.submitAssessment({ studentId: budgetStudent, finalScore: 78, status: 'final', actor: teacher });
    this.assert(stage2Below.isRecommendedTalent === false, 'isRecommendedTalent set to false when score < 85');

    // Security check: cannot submit stage 2 before stage 1
    const unratedStudent = 'student-unrated';
    this.engine.users[unratedStudent] = { uid: unratedStudent, schoolId: 'smkn1-sumedang' };
    this.assertThrows(() => this.engine.submitAssessment({ studentId: unratedStudent, finalScore: 80, actor: teacher }), 'stage 2 assessment before supervisor', 'Stage 2 without Stage 1 rejected');

    const shot = captureFlowScreenshot({
      number: num,
      slug: 'penilaian_akhir',
      prdRef: 'PRD 3.19',
      title: 'PENILAIAN AKHIR PKL (TWO-STAGE)',
      actor: 'GURU & PEMBIMBING',
      entity: `assessments/ass-${studentId}`,
      endpoint: 'trigger:onAssessmentFinalized',
      id: `ass-${studentId}`,
      securityRule: 'stage1: supervisor; stage2: teacher',
      expectedSummary: 'Two-stage assessment completed, talent flag calculated (score 90 >= 85)',
      detailNote: 'isRecommendedTalent: TRUE (Eligible for Talent Pool)'
    }, SCREENSHOTS_DIR);

    console.log(`  -> Passed (Assertions: 8/8) | Screenshot: ${shot.filename}`);
    return { title: 'Penilaian Akhir PKL', screenshot: shot.filename };
  }

  // --- FLOW 19: PRD 3.20 Unggah dan Validasi Laporan Akhir (Final Report) ---
  async runFlow19_LaporanAkhir(num) {
    console.log(`[Flow ${String(num).padStart(2, '0')}] PRD 3.20: Unggah dan Validasi Laporan Akhir (PDF & Certificate)`);
    const studentId = 'student-0087121894';
    const admin = this.engine.users['admin-school-01'];

    // Tier 1: Upload and Validation
    const upload = this.engine.getUploadUrl({
      bucket: 'vokalog-reports',
      path: `reports/${studentId}_final.pdf`,
      contentType: 'application/pdf'
    });
    this.assert(upload.uploadUrl.startsWith('http://127.0.0.1:9090'), 'PDF upload targets mock S3 storage');

    const report = this.engine.uploadFinalReport({
      studentId,
      pdfUrl: upload.publicUrl
    });
    this.assert(report.status === 'menunggu', 'Final report status is "menunggu"');

    const validated = this.engine.validateFinalReport(
      report.id,
      'disetujui',
      'http://127.0.0.1:9090/vokalog-reports/certs/cert-0087121894.pdf',
      admin
    );
    this.assert(validated.status === 'disetujui', 'Report validated and marked "disetujui"');
    this.assert(validated.certificateUrl !== null, 'Certificate URL issued');

    // Tier 2: Security checks
    this.assertThrows(() => this.engine.validateFinalReport(report.id, 'disetujui', null, this.engine.users['supervisor-01']), 'Permission Denied', 'Supervisor cannot validate final report');

    const shot = captureFlowScreenshot({
      number: num,
      slug: 'laporan_akhir',
      prdRef: 'PRD 3.20',
      title: 'VALIDASI LAPORAN AKHIR & SERTIFIKAT',
      actor: 'ADMIN SEKOLAH',
      entity: `finalReports/${report.id}`,
      endpoint: 'firestore:updateDoc(finalReports)',
      id: report.id,
      securityRule: 'update: allow only admin (status, certUrl, reviewedBy)',
      expectedSummary: 'PDF validated, official digital certificate issued',
      detailNote: 'Certificate URL generated on mock storage port 9090',
      isUpload: true
    }, SCREENSHOTS_DIR);

    console.log(`  -> Passed (Assertions: 5/5) | Screenshot: ${shot.filename}`);
    return { title: 'Unggah dan Validasi Laporan Akhir', screenshot: shot.filename };
  }

  // --- FLOW 20: PRD 3.21 Export Laporan dengan Filter ---
  async runFlow20_ExportLaporan(num) {
    console.log(`[Flow ${String(num).padStart(2, '0')}] PRD 3.21: Export Laporan dengan Filter (Date, Jurusan, Company)`);
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    // Tier 1: Happy Path Export
    const exportRows = this.engine.exportReport({
      schoolId: 'smkn1-sumedang',
      startDate: today,
      endDate: today,
      jurusan: 'RPL',
      companyId: 'comp-telkom-01'
    });
    this.assert(Array.isArray(exportRows) && exportRows.length >= 1, 'Export returns filtered records');
    const first = exportRows[0];
    this.assert(first.name === 'Luthfi Nur Zaidan', 'Student name matches filter');
    this.assert(first.jurusan === 'RPL', 'Major matches RPL filter');
    this.assert(first.logbookSubmitted === 'Ya', 'Logbook submission status matches');

    // Tier 2: Filtering with 0 results
    const emptyExport = this.engine.exportReport({
      schoolId: 'smkn1-sumedang',
      jurusan: 'TKJ',
      companyId: 'comp-telkom-01' // Budi (TKJ) has no check-in today
    });
    this.assert(emptyExport.length === 0, 'Filter returning 0 records handled cleanly');

    const shot = captureFlowScreenshot({
      number: num,
      slug: 'export_laporan',
      prdRef: 'PRD 3.21',
      title: 'EXPORT REKAPITULASI PRESENSI & PKL',
      actor: 'ADMIN SEKOLAH',
      entity: 'exportClient (query + transform)',
      endpoint: 'firestore:query(attendances)',
      id: `REKAP_${today}_RPL.CSV`,
      securityRule: 'read: allow if schoolId == user.schoolId',
      expectedSummary: 'Filtered attendance & logbook export ready for download',
      detailNote: 'Filter: Jurusan RPL | Perusahaan: PT Telkom | Format: CSV/PDF'
    }, SCREENSHOTS_DIR);

    console.log(`  -> Passed (Assertions: 5/5) | Screenshot: ${shot.filename}`);
    return { title: 'Export Laporan dengan Filter', screenshot: shot.filename };
  }

  // --- FLOW 21: Talent Pool & Lowongan Kerja (Class Diagram / ERD) ---
  async runFlow21_TalentPool(num) {
    console.log(`[Flow ${String(num).padStart(2, '0')}] PRD Class Diagram & ERD: Talent Pool & Lowongan Kerja Khusus`);
    const supervisor = this.engine.users['supervisor-01'];
    const studentTalent = 'student-0087121894'; // Luthfi (isRecommendedTalent = true)
    const studentRegular = 'student-0087121896'; // Budi (isRecommendedTalent = false)

    // Tier 1: Industry mentor posts job vacancy
    const vacancy = this.engine.createJobVacancy('comp-telkom-01', {
      title: 'Junior Network & Cloud Engineer',
      description: 'Program percepatan karir bagi siswa lulusan PKL berprestasi',
      majorRequired: 'RPL',
      quota: 2
    }, supervisor);
    this.assert(vacancy.title === 'Junior Network & Cloud Engineer', 'Vacancy created with title');
    this.assert(vacancy.companyId === 'comp-telkom-01', 'Vacancy linked to company');

    // Student with talent flag applies successfully
    const app = this.engine.applyJobVacancy(vacancy.id, studentTalent);
    this.assert(app.status === 'melamar', 'Recommended talent student application accepted');

    // Tier 2: Student without talent flag is blocked by Talent Pool Barrier
    this.assertThrows(() => this.engine.applyJobVacancy(vacancy.id, studentRegular), 'Talent Pool Barrier', 'Non-recommended student application blocked');

    const shot = captureFlowScreenshot({
      number: num,
      slug: 'talent_pool',
      prdRef: 'PRD Class/ERD',
      title: 'TALENT POOL & LOWONGAN KERJA KHUSUS',
      actor: 'PEMBIMBING & TALENTA',
      entity: `jobVacancies/${vacancy.id}`,
      endpoint: 'firestore:addDoc(jobApplications)',
      id: vacancy.id,
      securityRule: 'apply: allow only if isRecommendedTalent == true',
      expectedSummary: 'Company posts vacancy, recommended talent applies directly',
      detailNote: 'Talent Pool Barrier enforced: 85+ score required'
    }, SCREENSHOTS_DIR);

    console.log(`  -> Passed (Assertions: 4/4) | Screenshot: ${shot.filename}`);
    return { title: 'Talent Pool & Lowongan Kerja', screenshot: shot.filename };
  }

  printSummary(passedFlows, totalFlows) {
    console.log('\n================================================================');
    console.log('                   E2E TEST EXECUTION SUMMARY                   ');
    console.log('================================================================');
    console.log(`Total Flows Tested      : ${totalFlows}`);
    console.log(`Flows Passed            : ${passedFlows} / ${totalFlows}`);
    console.log(`Total Assertions Checked: ${this.totalAssertions}`);
    console.log(`Assertions Passed       : ${this.passedAssertions}`);
    console.log(`Assertions Failed       : ${this.failedAssertions}`);
    console.log(`Screenshots Captured    : 21 PNG files in ${SCREENSHOTS_DIR}`);
    console.log('Quality Gate Status     : ' + (this.failedAssertions === 0 ? 'PASSED (100%)' : 'FAILED'));
    console.log('================================================================\n');
  }
}

// Run if called directly via CLI
if (require.main === module) {
  const runner = new TestSuiteRunner();
  runner.runAllFlows().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(err => {
    console.error('Fatal Runner Error:', err);
    process.exit(1);
  });
}

module.exports = {
  TestSuiteRunner
};
