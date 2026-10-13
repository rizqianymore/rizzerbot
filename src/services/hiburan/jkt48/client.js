import { request } from "@/src/utils/request.js";
import { JKT48_BASE, USER_AGENT } from "./constants.js";

export async function jktInPageFetch(apiUrl) {
  try {
    return await request.json(apiUrl, {
      headers: {
        Referer: "https://jkt48.com/",
        Origin: "https://jkt48.com",
      },
      bypassCloudflare: "auto",
      timeout: 15000,
    });
  } catch (err) {
    throw new Error(err.message || "Gagal mengambil data dari JKT48");
  }
}

export async function getJkt48News(limit = 5) {
  const safeLimit = Math.min(Math.max(limit, 1), 20);

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

  const json = await jktInPageFetch(`${JKT48_BASE}/api/v1/news?lang=id&limit=${safeLimit}`);
  if (!json?.status || !Array.isArray(json?.data)) {
    throw new Error("Gagal memuat berita dari server resmi JKT48.");
  }
  return json.data;
}

export async function getJkt48Schedules(month, year) {
  const now = new Date();
  const m = month || now.getMonth() + 1;
  const y = year || now.getFullYear();

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

        const startTimeStr = t.start_date
          ? new Date(t.start_date).toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "Asia/Jakarta",
            })
          : "14:00";
        const endTimeStr = t.end_date
          ? new Date(t.end_date).toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "Asia/Jakarta",
            })
          : "16:00";

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

  const json = await jktInPageFetch(`${JKT48_BASE}/api/v1/schedules?lang=id&month=${m}&year=${y}`);
  if (!json?.status || !Array.isArray(json?.data)) {
    throw new Error(`Gagal memuat jadwal JKT48 bulan ${m}/${y}.`);
  }
  return { month: m, year: y, schedules: json.data };
}

export async function getJkt48ScheduleDetail(codeOrSlug) {
  const targetSlug = codeOrSlug.trim();

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

  const json = await jktInPageFetch(`${JKT48_BASE}/api/v1/schedules/${encodeURIComponent(targetSlug)}?lang=id`);
  if (!json?.status || !json?.data) {
    throw new Error(`Detail show "${codeOrSlug}" tidak ditemukan.`);
  }
  return json.data;
}
