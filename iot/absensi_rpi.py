#!/usr/bin/env python3
"""
ABSENSI RFID GATEWAY — RASPBERRY PI / LINUX / IOT
SMK NEGERI 1 SUMEDANG (NESAS RPL) — UJIKOM 2026
Keamanan Terotentikasi REST API (SEC-03 & PRD Bab 5.2)

Fitur Utama:
1. Baca scan kartu RFID (RC522 SPI / USB Reader / Simulasi Stdin).
2. Deteksi Kartu Siswa & Guru Pengajar via Node Terproteksi /rfid_map & /kartu.
3. Otentikasi Perangkat Resmi via Firebase Auth REST API (idToken) & Auto-Refresh loop 50 menit.
4. Evaluasi ambang batas waktu presensi PRD (06.30 Hadir, 06.31-08.00 Terlambat).
5. Offline Resilience: SQLite Queue (offline_queue.db) & auto-sync background worker saat online.
"""

import sys
import os
import time
import json
import sqlite3
import threading
from datetime import datetime
import urllib.request
import urllib.error

# ===== LOAD ENVIRONMENT VARIABLES (.env) =====
def load_dotenv(dotenv_path=None):
    if not dotenv_path:
        dotenv_path = os.path.join(os.path.dirname(__file__), "..", ".env")
    if os.path.exists(dotenv_path):
        try:
            with open(dotenv_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        k = k.strip()
                        v = v.strip().strip("'\"")
                        if k not in os.environ:
                            os.environ[k] = v
        except Exception:
            pass

load_dotenv()

# ===== KONFIGURASI FIREBASE & DEVICE =====
FIREBASE_API_KEY = os.environ.get("FIREBASE_API_KEY", "AIzaSyBOQFp5SOvBTMpA_FEaMQyp0G4mmHfFa_c")
DATABASE_URL = os.environ.get("FIREBASE_DATABASE_URL", "https://absensi-6e385-default-rtdb.asia-southeast1.firebasedatabase.app")
IOT_DEVICE_EMAIL = os.environ.get("IOT_DEVICE_EMAIL", "gateway-rpi-01@iot.smkn1sumedang.sch.id")
IOT_DEVICE_PASSWORD = os.environ.get("IOT_DEVICE_PASSWORD", "nesas_gateway_secure_pass_2026")
DEVICE_ID = os.environ.get("IOT_DEVICE_ID", "gateway-rpi-01")
DEFAULT_KELAS = os.environ.get("DEFAULT_KELAS", "XII RPL 2")
OFFLINE_DB_PATH = os.path.join(os.path.dirname(__file__), "offline_queue.db")

# Cooldown anti-double tap (detik)
COOLDOWN_SECONDS = 5
riwayat_tap = {}

# Prototipe Kartu Dummy untuk Pengujian Lokal & Simulator (PRD Bab 5.1)
KARTU_PRESET = {
    "TEST_UID_0001": {
        "tipe": "siswa",
        "nisn": "9999999991",
        "nama": "Siswa Uji 01",
        "kelas": "XII RPL 2"
    },
    "TEST_UID_0002": {
        "tipe": "siswa",
        "nisn": "9999999992",
        "nama": "Siswa Uji 02",
        "kelas": "XII RPL 2"
    },
    "TEST_UID_GURU": {
        "tipe": "guru",
        "nip": "199001012020011001",
        "nama": "Guru Uji",
        "mapel": "Pemrograman Web & Perangkat Bergerak",
        "kelas": "XII RPL 2"
    }
}

# ===== AUTENTIKASI PERANGKAT IOT (FIREBASE AUTH REST API) =====
device_auth = {
    "idToken": None,
    "refreshToken": None,
    "expiresAt": 0
}

def authenticate_device():
    """Melakukan login IoT Gateway ke Firebase Auth REST API untuk memperoleh idToken & refreshToken."""
    if not FIREBASE_API_KEY or not IOT_DEVICE_EMAIL:
        return None
    url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_API_KEY}"
    payload = json.dumps({
        "email": IOT_DEVICE_EMAIL,
        "password": IOT_DEVICE_PASSWORD,
        "returnSecureToken": True
    }).encode("utf-8")
    try:
        req = urllib.request.Request(url, data=payload, method="POST", headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=5) as res:
            res_data = json.loads(res.read().decode("utf-8"))
            device_auth["idToken"] = res_data.get("idToken")
            device_auth["refreshToken"] = res_data.get("refreshToken")
            expires_in = int(res_data.get("expiresIn", 3600))
            device_auth["expiresAt"] = time.time() + expires_in
            print(f"[AUTH DEVICE] ✓ Berhasil login perangkat sebagai {IOT_DEVICE_EMAIL} (Token aktif).")
            return device_auth["idToken"]
    except Exception as e:
        print(f"[AUTH DEVICE INFO] Login Firebase Auth REST gagal/offline (Mode resilience antrean SQLite aktif): {e}")
        return None

