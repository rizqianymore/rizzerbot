import QRCode from "qrcode";

const TAG_NAMES = {
  "00": "Payload Format Indicator",
  "01": "Point of Initiation Method",
  "52": "Merchant Category Code",
  "53": "Transaction Currency",
  "54": "Transaction Amount",
  "55": "Tip or Convenience Indicator",
  "56": "Value of Convenience Fee (Fixed)",
  "57": "Value of Convenience Fee (%)",
  "58": "Country Code",
  "59": "Merchant Name",
  "60": "Merchant City",
  "61": "Postal Code",
  "62": "Additional Data Field",
  "63": "CRC",
};

const NESTED_TAGS = new Set([
  ...Array.from({ length: 26 }, (_, i) => String(i + 26).padStart(2, "0")),
  "62",
]);

export function calculateCRC16(str) {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return (crc & 0xffff).toString(16).toUpperCase().padStart(4, "0");
}

export function parseTLV(data) {
  const elements = [];
  let pos = 0;

  while (pos < data.length) {
    if (pos + 4 > data.length) break;

    const tag = data.substring(pos, pos + 2);
    const length = parseInt(data.substring(pos + 2, pos + 4), 10);

    if (isNaN(length) || pos + 4 + length > data.length) break;

    const value = data.substring(pos + 4, pos + 4 + length);
    const name = TAG_NAMES[tag] || `Unknown (${tag})`;

    const element = { tag, name, length, value };

    if (NESTED_TAGS.has(tag)) {
      element.children = parseTLV(value);
    }

    elements.push(element);
    pos += 4 + length;
  }

  return elements;
}

function buildTLVString(elements) {
  return elements
    .map((el) => {
      const value = el.children ? buildTLVString(el.children) : el.value;
      const length = value.length.toString().padStart(2, "0");
      return `${el.tag}${length}${value}`;
    })
    .join("");
}

function makeTLV(tag, value, name = "") {
  return { tag, name, length: value.length, value };
}

export function convertQRIS(qrisString, options = {}) {
  const amount = options.amount;
  if (!amount || isNaN(amount) || Number(amount) < 1) {
    throw new Error("Nominal pembayaran minimal Rp 1.");
  }

  const elements = parseTLV(qrisString);
  const result = [];
  let amountInserted = false;

  const managedTags = new Set(["54", "55", "56", "57", "63"]);

  for (const el of elements) {
    if (managedTags.has(el.tag)) continue;

    if (el.tag === "01") {
      result.push(makeTLV("01", "12", "Point of Initiation Method"));
      continue;
    }

    if (el.tag === "58" && !amountInserted) {
      const amountStr = Math.floor(Number(amount)).toString();
      result.push(makeTLV("54", amountStr, "Transaction Amount"));

      if (options.fee) {
        if (options.fee.type === "fixed") {
          result.push(makeTLV("55", "02", "Tip or Convenience Indicator"));
          result.push(
            makeTLV(
              "56",
              options.fee.value.toString(),
              "Value of Convenience Fee (Fixed)"
            )
          );
        } else {
          result.push(makeTLV("55", "03", "Tip or Convenience Indicator"));
          result.push(
            makeTLV(
              "57",
              options.fee.value.toString(),
              "Value of Convenience Fee (%)"
            )
          );
        }
      }

      amountInserted = true;
    }

    result.push(el);
  }

  const withoutCRC = buildTLVString(result);
  const crcInput = withoutCRC + "6304";
  const crc = calculateCRC16(crcInput);

  return crcInput + crc;
}

export function parseQRISInfo(qrisString) {
  const raw = parseTLV(qrisString);
  const findTag = (tag) => raw.find((t) => t.tag === tag);

  return {
    merchantName: findTag("59")?.value || "-",
    merchantCity: findTag("60")?.value || "-",
    postalCode: findTag("61")?.value || "-",
    currency: findTag("53")?.value || "360",
    countryCode: findTag("58")?.value || "ID",
  };
}

export async function createQrisBuffer(payload) {
  return await QRCode.toBuffer(payload, {
    errorCorrectionLevel: "M",
    margin: 2,
    scale: 8,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
  });
}
