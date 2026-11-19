import { makeAICommand } from "./_shared.js";

export default makeAICommand({
  name: "deepseek",
  aliases: ["ds", "deepseekai", "r1"],
  model: "deepseek",
  description: "Chat DeepSeek via API resmi (butuh DEEPSEEK_API_KEY)",
  extra: "Butuh DEEPSEEK_API_KEY. Tanpa key, plugin otomatis jatuh ke engine gratis lain.",
});