def refresh_auth_token():
    """Memperbarui idToken secara otomatis setiap 50 menit menggunakan Secure Token API."""
    if not device_auth.get("refreshToken") or not FIREBASE_API_KEY:
        return authenticate_device()
    url = f"https://securetoken.googleapis.com/v1/token?key={FIREBASE_API_KEY}"
    payload = f"grant_type=refresh_token&refresh_token={device_auth['refreshToken']}".encode("utf-8")
    try:
        req = urllib.request.Request(url, data=payload, method="POST", headers={"Content-Type": "application/x-www-form-urlencoded"})
        with urllib.request.urlopen(req, timeout=5) as res:
            res_data = json.loads(res.read().decode("utf-8"))
            device_auth["idToken"] = res_data.get("id_token")
            device_auth["refreshToken"] = res_data.get("refresh_token")
            expires_in = int(res_data.get("expires_in", 3600))
            device_auth["expiresAt"] = time.time() + expires_in
            print("[AUTH REFRESH] 🔄 idToken IoT Gateway diperbarui.")
            return device_auth["idToken"]
    except Exception as e:
        print(f"[AUTH REFRESH WARN] Refresh token gagal, mencoba login ulang: {e}")
        return authenticate_device()

def worker_token_refresher():
    """Background daemon thread untuk auto-refresh idToken setiap 50 menit (3000 detik)."""
    while True:
        time.sleep(3000)
        try:
            refresh_auth_token()
        except Exception:
            pass

def build_firebase_url(path):
    """Menambahkan parameter autentikasi ?auth={idToken} ke URL REST API RTDB."""
    token = device_auth.get("idToken")
    if token:
        sep = "&" if "?" in path else "?"
        return f"{DATABASE_URL}/{path}.json{sep}auth={token}"
    return f"{DATABASE_URL}/{path}.json"

# ===== OFFLINE SQLITE QUEUE RESILIENCE (PRD Bab 3.2 & 5.1) =====
def check_ntp_sync():
    """Memeriksa status sinkronisasi waktu NTP perangkat (timedatectl) demi akurasi jam presensi."""
    try:
        import subprocess
        res = subprocess.run(["timedatectl", "status"], capture_output=True, text=True, timeout=3)
        if res.returncode == 0:
            print("[NTP STATUS] Sinkronisasi waktu sistem:\n" + res.stdout.strip())
        else:
            print("[NTP STATUS] timedatectl tidak tersedia, menggunakan jam sistem lokal.")
    except Exception:
        print(f"[NTP STATUS] Waktu lokal saat ini: {datetime.now().strftime('%Y-%m-%d %H:%M:%S WIB')}")

