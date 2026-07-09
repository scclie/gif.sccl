export async function onRequestPost(context) {
  const { request, env } = context;
  const user = context.data.user;
  const admin = context.data.admin;

  try {
    const body = await request.json();
    const id = body.id;
    const deleteToken = body.delete_token;

    if (!id) {
      return json({ error: 'id is required' }, 400);
    }

    if (!admin && !deleteToken) {
      return json({ error: 'delete_token required' }, 400);
    }

    const row = await env.GIF_DB.prepare(
      'SELECT delete_token FROM gifs WHERE id = ?'
    ).bind(id).first();

    if (!row) {
      return json({ error: 'gif not found' }, 404);
    }

    if (!admin && row.delete_token !== deleteToken) {
      return json({ error: 'invalid delete token' }, 403);
    }

    await env.GIF_DB.prepare('DELETE FROM gifs WHERE id = ?').bind(id).run();

    return json({ success: true });
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
