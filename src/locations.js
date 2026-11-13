import { rr, pick } from './util.js';

// ------------------------------------------------------------------ generators

function townGrid(w, o) {
  const { x0, z0, nx, nz, cell, road, rng } = o, bs = cell - road;
  const cx = x0 + (nx - 1) * cell / 2, cz = z0 + (nz - 1) * cell / 2;
  w.flat(cx, cz, nx * cell + road, nz * cell + road, o.roadColor, 1);
  const t = { cell, road, bs, nx, nz, inter: (i, j) => ({ x: x0 + (i - 0.5) * cell, z: z0 + (j - 0.5) * cell }), block: (i, j) => ({ x: x0 + i * cell, z: z0 + j * cell }) };
  t.rect = [cx - (nx * cell + road) / 2, cx + (nx * cell + road) / 2, cz - (nz * cell + road) / 2, cz + (nz * cell + road) / 2];
  for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) {
    const p = t.inter(i, j), V = o.voidFrom;
    if (V && i > V && j > V) continue;
    w.addNav(p.x, p.z);
    if ((i + j) % 2 === 0) w.lamp(p.x + road / 2 + 0.8, p.z + road / 2 + 0.8);
    for (let k = 0; k < 4; k++) {
      const off = road / 2 + bs * (k + 0.5) / 4;
      if (j < nz && !(V && i > V && j >= V)) w.flat(p.x, p.z + off, 0.35, 4, o.lineColor, 2);
      if (i < nx && !(V && j > V && i >= V)) w.flat(p.x + off, p.z, 4, 0.35, o.lineColor, 2);
    }
  }
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const bx = x0 + i * cell, bz = z0 + j * cell;
    if (o.skip && o.skip(i, j) === 'void') continue;
    w.flat(bx, bz, bs, bs, o.walkColor, 2);
    if (o.skip && o.skip(i, j)) continue;
    const hf = o.height ? o.height(i, j) : 1;
    if (rng() < (o.big ?? 0.3)) { const s = bs - 8; w.building(bx, bz, s, s, rr(rng, o.hMin, o.hMax) * hf, o.style, rng); }
    else {
      const lot = (bs - 6) / 2;
      for (const a of [-1, 1]) for (const b of [-1, 1]) {
        if (rng() < 0.12) { if (o.tree) w.tree(bx + a * lot / 2, bz + b * lot / 2, o.tree, 0.9); continue; }
        const s = lot - 3;
        w.building(bx + a * (lot / 2 + 0.5), bz + b * (lot / 2 + 0.5), s - rr(rng, 0, 2), s - rr(rng, 0, 2), rr(rng, o.hMin, o.hMax) * hf, o.style, rng);
      }
    }
  }
  return t;
}

