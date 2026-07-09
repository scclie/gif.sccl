export async function onRequestPost(context) {
  const { request, env } = context;
  const user = context.data.user;

  try {
    if (!env.SESSIONS || !env.GIF_DB) {
      return json({ error: 'server not configured: missing bindings' }, 500);
    }

    const formData = await request.formData();
    const gifFile = formData.get('gif');
    const isPublic = formData.get('public') === 'true';

    if (!gifFile || !(gifFile instanceof File)) {
      return json({ error: 'no gif file provided' }, 400);
    }

    if (gifFile.size > 20 * 1024 * 1024) {
      return json({ error: 'file too large (max 20MB)' }, 400);
    }

    const rateLimitKey = user ? 'rate:user:' + user.discord_id : 'rate:ip:' + (request.headers.get('CF-Connecting-IP') || 'unknown');
    const isAnon = !user;
    const maxLimit = isAnon ? (parseInt(env.ANON_RATE_LIMIT) || 10) : (parseInt(env.USER_RATE_LIMIT) || 100);
    const windowMs = isAnon ? 86400000 : 3600000;

    const rateData = await env.SESSIONS.get(rateLimitKey);
    const now = Date.now();
    let rate = rateData ? JSON.parse(rateData) : { count: 0, resetAt: now + windowMs };

    if (now > rate.resetAt) {
      rate = { count: 0, resetAt: now + windowMs };
    }

    if (rate.count >= maxLimit) {
      const retryAfter = Math.ceil((rate.resetAt - now) / 1000);
      const label = isAnon ? 'daily' : 'hourly';
      return json({ error: 'rate limit exceeded (' + maxLimit + '/' + label + '). try again in ' + retryAfter + 's' }, 429);
    }

    const id = crypto.randomUUID();
    const fileBuf = await gifFile.arrayBuffer();

    const boundary = '----FormBoundary' + id.replace(/-/g, '');
    const encoder = new TextEncoder();
    let header = '--' + boundary + '\r\n'
      + 'Content-Disposition: form-data; name="reqtype"\r\n\r\n'
      + 'fileupload\r\n';
    if (env.CATBOX_USERHASH) {
      header += '--' + boundary + '\r\n'
        + 'Content-Disposition: form-data; name="userhash"\r\n\r\n'
        + env.CATBOX_USERHASH + '\r\n';
    }
    header += '--' + boundary + '\r\n'
      + 'Content-Disposition: form-data; name="fileToUpload"; filename="' + id + '.gif"\r\n'
      + 'Content-Type: application/octet-stream\r\n\r\n';
    const footer = '\r\n--' + boundary + '--\r\n';
    const headBuf = encoder.encode(header);
    const footBuf = encoder.encode(footer);
    const body = new Uint8Array(headBuf.length + fileBuf.byteLength + footBuf.length);
    body.set(headBuf, 0);
    body.set(new Uint8Array(fileBuf), headBuf.length);
    body.set(footBuf, headBuf.length + fileBuf.byteLength);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    const catboxResp = await fetch('https://catbox.moe/user/api.php', {
      method: 'POST',
      body: body,
      signal: controller.signal,
      headers: {
        'Content-Type': 'multipart/form-data; boundary=' + boundary,
        'User-Agent': 'gif.sccl.cc/1.0',
      },
    });
    clearTimeout(timeout);

    if (!catboxResp.ok) {
      const txt = await catboxResp.text();
      const msg = txt.trim().slice(0, 200);
      if (msg === 'Invalid uploader' && !env.CATBOX_USERHASH) {
        return json({ error: 'upload failed: catbox blocks anonymous uploads. Set CATBOX_USERHASH secret with your catbox account hash.' }, 500);
      }
      if (msg === 'Not signed in!' && env.CATBOX_USERHASH) {
        return json({ error: 'upload failed: invalid CATBOX_USERHASH. Double-check the hash in your catbox profile.' }, 500);
      }
      return json({ error: 'upload failed (HTTP ' + catboxResp.status + '): ' + msg }, 500);
    }

    const fileUrl = (await catboxResp.text()).trim();

    if (!fileUrl || !fileUrl.startsWith('http')) {
      return json({ error: 'upload failed: unexpected response from storage' }, 500);
    }

    const deleteToken = crypto.randomUUID();
    const ipHash = await hashIP(request.headers.get('CF-Connecting-IP') || 'unknown');

    await env.GIF_DB.prepare(
      'INSERT INTO gifs (id, discord_id, ip_hash, public, created_at, size, delete_token, discord_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      id,
      user ? user.discord_id : null,
      ipHash,
      isPublic ? 1 : 0,
      new Date().toISOString(),
      gifFile.size,
      deleteToken,
      fileUrl
    ).run();

    rate.count++;
    await env.SESSIONS.put(rateLimitKey, JSON.stringify(rate), { expirationTtl: Math.ceil((rate.resetAt - now) / 1000) });

    const requestUrl = new URL(request.url);
    const baseUrl = requestUrl.protocol + '//' + requestUrl.host;
    const gifUrl = baseUrl + '/api/gif/' + id + '.gif';

    return json({
      id: id,
      url: gifUrl,
      delete_token: deleteToken,
      size: gifFile.size,
      public: isPublic,
    });
  } catch (err) {
    const msg = err.name === 'AbortError' ? 'upload to storage timed out' : err.message;
    return json({ error: 'upload failed: ' + msg }, 500);
  }
}

async function hashIP(ip) {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip + 'gifscclcc-salt');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
