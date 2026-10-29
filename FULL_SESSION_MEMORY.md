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
- Siswa yang belum tap kartu setelah batas waktu gerbang (08:00 WIB) otomatis tercatat sebagai `Alpa` (Tanpa Keterangan).
- NISN disembunyikan dari kartu pantau publik demi privasi data siswa.

### F. Perbaikan Pemutaran Voice Note (VN)
- Ditambahkan Web Audio Synthesizer fallback dan audio buffer handling agar pesan suara dapat diputar dengan lancar tanpa error audio codec.

### G. Animasi Pop-up Tanda Ceklis ACC (React Bits & Modern UI Micro-Interactions)
- Disediakan modul mandiri `ceklis-popup.js` dan `ceklis-popup.css` yang terpasang di `admin.html`, `dashboard-guru.html`, dan `dashboard.html`.
- Menampilkan animasi SVG draw tanda ceklis melingkar dengan efek scale-in spring bounce, ripple glow, blur backdrop, dan nada harmonis Web Audio API.
- Terintegrasi otomatis pada aksi:
  1. ACC Kendala Mengajar Guru oleh Admin (`adminApproveKendala`).
  2. ACC Perizinan Siswa oleh Wali Kelas & Admin (`prosesApprovalIzin`, `adminApprovePerizinanItem`, `beriIzinCepat`).
  3. Konfirmasi Kehadiran Manual Guru / Walas (`hadirkanManual`, `hadirkanManualGuru`, `catatHadirManualWalas`).
  4. Perubahan Role & Pelepasan Tautan NISN di Admin Panel.
- Dilengkapi auto-dismiss progress bar countdown (2,2 detik) dan tombol "OK, Mengerti".

### H. Diferensiasi Status "Terlambat" vs "Tanpa Keterangan"
- **Masalah Awal**: Label kartu dan statistik sebelumnya menggunakan istilah "Terlambat (Belum Tap)" yang ambigu, seolah siswa yang belum datang/belum scan dianggap sama dengan siswa yang sudah hadir terlambat.
- **Solusi**:
  1. **Siswa Hadir Terlambat (Scan > 06:30:00 WIB)**: Berstatus **`Terlambat`** (`status: "terlambat"`, badge `⏱ TERLAMBAT` oranye), dihitung di kartu `Terlambat`.
  2. **Siswa Belum Tap Kartu & Tanpa Izin**: Berstatus **`Tanpa Keterangan`** (`status: "tanpa_keterangan"`, badge `TANPA KETERANGAN` merah), dihitung di kartu `Tanpa Keterangan`.
  3. Formula 5 kartu Walas menjadi saling eksklusif dan seimbang 100%: `Total Siswa = Hadir Tepat Waktu + Terlambat + Izin/Sakit + Tanpa Keterangan`.
  4. Label diperbarui serentak di `dashboard-guru.html`, `assets/dashboard-guru.js`, `dashboard.html`, `assets/dashboard.js`, `presensi-live.html`, dan `assets/presensi-live.js`.

### I. Perbaikan Live Alert Walas untuk Siswa Auto-Alpa / Belum Presensi
- **Masalah**: Tab *Alert Terlambat* di `dashboard-guru.html` menampilkan ucapan hijau *"Luar Biasa! Tidak Ada Siswa Tertinggal"* padahal terdapat 2 siswa (M. Ihsan Athallah & Rizky Ramadhani) yang belum tap kartu dan berstatus Auto-Alpa.
- **Penyebab**: Fungsi `muatLiveAlertWalas` menganggap setiap siswa yang ada di node presensi Firebase (termasuk status `'alpa'`) sebagai sudah tap (`hasTap = true`).
- **Solusi**: Filter `hasTap` diperbaiki hanya mengecek status `'hadir'`, `'pulang'`, atau `'terlambat'`. Status `'alpa'`, `'alpha'`, atau `'belum'` tidak dihitung sebagai tap kartu, sehingga kedua siswa otomatis muncul di daftar alert dengan tombol aksi cepat *Hadir Manual* & *Catat Izin*.

