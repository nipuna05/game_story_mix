import * as THREE from 'three';

// Short-lived visual effects: tracers, sparks, explosions, light flashes.
export class FX {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.sphere = new THREE.SphereGeometry(1, 12, 8);
    // fixed pool so the light count never changes (avoids shader recompiles)
    this.lights = [];
    for (let i = 0; i < 3; i++) {
      const l = new THREE.PointLight(0xffaa55, 0, 60, 1.6);
      scene.add(l);
      this.lights.push({ l, t: 1, life: 1, peak: 0 });
    }
    this.shake = 0;
  }
  tracer(a, b, color = 0xfff0b0) {
    const g = new THREE.BufferGeometry().setFromPoints([a.clone(), b.clone()]);
    const m = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 });
    const o = new THREE.Line(g, m); o.frustumCulled = false;
    this.scene.add(o);
    this.items.push({ o, t: 0, life: 0.08, kind: 'fade' });
  }
  flash(pos, color, peak, life = 0.08) {
    let best = this.lights[0];
    for (const s of this.lights) if (s.t / s.life > best.t / best.life) best = s;
    best.l.position.copy(pos); best.l.color.set(color);
    best.t = 0; best.life = life; best.peak = peak;
  }
  sparks(pos, color, n = 8, speed = 5, life = 0.45, size = 0.1) {
    const p = new Float32Array(n * 3), v = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      p[i * 3] = pos.x; p[i * 3 + 1] = pos.y; p[i * 3 + 2] = pos.z;
      v[i * 3] = (Math.random() - 0.5) * 2 * speed; v[i * 3 + 1] = Math.random() * speed; v[i * 3 + 2] = (Math.random() - 0.5) * 2 * speed;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const o = new THREE.Points(g, new THREE.PointsMaterial({ color, size, transparent: true }));
    o.frustumCulled = false;
    this.scene.add(o);
    this.items.push({ o, t: 0, life, kind: 'pts', v });
  }
  explosion(pos, r = 8) {
    const ball = new THREE.Mesh(this.sphere, new THREE.MeshBasicMaterial({ color: 0xffb648, transparent: true, opacity: 0.95 }));
    ball.position.copy(pos); this.scene.add(ball);
    this.items.push({ o: ball, t: 0, life: 0.45, kind: 'boom', r });
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Mesh(this.sphere, new THREE.MeshBasicMaterial({ color: 0x2a2a2a, transparent: true, opacity: 0.7 }));
      s.position.set(pos.x + (Math.random() - 0.5) * r * 0.5, pos.y + Math.random() * 2, pos.z + (Math.random() - 0.5) * r * 0.5);
      this.scene.add(s);
      this.items.push({ o: s, t: 0, life: 1.6 + Math.random(), kind: 'smoke', r: r * (0.25 + Math.random() * 0.2) });
    }
    this.sparks(pos, 0xffd070, 40, 16, 0.9, 0.22);
    this.flash(new THREE.Vector3(pos.x, pos.y + 2, pos.z), 0xff9040, 400, 0.4);
    this.shake = Math.max(this.shake, 0.6);
  }
  update(dt) {
    this.shake = Math.max(0, this.shake - dt * 1.5);
    for (const s of this.lights) {
      s.t = Math.min(s.life, s.t + dt);
      s.l.intensity = s.peak * (1 - s.t / s.life);
    }
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i]; it.t += dt;
      const k = it.t / it.life;
      if (k >= 1) {
        this.scene.remove(it.o);
        if (it.o.geometry !== this.sphere) it.o.geometry.dispose();
        it.o.material.dispose();
        this.items.splice(i, 1);
        continue;
      }
      if (it.kind === 'fade') it.o.material.opacity = 0.9 * (1 - k);
      else if (it.kind === 'pts') {
        const p = it.o.geometry.attributes.position, v = it.v;
        for (let j = 0; j < p.count; j++) {
          v[j * 3 + 1] -= 14 * dt;
          p.array[j * 3] += v[j * 3] * dt; p.array[j * 3 + 1] += v[j * 3 + 1] * dt; p.array[j * 3 + 2] += v[j * 3 + 2] * dt;
        }
        p.needsUpdate = true; it.o.material.opacity = 1 - k;
      } else if (it.kind === 'boom') { it.o.scale.setScalar(0.5 + it.r * Math.sqrt(k)); it.o.material.opacity = 0.95 * (1 - k); }
      else if (it.kind === 'smoke') { it.o.scale.setScalar(it.r * (0.6 + k)); it.o.position.y += dt * 2.2; it.o.material.opacity = 0.7 * (1 - k); }
    }
  }
}
