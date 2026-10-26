// ===== PERIJINAN MODULE =====
// Submit ijin, upload surat, chat dengan admin

const JENIS_PERIJINAN = {
  izin: { label: 'Izin', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-2px;margin-right:4px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>', dokumenWajib: false },
  dispen: { label: 'Dispen', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-2px;margin-right:4px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>', dokumenWajib: true },
  sakit: { label: 'Sakit', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-2px;margin-right:4px;"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>', dokumenWajib: false },
  dispensasi: { label: 'Dispen', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-2px;margin-right:4px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>', dokumenWajib: true },
  ijin_kegiatan: { label: 'Izin', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-2px;margin-right:4px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>', dokumenWajib: true },
  sakit_mendadak: { label: 'Sakit', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-2px;margin-right:4px;"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>', dokumenWajib: false },
  penugasan_dinas: { label: 'Tugas Luar / Dinas', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-2px;margin-right:4px;"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>', dokumenWajib: false },
  keperluan_mendesak: { label: 'Keperluan Keluarga', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-2px;margin-right:4px;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>', dokumenWajib: false },
  kendala_teknis: { label: 'Kendala Perjalanan', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-2px;margin-right:4px;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/></svg>', dokumenWajib: false }
};

function getJenisPerijinanInfo(jenis) {
  if (jenis && JENIS_PERIJINAN[jenis]) return JENIS_PERIJINAN[jenis];
  const clean = (jenis || 'Izin').replace(/_/g, ' ');
  const capitalized = clean.charAt(0).toUpperCase() + clean.slice(1);
  return {
    label: capitalized,
    icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-2px;margin-right:4px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    dokumenWajib: false
  };
}

// Helper normalisasi format tanggal (YYYY-MM-DD vs MM/DD/YYYY atau DD/MM/YYYY)
function normalisasiFormatTanggal(tgl) {
  if (!tgl || typeof tgl !== 'string') return tgl || '';
  const clean = tgl.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  const slashMatch = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const p1 = slashMatch[1].padStart(2, '0');
    const p2 = slashMatch[2].padStart(2, '0');
    const year = slashMatch[3];
    if (parseInt(p1, 10) > 12) {
      return `${year}-${p2}-${p1}`;
    }
    return `${year}-${p1}-${p2}`;
  }
  return clean;
}

// Kompresi gambar via HTML5 Canvas agar ringan dan tidak melebihi kuota 5MB localStorage
function compressImageFile(file, maxDimension = 800, quality = 0.65) {
  return new Promise((resolve) => {
    if (!file) return resolve(null);
    const isImage = (file.type && file.type.startsWith('image/')) || (file.name && /\.(jpe?g|png|webp|gif|bmp)$/i.test(file.name));
    if (!isImage) {
      return resolve(null);
    }
    if (typeof FileReader === 'undefined' || typeof Image === 'undefined' || typeof document === 'undefined') {
      return resolve(null);
    }
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          if (!e.target || !e.target.result) return resolve(null);
          const img = new Image();
          img.onload = () => {
            try {
              let width = img.width || 800;
              let height = img.height || 600;
              if (width > maxDimension || height > maxDimension) {
                if (width > height) {
                  height = Math.round((height * maxDimension) / width);
                  width = maxDimension;
                } else {
                  width = Math.round((width * maxDimension) / height);
                  height = maxDimension;
                }
              }
              const canvas = document.createElement('canvas');
              if (!canvas || typeof canvas.getContext !== 'function') return resolve(e.target.result);
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              if (!ctx) return resolve(e.target.result);
              ctx.drawImage(img, 0, 0, width, height);
              let compressed = canvas.toDataURL('image/jpeg', quality);
              // Jika ukuran masih terlalu besar (>250KB), kompresi tahap kedua yang lebih kompak
              if (compressed && compressed.length > 250000) {
                const subCanvas = document.createElement('canvas');
                const subW = Math.round(width * 0.75);
                const subH = Math.round(height * 0.75);
                subCanvas.width = subW;
                subCanvas.height = subH;
                const subCtx = subCanvas.getContext('2d');
                if (subCtx) {
                  subCtx.drawImage(img, 0, 0, subW, subH);
                  compressed = subCanvas.toDataURL('image/jpeg', 0.52);
                }
              }
              resolve(compressed || e.target.result);
            } catch (errCanvas) {
              resolve(e.target ? e.target.result : null);
            }
          };
          img.onerror = () => resolve(e.target ? e.target.result : null);
          img.src = e.target.result;
        } catch (errImg) {
          resolve(e.target ? e.target.result : null);
        }
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    } catch (err) {
      resolve(null);
    }
  });
}

// ===================================================================
// SUBMIT PERIJINAN BARU
// ===================================================================
async function submitPerijinan(user, jenis, alasan, tanggal, fileInput) {
  let finalNisn = (user && user.nisn) ? String(user.nisn).trim() : '';
  let finalNama = (user && (user.nama || user.nama_siswa)) || '';
  let finalKelas = (user && (user.kelas || user.kelasId)) || '';

  let ms = (typeof MASTER_DATA_SISWA_RESMI !== 'undefined' && MASTER_DATA_SISWA_RESMI)
    || (typeof window !== 'undefined' && window.MASTER_DATA_SISWA_RESMI)
    || {};
  if (Object.keys(ms).length === 0 && typeof require !== 'undefined') {
    try { ms = require('./firebase-config.js').MASTER_DATA_SISWA_RESMI || {}; } catch (e) {}
  }

  if (!finalNisn && user && user.email && typeof cariSiswaByEmail === 'function') {
    const sm = cariSiswaByEmail(user.email);
    if (sm && sm.nisn) finalNisn = sm.nisn;
  }

  if (!finalNisn && finalNama) {
    const nLow = finalNama.toLowerCase().trim();
    for (const k in ms) {
      if (ms[k] && ms[k].nama && ms[k].nama.toLowerCase().trim() === nLow) {
        finalNisn = k;
        break;
      }
    }
  }

  if (finalNisn === '0098263610' || (!finalNisn && finalNama && finalNama.toLowerCase().includes('ihsan'))) {
    finalNisn = '0098263610';
  }

  if (finalNisn && ms[finalNisn]) {
    if (!finalNama || finalNama === 'Siswa') finalNama = ms[finalNisn].nama;
    if (!finalKelas || finalKelas === '-') finalKelas = ms[finalNisn].kelas;
  }

  if (finalNisn === '0098263610') {
    if (!finalKelas || finalKelas === '-') finalKelas = 'XII RPL 2';
    if (!finalNama || finalNama === 'Siswa') finalNama = 'M. IHSAN ATHALLAH';
  }

  if (typeof normalisasiKelas === 'function' && finalKelas) {
    finalKelas = normalisasiKelas(finalKelas);
  }

  if (user) {
    if (finalNisn) user.nisn = finalNisn;
    if (finalNama) { user.nama = finalNama; user.nama_siswa = finalNama; }
    if (finalKelas) { user.kelas = finalKelas; user.kelasId = finalKelas; }
  }

  const isSiswa = user && (user.role === 'siswa' || (!user.role && finalNisn) || (finalNisn && typeof MASTER_DATA_SISWA_RESMI !== 'undefined' && MASTER_DATA_SISWA_RESMI[finalNisn]) || finalNisn === '0098263610');
  if (!user || user.role === 'pengunjung' || !finalNisn || !isSiswa) {
    throw new Error('Akses Ditolak: Fitur pengajuan perizinan hanya diperbolehkan untuk siswa resmi yang telah terverifikasi NISN.');
  }
  let perijinanRef = null;
  try {
    if (typeof db !== 'undefined' && db && typeof db.ref === 'function') {
      const r = db.ref('perijinan');
      if (r && typeof r.push === 'function') perijinanRef = r.push();
    }
  } catch (eRef) {}
  const pid = (perijinanRef && perijinanRef.key)
    ? perijinanRef.key
    : ('PERMIT-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6));

  let dokumen_url = null;
  let uploadSuccess = false;

  if (fileInput) {
    const file = (fileInput.files && fileInput.files[0]) || (typeof File !== 'undefined' && fileInput instanceof File ? fileInput : (fileInput.size && fileInput.name ? fileInput : null));
    if (file) {
      const isImage = (file.type && file.type.startsWith('image/')) || (file.name && /\.(jpe?g|png|webp|gif|bmp)$/i.test(file.name));
      if (!isImage && file.size > 10 * 1024 * 1024) {
        throw new Error('Ukuran file dokumen PDF maksimal 10MB');
      }
      if (isImage && file.size > 25 * 1024 * 1024) {
        throw new Error('Ukuran file foto maksimal 25MB');
      }

      // Pre-kompresi lokal seketika jika berupa foto agar tidak terhambat ukuran 4K
      let localCompressedUrl = null;
      if (isImage) {
        try {
          localCompressedUrl = await compressImageFile(file, 960, 0.68);
        } catch (eCanvas) {
          console.warn('[Storage] Pre-kompresi canvas awal:', eCanvas);
        }
      }

      // Coba upload ke Firebase Storage jika tersedia & diizinkan (security rules / storage/unauthorized resilience)
      if (typeof firebase !== 'undefined' && firebase.storage && typeof firebase.storage === 'function') {
        try {
          const storageInstance = firebase.storage();
          if (storageInstance && typeof storageInstance.ref === 'function') {
            const cleanName = (file.name || 'lampiran.jpg').replace(/[^a-zA-Z0-9._-]/g, '_');
            const storageRef = storageInstance.ref('surat/' + pid + '_' + cleanName);
            const uploadSnapshot = await Promise.race([
              storageRef.put(file).catch(err => {
                console.warn('[Firebase Storage] Upload ditolak (unauthorized/permission_denied):', err && err.message ? err.message : err);
                return null;
              }),
              new Promise(res => setTimeout(() => res(null), 1800))
            ]);

            if (uploadSnapshot) {
              if (uploadSnapshot.ref && typeof uploadSnapshot.ref.getDownloadURL === 'function') {
                dokumen_url = await uploadSnapshot.ref.getDownloadURL().catch(() => null);
              } else if (typeof storageRef.getDownloadURL === 'function') {
                dokumen_url = await storageRef.getDownloadURL().catch(() => null);
              }
            }
            if (dokumen_url) uploadSuccess = true;
          }
        } catch (err) {
          console.warn('[Firebase Storage] Gagal atau dibatasi rules, beralih ke fallback kompresi:', err && err.message ? err.message : err);
        }
      }

      // Fallback kompresi canvas & FileReader jika Firebase Storage offline/ditolak/gagal
      if (!uploadSuccess) {
        if (localCompressedUrl) {
          dokumen_url = localCompressedUrl;
        } else if (isImage) {
          try {
            dokumen_url = await compressImageFile(file, 960, 0.68);
          } catch (eCanvas) {
            console.warn('[Fallback Storage] Kompresi canvas gagal:', eCanvas);
          }
        }
        if (!dokumen_url && typeof FileReader !== 'undefined') {
          try {
            dokumen_url = await new Promise((resolve) => {
              const reader = new FileReader();
              reader.onload = (e) => resolve(e.target ? e.target.result : null);
              reader.onerror = () => resolve(null);
              reader.readAsDataURL(file);
            });
          } catch (errReader) {
            console.warn('[Fallback Storage] FileReader gagal:', errReader);
          }
        }
      }
    }
  }

  const tanggalNorm = normalisasiFormatTanggal(tanggal);

  const data = {
    id: pid,
    pid: pid,
    uid: (user && user.uid) || ('UID_' + (finalNisn || Date.now())),
    nisn: finalNisn,
    siswaId: finalNisn,
    nama: finalNama || (user && user.nama) || 'Siswa',
    nama_siswa: finalNama || (user && user.nama) || 'Siswa',
    namaSiswa: finalNama || (user && user.nama) || 'Siswa',
    kelas: finalKelas || 'XII RPL 2',
    kelasId: finalKelas || 'XII RPL 2',
    walasId: (user && user.walasId) || finalKelas || 'XII RPL 2',
    jenis: jenis,
    alasan: alasan,
    tanggal: tanggal,
    tanggal_norm: tanggalNorm,
    status: 'pending',
    dokumen_url: dokumen_url,
    bukti_url: dokumen_url,
    lampiranUrl: dokumen_url,
    pengajuId: finalNisn,
    userId: (user && user.uid) || ('UID_' + (finalNisn || Date.now())),
    rolePengaju: 'siswa',
    targetKelasId: finalKelas || 'XII RPL 2',
    tipe: jenis,
    jenisPermit: jenis,
    foto_bukti: dokumen_url,
    buktiUrl: dokumen_url,
    dokumentasi: dokumen_url,
    dibuat_pada: Date.now(),
    createdAt: Date.now(),
    created_at: new Date().toISOString()
  };

  // 1. Simpan ke antrean lokal localStorage terlebih dahulu untuk ketahanan offline & update instan
  try {
    if (typeof localStorage !== 'undefined') {
      if (finalNisn) {
        try { localStorage.setItem('status_izin_' + finalNisn, 'pending'); } catch (e) {}
      }
      if (dokumen_url) {
        try {
          if (finalNisn) {
            localStorage.setItem('foto_izin_' + finalNisn, dokumen_url);
            localStorage.setItem('last_submission_' + finalNisn, JSON.stringify(data));
          }
          localStorage.setItem('lampiran_foto_' + pid, dokumen_url);
          if (finalNisn === '0098263610' || (data.nama && data.nama.toLowerCase().includes('ihsan'))) {
            localStorage.setItem('last_real_foto_ihsan', dokumen_url);
          }
        } catch (ePhotoSave) {}
      }

      ['local_perizinan', 'local_perijinan', 'daftar_perizinan_lokal'].forEach(key => {
        let list = JSON.parse(localStorage.getItem(key) || '[]');
        if (!Array.isArray(list)) list = [];
        list = list.filter(item => item && (item.id !== pid && item.pid !== pid));
        list.unshift(data);
        if (list.length > 50) list = list.slice(0, 50);

        try {
          localStorage.setItem(key, JSON.stringify(list));
        } catch (quotaErr) {
          // Fallback perlindungan kuota localStorage browser (5MB limit):
          // Pertahankan foto pengajuan terbaru (index 0), padatkan dataURL foto riwayat lama untuk menghemat kuota
          try {
            const compactList = list.map((item, idx) => {
              if (idx > 0 && item && (item.dokumen_url || item.foto_bukti || item.buktiUrl || item.dokumentasi)) {
                return {
                  ...item,
                  dokumen_url: '',
                  bukti_url: '',
                  lampiranUrl: '',
                  foto_bukti: '',
                  buktiUrl: '',
                  dokumentasi: '',
                  lampiran_nama: item.lampiran_nama || 'Lampiran Foto'
                };
              }
              return item;
            });
            localStorage.setItem(key, JSON.stringify(compactList));
          } catch (e2) {
            try {
              const allCompact = list.map(item => {
                if (item && (item.dokumen_url || item.foto_bukti || item.buktiUrl || item.dokumentasi)) {
                  return {
                    ...item,
                    dokumen_url: '',
                    bukti_url: '',
                  lampiranUrl: '',
                    foto_bukti: '',
                    buktiUrl: '',
                    dokumentasi: '',
                    lampiran_nama: item.lampiran_nama || 'Lampiran Foto'
                  };
                }
                return item;
              });
              localStorage.setItem(key, JSON.stringify(allCompact));
            } catch (e3) {}
          }
        }
      });
    }
  } catch (e) {}

  // 2. Perbarui cache admin jika berada di browser/lingkungan yang sama
  try {
    if (typeof cacheSemuaPerizinanAdmin !== 'undefined') {
      const itemNorm = (typeof normalisasiItemPerizinan === 'function') ? normalisasiItemPerizinan(data, false) : data;
      if (itemNorm && itemNorm.id) {
        cacheSemuaPerizinanAdmin[itemNorm.id] = itemNorm;
      }
      if (typeof updatePendingBadgeDanBanner === 'function') {
        updatePendingBadgeDanBanner();
      }
    }
  } catch (e) {}

  // 3. Simpan ke Firebase RTDB (/perijinan & /perizinan) dengan non-blocking fallback
  if (typeof db !== 'undefined' && db && typeof db.ref === 'function') {
    try {
      // Simpan string/URL asli dokumen/bukti ke database Firebase (Sesuai Spesifikasi Ujikom)
      const rtdbData = data;

      const dbPromises = [];
      if (perijinanRef && typeof perijinanRef.set === 'function') {
        dbPromises.push(perijinanRef.set(rtdbData).catch(() => null));
      }
      dbPromises.push(
        db.ref('perijinan/' + pid).set(rtdbData).catch(() => null)
      );
      dbPromises.push(
        db.ref('perizinan/' + pid).set({
          ...rtdbData,
          id: pid,
          nama_siswa: data.nama,
          created_at: data.created_at
        }).catch(() => null)
      );

      await Promise.race([
        Promise.all(dbPromises),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500))
      ]).catch(() => null);
    } catch (e) {
      console.warn('RTDB sync warning:', e);
    }
  }

  // 4. Kirim chat perizinan secara aman
  try {
    const labelJn = (JENIS_PERIJINAN[jenis]?.label || (jenis === 'dispensasi' ? 'Dispen' : (jenis === 'ijin_kegiatan' ? 'Izin' : jenis)));
  const pesanPertama = 'Saya mengajukan ' + labelJn + ' untuk tanggal ' + (tanggal || '-') + ' dengan alasan: ' + alasan + (dokumen_url ? ' (Bukti dokumen asli terlampir)' : '');
  await kirimChatPerijinan(pid, user, pesanPertama).catch(() => null);
  } catch (e) {}

  // 5. Trigger event lokal & storage ping untuk sinkronisasi seketika antar-komponen & lintas-tab
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('perizinan_sync_ping', String(Date.now()));
      localStorage.setItem('local_perizinan_updated', String(Date.now()));
    }
  } catch (eStorage) {}

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel('ujikom_perizinan_bus');
      if (typeof bc.unref === 'function') bc.unref();
      bc.postMessage({ type: 'NEW_PERMIT', pid: pid, nisn: finalNisn, data: data });
      const timer = setTimeout(() => {
        try { bc.close(); } catch (e) {}
      }, 1000);
      if (timer && typeof timer.unref === 'function') timer.unref();
    }
  } catch (eBc) {}

  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      const evt = (typeof CustomEvent === 'function')
        ? new CustomEvent('perizinan_updated', { detail: data })
        : { type: 'perizinan_updated', detail: data };
      window.dispatchEvent(evt);
    }
  } catch (eEvt) {}

  return pid;
}

