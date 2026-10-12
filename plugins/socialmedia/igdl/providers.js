export async function downloadFromKolId(targetUrl) {
  const headers = {
    "user-agent":
      "Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36",
    "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
  };

  const pageRes = await fetch("https://kol.id/download-video/instagram", {
    headers,
    signal: AbortSignal.timeout(10000),
  });
  if (!pageRes.ok) throw new Error(`Kol.id page returned ${pageRes.status}`);

  const html = await pageRes.text();
  const setCookies = pageRes.headers.getSetCookie
    ? pageRes.headers.getSetCookie()
    : [pageRes.headers.get("set-cookie")];
  const cookieHeader = (setCookies || [])
    .filter(Boolean)
    .map((c) => c.split(";")[0])
    .join("; ");
  const token = (html.match(/name="_token"\s+value="([^"]+)"/) || [])[1];

  if (!token) throw new Error("Gagal mengambil token CSRF dari kol.id");

  const postRes = await fetch("https://kol.id/api/v2/downloader/instagram", {
    method: "POST",
    headers: {
      ...headers,
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      cookie: cookieHeader,
      origin: "https://kol.id",
      referer: "https://kol.id/download-video/instagram",
      "x-requested-with": "XMLHttpRequest",
    },
    body: new URLSearchParams({
      url: targetUrl,
      _token: token,
    }).toString(),
    signal: AbortSignal.timeout(15000),
  });

  const postData = await postRes.json();
  let resultData = postData?.data;

  if (postData?.meta?.status === "accepted" && resultData?.request_id) {
    const reqId = resultData.request_id;
    const pollInterval = (resultData.poll_after || 4) * 1000;

    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, pollInterval));
      const pollRes = await fetch(
        `https://kol.id/api/v2/downloader/status/${reqId}`,
        {
          headers: {
            ...headers,
            cookie: cookieHeader,
            referer: "https://kol.id/download-video/instagram",
            "x-requested-with": "XMLHttpRequest",
          },
          signal: AbortSignal.timeout(10000),
        }
      );
      if (!pollRes.ok) continue;

      const pollData = await pollRes.json();
      if (
        pollData?.meta?.status === "ok" ||
        pollData?.data?.status === "completed"
      ) {
        resultData = pollData.data;
        break;
      }
      if (
        pollData?.meta?.status === "failed" ||
        pollData?.data?.status === "failed"
      ) {
        throw new Error(pollData?.meta?.message || "Kol.id parsing gagal.");
      }
    }
  }

  if (!resultData) return null;

  const mediaItems = [];
  if (Array.isArray(resultData.slides) && resultData.slides.length > 0) {
    for (const slide of resultData.slides) {
      const mediaUrl = slide.url || slide.thumbnail;
      if (!mediaUrl) continue;
      mediaItems.push({
        type: slide.type === "video" ? "mp4" : "image",
        url: mediaUrl,
      });
    }
  } else if (resultData.video_url) {
    mediaItems.push({
      type: "mp4",
      url: resultData.video_url,
    });
  } else if (resultData.thumbnail) {
    mediaItems.push({
      type: "image",
      url: resultData.thumbnail,
    });
  }

  if (!mediaItems.length) return null;

  return {
    username: resultData.author || "",
    likes: 0,
    title: resultData.title || "",
    media: mediaItems,
  };
}
