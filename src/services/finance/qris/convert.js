import { db } from "@/src/core/database.js";
import { parseTLV, buildTLVString, makeTLV, calculateCRC16 } from "./tlv.js";

export function convertQRIS(qrisString, { amount, fee = null } = {}) {
  const numAmount = Number(amount);
  if (!Number.isFinite(numAmount) || numAmount <= 0) {
    throw new Error("Nominal amount tidak valid (harus angka > 0)");
  }
  const elements = parseTLV(qrisString);
  const result = [];
  let amountInserted = false;

  const managedTags = new Set(["54", "55", "56", "57", "63"]);

  const buildAmountTags = () => {
    const tags = [];
    const amountStr = Math.round(numAmount).toString();
    tags.push(makeTLV("54", amountStr, "Transaction Amount"));

    if (fee && Number(fee.value) > 0) {
      if (fee.type === "fixed") {
        tags.push(makeTLV("55", "02", "Tip or Convenience Indicator"));
        tags.push(makeTLV("56", Math.round(Number(fee.value)).toString(), "Value of Convenience Fee (Fixed)"));
      } else {
        tags.push(makeTLV("55", "03", "Tip or Convenience Indicator"));
        tags.push(makeTLV("57", String(fee.value), "Value of Convenience Fee (%)"));
      }
    }
    return tags;
  };

  for (const el of elements) {
    if (managedTags.has(el.tag)) continue;

    if (el.tag === "01") {
      result.push(makeTLV("01", "12", "Point of Initiation Method"));
      continue;
    }

    if (el.tag === "58" && !amountInserted) {
      result.push(...buildAmountTags());

      amountInserted = true;
    }

    result.push(el);
  }

  if (!amountInserted) {
    const idx63 = result.findIndex((el) => el.tag === "63");
    const amountTags = buildAmountTags();
    if (idx63 === -1) {
      result.push(...amountTags);
    } else {
      result.splice(idx63, 0, ...amountTags);
    }
  }

  const withoutCRC = buildTLVString(result);
  const crcInput = withoutCRC + "6304";
  const crc = calculateCRC16(crcInput);

  return crcInput + crc;
}

export function getActiveQrisString() {
  const settings = db.getSettings();
  return (
    settings.qrisString ||
    "00020101021126570011ID.DANA.WWW011893600915303511630202090351163020303UMI51440014ID.CO.QRIS.WWW0215ID10265955012340303UMI5204899953033605802ID5912Rizzer Cloud6013JAKARTA BARAT610511850630425C2"
  );
}