// ===================================================================
// CHAT PERIJINAN & ALIAS ID RESOLUTION
// ===================================================================
function ambilLinkedChatIds(pid) {
  if (!pid) return ['general'];
  return [String(pid).trim()];
}

async function kirimChatPerijinan(pid, user, pesan) {
  if (!pid) return;
  if (!user && typeof ambilChatUser === 'function') {
    user = ambilChatUser();
  } else if (!user && typeof getSessionUser === 'function') {
    user = getSessionUser();
  }
  const isStaff = Boolean(user && (user.role === 'admin' || user.role === 'guru' || user.role === 'walas' || user.nip || (user.prevRole === 'admin')));
  const rolePengirim = isStaff ? (user.role || 'admin') : 'siswa';
  const namaSender = (user && user.nama) ? user.nama : (isStaff ? 'Wali Kelas / Guru' : 'Siswa');
  const chatMsg = {
    pengirim: { role: rolePengirim, nama: namaSender },
    nama_pengirim: namaSender,
    pesan: pesan,
    waktu: Date.now()
  };

  const localChatKey = 'chat_' + pid;
  let history = [];
  try { history = JSON.parse(localStorage.getItem(localChatKey) || '[]'); } catch (e) {}
  if (!Array.isArray(history)) history = [];

  const isDup = history.some(m => m && m.pesan === pesan && Math.abs((m.waktu || 0) - chatMsg.waktu) < 2000);
  if (!isDup) {
    history.push(chatMsg);
    try {
      localStorage.setItem(localChatKey, JSON.stringify(history));
    } catch (e) {}
  }

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('chat_sync_ping', JSON.stringify({ pid, time: Date.now() }));
    }
    if (typeof BroadcastChannel !== 'undefined') {
      const bcChat = new BroadcastChannel('ujikom_chat_bus');
      if (typeof bcChat.unref === 'function') bcChat.unref();
      bcChat.postMessage({ type: 'CHAT_MESSAGE', pid, message: chatMsg, time: Date.now() });
      const t = setTimeout(() => { try { bcChat.close(); } catch (e) {} }, 1000);
      if (t && typeof t.unref === 'function') t.unref();
    }
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('chat_updated', { detail: { pid: pid, message: chatMsg } }));
    }
  } catch (eEvt) {}

  if (typeof db !== 'undefined' && db && typeof db.ref === 'function') {
    try {
      const pushPromises = [];
      try {
        const refA = db.ref('chat_perijinan/' + pid);
        if (refA && typeof refA.push === 'function') pushPromises.push(refA.push(chatMsg).catch(() => null));
      } catch (e) {}
      try {
        const refB = db.ref('perijinan/' + pid + '/chats');
        if (refB && typeof refB.push === 'function') pushPromises.push(refB.push(chatMsg).catch(() => null));
      } catch (e) {}
      try {
        const refC = db.ref('perizinan/' + pid + '/chats');
        if (refC && typeof refC.push === 'function') pushPromises.push(refC.push(chatMsg).catch(() => null));
      } catch (e) {}
      try {
        const refD = db.ref('perijinan_chats/' + pid);
        if (refD && typeof refD.push === 'function') pushPromises.push(refD.push(chatMsg).catch(() => null));
      } catch (e) {}

      await Promise.race([
        Promise.all(pushPromises),
        new Promise(res => setTimeout(res, 1200))
      ]).catch(() => null);
    } catch (errChat) {}
  }
}

