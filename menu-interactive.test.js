// menu-interactive.test.js — .menu kompak + buton kategori (1 pesan, reusable)
// Run: node menu-interactive.test.js
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

const menu = await import("./plugins/menu.js");
const buron = await import("./plugins/tools/util/buronlist.js");
const testbtn = await import("./plugins/tools/util/testbutton.js");
const { commands } = await import("./src/core/loader.js");
const { resolveCategoryAlias } = await import("./src/core/categories.js");

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

await ok("H1 header ada botName/prefix/role/total", () => {
  const h = menu.renderMenuHeader({ botName: "Rizzer", prefix: ".", role: "Owner", totalCmds: 7 });
  assert.ok(h.includes("Rizzer") && h.includes("[ . ]") && h.includes("Owner") && h.includes("7 Perintah"));
});
await ok("B1 2 buton: quick Semua + single_select", () => {
  const b = menu.buildMenuButtons(["Tools", "General"], ".");
  assert.deepEqual(
    b.map((x) => x.name),
    ["quick_reply", "single_select"]
  );
  assert.equal(JSON.parse(b[0].buttonParamsJson).id, ".menu all");
});
await ok("B2 rows kategori + id tap routing", () => {
  const sel = JSON.parse(menu.buildMenuButtons(["Tools"], ".")[1].buttonParamsJson);
  assert.equal(sel.sections[0].rows[0].id, ".menu Tools");
  assert.equal(resolveCategoryAlias("tools"), "Tools");
});
await ok("B3 tap .menu all → path showAll", () => {
  assert.equal(JSON.parse(menu.buildMenuButtons([], ".")[0].buttonParamsJson).id, ".menu all");
});
await ok("S1 guard panjang: pendek ya, panjang/teks kosong tidak", () => {
  assert.ok(menu.shouldUseInteractive("pendek"));
  assert.ok(!menu.shouldUseInteractive("x".repeat(901)));
  assert.ok(!menu.shouldUseInteractive(""));
});
await ok("M1 buronlist+testbutton kategori Tools (nongol di menu)", () => {
  assert.equal(buron.default.category, "Tools");
  assert.equal(testbtn.default.category, "Tools");
});

// --- run() dengan command palsu ---
function fakeCmd(name, category) {
  return { name, aliases: [], description: "d", usage: "", category, filePath: `/x/${name}.js` };
}
const msg = { key: { remoteJid: "1@s.whatsapp.net", id: "M" }, pushName: "U", message: { conversation: ".menu" } };
const baseCtx = () => ({
  prefix: ".",
  sendTyping: async () => {},
  reply: async () => {},
  isOwner: true,
  isAdmin: false,
  isPremium: false,
  activeSettings: { botName: "TestBot", prefix: ".", silentDeny: true },
});

await ok("R1 .menu → TEPAT 1 pesan interactive", async () => {
  commands.set("aa", fakeCmd("aa", "Tools"));
  commands.set("bb", fakeCmd("bb", "General"));
  try {
    const sends = [];
    const sock = { sendMessage: async (jid, c) => sends.push(c) };
    await menu.default.run(sock, msg, [], baseCtx());
    assert.equal(sends.length, 1);
    const im = sends[0].interactiveMessage;
    assert.ok(im.title.includes("TestBot"));
    assert.equal(im.buttons.length, 2);
  } finally {
    commands.delete("aa");
    commands.delete("bb");
  }
});
await ok("R2 sock legacy → fallback teks jalan", async () => {
  commands.set("aa", fakeCmd("aa", "Tools"));
  try {
    const sends = [];
    const sock = {
      sendMessage: async (jid, c) => {
        if (c.interactiveMessage) throw new Error("not supported");
        sends.push(c);
        return {};
      },
    };
    await menu.default.run(sock, msg, [], baseCtx());
    assert.equal(sends.length, 1);
    assert.ok((sends[0].text || sends[0].caption || "").includes("TestBot"));
  } finally {
    commands.delete("aa");
  }
});
await ok("R3 .menu tools → interactive isi kategori", async () => {
  commands.set("aa", fakeCmd("aa", "Tools"));
  commands.set("bb", fakeCmd("bb", "General"));
  try {
    const sends = [];
    const sock = { sendMessage: async (jid, c) => sends.push(c) };
    await menu.default.run(sock, msg, ["tools"], baseCtx());
    assert.equal(sends.length, 1);
    assert.ok(sends[0].interactiveMessage.title.includes("TOOLS"));
  } finally {
    commands.delete("aa");
    commands.delete("bb");
  }
});
await ok("R4 .menu all → teks full (jalur lama)", async () => {
  commands.set("aa", fakeCmd("aa", "Tools"));
  try {
    const sends = [];
    const sock = { sendMessage: async (jid, c) => sends.push(c) };
    await menu.default.run(sock, msg, ["all"], baseCtx());
    assert.equal(sends.length, 1);
    assert.ok(!sends[0].interactiveMessage);
  } finally {
    commands.delete("aa");
  }
});

