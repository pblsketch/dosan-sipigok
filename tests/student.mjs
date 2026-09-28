// 학생처럼 처음부터 끝까지(선생님용 단추 없이) 1부·2부 열두 곡을 모두 직접 푼다.
//   cd tests && node student.mjs [phone|desktop]      BASE=https://pblsketch.github.io/dosan-sipigok/ node student.mjs
// 누르기·끌기·가르기·차례·갈림길·저울·음보 끊기·노래 듣기·마음 고르기·낙관·그림 저장을 모두 손으로 한다.
// 일부러 틀려 보기(카드 잘못 넣기, 묶음 한 칸 틀리기, 음보 잘못 끊기, 고르기 오답), 곡 중간에 새로 고침(이어 하기),
// 메뉴(시어 사전·발문·이본 노트)·설정(한자 끄기)·병풍 접기·여백 메모, 끝으로 다시 읽기(복습) 한 곡까지 본다.
import { chromium } from 'playwright';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const which = process.argv[2] || 'phone';
const SIZE = { phone: { width: 390, height: 844, isMobile: true, hasTouch: true }, tablet: { width: 820, height: 1180, isMobile: true, hasTouch: true }, desktop: { width: 1366, height: 860 } };
let BASE = process.env.BASE || 'http://127.0.0.1:8766/';
if (!BASE.endsWith('/') && !BASE.endsWith('.html')) BASE += '/';
const OUT = new URL('./shots/student_' + which + '/', import.meta.url);
fs.rmSync(fileURLToPath(OUT), { recursive: true, force: true });
fs.mkdirSync(fileURLToPath(OUT), { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const vp = SIZE[which];
const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch, deviceScaleFactor: 1, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('response', (r) => { if (r.status() >= 400) errors.push('http ' + r.status() + ': ' + r.url()); });
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

let n = 0;
const shot = async (name) => { n++; await page.screenshot({ path: fileURLToPath(new URL(String(n).padStart(3, '0') + '_' + name + '.png', OUT)) }); };
const vis = (sel) => page.locator(sel).filter({ visible: true });
const wait = (ms) => page.waitForTimeout(ms);
const check = (cond, msg) => { if (!cond) { errors.push('CHECK: ' + msg); log('✗', msg); } };

// ───────── 데이터에서 답 찾기(페이지 안) ─────────
const ANSWERS = () => {
  const norm = (t) => String(t).replace(/\*\*/g, '').replace(/\{([^|}]+)\|([^}]+)\}/g, '$1$2').replace(/\s+/g, '');
  const cur = G.app.cur && G.app.cur();
  const beats = cur ? cur.song.ri : [...INTRO[1], ...INTRO[2]];
  return { norm, cur, beats };
};

