# Moduły strony Sluxer

Każdy moduł to osobny folder z plikiem `historia.json` (treść, ustawienia, ścieżki do obrazów). Kod wspólny dla wszystkich modułów leży w `silnik/`. Zmiana treści modułu to zmiana jego `historia.json` albo podmiana obrazów, bez przebudowy i bez ruszania kodu.

```
moduly/
  silnik/              kod wspólny (nie edytować przy zwykłych zmianach treści)
    sluxer-historia.js   komponent <sluxer-historia>
    sceny/               typy scen (np. ems-bohater.js)
    vendor/gsap.min.js   biblioteka animacji GSAP
  ems/                 moduł 1: EMS na środku ekranu
    historia.json        treść i ustawienia modułu
    klatki/              obrazy animacji (1280 i 1920 px)
  strona.json          lista modułów na stronie testowej (kolejność, włącz/wyłącz)
  index.html           strona testowa składana z listy w strona.json
  .htaccess            ustawienia serwera home.pl (dostęp z WordPressa, pamięć podręczna)
```

## Jak zmienić moduł

1. Edytuj `moduly/<moduł>/historia.json` (np. tekst napisu, czasy animacji) albo podmień obrazy w jego folderze.
2. Zatwierdź zmiany i wyślij na GitHuba (`git push`).
3. GitHub sam wgra pliki na serwer home.pl (zakładka **Actions** → „Wgraj moduły na home.pl”). Po ok. minucie zmiana jest na stronie testowej i w WordPressie.

## Jak dodać nowy moduł

1. Utwórz folder `moduly/<nazwa>/` z własnym `historia.json` i obrazami.
2. Jeśli moduł potrzebuje nowego typu sceny, dodaj plik w `silnik/sceny/` i dopisz go w `TYPY_SCEN` w `silnik/sluxer-historia.js`.
3. Dopisz moduł w `moduly/strona.json` (kolejność wpisów = kolejność na stronie testowej).
4. Wyślij na GitHuba, a wgranie na serwer zrobi się samo.

## Jak wstawić moduł do WordPressa

W edytorze strony WordPress dodaj blok **„Własny HTML”** (w Elementorze widżet **HTML**) i wklej:

```html
<script type="module" src="https://ADRES-SERWERA/moduly/silnik/sluxer-historia.js"></script>
<sluxer-historia src="https://ADRES-SERWERA/moduly/ems/historia.json"></sluxer-historia>
```

`ADRES-SERWERA` to domena, pod którą działa folder `/moduly` na home.pl. Kolejny moduł na tej samej stronie to kolejna linijka `<sluxer-historia src="…/moduly/<nazwa>/historia.json">` (skrypt wystarczy wkleić raz). Moduł ma własne style zamknięte w sobie, więc motyw WordPressa ich nie popsuje.

## Strona testowa

`https://ADRES-SERWERA/moduly/` pokazuje wszystkie włączone moduły z `strona.json`. Dopisek `?telefon=1` pokazuje na komputerze zachowanie z telefonu.

## Wgrywanie na home.pl

Robi to workflow `.github/workflows/wgraj-moduly.yml` przy każdym wysłaniu zmian w folderze `moduly/` na gałąź `main`. Wgrywa tylko folder `moduly/` do `/moduly` na serwerze. Hasło FTP jest w sekrecie repozytorium `FTP_HASLO`. Ręczne uruchomienie: Actions → „Wgraj moduły na home.pl” → Run workflow.

Obrazy animacji EMS powstają w Blenderze (`modul-ems/blender/` na komputerze projektu). Po nowym renderze skopiuj gotowe klatki WebP do `moduly/ems/klatki/`.