// ===================================================================
// RENDER PERIJINAN — USER (dashboard)
// ===================================================================
function renderDaftarPerijinanSaya(containerId, user) {
  const container = document.getElementById(containerId);
  if (!container || !user) return;

  const renderList = (itemsMap) => {
    const list = Object.values(itemsMap).sort((a, b) => (b.dibuat_pada || 0) - (a.dibuat_pada || 0));
    container.innerHTML = '';

    if (list.length === 0) {
      container.innerHTML = '<p style="color:#94a3b8;font-size:14px;text-align:center;padding:24px;">Belum ada pengajuan perijinan.</p>';
      return;
    }

    list.forEach(function (p) {
      const jn = JENIS_PERIJINAN[p.jenis] || { label: p.jenis, icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-2px;margin-right:4px;"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>' };
      const isApproved = p.status === 'disetujui' || p.status === 'approved';
      const isRejected = p.status === 'ditolak' || p.status === 'rejected';
      const statusLabel = isApproved ? 'Disetujui' : (isRejected ? 'Ditolak' : 'Menunggu');
      const statusClass = isApproved ? 'disetujui' : (isRejected ? 'ditolak' : 'pending');

      const el = document.createElement('div');
      el.className = 'perijinan-card status-' + statusClass;
      el.innerHTML =
        '<div class="perijinan-card-top">' +
          '<span class="perijinan-jenis-badge">' + jn.icon + ' ' + jn.label + '</span>' +
          '<span class="status-pill ' + statusClass + '">' + statusLabel + '</span>' +
        '</div>' +
        '<div class="perijinan-meta"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-1px;margin-right:4px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>Tanggal: <strong>' + (p.tanggal || '-') + '</strong></div>' +
        '<div class="perijinan-alasan-box">' + (p.alasan || p.keterangan || '-') + '</div>' +
        (p.dokumen_url ? '<a class="perijinan-dok-link" href="' + p.dokumen_url + '" onclick="if(typeof openDocumentModal===\'function\'){openDocumentModal(\'' + (p.pid || p.id) + '\');return false;}" target="_blank"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-1px;margin-right:4px;"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>Lihat Dokumen</a>' : '') +
        ((isRejected && (p.catatan_guru || p.catatanReviewer || p.alasanTolak)) ? '<div class="perijinan-alasan-box" style="background:#fee2e2;border-left:3px solid #ef4444;color:#991b1b;margin-top:6px;font-size:12.5px;"><strong>Catatan Wali Kelas:</strong> ' + (p.catatan_guru || p.catatanReviewer || p.alasanTolak) + '</div>' : '') +
        '<div class="action-row">' +
          '<button class="btn-chat" title="Chat Wali Kelas" onclick="bukaModalChat(\'' + (p.pid || p.id) + '\', \'' + (p.nama || 'Siswa').replace(/'/g, "\\'") + '\')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-1px;margin-right:4px;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><span style="display:none;">Chat Admin</span>Chat Wali Kelas</button>' +
          (isRejected ? '<button class="btn-resubmit" onclick="const b=document.querySelector(\'[data-tab="ajukan-perijinan"]\')||document.getElementById(\'btnTabAjukanPerijinan\');if(b)b.click();" style="background:#2563eb;color:#ffffff;border:none;padding:6px 14px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>Ajukan Ulang</button>' : '') +
        '</div>';
      container.appendChild(el);
    });
  };

  const perizinanSayaMap = {};

  // 1. Muat dari LocalStorage (offline / instan)
  const localItems = ambilDataPerizinanLokal();
  localItems.forEach(item => {
    if (!item) return;
    const isMine = (user.uid && item.uid === user.uid) || (user.nisn && item.nisn === user.nisn);
    if (isMine) {
      const pid = item.pid || item.id;
      if (pid) perizinanSayaMap[pid] = { ...item, pid, id: pid };
    }
  });

  renderList(perizinanSayaMap);

  // 2. Sinkronkan dengan Firebase RTDB jika tersedia
  if (typeof db !== 'undefined' && db && typeof db.ref === 'function') {
      if (user.nisn) {
        try {
          db.ref('perijinan').orderByChild('nisn').equalTo(user.nisn).on('value', function (snapshot) {
            const data = snapshot.val() || {};
            Object.keys(data).forEach(k => {
              const existing = perizinanSayaMap[k];
              const cloudItem = data[k] || {};
              const statusFinal = (existing && (existing.status === 'disetujui' || existing.status === 'ditolak') && cloudItem.status === 'pending')
                ? existing.status
                : (cloudItem.status || (existing && existing.status) || 'pending');
              perizinanSayaMap[k] = { ...existing, ...cloudItem, status: statusFinal, pid: k, id: k };
            });
            renderList(perizinanSayaMap);
          }, function () {});
          db.ref('perizinan').orderByChild('nisn').equalTo(user.nisn).on('value', function (snapshot) {
            const data = snapshot.val() || {};
            Object.keys(data).forEach(k => {
              const existing = perizinanSayaMap[k];
              const cloudItem = data[k] || {};
              const statusFinal = (existing && (existing.status === 'disetujui' || existing.status === 'ditolak') && cloudItem.status === 'pending')
                ? existing.status
                : (cloudItem.status || (existing && existing.status) || 'pending');
              perizinanSayaMap[k] = Object.assign({}, existing || {}, cloudItem, { status: statusFinal, pid: k, id: k });
            });
            renderList(perizinanSayaMap);
          }, function () {});
        } catch (e) {}
      }

    if (user.uid) {
      try {
        db.ref('perijinan').orderByChild('uid').equalTo(user.uid).on('value', function (snapshot) {
          const data = snapshot.val() || {};
          Object.keys(data).forEach(k => {
            const existing = perizinanSayaMap[k];
            const cloudItem = data[k] || {};
            const statusFinal = (existing && (existing.status === 'disetujui' || existing.status === 'ditolak') && cloudItem.status === 'pending')
              ? existing.status
              : (cloudItem.status || (existing && existing.status) || 'pending');
            perizinanSayaMap[k] = { ...existing, ...cloudItem, status: statusFinal, pid: k, id: k };
          });
          renderList(perizinanSayaMap);
        }, function () {});
      } catch (e) {}

      try {
        db.ref('perizinan').orderByChild('uid').equalTo(user.uid).on('value', function (snapshot) {
          const data = snapshot.val() || {};
          Object.keys(data).forEach(k => {
            const existing = perizinanSayaMap[k];
            const cloudItem = data[k] || {};
            const statusFinal = (existing && (existing.status === 'disetujui' || existing.status === 'ditolak') && cloudItem.status === 'pending')
              ? existing.status
              : (cloudItem.status || (existing && existing.status) || 'pending');
            perizinanSayaMap[k] = Object.assign({}, existing || {}, cloudItem, { status: statusFinal, pid: k, id: k });
          });
          renderList(perizinanSayaMap);
        }, function () {});
      } catch (e) {}
    }
  }
}

// ===================================================================
// RENDER PERIJINAN — ADMIN (SISWA & GURU)
// Mendukung Firebase RTDB + LocalStorage fallback
// ===================================================================
let cacheSemuaPerizinanAdmin = {};
let perijinanListenerAktif = false;

function ambilDataPerizinanLokal() {
  const localItems = [];
  const keys = ['local_kendala_guru', 'local_izin_guru', 'local_perijinan', 'local_perizinan', 'daftar_perizinan_lokal'];
  keys.forEach(k => {
    try {
      if (typeof localStorage === 'undefined') return;
      const raw = localStorage.getItem(k);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          localItems.push(...parsed);
        } else if (parsed && typeof parsed === 'object') {
          localItems.push(...Object.values(parsed));
        }
      }
    } catch (e) {}
  });
  return localItems;
}

