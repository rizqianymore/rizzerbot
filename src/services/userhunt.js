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
    url: (u) => `https://github.com/${u}`,
    check: (u) => `https://api.github.com/users/${u}`,
    decide: (status, body) => status === 200 && !bodyHas(body, `"message":"Not Found"`),
  },
  {
    key: "telegram",
    name: "Telegram",
    url: (u) => `https://t.me/${u}`,
    check: (u) => `https://t.me/${u}`,
    decide: (status) => status === 200,
  },
  {
    key: "tiktok",
    name: "TikTok",
    url: (u) => `https://www.tiktok.com/@${u}`,
    check: (u) => `https://www.tiktok.com/@${u}`,
    decide: (status, body, u) =>
      status === 200 && bodyHas(body, `"uniqueId":"${String(u).toLowerCase()}"`),
  },
  {
    key: "reddit",
    name: "Reddit",
    url: (u) => `https://www.reddit.com/user/${u}`,
    check: (u) => `https://www.reddit.com/user/${u}/about.json`,
    decide: (status, body) => status === 200 && !bodyHas(body, `"error":404`),
  },
  {
    key: "pinterest",
    name: "Pinterest",
    url: (u) => `https://www.pinterest.com/${u}/`,
    check: (u) => `https://www.pinterest.com/${u}/`,
    decide: (status, body) =>
      status === 200 &&
      !bodyHas(body, "User not found", "Page not found") &&
      !bodyHas(body, "<title></title>"),
  },
  {
    key: "steam",
    name: "Steam",
    url: (u) => `https://steamcommunity.com/id/${u}`,
    check: (u) => `https://steamcommunity.com/id/${u}`,
    decide: (status, body) =>
      status === 200 &&
      !bodyHas(body, "The specified profile could not be found", "Steam Community :: Error"),
  },
  {
    key: "medium",
    name: "Medium",
    url: (u) => `https://medium.com/@${u}`,
    check: (u) => `https://medium.com/@${u}`,
    decide: (status, body) =>
      status === 200 &&
      bodyHas(body, '"__typename":"User"') &&
      !bodyHas(body, "PAGE NOT FOUND"),
  },
  {
    key: "devto",
    name: "Dev.to",
    url: (u) => `https://dev.to/${u}`,
    check: (u) => `https://dev.to/${u}`,
    decide: (status) => status === 200,
  },
  {
    key: "gitlab",
    name: "GitLab",
    url: (u) => `https://gitlab.com/${u}`,
    check: (u) => `https://gitlab.com/${u}`,
    decide: (status) => status === 200,
  },
];

export function isValidUsername(username) {
  return /^[a-zA-Z0-9_\-\.]{3,30}$/.test(username || "");
}

export async function checkUsernameOn(platform, username) {
  const u = String(username || "").replace(/^@/, "");
  const checkUrl = platform.check(u);
  const profileUrl = platform.url(u);
  try {
    const res = await fetch(checkUrl, {
      method: "GET",
      headers: { "User-Agent": UA, Accept: "text/html,application/json,*/*" },
      redirect: "manual",
      signal: AbortSignal.timeout(10000),
    });
    const status = res.status;
    if (status === 301 || status === 302 || status === 404 || status === 410) {
      return { name: platform.name, exists: false };
    }
    let body = "";
    try {
      body = await res.text();
    } catch {
      body = "";
    }
    if (body.length > 1500000) body = body.slice(0, 1500000);
    const decide = platform.decide || ((s) => s === 200);
    return { name: platform.name, exists: !!decide(status, body, u), url: profileUrl };
  } catch {
    return { name: platform.name, exists: false };
  }
}

export async function checkUsernameAll(username) {
  const results = await Promise.allSettled(
    USERHUNT_PLATFORMS.map((p) => checkUsernameOn(p, username))
  );
  return results
    .filter((r) => r.status === "fulfilled" && r.value.exists)
    .map((r) => r.value);
}
