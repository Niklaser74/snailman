// Tournament standings, the same in the game and in the push function
// (supabase/functions/snailman-notify/standings.js is a copy; test/online.test.mjs
// checks they are identical). Plain JS, no imports, no DOM.
//
// Each round is ranked on its own: a player gets one point for every other
// player with a lower score in that round, and half a point for every tie.
// So with four players the best run of a round is worth 3 and the worst 0,
// whatever the scores were — one huge lucky run cannot buy the whole
// tournament. Total points decide; total score breaks a tie.
//
// While the tournament runs, a round only counts the players who have played
// it. When it is finished, a round somebody never played counts as 0 for them.
export function standings(c) {
  const players = c.players || [];
  const runs = c.runs || [];
  const finished = c.status === 'finished';
  const score = new Map(); // `${user}:${round}` -> score
  for (const r of runs) score.set(`${r.user_id}:${r.round}`, r.score);
  const rows = players.map((p) => ({ user_id: p.user_id, name: p.name, rounds: [], points: 0, total: 0, played: 0 }));
  for (let round = 1; round <= c.rounds; round++) {
    const entries = rows.map((row) => {
      const s = score.get(`${row.user_id}:${round}`);
      return { row, s: s == null ? (finished ? 0 : null) : s, played: s != null };
    });
    const counted = entries.filter((e) => e.s != null);
    for (const e of entries) {
      e.row.rounds.push(e.played ? e.s : null);
      if (e.played) { e.row.total += e.s; e.row.played++; }
      if (e.s == null) continue;
      for (const o of counted) {
        if (o === e) continue;
        if (o.s < e.s) e.row.points += 1;
        else if (o.s === e.s) e.row.points += 0.5;
      }
    }
  }
  rows.sort((a, b) => b.points - a.points || b.total - a.total || a.name.localeCompare(b.name));
  let place = 0;
  rows.forEach((r, i) => {
    if (i === 0 || r.points !== rows[i - 1].points || r.total !== rows[i - 1].total) place = i + 1;
    r.place = place;
  });
  return rows;
}

// The next round this player has to play, or null (not in it, all played, or over).
export function nextRound(c, userId) {
  if (!c || c.status === 'finished') return null;
  if (!(c.players || []).some((p) => p.user_id === userId)) return null;
  const played = (c.runs || []).filter((r) => r.user_id === userId).length;
  return played < c.rounds ? played + 1 : null;
}
