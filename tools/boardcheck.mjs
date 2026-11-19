// Checks the online leaderboard against a mock Supabase REST server: node tools/boardcheck.mjs  (needs the dev server)
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await b.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => { Element.prototype.requestPointerLock = () => {}; });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errs.push(m.text()); });
const rows = []; let down = false, auth = '';
await page.route('https://mock.supabase.co/rest/v1/scores**', async (route) => {
  const req = route.request(); auth = req.headers().apikey || '';
  if (down) return route.abort();
  if (req.method() === 'POST') { rows.push(JSON.parse(req.postData())); return route.fulfill({ status: 201, body: '' }); }
  const u = new URL(req.url()), board = (u.searchParams.get('board') || '').replace('eq.', ''), lim = +u.searchParams.get('limit') || 10;
  const out = rows.filter((r) => r.board === board).sort((a, c) => c.score - a.score).slice(0, lim);
  return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(out) });
});
await page.goto('http://localhost:5173/'); await page.waitForFunction(() => window.game, null, { timeout: 60000 });
await page.keyboard.press('Enter'); await page.waitForTimeout(500);
console.log('off by default - title has board button:', await page.evaluate(() => { window.game.ui.title(); return !!document.querySelector('[data-a="board"]'); }));
await page.evaluate(async () => { (await import('/src/board.js')).setBoardConfig('https://mock.supabase.co', 'anon-key'); window.game.ui.title(); });
console.log('configured - title has board button:', await page.evaluate(() => !!document.querySelector('[data-a="board"]')));

const finish = (score, rank = 'B') => page.evaluate(async ([score, rank]) => {
  const S = await import('/src/story.js'), g = window.game; g.startMission(S.CAMPAIGN[0], {}); g.ui.clear();
  g.ui.debrief({ stats: { time: 120, kills: 3, headshots: 1, takedowns: 0, shots: 10, hits: 6, alarms: 0, deaths: 0 }, score, rank, credits: 100, medals: [] });
}, [score, rank]);
const note = async () => { await page.waitForTimeout(500); return (await page.textContent('#boardNote')).trim(); };
await finish(3000); console.log('1st:', await note(), '| rows:', rows.length, '| key sent:', auth);
await finish(2000); console.log('lower:', await note(), '| rows:', rows.length);
await finish(4500, 'A'); console.log('higher:', await note(), '| rows:', rows.length, '| last:', JSON.stringify(rows.at(-1)));
// other players' rows, then the screens
rows.push({ board: 'm1', name: 'Viper', score: 5200, rank: 'S', time: 98 }, { board: 'm1', name: 'Rook', score: 3900, rank: 'B', time: 140 });
const ui = () => page.evaluate(() => document.getElementById('ui').innerText.replace(/\s+/g, ' ').slice(0, 50));
console.log('before click:', await ui()); await page.evaluate(() => { const u = window.game.ui, lb = u.leaderboard.bind(u); window.__log = []; u.leaderboard = (...a) => { window.__log.push('lb:' + a[0]); try { return lb(...a); } catch (e) { window.__log.push('ERR ' + e.message); throw e; } }; const t = u.title.bind(u); u.title = (...a) => { window.__log.push('title from ' + new Error().stack.split('\n').slice(2, 4).join(' <- ')); return t(...a); }; }); await page.click('[data-a="lb"]'); console.log('right after:', await ui(), await page.evaluate(() => JSON.stringify(window.__log))); await page.waitForTimeout(1200); console.log('later:', await ui()); console.log('raw:', (await page.innerText('#lb_rows')).slice(0, 80));
console.log('board rows:', (await page.innerText('#lb_rows')).replace(/\s+/g, ' ').trim());
await page.screenshot({ path: 'test-shots/leaderboard.png' });
await page.evaluate(() => window.game.ui.daily()); await page.waitForTimeout(600);
console.log('daily board:', (await page.innerText('#dailyBoard')).trim());
// network down: the game still works and says so
down = true; await page.evaluate(async () => { window.game.save.boardBest = {}; }); await finish(9000, 'S'); console.log('offline:', await note());
console.log('errors:', errs.length, errs.slice(0, 3).join(' | '));
await b.close();