// Walled compound laid out on a grid of cells. Pattern rows run north (+z) to south.
// W warehouse, O office/HQ, S hostage shed, T sabotage target pad, C cargo stacks, M motor pool, . open yard
function compound(w, o) {
  const { cx, cz, rng } = o, W = o.w, D = o.d, H = o.wallH || 4;
  const x0 = cx - W / 2, x1 = cx + W / 2, z0 = cz - D / 2, z1 = cz + D / 2;
  const P = { intel: [], hostages: [], targets: [], guards: [], patrols: [], snipers: [], cars: [], supplies: [], boss: null, gates: [], rect: [x0, x1, z0, z1] };
  w.flat(cx, cz, W, D, o.floor, 1.5);
  const sides = {
    s: { a: x0, b: x1, fixed: z0, horiz: true, out: -1 }, n: { a: x0, b: x1, fixed: z1, horiz: true, out: 1 },
    w: { a: z0, b: z1, fixed: x0, horiz: false, out: -1 }, e: { a: z0, b: z1, fixed: x1, horiz: false, out: 1 },
  };
  for (const k in sides) {
    const s = sides[k], mid = (s.a + s.b) / 2;
    const gs = o.gates.filter((g) => g.side === k).map((g) => ({ c: mid + g.off, w: g.width })).sort((p, q) => p.c - q.c);
    const seg = (a, b) => { if (b - a < 0.5) return; const m = (a + b) / 2, L = b - a; if (s.horiz) w.block(m, s.fixed, L, 1, H, o.wall); else w.block(s.fixed, m, 1, L, H, o.wall); };
    let cur = s.a;
    for (const g of gs) {
      seg(cur, g.c - g.w / 2); cur = g.c + g.w / 2;
      const gp = s.horiz ? { x: g.c, z: s.fixed } : { x: s.fixed, z: g.c };
      const nx = s.horiz ? 0 : s.out, nz = s.horiz ? s.out : 0, tx = s.horiz ? 1 : 0, tz = s.horiz ? 0 : 1;
      for (const e of [-1, 1]) w.block(gp.x + tx * e * (g.w / 2 + 0.2), gp.z + tz * e * (g.w / 2 + 0.2), 1.5, 1.5, H + 1.2, 0x33373c);
      w.addNav(gp.x + nx * 9, gp.z + nz * 9); w.addNav(gp.x, gp.z); w.addNav(gp.x - nx * 3.5, gp.z - nz * 3.5);
      const yaw = Math.atan2(nx, nz);
      for (const e of [-1, 1]) P.guards.push({ x: gp.x + nx * 2.5 + tx * e * (g.w / 2 - 1.5), z: gp.z + nz * 2.5 + tz * e * (g.w / 2 - 1.5), yaw });
      P.gates.push({ ...gp, nx, nz });
    }
    seg(cur, s.b);
  }
  for (const [sx, sz] of o.towers || []) {
    const t = w.tower(cx + sx * W / 2, cz + sz * D / 2, 9);
    P.snipers.push({ ...t, yaw: Math.atan2(-sx, -sz) });
  }
  const rows = o.pattern.length, cols = o.pattern[0].length, cw = W / cols, cd = D / rows;
  const cargo = [0x9a3b2e, 0x2e5f8a, 0x3f7a4a, 0xb08a2a, 0x6a6f78, 0x8a4a7a];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const ch = o.pattern[r][c], x = x0 + (c + 0.5) * cw, z = z1 - (r + 0.5) * cd, mw = cw - 14, md = cd - 14;
    if (ch === 'W') {
      const bd = md - 4, front = z + 2 - bd / 2;
      w.building(x, z + 2, mw, bd, 9, 'warehouse', rng);
      w.deco(x, 2, front - 0.06, 5, 4, 0.15, 0x1c1e22);
      w.crate(x + mw / 2 - 4.6, front - 1.4, 1.4);
      P.intel.push({ x: x + mw / 2 - 2.2, z: front - 1.5 });
      P.guards.push({ x: x - 5, z: front - 2.6, yaw: Math.PI });
    } else if (ch === 'O') {
      const bw = Math.min(mw, 24), bd = Math.min(md - 6, 18), front = z + 3 - bd / 2;
      w.building(x, z + 3, bw, bd, o.officeH || 8, o.style, rng);
      w.deco(x, 1.3, front - 0.06, 2.4, 2.6, 0.15, 0x1c1e22);
      P.boss = { x, z: front - 5 };
      P.intel.push({ x: x + bw / 2 - 1.5, z: front - 1.4 });
      P.guards.push({ x: x - bw / 2 + 2, z: front - 2.5, yaw: Math.PI });
    } else if (ch === 'S') {
      w.shed(x, z, 12, 9);
      w.sandbags(x, z - 6.2, 7);
      P.hostages.push({ x, z });
      P.guards.push({ x: x + 8.5, z: z - 5, yaw: rr(rng, 0, 6.28) });
    } else if (ch === 'T') {
      P.targets.push({ x, z });
      w.flat(x, z, 9, 9, 0x6a5a20, 2);
      w.barrel(x - 6, z + 4); w.barrel(x - 6.9, z + 3.2, 0x2a4a6a); w.barrel(x + 6, z - 4);
      w.sandbags(x, z - md / 2 + 1, 8);
      P.guards.push({ x: x + 6, z: z + 5, yaw: rr(rng, 0, 6.28) });
    } else if (ch === 'C') {
      if (o.containers) {
        const nr = Math.max(1, Math.floor(md / 5.6)), nc = Math.max(1, Math.floor((mw + 1) / 13));
        for (let k = 0; k < nr; k++) for (let n = 0; n < nc; n++) {
          if (rng() < 0.18) continue;
          w.container(x - (nc - 1) * 6.5 + n * 13, z - md / 2 + 1.3 + k * 5.6, true, pick(rng, cargo), rng() < 0.4 ? 2 : 1);
        }
        P.intel.push({ x: x + rr(rng, -4, 4), z: z - md / 2 + 1.3 + 2.8 });
        P.supplies.push({ x: x - mw / 2 + 1, z: z - md / 2 + 1.3 + (nr > 2 ? 8.4 : 2.8) });
      } else {
        for (let k = 0; k < 9; k++) {
          const s = rr(rng, 1.2, 2.4);
          w.crate(x + (k % 3 - 1) * (mw / 3) + rr(rng, -1.5, 1.5), z + (Math.floor(k / 3) - 1) * (md / 3) + rr(rng, -1.5, 1.5), s, rng() < 0.3 ? 0x56606a : 0x7a5a36);
        }
        P.intel.push({ x: x + mw / 6, z: z + md / 6 });
        P.supplies.push({ x: x - mw / 6, z: z - md / 6 });
      }
    } else if (ch === 'M') {
      w.shed(x, z + 4, Math.min(mw, 26), 8, 0x4a5058);
      const cy = x < cx ? Math.PI / 2 : -Math.PI / 2;
      P.cars.push({ x: x - 5, z: z - 3, yaw: cy, kind: 'jeep' }, { x: x + 5, z: z - 8, yaw: cy, kind: 'bike' });
      P.supplies.push({ x, z: z + 4 });
    } else {
      w.crate(x + rr(rng, -6, 6), z + rr(rng, -6, 6), 1.6);
      w.barrel(x + rr(rng, -8, 8), z + rr(rng, -8, 8), 0x3a5a3a);
      P.supplies.push({ x: x + rr(rng, -3, 3), z: z + rr(rng, -3, 3) });
    }
  }
  const xs = [x0 + 3.5], zs = [z0 + 3.5];
  for (let c = 1; c < cols; c++) xs.push(x0 + c * cw);
  for (let r = 1; r < rows; r++) zs.push(z0 + r * cd);
  xs.push(x1 - 3.5); zs.push(z1 - 3.5);
  for (const x of xs) for (const z of zs) w.addNav(x, z);
  const L = xs.length - 1, M = zs.length - 1, pt = (i, j) => ({ x: xs[i], z: zs[j] });
  P.patrols.push([pt(0, 0), pt(L, 0), pt(L, M), pt(0, M)], [pt(1, 1), pt(L - 1, 1), pt(L - 1, M - 1), pt(1, M - 1)],
    [pt(2, 0), pt(2, M)], [pt(0, 2), pt(L, 2)], [pt(L - 1, M), pt(1, M), pt(1, 0), pt(L - 1, 0)]);
  return P;
}

