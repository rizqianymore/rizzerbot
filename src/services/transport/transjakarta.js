import fs from "fs";
import path from "path";

const BASE_URL = "https://tijeapi.transjakarta.co.id";
const DEVICE_ID = "d4f8a1b2c3e4f5a6";
const DB_PATH = path.join(process.cwd(), "assets", "transjakarta", "tj_database.json");

let tokenCache = null;
let tokenExpiry = 0;
let stopsCache = null;

/**
 * Load TransJakarta stops database (7.210 stops) into memory
 * @returns {Array<any>}
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
    console.warn("[TransJakarta] Gagal memuat tj_database.json:", err.message);
    stopsCache = [];
  }
  return stopsCache || [];
}

/**
 * Find halte by query
 * @param {string} query
 * @returns {{ stop_lat: number, stop_lon: number, stop_id: string, stop_name: string } | null}
 */
export function resolveHalte(query) {
  const stops = getStopsDatabase();
  const q = String(query || "")
    .trim()
    .toLowerCase();
  if (!q) return null;

  // Exact match
  const exact = stops.find((s) => s.stop_name?.toLowerCase() === q);
  if (exact) return exact;

  // Substring match
  const match = stops.find((s) => s.stop_name?.toLowerCase().includes(q));
  return match || null;
}

/**
 * Search halte by keyword
 * @param {string} keyword
 * @param {number} limit
 * @returns {Array<any>}
 */
export function searchHalte(keyword, limit = 10) {
  const stops = getStopsDatabase();
  const k = String(keyword || "")
    .trim()
    .toLowerCase();
  if (!k) return [];
  const hits = stops.filter((s) => s.stop_name?.toLowerCase().includes(k));
  return hits.slice(0, limit);
}

/**
 * Obtain guest token from TransJakarta API
 * @returns {Promise<string>}
 */
export async function getGuestToken() {
  const now = Date.now();
  if (tokenCache && now < tokenExpiry - 60000) {
    return tokenCache;
  }

  try {
    const res = await fetch(`${BASE_URL}/v1/auth/login/guest`, {
      method: "POST",
      headers: {
        "User-Agent": "TJ-Transjakarta/3.1.1 (Android)",
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Device-Id": DEVICE_ID,
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data?.token) {
      tokenCache = data.token;
      // token_valid_until is timestamp in seconds or future epoch
      tokenExpiry = data.token_valid_until ? Number(data.token_valid_until) * 1000 : now + 3600000;
      return tokenCache;
    }
  } catch (err) {
    console.warn("[TransJakarta] Login guest gagal:", err.message);
  }

  return tokenCache || "";
}

/**
 * Calculate Haversine distance in meters
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number}
 */
export function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000.0;
  const p1 = (lat1 * Math.PI) / 180.0;
  const p2 = (lat2 * Math.PI) / 180.0;
  const dp = ((lat2 - lat1) * Math.PI) / 180.0;
  const dl = ((lon2 - lon1) * Math.PI) / 180.0;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Fetch live buses approaching a halte / coordinates
 * @param {number} lat
 * @param {number} lon
 * @param {Object} options
 * @returns {Promise<Array<any>>}
 */
export async function getLiveBuses(lat, lon, { radius = 1000, stopId = "", maxAge = 90 } = {}) {
  const token = await getGuestToken();
  if (!token) return [];

  const url = `${BASE_URL}/v1/bus?latitude=${lat}&longitude=${lon}&radius=${radius}`;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "TJ-Transjakarta/3.1.1 (Android)",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "X-Device-Id": DEVICE_ID,
      },
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) return [];
    const json = await res.json();
    const rawBuses = Array.isArray(json?.data) ? json.data : [];

    const nowSec = Date.now() / 1000;
    const enriched = [];

    for (const b of rawBuses) {
      if (b.latitude == null || b.longitude == null) continue;

      const dist = haversine(lat, lon, b.latitude, b.longitude);
      const ts = Number(b.timestamp);
      const ageSec = ts > 0 ? Math.max(0, nowSec - ts / 1000) : 0;

      // Filter stale telemetry (> maxAge seconds)
      if (ageSec > maxAge) continue;

      // Check if bus is approaching this stopId if specified
      let matchedEta = b.estimated_time_next_stops ?? 0;
      let isApproaching = true;

      if (stopId && Array.isArray(b.stops)) {
        const foundStop = b.stops.find(
          (st) => st.stop_id === stopId || st.parent_stop_id === stopId || st.parent_stop_id?.startsWith(stopId)
        );
        if (foundStop) {
          matchedEta = foundStop.eta ?? 0;
        } else if (dist > 1500) {
          isApproaching = false;
        }
      }

      if (isApproaching) {
        enriched.push({
          bodyNo: b.bus_body_no || "-",
          routeCode: b.route_code || "-",
          routeName: b.route_name || "-",
          headsign: b.trip_headsign || b.route_name || "-",
          speed: b.speed || 0,
          eta: matchedEta,
          distance: Math.round(dist),
          ageSeconds: Math.round(ageSec),
          nextStop: b.next_stops || "-",
        });
      }
    }

    // Sort by ETA ascending, then distance
    enriched.sort((a, b) => a.eta - b.eta || a.distance - b.distance);
    return enriched;
  } catch (err) {
    console.warn("[TransJakarta] Error fetch live buses:", err.message);
    return [];
  }
}
