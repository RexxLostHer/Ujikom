const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const mapping = [
  { nisn: '0098263610', charId: 123212 }, // M. IHSAN ATHALLAH -> Kiyotaka Ayanokouji
  { nisn: '0082104129', charId: 159627 }, // RIZKY RAMADANI -> Kakeru Ryuuen
  { nisn: '3083030644', charId: 123218 }, // ARIF WIJAKSANA -> Yousuke Hirata
  { nisn: '0091113849', charId: 123219 }, // AHSAN MAHMUD FAUZI YUSRY -> Manabu Horikita
  { nisn: '0081953923', charId: 123213 }, // AIDA SAHARAWATI -> Suzune Horikita
  { nisn: '0094812111', charId: 158988 }, // BANGKIT FAIZ SYARIFUDDIN -> Rokusuke Kouenji
  { nisn: '0096396686', charId: 207025 }, // CAHYA MUHAMAD RIFAN -> Ken Sudou
  { nisn: '0088101365', charId: 123214 }, // DESTIKA -> Kikyou Kushida
  { nisn: '0093165149', charId: 273646 }, // EKA OSA PRASETYO -> Kanji Ike
  { nisn: '0093346005', charId: 207023 }, // FAHRI AL FAUZI -> Haruki Yamauchi
  { nisn: '0091670887', charId: 173450 }, // FIKRI RIDWANULLOH -> Teruhiko Yukimura
  { nisn: '0091543636', charId: 207024 }, // HAFIDZ FAYYADH ARKAN -> Akito Miyake
  { nisn: '0095806933', charId: 284288 }, // HANIF AKMA AZIB -> Hideo Sotomura
  { nisn: '0084091049', charId: 207027 }, // KEYSHAR AL IHSANIDHIA WAFFI -> Masayoshi Hashimoto
  { nisn: '0092945323', charId: 207022 }, // MUHAMAD DAFFA RAFASYA -> Ryuuji Kanzaki
  { nisn: '0093579207', charId: 282232 }, // MUHAMMAD RIZKI RAMADHAN -> Sou Shibata
  { nisn: '0089025956', charId: 123215 }, // NAAILA LUTHFI NAFIISA -> Airi Sakura
  { nisn: '0087369704', charId: 123216 }, // NUR JAMILAH -> Honami Ichinose
  { nisn: '0082852058', charId: 207026 }, // PASHYA PRASETYO WIBOWO -> Kouhei Katsuragi
  { nisn: '0093176594', charId: 141122 }, // PUTRI NABILA RAMADHANI -> Kei Karuizawa
  { nisn: '0089822982', charId: 273647 }, // RAFLI MUHAMMAD GHOJALI -> Albert Yamada
  { nisn: '0084202991', charId: 282230 }, // RAKA FAIZA BILLAH -> Daichi Ishizaki
  { nisn: '0081131116', charId: 281121 }, // RAY SAJUTA PRAJA -> Hayato Kitou
  { nisn: '0088738345', charId: 124691 }, // REVA AYUNADIA -> Arisu Sakayanagi
  { nisn: '0083707720', charId: 273648 }, // REZQI MAULANA YUSUP -> Yahiko Totsuka
  { nisn: '0097000545', charId: 197977 }, // RIANTO -> Miyabi Nagumo
  { nisn: '0084987133', charId: 294559 }, // RIDWAN FHATURROHMAN -> Ikuto Kiriyama
  { nisn: '0083606520', charId: 163518 }, // RIFA AULIA DAMAYANTI -> Hiyori Shiina
  { nisn: '0087321172', charId: 174781 }, // RIZKIA SUCI RAMADHANI -> Mio Ibuki
  { nisn: '0087949581', charId: 163517 }, // SARAH SABILA KHOERUNNISA -> Haruka Hasebe
  { nisn: '0088938544', charId: 207028 }, // SOFYAN RAFI ISKANDAR -> Tomonari Mashima
  { nisn: '0097682754', charId: 163519 }, // TIA APRILIA KUSWARA -> Maya Satou
  { nisn: '0085991563', charId: 191401 }, // TIARA SULISTIA NINGRUM -> Chiaki Matsushita
  { nisn: '0095039675', charId: 191504 }, // VIVI HANIFAH FEBRIYANTI -> Akane Tachibana
  { nisn: '0087607700', charId: 191507 }, // WULAN KARTIKA SARI -> Masumi Kamuro
  { nisn: '0096619392', charId: 288362 }, // ZAIDAN HASBI AKBAR -> Tokinari Tsukishiro
  { nisn: '0081782494', charId: 290862 }, // ABHIPRAYA SAMBOGA -> Atsuomi Ayanokouji
  { nisn: '0095250998', charId: 290860 }, // AGUS RIZKY NURFADIL -> Narumori Sakayanagi
  { nisn: '0084736069', charId: 123217 }, // ALIFAH DZAAKIROH -> Sae Chabashira
  { nisn: '0092418049', charId: 191508 }, // ALYA FUTRI SALSABILA -> Chie Hoshinomiya
  { nisn: '0098205255', charId: 136233 }, // CHERYL PUTRI RAHMADYA -> Mei-Yu Wang
  { nisn: '0086172155', charId: 285106 }, // DANDI RIZIQ KAHARUDIN -> Kouji Machida
  { nisn: '0096081488', charId: 191505 }, // DEVI NURUL AZIZAH -> Yume Kobashi
  { nisn: '0082773779', charId: 191506 }, // DHINDA PUTRI ARYANI -> Satsuki Shinohara
  { nisn: '0091923585', charId: 282225 }, // DINDA ZAHRA NUR AFIFAH -> Mako Amikura
  { nisn: '0088435506', charId: 285110 }, // FULAN MUHAMMAD -> Tetsuya Hamaguchi
  { nisn: '0087828183', charId: 294557 }, // IQBAL MAULANA SIDIK -> Hiroya Tokitou
  { nisn: '0085340789', charId: 323945 }, // KURNIAWAN SUDRAJAT -> Susumu Moriyama
  { nisn: '0087121894', charId: 306860 }, // LUTHFI NUR ZAIDAN -> Kyou Ishigami
  { nisn: '0094996233', charId: 323944 }, // MUHAMMAD ARDAN ZAQUAN AL KAHFI -> Makoto Sumida
  { nisn: '0089471184', charId: 159626 }, // MUHAMMAD FARHAN NASRULLAH -> Kazuomi Housen
  { nisn: '0092047785', charId: 159628 }, // MUHAMMAD RIFKY FAUZIA SHONHAJI -> Takuya Yagami
  { nisn: '0089511928', charId: 282226 }, // NABILA AINUN AL ZAHRANI -> Kayano Onodera
  { nisn: '0092427440', charId: 171746 }, // NAUVAL EAGAN PURNAMA -> Riku Utomiya
  { nisn: '0093940421', charId: 284289 }, // NIA KARUNIA -> Chihiro Shiranami
  { nisn: '0089603330', charId: 284290 }, // NOVA PUSPITASARI -> Nene Mori
  { nisn: '0081281355', charId: 294555 }, // RAFLY NOVIADY -> Katsunori Shiba
  { nisn: '0093489720', charId: 395368 }, // RAKA -> Soushi Miyamoto
  { nisn: '0081714691', charId: 189728 }, // RIKA NOVIYANTIKA -> Nazuna Asahina
  { nisn: '0091835189', charId: 396529 }, // RIKI -> Setsuya Minami
  { nisn: '0087989875', charId: 285107 }, // RINRIN RINAWATI -> Nanami Yabu
  { nisn: '0082578655', charId: 285108 }, // RIRIN DWI RIYANTO -> Shiho Manabe
  { nisn: '0083044841', charId: 285111 }, // RISMA RISTIANTI -> Saki Yamashita
  { nisn: '0081607221', charId: 396530 }, // SOLEH WAHYUDIN -> Kyougo Komiya
  { nisn: '0097169063', charId: 285904 }, // SRIYANTI DEVIE -> Minori Kinoshita
  { nisn: '0085206927', charId: 294554 }, // TALITA APRILIANA -> Takeko Nishino
  { nisn: '0089565003', charId: 397135 }, // WILLY HAFFIDIN -> Osamu Takahashi
  { nisn: '0081876173', charId: 159629 }, // Nita Nuraini -> Ichika Amasawa
  { nisn: '0088082306', charId: 202488 }  // WIDIA SRI ANDAYANI -> Fuuka Kiryuuin
];

