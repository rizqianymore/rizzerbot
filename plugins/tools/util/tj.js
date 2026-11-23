import fs from "fs";
import path from "path";

const BASE_URL = "https://tijeapi.transjakarta.co.id";
const DEVICE_ID = "d4f8a1b2c3e4f5a6";
const DB_PATH = path.join(process.cwd(), "assets", "transjakarta", "tj_database.json");
const DEFAULT_TIMEOUT_MS = 15000;

let tokenCache = null;
let tokenExpiry = 0;
let stopsCache = null;

/**
 * Geodesic distance in meters (Haversine formula)
 */
function haversine(lat1, lon1, lat2, lon2) {
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
 * Calculate age of bus telemetry in seconds
 */
function busAgeSeconds(ts) {
  if (!ts) return null;
  const num = Number(ts);
  if (!Number.isFinite(num)) return null;
  return Math.max(0, Date.now() / 1000.0 - num / 1000.0);
}

/**
 * Load 7.210 stops from local database
 */
function getStopsDatabase() {
  if (stopsCache) return stopsCache;
  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      stopsCache = parsed?.stops || [];
    }
  } catch (_) {
    stopsCache = [];
  }
  return stopsCache || [];
}

/**
 * Resolve single best halte from name or code
 */
function resolveHalte(keyword) {
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
  if (match) return match;

  // 4. Token-based multi-word match
  const tokens = k.split(/\s+/).filter(Boolean);
  if (tokens.length > 1) {
    const allTokens = stops.find((s) => {
      const name = s.stop_name?.toLowerCase() || "";
      return tokens.every((t) => name.includes(t));
    });
    if (allTokens) return allTokens;

    const someTokens = stops.find((s) => {
      const name = s.stop_name?.toLowerCase() || "";
      return tokens.some((t) => name.includes(t));
    });
    if (someTokens) return someTokens;
  }

  return null;
}

/**
 * Search halte in local DB with tokenized multi-word ranking
 */
function searchHalte(keyword, limit = 20) {
  const stops = getStopsDatabase();
  const k = String(keyword || "")
    .trim()
    .toLowerCase();
  if (!k) return [];

  // Exact substring
  const exactSub = stops.filter((s) => s.stop_name?.toLowerCase().includes(k));
  if (exactSub.length > 0) return exactSub.slice(0, limit);

  // Multi-word tokens
  const tokens = k.split(/\s+/).filter(Boolean);
  if (tokens.length > 1) {
    // Stage 1: Halte containing ALL words
    const allWords = stops.filter((s) => {
      const name = s.stop_name?.toLowerCase() || "";
      return tokens.every((t) => name.includes(t));
    });
    if (allWords.length > 0) return allWords.slice(0, limit);

    // Stage 2: Halte containing ANY word (ranked by number of matching words)
    const ranked = [];
    for (const s of stops) {
      const name = s.stop_name?.toLowerCase() || "";
      let matches = 0;
      for (const t of tokens) {
        if (name.includes(t)) matches++;
      }
      if (matches > 0) {
        ranked.push({ halte: s, score: matches });
      }
    }
    ranked.sort((a, b) => b.score - a.score);
    return ranked.slice(0, limit).map((r) => r.halte);
  }

  return [];
}

/**
 * Obtain guest token from TransJakarta API
 */
async function getGuestToken() {
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
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.token) {
        tokenCache = data.token;
        tokenExpiry = data.token_valid_until ? Number(data.token_valid_until) * 1000 : now + 3600000;
        return tokenCache;
      }
    }
  } catch (_) {}

  return tokenCache || "";
}

/**
 * Generic fetch wrapper for TransJakarta API
 */
