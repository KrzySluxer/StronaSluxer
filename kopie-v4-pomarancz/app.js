// Wspólny skrypt makiety Sluxer (wszystkie podstrony)
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = id => document.getElementById(id);

// nagłówek po przewinięciu
const hdr = $('hdr');
if (hdr) addEventListener('scroll', () => hdr.classList.toggle('scrolled', scrollY > 40), { passive: true });

// płynne pojawianie się + liczniki
function countUp(el) {
  if (el._done) return; el._done = 1;
  const end = +el.dataset.count, t0 = performance.now(), d = 1600;
  (function f(t) { const p = Math.min(1, (t - t0) / d); el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3))).toLocaleString('pl-PL'); if (p < 1) requestAnimationFrame(f); })(t0);
}
const io = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return;
  e.target.classList.add('in'); io.unobserve(e.target);
  if (e.target.dataset.count) countUp(e.target);
  e.target.querySelectorAll('[data-count]').forEach(countUp);
}), { threshold: .12, rootMargin: '0px 0px -40px 0px' });
document.querySelectorAll('.rv').forEach(el => io.observe(el));

// zakładki produktów (pigułka + przenikanie); #firma otwiera zakładkę dla firm
const pill = $('pill'), tabs = [...document.querySelectorAll('.tabs button')];
if (pill && tabs.length) {
  const movePill = b => { pill.style.left = b.offsetLeft + 'px'; pill.style.width = b.offsetWidth + 'px'; };
  const select = b => { tabs.forEach(x => x.classList.toggle('on', x === b)); movePill(b); document.querySelectorAll('.pgroup').forEach(g => g.classList.toggle('on', g.id === b.dataset.g)); };
  tabs.forEach(b => b.onclick = () => select(b));
  const fromHash = () => { if (location.hash === '#firma') { select(tabs[2]); document.getElementById('produkty').scrollIntoView({ behavior: 'smooth' }); } };
  addEventListener('load', () => { movePill(document.querySelector('.tabs button.on')); fromHash(); });
  addEventListener('hashchange', fromHash);
  addEventListener('resize', () => movePill(document.querySelector('.tabs button.on')));
  movePill(tabs[0]);
}

// FAQ: płynne zamykanie
document.querySelectorAll('.faq details').forEach(d => d.querySelector('summary').addEventListener('click', e => {
  if (d.open) { e.preventDefault(); const a = d.querySelector('.ans'); a.style.gridTemplateRows = '0fr'; setTimeout(() => { d.open = false; a.style.gridTemplateRows = ''; }, 450); }
}));

// słupki kwadransa
const qb = $('qbar');
if (qb) [38, 30, 22, 14, 6, -4, -8, -6, -3, 0, 4, -2, 0, 2, -1, 0].forEach((v, i) => {
  const d = document.createElement('div'); d.className = 'bar' + (v < 0 ? ' neg' : '');
  d.style.left = (i * 6.1 + 1) + '%'; d.style.height = Math.max(1, Math.abs(v)) * 1.2 + '%'; d.style.animationDelay = (i * .08) + 's'; qb.appendChild(d);
});

