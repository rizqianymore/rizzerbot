// button-tap.test.js — tap buton sekali pakai: parser + kirim ulang fresh biar klik berkali-kali
// Run: node button-tap.test.js
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();
try {
  const link = path.join(cwd, "node_modules", "@");
  if (!fs.existsSync(path.join(link, "package.json"))) {
    fs.rmSync(link, { recursive: true, force: true });
    fs.symlinkSync(cwd, link, "junction");
  }
} catch (_) {}

const { extractButtonText, isButtonTap } = await import("./src/utils/buttons.js");
const buron = await import("./plugins/tools/util/buronlist.js");
const testbtn = await import("./plugins/tools/util/testbutton.js");

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

// --- extractor ---
await ok("E1 buttonsResponseMessage.selectedButtonId", () => {
  assert.equal(extractButtonText({ buttonsResponseMessage: { selectedButtonId: ".menu" } }), ".menu");
});
await ok("E2 listResponseMessage.singleSelectReply", () => {
  assert.equal(
    extractButtonText({ listResponseMessage: { singleSelectReply: { selectedRowId: ".buron Andi" } } }),
    ".buron Andi"
  );
});
await ok("E3 templateButtonReplyMessage.selectedId", () => {
  assert.equal(extractButtonText({ templateButtonReplyMessage: { selectedId: ".ping" } }), ".ping");
});
await ok("E4 interactiveResponse paramsJson id (quick_reply)", () => {
  assert.equal(
    extractButtonText({
      interactiveResponseMessage: { nativeFlowResponseMessage: { paramsJson: JSON.stringify({ id: ".buronlist" }) } },
    }),
    ".buronlist"
  );
});
await ok("E5 paramsJson rusak → string kosong", () => {
  assert.equal(
    extractButtonText({ interactiveResponseMessage: { nativeFlowResponseMessage: { paramsJson: "{rusak" } } }),
    ""
  );
});
await ok("E6 pesan teks biasa → kosong", () => {
  assert.equal(extractButtonText({ conversation: "halo" }), "");
  assert.equal(extractButtonText(null), "");
});

// --- isButtonTap ---
await ok("T1 tap terdeteksi 4 tipe", () => {
  assert.ok(isButtonTap({ message: { buttonsResponseMessage: {} } }));
  assert.ok(isButtonTap({ message: { listResponseMessage: {} } }));
  assert.ok(isButtonTap({ message: { templateButtonReplyMessage: {} } }));
  assert.ok(isButtonTap({ message: { interactiveResponseMessage: {} } }));
});
await ok("T2 teks biasa bukan tap", () => {
  assert.ok(!isButtonTap({ message: { conversation: ".menu" } }));
  assert.ok(!isButtonTap(null));
});

// --- rantai run.js: tap id kepakai sebagai command ---
await ok("R1 tap id prefix '.' lolos syarat prefix", () => {
  const content = extractButtonText({
    interactiveResponseMessage: { nativeFlowResponseMessage: { paramsJson: JSON.stringify({ id: ".testbutton 1" }) } },
  });
  assert.ok(content.startsWith("."));
  const args = content.slice(1).trim().split(/ +/).filter(Boolean);
  assert.equal(args[0], "testbutton");
});

// --- plugin reusable ---
function tapMsg(id) {
  return {
    key: { remoteJid: "1@s.whatsapp.net", id: "T" },
    message: {
      interactiveResponseMessage: { nativeFlowResponseMessage: { paramsJson: JSON.stringify({ id }) } },
    },
  };
}
const plainMsg = { key: { remoteJid: "1@s.whatsapp.net", id: "P" }, message: { conversation: ".x" } };
const ctx = () => ({ prefix: ".", sendTyping: async () => {}, reply: async () => {} });

await ok("P1 buronlist tap filter → 2 kirim (hasil + menu fresh)", async () => {
  let n = 0;
  const sock = { sendList: async () => void n++ };
  await buron.default.run(sock, tapMsg(".buron Andi"), ["andi"], ctx());
  assert.equal(n, 2);
});
await ok("P2 buronlist ketik manual → 1 kirim (tanpa spam)", async () => {
  let n = 0;
  const sock = { sendList: async () => void n++ };
  await buron.default.run(sock, plainMsg, ["andi"], ctx());
  assert.equal(n, 1);
});
await ok("P3 buronlist tap tanpa filter → 1 kirim", async () => {
  let n = 0;
  const sock = { sendList: async () => void n++ };
  await buron.default.run(sock, tapMsg(".buronlist"), [], ctx());
  assert.equal(n, 1);
});
await ok("P4 testbutton tap → 1 kirim fresh (langsung reusable)", async () => {
  let sent = null;
  const sock = { sendMessage: async (jid, c) => ((sent = c), {}) };
  await testbtn.default.run(sock, tapMsg(".testbutton 1"), ["1"], ctx());
  assert.ok(sent.interactiveMessage);
});

for (const r of out) console.log(r);
console.log(`\n${pass}/${total} lolos ${pass === total ? "— 100% BISA ✅" : "— BELUM 100% ❌"}`);
process.exitCode = pass === total ? 0 : 1;
