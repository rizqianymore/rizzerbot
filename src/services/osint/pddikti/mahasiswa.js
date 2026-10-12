import { stealthBrowser } from "@/src/utils/request.js";
import { BASE, UA, DETAIL_TTL_MS, detailCache, cacheGet, cacheSet, fetchWithTimeout, neat, formatTanggal, jkLabel } from "./constants.js";
import { getRecaptchaToken, solveTurnstileIfPresent } from "./token.js";
import { searchPddikti } from "./search.js";

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
  const page = await stealthBrowser.newPage();
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
    await stealthBrowser.closePage(page);
  }
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
