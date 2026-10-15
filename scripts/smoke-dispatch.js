#!/usr/bin/env node

import fs from "fs";
import path from "path";

const OWNER_JID = "6287847566690@s.whatsapp.net";
const USER_JID = "628999888777@s.whatsapp.net";
const GROUP_JID = "120363000000000000@g.us";

const dbDir = path.join(process.cwd(), "database");
fs.mkdirSync(dbDir, { recursive: true });

const settings = {
  botName: "Rizzer Bot",
  ownerNumber: "6287847566690",
  ownerNumbers: [],
  adminNumbers: [],
  premiumNumbers: [],
  prefix: ".",
  public: false,
  maintenance: false,
  silentDeny: true,
  cooldownTime: 0,
  antiBurst: true,
  publicCommands: ["sewa", "owner", "ping", "uptime", "menu", "help", "panduan"],
};

const users = {
  [OWNER_JID]: { name: "Owner", owner: true, admin: true, premium: true, banned: false },
};

fs.writeFileSync(path.join(dbDir, "database.json"), JSON.stringify({ schemaVersion: 2, settings, users }, null, 2));
fs.writeFileSync(path.join(dbDir, "users.json"), JSON.stringify(users, null, 2));

const { loadPlugins } = await import("@/src/core/loader.js");
const { dispatchMessage } = await import("@/src/core/dispatch/run.js");
const { attachEchoTracker, clearSentMessageCache } = await import("@/src/core/dispatch/echo.js");

await loadPlugins();

let failures = 0;
let seq = 0;

function assert(cond, label, extra = "") {
  if (cond) console.log(`  OK   ${label}`);
  else {
    failures++;
    console.log(`  FAIL ${label}${extra ? ` — ${extra}` : ""}`);
  }
}

function makeSock(botJid = OWNER_JID) {
  const sent = [];
  const sock = {
    sent,
    user: { id: `${botJid.split("@")[0]}:5@s.whatsapp.net`, name: "~" },
    isSubBot: false,
    async sendMessage(jid, content) {
      const id = `OUT${++seq}`;
      sent.push({ jid, content, id });
      return { key: { id, remoteJid: jid, fromMe: true } };
    },
    sendPresenceUpdate: async () => {},
    groupMetadata: async () => ({
      id: GROUP_JID,
      participants: [
        { id: botJid, admin: "superadmin" },
        { id: USER_JID, admin: null },
      ],
    }),
  };
  return attachEchoTracker(sock);
}

const logLines = [];
const logger = {
  info: (...a) => void logLines.push(["info", a.map(String).join(" ")]),
  warn: (...a) => void logLines.push(["warn", a.map(String).join(" ")]),
  error: (...a) => void logLines.push(["error", a.map(String).join(" ")]),
};

function logHas(...needles) {
  return logLines.some(([, line]) => needles.every((n) => line.includes(n)));
}

async function dispatch(sock, { text, remoteJid, fromMe = false, participant, ageSec = 0 }) {
  const before = sock.sent.length;
  await dispatchMessage(
    sock,
    {
      key: { remoteJid, fromMe, id: `IN${++seq}`, participant },
      messageTimestamp: Math.floor(Date.now() / 1000) - ageSec,
      pushName: fromMe ? "~" : "User",
      message: { conversation: text },
    },
    logger
  );
  return sock.sent.slice(before);
}

function bodyOf(sent) {
  return sent
    .map((s) => s.content?.text || s.content?.caption || s.content?.interactiveMessage?.title || "")
    .join("\n");
}

clearSentMessageCache();

{
  const sock = makeSock();
  const sent = await dispatch(sock, { text: ".menu", remoteJid: OWNER_JID, fromMe: true });
  assert(sent.length > 0, "owner (fromMe) tetap dapat .menu di DM sendiri");
  assert(sent.length === 1, "`.menu` hanya mengirim 1 pesan (tanpa duplikat)", `terkirim ${sent.length} pesan`);

  for (const out of sent) {
    const text = out.content?.text || out.content?.caption || "";
    if (!text) continue;
    const echo = await dispatch(sock, { text, remoteJid: out.jid, fromMe: true });
    assert(echo.length === 0, `echo balasan bot diabaikan ("${text.slice(0, 24)}")`);
  }
}

{
  clearSentMessageCache();
  const sock = makeSock();
  const sent = await dispatch(sock, {
    text: ".ping",
    remoteJid: GROUP_JID,
    fromMe: true,
    participant: OWNER_JID,
  });
  assert(sent.length > 0, "owner (fromMe) tetap dilayani di grup");
}

