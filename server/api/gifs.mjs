import { pool } from '../db.mjs';
import { formatSize } from '../lib/format.mjs';
import { escapeIlike } from '../lib/search.mjs';
import { json } from '../server.mjs';

function baseUrl(ctx) {
  const host = ctx.req.headers.host || 'gif.sccl.cc';
  return 'https://' + host;
}

function gifUrl(r) {
  if (r.slug) return '/api/gif/' + r.slug + '.' + (r.file_path || '').split('.').pop();
  const fname = (r.file_path || '').split('/').pop() || r.id + '.gif';
  return '/api/gif/' + fname;
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
          `SELECT id, file_path, created_at, size, tags, slug FROM gifs WHERE delete_token IN (${ph}) ORDER BY created_at DESC`,
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
    const search = (url.searchParams.get('q') || '').trim();
    const like = search ? '%' + escapeIlike(search) + '%' : null;

    if (showAll && admin) {
      const { rows } = await pool.query(
        like
          ? `SELECT id, file_path, created_at, size, public, discord_id, tags, slug FROM gifs
             WHERE (tags ILIKE $3 OR COALESCE(slug, '') ILIKE $3)
             ORDER BY created_at DESC LIMIT $1 OFFSET $2`
          : 'SELECT id, file_path, created_at, size, public, discord_id, tags, slug FROM gifs ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        like ? [limit, offset, like] : [limit, offset],
      );
      const { rows: countRows } = await pool.query(
        like
          ? `SELECT COUNT(*) AS count FROM gifs WHERE (tags ILIKE $1 OR COALESCE(slug, '') ILIKE $1)`
          : 'SELECT COUNT(*) AS count FROM gifs',
        like ? [like] : [],
      );
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
      like
        ? `SELECT id, file_path, created_at, size, tags, slug FROM gifs
           WHERE public = 1 AND (tags ILIKE $3 OR COALESCE(slug, '') ILIKE $3)
           ORDER BY created_at DESC LIMIT $1 OFFSET $2`
        : 'SELECT id, file_path, created_at, size, tags, slug FROM gifs WHERE public = 1 ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      like ? [limit, offset, like] : [limit, offset],
    );
    const { rows: countRows } = await pool.query(
      like
        ? `SELECT COUNT(*) AS count FROM gifs WHERE public = 1 AND (tags ILIKE $1 OR COALESCE(slug, '') ILIKE $1)`
        : 'SELECT COUNT(*) AS count FROM gifs WHERE public = 1',
      like ? [like] : [],
    );
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
