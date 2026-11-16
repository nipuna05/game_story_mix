// Realistic-looking vegetation and rocks made in code: leaf / needle / grass textures drawn on canvases, leaf-card tree crowns,
// bark, noise-shaped boulders and ground texture. Built once and shared by every scene.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const TAU = Math.PI * 2;
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const hash = (x, y, z) => { let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const s = (t) => t * t * (3 - 2 * t), u = s(xf), v = s(yf), w = s(zf), L = (a, b, t) => a + (b - a) * t;
  return L(L(L(hash(xi, yi, zi), hash(xi + 1, yi, zi), u), L(hash(xi, yi + 1, zi), hash(xi + 1, yi + 1, zi), u), v),
    L(L(hash(xi, yi, zi + 1), hash(xi + 1, yi, zi + 1), u), L(hash(xi, yi + 1, zi + 1), hash(xi + 1, yi + 1, zi + 1), u), v), w);
}

function canvasTex(w, h, draw, repeat = false) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); draw(x, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const grey = (v, a = 1) => `rgba(${v | 0},${v | 0},${v | 0},${a})`;

// ---------------------------------------------------------------- textures (neutral grey so the tint colour sets the hue)
function leafTexture() {
  return canvasTex(256, 256, (x, S) => {
    const r = rng(7);
    for (const [n, size, lo, hi] of [[150, 1.25, 105, 150], [210, 1, 150, 215], [120, 0.8, 200, 255]]) {   // dark underlayer, mid leaves, bright tips
      for (let i = 0; i < n; i++) {
        const a = r() * TAU, d = Math.sqrt(r()) * S * 0.46, cx = S / 2 + Math.cos(a) * d, cy = S / 2 + Math.sin(a) * d * 0.92;
        const lw = (15 + r() * 15) * size, lh = lw * (0.4 + r() * 0.15), rot = r() * TAU, v = lo + r() * (hi - lo);
        x.save(); x.translate(cx, cy); x.rotate(rot);
        x.fillStyle = grey(v); x.beginPath(); x.ellipse(0, 0, lw / 2, lh / 2, 0, 0, TAU); x.fill();
        x.strokeStyle = grey(v * 0.6, 0.7); x.lineWidth = 1; x.beginPath(); x.moveTo(-lw / 2, 0); x.lineTo(lw / 2, 0); x.stroke();
        x.restore();
      }
    }
  });
}
function pineTexture() {
  return canvasTex(256, 256, (x, S) => {
    const r = rng(11);
    x.strokeStyle = grey(90); x.lineWidth = 3; x.beginPath(); x.moveTo(S / 2, S); x.lineTo(S / 2, 8); x.stroke();
    for (let y = S - 10; y > 8; y -= 2.2) {   // needles fanning off the central twig, longest at the base
      const len = (28 + (y / S) * 90) * (0.7 + r() * 0.5);
      for (const side of [-1, 1]) {
        const a = (0.35 + r() * 0.55) * side, v = 90 + r() * 150;
        x.strokeStyle = grey(v, 0.95); x.lineWidth = 1.6;
        x.beginPath(); x.moveTo(S / 2, y); x.lineTo(S / 2 + Math.sin(a) * len, y + Math.cos(a) * len * 0.45 - len * 0.3); x.stroke();
      }
    }
  });
}
function frondTexture() {
  return canvasTex(128, 256, (x, S, H) => {
    const r = rng(3);
    x.strokeStyle = grey(110); x.lineWidth = 3; x.beginPath(); x.moveTo(S / 2, H); x.lineTo(S / 2, 4); x.stroke();
    for (let y = H - 8; y > 8; y -= 3) {
      const len = 55 * Math.sin((y / H) * Math.PI) + 10;
      for (const side of [-1, 1]) { const v = 120 + r() * 130; x.strokeStyle = grey(v); x.lineWidth = 2; x.beginPath(); x.moveTo(S / 2, y); x.lineTo(S / 2 + side * len, y + len * 0.55); x.stroke(); }
    }
  });
}
function grassTexture() {
  return canvasTex(128, 128, (x, S) => {
    const r = rng(5);
    for (let i = 0; i < 46; i++) {
      const bx = 6 + r() * (S - 12), h = S * (0.4 + r() * 0.6), lean = (r() - 0.5) * 30, w = 1.1 + r() * 1.7, v = 120 + r() * 135;
      x.fillStyle = grey(v); x.beginPath(); x.moveTo(bx - w, S); x.quadraticCurveTo(bx - w * 0.4 + lean * 0.4, S - h * 0.55, bx + lean, S - h); x.quadraticCurveTo(bx + w * 0.4 + lean * 0.4, S - h * 0.55, bx + w, S); x.closePath(); x.fill();
    }
  });
}
function barkTexture() {
  return canvasTex(128, 256, (x, S, H) => {
    const r = rng(9);
    x.fillStyle = grey(175); x.fillRect(0, 0, S, H);
    for (let i = 0; i < 160; i++) { x.fillStyle = grey(r() < 0.6 ? 60 + r() * 50 : 210 + r() * 40, 0.25 + r() * 0.3); x.fillRect(r() * S, r() * H, 1 + r() * 3, 14 + r() * 70); }
    for (let i = 0; i < 70; i++) { x.fillStyle = grey(40, 0.3); x.fillRect(r() * S, r() * H, 3 + r() * 9, 1 + r() * 1.5); }
  }, true);
}
function rockTexture() {
  return canvasTex(256, 256, (x, S) => {
    const r = rng(13);
    x.fillStyle = grey(185); x.fillRect(0, 0, S, S);
    for (let i = 0; i < 70; i++) { const g = x.createRadialGradient(0, 0, 0, 0, 0, 40); const p = r() * S, q = r() * S, d = r() < 0.55; g.addColorStop(0, d ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.14)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.save(); x.translate(p, q); x.scale(0.6 + r(), 0.5 + r()); x.fillStyle = g; x.fillRect(-60, -60, 120, 120); x.restore(); }
    for (let i = 0; i < 9000; i++) { x.fillStyle = grey(r() < 0.5 ? 70 + r() * 60 : 200 + r() * 55, 0.25 + r() * 0.35); x.fillRect(r() * S, r() * S, 1 + r() * 1.8, 1 + r() * 1.8); }
    x.strokeStyle = grey(45, 0.55); x.lineWidth = 1.3;
    for (let i = 0; i < 18; i++) { let px = r() * S, py = r() * S; x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 6; k++) { px += (r() - 0.5) * 50; py += (r() - 0.3) * 40; x.lineTo(px, py); } x.stroke(); }
    for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(${160 + r() * 30},${175 + r() * 30},${120 + r() * 30},${0.2 + r() * 0.25})`; x.beginPath(); x.arc(r() * S, r() * S, 2 + r() * 5, 0, TAU); x.fill(); }   // lichen
  }, true);
}
function groundTexture() {
  return canvasTex(512, 512, (x, S) => {
    const r = rng(17);
    x.fillStyle = grey(232); x.fillRect(0, 0, S, S);
    for (let i = 0; i < 160; i++) {   // big soft patches of lighter and darker ground, wrapped so the tile repeats cleanly
      const px = r() * S, py = r() * S, rad = 25 + r() * 80, dark = r() < 0.55;
      for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
        const g = x.createRadialGradient(px + ox, py + oy, 0, px + ox, py + oy, rad);
        g.addColorStop(0, dark ? 'rgba(0,0,0,0.13)' : 'rgba(255,255,255,0.16)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = g; x.fillRect(px + ox - rad, py + oy - rad, rad * 2, rad * 2);
      }
    }
    for (let i = 0; i < 14000; i++) { x.fillStyle = grey(r() < 0.5 ? 120 + r() * 60 : 235 + r() * 20, 0.12 + r() * 0.22); x.fillRect(r() * S, r() * S, 1 + r() * 2, 1 + r() * 2); }
  }, true);
}

// ---------------------------------------------------------------- geometry
const cardAt = (w, h, rnd, rot, x, y, z) => { const q = new THREE.PlaneGeometry(w, h); if (rot) rot(q, rnd); q.translate(x, y, z); return q; };
// a ball of crossing leaf cards
function crownGeo(seed, n, rx, ry, rz, size, cy) {
  const rnd = rng(seed), parts = [];
  for (let i = 0; i < n; i++) {
    const th = rnd() * TAU, ph = Math.acos(2 * rnd() - 1), k = 0.35 + 0.65 * Math.cbrt(rnd());
    parts.push(cardAt(size * (0.8 + rnd() * 0.6), size * (0.8 + rnd() * 0.6), rnd, (q, r) => { q.rotateX((r() - 0.5) * 2.4); q.rotateY(r() * TAU); q.rotateZ((r() - 0.5) * 1.3); },
      Math.sin(ph) * Math.cos(th) * rx * k, cy + Math.cos(ph) * ry * k * 0.85, Math.sin(ph) * Math.sin(th) * rz * k));
  }
  return mergeGeometries(parts);
}
// tiers of drooping needle branches
function pineGeo(seed) {
  const rnd = rng(seed), parts = [], tiers = 7;
  for (let t = 0; t < tiers; t++) {
    const f = t / (tiers - 1), L = 2.7 * (1 - f) + 0.55, y = 1.7 + t * 1.05, m = t > 4 ? 6 : 9;
    for (let k = 0; k < m; k++) {
      const a = (k / m) * TAU + rnd() * 0.5, q = new THREE.PlaneGeometry(1.5 + (1 - f), L);
      q.translate(0, L / 2, 0); q.rotateX(-Math.PI / 2 - 0.45 - rnd() * 0.25); q.rotateY(a); q.translate(0, y, 0); parts.push(q);
    }
  }
  for (let k = 0; k < 2; k++) { const q = new THREE.PlaneGeometry(0.9, 2.2); q.rotateY(k * Math.PI / 2); q.translate(0, 8.9, 0); parts.push(q); }
  return mergeGeometries(parts);
}
function palmGeo() {
  const rnd = rng(21), parts = [];
  for (let k = 0; k < 11; k++) { const q = new THREE.PlaneGeometry(1.1, 3.6); q.translate(0, 1.8, 0); q.rotateX(-Math.PI / 2 - 0.2 - rnd() * 0.6); q.rotateY((k / 11) * TAU + rnd() * 0.3); q.translate(0, 6.0, 0); parts.push(q); }
  return mergeGeometries(parts);
}
// crossed grass cards
function tuftGeo() {
  const parts = [];
  for (let k = 0; k < 3; k++) { const q = new THREE.PlaneGeometry(0.75, 0.55); q.translate(0, 0.27, 0); q.rotateY((k / 3) * Math.PI); parts.push(q); }
  return mergeGeometries(parts);
}
// tapered trunk with a few branches, UV-mapped so the bark texture runs up the wood
function trunkGeo(height, rBottom, rTop, branches) {
  const parts = [new THREE.CylinderGeometry(rTop, rBottom, height, 9, 3)];
  parts[0].translate(0, height / 2, 0);
  const rnd = rng(31);
  for (let i = 0; i < branches; i++) {
    const b = new THREE.CylinderGeometry(rTop * 0.35, rTop * 0.7, 1.7, 6); b.translate(0, 0.85, 0);
    b.rotateZ(0.6 + rnd() * 0.5); b.rotateY(rnd() * TAU); b.translate(0, height * (0.55 + rnd() * 0.35), 0); parts.push(b);
  }
  return mergeGeometries(parts);
}
// a lumpy, noise-shaped rock with a flat-ish base
function rockGeo(seed, angular) {
  let g = new THREE.IcosahedronGeometry(0.5, 4); g.deleteAttribute('normal'); g.deleteAttribute('uv'); g = mergeVertices(g, 1e-4);
  const p = g.attributes.position, v = new THREE.Vector3(), uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    let n = vnoise(v.x * 1.7 + seed, v.y * 1.7 + seed * 1.3, v.z * 1.7) * 0.6 + vnoise(v.x * 4 + seed, v.y * 4, v.z * 4 + seed) * 0.28 + vnoise(v.x * 9, v.y * 9 + seed, v.z * 9) * 0.12 + vnoise(v.x * 18 + seed, v.y * 18, v.z * 18) * 0.05;
    if (angular) n = Math.round(n * 7) / 7;   // stepped, so the surface breaks into flat facets
    v.multiplyScalar(0.5 * (0.62 + 0.75 * n));
    if (v.y < -0.18) v.y = -0.18 + (v.y + 0.18) * 0.08;
    p.setXYZ(i, v.x, v.y, v.z);
    uv[i * 2] = Math.atan2(v.z, v.x) / TAU + 0.5; uv[i * 2 + 1] = v.y + 0.5;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return angular ? g.toNonIndexed() : g;
}

let cache = null;
export function getNature() {
  if (cache) return cache;
  const tex = { leaf: leafTexture(), pine: pineTexture(), frond: frondTexture(), grass: grassTexture(), bark: barkTexture(), rock: rockTexture(), ground: groundTexture() };
  tex.ground.repeat.set(150, 150);
  const geo = {
    crownA: crownGeo(101, 46, 2.7, 2.0, 2.7, 2.3, 4.3), crownB: crownGeo(202, 50, 2.9, 2.3, 2.9, 2.3, 4.6),
    bush: crownGeo(303, 16, 1.0, 0.62, 1.0, 1.15, 0.55), pineCrown: pineGeo(404), palmCrown: palmGeo(), tuft: tuftGeo(),
    trunkL: trunkGeo(4.2, 0.36, 0.22, 4), trunkP: trunkGeo(3.6, 0.36, 0.16, 0), trunkPalm: trunkGeo(6.2, 0.3, 0.2, 0),
    rockA: rockGeo(1.3, false), rockB: rockGeo(5.7, true), rockC: rockGeo(9.1, false),
  };
  // which texture each instanced shape wears: foliage is alpha-cut, wood is bark, stone is rock
  const kind = { crownA: 'leaf', crownB: 'leaf', bush: 'leaf', pineCrown: 'pine', palmCrown: 'frond', tuft: 'grass', trunkL: 'bark', trunkP: 'bark', trunkPalm: 'bark', rockA: 'rock', rockB: 'rock', rockC: 'rock' };
  cache = { tex, geo, kind };
  return cache;
}
