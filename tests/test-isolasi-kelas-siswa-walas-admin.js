const assert = require('assert');
const fs = require('fs');

console.log('=== TEST ISOLASI KELAS: SISWA, WALI KELAS, & ADMIN ===\n');

// Mock DOM
function buatElemenDOM(tag) {
  return {
    tagName: (tag || '').toUpperCase(),
    value: '',
    textContent: '',
    innerHTML: '',
    style: {},
    children: [],
    options: [],
    appendChild(child) {
      this.children.push(child);
      if (child.tagName === 'OPTION') this.options.push(child);
      return child;
    },
    querySelector: () => buatElemenDOM('div'),
    querySelectorAll: () => [],
    classList: { add: () => {}, remove: () => {}, contains: () => false },
    addEventListener: () => {},
    removeEventListener: () => {},
    set innerHTML(val) {
      if (val === '') {
        this.children = [];
        this.options = [];
      }
    }
  };
}

const mockSelectPantau = Object.assign(buatElemenDOM('select'), { id: 'pilihKelasPantau', value: 'XII RPL 2' });
const mockSelectHome = Object.assign(buatElemenDOM('select'), { id: 'pilihKelasHome', value: 'XII RPL 2' });

global.document = {
  getElementById: (id) => {
    if (id === 'pilihKelasPantau') return mockSelectPantau;
    if (id === 'pilihKelasHome') return mockSelectHome;
    return buatElemenDOM('div');
  },
  createElement: (tag) => buatElemenDOM(tag)
};

const dash = require('../assets/dashboard.js');
const { perbaruiDropdownKelasPantau, onKelasPantauGanti } = dash;

// 1. Siswa Terkunci pada Kelasnya Sendiri
const userSiswa = {
  role: 'siswa',
  nama: 'M. IHSAN ATHALLAH',
  nisn: '0098263610',
  kelas: 'XII RPL 2'
};

global.currentUser = userSiswa;

const selPantau = document.getElementById('pilihKelasPantau');
const selHome = document.getElementById('pilihKelasHome');

perbaruiDropdownKelasPantau('XII RPL 1'); // Siswa coba request RPL 1
assert.strictEqual(selPantau.value, 'XII RPL 2', 'Dropdown pantau siswa harus tetap terkunci di XII RPL 2');
assert.strictEqual(selPantau.disabled, true, 'Dropdown pantau siswa harus disabled');
assert.strictEqual(selPantau.options.length, 1, 'Dropdown pantau siswa hanya memuat 1 opsi kelas miliknya');
console.log('[PASS 1] Siswa terisolasi: selector terkunci disabled dan hanya memuat kelas miliknya sendiri.');

// Coba panggil onKelasPantauGanti dengan kelas lain
onKelasPantauGanti('XII TKJ 1');
assert.strictEqual(selPantau.value, 'XII RPL 2', 'onKelasPantauGanti untuk siswa tidak boleh berpindah ke XII TKJ 1');
console.log('[PASS 2] onKelasPantauGanti menolak perpindahan kelas oleh siswa.');

// 2. Walas Terkunci pada Kelas Binaan (dashboard-guru.js)
const dashGuru = require('../assets/dashboard-guru.js');
const { gantiKelasBinaanWalas, setGuruAktif, getKelasBinaanAktif } = dashGuru;

const walasObj = {
  role: 'walas',
  nama: 'Muhammad Echa Putra, S.Kom.Gr',
  nip: '199209142022211007',
  isWalas: true,
  walasKelasId: 'XII RPL 2',
  email: 'ihsan33roblox@gmail.com'
};
global.guruAktif = walasObj;
if (typeof setGuruAktif === 'function') setGuruAktif(walasObj);

gantiKelasBinaanWalas('XII TKJ 1'); // Walas coba ganti ke TKJ 1
assert.strictEqual(getKelasBinaanAktif(), 'XII RPL 2', 'Kelas binaan walas harus tetap terkunci pada kelas aslinya');
console.log('[PASS 3] Wali Kelas terisolasi: gantiKelasBinaanWalas menolak perpindahan ke kelas lain.');

// 3. Admin Bebas Akses Semua Kelas
const adminObj = {
  role: 'admin',
  nama: 'Super Admin',
  email: 'admin@smkn1sumedang.sch.id'
};
global.guruAktif = adminObj;
if (typeof setGuruAktif === 'function') setGuruAktif(adminObj);

gantiKelasBinaanWalas('XII TKJ 1');
assert.strictEqual(getKelasBinaanAktif(), 'XII TKJ 1', 'Admin bebas berpindah kelas binaan supervisi');
console.log('[PASS 4] Admin memiliki akses supervisi bebas ke seluruh kelas.');

console.log('\n🎉 SEMUA PENGUJIAN ISOLASI HAK AKSES KELAS 100% SUKSES!');
