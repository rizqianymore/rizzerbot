#!/usr/bin/env python3
"""
tj_live_check.py - TransJakarta LIVE route & bus-stop checker (data asli, terverifikasi)

Endpoint yang terbukti balas 200 + data nyata (hasil probe langsung):
  GET  /v2/bus-stop           param latitude, longitude, radius   -> halte terdekat + rute yang lewat
  GET  /v2/route              param origin, destination (lat,lon)-> 238 rute "dari -> kemana"
  POST /v2/maps/autocomplete  body query                          -> cari tempat/halte
  POST /v1/auth/login/guest                                       -> token guest

HEADER WAJIB: Authorization: Bearer <token>  +  X-Device-Id: <id>

Fokus: LIVE BUS (posisi GPS bus, kecepatan, ETA halte) + info rute & halte.

Pemakaian:
  python3 tj_live_check.py bus.live --example          # bus live akurat (radius 1 km, data segar < 60 dtk)
  python3 tj_live_check.py bus.live --params '{"latitude":-6.21,"longitude":106.85,"radius":500}'
  python3 tj_live_check.py bus.live --route 4          # filter prefix rute (4, 4D, 4B, ...)
  python3 tj_live_check.py bus.live --body DMR-240181  # cari 1 bus by nomor bodi + ETA halte
  python3 tj_live_check.py bus.live --example --max-age 30 --max-dist 500   # presisi tinggi
  python3 tj_live_check.py halte --lat -6.209127 --lon 106.847159          # bus yang akan datang KE halte ini + ETA
  python3 tj_live_check.py rute --lat -6.155513 --lon 106.74946            # naik apa dari halte ini + kemana tujuannya
  python3 tj_live_check.py cari "Jembatan Gantung"                         # cari halte di DB LOKAL (tanpa Google Maps)
  python3 tj_live_check.py halte --halte "Jembatan Gantung"                # langsung pakai NAMA halte
  python3 tj_live_check.py rute --halte "Jembatan Gantung" --tujuan Monumen
  python3 tj_live_check.py routes                      # semua rute (238)
  python3 tj_live_check.py routes --filter "Blok M"    # filter rute
  python3 tj_live_check.py bus.stop --example          # halte terdekat + rute lewat
  python3 tj_live_check.py search --keyword "Manggarai"# cari rute lewat halte Manggarai
  python3 tj_live_check.py maps.autocomplete --example
  python3 tj_live_check.py raw bus.live --example      # JSON mentah
"""

import argparse
import json
import math
import os
import sys
import time

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tj_database.json")
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

try:
    import requests
except ImportError:
    print("[!] Jalankan: pip install requests")
    sys.exit(1)

BASE_URL = "https://tijeapi.transjakarta.co.id"
TIMEOUT = 15
DEVICE_ID = "d4f8a1b2c3e4f5a6"

ENDPOINTS: Dict[str, Dict[str, Any]] = {
    "login.guest":      {"method": "POST", "path": "/v1/auth/login/guest",   "auth": False},
    "bus.live":         {"method": "GET",  "path": "/v1/bus",                "auth": True},
    "bus.boundary":     {"method": "GET",  "path": "/v1/bus/boundary",       "auth": True},
    "bus.stop":         {"method": "GET",  "path": "/v2/bus-stop",          "auth": True},
    "route":            {"method": "GET",  "path": "/v2/route",             "auth": True},
    "maps.autocomplete":{"method": "POST", "path": "/v2/maps/autocomplete", "auth": True},
}

DEFAULT_PARAMS: Dict[str, Dict[str, Any]] = {
    "bus.live":         {"latitude": -6.2088, "longitude": 106.8456, "radius": 1000},
    "bus.boundary":     {},
    "bus.stop":         {"latitude": -6.2088, "longitude": 106.8456, "radius": 5000},
    "route":            {"origin": "-6.1944,106.8228", "destination": "-6.2150,106.8040"},
    "maps.autocomplete":{"query": "Bundaran HI"},
}


