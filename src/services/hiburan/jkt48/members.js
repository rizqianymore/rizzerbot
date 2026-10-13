import { JKT48_BASE, STATIC_MEMBERS } from "./constants.js";
import { jktInPageFetch } from "./client.js";

export async function getJkt48Members() {
  try {
    const json = await jktInPageFetch(`${JKT48_BASE}/api/v1/members/`);
    if (json?.status && Array.isArray(json?.data)) {
      return json.data.map((m) => ({
        id: m.jkt48_member_id,
        name: m.name,
        nickname: m.nickname,
        code: m.code,
        type: m.type,
        photo: m.photo,
      }));
    }
  } catch (_) {}

  return STATIC_MEMBERS;
}

export async function getAkb48FandomMemberDetail(memberName) {
  if (!memberName) return null;

  try {
    const formattedTitle = encodeURIComponent(memberName.trim().replace(/\s+/g, "_"));
    const apiUrl = `https://akb48.fandom.com/api.php?action=parse&page=${formattedTitle}&prop=wikitext|images&format=json`;

    const { default: axios } = await import("axios");
    let parseData = null;

    try {
      const res = await axios.get(apiUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        },
        timeout: 5000,
      });
      parseData = res.data?.parse;
    } catch (_) {
      const pageResult = await jktInPageFetch(apiUrl);
      parseData = pageResult?.parse;
    }

    if (!parseData?.wikitext) return null;
    const wikitext = parseData.wikitext["*"];

    let wikiImageUrl = null;
    const candidateImg = Array.isArray(parseData.images)
      ? parseData.images.find(
          (img) =>
            /\.(jpe?g|png|webp)$/i.test(img) && !/logo|icon|\.svg|x\.svg|showroom|tiktok|instagram|idn/i.test(img)
        )
      : null;

    if (candidateImg) {
      try {
        const infoUrl = `https://akb48.fandom.com/api.php?action=query&titles=File:${encodeURIComponent(candidateImg)}&prop=imageinfo&iiprop=url&format=json`;
        let infoPages = null;
        try {
          const infoRes = await axios.get(infoUrl, {
            headers: { "User-Agent": "Mozilla/5.0" },
            timeout: 5000,
          });
          infoPages = infoRes.data?.query?.pages;
        } catch (_) {
          const infoPageRes = await jktInPageFetch(infoUrl);
          infoPages = infoPageRes?.query?.pages;
        }

        if (infoPages) {
          const firstKey = Object.keys(infoPages)[0];
          const imgUrl = infoPages[firstKey]?.imageinfo?.[0]?.url;
          if (imgUrl) wikiImageUrl = imgUrl;
        }
      } catch (_) {}
    }

    const wikiPageUrl = `https://akb48.fandom.com/wiki/${formattedTitle}`;

    const getField = (field) => {
      const reg = new RegExp(`\\|\\s*${field}\\s*=\\s*([^\\n|]+)`, "i");
      const m = wikitext.match(reg);
      return m ? m[1].replace(/\[\[|\]\]|\{\{[^}]+\}\}|<[^>]+>/g, "").trim() : null;
    };

    const realName = getField("realname");

    let generation = null;
    const genMatch = wikitext.match(/generation\s*=\s*\[\[(?:[^#\]]+#)?([^\]|]+)(?:\|[^\]]+)?\]\]/i);
    if (genMatch) {
      generation = genMatch[1].replace(/_/g, " ").trim();
    } else {
      generation = getField("generation");
    }

    let hometown = null;
    const resMatch = wikitext.match(/\{\{residence\|([^|}]+)\|([^|}]+)/i);
    if (resMatch) {
      hometown = `${resMatch[1].trim()}, ${resMatch[2].trim()}`;
    } else {
      hometown = getField("hometown");
    }

    let catchphrase = null;
    const cpMatch = wikitext.match(/==\s*Catchphrase\s*==\s*([\s\S]*?)(?:==|$)/i);
    if (cpMatch) {
      const firstLine = cpMatch[1]
        .split("\n")
        .map((l) => l.trim())
        .find((l) => l && !l.includes("font-variant") && !l.startsWith("<!--"));
      if (firstLine) {
        catchphrase = firstLine
          .replace(/^:+|\s*:+$/g, "")
          .replace(/'''/g, "")
          .replace(/''/g, "")
          .trim();
      }
    }

    let triviaList = [];
    const triviaSec = wikitext.match(/==\s*Trivia\s*==([\s\S]*?)(?:==|$)/i);
    if (triviaSec) {
      const rawLines = triviaSec[1].split("\n");
      const cleanItems = [];
      for (const line of rawLines) {
        const trimmed = line.trim();
        if (
          trimmed.startsWith("*") &&
          !trimmed.toLowerCase().includes("gallery") &&
          !trimmed.toLowerCase().includes("hashtag") &&
          !trimmed.toLowerCase().includes("before-bed") &&
          !trimmed.toLowerCase().includes("every-monday") &&
          !trimmed.toLowerCase().includes("private message") &&
          !trimmed.toLowerCase().includes("sub-unit")
        ) {
          const item = trimmed
            .replace(/^\*+\s*/, "")
            .replace(/'''|''/g, "")
            .replace(/\[\[(?:[^\]|]+\|)?([^\]]+)\]\]/g, "$1")
            .replace(/<[^>]+>/g, "")
            .trim();
          if (item && item.length > 8) cleanItems.push(item);
        }
      }
      triviaList = cleanItems.slice(0, 2);
    }

    return {
      realName,
      generation,
      hometown,
      catchphrase,
      trivia: triviaList,
      wikiImageUrl,
      wikiPageUrl,
    };
  } catch (err) {
    console.warn("[AKB48 Fandom Fetch Warning]:", err.message);
    return null;
  }
}

export async function getJkt48MemberDetail(idOrName) {
  const list = await getJkt48Members();
  const q = String(idOrName).trim().toLowerCase();
  const target =
    list.find((m) => String(m.id) === q) ||
    list.find((m) => m.nickname && m.nickname.toLowerCase() === q) ||
    list.find((m) => m.name.toLowerCase() === q) ||
    list.find((m) => m.nickname && m.nickname.toLowerCase().includes(q)) ||
    list.find((m) => m.name.toLowerCase().includes(q));

  if (!target) throw new Error(`Member "${idOrName}" tidak ditemukan.`);

  let data = null;
  let fandomData = null;

  try {
    fandomData = await getAkb48FandomMemberDetail(target.name);
  } catch (_) {}

  if (!fandomData) {
    try {
      const json = await jktInPageFetch(`${JKT48_BASE}/api/v1/members/${target.id}?lang=id`);
      data = json?.data;
    } catch (err) {
      console.warn(`[JKT48 Detail Browser Skip] using offline/fandom data for ${target.name}:`, err.message);
    }
  }

  return {
    id: target.id,
    name: data?.name || target.name,
    nickname: data?.nickname || target.nickname,
    type: data?.type || target.type || "",
    birthPlace: data?.birth_place || fandomData?.hometown || "",
    birthDate: data?.birth_date || "",
    bloodType: data?.blood_type || "-",
    height: data?.body_height ? `${data.body_height} cm` : "-",
    horoscope: data?.horoscope || "-",
    twitter: data?.twitter_account || "",
    instagram: data?.instagram_account || "",
    tiktok: data?.tiktok_account || "",
    photo:
      target.photo ||
      (data?.photo ? `${JKT48_BASE}/api/v1/storages/${data.photo.replace(/^\/+/, "")}` : null) ||
      fandomData?.wikiImageUrl,
    fandom: fandomData || null,
  };
}
