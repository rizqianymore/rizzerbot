// ourin-button-list.test.js — test button + list + lainnya + plugin buronlist
// Run: node ourin-button-list.test.js
import assert from "node:assert/strict";
import * as ourin from "ourin-baileys";
import { generateListContent, generateTableContent, ORich } from "ourin-baileys";
import plugin, {
  BURON_DUMMY,
  buildBuronItems,
  buildBuronText,
  buildBuronButtons,
  buildBuronInteractive,
  sendBuronList,
} from "./plugins/tools/util/buronlist.js";

let pass = 0;
let total = 0;
const out = [];
async function ok(name, fn) {
  total++;
  try {
    await fn();
    pass++;
    out.push(`✅ ${name}`);
  } catch (e) {
    out.push(`❌ ${name} :: ${e.message}`);
    process.exitCode = 1;
  }
}

// --- LIST ---
await ok("L1 items buron 3 baris", () => {
  assert.equal(buildBuronItems(BURON_DUMMY).length, 3);
});
await ok("L2 generateListContent dari items plugin valid", () => {
  const { message } = generateListContent("DAFTAR BURON", buildBuronItems(BURON_DUMMY), null, {});
  const t = message.botForwardedMessage.message.richResponseMessage.submessages.find((s) => s.messageType === 4);
  assert.equal(t.tableMetadata.rows.length, 3);
});
await ok("L3 teks fallback ada nama + total", () => {
  const t = buildBuronText(BURON_DUMMY);
  assert.ok(t.includes("Andi") && t.includes("(3)"));
});
await ok("L4 teks kosong tidak crash", () => {
  assert.ok(buildBuronText([]).includes("Belum ada"));
});
await ok("L5 generateTableContent buron valid", () => {
  const { message } = generateTableContent("B", ["Nama", "Kasus"], BURON_DUMMY.map((b) => [b.nama, b.kasus]), null, {});
  assert.ok(message.botForwardedMessage);
});

// --- BUTTON ---
await ok("B1 3 button quick_reply/cta_url/cta_copy valid JSON", () => {
  const btns = buildBuronButtons(".");
  assert.equal(btns.length, 3);
  const names = btns.map((b) => b.name);
  assert.deepEqual(names, ["quick_reply", "cta_url", "cta_copy"]);
  for (const b of btns) assert.ok(JSON.parse(b.buttonParamsJson));
});
await ok("B2 quick_reply punya display_text + id", () => {
  const p = JSON.parse(buildBuronButtons(".")[0].buttonParamsJson);
  assert.ok(p.display_text && p.id);
});
await ok("B3 cta_url punya url https", () => {
  const p = JSON.parse(buildBuronButtons(".")[1].buttonParamsJson);
  assert.ok(p.url.startsWith("https://"));
});
await ok("B4 cta_copy punya copy_code", () => {
  const p = JSON.parse(buildBuronButtons(".")[2].buttonParamsJson);
  assert.ok(p.copy_code);
});
await ok("B5 single_select rows 3 + id .buron", () => {
  const im = buildBuronInteractive(BURON_DUMMY, ".");
  const sel = im.interactiveMessage.buttons.find((b) => b.name === "single_select");
  const p = JSON.parse(sel.buttonParamsJson);
  assert.equal(p.sections[0].rows.length, 3);
  assert.ok(p.sections[0].rows[0].id.startsWith(".buron"));
});
await ok("B6 interactive punya title/footer/header", () => {
  const im = buildBuronInteractive(BURON_DUMMY).interactiveMessage;
  assert.ok(im.title && im.footer && im.header);
});
await ok("B7 Dugong.detectType(INTERACTIVE)", () => {
  const d = new ourin.Dugong(async () => ({}), async () => ({}), {}, {});
  assert.equal(d.detectType({ interactiveMessage: { title: "x" } }), "INTERACTIVE");
});
await ok("B8 Dugong.handleInteractive body+footer+buttons", async () => {
  const d = new ourin.Dugong(async () => ({}), async () => ({}), {}, {});
  const r = await d.handleInteractive({ interactiveMessage: { title: "Halo", footer: "F", buttons: buildBuronButtons() } }, "1@s.whatsapp.net", null);
  assert.equal(r.interactiveMessage.body.text, "Halo");
  assert.equal(r.interactiveMessage.nativeFlowMessage.buttons.length, 3);
});

