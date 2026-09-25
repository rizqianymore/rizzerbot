import dns from "node:dns/promises";
import net from "node:net";

/**
 * Clean domain input from protocol or path
 */
export function cleanDomain(input) {
  let domain = input.trim().toLowerCase();
  domain = domain.replace(/^https?:\/\//i, "");
  domain = domain.split("/")[0].split("?")[0].split(":")[0];
  return domain;
}

/**
 * DNS Lookup (A, AAAA, MX, TXT, NS, CNAME)
 */
export async function getDnsRecords(rawDomain) {
  const domain = cleanDomain(rawDomain);
  const [a, aaaa, mx, txt, ns, cname] = await Promise.allSettled([
    dns.resolve4(domain),
    dns.resolve6(domain),
    dns.resolveMx(domain),
    dns.resolveTxt(domain),
    dns.resolveNs(domain),
    dns.resolveCname(domain),
  ]);

  return {
    domain,
    a: a.status === "fulfilled" ? a.value : [],
    aaaa: aaaa.status === "fulfilled" ? aaaa.value : [],
    mx:
      mx.status === "fulfilled"
        ? mx.value.map((m) => `${m.exchange} (priority: ${m.priority})`)
        : [],
    txt:
      txt.status === "fulfilled"
        ? txt.value.map((t) => (Array.isArray(t) ? t.join(" ") : t))
        : [],
    ns: ns.status === "fulfilled" ? ns.value : [],
    cname: cname.status === "fulfilled" ? cname.value : [],
  };
}

/**
 * Socket WHOIS lookup via TCP port 43
 */
function queryWhoisServer(query, server) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(43, server, () => {
      socket.write(query + "\r\n");
    });
    let data = "";
    socket.setEncoding("utf8");
    socket.on("data", (chunk) => (data += chunk));
    socket.on("end", () => resolve(data));
    socket.on("error", reject);
    socket.setTimeout(8000, () => {
      socket.destroy();
      reject(new Error(`WHOIS timeout (${server})`));
    });
  });
}

/**
 * Comprehensive WHOIS lookup following referral chains
 */
export async function getWhois(rawDomain) {
  const domain = cleanDomain(rawDomain);
  let rawData = await queryWhoisServer(domain, "whois.iana.org");

  const referMatch =
    rawData.match(/refer:\s+([^\s]+)/i) || rawData.match(/whois:\s+([^\s]+)/i);

  if (referMatch && referMatch[1]) {
    const referralServer = referMatch[1].trim();
    try {
      const detailed = await queryWhoisServer(domain, referralServer);
      if (detailed && detailed.trim().length > 50) {
        rawData = detailed;
      }
    } catch (_) {}
  }

  // Parse key attributes
  const extract = (regex) => {
    const m = rawData.match(regex);
    return m ? m[1].trim() : "-";
  };

  const domainName = extract(/Domain Name:\s*([^\r\n]+)/i) || domain;
  const registrar = extract(/Registrar:\s*([^\r\n]+)/i);
  const createdDate = extract(/(?:Creation Date|Created On|created):\s*([^\r\n]+)/i);
  const updatedDate = extract(/(?:Updated Date|Last Updated On|changed):\s*([^\r\n]+)/i);
  const expiryDate = extract(/(?:Registry Expiry Date|Registrar Registration Expiration Date|Expiration Date|expires):\s*([^\r\n]+)/i);
  const registrarWhois = extract(/Registrar WHOIS Server:\s*([^\r\n]+)/i);
  const abuseEmail = extract(/(?:Registrar Abuse Contact Email):\s*([^\r\n]+)/i);

  return {
    domain: domainName,
    registrar,
    registrarWhois,
    abuseEmail,
    createdDate,
    updatedDate,
    expiryDate,
    rawText: rawData.slice(0, 1500),
  };
}

/**
 * Subdomain Lookup via HackerTarget API
 */
export async function getSubdomains(rawDomain) {
  const domain = cleanDomain(rawDomain);
  const url = `https://api.hackertarget.com/hostsearch/?q=${encodeURIComponent(domain)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });

  if (!res.ok) throw new Error(`HostSearch API HTTP ${res.status}`);
  const text = await res.text();

  if (text.includes("error") || text.includes("No records") || text.includes("API count exceeded")) {
    throw new Error(text.trim());
  }

  const lines = text.trim().split("\n");
  const subdomains = [];

  for (const line of lines) {
    const [sub, ip] = line.split(",");
    if (sub && ip) {
      subdomains.push({
        subdomain: sub.trim(),
        ip: ip.trim(),
      });
    }
  }

  return {
    domain,
    count: subdomains.length,
    subdomains,
  };
}

/**
 * IP Geolocation lookup
 */
export async function getIpGeo(ipOrDomain) {
  const target = cleanDomain(ipOrDomain);
  const url = `http://ip-api.com/json/${encodeURIComponent(target)}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status !== "success") {
    throw new Error(data.message || "Failed to resolve IP details");
  }
  return data;
}
