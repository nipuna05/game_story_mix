import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ASSETS } from './assets.js';
import { clamp, damp, lerp } from './util.js';
import { FINISHES } from './gear.js';

// ------------------------------------------------------------------ shared bits
const mats = new Map();
export const cmat = (c) => {
  let m = mats.get(c);
  if (!m) { m = new THREE.MeshLambertMaterial({ color: c }); mats.set(c, m); }
  return m;
};
const MARK = new THREE.OctahedronGeometry(0.17);
function addMark(h) {
  h.mark = new THREE.Mesh(MARK, new THREE.MeshBasicMaterial({ color: 0xffd23c, fog: false }));
  h.mark.position.y = 2.3; h.mark.visible = false; h.group.add(h.mark);
}

// built-in gun shapes, used when a model file is missing
const gunMat = new THREE.MeshStandardMaterial({ color: 0x1b1c1f, metalness: 0.6, roughness: 0.4 });
function basicGun(kind) {
  const g = new THREE.Group(), long = kind !== 'usp' && kind !== 'glock', len = kind === 'l118a' ? 1.2 : long ? 0.85 : 0.28;
  const add = (w, hh, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), gunMat); m.position.set(x, y, z); m.castShadow = true; g.add(m); };
  add(0.05, 0.07, len, 0, 0.02, len * 0.2); add(0.045, 0.14, 0.06, 0, -0.07, 0);
  if (long) { add(0.045, 0.16, 0.07, 0, -0.08, 0.22); add(0.05, 0.1, 0.26, 0, -0.01, -0.26); }
  g.userData.len = len;
  return g;
}
export function makeGun(kind, opts = {}) {
  const src = ASSETS.guns[kind];
  const g = src ? src.clone(true) : basicGun(kind);
  const fin = FINISHES[opts.finish | 0];
  if (fin && opts.finish > 0) {
    g.traverse((o) => {
      if (!o.isMesh) return;
      o.material = o.material.clone();
      o.material.color.multiply(new THREE.Color(fin.c));
      if (fin.metal) { o.material.metalness = 0.95; o.material.roughness = 0.22; }
    });
  }
  if (opts.supp) { // suppressor on the muzzle
    const len = g.userData.len || 0.5;
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.2, 12).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x15161a, metalness: 0.7, roughness: 0.35 }));
    can.position.set(0, 0.045, len * 0.7 + 0.09); g.add(can);
  }
  return g;
}
// shared by the soldier model and the blocky fallback
function bindGunSlot(h) {
  h.guns = {}; h.gunKind = null; h.gunKey = null; h.curGun = null;
  h.setGun = (kind, opts = {}) => {
    const key = kind ? kind + '|' + (opts.finish | 0) + (opts.supp ? 's' : '') : null;
    if (h.gunKey === key) return;
    h.gunKey = key; h.gunKind = kind;
    for (const k in h.guns) h.guns[k].visible = false;
    if (!kind) { h.curGun = null; return; }
    if (!h.guns[key]) { h.guns[key] = makeGun(kind, opts); h.gun.add(h.guns[key]); }
    h.guns[key].visible = true; h.curGun = h.guns[key];
  };
}

// ------------------------------------------------------------------ realistic soldier (skinned model + clips)
const tinted = new Map();
function tintMat(base, tint) {
  const key = base.uuid + tint;
  let m = tinted.get(key);
  if (!m) { m = base.clone(); m.color.setHex(tint); tinted.set(key, m); }
  return m;
}
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3(), _f = new THREE.Vector3(), _t = new THREE.Vector3(), _p = new THREE.Vector3();
const _q = new THREE.Quaternion(), _qw = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _gq = new THREE.Quaternion();

// rotate `bone` (in world space) so the direction `from` becomes `to`
function swing(bone, from, to) {
  _q.setFromUnitVectors(from, to);
  bone.getWorldQuaternion(_qw).premultiply(_q);
  bone.parent.getWorldQuaternion(_qp).invert();
  bone.quaternion.copy(_qp.multiply(_qw));
  bone.updateWorldMatrix(false, true);
}
// two-bone IK: put `end` at `target`, bending toward `pole` (all world space)
function ik2(upper, mid, end, target, pole) {
  upper.getWorldPosition(_a); mid.getWorldPosition(_b); end.getWorldPosition(_c);
  const l1 = _a.distanceTo(_b), l2 = _b.distanceTo(_c);
  _d.copy(target).sub(_a);
  const d = clamp(_d.length(), 0.02, (l1 + l2) * 0.995);
  _d.normalize();
  _e.copy(pole).addScaledVector(_d, -pole.dot(_d));
  if (_e.lengthSq() < 1e-6) _e.set(0, 0, 1);
  _e.normalize();
  const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d), hgt = Math.sqrt(Math.max(0, l1 * l1 - along * along));
  _f.copy(_a).addScaledVector(_d, along).addScaledVector(_e, hgt); // elbow / knee
  swing(upper, _b.sub(_a).normalize(), _f.sub(_a).normalize());
  mid.getWorldPosition(_b); end.getWorldPosition(_c);
  swing(mid, _c.sub(_b).normalize(), _t.copy(target).sub(_b).normalize());
}

