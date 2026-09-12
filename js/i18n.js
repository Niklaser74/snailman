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
    'help.3': '<b>Jägarna.</b> Koltrasten jagar dig rakt på. Igelkotten siktar framför dig. Trädgårdsmästaren går på flanken. Löpankan är modig på avstånd och blyg på nära håll. Alla halkar på slem — ett spår mellan dig och dem köper tid.',
    'help.4': '<b>Kaffebönan.</b> Några sekunder är du snabb, får korsa ditt eget slem, och jägarna flyr. Rör dem så springer de hem till komposten: 200, 400, 800, 1600.',
    'help.5': '<b>Ät all sallad</b> så börjar nästa nivå. Jordgubben dyker upp två gånger per nivå. Tre liv, ett extra vid 10 000. Spelet sparas när du lämnar.',
    'help.close': 'Stäng',
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
    'help.3': '<b>The hunters.</b> The blackbird comes straight at you. The hedgehog aims ahead of you. The gardener works the flank. The runner duck is brave at a distance and shy up close. They all slip on slime — a trail between you and them buys time.',
    'help.4': '<b>The coffee bean.</b> For a few seconds you are fast, you may cross your own slime, and the hunters flee. Touch them and they run home to the compost heap: 200, 400, 800, 1600.',
    'help.5': '<b>Eat all the lettuce</b> and the next level begins. The strawberry shows up twice per level. Three lives, an extra one at 10,000. The game saves itself when you leave.',
    'help.close': 'Close',
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
