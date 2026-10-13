// plugin-load.test.js — pastikan SEMUA plugin + core ke-load tanpa error (no delay, no error)
// Run: node plugin-load.test.js
// Meniru loader asli: symlink node_modules/@ -> cwd, lalu import tiap file plugin.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const cwd = process.cwd();
const link = path.join(cwd, "node_modules", "@");
try {
  if (!fs.existsSync(path.join(link, "package.json"))) {
    fs.rmSync(link, { recursive: true, force: true });
    fs.symlinkSync(cwd, link, "junction");
  }
} catch (_) {}

function jsFiles(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...jsFiles(p));
    else if (e.isFile() && e.name.endsWith(".js") && !e.name.startsWith("_")) out.push(p);
  }
  return out;
}

const pluginFiles = jsFiles(path.join(cwd, "plugins"));
const coreFiles = [
  "src/core/connection/start.js",
  "src/core/connection/handlers.js",
  "src/core/dispatch/run.js",
  "src/core/loader.js",
  "src/services/system/subbot/manager.js",
  "src/services/system/subbot/events.js",
  "src/services/fetch/media/buffer.js",
  "src/services/fetch/media/message.js",
  "src/services/system/bug/group.js",
  "src/services/system/bug/delay.js",
  "plugins/tools/util/rvo.js",
  "plugins/tools/util/buronlist.js",
].map((f) => path.join(cwd, f));

let pass = 0;
const fails = [];
for (const f of [...coreFiles, ...pluginFiles]) {
  const rel = path.relative(cwd, f);
  try {
    await import(pathToFileURL(f).href);
    pass++;
  } catch (e) {
    fails.push(`${rel} :: ${e.message.split("\n")[0]}`);
  }
}

console.log(`Loaded OK: ${pass}, Gagal: ${fails.length}`);
for (const fl of fails) console.log(`❌ ${fl}`);
console.log(fails.length === 0 ? "100% BISA ✅" : "BELUM 100% ❌");
process.exitCode = fails.length === 0 ? 0 : 1;
