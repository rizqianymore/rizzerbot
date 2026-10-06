import { stealthBrowser } from "@/src/utils/request.js";
import { brightDataRequest, getBrightDataConfig } from "@/src/services/brightdata.js";

const BASE = "https://pddikti.kemdiktisaintek.go.id";
const SITEKEY = "6LdqjDstAAAAAMW1whjCNKyvqmPBOIssWETjbLbh";

const UA =
  "Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36";

const TOKEN_TIMEOUT_MS = 30000;
const API_TIMEOUT_MS = 15000;

const SEARCH_TTL_MS = 5 * 60 * 1000;
const DETAIL_TTL_MS = 60 * 60 * 1000;
const searchCache = new Map();
const detailCache = new Map();

function cacheGet(map, key) {
  const hit = map.get(key);
  if (hit && hit.expires > Date.now()) return hit.data;
  map.delete(key);
  return null;
}

function cacheSet(map, key, data, ttl) {
  map.set(key, { data, expires: Date.now() + ttl });
  if (map.size > 300) map.delete(map.keys().next().value);
}

let tokenPagePromise = null;
let tokenLock = Promise.resolve();

async function solveTurnstileIfPresent(page, timeoutMs = 8000) {
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
        const checkbox = await frame.$(
          "input[type=checkbox], .cf-turnstile-wrapper, #challenge-stage"
        ).catch(() => null);
        if (checkbox) {
          await checkbox.click().catch(() => {});
        }
      }
    } catch (_) {}

    await new Promise((r) => setTimeout(r, 600));
  }
}

async function getTokenPage() {
  if (!tokenPagePromise) {
    tokenPagePromise = (async () => {
      const browser = await stealthBrowser.getBrowser();
      const page = await browser.newPage();
      await page.setUserAgent(UA);
      await page.goto(`${BASE}/search/Raka`, {
        waitUntil: "domcontentloaded",
        timeout: TOKEN_TIMEOUT_MS,
      });

      await solveTurnstileIfPresent(page);

      await page
        .waitForFunction(
          () => typeof grecaptcha !== "undefined" && typeof grecaptcha.execute === "function",
          { timeout: 15000 }
        )
        .catch(async () => {
          await page.reload({ waitUntil: "domcontentloaded", timeout: TOKEN_TIMEOUT_MS }).catch(() => {});
          await solveTurnstileIfPresent(page);
          await page
            .waitForFunction(
              () => typeof grecaptcha !== "undefined" && typeof grecaptcha.execute === "function",
              { timeout: 20000 }
            )
            .catch(() => {
              throw new Error("grecaptcha tidak termuat (Cloudflare / jaringan bermasalah)");
            });
        });
      return page;
    })().catch((err) => {
      tokenPagePromise = null;
      throw err;
    });
  }
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
              const timer = setTimeout(
                () => reject(new Error("timeout grecaptcha.execute (15 dtk)")),
                15000
              );
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
      try {
        await page.close().catch(() => {});
      } catch (_) {}
      tokenPagePromise = null;
      throw new Error(`Gagal membuat token reCAPTCHA: ${err.message}`);
    }
  });
}

