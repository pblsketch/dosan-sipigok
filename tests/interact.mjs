// 선생님용 단추 없이 손으로 푸는 상호작용 점검: 6곡(계절 바퀴·끌어 놓기), 9곡(차례), 10곡(갈림길·가르기), 12곡(저울)
//   cd tests && node interact.mjs [phone|desktop]
import { chromium } from 'playwright';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const which = process.argv[2] || 'phone';
const SIZE = { phone: { width: 390, height: 844, isMobile: true, hasTouch: true }, desktop: { width: 1366, height: 860 } };
const BASE = process.env.BASE || 'http://127.0.0.1:8766/index.html';
const OUT = new URL('./shots/interact_' + which + '/', import.meta.url);
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
const shot = async (name) => { n++; await page.screenshot({ path: fileURLToPath(new URL(String(n).padStart(2, '0') + '_' + name + '.png', OUT)) }); };
const vis = (sel) => page.locator(sel).filter({ visible: true });
const next = async () => { const b = vis('.next-row button').filter({ hasText: /다음 ▶|알겠어요/ }); if (await b.count()) { await b.last().click(); await page.waitForTimeout(250); return true; } return false; };
const norm = (t) => t.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();

// 곡으로 바로(앞 단계는 끝낸 것으로)
async function open(num, doneSteps) {
  await page.goto(BASE);
  await page.evaluate(([num, doneSteps]) => {
    const st = { v: 1, teacher: false, steps: {}, found: {} };
    for (const s of doneSteps) st.steps[num + '-' + s] = true;
    localStorage.setItem('dosan-sipigok-v1', JSON.stringify(st));
  }, [num, doneSteps]);
  await page.goto(BASE + '?song=' + num);
  await page.waitForSelector('.play');
  await page.mouse.click(5, 300);
  await page.waitForTimeout(800);
}

// 묶음 확정 판을 데이터의 답으로 푼다(첫 시도는 일부러 한 칸 틀림)
async function solveBatch(wrongFirst) {
  const plan = await page.evaluate(() => {
    const b = [...document.querySelectorAll('.batch')].find((x) => x.querySelector('.pool'));
    const slots = [...b.querySelectorAll('.slot')].map((s) => s.dataset.slot);
    const n = +new URLSearchParams(location.search).get('song');
    const song = SONGS.find((s) => s.n === n);
    const beats = (song.ri || []).filter((x) => x.do === 'batch' || x.do === 'scales');
    for (const bt of beats) {
      if (bt.do === 'scales') { const items = bt.items.map((it, i) => ({ id: 'i' + i, side: it.side })); return { l: items.find((x) => x.side === 'L').id, r: items.find((x) => x.side === 'R').id }; }
      const ans = {}; for (const r of bt.rows) for (const s of r.slots) ans[s.id] = s.answer;
      if (slots.every((id) => ans[id])) return ans;
    }
    return null;
  });
  if (!plan) throw new Error('묶음 답을 못 찾음');
  const ids = Object.keys(plan);
  if (wrongFirst && ids.length >= 2) {
    // 첫째 칸에 둘째 답을 넣어 본다
    await vis(`.pool .chip[data-id="${plan[ids[1]]}"]`).click();
    await vis(`.slot[data-slot="${ids[0]}"]`).click();
    await vis(`.pool .chip[data-id="${plan[ids[0]]}"]`).click();
    await vis(`.slot[data-slot="${ids[1]}"]`).click();
    for (const id of ids.slice(2)) { await vis(`.pool .chip[data-id="${plan[id]}"]`).click(); await vis(`.slot[data-slot="${id}"]`).click(); }
    await vis('button:has-text("확정하기")').last().click();
    await page.waitForTimeout(500);
    await shot('batch_wrong');
    // 칸을 비우고 다시
    for (const id of ids) await vis(`.slot[data-slot="${id}"]`).click();
  }
  for (const id of ids) { await vis(`.pool .chip[data-id="${plan[id]}"]`).click(); await page.waitForTimeout(120); await vis(`.slot[data-slot="${id}"]`).click(); await page.waitForTimeout(120); }
  await vis('button:has-text("확정하기")').last().click();
  await page.waitForTimeout(700);
}
async function chooseOk() {
  const idx = await page.evaluate(() => {
    const norm = (t) => t.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
    const ok = new Set(); const walk = (v) => { if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') { if (v.ok && v.t) ok.add(norm(G.util.yet(v.t))); Object.values(v).forEach(walk); } };
    walk(SONGS);
    const el = [...document.querySelectorAll('.choose:not(.done)')].pop();
    const i = [...el.querySelectorAll('.opt')].findIndex((o) => ok.has(norm(o.textContent)));
    return i < 0 ? 0 : i;
  });
  await vis('.choose:not(.done) .opt').nth(idx).click();
  await page.waitForTimeout(500);
}

// ── 6곡: 景(계절 바퀴, 끌어 놓기)
await open(6, ['open']);
await shot('s6_spring');
const spots = async () => page.evaluate(() => [...document.querySelectorAll('.spot')].filter((b) => !b.hidden).map((b) => b.getAttribute('aria-label')).length);
console.log('봄 찾을 곳', await spots());
// 사람처럼: 안 보이는 곳은 풍경을 끌어 훑은 뒤 누른다(여기서는 그 자리로 훑기)
async function tapSpot() {
  const i = await page.evaluate(() => { const c = G.app.cur(); const sp = c.scene.spots.find((s) => !s.btn.hidden && !s.btn.classList.contains('got')); if (!sp) return -1; c.scene.panTo(sp.x, sp.y); return c.scene.spots.indexOf(sp); });
  if (i < 0) return false;
  await page.waitForTimeout(150);
  await page.locator('.spot').nth(i).click();
  await page.waitForTimeout(700);
  return true;
}
for (let i = 0; i < 3; i++) await tapSpot();
await vis('.season-wheel .sw:has-text("가을밤")').click();
await page.waitForTimeout(1200);
await shot('s6_autumn');
console.log('가을 찾을 곳', await spots());
await tapSpot();
await shot('s6_found_all');
// 카드 하나는 끌어서 놓기
{
  const card = vis('.tray .wcard').first();
  const id = await card.getAttribute('data-id');
  const cb = await card.boundingBox(); const tb = await vis(`.blank[data-accept="${id}"]`).first().boundingBox();
  await page.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2); await page.mouse.down();
  await page.mouse.move(cb.x + 30, cb.y - 20, { steps: 5 });
  await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(600);
  console.log('끌어 놓기 후 남은 카드', await vis('.tray .wcard').count());
}
for (let k = 0; k < 6 && await vis('.tray .wcard').count(); k++) {
  const id = await vis('.tray .wcard').first().getAttribute('data-id');
  await vis('.tray .wcard').first().click(); await vis(`.blank[data-accept="${id}"]`).first().click(); await page.waitForTimeout(400);
}
await page.waitForTimeout(1200);
await shot('s6_placed');
// 理: 짝 맞추기(한 번 틀려 보기) → 이름표 → 고르기
await solveBatch(true);
await shot('s6_batch_ok');
await next();
await page.waitForTimeout(1500);
await shot('s6_lens');
await chooseOk();
await next();
await page.waitForTimeout(800);
await shot('s6_foot');

