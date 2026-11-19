/**
 * Helper formatter respons bergaya Terminal Linux otentik (┌──, │, ├──, └──)
 * Konsisten, kaku, rapi, dan bersih tanpa backtick aneh atau kurung berlebih.
 */

export function formatLinuxBox(title, rows = [], footer = "") {
  let out = `┌── ${String(title).toUpperCase()}\n`;
  for (const row of rows) {
    if (!row) continue;
    if (typeof row === "string") {
      out += `│ ${row}\n`;
    } else if (Array.isArray(row)) {
      const [key, val] = row;
      out += `│ ${key}: ${val}\n`;
    } else if (typeof row === "object") {
      for (const [k, v] of Object.entries(row)) {
        out += `│ ${k}: ${v}\n`;
      }
    }
  }
  out += `└──`;
  if (footer) {
    out += `\n\n${footer}`;
  }
  return out;
}

export function formatLinuxTree(title, items = [], footer = "") {
  let out = `┌── ${String(title).toUpperCase()}\n`;
  const validItems = items.filter(Boolean);
  validItems.forEach((item, i) => {
    const isLast = i === validItems.length - 1;
    const branch = isLast ? "└──" : "├──";
    out += `${branch} ${item}\n`;
  });
  if (footer) {
    out += `\n${footer}`;
  }
  return out.trim();
}

/**
 * Otomatis mendeteksi dan mengonversi format respons lama (*TITLE*, bullets •, dll)
 * menjadi format kaku Terminal Linux (┌── │ └──) secara transparan.
 */
export function autoFormatToLinux(raw) {
  if (typeof raw !== "string") return raw;
  const text = raw.trim();

  // Jika sudah terformat atau berupa raw code block, pertahankan aslinya
  if (text.includes("┌──") || text.includes("├──")) return raw;
  if (text.startsWith("```") && text.endsWith("```")) return raw;

  const lines = text.split("\n");
  if (lines.length < 2) return raw;

  // Tangkap judul di baris pertama: misal *JUDUL* atau *JUDUL:*
  const headerMatch = lines[0].match(/^\*([^*]+)\*[:\s]*$/);
  if (!headerMatch) return raw;

  const title = headerMatch[1].replace(/[:\-—]/g, "").trim();
  const bodyLines = lines.slice(1);

  const rows = [];
  const footerLines = [];
  let inFooter = false;

  for (let i = 0; i < bodyLines.length; i++) {
    const line = bodyLines[i].trim();
    if (!line) {
      if (rows.length > 0) inFooter = true;
      continue;
    }

    if (
      inFooter &&
      (line.startsWith("Ketik") ||
        line.startsWith("Contoh") ||
        line.startsWith("Sumber") ||
        line.startsWith("Catatan") ||
        line.startsWith("Format") ||
        line.startsWith("_") ||
        line.startsWith("Hubungi"))
    ) {
      footerLines.push(line.replace(/^[_*]+|[_*]+$/g, ""));
      continue;
    }

    let cleanLine = line.replace(/^[•\-\*]\s*/, "");
    cleanLine = cleanLine.replace(/^\*([^*:]+)\*:\s*/, "$1: ");
    cleanLine = cleanLine.replace(/^\*([^*:]+):\*\s*/, "$1: ");
    cleanLine = cleanLine.replace(/`([^`]+)`/g, "$1");

    rows.push(cleanLine);
  }

  if (rows.length === 0) return raw;

  let out = `┌── ${title.toUpperCase()}\n`;
  for (const r of rows) {
    out += `│ ${r}\n`;
  }
  out += `└──`;

  if (footerLines.length > 0) {
    out += `\n\n` + footerLines.join("\n");
  }

  return out;
}

export default { formatLinuxBox, formatLinuxTree, autoFormatToLinux };
