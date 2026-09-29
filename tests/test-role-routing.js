const assert = require('assert');

function getDashboardUrlByRole(role) {
  if (role === 'admin') return 'admin.html';
  if (role === 'guru') return 'dashboard-guru.html';
  return 'dashboard.html';
}

// Skenario 1: Admin Routing
assert.strictEqual(getDashboardUrlByRole('admin'), 'admin.html', 'Admin should route to admin.html');

// Skenario 2: Guru Routing
assert.strictEqual(getDashboardUrlByRole('guru'), 'dashboard-guru.html', 'Guru should route to dashboard-guru.html');

// Skenario 3: Siswa Routing
assert.strictEqual(getDashboardUrlByRole('siswa'), 'dashboard.html', 'Siswa should route to dashboard.html');

// Skenario 4: Default fallback
assert.strictEqual(getDashboardUrlByRole('ortu'), 'dashboard.html', 'Ortu should route to dashboard.html');
assert.strictEqual(getDashboardUrlByRole(undefined), 'dashboard.html', 'Undefined should route to dashboard.html');

console.log('SEMUA SKENARIO ROLE ROUTING LOLOS ✅');
