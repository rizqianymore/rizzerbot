# TJ Live Bus — Paket untuk Rizzerbot

Paket ringkas untuk cek **bus TransJakarta live** (posisi, ETA, rute, halte).
Tanpa API key Google. Semua data asli dari server TransJakarta + database lokal.

## Isi paket
| File | Fungsi |
|------|--------|
| `tj_live_check.py` | Tool utama (CLI + class `TJLive` bisa di-import) |
| `tj_database.json` | DB lokal 7.210 halte (nama -> stop_id, lat, lon, rute) |

## Butuh
```bash
pip install requests
```

## COMMAND CLI (cepat)

```bash
# Cari halte berdasarkan NAMA (dari DB lokal)
python3 tj_live_check.py cari "Jembatan Gantung"
python3 tj_live_check.py cari "Blok M"

# Bus yang AKAN DATANG ke halte + ETA (pakai NAMA halte)
python3 tj_live_check.py halte --halte "Jembatan Gantung"

# Atau pakai koordinat langsung
python3 tj_live_check.py halte --lat -6.155513 --lon 106.74946 --stop-id H00087P

# Naik apa dari halte itu + kemana tujuannya
python3 tj_live_check.py rute --halte "Jembatan Gantung"
python3 tj_live_check.py rute --halte "Jembatan Gantung" --tujuan Monumen

# Semua bus live di sekitar titik (presisi: jarak + umur data)
python3 tj_live_check.py bus.live --example
python3 tj_live_check.py bus.live --example --route 4 --max-age 30 --max-dist 500

# Detail 1 bus + ETA tiap halte
python3 tj_live_check.py bus.live --example --body DMR-240181

# Daftar 238 rute "dari -> kemana" + harga
python3 tj_live_check.py routes --filter "Blok M"
python3 tj_live_check.py search --keyword Manggarai
```

## PAKAI SEBAGAI MODUL (dari plugin rizzerbot)

```python
from tj_live_check import TJLive

tj = TJLive()  # auto-login guest

# 1) Cari halte dari nama -> koordinat
lat, lon, stop_id, nama = tj.resolve_halte("Jembatan Gantung")

# 2) Bus yang akan datang ke halte + ETA
arrivals = tj.show_halte(lat, lon, stop_id=stop_id)

# 3) Naik apa dari halte + arah tujuan
rute = tj.show_rute_from_halte(lat, lon, tujuan="Monumen")

# 4) Semua bus live di sekitar (sudah diurutkan terdekat + filter data basi)
buses = tj.fetch("bus.live", {"latitude": -6.2088, "longitude": 106.8456, "radius": 1000})
```

Return value berupa **list of dict** (bisa langsung di-JSON-kan / dikirim ke bot).

## KUNCI SUKSES (jangan diubah)
1. Header **`X-Device-Id`** (wajib; default sudah ada di script)
2. Token guest otomatis dari `/v1/auth/login/guest`
3. Parameter bus live: **`latitude`, `longitude`, `radius`** (bukan lat/long)
4. Endpoint nyata:
   - `GET  /v1/bus`            -> bus live + ETA per halte
   - `GET  /v2/bus-stop`       -> halte terdekat
   - `GET  /v2/route`          -> daftar rute
   - `POST /v2/maps/autocomplete` -> cari tempat
5. `DB_PATH` di script harus nunjuk ke `tj_database.json` (satu folder)

## CATATAN
- Semua request nyata ke `https://tijeapi.transjakarta.co.id`
- Tidak ada data dummy
- Tool sudah: auto-login, auto-refresh token, retry, filter data basi, urut terdekat
- Untuk pembelajaran/pengujian. Jangan spam server publik.
