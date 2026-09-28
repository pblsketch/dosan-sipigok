// 배경음 점검: 곡마다 20초를 오프라인으로 렌더해 음량(RMS)·최고값을 잰다. 곡끼리 음량이 비슷해야 한다.
//   cd tests && node audio.mjs [--preview]   (--preview: design/audio_preview/에 wav로 저장)
import { chromium } from 'playwright';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE || 'http://127.0.0.1:8766/index.html';
const preview = process.argv.includes('--preview');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
await page.goto(BASE);
const res = await page.evaluate(async (preview) => {
  const out = [];
  for (const name of Object.keys(G.audio.TRACKS)) {
    const buf = await G.audio.render(name, 20, 44100);
    const d = buf.getChannelData(0);
    let sum = 0, peak = 0;
    for (let i = 0; i < d.length; i++) { sum += d[i] * d[i]; peak = Math.max(peak, Math.abs(d[i])); }
    const rms = Math.sqrt(sum / d.length);
    let wav = null;
    if (preview) {
      // 16비트 모노 wav
      const n = d.length, bytes = new ArrayBuffer(44 + n * 2), v = new DataView(bytes);
      const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
      w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
      v.setUint32(24, 44100, true); v.setUint32(28, 88200, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
      for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, d[i])) * 32767, true);
      wav = Array.from(new Uint8Array(bytes));
    }
    out.push({ name, gain: G.audio.TRACKS[name].gain, rmsDb: 20 * Math.log10(rms), peak, wav });
  }
  return out;
}, preview);
const mean = res.reduce((a, r) => a + r.rmsDb, 0) / res.length;
for (const r of res) {
  console.log(`${r.name.padEnd(8)} gain ${String(r.gain).padEnd(5)} RMS ${r.rmsDb.toFixed(1)} dB (평균과 ${(r.rmsDb - mean).toFixed(1)} dB) 최고 ${r.peak.toFixed(2)}${r.peak > 0.98 ? ' ← 클리핑' : ''}  → 맞출 gain ${(r.gain * Math.pow(10, (mean - r.rmsDb) / 20)).toFixed(2)}`);
  if (preview && r.wav) {
    const dir = new URL('../design/audio_preview/', import.meta.url);
    fs.mkdirSync(fileURLToPath(dir), { recursive: true });
    fs.writeFileSync(fileURLToPath(new URL(r.name + '.wav', dir)), Buffer.from(r.wav));
  }
}
await browser.close();
