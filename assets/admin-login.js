document.getElementById('adminLoginForm').addEventListener('submit', function (e) {
  e.preventDefault();

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const errorMsg = document.getElementById('errorMsg');
  errorMsg.textContent = '';

  // Struktur data yang diharapkan di Firebase:
  // admin/{username}/{password}
  db.ref('admin/' + username).once('value').then(function (snapshot) {
    const data = snapshot.val();

    if (!data) {
      errorMsg.textContent = 'Username tidak ditemukan.';
      return;
    }

    if (data.password !== password) {
      errorMsg.textContent = 'Password salah.';
      return;
    }

    localStorage.setItem('admin_aktif', username);
    window.location.href = 'admin.html';
  }).catch(function (err) {
    errorMsg.textContent = 'Terjadi kesalahan: ' + err.message;
  });
});