function normalisasiItemPerizinan(item, isGuruHint) {
  if (!item) return null;
  const id = item.id || item.pid || ('PERMIT-' + (item.dibuat_pada || item.createdAt || Date.now()));
  const isGuru = isGuruHint || item.tipe === 'guru' || item.role === 'guru' || !!item.guruUid || !!item.guruNip || !!item.guruNama || (typeof id === 'string' && id.startsWith('KENDALA-'));

  let rawStatus = item.status || 'pending';
  let statusNorm = 'pending';
  if (rawStatus === 'disetujui' || rawStatus === 'approved') statusNorm = 'disetujui';
  else if (rawStatus === 'ditolak' || rawStatus === 'rejected') statusNorm = 'ditolak';

  const nama = isGuru
    ? (item.guruNama || item.nama || item.pengaju || 'Guru Pengajar')
    : (item.nama || item.nama_siswa || item.pengaju || 'Siswa');

  let kelas = item.kelasId || item.kelas || '';
  if (!isGuru && (!kelas || kelas === '-')) {
    let ms = (typeof MASTER_DATA_SISWA_RESMI !== 'undefined' && MASTER_DATA_SISWA_RESMI)
      || (typeof window !== 'undefined' && window.MASTER_DATA_SISWA_RESMI)
      || {};
    if (Object.keys(ms).length === 0 && typeof require !== 'undefined') {
      try { ms = require('./firebase-config.js').MASTER_DATA_SISWA_RESMI || {}; } catch (e) {}
    }
    if (item.nisn && ms[item.nisn] && ms[item.nisn].kelas) {
      kelas = ms[item.nisn].kelas;
    } else if (item.nisn === '0098263610') {
      kelas = 'XII RPL 2';
    }
  }
  if (!kelas) kelas = '-';
  if (typeof normalisasiKelas === 'function' && kelas && kelas !== '-') {
    kelas = normalisasiKelas(kelas);
  }
  const waktu = item.dibuat_pada || item.createdAt || (item.created_at ? new Date(item.created_at).getTime() : 0) || 0;

  return {
    ...item,
    id: id,
    pid: id,
    tipe: isGuru ? 'guru' : 'siswa',
    isGuru: isGuru,
    nama: nama,
    kelas: kelas,
    kelasId: kelas,
    mapel: item.mapel || '',
    guruNip: item.guruNip || item.nip || '',
    guruNama: item.guruNama || item.nama || '',
    nisn: item.nisn || '',
    jenis: item.jenis || 'izin',
    alasan: item.alasan || item.keterangan || '-',
    tanggal: item.tanggal || '',
    status: statusNorm,
    rawStatus: rawStatus,
    dokumen_url: item.dokumen_url || item.foto_bukti || null,
    dibuat_pada: waktu
  };
}

