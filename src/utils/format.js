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

export default { formatLinuxBox, formatLinuxTree };
