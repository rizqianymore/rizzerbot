#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, "..");
const APPLY = process.argv.includes("--apply");

let failures = 0;
function ok(cond, label, extra = "") {
  if (cond) console.log(`  OK   ${label}`);
  else {
    failures++;
    console.log(`  FAIL ${label}${extra ? ` — ${extra}` : ""}`);
  }
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.isFile() && e.name.endsWith(".js") && !e.name.startsWith("_")) out.push(p);
  }
  return out;
}

console.log(APPLY ? "[fast-nonbug] mode APPLY" : "[fast-nonbug] mode DRY-RUN (tambah --apply untuk ubah DB)");

console.log("[1/3] Konstanta jalur panas non-bug...");
const queueSrc = fs.readFileSync(path.join(ROOT, "src/core/queue.js"), "utf8");
ok(/const QUEUE_DELAY_MS = 0/.test(queueSrc), "QUEUE_DELAY_MS = 0 (tanpa jeda antrean)");
ok(/MAX_CONCURRENT_PER_CHAT = 3/.test(queueSrc), "MAX_CONCURRENT_PER_CHAT = 3 (tidak serial)");
const execSrc = fs.readFileSync(path.join(ROOT, "src/core/dispatch/execute.js"), "utf8");
ok(/responseDelay/.test(execSrc), "reply menghormati responseDelay (0 = langsung kirim)");
const kaSrc = fs.readFileSync(path.join(ROOT, "src/core/connection/keepalive.js"), "utf8");
ok(/sendPresenceUpdate\?.\("available"\)/.test(kaSrc), "heartbeat presence available ada (stay-on saat idle)");
const startSrc = fs.readFileSync(path.join(ROOT, "src/core/connection/start.js"), "utf8");
ok(/startKeepAlive\(sock/.test(startSrc), "keepalive dipasang saat koneksi start");
ok(/keepAliveStop\?\.?\(\)/.test(startSrc), "keepalive lama dihentikan saat restart (tanpa dobel timer)");

console.log("[2/3] Scan delay buatan di plugin non-bug (plugins/bug dikecualikan)...");
const files = walk(path.join(ROOT, "plugins")).filter((f) => !f.includes(`${path.sep}bug${path.sep}`));
const hits = [];
const FUNCTIONAL_FILES = new Set([
  "plugins/ai/dream.js",
  "plugins/osint/sipil/ceknakes.js",
  "plugins/socialmedia/igdl.js",
  "plugins/tools/util/sandbox.js",
  "plugins/user/sewa.js",
]);
for (const f of files) {
  const rel = path.relative(ROOT, f);
  const src = fs.readFileSync(f, "utf8");
  const lines = src.split("\n");
  lines.forEach((line, i) => {
    if (/sleep\s*\(|setTimeout|QUEUE_DELAY_MS|responseDelay|cooldown/i.test(line)) {
      const t = line.trim().slice(0, 100);
      const fungsional =
        FUNCTIONAL_FILES.has(rel) ||
        /abort|Abort|poll|sample|render|restart|resetdb|probe|captur|status|credit|throttle/i.test(`${rel} ${line}`);
      hits.push({ file: rel, line: i + 1, text: t, fungsional });
    }
  });
}
const buatan = hits.filter((h) => !h.fungsional);
ok(
  buatan.length === 0,
  `tanpa delay buatan di ${files.length} file non-bug`,
  buatan.map((h) => `${h.file}:${h.line}`).join("; ")
);
for (const h of hits.filter((h) => h.fungsional)) {
  console.log(`  INFO [fungsional, dibiarkan] ${h.file}:${h.line} — ${h.text}`);
}

console.log("[3/3] Setting database...");
if (!APPLY) {
  console.log(
    "  SKIP ubah DB (dry-run). Jalankan dengan --apply untuk set responseDelay=0, cooldownTime=0, autoOnline=true."
  );
} else {
  const { db } = await import("@/src/core/database.js");
  const before = db.getSettings();
  console.log(
    `  INFO sebelum: responseDelay=${before.responseDelay} cooldownTime=${before.cooldownTime} autoOnline=${before.autoOnline}`
  );
  const after = db.updateSettings({ responseDelay: 0, cooldownTime: 0, autoOnline: true });
  console.log(
    `  INFO sesudah: responseDelay=${after.responseDelay} cooldownTime=${after.cooldownTime} autoOnline=${after.autoOnline}`
  );
  ok(
    Number(after.responseDelay) === 0 && Number(after.cooldownTime) === 0 && after.autoOnline === true,
    "DB fast-mode aktif (0/0/true)"
  );
}

console.log(failures === 0 ? "FAST-NONBUG OK" : `FAST-NONBUG GAGAL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