// Headgear and packs attached to the skeleton, so each enemy type is recognisable at a glance. Sizes are in the
// rig's own units (centimetres under a 0.01 scale).
const gearMat = (c, rough = 0.85) => once2('g' + c + rough, () => new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: 0.05 }));
const memo = new Map();
function once2(k, f) { let v = memo.get(k); if (v === undefined) { v = f(); memo.set(k, v); } return v; }
function addGear(model, kind, color) {
  const head = model.getObjectByName('Head'), back = model.getObjectByName('Spine01') || model.getObjectByName('Spine');
  const add = (bone, geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { if (!bone) return; const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; bone.add(m); return m; };
  const mat = gearMat(color);
  if (kind === 'beret') { add(head, once2('beret', () => new THREE.CylinderGeometry(13.5, 14.5, 4.5, 20)), mat, 0, 22, 1.5, 0.12, 0, 0.1); add(head, once2('bband', () => new THREE.CylinderGeometry(12.2, 12.2, 2.2, 20)), mat, 0, 19.5, 0.5); }
  else if (kind === 'cap') { add(head, once2('cap', () => new THREE.CylinderGeometry(12, 12.6, 6, 18)), mat, 0, 21.5, 0.5); add(head, once2('visor', () => new THREE.BoxGeometry(17, 0.8, 11)), mat, 0, 19.2, 12.5, 0.15); }
  else if (kind === 'boonie') { add(head, once2('brim', () => new THREE.CylinderGeometry(22, 22, 0.8, 24)), mat, 0, 20.5, 0.5); add(head, once2('crown', () => new THREE.CylinderGeometry(11, 12.5, 7, 20)), mat, 0, 24, 0.5); }
  else if (kind === 'pack') { add(back, once2('pack', () => new THREE.BoxGeometry(34, 38, 16)), mat, 0, 4, -19); add(back, once2('roll', () => new THREE.CylinderGeometry(6, 6, 38, 12).rotateZ(Math.PI / 2)), gearMat(0x3a3a34), 0, -17, -19); }
  else if (kind === 'rig') { add(back, once2('rig', () => new THREE.BoxGeometry(32, 12, 16)), gearMat(0x1a1b1e), 0, 6, 3); }
}

function makeModel(o) {
  const T = ASSETS.cole;
  const group = new THREE.Group(), body = new THREE.Group();
  group.rotation.order = 'YXZ'; group.add(body);
  const model = SkeletonUtils.clone(T.scene);
  model.scale.setScalar(T.scale * (o.scale || 1)); model.position.y = T.offsetY * (o.scale || 1);
  model.traverse((m) => {
    if (!m.isMesh) return;
    m.castShadow = true;
    m.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 90, 0), 140);   // generous fixed bounds so the soldier is skipped when off screen
    if (o.tint != null && o.tint !== 0xffffff) m.material = tintMat(m.material, o.tint);
  });
  body.add(model);
  const mixer = new THREE.AnimationMixer(model), A = {};
  for (const n of ['idle', 'walk', 'run']) if (T.clips[n]) { A[n] = mixer.clipAction(T.clips[n]); A[n].play(); A[n].setEffectiveWeight(n === 'idle' ? 1 : 0); }
  if (T.clips.death) { A.death = mixer.clipAction(T.clips.death); A.death.setLoop(THREE.LoopOnce, 1); A.death.clampWhenFinished = true; }
  mixer.setTime(Math.random() * 2);
  for (const [kind, c] of o.gearList || []) addGear(model, kind, c);
  const B = (n) => model.getObjectByName(n);
  const b = {
    hips: B('Hips'), lUp: B('LeftUpLeg'), lLeg: B('LeftLeg'), lFoot: B('LeftFoot'), rUp: B('RightUpLeg'), rLeg: B('RightLeg'), rFoot: B('RightFoot'),
    lArm: B('LeftArm'), lFore: B('LeftForeArm'), lHand: B('LeftHand'), rArm: B('RightArm'), rFore: B('RightForeArm'), rHand: B('RightHand'),
  };
  const ok = Object.values(b).every(Boolean);
  const h = { group, body, model, mixer, A, b: ok ? b : null, punchT: 1, deadT: 0, crouchK: 0, aimK: 0, dead: false, guns: {}, gunKind: null, tick: 0, acc: 0 };
  h.gun = new THREE.Group(); h.gun.visible = false; group.add(h.gun);
  bindGunSlot(h);
  // far away a 20,000-triangle soldier is a few pixels: show a cheap capsule instead
  h.proxy = new THREE.Mesh(once2('proxyGeo', () => new THREE.CapsuleGeometry(0.24, 1.0, 2, 8)), gearMat(0x4a5238)); h.proxy.position.y = 0.85; h.proxy.visible = false; group.add(h.proxy);
  h.setLod = (far) => { if (h.proxy.visible === far) return; h.proxy.visible = far; model.visible = !far; h.gun.visible = !!h.hasGun && !far; };
  h.hasGun = !!o.gun;
  if (o.gun) { h.setGun(o.gunKind || 'ak47', o.gunOpts || {}); h.gun.visible = true; }
  if (o.mark) addMark(h);
  return h;
}

