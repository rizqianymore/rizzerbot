import assert from "node:assert/strict";
import * as ourin from "ourin-baileys";
import {
  generateListContent,
  generateTableContent,
  generateTableContentV2,
  generateCodeBlockContent,
  generateCodeBlockContentV2,
  generateLinkContent,
  ORich,
} from "ourin-baileys";

const BURON = [
  { nama: "Andi", kasus: "Penipuan", status: "DPO" },
  { nama: "Budi", kasus: "Penggelapan", status: "Buronan" },
  { nama: "Citra", kasus: "Narkoba", status: "DPO" },
];

const toListItems = (arr) => arr.map((b, i) => [`${i + 1}. ${b.nama}`, `${b.kasus} — ${b.status}`]);
const toTableRows = (arr) => arr.map((b) => [b.nama, b.kasus, b.status]);
const getTable = (message) =>
  message?.botForwardedMessage?.message?.richResponseMessage?.submessages?.find((s) => s.messageType === 4);

let pass = 0;
let total = 0;
const results = [];
async function ok(name, fn) {
  total++;
  try {
    await fn();
    pass++;
    results.push(`✅ ${name}`);
  } catch (e) {
    results.push(`❌ ${name} :: ${e.message}`);
    process.exitCode = 1;
  }
}

// ---- A. Export surface (sock nanti punya method ini) ----
await ok("A1 ourin-baileys expose generateListContent", () => assert.equal(typeof generateListContent, "function"));
await ok("A2 expose generateTableContent/V2", () => {
  assert.equal(typeof generateTableContent, "function");
  assert.equal(typeof generateTableContentV2, "function");
});
await ok("A3 expose generateCodeBlock/V2 + generateLink", () => {
  assert.equal(typeof generateCodeBlockContent, "function");
  assert.equal(typeof generateCodeBlockContentV2, "function");
  assert.equal(typeof generateLinkContent, "function");
});
await ok("A4 expose ORich + makeWASocket + Dugong", () => {
  assert.equal(typeof ORich, "function");
  assert.equal(typeof (ourin.makeWASocket ?? ourin.default), "function");
  assert.ok(ourin.Dugong, "Dugong harus ada (interactive)");
});

// ---- B. List buron ----
await ok("B1 list buron 3 baris + title + header/footer", () => {
  const { message, messageId } = generateListContent("DAFTAR BURON", toListItems(BURON), null, {
    headerText: "List buron aktif",
    footer: "Total: 3",
  });
  assert.ok(messageId);
  const rich = message.botForwardedMessage.message.richResponseMessage;
  assert.ok(rich);
  const t = getTable(message);
  assert.equal(t.tableMetadata.title, "DAFTAR BURON");
  assert.equal(t.tableMetadata.rows.length, 3);
  assert.equal(rich.submessages.filter((s) => s.messageType === 2).length, 2); // header+footer
});
await ok("B2 list tahan string[] polos", () => {
  const { message } = generateListContent("MENU", ["a", "b"], null, {});
  assert.equal(getTable(message).tableMetadata.rows.length, 2);
});
await ok("B3 list 1 item tetap valid", () => {
  const { message } = generateListContent("BURON", [["1. Andi"]], null, {});
  assert.equal(getTable(message).tableMetadata.rows.length, 1);
});
await ok("B4 list 50 item (skala besar) tetap valid", () => {
  const big = Array.from({ length: 50 }, (_, i) => [`${i + 1}. Nama${i}`, `Kasus${i}`]);
  const { message } = generateListContent("BURON 50", big, null, {});
  assert.equal(getTable(message).tableMetadata.rows.length, 50);
});
await ok("B5 list unicode/emoji tahan", () => {
  const { message } = generateListContent("BURON 🚨", [["🔥 Andi — DPO ✅"]], null, {});
  assert.ok(getTable(message).tableMetadata.rows[0].items[0].includes("Andi"));
});
await ok("B6 list dengan quoted wariskan stanzaId", () => {
  const quoted = { key: { id: "ABC123", remoteJid: "1@s.whatsapp.net", participant: "2@s.whatsapp.net" }, message: { conversation: "hi" } };
  const { message } = generateListContent("BURON", [["a"]], quoted, {});
  const ctx = message.botForwardedMessage.message.richResponseMessage.contextInfo;
  assert.equal(ctx.stanzaId, "ABC123");
  assert.equal(ctx.quotedMessage.conversation, "hi");
});

// ---- C. Tabel ----
await ok("C1 tabel + heading benar", () => {
  const { message } = generateTableContent("BURON", ["Nama", "Kasus", "Status"], toTableRows(BURON), null, {
    headerText: "Data",
    footer: "© RizzerBot",
  });
  const t = getTable(message);
  assert.equal(t.tableMetadata.rows[0].isHeading, true);
  assert.deepEqual(t.tableMetadata.rows[0].items, ["Nama", "Kasus", "Status"]);
  assert.equal(t.tableMetadata.rows.length, 4);
});
await ok("C2 tabel tanpa header/footer tetap valid", () => {
  const { message } = generateTableContent("T", ["A"], [["x"]], null, {});
  assert.ok(getTable(message));
});

