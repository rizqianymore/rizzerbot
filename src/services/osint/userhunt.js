const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function bodyHas(body, ...needles) {
  const low = body.toLowerCase();
  return needles.some((n) => low.includes(String(n).toLowerCase()));
}

export const USERHUNT_PLATFORMS = [
  {
    key: "github",
    name: "GitHub",
    confidence: "HIGH",
    url: (u) => `https://github.com/${u}`,
    check: (u) => `https://api.github.com/users/${u}`,
    decide: (status, body) => status === 200 && !bodyHas(body, `"message":"Not Found"`),
  },
  {
    key: "gitlab",
    name: "GitLab",
    confidence: "HIGH",
    url: (u) => `https://gitlab.com/${u}`,
    check: (u) => `https://gitlab.com/api/v4/users?username=${encodeURIComponent(u)}`,
    decide: (status, body) => status === 200 && body.trim() !== "[]" && bodyHas(body, `"username"`),
  },
  {
    key: "devto",
    name: "Dev.to",
    confidence: "HIGH",
    url: (u) => `https://dev.to/${u}`,
    check: (u) => `https://dev.to/api/users/by_username?url=${encodeURIComponent(u)}`,
    decide: (status, body) => status === 200 && bodyHas(body, `"username"`),
  },
  {
    key: "hackernews",
    name: "Hacker News",
    confidence: "HIGH",
    url: (u) => `https://news.ycombinator.com/user?id=${encodeURIComponent(u)}`,
    check: (u) => `https://hacker-news.firebaseio.com/v0/user/${encodeURIComponent(u)}.json`,
    decide: (status, body) => status === 200 && body.trim() !== "null" && bodyHas(body, `"id"`),
  },
  {
    key: "chess",
    name: "Chess.com",
    confidence: "HIGH",
    url: (u) => `https://www.chess.com/member/${u}`,
    check: (u) => `https://api.chess.com/pub/player/${encodeURIComponent(u)}`,
    decide: (status, body) => status === 200 && bodyHas(body, `"username"`),
  },
  {
    key: "lichess",
    name: "Lichess",
    confidence: "HIGH",
    url: (u) => `https://lichess.org/@/${u}`,
    check: (u) => `https://lichess.org/api/user/${encodeURIComponent(u)}`,
    decide: (status, body) => status === 200 && bodyHas(body, `"id"`),
  },
  {
    key: "docker",
    name: "Docker Hub",
    confidence: "HIGH",
    url: (u) => `https://hub.docker.com/u/${u}`,
    check: (u) => `https://hub.docker.com/v2/users/${encodeURIComponent(u)}/`,
    decide: (status, body, u, ctx) => {
      if (status === 200 && bodyHas(body, `"username"`)) return true;
      if ((status === 301 || status === 302 || status === 308) && String(ctx?.location || "").includes("/v2/orgs/"))
        return true;
      return false;
    },
  },
  {
    key: "keybase",
    name: "Keybase",
    confidence: "HIGH",
    url: (u) => `https://keybase.io/${u}`,
    check: (u) => `https://keybase.io/_/api/1.0/user/lookup.json?usernames=${encodeURIComponent(u)}&fields=basics`,
    decide: (status, body) => status === 200 && !bodyHas(body, `"them":[null]`) && bodyHas(body, `"username"`),
  },
  {
    key: "codeberg",
    name: "Codeberg",
    confidence: "HIGH",
    url: (u) => `https://codeberg.org/${u}`,
    check: (u) => `https://codeberg.org/api/v1/users/${encodeURIComponent(u)}`,
    decide: (status, body) => status === 200 && bodyHas(body, `"login"`),
  },
  {
    key: "huggingface",
    name: "Hugging Face",
    confidence: "HIGH",
    followRedirect: true,
    url: (u) => `https://huggingface.co/${u}`,
    check: (u) => `https://huggingface.co/${encodeURIComponent(u)}`,
    decide: (status) => status === 200,
  },
  {
    key: "youtube",
    name: "YouTube",
    confidence: "HIGH",
    followRedirect: true,
    url: (u) => `https://www.youtube.com/@${u}`,
    check: (u) => `https://www.youtube.com/@${encodeURIComponent(u)}`,
    decide: (status, body) => status === 200 && !bodyHas(body, "404 Not Found"),
  },
  {
    key: "tiktok",
    name: "TikTok",
    confidence: "HIGH",
    url: (u) => `https://www.tiktok.com/@${u}`,
    check: (u) => `https://www.tiktok.com/oembed?url=${encodeURIComponent(`https://www.tiktok.com/@${u}`)}`,
    decide: (status, body) => status === 200 && bodyHas(body, `"author_name"`),
  },
  {
    key: "steam",
    name: "Steam",
    confidence: "HIGH",
    url: (u) => `https://steamcommunity.com/id/${u}`,
    check: (u) => `https://steamcommunity.com/id/${encodeURIComponent(u)}/?xml=1`,
    decide: (status, body) => status === 200 && bodyHas(body, "<steamID64>") && !bodyHas(body, "<error>"),
  },
  {
    key: "reddit",
    name: "Reddit",
    confidence: "HIGH",
    url: (u) => `https://www.reddit.com/user/${u}`,
    check: (u) => `https://www.reddit.com/user/${u}/about.json`,
    decide: (status, body) => status === 200 && !bodyHas(body, `"error":404`),
  },
  {
    key: "wattpad",
    name: "Wattpad",
    confidence: "HIGH",
    url: (u) => `https://www.wattpad.com/user/${u}`,
    check: (u) => `https://www.wattpad.com/user/${encodeURIComponent(u)}`,
    decide: (status, body, u) => status === 200 && bodyHas(body, `"username":"${String(u).toLowerCase()}"`),
  },
  {
    key: "telegram",
    name: "Telegram",
    confidence: "MEDIUM",
    url: (u) => `https://t.me/${u}`,
    check: (u) => `https://t.me/${u}`,
    decide: (status, body, u) => status === 200 && !bodyHas(body, `Telegram: Contact @${String(u).toLowerCase()}`),
  },
  {
    key: "medium",
    name: "Medium",
    confidence: "LOW",
    url: (u) => `https://medium.com/@${u}`,
    check: (u) => `https://medium.com/@${u}`,
    decide: (status, body) =>
      status === 200 && bodyHas(body, '"__typename":"User"') && !bodyHas(body, "PAGE NOT FOUND"),
  },
  {
    key: "pinterest",
    name: "Pinterest",
    confidence: "LOW",
    url: (u) => `https://www.pinterest.com/${u}/`,
    check: (u) => `https://www.pinterest.com/${u}/`,
    decide: (status, body) =>
      status === 200 && !bodyHas(body, "User not found", "Page not found") && !bodyHas(body, "<title></title>"),
  },
];