const charsList = JSON.parse(fs.readFileSync(path.join(__dirname, 'anilist-cote-chars.json'), 'utf8'));
const charMap = new Map(charsList.map(c => [c.id, c]));

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to download ${url}: status ${res.statusCode}`));
      }
      const stream = fs.createWriteStream(dest);
      res.pipe(stream);
      stream.on('finish', () => resolve(dest));
      stream.on('error', reject);
    }).on('error', reject);
  });
}

async function processAll() {
  console.log('Starting download of 69 Classroom of the Elite student photos...');
  const tmpDir = path.join(__dirname, '..', 'tmp_photos');
  const targetDir = path.join(__dirname, '..', 'assets', 'foto');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

  const psScriptPath = path.join(tmpDir, 'batch_convert.ps1');
  const psLines = [
    'Add-Type -AssemblyName System.Drawing',
    '$destSize = 400'
  ];

  for (let i = 0; i < mapping.length; i++) {
    const item = mapping[i];
    const c = charMap.get(item.charId);
    if (!c) throw new Error(`Character ID ${item.charId} not found in charMap!`);
    
    const ext = c.image.endsWith('.png') ? '.png' : '.jpg';
    const tmpFile = path.join(tmpDir, `${item.nisn}_raw${ext}`);
    const outFile = path.join(targetDir, `${item.nisn}.jpg`);

    console.log(`[${i+1}/69] Downloading ${c.name} for NISN ${item.nisn}...`);
    await downloadFile(c.image, tmpFile);

    // PowerShell commands to crop top-center and save as high-quality JPEG
    const rawEscaped = tmpFile.replace(/\\/g, '\\\\');
    const outEscaped = outFile.replace(/\\/g, '\\\\');
    psLines.push(`
