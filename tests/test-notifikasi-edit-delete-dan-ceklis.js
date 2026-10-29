/**
 * test-notifikasi-edit-delete-dan-ceklis.js
 * 
 * Pengujian Terpadu WhatsApp Hub:
 * 1. Status Ceklis Pengiriman Persis WhatsApp (Ceklis 1 Abu, Ceklis 2 Abu, Ceklis 2 Biru)
 * 2. Fitur Edit Pesan (Mode edit bar, hak akses pengirim, tag "(diedit)", sinkronisasi local & RTDB)
 * 3. Fitur Hapus Pesan (Delete for everyone, hak akses pengirim & admin, penanda pesan terhapus)
 * 4. Fitur Notifikasi Dashboard (Toast melayang di sudut layar, web audio chime alert, deduplikasi)
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('================================================================');
console.log('🧪 PENGUJIAN NOTIFIKASI DASHBOARD, EDIT/DELETE PESAN & CEKLIS WA');
console.log('================================================================\n');

// -------------------------------------------------------------
// Persiapan Mock Environment (Browser & DOM)
// -------------------------------------------------------------
const mockLocalStorage = {};
const domStore = {};

function createMockElement(tag, id = '') {
  let _innerHTML = '';
  const el = {
    tagName: tag.toUpperCase(),
    id: id,
    value: '',
    textContent: '',
    style: {},
    children: [],
    classList: {
      _classes: new Set(),
      add: function (...args) { args.forEach(c => this._classes.add(c)); },
      remove: function (...args) { args.forEach(c => this._classes.delete(c)); },
      contains: function (c) { return this._classes.has(c); }
    },
    querySelectorAll: (selector) => {
      const matches = [];
      function traverse(node) {
        if (!node || !node.children) return;
        node.children.forEach(child => {
          if (selector.startsWith('.') && child.classList && child.classList.contains(selector.slice(1))) {
            matches.push(child);
          } else if (selector.startsWith('#') && child.id === selector.slice(1)) {
            matches.push(child);
          }
          traverse(child);
        });
      }
      traverse(el);
      return matches;
    },
    querySelector: (selector) => {
      const all = el.querySelectorAll(selector);
      return all.length > 0 ? all[0] : null;
    },
    appendChild: function (child) {
      this.children.push(child);
      if (child.id) domStore[child.id] = child;
      child.parentNode = this;
      return child;
    },
    insertBefore: function (newChild, refChild) {
      const idx = this.children.indexOf(refChild);
      if (idx !== -1) {
        this.children.splice(idx, 0, newChild);
      } else {
        this.children.push(newChild);
      }
      if (newChild.id) domStore[newChild.id] = newChild;
      newChild.parentNode = this;
      return newChild;
    },
    remove: function () {
      if (this.parentNode && this.parentNode.children) {
        const idx = this.parentNode.children.indexOf(this);
        if (idx !== -1) this.parentNode.children.splice(idx, 1);
      }
      if (this.id && domStore[this.id]) delete domStore[this.id];
    },
    focus: () => {}
  };

  let _className = '';
  Object.defineProperty(el, 'className', {
    get: () => _className,
    set: (v) => {
      _className = String(v || '');
      el.classList._classes.clear();
      _className.split(' ').filter(Boolean).forEach(c => el.classList.add(c));
    }
  });

  Object.defineProperty(el, 'innerHTML', {
    get: () => _innerHTML,
    set: (html) => {
      _innerHTML = html;
      el.children = [];
      const elemRegex = /<([a-z0-9]+)([^>]*)>/gi;
      let m;
      while ((m = elemRegex.exec(html)) !== null) {
        const tagName = m[1];
        const attrStr = m[2];
        const idMatch = /id=["']([^"']+)["']/i.exec(attrStr);
        const classMatch = /class=["']([^"']+)["']/i.exec(attrStr);
        const childEl = createMockElement(tagName, idMatch ? idMatch[1] : '');
        if (classMatch) {
          classMatch[1].split(' ').filter(Boolean).forEach(c => childEl.classList.add(c));
        }
        childEl.parentNode = el;
        el.children.push(childEl);
        if (childEl.id) domStore[childEl.id] = childEl;
      }
    }
  });

  if (id) domStore[id] = el;
  return el;
}

global.localStorage = {
  getItem: (k) => mockLocalStorage[k] || null,
  setItem: (k, v) => { mockLocalStorage[k] = String(v); },
  removeItem: (k) => { delete mockLocalStorage[k]; },
  clear: () => { Object.keys(mockLocalStorage).forEach(k => delete mockLocalStorage[k]); }
};

global.sessionStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {}
};

global.document = {
  getElementById: (id) => domStore[id] || null,
  createElement: (tag) => createMockElement(tag),
  body: createMockElement('body', 'body'),
  querySelectorAll: () => [],
  addEventListener: () => {}
};

global.window = {
  location: { pathname: '/dashboard.html', href: 'http://localhost/dashboard.html' },
  localStorage: global.localStorage,
  sessionStorage: global.sessionStorage,
  document: global.document,
  addEventListener: () => {},
  AudioContext: function() {
    return {
      currentTime: 0,
      createOscillator: () => ({
        type: 'sine',
        frequency: { setValueAtTime: () => {} },
        connect: () => {},
        start: () => {},
        stop: () => {}
      }),
      createGain: () => ({
        gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
        connect: () => {}
      }),
      destination: {}
    };
  }
};

const rtdbMemory = {};
const mockDb = {
  ref: (p) => ({
    update: async (data) => {
      rtdbMemory[p] = Object.assign(rtdbMemory[p] || {}, data);
      return true;
    },
    set: async (data) => {
      rtdbMemory[p] = data;
      return true;
    },
    on: () => {},
    off: () => {}
  })
};
global.db = mockDb;

// Load module chat-hub
const hub = require('../assets/chat-hub.js');

// -------------------------------------------------------------
// [TEST 1] Status Ceklis Pengiriman (Ceklis 1 Abu, Ceklis 2 Abu, Ceklis 2 Biru)
// -------------------------------------------------------------
console.log('▶ [Test 1] Pengujian Ceklis Status Pesan (Ceklis 1 Abu, Ceklis 2 Abu, Ceklis 2 Biru)...');

const sentHtml = hub.getCheckmarkIconHtml('sent');
assert.ok(sentHtml.includes('is-sent'), 'Status sent harus memiliki kelas CSS is-sent');
assert.ok(sentHtml.includes('✓'), 'Status sent harus berisi ceklis 1 (✓)');
assert.ok(!sentHtml.includes('✓✓'), 'Status sent tidak boleh berisi centang ganda');

const deliveredHtml = hub.getCheckmarkIconHtml('delivered');
assert.ok(deliveredHtml.includes('is-delivered'), 'Status delivered harus memiliki kelas CSS is-delivered');
assert.ok(deliveredHtml.includes('✓✓'), 'Status delivered harus berisi centang ganda (✓✓)');

const readHtml = hub.getCheckmarkIconHtml('read');
assert.ok(readHtml.includes('is-read'), 'Status read harus memiliki kelas CSS is-read');
assert.ok(readHtml.includes('✓✓'), 'Status read harus berisi centang ganda biru (✓✓)');

// Verifikasi aturan CSS di chat-hub.css
const cssContent = fs.readFileSync(path.join(__dirname, '../assets/chat-hub.css'), 'utf8');
assert.ok(cssContent.includes('.wa-check-icon.is-read'), 'CSS harus memiliki rule .wa-check-icon.is-read');
assert.ok(cssContent.includes('#38BDF8'), 'Warna centang biru dibaca harus #38BDF8');
assert.ok(cssContent.includes('#94A3B8'), 'Warna centang abu-abu harus #94A3B8');

console.log('  ✓ Format centang status pesan terbukti 100% konsisten persis WhatsApp.\n');

// -------------------------------------------------------------
// [TEST 2] Fitur Edit Pesan
// -------------------------------------------------------------
console.log('▶ [Test 2] Pengujian Fitur Edit Pesan (Mode Bar, Otorisasi, Label (diedit))...');

// Siapkan sesi pengguna aktif: Siswa Ihsan
mockLocalStorage['siswa_aktif'] = JSON.stringify({
  nisn: '0098263610',
  nama: 'M. IHSAN ATHALLAH',
  role: 'siswa',
  kelas: 'XII RPL 2'
});

const testRoomId = 'direct_0098263610_199209142022211007';
const testMsgId = 'MSG_TEST_EDIT_01';

// Simpan pesan awal ke localStorage
mockLocalStorage['wa_msgs_' + testRoomId] = JSON.stringify([
  {
    id: testMsgId,
    roomId: testRoomId,
    pengirimId: '0098263610',
    nama: 'M. IHSAN ATHALLAH',
    role: 'siswa',
    pesan: 'Pak, ini teks sebelum diedit',
    tipe: 'teks',
    status: 'sent',
    waktu: Date.now() - 1000
  }
]);

// Siapkan DOM elemen untuk UI chat
const editBar = createMockElement('div', 'waEditModeBar');
const editPreview = createMockElement('div', 'waEditModePreview');
const inputText = createMockElement('input', 'waInputText');
const bubbleEl = createMockElement('div', 'waBubble_' + testMsgId);
const bubbleText = createMockElement('div');
bubbleText.className = 'wa-bubble-text';
bubbleText.textContent = 'Pak, ini teks sebelum diedit';
const bubbleMeta = createMockElement('div');
bubbleMeta.className = 'wa-bubble-meta';
bubbleEl.appendChild(bubbleText);
bubbleEl.appendChild(bubbleMeta);

domStore['waEditModeBar'] = editBar;
domStore['waEditModePreview'] = editPreview;
domStore['waInputText'] = inputText;
domStore['waBubble_' + testMsgId] = bubbleEl;

// 2a. Mulai Edit
hub.mulaiEditPesanWa(testMsgId, testRoomId);
assert.strictEqual(editBar.style.display, 'flex', 'Edit bar harus muncul dengan display flex');
assert.strictEqual(editPreview.textContent, 'Pak, ini teks sebelum diedit', 'Preview teks di edit bar harus sesuai');
assert.strictEqual(inputText.value, 'Pak, ini teks sebelum diedit', 'Input text harus terisi teks lama untuk diedit');

// 2b. Simpan Edit
hub.simpanEditPesanWa(testMsgId, testRoomId, 'Pak, teks ini SUDAH DIEDIT');
assert.strictEqual(editBar.style.display, 'none', 'Edit bar harus tertutup setelah edit disimpan');

const updatedMsgs = JSON.parse(mockLocalStorage['wa_msgs_' + testRoomId]);
const editedTarget = updatedMsgs.find(m => m.id === testMsgId);
assert.ok(editedTarget, 'Pesan harus tetap ada di histori');
assert.strictEqual(editedTarget.pesan, 'Pak, teks ini SUDAH DIEDIT', 'Teks pesan harus terupdate di localStorage');
assert.strictEqual(editedTarget.isEdited, true, 'Flag isEdited harus bernilai true');
assert.ok(editedTarget.editedAt, 'Timestamp editedAt harus tercatat');

// Verifikasi RTDB diperbarui
const rtdbKey = 'chat_rooms/' + testRoomId + '/messages/' + testMsgId;
assert.ok(rtdbMemory[rtdbKey], 'RTDB harus menerima update pesan diedit');
assert.strictEqual(rtdbMemory[rtdbKey].pesan, 'Pak, teks ini SUDAH DIEDIT');
assert.strictEqual(rtdbMemory[rtdbKey].isEdited, true);

// 2c. Pengujian Larangan Edit Pesan Orang Lain
global.window.location = { pathname: '/dashboard-guru.html', href: 'http://localhost/dashboard-guru.html' };
mockLocalStorage['guru_aktif'] = JSON.stringify({
  nip: '199209142022211007',
  nama: 'Muhammad Echa Putra, S.Kom.Gr',
  role: 'guru',
  kelas: 'XII RPL 2'
});
// Hapus sesi siswa untuk simulasi sesi Guru
delete mockLocalStorage['siswa_aktif'];

// Pak Echa mencoba edit pesan milik Ihsan -> harus ditolak
let alertCalled = false;
global.alert = (msg) => { alertCalled = true; };
hub.mulaiEditPesanWa(testMsgId, testRoomId);
assert.ok(alertCalled, 'Harus memunculkan peringatan bahwa hanya pengirim yang dapat mengedit pesan');

console.log('  ✓ Fitur edit pesan terbukti aman, tersinkronisasi instan, dan terproteksi hak akses.\n');

// -------------------------------------------------------------
// [TEST 3] Fitur Hapus Pesan (Delete for Everyone)
// -------------------------------------------------------------
console.log('▶ [Test 3] Pengujian Fitur Hapus Pesan (Delete for Everyone)...');

// Kembalikan sesi ke Siswa Ihsan (pengirim) di dashboard.html
global.window.location = { pathname: '/dashboard.html', href: 'http://localhost/dashboard.html' };
mockLocalStorage['siswa_aktif'] = JSON.stringify({
  nisn: '0098263610',
  nama: 'M. IHSAN ATHALLAH',
  role: 'siswa',
  kelas: 'XII RPL 2'
});
delete mockLocalStorage['guru_aktif'];

global.confirm = () => true; // User menyetujui konfirmasi hapus

hub.hapusPesanWa(testMsgId, testRoomId);

const postDeleteMsgs = JSON.parse(mockLocalStorage['wa_msgs_' + testRoomId]);
const deletedMsg = postDeleteMsgs.find(m => m.id === testMsgId);
assert.ok(deletedMsg, 'Pesan harus tetap tercatat sebagai placeholder terhapus');
assert.strictEqual(deletedMsg.isDeleted, true, 'Flag isDeleted harus true');
assert.strictEqual(deletedMsg.pesan, '🚫 Pesan ini telah dihapus', 'Teks pesan harus diganti peringatan terhapus');

// Verifikasi RTDB menerima status terhapus
assert.strictEqual(rtdbMemory[rtdbKey].isDeleted, true, 'RTDB harus mencatat isDeleted: true');
assert.strictEqual(rtdbMemory[rtdbKey].pesan, '🚫 Pesan ini telah dihapus', 'RTDB harus menyimpan teks terhapus');

console.log('  ✓ Fitur hapus pesan terbukti mengganti konten dengan aman untuk semua pihak.\n');

// -------------------------------------------------------------
// [TEST 4] Fitur Notifikasi Dashboard & Audio Chime
// -------------------------------------------------------------
console.log('▶ [Test 4] Pengujian Notifikasi Dashboard (Toast Melayang & Audio Chime)...');

// Uji fungsi Web Audio Chime (tidak boleh error)
assert.doesNotThrow(() => {
  hub.mainkanSuaraNotifikasiChat();
}, 'mainkanSuaraNotifikasiChat tidak boleh melempar error');

// Simulasi pesan masuk dari pihak lain (Pak Echa kirim ke Ihsan)
const incomingMsg = {
  id: 'MSG_INCOMING_NOTIF_01',
  roomId: testRoomId,
  pengirimId: '199209142022211007',
  nama: 'Muhammad Echa Putra, S.Kom.Gr',
  role: 'guru',
  pesan: 'Tugas RPL Anda sudah dinilai',
  tipe: 'teks',
  waktu: Date.now()
};

// Pastikan container toast ada
const toastContainer = createMockElement('div', 'waToastContainer');
domStore['waToastContainer'] = toastContainer;

hub.tampilkanNotifikasiPesanBaru(incomingMsg, testRoomId);

assert.strictEqual(toastContainer.children.length, 1, 'Toast container harus memiliki 1 elemen toast');
const toastItem = toastContainer.children[0];
assert.ok(toastItem.classList.contains('wa-notif-toast'), 'Toast harus memiliki kelas wa-notif-toast');
assert.ok(toastItem.innerHTML.includes('Muhammad Echa Putra'), 'Toast harus memuat nama pengirim');
assert.ok(toastItem.innerHTML.includes('Tugas RPL Anda sudah dinilai'), 'Toast harus memuat teks pesan');
assert.ok(toastItem.innerHTML.includes('Pesan Baru'), 'Toast harus memiliki badge Pesan Baru');

// 4b. Uji deduplikasi: Memanggil ulang ID yang sama tidak boleh memunculkan toast ganda
hub.tampilkanNotifikasiPesanBaru(incomingMsg, testRoomId);
assert.strictEqual(toastContainer.children.length, 1, 'Deduplikasi harus mencegah notifikasi ganda untuk ID yang sama');

// 4c. Uji pencegahan self-notification: Pesan dari diri sendiri tidak boleh memunculkan notifikasi
const selfMsg = {
  id: 'MSG_SELF_NOTIF_02',
  roomId: testRoomId,
  pengirimId: '0098263610', // Sama dengan siswa_aktif
  nama: 'M. IHSAN ATHALLAH',
  role: 'siswa',
  pesan: 'Pesan saya sendiri',
  tipe: 'teks',
  waktu: Date.now()
};
hub.tampilkanNotifikasiPesanBaru(selfMsg, testRoomId);
assert.strictEqual(toastContainer.children.length, 1, 'Pesan dari diri sendiri DILARANG memicu notifikasi toast');

console.log('  ✓ Fitur notifikasi dashboard terbukti responsif, memiliki deduplikasi, dan bebas self-alert.\n');

// -------------------------------------------------------------
// [TEST 5] Pengujian Privasi Kontak (Pencegahan Spill Nomor ID & Kelas)
// -------------------------------------------------------------
console.log('▶ [Test 5] Pengujian Privasi Kontak (Pencegahan Spill Nomor ID & Kelas)...');

const panelBody = createMockElement('div', 'waPanelBody');
domStore['waPanelBody'] = panelBody;

hub.renderTabKontenWa(false);

assert.ok(panelBody.children.length > 0, 'Daftar kontak harus ter-render');
panelBody.children.forEach(item => {
  assert.ok(!item.innerHTML.includes('Nomor ID:'), 'Item kontak DILARANG memuat teks Nomor ID:');
  assert.ok(!item.innerHTML.includes('Kelas:'), 'Item kontak DILARANG memuat teks Kelas:');
  assert.ok(!item.innerHTML.includes('wa-item-sub'), 'Item kontak DILARANG memiliki baris sub spill ID/Kelas');
});

console.log('  ✓ Privasi kontak 100% terjaga: Nomor ID & Kelas terbukti tidak ke-spill di UI.\n');

console.log('================================================================');
console.log('🎉 SELURUH PENGUJIAN NOTIFIKASI, EDIT, DELETE & CEKLIS LULUS 100%!');
console.log('================================================================');
