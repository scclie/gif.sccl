import { pool } from '../db.mjs';
import { parseTags } from '../lib/format.mjs';
import { json } from '../server.mjs';
import { readJson } from './delete.mjs';

export async function apiGifEdit(ctx) {
  const { req, res, admin } = ctx;
  try {
    const body = await readJson(req);
    const id = body.id;
    if (!id) return json(res, { error: 'id is required' }, 400);
    const tags = JSON.stringify(parseTags(body.tags));

    const { rows } = await pool.query('SELECT delete_token FROM gifs WHERE id = $1', [id]);
    if (!rows.length) return json(res, { error: 'gif not found' }, 404);
    if (!admin && rows[0].delete_token !== body.delete_token) return json(res, { error: 'not authorized' }, 403);

    await pool.query('UPDATE gifs SET tags = $1 WHERE id = $2', [tags, id]);
    return json(res, { success: true, tags: JSON.parse(tags) });
  } catch (err) {
    return json(res, { error: err.message }, 500);
  }
}
