// Fungsi bersama seputar tanggal/jam pelajaran -- dipakai admin.js (fitur simulasi absen)
// dan presensi-live.js, biar logicnya konsisten di satu tempat aja.

function tanggalHariIni() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function jamSekarang() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// "2026-09-15" -> "selasa". Dipakai buat lookup jadwal pulang per-hari (jadwal/{kelas}/{hari}),
// karena jam pulang beda-beda tiap hari (misal Rabu bisa lebih pendek/panjang dari hari lain).
function namaHariDariTanggal(tanggalStr) {
  const namaHariList = ['minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];
  const d = new Date(tanggalStr + 'T00:00:00');
  return namaHariList[d.getDay()];
}

// Cari jam ke berapa yang sedang aktif berdasarkan waktu sekarang.
// jadwalPelajaran: { "1": {mapel, mulai:"HH:MM", selesai:"HH:MM"}, "2": {...}, ... }
// return null kalau nggak lagi ada jam pelajaran (istirahat/di luar jam sekolah)
function cariJamKeAktif(jadwalPelajaran, waktuSekarang) {
  if (!jadwalPelajaran) return null;
  const jamKeList = Object.keys(jadwalPelajaran);
  for (let i = 0; i < jamKeList.length; i++) {
    const jamKe = jamKeList[i];
    const p = jadwalPelajaran[jamKe];
    if (waktuSekarang >= p.mulai && waktuSekarang < p.selesai) {
      return { jam_ke: jamKe, mapel: p.mapel, mulai: p.mulai, selesai: p.selesai };
    }
  }
  return null;
}