try {
  $rawPath = "${rawEscaped}"
  $outPath = "${outEscaped}"
  $orig = [System.Drawing.Image]::FromFile($rawPath)
  $w = $orig.Width
  $h = $orig.Height
  $cropSize = [Math]::Min($w, $h)
  $srcRect = New-Object System.Drawing.Rectangle([int](($w - $cropSize) / 2), 0, $cropSize, $cropSize)
  $target = New-Object System.Drawing.Bitmap($destSize, $destSize)
  $g = [System.Drawing.Graphics]::FromImage($target)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear([System.Drawing.Color]::White)
  $destRect = New-Object System.Drawing.Rectangle(0, 0, $destSize, $destSize)
  $g.DrawImage($orig, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
  $target.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Jpeg)
  $g.Dispose()
  $target.Dispose()
  $orig.Dispose()
} catch {
  Write-Host "Error processing ${item.nisn}: " $_.Exception.Message
}
`);
  }

  fs.writeFileSync(psScriptPath, psLines.join('\n'), 'utf8');
  console.log('\nRunning PowerShell batch processor to produce square 400x400 JPEGs...');
  execSync(`powershell -ExecutionPolicy Bypass -File "${psScriptPath}"`, { stdio: 'inherit' });

  // Cleanup tmpDir
  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log('✓ All 69 photos processed successfully!');

  // Update assets/data-siswa.json and siswa-clean-firebase.json
  console.log('\nUpdating student database files with foto field...');
  const dataSiswaPath = path.join(__dirname, '..', 'assets', 'data-siswa.json');
  const siswaCleanPath = path.join(__dirname, '..', 'siswa-clean-firebase.json');
  const rosterDataPath = path.join(__dirname, '..', 'seed', 'roster-data.json');

  const dataSiswa = JSON.parse(fs.readFileSync(dataSiswaPath, 'utf8'));
  const siswaClean = JSON.parse(fs.readFileSync(siswaCleanPath, 'utf8'));
  const rosterData = fs.existsSync(rosterDataPath) ? JSON.parse(fs.readFileSync(rosterDataPath, 'utf8')) : null;

  for (const m of mapping) {
    const nisn = m.nisn;
    const c = charMap.get(m.charId);
    const fotoRel = `assets/foto/${nisn}.jpg`;

    if (dataSiswa[nisn]) {
      // PRESERVE ALL ORIGINAL FIELDS EXACTLY: nama, nisn, kelas, nis, email
      dataSiswa[nisn].foto = fotoRel;
      dataSiswa[nisn].foto_karakter = c.name;
    }
    if (siswaClean[nisn]) {
      siswaClean[nisn].foto = fotoRel;
      siswaClean[nisn].foto_karakter = c.name;
    }
    if (rosterData && rosterData[nisn]) {
      rosterData[nisn].foto = fotoRel;
      rosterData[nisn].foto_karakter = c.name;
    }
  }

  fs.writeFileSync(dataSiswaPath, JSON.stringify(dataSiswa, null, 2), 'utf8');
  fs.writeFileSync(siswaCleanPath, JSON.stringify(siswaClean, null, 2), 'utf8');
  if (rosterData) {
    fs.writeFileSync(rosterDataPath, JSON.stringify(rosterData, null, 2), 'utf8');
  }

  console.log('✓ data-siswa.json, siswa-clean-firebase.json, and seed/roster-data.json updated!');

  // Verify all 69 files exist
  let missingFiles = 0;
  for (const m of mapping) {
    const p = path.join(targetDir, `${m.nisn}.jpg`);
    if (!fs.existsSync(p) || fs.statSync(p).size < 1000) {
      console.error(`Missing or corrupt photo: ${m.nisn}.jpg`);
      missingFiles++;
    }
  }

  if (missingFiles === 0) {
    console.log(`\n🎉 VERIFICATION SUCCESS: All 69 photos exist and are valid JPEGs!`);
  } else {
    console.error(`❌ Verification failed: ${missingFiles} files missing!`);
  }
}

processAll().catch(console.error);
