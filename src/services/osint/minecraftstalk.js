import https from "node:https";

function fetchJson(url, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        family: 4,
        timeout: timeoutMs,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) RizzerBot/OSINT-Minecraft",
          Accept: "application/json",
        },
      },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body) });
          } catch (_) {
            resolve({ status: res.statusCode, data: null });
          }
        });
      }
    );
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Timeout server Mojang."));
    });
    req.on("error", reject);
    req.end();
  });
}

/**
 * Intelijen Profil Minecraft Java (Mojang Official API & Textures)
 * @param {string} username
 * @returns {Promise<object>}
 */
export async function lookupMinecraft(username) {
  const clean = String(username || "").trim();
  if (!clean || !/^[a-zA-Z0-9_]{3,16}$/.test(clean)) {
    return { valid: false, reason: "Username Minecraft harus 3-16 karakter alfanumerik / underscore." };
  }

  try {
    const mojangUrl = `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(clean)}`;
    const res = await fetchJson(mojangUrl);

    if (res.status === 204 || res.status === 404 || !res.data?.id) {
      return {
        valid: true,
        exists: false,
        username: clean,
        message: `Pemain Minecraft dengan username "${clean}" tidak ditemukan.`,
      };
    }

    const uuid = res.data.id;
    const name = res.data.name;

    // Ambil texture skin HD
    const sessionUrl = `https://sessionserver.mojang.com/session/minecraft/profile/${uuid}`;
    const sessionRes = await fetchJson(sessionUrl).catch(() => ({ data: null }));

    let skinUrl = null;
    if (sessionRes.data?.properties?.[0]?.value) {
      try {
        const decoded = JSON.parse(Buffer.from(sessionRes.data.properties[0].value, "base64").toString("utf-8"));
        skinUrl = decoded?.textures?.SKIN?.url || null;
      } catch (_) {}
    }

    const avatarUrl = `https://mc-heads.net/avatar/${uuid}/150`;

    return {
      valid: true,
      exists: true,
      username: name,
      uuid,
      skinUrl,
      avatarUrl,
      namemcUrl: `https://namemc.com/profile/${uuid}`,
    };
  } catch (err) {
    return { valid: false, reason: err.message || "Gagal menghubungi Mojang API." };
  }
}
