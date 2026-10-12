export function clean(s) {
  return String(s || "").trim();
}

export function cleanText(text = "") {
  return String(text || "")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
