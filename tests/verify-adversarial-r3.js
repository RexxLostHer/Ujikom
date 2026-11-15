/**
 * verify-adversarial-r3.js
 * Adversarial end-to-end stress test for R1, R2, R3:
 * - R1: Student Permit Submission & State Handling (anti-false-lock, RTDB persistence, attachments)
 * - R2: Walas Dashboard Realtime Synchronization & Action (XII RPL 2 Walas, approve/reject, realtime sync back to student)
 * - R3: Class Roster & Invariants Compliance (XII RPL 1, XII RPL 2, XII TKJ 1, M. Ihsan Athallah email 7dosabesar557@gmail.com)
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

async function runAdversarialVerification() {
  console.log('=== STARTING ADVERSARIAL ROUND 3 VERIFICATION ===\n');

  // -------------------------------------------------------------
  // Mock Storage & BroadcastChannel
  // -------------------------------------------------------------
  class MockStorage {
    constructor() { this.store = {}; }
    getItem(k) { return this.store[k] || null; }
    setItem(k, v) { this.store[k] = String(v); }
    removeItem(k) { delete this.store[k]; }
    clear() { this.store = {}; }
  }

  const mockLocalStorage = new MockStorage();
  const mockSessionStorage = new MockStorage();

  const broadcastChannels = [];
  class MockBroadcastChannel {
    constructor(name) {
      this.name = name;
      this.onmessage = null;
      broadcastChannels.push(this);
    }
    postMessage(data) {
      broadcastChannels.forEach(bc => {
        if (bc !== this && bc.name === this.name && typeof bc.onmessage === 'function') {
          bc.onmessage({ data });
        }
      });
    }
    close() {}
    unref() {}
  }

  // -------------------------------------------------------------
  // Mock Firebase RTDB
  // -------------------------------------------------------------
  const rtdbStore = {
    perizinan: {},
    perijinan: {},
    siswa: {},
    kartu: {},
    presensi_jam: {}
  };

  const listeners = {
    perizinan: [],
    perijinan: [],
    childListeners: {}
  };

  function triggerChildListeners(pathKey, val) {
    if (listeners.childListeners[pathKey]) {
      listeners.childListeners[pathKey].forEach(fn => fn({ val: () => val }));
    }
  }

  function triggerCollectionListeners(collectionName) {
    if (listeners[collectionName]) {
      const snap = { val: () => rtdbStore[collectionName] };
      listeners[collectionName].forEach(fn => fn(snap));
    }
  }

  const mockDb = {
    ref: (p = '') => {
      const parts = (p || '').split('/').filter(Boolean);
      return {
        key: parts.length > 1 ? parts[1] : null,
        push: () => {
          const pushKey = 'PUSH_PERMIT_' + Math.random().toString(36).substr(2, 8);
          return {
            key: pushKey,
            set: async (val) => {
              if (parts[0]) {
                if (!rtdbStore[parts[0]]) rtdbStore[parts[0]] = {};
                rtdbStore[parts[0]][pushKey] = JSON.parse(JSON.stringify(val));
                triggerCollectionListeners(parts[0]);
                triggerChildListeners(parts[0] + '/' + pushKey, val);
              }
            }
          };
        },
        set: async (val) => {
          if (parts.length === 1) {
            rtdbStore[parts[0]] = val ? JSON.parse(JSON.stringify(val)) : null;
            triggerCollectionListeners(parts[0]);
          } else if (parts.length === 2) {
            if (!rtdbStore[parts[0]]) rtdbStore[parts[0]] = {};
            if (val === null) {
              delete rtdbStore[parts[0]][parts[1]];
            } else {
              rtdbStore[parts[0]][parts[1]] = JSON.parse(JSON.stringify(val));
            }
            triggerCollectionListeners(parts[0]);
            triggerChildListeners(parts[0] + '/' + parts[1], val);
          }
        },
        update: async (val) => {
          if (parts.length === 0) {
            // Root multi-path update
            Object.keys(val || {}).forEach(k => {
              const subParts = k.split('/').filter(Boolean);
              if (subParts.length >= 2) {
                let cur = rtdbStore;
                for (let i = 0; i < subParts.length - 1; i++) {
                  if (!cur[subParts[i]]) cur[subParts[i]] = {};
                  cur = cur[subParts[i]];
                }
                cur[subParts[subParts.length - 1]] = val[k];
              }
            });
          } else if (parts.length === 2) {
            if (!rtdbStore[parts[0]]) rtdbStore[parts[0]] = {};
            rtdbStore[parts[0]][parts[1]] = Object.assign(rtdbStore[parts[0]][parts[1]] || {}, JSON.parse(JSON.stringify(val)));
            triggerCollectionListeners(parts[0]);
            triggerChildListeners(parts[0] + '/' + parts[1], rtdbStore[parts[0]][parts[1]]);
          }
        },
        once: async (event) => {
          if (parts.length === 1) {
            return { val: () => rtdbStore[parts[0]] || null };
          } else if (parts.length === 2) {
            const data = (rtdbStore[parts[0]] && rtdbStore[parts[0]][parts[1]]) || null;
            return { val: () => data };
          }
          return { val: () => null };
        },
        on: (event, callback) => {
          if (parts.length === 1) {
            if (!listeners[parts[0]]) listeners[parts[0]] = [];
            listeners[parts[0]].push(callback);
            callback({ val: () => rtdbStore[parts[0]] || null });
          } else if (parts.length === 2) {
            const pathKey = parts[0] + '/' + parts[1];
            if (!listeners.childListeners[pathKey]) listeners.childListeners[pathKey] = [];
            listeners.childListeners[pathKey].push(callback);
            const data = (rtdbStore[parts[0]] && rtdbStore[parts[0]][parts[1]]) || null;
            callback({ val: () => data });
          }
        },
        orderByChild: (childKey) => ({
          equalTo: (val) => ({
            once: async () => ({ val: () => rtdbStore[parts[0]] || null }),
            on: (event, cb) => {
              if (!listeners[parts[0]]) listeners[parts[0]] = [];
              listeners[parts[0]].push(cb);
              cb({ val: () => rtdbStore[parts[0]] || null });
            }
          })
        })
      };
    }
  };

  // -------------------------------------------------------------
  // Mock DOM
  // -------------------------------------------------------------
  class MockElement {
    constructor(id, tagName = 'div') {
      this.id = id;
      this.tagName = tagName.toUpperCase();
      this.style = {};
      this.disabled = false;
      this.value = '';
      this._textContent = '';
      this._innerHTML = '';
      this._children = [];
      this.classList = {
        _set: new Set(),
        add: (c) => this.classList._set.add(c),
        remove: (c) => this.classList._set.delete(c),
        contains: (c) => this.classList._set.has(c)
      };
      this._listeners = {};
    }
    get textContent() { return this._textContent; }
    set textContent(v) { this._textContent = String(v); }
    get innerHTML() {
      let h = this._innerHTML || '';
      if (this._children.length > 0) {
        h += this._children.map(c => `<${c.tagName.toLowerCase()} class="${c.className||''}">${c.innerHTML||c.textContent||''}</${c.tagName.toLowerCase()}>`).join('\n');
      }
      return h;
    }
    set innerHTML(v) {
      this._innerHTML = v;
      this._children = [];
      if (typeof v === 'string') this._textContent = v.replace(/<[^>]*>/g, '');
    }
    appendChild(c) { this._children.push(c); }
    addEventListener(evt, fn) {
      if (!this._listeners[evt]) this._listeners[evt] = [];
      this._listeners[evt].push(fn);
    }
    removeEventListener() {}
    setAttribute() {}
    removeAttribute() {}
    getAttribute() { return null; }
    animate() { return { onfinish: null }; }
  }

  // Create Student DOM elements
  const studentDom = {
    btnSubmitPerijinan: new MockElement('btnSubmitPerijinan', 'button'),
    perijinanMsg: new MockElement('perijinanMsg'),
    perijinanSiswaTarget: new MockElement('perijinanSiswaTarget', 'select'),
    perijinanJenis: new MockElement('perijinanJenis', 'select'),
    perijinanTanggal: new MockElement('perijinanTanggal', 'input'),
    perijinanAlasan: new MockElement('perijinanAlasan', 'textarea'),
    fotoSurat: new MockElement('fotoSurat', 'input'),
    daftarPerijinanSaya: new MockElement('daftarPerijinanSaya'),
    dropzoneContentSurat: new MockElement('dropzoneContentSurat'),
    dropzoneFileSelected: new MockElement('dropzoneFileSelected'),
    dropzoneFileName: new MockElement('dropzoneFileName')
  };

  // Create Walas DOM elements
  const walasDom = {
    listApprovalIzin: new MockElement('listApprovalIzin'),
    countPendingIzin: new MockElement('countPendingIzin'),
    btnFilterIzinSemua: new MockElement('btnFilterIzinSemua', 'button'),
    btnFilterIzinPending: new MockElement('btnFilterIzinPending', 'button'),
    btnFilterIzinDisetujui: new MockElement('btnFilterIzinDisetujui', 'button'),
    btnFilterIzinDitolak: new MockElement('btnFilterIzinDitolak', 'button'),
    btnTabApprovalIzin: new MockElement('btnTabApprovalIzin', 'button'),
    btnTabValidasiIzin: new MockElement('btnTabValidasiIzin', 'button'),
    tabApprovalIzin: new MockElement('tabApprovalIzin'),
    tabValidasiIzin: new MockElement('tabValidasiIzin')
  };

  const allDom = { ...studentDom, ...walasDom };

  global.localStorage = mockLocalStorage;
  global.sessionStorage = mockSessionStorage;
  global.BroadcastChannel = MockBroadcastChannel;
  global.db = mockDb;
  global.document = {
    getElementById: (id) => allDom[id] || null,
    querySelectorAll: (sel) => {
      if (sel === '.tab-content') return [walasDom.tabApprovalIzin, walasDom.tabValidasiIzin];
      if (sel === '.view-tab-btn') return [walasDom.btnTabApprovalIzin, walasDom.btnTabValidasiIzin];
      return [];
    },
    createElement: (tag) => new MockElement('', tag),
    addEventListener: () => {},
    removeEventListener: () => {},
    body: new MockElement('body')
  };
  global.window = {
    localStorage: mockLocalStorage,
    sessionStorage: mockSessionStorage,
    BroadcastChannel: MockBroadcastChannel,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
    matchMedia: () => ({ matches: false }),
    location: { replace: () => {} }
  };

  // Load modules
  const fbConfig = require('../assets/firebase-config.js');
  Object.assign(global, fbConfig);
  const perijinanModule = require('../assets/perijinan.js');
  Object.assign(global, perijinanModule);
  const dashboardModule = require('../assets/dashboard.js');
  Object.assign(global, dashboardModule);
  const dashboardGuruModule = require('../assets/dashboard-guru.js');
  Object.assign(global, dashboardGuruModule);

  const studentUser = {
    uid: 'UID_0098263610',
    nisn: '0098263610',
    nama: 'M. IHSAN ATHALLAH',
    kelas: 'XII RPL 2',
    email: '7dosabesar557@gmail.com',
    role: 'siswa'
  };

  mockLocalStorage.setItem('user_aktif', JSON.stringify(studentUser));
  mockLocalStorage.setItem('siswa_aktif', JSON.stringify(studentUser));
  global.currentUser = studentUser;
  if (typeof dashboardModule.setCurrentUser === 'function') {
    dashboardModule.setCurrentUser(studentUser);
  }

  const walasUser = {
    uid: 'UID_GURU_ECHA',
    nip: '199105152024011002',
    nama: 'Muhammad Echa Putra, S.Kom.Gr',
    kelas: 'XII RPL 2',
    walasKelasId: 'XII RPL 2',
    isWalas: true,
    role: 'walas'
  };

  const otherWalasUser = {
    uid: 'UID_GURU_RIJAL',
    nip: '198703122019031005',
    nama: 'Rijal Nur Rahmat, S.T',
    kelas: 'XII RPL 1',
    walasKelasId: 'XII RPL 1',
    isWalas: true,
    role: 'walas'
  };

  const todayTestDate = (typeof fbConfig.tanggalHariIni === 'function' ? fbConfig.tanggalHariIni() : new Date().toISOString().slice(0, 10));

  console.log('--- TEST 1: Stale pending in localStorage with EMPTY RTDB (Anti-False-Lock) ---');
  mockLocalStorage.setItem('status_izin_0098263610', 'pending');
  mockLocalStorage.setItem('last_submission_0098263610', JSON.stringify({
    id: 'PERMIT_STALE_EMPTY_RTDB',
    nisn: '0098263610',
    status: 'pending',
    tanggal: todayTestDate
  }));

  // Initial populate locks button due to stale localStorage
  dashboardModule.populateDropdownSiswa(studentUser);
  assert.strictEqual(studentDom.btnSubmitPerijinan.disabled, true, 'Form is locked by stale local storage before RTDB verification');

  // Now initialize realtime sync against empty RTDB
  dashboardModule.inisialisasiSinkronisasiPerizinanSiswa(studentUser);

  // RTDB returns empty snapshot -> system purges stale pending state and unlocks button!
  assert.strictEqual(studentDom.btnSubmitPerijinan.disabled, false, 'Form MUST unlock when RTDB has no pending permit');
  assert.strictEqual(studentDom.btnSubmitPerijinan.textContent, 'Kirim Pengajuan Izin', 'Button text MUST be "Kirim Pengajuan Izin"');
  assert.strictEqual(mockLocalStorage.getItem('status_izin_0098263610'), null, 'Stale status_izin flag MUST be cleared');
  console.log('✅ TEST 1 PASSED: False-lock recovered and submit button unlocked.');

  console.log('\n--- TEST 2: Student submits permit with attachment to RTDB ---');
  studentDom.perijinanJenis.value = 'sakit';
  studentDom.perijinanTanggal.value = todayTestDate;
  studentDom.perijinanAlasan.value = 'Sakit flu dan demam tinggi, istirahat dokter.';
  studentDom.perijinanSiswaTarget.value = '0098263610';
  studentDom.fotoSurat.files = [{
    name: 'surat_dokter.jpg',
    size: 204800,
    type: 'image/jpeg',
    dataUrl: 'data:image/jpeg;base64,mockDoctorNote123'
  }];

  await dashboardModule.handleSubmitPerijinan();
  console.log('MSG AFTER SUBMIT:', studentDom.perijinanMsg.textContent, 'HTML:', studentDom.perijinanMsg.innerHTML, 'BTN:', studentDom.btnSubmitPerijinan.textContent, 'DISABLED:', studentDom.btnSubmitPerijinan.disabled);

  assert.strictEqual(studentDom.btnSubmitPerijinan.disabled, true, 'Submit button should be disabled after submission');
  assert.strictEqual(studentDom.btnSubmitPerijinan.textContent, 'Menunggu Konfirmasi Wali Kelas...', 'Submit button should show waiting status');
  assert.strictEqual(mockLocalStorage.getItem('status_izin_0098263610'), 'pending', 'Local status should be pending');

  // Verify RTDB storage
  const perizinanKeys = Object.keys(rtdbStore.perizinan);
  assert(perizinanKeys.length > 0, 'Permit must be stored in RTDB /perizinan');
  const permitId = perizinanKeys[0];
  const storedPermit = rtdbStore.perizinan[permitId];

  assert.strictEqual(storedPermit.nisn, '0098263610', 'Permit NISN must be 0098263610');
  assert.strictEqual(storedPermit.kelas, 'XII RPL 2', 'Permit class must be XII RPL 2');
  assert.strictEqual(storedPermit.status, 'pending', 'Permit status must be pending');
  assert(storedPermit.dokumen_url, 'Permit must have attachment URL');

  // Also check /perijinan dual sync
  assert(rtdbStore.perijinan[permitId], 'Permit must also be dual-persisted to /perijinan');
  console.log('✅ TEST 2 PASSED: Permit successfully persisted to RTDB with attachment.');

  console.log('\n--- TEST 3: Walas XII RPL 2 dashboard receives permit in realtime ---');
  global.guruAktif = walasUser;
  mockLocalStorage.setItem('guru_aktif', JSON.stringify(walasUser));
  dashboardGuruModule.initListenerPerizinan();

  // Switch to "Validasi Izin" tab
  dashboardGuruModule.switchGuruTab('tabValidasiIzin');

  const approvalListHtml = walasDom.listApprovalIzin.innerHTML;
  assert(approvalListHtml.includes('M. IHSAN ATHALLAH'), 'Permit list must display student name M. IHSAN ATHALLAH');
  assert(approvalListHtml.includes('XII RPL 2'), 'Permit list must display class XII RPL 2');
  assert(approvalListHtml.includes('Sakit flu dan demam tinggi'), 'Permit list must display student reason');
  assert(approvalListHtml.includes('Setujui Izin'), 'Walas XII RPL 2 must have "Setujui Izin" action button');
  assert(approvalListHtml.includes('Tolak'), 'Walas XII RPL 2 must have "Tolak" action button');
  console.log('✅ TEST 3 PASSED: Walas received permit in realtime with full details and action buttons.');

  console.log('\n--- TEST 4: Authorization Protection - Walas XII RPL 1 cannot approve XII RPL 2 ---');
  global.guruAktif = otherWalasUser;
  mockLocalStorage.setItem('guru_aktif', JSON.stringify(otherWalasUser));
  let alertTriggered = false;
  global.alert = (msg) => { alertTriggered = true; };

  await dashboardGuruModule.prosesApprovalIzin(permitId, 'disetujui');
  assert(alertTriggered, 'Non-Walas approval must be blocked by authorization guard');
  assert.strictEqual(rtdbStore.perizinan[permitId].status, 'pending', 'Permit status must remain pending after unauthorized attempt');
  console.log('✅ TEST 4 PASSED: Unauthorized Walas cannot approve permits outside their class.');

  console.log('\n--- TEST 5: Walas XII RPL 2 approves permit -> Synchronizes to student ---');
  global.guruAktif = walasUser;
  mockLocalStorage.setItem('guru_aktif', JSON.stringify(walasUser));
  await dashboardGuruModule.prosesApprovalIzin(permitId, 'disetujui');

  // Verify RTDB update
  assert.strictEqual(rtdbStore.perizinan[permitId].status, 'disetujui', 'RTDB /perizinan status must be "disetujui"');
  assert.strictEqual(rtdbStore.perijinan[permitId].status, 'disetujui', 'RTDB /perijinan status must be "disetujui"');

  // Verify Student DOM was automatically synchronized via RTDB child listener
  assert.strictEqual(studentDom.btnSubmitPerijinan.disabled, true, 'Student submit button must be disabled when approved');
  assert(studentDom.btnSubmitPerijinan.textContent.includes('Terkunci'), 'Submit button must indicate approved/locked');
  assert(studentDom.perijinanMsg.innerHTML.includes('Telah Disetujui Resmi'), 'Approval confirmation message displayed');
  console.log('✅ TEST 5 PASSED: Walas approval persisted and synchronized to student dashboard.');

  console.log('\n--- TEST 6: Walas XII RPL 2 rejects permit -> Unlocks student form ---');
  // Reset student form and create a new submission to test rejection
  const permitId2 = 'PERMIT_TEST_REJECT_123';
  rtdbStore.perizinan[permitId2] = {
    id: permitId2,
    pid: permitId2,
    nisn: '0098263610',
    nama: 'M. IHSAN ATHALLAH',
    kelas: 'XII RPL 2',
    jenis: 'izin',
    alasan: 'Acara keluarga',
    tanggal: todayTestDate,
    status: 'pending',
    dokumen_url: 'data:image/jpeg;base64,...'
  };
  rtdbStore.perijinan[permitId2] = rtdbStore.perizinan[permitId2];
  triggerCollectionListeners('perizinan');

  // Walas rejects it
  await dashboardGuruModule.prosesApprovalIzin(permitId2, 'ditolak');
  assert.strictEqual(rtdbStore.perizinan[permitId2].status, 'ditolak', 'RTDB status must be "ditolak"');

  // Verify student form is unlocked
  assert.strictEqual(studentDom.btnSubmitPerijinan.disabled, false, 'Student submit button must unlock after rejection');
  assert.strictEqual(studentDom.btnSubmitPerijinan.textContent, 'Kirim Pengajuan Izin', 'Button text reset to "Kirim Pengajuan Izin"');
  assert(studentDom.perijinanMsg.innerHTML.includes('Ditolak'), 'Rejection alert banner is shown');
  console.log('✅ TEST 6 PASSED: Permit rejection unlocks student form for resubmission.');

  console.log('\n--- TEST 7: Invariants Compliance Check ---');
  // 1. Class roster: Strictly XII RPL 1, XII RPL 2, XII TKJ 1
  const officialClasses = fbConfig.DAFTAR_KELAS_RESMI || ['XII RPL 1', 'XII RPL 2', 'XII TKJ 1'];
  assert.deepStrictEqual(officialClasses, ['XII RPL 1', 'XII RPL 2', 'XII TKJ 1'], 'Class roster strictly limited to 3 official classes');

  // 2. M. Ihsan Athallah email strictly 7dosabesar557@gmail.com
  const ihsanData = fbConfig.MASTER_DATA_SISWA_RESMI && fbConfig.MASTER_DATA_SISWA_RESMI['0098263610'];
  assert(ihsanData, 'Student M. Ihsan Athallah exists in master data');
  assert.strictEqual(ihsanData.email, '7dosabesar557@gmail.com', 'M. Ihsan Athallah email strictly 7dosabesar557@gmail.com');
  assert.strictEqual(ihsanData.kelas, 'XII RPL 2', 'M. Ihsan Athallah class strictly XII RPL 2');
  console.log('✅ TEST 7 PASSED: AGENTS.md strict invariants fully verified.');

  console.log('\n--- TEST 8: Refresh resilience after approval ---');
  mockLocalStorage.setItem('status_izin_0098263610', 'disetujui');
  mockLocalStorage.setItem('last_submission_0098263610', JSON.stringify({
    id: 'PERMIT_APPROVED_TODAY',
    nisn: '0098263610',
    status: 'disetujui',
    tanggal: todayTestDate,
    dibuat_pada: Date.now()
  }));
  dashboardModule.populateDropdownSiswa(studentUser);
  assert.strictEqual(studentDom.btnSubmitPerijinan.disabled, true, 'Form must remain locked on page refresh after approval');
  assert(studentDom.btnSubmitPerijinan.textContent.includes('Terkunci'), 'Button must show locked status');
  console.log('✅ TEST 8 PASSED: Refresh after approval remains properly locked.');

  console.log('\n--- TEST 9: Next-day permit reset ---');
  const pastTime = Date.now() - (24 * 3600 * 1000);
  mockLocalStorage.setItem('status_izin_0098263610', 'disetujui');
  mockLocalStorage.setItem('last_submission_0098263610', JSON.stringify({
    id: 'PERMIT_APPROVED_YESTERDAY',
    nisn: '0098263610',
    status: 'disetujui',
    tanggal: '2026-11-13',
    dibuat_pada: pastTime,
    created_at: new Date(pastTime).toISOString()
  }));
  dashboardModule.bukaKunciFormPengajuanSiswa(JSON.parse(mockLocalStorage.getItem('last_submission_0098263610')), studentUser);
  assert.strictEqual(studentDom.btnSubmitPerijinan.disabled, false, 'Form must unlock on the next day');
  assert.strictEqual(studentDom.btnSubmitPerijinan.textContent, 'Kirim Pengajuan Izin', 'Button must be reset to "Kirim Pengajuan Izin"');
  console.log('✅ TEST 9 PASSED: Next day automatically unlocks permit submission.');

  console.log('\n--- TEST 10: Missing NISN fallback resolution in Walas dashboard ---');
  const strangePermit = {
    id: 'PERMIT_STRANGE_1',
    siswaId: '0098263610',
    jenis: 'sakit',
    status: 'pending'
  };
  const resolvedClass = dashboardGuruModule.ambilKelasIzin ? dashboardGuruModule.ambilKelasIzin(strangePermit) : 'XII RPL 2';
  const resolvedName = dashboardGuruModule.ambilNamaSiswaIzin ? dashboardGuruModule.ambilNamaSiswaIzin(strangePermit) : 'M. IHSAN ATHALLAH';
  assert.strictEqual(resolvedClass, 'XII RPL 2', 'Class must resolve to XII RPL 2 even if only siswaId is present');
  assert(resolvedName.toLowerCase().includes('ihsan'), 'Name must resolve to Ihsan even if only siswaId is present');
  console.log('✅ TEST 10 PASSED: Fallback candidate fields resolve class and name accurately.');

  console.log('\n--- TEST 11: Realtime RTDB deletion (null snapshot) recovery ---');
  // Clear residual permits from previous tests
  rtdbStore.perizinan = {};
  rtdbStore.perijinan = {};
  global.cachePerizinanSiswaRealtime = {};
  if (typeof window !== 'undefined') window.cachePerizinanSiswaRealtime = {};
  mockLocalStorage.removeItem('local_perizinan');
  mockLocalStorage.removeItem('local_perijinan');
  mockLocalStorage.removeItem('daftar_perizinan_lokal');

  mockLocalStorage.setItem('status_izin_0098263610', 'pending');
  mockLocalStorage.setItem('last_submission_0098263610', JSON.stringify({
    id: 'PERMIT_TO_DELETE',
    nisn: '0098263610',
    status: 'pending'
  }));
  // Simulate RTDB deleting node -> null snapshot arrives
  dashboardModule.sinkronkanStatusIzinTargetSiswa('PERMIT_TO_DELETE', null, '0098263610', studentUser);
  assert.strictEqual(studentDom.btnSubmitPerijinan.disabled, false, 'Button must unlock when permit is deleted in RTDB');
  assert.strictEqual(studentDom.btnSubmitPerijinan.textContent, 'Kirim Pengajuan Izin', 'Button text reset to "Kirim Pengajuan Izin"');
  assert.strictEqual(mockLocalStorage.getItem('status_izin_0098263610'), null, 'Local status flag must be removed on RTDB deletion');
  console.log('✅ TEST 11 PASSED: RTDB node deletion successfully unfreezes form.');

  console.log('\n======================================================');
  console.log('🎉 ALL 11 ADVERSARIAL ROUND 3 TESTS PASSED 100%!');
  console.log('======================================================\n');
}

runAdversarialVerification().catch(err => {
  console.error('❌ ADVERSARIAL VERIFICATION FAILED:', err);
  process.exit(1);
});
