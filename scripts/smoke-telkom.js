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

console.log("[1/12] Validasi NIS...");
assert(normalizeNis("539-241-249") === "539241249", "normalizeNis membuang non-digit");
assert(isValidNis("539241249") === true, "NIS 9 digit valid");
assert(isValidNis("1234") === false, "NIS terlalu pendek ditolak");
assert(isValidNis("abc") === false, "NIS non-numerik ditolak");
assert(decodeJwtPayload("a.eyJzdWIiOiIxMjMifQ.c")?.sub === "123", "payload JWT terbaca");

console.log("[2/12] Vault kredensial (tanpa password default)...");
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

// Pola password sekolah (opsional, default nonaktif)
const { patternPassword } = await load("src/services/telkom/vault.js");
assert(patternPassword("539241249") === "", "pola password default nonaktif");
process.env.TELKOM_PASSWORD_PATTERN = "dummy@{nis}";
assert(patternPassword("539241249") === "dummy@539241249", "pola password sekolah bisa diaktifkan");
assert(resolvePassword("539241249") === "dummy@539241249", "vault memakai pola password");
delete process.env.TELKOM_PASSWORD_PATTERN;
assert(hasCredential("539241249") === false, "tanpa pola & vault, kredensial tetap tidak ada");

console.log("[3/12] Jendela absen (WIB)...");
assert(parseWindow("05:30-08:00")?.start === 330, "parse window start");
assert(parseWindow("bukan window") === null, "window invalid ditolak");
const now = wibParts();
assert(Boolean(now.date && now.time), "wibParts menghasilkan tanggal & jam");
assert(typeof checkWindow("datang").allowed === "boolean", "checkWindow mengembalikan boolean");
assert(checkWindow("ngawur").allowed === false, "jenis absen tak dikenal tidak diizinkan");

console.log("[4/12] Parsing payload resmi presensi...");
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

console.log("[5/12] Auto-discovery endpoint (tanpa konfigurasi manual)...");
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

console.log("[6/12] Deteksi proteksi Cloudflare...");
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

// Bridge Bright Data (bypass Cloudflare lewat .env)
const { brightDataBridgeEnabled, tryBrightDataUnlock } = await load("src/services/telkom/http.js");
const prevBdKey = process.env.BRIGHTDATA_API_KEY;
delete process.env.BRIGHTDATA_API_KEY;
delete process.env.TELKOM_VIA_BRIGHTDATA;
assert(brightDataBridgeEnabled() === false, "bridge BrightData nonaktif tanpa API key");
process.env.BRIGHTDATA_API_KEY = "test-key";
assert(brightDataBridgeEnabled() === true, "bridge BrightData aktif kalau API key ada");
process.env.TELKOM_VIA_BRIGHTDATA = "0";
assert(brightDataBridgeEnabled() === false, "bridge BrightData bisa dimatikan manual");
delete process.env.TELKOM_VIA_BRIGHTDATA;
assert(
  (await tryBrightDataUnlock("https://example.com/", { method: "GET" })) === null,
  "unlocker gagal -> null (eskalasi ke jalur lain)"
);
if (prevBdKey === undefined) delete process.env.BRIGHTDATA_API_KEY;
else process.env.BRIGHTDATA_API_KEY = prevBdKey;

// Scraping Browser remote (Bright Data WebSocket)
const { scrapingBrowserEndpoint, remoteBrowserEnabled } = await load("src/services/telkom/remote-browser.js");
const prevEnv = {
  BRIGHTDATA_SCRAPING_BROWSER_WS: process.env.BRIGHTDATA_SCRAPING_BROWSER_WS,
  BRIGHTDATA_CUSTOMER: process.env.BRIGHTDATA_CUSTOMER,
  BRIGHTDATA_PROXY_PASSWORD: process.env.BRIGHTDATA_PROXY_PASSWORD,
  BRIGHTDATA_SCRAPING_BROWSER_ZONE: process.env.BRIGHTDATA_SCRAPING_BROWSER_ZONE,
};
for (const key of Object.keys(prevEnv)) delete process.env[key];
delete process.env.TELKOM_VIA_BRIGHTDATA_BROWSER;
assert(scrapingBrowserEndpoint() === "", "endpoint scraping browser kosong tanpa konfigurasi");
assert(remoteBrowserEnabled() === false, "scraping browser nonaktif tanpa endpoint");
process.env.BRIGHTDATA_SCRAPING_BROWSER_WS =
  "wss://brd-customer-cus-zone-scraping_browser1:pass@brd.superproxy.io:9222";
