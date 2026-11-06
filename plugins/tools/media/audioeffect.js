import { getMediaBuffer, findDownloadableTarget } from "@/src/services/fetch/media.js";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import { getFfmpegPath } from "@/src/services/fetch/media/ffmpeg.js";

const execFileAsync = promisify(execFile);

const EFFECTS = {
  nightcore: {
    label: "Nightcore (Speed up + Pitch up)",
    filter: "asetrate=44100*1.25,aresample=44100,atempo=1.05",
  },
  slowed: {
    label: "Slowed & Reverb",
    filter: "asetrate=44100*0.82,aresample=44100,aecho=0.8:0.88:60:0.4",
  },
  robot: {
    label: "Robot Voice",
    filter: "afftfilt=real='hypot(re,im)*sin(0)':imag='hypot(re,im)*cos(0)':win_size=512:overlap=0.75",
  },
  reverse: {
    label: "Audio Reverse (Mundur)",
    filter: "areverse",
  },
  echo: {
    label: "Echo Effect",
    filter: "aecho=0.8:0.9:1000:0.3",
  },
  chipmunk: {
    label: "Chipmunk (Tupai)",
    filter: "asetrate=44100*1.4,aresample=44100",
  },
  deep: {
    label: "Deep Bass Voice",
    filter: "asetrate=44100*0.75,aresample=44100,bass=g=8",
  },
};

export default {
  name: "audioeffect",
  aliases: ["aeffect", "nightcore", "slowed", "robotvoice", "chipmunk", "audiofilter"],
  description: "Ubah efek suara audio atau video (nightcore, slowed, robot, reverse, chipmunk, echo, deep)",
  usage: "<efek> (reply audio/vn/video)",
  category: "Tools & Media",
  cooldownMs: 8000,
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    await sendTyping();
    const p = prefix || ".";

    // Cek perintah alias yang langsung spesifik
    const invoked = String(msg.message?.extendedTextMessage?.text || msg.message?.conversation || "")
      .trim()
      .split(/\s+/)[0]
      .toLowerCase()
      .replace(/^[./!]/, "");

    let chosenEffect = null;
    if (invoked === "nightcore") chosenEffect = "nightcore";
    else if (invoked === "slowed") chosenEffect = "slowed";
    else if (invoked === "robotvoice") chosenEffect = "robot";
    else if (invoked === "chipmunk") chosenEffect = "chipmunk";
    else if (args[0] && EFFECTS[args[0].toLowerCase()]) {
      chosenEffect = args[0].toLowerCase();
    }

    if (!chosenEffect) {
      const effectList = Object.keys(EFFECTS)
        .map((k) => `• *${k}* : ${EFFECTS[k].label}`)
        .join("\n");

      return reply(
        `*AUDIO EFFECT PROCESSOR*\n\n` +
          `Balas (reply) audio/vn/video dengan efek yang dipilih:\n\n` +
          `*Daftar Efek Suara:*\n${effectList}\n\n` +
          `*Contoh Penggunaan:*\n` +
          `• Reply audio lalu ketik: *${p}nightcore*\n` +
          `• Reply audio lalu ketik: *${p}slowed*\n` +
          `• Reply audio lalu ketik: *${p}audioeffect robot*`
      );
    }

    const target = findDownloadableTarget(msg);
    if (!target) {
      return reply(`Balas (reply) audio, VN, atau video yang ingin diberi efek *${chosenEffect}*.`);
    }

    let buffer;
    try {
      buffer = await getMediaBuffer(sock, target, { maxBytes: 30 * 1024 * 1024 });
    } catch (err) {
      return reply(`Gagal mengunduh media: ${err?.message || err}`);
    }

    if (!buffer?.length) return reply("Gagal membaca buffer media.");

    await reply(`Memproses efek *${EFFECTS[chosenEffect].label}*...`);

    const tmpDir = path.join(process.cwd(), "assets", "cache");
    await fs.mkdir(tmpDir, { recursive: true }).catch(() => {});
    const base = path.join(tmpDir, `aeff-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const inFile = `${base}.tmp`;
    const outFile = `${base}.mp3`;

    try {
      await fs.writeFile(inFile, buffer);

      const filterStr = EFFECTS[chosenEffect].filter;
      await execFileAsync(
        getFfmpegPath(),
        [
          "-y",
          "-i",
          inFile,
          "-vn",
          "-af",
          filterStr,
          "-c:a",
          "libmp3lame",
          "-b:a",
          "128k",
          outFile,
        ],
        { timeout: 60000 }
      );

      const out = await fs.readFile(outFile);
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          audio: out,
          mimetype: "audio/mp4",
          ptt: false,
        },
        { quoted: msg }
      );
    } catch (err) {
      return reply(`Gagal memproses efek audio: ${err?.message || err}`);
    } finally {
      await fs.unlink(inFile).catch(() => {});
      await fs.unlink(outFile).catch(() => {});
    }
  },
};
