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
