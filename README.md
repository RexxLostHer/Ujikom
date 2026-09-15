# Sistem Presensi Siswa Terpadu

Web app (prototipe) untuk orang tua memantau kehadiran anak secara real-time,
terhubung ke Raspberry Pi + NFC reader di gerbang sekolah lewat Firebase Realtime Database.

## Struktur folder
```
absensi-app/
├── index.html            # halaman login (pakai NISN + password)
├── dashboard.html         # halaman pantau absensi anak
├── admin-login.html       # halaman login admin/petugas
├── admin.html             # panel admin: siswa, kartu NFC, jadwal pulang, jadwal pelajaran
├── presensi-live.html     # halaman guru/BK: siapa yang belum absen jam berjalan
├── assets/
│   ├── style.css
│   ├── admin.css
│   ├── presensi-live.css
│   ├── firebase-config.js   # ISI SENDIRI dengan config Firebase kamu
│   ├── login.js
│   ├── dashboard.js
│   ├── admin-login.js
│   ├── admin.js
│   └── presensi-live.js
├── tests/
│   ├── test-dashboard-logic.js       # node tests/test-dashboard-logic.js
│   └── test-presensi-live-logic.js   # node tests/test-presensi-live-logic.js
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
       nisn: "0067787337"
       device_id: "rpi-9a-01"  <- opsional. Kalau diisi, kartu ini CUMA diterima
                                  kalau di-tap di device dengan ID ini (anti-cloning).
                                  Kosongin/hapus field ini kalau mau lepas ikatan.

   jadwal:
     9A: "15:30"              <- jam pulang resmi kelas 9A

   jadwal_pelajaran:
     9A:
       1: { mapel: "Matematika", mulai: "07:00", selesai: "07:45" }
       2: { mapel: "B. Indonesia", mulai: "07:45", selesai: "08:30" }
       3: { mapel: "IPA", mulai: "09:00", selesai: "09:45" }   <- ada jeda istirahat, itu normal

   # Ditulis OTOMATIS oleh absensi.py, bukan lewat panel admin -- dipakai halaman Presensi Live
   # biar nggak perlu listen ke tiap siswa satu-satu.
   presensi_jam:
     9A:
       2026-09-15:
         1:                          <- jam ke-1
           0067787337: { waktu: "07:05:00", status: "hadir" }
   ```

3. Buka `index.html` di browser (bisa langsung double-click file-nya, atau
   pakai extension "Live Server" kalau di VS Code). Buat kelola data, buka
   `admin-login.html`.

   Halaman `presensi-live.html` (buat guru/BK pantau siapa yang belum absen
   jam berjalan) **masih pakai login admin yang sama** buat sekarang -- ini
   sengaja disederhanain dulu karena baru pilot 1 kelas. Kalau nanti udah
   expand ke banyak kelas dan tiap guru butuh akun sendiri, itu perlu
   dipisah jadi role tersendiri (bukan numpang ke akun admin).

## Cara jalanin dari Raspberry Pi
Script `absensi.py` di Pi nulis data ke path `absensi/{id_kartu}`.
Supaya nyambung ke siswa yang benar dan ke fitur-fitur baru (jadwal pelajaran,
anti-cloning, presensi live), `absensi.py` sebaiknya:
1. Baca UID kartu dari NFC reader
2. Lookup data kartu lewat node `kartu/{id_kartu}` di Firebase -- sekarang isinya
   object `{nisn, device_id}`, bukan string NISN polos lagi
3. **Cek anti-cloning**: kalau kartu itu udah punya `device_id` tersimpan DAN
   `device_id` itu beda dari device yang lagi scan sekarang -> tolak
4. Kalau kartu belum punya `device_id` sama sekali -> otomatis ikat ke device
   yang scan pertama kali (auto-bind)
5. Tentuin lagi jam berapa sekarang berdasarkan `jadwal_pelajaran/{kelas}`
   siswa itu (logic-nya sama persis kayak `cariJamKeAktif` di
   `assets/presensi-live.js`, supaya konsisten sama tampilan web)
