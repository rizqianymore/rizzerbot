import os from "os";
import process from "process";
import { getUptimeString } from "@/src/utils/helper.js";
import { runningBots } from "@/src/core/secondary.js";
import { db } from "@/src/core/database.js";

function formatBytes(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export default {
  name: "server",
  aliases: ["host", "vps", "telemetry"],
  description: "Menampilkan metrik performa VPS, RAM, CPU, load server, dan status bot instances.",
  usage: "",
  category: "Owner",
  ownerOnly: true,
  premiumOnly: true,
  run: async (sock, msg, args, { sendTyping }) => {
    await sendTyping();

    // RAM Metrics
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsagePercent = ((usedMem / totalMem) * 100).toFixed(1);

    const procMem = process.memoryUsage();
    const rss = formatBytes(procMem.rss);
    const heapUsed = formatBytes(procMem.heapUsed);
    const heapTotal = formatBytes(procMem.heapTotal);

    // CPU Metrics
    const cpus = os.cpus();
    const cpuModel = cpus[0]?.model || "Unknown CPU";
    const cpuCores = cpus.length;
    const loadAvg = os.loadavg().map((l) => l.toFixed(2)).join(", ");

    // Uptime Metrics
    const nodeUptime = getUptimeString();
    const osUptimeSec = os.uptime();
    const osDays = Math.floor(osUptimeSec / 86400);
    const osHours = Math.floor((osUptimeSec % 86400) / 3600);
    const osUptimeStr = `${osDays}h ${osHours}j`;

    // Active sub-bots
    const activeSubBots = runningBots?.size || 0;
    const totalUsers = Object.keys(db.data.users || {}).length;

    const report =
      `🖥️ *VPS & SERVER TELEMETRY REPORT*\n\n` +
      `📌 *Hardware & OS Specs*\n` +
      `├─ Hostname   : \`${os.hostname()}\`\n` +
      `├─ Platform   : ${os.type()} ${os.arch()} (${os.release()})\n` +
      `├─ CPU Core   : ${cpuCores}x (${cpuModel})\n` +
      `├─ Load Avg   : \`[${loadAvg}]\` (1, 5, 15 m)\n` +
      `└─ Node Uptime: *${nodeUptime}* (OS: ${osUptimeStr})\n\n` +
      `🧠 *RAM & Memory Allocation*\n` +
      `├─ System RAM : ${formatBytes(usedMem)} / ${formatBytes(totalMem)} (*${memUsagePercent}%*)\n` +
      `├─ Process RSS: *${rss}*\n` +
      `└─ Node Heap  : ${heapUsed} / ${heapTotal}\n\n` +
      `🤖 *Bot Core Health*\n` +
      `├─ Node Version : ${process.version}\n` +
      `├─ Active Sub-Bots : *${activeSubBots}* instance(s)\n` +
      `├─ DB User Entity  : *${totalUsers}* entities\n` +
      `└─ Process PID  : \`${process.pid}\``;

    await sock.sendMessage(
      msg.key.remoteJid,
      { text: report },
      { quoted: msg }
    );
  },
};
