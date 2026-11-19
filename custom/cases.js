/**
 * ==============================================================================
 * CUSTOM CASES & MANDIRI DISPLAY (100% User Playground)
 * ==============================================================================
 * Di file ini Anda bisa:
 * 1. Menentukan dan mendesain 100% tampilan Menu Bot (`renderCustomMenu`).
 * 2. Menambahkan perintah/case non-plugin mandiri (`handleCustomCase`).
 *
 * Desain bersih, rapi, dan minimalis tanpa emoji berlebihan / aneh-aneh.
 * ==============================================================================
 */

/**
 * 1. TAMPILAN MENU KUSTOM MANDIRI (100% Desain Sendiri)
 * @param {object} data
 * - data.botName        : Nama bot
 * - data.prefix         : Prefix aktif (misal: .)
 * - data.role           : Role pengguna (Owner/Admin/Premium/User)
 * - data.totalCmds      : Total seluruh perintah
 * - data.categories     : Object array perintah { AI: [...], Tools: [...] }
 * - data.catKeys        : Array nama kategori
 * - data.targetCategory : Kategori yang sedang dibuka user (misal: 'AI')
 * - data.showAll        : Boolean true jika user mengetik .menu all
 */
export function renderCustomMenu(data) {
  const { botName, prefix, role, totalCmds, categories, catKeys, targetCategory, showAll } = data;

  // Header Kaku & Murni Terminal Linux (┌── │ └── tanpa tanda kurung [ ])
  let out = `┌── ${botName.toUpperCase()}\n`;
  out += `│ OS: Linux (x86_64)\n`;
  out += `│ Status: Online\n`;
  out += `│ Prefix: ${prefix}\n`;
  out += `│ Role: ${role}\n`;
  out += `│ Total: ${totalCmds} Perintah\n`;
  out += `└──\n\n`;

  // Tampilan 1: User membuka kategori tertentu (.menu ai, .menu osint, dll)
  if (targetCategory && categories[targetCategory]) {
    const cmds = categories[targetCategory] || [];
    out += `┌── ${targetCategory.toUpperCase()}\n`;
    cmds.forEach((cmd, i) => {
      const isLast = i === cmds.length - 1;
      const branch = isLast ? "└──" : "├──";
      out += `${branch} ${prefix}${cmd.name}\n`;
    });
    out += `\nKetik ${prefix}menu <perintah> untuk detail panduan.`;
    return out;
  }

  // Tampilan 2: User meminta seluruh menu (.menu all)
  if (showAll) {
    for (const cat of catKeys) {
      const cmds = categories[cat] || [];
      if (!cmds || cmds.length === 0) continue;
      out += `┌── ${cat.toUpperCase()}\n`;
      cmds.forEach((cmd, i) => {
        const isLast = i === cmds.length - 1;
        const branch = isLast ? "└──" : "├──";
        out += `${branch} ${prefix}${cmd.name}\n`;
      });
      out += `\n`;
    }
    out += `Ketik ${prefix}menu <perintah> untuk detail panduan.`;
    return out;
  }

  // Tampilan 3: Menu Utama (Daftar Kategori Bergaya Linux Tree Kaku)
  out += `┌── DAFTAR KATEGORI\n`;
  catKeys.forEach((cat) => {
    const alias = cat.toLowerCase().replace(/[^a-z0-9]/g, "");
    out += `├── ${prefix}menu ${alias} -> ${cat}\n`;
  });
  out += `└── ${prefix}menu all -> Tampilkan Seluruh Menu\n\n`;
  out += `Ketik ${prefix}menu <kategori> untuk membuka daftar.`;

  return out;
}

/**
 * 2. CUSTOM CASES & PERINTAH MANDIRI
 */
export async function handleCustomCase(
  command,
  { sock: _sock, msg: _msg, args, reply, sendTyping: _sendTyping, isOwner, isAdmin, isPremium, prefix }
) {
  const p = prefix || ".";
  const cmd = command.toLowerCase();
  const q = (args || []).join(" ").trim();

  switch (cmd) {
    case "tes":
    case "test":
      return reply("Bot aktif, online, dan berjalan normal.");

    case "say":
    case "echo":
      if (!q) return reply(`Ketik teks yang ingin diulangi. Contoh: \`${p}say halo dunia\``);
      return reply(q);

    case "myrole":
      return reply(
        `*STATUS ROLE ANDA:*\n` +
          `Owner: ${isOwner ? "Ya" : "Bukan"}\n` +
          `Admin: ${isAdmin ? "Ya" : "Bukan"}\n` +
          `Premium: ${isPremium ? "Ya" : "Bukan"}`
      );

    default:
      // Kembalikan false agar diteruskan ke plugin biasa jika tidak ada case yang cocok
      return false;
  }
}

export default { renderCustomMenu, handleCustomCase };
