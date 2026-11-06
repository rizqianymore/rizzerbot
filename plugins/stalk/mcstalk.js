import { lookupMinecraft } from "@/src/services/osint/minecraftstalk.js";

export default {
  name: "mcstalk",
  aliases: ["minecraft", "stalkmc", "minecraftstalk", "mcuser"],
  description: "Intelijen OSINT pemain Minecraft (UUID, avatar render, skin texture, NameMC profile)",
  usage: "<username minecraft>",
  category: "Stalk",
  cooldownMs: 3000,
  run: async (sock, msg, args, context) => {
    const input = args[0]?.trim();
    if (!input) {
      return context.reply(
        `*OSINT MINECRAFT PLAYER STALKER*\n\n` +
        `Gunakan format:\n` +
        `${context.prefix || "."}mcstalk <username-minecraft>\n\n` +
        `*Contoh:*\n` +
        `• ${context.prefix || "."}mcstalk Notch\n` +
        `• ${context.prefix || "."}mcstalk Dream`
      );
    }

    await context.sendTyping();

    const res = await lookupMinecraft(input);
    if (!res.valid) {
      return context.reply(`Format salah / error: ${res.reason}`);
    }

    if (!res.exists) {
      return context.reply(res.message);
    }

    const caption = [
      `*HASIL INTELIJEN MINECRAFT PLAYER*`,
      `Username   : *${res.username}*`,
      `Player UUID: \`${res.uuid}\``,
      res.skinUrl ? `Skin File  : 🔗 ${res.skinUrl}` : "",
      ``,
      `*Profil Riwayat NameMC:*`,
      `👉 ${res.namemcUrl}`
    ].filter(Boolean).join("\n");

    if (res.avatarUrl && /^https?:\/\//i.test(res.avatarUrl)) {
      try {
        return await sock.sendMessage(
          context.remoteJid,
          {
            image: { url: res.avatarUrl },
            caption,
          },
          { quoted: msg }
        );
      } catch (_) {}
    }

    return context.reply(caption);
  },
};
