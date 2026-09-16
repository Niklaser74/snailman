# Snailman

Fjärde spelet i snigelserien på snails.se. Pac-Man med en snigel: jägarna
(koltrast, igelkott, trädgårdsmästare, löpanka) jagar i snigelfart, och
slemspåret bakom snigeln är blött en stund — man får inte korsa sitt eget.
Kaffebönan är kraftpillret.

Byggstegsfritt PWA: ES-moduler, Canvas, inga npm-beroenden. Bor på
`snails.se/snailman/` under hubben (`Niklaser74/Niklaser74.github.io`).

## Kör

| Vad | Kommando |
| --- | --- |
| Lokal server | `npm start` → http://localhost:8084/ |
| Tester | `npm test` |
| Hämta renderare från Snäckmageddon | `npm run sync:game` (default `../dev-snailmageddon`) |
| Ikoner (SVG → PNG) | `npm run icons` (lånar hubbens Playwright) |
| OG-bild | `npm run og:image` → `icons/og-1200x630.png` |
| Produktionslayout | i hubbrepot: `PORT=8081 node scripts/serve.mjs --mount /snailman=../dev-snailman` |

## Struktur

```
js/maze.js      ASCII-labyrinterna, parsning, tunnlar, komposten (jägarnas bo)
js/mover.js     rutnätsrörelse: ruta + riktning + andel, vändning, tunnelomlopp
js/engine.js    Game: state, step(dt), slem, poäng, liv, nivåer. Noll DOM — körs i Node
js/hunters.js   de fyra jägarnas AI (scatter/chase/frightened/home), bo och släpp
js/sprites.js   jägarna, sallad, kaffeböna, jordgubbe — canvas-paths
js/view.js      häckarna (ritas en gång), slem, föremål, snigeln via drawSnail, effekter
js/input.js     svep på planen, styrkors, tangentbord → en dir()-callback
js/main.js      meny, loop, HUD, banner, spara/fortsätt, ljud, PWA
js/i18n.js      sv/en
js/game/        KOPIOR från snailmageddon — rör aldrig, kör sync:game
test/           handrullade tester utan ramverk, node:assert
```

## Konventioner

- **Bara relativa sökvägar.** Allt på snails.se delar origin; `test/paths.test.mjs` vaktar.
  Enda absoluta är manifestets `id: "/snailman/"`.
- **Egen namnrymd:** cache `snailman-vN` i `sw.js`, `localStorage` `snailman.*`, manifest-id `/snailman/`.
- **Nya JS-filer läggs i `sw.js`** — `test/sw.test.mjs` säger till.
- **`engine.js`, `hunters.js`, `maze.js`, `mover.js` importerar aldrig DOM, canvas eller `game/audio.js`.**
  Det är det som gör `test/engine.test.mjs` möjlig. Ljud och partiklar läses ur `game.events`.
- **Slemregeln finns på ett ställe:** `Game.snailCanEnter`. Slem läggs när snigeln *anländer* till en ruta
  (`snailArrive`), så rutan man står på är alltid blöt och vändning aldrig möjlig utan kaffe.
- **Labyrinter utan återvändsgränder.** `test/maze.test.mjs` vägrar en labyrint med återvändsgränd,
  osymmetri eller onåbara rutor. Nya labyrinter: lägg till i `MAZES`, kör testet.
- All UI-text via `t()`, svenska och engelska samtidigt; `test/rules.test.mjs` kräver nyckelparitet.
- Svenska först i HTML, engelska via `data-i18n`.
- Tempo och balans är konstanter överst i `engine.js` och `hunters.js` — ändra där, inte inline.
- `docs-vault/` (Obsidian) och `.claude/` committas aldrig.

## Rör inte

- `js/game/*` — kopior. Ändra uppströms i snailmageddon och kör `npm run sync:game`.
- `manifest.id` — appens identitet på den delade originen.

## Innan du är klar

- `npm test` grönt.
- Bumpa `VERSION` i `sw.js` och `APP_VERSION` i `js/config.js` när något som skeppas ändrats.
- Push till `main` deployar direkt via Pages — titta på `npm start` först.