6. Tulis ke `absensi/{nisn}` (histori lengkap) **dan** ke `presensi_jam/{kelas}/{tanggal}/{jam_ke}/{nisn}`
   (buat halaman Presensi Live)

Tiap device perlu tau ID dirinya sendiri -- gampangnya simpen di file lokal
`device_id.txt` di folder yang sama, isinya cuma 1 baris ID unik (misal
`rpi-9a-01`), beda-beda per Raspberry Pi.

Contoh lengkap (pakai `firebase-admin` SDK):
```python
from datetime import datetime

DEVICE_ID = open("device_id.txt").read().strip()

def cari_jam_ke_aktif(jadwal_pelajaran, waktu_sekarang):
    """Sama persis logic-nya kayak cariJamKeAktif() di assets/presensi-live.js"""
    if not jadwal_pelajaran:
        return None
    for jam_ke, p in jadwal_pelajaran.items():
        if p["mulai"] <= waktu_sekarang < p["selesai"]:
            return jam_ke, p
    return None

def catat_absensi(uid_kartu, status="hadir"):
    kartu = db.reference(f"kartu/{uid_kartu}").get()
    if kartu is None:
        print(f"Kartu {uid_kartu} belum terdaftar, cek di panel admin.")
        return

    # dukung data lama yang masih format string polos (migrasi bertahap)
    if isinstance(kartu, str):
        nisn, device_id_tersimpan = kartu, None
    else:
        nisn, device_id_tersimpan = kartu.get("nisn"), kartu.get("device_id")

    # Anti-cloning: kartu yang udah keiket ke device lain, tolak
    if device_id_tersimpan and device_id_tersimpan != DEVICE_ID:
        print(f"DITOLAK: kartu {uid_kartu} terdaftar di device '{device_id_tersimpan}', bukan '{DEVICE_ID}'.")
        return

    # Kartu baru / belum pernah keiket -> auto-bind ke device ini
    if not device_id_tersimpan:
        db.reference(f"kartu/{uid_kartu}/device_id").set(DEVICE_ID)

    siswa = db.reference(f"siswa/{nisn}").get()
    kelas = siswa.get("kelas") if siswa else None

    now = datetime.now()
    tanggal = now.strftime("%Y-%m-%d")
    waktu = now.strftime("%H:%M:%S")

    entry = {"tanggal": tanggal, "waktu": waktu, "status": status}

    jadwal_pelajaran = db.reference(f"jadwal_pelajaran/{kelas}").get() if kelas else None
    jam_ke_info = cari_jam_ke_aktif(jadwal_pelajaran, now.strftime("%H:%M")) if jadwal_pelajaran else None
    if jam_ke_info:
        jam_ke, _ = jam_ke_info
        entry["jam_ke"] = jam_ke

    db.reference(f"absensi/{nisn}").push(entry)

    if kelas and jam_ke_info:
        jam_ke, _ = jam_ke_info
        db.reference(f"presensi_jam/{kelas}/{tanggal}/{jam_ke}/{nisn}").set({"waktu": waktu, "status": status})
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

## Testing
Ada unit test buat logic-logic penting (nggak butuh Firebase asli, dites pakai
data palsu):
```
node tests/test-dashboard-logic.js
node tests/test-presensi-live-logic.js
```
Jalanin ini tiap abis ubah `dashboard.js` atau `presensi-live.js` buat mastiin
nggak ada yang somehow kebalik logic-nya.

## TODO
- [x] Mapping ID kartu NFC ke NISN siswa (lewat panel admin)
- [x] Fitur jadwal pulang per kelas + deteksi pulang lebih awal
- [x] Fitur NFC device-bound (anti-cloning per kartu) -- pilot 1 kelas
- [x] Presensi per jam pelajaran + halaman live buat guru/BK
- [ ] Import data siswa dari Excel (nunggu file dari user)
- [ ] Expand ke semua kelas + lab (jumlah nyusul)
- [ ] Pisahin akun guru dari akun admin (sekarang masih numpang 1 login)
- [ ] Konversi ke APK (pakai Capacitor/Cordova, atau native Android)
