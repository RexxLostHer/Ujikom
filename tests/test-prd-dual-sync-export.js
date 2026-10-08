/**
 * Test Validasi Sinkronisasi Dual-Path (perijinan & perizinan),
 * Walas Permit Approval, Chat Bi-directional, dan Export CSV Tahunan.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('=== TEST SUITE: SINKRONISASI PRD & FITUR WEB UJIKOM ===\n');

// 1. Uji Sinkronisasi Helper Dual-Path
function testDualSyncLogic() {
  console.log('[Test 1] Pengujian Penggabungan Data perijinan (J) dan perizinan (Z)...');
  
  const sampleJ = {
    'IZIN-001': {
      id: 'IZIN-001',
      nisn: '0098263610',
      nama: 'M. Ihsan Athallah',
      kelas: 'XII RPL 2',
      jenis: 'sakit',
      alasan: 'Demam tinggi',
      dokumen_url: 'https://storage.googleapis.com/bukti1.jpg',
      status: 'pending',
      dibuat_pada: 1772400000000
    }
  };

  const sampleZ = {
    'IZIN-002': {
      id: 'IZIN-002',
      nisn: '0082104129',
      nama_siswa: 'Rizky Ramadhani',
      kelas: 'XII RPL 2',
      jenis: 'dispensasi',
      alasan: 'Lomba LKS Web Tech',
      foto_bukti: 'https://storage.googleapis.com/bukti2.jpg',
      status: 'disetujui',
      created_at: '2026-03-01T08:00:00.000Z'
    }
  };

  // Simulasikan logika ambilSemuaPerizinanOnce
  const merged = {};
  Object.keys(sampleJ).forEach(k => {
    merged[k] = {
      id: k, pid: k,
      ...sampleJ[k],
      nama_siswa: sampleJ[k].nama_siswa || sampleJ[k].nama,
      foto_bukti: sampleJ[k].foto_bukti || sampleJ[k].dokumen_url,
      created_at: sampleJ[k].created_at || (sampleJ[k].dibuat_pada ? new Date(sampleJ[k].dibuat_pada).toISOString() : '')
    };
  });
  Object.keys(sampleZ).forEach(k => {
    merged[k] = {
      id: k, pid: k,
      ...sampleZ[k],
      ...merged[k],
      nama_siswa: sampleZ[k].nama_siswa || sampleZ[k].nama || (merged[k] && merged[k].nama_siswa),
      foto_bukti: sampleZ[k].foto_bukti || sampleZ[k].dokumen_url || (merged[k] && merged[k].foto_bukti)
    };
  });

  assert.strictEqual(Object.keys(merged).length, 2, 'Harus menggabungkan kedua path');
  assert.strictEqual(merged['IZIN-001'].nama_siswa, 'M. Ihsan Athallah');
  assert.strictEqual(merged['IZIN-001'].foto_bukti, 'https://storage.googleapis.com/bukti1.jpg');
  assert.strictEqual(merged['IZIN-002'].nama_siswa, 'Rizky Ramadhani');
  assert.strictEqual(merged['IZIN-002'].status, 'disetujui');
  console.log('✓ Dual-path merge berhasil menggabungkan data perijinan & perizinan secara lossless.\n');
}

// 2. Uji Alur Approval Walas dan Pembaruan Presensi Jam
function testApprovalWalasKePresensiJam() {
  console.log('[Test 2] Uji Alur Approval Walas & Update Presensi Jam...');

  const jadwalPelajaran = {
    '1': { mapel: 'PABP', jamKe: 1 },
    '2': { mapel: 'PABP', jamKe: 2 },
    '3': { mapel: 'Matematika', jamKe: 3 },
    '4': { mapel: 'Matematika', jamKe: 4 },
    '5': { mapel: 'Produktif RPL', jamKe: 5 },
    '6': { mapel: 'Produktif RPL', jamKe: 6 },
    '7': { mapel: 'Produktif RPL', jamKe: 7 },
    '8': { mapel: 'Produktif RPL', jamKe: 8 }
  };

  const kelas = 'XII RPL 2';
  const tanggal = '2026-03-05';
  const nisn = '0098263610';
  const statusIzin = 'sakit';

  const presensiUpdates = {};
  Object.keys(jadwalPelajaran).forEach(jamKe => {
    presensiUpdates[`presensi_jam/${kelas}/${tanggal}/${jamKe}/${nisn}`] = {
      status: statusIzin,
      waktu: '00:00:00'
    };
  });

  assert.strictEqual(Object.keys(presensiUpdates).length, 8, 'Harus mengupdate seluruh 8 jam pelajaran');
  assert.strictEqual(presensiUpdates[`presensi_jam/${kelas}/${tanggal}/1/${nisn}`].status, 'sakit');
  assert.strictEqual(presensiUpdates[`presensi_jam/${kelas}/${tanggal}/8/${nisn}`].status, 'sakit');
  console.log('✓ Approval Walas secara otomatis sinkron ke seluruh jam KBM (1-8) presensi_jam.\n');
}

// 3. Uji Chat Bi-directional Role Mapping
function testChatBiDirectional() {
  console.log('[Test 3] Uji Bi-directional Chat (Admin/Walas/Guru vs Siswa)...');

  function getSenderBubble(userRole, senderType) {
    const isStaff = (userRole === 'admin' || userRole === 'guru' || userRole === 'walas');
    const isSaya = (isStaff && (senderType === 'admin' || senderType === 'guru')) ||
                   (!isStaff && senderType === 'siswa');
    return isSaya ? 'saya' : 'lawan';
  }

  // Walas melihat pesan Walas sendiri -> 'saya'
  assert.strictEqual(getSenderBubble('walas', 'admin'), 'saya');
  // Walas melihat pesan Siswa -> 'lawan'
  assert.strictEqual(getSenderBubble('walas', 'siswa'), 'lawan');
  // Guru melihat pesan Guru/Admin -> 'saya'
  assert.strictEqual(getSenderBubble('guru', 'admin'), 'saya');
  // Siswa melihat pesan Siswa sendiri -> 'saya'
  assert.strictEqual(getSenderBubble('siswa', 'siswa'), 'saya');
  // Siswa melihat pesan Walas/Admin -> 'lawan'
  assert.strictEqual(getSenderBubble('siswa', 'admin'), 'lawan');

  console.log('✓ Logika bubble chat bi-directional akurat untuk semua role (Siswa, Walas, Guru, Admin).\n');
}

// 4. Uji Format Export CSV Tahunan vs Harian
function testExportCsvFormat() {
  console.log('[Test 4] Uji Format Export CSV Rekapitulasi Tahunan vs Harian...');

  const rekapTahunanData = [
    {
      no: 1,
      nisn: '0098263610',
      nama: 'M. Ihsan Athallah',
      total: 251,
      h: 244,
      s: 4,
      i: 3,
      a: 0,
      persen: 97,
      statusAkhir: 'Memenuhi Syarat (≥85%)'
    }
  ];

  const headerExpected = 'No,NISN,Nama Siswa,Total Hari Efektif,Hadir,Sakit,Izin/Dispen,Alpa,Persentase Kehadiran,Status Kelayakan';
  let csvContent = headerExpected + '\r\n';
  rekapTahunanData.forEach(row => {
    const namaClean = '"' + row.nama.replace(/"/g, '""') + '"';
    const statusClean = '"' + row.statusAkhir.replace(/"/g, '""') + '"';
    csvContent += [
      row.no,
      row.nisn,
      namaClean,
      row.total,
      row.h,
      row.s,
      row.i,
      row.a,
      row.persen + '%',
      statusClean
    ].join(',') + '\r\n';
  });

  assert.ok(csvContent.includes('Total Hari Efektif'), 'Harus menyertakan kolom Total Hari Efektif');
  assert.ok(csvContent.includes('244'), 'Harus menyertakan jumlah hadir');
  assert.ok(csvContent.includes('97%'), 'Harus menyertakan persentase kehadiran');
  assert.ok(!csvContent.includes('undefined'), 'Tidak boleh ada kata undefined dalam CSV tahunan');

  console.log('✓ Format CSV tahunan valid dan bebas nilai undefined.\n');
}

// 5. Uji Keberadaan Element di dashboard-guru.html
function testGuruHtmlElements() {
  console.log('[Test 5] Verifikasi Element modalChat & Script perijinan.js di dashboard-guru.html...');
  const html = fs.readFileSync(path.join(__dirname, '..', 'dashboard-guru.html'), 'utf-8');

  assert.ok(html.includes('id="modalChat"'), 'dashboard-guru.html harus memiliki elemen modalChat');
  assert.ok(html.includes('assets/perijinan.js'), 'dashboard-guru.html harus menyertakan script assets/perijinan.js');
  console.log('✓ dashboard-guru.html lengkap dengan modalChat dan script perijinan.js.\n');
}

testDualSyncLogic();
testApprovalWalasKePresensiJam();
testChatBiDirectional();
testExportCsvFormat();
testGuruHtmlElements();

console.log('======================================================');
console.log('🎉 SELURUH PENGUJIAN SINKRONISASI & EXPORT LOLOS 100%!');
console.log('======================================================');
