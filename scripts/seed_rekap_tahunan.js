/**
 * SCRIPT SEED REKAPITULASI TAHUNAN PRESENSI (TA 2025/2026)
 * Presensia IoT - SMK Negeri 1 Sumedang
 *
 * Persyaratan:
 * 1. Data kehadiran bervariasi realistis (Hadir ~235-248, Sakit 1-6, Izin 1-5, Alpa 0-3).
 * 2. Maksimal 5 siswa dalam 1 kelas yang memiliki data kehadiran identik.
 * 3. Absen / nilai tidak berurutan monotonik (pseudo-random deterministik non-sequential).
 * 4. 1-2 siswa per kelas dengan Alpa agak tinggi (5-8 hari) sebagai contoh Peringatan Disiplin (< 85%).
 * 5. M. Ihsan Athallah (0098263610) berstatus Memenuhi Syarat prima.
 */

const https = require('https');
const path = require('path');
const { MASTER_DATA_SISWA_RESMI } = require('../assets/firebase-config.js');

const PROFIL_NORMAL = [
  { h: 247, s: 2, i: 2, a: 0 },
  { h: 246, s: 3, i: 2, a: 0 },
  { h: 245, s: 3, i: 3, a: 0 },
  { h: 244, s: 4, i: 3, a: 0 },
  { h: 243, s: 4, i: 3, a: 1 },
  { h: 242, s: 5, i: 3, a: 1 },
  { h: 241, s: 5, i: 4, a: 1 },
  { h: 240, s: 6, i: 4, a: 1 },
  { h: 239, s: 6, i: 5, a: 1 },
  { h: 238, s: 7, i: 4, a: 2 },
  { h: 237, s: 7, i: 5, a: 2 },
  { h: 236, s: 8, i: 5, a: 2 },
  { h: 248, s: 2, i: 1, a: 0 },
  { h: 245, s: 4, i: 2, a: 0 },
  { h: 243, s: 5, i: 3, a: 0 },
  { h: 242, s: 4, i: 4, a: 1 },
  { h: 241, s: 6, i: 3, a: 1 },
  { h: 239, s: 7, i: 3, a: 2 },
];

const PROFIL_PERINGATAN = [
  { h: 210, s: 18, i: 16, a: 7 }, // 84% -> Peringatan Disiplin
  { h: 212, s: 17, i: 16, a: 6 }, // 84% -> Peringatan Disiplin
];

function stringHash(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function generateClassProfiles(students, className) {
  const sorted = [...students].sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));
  const total = sorted.length;
  if (total === 0) return [];

  let warningIndex = stringHash(className || 'class') % total;
  if (sorted[warningIndex] && sorted[warningIndex].nisn === '0098263610') {
    warningIndex = (warningIndex + 1) % total;
  }

  const classHash = stringHash(className + '_seed_2025_2026');
  const tupleCounts = {};
  const results = [];

  sorted.forEach((s, idx) => {
    let p;
    if (s.nisn === '0098263610') {
      p = { h: 246, s: 3, i: 2, a: 0 };
    } else if (idx === warningIndex && total >= 10) {
      p = Object.assign({}, PROFIL_PERINGATAN[0]);
    } else {
      const sHash = stringHash(s.nisn || String(idx));
      const slot = (idx * 7 + (sHash % 13) + (classHash % 5)) % PROFIL_NORMAL.length;
      p = Object.assign({}, PROFIL_NORMAL[slot]);
    }

    const key = `${p.h}-${p.s}-${p.i}-${p.a}`;
    tupleCounts[key] = (tupleCounts[key] || 0) + 1;

    // Pastikan maksimal <= 5 orang kembar identik dalam 1 kelas
    if (tupleCounts[key] > 5) {
      for (let offset = 1; offset < PROFIL_NORMAL.length; offset++) {
        const altSlot = (slot + offset) % PROFIL_NORMAL.length;
        const altP = PROFIL_NORMAL[altSlot];
        const altKey = `${altP.h}-${altP.s}-${altP.i}-${altP.a}`;
        if ((tupleCounts[altKey] || 0) < 5) {
          p = Object.assign({}, altP);
          tupleCounts[key]--;
          tupleCounts[altKey] = (tupleCounts[altKey] || 0) + 1;
          break;
        }
      }
    }

    const totHari = p.h + p.s + p.i + p.a;
    const persen = Math.round((p.h / totHari) * 100);
    const statusAkhir = persen >= 85 ? 'Memenuhi Syarat (≥85%)' : 'Peringatan Disiplin';
    const badgeClass = persen >= 85 ? 'disetujui' : 'ditolak';

    results.push({
      nisn: s.nisn,
      nama: s.nama,
      kelas: s.kelas,
      total: totHari,
      h: p.h,
      s: p.s,
      i: p.i,
      a: p.a,
      persen,
      statusAkhir,
      badgeClass,
      tahun_ajaran: '2025/2026',
      updated_at: Date.now()
    });
  });

  return results;
}

function buildAllRekapData() {
  const classes = ['XII RPL 1', 'XII RPL 2', 'XII TKJ 1'];
  const allRecords = {};

  classes.forEach(cls => {
    const list = Object.values(MASTER_DATA_SISWA_RESMI).filter(s => {
      if (cls === 'XII TKJ 1') return s.kelas === 'XII TKJ 1' || (s.kelas && s.kelas.includes('TKJ'));
      return s.kelas === cls;
    });

    const classResults = generateClassProfiles(list, cls);
    classResults.forEach(r => {
      allRecords[r.nisn] = r;
    });
  });

  return allRecords;
}

function seedToFirebase(allRecords) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(allRecords);
    const req = https.request({
      hostname: 'absensi-6e385-default-rtdb.asia-southeast1.firebasedatabase.app',
      path: '/rekap_tahunan.json',
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log(`✓ Sukses seeding ${Object.keys(allRecords).length} data rekapitulasi tahunan ke Firebase RTDB!`);
          resolve(body);
        } else {
          reject(new Error(`Firebase HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', err => reject(err));
    req.write(payload);
    req.end();
  });
}

if (require.main === module) {
  const data = buildAllRekapData();
  console.log(`Memulai seeding ${Object.keys(data).length} siswa ke Firebase /rekap_tahunan...`);
  seedToFirebase(data)
    .then(() => {
      console.log('Seeding selesai 100%!');
      process.exit(0);
    })
    .catch(err => {
      console.error('Gagal seeding:', err.message);
      process.exit(1);
    });
}

module.exports = {
  buildAllRekapData,
  generateClassProfiles,
  PROFIL_NORMAL,
  PROFIL_PERINGATAN,
  stringHash
};
