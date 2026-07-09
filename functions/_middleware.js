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

  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/gif_session=([^;]+)/);
  let user = null;
  let admin = false;

  if (match && env.SESSIONS) {
    try {
      const sess = await env.SESSIONS.get('sess:' + match[1]);
      if (sess) {
        user = JSON.parse(sess);
        context.waitUntil(env.SESSIONS.put('sess:' + match[1], sess, { expirationTtl: 86400 }));
        const adminFlag = await env.SESSIONS.get('admin:user:' + user.discord_id);
        admin = !!adminFlag;
      }
    } catch (_) {}
  }

  context.data.user = user;
  context.data.admin = admin;

  return next();
}

export { onRequest };
