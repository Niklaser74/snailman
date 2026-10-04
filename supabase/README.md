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
| `snailman_daily_leader`, `snailman_contest_stats` | **de enda som är öppna för anon**: dagens ledares namn och poäng + antal spelare, och antal pågående turneringar och veckans omgångar (bara siffror), för hubbens kort (som aldrig skapar konton) |
| `snailman_contest_mine_brief` | hubbens sammanfattning av de egna pågående turneringarna: nästa omgång (null = väntar på de andra), antal spelare, deadline. Hubben anropar den bara med en session webbläsaren redan har |
| `snailman_contest_create/join/get/my_contests/submit/run/close/leave` | turneringarna |
| `snailman_contest_settle` (intern) | avslutar när alla platser är fyllda och alla spelat allt, eller vid deadline. Anropas av get, join, submit och listan, så att ingen behöver vänta på cron |
| `snailman_cleanup` + cron `snailman_cleanup` (`41 * * * *`) | deadline, avslutade turneringar efter 90 dagar, dagsrader efter 60 |
| edge-funktion `snailman-notify` | push till de andra i en turnering: någon gick med, någon spelade (din tur, eller "X slog dig på omgång 2"), slutplacering. Skickar via `snailman_push_subscriptions` och `snails_vapid_private` |
| `snailman_push_subscriptions`, `snailman_save_push/remove_push` | Snailmans egna push-prenumerationer (som Snigelkrattan och Snail Story). Den delade `snails_push_subscriptions` saknar spelkolumn, så notiser läckte mellan spelen. `snailman_save_push` tar också bort samma endpoint ur den delade tabellen; `js/push.js` anropar den vid start, så gamla prenumerationer flyttas när Snailman öppnas |

Alla klientfunktioner är `security definer`. Alla utom de två anon-funktionerna kontrollerar `auth.uid()` och är
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

## Radering

Alla `snailman_*`-tabeller med ett spelar-id har en främmande nyckel mot
`auth.users` med `on delete cascade` (`20261002150000_snailman_account_cascade.sql`).
Ett raderat konto tar med sig sina dagsrader, sitt rekord och sina
turneringsomgångar; en turnering det var värd för raderas i sin helhet.
Samma sak gäller seriens övriga spel, se snailmageddon-repots `supabase/README.md`.
Ny tabell med ett spelar-id ska ha samma nyckel. Kontroll att ingen saknas:

```sql
with cols as (
  select c.table_name, c.column_name from information_schema.columns c
  join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
  where c.table_schema = 'public' and c.data_type = 'uuid'
    and c.column_name not in ('id', 'contest', 'series_id', 'current_match', 'tourney_id', 'match_id', 'client_id', 'session_id', 'rematch')
), fks as (
  select cl.relname as table_name, a.attname as column_name
  from pg_constraint con join pg_class cl on cl.oid = con.conrelid join pg_namespace n on n.oid = cl.relnamespace
  join lateral unnest(con.conkey) k(attnum) on true join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.attnum
  where con.contype = 'f' and n.nspname = 'public'
)
select count(*) filter (where f.table_name is null) as missing,
  string_agg(c.table_name || '.' || c.column_name, ', ') filter (where f.table_name is null) as which
from cols c left join fks f using (table_name, column_name);
```

## Namn

Namnet på topplistor och i turneringar är kontots: profilnamnet i
`snails_profiles` (snails.se/account/) när spelaren valt ett, annars det namn
spelet skickade. Standardnamnet "Snäcka" räknas inte som ett val. Regeln finns
på ett ställe, `snailman_name()` (`20261004090000_snailman_profile_names.sql`).
Det lagrade namnet hålls rätt i stället för att slås upp vid varje läsning,
eftersom topplistorna, hubbens ledare, turneringssammanfattningen och
push-funktionen alla läser det: vid varje skrivning, och av triggern
`snailman_profile_renamed` när profilen byter namn. Ett namn som skrivs i
spelets Snigelpost-ruta sparas på kontot (`net.setName`).
