const assert = require('assert');

function getDashboardUrlByRole(role) {
  if (role === 'admin') return 'admin.html';
  if (role === 'guru' || role === 'walas') return 'dashboard-guru.html';
  return 'dashboard.html';
}

// Skenario 1: Admin Routing
assert.strictEqual(getDashboardUrlByRole('admin'), 'admin.html', 'Admin should route to admin.html');

// Skenario 2: Guru & Walas Routing
assert.strictEqual(getDashboardUrlByRole('guru'), 'dashboard-guru.html', 'Guru should route to dashboard-guru.html');
assert.strictEqual(getDashboardUrlByRole('walas'), 'dashboard-guru.html', 'Walas should route to dashboard-guru.html');

// Skenario 3: Siswa & Pengunjung Routing
assert.strictEqual(getDashboardUrlByRole('siswa'), 'dashboard.html', 'Siswa should route to dashboard.html');
assert.strictEqual(getDashboardUrlByRole('pengunjung'), 'dashboard.html', 'Pengunjung should route to dashboard.html');

// Skenario 4: Default fallback (deprecated ortu and undefined route safely to dashboard.html)
assert.strictEqual(getDashboardUrlByRole('ortu'), 'dashboard.html', 'Deprecated ortu should fall back to dashboard.html');
assert.strictEqual(getDashboardUrlByRole(undefined), 'dashboard.html', 'Undefined should route to dashboard.html');

console.log('SEMUA SKENARIO ROLE ROUTING LOLOS ✅');
