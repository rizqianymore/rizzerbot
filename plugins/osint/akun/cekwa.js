import { db } from "@/src/core/database.js";

function fmtDate(ts) {
  const n = Number(ts);
  if (!Number.isFinite(n) || n <= 0) return "-";
  const ms = n < 1e12 ? n * 1000 : n;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function extractStatus(item) {
  if (!item || typeof item !== "object") return { bio: "", setAt: 0 };
  const s = item.status ?? item.statusText ?? item.about ?? "";
  if (typeof s === "object" && s !== null) {
    return {
      bio: String(s.status ?? s.text ?? ""),
      setAt: Number(s.setAt ?? s.set_at ?? s.t ?? 0) || 0,
    };
  }
  return { bio: String(s || ""), setAt: Number(item.setAt ?? item.set_at ?? item.t ?? 0) || 0 };
}

export default {
  name: "cekwa",
  aliases: ["checkwa", "lookupwa", "infowa", "wanumber"],
  description: "Lookup nomor WhatsApp: status terdaftar, bio, foto profil & info bisnis",
  usage: "<nomor, cth: 087812345678>",
  category: "OSINT",
  premiumOnly: true,
  run: async (sock, msg, args, { reply, sendTyping }) => {
    const raw = (args[0] || "").trim();
    if (!raw) return reply("Masukkan nomor!\nContoh: *.cekwa 087812345678*");

    const jid = db.normalizeJid(raw);
    if (!jid || !jid.endsWith("@s.whatsapp.net")) {
      return reply("Nomor tidak valid. Contoh: *.cekwa 087812345678*");
    }
    const number = jid.split("@")[0];

    await sendTyping();
    await reply(`Melacak nomor *+${number}*...`);

    // 1. Cek terdaftar di WhatsApp
    let exists = false;
    let returnedJid = "";
    try {
      const res = await sock.onWhatsApp(jid);
      const hit = Array.isArray(res) ? res[0] : null;
      exists = Boolean(hit?.exists);
      returnedJid = hit?.jid || "";
    } catch {
      exists = false;
    }

    // 2-4. Bio + foto + bisnis (paralel, masing-masing boleh gagal)
    const [statusRes, photoRes, bizRes] = await Promise.all([
      (async () => {
        try {
          const r = await sock.fetchStatus(jid);
          return extractStatus(Array.isArray(r) ? r[0] : null);
        } catch {
          return { bio: "", setAt: 0 };
        }
      })(),
      (async () => {
        try {
          return (await sock.profilePictureUrl(jid, "image")) || "";
        } catch {
          return "";
        }
      })(),
      (async () => {
        try {
          return (await sock.getBusinessProfile(jid)) || null;
        } catch {
          return null;
        }
      })(),
    ]);

    const lines = [`*WHATSAPP LOOKUP*`, `Nomor: +${number}`, `Terdaftar: ${exists ? "Ya" : "Tidak"}`];
    if (returnedJid && returnedJid !== jid) lines.push(`JID: \`${returnedJid}\``);
    lines.push(`Bio: ${statusRes.bio ? `\n> ${statusRes.bio}` : "-"}`);
    if (statusRes.bio) lines.push(`Bio diperbarui: ${fmtDate(statusRes.setAt)}`);
    lines.push(`Foto profil: ${photoRes ? "Ada" : "Privat/tidak ada"}`);
    if (bizRes) {
      const b = bizRes;
      lines.push(`Bisnis: Ya`);
      if (b.name || b.businessName) lines.push(`Nama bisnis: ${b.name || b.businessName}`);
      if (b.description) lines.push(`Deskripsi: ${String(b.description).slice(0, 300)}`);
      if (b.email) lines.push(`Email: ${b.email}`);
      if (b.website?.length) lines.push(`Website: ${b.website.join(", ")}`);
      if (b.address) lines.push(`Alamat: ${b.address}`);
    } else {
      lines.push(`Bisnis: Bukan akun bisnis`);
    }
    lines.push(``);
    lines.push(`_Nama kontak tidak bisa dilacak (hanya terlihat jika pernah chat)._`);

    const caption = lines.join("\n");
    try {
      if (photoRes) {
        await sock.sendMessage(msg.key.remoteJid, { image: { url: photoRes }, caption }, { quoted: msg });
        return;
      }
    } catch (_) {}
    await reply(caption);
  },
};