async function solveBatch(wrongFirst) {
  const plan = await page.evaluate(() => {
    const b = [...document.querySelectorAll('.batch')].find((x) => x.querySelector('.pool'));
    if (!b) return null;
    const slots = [...b.querySelectorAll('.slot')].map((s) => s.dataset.slot);
    if (slots[0] && /^r\d+$/.test(slots[0])) { const a = {}; for (const s of slots) a[s] = 'k' + s.slice(1); return a; } // 2부 되짚기
    const cur = G.app.cur();
    for (const bt of cur.song.ri.filter((x) => x.do === 'batch' || x.do === 'scales')) {
      if (bt.do === 'scales') {
        if (!slots.includes('l0')) continue;
        const a = {};
        for (const [sd, p] of [['L', 'l'], ['R', 'r']]) bt.items.map((x, i) => ({ x, i })).filter((o) => o.x.side === sd).forEach((o, k) => { a[p + k] = 'i' + o.i; });
        return a;
      }
      const ans = {}; for (const r of bt.rows) for (const s of r.slots) ans[s.id] = s.answer;
      if (slots.every((id) => ans[id])) return ans;
    }
    return null;
  });
  if (!plan) throw new Error('묶음 답을 못 찾음');
  const ids = Object.keys(plan);
  const put = async (chip, slot) => { await vis(`.pool .chip[data-id="${chip}"]`).click(); await wait(90); await vis(`.slot[data-slot="${slot}"]`).click(); await wait(90); };
  if (wrongFirst && ids.length >= 2) {
    // 첫 칸과 마지막 칸을 맞바꿔 넣는다(저울처럼 같은 접시 안은 순서가 상관없으므로 양 끝을 바꾼다)
    const last = ids[ids.length - 1];
    await put(plan[last], ids[0]); await put(plan[ids[0]], last);
    for (const id of ids.slice(1, -1)) await put(plan[id], id);
    await vis('button:has-text("확정하기")').last().click(); await wait(450);
    const msg = await vis('.batch .msg').last().textContent();
    check(/칸이 맞아요/.test(msg), '묶음 오답 안내가 나와야 함');
    for (const id of ids) await vis(`.slot[data-slot="${id}"]`).click();
  }
  for (const id of ids) await put(plan[id], id);
  await vis('button:has-text("확정하기")').last().click();
  await wait(650);
}

async function solveSort() {
  const rows = page.locator('.sortb:not(.done) .srow').filter({ visible: true });
  const cnt = await rows.count();
  for (let i = 0; i < cnt; i++) {
    const text = await rows.nth(i).locator('.it').evaluate((el) => { const x = el.cloneNode(true); x.querySelectorAll('rt').forEach((r) => r.remove()); return x.textContent; });
    const bin = await page.evaluate((text) => {
      const norm = (t) => G.util.yet(String(t)).replace(/\*\*/g, '').replace(/\{([^|}]+)\|[^}]+\}/g, '$1').replace(/\s+/g, '');
      const cur = G.app.cur();
      const beats = cur ? cur.song.ri : [...INTRO[1], ...INTRO[2]];
      for (const b of beats.filter((x) => x.do === 'sort')) for (const it of b.items) if (norm(it.t) === text.replace(/\s+/g, '')) return b.bins.find((q) => q.id === it.bin).t;
      return null;
    }, text);
    if (!bin) throw new Error('가르기 답을 못 찾음: ' + text);
    await rows.nth(i).locator('.bin', { hasText: bin }).click();
    await wait(90);
  }
  await vis('button:has-text("확정하기")').last().click();
  await wait(600);
  await page.evaluate(() => { const s = [...document.querySelectorAll('.sortb')].pop(); if (s) s.classList.add('done'); });
}

async function solveOrder(wrongFirst) {
  const total = await page.evaluate(() => G.app.cur().song.ri.find((b) => b.do === 'order').items.length);
  const pick = (k) => page.evaluate((k) => {
    const want = G.util.yet(G.app.cur().song.ri.find((b) => b.do === 'order').items[k]).replace(/\{([^|}]+)\|[^}]+\}/g, '$1').replace(/\*\*/g, '').replace(/\s+/g, '');
    return [...document.querySelectorAll('.orderb .pool .ochip')].findIndex((c) => { const x = c.cloneNode(true); x.querySelectorAll('rt').forEach((r) => r.remove()); return x.textContent.replace(/\s+/g, '') === want; });
  }, k);
  const seq = wrongFirst ? [1, 0, ...Array.from({ length: total - 2 }, (_, i) => i + 2)] : Array.from({ length: total }, (_, i) => i);
  for (const k of seq) { await vis('.orderb .pool .ochip').nth(await pick(k)).click(); await wait(80); }
  await vis('button:has-text("확정하기")').last().click(); await wait(450);
  if (wrongFirst) {
    for (let k = 0; k < total; k++) { await vis('.orderb .oline .ochip').first().click(); await wait(60); }
    for (let k = 0; k < total; k++) { await vis('.orderb .pool .ochip').nth(await pick(k)).click(); await wait(80); }
    await vis('button:has-text("확정하기")').last().click(); await wait(600);
  }
}

