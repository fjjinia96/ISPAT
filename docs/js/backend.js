/*
 * ISPAT হালচাল : connection to Supabase
 *   Auth (team login), database table "dashboard" (data, live updates),
 *   and the "ask-ai" Edge Function (Gemini chat).
 * Nothing here runs in DEMO MODE.
 */
import { CONFIG } from './config.js';

export const LIVE = !!(CONFIG.supabaseUrl && /^https:\/\//.test(CONFIG.supabaseUrl) && CONFIG.supabaseKey && !/^PASTE/i.test(CONFIG.supabaseKey));
export const AI_ON = LIVE && !!(CONFIG.ai && CONFIG.ai.enabled);

let sb = null;

export async function initBackend() {
  if (!LIVE || sb) return;
  const { createClient } = await import('./vendor/supabase.js');
  sb = createClient(CONFIG.supabaseUrl.replace(/\/+$/, ''), CONFIG.supabaseKey.trim(), {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'ispat-halchal-auth' }
  });
}

/* ---------------- login ---------------- */
export const toEmail = (id) => id.includes('@') ? id.trim().toLowerCase() : `${id.trim().toLowerCase()}@${CONFIG.loginDomain}`;

export async function login(id, password) {
  if (!LIVE) {
    const ok = id.trim().toLowerCase() === CONFIG.demoLogin.id && password === CONFIG.demoLogin.password;
    if (!ok) throw new Error('Oops! That ID or password does not match. Try again 🙂');
    return;
  }
  const { error } = await sb.auth.signInWithPassword({ email: toEmail(id), password });
  if (error) {
    const m = (error.message || '').toLowerCase();
    if (m.includes('fetch') || m.includes('network')) throw new Error('No internet connection. Please check and try again.');
    if (error.status === 429 || m.includes('rate')) throw new Error('Too many tries. Please wait a few minutes and try again.');
    throw new Error('Oops! That ID or password does not match. Try again 🙂');
  }
}
export async function logout() { if (LIVE && sb) await sb.auth.signOut(); }

/** cb(user or null) now and whenever the login changes */
export function onAuth(cb) {
  if (!LIVE) return;
  let last;
  const fire = (s) => { const u = s && s.user ? s.user : null; const key = u ? u.id : ''; if (key !== last) { last = key; cb(u); } };
  sb.auth.getSession().then(({ data }) => fire(data.session));
  sb.auth.onAuthStateChange((_event, session) => setTimeout(() => fire(session), 0));
}

/* ---------------- data ---------------- */
let channel = null, pollTimer = null, onFocus = null;

async function fetchData() {
  const { data, error } = await sb.from('dashboard').select('data, source, updated_at').eq('id', 'current').maybeSingle();
  if (error) throw error;
  return data ? { data: data.data, source: data.source || '', updatedAt: data.updated_at ? new Date(data.updated_at) : null } : null;
}

/** Calls cb({data, updatedAt, source}) now and whenever the data changes; cb(null) if nothing uploaded yet. */
export function watchData(cb, onError) {
  if (!LIVE) return;
  stopWatching();
  const load = () => fetchData().then(cb).catch((e) => onError && onError(e));
  load();
  // live updates (Supabase Realtime); a refresh every 5 minutes and when the app comes back to the screen as backup
  channel = sb.channel('dashboard-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'dashboard' }, load)
    .subscribe();
  pollTimer = setInterval(load, 5 * 60 * 1000);
  onFocus = () => { if (document.visibilityState === 'visible') load(); };
  document.addEventListener('visibilitychange', onFocus);
}
export function stopWatching() {
  if (channel) { sb.removeChannel(channel); channel = null; }
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  if (onFocus) { document.removeEventListener('visibilitychange', onFocus); onFocus = null; }
}

export async function saveData(parsed) {
  if (!LIVE) return;
  const { warnings, ...clean } = parsed;
  const { error } = await sb.from('dashboard').upsert({ id: 'current', data: clean, source: 'Uploaded in the app', hash: null, updated_at: new Date().toISOString() });
  if (error) throw new Error('Could not save: ' + error.message);
}

/* ---------------- Gemini chat (Edge Function "ask-ai") ---------------- */
let history = [];
export function resetAI() { history = []; }

export async function askAI(question, context, todayISO) {
  if (!AI_ON) throw new Error('AI is off');
  const { data, error } = await sb.functions.invoke('ask-ai', { body: { question, context, today: todayISO, history } });
  if (error) throw error;
  if (!data || !data.answer) throw new Error((data && data.error) || 'Empty answer');
  history = [...history, { role: 'user', text: question }, { role: 'model', text: data.answer }].slice(-8);
  return data.answer;
}
