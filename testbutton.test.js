// testbutton.test.js — logic button ourin: quick_reply, cta_url, cta_copy, single_select
// Run: node testbutton.test.js
import assert from "node:assert/strict";
import { Dugong } from "ourin-baileys";
import plugin, {
  buildTestButtons,
  buildTestButtonContent,
  buildTestButtonText,
  sendTestButton,
} from "./plugins/tools/util/testbutton.js";

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

await ok("T1 4 button valid JSON", () => {
  const b = buildTestButtons(".");
  assert.equal(b.length, 4);
  for (const x of b) assert.ok(JSON.parse(x.buttonParamsJson));
});
await ok("T2 nama button sesuai ourin", () => {
  assert.deepEqual(
    buildTestButtons(".").map((b) => b.name),
    ["quick_reply", "cta_url", "cta_copy", "single_select"]
  );
});
await ok("T3 quick_reply ada display_text + id", () => {
  const p = JSON.parse(buildTestButtons(".")[0].buttonParamsJson);
  assert.ok(p.display_text && p.id);
});
await ok("T4 cta_url https + cta_copy code", () => {
  const url = JSON.parse(buildTestButtons(".")[1].buttonParamsJson);
  const cp = JSON.parse(buildTestButtons(".")[2].buttonParamsJson);
  assert.ok(url.url.startsWith("https://") && cp.copy_code);
});
await ok("T5 single_select 2 rows + id prefix", () => {
  const p = JSON.parse(buildTestButtons(".")[3].buttonParamsJson);
  assert.equal(p.sections[0].rows.length, 2);
  assert.ok(p.sections[0].rows[0].id.startsWith(".testbutton"));
});
await ok("T6 content ada title/footer/header", () => {
  const im = buildTestButtonContent(".").interactiveMessage;
  assert.ok(im.title && im.footer && im.header && im.buttons.length === 4);
});
await ok("T7 Dugong.detectType = INTERACTIVE", () => {
  const d = new Dugong(async () => ({}), async () => ({}), {}, {});
  assert.equal(d.detectType({ interactiveMessage: { title: "x" } }), "INTERACTIVE");
});
await ok("T8 Dugong.handleInteractive body+4 buttons", async () => {
  const d = new Dugong(async () => ({}), async () => ({}), {}, {});
  const r = await d.handleInteractive({ interactiveMessage: buildTestButtonContent(".").interactiveMessage }, "1@s.whatsapp.net", null);
  assert.equal(r.interactiveMessage.body.text, "🔘 TEST BUTTON OURIN");
  assert.equal(r.interactiveMessage.nativeFlowMessage.buttons.length, 4);
});
await ok("T9 alur kirim full via Dugong + relay", async () => {
  let got = null;
  const d = new Dugong(
    async () => ({}),
    async (jid, msg) => ((got = { jid, msg }), {})
  );
  const content = buildTestButtonContent(".");
  assert.equal(d.detectType(content), "INTERACTIVE");
  const wire = await d.handleInteractive(content, "1@s.whatsapp.net", null);
  await d.relayMessage("1@s.whatsapp.net", wire);
  assert.equal(got.jid, "1@s.whatsapp.net");
  assert.ok(got.msg.interactiveMessage);
});
await ok("T10 sendTestButton pakai interactive di sock ourin", async () => {
  let sent = null;
  const sock = { sendMessage: async (jid, c) => ((sent = c), {}) };
  await sendTestButton(sock, "1@s.whatsapp.net", null);
  assert.ok(sent.interactiveMessage);
});
await ok("T11 fallback teks di sock legacy", async () => {
  let sent = null;
  const sock = {
    sendMessage: async (jid, c) => {
      if (c.interactiveMessage) throw new Error("not supported");
      sent = c;
      return {};
    },
  };
  await sendTestButton(sock, "1@s.whatsapp.net", null);
  assert.ok(sent.text.includes("TEST BUTTON"));
});
await ok("T12 teks fallback ada semua opsi", () => {
  const t = buildTestButtonText();
  assert.ok(t.includes("Cek Buron") && t.includes("https://example.com") && t.includes("BTN-2024"));
});
await ok("P1 meta plugin benar", () => {
  assert.equal(plugin.name, "testbutton");
  assert.ok(plugin.aliases.includes("btntest"));
});
await ok("P2 run() kirim interactive", async () => {
  let sent = null;
  const sock = { sendMessage: async (jid, c) => ((sent = c), {}) };
  const ctx = { prefix: ".", sendTyping: async () => {} };
  await plugin.run(sock, { key: { remoteJid: "1@s.whatsapp.net" } }, [], ctx);
  assert.ok(sent.interactiveMessage.buttons.length === 4);
});
await ok("P3 run() fallback jalan di legacy", async () => {
  let sent = null;
  const sock = {
    sendMessage: async (jid, c) => {
      if (c.interactiveMessage) throw new Error("no");
      sent = c;
      return {};
    },
  };
  await plugin.run(sock, { key: { remoteJid: "1@s.whatsapp.net" } }, [], { prefix: ".", sendTyping: async () => {} });
  assert.ok(sent.text.includes("TEST BUTTON"));
});

for (const r of out) console.log(r);
console.log(`\n${pass}/${total} lolos ${pass === total ? "— 100% BISA ✅" : "— BELUM 100% ❌"}`);
process.exitCode = pass === total ? 0 : 1;
