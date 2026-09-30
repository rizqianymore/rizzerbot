/**
 * SubBot Service Barrel / Re-export
 * Modularized subbot service components
 */

export {
  subBots,
  baseSessionsDir,
  isSubBotSocket,
  isSubBotNumber,
  getSubBotsList,
} from "./store.js";

export {
  createSubBot,
  stopSubBot,
} from "./manager.js";

export {
  setupSubBotEvents,
} from "./events.js";

export {
  syncSubBotsDatabase,
  autoRestoreSubBots,
} from "./sync.js";
