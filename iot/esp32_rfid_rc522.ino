/*
  ESP32 / ESP8266 + RC522 RFID Presence Scanner
  SMKN 1 SUMEDANG — PROYEK PRESENSI KELAS IOT
  
  Komponen:
  - ESP32 NodeMCU / ESP8266
  - MFRC522 RFID Reader (SPI: SDA=5, SCK=18, MOSI=23, MISO=19, RST=22)
  - Buzzer (Pin 4) & Status LED (Pin 2)
  - Firebase Realtime Database
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <SPI.h>
#include <MFRC522.h>
#include <time.h>

// ===== KONFIGURASI KREDENSIAL DARI SECRETS.H =====
#include "secrets.h"

// Helper untuk menyematkan token autentikasi ke request Firebase Realtime Database
String getAuthQuery() {
  if (strlen(FIREBASE_AUTH_TOKEN) > 0) {
    return String("?auth=") + FIREBASE_AUTH_TOKEN;
  }
  return "";
}

// PIN RFID RC522 (ESP32)
#define SS_PIN  5
#define RST_PIN 22
#define BUZZER_PIN 4
#define LED_PIN 2

MFRC522 rfc(SS_PIN, RST_PIN);
unsigned long lastTapTime = 0;
String lastUID = "";

void setup() {
  Serial.begin(115200);
  SPI.begin();
  rfc.PCD_Init();
  
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(LED_PIN, LOW);

  Serial.println("\n[INIT] Menghubungkan ke WiFi...");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n[OK] WiFi Terhubung: " + WiFi.localIP().toString());

  // Konfigurasi Jam NTP (WIB = GMT+7)
  configTime(7 * 3600, 0, "pool.ntp.org", "time.google.com");
  
  // Beep startup 2x tanda siaga
  beep(100); delay(100); beep(100);
  Serial.println("[SIAGA] Scanner RFID SMKN 1 Sumedang Siap Menunggu Kartu...");
}

void loop() {
  if (!rfc.PICC_IsNewCardPresent() || !rfc.PICC_ReadCardSerial()) {
    delay(50);
    return;
  }

  // Baca UID kartu fisik dalam format HEX
  String uid = "";
  for (byte i = 0; i < rfc.uid.size; i++) {
    if (rfc.uid.uidByte[i] < 0x10) uid += "0";
    uid += String(rfc.uid.uidByte[i], HEX);
  }
  uid.toUpperCase();

  // Anti-Double Tap: Cooldown per-UID (5000 ms untuk kartu sama, 500 ms jeda antar-kartu berbeda)
  if (uid == lastUID && (millis() - lastTapTime < 5000)) {
    Serial.println("[TOLAK] Kartu baru saja di-tap (Anti-Double Tap per-UID).");
    rfc.PICC_HaltA();
    return;
  }
  if (uid != lastUID && (millis() - lastTapTime < 500)) {
    Serial.println("[TOLAK] Jeda minimum antar-kartu berbeda 500ms.");
    rfc.PICC_HaltA();
    return;
  }

  lastUID = uid;
  lastTapTime = millis();
  
  Serial.println("\n[TAP TERDETEKSI] UID: " + uid);
  digitalWrite(LED_PIN, HIGH);

  // Proses absensi ke Firebase
  prosesAbsensi(uid);

  digitalWrite(LED_PIN, LOW);
  rfc.PICC_HaltA();
  rfc.PCD_StopCrypto1();
}

void prosesAbsensi(String uid) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[ERR] WiFi terputus!");
    beepError();
    return;
  }

  // 0. Cek apakah ada permintaan pairing NFC aktif di Firebase
  HTTPClient httpPairing;
  String urlPairing = String(DATABASE_URL) + "/pairing_request.json" + getAuthQuery();
  httpPairing.begin(urlPairing);
  int codePairing = httpPairing.GET();
  if (codePairing == 200) {
    String payloadPairing = httpPairing.getString();
    httpPairing.end();
    if (payloadPairing != "null" && payloadPairing.indexOf("\"active\":true") != -1 && payloadPairing.indexOf("\"status\":\"waiting\"") != -1) {
      Serial.println("[PAIRING MODE] Penautan kartu UID " + uid + " ke pemohon...");
      
      // Parse timestamp dan validasi batas waktu 30 detik
      int tsIdx = payloadPairing.indexOf("\"timestamp\":");
      if (tsIdx != -1) {
        int tsStart = tsIdx + 12;
        int tsEnd = payloadPairing.indexOf(",", tsStart);
        if (tsEnd == -1) tsEnd = payloadPairing.indexOf("}", tsStart);
        if (tsEnd != -1) {
          String tsStr = payloadPairing.substring(tsStart, tsEnd);
          tsStr.trim();
          time_t nowEpoch = time(nullptr);
          if (nowEpoch > 1000000000) {
            long long reqTs = atoll(tsStr.c_str());
            long long nowMs = ((long long)nowEpoch) * 1000LL;
            if (reqTs > 0 && (nowMs - reqTs) > 30000LL) {
              Serial.println("[PAIRING EXPIRED] Permintaan pairing telah kedaluwarsa (>30 detik).");
              HTTPClient httpStatusExp;
              httpStatusExp.begin(urlPairing);
              httpStatusExp.addHeader("Content-Type", "application/json");
              httpStatusExp.sendRequest("PATCH", "{\"active\":false,\"status\":\"expired\"}");
              httpStatusExp.end();
              beepError();
              return;
            }
          }
        }
      }

      int roleIdx = payloadPairing.indexOf("\"role\":\"");
      String role = "siswa";
      if (roleIdx != -1) {
        int rStart = roleIdx + 8;
        int rEnd = payloadPairing.indexOf("\"", rStart);
        if (rEnd != -1) role = payloadPairing.substring(rStart, rEnd);
      }
      
      int userIdx = payloadPairing.indexOf("\"userId\":\"");
      String userId = "";
      if (userIdIdx != -1) {
        int uStart = userIdx + 10;
        int uEnd = payloadPairing.indexOf("\"", uStart);
        if (uEnd != -1) userId = payloadPairing.substring(uStart, uEnd);
      }

      int namaIdx = payloadPairing.indexOf("\"nama\":\"");
      String nama = "";
      if (namaIdx != -1) {
        int nStart = namaIdx + 8;
        int nEnd = payloadPairing.indexOf("\"", nStart);
        if (nEnd != -1) nama = payloadPairing.substring(nStart, nEnd);
      }

      int kelasIdx = payloadPairing.indexOf("\"kelas\":\"");
      String kelas = "XII RPL 2";
      if (kelasIdx != -1) {
        int kStart = kelasIdx + 9;
        int kEnd = payloadPairing.indexOf("\"", kStart);
        if (kEnd != -1) kelas = payloadPairing.substring(kStart, kEnd);
      }

      int mapelIdx = payloadPairing.indexOf("\"mapel\":\"");
      String mapel = "";
      if (mapelIdx != -1) {
        int mStart = mapelIdx + 9;
        int mEnd = payloadPairing.indexOf("\"", mStart);
        if (mEnd != -1) mapel = payloadPairing.substring(mStart, mEnd);
      }

      int walasIdx = payloadPairing.indexOf("\"walasKelasId\":\"");
      String walasKelasId = "";
      if (walasIdx != -1) {
        int wStart = walasIdx + 16;
        int wEnd = payloadPairing.indexOf("\"", wStart);
        if (wEnd != -1) walasKelasId = payloadPairing.substring(wStart, wEnd);
      }
      
      time_t nowSec = time(nullptr);
      String linkedAtStr = String(nowSec) + "000";

      HTTPClient httpKartu;
      String urlKartuBinding = String(DATABASE_URL) + "/kartu/" + uid + ".json" + getAuthQuery();
      httpKartu.begin(urlKartuBinding);
      httpKartu.addHeader("Content-Type", "application/json");
      String bodyCard = "";
      if (role == "guru" || role == "walas") {
        bodyCard = "{\"uid\":\"" + uid + "\",\"tipe\":\"guru\",\"nip\":\"" + userId + "\",\"nama\":\"" + nama + "\",\"mapel\":\"" + mapel + "\",\"isWalas\":" + (role == "walas" ? "true" : "false") + ",\"walasKelasId\":\"" + walasKelasId + "\",\"linkedAt\":" + linkedAtStr + "}";
      } else {
        bodyCard = "{\"uid\":\"" + uid + "\",\"tipe\":\"siswa\",\"nisn\":\"" + userId + "\",\"nama\":\"" + nama + "\",\"kelas\":\"" + kelas + "\",\"linkedAt\":" + linkedAtStr + "}";
      }
      httpKartu.PUT(bodyCard);
      httpKartu.end();

      // Sinkronkan ke node terproteksi /rfid_map/{uid} (SEC-03)
      HTTPClient httpRfidMap;
      String urlRfidMapBinding = String(DATABASE_URL) + "/rfid_map/" + uid + ".json" + getAuthQuery();
      httpRfidMap.begin(urlRfidMapBinding);
      httpRfidMap.addHeader("Content-Type", "application/json");
      httpRfidMap.PUT(bodyCard);
      httpRfidMap.end();
      
      HTTPClient httpStatus;
      httpStatus.begin(urlPairing);
      httpStatus.addHeader("Content-Type", "application/json");
      httpStatus.sendRequest("PATCH", "{\"active\":false,\"status\":\"success\",\"uid\":\"" + uid + "\"}");
      httpStatus.end();
      
      Serial.println("[PAIRING SUKSES] Kartu UID " + uid + " berhasil ditautkan!");
      beep(100); delay(70); beep(100); delay(70); beep(100);
      return;
    }
  } else {
    httpPairing.end();
  }

  // 1. Cari kartu pada node terproteksi /rfid_map/{uid} atau /kartu/{uid}
  HTTPClient http;
  String urlRfidMap = String(DATABASE_URL) + "/rfid_map/" + uid + ".json" + getAuthQuery();
  http.begin(urlRfidMap);
  int code = http.GET();
  String payload = "";
  if (code == 200) {
    payload = http.getString();
  }
  http.end();

  if (payload == "null" || payload == "") {
    String urlKartu = String(DATABASE_URL) + "/kartu/" + uid + ".json" + getAuthQuery();
    http.begin(urlKartu);
    code = http.GET();
    if (code == 200) {
      payload = http.getString();
    }
    http.end();
  }

  if (payload == "null" || payload == "") {
    Serial.println("[DITOLAK] Kartu UID " + uid + " BELUM TERDAFTAR di sistem!");
    beepError();
    return;
  }

  // Dapatkan Waktu Real-Time WIB
  time_t now = time(nullptr);
  struct tm* ptm = localtime(&now);
  char tglBuf[16], waktuBuf[16];
  sprintf(tglBuf, "%04d-%02d-%02d", ptm->tm_year + 1900, ptm->tm_mon + 1, ptm->tm_mday);
  sprintf(waktuBuf, "%02d:%02d:%02d", ptm->tm_hour, ptm->tm_min, ptm->tm_sec);

  // Periksa apakah kartu Guru / Kedinasan
  bool isGuru = (payload.indexOf("\"tipe\":\"guru\"") != -1 || payload.indexOf("\"nip\":") != -1);
  if (isGuru) {
    int nipIdx = payload.indexOf("\"nip\":\"");
    String nip = "";
    if (nipIdx != -1) {
      int start = nipIdx + 7;
      int end = payload.indexOf("\"", start);
      if (end != -1) nip = payload.substring(start, end);
    }

    int nIdx = payload.indexOf("\"nama\":\"");
    String namaGuru = "Guru Pengajar";
    if (nIdx != -1) {
      int start = nIdx + 8;
      int end = payload.indexOf("\"", start);
      if (end != -1) namaGuru = payload.substring(start, end);
    }

    int mIdx = payload.indexOf("\"mapel\":\"");
    String mapelGuru = "Pemrograman RPL";
    if (mIdx != -1) {
      int start = mIdx + 9;
      int end = payload.indexOf("\"", start);
      if (end != -1) mapelGuru = payload.substring(start, end);
    }

    int kIdx = payload.indexOf("\"kelas\":\"");
    String kelasTarget = "XII RPL 2";
    if (kIdx != -1) {
      int start = kIdx + 9;
      int end = payload.indexOf("\"", start);
      if (end != -1) kelasTarget = payload.substring(start, end);
    }

    Serial.println("[GURU DETECTED] " + namaGuru + " (NIP: " + nip + ")");
    
    // Tulis ke presensi_guru/{nip}/{tglBuf}
    String urlPresensiGuru = String(DATABASE_URL) + "/presensi_guru/" + nip + "/" + String(tglBuf) + ".json" + getAuthQuery();
    String bodyPresensiGuru = "{\"rfidUid\":\"" + uid + "\",\"nama\":\"" + namaGuru + "\",\"nip\":\"" + nip + "\",\"jamMasuk\":\"" + String(waktuBuf) + "\",\"status\":\"hadir\",\"mapel\":\"" + mapelGuru + "\",\"device_id\":\"" + String(DEVICE_ID) + "\"}";
    http.begin(urlPresensiGuru);
    http.addHeader("Content-Type", "application/json");
    http.PUT(bodyPresensiGuru);
    http.end();

    // Update status kelas menjadi belajar
    String urlKelasStatus = String(DATABASE_URL) + "/kelas/" + kelasTarget + ".json" + getAuthQuery();
    String bodyKelasStatus = "{\"status\":\"belajar\",\"activeMapel\":\"" + mapelGuru + "\",\"activeTeacherNama\":\"" + namaGuru + "\",\"activeTeacherId\":\"" + nip + "\"}";
    http.begin(urlKelasStatus);
    http.addHeader("Content-Type", "application/json");
    http.sendRequest("PATCH", bodyKelasStatus);
    http.end();

    Serial.println("[SUKSES] Presensi Guru tercatat & KBM " + kelasTarget + " AKTIF!");
    beepSuccess();
    return;
  }

  // Parse NISN Siswa
  int nisnIdx = payload.indexOf("\"nisn\":\"");
  if (nisnIdx == -1) {
    nisnIdx = payload.indexOf("\"nisn\": \"");
  }
  String nisn = "";
  if (nisnIdx != -1) {
    int start = payload.indexOf("\"", nisnIdx + 7) + 1;
    int end = payload.indexOf("\"", start);
    nisn = payload.substring(start, end);
  }

  if (nisn == "") {
    Serial.println("[ERR] Gagal parse NISN dari kartu.");
    beepError();
    return;
  }

  // Evaluasi Ambang Batas Waktu Presensi Sesuai Invarian SMKN 1 Sumedang:
  // <= 06:30:00 WIB: Hadir
  // 06:30:01 - 08:00:00 WIB: Terlambat
  String statusSiswa = "hadir";
  if (ptm->tm_hour > 6 || (ptm->tm_hour == 6 && (ptm->tm_min > 30 || (ptm->tm_min == 30 && ptm->tm_sec > 0)))) {
    statusSiswa = "terlambat";
  }

  Serial.println("[KARTU TERVERIFIKASI] Siswa NISN: " + nisn + " | Status: " + statusSiswa);

  // Multi-Path Atomic HTTP PATCH ke Firebase Realtime Database (FR-2.4)
  String urlRoot = String(DATABASE_URL) + "/.json" + getAuthQuery();
  String bodyPatch = "{"
    "\"absensi/" + String(tglBuf) + "/" + nisn + "\":{\"id\":\"abs_" + String(tglBuf) + "_" + nisn + "\",\"nisn\":\"" + nisn + "\",\"status\":\"" + statusSiswa + "\",\"waktu\":\"" + String(waktuBuf) + "\",\"jam\":\"" + String(waktuBuf) + "\",\"metode\":\"rfid_gateway\",\"uid_kartu\":\"" + uid + "\",\"device_id\":\"" + String(DEVICE_ID) + "\"},"
    "\"absensi/" + nisn + "/" + String(tglBuf) + "\":{\"tanggal\":\"" + String(tglBuf) + "\",\"waktu\":\"" + String(waktuBuf) + "\",\"status\":\"" + statusSiswa + "\",\"device_id\":\"" + String(DEVICE_ID) + "\"},"
    "\"tap_realtime/" + String(DEVICE_ID) + "\":{\"uid\":\"" + uid + "\",\"nisn\":\"" + nisn + "\",\"status\":\"" + statusSiswa + "\",\"device_id\":\"" + String(DEVICE_ID) + "\"},"
    "\"tap_realtime/latest\":{\"uid\":\"" + uid + "\",\"nisn\":\"" + nisn + "\",\"status\":\"" + statusSiswa + "\",\"device_id\":\"" + String(DEVICE_ID) + "\"},"
    "\"presensi_jam/XII RPL 2/" + String(tglBuf) + "/1/" + nisn + "\":{\"waktu\":\"" + String(waktuBuf) + "\",\"status\":\"" + statusSiswa + "\"},"
    "\"riwayat/" + String(tglBuf) + "/" + nisn + "\":{\"tanggal\":\"" + String(tglBuf) + "\",\"waktu\":\"" + String(waktuBuf) + "\",\"status\":\"" + statusSiswa + "\",\"device_id\":\"" + String(DEVICE_ID) + "\"}"
  "}";

  http.begin(urlRoot);
  http.addHeader("Content-Type", "application/json");
  int postCode = http.sendRequest("PATCH", bodyPatch);
  http.end();

  if (postCode == 200 || postCode == 201) {
    Serial.println("[SUKSES] Kehadiran tercatat: " + String(tglBuf) + " " + String(waktuBuf));
    beepSuccess();
  } else {
    Serial.println("[ERR] Gagal simpan ke Firebase. Code: " + String(postCode));
    beepError();
  }
}

void beep(int ms) {
  digitalWrite(BUZZER_PIN, HIGH);
  delay(ms);
  digitalWrite(BUZZER_PIN, LOW);
}

void beepSuccess() {
  beep(150);
}

void beepError() {
  beep(80); delay(60); beep(80); delay(60); beep(80);
}
