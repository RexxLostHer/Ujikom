/**
 * PROFIL & KEAMANAN AKUN PENGGUNA
 * Komponen modal profil modern untuk Siswa, Guru, dan Admin.
 * Mendukung pembaruan nama, ganti kata sandi, dan kirim link reset password.
 */

function bukaModalProfil() {
  let overlay = document.getElementById('modalProfilOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'modalProfilOverlay';
    overlay.className = 'profile-modal-overlay';
    overlay.onclick = function(e) {
      if (e.target === overlay) tutupModalProfil();
    };
    document.body.appendChild(overlay);
  }

  const user = getSessionUser() || {};
  const fbUser = (typeof firebase !== 'undefined' && firebase.auth) ? firebase.auth().currentUser : null;
  const isGoogle = (fbUser && fbUser.providerData && fbUser.providerData.some(p => p.providerId === 'google.com')) || (user.foto_google && !user.isPasswordAuth);
  
  const isPengunjung = user.role === 'pengunjung' || (!user.nisn && !user.nip && user.role !== 'admin' && user.role !== 'guru' && user.role !== 'walas');
  const initial = (user.nama ? user.nama.charAt(0) : (user.email ? user.email.charAt(0) : '?')).toUpperCase();
  const roleLabel = user.role === 'admin' ? 'Administrator Sistem' : (user.role === 'walas' ? 'Wali Kelas ' + (user.walasKelasId || '') : (user.role === 'guru' ? 'Guru Pengajar RPL' : (isPengunjung ? 'Pengunjung / Tamu Sekolah' : 'Siswa SMKN 1 Sumedang')));
  const roleBadgeClass = user.role === 'admin' ? 'role-admin' : (user.role === 'walas' ? 'role-walas' : (user.role === 'guru' ? 'role-guru' : (isPengunjung ? 'role-pengunjung' : 'role-siswa')));

  overlay.innerHTML = `
    <div class="profile-modal-card">
      <div class="profile-modal-header">
        <div style="display:flex;align-items:center;gap:12px;">
          <div class="profile-avatar-circle">
            ${user.foto_google ? `<img src="${user.foto_google}" alt="Foto Profil">` : `<span>${initial}</span>`}
          </div>
          <div>
            <h2 class="profile-user-name">${user.nama || 'Pengguna'}</h2>
            <div style="display:flex;align-items:center;gap:6px;margin-top:2px;">
              <span class="profile-role-badge ${roleBadgeClass}">${roleLabel}</span>
              ${isGoogle ? '<span class="profile-auth-tag google">Google Auth</span>' : '<span class="profile-auth-tag verified">Email/Password</span>'}
            </div>
          </div>
        </div>
        <button class="profile-btn-close" onclick="tutupModalProfil()" title="Tutup">✕</button>
      </div>

      <div class="profile-modal-body">
        <!-- Notifikasi Feedback -->
        <div id="profilNotifBox" class="profile-notif-box" style="display:none;"></div>

        <!-- Section 0: Konfirmasi Identitas (Claim Role - PRD Bab 3) -->
        ${isPengunjung ? `
        <div class="profile-section-box" style="border: 1.5px solid #818cf8; background: #f8faff;">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px;">
            <h3 class="profile-section-title" style="color: #3730a3;margin:0;">🎓 Verifikasi Identitas Akun (Claim Role)</h3>
            <div style="display:flex;gap:6px;">
              <button type="button" class="profile-btn-secondary" id="btnPilihKlaimSiswa" onclick="toggleModeKlaim('siswa')" style="padding:4px 10px;font-size:12px;background:#4f46e5;color:#fff;border-color:#4f46e5;">Siswa (NISN)</button>
              <button type="button" class="profile-btn-secondary" id="btnPilihKlaimGuru" onclick="toggleModeKlaim('guru')" style="padding:4px 10px;font-size:12px;">Guru / Walas (NIP)</button>
              <button type="button" class="profile-btn-secondary" id="btnPilihKlaimAdmin" onclick="toggleModeKlaim('admin')" style="padding:4px 10px;font-size:12px;">Admin (Kode)</button>
            </div>
          </div>
          
          <!-- Mode Klaim Siswa -->
          <div id="boxKlaimSiswa">
            <p style="font-size: 13px; color: #4338ca; line-height: 1.5; margin-bottom: 12px;">
              Masukkan 10 digit NISN Anda untuk menghubungkan akun ini dengan data resmi siswa SMKN 1 Sumedang serta mengaktifkan kartu pintar presensi RFID.
            </p>
            <div class="profile-field-row">
              <label for="inputNisnVerif">Nomor Induk Siswa Nasional (NISN)</label>
              <div style="display:flex;gap:8px;align-items:center;">
                <input type="text" id="inputNisnVerif" class="profile-input" placeholder="Contoh: 0091113849" maxlength="12"
                       onkeydown="if(event.key==='Enter') handlePeriksaNisn()">
                <button type="button" class="profile-btn-action" onclick="handlePeriksaNisn()" id="btnCekNisn">🔍 Periksa NISN</button>
              </div>
            </div>
            <div id="boxPreviewSiswa" style="display:none; margin-top:14px; padding:14px; background:#ffffff; border:1px solid #c7d2fe; border-radius:12px;">
              <div style="font-size:11.5px; font-weight:700; color:#6366f1; text-transform:uppercase; margin-bottom:4px;">Data Siswa Ditemukan:</div>
              <div style="font-size:15px; font-weight:800; color:#1e293b;" id="previewNamaSiswa">-</div>
              <div style="font-size:13px; color:#64748b; margin-top:2px;" id="previewMetaSiswa">-</div>
              <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap;">
                <button type="button" class="profile-btn-action" onclick="handleKonfirmasiTautkanNisn()" id="btnTautkanNisn" style="background:#059669; border-color:#059669;">✓ Ya, Hubungkan Akun Siswa</button>
                <button type="button" class="profile-btn-secondary" onclick="batalPreviewNisn()">Batal</button>
              </div>
            </div>
          </div>

          <!-- Mode Klaim Guru / Walas -->
          <div id="boxKlaimGuru" style="display:none;">
            <p style="font-size: 13px; color: #4338ca; line-height: 1.5; margin-bottom: 12px;">
              Masukkan 18 digit NIP atau Kode Guru Anda. Sistem akan secara otomatis mendeteksi apakah Anda bertugas sebagai Guru Pengajar atau Wali Kelas (Walas).
            </p>
            <div class="profile-field-row">
              <label for="inputNipVerif">Nomor Induk Pegawai (NIP) / Kode Guru</label>
              <div style="display:flex;gap:8px;align-items:center;">
                <input type="text" id="inputNipVerif" class="profile-input" placeholder="Contoh: 199209142022211007" maxlength="20"
                       onkeydown="if(event.key==='Enter') handlePeriksaNip()">
                <button type="button" class="profile-btn-action" onclick="handlePeriksaNip()" id="btnCekNip">🔍 Periksa NIP</button>
              </div>
            </div>
            <div id="boxPreviewGuru" style="display:none; margin-top:14px; padding:14px; background:#ffffff; border:1px solid #c7d2fe; border-radius:12px;">
              <div style="font-size:11.5px; font-weight:700; color:#6366f1; text-transform:uppercase; margin-bottom:4px;">Data Guru Ditemukan:</div>
              <div style="font-size:15px; font-weight:800; color:#1e293b;" id="previewNamaGuru">-</div>
              <div style="font-size:13px; color:#64748b; margin-top:2px;" id="previewMetaGuru">-</div>
              <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap;">
                <button type="button" class="profile-btn-action" onclick="handleKonfirmasiTautkanGuru()" id="btnTautkanGuru" style="background:#059669; border-color:#059669;">✓ Ya, Hubungkan Akun Guru</button>
                <button type="button" class="profile-btn-secondary" onclick="batalPreviewGuru()">Batal</button>
              </div>
            </div>
          </div>

          <!-- Mode Klaim Admin -->
          <div id="boxKlaimAdmin" style="display:none;">
            <p style="font-size: 13px; color: #4338ca; line-height: 1.5; margin-bottom: 12px;">
              Masukkan kode otorisasi Administrator Sekolah (misal: <code>admin2026</code> atau <code>nesas2026</code>) untuk mengaktifkan hak akses panel admin penuh.
            </p>
            <div class="profile-field-row">
              <label for="inputAdminPasscode">Kode Sandi Administrator</label>
              <div style="display:flex;gap:8px;align-items:center;">
                <input type="password" id="inputAdminPasscode" class="profile-input" placeholder="Contoh: admin2026"
                       onkeydown="if(event.key==='Enter') handleKonfirmasiTautkanAdmin()">
                <button type="button" class="profile-btn-action" onclick="handleKonfirmasiTautkanAdmin()" id="btnKlaimAdmin" style="background:#4f46e5; border-color:#4f46e5;">🛡️ Klaim Akses Admin</button>
              </div>
            </div>
          </div>
        </div>
        ` : ''}

        <!-- Section 1: Informasi Akun -->
        <div class="profile-section-box">
          <h3 class="profile-section-title">👤 Informasi Akun & Identitas</h3>
          
          <div class="profile-field-row">
            <label>Alamat Email</label>
            <div class="profile-read-only-field">
              <span>${user.email || (fbUser ? fbUser.email : '-')}</span>
              <span class="profile-verified-pill">✓ Aktif</span>
            </div>
          </div>

          ${user.nisn ? `
          <div class="profile-field-row">
            <label>Nomor Induk Siswa (NISN)</label>
            <div class="profile-read-only-field">
              <span>${user.nisn}</span>
              <span class="profile-verified-pill">✓ Terdaftar</span>
            </div>
          </div>
          ` : ''}

          ${user.kelas ? `
          <div class="profile-field-row">
            <label>Rombongan Belajar (Kelas)</label>
            <div class="profile-read-only-field">${user.kelas}</div>
          </div>
          ` : ''}

          ${user.nip ? `
          <div class="profile-field-row">
            <label>Nomor Induk Pegawai (NIP)</label>
            <div class="profile-read-only-field">${user.nip}</div>
          </div>
          ` : ''}

          ${user.mapel ? `
          <div class="profile-field-row">
            <label>Mata Pelajaran Diampu</label>
            <div class="profile-read-only-field">${user.mapel}</div>
          </div>
          ` : ''}

          <div class="profile-field-row">
            <label for="editNamaPengguna">Nama Lengkap Tampilan</label>
            <div style="display:flex;gap:8px;align-items:center;">
              <input type="text" id="editNamaPengguna" class="profile-input" value="${(user.nama || '').replace(/"/g, '&quot;')}" placeholder="Masukkan nama lengkap">
              <button class="profile-btn-action" onclick="handleSimpanNamaProfil()" id="btnSimpanNama">Simpan</button>
            </div>
          </div>
        </div>
        </div>

        <!-- Section 2: Keamanan & Kata Sandi -->
        <div class="profile-section-box">
          <h3 class="profile-section-title">🔒 Keamanan & Kata Sandi</h3>

          ${isGoogle ? `
            <div class="profile-google-note">
              <div class="google-icon-box">
                <svg width="22" height="22" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
              </div>
              <div>
                <strong>Autentikasi Aman Akun Google</strong>
                <p>Akun ini masuk menggunakan Google Sign-In. Pengaturan kata sandi dan keamanan akun langsung disinkronkan dari akun Google Anda.</p>
              </div>
            </div>
          ` : `
            <div class="profile-field-row">
              <label for="passBaruProfil">Kata Sandi Baru</label>
              <div class="profile-input-pw-wrap">
                <input type="password" id="passBaruProfil" class="profile-input" placeholder="Minimal 6 karakter" autocomplete="new-password">
                <button type="button" class="btn-toggle-eye" onclick="togglePasswordProfil('passBaruProfil', this)">
                  <svg class="eye-open" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                  <svg class="eye-closed" style="display:none;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                </button>
              </div>
            </div>

            <div class="profile-field-row">
              <label for="passKonfirmasiProfil">Konfirmasi Kata Sandi Baru</label>
              <div class="profile-input-pw-wrap">
                <input type="password" id="passKonfirmasiProfil" class="profile-input" placeholder="Ketik ulang kata sandi baru" autocomplete="new-password">
                <button type="button" class="btn-toggle-eye" onclick="togglePasswordProfil('passKonfirmasiProfil', this)">
                  <svg class="eye-open" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                  <svg class="eye-closed" style="display:none;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                </button>
              </div>
            </div>

            <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap;">
              <button class="profile-btn-action" onclick="handleGantiPasswordProfil()" id="btnUpdatePassword">Perbarui Kata Sandi</button>
              <button class="profile-btn-secondary" onclick="handleKirimResetEmailProfil()" id="btnResetViaEmail">Kirim Link Reset ke Email</button>
            </div>
          `}
        </div>
      </div>
    </div>
  `;

  overlay.style.display = 'flex';
}

