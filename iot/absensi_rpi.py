#!/usr/bin/env python3
"""
ABSENSI RFID GATEWAY — RASPBERRY PI / LINUX / IOT
SMK NEGERI 1 SUMEDANG (NESAS RPL) — UJIKOM 2026

Fitur Utama:
1. Baca scan kartu RFID (RC522 SPI / USB Reader / Simulasi Stdin).
2. Deteksi Kartu A (Siswa Fisik) & Kartu B (Guru Pengajar).
3. Evaluasi ambang batas waktu presensi PRD (06.30 Hadir, 06.31-08.00 Terlambat).
4. Offline Resilience: SQLite Queue (offline_queue.db) & auto-sync background worker saat online.
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

# ===== KONFIGURASI FIREBASE & DEVICE =====
DATABASE_URL = "https://absensi-6e385-default-rtdb.asia-southeast1.firebasedatabase.app"
DEVICE_ID = "gateway-rpi-01"
DEFAULT_KELAS = "XII RPL 1"
OFFLINE_DB_PATH = os.path.join(os.path.dirname(__file__), "offline_queue.db")

# Cooldown anti-double tap (detik)
COOLDOWN_SECONDS = 5
riwayat_tap = {}

# Prototipe Kartu Hardcoded Fallback (PRD Bab 5.2)
KARTU_PRESET = {
    "A1B2C3D4": {
        "tipe": "siswa",
        "nisn": "0091113849",
        "nama": "AHSAN MAHMUD FAUZI YUSRY",
        "kelas": "XII RPL 1"
    },
    "E5F6A7B8": {
        "tipe": "guru",
        "nip": "198109012009022003",
        "nama": "Hani Hanifah, S.Si",
        "mapel": "Pemrograman Web & Perangkat Bergerak",
        "kelas": "XII RPL 1"
    }
}

# ===== OFFLINE SQLITE QUEUE RESILIENCE (PRD Bab 3.2 & 5.1) =====
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
                retry_count INTEGER DEFAULT 0
            )
        ''')
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[OFFLINE DB INIT ERR] {e}")

def enqueue_offline(path, method, payload):
    try:
        conn = sqlite3.connect(OFFLINE_DB_PATH)
        c = conn.cursor()
        now_iso = datetime.now().isoformat()
        c.execute('''
            INSERT INTO offline_queue (path, method, payload, created_at, retry_count)
            VALUES (?, ?, ?, ?, 0)
        ''', (path, method, json.dumps(payload), now_iso))
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
                    # Increment retry_count jika gagal
                    c.execute("UPDATE offline_queue SET retry_count = retry_count + 1 WHERE id = ?", (row_id,))
                    conn.commit()
                    # Hentikan batch jika koneksi offline
                    break

            if ids_sukses:
                c.executemany("DELETE FROM offline_queue WHERE id = ?", [(i,) for i in ids_sukses])
                conn.commit()
                print(f"[OFFLINE SYNC] 🔄 Berhasil menyinkronkan {len(ids_sukses)} rekaman dari SQLite ke Firebase!")

            conn.close()
        except Exception as e:
            # Diamkan jika koneksi masih offline
            pass

# ===== HTTP FIREBASE CLIENT =====
def get_firebase(path):
    url = f"{DATABASE_URL}/{path}.json"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Nesas-RFID-Gateway/2.0'})
        with urllib.request.urlopen(req, timeout=4) as response:
            return json.loads(response.read().decode('utf-8'))
    except Exception as e:
        return None

def put_firebase(path, data, fallback_queue=True):
    url = f"{DATABASE_URL}/{path}.json"
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
    url = f"{DATABASE_URL}/{path}.json"
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
    url = f"{DATABASE_URL}/{path}.json"
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
        req_ts = pairing_req.get("timestamp", 0)
        req_ts_sec = (req_ts / 1000.0) if req_ts > 1e11 else req_ts
        # Batas waktu timeout 30 detik
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
                            print(f"[RE-ENROLLMENT] Kartu lama {old_uid} milik {user_id} telah dihapus/digantikan.")

            # 1. Simpan ke /kartu/{uid_kartu}
            put_firebase(f"kartu/{uid_kartu}", card_data)

            # 2. Update /pairing_request
            req_update = dict(pairing_req)
            req_update["active"] = False
            req_update["status"] = "success"
            req_update["uid"] = uid_kartu
            req_update["completedAt"] = int(now_ts * 1000)
            put_firebase("pairing_request", req_update)

            print(f"🎉 [PAIRING SUKSES] Kartu {uid_kartu} berhasil diikat ke {nama} ({user_id})!")
            print("🔊 Nada konfirmasi pairing sukses: [BEEP] [BEEP] [BEEP]")
            return
        else:
            put_firebase("pairing_request/active", False)
            put_firebase("pairing_request/status", "expired")
            print(f"[PAIRING TIMEOUT] ⏳ Permintaan penautan kartu telah kedaluwarsa (>30 detik).")

    # 1. Lookup ke Firebase atau Fallback Preset
    kartu_data = get_firebase(f"kartu/{uid_kartu}")
    if not kartu_data and uid_kartu in KARTU_PRESET:
        kartu_data = KARTU_PRESET[uid_kartu]
        print(f"[INFO] Menggunakan data preset prototipe untuk {uid_kartu}.")

    if not kartu_data:
        print(f"[DITOLAK] ❌ Kartu {uid_kartu} BELUM TERDAFTAR di sistem.")
        print(f"Silakan daftarkan di Panel Admin -> Tab Kartu RFID.")
        return

    # 2. PERIKSA APAKAH KARTU GURU (KARTU B)
    is_guru = False
    nip_guru = None
    if isinstance(kartu_data, dict):
        if kartu_data.get("tipe") == "guru" or kartu_data.get("nip"):
            is_guru = True
            nip_guru = kartu_data.get("nip")
    if uid_kartu == "E5F6A7B8":
        is_guru = True
        nip_guru = "198109012009022003"

    if is_guru:
        nama_guru = kartu_data.get("nama", "Guru Pengajar") if isinstance(kartu_data, dict) else "Hani Hanifah, S.Si"
        mapel = kartu_data.get("mapel", "Pemrograman Web") if isinstance(kartu_data, dict) else "Pemrograman Web & Perangkat Bergerak"
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

    # 3. KARTU SISWA (KARTU A ATAU SISWA TERDAFTAR)
    nisn = kartu_data if isinstance(kartu_data, str) else kartu_data.get("nisn")
    if not nisn:
        print(f"[ERR] Data kartu rusak (field NISN tidak ditemukan).")
        return

    # Ambil detail siswa
    siswa = get_firebase(f"siswa/{nisn}")
    if not siswa and isinstance(kartu_data, dict) and "nama" in kartu_data:
        siswa = kartu_data
    nama_siswa = siswa.get("nama", nisn) if siswa else nisn
    kelas = siswa.get("kelas", DEFAULT_KELAS) if siswa else DEFAULT_KELAS

    # Periksa apakah siswa sudah memiliki status Izin/Sakit yang disetujui hari ini
    # (PRD & Spesifikasi: Status Izin/Sakit disetujui Walas DILARANG ditimpa oleh scan IoT)
    izin_disetujui = False
    for path_node in ("perijinan", "perizinan"):
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

    print(f"[SISWA TERVERIFIKASI] 🎓 {nama_siswa} ({kelas}) — NISN: {nisn}")
    print(f"[WAKTU] {tanggal} {waktu} WIB")
    print(f"[STATUS EVALUASI] 📊 {status.upper()} — {keterangan}")

    # Tulis ke absensi/{nisn}
    entry_absensi = {
        "tanggal": tanggal,
        "waktu": waktu,
        "status": status,
        "keterangan": keterangan,
        "device_id": DEVICE_ID,
        "rfidUid": uid_kartu
    }
    sukses_riwayat = post_firebase(f"absensi/{nisn}", entry_absensi)

    # Tulis ke presensi_jam/{kelas}/{tanggal}/1/{nisn} (Monitoring Kelas Realtime)
    entry_kelas = {
        "waktu": waktu,
        "status": status,
        "keterangan": keterangan,
        "tipe": "rfid_fisik",
        "rfidUid": uid_kartu,
        "updatedAt": now.isoformat()
    }
    sukses_kelas = put_firebase(f"presensi_jam/{kelas}/{tanggal}/1/{nisn}", entry_kelas)

    if sukses_riwayat and sukses_kelas:
        print(f"✅ PRESENSI SISWA BERHASIL DISINKRONKAN KE CLOUD!")
    else:
        print(f"⚠️ Presensi tersimpan (antrean offline SQLite diaktifkan bila tanpa internet).")

def main():
    init_offline_db()

    # Jalankan background worker pemulihan offline queue
    t_worker = threading.Thread(target=worker_flush_offline_queue, daemon=True)
    t_worker.start()

    print("="*60)
    print("🚀 GATEWAY PRESENSI RFID IOT — SMK NEGERI 1 SUMEDANG")
    print(f"🔗 Firebase Realtime DB : {DATABASE_URL}")
    print(f"📁 SQLite Offline Queue : {OFFLINE_DB_PATH}")
    print(f"🏷️ Kartu A (Siswa Fisik): A1B2C3D4 (Ahsan Mahmud - XII RPL 1)")
    print(f"🏷️ Kartu B (Guru Fisik) : E5F6A7B8 (Hani Hanifah, S.Si)")
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