### J. Tampilan Foto Asli Guru & Walas di Header Dashboard
- **Masalah**: Avatar profil guru di kiri atas (`#avatarUser`) menampilkan ikon botak generik SVG.
- **Solusi**: `dashboard-guru.js` menyuntikkan foto asli guru (`assets/foto/guru_${nip}.jpg` seperti `guru_199209142022211007.jpg` untuk Muhammad Echa Putra) dengan fallback inisial elegan berlatar gradient modern.

### K. Rebranding & Redesign Chat "Bubble" (Monochrome Minimalist)
- **Kebutuhan**: Menghindari risiko hak cipta / *trademark* WhatsApp dengan menciptakan identitas baru yang modern, minimalis, dan elegan namun fungsi tetap sama 100%.
- **Hasil**:
  1. **Nama & Logo**: Dinamakan **"Bubble"** dengan logo Bubble kustom (SVG 3-dot speech bubble).
  2. **Palet Warna**: *Monochrome Minimalist* (Onyx Slate `#0F172A`, Clean White `#FFFFFF`, Neutral Surface `#F8FAFC`, Cool Gray `#E2E8F0`).
  3. **Latar Obrolan**: Mengganti wallpaper doodle WhatsApp lama dengan kanvas datar bersih `#F8FAFC`.
  4. **Gelembung Pesan**: Pesan terkirim berwarna gelap `#0F172A` (teks putih), pesan diterima putih `#FFFFFF` berbingkai halus `#E2E8F0`.
  5. **Kompatibilitas Penuh**: Semua fungsi API (`bukaChatWhatsApp`, `bukaRoomWa`, `initWhatsAppHub`) dan teks pengujian unit (`WhatsApp Presensia Terkunci`) tetap dipertahankan sebagai alias aktif.

### L. Penghapusan Baris "Masuk sebagai" & Animasi Interaksi Modern Chat Bubble
- **Kebutuhan**:
  1. Menghapus teks baris `"Masuk sebagai: ..."` di header chat Bubble agar tampilan lebih bersih dan tidak berantakan.
  2. Menghilangkan kesan "polosan" dengan menambahkan sentuhan desain menarik, micro-interactions, dan animasi tactile spring physics saat elemen diklik/diinteraksikan.
- **Solusi & Implementasi**:
  - `#waHeaderUserDisplay` disembunyikan menggunakan `display: none !important;` di `assets/chat-hub.css` dan dibersihkan dari template render tanpa merusak struktur DOM untuk script yang membutuhkan referensi elemen tersebut.
  - **Animasi & Interaksi yang Ditambahkan**:
    - **FAB Launcher**: Spring bounce saat ditekan (`:active scale(0.92)`), breathing ambient glow pulse, rotasi 90° morph saat terbuka, dan pulse ring otomatis dinonaktifkan saat jendela chat terbuka.
    - **Jendela Chat**: Animasi entrance spring pop & slide-up (`waSlideUp` dengan `cubic-bezier(0.34, 1.56, 0.64, 1)`).
    - **Tombol Tutup (✕)**: Hover spin 90° & scale 1.1x dengan active tactile squash.
    - **Segmented Tabs (`Chat`, `Grup`, `Kontak`)**: Tab aktif memiliki spring pop bounce (`waTabPop`), hover lift `-1px`, dan active press tactile squash.
    - **Transisi Panel**: Panel ruang chat meluncur halus dari kanan (`waSlideInRight`), dan kembali ke daftar thread dengan smooth fade (`waFadeInPanel`).
    - **Daftar Pesan & Kontak**: Cascade stagger delay (0.02s - 0.17s) saat render, hover slide-right (+4px), dan active press feedback.
    - **Balon Chat**: Animasi pop-in (`waBubbleIn`) dengan titik jangkar dinamis (kanan-bawah untuk pesan keluar, kiri-bawah untuk pesan masuk).
    - **Tombol Kirim & Tombol Enter**: Animasi tombol pop spring bounce (`waBtnPop` / `.wa-btn-pop`) aktif baik saat tombol kirim diklik maupun saat menekan tombol `Enter` di keyboard.
    - **Voice Note Player**: Waveform dance dinamis dan animasi play ripple pulse.
    - **Custom Scrollbar**: Scrollbar rounded tipis transparan elegan sesuai tema monochrome.
    - **Aksesibilitas**: Dukungan `@media (prefers-reduced-motion: reduce)` untuk kenyamanan pengguna sensitif motion.

