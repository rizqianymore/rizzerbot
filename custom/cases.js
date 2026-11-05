/**
 * ==============================================================================
 * CUSTOM CASES & COMMANDS (User Playground)
 * ==============================================================================
 * Di file ini Anda bisa menambahkan perintah/case Anda sendiri dengan sintaks
 * yang sangat mudah tanpa perlu membongkar core bot.
 *
 * Contoh cara menambah perintah:
 * case "halo":
 *   return reply("Halo juga! Selamat datang di bot.");
 *
 * case "info":
 *   return reply(`Waktu sekarang: ${new Date().toLocaleTimeString("id-ID")}`);
 * ==============================================================================
 */

export async function handleCustomCase(command, { sock, msg, args, reply, sendTyping, isOwner, isAdmin, isPremium, prefix }) {
  const curPrefix = prefix || ".";
  const q = (args || []).join(" ").trim();

  switch (command.toLowerCase()) {
    // -------------------------------------------------------------
    // CONTOH 1: Perintah sederhana teks balasan
    // -------------------------------------------------------------
    case "tes":
    case "test":
      return reply("Bot aktif dan siap merespons!");

    // -------------------------------------------------------------
    // CONTOH 2: Perintah dengan argumen
    // -------------------------------------------------------------
    case "say":
    case "echo":
      if (!q) return reply(`Ketik teks yang ingin diulangi! Contoh: \`${curPrefix}say halo dunia\``);
      return reply(q);

    // -------------------------------------------------------------
    // CONTOH 3: Perintah cek status user
    // -------------------------------------------------------------
    case "myrole":
      return reply(
        `*STATUS ROLE ANDA:*\n` +
        `• Owner: ${isOwner ? "[OK] Ya" : "Bukan"}\n` +
        `• Admin: ${isAdmin ? "[OK] Ya" : "Bukan"}\n` +
        `• Premium: ${isPremium ? "[OK] Ya" : "Bukan"}`
      );

    // -------------------------------------------------------------
    // Silakan tambahkan case Anda sendiri di bawah ini:
    // -------------------------------------------------------------

    default:
      // Kembalikan false jika command bukan custom case (agar diteruskan ke plugin biasa)
      return false;
  }
}
