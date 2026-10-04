const BYPASS = process.env.LOG_VERBOSE === "1" || process.env.DEBUG_LIBSIGNAL === "1";

const SUPPRESSED_SUBSTRINGS = [

  "Closing open session in favor of incoming prekey bundle",

  "Failed to decrypt message with any known session",
  "Key used already or never filled",
  "MessageCounterError",

  "Decrypted message with closed session",

  "Session already closed",
  "Closing session:",
  "Session already open",
  "Opening session:",
  "Removing old closed session:",
  "Migrating session to:",
  "V1 session storage migration error",
];

function argsToText(args) {
  try {
    return args
      .map((a) => {
        if (typeof a === "string") return a;
        if (a instanceof Error) return `${a.message}\n${a.stack || ""}`;
        if (typeof a === "object") {

          const s = String(a?.message || a?.stack || "");
          if (s && s !== "[object Object]") return s;
          return "";
        }
        return String(a ?? "");
      })
      .join(" ");
  } catch {
    return "";
  }
}

export function shouldSuppressLog(...args) {
  if (BYPASS) return false;
  if (!args.length) return false;
  const text = argsToText(args);
  if (!text) {

    const first = typeof args[0] === "string" ? args[0] : "";
    return SUPPRESSED_SUBSTRINGS.some((p) => first.includes(p));
  }
  return SUPPRESSED_SUBSTRINGS.some((p) => text.includes(p));
}

let _patched = false;
export function installLogFilter() {
  if (_patched || BYPASS) return;
  _patched = true;
  for (const method of ["log", "info", "warn", "error", "debug"]) {
    const orig = console[method]?.bind(console);
    if (!orig) continue;
    console[method] = (...args) => {
      if (shouldSuppressLog(...args)) return;
      orig(...args);
    };
  }
}

installLogFilter();
