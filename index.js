import path from "path";
import {
  startBot,
  addSecondaryBot,
  stopSecondaryBot,
  runningBots,
  logger,
} from "@/src/core/connection.js";

// Set global FFMPEG_PATH for media converters and processors
process.env.FFMPEG_PATH = path.join(process.cwd(), "bin", "ffmpeg");

export { addSecondaryBot, stopSecondaryBot, runningBots };

startBot().catch((err) => {
  logger.error("Fatal initialization error:", err);
});

export default startBot;
