// Online leaderboard over Supabase's REST API (no SDK). One table, `scores`; boards are plain text ids:
// a campaign mission id (m1, m3i...) or `daily-<day number>`. Everything fails soft - the game never waits for it.
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

let cfg = { url: SUPABASE_URL.replace(/\/+$/, ''), key: SUPABASE_KEY };
export const setBoardConfig = (url, key) => { cfg = { url: String(url || '').replace(/\/+$/, ''), key: key || '' }; };   // tests
export const boardOn = () => !!(cfg.url && cfg.key);

// the older anon key is a JWT and also goes in Authorization; the newer sb_publishable_ keys are not JWTs and only go in apikey
const head = () => ({ apikey: cfg.key, ...(cfg.key.startsWith('eyJ') ? { Authorization: 'Bearer ' + cfg.key } : {}), 'Content-Type': 'application/json' });
const clean = (n) => String(n || 'Operative').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16) || 'Operative';
const guard = (p) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000))]);

export async function postScore({ board, name, score, rank, time }) {
  const res = await guard(fetch(`${cfg.url}/rest/v1/scores`, {
    method: 'POST', headers: { ...head(), Prefer: 'return=minimal' },
    body: JSON.stringify({ board: String(board).slice(0, 40), name: clean(name), score: Math.max(0, Math.min(30000, Math.round(score))), rank: String(rank || '').slice(0, 2), time: Math.max(0, Math.round(time || 0)) }),
  }));
  if (!res.ok) throw new Error('HTTP ' + res.status);
}

export async function topScores(board, n = 10) {
  const res = await guard(fetch(`${cfg.url}/rest/v1/scores?board=eq.${encodeURIComponent(board)}&select=name,score,rank,time&order=score.desc,time.asc&limit=${n}`, { headers: head() }));
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}
