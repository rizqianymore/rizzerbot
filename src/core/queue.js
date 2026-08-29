import { handleMessage } from "@/src/core/handler.js";

const chatQueues = new Map();
const QUEUE_DELAY_MS = 200; 

async function processQueue(jid, logger) {
  const queue = chatQueues.get(jid);
  if (!queue || queue.processing) return;

  queue.processing = true;

  while (queue.tasks.length > 0) {
    const { sock, msg } = queue.tasks[0];

    try {
      await handleMessage(sock, msg, logger);
    } catch (err) {
      if (logger) {
        logger.error(`[Queue Error] Failed to handle message in ${jid}:`, err);
      } else {
        console.error(`[Queue Error] Failed to handle message in ${jid}:`, err);
      }
    }

    // Remove the processed task
    queue.tasks.shift();

    // Sleep before processing next task to prevent burst spamming
    if (queue.tasks.length > 0) {
      await new Promise((resolve) => setTimeout(resolve, QUEUE_DELAY_MS));
    }
  }

  chatQueues.delete(jid);
}

const MAX_QUEUE_PER_CHAT = 50;

export function enqueueMessage(sock, msg, logger) {
  if (!msg.key || !msg.key.remoteJid) return;

  const jid = msg.key.remoteJid;

  if (!chatQueues.has(jid)) {
    chatQueues.set(jid, {
      tasks: [],
      processing: false,
    });
  }

  const queue = chatQueues.get(jid);
  if (queue.tasks.length >= MAX_QUEUE_PER_CHAT) {
    if (logger) {
      logger.warn(`[Queue Overflow] Chat ${jid} exceeded max queue capacity (${MAX_QUEUE_PER_CHAT}). Dropping oldest task.`);
    }
    queue.tasks.shift();
  }

  queue.tasks.push({ sock, msg });

  // Start processing loop asynchronously
  processQueue(jid, logger).catch((err) => {
    console.error(`[Queue Fatal] Loop crash for ${jid}:`, err);
  });
}
