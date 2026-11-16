// Player profile, weapons, attachments, armour, outfits and backpack items. Pure data - no rendering.

export const SLOTS = ['pistol', 'rifle', 'sniper'];
export const SLOT_NAMES = { pistol: 'Sidearm', rifle: 'Primary', sniper: 'Heavy' };

// every weapon you can own or pick up. One gun per slot is carried: sidearm, primary and heavy (plus fists and a kick).
export const VARIANTS = {
  usp: { slot: 'pistol', name: 'USP-9', model: 'usp', dmg: 36, rate: 0.2, mag: 12, spread: 0.01, noise: 12, reload: 1.2, recoil: 0.012, price: 0, desc: 'Accurate, quiet sidearm' },
  glock: { slot: 'pistol', name: 'G-17 Rapid', model: 'glock', dmg: 27, rate: 0.12, mag: 17, spread: 0.016, noise: 18, reload: 1.1, recoil: 0.011, price: 500, desc: 'Fires faster, hits lighter' },
  deagle: { slot: 'pistol', name: 'D-50 Magnum', model: 'deagle', dmg: 70, rate: 0.45, mag: 7, spread: 0.012, noise: 45, reload: 1.6, recoil: 0.03, price: 900, desc: 'Slow, loud, hits like a truck' },
  mp5: { slot: 'rifle', name: 'MP5 SMG', model: 'mp5', dmg: 20, rate: 0.075, mag: 30, spread: 0.028, noise: 55, reload: 1.7, recoil: 0.007, auto: true, price: 700, desc: 'Very fast close-range fire' },
  p90: { slot: 'rifle', name: 'P90 PDW', model: 'p90', dmg: 18, rate: 0.06, mag: 50, spread: 0.03, noise: 60, reload: 2.2, recoil: 0.006, auto: true, price: 1100, desc: '50 rounds, shreds up close' },
  spas12: { slot: 'rifle', name: 'SPAS-12 Shotgun', model: 'spas12', snd: 'shotgun', dmg: 14, pellets: 8, range: 45, rate: 0.9, mag: 6, spread: 0.06, noise: 90, reload: 2.4, recoil: 0.04, price: 800, desc: '8 pellets per shot - devastating close up' },
  striker: { slot: 'rifle', name: 'Striker Auto-shotgun', model: 'striker', snd: 'shotgun', dmg: 11, pellets: 8, range: 40, rate: 0.3, mag: 12, spread: 0.07, noise: 90, reload: 3.0, recoil: 0.028, auto: true, price: 1400, desc: 'Fully automatic shotgun' },
  m4a1: { slot: 'rifle', name: 'M4A1 Carbine', model: 'm4a1', dmg: 27, rate: 0.1, mag: 30, spread: 0.022, noise: 75, reload: 1.8, recoil: 0.009, auto: true, price: 0, desc: 'Balanced assault rifle' },
  ak47: { slot: 'rifle', name: 'AK-47', model: 'ak47', dmg: 34, rate: 0.12, mag: 30, spread: 0.03, noise: 85, reload: 2.0, recoil: 0.013, auto: true, price: 900, desc: 'Hits hard, kicks harder' },
  l118a: { slot: 'sniper', name: 'L118A Longbow', model: 'l118a', dmg: 160, rate: 1.1, mag: 5, spread: 0.03, noise: 95, reload: 2.5, recoil: 0.05, scope: true, price: 0, desc: 'One-shot long range' },
};

export const ATTACH = {
  supp: { name: 'Suppressor', desc: 'Shots are heard from far less distance (-8% damage)', price: 600, slots: ['pistol', 'rifle', 'sniper'] },
  mag: { name: 'Extended magazine', desc: '+50% rounds per magazine', price: 400, slots: ['pistol', 'rifle', 'sniper'] },
  grip: { name: 'Stabiliser grip', desc: 'Tighter spread and less recoil', price: 450, slots: ['pistol', 'rifle', 'sniper'] },
  optic: { name: 'Optic', desc: 'Zooms in further when aiming', price: 500, slots: ['rifle', 'sniper'] },
};

export const FINISHES = [
  { name: 'Factory', c: 0xffffff }, { name: 'Graphite', c: 0x4a4d52 }, { name: 'Desert', c: 0xd9bd85 },
  { name: 'Olive', c: 0x8b9a5c }, { name: 'Arctic', c: 0xe6eef6 }, { name: 'Gold', c: 0xffd24a, metal: true },
];

// outfit = tint of the soldier model
export const OUTFITS = [
  { name: 'Navy', c: 0xb9c8e6 }, { name: 'Olive', c: 0xa8c890 }, { name: 'Desert', c: 0xe8d4a0 }, { name: 'Urban', c: 0xb0b0b8 },
  { name: 'Night ops', c: 0x707890 }, { name: 'Arctic', c: 0xffffff }, { name: 'Crimson', c: 0xe09090 }, { name: 'Gold', c: 0xffe090 },
];

