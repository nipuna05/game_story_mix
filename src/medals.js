// Medals: small goals beyond finishing the story. Pure data + one function; earned medals are kept in profile.medals (an array of ids).
// c = { st: stats of the mission just finished, rank, score, def, t: lifetime totals (already updated), ranksS: missions ranked S, lvl, cleared: whole campaign finished }
const acc = (st) => (st.shots ? st.hits / st.shots : 0);
export const MEDALS = [
  { id: 'first', name: 'First Blood', desc: 'Complete your first mission', test: (c) => c.t.missions >= 1 },
  { id: 'ghost', name: 'Ghost', desc: 'Finish a mission without raising the alarm', test: (c) => c.st.alarms === 0 },
  { id: 'shadow', name: 'Shadow', desc: 'Finish a mission with no kills and no alarm', test: (c) => c.st.alarms === 0 && c.st.kills === 0 },
  { id: 'sharp', name: 'Sharpshooter', desc: 'Finish a mission with 70% accuracy or better (10+ shots)', test: (c) => c.st.shots >= 10 && acc(c.st) >= 0.7 },
  { id: 'head', name: 'Headhunter', desc: 'Land 5 headshots in one mission', test: (c) => c.st.headshots >= 5 },
  { id: 'knife', name: 'Silent Blade', desc: 'Make 3 silent takedowns in one mission', test: (c) => c.st.takedowns >= 3 },
  { id: 'untouch', name: 'Untouchable', desc: 'Finish a mission without dying and taking under 25 damage', test: (c) => c.st.deaths === 0 && c.st.damage < 25 },
  { id: 'ace', name: 'S-Rank', desc: 'Earn an S rank on any mission', test: (c) => c.rank === 'S' },
  { id: 'fast', name: 'Speed Run', desc: 'Finish a mission with an A rank or better in under 3 minutes', test: (c) => (c.rank === 'S' || c.rank === 'A') && c.st.time < 180 },
  { id: 'vet', name: 'Veteran', desc: 'Complete 10 missions', test: (c) => c.t.missions >= 10 },
  { id: 'kills50', name: 'Hard Target', desc: '50 kills in total', test: (c) => c.t.kills >= 50 },
  { id: 'kills250', name: 'One-Man Army', desc: '250 kills in total', test: (c) => c.t.kills >= 250 },
  { id: 'heads25', name: 'Dead Eye', desc: '25 headshots in total', test: (c) => c.t.headshots >= 25 },
  { id: 'aces5', name: 'Elite', desc: 'Earn an S rank on 5 different missions', test: (c) => c.ranksS >= 5 },
  { id: 'lvl5', name: 'Shadow Operative', desc: 'Reach level 5', test: (c) => c.lvl >= 5 },
  { id: 'cleared', name: 'Nightfall', desc: 'Finish the whole campaign', test: (c) => c.cleared },
];

// the medals this result earns that the profile does not have yet (they are added to prof.medals)
export function awardMedals(prof, c) {
  const got = [];
  for (const m of MEDALS) if (!prof.medals.includes(m.id) && m.test(c)) { prof.medals.push(m.id); got.push(m); }
  return got;
}
