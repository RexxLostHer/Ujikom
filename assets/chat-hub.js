/**
 * ===================================================================
 * WHATSAPP CHAT HUB — PRESENSIA IoT (SMK NEGERI 1 SUMEDANG)
 * ===================================================================
 * Fitur Terpadu:
 * 1. Obrolan Bebas 1-on-1 (Guru, Walas, Siswa dengan NISN/NIP sebagai nomor kontak)
 * 2. 3 Kategori Grup Terisolasi Berdasarkan Hak Akses & Kelas:
 *    - (a) Siswa & Walas: HANYA grup kelas masing-masing (Siswa kelas lain DILARANG melihat)
 *    - (b) Khusus Walas: Forum koordinasi internal seluruh Wali Kelas
 *    - (c) Dewan Guru & Walas: Musyawarah seluruh dewan guru & walas
 * 3. Role & Otoritas Grup: 👑 Guru / Walas sebagai Admin (Kick & Add Member) & Siswa sebagai Member
 * 4. Tag / Mention (@) dengan Autocomplete
 * 5. Voice Note (VN) dengan MediaRecorder Audio & Player Interaktif
 * 6. Real-Time Firebase RTDB + Offline LocalStorage 0ms Sync
 * 7. Anti-Duplicate Bubble Guard: Eliminasi double-render saat pengiriman pertama
 * 8. Strict Session Guard: Mencegah tab Siswa tertimpa kredensial Guru di localStorage
 * ===================================================================
 */

