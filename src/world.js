import * as THREE from 'three';
import { clamp } from './util.js';

export const THEMES = {
  night: { label: 'Night', top: 0x03050d, horizon: 0x18233f, fog: 0x0b1220, fogNear: 40, fogFar: 640, hemiSky: 0x6f88cc, hemiGround: 0x141a24, hemi: 2.6, sun: 0x9db4ff, sunI: 1.7, sunDir: [-0.5, 0.8, 0.35], stars: true, view: 27, lit: 0.5, exposure: 1.4 },
  blackout: { label: 'Blackout', top: 0x020308, horizon: 0x251a2c, fog: 0x0a0b14, fogNear: 35, fogFar: 560, hemiSky: 0x6677b0, hemiGround: 0x15131c, hemi: 2.3, sun: 0xa8b8ff, sunI: 1.6, sunDir: [0.4, 0.75, -0.4], stars: true, view: 25, lit: 0.03, exposure: 1.4 },
  dusk: { label: 'Dusk', top: 0x1c1a40, horizon: 0xff8a4a, fog: 0x5a3a4c, fogNear: 60, fogFar: 800, hemiSky: 0xa594d0, hemiGround: 0x33232a, hemi: 2.3, sun: 0xffa25e, sunI: 2.4, sunDir: [-0.75, 0.34, -0.4], stars: true, view: 36, lit: 0.45, exposure: 1.2 },
  day: { label: 'Day', top: 0x2f7fd8, horizon: 0xcfe6fa, fog: 0xcfe0ee, fogNear: 140, fogFar: 1300, hemiSky: 0xdcecff, hemiGround: 0x8a7a5a, hemi: 2.1, sun: 0xfff1d6, sunI: 2.5, sunDir: [0.45, 0.85, 0.3], stars: false, view: 48, lit: 0, exposure: 1 },
  dawn: { label: 'Dawn', top: 0x5a7fb0, horizon: 0xffd2a8, fog: 0xc9d3de, fogNear: 90, fogFar: 950, hemiSky: 0xcfdcf0, hemiGround: 0x8090a0, hemi: 2.0, sun: 0xffd0a0, sunI: 2.0, sunDir: [0.7, 0.36, -0.3], stars: false, view: 42, lit: 0.15, exposure: 1 },
};

const STYLES = {
  city: { base: '#5d6b7c', win: '#17212c', lit: '#ffd98a', tints: [0xffffff, 0xd8c8b8, 0xb8c8e0, 0x9aa7b5, 0xc7b4a0], roof: 0x2a2e34 },
  port: { base: '#6b5348', win: '#1a1d22', lit: '#ffc56b', tints: [0xffffff, 0xcfc0b0, 0xa8a8b0, 0xb89a88], roof: 0x2b2a2a },
  industrial: { base: '#a08f78', win: '#2b241c', lit: '#ffcf80', tints: [0xffffff, 0xe8d8c0, 0xc8b8a0, 0xb0b0a8], roof: 0x6f6456 },
  mountain: { base: '#7c858c', win: '#20262c', lit: '#ffe0a0', tints: [0xffffff, 0xdde4ea, 0xb8c0c8], roof: 0xe9eef2 },
  warehouse: { base: '#5a6470', stripes: true, tints: [0xffffff, 0xc0b090, 0x90a8b0, 0xb08070], roof: 0x3a3f45 },
};

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler();

