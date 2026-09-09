document.getElementById('loginForm').addEventListener('submit', function (e) {
  e.preventDefault();

  const nisn = document.getElementById('nisn').value.trim();
  const password = document.getElementById('password').value;
  const errorMsg = document.getElementById('errorMsg');
  errorMsg.textContent = '';

  // Struktur data yang diharapkan di Firebase:
  // siswa/{nisn}/{nama, password, kelas}
  db.ref('siswa/' + nisn).once('value').then(function (snapshot) {
    const data = snapshot.val();

    if (!data) {
      errorMsg.textContent = 'NISN tidak ditemukan.';
      return;
    }

    if (data.password !== password) {
      errorMsg.textContent = 'Password salah.';
      return;
    }

    // simpan sesi sederhana di localStorage browser (bukan di code, aman dipakai)
    localStorage.setItem('nisn_aktif', nisn);
    window.location.href = 'dashboard.html';
  }).catch(function (err) {
    errorMsg.textContent = 'Terjadi kesalahan: ' + err.message;
  });
});