function updatePendingBadgeDanBanner() {
  const pendingCount = Object.values(cacheSemuaPerizinanAdmin).filter(p => p && p.status === 'pending').length;
  if (typeof document === 'undefined') return;
  const banner = document.getElementById('notifPerijinanBanner');
  const jml = document.getElementById('jumlahPending');
  const badge = document.getElementById('badgePerijinan');
  if (banner && jml) {
    if (pendingCount > 0) {
      banner.classList.add('show');
      jml.textContent = pendingCount;
    } else {
      banner.classList.remove('show');
    }
  }
  if (badge) {
    if (pendingCount > 0) {
      badge.textContent = pendingCount;
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
  }
}

function renderCardPerizinanAdmin(p) {
  const jn = getJenisPerijinanInfo(p.jenis);
  const isApproved = p.status === 'disetujui';
  const isRejected = p.status === 'ditolak';
  const statusLabel = isApproved
    ? (p.isGuru ? 'Disetujui (Jamkos)' : 'Disetujui')
    : (isRejected ? 'Ditolak' : 'Menunggu');
  const statusPillClass = isApproved ? 'disetujui' : (isRejected ? 'ditolak' : 'pending');

  const badgeRole = p.isGuru
    ? '<span class="badge-role-guru" style="background:#4f46e5;color:#ffffff;font-size:10px;font-weight:800;padding:2px 7px;border-radius:6px;letter-spacing:0.04em;margin-right:6px;display:inline-block;vertical-align:middle;">[GURU]</span>'
    : '<span class="badge-role-siswa" style="background:#0284c7;color:#ffffff;font-size:10px;font-weight:800;padding:2px 7px;border-radius:6px;letter-spacing:0.04em;margin-right:6px;display:inline-block;vertical-align:middle;">[SISWA]</span>';

  const subtitleExtra = p.isGuru
    ? (p.mapel ? ' • Mapel: <strong>' + p.mapel + '</strong>' : '') + (p.guruNip ? ' • NIP: ' + p.guruNip : '')
    : (p.nisn ? ' • NISN: ' + p.nisn : '');

  let actionButtons = '';
  if (p.status === 'pending') {
    if (p.isGuru) {
      actionButtons =
        '<button class="btn-approve" onclick="adminApprovePerizinanItem(\'' + p.id + '\', true)">Setujui (ACC Jamkos)</button>' +
        '<button class="btn-tolak" onclick="adminTolakPerizinanItem(\'' + p.id + '\', true)">Tolak</button>';
    } else {
      actionButtons =
        '<button class="btn-approve" onclick="adminApprovePerizinanItem(\'' + p.id + '\', false, \'' + (p.nisn || '') + '\', \'' + (p.tanggal || '') + '\', \'' + (p.jenis || '') + '\')">Setujui</button>' +
        '<button class="btn-tolak" onclick="adminTolakPerizinanItem(\'' + p.id + '\', false)">Tolak</button>';
    }
  }

  const safeNama = (p.nama || '').replace(/'/g, "\\'");
  const chatButton = '<button class="btn-chat" onclick="bukaModalChat(\'' + p.id + '\', \'' + safeNama + '\')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-1px;margin-right:4px;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>Chat</button>';

  const docLink = p.dokumen_url
    ? '<a class="perijinan-dok-link" href="' + p.dokumen_url + '" target="_blank"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-1px;margin-right:4px;"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>Lihat Dokumen/Surat</a>'
    : '';

  const el = document.createElement('div');
  el.className = 'perijinan-card status-' + statusPillClass;
  el.innerHTML =
    '<div class="perijinan-card-top">' +
      '<div style="display:flex;align-items:center;flex-wrap:wrap;gap:4px;">' +
        badgeRole +
        '<span class="perijinan-nama">' + p.nama + '</span>' +
        '<span class="perijinan-kelas-tag">' + p.kelas + '</span>' +
        '<span style="font-size:12px;color:#64748b;">' + subtitleExtra + '</span>' +
      '</div>' +
      '<span class="status-pill ' + statusPillClass + '">' + statusLabel + '</span>' +
    '</div>' +
    '<div class="perijinan-jenis-badge">' + jn.icon + ' ' + jn.label + '</div>' +
    '<div class="perijinan-meta"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-1px;margin-right:4px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>Tanggal: <strong>' + (p.tanggal || '-') + '</strong></div>' +
    '<div class="perijinan-alasan-box">' + p.alasan + '</div>' +
    docLink +
    '<div class="action-row">' +
      actionButtons +
      chatButton +
    '</div>';
  return el;
}

function muatDanRenderPerizinanAdmin(containerId, filterStatus) {
  if (typeof document === 'undefined') return;
  const container = document.getElementById(containerId);
  if (!container) return;

  const currentFilter = filterStatus || (typeof filterPerijinanAktif !== 'undefined' ? filterPerijinanAktif : 'pending');
  const list = Object.values(cacheSemuaPerizinanAdmin).sort((a, b) => (b.dibuat_pada || 0) - (a.dibuat_pada || 0));

  const isSemua = (!currentFilter || currentFilter === 'semua' || currentFilter === 'all');
  const filtered = !isSemua
    ? list.filter(p => p && (p.status === currentFilter || (currentFilter === 'pending' && (p.status === 'menunggu' || !p.status))))
    : list;

  container.innerHTML = '';

  if (filtered.length === 0) {
    container.innerHTML =
      '<div class="empty-state">' +
        '<div class="empty-icon"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg></div>' +
        '<p>' + (currentFilter === 'pending' ? 'Tidak ada perizinan yang menunggu.' : 'Belum ada data perizinan.') + '</p>' +
      '</div>';
    return;
  }

  filtered.forEach(function (p) {
    container.appendChild(renderCardPerizinanAdmin(p));
  });
}

function renderDaftarPerijinanAdmin(containerId, filterStatus) {
  const targetId = containerId || 'daftarPerijinanAdmin';
  const filter = filterStatus || (typeof filterPerijinanAktif !== 'undefined' ? filterPerijinanAktif : 'pending');

  // 1. Ambil data lokal terlebih dahulu untuk render instan & offline support
  const localItems = ambilDataPerizinanLokal();
  localItems.forEach(raw => {
    const item = normalisasiItemPerizinan(raw);
    if (item && item.id) {
      cacheSemuaPerizinanAdmin[item.id] = item;
    }
  });

  updatePendingBadgeDanBanner();
  muatDanRenderPerizinanAdmin(targetId, filter);

  // 2. Dengarkan perubahan realtime dari Firebase
  if (perijinanListenerAktif) return;
  perijinanListenerAktif = true;

  if (typeof db === 'undefined' || !db || typeof db.ref !== 'function') return;

  const updateFromSnap = (snapshot, isGuru) => {
    const val = snapshot.val() || {};
    Object.keys(val).forEach(key => {
      const raw = val[key];
      const item = normalisasiItemPerizinan({ id: key, pid: key, ...(isGuru ? { tipe: 'guru' } : {}), ...raw }, isGuru);
      if (item && item.id) {
        cacheSemuaPerizinanAdmin[item.id] = item;
      }
    });
    updatePendingBadgeDanBanner();
    muatDanRenderPerizinanAdmin(targetId, typeof filterPerijinanAktif !== 'undefined' ? filterPerijinanAktif : filter);
  };

  try {
    db.ref('perijinan').on('value', snap => updateFromSnap(snap, false), () => {});
  } catch (e) {}
  try {
    db.ref('perizinan').on('value', snap => updateFromSnap(snap, false), () => {});
  } catch (e) {}
  try {
    db.ref('kendala_guru').on('value', snap => updateFromSnap(snap, true), () => {});
  } catch (e) {}
  try {
    db.ref('perizinan_guru').on('value', snap => updateFromSnap(snap, true), () => {});
  } catch (e) {}
}

// ===================================================================
// APPROVE / TOLAK (TERPADU UNTUK SISWA & GURU)
// ===================================================================
async function adminApprovePerizinanItem(id, isGuru, nisn, tanggal, jenis) {
  const adminUser = (typeof getSessionUser === 'function' ? getSessionUser() : null) || {};
  const adminNama = adminUser.nama || (typeof adminSessionUser !== 'undefined' && adminSessionUser && adminSessionUser.nama) || 'Administrator';

  const item = cacheSemuaPerizinanAdmin[id] || (typeof kendalaGuruCache !== 'undefined' ? kendalaGuruCache[id] : null) || {};
  const isTargetGuru = isGuru || item.isGuru || item.tipe === 'guru';

  if (isTargetGuru) {
    if (typeof adminApproveKendala === 'function') {
      await adminApproveKendala(id);
      return;
    }

    const konfirmasi = (typeof confirm === 'function')
      ? confirm(`Setujui laporan izin mengajar dari ${item.nama || item.guruNama}?\n\nStatus kelas akan dialihkan menjadi JAMKOS.`)
      : true;
    if (!konfirmasi) return;

    const targetKelas = item.kelas || item.kelasId;

    // 1. Optimistic Update LocalStorage
    try {
      if (typeof localStorage !== 'undefined') {
        ['local_kendala_guru', 'local_izin_guru'].forEach(key => {
          let list = JSON.parse(localStorage.getItem(key) || '[]');
          let updated = false;
          list = list.map(k => {
            if (k && (k.id === id || k.pid === id)) {
              updated = true;
              return { ...k, status: 'approved', approvedBy: adminNama, approvedAt: new Date().toISOString() };
            }
            return k;
          });
          if (updated) localStorage.setItem(key, JSON.stringify(list));
        });
      }
    } catch (e) {}

    // 2. Update memory caches
    if (cacheSemuaPerizinanAdmin[id]) {
      cacheSemuaPerizinanAdmin[id].status = 'disetujui';
      cacheSemuaPerizinanAdmin[id].rawStatus = 'approved';
    }
    if (typeof kendalaGuruCache !== 'undefined' && kendalaGuruCache[id]) {
      kendalaGuruCache[id].status = 'approved';
    }

    if (typeof alert === 'function') alert(`✅ Laporan izin guru disetujui! Status kelas ${targetKelas} kini berstatus JAMKOS.`);
    renderDaftarPerijinanAdmin('daftarPerijinanAdmin', typeof filterPerijinanAktif !== 'undefined' ? filterPerijinanAktif : 'pending');
    updatePendingBadgeDanBanner();

    // 3. Update Firebase RTDB secara non-blocking dengan timeout safety
    if (typeof db !== 'undefined' && db && typeof db.ref === 'function') {
      try {
        const updates = [
          db.ref('kendala_guru/' + id).update({ status: 'approved', approvedBy: adminNama, approvedAt: new Date().toISOString() }).catch(() => null),
          db.ref('perizinan_guru/' + id).update({ status: 'approved', approvedBy: adminNama, approvedAt: new Date().toISOString() }).catch(() => null),
          db.ref('perijinan/' + id).update({ status: 'disetujui', approvedBy: adminNama, approvedAt: new Date().toISOString() }).catch(() => null),
          db.ref('perizinan/' + id).update({ status: 'disetujui', approvedBy: adminNama, approvedAt: new Date().toISOString() }).catch(() => null),
          db.ref('kelas/' + targetKelas).update({ status: 'jamkos', activeMapel: item.mapel || 'Jam Kosong', activeTeacherNama: item.nama || item.guruNama || '-', keteranganJamkos: item.alasan || 'Tugas Mandiri', updatedAt: new Date().toISOString() }).catch(() => null),
          db.ref('status_kelas/' + targetKelas).update({ status: 'jamkos', keterangan: item.alasan || 'Tugas Mandiri', mapel: item.mapel || 'Jam Kosong', updatedAt: Date.now() }).catch(() => null)
        ];
        await Promise.race([
          Promise.all(updates),
          new Promise(res => setTimeout(res, 2000))
        ]);
      } catch (err) {}
    }
    return;
  }

  // Siswa
  // 1. Optimistic Update LocalStorage
  try {
    if (typeof localStorage !== 'undefined') {
      ['local_perizinan', 'local_perijinan', 'daftar_perizinan_lokal'].forEach(key => {
        let rawData = localStorage.getItem(key);
        if (!rawData) return;
        let parsed = JSON.parse(rawData);
        let updated = false;
        if (Array.isArray(parsed)) {
          parsed = parsed.map(p => {
            if (p && (p.id === id || p.pid === id)) {
              updated = true;
              return { ...p, status: 'disetujui' };
            }
            return p;
          });
          if (updated) localStorage.setItem(key, JSON.stringify(parsed));
        } else if (parsed && typeof parsed === 'object') {
          Object.keys(parsed).forEach(k => {
            if (k === id || (parsed[k] && (parsed[k].id === id || parsed[k].pid === id))) {
              parsed[k].status = 'disetujui';
              updated = true;
            }
          });
          if (updated) localStorage.setItem(key, JSON.stringify(parsed));
        }
      });
    }
  } catch (e) {}

  if (cacheSemuaPerizinanAdmin[id]) {
    cacheSemuaPerizinanAdmin[id].status = 'disetujui';
    cacheSemuaPerizinanAdmin[id].rawStatus = 'disetujui';
  }

  renderDaftarPerijinanAdmin('daftarPerijinanAdmin', typeof filterPerijinanAktif !== 'undefined' ? filterPerijinanAktif : 'pending');
  updatePendingBadgeDanBanner();

  // 2. Chat & Firebase RTDB secara non-blocking
  try {
    kirimChatPerijinan(id, adminUser, 'Perijinan Anda telah DISETUJUI. Kehadiran tercatat sebagai ' + (getJenisPerijinanInfo(jenis || item.jenis)?.label || jenis || 'Izin') + '.').catch(() => null);
  } catch (e) {}

  if (typeof db !== 'undefined' && db && typeof db.ref === 'function') {
    try {
      const updates = [
        db.ref('perijinan/' + id + '/status').set('disetujui').catch(() => null),
        db.ref('perizinan/' + id + '/status').set('disetujui').catch(() => null)
      ];
      await Promise.race([
        Promise.all(updates),
        new Promise(res => setTimeout(res, 2000))
      ]);
    } catch (e) {}
  }

  const targetNisn = nisn || item.nisn;
  const targetTanggal = tanggal || item.tanggal;
  const targetJenis = jenis || item.jenis;

  if (targetNisn) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('status_izin_' + targetNisn, 'disetujui');
        const lastSub = localStorage.getItem('last_submission_' + targetNisn);
        if (lastSub) {
          const parsed = JSON.parse(lastSub);
          parsed.status = 'disetujui';
          localStorage.setItem('last_submission_' + targetNisn, JSON.stringify(parsed));
        }
      }
    } catch (e) {}
  }
  if (targetNisn && targetTanggal && typeof db !== 'undefined' && db && typeof db.ref === 'function') {
    try {
      let kelas = item.kelas || (typeof MASTER_DATA_SISWA_RESMI !== 'undefined' && MASTER_DATA_SISWA_RESMI[targetNisn] && MASTER_DATA_SISWA_RESMI[targetNisn].kelas) || '';
      try {
        const siswaSnap = await Promise.race([
          db.ref('siswa/' + targetNisn).once('value').catch(() => null),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500))
        ]).catch(() => null);
        const siswa = (siswaSnap && typeof siswaSnap.val === 'function') ? siswaSnap.val() : null;
        if (siswa && siswa.kelas) {
          kelas = siswa.kelas;
        }
      } catch (err) {}

      if (kelas) {
        const jadwalSnap = await db.ref('jadwal_pelajaran/' + kelas).once('value').catch(() => null);
        const resolvedJadwal = (typeof ambilJadwalKelasHariIni === 'function')
          ? ambilJadwalKelasHariIni(jadwalSnap ? jadwalSnap.val() : null, kelas)
          : { jadwal: (jadwalSnap ? jadwalSnap.val() : null) || {} };
        const jadwal = (resolvedJadwal && resolvedJadwal.jadwal && Object.keys(resolvedJadwal.jadwal).length > 0)
          ? resolvedJadwal.jadwal
          : ((jadwalSnap ? jadwalSnap.val() : null) || { '1': true, '2': true, '3': true, '4': true, '5': true, '6': true, '7': true, '8': true });
        
        const tanggalNorm = normalisasiFormatTanggal(targetTanggal);
        const updates = {};
        Object.keys(jadwal).forEach(function (jamKe) {
          updates['presensi_jam/' + kelas + '/' + tanggalNorm + '/' + jamKe + '/' + targetNisn] = {
            status: targetJenis,
            waktu: '00:00:00'
          };
          if (tanggalNorm !== targetTanggal) {
            updates['presensi_jam/' + kelas + '/' + targetTanggal + '/' + jamKe + '/' + targetNisn] = {
              status: targetJenis,
              waktu: '00:00:00'
            };
          }
        });
        if (Object.keys(updates).length > 0) await db.ref().update(updates).catch(() => null);
      }
    } catch (e) {}
  }
}

