import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Optional real models in /public/models. Anything that fails to load falls back to the built-in shapes.
export const ASSETS = { cole: null, guns: {}, bike: null };

const BASE = import.meta.env.BASE_URL;
// file, length in metres, flip (model's stock end is in front)
const GUNS = { usp: [0.34, false], glock: [0.26, true], m4a1: [0.86, false], ak47: [0.88, true], l118a: [1.25, false] };

// Turn a gun model so the barrel points along +Z with the grip at the origin.
function prepareGun(src, len, flip) {
  const wrap = new THREE.Group(); wrap.add(src);
  const box = new THREE.Box3().setFromObject(src), size = box.getSize(new THREE.Vector3());
  if (size.x > size.z) wrap.rotation.y = -Math.PI / 2; // longest axis -> z
  wrap.updateMatrixWorld(true);
  // the heavy end (stock, grip, magazine) holds most of the vertices; the barrel is the other end
  let sum = 0, n = 0; const v = new THREE.Vector3();
  wrap.traverse((o) => {
    if (!o.isMesh) return;
    const pos = o.geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i += 3) { v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); sum += v.z; n++; }
  });
  box.setFromObject(wrap);
  if (n && sum / n > (box.min.z + box.max.z) / 2) wrap.rotation.y += Math.PI;
  if (flip) wrap.rotation.y += Math.PI;
  wrap.updateMatrixWorld(true); box.setFromObject(wrap);
  const out = new THREE.Group(); out.add(wrap);
  wrap.scale.setScalar(len / Math.max(1e-4, box.max.z - box.min.z));
  out.updateMatrixWorld(true); box.setFromObject(out);
  wrap.position.z -= box.min.z + 0.3 * (box.max.z - box.min.z); // grip about 30% from the back
  wrap.position.y -= box.min.y + 0.62 * (box.max.y - box.min.y);
  wrap.position.x -= (box.min.x + box.max.x) / 2;
  out.traverse((o) => { if (o.isMesh) { o.castShadow = true; if (o.material && o.material.color) { o.material.metalness = 0.55; o.material.roughness = 0.45; } } });
  out.userData.len = len;
  return out;
}

export async function loadAssets() {
  const L = new GLTFLoader(), safe = (p) => p.catch(() => null);
  const names = Object.keys(GUNS);
  const [cole, anims, bike, ...guns] = await Promise.all([
    safe(L.loadAsync(BASE + 'models/cole/cole.glb')),
    safe(fetch(BASE + 'models/cole/anims.json').then((r) => (r.ok ? r.json() : null))),
    safe(L.loadAsync(BASE + 'models/vehicles/bike.glb')),
    ...names.map((n) => safe(L.loadAsync(BASE + `models/guns/${n}.glb`))),
  ]);
  try {
    if (cole && anims && anims.idle && anims.run) {
      const box = new THREE.Box3().setFromObject(cole.scene), h = box.max.y - box.min.y;
      const clips = {};
      for (const n of ['idle', 'walk', 'run', 'death', 'jump']) if (anims[n]) clips[n] = THREE.AnimationClip.parse(anims[n]);
      if (h > 0) ASSETS.cole = { scene: cole.scene, clips, scale: 1.82 / h, offsetY: -box.min.y * (1.82 / h) };
    }
  } catch (e) { console.info('Soldier model not usable, using built-in figure', e); }
  names.forEach((n, i) => { try { if (guns[i]) ASSETS.guns[n] = prepareGun(guns[i].scene, GUNS[n][0], GUNS[n][1]); } catch { /* keep built-in */ } });
  try {
    if (bike) {
      const wrap = new THREE.Group(); wrap.add(bike.scene);
      let box = new THREE.Box3().setFromObject(wrap); const size = box.getSize(new THREE.Vector3());
      if (size.x > size.z) wrap.rotation.y = Math.PI / 2;
      wrap.updateMatrixWorld(true); box = new THREE.Box3().setFromObject(wrap);
      const out = new THREE.Group(); out.add(wrap);
      wrap.scale.multiplyScalar(2.25 / (box.max.z - box.min.z));
      out.updateMatrixWorld(true); box = new THREE.Box3().setFromObject(out);
      wrap.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
      out.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      ASSETS.bike = out;
    }
  } catch { /* keep built-in */ }
  return ASSETS;
}
