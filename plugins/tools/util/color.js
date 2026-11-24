function hexToRgb(hex) {
  let clean = hex.replace("#", "");
  if (clean.length === 3) {
    clean = clean
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const num = parseInt(clean, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export default {
  name: "color",
  aliases: ["hex", "rgb", "colorpicker", "warna"],
  description: "Konversi kode warna HEX, RGB, HSL, & visualisasi warna",
  usage: "<#hex / rgb(r,g,b)>",
  category: "Tools",
  cooldownMs: 3000,

  run: async (sock, msg, args, { reply, prefix }) => {
    const p = prefix || ".";
    const input = args.join(" ").trim();

    if (!input) {
      return reply(
        `┌── COLOR CONVERTER & INSPECTOR\n` +
          `│ Konversi warna HEX, RGB, dan HSL.\n` +
          `└──\n\n` +
          `Format: ${p}color <#HEX atau R,G,B>\n` +
          `Contoh: ${p}color #0c1317\n` +
          `Contoh: ${p}color 12, 19, 23`
      );
    }

    let r = 0;
    let g = 0;
    let b = 0;

    if (input.startsWith("#") || /^[0-9a-f]{3,6}$/i.test(input)) {
      const hex = input.startsWith("#") ? input : `#${input}`;
      const rgb = hexToRgb(hex);
      r = rgb.r;
      g = rgb.g;
      b = rgb.b;
    } else if (input.includes(",")) {
      const parts = input
        .replace(/[^\d,]/g, "")
        .split(",")
        .map(Number);
      if (parts.length >= 3) {
        r = Math.min(255, Math.max(0, parts[0]));
        g = Math.min(255, Math.max(0, parts[1]));
        b = Math.min(255, Math.max(0, parts[2]));
      }
    } else {
      return reply(`❌ Format tidak valid. Masukkan nilai HEX (contoh \`#3498db\`) atau RGB (\`52, 152, 219\`).`);
    }

    const hexStr = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
    const hsl = rgbToHsl(r, g, b);

    const text =
      `┌── COLOR CONVERTER RESULT\n` +
      `│ HEX Code : \`${hexStr}\`\n` +
      `└──\n\n` +
      `├── [1] RGB  : \`rgb(${r}, ${g}, ${b})\`\n` +
      `├── [2] HSL  : \`hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)\`\n` +
      `├── [3] CMYK : C:${Math.round((1 - r / 255) * 100)}% M:${Math.round((1 - g / 255) * 100)}% Y:${Math.round((1 - b / 255) * 100)}%\n` +
      `└── [4] Web  : ${r > 128 && g > 128 && b > 128 ? "Warna Terang (Light)" : "Warna Gelap (Dark)"}`;

    return reply(text);
  },
};
