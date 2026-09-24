# 📸 Cara Upload Foto Siswa

Foto siswa ditampilkan di Dashboard Orang Tua dan Presensi Live.
Jika foto belum ada, sistem otomatis menampilkan **inisial nama** sebagai pengganti.

---

## Struktur Folder Foto

Semua foto disimpan di:
```
Ujikom/
  assets/
    foto/
      {NISN}.jpg   ← format nama file harus NISN siswa
```

**Contoh:**
- `assets/foto/0098263610.jpg` → Foto M. IHSAN ATHALLAH
- `assets/foto/0082104129.jpg` → Foto RIZKY RAMADANI

---

## Langkah Upload Foto

1. **Siapkan foto** siswa (format JPG/JPEG lebih baik, minimal 200x200 pixel, disarankan persegi)
2. **Rename file** foto sesuai NISN siswa
   - Contoh: `foto-ihsan.jpg` → ganti nama menjadi `0098263610.jpg`
3. **Salin file** ke folder `Ujikom\assets\foto\`
   - Buka Windows Explorer → masuk ke folder `Ujikom → assets → foto`
   - Paste foto ke sana

---

## Daftar NISN Siswa XII RPL 2 (Data Asli + Siswa Lainnya)

| Nama | NISN | File Foto |
|------|------|-----------|
| M. IHSAN ATHALLAH | 0098263610 | 0098263610.jpg |
| RIZKY RAMADANI | 0082104129 | 0082104129.jpg |
| (siswa lainnya lihat panel admin) | | |

---

## Rekomendasi Format Foto

| Ukuran | Format | Maks Ukuran File |
|--------|--------|------------------|
| 300×300 px s/d 800×800 px | `.jpg` / `.jpeg` | 500 KB |

> **Tips:** Foto akan di-crop otomatis menjadi bulat di tampilan kartu siswa.

---

## Jika Foto Tidak Muncul

Pastikan:
- Nama file = NISN siswa (contoh: `0098263610.jpg`) bukan `0098263610.JPG` (perhatikan huruf kapital)
- File sudah ada di folder `assets/foto/`
- Kamu mengakses web lewat web server (contoh: Live Server di VS Code) — bukan double-click file HTML langsung, karena browser blokir akses file lokal dari `file://`

---

## Tips Pakai Live Server (VS Code)

1. Buka folder `Ujikom` di VS Code
2. Install extension **"Live Server"** (Ritwick Dey)
3. Klik kanan `index.html` → **"Open with Live Server"**
4. Web akan terbuka di browser dengan URL `http://127.0.0.1:5500/...`
5. Foto siswa akan langsung tampil!
