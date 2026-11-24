// ============================================================
// SCENA „EMS BOHATER”
// EMS na środku, obok napis.
//  • W spoczynku EMS leciutko się uchyla i zamyka (powtarzany, powolny, PŁYNNY ruch).
//  • Najechanie myszką (komputer) albo przewinięcie na środek ekranu (telefon)
//    płynnie powiększa EMS-a i rozczepia go do końca.
// Ruch to klatki z Blendera rysowane na <canvas>; czasem i kierunkiem steruje GSAP.
//
// Jak zrobiona jest płynność ruchu w spoczynku:
//   – początek ruchu ma gęste klatki (co ok. 1 piksel przesunięcia),
//   – każda z nich to mała „łata” (tylko zmieniający się kawałek obrazu, z miękkim brzegiem),
//   – sąsiednie łaty przenikają się, więc obraz zmienia się przy każdym odświeżeniu ekranu.
//
// Scena dopasowuje się do okna: cały EMS (z antenami) zawsze mieści się na ekranie.
// Tam, gdzie klatka nie pokrywa ekranu, tło jest płynnie przedłużane.
//
// Wszystkie ustawienia (napis, klatki, czasy, powiększenie, obszar reagujący) są w historia.json.
// ============================================================

const TLO = '#020508';
const TLO_RGB = '2, 5, 8';

export const styl = `
  .ems-bohater { position: relative; }
  .ems-bohater .kadr { position: relative; width: 100%; overflow: hidden; background: ${TLO}; }
  .ems-bohater .kadr.ekran { height: calc(100vh - var(--sluxer-odstep-gory, 0px)); height: calc(100svh - var(--sluxer-odstep-gory, 0px)); }
  .ems-bohater .warstwa { position: absolute; inset: 0; will-change: transform; }
  .ems-bohater canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; opacity: 0; transition: opacity .6s ease; }
  .ems-bohater.jest-obraz canvas { opacity: 1; }
  .ems-bohater .strefa { position: absolute; margin: 0; padding: 0; border: 0; background: none; cursor: pointer; -webkit-tap-highlight-color: transparent; }
  .ems-bohater .strefa:focus { outline: none; }
  .ems-bohater .strefa:focus-visible { outline: 2px solid #4FDBD4; outline-offset: -6px; }
  .ems-bohater.dotyk .strefa { pointer-events: none; }
  .ems-bohater .znacznik { position: absolute; left: 0; width: 100%; height: 1px; pointer-events: none; }
  .ems-bohater .napis-pole { position: absolute; pointer-events: none; will-change: opacity, transform; }
  .ems-bohater .napis { margin: 0; opacity: 0; color: #F2F6F8; font-family: inherit; font-weight: 600; line-height: 1.04; letter-spacing: -0.025em; text-wrap: balance; }
  .ems-bohater.waski .napis-pole { left: 0; width: 100%; text-align: center; }
`;

const ogranicz = (v, a, b) => Math.min(b, Math.max(a, v));
const DOZWOLONE_ZNACZNIKI = ['h1', 'h2', 'h3', 'p', 'div'];

