/**
 * ==============================================================================
 * CUSTOM MENU & TEMPLATE
 * ==============================================================================
 * Di file ini Anda bisa bebas mengatur tampilan header, footer, dan gaya menu
 * sesuai selera Anda tanpa takut merusak sistem loader.
 * ==============================================================================
 */

export const customMenuConfig = {
  // Aktifkan custom menu (true = pakai template kustom ini, false = template default)
  enabled: true,

  // Template Header Menu
  header: (data) => {
    return (
      `╭───「 *${data.botName.toUpperCase()}* 」\n` +
      `│ • Status: Online\n` +
      `│ • Mode: ${data.isPublic ? "Publik" : "Privat (Owner Only)"}\n` +
      `│ • Prefix: [ ${data.prefix} ]\n` +
      `│ • Role Anda: ${data.role}\n` +
      `│ • Total Fitur: ${data.totalCmds} Perintah\n` +
      `╰───\n\n`
    );
  },

  // Template pembungkus tiap kategori perintah
  categoryWrapper: (categoryName, commandList, prefix) => {
    let out = `╭───「 *${categoryName.toUpperCase()}* (${commandList.length}) 」\n`;
    for (const c of commandList) {
      out += `│ • ${prefix}${c.name}\n`;
    }
    out += `╰───\n\n`;
    return out;
  },

  // Template Footer Menu
  footer: (data) => {
    return `_Ketik ${data.prefix}menu <nama_perintah> untuk info lengkap_`;
  },
};
