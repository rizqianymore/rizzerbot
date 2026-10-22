import { db } from "@/src/core/database.js";
import {
  dailyLimit,
  getConsent,
  listAudit,
  listConsent,
  maskNis,
  quotaStatus,
  removeConsent,
  setConsent,
} from "@/src/services/telkom/registry.js";
import { credentialSource } from "@/src/services/telkom/vault.js";
import { normalizeNis } from "@/src/services/telkom/auth.js";

/**
 * Manajemen whitelist + consent Telkom Schools (khusus owner/admin).
 * Password siswa TIDAK disimpan di sini — hanya di vault (env/secret manager).
 */

function usage() {
  return (
    `*KONSENT TELKOM SCHOOLS*\n\n` +
    `• \`add <nis> [nomor_wa] [catatan]\` — daftarkan NIS + consent\n` +
    `• \`remove <nis>\` — cabut NIS dari whitelist\n` +
    `• \`unbind <nis>\` — lepas binding NIS ke akun WA (siswa ganti nomor)\n` +
    `• \`auto <nis> on|off\` — izinkan/tolak submit otomatis\n` +
    `• \`status <nis>\` — cek consent, kuota, dan keberadaan kredensial di vault\n` +
    `• \`list\` — daftar NIS terdaftar\n` +
    `• \`audit\` — audit log terakhir (tanpa data sensitif)\n\n` +
    `_Password siswa disimpan di vault (env/secret manager), bukan di database bot._`
  );
}

export default {
  name: "telkomconsent",
  aliases: ["telkomwhitelist", "telkomwl"],
  description: "Kelola whitelist + consent NIS Telkom Schools",
  usage: "add|remove|auto|status|list|audit",
  ownerOnly: true,
  category: "Owner",
  run: async (sock, msg, args, { reply, senderJid, logger }) => {
    const sub = String(args[0] || "").toLowerCase();
    const nis = normalizeNis(args[1]);

    if (!sub || sub === "help" || sub === "menu") return reply(usage());

    if (sub === "list") {
      const entries = listConsent();
      if (entries.length === 0) return reply("Belum ada NIS terdaftar di whitelist consent.");
      const lines = entries.map((entry) => {
        const flags = [
          entry.consent ? "consent" : "tanpa consent",
          entry.autoSubmit ? "auto-submit" : "manual",
          entry.jid ? "terikat" : "tanpa binding",
        ].join(", ");
        return `• \`${entry.nis}\` — ${flags}${entry.note ? `\n  catatan: ${entry.note}` : ""}`;
      });
      return reply(`*WHITELIST CONSENT (${entries.length})*\n\n${lines.join("\n")}`);
    }

    if (sub === "audit") {
      const entries = listAudit(15);
      if (entries.length === 0) return reply("Audit log kosong.");
      const lines = entries.map((entry) => `• \`${entry.at}\` ${entry.event} ${JSON.stringify(entry)}`);
      return reply(`*AUDIT TERAKHIR*\n\n${lines.join("\n")}`);
    }

    if (!nis) return reply("NIS tidak valid. Contoh: `add 539241249`");

    if (sub === "add") {
      const jidArg = String(args[2] || "").trim();
      const normalizedJid = jidArg ? db.normalizeJid(jidArg) : "";
      const resolvedJid = normalizedJid ? db.resolvePhoneJid(normalizedJid) : "";
      const jid = resolvedJid || normalizedJid;
      if (jidArg && !jid) return reply("Nomor WhatsApp tidak valid untuk binding akun siswa.");
      const note = String(args.slice(3).join(" ") || "").trim();
      const entry = setConsent(nis, { consent: true, actor: senderJid || "", note, jid, autoSubmit: true });
      logger?.info?.(`[OwnerCmd] telkomconsent add ${maskNis(nis)} oleh ${senderJid}`);
      return reply(
        `✅ NIS \`${entry.nis}\` terdaftar & consent diberikan.\n` +
          `• Binding akun: ${entry.jid ? entry.jid.split("@")[0] : "tidak ada (bisa dipakai NIS mana pun)"}\n` +
          `• Submit otomatis: ${entry.autoSubmit ? "aktif" : "nonaktif"}\n` +
          `• Kuota: ${dailyLimit()}x/hari\n\n` +
          `_Ingatkan siswa untuk storing password sendiri di vault (tidak lewat chat)._`
      );
    }

    if (sub === "remove") {
      const removed = removeConsent(nis);
      logger?.info?.(`[OwnerCmd] telkomconsent remove ${maskNis(nis)} oleh ${senderJid}`);
      return removed
        ? `✅ NIS \`${nis}\` dicabut dari whitelist consent.`
        : `⚠️ NIS \`${nis}\` tidak ada di whitelist.`;
    }

    if (sub === "unbind") {
      // Lepas binding NIS <-> akun WhatsApp (siswa ganti nomor / device).
      const entry = getConsent(nis);
      if (!entry) return reply(`⚠️ NIS \`${nis}\` belum terdaftar di whitelist.`);
      if (!entry.jid) return reply(`ℹ️ NIS \`${nis}\` memang tidak terikat ke akun mana pun.`);
      const oldJid = entry.jid;
      setConsent(nis, {
        consent: entry.consent,
        actor: senderJid,
        jid: "",
        autoSubmit: entry.autoSubmit,
        note: entry.note,
      });
      logger?.info?.(`[OwnerCmd] telkomconsent unbind ${maskNis(nis)} oleh ${senderJid}`);
      return reply(
        `✅ Binding NIS \`${nis}\` dilepas (dari ${oldJid.split("@")[0]}).\n` +
          `Siswa bisa pakai lagi dari akun WhatsApp-nya yang sekarang.`
      );
    }

    if (sub === "auto") {
      const mode = String(args[2] || "").toLowerCase();
      if (!["on", "off"].includes(mode)) return reply("Format: `auto <nis> on|off`");
      const existing = getConsent(nis);
      if (!existing) return reply(`⚠️ NIS \`${nis}\` belum terdaftar. Tambah dulu dengan \`add\`.`);
      const entry = setConsent(nis, {
        consent: existing.consent,
        actor: senderJid || "",
        autoSubmit: mode === "on",
        jid: existing.jid,
        note: existing.note,
      });
      return reply(
        `✅ Submit otomatis untuk NIS \`${entry.nis}\` sekarang ${entry.autoSubmit ? "AKTIF" : "NONAKTIF"}.`
      );
    }

    if (sub === "status") {
      const entry = getConsent(nis);
      if (!entry) return reply(`⚠️ NIS \`${nis}\` tidak terdaftar di whitelist.`);
      const quota = quotaStatus(nis);
      const source = credentialSource(nis);
      const lines = [
        `*STATUS NIS \`${entry.nis}\`*`,
        `• Consent: ${entry.consent ? "✅ diberikan" : "❌ belum"}`,
        `• Binding akun: ${entry.jid ? entry.jid.split("@")[0] : "tidak ada"}`,
        `• Submit otomatis: ${entry.autoSubmit ? "aktif" : "nonaktif"}`,
        `• Kuota hari ini: ${quota.count}/${quota.limit}`,
        `• Kredensial di vault: ${source ? "✅ tersedia (" + source + ")" : "❌ belum ada"}`,
      ];
      if (entry.note) lines.push(`• Catatan: ${entry.note}`);
      return reply(lines.join("\n"));
    }

    return reply(usage());
  },
};
