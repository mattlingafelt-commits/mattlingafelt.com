// Current project: the room scroll story. The step crossing the middle of the screen sets the room;
// only on a change of step, so switches flipped by hand stick until the next step.
(() => {
  const room = document.querySelector('.room');
  if (!room) return;
  const steps = [...document.querySelectorAll('[data-step]')];
  const [cam, mic, cloud] = document.querySelectorAll('.tog input');
  const pause = document.querySelector('button.pill');
  const live = document.querySelector('[aria-live]');
  const list = live.nextElementSibling;
  const rowTpl = list.firstElementChild.cloneNode(true);
  const wants = [[], ['camera'], ['camera', 'mic'], ['camera', 'mic', 'cloud'], ['camera', 'mic', 'cloud']];
  let step = -1, paused = false;

  const render = () => {
    const c = cam.checked, m = mic.checked, k = cloud.checked;
    for (const el of [cam, mic, cloud]) el.parentElement.classList.toggle('on', el.checked);
    room.classList.toggle('nocam', !c);
    room.classList.toggle('nomic', !m);
    room.classList.toggle('cloud', k);
    room.classList.toggle('paused', paused);
    pause.classList.toggle('on', paused);
    pause.setAttribute('aria-pressed', String(paused));
    pause.textContent = paused ? 'Play motion' : 'Pause motion';
    for (const el of steps) el.style.opacity = (step < 0 || step === Number(el.dataset.step)) ? 1 : 0.35;

    const senses = [c && 'sees', m && 'hears'].filter(Boolean).join(' and ');
    const rows = [['The child', 'bonds with it', true], ['The robot', senses || 'can’t see or hear', !!senses]];
    if (k) rows.push(['The company’s servers', senses ? 'get what it ' + senses : 'get usage data, not the room', !!senses]);
    const n = rows.filter(r => r[2]).length;
    live.firstElementChild.textContent = n;
    live.lastElementChild.textContent = (n === 1 ? 'party' : 'parties') + ' can perceive this room';
    list.replaceChildren(...rows.map(([who, how, sees]) => {
      const li = rowTpl.cloneNode(true);
      li.children[0].textContent = who;
      li.children[1].textContent = how;
      li.style.opacity = sees ? 1 : 0.4;
      return li;
    }));
  };

  let cur = -1;
  const tell = () => {
    const mid = window.innerHeight / 2;
    const el = steps.find(x => { const r = x.getBoundingClientRect(); return r.top <= mid && r.bottom >= mid; });
    if (!el) return;
    const i = Number(el.dataset.step);
    if (i === cur) return;
    cur = step = i;
    const w = wants[i] || [];
    cam.checked = w.includes('camera');
    mic.checked = w.includes('mic');
    cloud.checked = w.includes('cloud');
    render();
  };

  for (const el of [cam, mic, cloud]) el.addEventListener('change', render);
  pause.addEventListener('click', () => { paused = !paused; render(); });
  window.addEventListener('scroll', tell, { passive: true });
  window.addEventListener('resize', tell, { passive: true });
  tell();
})();
