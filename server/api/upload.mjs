import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pool } from '../db.mjs';
import { parseMultipart } from '../multipart.mjs';
import { parseTags, newId, newToken } from '../lib/format.mjs';
import { clientIp } from '../lib/net.mjs';
import { verifyTurnstile } from '../lib/turnstile.mjs';
import { json } from '../server.mjs';

export async function apiUpload(ctx) {
  const { req, res, user, env } = ctx;
  try {
    const { fields, file } = await parseMultipart(req);
    const isPublic = fields.public === 'true';
    const tags = JSON.stringify(parseTags(fields.tags));
    const ext = fields.format === 'webp' ? 'webp' : 'gif';

    if (!file) return json(res, { error: 'no file provided' }, 400);
    if (file.length > 15 * 1024 * 1024) return json(res, { error: 'file too large (max 15MB)' }, 400);

    const ip = clientIp(req);
    const isAnon = !user;

    if (isAnon) {
      const ok = await verifyTurnstile(env.TURNSTILE_SECRET_KEY, fields['cf-turnstile-response'] || '', ip);
      if (!ok) return json(res, { error: 'captcha verification failed' }, 400);
    }

    let rate = null;
    {
      const key = user ? 'user:' + user.discord_id : 'anon:' + ip;
      const maxLimit = user ? parseInt(env.USER_RATE_LIMIT) || 30 : parseInt(env.ANON_RATE_LIMIT) || 5;
      const now = Date.now();
      const { rows } = await pool.query('SELECT count, reset_at FROM upload_rate_limits WHERE key = $1', [key]);
      let next = rows[0] || { count: 0, reset_at: now + 3600000 };
      if (now > next.reset_at) next = { count: 0, reset_at: now + 3600000 };
      if (next.count >= maxLimit) {
        const retryAfter = Math.ceil((next.reset_at - now) / 1000);
        return json(res, { error: 'rate limit exceeded (' + maxLimit + '/hour). try again in ' + retryAfter + 's' }, 429);
      }
      rate = { key, count: next.count, reset_at: next.reset_at };
    }

    const id = newId();
    const dataDir = env.DATA_DIR || '/var/gifs';
    await writeFile(path.join(dataDir, id + '.' + ext), file);

    const deleteToken = newToken();

    await pool.query(
      'INSERT INTO gifs (id, discord_id, public, created_at, size, delete_token, tags, file_path) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [id, user ? user.discord_id : null, isPublic ? 1 : 0, new Date().toISOString(), file.length, deleteToken, tags, id + '.' + ext],
    );

    if (rate) {
      await pool.query(
        'INSERT INTO upload_rate_limits (key, count, reset_at) VALUES ($1,$2,$3) ON CONFLICT(key) DO UPDATE SET count = EXCLUDED.count, reset_at = EXCLUDED.reset_at',
        [rate.key, rate.count + 1, rate.reset_at],
      );
    }

    const base = 'https://' + (req.headers.host || 'gif.sccl.cc');
    const gifUrl =
      base + '/api/gif/' + id + (ext === 'webp' ? '.webp.gif' : '.gif');
    return json(res, {
      id,
      url: gifUrl,
      delete_token: deleteToken,
      size: file.length,
      public: isPublic,
      tags: JSON.parse(tags),
    });
  } catch (err) {
    if (err.code === 'TOO_BIG') return json(res, { error: err.message }, 400);
    return json(res, { error: 'upload failed: ' + err.message }, 500);
  }
}
