import fs from "fs";
import path from "path";

// Auto load .env if exists
const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  try {
    const envContent = fs.readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  } catch (_) {}
}

import {
  startBot,
  addSecondaryBot,
  stopSecondaryBot,
  runningBots,
  logger,
} from "@/src/core/connection.js";

process.env.FFMPEG_PATH = path.join(process.cwd(), "bin", "ffmpeg");

export { addSecondaryBot, stopSecondaryBot, runningBots };

startBot().catch((err) => {
  logger.error("Fatal initialization error:", err);
});

export default startBot;
