// plugins/owner/vps.js — perintah "vps" (1 file = 1 perintah, dipecah dari owner.js).
import { db } from '@/src/core/database.js';

export default {
  "name": "vps",
  "aliases": ["cekvps","vpsstatus","serverinfo"],
  "description": "Cek spesifikasi dan kondisi server VPS (CPU, RAM, Disk, OS, Uptime)",
  "usage": "",
  "ownerOnly": true,
  "category": "Owner",
  "run": async (sock, msg, args, { reply, sendTyping, isPrimarySuperOwner }) => {
      if (!isPrimarySuperOwner) {
        return reply("❌ Informasi status server VPS hanya dapat diakses oleh SuperOwner.");
      }
      await sendTyping();

      const os = await import("os");
      const { exec } = await import("child_process");

      const cpus = os.cpus() || [];
      const cpuModel = cpus[0]?.model || "Unknown CPU";
      const cpuCores = cpus.length;

      const totalMem = (os.totalmem() / (1024 ** 3)).toFixed(2);
      const freeMem = (os.freemem() / (1024 ** 3)).toFixed(2);
      const usedMem = (totalMem - freeMem).toFixed(2);
      const memPercent = ((usedMem / totalMem) * 100).toFixed(1);

      const sysUptimeSec = Math.floor(os.uptime());
      const sysDays = Math.floor(sysUptimeSec / 86400);
      const sysHours = Math.floor((sysUptimeSec % 86400) / 3600);
      const sysMinutes = Math.floor((sysUptimeSec % 3600) / 60);

      const platform = os.platform();
      const release = os.release();
      const arch = os.arch();

      exec("df -h / | awk 'NR==2 {print $2,$3,$4,$5}'", (err, stdout) => {
        let diskText = "Tidak tersedia";
        if (!err && stdout.trim()) {
          const parts = stdout.trim().split(/\s+/);
          if (parts.length >= 4) {
            diskText = `${parts[1]} / ${parts[0]} (${parts[3]})`;
          }
        }

        const text =
          `🖥️ *Informasi Server VPS*\n\n` +
          `• OS: ${platform} ${arch} (${release})\n` +
          `• Uptime: ${sysDays}h ${sysHours}j ${sysMinutes}m\n` +
          `• CPU: ${cpuModel} (${cpuCores} Core)\n` +
          `• RAM: ${usedMem} GB / ${totalMem} GB (${memPercent}%)\n` +
          `• Disk (/): ${diskText}\n` +
          `• Node.js: ${process.version}`;

        reply(text);
      });
    },
};
