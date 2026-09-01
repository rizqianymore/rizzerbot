// Database Prefix Indonesia (Sesuaikan/Expand sesuai kebutuhan)
const PREFIX_DB = {
  // Telkomsel
  811: { carrier: "Telkomsel", type: "Postpaid", city: "Jakarta/General" },
  812: { carrier: "Telkomsel", type: "Prepaid", city: "Jakarta/General" },
  813: { carrier: "Telkomsel", type: "Prepaid", city: "Jawa/Sumatera" },
  821: { carrier: "Telkomsel", type: "Prepaid", city: "Jawa/Bali" },
  822: { carrier: "Telkomsel", type: "Prepaid", city: "Kalimantan/Sulawesi" },
  823: {
    carrier: "Telkomsel",
    type: "Prepaid",
    city: "Jawa Timur/Nusa Tenggara",
  },
  851: { carrier: "Telkomsel", type: "Prepaid", city: "General" },
  852: { carrier: "Telkomsel", type: "Prepaid", city: "Jawa/Sumatera" },
  853: { carrier: "Telkomsel", type: "Prepaid", city: "Jawa Tengah/DIY" },

  // Indosat
  814: { carrier: "Indosat Ooredoo", type: "Postpaid", city: "General" },
  815: { carrier: "Indosat Ooredoo", type: "Prepaid", city: "Jakarta/Jawa" },
  816: { carrier: "Indosat Ooredoo", type: "Prepaid", city: "Jawa/Sumatera" },
  855: { carrier: "Indosat Ooredoo", type: "Prepaid", city: "Jawa/Sumatera" },
  856: { carrier: "Indosat Ooredoo", type: "Prepaid", city: "Jawa/Sumatera" },
  857: { carrier: "Indosat Ooredoo", type: "Prepaid", city: "Jawa/Sumatera" },
  858: { carrier: "Indosat Ooredoo", type: "Prepaid", city: "Jawa/Sumatera" },

  // XL Axiata
  817: { carrier: "XL Axiata", type: "Prepaid", city: "Jakarta/Jawa" },
  818: { carrier: "XL Axiata", type: "Prepaid", city: "Jawa/Sumatera" },
  819: { carrier: "XL Axiata", type: "Prepaid", city: "Luar Jawa" },
  859: { carrier: "XL Axiata", type: "Prepaid", city: "Jawa/Sumatera" },
  877: { carrier: "XL Axiata", type: "Prepaid", city: "Jawa/Sumatera" },
  878: { carrier: "XL Axiata", type: "Prepaid", city: "Jawa/Sumatera" },

  // Smartfren
  881: { carrier: "Smartfren", type: "Prepaid", city: "General" },
  882: { carrier: "Smartfren", type: "Prepaid", city: "General" },
  883: { carrier: "Smartfren", type: "Prepaid", city: "General" },
  884: { carrier: "Smartfren", type: "Prepaid", city: "General" },
  885: { carrier: "Smartfren", type: "Prepaid", city: "General" },
  886: { carrier: "Smartfren", type: "Prepaid", city: "General" },
  887: { carrier: "Smartfren", type: "Prepaid", city: "General" },
  888: { carrier: "Smartfren", type: "Prepaid", city: "General" },
  889: { carrier: "Smartfren", type: "Prepaid", city: "General" },

  // Axis
  831: { carrier: "Axis (XL Axiata)", type: "Prepaid", city: "General" },
  832: { carrier: "Axis (XL Axiata)", type: "Prepaid", city: "General" },
  833: { carrier: "Axis (XL Axiata)", type: "Prepaid", city: "General" },
  838: { carrier: "Axis (XL Axiata)", type: "Prepaid", city: "General" },

  // Three (3)
  895: { carrier: "Three (3)", type: "Prepaid", city: "General" },
  896: { carrier: "Three (3)", type: "Prepaid", city: "General" },
  897: { carrier: "Three (3)", type: "Prepaid", city: "General" },
  898: { carrier: "Three (3)", type: "Prepaid", city: "General" },
  899: { carrier: "Three (3)", type: "Prepaid", city: "General" },
};

function getNumberInfo(number) {
  const clean = number.replace(/^62/, "").replace(/^0/, "");
  const prefix3 = clean.substring(0, 3);
  const prefix4 = clean.substring(0, 4);

  // Cek prefix 4 digit dulu (lebih spesifik), fallback ke 3 digit
  return (
    PREFIX_DB[prefix4] ||
    PREFIX_DB[prefix3] || {
      carrier: "Unknown",
      type: "Unknown",
      city: "Unknown",
    }
  );
}