### M. Struktur Animasi Skeleton Shimmer, Stagger Motion Reveal & Cache Busting pada Chat Bubble
- **Kebutuhan**:
  1. Menghilangkan kesan kaku/polosan saat Bubble chat dibuka dengan menghadirkan animasi struktural pemuatan layout (*skeleton loader shimmer* & *progressive reveal*).
  2. Memastikan animasi spring saat buka/tutup jendela dapat terpicu ulang (*re-triggered*) setiap kali tombol melayang (FAB) diklik.
  3. Memperbarui query parameter cache (*cache busting*) pada berkas CSS & JS agar peramban langsung memuat pembaruan terkini tanpa tertahan cache lawas.
- **Solusi & Implementasi**:
  1. **Skeleton Structure Loader (`buatSkeletonHtml`, `.wa-skeleton-wrap`)**:
     - Ditampilkan secara dinamis selama 160ms saat jendela chat dibuka atau saat beralih tab (*Chat*, *Grup*, *Kontak*).
     - Menampilkan indikator status berdenyut (*pulsing dot* & teks *"Memuat struktur obrolan..."*), 4 baris kartu kerangka (*skeleton card*), avatar bundar bersinar (*shimmering avatar*), dan baris teks placeholder dengan efek sapuan gradien bergerak halus (`@keyframes waShimmerSweep`).
     - Pada obrolan percakapan (*chat room*), disediakan kerangka pesan hantu (*chat bubble skeleton*) sebelum riwayat pesan ditampilkan.
  2. **Animasi Bertingkat (*Staggered Card Unfurl*)**:
     - Item percakapan, grup, dan kontak meluncur masuk dengan efek pegas elastis bertingkat (`.wa-stagger-in` & `@keyframes waCardUnfurl`) dengan delay progresif `animationDelay = idx * 0.035s`.
  3. **Glow Header Accent Bar & Online Beacon**:
     - Garis aksen berpendar 2.5px (`.wa-header-accent`) dengan gradien dinamis di bawah bilah atas header.
     - Penanda status aktif (*real-time online beacon* `.wa-online-beacon`) dengan animasi denyut lingkaran gelombang hijau pada avatar kontak.
  4. **Pemicu Ulang Animasi Buka-Tutup Jendela**:
     - Penambahan reflow DOM (`void hubWin.offsetWidth`) dan kelas transisi `.is-animating-in` serta `.is-closing` sehingga animasi membal elastis selalu aktif setiap kali jendela dibuka/ditutup.
  5. **Bust Cache Versi Baru**:
     - Nilai query parameter diperbarui menjadi `?v=20261029_03` di seluruh dokumen: `admin.html`, `dashboard.html`, dan `dashboard-guru.html`.

### N. Pembenahan Ikon Bubble Miring (Pencabutan rotate 90deg pada FAB)
- **Masalah**: Saat tombol melayang (FAB) diklik, ikon gelembung chat Bubble menjadi miring 90 derajat ke samping (ekor balon menghadap ke kiri atas dan 3 titik horizontal menjadi vertikal).
- **Penyebab**: Rule CSS `.wa-floating-btn.is-open svg` menerapkan `transform: rotate(90deg) scale(0.92);`.
- **Solusi**:
  - Properti `rotate(90deg)` dicabut total. Digantikan dengan penskalaan halus proporsional `transform: scale(0.96);`.
  - Ikon Bubble kini dipastikan selalu tegak lurus sempurna, horizontal, dan tidak pernah miring baik sebelum diklik, saat diklik, maupun saat jendela chat terbuka.
  - Ditambahkan pengujian anti-regresi pada `tests/test-bubble-skeleton-dan-struktur-animasi.js` untuk memastikan rotasi tidak pernah ditambahkan kembali.
  - Cache versioning dinaikkan ke `?v=20261029_03`.