export async function closePddiktiBrowser() {
  try {
    if (tokenPagePromise) {
      const p = await tokenPagePromise.catch(() => null);
      await p?.close().catch(() => {});
    }
  } catch (_) {}
  tokenPagePromise = null;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = API_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

function mapApiError(status, snippet) {
  if (status === 403) return "Ditolak server PDDikti (403). Token expired — coba lagi.";
  if (status === 429) return "Rate-limit PDDikti (429). Tunggu ±1 menit lalu coba lagi.";
  if (status >= 500) return `Server PDDikti error (HTTP ${status}). Coba lagi nanti.`;
  if (status === 404) return "Endpoint PDDikti tidak ditemukan (404).";
  return `PDDikti HTTP ${status}${snippet ? `: ${snippet.slice(0, 150)}` : ""}`;
}

export async function searchPddikti(keyword, { retries = 2 } = {}) {
  const kw = String(keyword ?? "").trim();
  if (!kw) throw new Error("keyword wajib diisi");
  if (kw.length > 100) throw new Error("keyword terlalu panjang (maks 100 karakter)");

  const cached = cacheGet(searchCache, kw.toLowerCase());
  if (cached) return cached;

  const { apiKey } = getBrightDataConfig();
  const searchUrl = `${BASE}/api/pencarian/enc/all/${encodeURIComponent(kw)}`;

  let lastErr = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const token = await getRecaptchaToken();

      // 1. Direct fetch dengan token
      let data = null;
      try {
        const res = await fetchWithTimeout(searchUrl, {
          headers: {
            Accept: "application/json, text/plain, */*",
            "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
            Referer: `${BASE}/search/${encodeURIComponent(kw)}`,
            "User-Agent": UA,
            "x-recaptcha-token": token,
          },
        });
        if (res.ok) {
          const json = await res.json();
          if (json?.status === "success") {
            data = json.data || {};
          }
        }
      } catch (fetchErr) {
        lastErr = fetchErr;
      }

      // 2. Jika direct fetch gagal atau 403, coba via Bright Data Web Unlocker (jika ada key)
      if (!data && apiKey) {
        try {
          const bdRes = await brightDataRequest(searchUrl, {
            format: "json",
            method: "GET",
            headers: {
              Referer: `${BASE}/search/${encodeURIComponent(kw)}`,
              "x-recaptcha-token": token,
            },
            timeout: 25000,
          });
          if (bdRes?.status === "success") {
            data = bdRes.data || {};
          }
        } catch (_) {}
      }

      // 3. Fallback via inPageFetch di browser (karena browser sudah lolos WAF & Cloudflare)
      if (!data) {
        try {
          const inPageRes = await stealthBrowser.inPageFetch(searchUrl, {
            method: "GET",
            headers: {
              Accept: "application/json, text/plain, */*",
              Referer: `${BASE}/search/${encodeURIComponent(kw)}`,
              "x-recaptcha-token": token,
            },
          });
          if (inPageRes?.status === "success") {
            data = inPageRes.data || {};
          }
        } catch (inPageErr) {
          lastErr = inPageErr;
        }
      }

      if (data) {
        cacheSet(searchCache, kw.toLowerCase(), data, SEARCH_TTL_MS);
        return data;
      }

      throw lastErr || new Error("Gagal mengambil respon pencarian PDDikti");
    } catch (err) {
      lastErr = err;
      if (/403|token|recaptcha/i.test(err.message) && attempt < retries) continue;
      if (
        (err?.name === "AbortError" ||
          /timeout|fetch failed|ECONN|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|socket hang up|net::|ERR_|NETWORK/i.test(
            err.message
          )) &&
        attempt < retries
      ) {
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
        continue;
      }
      break;
    }
  }
  throw lastErr;
}

