import QRCode from "qrcode";
import { createCanvas, loadImage } from "@napi-rs/canvas";

export async function generatePureQR(qrisPayload, options = {}) {
  return await QRCode.toBuffer(qrisPayload, {
    type: "png",
    errorCorrectionLevel: "M",
    margin: 2,
    scale: 8,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
    ...options,
  });
}

export async function generateQrisCard({
  qrisPayload,
  amount = 0,
  merchantName = "Rizzer Cloud",
  merchantCity = "JAKARTA BARAT",
  _fee = 0,
  expiredMinutes = 15,
}) {

  const qrImageBuffer = await QRCode.toBuffer(qrisPayload, {
    type: "png",
    errorCorrectionLevel: "M",
    margin: 2,
    scale: 8,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
  });

  const qrImage = await loadImage(qrImageBuffer);

  const width = 640;
  const height = 900;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#0c1017";
  ctx.fillRect(0, 0, width, height);

  const radialGlow = ctx.createRadialGradient(width / 2, 70, 20, width / 2, 70, 320);
  radialGlow.addColorStop(0, "rgba(239, 68, 68, 0.2)");
  radialGlow.addColorStop(1, "rgba(12, 16, 23, 0)");
  ctx.fillStyle = radialGlow;
  ctx.fillRect(0, 0, width, height);

  const cardX = 30;
  const cardY = 30;
  const cardW = width - 60;
  const cardH = height - 60;
  const radius = 24;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, cardH, radius);
  ctx.fillStyle = "#161c26";
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "#2b3442";
  ctx.stroke();
  ctx.restore();

  const headerH = 76;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(cardX, cardY, cardW, headerH, [radius, radius, 0, 0]);
  ctx.fillStyle = "#b91c1c";
  ctx.fill();
  ctx.restore();

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 28px sans-serif";
  ctx.fillText("QRIS", width / 2, cardY + 45);

  ctx.font = "bold 11px sans-serif";
  ctx.fillStyle = "#fecaca";
  ctx.fillText("QUICK RESPONSE CODE INDONESIAN STANDARD", width / 2, cardY + 63);

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 22px sans-serif";
  ctx.fillText(merchantName.toUpperCase(), width / 2, cardY + 115);

  ctx.fillStyle = "#94a3b8";
  ctx.font = "13px sans-serif";
  ctx.fillText(`NMID / Kota: ${merchantCity}`, width / 2, cardY + 138);

  const qrBoxSize = 340;
  const qrBoxX = (width - qrBoxSize) / 2;
  const qrBoxY = cardY + 155;
  const qrRadius = 18;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, qrRadius);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#e2e8f0";
  ctx.stroke();
  ctx.restore();

  const qrPadding = 16;
  ctx.drawImage(
    qrImage,
    qrBoxX + qrPadding,
    qrBoxY + qrPadding,
    qrBoxSize - qrPadding * 2,
    qrBoxSize - qrPadding * 2
  );

  const centerSize = 46;
  const centerX = (width - centerSize) / 2;
  const centerY = qrBoxY + (qrBoxSize - centerSize) / 2;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(centerX, centerY, centerSize, centerSize, 8);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#ef4444";
  ctx.stroke();

  ctx.fillStyle = "#ef4444";
  ctx.textAlign = "center";
  ctx.font = "bold 13px sans-serif";
  ctx.fillText("QRIS", width / 2, centerY + 28);
  ctx.restore();

  const priceBoxY = qrBoxY + qrBoxSize + 22;
  const priceBoxH = 82;
  const priceBoxW = cardW - 48;
  const priceBoxX = cardX + 24;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(priceBoxX, priceBoxY, priceBoxW, priceBoxH, 14);
  ctx.fillStyle = "#0f172a";
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "#334155";
  ctx.stroke();
  ctx.restore();

  if (amount > 0) {
    const formattedAmount = "Rp " + Math.round(amount).toLocaleString("id-ID");
    ctx.textAlign = "center";
    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px sans-serif";
    ctx.fillText("TOTAL NOMINAL PEMBAYARAN", width / 2, priceBoxY + 28);

    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 28px sans-serif";
    ctx.fillText(formattedAmount, width / 2, priceBoxY + 62);
  } else {
    ctx.textAlign = "center";
    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px sans-serif";
    ctx.fillText("TIPE PEMBAYARAN", width / 2, priceBoxY + 28);

    ctx.fillStyle = "#10b981";
    ctx.font = "bold 22px sans-serif";
    ctx.fillText("QRIS STATIS (Bebas Input)", width / 2, priceBoxY + 60);
  }

  const bankY = priceBoxY + priceBoxH + 28;
  ctx.textAlign = "center";
  ctx.fillStyle = "#cbd5e1";
  ctx.font = "13px sans-serif";
  ctx.fillText("DANA • BCA • MANDIRI • BRI • BNI • OVO • GOPAY • SHOPEEPAY", width / 2, bankY);

  ctx.fillStyle = "#64748b";
  ctx.font = "11px sans-serif";
  const expText =
    amount > 0
      ? `Scan dengan aplikasi m-Banking atau E-Wallet apa saja. Berlaku ${expiredMinutes} menit.`
      : "Scan dengan aplikasi pembayaran apa saja dan masukkan nominal manual.";
  ctx.fillText(expText, width / 2, cardY + cardH - 18);

  return canvas.toBuffer("image/png");
}