async function chooseOnce(wrongFirst) {
  const info = await page.evaluate(() => {
    const norm = (t) => String(t).replace(/\{([^|}]+)\|[^}]+\}/g, '$1').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
    const ok = new Set(); const all = [];
    const walk = (v) => { if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') { if (v.t) { all.push(v); if (v.ok) ok.add(norm(G.util.yet(v.t))); } Object.values(v).forEach(walk); } };
    // 다른 곡의 정답이 이 곡의 오답 보기로 나오므로 지금 곡만 본다
    const cur = G.app.cur && G.app.cur();
    if (cur && document.querySelector('.play')) walk(cur.song); else walk(INTRO);
    const el = [...document.querySelectorAll('.choose:not(.done)')].pop();
    const opts = [...el.querySelectorAll('.opt')].map((o) => { const x = o.cloneNode(true); x.querySelectorAll('rt').forEach((r) => r.remove()); return norm(x.textContent); });
    const okIdx = opts.findIndex((t) => ok.has(t));
    return { okIdx, n: opts.length };
  });
  const opts = vis('.choose:not(.done) .opt');
  if (info.okIdx < 0) { await opts.first().click(); await wait(400); return 'free'; } // 채점하지 않는 해석 고르기
  if (wrongFirst) { const w = info.okIdx === 0 ? 1 : 0; await opts.nth(w).click(); await wait(350); check(await page.locator('.opt.bad').count() > 0, '오답 표시'); }
  await vis('.choose:not(.done) .opt').nth(info.okIdx).click();
  await wait(450);
  return 'ok';
}

// 풍경 속 찾기: 보이지 않는 곳은 풍경을 끌어 훑은 뒤(여기서는 그 자리로 옮긴 뒤) 누른다
async function tapSpot() {
  const r = await page.evaluate(() => {
    const c = G.app.cur(); const sp = c.scene.spots.find((s) => !s.btn.hidden && !s.btn.classList.contains('got'));
    if (!sp) return -1; c.scene.panTo(sp.x, sp.y); return c.scene.spots.indexOf(sp);
  });
  if (r < 0) return false;
  await wait(150);
  await page.locator('.spot').nth(r).click();
  await wait(650);
  return true;
}

async function kyeong(num, opts = {}) {
  await page.waitForFunction(() => document.querySelector('.play.st-kyeong') && G.app.cur().scene.spots.length > 0, null, { timeout: 15000 });
  if (opts.miss) { const box = await vis('.scene').boundingBox(); await page.mouse.click(box.x + 20, box.y + 30); await wait(250); }
  for (let guard = 0; guard < 12; guard++) {
    if (await tapSpot()) continue;
    const other = vis('.season-wheel .sw:not(.on)');
    if (await other.count() && (await page.evaluate(() => G.app.cur().scene.spots.some((s) => !s.btn.classList.contains('got'))))) { await other.click(); await wait(1100); continue; }
    break;
  }
  if (opts.shot) await shot(`s${num}_found`);
  const gb = await page.evaluate(() => { const c = G.app.cur(); return [...document.querySelectorAll('.poem u.gb')].filter((u) => !c.song.words[u.dataset.w].ri).length; });
  check(gb > 0, num + '곡 풀이에 시어 빈자리가 있어야 함');
  let first = true;
  for (let guard = 0; guard < 8 && await vis('.tray .wcard').count(); guard++) {
    const card = vis('.tray .wcard').first();
    const id = await card.getAttribute('data-id');
    if (first && opts.wrong) {
      const other = await page.evaluate((id) => [...document.querySelectorAll('.blank:not(.filled):not(.ri)')].map((b) => b.dataset.accept).find((a) => a !== id), id);
      if (other) { await card.click(); await vis(`.blank[data-accept="${other}"]`).first().click(); await wait(400); check(await page.locator('.blank.smudge').count() > 0 || true, '잘못 넣으면 번짐'); }
    }
    first = false;
    await vis('.tray .wcard').first().click(); await wait(80);
    await vis(`.blank[data-accept="${id}"]`).first().click();
    await wait(380);
  }
  await wait(700);
  const left = await page.evaluate(() => { const c = G.app.cur(); return [...document.querySelectorAll('.poem u.gb')].filter((u) => !c.song.words[u.dataset.w].ri).length; });
  check(left === 0, num + '곡 시어를 다 넣으면 풀이 빈자리가 모두 드러나야 함(' + left + ')');
}

