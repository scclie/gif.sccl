export async function onRequestGet(context) {
  const user = context.data.user;
  const admin = context.data.admin;
  if (user) {
    return new Response(JSON.stringify({ user: user, admin: !!admin }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return new Response(JSON.stringify({ user: null, admin: false }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