function airstrip(w, o) {
  const len = o.z1 - o.z0, zc = (o.z0 + o.z1) / 2;
  w.flat(o.x, zc, 28, len, 0x26282c, 1);
  for (let z = o.z0 + 12; z < o.z1 - 8; z += 18) w.flat(o.x, z, 0.6, 8, 0xd8d8c8, 2);
  const hx = o.x + (o.hangarSide || -1) * 36;
  w.building(hx, o.z0 + 40, 26, 30, 10, 'warehouse');
  w.addNav(o.x, o.z0 + 10); w.addNav(o.x, zc); w.addNav(o.x, o.z1 - 10);
  return { plane: { x: o.x, z: o.z0 + 16, yaw: 0 }, flyout: { x: o.x, y: 160, z: o.z1 + 650 }, rect: [o.x - 55, o.x + 55, o.z0 - 6, o.z1 + 6] };
}

function scatter(rng, n, avoid, fn, R = 390) {
  let made = 0, tries = 0;
  while (made < n && tries++ < n * 12) {
    const x = rr(rng, -R, R), z = rr(rng, -R, R);
    if (avoid.some((a) => x > a[0] - 6 && x < a[1] + 6 && z > a[2] - 6 && z < a[3] + 6)) continue;
    fn(x, z); made++;
  }
}

