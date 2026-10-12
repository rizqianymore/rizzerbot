export function parseTrxInput(rawText, quoted, getTargetJid) {
  let item = "";
  let price = 0;
  let buyer = "";
  let payment = "QRIS";
  let status = "LUNAS";
  let note = "-";

  const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);

  const isKeyValue = lines.some((l) => /^(barang|pesanan|item|harga|price|nominal|buyer|pembeli|metode|payment|status|catatan|note):/i.test(l));

  if (isKeyValue) {
    for (const line of lines) {
      const match = line.match(/^([^:]+):\s*(.+)$/);
      if (match) {
        const key = match[1].trim().toLowerCase();
        const val = match[2].trim();
        if (["barang", "pesanan", "item", "produk"].includes(key)) item = val;
        else if (["harga", "price", "nominal", "total"].includes(key)) price = val;
        else if (["buyer", "pembeli", "customer", "nama"].includes(key)) buyer = val;
        else if (["metode", "payment", "via", "pembayaran"].includes(key)) payment = val;
        else if (["status"].includes(key)) status = val;
        else if (["catatan", "note", "ket", "keterangan"].includes(key)) note = val;
      }
    }
  } else if (rawText.includes("|")) {
    const parts = rawText.split("|").map((p) => p.trim());
    if (parts[0]) item = parts[0];
    if (parts[1]) price = parts[1];
    if (parts[2]) buyer = parts[2];
    if (parts[3]) payment = parts[3];
    if (parts[4]) status = parts[4];
    if (parts[5]) note = parts[5];
  } else {

    const words = rawText.split(/\s+/);
    if (words.length >= 2) {

      const priceIdx = words.findIndex((w) => /^\d+(\.\d+)?k?$/i.test(w) || /^rp\.?\d+/i.test(w));
      if (priceIdx !== -1) {
        item = words.slice(0, priceIdx).join(" ");
        let rawP = words[priceIdx].toLowerCase().replace(/^rp\.?/, "");
        if (rawP.endsWith("k")) rawP = String(parseFloat(rawP) * 1000);
        price = rawP;
        if (words[priceIdx + 1]) buyer = words.slice(priceIdx + 1).join(" ");
      } else {
        item = words.slice(0, -1).join(" ");
        price = words[words.length - 1];
      }
    }
  }

  if (!buyer && quoted) {
    buyer = "Customer (Replied)";
  }

  return { item, price, buyer, payment, status, note };
}
