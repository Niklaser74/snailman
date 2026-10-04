// The online half of Snailman: Dagens labyrint, the record list and Snigelpost
// tournaments. Thin wrappers around the snailman_* functions in Supabase
// (supabase/migrations) plus small pure helpers. The account is the series'
// shared one (supa.js → account.js); nothing here runs until the player opens
// a board, plays the day's maze or opens a tournament.
import { online } from './supa.js';
import { RULES_VERSION } from './engine.js';

// ---------- pure helpers (tested in Node) ----------

export function cleanName(s) {
  // eslint-disable-next-line no-control-regex
  return String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 24);
}

// The calendar day in Stockholm, YYYY-MM-DD: the day's maze changes at
// midnight Swedish time, like the hub's game of the day.
export function dayKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Stockholm', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

// The day's maze: everyone gets the same seed from the date (FNV-1a).
export function dailySeed(day) {
  let h = 0x811c9dc5;
  for (const ch of 'snailman:' + day) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0;
  return (h % 2147483646) + 1;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isContestId = (s) => UUID_RE.test(String(s ?? ''));

// this page with ?contest=ID (or ?daily=1), so it works at any mount point
export function inviteLink(id, loc = globalThis.location) {
  return `${loc.origin}${loc.pathname}?contest=${encodeURIComponent(id)}`;
}

// Server messages → i18n keys; anything unexpected is a network problem to the player.
export function errorKey(e) {
  const m = String(e?.message || e || '');
  if (m.includes('contest is full')) return 'err.full';
  if (m.includes('contest is finished')) return 'err.finished';
  if (m.includes('no such contest')) return 'err.noSuch';
  if (m.includes('round out of order')) return 'err.played';
  if (m.includes('rules version')) return 'err.update';
  if (m.includes('end it before leaving')) return 'err.hostLeave';
  if (m.includes('play the round first')) return 'err.playFirst';
  if (m.includes('not a playable day')) return 'err.oldDay';
  if (/anonymous|signup|sign-in|disabled/i.test(m)) return 'err.disabled';
  return 'err.net';
}
// A failure worth trying again later (the network), as opposed to a refusal.
export const retryable = (e) => errorKey(e) === 'err.net';

// ---------- the server ----------

const ls = {
  get(k, d) { try { const v = localStorage.getItem('snailman.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('snailman.' + k, JSON.stringify(v)); } catch { /* private mode */ } },
  del(k) { try { localStorage.removeItem('snailman.' + k); } catch { /* ignore */ } },
};

const runArgs = (run) => ({
  p_score: run.score, p_level: run.level, p_ticks: run.ticks, p_inputs: run.inputs, p_rules_version: run.rulesVersion ?? RULES_VERSION,
});

export const net = {
  available: () => online.available(),
  signedIn: () => online.signedIn(),
  userId: () => online.userId(),

  // The series profile name, if this browser already has an account — never
  // creates one. "Snäcka" is the default the profile gets for an empty name,
  // not a choice (the server's snailman_profile_name says the same).
  async profileName() {
    if (!online.signedIn()) return '';
    try { const n = cleanName((await online.rpc('snails_profile'))?.name); return n === 'Snäcka' ? '' : n; } catch { return ''; }
  },
  // A name typed in the game is the account's name: the server shows the
  // profile name whenever there is one, so saving it anywhere else would be
  // ignored. Keeps the look as it is. Only with an account — never creates one.
  async setName(name) {
    if (!online.signedIn()) return false;
    const p = await online.rpc('snails_profile');
    await online.rpc('snails_profile_set', { p_name: cleanName(name), p_look: p?.look || {} });
    return true;
  },

  daily: {
    board: (day) => online.rpc('snailman_daily_board', { p_day: day }),
    records: () => online.rpc('snailman_records_board'),
    submit: (day, name, run) => online.rpc('snailman_daily_submit', { p_day: day, p_name: cleanName(name), ...runArgs(run) }),
  },

  contest: {
    create: (name, rounds, maxPlayers) => online.rpc('snailman_contest_create', { p_name: cleanName(name), p_rounds: rounds, p_max_players: maxPlayers, p_rules_version: RULES_VERSION }),
    join: (id, name) => online.rpc('snailman_contest_join', { p_contest: id, p_name: cleanName(name) }),
    get: (id) => online.rpc('snailman_contest_get', { p_contest: id }),
    mine: () => online.rpc('snailman_my_contests'),
    submit: (id, round, run) => online.rpc('snailman_contest_submit', { p_contest: id, p_round: round, ...runArgs(run) }),
    run: (id, userId, round) => online.rpc('snailman_contest_run', { p_contest: id, p_user: userId, p_round: round }),
    close: (id) => online.rpc('snailman_contest_close', { p_contest: id }),
    leave: (id) => online.rpc('snailman_contest_leave', { p_contest: id }),
  },

  // A finished run that could not be sent (no network) waits here and goes
  // with the next flush. Keyed by where it belongs, so a daily attempt and a
  // tournament round never overwrite each other; a tournament round is never
  // dropped, a daily one only for a better one the same day.
  queue(kind, key, payload) {
    const all = ls.get('pending', {});
    const id = `${kind}:${key}`;
    if (kind === 'daily' && all[id] && all[id].run.score >= payload.run.score) return;
    all[id] = payload;
    ls.set('pending', all);
  },
  pending() { return ls.get('pending', {}); },
  // Sends what is waiting. Returns what went through ({ id, p, sent: true }) or
  // was refused for good ({ sent: false }): either way it is no longer waiting.
  async flush() {
    const all = ls.get('pending', {});
    const done = [];
    for (const [id, p] of Object.entries(all)) {
      try {
        if (id.startsWith('daily:')) await net.daily.submit(p.day, p.name, p.run);
        else await net.contest.submit(p.contest, p.round, p.run);
        done.push({ id, p, sent: true });
      } catch (e) { if (!retryable(e)) done.push({ id, p, sent: false }); }
    }
    if (done.length) {
      const left = ls.get('pending', {});
      for (const d of done) delete left[d.id];
      ls.set('pending', left);
    }
    return done;
  },
};
