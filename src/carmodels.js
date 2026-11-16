// Detailed vehicle models built in code: smooth lofted bodies with wheel arches, glass over a real interior,
// spoked wheels that spin, lights, mirrors, door lines. No model files needed.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

const cache = new Map();
const once = (key, make) => { let v = cache.get(key); if (v === undefined) { v = make(); cache.set(key, v); } return v; };

// ---------------------------------------------------------------- materials
const paint = (c) => once('paint' + c, () => new THREE.MeshPhysicalMaterial({ color: c, metalness: 0.55, roughness: 0.34, clearcoat: 1, clearcoatRoughness: 0.07 }));
const M = {
  glass: () => once('glass', () => new THREE.MeshPhysicalMaterial({ color: 0x0b131b, metalness: 0.25, roughness: 0.04, transparent: true, opacity: 0.58, envMapIntensity: 1.8, depthWrite: false })),
  plastic: () => once('plastic', () => new THREE.MeshStandardMaterial({ color: 0x121316, roughness: 0.55, metalness: 0.15 })),
  trim: () => once('trim', () => new THREE.MeshStandardMaterial({ color: 0x1b1c20, roughness: 0.4, metalness: 0.6 })),
  chrome: () => once('chrome', () => new THREE.MeshStandardMaterial({ color: 0xdfe3e8, roughness: 0.14, metalness: 1 })),
  tire: () => once('tire', () => new THREE.MeshStandardMaterial({ color: 0x0d0d0f, roughness: 0.92, metalness: 0 })),
  disc: () => once('disc', () => new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.35, metalness: 0.85 })),
  seat: () => once('seat', () => new THREE.MeshStandardMaterial({ color: 0x2b2d33, roughness: 0.85 })),
  dash: () => once('dash', () => new THREE.MeshStandardMaterial({ color: 0x17181c, roughness: 0.7 })),
  wood: () => once('wood', () => new THREE.MeshStandardMaterial({ color: 0x6a5238, roughness: 0.85 })),
  head: () => once('head', () => new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.96, 0.82).multiplyScalar(2.6) })),
  tail: () => once('tail', () => new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.1, 0.06).multiplyScalar(2.3) })),
  plate: () => once('plate', () => new THREE.MeshStandardMaterial({ color: 0xe8e6dc, roughness: 0.5 })),
};
const radial = () => once('radial', () => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
});

// ---------------------------------------------------------------- helpers
const UNIT = () => once('unit', () => new RoundedBoxGeometry(1, 1, 1, 3, 0.18));
const PLAIN = () => once('plain', () => new THREE.BoxGeometry(1, 1, 1));
const CYL = () => once('cyl', () => new THREE.CylinderGeometry(0.5, 0.5, 1, 20));
const SPH = () => once('sph', () => new THREE.SphereGeometry(0.5, 16, 12));

function put(parent, geo, mat, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz); m.castShadow = true; parent.add(m); return m;
}
const rbox = (p, mat, x, y, z, w, h, d, rx = 0, ry = 0, rz = 0) => put(p, UNIT(), mat, x, y, z, w, h, d, rx, ry, rz);
const sbox = (p, mat, x, y, z, w, h, d, rx = 0, ry = 0, rz = 0) => put(p, PLAIN(), mat, x, y, z, w, h, d, rx, ry, rz);
// a straight bar from point a to point b in the (y, z) plane, at lateral offset x
function strut(p, mat, x, a, b, t = 0.06) {
  const dy = b.y - a.y, dz = b.z - a.z, len = Math.hypot(dy, dz);
  return put(p, PLAIN(), mat, x, (a.y + b.y) / 2, (a.z + b.z) / 2, t, len, t * 1.2, Math.atan2(dz, dy), 0, 0);
}
// profile drawn in (z = forward, y = up), extruded across the width, smoothed but with crisp edges
function prism(shape, depth, bev = 0.07) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 4, curveSegments: 22 });
  g.rotateY(-Math.PI / 2); g.translate(depth / 2, 0, 0);
  const out = toCreasedNormals(g, 0.7); g.dispose();
  return out;
}

