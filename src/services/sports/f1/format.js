import { getWikiThumbnail } from "./wiki.js";

export async function replyDetail(sock, msg, replyFn, caption, wikiUrl) {
  const text = String(caption || "").trim() || "-";
  try {
    const img = await getWikiThumbnail(wikiUrl);
    if (img) {
      if (text.length > 1000) {
        await sock.sendMessage(msg.key.remoteJid, { image: img }, { quoted: msg });
        await replyFn(text);
      } else {
        await sock.sendMessage(msg.key.remoteJid, { image: img, caption: text }, { quoted: msg });
      }
      return "image";
    }
  } catch (_) {}
  await replyFn(text);
  return "text";
}

export function fmtDriver(d) {
  const full = `${d.name ?? "-"} ${d.surname ?? ""}`.trim();
  return (
    `🏎️ *${full}* (${d.shortName || "-"})\n` +
    `• ID: ${d.driverId}\n` +
    `• No: ${d.number ?? "-"} | Kebangsaan: ${d.nationality ?? "-"}\n` +
    `• Lahir: ${d.birthday ?? "-"}\n` +
    `• Wiki: ${d.url ?? "-"}`
  );
}
export function fmtTeam(t) {
  return (
    `🏁 *${t.teamName}* (\`${t.teamId}\`)\n` +
    `• Negara: ${t.teamNationality ?? t.country ?? "-"}\n` +
    `• Debut: ${t.firstAppeareance ?? t.firstAppareance ?? "-"}\n` +
    `• Gelar konstruktor: ${t.constructorsChampionships ?? "-"}\n` +
    `• Gelar pembalap: ${t.driversChampionships ?? "-"}\n` +
    `• Wiki: ${t.url ?? "-"}`
  );
}
export function fmtCircuit(c) {
  const len = typeof c.circuitLength === "number" ? `${c.circuitLength} m` : (c.circuitLength ?? "-");
  return (
    `🔄 *${c.circuitName}* (\`${c.circuitId}\`)\n` +
    `• ${c.city ?? "-"}, ${c.country ?? "-"}\n` +
    `• Panjang: ${len} | Tikungan: ${c.numberOfCorners ?? c.corners ?? "-"}\n` +
    `• Debut F1: ${c.firstParticipationYear ?? "-"}\n` +
    `• Rekor lap: ${c.lapRecord ?? "-"} (${c.fastestLapYear ?? "-"}, ${c.fastestLapDriverId ?? "-"} / ${c.fastestLapTeamId ?? "-"})\n` +
    `• Wiki: ${c.url ?? "-"}`
  );
}
export function fmtDriversStandings(data, limit = 10) {
  const arr = data?.drivers_championship || [];
  const lines = [`🏆 *Klasemen Pembalap ${data?.season ?? ""}*`];
  arr.slice(0, limit).forEach((r) => {
    const d = r.driver || {};
    lines.push(
      `${r.position}. ${d.name ?? ""} ${d.surname ?? ""} (${d.shortName ?? r.driverId}) — ${r.teamId} | ${r.points} pts | 🏅${r.wins ?? 0}`
    );
  });
  return lines.join("\n");
}
export function fmtConstructorsStandings(data, limit = 10) {
  const arr = data?.constructors_championship || [];
  const lines = [`🏆 *Klasemen Konstruktor ${data?.season ?? ""}*`];
  arr.slice(0, limit).forEach((r) => {
    lines.push(`${r.position}. ${r.team?.teamName ?? r.teamId} | ${r.points} pts | 🏅${r.wins ?? 0}`);
  });
  return lines.join("\n");
}
export function fmtRaceList(data, limit = 15) {
  const races = data?.races || [];
  const lines = [`🗓️ *Jadwal F1 ${data?.season ?? ""}* (${races.length} seri)`];
  races.slice(0, limit).forEach((r) => {
    const date = r.schedule?.race?.date || r.date || "-";
    lines.push(`R${r.round}. ${r.raceName} — ${date}`);
  });
  if (races.length > limit) lines.push(`_... dan ${races.length - limit} seri lainnya._`);
  return lines.join("\n");
}
export function fmtRaceDetail(data) {
  const r = (data?.race || [])[0];
  if (!r) return "Data balapan tidak ditemukan.";
  const s = r.schedule || {};
  const c = r.circuit || {};
  return (
    `🏁 *${r.raceName}* (R${r.round}, ${data?.season ?? ""})\n` +
    `• Sirkuit: ${c.circuitName ?? "-"} (${c.city ?? "-"}, ${c.country ?? "-"})\n` +
    `• Lap: ${r.laps ?? "-"} | Race: ${s.race?.date ?? "-"} ${s.race?.time ?? ""}\n` +
    `• Kualifikasi: ${s.qualy?.date ?? "-"} ${s.qualy?.time ?? ""}\n` +
    `• Pemenang: ${r.winner ? `${r.winner.name} ${r.winner.surname} (${r.winner.shortName ?? "-"})` : "-"}${r.teamWinner ? ` — ${r.teamWinner.teamName ?? r.teamWinner.teamId ?? ""}` : ""}\n` +
    `• Fastest lap: ${r.fast_lap?.fast_lap ?? "-"} (${r.fast_lap?.fast_lap_driver_id ?? "-"})`
  );
}
export function fmtSessionResults(data, limit = 10) {
  const info = data?.races || {};
  const results = info.results || info.qualyResults || info.fpResults || info.sprintResults || [];
  const title = info.raceName ? `*${info.raceName}* (R${info.round ?? "-"}, ${data?.season ?? ""})` : "*Hasil F1*";
  const lines = [`🏁 ${title}`];
  results.slice(0, limit).forEach((r) => {
    const d = r.driver || {};
    const name = `${d.name ?? ""} ${d.surname ?? ""}`.trim() || r.driverId || "-";
    if (r.q3 !== undefined || r.q1 !== undefined) {
      lines.push(
        `P${r.gridPosition ?? "-"} ${name} (${d.shortName ?? "-"}): Q1 ${r.q1 ?? "-"} | Q2 ${r.q2 ?? "-"} | Q3 ${r.q3 ?? "-"}`
      );
    } else {
      const pos = r.position ?? "-";
      const time = r.time ?? r.fastLap ?? (r.retired ? `DNF (${r.retired})` : "-");
      lines.push(
        `P${pos} ${name} (${d.shortName ?? "-"} | ${r.team?.teamId ?? r.teamId ?? "-"}) — ${r.points ?? 0} pts | ${time}`
      );
    }
  });
  if (results.length > limit) lines.push(`_... dan ${results.length - limit} hasil lainnya._`);
  return lines.join("\n");
}