export async function detailMahasiswa(encId, { timeoutMs = 45000 } = {}) {
  const id = String(encId ?? "").trim();
  if (!id) throw new Error("id mahasiswa wajib diisi");

  const cached = cacheGet(detailCache, id);
  if (cached) return cached;

  // 1. FAST PATH: API POST /api/detail/mhs dengan reCAPTCHA token (~200ms)
  try {
    const token = await getRecaptchaToken();
    const apiUrl = `${BASE}/api/detail/mhs`;
    const res = await fetchWithTimeout(
      apiUrl,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Accept: "application/json, text/plain, */*",
          "x-recaptcha-token": token,
          Referer: `${BASE}/detail-mahasiswa/${encodeURIComponent(id)}`,
          Origin: BASE,
          "User-Agent": UA,
        },
        body: JSON.stringify({ id }),
      },
      12000
    );

    if (res.ok) {
      const json = await res.json();
      if (json?.status === "success" && json?.data) {
        const d = json.data;
        const [jenjang = "", prodi = ""] = String(d.prodi || "").includes("-")
          ? String(d.prodi).split("-").map((s) => s.trim())
          : [d.jenjang || "-", d.prodi || "-"];
        const jkRaw = String(d.jenis_kelamin || "").toLowerCase();
        const data = {
          nama: neat(d.nama),
          nim: neat(d.nim),
          nama_pt: neat(d.nama_pt),
          jenjang: neat(d.jenjang || jenjang),
          prodi: neat(d.prodi || prodi),
          jenis_kelamin: /perempuan/i.test(jkRaw) ? "P" : /laki/i.test(jkRaw) ? "L" : neat(d.jenis_kelamin),
          tanggal_masuk: neat(d.tanggal_masuk),
          jenis_daftar: neat(d.jenis_daftar),
          status_saat_ini: neat(d.status_saat_ini),
        };
        cacheSet(detailCache, id, data, DETAIL_TTL_MS);
        return data;
      }
    }
  } catch (_) {
    // Lanjut ke fallback
  }

  // 2. Fallback via inPageFetch
  try {
    const token = await getRecaptchaToken();
    const inPageRes = await stealthBrowser.inPageFetch(`${BASE}/api/detail/mhs`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-recaptcha-token": token,
        Referer: `${BASE}/detail-mahasiswa/${encodeURIComponent(id)}`,
        Origin: BASE,
      },
      body: { id },
    });
    if (inPageRes?.status === "success" && inPageRes?.data) {
      const d = inPageRes.data;
      const data = {
        nama: neat(d.nama),
        nim: neat(d.nim),
        nama_pt: neat(d.nama_pt),
        jenjang: neat(d.jenjang),
        prodi: neat(d.prodi),
        jenis_kelamin: neat(d.jenis_kelamin),
        tanggal_masuk: neat(d.tanggal_masuk),
        jenis_daftar: neat(d.jenis_daftar),
        status_saat_ini: neat(d.status_saat_ini),
      };
      cacheSet(detailCache, id, data, DETAIL_TTL_MS);
      return data;
    }
  } catch (_) {}

  // 3. Fallback via stealth browser DOM rendering
  const browser = await stealthBrowser.getBrowser();
  const page = await browser.newPage();
  try {
    await page.setUserAgent(UA);
    await page.goto(`${BASE}/detail-mahasiswa/${encodeURIComponent(id)}`, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });

    await solveTurnstileIfPresent(page, 10000);

    await page
      .waitForFunction(
        () => /Biodata Mahasiswa|Tidak ada hasil|notFound/i.test(document.body.innerText),
        { timeout: 20000 }
      )
      .catch(() => {});
    await new Promise((r) => setTimeout(r, 2000));

    const raw = await page.evaluate(() => {
      const text = document.body.innerText || "";
      const get = (label) => {
        const re = new RegExp(label + "\\s*\\n+\\s*([^\\n]+)", "i");
        const m = text.match(re);
        return m ? m[1].trim() : "";
      };
      return {
        nama: get("Nama"),
        nama_pt: get("Perguruan Tinggi"),
        jenis_kelamin_raw: get("Jenis Kelamin"),
        tanggal_masuk_raw: get("Tanggal Masuk"),
        nim: get("NIM"),
        jenjang_prodi_raw: get("Jenjang - Program Studi"),
        jenis_daftar: get("Status Awal Mahasiswa"),
        status_saat_ini: get("Status Terakhir Mahasiswa"),
      };
    });

    if (!raw.nim && !raw.nama) throw new Error("halaman detail tidak memuat biodata (mungkin ID expired)");

    const [jenjang = "", prodi = ""] = String(raw.jenjang_prodi_raw || "")
      .split("-")
      .map((s) => s.trim());
    const jkRaw = String(raw.jenis_kelamin_raw || "").toLowerCase();
    const data = {
      nama: raw.nama,
      nim: raw.nim,
      nama_pt: raw.nama_pt,
      jenjang: jenjang || "-",
      prodi: prodi || raw.jenjang_prodi_raw || "-",
      jenis_kelamin: /perempuan/i.test(jkRaw) ? "P" : /laki/i.test(jkRaw) ? "L" : raw.jenis_kelamin_raw,
      tanggal_masuk: raw.tanggal_masuk_raw,
      jenis_daftar: raw.jenis_daftar,
      status_saat_ini: raw.status_saat_ini,
    };
    cacheSet(detailCache, id, data, DETAIL_TTL_MS);
    return data;
  } finally {
    await page.close().catch(() => {});
  }
}

function neat(v) {
  return String(v ?? "").trim() || "-";
}

function formatTanggal(tgl) {
  const s = String(tgl ?? "").trim();
  if (!s || s === "-") return "-";
  if (/^\d{1,2}\s+[A-Za-z]+\s+\d{4}/.test(s)) return s;
  try {
    const d = new Date(s.length <= 10 ? `${s}T00:00:00` : s);
    if (isNaN(d.getTime())) return s;
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return s;
  }
}

function jkLabel(jk) {
  const s = String(jk ?? "").trim().toUpperCase();
  if (s === "L") return "Laki-laki";
  if (s === "P") return "Perempuan";
  return neat(jk);
}