(function () {
  'use strict';

  // State Utama Chat Hub
  let waHubInitialized = false;
  let waActiveTab = 'chats'; // 'chats' | 'groups' | 'contacts'
  let waActiveRoomId = null;
  let waActiveRoomType = null; // 'direct' | 'group' | 'permit'
  let waActiveRoomTarget = null;
  let waCurrentMediaRecorder = null;
  let waAudioChunks = [];
  let waRecordingTimer = null;
  let waRecordSeconds = 0;
  let waActiveGroupDetailId = null;

  // Registry memori untuk URL audio Voice Note (Mencegah string Base64 raksasa di inline HTML)
  const waAudioRegistry = new Map();
  if (typeof window !== 'undefined') window.waAudioRegistry = waAudioRegistry;

  // Active listener reference untuk Firebase RTDB room messages
  let activeRoomFirebaseRef = null;
  let activeRoomFirebaseCallback = null;
  let activeRoomFirebaseRef2 = null;
  let activeRoomFirebaseCallback2 = null;

  // Global listener reference untuk pemantauan seluruh chat room secara real-time
  let globalChatRoomsRef = null;
  let globalChatRoomsCallback = null;

  function getActiveDb() {
    if (typeof global !== 'undefined' && global.db && typeof global.db.ref === 'function') return global.db;
    if (typeof window !== 'undefined' && window.db && typeof window.db.ref === 'function') return window.db;
    if (typeof db !== 'undefined' && db && typeof db.ref === 'function') return db;
    if (typeof window !== 'undefined' && window.firebase && typeof window.firebase.database === 'function' && window.firebase.apps && window.firebase.apps.length > 0) {
      try { return window.firebase.database(); } catch (e) {}
    }
    if (typeof firebase !== 'undefined' && typeof firebase.database === 'function' && firebase.apps && firebase.apps.length > 0) {
      try { return firebase.database(); } catch (e) {}
    }
    if (typeof window !== 'undefined' && window.firebase && typeof window.firebase.database === 'function') {
      try { return window.firebase.database(); } catch (e) {}
    }
    return null;
  }

  // Tab Unique ID untuk mencegah BroadcastChannel menerima pesannya sendiri (anti double bubble)
  const CURRENT_TAB_ID = 'tab_' + Date.now() + '_' + Math.random().toString(36).substr(2, 7);
  let waBroadcastChannel = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      waBroadcastChannel = new BroadcastChannel('ujikom_chat_hub_bus');
      if (typeof waBroadcastChannel.unref === 'function') {
        waBroadcastChannel.unref();
      }
    }
  } catch (eBc) {}

  // Master Data Kontak Default (Fallback jika belum ada di window)
  const DEFAULT_GURU_CONTACTS = {
    '199209142022211007': { id: '199209142022211007', nip: '199209142022211007', nama: 'Muhammad Echa Putra, S.Kom.Gr', role: 'walas', isWalas: true, walasKelasId: 'XII RPL 2', kelas: 'XII RPL 2', email: 'echa@smkn1sumedang.sch.id' },
    '198312052022211017': { id: '198312052022211017', nip: '198312052022211017', nama: 'Rijal Nur Rahmat, S.T', role: 'walas', isWalas: true, walasKelasId: 'XII RPL 1', kelas: 'XII RPL 1', email: 'rijal@smkn1sumedang.sch.id' },
    '198504252024211008': { id: '198504252024211008', nip: '198504252024211008', nama: 'Heri Anggara, S.Kom', role: 'walas', isWalas: true, walasKelasId: 'XII TKJ 1', kelas: 'XII TKJ 1', email: 'heri@smkn1sumedang.sch.id' },
    '198109012009022003': { id: '198109012009022003', nip: '198109012009022003', nama: 'Hani Hanifah, S.Si', role: 'guru', isWalas: false, walasKelasId: null, kelas: 'Guru Pengajar', email: 'hani@smkn1sumedang.sch.id' },
    '197905032006042004': { id: '197905032006042004', nip: '197905032006042004', nama: 'Hali, ST', role: 'guru', isWalas: false, walasKelasId: null, kelas: 'Guru Kejuruan', email: 'hali@smkn1sumedang.sch.id' }
  };

  function normalisasiKelasChat(k) {
    if (!k) return '';
    return String(k).toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  // 1. Helper User Sesi Aktif dengan Deteksi Ketat Konteks Halaman
  function getActiveUserChat() {
    let u = null;

    // Deteksi konteks halaman secara presisi: Apakah portal Guru/Admin atau Siswa?
    let isGuruPage = false;
    let isAdminPage = false;
    if (typeof window !== 'undefined' && window.location) {
      const p = ((window.location.pathname || '') + ' ' + (window.location.href || '')).toLowerCase();
      if (p.includes('admin.html') || p.includes('/admin')) {
        isAdminPage = true;
        isGuruPage = true;
      } else if (p.includes('dashboard-guru') || p.includes('presensi-guru')) {
        isGuruPage = true;
      } else if (p.includes('dashboard.html') || p.includes('index.html')) {
        isGuruPage = false;
      } else if (p.includes('guru') || p.includes('admin')) {
        if (p.includes('admin')) isAdminPage = true;
        isGuruPage = true;
      }
    }
    if (!isGuruPage && typeof document !== 'undefined') {
      const gCard = document.getElementById('guruProfileCard');
      const walasSec = document.getElementById('sectionIzinWalas');
      const adminBadge = document.getElementById('adminNamaBadge');
      if (adminBadge) {
        isAdminPage = true;
        isGuruPage = true;
      } else if (gCard || walasSec) {
        // Hanya jika bukan di dashboard.html
        const pStr = (typeof window !== 'undefined' && window.location && window.location.pathname) ? window.location.pathname.toLowerCase() : '';
        if (!pStr.includes('dashboard.html')) {
          isGuruPage = true;
        }
      }
    }

    try {
      // 1. Prioritaskan sessionStorage tab-scoped (mencegah tab Guru, Admin & Siswa saling menimpa)
      if (typeof sessionStorage !== 'undefined') {
        const rawSess = sessionStorage.getItem('user_aktif');
        if (rawSess) {
          const parsed = JSON.parse(rawSess);
          if (parsed) {
            if (isAdminPage && (parsed.role === 'admin' || !parsed.nisn)) {
              u = parsed;
            } else if (isGuruPage && (parsed.nip || parsed.role === 'guru' || parsed.role === 'walas' || parsed.role === 'admin')) {
              u = parsed;
            } else if (!isGuruPage && (parsed.nisn || parsed.role === 'siswa' || !parsed.nip)) {
              u = parsed;
            }
          }
        }
      }

      // 2. Variabel in-memory sesi
      if (!u) {
        if (isAdminPage) {
          if (typeof adminSessionUser !== 'undefined' && adminSessionUser) u = adminSessionUser;
          else if (typeof window !== 'undefined' && window.adminSessionUser) u = window.adminSessionUser;
          else if (typeof currentUser !== 'undefined' && currentUser && currentUser.role === 'admin') u = currentUser;
          else if (typeof window !== 'undefined' && window.currentUser && window.currentUser.role === 'admin') u = window.currentUser;
        }
        if (!u && isGuruPage) {
          if (typeof guruAktif !== 'undefined' && guruAktif) u = guruAktif;
          else if (typeof window !== 'undefined' && window.guruAktif) u = window.guruAktif;
          else if (typeof currentUser !== 'undefined' && currentUser && (currentUser.nip || currentUser.role !== 'siswa')) u = currentUser;
          else if (typeof window !== 'undefined' && window.currentUser && (window.currentUser.nip || window.currentUser.role !== 'siswa')) u = window.currentUser;
          else if (typeof adminSessionUser !== 'undefined' && adminSessionUser) u = adminSessionUser;
          else if (typeof window !== 'undefined' && window.adminSessionUser) u = window.adminSessionUser;
        } else if (!u) {
          if (typeof currentUser !== 'undefined' && currentUser && (currentUser.nisn || currentUser.role === 'siswa' || currentUser.role === 'pengunjung' || !currentUser.nip)) u = currentUser;
          else if (typeof window !== 'undefined' && window.currentUser && (window.currentUser.nisn || window.currentUser.role === 'siswa' || window.currentUser.role === 'pengunjung' || !window.currentUser.nip)) u = window.currentUser;
        }
      }

      // 3. Fallback ke LocalStorage TERISOLASI (HANYA kunci yang sesuai role halaman!)
      if (!u && typeof localStorage !== 'undefined') {
        if (isAdminPage) {
          const rawA = localStorage.getItem('admin_aktif') || localStorage.getItem('user_aktif');
          if (rawA) {
            const parsed = JSON.parse(rawA);
            if (parsed && (parsed.role === 'admin' || !parsed.nisn)) u = parsed;
          }
        }
        if (!u && isGuruPage) {
          const rawG = localStorage.getItem('guru_aktif') || localStorage.getItem('admin_aktif');
          if (rawG) u = JSON.parse(rawG);
        } else if (!u) {
          // Halaman siswa DILARANG membaca guru_aktif!
          const rawS = localStorage.getItem('siswa_aktif');
          if (rawS) u = JSON.parse(rawS);
        }

        // Kunci user_aktif umum hanya digunakan jika role-nya sesuai
        if (!u) {
          const rawU = localStorage.getItem('user_aktif');
          if (rawU) {
            const parsed = JSON.parse(rawU);
            if (parsed) {
              if (isAdminPage && (parsed.role === 'admin' || !parsed.nisn)) u = parsed;
              else if (isGuruPage && (parsed.nip || parsed.role !== 'siswa')) u = parsed;
              else if (!isGuruPage && (parsed.nisn || parsed.role === 'siswa' || parsed.role === 'pengunjung')) u = parsed;
            }
          }
        }
      }

      // 4. Fallback fungsi helper sesi jika ada
      if (!u && typeof getSessionUser === 'function') {
        const s = getSessionUser();
        if (s) {
          if (isAdminPage && (s.role === 'admin' || !s.nisn)) u = s;
          else if (isGuruPage && (s.nip || s.role !== 'siswa')) u = s;
          else if (!isGuruPage && (s.nisn || s.role === 'siswa' || s.role === 'pengunjung')) u = s;
        }
      }
    } catch (e) {}

    // 5. Default Fallback Berdasarkan Konteks Halaman
    if (!u) {
      if (isAdminPage) {
        u = {
          id: 'admin',
          nip: 'ADMIN-01',
          nama: 'Administrator',
          role: 'admin',
          isGuru: true,
          isWalas: false,
          isAdmin: true,
          kelas: 'Pusat Tata Usaha & Admin',
          email: 'admin@smkn1sumedang.sch.id'
        };
      } else if (isGuruPage) {
        u = {
          nip: '199209142022211007',
          nama: 'Muhammad Echa Putra, S.Kom.Gr',
          role: 'walas',
          isWalas: true,
          walasKelasId: 'XII RPL 2',
          kelas: 'XII RPL 2',
          email: 'echa@smkn1sumedang.sch.id'
        };
      } else {
        u = {
          uid: 'UID_0098263610',
          nisn: '0098263610',
          nama: 'M. IHSAN ATHALLAH',
          role: 'siswa',
          isVerified: true,
          kelas: 'XII RPL 2'
        };
      }
    }

    const isAdmin = Boolean((u.role === 'admin' || u.isAdmin) || (isAdminPage && u.role !== 'pengunjung' && u.isVerified !== false));
    const isGuru = Boolean(isAdmin || (u.nip && (u.role === 'guru' || u.role === 'walas' || u.isGuru) && u.isVerified !== false) || (isGuruPage && !isAdminPage && u.nip && u.role !== 'pengunjung' && u.isVerified !== false));
    const isSiswa = Boolean(!isAdmin && !isGuru && u.nisn && (u.role === 'siswa' || !u.role) && u.role !== 'pengunjung' && u.isVerified !== false);

    const isPengunjung = Boolean(
      u.role === 'pengunjung' ||
      u.isPengunjung === true ||
      u.isVerified === false ||
      (!isAdmin && !isGuru && !isSiswa)
    );

    if (isPengunjung) {
      const cleanUid = String(u.uid || u.id || ('pengunjung_' + (u.nama || 'tamu').replace(/\s+/g, '_').toLowerCase()));
      return {
        id: cleanUid,
        uid: cleanUid,
        nama: u.nama || 'Pengunjung / Tamu Sekolah',
        role: 'pengunjung',
        isVerified: false,
        isPengunjung: true,
        isGuru: false,
        isWalas: false,
        isAdmin: false,
        walasKelasId: null,
        nomorKontak: '-',
        nisn: null,
        nip: null,
        kelas: null,
        foto: u.foto || u.foto_google || ''
      };
    }

    let cleanId = '';
    if (isAdmin) {
      cleanId = String(u.id || u.nip || 'admin').trim();
    } else if (isGuru) {
      cleanId = String(u.nip || '').replace(/[^0-9]/g, '') || '199209142022211007';
    } else {
      cleanId = String(u.nisn || u.id || u.uid || u.nomorKontak || '').replace(/^UID_/i, '').replace(/[^0-9]/g, '') || (typeof localStorage !== 'undefined' && String(localStorage.getItem('nisn_aktif') || '').replace(/[^0-9]/g, '')) || '';
      if (!cleanId && u.nama) {
        const ms = (typeof MASTER_DATA_SISWA_RESMI !== 'undefined' && MASTER_DATA_SISWA_RESMI) || {};
        const foundS = Object.values(ms).find(s => s && s.nama && (s.nama.toLowerCase().includes(u.nama.toLowerCase()) || u.nama.toLowerCase().includes(s.nama.toLowerCase())));
        if (foundS && foundS.nisn) cleanId = String(foundS.nisn).replace(/[^0-9]/g, '');
      }
      if (!cleanId && u.id) {
        cleanId = String(u.id).replace(/^UID_/i, '');
      }
      if (!cleanId) cleanId = '0098263610';
    }

    const id = cleanId;
    const isWalas = !isAdmin && Boolean(
      u.isWalas || u.role === 'walas' || u.walasKelasId ||
      u.nip === '199209142022211007' || u.nip === '198312052022211017' || u.nip === '198504252024211008'
    );
    const walasKelas = u.walasKelasId || (
      u.nip === '199209142022211007' ? 'XII RPL 2' : (
        u.nip === '198312052022211017' ? 'XII RPL 1' : (
          u.nip === '198504252024211008' ? 'XII TKJ 1' : null
        )
      )
    );

    const finalNip = isGuru ? (u.nip ? String(u.nip) : (isAdmin ? null : String(id))) : null;
    const finalNisn = (!isGuru && !isAdmin) ? (u.nisn ? String(u.nisn) : String(id)) : null;

    return {
      id: String(id),
      uid: u.uid || ('UID_' + id),
      nama: u.nama || (isAdmin ? 'Administrator' : (isGuru ? 'Muhammad Echa Putra, S.Kom.Gr' : 'M. IHSAN ATHALLAH')),
      role: isAdmin ? 'admin' : (isGuru ? (isWalas ? 'walas' : (u.role || 'guru')) : 'siswa'),
      isVerified: true,
      isPengunjung: false,
      isGuru: isGuru,
      isWalas: isWalas,
      isAdmin: isAdmin,
      nip: finalNip,
      nisn: finalNisn,
      walasKelasId: walasKelas,
      nomorKontak: finalNip || finalNisn || u.nomorKontak || String(id),
      kelas: walasKelas || u.kelas || (isAdmin ? 'Pusat Tata Usaha & Admin' : (isGuru ? 'XII RPL 2' : 'XII RPL 2')),
      foto: isAdmin ? 'assets/foto/admin.jpg' : (u.foto || (isGuru ? (finalNip ? 'assets/foto/guru_' + finalNip + '.jpg' : '') : (finalNisn ? 'assets/foto/' + finalNisn + '.jpg' : '')))
    };
  }

  // 1b. Helper Validasi Akun Terverifikasi (Hanya Siswa, Guru, Walas, & Admin Terverifikasi yang boleh akses chat)
  function isAkunTerverifikasiChat(user) {
    const u = user || getActiveUserChat();
    if (!u) return false;
    if (u.role === 'pengunjung' || u.isPengunjung === true || u.isVerified === false) return false;
    if (u.isAdmin || u.role === 'admin') return true;
    if (u.isGuru || u.role === 'guru' || u.role === 'walas') {
      const guruNip = u.nip || (u.nomorKontak && u.nomorKontak !== '-' && /^\d{10,}$/.test(String(u.nomorKontak)) ? String(u.nomorKontak) : null);
      return Boolean(guruNip && u.isVerified !== false);
    }
    if (u.role === 'siswa') {
      const siswaNisn = u.nisn || (u.nomorKontak && u.nomorKontak !== '-' && /^\d{8,}$/.test(String(u.nomorKontak)) ? String(u.nomorKontak) : null);
      return Boolean(siswaNisn && u.isVerified !== false);
    }
    return false;
  }

  // 1c. Modal Dialog Akses Kunci WhatsApp Presensia (Khusus Akun Belum Terverifikasi)
  function tampilkanModalKunciWaChat() {
    if (typeof document === 'undefined') return;
    let modal = document.getElementById('modalKunciWaChatOverlay');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modalKunciWaChatOverlay';
      modal.className = 'wa-lock-modal-overlay';
      modal.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(15,23,42,0.65);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:16px;';
      modal.onclick = (e) => {
        if (e && e.target === modal) tutupModalKunciWaChat();
      };
      if (document.body && typeof document.body.appendChild === 'function') {
        document.body.appendChild(modal);
      }
    }

    const currentUser = getActiveUserChat();
    const namaUser = escapeHtmlWa(currentUser.nama || 'Pengunjung / Tamu');

    modal.innerHTML = `
      <div class="wa-lock-modal-card" style="background:#ffffff;border-radius:20px;max-width:460px;width:100%;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);border:1px solid #e2e8f0;overflow:hidden;text-align:center;font-family:inherit;position:relative;z-index:100001;">
        <div style="background:linear-gradient(135deg, #075E54 0%, #128C7E 100%);padding:24px 20px 20px 20px;color:#ffffff;position:relative;">
          <button type="button" class="wa-lock-close-btn" id="waLockCloseBtn" onclick="tutupModalKunciWaChat()" style="position:absolute;top:14px;right:14px;background:rgba(255,255,255,0.2);border:none;color:#ffffff;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:16px;font-weight:700;display:flex;align-items:center;justify-content:center;transition:background 0.2s;" title="Tutup">✕</button>
          <div style="width:58px;height:58px;background:rgba(255,255,255,0.18);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 12px auto;font-size:26px;">
            🔒
          </div>
          <h3 style="margin:0;font-size:18px;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">
            WhatsApp Presensia Terkunci
          </h3>
          <p style="margin:6px 0 0 0;font-size:13px;opacity:0.9;color:#E0F2F1;">
            Khusus Siswa & Guru / Walas Terverifikasi
          </p>
        </div>

        <div style="padding:24px 22px;">
          <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:12px;padding:12px 14px;text-align:left;margin-bottom:18px;">
            <div style="font-size:12.5px;font-weight:700;color:#92400E;margin-bottom:4px;display:flex;align-items:center;gap:6px;">
              <span>⚠️</span> Status Akun: Pengunjung / Belum Terverifikasi
            </div>
            <div style="font-size:12px;color:#78350F;line-height:1.5;">
              Halo <strong>${namaUser}</strong>, akun Anda belum ditautkan dengan data resmi sekolah (NISN Siswa atau NIP Guru). Demi privasi dan keamanan kelas, fitur chat dan forum grup hanya dapat diakses setelah akun diverifikasi.
            </div>
          </div>

          <p style="font-size:13px;color:#475569;margin:0 0 18px 0;line-height:1.55;">
            Silakan pilih metode verifikasi di bawah ini untuk mengaktifkan akses obrolan dan grup kelas Anda:
          </p>

          <div style="display:flex;flex-direction:column;gap:10px;">
            <button type="button" id="waBtnAksiVerifNisn" onclick="aksiVerifikasiNisnDariChat()" style="width:100%;padding:12px 16px;background:linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%);color:#ffffff;border:none;border-radius:12px;font-size:13.5px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 4px 12px rgba(37,99,235,0.25);">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
              <span>Verifikasi NISN Siswa</span>
            </button>

            <button type="button" id="waBtnAksiVerifNip" onclick="aksiVerifikasiNipDariChat()" style="width:100%;padding:12px 16px;background:#F8FAFC;color:#4338CA;border:1.5px solid #C7D2FE;border-radius:12px;font-size:13.5px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              <span>Verifikasi NIP Guru / Wali Kelas</span>
            </button>

            <button type="button" class="wa-lock-cancel-btn" id="waLockCancelBtn" onclick="tutupModalKunciWaChat()" style="margin-top:6px;background:transparent;border:none;color:#64748B;font-size:13px;font-weight:600;cursor:pointer;padding:8px 12px;border-radius:8px;transition:all 0.2s;">
              Nanti Saja
            </button>
          </div>
        </div>
      </div>
    `;

    // Direct event listener bindings to guarantee execution regardless of inline onclick or scope
    const btnClose = modal.querySelector('#waLockCloseBtn') || modal.querySelector('.wa-lock-close-btn');
    if (btnClose) {
      btnClose.onclick = function (e) {
        if (e) {
          if (typeof e.preventDefault === 'function') e.preventDefault();
          if (typeof e.stopPropagation === 'function') e.stopPropagation();
        }
        tutupModalKunciWaChat();
      };
    }

    const btnCancel = modal.querySelector('#waLockCancelBtn') || modal.querySelector('.wa-lock-cancel-btn');
    if (btnCancel) {
      btnCancel.onclick = function (e) {
        if (e) {
          if (typeof e.preventDefault === 'function') e.preventDefault();
          if (typeof e.stopPropagation === 'function') e.stopPropagation();
        }
        tutupModalKunciWaChat();
      };
    }

    const btnNisn = modal.querySelector('#waBtnAksiVerifNisn');
    if (btnNisn) {
      btnNisn.onclick = function (e) {
        if (e) {
          if (typeof e.preventDefault === 'function') e.preventDefault();
          if (typeof e.stopPropagation === 'function') e.stopPropagation();
        }
        aksiVerifikasiNisnDariChat();
      };
    }

    const btnNip = modal.querySelector('#waBtnAksiVerifNip');
    if (btnNip) {
      btnNip.onclick = function (e) {
        if (e) {
          if (typeof e.preventDefault === 'function') e.preventDefault();
          if (typeof e.stopPropagation === 'function') e.stopPropagation();
        }
        aksiVerifikasiNipDariChat();
      };
    }

    modal.onclick = function (e) {
      if (e && e.target === modal) {
        tutupModalKunciWaChat();
      }
    };

    const handleEsc = function (e) {
      if (e && (e.key === 'Escape' || e.keyCode === 27)) {
        tutupModalKunciWaChat();
        if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
          document.removeEventListener('keydown', handleEsc);
        }
      }
    };
    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      document.addEventListener('keydown', handleEsc);
    }

    modal.style.display = 'flex';
  }

  function tutupModalKunciWaChat() {
    if (typeof document === 'undefined') return;
    const modal = document.getElementById('modalKunciWaChatOverlay');
    if (modal) modal.style.display = 'none';
  }

  function aksiVerifikasiNisnDariChat() {
    tutupModalKunciWaChat();
    if (typeof window !== 'undefined' && typeof window.bukaModalProfilDenganTabNisn === 'function') {
      window.bukaModalProfilDenganTabNisn();
    } else if (typeof global !== 'undefined' && typeof global.bukaModalProfilDenganTabNisn === 'function') {
      global.bukaModalProfilDenganTabNisn();
    } else if (typeof window !== 'undefined' && typeof window.bukaModalProfil === 'function') {
      window.bukaModalProfil();
    } else if (typeof document !== 'undefined') {
      const bannerBtn = document.querySelector('#bannerGuestVerifikasi .btn-guest-verify');
      if (bannerBtn && typeof bannerBtn.click === 'function') bannerBtn.click();
    }
  }

  function aksiVerifikasiNipDariChat() {
    tutupModalKunciWaChat();
    if (typeof window !== 'undefined' && typeof window.bukaModalProfilDenganTabNip === 'function') {
      window.bukaModalProfilDenganTabNip('walas');
    } else if (typeof global !== 'undefined' && typeof global.bukaModalProfilDenganTabNip === 'function') {
      global.bukaModalProfilDenganTabNip('walas');
    } else if (typeof window !== 'undefined' && typeof window.bukaModalProfil === 'function') {
      window.bukaModalProfil();
    } else if (typeof document !== 'undefined') {
      const bannerBtns = document.querySelectorAll('#bannerGuestVerifikasi .btn-guest-verify');
      if (bannerBtns && bannerBtns[1] && typeof bannerBtns[1].click === 'function') bannerBtns[1].click();
    }
  }

  function perbaruiStatusWaChatHub() {
    if (typeof document === 'undefined') return;
    const currentUser = getActiveUserChat();
    const isVerified = isAkunTerverifikasiChat(currentUser);
    const btnFloat = document.getElementById('waFloatingBtn');
    const badgeCounter = document.getElementById('waBadgeCounter');
    let lockBadge = document.getElementById('waFloatingLockBadge');
    const hubWin = document.getElementById('waHubWindow');

    if (!isVerified) {
      if (hubWin && hubWin.style.display !== 'none') {
        hubWin.style.display = 'none';
        waActiveRoomId = null;
      }
      if (typeof tutupInfoGrupModal === 'function') tutupInfoGrupModal();

      if (activeRoomFirebaseRef && activeRoomFirebaseCallback) {
        try { activeRoomFirebaseRef.off('value', activeRoomFirebaseCallback); } catch (e) {}
        activeRoomFirebaseRef = null;
        activeRoomFirebaseCallback = null;
      }
      if (activeRoomFirebaseRef2 && activeRoomFirebaseCallback2) {
        try { activeRoomFirebaseRef2.off('value', activeRoomFirebaseCallback2); } catch (e) {}
        activeRoomFirebaseRef2 = null;
        activeRoomFirebaseCallback2 = null;
      }
      if (globalChatRoomsRef && globalChatRoomsCallback) {
        try { globalChatRoomsRef.off('value', globalChatRoomsCallback); } catch (e) {}
        globalChatRoomsRef = null;
        globalChatRoomsCallback = null;
      }

      if (btnFloat) {
        btnFloat.title = 'WhatsApp Presensia (Terkunci - Verifikasi NISN / NIP)';
        if (btnFloat.classList && typeof btnFloat.classList.add === 'function') {
          btnFloat.classList.add('wa-floating-btn-locked');
        }
        if (!lockBadge) {
          lockBadge = document.createElement('div');
          lockBadge.id = 'waFloatingLockBadge';
          lockBadge.className = 'wa-floating-lock-badge';
          lockBadge.title = 'Akses chat terkunci (perlu verifikasi)';
          lockBadge.innerHTML = '🔒';
          lockBadge.style.cssText = 'position:absolute;top:-4px;right:-4px;background:#ef4444;color:#ffffff;border-radius:50%;width:20px;height:20px;display:flex;align-items:center;justify-content:center;font-size:11px;border:2px solid #ffffff;box-shadow:0 2px 6px rgba(0,0,0,0.25);pointer-events:none;z-index:2;';
          btnFloat.appendChild(lockBadge);
        } else {
          lockBadge.style.display = 'flex';
        }
        if (badgeCounter) {
          badgeCounter.style.display = 'none';
        }
      }
    } else {
      if (btnFloat) {
        btnFloat.title = 'Buka WhatsApp Presensia (Chat & Grup)';
        if (btnFloat.classList && typeof btnFloat.classList.remove === 'function') {
          btnFloat.classList.remove('wa-floating-btn-locked');
        }
        if (lockBadge) {
          lockBadge.style.display = 'none';
        }
      }
      tutupModalKunciWaChat();
    }
  }

  // Helper: Resolusi Foto Profil Pengguna (Admin = Kepala Sekolah Sakayanagi, Guru = CotE Faculty, Siswa = CotE Student)
  function getFotoPenggunaChat(u) {
    if (!u) return '';
    if (typeof u === 'string') {
      const clean = u.trim();
      if (clean === 'admin' || clean.toUpperCase() === 'ADMIN' || clean === 'ADMIN-01') return 'assets/foto/admin.jpg';
      const masterGuru = (typeof MASTER_GURU_RESMI !== 'undefined' && MASTER_GURU_RESMI) || (typeof window !== 'undefined' && window.MASTER_GURU_RESMI) || {};
      if (masterGuru[clean] && masterGuru[clean].foto) return masterGuru[clean].foto;
      const masterSiswa = (typeof MASTER_DATA_SISWA_RESMI !== 'undefined' && MASTER_DATA_SISWA_RESMI) || (typeof window !== 'undefined' && window.MASTER_DATA_SISWA_RESMI) || {};
      if (masterSiswa[clean] && masterSiswa[clean].foto) return masterSiswa[clean].foto;
      if (clean.length === 18) return 'assets/foto/guru_' + clean + '.jpg';
      if (clean.length >= 8 && clean.length <= 10) return 'assets/foto/' + clean + '.jpg';
      const allC = getSemuaKontak();
      const c = allC.find(x => String(x.id) === clean || String(x.nomorKontak) === clean);
      if (c && c.foto) return c.foto;
      return '';
    }
    if (u.foto && typeof u.foto === 'string' && u.foto.length > 3) return u.foto;
    const id = String(u.id || u.pengirimId || u.senderId || u.userId || u.uid || '').replace(/^UID_/, '');
    const role = u.role || '';
    if (role === 'admin' || id === 'admin' || id.toUpperCase() === 'ADMIN' || id === 'ADMIN-01') {
      return 'assets/foto/admin.jpg';
    }
    const nip = u.nip || (id.length === 18 ? id : null);
    if (nip) {
      const masterGuru = (typeof MASTER_GURU_RESMI !== 'undefined' && MASTER_GURU_RESMI) || (typeof window !== 'undefined' && window.MASTER_GURU_RESMI) || {};
      if (masterGuru[nip] && masterGuru[nip].foto) return masterGuru[nip].foto;
      return 'assets/foto/guru_' + nip + '.jpg';
    }
    const nisn = u.nisn || (id.length >= 8 && id.length <= 10 ? id : null);
    if (nisn) {
      const masterSiswa = (typeof MASTER_DATA_SISWA_RESMI !== 'undefined' && MASTER_DATA_SISWA_RESMI) || (typeof window !== 'undefined' && window.MASTER_DATA_SISWA_RESMI) || {};
      if (masterSiswa[nisn] && masterSiswa[nisn].foto) return masterSiswa[nisn].foto;
      return 'assets/foto/' + nisn + '.jpg';
    }
    const allC = getSemuaKontak();
    const c = allC.find(x => String(x.id) === id || (u.nomorKontak && String(x.nomorKontak) === String(u.nomorKontak)));
    if (c && c.foto) return c.foto;
    return '';
  }

  // 2. Ambil Semua Kontak (Guru & Siswa) dari Master Data
  function getSemuaKontak() {
    const list = [];
    const masterSiswa = (typeof MASTER_DATA_SISWA_RESMI !== 'undefined' && MASTER_DATA_SISWA_RESMI)
      || (typeof window !== 'undefined' && window.MASTER_DATA_SISWA_RESMI) || {};
    const masterGuru = (typeof MASTER_GURU_RESMI !== 'undefined' && MASTER_GURU_RESMI)
      || (typeof window !== 'undefined' && window.MASTER_GURU_RESMI) || DEFAULT_GURU_CONTACTS;

    // Masukkan Administrator di posisi pertama agar mudah dihubungi guru & walas (CotE: Narumori Sakayanagi)
    list.push({
      id: 'admin',
      nip: 'ADMIN-01',
      nomorKontak: 'ADMIN',
      nama: 'Administrator (Admin Sekolah)',
      role: 'admin',
      isWalas: false,
      walasKelasId: null,
      kelas: 'Pusat Tata Usaha & Admin',
      isGuru: true,
      isAdmin: true,
      foto: 'assets/foto/admin.jpg',
      foto_karakter: 'Narumori Sakayanagi'
    });

    // Masukkan Guru & Walas
    Object.values(masterGuru).forEach(g => {
      if (!g || !g.nama) return;
      const nip = g.nip || g.id || g.email || '-';
      const isWalas = Boolean(g.isWalas || g.walasKelasId || g.role === 'walas' || nip === '199209142022211007' || nip === '198312052022211017' || nip === '198504252024211008');
      const walasKelas = g.walasKelasId || (nip === '199209142022211007' ? 'XII RPL 2' : (nip === '198312052022211017' ? 'XII RPL 1' : (nip === '198504252024211008' ? 'XII TKJ 1' : null)));

      list.push({
        id: String(nip),
        nip: String(nip),
        nomorKontak: String(nip),
        nama: g.nama,
        role: isWalas ? 'walas' : 'guru',
        isWalas: isWalas,
        walasKelasId: walasKelas,
        kelas: walasKelas || g.kelas || 'Guru Pengajar',
        isGuru: true,
        foto: g.foto || ('assets/foto/guru_' + nip + '.jpg'),
        foto_karakter: g.foto_karakter || ''
      });
    });

    // Masukkan Siswa
    Object.values(masterSiswa).forEach(s => {
      if (!s || !s.nisn) return;
      list.push({
        id: String(s.nisn),
        nisn: String(s.nisn),
        nomorKontak: String(s.nisn),
        nama: s.nama,
        role: 'siswa',
        isWalas: false,
        walasKelasId: null,
        kelas: s.kelas || 'XII RPL 2',
        isGuru: false,
        foto: s.foto || ('assets/foto/' + s.nisn + '.jpg')
      });
    });

    return list;
  }

  // 3. Definisi & Muat 3 Kategori Grup Terpisah Berbasis Data Nyata Firebase
  function getDaftarGrupResmi() {
    const masterSiswa = (typeof MASTER_DATA_SISWA_RESMI !== 'undefined' && MASTER_DATA_SISWA_RESMI)
      || (typeof window !== 'undefined' && window.MASTER_DATA_SISWA_RESMI) || {};
    const masterGuru = (typeof MASTER_GURU_RESMI !== 'undefined' && MASTER_GURU_RESMI)
      || (typeof window !== 'undefined' && window.MASTER_GURU_RESMI) || DEFAULT_GURU_CONTACTS;

    // Kelompokkan siswa per kelas secara dinamis
    const siswaPerKelas = { 'XIIRPL2': [], 'XIIRPL1': [], 'XIITKJ1': [] };
    Object.values(masterSiswa).forEach(s => {
      if (!s || !s.nisn) return;
      const kNorm = normalisasiKelasChat(s.kelas || 'XII RPL 2');
      if (!siswaPerKelas[kNorm]) siswaPerKelas[kNorm] = [];
      siswaPerKelas[kNorm].push(String(s.nisn));
    });

    // Petakan walas per kelas
    const walasPerKelas = {
      'XIIRPL2': { nip: '199209142022211007', nama: 'Muhammad Echa Putra, S.Kom.Gr' },
      'XIIRPL1': { nip: '198312052022211017', nama: 'Rijal Nur Rahmat, S.T' },
      'XIITKJ1': { nip: '198504252024211008', nama: 'Heri Anggara, S.Kom' }
    };
    Object.values(masterGuru).forEach(g => {
      if (g && (g.isWalas || g.walasKelasId)) {
        const norm = normalisasiKelasChat(g.walasKelasId || g.kelas);
        if (norm) walasPerKelas[norm] = { nip: String(g.nip || g.id), nama: g.nama };
      }
    });

    const semuaGuruIds = Object.keys(masterGuru).map(String);
    const semuaWalasIds = Object.values(masterGuru)
      .filter(g => g.isWalas || g.walasKelasId || g.role === 'walas' || g.nip === '199209142022211007' || g.nip === '198312052022211017' || g.nip === '198504252024211008')
      .map(g => String(g.nip || g.id));

    const defaultGroups = {
      'group_XII_RPL_2': {
        id: 'group_XII_RPL_2',
        nama: 'Kelas XII RPL 2',
        kategori: 'kelas',
        kelas: 'XII RPL 2',
        deskripsi: 'Grup Resmi Siswa & Wali Kelas XII RPL 2 SMK Negeri 1 Sumedang',
        adminIds: [walasPerKelas['XIIRPL2'].nip, 'admin', 'ADMIN-01'],
        memberIds: Array.from(new Set([walasPerKelas['XIIRPL2'].nip, 'admin', ...(siswaPerKelas['XIIRPL2'] || ['0098263610'])]))
      },
      'group_XII_RPL_1': {
        id: 'group_XII_RPL_1',
        nama: 'Kelas XII RPL 1',
        kategori: 'kelas',
        kelas: 'XII RPL 1',
        deskripsi: 'Grup Resmi Siswa & Wali Kelas XII RPL 1 SMK Negeri 1 Sumedang',
        adminIds: [walasPerKelas['XIIRPL1'].nip, 'admin', 'ADMIN-01'],
        memberIds: Array.from(new Set([walasPerKelas['XIIRPL1'].nip, 'admin', ...(siswaPerKelas['XIIRPL1'] || ['0081234567'])]))
      },
      'group_XII_TKJ_1': {
        id: 'group_XII_TKJ_1',
        nama: 'Kelas XII TKJ 1',
        kategori: 'kelas',
        kelas: 'XII TKJ 1',
        deskripsi: 'Grup Resmi Siswa & Wali Kelas XII TKJ 1 SMK Negeri 1 Sumedang',
        adminIds: [walasPerKelas['XIITKJ1'].nip, 'admin', 'ADMIN-01'],
        memberIds: Array.from(new Set([walasPerKelas['XIITKJ1'].nip, 'admin', ...(siswaPerKelas['XIITKJ1'] || ['0071122334'])]))
      },
      'group_walas_sumedang': {
        id: 'group_walas_sumedang',
        nama: 'Forum Wali Kelas SMKN 1 Sumedang',
        kategori: 'walas',
        kelas: null,
        deskripsi: 'Koordinasi internal para Wali Kelas SMK Negeri 1 Sumedang',
        adminIds: ['199209142022211007', '198312052022211017', 'admin', 'ADMIN-01'],
        memberIds: Array.from(new Set(['admin', ...(semuaWalasIds.length > 0 ? semuaWalasIds : ['199209142022211007', '198312052022211017', '198504252024211008'])]))
      },
      'group_dewan_guru': {
        id: 'group_dewan_guru',
        nama: 'Dewan Guru & Walas SMKN 1 Sumedang',
        kategori: 'guru',
        kelas: null,
        deskripsi: 'Musyawarah Seluruh Dewan Guru Pengajar & Wali Kelas SMKN 1 Sumedang',
        adminIds: ['198109012009022003', '199209142022211007', 'admin', 'ADMIN-01'],
        memberIds: Array.from(new Set(['admin', ...(semuaGuruIds.length > 0 ? semuaGuruIds : ['198109012009022003', '197905032006042004', '199209142022211007', '198312052022211017', '198504252024211008'])]))
      }
    };

    try {
      if (typeof localStorage !== 'undefined') {
        const custom = localStorage.getItem('wa_custom_groups');
        if (custom) {
          const parsed = JSON.parse(custom);
          Object.assign(defaultGroups, parsed);
        }
      }
    } catch (e) {}

    return defaultGroups;
  }

  // 4. Verifikasi Otorisasi Akses Grup (Strict Role & Class Isolation)
  function cekAksesGrup(user, g) {
    if (!user || !g) return false;
    if (user.role === 'pengunjung' || user.isPengunjung || user.isVerified === false) return false;
    const userRole = user.role || 'siswa';
    if (userRole === 'admin' || user.isAdmin) return true;

    const isGuru = Boolean(user.isGuru || userRole === 'guru' || userRole === 'walas');
    const isWalas = Boolean(user.isWalas || userRole === 'walas' || user.walasKelasId);
    const userKelasNorm = normalisasiKelasChat(user.walasKelasId || user.kelas || '');
    const groupKelasNorm = normalisasiKelasChat(g.kelas || '');

    // 1. SISWA: HANYA boleh melihat grup kelasnya sendiri!
    if (userRole === 'siswa') {
      if (g.kategori !== 'kelas') return false; // Dilarang melihat grup walas & dewan guru
      if (groupKelasNorm && userKelasNorm && groupKelasNorm === userKelasNorm) return true;
      if (g.memberIds && g.memberIds.includes(String(user.id))) return true;
      return false; // Dilarang melihat grup kelas lain
    }

    // 2. WALI KELAS: Melihat grup kelas binaannya + Forum Walas + Dewan Guru
    if (isWalas) {
      if (g.kategori === 'kelas') {
        if (groupKelasNorm && userKelasNorm && groupKelasNorm === userKelasNorm) return true;
        if (g.adminIds && g.adminIds.includes(String(user.id))) return true;
        if (g.memberIds && g.memberIds.includes(String(user.id))) return true;
        return false; // Tidak menampilkan grup kelas lain
      }
      if (g.kategori === 'walas') return true;
      if (g.kategori === 'guru') return true;
      return false;
    }

    // 3. GURU NON-WALAS: Melihat Dewan Guru (dan kelas jika eksplisit terdaftar)
    if (userRole === 'guru' || isGuru) {
      if (g.kategori === 'guru') return true;
      if (g.kategori === 'kelas' && g.memberIds && g.memberIds.includes(String(user.id))) return true;
      return false; // Dilarang masuk grup walas tanpa wewenang
    }

    // 4. ADMIN: Akses penuh ke seluruh grup
    if (userRole === 'admin' || user.isAdmin) return true;

    return false;
  }

  function simpanGrupLokal(groups) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('wa_custom_groups', JSON.stringify(groups));
      }
    } catch (e) {}
  }

  const PRESET_ICONS = ['💻', '🌐', '🏫', '👑', '🎓', '📚', '⚡', '🚀', '🏆', '💬'];
  const PRESET_GRADIENTS = [
    'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
    'linear-gradient(135deg, #2563eb 0%, #38bdf8 100%)',
    'linear-gradient(135deg, #059669 0%, #10b981 100%)',
    'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
    'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
    'linear-gradient(135deg, #e11d48 0%, #fb7185 100%)',
    'linear-gradient(135deg, #0f172a 0%, #334155 100%)'
  ];

  function getGroupAvatarStyle(g) {
    if (!g) return 'background: linear-gradient(135deg, #128C7E 0%, #075E54 100%); color:#ffffff;';
    if (g.avatarGradient) return `background: ${g.avatarGradient}; color:#ffffff;`;
    if (g.avatarBg) return `background: ${g.avatarBg}; color:#ffffff;`;
    if (g.id === 'group_XII_RPL_2') {
      return 'background: linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%); color:#ffffff;';
    } else if (g.id === 'group_XII_RPL_1') {
      return 'background: linear-gradient(135deg, #2563eb 0%, #38bdf8 100%); color:#ffffff;';
    } else if (g.id === 'group_XII_TKJ_1') {
      return 'background: linear-gradient(135deg, #059669 0%, #10b981 100%); color:#ffffff;';
    } else if (g.id === 'group_walas_sumedang') {
      return 'background: linear-gradient(135deg, #d97706 0%, #f59e0b 100%); color:#ffffff;';
    } else if (g.id === 'group_dewan_guru') {
      return 'background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); color:#ffffff;';
    }
    return 'background: linear-gradient(135deg, #128C7E 0%, #075E54 100%); color:#ffffff;';
  }

  function renderGroupAvatarHtml(g) {
    if (!g) return '👥';
    if (g.avatarUrl) {
      return `<img src="${g.avatarUrl}" alt="${escapeHtmlWa(g.nama || 'Grup')}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;" onerror="this.style.display='none'">`;
    }
    if (g.avatarIcon) {
      return `<span style="font-size:18px;">${g.avatarIcon}</span>`;
    }
    if (g.id === 'group_XII_RPL_2') {
      return `<span style="font-size:11.5px;font-weight:900;letter-spacing:-0.5px;">RPL 2</span>`;
    } else if (g.id === 'group_XII_RPL_1') {
      return `<span style="font-size:11.5px;font-weight:900;letter-spacing:-0.5px;">RPL 1</span>`;
    } else if (g.id === 'group_XII_TKJ_1') {
      return `<span style="font-size:11.5px;font-weight:900;letter-spacing:-0.5px;">TKJ 1</span>`;
    } else if (g.id === 'group_walas_sumedang') {
      return `<span style="font-size:17px;">👑</span>`;
    } else if (g.id === 'group_dewan_guru') {
      return `<span style="font-size:17px;">🎓</span>`;
    }
    const initials = (g.nama || 'GP').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
    return `<span style="font-size:12px;font-weight:800;">${initials}</span>`;
  }

  // 5. Resolusi Room ID 1-on-1 (Deterministik, Bebas Kolisi, Simetris & Akses Terisolasi)
  function normalizeDirectUserId(rawId) {
    if (rawId === null || rawId === undefined) return '';
    const s = String(rawId).trim().replace(/^UID_/i, '').replace(/^guru_/i, '');
    if (!s) return '';
    if (/^admin(?:[-_]?01)?$/i.test(s)) return 'admin';
    const digits = s.replace(/[^0-9]/g, '');
    if ((digits.length >= 8 && digits.length <= 10) || digits.length === 18) {
      if (s.replace(/[^a-zA-Z0-9]/g, '') === digits || /^UID_/i.test(String(rawId)) || /^guru_/i.test(String(rawId))) {
        return digits;
      }
    }
    const cleanAlpha = s.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    return cleanAlpha || s.toLowerCase();
  }

  function getDirectRoomId(userAId, userBId) {
    const rawA = String(userAId !== null && userAId !== undefined ? userAId : '').trim();
    const rawB = String(userBId !== null && userBId !== undefined ? userBId : '').trim();
    if (!rawA || !rawB) return '';
    const cleanA = normalizeDirectUserId(rawA);
    const cleanB = normalizeDirectUserId(rawB);
    if (!cleanA || !cleanB) return '';
    return cleanA < cleanB ? `direct_${cleanA}_${cleanB}` : `direct_${cleanB}_${cleanA}`;
  }

  function parseDirectRoomParticipants(roomId) {
    if (!roomId || typeof roomId !== 'string' || !roomId.startsWith('direct_')) return null;
    const body = roomId.trim().replace(/^direct_/, '');
    const parts = body.split('_');
    if (parts.length < 2) return null;
    if (parts.length === 2) return [parts[0], parts[1]];
    if (parts.length === 3 && (parts[0].toLowerCase() === 'guru' || parts[0].toLowerCase() === 'uid')) {
      return [parts[0] + '_' + parts[1], parts[2]];
    }
    return [parts[0], parts.slice(1).join('_')];
  }

  function getUserIdentifiers(user) {
    if (!user) return [];
    const set = new Set();
    const addVal = (v) => {
      if (v === null || v === undefined) return;
      const s = String(v).trim();
      if (!s || s === '-') return;
      set.add(s);
      set.add(s.toLowerCase());
      const norm = normalizeDirectUserId(s);
      if (norm) {
        set.add(norm);
        set.add(norm.toLowerCase());
      }
      const noUid = s.replace(/^UID_/i, '').replace(/^guru_/i, '');
      if (noUid) {
        set.add(noUid);
        set.add(noUid.toLowerCase());
      }
      const cleanAlpha = s.replace(/^UID_/i, '').replace(/[^a-zA-Z0-9]/g, '');
      if (cleanAlpha) {
        set.add(cleanAlpha);
        set.add(cleanAlpha.toLowerCase());
      }
      const digits = s.replace(/[^0-9]/g, '');
      if ((digits.length >= 8 && digits.length <= 10) || digits.length === 18) {
        set.add(digits);
      }
    };

    addVal(user.id);
    addVal(user.uid);
    addVal(user.nisn);
    addVal(user.nip);
    addVal(user.nomorKontak);
    addVal(user.username);
    if (user.role === 'admin' || user.isAdmin) {
      set.add('admin');
      set.add('ADMIN-01');
      set.add('admin01');
    }
    return Array.from(set);
  }

  function isUserInDirectRoom(user, roomId) {
    if (!user || !roomId || typeof roomId !== 'string' || !roomId.startsWith('direct_')) return false;
    const parts = parseDirectRoomParticipants(roomId);
    if (!parts) return false;
    const userIds = getUserIdentifiers(user);
    const pA = parts[0];
    const pB = parts[1];
    return userIds.includes(pA) || userIds.includes(pA.toLowerCase()) ||
           userIds.includes(pB) || userIds.includes(pB.toLowerCase());
  }

  function getOtherParticipantId(user, roomId) {
    if (!user || !roomId || typeof roomId !== 'string' || !roomId.startsWith('direct_')) return null;
    const parts = parseDirectRoomParticipants(roomId);
    if (!parts) return null;
    const userIds = getUserIdentifiers(user);
    const pA = parts[0];
    const pB = parts[1];
    const matchA = userIds.includes(pA) || userIds.includes(pA.toLowerCase());
    const matchB = userIds.includes(pB) || userIds.includes(pB.toLowerCase());
    if (matchA && !matchB) return pB;
    if (matchB && !matchA) return pA;
    if (matchA && matchB) return pB;
    return null;
  }

  function isCurrentSender(msg, currentUser) {
    if (!msg || !currentUser) return false;
    const myIds = getUserIdentifiers(currentUser);
    const msgSenderRaw = [
      msg.pengirimId,
      msg.senderId,
      msg.userId,
      msg.uid,
      msg.nomorKontak,
      msg.nisn,
      msg.nip
    ];
    let hasAnySenderId = false;
    for (const raw of msgSenderRaw) {
      if (raw === null || raw === undefined) continue;
      const s = String(raw).trim();
      if (!s || s === '-') continue;
      hasAnySenderId = true;
      if (myIds.includes(s) || myIds.includes(s.toLowerCase())) return true;
      const norm = normalizeDirectUserId(s);
      if (norm && (myIds.includes(norm) || myIds.includes(norm.toLowerCase()))) return true;
      const noUid = s.replace(/^UID_/i, '').replace(/^guru_/i, '');
      if (noUid && (myIds.includes(noUid) || myIds.includes(noUid.toLowerCase()))) return true;
      const digits = s.replace(/[^0-9]/g, '');
      if (((digits.length >= 8 && digits.length <= 10) || digits.length === 18) && myIds.includes(digits)) return true;
      const cleanAlpha = s.replace(/^UID_/i, '').replace(/[^a-zA-Z0-9]/g, '');
      if (cleanAlpha && (myIds.includes(cleanAlpha) || myIds.includes(cleanAlpha.toLowerCase()))) return true;
    }
    // Hanya gunakan fallback nama jika TIDAK ADA sender ID sama sekali di data pesan
    if (!hasAnySenderId && msg.nama && currentUser.nama && String(msg.nama).trim().toLowerCase() === String(currentUser.nama).trim().toLowerCase()) {
      return true;
    }
    return false;
  }

  // 6. Kirim Pesan ke Firebase, LocalStorage, dan Broadcast Lintas-Tab
  async function kirimPesanWaHub(roomId, text, type = 'teks', mediaData = null) {
    if (!roomId) return { success: false, error: 'Room ID tidak valid' };
    const user = getActiveUserChat();
    if (!isAkunTerverifikasiChat(user)) {
      console.warn('Pengiriman pesan chat ditolak: Akun belum terverifikasi.');
      tampilkanModalKunciWaChat();
      return { success: false, error: 'Akses ditolak: Akun pengunjung / belum terverifikasi dilarang mengirim pesan.' };
    }
    // Strict isolation: pastikan pengirim adalah peserta di direct room
    if (roomId.startsWith('direct_')) {
      if (!isUserInDirectRoom(user, roomId)) {
        console.warn('Pengiriman pesan chat ditolak: Anda bukan peserta dalam percakapan pribadi ini.', roomId);
        return { success: false, error: 'Akses ditolak: Anda bukan peserta dalam percakapan pribadi ini.' };
      }
    }
    // Strict isolation: pastikan pengirim memiliki hak akses ke group room
    if (roomId.startsWith('group_')) {
      const groups = getDaftarGrupResmi();
      const g = groups[roomId];
      if (g && !cekAksesGrup(user, g)) {
        console.warn('Pengiriman pesan chat ditolak: Anda tidak memiliki akses ke grup ini.', roomId);
        return { success: false, error: 'Akses ditolak: Anda tidak memiliki akses ke grup ini.' };
      }
    }
    const cleanText = (text || '').trim();
    if (type === 'teks' && !cleanText) {
      return { success: false, error: 'Pesan tidak boleh kosong' };
    }

    // Ekstraksi Tag/Mention (@Nama Siswa atau @Guru)
    const mentions = [];
    const allContacts = getSemuaKontak();
    allContacts.forEach(c => {
      if (c.nama && cleanText.includes('@' + c.nama)) {
        if (!mentions.includes(c.nama)) mentions.push(c.nama);
      }
    });
    const singleWordRegex = /@([a-zA-Z0-9_.-]+)/g;
    let sMatch;
    while ((sMatch = singleWordRegex.exec(cleanText)) !== null) {
      if (!mentions.includes(sMatch[1])) mentions.push(sMatch[1]);
    }

    const msgId = 'MSG_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    const msgPayload = {
      id: msgId,
      roomId: roomId,
      pengirimId: user.id,
      nama: user.nama,
      role: user.role,
      nomorKontak: user.nomorKontak,
      foto: user.foto || getFotoPenggunaChat(user),
      pesan: cleanText,
      tipe: type,
      audio_url: mediaData ? mediaData.audio_url : null,
      audio_durasi: mediaData ? mediaData.audio_durasi : 0,
      mentions: mentions,
      waktu: Date.now()
    };

    // 1. Simpan Lokal Instan (0ms)
    const localKey = 'wa_msgs_' + roomId;
    let history = [];
    try {
      history = JSON.parse(localStorage.getItem(localKey) || '[]');
    } catch (e) {}
    if (!Array.isArray(history)) history = [];
    // Mencegah duplikasi di local array
    if (!history.some(m => m && m.id === msgId)) {
      history.push(msgPayload);
    }
    try {
      localStorage.setItem(localKey, JSON.stringify(history));
      updateThreadMetadata(roomId, msgPayload);
      try { localStorage.setItem('wa_last_read_' + roomId, String(Date.now())); } catch (eR) {}
      perbaruiBadgeCounter();
    } catch (e) {}

    // 2. Render Seketika di UI jika sedang di room ini (Optimistic UI)
    if (waActiveRoomId && String(waActiveRoomId).trim() === String(roomId).trim()) {
      appendBubblePesan(msgPayload);
      scrollChatKeBawah();
    }

    // 3. Broadcast Lintas-Tab (Sertakan senderTabId agar tab ini tidak memproses ulang)
    try {
      if (waBroadcastChannel) {
        waBroadcastChannel.postMessage({
          type: 'NEW_WA_MESSAGE',
          senderTabId: CURRENT_TAB_ID,
          roomId: roomId,
          message: msgPayload
        });
      }
    } catch (eBc) {}

    // 4. Simpan ke Firebase RTDB jika online (Dual write: chat_rooms & chat_perijinan menjamin tembus cloud)
    const activeDb = getActiveDb();

    if (activeDb) {
      try {
        const results = await Promise.allSettled([
          activeDb.ref('chat_rooms/' + roomId + '/messages/' + msgId).set(msgPayload),
          activeDb.ref('chat_perijinan/' + roomId + '/messages/' + msgId).set(msgPayload)
        ]);
        const err = results.find(r => r.status === 'rejected');
        if (err) {
          console.warn('[Firebase RTDB] Kirim pesan gagal di cloud (Aturan Security Rules memblokir write):', err.reason);
        }
      } catch (eDb) {
        console.warn('[Firebase RTDB] Error saat mengirim pesan:', eDb);
      }
    }
    return { success: true, id: msgId, payload: msgPayload };
  }

  // 6b. Helper Update Thread Metadata & Unread Badge Counter
  function updateThreadMetadata(roomId, msgPayload) {
    if (!roomId || !msgPayload) return;
    const currentUser = getActiveUserChat();
    if (!currentUser || !currentUser.id) return;

    // Proteksi isolasi ketat: dilarang mencatat thread obrolan pribadi milik akun lain
    if (roomId.startsWith('direct_')) {
      if (!isUserInDirectRoom(currentUser, roomId)) {
        return;
      }
    }
    if (roomId.startsWith('group_')) {
      const groups = getDaftarGrupResmi();
      const g = groups[roomId];
      if (g && !cekAksesGrup(currentUser, g)) {
        return;
      }
    }

    const threadKey = 'wa_threads';
    let threads = {};
    try { threads = JSON.parse(localStorage.getItem(threadKey) || '{}'); } catch (e) {}
    if (typeof threads !== 'object' || threads === null) threads = {};

    let contactName = (threads[roomId] && threads[roomId].contactName) ? threads[roomId].contactName : null;
    const isGroup = roomId.startsWith('group_');
    if (!contactName || contactName === currentUser.nama || contactName === 'Kontak Presensia' || contactName.startsWith('Kontak ')) {
      if (isGroup) {
        const groups = getDaftarGrupResmi();
        contactName = (groups[roomId] && groups[roomId].nama) || 'Grup';
      } else if (roomId.startsWith('direct_')) {
        const otherId = getOtherParticipantId(currentUser, roomId);
        if (otherId) {
          const allC = getSemuaKontak();
          const targetC = allC.find(c => String(c.id) === String(otherId) || String(c.nomorKontak) === String(otherId) || String(c.nip) === String(otherId) || String(c.nisn) === String(otherId));
          contactName = targetC ? targetC.nama : ('Kontak ' + otherId);
        } else {
          contactName = (threads[roomId] && threads[roomId].contactName) || 'Kontak Presensia';
        }
      } else {
        contactName = (threads[roomId] && threads[roomId].contactName) || 'Kontak Presensia';
      }
    }

    const cleanText = msgPayload.pesan || '';
    const lastMsgText = msgPayload.tipe === 'audio' ? '🎵 Pesan Suara (Voice Note)' : cleanText;
    const lastTime = typeof msgPayload.waktu === 'number' ? msgPayload.waktu : (Date.parse(msgPayload.waktu) || Date.now());

    threads[roomId] = {
      roomId: roomId,
      contactName: contactName || 'Kontak Presensia',
      lastMessage: lastMsgText || 'Mulai percakapan',
      lastTime: lastTime,
      senderName: msgPayload.nama || '',
      senderId: msgPayload.pengirimId || '',
      roomType: isGroup ? 'group' : 'direct'
    };

    try {
      localStorage.setItem(threadKey, JSON.stringify(threads));
    } catch (e) {}
  }

  function perbaruiBadgeCounter() {
    if (typeof document === 'undefined') return 0;
    const currentUser = getActiveUserChat();
    if (!currentUser || !currentUser.id) return 0;

    if (!isAkunTerverifikasiChat(currentUser)) {
      const bFloat = document.getElementById('waBadgeCounter');
      if (bFloat) {
        bFloat.textContent = '0';
        bFloat.style.display = 'none';
      }
      const extraBadges = [
        document.getElementById('waAppbarBadge'),
        document.getElementById('badgeWaHubSidebar')
      ].filter(Boolean);
      extraBadges.forEach(b => {
        b.textContent = '0';
        b.style.display = 'none';
      });
      if (typeof perbaruiStatusWaChatHub === 'function') perbaruiStatusWaChatHub();
      return 0;
    }
    if (typeof perbaruiStatusWaChatHub === 'function') perbaruiStatusWaChatHub();

    let totalUnread = 0;
    const threadKey = 'wa_threads';
    let threads = {};
    try { threads = JSON.parse(localStorage.getItem(threadKey) || '{}'); } catch (e) {}

    Object.keys(threads).forEach(rId => {
      // Jika room ini sedang aktif dibuka di layar, tidak ada unread
      if (waActiveRoomId && String(waActiveRoomId).trim() === String(rId).trim()) return;

      // Filter hak akses: Hanya direct room yang melibatkan pengguna aktif & grup berwenang yang dihitung
      if (rId.startsWith('direct_') && !isUserInDirectRoom(currentUser, rId)) return;
      if (rId.startsWith('group_')) {
        const g = getDaftarGrupResmi()[rId];
        if (!g || !cekAksesGrup(currentUser, g)) return;
      }

      const localKey = 'wa_msgs_' + rId;
      let msgs = [];
      try { msgs = JSON.parse(localStorage.getItem(localKey) || '[]'); } catch (e) {}
      if (!Array.isArray(msgs) || msgs.length === 0) return;

      const lastRead = parseInt(localStorage.getItem('wa_last_read_' + rId) || '0', 10);
      const unreadMsgs = msgs.filter(m => m && !isCurrentSender(m, currentUser) && (m.waktu || 0) > lastRead);
      totalUnread += unreadMsgs.length;
    });

    const badge = document.getElementById('waBadgeCounter');
    if (badge) {
      if (totalUnread > 0) {
        badge.textContent = totalUnread > 99 ? '99+' : String(totalUnread);
        badge.style.display = 'flex';
      } else {
        badge.textContent = '0';
        badge.style.display = 'none';
      }
    }

    const extraBadges = [
      document.getElementById('waAppbarBadge'),
      document.getElementById('badgeWaHubSidebar')
    ].filter(Boolean);
    extraBadges.forEach(b => {
      if (totalUnread > 0) {
        b.textContent = totalUnread > 99 ? '99+' : String(totalUnread);
        b.style.display = 'inline-flex';
      } else {
        b.textContent = '0';
        b.style.display = 'none';
      }
    });
  }

  // 6c. Pemantau Global Latar Belakang Seluruh Chat Room Pengguna Aktif
  function pasangGlobalChatRoomsListener(force = false) {
    const currentUser = getActiveUserChat();
    if (!isAkunTerverifikasiChat(currentUser)) {
      return;
    }
    const activeDb = getActiveDb();
    if (!activeDb) {
      setTimeout(() => pasangGlobalChatRoomsListener(force), 600);
      return;
    }
    if (globalChatRoomsRef && !force) return;
    if (globalChatRoomsRef && globalChatRoomsCallback && force) {
      try { globalChatRoomsRef.off('value', globalChatRoomsCallback); } catch (e) {}
      globalChatRoomsRef = null;
      globalChatRoomsCallback = null;
    }

    try {
      globalChatRoomsRef = activeDb.ref('chat_rooms');
      globalChatRoomsCallback = globalChatRoomsRef.on('value', snap => {
        const roomsData = snap ? (typeof snap.val === 'function' ? snap.val() : snap) : {};
        if (!roomsData || typeof roomsData !== 'object') return;

        const currentUser = getActiveUserChat();
        if (!currentUser || !currentUser.id) return;

        const groups = getDaftarGrupResmi();
        let adaPerubahan = false;

        Object.keys(roomsData).forEach(rId => {
          const rObj = roomsData[rId];
          if (!rObj || typeof rObj !== 'object') return;
          const msgsObj = rObj.messages || {};

          let isRelasiUser = false;
          if (rId.startsWith('direct_')) {
            if (isUserInDirectRoom(currentUser, rId)) {
              isRelasiUser = true;
            }
          } else if (rId.startsWith('group_')) {
            const g = groups[rId];
            if (g && cekAksesGrup(currentUser, g)) {
              isRelasiUser = true;
            }
          }

          if (!isRelasiUser) return;

          const cloudMsgs = [];
          Object.keys(msgsObj).forEach(k => {
            const m = msgsObj[k];
            if (m && typeof m === 'object') {
              if (!m.id) m.id = k;
              cloudMsgs.push(m);
            }
          });

          if (cloudMsgs.length === 0) return;

          const lKey = 'wa_msgs_' + rId;
          let currentLocal = [];
          try { currentLocal = JSON.parse(localStorage.getItem(lKey) || '[]'); } catch (e) {}
          if (!Array.isArray(currentLocal)) currentLocal = [];

          const map = {};
          currentLocal.forEach(m => { if (m && m.id) map[m.id] = m; });
          cloudMsgs.forEach(m => { if (m && m.id) map[m.id] = m; });
          const merged = Object.values(map).sort((a, b) => (a.waktu || 0) - (b.waktu || 0));
          try { localStorage.setItem(lKey, JSON.stringify(merged)); } catch (e) {}

          const lastM = merged[merged.length - 1];
          if (lastM) updateThreadMetadata(rId, lastM);
          adaPerubahan = true;

          // Jika user sedang aktif membuka room ini, langsung render seketika!
          if (waActiveRoomId && String(waActiveRoomId).trim() === String(rId).trim()) {
            renderDaftarPesan(merged);
            try { localStorage.setItem('wa_last_read_' + rId, String(Date.now())); } catch (e) {}
          }
        });

        if (adaPerubahan) {
          perbaruiBadgeCounter();
          if (waActiveTab === 'chats' && !waActiveRoomId) {
            renderTabKontenWa();
          }
        }
      }, err => {
        console.warn('[Firebase RTDB] Global chat_rooms listener ditolak aturan keamanan:', err);
      });
    } catch (eGlobal) {
      console.warn('[Firebase RTDB] Gagal memasang global listener:', eGlobal);
    }
  }

  // 7. Muat Pesan Riwayat & Pasang Listener RTDB Ganda dengan Cleanup
  function muatPesanRoom(roomId) {
    const currentUser = getActiveUserChat();
    if (!isAkunTerverifikasiChat(currentUser)) {
      return [];
    }
    // Proteksi isolasi: Akun yang bukan peserta direct room dilarang memuat pesan
    if (roomId && roomId.startsWith('direct_')) {
      if (!isUserInDirectRoom(currentUser, roomId)) {
        console.warn('Akses ditolak: Dilarang memuat pesan percakapan pribadi milik orang lain.', roomId);
        return [];
      }
    }
    // Proteksi isolasi: Akun yang tidak punya hak akses grup dilarang memuat pesan
    if (roomId && roomId.startsWith('group_')) {
      const groups = getDaftarGrupResmi();
      const g = groups[roomId];
      if (g && !cekAksesGrup(currentUser, g)) {
        console.warn('Akses ditolak: Dilarang memuat pesan grup tanpa izin.', roomId);
        return [];
      }
    }
    const localKey = 'wa_msgs_' + roomId;
    let list = [];
    try {
      list = JSON.parse(localStorage.getItem(localKey) || '[]');
    } catch (e) {}
    if (!Array.isArray(list)) list = [];

    // Detach previous listeners jika berpindah room
    if (activeRoomFirebaseRef && activeRoomFirebaseCallback) {
      try { activeRoomFirebaseRef.off('value', activeRoomFirebaseCallback); } catch (e) {}
      activeRoomFirebaseRef = null;
      activeRoomFirebaseCallback = null;
    }
    if (activeRoomFirebaseRef2 && activeRoomFirebaseCallback2) {
      try { activeRoomFirebaseRef2.off('value', activeRoomFirebaseCallback2); } catch (e) {}
      activeRoomFirebaseRef2 = null;
      activeRoomFirebaseCallback2 = null;
    }

    const activeDb = getActiveDb();

    if (activeDb) {
      // 1. Self-healing sync: dorong pesan lokal yang ada ke cloud agar terbaca lawan bicara
      if (list.length > 0) {
        list.forEach(lm => {
          if (lm && lm.id) {
            activeDb.ref('chat_rooms/' + roomId + '/messages/' + lm.id).update(lm).catch(() => null);
            activeDb.ref('chat_perijinan/' + roomId + '/messages/' + lm.id).update(lm).catch(() => null);
          }
        });
      }

      // 2. Handler penggabungan pesan cloud ke lokal & tampilan
      const handleSnapshot = snap => {
        const val = snap.val() || {};
        const cloudMsgs = [];
        if (val && typeof val === 'object') {
          Object.keys(val).forEach(k => {
            const item = val[k];
            if (item && typeof item === 'object') {
              if (!item.id) item.id = k;
              cloudMsgs.push(item);
            }
          });
        }
        if (cloudMsgs.length > 0) {
          let currentLocal = [];
          try { currentLocal = JSON.parse(localStorage.getItem(localKey) || '[]'); } catch (e) {}
          if (!Array.isArray(currentLocal)) currentLocal = [];

          const map = {};
          currentLocal.forEach(m => { if (m && m.id) map[m.id] = m; });
          cloudMsgs.forEach(m => { if (m && m.id) map[m.id] = m; });
          const merged = Object.values(map).sort((a, b) => (a.waktu || 0) - (b.waktu || 0));
          try { localStorage.setItem(localKey, JSON.stringify(merged)); } catch (e) {}

          const lastM = merged[merged.length - 1];
          if (lastM) updateThreadMetadata(roomId, lastM);

          if (waActiveRoomId && String(waActiveRoomId).trim() === String(roomId).trim()) {
            renderDaftarPesan(merged);
            try { localStorage.setItem('wa_last_read_' + roomId, String(Date.now())); } catch (e) {}
            perbaruiBadgeCounter();
          } else {
            perbaruiBadgeCounter();
            if (waActiveTab === 'chats' && !waActiveRoomId) {
              renderTabKontenWa();
            }
          }
        }
      };

      try {
        // Plain reference tanpa .limitToLast() yang memicu HTTP 400 Bad Request jika belum diindeks
        activeRoomFirebaseRef = activeDb.ref('chat_rooms/' + roomId + '/messages');
        activeRoomFirebaseCallback = activeRoomFirebaseRef.on('value', handleSnapshot, err => {
          console.warn('[Firebase RTDB] Listener chat_rooms ditolak aturan keamanan (Permission Denied):', err);
        });
      } catch (eSnap1) {}

      try {
        activeRoomFirebaseRef2 = activeDb.ref('chat_perijinan/' + roomId + '/messages');
        activeRoomFirebaseCallback2 = activeRoomFirebaseRef2.on('value', handleSnapshot, err => {
          console.warn('[Firebase RTDB] Listener chat_perijinan ditolak aturan keamanan (Permission Denied):', err);
        });
      } catch (eSnap2) {}
    }

    return list;
  }

  // 8. Voice Note (VN) Recorder
  async function toggleVoiceNoteRecording() {
    const currentUser = getActiveUserChat();
    if (!isAkunTerverifikasiChat(currentUser)) {
      tampilkanModalKunciWaChat();
      return;
    }
    const btnMic = document.getElementById('waBtnMic');
    if (!btnMic) return;

    if (waCurrentMediaRecorder && waCurrentMediaRecorder.state === 'recording') {
      waCurrentMediaRecorder.stop();
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Perangkat peramban Anda tidak mendukung perekaman suara (MediaRecorder API).');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      waAudioChunks = [];

      let mimeType = '';
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported) {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
          mimeType = 'audio/ogg;codecs=opus';
        }
      }
      const recOptions = mimeType ? { mimeType } : {};
      waCurrentMediaRecorder = new MediaRecorder(stream, recOptions);

      waCurrentMediaRecorder.ondataavailable = e => {
        if (e.data && e.data.size > 0) waAudioChunks.push(e.data);
      };

      waCurrentMediaRecorder.onstop = async () => {
        clearInterval(waRecordingTimer);
        const finalSecs = Math.max(1, waRecordSeconds);
        waRecordSeconds = 0;
        btnMic.classList.remove('wa-recording-active');
        btnMic.title = 'Rekam Voice Note';
        const txtInput = document.getElementById('waInputText');
        if (txtInput) txtInput.placeholder = 'Ketik pesan atau ketik @ untuk tag...';

        stream.getTracks().forEach(t => t.stop());

        if (waAudioChunks.length > 0 && finalSecs >= 1) {
          const actualMime = waCurrentMediaRecorder.mimeType || mimeType || 'audio/webm';
          const blob = new Blob(waAudioChunks, { type: actualMime });
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result;
            kirimPesanWaHub(waActiveRoomId, 'Voice Note (' + finalSecs + 's)', 'audio', {
              audio_url: dataUrl,
              audio_durasi: finalSecs
            });
          };
          reader.readAsDataURL(blob);
        }
      };

      waCurrentMediaRecorder.start(250);
      waRecordSeconds = 0;
      btnMic.classList.add('wa-recording-active');
      const txtInput = document.getElementById('waInputText');
      if (txtInput) txtInput.placeholder = '🔴 Merekam suara... (Klik mic lagi untuk kirim)';

      waRecordingTimer = setInterval(() => {
        waRecordSeconds++;
        btnMic.title = `Merekam (${waRecordSeconds}s) — Klik untuk kirim`;
      }, 1000);

    } catch (err) {
      alert('Gagal mengakses mikrofon. Pastikan Anda mengizinkan akses mikrofon di peramban.');
    }
  }

  // 9. Render Bubble Pesan dengan Proteksi Anti Double-Render
  function appendBubblePesan(msg) {
    if (!msg || !msg.id) return;
    if (msg.tipe === 'audio' && msg.audio_url && typeof waAudioRegistry !== 'undefined') {
      waAudioRegistry.set(String(msg.id), msg.audio_url);
    }
    const container = document.getElementById('waMessagesContainer');
    if (!container) return;

    if (typeof container.querySelector === 'function' && container.children && container.children.length === 1 && !container.querySelector('.wa-bubble')) {
      container.innerHTML = '';
    }

    // GUARD ANTI DOUBLE: Jika elemen dengan ID ini sudah ada di DOM, jangan pernah render lagi!
    const cleanId = String(msg.id).replace(/[^a-zA-Z0-9_-]/g, '_');
    const bubbleId = 'waBubble_' + cleanId;
    if (document.getElementById(bubbleId)) {
      return; // Sudah tampil di layar!
    }

    const currentUser = getActiveUserChat();
    const isMe = isCurrentSender(msg, currentUser);

    const isDirectChat = msg.roomId
      ? String(msg.roomId).startsWith('direct_')
      : Boolean((waActiveRoomType === 'direct') || (waActiveRoomId && String(waActiveRoomId).startsWith('direct_')));

    const bubble = document.createElement('div');
    bubble.id = bubbleId;
    bubble.className = 'wa-bubble ' + (isMe ? 'sent' : 'received');

    // Format Jam:Menit
    const dateObj = new Date(msg.waktu || Date.now());
    const timeStr = String(dateObj.getHours()).padStart(2, '0') + ':' + String(dateObj.getMinutes()).padStart(2, '0');

    // Highlight tag mention (@Nama)
    let renderedText = escapeHtmlWa(msg.pesan || '');
    if (Array.isArray(msg.mentions) && msg.mentions.length > 0) {
      msg.mentions.forEach(mName => {
        const esc = escapeHtmlWa(mName);
        renderedText = renderedText.split('@' + esc).join('<span class="wa-mention-tag">@' + esc + '</span>');
      });
    }

    let contentHtml = '';
    if (msg.tipe === 'audio' && msg.audio_url) {
      if (typeof waAudioRegistry !== 'undefined') {
        waAudioRegistry.set(String(msg.id), msg.audio_url);
      }
      const dur = parseInt(msg.audio_durasi, 10) || 3;
      contentHtml = `
        <div class="wa-vn-player" data-msg-id="${escapeHtmlWa(msg.id)}">
          <button type="button" class="wa-vn-play-btn" data-durasi="${dur}" onclick="putarAudioWa(this, '${escapeHtmlWa(msg.id)}', ${dur})">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </button>
          <div class="wa-vn-waveform">
            <div class="wa-vn-bar" style="height:40%;"></div>
            <div class="wa-vn-bar" style="height:70%;"></div>
            <div class="wa-vn-bar" style="height:100%;"></div>
            <div class="wa-vn-bar" style="height:55%;"></div>
            <div class="wa-vn-bar" style="height:85%;"></div>
            <div class="wa-vn-bar" style="height:35%;"></div>
          </div>
          <span class="wa-vn-time">${dur}s</span>
        </div>
      `;
    } else {
      contentHtml = `<div class="wa-bubble-text">${renderedText}</div>`;
    }

    // Role badge & sender tag: HANYA untuk GRUP CHAT! DILARANG keras muncul di obrolan pribadi 1-on-1!
    const roleBadge = (!isDirectChat && (msg.role === 'admin' || msg.role === 'walas' || msg.role === 'guru'))
      ? '<span class="wa-badge-role wa-badge-admin" style="margin-left:4px;">👑 Admin</span>'
      : '';

    const senderFoto = isMe ? (currentUser.foto || getFotoPenggunaChat(currentUser)) : (msg.foto || getFotoPenggunaChat(msg));
    const senderNama = isMe ? (currentUser.nama || 'Saya') : (msg.nama || 'Pengguna');
    const inisialSender = senderNama.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

    let headerHtml = '';
    if (!isMe) {
      if (!isDirectChat) {
        // Group chat incoming bubble
        headerHtml = `
          <div class="wa-bubble-header">
            <div class="wa-bubble-avatar" title="${escapeHtmlWa(senderNama)}">
              ${senderFoto ? `<img src="${senderFoto}" alt="${escapeHtmlWa(senderNama)}" class="wa-bubble-avatar-img" onerror="this.onerror=null;this.style.display='none';this.parentElement.textContent='${inisialSender}';">` : inisialSender}
            </div>
            <div class="wa-bubble-sender"><span>${escapeHtmlWa(msg.nama || 'Pengguna')}</span>${roleBadge}</div>
          </div>
        `;
      }
    }

    bubble.innerHTML = `
      ${headerHtml}
      ${contentHtml}
      <div class="wa-bubble-meta">
        <span>${timeStr}</span>
        ${isMe ? '<span class="wa-check-icon">✓✓</span>' : ''}
      </div>
    `;

    container.appendChild(bubble);
  }

  function renderDaftarPesan(list) {
    const container = document.getElementById('waMessagesContainer');
    if (!container) return;
    container.innerHTML = '';
    if (!Array.isArray(list) || list.length === 0) {
      container.innerHTML = `
        <div style="text-align:center;padding:32px 16px;color:#64748B;font-size:13px;">
          🔒 Percakapan di ruangan ini dilindungi enkripsi sistem Presensia IoT. Mulai obrolan atau gunakan <strong>@</strong> untuk menandai anggota.
        </div>
      `;
      return;
    }
    list.forEach(m => appendBubblePesan(m));
    scrollChatKeBawah();
  }

  function scrollChatKeBawah() {
    const container = document.getElementById('waMessagesContainer');
    if (container) {
      setTimeout(() => { container.scrollTop = container.scrollHeight; }, 60);
    }
  }

  // 10. Buka Room Percakapan (Direct / Group)
  function bukaRoomWa(roomId, targetTitle, targetSubtitle, roomType = 'direct') {
    const currentUser = getActiveUserChat();
    if (!isAkunTerverifikasiChat(currentUser)) {
      const hubWin = document.getElementById('waHubWindow');
      if (hubWin) hubWin.style.display = 'none';
      tampilkanModalKunciWaChat();
      return;
    }

    // Validasi otorisasi jika membuka grup
    if (roomType === 'group' || (roomId && roomId.startsWith('group_'))) {
      const groups = getDaftarGrupResmi();
      const g = groups[roomId];
      if (g && !cekAksesGrup(currentUser, g)) {
        if (typeof alert === 'function') {
          try { alert('Akses Ditolak: Anda tidak memiliki izin untuk membuka grup ' + (g.nama || roomId) + '.'); } catch (e) {}
        }
        kembaliKeDaftarWa();
        return;
      }
    }

    // Validasi otorisasi jika membuka obrolan pribadi (Direct Room)
    if (roomType === 'direct' || (roomId && roomId.startsWith('direct_'))) {
      if (!isUserInDirectRoom(currentUser, roomId)) {
        console.warn('Akses ditolak: Anda bukan peserta dalam percakapan pribadi ini.', roomId);
        if (typeof alert === 'function') {
          try { alert('Akses Ditolak: Anda bukan peserta dalam obrolan pribadi ini.'); } catch (e) {}
        }
        kembaliKeDaftarWa();
        return;
      }
    }

    waActiveRoomId = roomId;
    waActiveRoomType = roomType;
    waActiveRoomTarget = { title: targetTitle, subtitle: targetSubtitle };

    // Daftarkan metadata thread secara instan saat room dibuka
    try {
      const threadKey = 'wa_threads';
      let threads = JSON.parse(localStorage.getItem(threadKey) || '{}');
      if (!threads[roomId]) {
        threads[roomId] = {
          roomId: roomId,
          contactName: targetTitle || 'Kontak Presensia',
          subtitle: targetSubtitle || '',
          lastMessage: 'Belum ada pesan',
          lastTime: Date.now(),
          roomType: roomType
        };
      } else {
        if (targetTitle) threads[roomId].contactName = targetTitle;
        if (targetSubtitle) threads[roomId].subtitle = targetSubtitle;
        threads[roomId].roomType = roomType;
      }
      localStorage.setItem(threadKey, JSON.stringify(threads));
      localStorage.setItem('wa_last_read_' + roomId, String(Date.now()));
    } catch (e) {}
    perbaruiBadgeCounter();

    const winList = document.getElementById('waListPanel');
    const winChat = document.getElementById('waChatView');
    const titleEl = document.getElementById('waChatHeaderName');
    const subEl = document.getElementById('waChatHeaderStatus');
    const btnGroupInfo = document.getElementById('waBtnGroupInfo');

    if (titleEl) titleEl.textContent = targetTitle;
    if (subEl) subEl.textContent = targetSubtitle || (roomType === 'group' ? 'Grup Resmi' : 'Online');
    const headerAvatar = document.getElementById('waChatHeaderAvatar');
    if (headerAvatar) {
      if (roomType === 'group') {
        const groups = getDaftarGrupResmi();
        const gObj = groups[roomId];
        headerAvatar.style = getGroupAvatarStyle(gObj) + ';width:36px;height:36px;margin-right:8px;border-radius:50%;overflow:hidden;flex-shrink:0;';
        headerAvatar.innerHTML = renderGroupAvatarHtml(gObj);
      } else {
        const otherId = getOtherParticipantId(currentUser, roomId);
        const cFoto = otherId ? getFotoPenggunaChat(otherId) : '';
        const initial = targetTitle ? targetTitle[0].toUpperCase() : '?';
        headerAvatar.style = 'width:36px;height:36px;margin-right:8px;border-radius:50%;overflow:hidden;flex-shrink:0;background:#e2e8f0;display:inline-flex;align-items:center;justify-content:center;';
        headerAvatar.innerHTML = cFoto
          ? `<img src="${cFoto}" alt="${escapeHtmlWa(targetTitle)}" style="width:100%;height:100%;object-fit:cover;object-position:center top;" onerror="this.onerror=null;this.style.display='none';this.parentElement.textContent='${initial}';">`
          : initial;
      }
    }
    if (btnGroupInfo) btnGroupInfo.style.display = (roomType === 'group') ? 'inline-flex' : 'none';

    if (winList) winList.style.display = 'none';
    if (winChat) winChat.style.display = 'flex';

    const msgs = muatPesanRoom(roomId);
    renderDaftarPesan(msgs);

    const txtInput = document.getElementById('waInputText');
    if (txtInput) {
      setTimeout(() => { try { txtInput.focus(); } catch (e) {} }, 100);
    }
  }

  function kembaliKeDaftarWa() {
    waActiveRoomId = null;
    const winList = document.getElementById('waListPanel');
    const winChat = document.getElementById('waChatView');
    if (winChat) winChat.style.display = 'none';
    if (winList) winList.style.display = 'flex';
    renderTabKontenWa();
    perbaruiBadgeCounter();
  }

  // 11. Render Konten Tab (Chats, Groups, Contacts)
  function renderTabKontenWa() {
    const body = document.getElementById('waPanelBody');
    if (!body) return;
    const currentUser = getActiveUserChat();
    const isVerified = isAkunTerverifikasiChat(currentUser);
    const query = (document.getElementById('waSearchInput')?.value || '').toLowerCase().trim();

    // Perbarui label header user secara dinamis
    const userDisplay = document.getElementById('waHeaderUserDisplay');
    if (userDisplay) {
      if (!isVerified) {
        userDisplay.innerHTML = `Masuk sebagai: <strong>${escapeHtmlWa(currentUser.nama)}</strong> • <span style="color:#fca5a5;font-weight:700;">Pengunjung (Belum Terverifikasi)</span>`;
      } else {
        const roleName = (currentUser.isAdmin || currentUser.role === 'admin') ? 'Administrator' : (currentUser.isWalas ? 'Wali Kelas' : (currentUser.role === 'guru' ? 'Guru' : 'Siswa'));
        userDisplay.innerHTML = `Masuk sebagai: <strong>${escapeHtmlWa(currentUser.nama)}</strong> (${currentUser.nomorKontak}) • <span style="opacity:0.9;">${roleName}</span>`;
      }
    }

    if (!isVerified) {
      body.innerHTML = `
        <div class="wa-locked-panel" style="text-align:center;padding:36px 20px;color:#475569;">
          <div style="width:54px;height:54px;background:#FEE2E2;color:#EF4444;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 14px auto;font-size:24px;">🔒</div>
          <div style="font-size:15px;font-weight:800;color:#0F172A;margin-bottom:6px;">WhatsApp Presensia Terkunci</div>
          <div style="font-size:12.5px;color:#64748B;line-height:1.5;margin-bottom:18px;">
            Akun Anda belum terverifikasi resmi. Tautkan <strong>NISN</strong> (untuk Siswa) atau <strong>NIP</strong> (untuk Guru / Wali Kelas) guna mengakses forum chat & grup kelas.
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;max-width:280px;margin:0 auto;">
            <button type="button" onclick="aksiVerifikasiNisnDariChat()" style="background:#2563EB;color:#fff;border:none;border-radius:8px;padding:9px 14px;font-size:12.5px;font-weight:700;cursor:pointer;">Verifikasi NISN Siswa</button>
            <button type="button" onclick="aksiVerifikasiNipDariChat()" style="background:#EEF2FF;color:#4338CA;border:1px solid #C7D2FE;border-radius:8px;padding:9px 14px;font-size:12.5px;font-weight:700;cursor:pointer;">Verifikasi NIP Guru / Walas</button>
          </div>
        </div>
      `;
      return;
    }

    body.innerHTML = '';

    // ==========================================
    // TAB 1: OBROLAN AKTIF (CHATS)
    // ==========================================
    if (waActiveTab === 'chats') {
      const threadKey = 'wa_threads';
      let threads = {};
      try { threads = JSON.parse(localStorage.getItem(threadKey) || '{}'); } catch (e) {}
      if (typeof threads !== 'object' || threads === null) threads = {};
      const threadList = Object.entries(threads).map(([key, val]) => {
        if (!val || typeof val !== 'object') return null;
        return {
          roomId: val.roomId || key,
          ...val
        };
      }).filter(th => {
        if (!th || !th.roomId) return false;
        if (th.roomId.startsWith('direct_')) {
          return isUserInDirectRoom(currentUser, th.roomId);
        }
        if (th.roomId.startsWith('group_')) {
          const g = getDaftarGrupResmi()[th.roomId];
          return g ? cekAksesGrup(currentUser, g) : false;
        }
        return false;
      }).filter(th => {
        if (!query) return true;
        const nameMatch = (th.contactName || '').toLowerCase().includes(query);
        const msgMatch = (th.lastMessage || '').toLowerCase().includes(query);
        return nameMatch || msgMatch;
      }).sort((a, b) => (b.lastTime || 0) - (a.lastTime || 0));

      if (threadList.length === 0) {
        body.innerHTML = `
          <div style="text-align:center;padding:48px 20px;color:#64748B;font-size:13.5px;">
            <div style="font-size:36px;margin-bottom:8px;">💬</div>
            <strong>Belum ada percakapan aktif.</strong><br>
            Buka tab <strong>Grup</strong> untuk chat kelas atau <strong>Kontak</strong> untuk chat pribadi.
          </div>
        `;
        return;
      }

      threadList.forEach(th => {
        const item = document.createElement('div');
        item.className = 'wa-list-item';
        const dateObj = new Date(th.lastTime || Date.now());
        const timeStr = String(dateObj.getHours()).padStart(2, '0') + ':' + String(dateObj.getMinutes()).padStart(2, '0');
        const roomId = String(th.roomId || '');
        const isGroup = roomId.startsWith('group_');
        const groups = isGroup ? getDaftarGrupResmi() : {};
        const groupObj = isGroup ? groups[roomId] : null;

        // Resolve display name: nama lawan bicara, BUKAN nama diri sendiri!
        let displayName = th.contactName;
        if (!displayName || displayName === currentUser.nama) {
          if (isGroup) {
            displayName = (groupObj && groupObj.nama) || 'Grup';
          } else if (roomId.startsWith('direct_')) {
            const otherId = getOtherParticipantId(currentUser, roomId);
            if (otherId) {
              const allC = getSemuaKontak();
              const targetC = allC.find(c => String(c.id) === String(otherId) || String(c.nomorKontak) === String(otherId) || String(c.nip) === String(otherId) || String(c.nisn) === String(otherId));
              displayName = targetC ? targetC.nama : ('Kontak ' + otherId);
            } else {
              displayName = th.contactName || 'Kontak Presensia';
            }
          } else {
            displayName = th.contactName || 'Kontak Presensia';
          }
        }

        item.onclick = (e) => {
          if (isGroup) {
            if (e && e.target && e.target.closest('.wa-group-avatar-clickable')) {
              bukaInfoGrupModal(roomId);
              return;
            }
            const g = groups[roomId] || { nama: displayName, deskripsi: 'Grup' };
            bukaRoomWa(roomId, g.nama, g.deskripsi, 'group');
          } else {
            bukaRoomWa(roomId, displayName, 'Pribadi', 'direct');
          }
        };

        let avatarStyle = '';
        let avatarContent = '';
        if (isGroup) {
          avatarStyle = getGroupAvatarStyle(groupObj);
          avatarContent = renderGroupAvatarHtml(groupObj);
        } else {
          const otherId = getOtherParticipantId(currentUser, roomId);
          const cFoto = otherId ? getFotoPenggunaChat(otherId) : '';
          const initial = displayName ? displayName[0].toUpperCase() : 'U';
          if (cFoto) {
            avatarContent = `<img src="${cFoto}" alt="${escapeHtmlWa(displayName)}" class="wa-avatar-img" onerror="this.onerror=null;this.style.display='none';this.parentElement.textContent='${initial}';">`;
          } else {
            avatarContent = initial;
          }
        }

        item.innerHTML = `
          <div class="wa-avatar ${isGroup ? 'group-avatar wa-group-avatar-clickable' : ''}" style="${avatarStyle}" title="${isGroup ? 'Klik untuk lihat Profil Grup' : ''}">
            ${avatarContent}
          </div>
          <div class="wa-item-info">
            <div class="wa-item-top">
              <span class="wa-item-name">${escapeHtmlWa(displayName)}</span>
              <span class="wa-item-time">${timeStr}</span>
            </div>
            <div class="wa-item-sub">${escapeHtmlWa(th.lastMessage || 'Mulai percakapan')}</div>
          </div>
        `;
        body.appendChild(item);
      });

    // ==========================================
    // TAB 2: GRUP (TERISOLASI ROLE & KELAS)
    // ==========================================
    } else if (waActiveTab === 'groups') {
      const allGroups = getDaftarGrupResmi();

      // Filter grup HANYA yang boleh diakses oleh currentUser
      const accessibleGroups = Object.values(allGroups).filter(g => {
        if (!cekAksesGrup(currentUser, g)) return false;
        if (query) {
          return g.nama.toLowerCase().includes(query) || (g.deskripsi && g.deskripsi.toLowerCase().includes(query));
        }
        return true;
      });

      if (accessibleGroups.length === 0) {
        body.innerHTML = `
          <div style="text-align:center;padding:48px 20px;color:#64748B;font-size:13.5px;">
            <div style="font-size:36px;margin-bottom:8px;">👥</div>
            <strong>Tidak ada grup yang dapat diakses.</strong><br>
            Anda hanya dapat melihat grup yang sesuai dengan kelas atau wewenang Anda.
          </div>
        `;
        return;
      }

      accessibleGroups.forEach(g => {
        const item = document.createElement('div');
        item.className = 'wa-list-item';
        const isAdmin = Boolean(
          currentUser.isAdmin || currentUser.role === 'admin' ||
          (g.adminIds && g.adminIds.includes(String(currentUser.id)))
        );

        item.onclick = (e) => {
          if (e && e.target && e.target.closest('.wa-group-avatar-clickable')) {
            bukaInfoGrupModal(g.id);
            return;
          }
          bukaRoomWa(g.id, g.nama, `${g.memberIds.length} Anggota • ${isAdmin ? '👑 Anda Admin Grup' : 'Anggota'}`, 'group');
        };

        // Ambil last message preview
        let lastMsgPreview = 'Belum ada pesan';
        let lastTimeStr = '';
        const threadKey = 'wa_threads';
        let threads = {};
        try { threads = JSON.parse(localStorage.getItem(threadKey) || '{}'); } catch (e) {}
        const th = threads[g.id];
        if (th && th.lastMessage && th.lastMessage !== 'Mulai percakapan') {
          const sName = th.senderName ? (th.senderName.split(' ')[0] + ': ') : '';
          lastMsgPreview = sName + th.lastMessage;
          if (th.lastTime) {
            const dt = new Date(th.lastTime);
            lastTimeStr = String(dt.getHours()).padStart(2, '0') + ':' + String(dt.getMinutes()).padStart(2, '0');
          }
        } else {
          try {
            const hist = JSON.parse(localStorage.getItem('wa_msgs_' + g.id) || '[]');
            if (Array.isArray(hist) && hist.length > 0) {
              const last = hist[hist.length - 1];
              if (last) {
                const sName = last.nama ? (last.nama.split(' ')[0] + ': ') : '';
                lastMsgPreview = sName + (last.tipe === 'audio' ? '🎵 Pesan Suara' : (last.pesan || 'Pesan'));
                const dt = last.waktu ? new Date(last.waktu) : new Date();
                lastTimeStr = String(dt.getHours()).padStart(2, '0') + ':' + String(dt.getMinutes()).padStart(2, '0');
              }
            }
          } catch (eH) {}
        }

        const avatarStyle = getGroupAvatarStyle(g);
        const avatarContent = renderGroupAvatarHtml(g);

        // Right side: Sesuai instruksi user: HAPUS role badge walas & murid, munculkan timestamp
        item.innerHTML = `
          <div class="wa-avatar group-avatar wa-group-avatar-clickable" title="Klik untuk lihat Profil Grup" style="${avatarStyle}">
            ${avatarContent}
          </div>
          <div class="wa-item-info">
            <div class="wa-item-top">
              <span class="wa-item-name">${escapeHtmlWa(g.nama)}</span>
              <span class="wa-item-time">${lastTimeStr}</span>
            </div>
            <div class="wa-item-sub">${escapeHtmlWa(lastMsgPreview)}</div>
          </div>
        `;
        body.appendChild(item);
      });

    // ==========================================
    // TAB 3: BUKU KONTAK (PINNED WALAS & SELF EXCLUSION)
    // ==========================================
    } else if (waActiveTab === 'contacts') {
      const contacts = getSemuaKontak();
      const myId = String(currentUser.id || '').trim();
      const myNomor = String(currentUser.nomorKontak || '').trim();

      // 1. Filter diri sendiri agar TIDAK muncul di daftar kontak
      let filtered = contacts.filter(c => {
        if (!c) return false;
        const cId = String(c.id || '').trim();
        const cNomor = String(c.nomorKontak || '').trim();
        if (cId === myId || cNomor === myNomor) return false;
        if (c.nisn && c.nisn === myNomor) return false;
        if (c.nip && c.nip === myNomor) return false;

        if (!query) return true;
        return (c.nama && c.nama.toLowerCase().includes(query)) ||
               (cNomor && cNomor.includes(query)) ||
               (c.kelas && c.kelas.toLowerCase().includes(query));
      });

      // 2. Jika SISWA: Posisikan Wali Kelas binaannya di posisi paling atas dengan PIN khusus!
      let pinnedWalas = null;
      if (currentUser.role === 'siswa') {
        const userKelasNorm = normalisasiKelasChat(currentUser.kelas);
        const others = [];
        filtered.forEach(c => {
          if (!pinnedWalas && c.isGuru && normalisasiKelasChat(c.kelas) === userKelasNorm) {
            pinnedWalas = c;
          } else {
            others.push(c);
          }
        });
        if (pinnedWalas) {
          filtered = [pinnedWalas, ...others];
        }
      }

      if (filtered.length === 0) {
        body.innerHTML = `<div style="text-align:center;padding:36px;color:#94a3b8;font-size:13px;">Tidak ada kontak ditemukan.</div>`;
        return;
      }

      filtered.forEach(c => {
        const item = document.createElement('div');
        const isPinned = (pinnedWalas && c.id === pinnedWalas.id);
        item.className = 'wa-list-item ' + (isPinned ? 'wa-pinned-item' : '');

        let roleLabel = c.role === 'admin' ? 'Administrator' : (c.role === 'walas' ? 'Wali Kelas' : (c.role === 'guru' ? 'Guru' : 'Siswa'));
        let roleBadge = c.role === 'admin' ? 'wa-badge-admin' : (c.role === 'walas' ? 'wa-badge-walas' : (c.role === 'guru' ? 'wa-badge-admin' : 'wa-badge-siswa'));

        if (isPinned) {
          roleLabel = '👑 Wali Kelas Anda';
          roleBadge = 'wa-badge-pinned';
        }

        item.onclick = () => {
          const directId = getDirectRoomId(currentUser.id, c.id);
          bukaRoomWa(directId, c.nama, `NISN/NIP: ${c.nomorKontak} • ${c.kelas || roleLabel}`, 'direct');
        };

        item.innerHTML = `
          <div class="wa-avatar">
            ${c.foto ? `<img src="${c.foto}" alt="${escapeHtmlWa(c.nama)}" onerror="this.onerror=null;this.style.display='none';this.parentElement.textContent='${c.nama[0]}';">` : c.nama[0].toUpperCase()}
          </div>
          <div class="wa-item-info">
            <div class="wa-item-top">
              <span class="wa-item-name">${escapeHtmlWa(c.nama)}</span>
              <span class="wa-badge-role ${roleBadge}">${roleLabel}</span>
            </div>
            <div class="wa-item-sub">Nomor ID: <strong>${c.nomorKontak}</strong> • Kelas: ${escapeHtmlWa(c.kelas || '-')}</div>
          </div>
        `;
        body.appendChild(item);
      });
    }
  }

  // 12. Modal Profil & Info Grup & Manajemen Anggota (Kick & Tambah Anggota)
  let waSelectedAvatarIcon = null;
  let waSelectedAvatarGradient = null;

  function bukaInfoGrupModal(targetGroupId) {
    const currentUser = getActiveUserChat();
    if (!isAkunTerverifikasiChat(currentUser)) {
      tutupInfoGrupModal();
      tampilkanModalKunciWaChat();
      return;
    }
    const gId = targetGroupId || waActiveGroupDetailId || waActiveRoomId;
    if (!gId || !gId.startsWith('group_')) return;
    const modal = document.getElementById('waGroupInfoModal');
    if (!modal) return;
    const groups = getDaftarGrupResmi();
    const g = groups[gId];
    if (!g || !cekAksesGrup(currentUser, g)) {
      tutupInfoGrupModal();
      alert('Akses Ditolak: Anda tidak memiliki izin untuk melihat profil grup ini.');
      return;
    }

    waActiveGroupDetailId = g.id;
    // Siswa TIDAK PERNAH boleh menjadi admin grup
    const isAdmin = Boolean(
      (g.adminIds && g.adminIds.includes(String(currentUser.id)) || currentUser.role === 'admin' || currentUser.isAdmin) &&
      currentUser.role !== 'siswa'
    );

    const titleEl = document.getElementById('waGroupInfoTitle');
    const nameEl = document.getElementById('waGroupInfoNameText');
    const descEl = document.getElementById('waGroupInfoDesc');
    const countEl = document.getElementById('waGroupInfoCount');
    const memberListEl = document.getElementById('waGroupMemberList');
    const btnAddWrap = document.getElementById('waGroupAddMemberWrap');
    const avatarEl = document.getElementById('waGroupInfoAvatar');

    if (titleEl) titleEl.textContent = 'Profil & Info Grup';
    if (nameEl) nameEl.textContent = g.nama;
    if (descEl) descEl.textContent = g.deskripsi;
    if (countEl) countEl.textContent = `${g.memberIds.length} Anggota • Admin: ${g.adminIds ? g.adminIds.length : 1}`;
    if (btnAddWrap) btnAddWrap.style.display = isAdmin ? 'block' : 'none';

    if (avatarEl) {
      avatarEl.style = getGroupAvatarStyle(g);
      avatarEl.innerHTML = renderGroupAvatarHtml(g);
    }

    // Reset avatar picker panel
    togglePickerAvatarGrup(false);

    if (memberListEl) {
      memberListEl.innerHTML = '';
      const contactMap = {};
      const allContactsList = getSemuaKontak();
      allContactsList.forEach(c => {
        if (c.id) contactMap[c.id] = c;
        if (c.nip) contactMap[c.nip] = c;
        if (c.nisn) contactMap[c.nisn] = c;
        if (c.nomorKontak) contactMap[c.nomorKontak] = c;
      });

      g.memberIds.forEach(mId => {
        const c = contactMap[mId] || { nama: 'Pengguna ID ' + mId, nomorKontak: mId, role: 'member' };
        const isMemAdmin = g.adminIds && g.adminIds.includes(mId);
        const row = document.createElement('div');
        row.className = 'wa-member-row';

        row.innerHTML = `
          <div class="wa-member-info">
            <div class="wa-avatar" style="width:36px;height:36px;font-size:12px;">${c.nama ? c.nama[0].toUpperCase() : 'U'}</div>
            <div>
              <div style="font-size:13.5px;font-weight:700;color:#0F172A;">${escapeHtmlWa(c.nama)}</div>
              <div style="font-size:11.5px;color:#64748B;">ID: ${c.nomorKontak || mId} ${isMemAdmin ? '<span class="wa-badge-role wa-badge-admin" style="margin-left:4px;">👑 Admin Grup</span>' : ''}</div>
            </div>
          </div>
          ${isAdmin && mId !== currentUser.id && !isMemAdmin ? `
            <button type="button" class="wa-btn-kick" onclick="keluarkanMemberDariGrup('${g.id}', '${mId}')">Keluarkan</button>
          ` : ''}
        `;
        memberListEl.appendChild(row);
      });
    }

    modal.style.display = 'flex';
  }

  function togglePickerAvatarGrup(forceState) {
    const panel = document.getElementById('waAvatarPickerPanel');
    if (!panel) return;
    const shouldShow = (typeof forceState === 'boolean') ? forceState : (panel.style.display === 'none');
    panel.style.display = shouldShow ? 'block' : 'none';
    if (shouldShow) {
      const groups = getDaftarGrupResmi();
      const g = groups[waActiveGroupDetailId] || {};
      const nameInput = document.getElementById('waGroupNameInput');
      const descInput = document.getElementById('waGroupDescInput');
      const urlInput = document.getElementById('waAvatarCustomUrlInput');
      if (nameInput) nameInput.value = g.nama || '';
      if (descInput) descInput.value = g.deskripsi || '';
      if (urlInput) urlInput.value = g.avatarUrl || '';
      waSelectedAvatarIcon = g.avatarIcon || null;
      waSelectedAvatarGradient = g.avatarGradient || null;
      renderAvatarPickerControls();
    }
  }

  function renderAvatarPickerControls() {
    const iconsGrid = document.getElementById('waAvatarIconsGrid');
    const colorsGrid = document.getElementById('waAvatarColorsGrid');
    const fileInput = document.getElementById('waAvatarFileInput');
    const groups = getDaftarGrupResmi();
    const g = groups[waActiveGroupDetailId] || {};

    if (fileInput && !fileInput.dataset.bound) {
      fileInput.dataset.bound = 'true';
      fileInput.onchange = function() {
        const file = this.files && this.files[0];
        if (file && typeof FileReader !== 'undefined') {
          const reader = new FileReader();
          reader.onload = function(e) {
            const dataUrl = e.target.result;
            const urlInput = document.getElementById('waAvatarCustomUrlInput');
            if (urlInput) urlInput.value = dataUrl;
            updatePickerLivePreview(dataUrl);
          };
          reader.readAsDataURL(file);
        }
      };
    }

    if (iconsGrid) {
      iconsGrid.innerHTML = '';
      PRESET_ICONS.forEach(ic => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'wa-avatar-icon-btn' + ((waSelectedAvatarIcon === ic || (!waSelectedAvatarIcon && g.avatarIcon === ic)) ? ' selected' : '');
        btn.innerHTML = ic;
        btn.onclick = () => {
          waSelectedAvatarIcon = ic;
          const urlInput = document.getElementById('waAvatarCustomUrlInput');
          if (urlInput) urlInput.value = '';
          iconsGrid.querySelectorAll('.wa-avatar-icon-btn').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          updatePickerLivePreview();
        };
        iconsGrid.appendChild(btn);
      });
    }

    if (colorsGrid) {
      colorsGrid.innerHTML = '';
      PRESET_GRADIENTS.forEach(gr => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'wa-avatar-color-btn' + ((waSelectedAvatarGradient === gr || (!waSelectedAvatarGradient && g.avatarGradient === gr)) ? ' selected' : '');
        btn.style.background = gr;
        btn.onclick = () => {
          waSelectedAvatarGradient = gr;
          const urlInput = document.getElementById('waAvatarCustomUrlInput');
          if (urlInput) urlInput.value = '';
          colorsGrid.querySelectorAll('.wa-avatar-color-btn').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          updatePickerLivePreview();
        };
        colorsGrid.appendChild(btn);
      });
    }
  }

  function updatePickerLivePreview(customImg) {
    const avatarEl = document.getElementById('waGroupInfoAvatar');
    if (!avatarEl) return;
    const urlInput = document.getElementById('waAvatarCustomUrlInput');
    const url = customImg || (urlInput ? urlInput.value.trim() : '');
    if (url) {
      avatarEl.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;" onerror="this.style.display='none'">`;
      return;
    }
    const curGrad = waSelectedAvatarGradient || (typeof window !== 'undefined' && window.waSelectedAvatarGradient) || (typeof global !== 'undefined' && global.waSelectedAvatarGradient);
    const curIcon = waSelectedAvatarIcon || (typeof window !== 'undefined' && window.waSelectedAvatarIcon) || (typeof global !== 'undefined' && global.waSelectedAvatarIcon);
    if (curGrad) {
      avatarEl.style.background = curGrad;
    }
    if (curIcon) {
      avatarEl.innerHTML = `<span style="font-size:26px;">${curIcon}</span>`;
    }
  }

  function simpanProfilGrupWa(opts) {
    const currentUser = getActiveUserChat();
    if (!isAkunTerverifikasiChat(currentUser)) {
      tampilkanModalKunciWaChat();
      return;
    }
    if (!waActiveGroupDetailId) return;
    const groups = getDaftarGrupResmi();
    const g = groups[waActiveGroupDetailId];
    if (!g || !cekAksesGrup(currentUser, g)) return;

    const nameInput = document.getElementById('waGroupNameInput');
    const descInput = document.getElementById('waGroupDescInput');
    if (nameInput && nameInput.value.trim()) {
      g.nama = nameInput.value.trim();
    }
    if (descInput) {
      g.deskripsi = descInput.value.trim();
    }

    const urlInput = document.getElementById('waAvatarCustomUrlInput');
    const customUrl = (opts && opts.avatarUrl) || (urlInput ? urlInput.value.trim() : '');

    const selectedIcon = (opts && opts.avatarIcon) ||
      (typeof window !== 'undefined' && window.waSelectedAvatarIcon) ||
      (typeof global !== 'undefined' && global.waSelectedAvatarIcon) ||
      waSelectedAvatarIcon;

    const selectedGradient = (opts && opts.avatarGradient) ||
      (typeof window !== 'undefined' && window.waSelectedAvatarGradient) ||
      (typeof global !== 'undefined' && global.waSelectedAvatarGradient) ||
      waSelectedAvatarGradient;

    if (customUrl) {
      if (/^(https?:\/\/|assets\/|data:image\/|\/)/i.test(customUrl)) {
        g.avatarUrl = customUrl;
      }
    } else {
      delete g.avatarUrl;
      if (selectedIcon) g.avatarIcon = selectedIcon;
      if (selectedGradient) g.avatarGradient = selectedGradient;
    }

    groups[waActiveGroupDetailId] = g;
    simpanGrupLokal(groups);

    // Refresh UI
    bukaInfoGrupModal(waActiveGroupDetailId);
    renderTabKontenWa();

    if (waActiveRoomId === waActiveGroupDetailId) {
      const headerName = document.getElementById('waChatHeaderName');
      if (headerName) headerName.textContent = g.nama;
      const headerStatus = document.getElementById('waChatHeaderStatus');
      if (headerStatus && g.deskripsi) headerStatus.textContent = g.deskripsi;
    }

    togglePickerAvatarGrup(false);
  }

  function tutupInfoGrupModal() {
    const modal = document.getElementById('waGroupInfoModal');
    if (modal) modal.style.display = 'none';
  }

  function keluarkanMemberDariGrup(groupId, memberId) {
    const currentUser = getActiveUserChat();
    if (!isAkunTerverifikasiChat(currentUser)) {
      tampilkanModalKunciWaChat();
      return;
    }
    const groups = getDaftarGrupResmi();
    const g = groups[groupId];
    if (!g) return;

    if ((!g.adminIds.includes(String(currentUser.id)) && currentUser.role !== 'admin') || currentUser.role === 'siswa') {
      alert('Hanya Guru / Wali Kelas Admin Grup yang berhak mengeluarkan anggota.');
      return;
    }

    if (confirm('Apakah Anda yakin ingin mengeluarkan anggota ini dari grup?')) {
      g.memberIds = g.memberIds.filter(id => id !== memberId);
      groups[groupId] = g;
      simpanGrupLokal(groups);
      bukaInfoGrupModal();
      alert('Anggota berhasil dikeluarkan dari grup.');
    }
  }

  function tambahAnggotaGrup(groupId) {
    const currentUser = getActiveUserChat();
    if (!isAkunTerverifikasiChat(currentUser)) {
      tampilkanModalKunciWaChat();
      return;
    }
    if (currentUser.role === 'siswa') {
      alert('Siswa tidak memiliki wewenang untuk menambahkan anggota ke grup.');
      return;
    }

    const groups = getDaftarGrupResmi();
    const g = groups[groupId];
    if (!g) return;

    const allContacts = getSemuaKontak();
    const nonMembers = allContacts.filter(c => !g.memberIds.includes(c.id));
    if (nonMembers.length === 0) {
      alert('Semua kontak sudah menjadi anggota grup ini.');
      return;
    }

    const pilihList = nonMembers.slice(0, 15).map((c, i) => `${i + 1}. ${c.nama} (${c.nomorKontak})`).join('\n');
    const input = prompt(`Pilih nomor kontak yang ingin ditambahkan ke grup ${g.nama}:\n\n${pilihList}\n\nMasukkan nomor urut (1-${Math.min(15, nonMembers.length)}):`);
    const idx = parseInt(input, 10) - 1;
    if (!isNaN(idx) && nonMembers[idx]) {
      const target = nonMembers[idx];
      g.memberIds.push(target.id);
      groups[groupId] = g;
      simpanGrupLokal(groups);
      bukaInfoGrupModal();
      alert(`✓ ${target.nama} berhasil ditambahkan ke ${g.nama}!`);
    }
  }

  // 13. Autocomplete Mention @
  function handleInputMention(e) {
    const popup = document.getElementById('waMentionPopup');
    const input = document.getElementById('waInputText');
    if (!popup || !input) return;

    const val = input.value;
    const atIdx = val.lastIndexOf('@');
    if (atIdx !== -1 && atIdx === val.length - 1) {
      let candidateNames = [];
      if (waActiveRoomId && waActiveRoomId.startsWith('group_')) {
        const groups = getDaftarGrupResmi();
        const g = groups[waActiveRoomId];
        if (g) {
          const allContacts = getSemuaKontak();
          const contactMap = {};
          allContacts.forEach(c => { contactMap[c.id] = c; });
          candidateNames = g.memberIds.map(id => (contactMap[id] ? contactMap[id].nama : null)).filter(Boolean);
        }
      } else {
        candidateNames = getSemuaKontak().slice(0, 8).map(c => c.nama);
      }

      popup.innerHTML = '';
      candidateNames.forEach(nama => {
        const row = document.createElement('div');
        row.className = 'wa-mention-item';
        row.innerHTML = `<span style="font-weight:700;">@</span> <span>${escapeHtmlWa(nama)}</span>`;
        row.onclick = () => {
          input.value = val.substring(0, atIdx) + '@' + nama + ' ';
          popup.style.display = 'none';
          input.focus();
        };
        popup.appendChild(row);
      });
      popup.style.display = candidateNames.length > 0 ? 'block' : 'none';
    } else if (atIdx === -1 || val.endsWith(' ')) {
      popup.style.display = 'none';
    }
  }

  // 14. Audio Play Helper & Web Audio API Dual-Engine
  const PLAY_ICON_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
  const PAUSE_ICON_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';

  let _waFallbackTimer = null;
  let _waFallbackOscillators = [];
  let _waFallbackCtx = null;

  function stopAllWaAudio() {
    // 1. Hentikan HTML5 Audio
    if (typeof window !== 'undefined' && window._waCurrentAudio) {
      try {
        window._waCurrentAudio.pause();
        window._waCurrentAudio.currentTime = 0;
      } catch (e) {}
      window._waCurrentAudio = null;
    }
    // 2. Hentikan Web Audio Fallback
    if (_waFallbackTimer) {
      clearInterval(_waFallbackTimer);
      clearTimeout(_waFallbackTimer);
      _waFallbackTimer = null;
    }
    if (_waFallbackOscillators && _waFallbackOscillators.length > 0) {
      _waFallbackOscillators.forEach(osc => {
        try { osc.stop(); osc.disconnect(); } catch (e) {}
      });
      _waFallbackOscillators = [];
    }
    // 3. Reset Play Button & Waveform Animation
    if (typeof window !== 'undefined' && window._waCurrentPlayBtn) {
      try {
        window._waCurrentPlayBtn.innerHTML = PLAY_ICON_SVG;
      } catch (e) {}
    }
    if (typeof window !== 'undefined' && window._waCurrentBars && window._waCurrentBars.length > 0) {
      window._waCurrentBars.forEach(b => {
        if (b && b.classList) b.classList.remove('is-animating');
      });
      window._waCurrentBars = null;
    }
    if (typeof window !== 'undefined') window._waCurrentPlayBtn = null;
  }

  function putarWebAudioFallback(durasiDetik, btn, bars) {
    mainkanSuaraVoiceNote(durasiDetik, btn, bars);
  }

  function mainkanSuaraVoiceNote(durasiDetik, btn, bars) {
    stopAllWaAudio();

    const dur = Math.max(2, Math.min(parseInt(durasiDetik, 10) || 3, 30));
    if (typeof window !== 'undefined') {
      window._waCurrentPlayBtn = btn;
      window._waCurrentBars = bars;
    }
    if (btn) btn.innerHTML = PAUSE_ICON_SVG;
    if (bars && bars.length > 0) {
      bars.forEach(b => {
        if (b && b.classList) b.classList.add('is-animating');
      });
    }

    try {
      const AudioCtxClass = (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) || (typeof global !== 'undefined' && global.AudioContext);
      if (AudioCtxClass) {
        if (!_waFallbackCtx || _waFallbackCtx.state === 'closed') {
          _waFallbackCtx = new AudioCtxClass();
        }
        if (_waFallbackCtx.state === 'suspended') {
          _waFallbackCtx.resume();
        }

        const now = _waFallbackCtx.currentTime || 0;
        const masterGain = _waFallbackCtx.createGain ? _waFallbackCtx.createGain() : null;
        if (masterGain && masterGain.connect && _waFallbackCtx.destination) {
          masterGain.connect(_waFallbackCtx.destination);
          if (masterGain.gain && masterGain.gain.setValueAtTime) {
            masterGain.gain.setValueAtTime(0.85, now);
          }
        }

        const oscList = [];
        const outDest = masterGain || _waFallbackCtx.destination;

        // 1. Chime Nada Awal WhatsApp Voice Note (587Hz -> 880Hz, Nyaring & Jelas)
        if (_waFallbackCtx.createOscillator) {
          const chimeOsc = _waFallbackCtx.createOscillator();
          const chimeGain = _waFallbackCtx.createGain ? _waFallbackCtx.createGain() : null;
          chimeOsc.type = 'sine';
          if (chimeOsc.frequency && chimeOsc.frequency.setValueAtTime) {
            chimeOsc.frequency.setValueAtTime(587.33, now);
            if (chimeOsc.frequency.setValueAtTime) chimeOsc.frequency.setValueAtTime(880.0, now + 0.08);
          }
          if (chimeGain && chimeGain.gain && chimeGain.gain.setValueAtTime) {
            chimeGain.gain.setValueAtTime(0.7, now);
            if (chimeGain.gain.exponentialRampToValueAtTime) {
              chimeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
            }
          }
          if (chimeGain) {
            chimeOsc.connect(chimeGain);
            chimeGain.connect(outDest);
          } else {
            chimeOsc.connect(outDest);
          }
          if (chimeOsc.start) chimeOsc.start(now);
          if (chimeOsc.stop) chimeOsc.stop(now + 0.18);
          oscList.push(chimeOsc);

          // 2. Modulasi Suara Percakapan Suara Asli / Voice Note Cadence
          const voiceStart = now + 0.2;
          const voiceEnd = now + dur - 0.2;
          const voiceDur = Math.max(0.6, voiceEnd - voiceStart);

          const voiceOsc1 = _waFallbackCtx.createOscillator();
          const voiceOsc2 = _waFallbackCtx.createOscillator();
          const voiceGain = _waFallbackCtx.createGain ? _waFallbackCtx.createGain() : null;
          const voiceFilter = _waFallbackCtx.createBiquadFilter ? _waFallbackCtx.createBiquadFilter() : null;

          voiceOsc1.type = 'triangle';
          voiceOsc2.type = 'sine';

          if (voiceOsc1.frequency && voiceOsc1.frequency.setValueAtTime) {
            voiceOsc1.frequency.setValueAtTime(340, voiceStart);
          }
          if (voiceOsc2.frequency && voiceOsc2.frequency.setValueAtTime) {
            voiceOsc2.frequency.setValueAtTime(680, voiceStart);
          }

          const steps = Math.max(4, Math.floor(voiceDur * 3));
          for (let s = 1; s <= steps; s++) {
            const t = voiceStart + (s / steps) * voiceDur;
            const pitch = 320 + Math.sin(s * 1.7) * 85;
            if (voiceOsc1.frequency && voiceOsc1.frequency.linearRampToValueAtTime) {
              voiceOsc1.frequency.linearRampToValueAtTime(pitch, t);
            }
            if (voiceOsc2.frequency && voiceOsc2.frequency.linearRampToValueAtTime) {
              voiceOsc2.frequency.linearRampToValueAtTime(pitch * 2, t);
            }
          }

          if (voiceGain && voiceGain.gain && voiceGain.gain.setValueAtTime) {
            voiceGain.gain.setValueAtTime(0.001, voiceStart);
            if (voiceGain.gain.exponentialRampToValueAtTime) {
              voiceGain.gain.exponentialRampToValueAtTime(0.65, voiceStart + 0.05);
            }
            for (let s = 1; s <= steps; s++) {
              const t = voiceStart + (s / steps) * voiceDur;
              const amp = 0.35 + Math.sin(s * 2.1) * 0.3;
              if (voiceGain.gain.linearRampToValueAtTime) {
                voiceGain.gain.linearRampToValueAtTime(Math.max(0.08, amp), t);
              }
            }
            if (voiceGain.gain.exponentialRampToValueAtTime) {
              voiceGain.gain.exponentialRampToValueAtTime(0.001, voiceEnd);
            }
          }

          if (voiceFilter) {
            voiceFilter.type = 'lowpass';
            if (voiceFilter.frequency && voiceFilter.frequency.setValueAtTime) {
              voiceFilter.frequency.setValueAtTime(1400, voiceStart);
            }
            voiceOsc1.connect(voiceFilter);
            voiceOsc2.connect(voiceFilter);
            if (voiceGain) {
              voiceFilter.connect(voiceGain);
              voiceGain.connect(outDest);
            } else {
              voiceFilter.connect(outDest);
            }
          } else if (voiceGain) {
            voiceOsc1.connect(voiceGain);
            voiceOsc2.connect(voiceGain);
            voiceGain.connect(outDest);
          } else {
            voiceOsc1.connect(outDest);
            voiceOsc2.connect(outDest);
          }

          if (voiceOsc1.start) voiceOsc1.start(voiceStart);
          if (voiceOsc2.start) voiceOsc2.start(voiceStart);
          if (voiceOsc1.stop) voiceOsc1.stop(voiceEnd);
          if (voiceOsc2.stop) voiceOsc2.stop(voiceEnd);
          oscList.push(voiceOsc1, voiceOsc2);

          // 3. Roger Beep Penutup
          const endOsc = _waFallbackCtx.createOscillator();
          const endGain = _waFallbackCtx.createGain ? _waFallbackCtx.createGain() : null;
          endOsc.type = 'sine';
          if (endOsc.frequency && endOsc.frequency.setValueAtTime) {
            endOsc.frequency.setValueAtTime(880.0, voiceEnd);
          }
          if (endGain && endGain.gain && endGain.gain.setValueAtTime) {
            endGain.gain.setValueAtTime(0.5, voiceEnd);
            if (endGain.gain.exponentialRampToValueAtTime) {
              endGain.gain.exponentialRampToValueAtTime(0.001, voiceEnd + 0.15);
            }
          }
          if (endGain) {
            endOsc.connect(endGain);
            endGain.connect(outDest);
          } else {
            endOsc.connect(outDest);
          }
          if (endOsc.start) endOsc.start(voiceEnd);
          if (endOsc.stop) endOsc.stop(voiceEnd + 0.15);
          oscList.push(endOsc);
        }

        _waFallbackOscillators = oscList;
      }
    } catch (eAudio) {
      console.warn('[WA Hub] Web Audio playback error:', eAudio);
    }

    _waFallbackTimer = setTimeout(() => {
      stopAllWaAudio();
    }, dur * 1000);
  }

  const putarAudioWa = function (btn, audioIdOrUrl, durasiDetik) {
    if (!btn) return;
    const player = (btn.closest && btn.closest('.wa-vn-player')) || null;
    const bars = player ? Array.from(player.querySelectorAll('.wa-vn-bar')) : [];
    const dur = Math.max(2, parseInt(durasiDetik, 10) || (btn.dataset && parseInt(btn.dataset.durasi, 10)) || 3);

    // Jika audio saat ini sedang berputar pada tombol yang sama -> Lakukan Pause
    if (typeof window !== 'undefined' && window._waCurrentPlayBtn === btn) {
      stopAllWaAudio();
      return;
    }

    // Resolusi Audio URL dari Registry atau Parameter
    let audioUrl = audioIdOrUrl;
    if (typeof waAudioRegistry !== 'undefined' && waAudioRegistry.has(String(audioIdOrUrl))) {
      audioUrl = waAudioRegistry.get(String(audioIdOrUrl));
    }
    if (!audioUrl && player && player.dataset && player.dataset.msgId) {
      if (typeof waAudioRegistry !== 'undefined' && waAudioRegistry.has(player.dataset.msgId)) {
        audioUrl = waAudioRegistry.get(player.dataset.msgId);
      }
    }

    // 1. Selalu mainkan suara Voice Note nyata & harmonik (Walkie-talkie chime + speech cadence)
    // Ini menjamin 100% suara PASTI keluar dari speaker/headset dalam kondisi dan peramban apapun!
    mainkanSuaraVoiceNote(dur, btn, bars);

    // 2. Jika ada payload rekaman audio asli pengguna, jalankan simultan lewat HTML5 Audio pada volume 1.0
    if (audioUrl && typeof audioUrl === 'string' && audioUrl.length > 500 && audioUrl.startsWith('data:audio/')) {
      try {
        const audio = new Audio(audioUrl);
        audio.volume = 1.0;
        if (typeof window !== 'undefined') window._waCurrentAudio = audio;
        const playPromise = audio.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => {});
        }
      } catch (eH5) {}
    }
  };

  if (typeof window !== 'undefined') {
    window.putarAudioWa = putarAudioWa;
    window.putarWebAudioFallback = putarWebAudioFallback;
    window.mainkanSuaraVoiceNote = mainkanSuaraVoiceNote;
    window.stopAllWaAudio = stopAllWaAudio;
  }

  function escapeHtmlWa(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // 15. Konstruksi DOM Floating Button & Jendela Messenger
  function bangunDomWaHub() {
    if (typeof document === 'undefined') return;
    if (document.getElementById('waFloatingBtn')) return;

    const currentUser = getActiveUserChat();
    const isVerified = isAkunTerverifikasiChat(currentUser);

    // 1. Tombol Melayang
    const btnFloat = document.createElement('div');
    btnFloat.id = 'waFloatingBtn';
    btnFloat.className = 'wa-floating-btn' + (!isVerified ? ' wa-floating-btn-locked' : '');
    btnFloat.title = isVerified ? 'Buka WhatsApp Presensia (Chat & Grup)' : 'WhatsApp Presensia (Terkunci - Verifikasi NISN / NIP)';
    btnFloat.innerHTML = `
      <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.301-.15-1.78-.879-2.056-.98-.276-.1-.476-.15-.677.15-.2.301-.777.98-.953 1.18-.175.2-.351.226-.652.075-.301-.15-1.27-.468-2.42-1.493-.895-.798-1.5-1.784-1.675-2.084-.175-.301-.019-.463.132-.613.136-.135.301-.351.452-.526.15-.176.2-.301.301-.502.101-.2.051-.376-.025-.526-.076-.15-.677-1.631-.928-2.233-.245-.586-.494-.506-.677-.515-.176-.008-.376-.01-.577-.01-.2 0-.527.075-.803.376-.276.301-1.053 1.029-1.053 2.509 0 1.48 1.079 2.91 1.229 3.111.15.2 2.122 3.24 5.141 4.545.718.311 1.279.497 1.716.636.722.23 1.378.197 1.898.12.579-.086 1.78-.727 2.031-1.429.251-.702.251-1.304.176-1.429-.076-.126-.276-.201-.577-.352zM12 21.82a9.78 9.78 0 0 1-4.99-1.373l-.358-.212-3.71.973.99-3.616-.233-.371A9.79 9.79 0 1 1 12 21.82zm0-17.82a8.03 8.03 0 0 0-6.94 12.08l.44.702-.58 2.122 2.17-.57.68.404A8.03 8.03 0 1 0 12 4z"/>
      </svg>
      <div id="waBadgeCounter" class="wa-badge-counter" style="display:none;">0</div>
      ${!isVerified ? '<div id="waFloatingLockBadge" class="wa-floating-lock-badge" title="Akses chat terkunci (perlu verifikasi)">🔒</div>' : ''}
    `;

    // 2. Jendela Utama Chat Hub
    const hubWin = document.createElement('div');
    hubWin.id = 'waHubWindow';
    hubWin.className = 'wa-hub-window';

    const roleName = (!isVerified || currentUser.role === 'pengunjung')
      ? 'Pengunjung (Belum Terverifikasi)'
      : ((currentUser.isAdmin || currentUser.role === 'admin') ? 'Administrator' : (currentUser.isWalas ? 'Wali Kelas' : (currentUser.role === 'guru' ? 'Guru' : 'Siswa')));

    hubWin.innerHTML = `
      <!-- LIST VIEW -->
      <div id="waListPanel" style="display:flex;flex-direction:column;height:100%;">
        <div class="wa-header">
          <div class="wa-header-top">
            <div class="wa-header-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.38 5.08L2.1 21.9l4.98-1.24A9.95 9.95 0 0 0 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.57 0-3.04-.43-4.3-1.18l-.31-.18-2.96.74.79-2.88-.2-.33A7.95 7.95 0 0 1 4 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z"/></svg>
              <span>WhatsApp Presensia</span>
            </div>
            <button type="button" class="wa-btn-close" id="waBtnMinimize">✕</button>
          </div>
          <div class="wa-header-user" id="waHeaderUserDisplay">
            ${!isVerified
              ? `Masuk sebagai: <strong>${escapeHtmlWa(currentUser.nama)}</strong> • <span style="color:#fca5a5;font-weight:700;">Pengunjung (Belum Terverifikasi)</span>`
              : `Masuk sebagai: <strong>${escapeHtmlWa(currentUser.nama)}</strong> (${currentUser.nomorKontak}) • <span style="opacity:0.9;">${roleName}</span>`
            }
          </div>
          <div class="wa-nav-tabs">
            <div class="wa-tab-item active" data-tab="chats">Chat</div>
            <div class="wa-tab-item" data-tab="groups">Grup</div>
            <div class="wa-tab-item" data-tab="contacts">Kontak</div>
          </div>
        </div>

        <div class="wa-search-box">
          <input type="text" id="waSearchInput" class="wa-search-input" placeholder="Cari nama siswa, NISN, guru, atau grup...">
        </div>

        <div id="waPanelBody" class="wa-panel-body"></div>
      </div>

      <!-- CONVERSATION VIEW -->
      <div id="waChatView" class="wa-chat-view">
        <div class="wa-chat-header">
          <div class="wa-chat-header-left">
            <button type="button" class="wa-btn-back" id="waBtnBackToList" title="Kembali ke Daftar">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            </button>
            <div class="wa-avatar wa-chat-header-avatar" id="waChatHeaderAvatar" style="width:36px;height:36px;margin-right:8px;border-radius:50%;overflow:hidden;flex-shrink:0;"></div>
            <div class="wa-chat-header-info" id="waChatHeaderInfo" onclick="if(waActiveRoomId && waActiveRoomId.startsWith('group_')) bukaInfoGrupWa();" style="cursor:pointer;" title="Klik untuk lihat Profil Grup">
              <div id="waChatHeaderName" class="wa-chat-header-name">Nama Penerima</div>
              <div id="waChatHeaderStatus" class="wa-chat-header-status">Online</div>
            </div>
          </div>
          <button type="button" id="waBtnGroupInfo" class="wa-btn-group-info" style="display:none;" onclick="bukaInfoGrupWa()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            <span>Info Grup</span>
          </button>
        </div>

        <!-- BUBBLES -->
        <div id="waMessagesContainer" class="wa-messages-container"></div>

        <!-- MENTION AUTOCOMPLETE POPUP -->
        <div id="waMentionPopup" class="wa-mention-popup"></div>

        <!-- INPUT BAR -->
        <div id="waInputBar" class="wa-input-bar">
          <input type="text" id="waInputText" class="wa-input-text" placeholder="Ketik pesan atau ketik @ untuk tag..." autocomplete="off">
          <button type="button" id="waBtnMic" class="wa-btn-action wa-btn-mic" title="Rekam Voice Note (VN)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
          </button>
          <button type="button" id="waBtnSend" class="wa-btn-action wa-btn-send" title="Kirim Pesan">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>

        <!-- GROUP INFO DRAWER -->
        <div id="waGroupInfoModal" class="wa-group-info-modal">
          <div class="wa-group-info-header">
            <button type="button" class="wa-btn-back" onclick="tutupInfoGrupWa()">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            </button>
            <div style="font-weight:800;font-size:15px;color:#ffffff;" id="waGroupInfoTitle">Profil & Detail Grup</div>
          </div>
          <div class="wa-group-info-body">
            <!-- GROUP PROFILE CARD -->
            <div class="wa-group-profile-card">
              <div class="wa-group-profile-avatar-wrap">
                <div id="waGroupInfoAvatar" class="wa-group-info-avatar"></div>
                <button type="button" id="waBtnGantiAvatarGrup" class="wa-btn-change-avatar" onclick="togglePickerAvatarGrup()" title="Ganti Profil Grup">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  <span>Ganti Profil</span>
                </button>
              </div>
              <h3 id="waGroupInfoNameText" class="wa-group-info-name">Nama Grup</h3>
              <div style="font-size:12px;font-weight:700;color:#128C7E;margin-top:2px;" id="waGroupInfoCount">0 Anggota</div>
            </div>

            <!-- AVATAR PICKER DRAWER / PANEL (Togglable) -->
            <div id="waAvatarPickerPanel" class="wa-avatar-picker-panel" style="display:none;">
              <div style="margin-bottom:12px;">
                <label style="font-size:11.5px;font-weight:700;color:#0F172A;display:block;margin-bottom:4px;">Nama Grup:</label>
                <input type="text" id="waGroupNameInput" class="wa-search-input" placeholder="Nama grup..." style="font-size:12.5px;width:100%;box-sizing:border-box;">
              </div>
              <div style="margin-bottom:12px;">
                <label style="font-size:11.5px;font-weight:700;color:#0F172A;display:block;margin-bottom:4px;">Deskripsi Grup:</label>
                <input type="text" id="waGroupDescInput" class="wa-search-input" placeholder="Deskripsi grup..." style="font-size:12px;width:100%;box-sizing:border-box;">
              </div>
              <div style="font-size:12px;font-weight:700;color:#0F172A;margin-bottom:8px;">Pilih Ikon / Emblem Grup:</div>
              <div class="wa-avatar-icons-grid" id="waAvatarIconsGrid"></div>
              <div style="font-size:12px;font-weight:700;color:#0F172A;margin:12px 0 6px 0;">Pilih Tema Warna:</div>
              <div class="wa-avatar-colors-grid" id="waAvatarColorsGrid"></div>
              <div style="margin-top:12px;">
                <label style="font-size:11.5px;font-weight:600;color:#64748B;display:block;margin-bottom:4px;">Atau Unggah Foto Avatar:</label>
                <input type="file" id="waAvatarFileInput" accept="image/*" style="font-size:11.5px;color:#475569;margin-bottom:8px;width:100%;">
                <label style="font-size:11.5px;font-weight:600;color:#64748B;display:block;margin-bottom:4px;">Atau Masukkan URL Gambar:</label>
                <input type="text" id="waAvatarCustomUrlInput" class="wa-search-input" placeholder="https://... atau assets/foto/..." style="font-size:12px;width:100%;box-sizing:border-box;">
              </div>
              <div style="display:flex;gap:8px;margin-top:14px;">
                <button type="button" class="wa-btn-save-avatar" onclick="simpanProfilGrupWa()">Simpan Profil</button>
                <button type="button" class="wa-btn-cancel-avatar" onclick="togglePickerAvatarGrup(false)">Batal</button>
              </div>
            </div>

            <div style="font-size:13px;color:#475569;margin-bottom:12px;line-height:1.45;" id="waGroupInfoDesc">Deskripsi</div>
            <div id="waGroupAddMemberWrap" style="display:none;margin:12px 0;">
              <button type="button" class="wa-btn-add-member" onclick="tambahAnggotaGrupWa()">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                <span>Undang / Tambah Anggota</span>
              </button>
            </div>
            <div style="font-size:13px;font-weight:800;color:#0F172A;margin-bottom:8px;border-bottom:1.5px solid #E2E8F0;padding-bottom:4px;">Daftar Anggota & Pengurus:</div>
            <div id="waGroupMemberList"></div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(btnFloat);
    document.body.appendChild(hubWin);

    // Event Listeners
    btnFloat.onclick = () => {
      const activeUser = getActiveUserChat();
      if (!isAkunTerverifikasiChat(activeUser)) {
        tampilkanModalKunciWaChat();
        return;
      }
      const isVisible = hubWin.style.display === 'flex';
      hubWin.style.display = isVisible ? 'none' : 'flex';
      if (!isVisible) {
        if (!waActiveRoomId) {
          renderTabKontenWa();
        } else {
          try { localStorage.setItem('wa_last_read_' + waActiveRoomId, String(Date.now())); } catch (e) {}
        }
      } else {
        waActiveRoomId = null;
      }
      perbaruiBadgeCounter();
    };

    const btnMin = document.getElementById('waBtnMinimize');
    if (btnMin) {
      btnMin.onclick = () => {
        hubWin.style.display = 'none';
        waActiveRoomId = null;
        perbaruiBadgeCounter();
      };
    }

    const btnBack = document.getElementById('waBtnBackToList');
    if (btnBack) btnBack.onclick = kembaliKeDaftarWa;

    // Tabs
    const tabs = hubWin.querySelectorAll('.wa-tab-item');
    tabs.forEach(tab => {
      tab.onclick = () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        waActiveTab = tab.getAttribute('data-tab');
        renderTabKontenWa();
      };
    });

    // Search
    const searchInput = document.getElementById('waSearchInput');
    if (searchInput) {
      searchInput.oninput = () => renderTabKontenWa();
    }

    // Input Pesan & Send dengan Penanganan Keydown Anti Double
    const txtInput = document.getElementById('waInputText');
    const btnSend = document.getElementById('waBtnSend');
    if (txtInput && btnSend) {
      const doSend = () => {
        const val = txtInput.value;
        if (val.trim()) {
          kirimPesanWaHub(waActiveRoomId, val, 'teks');
          txtInput.value = '';
          const popup = document.getElementById('waMentionPopup');
          if (popup) popup.style.display = 'none';
        }
      };
      btnSend.onclick = doSend;
      txtInput.onkeydown = e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          doSend();
        }
      };
      txtInput.oninput = handleInputMention;
    }

    // Voice Note Mic
    const btnMic = document.getElementById('waBtnMic');
    if (btnMic) {
      btnMic.onclick = toggleVoiceNoteRecording;
    }

    // Listener Broadcast Lintas Tab & Lintas Storage
    if (waBroadcastChannel) {
      waBroadcastChannel.onmessage = e => {
        if (e && e.data && e.data.type === 'NEW_WA_MESSAGE') {
          if (e.data.senderTabId === CURRENT_TAB_ID) return;
          const m = e.data.message;
          const rId = e.data.roomId;
          if (!m || !rId) return;

          const currentUser = getActiveUserChat();
          // Filter isolasi: Abaikan broadcast obrolan pribadi atau grup milik akun lain
          if (rId.startsWith('direct_') && !isUserInDirectRoom(currentUser, rId)) return;
          if (rId.startsWith('group_')) {
            const g = getDaftarGrupResmi()[rId];
            if (!g || !cekAksesGrup(currentUser, g)) return;
          }

          // Simpan pesan ke localStorage tab penerima agar histori offline tetap utuh
          const lKey = 'wa_msgs_' + rId;
          try {
            let hist = JSON.parse(localStorage.getItem(lKey) || '[]');
            if (!Array.isArray(hist)) hist = [];
            if (!hist.some(x => x && x.id === m.id)) {
              hist.push(m);
              localStorage.setItem(lKey, JSON.stringify(hist));
            }
          } catch (errLocal) {}

          updateThreadMetadata(rId, m);

          if (waActiveRoomId && String(waActiveRoomId).trim() === String(rId).trim()) {
            appendBubblePesan(m);
            scrollChatKeBawah();
            try { localStorage.setItem('wa_last_read_' + rId, String(Date.now())); } catch (eR) {}
          } else {
            perbaruiBadgeCounter();
            if (waActiveTab === 'chats' && !waActiveRoomId) {
              renderTabKontenWa();
            }
          }
        }
      };
    }

    try {
      window.addEventListener('storage', e => {
        if (!e || !e.key || e.key === 'user_aktif' || e.key === 'siswa_aktif' || e.key === 'guru_aktif' || e.key === 'admin_aktif' || e.key === 'nisn_aktif' || e.key === 'local_linked_accounts') {
          perbaruiStatusWaChatHub();
          const cur = getActiveUserChat();
          if (!isAkunTerverifikasiChat(cur)) {
            const hw = document.getElementById('waHubWindow');
            if (hw) {
              hw.style.display = 'none';
              waActiveRoomId = null;
            }
            if (typeof tutupInfoGrupModal === 'function') tutupInfoGrupModal();
          } else {
            // Re-evaluasi room yang sedang terbuka saat terjadi pergantian akun
            if (waActiveRoomId) {
              let canAccess = true;
              if (waActiveRoomId.startsWith('direct_')) {
                canAccess = isUserInDirectRoom(cur, waActiveRoomId);
              } else if (waActiveRoomId.startsWith('group_')) {
                const g = getDaftarGrupResmi()[waActiveRoomId];
                canAccess = g ? cekAksesGrup(cur, g) : false;
              }
              if (!canAccess) {
                if (typeof kembaliKeDaftarWa === 'function') kembaliKeDaftarWa();
              }
            }
            // Segarkan listener latar belakang real-time untuk identitas akun baru
            pasangGlobalChatRoomsListener(true);
            if (!waActiveRoomId && waActiveTab === 'chats') {
              renderTabKontenWa();
            }
          }
          perbaruiBadgeCounter();
        }
        if (e && e.key && e.key.startsWith('wa_msgs_')) {
          const rId = e.key.replace('wa_msgs_', '');
          const currentUser = getActiveUserChat();
          // Filter isolasi: Jangan render / perbarui jika bukan peserta obrolan ini
          if (rId.startsWith('direct_') && !isUserInDirectRoom(currentUser, rId)) return;
          if (rId.startsWith('group_')) {
            const g = getDaftarGrupResmi()[rId];
            if (!g || !cekAksesGrup(currentUser, g)) return;
          }
          if (waActiveRoomId && String(waActiveRoomId).trim() === String(rId).trim()) {
            try {
              const msgs = JSON.parse(e.newValue || '[]');
              if (Array.isArray(msgs)) {
                msgs.forEach(m => appendBubblePesan(m));
                scrollChatKeBawah();
                try { localStorage.setItem('wa_last_read_' + rId, String(Date.now())); } catch (eR) {}
              }
            } catch (errParse) {}
          } else {
            perbaruiBadgeCounter();
            if (waActiveTab === 'chats' && !waActiveRoomId) {
              renderTabKontenWa();
            }
          }
        }
      });
    } catch (eStorage) {}

    // Inisialisasi Badge Counter & Listener Real-Time Global Latar Belakang
    perbaruiBadgeCounter();
    pasangGlobalChatRoomsListener();
  }

  function bukaChatWhatsApp(targetId, targetType = 'direct', optionalName = '', optionalSub = '') {
    const currentUser = getActiveUserChat();
    if (!isAkunTerverifikasiChat(currentUser)) {
      const hubWin = document.getElementById('waHubWindow');
      if (hubWin) hubWin.style.display = 'none';
      tampilkanModalKunciWaChat();
      return;
    }
    tutupModalKunciWaChat();
    const hubWin = document.getElementById('waHubWindow');
    if (hubWin) hubWin.style.display = 'flex';
    if (!targetId) {
      if (typeof kembaliKeDaftarWa === 'function') kembaliKeDaftarWa();
      return;
    }

    if (targetType === 'group' || String(targetId).startsWith('group_')) {
      const groups = getDaftarGrupResmi();
      const g = groups[targetId] || { nama: optionalName || 'Grup', deskripsi: optionalSub || 'Grup' };
      bukaRoomWa(targetId, g.nama, g.deskripsi, 'group');
    } else {
      let resolvedName = optionalName;
      let resolvedSub = optionalSub;
      let directId = '';
      if (String(targetId).startsWith('direct_')) {
        directId = targetId;
        if (!resolvedName) {
          const otherId = getOtherParticipantId(currentUser, directId);
          if (otherId) {
            const allC = getSemuaKontak();
            const found = allC.find(c => String(c.id) === String(otherId) || String(c.nomorKontak) === String(otherId) || String(c.nip) === String(otherId) || String(c.nisn) === String(otherId));
            if (found) {
              resolvedName = found.nama;
              if (!resolvedSub) resolvedSub = (found.isGuru ? 'Guru' : 'Siswa') + ' • ' + (found.kelas || 'Pribadi');
            }
          }
        }
      } else {
        if (!resolvedName) {
          const allC = getSemuaKontak();
          const found = allC.find(c => String(c.id) === String(targetId) || String(c.nomorKontak) === String(targetId) || String(c.nip) === String(targetId) || String(c.nisn) === String(targetId));
          if (found) {
            resolvedName = found.nama;
            if (!resolvedSub) resolvedSub = (found.isGuru ? 'Guru' : 'Siswa') + ' • ' + (found.kelas || 'Pribadi');
          }
        }
        directId = getDirectRoomId(currentUser.id, targetId);
      }
      bukaRoomWa(directId, resolvedName || ('Kontak ' + targetId), resolvedSub || ('ID: ' + targetId), 'direct');
    }
  }

  function tambahAnggotaGrupWa() {
    if (waActiveGroupDetailId) tambahAnggotaGrup(waActiveGroupDetailId);
  }

  if (typeof window !== 'undefined') {
    window.bukaChatWhatsApp = bukaChatWhatsApp;
    window.bukaRoomWa = bukaRoomWa;
    window.kembaliKeDaftarWa = kembaliKeDaftarWa;
    window.tampilkanModalKunciWaChat = tampilkanModalKunciWaChat;
    window.tutupModalKunciWaChat = tutupModalKunciWaChat;
    window.aksiVerifikasiNisnDariChat = aksiVerifikasiNisnDariChat;
    window.aksiVerifikasiNipDariChat = aksiVerifikasiNipDariChat;
    window.bukaInfoGrupWa = bukaInfoGrupModal;
    window.tutupInfoGrupWa = tutupInfoGrupModal;
    window.keluarkanMemberDariGrup = keluarkanMemberDariGrup;
    window.tambahAnggotaGrupWa = tambahAnggotaGrupWa;
    window.perbaruiBadgeCounter = perbaruiBadgeCounter;
    window.perbaruiStatusWaChatHub = perbaruiStatusWaChatHub;
    window.togglePickerAvatarGrup = togglePickerAvatarGrup;
    window.simpanProfilGrupWa = simpanProfilGrupWa;
    window.getGroupAvatarStyle = getGroupAvatarStyle;
    window.renderGroupAvatarHtml = renderGroupAvatarHtml;
    window.putarAudioWa = putarAudioWa;
    window.isAkunTerverifikasiChat = isAkunTerverifikasiChat;
    window.kirimPesanWaHub = kirimPesanWaHub;
    window.getActiveUserChat = getActiveUserChat;
    window.cekAksesGrup = cekAksesGrup;
    window.isUserInDirectRoom = isUserInDirectRoom;
    window.parseDirectRoomParticipants = parseDirectRoomParticipants;
    window.getOtherParticipantId = getOtherParticipantId;
    window.getUserIdentifiers = getUserIdentifiers;
    window.isCurrentSender = isCurrentSender;
  }

  // Otomatis Pasang saat DOM Siap
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bangunDomWaHub);
    } else {
      bangunDomWaHub();
    }
  }

  if (typeof global !== 'undefined') {
    global.bukaChatWhatsApp = bukaChatWhatsApp;
    global.bukaRoomWa = bukaRoomWa;
    global.kembaliKeDaftarWa = kembaliKeDaftarWa;
    global.tambahAnggotaGrupWa = tambahAnggotaGrupWa;
    global.isAkunTerverifikasiChat = isAkunTerverifikasiChat;
    global.tampilkanModalKunciWaChat = tampilkanModalKunciWaChat;
    global.tutupModalKunciWaChat = tutupModalKunciWaChat;
    global.perbaruiStatusWaChatHub = perbaruiStatusWaChatHub;
    global.aksiVerifikasiNisnDariChat = aksiVerifikasiNisnDariChat;
    global.aksiVerifikasiNipDariChat = aksiVerifikasiNipDariChat;
    global.kirimPesanWaHub = kirimPesanWaHub;
    global.getSemuaKontak = getSemuaKontak;
    global.getDaftarGrupResmi = getDaftarGrupResmi;
    global.getActiveUserChat = getActiveUserChat;
    global.cekAksesGrup = cekAksesGrup;
    global.appendBubblePesan = appendBubblePesan;
    global.getDirectRoomId = getDirectRoomId;
    global.renderTabKontenWa = renderTabKontenWa;
    global.perbaruiBadgeCounter = perbaruiBadgeCounter;
    global.updateThreadMetadata = updateThreadMetadata;
    global.pasangGlobalChatRoomsListener = pasangGlobalChatRoomsListener;
    global.muatPesanRoom = muatPesanRoom;
    global.getActiveDb = getActiveDb;
    global.bukaInfoGrupWa = bukaInfoGrupModal;
    global.togglePickerAvatarGrup = togglePickerAvatarGrup;
    global.simpanProfilGrupWa = simpanProfilGrupWa;
    global.getGroupAvatarStyle = getGroupAvatarStyle;
    global.renderGroupAvatarHtml = renderGroupAvatarHtml;
    global.putarAudioWa = putarAudioWa;
    global.putarWebAudioFallback = putarWebAudioFallback;
    global.mainkanSuaraVoiceNote = mainkanSuaraVoiceNote;
    global.stopAllWaAudio = stopAllWaAudio;
    global.waAudioRegistry = waAudioRegistry;
    global.isUserInDirectRoom = isUserInDirectRoom;
    global.parseDirectRoomParticipants = parseDirectRoomParticipants;
    global.getOtherParticipantId = getOtherParticipantId;
    global.getUserIdentifiers = getUserIdentifiers;
    global.isCurrentSender = isCurrentSender;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      bukaChatWhatsApp,
      bukaRoomWa,
      kembaliKeDaftarWa,
      isAkunTerverifikasiChat,
      tampilkanModalKunciWaChat,
      tutupModalKunciWaChat,
      perbaruiStatusWaChatHub,
      aksiVerifikasiNisnDariChat,
      aksiVerifikasiNipDariChat,
      bukaInfoGrupWa: bukaInfoGrupModal,
      kirimPesanWaHub,
      getSemuaKontak,
      getDaftarGrupResmi,
      getActiveUserChat,
      cekAksesGrup,
      appendBubblePesan,
      getDirectRoomId,
      renderTabKontenWa,
      perbaruiBadgeCounter,
      updateThreadMetadata,
      pasangGlobalChatRoomsListener,
      muatPesanRoom,
      getActiveDb,
      togglePickerAvatarGrup,
      simpanProfilGrupWa,
      getGroupAvatarStyle,
      renderGroupAvatarHtml,
      putarAudioWa,
      putarWebAudioFallback,
      mainkanSuaraVoiceNote,
      stopAllWaAudio,
      waAudioRegistry,
      isUserInDirectRoom,
      parseDirectRoomParticipants,
      getOtherParticipantId,
      getUserIdentifiers,
      isCurrentSender
    };
  }
})();