// ---------------------------------------------------------------- wheels
function wheelGeos(r, w, spokes) {
  return once('wheel' + r + '|' + w + '|' + spokes, () => {
    const tire = new THREE.CylinderGeometry(r, r, w, 30).rotateZ(Math.PI / 2);
    const disc = new THREE.CylinderGeometry(r * 0.66, r * 0.66, w + 0.014, 26).rotateZ(Math.PI / 2);
    const parts = [];
    for (const s of [-1, 1]) {
      for (let k = 0; k < spokes; k++) {
        const sp = new THREE.BoxGeometry(0.04, r * 0.58, 0.085);
        sp.translate(0, r * 0.3, 0); sp.rotateX((k / spokes) * Math.PI * 2); sp.translate(s * (w / 2 + 0.01), 0, 0); parts.push(sp);
      }
      const hub = new THREE.CylinderGeometry(r * 0.17, r * 0.17, 0.06, 16).rotateZ(Math.PI / 2); hub.translate(s * (w / 2 + 0.025), 0, 0); parts.push(hub);
    }
    return { tire, disc, spokes: mergeGeometries(parts) };
  });
}
function makeWheel(r, w, spokes = 5) {
  const G = wheelGeos(r, w, spokes), pivot = new THREE.Group(), spin = new THREE.Group();
  pivot.add(spin);
  for (const [geo, mat] of [[G.tire, M.tire()], [G.disc, M.disc()], [G.spokes, M.chrome()]]) { const m = new THREE.Mesh(geo, mat); m.castShadow = true; spin.add(m); }
  return { pivot, spin, r, front: false };
}

// ---------------------------------------------------------------- cars
const CARS = {
  sedan: { id: 'sedan', L: 4.5, W: 1.84, wb: 2.78, r: 0.38, tw: 0.27, sill: 0.28, floor: 0.32, tail: 0.92, belt: 0.98, nose: 0.74, roof: 1.5, cabRB: -1.22, cabFB: 0.78, cabRT: -0.84, cabFT: 0.28, spokes: 5 },
  sports: { id: 'sports', L: 4.4, W: 1.96, wb: 2.62, r: 0.37, tw: 0.32, sill: 0.2, floor: 0.22, tail: 0.84, belt: 0.84, nose: 0.52, roof: 1.35, cabRB: -1.12, cabFB: 0.7, cabRT: -0.66, cabFT: 0.02, spokes: 7, sport: true },
};

function bodyGeo(P) {
  return once('body' + P.id, () => {
    const { L, wb, r, sill } = P, h = L / 2, ar = r + 0.1, dx = Math.sqrt(ar * ar - (r - sill) * (r - sill)), a1 = Math.atan2(sill - r, dx), a2 = Math.PI - a1;
    const s = new THREE.Shape();
    s.moveTo(-h + 0.14, sill);
    s.lineTo(-h + 0.04, sill + 0.2);
    s.lineTo(-h, P.tail * 0.8);
    s.quadraticCurveTo(-h, P.tail + 0.01, -h + 0.28, P.tail + 0.03);
    s.lineTo(P.cabRB, P.belt);
    s.lineTo(P.cabRB, P.floor);      // open cabin: floor level between the seats' bulkheads
    s.lineTo(P.cabFB, P.floor);
    s.lineTo(P.cabFB, P.belt + 0.02);
    s.quadraticCurveTo((P.cabFB + h) / 2, P.belt + 0.0, h - 0.14, P.nose);
    s.quadraticCurveTo(h + 0.01, P.nose - 0.03, h, P.nose - 0.2);
    s.lineTo(h - 0.03, sill + 0.1);
    s.lineTo(h - 0.14, sill);
    s.lineTo(wb / 2 + dx, sill); s.absarc(wb / 2, r, ar, a1, a2, false);
    s.lineTo(-wb / 2 + dx, sill); s.absarc(-wb / 2, r, ar, a1, a2, false);
    s.closePath();
    return prism(s, P.W - 0.16, 0.08);
  });
}
function cabinGeo(P) {
  return once('cabin' + P.id, () => {
    const s = new THREE.Shape(), b = P.belt, t = P.roof - 0.05;
    s.moveTo(P.cabRB, b); s.lineTo(P.cabFB, b); s.lineTo(P.cabFT + 0.08, t - 0.05);
    s.quadraticCurveTo(P.cabFT, t + 0.02, P.cabFT - 0.16, t + 0.02);
    s.lineTo(P.cabRT + 0.2, t + 0.02);
    s.quadraticCurveTo(P.cabRT, t + 0.02, P.cabRT - 0.07, t - 0.08);
    s.closePath();
    return prism(s, P.W * 0.8 - 0.1, 0.045);
  });
}

