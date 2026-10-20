const UA =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";

const BASE = "https://kol.id";
const KINDS = ["instagram", "tiktok", "youtube"];

export class KolIdError extends Error {
  constructor(message, code = "") {
    super(message);
    this.name = "KolIdError";
    this.code = code;
  }
}

function baseHeaders(extra = {}) {
  return {
    "user-agent": UA,
    "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
    accept: "application/json, text/plain, */*",
    ...extra,
  };
}

function extractToken(html) {
  const patterns = [/name="_token"\s+value="([^"]+)"/, /name='_token'\s+value='([^']+)'/, /_token"\s*:\s*"([^"]+)"/];
  for (const re of patterns) {
    const m = String(html || "").match(re);
    if (m?.[1]) return m[1];
  }
  return "";
}

function joinCookies(setCookies) {
  return (setCookies || [])
    .filter(Boolean)
    .map((c) => String(c).split(";")[0].trim())
    .filter(Boolean)
    .join("; ");
}

export async function createSession(kind) {
  if (!KINDS.includes(kind)) throw new KolIdError(`Jenis tidak didukung: ${kind}`);
  const pageUrl = `${BASE}/download-video/${kind}`;
  const pageRes = await fetch(pageUrl, {
    headers: baseHeaders({ accept: "text/html,*/*" }),
    signal: AbortSignal.timeout(20000),
  });
  if (!pageRes.ok) throw new KolIdError(`Halaman kol.id ${kind} balas ${pageRes.status}`, `page_${pageRes.status}`);
  const html = await pageRes.text();
  const rawCookies = pageRes.headers.getSetCookie
    ? pageRes.headers.getSetCookie()
    : String(pageRes.headers.get("set-cookie") || "")
        .split(/,\s*(?=[A-Za-z0-9_-]+=)/)
        .filter(Boolean);
  const cookie = joinCookies(rawCookies);
  const token = extractToken(html);
  if (!token) throw new KolIdError("Gagal mengambil token CSRF kol.id (struktur halaman berubah)", "no_token");
  return { kind, pageUrl, cookie, token };
}

export async function submitJob(kind, targetUrl, session) {
  const s = session || (await createSession(kind));
  const apiUrl = `${BASE}/api/v2/downloader/${kind}`;
  let res;
  try {
    res = await fetch(apiUrl, {
      method: "POST",
      headers: baseHeaders({
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        cookie: s.cookie,
        origin: BASE,
        referer: s.pageUrl,
        "x-requested-with": "XMLHttpRequest",
      }),
      body: new URLSearchParams({ url: String(targetUrl || "").trim(), _token: s.token }).toString(),
      signal: AbortSignal.timeout(30000),
    });
  } catch (err) {
    throw new KolIdError(`Gagal menghubungi kol.id: ${err?.message || err}`, "network");
  }
  let json = null;
  try {
    json = await res.json();
  } catch {
    throw new KolIdError(`Respon kol.id bukan JSON (HTTP ${res.status})`, "bad_json");
  }
  const metaStatus = json?.meta?.status;
  if (metaStatus === "failed" || json?.data?.status === "failed") {
    throw new KolIdError(json?.meta?.message || json?.error?.message || "kol.id menolak URL tersebut", "rejected");
  }
  if ((metaStatus === "ok" || json?.data?.status === "completed") && json?.data) {
    return { done: true, data: json.data, session: s };
  }
  const requestId = json?.data?.request_id;
  if (!requestId) throw new KolIdError(json?.meta?.message || "kol.id tidak mengembalikan request_id", "no_id");
  return {
    done: false,
    requestId,
    pollAfterMs: Math.max(2, Number(json?.data?.poll_after) || 5) * 1000,
    statusUrl: json?.data?.status_url || `${BASE}/api/v2/downloader/status/${requestId}`,
    session: s,
  };
}

export async function pollJob(kind, requestId, session, { timeoutMs = 45000, intervalMs = 0 } = {}) {
  const s = session || (await createSession(kind));
  const statusUrl = `${BASE}/api/v2/downloader/status/${requestId}`;
  const started = Date.now();
  for (;;) {
    if (Date.now() - started > timeoutMs) {
      throw new KolIdError("kol.id terlalu lama memproses (timeout)", "timeout");
    }
    await new Promise((r) => setTimeout(r, intervalMs || 5000));
    let res;
    try {
      res = await fetch(statusUrl, {
        headers: baseHeaders({ cookie: s.cookie, referer: s.pageUrl, "x-requested-with": "XMLHttpRequest" }),
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      continue;
    }
    if (res.status === 404) throw new KolIdError("Request kol.id kedaluwarsa/tidak ditemukan", "expired");
    if (!res.ok) continue;
    let json = null;
    try {
      json = await res.json();
    } catch {
      continue;
    }
    const metaStatus = json?.meta?.status;
    const dataStatus = json?.data?.status;
    if (metaStatus === "ok" || dataStatus === "completed") return json.data;
    if (metaStatus === "failed" || dataStatus === "failed") {
      throw new KolIdError(json?.error?.message || json?.meta?.message || "kol.id gagal memproses URL", "failed");
    }
  }
}

export async function kolIdJob(kind, targetUrl, opts = {}) {
  const submitted = await submitJob(kind, targetUrl, opts.session);
  if (submitted.done) return submitted.data;
  return pollJob(kind, submitted.requestId, submitted.session, {
    timeoutMs: opts.timeoutMs || 45000,
    intervalMs: submitted.pollAfterMs,
  });
}
