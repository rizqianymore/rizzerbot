import fs from "fs";
import path from "path";

export function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function cloneValue(value) {
  if (Array.isArray(value)) return value.map((item) => cloneValue(item));
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneValue(item)]));
  }
  return value;
}

export function normalizePhone(value) {
  let digits = String(value || "").replace(/[^0-9]/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  else if (digits.startsWith("8")) digits = `62${digits}`;
  return digits;
}

export function toBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off"].includes(normalized)) return false;
  }
  return Boolean(fallback);
}

export function normalizeJid(value) {
  if (value === null || value === undefined || value === "") return "";
  const raw = String(value).trim();
  if (!raw) return "";

  if (raw.startsWith("@") && !raw.slice(1).includes("@")) {
    const numeric = normalizePhone(raw.slice(1));
    return numeric ? `${numeric}@s.whatsapp.net` : "";
  }

  const atIndex = raw.indexOf("@");
  if (atIndex >= 0) {
    const local = raw.slice(0, atIndex).split(":")[0];
    const domain = raw.slice(atIndex + 1).toLowerCase();
    if (domain === "g.us" || domain === "broadcast" || domain === "newsletter") {
      return `${local}@${domain}`;
    }
    if (domain === "lid") return `${local}@lid`;
    const numeric = normalizePhone(local);
    return `${numeric || local}@s.whatsapp.net`;
  }

  const numeric = normalizePhone(raw);
  return numeric ? `${numeric}@s.whatsapp.net` : "";
}

export function toJidList(values) {
  const list = Array.isArray(values) ? values : [values];
  return list
    .flatMap((value) => String(value || "").split(/[,;]/))
    .map((value) => value.trim())
    .map((value) => normalizeJid(value))
    .filter(Boolean);
}

export function getConfiguredJids(values) {
  return new Set(toJidList(values));
}

export function getRole(user) {
  if (user.owner) return "owner";
  if (user.admin) return "admin";
  if (user.premium) return "premium";
  return "user";
}

export function isPremiumExpired(user) {
  return Boolean(
    user.premiumUntil && Number.isFinite(Number(user.premiumUntil)) && Number(user.premiumUntil) <= Date.now()
  );
}

export function auditPrivilege(storeKey, action, targetJid, enabled, extra = {}) {
  try {
    const auditPath = path.join(process.cwd(), "database", "privilege-audit.json");
    let entries = [];
    if (fs.existsSync(auditPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(auditPath, "utf8"));
        if (Array.isArray(parsed)) entries = parsed;
      } catch (_) {}
    }
    entries.push({
      at: new Date().toISOString(),
      store: storeKey || "main",
      action,
      target: targetJid || "",
      enabled: Boolean(enabled),
      ...extra,
    });
    if (entries.length > 500) entries = entries.slice(entries.length - 500);
    fs.mkdirSync(path.dirname(auditPath), { recursive: true });
    fs.writeFileSync(auditPath, JSON.stringify(entries, null, 2), "utf8");
  } catch (_) {}
}

export function phoneDigitsOfPhoneJid(jid) {
  if (!jid || !String(jid).endsWith("@s.whatsapp.net")) return "";
  return normalizePhone(jid);
}

export function samePhoneJidStrict(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  if (!String(a).endsWith("@s.whatsapp.net") || !String(b).endsWith("@s.whatsapp.net")) return false;
  const da = normalizePhone(a);
  const dbb = normalizePhone(b);
  return Boolean(da && dbb && da === dbb);
}