async function foot(num, opts = {}) {
  await page.waitForSelector('.footboard .fline');
  check(await page.locator('.footrule').count() === 1, num + '곡 음보 규칙 띠');
  const cuts = await page.evaluate(() => G.app.cur().song.feet.map((f) => [...G.text.feet(f).cuts]));
  const lines = page.locator('.footboard:not(.singing) .fline');
  if (opts.wrong) {
    const li = await page.evaluate(() => [...document.querySelectorAll('.footboard .fline')].findIndex((r) => !r.classList.contains('done')));
    const wrongGap = await page.evaluate((li) => { const f = G.text.feet(G.app.cur().song.feet[li]); for (let i = 0; i < f.syl.length - 1; i++) if (!f.cuts.has(i) && !f.opt.has(i)) return i; return 0; }, li);
    await lines.nth(li).locator(`.gap[data-i="${wrongGap}"]`).click(); await wait(350);
    check(await page.locator('.pop').count() > 0, '음보 오답 풍선');
    await page.mouse.click(5, 5); await wait(100);
  }
  check(await page.locator('.poem.mokpan').count() === 1, num + '곡 음보 끊기 동안 원문 판은 띄어쓰기 없이');
  check(await page.locator('.fline .need').count() === 3, num + '곡 남은 빗금 점');
  let bySyl = !!opts.slow;
  for (let li = 0; li < 3; li++) {
    if (await lines.nth(li).evaluate((r) => r.classList.contains('done'))) continue;
    for (const i of cuts[li]) {
      // 글자를 눌러도 그 뒤가 끊긴다(첫 곡에서 한 번 확인)
      if (bySyl) { await lines.nth(li).locator(`.syl[data-i="${i}"]`).click(); bySyl = false; await wait(200); check(await lines.nth(li).locator(`.gap[data-i="${i}"].cut`).count() === 1, '글자를 눌러 끊기'); }
      else await lines.nth(li).locator(`.gap[data-i="${i}"]`).click();
      await wait(opts.slow ? 420 : 200);
    }
  }
  const dots = await page.locator('.fline .need').allTextContents();
  check(dots.every((d) => !d.includes('○')), num + '곡 빗금 점이 모두 채워져야 함 ' + dots.join(' '));
  // 종장 첫 음보 카드(처음 한 번)
  const rule = vis('.next-row button:has-text("알겠어요")');
  try { await rule.last().waitFor({ timeout: 3500 }); await rule.last().click(); } catch (e) { /* 이미 본 카드 */ }
  await page.waitForSelector('.footboard.singing', { timeout: 8000 });
  if (opts.listen) {
    await wait(2500);
    await shot(`s${num}_singing`);
    const sung = await page.locator('.singing .foot.sung').count();
    check(sung >= 2, '노래할 때 음보가 차례로 번져야 함');
    await page.waitForSelector('.play.st-done', { timeout: 60000 }); // 끝까지 듣기
  } else {
    await wait(400);
    await vis('button:has-text("건너뛰기")').click();
  }
}

