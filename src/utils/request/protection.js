const CLEARANCE_COOKIES = [
  "cf_clearance",
  "__cf_bm",
  "incap_ses_",
  "visid_incap",
  "datadome",
  "_abck",
  "ak_bmsc",
  "sucuri_cloudproxy",
];

function normHeaders(headers = {}) {
  const out = {};
  for (const [k, v] of Object.entries(headers || {})) {
    out[String(k).toLowerCase()] = Array.isArray(v) ? v.join("; ") : String(v ?? "");
  }
  return out;
}

export function detectProtection({ status = 0, headers = {}, html = "", title = "", url: _url = "" } = {}) {
  const h = normHeaders(headers);
  const hBlob = Object.entries(h)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n")
    .toLowerCase();
  const body = String(html || "").toLowerCase();
  const head = String(title || "").toLowerCase();
  const has = (...needles) => needles.some((n) => body.includes(n) || head.includes(n) || hBlob.includes(n));

  if (
    has("challenges.cloudflare.com/turnstile", "cf-turnstile", "data-sitekey") &&
    (head.includes("just a moment") ||
      head.includes("attention required") ||
      head.includes("please wait") ||
      body.includes("verifying you are human"))
  ) {
    return { type: "cloudflare-turnstile", confidence: "high" };
  }
  if (
    hBlob.includes("cf-ray") ||
    hBlob.includes("cf-mitigated") ||
    hBlob.includes("server: cloudflare") ||
    head.includes("just a moment...") ||
    has(
      "window._cf_chl_opt",
      "cf-browser-verification",
      "checking your browser before accessing",
      "attention required! | cloudflare",
      "please wait... | cloudflare"
    )
  ) {
    return { type: "cloudflare-challenge", confidence: "high" };
  }
  if (has("safeline", "doonsec", "rejected by safe line", "waf blocked", "safeline-waf")) {
    return { type: "safeline", confidence: "high" };
  }
  if (
    hBlob.includes("incap_ses_") ||
    hBlob.includes("visid_incap") ||
    hBlob.includes("x-iinfo") ||
    has("incapsula", "_incapsula_resource", "request unsuccessful. incapsula")
  ) {
    return { type: "incapsula", confidence: "high" };
  }
  if (hBlob.includes("datadome") || has("datadome", "geo.captcha-delivery.com", "captcha-delivery.com")) {
    return { type: "datadome", confidence: "high" };
  }
  if (has("window._pxapp", "_px3", "px-captcha", "perimeterx")) {
    return { type: "perimeterx", confidence: "high" };
  }
  if (hBlob.includes("_abck") || hBlob.includes("ak_bmsc") || has("akamai", "_abck", "bmak", "sensor_data")) {
    return { type: "akamai", confidence: "medium" };
  }
  if (hBlob.includes("sucuri") || head.includes("sucuri") || has("sucuri_cloudproxy")) {
    return { type: "sucuri", confidence: "high" };
  }
  if (has("ddos-guard", "ddos_guard", "check.ddos-guard.net")) {
    return { type: "ddos-guard", confidence: "high" };
  }

  const blockedStatus = [401, 403, 406, 418, 503].includes(Number(status));
  if (
    blockedStatus &&
    has(
      "grecaptcha",
      "recaptcha",
      "hcaptcha",
      "turnstile",
      "captcha",
      "are you human",
      "verify you are human",
      "access denied",
      "forbidden"
    )
  ) {
    return { type: "generic-captcha", confidence: "medium" };
  }

  if (Number(status) === 429 || (hBlob.includes("retry-after") && has("rate limit", "too many requests"))) {
    return { type: "rate-limit", confidence: "medium" };
  }

  return { type: "none", confidence: "high" };
}

export function hasClearanceCookie(cookies = []) {
  const names = (cookies || []).map((c) => String(c?.name || "").toLowerCase());
  return CLEARANCE_COOKIES.some((marker) => names.some((n) => n === marker || n.startsWith(marker)));
}

export function isSolvableType(type) {
  return [
    "cloudflare-turnstile",
    "cloudflare-challenge",
    "safeline",
    "incapsula",
    "datadome",
    "perimeterx",
    "sucuri",
    "ddos-guard",
    "generic-captcha",
  ].includes(type);
}

const customHandlers = [];

export function registerProtectionHandler(matchHost, handler) {
  if (typeof handler !== "function") throw new Error("handler harus function");
  customHandlers.push({ matchHost: String(matchHost).toLowerCase(), handler });
  return () => {
    const idx = customHandlers.findIndex((e) => e.handler === handler);
    if (idx >= 0) customHandlers.splice(idx, 1);
  };
}

export function findCustomHandler(host) {
  const h = String(host || "").toLowerCase();
  return customHandlers.find((e) => h === e.matchHost || h.endsWith(`.${e.matchHost}`)) || null;
}

