import {
  startBot,
  addSecondaryBot,
  stopSecondaryBot,
  runningBots,
  logger,
} from "@/src/core/connection.js";

export { addSecondaryBot, stopSecondaryBot, runningBots };

startBot().catch((err) => {
  logger.error("Fatal initialization error:", err);
});

export default startBot;
