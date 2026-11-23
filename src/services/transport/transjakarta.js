import fs from "fs";
import path from "path";

export const BASE_URL = "https://tijeapi.transjakarta.co.id";
export const DEVICE_ID = "d4f8a1b2c3e4f5a6";
export const DB_PATH = path.join(process.cwd(), "assets", "transjakarta", "tj_database.json");
export const DEFAULT_TIMEOUT_MS = 15000;

export const ENDPOINTS = {
  "login.guest": { method: "POST", path: "/v1/auth/login/guest", auth: false },
  "bus.live": { method: "GET", path: "/v1/bus", auth: true },
  "bus.boundary": { method: "GET", path: "/v1/bus/boundary", auth: true },
  "bus.stop": { method: "GET", path: "/v2/bus-stop", auth: true },
  route: { method: "GET", path: "/v2/route", auth: true },
  "maps.autocomplete": { method: "POST", path: "/v2/maps/autocomplete", auth: true },
};

export const DEFAULT_PARAMS = {
  "bus.live": { latitude: -6.2088, longitude: 106.8456, radius: 1000 },
  "bus.boundary": {},
  "bus.stop": { latitude: -6.2088, longitude: 106.8456, radius: 5000 },
  route: { origin: "-6.1944,106.8228", destination: "-6.2150,106.8040" },
  "maps.autocomplete": { query: "Bundaran HI" },
};

let tokenCache = null;
let tokenExpiry = 0;
let stopsCache = null;

/**
 * Geodesic distance in meters (Haversine formula)
 */
export function haversine(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const R = 6371000.0;
  const p1 = (Number(lat1) * Math.PI) / 180.0;
  const p2 = (Number(lat2) * Math.PI) / 180.0;
  const dp = ((Number(lat2) - Number(lat1)) * Math.PI) / 180.0;
  const dl = ((Number(lon2) - Number(lon1)) * Math.PI) / 180.0;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Calculate age of bus telemetry in seconds from timestamp epoch ms
 */
export function busAgeSeconds(ts) {
  if (!ts) return null;
  const num = Number(ts);
  if (!Number.isFinite(num)) return null;
  return Math.max(0, Date.now() / 1000.0 - num / 1000.0);
}

/**
 * Load 7.210 stops from local database
 */
export function getStopsDatabase() {
  if (stopsCache) return stopsCache;
  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      stopsCache = parsed?.stops || [];
    }
  } catch (err) {
    console.warn("[TransJakarta] Gagal baca tj_database.json:", err.message);
    stopsCache = [];
  }
  return stopsCache || [];
}

/**
 * Resolve single best halte from name or code. Returns halte or null.
 */
export function resolveHalte(keyword) {
  const stops = getStopsDatabase();
  const k = String(keyword || "")
    .trim()
    .toLowerCase();
  if (!k) return null;

  // 1. Exact match on stop_id
  const byId = stops.find((s) => s.stop_id?.toLowerCase() === k);
  if (byId) return byId;

  // 2. Exact match on stop_name
  const exact = stops.find((s) => s.stop_name?.toLowerCase() === k);
  if (exact) return exact;

  // 3. Substring match on stop_name
  const match = stops.find((s) => s.stop_name?.toLowerCase().includes(k));
  return match || null;
}

/**
 * Search halte in local DB
 */
export function searchHalte(keyword, limit = 20) {
  const stops = getStopsDatabase();
  const k = String(keyword || "")
    .trim()
    .toLowerCase();
  if (!k) return [];
  const hits = stops.filter((s) => s.stop_name?.toLowerCase().includes(k));
  return hits.slice(0, limit);
}

/**
 * Core TransJakarta API Client class in 100% pure JavaScript
 */
