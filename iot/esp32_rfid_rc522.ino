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

// ===== KONFIGURASI WIFI & FIREBASE =====
const char* WIFI_SSID     = "Nesas_Hotspot";
const char* WIFI_PASSWORD = "password_sekolah";
const char* DATABASE_URL  = "https://absensi-6e385-default-rtdb.asia-southeast1.firebasedatabase.app";
const char* DEVICE_ID     = "gateway-rpl-01"; // Scanner Kelas XII RPL 2

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

  // Anti-Double Tap: Tolak jika kartu yang sama di-tap dalam jeda < 5 detik
  if (uid == lastUID && (millis() - lastTapTime < 5000)) {
    Serial.println("[TOLAK] Kartu baru saja di-tap (Anti-Double Tap).");
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

  HTTPClient http;
  String urlKartu = String(DATABASE_URL) + "/kartu/" + uid + ".json";
  
  http.begin(urlKartu);
  int code = http.GET();
  if (code != 200) {
    Serial.println("[ERR] Gagal query kartu. Code: " + String(code));
    beepError();
    http.end();
    return;
  }

  String payload = http.getString();
  http.end();

  if (payload == "null" || payload == "") {
    Serial.println("[DITOLAK] Kartu UID " + uid + " BELUM TERDAFTAR di sistem!");
    beepError();
    return;
  }

  // Parse NISN sederhana (format: {"nisn":"0098263610",...})
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

  Serial.println("[KARTU TERVERIFIKASI] Siswa NISN: " + nisn);

  // Dapatkan Waktu Real-Time WIB
  time_t now = time(nullptr);
  struct tm* ptm = localtime(&now);
  char tglBuf[16], waktuBuf[16];
  sprintf(tglBuf, "%04d-%02d-%02d", ptm->tm_year + 1900, ptm->tm_mon + 1, ptm->tm_mday);
  sprintf(waktuBuf, "%02d:%02d:%02d", ptm->tm_hour, ptm->tm_min, ptm->tm_sec);

  // Kirim data kehadiran ke Firebase Realtime Database
  String urlAbsensi = String(DATABASE_URL) + "/absensi/" + nisn + ".json";
  String body = "{\"tanggal\":\"" + String(tglBuf) + "\",\"waktu\":\"" + String(waktuBuf) + "\",\"status\":\"hadir\",\"device_id\":\"" + String(DEVICE_ID) + "\"}";
  
  http.begin(urlAbsensi);
  http.addHeader("Content-Type", "application/json");
  int postCode = http.POST(body);
  http.end();

  // Sinkronkan ke presensi kelas (XII RPL 2)
  String urlKelas = String(DATABASE_URL) + "/presensi_jam/XII RPL 2/" + String(tglBuf) + "/1/" + nisn + ".json";
  String bodyKelas = "{\"waktu\":\"" + String(waktuBuf) + "\",\"status\":\"hadir\"}";
  http.begin(urlKelas);
  http.addHeader("Content-Type", "application/json");
  http.PUT(bodyKelas);
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