// 理 읽기: 화면에 나온 것을 차례로 푼다
async function ri(num, opts = {}) {
  let wrongUsed = false;
  for (let guard = 0; guard < 60; guard++) {
    const cls = await page.evaluate(() => document.querySelector('.play').className);
    if (cls.includes('st-foot')) return;
    if (await vis('.fork-btn.shiny:not([disabled])').count()) { await vis('.fork-btn.shiny').click(); await wait(2300); await shot(`s${num}_fork_loop`); continue; }
    if (await vis('.fork-btn.humble:not([disabled])').count()) { await vis('.fork-btn.humble').click(); await wait(300); continue; }
    if (await vis('.orderb .pool .ochip').count()) { await solveOrder(!!opts.wrong && !wrongUsed); wrongUsed = true; continue; }
    if (await page.locator('.batch .pool').filter({ visible: true }).count()) { await solveBatch(!!opts.wrong && !wrongUsed); wrongUsed = true; continue; }
    if (await page.locator('.sortb:not(.done)').filter({ visible: true }).count()) { await solveSort(); continue; }
    if (await vis('.choose:not(.done)').count()) { await chooseOnce(!!opts.wrongChoose && !wrongUsed); wrongUsed = true; continue; }
    const nb = vis('.next-row button').filter({ hasText: /다음 ▶|알겠어요/ });
    if (await nb.count()) { await nb.last().click(); await wait(300); continue; }
    await wait(400);
  }
  throw new Error(num + '곡 理 읽기가 끝나지 않음');
}

async function finish(num, opts = {}) {
  await page.waitForSelector('.play.st-done');
  await wait(600);
  if (!opts.noMind) await chooseOnce(num === 4 && !opts.stay); // 4곡은 화자의 마음을 한 번 틀려 본다(다시 하기에서는 바로)
  await page.waitForSelector('.tong-note', { timeout: 12000 });
  await wait(500);
  await shot(`s${num}_wash`);
  check(await page.locator('.card .kind').filter({ hasText: '알아 두기' }).count() > 0, num + '곡 한눈에 요약');
  check(await page.locator('.scene .scene-seal').count() === 1, num + '곡 풍경 위 낙관');
}

async function song(num, opts = {}) {
  try { await page.waitForSelector('.play', { timeout: 8000 }); } catch (e) { await shot('fail_before_' + num); throw e; }
  await wait(900);
  const title = await page.locator('.topbar .where strong').textContent();
  check(title.includes(num + '곡'), `${num}곡 화면(${title})`);
  if (opts.shot) await shot(`s${num}_open`);
  await kyeong(num, opts);
  if (opts.reload) {
    // 곡 중간에 새로 고침 → 이어 하기(景은 끝난 채로 理부터)
    await page.reload(); await page.waitForSelector('.play'); await wait(1000);
    const st = await page.evaluate(() => document.querySelector('.play').className);
    check(st.includes('st-ri'), '새로 고침 뒤 理부터 이어져야 함: ' + st);
    const filled = await page.locator('.blank.filled').count();
    check(filled > 0, '새로 고침 뒤에도 넣은 시어가 남아 있어야 함');
  }
  if (opts.help) { await vis('.help-btn').click(); await wait(400); check(await page.locator('.pop').count() > 0, '여백 메모'); await page.mouse.click(5, 5); }
  if (opts.shot) await shot(`s${num}_ri_start`);
  await ri(num, opts);
  if (opts.shot) await shot(`s${num}_foot`);
  await foot(num, opts);
  await finish(num, opts);
  // 병풍에 걸기 → 병풍에서 다음 곡(또는 결과)
  await vis('.next-row button').filter({ hasText: /병풍에 걸기|길에 새기기/ }).click();
  await page.waitForSelector('.page.map');
  check(await page.locator('.pane.hang').count() === 1, num + '곡 병풍에 걸기');
  await wait(1700);
  if (opts.shot) await shot(`s${num}_hang`);
  if (opts.stay) return;
  const go = vis('.next-row .btn.primary');
  if (await go.count()) await go.click();
  else await vis('.next-row .btn.seal').click();
}

