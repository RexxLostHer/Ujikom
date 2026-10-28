/**
 * ===================================================================
 * PRESENSIA IoT CONTRACT & BRIDGE SDK
 * SMK Negeri 1 Sumedang — Sistem Presensi & IoT Gateway
 * ===================================================================
 * Modul ini berfungsi sebagai jembatan (bridge) resmi antara perangkat
 * IoT (ESP32, Raspberry Pi, Arduino RC522/PN532, Python Gateway) dengan
 * Web Platform Presensia (Firebase Realtime Database).
 *
 * Mendukung:
 * 1. Node.js Gateway / Serverless
 * 2. Standalone C++ ESP32 (Format REST API JSON)
 * 3. Python IoT Scanner Script
 * ===================================================================
 */

// 1. Konfigurasi Resmi Firebase Realtime Database
const FIREBASE_IOT_CONFIG = {
  apiKey: "AIzaSyBOQFp5SOvBTMpA_FEaMQyp0G4mmHfFa_c",
  authDomain: "absensi-6e385.firebaseapp.com",
  databaseURL: "https://absensi-6e385-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "absensi-6e385",
  storageBucket: "absensi-6e385.firebasestorage.app",
  messagingSenderId: "632114437491",
  appId: "1:632114437491:web:4b0c90ec78669e7cc0b906"
};

// 2. Daftar Kartu Fisik & Virtual Terdaftar (Default / Baseline)
const DAFTAR_KARTU_RFID_RESMI = {
  '006787337': {
    nisn: '0098263610',
    nama: 'M. IHSAN ATHALLAH',
    kelas: 'XII RPL 2',
    tipe: 'siswa',
    device_id: 'rpi-gateway-01'
  },
  '1058384422': {
    nisn: '0082104129',
    nama: 'RIZKY RAMADANI',
    kelas: 'XII RPL 2',
    tipe: 'siswa',
    device_id: 'rpi-gateway-01'
  },
  'A1B2C3D4': {
    nisn: '0091113849',
    nama: 'AHSAN MAHMUD FAUZI YUSRY',
    kelas: 'XII RPL 1',
    tipe: 'siswa',
    device_id: 'esp32-gate-01'
  },
  'E5F6A7B8': {
    nip: '198109012009022003',
    nama: 'Hani Hanifah, S.Si',
    tipe: 'guru',
    mapel: 'Pemrograman Web & Perangkat Bergerak',
    device_id: 'esp32-gate-01'
  },
  '04A1B2C3': {
    nisn: '0098263610',
    nama: 'M. IHSAN ATHALLAH',
    kelas: 'XII RPL 2',
    tipe: 'siswa',
    device_id: 'rc522-tester'
  },
  '04D4E5F6': {
    nisn: '0082104129',
    nama: 'RIZKY RAMADANI',
    kelas: 'XII RPL 2',
    tipe: 'siswa',
    device_id: 'rc522-tester'
  }
};

// 3. Batasan Waktu Operasional Presensi (WIB - Asia/Jakarta)
const ATURAN_WAKTU_PRESENSI = {
  TIMEZONE: 'Asia/Jakarta',
  JAM_BATAS_TEPAT_WAKTU: '06:30:00', // <= 06:30:00 = Hadir Tepat Waktu
  JAM_BATAS_GERBANG: '08:00:00',      // > 06:30 & <= 08:00 = Terlambat
  STATUS_LEWAT_BATAS: 'terlambat',    // Siswa tap setelah 08:00 tetap tercatat Terlambat (Bukan Hadir)
  COOLDOWN_TAP_DETIK: 5               // Anti-Double Tap / Cooldown
};

/**
 * Mendapatkan string tanggal dan waktu saat ini dalam format WIB (Asia/Jakarta)
 */
function getWibDateTime(customDate = new Date()) {
  const d = new Date(customDate);
  const formatterTgl = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const formatterWaktu = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  return {
    tanggal: formatterTgl.format(d), // YYYY-MM-DD
    waktu: formatterWaktu.format(d)   // HH:mm:ss
  };
}