// iskry energii
(function () {
  const c = $('sparks'); if (!c || reduce) return; const x = c.getContext('2d'); let W, H, P = [];
  function rs() { W = c.width = c.offsetWidth * devicePixelRatio; H = c.height = c.offsetHeight * devicePixelRatio; } rs(); addEventListener('resize', rs);
  for (let i = 0; i < 60; i++) P.push({ x: Math.random(), y: Math.random(), s: Math.random() * 1.8 + .4, v: Math.random() * .0009 + .0003, a: Math.random() * .6 + .2, w: Math.random() * 6.28 });
  (function f() {
    x.clearRect(0, 0, W, H);
    P.forEach(p => {
      p.y -= p.v; p.w += .02; if (p.y < -.02) { p.y = 1.02; p.x = Math.random(); }
      const px = (p.x + Math.sin(p.w) * .004) * W, py = p.y * H, r = p.s * devicePixelRatio, g = x.createRadialGradient(px, py, 0, px, py, r * 4);
      g.addColorStop(0, p.x > .55 ? `rgba(255,214,150,${p.a})` : `rgba(255,166,110,${p.a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.beginPath(); x.arc(px, py, r * 4, 0, 7); x.fill();
    });
    requestAnimationFrame(f);
  })();
})();

// Dzień z życia magazynu (tylko na stronie EMS)
(function () {
  const hour = $('hour'); if (!hour) return;
  const H = [[0, .62, 58, 'Noc: dom zasila się z magazynu. Prąd z sieci EMS kupuje tylko wtedy, gdy jest tani.', '🌙 Magazyn → dom', 'eve'],
  [6, .74, 41, 'Poranek: magazyn pokrywa poranny szczyt zużycia, zanim zacznie świecić słońce.', '🌅 Magazyn → dom', 'eve'],
  [9, .42, 44, 'Przedpołudnie: panele zaczynają produkować, nadwyżka trafia do magazynu.', '☀️ Dach → dom + magazyn', 'day'],
  [11.5, .19, 64, 'Południe: nadwyżka z dachu ładuje magazyn i grzeje wodę. Prąd z sieci jest teraz najtańszy w ciągu dnia.', '☀️ Dach → magazyn', 'day'],
  [14.5, .28, 88, 'Popołudnie: magazyn prawie pełny, więc EMS ładuje samochód z nadwyżki.', '☀️ Dach → auto', 'day'],
  [17.5, 1.13, 92, 'Wieczór: prąd z sieci jest najdroższy. Dom zasila się z magazynu, a nadwyżkę EMS może sprzedać.', '🌆 Magazyn → dom', 'eve'],
  [21, .86, 70, 'Późny wieczór: magazyn dalej zasila dom, więc rachunek nie rośnie.', '🌙 Magazyn → dom', 'eve']];
  const lerp = (a, b, t) => a + (b - a) * t;
  const band = (h, a, b, c, d) => (h <= a || h >= d) ? 0 : h < b ? (h - a) / (b - a) : h <= c ? 1 : (d - h) / (d - c);
  let lastTxt = '', mode = 'day';
  function upd() {
    const h = +hour.value;
    const dawn = band(h, 4.5, 6, 7, 8.5), day = band(h, 7, 9, 16, 18), dusk = band(h, 16, 17.5, 19, 20.5);
    $('s-dawn').style.opacity = dawn; $('s-day').style.opacity = day; $('s-dusk').style.opacity = dusk;
    $('stars').style.opacity = Math.max(0, 1 - (dawn + day + dusk) * 1.4);
    const ps = (h - 5.5) / 14, pm = ((h + 12 - 19) % 24) / 11, sun = $('sun'), moon = $('moon');
    sun.style.left = (8 + ps * 84) + '%'; sun.style.top = (85 - Math.sin(Math.max(0, Math.min(1, ps)) * Math.PI) * 68) + '%'; sun.style.opacity = ps > 0 && ps < 1 ? 1 : 0;
    moon.style.left = (8 + pm * 84) + '%'; moon.style.top = (80 - Math.sin(Math.max(0, Math.min(1, pm)) * Math.PI) * 55) + '%'; moon.style.opacity = pm > 0 && pm < 1 ? Math.max(0, 1 - day * 1.5) : 0;
    const lit = h < 6.5 || h >= 16.5;
    ['w1', 'w2', 'w3'].forEach((id, i) => $(id).setAttribute('fill', lit ? (i === 2 && h > 22.5 ? '#2A2520' : '#FFD27A') : '#332C26'));
    document.querySelectorAll('.win').forEach(w => w.style.filter = lit ? 'drop-shadow(0 0 8px rgba(255,210,122,.8))' : 'none');
    let i = 0; for (let k = 0; k < H.length; k++) if (h >= H[k][0]) i = k;
    const a = H[i], b = H[(i + 1) % H.length], span = ((b[0] - a[0]) + 24) % 24 || 24, t = Math.min(1, ((h - a[0] + 24) % 24) / span);
    const pr = lerp(a[1], b[1], t), soc = Math.round(lerp(a[2], b[2], t));
    $('tm').textContent = String(Math.floor(h)).padStart(2, '0') + ':' + String(Math.round((h % 1) * 60)).padStart(2, '0');
    $('pr').textContent = pr.toFixed(2).replace('.', ',') + ' zł'; $('pr').style.color = pr > .7 ? '#FF9A8A' : pr < .3 ? '#FFA66E' : '#fff';
    $('soc').textContent = soc + '%';
    if (a[3] !== lastTxt) { lastTxt = a[3]; const el = $('act'); el.classList.add('out'); setTimeout(() => { el.textContent = a[3]; $('flowtxt').textContent = a[4]; el.classList.remove('out'); }, 300); }
    mode = a[5];
  }
  hour.addEventListener('input', upd); upd();
  const g = $('dots'), pd = $('pathDay'), pe = $('pathEve'), cs = [];
  for (let i = 0; i < 5; i++) { const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); c.setAttribute('r', 3.2); g.appendChild(c); cs.push(c); }
  (function f(t) { const p = mode === 'day' ? pd : pe, L = p.getTotalLength(); cs.forEach((c, i) => { const s = ((t / 1600 + i / 5) % 1), pt = p.getPointAtLength(s * L); c.setAttribute('cx', pt.x); c.setAttribute('cy', pt.y); c.style.opacity = Math.sin(s * Math.PI); }); requestAnimationFrame(f); })(0);
  let playing = null; const play = $('play');
  play.onclick = () => {
    if (playing) { cancelAnimationFrame(playing); playing = null; play.textContent = '▶ Odtwórz cały dzień'; return; }
    play.textContent = '❚❚ Pauza'; let v = +hour.value;
    (function f() { v = (v + .04) % 24; hour.value = v; upd(); playing = requestAnimationFrame(f); })();
  };
})();

// Kreator kalkulatora (tylko na stronie kalkulatora)
(function () {
  const w = $('wizard'); if (!w) return;
  const steps = [...w.querySelectorAll('.wstep')], bars = [...w.querySelectorAll('.progress i')], back = $('wBack'), next = $('wNext');
  let cur = 0;
  // wybór "firma" z adresu kalkulator.html?typ=firma
  if (new URLSearchParams(location.search).get('typ') === 'firma') { const f = w.querySelector('input[value=firma]'); if (f) f.checked = true; }
  function show(n, scroll = true) {
    cur = Math.max(0, Math.min(steps.length - 1, n));
    steps.forEach((s, i) => s.classList.toggle('on', i === cur));
    bars.forEach((b, i) => b.classList.toggle('on', i <= cur));
    back.style.visibility = cur === 0 ? 'hidden' : 'visible';
    const last = cur === steps.length - 1;
    next.style.display = last ? 'none' : '';
    next.firstChild.textContent = cur === steps.length - 2 ? 'Pokaż wynik ' : 'Dalej ';
    if (scroll && w.getBoundingClientRect().top < 80) w.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  back.onclick = () => show(cur - 1);
  next.onclick = () => show(cur + 1);
  show(0, false);
})();
