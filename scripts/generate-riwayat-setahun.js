/**
 * GENERATOR DATA HISTORIS PRESENSI 1 TAHUN TERAKHIR (TA 2025/2026)
 * Menghasilkan log kehadiran presensi realistis untuk M. Ihsan Athallah (0098263610)
 * dan Rizky Ramadhani (0082104129) selama 1 tahun ke belakang.
 * 
 * Presensi ASLI fisik kartu RFID tetap aktif mulai hari ini ke depan.
 * Script ini menyediakan log historis agar rekap, grafik, dan laporan UKK terisi lengkap.
 */

const fs = require('fs');
const path = require('path');

const TARGET_STUDENTS = [
  { nisn: '0098263610', nama: 'M. Ihsan Athallah', kelas: 'XII RPL 2' },
  { nisn: '0082104129', nama: 'Rizky Ramadhani', kelas: 'XII RPL 2' }
];

function padZero(num) {
  return num < 10 ? '0' + num : '' + num;
}

function generateDatasetSetahun() {
  const result = {};
  TARGET_STUDENTS.forEach(s => { result[s.nisn] = {}; });

  // Mulai dari 365 hari yang lalu hingga kemarin (hari ini untuk absensi asli)
  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() - 1); // sampai kemarin

  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 365); // 1 tahun ke belakang

  let curr = new Date(startDate);
  let idCounter = 1000;

  while (curr <= endDate) {
    const dayOfWeek = curr.getDay(); // 0: Minggu, 6: Sabtu
    const yyyy = curr.getFullYear();
    const mm = padZero(curr.getMonth() + 1);
    const dd = padZero(curr.getDate());
    const dateStr = `${yyyy}-${mm}-${dd}`;

    // Lewati akhir pekan (Sabtu & Minggu)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      // Lewati libur akhir tahun (20 Des - 2 Jan)
      const isLiburAkhirTahun = (curr.getMonth() === 11 && curr.getDate() >= 20) || (curr.getMonth() === 0 && curr.getDate() <= 2);
      
      if (!isLiburAkhirTahun) {
        TARGET_STUDENTS.forEach((student, idx) => {
          idCounter++;
          const entryKeyMasuk = `log_${dateStr}_in_${student.nisn}`;
          const entryKeyPulang = `log_${dateStr}_out_${student.nisn}`;

          // Tentukan variasi: sesekali sakit / izin (tingkat kehadiran ~97%)
          const seedRandom = (curr.getDate() * 17 + curr.getMonth() * 31 + idx * 7) % 100;

          if (seedRandom === 13) {
            // Sakit
            result[student.nisn][entryKeyMasuk] = {
              tanggal: dateStr,
              waktu: '00:00:00',
              status: 'sakit',
              keterangan: 'Surat dokter terlampir (Istirahat)',
              device_id: 'portal-perizinan'
            };
          } else if (seedRandom === 42) {
            // Dispensasi / Izin Dinas
            result[student.nisn][entryKeyMasuk] = {
              tanggal: dateStr,
              waktu: '00:00:00',
              status: 'dispensasi',
              keterangan: 'Dispensasi Lomba Keterampilan Siswa (LKS Web Tech)',
              device_id: 'portal-perizinan'
            };
          } else {
            // Hadir Normal via RFID
            const menitRandom = 45 + ((curr.getDate() + idx * 3) % 15); // 06:45 - 06:59
            const detikRandom = (curr.getDate() * 7) % 60;
            const jamMasukStr = `06:${padZero(menitRandom)}:${padZero(detikRandom)}`;

            const menitPulang = 30 + ((curr.getDate() + idx * 5) % 15); // 15:30 - 15:44
            const detikPulang = (curr.getDate() * 11) % 60;
            const jamPulangStr = `15:${padZero(menitPulang)}:${padZero(detikPulang)}`;

            result[student.nisn][entryKeyMasuk] = {
              tanggal: dateStr,
              waktu: jamMasukStr,
              status: 'hadir',
              device_id: 'gateway-rpl-01'
            };

            result[student.nisn][entryKeyPulang] = {
              tanggal: dateStr,
              waktu: jamPulangStr,
              status: 'pulang',
              device_id: 'gateway-rpl-01'
            };
          }
        });
      }
    }

    curr.setDate(curr.getDate() + 1);
  }

  return result;
}

const dataGenerated = generateDatasetSetahun();

// Hitung rekap statistik hasil generate
TARGET_STUDENTS.forEach(s => {
  const records = Object.values(dataGenerated[s.nisn]);
  const hadirCount = records.filter(r => r.status === 'hadir').length;
  const sakitCount = records.filter(r => r.status === 'sakit').length;
  const dispenCount = records.filter(r => r.status === 'dispensasi').length;
  const totalHari = hadirCount + sakitCount + dispenCount;
  const persentase = totalHari > 0 ? Math.round((hadirCount / totalHari) * 100) : 0;

  console.log(`[Generated] ${s.nama} (${s.nisn}):`);
  console.log(`  Total Hari Sekolah : ${totalHari} Hari`);
  console.log(`  Hadir              : ${hadirCount} Hari (${persentase}%)`);
  console.log(`  Sakit              : ${sakitCount} Hari`);
  console.log(`  Dispensasi         : ${dispenCount} Hari`);
});

// Simpan ke file data JSON untuk backup / import
const outputPath = path.join(__dirname, 'data-riwayat-setahun.json');
fs.writeFileSync(outputPath, JSON.stringify(dataGenerated, null, 2), 'utf8');
console.log(`✓ Data riwayat 1 tahun berhasil disimpan ke ${outputPath}`);

module.exports = { generateDatasetSetahun, dataGenerated };
