export async function onRequestPost(context) {
  const { request, env } = context;
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/gif_session=([^;]+)/);

  if (match) {
    try {
      await env.SESSIONS.delete('sess:' + match[1]);
    } catch (_) {}
  }

  const response = new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });

  const clearCookie = 'gif_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0';
  response.headers.set('Set-Cookie', clearCookie);
  return response;
}
