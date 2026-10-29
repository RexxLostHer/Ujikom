/**
 * ===================================================================
 * PRESENSIA — ANIMASI POP-UP CEKLIS & PENOLAKAN (MINIMALIST MODERN UI)
 * ===================================================================
 * Komponen modal konfirmasi status (Persetujuan / ACC dan Penolakan)
 * berdesain modern, bersih, dan minimalis (inspirasi Linear & Apple).
 *
 * Fitur Utama:
 * 1. Compact minimalist dialog dengan soft backdrop blur & clean borders.
 * 2. Precision SVG checkmark (ACC) & cross mark (Tolak) dengan stroke animation halus.
 * 3. Spring scale-in lembut (tanpa efek kartunis yang berlebihan).
 * 4. Micro countdown progress bar timer (auto-dismiss).
 * 5. Web Audio API gentle tone feedback (pleasant success & soft rejection clicks).
 * 6. Multi-environment safe (Browser, JSDOM, headless Node VM).
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    const mod = factory();
    if (typeof window !== 'undefined') {
      window.tampilkanAnimasiCeklis = mod.tampilkanAnimasiCeklis;
      window.showSuccessCheckmark = mod.showSuccessCheckmark;
      window.tampilkanAnimasiTolak = mod.tampilkanAnimasiTolak;
      window.showRejectedAlert = mod.showRejectedAlert;
      window.normalisasiOpsiCeklis = mod.normalisasiOpsiCeklis;
    }
    if (typeof global !== 'undefined') {
      global.tampilkanAnimasiCeklis = mod.tampilkanAnimasiCeklis;
      global.showSuccessCheckmark = mod.showSuccessCheckmark;
      global.tampilkanAnimasiTolak = mod.tampilkanAnimasiTolak;
      global.showRejectedAlert = mod.showRejectedAlert;
      global.normalisasiOpsiCeklis = mod.normalisasiOpsiCeklis;
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this), function () {

  const CEKLIS_CSS = `
    .ceklis-popup-backdrop {
      position: fixed;
      inset: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(15, 23, 42, 0.45);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.22s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.22s;
      padding: 16px;
      box-sizing: border-box;
    }
    .ceklis-popup-backdrop.ceklis-show {
      opacity: 1;
      visibility: visible;
    }
    .ceklis-popup-card {
      background: #ffffff;
      width: 100%;
      max-width: 360px;
      border-radius: 20px;
      padding: 26px 22px 20px 22px;
      text-align: center;
      box-shadow: 0 20px 35px -10px rgba(15, 23, 42, 0.12), 0 1px 3px rgba(15, 23, 42, 0.05);
      border: 1px solid rgba(226, 232, 240, 0.9);
      position: relative;
      transform: scale(0.92) translateY(8px);
      opacity: 0;
      transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.22s ease-out;
      box-sizing: border-box;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }
    .ceklis-popup-backdrop.ceklis-show .ceklis-popup-card {
      transform: scale(1) translateY(0);
      opacity: 1;
    }
    .ceklis-popup-backdrop.ceklis-closing .ceklis-popup-card {
      transform: scale(0.92) translateY(6px);
      opacity: 0;
      transition: transform 0.18s ease-in, opacity 0.18s ease-in;
    }
    .ceklis-popup-backdrop.ceklis-show .ceklis-card-tolak {
      animation: tolakMicroShake 0.35s 0.08s ease-in-out;
    }
    @keyframes tolakMicroShake {
      0%, 100% { transform: scale(1) translateX(0); }
      20%, 60% { transform: scale(1) translateX(-3px); }
      40%, 80% { transform: scale(1) translateX(3px); }
    }
    .ceklis-icon-wrapper {
      position: relative;
      width: 62px;
      height: 62px;
      margin: 0 auto 14px auto;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .ceklis-ripple-halo {
      position: absolute;
      inset: -4px;
      border-radius: 50%;
      background: rgba(16, 185, 129, 0.14);
      animation: ceklisRippleHalo 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      pointer-events: none;
    }
    .ceklis-card-tolak .ceklis-ripple-halo {
      background: rgba(244, 63, 94, 0.14);
    }
    @keyframes ceklisRippleHalo {
      0% {
        transform: scale(0.9);
        opacity: 0.8;
      }
      100% {
        transform: scale(1.15);
        opacity: 0;
      }
    }
    .ceklis-svg {
      width: 58px;
      height: 58px;
      display: block;
      position: relative;
      z-index: 2;
    }
    .ceklis-circle-bg {
      transform-origin: 32px 32px;
      animation: ceklisScaleBg 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    @keyframes ceklisScaleBg {
      0% { transform: scale(0.6); opacity: 0; }
      100% { transform: scale(1); opacity: 1; }
    }
    .ceklis-circle-stroke {
      transform: rotate(-90deg);
      transform-origin: 32px 32px;
      stroke-dasharray: 185;
      stroke-dashoffset: 185;
      animation: ceklisDrawCircle 0.42s 0.05s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    @keyframes ceklisDrawCircle {
      0% { stroke-dashoffset: 185; }
      100% { stroke-dashoffset: 0; }
    }
    .ceklis-check-path {
      stroke-dasharray: 52;
      stroke-dashoffset: 52;
      animation: ceklisDrawCheck 0.35s 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    @keyframes ceklisDrawCheck {
      0% { stroke-dashoffset: 52; }
      100% { stroke-dashoffset: 0; }
    }
    .ceklis-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: #f0fdf4;
      color: #166534;
      border: 1px solid #bbf7d0;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      padding: 3px 11px;
      border-radius: 9999px;
      margin-bottom: 8px;
    }
    .ceklis-card-tolak .ceklis-badge {
      background: #fff1f2;
      color: #9f1239;
      border-color: #fecdd3;
    }
    .ceklis-title {
      font-size: 17px;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 6px 0;
      line-height: 1.3;
      letter-spacing: -0.015em;
    }
    .ceklis-subjudul {
      font-size: 12px;
      font-weight: 600;
      color: #059669;
      margin: -2px 0 6px 0;
    }
    .ceklis-card-tolak .ceklis-subjudul {
      color: #e11d48;
    }
    .ceklis-message {
      font-size: 13px;
      color: #475569;
      line-height: 1.5;
      margin: 0 0 16px 0;
      word-break: break-word;
    }
    .ceklis-progress-track {
      width: 100%;
      height: 2.5px;
      background: #f1f5f9;
      border-radius: 9999px;
      overflow: hidden;
      margin-bottom: 14px;
    }
    .ceklis-progress-bar {
      width: 100%;
      height: 100%;
      background: #10b981;
      transform-origin: left;
      transform: scaleX(1);
      transition: transform linear;
    }
    .ceklis-card-tolak .ceklis-progress-bar {
      background: #f43f5e;
    }
    .ceklis-btn-ok {
      width: 100%;
      padding: 10px 18px;
      background: #0f172a;
      color: #ffffff;
      border: none;
      border-radius: 12px;
      font-size: 13.5px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
      transition: all 0.15s ease;
      outline: none;
    }
    .ceklis-btn-ok:hover {
      background: #1e293b;
      transform: translateY(-1px);
    }
    .ceklis-btn-ok:active {
      transform: translateY(0);
      filter: brightness(0.95);
    }
    .ceklis-card-tolak .ceklis-btn-ok:hover {
      background: #be123c;
    }
    .ceklis-popup-close {
      position: absolute;
      top: 12px;
      right: 12px;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: transparent;
      border: none;
      color: #94a3b8;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s;
      outline: none;
    }
    .ceklis-popup-close:hover {
      background: #f1f5f9;
      color: #0f172a;
    }
    @media (prefers-reduced-motion: reduce) {
      .ceklis-popup-backdrop,
      .ceklis-popup-card,
      .ceklis-btn-ok,
      .ceklis-popup-close {
        transition: none !important;
      }
      .ceklis-popup-card {
        transform: none !important;
        opacity: 1 !important;
        animation: none !important;
      }
      .ceklis-circle-bg,
      .ceklis-circle-stroke,
      .ceklis-check-path,
      .ceklis-ripple-halo {
        animation: none !important;
        transform: none !important;
        stroke-dashoffset: 0 !important;
        opacity: 1 !important;
      }
    }
  `;

  let activeDismissTimer = null;
  let activeClosingTimer = null;
  let activeCloseResolve = null;
  let activeKeydownHandler = null;
  let sharedAudioCtx = null;

  function ensureStylesInjected() {
    if (typeof document === 'undefined') return;
    try {
      if (document.getElementById('ceklis-popup-style')) return;
      const styleEl = document.createElement('style');
      styleEl.id = 'ceklis-popup-style';
      styleEl.textContent = CEKLIS_CSS;
      const target = document.head || document.body || document.documentElement;
      if (target && typeof target.appendChild === 'function') {
        target.appendChild(styleEl);
      }
    } catch (e) {}
  }

  function playSuccessChime() {
    if (typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
        sharedAudioCtx = new AudioCtx();
      }
      const ctx = sharedAudioCtx;
      if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
        ctx.resume().catch(() => {});
      }
      if (typeof ctx.createOscillator !== 'function' || typeof ctx.createGain !== 'function') {
        return;
      }
      const now = ctx.currentTime || 0;

      // Soft minimalist chime: D5 (587.33Hz) -> A5 (880Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      if (osc1.frequency && typeof osc1.frequency.setValueAtTime === 'function') {
        osc1.frequency.setValueAtTime(587.33, now);
        if (typeof osc1.frequency.exponentialRampToValueAtTime === 'function') {
          osc1.frequency.exponentialRampToValueAtTime(880, now + 0.1);
        }
      }
      if (gain1.gain && typeof gain1.gain.setValueAtTime === 'function') {
        gain1.gain.setValueAtTime(0.04, now);
        if (typeof gain1.gain.exponentialRampToValueAtTime === 'function') {
          gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
        }
      }
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.33);

      // Sparkle C6 (1046.5Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      if (osc2.frequency && typeof osc2.frequency.setValueAtTime === 'function') {
        osc2.frequency.setValueAtTime(1046.5, now + 0.06);
      }
      if (gain2.gain && typeof gain2.gain.setValueAtTime === 'function') {
        gain2.gain.setValueAtTime(0.02, now + 0.06);
        if (typeof gain2.gain.exponentialRampToValueAtTime === 'function') {
          gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
        }
      }
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.06);
      osc2.stop(now + 0.39);
    } catch (e) {}
  }

  function playRejectChime() {
    if (typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
        sharedAudioCtx = new AudioCtx();
      }
      const ctx = sharedAudioCtx;
      if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
        ctx.resume().catch(() => {});
      }
      if (typeof ctx.createOscillator !== 'function' || typeof ctx.createGain !== 'function') {
        return;
      }
      const now = ctx.currentTime || 0;

      // Soft warm rejection tone: 440Hz -> 311Hz gentle woodblock/marimba feel
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      if (osc.frequency && typeof osc.frequency.setValueAtTime === 'function') {
        osc.frequency.setValueAtTime(440, now);
        if (typeof osc.frequency.exponentialRampToValueAtTime === 'function') {
          osc.frequency.exponentialRampToValueAtTime(311.13, now + 0.12);
        }
      }
      if (gain.gain && typeof gain.gain.setValueAtTime === 'function') {
        gain.gain.setValueAtTime(0.05, now);
        if (typeof gain.gain.exponentialRampToValueAtTime === 'function') {
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        }
      }
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.29);
    } catch (e) {}
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function normalisasiOpsiCeklis(opsi) {
    if (typeof opsi === 'string') {
      opsi = { pesan: opsi };
    } else if (!opsi || typeof opsi !== 'object') {
      opsi = {};
    }

    const kategori = (opsi.kategori || opsi.category || 'umum').toLowerCase();
    const isTolak = Boolean(
      opsi.isTolak ||
      opsi.tipe === 'ditolak' ||
      opsi.tipe === 'tolak' ||
      opsi.status === 'ditolak' ||
      opsi.status === 'tolak' ||
      kategori === 'tolak' ||
      kategori === 'ditolak' ||
      kategori === 'izin_tolak'
    );

    let badgeDefault = 'DISETUJUI / ACC';
    if (isTolak) {
      if (kategori === 'kendala') badgeDefault = 'KENDALA DITOLAK';
      else if (kategori.includes('izin') || kategori.includes('perizinan')) badgeDefault = 'IZIN DITOLAK';
      else badgeDefault = 'DITOLAK';
    } else {
      if (kategori === 'kendala') badgeDefault = 'ACC KENDALA GURU';
      else if (kategori === 'izin' || kategori === 'perizinan') badgeDefault = 'ACC PERIZINAN';
      else if (kategori === 'role') badgeDefault = 'KONFIRMASI ROLE';
      else if (kategori === 'presensi') badgeDefault = 'ACC PRESENSI';
      else if (kategori === 'verifikasi') badgeDefault = 'VERIFIKASI AKUN';
    }

    let judulDefault = isTolak ? 'Permohonan Ditolak' : 'Berhasil Disetujui!';
    if (isTolak) {
      if (kategori === 'kendala') judulDefault = 'Kendala Guru Ditolak';
      else if (kategori.includes('izin')) judulDefault = 'Permohonan Izin Ditolak';
    } else {
      if (kategori === 'kendala') judulDefault = 'Kendala Guru Di-ACC!';
      else if (kategori === 'role') judulDefault = 'Role Berhasil Diperbarui!';
      else if (kategori === 'presensi') judulDefault = 'Presensi Dikonfirmasi!';
    }

    const durasi = typeof opsi.durasi === 'number'
      ? opsi.durasi
      : (typeof opsi.duration === 'number' ? opsi.duration : 2200);

    const tutupOtomatis = opsi.tutupOtomatis !== undefined
      ? Boolean(opsi.tutupOtomatis)
      : (opsi.autoClose !== undefined ? Boolean(opsi.autoClose) : true);

    const defaultTombolTeks = isTolak ? 'OK, Tutup' : 'OK, Mengerti';

    return {
      judul: opsi.judul || opsi.title || judulDefault,
      subjudul: opsi.subjudul || opsi.subtitle || '',
      pesan: opsi.pesan || opsi.message || opsi.detail || opsi.deskripsi || (isTolak ? 'Aksi penolakan berhasil diproses ke sistem.' : 'Aksi persetujuan berhasil diproses ke sistem.'),
      badge: opsi.badge || badgeDefault,
      kategori: kategori,
      isTolak: isTolak,
      durasi: Math.max(0, durasi),
      tutupOtomatis: tutupOtomatis,
      tombolTeks: opsi.tombolTeks || opsi.buttonText || defaultTombolTeks,
      suara: opsi.suara !== undefined ? Boolean(opsi.suara) : (opsi.sound !== undefined ? Boolean(opsi.sound) : true),
      onClose: typeof opsi.onClose === 'function' ? opsi.onClose : (typeof opsi.onTutup === 'function' ? opsi.onTutup : null),
      onSelesai: typeof opsi.onSelesai === 'function' ? opsi.onSelesai : (typeof opsi.callback === 'function' ? opsi.callback : null)
    };
  }

  function tutupAnimasiCeklis(reason) {
    reason = reason || 'manual';
    if (activeDismissTimer) {
      clearTimeout(activeDismissTimer);
      activeDismissTimer = null;
    }

    if (activeKeydownHandler && typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
      window.removeEventListener('keydown', activeKeydownHandler);
      activeKeydownHandler = null;
    }

    const currentResolver = activeCloseResolve;
    activeCloseResolve = null;

    if (typeof document === 'undefined') {
      if (currentResolver) currentResolver({ closed: true, reason: reason });
      return;
    }

    const backdrop = document.getElementById('ceklisPopupBackdrop');
    if (!backdrop) {
      if (currentResolver) currentResolver({ closed: true, reason: reason });
      return;
    }

    if (backdrop.classList.contains('ceklis-closing')) {
      if (currentResolver) currentResolver({ closed: true, reason: reason });
      return;
    }

    backdrop.classList.add('ceklis-closing');
    backdrop.classList.remove('ceklis-show');

    activeClosingTimer = setTimeout(() => {
      activeClosingTimer = null;
      if (backdrop && backdrop.parentNode) {
        backdrop.parentNode.removeChild(backdrop);
      }
      if (currentResolver) {
        currentResolver({ closed: true, reason: reason });
      }
    }, 200);
  }

  function tampilkanAnimasiCeklis(opsi) {
    const config = normalisasiOpsiCeklis(opsi);

    // 1. Headless / Pure Node fallback
    if (typeof document === 'undefined') {
      if (typeof config.onClose === 'function') config.onClose();
      if (typeof config.onSelesai === 'function') config.onSelesai();
      return Promise.resolve({
        closed: true,
        reason: 'headless',
        data: config
      });
    }

    ensureStylesInjected();

    // Hapus popup aktif sebelumnya dan batalkan pending timer jika ada
    if (activeDismissTimer) {
      clearTimeout(activeDismissTimer);
      activeDismissTimer = null;
    }
    if (activeClosingTimer) {
      clearTimeout(activeClosingTimer);
      activeClosingTimer = null;
    }
    if (activeKeydownHandler && typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
      window.removeEventListener('keydown', activeKeydownHandler);
      activeKeydownHandler = null;
    }
    if (activeCloseResolve) {
      const prevResolve = activeCloseResolve;
      activeCloseResolve = null;
      prevResolve({ closed: true, reason: 'superseded' });
    }

    const existing = document.getElementById('ceklisPopupBackdrop');
    if (existing && existing.parentNode) {
      existing.parentNode.removeChild(existing);
    }

    return new Promise(function (resolve) {
      activeCloseResolve = function (result) {
        if (typeof config.onClose === 'function') config.onClose(result);
        if (typeof config.onSelesai === 'function') config.onSelesai(result);
        resolve(result);
      };

      // 2. Bangun DOM Popup
      const backdrop = document.createElement('div');
      backdrop.id = 'ceklisPopupBackdrop';
      backdrop.className = 'ceklis-popup-backdrop';
      backdrop.setAttribute('role', 'dialog');
      backdrop.setAttribute('aria-modal', 'true');
      backdrop.setAttribute('aria-labelledby', 'ceklisTitle');

      const card = document.createElement('div');
      card.className = config.isTolak ? 'ceklis-popup-card ceklis-card-tolak' : 'ceklis-popup-card';

      // Tombol Close X
      const btnClose = document.createElement('button');
      btnClose.type = 'button';
      btnClose.className = 'ceklis-popup-close';
      btnClose.id = 'ceklisBtnClose';
      btnClose.setAttribute('aria-label', 'Tutup');
      btnClose.innerHTML = '✕';

      // SVG Icon Centang / Silang (Clean minimalist line work)
      const iconWrapper = document.createElement('div');
      iconWrapper.className = 'ceklis-icon-wrapper';

      if (config.isTolak) {
        // Mode Penolakan (Minimalist Soft Rose & Cross Mark)
        iconWrapper.innerHTML = `
          <div class="ceklis-ripple-halo"></div>
          <svg class="ceklis-svg" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle class="ceklis-circle-bg" cx="32" cy="32" r="30" fill="#fff1f2" />
            <circle class="ceklis-circle-stroke" cx="32" cy="32" r="28" stroke="#f43f5e" stroke-width="2.5" stroke-linecap="round" fill="none" />
            <path class="ceklis-check-path ceklis-cross-path" d="M22 22 L42 42 M42 22 L22 42" stroke="#e11d48" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" fill="none" />
          </svg>
        `;
      } else {
        // Mode Persetujuan (Minimalist Soft Mint & Clean Checkmark)
        iconWrapper.innerHTML = `
          <div class="ceklis-ripple-halo"></div>
          <svg class="ceklis-svg" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle class="ceklis-circle-bg" cx="32" cy="32" r="30" fill="#ecfdf5" />
            <circle class="ceklis-circle-stroke" cx="32" cy="32" r="28" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" fill="none" />
            <path class="ceklis-check-path" d="M19 33.5 L27.5 42 L45 23" stroke="#059669" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" fill="none" />
          </svg>
        `;
      }

      // Badge Kategori
      const badgeEl = document.createElement('div');
      badgeEl.className = 'ceklis-badge';
      badgeEl.id = 'ceklisBadge';
      badgeEl.innerHTML = `${config.isTolak ? '✕' : '✓'} ${escapeHtml(config.badge)}`;

      // Judul
      const titleEl = document.createElement('h3');
      titleEl.className = 'ceklis-title';
      titleEl.id = 'ceklisTitle';
      titleEl.textContent = config.judul;

      // Subjudul (jika ada)
      let subjudulEl = null;
      if (config.subjudul) {
        subjudulEl = document.createElement('div');
        subjudulEl.className = 'ceklis-subjudul';
        subjudulEl.textContent = config.subjudul;
      }

      // Pesan / Detail
      const msgEl = document.createElement('p');
      msgEl.className = 'ceklis-message';
      msgEl.id = 'ceklisMessage';
      msgEl.textContent = config.pesan;

      // Progress Track & Bar (Countdown)
      let progressTrack = null;
      let progressBar = null;
      if (config.durasi > 0 && config.tutupOtomatis) {
        progressTrack = document.createElement('div');
        progressTrack.className = 'ceklis-progress-track';
        progressBar = document.createElement('div');
        progressBar.className = 'ceklis-progress-bar';
        progressBar.id = 'ceklisProgressBar';
        progressTrack.appendChild(progressBar);
      }

      // Tombol Aksi OK
      const btnOk = document.createElement('button');
      btnOk.type = 'button';
      btnOk.className = 'ceklis-btn-ok';
      btnOk.id = 'ceklisBtnOk';
      btnOk.textContent = config.tombolTeks;

      // Susun elemen ke Card
      card.appendChild(btnClose);
      card.appendChild(iconWrapper);
      card.appendChild(badgeEl);
      card.appendChild(titleEl);
      if (subjudulEl) card.appendChild(subjudulEl);
      card.appendChild(msgEl);
      if (progressTrack) card.appendChild(progressTrack);
      card.appendChild(btnOk);

      backdrop.appendChild(card);

      // Mount ke DOM
      const mountTarget = document.body || document.documentElement;
      if (mountTarget && typeof mountTarget.appendChild === 'function') {
        mountTarget.appendChild(backdrop);
      }

      // Play soft chime audio
      if (config.suara) {
        if (config.isTolak) {
          playRejectChime();
        } else {
          playSuccessChime();
        }
      }

      // Event listener: Tombol OK
      btnOk.onclick = function (e) {
        if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
        tutupAnimasiCeklis('button');
      };

      // Event listener: Tombol Close (X)
      btnClose.onclick = function (e) {
        if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
        tutupAnimasiCeklis('close_btn');
      };

      // Event listener: Backdrop Click (Klik di luar kartu)
      backdrop.onclick = function (e) {
        if (e.target === backdrop) {
          tutupAnimasiCeklis('backdrop');
        }
      };

      // Event listener: Escape Key
      activeKeydownHandler = function (e) {
        if (e.key === 'Escape' || e.keyCode === 27) {
          if (activeKeydownHandler && typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
            window.removeEventListener('keydown', activeKeydownHandler);
            activeKeydownHandler = null;
          }
          tutupAnimasiCeklis('escape');
        }
      };
      if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener('keydown', activeKeydownHandler);
      }

      // Animate Entrance
      const triggerEntrance = function () {
        backdrop.classList.add('ceklis-show');

        // GSAP Micro-Interaction Polish jika tersedia (smooth, non-slop spring)
        if (typeof window !== 'undefined' && window.gsap && typeof window.gsap.fromTo === 'function') {
          try {
            window.gsap.fromTo(card,
              { scale: 0.9, y: 12, opacity: 0 },
              { scale: 1, y: 0, opacity: 1, duration: 0.32, ease: 'power3.out' }
            );
          } catch (eGsap) {}
        }

        // Animate countdown progress bar
        if (progressBar && config.durasi > 0 && config.tutupOtomatis) {
          setTimeout(function () {
            if (progressBar && progressBar.style) {
              progressBar.style.transition = 'transform ' + config.durasi + 'ms linear';
              progressBar.style.transform = 'scaleX(0)';
            }
          }, 30);
        }

        // Auto Dismiss Timer
        if (config.durasi > 0 && config.tutupOtomatis) {
          activeDismissTimer = setTimeout(function () {
            activeDismissTimer = null;
            if (activeKeydownHandler && typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
              window.removeEventListener('keydown', activeKeydownHandler);
              activeKeydownHandler = null;
            }
            tutupAnimasiCeklis('timer');
          }, config.durasi);
        }
      };

      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(triggerEntrance);
      } else {
        setTimeout(triggerEntrance, 16);
      }
    });
  }

  // Alias fungsi untuk memanggil animasi penolakan secara langsung
  function tampilkanAnimasiTolak(opsi) {
    if (typeof opsi === 'string') {
      opsi = { pesan: opsi };
    } else if (!opsi || typeof opsi !== 'object') {
      opsi = {};
    }
    const opts = Object.assign({}, opsi, { isTolak: true, tipe: 'ditolak' });
    return tampilkanAnimasiCeklis(opts);
  }

  tampilkanAnimasiCeklis.tutup = tutupAnimasiCeklis;
  tampilkanAnimasiCeklis.close = tutupAnimasiCeklis;
  tampilkanAnimasiTolak.tutup = tutupAnimasiCeklis;
  tampilkanAnimasiTolak.close = tutupAnimasiCeklis;

  return {
    tampilkanAnimasiCeklis: tampilkanAnimasiCeklis,
    showSuccessCheckmark: tampilkanAnimasiCeklis,
    tampilkanAnimasiTolak: tampilkanAnimasiTolak,
    showRejectedAlert: tampilkanAnimasiTolak,
    normalisasiOpsiCeklis: normalisasiOpsiCeklis
  };
});
