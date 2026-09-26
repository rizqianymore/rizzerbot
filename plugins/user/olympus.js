import { db } from "@/src/core/database.js";

/**
 * Gate of Olympus - Boss Battle & Relic Quest RPG Simulator (Non-Gambling)
 * Konsep:
 * - Pemain menggunakan Energy (regenerasi berkala / free daily) untuk memanggil Sambaran Zeus (.zeus / .olympus).
 * - Menghasilkan kombo grid 5x5 elemen mitologi (Petir ⚡, Cawan Emas 🏆, Mahkota 👑, Cincin 💍, Jam Pasir ⏳, dsb).
 * - Bukan uang/judi nyata, melainkan battle damage untuk mengalahkan Monster Olympus, menaikkan Level, dan mengumpulkan Kristal Dewa.
 */

const SYMBOLS = [
  { name: "Petir Zeus", char: "⚡", power: 50, rarity: 0.1 },
  { name: "Mahkota Olympus", char: "👑", power: 35, rarity: 0.15 },
  { name: "Cawan Emas", char: "🏆", power: 25, rarity: 0.2 },
  { name: "Cincin Delima", char: "💍", power: 15, rarity: 0.25 },
  { name: "Jam Pasir Ilahi", char: "⏳", power: 10, rarity: 0.3 },
  { name: "Kristal Biru", char: "💎", power: 5, rarity: 0.4 },
  { name: "Permata Zamrud", char: "🟢", power: 4, rarity: 0.5 },
  { name: "Batu Api", char: "🔴", power: 3, rarity: 0.6 },
];

const ZEUS_DIALOGUES_WIN = [
  "⚡ *ZEUS MENGGELEGAR:* 'Kekuatan petir Gunung Olympus berpihak kepadamu, ksatria fana!'",
  "⚡ *ZEUS BERSABDA:* 'Saksikan keagungan gerbang para dewa! Terimalah berkah ini!'",
  "⚡ *PETIR MENYAMBAR:* 'Goncangan Olympus membuka segel harta karun langit!'",
];

const ZEUS_DIALOGUES_NORMAL = [
  "⚡ *ZEUS TERSENYUM:* 'Seranganmu lumayan, teruslah berlatih menempa jiwamu!'",
  "⚡ *ZEUS BERSABDA:* 'Gerbang Olympus tetap kokoh. Cobalah menghantamnya kembali!'",
  "⚡ *GEMURUH LANGIT:* 'Angin Olympus berhembus, perisaimu menahan benturan dewa!'",
];

function getRandomSymbol() {
  const rand = Math.random();
  for (const s of SYMBOLS) {
    if (rand <= s.rarity) return s;
  }
  return SYMBOLS[SYMBOLS.length - 1];
}

function generateGrid(rows = 4, cols = 4) {
  const grid = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      row.push(getRandomSymbol());
    }
    grid.push(row);
  }
  return grid;
}

function calculateCombos(grid) {
  const counts = {};
  for (const row of grid) {
    for (const item of row) {
      counts[item.char] = (counts[item.char] || 0) + 1;
    }
  }

  let totalPower = 0;
  const combos = [];
  let multiplier = 1;

  // Cek kemunculan Petir Zeus untuk multiplier
  const zeusLightningCount = counts["⚡"] || 0;
  if (zeusLightningCount >= 3) {
    multiplier = Math.min(10, 2 + Math.floor(Math.random() * 5));
  }

  for (const sym of SYMBOLS) {
    const c = counts[sym.char] || 0;
    if (c >= 4) {
      const matchScore = c * sym.power;
      totalPower += matchScore;
      combos.push({
        name: sym.name,
        char: sym.char,
        count: c,
        score: matchScore,
      });
    }
  }

  const finalScore = totalPower * multiplier;
  return { counts, combos, multiplier, finalScore };
}

