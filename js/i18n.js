// UI strings in Swedish and English. Same pattern as the other snail games: t(key, params).
export const LANGS = { sv: 'Svenska', en: 'English' };

const dict = {
  sv: {
    'app.name': 'Snailman',
    'app.tagline': 'Pac-Man där jägarna jagar i snigelfart — och du inte får korsa ditt eget slem.',
    'app.by': 'En <a href="https://knackpot.se" target="_blank" rel="noopener">Knackpot</a>-produkt',
    'app.hub': 'Fler snigelspel på snails.se',
    'menu.start': 'Nytt spel', 'menu.continue': 'Fortsätt spelet', 'menu.help': 'Så spelar du', 'menu.install': 'Installera app',
    'menu.offline': 'Spelet är sparat för offline-spel.',
    'hud.score': 'Poäng', 'hud.best': 'Rekord', 'hud.level': 'Nivå', 'hud.lives': 'Liv',
    'aria.up': 'Upp', 'aria.down': 'Ner', 'aria.left': 'Vänster', 'aria.right': 'Höger',
    'aria.mute': 'Ljud av', 'aria.unmute': 'Ljud på', 'aria.menu': 'Meny', 'aria.maze': 'Labyrinten',
    'banner.ready': 'Svep för att krypa', 'banner.readyAgain': 'Redo?', 'banner.clear': 'Salladen är slut!', 'banner.level': 'Nivå {level}',
    'banner.caught': 'Aj.', 'banner.life': 'Extra liv!',
    'over.title': 'Uppäten',
    'over.by.blackbird': 'Koltrasten tog dig.', 'over.by.hedgehog': 'Igelkotten tog dig.', 'over.by.gardener': 'Trädgårdsmästaren saltade dig.', 'over.by.duck': 'Löpankan tog dig.',
    'over.score': '{score} poäng', 'over.level': 'Nådde nivå {level}', 'over.best': 'Rekord: {best}', 'over.newBest': 'Nytt rekord!',
    'over.again': 'Spela igen', 'over.menu': 'Till menyn',
    'help.title': 'Så spelar du',
    'help.1': '<b>Styr</b> genom att svepa på labyrinten, med korset eller med piltangenterna. Snigeln kryper tills den möter en häck och svänger i nästa korsning när du säger till.',
    'help.2': '<b>Slemmet.</b> Varje ruta du lämnar är blöt en stund, och du kan inte krypa i ditt eget blöta slem. Ingen backning, ingen genväg tillbaka. Planera vägen så att du inte snärjer in dig själv — fastnar du får du vänta tills det torkar.',
    'help.3': '<b>Jägarna.</b> Koltrasten jagar dig rakt på. Igelkotten siktar framför dig. Trädgårdsmästaren går på flanken. Löpankan är modig på avstånd och blyg på nära håll. Alla halkar på slem, och i det färska precis bakom dig fastnar de en stund — ett spår mellan dig och dem köper tid.',
    'help.4': '<b>Kaffebönan.</b> Några sekunder är du snabb, får korsa ditt eget slem, och jägarna flyr. Rör dem så springer de hem till komposten: 200, 400, 800, 1600.',
    'help.5': '<b>Ät all sallad</b> så börjar nästa nivå. Jordgubben dyker upp två gånger per nivå. Tre liv, ett extra vid 10 000. Spelet sparas när du lämnar.',
    'help.close': 'Stäng',
    'help.7': '<b>Vad som sparas.</b> Dagens labyrint och Snigelpost använder seriens anonyma konto. Ditt namn, dina resultat och inspelningen av varje omgång sparas: dagens resultat i 60 dagar, turneringar i 90 dagar efter att de slutat, ditt rekord tills du ber oss radera det. <a href="https://snails.se/privacy.html">Integritetspolicy</a>.',
    'app.privacy': 'Integritet',
    'menu.daily': 'Dagens labyrint', 'menu.post': 'Snigelpost', 'menu.board': 'Topplista',
    'menu.dailyBest': 'Idag: {score} poäng, plats {rank} av {players}.', 'menu.dailyNone': 'Samma labyrint för alla idag. Bästa försöket räknas.',
    'common.close': 'Stäng', 'aria.close': 'Stäng',
    'hud.target': 'Att slå', 'hud.daily': 'Dagens',
    'help.6': '<b>Dagens labyrint</b> är samma för alla under dagen, och ditt bästa försök hamnar på topplistan. <b>Snigelpost</b> är turneringar med kompisar: alla spelar samma labyrinter när de hinner, ni får en notis när någon har spelat, och varje omgång kan ses i repris efteråt.',
    'over.toContest': 'Till turneringen', 'over.sending': 'Skickar…',
    'over.dailyRank': 'Dagens labyrint: plats {rank} av {players}.', 'over.dailyKept': 'Ditt bästa idag är fortfarande {score}, plats {rank} av {players}.',
    'over.queued': 'Ingen anslutning. Resultatet skickas när du är online igen.', 'over.contestSent': 'Omgång {round} är inskickad.',
    'board.title': 'Topplista', 'board.today': 'Idag', 'board.yesterday': 'Igår', 'board.records': 'Rekord',
    'board.leadDay': 'Dagens labyrint {day}. {players} spelare.', 'board.leadRecords': 'Bästa resultat någonsin i Dagens labyrint. {players} spelare.',
    'board.empty': 'Ingen har spelat än. Bli först.', 'board.me': 'Du: plats {rank}, {score} poäng.', 'board.meNone': 'Du har inte spelat än.',
    'board.level': 'nivå {level}', 'board.play': 'Spela dagens labyrint', 'board.loading': 'Hämtar…',
    'post.title': 'Snigelpost', 'post.blurb': 'Turnering med kompisar i egen takt. Alla spelar samma labyrinter när de hinner, en omgång i taget. Du får en notis när någon har spelat, och efter din egen omgång kan du se de andras i repris.',
    'post.name': 'Ditt namn', 'post.defaultName': 'Snäcka', 'post.rounds': 'Omgångar', 'post.players': 'Spelare',
    'rounds.1': '1 omgång', 'rounds.3': '3 omgångar', 'rounds.5': '5 omgångar', 'players.2': '2 (duell)',
    'post.create': 'Skapa turnering', 'post.mine': 'Mina turneringar', 'post.none': 'Inga turneringar än. Skapa en och skicka länken.',
    'post.vs': 'med {names}', 'post.alone': 'Väntar på deltagare', 'post.open': 'Öppna',
    'post.state.play': 'Din tur: omgång {round}', 'post.state.wait': 'Väntar på de andra', 'post.state.done': 'Klar: plats {place} av {of}', 'post.state.won': 'Klar: du vann',
    'contest.title': 'Turnering', 'contest.meta': '{rounds} · {players} av {max} spelare · slutar {deadline}', 'contest.metaDone': '{rounds} · {players} spelare · avslutad',
    'contest.copy': 'Kopiera länk', 'contest.copied': 'Kopierad!', 'contest.share': 'Dela', 'contest.shareText': 'Spela Snailman mot mig i Snigelpost:',
    'contest.join': 'Gå med', 'contest.end': 'Avsluta nu', 'contest.endConfirm': 'Avsluta turneringen nu? Omgångar som inte är spelade räknas som 0.',
    'contest.leave': 'Lämna', 'contest.leaveConfirm': 'Lämna turneringen? Dina omgångar tas bort.', 'contest.hide': 'Ta bort från listan', 'contest.back': 'Tillbaka',
    'contest.play': 'Spela omgång {round}', 'contest.resume': 'Fortsätt omgång {round}',
    'contest.player': 'Spelare', 'contest.round': 'Omg {n}', 'contest.points': 'Poäng',
    'contest.waitAll': 'Du har spelat alla omgångar. Väntar på de andra.', 'contest.joinNote': 'Gå med för att spela. Alla spelar samma labyrinter.',
    'contest.watchNote': 'Tryck på ett resultat för att se det i repris. Andras omgångar syns när du spelat samma omgång själv.',
    'contest.finished': 'Turneringen är slut.', 'contest.winner': '{name} vann!', 'contest.youWon': 'Du vann!',
    'contest.oneRoundNote': 'En omgång är ett helt parti, tre liv.',
    'replay.title': 'Repris: {name}, omgång {round}', 'replay.ok': 'Reprisen stämmer: {score} poäng.', 'replay.bad': 'Reprisen stämmer inte: {replayed} i stället för {score}.',
    'replay.old': 'Rundan spelades med en annan version av spelet och kan inte visas.',
    'push.ask': 'Notis när någon spelat', 'push.on': 'Notiser på', 'push.denied': 'Notiser blockerade i webbläsaren', 'push.install': 'Installera appen för notiser (iPhone)',
    'err.full': 'Turneringen är full.', 'err.finished': 'Turneringen är redan slut.', 'err.noSuch': 'Turneringen finns inte (längre).',
    'err.played': 'Den omgången är redan inskickad.', 'err.update': 'Ladda om sidan för att få senaste versionen av spelet.',
    'err.hostLeave': 'Avsluta turneringen innan du lämnar den, de andra är kvar.', 'err.playFirst': 'Spela omgången själv först.',
    'err.oldDay': 'Den dagens labyrint är stängd.', 'err.disabled': 'Snigelpost är inte tillgängligt just nu.', 'err.net': 'Kunde inte nå servern. Försök igen.',
  },
  en: {
    'app.name': 'Snailman',
    'app.tagline': 'Pac-Man where the hunters hunt at snail speed — and you may not cross your own slime.',
    'app.by': 'A <a href="https://knackpot.se" target="_blank" rel="noopener">Knackpot</a> product',
    'app.hub': 'More snail games at snails.se',
    'menu.start': 'New game', 'menu.continue': 'Continue', 'menu.help': 'How to play', 'menu.install': 'Install app',
    'menu.offline': 'The game is saved for offline play.',
    'hud.score': 'Score', 'hud.best': 'Best', 'hud.level': 'Level', 'hud.lives': 'Lives',
    'aria.up': 'Up', 'aria.down': 'Down', 'aria.left': 'Left', 'aria.right': 'Right',
    'aria.mute': 'Mute', 'aria.unmute': 'Unmute', 'aria.menu': 'Menu', 'aria.maze': 'The maze',
    'banner.ready': 'Swipe to crawl', 'banner.readyAgain': 'Ready?', 'banner.clear': 'All the lettuce!', 'banner.level': 'Level {level}',
    'banner.caught': 'Ouch.', 'banner.life': 'Extra life!',
    'over.title': 'Eaten',
    'over.by.blackbird': 'The blackbird got you.', 'over.by.hedgehog': 'The hedgehog got you.', 'over.by.gardener': 'The gardener salted you.', 'over.by.duck': 'The runner duck got you.',
    'over.score': '{score} points', 'over.level': 'Reached level {level}', 'over.best': 'Best: {best}', 'over.newBest': 'New best!',
    'over.again': 'Play again', 'over.menu': 'Menu',
    'help.title': 'How to play',
    'help.1': '<b>Steer</b> by swiping on the maze, with the cross, or with the arrow keys. The snail crawls until it meets a hedge and turns at the next junction when you tell it to.',
    'help.2': '<b>The slime.</b> Every tile you leave stays wet for a while, and you cannot crawl through your own wet slime. No reversing, no shortcut back. Plan the route so you do not box yourself in — if you get stuck, you wait for it to dry.',
    'help.3': '<b>The hunters.</b> The blackbird comes straight at you. The hedgehog aims ahead of you. The gardener works the flank. The runner duck is brave at a distance and shy up close. They all slip on slime, and in the fresh stuff right behind you they get stuck for a moment — a trail between you and them buys time.',
    'help.4': '<b>The coffee bean.</b> For a few seconds you are fast, you may cross your own slime, and the hunters flee. Touch them and they run home to the compost heap: 200, 400, 800, 1600.',
    'help.5': '<b>Eat all the lettuce</b> and the next level begins. The strawberry shows up twice per level. Three lives, an extra one at 10,000. The game saves itself when you leave.',
    'help.close': 'Close',
    'help.7': '<b>What is stored.</b> Maze of the day and Snail Mail use the series\' anonymous account. Your name, your results and the recording of every round are stored: daily results for 60 days, tournaments for 90 days after they end, your record until you ask us to delete it. <a href="https://snails.se/privacy.html">Privacy policy</a>.',
    'app.privacy': 'Privacy',
    'menu.daily': 'Maze of the day', 'menu.post': 'Snail Mail', 'menu.board': 'Leaderboard',
    'menu.dailyBest': 'Today: {score} points, rank {rank} of {players}.', 'menu.dailyNone': 'The same maze for everyone today. Your best attempt counts.',
    'common.close': 'Close', 'aria.close': 'Close',
    'hud.target': 'To beat', 'hud.daily': 'Daily',
    'help.6': '<b>Maze of the day</b> is the same for everyone all day, and your best attempt goes on the leaderboard. <b>Snail Mail</b> is tournaments with friends: everyone plays the same mazes when they have time, you get a notification when somebody has played, and every round can be watched as a replay afterwards.',
    'over.toContest': 'To the tournament', 'over.sending': 'Sending…',
    'over.dailyRank': 'Maze of the day: rank {rank} of {players}.', 'over.dailyKept': 'Your best today is still {score}, rank {rank} of {players}.',
    'over.queued': 'No connection. The result is sent when you are back online.', 'over.contestSent': 'Round {round} is in.',
    'board.title': 'Leaderboard', 'board.today': 'Today', 'board.yesterday': 'Yesterday', 'board.records': 'Records',
    'board.leadDay': 'Maze of the day {day}. {players} players.', 'board.leadRecords': 'Best results ever in Maze of the day. {players} players.',
    'board.empty': 'Nobody has played yet. Be the first.', 'board.me': 'You: rank {rank}, {score} points.', 'board.meNone': 'You have not played yet.',
    'board.level': 'level {level}', 'board.play': 'Play the maze of the day', 'board.loading': 'Loading…',
    'post.title': 'Snail Mail', 'post.blurb': 'A tournament with friends, at your own pace. Everyone plays the same mazes when they have time, one round at a time. You get a notification when somebody has played, and after your own round you can watch the others as replays.',
    'post.name': 'Your name', 'post.defaultName': 'Snail', 'post.rounds': 'Rounds', 'post.players': 'Players',
    'rounds.1': '1 round', 'rounds.3': '3 rounds', 'rounds.5': '5 rounds', 'players.2': '2 (duel)',
    'post.create': 'Create tournament', 'post.mine': 'My tournaments', 'post.none': 'No tournaments yet. Create one and send the link.',
    'post.vs': 'with {names}', 'post.alone': 'Waiting for players', 'post.open': 'Open',
    'post.state.play': 'Your turn: round {round}', 'post.state.wait': 'Waiting for the others', 'post.state.done': 'Over: {place} of {of}', 'post.state.won': 'Over: you won',
    'contest.title': 'Tournament', 'contest.meta': '{rounds} · {players} of {max} players · ends {deadline}', 'contest.metaDone': '{rounds} · {players} players · finished',
    'contest.copy': 'Copy link', 'contest.copied': 'Copied!', 'contest.share': 'Share', 'contest.shareText': 'Play Snailman against me by Snail Mail:',
    'contest.join': 'Join', 'contest.end': 'End now', 'contest.endConfirm': 'End the tournament now? Rounds not played count as 0.',
    'contest.leave': 'Leave', 'contest.leaveConfirm': 'Leave the tournament? Your rounds are removed.', 'contest.hide': 'Remove from list', 'contest.back': 'Back',
    'contest.play': 'Play round {round}', 'contest.resume': 'Continue round {round}',
    'contest.player': 'Player', 'contest.round': 'Rd {n}', 'contest.points': 'Points',
    'contest.waitAll': 'You have played every round. Waiting for the others.', 'contest.joinNote': 'Join to play. Everyone plays the same mazes.',
    'contest.watchNote': 'Tap a result to watch it as a replay. Other players\' rounds show once you have played the same round yourself.',
    'contest.finished': 'The tournament is over.', 'contest.winner': '{name} won!', 'contest.youWon': 'You won!',
    'contest.oneRoundNote': 'A round is a whole game, three lives.',
    'replay.title': 'Replay: {name}, round {round}', 'replay.ok': 'The replay adds up: {score} points.', 'replay.bad': 'The replay does not add up: {replayed} instead of {score}.',
    'replay.old': 'This run was played with another version of the game and cannot be shown.',
    'push.ask': 'Notify me when someone has played', 'push.on': 'Notifications on', 'push.denied': 'Notifications are blocked in the browser', 'push.install': 'Install the app for notifications (iPhone)',
    'err.full': 'The tournament is full.', 'err.finished': 'The tournament is already over.', 'err.noSuch': 'The tournament does not exist (any more).',
    'err.played': 'That round is already in.', 'err.update': 'Reload the page to get the latest version of the game.',
    'err.hostLeave': 'End the tournament before you leave it, the others are still in it.', 'err.playFirst': 'Play the round yourself first.',
    'err.oldDay': 'That day\'s maze is closed.', 'err.disabled': 'Snail Mail is not available right now.', 'err.net': 'Could not reach the server. Try again.',
  },
};

let lang = 'sv';
export function detectLang() {
  try {
    const saved = localStorage.getItem('snailman.lang');
    if (saved && dict[saved]) return saved;
  } catch { /* private mode */ }
  const q = new URLSearchParams(location.search).get('lang');
  if (q && dict[q]) return q;
  return (navigator.language || 'sv').toLowerCase().startsWith('sv') ? 'sv' : 'en';
}
export function getLang() { return lang; }
export function setLang(l) {
  lang = dict[l] ? l : 'sv';
  try { localStorage.setItem('snailman.lang', lang); } catch { /* ignore */ }
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.innerHTML = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
  document.querySelectorAll('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
}
export function t(key, params = {}) {
  let s = dict[lang][key] ?? dict.sv[key] ?? key;
  for (const [k, v] of Object.entries(params)) s = s.replaceAll('{' + k + '}', String(v));
  return s;
}
export function keysOf(l) { return Object.keys(dict[l]); }
