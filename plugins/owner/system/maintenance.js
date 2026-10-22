export default {
  name: "maintenance",
  description: "Aktifkan/nonaktifkan mode maintenance bot",
  usage: "[--on | --off]",
  ownerOnly: true,
  category: "Owner",
  run: async (sock, msg, { reply }) => {
    const mode = args?.[0];
    if (mode === "--on") {
      await reply("🔧 Bot dimasukkan ke mode maintenance");
    } else if (mode === "--off") {
      await reply("✅ Bot kembali normal");
    } else {
      await reply("Gunakan: \ atau ");
    }
  },
};
