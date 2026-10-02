// Web Push for Snigelpost (copied from Snäckschack): subscribe this browser and
// ask the server to notify the others after a round. Subscriptions are
// Snailman's own (snailman_push_subscriptions): the shared table has no game
// column, so a notice for one game reached every game's worker on snails.se.
import { VAPID_PUBLIC_KEY, SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { online } from './supa.js';

// The subscription last saved from this browser (endpoint and language), so a
// start does not save it again unless something changed.
const SAVED = 'snailman.pushSaved';
function savedKey() { try { return localStorage.getItem(SAVED); } catch { return null; } }
function rememberSaved(key) { try { localStorage.setItem(SAVED, key); } catch { /* private mode */ } }
async function save(j, lang) {
  // also deletes this endpoint from the shared snails_push_subscriptions
  await online.rpc('snailman_save_push', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_lang: lang });
  rememberSaved(j.endpoint + '|' + lang);
}

function keyBytes(b64) {
  const s = b64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export const push = {
  supported() {
    return !!VAPID_PUBLIC_KEY && typeof navigator !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  },
  // iOS only allows push for apps installed on the home screen
  needsInstall() {
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    return ios && !standalone;
  },
  permission() { return typeof Notification === 'undefined' ? 'denied' : Notification.permission; },
  async current() {
    try { const reg = await navigator.serviceWorker.ready; return await reg.pushManager.getSubscription(); } catch { return null; }
  },
  async subscribe(lang) {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) });
    await save(sub.toJSON(), lang);
    return sub;
  },
  // On every start: re-subscribe quietly when permission is granted but this
  // scope (/snailman/) has no subscription yet, and save an existing one that
  // was saved before (in the shared table, before 2026-10-02) or under another
  // language — that is what moves it. Resolves to a new subscription, or null.
  async resubscribe(lang) {
    try {
      if (!this.supported() || this.permission() !== 'granted' || this.needsInstall() || !online.userId()) return null;
      const sub = await this.current();
      if (sub) {
        const j = sub.toJSON();
        if (savedKey() !== j.endpoint + '|' + lang) await save(j, lang);
        return null;
      }
      return await this.subscribe(lang);
    } catch { return null; } // Safari wants a user gesture: the button in the waiting overlay is still there
  },
  // Ask the server to tell the others in a tournament. Fire and forget.
  async notify(contestId, event, round = null) {
    try {
      const token = await online.token();
      await fetch(`${SUPABASE_URL}/functions/v1/snailman-notify`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ contest_id: contestId, event, round }),
        keepalive: true,
      });
    } catch { /* notifications are best effort */ }
  },
};
