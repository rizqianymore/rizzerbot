import dns from "node:dns";
try {
  dns.setDefaultResultOrder("ipv4first");
} catch (_) {}

/**
 * Upload buffer file ke Qu.ax
 * Batas: 256 MB
 */
export async function uploadToQuax(buffer, filename = "file.bin") {
  if (!buffer || !buffer.length) throw new Error("Buffer file kosong");

  const form = new FormData();
  form.append("files[]", new Blob([buffer]), filename);

  const res = await fetch("https://qu.ax/upload.php", {
    method: "POST",
    body: form,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) RizzerBot/Uploader",
    },
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    throw new Error(`Qu.ax upload failed with HTTP ${res.status}`);
  }

  const data = await res.json();
  const file = data?.files?.[0];
  if (!data?.success || !file?.url) {
    throw new Error("Qu.ax upload failed: tidak ada URL file.");
  }

  return {
    provider: "Qu.ax",
    url: file.url,
    directUrl: file.url,
    retention: "Permanent",
    sizeBytes: file.size || buffer.length,
  };
}

/**
 * Upload buffer file ke Uguu.se
 * Batas: 128 MB (Temporary 3 jam)
 */
export async function uploadToUguu(buffer, filename = "file.bin") {
  if (!buffer || !buffer.length) throw new Error("Buffer file kosong");

  const form = new FormData();
  form.append("files[]", new Blob([buffer]), filename);

  const res = await fetch("https://uguu.se/upload.php", {
    method: "POST",
    body: form,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) RizzerBot/Uploader",
    },
    signal: AbortSignal.timeout(45000),
  });

  if (!res.ok) {
    throw new Error(`Uguu upload failed with HTTP ${res.status}`);
  }

  const data = await res.json();
  const file = data?.files?.[0];
  if (!data?.success || !file?.url) {
    throw new Error("Uguu upload failed: respon tidak valid.");
  }

  return {
    provider: "Uguu.se",
    url: file.url,
    directUrl: file.url,
    retention: "3 Jam (Temporary)",
    sizeBytes: file.size || buffer.length,
  };
}

/**
 * Upload buffer file ke Catbox.moe
 * Batas: 200 MB
 */
export async function uploadToCatbox(buffer, filename = "file.bin") {
  if (!buffer || !buffer.length) throw new Error("Buffer file kosong");

  const form = new FormData();
  form.append("reqtype", "fileupload");
  form.append("fileToUpload", new Blob([buffer]), filename);

  const res = await fetch("https://catbox.moe/user/api.php", {
    method: "POST",
    body: form,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) RizzerBot/Uploader",
    },
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) {
    throw new Error(`Catbox upload failed with HTTP ${res.status}`);
  }

  const url = (await res.text()).trim();
  if (!/^https?:\/\/files\.catbox\.moe\//i.test(url)) {
    throw new Error(`Catbox error: ${url.slice(0, 150)}`);
  }

  return {
    provider: "Catbox.moe",
    url,
    directUrl: url,
    retention: "Permanent / 2 tahun non-aktif",
    sizeBytes: buffer.length,
  };
}

/**
 * Smart Multi-provider Uploader dengan automatic failover
 */
export async function smartUpload(buffer, filename = "file.bin", preferred = "auto") {
  const providers = [];
  const pref = String(preferred || "").toLowerCase();

  if (pref.includes("catbox")) {
    providers.push(uploadToCatbox, uploadToQuax, uploadToUguu);
  } else if (pref.includes("uguu")) {
    providers.push(uploadToUguu, uploadToQuax, uploadToCatbox);
  } else {
    // Default prioritas: Qu.ax (permanen & responsif) -> Uguu -> Catbox
    providers.push(uploadToQuax, uploadToUguu, uploadToCatbox);
  }

  const errors = [];
  for (const fn of providers) {
    try {
      const res = await fn(buffer, filename);
      if (res?.url) return res;
    } catch (err) {
      errors.push(err.message || err);
    }
  }

  throw new Error(`Gagal mengunggah ke semua provider file: ${errors.join(" | ")}`);
}
