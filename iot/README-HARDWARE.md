# 📡 Panduan Hardware & Gateway IoT Presensi RFID
### SMK Negeri 1 Sumedang — Rekayasa Perangkat Lunak

Dokumen ini menjelaskan integrasi perangkat keras RFID reader ke sistem web presensi.

---

## 1. Pilihan Hardware yang Didukung

Sistem presensi ini mendukung 3 metode pembacaan kartu:
1. **Mikrokontroler ESP32 / ESP8266 + Modul RC522 (WiFi Standalone)**:
   - Terhubung langsung ke WiFi sekolah dan mengirim data langsung ke Firebase tanpa membutuhkan PC/laptop host.
   - Menggunakan sketch: [`iot/esp32_rfid_rc522.ino`](esp32_rfid_rc522.ino).
2. **Raspberry Pi + Modul RC522 SPI**:
   - Berjalan pada sistem Linux / Raspberry Pi OS dengan script Python.
   - Menggunakan script: [`iot/absensi_rpi.py`](absensi_rpi.py).
3. **USB RFID / NFC Reader (Plug and Play ke PC / Laptop)**:
   - Alat RFID USB reader (13.56 MHz atau 125 KHz) yang dicolokkan ke laptop guru/piket. Reader ini otomatis mengetikkan nomor UID kartu seperti keyboard (HID Keyboard Emulation) lalu menekan Enter.
   - Cukup jalankan `python iot/absensi_rpi.py` atau gunakan fitur **Simulasi & Input Scanner** di Panel Admin [`admin.html`](../admin.html).

---

## 2. Diagram Pin Wiring ESP32 ke RC522 RFID Reader

| Pin RC522 | Pin ESP32 (NodeMCU-32S) | Keterangan |
|---|---|---|
| **VCC** | **3.3V** *(Jangan ke 5V!)* | Sumber daya 3.3V |
| **RST** | **GPIO 22** | Reset Pin |
| **GND** | **GND** | Ground |
| **MISO** | **GPIO 19** | SPI Master In Slave Out |
| **MOSI** | **GPIO 23** | SPI Master Out Slave In |
| **SCK** | **GPIO 18** | SPI Clock |
| **SDA (SS)** | **GPIO 5** | SPI Slave Select |
| **Buzzer (+)** | **GPIO 4** *(GND ke GND)* | Notifikasi suara beep berhasil/gagal |
| **LED (+)** | **GPIO 2** *(resistor 220Ω ke GND)* | Indikator status scan aktif |

---

## 3. Alur Presensi Siswa: M. Ihsan Athallah & Rizky Ramadhani

1. **Pendaftaran UID Kartu**:
   - Di panel admin [`admin.html`](../admin.html) -> Tab **Kartu RFID**:
     - Masukkan UID kartu fisik yang dipegang M. Ihsan Athallah -> Pilih **M. IHSAN ATHALLAH** (`0098263610`).
     - Masukkan UID kartu fisik yang dipegang Rizky Ramadhani -> Pilih **RIZKY RAMADANI** (`0082104129`).
2. **Saat Siswa Melakukan Tap Kartu**:
   - Lampu LED berkedip dan buzzer berbunyi *Beep 1x*.
   - Gateway membaca UID -> mencocokkan ke database Firebase RTDB.
   - Data kehadiran tercatat dalam waktu **< 50 milidetik**.
3. **Hasil Tampilan Real-Time**:
   - Di [`dashboard.html`](../dashboard.html) dan [`presensi-live.html`](../presensi-live.html):
     - Nama siswa otomatis pindah ke kolom **"Sudah Hadir di Kelas"**.
     - Jam tap (misal `07:05 WIB`) langsung tampil.
     - Foto resmi siswa (`assets/foto/0098263610.jpg` atau `assets/foto/0082104129.jpg`) langsung muncul dengan bingkai status hijau.
