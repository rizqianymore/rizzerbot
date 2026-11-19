const MAX_CONCURRENT = Math.max(1, Number(process.env.AI_MAX_CONCURRENT) || 2);
const MAX_QUEUE = Math.max(1, Number(process.env.AI_MAX_QUEUE) || 20);

let active = 0;
const queue = [];

function next() {
  if (active >= MAX_CONCURRENT) return;
  const item = queue.shift();
  if (!item) return;
  active++;
  item
    .run()
    .then(item.resolve, item.reject)
    .finally(() => {
      active--;
      next();
    });
}

export function queueStats() {
  return { active, queued: queue.length, maxConcurrent: MAX_CONCURRENT, maxQueue: MAX_QUEUE };
}

/**
 * Semua panggilan AI keluar lewat satu pintu supaya kuota free-tier tidak saling membakar.
 * @template T
 * @param {() => Promise<T>} fn
 * @param {number} [waitMs]
 * @returns {Promise<T>}
 */
export function runQueued(fn, waitMs = 45000) {
  return new Promise((resolve, reject) => {
    if (queue.length >= MAX_QUEUE) {
      reject(new Error("Antrean AI penuh, coba lagi sebentar."));
      return;
    }
    const entry = { run: fn, resolve, reject };
    queue.push(entry);
    if (waitMs > 0) {
      setTimeout(() => {
        const idx = queue.indexOf(entry);
        if (idx !== -1) {
          queue.splice(idx, 1);
          reject(new Error("Waktu tunggu antrean AI habis."));
        }
      }, waitMs).unref?.();
    }
    next();
  });
}

export default { runQueued, queueStats };
