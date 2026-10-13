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

  const isAdminPortal = (typeof window !== 'undefined' && window.location && (
    window.location.pathname.toLowerCase().includes('admin.html') ||
    window.location.href.toLowerCase().includes('admin.html')
  ));
  const isPublicDashboard = !isAdminPortal || (typeof window !== 'undefined' && window.location && (
    window.location.pathname.toLowerCase().endsWith('dashboard.html') ||
    window.location.href.toLowerCase().includes('dashboard.html') ||
    window.location.pathname.toLowerCase().includes('dashboard')
  ));
  const isAuthAdmin = isAdminPortal && (user.role === 'admin' || (user.email && typeof isEmailAdmin === 'function' && isEmailAdmin(user.email))) && !isPublicDashboard;

  const namaTampilan = user.nama || (isPengunjung ? 'Pengunjung / Tamu Sekolah' : 'Pengguna');
  const userEmail = user.email || (fbUser ? fbUser.email : '');

  overlay.innerHTML = `
    <div class="profile-modal-card">
      <div class="profile-modal-header">
        <div style="display:flex;align-items:center;gap:14px;">
          <div class="profile-avatar-circle">
            ${user.foto_google ? `<img src="${user.foto_google}" alt="Foto Profil">` : `<span>${initial}</span>`}
          </div>
          <div>
            <h2 class="profile-user-name">${namaTampilan}</h2>
            <div style="display:flex;align-items:center;gap:8px;margin-top:4px;flex-wrap:wrap;">
              <span class="profile-role-badge ${roleBadgeClass}">${roleLabel}</span>
              ${userEmail ? `<span style="font-size:12px;color:#64748b;font-weight:600;">${userEmail}</span>` : ''}
              ${isGoogle ? '<span class="profile-auth-tag google">Google Auth</span>' : '<span class="profile-auth-tag verified">Email/Password</span>'}
            </div>
          </div>
        </div>
        <button class="profile-btn-close" onclick="tutupModalProfil()" title="Tutup">✕</button>
      </div>

      <div class="profile-modal-body" style="padding:22px 24px;display:flex;flex-direction:column;gap:16px;">
        <!-- Notifikasi Feedback -->
        <div id="profilNotifBox" class="profile-notif-box" style="display:none;"></div>

        <!-- Section 0: Mode Pengujian & Switcher Peran (Khusus Administrator Terautentikasi pada Portal Admin) -->
        ${isAuthAdmin ? `
        <div id="sectionPresetAdmin" style="padding:16px;border:1.5px solid #6366f1;background:#f8faff;border-radius:16px;">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px;">
            <div>
              <h3 style="color:#3730a3;margin:0;font-size:14px;font-weight:800;">🔄 Beralih Peran & Mode Pengujian UJIKOM</h3>
              <p style="font-size:12px;color:#4f46e5;margin:3px 0 0 0;">Ganti identitas peran secara instan untuk verifikasi fitur tanpa relogin (Khusus Administrator):</p>
            </div>
            <span style="font-size:11px;font-weight:800;background:#e0e7ff;color:#3730a3;padding:3px 8px;border-radius:999px;">1-Click Preset (Admin Only)</span>
          </div>

          <!-- 1-Click Presets Grid -->
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:8px;">
            <!-- 1. Administrator Sistem -->
            <button type="button" onclick="pilihPresetRole('admin')" class="profile-preset-btn active" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1.5px solid #4f46e5;border-radius:12px;background:#ede9fe;cursor:pointer;text-align:left;">
              <span style="font-size:20px;">🛡️</span>
              <div>
                <div style="font-weight:800;font-size:13px;color:#1e1b4b;">Administrator Sistem</div>
                <div style="font-size:11px;color:#64748b;">Panel Admin & Otoritas Penuh</div>
              </div>
            </button>

            <!-- 2. Wali Kelas XII RPL 1 -->
            <button type="button" onclick="pilihPresetRole('walas', 'rpl1')" class="profile-preset-btn ${(user.role === 'walas' && user.walasKelasId === 'XII RPL 1') ? 'active' : ''}" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1.5px solid ${(user.role === 'walas' && user.walasKelasId === 'XII RPL 1') ? '#10b981' : '#e2e8f0'};border-radius:12px;background:${(user.role === 'walas' && user.walasKelasId === 'XII RPL 1') ? '#dcfce7' : '#ffffff'};cursor:pointer;text-align:left;">
              <span style="font-size:20px;">👨‍🏫</span>
              <div>
                <div style="font-weight:800;font-size:13px;color:#14532d;">Walas XII RPL 1</div>
                <div style="font-size:11px;color:#64748b;">Rijal Nur Rahmat, S.T</div>
              </div>
            </button>

            <!-- 3. Wali Kelas XII RPL 2 -->
            <button type="button" onclick="pilihPresetRole('walas')" class="profile-preset-btn ${(user.role === 'walas' && user.walasKelasId === 'XII RPL 2') ? 'active' : ''}" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1.5px solid ${(user.role === 'walas' && user.walasKelasId === 'XII RPL 2') ? '#10b981' : '#e2e8f0'};border-radius:12px;background:${(user.role === 'walas' && user.walasKelasId === 'XII RPL 2') ? '#dcfce7' : '#ffffff'};cursor:pointer;text-align:left;">
              <span style="font-size:20px;">👨‍🏫</span>
              <div>
                <div style="font-weight:800;font-size:13px;color:#14532d;">Walas XII RPL 2</div>
                <div style="font-size:11px;color:#64748b;">M. Echa Putra, S.Kom.Gr</div>
              </div>
            </button>

            <!-- 4. Wali Kelas XII TKJ 2 -->
            <button type="button" onclick="pilihPresetRole('walas', 'tkj2')" class="profile-preset-btn ${(user.role === 'walas' && user.walasKelasId === 'XII TKJ 2') ? 'active' : ''}" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1.5px solid ${(user.role === 'walas' && user.walasKelasId === 'XII TKJ 2') ? '#10b981' : '#e2e8f0'};border-radius:12px;background:${(user.role === 'walas' && user.walasKelasId === 'XII TKJ 2') ? '#dcfce7' : '#ffffff'};cursor:pointer;text-align:left;">
              <span style="font-size:20px;">👨‍🏫</span>
              <div>
                <div style="font-weight:800;font-size:13px;color:#14532d;">Walas XII TKJ 2</div>
                <div style="font-size:11px;color:#64748b;">Heri Anggara, S.Kom</div>
              </div>
            </button>

            <!-- 5. Guru Pengajar: Hani Hanifah, S.Si -->
            <button type="button" onclick="pilihPresetRole('guru')" class="profile-preset-btn ${(user.role === 'guru' && user.nip === '198109012009022003') ? 'active' : ''}" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1.5px solid ${(user.role === 'guru' && user.nip === '198109012009022003') ? '#3b82f6' : '#e2e8f0'};border-radius:12px;background:${(user.role === 'guru' && user.nip === '198109012009022003') ? '#e0e7ff' : '#ffffff'};cursor:pointer;text-align:left;">
              <span style="font-size:20px;">👩‍🏫</span>
              <div>
                <div style="font-weight:800;font-size:13px;color:#1e3a8a;">Guru: Hani Hanifah, S.Si</div>
                <div style="font-size:11px;color:#64748b;">Pengajar PWB (Read-Only)</div>
              </div>
            </button>

            <!-- 6. Guru Pengajar: Hali, ST -->
            <button type="button" onclick="pilihPresetRole('guru', 'hali')" class="profile-preset-btn ${(user.role === 'guru' && user.nip === '197905032006042004') ? 'active' : ''}" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1.5px solid ${(user.role === 'guru' && user.nip === '197905032006042004') ? '#3b82f6' : '#e2e8f0'};border-radius:12px;background:${(user.role === 'guru' && user.nip === '197905032006042004') ? '#e0e7ff' : '#ffffff'};cursor:pointer;text-align:left;">
              <span style="font-size:20px;">👨‍🏫</span>
              <div>
                <div style="font-weight:800;font-size:13px;color:#1e3a8a;">Guru: Hali, ST</div>
                <div style="font-size:11px;color:#64748b;">Pengajar RPL (Read-Only)</div>
              </div>
            </button>

            <!-- 7. Siswa Resmi: M. Ihsan Athallah -->
            <button type="button" onclick="pilihPresetRole('siswa', 'ihsan')" class="profile-preset-btn ${(user.role === 'siswa' && user.nisn === '0098263610') ? 'active' : ''}" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1.5px solid ${(user.role === 'siswa' && user.nisn === '0098263610') ? '#6366f1' : '#e2e8f0'};border-radius:12px;background:${(user.role === 'siswa' && user.nisn === '0098263610') ? '#f5f3ff' : '#ffffff'};cursor:pointer;text-align:left;">
              <span style="font-size:20px;">🎓</span>
              <div>
                <div style="font-weight:800;font-size:13px;color:#0f172a;">Siswa: M. Ihsan Athallah</div>
                <div style="font-size:11px;color:#64748b;">0098263610 • XII RPL 2</div>
              </div>
            </button>

            <!-- 7b. Siswa Resmi: Rizky Ramadhani -->
            <button type="button" onclick="pilihPresetRole('siswa', 'rizky')" class="profile-preset-btn ${(user.role === 'siswa' && user.nisn === '0082104129') ? 'active' : ''}" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1.5px solid ${(user.role === 'siswa' && user.nisn === '0082104129') ? '#6366f1' : '#e2e8f0'};border-radius:12px;background:${(user.role === 'siswa' && user.nisn === '0082104129') ? '#f5f3ff' : '#ffffff'};cursor:pointer;text-align:left;">
              <span style="font-size:20px;">🎓</span>
              <div>
                <div style="font-weight:800;font-size:13px;color:#0f172a;">Siswa: Rizky Ramadhani</div>
                <div style="font-size:11px;color:#64748b;">0082104129 • XII RPL 2</div>
              </div>
            </button>

            <!-- 8. Pengunjung / Tamu Sekolah -->
            <button type="button" onclick="pilihPresetRole('pengunjung')" class="profile-preset-btn ${isPengunjung ? 'active' : ''}" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1.5px solid ${isPengunjung ? '#64748b' : '#e2e8f0'};border-radius:12px;background:${isPengunjung ? '#f1f5f9' : '#ffffff'};cursor:pointer;text-align:left;">
              <span style="font-size:20px;">👤</span>
              <div>
                <div style="font-weight:800;font-size:13px;color:#334155;">Pengunjung / Tamu Sekolah</div>
                <div style="font-size:11px;color:#64748b;">Mode Umum (Tanpa Klaim)</div>
              </div>
            </button>
          </div>
        </div>
        ` : ''}

        <!-- Section: Identitas & Verifikasi (Unified Flow) -->
        ${isPengunjung ? `
        <!-- Form Verifikasi Resmi untuk Pengunjung / Tamu -->
        <div style="padding:16px 18px;border:1.5px solid #6366f1;background:#f8faff;border-radius:16px;">
          <div style="margin-bottom:12px;">
            <h3 style="color:#3730a3;margin:0;font-size:14.5px;font-weight:800;">🎓 Verifikasi Identitas Resmi</h3>
            <p style="font-size:12.5px;color:#4f46e5;margin:3px 0 0 0;">Hubungkan akun ini secara resmi dengan NISN Siswa atau NIP Guru / Wali Kelas:</p>
          </div>

          <div id="boxAccordionKlaim" style="display:block;">
            <div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap;">
              <button type="button" class="profile-btn-secondary" id="btnPilihKlaimSiswa" onclick="toggleModeKlaim('siswa')" style="padding:6px 12px;font-size:12px;background:#4f46e5;color:#fff;border-color:#4f46e5;font-weight:700;border-radius:8px;">🎓 1. Siswa (NISN)</button>
              <button type="button" class="profile-btn-secondary" id="btnPilihKlaimGuru" onclick="toggleModeKlaim('guru')" style="padding:6px 12px;font-size:12px;font-weight:700;border-radius:8px;">👩‍🏫 2. Guru Biasa (NIP)</button>
              <button type="button" class="profile-btn-secondary" id="btnPilihKlaimWalas" onclick="toggleModeKlaim('walas')" style="padding:6px 12px;font-size:12px;font-weight:700;border-radius:8px;">👨‍🏫 3. Wali Kelas (NIP)</button>
            </div>

            <!-- Mode Klaim Siswa -->
            <div id="boxKlaimSiswa">
              <p style="font-size:12.5px;color:#4338ca;line-height:1.45;margin:0 0 10px 0;">
                Masukkan 10 digit NISN Anda untuk menghubungkan akun ini dengan data resmi siswa SMKN 1 Sumedang serta mengaktifkan kartu pintar presensi RFID dan status KBM kelas.
              </p>
              <div class="profile-field-row" style="margin-bottom:0;">
                <label for="inputNisnVerif" style="font-size:11px;font-weight:700;color:#64748b;margin-bottom:4px;display:block;">Nomor Induk Siswa Nasional (NISN)</label>
                <div style="display:flex;gap:8px;align-items:center;">
                  <input type="text" id="inputNisnVerif" class="profile-input" placeholder="Masukkan 10 digit NISN (Contoh: 0012345678)" maxlength="12"
                         onkeydown="if(event.key==='Enter') handlePeriksaNisn()">
                  <button type="button" class="profile-btn-action" onclick="handlePeriksaNisn()" id="btnCekNisn">🔍 Periksa NISN</button>
                </div>
              </div>
              <div id="boxPreviewSiswa" style="display:none;margin-top:12px;padding:12px 14px;background:#ffffff;border:1px solid #c7d2fe;border-radius:12px;">
                <div style="font-size:11px;font-weight:700;color:#6366f1;text-transform:uppercase;margin-bottom:3px;">Data Siswa Ditemukan:</div>
                <div style="font-size:14.5px;font-weight:800;color:#1e293b;" id="previewNamaSiswa">-</div>
                <div style="font-size:12.5px;color:#64748b;margin-top:2px;" id="previewMetaSiswa">-</div>
                <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
                  <button type="button" class="profile-btn-action" onclick="handleKonfirmasiTautkanNisn()" id="btnTautkanNisn" style="background:#059669;border-color:#059669;padding:8px 14px;font-size:12.5px;">✓ Ya, Hubungkan Akun Siswa</button>
                  <button type="button" class="profile-btn-secondary" onclick="batalPreviewNisn()" style="padding:8px 14px;font-size:12.5px;">Batal</button>
                </div>
              </div>
            </div>

            <!-- Mode Klaim Guru Biasa -->
            <div id="boxKlaimGuru" style="display:none;">
              <p style="font-size:12.5px;color:#4338ca;line-height:1.45;margin:0 0 10px 0;">
                Verifikasi Guru Pengajar SMKN 1 Sumedang (Tanpa tugas Wali Kelas).
              </p>
              <div class="profile-field-row" style="margin-bottom:0;">
                <label for="inputNipVerif" style="font-size:11px;font-weight:700;color:#64748b;margin-bottom:4px;display:block;">NIP Guru Pengajar (Guru Biasa)</label>
                <div style="display:flex;gap:8px;align-items:center;">
                  <input type="text" id="inputNipVerif" class="profile-input" placeholder="Masukkan 18 digit NIP resmi (Contoh: 198501012010011001)" maxlength="20"
                         onkeydown="if(event.key==='Enter') handlePeriksaNip('guru')">
                  <button type="button" class="profile-btn-action" onclick="handlePeriksaNip('guru')" id="btnCekNip">🔍 Periksa NIP</button>
                </div>
              </div>
              <div id="boxPreviewGuru" style="display:none;margin-top:12px;padding:12px 14px;background:#ffffff;border:1px solid #c7d2fe;border-radius:12px;">
                <div style="font-size:11px;font-weight:700;color:#6366f1;text-transform:uppercase;margin-bottom:3px;">Data Guru Terverifikasi:</div>
                <div style="font-size:14.5px;font-weight:800;color:#1e293b;" id="previewNamaGuru">-</div>
                <div style="font-size:12.5px;color:#64748b;margin-top:2px;" id="previewMetaGuru">-</div>
                <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
                  <button type="button" class="profile-btn-action" onclick="handleKonfirmasiTautkanGuru()" id="btnTautkanGuru" style="background:#059669;border-color:#059669;padding:8px 14px;font-size:12.5px;">✓ Ya, Hubungkan Akun Guru</button>
                  <button type="button" class="profile-btn-secondary" onclick="batalPreviewGuru()" style="padding:8px 14px;font-size:12.5px;">Batal</button>
                </div>
              </div>
            </div>

            <!-- Mode Klaim Wali Kelas -->
            <div id="boxKlaimWalas" style="display:none;">
              <p style="font-size:12.5px;color:#4338ca;line-height:1.45;margin:0 0 10px 0;">
                Verifikasi Wali Kelas resmi SMKN 1 Sumedang untuk mengawasi kelas binaan (Monitoring Presensi, Alert 06.30-08.00, & ACC Izin).
              </p>
              <div class="profile-field-row" style="margin-bottom:0;">
                <label for="inputNipWalasVerif" style="font-size:11px;font-weight:700;color:#64748b;margin-bottom:4px;display:block;">NIP Wali Kelas</label>
                <div style="display:flex;gap:8px;align-items:center;">
                  <input type="text" id="inputNipWalasVerif" class="profile-input" placeholder="Masukkan 18 digit NIP Walas (Contoh: 198501012010011001)" maxlength="20"
                         onkeydown="if(event.key==='Enter') handlePeriksaNip('walas')">
                  <button type="button" class="profile-btn-action" onclick="handlePeriksaNip('walas')" id="btnCekNipWalas">🔍 Periksa NIP Walas</button>
                </div>
              </div>
              <div id="boxPreviewWalas" style="display:none;margin-top:12px;padding:12px 14px;background:#ffffff;border:1.5px solid #10b981;border-radius:12px;">
                <div style="font-size:11px;font-weight:700;color:#059669;text-transform:uppercase;margin-bottom:3px;">Data Wali Kelas Terverifikasi:</div>
                <div style="font-size:14.5px;font-weight:800;color:#1e293b;" id="previewNamaWalas">-</div>
                <div style="font-size:12.5px;color:#64748b;margin-top:2px;" id="previewMetaWalas">-</div>
                <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
                  <button type="button" class="profile-btn-action" onclick="handleKonfirmasiTautkanGuru()" id="btnTautkanWalas" style="background:#059669;border-color:#059669;padding:8px 14px;font-size:12.5px;">✓ Ya, Hubungkan Akun Wali Kelas</button>
                  <button type="button" class="profile-btn-secondary" onclick="batalPreviewWalas()" style="padding:8px 14px;font-size:12.5px;">Batal</button>
                </div>
              </div>
            </div>
          </div>
        </div>
        ` : (user.role !== 'admin' ? `
        <!-- Ringkasan Identitas Resmi Akun Terverifikasi (Read-Only) -->
        <div style="padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
            <span style="font-size:20px;">🛡️</span>
            <div>
              <div style="font-weight:800;font-size:13.5px;color:#0f172a;">Identitas Resmi Terverifikasi</div>
              <div style="font-size:11.5px;color:#64748b;">Data resmi tersinkronisasi dengan Database SMKN 1 Sumedang</div>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:8px;">
            ${user.nisn ? `
            <div style="padding:8px 12px;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;">
              <div style="font-size:10.5px;font-weight:700;color:#64748b;text-transform:uppercase;">NISN</div>
              <div style="font-size:13px;font-weight:800;color:#0f172a;">${user.nisn}</div>
            </div>` : ''}
            ${user.kelas ? `
            <div style="padding:8px 12px;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;">
              <div style="font-size:10.5px;font-weight:700;color:#64748b;text-transform:uppercase;">Rombel / Kelas</div>
              <div style="font-size:13px;font-weight:800;color:#0f172a;">${user.kelas}</div>
            </div>` : ''}
            ${user.nip ? `
            <div style="padding:8px 12px;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;">
              <div style="font-size:10.5px;font-weight:700;color:#64748b;text-transform:uppercase;">NIP</div>
              <div style="font-size:13px;font-weight:800;color:#0f172a;">${user.nip}</div>
            </div>` : ''}
            ${user.mapel ? `
            <div style="padding:8px 12px;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;">
              <div style="font-size:10.5px;font-weight:700;color:#64748b;text-transform:uppercase;">Mata Pelajaran</div>
              <div style="font-size:13px;font-weight:800;color:#0f172a;">${user.mapel}</div>
            </div>` : ''}
          </div>
        </div>
        ` : '')}

        <!-- Keamanan & Kata Sandi (Unified) -->
        <div style="padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;">
          <h3 style="font-size:13.5px;font-weight:800;color:#1e293b;margin:0 0 10px 0;">🔒 Keamanan & Kata Sandi</h3>

          ${isGoogle ? `
            <div class="profile-google-note" style="margin:0;">
              <div class="google-icon-box">
                <svg width="22" height="22" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
              </div>
              <div>
                <strong style="font-size:13px;">Autentikasi Akun Google</strong>
                <p style="font-size:12px;margin:2px 0 0 0;color:#64748b;">Akun ini masuk melalui Google Sign-In. Keamanan dan kata sandi dikelola langsung oleh akun Google Anda.</p>
              </div>
            </div>
          ` : `
            <div class="profile-field-row" style="margin-bottom:10px;">
              <label for="passSaatIniProfil" style="font-size:11px;font-weight:700;color:#64748b;margin-bottom:4px;display:block;">Kata Sandi Saat Ini</label>
              <div class="profile-input-pw-wrap">
                <input type="password" id="passSaatIniProfil" class="profile-input" placeholder="Masukkan kata sandi lama / saat ini" autocomplete="current-password">
                <button type="button" class="btn-toggle-eye" onclick="togglePasswordProfil('passSaatIniProfil', this)">
                  <svg class="eye-open" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                  <svg class="eye-closed" style="display:none;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                </button>
              </div>
            </div>

            <div class="profile-field-row" style="margin-bottom:10px;">
              <label for="passBaruProfil" style="font-size:11px;font-weight:700;color:#64748b;margin-bottom:4px;display:block;">Kata Sandi Baru</label>
              <div class="profile-input-pw-wrap">
                <input type="password" id="passBaruProfil" class="profile-input" placeholder="Minimal 6 karakter" autocomplete="new-password">
                <button type="button" class="btn-toggle-eye" onclick="togglePasswordProfil('passBaruProfil', this)">
                  <svg class="eye-open" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                  <svg class="eye-closed" style="display:none;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                </button>
              </div>
            </div>

            <div class="profile-field-row" style="margin-bottom:12px;">
              <label for="passKonfirmasiProfil" style="font-size:11px;font-weight:700;color:#64748b;margin-bottom:4px;display:block;">Konfirmasi Kata Sandi Baru</label>
              <div class="profile-input-pw-wrap">
                <input type="password" id="passKonfirmasiProfil" class="profile-input" placeholder="Ketik ulang kata sandi baru" autocomplete="new-password">
                <button type="button" class="btn-toggle-eye" onclick="togglePasswordProfil('passKonfirmasiProfil', this)">
                  <svg class="eye-open" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                  <svg class="eye-closed" style="display:none;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                </button>
              </div>
            </div>

            <div style="display:flex;gap:10px;flex-wrap:wrap;">
              <button class="profile-btn-action" onclick="handleGantiPasswordProfil()" id="btnUpdatePassword" style="padding:9px 16px;font-size:13px;">Perbarui Kata Sandi</button>
              <button class="profile-btn-secondary" onclick="handleKirimResetEmailProfil()" id="btnResetViaEmail" style="padding:9px 16px;font-size:13px;">Kirim Link Reset ke Email</button>
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
  const pCurrent = document.getElementById('passSaatIniProfil');
  const p1 = document.getElementById('passBaruProfil');
  const p2 = document.getElementById('passKonfirmasiProfil');
  const btn = document.getElementById('btnUpdatePassword');
  if (!p1 || !p2 || !btn) return;

  const valCurrent = pCurrent ? pCurrent.value : '';
  const val1 = p1.value;
  const val2 = p2.value;

  if (pCurrent && !valCurrent) {
    tampilProfilNotif('Harap masukkan kata sandi saat ini terlebih dahulu.', 'error');
    pCurrent.focus();
    return;
  }
  if (!val1 || val1.length < 6) {
    tampilProfilNotif('Kata sandi baru minimal 6 karakter.', 'error');
    p1.focus();
    return;
  }
  if (valCurrent && val1 === valCurrent) {
    tampilProfilNotif('Kata sandi baru tidak boleh sama dengan kata sandi saat ini.', 'error');
    p1.focus();
    return;
  }
  if (val1 !== val2) {
    tampilProfilNotif('Konfirmasi kata sandi tidak cocok. Pastikan kedua isian sama.', 'error');
    p2.focus();
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Memverifikasi...';
  try {
    if (typeof ubahKataSandi === 'function') {
      await ubahKataSandi(val1, valCurrent);
    } else {
      const user = (typeof firebase !== 'undefined' && firebase.auth) ? firebase.auth().currentUser : null;
      if (!user) throw new Error('Sesi pengguna telah kedaluwarsa.');
      if (valCurrent && user.email && firebase.auth.EmailAuthProvider && typeof user.reauthenticateWithCredential === 'function') {
        const cred = firebase.auth.EmailAuthProvider.credential(user.email, valCurrent);
        await user.reauthenticateWithCredential(cred);
      }
      await user.updatePassword(val1);
    }
    tampilProfilNotif('Kata sandi berhasil diubah! Gunakan kata sandi baru untuk login berikutnya.', 'success');
    if (pCurrent) pCurrent.value = '';
    p1.value = '';
    p2.value = '';
    btn.textContent = 'Berhasil ✓';
    setTimeout(() => { btn.disabled = false; btn.textContent = 'Perbarui Kata Sandi'; }, 2500);
  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'Perbarui Kata Sandi';
    if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential' || (err.message && err.message.toLowerCase().includes('saat ini salah'))) {
      tampilProfilNotif('Kata sandi saat ini salah. Pastikan kata sandi lama Anda benar.', 'error');
      if (pCurrent) pCurrent.focus();
    } else if (err.code === 'auth/requires-recent-login') {
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

function toggleAccordionKlaim() {
  const box = document.getElementById('boxAccordionKlaim');
  const btn = document.getElementById('btnToggleAccordionKlaim');
  if (!box) return;
  const isHidden = box.style.display === 'none';
  box.style.display = isHidden ? 'block' : 'none';
  if (btn) btn.textContent = isHidden ? 'Sembunyikan Form Verifikasi ▴' : 'Tampilkan Form Verifikasi ▾';
}

function bukaModalProfilDenganTabNisn() {
  bukaModalProfil();
  setTimeout(() => {
    const box = document.getElementById('boxAccordionKlaim');
    const btn = document.getElementById('btnToggleAccordionKlaim');
    if (box) box.style.display = 'block';
    if (btn) btn.textContent = 'Sembunyikan Form Verifikasi ▴';
    if (typeof toggleModeKlaim === 'function') toggleModeKlaim('siswa');
    const inp = document.getElementById('inputNisnVerif');
    if (inp) inp.focus();
  }, 250);
}

function bukaModalProfilDenganTabNip(mode) {
  const targetMode = mode || 'walas';
  bukaModalProfil();
  setTimeout(() => {
    const box = document.getElementById('boxAccordionKlaim');
    const btn = document.getElementById('btnToggleAccordionKlaim');
    if (box) box.style.display = 'block';
    if (btn) btn.textContent = 'Sembunyikan Form Verifikasi ▴';
    if (typeof toggleModeKlaim === 'function') toggleModeKlaim(targetMode);
    const inp = targetMode === 'walas' ? document.getElementById('inputNipWalasVerif') : document.getElementById('inputNipVerif');
    if (inp) inp.focus();
  }, 250);
}

function toggleModeKlaim(mode) {
  const boxSiswa = document.getElementById('boxKlaimSiswa');
  const boxGuru = document.getElementById('boxKlaimGuru');
  const boxWalas = document.getElementById('boxKlaimWalas');
  const btnS = document.getElementById('btnPilihKlaimSiswa');
  const btnG = document.getElementById('btnPilihKlaimGuru');
  const btnW = document.getElementById('btnPilihKlaimWalas');

  if (boxSiswa) boxSiswa.style.display = (mode === 'siswa') ? 'block' : 'none';
  if (boxGuru) boxGuru.style.display = (mode === 'guru') ? 'block' : 'none';
  if (boxWalas) boxWalas.style.display = (mode === 'walas') ? 'block' : 'none';

  [
    [btnS, 'siswa'],
    [btnG, 'guru'],
    [btnW, 'walas']
  ].forEach(([btn, key]) => {
    if (btn) {
      btn.style.background = (mode === key) ? '#4f46e5' : '';
      btn.style.color = (mode === key) ? '#fff' : '';
      btn.style.borderColor = (mode === key) ? '#4f46e5' : '';
    }
  });
}

// ===== HANDLER KONFIRMASI NIP GURU / WALAS =====
let dataGuruTerverifikasiCache = null;

async function handlePeriksaNip(source) {
  const isWalasMode = source === 'walas';
  const inp = isWalasMode ? (document.getElementById('inputNipWalasVerif') || document.getElementById('inputNipVerif')) : document.getElementById('inputNipVerif');
  const btn = isWalasMode ? (document.getElementById('btnCekNipWalas') || document.getElementById('btnCekNip')) : document.getElementById('btnCekNip');
  const box = isWalasMode ? document.getElementById('boxPreviewWalas') : document.getElementById('boxPreviewGuru');
  if (!inp || !btn) return;

  const nip = inp.value.trim();
  if (!nip) {
    tampilProfilNotif('Harap masukkan NIP Anda.', 'error');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Memeriksa...';
  try {
    const hasil = await periksaNipGuru(nip);
    dataGuruTerverifikasiCache = hasil;
    const elNama = isWalasMode ? document.getElementById('previewNamaWalas') : document.getElementById('previewNamaGuru');
    const elMeta = isWalasMode ? document.getElementById('previewMetaWalas') : document.getElementById('previewMetaGuru');
    if (elNama) elNama.textContent = hasil.nama;
    const statusPeran = hasil.isWalas ? `Wali Kelas ${hasil.walasKelasId}` : 'Guru Biasa (Pengajar)';
    if (elMeta) elMeta.textContent = `NIP: ${hasil.nip} • Mapel: ${hasil.mapel} • Peran Terdeteksi: ${statusPeran}`;

    const btnTautWalas = document.getElementById('btnTautkanWalas');
    const btnTautGuru = document.getElementById('btnTautkanGuru');
    const labelTaut = hasil.isWalas ? `✓ Ya, Hubungkan Akun Wali Kelas (${hasil.walasKelasId})` : '✓ Ya, Hubungkan Akun Guru Biasa';
    if (btnTautWalas) btnTautWalas.textContent = labelTaut;
    if (btnTautGuru) btnTautGuru.textContent = labelTaut;

    if (box) box.style.display = 'block';
    tampilProfilNotif(`Data terverifikasi: ${hasil.nama} (${statusPeran}). Silakan klik tombol hubungkan.`, 'success');
  } catch (err) {
    if (box) box.style.display = 'none';
    dataGuruTerverifikasiCache = null;
    tampilProfilNotif(err.message || 'Gagal memeriksa NIP.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = isWalasMode ? '🔍 Periksa NIP Walas' : '🔍 Periksa NIP';
  }
}

function batalPreviewGuru() {
  const box = document.getElementById('boxPreviewGuru');
  if (box) box.style.display = 'none';
  dataGuruTerverifikasiCache = null;
}

function batalPreviewWalas() {
  const box = document.getElementById('boxPreviewWalas');
  if (box) box.style.display = 'none';
  dataGuruTerverifikasiCache = null;
}

async function handleKonfirmasiTautkanGuru() {
  if (!dataGuruTerverifikasiCache) {
    tampilProfilNotif('Harap periksa NIP terlebih dahulu.', 'error');
    return;
  }

  const btnWalas = document.getElementById('btnTautkanWalas');
  const btnGuru = document.getElementById('btnTautkanGuru');
  [btnWalas, btnGuru].forEach(b => {
    if (b) {
      b.disabled = true;
      b.textContent = 'Menghubungkan...';
    }
  });

  try {
    const updated = await konfirmasiTautkanGuru(dataGuruTerverifikasiCache.nip);
    const roleTitle = updated.role === 'walas' ? `Wali Kelas (${updated.walasKelasId})` : 'Guru Pengajar';
    tampilProfilNotif('Selamat! Akun Anda berhasil ditautkan sebagai ' + roleTitle + ' (' + updated.nama + '). Mengalihkan...', 'success');
    setTimeout(() => {
      window.location.href = 'dashboard-guru.html';
    }, 1200);
  } catch (err) {
    [btnWalas, btnGuru].forEach(b => {
      if (b) {
        b.disabled = false;
        b.textContent = b.id === 'btnTautkanWalas' ? '✓ Ya, Hubungkan Akun Wali Kelas' : '✓ Ya, Hubungkan Akun Guru Biasa';
      }
    });
    tampilProfilNotif(err.message || 'Gagal menautkan NIP.', 'error');
  }
}

// ===== HANDLER PRESET ROLE SWITCHER (UJIKOM 2026) =====
async function pilihPresetRole(role, subType) {
  const isPublicPage = (typeof window !== 'undefined' && window.location && (
    window.location.pathname.toLowerCase().endsWith('dashboard.html') ||
    window.location.href.toLowerCase().includes('dashboard.html') ||
    window.location.pathname.toLowerCase().endsWith('/dashboard') ||
    window.location.pathname.toLowerCase() === '/dashboard' ||
    window.location.pathname.toLowerCase().endsWith('index.html') ||
    window.location.pathname.toLowerCase() === '/'
  ));
  const currentSess = (typeof getSessionUser === 'function') ? getSessionUser() : null;
  const isRoleSwitched = (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('isRoleSwitched') === 'true');
  const isAuthAdmin = currentSess && (
    currentSess.role === 'admin' || 
    (currentSess.email && typeof isEmailAdmin === 'function' && isEmailAdmin(currentSess.email)) ||
    (isRoleSwitched && currentSess.role !== 'pengunjung')
  );

  // Prohibit preset switcher from public dashboard or unauthorized users
  if (isPublicPage || !isAuthAdmin) {
    tampilProfilNotif('Akses Ditolak: Fitur switcher peran pengujian dibatasi khusus Administrator pada portal admin.', 'error');
    return;
  }

  if (role === 'admin' && (!currentSess || (currentSess.role !== 'admin' && !isRoleSwitched && (!currentSess.email || !isEmailAdmin(currentSess.email))))) {
    tampilProfilNotif('Akses Ditolak: Hak akses Administrator hanya dapat diperoleh melalui portal login khusus di admin-login.html.', 'error');
    return;
  }
  tampilProfilNotif(`Mengalihkan peran sesi aktif ke ${role.toUpperCase()}...`, 'success');

  let payload = {};
  if (role === 'admin') {
    payload = {
      role: 'admin',
      nama: 'Administrator Sistem',
      isVerified: true,
      nisn: null,
      kelas: null,
      nip: null,
      mapel: null,
      isWalas: false,
      walasKelasId: null
    };
  } else if (role === 'walas') {
    if (subType === 'rpl1') {
      payload = {
        role: 'walas',
        nama: 'Rijal Nur Rahmat, S.T',
        nip: '198312052022211017',
        mapel: 'Administrasi Infrastruktur Jaringan',
        isWalas: true,
        walasKelasId: 'XII RPL 1',
        isVerified: true,
        nisn: null,
        kelas: null
      };
    } else if (subType === 'tkj2') {
      payload = {
        role: 'walas',
        nama: 'Heri Anggara, S.Kom',
        nip: '198504252024211008',
        mapel: 'Teknologi Jaringan & Komputer',
        isWalas: true,
        walasKelasId: 'XII TKJ 2',
        isVerified: true,
        nisn: null,
        kelas: null
      };
    } else {
      payload = {
        role: 'walas',
        nama: 'Muhammad Echa Putra, S.Kom.Gr',
        nip: '199209142022211007',
        mapel: 'Basis Data & Pemodelan RPL',
        isWalas: true,
        walasKelasId: 'XII RPL 2',
        isVerified: true,
        nisn: null,
        kelas: null
      };
    }
  } else if (role === 'guru') {
    if (subType === 'hali') {
      payload = {
        role: 'guru',
        nama: 'Hali, ST',
        nip: '197905032006042004',
        mapel: 'Informatika & Rekayasa Perangkat Lunak',
        isWalas: false,
        walasKelasId: null,
        isVerified: true,
        nisn: null,
        kelas: null
      };
    } else {
      payload = {
        role: 'guru',
        nama: 'Hani Hanifah, S.Si',
        nip: '198109012009022003',
        mapel: 'Pemrograman Web & Perangkat Bergerak',
        isWalas: false,
        walasKelasId: null,
        isVerified: true,
        nisn: null,
        kelas: null
      };
    }
  } else if (role === 'siswa') {
    if (subType === 'rizky') {
      payload = {
        role: 'siswa',
        nama: 'Rizky Ramadhani',
        nisn: '0082104129',
        kelas: 'XII RPL 2',
        isVerified: true,
        nip: null,
        mapel: null,
        isWalas: false,
        walasKelasId: null
      };
    } else {
      payload = {
        role: 'siswa',
        nama: 'M. Ihsan Athallah',
        nisn: '0098263610',
        kelas: 'XII RPL 2',
        isVerified: true,
        nip: null,
        mapel: null,
        isWalas: false,
        walasKelasId: null
      };
    }
  } else {
    role = 'pengunjung';
    payload = {
      role: 'pengunjung',
      nama: 'Pengunjung / Tamu Sekolah',
      nisn: null,
      kelas: null,
      nip: null,
      mapel: null,
      isWalas: false,
      walasKelasId: null,
      isVerified: false
    };
  }

  try {
    if (typeof gantiRoleSesi === 'function') {
      await gantiRoleSesi(role, payload);
    } else {
      setSessionUser(payload);
      const url = (typeof getDashboardUrlByRole === 'function') ? getDashboardUrlByRole(role) : 'dashboard.html';
      window.location.href = url;
    }
  } catch (err) {
    tampilProfilNotif('Gagal beralih peran: ' + err.message, 'error');
  }
}

if (typeof window !== 'undefined') {
  window.pilihPresetRole = pilihPresetRole;
  window.toggleAccordionKlaim = toggleAccordionKlaim;
}