function animModel(h, s, dt) {
  if (h.proxy && h.proxy.visible) return;   // far away: nothing to animate
  const A = h.A;
  if (s.dead) {
    if (!h.dead) { h.dead = true; for (const n of ['idle', 'walk', 'run']) A[n] && A[n].setEffectiveWeight(0); if (A.death) { A.death.reset().setEffectiveWeight(1).play(); } h.gun.visible = false; if (h.mark) h.mark.visible = false; }
    if (h.deadT < 6) { h.deadT += dt; h.mixer.update(dt); if (!A.death) h.group.rotation.x = -Math.PI / 2 * Math.min(1, h.deadT * 2); }
    return;
  }
  if (h.dead) { h.dead = false; h.deadT = 0; if (A.death) A.death.stop(); h.group.rotation.x = 0; }
  // distant figures animate at a quarter of the rate
  if (s.far) { h.acc += dt; if (++h.tick % 4) return; dt = h.acc; h.acc = 0; }
  const sp = s.speed || 0;
  if (s.prone) { // crawl: the walk clip, slowed, with the weapon held out along the ground
    const m = clamp(sp / 0.8, 0, 1);
    if (A.idle) A.idle.setEffectiveWeight(1 - m);
    if (A.walk) { A.walk.setEffectiveWeight(m); A.walk.timeScale = 0.55; }
    if (A.run) A.run.setEffectiveWeight(0);
    h.mixer.update(dt);
    if (h.gun.visible && h.gunKind) { h.gun.position.set(-0.1, 1.72, 0.12); h.gun.rotation.set(-Math.PI / 2, 0, 0); }
    return;
  }
  const run = clamp((sp - 2.6) / 2.2, 0, 1), walk = clamp(sp / 1.0, 0, 1) * (1 - run);
  if (A.idle) A.idle.setEffectiveWeight(1 - walk - run);
  if (A.walk) { A.walk.setEffectiveWeight(walk); A.walk.timeScale = clamp(sp / 1.5, 0.7, 2); }
  if (A.run) { A.run.setEffectiveWeight(run); A.run.timeScale = clamp(sp / 5.2, 0.8, 1.5); }
  h.mixer.update(dt);
  const b = h.b; if (!b) return;
  h.punchT = Math.min(1, h.punchT + dt * 4.5);
  const punch = h.punchT < 1 ? Math.sin(h.punchT * Math.PI) : 0;
  h.crouchK = damp(h.crouchK, s.kneel ? 1 : s.crouch ? 0.62 : 0, 12, dt);
  const armed = h.gun.visible && h.gunKind;
  h.aimK = damp(h.aimK, s.aim ? 1 : 0, 14, dt);
  if (h.crouchK < 0.01 && !armed && !punch && !s.block && !s.hands) return;

  h.group.updateWorldMatrix(true, true);
  h.group.getWorldQuaternion(_gq);
  const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(_gq), up = new THREE.Vector3(0, 1, 0), right = new THREE.Vector3(-1, 0, 0).applyQuaternion(_gq);

  if (h.crouchK > 0.01) {
    const fl = b.lFoot.getWorldPosition(new THREE.Vector3()), fr = b.rFoot.getWorldPosition(new THREE.Vector3());
    b.hips.getWorldPosition(_p); _p.y -= 0.52 * h.crouchK; _p.addScaledVector(fwd, -0.1 * h.crouchK);
    b.hips.parent.worldToLocal(_p); b.hips.position.copy(_p); b.hips.updateWorldMatrix(false, true);
    const pole = new THREE.Vector3().copy(fwd).addScaledVector(up, 0.25);
    ik2(b.lUp, b.lLeg, b.lFoot, fl, pole); ik2(b.rUp, b.rLeg, b.rFoot, fr, pole);
  }

  const sh = new THREE.Vector3(), tgt = new THREE.Vector3(), pole = new THREE.Vector3();
  const reach = (arm, fore, hand, x, y, z, side) => { // target given in body space: x right, y up from the shoulder line, z forward
    b.lArm.getWorldPosition(sh).add(b.rArm.getWorldPosition(_p)).multiplyScalar(0.5);
    tgt.copy(sh).addScaledVector(right, x).addScaledVector(up, y).addScaledVector(fwd, z);
    pole.set(0, -1, 0).addScaledVector(right, side * 0.7).addScaledVector(fwd, -0.2);
    ik2(arm, fore, hand, tgt, pole);
  };
  if (s.hands === 'up') { reach(b.rArm, b.rFore, b.rHand, 0.35, 0.75, 0.05, 1); reach(b.lArm, b.lFore, b.lHand, -0.35, 0.75, 0.05, -1); }
  else if (s.hands === 'tied') { reach(b.rArm, b.rFore, b.rHand, 0.08, -0.5, -0.22, 1); reach(b.lArm, b.lFore, b.lHand, -0.08, -0.5, -0.22, -1); }
  else if (s.hands === 'drive') { reach(b.rArm, b.rFore, b.rHand, 0.3, -0.28, 0.5, 1); reach(b.lArm, b.lFore, b.lHand, -0.3, -0.28, 0.5, -1); }
  else if (s.block) { reach(b.rArm, b.rFore, b.rHand, 0.12, 0.12, 0.32, 1); reach(b.lArm, b.lFore, b.lHand, -0.12, 0.12, 0.32, -1); }
  else if (armed) {
    // weapon rides in front of the chest: low-ready normally, raised to the eye line when aiming
    const k = h.aimK, pitch = lerp(-0.55, clamp(s.pitch || 0, -1, 1), k), long = ((h.curGun && h.curGun.userData.len) || 0.8) > 0.5;
    b.lArm.getWorldPosition(sh).add(b.rArm.getWorldPosition(_p)).multiplyScalar(0.5);
    h.group.worldToLocal(_t.copy(sh));
    h.gun.position.set(-lerp(0.1, 0.13, k), _t.y + lerp(-0.26, 0.0, k), _t.z + lerp(0.24, long ? 0.3 : 0.44, k));
    h.gun.rotation.set(-pitch, lerp(0.25, 0, k), 0);
    h.gun.updateWorldMatrix(true, false);
    const grip = h.gun.localToWorld(new THREE.Vector3(0, -0.06, -0.02)), fore = h.gun.localToWorld(new THREE.Vector3(0, long ? -0.03 : -0.08, long ? 0.3 : 0.0));
    pole.set(0, -1, 0).addScaledVector(right, 0.7); ik2(b.rArm, b.rFore, b.rHand, grip, pole);
    pole.set(0, -1, 0).addScaledVector(right, -0.7); ik2(b.lArm, b.lFore, b.lHand, fore, pole);
  }
  if (punch) reach(b.rArm, b.rFore, b.rHand, 0.02, lerp(-0.2, 0.02, punch), lerp(0.2, 0.75, punch), 1);
}

