#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
let failures = 0;

// Alias "@/..." -> root project (dibuat index.js saat bot start; pastikan di sini juga).
try {
  const aliasPath = path.join(ROOT, "node_modules", "@");
  if (!fs.existsSync(aliasPath)) {
    fs.symlinkSync(ROOT, aliasPath, process.platform === "win32" ? "junction" : "dir");
  }
} catch (_) {}

function assert(cond, label, extra = "") {
  if (cond) {
    console.log(`  OK   ${label}`);
  } else {
    failures++;
    console.log(`  FAIL ${label}${extra ? ` — ${extra}` : ""}`);
  }
}

function pluginFiles(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...pluginFiles(p));
    else if (e.isFile() && e.name.endsWith(".js") && !e.name.startsWith("_")) out.push(p);
  }
  return out;
}

console.log("[1/5] Semua plugin ter-import & valid...");
const files = pluginFiles(path.join(ROOT, "plugins"));
const seen = new Map();
const dupes = [];
for (const f of files) {
  try {
    const mod = await import(pathToFileURL(f).href);
    const exp = mod.default ?? null;
    const cmds = Array.isArray(exp) ? exp : [exp];
    for (const cmd of cmds) {
      if (!cmd || typeof cmd.name !== "string" || typeof cmd.run !== "function") {
        failures++;
        console.log(`  FAIL ${path.relative(ROOT, f)}: tanpa name/run`);
        continue;
      }
      const key = cmd.name.toLowerCase();
      if (seen.has(key)) dupes.push(`${key} (${seen.get(key)} vs ${path.relative(ROOT, f)})`);
      else seen.set(key, path.relative(ROOT, f));
      for (const a of cmd.aliases || []) {
        const ak = String(a).toLowerCase();
        if (seen.has(ak)) dupes.push(`alias ${ak} (${seen.get(ak)} vs ${path.relative(ROOT, f)})`);
        else seen.set(ak, path.relative(ROOT, f));
      }
    }
  } catch (err) {
    failures++;
    console.log(`  FAIL import ${path.relative(ROOT, f)}: ${err.message.split("\n")[0]}`);
  }
}
assert(dupes.length === 0, `tanpa nama/alias duplikat (${seen.size} command)`, dupes.slice(0, 5).join("; "));
console.log(`  INFO ${files.length} file plugin dicek`);

console.log("[2/5] Modul util inti termuat...");
try {
  await import("../src/utils/termux.js");
  await import("../src/utils/native.js");
  await import("../src/utils/doctor.js");
  const { nativeStatus } = await import("../src/utils/native.js");
  nativeStatus();
  assert(true, "termux/native/doctor tanpa crash");
} catch (err) {
  assert(false, "termux/native/doctor tanpa crash", err.message);
}

console.log("[3/5] EXIF stiker JS murni valid...");
try {
  const { isWebP, injectExif, getExifChunk, buildStickerExif } = await import("../src/services/fetch/media/exif.js");
  const sharp = (await import("../src/utils/native.js").then((m) => m.getSharp())) || null;
  if (!sharp) {
    console.log("  SKIP sharp tidak ada (butuh sharp/ffmpeg untuk render webp)");
  } else {
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64"
    );
    const webp = await sharp(png)
      .resize(64, 64, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp()
      .toBuffer();
    const exif = buildStickerExif("T", "A");
    const out = injectExif(webp, exif);
    assert(isWebP(out), "output tetap WebP valid");
    assert(out.readUInt32LE(4) === out.length - 8, "ukuran RIFF konsisten");
    assert(getExifChunk(out)?.equals(exif), "chunk EXIF utuh terbaca balik");
    const double = injectExif(out, Buffer.from("XYZ"));
    assert(getExifChunk(double).toString() === "XYZ", "inject ulang ganti payload (1 chunk)");
  }
} catch (err) {
  assert(false, "EXIF stiker JS murni valid", err.message);
}

console.log("[4/5] Downloader core engine (kol.id & ytdlp) termuat...");
try {
  const { KolIdError } = await import("../src/services/fetch/kolid.js");
  const { downloadMedia, probe } = await import("../src/services/fetch/ytdlp.js");
  assert(typeof KolIdError === "function" && typeof downloadMedia === "function" && typeof probe === "function", "kolid & ytdlp termuat");
} catch (err) {
  assert(false, "kolid & ytdlp termuat", err.message);
}

console.log("[5/5] Simulasi dispatch perintah (proses terpisah, db dummy)...");
try {
  const os = await import("os");
  const { execFileSync } = await import("child_process");
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rizzer-smoke-dispatch-"));
  try {
    execFileSync(process.execPath, [path.join(ROOT, "scripts", "smoke-dispatch.js")], {
      cwd: tmpDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })
      .split("\n")
      .filter((line) => /^\s+(OK|FAIL|GAGAL)/.test(line))
      .forEach((line) => console.log(line));
    assert(true, "simulasi dispatch tanpa error");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
} catch (err) {
  for (const line of `${err.stdout || ""}`.split("\n")) {
    if (/^\s+(OK|FAIL|GAGAL)/.test(line)) console.log(line);
  }
  assert(
    false,
    "simulasi dispatch tanpa error",
    String(err.stderr || err.message)
      .trim()
      .split("\n")
      .slice(-1)[0]
  );
}

console.log(failures === 0 ? "\nSMOKE OK" : `\nSMOKE GAGAL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