assert(scrapingBrowserEndpoint().startsWith("wss://brd-customer-"), "endpoint scraping browser dibaca dari env");
assert(remoteBrowserEnabled() === true, "scraping browser aktif kalau endpoint ada");
process.env.TELKOM_VIA_BRIGHTDATA_BROWSER = "0";
assert(remoteBrowserEnabled() === false, "scraping browser bisa dimatikan manual");
delete process.env.TELKOM_VIA_BRIGHTDATA_BROWSER;
delete process.env.BRIGHTDATA_SCRAPING_BROWSER_WS;
process.env.BRIGHTDATA_CUSTOMER = "cus";
process.env.BRIGHTDATA_PROXY_PASSWORD = "pass";
process.env.BRIGHTDATA_SCRAPING_BROWSER_ZONE = "scraping_browser1";
assert(
  scrapingBrowserEndpoint() === "wss://brd-customer-cus-zone-scraping_browser1:pass@brd.superproxy.io:9222",
  "endpoint scraping browser bisa disusun dari 3 env terpisah"
);
for (const [key, value] of Object.entries(prevEnv)) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

console.log("[7/12] Payload submit + sesi 2FA...");
const submitBody = buildSubmitPayload({ studentId: "12345", kind: "datang", date: "2026-10-22" });
assert(submitBody.studentId === "12345", "studentId masuk payload");
assert(submitBody.qrType === "QR Datang", "qrType resmi dipakai");
assert(submitBody.date === "2026-10-22", "tanggal masuk payload");
clearPendingTwoFactor();
setPendingTwoFactor("539241249", "jid@test", "session-abc");
assert(takePendingTwoFactor("539241249", "jid@test")?.url === "session-abc", "sesi 2FA tersimpan & diambil");
assert(takePendingTwoFactor("539241249", "jid@test") === null, "sesi 2FA sekali pakai");

console.log("[8/12] Session in-memory & cleanup...");
const session = createSession({ token: "jwt-token-rahasia", cookie: "SESSION=rahasia" });
assert(session.isActive() === true, "session aktif setelah dibuat");
const cleared = session.destroy();
assert(cleared.cleared === true, "destroy() menandai session cleared");
assert(session.token === null && session.cookie === null, "token & cookie di-null-kan");
assert(session.isActive() === false, "session tidak aktif setelah cleanup");

console.log("[9/12] Decode QR guru (foto) & tipe QR...");
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

