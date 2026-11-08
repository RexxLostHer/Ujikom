#ifndef SECRETS_H
#define SECRETS_H

// ===== TEMPLATE KREDENSIAL IOT GATEWAY ESP32 =====
// Salin berkas ini ke secrets.h dan isi dengan konfigurasi riil.
// JANGAN PERNAH menyertakan secrets.h ke dalam git tracking.

// Konfigurasi Jaringan WiFi Sekolah
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Endpoint Firebase Realtime Database
const char* DATABASE_URL  = "https://absensi-6e385-default-rtdb.asia-southeast1.firebasedatabase.app";
const char* DEVICE_ID     = "gateway-rpl-01"; // Identitas scanner

// Kredensial Firebase Authentication REST API
const char* FIREBASE_API_KEY    = "YOUR_FIREBASE_WEB_API_KEY";
const char* IOT_DEVICE_EMAIL    = "iot-gateway-01@smkn1sumedang.sch.id";
const char* IOT_DEVICE_PASSWORD = "YOUR_SECURE_IOT_PASSWORD";

// Token Autentikasi REST (?auth=<token>)
// Dapat diisi token statis rahasia atau di-generate via signInWithPassword
const char* FIREBASE_AUTH_TOKEN = "";

#endif // SECRETS_H
