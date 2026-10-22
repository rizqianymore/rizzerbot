import os from "os";
import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

function formatBytes(n) {
  if (!Number.isFinite(n) || n < 0) return "-";
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1073741824) return `${(n / 1048576).toFixed(1)} MB`;
  return `${(n / 1073741824).toFixed(2)} GB`;
}

function formatUptime(sec) {
  const s = Math.max(0, Math.floor(sec));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${d}h ${h}j ${m}m`;
}

function cpuSnapshot() {
  let idle = 0;
  let total = 0;
  for (const c of os.cpus() || []) {
    idle += c.times.idle;
    total += c.times.user + c.times.nice + c.times.sys + c.times.idle + c.times.irq;
  }
  return { idle, total };
}

async function cpuUsagePercent(sampleMs = 400) {
  try {
    const a = cpuSnapshot();
    await new Promise((r) => setTimeout(r, sampleMs));
    const b = cpuSnapshot();
    const idle = b.idle - a.idle;
    const total = b.total - a.total;
    if (total <= 0) return null;
    return Math.max(0, Math.min(100, ((1 - idle / total) * 100).toFixed(1)));
  } catch (_) {
    return null;
  }
}

async function diskRoot() {
  try {
    const { stdout } = await execFileAsync("df", ["-h", "/"], { timeout: 8000 });
    const parts = String(stdout || "")
      .trim()
      .split("\n")
      .at(-1)
      ?.split(/\s+/);
    if (parts && parts.length >= 5) {
      return { total: parts[1], used: parts[2], avail: parts[3], pct: parts[4] };
    }
  } catch (_) {}
  return null;
}

function diskCwd() {
  try {
    const st = fs.statfsSync(process.cwd());
    const free = Number(st.bfree) * Number(st.bsize);
    const total = Number(st.blocks) * Number(st.bsize);
    return { total, free, used: total - free };
  } catch (_) {
    return null;
  }
}

function dbSizes() {
  const out = [];
  for (const f of ["database/database.json", "database/users.json", "database/rentals.json"]) {
    try {
      const st = fs.statSync(path.join(process.cwd(), f));
      out.push(`${path.basename(f, ".json")}: ${formatBytes(st.size)}`);
    } catch (_) {}
  }
  return out.length ? out.join(" | ") : "-";
}

async function lookupIp() {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 8000);
    const res = await fetch(
      "http://ip-api.com/json/?fields=status,message,country,countryCode,regionName,city,isp,query",
      {
        signal: ctl.signal,
      }
    );
    clearTimeout(timer);
    const j = await res.json();
    if (j && j.status === "success") return j;
  } catch (_) {}
  return null;
}

export default {
  name: "vps",
  aliases: ["cekvps", "vpsstatus", "serverinfo"],
  description: "Cek lengkap server (OS, CPU, RAM, Disk, IP + negara, tools, modul native, database)",
  usage: "",
  ownerOnly: true,
  category: "Owner",
  run: async (sock, msg, args, { reply, sendTyping, isPrimarySuperOwner }) => {
    if (!isPrimarySuperOwner) {
      return reply("Informasi status server VPS hanya dapat diakses oleh SuperOwner.");
    }
    await sendTyping();

    const [{ checkEnvironment }, { nativeStatus }, { isTermux }] = await Promise.all([
      import("@/src/utils/doctor.js"),
      import("@/src/utils/native.js"),
      import("@/src/utils/termux.js"),
    ]);

    const [cpuPct, root, ip] = await Promise.all([cpuUsagePercent(), diskRoot(), lookupIp()]);
    const cwd = diskCwd();
    const env = await checkEnvironment();
    const native = nativeStatus();

    const cpus = os.cpus() || [];
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memPct = totalMem > 0 ? ((usedMem / totalMem) * 100).toFixed(1) : "-";
    const load =
      typeof os.loadavg === "function"
        ? os
            .loadavg()
            .map((v) => v.toFixed(2))
            .join(" ")
        : "-";

    const tool = (ok) => (ok ? "OK" : "X");
    const coreTools = env.core.map((c) => `${c.name.split(" (")[0]}: ${tool(c.ok)}`).join(" | ");
    const nativeText = Object.entries(native)
      .map(([k, v]) => `${k}: ${tool(v)}`)
      .join(" | ");

    const netText = ip
      ? `IP: ${ip.query}\nNegara: ${ip.country} (${ip.countryCode}) | ${ip.regionName}, ${ip.city}\nISP: ${ip.isp}`
      : "IP/Negara: tidak terjangkau";

    const text =
      `*INFORMASI SERVER (ALL)*\n\n` +
      `*Sistem*\n` +
      `OS: ${os.platform()} ${os.arch()} (${os.release()})${isTermux() ? " [TERMUX]" : ""}\n` +
      `Host: ${os.hostname()}\n` +
      `Uptime sys: ${formatUptime(os.uptime())} | bot: ${formatUptime(process.uptime())}\n\n` +
      `*CPU*\n` +
      `${cpus[0]?.model || "Unknown"} (${cpus.length} core)\n` +
      `Load: ${cpuPct === null ? "-" : `${cpuPct}%`} | avg: ${load}\n\n` +
      `*RAM*\n` +
      `${formatBytes(usedMem)} / ${formatBytes(totalMem)} (${memPct}%) | free ${formatBytes(freeMem)}\n\n` +
      `*Disk*\n` +
      `/: ${root ? `${root.used} / ${root.total} (${root.pct})` : "-"}\n` +
      `cwd: ${cwd ? `${formatBytes(cwd.used)} / ${formatBytes(cwd.total)}` : "-"}\n` +
      `DB: ${dbSizes()}\n\n` +
      `*Jaringan*\n${netText}\n\n` +
      `*Tools*\n${coreTools}\n\n` +
      `*Native*\n${nativeText}\n\n` +
      `Node.js: ${process.version}`;

    return reply(text);
  },
};