// ------------------------------------------------------------------ built-in figure (fallback when the model file is missing)
const rb = (w, h, d, r = 0.05) => new RoundedBoxGeometry(w, h, d, 2, r);
const G = {
  torso: rb(0.52, 0.66, 0.3, 0.09), head: new THREE.SphereGeometry(0.16, 14, 10), arm: rb(0.15, 0.62, 0.16), leg: rb(0.2, 0.86, 0.22),
  hat: rb(0.31, 0.11, 0.31, 0.04), pack: rb(0.36, 0.42, 0.16),
};
G.arm.translate(0, -0.31, 0); G.leg.translate(0, -0.43, 0);

function makeBlocky(o) {
  const group = new THREE.Group(), body = new THREE.Group();
  group.rotation.order = 'YXZ'; group.add(body);
  const mk = (geo, color, x, y, z) => { const m = new THREE.Mesh(geo, cmat(color)); m.position.set(x, y, z); m.castShadow = true; body.add(m); return m; };
  const skin = o.skin ?? 0xc99a72, shirt = o.shirt ?? 0x445566, pants = o.pants ?? 0x2c2f36;
  const h = { group, body, phase: Math.random() * 6, deadT: 0, crouchK: 0, punchT: 1 };
  h.torso = mk(G.torso, shirt, 0, 1.19, 0); h.head = mk(G.head, skin, 0, 1.68, 0);
  if (o.hat != null) mk(G.hat, o.hat, 0, 1.83, 0);
  if (o.pack != null) mk(G.pack, o.pack, 0, 1.22, -0.23);
  h.armL = mk(G.arm, shirt, 0.34, 1.48, 0); h.armR = mk(G.arm, shirt, -0.34, 1.48, 0);
  h.legL = mk(G.leg, pants, 0.13, 0.86, 0); h.legR = mk(G.leg, pants, -0.13, 0.86, 0);
  h.gun = new THREE.Group(); h.gun.rotation.x = Math.PI / 2; h.gun.position.set(0, -0.62, 0.05); h.armR.add(h.gun);
  h.gun.visible = false;
  bindGunSlot(h);
  if (o.gun) { h.setGun(o.gunKind || 'ak47', o.gunOpts || {}); h.gun.visible = true; }
  if (o.mark) addMark(h);
  if (o.scale) group.scale.setScalar(o.scale);
  return h;
}