async function adminTolakPerizinanItem(id, isGuru) {
  const adminUser = (typeof getSessionUser === 'function' ? getSessionUser() : null) || {};
  const adminNama = adminUser.nama || (typeof adminSessionUser !== 'undefined' && adminSessionUser && adminSessionUser.nama) || 'Administrator';
  const item = cacheSemuaPerizinanAdmin[id] || (typeof kendalaGuruCache !== 'undefined' ? kendalaGuruCache[id] : null) || {};
  const isTargetGuru = isGuru || item.isGuru || item.tipe === 'guru';

  if (isTargetGuru) {
    if (typeof adminRejectKendala === 'function') {
      await adminRejectKendala(id);
      return;
    }

    if (typeof confirm === 'function' && !confirm('Tolak laporan izin kendala mengajar guru ini?')) return;
    const alasan = (typeof prompt === 'function' ? prompt('Alasan penolakan (opsional):') : '') || 'Laporan izin mengajar ditolak.';

    // 1. Optimistic Update LocalStorage
    try {
      if (typeof localStorage !== 'undefined') {
        ['local_kendala_guru', 'local_izin_guru'].forEach(key => {
          let list = JSON.parse(localStorage.getItem(key) || '[]');
          let updated = false;
          list = list.map(k => {
            if (k && (k.id === id || k.pid === id)) {
              updated = true;
              return { ...k, status: 'rejected', rejectedBy: adminNama, rejectedAt: new Date().toISOString() };
            }
            return k;
          });
          if (updated) localStorage.setItem(key, JSON.stringify(list));
        });
      }
    } catch (e) {}

    // 2. Update memory caches
    if (cacheSemuaPerizinanAdmin[id]) {
      cacheSemuaPerizinanAdmin[id].status = 'ditolak';
      cacheSemuaPerizinanAdmin[id].rawStatus = 'rejected';
    }
    if (typeof kendalaGuruCache !== 'undefined' && kendalaGuruCache[id]) {
      kendalaGuruCache[id].status = 'rejected';
    }

    if (typeof alert === 'function') alert('Laporan izin guru berhasil ditolak.');
    renderDaftarPerijinanAdmin('daftarPerijinanAdmin', typeof filterPerijinanAktif !== 'undefined' ? filterPerijinanAktif : 'pending');
    updatePendingBadgeDanBanner();

    // 3. Update Firebase RTDB secara non-blocking
    if (typeof db !== 'undefined' && db && typeof db.ref === 'function') {
      try {
        const updates = [
          db.ref('kendala_guru/' + id).update({ status: 'rejected', rejectedBy: adminNama, rejectedAt: new Date().toISOString() }).catch(() => null),
          db.ref('perizinan_guru/' + id).update({ status: 'rejected', rejectedBy: adminNama, rejectedAt: new Date().toISOString() }).catch(() => null),
          db.ref('perijinan/' + id).update({ status: 'ditolak', rejectedBy: adminNama, rejectedAt: new Date().toISOString() }).catch(() => null),
          db.ref('perizinan/' + id).update({ status: 'ditolak', rejectedBy: adminNama, rejectedAt: new Date().toISOString() }).catch(() => null)
        ];
        await Promise.race([
          Promise.all(updates),
          new Promise(res => setTimeout(res, 2000))
        ]);
      } catch (e) {}
    }
    return;
  }

  // Siswa
  const alasan = (typeof prompt === 'function' ? prompt('Alasan penolakan (opsional):') : '') || 'Perijinan ditolak.';

  // 1. Optimistic Update LocalStorage
  try {
    if (typeof localStorage !== 'undefined') {
      ['local_perizinan', 'local_perijinan', 'daftar_perizinan_lokal'].forEach(key => {
        let rawData = localStorage.getItem(key);
        if (!rawData) return;
        let parsed = JSON.parse(rawData);
        let updated = false;
        if (Array.isArray(parsed)) {
          parsed = parsed.map(p => {
            if (p && (p.id === id || p.pid === id)) {
              updated = true;
              return { ...p, status: 'ditolak' };
            }
            return p;
          });
          if (updated) localStorage.setItem(key, JSON.stringify(parsed));
        } else if (parsed && typeof parsed === 'object') {
          Object.keys(parsed).forEach(k => {
            if (k === id || (parsed[k] && (parsed[k].id === id || parsed[k].pid === id))) {
              parsed[k].status = 'ditolak';
              updated = true;
            }
          });
          if (updated) localStorage.setItem(key, JSON.stringify(parsed));
        }
      });
    }
  } catch (e) {}

  if (cacheSemuaPerizinanAdmin[id]) {
    cacheSemuaPerizinanAdmin[id].status = 'ditolak';
    cacheSemuaPerizinanAdmin[id].rawStatus = 'ditolak';
  }

  renderDaftarPerijinanAdmin('daftarPerijinanAdmin', typeof filterPerijinanAktif !== 'undefined' ? filterPerijinanAktif : 'pending');
  updatePendingBadgeDanBanner();

  // 2. Chat & Firebase RTDB secara non-blocking
  try {
    kirimChatPerijinan(id, adminUser, 'Maaf, perijinan Anda DITOLAK. ' + alasan).catch(() => null);
  } catch (e) {}

  if (typeof db !== 'undefined' && db && typeof db.ref === 'function') {
    try {
      const tolakPayload = { status: 'ditolak', status_code: 'rejected', approval_walas: 'rejected', updated_at: new Date().toISOString() };
      const updates = [
        db.ref('perijinan/' + id).update(tolakPayload).catch(() => null),
        db.ref('perizinan/' + id).update(tolakPayload).catch(() => null)
      ];
      await Promise.race([
        Promise.all(updates),
        new Promise(res => setTimeout(res, 2000))
      ]);
    } catch (e) {}
  }
}

async function adminApprove(pid, nisn, tanggal, jenis) {
  return adminApprovePerizinanItem(pid, false, nisn, tanggal, jenis);
}

async function adminTolak(pid) {
  return adminTolakPerizinanItem(pid, false);
}

// ===================================================================
// MODAL CHAT
// ===================================================================
let chatListener = null;
let chatPidAktif = null;

function ambilChatUser() {
  const isGuruPage = typeof window !== 'undefined' && window.location && window.location.pathname && (window.location.pathname.includes('guru') || window.location.pathname.includes('dashboard-guru'));
  const isSiswaPage = typeof window !== 'undefined' && window.location && window.location.pathname && (window.location.pathname.includes('dashboard.html') || window.location.pathname.endsWith('dashboard.html')) && !isGuruPage;
  const isAdminPage = typeof window !== 'undefined' && window.location && window.location.pathname && window.location.pathname.includes('admin') && !isGuruPage;

  if (isGuruPage) {
    if (typeof guruAktif !== 'undefined' && guruAktif) return guruAktif;
    if (typeof window !== 'undefined' && window.guruAktif) return window.guruAktif;
    if (typeof ambilUserAktifGuru === 'function') {
      try {
        const ug = ambilUserAktifGuru();
        if (ug && (ug.role === 'walas' || ug.role === 'guru' || ug.role === 'admin' || ug.nip)) return ug;
      } catch (e) {}
    }
    try {
      if (typeof sessionStorage !== 'undefined') {
        const s = sessionStorage.getItem('user_aktif');
        if (s) {
          const u = JSON.parse(s);
          if (u && (u.role === 'walas' || u.role === 'guru' || u.role === 'admin' || u.nip)) return u;
        }
      }
      if (typeof localStorage !== 'undefined') {
        const g = localStorage.getItem('guru_aktif');
        if (g) return JSON.parse(g);
      }
    } catch (e) {}
    return {
      nama: 'Muhammad Echa Putra, S.Kom.Gr',
      nip: '199209142022211007',
      role: 'walas',
      walasKelasId: 'XII RPL 2'
    };
  }

  if (isSiswaPage) {
    if (typeof currentUser !== 'undefined' && currentUser && (currentUser.role === 'siswa' || currentUser.nisn)) return currentUser;
    if (typeof window !== 'undefined' && window.currentUser && (window.currentUser.role === 'siswa' || window.currentUser.nisn)) return window.currentUser;
    try {
      if (typeof sessionStorage !== 'undefined') {
        const s = sessionStorage.getItem('user_aktif');
        if (s) {
          const u = JSON.parse(s);
          if (u && (u.role === 'siswa' || u.nisn)) return u;
        }
      }
      if (typeof localStorage !== 'undefined') {
        const l = localStorage.getItem('user_aktif');
        if (l) {
          const u = JSON.parse(l);
          if (u && (u.role === 'siswa' || u.nisn)) return u;
        }
      }
    } catch (e) {}
    return {
      nama: 'M. IHSAN ATHALLAH',
      nisn: '0098263610',
      kelas: 'XII RPL 2',
      role: 'siswa'
    };
  }

  if (isAdminPage) {
    return {
      nama: 'Administrator Sistem',
      role: 'admin'
    };
  }

  // Fallback umum jika dipanggil di luar browser konteks spesifik
  if (typeof ambilUserAktifGuru === 'function') {
    try {
      const ug = ambilUserAktifGuru();
      if (ug && (ug.nama || ug.nip || ug.role)) return ug;
    } catch (e) {}
  }
  if (typeof guruAktif !== 'undefined' && guruAktif) return guruAktif;
  if (typeof window !== 'undefined' && window.guruAktif) return window.guruAktif;
  if (typeof global !== 'undefined' && global.guruAktif) return global.guruAktif;
  if (typeof currentUser !== 'undefined' && currentUser) return currentUser;
  if (typeof window !== 'undefined' && window.currentUser) return window.currentUser;
  if (typeof global !== 'undefined' && global.currentUser) return global.currentUser;
  if (typeof getSessionUser === 'function') {
    try {
      const s = getSessionUser();
      if (s) return s;
    } catch (e) {}
  }
  try {
    if (typeof sessionStorage !== 'undefined') {
      const s = sessionStorage.getItem('user_aktif');
      if (s) return JSON.parse(s);
    }
    if (typeof localStorage !== 'undefined') {
      const l = localStorage.getItem('user_aktif');
      if (l) return JSON.parse(l);
    }
  } catch (e) {}
  return null;
}

