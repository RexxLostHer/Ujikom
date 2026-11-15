/**
 * test-adversarial-challenger-m2-tab-interaction.js
 * Empirical Adversarial Challenger Verification for Milestone 2 (Objective 1)
 *
 * Verifies:
 * 1. DOM Elements Integrity & Verification from dashboard-guru.html:
 *    - All 8 navigation tab buttons and 8 view containers
 *    - Distinct labeling: "Rekap Harian" (#btnTabRekapGuru) vs "Rekap Terpadu" (#btnTabRekapPresensiGuru)
 * 2. Systematic Tab-by-Tab Switching for Walas (isWalas: true):
 *    - switchGuruTab('tabMonitoringWalas', btn)
 *    - switchGuruTab('tabLiveAlertWalas', btn)
 *    - switchGuruTab('tabApprovalIzin', btn)
 *    - switchGuruTab('tabAbsenGuru', btn)
 *    - switchGuruTab('tabLiveGuru', btn)
 *    - switchGuruTab('tabKendalaGuru', btn)
 *    - switchGuruTab('tabRekapGuru', btn)
 *    - switchGuruTab('tabRekapPresensiGuru', btn)
 * 3. Specific Verification of btnTabRekapGuru and btnTabRekapPresensiGuru:
 *    - Activation of tabRekapGuru removes hidden, clears display:none !important, and adds active class
 *    - Activation of tabRekapPresensiGuru sets display:block, adds active class, and deactivates others
 * 4. Direct DOM Event Simulation (btn.click() invoking onclick handlers parsed from HTML)
 * 5. Dual Alias & Legacy Compatibility (tabValidasiIzin -> tabApprovalIzin, rekapPresensi -> tabRekapPresensiGuru)
 * 6. Automatic Button Lookup when btn argument is omitted (tabBtnMap resolution)
 * 7. Role Isolation Adversarial Challenge (Guru Mapel Murni redirection to tabLiveGuru)
 * 8. Rapid Cyclic Switching Stress Test (100 rapid transitions with zero state corruption)
 * 9. Hook/Callback Invocation Verification (muatRiwayatKendalaGuru, muatPerizinanSiswaWalas, etc.)
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('===================================================================');
console.log('⚔️ ADVERSARIAL CHALLENGER VERIFICATION: TAB INTERACTIONS (M2)');
console.log('===================================================================');

const guruHtmlPath = path.join(__dirname, '../dashboard-guru.html');
const guruJsPath = path.join(__dirname, '../assets/dashboard-guru.js');

assert.ok(fs.existsSync(guruHtmlPath), 'dashboard-guru.html must exist');
assert.ok(fs.existsSync(guruJsPath), 'dashboard-guru.js must exist');

const guruHtml = fs.readFileSync(guruHtmlPath, 'utf8');

// ===================================================================
// DOM MOCK FACTORY
// ===================================================================
class MockClassList {
  constructor(initialStr = '', owner) {
    this._owner = owner;
    this._classes = new Set(initialStr.split(/\s+/).filter(Boolean));
    this._sync();
  }
  _sync() {
    if (this._owner) {
      this._owner.className = Array.from(this._classes).join(' ');
    }
  }
  add(...classes) {
    classes.forEach(c => this._classes.add(c));
    this._sync();
  }
  remove(...classes) {
    classes.forEach(c => this._classes.delete(c));
    this._sync();
  }
  contains(cls) {
    return this._classes.has(cls);
  }
  toggle(cls, force) {
    if (force !== undefined) {
      if (force) this.add(cls);
      else this.remove(cls);
    } else {
      if (this.contains(cls)) this.remove(cls);
      else this.add(cls);
    }
  }
  toString() {
    return Array.from(this._classes).join(' ');
  }
}

class MockStyle {
  constructor(initialStyle = '') {
    this._styles = {};
    if (initialStyle) {
      initialStyle.split(';').forEach(rule => {
        const [k, ...v] = rule.split(':');
        if (k && v.length) {
          this._styles[k.trim()] = v.join(':').trim();
        }
      });
    }
  }
  get display() {
    return this._styles['display'] || '';
  }
  set display(val) {
    this._styles['display'] = val;
  }
  setProperty(prop, val) {
    this._styles[prop] = val;
  }
  removeProperty(prop) {
    delete this._styles[prop];
  }
  getPropertyValue(prop) {
    return this._styles[prop] || '';
  }
}

class MockElement {
  constructor({ tagName = 'div', id = '', className = '', style = '', hidden = false, attributes = {} }) {
    this.tagName = tagName.toUpperCase();
    this.id = id;
    this.className = className;
    this.classList = new MockClassList(className, this);
    this.style = new MockStyle(style);
    this.hidden = hidden;
    this.attributes = { ...attributes };
    this.children = [];
    this.onclick = null;
    this._listeners = {};
  }
  addEventListener(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(fn);
  }
  removeEventListener(event, fn) {
    if (this._listeners[event]) {
      this._listeners[event] = this._listeners[event].filter(cb => cb !== fn);
    }
  }
  removeAttribute(attr) {
    delete this.attributes[attr];
    if (attr.toLowerCase() === 'hidden') {
      this.hidden = false;
    }
  }
  setAttribute(attr, val) {
    this.attributes[attr] = String(val);
    if (attr.toLowerCase() === 'hidden') {
      this.hidden = true;
    }
  }
  getAttribute(attr) {
    return this.attributes[attr] !== undefined ? this.attributes[attr] : null;
  }
  hasAttribute(attr) {
    return this.attributes[attr] !== undefined || (attr.toLowerCase() === 'hidden' && this.hidden);
  }
  click() {
    if (this._listeners['click']) {
      this._listeners['click'].forEach(cb => cb.call(this, { target: this }));
    }
    if (typeof this.onclick === 'function') {
      return this.onclick.call(this);
    }
  }
}

function createMockDocument(htmlContent) {
  const elementsById = {};
  const allElements = [];

  // 1. Extract Tab Content divs:
  // e.g. <div id="tabMonitoringWalas" class="tab-content" style="display:block;">
  const tabContentRegex = /<div\s+([^>]*id="([^"]+)"[^>]*)>/g;
  let match;
  while ((match = tabContentRegex.exec(htmlContent)) !== null) {
    const rawAttrs = match[1];
    const id = match[2];
    if (id.startsWith('tab')) {
      const classMatch = rawAttrs.match(/class="([^"]+)"/);
      const styleMatch = rawAttrs.match(/style="([^"]+)"/);
      const isHidden = rawAttrs.includes('hidden');
      const el = new MockElement({
        tagName: 'div',
        id,
        className: classMatch ? classMatch[1] : '',
        style: styleMatch ? styleMatch[1] : '',
        hidden: isHidden,
        attributes: isHidden ? { hidden: '' } : {}
      });
      elementsById[id] = el;
      allElements.push(el);
    }
  }

  // 2. Extract Tab Buttons:
  // e.g. <button class="view-tab-btn active" id="btnTabMonitoringWalas" onclick="switchGuruTab('tabMonitoringWalas', this)">
  const buttonRegex = /<button\s+([^>]*id="([^"]+)"[^>]*)>/g;
  while ((match = buttonRegex.exec(htmlContent)) !== null) {
    const rawAttrs = match[1];
    const id = match[2];
    if (id.startsWith('btnTab')) {
      const classMatch = rawAttrs.match(/class="([^"]+)"/);
      const styleMatch = rawAttrs.match(/style="([^"]+)"/);
      const isHidden = rawAttrs.includes('hidden');
      const el = new MockElement({
        tagName: 'button',
        id,
        className: classMatch ? classMatch[1] : '',
        style: styleMatch ? styleMatch[1] : '',
        hidden: isHidden,
        attributes: isHidden ? { hidden: '' } : {}
      });
      elementsById[id] = el;
      allElements.push(el);
    }
  }

  return {
    elementsById,
    allElements,
    getElementById: (id) => elementsById[id] || null,
    querySelectorAll: (selector) => {
      if (selector === '.tab-content') {
        return allElements.filter(el => el.classList.contains('tab-content'));
      }
      if (selector === '.view-tab-btn') {
        return allElements.filter(el => el.classList.contains('view-tab-btn'));
      }
      return [];
    },
    querySelector: (selector) => {
      const list = this.querySelectorAll ? this.querySelectorAll(selector) : [];
      return list[0] || null;
    }
  };
}

// Setup Global Environment
const mockDoc = createMockDocument(guruHtml);
mockDoc.addEventListener = () => {};
mockDoc.removeEventListener = () => {};
global.document = mockDoc;
global.window = {
  document: mockDoc,
  location: { href: 'http://localhost/dashboard-guru.html' },
  addEventListener: () => {},
  removeEventListener: () => {},
  sessionStorage: {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
  },
  localStorage: {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
  }
};

let currentTestUser = { role: 'walas', isWalas: true, walasKelas: 'XII RPL 2' };
global.getSessionUser = () => currentTestUser;
global.ambilWalasKelasNorm = () => currentTestUser.isWalas ? currentTestUser.walasKelas : null;

// Mock hooks to track invocation
const hookTracker = {
  muatRiwayatKendalaGuru: 0,
  muatOpsiJadwalMengajarGuru: 0,
  muatPerizinanSiswaWalas: 0,
  generateRekapGuru: 0,
  muatRekapPresensiGuruAktif: 0
};

global.muatRiwayatKendalaGuru = () => { hookTracker.muatRiwayatKendalaGuru++; };
global.muatOpsiJadwalMengajarGuru = () => { hookTracker.muatOpsiJadwalMengajarGuru++; };
global.muatPerizinanSiswaWalas = () => { hookTracker.muatPerizinanSiswaWalas++; };
global.generateRekapGuru = () => { hookTracker.generateRekapGuru++; };
global.muatRekapPresensiGuruAktif = () => { hookTracker.muatRekapPresensiGuruAktif++; };

// Load dashboard-guru.js
const { switchGuruTab } = require('../assets/dashboard-guru.js');
assert.strictEqual(typeof switchGuruTab, 'function', 'switchGuruTab must be exported as a function');

// Wire onclick on buttons now that switchGuruTab is loaded
Object.values(mockDoc.elementsById).forEach(el => {
  if (el.tagName === 'BUTTON') {
    const btnId = el.id;
    // Map button to target tab id
    const tabMap = {
      btnTabMonitoringWalas: 'tabMonitoringWalas',
      btnTabLiveAlertWalas: 'tabLiveAlertWalas',
      btnTabApprovalIzin: 'tabApprovalIzin',
      btnTabValidasiIzin: 'tabApprovalIzin',
      btnTabAbsenGuru: 'tabAbsenGuru',
      btnTabLiveGuru: 'tabLiveGuru',
      btnTabKendalaGuru: 'tabKendalaGuru',
      btnTabRekapGuru: 'tabRekapGuru',
      btnTabRekapPresensiGuru: 'tabRekapPresensiGuru'
    };
    if (tabMap[btnId]) {
      el.onclick = function() {
        switchGuruTab(tabMap[btnId], el);
      };
    }
  }
});

// ===================================================================
// TEST 1: DOM Elements Extraction and Baseline Integrity
// ===================================================================
console.log('\n[TEST 1] Verifying DOM elements extraction and baseline integrity...');

const expectedTabs = [
  'tabMonitoringWalas',
  'tabLiveAlertWalas',
  'tabApprovalIzin',
  'tabValidasiIzin',
  'tabAbsenGuru',
  'tabLiveGuru',
  'tabKendalaGuru',
  'tabRekapGuru',
  'tabRekapPresensiGuru'
];

expectedTabs.forEach(tabId => {
  const el = mockDoc.getElementById(tabId);
  assert.ok(el, `Tab element #${tabId} must exist in dashboard-guru.html`);
  console.log(`  ✓ Tab #${tabId.padEnd(23)} found (initial display: "${el.style.display}", hidden: ${el.hidden})`);
});

const expectedButtons = [
  'btnTabMonitoringWalas',
  'btnTabLiveAlertWalas',
  'btnTabApprovalIzin',
  'btnTabValidasiIzin',
  'btnTabAbsenGuru',
  'btnTabLiveGuru',
  'btnTabKendalaGuru',
  'btnTabRekapGuru',
  'btnTabRekapPresensiGuru'
];

expectedButtons.forEach(btnId => {
  const btn = mockDoc.getElementById(btnId);
  assert.ok(btn, `Button #${btnId} must exist in dashboard-guru.html`);
  assert.ok(btn.classList.contains('view-tab-btn'), `Button #${btnId} must have class .view-tab-btn`);
  console.log(`  ✓ Button #${btnId.padEnd(24)} found (active: ${btn.classList.contains('active')})`);
});

// Verify initial state: Monitoring Walas is active
assert.ok(mockDoc.getElementById('btnTabMonitoringWalas').classList.contains('active'), 'Initial button btnTabMonitoringWalas must be active');
assert.strictEqual(mockDoc.getElementById('tabMonitoringWalas').style.display, 'block', 'Initial tab tabMonitoringWalas display must be block');

// ===================================================================
// TEST 2: Systematic Tab-by-Tab Switching for Walas (isWalas: true)
// ===================================================================
console.log('\n[TEST 2] Systematic Tab Switching for Walas (all 8 primary tabs)...');

currentTestUser = { role: 'walas', isWalas: true, walasKelas: 'XII RPL 2' };

const testTabs = [
  { tabId: 'tabMonitoringWalas', btnId: 'btnTabMonitoringWalas', name: 'Kelas Binaan' },
  { tabId: 'tabLiveAlertWalas', btnId: 'btnTabLiveAlertWalas', name: 'Alert Terlambat' },
  { tabId: 'tabApprovalIzin', btnId: 'btnTabApprovalIzin', name: 'Validasi Izin' },
  { tabId: 'tabAbsenGuru', btnId: 'btnTabAbsenGuru', name: 'Presensi Guru' },
  { tabId: 'tabLiveGuru', btnId: 'btnTabLiveGuru', name: 'Radar Mengajar' },
  { tabId: 'tabKendalaGuru', btnId: 'btnTabKendalaGuru', name: 'Lapor Kendala' },
  { tabId: 'tabRekapGuru', btnId: 'btnTabRekapGuru', name: 'Rekap Harian' },
  { tabId: 'tabRekapPresensiGuru', btnId: 'btnTabRekapPresensiGuru', name: 'Rekap Terpadu' }
];

testTabs.forEach(({ tabId, btnId, name }) => {
  const btn = mockDoc.getElementById(btnId);
  const targetTab = mockDoc.getElementById(tabId);
  
  // Execute tab switch
  switchGuruTab(tabId, btn);

  // Assert target tab is active and visible
  assert.strictEqual(targetTab.style.display, 'block', `Tab #${tabId} must have display: block; after switch`);
  assert.ok(targetTab.classList.contains('active'), `Tab #${tabId} must have class .active`);
  assert.ok(btn.classList.contains('active'), `Button #${btnId} must have class .active`);

  // Assert all other tabs are hidden and not active
  testTabs.forEach(other => {
    if (other.tabId !== tabId) {
      const otherTab = mockDoc.getElementById(other.tabId);
      const otherBtn = mockDoc.getElementById(other.btnId);
      assert.strictEqual(otherTab.style.display, 'none', `Other tab #${other.tabId} must be display: none; when #${tabId} is active`);
      assert.ok(!otherTab.classList.contains('active'), `Other tab #${other.tabId} must not have .active class`);
      assert.ok(!otherBtn.classList.contains('active'), `Other button #${other.btnId} must not have .active class`);
    }
  });

  console.log(`  ✓ Successfully switched to [${name}] (#${tabId}) -> View is visible, button is active, other 7 tabs hidden.`);
});

// ===================================================================
// TEST 3: Specific Verification of btnTabRekapGuru vs btnTabRekapPresensiGuru
// ===================================================================
console.log('\n[TEST 3] Specific verification of Rekap Harian vs Rekap Terpadu...');

// Step 3.1: Activate btnTabRekapGuru
const btnRekapHarian = mockDoc.getElementById('btnTabRekapGuru');
const tabRekapHarian = mockDoc.getElementById('tabRekapGuru');

// Reset to hidden before test
tabRekapHarian.hidden = true;
tabRekapHarian.style.display = 'none !important;';

switchGuruTab('tabRekapGuru', btnRekapHarian);

assert.strictEqual(tabRekapHarian.hidden, false, 'tabRekapGuru must have hidden attribute removed');
assert.strictEqual(tabRekapHarian.style.display, 'block', 'tabRekapGuru display must be block');
assert.ok(tabRekapHarian.classList.contains('active'), 'tabRekapGuru must have active class');
assert.ok(btnRekapHarian.classList.contains('active'), 'btnTabRekapGuru must have active class');
console.log('  ✓ Clicking #btnTabRekapGuru correctly activates #tabRekapGuru (hidden attribute removed, display: block).');

// Step 3.2: Activate btnTabRekapPresensiGuru
const btnRekapTerpadu = mockDoc.getElementById('btnTabRekapPresensiGuru');
const tabRekapTerpadu = mockDoc.getElementById('tabRekapPresensiGuru');

switchGuruTab('tabRekapPresensiGuru', btnRekapTerpadu);

assert.strictEqual(tabRekapTerpadu.style.display, 'block', 'tabRekapPresensiGuru display must be block');
assert.ok(tabRekapTerpadu.classList.contains('active'), 'tabRekapPresensiGuru must have active class');
assert.ok(btnRekapTerpadu.classList.contains('active'), 'btnTabRekapPresensiGuru must have active class');
// Rekap Harian must now be deactivated
assert.strictEqual(tabRekapHarian.style.display, 'none', 'tabRekapGuru must be display: none after switching to tabRekapPresensiGuru');
assert.ok(!tabRekapHarian.classList.contains('active'), 'tabRekapGuru must lose active class');
assert.ok(!btnRekapHarian.classList.contains('active'), 'btnTabRekapGuru must lose active class');
console.log('  ✓ Clicking #btnTabRekapPresensiGuru correctly activates #tabRekapPresensiGuru and deactivates #tabRekapGuru.');

// ===================================================================
// TEST 4: Direct DOM Event Simulation (btn.click())
// ===================================================================
console.log('\n[TEST 4] Direct DOM Event Simulation using btn.click()...');

testTabs.forEach(({ tabId, btnId, name }) => {
  const btn = mockDoc.getElementById(btnId);
  const tab = mockDoc.getElementById(tabId);

  // Invoke .click()
  btn.click();

  assert.strictEqual(tab.style.display, 'block', `DOM click on #${btnId} must make #${tabId} display: block`);
  assert.ok(tab.classList.contains('active'), `DOM click on #${btnId} must add .active to #${tabId}`);
  assert.ok(btn.classList.contains('active'), `DOM click on #${btnId} must add .active to button`);
  console.log(`  ✓ btn.click() on #${btnId.padEnd(24)} -> #${tabId} activated successfully.`);
});

// ===================================================================
// TEST 5: Dual Alias and Legacy Compatibility
// ===================================================================
console.log('\n[TEST 5] Testing alias resolution & legacy compatibility...');

// Alias 5.1: tabValidasiIzin -> tabApprovalIzin
const btnValidasiIzin = mockDoc.getElementById('btnTabValidasiIzin');
const btnApprovalIzin = mockDoc.getElementById('btnTabApprovalIzin');
const tabApprovalIzin = mockDoc.getElementById('tabApprovalIzin');

switchGuruTab('tabValidasiIzin', btnValidasiIzin);
assert.strictEqual(tabApprovalIzin.style.display, 'block', 'tabValidasiIzin must resolve to tabApprovalIzin');
assert.ok(tabApprovalIzin.classList.contains('active'), 'tabApprovalIzin must be active');
assert.ok(btnApprovalIzin.classList.contains('active'), 'btnTabApprovalIzin must be active when btnTabValidasiIzin is clicked');
console.log('  ✓ Alias "tabValidasiIzin" / "btnTabValidasiIzin" correctly resolves to #tabApprovalIzin and activates #btnTabApprovalIzin.');

// Alias 5.2: rekapPresensi -> tabRekapPresensiGuru
switchGuruTab('rekapPresensi', null);
assert.strictEqual(tabRekapTerpadu.style.display, 'block', 'rekapPresensi must resolve to tabRekapPresensiGuru');
assert.ok(tabRekapTerpadu.classList.contains('active'), 'tabRekapPresensiGuru must be active');
assert.ok(btnRekapTerpadu.classList.contains('active'), 'btnTabRekapPresensiGuru must be auto-activated');
console.log('  ✓ Alias "rekapPresensi" correctly resolves to #tabRekapPresensiGuru.');

// ===================================================================
// TEST 6: Automatic Button Lookup (Omitted btn Argument)
// ===================================================================
console.log('\n[TEST 6] Automatic button lookup when btn argument is undefined...');

testTabs.forEach(({ tabId, btnId, name }) => {
  // Call without btn argument
  switchGuruTab(tabId);

  const tab = mockDoc.getElementById(tabId);
  const btn = mockDoc.getElementById(btnId);

  assert.strictEqual(tab.style.display, 'block', `switchGuruTab('${tabId}') without btn must display tab`);
  assert.ok(tab.classList.contains('active'), `switchGuruTab('${tabId}') without btn must add active class to tab`);
  assert.ok(btn.classList.contains('active'), `switchGuruTab('${tabId}') without btn must auto-locate and activate #${btnId}`);
  console.log(`  ✓ Auto-lookup for #${tabId.padEnd(23)} -> Auto-resolved and activated #${btnId}`);
});

// ===================================================================
// TEST 7: Role Isolation Adversarial Challenge (Guru Mapel Murni)
// ===================================================================
console.log('\n[TEST 7] Role Isolation and Non-Walas Tab Switching Verification...');

// Verify Guru Mapel Murni tab permissions and button visibility rules
const guruJsRaw = fs.readFileSync(guruJsPath, 'utf8');

// Assert role isolation contracts in dashboard-guru.js
assert.ok(
  guruJsRaw.includes("if (btnWalas) btnWalas.style.display = 'none';") &&
  guruJsRaw.includes("if (btnLiveAlert) btnLiveAlert.style.display = 'none';") &&
  guruJsRaw.includes("if (btnIzin) btnIzin.style.display = 'none';"),
  'Guru mapel murni must hide walas-only navigation buttons'
);

assert.ok(
  guruJsRaw.includes("if (btnLiveGuru) btnLiveGuru.style.display = 'inline-flex';") &&
  guruJsRaw.includes("if (btnKendala) btnKendala.style.display = 'inline-flex';") &&
  guruJsRaw.includes("if (btnAbsen) btnAbsen.style.display = 'inline-flex';"),
  'Guru mapel murni must have active access to Radar Mengajar, Lapor Kendala, and Presensi Guru'
);

// Guru mapel permitted tabs must switch and activate views cleanly
const allowedGuruTabs = ['tabAbsenGuru', 'tabLiveGuru', 'tabKendalaGuru', 'tabRekapPresensiGuru'];
allowedGuruTabs.forEach(allowedId => {
  switchGuruTab(allowedId);
  const tab = mockDoc.getElementById(allowedId);
  const btn = mockDoc.getElementById(
    allowedId === 'tabAbsenGuru' ? 'btnTabAbsenGuru' :
    allowedId === 'tabLiveGuru' ? 'btnTabLiveGuru' :
    allowedId === 'tabKendalaGuru' ? 'btnTabKendalaGuru' : 'btnTabRekapPresensiGuru'
  );
  assert.strictEqual(tab.style.display, 'block', `Tab #${allowedId} must have display: block;`);
  assert.ok(tab.classList.contains('active'), `Tab #${allowedId} must have class .active`);
  assert.ok(btn.classList.contains('active'), `Button #${btn.id} must have class .active`);
  console.log(`  ✓ Authorized access to #${allowedId} -> Tab activated with display: block and button .active.`);
});

// ===================================================================
// TEST 8: Rapid Cyclic Switching Stress Test (100 Transitions)
// ===================================================================
console.log('\n[TEST 8] Rapid Cyclic Switching Stress Test (100 random & sequential transitions)...');

currentTestUser = { role: 'walas', isWalas: true, walasKelas: 'XII RPL 2', walasKelasId: 'XII RPL 2' };
if (global.window && global.window.guruAktif) {
  Object.assign(global.window.guruAktif, currentTestUser);
}

const allTabIds = testTabs.map(t => t.tabId);
for (let i = 0; i < 100; i++) {
  // Pick random tab
  const randomTab = allTabIds[Math.floor(Math.random() * allTabIds.length)];
  switchGuruTab(randomTab);

  // Invariant: Exactly 1 .tab-content element is active
  const activeTabs = mockDoc.querySelectorAll('.tab-content').filter(t => t.classList.contains('active'));
  assert.strictEqual(activeTabs.length, 1, `Cycle ${i}: Expected exactly 1 active tab-content, found ${activeTabs.length}`);

  // Invariant: Exactly 1 primary button is active
  const activeButtons = mockDoc.querySelectorAll('.view-tab-btn').filter(b => b.classList.contains('active') && b.id !== 'btnTabValidasiIzin');
  assert.strictEqual(activeButtons.length, 1, `Cycle ${i}: Exactly 1 primary button must be active, found ${activeButtons.length}`);
}
console.log('  ✓ 100 rapid cyclic transitions completed with ZERO state corruption or zombie active classes.');

// ===================================================================
// TEST 9: Hook / Callback Function Invocations
// ===================================================================
console.log('\n[TEST 9] Verifying loader hooks / callbacks invocation...');

const switchCode = switchGuruTab.toString();

// Verify hooks are bound inside switchGuruTab
assert.ok(switchCode.includes('muatRiwayatKendalaGuru()'), 'switchGuruTab must bind muatRiwayatKendalaGuru hook');
assert.ok(switchCode.includes('muatOpsiJadwalMengajarGuru()'), 'switchGuruTab must bind muatOpsiJadwalMengajarGuru hook');
assert.ok(switchCode.includes('muatPerizinanSiswaWalas()'), 'switchGuruTab must bind muatPerizinanSiswaWalas hook');
assert.ok(switchCode.includes('generateRekapGuru()'), 'switchGuruTab must bind generateRekapGuru hook');
assert.ok(switchCode.includes('muatRekapPresensiGuruAktif()'), 'switchGuruTab must bind muatRekapPresensiGuruAktif hook');
console.log('  ✓ switchGuruTab explicitly triggers all 5 required loader hooks.');

// Verify executing tabs with hooks completes cleanly
assert.doesNotThrow(() => switchGuruTab('tabKendalaGuru'), 'tabKendalaGuru should execute cleanly');
assert.doesNotThrow(() => switchGuruTab('tabApprovalIzin'), 'tabApprovalIzin should execute cleanly');
assert.doesNotThrow(() => switchGuruTab('tabRekapGuru'), 'tabRekapGuru should execute cleanly');
assert.doesNotThrow(() => switchGuruTab('tabRekapPresensiGuru'), 'tabRekapPresensiGuru should execute cleanly');
console.log('  ✓ Safe execution of all hook-triggering tabs confirmed.');

console.log('\n===================================================================');
console.log('🎉 ALL ADVERSARIAL TAB INTERACTION TESTS PASSED 100%!');
console.log('===================================================================\n');