export class World {
  constructor(scene, themeName, opts = {}) {
    this.scene = scene;
    this.themeName = THEMES[themeName] ? themeName : 'day';
    this.theme = THEMES[this.themeName];
    this.shadows = opts.shadows !== false;
    this.root = new THREE.Group(); scene.add(this.root);
    this.boxes = [];
    this.batches = new Map();
    this.nav = []; this.adj = [];
    this.bound = 400;
    this.zMax = 400;
    this.disposables = [];
    this.geo = {
      box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 10),
      cone: new THREE.ConeGeometry(0.5, 1, 7), sph: new THREE.SphereGeometry(0.5, 10, 8),
      plane: new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    };
    this.styleMats = {};
    this._env();
  }

  _env() {
    const t = this.theme, sc = this.scene;
    sc.fog = new THREE.Fog(t.fog, t.fogNear, t.fogFar);
    sc.background = new THREE.Color(t.fog);
    // gradient sky dome
    const sg = new THREE.SphereGeometry(4200, 24, 12);
    const top = new THREE.Color(t.top), hor = new THREE.Color(t.horizon), fogc = new THREE.Color(t.fog), c = new THREE.Color();
    const col = [];
    for (let i = 0; i < sg.attributes.position.count; i++) {
      const y = sg.attributes.position.getY(i) / 4200;
      if (y < 0.02) c.copy(fogc); else if (y < 0.18) c.copy(fogc).lerp(hor, (y - 0.02) / 0.16); else c.copy(hor).lerp(top, Math.min(1, (y - 0.18) / 0.5));
      col.push(c.r, c.g, c.b);
    }
    sg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    this.sky = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    this.sky.renderOrder = -10; this.sky.frustumCulled = false; this.root.add(this.sky);
    if (t.stars) {
      const sp = [];
      for (let i = 0; i < 700; i++) {
        const a = Math.random() * Math.PI * 2, e = Math.asin(0.08 + Math.random() * 0.92);
        sp.push(Math.cos(a) * Math.cos(e) * 3900, Math.sin(e) * 3900, Math.sin(a) * Math.cos(e) * 3900);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
      const st = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: this.themeName === 'dusk' ? 0.45 : 0.9 }));
      st.frustumCulled = false; this.sky.add(st);
    }
    const sd = new THREE.Vector3(...t.sunDir).normalize();
    const orb = new THREE.Mesh(new THREE.SphereGeometry(t.stars && this.themeName !== 'dusk' ? 90 : 150, 16, 12), new THREE.MeshBasicMaterial({ color: t.sun, fog: false }));
    orb.position.copy(sd).multiplyScalar(3800); this.sky.add(orb);
    this.hemi = new THREE.HemisphereLight(t.hemiSky, t.hemiGround, t.hemi); sc.add(this.hemi);
    this.sun = new THREE.DirectionalLight(t.sun, t.sunI); this.sunDir = sd;
    if (this.shadows) {
      this.sun.castShadow = true;
      const s = this.sun.shadow; s.mapSize.set(2048, 2048);
      s.camera.left = -85; s.camera.right = 85; s.camera.top = 85; s.camera.bottom = -85; s.camera.near = 1; s.camera.far = 520;
      s.bias = -0.0006; s.normalBias = 0.4;
    }
    sc.add(this.sun); sc.add(this.sun.target);
  }

  ground(color) {
    const g = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color }));
    g.receiveShadow = true; this.root.add(g);
  }

  // ---------- batched primitives ----------
  inst(geo, color, x, y, z, sx, sy, sz, o = {}) {
    const key = geo + '|' + color + '|' + (o.glow ? 1 : 0) + '|' + (o.layer || 0) + '|' + (o.alpha || 1);
    let b = this.batches.get(key);
    if (!b) { b = { geo, color, o: { glow: o.glow, layer: o.layer, alpha: o.alpha }, mats: [] }; this.batches.set(key, b); }
    _e.set(o.rx || 0, o.ry || 0, o.rz || 0); _q.setFromEuler(_e);
    _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
    b.mats.push(_m.clone());
  }
  solid(x, z, w, d, y1, y0 = 0) { this.boxes.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, y0, y1 }); }
  // box standing on the ground (or y0) with a collider
  block(x, z, w, d, h, color, o = {}) {
    const y0 = o.y0 || 0;
    this.inst('box', color, x, y0 + h / 2, z, w, h, d, o);
    if (o.solid !== false) this.solid(x, z, w, d, y0 + h, y0);
  }
  deco(x, y, z, w, h, d, color, o) { this.inst('box', color, x, y, z, w, h, d, o); }
  flat(x, z, w, d, color, layer = 1) { this.inst('plane', color, x, 0.01 * layer, z, w, 1, d, { layer }); }

  _styleMat(style, tint) {
    const key = style + tint;
    if (this.styleMats[key]) return this.styleMats[key];
    const st = STYLES[style];
    let tex = this.styleMats['tex' + style];
    if (!tex) {
      const c = document.createElement('canvas'), e = document.createElement('canvas');
      c.width = c.height = e.width = e.height = 128;
      const x = c.getContext('2d'), xe = e.getContext('2d');
      x.fillStyle = st.base; x.fillRect(0, 0, 128, 128);
      xe.fillStyle = '#000'; xe.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(0,0,0,${Math.random() * 0.08})`; x.fillRect(Math.random() * 128, Math.random() * 128, 2 + Math.random() * 10, 1); }
      let lit = false;
      if (st.stripes) {
        for (let i = 0; i < 128; i += 8) { x.fillStyle = 'rgba(0,0,0,0.16)'; x.fillRect(i, 0, 2, 128); x.fillStyle = 'rgba(255,255,255,0.05)'; x.fillRect(i + 3, 0, 1, 128); }
      } else {
        for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
          const on = Math.random() < this.theme.lit;
          x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(i * 32 + 5, j * 32 + 6, 22, 20);
          x.fillStyle = on ? st.lit : st.win; x.fillRect(i * 32 + 7, j * 32 + 8, 18, 16);
          if (on) { lit = true; xe.fillStyle = st.lit; xe.fillRect(i * 32 + 7, j * 32 + 8, 18, 16); }
        }
      }
      const mk = (cv) => { const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; this.disposables.push(t); return t; };
      tex = this.styleMats['tex' + style] = { map: mk(c), em: lit ? mk(e) : null };
    }
    const m = new THREE.MeshLambertMaterial({ map: tex.map, color: tint });
    if (tex.em) { m.emissive = new THREE.Color(0xffffff); m.emissiveMap = tex.em; m.emissiveIntensity = 1.1; }
    this.disposables.push(m);
    return (this.styleMats[key] = m);
  }

  building(x, z, w, d, h, style, r = Math.random) {
    const st = STYLES[style] || STYLES.city;
    const tint = st.tints[Math.floor(r() * st.tints.length)];
    const side = this._styleMat(STYLES[style] ? style : 'city', tint);
    let roof = this.styleMats['roof' + st.roof];
    if (!roof) { roof = this.styleMats['roof' + st.roof] = new THREE.MeshLambertMaterial({ color: st.roof }); this.disposables.push(roof); }
    const geo = new THREE.BoxGeometry(w, h, d), uv = geo.attributes.uv;
    for (let i = 0; i < 24; i++) {
      const face = i >> 2;
      if (face === 2 || face === 3) continue;
      const fw = face < 2 ? d : w;
      uv.setXY(i, uv.getX(i) * Math.max(0.25, Math.round(fw / 3) / 4), uv.getY(i) * h / 12);
    }
    const mesh = new THREE.Mesh(geo, [side, side, roof, roof, side, side]);
    mesh.position.set(x, h / 2, z); mesh.castShadow = true; mesh.receiveShadow = true;
    this.root.add(mesh); this.disposables.push(geo);
    this.solid(x, z, w, d, h);
    if (h > 8 && r() < 0.6) this.deco(x + (r() - 0.5) * w * 0.4, h + 0.7, z + (r() - 0.5) * d * 0.4, 2.5, 1.4, 2.5, 0x555b63);
    return mesh;
  }

  // ---------- props ----------
  tree(x, z, kind = 'leaf', s = 1) {
    if (kind === 'pine') {
      this.inst('cyl', 0x4a3520, x, 1.2 * s, z, 0.5 * s, 2.4 * s, 0.5 * s);
      this.inst('cone', 0x1f4a2e, x, 4.2 * s, z, 4.4 * s, 5 * s, 4.4 * s);
      this.inst('cone', this.themeName === 'day' ? 0x2a5c38 : 0xdfe8ee, x, 6.8 * s, z, 3 * s, 3.6 * s, 3 * s);
    } else if (kind === 'palm') {
      this.inst('cyl', 0x7a6040, x, 3 * s, z, 0.4 * s, 6 * s, 0.4 * s, { rz: 0.08 });
      for (let i = 0; i < 5; i++) this.inst('box', 0x3f7a35, x + Math.sin(i * 1.26) * 1.4 * s, 6 * s, z + Math.cos(i * 1.26) * 1.4 * s, 1.3 * s, 0.12, 3.4 * s, { ry: i * 1.26, rx: 0.35 });
    } else {
      this.inst('cyl', 0x4a3520, x, 1.4 * s, z, 0.5 * s, 2.8 * s, 0.5 * s);
      this.inst('sph', 0x2d5a2a, x, 4.4 * s, z, 4.6 * s, 4.2 * s, 4.6 * s);
    }
    this.solid(x, z, 0.7, 0.7, 3);
  }
  lamp(x, z) {
    this.inst('cyl', 0x30343a, x, 3, z, 0.18, 6, 0.18);
    this.inst('sph', this.theme.lit > 0.1 ? 0xffe2a0 : 0x8a8a80, x, 6.1, z, 0.7, 0.5, 0.7, { glow: this.theme.lit > 0.1 });
  }
  crate(x, z, s = 1.4, color = 0x7a5a36) { this.block(x, z, s, s, s, color); }
  container(x, z, alongX, color, levels = 1) {
    for (let l = 0; l < levels; l++) this.inst('box', l ? (color ^ 0x151515) : color, x, 1.3 + l * 2.6, z, alongX ? 12 : 2.5, 2.55, alongX ? 2.5 : 12);
    this.solid(x, z, alongX ? 12 : 2.5, alongX ? 2.5 : 12, 2.6 * levels);
  }
  barrel(x, z, color = 0x8a2a22) { this.inst('cyl', color, x, 0.6, z, 0.9, 1.2, 0.9); this.solid(x, z, 0.8, 0.8, 1.2); }
  sandbags(x, z, w, alongX = true) { this.block(x, z, alongX ? w : 0.9, alongX ? 0.9 : w, 1.05, 0x9a8a66); }
  rock(x, z, s = 2) { this.inst('sph', 0x6a6660, x, s * 0.3, z, s * 1.6, s, s * 1.3, { ry: x }); this.solid(x, z, s, s * 0.8, s * 0.7); }
  tower(x, z, h = 9) {
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      this.inst('box', 0x4a3f33, x + a * 1.7, h / 2, z + b * 1.7, 0.35, h, 0.35);
      this.inst('box', 0x4a3f33, x + a * 1.9, h + 1.3, z + b * 1.9, 0.2, 2.6, 0.2);
    }
    this.inst('box', 0x5a4c3c, x, h - 0.15, z, 4.4, 0.3, 4.4);
    this.inst('box', 0x3c4238, x, h + 2.7, z, 4.8, 0.25, 4.8);
    for (const [a, b, w, d] of [[0, -2, 4.2, 0.15], [0, 2, 4.2, 0.15], [-2, 0, 0.15, 4.2], [2, 0, 0.15, 4.2]]) this.inst('box', 0x5a4c3c, x + a, h + 0.5, z + b, w, 1, d);
    this.solid(x, z, 4, 4, h);
    return { x, y: h, z };
  }
  shed(x, z, w, d, color = 0x55606a) {
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) this.block(x + a * (w / 2 - 0.2), z + b * (d / 2 - 0.2), 0.35, 0.35, 3.2, 0x3a3a3a);
    this.inst('box', color, x, 3.35, z, w + 0.8, 0.25, d + 0.8);
    this.flat(x, z, w, d, 0x3a3d42, 2);
  }
  mountains(n, r0, r1, hMin, hMax, color, cap) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.2, r = r0 + Math.random() * (r1 - r0), h = hMin + Math.random() * (hMax - hMin);
      const x = Math.cos(a) * r, z = Math.sin(a) * r, w = h * (1.8 + Math.random());
      this.inst('cone', color, x, h / 2 - 2, z, w, h, w);
      if (cap != null) this.inst('cone', cap, x, h * 0.85 - 2, z, w * 0.31, h * 0.31, w * 0.31);
    }
  }
  water(z0) {
    this.inst('plane', 0x12324a, 0, 0.06, z0 + 2000, 9000, 1, 4000, { layer: 3 });
    this.zMax = z0 - 4;
  }

  finalize() {
    for (const b of this.batches.values()) {
      const o = b.o;
      let mat;
      if (o.glow) mat = new THREE.MeshBasicMaterial({ color: b.color });
      else mat = new THREE.MeshLambertMaterial({ color: b.color });
      if (o.layer) { mat.polygonOffset = true; mat.polygonOffsetFactor = -2 * o.layer; mat.polygonOffsetUnits = -2 * o.layer; }
      if (o.alpha && o.alpha < 1) { mat.transparent = true; mat.opacity = o.alpha; }
      const im = new THREE.InstancedMesh(this.geo[b.geo], mat, b.mats.length);
      b.mats.forEach((m, i) => im.setMatrixAt(i, m));
      im.instanceMatrix.needsUpdate = true;
      im.castShadow = !o.layer && !o.glow; im.receiveShadow = true; im.frustumCulled = false;
      this.root.add(im); this.disposables.push(mat);
    }
    this.batches.clear();
    this._buildNav();
  }

  update(focus) {
    this.sky.position.set(focus.x, 0, focus.z);
    this.sun.target.position.set(focus.x, 0, focus.z);
    this.sun.position.set(focus.x + this.sunDir.x * 220, this.sunDir.y * 220, focus.z + this.sunDir.z * 220);
    // thin the fog out when high up so the ground stays readable from aircraft
    const k = clamp(focus.y / 250, 0, 1);
    this.scene.fog.far = this.theme.fogFar * (1 + k * 2.2);
    this.scene.fog.near = this.theme.fogNear * (1 + k * 3);
  }

  dispose() {
    this.root.traverse((o) => { if (o.isInstancedMesh) o.dispose(); });
    for (const d of this.disposables) d.dispose();
    for (const k in this.geo) this.geo[k].dispose();
    this.sky.geometry.dispose();
    this.scene.remove(this.root);
  }

  // ---------- collision ----------
  resolveCircle(p, r, y, hgt = 1.8) {
    let hit = false;
    for (const b of this.boxes) {
      if (b.y1 <= y + 0.5 || b.y0 >= y + hgt) continue;
      const cx = clamp(p.x, b.x0, b.x1), cz = clamp(p.z, b.z0, b.z1);
      const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      hit = true;
      if (d2 > 1e-8) { const d = Math.sqrt(d2), push = r - d; p.x += dx / d * push; p.z += dz / d * push; }
      else {
        const l = p.x - b.x0, rt = b.x1 - p.x, n = p.z - b.z0, f = b.z1 - p.z, m = Math.min(l, rt, n, f);
        if (m === l) p.x = b.x0 - r; else if (m === rt) p.x = b.x1 + r; else if (m === n) p.z = b.z0 - r; else p.z = b.z1 + r;
      }
    }
    const B = this.bound;
    if (p.x < -B) p.x = -B; else if (p.x > B) p.x = B;
    if (p.z < -B) p.z = -B; else if (p.z > Math.min(B, this.zMax)) p.z = Math.min(B, this.zMax);
    return hit;
  }
  groundAt(x, z, y) {
    let g = 0;
    for (const b of this.boxes) if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1 && b.y0 === 0 && b.y1 <= y + 0.55 && b.y1 > g) g = b.y1;
    return g;
  }
  inside(x, y, z, pad = 0) {
    for (const b of this.boxes) if (x > b.x0 - pad && x < b.x1 + pad && z > b.z0 - pad && z < b.z1 + pad && y > b.y0 - pad && y < b.y1 + pad) return true;
    return false;
  }
  // distance along a ray to the first solid (boxes or ground), capped at maxT
  raycast(ox, oy, oz, dx, dy, dz, maxT) {
    let best = maxT;
    if (dy < -1e-6) { const t = -oy / dy; if (t >= 0 && t < best) best = t; }
    for (const b of this.boxes) {
      let t0 = 0, t1 = best, a, c;
      if (Math.abs(dx) < 1e-9) { if (ox < b.x0 || ox > b.x1) continue; }
      else { a = (b.x0 - ox) / dx; c = (b.x1 - ox) / dx; if (a > c) { const s = a; a = c; c = s; } if (a > t0) t0 = a; if (c < t1) t1 = c; if (t0 > t1) continue; }
      if (Math.abs(dy) < 1e-9) { if (oy < b.y0 || oy > b.y1) continue; }
      else { a = (b.y0 - oy) / dy; c = (b.y1 - oy) / dy; if (a > c) { const s = a; a = c; c = s; } if (a > t0) t0 = a; if (c < t1) t1 = c; if (t0 > t1) continue; }
      if (Math.abs(dz) < 1e-9) { if (oz < b.z0 || oz > b.z1) continue; }
      else { a = (b.z0 - oz) / dz; c = (b.z1 - oz) / dz; if (a > c) { const s = a; a = c; c = s; } if (a > t0) t0 = a; if (c < t1) t1 = c; if (t0 > t1) continue; }
      if (t0 < best) best = t0;
    }
    return best;
  }
  los(ax, ay, az, bx, by, bz) {
    const dx = bx - ax, dy = by - ay, dz = bz - az, d = Math.hypot(dx, dy, dz);
    if (d < 0.01) return true;
    return this.raycast(ax, ay, az, dx / d, dy / d, dz / d, d) >= d - 0.02;
  }
  // 2D walkability test for a segment (agents of radius `pad`)
  segClear(ax, az, bx, bz, pad = 0.42) {
    const dx = bx - ax, dz = bz - az;
    for (const b of this.boxes) {
      if (b.y1 < 0.6 || b.y0 > 1.5) continue;
      let t0 = 0, t1 = 1, a, c;
      const x0 = b.x0 - pad, x1 = b.x1 + pad, z0 = b.z0 - pad, z1 = b.z1 + pad;
      if (Math.abs(dx) < 1e-9) { if (ax <= x0 || ax >= x1) continue; }
      else { a = (x0 - ax) / dx; c = (x1 - ax) / dx; if (a > c) { const s = a; a = c; c = s; } if (a > t0) t0 = a; if (c < t1) t1 = c; if (t0 >= t1) continue; }
      if (Math.abs(dz) < 1e-9) { if (az <= z0 || az >= z1) continue; }
      else { a = (z0 - az) / dz; c = (z1 - az) / dz; if (a > c) { const s = a; a = c; c = s; } if (a > t0) t0 = a; if (c < t1) t1 = c; if (t0 >= t1) continue; }
      return false;
    }
    return true;
  }

  // ---------- navigation graph ----------
  addNav(x, z) { this.nav.push({ x, z }); }
  _buildNav() {
    const n = this.nav.length;
    this.adj = this.nav.map(() => []);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const a = this.nav[i], b = this.nav[j], d = Math.hypot(a.x - b.x, a.z - b.z);
      if (d < 95 && this.segClear(a.x, a.z, b.x, b.z, 0.5)) { this.adj[i].push([j, d]); this.adj[j].push([i, d]); }
    }
  }
  _near(x, z) {
    const c = [];
    for (let i = 0; i < this.nav.length; i++) { const d = Math.hypot(this.nav[i].x - x, this.nav[i].z - z); if (d < 130) c.push([i, d]); }
    c.sort((a, b) => a[1] - b[1]);
    const out = [];
    for (let k = 0; k < c.length && k < 10 && out.length < 3; k++) if (this.segClear(x, z, this.nav[c[k][0]].x, this.nav[c[k][0]].z)) out.push(c[k]);
    return out;
  }
  // returns a list of waypoints ending at the goal, or null when no route is known
  findPath(ax, az, bx, bz) {
    if (this.segClear(ax, az, bx, bz)) return [{ x: bx, z: bz }];
    const starts = this._near(ax, az), goals = this._near(bx, bz);
    if (!starts.length || !goals.length) return null;
    const n = this.nav.length, dist = new Float32Array(n).fill(Infinity), prev = new Int16Array(n).fill(-1), done = new Uint8Array(n);
    for (const [i, d] of starts) dist[i] = d;
    for (;;) {
      let u = -1, best = Infinity;
      for (let i = 0; i < n; i++) if (!done[i] && dist[i] < best) { best = dist[i]; u = i; }
      if (u < 0) break;
      done[u] = 1;
      for (const [v, w] of this.adj[u]) if (dist[u] + w < dist[v]) { dist[v] = dist[u] + w; prev[v] = u; }
    }
    let g = -1, bg = Infinity;
    for (const [i, d] of goals) if (dist[i] + d < bg) { bg = dist[i] + d; g = i; }
    if (g < 0) return null;
    const path = [{ x: bx, z: bz }];
    for (let u = g; u >= 0; u = prev[u]) path.unshift(this.nav[u]);
    return path;
  }
}