### O. Fitur Notifikasi di Dashboard, Edit & Hapus Pesan, dan Ceklis Persis WhatsApp
- **Permintaan Pengguna**:
  1. Notifikasi di Dashboard saat ada chat masuk (in-app toast melayang + chime audio + Web Notification).
  2. Fitur Edit Pesan (khusus pengirim) dan Hapus Pesan / Delete for Everyone (pengirim & admin).
  3. Status Ceklis Pesan persis WhatsApp: Ceklis 1 Abu-abu (`✓`), Ceklis 2 Abu-abu (`✓✓`), Ceklis 2 Biru (`✓✓`).
- **Implementasi**:
  1. **Status Ceklis WhatsApp (`Ujikom/assets/chat-hub.js` & `chat-hub.css`)**:
     - Status `'sent'`: Ceklis 1 Abu-abu (`✓`, `#94A3B8`). Diberikan saat pesan pertama kali dikirim dan tercatat di server.
     - Status `'delivered'`: Ceklis 2 Abu-abu (`✓✓`, `#94A3B8`). Diberikan saat pesan berhasil diterima di perangkat/tab penerima melalui background RTDB listener / BroadcastChannel.
     - Status `'read'`: Ceklis 2 Biru Terang (`✓✓`, `#38BDF8`). Diberikan saat penerima membuka chat room obrolan tersebut atau sedang aktif melihat room saat pesan tiba.
     - Helper function: `getCheckmarkIconHtml(status)`.
  2. **Fitur Edit Pesan**:
     - Menu aksi `⋮` pada balon pesan pengirim memunculkan tombol `✏️ Edit`.
     - `mulaiEditPesanWa(msgId, roomId)`: Menampilkan bar mode edit `#waEditModeBar` di atas input teks dengan preview teks lama.
     - `simpanEditPesanWa(msgId, roomId, newText)`: Menyimpan teks baru, menandai `isEdited: true` dan `editedAt`, memperbarui LocalStorage, broadcast `EDIT_WA_MESSAGE`, dan update Firebase RTDB (`chat_rooms` & `chat_perijinan`). Balon pesan menampilkan label `(diedit)`.
     - `batalEditPesanWa()`: Menutup mode edit dan mereset input saat tombol `✕` atau `Escape` ditekan.
     - Hak akses ketat: Hanya pengirim pesan yang diizinkan mengedit; pesan suara (`audio`) dan pesan terhapus tidak dapat diedit.
  3. **Fitur Hapus Pesan (Delete for Everyone)**:
     - Menu aksi `⋮` menyediakan tombol `🗑️ Hapus`.
     - `hapusPesanWa(msgId, roomId)`: Dilengkapi modal konfirmasi penghapusan.
     - Konten pesan diganti menjadi `🚫 Pesan ini telah dihapus`, `isDeleted: true`, dan `audio_url: null`.
     - Sinkronisasi real-time instan ke LocalStorage, RTDB, dan lintas-tab via broadcast `DELETE_WA_MESSAGE`.
     - Hak akses: Hanya pengirim pesan atau Administrator yang dapat menghapus pesan.
  4. **Notifikasi di Dashboard & Web Audio Chime Alert**:
     - `mainkanSuaraNotifikasiChat()`: Menggunakan Web Audio API sintetis untuk menghasilkan dua nada harmonis melodius (D5 587.33 Hz disusul A5 880 Hz) tanpa ketergantungan file MP3 eksternal (100% offline & zero network delay).
     - `tampilkanNotifikasiPesanBaru(msg, roomId)`:
       - Memunculkan in-app toast notification di sudut kanan atas layar (`.wa-toast-container`, `.wa-notif-toast`) dengan avatar, nama pengirim, badge `Pesan Baru`, dan preview pesan.
       - Mengklik toast otomatis membuka room obrolan (`bukaChatWhatsApp(roomId)`).
       - Tombol close `✕` menutup toast secara elegan dengan animasi slide-out.
       - Auto-dismiss setelah 5.5 detik.
       - Terintegrasi dengan Web Desktop `Notification` API (`Notification.requestPermission()`).
       - Deduplikasi pintar (`waNotifiedMsgIds`) untuk mencegah spamming suara/toast ganda.
       - Proteksi self-notification: Tidak memicu notifikasi jika pesan dikirim oleh diri sendiri atau jika room tersebut sedang terbuka aktif di layar.
  5. **Bust Cache Versi Baru**:
     - Parameter cache di-bump ke `?v=20261029_04` pada `admin.html`, `dashboard.html`, dan `dashboard-guru.html`.
  6. **Pengujian & Verifikasi**:
     - Dibuat suite pengujian baru `tests/test-notifikasi-edit-delete-dan-ceklis.js` yang menguji 4 skenario utama.
     - 51 dari 51 test suites lulus 100%.