function animBlocky(h, s, dt) {
  if (s.dead) {
    h.deadT = Math.min(1, h.deadT + dt * 2.6);
    const k = h.deadT * h.deadT;
    h.group.rotation.x = -Math.PI / 2 * k; h.body.position.y = 0.12 * k;
    if (h.mark) h.mark.visible = false;
    return;
  }
  const sp = s.speed || 0;
  h.phase += dt * (2 + sp * 1.9);
  const sw = Math.sin(h.phase) * Math.min(1, sp / 2.5) * 0.75;
  h.crouchK = damp(h.crouchK, s.kneel ? 1 : s.crouch ? 0.7 : 0, 12, dt);
  h.body.position.y = -0.42 * h.crouchK;
  h.legL.rotation.x = sw - 1.15 * h.crouchK; h.legR.rotation.x = -sw + 0.75 * h.crouchK;
  h.torso.rotation.x = 0.22 * h.crouchK;
  h.punchT = Math.min(1, h.punchT + dt * 4.5);
  const punch = h.punchT < 1 ? Math.sin(h.punchT * Math.PI) : 0;
  let aR = -sw * 0.8, aL = sw * 0.8, zR = 0, zL = 0;
  if (s.aim) { aR = -Math.PI / 2 - (s.pitch || 0); aL = -1.35 - (s.pitch || 0); zL = -0.45; }
  if (s.block) { aR = aL = -2.2; zL = -0.5; zR = 0.5; }
  if (s.hands === 'tied') aR = aL = 0.55;
  if (s.hands === 'up') aR = aL = Math.PI * 0.95;
  if (s.hands === 'drive') aR = aL = -1.2;
  if (punch) aR = lerp(aR, -1.7, punch);
  h.armR.rotation.set(aR, 0, zR); h.armL.rotation.set(aL, 0, zL);
}

// ------------------------------------------------------------------ public API
// Character faces +Z; its right-hand side is -X. Returns a handle with .group, .gun, .setGun(kind), .mark
export function makeHumanoid(o = {}) { return ASSETS.cole ? makeModel(o) : makeBlocky(o); }
export function animateHumanoid(h, s, dt) { if (h.mixer) animModel(h, s, dt); else animBlocky(h, s, dt); }
export function reviveHumanoid(h) {
  h.deadT = 0; h.group.rotation.x = 0; h.body.position.y = 0;
  if (h.mixer && h.dead) { h.dead = false; if (h.A.death) h.A.death.stop(); if (h.A.idle) h.A.idle.setEffectiveWeight(1); }
}

export function makeChute() {
  const g = new THREE.Group();
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(3.4, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x55683f, side: THREE.DoubleSide, roughness: 0.9, flatShading: true }));
  canopy.scale.y = 0.55; canopy.position.y = 6.2; canopy.castShadow = true; g.add(canopy);
  const lineGeo = new THREE.BufferGeometry(), pts = [];
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; pts.push(0, 1.9, 0, Math.cos(a) * 3.3, 6.3, Math.sin(a) * 3.3); }
  lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  g.add(new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: 0xcccccc })));
  g.visible = false;
  return g;
}