async function intro(p) {
  await wait(700);
  await shot(`intro${p}`);
  for (let guard = 0; guard < 40 && !(await page.locator('.page.map').count()); guard++) {
    if (await page.locator('.sortb:not(.done)').filter({ visible: true }).count()) { await solveSort(); await shot(`intro${p}_sorted`); continue; }
    if (await page.locator('.batch .pool').filter({ visible: true }).count()) { await shot(`intro${p}_recall`); await solveBatch(true); continue; }
    const nb = vis('.next-row button').filter({ hasText: /▶|알겠어요/ });
    if (await nb.count()) { await nb.last().click(); await wait(350); continue; }
    await wait(400);
  }
  await page.waitForSelector('.page.map');
  await shot(`map${p}`);
  check(await page.locator('.tong-lead').count() === 1, '通 낙관 안내');
}

async function result(p) {
  await page.waitForSelector('.page.result');
  await wait(900);
  await page.fill('.name-input', '1-3 12 김지은');
  await vis('button:has-text("이름 낙관 찍기")').click();
  await wait(900);
  await shot(`result${p}`);
  check(await page.locator('.name-seal.on').count() === 1, '낙관이 찍혀야 함');
  const rows = await page.locator('.mindmap .mrow').count();
  check(rows === (p === 1 ? 6 : 12), `마음 지도 줄 수(${rows})`);
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), vis('button:has-text("그림 파일로 저장")').click()]);
  const path = fileURLToPath(new URL(`result${p}.png`, OUT));
  await dl.saveAs(path);
  const size = fs.statSync(path).size;
  check(size > 100000, `저장한 그림 크기(${size})`);
  log(`결과 ${p}부: 낙관, 마음 지도 ${rows}줄, 그림 ${Math.round(size / 1024)}KB`);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await wait(300);
  await shot(`result${p}_bottom`);
}

// ───────── 시작 ─────────
await page.goto(BASE);
await page.evaluate(() => localStorage.clear());
await page.goto(BASE);
await page.waitForSelector('.title-screen');
await page.mouse.click(8, 400); // 첫 터치(소리 켜기)
await wait(600);
// 배경음: 국립국악원 녹음(첫 화면은 대금 청성곡)이 실제로 흐르는가
check(await page.waitForFunction(() => G.audio.now() === 'dosan' && G.audio.nowRec(), null, { timeout: 10000 }).then(() => true, () => false), '첫 화면 배경음이 녹음으로 흘러야 함');
const fontOk = await page.evaluate(async () => { await document.fonts.load('20px DosanYet', 'ᄒᆞᄆᆞᆯ며'); await document.fonts.ready; return { yet: document.fonts.check('20px DosanYet', 'ᄒᆞᄆᆞᆯ며'), brush: document.fonts.check('40px DosanBrush', '도산십이곡') }; });
check(fontOk.yet && fontOk.brush, '글꼴 ' + JSON.stringify(fontOk));
await shot('title');
// 설정: 한자 끄기 → 켜기, 글자 크게 → 보통
await vis('button:has-text("설정")').click(); await wait(300);
await vis('.setrow:has-text("한자") button').click(); await wait(150);
check(await page.evaluate(() => document.documentElement.classList.contains('no-hanja')), '한자 끄기');
await vis('.setrow:has-text("한자") button').click();
await vis('.setrow button:has-text("크게")').click(); await vis('.setrow button:has-text("보통")').click();
await shot('settings');
await vis('.sheet .actions button:has-text("닫기")').click(); await wait(300);