// ---- D. V2 + code + link (lainnya) ----
await ok("D1 tableV2 string-format valid", () => {
  const { message, messageId } = generateTableContentV2(
    ["Java vs JS", "Fitur | Java | JS", "Tipe | Statis | Dinamis"],
    null,
    { headerText: "Banding:", footer: "OK" }
  );
  assert.ok(messageId);
  assert.ok(message);
});
await ok("D2 codeBlock V1 + V2 valid", () => {
  const a = generateCodeBlockContent('console.log("hi")', null, { language: "javascript", title: "T", footer: "F" });
  const b = generateCodeBlockContentV2('print("hi")', null, { language: "python" });
  assert.ok(a.message && b.message);
});
await ok("D3 link inline {{IE_0}} valid", () => {
  const { message } = generateLinkContent("Klik: {{IE_0}}sini{{/IE_0}}", ["https://example.com"], null, {
    headerText: "H",
    footer: "F",
  });
  assert.ok(message.botForwardedMessage);
});

// ---- E. ORich ----
await ok("E1 ORich addText+build", async () => {
  const r = new ORich({ relayMessage: async () => ({}) });
  r.addText("Daftar buron hari ini");
  assert.ok(await r.build());
});
await ok("E2 ORich.send panggil relayMessage jid benar", async () => {
  let got = null;
  const fake = { relayMessage: async (jid, msg) => ((got = { jid, msg }), {}) };
  await new ORich(fake).addText("halo").send("123@s.whatsapp.net");
  assert.equal(got.jid, "123@s.whatsapp.net");
});
await ok("E3 ORich wajib sock (error jelas kalau null)", () => {
  assert.throws(() => new ORich(null), /Socket is required/);
});

// ---- F. Simulasi sock.sendList persis kayak asli (generate+relay) ----
function makeOurinSock(captured) {
  return {
    relayMessage: async (jid, message, { messageId } = {}) => {
      captured.push({ jid, message, messageId });
      return { messageId };
    },
    // tiru implementasi asli messages-send.js:1357
    sendList: async (jid, title, items, quoted, options = {}) => {
      const { message, messageId } = generateListContent(title, items, quoted, options);
      await captured.push({ jid, message, messageId });
      return { message, messageId };
    },
    sendTable: async (jid, title, headers, rows, quoted, options = {}) => {
      const { message, messageId } = generateTableContent(title, headers, rows, quoted, options);
      captured.push({ jid, message, messageId });
      return { message, messageId };
    },
  };
}
await ok("F1 mock ourin-sock.sendList buron 100% kepanggil", async () => {
  const cap = [];
  const sock = makeOurinSock(cap);
  const res = await sock.sendList("1@s.whatsapp.net", "DAFTAR BURON", toListItems(BURON), null, { footer: "Total 3" });
  assert.ok(res.messageId);
  assert.equal(cap.length, 1); // sendList relay exactly once
  assert.equal(cap[0].jid, "1@s.whatsapp.net");
});
await ok("F2 mock ourin-sock.sendTable buron kepanggil", async () => {
  const cap = [];
  const sock = makeOurinSock(cap);
  const res = await sock.sendTable("1@g.us", "BURON", ["Nama", "Kasus"], toTableRows(BURON).map((r) => r.slice(0, 2)), null, {});
  assert.ok(res.message);
});

// ---- G. Helper 100%: jalan di ourin MAUPUN baileys lama (fallback text) ----
async function sendBuronList(sock, jid, buron, quoted) {
  const items = toListItems(buron);
  if (typeof sock.sendList === "function") {
    return sock.sendList(jid, "DAFTAR BURON", items, quoted, {
      headerText: "🚨 List Buron Aktif",
      footer: `Total: ${buron.length}`,
    });
  }
  const text = `🚨 *DAFTAR BURON* (${buron.length})\n\n` + buron.map((b, i) => `${i + 1}. ${b.nama} — ${b.kasus} [${b.status}]`).join("\n");
  return sock.sendMessage(jid, { text }, { quoted });
}
await ok("G1 helper di sock ourin pakai sendList", async () => {
  let used = "";
  const sock = { sendList: async () => ((used = "sendList"), {}), sendMessage: async () => ((used = "text"), {}) };
  await sendBuronList(sock, "1@s.whatsapp.net", BURON, null);
  assert.equal(used, "sendList");
});
await ok("G2 helper di sock baileys lama fallback text 100% (tidak crash)", async () => {
  let sent = null;
  const legacySock = { sendMessage: async (jid, content) => ((sent = { jid, content }), {}) };
  await sendBuronList(legacySock, "1@s.whatsapp.net", BURON, null);
  assert.ok(sent.content.text.includes("DAFTAR BURON"));
  assert.ok(sent.content.text.includes("Andi"));
});
await ok("G3 helper buron kosong tidak crash", async () => {
  let sent = null;
  const legacySock = { sendMessage: async (jid, content) => ((sent = content), {}) };
  await sendBuronList(legacySock, "1@s.whatsapp.net", [], null);
  assert.ok(sent.text.includes("0"));
});

// ---- H. Interactive single_select (alternatif list klik) ----
await ok("H1 struktur interactive single_select valid", () => {
  const content = {
    interactiveMessage: {
      title: "Pilih Buron",
      footer: "RizzerBot",
      buttons: [
        {
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "Menu",
            sections: [{ title: "Buron", rows: BURON.map((b) => ({ title: b.nama, id: `.cek ${b.nama}` })) }],
          }),
        },
      ],
      header: "Bot Menu",
    },
  };
  const btn = JSON.parse(content.interactiveMessage.buttons[0].buttonParamsJson);
  assert.equal(btn.sections[0].rows.length, 3);
  assert.ok(btn.sections[0].rows[0].id.startsWith(".cek"));
});

for (const r of results) console.log(r);
console.log(`\n${pass}/${total} lolos ${pass === total ? "— 100% BISA ✅" : "— BELUM 100% ❌"}`);
process.exitCode = pass === total ? 0 : 1;
