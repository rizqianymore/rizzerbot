import { buildScraperHeaders, getRandomDevice } from "@/src/services/network/scrape.js";
import { request } from "@/src/utils/request.js";

const RETRYABLE_STATUS = /HTTP (403|408|425|429|451|5\d\d)/i;

export function buildNewsHeaders(extra = {}) {
  const headers = buildScraperHeaders(getRandomDevice("desktop"), extra);
  delete headers["Cache-Control"];
  delete headers["Pragma"];
  return headers;
}

export async function fetchNewsHtml(url, { extraHeaders = {}, timeout = 25000, attempts = 3 } = {}) {
  return retryNewsRequest(attempts, () =>
    request.text(url, {
      headers: buildNewsHeaders(extraHeaders),
      timeout,
      retries: 3,
      bypassCloudflare: "auto",
    })
  );
}

export async function fetchNewsJson(url, { extraHeaders = {}, timeout = 15000, attempts = 3 } = {}) {
  return retryNewsRequest(attempts, () =>
    request.json(url, {
      headers: buildNewsHeaders(extraHeaders),
      timeout,
      retries: 3,
      bypassCloudflare: "auto",
    })
  );
}

async function retryNewsRequest(attempts, task) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await task();
    } catch (err) {
      lastError = err;
      if (!RETRYABLE_STATUS.test(err?.message || "") || attempt === attempts) throw err;
      await new Promise((resolve) => setTimeout(resolve, 600 * attempt));
    }
  }
  throw lastError;
}