### I. Penggantian Menyeluruh Label UI "Alpa" Menjadi "Tanpa Keterangan"
- **Latar Belakang & Permintaan Pengguna**:
  - Seluruh label presensi "Alpa" di antarmuka web diubah menjadi **"Tanpa Keterangan"**, termasuk badge status pada kartu profil siswa (pojok kiri atas), roster pantau presensi, kartu rekapitulasi, dashboard guru/walas, dan panel admin.
- **Implementasi**:
  1. **Dashboard Siswa (`dashboard.js` & `dashboard.html`)**:
     - Label badge profil personal siswa yang sebelumnya menampilkan `"Alpa (Tanpa Konfirmasi)"` atau `"Alpa (Tanpa Keterangan)"` diubah menjadi `"Tanpa Keterangan"`.
     - Pill status presensi siswa yang sebelumnya bertuliskan `"✗ Alpa"` diubah menjadi `"Tanpa Keterangan"`.
     - Tabel riwayat rekap kehadiran yang menampilkan pill `"Alpha"` diganti menjadi `<span class="status-pill belum">Tanpa Keterangan</span>`.
     - Kartu statistik rekapitulasi di `dashboard.html` (`rekapStatAlpha`) diubah label judulnya dari `"ALPHA"` menjadi `"TANPA KETERANGAN"`.
  2. **Dashboard Guru & Walas (`dashboard-guru.js`)**:
     - `statusLabel` siswa belum absen / alpa diubah menjadi `"Tanpa Keterangan"`.
     - `statusKehadiran` pada rekapitulasi per jam beralih menjadi `"Tanpa Keterangan"`.
     - Alert peringatan pagi diperbarui menjadi `"Toleransi verifikasi izin sampai 08.00 WIB sebelum beralih otomatis ke status Tanpa Keterangan."`.
  3. **Presensi Live Monitor (`presensi-live.js`)**:
     - Status pill siswa belum absen setelah 08:00 WIB diubah menjadi `"Tanpa Keterangan"`.
  4. **Panel Admin (`admin.html` & `admin.js`)**:
     - Dropdown opsi input presensi manual diubah dari `"Alpha (Tanpa Keterangan)"` menjadi `"Tanpa Keterangan"`.
     - Header kartu statistik diubah dari `"ALPHA"` menjadi `"TANPA KETERANGAN"`.
     - Kartu panduan automasi 08:00 WIB dan tombol aksi disesuaikan menjadi `"Automasi Sistem: Tepat 08.00 WIB (Auto-Tanpa Keterangan)"` dan `"Eksekusi Automasi 08.00 WIB (Tandai Tanpa Keterangan)"`.
     - Header tabel monitoring 3 kelas binaan diubah menjadi `"Belum Hadir / Tanpa Keterangan"`.
     - Log telemetri terminal simulasi dan ringkasan toast diperbarui menampilkan `"Tanpa Keterangan"`.
  5. **Konfigurasi Firebase & Realtime Evaluator (`firebase-config.js`)**:
     - Label evaluator `evaluasiStatusKehadiranRealtime` diubah mengembalikan `label: 'Tanpa Keterangan'`.
  6. **Cache Versioning**:
     - Versi query asset di-bump ke `?v=20261029_07` pada `admin.html`, `dashboard.html`, `dashboard-guru.html`, dan `presensi-live.html`.
  7. **Pengujian & Verifikasi**:
     - Test unit `test-perbaikan-4-bug-ujikom.js` diselaraskan dengan assert label `"Tanpa Keterangan"`.
     - Seluruh 51 test suites di `Ujikom/tests/` lulus 100% (51/51 PASS).

