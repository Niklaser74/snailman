// Public runtime configuration. Bumped when the shipped files change, so the
// menu can show what is running; keep APP_VERSION in step with sw.js.
// The Supabase publishable key is meant to be public: the security-definer
// functions on the server decide what it may do. Same project as the rest of
// the series (snails); see supabase/README.md.
export const APP_VERSION = 'v7';
export const SUPABASE_URL = 'https://lygpfumngyebxoqqncet.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_Nmes72jfyETXQZsiYjsokw_tMusjKI-';
// Web Push (VAPID) public key; the private half lives in Supabase Vault.
export const VAPID_PUBLIC_KEY = 'BG_p9tfa6FCNA-aqH4D0fiVfn0tnvLcwVYGtoAOA6NpDi-Mv6SojFcltzXZutx6GgAenDLeEe07dXve6iUS21mI';
