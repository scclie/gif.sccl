export async function onRequestGet(context) {
  const { env } = context;
  const clientId = env.DISCORD_CLIENT_ID;
  if (!clientId) {
    return new Response('Discord OAuth not configured', { status: 500 });
  }
  const redirectUri = env.DISCORD_REDIRECT_URI || 'https://gif.sccl.cc/api/auth/callback';
  const url = 'https://discord.com/api/oauth2/authorize'
    + '?client_id=' + clientId
    + '&redirect_uri=' + encodeURIComponent(redirectUri)
    + '&response_type=code'
    + '&scope=identify';
  return Response.redirect(url, 302);
}
