# Sistem Presensi Siswa Terpadu

Web app (prototipe) untuk orang tua memantau kehadiran anak secara real-time,
terhubung ke Raspberry Pi + NFC reader di gerbang sekolah lewat Firebase Realtime Database.

## Struktur folder
```
absensi-app/
├── index.html          # halaman login (pakai NISN + password)
├── dashboard.html       # halaman pantau absensi anak
├── assets/
│   ├── style.css
│   ├── firebase-config.js   # ISI SENDIRI dengan config Firebase kamu
│   ├── login.js
│   └── dashboard.js
```

## Setup

1. Buka `assets/firebase-config.js`, isi `apiKey`, `messagingSenderId`, `appId`
   dari Firebase Console -> Project Settings -> Your apps -> Web app.
   (`databaseURL` dan `projectId` udah keisi sesuai project Absensi kamu.)

2. Tambahin data siswa manual dulu di Firebase Console (tab Data), struktur:
   ```
   siswa:
     0067787337:        <- ini NISN atau ID kartu
       nama: "Nama Siswa"
       password: "123456"
       kelas: "9A"
   ```

3. Buka `index.html` di browser (bisa langsung double-click file-nya, atau
   pakai extension "Live Server" kalau di VS Code).

## Cara jalanin dari Raspberry Pi
Script `absensi.py` di Pi nulis data ke path `absensi/{id_kartu}`.
Supaya nyambung ke NISN yang sama, pastikan ID kartu yang ditulis Pi
sama persis dengan key `siswa/{nisn}` di atas -- atau sesuaikan
`absensi.py` supaya nulis ke `absensi/{nisn}` bukan `absensi/{id_kartu}`.

## TODO
- [ ] Mapping ID kartu NFC ke NISN siswa
- [ ] Fitur jadwal pulang per kelas + deteksi pulang lebih awal
- [ ] Fitur NFC device-bound (ID beda kalau device beda)
- [ ] Konversi ke APK (pakai Capacitor/Cordova, atau native Android)
