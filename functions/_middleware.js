async function onRequest(context) {
  const { request, env, next } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Delete-Token, X-Admin',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // Rate limiter — only API endpoints
  if (request.url.includes('/api/') && env.GIF_DB) {
    try {
      await env.GIF_DB.prepare('CREATE TABLE IF NOT EXISTS rate_limits (ip TEXT NOT NULL, ts INTEGER NOT NULL)').run();
      await env.GIF_DB.prepare('CREATE INDEX IF NOT EXISTS idx_rate_limits_ip_ts ON rate_limits(ip, ts)').run().catch(() => {});
    } catch (_) {}
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const now = Date.now();
    try {
      await env.GIF_DB.prepare('DELETE FROM rate_limits WHERE ts < ?').bind(now - 300000).run();
      const { count } = await env.GIF_DB.prepare('SELECT COUNT(*) as count FROM rate_limits WHERE ip = ? AND ts > ?').bind(ip, now - 60000).first();
      if (count >= 60) {
        return new Response('Too Many Requests', { status: 429, headers: { 'Retry-After': '60', 'Content-Type': 'text/plain' } });
      }
      await env.GIF_DB.prepare('INSERT INTO rate_limits (ip, ts) VALUES (?, ?)').bind(ip, now).run();
    } catch (_) {}
  }

  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/gif_session=([^;]+)/);
  let user = null;
  let admin = false;

  if (match && env.SESSIONS) {
    try {
      const sess = await env.SESSIONS.get('sess:' + match[1]);
      if (sess) {
        user = JSON.parse(sess);
        const age = Date.now() - new Date(user.created_at).getTime();
        if (age > 6 * 3600 * 1000) {
          user.created_at = new Date().toISOString();
          const adminFlag = await env.SESSIONS.get('admin:user:' + user.discord_id);
          user.admin = !!adminFlag;
          context.waitUntil(env.SESSIONS.put('sess:' + match[1], JSON.stringify(user), { expirationTtl: 604800 }));
        }
        admin = !!user.admin;
      }
    } catch (_) {}
  }

  context.data.user = user;
  context.data.admin = admin;

  return next();
}

export { onRequest };
