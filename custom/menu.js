/**
 * ==============================================================================
 * CUSTOM MENU & TEMPLATE
 * ==============================================================================
 * Menu kini mendukung:
 * 1. Menu Ringkas / Split (Default): Menampilkan daftar kategori + perintah utama
 *    agar chat tidak kepanjangan.
 * 2. Menu Spesifik Kategori: Cukup ketik .menu osint, .menu download, .menu group, dll.
 * 3. Menu Lengkap: Ketik .menu all untuk melihat seluruh perintah sekaligus.
 * ==============================================================================
 */

export const customMenuConfig = {
  enabled: true,

  // Template Header
  header: (data) => {
    return (
      `╭───「 *${data.botName.toUpperCase()}* 」\n` +
      `│ • Status: Online\n` +
      `│ • Mode: ${data.isPublic ? "Publik" : "Privat"}\n` +
      `│ • Prefix: [ ${data.prefix} ]\n` +
      `│ • Role: ${data.role}\n` +
      `│ • Total: ${data.totalCmds} Perintah\n` +
      `╰───\n\n`
    );
  },

  // Template Menu Utama Ringkas (Pecah per Kategori)
  mainMenu: (data, categories, prefix) => {
    let out = `*PILIHAN MENU KATEGORI:*\n\n`;
    const catKeys = Object.keys(categories);

    for (const cat of catKeys) {
      const count = categories[cat]?.length || 0;
      const cmdAlias = cat.toLowerCase().replace(/[^a-z0-9]/g, "");
      out += `• *${prefix}menu ${cmdAlias}* — ${cat} (${count} perintah)\n`;
    }

    out += `\n• *${prefix}menu all* — Tampilkan seluruh perintah lengkap\n`;
    return out;
  },

  // Template Pembungkus Kategori Spesifik
  categoryWrapper: (categoryName, commandList, prefix) => {
    let out = `╭───「 *${categoryName.toUpperCase()}* (${commandList.length}) 」\n`;
    for (const c of commandList) {
      out += `│ • ${prefix}${c.name}\n`;
    }
    out += `╰───\n\n`;
    return out;
  },

  // Template Footer
  footer: (data) => {
    return `_Ketik ${data.prefix}menu <nama_perintah> untuk melihat detail panduan_`;
  },
};
