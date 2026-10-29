# FULL SESSION MEMORY & KNOWLEDGE BASE — PRESENSIA IoT
> **Memori Percakapan & Status Sistem Terakhir untuk AI Agent di Raspberry Pi**  
> Dihasilkan dari sesi kerja sama: `bbf1719b-fdd1-492a-885b-d3f3875e9798`  
> Proyek: **Presensia IoT — SMK Negeri 1 Sumedang**

---

## 1. Identitas Proyek & Ekosistem
- **Sekolah**: SMK Negeri 1 Sumedang (Kompetensi Keahlian Rekayasa Perangkat Lunak / RPL).
- **Aplikasi**: Sistem Presensi Digital & IoT Terintegrasi (Web Dashboard + RFID/NFC Hardware Gateway).
- **Cloud Database**: **Firebase Realtime Database (RTDB)** di region `asia-southeast1`.
  - **Database URL**: `https://absensi-6e385-default-rtdb.asia-southeast1.firebasedatabase.app`
  - **Project ID**: `absensi-6e385`
  - **Auth Domain**: `absensi-6e385.firebaseapp.com`
- **Zona Waktu Resmi**: `Asia/Jakarta` (WIB, UTC+7).

---

## 2. Riwayat Permintaan & Masalah yang Telah Diselesaikan (Full Changelog)

### A. Pelepasan Role Akun `zemapk16` & Pemetaan Tunggal `7dosabesar557`
- **Masalah Awal**: Akun `zemapk16@gmail.com` dan `7dosabesar557@gmail.com` sempat sama-sama terpetakan ke siswa M. Ihsan Athallah (`0098263610`), menyebabkan role ganda (*ke-double*).
- **Solusi**:
  - `zemapk16@gmail.com` dibebaskan total dari role siswa M. Ihsan dan dinetralkan kembali menjadi `pengunjung` (`nisn: null`, `kelas: null`).
  - `7dosabesar557@gmail.com` ditetapkan sebagai akun primer resmi untuk siswa M. Ihsan Athallah (`0098263610`, XII RPL 2).
  - Admin panel `ubahRoleUser` otomatis membersihkan `nisn_claimed` dan `email_mapping` saat user diubah ke pengunjung.

### B. Penambahan Siswa Baru di Kelas XII RPL 2
- Ditambahkan siswa: **TIFANI ADISYA RAMADHANI** (NISN: `00082109`, Kelas: XII RPL 2).
- Diposisikan berdampingan dengan M. Ihsan Athallah di seluruh data roster, tabel admin, dan database siswa.
- Foto profil siswa terpasang di `assets/foto/00082109.jpg`.

### C. Penguncian Akses WhatsApp Chat Hub untuk Akun Belum Terverifikasi (*Unverified Lock*)
- **Masalah Awal**: Akun pengunjung / belum verifikasi NISN/NIP sempat bisa membuka widget chat dan melihat obrolan kelas.
- **Solusi**:
  - Tombol floating chat untuk akun belum verifikasi menampilkan lencana gembok 🔒 (*locked*).
  - Jika diklik, sistem memblokir jendela chat dan menampilkan modal **"WhatsApp Presensia Terkunci"**.
  - Tombol **"Nanti Saja"**, tombol silang (**✕**), klik backdrop, dan tombol keyboard `Esc` telah dipasang event listener langsung (`onclick`) dan fungsi diekspor ke objek `window`.
  - Tombol aksi verifikasi langsung mengarahkan user ke formulir penautan NISN/NIP di profil.

