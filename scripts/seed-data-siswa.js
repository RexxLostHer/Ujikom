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
    "XII RPL 2": "15:30"
  },
  jadwal_pelajaran: {
    "XII RPL 2": {
      "1": { mapel: "Pemrograman Web & Perangkat Bergerak", guru: "Guru Pengajar RPL", mulai: "07:00", selesai: "07:45" },
      "2": { mapel: "Pemrograman Web & Perangkat Bergerak", guru: "Guru Pengajar RPL", mulai: "07:45", selesai: "08:30" },
      "3": { mapel: "Basis Data & Cloud Architecture", guru: "Guru Pengajar RPL", mulai: "08:30", selesai: "09:15" },
      "4": { mapel: "Basis Data & Cloud Architecture", guru: "Guru Pengajar RPL", mulai: "09:30", selesai: "10:15" },
      "5": { mapel: "Pemodelan Perangkat Lunak (UML)", guru: "Guru Pengajar RPL", mulai: "10:15", selesai: "11:00" },
      "6": { mapel: "Uji Kompetensi Keahlian (UKK Lab)", guru: "Guru Pengajar RPL", mulai: "11:00", selesai: "11:45" },
      "7": { mapel: "Produk Kreatif & Kewirausahaan", guru: "Guru Pengajar RPL", mulai: "12:45", selesai: "13:30" },
      "8": { mapel: "Produk Kreatif & Kewirausahaan", guru: "Guru Pengajar RPL", mulai: "13:30", selesai: "14:15" }
    }
  },
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