export function formatMhsDetail(d) {
  const nim = neat(d.nim);
  const lines = [];
  lines.push(`*DATA MAHASISWA (PDDikti)*`);
  lines.push(`Nama: ${neat(d.nama)}`);
  lines.push(`NIM: ${nim}`);
  lines.push(`PT: ${neat(d.nama_pt)}`);
  lines.push(`Prodi: ${neat(d.jenjang)} - ${neat(d.prodi)}`);
  lines.push(`JK: ${jkLabel(d.jenis_kelamin)}`);
  lines.push(`Tgl Masuk: ${formatTanggal(d.tanggal_masuk)}`);
  lines.push(`Status Awal: ${neat(d.jenis_daftar)}`);
  lines.push(`Status: ${neat(d.status_saat_ini)}`);
  return lines.join("\n");
}

export function formatMhsList(rows, total) {
  const shown = rows.slice(0, 10);
  const out = [`*HASIL PDDikti (${total} mahasiswa, tampil ${shown.length})*`, ``];
  shown.forEach((m, i) => {
    out.push(`${i + 1}. *${neat(m.nama)}* — ${neat(m.nim)}`);
    out.push(`   ${neat(m.nama_pt)} | ${neat(m.nama_prodi)}`);
  });
  out.push(``, `Detail: \`.ceknim <nim>\` (cth: \`.ceknim ${neat(rows[0]?.nim)}\`)`);
  return out.join("\n");
}

export async function getCeknimInfoText(input, opts = {}) {
  const raw = String(input ?? "").trim();
  if (!raw) return { error: "input kosong" };
  if (raw.length > 100) return { error: "input terlalu panjang (maks 100 karakter)" };

  try {
    const data = await searchPddikti(raw);
    const mhs = Array.isArray(data?.mahasiswa) ? data.mahasiswa : [];
    if (mhs.length === 0) {
      return { error: `Data mahasiswa "${raw}" tidak ditemukan di PDDikti.` };
    }

    const norm = (s) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, "");
    const exact = mhs.find((m) => norm(m.nim) === norm(raw));

    if (exact?.id) {
      try {
        const detail = await detailMahasiswa(exact.id);
        return { text: formatMhsDetail(detail || exact) };
      } catch (err) {
        opts?.logger?.warn?.(`[ceknim] detail gagal nim=${exact.nim}: ${err.message}`);
        const lines = [
          `*DATA MAHASISWA (PDDikti)*`,
          `Nama: ${neat(exact.nama)}`,
          `NIM: ${neat(exact.nim)}`,
          `PT: ${neat(exact.nama_pt)}`,
          `Prodi: ${neat(exact.nama_prodi)}`,
          ``,
          `_Detail lengkap gagal dimuat: ${err.message}_`,
        ];
        return { text: lines.join("\n") };
      }
    }

    if (mhs.length === 1 && mhs[0]?.id) {
      try {
        const detail = await detailMahasiswa(mhs[0].id);
        return { text: formatMhsDetail(detail || mhs[0]) };
      } catch (_) {}
    }

    return { text: formatMhsList(mhs, mhs.length) };
  } catch (err) {
    opts?.logger?.warn?.(`[ceknim] gagal keyword=${raw}: ${err.message}`);
    if (err?.name === "AbortError") return { error: "Timeout menghubungi PDDikti (15 dtk). Coba lagi." };
    return { error: `Gagal mengambil data PDDikti: ${err.message}` };
  }
}

export async function detailDosen(encId, { timeoutMs = 45000 } = {}) {
  const id = String(encId ?? "").trim();
  if (!id) throw new Error("id dosen wajib diisi");

  const cacheKey = `dosen:${id}`;
  const cached = cacheGet(detailCache, cacheKey);
  if (cached) return cached;

  const browser = await stealthBrowser.getBrowser();
  const page = await browser.newPage();
  try {
    await page.setUserAgent(UA);
    await page.goto(`${BASE}/detail-dosen/${encodeURIComponent(id)}`, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });

    await solveTurnstileIfPresent(page, 10000);

    await page
      .waitForFunction(
        () => /Biodata Dosen|Tidak ada hasil|notFound/i.test(document.body.innerText),
        { timeout: 20000 }
      )
      .catch(() => {});
    await new Promise((r) => setTimeout(r, 2000));

    const raw = await page.evaluate(() => {
      const text = document.body.innerText || "";
      const get = (label) => {
        const re = new RegExp(label + "\\s*\\n+\\s*([^\\n]+)", "i");
        const m = text.match(re);
        return m ? m[1].trim() : "";
      };
      return {
        nama: get("Nama"),
        jenis_kelamin_raw: get("Jenis Kelamin"),
        nama_pt: get("Perguruan Tinggi"),
        nama_prodi: get("Program Studi"),
        jabatan: get("Jabatan Fungsional"),
        pendidikan: get("Pendidikan Terakhir"),
      };
    });

    if (!raw.nama) throw new Error("halaman detail tidak memuat biodata (mungkin ID expired)");

    const jkRaw = String(raw.jenis_kelamin_raw || "").toLowerCase();
    const data = {
      nama: raw.nama,
      jenis_kelamin: /perempuan/i.test(jkRaw) ? "P" : /laki/i.test(jkRaw) ? "L" : raw.jenis_kelamin_raw,
      nama_pt: raw.nama_pt,
      nama_prodi: raw.nama_prodi,
      jabatan: raw.jabatan,
      pendidikan: raw.pendidikan,
    };
    cacheSet(detailCache, cacheKey, data, DETAIL_TTL_MS);
    return data;
  } finally {
    await page.close().catch(() => {});
  }
}