export default {
  premiumOnly: true,
  description: "Memeriksa detail informasi kepemilikan nomor WhatsApp.",
  usage: "<nomor>",
  example: "628xxx",
  name: "numberlookup",
  aliases: ["lookup", "checknum", "ceknomor", "ceknum"],
  category: "OSINT",
  ownerOnly: false,
  run: async (sock, msg, args, context) => {
    const { sendTyping, getTargetJid, senderJid } = context;
    await sendTyping();

    let targetJid = getTargetJid(args);
    if (!targetJid) {
      let target = args[0];
      if (!target) {
        targetJid = senderJid;
      } else {
        let cleanNum = target.replace(/[^0-9]/g, "");
        if (cleanNum.startsWith("0")) {
          cleanNum = "62" + cleanNum.slice(1);
        }
        targetJid = cleanNum + "@s.whatsapp.net";
      }
    }

    let cleanNum = targetJid.split("@")[0];

    try {
      // --- LOGIC CARRIER/CITY/LINE TYPE ---
      const numInfo = getNumberInfo(cleanNum);

      let resolvedJid = targetJid;
      let exists = false;

      if (targetJid === senderJid || targetJid === msg.key.remoteJid) {
        exists = true;
      } else {
        const onWa = await sock.onWhatsApp(targetJid);
        if (onWa && onWa.length > 0 && onWa[0].exists) {
          exists = true;
          resolvedJid = onWa[0].jid;
        }
      }

      if (!exists) {
        await sock.sendMessage(
          msg.key.remoteJid,
          {
            text: `❌ Nomor *+${cleanNum}* tidak terdaftar di WhatsApp.`,
          },
          { quoted: msg },
        );
        return;
      }

      let bio = "-";
      let bioTime = "-";
      try {
        const statusInfo = await sock.fetchStatus(resolvedJid);
        if (statusInfo) {
          bio = statusInfo.status || "-";
          if (statusInfo.setAt) {
            bioTime = new Date(statusInfo.setAt).toLocaleDateString("id-ID", {
              year: "numeric",
              month: "long",
              day: "numeric",
            });
          }
        }
      } catch (_) {
        bio = "(Privasi / Tidak diatur)";
      }

      let isBusiness = false;
      let bizInfo = "";
      try {
        const bizProfile = await sock.getBusinessProfile(resolvedJid);
        if (bizProfile) {
          isBusiness = true;
          bizInfo =
            `\n💼 *Profil Bisnis:*\n` +
            `  • *Kategori:* ${bizProfile.category || "-"}\n` +
            `  • *Deskripsi:* ${bizProfile.description || "-"}\n` +
            `  • *Alamat:* ${bizProfile.address || "-"}\n` +
            `  • *Email:* ${bizProfile.email || "-"}\n` +
            `  • *Web:* ${bizProfile.website?.join(", ") || "-"}`;
        }
      } catch (_) {}

      let pfpUrl = null;
      try {
        pfpUrl = await sock.profilePictureUrl(resolvedJid, "image");
      } catch (_) {
        try {
          pfpUrl = await sock.profilePictureUrl(resolvedJid, "preview");
        } catch (_) {}
      }

      // --- OUTPUT DENGAN INFO CARRIER ---
      let infoText =
        `📞 *Informasi Nomor WhatsApp*\n\n` +
        `• *Nomor:* +${cleanNum}\n` +
        `• *Operator:* ${numInfo.carrier}\n` +
        `• *Tipe Line:* ${numInfo.type}\n` +
        `• *Estimasi Area:* ${numInfo.city}\n` +
        `• *Jid:* \`${resolvedJid}\`\n` +
        `• *Tipe Akun:* ${isBusiness ? "Akun Bisnis" : "Akun Personal"}\n` +
        `• *Bio/Status:* ${bio}\n` +
        `• *Diperbarui:* ${bioTime}\n` +
        `• *Foto Profil:* ${pfpUrl ? "Tersedia" : "Tidak Tersedia / Privat"}` +
        `${bizInfo}\n\n⚡ _Via Kyros-MD API_`;

      if (pfpUrl) {
        await sock.sendMessage(
          msg.key.remoteJid,
          {
            image: { url: pfpUrl },
            caption: infoText,
          },
          { quoted: msg },
        );
      } else {
        await sock.sendMessage(
          msg.key.remoteJid,
          {
            text: infoText,
          },
          { quoted: msg },
        );
      }
    } catch (err) {
      console.error("Number Lookup Error:", err);
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: `❌ Gagal memproses pencarian nomor: ${err.message}`,
        },
        { quoted: msg },
      );
    }
  },
};
