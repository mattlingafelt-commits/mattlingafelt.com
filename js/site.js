// shared by every page: each feature returns early when its elements are not on the page
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const el = (tag, cls, css) => { const e = document.createElement(tag); if (cls) e.className = cls; if (css) e.style.cssText = css; return e; };
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
// state changes cross-fade where the browser can; otherwise they just happen
const swap = fn => !reduce && document.startViewTransition ? document.startViewTransition(fn).ready.catch(() => {}) : fn(); // a skipped fade still applies the change

// theme: white unless the visitor switches; nothing is stored on their device, so each visit starts white
const root = document.documentElement, themeBtn = $('#theme');
if (themeBtn) {
  const dark = () => root.dataset.theme === 'dark';
  const labelTheme = () => { themeBtn.textContent = dark() ? 'Light' : 'Dark'; themeBtn.setAttribute('aria-label', `Switch to ${dark() ? 'light' : 'dark'} theme`); };
  themeBtn.onclick = () => swap(() => { root.dataset.theme = dark() ? 'light' : 'dark'; labelTheme(); });
  labelTheme();
}

// binary rows: real ASCII bits of the phrase
const field = $('.binary');
if (field) {
  const bits = (ph, off, n) => Array.from({ length: n }, (_, i) => ph.charCodeAt((off + i) % ph.length).toString(2).padStart(8, '0')).join(' ');
  const phrases = ['Likeness before function. ', 'Who agreed? '];
  for (let i = 0; i < 30; i++) {
    const ph = phrases[i % 2], r = el('div', 'row'); r.style.setProperty('--i', i); r.textContent = bits(ph, i * 5 % ph.length, 34); field.append(r);
  }
  // swell where panels meet: a soft bell around each seam, wide enough that neighbouring panels overlap
  let seams = [];
  const measure = () => { seams = $$('.sec').slice(1).map(sec => sec.getBoundingClientRect().top + scrollY); };
  const swell = () => {
    const mid = scrollY + innerHeight / 2, w = innerHeight * .42;
    let b = 0; for (const t of seams) { const d = (mid - t) / w; b = Math.max(b, Math.exp(-d * d)); }
    field.style.setProperty('--b', b.toFixed(3)); field.style.setProperty('--shift', (scrollY * .06).toFixed(1));
  };
  let ticking = false;
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { swell(); ticking = false; }); } }, { passive: true });
  addEventListener('resize', () => { measure(); swell(); });
  addEventListener('load', () => { measure(); swell(); });
  measure(); swell();
}

// split copy into words so each one resolves on its own; the plain text stays in the HTML
const words = (p, each) => { const parts = p.textContent.trim().split(/\s+/); p.textContent = ''; parts.forEach((t, i) => { const s = el('span'); s.textContent = t + ' '; each(s, i, parts.length); p.append(s); }); };
for (const p of $$('[data-words]')) {
  const [cls, unit, from, spread, span] = p.dataset.words.split(' ');
  words(p, (s, i, n) => { const a = +from + i / n * spread; s.className = cls; s.style.animationRange = `${unit} ${a.toFixed(1)}% ${unit} ${(a + +span).toFixed(1)}%`; });
}
for (const p of $$('[data-load]')) words(p, (s, i) => { s.className = 'lw'; s.style.setProperty('--i', i); });