function tutupModalProfil() {
  const overlay = document.getElementById('modalProfilOverlay');
  if (overlay) overlay.style.display = 'none';
}

function tampilProfilNotif(pesan, tipe) {
  const box = document.getElementById('profilNotifBox');
  if (!box) return;
  box.style.display = 'block';
  box.className = 'profile-notif-box ' + tipe;
  box.textContent = pesan;
}

function togglePasswordProfil(inputId, btn) {
  const inp = document.getElementById(inputId);
  if (!inp) return;
  const isPass = inp.type === 'password';
  inp.type = isPass ? 'text' : 'password';
  const openIcon = btn.querySelector('.eye-open');
  const closedIcon = btn.querySelector('.eye-closed');
  if (openIcon && closedIcon) {
    openIcon.style.display = isPass ? 'none' : 'block';
    closedIcon.style.display = isPass ? 'block' : 'none';
  }
}

async function handleSimpanNamaProfil() {
  const inp = document.getElementById('editNamaPengguna');
  const btn = document.getElementById('btnSimpanNama');
  if (!inp || !btn) return;
  const namaBaru = inp.value.trim();
  if (!namaBaru) {
    tampilProfilNotif('Nama lengkap tidak boleh kosong.', 'error');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Menyimpan...';
  try {
    if (typeof ubahProfilPengguna === 'function') {
      await ubahProfilPengguna(namaBaru);
    } else {
      const user = firebase.auth().currentUser;
      if (user) await user.updateProfile({ displayName: namaBaru });
      const userAktif = getSessionUser() || {};
      userAktif.nama = namaBaru;
      setSessionUser(userAktif);
    }

    tampilProfilNotif('Nama profil berhasil diperbarui!', 'success');
    btn.textContent = 'Tersimpan ✓';
    setTimeout(() => { btn.disabled = false; btn.textContent = 'Simpan'; }, 2000);

    // Sinkronkan ke UI dashboard langsung
    const headerNama = document.getElementById('namaUser') || document.getElementById('adminNamaBadge');
    if (headerNama) {
      if (headerNama.tagName === 'H1') headerNama.textContent = namaBaru;
      else headerNama.textContent = namaBaru;
    }
  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'Simpan';
    tampilProfilNotif(err.message || 'Gagal menyimpan nama profil.', 'error');
  }
}

async function handleGantiPasswordProfil() {
  const p1 = document.getElementById('passBaruProfil');
  const p2 = document.getElementById('passKonfirmasiProfil');
  const btn = document.getElementById('btnUpdatePassword');
  if (!p1 || !p2 || !btn) return;

  const val1 = p1.value;
  const val2 = p2.value;

  if (!val1 || val1.length < 6) {
    tampilProfilNotif('Kata sandi baru minimal 6 karakter.', 'error');
    return;
  }
  if (val1 !== val2) {
    tampilProfilNotif('Konfirmasi kata sandi tidak cocok. Pastikan kedua isian sama.', 'error');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Memperbarui...';
  try {
    if (typeof ubahKataSandi === 'function') {
      await ubahKataSandi(val1);
    } else {
      const user = firebase.auth().currentUser;
      if (!user) throw new Error('Sesi pengguna telah kedaluwarsa.');
      await user.updatePassword(val1);
    }
    tampilProfilNotif('Kata sandi berhasil diubah! Gunakan kata sandi baru untuk login berikutnya.', 'success');
    p1.value = '';
    p2.value = '';
    btn.textContent = 'Berhasil ✓';
    setTimeout(() => { btn.disabled = false; btn.textContent = 'Perbarui Kata Sandi'; }, 2500);
  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'Perbarui Kata Sandi';
    if (err.code === 'auth/requires-recent-login') {
      tampilProfilNotif('Demi keamanan, silakan keluar lalu masuk kembali sebelum mengubah kata sandi.', 'error');
    } else {
      tampilProfilNotif(err.message || 'Gagal mengubah kata sandi.', 'error');
    }
  }
}

async function handleKirimResetEmailProfil() {
  const btn = document.getElementById('btnResetViaEmail');
  const user = getSessionUser() || {};
  const email = user.email || (firebase.auth().currentUser ? firebase.auth().currentUser.email : '');

  if (!email) {
    tampilProfilNotif('Email akun tidak ditemukan.', 'error');
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Mengirim Link...';
  }

  try {
    if (typeof kirimResetPassword === 'function') {
      await kirimResetPassword(email);
    } else {
      await firebase.auth().sendPasswordResetEmail(email);
    }
    tampilProfilNotif('Tautan pemulihan kata sandi telah dikirim ke ' + email + '. Cek inbox atau spam Gmail Anda.', 'success');
    if (btn) btn.textContent = 'Link Terkirim ✓';
    setTimeout(() => { if (btn) { btn.disabled = false; btn.textContent = 'Kirim Link Reset ke Email'; } }, 3000);
  } catch (err) {
    if (btn) { btn.disabled = false; btn.textContent = 'Kirim Link Reset ke Email'; }
    tampilProfilNotif(err.message || 'Gagal mengirim link reset kata sandi.', 'error');
  }
}

// ===== HANDLER KONFIRMASI NISN SISWA =====
let dataSiswaTerverifikasiCache = null;

async function handlePeriksaNisn() {
  const inp = document.getElementById('inputNisnVerif');
  const btn = document.getElementById('btnCekNisn');
  const box = document.getElementById('boxPreviewSiswa');
  if (!inp || !btn) return;

  const nisn = inp.value.trim();
  if (!nisn) {
    tampilProfilNotif('Harap masukkan NISN Anda.', 'error');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Memeriksa...';
  try {
    const hasil = await periksaNisnSiswa(nisn);
    dataSiswaTerverifikasiCache = hasil;
    document.getElementById('previewNamaSiswa').textContent = hasil.nama;
    document.getElementById('previewMetaSiswa').textContent = `NISN: ${hasil.nisn} • Kelas: ${hasil.kelas} • Jurusan: ${hasil.jurusan}`;
    if (box) box.style.display = 'block';
    tampilProfilNotif('Data siswa ditemukan! Silakan klik tombol konfirmasi di bawah.', 'success');
  } catch (err) {
    if (box) box.style.display = 'none';
    dataSiswaTerverifikasiCache = null;
    tampilProfilNotif(err.message || 'Gagal memeriksa NISN.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '🔍 Periksa';
  }
}

function batalPreviewNisn() {
  const box = document.getElementById('boxPreviewSiswa');
  if (box) box.style.display = 'none';
  dataSiswaTerverifikasiCache = null;
}

async function handleKonfirmasiTautkanNisn() {
  if (!dataSiswaTerverifikasiCache) {
    tampilProfilNotif('Harap periksa NISN terlebih dahulu.', 'error');
    return;
  }

  const btn = document.getElementById('btnTautkanNisn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Menghubungkan...';
  }

  try {
    const updated = await konfirmasiTautkanNisn(dataSiswaTerverifikasiCache.nisn);
    tampilProfilNotif('Selamat! Akun Anda berhasil ditautkan sebagai Siswa (' + updated.nama + '). Halaman akan diperbarui...', 'success');
    setTimeout(() => {
      window.location.reload();
    }, 1200);
  } catch (err) {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '✓ Ya, Hubungkan Akun Saya';
    }
    tampilProfilNotif(err.message || 'Gagal menautkan NISN.', 'error');
  }
}

function bukaModalProfilDenganTabNisn() {
  bukaModalProfil();
  setTimeout(() => {
    const inp = document.getElementById('inputNisnVerif');
    if (inp) inp.focus();
  }, 300);
}

function toggleModeKlaim(mode) {
  const boxSiswa = document.getElementById('boxKlaimSiswa');
  const boxGuru = document.getElementById('boxKlaimGuru');
  const boxAdmin = document.getElementById('boxKlaimAdmin');
  const btnS = document.getElementById('btnPilihKlaimSiswa');
  const btnG = document.getElementById('btnPilihKlaimGuru');
  const btnA = document.getElementById('btnPilihKlaimAdmin');

  if (boxSiswa) boxSiswa.style.display = (mode === 'siswa') ? 'block' : 'none';
  if (boxGuru) boxGuru.style.display = (mode === 'guru') ? 'block' : 'none';
  if (boxAdmin) boxAdmin.style.display = (mode === 'admin') ? 'block' : 'none';

  if (btnS) {
    btnS.style.background = (mode === 'siswa') ? '#4f46e5' : '';
    btnS.style.color = (mode === 'siswa') ? '#fff' : '';
    btnS.style.borderColor = (mode === 'siswa') ? '#4f46e5' : '';
  }
  if (btnG) {
    btnG.style.background = (mode === 'guru') ? '#4f46e5' : '';
    btnG.style.color = (mode === 'guru') ? '#fff' : '';
    btnG.style.borderColor = (mode === 'guru') ? '#4f46e5' : '';
  }
  if (btnA) {
    btnA.style.background = (mode === 'admin') ? '#4f46e5' : '';
    btnA.style.color = (mode === 'admin') ? '#fff' : '';
    btnA.style.borderColor = (mode === 'admin') ? '#4f46e5' : '';
  }
}

async function handleKonfirmasiTautkanAdmin() {
  const inp = document.getElementById('inputAdminPasscode');
  const btn = document.getElementById('btnKlaimAdmin');
  if (!inp) return;
  const code = inp.value.trim();
  if (!code) {
    tampilProfilNotif('Harap masukkan kode sandi administrator.', 'error');
    return;
  }
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Memverifikasi...';
  }
  try {
    const updated = await konfirmasiTautkanAdmin(code);
    tampilProfilNotif('✓ Hak akses Administrator aktif! Mengalihkan ke Panel Admin...', 'success');
    setTimeout(() => {
      window.location.href = 'admin.html';
    }, 900);
  } catch (err) {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '🛡️ Klaim Akses Admin';
    }
    tampilProfilNotif(err.message || 'Kode administrator tidak valid.', 'error');
  }
}

// ===== HANDLER KONFIRMASI NIP GURU / WALAS =====
let dataGuruTerverifikasiCache = null;

async function handlePeriksaNip() {
  const inp = document.getElementById('inputNipVerif');
  const btn = document.getElementById('btnCekNip');
  const box = document.getElementById('boxPreviewGuru');
  if (!inp || !btn) return;

  const nip = inp.value.trim();
  if (!nip) {
    tampilProfilNotif('Harap masukkan NIP atau Kode Guru Anda.', 'error');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Memeriksa...';
  try {
    const hasil = await periksaNipGuru(nip);
    dataGuruTerverifikasiCache = hasil;
    document.getElementById('previewNamaGuru').textContent = hasil.nama;
    const statusWalas = hasil.isWalas ? `Wali Kelas ${hasil.walasKelasId}` : 'Guru Pengajar';
    document.getElementById('previewMetaGuru').textContent = `NIP: ${hasil.nip} • Mapel: ${hasil.mapel} • Peran: ${statusWalas}`;
    if (box) box.style.display = 'block';
    tampilProfilNotif('Data guru ditemukan! Silakan klik tombol konfirmasi di bawah.', 'success');
  } catch (err) {
    if (box) box.style.display = 'none';
    dataGuruTerverifikasiCache = null;
    tampilProfilNotif(err.message || 'Gagal memeriksa NIP.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '🔍 Periksa NIP';
  }
}

function batalPreviewGuru() {
  const box = document.getElementById('boxPreviewGuru');
  if (box) box.style.display = 'none';
  dataGuruTerverifikasiCache = null;
}

async function handleKonfirmasiTautkanGuru() {
  if (!dataGuruTerverifikasiCache) {
    tampilProfilNotif('Harap periksa NIP terlebih dahulu.', 'error');
    return;
  }

  const btn = document.getElementById('btnTautkanGuru');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Menghubungkan...';
  }

  try {
    const updated = await konfirmasiTautkanGuru(dataGuruTerverifikasiCache.nip);
    const roleTitle = updated.role === 'walas' ? `Wali Kelas (${updated.walasKelasId})` : 'Guru Pengajar';
    tampilProfilNotif('Selamat! Akun Anda berhasil ditautkan sebagai ' + roleTitle + ' (' + updated.nama + '). Mengalihkan...', 'success');
    setTimeout(() => {
      window.location.href = 'dashboard-guru.html';
    }, 1200);
  } catch (err) {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '✓ Ya, Hubungkan Akun Guru';
    }
    tampilProfilNotif(err.message || 'Gagal menautkan NIP.', 'error');
  }
}

