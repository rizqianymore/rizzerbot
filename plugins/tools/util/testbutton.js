export function buildTestButtons(prefix = ".") {
  return [
    {
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({ display_text: "Cek Buron", id: `${prefix}buronlist` }),
    },
    {
      name: "cta_url",
      buttonParamsJson: JSON.stringify({ display_text: "Website", url: "https://example.com" }),
    },
    {
      name: "cta_copy",
      buttonParamsJson: JSON.stringify({ display_text: "Copy ID", copy_code: "BTN-2024" }),
    },
    {
      name: "single_select",
      buttonParamsJson: JSON.stringify({
        title: "Lihat Menu",
        sections: [
          {
            title: "Demo",
            rows: [
              { title: "Opsi 1", description: "Deskripsi 1", id: `${prefix}testbutton 1` },
              { title: "Opsi 2", description: "Deskripsi 2", id: `${prefix}testbutton 2` },
            ],
          },
        ],
      }),
    },
  ];
}

export function buildTestButtonContent(prefix = ".") {
  return {
    interactiveMessage: {
      title: "TEST BUTTON OURIN",
      footer: "RizzerBot • ourin-baileys",
      header: "Demo button",
      buttons: buildTestButtons(prefix),
    },
  };
}

export function buildTestButtonText() {
  return "*TEST BUTTON*\n\n• Cek Buron\n• Website: https://example.com\n• Copy: BTN-2024\n\n(Buton tak didukung di sock ini — fallback teks)";
}

export async function sendTestButton(sock, jid, quoted, prefix = ".") {
  try {
    return await sock.sendMessage(jid, buildTestButtonContent(prefix), { quoted });
  } catch (_) {
    return sock.sendMessage(jid, { text: buildTestButtonText() }, { quoted });
  }
}

export default {
  name: "testbutton",
  aliases: ["btntest", "buttontest"],
  description: "Demo logic button ourin (quick_reply, cta_url, cta_copy, single_select).",
  usage: "",
  category: "Tools",
  run: async (sock, msg, args, context) => {
    await context.sendTyping();
    await sendTestButton(sock, msg.key.remoteJid, msg, context.prefix || ".");
  },
};