// the research preview (home page only)
const room = $('.room'), sense = $('.sense');
if (room && sense) {
  // who can perceive the room
  const perceive = () => {
    const on = k => sense.querySelector(`[value=${k}]`).checked, cam = on('camera'), mic = on('mic'), cloud = on('cloud'); // each switch drives only its own effect
    // the robot always stays listed; a row is dimmed, and left out of the count, when that party can't perceive the room
    const senses = [cam && 'sees', mic && 'hears'].filter(Boolean).join(' + ');
    const p = [['The child', 'bonds with it', true], ['The robot', senses || "can't see or hear", !!senses]];
    if (cloud) p.push(["The company's servers", senses ? `get what it ${senses.replace('+', 'and')}` : 'get usage data, not the room', !!senses]);
    room.classList.toggle('nocam', !cam); room.classList.toggle('nomic', !mic); room.classList.toggle('cloud', cloud);
    const n = p.filter(r => r[2]).length;
    $('#n').textContent = n;
    $('#nl').textContent = (n === 1 ? 'party' : 'parties') + ' can perceive this room';
    $('#parties').replaceChildren(...p.map(([who, how, sees]) => { const li = el('li', sees ? '' : 'dim'), a = el('span'), b = el('span'); a.textContent = who; b.textContent = how; li.append(a, b); return li; }));
  };
  sense.addEventListener('change', perceive); perceive();
  const steps = $$('.step');
  if (steps.length) {
    // the caption crossing the middle of the screen sets the room; only on a change, so hand-flipped switches stick
    let current = null;
    const tell = () => {
      const mid = innerHeight / 2;
      const st = steps.find(x => { const r = x.getBoundingClientRect(); return r.top <= mid && r.bottom >= mid; });
      if (!st || st === current) return;
      current = st;
      steps.forEach(x => x.classList.toggle('on', x === st));
      const want = st.dataset.state.split(' ');
      for (const box of sense.querySelectorAll('input')) box.checked = want.includes(box.value);
      perceive();
    };
    addEventListener('scroll', tell, { passive: true }); // five rect reads per scroll is cheap
    tell();
  }
  const pause = $('#pause');
  if (pause) pause.onclick = e => { const p = room.classList.toggle('paused'); e.target.setAttribute('aria-pressed', p); e.target.textContent = p ? 'Play motion' : 'Pause motion'; };
}

// camera shutter: seven blades around a closing polygon; as the panel rises the blades turn and pull back
const shutter = $('.shutter');
if (shutter && room) {
  const shutterSvg = shutter.querySelector('svg'), N = 7, BIG = 400;
  const blades = Array.from({ length: N }, () => { const p = document.createElementNS('http://www.w3.org/2000/svg', 'polygon'); shutterSvg.append(p); return p; });
  const ease = t => t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
  const openShutter = () => {
    const top = room.closest('section').getBoundingClientRect().top, vh = innerHeight;
    const p = Math.min(1, Math.max(0, (vh - top) / vh)); // 0 when the panel's top meets the bottom of the screen, 1 when it reaches the top
    if (p >= 1 || reduce) { shutter.classList.add('gone'); return; }
    shutter.classList.remove('gone');
    shutter.style.transform = 'translateY(' + (-top) + 'px)'; // keep the lens on the screen's centre; the panel's overflow clip trims the rest
    const t = ease(Math.min(1, Math.max(0, (p - .2) / .7)));
    const r = t * 130, rot = -t * 1.2;
    const half = Math.PI / N;
    blades.forEach((poly, i) => {
      const a = i * 2 * half + rot, n = [Math.cos(a), Math.sin(a)], d = [-n[1], n[0]];
      const A = [n[0] * r - d[0] * r * Math.tan(half), n[1] * r - d[1] * r * Math.tan(half)];
      const pts = [A, [A[0] + d[0] * BIG, A[1] + d[1] * BIG], [A[0] + d[0] * BIG + n[0] * BIG, A[1] + d[1] * BIG + n[1] * BIG], [A[0] + n[0] * BIG, A[1] + n[1] * BIG]];
      poly.setAttribute('points', pts.map(q => q.map(v => v.toFixed(2)).join(',')).join(' '));
    });
  };
  addEventListener('scroll', openShutter, { passive: true });
  addEventListener('resize', openShutter);
  openShutter();
}

// small signals in Ongoing work
const scan = $('.scan'), eq = $('.eq');
if (scan) for (let i = 0; i < 10; i++) scan.append(el('span', '', `--i:${i}`));
if (eq) [10, 22, 16, 28, 12, 24, 18, 28, 14, 20, 26, 12, 22, 16].forEach(h => eq.append(el('span', '', `height:${h}px`)));

// writing filters (with no #tabs on the page, both lists are empty and nothing is wired)
const posts = $$('#posts li'), tabs = $$('#tabs button');
for (const b of tabs) {
  const k = b.dataset.k, match = p => k === 'all' || p.dataset.kind === k;
  b.textContent += ' ' + posts.filter(match).length;
  b.onclick = () => swap(() => { tabs.forEach(t => t.setAttribute('aria-pressed', t === b)); posts.forEach(p => p.hidden = !match(p)); });
}

const agree = $('#agree');
if (agree) agree.onclick = e => { $('#consent').textContent = "Funny thing is, there wasn't anything to agree to."; e.target.textContent = 'NOTED'; };

// off-screen sections stop animating
const live = new IntersectionObserver(es => es.forEach(e => e.target.classList.toggle('off', !e.isIntersecting)), { rootMargin: '200px 0px' });
for (const s of $$('.sec')) live.observe(s);