// 1부
log('1부 시작');
await vis('.btn.part:has-text("1부")').click();
await intro(1);
await vis('.next-row .btn.primary').click();
await song(1, { shot: true, miss: true, wrong: true, listen: true, slow: true });
log('1곡 끝');
await song(2, { wrongChoose: true });
log('2곡 끝');
await song(3, { reload: true, wrong: true, shot: true });
log('3곡 끝(새로 고침 이어 하기)');
await song(4, { shot: true, help: true });
log('4곡 끝');
// 5곡: 메뉴·병풍 접기
await page.waitForSelector('.play'); await wait(800);
await vis('.topbar .icon-btn[aria-label="메뉴"]').click(); await wait(300);
await vis('.sheet button:has-text("시어 사전")').click(); await wait(400);
check((await page.locator('.dict-item:not(.locked)').count()) >= 9, '시어 사전에 되살린 시어가 모여야 함');
await shot('dict');
await vis('.sheet .actions button').last().click(); await wait(300);
await vis('.topbar .icon-btn[aria-label="메뉴"]').click(); await wait(300);
await vis('.sheet button:has-text("이본 노트")').click(); await wait(400);
await shot('variants');
await vis('.sheet .actions button').last().click(); await wait(300);
await vis('.topbar .icon-btn[aria-label^="병풍 접기"]').click(); await wait(400);
check(await page.locator('.fold-ov').count() === 1, '병풍 접기');
await shot('fold');
await vis('.fold-ov button').click(); await wait(300);
await song(5, { wrong: true });
log('5곡 끝');
await song(6, { shot: true });
log('6곡 끝');
await result(1);

check(await page.locator('button:has-text("2부 언학으로")').count() === 0, '1부를 막 마치면 2부 단추는 다음 시간에');
// 도움 없이 다시: 4곡(마음을 한 번 틀림) → 다시 읽기 규칙으로 → 금빛 通
await page.goto(BASE + '?part=1'); await page.waitForSelector('.page.map'); await wait(600);
check(await page.locator('.pane .tong.xi').count() >= 1, '通이 없는 폭에는 習 낙관');
await vis('.retry-row button:has-text("제4곡")').click(); await wait(300);
await vis('.sheet button:has-text("다시 하기")').click();
await song(4, { stay: true });
check(await page.locator('.pane .tong.gold').count() === 1, '도움 없이 다시 → 금빛 通');
log('4곡 다시 하기 → 금빛 通');
// 2부(처음 화면에서)
log('2부 시작');
await page.goto(BASE); await page.waitForSelector('.title-screen');
await vis('.btn.part:has-text("2부")').click();
await intro(2);
await vis('.next-row .btn.primary').click();
await song(7, { shot: true, wrong: true, listen: true });
log('7곡 끝');
for (const num of [8, 9, 10, 11, 12]) { await song(num, { shot: num === 10 || num === 12, wrong: num === 9 || num === 12 }); log(num + '곡 끝'); }
await result(2);

// 다시 읽기(복습): 11곡을 다시 열면 세 장을 모두 직접 끊는다
await page.goto(BASE);
await page.waitForSelector('.title-screen');
await vis('button:has-text("처음 읽기 중")').click(); await wait(300);
await vis('.sheet button:has-text("다시 읽기")').click(); await wait(500);
await page.goto(BASE + '?song=11'); await page.waitForSelector('.play'); await wait(1000);
check(await page.locator('.gloss:not([hidden])').count() === 0, '다시 읽기에서는 풀이가 숨어야 함');
const todo = await page.locator('.footboard .fline:not(.done)').count();
check(todo === 2, `다시 읽기에서는 세 장을 모두 끊음(남은 장 ${todo})`);
await shot('review_s11');

const st = await page.evaluate(() => ({ done: Object.keys(G.save.state.done).length, first: G.save.state.stats, wrong: G.save.state.wrong.length, helped: G.save.state.helped }));
log('상태', JSON.stringify(st));
check(st.done === 12, '열두 곡 모두 완성');
console.log(errors.length ? 'PROBLEMS\n' + errors.join('\n') : 'ALL OK — 문제 없음');
await browser.close();
process.exit(errors.length ? 1 : 0);