// --- integrasi dispatch asli: ketik .menu lalu tap kategori ---
await ok("I1 dispatch .menu → 1 pesan interactive utama", async () => {
  const { dispatchMessage } = await import("./src/core/dispatch/run.js");
  commands.set("menu", menu.default);
  commands.set("aa", fakeCmd("aa", "Tools"));
  commands.set("bb", fakeCmd("bb", "General"));
  try {
    const sends = [];
    const sock = {
      user: { id: "9@s.whatsapp.net" },
      isSubBot: false,
      sendMessage: async (jid, c) => sends.push(c),
      sendPresenceUpdate: async () => {},
      readMessages: async () => {},
    };
    const logger = { info: () => {}, warn: () => {}, error: () => {} };
    await dispatchMessage(
      sock,
      {
        key: { remoteJid: "8@s.whatsapp.net", id: `I1-${Date.now()}`, fromMe: true },
        pushName: "T",
        messageTimestamp: Math.floor(Date.now() / 1000),
        message: { conversation: ".menu" },
      },
      logger
    );
    assert.equal(sends.length, 1);
    assert.equal(sends[0].interactiveMessage.buttons.length, 2);
  } finally {
    commands.delete("menu");
    commands.delete("aa");
    commands.delete("bb");
  }
});
await ok("I2 dispatch tap .menu Tools → 1 pesan isi TOOLS", async () => {
  const { dispatchMessage } = await import("./src/core/dispatch/run.js");
  commands.set("menu", menu.default);
  commands.set("aa", fakeCmd("aa", "Tools"));
  commands.set("bb", fakeCmd("bb", "General"));
  try {
    const sends = [];
    const sock = {
      user: { id: "9@s.whatsapp.net" },
      isSubBot: false,
      sendMessage: async (jid, c) => sends.push(c),
      sendPresenceUpdate: async () => {},
      readMessages: async () => {},
    };
    const logger = { info: () => {}, warn: () => {}, error: () => {} };
    await dispatchMessage(
      sock,
      {
        key: { remoteJid: "8@s.whatsapp.net", id: `I2-${Date.now()}`, fromMe: true },
        pushName: "T",
        messageTimestamp: Math.floor(Date.now() / 1000),
        message: {
          interactiveResponseMessage: {
            nativeFlowResponseMessage: { paramsJson: JSON.stringify({ id: ".menu Tools" }) },
          },
        },
      },
      logger
    );
    assert.equal(sends.length, 1);
    assert.ok(sends[0].interactiveMessage.title.includes("TOOLS"));
  } finally {
    commands.delete("menu");
    commands.delete("aa");
    commands.delete("bb");
  }
});

for (const r of out) console.log(r);
console.log(`\n${pass}/${total} lolos ${pass === total ? "— 100% BISA ✅" : "— BELUM 100% ❌"}`);
process.exitCode = pass === total ? 0 : 1;
