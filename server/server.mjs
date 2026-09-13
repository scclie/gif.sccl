import http from "node:http";
import { pool, migrate } from "./db.mjs";
import { clientIp } from "./lib/net.mjs";
import { parseCookies } from "./lib/session.mjs";
import { apiConfig } from "./api/config.mjs";
import { apiHealth } from "./api/health.mjs";
import { apiGifs } from "./api/gifs.mjs";
import { apiTags } from "./api/tags.mjs";
import { apiGifItem } from "./api/gifItem.mjs";
import { apiUpload } from "./api/upload.mjs";
import { apiDelete } from "./api/delete.mjs";
import { apiGifEdit } from "./api/gifEdit.mjs";
import { apiAuth } from "./api/auth.mjs";
import { inc, metricsHandler } from "./metrics.mjs";

export function respond(res, status, body, headers = {}) {
  res.writeHead(status, { ...headers });
  res.end(body);
}

export function json(res, data, status = 200, headers = {}) {
  respond(res, status, JSON.stringify(data), {
    "Content-Type": "application/json",
    ...headers,
  });
}

export function redirect(res, location, status = 302) {
  respond(res, status, "", { Location: location });
}

export function htmlPage(res, msg, to = "/") {
  respond(
    res,
    200,
    `<html><body><p>${msg}</p><script>setTimeout(function(){location.href="${to}"},2000)</script></body></html>`,
    { "Content-Type": "text/html" },
  );
}

const routes = [
  ["GET", "/api/config", apiConfig],
  ["GET", "/api/health", apiHealth],
  ["GET", "/metrics", metricsHandler],
  ["GET", "/api/gifs", apiGifs],
  ["GET", "/api/tags", apiTags],
  ["POST", "/api/gif/edit", apiGifEdit],
  ["POST", "/api/delete", apiDelete],
  ["POST", "/api/upload", apiUpload],
  ["GET", /^\/api\/gif\/([^/.]+)\.(?:gif|webp)(?:\.gif)?$/, apiGifItem],
  ["GET", "/api/auth/discord", apiAuth.discord],
  ["GET", "/api/auth/callback", apiAuth.callback],
  ["POST", "/api/auth/logout", apiAuth.logout],
  ["GET", "/api/auth/me", apiAuth.me],
];

export function clientIpForReq(req) {
  return clientIp(req);
}

async function sessionMiddleware(req) {
  const cookies = parseCookies(req);
  req.user = null;
  req.admin = false;
  const sessId = cookies.gif_session;
  if (!sessId) return;
  try {
    const { rows } = await pool.query(
      "SELECT payload FROM sessions WHERE id = $1 AND expires_at > $2",
      [sessId, Date.now()],
    );
    if (!rows.length) return;
    const session = JSON.parse(rows[0].payload);
    if (!session.discord_id) return;
    req.user = session;
    req.admin = !!session.admin;
  } catch {}
}

async function rateLimitMiddleware(req) {
  const ip = clientIp(req);
  const now = Date.now();
  await pool
    .query("DELETE FROM rate_limits WHERE ts < $1", [now - 300000])
    .catch(() => {});
  let rows = null;
  try {
    const { rows: r } = await pool.query(
      "SELECT COUNT(*) AS count FROM rate_limits WHERE ip = $1 AND ts > $2",
      [ip, now - 60000],
    );
    rows = r;
  } catch {
    return null;
  }
  if (rows[0].count >= 60) {
    return {
      status: 429,
      body: "Too Many Requests",
      headers: { "Retry-After": "60", "Content-Type": "text/plain" },
    };
  }
  await pool
    .query("INSERT INTO rate_limits (ip, ts) VALUES ($1, $2)", [ip, now])
    .catch(() => {});
  return null;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");

  if (req.method === "OPTIONS") {
    respond(res, 204, "", {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Delete-Token, X-Admin",
      "Access-Control-Max-Age": "86400",
    });
    return;
  }

  req.env = process.env;

  // Session loads first so handlers see req.user/req.admin
  await sessionMiddleware(req);

  let matched = null;
  for (const [method, rule, handler] of routes) {
    if (method !== req.method) continue;
    if (
      typeof rule === "string" ? rule === url.pathname : rule.test(url.pathname)
    ) {
      matched = { handler, params: url };
      break;
    }
  }

  if (!matched) {
    respond(res, 404, "not found", { "Content-Type": "text/plain" });
    return;
  }

  const isStaticGif = /^\/api\/gif\/[^/.]+\.(?:gif|webp)$/.test(url.pathname);
  if (url.pathname !== "/api/health" && url.pathname !== "/metrics" && url.pathname !== "/api/tags" && !isStaticGif) {
    const limited = await rateLimitMiddleware(req);
    if (limited) {
      respond(res, limited.status, limited.body, limited.headers);
      return;
    }
  }

  const ctx = { req, res, url, env: req.env, user: req.user, admin: req.admin };
  try {
    await matched.handler(ctx);
    const isApi = url.pathname.startsWith("/api/") && url.pathname !== "/metrics";
    const isGifFetch = /^\/api\/gif\/.+\.(?:gif|webp)$/.test(url.pathname);
    if (isApi) {
      const route = isGifFetch ? "/api/gif/:file" : url.pathname;
      inc("gif_http_requests_total", { route, method: req.method, status: String(res.statusCode || 500) });
    }
  } catch (err) {
    console.error("[gifs]", err);
    if (!res.headersSent) json(res, { error: "internal: " + err.message }, 500);
  }
});

const port = parseInt(process.env.PORT || "8080", 10);
await migrate();
server.listen(port, "0.0.0.0", () => {
  console.log("gif.sccl.cc server listening on :" + port);
});
