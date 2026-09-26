import fs from "fs";
import path from "path";
import { createCanvas } from "@napi-rs/canvas";

const TRX_DB_PATH = path.join(process.cwd(), "database", "transactions.json");

/**
 * Format number to Indonesian Rupiah (Rp xx.xxx)
 */
export function formatRupiah(amount) {
  const num = typeof amount === "number" ? amount : Number(String(amount).replace(/[^0-9.-]+/g, "")) || 0;
  return "Rp " + Math.round(num).toLocaleString("id-ID");
}

/**
 * Ensure database file exists
 */
function getTransactionsDb() {
  try {
    const dir = path.dirname(TRX_DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(TRX_DB_PATH)) {
      fs.writeFileSync(TRX_DB_PATH, JSON.stringify([], null, 2), "utf-8");
      return [];
    }
    const content = fs.readFileSync(TRX_DB_PATH, "utf-8");
    return JSON.parse(content || "[]");
  } catch (_) {
    return [];
  }
}

/**
 * Save transactions to disk
 */
function saveTransactionsDb(data) {
  try {
    const dir = path.dirname(TRX_DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(TRX_DB_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save transactions.json:", err);
  }
}

/**
 * Generate formatted timestamp in WIB
 */
export function getJakartaTime() {
  const d = new Date();
  const dateStr = d.toLocaleDateString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const timeStr = d.toLocaleTimeString("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return `${dateStr} ${timeStr} WIB`;
}

/**
 * Create a new transaction
 */
export function createTransaction({
  item,
  price,
  buyer,
  buyerJid = null,
  payment = "QRIS",
  status = "LUNAS",
  note = "-",
  sellerJid = null,
  groupJid = null,
  storeName = "RIZZER STORE",
}) {
  const list = getTransactionsDb();
  const dateObj = new Date();
  const ymd = dateObj.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  const id = `TRX-${ymd}-${rand}`;

  const cleanPrice = typeof price === "number" ? price : Number(String(price).replace(/[^0-9.-]+/g, "")) || 0;

  const trx = {
    id,
    storeName: storeName || "RIZZER STORE",
    item: String(item || "Item Pesanan").trim(),
    price: cleanPrice,
    formattedPrice: formatRupiah(cleanPrice),
    buyer: String(buyer || "Customer").trim(),
    buyerJid,
    payment: String(payment || "QRIS").trim().toUpperCase(),
    status: normalizeStatus(status),
    note: String(note || "-").trim(),
    time: getJakartaTime(),
    createdAt: Date.now(),
    sellerJid,
    groupJid,
  };

  list.unshift(trx);
  // Keep last 1000 transactions
  if (list.length > 1000) list.length = 1000;
  saveTransactionsDb(list);

  return trx;
}

/**
 * Normalize status string
 */
export function normalizeStatus(raw) {
  const s = String(raw || "").trim().toLowerCase();
  if (s.includes("lunas") || s.includes("sukses") || s.includes("success") || s.includes("done") || s.includes("berhasil")) {
    return "LUNAS";
  }
  if (s.includes("batal") || s.includes("cancel") || s.includes("gagal") || s.includes("failed")) {
    return "BATAL";
  }
  if (s.includes("proses") || s.includes("process") || s.includes("antri")) {
    return "PROSES";
  }
  return "PENDING";
}

export function getStatusBadge(status) {
  switch (status) {
    case "LUNAS":
      return { text: "✅ LUNAS (BERHASIL)", color: "#10b981", bg: "#064e3b" };
    case "PROSES":
      return { text: "🔄 SEDANG DIPROSES", color: "#38bdf8", bg: "#0c4a6e" };
    case "BATAL":
      return { text: "❌ DIBATALKAN", color: "#f87171", bg: "#7f1d1d" };
    case "PENDING":
    default:
      return { text: "⏳ MENUNGGU PEMBAYARAN", color: "#fbbf24", bg: "#78350f" };
  }
}

/**
 * Get transaction by ID
 */
export function getTransaction(id) {
  const list = getTransactionsDb();
  const q = String(id || "").trim().toUpperCase();
  return list.find((t) => t.id === q || t.id.includes(q)) || null;
}

/**
 * Update transaction status
 */
export function updateTransaction(id, updates = {}) {
  const list = getTransactionsDb();
  const q = String(id || "").trim().toUpperCase();
  const idx = list.findIndex((t) => t.id === q || t.id.includes(q));
  if (idx === -1) return null;

  if (updates.status) {
    updates.status = normalizeStatus(updates.status);
  }
  list[idx] = { ...list[idx], ...updates, updatedAt: Date.now() };
  saveTransactionsDb(list);
  return list[idx];
}

/**
 * List recent transactions
 */
export function listTransactions({ limit = 10, groupJid = null } = {}) {
  const list = getTransactionsDb();
  let filtered = list;
  if (groupJid) {
    filtered = filtered.filter((t) => t.groupJid === groupJid);
  }
  return filtered.slice(0, Math.min(limit, 50));
}

/**
 * Delete a transaction
 */
export function deleteTransaction(id) {
  const list = getTransactionsDb();
  const q = String(id || "").trim().toUpperCase();
  const idx = list.findIndex((t) => t.id === q || t.id.includes(q));
  if (idx === -1) return false;
  list.splice(idx, 1);
  saveTransactionsDb(list);
  return true;
}

/**
 * Generate a modern, high-resolution aesthetic Receipt Card (PNG)
 */
export async function generateReceiptCard(trx) {
  const width = 640;
  const height = 880;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Background - Deep Cyber Obsidian
  ctx.fillStyle = "#0d1117";
  ctx.fillRect(0, 0, width, height);

  // Decorative ambient glow
  const grad = ctx.createRadialGradient(width / 2, 80, 20, width / 2, 80, 300);
  grad.addColorStop(0, "rgba(56, 189, 248, 0.15)");
  grad.addColorStop(1, "rgba(13, 17, 23, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Main Card Container with sleek border
  const cardX = 30;
  const cardY = 30;
  const cardW = width - 60;
  const cardH = height - 60;
  const radius = 24;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, radius);
  ctx.fillStyle = "#161b22";
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "#30363d";
  ctx.stroke();
  ctx.restore();

  // Top Store Name
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 26px sans-serif";
  ctx.fillText((trx.storeName || "RIZZER STORE").toUpperCase(), width / 2, cardY + 50);

  ctx.fillStyle = "#8b949e";
  ctx.font = "14px sans-serif";
  ctx.fillText("OFFICIAL TRANSACTION RECEIPT", width / 2, cardY + 75);

  // Status Badge
  const badge = getStatusBadge(trx.status);
  const badgeW = 240;
  const badgeH = 36;
  const badgeX = (width - badgeW) / 2;
  const badgeY = cardY + 95;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 18);
  ctx.fillStyle = badge.bg;
  ctx.fill();
  ctx.strokeStyle = badge.color;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = badge.color;
  ctx.font = "bold 14px sans-serif";
  ctx.fillText(badge.text, width / 2, badgeY + 23);
  ctx.restore();

  // Dashed receipt divider line
  ctx.save();
  ctx.strokeStyle = "#30363d";
  ctx.setLineDash([8, 6]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cardX + 24, cardY + 160);
  ctx.lineTo(cardX + cardW - 24, cardY + 160);
  ctx.stroke();
  ctx.restore();

  // Detail Rows
  const details = [
    { label: "ID Transaksi", val: trx.id, isHighlight: true },
    { label: "Waktu / Tanggal", val: trx.time },
    { label: "Nama Pembeli", val: trx.buyer },
    { label: "Metode Bayar", val: trx.payment },
    { label: "Nama Barang", val: trx.item },
  ];

  let currentY = cardY + 200;
  const leftX = cardX + 32;
  const rightX = cardX + cardW - 32;

  for (const row of details) {
    ctx.textAlign = "left";
    ctx.fillStyle = "#8b949e";
    ctx.font = "15px sans-serif";
    ctx.fillText(row.label, leftX, currentY);

    ctx.textAlign = "right";
    ctx.fillStyle = row.isHighlight ? "#58a6ff" : "#f0f6fc";
    ctx.font = row.isHighlight ? "bold 15px monospace" : "15px sans-serif";

    // Text truncation if too long
    let valStr = String(row.val || "-");
    if (valStr.length > 28) valStr = valStr.substring(0, 26) + "...";
    ctx.fillText(valStr, rightX, currentY);

    currentY += 38;
  }

  // Dashed divider line before total
  ctx.save();
  ctx.strokeStyle = "#30363d";
  ctx.setLineDash([8, 6]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cardX + 24, currentY + 10);
  ctx.lineTo(cardX + cardW - 24, currentY + 10);
  ctx.stroke();
  ctx.restore();

  currentY += 40;

  // Total Box
  const totalBoxH = 80;
  const totalBoxW = cardW - 48;
  const totalBoxX = cardX + 24;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(totalBoxX, currentY, totalBoxW, totalBoxH, 16);
  ctx.fillStyle = "#21262d";
  ctx.fill();
  ctx.strokeStyle = "#388bfd";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.textAlign = "left";
  ctx.fillStyle = "#8b949e";
  ctx.font = "14px sans-serif";
  ctx.fillText("TOTAL PEMBAYARAN", totalBoxX + 20, currentY + 34);

  ctx.textAlign = "right";
  ctx.fillStyle = "#3fb950";
  ctx.font = "bold 26px sans-serif";
  ctx.fillText(trx.formattedPrice, totalBoxX + totalBoxW - 20, currentY + 48);
  ctx.restore();

  currentY += totalBoxH + 30;

  // Note Box if note provided
  if (trx.note && trx.note !== "-") {
    ctx.textAlign = "left";
    ctx.fillStyle = "#8b949e";
    ctx.font = "italic 13px sans-serif";
    ctx.fillText(`Catatan: ${trx.note.slice(0, 45)}`, leftX, currentY);
    currentY += 24;
  }

  // Footer barcode simulation
  const barY = cardY + cardH - 85;
  const barCount = 42;
  const barStartX = (width - barCount * 8) / 2;

  ctx.fillStyle = "#484f58";
  for (let i = 0; i < barCount; i++) {
    const barW = (i % 3 === 0 ? 4 : 2);
    ctx.fillRect(barStartX + i * 8, barY, barW, 35);
  }

  ctx.textAlign = "center";
  ctx.fillStyle = "#8b949e";
  ctx.font = "12px monospace";
  ctx.fillText(`* ${trx.id} *`, width / 2, barY + 52);

  ctx.fillStyle = "#6e7681";
  ctx.font = "11px sans-serif";
  ctx.fillText("Terima kasih atas pesanan Anda! Simpan struk ini sebagai bukti transaksi.", width / 2, cardY + cardH - 12);

  return canvas.toBuffer("image/png");
}

/**
 * Format transaction as WhatsApp text
 */
export function formatTrxText(trx) {
  const badge = getStatusBadge(trx.status);
  return (
    `🧾 *STRUK TRANSAKSI RESMI*\n` +
    `🏪 *${(trx.storeName || "RIZZER STORE").toUpperCase()}*\n` +
    `─────────────────────────\n` +
    `🆔 *ID Trx:* \`${trx.id}\`\n` +
    `📅 *Tanggal:* ${trx.time}\n` +
    `👤 *Pembeli:* ${trx.buyer}\n` +
    `🛒 *Barang/Layanan:* *${trx.item}*\n` +
    `💳 *Metode:* ${trx.payment}\n` +
    `💰 *Total:* *${trx.formattedPrice}*\n` +
    `📌 *Status:* ${badge.text}\n` +
    (trx.note && trx.note !== "-" ? `📝 *Catatan:* ${trx.note}\n` : "") +
    `─────────────────────────\n` +
    `_Terima kasih telah berbelanja!_`
  );
}
