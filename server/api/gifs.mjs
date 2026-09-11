import { pool } from '../db.mjs';
import { formatSize } from '../lib/format.mjs';
import { json } from '../server.mjs';

function baseUrl(ctx) {
  const host = ctx.req.headers.host || 'gif.sccl.cc';
  return 'https://' + host;
}

function gifUrl(r) {
  const fname = (r.file_path || '').split('/').pop() || r.id + '.gif';
  const id = fname.replace(/\.(gif|webp)$/, '');
  const isWebp = /\.webp$/i.test(fname);
  return '/api/gif/' + id + (isWebp ? '.webp.gif' : '.gif');
}

export async function apiGifs(ctx) {
  const { url, admin, res } = ctx;
  const base = baseUrl(ctx);

  const tokensParam = url.searchParams.get('tokens');
  if (tokensParam) {
    const tokens = tokensParam.split(',').filter(Boolean);
    if (tokens.length) {
      try {
        const ph = tokens.map((_, i) => '$' + (i + 1)).join(',');
        const { rows } = await pool.query(
          `SELECT id, file_path, created_at, size, tags FROM gifs WHERE delete_token IN (${ph}) ORDER BY created_at DESC`,
          tokens,
        );
        const gifs = rows.map((r) => ({
          id: r.id,
          url: base + gifUrl(r),
          direct_url: base + gifUrl(r),
          created_at: r.created_at,
          size: formatSize(r.size),
          tags: r.tags ? JSON.parse(r.tags) : [],
        }));
        return json(res, { gifs }, 200, { 'Cache-Control': 'private, no-cache' });
      } catch {
        return json(res, { gifs: [] }, 200, { 'Cache-Control': 'private, no-cache' });
      }
    }
  }

  try {
    const page = Math.max(1, parseInt(url.searchParams.get('page')) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit')) || 24));
    const offset = (page - 1) * limit;
    const showAll = url.searchParams.get('all') === 'true';

    if (showAll && admin) {
      const { rows } = await pool.query(
        'SELECT id, file_path, created_at, size, public, discord_id, tags FROM gifs ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        [limit, offset],
      );
      const { rows: countRows } = await pool.query('SELECT COUNT(*) AS count FROM gifs');
      const gifs = rows.map((r) => ({
        id: r.id,
        url: base + gifUrl(r),
        direct_url: base + gifUrl(r),
        created_at: r.created_at,
        size: formatSize(r.size),
        tags: r.tags ? JSON.parse(r.tags) : [],
        public: !!r.public,
        discord_id: r.discord_id,
      }));
      return json(res, { gifs, total: countRows[0].count, page, limit, admin: true }, 200, { 'Cache-Control': 'private, no-cache' });
    }

    const { rows } = await pool.query(
      'SELECT id, file_path, created_at, size, tags FROM gifs WHERE public = 1 ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset],
    );
    const { rows: countRows } = await pool.query('SELECT COUNT(*) AS count FROM gifs WHERE public = 1');
    const gifs = rows.map((r) => ({
      id: r.id,
      url: base + gifUrl(r),
      direct_url: base + gifUrl(r),
      created_at: r.created_at,
      size: formatSize(r.size),
      tags: r.tags ? JSON.parse(r.tags) : [],
    }));
    return json(res, { gifs, total: countRows[0].count, page, limit, admin: !!admin }, 200, {
      'Cache-Control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=60',
    });
  } catch (err) {
    return json(res, { error: err.message }, 500);
  }
}
