#!/usr/bin/env python3
"""
DIAGNOSA GATEWAY PRESENSI NFC/RFID — SMKN 1 SUMEDANG
Jalankan di Raspberry Pi:  python3 iot/diagnosa_gateway.py

Mengecek 7 hal berurutan supaya penyebab "NFC HP tidak jalan" langsung kelihatan:
  1. Library mfrc522 & RPi.GPIO terpasang
  2. SPI aktif (/dev/spidev0.0)
  3. Login Firebase Auth perangkat
  4. Node /nfc_session & /gateway_status
  5. Node /hwid_map, /kartu, /rfid_map
  6. Pembacaan kartu/HP nyata (10 detik)
  7. Izin tulis /gateway_status

Tanpa dependency tambahan: hanya stdlib + mfrc522.
"""

import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

LULUS = "PASS"
GAGAL = "FAIL"
SKIP = "SKIP"
hasil = []


def catat(nama, status, detail=""):
    hasil.append((nama, status, detail))
    tanda = {LULUS: "[PASS]", GAGAL: "[FAIL]", SKIP: "[SKIP]"}[status]
    print(f"  {tanda} {nama}" + (f" -> {detail}" if detail else ""))


def cek_library():
    try:
        import mfrc522  # noqa: F401
    except Exception as e:
        catat("1. Library mfrc522", GAGAL, f"{e} | perbaikan: pip install mfrc522")
        return False
    try:
        import RPi.GPIO  # noqa: F401
    except Exception as e:
        catat("1. Library RPi.GPIO", GAGAL, f"{e} | perbaikan: pip install RPi.GPIO")
        return False
    catat("1. Library mfrc522 + RPi.GPIO", LULUS)
    return True


def cek_spi():
    if not os.path.exists("/dev/spidev0.0"):
        catat("2. SPI aktif", GAGAL, "/dev/spidev0.0 tidak ada | perbaikan: sudo raspi-config -> Interface -> SPI -> Enable -> reboot")
        return False
    catat("2. SPI aktif", LULUS, "/dev/spidev0.0 tersedia")
    return True


def main():
    print("=" * 70)
    print("DIAGNOSA GATEWAY PRESENSI NFC/RFID — SMKN 1 SUMEDANG")
    print("=" * 70)

    lib_ok = cek_library()
    spi_ok = cek_spi()

    try:
        import absensi_rpi as gw
    except Exception as e:
        print(f"\n[FATAL] Gagal mengimpor absensi_rpi.py: {e}")
        return 1

    print(f"\nDevice ID : {gw.DEVICE_ID}")
    print(f"Database  : {gw.DATABASE_URL}")

    # 3. Login Firebase
    token = gw.authenticate_device()
    if token:
        catat("3. Login Firebase Auth perangkat", LULUS, gw.IOT_DEVICE_EMAIL)
    else:
        catat("3. Login Firebase Auth perangkat", GAGAL,
              "cek IOT_DEVICE_EMAIL / IOT_DEVICE_PASSWORD di .env, dan akun harus terdaftar di Firebase Auth")

    # 4. Sesi & heartbeat
    sesi = gw.get_firebase(f"nfc_session/{gw.DEVICE_ID}")
    if isinstance(sesi, dict):
        catat("4. Node /nfc_session", LULUS, f"status={sesi.get('status')} active={sesi.get('active')}")
    else:
        catat("4. Node /nfc_session", SKIP, "kosong (normal bila belum ada yang menekan 'Siap Tap NFC ke Alat')")

    hb = gw.get_firebase(f"gateway_status/{gw.DEVICE_ID}")
    if isinstance(hb, dict):
        umur = int((time.time() * 1000 - int(hb.get("lastSeen", 0))) / 1000)
        status = LULUS if umur <= 30 else GAGAL
        catat("4. Heartbeat /gateway_status", status, f"terakhir {umur}s lalu, reader={hb.get('reader')}")
    else:
        catat("4. Heartbeat /gateway_status", SKIP, "belum ada (jalankan absensi_rpi.py untuk mengisi)")

    # 5. Data master
    for node in ("hwid_map", "kartu", "rfid_map"):
        data = gw.get_firebase(node)
        jumlah = len(data) if isinstance(data, dict) else 0
        catat(f"5. Node /{node}", LULUS if data is not None else GAGAL, f"{jumlah} entri")

    # 6. Baca kartu/HP nyata
    if lib_ok and spi_ok:
        print("\n6. Menunggu kartu / HP ditempelkan ke reader (10 detik)...")
        try:
            from mfrc522 import SimpleMFRC522
            reader = SimpleMFRC522()
            baca_nonblok = getattr(reader, "read_no_block", None)
            batas = time.time() + 10
            terbaca = None
            while time.time() < batas:
                if baca_nonblok:
                    card_id, _ = baca_nonblok()
                else:
                    card_id, _ = reader.read()
                if card_id:
                    terbaca = hex(card_id)[2:].upper()
                    break
                time.sleep(0.2)
            if terbaca:
                catat("6. Pembacaan reader", LULUS, f"UID terdeteksi: {terbaca}")
            else:
                catat("6. Pembacaan reader", GAGAL,
                      "tidak ada kartu/HP terdeteksi 10s | cek wiring: SDA=GPIO8, SCK=GPIO11, MOSI=GPIO10, MISO=GPIO9, RST=GPIO25")
        except Exception as e:
            catat("6. Pembacaan reader", GAGAL, str(e))
    else:
        catat("6. Pembacaan reader", SKIP, "library/SPI belum siap")

    # 7. Izin tulis
    uji = {"online": True, "device_id": gw.DEVICE_ID, "reader": "diagnosa",
           "lastSeen": int(time.time() * 1000), "wib": time.strftime("%Y-%m-%d %H:%M:%S")}
    if gw.put_firebase(f"gateway_status/{gw.DEVICE_ID}", uji, fallback_queue=False):
        catat("7. Izin tulis /gateway_status", LULUS)
    else:
        catat("7. Izin tulis /gateway_status", GAGAL,
              "rules RTDB menolak. Pastikan /users/{uid}/role === 'iot_gateway' untuk akun perangkat")

    gagal = [h for h in hasil if h[1] == GAGAL]
    print("\n" + "=" * 70)
    print(f"RINGKASAN: {len(hasil) - len(gagal)} OK, {len(gagal)} GAGAL, "
          f"{len([h for h in hasil if h[1] == SKIP])} dilewati")
    if gagal:
        print("Perbaiki dulu item GAGAL di atas, lalu jalankan ulang diagnosa.")
    else:
        print("Gateway siap menerima tap NFC HP & kartu RFID.")
    print("=" * 70)
    return 1 if gagal else 0


if __name__ == "__main__":
    sys.exit(main())
