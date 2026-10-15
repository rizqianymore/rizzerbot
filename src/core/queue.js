import { handleMessage } from "@/src/core/handler.js";
import { db } from "@/src/core/database.js";

function getTaskBotJid(sock) {
  try {
    const jid = db.normalizeJid(sock?.user?.id || "");
    if (jid) return jid;
  } catch (_) {}
  if (sock?.isSubBot && sock?.subBotNumber) {
    return db.normalizeJid(`${String(sock.subBotNumber).replace(/\D/g, "")}@s.whatsapp.net`);
  }
  return "";
}

const chatQueues = new Map();
const QUEUE_DELAY_MS = 0;

const MAX_CONCURRENT_PER_CHAT = 3;

async function runTask(key, task, logger) {
  const { sock, msg } = task;
  try {
    await db.runWithBot(getTaskBotJid(sock), () => handleMessage(sock, msg, logger));
  } catch (err) {
    if (logger) {
      logger.error(`[Queue Error] Failed to handle message in ${key}:`, err);
    } else {
      console.error(`[Queue Error] Failed to handle message in ${key}:`, err);
    }
  }
}

function pumpQueue(key, logger) {
  const queue = chatQueues.get(key);
  if (!queue) return;
  while (queue.active < MAX_CONCURRENT_PER_CHAT && queue.tasks.length > 0) {
    const task = queue.tasks.shift();
    queue.active += 1;
    runTask(key, task, logger).finally(() => {
      const q = chatQueues.get(key);
      if (!q) return;
      q.active -= 1;
      if (q.tasks.length > 0) {
        if (QUEUE_DELAY_MS > 0) {
          setTimeout(() => pumpQueue(key, logger), QUEUE_DELAY_MS);
        } else {
          pumpQueue(key, logger);
        }
      } else if (q.active <= 0) {
        chatQueues.delete(key);
      }
    });
  }
}

function getSockIdentity(sock) {
  try {
    const jid = db.normalizeJid(sock?.user?.id || "");
    if (jid) return jid;
  } catch (_) {}

  if (sock?.isSubBot) return `sub_${sock?.subBotNumber || "unknown"}`;
  return "main";
}

function getQueueKey(sock, remoteJid) {
  return `${getSockIdentity(sock)}::${remoteJid}`;
}

const MAX_QUEUE_PER_CHAT = 50;

export function enqueueMessage(sock, msg, logger) {
  if (!msg.key || !msg.key.remoteJid) return;

  const key = getQueueKey(sock, msg.key.remoteJid);

  if (!chatQueues.has(key)) {
    chatQueues.set(key, {
      tasks: [],
      active: 0,
    });
  }

  const queue = chatQueues.get(key);
  if (queue.tasks.length >= MAX_QUEUE_PER_CHAT) {
    if (logger) {
      logger.warn(
        `[Queue Overflow] Chat ${key} exceeded max queue capacity (${MAX_QUEUE_PER_CHAT}). Dropping oldest task.`
      );
    }
    queue.tasks.shift();
  }

  queue.tasks.push({ sock, msg });

  pumpQueue(key, logger);
}
