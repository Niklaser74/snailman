# Supabase för Snailman

Samma projekt som resten av serien: **`snails`** (`lygpfumngyebxoqqncet`,
eu-north-1, Knackpot AB). Konton, push-prenumerationer och VAPID-nyckeln
delas; Snailman har eget tabellprefix `snailman_` och en egen edge-funktion.
Projektfakta, auth-inställningar och hemligheter beskrivs i
snailmageddon-repots `supabase/README.md`.

## Vad som är vårt

| Objekt | Vad |
| --- | --- |
| `snailman_daily` | Dagens labyrint: en rad per spelare och dag (Stockholmstid). Bästa resultatet med dess inspelning, antal försök. Städas efter 60 dagar |
| `snailman_records` | En rad per spelare: bästa resultatet någonsin i Dagens labyrint, med inspelning. Städas aldrig |
| `snailman_contests` | En Snigelpost-turnering: värd, 1/3/5 omgångar, 2–8 platser, ett seed per omgång, regelversion, `open`/`finished`, deadline 7 dagar |
| `snailman_contest_players` | Deltagare med namn; `hidden` när någon tagit bort en avslutad turnering ur sin lista |
| `snailman_contest_runs` | En omgång per spelare: poäng, nivå, ticks, inspelning. Främmande nyckel mot deltagaren, så att lämna tar med omgångarna |
| `snailman_daily_submit/daily_board/records_board` | topplistorna |
| `snailman_contest_create/join/get/my_contests/submit/run/close/leave` | turneringarna |
| `snailman_contest_settle` (intern) | avslutar när alla platser är fyllda och alla spelat allt, eller vid deadline. Anropas av get, join, submit och listan, så att ingen behöver vänta på cron |
| `snailman_cleanup` + cron `snailman_cleanup` (`41 * * * *`) | deadline, avslutade turneringar efter 90 dagar, dagsrader efter 60 |
| edge-funktion `snailman-notify` | push till de andra i en turnering: någon gick med, någon spelade (din tur, eller "X slog dig på omgång 2"), slutplacering. Skickar via `snails_push_subscriptions` och `snails_vapid_private` |

Alla klientfunktioner är `security definer` med kontroll på `auth.uid()` och
beviljade bara till `authenticated`; tabellerna har RLS utan policyer, så
klienten når dem aldrig direkt.

## Inspelningar och regelversion

En omgång är ett seed plus inspelningen `[[tick, 'u'|'d'|'l'|'r'], …]`
(`js/engine.js`). Servern sparar den med poängen men spelar inte upp den;
klienterna gör det när en omgång ses i repris, och säger till om reprisen inte
kommer fram till samma poäng och ticks. `test/engine.test.mjs` låser att en
ärlig runda spelas upp exakt, även efter spara/fortsätt.

`snailman_rules_ok` säger vilka regelversioner servern tar emot. Ändras något
som påverkar vad en inspelning spelas upp till (tempo, poäng, labyrinter,
jägarnas beteende): höj `RULES_VERSION` i `js/engine.js`, lägg den i
`SUPPORTED_RULES` om gamla repriser fortfarande kan spelas, och i en ny
migration som ersätter `snailman_rules_ok`. `test/online.test.mjs` larmar om
servern inte tar emot den version spelet spelar.

## Rättvisa

- Andras inspelningar av en omgång syns först när man spelat samma omgång själv
  (eller när turneringen är slut) — annars kunde man lära sig labyrinten och
  jägarnas drag innan.
- Omgångarna spelas i ordning, en gång var. En påbörjad omgång sparas lokalt och
  återupptas; den som rensar webbläsaren kan börja om. Det är en känd lucka.
- Dagens labyrint tillåter många försök; bästa räknas.

## Tester

`tests/snailman.sql` provar dagslista, rekord, turneringens hela kedja,
behörighet för inspelningar, fulla turneringar, lämna, stänga och deadline med
tre påhittade spelare. Kör den med MCP `execute_sql`; den rullar alltid tillbaka
och slutar med ett avsiktligt fel som börjar med `ALL OK` när allt gick igenom.

## Migrationer

`migrations/*.sql` i filnamnsordning. Applicera med Supabase MCP
(`apply_migration`) eller SQL-editorn. **Kör inte `supabase db push` från
snailmageddon-repot** utan att först lägga till de här filerna i dess historik.

## Deploy av funktionen

```bash
supabase functions deploy snailman-notify --project-ref lygpfumngyebxoqqncet
```

eller Supabase MCP `deploy_edge_function` med `index.ts`, `webpush.js` (kopia
av snailmageddons) och `standings.js` (kopia av spelets `js/standings.js` —
`test/online.test.mjs` kräver att de är identiska). `verify_jwt` på.

## Kontot är seriens

`js/account.js` är seriens delade Supabase-klient, ägd av hubben
(`Niklaser74.github.io`) och vendorad hit med `npm run sync:account` — redigera
den aldrig här. `js/supa.js` re-exporterar den. Sessionen ligger under
`snails.session`; det är det enda undantaget från regeln att nycklar prefixas
`snailman.`.
