export default {
  name: "hargaemas",
  aliases: ["emas", "antam", "goldprice"],
  description: "Cek harga emas Logam Mulia Antam & buyback terkini hari ini",
  usage: "[gram/jumlah]",
  category: "Info",
  cooldownMs: 5000,

  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const p = prefix || ".";
    await sendTyping();

    try {
      const res = await fetch("https://logam-mulia-api.vercel.app/prices/hargaemas-today", {
        signal: AbortSignal.timeout(10000),
      });

      let data = null;
      if (res.ok) {
        data = await res.json();
      }

      // Fallback jika API pertama offline
      if (!data || !data.data) {
        const res2 = await fetch("https://indodax.com/api/ticker/paxg_idr", {
          signal: AbortSignal.timeout(10000),
        });
        if (res2.ok) {
          const d2 = await res2.json();
          const paxgIdr = Number(d2.ticker?.last || 0);
          // 1 troy ounce = 31.1035 gram
          const perGram = Math.round(paxgIdr / 31.1035);
          if (perGram > 0) {
            const formatted = new Intl.NumberFormat("id-ID", {
              style: "currency",
              currency: "IDR",
              minimumFractionDigits: 0,
            }).format(perGram);

            let text =
              `┌── HARGA EMAS DUNIA (PAXG/IDR)\n` +
              `│ Tipe         : Emas Murni 24 Karat (Spot Price)\n` +
              `│ Sumber Data  : Indodax PAXG / Gold Token\n` +
              `└──\n\n` +
              `├── [1] Harga Estimasi per Gram\n` +
              `│   Per Gram   : ${formatted}\n` +
              `│   1 Troy Oz  : Rp${paxgIdr.toLocaleString("id-ID")}\n` +
              `│\n` +
              `└── [2] Perhitungan Kustom\n` +
              `    Ketik \`${p}emas <jumlah gram>\` untuk kalkulasi nilai.`;

            if (args[0] && !isNaN(Number(args[0]))) {
              const qty = Math.abs(Number(args[0]));
              const total = Math.round(qty * perGram);
              text +=
                `\n\n┌── ESTIMASI TOTAL\n` +
                `│ Jumlah : ${qty} gram\n` +
                `│ Total  : Rp${total.toLocaleString("id-ID")}\n` +
                `└──`;
            }
            return reply(text);
          }
        }
        throw new Error("Sumber data harga emas sedang tidak merespons.");
      }

      const info = data.data;
      const dateStr = info.date || "Hari Ini";
      const buyback = Number(info.buyback || 0);
      const list = Array.isArray(info.price_list) ? info.price_list : [];

      let text =
        `┌── HARGA EMAS LOGAM MULIA ANTAM\n` +
        `│ Tanggal     : ${dateStr}\n` +
        `│ Buyback     : Rp${buyback.toLocaleString("id-ID")} / gr\n` +
        `└──\n\n`;

      const displayList = list.slice(0, 7);
      displayList.forEach((item, idx) => {
        const isLast = idx === displayList.length - 1;
        const branch = isLast ? "└──" : "├──";
        const subPipe = isLast ? "   " : "│  ";
        const pGram = Number(item.price_per_gram || item.price || 0);
        const pTotal = Number(item.price || 0);
        text += `${branch} [${idx + 1}] Emas Batangan ${item.weight || item.gram} gr\n`;
        text += `${subPipe} Total  : Rp${pTotal.toLocaleString("id-ID")}\n`;
        if (pGram > 0) {
          text += `${subPipe} Per Gr : Rp${pGram.toLocaleString("id-ID")}\n`;
        }
      });

      if (args[0] && !isNaN(Number(args[0]))) {
        const reqGram = Number(args[0]);
        const match = list.find((it) => Number(it.weight || it.gram) === reqGram);
        if (match) {
          text +=
            `\n\n┌── DETAIL ${match.weight || match.gram} GRAM\n` +
            `│ Harga Pokok : Rp${Number(match.price).toLocaleString("id-ID")}\n` +
            `│ PPh 0.25%   : Rp${Math.round(Number(match.price) * 1.0025).toLocaleString("id-ID")}\n` +
            `└──`;
        }
      }

      text += `\n\n_Sumber: Logam Mulia (PT Antam Tbk)_`;
      return reply(text);
    } catch (err) {
      return reply(`❌ Gagal mengambil data harga emas: ${err.message}`);
    }
  },
};