function doorGeo(P) {
  return once('door' + P.id, () => {
    const s = new THREE.Shape(), z0 = P.cabRB - 0.03, z1 = P.cabFB + 0.12, y0 = P.floor - 0.06, y1 = P.belt + 0.01;
    s.moveTo(z0, y0); s.lineTo(z1, y0); s.lineTo(z1, y1 - 0.04); s.quadraticCurveTo(z1, y1, z1 - 0.06, y1); s.lineTo(z0 + 0.06, y1); s.quadraticCurveTo(z0, y1, z0, y1 - 0.04); s.closePath();
    return prism(s, 0.05, 0.03);
  });
}
function buildCar(kind, color) {
  const P = CARS[kind], g = new THREE.Group(), wheels = [], { L, W, sill } = P, h = L / 2;
  const pm = paint(color), plastic = M.plastic(), trim = M.trim(), chrome = M.chrome();
  put(g, bodyGeo(P), pm, 0, 0, 0);
  put(g, cabinGeo(P), M.glass(), 0, 0, 0);
  // roof, pillars
  const roofW = W * 0.8 - 0.02;
  rbox(g, pm, 0, P.roof + 0.015, (P.cabRT + P.cabFT) / 2 - 0.02, roofW, 0.07, P.cabFT - P.cabRT + 0.34);
  for (const sx of [-1, 1]) {
    const x = sx * (W * 0.4 - 0.02);
    strut(g, pm, x, { y: P.belt, z: P.cabFB }, { y: P.roof - 0.04, z: P.cabFT + 0.06 }, 0.08);
    strut(g, pm, x, { y: P.belt, z: P.cabRB }, { y: P.roof - 0.04, z: P.cabRT - 0.02 }, 0.1);
    sbox(g, pm, x, (P.belt + P.roof) / 2 - 0.02, (P.cabRB + P.cabFB) / 2 - 0.12, 0.06, P.roof - P.belt - 0.04, 0.07);
    sbox(g, plastic, sx * (W / 2 + 0.005), P.belt - 0.04, (P.cabRB + P.cabFB) / 2 - 0.1, 0.02, 0.025, P.cabFB - P.cabRB - 0.1); // window sill trim
  }
  // interior seen through the glass: floor, dash, seats, wheel, console
  const mid = (P.cabRB + P.cabFB) / 2, dz = mid - 0.28, fl = P.floor;
  for (const sx of [-1, 1]) put(g, doorGeo(P), pm, sx * (W / 2 - 0.1), 0, 0);
  sbox(g, M.dash(), 0, fl + 0.02, mid, W * 0.78, 0.04, P.cabFB - P.cabRB - 0.1);
  rbox(g, M.dash(), 0, P.belt - 0.13, P.cabFB - 0.18, W * 0.72, 0.3, 0.36);
  rbox(g, plastic, 0, fl + 0.2, dz + 0.1, 0.2, 0.3, 0.8);
  for (const sx of [-1, 1]) {
    rbox(g, M.seat(), sx * 0.4, fl + 0.12, dz + 0.08, 0.5, 0.18, 0.55);
    rbox(g, M.seat(), sx * 0.4, fl + 0.45, dz - 0.2, 0.5, 0.62, 0.14, -0.15);
    rbox(g, M.seat(), sx * 0.4, fl + 0.84, dz - 0.25, 0.28, 0.16, 0.1);
  }
  rbox(g, M.seat(), 0, fl + 0.1, P.cabRB + 0.42, W * 0.72, 0.16, 0.5);
  rbox(g, M.seat(), 0, fl + 0.42, P.cabRB + 0.2, W * 0.72, 0.55, 0.14, -0.1);
  put(g, new THREE.TorusGeometry(0.17, 0.022, 8, 18), plastic, -0.4, P.belt - 0.12, dz + 0.5, 1, 1, 1, 1.0, 0, 0);
  // mirrors
  for (const sx of [-1, 1]) { rbox(g, pm, sx * (W / 2 + 0.06), P.belt + 0.08, P.cabFB - 0.08, 0.12, 0.1, 0.16); sbox(g, plastic, sx * (W / 2 - 0.02), P.belt + 0.04, P.cabFB - 0.08, 0.1, 0.03, 0.04); }
  // front: lights, grille, bumper
  for (const sx of [-1, 1]) {
    put(g, SPH(), M.head(), sx * (W * 0.32), P.nose - 0.08, h - 0.07, 0.4, 0.14, 0.16);
    put(g, SPH(), M.head(), sx * (W * 0.32), P.nose - 0.25, h - 0.03, 0.2, 0.06, 0.06);
    put(g, SPH(), M.tail(), sx * (W * 0.34), P.tail - 0.1, -h + 0.03, 0.4, 0.12, 0.1);
  }
  rbox(g, trim, 0, P.nose - 0.2, h - 0.02, W * 0.34, 0.15, 0.06);
  sbox(g, chrome, 0, P.nose - 0.2, h + 0.012, W * 0.34, 0.012, 0.01);
  rbox(g, plastic, 0, sill + 0.13, h - 0.1, W * 0.94, 0.2, 0.22);
  rbox(g, plastic, 0, sill + 0.13, -h + 0.1, W * 0.94, 0.2, 0.22);
  rbox(g, M.plate(), 0, sill + 0.28, -h - 0.005, 0.5, 0.14, 0.02);
  rbox(g, M.plate(), 0, sill + 0.23, h + 0.005, 0.5, 0.12, 0.02);
  // doors: seams and handles; side skirts
  for (const sx of [-1, 1]) {
    const x = sx * (W / 2 + 0.004);
    for (const z of [P.cabFB - 0.16, mid - 0.4, P.cabRB + 0.14]) sbox(g, plastic, x, P.belt - 0.33, z, 0.014, 0.62, 0.02);
    rbox(g, chrome, x + sx * 0.008, P.belt - 0.14, mid + 0.04, 0.02, 0.03, 0.16);
    rbox(g, chrome, x + sx * 0.008, P.belt - 0.14, mid - 0.78, 0.02, 0.03, 0.16);
    rbox(g, plastic, sx * (W / 2 - 0.03), sill + 0.05, 0, 0.06, 0.1, P.wb - 1.0);
  }
  if (P.sport) {
    rbox(g, plastic, 0, 0.1, h - 0.15, W * 1.0, 0.05, 0.5);                       // front splitter
    rbox(g, plastic, 0, 0.16, -h + 0.1, W * 0.8, 0.14, 0.3);                     // diffuser
    rbox(g, plastic, 0, P.belt + 0.02, h - 1.1, 0.5, 0.04, 0.5);                 // bonnet vent
    for (const sx of [-1, 1]) { sbox(g, plastic, sx * 0.55, P.tail + 0.14, -h + 0.3, 0.05, 0.3, 0.07); rbox(g, pm, sx * (W / 2 - 0.05), P.belt - 0.3, 0.0, 0.05, 0.1, 0.5); }
    rbox(g, trim, 0, P.tail + 0.34, -h + 0.3, W * 0.88, 0.05, 0.36, -0.06);      // wing
    const glowGeo = new THREE.PlaneGeometry(W * 1.9, L * 1.35).rotateX(-Math.PI / 2);
    const gm = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.1), map: radial(), transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const gl = new THREE.Mesh(glowGeo, gm); gl.position.y = 0.04; g.add(gl);       // under-car glow
  } else {
    rbox(g, chrome, 0, sill + 0.04, h - 0.1, W * 0.6, 0.02, 0.02);
    sbox(g, plastic, 0, P.tail + 0.045, -h + 0.45, W * 0.7, 0.012, 0.012);
  }
  // wheels
  for (const sx of [-1, 1]) for (const sz of [1, -1]) {
    const w = makeWheel(P.r, P.tw, P.spokes); w.front = sz > 0;
    w.pivot.position.set(sx * (W / 2 - P.tw / 2 - 0.02), P.r, sz * P.wb / 2); g.add(w.pivot); wheels.push(w);
    const cal = rbox(w.pivot, new THREE.MeshStandardMaterial({ color: P.sport ? 0xd22020 : 0x555a62, roughness: 0.4, metalness: 0.5 }), sx * (P.tw / 2 - 0.08), 0.12, 0.0, 0.05, 0.2, 0.14); cal.castShadow = false;
  }
  const sy = fl + 0.21 + 0.04 - 0.43, ry = fl + 0.18 + 0.04 - 0.43;
  const seats = [{ x: -0.4, y: sy, z: dz, kneel: true }, { x: 0.4, y: sy, z: dz, kneel: true }];
  if (!P.sport) seats.push({ x: -0.4, y: ry, z: P.cabRB + 0.45, kneel: true }, { x: 0.4, y: ry, z: P.cabRB + 0.45, kneel: true });
  return { group: g, wheels, seat: seats[0], seats };
}

