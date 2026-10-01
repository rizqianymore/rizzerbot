// plugins/socialmedia/igdl.js — mandiri: 1 file = 1 perintah (helper digabung langsung).

function clean(s) {
  return String(s || "").trim();
}

function cleanText(text = "") {
  return String(text || "")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export default {
  "name": "igdl",
  "aliases": ["ig", "instagram", "instagramdl", "ig3", "igdl3", "instagram3"],
  "description": "Download video/foto Instagram",
  "usage": "<url>",
  "category": "Social Media",
  "run": async (sock, msg, args, { reply, sendTyping, prefix, logger }) => {
      const remoteJid = msg.key.remoteJid;
      const currentPrefix = prefix || ".";
      const react = (emoji) =>
        sock.sendMessage(remoteJid, { react: { text: emoji, key: msg.key } }).catch(() => {});

      const input = clean(args.join(" ") || args?.[0]);

      if (!input) {
        return reply(`Contoh:\n${currentPrefix}igdl https://instagram.com/...`);
      }

      await react("✨");
      await sendTyping();

      try {
        const resApi = await fetch(
          `https://api.nexray.eu.cc/downloader/v2/instagram?url=${encodeURIComponent(input)}`
        );

        if (!resApi.ok) throw new Error("API error");

        const data = await resApi.json();

        if (!data.status || !data.result?.media?.length) {
          throw new Error("Media tidak ditemukan");
        }

        const res = data.result;

        const caption = [
          "— instagram downloader —",
          "",
          `❀ author : ${cleanText(res.username)}`,
          `❀ likes  : ${res.likes?.toLocaleString() || 0}`,
          "",
          "❀ title :",
          `${cleanText(res.title || "-")}`,
        ].join("\n").trim();

        const annotations = [
          {
            polygonVertices: [
              { x: 0, y: 0 },
              { x: 1000, y: 0 },
              { x: 1000, y: 1000 },
              { x: 0, y: 1000 },
            ],
            shouldSkipConfirmation: true,
            embeddedContent: {
              embeddedMusic: {
                musicContentMediaId: "1409620227516822",
                songId: "244215252974958",
                author: "Elaina - MD",
                title: "​",
                artistAttribution: "https://whatsapp.com/channel/0029VbAYjQgKrWQulDTYcg2K",
                countryBlocklist: "",
                isExplicit: false,
                artworkMediaKey: "",
              },
            },
            embeddedAction: true,
          },
        ];

        const images = [];
        const videos = [];

        for (const item of res.media) {
          if (item.type === "mp4") {
            videos.push(item.url);
          } else {
            images.push(item.url);
          }
        }

        if (images.length) {
          await sock.sendMessage(remoteJid, {
            album: images.map((url, i) => ({
              image: { url },
              caption: i === 0 ? caption : "",
              annotations,
            })),
          }, { quoted: msg });
        }

        for (const url of videos) {
          await sock.sendMessage(remoteJid, {
            video: { url },
            caption,
            annotations,
          }, { quoted: msg });
        }

        await react("✅");
      } catch (e) {
        logger?.warn?.(`[igdl] ${e?.message || e}`);
        await react("❌");
        return reply("Error bang");
      }
    },
};
