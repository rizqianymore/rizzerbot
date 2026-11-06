import https from "node:https";

function fetchTelegramHtml(targetUrl, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      targetUrl,
      {
        family: 4, // Paksa IPv4 untuk menghindari timeout dual-stack
        timeout: timeoutMs,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          resolve(body);
        });
      }
    );

    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Timeout saat menghubungi server Telegram."));
    });

    req.on("error", (err) => {
      reject(err);
    });

    req.end();
  });
}

/**
 * Scraping & Intelijen Profil Telegram (Channel, User, Group, Bot)
 * @param {string} rawUsername
 * @returns {Promise<object>}
 */
export async function lookupTelegram(rawUsername) {
  let username = String(rawUsername || "").trim();
  username = username.replace(/^https?:\/\/t\.me\//i, "").replace(/^@/, "").split("/")[0].trim();

  if (!username || !/^[a-zA-Z0-9_]{3,32}$/.test(username)) {
    return {
      valid: false,
      reason: "Username Telegram tidak valid (harus 3-32 karakter alfanumerik / underscore).",
    };
  }

  const targetUrl = `https://t.me/${username}`;
  let html = null;
  let source = "direct";

  // 1. Coba request langsung dengan socket IPv4
  try {
    html = await fetchTelegramHtml(targetUrl);
  } catch (err) {
    // 2. Fallback via Bright Data Scraping API bila direct gagal
    try {
      const { isBrightDataEnabled, brightDataRequest } = await import("@/src/services/network/brightdata.js");
      if (isBrightDataEnabled()) {
        const bdRes = await brightDataRequest(targetUrl, { format: "raw", timeout: 25000 });
        if (typeof bdRes === "string") {
          html = bdRes;
          source = "brightdata";
        }
      }
    } catch (_) {}
  }

  if (!html || typeof html !== "string") {
    return {
      valid: false,
      reason: "Gagal mengambil data dari server Telegram.",
    };
  }

  // Cek apakah akun tidak ditemukan atau username belum dipakai
  if (html.includes("If you have <strong>Telegram</strong>, you can contact") && !html.includes("tgme_page_title")) {
    return {
      valid: true,
      exists: false,
      username,
      message: `Akun atau Channel @${username} tidak ditemukan / belum terdaftar.`,
    };
  }

  // Ekstrak Title / Display Name
  const titleMatch = html.match(/<div[^>]*class="[^"]*tgme_page_title[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : null;

  if (!title) {
    return {
      valid: true,
      exists: false,
      username,
      message: `Tidak ada profil publik untuk @${username}.`,
    };
  }

  // Ekstrak Extra info (jumlah subscribers / members / type)
  const extraMatch = html.match(/<div[^>]*class="[^"]*tgme_page_extra[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  const extra = extraMatch ? extraMatch[1].replace(/<[^>]+>/g, "").trim() : null;

  // Ekstrak Description / Bio
  const descMatch = html.match(/<div[^>]*class="[^"]*tgme_page_description[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  const description = descMatch ? descMatch[1].replace(/<br\s*[\/]?>/gi, "\n").replace(/<[^>]+>/g, "").trim() : null;

  // Ekstrak Foto Profil (Avatar HD)
  const avatarMatch = html.match(/<img[^>]*class="[^"]*tgme_page_photo_image[^"]*"[^>]*src="([^"]+)"/i) ||
                      html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
  const avatarUrl = avatarMatch ? avatarMatch[1] : null;

  // Klasifikasi Tipe Entitas
  let entityType = "User / Profile Personal";
  if (extra?.toLowerCase().includes("subscribers")) {
    entityType = "📢 Channel / Saluran Publik";
  } else if (extra?.toLowerCase().includes("members")) {
    entityType = "👥 Supergroup / Komunitas";
  } else if (username.toLowerCase().endsWith("bot")) {
    entityType = "🤖 Telegram Bot";
  }

  return {
    valid: true,
    exists: true,
    username,
    title,
    extra: extra || "Akun Personal / Non-Channel",
    description: description || "Tidak ada bio / deskripsi.",
    avatarUrl,
    entityType,
    url: targetUrl,
    source,
  };
}