export function formatDosenDetail(d, nidn) {
  const lines = [];
  lines.push(`*DATA DOSEN (PDDikti)*`);
  lines.push(`Nama: ${neat(d.nama)}`);
  if (nidn) lines.push(`NIDN: ${neat(nidn)}`);
  lines.push(`PT: ${neat(d.nama_pt)}`);
  lines.push(`Prodi: ${neat(d.nama_prodi)}`);
  lines.push(`JK: ${jkLabel(d.jenis_kelamin)}`);
  lines.push(`Jabatan: ${neat(d.jabatan)}`);
  lines.push(`Pendidikan: ${neat(d.pendidikan)}`);
  return lines.join("\n");
}

export function formatDosenList(rows, total) {
  const shown = rows.slice(0, 10);
  const out = [`*HASIL PDDikti (${total} dosen, tampil ${shown.length})*`, ``];
  shown.forEach((m, i) => {
    out.push(`${i + 1}. *${neat(m.nama)}* — ${neat(m.nidn)}`);
    out.push(`   ${neat(m.nama_pt)} | ${neat(m.nama_prodi)}`);
  });
  out.push(``, `Detail: \`.cekdosen <nidn>\` (cth: \`.cekdosen ${neat(rows[0]?.nidn)}\`)`);
  return out.join("\n");
}

export async function getCekdosenInfoText(input, opts = {}) {
  const raw = String(input ?? "").trim();
  if (!raw) return { error: "input kosong" };
  if (raw.length > 100) return { error: "input terlalu panjang (maks 100 karakter)" };

  try {
    const data = await searchPddikti(raw);
    const dosen = Array.isArray(data?.dosen) ? data.dosen : [];
    if (dosen.length === 0) {
      return { error: `Data dosen "${raw}" tidak ditemukan di PDDikti.` };
    }

    const norm = (s) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, "");
    const exact = dosen.find((m) => norm(m.nidn) === norm(raw));

    if (exact?.id) {
      try {
        const detail = await detailDosen(exact.id);
        return { text: formatDosenDetail(detail || exact, exact.nidn) };
      } catch (err) {
        opts?.logger?.warn?.(`[cekdosen] detail gagal nidn=${exact.nidn}: ${err.message}`);
        const lines = [
          `*DATA DOSEN (PDDikti)*`,
          `Nama: ${neat(exact.nama)}`,
          `NIDN: ${neat(exact.nidn)}`,
          `PT: ${neat(exact.nama_pt)}`,
          `Prodi: ${neat(exact.nama_prodi)}`,
          ``,
          `_Detail lengkap gagal dimuat: ${err.message}_`,
        ];
        return { text: lines.join("\n") };
      }
    }

    if (dosen.length === 1 && dosen[0]?.id) {
      try {
        const detail = await detailDosen(dosen[0].id);
        return { text: formatDosenDetail(detail || dosen[0], dosen[0].nidn) };
      } catch (_) {}
    }

    return { text: formatDosenList(dosen, dosen.length) };
  } catch (err) {
    opts?.logger?.warn?.(`[cekdosen] gagal keyword=${raw}: ${err.message}`);
    if (err?.name === "AbortError") return { error: "Timeout menghubungi PDDikti (15 dtk). Coba lagi." };
    return { error: `Gagal mengambil data PDDikti: ${err.message}` };
  }
}
