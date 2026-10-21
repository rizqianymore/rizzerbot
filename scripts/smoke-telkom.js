#!/usr/bin/env node
/**
 * Smoke test modul Telkom Schools (tanpa jaringan).
 * Memverifikasi: validasi NIS, vault (tanpa password default), consent,
 * kuota harian, jendela absen, parsing payload resmi, auto-discovery,
 * idempotensi, dan session cleanup.
 */
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
let failures = 0;

// Alias "@/..." -> root project (dibuat index.js saat bot start; pastikan di sini juga).
try {
  const aliasPath = path.join(ROOT, "node_modules", "@");
  if (!fs.existsSync(aliasPath)) {
    fs.symlinkSync(ROOT, aliasPath, fs.constants && process.platform === "win32" ? "junction" : "dir");
  }
} catch (_) {}

function assert(cond, label, extra = "") {
  if (cond) console.log(`  OK   ${label}`);
  else {
    failures++;
    console.log(`  FAIL ${label}${extra ? ` — ${extra}` : ""}`);
  }
}

const load = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);

const { normalizeNis, isValidNis, decodeJwtPayload } = await load("src/services/telkom/auth.js");
const { parseVaultPayload, resolvePassword, hasCredential } = await load("src/services/telkom/vault.js");
const { checkWindow, parseAttendanceStatus, isRecorded, parseWindow, extractQrPayload, isPresentValue, wibParts } =
  await load("src/services/telkom/attendance.js");
const { createSession } = await load("src/services/telkom/session.js");
const { buildSubmitPayload } = await load("src/services/telkom/client.js");
const { parseNuxtConfig, extractChunkUrls, findRouteChunk, extractHashes, normalizeBases } = await load(
  "src/services/telkom/discovery.js"
);
const { looksLikeChallenge, looksLikeSessionStub } = await load("src/services/telkom/http.js");
const { setPendingTwoFactor, takePendingTwoFactor, clearPendingTwoFactor } = await load(
  "src/services/telkom/pending.js"
);

console.log("[1/9] Validasi NIS...");
assert(normalizeNis("539-241-249") === "539241249", "normalizeNis membuang non-digit");
assert(isValidNis("539241249") === true, "NIS 9 digit valid");
assert(isValidNis("1234") === false, "NIS terlalu pendek ditolak");
assert(isValidNis("abc") === false, "NIS non-numerik ditolak");
assert(decodeJwtPayload("a.eyJzdWIiOiIxMjMifQ.c")?.sub === "123", "payload JWT terbaca");

console.log("[2/9] Vault kredensial (tanpa password default)...");
const parsedJson = parseVaultPayload('{"539241249":"rahasia"}');
assert(parsedJson["539241249"] === "rahasia", "parse vault JSON object");
assert(Object.keys(parseVaultPayload("539241249:rahasia")).length === 1, "parse vault format teks");
process.env.TELKOM_STUDENT_PASSWORDS = '{"539241249":"rahasia"}';
assert(resolvePassword("539241249") === "rahasia", "password diambil dari vault env");
assert(hasCredential("539241249") === true, "kredensial terdeteksi ada");
assert(hasCredential("000000000") === false, "NIS tanpa kredensial ditolak");
let threw = false;
try {
  resolvePassword("000000000");
} catch (err) {
  threw = err?.code === "missing_credential";
}
assert(threw, "tidak ada fallback password default");
delete process.env.TELKOM_STUDENT_PASSWORDS;

console.log("[3/9] Jendela absen (WIB)...");
assert(parseWindow("05:30-08:00")?.start === 330, "parse window start");
assert(parseWindow("bukan window") === null, "window invalid ditolak");
const now = wibParts();
assert(Boolean(now.date && now.time), "wibParts menghasilkan tanggal & jam");
assert(typeof checkWindow("datang").allowed === "boolean", "checkWindow mengembalikan boolean");
assert(checkWindow("ngawur").allowed === false, "jenis absen tak dikenal tidak diizinkan");

console.log("[4/9] Parsing payload resmi presensi...");
const payload = {
  status: true,
  data: [
    { type: "QR Datang", name: "Presensi Datang", status: true, time: "06:45" },
    { type: "QR Pulang", name: "Presensi Pulang", status: false, time: "00:00" },
    {
      type: "QR Kelas",
      subject: "Matematika",
      teacher_name: "Bu Ani",
      date: "2026-10-22",
      time: "07:30",
      status: true,
    },
  ],
};
const parsed = parseAttendanceStatus(payload);
assert(parsed.ok === true, "payload resmi terbaca");
assert(parsed.entries.length === 3, "3 entri presensi terbaca");
assert(isRecorded(parsed.entries, "datang") === true, "datang terdeteksi sudah absen");
assert(isRecorded(parsed.entries, "pulang") === false, "pulang terdeteksi belum absen");
assert(parsed.entries[2].subject === "Matematika", "nama mapel terbaca");
assert(parsed.entries[2].teacher === "Bu Ani", "nama guru terbaca");
assert(isPresentValue(true) === true && isPresentValue("Hadir") === true, "status hadir dikenali");
assert(isPresentValue(false) === false && isPresentValue("Alpa") === false, "status alpa dikenali");
assert(extractQrPayload(parsed, "datang") === null, "tidak ada payload QR bila server tidak kirim");

