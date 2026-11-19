import { makeAICommand } from "./_shared.js";

export default makeAICommand({
  name: "pollinations",
  aliases: ["polli", "pl"],
  model: "pollinations",
  description: "Chat via Pollinations public node (gratis, tanpa API key)",
  extra: "Free tier: 1 balasan / 45 detik per IP. Hasil identik dalam 10 menit diambil dari cache.",
});