export function isValidUsername(username) {
  return /^[a-zA-Z0-9_.-]{3,30}$/.test(username || "");
}

export async function checkUsernameOn(platform, username) {
  const u = String(username || "").replace(/^@/, "");
  const checkUrl = platform.check(u);
  const profileUrl = platform.url(u);
  const confidence = platform.confidence || "LOW";
  try {
    const res = await fetch(checkUrl, {
      method: "GET",
      headers: { "User-Agent": UA, Accept: "text/html,application/json,*/*" },
      redirect: platform.followRedirect ? "follow" : "manual",
      signal: AbortSignal.timeout(15000),
    });
    const status = res.status;
    if (status === 404 || status === 410) {
      return { name: platform.name, exists: false, confidence };
    }
    const ctx = { location: res.headers.get("location") || "" };
    let body = "";
    if (status < 400) {
      try {
        body = await res.text();
      } catch {
        body = "";
      }
      if (body.length > 1500000) body = body.slice(0, 1500000);
    }
    const decide = platform.decide || ((s) => s === 200);
    const exists = !!decide(status, body, u, ctx);
    return exists
      ? { name: platform.name, exists: true, url: profileUrl, confidence }
      : { name: platform.name, exists: false, confidence };
  } catch {
    return { name: platform.name, exists: false, confidence };
  }
}

export async function checkUsernameAll(username) {
  const results = await Promise.allSettled(USERHUNT_PLATFORMS.map((p) => checkUsernameOn(p, username)));
  return results.filter((r) => r.status === "fulfilled" && r.value.exists).map((r) => r.value);
}
