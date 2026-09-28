// 1부·2부를 처음부터 끝까지 자동으로 플레이한다(선생님용 [정답 채우기]·[정답 보기]를 쓰고, 고르기는 데이터의 정답을 누른다).
//   cd tests && node full.mjs [phone|desktop]
// 게임 폴더를 http://127.0.0.1:8766 에서 서빙하고 있어야 한다(python -m http.server 8766).
import { chromium } from 'playwright';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const which = process.argv[2] || 'phone';
const SIZE = { phone: { width: 390, height: 844, isMobile: true, hasTouch: true }, desktop: { width: 1366, height: 860 } };
const BASE = process.env.BASE || 'http://127.0.0.1:8766/index.html';
const OUT = new URL('./shots/full_' + which + '/', import.meta.url);
fs.rmSync(fileURLToPath(OUT), { recursive: true, force: true });
fs.mkdirSync(fileURLToPath(OUT), { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const vp = SIZE[which];
const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('response', (r) => { if (r.status() >= 400) errors.push('http ' + r.status() + ': ' + r.url()); });

let n = 0;
const shot = async (name) => { n++; await page.screenshot({ path: fileURLToPath(new URL(String(n).padStart(3, '0') + '_' + name + '.png', OUT)) }); };
const vis = (sel) => page.locator(sel).filter({ visible: true });

await page.goto(BASE);
await page.evaluate(() => localStorage.clear());
await page.goto(BASE + '?teacher=1');
await page.waitForSelector('.title-screen');
await page.mouse.click(5, 5); // 소리 켜기(첫 터치)
await shot('title');

// 한 번에 한 동작씩 앞으로 나아간다. 더 할 것이 없으면 false
async function step() {
  // 선생님용 정답 채우기(景·音)
  const fill = vis('.task button:has-text("선생님용: 정답 채우기")');
  if (await fill.count()) { await fill.last().click(); return 'fill'; }
  const reveal = vis('button:has-text("정답 보기")');
  if (await reveal.count()) { await reveal.last().click(); return 'reveal'; }
  // 갈림길: 반짝이는 길 먼저, 그다음 좁은 길
  const shiny = vis('.fork-btn.shiny:not([disabled])');
  if (await shiny.count()) { await shiny.click(); await page.waitForTimeout(2200); return 'shiny'; }
  const humble = vis('.fork-btn.humble:not([disabled])');
  if (await humble.count()) { await humble.click(); return 'humble'; }
  // 고르기: 정답(데이터) / 채점 안 하는 것은 첫째
  const open = vis('.choose:not(.done)');
  if (await open.count()) {
    const idx = await open.last().evaluate((el) => {
      const norm = (t) => t.replace(/\{([^|}]+)\|[^}]+\}/g, '$1').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
      const ok = new Set();
      const walk = (v) => { if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') { if (v.ok && v.t) ok.add(norm(G.util.yet(v.t))); Object.values(v).forEach(walk); } };
      const cur = G.app.cur && G.app.cur();
      if (cur && document.querySelector('.play')) walk(cur.song); else walk(INTRO); // 다른 곡의 정답이 오답 보기로 나온다
      const opts = [...el.querySelectorAll('.opt')];
      const i = opts.findIndex((o) => ok.has(norm((() => { const x = o.cloneNode(true); x.querySelectorAll('rt').forEach((r) => r.remove()); return x.textContent; })())));
      return i >= 0 ? i : 0;
    });
    await open.last().locator('.opt').nth(idx).click();
    return 'choose';
  }
  const skip = vis('button:has-text("건너뛰기")');
  if (await skip.count()) { await skip.click(); return 'skip'; }
  for (const label of ['알겠어요', '다음 ▶', '병풍 펼치기 ▶', '길 떠나기 ▶']) {
    const b = vis(`.next-row button:has-text("${label}")`);
    if (await b.count()) { await b.last().click(); return label; }
  }
  return false;
}

async function playSong(num) {
  await page.waitForSelector('.play');
  await page.waitForTimeout(700);
  await shot(`s${num}_open`);
  let idle = 0, shots = new Set();
  for (let i = 0; i < 160; i++) {
    const cls = await page.evaluate(() => (document.querySelector('.play') || {}).className || '');
    for (const st of ['st-ri', 'st-foot', 'st-done']) if (cls.includes(st) && !shots.has(st)) { shots.add(st); await page.waitForTimeout(st === 'st-done' ? 2600 : 900); await shot(`s${num}_${st}`); }
    // 곡 끝: 병풍에 걸기 → 병풍에서 다음 곡(마지막 곡이면 결과)
    const hang = vis('.next-row button').filter({ hasText: /병풍에 걸기|길에 새기기/ });
    if (cls.includes('st-done') && await hang.count()) {
      await shot(`s${num}_done`);
      await hang.click();
      await page.waitForSelector('.page.map');
      await page.waitForTimeout(1700);
      const go = vis('.next-row .btn.primary');
      if (await go.count()) await go.click(); else await vis('.next-row .btn.seal').click();
      return;
    }
    const r = await step();
    if (!r) { idle++; await page.waitForTimeout(400); if (idle > 25) throw new Error('멈춤: ' + num + '곡'); } else idle = 0;
    await page.waitForTimeout(r === 'fill' ? 900 : 260);
  }
  throw new Error('끝나지 않음: ' + num + '곡');
}

async function playPart(p) {
  await vis(`.btn.part:has-text("${p}부")`).click();
  // 도입
  await page.waitForTimeout(600);
  await shot(`intro${p}_a`);
  for (let i = 0; i < 40 && !(await page.locator('.page.map').count()); i++) {
    const r = await step();
    if (i === 3 || i === 8) await shot(`intro${p}_${i}`);
    if (!r) await page.waitForTimeout(400); else await page.waitForTimeout(300);
  }
  await page.waitForSelector('.page.map');
  await shot(`map${p}`);
  await vis('.next-row .btn.primary').click();
  const nums = p === 1 ? [1, 2, 3, 4, 5, 6] : [7, 8, 9, 10, 11, 12];
  for (const num of nums) await playSong(num);
  await page.waitForSelector('.page.result');
  await page.waitForTimeout(800);
  await shot(`result${p}_top`);
  await page.fill('.name-input', '1-3 12 김지은');
  await vis('button:has-text("이름 낙관 찍기")').click();
  await page.waitForTimeout(900);
  await shot(`result${p}_sealed`);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(300);
  await shot(`result${p}_bottom`);
}

await playPart(1);
await vis('button:has-text("2부 언학으로")').click();
// 2부는 도입부터(1부를 마쳤으므로 되짚기 묶음이 나온다)
await page.waitForTimeout(600);
await shot('intro2_a');
for (let i = 0; i < 40 && !(await page.locator('.page.map').count()); i++) {
  const r = await step();
  if (i === 1) await shot('intro2_recall');
  await page.waitForTimeout(r ? 300 : 400);
}
await page.waitForSelector('.page.map');
await shot('map2');
await vis('.next-row .btn.primary').click();
for (const num of [7, 8, 9, 10, 11, 12]) await playSong(num);
await page.waitForSelector('.page.result');
await page.waitForTimeout(800);
await shot('result2_top');
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await shot('result2_bottom');

const st = await page.evaluate(() => ({ done: Object.keys(G.save.state.done).length, stats: G.save.state.stats, wrong: G.save.state.wrong.length }));
console.log(JSON.stringify(st));
console.log('ERRORS', errors.length ? errors.join('\n') : '(없음)');
await browser.close();