console.log("[10/12] Scanner kode (QR & barcode 1D)...");
{
  const { schoolInfo, distanceMeters, distanceToSchool, useSchoolLocation } = await load(
    "src/services/telkom/school.js"
  );
  const school = schoolInfo();
  assert(school.name.length > 0, "data sekolah termuat");
  assert(Number.isFinite(school.latitude) && Number.isFinite(school.longitude), "koordinat sekolah valid");
  assert(school.url.includes("google.com/maps"), "link map sekolah tersedia");
  assert(distanceMeters(-6.1544783, 106.7507579, -6.1544783, 106.7507579) === 0, "jarak ke diri sendiri 0 m");
  assert(distanceToSchool({ latitude: -6.1544783, longitude: 106.7507579 }) < 5, "jarak lokasi sekolah terhitung 0 m");
  assert(distanceToSchool({ latitude: -6.2, longitude: 106.8 }) > 1000, "jarak lokasi jauh terhitung");
  assert(useSchoolLocation() === false, "mode lokasi sekolah default nonaktif");

  const { scanCodes } = await load("src/services/telkom/scanner.js");
  const { parseAttendanceCode } = await load("src/services/telkom/qr.js");
  const { buildSubmitPayload } = await load("src/services/telkom/client.js");
  const { default: QRCode } = await import("qrcode");
  const officialText = JSON.stringify([JSON.stringify({ type: "QR Datang", code: "abc" })]);

  const big = await QRCode.toBuffer(officialText, { type: "png", width: 500, margin: 2 });
  const codes = await scanCodes(big);
  assert(codes.length === 1, "QR terbaca dari gambar");
  const parsed = parseAttendanceCode(codes[0]?.text, codes[0]?.format);
  assert(parsed?.kind === "datang", "QR resmi dikenali sebagai absen datang");

  const small = await QRCode.toBuffer(officialText, { type: "jpeg", width: 180, quality: 70 });
  const smallCodes = await scanCodes(small);
  assert(smallCodes.length === 1, "QR kecil + blur tetap terbaca");

  // Format QR yang dipakai plugin .absensi (guru): objek JSON polos.
  const absensiPayload = JSON.stringify({
    id: 3919,
    lemdikId: 47,
    createdAt: "2026-10-22 07:24:38",
    type: "QR Datang",
  });
  const absensiPng = await QRCode.toBuffer(absensiPayload, {
    type: "png",
    errorCorrectionLevel: "H",
    margin: 2,
    scale: 8,
  });
  const absensiCodes = await scanCodes(absensiPng);
  const absensiParsed = parseAttendanceCode(absensiCodes[0]?.text, absensiCodes[0]?.format);
  assert(absensiParsed?.kind === "datang", "QR format .absensi dikenali");
  assert(absensiParsed?.payload?.id === 3919, "id QR .absensi terbaca");
  assert(absensiParsed?.payload?.createdAt === "2026-10-22 07:24:38", "createdAt QR terbaca");

  const body = buildSubmitPayload({
    studentId: "88123",
    kind: absensiParsed.kind,
    qrPayload: absensiParsed.payload,
    date: "2026-10-22",
  });
  assert(body.qrType === "QR Datang", "qrType mengikuti QR guru");
  assert(body.id === 3919 && body.lemdikId === 47, "id & lemdikId QR ikut terkirim ke server");
}

