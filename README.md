# Sistem Presensi Siswa Terpadu

Web app (prototipe) untuk orang tua memantau kehadiran anak secara real-time,
terhubung ke Raspberry Pi + NFC reader di gerbang sekolah lewat Firebase Realtime Database.

## Struktur folder
```
absensi-app/
├── index.html          # halaman login (pakai NISN + password)
├── dashboard.html       # halaman pantau absensi anak
├── admin-login.html     # halaman login admin/petugas
├── admin.html           # panel admin: kelola data siswa & mapping kartu NFC
├── assets/
│   ├── style.css
│   ├── admin.css
│   ├── firebase-config.js   # ISI SENDIRI dengan config Firebase kamu
│   ├── login.js
│   ├── dashboard.js
│   ├── admin-login.js
│   └── admin.js
```

## Setup

1. Buka `assets/firebase-config.js`, isi `apiKey`, `messagingSenderId`, `appId`
   dari Firebase Console -> Project Settings -> Your apps -> Web app.
   (`databaseURL` dan `projectId` udah keisi sesuai project Absensi kamu.)

2. Data siswa dan mapping kartu NFC sekarang dikelola lewat **panel admin**
   (`admin-login.html` -> `admin.html`), nggak perlu lagi input manual di
   Firebase Console. Tapi kamu tetap butuh 1 akun admin awal, buat manual
   sekali ini aja di Firebase Console (tab Data):
   ```
   admin:
     admin:                 <- username
       password: "ganti_ini"
   ```
   Struktur data yang dipakai panel admin:
   ```
   siswa:
     0067787337:            <- NISN (key)
       nama: "Nama Siswa"
       password: "123456"   <- password login ortu
       kelas: "9A"

   kartu:
     04A1B2C3:               <- UID kartu NFC (key)
       "0067787337"          <- NISN yang terhubung ke kartu ini

   jadwal:
     9A: "15:30"              <- jam pulang resmi kelas 9A (diisi lewat panel admin)
   ```

3. Buka `index.html` di browser (bisa langsung double-click file-nya, atau
   pakai extension "Live Server" kalau di VS Code). Buat kelola data, buka
   `admin-login.html`.

## Cara jalanin dari Raspberry Pi
Script `absensi.py` di Pi nulis data ke path `absensi/{id_kartu}`.
Supaya nyambung ke siswa yang benar, `absensi.py` sebaiknya:
1. Baca UID kartu dari NFC reader
2. Lookup NISN-nya lewat node `kartu/{id_kartu}` di Firebase
3. Tulis hasil scan ke `absensi/{nisn}`, bukan `absensi/{id_kartu}`

Contoh potongan Python (pakai `firebase-admin` SDK):
```python
def catat_absensi(uid_kartu, status="hadir"):
    nisn = db.reference(f"kartu/{uid_kartu}").get()
    if nisn is None:
        print(f"Kartu {uid_kartu} belum terdaftar, cek di panel admin.")
        return
    now = datetime.now()
    db.reference(f"absensi/{nisn}").push({
        "tanggal": now.strftime("%Y-%m-%d"),  # WAJIB, dipakai dashboard buat cek "hari ini"
        "waktu": now.strftime("%H:%M:%S"),
        "status": status  # "hadir" pas masuk, "pulang" pas keluar
    })
```
Field `tanggal` ini **wajib** -- tanpa itu, dashboard nggak bisa mastiin suatu
entry absensi itu dari hari ini atau bukan, dan bakal nganggap "belum ada data
hari ini" walau ada histori dari hari-hari sebelumnya.

## Catatan soal status "pulang"
Dashboard membedakan "Pulang" vs "Pulang lebih awal" dengan bandingin `waktu`
entry berstatus `"pulang"` terhadap `jadwal/{kelas}`. Jadi `absensi.py` di Pi
perlu nulis entry terpisah dengan `status: "pulang"` saat siswa tap kartu pas
keluar gerbang (bukan cuma `status: "hadir"` sepanjang hari). Kalau di Pi kamu
belum ada logic buat bedain scan masuk vs keluar (misalnya reader kedua di
gerbang keluar, atau tombol toggle), itu perlu ditambahin di `absensi.py`.

## TODO
- [x] Mapping ID kartu NFC ke NISN siswa (lewat panel admin)
- [x] Fitur jadwal pulang per kelas + deteksi pulang lebih awal
- [ ] Fitur NFC device-bound (ID beda kalau device beda)
- [ ] Konversi ke APK (pakai Capacitor/Cordova, atau native Android)
