import { fetchJSON, fetchAllList, matchDriver, matchTeam, matchCircuit, norm } from "./client.js";

export async function getDriverById(id) {
  const data = await fetchJSON(`/drivers/${encodeURIComponent(String(id).toLowerCase())}`);
  const d = data?.driver?.[0] || data?.drivers?.[0];
  if (!d) throw Object.assign(new Error(`Driver "${id}" tidak ditemukan.`), { status: 404 });
  return d;
}
export async function searchDrivers(query, limit = 10) {
  const q = String(query || "").trim();
  if (!q) {
    const data = await fetchJSON(`/drivers?limit=${limit}&offset=0`);
    return data?.drivers || [];
  }

  const idGuess = q.toLowerCase().replace(/\s+/g, "_");
  try {
    const direct = await getDriverById(idGuess);
    if (direct && matchDriver(direct, q)) return [direct];
  } catch (_) {}

  const all = await fetchAllList("/drivers", "drivers");
  const hits = all.filter((d) => matchDriver(d, q));

  hits.sort((a, b) => {
    const score = (d) =>
      norm(d.driverId) === norm(q) || norm(d.shortName) === norm(q) ? 0
      : norm(d.surname) === norm(q) ? 1 : 2;
    return score(a) - score(b);
  });
  return hits.slice(0, limit);
}

export async function getTeamById(id) {
  const data = await fetchJSON(`/teams/${encodeURIComponent(String(id).toLowerCase())}`);
  const t = data?.team?.[0] || data?.teams?.[0];
  if (!t) throw Object.assign(new Error(`Tim "${id}" tidak ditemukan.`), { status: 404 });
  return t;
}
export async function searchTeams(query, limit = 10) {
  const q = String(query || "").trim();
  if (!q) {
    const data = await fetchJSON(`/teams?limit=${limit}&offset=0`);
    return data?.teams || [];
  }
  const idGuess = q.toLowerCase().replace(/\s+/g, "_");
  try {
    const direct = await getTeamById(idGuess);
    if (direct && matchTeam(direct, q)) return [direct];
  } catch (_) {}
  const all = await fetchAllList("/teams", "teams", { maxTotal: 600 });
  return all.filter((t) => matchTeam(t, q)).slice(0, limit);
}

export async function getCircuitById(id) {
  const data = await fetchJSON(`/circuits/${encodeURIComponent(String(id).toLowerCase())}`);
  const c = data?.circuit?.[0] || data?.circuits?.[0];
  if (!c) throw Object.assign(new Error(`Sirkuit "${id}" tidak ditemukan.`), { status: 404 });
  return c;
}
export async function searchCircuits(query, limit = 10) {
  const q = String(query || "").trim();
  if (!q) {
    const data = await fetchJSON(`/circuits?limit=${limit}&offset=0`);
    return data?.circuits || [];
  }
  const idGuess = q.toLowerCase().replace(/\s+/g, "_");
  try {
    const direct = await getCircuitById(idGuess);
    if (direct && matchCircuit(direct, q)) return [direct];
  } catch (_) {}
  const all = await fetchAllList("/circuits", "circuits", { maxTotal: 300 });
  return all.filter((c) => matchCircuit(c, q)).slice(0, limit);
}
