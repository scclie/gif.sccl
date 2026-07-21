export async function onRequestPost(context) {
  const { request, env } = context;
  const user = context.data.user;
  const admin = context.data.admin;

  try {
    await env.GIF_DB.prepare("ALTER TABLE gifs ADD COLUMN tags TEXT DEFAULT '[]'").run().catch(() => {});
    const body = await request.json();
    const id = body.id;
    const tagsRaw = (body.tags || '').trim();
    const tagsList = tagsRaw ? tagsRaw.split(',').map(t => t.trim().slice(0, 30)).filter(Boolean).slice(0, 10) : [];
    const tags = JSON.stringify(tagsList);
    const deleteToken = body.delete_token;

    if (!id) {
      return json({ error: 'id is required' }, 400);
    }

    const row = await env.GIF_DB.prepare(
      'SELECT delete_token FROM gifs WHERE id = ?'
    ).bind(id).first();

    if (!row) {
      return json({ error: 'gif not found' }, 404);
    }

    if (!admin && row.delete_token !== deleteToken) {
      return json({ error: 'not authorized' }, 403);
    }

    await env.GIF_DB.prepare(
      'UPDATE gifs SET tags = ? WHERE id = ?'
    ).bind(tags, id).run();

    return json({ success: true, tags: JSON.parse(tags) });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