// --- LAINNYA (ORich/table) ---
await ok("C1 ORich addText+build", async () => {
  const r = new ORich({ relayMessage: async () => ({}) });
  r.addText("halo buron");
  assert.ok(await r.build());
});

// --- SENDER (prioritas ourin → interactive → teks) ---
await ok("S1 pakai sendList kalau ada", async () => {
  let used = "";
  const sock = { sendList: async () => ((used = "sendList"), {}), sendMessage: async () => ((used = "other"), {}) };
  await sendBuronList(sock, "1@s.whatsapp.net", BURON_DUMMY, null);
  assert.equal(used, "sendList");
});
await ok("S2 pakai interactive kalau sendList tak ada", async () => {
  let sent = null;
  const sock = { sendMessage: async (jid, content) => ((sent = content), {}) };
  await sendBuronList(sock, "1@s.whatsapp.net", BURON_DUMMY, null);
  assert.ok(sent.interactiveMessage);
});
await ok("S3 fallback teks kalau sendMessage cuma teks (legacy)", async () => {
  let sent = null;
  const sock = {
    sendMessage: async (jid, content) => {
      if (content.interactiveMessage) throw new Error("not supported");
      sent = content;
      return {};
    },
  };
  await sendBuronList(sock, "1@s.whatsapp.net", BURON_DUMMY, null);
  assert.ok(sent.text.includes("DAFTAR BURON"));
});

// --- PLUGIN run() ---
function fakeCtx(over = {}) {
  const replies = [];
  return {
    replies,
    prefix: ".",
    sendTyping: async () => {},
    reply: async (t) => replies.push(t),
    ...over,
  };
}
const fakeMsg = (jid = "1@s.whatsapp.net") => ({ key: { remoteJid: jid, id: "X" }, pushName: "U" });
await ok("P1 plugin meta benar", () => {
  assert.equal(plugin.name, "buronlist");
  assert.ok(plugin.aliases.includes("buron"));
});
await ok("P2 run() full list via sendList", async () => {
  let got = null;
  const sock = { sendList: async (jid, title) => ((got = title), {}) };
  const ctx = fakeCtx();
  await plugin.run(sock, fakeMsg(), [], ctx);
  assert.equal(got, "DAFTAR BURON");
});
await ok("P3 run() filter nama ketemu", async () => {
  let got = null;
  const sock = { sendList: async (jid, title, items) => ((got = items), {}) };
  await plugin.run(sock, fakeMsg(), ["andi"], fakeCtx());
  assert.equal(got.length, 1);
});
await ok("P4 run() filter tak ketemu → reply tidak ditemukan", async () => {
  const sock = { sendList: async () => assert.fail("jangan kepanggil") };
  const ctx = fakeCtx();
  await plugin.run(sock, fakeMsg(), ["zzz"], ctx);
  assert.ok(ctx.replies[0].includes("tidak ditemukan"));
});
await ok("P5 run() di legacy sock fallback teks jalan", async () => {
  let sent = null;
  const sock = {
    sendMessage: async (jid, c) => {
      if (c.interactiveMessage) throw new Error("no");
      sent = c;
      return {};
    },
  };
  await plugin.run(sock, fakeMsg(), [], fakeCtx());
  assert.ok(sent.text.includes("Andi"));
});

for (const r of out) console.log(r);
console.log(`\n${pass}/${total} lolos ${pass === total ? "— 100% BISA ✅" : "— BELUM 100% ❌"}`);
process.exitCode = pass === total ? 0 : 1;
