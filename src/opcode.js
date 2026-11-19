// Mission codes: a custom operation packed into a short text code (and a link) that anyone can paste to play it.
// Format: "NFP1-" + base64url(JSON) or "NFP2-" + base64url(deflated JSON). Imported data is always sanitised.
import { LOCATIONS } from './locations.js';
import { THEMES } from './world.js';
import { BUILDER_OBJECTIVES } from './story.js';

const b64 = (bytes) => { let s = ''; bytes.forEach((b) => { s += String.fromCharCode(b); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64 = (t) => { const s = atob(t.replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(s, (c) => c.charCodeAt(0)); };
const pipe = async (bytes, stream) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());

const FIELDS = ['title', 'story', 'radio', 'leader', 'location', 'time', 'insertion', 'exit', 'count', 'enemies', 'objectives'];

export async function encodeOp(form) {
  const o = {}; for (const k of FIELDS) o[k] = form[k];
  const raw = new TextEncoder().encode(JSON.stringify(o));
  if (typeof CompressionStream !== 'undefined') { try { return 'NFP2-' + b64(await pipe(raw, new CompressionStream('deflate-raw'))); } catch { /* fall back to plain */ } }
  return 'NFP1-' + b64(raw);
}

const str = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, n);
const pick = (v, ok, d) => (ok.includes(v) ? v : d);

// turns a pasted code or a whole link into a clean form; throws Error with a readable message when it is not valid
export async function decodeOp(text) {
  let code = String(text || '').trim();
  const m = code.match(/NFP[12]-[A-Za-z0-9_-]+/); if (!m) throw new Error('That does not look like a mission code.');
  code = m[0];
  let o;
  try {
    const bytes = unb64(code.slice(5));
    const json = code.startsWith('NFP2-') ? await pipe(bytes, new DecompressionStream('deflate-raw')) : bytes;
    o = JSON.parse(new TextDecoder().decode(json));
  } catch { throw new Error('The code is damaged - copy it again in full.'); }
  if (!o || typeof o !== 'object') throw new Error('The code is damaged - copy it again in full.');
  const objs = (Array.isArray(o.objectives) ? o.objectives : []).filter((k) => BUILDER_OBJECTIVES.some(([x]) => x === k));
  return {
    id: 'c' + Date.now(), title: str(o.title, 40), story: str(o.story, 1500), radio: str(o.radio, 160), leader: str(o.leader, 28),
    location: pick(o.location, Object.keys(LOCATIONS), 'harbor'), time: pick(o.time, Object.keys(THEMES), 'night'),
    insertion: pick(o.insertion, ['foot', 'car', 'bike', 'boat', 'parachute'], 'foot'), exit: pick(o.exit, ['reach', 'flyout'], 'reach'),
    count: Math.max(1, Math.min(3, o.count | 0 || 3)), enemies: pick(+o.enemies, [0.6, 1, 1.4], 1), objectives: objs.length ? [...new Set(objs)] : ['collect'],
  };
}
