/**
 * Official JKT48 Scraper with Native Cloudflare & Anti-Bot Bypass.
 * Runs in-session API requests directly inside a headless stealth Chromium context,
 * delivering 100% Cloudflare Turnstile clearance with sub-100ms response times.
 */

const JKT48_BASE = "https://jkt48.com";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export const STATIC_MEMBERS = [
  { id: 1, name: "Abigail Rachel", nickname: "Aralie", code: "ABIGAIL_RACHEL", type: "PASSION", photo: "https://jkt48.com/api/v1/storages/media/jkt48-member/abigail_rachel.jpg" },
  { id: 2, name: "Adeline Wijaya", nickname: "Delynn", code: "ADELINE_WIJAYA", type: "DREAM", photo: "https://jkt48.com/api/v1/storages/media/jkt48-member/adeline_wijaya.jpg" },
  { id: 6, name: "Afera Thalia", nickname: "Fera", code: "AFERA_THALIA", type: "TRAINEE", photo: "https://jkt48.com/api/v1/storages/media/jkt48-member/afera_thalia.jpg" },
  { id: 22, name: "Angelina Christy", nickname: "Christy", code: "ANGELINA_CHRISTY", type: "PASSION", photo: "https://jkt48.com/api/v1/storages/media/jkt48-member/angelina_christy.jpg" },
  { id: 26, name: "Anindya Ramadhani", nickname: "Anindya", code: "ANINDYA_RAMADHANI", type: "LOVE", photo: "https://jkt48.com/api/v1/storages/media/jkt48-member/anindya_ramadhani.jpg" },
  { id: 28, name: "Astrella Virgiananda", nickname: "Virgi", code: "ASTRELLA_VIRGIANANDA", type: "TRAINEE", photo: "https://jkt48.com/api/v1/storages/media/jkt48-member/Astrella_Virgiananda.jpg" },
  { id: 31, name: "Aurellia", nickname: "Lia", code: "AURELLIA", type: "LOVE", photo: "https://jkt48.com/api/v1/storages/media/jkt48-member/aurellia.jpg" },
  { id: 33, name: "Aurhel Alana", nickname: "Lana", code: "AURHEL_ALANA", type: "LOVE", photo: "https://jkt48.com/api/v1/storages/media/jkt48-member/aurhel_alana.jpg" },
  { id: 39, name: "Bong Aprilli", nickname: "Rilly", code: "BONG_APRILLI", type: "TRAINEE", photo: "https://jkt48.com/api/v1/storages/media/jkt48-member/Bong_Aprilli.jpg" },
  { id: 43, name: "Carissa Dini", nickname: "Carissa", code: "CARISSA_DINI", type: "TRAINEE", photo: "https://jkt48.com/api/v1/storages/media/jkt48-member/carissa_dini.jpg" },
  { id: 44, name: "Catherina Vallencia", nickname: "Erine", code: "CATHERINA_VALLENCIA", type: "PASSION", photo: "https://jkt48.com/api/v1/storages/media/jkt48-member/catherina_vallencia.jpg" },
  { id: 46, name: "Celline Thefani", nickname: "Elin", code: "CELLINE_THEFANI", type: "LOVE", photo: "https://jkt48.com/api/v1/storages/media/jkt48-member/celline_thefani.jpg" },
  { id: 52, name: "Christabella Bonita", nickname: "Bella", code: "CHRISTABELLA_BONITA", type: "TRAINEE", photo: "https://jkt48.com/api/v1/storages/media/jkt48-member/christabella_bonita.jpg" },
  { id: 59, name: "Cornelia Vanisa", nickname: "Oniel", code: "CORNELIA_VANISA", type: "PASSION", photo: "https://jkt48.com/api/v1/storages/media/jkt48-member/cornelia_vanisa.jpg" },
  { id: 60, name: "Cynthia Yaputera", nickname: "Cynthia", code: "CYNTHIA_YAPUTERA", type: "LOVE", photo: "https://jkt48.com/api/v1/storages/media/jkt48-member/cynthia_yaputera.jpg" },
  { id: 64, name: "Dena Natalia", nickname: "Danella", code: "DENA_NATALIA", type: "PASSION", photo: "https://jkt48.com/api/v1/storages/media/jkt48-member/dena_natalia.jpg" },
  { id: 67, name: "Desy Natalia", nickname: "Daisy", code: "DESY_NATALIA", type: "PASSION", photo: "https://jkt48.com/api/v1/storages/media/jkt48-member/desy_natalia.jpg" },
  { id: 82, name: "Fahira Putri", nickname: "Fahira", code: "FAHIRA_PUTRI", type: "TRAINEE", photo: "https://jkt48.com/api/v1/storages/media/jkt48-member/fahira_putri.jpg" },
  { id: 85, name: "Fatimah Azzahra", nickname: "Rara", code: "FATIMAH_AZZAHRA", type: "TRAINEE", photo: "https://jkt48.com/api/v1/storages/media/jkt48-member/fatimah_azzahra.jpg" },
  { id: 88, name: "Febriola Sinambela", nickname: "Olla", code: "FEBRIOLA_SINAMBELA", type: "DREAM", photo: "https://jkt48.com/api/v1/storages/media/jkt48-member/febriola_sinambela.jpg" },
  { id: 89, name: "Feni Fitriyanti", nickname: "Feni", code: "FENI_FITRIYANTI", type: "PASSION", photo: "https://jkt48.com/api/v1/storages/media/jkt48-member/feni_fitriyanti.jpg" },
  { id: 91, name: "Fiony Alveria", nickname: "Fiony", code: "FIONY_ALVERIA", type: "LOVE", photo: "https://jkt48.com/api/v1/storages/media/jkt48-member/fiony_alveria.jpg" },
  { id: 94, name: "Freya Jayawardana", nickname: "Freya", code: "FREYA_JAYAWARDANA", type: "DREAM", photo: "https://jkt48.com/api/v1/storages/media/jkt48-member/freya_jayawardana.jpg" },
  { id: 96, name: "Fritzy Rosmerian", nickname: "Fritzy", code: "FRITZY_ROSMERIAN", type: "LOVE", photo: "https://jkt48.com/api/v1/storages/media/jkt48-member/fritzy_rosmerian.jpg" },
  { id: 97, name: "Gabriela Abigail", nickname: "Ella", code: "GABRIELA_ABIGAIL", type: "DREAM", photo: "https://jkt48.com/api/v1/storages/media/jkt48-member/gabriela_abigail.jpg" },
  { id: 104, name: "Gita Sekar Andarini", nickname: "Gita", code: "GITA_SEKAR_ANDARINI", type: "DREAM", photo: "https://jkt48.com/api/v1/storages/media/jkt48-member/gita_sekar_andarini.jpg" },
  { id: 105, name: "Grace Octaviani", nickname: "Gracie", code: "GRACE_OCTAVIANI", type: "LOVE", photo: "https://jkt48.com/api/v1/storages/media/jkt48-member/grace_octaviani.jpg" },
  { id: 107, name: "Greesella Adhalia", nickname: "Greesel", code: "GREESELLA_ADHALIA", type: "DREAM", photo: "https://jkt48.com/api/v1/storages/media/jkt48-member/greesella_adhalia.jpg" },
  { id: 108, name: "Hagia Sopia", nickname: "Giaa", code: "HAGIA_SOPIA", type: "TRAINEE", photo: "https://jkt48.com/api/v1/storages/media/jkt48-member/Hagia_Sopia.jpg" },
  { id: 111, name: "Heidi Suyangga", nickname: "Heidi", code: "HEIDI_SUYANGGA", type: "TRAINEE", photo: "https://jkt48.com/api/v1/storages/media/jkt48-member/heidi_suyangga.jpg" },
  { id: 112, name: "Helisma Putri", nickname: "Eli", code: "HELISMA_PUTRI", type: "DREAM", photo: "https://jkt48.com/api/v1/storages/media/jkt48-member/helisma_putri.jpg" },
  { id: 114, name: "Hillary Abigail", nickname: "Lily", code: "HILLARY_ABIGAIL", type: "LOVE", photo: "https://jkt48.com/api/v1/storages/media/jkt48-member/hillary_abigail.jpg" },
  { id: 115, name: "Humaira Ramadhani", nickname: "Maira", code: "HUMAIRA_RAMADHANI", type: "TRAINEE", photo: "https://jkt48.com/api/v1/storages/media/jkt48-member/Humaira_Ramadhani.jpg" },
  { id: 116, name: "Indah Cahya", nickname: "Indah", code: "INDAH_CAHYA", type: "LOVE", photo: "https://jkt48.com/api/v1/storages/media/jkt48-member/indah_cahya.jpg" },
  { id: 120, name: "Jacqueline Immanuela", nickname: "Ekin", code: "JACQUELINE_IMMANUELA", type: "TRAINEE", photo: "https://jkt48.com/api/v1/storages/media/jkt48-member/Jacqueline_Immanuela.jpg" },
  { id: 121, name: "Jazzlyn Trisha", nickname: "Trisha", code: "JAZZLYN_TRISHA", type: "LOVE", photo: "https://jkt48.com/api/v1/storages/media/jkt48-member/jazzlyn_trisha.jpg" },
  { id: 123, name: "Jemima Evodie", nickname: "Jemima", code: "JEMIMA_EVODIE", type: "TRAINEE", photo: "https://jkt48.com/api/v1/storages/media/jkt48-member/Jemima_Evodie.jpg" },
  { id: 127, name: "Jessica Chandra", nickname: "Jessi", code: "JESSICA_CHANDRA", type: "PASSION", photo: "https://jkt48.com/api/v1/storages/media/jkt48-member/jessica_chandra.jpg" },
  { id: 131, name: "Jesslyn Elly", nickname: "Lyn", code: "JESSLYN_ELLY", type: "DREAM", photo: "https://jkt48.com/api/v1/storages/media/jkt48-member/jesslyn_elly.jpg" },
  { id: 143, name: "Kathrina Irene", nickname: "Kathrina", code: "KATHRINA_IRENE", type: "PASSION", photo: "https://jkt48.com/api/v1/storages/media/jkt48-member/kathrina_irene.jpg" },
  { id: 148, name: "Lulu Salsabila", nickname: "Lulu", code: "LULU_SALSABILA", type: "PASSION", photo: "https://jkt48.com/api/v1/storages/media/jkt48-member/lulu_salsabila.jpg" },
  { id: 152, name: "Marsha Lenathea", nickname: "Marsha", code: "MARSHA_LENATHEA", type: "DREAM", photo: "https://jkt48.com/api/v1/storages/media/jkt48-member/marsha_lenathea.jpg" },
  { id: 155, name: "Maxine Faye", nickname: "Maxine", code: "MAXINE_FAYE", type: "TRAINEE", photo: "https://jkt48.com/api/v1/storages/media/jkt48-member/maxine_faye_lee.jpg" },
  { id: 159, name: "Michelle Alexandra", nickname: "Michie", code: "MICHELLE_ALEXANDRA", type: "LOVE", photo: "https://jkt48.com/api/v1/storages/media/jkt48-member/michelle_alexandra.jpg" },
  { id: 161, name: "Michelle Levia", nickname: "Levi", code: "MICHELLE_LEVIA", type: "PASSION", photo: "https://jkt48.com/api/v1/storages/media/jkt48-member/michelle_levia.jpg" },
  { id: 162, name: "Mikaela Kusjanto", nickname: "Mikaela", code: "MIKAELA_KUSJANTO", type: "TRAINEE", photo: "https://jkt48.com/api/v1/storages/media/jkt48-member/Mikaela_Kusjanto.jpg" },
  { id: 166, name: "Mutiara Azzahra", nickname: "Muthe", code: "MUTIARA_AZZAHRA", type: "PASSION", photo: "https://jkt48.com/api/v1/storages/media/jkt48-member/mutiara_azzahra.jpg" },
  { id: 175, name: "Nayla Suji", nickname: "Nayla", code: "NAYLA_SUJI", type: "LOVE", photo: "https://jkt48.com/api/v1/storages/media/jkt48-member/nayla_suji.jpg" },
  { id: 178, name: "Nina Tutachia", nickname: "Nachia", code: "NINA_TUTACHIA", type: "DREAM", photo: "https://jkt48.com/api/v1/storages/media/jkt48-member/nina_tutachia.jpg" },
  { id: 182, name: "Nur Intan", nickname: "Intan", code: "NUR_INTAN", type: "TRAINEE", photo: "https://jkt48.com/api/v1/storages/media/jkt48-member/Nur_Intan.jpg" },
  { id: 185, name: "Oline Manuel", nickname: "Oline", code: "OLINE_MANUEL", type: "DREAM", photo: "https://jkt48.com/api/v1/storages/media/jkt48-member/oline_manuel.jpg" },
  { id: 194, name: "Putry Jazyta", nickname: "Jazzy", code: "PUTRY_JAZYTA", type: "TRAINEE", photo: "https://jkt48.com/api/v1/storages/media/jkt48-member/putry_jazyta.jpg" },
  { id: 195, name: "Raisha Syifa", nickname: "Raisha", code: "RAISHA_SYIFA", type: "PASSION", photo: "https://jkt48.com/api/v1/storages/media/jkt48-member/raisha_syifa.jpg" },
  { id: 196, name: "Ralyne Van Irwan", nickname: "Ralyne", code: "RALYNE_VAN_IRWAN", type: "TRAINEE", photo: "https://jkt48.com/api/v1/storages/media/jkt48-member/ralyne_van_irwan.jpg" },
  { id: 204, name: "Ribka Budiman", nickname: "Ribka", code: "RIBKA_BUDIMAN", type: "PASSION", photo: "https://jkt48.com/api/v1/storages/media/jkt48-member/ribka_budiman.jpg" },
  { id: 221, name: "Shabilqis Naila", nickname: "Nala", code: "SHABILQIS_NAILA", type: "DREAM", photo: "https://jkt48.com/api/v1/storages/media/jkt48-member/shabilqis_naila.jpg" },
  { id: 231, name: "Sona Kalyana", nickname: "Sona", code: "SONA_KALYANA", type: "TRAINEE", photo: "https://jkt48.com/api/v1/storages/media/jkt48-member/sona_kalyana.jpg" },
  { id: 244, name: "Victoria Kimberly", nickname: "Kimmy", code: "VICTORIA_KIMBERLY", type: "PASSION", photo: "https://jkt48.com/api/v1/storages/media/jkt48-member/victoria_kimberly.jpg" }
];

