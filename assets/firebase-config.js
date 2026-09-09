// GANTI dengan konfigurasi Firebase project kamu sendiri.
// Cara ambil: Firebase Console -> Project Settings -> scroll ke bawah -> "Your apps" -> Web app (</> icon)
// Kalau belum ada web app terdaftar, klik "Add app" pilih Web.

const firebaseConfig = {
  apiKey: "ISI_API_KEY_DISINI",
  authDomain: "absensi-6e385.firebaseapp.com",
  databaseURL: "https://absensi-6e385-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "absensi-6e385",
  storageBucket: "absensi-6e385.appspot.com",
  messagingSenderId: "ISI_SENDER_ID",
  appId: "ISI_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