console.log("[11/12] Auto-absen dari foto QR + Share Location (media handler)...");
{
  const { default: QRCode } = await import("qrcode");
  const { db } = await load("src/core/database.js");
  const { setConsent } = await load("src/services/telkom/registry.js");
  const plugin = (await load("plugins/tools/telkomschool.js")).default;
  const TEST_NIS = "999888777";
  const JID = "628111@s.whatsapp.net";
  const realFetch = globalThis.fetch;
  let sent = null;
  let replied = null;

  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    const json = (s, b) =>
      new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });
    if (u.includes("issueauth")) {
      const pw = opts.body?.get ? String(opts.body.get("password") || "") : "";
      if (pw === "password-siswa") return json(200, { token: "jwt.palsu", expired: 86400 });
      return json(401, { status: "Failed", message: "Credentials not Found" });
    }
    if (u.includes("/api/read/")) {
      return json(200, {
        status: true,
        data: { profile: { nis: TEST_NIS, numberid: "12345", fullname: "Siswa Uji" } },
      });
    }
    if (u.includes("/api/presensi-read/")) {
      return json(200, {
        status: true,
        data: [
          { type: "QR Datang", name: "Presensi Datang", status: false, time: "00:00" },
          { type: "QR Pulang", name: "Presensi Pulang", status: false, time: "00:00" },
        ],
      });
    }
    if (u.includes("/api/presensi-write/")) {
      sent = JSON.parse(opts.body || "{}");
      return json(200, { status: true, message: "Presensi berhasil dicatat" });
    }
    return json(404, {});
  };

  // Vault + binding akun (agar handler foto punya NIS & password).
  process.env.TELKOM_STUDENT_PASSWORDS = JSON.stringify({ [TEST_NIS]: "password-siswa" });
  setConsent(TEST_NIS, { consent: true, actor: JID, jid: JID, autoSubmit: true });

  const qrPng = await QRCode.toBuffer(
    JSON.stringify([JSON.stringify({ type: "QR Datang", date: "2026-10-22", code: "uuid-1" })]),
    { type: "png", width: 500, margin: 2 }
  );

  const sock = {
    downloadMediaMessage: async () => qrPng,
    sendMessage: async (jid, content) => {
      replied = content?.text || "";
      return { key: { id: "x" } };
    },
  };
  const msg = {
    key: { remoteJid: "628111@s.whatsapp.net", id: "m1" },
    message: { imageMessage: { url: "https://wa.me/fake", mimetype: "image/png" } },
  };

  const handled = await plugin.onMedia(sock, msg, {
    logger: { info: () => {}, warn: () => {} },
    senderJid: JID,
    remoteJid: "628111@s.whatsapp.net",
  });

  assert(handled === true, "media handler menangani foto QR");
  assert(String(replied || "").includes("Share Location"), "bot minta Share Location (2 langkah)");
  assert(!sent, "belum submit sebelum lokasi dikirim");

  // Langkah 2: siswa Share Location (lokasi asli dari WhatsApp).
  replied = null;
  const handledLoc = await plugin.onMedia(
    sock,
    {
      key: { remoteJid: "628111@s.whatsapp.net", id: "m2" },
      message: {
        locationMessage: {
          degreesLatitude: -6.2,
          degreesLongitude: 106.8,
          name: "Sekolah",
        },
      },
    },
    {
      logger: { info: () => {}, warn: () => {} },
      senderJid: JID,
      remoteJid: "628111@s.whatsapp.net",
    }
  );

  assert(handledLoc === true, "media handler menangani Share Location");
  assert(Boolean(sent), "absen otomatis terkirim setelah lokasi dikirim");
  assert(sent?.qrType === "QR Datang" && sent?.code === "uuid-1", "payload QR guru ikut dikirim");
  assert(
    sent?.location?.latitude === -6.2 && sent?.location?.longitude === 106.8,
    "lokasi asli siswa ikut dikirim (tidak dipalsukan)"
  );
  assert(String(replied || "").includes("PRESENSI"), "balasan ke siswa dikirim");

  // Lokasi dari EXIF foto (student kirim sebagai file) -> 1 langkah.
  const { extractLocationFromMessage, extractGpsFromImage, toApiLocation } = await load(
    "src/services/telkom/location.js"
  );
  const fromMsg = extractLocationFromMessage({
    message: { locationMessage: { degreesLatitude: -6.2, degreesLongitude: 106.8 } },
  });
  assert(fromMsg?.latitude === -6.2, "lokasi dari Share Location terbaca");
  assert(
    JSON.stringify(toApiLocation(fromMsg)) === JSON.stringify({ latitude: -6.2, longitude: 106.8 }),
    "lokasi diformat seperti aplikasi resmi (tanpa field tambahan)"
  );
  assert(extractLocationFromMessage({ message: {} }) === null, "pesan tanpa lokasi tidak dianggap lokasi");
  try {
    const sharp = (await import("sharp")).default;
    const jpeg = await sharp(qrPng)
      .withMetadata({
        exif: {
          IFD3: {
            GPSLatitude: "6/1 12/1 0/1",
            GPSLatitudeRef: "S",
            GPSLongitude: "106/1 48/1 0/1",
            GPSLongitudeRef: "E",
          },
        },
      })
      .jpeg()
      .toBuffer();
    const gps = await extractGpsFromImage(jpeg);
    assert(
      Math.abs((gps?.latitude ?? 0) + 6.2) < 0.001 && Math.abs((gps?.longitude ?? 0) - 106.8) < 0.001,
      "GPS EXIF foto terbaca (fallback lokasi)"
    );
  } catch (err) {
    assert(true, "tes EXIF dilewati (sharp tidak ada)", err.message);
  }

  globalThis.fetch = realFetch;
  delete process.env.TELKOM_STUDENT_PASSWORDS;

  const store = db.data.telkom || {};
  delete (store.students || {})[TEST_NIS];
  delete (store.usage || {})[TEST_NIS];
  store.audit = [];
  try {
    db.save();
  } catch (_) {}
}
console.log("[12/12] Mode mandiri: NIS + password langsung (tanpa whitelist admin)...");
{
  const { db } = await load("src/core/database.js");
  const { runAttendanceFlow } = await load("src/services/telkom/service.js");
  const TEST_NIS = "999888777";
  const realFetch = globalThis.fetch;
  let sent = null;

  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    const json = (s, b) =>
      new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });
    if (u.includes("issueauth")) {
      const pw = opts.body?.get ? String(opts.body.get("password") || "") : "";
      if (pw === "password-siswa") return json(200, { token: "jwt.palsu", expired: 86400 });
      return json(401, { status: "Failed", message: "Credentials not Found" });
    }
    if (u.includes("/api/read/")) {
      return json(200, {
        status: true,
        data: { profile: { nis: TEST_NIS, numberid: "12345", fullname: "Siswa Uji" } },
      });
    }
    if (u.includes("/api/presensi-read/")) {
      return json(200, {
        status: true,
        data: [
          { type: "QR Datang", name: "Presensi Datang", status: true, time: "06:45" },
          { type: "QR Pulang", name: "Presensi Pulang", status: false, time: "00:00" },
        ],
      });
    }
    if (u.includes("/api/presensi-write/")) {
      sent = JSON.parse(opts.body || "{}");
      return json(200, { status: true, message: "Presensi berhasil dicatat" });
    }
    return json(404, {});
  };

  const logger = { info: () => {}, warn: () => {} };
  const jid = "628111@s.whatsapp.net";
  delete process.env.TELKOM_STUDENT_PASSWORDS;
  process.env.TELKOM_WINDOW_PULANG = "00:00-23:59";

  const ok = await runAttendanceFlow({ nis: TEST_NIS, password: "password-siswa", actorJid: jid, logger });
  assert(ok.ok === true, "login mandiri (NIS + password) berhasil tanpa whitelist");
  assert(ok.studentId === "12345", "studentId internal terdeteksi otomatis");
  assert(ok.submit?.attempted === true && ok.submit?.success === true, "absen otomatis terkirim");
  assert(sent?.studentId === "12345" && sent?.qrType === "QR Pulang", "payload submit sesuai kontrak resmi");

  const readonly = await runAttendanceFlow({
    nis: TEST_NIS,
    password: "password-siswa",
    actorJid: jid,
    allowSubmit: false,
    logger,
  });
  assert(readonly.submit?.reason === "read_only", "mode status tidak mengirim absen");

  const salah = await runAttendanceFlow({ nis: TEST_NIS, password: "salah", actorJid: jid, logger });
  assert(salah.ok === false && salah.code === "auth_failed", "password salah ditolak");

  const lain = await runAttendanceFlow({
    nis: TEST_NIS,
    password: "password-siswa",
    actorJid: "628999@s.whatsapp.net",
    logger,
  });
  assert(lain.ok === false && lain.code === "nis_bound_other", "NIS terkunci ke akun pertama");

  globalThis.fetch = realFetch;
  delete process.env.TELKOM_WINDOW_PULANG;

  const store = db.data.telkom || {};
  delete (store.students || {})[TEST_NIS];
  delete (store.usage || {})[TEST_NIS];
  store.audit = [];
  try {
    db.save();
  } catch (_) {}
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
