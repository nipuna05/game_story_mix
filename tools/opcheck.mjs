// Checks mission codes: node tools/opcheck.mjs   (needs the dev server)
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, permissions: ['clipboard-read', 'clipboard-write'] });
const page = await ctx.newPage();
await page.addInitScript(() => { Element.prototype.requestPointerLock = () => {}; });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto('http://localhost:5173/'); await page.waitForFunction(() => window.game, null, { timeout: 60000 });
const r = await page.evaluate(async () => {
  const O = await import('/src/opcode.js'); const out = {};
  const form = { title: 'Midnight Harvest', story: 'Line one {hero}\nLine two <b>bold</b> & "quotes" \u00e9', radio: 'Go go', leader: 'The Jackal', location: 'downtown', time: 'dusk', insertion: 'car', exit: 'flyout', count: 2, enemies: 1.4, objectives: ['collect', 'kill'] };
  const code = await O.encodeOp(form); out.prefix = code.slice(0, 5); out.len = code.length;
  const back = await O.decodeOp('check this out: https://x.y/#op=' + code + ' !');
  out.same = ['title', 'story', 'radio', 'leader', 'location', 'time', 'insertion', 'exit', 'count', 'enemies'].every((k) => back[k] === form[k]) && back.objectives.join() === 'collect,kill';
  const bad = []; for (const t of ['hello', 'NFP2-@@@@', 'NFP1-' + btoa('not json'), '']) { try { await O.decodeOp(t); bad.push('ACCEPTED ' + t); } catch (e) { bad.push('rejected'); } }
  out.bad = bad.join();
  const raw = 'NFP1-' + btoa(JSON.stringify({ title: 'x'.repeat(500), story: 's', location: 'nowhere', time: 'mars', insertion: 'rocket', exit: 'x', count: 99, enemies: 50, objectives: ['hack', 'kill', 'kill'] })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const s = await O.decodeOp(raw); out.clean = JSON.stringify({ t: s.title.length, loc: s.location, time: s.time, ins: s.insertion, exit: s.exit, count: s.count, en: s.enemies, obj: s.objectives });
  out.code = code; return out;
});
console.log(JSON.stringify({ ...r, code: undefined }));
// open a shared link: splash -> briefing of the shared operation, and it is saved
await page.goto('http://localhost:5173/#op=' + r.code); await page.waitForFunction(() => window.game, null, { timeout: 60000 });
await page.keyboard.press('Enter'); await page.waitForTimeout(1200); await page.screenshot({ path: 'test-shots/opcode-link.png' });
console.log('briefing:', (await page.textContent('#ui h2')).replace(/\s+/g, ' ').trim(), '| saved:', await page.evaluate(() => window.game.save.custom.length), '| hash:', JSON.stringify(await page.evaluate(() => location.hash)));
// builder: share a saved op, then play a pasted code
await page.evaluate(() => window.game.ui.builder()); await page.waitForTimeout(300);
await page.click('[data-tab="saved"]'); await page.click('[data-a="share:0"]'); await page.waitForTimeout(500);
console.log('share note:', (await page.textContent('#opNote')).slice(0, 70), '| clip:', (await page.evaluate(() => navigator.clipboard.readText())).slice(0, 40));
await page.fill('#b_code', 'garbage'); await page.click('[data-a="import"]'); await page.waitForTimeout(200); console.log('bad paste:', await page.textContent('#opNote'));
await page.fill('#b_code', await page.evaluate(() => navigator.clipboard.readText())); await page.click('[data-a="import"]'); await page.waitForTimeout(600);
console.log('pasted briefing:', (await page.textContent('#ui h2')).replace(/\s+/g, ' ').trim(), '| saved:', await page.evaluate(() => window.game.save.custom.length));
console.log('errors:', errs.length, errs.slice(0, 3).join(' | '));
await b.close();