// ---------------------------------------------------------------- jeep
function buildJeep(color) {
  const g = new THREE.Group(), wheels = [], pm = paint(color), plastic = M.plastic(), trim = M.trim(), chrome = M.chrome();
  const W = 2.0, L = 4.2, r = 0.52, tw = 0.36, wb = 2.5, tubTop = 1.18;
  rbox(g, pm, 0, 0.78, -0.35, W - 0.1, 0.8, L * 0.62);            // tub
  rbox(g, pm, 0, 0.92, 1.25, W * 0.82, 0.55, 1.35);               // bonnet
  rbox(g, plastic, 0, 0.45, 0, W - 0.2, 0.2, L - 0.4);            // underbody
  sbox(g, M.dash(), 0, 1.0, 0.25, W - 0.3, 0.1, 1.9);             // floor/dash base
  // flared arches over each wheel
  for (const sx of [-1, 1]) for (const sz of [1, -1]) {
    const arch = new THREE.Mesh(once('jarch', () => new THREE.CylinderGeometry(r + 0.12, r + 0.12, 0.34, 22, 1, true, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2)), paint(color));
    arch.material = pm; arch.position.set(sx * (W / 2 - 0.12), r, sz * wb / 2); arch.rotation.set(0, 0, 0);
    arch.geometry.computeBoundingSphere(); arch.castShadow = true; g.add(arch);
    rbox(g, plastic, sx * (W / 2 + 0.02), r + 0.62, sz * wb / 2, 0.14, 0.05, 1.3);
  }
  // seats, wheel, windshield, roll bar
  for (const sx of [-1, 1]) { rbox(g, M.seat(), sx * 0.45, 1.3, -0.35, 0.55, 0.2, 0.6); rbox(g, M.seat(), sx * 0.45, 1.62, -0.62, 0.55, 0.62, 0.16, -0.12); }
  rbox(g, M.seat(), 0, 1.3, -1.3, W * 0.75, 0.2, 0.55); rbox(g, M.seat(), 0, 1.6, -1.56, W * 0.75, 0.55, 0.15, -0.1);
  put(g, new THREE.TorusGeometry(0.2, 0.026, 8, 18), plastic, -0.45, 1.58, 0.35, 1, 1, 1, 0.9, 0, 0);
  for (const sx of [-1, 1]) {
    strut(g, plastic, sx * (W / 2 - 0.15), { y: tubTop, z: 0.55 }, { y: 1.78, z: 0.3 }, 0.07);
    const roll = new THREE.Mesh(CYL(), trim); roll.scale.set(0.07, 1.0, 0.07); roll.position.set(sx * (W / 2 - 0.2), 1.68, -1.0); roll.castShadow = true; g.add(roll);
  }
  put(g, CYL(), trim, 0, 2.17, -1.0, 0.07, W - 0.4, 0.07, 0, 0, Math.PI / 2);
  put(g, CYL(), trim, 0, 2.17, -0.05, 0.06, W - 0.4, 0.06, 0, 0, Math.PI / 2);
  strut(g, trim, W / 2 - 0.2, { y: 2.17, z: -1.0 }, { y: 2.17, z: -0.05 }, 0.06); strut(g, trim, -(W / 2 - 0.2), { y: 2.17, z: -1.0 }, { y: 2.17, z: -0.05 }, 0.06);
  const ws = new THREE.Mesh(PLAIN(), M.glass()); ws.scale.set(W - 0.4, 0.65, 0.04); ws.position.set(0, 1.5, 0.45); ws.rotation.x = -0.26; g.add(ws);
  strut(g, plastic, 0, { y: tubTop, z: 0.56 }, { y: 1.8, z: 0.32 }, 0.06); put(g, PLAIN(), plastic, 0, 1.82, 0.31, W - 0.35, 0.06, 0.06);
  // front end: grille slots, round lamps, bumpers, bull bar, winch
  rbox(g, trim, 0, 0.95, 1.95, W * 0.62, 0.42, 0.08);
  for (let i = -3; i <= 3; i++) sbox(g, chrome, i * 0.15, 0.95, 1.995, 0.07, 0.34, 0.012);
  for (const sx of [-1, 1]) {
    put(g, CYL(), chrome, sx * 0.86, 1.02, 1.9, 0.34, 0.12, 0.34, Math.PI / 2, 0, 0);
    put(g, SPH(), M.head(), sx * 0.86, 1.02, 1.97, 0.26, 0.26, 0.1);
    put(g, SPH(), M.tail(), sx * 0.84, 1.1, -2.12, 0.16, 0.26, 0.08);
  }
  rbox(g, trim, 0, 0.55, 2.0, W + 0.1, 0.26, 0.26); rbox(g, trim, 0, 0.55, -2.1, W + 0.1, 0.26, 0.26);
  put(g, CYL(), chrome, -0.6, 0.85, 2.15, 0.06, 0.55, 0.06); put(g, CYL(), chrome, 0.6, 0.85, 2.15, 0.06, 0.55, 0.06); put(g, CYL(), chrome, 0, 1.12, 2.15, 0.06, 1.2, 0.06, 0, 0, Math.PI / 2);
  rbox(g, trim, 0.35, 0.58, 2.2, 0.42, 0.2, 0.2);
  // spare wheel on the back
  const G = wheelGeos(r, tw, 6), sp = new THREE.Group();
  for (const [geo, mat] of [[G.tire, M.tire()], [G.disc, M.disc()], [G.spokes, M.chrome()]]) { const m = new THREE.Mesh(geo, mat); m.castShadow = true; sp.add(m); }
  sp.rotation.y = Math.PI / 2; sp.position.set(0.1, 1.3, -2.32); g.add(sp);
  // side steps and door line
  for (const sx of [-1, 1]) { rbox(g, trim, sx * (W / 2 + 0.05), 0.5, -0.3, 0.14, 0.05, 1.4); sbox(g, plastic, sx * (W / 2 - 0.04), 1.0, -0.2, 0.014, 0.55, 0.02); }
  for (const sx of [-1, 1]) for (const sz of [1, -1]) {
    const w = makeWheel(r, tw, 6); w.front = sz > 0;
    w.pivot.position.set(sx * (W / 2 - tw / 2 + 0.02), r, sz * wb / 2); g.add(w.pivot); wheels.push(w);
  }
  const seats = [{ x: -0.45, y: 1.02, z: -0.15, kneel: true }, { x: 0.45, y: 1.02, z: -0.15, kneel: true }, { x: -0.45, y: 1.0, z: -1.2, kneel: true }, { x: 0.45, y: 1.0, z: -1.2, kneel: true }];
  return { group: g, wheels, seat: seats[0], seats };
}