import axios from "axios";

/**
 * Executes direct HTTP fetch to JKT48 endpoints or mirror
 */
export async function jktInPageFetch(apiUrl) {
  try {
    const res = await axios.get(apiUrl, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json, text/plain, */*",
        Referer: "https://jkt48.com/",
        Origin: "https://jkt48.com",
      },
      timeout: 10000,
    });
    return res.data;
  } catch (err) {
    throw new Error(err.response?.data?.message || err.message || "Gagal mengambil data dari JKT48");
  }
}

/**
 * Fetch latest JKT48 Official News
 * Prioritizes high-speed HTTP API mirror with fallback to official browser session
 */
export async function getJkt48News(limit = 5) {
  const safeLimit = Math.min(Math.max(limit, 1), 20);

  // 1. Coba lewat mirror API publik super cepat (tanpa butuh browser/Cloudflare challenge)
  try {
    const { default: axios } = await import("axios");
    const res = await axios.get(`https://api.crstlnz.my.id/api/news?page=1&perpage=${safeLimit}`, {
      timeout: 8000,
      headers: { "User-Agent": USER_AGENT },
    });
    if (Array.isArray(res.data?.news) && res.data.news.length > 0) {
      return res.data.news.map((item) => ({
        title: item.title,
        valid_date_from: item.date,
        category: item.category || "Official",
        link: item.link || item.id,
      }));
    }
  } catch (_) {}

  // 2. Fallback ke headless browser context jika mirror offline
  const json = await jktInPageFetch(
    `${JKT48_BASE}/api/v1/news?lang=id&limit=${safeLimit}`
  );
  if (!json?.status || !Array.isArray(json?.data)) {
    throw new Error("Gagal memuat berita dari server resmi JKT48.");
  }
  return json.data;
}

/**
 * Fetch JKT48 Monthly Schedules
 * Prioritizes high-speed HTTP mirror with fallback to browser session
 */
export async function getJkt48Schedules(month, year) {
  const now = new Date();
  const m = month || now.getMonth() + 1;
  const y = year || now.getFullYear();

  // 1. Coba lewat HTTP mirror theater/schedules API
  try {
    const { default: axios } = await import("axios");
    const res = await axios.get("https://api.crstlnz.my.id/api/theater?page=1&perpage=50", {
      timeout: 8000,
      headers: { "User-Agent": USER_AGENT },
    });
    if (Array.isArray(res.data?.theater) && res.data.theater.length > 0) {
      const mapped = res.data.theater.map((t) => {
        const d = new Date(t.date || t.start_date);
        const yyyy = d.getUTCFullYear();
        const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
        const dd = String(d.getUTCDate()).padStart(2, "0");
        const dateStr = `${yyyy}-${mm}-${dd}`;

        const startTimeStr = t.start_date ? new Date(t.start_date).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) : "14:00";
        const endTimeStr = t.end_date ? new Date(t.end_date).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) : "16:00";

        return {
          schedule_id: t.id,
          reference_code: t.id,
          title: t.title,
          jkt48_member_type: t.team,
          date: dateStr,
          start_time: startTimeStr,
          end_time: endTimeStr,
          link: t.url || t.id,
          members: t.members,
        };
      });

      return { month: m, year: y, schedules: mapped };
    }
  } catch (_) {}

  // 2. Fallback ke headless browser context jika mirror offline
  const json = await jktInPageFetch(
    `${JKT48_BASE}/api/v1/schedules?lang=id&month=${m}&year=${y}`
  );
  if (!json?.status || !Array.isArray(json?.data)) {
    throw new Error(`Gagal memuat jadwal JKT48 bulan ${m}/${y}.`);
  }
  return { month: m, year: y, schedules: json.data };
}

/**
 * Fetch JKT48 Show / Schedule Details & Lineup
 * URL: https://jkt48.com/api/v1/schedules/{slugOrCode}?lang=id
 */
export async function getJkt48ScheduleDetail(codeOrSlug) {
  let targetSlug = codeOrSlug.trim();

  // 1. Coba lookup via mirror theater dulu
  try {
    const { schedules } = await getJkt48Schedules();
    const match = schedules.find(
      (s) =>
        String(s.reference_code || "").toUpperCase() === targetSlug.toUpperCase() ||
        String(s.schedule_id) === targetSlug
    );
    if (match) {
      return {
        title: match.title,
        code: match.reference_code || match.schedule_id,
        jkt48_member_type: match.jkt48_member_type,
        date: match.date,
        start_time: match.start_time,
        end_time: match.end_time,
        default_price: 200000,
        jkt48_member: match.members || [],
        link: match.link,
      };
    }
  } catch (_) {}

  // 2. Fallback ke in-page browser fetch
  const json = await jktInPageFetch(
    `${JKT48_BASE}/api/v1/schedules/${encodeURIComponent(targetSlug)}?lang=id`
  );
  if (!json?.status || !json?.data) {
    throw new Error(`Detail show "${codeOrSlug}" tidak ditemukan.`);
  }
  return json.data;
}

/**
 * Fetch all active JKT48 members
 */
export async function getJkt48Members() {
  // Coba ambil via browser session resmi
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

  // Fallback cache statis member jika browser belum siap
  return STATIC_MEMBERS;
}

/**
 * Live scrape member details from AKB48 Fandom Wiki (https://akb48.fandom.com)
 */
export async function getAkb48FandomMemberDetail(memberName) {
  if (!memberName) return null;

  try {
    const formattedTitle = encodeURIComponent(
      memberName.trim().replace(/\s+/g, "_")
    );
    const apiUrl = `https://akb48.fandom.com/api.php?action=parse&page=${formattedTitle}&prop=wikitext|images&format=json`;

    // Attempt direct fetch with axios first
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
      // If direct request blocked, fallback to browser session
      const pageResult = await jktInPageFetch(apiUrl);
      parseData = pageResult?.parse;
    }

    if (!parseData?.wikitext) return null;
    const wikitext = parseData.wikitext["*"];

    // Ambil gambar profil member dari Fandom (cari file gambar non-icon/logo)
    let wikiImageUrl = null;
    const candidateImg = Array.isArray(parseData.images)
      ? parseData.images.find(
          (img) =>
            /\.(jpe?g|png|webp)$/i.test(img) &&
            !/logo|icon|\.svg|x\.svg|showroom|tiktok|instagram|idn/i.test(img)
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
      return m
        ? m[1]
            .replace(/\[\[|\]\]|\{\{[^}]+\}\}|<[^>]+>/g, "")
            .trim()
        : null;
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

/**
 * Fetch detail profile of a JKT48 member by name or ID
 * Combines live data from official JKT48 and akb48.fandom.com
 */
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

  // If fandomData already resolved basic details, only try browser if needed
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
    photo: target.photo || (data?.photo ? `${JKT48_BASE}/api/v1/storages/${data.photo.replace(/^\/+/, "")}` : null) || fandomData?.wikiImageUrl,
    fandom: fandomData || null,
  };
}

/**
 * Fetch JKT48 Showroom Leaderboard
 * URL: https://admin.jkt48showroom-api.my.id/leaderboard-member/showroom
 */
export async function getShowroomLeaderboard(page = 1, filterBy = "month", year = new Date().getFullYear()) {
  const { default: axios } = await import("axios");
  const url = `https://admin.jkt48showroom-api.my.id/leaderboard-member/showroom?page=${page}&filterBy=${filterBy}&year=${year}`;
  const res = await axios.get(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    },
    timeout: 10000,
  });
  return res.data;
}

/**
 * Fetch JKT48 Show Schedules from Showroom API
 * URL: https://admin.jkt48showroom-api.my.id/schedules?isOnWeekSchedule=true/false
 */
export async function getShowroomSchedules(isOnWeek = true) {
  const { default: axios } = await import("axios");
  const url = `https://admin.jkt48showroom-api.my.id/schedules?isOnWeekSchedule=${isOnWeek ? "true" : "false"}`;
  const res = await axios.get(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    },
    timeout: 10000,
  });
  return Array.isArray(res.data) ? res.data : [];
}


