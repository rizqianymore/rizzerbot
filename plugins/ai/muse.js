import { makeAICommand } from "./_shared.js";

export default makeAICommand({
  name: "muse",
  aliases: ["museai", "metaai", "metaweb", "musecode"],
  model: "muse",
  description: "Chat dengan Meta AI / Muse Code via web protocol (GraphQL + SSE)",
  extra: "Mendukung cookie browser (MUSE_COOKIE). Jika tanpa cookie, otomatis memakai fallback node.",
});
