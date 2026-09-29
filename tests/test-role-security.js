const assert = require('assert');

// 1. Role Routing Helper Test
function getDashboardUrlByRole(role) {
  if (role === 'admin') return 'admin.html';
  if (role === 'guru') return 'dashboard-guru.html';
  return 'dashboard.html';
}

assert.strictEqual(getDashboardUrlByRole('admin'), 'admin.html');
assert.strictEqual(getDashboardUrlByRole('guru'), 'dashboard-guru.html');
assert.strictEqual(getDashboardUrlByRole('siswa'), 'dashboard.html');
assert.strictEqual(getDashboardUrlByRole('ortu'), 'dashboard.html');

// 2. Role Assignment Security Logic Test
function resolveUserRole(mapped, requestedRole) {
  return (mapped && (mapped.role === 'guru' || mapped.role === 'admin'))
    ? mapped.role
    : (requestedRole === 'ortu' ? 'ortu' : 'siswa');
}

// Case A: User attempts to register as 'guru' publicly without admin mapping
assert.strictEqual(resolveUserRole(null, 'guru'), 'siswa', 'Public register cannot self-assign guru');

// Case B: User attempts to register as 'admin' publicly without admin mapping
assert.strictEqual(resolveUserRole(null, 'admin'), 'siswa', 'Public register cannot self-assign admin');

// Case C: Legitimate Ortu registration
assert.strictEqual(resolveUserRole(null, 'ortu'), 'ortu', 'Ortu can register as ortu');

// Case D: Legitimate Siswa registration
assert.strictEqual(resolveUserRole(null, 'siswa'), 'siswa', 'Siswa can register as siswa');

// Case E: Admin has pre-mapped teacher email in email_mapping
const teacherMapping = { role: 'guru', nip: '19850101', mapel: 'Matematika' };
assert.strictEqual(resolveUserRole(teacherMapping, 'siswa'), 'guru', 'Admin pre-mapped guru gets guru role');

// Case F: Admin pre-mapped admin email
const adminMapping = { role: 'admin' };
assert.strictEqual(resolveUserRole(adminMapping, 'siswa'), 'admin', 'Admin pre-mapped admin gets admin role');

console.log('SEMUA TEST ROLE SECURITY & ROUTING LOLOS 100% ✅');
