import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clamp } from './util.js';
import { ASSETS } from './assets.js';

export const THEMES = {
  night: { label: 'Night', top: 0x070b1c, horizon: 0x2a3d68, fog: 0x1a2744, fogNear: 60, fogFar: 760, hemiSky: 0x8aa4e6, hemiGround: 0x2a3446, hemi: 4.2, sun: 0xb4c6ff, sunI: 3.0, sunDir: [-0.5, 0.8, 0.35], stars: true, view: 27, lit: 0.5, exposure: 1.85, bloom: 0.4, cloud: 0x2a3a5c, env: 1.6 },
  blackout: { label: 'Blackout', top: 0x05070f, horizon: 0x2c2440, fog: 0x151a2c, fogNear: 45, fogFar: 640, hemiSky: 0x7c8ccc, hemiGround: 0x241f30, hemi: 3.6, sun: 0xb0c0ff, sunI: 2.6, sunDir: [0.4, 0.75, -0.4], stars: true, view: 25, lit: 0.03, exposure: 1.8, bloom: 0.45, cloud: 0x241f30, env: 1.4, weather: 'rain' },
  dusk: { label: 'Dusk', top: 0x1c1a40, horizon: 0xff8a4a, fog: 0x5a3a4c, fogNear: 60, fogFar: 800, hemiSky: 0xa594d0, hemiGround: 0x33232a, hemi: 2.3, sun: 0xffa25e, sunI: 2.4, sunDir: [-0.75, 0.34, -0.4], stars: true, view: 36, lit: 0.45, exposure: 1.2, bloom: 0.28, cloud: 0xc77a5a, env: 1.0 },
  day: { label: 'Day', top: 0x2f7fd8, horizon: 0xcfe6fa, fog: 0xcfe0ee, fogNear: 140, fogFar: 1300, hemiSky: 0xdcecff, hemiGround: 0x8a7a5a, hemi: 2.1, sun: 0xfff1d6, sunI: 2.5, sunDir: [0.45, 0.85, 0.3], stars: false, view: 48, lit: 0, exposure: 1, bloom: 0.12, cloud: 0xffffff, env: 1.0 },
  dawn: { label: 'Dawn', top: 0x5a7fb0, horizon: 0xffd2a8, fog: 0xc9d3de, fogNear: 90, fogFar: 950, hemiSky: 0xcfdcf0, hemiGround: 0x8090a0, hemi: 2.0, sun: 0xffd0a0, sunI: 2.0, sunDir: [0.7, 0.36, -0.3], stars: false, view: 42, lit: 0.15, exposure: 1, bloom: 0.15, cloud: 0xffe6d2, env: 1.0 },
};

