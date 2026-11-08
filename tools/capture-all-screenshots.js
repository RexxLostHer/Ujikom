/**
 * Complete UI/UX Screenshot Automation Engine
 * Captures 71 full-fidelity desktop screenshots across all 4 roles (Admin, Siswa, Guru, Walas)
 * SMKN 1 Sumedang Presensi IoT Platform
 *
 * Runs on Node.js using native HTTP static server and Chrome DevTools Protocol (CDP) via WebSocket.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const CHROME_PATH = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const UJIKOM_DIR = path.resolve(__dirname, '..');
const BASE_OUTPUT_DIR = 'C:\\Users\\Lenovo\\Documents\\Dashboard laporan';

const OUTPUT_DIRS = {
  admin: path.join(BASE_OUTPUT_DIR, 'admin'),
  siswa: path.join(BASE_OUTPUT_DIR, 'siswa'),
  guru: path.join(BASE_OUTPUT_DIR, 'guru'),
  walas: path.join(BASE_OUTPUT_DIR, 'walas')
};

// Ensure all directories exist
for (const dir of Object.values(OUTPUT_DIRS)) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// MIME types dictionary for static HTTP server
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg'
};

// Start lightweight static HTTP server
function startHttpServer(rootDir, port = 8089) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const reqPath = decodeURI(req.url.split('?')[0]);
        let safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
        if (safePath === '/' || safePath === '\\') safePath = '/index.html';
        const filePath = path.join(rootDir, safePath);

        if (!fs.existsSync(filePath)) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('404 Not Found');
          return;
        }

        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          const indexHtml = path.join(filePath, 'index.html');
          if (fs.existsSync(indexHtml)) {
            const ext = '.html';
            res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] });
            fs.createReadStream(indexHtml).pipe(res);
          } else {
            res.writeHead(403);
            res.end('Directory listing forbidden');
          }
          return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, {
          'Content-Type': contentType,
          'Content-Length': stat.size,
          'Access-Control-Allow-Origin': '*'
        });
        fs.createReadStream(filePath).pipe(res);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error: ' + err.message);
      }
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        startHttpServer(rootDir, port + 1).then(resolve).catch(reject);
      } else {
        reject(err);
      }
    });

    server.listen(port, '127.0.0.1', () => {
      console.log(`[HTTP Server] Serving ${rootDir} on http://127.0.0.1:${port}`);
      resolve({ server, port });
    });
  });
}

// Chrome CDP Controller Client
class ChromeCDPClient {
  constructor(chromePath, port = 9335) {
    this.chromePath = chromePath;
    this.port = port;
    this.proc = null;
    this.tmpDir = null;
    this.pageWs = null;
    this.targetId = null;
    this.pageMsgId = 1;
    this.pagePending = new Map();
  }

  async launch() {
    this.tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-capture-'));
    console.log(`[Chrome CDP] Launching Chrome on port ${this.port}...`);
    this.proc = spawn(this.chromePath, [
      '--headless=new',
      `--remote-debugging-port=${this.port}`,
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--mute-audio',
      '--disable-background-networking',
      '--disable-background-timer-throttling',
      `--user-data-dir=${this.tmpDir}`
    ], { stdio: 'ignore' });

    let versionData = null;
    for (let i = 0; i < 40; i++) {
      try {
        await new Promise(r => setTimeout(r, 200));
        const res = await fetch(`http://127.0.0.1:${this.port}/json/version`);
        if (res.ok) {
          versionData = await res.json();
          break;
        }
      } catch (e) {}
    }

    if (!versionData) {
      this.close();
      throw new Error('Chrome did not respond to /json/version');
    }

    console.log(`[Chrome CDP] Connected to ${versionData.Browser}`);

    // Create target page via HTTP API
    const newTargetRes = await fetch(`http://127.0.0.1:${this.port}/json/new?about:blank`, { method: 'PUT' });
    const targetInfo = await newTargetRes.json();
    this.targetId = targetInfo.id;
    const pageWsUrl = targetInfo.webSocketDebuggerUrl;

    // Connect to Page WebSocket
    this.pageWs = new WebSocket(pageWsUrl);
    this.pageWs.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      // Auto-dismiss any javascript alerts/dialogs to prevent thread freezing
      if (msg.method === 'Page.javascriptDialogOpening') {
        this.send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
        return;
      }

      if (msg.id && this.pagePending.has(msg.id)) {
        const { resolve, reject } = this.pagePending.get(msg.id);
        this.pagePending.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };

    await new Promise((resolve, reject) => {
      this.pageWs.onopen = resolve;
      this.pageWs.onerror = reject;
    });

    await this.send('Page.enable');
    await this.send('Runtime.enable');
    await this.send('DOM.enable');

    // Global anti-hang overrides
    await this.addPreloadScript(`
      (() => {
        window.alert = function(m) { console.warn('[Suppressed alert]:', m); };
        window.confirm = function() { return true; };
        window.prompt = function() { return null; };
      })()
    `);

    // Standard high-fidelity desktop viewport 1440x900
    await this.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.pageMsgId++;
      const timer = setTimeout(() => {
        if (this.pagePending.has(id)) {
          this.pagePending.delete(id);
          reject(new Error(`CDP command timed out: ${method}`));
        }
      }, 15000);

      this.pagePending.set(id, {
        resolve: (val) => { clearTimeout(timer); resolve(val); },
        reject: (err) => { clearTimeout(timer); reject(err); }
      });
      this.pageWs.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      console.warn('  [Eval Warn]:', res.exceptionDetails.text, expression.slice(0, 80));
    }
    return res.result ? res.result.value : null;
  }

  async addPreloadScript(source) {
    const res = await this.send('Page.addScriptToEvaluateOnNewDocument', { source });
    return res.identifier;
  }

  async removePreloadScript(identifier) {
    if (identifier) {
      try {
        await this.send('Page.removeScriptToEvaluateOnNewDocument', { identifier });
      } catch (e) {}
    }
  }

  async navigate(url) {
    await this.send('Page.navigate', { url });
    await new Promise(resolve => setTimeout(resolve, 800));
    // Wait for DOM & dismiss glass loader
    await this.evaluate(`
      (() => {
        if (typeof window.dismissGlassLoader === 'function') window.dismissGlassLoader();
        const gl = document.getElementById('glassLoader');
        if (gl) gl.style.display = 'none';
      })()
    `);
    await new Promise(resolve => setTimeout(resolve, 350));
  }

  async captureScreenshot(outputPath) {
    const res = await this.send('Page.captureScreenshot', {
      format: 'png',
      fromSurface: true
    });
    const buffer = Buffer.from(res.data, 'base64');
    fs.writeFileSync(outputPath, buffer);
    return buffer.length;
  }

  close() {
    try {
      if (this.pageWs) this.pageWs.close();
    } catch (e) {}
    try {
      if (this.proc) this.proc.kill();
    } catch (e) {}
    try {
      if (this.tmpDir && fs.existsSync(this.tmpDir)) {
        fs.rmSync(this.tmpDir, { recursive: true, force: true });
      }
    } catch (e) {}
  }
}

// Validation function for generated PNG files
function validatePngFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return { valid: false, error: 'File does not exist' };
  }
  const stat = fs.statSync(filePath);
  if (stat.size <= 0) {
    return { valid: false, error: 'File size is 0 bytes' };
  }
  const fd = fs.openSync(filePath, 'r');
  const header = Buffer.alloc(8);
  fs.readSync(fd, header, 0, 8, 0);
  fs.closeSync(fd);

  // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
  const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!header.equals(pngMagic)) {
    return { valid: false, error: 'Invalid PNG magic bytes' };
  }

  return { valid: true, size: stat.size };
}

async function runScreenshotAutomation() {
  console.log('================================================================');
  console.log('🚀 AUTOMATED FULL-FIDELITY UI/UX SCREENSHOT CAPTURE (ALL 4 ROLES)');
  console.log('================================================================');

  const { server, port } = await startHttpServer(UJIKOM_DIR, 8125);
  const baseUrl = `http://127.0.0.1:${port}`;
  const cdp = new ChromeCDPClient(CHROME_PATH, 9345);

  const results = [];
  let preloadId = null;

  try {
    await cdp.launch();

    // ============================================================================
    // ROLE 1: ADMIN & TELEMETRI (26 PNGs)
    // ============================================================================
    console.log('\n--- CAPTURING ROLE 1: ADMIN & TELEMETRI (26 PNGs) ---');

    // 1. admin_01_login_portal.png
    console.log('Capturing [Admin 01/26] admin_01_login_portal.png...');
    await cdp.removePreloadScript(preloadId);
    preloadId = null;
    await cdp.navigate(`${baseUrl}/admin-login.html`);
    await cdp.evaluate(`
      sessionStorage.clear();
      localStorage.clear();
    `);
    await new Promise(r => setTimeout(r, 600));
    let file = path.join(OUTPUT_DIRS.admin, 'admin_01_login_portal.png');
    let size = await cdp.captureScreenshot(file);
    results.push({ role: 'admin', file: 'admin_01_login_portal.png', size });

    // 2. admin_02_login_error_state.png
    console.log('Capturing [Admin 02/26] admin_02_login_error_state.png...');
    await cdp.evaluate(`
      (() => {
        const email = document.getElementById('adminEmail');
        const pass = document.getElementById('adminPass');
        const notif = document.getElementById('adminNotifBox');
        if (email) email.value = 'salah@admin.com';
        if (pass) pass.value = 'wrongpassword';
        if (notif) {
          notif.textContent = 'Kombinasi email atau kata sandi administrator tidak valid.';
          notif.className = 'notif-box error';
          notif.style.display = 'block';
        }
      })()
    `);
    await new Promise(r => setTimeout(r, 400));
    file = path.join(OUTPUT_DIRS.admin, 'admin_02_login_error_state.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'admin', file: 'admin_02_login_error_state.png', size });

    // Inject Admin Session before loading admin.html
    preloadId = await cdp.addPreloadScript(`
      (() => {
        const adminSession = {
          role: 'admin',
          email: 'admin@smkn1sumedang.sch.id',
          nama: 'Administrator SMKN 1 Sumedang',
          uid: 'ADMIN_admin_smkn1sumedang_sch_id',
          isVerified: true
        };
        sessionStorage.setItem('user_aktif', JSON.stringify(adminSession));
        localStorage.removeItem('user_aktif');
      })()
    `);

    // 3. admin_03_dashboard_utama_perizinan.png
    console.log('Capturing [Admin 03/26] admin_03_dashboard_utama_perizinan.png...');
    await cdp.navigate(`${baseUrl}/admin.html`);
    await cdp.evaluate(`
      (() => {
        if (typeof switchToTab === 'function') switchToTab('perijinan');
        const b = document.querySelector('[data-filter="pending"]');
        if (b) b.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 700));
    file = path.join(OUTPUT_DIRS.admin, 'admin_03_dashboard_utama_perizinan.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'admin', file: 'admin_03_dashboard_utama_perizinan.png', size });

    // 4. admin_04_perizinan_disetujui.png
    console.log('Capturing [Admin 04/26] admin_04_perizinan_disetujui.png...');
    await cdp.evaluate(`
      (() => {
        const b = document.querySelector('[data-filter="disetujui"]');
        if (b) b.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 500));
    file = path.join(OUTPUT_DIRS.admin, 'admin_04_perizinan_disetujui.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'admin', file: 'admin_04_perizinan_disetujui.png', size });

    // 5. admin_05_modal_chat_perizinan.png
    console.log('Capturing [Admin 05/26] admin_05_modal_chat_perizinan.png...');
    await cdp.evaluate(`
      (() => {
        if (typeof bukaModalChat === 'function') {
          bukaModalChat('demo_izin_admin_1', 'M. Ihsan Athallah (XII RPL 2)');
        } else {
          const m = document.getElementById('modalChat');
          if (m) { m.classList.add('active'); m.style.display = 'flex'; }
        }
      })()
    `);
    await new Promise(r => setTimeout(r, 600));
    file = path.join(OUTPUT_DIRS.admin, 'admin_05_modal_chat_perizinan.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'admin', file: 'admin_05_modal_chat_perizinan.png', size });

    // 6. admin_06_modal_bukti_lampiran.png
    console.log('Capturing [Admin 06/26] admin_06_modal_bukti_lampiran.png...');
    await cdp.evaluate(`
      (() => {
        if (typeof tutupModalChat === 'function') tutupModalChat();
        if (typeof bukaModalBuktiIzinAdmin === 'function') {
          bukaModalBuktiIzinAdmin('demo_izin_admin_1');
        } else if (typeof bukaModalBukti === 'function') {
          bukaModalBukti('assets/foto/0098263610.jpg', 'Surat Izin Dokter M. Ihsan Athallah');
        } else {
          const m = document.getElementById('modalBuktiIzin');
          if (m) { m.classList.add('active'); m.style.display = 'flex'; }
        }
      })()
    `);
    await new Promise(r => setTimeout(r, 600));
    file = path.join(OUTPUT_DIRS.admin, 'admin_06_modal_bukti_lampiran.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'admin', file: 'admin_06_modal_bukti_lampiran.png', size });

    // 7. admin_07_kendala_guru_jamkos.png
    console.log('Capturing [Admin 07/26] admin_07_kendala_guru_jamkos.png...');
    await cdp.evaluate(`
      (() => {
        if (typeof tutupModalBukti === 'function') tutupModalBukti();
        const m = document.getElementById('modalBuktiIzin');
        if (m) { m.classList.remove('active'); m.style.display = 'none'; }
        if (typeof switchToTab === 'function') switchToTab('kendala');
      })()
    `);
    await new Promise(r => setTimeout(r, 700));
    file = path.join(OUTPUT_DIRS.admin, 'admin_07_kendala_guru_jamkos.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'admin', file: 'admin_07_kendala_guru_jamkos.png', size });

    // 8. admin_08_monitoring_3_kelas.png
    console.log('Capturing [Admin 08/26] admin_08_monitoring_3_kelas.png...');
    await cdp.evaluate(`
      (() => {
        if (typeof switchToTab === 'function') switchToTab('monitoring3kelas');
        if (typeof muatMonitoring3Kelas === 'function') muatMonitoring3Kelas();
      })()
    `);
    await new Promise(r => setTimeout(r, 700));
    file = path.join(OUTPUT_DIRS.admin, 'admin_08_monitoring_3_kelas.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'admin', file: 'admin_08_monitoring_3_kelas.png', size });

    // 9. admin_09_presensi_manual.png
    console.log('Capturing [Admin 09/26] admin_09_presensi_manual.png...');
    await cdp.evaluate(`
      (() => {
        if (typeof switchToTab === 'function') switchToTab('presensi');
      })()
    `);
    await new Promise(r => setTimeout(r, 500));
    file = path.join(OUTPUT_DIRS.admin, 'admin_09_presensi_manual.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'admin', file: 'admin_09_presensi_manual.png', size });

    // 10. admin_10_rekap_presensi_harian.png
    console.log('Capturing [Admin 10/26] admin_10_rekap_presensi_harian.png...');
    await cdp.evaluate(`
      (() => {
        if (typeof switchToTab === 'function') switchToTab('rekap');
        const p = document.getElementById('rekapPeriodeAdmin');
        if (p) { p.value = 'harian'; p.dispatchEvent(new Event('change')); }
        if (typeof muatRekapPresensi === 'function') muatRekapPresensi();
      })()
    `);
    await new Promise(r => setTimeout(r, 700));
    file = path.join(OUTPUT_DIRS.admin, 'admin_10_rekap_presensi_harian.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'admin', file: 'admin_10_rekap_presensi_harian.png', size });

    // 11. admin_11_rekap_presensi_tahunan.png
    console.log('Capturing [Admin 11/26] admin_11_rekap_presensi_tahunan.png...');
    await cdp.evaluate(`
      (() => {
        const p = document.getElementById('rekapPeriodeAdmin');
        if (p) { p.value = 'tahun'; p.dispatchEvent(new Event('change')); }
        if (typeof muatRekapPresensi === 'function') muatRekapPresensi();
      })()
    `);
    await new Promise(r => setTimeout(r, 700));
    file = path.join(OUTPUT_DIRS.admin, 'admin_11_rekap_presensi_tahunan.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'admin', file: 'admin_11_rekap_presensi_tahunan.png', size });

    // 12. admin_12_cetak_laporan_kop_surat.png
    console.log('Capturing [Admin 12/26] admin_12_cetak_laporan_kop_surat.png...');
    await cdp.evaluate(`
      (() => {
        const k = document.getElementById('kopSuratPrint');
        if (k) {
          k.style.display = 'block';
          k.scrollIntoView({ behavior: 'instant', block: 'start' });
        }
      })()
    `);
    await new Promise(r => setTimeout(r, 500));
    file = path.join(OUTPUT_DIRS.admin, 'admin_12_cetak_laporan_kop_surat.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'admin', file: 'admin_12_cetak_laporan_kop_surat.png', size });

    // 13. admin_13_data_siswa.png
    console.log('Capturing [Admin 13/26] admin_13_data_siswa.png...');
    await cdp.evaluate(`
      (() => {
        window.scrollTo(0, 0);
        if (typeof switchToTab === 'function') switchToTab('siswa');
      })()
    `);
    await new Promise(r => setTimeout(r, 700));
    file = path.join(OUTPUT_DIRS.admin, 'admin_13_data_siswa.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'admin', file: 'admin_13_data_siswa.png', size });

    // 14. admin_14_modal_edit_siswa.png
    console.log('Capturing [Admin 14/26] admin_14_modal_edit_siswa.png...');
    await cdp.evaluate(`
      (() => {
        if (typeof bukaModalEditSiswaAdmin === 'function') {
          bukaModalEditSiswaAdmin('0098263610');
        } else {
          const m = document.getElementById('modalEditSiswaAdmin');
          if (m) { m.classList.add('active'); m.style.display = 'flex'; }
        }
      })()
    `);
    await new Promise(r => setTimeout(r, 600));
    file = path.join(OUTPUT_DIRS.admin, 'admin_14_modal_edit_siswa.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'admin', file: 'admin_14_modal_edit_siswa.png', size });

    // 15. admin_15_kartu_rfid_mapping.png
    console.log('Capturing [Admin 15/26] admin_15_kartu_rfid_mapping.png...');
    await cdp.evaluate(`
      (() => {
        const m = document.getElementById('modalEditSiswaAdmin');
        if (m) { m.classList.remove('active'); m.style.display = 'none'; }
        if (typeof switchToTab === 'function') switchToTab('kartu');
      })()
    `);
    await new Promise(r => setTimeout(r, 600));
    file = path.join(OUTPUT_DIRS.admin, 'admin_15_kartu_rfid_mapping.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'admin', file: 'admin_15_kartu_rfid_mapping.png', size });

    // 16. admin_16_jam_pulang_kelas.png
    console.log('Capturing [Admin 16/26] admin_16_jam_pulang_kelas.png...');
    await cdp.evaluate(`
      (() => {
        if (typeof switchToTab === 'function') switchToTab('jadwal');
      })()
    `);
    await new Promise(r => setTimeout(r, 600));
    file = path.join(OUTPUT_DIRS.admin, 'admin_16_jam_pulang_kelas.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'admin', file: 'admin_16_jam_pulang_kelas.png', size });

    // 17. admin_17_modal_edit_jam_pulang.png
    console.log('Capturing [Admin 17/26] admin_17_modal_edit_jam_pulang.png...');
    await cdp.evaluate(`
      (() => {
        if (typeof editJadwalModal === 'function') {
          editJadwalModal('XII RPL 2', 'Senin');
        } else {
          const m = document.getElementById('modalEditJadwalPulang');
          if (m) { m.classList.add('active'); m.style.display = 'flex'; }
        }
      })()
    `);
    await new Promise(r => setTimeout(r, 600));
    file = path.join(OUTPUT_DIRS.admin, 'admin_17_modal_edit_jam_pulang.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'admin', file: 'admin_17_modal_edit_jam_pulang.png', size });

    // 18. admin_18_jadwal_pembelajaran.png
    console.log('Capturing [Admin 18/26] admin_18_jadwal_pembelajaran.png...');
    await cdp.evaluate(`
      (() => {
        const m = document.getElementById('modalEditJadwalPulang');
        if (m) { m.classList.remove('active'); m.style.display = 'none'; }
        if (typeof switchToTab === 'function') switchToTab('pelajaran');
      })()
    `);
    await new Promise(r => setTimeout(r, 600));
    file = path.join(OUTPUT_DIRS.admin, 'admin_18_jadwal_pembelajaran.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'admin', file: 'admin_18_jadwal_pembelajaran.png', size });

    // 19. admin_19_data_guru_resmi.png
    console.log('Capturing [Admin 19/26] admin_19_data_guru_resmi.png...');
    await cdp.evaluate(`
      (() => {
        window.scrollTo(0, 0);
        if (typeof switchToTab === 'function') switchToTab('guru');
      })()
    `);
    await new Promise(r => setTimeout(r, 600));
    file = path.join(OUTPUT_DIRS.admin, 'admin_19_data_guru_resmi.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'admin', file: 'admin_19_data_guru_resmi.png', size });

    // 20. admin_20_modal_edit_guru.png
    console.log('Capturing [Admin 20/26] admin_20_modal_edit_guru.png...');
    await cdp.evaluate(`
      (() => {
        if (typeof bukaModalEditGuruAdmin === 'function') {
          bukaModalEditGuruAdmin('199209142022211007');
        } else {
          const m = document.getElementById('modalEditGuruAdmin');
          if (m) { m.classList.add('active'); m.style.display = 'flex'; }
        }
      })()
    `);
    await new Promise(r => setTimeout(r, 600));
    file = path.join(OUTPUT_DIRS.admin, 'admin_20_modal_edit_guru.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'admin', file: 'admin_20_modal_edit_guru.png', size });

    // 21. admin_21_manajemen_akun_pengguna.png
    console.log('Capturing [Admin 21/26] admin_21_manajemen_akun_pengguna.png...');
    await cdp.evaluate(`
      (() => {
        const m = document.getElementById('modalEditGuruAdmin');
        if (m) { m.classList.remove('active'); m.style.display = 'none'; }
        const u = document.getElementById('userTableBody') || document.querySelector('.user-table-wrap');
        if (u) u.scrollIntoView({ behavior: 'instant', block: 'start' });
      })()
    `);
    await new Promise(r => setTimeout(r, 600));
    file = path.join(OUTPUT_DIRS.admin, 'admin_21_manajemen_akun_pengguna.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'admin', file: 'admin_21_manajemen_akun_pengguna.png', size });

    // 22. admin_22_simulasi_presensi_rfid.png
    console.log('Capturing [Admin 22/26] admin_22_simulasi_presensi_rfid.png...');
    await cdp.evaluate(`
      (() => {
        window.scrollTo(0, 0);
        if (typeof switchToTab === 'function') switchToTab('simulasi');
      })()
    `);
    await new Promise(r => setTimeout(r, 600));
    file = path.join(OUTPUT_DIRS.admin, 'admin_22_simulasi_presensi_rfid.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'admin', file: 'admin_22_simulasi_presensi_rfid.png', size });

    // 23. admin_23_modal_profil_admin.png
    console.log('Capturing [Admin 23/26] admin_23_modal_profil_admin.png...');
    await cdp.evaluate(`
      (() => {
        if (typeof bukaModalProfil === 'function') bukaModalProfil();
      })()
    `);
    await new Promise(r => setTimeout(r, 600));
    file = path.join(OUTPUT_DIRS.admin, 'admin_23_modal_profil_admin.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'admin', file: 'admin_23_modal_profil_admin.png', size });

    // 24. admin_24_telemetri_live_rpl1.png
    console.log('Capturing [Admin 24/26] admin_24_telemetri_live_rpl1.png...');
    await cdp.removePreloadScript(preloadId);
    preloadId = null;
    await cdp.navigate(`${baseUrl}/presensi-live.html`);
    await cdp.evaluate(`
      (() => {
        const s = document.getElementById('kelasSelect');
        if (s) { s.value = 'XII RPL 1'; s.dispatchEvent(new Event('change')); }
      })()
    `);
    await new Promise(r => setTimeout(r, 700));
    file = path.join(OUTPUT_DIRS.admin, 'admin_24_telemetri_live_rpl1.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'admin', file: 'admin_24_telemetri_live_rpl1.png', size });

    // 25. admin_25_telemetri_live_rpl2.png
    console.log('Capturing [Admin 25/26] admin_25_telemetri_live_rpl2.png...');
    await cdp.evaluate(`
      (() => {
        const s = document.getElementById('kelasSelect');
        if (s) { s.value = 'XII RPL 2'; s.dispatchEvent(new Event('change')); }
      })()
    `);
    await new Promise(r => setTimeout(r, 700));
    file = path.join(OUTPUT_DIRS.admin, 'admin_25_telemetri_live_rpl2.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'admin', file: 'admin_25_telemetri_live_rpl2.png', size });

    // 26. admin_26_telemetri_live_tkj1.png
    console.log('Capturing [Admin 26/26] admin_26_telemetri_live_tkj1.png...');
    await cdp.evaluate(`
      (() => {
        const s = document.getElementById('kelasSelect');
        if (s) { s.value = 'XII TKJ 1'; s.dispatchEvent(new Event('change')); }
      })()
    `);
    await new Promise(r => setTimeout(r, 700));
    file = path.join(OUTPUT_DIRS.admin, 'admin_26_telemetri_live_tkj1.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'admin', file: 'admin_26_telemetri_live_tkj1.png', size });

    // ============================================================================
    // ROLE 2: SISWA & PENGUNJUNG (25 PNGs)
    // ============================================================================
    console.log('\n--- CAPTURING ROLE 2: SISWA & PENGUNJUNG (25 PNGs) ---');

    // 1. siswa_01_portal_login.png
    console.log('Capturing [Siswa 01/25] siswa_01_portal_login.png...');
    await cdp.removePreloadScript(preloadId);
    preloadId = null;
    await cdp.navigate(`${baseUrl}/index.html`);
    await cdp.evaluate(`
      sessionStorage.clear();
      localStorage.clear();
      if (typeof switchAuthTab === 'function') switchAuthTab('login');
    `);
    await new Promise(r => setTimeout(r, 600));
    file = path.join(OUTPUT_DIRS.siswa, 'siswa_01_portal_login.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'siswa', file: 'siswa_01_portal_login.png', size });

    // 2. siswa_02_portal_register.png
    console.log('Capturing [Siswa 02/25] siswa_02_portal_register.png...');
    await cdp.evaluate(`
      if (typeof switchAuthTab === 'function') switchAuthTab('register');
    `);
    await new Promise(r => setTimeout(r, 500));
    file = path.join(OUTPUT_DIRS.siswa, 'siswa_02_portal_register.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'siswa', file: 'siswa_02_portal_register.png', size });

    // 3. siswa_03_modal_lupa_password.png
    console.log('Capturing [Siswa 03/25] siswa_03_modal_lupa_password.png...');
    await cdp.evaluate(`
      if (typeof bukaModalLupaPassword === 'function') bukaModalLupaPassword();
    `);
    await new Promise(r => setTimeout(r, 600));
    file = path.join(OUTPUT_DIRS.siswa, 'siswa_03_modal_lupa_password.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'siswa', file: 'siswa_03_modal_lupa_password.png', size });

    // Inject Siswa Session (M. Ihsan Athallah - 0098263610)
    preloadId = await cdp.addPreloadScript(`
      (() => {
        const sessionSiswa = {
          role: 'siswa',
          nisn: '0098263610',
          nama: 'M. IHSAN ATHALLAH',
          kelas: 'XII RPL 2',
          email: '7dosabesar557@gmail.com',
          isVerified: true,
          uid: 'SISWA_0098263610',
          foto: 'assets/foto/0098263610.jpg'
        };
        sessionStorage.setItem('user_aktif', JSON.stringify(sessionSiswa));
        localStorage.setItem('user_aktif', JSON.stringify(sessionSiswa));
        localStorage.setItem('siswa_aktif', JSON.stringify(sessionSiswa));
      })()
    `);

    // 4. siswa_04_dashboard_beranda_utama.png
    console.log('Capturing [Siswa 04/25] siswa_04_dashboard_beranda_utama.png...');
    await cdp.navigate(`${baseUrl}/dashboard.html`);
    await cdp.evaluate(`
      (() => {
        window.scrollTo(0, 0);
        if (typeof switchTab === 'function') switchTab('tabBeranda', document.getElementById('btnTabBeranda'));
      })()
    `);
    await new Promise(r => setTimeout(r, 800));
    file = path.join(OUTPUT_DIRS.siswa, 'siswa_04_dashboard_beranda_utama.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'siswa', file: 'siswa_04_dashboard_beranda_utama.png', size });

    // 5. siswa_05_beranda_monitoring_kehadiran.png
    console.log('Capturing [Siswa 05/25] siswa_05_beranda_monitoring_kehadiran.png...');
    await cdp.evaluate(`
      (() => {
        const el = document.getElementById('sectionPantauLiveHome');
        if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
      })()
    `);
    await new Promise(r => setTimeout(r, 600));
    file = path.join(OUTPUT_DIRS.siswa, 'siswa_05_beranda_monitoring_kehadiran.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'siswa', file: 'siswa_05_beranda_monitoring_kehadiran.png', size });

    // 6. siswa_06_beranda_jadwal_dan_pengumuman.png
    console.log('Capturing [Siswa 06/25] siswa_06_beranda_jadwal_dan_pengumuman.png...');
    await cdp.evaluate(`
      (() => {
        const el = document.getElementById('sectionJadwalHome');
        if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
      })()
    `);
    await new Promise(r => setTimeout(r, 600));
    file = path.join(OUTPUT_DIRS.siswa, 'siswa_06_beranda_jadwal_dan_pengumuman.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'siswa', file: 'siswa_06_beranda_jadwal_dan_pengumuman.png', size });

    // 7. siswa_07_kehadiran_subtab_siswa.png
    console.log('Capturing [Siswa 07/25] siswa_07_kehadiran_subtab_siswa.png...');
    await cdp.evaluate(`
      (() => {
        window.scrollTo(0, 0);
        if (typeof switchTab === 'function') switchTab('tabKelas', document.getElementById('btnTabKelas'));
        if (typeof switchSubtabKehadiran === 'function') switchSubtabKehadiran('siswa');
      })()
    `);
    await new Promise(r => setTimeout(r, 700));
    file = path.join(OUTPUT_DIRS.siswa, 'siswa_07_kehadiran_subtab_siswa.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'siswa', file: 'siswa_07_kehadiran_subtab_siswa.png', size });

    // 8. siswa_08_kehadiran_subtab_guru.png
    console.log('Capturing [Siswa 08/25] siswa_08_kehadiran_subtab_guru.png...');
    await cdp.evaluate(`
      (() => {
        if (typeof switchSubtabKehadiran === 'function') switchSubtabKehadiran('guru');
      })()
    `);
    await new Promise(r => setTimeout(r, 700));
    file = path.join(OUTPUT_DIRS.siswa, 'siswa_08_kehadiran_subtab_guru.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'siswa', file: 'siswa_08_kehadiran_subtab_guru.png', size });

    // 9. siswa_09_riwayat_kehadiran_pribadi.png
    console.log('Capturing [Siswa 09/25] siswa_09_riwayat_kehadiran_pribadi.png...');
    await cdp.evaluate(`
      (() => {
        window.scrollTo(0, 0);
        if (typeof switchTab === 'function') switchTab('tabRekap', document.getElementById('btnTabRekap'));
      })()
    `);
    await new Promise(r => setTimeout(r, 700));
    file = path.join(OUTPUT_DIRS.siswa, 'siswa_09_riwayat_kehadiran_pribadi.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'siswa', file: 'siswa_09_riwayat_kehadiran_pribadi.png', size });

    // 10. siswa_10_form_pengajuan_izin.png
    console.log('Capturing [Siswa 10/25] siswa_10_form_pengajuan_izin.png...');
    await cdp.evaluate(`
      (() => {
        window.scrollTo(0, 0);
        if (typeof switchTab === 'function') switchTab('tabPerijinan', document.getElementById('btnTabPerijinan'));
      })()
    `);
    await new Promise(r => setTimeout(r, 600));
    file = path.join(OUTPUT_DIRS.siswa, 'siswa_10_form_pengajuan_izin.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'siswa', file: 'siswa_10_form_pengajuan_izin.png', size });

    // 11. siswa_11_status_perizinan_riwayat.png
    console.log('Capturing [Siswa 11/25] siswa_11_status_perizinan_riwayat.png...');
    await cdp.evaluate(`
      (() => {
        window.scrollTo(0, 0);
        if (typeof switchTab === 'function') switchTab('tabRiwayatIjin', document.getElementById('btnTabRiwayatIjin'));
      })()
    `);
    await new Promise(r => setTimeout(r, 600));
    file = path.join(OUTPUT_DIRS.siswa, 'siswa_11_status_perizinan_riwayat.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'siswa', file: 'siswa_11_status_perizinan_riwayat.png', size });

    // 12. siswa_12_jadwal_pelajaran_dan_tatib.png
    console.log('Capturing [Siswa 12/25] siswa_12_jadwal_pelajaran_dan_tatib.png...');
    await cdp.evaluate(`
      (() => {
        window.scrollTo(0, 0);
        if (typeof switchTab === 'function') switchTab('tabJadwalTataTertib', document.getElementById('btnTabJadwalTataTertib'));
      })()
    `);
    await new Promise(r => setTimeout(r, 600));
    file = path.join(OUTPUT_DIRS.siswa, 'siswa_12_jadwal_pelajaran_dan_tatib.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'siswa', file: 'siswa_12_jadwal_pelajaran_dan_tatib.png', size });

    // 13. siswa_13_modal_profil_siswa.png
    console.log('Capturing [Siswa 13/25] siswa_13_modal_profil_siswa.png...');
    await cdp.evaluate(`
      (() => {
        if (typeof bukaModalProfil === 'function') bukaModalProfil();
      })()
    `);
    await new Promise(r => setTimeout(r, 600));
    file = path.join(OUTPUT_DIRS.siswa, 'siswa_13_modal_profil_siswa.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'siswa', file: 'siswa_13_modal_profil_siswa.png', size });

    // 14. siswa_14_modal_pairing_nfc_siswa.png
    console.log('Capturing [Siswa 14/25] siswa_14_modal_pairing_nfc_siswa.png...');
    await cdp.evaluate(`
      (() => {
        if (typeof tutupModalProfil === 'function') tutupModalProfil();
        if (typeof bukaModalPairingNfcSiswa === 'function') bukaModalPairingNfcSiswa();
      })()
    `);
    await new Promise(r => setTimeout(r, 600));
    file = path.join(OUTPUT_DIRS.siswa, 'siswa_14_modal_pairing_nfc_siswa.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'siswa', file: 'siswa_14_modal_pairing_nfc_siswa.png', size });

    // 15. siswa_15_chat_hub_daftar_obrolan.png
    console.log('Capturing [Siswa 15/25] siswa_15_chat_hub_daftar_obrolan.png...');
    await cdp.evaluate(`
      (() => {
        if (typeof tutupModalPairingNfcSiswa === 'function') tutupModalPairingNfcSiswa();
        const btn = document.getElementById('waFloatingBtn');
        if (btn) btn.click();
        else if (typeof bukaJendelaWaHub === 'function') bukaJendelaWaHub();
        const tab = document.querySelector('.wa-tab-item[data-tab="chats"]');
        if (tab) tab.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 600));
    file = path.join(OUTPUT_DIRS.siswa, 'siswa_15_chat_hub_daftar_obrolan.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'siswa', file: 'siswa_15_chat_hub_daftar_obrolan.png', size });

    // 16. siswa_16_chat_hub_tab_grup.png
    console.log('Capturing [Siswa 16/25] siswa_16_chat_hub_tab_grup.png...');
    await cdp.evaluate(`
      (() => {
        const tg = document.querySelector('.wa-tab-item[data-tab="groups"]');
        if (tg) tg.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 500));
    file = path.join(OUTPUT_DIRS.siswa, 'siswa_16_chat_hub_tab_grup.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'siswa', file: 'siswa_16_chat_hub_tab_grup.png', size });

    // 17. siswa_17_chat_hub_tab_kontak.png
    console.log('Capturing [Siswa 17/25] siswa_17_chat_hub_tab_kontak.png...');
    await cdp.evaluate(`
      (() => {
        const tk = document.querySelector('.wa-tab-item[data-tab="contacts"]');
        if (tk) tk.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 500));
    file = path.join(OUTPUT_DIRS.siswa, 'siswa_17_chat_hub_tab_kontak.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'siswa', file: 'siswa_17_chat_hub_tab_kontak.png', size });

    // 18. siswa_18_chat_hub_room_percakapan.png
    console.log('Capturing [Siswa 18/25] siswa_18_chat_hub_room_percakapan.png...');
    await cdp.evaluate(`
      (() => {
        if (typeof bukaChatWhatsApp === 'function') {
          bukaChatWhatsApp('199209142022211007');
        } else {
          const item = document.querySelector('.wa-list-item');
          if (item) item.click();
        }
      })()
    `);
    await new Promise(r => setTimeout(r, 600));
    file = path.join(OUTPUT_DIRS.siswa, 'siswa_18_chat_hub_room_percakapan.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'siswa', file: 'siswa_18_chat_hub_room_percakapan.png', size });

    // 19. siswa_19_chat_hub_detail_info_grup.png
    console.log('Capturing [Siswa 19/25] siswa_19_chat_hub_detail_info_grup.png...');
    await cdp.evaluate(`
      (() => {
        if (typeof bukaInfoGrupWa === 'function') {
          bukaInfoGrupWa('group_XII_RPL_2');
        } else {
          const m = document.getElementById('waGroupInfoModal');
          if (m) { m.classList.add('active'); m.style.display = 'flex'; }
        }
      })()
    `);
    await new Promise(r => setTimeout(r, 600));
    file = path.join(OUTPUT_DIRS.siswa, 'siswa_19_chat_hub_detail_info_grup.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'siswa', file: 'siswa_19_chat_hub_detail_info_grup.png', size });

    // 20. siswa_20_modal_chat_perizinan.png
    console.log('Capturing [Siswa 20/25] siswa_20_modal_chat_perizinan.png...');
    await cdp.evaluate(`
      (() => {
        if (typeof tutupInfoGrupWa === 'function') tutupInfoGrupWa();
        if (typeof tutupJendelaWaHub === 'function') tutupJendelaWaHub();
        const hub = document.getElementById('waHubWindow');
        if (hub) { hub.style.display = 'none'; }
        if (typeof bukaModalChat === 'function') {
          bukaModalChat('demo_p1', 'M. Ihsan Athallah');
        } else {
          const m = document.getElementById('modalChat');
          if (m) { m.classList.add('active'); m.style.display = 'flex'; }
        }
      })()
    `);
    await new Promise(r => setTimeout(r, 600));
    file = path.join(OUTPUT_DIRS.siswa, 'siswa_20_modal_chat_perizinan.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'siswa', file: 'siswa_20_modal_chat_perizinan.png', size });

    // 21. siswa_21_modal_preview_bukti_izin.png
    console.log('Capturing [Siswa 21/25] siswa_21_modal_preview_bukti_izin.png...');
    await cdp.evaluate(`
      (() => {
        if (typeof tutupModalChat === 'function') tutupModalChat();
        if (typeof bukaModalBukti === 'function') {
          bukaModalBukti('assets/foto/0098263610.jpg', 'Surat Keterangan Sakit Puskesmas');
        } else {
          const m = document.getElementById('modalBuktiIzin');
          if (m) { m.classList.add('active'); m.style.display = 'flex'; }
        }
      })()
    `);
    await new Promise(r => setTimeout(r, 600));
    file = path.join(OUTPUT_DIRS.siswa, 'siswa_21_modal_preview_bukti_izin.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'siswa', file: 'siswa_21_modal_preview_bukti_izin.png', size });

    // 22. pengunjung_01_dashboard_mode_tamu.png
    console.log('Capturing [Siswa 22/25] pengunjung_01_dashboard_mode_tamu.png...');
    await cdp.removePreloadScript(preloadId);
    preloadId = await cdp.addPreloadScript(`
      (() => {
        const sessionPengunjung = {
          role: 'pengunjung',
          nama: 'Pengunjung / Tamu',
          email: 'tamu@smkn1sumedang.sch.id',
          isVerified: false,
          uid: 'UID_GUEST_TESTER',
          nisn: null,
          kelas: null
        };
        sessionStorage.setItem('user_aktif', JSON.stringify(sessionPengunjung));
        localStorage.setItem('user_aktif', JSON.stringify(sessionPengunjung));
        localStorage.removeItem('siswa_aktif');
      })()
    `);
    await cdp.navigate(`${baseUrl}/dashboard.html`);
    await cdp.evaluate(`
      (() => {
        window.scrollTo(0, 0);
        if (typeof switchTab === 'function') switchTab('tabBeranda', document.getElementById('btnTabBeranda'));
      })()
    `);
    await new Promise(r => setTimeout(r, 800));
    file = path.join(OUTPUT_DIRS.siswa, 'pengunjung_01_dashboard_mode_tamu.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'siswa', file: 'pengunjung_01_dashboard_mode_tamu.png', size });

    // 23. pengunjung_02_modal_verifikasi_identitas.png
    console.log('Capturing [Siswa 23/25] pengunjung_02_modal_verifikasi_identitas.png...');
    await cdp.evaluate(`
      (() => {
        if (typeof bukaModalProfil === 'function') bukaModalProfil();
      })()
    `);
    await new Promise(r => setTimeout(r, 600));
    file = path.join(OUTPUT_DIRS.siswa, 'pengunjung_02_modal_verifikasi_identitas.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'siswa', file: 'pengunjung_02_modal_verifikasi_identitas.png', size });

    // 24. pengunjung_03_chat_hub_lock_warning.png
    console.log('Capturing [Siswa 24/25] pengunjung_03_chat_hub_lock_warning.png...');
    await cdp.evaluate(`
      (() => {
        if (typeof tutupModalProfil === 'function') tutupModalProfil();
        const btn = document.getElementById('waFloatingBtn');
        if (btn) btn.click();
        else if (typeof tampilkanModalKunciWaChat === 'function') tampilkanModalKunciWaChat();
        else {
          const lock = document.getElementById('modalKunciWaChat');
          if (lock) { lock.classList.add('active'); lock.style.display = 'flex'; }
        }
      })()
    `);
    await new Promise(r => setTimeout(r, 600));
    file = path.join(OUTPUT_DIRS.siswa, 'pengunjung_03_chat_hub_lock_warning.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'siswa', file: 'pengunjung_03_chat_hub_lock_warning.png', size });

    // 25. siswa_22_animasi_ceklis_acc.png
    console.log('Capturing [Siswa 25/25] siswa_22_animasi_ceklis_acc.png...');
    await cdp.evaluate(`
      (() => {
        if (typeof tutupModalKunciWaChat === 'function') tutupModalKunciWaChat();
        const lock = document.getElementById('modalKunciWaChat');
        if (lock) { lock.classList.remove('active'); lock.style.display = 'none'; }
        if (typeof tampilkanAnimasiCeklis === 'function') {
          tampilkanAnimasiCeklis({
            title: 'Pengajuan Berhasil',
            pesan: 'Surat perizinan Anda berhasil diverifikasi oleh sistem.'
          });
        } else {
          const c = document.querySelector('.ceklis-popup-backdrop');
          if (c) { c.classList.add('active'); c.style.display = 'flex'; }
        }
      })()
    `);
    await new Promise(r => setTimeout(r, 700));
    file = path.join(OUTPUT_DIRS.siswa, 'siswa_22_animasi_ceklis_acc.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'siswa', file: 'siswa_22_animasi_ceklis_acc.png', size });

    // ============================================================================
    // ROLE 3: GURU (9 PNGs)
    // ============================================================================
    console.log('\n--- CAPTURING ROLE 3: GURU (9 PNGs) ---');

    await cdp.removePreloadScript(preloadId);
    // Inject Guru Session (Hani Hanifah, S.Si - 198109012009022003)
    preloadId = await cdp.addPreloadScript(`
      (() => {
        const sessionGuru = {
          role: 'guru',
          nip: '198109012009022003',
          nama: 'Hani Hanifah, S.Si',
          mapel: 'Pemrograman Web & Perangkat Bergerak',
          isWalas: false,
          walasKelasId: null,
          isVerified: true,
          uid: 'GURU_198109012009022003',
          email: 'hani@smkn1sumedang.sch.id'
        };
        sessionStorage.setItem('user_aktif', JSON.stringify(sessionGuru));
        localStorage.setItem('user_aktif', JSON.stringify(sessionGuru));
        localStorage.setItem('guru_aktif', JSON.stringify(sessionGuru));
      })()
    `);

    // 1. guru_01_dashboard_utama_radar_mengajar.png
    console.log('Capturing [Guru 01/9] guru_01_dashboard_utama_radar_mengajar.png...');
    await cdp.navigate(`${baseUrl}/dashboard-guru.html`);
    await cdp.evaluate(`
      (() => {
        window.scrollTo(0, 0);
        if (typeof switchGuruTab === 'function') switchGuruTab('tabLiveGuru', document.getElementById('btnTabLiveGuru'));
      })()
    `);
    await new Promise(r => setTimeout(r, 800));
    file = path.join(OUTPUT_DIRS.guru, 'guru_01_dashboard_utama_radar_mengajar.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'guru', file: 'guru_01_dashboard_utama_radar_mengajar.png', size });

    // 2. guru_02_radar_mengajar_filter_hadir.png
    console.log('Capturing [Guru 02/9] guru_02_radar_mengajar_filter_hadir.png...');
    await cdp.evaluate(`
      (() => {
        const btn = document.getElementById('btnFilterHadir');
        if (btn) btn.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 500));
    file = path.join(OUTPUT_DIRS.guru, 'guru_02_radar_mengajar_filter_hadir.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'guru', file: 'guru_02_radar_mengajar_filter_hadir.png', size });

    // 3. guru_03_radar_mengajar_filter_tanpa_keterangan.png
    console.log('Capturing [Guru 03/9] guru_03_radar_mengajar_filter_tanpa_keterangan.png...');
    await cdp.evaluate(`
      (() => {
        const btn = document.getElementById('btnFilterBelum');
        if (btn) btn.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 500));
    file = path.join(OUTPUT_DIRS.guru, 'guru_03_radar_mengajar_filter_tanpa_keterangan.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'guru', file: 'guru_03_radar_mengajar_filter_tanpa_keterangan.png', size });

    // 4. guru_04_presensi_mandiri_guru.png
    console.log('Capturing [Guru 04/9] guru_04_presensi_mandiri_guru.png...');
    await cdp.evaluate(`
      (() => {
        window.scrollTo(0, 0);
        if (typeof switchGuruTab === 'function') switchGuruTab('tabAbsenGuru', document.getElementById('btnTabAbsenGuru'));
      })()
    `);
    await new Promise(r => setTimeout(r, 700));
    file = path.join(OUTPUT_DIRS.guru, 'guru_04_presensi_mandiri_guru.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'guru', file: 'guru_04_presensi_mandiri_guru.png', size });

    // 5. guru_05_lapor_kendala_mengajar_form.png
    console.log('Capturing [Guru 05/9] guru_05_lapor_kendala_mengajar_form.png...');
    await cdp.evaluate(`
      (() => {
        window.scrollTo(0, 0);
        if (typeof switchGuruTab === 'function') switchGuruTab('tabKendalaGuru', document.getElementById('btnTabKendalaGuru'));
      })()
    `);
    await new Promise(r => setTimeout(r, 700));
    file = path.join(OUTPUT_DIRS.guru, 'guru_05_lapor_kendala_mengajar_form.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'guru', file: 'guru_05_lapor_kendala_mengajar_form.png', size });

    // 6. guru_06_lapor_kendala_riwayat.png
    console.log('Capturing [Guru 06/9] guru_06_lapor_kendala_riwayat.png...');
    await cdp.evaluate(`
      (() => {
        const el = document.getElementById('listRiwayatKendalaGuru');
        if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
      })()
    `);
    await new Promise(r => setTimeout(r, 500));
    file = path.join(OUTPUT_DIRS.guru, 'guru_06_lapor_kendala_riwayat.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'guru', file: 'guru_06_lapor_kendala_riwayat.png', size });

    // 7. guru_07_modal_pairing_nfc_guru.png
    console.log('Capturing [Guru 07/9] guru_07_modal_pairing_nfc_guru.png...');
    await cdp.evaluate(`
      (() => {
        window.scrollTo(0, 0);
        if (typeof bukaModalPairingNfcGuru === 'function') bukaModalPairingNfcGuru();
      })()
    `);
    await new Promise(r => setTimeout(r, 600));
    file = path.join(OUTPUT_DIRS.guru, 'guru_07_modal_pairing_nfc_guru.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'guru', file: 'guru_07_modal_pairing_nfc_guru.png', size });

    // 8. guru_08_modal_profil_guru.png
    console.log('Capturing [Guru 08/9] guru_08_modal_profil_guru.png...');
    await cdp.evaluate(`
      (() => {
        if (typeof tutupModalPairingNfcGuru === 'function') tutupModalPairingNfcGuru();
        if (typeof bukaModalProfil === 'function') bukaModalProfil();
      })()
    `);
    await new Promise(r => setTimeout(r, 600));
    file = path.join(OUTPUT_DIRS.guru, 'guru_08_modal_profil_guru.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'guru', file: 'guru_08_modal_profil_guru.png', size });

    // 9. guru_09_chat_hub_floating_window.png
    console.log('Capturing [Guru 09/9] guru_09_chat_hub_floating_window.png...');
    await cdp.evaluate(`
      (() => {
        if (typeof tutupModalProfil === 'function') tutupModalProfil();
        const btn = document.getElementById('waFloatingBtn');
        if (btn) btn.click();
        else if (typeof bukaJendelaWaHub === 'function') bukaJendelaWaHub();
      })()
    `);
    await new Promise(r => setTimeout(r, 600));
    file = path.join(OUTPUT_DIRS.guru, 'guru_09_chat_hub_floating_window.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'guru', file: 'guru_09_chat_hub_floating_window.png', size });

    // ============================================================================
    // ROLE 4: WALAS (11 PNGs)
    // ============================================================================
    console.log('\n--- CAPTURING ROLE 4: WALAS (11 PNGs) ---');

    await cdp.removePreloadScript(preloadId);
    // Inject Walas Session (Muhammad Echa Putra, S.Kom.Gr - 199209142022211007)
    preloadId = await cdp.addPreloadScript(`
      (() => {
        const sessionWalas = {
          role: 'walas',
          nip: '199209142022211007',
          nama: 'Muhammad Echa Putra, S.Kom.Gr',
          mapel: 'Basis Data & Pemodelan RPL',
          email: 'ihsan33roblox@gmail.com',
          isWalas: true,
          walasKelasId: 'XII RPL 2',
          isVerified: true,
          uid: 'WALAS_199209142022211007'
        };
        sessionStorage.setItem('user_aktif', JSON.stringify(sessionWalas));
        localStorage.setItem('user_aktif', JSON.stringify(sessionWalas));
        localStorage.setItem('guru_aktif', JSON.stringify(sessionWalas));
      })()
    `);

    // 1. walas_01_dashboard_utama_kelas_binaan.png
    console.log('Capturing [Walas 01/11] walas_01_dashboard_utama_kelas_binaan.png...');
    await cdp.navigate(`${baseUrl}/dashboard-guru.html`);
    await cdp.evaluate(`
      (() => {
        window.scrollTo(0, 0);
        if (typeof switchGuruTab === 'function') switchGuruTab('tabMonitoringWalas', document.getElementById('btnTabMonitoringWalas'));
        if (typeof muatStatistikWalas === 'function') muatStatistikWalas();
      })()
    `);
    await new Promise(r => setTimeout(r, 800));
    file = path.join(OUTPUT_DIRS.walas, 'walas_01_dashboard_utama_kelas_binaan.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'walas', file: 'walas_01_dashboard_utama_kelas_binaan.png', size });

    // 2. walas_02_alert_terlambat_pagi.png
    console.log('Capturing [Walas 02/11] walas_02_alert_terlambat_pagi.png...');
    await cdp.evaluate(`
      (() => {
        if (typeof switchGuruTab === 'function') switchGuruTab('tabLiveAlertWalas', document.getElementById('btnTabLiveAlertWalas'));
        if (typeof muatLiveAlertWalas === 'function') muatLiveAlertWalas();
      })()
    `);
    await new Promise(r => setTimeout(r, 700));
    file = path.join(OUTPUT_DIRS.walas, 'walas_02_alert_terlambat_pagi.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'walas', file: 'walas_02_alert_terlambat_pagi.png', size });

    // 3. walas_03_validasi_perizinan_siswa.png
    console.log('Capturing [Walas 03/11] walas_03_validasi_perizinan_siswa.png...');
    await cdp.evaluate(`
      (() => {
        if (typeof switchGuruTab === 'function') switchGuruTab('tabApprovalIzin', document.getElementById('btnTabApprovalIzin'));
        if (typeof muatPerizinanSiswaWalas === 'function') muatPerizinanSiswaWalas();
      })()
    `);
    await new Promise(r => setTimeout(r, 700));
    file = path.join(OUTPUT_DIRS.walas, 'walas_03_validasi_perizinan_siswa.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'walas', file: 'walas_03_validasi_perizinan_siswa.png', size });

    // 4. walas_04_modal_preview_lampiran_surat_dokter.png
    console.log('Capturing [Walas 04/11] walas_04_modal_preview_lampiran_surat_dokter.png...');
    await cdp.evaluate(`
      (() => {
        if (typeof bukaModalBuktiIzin === 'function') {
          bukaModalBuktiIzin('demo_izin_walas');
        } else if (typeof bukaModalBukti === 'function') {
          bukaModalBukti('assets/foto/0098263610.jpg', 'Surat Sakit Dokter - Siswa XII RPL 2');
        } else {
          const m = document.getElementById('modalBuktiIzin');
          if (m) { m.classList.add('active'); m.style.display = 'flex'; }
        }
      })()
    `);
    await new Promise(r => setTimeout(r, 600));
    file = path.join(OUTPUT_DIRS.walas, 'walas_04_modal_preview_lampiran_surat_dokter.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'walas', file: 'walas_04_modal_preview_lampiran_surat_dokter.png', size });

    // 5. walas_05_modal_chat_konfirmasi_izin.png
    console.log('Capturing [Walas 05/11] walas_05_modal_chat_konfirmasi_izin.png...');
    await cdp.evaluate(`
      (() => {
        if (typeof tutupModalBukti === 'function') tutupModalBukti();
        if (typeof bukaModalChatIzin === 'function') {
          bukaModalChatIzin('demo_izin_walas');
        } else if (typeof bukaModalChat === 'function') {
          bukaModalChat('demo_izin_walas', 'M. Ihsan Athallah');
        } else {
          const m = document.getElementById('modalChat');
          if (m) { m.classList.add('active'); m.style.display = 'flex'; }
        }
      })()
    `);
    await new Promise(r => setTimeout(r, 600));
    file = path.join(OUTPUT_DIRS.walas, 'walas_05_modal_chat_konfirmasi_izin.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'walas', file: 'walas_05_modal_chat_konfirmasi_izin.png', size });

    // 6. walas_06_radar_mengajar_walas.png
    console.log('Capturing [Walas 06/11] walas_06_radar_mengajar_walas.png...');
    await cdp.evaluate(`
      (() => {
        if (typeof tutupModalChat === 'function') tutupModalChat();
        if (typeof switchGuruTab === 'function') switchGuruTab('tabLiveGuru', document.getElementById('btnTabLiveGuru'));
      })()
    `);
    await new Promise(r => setTimeout(r, 700));
    file = path.join(OUTPUT_DIRS.walas, 'walas_06_radar_mengajar_walas.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'walas', file: 'walas_06_radar_mengajar_walas.png', size });

    // 7. walas_07_presensi_mandiri_walas.png
    console.log('Capturing [Walas 07/11] walas_07_presensi_mandiri_walas.png...');
    await cdp.evaluate(`
      (() => {
        if (typeof switchGuruTab === 'function') switchGuruTab('tabAbsenGuru', document.getElementById('btnTabAbsenGuru'));
      })()
    `);
    await new Promise(r => setTimeout(r, 700));
    file = path.join(OUTPUT_DIRS.walas, 'walas_07_presensi_mandiri_walas.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'walas', file: 'walas_07_presensi_mandiri_walas.png', size });

    // 8. walas_08_lapor_kendala_walas.png
    console.log('Capturing [Walas 08/11] walas_08_lapor_kendala_walas.png...');
    await cdp.evaluate(`
      (() => {
        if (typeof switchGuruTab === 'function') switchGuruTab('tabKendalaGuru', document.getElementById('btnTabKendalaGuru'));
      })()
    `);
    await new Promise(r => setTimeout(r, 700));
    file = path.join(OUTPUT_DIRS.walas, 'walas_08_lapor_kendala_walas.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'walas', file: 'walas_08_lapor_kendala_walas.png', size });

    // 9. walas_09_modal_pairing_nfc_walas.png
    console.log('Capturing [Walas 09/11] walas_09_modal_pairing_nfc_walas.png...');
    await cdp.evaluate(`
      (() => {
        if (typeof bukaModalPairingNfcGuru === 'function') bukaModalPairingNfcGuru();
      })()
    `);
    await new Promise(r => setTimeout(r, 600));
    file = path.join(OUTPUT_DIRS.walas, 'walas_09_modal_pairing_nfc_walas.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'walas', file: 'walas_09_modal_pairing_nfc_walas.png', size });

    // 10. walas_10_modal_profil_walas.png
    console.log('Capturing [Walas 10/11] walas_10_modal_profil_walas.png...');
    await cdp.evaluate(`
      (() => {
        if (typeof tutupModalPairingNfcGuru === 'function') tutupModalPairingNfcGuru();
        if (typeof bukaModalProfil === 'function') bukaModalProfil();
      })()
    `);
    await new Promise(r => setTimeout(r, 600));
    file = path.join(OUTPUT_DIRS.walas, 'walas_10_modal_profil_walas.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'walas', file: 'walas_10_modal_profil_walas.png', size });

    // 11. walas_11_chat_hub_forum_koordinasi_walas.png
    console.log('Capturing [Walas 11/11] walas_11_chat_hub_forum_koordinasi_walas.png...');
    await cdp.evaluate(`
      (() => {
        if (typeof tutupModalProfil === 'function') tutupModalProfil();
        const btn = document.getElementById('waFloatingBtn');
        if (btn) btn.click();
        else if (typeof bukaJendelaWaHub === 'function') bukaJendelaWaHub();
        setTimeout(() => {
          const tg = document.querySelector('.wa-tab-item[data-tab="groups"]');
          if (tg) tg.click();
        }, 150);
      })()
    `);
    await new Promise(r => setTimeout(r, 700));
    file = path.join(OUTPUT_DIRS.walas, 'walas_11_chat_hub_forum_koordinasi_walas.png');
    size = await cdp.captureScreenshot(file);
    results.push({ role: 'walas', file: 'walas_11_chat_hub_forum_koordinasi_walas.png', size });

  } finally {
    cdp.close();
    server.close();
    console.log('\n[HTTP Server & Chrome] Cleanly shut down.');
  }

  // ============================================================================
  // PROGRAMMATIC VALIDATION OF ALL GENERATED SCREENSHOTS
  // ============================================================================
  console.log('\n================================================================');
  console.log('🔍 PROGRAMMATIC VALIDATION & INTEGRITY VERIFICATION');
  console.log('================================================================');

  let passedValidation = 0;
  let failedValidation = 0;

  for (const item of results) {
    const fullPath = path.join(OUTPUT_DIRS[item.role], item.file);
    const val = validatePngFile(fullPath);
    if (val.valid) {
      passedValidation++;
      console.log(`[PASS] (${item.role.padEnd(5)}) ${item.file} -> ${(val.size / 1024).toFixed(1)} KB (Valid PNG)`);
    } else {
      failedValidation++;
      console.error(`[FAIL] (${item.role.padEnd(5)}) ${item.file} -> ERROR: ${val.error}`);
    }
  }

  console.log('================================================================');
  console.log(`SUMMARY: ${passedValidation} PASSED, ${failedValidation} FAILED (TOTAL TARGET: ${results.length})`);
  console.log('================================================================');

  if (failedValidation > 0 || results.length !== 71) {
    throw new Error(`Screenshot capture incomplete or failed: ${failedValidation} errors, ${results.length}/71 total.`);
  }

  console.log('🎉 ALL 71 SCREENSHOTS SUCCESSFULLY CAPTURED AND VERIFIED!');
}

if (require.main === module) {
  runScreenshotAutomation().catch(err => {
    console.error('Fatal execution error:', err);
    process.exit(1);
  });
}

module.exports = {
  runScreenshotAutomation,
  validatePngFile
};
