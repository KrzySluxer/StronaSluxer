// ============================================================
// SLUXER – MODUŁ Z ANIMOWANĄ HISTORIĄ
// Samodzielny komponent strony. Osadzenie:
//
//   <script type="module" src="…/sluxer-historia.js"></script>
//   <sluxer-historia src="…/historia.json"></sluxer-historia>
//
// Treść i ustawienia scen są w pliku historia.json (bez zmian w kodzie).
// Każdy typ sceny to osobny plik w folderze sceny/.
// Komponent nie zależy od WordPressa ani Elementora; styl ma zamknięty w sobie (Shadow DOM).
// ============================================================

const BAZA = new URL('.', import.meta.url);

// typ sceny -> plik z jej kodem (wczytywany dopiero, gdy jest potrzebny)
const TYPY_SCEN = {
  'ems-bohater': () => import('./sceny/ems-bohater.js'),
};

const STYL = `
  :host { display: block; }
  .historia { position: relative; width: 100%; background: #020508; color: #E8F1F4; }
  .blad { padding: 24px; font: 14px/1.5 system-ui, sans-serif; color: #FFC56B; }
`;

function wczytajSkrypt(adres) {
  return new Promise((ok, blad) => {
    const s = document.createElement('script');
    s.src = adres;
    s.onload = () => ok();
    s.onerror = () => blad(new Error('Nie udało się wczytać: ' + adres));
    document.head.appendChild(s);
  });
}

let obietnicaGsap = null;
function dajGsap() {
  if (window.gsap) return Promise.resolve(window.gsap);
  if (!obietnicaGsap) {
    obietnicaGsap = wczytajSkrypt(new URL('vendor/gsap.min.js', BAZA).href).then(() => window.gsap);
  }
  return obietnicaGsap;
}

class SluxerHistoria extends HTMLElement {
  constructor() {
    super();
    this._sceny = [];
    this._uruchomiony = false;
  }

  async connectedCallback() {
    if (this._uruchomiony) return;
    this._uruchomiony = true;

    const korzen = this.shadowRoot || this.attachShadow({ mode: 'open' });
    korzen.innerHTML = `<style>${STYL}</style><div class="historia"></div>`;
    const pojemnik = korzen.querySelector('.historia');

    try {
      const adresTresci = new URL(this.getAttribute('src') || 'historia.json', document.baseURI);
      const odp = await fetch(adresTresci);
      if (!odp.ok) throw new Error('Nie udało się wczytać pliku z treścią: ' + adresTresci.href);
      const tresc = await odp.json();
      const gsap = await dajGsap();

      const dodaneStyle = new Set();
      for (const scena of tresc.sceny || []) {
        const wczytajTyp = TYPY_SCEN[scena.typ];
        if (!wczytajTyp) throw new Error('Nieznany typ sceny: ' + scena.typ);
        const modul = await wczytajTyp();
        if (modul.styl && !dodaneStyle.has(scena.typ)) {
          const st = document.createElement('style');
          st.textContent = modul.styl;
          korzen.appendChild(st);
          dodaneStyle.add(scena.typ);
        }
        const gotowa = modul.default(scena, {
          gsap,
          bazaTresci: new URL('.', adresTresci),   // ścieżki do klatek / obrazów liczone od pliku historia.json
          host: this,
        });
        pojemnik.appendChild(gotowa.element);
        this._sceny.push(gotowa);
        if (gotowa.start) gotowa.start();
      }
    } catch (e) {
      console.error('[sluxer-historia]', e);
      pojemnik.innerHTML = '<div class="blad">Moduł nie mógł się wczytać. Szczegóły są w konsoli przeglądarki.</div>';
    }
  }

  disconnectedCallback() {
    // element zdjęty ze strony (np. przeniesiony przez edytor): sprzątamy; po ponownym wstawieniu zbuduje się od nowa
    for (const s of this._sceny) if (s.zniszcz) s.zniszcz();
    this._sceny = [];
    this._uruchomiony = false;
  }
}

if (!customElements.get('sluxer-historia')) customElements.define('sluxer-historia', SluxerHistoria);