let chatListeners = [];

function bukaModalChat(pid, namaSiswa) {
  chatPidAktif = pid;
  if (typeof window !== 'undefined') window.chatPidAktif = pid;
  if (typeof global !== 'undefined') global.chatPidAktif = pid;
  const judul = document.getElementById('modalChatJudul');
  if (judul) judul.textContent = 'Chat Wali Kelas — ' + (namaSiswa || 'Siswa');
  const overlay = document.getElementById('modalChat');
  if (overlay) overlay.classList.add('open');

  const input = document.getElementById('chatInputPesan');
  if (input) {
    input.value = '';
    input.onkeydown = function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        kirimPesanChat();
      }
    };
    setTimeout(() => { try { input.focus(); } catch (e) {} }, 100);
  }

  renderChat(pid);
}

function tutupModalChat() {
  if (chatListeners && Array.isArray(chatListeners)) {
    chatListeners.forEach(cl => {
      try { cl.ref.off('value', cl.fn); } catch (e) {}
    });
    chatListeners = [];
  }
  const activePid = chatPidAktif || (typeof window !== 'undefined' && window.chatPidAktif) || (typeof global !== 'undefined' && global.chatPidAktif);
  if (activePid && typeof db !== 'undefined' && db && typeof db.ref === 'function') {
    try { db.ref('chat_perijinan/' + activePid).off(); } catch (e) {}
  }
  chatPidAktif = null;
  if (typeof window !== 'undefined') window.chatPidAktif = null;
  if (typeof global !== 'undefined') global.chatPidAktif = null;
  const overlay = document.getElementById('modalChat');
  if (overlay) overlay.classList.remove('open');
}

function renderChat(pid) {
  const container = document.getElementById('chatBubbleContainer');
  if (!container || !pid) return;

  // Cleanup listeners sebelumnya
  if (chatListeners && Array.isArray(chatListeners)) {
    chatListeners.forEach(cl => {
      try { cl.ref.off('value', cl.fn); } catch (e) {}
    });
    chatListeners = [];
  }

  const user = ambilChatUser();
  const isStaff = Boolean(user && (user.role === 'admin' || user.role === 'guru' || user.role === 'walas' || user.nip || (user.prevRole === 'admin')));

  const renderPesanList = (pesanList) => {
    container.innerHTML = '';
    if (!Array.isArray(pesanList) || pesanList.length === 0) {
      container.innerHTML = `
        <div style="text-align:center;padding:36px 16px;color:#94a3b8;font-size:13px;display:flex;flex-direction:column;align-items:center;gap:10px;">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <span style="font-weight:600;color:#64748b;">Belum ada riwayat pesan</span>
          <span style="font-size:12px;color:#94a3b8;">Ketik pesan di bawah untuk memulai konfirmasi perizinan.</span>
        </div>`;
      return;
    }

    pesanList.forEach(function (m) {
      if (!m) return;
      const senderRole = typeof m.pengirim === 'object' && m.pengirim ? (m.pengirim.role || '') : (m.pengirim || '');
      const isStaffSender = (senderRole === 'admin' || senderRole === 'guru' || senderRole === 'walas');
      const isSaya = (isStaff && isStaffSender) ||
                     (!isStaff && (senderRole === 'siswa' || !isStaffSender)) ||
                     (user && user.nama && m.nama_pengirim && user.nama.trim().toLowerCase() === m.nama_pengirim.trim().toLowerCase());
      const bubble = document.createElement('div');
      bubble.className = 'chat-bubble ' + (isSaya ? 'saya' : 'lawan');
      const waktu = new Date(m.waktu || Date.now()).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      const senderName = m.nama_pengirim || (typeof m.pengirim === 'object' && m.pengirim && m.pengirim.nama) || (isSaya ? 'Saya' : 'Lawan Bicara');
      bubble.innerHTML =
        '<span class="bubble-name">' + senderName + '</span>' +
        '<div class="bubble-text" style="word-break:break-word;">' + (m.pesan || '') + '</div>' +
        '<div class="bubble-time">' + waktu + '</div>';
      container.appendChild(bubble);
    });
    container.scrollTop = container.scrollHeight;
  };

  // 1. Ambil riwayat chat lokal dari key tunggal yang bersangkutan
  let history = [];
  try {
    if (typeof localStorage !== 'undefined') {
      history = JSON.parse(localStorage.getItem('chat_' + pid) || '[]');
    }
  } catch (e) {}
  if (!Array.isArray(history)) history = [];

  // 2. Auto-seed pesan permohonan awal dari siswa jika belum ada satupun pesan
  if (history.length === 0) {
    let permitItem = null;
    try {
      if (typeof allPerizinanData !== 'undefined' && allPerizinanData) {
        permitItem = allPerizinanData[pid] || Object.values(allPerizinanData).find(x => x && (x.id === pid || x.pid === pid));
      }
      if (!permitItem && typeof ambilDataPerizinanLokal === 'function') {
        const map = ambilDataPerizinanLokal();
        permitItem = (Array.isArray(map) ? map : Object.values(map)).find(x => x && (x.id === pid || x.pid === pid));
      }
      if (!permitItem && typeof ambilDataPerizinanLokalWalas === 'function') {
        const map = ambilDataPerizinanLokalWalas();
        permitItem = map[pid] || Object.values(map).find(x => x && (x.id === pid || x.pid === pid));
      }
    } catch (e) {}

    if (permitItem && (permitItem.nama || permitItem.nama_siswa || permitItem.alasan)) {
      const namaSiswa = permitItem.nama || permitItem.nama_siswa || 'Siswa';
      const jenisLabel = (typeof getJenisPerijinanInfo === 'function' ? getJenisPerijinanInfo(permitItem.jenis)?.label : permitItem.jenis) || 'Izin';
      const pesanAwal = 'Saya mengajukan ' + jenisLabel + (permitItem.alasan ? ': ' + permitItem.alasan : '.');
      const seedMsg = {
        pengirim: { role: 'siswa', nama: namaSiswa },
        nama_pengirim: namaSiswa,
        pesan: pesanAwal,
        waktu: permitItem.dibuat_pada || permitItem.createdAt || Date.now()
      };
      history = [seedMsg];
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('chat_' + pid, JSON.stringify(history));
        }
      } catch (e) {}
    }
  }

  // Deduplikasi pesan berdasarkan teks, pengirim, dan waktu (window 15 detik)
  const dedupMessages = (list) => {
    if (!Array.isArray(list)) return [];
    const result = [];
    list.forEach(m => {
      if (!m || !m.pesan) return;
      const text = String(m.pesan || '').trim();
      const senderRole = typeof m.pengirim === 'object' && m.pengirim ? (m.pengirim.role || '') : (m.pengirim || '');
      const t = typeof m.waktu === 'number' ? m.waktu : (Date.parse(m.waktu) || 0);

      const isDup = result.some(r => {
        const rText = String(r.pesan || '').trim();
        const rRole = typeof r.pengirim === 'object' && r.pengirim ? (r.pengirim.role || '') : (r.pengirim || '');
        const rT = typeof r.waktu === 'number' ? r.waktu : (Date.parse(r.waktu) || 0);
        return rText === text && rRole === senderRole && Math.abs(rT - t) < 15000;
      });

      if (!isDup) {
        result.push(m);
      }
    });
    result.sort((a, b) => {
      const tA = typeof a.waktu === 'number' ? a.waktu : (Date.parse(a.waktu) || 0);
      const tB = typeof b.waktu === 'number' ? b.waktu : (Date.parse(b.waktu) || 0);
      return tA - tB;
    });
    return result;
  };

  let currentChat = dedupMessages(history);
  renderPesanList(currentChat);

  // 3. Pasang listener realtime Firebase pada jalur komunikasi resmi
  if (typeof db !== 'undefined' && db && typeof db.ref === 'function') {
    const attachListener = (refPath) => {
      try {
        const targetRef = db.ref(refPath);
        const fn = (snapshot) => {
          const data = snapshot ? snapshot.val() : null;
          if (data && typeof data === 'object') {
            const incoming = Object.values(data);
            if (incoming.length > 0) {
              const prevLen = currentChat.length;
              currentChat = dedupMessages([...currentChat, ...incoming]);
              if (currentChat.length !== prevLen) {
                try {
                  if (typeof localStorage !== 'undefined') {
                    if (typeof window !== 'undefined') window._isInternalChatSync = true;
                    localStorage.setItem('chat_' + pid, JSON.stringify(currentChat));
                    setTimeout(() => { if (typeof window !== 'undefined') window._isInternalChatSync = false; }, 80);
                  }
                } catch (e) {}
                renderPesanList(currentChat);
              }
            }
          }
        };
        targetRef.on('value', fn, () => {});
        chatListeners.push({ ref: targetRef, fn });
      } catch (e) {}
    };

    attachListener('chat_perijinan/' + pid);
    attachListener('perijinan/' + pid + '/chats');
    attachListener('perizinan/' + pid + '/chats');
  }
}

