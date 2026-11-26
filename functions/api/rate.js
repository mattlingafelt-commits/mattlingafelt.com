// /api/rate: GET returns each robot's average (all ratings) and approved reasons; POST stores one rating.
// Stored per rating: robot, rating, reason, day, status. No name, email, IP or cookie.
const ROBOTS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10'];
const DAILY_LIMIT = 40; // ratings per day from one connection

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// A random salt per day, deleted with yesterday's throttle counts once a new day starts,
// so the hashed IP used for the rate limit can't be traced back after that.
async function daySalt(db, day) {
  const have = await db.prepare('SELECT value FROM salt WHERE day = ?').bind(day).first('value');
  if (have) return have;
  await db.batch([
    db.prepare('DELETE FROM salt WHERE day <> ?').bind(day),
    db.prepare('DELETE FROM throttle'),
    db.prepare('INSERT OR IGNORE INTO salt (day, value) VALUES (?, ?)').bind(day, crypto.randomUUID() + crypto.randomUUID())
  ]);
  return db.prepare('SELECT value FROM salt WHERE day = ?').bind(day).first('value');
}

export async function onRequestGet({ env }) {
  const [avgs, reasons] = await env.DB.batch([
    env.DB.prepare('SELECT robot, ROUND(AVG(rating), 1) AS avg, COUNT(*) AS n FROM ratings GROUP BY robot'),
    env.DB.prepare("SELECT robot, reason FROM ratings WHERE status = 'approved' AND reason IS NOT NULL ORDER BY id DESC LIMIT 500")
  ]);
  const out = {};
  for (const r of avgs.results) out[r.robot] = { avg: r.avg, n: r.n, reasons: [] };
  for (const r of reasons.results) {
    const o = out[r.robot];
    if (o && o.reasons.length < 5) o.reasons.push(r.reason);
  }
  return json(out);
}

export async function onRequestPost({ request, env }) {
  if (!(request.headers.get('content-type') || '').startsWith('application/json')) return json({ error: 'Send JSON.' }, 415);
  const raw = await request.text();
  if (raw.length > 4000) return json({ error: 'That’s too long.' }, 413);
  let b;
  try { b = JSON.parse(raw); } catch { return json({ error: 'That didn’t send. Please try again.' }, 400); }
  if (!b || typeof b !== 'object') return json({ error: 'That didn’t send. Please try again.' }, 400);
  if (b.website) return json({ ok: true }); // honeypot: bots fill the hidden box; pretend it worked and store nothing

  const robot = String(b.robot || '');
  const rating = Number(b.rating);
  if (!ROBOTS.includes(robot) || !Number.isInteger(rating) || rating < 1 || rating > 10) {
    return json({ error: 'Pick a number from 1 to 10.' }, 400);
  }
  const reason = String(b.reason ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim() || null;
  if (reason && reason.length > 400) return json({ error: 'Please keep your reason to 400 characters.' }, 400);

  const db = env.DB;
  const day = new Date().toISOString().slice(0, 10);
  const salt = await daySalt(db, day);
  const key = await sha256(salt + (request.headers.get('cf-connecting-ip') || ''));
  const n = await db.prepare('INSERT INTO throttle (k, n) VALUES (?, 1) ON CONFLICT(k) DO UPDATE SET n = n + 1 RETURNING n').bind(key).first('n');
  if (n > DAILY_LIMIT) return json({ error: 'That’s a lot of ratings from one place today. Please try again tomorrow.' }, 429);

  const status = reason ? 'pending' : 'approved';
  const r = b.replace;
  // "Change my answer": the ticket is a hash of today's salt, so it only works the same day and nothing extra is stored
  if (r && Number.isInteger(r.id) && r.token === await sha256(salt + ':edit:' + r.id)) {
    const res = await db.prepare('UPDATE ratings SET rating = ?, reason = ?, status = ? WHERE id = ? AND robot = ? AND day = ?')
      .bind(rating, reason, status, r.id, robot, day).run();
    if (res.meta.changes) return json({ ok: true, id: r.id, token: r.token });
  }
  const id = await db.prepare('INSERT INTO ratings (robot, rating, reason, day, status) VALUES (?, ?, ?, ?, ?) RETURNING id')
    .bind(robot, rating, reason, day, status).first('id');
  return json({ ok: true, id, token: await sha256(salt + ':edit:' + id) });
}
