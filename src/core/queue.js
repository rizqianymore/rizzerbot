import { handleMessage } from "@/src/core/handler.js";
import { db } from "@/src/core/database.js";

const chatQueues = new Map();
const QUEUE_DELAY_MS = 50;

function getSockIdentity(sock) {
  try {
    const jid = db.normalizeJid(sock?.user?.id || "");
    if (jid) return jid;
  } catch (_) {}
  // Fallback sebelum login: bedakan main vs sub agar antrean tidak tercampur
  if (sock?.isSubBot) return `sub_${sock?.subBotNumber || "unknown"}`;
  return "main";
}

function getQueueKey(sock, remoteJid) {
  return `${getSockIdentity(sock)}::${remoteJid}`;
}

async function processQueue(key, logger) {
  const queue = chatQueues.get(key);
  if (!queue || queue.processing) return;

  queue.processing = true;

  while (queue.tasks.length > 0) {
    const { sock, msg } = queue.tasks[0];

    try {
      await handleMessage(sock, msg, logger);
    } catch (err) {
      if (logger) {
        logger.error(`[Queue Error] Failed to handle message in ${key}:`, err);
      } else {
        console.error(`[Queue Error] Failed to handle message in ${key}:`, err);
      }
    }

    // Remove the processed task
    queue.tasks.shift();

    // Sleep before processing next task to prevent burst spamming
    if (queue.tasks.length > 0) {
      await new Promise((resolve) => setTimeout(resolve, QUEUE_DELAY_MS));
    }
  }

  chatQueues.delete(key);
}

const MAX_QUEUE_PER_CHAT = 50;

export function enqueueMessage(sock, msg, logger) {
  if (!msg.key || !msg.key.remoteJid) return;

  const key = getQueueKey(sock, msg.key.remoteJid);

  if (!chatQueues.has(key)) {
    chatQueues.set(key, {
      tasks: [],
      processing: false,
    });
  }

  const queue = chatQueues.get(key);
  if (queue.tasks.length >= MAX_QUEUE_PER_CHAT) {
    if (logger) {
      logger.warn(`[Queue Overflow] Chat ${key} exceeded max queue capacity (${MAX_QUEUE_PER_CHAT}). Dropping oldest task.`);
    }
    queue.tasks.shift();
  }

  queue.tasks.push({ sock, msg });

  // Start processing loop asynchronously
  processQueue(key, logger).catch((err) => {
    console.error(`[Queue Fatal] Loop crash for ${key}:`, err);
  });
}
