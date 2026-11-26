// /api/review: Matt's moderation API. GET lists ratings (?format=csv downloads them all); POST sets a reason's status.
// Cloudflare Access guards /review and /api/review; this file also checks the Access token itself,
// so the API stays shut on any hostname or path Access doesn't cover (pages.dev, previews).
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});

const b64url = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - s.length % 4) % 4)), c => c.charCodeAt(0));

async function accessEmail(request, env) {
  const team = env.ACCESS_TEAM_DOMAIN || '';
  const aud = env.ACCESS_AUD || '';
  const jwt = request.headers.get('cf-access-jwt-assertion') || '';
  if (!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(team) || !aud) return null;
  const [h, p, s] = jwt.split('.');
  if (!h || !p || !s) return null;
  try {
    const header = JSON.parse(new TextDecoder().decode(b64url(h)));
    const payload = JSON.parse(new TextDecoder().decode(b64url(p)));
    if (header.alg !== 'RS256') return null;
    const { keys } = await (await fetch(`https://${team}/cdn-cgi/access/certs`)).json();
    const jwk = keys.find(k => k.kid === header.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64url(s), new TextEncoder().encode(h + '.' + p));
    const now = Date.now() / 1000;
    if (!ok || ![].concat(payload.aud).includes(aud) || payload.iss !== `https://${team}` || !(payload.exp > now)) return null;
    return payload.email || 'signed in';
  } catch {
    return null;
  }
}

// Quote every field; a leading = + - @ gets an apostrophe so a spreadsheet won't run a reason as a formula.
const cell = v => {
  let t = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(t)) t = "'" + t;
  return '"' + t.replace(/"/g, '""') + '"';
};

export async function onRequest({ request, env }) {
  const who = await accessEmail(request, env);
  if (!who) return json({ error: 'Sign in through Cloudflare Access to review ratings.' }, 403);
  const db = env.DB;

  if (request.method === 'GET') {
    const url = new URL(request.url);
    if (url.searchParams.get('format') === 'csv') {
      const { results } = await db.prepare('SELECT id, robot, rating, reason, day, status FROM ratings ORDER BY id').all();
      const lines = [['id', 'robot', 'rating', 'reason', 'date', 'status'].join(',')]
        .concat(results.map(r => [r.id, 'CBA-' + r.robot, r.rating, r.reason, r.day, r.status].map(cell).join(',')));
      return new Response(lines.join('\r\n') + '\r\n', {
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': `attachment; filename="robot-ratings-${new Date().toISOString().slice(0, 10)}.csv"`,
          'cache-control': 'no-store'
        }
      });
    }
    const { results } = await db.prepare(
      "SELECT id, robot, rating, reason, day, status FROM ratings WHERE reason IS NOT NULL ORDER BY (status = 'pending') DESC, id DESC LIMIT 1000"
    ).all();
    const totals = await db.prepare('SELECT COUNT(*) AS n FROM ratings').first('n');
    return json({ who, total: totals, rows: results });
  }

  if (request.method === 'POST') {
    // JSON only: a cross-site form can't send it without a CORS preflight, which this API never answers
    if (!(request.headers.get('content-type') || '').startsWith('application/json')) return json({ error: 'Send JSON.' }, 415);
    let b;
    try { b = await request.json(); } catch { return json({ error: 'Bad request.' }, 400); }
    if (!b || !Number.isInteger(b.id) || !['approved', 'hidden', 'pending'].includes(b.status)) return json({ error: 'Bad request.' }, 400);
    const res = await db.prepare('UPDATE ratings SET status = ? WHERE id = ? AND reason IS NOT NULL').bind(b.status, b.id).run();
    return res.meta.changes ? json({ ok: true }) : json({ error: 'No reason with that id.' }, 404);
  }

  return json({ error: 'Method not allowed.' }, 405);
}