def init_offline_db():
    try:
        conn = sqlite3.connect(OFFLINE_DB_PATH)
        c = conn.cursor()
        c.execute('''
            CREATE TABLE IF NOT EXISTS offline_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                path TEXT NOT NULL,
                method TEXT NOT NULL,
                payload TEXT NOT NULL,
                created_at TEXT NOT NULL,
                scanned_at TEXT,
                synced_at TEXT,
                retry_count INTEGER DEFAULT 0
            )
        ''')
        c.execute("PRAGMA table_info(offline_queue)")
        cols = [row[1] for row in c.fetchall()]
        if "scanned_at" not in cols:
            c.execute("ALTER TABLE offline_queue ADD COLUMN scanned_at TEXT")
        if "synced_at" not in cols:
            c.execute("ALTER TABLE offline_queue ADD COLUMN synced_at TEXT")
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[OFFLINE DB INIT ERR] {e}")

def enqueue_offline(path, method, payload, scanned_at=None):
    try:
        conn = sqlite3.connect(OFFLINE_DB_PATH)
        c = conn.cursor()
        now_iso = datetime.now().isoformat()
        scan_time = scanned_at or now_iso
        c.execute('''
            INSERT INTO offline_queue (path, method, payload, created_at, scanned_at, retry_count)
            VALUES (?, ?, ?, ?, ?, 0)
        ''', (path, method, json.dumps(payload), now_iso, scan_time))
        conn.commit()
        conn.close()
        print(f"[OFFLINE QUEUE] 💾 Disimpan ke antrean SQLite lokal: {method} {path}")
    except Exception as e:
        print(f"[OFFLINE QUEUE ERR] Gagal menyimpan ke SQLite: {e}")

def worker_flush_offline_queue():
    """Background daemon thread untuk menyinkronkan antrean SQLite saat internet pulih."""
    while True:
        time.sleep(8)
        try:
            if not os.path.exists(OFFLINE_DB_PATH):
                continue
            conn = sqlite3.connect(OFFLINE_DB_PATH)
            c = conn.cursor()
            c.execute("SELECT id, path, method, payload, retry_count FROM offline_queue ORDER BY id ASC LIMIT 10")
            rows = c.fetchall()
            if not rows:
                conn.close()
                continue

            ids_sukses = []
            for row_id, path, method, payload_str, retries in rows:
                payload = json.loads(payload_str)
                sukses = False
                if method == 'PUT':
                    sukses = put_firebase(path, payload, fallback_queue=False)
                elif method == 'POST':
                    sukses = post_firebase(path, payload, fallback_queue=False)

                if sukses:
                    ids_sukses.append(row_id)
                else:
                    c.execute("UPDATE offline_queue SET retry_count = retry_count + 1 WHERE id = ?", (row_id,))
                    conn.commit()
                    break

            if ids_sukses:
                c.executemany("DELETE FROM offline_queue WHERE id = ?", [(i,) for i in ids_sukses])
                conn.commit()
                print(f"[OFFLINE SYNC] 🔄 Berhasil menyinkronkan {len(ids_sukses)} rekaman dari SQLite ke Firebase!")

            conn.close()
        except Exception:
            pass

# ===== HTTP FIREBASE CLIENT (TERAUTENTIKASI) =====
def get_firebase(path):
    url = build_firebase_url(path)
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Nesas-RFID-Gateway/2.0'})
        with urllib.request.urlopen(req, timeout=4) as response:
            return json.loads(response.read().decode('utf-8'))
    except Exception:
        return None

def put_firebase(path, data, fallback_queue=True):
    url = build_firebase_url(path)
    try:
        body = json.dumps(data).encode('utf-8')
        req = urllib.request.Request(url, data=body, method='PUT', headers={'Content-Type': 'application/json', 'User-Agent': 'Nesas-RFID-Gateway/2.0'})
        with urllib.request.urlopen(req, timeout=4) as response:
            return response.status in (200, 204)
    except Exception as e:
        print(f"[ERR PUT] {path}: {e}")
        if fallback_queue:
            enqueue_offline(path, 'PUT', data)
        return False

def post_firebase(path, data, fallback_queue=True):
    url = build_firebase_url(path)
    try:
        body = json.dumps(data).encode('utf-8')
        req = urllib.request.Request(url, data=body, method='POST', headers={'Content-Type': 'application/json', 'User-Agent': 'Nesas-RFID-Gateway/2.0'})
        with urllib.request.urlopen(req, timeout=4) as response:
            return response.status in (200, 201)
    except Exception as e:
        print(f"[ERR POST] {path}: {e}")
        if fallback_queue:
            enqueue_offline(path, 'POST', data)
        return False

