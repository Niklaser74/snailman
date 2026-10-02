// Push notifications for Snailman's Snigelpost tournaments. Sibling of
// Snäckschack's chess-notify-turn: same Vault key, but Snailman's own
// subscription table (snailman_push_subscriptions), so a notice never reaches
// another game's service worker on snails.se; its own tables and texts.
// Called by the client right after it has joined, played a round or ended
// the tournament. The gateway verifies the caller's JWT; this function checks
// that the caller is in the tournament and only ever notifies the others.
//
// standings.js is a copy of the game's js/standings.js (test/online.test.mjs
// keeps them identical), so the placing in a notification is the one the
// players see in the game.
import { sendPush, b64url, b64urlDecode } from './webpush.js';
import { standings } from './standings.js';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SITE = 'https://snails.se'; // also the VAPID subject: keep it the origin
const GAME = `${SITE}/snailman`;
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const rest = (path: string, init: RequestInit = {}) =>
  fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });

const sv = {
  title: 'Snailman',
  joined: (n: string, k: number, max: number) => `${n} gick med i turneringen (${k} av ${max}).`,
  yourTurn: (n: string, s: number, r: number) => `${n} fick ${s} poäng på omgång ${r}. Din tur!`,
  beaten: (n: string, s: number, mine: number, r: number) => `${n} slog dig på omgång ${r}: ${s} mot ${mine}.`,
  finished: (place: number, of: number) => place === 1 ? `Turneringen är slut. Du vann!` : `Turneringen är slut. Du kom ${place}:a av ${of}.`,
};
const en = {
  title: 'Snailman',
  joined: (n: string, k: number, max: number) => `${n} joined the tournament (${k} of ${max}).`,
  yourTurn: (n: string, s: number, r: number) => `${n} scored ${s} in round ${r}. Your turn!`,
  beaten: (n: string, s: number, mine: number, r: number) => `${n} beat you in round ${r}: ${s} to ${mine}.`,
  finished: (place: number, of: number) => place === 1 ? `The tournament is over. You won!` : `The tournament is over. You came ${ordinal(place)} of ${of}.`,
};
function ordinal(n: number) { return n + (n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th'); }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const token = (req.headers.get('authorization') || '').replace(/^Bearer /i, '');
    const claims = JSON.parse(new TextDecoder().decode(b64urlDecode(token.split('.')[1] || '')));
    const uid = claims.sub as string;
    if (!uid) return json({ error: 'not signed in' }, 401);
    const { contest_id, event, round } = await req.json();
    if (typeof contest_id !== 'string' || !/^[0-9a-f-]{36}$/.test(contest_id)) return json({ error: 'contest_id required' }, 400);
    if (!['joined', 'played', 'closed'].includes(event)) return json({ error: 'unknown event' }, 400);

    const id = encodeURIComponent(contest_id);
    const c = (await (await rest(`snailman_contests?id=eq.${id}&select=id,rounds,max_players,status`)).json())[0];
    if (!c) return json({ error: 'no such contest' }, 404);
    const players = await (await rest(`snailman_contest_players?contest=eq.${id}&select=user_id,name,joined_at&order=joined_at`)).json();
    if (!players.some((p: { user_id: string }) => p.user_id === uid)) return json({ error: 'not your contest' }, 403);
    const runs = await (await rest(`snailman_contest_runs?contest=eq.${id}&select=user_id,round,score`)).json();
    const others = players.filter((p: { user_id: string }) => p.user_id !== uid);
    if (!others.length) return json({ sent: 0, reason: 'nobody else yet' });

    const me = players.find((p: { user_id: string }) => p.user_id === uid);
    const table = c.status === 'finished' ? standings({ ...c, players, runs }) : null;
    const scoreOf = (u: string, r: number) => runs.find((x: { user_id: string; round: number }) => x.user_id === u && x.round === r)?.score;

    // what each of the others should be told, if anything
    const messages = new Map<string, (t: typeof sv) => string>();
    for (const p of others) {
      if (table) {
        const row = table.find((x) => x.user_id === p.user_id);
        if (row) messages.set(p.user_id, (t) => t.finished(row.place, table.length));
        continue;
      }
      if (event === 'joined') messages.set(p.user_id, (t) => t.joined(me.name, players.length, c.max_players));
      else if (event === 'played' && Number.isInteger(round)) {
        const mine = scoreOf(uid, round);
        if (mine == null) continue;
        const theirs = scoreOf(p.user_id, round);
        if (theirs == null) messages.set(p.user_id, (t) => t.yourTurn(me.name, mine, round));
        else if (mine > theirs) messages.set(p.user_id, (t) => t.beaten(me.name, mine, theirs, round));
      }
    }
    if (!messages.size) return json({ sent: 0, reason: 'nothing to tell' });

    const ids = [...messages.keys()].map(encodeURIComponent).join(',');
    const subs = await (await rest(`snailman_push_subscriptions?user_id=in.(${ids})&select=user_id,endpoint,p256dh,auth,lang`)).json();
    if (!subs.length) return json({ sent: 0, reason: 'no subscriptions' });
    const jwkText = await (await rest('rpc/snails_vapid_private', { method: 'POST', body: '{}' })).json();
    if (!jwkText) return json({ error: 'vapid key missing' }, 500);
    const jwk = typeof jwkText === 'string' ? JSON.parse(jwkText) : jwkText;
    const vapid = { publicKey: b64url(new Uint8Array([4, ...b64urlDecode(jwk.x), ...b64urlDecode(jwk.y)])), jwk };

    let sent = 0;
    const dead: string[] = [];
    for (const s of subs) {
      const t = s.lang === 'en' ? en : sv;
      const body = messages.get(s.user_id)?.(t);
      if (!body) continue;
      const payload = { title: t.title, body, url: `${GAME}/?contest=${contest_id}`, tag: `snailman-contest-${contest_id}` };
      const status = await sendPush({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, vapid, SITE).catch(() => 0);
      if (status === 201 || status === 200) sent++;
      else if (status === 404 || status === 410) dead.push(s.endpoint);
    }
    for (const e of dead) await rest(`snailman_push_subscriptions?endpoint=eq.${encodeURIComponent(e)}`, { method: 'DELETE' });
    return json({ sent, dead: dead.length });
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
