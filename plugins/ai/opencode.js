import { makeAICommand } from "./_shared.js";

export default makeAICommand({
  name: "opencode",
  aliases: ["oc", "opencodeai", "zenai"],
  model: "opencode",
  description: "Chat dengan OpenCode Zen free models (coding & reasoning)",
  extra: "Gratis tanpa API key. Untuk tier pro, set OPENCODE_API_KEY.",
});