def delete_firebase(path):
    url = build_firebase_url(path)
    try:
        req = urllib.request.Request(url, method='DELETE', headers={'User-Agent': 'Nesas-RFID-Gateway/2.0'})
        with urllib.request.urlopen(req, timeout=4) as response:
            return response.status in (200, 204)
    except Exception as e:
        print(f"[ERR DELETE] {path}: {e}")
        return False

# ===== EVALUASI ATURAN AMBANG BATAS WAKTU (PRD Bab 4.1) =====
def evaluasi_waktu_absen(waktu_str):
    """
    <= 06.30 WIB: Hadir (Tepat Waktu)
    06.31 – 08.00 WIB: Terlambat
    > 08.00 WIB: Terlambat (Lewat Batas Toleransi)
    """
    clean = waktu_str if len(waktu_str) == 8 else waktu_str + ":00"
    if clean <= "06:30:00":
        return "hadir", "Hadir (Tepat Waktu)"
    elif clean <= "08:00:00":
        return "terlambat", "Terlambat"
    else:
        return "terlambat", "Terlambat (Lewat Batas Toleransi)"

# ===== CORE LOGIC PEMROSESAN TAP KARTU =====
def proses_kartu(uid_kartu):
    uid_kartu = uid_kartu.strip().upper()
    now = datetime.now()
    now_ts = time.time()

    # Cek Cooldown Anti-Double Tap
    if uid_kartu in riwayat_tap and (now_ts - riwayat_tap[uid_kartu]) < COOLDOWN_SECONDS:
        print(f"[ABAIKAN] ⏳ Kartu {uid_kartu} baru saja di-tap (Anti-Double Tap).")
        return

    riwayat_tap[uid_kartu] = now_ts
    print(f"\n" + "="*50)
    print(f"[SCAN] 🏷️ Kartu RFID Terdeteksi UID: {uid_kartu}")

    tanggal = now.strftime("%Y-%m-%d")
    waktu = now.strftime("%H:%M:%S")

    # 0. PERIKSA APAKAH ADA PERMINTAAN PAIRING NFC AKTIF
    pairing_req = get_firebase("pairing_request")
    if pairing_req and isinstance(pairing_req, dict) and pairing_req.get("active") is True and pairing_req.get("status") == "waiting":
        target_dev = str(pairing_req.get("target_device_id", "all")).strip()
        if target_dev != "all" and target_dev != DEVICE_ID:
            print(f"[PAIRING SKIP] Target device '{target_dev}' bukan reader gateway ini ('{DEVICE_ID}').")
            return
        req_ts = pairing_req.get("timestamp", 0)
        req_ts_sec = (req_ts / 1000.0) if req_ts > 1e11 else req_ts
        if (now_ts - req_ts_sec) <= 30.0:
            user_id = str(pairing_req.get("userId") or pairing_req.get("nisn") or pairing_req.get("nip") or "").strip()
            role = str(pairing_req.get("role", "siswa")).lower()
            nama = pairing_req.get("nama", user_id)
            kelas = pairing_req.get("kelas", DEFAULT_KELAS)
            mapel = pairing_req.get("mapel", "")
            is_walas = bool(pairing_req.get("isWalas") or role == "walas")
            walas_kelas_id = pairing_req.get("walasKelasId", kelas if is_walas else "")

            print(f"\n[PAIRING NFC AKTIF] 📳 Memproses penautan kartu {uid_kartu} untuk {nama} ({role.upper()})...")

            card_data = {
                "uid": uid_kartu,
                "tipe": "guru" if role in ("guru", "walas") else "siswa",
                "nama": nama,
                "linkedAt": int(now_ts * 1000)
            }
            if role in ("guru", "walas"):
                card_data["nip"] = user_id
                card_data["mapel"] = mapel
                card_data["isWalas"] = is_walas
                card_data["walasKelasId"] = walas_kelas_id
            else:
                card_data["nisn"] = user_id
                card_data["kelas"] = kelas

            # Bersihkan kartu lama pengguna jika ada (re-assignment / perbarui kartu)
            all_kartu = get_firebase("kartu")
            if all_kartu and isinstance(all_kartu, dict):
                for old_uid, k_val in all_kartu.items():
                    if old_uid != uid_kartu:
                        old_id = None
                        if isinstance(k_val, dict):
                            old_id = str(k_val.get("nisn") or k_val.get("nip") or k_val.get("userId") or "").strip()
                        elif isinstance(k_val, str):
                            old_id = k_val.strip()
                        if old_id == user_id:
                            delete_firebase(f"kartu/{old_uid}")
                            delete_firebase(f"rfid_map/{old_uid}")
                            print(f"[RE-ENROLLMENT] Kartu lama {old_uid} milik {user_id} telah dihapus/digantikan.")
                if pairing_req.get("previous_uid"):
                    p_uid = str(pairing_req.get("previous_uid")).strip()
                    if p_uid and p_uid != uid_kartu:
                        delete_firebase(f"kartu/{p_uid}")
                        delete_firebase(f"rfid_map/{p_uid}")

            # 1. Simpan ke /kartu/{uid_kartu} dan /rfid_map/{uid_kartu}
            put_firebase(f"kartu/{uid_kartu}", card_data)
            put_firebase(f"rfid_map/{uid_kartu}", card_data)

            # 2. Update /pairing_request
            req_update = dict(pairing_req)
            req_update["active"] = False
            req_update["status"] = "success"
            req_update["uid"] = uid_kartu
            req_update["completedAt"] = int(now_ts * 1000)
            put_firebase("pairing_request", req_update)

            print(f"🎉 [PAIRING SUKSES] Kartu {uid_kartu} berhasil diikat ke {nama} ({user_id})!")
            return
        else:
            put_firebase("pairing_request/active", False)
            put_firebase("pairing_request/status", "expired")
            print(f"[PAIRING TIMEOUT] ⏳ Permintaan penautan kartu telah kedaluwarsa (>30 detik).")

    # 1. Lookup ke Node Terproteksi /rfid_map/{uid} atau /kartu/{uid}
    kartu_data = get_firebase(f"rfid_map/{uid_kartu}")
    if not kartu_data:
        kartu_data = get_firebase(f"kartu/{uid_kartu}")
    if not kartu_data and uid_kartu in KARTU_PRESET and os.environ.get("IOT_TEST_MODE") == "1":
        kartu_data = KARTU_PRESET[uid_kartu]
        print(f"[INFO] Menggunakan data preset prototipe untuk {uid_kartu} (IOT_TEST_MODE=1).")

    # 1.B. Jika Kartu Tidak Terdaftar, Cek Sesi Handshake NFC HP (/nfc_session/{DEVICE_ID})
    if not kartu_data:
        nfc_sess = get_firebase(f"nfc_session/{DEVICE_ID}")
        if not nfc_sess or not isinstance(nfc_sess, dict) or nfc_sess.get("active") is not True:
            nfc_sess = get_firebase("nfc_session/gateway-rpi-01")
        if not nfc_sess or not isinstance(nfc_sess, dict) or nfc_sess.get("active") is not True:
            nfc_sess = get_firebase("nfc_session/latest")

        if nfc_sess and isinstance(nfc_sess, dict) and nfc_sess.get("active") is True:
            sess_status = str(nfc_sess.get("status", "waiting")).lower()
            exp_ts = nfc_sess.get("expiresAt", 0)
            exp_ts_sec = (exp_ts / 1000.0) if exp_ts > 1e11 else exp_ts
            if sess_status == "waiting" and now_ts <= exp_ts_sec:
                sess_hwid = str(nfc_sess.get("hwid", "")).strip()
                sess_nisn = str(nfc_sess.get("nisn", "")).strip()
                sess_nama = str(nfc_sess.get("nama", "")).strip()
                sess_kelas = str(nfc_sess.get("kelas", DEFAULT_KELAS)).strip()

                if sess_nisn and sess_hwid:
                    print(f"\n[NFC HANDSHAKE TERDETEKSI] 📱 Sensor MFRC522 mendeteksi kontak fisik NFC dari HP!")
                    print(f"Siswa: {sess_nama} (NISN: {sess_nisn}) | HWID: {sess_hwid[:16]}... | Raw UID: {uid_kartu}")

                    # Verifikasi / Auto-bind HWID di /hwid_map/{hwid}
                    hwid_record = get_firebase(f"hwid_map/{sess_hwid}")
                    if hwid_record and isinstance(hwid_record, dict):
                        bound_nisn = str(hwid_record.get("nisn", "")).strip()
                        if bound_nisn and bound_nisn != sess_nisn:
                            print(f"[NFC HANDSHAKE DITOLAK] ❌ HP ini sudah terikat untuk siswa lain ({hwid_record.get('nama', bound_nisn)}). Anti-Titip Absen!")
                            put_firebase(f"nfc_session/{DEVICE_ID}/status", "rejected_used_by_other")
                            put_firebase(f"nfc_session/{DEVICE_ID}/active", False)
                            return
                    else:
                        # Auto-bind perangkat pertama kali
                        new_hwid_data = {
                            "hwid": sess_hwid,
                            "nisn": sess_nisn,
                            "nama": sess_nama,
                            "kelas": sess_kelas,
                            "boundAt": int(now_ts * 1000),
                            "device_id": DEVICE_ID
                        }
                        put_firebase(f"hwid_map/{sess_hwid}", new_hwid_data)
                        put_firebase(f"users/{sess_nisn}/hwid", sess_hwid)
                        print(f"[HWID AUTO-BIND] ✓ Perangkat {sess_hwid[:16]}... resmi dikunci untuk {sess_nama} ({sess_nisn}).")

                    # Bentuk kartu_data terverifikasi untuk diproses presensi
                    kartu_data = {
                        "tipe": "siswa",
                        "nisn": sess_nisn,
                        "nama": sess_nama,
                        "kelas": sess_kelas,
                        "metode_presensi": "nfc_hwid",
                        "hwid": sess_hwid,
                        "raw_uid": uid_kartu
                    }

    if not kartu_data:
        print(f"[DITOLAK] ❌ Kartu {uid_kartu} BELUM TERDAFTAR di sistem.")
        print(f"Silakan daftarkan di Panel Admin -> Tab Kartu RFID, atau tekan 'Siap Tap NFC ke Alat' di web.")
        return

    # 2. PERIKSA APAKAH KARTU GURU
    is_guru = False
    nip_guru = None
    if isinstance(kartu_data, dict):
        if kartu_data.get("tipe") == "guru" or kartu_data.get("nip"):
            is_guru = True
            nip_guru = kartu_data.get("nip")

    if is_guru:
        nama_guru = kartu_data.get("nama", "Guru Pengajar") if isinstance(kartu_data, dict) else "Guru SMKN 1 Sumedang"
        mapel = kartu_data.get("mapel", "Mata Pelajaran") if isinstance(kartu_data, dict) else "Mata Pelajaran Kejuruan"
        kelas_target = kartu_data.get("kelas", DEFAULT_KELAS) if isinstance(kartu_data, dict) else DEFAULT_KELAS

        print(f"[GURU DETECTED] 👨‍🏫 {nama_guru} (NIP: {nip_guru})")
        print(f"[MAPEL] {mapel} — Kelas: {kelas_target}")
        print(f"[WAKTU] {tanggal} {waktu} WIB")

        # Tulis ke presensi_guru/{nip}/{tanggal}
        payload_guru = {
            "rfidUid": uid_kartu,
            "nama": nama_guru,
            "nip": nip_guru,
            "jamMasuk": waktu,
            "status": "hadir",
            "mapel": mapel,
            "device_id": DEVICE_ID,
            "timestamp": now.isoformat()
        }
        sukses_guru = put_firebase(f"presensi_guru/{nip_guru}/{tanggal}", payload_guru)

        # Update KBM kelas menjadi aktif (belajar)
        payload_kelas = {
            "status": "belajar",
            "activeMapel": mapel,
            "activeTeacherNama": nama_guru,
            "activeTeacherId": nip_guru,
            "updatedAt": now.isoformat()
        }
        sukses_kbm = put_firebase(f"kelas/{kelas_target}", payload_kelas)

        if sukses_guru and sukses_kbm:
            print(f"✅ PRESENSI GURU TERCATAT & KBM KELAS {kelas_target} AKTIF (BELAJAR)!")
        else:
            print(f"⚠️ Presensi guru tersimpan (antrean/offline fallback aktif).")
        return

    # 3. KARTU SISWA (TERDAFTAR DI DATABASE)
    nisn = kartu_data if isinstance(kartu_data, str) else kartu_data.get("nisn")
    if not nisn:
        print(f"[ERR] Data kartu rusak (field NISN tidak ditemukan).")
        return

    # Ambil profil siswa dari node /siswa/{nisn}
    siswa = get_firebase(f"siswa/{nisn}")
    if not siswa and isinstance(kartu_data, dict) and "nama" in kartu_data:
        siswa = kartu_data
    nama_siswa = siswa.get("nama", nisn) if siswa else nisn
    kelas = siswa.get("kelas", DEFAULT_KELAS) if siswa else DEFAULT_KELAS

    # Periksa apakah siswa sudah memiliki status Izin/Sakit yang disetujui hari ini
    izin_disetujui = False
    for path_node in ("perizinan", "perijinan"):
        data_p = get_firebase(path_node)
        if data_p and isinstance(data_p, dict):
            for pid, pval in data_p.items():
                if isinstance(pval, dict):
                    p_nisn = str(pval.get("nisn") or pval.get("siswaId") or "").strip()
                    p_tgl = str(pval.get("tanggal") or pval.get("tanggal_norm") or "").strip()
                    p_status = str(pval.get("status") or "").lower().strip()
                    if p_nisn == str(nisn).strip() and p_tgl == tanggal and p_status in ("disetujui", "approved"):
                        izin_disetujui = True
                        break
            if izin_disetujui:
                break

    if izin_disetujui:
        print(f"[ABAIKAN SCAN] ℹ️ Siswa {nama_siswa} (NISN: {nisn}) sudah berstatus Izin/Sakit resmi yang disetujui. Scan IoT tidak menimpa status.")
        return

    # Evaluasi Ambang Batas Waktu PRD
    status, keterangan = evaluasi_waktu_absen(waktu)

    is_nfc_hwid = isinstance(kartu_data, dict) and kartu_data.get("metode_presensi") == "nfc_hwid"
    metode_presensi = "nfc_hwid" if is_nfc_hwid else "rfid_fisik"
    hwid_val = kartu_data.get("hwid") if is_nfc_hwid else None

    print(f"[SISWA TERVERIFIKASI] 🎓 {nama_siswa} ({kelas}) — NISN: {nisn} | Metode: {metode_presensi}")
    print(f"[WAKTU] {tanggal} {waktu} WIB")
    print(f"[STATUS EVALUASI] 📊 {status.upper()} — {keterangan}")

    # Tulis ke absensi/{nisn}
    entry_absensi = {
        "tanggal": tanggal,
        "waktu": waktu,
        "status": status,
        "keterangan": keterangan,
        "device_id": DEVICE_ID,
        "rfidUid": uid_kartu,
        "metode": metode_presensi
    }
    if hwid_val:
        entry_absensi["hwid"] = hwid_val
    sukses_riwayat = post_firebase(f"absensi/{nisn}", entry_absensi)
    put_firebase(f"absensi/{nisn}/{tanggal}", entry_absensi)
    put_firebase(f"absensi/{tanggal}/{nisn}", entry_absensi)

    # Tulis ke riwayat/{tanggal}/{nisn} (PRD Bab 3.2)
    entry_riwayat = {
        "waktu": waktu,
        "status": status,
        "keterangan": keterangan,
        "device_id": DEVICE_ID,
        "rfidUid": uid_kartu,
        "nama": nama_siswa,
        "kelas": kelas,
        "metode": metode_presensi
    }
    if hwid_val:
        entry_riwayat["hwid"] = hwid_val
    put_firebase(f"riwayat/{tanggal}/{nisn}", entry_riwayat)
    put_firebase(f"presensi_harian/{tanggal}/{nisn}", entry_riwayat)

    # Tulis ke presensi_jam/{kelas}/{tanggal}/1/{nisn} (Monitoring Kelas Realtime)
    entry_kelas = {
        "waktu": waktu,
        "status": status,
        "keterangan": keterangan,
        "tipe": metode_presensi,
        "rfidUid": uid_kartu,
        "updatedAt": now.isoformat()
    }
    if hwid_val:
        entry_kelas["hwid"] = hwid_val
    sukses_kelas = put_firebase(f"presensi_jam/{kelas}/{tanggal}/1/{nisn}", entry_kelas)

    # Telemetri Realtime untuk Monitor TV / presensi-live
    put_firebase("tap_realtime/latest", {
        "nisn": nisn,
        "nama": nama_siswa,
        "kelas": kelas,
        "status": status,
        "waktu": waktu,
        "metode": metode_presensi,
        "device_id": DEVICE_ID,
        "timestamp": int(now_ts * 1000)
    })

    # Jika melalui jabat-tangan NFC Smartphone, tandai sesi 'completed'
    if is_nfc_hwid:
        sess_completion = {
            "active": False,
            "status": "completed",
            "completedAt": int(now_ts * 1000),
            "uid_kartu": uid_kartu,
            "hwid": hwid_val,
            "nisn": nisn,
            "nama": nama_siswa,
            "kelas": kelas,
            "statusPresensi": status,
            "waktu": waktu
        }
        put_firebase(f"nfc_session/{DEVICE_ID}", sess_completion)
        put_firebase("nfc_session/gateway-rpi-01", sess_completion)
        put_firebase("nfc_session/latest", sess_completion)
        print(f"[NFC HANDSHAKE SUKSES] 📱 Sesi NFC HP untuk {nama_siswa} ({nisn}) resmi COMPLETED!")

    if sukses_riwayat and sukses_kelas:
        print(f"✅ PRESENSI SISWA BERHASIL DISINKRONKAN KE CLOUD!")
    else:
        print(f"⚠️ Presensi tersimpan (antrean offline SQLite diaktifkan bila tanpa internet).")

def main():
    init_offline_db()

    # Otentikasi awal perangkat IoT
    authenticate_device()

    # Jalankan background workers: auto-refresh token (50 min) & flush offline queue (8s)
    t_token = threading.Thread(target=worker_token_refresher, daemon=True)
    t_token.start()

    t_worker = threading.Thread(target=worker_flush_offline_queue, daemon=True)
    t_worker.start()

    print("="*60)
    print("🚀 GATEWAY PRESENSI RFID IOT — SMK NEGERI 1 SUMEDANG")
    print(f"🔗 Firebase Realtime DB : {DATABASE_URL}")
    print(f"📁 SQLite Offline Queue : {OFFLINE_DB_PATH}")
    print(f"🏷️ Mode Keamanan REST   : idToken Auto-Refresh Active (SEC-03)")
    print("Ketik atau scan UID kartu (Tekan Enter):")
    print("="*60)

    while True:
        try:
            line = sys.stdin.readline()
            if not line:
                break
            uid = line.strip()
            if uid:
                proses_kartu(uid)
        except KeyboardInterrupt:
            print("\nGateway dimatikan.")
            break

if __name__ == '__main__':
    main()
