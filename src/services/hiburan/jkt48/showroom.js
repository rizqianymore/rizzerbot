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