### J. Penghapusan Tombol Testing, Redesain Ceklis Minimalis & Penambahan Animasi Penolakan
- **Latar Belakang & Permintaan Pengguna**:
  - Menghapus tombol testing `Reset Data Izin (Testing)` dari seluruh halaman web.
  - Mengubah tampilan animasi konfirmasi ceklis persetujuan izin (ACC) dari gaya berlebihan (*AI slop* dengan dropshadow tebal, warna neon, dan gradient berlebih) menjadi desain modern minimalis yang bersih (Linear / Apple style).
  - Menambahkan animasi interaktif khusus ketika permohonan izin atau kendala mengajar ditolak (*rejected*).
- **Implementasi**:
  1. **Pembersihan Markup Tombol Testing**:
     - Menghapus tombol `#btnResetIzinTesting` dari `dashboard-guru.html`.
     - Menghapus tombol `#btnResetIzinTestingAdmin` dari `admin.html`.
  2. **Redesain Minimalis Pop-up Ceklis (`ceklis-popup.css` & `ceklis-popup.js`)**:
     - Card disesuaikan menjadi proporsi compact `max-width: 360px`, `border-radius: 20px`, dengan soft border dan ambient shadow halus.
     - SVG checkmark dibuat presisi dengan clean circular disk (`fill="#ecfdf5"`), stroke garis halus (`#10b981`), dan path centang ramping (`#059669`).
     - Mengganti pulsing halo neon rave dengan single soft micro-expansion yang memudar elegan dalam 0.6 detik.
     - Tombol aksi diganti dengan modern dark-slate button (`#0f172a`, hover `#1e293b`).
     - Audio chime synthesizer diperhalus menggunakan Web Audio API soft sine bell.
  3. **Penambahan Animasi Penolakan (Rejection Modal)**:
     - Disediakan fungsi `tampilkanAnimasiTolak` dan alias `showRejectedAlert`.
     - Card penolakan otomatis mengaktifkan `.ceklis-card-tolak` dengan tactile micro-shake animation (`tolakMicroShake`).
     - Ikon silang presisi (`.ceklis-cross-path`) dengan warna soft rose / red (`#fff1f2`, `#f43f5e`, `#e11d48`).
     - Audio feedback synthesizer nada rendah hangat (warm organic marimba tap 440Hz -> 311Hz).
     - Diintegrasikan langsung pada alur penolakan izin siswa di `dashboard-guru.js` (`prosesApprovalIzin` status `ditolak`), penolakan perizinan di `perijinan.js` (`adminTolakPerizinanItem`), serta penolakan kendala mengajar di `admin.js` (`adminRejectKendala`).
  4. **Cache Versioning**:
     - Parameter asset dinaikkan ke `?v=20261029_08` pada berkas `ceklis-popup.css` dan `ceklis-popup.js` di `admin.html`, `dashboard.html`, dan `dashboard-guru.html`.
  5. **Pengujian Komprehensif**:
     - Dibuat test suite baru `Ujikom/tests/test-animasi-tolak-dan-minimalis-ceklis.js` (6 skenario).
     - Seluruh 52 test suites di `Ujikom/tests/` lulus 100% (52/52 PASS).

### P. Proteksi Privasi Kontak (Pelenyapan Spill Nomor ID & Kelas) & Penyederhanaan Pencarian
- **Permintaan Pengguna**:
  1. Hapus informasi Kelas dan Nomor ID pada daftar kontak Bubble agar tidak bocor / ke-spill ke pengguna lain.
  2. Ganti placeholder kotak pencarian menjadi "Cari nama..." saja.
