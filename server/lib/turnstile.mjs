export async function verifyTurnstile(secret, token, remoteIp) {
  if (!secret || !token) return false;
  try {
    const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token, remoteip: remoteIp || '' }),
    });
    if (!resp.ok) return false;
    const data = await resp.json();
    return !!data.success;
  } catch {
    return false;
  }
}