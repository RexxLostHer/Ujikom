# PANDUAN INTEGRASI IoT PRESENSIA — SMK NEGERI 1 SUMEDANG
> **Dokumen Konteks untuk AI Coding Assistant & Developer IoT Gateway**  
> Dibuat untuk menghubungkan perangkat keras IoT (ESP32, Arduino RC522/PN532, Raspberry Pi) dengan platform Web Presensia.

---

## 1. Ringkasan Ekosistem Presensia
Presensia IoT adalah sistem presensi sekolah cerdas terintegrasi untuk **SMK Negeri 1 Sumedang** yang terdiri dari:
1. **Frontend Web & Dashboard** (`Ujikom`):
   - Dashboard Siswa, Dashboard Guru / Wali Kelas, dan Panel Administrator.
   - Layar monitor kelas langsung (`presensi-live.html`).
   - Fitur WhatsApp Presensia Chat Hub terenkripsi/terisolasi.
   - Modul perizinan (Sakit/Izin/Dispensasi) dengan aturan imutabilitas mutlak.
2. **Backend & Cloud Database**:
   - **Firebase Realtime Database (RTDB)** di region `asia-southeast1`.
   - **Database URL**: `https://absensi-6e385-default-rtdb.asia-southeast1.firebasedatabase.app`
   - **Project ID**: `absensi-6e385`
3. **IoT Gateway (Perangkat Keras)**:
   - Scanner RFID (RC522 / PN532) dan NFC terhubung ke ESP32 / Raspberry Pi di gerbang sekolah / pintu kelas.
   - Mengirimkan data tap kartu langsung ke Firebase Realtime Database.

---

## 2. Struktur Data Firebase RTDB yang Relevan untuk IoT

### A. Tabel Pemetaan Kartu RFID (`/kartu/{uid}`)
Setiap kartu fisik memiliki UID yang dipetakan ke identitas siswa (NISN) atau guru (NIP).
```json
{
  "kartu": {
    "006787337": {
      "nisn": "0098263610",
      "nama": "M. IHSAN ATHALLAH",
      "kelas": "XII RPL 2",
      "tipe": "siswa",
      "device_id": "esp32-gate-01"
    },
    "1058384422": {
      "nisn": "0082104129",
      "nama": "RIZKY RAMADANI",
      "kelas": "XII RPL 2",
      "tipe": "siswa",
      "device_id": "esp32-gate-01"
    },
    "A1B2C3D4": {
      "nisn": "0091113849",
      "nama": "AHSAN MAHMUD FAUZI YUSRY",
      "kelas": "XII RPL 1",
      "tipe": "siswa",
      "device_id": "esp32-gate-01"
    },
    "E5F6A7B8": {
      "nip": "198109012009022003",
      "nama": "Hani Hanifah, S.Si",
      "tipe": "guru",
      "mapel": "Pemrograman Web & Perangkat Bergerak"
    }
  }
}
```

### B. Pencatatan Kehadiran Harian (`/absensi/{nisn}/{tanggal}`)
Node tempat IoT menulis log kehadiran siswa:
- Path: `absensi/<NISN>/<YYYY-MM-DD>`
- Contoh payload:
```json
{
  "tanggal": "2026-10-29",
  "waktu": "06:25:10",
  "jam": "06:25:10",
  "status": "hadir",
  "metode": "rfid_gateway",
  "device_id": "esp32-gate-01",
  "uid_kartu": "006787337",
  "updated_at": 1793233510000
}
```

### C. Ringkasan Presensi Harian (`/presensi_harian/{tanggal}/{nisn}`)
- Path: `presensi_harian/<YYYY-MM-DD>/<NISN>`
- Digunakan untuk monitoring instan di web dashboard dan presensi live:
```json
{
  "nama": "M. IHSAN ATHALLAH",
  "kelas": "XII RPL 2",
  "status": "hadir",
  "waktu": "06:25:10",
  "metode": "rfid_gateway",
  "device_id": "esp32-gate-01"
}
```

### D. Penautan Kartu Mandiri (*Self-Enrollment / Pairing*) (`/pairing_request`)
Alur ketika pengguna mengklik "Verifikasi NFC HP / Kartu" di web:
1. Web menulis ke node `pairing_request`:
   ```json
   {
     "active": true,
     "userId": "0098263610",
     "role": "siswa",
     "nama": "M. IHSAN ATHALLAH",
     "kelas": "XII RPL 2",
     "status": "waiting",
     "timestamp": 1793233500000
   }
   ```