export class TJLive {
  constructor({ baseUrl = BASE_URL, token = null, deviceId = DEVICE_ID } = {}) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.deviceId = deviceId;
    this.token = token;
    this.tokenUntil = null;
  }

  async login(verbose = false) {
    try {
      const res = await fetch(`${this.baseUrl}/v1/auth/login/guest`, {
        method: "POST",
        headers: {
          "User-Agent": "TJ-Transjakarta/3.1.1 (Android)",
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Device-Id": this.deviceId,
        },
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      });

      const d = await res.json();
      if (verbose) console.log("[+] Login guest ->", res.status);
      if (res.status === 200 && d?.token) {
        this.token = d.token;
        this.tokenUntil = d.token_valid_until ? Number(d.token_valid_until) : Date.now() / 1000 + 3600;
        tokenCache = this.token;
        tokenExpiry = this.tokenUntil * 1000;
        return true;
      }
    } catch (err) {
      if (verbose) console.warn("[!] Login guest error:", err.message);
    }
    return false;
  }

  async ensure() {
    const nowSec = Date.now() / 1000;
    if (this.token && (!this.tokenUntil || this.tokenUntil - nowSec > 60)) {
      return true;
    }
    if (tokenCache && tokenExpiry - Date.now() > 60000) {
      this.token = tokenCache;
      this.tokenUntil = tokenExpiry / 1000;
      return true;
    }
    return await this.login(false);
  }

  async fetch(name, params = null, useDefault = false) {
    const ep = ENDPOINTS[name];
    if (!ep) throw new Error(`Endpoint tak dikenal: ${name}`);

    if (ep.auth) {
      await this.ensure();
    }

    const data = useDefault || params == null ? DEFAULT_PARAMS[name] || {} : params;
    let url = `${this.baseUrl}${ep.path}`;

    const headers = {
      "User-Agent": "TJ-Transjakarta/3.1.1 (Android)",
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Device-Id": this.deviceId,
    };
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    let fetchOpts = { headers, signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS) };

    if (ep.method === "GET") {
      const sp = new URLSearchParams();
      for (const [k, v] of Object.entries(data)) {
        if (v != null) sp.append(k, String(v));
      }
      const qs = sp.toString();
      if (qs) url += (url.includes("?") ? "&" : "?") + qs;
      fetchOpts.method = "GET";
    } else {
      fetchOpts.method = ep.method;
      fetchOpts.body = JSON.stringify(data);
    }

    let res = await fetch(url, fetchOpts);
    if (res.status === 401 && ep.auth) {
      await this.login(false);
      headers.Authorization = `Bearer ${this.token}`;
      res = await fetch(url, fetchOpts);
    }

    try {
      return await res.json();
    } catch {
      return { _raw: await res.text(), _status: res.status };
    }
  }

  enrichAndFilter(buses, originLat, originLon, { maxAge = 60, maxDist = null } = {}) {
    const out = [];
    for (const b of buses) {
      const lat = b.latitude;
      const lon = b.longitude;
      const dist = lat != null && lon != null ? haversine(originLat, originLon, lat, lon) : null;
      const age = busAgeSeconds(b.timestamp);

      if (age != null && age > maxAge) continue;
      if (dist != null && maxDist != null && dist > maxDist) continue;

      const clone = { ...b, _distance_m: dist, _age_s: age };
      out.push(clone);
    }
    out.sort((a, b) => (a._distance_m ?? 1e18) - (b._distance_m ?? 1e18));
    return out;
  }

  /**
   * 1) Halte: Bus yang AKAN DATANG ke halte + ETA
   */
  async getHalteArrivals(lat, lon, { radius = 500, stopId = null, maxAge = 60 } = {}) {
    let resolvedStopId = stopId;
    let resolvedStopName = stopId;

    if (!resolvedStopId) {
      const sd = await this.fetch("bus.stop", { latitude: lat, longitude: lon, radius: 300 });
      const stops = Array.isArray(sd?.data) ? sd.data : [];
      if (stops.length > 0) {
        resolvedStopId = stops[0].stop_id;
        resolvedStopName = stops[0].stop_name;
      } else {
        return { stopName: null, stopId: null, arrivals: [] };
      }
    }

    const d = await this.fetch("bus.live", { latitude: lat, longitude: lon, radius });
    const buses = Array.isArray(d?.data) ? d.data : [];
    const arrivals = [];

    for (const b of buses) {
      const age = busAgeSeconds(b.timestamp);
      if (age != null && age > maxAge) continue;

      for (const st of b.stops || []) {
        if (st.parent_stop_id === resolvedStopId || st.stop_id === resolvedStopId) {
          arrivals.push({
            body: b.bus_body_no || "-",
            route: b.route_code || "-",
            tujuan: st.headsign || b.trip_headsign || b.route_name || "-",
            eta: st.eta,
            jarak: haversine(lat, lon, b.latitude, b.longitude),
            umur: age != null ? Math.round(age) : null,
            speed: b.speed || 0,
            trip: b.trip_id,
            nextStop: b.next_stops || "-",
          });
          break;
        }
      }
    }

    arrivals.sort((a, b) => {
      const ea = typeof a.eta === "number" ? a.eta : 1e9;
      const eb = typeof b.eta === "number" ? b.eta : 1e9;
      return ea - eb || (a.jarak ?? 1e9) - (b.jarak ?? 1e9);
    });

    return {
      stopName: resolvedStopName,
      stopId: resolvedStopId,
      arrivals,
    };
  }

  /**
   * 2) Rute: Naik apa dari halte + rute & headsign
   */
  async getRuteFromHalte(lat, lon, { radius = 1000, maxAge = 60, tujuan = null } = {}) {
    const sd = await this.fetch("bus.stop", { latitude: lat, longitude: lon, radius: 300 });
    const stops = Array.isArray(sd?.data) ? sd.data : [];
    if (!stops.length) {
      return { stopName: null, stopId: null, routes: [] };
    }

    const stop = stops[0];
    const stopId = stop.stop_id;
    const stopName = stop.stop_name;

    const d = await this.fetch("bus.live", { latitude: lat, longitude: lon, radius });
    const buses = Array.isArray(d?.data) ? d.data : [];
    const groups = new Map();

    for (const b of buses) {
      const age = busAgeSeconds(b.timestamp);
      if (age != null && age > maxAge) continue;

      for (const st of b.stops || []) {
        if (st.parent_stop_id !== stopId && st.stop_id !== stopId) continue;
        const tujuanBus = st.headsign || b.trip_headsign || b.route_name || "-";
        const key = `${b.route_code}:::${tujuanBus}`;

        if (!groups.has(key)) {
          groups.set(key, {
            route: b.route_code || "-",
            tujuan: tujuanBus,
            etas: [],
            bodyNos: [],
          });
        }
        const g = groups.get(key);
        if (st.eta != null) g.etas.push(st.eta);
        g.bodyNos.push(b.bus_body_no);
        break;
      }
    }

    let rows = [];
    for (const g of groups.values()) {
      const validEtas = g.etas.filter((e) => typeof e === "number");
      const etaMin = validEtas.length > 0 ? Math.min(...validEtas) : null;
      rows.push({
        route: g.route,
        tujuan: g.tujuan,
        eta: etaMin,
        jumlahBus: g.bodyNos.length,
      });
    }

    rows.sort((a, b) => (a.eta ?? 1e9) - (b.eta ?? 1e9));

    if (tujuan) {
      const q = String(tujuan).toLowerCase();
      rows = rows.filter((r) => r.tujuan.toLowerCase().includes(q) || r.route.toLowerCase().includes(q));
    }

    return { stopName, stopId, routes: rows };
  }

  /**
   * 3) Detail 1 bus berdasarkan nomor bodi
   */
  async getBusDetail(bodyNo, params = null) {
    const p = params || DEFAULT_PARAMS["bus.live"];
    const d = await this.fetch("bus.live", p);
    const buses = Array.isArray(d?.data) ? d.data : [];
    const enriched = this.enrichAndFilter(buses, p.latitude, p.longitude);
    const q = String(bodyNo).toLowerCase();
    const hit = enriched.find((b) =>
      String(b.bus_body_no || "")
        .toLowerCase()
        .includes(q)
    );
    return hit || null;
  }

  /**
   * 4) Semua rute TransJakarta resmi
   */
  async getRoutesList(keyword = null) {
    const d = await this.fetch("route", {}, true);
    let routes = d?.data?.routes || [];
    if (keyword) {
      const k = String(keyword).toLowerCase();
      routes = routes.filter(
        (r) => r.route_short_name?.toLowerCase().includes(k) || r.route_long_name?.toLowerCase().includes(k)
      );
    }
    return routes;
  }

  /**
   * 5) Halte terdekat dari koordinat
   */
  async getNearbyStops(lat, lon, radius = 2000) {
    const d = await this.fetch("bus.stop", { latitude: lat, longitude: lon, radius });
    return Array.isArray(d?.data) ? d.data : [];
  }

  /**
   * 6) Autocomplete pencarian tempat
   */
  async autocomplete(query) {
    const d = await this.fetch("maps.autocomplete", { query });
    return Array.isArray(d?.data) ? d.data : [];
  }
}

// Global default singleton instance
export const tjLive = new TJLive();