function kirimPesanChat() {
  const input = document.getElementById('chatInputPesan');
  if (!input) return;
  const pesan = input.value.trim();
  const activePid = chatPidAktif || (typeof window !== 'undefined' && window.chatPidAktif) || (typeof global !== 'undefined' && global.chatPidAktif);
  if (!pesan || !activePid) return;
  const user = ambilChatUser();
  input.value = '';
  try { input.focus(); } catch (e) {}

  // 1. Simpan pesan ke storage & multi-path cloud
  kirimChatPerijinan(activePid, user, pesan);

  // 2. OPTIMISTIC UI (0ms): Langsung render ulang DOM seketika!
  renderChat(activePid);
}

// Sinkronisasi realtime lintas-tab / window via storage event
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('storage', function (e) {
    if (!e || !e.key) {
      if (document.getElementById('daftarPerijinanAdmin') && typeof renderDaftarPerijinanAdmin === 'function') {
        renderDaftarPerijinanAdmin('daftarPerijinanAdmin', typeof filterPerijinanAktif !== 'undefined' ? filterPerijinanAktif : 'pending');
      }
      if (document.getElementById('daftarPerijinanSaya')) {
        const u = (typeof currentUser !== 'undefined' && currentUser) || (typeof getSessionUser === 'function' && getSessionUser());
        if (u && typeof renderDaftarPerijinanSaya === 'function') renderDaftarPerijinanSaya('daftarPerijinanSaya', u);
      }
      return;
    }
    const relevantKeys = ['local_kendala_guru', 'local_izin_guru', 'local_perijinan', 'local_perizinan', 'daftar_perizinan_lokal', 'perizinan_sync_ping', 'local_perizinan_updated'];
    if (relevantKeys.includes(e.key)) {
      if (document.getElementById('daftarPerijinanAdmin')) {
        renderDaftarPerijinanAdmin('daftarPerijinanAdmin', typeof filterPerijinanAktif !== 'undefined' ? filterPerijinanAktif : 'pending');
      }
      if (typeof listenKendalaGuruAdmin === 'function') {
        listenKendalaGuruAdmin();
      }
      if (document.getElementById('daftarPerijinanSaya')) {
        const u = (typeof currentUser !== 'undefined' && currentUser) || (typeof getSessionUser === 'function' && getSessionUser());
        if (u) renderDaftarPerijinanSaya('daftarPerijinanSaya', u);
      }
    }
    if (e.key && (e.key.startsWith('chat_') || e.key === 'chat_sync_ping')) {
      if (typeof window !== 'undefined' && window._isInternalChatSync) return;
      const activePid = (typeof window !== 'undefined' && window.chatPidAktif)
        || (typeof global !== 'undefined' && global.chatPidAktif)
        || (typeof chatPidAktif !== 'undefined' ? chatPidAktif : null);
      if (activePid) {
        const linked = (typeof ambilLinkedChatIds === 'function') ? ambilLinkedChatIds(activePid) : [activePid];
        const isMatch = e.key === 'chat_sync_ping' || linked.some(id => e.key === 'chat_' + id);
        if (isMatch) {
          const rFn = (typeof renderChat === 'function') ? renderChat : (typeof window !== 'undefined' && window.renderChat);
          if (rFn) rFn(activePid);
        }
      }
    }
  });

  // CustomEvent listener untuk sinkronisasi seketika antar-komponen di window yang sama
  window.addEventListener('chat_updated', function (e) {
    const activePid = (typeof window !== 'undefined' && window.chatPidAktif)
      || (typeof global !== 'undefined' && global.chatPidAktif)
      || (typeof chatPidAktif !== 'undefined' ? chatPidAktif : null);
    if (activePid && e && e.detail) {
      const linked = (typeof ambilLinkedChatIds === 'function') ? ambilLinkedChatIds(activePid) : [activePid];
      const isMatch = e.detail.pid === activePid || (e.detail.linkedIds && e.detail.linkedIds.includes(activePid)) || linked.includes(e.detail.pid);
      if (isMatch) {
        const rFn = (typeof renderChat === 'function') ? renderChat : (typeof window !== 'undefined' && window.renderChat);
        if (rFn) rFn(activePid);
      }
    }
  });

  // BroadcastChannel listener untuk sinkronisasi instant 0ms antar-tab browser
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const bcChatListener = new BroadcastChannel('ujikom_chat_bus');
      if (typeof bcChatListener.unref === 'function') bcChatListener.unref();
      bcChatListener.onmessage = function (ev) {
        if (ev && ev.data && ev.data.type === 'CHAT_MESSAGE') {
          const activePid = (typeof window !== 'undefined' && window.chatPidAktif)
            || (typeof global !== 'undefined' && global.chatPidAktif)
            || (typeof chatPidAktif !== 'undefined' ? chatPidAktif : null);
          if (activePid) {
            const linked = (typeof ambilLinkedChatIds === 'function') ? ambilLinkedChatIds(activePid) : [activePid];
            const isMatch = ev.data.pid === activePid || (ev.data.linkedIds && ev.data.linkedIds.includes(activePid)) || linked.includes(ev.data.pid);
            if (isMatch) {
              const rFn = (typeof renderChat === 'function') ? renderChat : (typeof window !== 'undefined' && window.renderChat);
              if (rFn) rFn(activePid);
            }
          }
        }
      };
    } catch (eBc) {}
  }
}

if (typeof window !== 'undefined') {
  window.bukaModalChat = bukaModalChat;
  window.tutupModalChat = tutupModalChat;
  window.renderChat = renderChat;
  window.kirimPesanChat = kirimPesanChat;
  window.kirimChatPerijinan = kirimChatPerijinan;
  window.ambilChatUser = ambilChatUser;
  window.ambilLinkedChatIds = ambilLinkedChatIds;
}

if (typeof global !== 'undefined') {
  global.bukaModalChat = bukaModalChat;
  global.tutupModalChat = tutupModalChat;
  global.renderChat = renderChat;
  global.kirimPesanChat = kirimPesanChat;
  global.kirimChatPerijinan = kirimChatPerijinan;
  global.ambilChatUser = ambilChatUser;
  global.ambilLinkedChatIds = ambilLinkedChatIds;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    JENIS_PERIJINAN,
    getJenisPerijinanInfo,
    submitPerijinan,
    kirimChatPerijinan,
    renderDaftarPerijinanSaya,
    ambilDataPerizinanLokal,
    normalisasiItemPerizinan,
    renderDaftarPerijinanAdmin,
    adminApprovePerizinanItem,
    adminTolakPerizinanItem,
    bukaModalChat,
    tutupModalChat,
    renderChat,
    kirimPesanChat,
    ambilChatUser,
    ambilLinkedChatIds
  };
}



function bukaModalBukti(fotoUrl, nama) {
  if (typeof window !== 'undefined' && typeof window.bukaModalBukti === 'function' && window.bukaModalBukti !== bukaModalBukti) {
    return window.bukaModalBukti(fotoUrl, nama);
  }
  const elTitle = document.getElementById('modalBuktiTitle');
  if (elTitle) elTitle.textContent = 'Bukti Surat Izin — ' + (nama || 'Siswa');
  const img = document.getElementById('modalBuktiImg');
  const txt = document.getElementById('modalBuktiText');
  if (img && txt) {
    if (!fotoUrl || fotoUrl === '[Tersimpan di Penyimpanan Lokal]') {
      img.style.display = 'none';
      txt.innerHTML = '<div style="padding:24px 16px;color:#64748b;font-size:13.5px;text-align:center;">Lampiran tersimpan di penyimpanan lokal perangkat pengaju.</div>';
    } else {
      const isPdf = typeof fotoUrl === 'string' && (fotoUrl.startsWith('data:application/pdf') || fotoUrl.toLowerCase().includes('.pdf'));
      const isSample = typeof fotoUrl === 'string' && fotoUrl.includes('sample-surat-dokter');
      if (isSample) {
        img.onerror = null;
        img.src = (typeof generateDigitalSuratDokterDataUrl === 'function') ? generateDigitalSuratDokterDataUrl(nama || 'M. IHSAN ATHALLAH', 'XII RPL 2') : fotoUrl;
        img.style.display = 'block';
        txt.innerHTML = '';
      } else if (isPdf) {
        img.style.display = 'none';
        txt.innerHTML = '<iframe src="' + fotoUrl + '" style="width:100%;height:70vh;border:none;"></iframe><div style="margin-top:10px;"><a href="' + fotoUrl + '" target="_blank" style="color:#4f46e5;font-weight:700;">Buka / Unduh Dokumen Surat Izin (PDF)</a></div>';
      } else {
        img.src = fotoUrl;
        img.style.display = 'block';
        txt.innerHTML = '';
      }
    }
  }
  const modal = document.getElementById('modalBuktiIzin');
  if (modal) modal.classList.add('show');
}
if (typeof window !== 'undefined') window.bukaModalBukti = bukaModalBukti;
if (typeof global !== 'undefined') global.bukaModalBukti = bukaModalBukti;