2. Saat kartu baru ditempelkan ke perangkat IoT dalam mode pairing, IoT membaca UID kartu, lalu:
   - Meng-update `pairing_request`:
     `{ "status": "success", "cardUid": "04A1B2C3", "completedAt": 1793233505000 }`
   - Menyimpan ke `kartu/04A1B2C3`:
     `{ "nisn": "0098263610", "nama": "M. IHSAN ATHALLAH", "kelas": "XII RPL 2", "tipe": "siswa" }`

---

## 3. Aturan Bisnis & Protokol Operasional (Wajib Diikuti)

1. **Zona Waktu WIB (`Asia/Jakarta`)**:
   - Seluruh evaluasi waktu harus merujuk ke zona waktu WIB (UTC+7).
2. **Kategori Jam Kedatangan**:
   - `waktu <= 06:30:00 WIB`: **Hadir Tepat Waktu** (`status: "hadir"`).
   - `waktu > 06:30:00 WIB`: **Terlambat** (`status: "terlambat"`).
   - Siswa yang belum tap kartu hingga lewat pukul 08:00 WIB dan tidak memiliki izin otomatis berstatus **Alpa** di sistem web.
3. **Aturan Imutabilitas Izin / Sakit (*Immutable Permit Rule*)**:
   - **PENTING**: Jika seorang siswa telah memiliki surat Izin, Sakit, atau Dispensasi yang disetujui wali kelas pada hari tersebut (`perijinan/{id}` status `disetujui`), **scan RFID susulan DILARANG KERAS mengubah status mereka menjadi Hadir/Terlambat/Alpa**.
4. **Anti-Double Tap (Cooldown)**:
   - Kartu yang sama di-tap berturut-turut dalam rentang kurang dari **5 detik** harus diabaikan oleh gateway guna mencegah double logging.

---

## 4. Berkas Jembatan JavaScript (`presensia-iot-contract.js`)
Berkas `presensia-iot-contract.js` telah disediakan di repository. Anda dapat mengimpor berkas ini langsung pada proyek Node.js:

```javascript
const {
  FIREBASE_IOT_CONFIG,
  processCardTap,
  getEsp32RestEndpoint,
  resolvePairingCompletion
} = require('./presensia-iot-contract.js');

// Contoh memproses tap kartu dari RFID reader:
const hasil = processCardTap('006787337', { deviceId: 'esp32-pos-piket' });
console.log(hasil);
// Output:
// {
//   success: true,
//   nisn: '0098263610',
//   nama: 'M. IHSAN ATHALLAH',
//   kelas: 'XII RPL 2',
//   status: 'hadir',
//   firebasePaths: { ... }
// }
```

---

## 5. Contoh Kode Implementasi untuk Firmware ESP32 (Arduino C++)

```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* ssid = "WIFI_SEKOLAH";
const char* password = "PASSWORD_WIFI";
const char* firebaseUrl = "https://absensi-6e385-default-rtdb.asia-southeast1.firebasedatabase.app";

void kirimPresensiRfid(String nisn, String tanggal, String waktu, String status, String uid) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    String endpoint = String(firebaseUrl) + "/absensi/" + nisn + "/" + tanggal + ".json";
    
    http.begin(endpoint);
    http.addHeader("Content-Type", "application/json");

    StaticJsonDocument<256> doc;
    doc["tanggal"] = tanggal;
    doc["waktu"] = waktu;
    doc["jam"] = waktu;
    doc["status"] = status;
    doc["metode"] = "rfid_gateway";
    doc["device_id"] = "esp32-pos-piket";
    doc["uid_kartu"] = uid;

    String requestBody;
    serializeJson(doc, requestBody);

    int httpResponseCode = http.PATCH(requestBody);
    Serial.printf("Status Firebase: %d\n", httpResponseCode);
    http.end();
  }
}
```

---

## 6. Riwayat Perubahan Terkini di Web (`Ujikom`)
- **Penambahan Siswa**: Siswa **Tifani Adisya Ramadhani** (NISN: `00082109`, Kelas: XII RPL 2) telah ditambahkan berdampingan dengan M. Ihsan Athallah.
- **Akun Utama Siswa Ihsan**: Akun `7dosabesar557@gmail.com` telah dikukuhkan sebagai akun primer untuk NISN `0098263610` (akun `zemapk16` telah dilepas role-nya).
- **Keamanan WhatsApp Chat Hub**: Ruang obrolan pribadi telah diamankan 100% dari kebocoran antar akun, dan akun yang belum terverifikasi diblokir dari akses chat.
- **Humanisasi Status Presensi**: Menggunakan istilah formal ramah siswa ("Hadir", "Terlambat", "Izin", "Sakit", "Alpa") tanpa tanda kurung artifisial.
