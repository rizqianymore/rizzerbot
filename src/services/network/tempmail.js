import dns from "node:dns";
try {
  dns.setDefaultResultOrder("ipv4first");
} catch (_) {}

export async function create10MinuteMail() {
  const res = await fetch("https://10minutemail.net/address.api.php?new=1", {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) RizzerBot/TempMail" },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) throw new Error(`10MinuteMail HTTP ${res.status}`);
  const cookie = res.headers.get("set-cookie") || "";
  const data = await res.json();
  const address = data?.mail_get_mail;

  if (!address) throw new Error("Gagal mendapatkan alamat dari 10MinuteMail.");

  return {
    address,
    provider: "10minutemail",
    token: cookie,
    expiresIn: "10 Menit",
  };
}

export async function get10MinuteMessages(cookie) {
  const res = await fetch("https://10minutemail.net/address.api.php", {
    headers: {
      Cookie: cookie,
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) RizzerBot/TempMail",
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) throw new Error(`10MinuteMail check HTTP ${res.status}`);
  const data = await res.json();
  const list = data?.mail_list || [];

  return list.map((m) => ({
    id: m.mail_id,
    from: m.from,
    subject: m.subject || "(Tanpa Subjek)",
    date: m.datetime || m.time || "-",
  }));
}

export async function read10MinuteMessage(cookie, mailId) {
  const res = await fetch(`https://10minutemail.net/mail.api.php?mailid=${encodeURIComponent(mailId)}`, {
    headers: {
      Cookie: cookie,
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) RizzerBot/TempMail",
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) throw new Error(`10MinuteMail read HTTP ${res.status}`);
  const data = await res.json();

  let body = "";
  if (Array.isArray(data?.plain) && data.plain.length > 0) {
    body = data.plain.join("\n");
  } else if (typeof data?.plain === "string") {
    body = data.plain;
  }

  if (!body && data?.html) {
    const rawHtml = Array.isArray(data.html) ? data.html.join("\n") : String(data.html);
    body = rawHtml
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim();
  }

  return {
    id: data.mail_id || mailId,
    from: data.from,
    subject: data.subject || "(Tanpa Subjek)",
    date: data.datetime || "-",
    textBody: body || "(Pesan kosong)",
  };
}

export async function createGuerrillaMail() {
  const res = await fetch("https://api.guerrillamail.com/ajax.php?f=get_email_address", {
    headers: { "User-Agent": "Mozilla/5.0 RizzerBot/TempMail" },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) throw new Error(`GuerrillaMail HTTP ${res.status}`);
  const data = await res.json();

  return {
    address: data.email_addr,
    provider: "guerrillamail",
    token: data.sid_token,
    expiresIn: "60 Menit",
  };
}

export async function getGuerrillaMessages(sidToken) {
  const res = await fetch(
    `https://api.guerrillamail.com/ajax.php?f=get_email_list&offset=0&sid_token=${encodeURIComponent(sidToken)}`,
    {
      headers: { "User-Agent": "Mozilla/5.0 RizzerBot/TempMail" },
      signal: AbortSignal.timeout(10000),
    }
  );

  if (!res.ok) throw new Error(`GuerrillaMail check HTTP ${res.status}`);
  const data = await res.json();
  const list = data?.list || [];

  return list.map((m) => ({
    id: String(m.mail_id),
    from: m.mail_from,
    subject: m.mail_subject || "(Tanpa Subjek)",
    date: m.mail_date || "-",
  }));
}

export async function readGuerrillaMessage(sidToken, mailId) {
  const res = await fetch(
    `https://api.guerrillamail.com/ajax.php?f=fetch_email&email_id=${encodeURIComponent(mailId)}&sid_token=${encodeURIComponent(sidToken)}`,
    {
      headers: { "User-Agent": "Mozilla/5.0 RizzerBot/TempMail" },
      signal: AbortSignal.timeout(10000),
    }
  );

  if (!res.ok) throw new Error(`GuerrillaMail read HTTP ${res.status}`);
  const data = await res.json();

  const body = String(data.mail_body || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

  return {
    id: String(data.mail_id || mailId),
    from: data.mail_from,
    subject: data.mail_subject || "(Tanpa Subjek)",
    date: data.mail_date || "-",
    textBody: body || data.mail_excerpt || "(Pesan kosong)",
  };
}

export async function createUniversalMailbox(engine = "auto") {
  const e = String(engine || "").toLowerCase();
  if (e.includes("guerrilla")) {
    return await createGuerrillaMail();
  }
  try {
    return await create10MinuteMail();
  } catch (err) {
    return await createGuerrillaMail();
  }
}

export async function getUniversalMessages(session) {
  if (!session || !session.token) {
    throw new Error("Sesi tempmail tidak valid.");
  }
  if (session.provider === "guerrillamail") {
    return await getGuerrillaMessages(session.token);
  }
  return await get10MinuteMessages(session.token);
}

export async function readUniversalMessage(session, messageId) {
  if (!session || !session.token) {
    throw new Error("Sesi tempmail tidak valid.");
  }
  if (session.provider === "guerrillamail") {
    return await readGuerrillaMessage(session.token, messageId);
  }
  return await read10MinuteMessage(session.token, messageId);
}
