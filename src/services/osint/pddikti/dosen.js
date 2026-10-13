import { stealthBrowser } from "@/src/utils/request.js";
import { BASE, UA, DETAIL_TTL_MS, detailCache, cacheGet, cacheSet, neat, jkLabel } from "./constants.js";
import { solveTurnstileIfPresent } from "./token.js";
import { searchPddikti } from "./search.js";

export async function detailDosen(encId, { timeoutMs = 45000 } = {}) {
  const id = String(encId ?? "").trim();
  if (!id) throw new Error("id dosen wajib diisi");

  const cacheKey = `dosen:${id}`;
  const cached = cacheGet(detailCache, cacheKey);
  if (cached) return cached;

  const page = await stealthBrowser.newPage();
  try {
    await page.setUserAgent(UA);
    await page.goto(`${BASE}/detail-dosen/${encodeURIComponent(id)}`, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });

    await solveTurnstileIfPresent(page, 10000);

    await page
      .waitForFunction(() => /Biodata Dosen|Tidak ada hasil|notFound/i.test(document.body.innerText), {
        timeout: 20000,
      })
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
    await stealthBrowser.closePage(page);
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

    const norm = (s) =>
      String(s ?? "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "");
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
