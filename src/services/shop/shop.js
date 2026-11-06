import fs from "fs";
import path from "path";

const SHOP_DB_PATH = path.join(process.cwd(), "database", "shop.json");

function ensureDb() {
  const dir = path.dirname(SHOP_DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(SHOP_DB_PATH)) {
    const initial = {
      config: {
        shopName: "STORE",
        paymentInfo: "BCA: 1234567890 a/n STORE\nQRIS: Hubungi Owner / ketik .qris",
      },
      products: {},
      orders: [],
    };
    fs.writeFileSync(SHOP_DB_PATH, JSON.stringify(initial, null, 2), "utf-8");
    return initial;
  }
  try {
    const raw = fs.readFileSync(SHOP_DB_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {
      config: { shopName: "STORE", paymentInfo: "" },
      products: {},
      orders: [],
    };
  }
}

function saveDb(data) {
  try {
    fs.writeFileSync(SHOP_DB_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("[ShopDB] Error saving:", err.message);
  }
}

export function getShopConfig() {
  const data = ensureDb();
  return data.config || {};
}

export function updateShopConfig(patch) {
  const data = ensureDb();
  data.config = { ...data.config, ...patch };
  saveDb(data);
  return data.config;
}

export function listProducts() {
  const data = ensureDb();
  return Object.values(data.products || {});
}

export function getProduct(code) {
  if (!code) return null;
  const data = ensureDb();
  return data.products[code.toUpperCase()] || null;
}

export function saveProduct({ code, name, price, stock, desc }) {
  const data = ensureDb();
  const c = code.toUpperCase();
  data.products[c] = {
    code: c,
    name: name || c,
    price: Number(price) || 0,
    stock: stock === undefined ? -1 : Number(stock), // -1 = unlimited
    desc: desc || "",
    updatedAt: new Date().toISOString(),
  };
  saveDb(data);
  return data.products[c];
}

export function deleteProduct(code) {
  const data = ensureDb();
  const c = code.toUpperCase();
  if (!data.products[c]) return false;
  delete data.products[c];
  saveDb(data);
  return true;
}

export function recordOrder({ buyerJid, code, quantity, totalPrice, notes }) {
  const data = ensureDb();
  const c = code.toUpperCase();
  const prod = data.products[c];
  if (!prod) throw new Error(`Produk dengan kode ${c} tidak ditemukan.`);

  if (prod.stock !== -1) {
    if (prod.stock < quantity) {
      throw new Error(`Stok ${prod.name} tidak cukup (sisa: ${prod.stock}).`);
    }
    prod.stock -= quantity;
  }

  const orderId = `ORD-${Date.now().toString(36).toUpperCase()}`;
  const order = {
    id: orderId,
    buyerJid,
    productCode: c,
    productName: prod.name,
    quantity,
    totalPrice,
    notes: notes || "",
    status: "PENDING", // PENDING, PAID, COMPLETED, CANCELLED
    createdAt: new Date().toISOString(),
  };

  if (!data.orders) data.orders = [];
  data.orders.push(order);
  saveDb(data);
  return order;
}

export function listOrders(limit = 10) {
  const data = ensureDb();
  return (data.orders || []).slice(-limit).reverse();
}

export function getOrder(orderId) {
  const data = ensureDb();
  return (data.orders || []).find((o) => o.id.toUpperCase() === orderId.toUpperCase()) || null;
}

export function updateOrderStatus(orderId, status) {
  const data = ensureDb();
  const ord = (data.orders || []).find((o) => o.id.toUpperCase() === orderId.toUpperCase());
  if (!ord) return null;
  ord.status = status.toUpperCase();
  saveDb(data);
  return ord;
}
