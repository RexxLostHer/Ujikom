/**
 * SEED DATA SISWA & JADWAL RESMI SMKN 1 SUMEDANG
 * Memastikan data siswa M. Ihsan Athallah dan Rizky Ramadhani,
 * jadwal pelajaran XII RPL 2, dan mapping kartu RFID terstruktur rapi.
 */

const SEED_DATA = {
  siswa: {
    "0098263610": {
      nama: "M. IHSAN ATHALLAH",
      kelas: "XII RPL 2",
      jurusan: "Rekayasa Perangkat Lunak",
      email: "ihsan.athallah@gmail.com"
    },
    "0082104129": {
      nama: "RIZKY RAMADANI",
      kelas: "XII RPL 2",
      jurusan: "Rekayasa Perangkat Lunak",
      email: "rizky.ramadhani@gmail.com"
    }
  },
  kartu: {
    "04A1B2C3": {
      nisn: "0098263610",
      device_id: "gateway-rpl-01",
      pemilik: "M. IHSAN ATHALLAH"
    },
    "04D4E5F6": {
      nisn: "0082104129",
      device_id: "gateway-rpl-01",
      pemilik: "RIZKY RAMADANI"
    }
  },
  jadwal: {
    "XII RPL 1": "15:30",
    "XII RPL 2": "15:30",
    "XII TKJ 1": "15:30"
  },
  jadwal_pelajaran: (function() {
    try {
      const util = require('../assets/jadwal-util.js');
      return util.MASTER_JADWAL_RESMI || {};
    } catch (e) {
      return {};
    }
  })(),
  email_mapping: {
    "ihsan,athallah(at)gmail,com": {
      nama: "M. IHSAN ATHALLAH",
      nisn: "0098263610",
      kelas: "XII RPL 2",
      role: "siswa"
    },
    "rizky,ramadhani(at)gmail,com": {
      nama: "RIZKY RAMADANI",
      nisn: "0082104129",
      kelas: "XII RPL 2",
      role: "siswa"
    }
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SEED_DATA;
}

console.log("Struktur Seed Data Siswa M. Ihsan Athallah & Rizky Ramadhani siap.");