export const ARMORS = [
  { name: 'No armour', start: 0, price: 0, desc: 'Fast and light' },
  { name: 'Light vest', start: 40, price: 800, desc: 'Start each mission with 40 armour' },
  { name: 'Plate carrier', start: 100, price: 1800, desc: 'Start each mission with 100 armour' },
];

// things you carry in the backpack. `key` is the action (default key) that uses it.
export const PACK_ITEMS = {
  med: { name: 'Medkit', desc: 'Heals 60 health', price: 150, key: 'KeyQ' },
  plate: { name: 'Armour plate', desc: 'Adds 50 armour', price: 200, key: 'KeyX' },
  noise: { name: 'Noisemaker', desc: 'Thrown decoy - guards go and investigate it', price: 100, key: 'KeyT' },
  ammo: { name: 'Ammo box', desc: 'Refills the reserves of every gun you carry', price: 120, key: 'KeyY' },
  nade: { name: 'Grenade', desc: 'An extra grenade (G)', price: 80, key: 'KeyG' },
};
export const PACK_CAPS = [
  { slots: 6, price: 0, name: 'Field pack' }, { slots: 9, price: 700, name: 'Tactical pack' }, { slots: 12, price: 1500, name: 'Expedition pack' },
];
export const MAX_GRENADES = 6;
export const RANKS = ['Recruit', 'Operative', 'Specialist', 'Veteran', 'Shadow', 'Ghost'];

export const levelOf = (xp) => 1 + Math.floor(Math.sqrt(Math.max(0, xp) / 400));
export const xpFor = (lvl) => (lvl - 1) * (lvl - 1) * 400;
export const rankOf = (xp) => RANKS[Math.min(RANKS.length - 1, levelOf(xp) - 1)];

export function defaultProfile() {
  return {
    credits: 600, xp: 0,
    own: { variants: ['usp', 'm4a1', 'l118a'], att: [], armor: [0], pack: 0 },
    equip: { pistol: 'usp', rifle: 'm4a1', sniper: 'l118a', att: { pistol: [], rifle: [], sniper: [] }, finish: { pistol: 0, rifle: 0, sniper: 0 }, armor: 0, outfit: 0 },
    stock: { med: 2, plate: 1, noise: 2, ammo: 1, nade: 2 },
    carry: { med: 2, plate: 1, noise: 1, ammo: 1, nade: 0 },
    totals: { missions: 0, kills: 0, headshots: 0, takedowns: 0, deaths: 0, alarms: 0, playSec: 0, shots: 0, hits: 0, earned: 0 },
  };
}

// fill any missing fields of a saved profile (older saves) without touching what is there
export function mergeProfile(saved) {
  const merge = (base, s) => {
    if (s == null || typeof s !== 'object' || Array.isArray(base) !== Array.isArray(s)) return base;
    if (Array.isArray(base)) return s.slice();
    const out = {};
    for (const k of Object.keys(base)) out[k] = typeof base[k] === 'object' && base[k] !== null ? merge(base[k], s[k]) : (typeof s[k] === typeof base[k] ? s[k] : base[k]);
    return out;
  };
  const p = merge(defaultProfile(), saved);
  clampCarry(p);
  return p;
}

export const capOf = (p) => PACK_CAPS[Math.min(PACK_CAPS.length - 1, p.own.pack || 0)].slots;
export const carryCount = (carry) => Object.values(carry).reduce((a, b) => a + b, 0);

// what you carry can never exceed what you own or the room in the pack
export function clampCarry(p) {
  for (const k of Object.keys(PACK_ITEMS)) p.carry[k] = Math.max(0, Math.min(p.carry[k] | 0, p.stock[k] | 0));
  let over = carryCount(p.carry) - capOf(p);
  for (const k of Object.keys(PACK_ITEMS).reverse()) while (over > 0 && p.carry[k] > 0) { p.carry[k]--; over--; }
}

// the stats of one gun with the owner's attachments and finish applied
export function weaponDef(id, prof, equipped) {
  const v = VARIANTS[id], d = { ...v, snd: v.snd || v.slot, id, finish: 0, supp: false, aimFov: v.aimFov || ({ pistol: 52, rifle: 40, sniper: 46 })[v.slot] };
  if (equipped && prof) {
    const att = prof.equip.att[v.slot] || [];
    if (att.includes('supp')) { d.noise *= 0.3; d.dmg *= 0.92; d.supp = true; }
    if (att.includes('mag')) d.mag = Math.round(d.mag * 1.5);
    if (att.includes('grip')) { d.spread *= 0.75; d.recoil *= 0.65; }
    if (att.includes('optic')) d.zoom = v.slot === 'sniper' ? 7 : 30;
    d.finish = prof.equip.finish[v.slot] | 0;
  }
  return d;
}