const STYLES = {
  city: { base: '#5d6b7c', win: '#17212c', lit: '#ffd98a', tints: [0xffffff, 0xd8c8b8, 0xb8c8e0, 0x9aa7b5, 0xc7b4a0], roof: 0x2a2e34 },
  port: { base: '#6b5348', win: '#1a1d22', lit: '#ffc56b', tints: [0xffffff, 0xcfc0b0, 0xa8a8b0, 0xb89a88], roof: 0x2b2a2a },
  industrial: { base: '#a08f78', win: '#2b241c', lit: '#ffcf80', tints: [0xffffff, 0xe8d8c0, 0xc8b8a0, 0xb0b0a8], roof: 0x6f6456 },
  mountain: { base: '#7c858c', win: '#20262c', lit: '#ffe0a0', tints: [0xffffff, 0xdde4ea, 0xb8c0c8], roof: 0xe9eef2 },
  cabin: { base: '#7a5a3c', win: '#22180f', lit: '#ffcf80', tints: [0xffffff, 0xe0c8a8, 0xc8a888, 0xb8b0a0], roof: 0x4a3526 },
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
      box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 18),
      cone: new THREE.ConeGeometry(0.5, 1, 9), sph: new THREE.SphereGeometry(0.5, 18, 12), ico: new THREE.IcosahedronGeometry(0.5, 1),
      plane: new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    };
    this.styleMats = {};
    this.renderer = opts.renderer || null;
    this.time = 0;
    this.waters = []; this.bridges = [];
    this.bushes = []; this.interiors = []; this.models = new Map();
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
    orb.material.color.multiplyScalar(2.2);
    orb.position.copy(sd).multiplyScalar(3800); this.sky.add(orb);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.radial(), color: t.sun, transparent: true, opacity: t.stars ? 0.35 : 0.6, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    halo.scale.setScalar(1500); halo.position.copy(orb.position); this.sky.add(halo);
    // environment map from the sky so metal and glass have something to reflect
    if (this.renderer) {
      const pm = new THREE.PMREMGenerator(this.renderer), es = new THREE.Scene();
      es.add(new THREE.Mesh(sg, this.sky.material));
      this.envRT = pm.fromScene(es, 0, 1, 9000);
      sc.environment = this.envRT.texture; sc.environmentIntensity = t.env;
      pm.dispose();
    }
    // drifting cloud banks
    const cm = new THREE.MeshBasicMaterial({ color: t.cloud, transparent: true, opacity: t.stars ? 0.55 : 0.8, fog: false, depthWrite: false });
    this.disposables.push(cm);
    this.clouds = new THREE.Group(); this.root.add(this.clouds);
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2, r = 400 + Math.random() * 2600, cy = 480 + Math.random() * 260, cx = Math.cos(a) * r, cz = Math.sin(a) * r;
      for (let k = 0; k < 5; k++) {
        const m = new THREE.Mesh(this.geo.sph, cm), s = 90 + Math.random() * 150;
        m.scale.set(s * 1.7, s * 0.34, s * 1.2); m.position.set(cx + (Math.random() - 0.5) * 260, cy + (Math.random() - 0.5) * 30, cz + (Math.random() - 0.5) * 200);
        m.renderOrder = -5; this.clouds.add(m);
      }
    }
    if (t.weather) this.setWeather(t.weather);
    this.hemi = new THREE.HemisphereLight(t.hemiSky, t.hemiGround, t.hemi); sc.add(this.hemi);
    this.sun = new THREE.DirectionalLight(t.sun, t.sunI); this.sunDir = sd;
    if (this.shadows) {
      this.sun.castShadow = true;
      const s = this.sun.shadow; s.mapSize.set(3072, 3072);
      s.camera.left = -85; s.camera.right = 85; s.camera.top = 85; s.camera.bottom = -85; s.camera.near = 1; s.camera.far = 520;
      s.bias = -0.0006; s.normalBias = 0.4;
    }
    sc.add(this.sun); sc.add(this.sun.target);
  }

  // soft radial gradient used for halos and light pools
  radial() {
    if (this._radial) return this._radial;
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    this._radial = new THREE.CanvasTexture(c); this._radial.colorSpace = THREE.SRGBColorSpace; this.disposables.push(this._radial);
    return this._radial;
  }
  // near-white speckled detail texture; tinted by each material's colour
  grain() {
    if (this._grain) return this._grain;
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d');
    x.fillStyle = '#e9e9e9'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 70; i++) {
      const px = Math.random() * 256, py = Math.random() * 256, r = 14 + Math.random() * 40, dark = Math.random() < 0.6;
      for (const ox of [-256, 0, 256]) for (const oy of [-256, 0, 256]) {
        const g = x.createRadialGradient(px + ox, py + oy, 0, px + ox, py + oy, r);
        g.addColorStop(0, dark ? 'rgba(0,0,0,0.13)' : 'rgba(255,255,255,0.16)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = g; x.fillRect(px + ox - r, py + oy - r, r * 2, r * 2);
      }
    }
    for (let i = 0; i < 9000; i++) { x.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,' + (Math.random() * 0.16) + ')' : 'rgba(255,255,255,' + (Math.random() * 0.14) + ')'; x.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 1.6, 1 + Math.random() * 1.6); }
    const t = this._grain = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; this.disposables.push(t);
    return t;
  }
  grainRep(u, v) { const t = this.grain().clone(); t.repeat.set(u, v); t.needsUpdate = true; this.disposables.push(t); return t; }

  setWeather(kind) {
    if (this.weather) return;
    const n = kind === 'rain' ? 1400 : 1100, pos = new Float32Array(n * (kind === 'rain' ? 6 : 3));
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const off = []; for (let i = 0; i < n; i++) off.push((Math.random() - 0.5) * 70, Math.random() * 40, (Math.random() - 0.5) * 70, 0.7 + Math.random() * 0.6);
    const obj = kind === 'rain'
      ? new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x9fb4d8, transparent: true, opacity: 0.38 }))
      : new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 0.14, transparent: true, opacity: 0.9 }));
    obj.frustumCulled = false; this.root.add(obj); this.disposables.push(g, obj.material);
    this.weather = { kind, obj, off, n };
  }

  // rivers: wadeable on foot, impassable for wheels except on a bridge
  river(x, z, w, d) {
    const wm = new THREE.MeshStandardMaterial({ color: 0x1f5a66, roughness: 0.08, metalness: 0.75, transparent: true, opacity: 0.9, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 });
    const m = new THREE.Mesh(this.geo.plane, wm); m.scale.set(w, 1, d); m.position.set(x, 0.03, z); this.root.add(m); this.disposables.push(wm);
    this.inst('plane', 0x6a6248, x, 0.02, z, w + 5, 1, d + 5, { layer: 2 });
    this.waters.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 });
  }
  bridge(x, z, w, d) {
    const alongX = w > d;
    this.inst('box', 0x6b5236, x, 0.2, z, w, 0.4, d);
    for (const s of [-1, 1]) {
      if (alongX) this.block(x, z + s * (d / 2 - 0.15), w, 0.3, 1.1, 0x4a3826); else this.block(x + s * (w / 2 - 0.15), z, 0.3, d, 1.1, 0x4a3826);
    }
    this.bridges.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 });
  }
  inWater(x, z, ignoreBridges) {
    if (!ignoreBridges) for (const b of this.bridges) if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) return false;
    for (const w of this.waters) if (x > w.x0 && x < w.x1 && z > w.z0 && z < w.z1) return true;
    return false;
  }

  ground(color) {
    const g = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color, map: this.grainRep(700, 700) }));
    g.receiveShadow = true; this.root.add(g);
  }

  // ---------- batched primitives ----------
  inst(geo, color, x, y, z, sx, sy, sz, o = {}) {
    const key = geo + '|' + color + '|' + (o.glow ? 1 : 0) + '|' + (o.layer || 0) + '|' + (o.alpha || 1) + '|' + (o.add ? 1 : 0);
    let b = this.batches.get(key);
    if (!b) { b = { geo, color, o: { glow: o.glow, layer: o.layer, alpha: o.alpha, add: o.add }, mats: [] }; this.batches.set(key, b); }
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
  flat(x, z, w, d, color, layer = 1) {
    if (w * d < 300) return this.inst('plane', color, x, 0.01 * layer, z, w, 1, d, { layer });
    const m = new THREE.MeshLambertMaterial({ color, map: this.grainRep(Math.max(1, w / 9), Math.max(1, d / 9)), polygonOffset: true, polygonOffsetFactor: -2 * layer, polygonOffsetUnits: -2 * layer });
    const mesh = new THREE.Mesh(this.geo.plane, m);
    mesh.scale.set(w, 1, d); mesh.position.set(x, 0.01 * layer, z); mesh.receiveShadow = true;
    this.root.add(mesh); this.disposables.push(m);
  }

  _styleMat(style, tint) {
    const key = style + tint;
    if (this.styleMats[key]) return this.styleMats[key];
    const st = STYLES[style];
    let tex = this.styleMats['tex' + style];
    if (!tex) {
      const c = document.createElement('canvas'), e = document.createElement('canvas');
      c.width = c.height = e.width = e.height = 512;
      const x = c.getContext('2d'), xe = e.getContext('2d');
      x.fillStyle = st.base; x.fillRect(0, 0, 512, 512);
      xe.fillStyle = '#000'; xe.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 2600; i++) { x.fillStyle = Math.random() < 0.6 ? 'rgba(0,0,0,' + (Math.random() * 0.1) + ')' : 'rgba(255,255,255,' + (Math.random() * 0.06) + ')'; x.fillRect(Math.random() * 512, Math.random() * 512, 2 + Math.random() * 16, 1 + Math.random() * 2); }
      let lit = false;
      if (st.stripes) {
        for (let i = 0; i < 512; i += 16) { x.fillStyle = 'rgba(0,0,0,0.2)'; x.fillRect(i, 0, 4, 512); x.fillStyle = 'rgba(255,255,255,0.07)'; x.fillRect(i + 6, 0, 3, 512); }
        x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(0, 0, 512, 10); x.fillRect(0, 250, 512, 6);
      } else {
        // 8 x 4 windows per 12 m tile: paired 1.5 m windows on 3 m floors
        for (let j = 0; j < 4; j++) { x.fillStyle = 'rgba(0,0,0,0.22)'; x.fillRect(0, j * 128, 512, 7); x.fillStyle = 'rgba(255,255,255,0.08)'; x.fillRect(0, j * 128 + 7, 512, 3); }
        for (let i = 0; i < 8; i++) for (let j = 0; j < 4; j++) {
          const on = Math.random() < this.theme.lit, wx = i * 64 + 9, wy = j * 128 + 30, ww = 46, wh = 74;
          x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);
          if (on) {
            const g = x.createLinearGradient(0, wy, 0, wy + wh); g.addColorStop(0, st.lit); g.addColorStop(1, '#b8863e');
            x.fillStyle = g; x.fillRect(wx, wy, ww, wh); xe.fillStyle = g; xe.fillRect(wx, wy, ww, wh);
            if (Math.random() < 0.4) { const bh = wh * (0.2 + Math.random() * 0.4); x.fillStyle = 'rgba(40,30,20,0.55)'; x.fillRect(wx, wy, ww, bh); xe.fillStyle = 'rgba(0,0,0,0.6)'; xe.fillRect(wx, wy, ww, bh); }
            lit = true;
          } else {
            const g = x.createLinearGradient(wx, wy, wx + ww, wy + wh); g.addColorStop(0, '#3b5068'); g.addColorStop(0.5, st.win); g.addColorStop(1, '#0d141c');
            x.fillStyle = g; x.fillRect(wx, wy, ww, wh);
          }
          x.fillStyle = 'rgba(0,0,0,0.45)'; x.fillRect(wx + ww / 2 - 1, wy, 2, wh);
        }
      }
      const mk = (cv) => { const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; this.disposables.push(t); return t; };
      tex = this.styleMats['tex' + style] = { map: mk(c), em: lit ? mk(e) : null };
    }
    const glassy = style === 'city';
    const m = new THREE.MeshStandardMaterial({ map: tex.map, color: tint, roughness: glassy ? 0.32 : 0.85, metalness: glassy ? 0.45 : 0.05 });
    if (tex.em) { m.emissive = new THREE.Color(0xffffff); m.emissiveMap = tex.em; m.emissiveIntensity = 1.35; }
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
    this.deco(x, h + 0.25, z, w + 0.5, 0.5, d + 0.5, st.roof);
    if (style !== 'warehouse') this.deco(x, 0.5, z, w + 0.3, 1, d + 0.3, 0x2a2c30);
    const dark = this.theme.lit > 0.1;
    if (style === 'city') {
      if (dark && r() < 0.45) {
        const col = [0xff2e7a, 0x24d6ff, 0xffb020, 0x8a5cff, 0x3dff9a][Math.floor(r() * 5)], sx = r() < 0.5 ? -1 : 1, sh = Math.min(11, h * 0.35);
        if (r() < 0.5) this.inst('box', col, x + sx * (w / 2 + 0.35), 5 + sh / 2, z + (r() - 0.5) * d * 0.5, 0.3, sh, 1.5, { glow: true });
        else this.inst('box', col, x + (r() - 0.5) * w * 0.5, 5 + sh / 2, z + sx * (d / 2 + 0.35), 1.5, sh, 0.3, { glow: true });
      }
      if (h > 38) { this.inst('cyl', 0x555b63, x, h + 4, z, 0.3, 8, 0.3); this.inst('sph', 0xff2020, x, h + 8.2, z, 0.9, 0.9, 0.9, { glow: dark }); }
    }
    return mesh;
  }

  // ---------- props ----------
  // place one copy of a flattened model-kit piece (instanced at finalize)
  model(name, x, y, z, ry = 0, sx = 1, sy = 1, sz = 1) {
    const m = ASSETS.village[name]; if (!m) return false;
    let b = this.models.get(name); if (!b) { b = { m, mats: [] }; this.models.set(name, b); }
    _e.set(0, ry, 0); _q.setFromEuler(_e); _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz)); b.mats.push(_m.clone());
    return true;
  }
  wagon(x, z, ry = 0) { if (this.model('Prop_Wagon', x, 0, z, ry)) this.solid(x, z, Math.abs(Math.cos(ry)) > 0.7 ? 2.2 : 4.2, Math.abs(Math.cos(ry)) > 0.7 ? 4.2 : 2.2, 1.4); }
  // a cottage built from the village kit: textured walls with doors and windows, tiled roof, furnished and walkable
  cottage(cx, cz, nx, nz, doorSide, r = Math.random) {
    const A = ASSETS.village;
    if (!A.Wall_Plaster_Straight || !A.Roof_RoundTiles_6x8) return this.hollow(cx, cz, nx * 2, nz * 2, 3.1, 'cabin', r, doorSide);
    const W = nx * 2, D = nz * 2, T = 0.4, H = 3.1, base = r() < 0.45 ? 'Wall_UnevenBrick_' : 'Wall_Plaster_';
    const wins = ['Window_Wide_Round', 'Window_Thin_Round', 'Window_Wide_Flat'];
    // boxes of each wall piece in its own frame: [centre along the wall, length, y0, y1]
    const SHAPE = {
      straight: [[0, 2, 0, H]],
      wide: [[0, 2, 0, 1.0], [0, 2, 2.4, H], [-0.8, 0.4, 1.0, 2.4], [0.8, 0.4, 1.0, 2.4]],
      thin: [[0, 2, 0, 1.0], [0, 2, 2.4, H], [-0.7, 0.6, 1.0, 2.4], [0.7, 0.6, 1.0, 2.4]],
      door: [[-0.75, 0.5, 0, H], [0.75, 0.5, 0, H], [0, 1, 2.3, H]],
    };
    const sides = {
      s: { n: nx, horiz: true, fixed: cz - D / 2, ry: 0 }, n: { n: nx, horiz: true, fixed: cz + D / 2, ry: Math.PI },
      w: { n: nz, horiz: false, fixed: cx - W / 2, ry: Math.PI / 2 }, e: { n: nz, horiz: false, fixed: cx + W / 2, ry: -Math.PI / 2 },
    };
    for (const k in sides) {
      const S = sides[k];
      for (let i = 0; i < S.n; i++) {
        const u = (i - (S.n - 1) / 2) * 2, px = S.horiz ? cx + u : S.fixed, pz = S.horiz ? S.fixed : cz + u;
        const isDoor = k === doorSide && i === Math.floor(S.n / 2);
        let name = base + 'Straight', shape = 'straight';
        if (isDoor) { name = base + 'Door_Round'; shape = 'door'; }
        else if (r() < 0.55) { const w = wins[Math.floor(r() * 3)]; name = base + w; shape = w.startsWith('Window_Thin') ? 'thin' : 'wide'; }
        if (!this.model(name, px, 0, pz, S.ry)) this.model(base + 'Straight', px, 0, pz, S.ry);
        for (const [lx, len, y0, y1] of SHAPE[shape]) { if (S.horiz) this.solid(px + lx, pz, len, T, y1, y0); else this.solid(px, pz + lx, T, len, y1, y0); }
      }
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.block(cx + sx * W / 2, cz + sz * D / 2, 0.8, 0.8, H + 0.1, 0x8b8578, { solid: false });
    // roof, ridge along the longer side
    const along = D >= W, span = Math.min(W, D) + 1.5, len = Math.max(W, D) + 1.5, rm = A.Roof_RoundTiles_6x8.size;
    const sy = (span / rm.x) * 0.78;
    this.model('Roof_RoundTiles_6x8', cx, H - 0.12, cz, along ? 0 : Math.PI / 2, span / rm.x, sy, len / rm.z);
    this.solid(cx, cz, W + 1.0, D + 1.0, H + rm.y * sy * 0.6, H);
    // plaster fills the triangular gable at each end of the roof
    const wd = along ? W : D, yE = H - 0.12 + rm.y * sy * (1 - wd / span), yA = H - 0.12 + rm.y * sy - 0.35;
    const gs = new THREE.Shape(); gs.moveTo(-wd / 2, H - 0.3); gs.lineTo(wd / 2, H - 0.3); gs.lineTo(wd / 2, yE); gs.lineTo(0, yA); gs.lineTo(-wd / 2, yE); gs.closePath();
    const gg = new THREE.ExtrudeGeometry(gs, { depth: 0.25, bevelEnabled: false }); gg.translate(0, 0, -0.125); this.disposables.push(gg);
    const gm = this._gableMat || (this._gableMat = new THREE.MeshStandardMaterial({ color: 0xd8cfb4, roughness: 0.95 })); this.disposables.push(gm);
    const gh = (along ? D : W) / 2;
    for (const sg of [-1, 1]) {
      const m = new THREE.Mesh(gg, gm); m.position.set(along ? cx : cx + sg * gh, 0, along ? cz + sg * gh : cz); m.rotation.y = along ? 0 : Math.PI / 2;
      m.castShadow = true; m.receiveShadow = true; this.root.add(m);
    }
    // inside: floor, lamp, furniture, loot spot
    this.flat(cx, cz, W - 0.8, D - 0.8, 0x4a3a2c, 3);
    this.inst('box', 0xffe6b0, cx, H - 0.3, cz, 1.2, 0.08, 1.2, { glow: true });
    const [dx, dz] = { s: [0, -1], n: [0, 1], w: [-1, 0], e: [1, 0] }[doorSide], half = dx ? W / 2 : D / 2;
    const side = dx ? D / 2 : W / 2;
    for (let i = 0; i < 2; i++) { const u = (i ? 1 : -1) * Math.max(1.2, side - 1.8); this.crate(cx - dx * (half - 1.5) + (dx ? 0 : u), cz - dz * (half - 1.5) + (dx ? u : 0), 1.1 + r() * 0.5); }
    this.crate(cx + dz * (side - 1.4) * (r() < 0.5 ? 1 : -1), cz - dx * (side - 1.4), 1.0);
    this.interiors.push({ x: cx - dx * (half - 2.6), z: cz - dz * (half - 2.6), cx, cz, w: W, d: D, door: { x: cx + dx * (half + 2.4), z: cz + dz * (half + 2.4), nx: dx, nz: dz } });
    // outside: crate or wagon near the door, so every cottage has a lived-in yard
    const yx = cx + dx * (half + 2.2) + (dx ? 0 : 2.4), yz = cz + dz * (half + 2.2) + (dz ? 0 : 2.4);
    if (r() < 0.5) this.crate(yx, yz, 1.2); else this.barrel(yx, yz, 0x6a4a32);
  }

  // a walk-in building: four walls with a door and a window per wall, a roof you can stand on, cover inside
  hollow(x, z, w, d, h, style, r = Math.random, doorSide = 's') {
    const st = STYLES[style] || STYLES.city;
    const tint = st.tints[Math.floor(r() * st.tints.length)];
    const side = this._styleMat(STYLES[style] ? style : 'city', tint);
    const T = 0.7, parts = [];
    const piece = (cx, cz, pw, pd, y0, y1) => {
      if (pw < 0.05 || pd < 0.05 || y1 - y0 < 0.05) return;
      const g = new THREE.BoxGeometry(pw, y1 - y0, pd), uv = g.attributes.uv;
      for (let i = 0; i < 24; i++) {
        const face = i >> 2; if (face === 2 || face === 3) continue;
        const fw = face < 2 ? pd : pw;
        uv.setXY(i, uv.getX(i) * Math.max(0.25, Math.round(fw / 3) / 4), uv.getY(i) * (y1 - y0) / 12);
      }
      g.translate(cx, (y0 + y1) / 2, cz); parts.push(g);
      this.solid(cx, cz, pw, pd, y1, y0);
    };
    const walls = {
      s: { horiz: true, fixed: z - d / 2 + T / 2, L: w, c0: x }, n: { horiz: true, fixed: z + d / 2 - T / 2, L: w, c0: x },
      w: { horiz: false, fixed: x - w / 2 + T / 2, L: d - 2 * T, c0: z }, e: { horiz: false, fixed: x + w / 2 - T / 2, L: d - 2 * T, c0: z },
    };
    for (const k in walls) {
      const W = walls[k];
      const o = k === doorSide ? { c: 0, w: 3, y0: 0, y1: 3.3 } : { c: (r() - 0.5) * W.L * 0.35, w: 2.2, y0: 1.1, y1: 2.3 };
      const at = (m, len, y0, y1) => (W.horiz ? piece(W.c0 + m, W.fixed, len, T, y0, y1) : piece(W.fixed, W.c0 + m, T, len, y0, y1));
      const a = o.c - o.w / 2, b = o.c + o.w / 2;
      if (a + W.L / 2 > 0.05) at((a - W.L / 2) / 2, a + W.L / 2, 0, h);
      if (o.y0 > 0) at(o.c, o.w, 0, o.y0);
      at(o.c, o.w, o.y1, h);
      if (W.L / 2 - b > 0.05) at((b + W.L / 2) / 2, W.L / 2 - b, 0, h);
    }
    const merged = mergeGeometries(parts, false);
    parts.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(merged, side); mesh.castShadow = true; mesh.receiveShadow = true;
    this.root.add(mesh); this.disposables.push(merged);
    // roof (you can stand on it), floor, ceiling lamp
    this.inst('box', st.roof, x, h + 0.15, z, w + 0.6, 0.5, d + 0.6);
    this.solid(x, z, w + 0.6, d + 0.6, h + 0.4, h - 0.1); this.boxes[this.boxes.length - 1].roof = true;
    this.flat(x, z, w - 2 * T, d - 2 * T, 0x3a3632, 3);
    this.inst('box', 0xffe6b0, x, h - 0.45, z, 1.6, 0.1, 1.6, { glow: true });
    // cover inside, kept clear of the door
    const [nx, nz] = { s: [0, -1], n: [0, 1], w: [-1, 0], e: [1, 0] }[doorSide];
    const halfN = nx ? w / 2 : d / 2, halfL = nx ? d / 2 : w / 2;
    for (let i = 0; i < 2; i++) {
      const u = (i ? 1 : -1) * (halfL - 2.8 - r() * 1.2);
      this.crate(x - nx * (halfN - 2.3) + (nx ? 0 : u), z - nz * (halfN - 2.3) + (nx ? u : 0), 1.4 + r() * 0.6);
    }
    this.interiors.push({ x: x - nx * (halfN - 3.6), z: z - nz * (halfN - 3.6), cx: x, cz: z, w, d, door: { x: x + nx * (halfN + 2.4), z: z + nz * (halfN + 2.4), nx, nz } });
  }
  // walkable brush: stand in it crouched or prone and guards struggle to see you
  bush(x, z, s = 1) {
    const cols = [0x2f6a2c, 0x3a7a34, 0x285a28];
    for (let i = 0; i < 3; i++) this.inst('ico', cols[i], x + (i - 1) * 0.9 * s, 0.65 * s, z + (((i * 7) % 3) - 1) * 0.7 * s, 1.9 * s, 1.3 * s, 1.9 * s, { ry: i * 2 });
    this.bushes.push({ x, z, r: 1.7 * s });
  }
  inBush(x, z) {
    for (const b of this.bushes) if (Math.hypot(x - b.x, z - b.z) < b.r) return true;
    return false;
  }
  tree(x, z, kind = 'leaf', s = 1) {
    if (kind === 'pine' || kind === 'fir') {
      this.inst('cyl', 0x4a3520, x, 1.2 * s, z, 0.5 * s, 2.4 * s, 0.5 * s);
      this.inst('cone', 0x1b4229, x, 3.4 * s, z, 4.8 * s, 3.6 * s, 4.8 * s, { ry: x });
      this.inst('cone', 0x21502f, x, 5.4 * s, z, 3.7 * s, 3.3 * s, 3.7 * s, { ry: z });
      this.inst('cone', 0x286038, x, 7.2 * s, z, 2.6 * s, 3 * s, 2.6 * s, { ry: x + z });
      if (kind === 'pine') this.inst('cone', 0xeef4f8, x, 8.3 * s, z, 1.35 * s, 1.4 * s, 1.35 * s);
    } else if (kind === 'palm') {
      this.inst('cyl', 0x7a6040, x, 3 * s, z, 0.4 * s, 6 * s, 0.4 * s, { rz: 0.08 });
      for (let i = 0; i < 5; i++) this.inst('box', 0x3f7a35, x + Math.sin(i * 1.26) * 1.4 * s, 6 * s, z + Math.cos(i * 1.26) * 1.4 * s, 1.3 * s, 0.12, 3.4 * s, { ry: i * 1.26, rx: 0.35 });
    } else {
      this.inst('cyl', 0x4a3520, x, 1.5 * s, z, 0.5 * s, 3 * s, 0.5 * s);
      this.inst('ico', 0x2d5a2a, x, 4.4 * s, z, 4.4 * s, 3.8 * s, 4.4 * s, { ry: x });
      this.inst('ico', 0x35682f, x + 1.3 * s, 5.2 * s, z + 0.6 * s, 3 * s, 2.8 * s, 3 * s, { ry: z });
      this.inst('ico', 0x264e25, x - 1.2 * s, 4.0 * s, z - 0.9 * s, 3.2 * s, 2.6 * s, 3.2 * s, { ry: x + z });
    }
    this.solid(x, z, 0.7, 0.7, 3);
  }
  lamp(x, z) {
    this.inst('cyl', 0x30343a, x, 3, z, 0.18, 6, 0.18);
    const on = this.theme.lit > 0.1;
    this.inst('box', 0x30343a, x - 0.7, 6, z, 1.5, 0.12, 0.2);
    this.inst('sph', on ? 0xffe2a0 : 0x8a8a80, x - 1.4, 5.9, z, 0.6, 0.3, 0.6, { glow: on });
    if (on) this.inst('plane', 0xffc878, x - 1.4, 0.05, z, 26, 1, 26, { layer: 4, add: true });
  }
  crate(x, z, s = 1.4, color = 0x7a5a36) {
    if (ASSETS.village.Prop_Crate) { const k = s / 1.1; this.model('Prop_Crate', x, 0, z, (x * 7.3 + z * 3.1) % 6.28, k, k, k); this.solid(x, z, s * 0.95, s * 0.95, s); }
    else this.block(x, z, s, s, s, color);
  }
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
    const wm = new THREE.MeshStandardMaterial({ color: 0x0d2f47, roughness: 0.1, metalness: 0.85, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
    const wmesh = new THREE.Mesh(this.geo.plane, wm); wmesh.scale.set(9000, 1, 4000); wmesh.position.set(0, 0.06, z0 + 2000);
    this.root.add(wmesh); this.disposables.push(wm);
    this.zMax = z0 - 4;
  }

  finalize() {
    for (const [, b] of this.models) {   // village-kit pieces: one instanced mesh per sub-part
      for (const part of b.m.parts) {
        const im = new THREE.InstancedMesh(part.geo, part.mat, b.mats.length);
        b.mats.forEach((mm, i) => im.setMatrixAt(i, mm));
        im.instanceMatrix.needsUpdate = true; im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false;
        this.root.add(im);
      }
    }
    this.models.clear();
    for (const b of this.batches.values()) {
      const o = b.o;
      let mat;
      if (o.add) mat = new THREE.MeshBasicMaterial({ color: b.color, map: this.radial(), transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false });
      else if (o.glow) { mat = new THREE.MeshBasicMaterial({ color: b.color }); mat.color.multiplyScalar(2.6); }
      else mat = new THREE.MeshLambertMaterial({ color: b.color, map: b.geo === 'box' && !o.layer ? this.grain() : null, flatShading: b.geo === 'ico' });
      if (o.layer) { mat.polygonOffset = true; mat.polygonOffsetFactor = -2 * o.layer; mat.polygonOffsetUnits = -2 * o.layer; }
      if (o.alpha && o.alpha < 1) { mat.transparent = true; mat.opacity = o.alpha; }
      const im = new THREE.InstancedMesh(this.geo[b.geo], mat, b.mats.length);
      b.mats.forEach((m, i) => im.setMatrixAt(i, m));
      im.instanceMatrix.needsUpdate = true;
      im.castShadow = !o.layer && !o.glow; im.receiveShadow = !o.add && !o.glow; im.frustumCulled = false;
      this.root.add(im); this.disposables.push(mat);
    }
    this.batches.clear();
    this._buildNav();
  }

  update(focus, dt = 0, cam = null) {
    this.time += dt;
    if (this.clouds) { this.clouds.position.x = ((this.time * 6) % 600) - 300; }
    const W = this.weather;
    if (W && cam) {
      const p = W.obj.geometry.attributes.position.array, o = W.off, rain = W.kind === 'rain';
      for (let i = 0; i < W.n; i++) {
        const k = i * 4;
        o[k + 1] -= (rain ? 34 : 2.4) * o[k + 3] * dt;
        if (!rain) o[k] += Math.sin(this.time + i) * 0.6 * dt;
        if (o[k + 1] < -6) o[k + 1] += 40;
        const x = cam.x + o[k], y = Math.max(0.05, cam.y + o[k + 1] - 10), z = cam.z + o[k + 2];
        if (rain) { p[i * 6] = x; p[i * 6 + 1] = y; p[i * 6 + 2] = z; p[i * 6 + 3] = x + 0.12; p[i * 6 + 4] = y + 0.9; p[i * 6 + 5] = z; }
        else { p[i * 3] = x; p[i * 3 + 1] = y; p[i * 3 + 2] = z; }
      }
      W.obj.geometry.attributes.position.needsUpdate = true;
    }
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
    if (this.envRT) this.envRT.dispose();
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
    for (const b of this.boxes) if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1 && (b.y0 === 0 || b.roof) && b.y1 <= y + 0.55 && b.y1 > g) g = b.y1;
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