function finish(C, town, air, x) {
  const P = { ...C, ...x, plane: air.plane, flyout: air.flyout };
  const a = town.block(x.arenaBlock[0], x.arenaBlock[1]);
  P.arena = { x: a.x, z: a.z };
  P.race = x.raceIdx.map(([i, j]) => town.inter(i, j));
  P.cars = [...C.cars];
  for (const [i, j, kind] of x.parked || []) { const p = town.inter(i, j); P.cars.push({ x: p.x + town.road / 2 - 2.6, z: p.z + town.cell / 2, yaw: 0, kind }); }
  return P;
}

function arenaRing(w, a, color) {
  for (let i = 0; i < 16; i++) {
    const t = (i / 16) * Math.PI * 2;
    w.inst('cyl', 0x2a2a2a, a.x + Math.cos(t) * 11, 0.5, a.z + Math.sin(t) * 11, 0.25, 1, 0.25);
  }
  w.flat(a.x, a.z, 20, 20, color, 3);
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) w.lamp(a.x + sx * 13, a.z + sz * 13);
}

// ------------------------------------------------------------------ the four districts

export const LOCATIONS = {
  harbor: {
    name: 'Old Harbor District', tagline: 'Warehouses, docks and smuggling routes on the black water.',
    defaultTime: 'night', compound: 'the freight yard',
    build(w, rng) {
      w.ground(0x2c3a33);
      const town = townGrid(w, { x0: -300, z0: -320, nx: 8, nz: 4, cell: 70, road: 16, rng, style: 'port', hMin: 6, hMax: 17, roadColor: 0x26292e, walkColor: 0x3c4148, lineColor: 0x8a8a70, tree: 'leaf', skip: (i, j) => i === 3 && j === 2 });
      const C = compound(w, { cx: 0, cz: 130, w: 240, d: 220, wall: 0x4a4f55, floor: 0x24272b, style: 'port', containers: true, rng,
        gates: [{ side: 's', off: 0, width: 14 }, { side: 'w', off: -30, width: 10 }], towers: [[-1, -1], [1, -1], [1, 1], [-1, 1]],
        pattern: ['TCSO', 'WCCW', 'SCT.', 'MWST'] });
      const air = airstrip(w, { x: 335, z0: -270, z1: 150 });
      w.water(252);
      for (const x of [-70, 20, 100]) {
        w.block(x - 7, 247, 1.6, 1.6, 30, 0xd08a1e); w.block(x + 7, 247, 1.6, 1.6, 30, 0xd08a1e);
        w.deco(x, 30.5, 262, 3, 2.2, 46, 0xd08a1e); w.deco(x, 27, 247, 16, 1.4, 1.6, 0xd08a1e);
      }
      w.deco(40, 5.5, 292, 130, 12, 26, 0x2b2f3a); w.deco(88, 17, 292, 22, 11, 18, 0xd8d8d8); w.deco(88, 25, 292, 5, 6, 5, 0xb03a2a);
      w.flat(0, -27, 14, 96, 0x26292e, 1); w.flat(-150, -5, 430, 12, 0x26292e, 1);
      for (let x = -350; x < 60; x += 40) w.lamp(x, -13);
      arenaRing(w, town.block(3, 2), 0x3a2a22);
      scatter(rng, 45, [town.rect, C.rect, air.rect, [-370, 70, -20, 10], [-10, 10, -80, 20]], (x, z) => (rng() < 0.75 ? w.tree(x, z, 'leaf', rr(rng, 0.8, 1.3)) : w.rock(x, z, rr(rng, 1, 2.2))));
      w.mountains(22, 1500, 2100, 180, 420, 0x1a2230, null);
      return finish(C, town, air, {
        lz: { x: 175, z: -25 }, extract: { x: -352, z: -5 }, footSpawn: { x: 60, z: -70, yaw: -0.5 }, carSpawn: { x: -70, z: -5, yaw: Math.PI / 2 },
        flyStart: { x: 175, y: 330, z: -1500, yaw: 0 }, arenaBlock: [3, 2], raceIdx: [[0, 0], [4, 0], [8, 0], [8, 4], [4, 4], [0, 4]],
        parked: [[2, 1, 'sedan'], [5, 2, 'bike'], [6, 0, 'sedan']],
      });
    },
  },

  downtown: {
    name: 'Downtown', tagline: 'Glass towers, neon streets and the Spire that watches all of it.',
    defaultTime: 'dusk', compound: 'the Aegis Spire plaza',
    build(w, rng) {
      w.ground(0x30363c);
      const inC = (i, j) => i >= 4 && j >= 4;
      const town = townGrid(w, { x0: -240, z0: -240, nx: 7, nz: 7, cell: 80, road: 18, rng, style: 'city', hMin: 14, hMax: 44, big: 0.4, roadColor: 0x24272c, walkColor: 0x444951, lineColor: 0xb8b090, tree: 'leaf', voidFrom: 4,
        height: (i, j) => 1.5 - Math.hypot(i - 3, j - 3) * 0.17, skip: (i, j) => (inC(i, j) ? 'void' : (i === 3 && j === 3) || (i === 1 && j === 5)) });
      const C = compound(w, { cx: 160, cz: 160, w: 214, d: 214, wall: 0x50565e, floor: 0x2a2d32, style: 'city', containers: false, officeH: 96, rng,
        gates: [{ side: 's', off: -20, width: 14 }, { side: 'w', off: 20, width: 12 }], towers: [[1, -1], [1, 1], [-1, 1]],
        pattern: ['SCTO', 'WC.W', 'TSCC', 'MWST'] });
      const air = airstrip(w, { x: -355, z0: -230, z1: 190, hangarSide: 1 });
      const park = town.block(1, 5);
      for (let k = 0; k < 9; k++) if (k !== 4) w.tree(park.x + (k % 3 - 1) * 20, park.z + (Math.floor(k / 3) - 1) * 20, 'leaf', 1.2);
      arenaRing(w, town.block(3, 3), 0x402020);
      scatter(rng, 30, [town.rect, C.rect, air.rect], (x, z) => w.tree(x, z, 'leaf', rr(rng, 0.8, 1.4)));
      w.mountains(26, 1500, 2200, 200, 520, 0x2a2438, null);
      const fs = town.inter(1, 1);
      return finish(C, town, air, {
        lz: { x: park.x, z: park.z }, extract: { x: -280, z: -280 }, footSpawn: { x: fs.x + 12, z: fs.z + 12, yaw: 0.8 }, carSpawn: { x: fs.x + 5, z: fs.z + 26, yaw: 0 },
        flyStart: { x: park.x, y: 340, z: -1500, yaw: 0 }, arenaBlock: [3, 3],
        raceIdx: [[1, 1], [4, 1], [6, 1], [6, 4], [4, 4], [4, 7], [1, 7], [1, 4]], parked: [[2, 2, 'sedan'], [3, 5, 'bike'], [5, 2, 'sedan'], [2, 6, 'sedan']],
      });
    },
  },

  industrial: {
    name: 'Industrial Zone', tagline: 'Dead factories, rail yards and a fortress built from rust.',
    defaultTime: 'day', compound: 'the foundry fortress',
    build(w, rng) {
      w.ground(0xb59a6a);
      const town = townGrid(w, { x0: -265, z0: -225, nx: 4, nz: 4, cell: 62, road: 14, rng, style: 'industrial', hMin: 5, hMax: 12, roadColor: 0x4a443c, walkColor: 0x8f7f62, lineColor: 0xc8b890, skip: (i, j) => i === 1 && j === 2 });
      const C = compound(w, { cx: 150, cz: 110, w: 240, d: 220, wall: 0x8a6f52, floor: 0x7d6c52, style: 'industrial', containers: false, rng,
        gates: [{ side: 's', off: -30, width: 14 }, { side: 'w', off: 0, width: 12 }], towers: [[-1, -1], [1, -1], [1, 1], [-1, 1]],
        pattern: ['OCST', 'WC.W', 'TSCC', 'MWTS'] });
      const air = airstrip(w, { x: 345, z0: -330, z1: -30 });
      // chimneys and a dead train
      for (const [x, z] of [[-60, 150], [-90, 180], [-40, 215]]) { w.inst('cyl', 0x7a5a4a, x, 22, z, 5, 44, 5); w.solid(x, z, 4.4, 4.4, 44); }
      for (let k = 0; k < 6; k++) w.block(-330 + k * 15, 120, 13.5, 3.2, 4, k % 2 ? 0x5a3a2a : 0x3a4a52);
      w.flat(-290, 120, 150, 3.6, 0x3a332c, 1);
      w.flat(-60, -150, 380, 12, 0x4a443c, 1); w.flat(120, -75, 12, 150, 0x4a443c, 1);
      arenaRing(w, town.block(1, 2), 0x6a4a3a);
      scatter(rng, 55, [town.rect, C.rect, air.rect, [-340, -240, 110, 130], [-250, 130, -160, -140], [110, 130, -150, 0]], (x, z) => (rng() < 0.4 ? w.tree(x, z, 'palm', rr(rng, 0.9, 1.3)) : w.rock(x, z, rr(rng, 1.2, 3))));
      w.mountains(24, 1500, 2200, 160, 380, 0x9a7a52, null);
      return finish(C, town, air, {
        lz: { x: -110, z: 60 }, extract: { x: -352, z: 40 }, footSpawn: { x: 60, z: -120, yaw: 0.4 }, carSpawn: { x: -40, z: -150, yaw: Math.PI / 2 },
        flyStart: { x: -110, y: 330, z: -1500, yaw: 0 }, arenaBlock: [1, 2], raceIdx: [[0, 0], [4, 0], [4, 4], [0, 4]],
        parked: [[1, 1, 'jeep'], [3, 2, 'bike'], [2, 3, 'sedan']],
      });
    },
  },

  mountain: {
    name: 'Mountain Road', tagline: 'Pine forest, switchbacks and a hidden base above the snow line.',
    defaultTime: 'dawn', compound: 'the ridge base',
    build(w, rng) {
      w.ground(0xe2e9ef);
      const town = townGrid(w, { x0: -310, z0: -300, nx: 3, nz: 3, cell: 62, road: 14, rng, style: 'mountain', hMin: 4, hMax: 9, roadColor: 0x3a3d42, walkColor: 0xc8d0d8, lineColor: 0xe8e8d8, tree: 'pine', skip: (i, j) => i === 1 && j === 1 });
      const C = compound(w, { cx: 20, cz: 80, w: 250, d: 230, wall: 0x6a727a, floor: 0x8a9298, style: 'mountain', containers: true, rng,
        gates: [{ side: 's', off: 0, width: 14 }, { side: 'e', off: 0, width: 12 }], towers: [[-1, -1], [1, -1], [1, 1], [-1, 1]],
        pattern: ['TCOS', 'WC.W', 'SCTC', 'MWST'] });
      const air = airstrip(w, { x: 250, z0: -250, z1: 190, hangarSide: 1 });
      w.flat(-140, -245, 130, 12, 0x3a3d42, 1); w.flat(20, -150, 12, 240, 0x3a3d42, 1); w.flat(-70, -245, 190, 12, 0x3a3d42, 1);
      arenaRing(w, town.block(1, 1), 0x5a626a);
      scatter(rng, 130, [town.rect, C.rect, air.rect, [-240, 30, -255, -235], [10, 30, -260, -30], [-200, -120, 20, 100]], (x, z) => (rng() < 0.85 ? w.tree(x, z, 'pine', rr(rng, 0.9, 1.6)) : w.rock(x, z, rr(rng, 1.5, 3.5))));
      w.mountains(30, 1300, 2100, 260, 640, 0x5a6672, 0xf2f6fa);
      return finish(C, town, air, {
        lz: { x: -160, z: 60 }, extract: { x: -352, z: -110 }, footSpawn: { x: -150, z: -215, yaw: 0.6 }, carSpawn: { x: -130, z: -245, yaw: Math.PI / 2 },
        flyStart: { x: -160, y: 340, z: -1500, yaw: 0 }, arenaBlock: [1, 1], raceIdx: [[0, 0], [3, 0], [3, 3], [0, 3]],
        parked: [[1, 0, 'jeep'], [2, 2, 'bike']],
      });
    },
  },
};
