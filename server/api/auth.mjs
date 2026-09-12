import { randomUUID } from 'node:crypto';
import { pool } from '../db.mjs';
import { parseCookies } from '../lib/session.mjs';
import { json, respond, redirect, htmlPage } from '../server.mjs';
import { inc } from '../metrics.mjs';

function envFor(env) {
  return {
    clientId: env.DISCORD_CLIENT_ID,
    clientSecret: env.DISCORD_CLIENT_SECRET,
    redirectUri: env.DISCORD_REDIRECT_URI || 'https://gif.sccl.cc/api/auth/callback',
  };
}

export const apiAuth = {
  async discord(ctx) {
    const { clientId } = envFor(ctx.env);
    if (!clientId) return respond(ctx.res, 500, 'Discord OAuth not configured', { 'Content-Type': 'text/plain' });
    const url =
      'https://discord.com/api/oauth2/authorize' +
      '?client_id=' + clientId +
      '&redirect_uri=' + encodeURIComponent(envFor(ctx.env).redirectUri) +
      '&response_type=code&scope=identify';
    redirect(ctx.res, url);
  },

  async callback(ctx) {
    const { req, res, env } = ctx;
    const code = ctx.url.searchParams.get('code');
    if (!code) return redirect(res, '/');
    const { clientId, clientSecret, redirectUri } = envFor(env);
    if (!clientId || !clientSecret) return htmlPage(res, 'Discord secrets not configured');

    try {
      const tokenResp = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'authorization_code', code, redirect_uri: redirectUri }),
      });
      if (!tokenResp.ok) return htmlPage(res, 'Discord token exchange failed');
      const tokenData = await tokenResp.json();

      const userResp = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: 'Bearer ' + tokenData.access_token },
      });
      if (!userResp.ok) return htmlPage(res, 'Discord user fetch failed');
      const userData = await userResp.json();

      const { rows: firstAdmin } = await pool.query('SELECT 1 FROM admins LIMIT 1');
      const isFirstLogin = firstAdmin.length === 0;
      if (isFirstLogin) {
        await pool.query('INSERT INTO admins (discord_id, created_at) VALUES ($1, $2)', [userData.id, new Date().toISOString()]);
      }
      const { rows: memberRows } = await pool.query('SELECT 1 FROM admins WHERE discord_id = $1', [userData.id]);
      const sessId = randomUUID();
      const session = {
        discord_id: userData.id,
        username: userData.global_name || userData.username,
        avatar: userData.avatar,
        admin: isFirstLogin || memberRows.length > 0,
        created_at: new Date().toISOString(),
      };

      await pool.query('INSERT INTO sessions (id, payload, expires_at) VALUES ($1, $2, $3)', [
        sessId,
        JSON.stringify(session),
        Date.now() + 604800000,
      ]);

      respond(res, 302, '', {
        Location: '/',
        'Set-Cookie': 'gif_session=' + sessId + '; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800',
      });
    } catch (err) {
      inc('gif_errors_total', { type: 'auth' });
      return htmlPage(res, 'Auth error: ' + err.message);
    }
  },

  async logout(ctx) {
    const { req, res } = ctx;
    const cookies = parseCookies(req);
    if (cookies.gif_session) {
      await pool.query('DELETE FROM sessions WHERE id = $1', [cookies.gif_session]).catch(() => {});
    }
    respond(res, 200, JSON.stringify({ ok: true }), {
      'Content-Type': 'application/json',
      'Set-Cookie': 'gif_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0',
    });
  },

  async me(ctx) {
    const { res, user, admin } = ctx;
    if (user) return json(res, { user, admin: !!admin });
    return json(res, { user: null, admin: false });
  },
};
