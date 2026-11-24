import os from "os";

async function runNetworkSpeedTest() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {

    const t0 = Date.now();
    await fetch("https://1.1.1.1/cdn-cgi/trace", {
      signal: controller.signal,
      headers: { "User-Agent": "RizzerBot-SpeedTest/1.0" },
    });
    const pingMs = Date.now() - t0;

    const downloadBytes = 5 * 1024 * 1024;
    const dStart = Date.now();
    const downRes = await fetch(`https://speed.cloudflare.com/__down?bytes=${downloadBytes}`, {
      signal: controller.signal,
      headers: { "User-Agent": "RizzerBot-SpeedTest/1.0" },
    });
    const downBuf = await downRes.arrayBuffer();
    const dDurationSec = Math.max(0.1, (Date.now() - dStart) / 1000);
    const downloadMbps = ((downBuf.byteLength * 8) / (dDurationSec * 1024 * 1024)).toFixed(2);

    const uploadBytes = 2 * 1024 * 1024;
    const uploadPayload = new Uint8Array(uploadBytes);
    const uStart = Date.now();
    await fetch("https://speed.cloudflare.com/__up", {
      method: "POST",
      body: uploadPayload,
      signal: controller.signal,
      headers: { "User-Agent": "RizzerBot-SpeedTest/1.0" },
    });
    const uDurationSec = Math.max(0.1, (Date.now() - uStart) / 1000);
    const uploadMbps = ((uploadBytes * 8) / (uDurationSec * 1024 * 1024)).toFixed(2);

    return {
      ok: true,
      ping: pingMs,
      download: downloadMbps,
      upload: uploadMbps,
    };
  } catch (err) {
    return {
      ok: false,
      error: err?.message || "Speedtest timeout",
    };
  } finally {
    clearTimeout(timeout);
  }
}

function formatUptime(uptimeSeconds) {
  const d = Math.floor(uptimeSeconds / (3600 * 24));
  const h = Math.floor((uptimeSeconds % (3600 * 24)) / 3600);
  const m = Math.floor((uptimeSeconds % 3600) / 60);
  const s = Math.floor(uptimeSeconds % 60);
  const parts = [];
  if (d > 0) parts.push(`${d}h`);
  if (h > 0) parts.push(`${h}j`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}d`);
  return parts.join(" ");
}

export default {
  name: "speedtest",
  aliases: ["ujikecepatan", "netspeed", "botkecepatan"],
  description: "Mengukur kecepatan koneksi internet server bot (Ping, Download, Upload)",
  usage: "",
  category: "Info",
  cooldownMs: 10000,
  run: async (sock, msg, _args, { reply, sendTyping }) => {
    await sendTyping();
    await reply(
      `🚀 *Menguji Kecepatan Internet Server...*\n_Mohon tunggu sebentar (Ping, Download, Upload sedang diukur)..._`
    );

    const result = await runNetworkSpeedTest();

    const memTotal = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
    const memFree = (os.freemem() / 1024 / 1024 / 1024).toFixed(2);
    const memUsed = (memTotal - memFree).toFixed(2);
    const uptimeStr = formatUptime(process.uptime());

    if (!result.ok) {
      return reply(`❌ *Speedtest Gagal:* ${result.error}`);
    }

    const responseText =
      `⚡ *HASIL SPEEDTEST SERVER BOT*\n\n` +
      `🌐 *Koneksi Internet:*\n` +
      `│ • Latency / Ping: *${result.ping} ms*\n` +
      `│ • Download: *${result.download} Mbps*\n` +
      `│ • Upload: *${result.upload} Mbps*\n` +
      `│ • Server Test: *Cloudflare Edge CDN*\n\n` +
      `🖥️ *Informasi Server:*\n` +
      `│ • OS: *${os.type()} ${os.arch()}*\n` +
      `│ • RAM: *${memUsed} GB / ${memTotal} GB*\n` +
      `│ • Bot Uptime: *${uptimeStr}*\n` +
      `└─ *Status:* Optimal 🟢`;

    return reply(responseText);
  },
};
