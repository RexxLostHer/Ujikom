#!/usr/bin/env python3
"""
ABSENSI RFID GATEWAY — RASPBERRY PI / LINUX
SMK NEGERI 1 SUMEDANG (NESAS RPL)

Membaca scan kartu RFID (SPI RC522 atau USB Reader),
lalu mencatat kehadiran siswa secara real-time ke Firebase Realtime Database.
"""

import sys
import time
import json
from datetime import datetime
import urllib.request
import urllib.error

# ===== KONFIGURASI FIREBASE & DEVICE =====
DATABASE_URL = "https://absensi-6e385-default-rtdb.asia-southeast1.firebasedatabase.app"
DEVICE_ID = "gateway-rpi-01"
DEFAULT_KELAS = "XII RPL 2"

# Cooldown anti-double tap (detik)
COOLDOWN_SECONDS = 5
riwayat_tap = {}

def get_firebase(path):
    url = f"{DATABASE_URL}/{path}.json"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Nesas-RFID-Gateway/1.0'})
        with urllib.request.urlopen(req, timeout=5) as response:
            return json.loads(response.read().decode('utf-8'))
    except Exception as e:
        print(f"[ERR] Gagal GET {path}: {e}")
        return None

def put_firebase(path, data):
    url = f"{DATABASE_URL}/{path}.json"
    try:
        body = json.dumps(data).encode('utf-8')
        req = urllib.request.Request(url, data=body, method='PUT', headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(req, timeout=5) as response:
            return response.status in (200, 204)
    except Exception as e:
        print(f"[ERR] Gagal PUT {path}: {e}")
        return False

def post_firebase(path, data):
    url = f"{DATABASE_URL}/{path}.json"
    try:
        body = json.dumps(data).encode('utf-8')
        req = urllib.request.Request(url, data=body, method='POST', headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(req, timeout=5) as response:
            return response.status in (200, 201)
    except Exception as e:
        print(f"[ERR] Gagal POST {path}: {e}")
        return False

def proses_kartu(uid_kartu):
    uid_kartu = uid_kartu.strip().upper()
    now = datetime.now()
    now_ts = time.time()

    # Cek Cooldown Anti-Double Tap
    if uid_kartu in riwayat_tap and (now_ts - riwayat_tap[uid_kartu]) < COOLDOWN_SECONDS:
        print(f"[ABAIKAN] Kartu {uid_kartu} baru saja di-tap (Anti-Double Tap).")
        return

    riwayat_tap[uid_kartu] = now_ts
    print(f"\n==========================================")
    print(f"[SCAN] Kartu Terdeteksi UID: {uid_kartu}")

    # 1. Lookup Pemilik Kartu
    kartu = get_firebase(f"kartu/{uid_kartu}")
    if not kartu:
        print(f"[DITOLAK] Kartu {uid_kartu} BELUM TERDAFTAR di panel admin.")
        print(f"Silakan daftarkan di Panel Admin -> Tab Kartu RFID.")
        return

    nisn = kartu if isinstance(kartu, str) else kartu.get("nisn")
    if not nisn:
        print(f"[ERR] Data kartu rusak (tidak ada field NISN).")
        return

    # 2. Ambil Data Siswa
    siswa = get_firebase(f"siswa/{nisn}")
    nama_siswa = siswa.get("nama", nisn) if siswa else nisn
    kelas = siswa.get("kelas", DEFAULT_KELAS) if siswa else DEFAULT_KELAS

    tanggal = now.strftime("%Y-%m-%d")
    waktu = now.strftime("%H:%M:%S")

    print(f"[TERVERIFIKASI] {nama_siswa} ({kelas}) — NISN: {nisn}")
    print(f"[WAKTU] {tanggal} {waktu} WIB")

    # 3. Tulis Riwayat Siswa ke absensi/{nisn}
    entry_absensi = {
        "tanggal": tanggal,
        "waktu": waktu,
        "status": "hadir",
        "device_id": DEVICE_ID
    }
    sukses_riwayat = post_firebase(f"absensi/{nisn}", entry_absensi)

    # 4. Tulis ke presensi_jam/{kelas}/{tanggal}/1/{nisn} (Monitoring Kelas Realtime)
    entry_kelas = {
        "waktu": waktu,
        "status": "hadir"
    }
    sukses_kelas = put_firebase(f"presensi_jam/{kelas}/{tanggal}/1/{nisn}", entry_kelas)

    if sukses_riwayat and sukses_kelas:
        print(f"✅ KEHADIRAN BERHASIL DISINKRONKAN KE WEB DASHBOARD!")
    else:
        print(f"⚠️ Catatan: Terjadi kendala parsial saat sinkronisasi.")

def main():
    print("======================================================")
    print("🚀 GATEWAY PRESENSI RFID SMK NEGERI 1 SUMEDANG SIAP")
    print(f"🔗 Firebase URL: {DATABASE_URL}")
    print("Ketik atau scan UID kartu (Tekan Enter):")
    print("======================================================")

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