class TJLive:
    def __init__(self, base_url=BASE_URL, token=None, device_id=DEVICE_ID):
        self.base_url = base_url.rstrip("/")
        self.device_id = device_id
        self.token = token
        self.token_until: Optional[float] = None
        self.s = requests.Session()
        self.s.headers.update({
            "User-Agent": "TJ-Transjakarta/3.1.1 (Android)",
            "Accept": "application/json",
            "Content-Type": "application/json",
            "X-Device-Id": device_id,
        })
        if token:
            self.s.headers.update({"Authorization": "Bearer " + token})

    def login(self, verbose=True):
        r = self.s.post(self.base_url + "/v1/auth/login/guest", timeout=TIMEOUT)
        try:
            d = r.json()
        except ValueError:
            print("[!] Login bukan JSON:", r.text[:200]); return False
        if verbose:
            print("[+] Login guest ->", r.status_code)
        if r.status_code == 200 and d.get("token"):
            self.token = d["token"]
            self.token_until = d.get("token_valid_until")
            self.s.headers.update({"Authorization": "Bearer " + self.token})
            if verbose:
                print("[✓] Token aktif")
            return True
        return False

    def ensure(self):
        if self.token and (self.token_until is None or self.token_until - time.time() > 60):
            return True
        return self.login(verbose=False)

    def fetch(self, name, params=None, use_default=False):
        ep = ENDPOINTS.get(name)
        if not ep:
            print("[!] Endpoint tak dikenal:", name); sys.exit(1)
        if ep["auth"]:
            self.ensure()
        data = DEFAULT_PARAMS.get(name, {}) if (use_default or params is None) else params
        url = self.base_url + ep["path"]
        try:
            r = self.s.get(url, params=data, timeout=TIMEOUT) if ep["method"] == "GET" \
                else self.s.post(url, json=data, timeout=TIMEOUT)
        except requests.exceptions.RequestException as e:
            print("[!] Gagal koneksi:", e); sys.exit(1)
        if r.status_code == 401:
            self.login(verbose=False)
            r = self.s.get(url, params=data, timeout=TIMEOUT) if ep["method"] == "GET" \
                else self.s.post(url, json=data, timeout=TIMEOUT)
        try:
            return r.json()
        except ValueError:
            return {"_raw": r.text, "_status": r.status_code}

    # ---------- database lokal ----------
    def load_db(self):
        if not os.path.isfile(DB_PATH):
            print("[!] Database %s belum ada. Jalankan scan dulu." % DB_PATH)
            return []
        with open(DB_PATH, encoding="utf-8") as f:
            return json.load(f).get("stops", [])

    def cari_halte(self, keyword, limit=20):
        stops = self.load_db()
        k = str(keyword).lower()
        hits = [s for s in stops if k in s.get("stop_name", "").lower()]
        print("\n=== CARI HALTE '%s' -> %d hasil (dari DB lokal) ===" % (keyword, len(hits)))
        for s in hits[:limit]:
            print("  %-38s [%s]  (%s, %s)" % (
                s.get("stop_name"), s.get("stop_id"), s.get("stop_lat"), s.get("stop_lon")))
            rts = s.get("routes", [])
            if rts:
                print("       rute: %s" % ", ".join(
                    "%s %s" % (r.get("route_code"), r.get("route_name")) for r in rts[:8]))
        return hits

    def resolve_halte(self, keyword):
        """Cari 1 halte terbaik dari nama. Return (lat, lon, stop_id, name) atau None."""
        stops = self.load_db()
        k = str(keyword).lower()
        exact = [s for s in stops if s.get("stop_name", "").lower() == k]
        if exact:
            s = exact[0]
            return s["stop_lat"], s["stop_lon"], s["stop_id"], s["stop_name"]
        hits = [s for s in stops if k in s.get("stop_name", "").lower()]
        if hits:
            s = hits[0]
            return s["stop_lat"], s["stop_lon"], s["stop_id"], s["stop_name"]
        return None

    # ---------- presisi ----------
    @staticmethod
    def haversine(lat1, lon1, lat2, lon2):
        """Jarak meters antara dua koordinat (rumus Haversine)."""
        try:
            R = 6371000.0
            p1, p2 = math.radians(lat1), math.radians(lat2)
            dp = math.radians(lat2 - lat1)
            dl = math.radians(lon2 - lon1)
            a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
            return 2 * R * math.asin(math.sqrt(a))
        except (TypeError, ValueError):
            return None

    @staticmethod
    def bus_age_seconds(ts):
        """Umur data bus dalam detik dari timestamp epoch ms server."""
        try:
            return max(0, time.time() - int(ts) / 1000.0)
        except (TypeError, ValueError):
            return None

    def enrich_and_filter(self, buses, origin_lat, origin_lon, max_age=60, max_dist=None):
        """Hitung jarak & umur data, buang yang basi, urutkan dari terdekat."""
        out = []
        for b in buses:
            lat, lon = b.get("latitude"), b.get("longitude")
            dist = self.haversine(origin_lat, origin_lon, lat, lon) if lat is not None and lon is not None else None
            age = self.bus_age_seconds(b.get("timestamp"))
            if age is not None and age > max_age:
                continue
            if dist is not None and max_dist is not None and dist > max_dist:
                continue
            b = dict(b)
            b["_distance_m"] = dist
            b["_age_s"] = age
            out.append(b)
        out.sort(key=lambda x: (x["_distance_m"] if x["_distance_m"] is not None else 1e18))
        return out

    # ---------- tampilan ----------
    def show_bus_live(self, params=None, use_default=True, route_filter=None, body_filter=None,
                      max_age=60, max_dist=None):
        d = self.fetch("bus.live", params=params, use_default=use_default)
        buses = d.get("data", [])
        if not isinstance(buses, list):
            print("[!] Response bukan list:", json.dumps(d, ensure_ascii=False)[:300]); return []
        p = params or DEFAULT_PARAMS["bus.live"]
        o_lat, o_lon = p.get("latitude"), p.get("longitude")
        total_mentah = len(buses)
        buses = self.enrich_and_filter(buses, o_lat, o_lon, max_age=max_age, max_dist=max_dist)
        if route_filter:
            rf = str(route_filter).lower()
            buses = [b for b in buses if str(b.get("route_code", "")).lower().startswith(rf)]
        if body_filter:
            k = str(body_filter).lower()
            buses = [b for b in buses if k in str(b.get("bus_body_no", "")).lower()]
        print("\n=== LIVE BUS TRANSJAKARTA (presisi) ===")
        print("Titik acuan : %s, %s | radius: %s m | max umur data: %s dtk" % (
            o_lat, o_lon, p.get("radius", "-"), max_age))
        print("Bus mentah  : %d | setelah filter segar & terdekat: %d" % (total_mentah, len(buses)))
        print("%-12s %-6s %-20s %-9s %-7s %-6s %-6s %s" % (
            "BODY NO", "ROUTE", "HEADSIGN", "JARAK", "UMUR", "SPEED", "ETA", "NEXT STOP"))
        print("-" * 104)
        for b in buses[:200]:
            dist = b.get("_distance_m")
            jarak = ("%.0f m" % dist) if dist is not None else "-"
            print("%-12s %-6s %-20s %-9s %-7s %-6s %-6s %s" % (
                b.get("bus_body_no", "-"),
                b.get("route_code", "-"),
                str(b.get("trip_headsign") or b.get("route_name") or "-")[:20],
                jarak,
                ("%ds" % int(b["_age_s"])) if b.get("_age_s") is not None else "-",
                str(b.get("speed", "-")),
                str(b.get("estimated_time_next_stops", "-")),
                str(b.get("next_stops", "-"))[:28],
            ))
        if len(buses) > 200:
            print("... dan %d bus lagi. Pakai --route/--body atau 'raw bus.live'." % (len(buses) - 200))
        self._last_buses = buses
        return buses

    def show_bus_detail(self, body_no, params=None, use_default=True):
        d = self.fetch("bus.live", params=params, use_default=use_default)
        buses = d.get("data", [])
        p = params or DEFAULT_PARAMS["bus.live"]
        buses = self.enrich_and_filter(buses, p.get("latitude"), p.get("longitude"))
        hit = [b for b in buses if str(body_no).lower() in str(b.get("bus_body_no", "")).lower()]
        if not hit:
            print("[!] Bus '%s' tidak ditemukan di area ini." % body_no); return None
        b = hit[0]
        print("\n=== DETAIL BUS %s ===" % b.get("bus_body_no"))
        print("  %-30s : %s" % ("JARAK DARI TITIK ACUAN",
              ("%.0f m" % b["_distance_m"]) if b.get("_distance_m") is not None else "-"))
        print("  %-30s : %s" % ("UMUR DATA",
              ("%d detik" % b["_age_s"]) if b.get("_age_s") is not None else "-"))
        for k, v in b.items():
            if k in ("stops", "_distance_m", "_age_s"):
                continue
            print("  %-30s : %s" % (k, v))
        print("\n  --- HALTE YANG AKAN DILALUI (ETA) ---")
        for st in b.get("stops", []):
            print("  #%-3s %-28s ETA %-4s mnt  (%s)" % (
                st.get("stop_sequence"), st.get("parent_stop_name") or st.get("name"),
                st.get("eta"), st.get("stop_id")))
        return b

    def show_halte(self, lat, lon, radius=500, stop_id=None, max_age=60):
        """Bus yang akan BERHENTI di halte ini + ETA ke halte (paling relevan)."""
        params = {"latitude": lat, "longitude": lon, "radius": radius}
        d = self.fetch("bus.live", params=params)
        buses = d.get("data", [])
        if not isinstance(buses, list):
            print("[!] Response bukan list:", json.dumps(d, ensure_ascii=False)[:300]); return []

        # Kalau stop_id tidak diberikan, ambil halte terdekat dari /v2/bus-stop
        if not stop_id:
            sd = self.fetch("bus.stop", params={"latitude": lat, "longitude": lon, "radius": 300})
            stops = sd.get("data", [])
            if stops:
                stop_id = stops[0].get("stop_id")
                stop_name = stops[0].get("stop_name")
                print("[i] Halte terdeteksi: %s [%s]" % (stop_name, stop_id))
            else:
                print("[!] Halte tidak ditemukan di sekitar koordinat ini."); return []
        else:
            stop_name = stop_id

        print("\n=== BUS AKAN DATANG KE HALTE: %s [%s] ===" % (stop_name, stop_id))
        print("Radius bus: %s m | max umur data: %s dtk" % (radius, max_age))

        arrivals = []
        for b in buses:
            age = self.bus_age_seconds(b.get("timestamp"))
            if age is not None and age > max_age:
                continue
            for st in b.get("stops", []):
                if st.get("parent_stop_id") == stop_id or st.get("stop_id") == stop_id:
                    eta = st.get("eta")
                    arrivals.append({
                        "body": b.get("bus_body_no"),
                        "route": b.get("route_code"),
                        "tujuan": st.get("headsign") or b.get("trip_headsign") or b.get("route_name"),
                        "eta": eta,
                        "jarak": self.haversine(lat, lon, b.get("latitude"), b.get("longitude")),
                        "umur": age,
                        "trip": b.get("trip_id"),
                    })
                    break
        arrivals.sort(key=lambda x: (x["eta"] if isinstance(x["eta"], (int, float)) else 1e9))
        print("%-12s %-7s %-24s %-8s %-9s %s" % (
            "BODY NO", "ROUTE", "TUJUAN", "ETA", "JARAK", "UMUR"))
        print("-" * 74)
        for a in arrivals[:30]:
            print("%-12s %-7s %-24s %-8s %-9s %s" % (
                a["body"] or "-",
                a["route"] or "-",
                str(a["tujuan"] or "-")[:24],
                ("%s mnt" % a["eta"]) if a["eta"] is not None else "-",
                ("%.0f m" % a["jarak"]) if a["jarak"] is not None else "-",
                ("%ds" % int(a["umur"])) if a["umur"] is not None else "-",
            ))
        if not arrivals:
            print("  Belum ada bus yang terdeteksi akan berhenti di halte ini.")
        print("\nTotal bus akan datang: %d" % len(arrivals))
        self._last_arrivals = arrivals
        return arrivals

    def show_rute_from_halte(self, lat, lon, radius=1000, max_age=60, tujuan=None):
        """Naik apa dari halte ini: kumpulkan rute + headsign bus yang berhenti di halte."""
        # deteksi halte terdekat
        sd = self.fetch("bus.stop", params={"latitude": lat, "longitude": lon, "radius": 300})
        stops = sd.get("data", [])
        if not stops:
            print("[!] Halte tidak ditemukan di sekitar koordinat ini."); return []
        stop = stops[0]
        stop_id, stop_name = stop.get("stop_id"), stop.get("stop_name")
        print("[i] Halte: %s [%s]" % (stop_name, stop_id))

        d = self.fetch("bus.live", params={"latitude": lat, "longitude": lon, "radius": radius})
        buses = d.get("data", [])
        groups: Dict[str, Dict[str, Any]] = {}
        for b in buses:
            age = self.bus_age_seconds(b.get("timestamp"))
            if age is not None and age > max_age:
                continue
            for st in b.get("stops", []):
                if st.get("parent_stop_id") != stop_id and st.get("stop_id") != stop_id:
                    continue
                tujuan_bus = st.get("headsign") or b.get("trip_headsign") or b.get("route_name") or "-"
                key = (str(b.get("route_code")), str(tujuan_bus))
                g = groups.setdefault(key, {"route": b.get("route_code"),
                                            "tujuan": tujuan_bus,
                                            "eta": [], "body": []})
                if st.get("eta") is not None:
                    g["eta"].append(st["eta"])
                g["body"].append(b.get("bus_body_no"))
                break

        rows = []
        for g in groups.values():
            etas = [e for e in g["eta"] if isinstance(e, (int, float))]
            eta_tercepat = min(etas) if etas else None
            rows.append({"route": g["route"], "tujuan": g["tujuan"],
                         "eta": eta_tercepat, "jumlah": len(g["body"])})
        rows.sort(key=lambda x: (x["eta"] if x["eta"] is not None else 1e9))

        if tujuan:
            k = str(tujuan).lower()
            rows = [r for r in rows if k in str(r["tujuan"]).lower() or k in str(r["route"]).lower()]

        print("\n=== NAIK DARI %s [%s] ===" % (stop_name, stop_id))
        print("%-8s %-26s %-10s %s" % ("ROUTE", "TUJUAN / HEADSIGN", "ETA", "BUS"))
        print("-" * 66)
        for r in rows[:30]:
            print("%-8s %-26s %-10s %d bus" % (
                r["route"] or "-", str(r["tujuan"])[:26],
                ("%s mnt" % r["eta"]) if r["eta"] is not None else "-",
                r["jumlah"]))
        if not rows:
            print("  Belum ada bus terdeteksi berhenti di halte ini.")
        print("\nArtinya: naik route di atas dari halte %s, arah tujuan sesuai headsign." % stop_name)
        return rows

    def show_boundary(self):
        d = self.fetch("bus.boundary", use_default=True)
        data = d.get("data", {})
        print("\n=== AREA CAKUPAN BUS LIVE ===")
        print("  Lat  : %s s/d %s" % (data.get("min_lat"), data.get("max_lat")))
        print("  Lon  : %s s/d %s" % (data.get("min_lon"), data.get("max_lon")))
        print("  Grid : %s   Last update: %s" % (data.get("grid_size"), data.get("last_update")))
        return data

    def show_routes(self, keyword=None):
        d = self.fetch("route", use_default=True)
        routes = d.get("data", {}).get("routes", [])
        if keyword:
            k = keyword.lower()
            routes = [r for r in routes if k in r.get("route_long_name", "").lower()]
        print("\n=== RUTE TRANSJAKARTA (%d rute) ===" % len(routes))
        print("%-6s %-42s %-8s %-8s %s" % ("KODE", "DARI -> KEMANA", "TIPE", "HARGA", "TRIP"))
        print("-" * 88)
        for r in routes:
            print("%-6s %-42s %-8s %-8s %s" % (
                r.get("route_short_name", "-"),
                r.get("route_long_name", "-"),
                r.get("route_desc", "-"),
                "Rp" + str(r.get("price", "-")),
                ", ".join(r.get("trip_ids", [])) or "-",
            ))
        return routes

    def show_bus_stop(self, params=None, use_default=True):
        d = self.fetch("bus.stop", params=params, use_default=use_default)
        stops = d.get("data", [])
        print("\n=== HALTE TERDEKAT (%d halte) ===" % len(stops))
        for s in stops:
            print("\n• %s  [%s]" % (s.get("stop_name", "-"), s.get("stop_id", "-")))
            print("  Koordinat: %s, %s" % (s.get("stop_lat"), s.get("stop_lon")))
            rts = s.get("routes", [])
            if rts:
                print("  Rute lewat halte ini (%d):" % len(rts))
                for r in rts:
                    print("    - %s : %s" % (r.get("route_short_name"), r.get("route_long_name")))
            fac = s.get("facilities", [])
            if fac:
                print("  Fasilitas: %s" % ", ".join(fac))
        return stops

    def show_search(self, keyword):
        # cari rute yang nama/nama haltenya mengandung keyword
        d = self.fetch("route", use_default=True)
        routes = d.get("data", {}).get("routes", [])
        k = keyword.lower()
        hits = [r for r in routes if k in r.get("route_long_name", "").lower()]
        print("\n=== CARI RUTE '%s' -> %d hasil ===" % (keyword, len(hits)))
        for r in hits:
            print("  %-5s %s (Rp%s)" % (
                r.get("route_short_name"), r.get("route_long_name"), r.get("price")))
        if not hits:
            print("  Tidak ada rute mengandung '%s'." % keyword)
        return hits

    def show_autocomplete(self, params=None, use_default=True):
        d = self.fetch("maps.autocomplete", params=params, use_default=use_default)
        items = d.get("data", [])
        print("\n=== LOKASI / HALTE (%d hasil) ===" % len(items))
        for x in items:
            print("  • %s" % x.get("name", "-"))
            print("    %s" % x.get("full_text", x.get("address", "-")))
        return items

    def list(self):
        print("=== Endpoint LIVE (BASE: %s) ===" % self.base_url)
        print("Header: Authorization: Bearer <token> + X-Device-Id: %s\n" % self.device_id)
        for n, e in ENDPOINTS.items():
            print("  %-20s | %-4s %-30s" % (n, e["method"], e["path"]))
        print("\nContoh:")
        print("  cari 'Jembatan Gantung'             <- cari halte di DB lokal (nama -> koordinat)")
        print("  halte --halte 'Jembatan Gantung'    <- bus akan datang + ETA (pakai NAMA halte)")
        print("  halte --lat -6.209127 --lon 106.847159   <- BUS AKAN DATANG + ETA KE HALTE")
        print("  bus.live --example | bus.live --route 4 | bus.live --body DMR-240181")
        print("  bus.boundary | bus.stop --example | routes --filter 'Blok M' | search --keyword Manggarai")


