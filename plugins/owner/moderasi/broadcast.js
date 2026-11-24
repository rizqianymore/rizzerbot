import { notifyOwnerSafe, resolveOwnerJid } from "@/src/utils/send-safe.js";

export default {
  name: "broadcast",
  aliases: ["bc"],
  description: "Kirim pesan broadcast ke semua grup bot",
  usage: "<pesan>",
  ownerOnly: true,
  category: "Owner",
  run: async (sock, msg, args, { reply, logger }) => {
    const message = args.join(" ").trim();
    if (!message) {
      return reply("Masukkan pesan broadcast!\nContoh: `.bc Selamat malam semua`");
    }
    await reply(`⏳ Broadcast ke semua grup...`);
    const log = logger || console;
    let groups;
    try {
      groups = await sock.groupFetchAllParticipating();
    } catch (err) {
      const detail = `Gagal mengambil daftar grup: ${err?.message || err}`;
      log.warn?.(`[Broadcast] ${detail}`);
      await reply(`[FAIL] Broadcast dibatalkan — ${detail}`);
      await notifyOwnerSafe(`[Broadcast] Gagal: ${detail}`, log, "broadcast");
      return;
    }

    const ids = Object.keys(groups || {});
    if (!ids.length) {
      await reply("[FAIL] Broadcast dibatalkan — tidak ada grup yang ditemukan (bot belum join grup mana pun).");
      return;
    }

    let sent = 0;
    const failures = [];
    for (const id of ids) {
      try {
        await sock.sendMessage(id, { text: ` *Broadcast*\n\n${message}` });
        sent++;
      } catch (err) {
        const detail = `${id}: ${err?.message || err}`;
        failures.push(detail);
        log.warn?.(`[Broadcast] Gagal kirim ke ${detail}`);
      }
      await new Promise((r) => setTimeout(r, 800));
    }

    const summary =
      `Broadcast terkirim ke ${sent}/${ids.length} grup.` +
      (failures.length ? `\n\n⚠️ Gagal (${failures.length}):\n${failures.join("\n")}` : "");
    await reply(summary);

    if (failures.length) {
      await notifyOwnerSafe(
        `[Broadcast] ${failures.length}/${ids.length} grup gagal:\n${failures.join("\n")}`,
        log,
        "broadcast"
      );
    }
  },
};
