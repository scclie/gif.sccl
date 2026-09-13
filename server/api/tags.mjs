import { pool } from '../db.mjs';
import { suggestTags } from '../lib/search.mjs';
import { json } from '../server.mjs';

const CACHE_TTL = 5000;
const cache = new Map();

export async function apiTags(ctx) {
  const { url, admin, res } = ctx;
  const q = (url.searchParams.get('q') || '').trim();
  if (!q) return json(res, { tags: [] }, 200, { 'Cache-Control': 'private, no-cache' });

  const all = url.searchParams.get('all') === 'true' && admin;
  const key = (all ? 'a:' : 'p:') + q;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL) {
    return json(res, { tags: hit.tags }, 200, { 'Cache-Control': 'private, no-cache' });
  }

  try {
    const { rows } = await pool.query(
      all ? 'SELECT tags FROM gifs' : 'SELECT tags FROM gifs WHERE public = 1',
    );
    const allTags = [];
    for (const r of rows) {
      if (!r.tags) continue;
      try {
        const parsed = JSON.parse(r.tags);
        if (Array.isArray(parsed)) for (const t of parsed) allTags.push(t);
      } catch {}
    }
    const tags = suggestTags(allTags, q, 10);
    cache.set(key, { ts: Date.now(), tags });
    return json(res, { tags }, 200, { 'Cache-Control': 'private, no-cache' });
  } catch (err) {
    return json(res, { error: err.message }, 500);
  }
}