// ── 9곡: 차례 맞추기(원문 가림)
await open(9, ['open', 'kyeong']);
await page.waitForTimeout(400);
await shot('s9_order');
{
  // 풀 안의 조각 가운데 k번째 정답 조각의 자리(루비 읽기는 빼고 비교)
  const pickIdx = (k) => page.evaluate((k) => {
    const want = G.util.yet(SONGS[8].ri.find((b) => b.do === 'order').items[k]).replace(/\{([^|}]+)\|[^}]+\}/g, '$1').replace(/\s+/g, '');
    const chips = [...document.querySelectorAll('.orderb .pool .ochip')];
    return chips.findIndex((c) => { const x = c.cloneNode(true); x.querySelectorAll('rt').forEach((r) => r.remove()); return x.textContent.replace(/\s+/g, '') === want; });
  }, k);
  const total = await page.evaluate(() => SONGS[8].ri.find((b) => b.do === 'order').items.length);
  const seq = [1, 0, ...Array.from({ length: total - 2 }, (_, i) => i + 2)]; // 처음 둘을 바꿔 한 번 틀린다
  for (const k of seq) { await vis('.orderb .pool .ochip').nth(await pickIdx(k)).click(); await page.waitForTimeout(100); }
  await vis('button:has-text("확정하기")').click(); await page.waitForTimeout(500);
  await shot('s9_order_wrong');
  for (let k = 0; k < total; k++) { await vis('.orderb .oline .ochip').first().click(); await page.waitForTimeout(80); }
  for (let k = 0; k < total; k++) { await vis('.orderb .pool .ochip').nth(await pickIdx(k)).click(); await page.waitForTimeout(100); }
  await vis('button:has-text("확정하기")').click(); await page.waitForTimeout(600);
  await shot('s9_order_ok');
}
await next();
await solveBatch(false);
await shot('s9_batch');

// ── 10곡: 갈림길 → 가르기
await open(10, ['open', 'kyeong']);
await shot('s10_fork');
await vis('.fork-btn.shiny').click(); await page.waitForTimeout(700);
await shot('s10_stray');
await page.waitForTimeout(1800);
await shot('s10_loop');
await vis('.fork-btn.humble').click(); await page.waitForTimeout(400);
await next();
{
  const rows = page.locator('.sortb .srow');
  const cnt = await rows.count();
  for (let i = 0; i < cnt; i++) {
    const t = norm(await rows.nth(i).locator('.it').textContent());
    const bin = await page.evaluate((t) => { const norm = (x) => x.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim(); const b = SONGS[9].ri.find((x) => x.do === 'sort'); const it = b.items.find((x) => norm(G.util.yet(x.t)) === t); return b.bins.find((q) => q.id === it.bin).t; }, t);
    await rows.nth(i).locator('.bin', { hasText: bin }).click();
  }
  await vis('button:has-text("확정하기")').click(); await page.waitForTimeout(600);
  await shot('s10_sort_ok');
}

// ── 12곡: 저울
await open(12, ['open', 'kyeong']);
await page.waitForTimeout(300);
await shot('s12_scales');
await solveBatch(true);
await page.waitForTimeout(500);
await shot('s12_scales_ok');

// ── 1곡: 음보 끊기(세 장, 한 번 일부러 틀림) → 노래
await open(1, ['open', 'kyeong', 'ri']);
await page.waitForTimeout(500);
await shot('s1_foot');
{
  const cuts = await page.evaluate(() => SONGS[0].feet.map((f) => [...G.text.feet(f).cuts]));
  await vis('.fline').nth(0).locator('.gap[data-i="1"]').click(); // 틀린 곳(낱말 가운데)
  await page.waitForTimeout(300);
  await shot('s1_foot_wrong');
  for (let li = 0; li < 3; li++) for (const i of cuts[li]) { await vis('.fline').nth(li).locator(`.gap[data-i="${i}"]`).click(); await page.waitForTimeout(220); }
  await vis('.next-row button:has-text("알겠어요")').click({ timeout: 8000 });
  await page.waitForTimeout(1800);
  await shot('s1_sing');
  console.log('노래로 번진 음보', await page.locator('.singing .foot.sung').count());
}

console.log('ERRORS', errors.length ? errors.join('\n') : '(없음)');
await browser.close();
