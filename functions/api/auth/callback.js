export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  if (!code) {
    return new Response(null, { status: 302, headers: { Location: '/' } });
  }

  const clientId = env.DISCORD_CLIENT_ID;
  const clientSecret = env.DISCORD_CLIENT_SECRET;
  const redirectUri = env.DISCORD_REDIRECT_URI || 'https://gif.sccl.cc/api/auth/callback';

  if (!clientId || !clientSecret) {
    return htmlPage('Discord secrets not configured', '/');
  }

  try {
    const tokenResp = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResp.ok) {
      return htmlPage('Discord token exchange failed', '/');
    }

    const tokenData = await tokenResp.json();
    const accessToken = tokenData.access_token;

    const userResp = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: 'Bearer ' + accessToken },
    });

    if (!userResp.ok) {
      return htmlPage('Discord user fetch failed', '/');
    }

    const userData = await userResp.json();

    if (!env.SESSIONS) {
      return htmlPage('KV not configured', '/');
    }

    const adminSet = await env.SESSIONS.get('admin:configured');
    const isAdmin = !adminSet;

    if (isAdmin) {
      await env.SESSIONS.put('admin:configured', '1');
      await env.SESSIONS.put('admin:user:' + userData.id, '1');
    }

    const sessId = crypto.randomUUID();
    const session = {
      discord_id: userData.id,
      username: userData.global_name || userData.username,
      avatar: userData.avatar,
      created_at: new Date().toISOString(),
    };

    await env.SESSIONS.put('sess:' + sessId, JSON.stringify(session), { expirationTtl: 86400 });

    return new Response(null, {
      status: 302,
      headers: {
        Location: '/',
        'Set-Cookie': 'gif_session=' + sessId + '; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400',
      },
    });
  } catch (err) {
    return htmlPage('Auth error: ' + err.message, '/');
  }
}

function htmlPage(msg, redirect) {
  return new Response(
    '<html><body><p>' + msg + '</p><script>setTimeout(function(){location.href="' + redirect + '"},2000)</script></body></html>',
    { status: 200, headers: { 'Content-Type': 'text/html' } }
  );
}
