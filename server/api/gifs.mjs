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

function rowToGif(base, r, extra = {}) {
  return {
    id: r.id,
    url: base + gifUrl(r),
    direct_url: base + gifUrl(r),
    created_at: r.created_at,
    size: formatSize(r.size),
    tags: r.tags ? JSON.parse(r.tags) : [],
    ...extra,
  };
}

export async function apiGifs(ctx) {
  const { url, admin, res, user } = ctx;
  const base = baseUrl(ctx);

  // account-owned gifs (discord or kanidm), independent of delete tokens
  if (url.searchParams.get('mine') === 'true' && user) {
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit')) || 6));
    const offset = Math.max(0, parseInt(url.searchParams.get('offset')) || 0);
    const q = (url.searchParams.get('q') || '').trim();
    const like = q ? '%' + escapeIlike(q) + '%' : null;
    const provider = user.provider;
    const subject = user.subject || user.discord_id;
    try {
      const where = like
        ? 'owner_provider = $1 AND owner_subject = $2 AND (tags ILIKE $3 OR COALESCE(slug, \'\') ILIKE $3)'
        : 'owner_provider = $1 AND owner_subject = $2';
      const whereParams = like ? [provider, subject, like] : [provider, subject];
      const { rows } = await pool.query(
        `SELECT id, file_path, created_at, size, public, discord_id, tags, slug, delete_token FROM gifs WHERE ${where} ORDER BY created_at DESC LIMIT $${whereParams.length + 1} OFFSET $${whereParams.length + 2}`,
        [...whereParams, limit, offset],
      );
      const { rows: countRows } = await pool.query(
        `SELECT COUNT(*) AS count FROM gifs WHERE ${where}`,
        whereParams,
      );
      const gifs = rows.map((r) =>
        rowToGif(base, r, { public: !!r.public, delete_token: r.delete_token }),
      );
      return json(res, { gifs, mine: true, total: Number(countRows[0].count), limit, offset }, 200, {
        'Cache-Control': 'private, no-cache',
      });
    } catch {
      return json(res, { gifs: [], mine: true, total: 0 }, 200, { 'Cache-Control': 'private, no-cache' });
    }
  }

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
        return json(res, { gifs: rows.map((r) => rowToGif(base, r)) }, 200, {
          'Cache-Control': 'private, no-cache',
        });
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
    // owned gifs live in their own section, so keep them out of the public
    // pagination entirely (otherwise they'd silently eat a page slot)
    const excludeMine = url.searchParams.get('exclude_mine') === 'true' && !!user;

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
          : `SELECT COUNT(*) AS count FROM gifs`,
        like ? [like] : [],
      );
      const gifs = rows.map((r) => rowToGif(base, r, { public: !!r.public, discord_id: r.discord_id }));
      return json(res, { gifs, total: Number(countRows[0].count), page, limit, admin: true }, 200, {
        'Cache-Control': 'private, no-cache',
      });
    }

    const conds = ['public = 1'];
    const params = [];
    if (like) {
      params.push(like);
      conds.push(`(tags ILIKE $${params.length} OR COALESCE(slug, '') ILIKE $${params.length})`);
    }
    if (excludeMine) {
      params.push(user.provider);
      const p1 = params.length;
      params.push(user.subject || user.discord_id);
      const p2 = params.length;
      // IS DISTINCT FROM so rows with NULL owner (anon uploads) are kept
      conds.push(`(owner_provider IS DISTINCT FROM $${p1} OR owner_subject IS DISTINCT FROM $${p2})`);
    }
    // anonymous users exclude their own (delete-token) gifs from the public list
    const excludeTokensParam = url.searchParams.get('exclude_tokens');
    const excludeTokens = excludeTokensParam ? excludeTokensParam.split(',').filter(Boolean) : [];
    if (excludeTokens.length) {
      params.push(excludeTokens);
      conds.push(`NOT (delete_token = ANY($${params.length}))`);
    }
    const where = conds.join(' AND ');
    params.push(limit);
    const lim = params.length;
    params.push(offset);
    const off = params.length;

    const { rows } = await pool.query(
      `SELECT id, file_path, created_at, size, tags, slug FROM gifs WHERE ${where} ORDER BY created_at DESC LIMIT $${lim} OFFSET $${off}`,
      params,
    );
    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) AS count FROM gifs WHERE ${where}`,
      params.slice(0, params.length - 2),
    );
    return json(
      res,
      { gifs: rows.map((r) => rowToGif(base, r)), total: Number(countRows[0].count), page, limit, admin: !!admin },
      200,
      { 'Cache-Control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=60' },
    );
  } catch (err) {
    return json(res, { error: err.message }, 500);
  }
}