export default function utworz(scena, { gsap, bazaTresci, host }) {
  const k = scena.klatki;
  const kd = scena.kadr || {};
  const nj = scena.najechanie;
  const st = scena.strefa;
  const np = scena.napis && scena.napis.tekst ? scena.napis : null;
  const sp = Object.assign({ wlaczony: false, zakres: 0.1277, czas: 2.6, przerwa: 0.4 }, scena.spoczynek || {});
  const gs = k.gesto && k.gesto.liczba > 1 && k.gesto.wycinek ? k.gesto : null;   // gęste łaty początku ruchu
  const N = k.liczba;

  // nominalny rozmiar klatki (największy zestaw) – w tych jednostkach liczony jest układ
  const najwiekszy = [...k.zestawy].sort((a, b) => b.szerokosc - a.szerokosc)[0];
  const FW = najwiekszy.szerokosc, FH = najwiekszy.wysokosc;

  const element = document.createElement('section');
  element.className = 'scena ems-bohater';
  element.dataset.scena = scena.id || 'ems';
  element.innerHTML = `
    <div class="kadr">
      <div class="warstwa">
        <canvas aria-hidden="true"></canvas>
        <button class="strefa" type="button"></button>
      </div>
      <div class="napis-pole"></div>
      <div class="znacznik" aria-hidden="true"></div>
    </div>`;
  const kadr = element.querySelector('.kadr');
  const warstwa = element.querySelector('.warstwa');
  const canvas = element.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const strefa = element.querySelector('.strefa');
  const znacznik = element.querySelector('.znacznik');
  const napisPole = element.querySelector('.napis-pole');
  strefa.setAttribute('aria-label', scena.opis || 'Sluxer EMS');

  // wysokość sceny: cały ekran albo stałe proporcje
  if ((kd.tryb || 'ekran') === 'ekran') kadr.classList.add('ekran');
  else kadr.style.aspectRatio = `${(kd.proporcje || [16, 9])[0]} / ${(kd.proporcje || [16, 9])[1]}`;
  if (kd.minWysokosc) kadr.style.minHeight = `${kd.minWysokosc}px`;

  // napis obok EMS-a
  let napis = null;
  if (np) {
    const znacznikNapisu = DOZWOLONE_ZNACZNIKI.includes(np.znacznik) ? np.znacznik : 'h2';
    napis = document.createElement(znacznikNapisu);
    napis.className = 'napis';
    napis.textContent = np.tekst;
    napisPole.appendChild(napis);
  }

  const klatki = new Array(N).fill(null);                 // pełne klatki całego ruchu (p od 0 do 1)
  const laty = gs ? new Array(gs.liczba).fill(null) : []; // gęste łaty początku ruchu (p od 0 do gs.doPostepu); łata 0 = sama klatka 0
  const stan = { p: 0 };                    // 0 = złożony, 1 = rozczepiony i powiększony
  let biezaca = null;                       // klucz tego, co jest teraz narysowane
  let plotnoMaBaze = false;                 // na płótnie leży pełna klatka 0 (podkład pod łaty)
  let waski = false;                        // układ telefonu (ekran pionowy): napis nad EMS-em
  let zestaw = najwiekszy;
  let u = null;                             // bieżący układ: rozmiar kadru i położenie klatki (px)
  let zniszczona = false;
  let pamiec = { skala: null, strefa: null, napis: null };   // ostatnio ustawione style (żeby nie pisać ich bez potrzeby)

  const powiekszenie = () => (waski ? nj.powiekszenieWaski || nj.powiekszenie : nj.powiekszenie);
  const naX = (fx) => u.dx + fx * u.dw;     // ułamek szerokości klatki -> px kadru
  const naY = (fy) => u.dy + fy * u.dh;

  // Ruch w spoczynku zajmuje sam początek (p od 0 do sp.zakres). Powiększenie, obszar reagujący i napis
  // liczą się dopiero od końca tego zakresu – w spoczynku stoją w miejscu.
  const zakresSp = sp.wlaczony ? sp.zakres : 0;
  const pelne = (p) => ogranicz((p - zakresSp) / (1 - zakresSp), 0, 1);
  // wczytujemy tylko te łaty, których używa ruch w spoczynku (plus mały zapas) – reszta ruchu ma pełne klatki
  const ostatniaLata = gs && zakresSp > 0
    ? Math.min(gs.liczba - 1, Math.ceil((zakresSp / gs.doPostepu) * (gs.liczba - 1)) + 1)
    : 0;

  // obrys EMS-a (złożony + rozczepiony) po powiększeniu – w ułamkach klatki
  function obszarEms(pow) {
    const a = st.zlozony, b = st.rozlozony, cx = nj.srodekX, cy = nj.srodekY;
    const x0 = Math.min(a.x, b.x), y0 = Math.min(a.y, b.y);
    const x1 = Math.max(a.x + a.szer, b.x + b.szer), y1 = Math.max(a.y + a.wys, b.y + b.wys);
    return { x0: cx + (x0 - cx) * pow, x1: cx + (x1 - cx) * pow, y0: cy + (y0 - cy) * pow, y1: cy + (y1 - cy) * pow };
  }

  // ---------- rysowanie pełnej klatki + płynne przedłużenie tła poza klatką ----------
  function wygas(x, y, w, h, x0, y0, x1, y1) {
    if (w <= 0 || h <= 0) return;
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, `rgba(${TLO_RGB}, 0)`);
    g.addColorStop(1, `rgba(${TLO_RGB}, 1)`);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
  }

  function rysujPelna(img) {
    const d = u.dpr, cw = canvas.width, ch = canvas.height;
    const x = u.dx * d, y = u.dy * d, w = u.dw * d, h = u.dh * d;
    const iw = img.naturalWidth, ih = img.naturalHeight;

    ctx.fillStyle = TLO;
    ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(img, 0, 0, iw, ih, x, y, w, h);

    if (x > 0.5) {            // klatka węższa niż ekran: przedłużamy lewą i prawą krawędź
      const prawo = x + w;
      ctx.drawImage(img, 0, 0, 2, ih, 0, y, x + 1, h);
      ctx.drawImage(img, iw - 2, 0, 2, ih, prawo - 1, y, cw - prawo + 1, h);
      wygas(0, 0, x, ch, x, 0, 0, 0);
      wygas(prawo, 0, cw - prawo, ch, prawo, 0, cw, 0);
    }
    if (y > 0.5) {            // klatka niższa niż ekran: przedłużamy górę i dół
      const dol = y + h;
      ctx.drawImage(img, 0, 0, iw, 2, x, 0, w, y + 1);
      ctx.drawImage(img, 0, ih - 2, iw, 2, x, dol - 1, w, ch - dol + 1);
      wygas(0, 0, cw, y, 0, y, 0, 0);
      wygas(0, dol, cw, ch - dol, 0, dol, 0, ch);
    }
  }

  // ---------- rysowanie łat: podkład (klatka 0) + łata a + łata b przenikająca z siłą f ----------
  function rysujLate(baza, a, b, f) {
    const d = u.dpr, wy = gs.wycinek;
    const iw = baza.naturalWidth, ih = baza.naturalHeight;
    const x = (u.dx + wy.x * u.dw) * d, y = (u.dy + wy.y * u.dh) * d;
    const w = wy.szer * u.dw * d, h = wy.wys * u.dh * d;
    // łata „a” w całości przykrywa to, co się zmienia (jej miękki brzeg leży tam, gdzie obraz jest taki sam jak
    // w klatce 0), więc podkładu nie trzeba odtwarzać; tylko dla samej klatki 0 rysujemy jej wycinek
    if (a) ctx.drawImage(a, x, y, w, h);
    else ctx.drawImage(baza, wy.x * iw, wy.y * ih, wy.szer * iw, wy.wys * ih, x, y, w, h);
    if (b) { ctx.globalAlpha = f; ctx.drawImage(b, x, y, w, h); ctx.globalAlpha = 1; }

    // łata sięga dolnej krawędzi klatki (odbicie w podłodze), a pod klatką jest przedłużone tło:
    // przedłużamy je na nowo z tego, co właśnie narysowaliśmy, żeby odbicie nie „urywało się” na krawędzi
    const dol = (u.dy + u.dh) * d, ch = canvas.height;
    if (wy.y + wy.wys > 0.999 && dol < ch - 0.5) {
      const xa = Math.max(0, Math.floor(x)), xb = Math.min(canvas.width, Math.ceil(x + w));
      ctx.drawImage(canvas, xa, Math.floor(dol) - 2, xb - xa, 2, xa, dol - 1, xb - xa, ch - dol + 1);
      wygas(xa, dol, xb - xa, ch - dol, 0, dol, 0, ch);
    }
  }

  // ---------- narysowanie obrazu dla postępu p ----------
  function rysujStan(p) {
    const baza = klatki[0];
    if (gs && baza && p <= gs.doPostepu + 1e-6) {
      // początek ruchu: gęste łaty z przenikaniem (ruch co do ułamka klatki)
      const poz = ogranicz(p / gs.doPostepu, 0, 1) * (gs.liczba - 1);
      let i = Math.min(gs.liczba - 1, Math.floor(poz + 1e-6));
      let f = poz - i;
      if (f < 0.004 || i >= gs.liczba - 1) f = 0;
      const a = i > 0 ? laty[i] : null;
      const b = f ? laty[i + 1] : null;
      if ((i === 0 || a) && (!f || b)) {
        const klucz = `g${i}:${Math.round(f * 200)}`;
        if (klucz !== biezaca) {
          if (!plotnoMaBaze) { rysujPelna(baza); plotnoMaBaze = true; }
          rysujLate(baza, a, b, f);
          biezaca = klucz;
        }
        return;
      }
    }
    // dalsza część ruchu (albo łaty jeszcze się wczytują): pełne klatki
    const nr = Math.round(p * (N - 1));
    let img = klatki[nr];
    for (let j = nr - 1; !img && j >= 0; j--) img = klatki[j];   // jeszcze się wczytuje -> najbliższa wcześniejsza
    if (!img) return;
    const klucz = `z${nr}${img === klatki[nr] ? '' : '?'}`;
    if (klucz !== biezaca) {
      rysujPelna(img);
      plotnoMaBaze = img === baza;
      biezaca = klucz;
    }
  }

  // ---------- zastosowanie stanu p (obraz + powiększenie + obszar reagujący + napis) ----------
  function zastosuj() {
    if (!u) return;
    const p = stan.p;
    rysujStan(p);

    const T = pelne(p);
    const skala = (1 + (powiekszenie() - 1) * T).toFixed(4);
    if (skala !== pamiec.skala) { warstwa.style.transform = `scale(${skala})`; pamiec.skala = skala; }

    const kluczStrefy = T.toFixed(3);
    if (kluczStrefy !== pamiec.strefa) {
      const a = st.zlozony, b = st.rozlozony;
      const x = a.x + (b.x - a.x) * T, y = a.y + (b.y - a.y) * T;
      const w = a.szer + (b.szer - a.szer) * T, h = a.wys + (b.wys - a.wys) * T;
      strefa.style.left = `${naX(x)}px`;
      strefa.style.top = `${naY(y)}px`;
      strefa.style.width = `${w * u.dw}px`;
      strefa.style.height = `${h * u.dh}px`;
      pamiec.strefa = kluczStrefy;
    }

    if (napis) {
      // napis znika dopiero przy pełnym rozczepianiu; na telefonie jest nad EMS-em i zostaje
      const znika = !waski && np.znikaPrzyRozczepieniu !== false;
      const t = znika ? ogranicz(T / 0.3, 0, 1) : 0;
      const kluczNapisu = t.toFixed(3);
      if (kluczNapisu !== pamiec.napis) {
        napisPole.style.opacity = String(1 - t);
        napisPole.style.transform = `translate(${(t * 28).toFixed(1)}px, -50%)`;
        pamiec.napis = kluczNapisu;
      }
    }
  }

  // ---------- układ: dopasowanie klatki do kadru, rozmiar płótna, punkt powiększania, napis ----------
  function uklad() {
    const W = kadr.clientWidth, H = kadr.clientHeight;
    if (!W || !H) return;
    waski = W / H < (kd.waskiPonizejProporcji || 1.15);
    element.classList.toggle('waski', waski);

    const R = obszarEms(powiekszenie());
    const mpx = (kd.margines ?? 0.03) * Math.min(W, H);
    const rozmiarNapisuWaski = ogranicz(W * 0.085, 20, 44);
    const rezerwaGora = waski && napis ? rozmiarNapisuWaski * 2.1 : 0;   // miejsce na napis nad EMS-em

    // skala: cały EMS ma się mieścić; jeśli się da, klatka pokrywa cały kadr
    const sDopasuj = Math.min(
      (W - 2 * mpx) / ((R.x1 - R.x0) * FW),
      (H - rezerwaGora - 2 * mpx) / ((R.y1 - R.y0) * FH)
    );
    const sPokryj = Math.max(W / FW, H / FH);
    const s = Math.max(0.05, Math.min(sDopasuj, sPokryj));
    const dw = FW * s, dh = FH * s;

    let dx, dy;
    if (waski) {
      dx = W / 2 - ((R.x0 + R.x1) / 2) * dw;
      dy = rezerwaGora + (H - rezerwaGora) / 2 - ((R.y0 + R.y1) / 2) * dh;
    } else {
      dx = W / 2 - (kd.srodekX ?? 0.5) * dw;
      dy = H / 2 - (kd.srodekY ?? 0.5) * dh;
      dx = dw >= W ? ogranicz(dx, W - dw, 0) : (W - dw) / 2;
      dy = dh >= H ? ogranicz(dy, H - dh, 0) : (H - dh) / 2;
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    u = { W, H, s, dx, dy, dw, dh, dpr };

    const cw = Math.round(W * dpr), ch = Math.round(H * dpr);
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
    ctx.imageSmoothingQuality = 'high';

    warstwa.style.transformOrigin = `${naX(nj.srodekX)}px ${naY(nj.srodekY)}px`;
    znacznik.style.top = `${naY(nj.srodekY)}px`;

    if (napis) {
      if (waski) {
        const goraEms = naY(Math.min(st.zlozony.y, st.rozlozony.y));
        napis.style.fontSize = `${rozmiarNapisuWaski}px`;
        napisPole.style.left = '0';
        napisPole.style.maxWidth = 'none';
        napisPole.style.top = `${Math.max(rozmiarNapisuWaski * 0.9, goraEms * 0.5)}px`;
      } else {
        const lewo = naX(np.x ?? 0.585);
        napis.style.fontSize = `${ogranicz((np.wielkosc || 0.085) * dh, 22, 128)}px`;
        napisPole.style.left = `${lewo}px`;
        napisPole.style.top = `${naY(np.y ?? 0.5)}px`;
        napisPole.style.maxWidth = `${Math.max(140, W - lewo - Math.max(16, W * 0.03))}px`;
      }
    }

    biezaca = null;
    plotnoMaBaze = false;
    pamiec = { skala: null, strefa: null, napis: null };
    zastosuj();
  }

  // ---------- który zestaw klatek (lżejszy, gdy klatka jest na ekranie mała) ----------
  function wybierzZestaw() {
    const potrzeba = u ? FW * u.s * u.dpr : FW;
    const rosnaco = [...k.zestawy].sort((a, b) => a.szerokosc - b.szerokosc);
    return rosnaco.find((z) => z.szerokosc >= potrzeba * 0.8) || rosnaco[rosnaco.length - 1];
  }

  // ---------- wczytywanie: klatka 0 od razu, potem łaty (ruch w spoczynku), potem reszta klatek ----------
  const adres = (wzor, i) =>
    new URL(`${k.folder}/${zestaw.nazwa}/${wzor.replace('{nr}', String(i).padStart(3, '0'))}`, bazaTresci).href;

  function wczytajObraz(url) {
    return new Promise((ok, blad) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => ok(img);
      img.onerror = () => blad(new Error('brak pliku'));
      img.src = url;
    });
  }

  async function wczytajKlatke(i) {
    const url = adres(k.wzor, i);
    try {
      const img = await wczytajObraz(url);
      if (zniszczona) return;
      klatki[i] = img;
      biezaca = null;
      zastosuj();
    } catch (e) { console.warn('[sluxer-historia] brak klatki:', url); }
  }

  // łaty trzymamy jako gotowe, zdekodowane bitmapy – rysowanie ich nie zacina ruchu
  async function wczytajLate(i) {
    const url = adres(gs.wzor, i);
    try {
      let obraz;
      if (typeof createImageBitmap === 'function') {
        const odp = await fetch(url);
        if (!odp.ok) throw new Error('brak pliku');
        obraz = await createImageBitmap(await odp.blob());
      } else {
        obraz = await wczytajObraz(url);
      }
      if (zniszczona) { if (obraz.close) obraz.close(); return; }
      laty[i] = obraz;
      biezaca = null;
      zastosuj();
    } catch (e) { console.warn('[sluxer-historia] brak łaty:', url); }
  }

  const bezRuchu = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function pokazNapis() {
    if (!napis) return;
    if (bezRuchu) gsap.set(napis, { opacity: 1 });
    else gsap.fromTo(napis, { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 1.1, ease: 'power3.out', delay: 0.25 });
  }

  async function wczytajWszystko() {
    await wczytajKlatke(0);
    if (zniszczona) return;
    element.classList.add('jest-obraz');
    pokazNapis();

    const kolejka = [];
    for (let i = 1; i <= ostatniaLata; i++) kolejka.push(() => wczytajLate(i));
    const ileLat = kolejka.length;
    for (let i = 1; i < N; i++) kolejka.push(() => wczytajKlatke(i));
    let pobrane = 0;
    const robotnik = async () => {
      while (kolejka.length && !zniszczona) {
        await kolejka.shift()();
        if (++pobrane === ileLat) spoczynek();   // łaty są -> ruch w spoczynku może ruszyć
      }
    };
    await Promise.all([robotnik(), robotnik(), robotnik(), robotnik()]);
    if (zniszczona) return;
    element.classList.add('gotowa');
    spoczynek();
    if (!waski) {   // na komputerze dekodujemy pełne klatki z wyprzedzeniem, żeby pierwsze najechanie było płynne
      for (const img of klatki) {
        if (zniszczona) break;
        if (img && img.decode) { try { await img.decode(); } catch (e) { /* nic */ } }
      }
    }
  }

  // ---------- ruch (GSAP) ----------
  let aktywna = false;       // true = najechany myszką / na środku ekranu telefonu -> pełne rozczepienie
  let tSpoczynek = null;     // powtarzany, powolny ruch w spoczynku
  let widac = true;          // scena jest teraz na ekranie

  // w spoczynku EMS leciutko się uchyla i zamyka – w kółko, dopóki nikt na niego nie najedzie
  function spoczynek() {
    if (zniszczona || bezRuchu || !sp.wlaczony || aktywna || tSpoczynek || stan.p > 0.001) return;
    tSpoczynek = gsap.to(stan, {
      p: sp.zakres, duration: sp.czas, ease: 'sine.inOut',
      yoyo: true, repeat: -1, repeatDelay: sp.przerwa, onUpdate: zastosuj,
    });
    if (!widac) tSpoczynek.pause();
  }
  function stopSpoczynek() {
    if (tSpoczynek) { tSpoczynek.kill(); tSpoczynek = null; }
  }

  function otworz() {
    aktywna = true;
    stopSpoczynek();
    gsap.to(stan, {
      p: 1, duration: bezRuchu ? 0.001 : nj.czas * Math.max(0.45, 1 - stan.p),
      ease: 'power2.inOut', overwrite: true, onUpdate: zastosuj,
    });
  }
  function zamknij() {
    aktywna = false;
    stopSpoczynek();
    gsap.to(stan, {
      p: 0, duration: bezRuchu ? 0.001 : nj.czas * Math.max(0.45, stan.p),
      ease: 'power2.inOut', overwrite: true, onUpdate: zastosuj, onComplete: spoczynek,
    });
  }

  // ---------- co uruchamia pełne rozczepienie ----------
  const dotyk = host.hasAttribute('wymus-telefon') || window.matchMedia('(hover: none)').matches;
  element.classList.toggle('dotyk', dotyk);
  let obserwator = null;
  if (!dotyk) {
    // komputer: najechanie myszką (albo fokus z klawiatury) otwiera, zjechanie zamyka
    strefa.addEventListener('pointerenter', otworz);
    strefa.addEventListener('pointerleave', zamknij);
    strefa.addEventListener('focus', otworz);
    strefa.addEventListener('blur', zamknij);
  } else {
    strefa.tabIndex = -1;
    const tel = scena.telefon || {};
    if ((tel.tryb || 'przewijanie') === 'przewijanie' && !bezRuchu) {
      // telefon: EMS rozczepia się, gdy jego środek jest w środkowym pasie ekranu
      const margines = `${(-(1 - (tel.pasSrodka ?? 0.3)) / 2) * 100}%`;
      obserwator = new IntersectionObserver(
        (wpisy) => { for (const w of wpisy) (w.isIntersecting ? otworz : zamknij)(); },
        { rootMargin: `${margines} 0px ${margines} 0px`, threshold: 0 }
      );
    }
  }

  // ruch w spoczynku działa tylko wtedy, gdy scenę widać na ekranie
  const obserwatorWidocznosci = new IntersectionObserver((wpisy) => {
    widac = wpisy[wpisy.length - 1].isIntersecting;
    if (tSpoczynek) { if (widac) tSpoczynek.resume(); else tSpoczynek.pause(); }
  }, { threshold: 0 });

  const obserwatorRozmiaru = new ResizeObserver(() => uklad());

  function start() {
    uklad();
    zestaw = wybierzZestaw();
    obserwatorRozmiaru.observe(kadr);
    obserwatorWidocznosci.observe(kadr);
    if (obserwator) obserwator.observe(znacznik);
    wczytajWszystko();
  }

  function zniszcz() {
    zniszczona = true;
    obserwatorRozmiaru.disconnect();
    obserwatorWidocznosci.disconnect();
    if (obserwator) obserwator.disconnect();
    gsap.killTweensOf(stan);
    if (napis) gsap.killTweensOf(napis);
    for (const l of laty) if (l && l.close) l.close();
  }

  // ręczne ustawienie stanu (0 = złożony … 1 = rozczepiony) – do testów i do sterowania sceną z zewnątrz
  function ustawPostep(p) {
    stopSpoczynek();
    gsap.killTweensOf(stan);
    stan.p = ogranicz(p, 0, 1);
    zastosuj();
  }

  return { element, start, zniszcz, ustawPostep };
}
