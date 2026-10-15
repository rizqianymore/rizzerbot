function tokenize(expr) {
  const tokens = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (ch === " " || ch === "\t") {
      i++;
      continue;
    }
    if ((ch >= "0" && ch <= "9") || ch === ".") {
      let num = "";
      while (i < expr.length && ((expr[i] >= "0" && expr[i] <= "9") || expr[i] === ".")) num += expr[i++];
      if (num === "." || num.split(".").length > 2) throw new Error("angka tidak valid");
      tokens.push({ type: "num", value: Number(num) });
      continue;
    }
    if ("+-*/%^()".includes(ch)) {
      tokens.push({ type: "op", value: ch });
      i++;
      continue;
    }
    throw new Error(`karakter tidak didukung: ${ch}`);
  }
  return tokens;
}

function evaluate(expr) {
  const tokens = tokenize(expr);
  let pos = 0;
  const peek = () => tokens[pos] || null;
  const next = () => tokens[pos++] || null;

  function parseExpr() {
    let value = parseTerm();
    for (;;) {
      const t = peek();
      if (!t || t.type !== "op" || (t.value !== "+" && t.value !== "-")) return value;
      next();
      const rhs = parseTerm();
      value = t.value === "+" ? value + rhs : value - rhs;
    }
  }

  function parseTerm() {
    let value = parseFactor();
    for (;;) {
      const t = peek();
      if (!t || t.type !== "op" || (t.value !== "*" && t.value !== "/" && t.value !== "%")) return value;
      next();
      const rhs = parseFactor();
      if (t.value === "*") value *= rhs;
      else if (t.value === "/") {
        if (rhs === 0) throw new Error("pembagian dengan nol");
        value /= rhs;
      } else value %= rhs;
    }
  }

  function parseFactor() {
    let value = parseUnary();
    const t = peek();
    if (t && t.type === "op" && t.value === "^") {
      next();
      value = Math.pow(value, parseFactor());
    }
    return value;
  }

  function parseUnary() {
    const t = peek();
    if (t && t.type === "op" && (t.value === "+" || t.value === "-")) {
      next();
      const value = parseUnary();
      return t.value === "-" ? -value : value;
    }
    return parsePrimary();
  }

  function parsePrimary() {
    const t = next();
    if (!t) throw new Error("ekspresi tidak lengkap");
    if (t.type === "num") return t.value;
    if (t.type === "op" && t.value === "(") {
      const value = parseExpr();
      const closing = next();
      if (!closing || closing.type !== "op" || closing.value !== ")") throw new Error("kurung tidak seimbang");
      return value;
    }
    throw new Error("ekspresi tidak valid");
  }

  const result = parseExpr();
  if (pos < tokens.length) throw new Error("ekspresi tidak valid");
  if (typeof result !== "number" || !Number.isFinite(result)) throw new Error("hasil tidak terhingga");
  return result;
}

function formatResult(value) {
  const rounded = Math.round(value * 1e10) / 1e10;
  return String(rounded);
}

export default {
  name: "calc",
  aliases: ["hitung", "kalkulator", "kali"],
  description: "Kalkulator aman (+ - * / % ^ kurung)",
  usage: "<ekspresi>",
  category: "Tools",
  run: async (sock, msg, args, { reply, prefix }) => {
    const expr = args.join(" ").trim();
    if (!expr) {
      return reply(
        `*KALKULATOR*\n\nContoh: ${prefix || "."}calc (12+8)*2.5\nOperator: + - * / % ^ dan ( )`
      );
    }
    if (expr.length > 200) return reply("Ekspresi terlalu panjang (maks 200 karakter).");
    try {
      return reply(`*HASIL*\n${expr} = *${formatResult(evaluate(expr))}*`);
    } catch (err) {
      return reply(`Ekspresi tidak valid: ${err?.message || "cek lagi"}\nContoh: ${prefix || "."}calc (12+8)*2.5`);
    }
  },
};
