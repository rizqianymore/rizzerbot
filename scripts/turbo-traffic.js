#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

let failures = 0;
function ok(cond, label, extra = "") {
  if (cond) console.log(`  OK   ${label}`);
  else {
    failures++;
    console.log(`  FAIL ${label}${extra ? ` — ${extra}` : ""}`);
  }
}

const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

console.log("[turbo-traffic] audit trafik & latency...");

console.log("[1/4] HTTP reuse + retry...");
const client = read("src/utils/request/client.js");
ok(/keepAlive:\s*true/.test(client), "HTTP keep-alive aktif (tanpa handshake ulang per request)");
ok(/maxSockets:\s*20/.test(client), "connection pool maxSockets=20");
ok(/TRANSIENT_STATUS/.test(client) && /800 \* attempt/.test(client), "retry + backoff untuk status transien");
ok(/inflight\.has\(key\)/.test(client), "dedup singleflight GET identik (hemat trafik duplikat)");

console.log("[2/4] Latency observability...");
const exec = read("src/core/dispatch/execute.js");
ok(/SlowCommand/.test(exec), "perintah lambat dicatat ke log (cari biang latency)");
const ka = read("src/core/connection/keepalive.js");
ok(/startStabilityWatchdog/.test(ka), "stability watchdog ada (deteksi event-loop lag)");

console.log("[3/4] Stay-on & stabilitas...");
const start = read("src/core/connection/start.js");
ok(/startKeepAlive\(sock/.test(start), "heartbeat presence terpasang");
ok(/stabilityStop/.test(start), "watchdog hidup 1x per proses (tanpa dobel timer)");
const eco = read("ecosystem.config.cjs");
ok(/autorestart:\s*true/.test(eco), "PM2 autorestart aktif");
ok(/max_memory_restart/.test(eco), "PM2 restart saat memori bengkak");
ok(/exec_mode:\s*"fork"/.test(eco), "PM2 fork mode (1 instans, tanpa overhead cluster)");

console.log("[4/4] Cache...");
ok(fs.existsSync(path.join(ROOT, "src/utils/ttl-cache.js")), "util TTL cache tersedia");
const banner = read("src/utils/imagePayload.js");
ok(/cache/i.test(banner), "banner .menu di-cache di memori");

console.log(failures === 0 ? "TURBO-TRAFFIC OK" : `TURBO-TRAFFIC GAGAL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