def parse_json_arg(raw):
    try:
        v = json.loads(raw)
        if not isinstance(v, dict):
            raise ValueError("harus JSON object")
        return v
    except ValueError:
        if not os.path.isfile(raw):
            print("[!] file tidak ada:", raw); sys.exit(1)
        with open(raw, encoding="utf-8") as f:
            return json.load(f)


def main():
    p = argparse.ArgumentParser(description="Cek LIVE rute & halte bus TransJakarta")
    p.add_argument("command", help="routes | bus.stop | route | search | maps.autocomplete | raw | list")
    p.add_argument("extra", nargs="?", help="keyword untuk search, atau endpoint untuk raw")
    p.add_argument("--token")
    p.add_argument("--device-id", default=DEVICE_ID)
    p.add_argument("--params", help="JSON string / file .json")
    p.add_argument("--example", action="store_true")
    p.add_argument("--filter", dest="flt", help="filter nama rute (untuk command routes)")
    p.add_argument("--keyword", help="keyword pencarian (untuk command search)")
    p.add_argument("--route", help="filter bus.live per kode rute (misal: 4)")
    p.add_argument("--body", help="filter bus.live per nomor bodi (misal: DMR-240181)")
    p.add_argument("--limit", type=int, help="batasi jumlah bus yang ditampilkan")
    p.add_argument("--max-age", type=int, default=60, help="buang bus dengan data lebih tua dari N detik (default 60)")
    p.add_argument("--max-dist", type=int, help="batasi jarak maksimal bus dari titik acuan (meter)")
    p.add_argument("--lat", type=float, help="latitude halte/titik (untuk command halte)")
    p.add_argument("--lon", type=float, help="longitude halte/titik (untuk command halte)")
    p.add_argument("--stop-id", help="stop_id halte, misal B08301P (opsional, auto-detect jika kosong)")
    p.add_argument("--radius", type=int, default=500, help="radius bus untuk command halte (default 500 m)")
    p.add_argument("--tujuan", help="filter tujuan/headsign untuk command rute (misal: 'Blok M')")
    p.add_argument("--halte", help="nama halte (auto-cari koordinat dari DB lokal)")
    a = p.parse_args()

    tj = TJLive(token=a.token, device_id=a.device_id)
    params = parse_json_arg(a.params) if a.params else None

    if a.command == "list":
        tj.list(); return
    if a.command == "cari":
        tj.cari_halte(a.extra or a.halte or ""); return
    if a.command == "bus.live":
        if a.body:
            tj.show_bus_detail(a.body, params, use_default=not params); return
        tj.show_bus_live(params, use_default=not params,
                         route_filter=a.route, body_filter=a.body,
                         max_age=a.max_age, max_dist=a.max_dist); return
    if a.command == "bus.boundary":
        tj.show_boundary(); return
    if a.command == "halte":
        lat, lon, sid = a.lat, a.lon, a.stop_id
        if a.halte and (lat is None or lon is None):
            found = tj.resolve_halte(a.halte)
            if not found:
                print("[!] Halte '%s' tidak ada di DB. Coba: cari %s" % (a.halte, a.halte)); sys.exit(1)
            lat, lon, sid, nm = found
            print("[i] Dari DB: %s [%s]" % (nm, sid))
        if lat is None or lon is None:
            print("[!] Kasih koordinat atau --halte: halte --halte 'Jembatan Gantung'")
            sys.exit(1)
        tj.show_halte(lat, lon, radius=a.radius, stop_id=sid,
                      max_age=a.max_age); return
    if a.command == "rute":
        lat, lon = a.lat, a.lon
        if a.halte and (lat is None or lon is None):
            found = tj.resolve_halte(a.halte)
            if not found:
                print("[!] Halte '%s' tidak ada di DB. Coba: cari %s" % (a.halte, a.halte)); sys.exit(1)
            lat, lon, sid, nm = found
            print("[i] Dari DB: %s [%s]" % (nm, sid))
        if lat is None or lon is None:
            print("[!] Kasih koordinat atau --halte: rute --halte 'Jembatan Gantung'")
            sys.exit(1)
        tj.show_rute_from_halte(lat, lon, radius=max(a.radius, 1000),
                                max_age=a.max_age, tujuan=a.tujuan); return
    if a.command == "routes":
        tj.show_routes(a.flt); return
    if a.command == "search":
        kw = a.keyword or a.extra
        if not kw:
            print("[!] kasih keyword: search --keyword 'Blok M'"); sys.exit(1)
        tj.show_search(kw); return
    if a.command == "bus.stop":
        tj.show_bus_stop(params, use_default=not params); return
    if a.command == "route":
        d = tj.fetch("route", params, use_default=not params)
        print(json.dumps(d, indent=2, ensure_ascii=False)); return
    if a.command == "maps.autocomplete":
        tj.show_autocomplete(params, use_default=not params); return
    if a.command == "raw":
        name = a.extra
        if not name:
            print("[!] raw <endpoint>"); sys.exit(1)
        print(json.dumps(tj.fetch(name, params, use_default=not params), indent=2, ensure_ascii=False)); return
    print("[!] command tak dikenal:", a.command)
    tj.list()


if __name__ == "__main__":
    main()
