import * as THREE from 'three';
import { damp, lerp } from './util.js';

// Shared low-poly humanoid parts (never disposed).
const G = {
  torso: new THREE.BoxGeometry(0.52, 0.66, 0.3),
  head: new THREE.BoxGeometry(0.27, 0.28, 0.27),
  arm: new THREE.BoxGeometry(0.15, 0.62, 0.16),
  leg: new THREE.BoxGeometry(0.2, 0.86, 0.22),
  hat: new THREE.BoxGeometry(0.31, 0.09, 0.31),
  gun: new THREE.BoxGeometry(0.07, 0.52, 0.1),
  pack: new THREE.BoxGeometry(0.36, 0.42, 0.16),
  mark: new THREE.OctahedronGeometry(0.17),
};
G.arm.translate(0, -0.31, 0);
G.leg.translate(0, -0.43, 0);
G.gun.translate(0, -0.78, 0.07);

const mats = new Map();
export const cmat = (c) => {
  let m = mats.get(c);
  if (!m) { m = new THREE.MeshLambertMaterial({ color: c }); mats.set(c, m); }
  return m;
};

// Character faces +Z. Its right-hand side is -X.
export function makeHumanoid(o = {}) {
  const group = new THREE.Group(), body = new THREE.Group();
  group.rotation.order = 'YXZ';
  group.add(body);
  const mk = (geo, color, x, y, z) => {
    const m = new THREE.Mesh(geo, cmat(color));
    m.position.set(x, y, z); m.castShadow = true; body.add(m); return m;
  };
  const skin = o.skin ?? 0xc99a72, shirt = o.shirt ?? 0x445566, pants = o.pants ?? 0x2c2f36;
  const h = { group, body, phase: Math.random() * 6, deadT: 0, crouchK: 0, punchT: 1 };
  h.torso = mk(G.torso, shirt, 0, 1.19, 0);
  h.head = mk(G.head, skin, 0, 1.67, 0);
  if (o.hat != null) mk(G.hat, o.hat, 0, 1.84, 0);
  if (o.pack != null) mk(G.pack, o.pack, 0, 1.22, -0.23);
  h.armL = mk(G.arm, shirt, 0.34, 1.48, 0);
  h.armR = mk(G.arm, shirt, -0.34, 1.48, 0);
  h.legL = mk(G.leg, pants, 0.13, 0.86, 0);
  h.legR = mk(G.leg, pants, -0.13, 0.86, 0);
  if (o.gun) { h.gun = new THREE.Mesh(G.gun, cmat(0x18181a)); h.armR.add(h.gun); }
  if (o.mark) {
    h.mark = new THREE.Mesh(G.mark, new THREE.MeshBasicMaterial({ color: 0xffd23c, fog: false }));
    h.mark.position.y = 2.25; h.mark.visible = false; group.add(h.mark);
  }
  if (o.scale) group.scale.setScalar(o.scale);
  return h;
}

export function animateHumanoid(h, s, dt) {
  if (s.dead) {
    h.deadT = Math.min(1, h.deadT + dt * 2.6);
    const k = h.deadT * h.deadT;
    h.group.rotation.x = -Math.PI / 2 * k;
    h.body.position.y = 0.12 * k;
    if (h.mark) h.mark.visible = false;
    return;
  }
  const sp = s.speed || 0;
  h.phase += dt * (2 + sp * 1.9);
  const sw = Math.sin(h.phase) * Math.min(1, sp / 2.5) * 0.75;
  const ck = s.kneel ? 1 : s.crouch ? 0.7 : 0;
  h.crouchK = damp(h.crouchK, ck, 12, dt);
  h.body.position.y = -0.42 * h.crouchK;
  h.legL.rotation.x = sw - 1.15 * h.crouchK;
  h.legR.rotation.x = -sw + 0.75 * h.crouchK;
  h.torso.rotation.x = 0.22 * h.crouchK;
  h.punchT = Math.min(1, h.punchT + dt * 4.5);
  const punch = h.punchT < 1 ? Math.sin(h.punchT * Math.PI) : 0;
  let aR = -sw * 0.8, aL = sw * 0.8, zR = 0, zL = 0;
  if (s.aim) { aR = -Math.PI / 2 - (s.pitch || 0); aL = -1.35 - (s.pitch || 0); zL = -0.45; }
  if (s.block) { aR = aL = -2.2; zL = -0.5; zR = 0.5; }
  if (s.hands === 'tied') { aR = aL = 0.55; }
  if (s.hands === 'up') { aR = aL = Math.PI * 0.95; }
  if (s.hands === 'drive') { aR = aL = -1.2; }
  if (punch) aR = lerp(aR, -1.7, punch);
  h.armR.rotation.set(aR, 0, zR);
  h.armL.rotation.set(aL, 0, zL);
}

export function makeChute() {
  const g = new THREE.Group();
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(3.4, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: 0x4a5a3c, side: THREE.DoubleSide }));
  canopy.scale.y = 0.55; canopy.position.y = 6.2; g.add(canopy);
  const lineGeo = new THREE.BufferGeometry();
  const pts = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    pts.push(0, 1.6, 0, Math.cos(a) * 3.3, 6.3, Math.sin(a) * 3.3);
  }
  lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  g.add(new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: 0xcccccc })));
  g.visible = false;
  return g;
}
