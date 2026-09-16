# Snailman

Pac-Man med en snigel. Ät all sallad i häcklabyrinten medan trädgårdens
jägare — koltrasten, igelkotten, trädgårdsmästaren och löpankan — jagar dig i
snigelfart. Slemspåret bakom dig är blött i tio sekunder, och du får inte krypa
i ditt eget blöta slem: ingen backning, ingen genväg tillbaka. Jägarna halkar
på det. Kaffebönan gör dig snabb en stund, låter dig korsa slemmet, och skrämmer
jägarna hem till komposten.

Fjärde spelet i [snigelserien](https://snails.se) från Knackpot. Live på
[snails.se/snailman/](https://snails.se/snailman/).

## Kör

| Vad | Kommando |
| --- | --- |
| Lokal server | `npm start` → http://localhost:8084/ |
| Tester | `npm test` |
| Uppdatera `js/game/` från Snäckmageddon | `npm run sync:game` |
| Ikoner | `npm run icons` |
| OG-bild | `npm run og:image` (lånar hubbens Playwright) |

Byggstegsfritt: ren HTML, CSS och ES-moduler, inga beroenden. Hela repot
deployas till GitHub Pages vid push till `main`.

## Struktur

```
index.html            enda sidan: labyrinten, HUD, styrkors, meny, hjälp, game over
js/maze.js            två labyrinter i ASCII och parsningen av dem
js/mover.js           rörelse på rutnät, delad av snigel och jägare
js/engine.js          spelets tillstånd och fasta tidssteg — körs i Node, inget DOM
js/hunters.js         jägarnas AI: de fyra temperamenten från arkadspelet
js/sprites.js         jägarna och föremålen
js/view.js            labyrinten på canvas
js/input.js           svep, styrkors och tangentbord
js/main.js            meny, loop, spara, ljud, PWA
js/game/              kopior från snailmageddon: snigelritare, palett, ljud, RNG
test/                 paths, rules, maze, engine, sw
```

## Så hänger det ihop

Snigeln och jägarna rör sig på samma rutnät (`mover.js`): en ruta, en riktning
och hur långt på väg man är till nästa. Kurs kan bara ändras i rutmitten, utom
vändning. Slem läggs på rutan snigeln anländer till, så rutan under den är
alltid blöt — därför är vändning omöjlig utan kaffe, och regeln behöver ingen
specialkod. Jägarna är arkadspelets fyra: en jagar din ruta, en siktar fyra
rutor framför dig, en flankerar med hjälp av den första, och en är modig långt
bort och blyg nära. De byter mellan spridning och jakt på ett schema, blir
rädda av kaffebönan och springer hem som bara ögon när du rör dem.

## Sökvägar och origin

Spelet ligger på `snails.se/snailman/`; hubben äger roten. Därför bara
relativa sökvägar, egen cache-prefix (`snailman-`), egna `localStorage`-nycklar
(`snailman.*`) och eget manifest-id (`/snailman/`).

## Nästa steg

- Speltesta vidare: snigelns fart och jägarnas tempo (slemtiden är satt till 6 s efter speltest).
- Fler labyrinter — `test/maze.test.mjs` godkänner dem.
- Leaderboard i Supabase `snails` (prefix `snailman_`), delade konton med de andra spelen.
