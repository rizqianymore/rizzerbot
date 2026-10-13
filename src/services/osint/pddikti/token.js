import { stealthBrowser } from "@/src/utils/request.js";
import { BASE, SITEKEY, UA, TOKEN_TIMEOUT_MS } from "./constants.js";

let tokenPagePromise = null;
let tokenLock = Promise.resolve();

export async function solveTurnstileIfPresent(page, timeoutMs = 8000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    const title = (await page.title().catch(() => "")) || "";
    const content = (await page.content().catch(() => "")) || "";

    const hasChallenge =
      title.includes("Just a moment") ||
      title.includes("Attention Required! | Cloudflare") ||
      title.includes("Please Wait... | Cloudflare") ||
      content.includes("cf-turnstile") ||
      content.includes("challenges.cloudflare.com") ||
      content.includes("cf-browser-verification");

    if (!hasChallenge) break;

    try {
      const frames = page.frames();
      for (const frame of frames) {
        const checkbox = await frame
          .$("input[type=checkbox], .cf-turnstile-wrapper, #challenge-stage")
          .catch(() => null);
        if (checkbox) {
          await checkbox.click().catch(() => {});
        }
      }
    } catch (_) {}

    await new Promise((r) => setTimeout(r, 600));
  }
}

async function getTokenPage() {
  if (tokenPagePromise) {
    try {
      const existingPage = await tokenPagePromise;
      if (existingPage && !existingPage.isClosed?.() && existingPage.browser?.()?.connected) {
        return existingPage;
      }
    } catch (_) {}
    tokenPagePromise = null;
  }

  tokenPagePromise = (async () => {
    const page = await stealthBrowser.newPage();
    try {
      await page.setUserAgent(UA);
      await page.goto(`${BASE}/search/Raka`, {
        waitUntil: "domcontentloaded",
        timeout: TOKEN_TIMEOUT_MS,
      });

      await solveTurnstileIfPresent(page);

      await page
        .waitForFunction(() => typeof grecaptcha !== "undefined" && typeof grecaptcha.execute === "function", {
          timeout: 15000,
        })
        .catch(async () => {
          await page.reload({ waitUntil: "domcontentloaded", timeout: TOKEN_TIMEOUT_MS }).catch(() => {});
          await solveTurnstileIfPresent(page);
          await page
            .waitForFunction(() => typeof grecaptcha !== "undefined" && typeof grecaptcha.execute === "function", {
              timeout: 20000,
            })
            .catch(() => {
              throw new Error("grecaptcha tidak termuat (Cloudflare / jaringan bermasalah)");
            });
        });
      return page;
    } catch (err) {
      await stealthBrowser.closePage(page);
      tokenPagePromise = null;
      throw err;
    }
  })().catch((err) => {
    tokenPagePromise = null;
    throw err;
  });

  return tokenPagePromise;
}

function runSerialized(fn) {
  const run = tokenLock.then(fn, fn);
  tokenLock = run.catch(() => {});
  return run;
}

export async function getRecaptchaToken() {
  return runSerialized(async () => {
    const page = await getTokenPage();
    try {
      const token = await page.evaluate(
        (sitekey) =>
          new Promise((resolve, reject) => {
            try {
              const timer = setTimeout(() => reject(new Error("timeout grecaptcha.execute (15 dtk)")), 15000);
              grecaptcha.ready(() => {
                grecaptcha
                  .execute(sitekey, { action: "search" })
                  .then((t) => {
                    clearTimeout(timer);
                    resolve(t);
                  })
                  .catch((e) => {
                    clearTimeout(timer);
                    reject(e);
                  });
              });
            } catch (e) {
              reject(e);
            }
          }),
        SITEKEY
      );
      if (!token || token.length < 100) throw new Error("token reCAPTCHA kosong/pendek");
      return token;
    } catch (err) {
      await stealthBrowser.closePage(page);
      tokenPagePromise = null;
      throw new Error(`Gagal membuat token reCAPTCHA: ${err.message}`);
    }
  });
}

export async function closePddiktiBrowser() {
  try {
    if (tokenPagePromise) {
      const p = await tokenPagePromise.catch(() => null);
      await stealthBrowser.closePage(p);
    }
  } catch (_) {}
  tokenPagePromise = null;
}