### D. Perbaikan Privasi Obrolan 1-on-1 (*Anti-Bocor / Strict Private Chat*)
- **Masalah Awal**: Pesan obrolan pribadi (*direct chat*) sempat bocor atau terlihat oleh akun lain.
- **Penyebab**: Normalisasi ID sebelumnya memotong pengenal alfanumerik yang memiliki 4 digit angka menjadi angka saja (`user2026` -> `2026`), menimbulkan kolisi Room ID.
- **Solusi**:
  - Normalisasi ID diperbaiki: pengenal alfanumerik dipertahankan utuh, hanya NISN 10-digit dan NIP 18-digit yang dinormalkan murni angka.
  - Room ID direct chat bersifat deterministik dan simetris: `direct_${partA}_${partB}`.
  - Ditambahkan proteksi otorisasi `isUserInDirectRoom`: hanya 2 pihak yang bersangkutan yang diizinkan membuka, memuat riwayat, atau mengirim pesan di direct room tersebut.
  - Pergantian akun di tab lain seketika menutup obrolan aktif.
  - Balon chat dirapikan: pengirim di kanan (hijau/sent), penerima di kiri (putih/received), tanpa tag admin/grup.

### E. Humanisasi Status Kehadiran & Privasi Data
- Status kehadiran dimanusiakan dan bersih: tidak ada label kaku seperti `(izin)` atau `(sakit)`.
- Siswa yang belum tap kartu setelah batas waktu gerbang (08:00 WIB) otomatis tercatat sebagai `Terlambat` (bukan "Belum Absen").
- NISN disembunyikan dari kartu pantau publik demi privasi data siswa.

### F. Perbaikan Pemutaran Voice Note (VN)
- Ditambahkan Web Audio Synthesizer fallback dan audio buffer handling agar pesan suara dapat diputar dengan lancar tanpa error audio codec.

---

## 3. Aturan Bisnis & Protokol Presensi untuk Raspberry Pi IoT

1. **Jadwal & Penentuan Status Kehadiran (WIB)**:
   - Tap `<= 06:30:00 WIB`: **Hadir Tepat Waktu** (`status: "hadir"`).
   - Tap `> 06:30:00 WIB` s/d `08:00:00 WIB`: **Terlambat** (`status: "terlambat"`).
   - Lewat `08:00:00 WIB` tanpa tap dan tanpa izin: Otomatis tercatat **Alpa** di sistem web.
2. **Aturan Imutabilitas Surat Izin (*Immutable Permit Rule*)**:
   - Jika siswa memiliki surat Izin, Sakit, atau Dispensasi yang telah disetujui wali kelas pada hari tersebut (`perijinan/{id}` status `disetujui`), **scan RFID susulan DILARANG KERAS mengubah status mereka**.
3. **Anti-Double Tap (Cooldown)**:
   - Kartu yang sama di-tap dalam selang kurang dari 5 detik harus diabaikan oleh gateway.
4. **Alur Penautan Kartu Mandiri (*Pairing Request*)**:
   - Saat user klik tombol verifikasi kartu di web, web menulis ke `pairing_request` (status `waiting`).
   - Perangkat IoT saat mendeteksi kartu baru dalam mode pairing meng-update `pairing_request` menjadi `status: "success"` dan menyimpan UID kartu ke node `kartu/{uid}`.

---

## 4. Pemetaan Kartu RFID & Pengguna Kunci
- `006787337`: M. Ihsan Athallah (NISN: `0098263610`, XII RPL 2) — Siswa Primer
- `1058384422`: Rizky Ramadhani (NISN: `0082104129`, XII RPL 2) — Siswa
- `A1B2C3D4`: Ahsan Mahmud Fauzi Yusry (NISN: `0091113849`, XII RPL 1) — Siswa
- `E5F6A7B8`: Hani Hanifah, S.Si (NIP: `198109012009022003`, Guru/Walas)
- Akun Admin: `admin@smkn1sumedang.sch.id` / `rexxydc1@gmail.com`

---

## 5. Berkas Penghubung Utama
- **`presensia-iot-contract.js`**: SDK kontrak JavaScript untuk memproses tap kartu, menghitung status WIB, memvalidasi anti-passback, dan menghasilkan payload Firebase RTDB.
- **`IOT_AGENT_CONTEXT.md`**: Ringkasan arsitektur IoT dan petunjuk coding C++ ESP32 & Python Raspberry Pi.
