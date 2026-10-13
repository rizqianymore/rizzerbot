import { isButtonTap } from "@/src/utils/buttons.js";

export const BURON_DUMMY = [
  { nama: "Andi", kasus: "Penipuan", status: "DPO" },
  { nama: "Budi", kasus: "Penggelapan", status: "Buronan" },
  { nama: "Citra", kasus: "Narkoba", status: "DPO" },
];

export function buildBuronItems(buron) {
  return buron.map((b, i) => [`${i + 1}. ${b.nama}`, `${b.kasus} — ${b.status}`]);
}

export function buildBuronText(buron) {
  if (!buron.length) return "🚨 *DAFTAR BURON*\n\nBelum ada data buron.";
  return (
    `🚨 *DAFTAR BURON* (${buron.length})\n\n` +
    buron.map((b, i) => `${i + 1}. *${b.nama}* — ${b.kasus} [${b.status}]`).join("\n")
  );
}

export function buildBuronButtons(prefix = ".") {
  return [
    {
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({ display_text: "Cek Detail", id: `${prefix}buron detail` }),
    },
    {
      name: "cta_url",
      buttonParamsJson: JSON.stringify({ display_text: "Lapor", url: "https://example.com/lapor" }),
    },
    {
      name: "cta_copy",
      buttonParamsJson: JSON.stringify({ display_text: "Copy ID", copy_code: "BURON2024" }),
    },
  ];
}

export function buildBuronInteractive(buron, prefix = ".") {
  return {
    interactiveMessage: {
      title: "🚨 Daftar Buron Aktif",
      footer: `Total: ${buron.length} • RizzerBot`,
      header: "Pilih aksi",
      buttons: [
        ...buildBuronButtons(prefix),
        {
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "Lihat Buron",
            sections: [
              {
                title: "Buron",
                rows: buron.map((b) => ({ title: b.nama, description: `${b.kasus} [${b.status}]`, id: `${prefix}buron ${b.nama}` })),
              },
            ],
          }),
        },
      ],
    },
  };
}

export function buildBuronResultContent(buron, full, prefix = ".") {
  const rows = (full.length ? full : buron).map((b) => ({
    title: b.nama,
    description: `${b.kasus} [${b.status}]`,
    id: `${prefix}buron ${b.nama}`,
  }));
  const body =
    `🚨 *DAFTAR BURON* (${buron.length})\n\n` +
    buron.map((b, i) => `${i + 1}. *${b.nama}* — ${b.kasus} [${b.status}]`).join("\n");
  return {
    interactiveMessage: {
      title: "🚨 Daftar Buron Aktif",
      footer: `Total: ${buron.length} • RizzerBot`,
      header: body,
      buttons: [
        {
          name: "quick_reply",
          buttonParamsJson: JSON.stringify({ display_text: "Semua Buron", id: `${prefix}buronlist` }),
        },
        {
          name: "single_select",
          buttonParamsJson: JSON.stringify({ title: "Lihat Buron", sections: [{ title: "Buron", rows }] }),
        },
      ],
    },
  };
}

export async function sendBuronList(sock, jid, buron, quoted, prefix = ".") {
  // 1. ourin rich list (prioritas)
  if (typeof sock.sendList === "function") {
    return sock.sendList(jid, "DAFTAR BURON", buildBuronItems(buron), quoted, {
      headerText: "🚨 List Buron Aktif",
      footer: `Total: ${buron.length}`,
    });
  }
  // 2. interactive buttons
  try {
    const content = buildBuronInteractive(buron, prefix);
    if (typeof sock.sendMessage === "function") {
      return await sock.sendMessage(jid, content, { quoted });
    }
  } catch (_) {}
  // 3. fallback teks (100% jalan di baileys lama)
  return sock.sendMessage(jid, { text: buildBuronText(buron) }, { quoted });
}

export default {
  name: "buronlist",
  aliases: ["listburon", "buron", "dpo"],
  description: "Menampilkan daftar buron via ourin list + button (fallback teks).",
  usage: "[nama]",
  category: "Tools",
  run: async (sock, msg, args, context) => {
    await context.sendTyping();
    const prefix = context.prefix || ".";
    const tap = isButtonTap(msg);
    const q = args.join(" ").trim().toLowerCase();
    const data = q ? BURON_DUMMY.filter((b) => b.nama.toLowerCase().includes(q)) : BURON_DUMMY;
    if (q && data.length === 0) return context.reply(`Buron *${q}* tidak ditemukan.`);
    const jid = msg.key.remoteJid;
    if (tap) {
      // 1 tap = 1 pesan: hasil + buton fresh dalam SATU pesan (ga dobel).
      // Buton pesan lama mati (aturan WA), pesan baru ini yang bisa diklik lagi.
      try {
        return await sock.sendMessage(jid, buildBuronResultContent(data, BURON_DUMMY, prefix), { quoted: msg });
      } catch (_) {
        return sock.sendMessage(jid, { text: buildBuronText(data) }, { quoted: msg });
      }
    }
    await sendBuronList(sock, jid, data, msg, prefix);
  },
};
