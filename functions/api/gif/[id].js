export async function onRequestGet(context) {
  const { env, params } = context;
  const id = params.id.replace(/\.gif$/i, '');

  if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
    return new Response('invalid id', { status: 400 });
  }

  try {
    const row = await env.GIF_DB.prepare(
      'SELECT discord_url FROM gifs WHERE id = ?'
    ).bind(id).first();

    if (!row) {
      return new Response('gif not found', { status: 404 });
    }

    return new Response(null, {
      status: 302,
      headers: {
        Location: row.discord_url,
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    return new Response('not found', { status: 404 });
  }
}
