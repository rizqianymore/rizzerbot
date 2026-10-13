import { createCanvas } from "@napi-rs/canvas";
import { getStatusBadge } from "./query.js";

export async function generateReceiptCard(trx) {
  const width = 640;
  const height = 880;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#0d1117";
  ctx.fillRect(0, 0, width, height);

  const grad = ctx.createRadialGradient(width / 2, 80, 20, width / 2, 80, 300);
  grad.addColorStop(0, "rgba(56, 189, 248, 0.15)");
  grad.addColorStop(1, "rgba(13, 17, 23, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

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

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 26px sans-serif";
  ctx.fillText((trx.storeName || "RIZZER STORE").toUpperCase(), width / 2, cardY + 50);

  ctx.fillStyle = "#8b949e";
  ctx.font = "14px sans-serif";
  ctx.fillText("OFFICIAL TRANSACTION RECEIPT", width / 2, cardY + 75);

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

  ctx.save();
  ctx.strokeStyle = "#30363d";
  ctx.setLineDash([8, 6]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cardX + 24, cardY + 160);
  ctx.lineTo(cardX + cardW - 24, cardY + 160);
  ctx.stroke();
  ctx.restore();

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

    let valStr = String(row.val || "-");
    if (valStr.length > 28) valStr = valStr.substring(0, 26) + "...";
    ctx.fillText(valStr, rightX, currentY);

    currentY += 38;
  }

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

  if (trx.note && trx.note !== "-") {
    ctx.textAlign = "left";
    ctx.fillStyle = "#8b949e";
    ctx.font = "italic 13px sans-serif";
    ctx.fillText(`Catatan: ${trx.note.slice(0, 45)}`, leftX, currentY);
    currentY += 24;
  }

  const barY = cardY + cardH - 85;
  const barCount = 42;
  const barStartX = (width - barCount * 8) / 2;

  ctx.fillStyle = "#484f58";
  for (let i = 0; i < barCount; i++) {
    const barW = i % 3 === 0 ? 4 : 2;
    ctx.fillRect(barStartX + i * 8, barY, barW, 35);
  }

  ctx.textAlign = "center";
  ctx.fillStyle = "#8b949e";
  ctx.font = "12px monospace";
  ctx.fillText(`* ${trx.id} *`, width / 2, barY + 52);

  ctx.fillStyle = "#6e7681";
  ctx.font = "11px sans-serif";
  ctx.fillText(
    "Terima kasih atas pesanan Anda! Simpan struk ini sebagai bukti transaksi.",
    width / 2,
    cardY + cardH - 12
  );

  return canvas.toBuffer("image/png");
}
