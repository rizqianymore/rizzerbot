import https from "node:https";

const DOMAINS = ["1secmail.com", "1secmail.net", "1secmail.org", "esiix.com", "wwjmp.com"];

function httpGetJson(url, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        family: 4,
        timeout: timeoutMs,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) RizzerBot/TempMail",
          Accept: "application/json",
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            resolve(null);
          }
        });
      }
    );
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Timeout menghubungi server temp-mail."));
    });
    req.on("error", (err) => reject(err));
  });
}

function randomString(length = 8) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Buat alamat temporary email baru secara instan
 * @param {string} [customLogin]
 * @returns {object}
 */
export function createMailbox(customLogin = null) {
  const login = customLogin
    ? String(customLogin).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 16) || randomString(8)
    : randomString(8);
  const domain = DOMAINS[Math.floor(Math.random() * DOMAINS.length)];
  const address = `${login}@${domain}`;
  return { address, login, domain };
}

/**
 * Ambil daftar pesan masuk (inbox) real-time
 * @param {string} address - format "user@domain.com"
 * @returns {Promise<Array>}
 */
export async function getMessages(address) {
  const clean = String(address || "").trim().toLowerCase();
  const [login, domain] = clean.split("@");
  if (!login || !domain) {
    throw new Error("Format alamat email tidak valid (harus user@domain).");
  }

  const url = `https://www.1secmail.com/api/v1/?action=getMessages&login=${encodeURIComponent(login)}&domain=${encodeURIComponent(domain)}`;
  const list = await httpGetJson(url);
  return Array.isArray(list) ? list : [];
}

/**
 * Baca isi pesan spesifik
 * @param {string} address - format "user@domain.com"
 * @param {number|string} messageId
 * @returns {Promise<object>}
 */
export async function readMessage(address, messageId) {
  const clean = String(address || "").trim().toLowerCase();
  const [login, domain] = clean.split("@");
  if (!login || !domain) {
    throw new Error("Format alamat email tidak valid.");
  }

  const url = `https://www.1secmail.com/api/v1/?action=readMessage&login=${encodeURIComponent(login)}&domain=${encodeURIComponent(domain)}&id=${encodeURIComponent(messageId)}`;
  const msg = await httpGetJson(url);
  if (!msg || !msg.id) {
    throw new Error("Pesan tidak ditemukan atau telah kedaluwarsa.");
  }
  return msg;
}

export default { createMailbox, getMessages, readMessage, DOMAINS };
