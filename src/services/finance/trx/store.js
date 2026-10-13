import fs from "fs";
import path from "path";

const TRX_DB_PATH = path.join(process.cwd(), "database", "transactions.json");

export function formatRupiah(amount) {
  const num = typeof amount === "number" ? amount : Number(String(amount).replace(/[^0-9.-]+/g, "")) || 0;
  return "Rp " + Math.round(num).toLocaleString("id-ID");
}

export function getTransactionsDb() {
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

export function saveTransactionsDb(data) {
  try {
    const dir = path.dirname(TRX_DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(TRX_DB_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save transactions.json:", err);
  }
}

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
    payment: String(payment || "QRIS")
      .trim()
      .toUpperCase(),
    status: normalizeStatus(status),
    note: String(note || "-").trim(),
    time: getJakartaTime(),
    createdAt: Date.now(),
    sellerJid,
    groupJid,
  };

  list.unshift(trx);

  if (list.length > 1000) list.length = 1000;
  saveTransactionsDb(list);

  return trx;
}

export function normalizeStatus(raw) {
  const s = String(raw || "")
    .trim()
    .toLowerCase();
  if (
    s.includes("lunas") ||
    s.includes("sukses") ||
    s.includes("success") ||
    s.includes("done") ||
    s.includes("berhasil")
  ) {
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
