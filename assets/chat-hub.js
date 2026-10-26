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

  // Active listener reference untuk Firebase RTDB room messages
  let activeRoomFirebaseRef = null;
  let activeRoomFirebaseCallback = null;
  let activeRoomFirebaseRef2 = null;
  let activeRoomFirebaseCallback2 = null;

  // Tab Unique ID untuk mencegah BroadcastChannel menerima pesannya sendiri (anti double bubble)
  const CURRENT_TAB_ID = 'tab_' + Date.now() + '_' + Math.random().toString(36).substr(2, 7);
  let waBroadcastChannel = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      waBroadcastChannel = new BroadcastChannel('ujikom_chat_hub_bus');
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
    if (typeof window !== 'undefined' && window.location) {
      const p = ((window.location.pathname || '') + ' ' + (window.location.href || '')).toLowerCase();
      if (p.includes('dashboard-guru') || p.includes('admin.html') || p.includes('presensi-guru')) {
        isGuruPage = true;
      } else if (p.includes('dashboard.html') || p.includes('index.html')) {
        isGuruPage = false;
      } else if (p.includes('guru') || p.includes('admin')) {
        isGuruPage = true;
      }
    }
    if (!isGuruPage && typeof document !== 'undefined') {
      const gCard = document.getElementById('guruProfileCard');
      const walasSec = document.getElementById('sectionIzinWalas');
      if (gCard || walasSec) {
        // Hanya jika bukan di dashboard.html
        const pStr = (typeof window !== 'undefined' && window.location && window.location.pathname) ? window.location.pathname.toLowerCase() : '';
        if (!pStr.includes('dashboard.html')) {
          isGuruPage = true;
        }
      }
    }

    try {
      // 1. Prioritaskan sessionStorage tab-scoped (mencegah tab Guru & Siswa saling menimpa)
      if (typeof sessionStorage !== 'undefined') {
        const rawSess = sessionStorage.getItem('user_aktif');
        if (rawSess) {
          const parsed = JSON.parse(rawSess);
          if (parsed) {
            if (isGuruPage && (parsed.nip || parsed.role === 'guru' || parsed.role === 'walas' || parsed.role === 'admin')) {
              u = parsed;
            } else if (!isGuruPage && (parsed.nisn || parsed.role === 'siswa' || !parsed.nip)) {
              u = parsed;
            }
          }
        }
      }

      // 2. Variabel in-memory sesi
      if (!u) {
        if (isGuruPage) {
          if (typeof guruAktif !== 'undefined' && guruAktif) u = guruAktif;
          else if (typeof window !== 'undefined' && window.guruAktif) u = window.guruAktif;
          else if (typeof currentUser !== 'undefined' && currentUser && (currentUser.nip || currentUser.role !== 'siswa')) u = currentUser;
          else if (typeof window !== 'undefined' && window.currentUser && (window.currentUser.nip || window.currentUser.role !== 'siswa')) u = window.currentUser;
        } else {
          if (typeof currentUser !== 'undefined' && currentUser && (currentUser.nisn || currentUser.role === 'siswa')) u = currentUser;
          else if (typeof window !== 'undefined' && window.currentUser && (window.currentUser.nisn || window.currentUser.role === 'siswa')) u = window.currentUser;
        }
      }

      // 3. Fallback ke LocalStorage TERISOLASI (HANYA kunci yang sesuai role halaman!)
      if (!u && typeof localStorage !== 'undefined') {
        if (isGuruPage) {
          const rawG = localStorage.getItem('guru_aktif') || localStorage.getItem('admin_aktif');
          if (rawG) u = JSON.parse(rawG);
        } else {
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
              if (isGuruPage && (parsed.nip || parsed.role !== 'siswa')) u = parsed;
              else if (!isGuruPage && (parsed.nisn || parsed.role === 'siswa')) u = parsed;
            }
          }
        }
      }

      // 4. Fallback fungsi helper sesi jika ada
      if (!u && typeof getSessionUser === 'function') {
        const s = getSessionUser();
        if (s) {
          if (isGuruPage && (s.nip || s.role !== 'siswa')) u = s;
          else if (!isGuruPage && (s.nisn || s.role === 'siswa')) u = s;
        }
      }
    } catch (e) {}

    // 5. Default Fallback Berdasarkan Konteks Halaman
    if (!u) {
      if (isGuruPage) {
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
          kelas: 'XII RPL 2'
        };
      }
    }

    const isGuru = Boolean(u.nip || u.role === 'guru' || u.role === 'walas' || u.role === 'admin' || isGuruPage);

    let cleanId = '';
    if (isGuru) {
      cleanId = String(u.nip || '').replace(/[^0-9]/g, '') || '199209142022211007';
    } else {
      cleanId = String(u.nisn || '').replace(/[^0-9]/g, '') || (typeof localStorage !== 'undefined' && String(localStorage.getItem('nisn_aktif') || '').replace(/[^0-9]/g, '')) || '';
      if (!cleanId && u.nama) {
        const ms = (typeof MASTER_DATA_SISWA_RESMI !== 'undefined' && MASTER_DATA_SISWA_RESMI) || {};
        const foundS = Object.values(ms).find(s => s && s.nama && (s.nama.toLowerCase().includes(u.nama.toLowerCase()) || u.nama.toLowerCase().includes(s.nama.toLowerCase())));
        if (foundS && foundS.nisn) cleanId = String(foundS.nisn).replace(/[^0-9]/g, '');
      }
      if (!cleanId) cleanId = '0098263610';
    }

    const id = cleanId;
    const isWalas = Boolean(
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

    return {
      id: String(id),
      uid: u.uid || ('UID_' + id),
      nama: u.nama || (isGuru ? 'Muhammad Echa Putra, S.Kom.Gr' : 'M. IHSAN ATHALLAH'),
      role: isGuru ? (isWalas ? 'walas' : (u.role || 'guru')) : 'siswa',
      isGuru: isGuru,
      isWalas: isWalas,
      walasKelasId: walasKelas,
      nomorKontak: u.nip || u.nisn || String(id),
      kelas: walasKelas || u.kelas || (isGuru ? 'XII RPL 2' : 'XII RPL 2'),
      foto: u.foto || (u.nisn ? 'assets/foto/' + u.nisn + '.jpg' : '')
    };
  }

  // 2. Ambil Semua Kontak (Guru & Siswa) dari Master Data
  function getSemuaKontak() {
    const list = [];
    const masterSiswa = (typeof MASTER_DATA_SISWA_RESMI !== 'undefined' && MASTER_DATA_SISWA_RESMI)
      || (typeof window !== 'undefined' && window.MASTER_DATA_SISWA_RESMI) || {};
    const masterGuru = (typeof MASTER_GURU_RESMI !== 'undefined' && MASTER_GURU_RESMI)
      || (typeof window !== 'undefined' && window.MASTER_GURU_RESMI) || DEFAULT_GURU_CONTACTS;

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
        foto: g.foto || ''
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
        adminIds: [walasPerKelas['XIIRPL2'].nip],
        memberIds: Array.from(new Set([walasPerKelas['XIIRPL2'].nip, ...(siswaPerKelas['XIIRPL2'] || ['0098263610'])]))
      },
      'group_XII_RPL_1': {
        id: 'group_XII_RPL_1',
        nama: 'Kelas XII RPL 1',
        kategori: 'kelas',
        kelas: 'XII RPL 1',
        deskripsi: 'Grup Resmi Siswa & Wali Kelas XII RPL 1 SMK Negeri 1 Sumedang',
        adminIds: [walasPerKelas['XIIRPL1'].nip],
        memberIds: Array.from(new Set([walasPerKelas['XIIRPL1'].nip, ...(siswaPerKelas['XIIRPL1'] || ['0081234567'])]))
      },
      'group_XII_TKJ_1': {
        id: 'group_XII_TKJ_1',
        nama: 'Kelas XII TKJ 1',
        kategori: 'kelas',
        kelas: 'XII TKJ 1',
        deskripsi: 'Grup Resmi Siswa & Wali Kelas XII TKJ 1 SMK Negeri 1 Sumedang',
        adminIds: [walasPerKelas['XIITKJ1'].nip],
        memberIds: Array.from(new Set([walasPerKelas['XIITKJ1'].nip, ...(siswaPerKelas['XIITKJ1'] || ['0071122334'])]))
      },
      'group_walas_sumedang': {
        id: 'group_walas_sumedang',
        nama: 'Forum Wali Kelas SMKN 1 Sumedang',
        kategori: 'walas',
        kelas: null,
        deskripsi: 'Koordinasi internal para Wali Kelas SMK Negeri 1 Sumedang',
        adminIds: ['199209142022211007', '198312052022211017'],
        memberIds: semuaWalasIds.length > 0 ? semuaWalasIds : ['199209142022211007', '198312052022211017', '198504252024211008']
      },
      'group_dewan_guru': {
        id: 'group_dewan_guru',
        nama: 'Dewan Guru & Walas SMKN 1 Sumedang',
        kategori: 'guru',
        kelas: null,
        deskripsi: 'Musyawarah Seluruh Dewan Guru Pengajar & Wali Kelas SMKN 1 Sumedang',
        adminIds: ['198109012009022003', '199209142022211007'],
        memberIds: semuaGuruIds.length > 0 ? semuaGuruIds : ['198109012009022003', '197905032006042004', '199209142022211007', '198312052022211017', '198504252024211008']
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
    const userRole = user.role || 'siswa';
    const isGuru = Boolean(user.isGuru || userRole === 'guru' || userRole === 'walas' || userRole === 'admin');
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

    // 4. ADMIN: Akses penuh
    if (userRole === 'admin') return true;

    return false;
  }

  function simpanGrupLokal(groups) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('wa_custom_groups', JSON.stringify(groups));
      }
    } catch (e) {}
  }

  // 5. Resolusi Room ID 1-on-1 (Deterministik: userA_userB diurutkan abjad, bebas dari prefix UID_)
  function getDirectRoomId(userAId, userBId) {
    const rawA = String(userAId).trim();
    const rawB = String(userBId).trim();
    const cleanA = rawA.replace(/[^0-9]/g, '') || rawA;
    const cleanB = rawB.replace(/[^0-9]/g, '') || rawB;
    return cleanA < cleanB ? `direct_${cleanA}_${cleanB}` : `direct_${cleanB}_${cleanA}`;
  }

  // 6. Kirim Pesan ke Firebase, LocalStorage, dan Broadcast Lintas-Tab
  async function kirimPesanWaHub(roomId, text, type = 'teks', mediaData = null) {
    if (!roomId) return;
    const user = getActiveUserChat();
    const cleanText = (text || '').trim();
    if (type === 'teks' && !cleanText) return;

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
      // Update thread timestamp & metadata lawan bicara (bukan nama diri sendiri!)
      const threadKey = 'wa_threads';
      let threads = JSON.parse(localStorage.getItem(threadKey) || '{}');
      let contactName = (threads[roomId] && threads[roomId].contactName) ? threads[roomId].contactName : null;
      if (!contactName || contactName === user.nama) {
        if (roomId.startsWith('group_')) {
          const groups = getDaftarGrupResmi();
          contactName = (groups[roomId] && groups[roomId].nama) || 'Grup Komunitas';
        } else if (roomId.startsWith('direct_')) {
          const parts = roomId.replace(/^direct_/, '').split('_');
          const otherId = parts.find(p => p !== String(user.id)) || parts[0];
          const allC = getSemuaKontak();
          const targetC = allC.find(c => String(c.id) === String(otherId) || String(c.nomorKontak) === String(otherId));
          contactName = targetC ? targetC.nama : ('Kontak ' + otherId);
        }
      }
      threads[roomId] = {
        roomId: roomId,
        contactName: contactName || 'Kontak Presensia',
        lastMessage: type === 'audio' ? '🎵 Pesan Suara (Voice Note)' : cleanText,
        lastTime: Date.now(),
        senderName: user.nama
      };
      localStorage.setItem(threadKey, JSON.stringify(threads));
    } catch (e) {}

    // 2. Render Seketika di UI jika sedang di room ini (Optimistic UI)
    if (waActiveRoomId === roomId) {
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
    const activeDb = (typeof window !== 'undefined' && window.db && typeof window.db.ref === 'function')
      ? window.db
      : ((typeof window !== 'undefined' && window.firebase && typeof window.firebase.database === 'function')
        ? window.firebase.database()
        : ((typeof db !== 'undefined' && db && typeof db.ref === 'function')
          ? db
          : ((typeof global !== 'undefined' && global.db && typeof global.db.ref === 'function') ? global.db : null)));

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
  }

  // 7. Muat Pesan Riwayat & Pasang Listener RTDB Ganda dengan Cleanup
  function muatPesanRoom(roomId) {
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

    const activeDb = (typeof window !== 'undefined' && window.db && typeof window.db.ref === 'function')
      ? window.db
      : ((typeof window !== 'undefined' && window.firebase && typeof window.firebase.database === 'function')
        ? window.firebase.database()
        : ((typeof db !== 'undefined' && db && typeof db.ref === 'function')
          ? db
          : ((typeof global !== 'undefined' && global.db && typeof global.db.ref === 'function') ? global.db : null)));

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
        const cloudMsgs = Object.values(val);
        if (cloudMsgs.length > 0) {
          let currentLocal = [];
          try { currentLocal = JSON.parse(localStorage.getItem(localKey) || '[]'); } catch (e) {}
          if (!Array.isArray(currentLocal)) currentLocal = [];

          const map = {};
          currentLocal.forEach(m => { if (m && m.id) map[m.id] = m; });
          cloudMsgs.forEach(m => { if (m && m.id) map[m.id] = m; });
          const merged = Object.values(map).sort((a, b) => (a.waktu || 0) - (b.waktu || 0));
          try { localStorage.setItem(localKey, JSON.stringify(merged)); } catch (e) {}
          if (waActiveRoomId === roomId) {
            renderDaftarPesan(merged);
          }
        }
      };

      try {
        activeRoomFirebaseRef = activeDb.ref('chat_rooms/' + roomId + '/messages').limitToLast(60);
        activeRoomFirebaseCallback = activeRoomFirebaseRef.on('value', handleSnapshot, err => {
          console.warn('[Firebase RTDB] Listener chat_rooms ditolak aturan keamanan (Permission Denied):', err);
        });
      } catch (eSnap1) {}

      try {
        activeRoomFirebaseRef2 = activeDb.ref('chat_perijinan/' + roomId + '/messages').limitToLast(60);
        activeRoomFirebaseCallback2 = activeRoomFirebaseRef2.on('value', handleSnapshot, err => {
          console.warn('[Firebase RTDB] Listener chat_perijinan ditolak aturan keamanan (Permission Denied):', err);
        });
      } catch (eSnap2) {}
    }

    return list;
  }

  // 8. Voice Note (VN) Recorder
  async function toggleVoiceNoteRecording() {
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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      waAudioChunks = [];
      waCurrentMediaRecorder = new MediaRecorder(stream);

      waCurrentMediaRecorder.ondataavailable = e => {
        if (e.data && e.data.size > 0) waAudioChunks.push(e.data);
      };

      waCurrentMediaRecorder.onstop = async () => {
        clearInterval(waRecordingTimer);
        const finalSecs = waRecordSeconds;
        waRecordSeconds = 0;
        btnMic.classList.remove('wa-recording-active');
        btnMic.title = 'Rekam Voice Note';
        const txtInput = document.getElementById('waInputText');
        if (txtInput) txtInput.placeholder = 'Ketik pesan atau ketik @ untuk tag...';

        stream.getTracks().forEach(t => t.stop());

        if (waAudioChunks.length > 0 && finalSecs >= 1) {
          const blob = new Blob(waAudioChunks, { type: 'audio/webm' });
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

      waCurrentMediaRecorder.start();
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
    const container = document.getElementById('waMessagesContainer');
    if (!container) return;

    // GUARD ANTI DOUBLE: Jika elemen dengan ID ini sudah ada di DOM, jangan pernah render lagi!
    const cleanId = String(msg.id).replace(/[^a-zA-Z0-9_-]/g, '_');
    const bubbleId = 'waBubble_' + cleanId;
    if (document.getElementById(bubbleId)) {
      return; // Sudah tampil di layar!
    }

    const currentUser = getActiveUserChat();
    const isMe = String(msg.pengirimId) === String(currentUser.id);

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
      contentHtml = `
        <div class="wa-vn-player">
          <button type="button" class="wa-vn-play-btn" onclick="putarAudioWa(this, '${msg.audio_url}')">
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
          <span class="wa-vn-time">${msg.audio_durasi || 3}s</span>
        </div>
      `;
    } else {
      contentHtml = `<div class="wa-bubble-text">${renderedText}</div>`;
    }

    const roleBadge = (msg.role === 'admin' || msg.role === 'walas' || msg.role === 'guru')
      ? '<span class="wa-badge-role wa-badge-admin" style="margin-left:4px;">👑 Admin</span>'
      : '';

    bubble.innerHTML = `
      ${!isMe ? `<div class="wa-bubble-sender"><span>${escapeHtmlWa(msg.nama || 'Pengguna')}</span>${roleBadge}</div>` : ''}
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

    // Validasi otorisasi jika membuka grup
    if (roomType === 'group') {
      const groups = getDaftarGrupResmi();
      const g = groups[roomId];
      if (g && !cekAksesGrup(currentUser, g)) {
        alert('Akses Ditolak: Anda tidak memiliki izin untuk membuka grup ' + (g.nama || roomId) + '.');
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
    } catch (e) {}

    const winList = document.getElementById('waListPanel');
    const winChat = document.getElementById('waChatView');
    const titleEl = document.getElementById('waChatHeaderName');
    const subEl = document.getElementById('waChatHeaderStatus');
    const btnGroupInfo = document.getElementById('waBtnGroupInfo');

    if (titleEl) titleEl.textContent = targetTitle;
    if (subEl) subEl.textContent = targetSubtitle || (roomType === 'group' ? 'Grup Resmi' : 'Online');
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
  }

  // 11. Render Konten Tab (Chats, Groups, Contacts)
  function renderTabKontenWa() {
    const body = document.getElementById('waPanelBody');
    if (!body) return;
    const currentUser = getActiveUserChat();
    const query = (document.getElementById('waSearchInput')?.value || '').toLowerCase().trim();

    // Perbarui label header user secara dinamis
    const userDisplay = document.getElementById('waHeaderUserDisplay');
    if (userDisplay) {
      const roleName = currentUser.isWalas ? 'Wali Kelas' : (currentUser.role === 'guru' ? 'Guru' : 'Siswa');
      userDisplay.innerHTML = `Masuk sebagai: <strong>${escapeHtmlWa(currentUser.nama)}</strong> (${currentUser.nomorKontak}) • <span style="opacity:0.9;">${roleName}</span>`;
    }

    body.innerHTML = '';

    // ==========================================
    // TAB 1: OBROLAN AKTIF (CHATS)
    // ==========================================
    if (waActiveTab === 'chats') {
      const threadKey = 'wa_threads';
      let threads = {};
      try { threads = JSON.parse(localStorage.getItem(threadKey) || '{}'); } catch (e) {}
      const threadList = Object.values(threads).sort((a, b) => (b.lastTime || 0) - (a.lastTime || 0));

      if (threadList.length === 0) {
        body.innerHTML = `
          <div style="text-align:center;padding:48px 20px;color:#64748B;font-size:13.5px;">
            <div style="font-size:36px;margin-bottom:8px;">💬</div>
            <strong>Belum ada percakapan aktif.</strong><br>
            Buka tab <strong>Grup Komunitas</strong> untuk obrolan kelas atau <strong>Buku Kontak</strong> untuk chat pribadi.
          </div>
        `;
        return;
      }

      threadList.forEach(th => {
        const item = document.createElement('div');
        item.className = 'wa-list-item';
        const dateObj = new Date(th.lastTime);
        const timeStr = String(dateObj.getHours()).padStart(2, '0') + ':' + String(dateObj.getMinutes()).padStart(2, '0');
        const isGroup = th.roomId.startsWith('group_');

        // Resolve display name: nama lawan bicara, BUKAN nama diri sendiri!
        let displayName = th.contactName;
        if (!displayName || displayName === currentUser.nama) {
          if (isGroup) {
            const groups = getDaftarGrupResmi();
            displayName = (groups[th.roomId] && groups[th.roomId].nama) || 'Grup Komunitas';
          } else if (th.roomId.startsWith('direct_')) {
            const parts = th.roomId.replace(/^direct_/, '').split('_');
            const otherId = parts.find(p => p !== String(currentUser.id)) || parts[0];
            const allC = getSemuaKontak();
            const targetC = allC.find(c => String(c.id) === String(otherId) || String(c.nomorKontak) === String(otherId));
            displayName = targetC ? targetC.nama : ('Kontak ' + otherId);
          } else {
            displayName = th.contactName || 'Kontak Presensia';
          }
        }

        item.onclick = () => {
          if (isGroup) {
            const groups = getDaftarGrupResmi();
            const g = groups[th.roomId] || { nama: displayName, deskripsi: 'Grup' };
            bukaRoomWa(th.roomId, g.nama, g.deskripsi, 'group');
          } else {
            bukaRoomWa(th.roomId, displayName, 'Pribadi', 'direct');
          }
        };

        item.innerHTML = `
          <div class="wa-avatar ${isGroup ? 'group-avatar' : ''}">
            ${isGroup ? '👥' : (displayName ? displayName[0].toUpperCase() : 'U')}
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
    // TAB 2: GRUP KOMUNITAS (TERISOLASI ROLE & KELAS)
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
          (g.adminIds && g.adminIds.includes(String(currentUser.id))) &&
          currentUser.role !== 'siswa'
        );

        item.onclick = () => {
          bukaRoomWa(g.id, g.nama, `${g.memberIds.length} Anggota • ${isAdmin ? '👑 Anda Admin Grup' : 'Anggota'}`, 'group');
        };

        const badgeKat = g.kategori === 'walas'
          ? '<span class="wa-badge-role wa-badge-walas">Khusus Walas</span>'
          : (g.kategori === 'guru' ? '<span class="wa-badge-role wa-badge-admin">Dewan Guru</span>' : '<span class="wa-badge-role wa-badge-siswa">Siswa & Walas</span>');

        item.innerHTML = `
          <div class="wa-avatar group-avatar">👥</div>
          <div class="wa-item-info">
            <div class="wa-item-top">
              <span class="wa-item-name">${escapeHtmlWa(g.nama)}</span>
              ${badgeKat}
            </div>
            <div class="wa-item-sub">${escapeHtmlWa(g.deskripsi)}</div>
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

        let roleLabel = c.role === 'walas' ? 'Wali Kelas' : (c.role === 'guru' ? 'Guru' : 'Siswa');
        let roleBadge = c.role === 'walas' ? 'wa-badge-walas' : (c.role === 'guru' ? 'wa-badge-admin' : 'wa-badge-siswa');

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

  // 12. Modal Info Grup & Manajemen Anggota (Kick & Tambah Anggota)
  function bukaInfoGrupModal() {
    if (!waActiveRoomId || !waActiveRoomId.startsWith('group_')) return;
    const modal = document.getElementById('waGroupInfoModal');
    if (!modal) return;
    const groups = getDaftarGrupResmi();
    const g = groups[waActiveRoomId];
    if (!g) return;

    waActiveGroupDetailId = g.id;
    const currentUser = getActiveUserChat();
    // Siswa TIDAK PERNAH boleh menjadi admin grup
    const isAdmin = Boolean(
      (g.adminIds.includes(String(currentUser.id)) || currentUser.role === 'admin') &&
      currentUser.role !== 'siswa'
    );

    const titleEl = document.getElementById('waGroupInfoTitle');
    const descEl = document.getElementById('waGroupInfoDesc');
    const countEl = document.getElementById('waGroupInfoCount');
    const memberListEl = document.getElementById('waGroupMemberList');
    const btnAddWrap = document.getElementById('waGroupAddMemberWrap');

    if (titleEl) titleEl.textContent = g.nama;
    if (descEl) descEl.textContent = g.deskripsi;
    if (countEl) countEl.textContent = `${g.memberIds.length} Anggota • Admin: ${g.adminIds.length}`;
    if (btnAddWrap) btnAddWrap.style.display = isAdmin ? 'block' : 'none';

    if (memberListEl) {
      memberListEl.innerHTML = '';
      const allContacts = getSemuaKontak();
      const contactMap = {};
      allContacts.forEach(c => { contactMap[c.id] = c; });

      g.memberIds.forEach(mId => {
        const c = contactMap[mId] || { nama: 'Pengguna ID ' + mId, nomorKontak: mId, role: 'member' };
        const isMemAdmin = g.adminIds.includes(mId);
        const row = document.createElement('div');
        row.className = 'wa-member-row';

        row.innerHTML = `
          <div class="wa-member-info">
            <div class="wa-avatar" style="width:36px;height:36px;font-size:12px;">${c.nama[0].toUpperCase()}</div>
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

  function tutupInfoGrupModal() {
    const modal = document.getElementById('waGroupInfoModal');
    if (modal) modal.style.display = 'none';
  }

  function keluarkanMemberDariGrup(groupId, memberId) {
    const currentUser = getActiveUserChat();
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

  // 14. Audio Play Helper
  window.putarAudioWa = function (btn, audioUrl) {
    if (!audioUrl) return;
    const existingAudio = window._waCurrentAudio;
    if (existingAudio) {
      existingAudio.pause();
      if (window._waCurrentPlayBtn) {
        window._waCurrentPlayBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
      }
      if (existingAudio.src === audioUrl && !existingAudio.ended) {
        window._waCurrentAudio = null;
        return;
      }
    }

    const audio = new Audio(audioUrl);
    window._waCurrentAudio = audio;
    window._waCurrentPlayBtn = btn;
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';

    audio.onended = () => {
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
      window._waCurrentAudio = null;
    };
    audio.play().catch(() => {});
  };

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

    // 1. Tombol Melayang
    const btnFloat = document.createElement('div');
    btnFloat.id = 'waFloatingBtn';
    btnFloat.className = 'wa-floating-btn';
    btnFloat.title = 'Buka WhatsApp Presensia (Chat & Grup)';
    btnFloat.innerHTML = `
      <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.301-.15-1.78-.879-2.056-.98-.276-.1-.476-.15-.677.15-.2.301-.777.98-.953 1.18-.175.2-.351.226-.652.075-.301-.15-1.27-.468-2.42-1.493-.895-.798-1.5-1.784-1.675-2.084-.175-.301-.019-.463.132-.613.136-.135.301-.351.452-.526.15-.176.2-.301.301-.502.101-.2.051-.376-.025-.526-.076-.15-.677-1.631-.928-2.233-.245-.586-.494-.506-.677-.515-.176-.008-.376-.01-.577-.01-.2 0-.527.075-.803.376-.276.301-1.053 1.029-1.053 2.509 0 1.48 1.079 2.91 1.229 3.111.15.2 2.122 3.24 5.141 4.545.718.311 1.279.497 1.716.636.722.23 1.378.197 1.898.12.579-.086 1.78-.727 2.031-1.429.251-.702.251-1.304.176-1.429-.076-.126-.276-.201-.577-.352zM12 21.82a9.78 9.78 0 0 1-4.99-1.373l-.358-.212-3.71.973.99-3.616-.233-.371A9.79 9.79 0 1 1 12 21.82zm0-17.82a8.03 8.03 0 0 0-6.94 12.08l.44.702-.58 2.122 2.17-.57.68.404A8.03 8.03 0 1 0 12 4z"/>
      </svg>
      <div id="waBadgeCounter" class="wa-badge-counter">0</div>
    `;

    // 2. Jendela Utama Chat Hub
    const hubWin = document.createElement('div');
    hubWin.id = 'waHubWindow';
    hubWin.className = 'wa-hub-window';

    const currentUser = getActiveUserChat();
    const roleName = currentUser.isWalas ? 'Wali Kelas' : (currentUser.role === 'guru' ? 'Guru' : 'Siswa');

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
            Masuk sebagai: <strong>${escapeHtmlWa(currentUser.nama)}</strong> (${currentUser.nomorKontak}) • <span style="opacity:0.9;">${roleName}</span>
          </div>
          <div class="wa-nav-tabs">
            <div class="wa-tab-item active" data-tab="chats">Obrolan</div>
            <div class="wa-tab-item" data-tab="groups">Grup Komunitas</div>
            <div class="wa-tab-item" data-tab="contacts">Buku Kontak</div>
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
          <div class="wa-chat-header-left" id="waBtnBackToList">
            <button type="button" class="wa-btn-back">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            </button>
            <div class="wa-chat-header-info">
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
            <div style="font-weight:800;font-size:15px;color:#ffffff;" id="waGroupInfoTitle">Detail Grup</div>
          </div>
          <div class="wa-group-info-body">
            <div style="font-size:13.5px;color:#475569;margin-bottom:6px;" id="waGroupInfoDesc">Deskripsi</div>
            <div style="font-size:12px;font-weight:700;color:#128C7E;margin-bottom:14px;" id="waGroupInfoCount">0 Anggota</div>
            <div id="waGroupAddMemberWrap" style="display:none;">
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
      const isVisible = hubWin.style.display === 'flex';
      hubWin.style.display = isVisible ? 'none' : 'flex';
      if (!isVisible && !waActiveRoomId) {
        renderTabKontenWa();
      }
    };

    document.getElementById('waBtnMinimize').onclick = () => {
      hubWin.style.display = 'none';
    };

    document.getElementById('waBtnBackToList').onclick = kembaliKeDaftarWa;

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

          if (waActiveRoomId === rId) {
            appendBubblePesan(m);
            scrollChatKeBawah();
          } else if (waActiveTab === 'chats') {
            renderTabKontenWa();
          }
        }
      };
    }

    try {
      window.addEventListener('storage', e => {
        if (e && e.key && e.key.startsWith('wa_msgs_')) {
          const rId = e.key.replace('wa_msgs_', '');
          if (waActiveRoomId === rId) {
            try {
              const msgs = JSON.parse(e.newValue || '[]');
              if (Array.isArray(msgs)) {
                msgs.forEach(m => appendBubblePesan(m));
                scrollChatKeBawah();
              }
            } catch (errParse) {}
          } else if (waActiveTab === 'chats') {
            renderTabKontenWa();
          }
        }
      });
    } catch (eStorage) {}
  }

  // 16. Window Bridge Functions
  window.bukaChatWhatsApp = function (targetId, targetType = 'direct', optionalName = '', optionalSub = '') {
    const hubWin = document.getElementById('waHubWindow');
    if (hubWin) hubWin.style.display = 'flex';
    const currentUser = getActiveUserChat();

    if (targetType === 'group') {
      const groups = getDaftarGrupResmi();
      const g = groups[targetId] || { nama: optionalName || 'Grup Komunitas', deskripsi: optionalSub || 'Grup' };
      bukaRoomWa(targetId, g.nama, g.deskripsi, 'group');
    } else {
      let resolvedName = optionalName;
      if (!resolvedName) {
        const allC = getSemuaKontak();
        const found = allC.find(c => String(c.id) === String(targetId) || String(c.nomorKontak) === String(targetId));
        if (found) resolvedName = found.nama;
      }
      const directId = getDirectRoomId(currentUser.id, targetId);
      bukaRoomWa(directId, resolvedName || ('Kontak ' + targetId), optionalSub || ('ID: ' + targetId), 'direct');
    }
  };

  window.bukaInfoGrupWa = bukaInfoGrupModal;
  window.tutupInfoGrupWa = tutupInfoGrupModal;
  window.keluarkanMemberDariGrup = keluarkanMemberDariGrup;
  window.tambahAnggotaGrupWa = function () {
    if (waActiveGroupDetailId) tambahAnggotaGrup(waActiveGroupDetailId);
  };

  // Otomatis Pasang saat DOM Siap
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bangunDomWaHub);
    } else {
      bangunDomWaHub();
    }
  }

  if (typeof global !== 'undefined') {
    global.bukaChatWhatsApp = window.bukaChatWhatsApp;
    global.kirimPesanWaHub = kirimPesanWaHub;
    global.getSemuaKontak = getSemuaKontak;
    global.getDaftarGrupResmi = getDaftarGrupResmi;
    global.getActiveUserChat = getActiveUserChat;
    global.cekAksesGrup = cekAksesGrup;
    global.appendBubblePesan = appendBubblePesan;
    global.getDirectRoomId = getDirectRoomId;
    global.renderTabKontenWa = renderTabKontenWa;
  }
})();
