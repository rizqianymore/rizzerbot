import dns from "node:dns/promises";
import https from "node:https";

const TARGETS = [
  { name: "WhatsApp Web", host: "web.whatsapp.com", port: 443 },
  { name: "Google DNS", host: "dns.google", port: 443 },
  { name: "Cloudflare", host: "1.1.1.1", port: 443 },
];

const httpsAgent = new https.Agent({
  keepAlive: true,
  timeout: 10000,
});

export async function pingHttpHost(host, port = 443, timeoutMs = 5000) {
  const start = Date.now();
  return new Promise((resolve) => {
    const req = https.request(
      {
        host,
        port,
        method: "HEAD",
        timeout: timeoutMs,
        agent: httpsAgent,
      },
      (res) => {
        const ms = Date.now() - start;
        res.resume();
        resolve({ host, status: res.statusCode, ms, ok: true });
      }
    );

    req.on("timeout", () => {
      req.destroy();
      resolve({ host, status: null, ms: Date.now() - start, ok: false, error: "ETIMEDOUT" });
    });

    req.on("error", (err) => {
      resolve({ host, status: null, ms: Date.now() - start, ok: false, error: err?.code || err?.message });
    });

    req.end();
  });
}

export async function checkDnsLatency(domain = "web.whatsapp.com") {
  const start = Date.now();
  try {
    const records = await dns.resolve4(domain);
    const ms = Date.now() - start;
    return { domain, ms, records, ok: true };
  } catch (err) {
    return { domain, ms: Date.now() - start, records: [], ok: false, error: err?.code || err?.message };
  }
}

export async function checkNetworkHealth() {
  const [dnsResult, ...httpResults] = await Promise.all([
    checkDnsLatency("web.whatsapp.com"),
    ...TARGETS.map((t) => pingHttpHost(t.host, t.port)),
  ]);

  const allOk = dnsResult.ok && httpResults.some((r) => r.ok);
  const avgHttpLatency =
    httpResults.filter((r) => r.ok).reduce((acc, cur) => acc + cur.ms, 0) /
    Math.max(1, httpResults.filter((r) => r.ok).length) || 0;

  return {
    status: allOk ? "online" : "degraded",
    dns: dnsResult,
    targets: httpResults,
    avgLatencyMs: Math.round(avgHttpLatency),
    checkedAt: new Date().toISOString(),
  };
}