- **Implementasi**:
  1. **Tab Kontak (chat-hub.js & chat-hub.css)**:
     - Baris Nomor ID dan Kelas dicabut total dari rendering daftar kontak.
     - Tampilan kini hanya menampilkan Avatar, Nama Lengkap, dan Lencana Peran (Role Badge) yang disejajarkan secara vertikal (align-items: center; gap: 8px;).
  2. **Pencegahan Spill di Header Chat & Modal Detail Grup**:
     - Subtitle percakapan pribadi saat kontak diklik diubah menjadi roleLabel || 'Online' (misal: "Wali Kelas Anda", "Guru", "Administrator", "Siswa") dan tidak lagi menyertakan NISN/NIP maupun string kelas internal.
     - Pada daftar anggota info grup (waGroupInfoModal), teks ID: ... digantikan dengan label peran resmi (c.role).
  3. **Penyederhanaan Placeholder Pencarian**:
     - Placeholder input pencarian #waSearchInput disederhanakan dari "Cari nama siswa, NISN, guru, atau grup..." menjadi "Cari nama..." agar lebih bersih dan bebas dari kata NISN.
     - Parameter cache di-bump ke ?v=20261029_06 pada admin.html, dashboard.html, dan dashboard-guru.html.
  4. **Verifikasi**:
     - Ditambahkan pengujian [Test 5] pada tests/test-notifikasi-edit-delete-dan-ceklis.js yang memverifikasi ketiadaan string "Nomor ID:" dan "Kelas:" pada seluruh elemen kontak.
     - 51 dari 51 test suites lulus 100%.

### I. Penggantian Menyeluruh Label UI "Alpa" Menjadi "Tanpa Keterangan"
- **Latar Belakang & Permintaan Pengguna**:
  - Seluruh label presensi "Alpa" di antarmuka web diubah menjadi **"Tanpa Keterangan"**, termasuk badge status pada kartu profil siswa (pojok kiri atas), roster pantau presensi, kartu rekapitulasi, dashboard guru/walas, dan panel admin.
- **Implementasi**:
  1. **Dashboard Siswa (`dashboard.js` & `dashboard.html`)**:
     - Label badge profil personal siswa yang sebelumnya menampilkan `"Alpa (Tanpa Konfirmasi)"` atau `"Alpa (Tanpa Keterangan)"` diubah menjadi `"Tanpa Keterangan"`.
     - Pill status presensi siswa yang sebelumnya bertuliskan `"✗ Alpa"` diubah menjadi `"Tanpa Keterangan"`.
     - Tabel riwayat rekap kehadiran yang menampilkan pill `"Alpha"` diganti menjadi `<span class="status-pill belum">Tanpa Keterangan</span>`.
     - Kartu statistik rekapitulasi di `dashboard.html` (`rekapStatAlpha`) diubah label judulnya dari `"ALPHA"` menjadi `"TANPA KETERANGAN"`.
  2. **Dashboard Guru & Walas (`dashboard-guru.js`)**:
     - `statusLabel` siswa belum absen / alpa diubah menjadi `"Tanpa Keterangan"`.
     - `statusKehadiran` pada rekapitulasi per jam beralih menjadi `"Tanpa Keterangan"`.
     - Alert peringatan pagi diperbarui menjadi `"Toleransi verifikasi izin sampai 08.00 WIB sebelum beralih otomatis ke status Tanpa Keterangan."`.
  3. **Presensi Live Monitor (`presensi-live.js`)**:
     - Status pill siswa belum absen setelah 08:00 WIB diubah menjadi `"Tanpa Keterangan"`.
  4. **Panel Admin (`admin.html` & `admin.js`)**:
     - Dropdown opsi input presensi manual diubah dari `"Alpha (Tanpa Keterangan)"` menjadi `"Tanpa Keterangan"`.
     - Header kartu statistik diubah dari `"ALPHA"` menjadi `"TANPA KETERANGAN"`.
     - Kartu panduan automasi 08:00 WIB dan tombol aksi disesuaikan menjadi `"Automasi Sistem: Tepat 08.00 WIB (Auto-Tanpa Keterangan)"` dan `"Eksekusi Automasi 08.00 WIB (Tandai Tanpa Keterangan)"`.
     - Header tabel monitoring 3 kelas binaan diubah menjadi `"Belum Hadir / Tanpa Keterangan"`.
     - Log telemetri terminal simulasi dan ringkasan toast diperbarui menampilkan `"Tanpa Keterangan"`.
  5. **Konfigurasi Firebase & Realtime Evaluator (`firebase-config.js`)**:
     - Label evaluator `evaluasiStatusKehadiranRealtime` diubah mengembalikan `label: 'Tanpa Keterangan'`.
  6. **Cache Versioning**:
     - Versi query asset di-bump ke `?v=20261029_07` pada `admin.html`, `dashboard.html`, `dashboard-guru.html`, dan `presensi-live.html`.
  7. **Pengujian & Verifikasi**:
     - Test unit `test-perbaikan-4-bug-ujikom.js` diselaraskan dengan assert label `"Tanpa Keterangan"`.
     - Seluruh 51 test suites di `Ujikom/tests/` lulus 100% (51/51 PASS).

