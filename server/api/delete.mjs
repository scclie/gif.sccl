import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { pool } from '../db.mjs';
import { json } from '../server.mjs';
import { inc } from '../metrics.mjs';

export async function apiDelete(ctx) {
  const { req, res, user: _user, admin, env } = ctx;
  try {
    const body = await readJson(req);
    const id = body.id;
    const deleteToken = body.delete_token;
    if (!id) return json(res, { error: 'id is required' }, 400);
    if (!admin && !deleteToken) return json(res, { error: 'delete_token required' }, 400);

    const { rows } = await pool.query('SELECT delete_token, file_path FROM gifs WHERE id = $1', [id]);
    if (!rows.length) return json(res, { error: 'gif not found' }, 404);
    if (!admin && rows[0].delete_token !== deleteToken) return json(res, { error: 'invalid delete token' }, 403);

    await pool.query('DELETE FROM gifs WHERE id = $1', [id]);
    await unlink(path.join(env.DATA_DIR || '/var/gifs', rows[0].file_path)).catch(() => {});
    inc('gif_delete_total');
    return json(res, { success: true });
  } catch (err) {
    inc('gif_errors_total', { type: 'internal' });
    return json(res, { error: err.message }, 500);
  }
}

export async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > 1048576) throw new Error('request body too large');
    chunks.push(c);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}