// In-memory memory tracker untuk Anti-Double Tap (Cooldown)
const _lastTapMemory = new Map();

/**
 * Evaluasi Tap Kartu RFID / NFC oleh IoT Gateway
 * 
 * @param {string} cardUid UID Kartu RFID (misal: "006787337" atau "04A1B2C3")
 * @param {object} options Opsi proses { deviceId, timestamp, mockDb, permitList }
 * @returns {object} Hasil evaluasi dan payload Firebase yang harus di-update
 */
function processCardTap(cardUid, options = {}) {
  const cleanUid = String(cardUid || '').trim().toUpperCase();
  if (!cleanUid) {
    return { success: false, error: 'UID_KOSONG', message: 'UID Kartu RFID tidak boleh kosong.' };
  }

  const deviceId = options.deviceId || 'iot-gateway-default';
  const now = options.timestamp ? new Date(options.timestamp) : new Date();
  const { tanggal, waktu } = getWibDateTime(now);
  const nowSec = Math.floor(now.getTime() / 1000);

  // 1. Anti-Double Tap Cooldown
  const cooldownSec = typeof options.cooldownSeconds === 'number' ? options.cooldownSeconds : ATURAN_WAKTU_PRESENSI.COOLDOWN_TAP_DETIK;
  if (cooldownSec > 0 && _lastTapMemory.has(cleanUid)) {
    const lastSec = _lastTapMemory.get(cleanUid);
    if (nowSec - lastSec < cooldownSec) {
      return {
        success: false,
        error: 'COOLDOWN_ACTIVE',
        message: `Kartu ${cleanUid} baru saja di-tap (${nowSec - lastSec}s yang lalu). Mohon tunggu ${cooldownSec} detik.`,
        cooldownRemaining: cooldownSec - (nowSec - lastSec)
      };
    }
  }
  if (cooldownSec > 0) {
    _lastTapMemory.set(cleanUid, nowSec);
  }

  // 2. Pencarian Data Kartu di Database / Cache
  const dbCards = options.mockDb && options.mockDb.kartu ? options.mockDb.kartu : DAFTAR_KARTU_RFID_RESMI;
  const cardData = dbCards[cleanUid] || dbCards[cleanUid.toLowerCase()];

  if (!cardData) {
    return {
      success: false,
      error: 'UNREGISTERED_CARD',
      message: `Kartu dengan UID [${cleanUid}] belum terdaftar di sistem Presensia.`,
      uid: cleanUid,
      device_id: deviceId
    };
  }

  const isGuru = cardData.tipe === 'guru' || !!cardData.nip;
  const userIdentifier = isGuru ? cardData.nip : (cardData.nisn || cardData.userId);

  if (!userIdentifier) {
    return {
      success: false,
      error: 'CORRUPTED_CARD_DATA',
      message: `Data kartu [${cleanUid}] tidak memiliki NISN atau NIP terdaftar.`,
      uid: cleanUid
    };
  }

  // 3. Immutability Guard: Izin / Sakit yang telah disetujui TIDAK BOLEH ditimpa scan RFID
  if (!isGuru && options.permitList) {
    const activePermit = options.permitList.find(p => {
      const matchNisn = (p.nisn === userIdentifier || p.id === userIdentifier);
      const isApproved = (p.status === 'disetujui' || p.status === 'approved');
      const inRange = (!p.tanggal_mulai || p.tanggal_mulai <= tanggal) && (!p.tanggal_selesai || p.tanggal_selesai >= tanggal);
      return matchNisn && isApproved && inRange;
    });

    if (activePermit) {
      return {
        success: true,
        ignored: true,
        reason: 'APPROVED_PERMIT_ACTIVE',
        status: activePermit.jenis || 'izin',
        message: `Siswa ${cardData.nama} memiliki izin resmi (${activePermit.jenis || 'Izin'}) yang telah disetujui. Status presensi tidak ditimpa.`,
        nisn: userIdentifier,
        nama: cardData.nama,
        kelas: cardData.kelas
      };
    }
  }

  // 4. Penentuan Status Berdasarkan Jam Kedatangan (WIB)
  let status = 'hadir';
  if (waktu > ATURAN_WAKTU_PRESENSI.JAM_BATAS_TEPAT_WAKTU) {
    status = 'terlambat';
  }

  // 5. Pembentukan Payload Firebase RTDB
  const recordPayload = {
    tanggal: tanggal,
    waktu: waktu,
    jam: waktu,
    status: status,
    metode: 'rfid_gateway',
    device_id: deviceId,
    uid_kartu: cleanUid,
    updated_at: Date.now()
  };

  const firebasePaths = {
    [`absensi/${userIdentifier}/${tanggal}`]: recordPayload,
    [`presensi_harian/${tanggal}/${userIdentifier}`]: {
      ...recordPayload,
      nama: cardData.nama,
      kelas: cardData.kelas || '-'
    },
    [`gateway_logs/${Date.now()}_${cleanUid}`]: {
      device_id: deviceId,
      uid: cleanUid,
      target_id: userIdentifier,
      nama: cardData.nama,
      status: status,
      waktu: `${tanggal} ${waktu}`
    }
  };

  return {
    success: true,
    nisn: !isGuru ? userIdentifier : null,
    nip: isGuru ? userIdentifier : null,
    tipe: isGuru ? 'guru' : 'siswa',
    nama: cardData.nama,
    kelas: cardData.kelas || null,
    status: status,
    tanggal: tanggal,
    waktu: waktu,
    device_id: deviceId,
    uid: cleanUid,
    firebasePaths: firebasePaths,
    message: `Presensi ${isGuru ? 'Guru' : 'Siswa'} [${cardData.nama}] berhasil dicatat: ${status.toUpperCase()} (${waktu} WIB).`
  };
}

