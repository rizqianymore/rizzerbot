import fs from "fs";
import os from "os";
import path from "path";

/**
 * Session Telkom Schools (token + cookie).
 *
 * - Hanya hidup di memori (in-memory), TIDAK pernah ditulis ke disk.
 * - `destroy()` wajib dipanggil di finally block: token & cookie di-null-kan,
 *   lalu log "session cleared" (tanpa kredensial).
 */

const TEMP_PREFIX = "telkom-session-";

/**
 * Hapus artefak temp milik proses ini (defensive: saat ini tidak ada file temp
 * yang dibuat, tapi tetap dijaga agar tidak ada sisa cache di /tmp).
 */
export function purgeTempArtifacts() {
  let removed = 0;
  try {
    const dir = os.tmpdir();
    const prefix = `${TEMP_PREFIX}${process.pid}-`;
    for (const name of fs.readdirSync(dir)) {
      if (!name.startsWith(prefix)) continue;
      try {
        fs.rmSync(path.join(dir, name), { force: true, recursive: true });
        removed++;
      } catch (_) {}
    }
  } catch (_) {}
  return removed;
}

export function createSession({ token = null, cookie = null, claims = null, expiresAt = null, studentId = null } = {}) {
  const session = {
    token: token || null,
    cookie: cookie || null,
    claims: claims || null,
    expiresAt: expiresAt || null,
    studentId: studentId || null,
    cleared: false,
    createdAt: Date.now(),
  };

  session.isActive = () => Boolean(session.token) && !session.cleared;

  /**
   * Cleanup wajib: null-kan seluruh data sensitif di memori.
   * @returns {{cleared: boolean, tokenCleared: boolean, cookieCleared: boolean, tempArtifacts: number}}
   */
  session.destroy = (logger) => {
    if (session.cleared) {
      return { cleared: true, tokenCleared: true, cookieCleared: true, tempArtifacts: 0, alreadyCleared: true };
    }

    session.token = null;
    session.cookie = null;
    session.claims = null;
    session.expiresAt = null;
    session.studentId = null;
    session.cleared = true;

    const tempArtifacts = purgeTempArtifacts();
    logger?.info?.(`[Telkom] session cleared (token+cookie dihapus dari memori, temp artifacts: ${tempArtifacts})`);

    return { cleared: true, tokenCleared: true, cookieCleared: true, tempArtifacts };
  };

  return session;
}

/**
 * Redaksi nilai sensitif sebelum masuk log/balasan.
 */
export function redactSecrets(text, secrets = []) {
  let out = String(text ?? "");
  for (const secret of secrets) {
    const value = String(secret || "");
    if (value.length < 4) continue;
    out = out.split(value).join("[REDACTED]");
  }
  return out;
}
