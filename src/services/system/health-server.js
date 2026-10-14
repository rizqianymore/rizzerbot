import http from "http";
import os from "os";
import { commands } from "@/src/core/loader.js";
import { isTermux } from "@/src/utils/termux.js";

function snapshot() {
  const mem = process.memoryUsage();
  return {
    status: "ok",
    uptimeSec: Math.floor(process.uptime()),
    node: process.version,
    platform: `${os.platform()} ${os.arch()}`,
    termux: isTermux(),
    plugins: commands.size,
    memoryMB: {
      rss: +(mem.rss / 1048576).toFixed(1),
      heapUsed: +(mem.heapUsed / 1048576).toFixed(1),
    },
  };
}

export function startHealthServer(logger) {
  const port = Number(process.env.HEALTH_PORT) || 0;
  if (!port) return null;
  const host = process.env.HEALTH_HOST || "127.0.0.1";
  const server = http.createServer((req, res) => {
    try {
      if (req.url !== "/health") {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "not-found" }));
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(snapshot()));
    } catch (_) {
      try {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "error" }));
      } catch (_) {}
    }
  });
  server.on("error", (err) => {
    logger?.warn?.(`[health] gagal listen ${host}:${port}: ${err?.message || err}`);
  });
  server.listen(port, host, () => {
    logger?.info?.(`[health] endpoint aktif di http://${host}:${port}/health`);
  });
  return server;
}