async function clickVisibleCheckbox(page) {
  // Selector target yang mencakup Turnstile, Cloudflare Challenge, reCAPTCHA, hCaptcha, Safelink verify button, dll.
  const targets = [
    'iframe[src*="challenges.cloudflare.com"]',
    ".cf-turnstile iframe",
    'iframe[src*="captcha-delivery.com"]',
    'iframe[src*="recaptcha"]',
    'iframe[src*="hcaptcha"]',
    'input[type="checkbox"]',
    'button[id*="verify"]',
    'button[class*="verify"]',
    'button[id*="challenge"]',
    'button[class*="challenge"]',
    'button[id*="captcha"]',
    'button[class*="captcha"]',
    'button[id*="download"]',
    'button[id*="btn-download"]',
    'a[id*="download"]',
    '#cf-stage input[type="button"]',
    '#challenge-stage input[type="button"]',
    '#challenge-stage button',
  ];
  for (const frame of page.frames()) {
    for (const sel of targets) {
      let el = null;
      try {
        el = await frame.$(sel);
      } catch (_) { }
      if (!el) continue;
      try {
        const isVisible = await frame.evaluate((node) => {
          if (!node) return false;
          const style = window.getComputedStyle(node);
          return (
            style &&
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            style.opacity !== "0" &&
            !node.disabled
          );
        }, el).catch(() => false);

        if (!isVisible) continue;

        const box = await el.boundingBox();
        if (!box || box.width < 2 || box.height < 2) continue;

        const frameUrl = typeof frame.url === "function" ? frame.url() : "";
        const isTurnstileFrame = frameUrl.includes("challenges.cloudflare.com") || sel.includes("cloudflare");

        let targetX = box.x + box.width / 2;
        let targetY = box.y + box.height / 2;

        if (isTurnstileFrame && box.width > 120) {
          // Checkbox Cloudflare Turnstile berada di sisi kiri (sekitar 28px)
          targetX = box.x + 28 + (Math.random() * 6 - 3);
          targetY = box.y + box.height / 2 + (Math.random() * 6 - 3);
        } else {
          const jitterX = (Math.random() - 0.5) * Math.min(10, box.width * 0.2);
          const jitterY = (Math.random() - 0.5) * Math.min(10, box.height * 0.2);
          targetX += jitterX;
          targetY += jitterY;
        }

        await el.scrollIntoViewIfNeeded?.().catch(() => { });
        await page.mouse.move(targetX - 40 - Math.random() * 20, targetY - 20 - Math.random() * 15, { steps: 3 }).catch(() => { });
        await page.mouse.move(targetX, targetY, { steps: 5 }).catch(() => { });
        await new Promise((r) => setTimeout(r, 60 + Math.floor(Math.random() * 40)));
        await page.mouse.click(targetX, targetY, { delay: 40 + Math.floor(Math.random() * 40) }).catch(() => { });
        await el.evaluate((node) => node.click?.()).catch(() => { });
        return true;
      } catch (_) { }
    }

    try {
      const clickedByText = await frame.evaluate(() => {
        const candidates = Array.from(document.querySelectorAll("button, a, div[role='button'], input[type='button']"));
        const regex = /i am human|verify you are human|verifikasi|saya manusia|i'm not a robot|saya bukan robot|click to continue|lanjutkan/i;
        for (const btn of candidates) {
          const text = (btn.innerText || btn.textContent || btn.value || "").trim();
          if (regex.test(text)) {
            const style = window.getComputedStyle(btn);
            if (style && style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0") {
              btn.click();
              return true;
            }
          }
        }
        return false;
      });
      if (clickedByText) return true;
    } catch (_) { }
  }
  return false;
}

export async function waitForClearance(page, { timeoutMs = 25000, clickCheckbox = true } = {}) {
  const start = Date.now();
  let lastType = "none";
  let lastSig = "";
  let stableHits = 0;
  let reloaded = false;
  let clicked = false;

  let tick = 0;
  while (Date.now() - start < timeoutMs) {
    tick++;
    const title = (await page.title().catch(() => "")) || "";
    let html = "";
    if (tick === 1 || tick % 2 === 0) {
      html = (await page.content().catch(() => "")) || "";
    }

    const det = detectProtection({ status: 0, headers: {}, html, title });
    lastType = det.type;

    if (det.type === "none") {
      stableHits++;
      if (stableHits >= 2) {
        let cookies = [];
        try {
          cookies = await page.cookies();
        } catch (_) { }
        return {
          cleared: true,
          type: "none",
          waitedMs: Date.now() - start,
          hasClearanceCookie: hasClearanceCookie(cookies),
        };
      }
    } else {
      stableHits = 0;
    }

    if (html) {
      const sig = `${title.length}:${html.length}:${html.slice(0, 200)}`;
      const stuck = sig === lastSig;
      lastSig = sig;

      if (clickCheckbox && !clicked && /turnstile|captcha|checkbox|verify/i.test(`${title} ${html.slice(0, 4000)}`)) {
        clicked = await clickVisibleCheckbox(page);
      }

      const elapsed = Date.now() - start;
      if (!reloaded && stuck && elapsed > timeoutMs / 2) {
        reloaded = true;
        try {
          await page
            .reload({ waitUntil: "domcontentloaded", timeout: Math.min(15000, timeoutMs - elapsed) })
            .catch(() => { });
        } catch (_) { }
        clicked = false;
      }
    }

    // Polling adaptif: 200ms di awal, bertahap hingga 400ms agar respon clearance cepat
    const sleepMs = tick < 5 ? 200 : tick < 10 ? 300 : 400;
    await new Promise((r) => setTimeout(r, sleepMs));
  }

  return { cleared: false, type: lastType, waitedMs: Date.now() - start, hasClearanceCookie: false };
}
