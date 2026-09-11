import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { pool } from '../db.mjs';
import { respond } from '../server.mjs';

export async function apiGifItem(ctx) {
  const { url, res, env } = ctx;
  const m = url.pathname.match(/^\/api\/gif\/([0-9A-Za-z-]{8,36})\.gif$/);
  if (!m) return respond(res, 400, 'invalid id', { 'Content-Type': 'text/plain' });
  const id = m[1];

  try {
    const { rows, rowCount } = await pool.query('SELECT file_path FROM gifs WHERE id = $1', [id]);
    if (!rowCount) return respond(res, 404, 'gif not found', { 'Content-Type': 'text/plain' });

    const rel = rows[0].file_path;
    const filePath = path.resolve(env.DATA_DIR || '/var/gifs', rel);
    await stat(filePath);

    const headers = {
      'Content-Type': 'image/gif',
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': '*',
    };
    res.writeHead(200, headers);
    createReadStream(filePath).pipe(res);
  } catch (err) {
    if (!res.headersSent) respond(res, 404, 'not found', { 'Content-Type': 'text/plain' });
    else res.end();
  }
}