export default [
  {
    name: "olympus",
    aliases: ["zeus", "gatesofolympus", "petirzeus"],
    description: "Tantang Gerbang Olympus dan sambar petir Zeus (RPG Mini-game Non-Judi)",
    category: "User",
    run: async (sock, msg, args, { reply, senderJid, sendTyping, isOwner, prefix }) => {
      await sendTyping();

      const user = db.getUser(senderJid);
      if (!user) return reply("❌ Gagal memuat profil pengguna.");

      const now = Date.now();
      let currentEnergy = user.energy ?? 50;
      const lastRefill = user.energyLastRefill ?? now;

      // Auto refill 1 energy setiap 2 menit (120,000 ms), maks 100 energy
      const elapsed = now - lastRefill;
      const addedEnergy = Math.floor(elapsed / 120000);
      if (addedEnergy > 0) {
        currentEnergy = Math.min(100, currentEnergy + addedEnergy);
        db.updateUser(senderJid, {
          energy: currentEnergy,
          energyLastRefill: now,
        });
      }

      const cost = 10;
      if (currentEnergy < cost && !isOwner) {
        const nextInMin = Math.ceil((120000 - (elapsed % 120000)) / 60000);
        return reply(
          `⚡ *Energi Olympus Habis!*\n\n` +
          `Energi kamu saat ini: *${currentEnergy}/100*\n` +
          `Dibutuhkan minimal *${cost} Energi* untuk menantang Gerbang Zeus.\n` +
          `⏳ Energi terisi kembali 1 setiap 2 menit (Refill berikutnya ~${nextInMin} menit).\n\n` +
          `💡 _Ketik \`${prefix}dailyenergy\` untuk klaim bonus energi harian!_`
        );
      }

      // Kurangi energi
      const remainingEnergy = isOwner ? currentEnergy : currentEnergy - cost;

      // Generate 4x4 Olympus Grid
      const grid = generateGrid(4, 4);
      const { combos, multiplier, finalScore } = calculateCombos(grid);

      // Hitung EXP dan Kristal reward
      const gainedExp = Math.max(10, Math.floor(finalScore / 10) + 15);
      const gainedCrystals = Math.max(5, Math.floor(finalScore / 5));

      let userExp = (user.exp || 0) + gainedExp;
      let userLevel = user.level || 1;
      let userCrystals = (user.crystals || 100) + gainedCrystals;
      let spinsWon = (user.spinsWon || 0) + (combos.length > 0 ? 1 : 0);

      // Level up logic (Level * 100 EXP)
      let levelUpMessage = "";
      const expNeeded = userLevel * 100;
      if (userExp >= expNeeded) {
        userExp -= expNeeded;
        userLevel += 1;
        userCrystals += 50; // Bonus kristal saat level up
        levelUpMessage = `\n🎉 *LEVEL UP!* Selamat, kamu naik ke *Level ${userLevel}*! (+50 💎 Kristal)`;
      }

      db.updateUser(senderJid, {
        energy: remainingEnergy,
        exp: userExp,
        level: userLevel,
        crystals: userCrystals,
        spinsWon,
      });

      // Format Grid Tampilan
      const gridVisual = grid.map((r) => r.map((c) => c.char).join("  ")).join("\n");

      let dialogue = combos.length > 0
        ? ZEUS_DIALOGUES_WIN[Math.floor(Math.random() * ZEUS_DIALOGUES_WIN.length)]
        : ZEUS_DIALOGUES_NORMAL[Math.floor(Math.random() * ZEUS_DIALOGUES_NORMAL.length)];

      let text = `⚡🏛️ *GATES OF OLYMPUS: ZEUS ASCENSION* 🏛️⚡\n`;
      text += `─────────────────────────\n`;
      text += `${dialogue}\n\n`;
      text += `📜 *Papan Gerbang Ilahi:*\n`;
      text += `${gridVisual}\n\n`;

      if (combos.length > 0) {
        text += `💥 *Kombo Elemen Terpicu:*\n`;
        combos.forEach((c) => {
          text += ` • ${c.char} ${c.name} x${c.count} (+${c.score} Poin)\n`;
        });
        if (multiplier > 1) {
          text += `⚡ *Sambaran Petir Zeus Multiplier: x${multiplier}!* ⚡\n`;
        }
        text += `🎯 *Total Power Serangan:* *${finalScore}*\n\n`;
      } else {
        text += `💨 _Tidak ada kombo elemen yang cukup sejajar kali ini._\n\n`;
      }

      text += `🎁 *Hadiah Quest:*\n`;
      text += ` • Status: ${combos.length > 0 ? "🎉 *BERKAH / MENANG*" : "🛡️ *BERTAHAN*"}\n`;
      text += ` • EXP: +${gainedExp} EXP (${userExp}/${userLevel * 100})\n`;
      text += ` • Kristal Olympus: +${gainedCrystals} 💎 (Total: ${userCrystals})\n`;
      text += ` • Sisa Energi: ${remainingEnergy}/100 ⚡\n`;
      text += levelUpMessage;
      text += `─────────────────────────\n`;
      text += `💡 _Tonton cuplikan sambaran petir Olympus di video di atas!_`;

      try {
        let videoBuffer = null;
        try {
          const { recordRealOlympusGameplay } = await import("@/src/services/olympus-recorder.js");
          videoBuffer = await recordRealOlympusGameplay({ durationSec: 2.5, fps: 8 });
        } catch (_) {
          const { generateOlympusVideo } = await import("@/src/services/olympus-video.js");
          videoBuffer = await generateOlympusVideo({
            isWin: combos.length > 0,
            multiplier,
            score: finalScore,
            level: userLevel,
          });
        }

        if (videoBuffer) {
          await sock.sendMessage(
            msg.key.remoteJid,
            {
              video: videoBuffer,
              caption: text.trim(),
              mimetype: "video/mp4",
            },
            { quoted: msg }
          );
        } else {
          await reply(text.trim());
        }
      } catch (vidErr) {
        await reply(text.trim());
      }
    },
  },
  {
    name: "dailyenergy",
    aliases: ["klaimenergi", "refillenergy"],
    description: "Klaim 50 energi gratis harian untuk quest Olympus",
    category: "User",
    run: async (sock, msg, args, { reply, senderJid, sendTyping }) => {
      await sendTyping();
      const user = db.getUser(senderJid);
      if (!user) return reply("❌ Gagal memuat profil pengguna.");

      const now = Date.now();
      const lastDaily = user.lastDailyEnergy || 0;
      const TWELVE_HOURS = 12 * 60 * 60 * 1000;

      if (now - lastDaily < TWELVE_HOURS) {
        const sisaJam = Math.ceil((TWELVE_HOURS - (now - lastDaily)) / (60 * 60 * 1000));
        return reply(`⏳ Kamu sudah mengklaim energi ilahi. Silakan kembali lagi dalam ~${sisaJam} jam.`);
      }

      const newEnergy = Math.min(100, (user.energy || 50) + 50);
      db.updateUser(senderJid, {
        energy: newEnergy,
        lastDailyEnergy: now,
      });

      await reply(
        `⚡ *BERKAH HARIAN ZEUS TELAH DITERIMA!* ⚡\n\n` +
        `Kamu mendapatkan *+50 Energi Olympus*!\n` +
        `🔋 Total Energi saat ini: *${newEnergy}/100*\n\n` +
        `Ketik *.olympus* untuk memulai quest petir!`
      );
    },
  },
  {
    name: "olympusprofile",
    aliases: ["zeusprofile", "zeusstats"],
    description: "Lihat statistik petir, level ksatria, dan kristal Olympus kamu",
    category: "User",
    run: async (sock, msg, args, { reply, senderJid, sendTyping }) => {
      await sendTyping();
      const user = db.getUser(senderJid);
      if (!user) return reply("❌ Gagal memuat profil.");

      const energy = user.energy ?? 50;
      const level = user.level ?? 1;
      const exp = user.exp ?? 0;
      const crystals = user.crystals ?? 100;
      const spinsWon = user.spinsWon ?? 0;

      const text =
        `🏛️ *PROFIL KSATRIA GATES OF OLYMPUS* 🏛️\n` +
        `─────────────────────────\n` +
        `👤 *Nama:* ${user.name || "Ksatria Fana"}\n` +
        `⭐ *Tingkat Level:* Level ${level}\n` +
        `✨ *Progress EXP:* ${exp}/${level * 100} EXP\n` +
        `⚡ *Energi Tempur:* ${energy}/100\n` +
        `💎 *Kristal Olympus:* ${crystals}\n` +
        `🏆 *Kombo Sukses:* ${spinsWon} kali\n` +
        `─────────────────────────\n` +
        `💡 _Gunakan \`.olympus\` untuk bertempur, atau \`.dailyenergy\` untuk refill gratis._`;

      await reply(text);
    },
  },
];
