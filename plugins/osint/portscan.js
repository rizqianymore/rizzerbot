import net from "net";

const COMMON_PORTS = [
  { port: 21, service: "FTP" },
  { port: 22, service: "SSH" },
  { port: 80, service: "HTTP" },
  { port: 443, service: "HTTPS" },
  { port: 3306, service: "MySQL" },
  { port: 5432, service: "PostgreSQL" },
  { port: 6379, service: "Redis" },
  { port: 8080, service: "HTTP-Proxy" },
  { port: 8443, service: "HTTPS-Alt" },
];

function checkPort(host, port, timeout = 2000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let handled = false;

    const finish = (result) => {
      if (handled) return;
      handled = true;
      try { socket.destroy(); } catch (_) {}
      resolve(result);
    };

    socket.setTimeout(timeout);
    socket.on("connect", () => finish(true));
    socket.on("timeout", () => finish(false));
    socket.on("error", () => finish(false));
    socket.on("close", () => finish(false));

    try {
      socket.connect(port, host);
    } catch (_) {
      finish(false);
    }
  });
}

export default {
  name: "portscan",
  description: "Memindai port jaringan terbuka (open ports) pada suatu IP/Host target.",
  usage: "<ip/domain>",
  example: "portscan 1.1.1.1",
  aliases: ["checkports", "scanport"],
  category: "OSINT",
  premiumOnly: false,
  ownerOnly: true,
  run: async (sock, msg, args, context) => {
    const { sendTyping, activePrefix, senderName } = context;
    await sendTyping();

    let target = args[0];
    if (!target) {
      return sock.sendMessage(
        msg.key.remoteJid,
        {
          text: `❌ *Format salah!*\n\nGunakan: \`${activePrefix}portscan <ip/domain>\`\nContoh: \`${activePrefix}portscan 1.1.1.1\``,
        },
        { quoted: msg }
      );
    }

    target = target.replace(/^(https?:\/\/)?(www\.)?/, "").split("/")[0];

    try {
      const results = await Promise.all(
        COMMON_PORTS.map(async (item) => {
          const isOpen = await checkPort(target, item.port);
          return { ...item, isOpen };
        })
      );

      const openPorts = results.filter((r) => r.isOpen);

      let replyText =
        `📡 *Port Scanner OSINT*\n\n` +
        `• *Target Host:* \`${target}\`\n` +
        `• *Total Port Dipindai:* ${COMMON_PORTS.length}\n` +
        `• *Port Terbuka:* ${openPorts.length}\n\n` +
        `📌 *Hasil Pemindaian:* \n` +
        results
          .map((r) => `  • Port ${r.port} (${r.service}): ${r.isOpen ? "🟢 *Open*" : "🔴 CLOSED"}`)
          .join("\n") +
        `\n\n_Dicari oleh: ${senderName}_\n\n⚡ _Via Kyros-MD OSINT_`;

      await sock.sendMessage(
        msg.key.remoteJid,
        { text: replyText },
        { quoted: msg }
      );
    } catch (err) {
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: `❌ *Gagal memindai port:* ${err.message || err}` },
        { quoted: msg }
      );
    }
  },
};
