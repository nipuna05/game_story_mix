// Which objects produce the triangles? node tools/tris.mjs   (needs the dev server)
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => { Element.prototype.requestPointerLock = () => {}; });
await page.goto('http://localhost:5173/'); await page.waitForFunction(() => window.game, null, { timeout: 60000 }); await page.waitForTimeout(1200);
for (const id of ['m2', 'm3b', 'm1']) {
  const r = await page.evaluate(async (id) => {
    const S = await import('/src/story.js'); const g = window.game;
    g.startMission(S.CAMPAIGN.find((m) => m.id === id), {}); g.god = true;
    const rows = []; let total = 0, instTotal = 0, plain = 0, meshes = 0, insts = 0;
    g.scene.traverse((o) => {
      if (!o.isMesh) return;
      const geo = o.geometry, per = (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
      const n = o.isInstancedMesh ? o.count : 1, tris = per * n; total += tris;
      if (o.isInstancedMesh) { instTotal += tris; insts++; } else { plain += tris; meshes++; }
      rows.push({ type: o.isInstancedMesh ? 'inst' : 'mesh', geo: geo.type, n, perTri: Math.round(per), tris: Math.round(tris), shadow: o.castShadow, culled: o.frustumCulled });
    });
    rows.sort((a, b) => b.tris - a.tris);
    return { id, total: Math.round(total), instanced: Math.round(instTotal), plain: Math.round(plain), instBatches: insts, meshes, top: rows.slice(0, 12) };
  }, id);
  console.log(r.id, 'total', r.total, 'instanced', r.instanced, 'plain', r.plain, 'batches', r.instBatches, 'meshes', r.meshes);
  for (const t of r.top) console.log('  ', JSON.stringify(t));
}
await b.close();
