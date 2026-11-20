import crypto from "node:crypto";
import axios from "axios";

export async function checkPasswordLeak(password) {
  const clean = String(password || "");
  if (!clean) {
    return { valid: false, reason: "Password yang akan dicek tidak boleh kosong." };
  }

  const sha1 = crypto.createHash("sha1").update(clean).digest("hex").toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);

  try {
    const res = await axios.get(`https://api.pwnedpasswords.com/range/${prefix}`, {
      timeout: 10000,
      headers: {
        "User-Agent": "Mozilla/5.0 RizzerBot/OSINT-PwnedPass",
      },
    });

    const lines = String(res.data || "").split("\n");
    let matchCount = 0;

    for (const line of lines) {
      const parts = line.trim().split(":");
      if (parts[0] === suffix) {
        matchCount = parseInt(parts[1], 10) || 0;
        break;
      }
    }

    return {
      valid: true,
      leaked: matchCount > 0,
      count: matchCount,
      hashPrefix: `${prefix}...`,
    };
  } catch (err) {
    return { valid: false, reason: err.message || "Gagal memeriksa database kata sandi bocor." };
  }
}