{
  clearSentMessageCache();
  const sock = makeSock();
  const sent = await dispatch(sock, { text: ".menu", remoteJid: USER_JID });
  assert(sent.length > 0, "user biasa bisa .menu walau bot private");
  assert(sent.length === 1, "`.menu` user biasa juga 1 pesan", `terkirim ${sent.length} pesan`);
}

{
  clearSentMessageCache();
  const sock = makeSock();
  const sent = await dispatch(sock, { text: ".tagall", remoteJid: USER_JID });
  assert(sent.length === 0, "perintah non-whitelist tetap diblokir saat private");
}

{
  clearSentMessageCache();
  const { db } = await import("@/src/core/database.js");
  db.updateSettings({ silentDeny: false });

  const sock = makeSock();
  const sent = await dispatch(sock, { text: ".tagall", remoteJid: USER_JID });
  assert(/private/i.test(bodyOf(sent)), "private mode memberi penjelasan saat silentDeny=false");

  const unknown = await dispatch(sock, { text: ".perintahngawur", remoteJid: USER_JID });
  assert(/tidak dikenal/i.test(bodyOf(unknown)), "perintah tidak dikenal diberi feedback");
}

{
  clearSentMessageCache();
  const otherBot = "628111111111@s.whatsapp.net";
  const sock = makeSock(otherBot);
  const sent = await dispatch(sock, { text: ".ping", remoteJid: USER_JID });
  assert(sent.length > 0, "user biasa bisa .ping (whitelist) dengan akun bot lain");
}

{
  clearSentMessageCache();
  const sock = makeSock();
  const before = sock.sent.length;
  await dispatchMessage(
    sock,
    {
      key: { remoteJid: GROUP_JID, fromMe: false, id: `TAP${++seq}`, participant: USER_JID },
      messageTimestamp: Math.floor(Date.now() / 1000),
      pushName: "User",
      message: {
        interactiveResponseMessage: {
          nativeFlowResponseMessage: { paramsJson: JSON.stringify({ title: "Umum", id: ".menu umum" }) },
        },
      },
    },
    logger
  );
  const sent = sock.sent.slice(before);
  assert(!sent.some((s) => s.content?.delete), "tap tombol menu tidak dihapus sebagai crash");
  assert(sent.length > 0, "tap tombol menu dijawab");
}

{
  clearSentMessageCache();
  logLines.length = 0;
  const sock = makeSock();
  const sent = await dispatch(sock, { text: ".ping", remoteJid: USER_JID, ageSec: 6 * 60 });
  assert(sent.length === 0, "pesan basi 6 menit dibuang");
  assert(logHas("[Stale]"), "pesan basi meninggalkan jejak log [Stale]");
}

{
  clearSentMessageCache();
  logLines.length = 0;
  const sock = makeSock();
  await dispatch(sock, { text: ".perintahngawur", remoteJid: USER_JID });
  assert(logHas("perintah tidak dikenal"), "perintah tak dikenal tercatat di log");

  logLines.length = 0;
  await dispatch(sock, { text: ".tagall", remoteJid: USER_JID });
  assert(logHas("mode private"), "blokir private tercatat di log");
}

{
  clearSentMessageCache();
  const { db } = await import("@/src/core/database.js");
  db.updateSettings({ silentDeny: true });
  const sock = makeSock();
  let throttled = null;
  for (let i = 0; i < 12; i++) {
    const sent = await dispatch(sock, { text: ".ping", remoteJid: OWNER_JID, fromMe: true });
    const hit = sent.find((s) => /Terlalu banyak perintah owner/.test(s.content?.text || ""));
    if (hit) throttled = hit;
  }
  assert(Boolean(throttled), "owner throttle tetap dibalas walau silentDeny=true");
}

{
  const { resolveImagePayload, clearImagePayloadCache } = await import("@/src/utils/imagePayload.js");
  clearImagePayloadCache();
  fs.writeFileSync(path.join(process.cwd(), "tmp-banner.bin"), Buffer.from("BANNER-DUMMY"));
  const a = await resolveImagePayload({ image: "tmp-banner.bin" });
  const b = await resolveImagePayload({ image: "tmp-banner.bin" });
  assert(Buffer.isBuffer(a) && a === b, "gambar .menu diambil dari cache memori");
}

console.log(failures === 0 ? "  OK   simulasi dispatch bersih" : `  GAGAL ${failures} skenario dispatch`);
process.exit(failures === 0 ? 0 : 1);
