export default {
  name: "jam",
  aliases: ["waktu", "clock", "worldclock", "time"],
  description: "Waktu lokal WIB/WITA/WIT & worldclock",
  usage: "[kota/zone], cth: jam | jam jakarta | jam tokyo | jam london",
  category: "Tools",
  cooldownMs: 3000,
  run: async (sock, msg, args, { reply }) => {
    const q = args.join(" ").trim().toLowerCase();
    const zones = {
      jakarta: "Asia/Jakarta",
      wib: "Asia/Jakarta",
      bangkok: "Asia/Bangkok",
      singapore: "Asia/Singapore",
      sg: "Asia/Singapore",
      malaysia: "Asia/Kuala_Lumpur",
      bali: "Asia/Makassar",
      wita: "Asia/Makassar",
      makassar: "Asia/Makassar",
      jayapura: "Asia/Jayapura",
      wit: "Asia/Jayapura",
      tokyo: "Asia/Tokyo",
      seoul: "Asia/Seoul",
      beijing: "Asia/Shanghai",
      shanghai: "Asia/Shanghai",
      london: "Europe/London",
      paris: "Europe/Paris",
      berlin: "Europe/Berlin",
      moscow: "Europe/Moscow",
      dubai: "Asia/Dubai",
      newyork: "America/New_York",
      ny: "America/New_York",
      losangeles: "America/Los_Angeles",
      la: "America/Los_Angeles",
    };

    const fmt = (tz) =>
      new Intl.DateTimeFormat("id-ID", {
        timeZone: tz,
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZoneName: "short",
      }).format(new Date());

    if (!q) {
      const lines = [
        `*WAKTU INDONESIA*`,
        "",
        `• WIB (Jakarta): ${fmt("Asia/Jakarta")}`,
        `• WITA (Makassar): ${fmt("Asia/Makassar")}`,
        `• WIT (Jayapura): ${fmt("Asia/Jayapura")}`,
        "",
        `_Ketik: jam tokyo | jam london | jam newyork_`,
      ];
      return reply(lines.join("\n"));
    }

    const key = q.replace(/\s+/g, "");
    const tz = zones[key] || zones[q] || null;
    if (tz) {
      return reply(`*JAM ${q.toUpperCase()}*\n${fmt(tz)}\n(${tz})`);
    }

    // coba tebak zone langsung
    try {
      const test = fmt(q);
      // jika tidak throw, anggap valid IANA
      return reply(`*JAM ${q.toUpperCase()}*\n${test}\n(${q})`);
    } catch {}

    // fallback coba worldtimeapi
    try {
      const { request } = await import("@/src/utils/request.js");
      // map bebas ke Asia/Jakarta style
      const guess = `Asia/${q.charAt(0).toUpperCase() + q.slice(1)}`;
      const data = await request.json(`http://worldtimeapi.org/api/timezone/${encodeURIComponent(tz || guess)}`, {
        timeout: 8000,
      });
      if (data?.datetime) {
        return reply(`*JAM ${q.toUpperCase()}*\n${data.datetime}\n(${data.timezone})`);
      }
    } catch {}

    return reply(`Zone tidak dikenal: ${q}\nCoba: jakarta, bali, jayapura, tokyo, london, newyork`);
  },
};
