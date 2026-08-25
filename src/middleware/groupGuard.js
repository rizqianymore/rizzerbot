import { db } from "@/src/core/database.js";

export function registerGroupGuard(sock) {
  sock.ev.on("group-participants.update", async (anu) => {
    try {
      const groupConfig = db.getGroup(anu.id);
      if (!groupConfig || !groupConfig.guard) return;

      const botJid = sock.user?.id ? sock.user.id.replace(/:.*@/, "@") : "";

      if (anu.action === "demote") {
        for (const participant of anu.participants) {
          const normalizedParticipant = participant.replace(/:.*@/, "@");
          const isUserPrivileged = db.isPrivilegedJid(normalizedParticipant);

          if (isUserPrivileged) {
            await sock.groupParticipantsUpdate(
              anu.id,
              [participant],
              "promote"
            );

            if (anu.author && anu.author.replace(/:.*@/, "@") !== botJid) {
              await sock
                .groupParticipantsUpdate(anu.id, [anu.author], "demote")
                .catch(() => {});
            }

            await sock.sendMessage(anu.id, {
              text:
                `🛡️ *[GROUP GUARD ALERT]* 🛡️\n\n` +
                `Percobaan demote Admin/Owner oleh @${anu.author.split("@")[0]} telah digagalkan.\n` +
                `• Target: @${normalizedParticipant.split("@")[0]}\n` +
                `• Sanksi: Pelaku di-demote otomatis oleh sistem.`,
              mentions: [anu.author, participant],
            });
          }
        }
      }
    } catch (err) {
      console.error("[Group Guard Error]", err);
    }
  });
}