// ---------------------------------------------------------------- boat
function buildBoat(color) {
  const g = new THREE.Group(), pm = paint(color), plastic = M.plastic(), chrome = M.chrome();
  const hull = once('hull', () => {
    const s = new THREE.Shape();
    s.moveTo(-1.1, 2.4); s.lineTo(-1.16, -0.2);
    s.quadraticCurveTo(-1.12, -1.9, 0, -3.0); s.quadraticCurveTo(1.12, -1.9, 1.16, -0.2); s.lineTo(1.1, 2.4); s.closePath();
    const e = new THREE.ExtrudeGeometry(s, { depth: 0.62, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.1, bevelSegments: 4, curveSegments: 20 });
    e.rotateX(-Math.PI / 2); e.translate(0, 0.22, 0);
    const o = toCreasedNormals(e, 0.7); e.dispose(); return o;
  });
  put(g, hull, pm, 0, 0, 0);
  const deck = once('deck', () => {
    const s = new THREE.Shape();
    s.moveTo(-0.95, 2.25); s.lineTo(-1.0, -0.2); s.quadraticCurveTo(-0.95, -1.6, 0, -2.5); s.quadraticCurveTo(0.95, -1.6, 1.0, -0.2); s.lineTo(0.95, 2.25); s.closePath();
    const e = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: false, curveSegments: 16 }); e.rotateX(-Math.PI / 2); return e;
  });
  put(g, deck, M.wood(), 0, 0.84, 0);
  for (const sx of [-1, 1]) { rbox(g, chrome, sx * 1.12, 0.92, 0.3, 0.05, 0.05, 4.2); sbox(g, plastic, sx * 1.14, 0.55, 0.2, 0.012, 0.08, 4.4); }
  rbox(g, M.dash(), 0, 1.15, 0.65, 0.9, 0.55, 0.5);                                   // console
  put(g, new THREE.TorusGeometry(0.17, 0.02, 8, 18), plastic, 0, 1.52, 0.55, 1, 1, 1, 1.0, 0, 0);
  const ws = new THREE.Mesh(PLAIN(), M.glass()); ws.scale.set(1.5, 0.55, 0.04); ws.position.set(0, 1.52, 0.95); ws.rotation.x = -0.35; g.add(ws);
  rbox(g, chrome, -0.75, 1.3, 0.92, 0.05, 0.6, 0.05, -0.35); rbox(g, chrome, 0.75, 1.3, 0.92, 0.05, 0.6, 0.05, -0.35);
  rbox(g, M.seat(), 0, 1.0, -0.5, 1.6, 0.24, 0.5); rbox(g, M.seat(), 0, 1.28, -0.78, 1.6, 0.4, 0.14, -0.15);   // bench
  rbox(g, M.seat(), 0, 0.98, -1.6, 1.7, 0.18, 0.5);
  rbox(g, plastic, 0, 0.85, -2.35, 0.55, 0.9, 0.5); put(g, CYL(), plastic, 0, 0.4, -2.55, 0.12, 0.8, 0.12); put(g, CYL(), chrome, 0, 0.1, -2.62, 0.5, 0.05, 0.5, Math.PI / 2, 0, 0);  // outboard
  put(g, SPH(), M.head(), 0, 1.0, 2.3, 0.2, 0.2, 0.2);
  const seats = [{ x: 0, y: 0.89, z: 0.05, kneel: false }, { x: 0.45, y: 0.72, z: -0.55, kneel: true }, { x: -0.45, y: 0.72, z: -0.55, kneel: true }, { x: 0, y: 0.68, z: -1.6, kneel: true }];
  return { group: g, wheels: [], seat: seats[0], seats };
}

export const HAS_MODEL = { sedan: true, sports: true, jeep: true, boat: true };
export function buildVehicle(kind, color) {
  if (kind === 'jeep') return buildJeep(color);
  if (kind === 'boat') return buildBoat(color);
  return buildCar(kind, color);
}
