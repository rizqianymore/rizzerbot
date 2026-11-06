/**
 * ==============================================================================
 * CUSTOM MENU & TEMPLATE DESIGNER
 * ==============================================================================
 * Di file ini kamu bebas mendesain seluruh tampilan menu bot sesuai seleramu!
 * Perubahan di file ini langsung aktif tanpa menyentuh core system.
 * ==============================================================================
 */

export const customMenuConfig = {
  // Aktifkan custom menu (true = desain kamu aktif, false = default)
  enabled: true,

  /**
   * 1. FULL OVERRIDE RENDER MENU (Jika diisi fungsi, desain ini mengambil alih 100%)
   * Parameter 'data':
   * - data.botName        : Nama bot
   * - data.prefix         : Prefix aktif (misal: .)
   * - data.role           : Role pengguna (Owner/Admin/Premium/User)
   * - data.totalCmds      : Total seluruh perintah
   * - data.categories     : Object berisi array command per kategori { AI: [...], Tools: [...] }
   * - data.catKeys        : Array nama kategori yang terurut
   * - data.targetCategory : Kategori yang sedang dibuka (misal: 'AI', atau null jika menu utama)
   * - data.showAll        : Boolean true jika user mengetik .menu all
   * - data.isPublic       : Boolean status publik bot
   */
  renderMenu: (data) => {
    const { botName, prefix, role, totalCmds, categories, catKeys, targetCategory, showAll } = data;

    // Header Kustom
    let out = `╭━━━━━━━『 *${botName.toUpperCase()}* 』━━━━━━━\n`;
    out += `┃ 🌐 *Status:* Active & Connected\n`;
    out += `┃ ⚡ *Prefix:* [ ${prefix} ]\n`;
    out += `┃ 👤 *Role:* ${role}\n`;
    out += `┃ 📦 *Total Fitur:* ${totalCmds} Perintah\n`;
    out += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    // 1. Jika pengguna membuka kategori spesifik (contoh: .menu ai, .menu osint, .menu stalk)
    if (targetCategory && categories[targetCategory]) {
      const cmds = categories[targetCategory] || [];
      out += `┌───『 *KATEGORI ${targetCategory.toUpperCase()}* (${cmds.length}) 』\n`;
      for (const cmd of cmds) {
        out += `│ • \`${prefix}${cmd.name}\`\n`;
      }
      out += `└───\n\n`;
      out += `_💡 Ketik \`${prefix}menu <nama_perintah>\` untuk panduan penggunaan._`;
      return out;
    }

    // 2. Jika pengguna meminta seluruh menu (contoh: .menu all)
    if (showAll) {
      for (const cat of catKeys) {
        const cmds = categories[cat] || [];
        if (!cmds || cmds.length === 0) continue;
        out += `┌───『 *${cat.toUpperCase()}* (${cmds.length}) 』\n`;
        for (const cmd of cmds) {
          out += `│ • \`${prefix}${cmd.name}\`\n`;
        }
        out += `└───\n\n`;
      }
      out += `_💡 Ketik \`${prefix}menu <nama_perintah>\` untuk melihat fungsi detail._`;
      return out;
    }

    // 3. Tampilan Menu Utama (Daftar Kategori Interaktif)
    out += `┌───『 *DAFTAR KATEGORI MENU* 』\n`;
    for (const cat of catKeys) {
      const count = categories[cat]?.length || 0;
      const alias = cat.toLowerCase().replace(/[^a-z0-9]/g, "");
      out += `│ ✦ \`${prefix}menu ${alias}\` ➜ *${cat}* (${count})\n`;
    }
    out += `└───\n\n`;

    out += `• \`${prefix}menu all\` ➜ Buka seluruh menu lengkap\n\n`;
    out += `_💡 Ketik \`${prefix}menu <kategori>\` untuk membuka daftar perintah._`;

    return out;
  },

  // Fallback parsial jika renderMenu tidak digunakan
  header: (data) => {
    return (
      `╭───「 *${data.botName.toUpperCase()}* 」\n` +
      `│ • Prefix: [ ${data.prefix} ]\n` +
      `│ • Role: ${data.role}\n` +
      `│ • Total: ${data.totalCmds} Perintah\n` +
      `╰───\n\n`
    );
  },

  categoryWrapper: (categoryName, commandList, prefix) => {
    let out = `╭───「 *${categoryName.toUpperCase()}* (${commandList.length}) 」\n`;
    for (const c of commandList) {
      out += `│ • ${prefix}${c.name}\n`;
    }
    out += `╰───\n\n`;
    return out;
  },

  footer: (data) => {
    return `_Ketik ${data.prefix}menu <nama_perintah> untuk melihat detail panduan_`;
  },
};