### J. Penghapusan Tombol Testing, Redesain Ceklis Minimalis & Penambahan Animasi Penolakan
- **Latar Belakang & Permintaan Pengguna**:
  - Menghapus tombol testing `Reset Data Izin (Testing)` dari seluruh halaman web.
  - Mengubah tampilan animasi konfirmasi ceklis persetujuan izin (ACC) dari gaya berlebihan (*AI slop* dengan dropshadow tebal, warna neon, dan gradient berlebih) menjadi desain modern minimalis yang bersih (Linear / Apple style).
  - Menambahkan animasi interaktif khusus ketika permohonan izin atau kendala mengajar ditolak (*rejected*).
- **Implementasi**:
  1. **Pembersihan Markup Tombol Testing**:
     - Menghapus tombol `#btnResetIzinTesting` dari `dashboard-guru.html`.
     - Menghapus tombol `#btnResetIzinTestingAdmin` dari `admin.html`.
  2. **Redesain Minimalis Pop-up Ceklis (`ceklis-popup.css` & `ceklis-popup.js`)**:
     - Card disesuaikan menjadi proporsi compact `max-width: 360px`, `border-radius: 20px`, dengan soft border dan ambient shadow halus.
     - SVG checkmark dibuat presisi dengan clean circular disk (`fill="#ecfdf5"`), stroke garis halus (`#10b981`), dan path centang ramping (`#059669`).
     - Mengganti pulsing halo neon rave dengan single soft micro-expansion yang memudar elegan dalam 0.6 detik.
     - Tombol aksi diganti dengan modern dark-slate button (`#0f172a`, hover `#1e293b`).
     - Audio chime synthesizer diperhalus menggunakan Web Audio API soft sine bell.
  3. **Penambahan Animasi Penolakan (Rejection Modal)**:
     - Disediakan fungsi `tampilkanAnimasiTolak` dan alias `showRejectedAlert`.
     - Card penolakan otomatis mengaktifkan `.ceklis-card-tolak` dengan tactile micro-shake animation (`tolakMicroShake`).
     - Ikon silang presisi (`.ceklis-cross-path`) dengan warna soft rose / red (`#fff1f2`, `#f43f5e`, `#e11d48`).
     - Audio feedback synthesizer nada rendah hangat (warm organic marimba tap 440Hz -> 311Hz).
     - Diintegrasikan langsung pada alur penolakan izin siswa di `dashboard-guru.js` (`prosesApprovalIzin` status `ditolak`), penolakan perizinan di `perijinan.js` (`adminTolakPerizinanItem`), serta penolakan kendala mengajar di `admin.js` (`adminRejectKendala`).
  4. **Cache Versioning**:
     - Parameter asset dinaikkan ke `?v=20261029_08` pada berkas `ceklis-popup.css` dan `ceklis-popup.js` di `admin.html`, `dashboard.html`, dan `dashboard-guru.html`.
  5. **Pengujian Komprehensif**:
     - Dibuat test suite baru `Ujikom/tests/test-animasi-tolak-dan-minimalis-ceklis.js` (6 skenario).
     - Seluruh 52 test suites di `Ujikom/tests/` lulus 100% (52/52 PASS).

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
