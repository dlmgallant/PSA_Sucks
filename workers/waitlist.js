// Cloudflare Worker: Pro waitlist email capture.
// Setup: create a KV namespace, bind it as WAITLIST, deploy, then put
// the worker URL into WAITLIST_ENDPOINT in src/config.js.
export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors });
    try {
      const { email } = await request.json();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return Response.json({ ok: false, error: 'Invalid email' }, { status: 400, headers: cors });
      }
      await env.WAITLIST.put(email.toLowerCase().trim(), JSON.stringify({ ts: Date.now(), ua: request.headers.get('user-agent') || '' }));
      return Response.json({ ok: true }, { headers: cors });
    } catch {
      return Response.json({ ok: false, error: 'Bad request' }, { status: 400, headers: cors });
    }
  },
};
