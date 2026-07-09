export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit')) || 24));
  const offset = (page - 1) * limit;
  const showAll = url.searchParams.get('all') === 'true';
  const admin = context.data.admin;

  try {
    const requestUrl = new URL(request.url);
    const baseUrl = requestUrl.protocol + '//' + requestUrl.host;

    // Admin can see all GIFs with ?all=true
    let query, countQuery, params;

    if (showAll && admin) {
      query = 'SELECT id, created_at, size, public, discord_id, tags FROM gifs ORDER BY created_at DESC LIMIT ? OFFSET ?';
      countQuery = 'SELECT COUNT(*) as count FROM gifs';
      params = [limit, offset];
    } else {
      query = 'SELECT id, created_at, size, tags FROM gifs WHERE public = 1 ORDER BY created_at DESC LIMIT ? OFFSET ?';
      countQuery = 'SELECT COUNT(*) as count FROM gifs WHERE public = 1';
      params = [limit, offset];
    }

    const { results } = await env.GIF_DB.prepare(query).bind(...params).all();

    const gifs = results.map(r => ({
      id: r.id,
      url: baseUrl + '/api/gif/' + r.id + '.gif',
      created_at: r.created_at,
      size: formatSize(r.size),
      tags: JSON.parse(r.tags || '[]'),
      ...(showAll && admin ? { public: !!r.public, discord_id: r.discord_id } : {}),
    }));

    const { count } = await env.GIF_DB.prepare(countQuery).first();

    return new Response(JSON.stringify({
      gifs,
      total: count || 0,
      page,
      limit,
      admin: !!admin,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + 'b';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + 'kb';
  return (bytes / 1048576).toFixed(1) + 'mb';
}