async function fetchTije(endpointPath, { method = "GET", params = null, body = null } = {}) {
  const token = await getGuestToken();
  let url = `${BASE_URL}${endpointPath}`;

  const headers = {
    "User-Agent": "TJ-Transjakarta/3.1.1 (Android)",
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-Device-Id": DEVICE_ID,
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const fetchOpts = { method, headers, signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS) };

  if (method === "GET" && params) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v != null) sp.append(k, String(v));
    }
    const qs = sp.toString();
    if (qs) url += (url.includes("?") ? "&" : "?") + qs;
  } else if (body) {
    fetchOpts.body = JSON.stringify(body);
  }

  let res = await fetch(url, fetchOpts);
  if (res.status === 401) {
    tokenCache = null;
    const freshToken = await getGuestToken();
    if (freshToken) headers.Authorization = `Bearer ${freshToken}`;
    res = await fetch(url, fetchOpts);
  }

  try {
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Autocomplete place search via Google Places bridge on TIJE API
 */
async function autocompletePlaces(query) {
  const d = await fetchTije("/v2/maps/autocomplete", {
    method: "POST",
    body: { query },
  });
  return Array.isArray(d?.data) ? d.data : [];
}

/**
 * 1) Bus yang AKAN DATANG ke halte + ETA
 * Menggunakan pencocokan ID halte, nama halte pada perhentian, serta bus aktif di terminal/radius halte
 */
async function getHalteArrivals(lat, lon, { radius = 1000, stopId = null, stopName = "", maxAge = 90 } = {}) {
  let resolvedStopId = stopId;
  let resolvedStopName = stopName || stopId;

  if (!resolvedStopId) {
    const sd = await fetchTije("/v2/bus-stop", {
      params: { latitude: lat, longitude: lon, radius: 300 },
    });
    const stops = Array.isArray(sd?.data) ? sd.data : [];
    if (stops.length > 0) {
      resolvedStopId = stops[0].stop_id;
      resolvedStopName = stops[0].stop_name;
    } else {
      return { stopName: null, stopId: null, arrivals: [] };
    }
  }

  const d = await fetchTije("/v1/bus", {
    params: { latitude: lat, longitude: lon, radius },
  });
  const buses = Array.isArray(d?.data) ? d.data : [];
  const arrivals = [];
  const seenBuses = new Set();
  const targetLower = String(resolvedStopName || "").toLowerCase();

  // PASS 1: Bus yang secara eksplisit memuat halte ini di daftar stops rutenya
  for (const b of buses) {
    const bodyNo = b.bus_body_no || "-";
    if (seenBuses.has(bodyNo)) continue;

    const age = busAgeSeconds(b.timestamp);
    if (age != null && age > maxAge) continue;

    for (const st of b.stops || []) {
      const matchId =
        (st.parent_stop_id && st.parent_stop_id === resolvedStopId) || (st.stop_id && st.stop_id === resolvedStopId);

      const matchName =
        targetLower && (st.name?.toLowerCase() === targetLower || st.parent_stop_name?.toLowerCase() === targetLower);

      if (matchId || matchName) {
        seenBuses.add(bodyNo);
        arrivals.push({
          body: bodyNo,
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

  // PASS 2: Jika armada masih kurang dari 5, ambil bus yang secara fisik berada sangat dekat (≤ 500m)
  // Cocok untuk terminal utama/pemberhentian awal tempat bus sedang parkir/siap berangkat
  if (arrivals.length < 5) {
    for (const b of buses) {
      const bodyNo = b.bus_body_no || "-";
      if (seenBuses.has(bodyNo)) continue;
      if (b.latitude == null || b.longitude == null) continue;

      const age = busAgeSeconds(b.timestamp);
      if (age != null && age > maxAge) continue;

      const dist = haversine(lat, lon, b.latitude, b.longitude);
      if (dist != null && dist <= 500) {
        seenBuses.add(bodyNo);
        arrivals.push({
          body: bodyNo,
          route: b.route_code || "-",
          tujuan: b.trip_headsign || b.route_name || "-",
          eta: 0,
          jarak: dist,
          umur: age != null ? Math.round(age) : null,
          speed: b.speed || 0,
          trip: b.trip_id,
          nextStop: b.next_stops || "-",
        });
      }
      if (arrivals.length >= 10) break;
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
 * 2) Rute dari halte
 */
async function getRuteFromHalte(lat, lon, { radius = 1000, maxAge = 60, tujuan = null } = {}) {
  const sd = await fetchTije("/v2/bus-stop", {
    params: { latitude: lat, longitude: lon, radius: 300 },
  });
  const stops = Array.isArray(sd?.data) ? sd.data : [];
  if (!stops.length) {
    return { stopName: null, stopId: null, routes: [] };
  }

  const stop = stops[0];
  const stopId = stop.stop_id;
  const stopName = stop.stop_name;

  const d = await fetchTije("/v1/bus", {
    params: { latitude: lat, longitude: lon, radius },
  });
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
 * 3) Detail 1 bus
 */
async function getBusDetail(bodyNo) {
  const d = await fetchTije("/v1/bus", {
    params: { latitude: -6.2088, longitude: 106.8456, radius: 25000 },
  });
  const buses = Array.isArray(d?.data) ? d.data : [];
  const q = String(bodyNo).toLowerCase();
  const hit = buses.find((b) =>
    String(b.bus_body_no || "")
      .toLowerCase()
      .includes(q)
  );
  return hit || null;
}

/**
 * 4) Semua rute
 */
async function getRoutesList(keyword = null) {
  const d = await fetchTije("/v2/route");
  let routes = d?.data?.routes || [];
  if (keyword) {
    const k = String(keyword).toLowerCase();
    routes = routes.filter(
      (r) => r.route_short_name?.toLowerCase().includes(k) || r.route_long_name?.toLowerCase().includes(k)
    );
  }
  return routes;
}

function getWibTime() {
  const now = new Date();
  const wibHours = (now.getUTCHours() + 7) % 24;
  const wibMinutes = now.getUTCMinutes();
  return `${String(wibHours).padStart(2, "0")}:${String(wibMinutes).padStart(2, "0")} WIB`;
}

export default {
  name: "transjakarta",
  aliases: ["tj", "tije", "busway", "halte"],
  description: "Cek bus TransJakarta live, rute koridor, & ETA kedatangan halte (TIJE API)",
  usage: "<nama halte> | cari <nama> | rute <nama halte> [tujuan] | bus <no bodi>",
  category: "Info",
  cooldownMs: 5000,

  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const p = prefix || ".";
    if (!args[0]) {
      return reply(
        `┌── TRANSJAKARTA LIVE TRACKER (TIJE)\n` +
          `│ Posisi bus real-time & estimasi kedatangan di halte.\n` +
          `└──\n\n` +
          `├── [1] Cek Bus Tiba di Halte\n` +
          `│   Format: ${p}tj <nama halte>\n` +
          `│   Contoh: ${p}tj Blok M\n` +
          `│\n` +
          `├── [2] Cari Nama / ID Halte\n` +
          `│   Format: ${p}tj cari <kata kunci>\n` +
          `│   Contoh: ${p}tj cari Kuningan\n` +
          `│\n` +
          `├── [3] Cek Rute dari Halte\n` +
          `│   Format: ${p}tj rute <nama halte> [tujuan]\n` +
          `│   Contoh: ${p}tj rute "Blok M" Monas\n` +
          `│\n` +
          `└── [4] Detail 1 Armada Bus\n` +
          `    Format: ${p}tj bus <no bodi>\n` +
          `    Contoh: ${p}tj bus TJ-336`
      );
    }

    const sub = args[0].toLowerCase();
    const timeStr = getWibTime();

    // 1. CARI HALTE
    if (sub === "cari" || sub === "search") {
      const keyword = args.slice(1).join(" ").trim();
      if (!keyword) {
        return reply(`Gunakan: \`${p}tj cari <nama halte>\`\nContoh: \`${p}tj cari Kuningan\``);
      }

      await sendTyping();
      let hits = searchHalte(keyword, 8);

      // Jika di DB lokal tidak ada, cari via maps autocomplete online
      if (hits.length === 0) {
        const places = await autocompletePlaces(keyword);
        if (places.length > 0) {
          let text =
            `┌── PENCARIAN TEMPAT / HALTE (ONLINE)\n` +
            `│ Kata Kunci : ${keyword}\n` +
            `│ Ditemukan  : ${places.length} lokasi\n` +
            `└──\n\n`;

          const disp = places.slice(0, 6);
          disp.forEach((item, i) => {
            const isLast = i === disp.length - 1;
            const branch = isLast ? "└──" : "├──";
            const subPipe = isLast ? "   " : "│  ";
            text += `${branch} [${i + 1}] ${item.name}\n`;
            text += `${subPipe} Alamat : ${item.address || item.full_text || "-"}\n`;
          });

          text += `\n_Catatan: Lokasi di atas adalah area publik/tempat. Gunakan nama halte terdekat untuk cek bus._`;
          return reply(text);
        }

        return reply(`❌ Halte dengan kata kunci "*${keyword}*" tidak ditemukan di database TransJakarta.`);
      }

      let text =
        `┌── PENCARIAN HALTE TRANSJAKARTA\n` +
        `│ Kata Kunci : ${keyword}\n` +
        `│ Ditemukan  : ${hits.length} halte\n` +
        `└──\n\n`;

      hits.forEach((h, i) => {
        const isLast = i === hits.length - 1;
        const branch = isLast ? "└──" : "├──";
        const subPipe = isLast ? "   " : "│  ";
        const routes = (h.routes || [])
          .slice(0, 4)
          .map((r) => r.route_code)
          .join(", ");

        text += `${branch} [${i + 1}] ${h.stop_name} (${h.stop_id})\n`;
        if (routes) text += `${subPipe} Rute : ${routes}\n`;
      });

      text += `\n_Ketik \`${p}tj <nama halte>\` untuk cek jadwal kedatangan bus._`;
      return reply(text);
    }

    // 2. RUTE DARI HALTE (NAIK APA DARI SINI)
    if (sub === "rute" || sub === "naik") {
      const rest = args.slice(1).join(" ").trim();
      if (!rest) {
        return reply(`Gunakan: \`${p}tj rute <nama halte> [tujuan]\`\nContoh: \`${p}tj rute "Blok M" Monas\``);
      }

      let halteQuery = rest;
      let tujuanQuery = "";

      if (rest.startsWith('"')) {
        const endQuote = rest.indexOf('"', 1);
        if (endQuote !== -1) {
          halteQuery = rest.slice(1, endQuote).trim();
          tujuanQuery = rest.slice(endQuote + 1).trim();
        }
      }

      await sendTyping();
      const halte = resolveHalte(halteQuery);
      if (!halte) {
        return reply(`❌ Halte "*${halteQuery}*" tidak ditemukan. Coba ketik: \`${p}tj cari ${halteQuery}\``);
      }

      const res = await getRuteFromHalte(halte.stop_lat, halte.stop_lon, {
        radius: 1200,
        tujuan: tujuanQuery || null,
      });

      if (!res.routes || res.routes.length === 0) {
        return reply(
          `┌── RUTE DARI HALTE\n` +
            `│ Halte : ${halte.stop_name} (${halte.stop_id})\n` +
            `└──\n\n` +
            `_Tidak ditemukan bus/rute aktif dari halte ini${tujuanQuery ? ` menuju "${tujuanQuery}"` : ""}_`
        );
      }

      let text =
        `┌── RUTE DARI HALTE\n` +
        `│ Halte       : ${res.stopName || halte.stop_name} (${res.stopId || halte.stop_id})\n` +
        `│ Waktu Acuan : ${timeStr}\n` +
        (tujuanQuery ? `│ Filter Arah : ${tujuanQuery}\n` : "") +
        `└──\n\n`;

      const displayRoutes = res.routes.slice(0, 7);
      displayRoutes.forEach((r, i) => {
        const isLast = i === displayRoutes.length - 1;
        const branch = isLast ? "└──" : "├──";
        const subPipe = isLast ? "   " : "│  ";
        const etaText = r.eta != null ? `${r.eta} mnt` : `Segera`;

        text += `${branch} [${i + 1}] Koridor ${r.route} ➔ ${r.tujuan}\n`;
        text += `${subPipe} Estimasi : ${etaText}\n`;
        text += `${subPipe} Armada   : ${r.jumlahBus} bus terdeteksi\n`;
      });

      text += `\n_Menampilkan ${displayRoutes.length} rute aktif. Sumber: tijeapi.transjakarta.co.id_`;
      return reply(text);
    }

    // 3. DETAIL 1 BUS BERDASARKAN NOMOR BODI
    if (sub === "bus" || sub === "body") {
      const bodyNo = args[1];
      if (!bodyNo) {
        return reply(`Gunakan: \`${p}tj bus <nomor bodi bus>\`\nContoh: \`${p}tj bus TJ-336\``);
      }

      await sendTyping();
      const bus = await getBusDetail(bodyNo);
      if (!bus) {
        return reply(`❌ Bus dengan nomor bodi "*${bodyNo}*" tidak ditemukan dalam area aktif saat ini.`);
      }

      let text =
        `┌── DETAIL ARMADA BUS TRANSJAKARTA\n` +
        `│ No Bodi   : ${bus.bus_body_no || bodyNo}\n` +
        `│ Koridor   : ${bus.route_code || "-"} (${bus.route_name || "-"})\n` +
        `│ Arah      : ${bus.trip_headsign || "-"}\n` +
        `│ Kecepatan : ${bus.speed || 0} km/j\n` +
        `│ Stop Lalu : ${bus.prev_stops || "-"}\n` +
        `│ Stop Depan: ${bus.next_stops || "-"}\n` +
        `└──\n\n`;

      if (Array.isArray(bus.stops) && bus.stops.length > 0) {
        text += `HALTE BERIKUTNYA YANG AKAN DILALUI:\n`;
        const upcomingStops = bus.stops.slice(0, 6);
        upcomingStops.forEach((st, idx) => {
          const isLast = idx === upcomingStops.length - 1;
          const branch = isLast ? "└──" : "├──";
          text += `${branch} [${st.stop_sequence || idx + 1}] ${st.parent_stop_name || st.name} (ETA: ${st.eta ?? 0} mnt)\n`;
        });
      }

      return reply(text);
    }

    // 4. DAFTAR RUTE / KORIDOR RESMI
    if (sub === "koridor" || sub === "routes" || sub === "daftar") {
      const filterWord = args.slice(1).join(" ").trim();
      await sendTyping();
      const routes = await getRoutesList(filterWord);

      if (!routes || routes.length === 0) {
        return reply(`❌ Tidak ditemukan koridor / rute TransJakarta dengan kata kunci "*${filterWord}*".`);
      }

      let text =
        `┌── KORIDOR TRANSJAKARTA\n` +
        `│ Total Rute : ${routes.length} rute\n` +
        (filterWord ? `│ Filter     : ${filterWord}\n` : "") +
        `└──\n\n`;

      const display = routes.slice(0, 10);
      display.forEach((r, i) => {
        const isLast = i === display.length - 1;
        const branch = isLast ? "└──" : "├──";
        const subPipe = isLast ? "   " : "│  ";
        text += `${branch} [${r.route_short_name}] ${r.route_long_name}\n`;
        text += `${subPipe} Tipe: ${r.route_desc || "BRT"} | Tarif: Rp${r.price || "3.500"}\n`;
      });

      if (routes.length > 10) {
        text += `\n_Menampilkan 10 dari ${routes.length} rute. Persempit: \`${p}tj koridor <daerah>\`_`;
      }
      return reply(text);
    }

    // 5. DEFAULT: CEK BUS TIBA DI HALTE (ETA) / KORIDOR RUTE
    const query = args.join(" ").trim();
    await sendTyping();

    // 5a. Auto-detect jika input user adalah kode rute/koridor (e.g. B41, 3F, JAK.50, 4D, 1A)
    const upperQuery = query.toUpperCase();
    const allStops = getStopsDatabase();
    const routeMatchingStops = allStops.filter((s) =>
      (s.routes || []).some((r) => r.route_code?.toUpperCase() === upperQuery)
    );

    if (routeMatchingStops.length > 0) {
      // Ambil nama rute/tujuan representatif
      const sampleRoute = routeMatchingStops[0].routes.find((r) => r.route_code?.toUpperCase() === upperQuery);
      const routeName = sampleRoute?.route_name || upperQuery;

      let text =
        `┌── KORIDOR ${upperQuery} TRANSJAKARTA\n` +
        `│ Rute        : ${routeName}\n` +
        `│ Total Halte : ${routeMatchingStops.length} halte dilewati\n` +
        `└──\n\n`;

      const displayStops = routeMatchingStops.slice(0, 10);
      displayStops.forEach((st, i) => {
        const isLast = i === displayStops.length - 1;
        const branch = isLast ? "└──" : "├──";
        text += `${branch} [${i + 1}] ${st.stop_name} (${st.stop_id})\n`;
      });

      if (routeMatchingStops.length > 10) {
        text += `\n_Menampilkan 10 dari ${routeMatchingStops.length} halte. Cek halte: \`${p}tj <nama halte>\`_`;
      } else {
        text += `\n_Ketik \`${p}tj <nama halte>\` untuk cek kedatangan armada di halte tersebut._`;
      }

      return reply(text);
    }

    const halte = resolveHalte(query);
    if (!halte) {
      return reply(
        `❌ Halte / Rute *"${query}"* tidak ditemukan di database TransJakarta.\n\n` +
          `_Coba cari nama resminya terlebih dahulu dengan: \`${p}tj cari ${query}\`_`
      );
    }

    const arrivalsData = await getHalteArrivals(halte.stop_lat, halte.stop_lon, {
      radius: 1200,
      stopId: halte.stop_id,
      stopName: halte.stop_name,
      maxAge: 120,
    });

    const arrivals = arrivalsData?.arrivals || [];

    if (arrivals.length === 0) {
      return reply(
        `┌── TRANSJAKARTA LIVE BUS\n` +
          `│ Halte       : ${halte.stop_name} (${halte.stop_id})\n` +
          `│ Waktu Acuan : ${timeStr}\n` +
          `└──\n\n` +
          `_Saat ini tidak ada bus aktif dalam radius halte atau data GPS sedang diperbarui._\n` +
          `_Coba ketik \`${p}tj rute "${halte.stop_name}"\` untuk melihat rute jalur halte ini._`
      );
    }

    // Tampilkan hingga 5 armada terdekat
    const displayBuses = arrivals.slice(0, 5);

    let text =
      `┌── TRANSJAKARTA LIVE BUS\n` +
      `│ Halte       : ${halte.stop_name} (${halte.stop_id})\n` +
      `│ Waktu Acuan : ${timeStr}\n` +
      `└──\n\n`;

    displayBuses.forEach((b, i) => {
      const isLast = i === displayBuses.length - 1;
      const branch = isLast ? "└──" : "├──";
      const subPipe = isLast ? "   " : "│  ";

      const etaStr = typeof b.eta === "number" && b.eta > 0 ? `${b.eta} mnt lagi` : `Tiba sekarang / Dekat`;
      const distStr = b.jarak != null ? ` (±${Math.round(b.jarak)}m)` : "";
      const speedNum = typeof b.speed === "number" ? Math.round(b.speed) : 0;
      const speedStr = `${speedNum} km/j`;
      const updateStr = `Update ${b.umur ?? 0}s lalu`;

      text += `${branch} [${i + 1}] Koridor ${b.route} ➔ ${b.tujuan}\n`;
      text += `${subPipe} No Bodi   : ${b.body}\n`;
      text += `${subPipe} Estimasi  : ${etaStr}${distStr}\n`;
      text += `${subPipe} Kecepatan : ${speedStr} (${updateStr})\n`;
      if (!isLast) {
        text += `│\n`;
      }
    });

    text += `\n_Menampilkan ${displayBuses.length} armada terdekat. Sumber: tijeapi.transjakarta.co.id_`;

    return reply(text);
  },
};