/**
 * Format URL & Payload untuk HTTP REST API ESP32 / Arduino / Python
 *
 * Contoh penggunaan pada ESP32 (Arduino C++):
 *   HTTPClient http;
 *   http.begin(client, restInfo.url);
 *   http.PATCH(restInfo.body);
 */
function getEsp32RestEndpoint(userIdentifier, tanggal, recordPayload) {
  const baseUrl = FIREBASE_IOT_CONFIG.databaseURL;
  return {
    url: `${baseUrl}/absensi/${userIdentifier}/${tanggal}.json`,
    body: JSON.stringify(recordPayload),
    method: 'PATCH'
  };
}

/**
 * Format Payload Penyelesaian Pairing Kartu Baru
 * Digunakan jika IoT Gateway sedang dalam mode membaca kartu untuk ditautkan ke akun web
 */
function resolvePairingCompletion(activePairingRequest, scannedCardUid) {
  if (!activePairingRequest || activePairingRequest.status !== 'waiting') {
    return null;
  }
  const cleanUid = String(scannedCardUid || '').trim().toUpperCase();
  return {
    pairingUpdate: {
      status: 'success',
      cardUid: cleanUid,
      completedAt: Date.now()
    },
    kartuUpdate: {
      [`kartu/${cleanUid}`]: {
        nisn: activePairingRequest.role === 'siswa' ? activePairingRequest.userId : null,
        nip: activePairingRequest.role !== 'siswa' ? activePairingRequest.userId : null,
        nama: activePairingRequest.nama,
        kelas: activePairingRequest.kelas || null,
        tipe: activePairingRequest.role,
        registeredAt: Date.now()
      }
    }
  };
}

// Export Modul (Universal Support: CommonJS & Browser/ES)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    FIREBASE_IOT_CONFIG,
    DAFTAR_KARTU_RFID_RESMI,
    ATURAN_WAKTU_PRESENSI,
    getWibDateTime,
    processCardTap,
    getEsp32RestEndpoint,
    resolvePairingCompletion
  };
}
if (typeof window !== 'undefined') {
  window.PresensiaIotContract = {
    FIREBASE_IOT_CONFIG,
    DAFTAR_KARTU_RFID_RESMI,
    ATURAN_WAKTU_PRESENSI,
    getWibDateTime,
    processCardTap,
    getEsp32RestEndpoint,
    resolvePairingCompletion
  };
}
