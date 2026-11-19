#!/usr/bin/env node
/** Self-check jalur AI: registry, cache, queue, memory, chunking, dan satu request live. */
let failures = 0;
const ok = (c, label, extra = "") => {
  if (c) console.log(`  OK   ${label}`);
  else {
    failures++;
    console.log(`  FAIL ${label}${extra ? ` — ${extra}` : ""}`);
  }
};

const { normalizeSource, getAIStatus, listSources, AI_SOURCES } = await import("../src/services/ai/router.js");
const { splitChunks, stripThink, buildMessages } = await import("../src/services/ai/util.js");
const { cacheGet, cacheSet, cacheStats, cacheClear } = await import("../src/services/ai/cache.js");
const { runQueued, queueStats } = await import("../src/services/ai/queue.js");
const mem = await import("../src/services/ai/memory.js");

console.log("[1/6] Registry & alias");
ok(Object.keys(AI_SOURCES).length >= 8, `registry berisi ${Object.keys(AI_SOURCES).length} engine`);
ok(normalizeSource("OC") === "opencode", "alias case-insensitive oc -> opencode");
ok(normalizeSource("llama") === "meta", "alias llama -> meta");
ok(normalizeSource("ngawur") === null, "alias tak dikenal -> null");
const list = listSources();
ok(list.every((s) => typeof s.ready === "boolean"), "listSources melaporkan readiness");
const st = getAIStatus();
ok(!st.r1.includes("siap"), "scraper R1 ditandai nonaktif saat node down", st.r1);

console.log("[2/6] Util teks");
const long = "kata ".repeat(1200);
const parts = splitChunks(long, 1000);
ok(parts.length > 1 && parts.every((p) => p.length <= 1000), `splitChunks ${parts.length} bagian <=1000 char`);
ok(parts.join(" ").replace(/\s+/g, " ").length === long.trim().replace(/\s+/g, " ").length, "isi tidak hilang saat split");
ok(stripThink("a<think>rahasia</think>b") === "ab", "stripThink membuang blok reasoning");
ok(buildMessages("hi", { history: [{ role: "user", content: "x" }] }).length === 3, "buildMessages menyertakan history");

console.log("[3/6] Cache");
cacheClear();
cacheSet("tes prompt", { prefer: "pollinations" }, { text: "jawaban" });
ok(cacheGet("tes prompt", { prefer: "pollinations" })?.text === "jawaban", "cache hit pada key sama");
ok(cacheGet("tes prompt", { prefer: "groq" }) === null, "cache miss saat prefer beda");
ok(cacheStats().live === 1, "cacheStats menghitung entri hidup");

console.log("[4/6] Queue");
const order = [];
const jobs = Array.from({ length: 5 }, (_, i) =>
  runQueued(async () => {
    order.push(i);
    await new Promise((r) => setTimeout(r, 20));
    return i;
  })
);
const res = await Promise.all(jobs);
ok(res.join(",") === "0,1,2,3,4", "semua job antrean selesai");
ok(queueStats().queued === 0 && queueStats().active === 0, "antrean kosong setelah selesai");
await runQueued(() => Promise.reject(new Error("gagal"))).catch(() => {});
ok(queueStats().active === 0, "slot dilepas walau job melempar error");

console.log("[5/6] Memory");
mem.clearHistory("global");
mem.pushTurn("global", "halo", "hai");
mem.pushTurn("global", "siapa kamu", "bot");
ok(mem.getHistory("global").length === 4, "pushTurn menyimpan 2 turn");
for (let i = 0; i < 20; i++) mem.pushTurn("global", `q${i}`, `a${i}`);
ok(mem.getHistory("global").length <= 20, "memori dipangkas ke batas turn");
ok(mem.clearHistory("global") === true, "clearHistory mengosongkan bucket");
ok(mem.getHistory("global").length === 0, "riwayat kosong setelah clear");
const s = mem.memoryStats();
ok(typeof s.buckets === "number", `memoryStats ${JSON.stringify(s)}`);

console.log("[6/6] Request live lewat gateway (fallback otomatis)");
const { askAI } = await import("../src/services/ai/router.js");
try {
  const r = await askAI("Jawab satu kata: halo", { timeoutMs: 40000 });
  ok(Boolean(r.text), `jawaban diterima dari ${r.source}`, r.text.slice(0, 60));
  ok(Array.isArray(r.attempts), `jumlah percobaan: ${r.attempts.length} (${r.attempts.map((a) => a.source + ":" + (a.code || a.skipped)).join(", ") || "langsung sukses"})`);
} catch (err) {
  console.log(`  SKIP request live gagal (lingkungan tanpa jaringan/kuota): ${err.message.slice(0, 120)}`);
}

console.log(failures === 0 ? "\nAI SELF-CHECK OK" : `\nAI SELF-CHECK GAGAL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