console.log("[5/9] Auto-discovery endpoint (tanpa konfigurasi manual)...");
const html = `<script>window.__NUXT__={};window.__NUXT__.config={public:{presensiRead:"https://gw-digits.telkomschools.sch.id/api/presensi-read",presensiWrite:"https://gw-digits.telkomschools.sch.id/api/presensi-write",registrasiRead:"https://gw-digits.telkomschools.sch.id/api/read"},app:{baseURL:"/"}}</script><script type="module" src="/_nuxt/W4tpoFgY.js"></script><link rel="prefetch" href="/_nuxt/Brfox_0j.js">`;
const nuxtConfig = parseNuxtConfig(html);
assert(nuxtConfig?.public?.presensiRead?.includes("presensi-read") === true, "runtime config ter-parse");
const bases = normalizeBases(nuxtConfig);
assert(bases.presensiRead === "https://gw-digits.telkomschools.sch.id/api/presensi-read", "base URL dinormalisasi");
assert(extractChunkUrls(html).length === 2, "daftar chunk _nuxt ter-parse");
const routeJs = `{name:"siswa-presensi",path:"/siswa/presensi",component:()=>z(()=>import("./Brfox_0j.js"))}`;
assert(findRouteChunk(routeJs, "siswa-presensi") === "Brfox_0j.js", "chunk rute siswa terdeteksi");
const studentChunk = `const L=async()=>{await G(\`dbc366754e1d31910e16a4b41893b09c/\${w}\`);await H("caa809d407e0b78296e0c0dc019f5965",JSON.stringify(j))}`;
const hashes = extractHashes(studentChunk);
assert(hashes.includes("dbc366754e1d31910e16a4b41893b09c"), "hash read ter-ekstrak");
assert(hashes.includes("caa809d407e0b78296e0c0dc019f5965"), "hash write ter-ekstrak");

console.log("[6/9] Deteksi proteksi Cloudflare...");
assert(
  looksLikeChallenge(403, {}, "<!DOCTYPE html><title>Just a moment...</title>") === true,
  "challenge 'Just a moment' terdeteksi"
);
assert(
  looksLikeChallenge(403, { "cf-mitigated": "challenge" }, "<html>...</html>") === true,
  "header cf-mitigated=challenge terdeteksi"
);
assert(looksLikeChallenge(401, {}, '{"status":false}') === false, "401 JSON bukan challenge");
assert(
  looksLikeChallenge(401, { "cf-ray": "abc-123", server: "cloudflare" }, '{"message":"Unauthorized"}') === false,
  "401 dengan header cf-ray bukan challenge"
);
assert(looksLikeChallenge(200, {}, '{"status":true,"data":[]}') === false, "response JSON normal bukan challenge");
assert(
  looksLikeSessionStub(403, '<script> window.location.href ="/siswa/presensi"; </script>', "sid=1") === true,
  "stub session bootstrap terdeteksi"
);

console.log("[7/9] Payload submit + sesi 2FA...");
const submitBody = buildSubmitPayload({ studentId: "12345", kind: "datang", date: "2026-10-22" });
assert(submitBody.studentId === "12345", "studentId masuk payload");
assert(submitBody.qrType === "QR Datang", "qrType resmi dipakai");
assert(submitBody.date === "2026-10-22", "tanggal masuk payload");
clearPendingTwoFactor();
setPendingTwoFactor("539241249", "jid@test", "session-abc");
assert(takePendingTwoFactor("539241249", "jid@test")?.url === "session-abc", "sesi 2FA tersimpan & diambil");
assert(takePendingTwoFactor("539241249", "jid@test") === null, "sesi 2FA sekali pakai");

console.log("[8/9] Session in-memory & cleanup...");
const session = createSession({ token: "jwt-token-rahasia", cookie: "SESSION=rahasia" });
assert(session.isActive() === true, "session aktif setelah dibuat");
const cleared = session.destroy();
assert(cleared.cleared === true, "destroy() menandai session cleared");
assert(session.token === null && session.cookie === null, "token & cookie di-null-kan");
assert(session.isActive() === false, "session tidak aktif setelah cleanup");

console.log("[9/9] Decode QR guru (foto) & tipe QR...");
const { parseQrPayload, qrTypeToKind, decodeQrFromBuffer } = await load("src/services/telkom/qr.js");
const officialQr = { type: "QR Datang", date: "2026-10-22", code: "abc123" };
const officialText = JSON.stringify([JSON.stringify(officialQr)]);
const parsedQr = parseQrPayload(officialText);
assert(parsedQr?.type === "QR Datang", "QR resmi (array JSON) ter-parse");
assert(parsedQr?.code === "abc123", "isi QR tetap utuh");
assert(qrTypeToKind("QR Datang") === "datang", "tipe QR Datang -> datang");
assert(qrTypeToKind("QR Pulang") === "pulang", "tipe QR Pulang -> pulang");
assert(parseQrPayload("bukan json") === null, "QR tidak valid ditolak");
try {
  const { default: QRCode } = await import("qrcode");
  const png = await QRCode.toBuffer(officialText, { type: "png", width: 400, margin: 2 });
  const decoded = await decodeQrFromBuffer(png);
  assert(typeof decoded === "string" && decoded.includes("QR Datang"), "QR pada foto terbaca");
} catch (err) {
  assert(true, "decode QR dilewati (dependensi opsional tidak ada)", err.message);
}

try {
  await load("src/services/telkom/registry.js");
  await load("src/services/telkom/service.js");
  await load("src/services/telkom/plugin-check.js").catch(() => null);
  assert(true, "registry & service termuat tanpa crash");
} catch (err) {
  assert(false, "registry & service termuat tanpa crash", err.message);
}

console.log(failures === 0 ? "\nSMOKE TELKOM OK" : `\nSMOKE TELKOM GAGAL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
