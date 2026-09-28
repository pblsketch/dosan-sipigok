// 녹음 배경음 점검: 파일마다 풀어 반복 이음새(끝→처음)의 튐을 재고, 게임에서 녹음이 실제로 흐르는지,
// 1부 거문고 ↔ 마음의 눈 양금이 같은 자리에서 이어지는지 본다.
//   cd tests && node bgm.mjs
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://127.0.0.1:8766/index.html';
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(BASE);
await page.mouse.click(8, 400); // 첫 터치(소리 켜기)
await page.waitForTimeout(500);

// 1) 이음새: 끝 20ms와 처음 20ms의 세기, 경계에서 한 샘플 사이의 튐
const seams = await page.evaluate(async () => {
  const out = [];
  const ac = new AudioContext();
  for (const [name, r] of Object.entries(G.audio.REC)) {
    const ab = await (await fetch(r.file)).arrayBuffer();
    const buf = await ac.decodeAudioData(ab);
    const d = buf.getChannelData(0), sr = buf.sampleRate;
    // 게임과 같은 방식: 빈 틈을 떼고 풀었으면(길이가 같으면) 처음부터
    const extra = Math.max(0, buf.duration - r.len);
    let i = 0; const lim = Math.floor(Math.min(extra, 0.08) * sr);
    if (extra > 0.005) while (i < lim && Math.abs(d[i]) < 1e-4) i++;
    const s0 = i, e0 = Math.min(d.length, s0 + Math.round(r.len * sr));
    const rms = (a, b) => { let t = 0; for (let k = a; k < b; k++) t += d[k] * d[k]; return Math.sqrt(t / (b - a)); };
    const w = Math.round(0.02 * sr);
    out.push({ name, dur: +buf.duration.toFixed(3), len: r.len, lead: +(s0 / sr).toFixed(4), fits: e0 <= d.length, endRms: +rms(e0 - w, e0).toFixed(4), headRms: +rms(s0, s0 + w).toFixed(4), jump: +Math.abs(d[e0 - 1] - d[s0]).toFixed(4), bodyRms: +rms(s0, e0).toFixed(4) });
  }
  ac.close();
  return out;
});
for (const s of seams) console.log('이음새', JSON.stringify(s));

// 2) 게임에서 녹음이 흐르는가, 짝 곡이 같은 자리에서 이어지는가
const play = async (name, ms) => { await page.evaluate((n) => G.audio.play(n), name); await page.waitForTimeout(ms); return page.evaluate(() => ({ now: G.audio.now(), rec: G.audio.nowRec() })); };
for (const name of Object.keys(await page.evaluate(() => G.audio.REC))) {
  const st = await play(name, 1800);
  console.log('재생', name, JSON.stringify(st));
  if (!(st.now === name && st.rec)) errors.push(name + ' 녹음이 흐르지 않음');
}
await play('eonji', 4000);
const a = await page.evaluate(() => G.audio.where());
await play('ri', 1500);
const b = await page.evaluate(() => G.audio.where());
console.log('짝 곡', JSON.stringify(a), '→', JSON.stringify(b));
if (!(b.name === 'ri' && Math.abs(b.at - (a.at + 1.5)) < 0.8)) errors.push('거문고 → 양금이 같은 자리에서 이어지지 않음');
console.log(errors.length ? 'PROBLEMS\n' + errors.join('\n') : 'ALL OK');
await browser.close();
process.exit(errors.length ? 1 : 0);
