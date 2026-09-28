'use strict';
// 소리: 모두 브라우저에서 합성한다(소리 파일 없음). 같은 만든이의 「관동별곡」「사씨남정기」 합성 엔진을 가져와 곡을 새로 지었다.
//  - 가야금: 줄을 튕기는 소리를 흉내 내는 Karplus-Strong 합성 + 농현(떨기)·밀어 올리기·꺾어 내리기
//  - 대금: 사인파 + 숨소리 + 늦게 들어오는 떨림, 음 사이를 미끄러지듯 잇기
//  - 해금: 톱니파를 걸러 낸 비음 섞인 활 소리
//  - 장구(덩·쿵·덕·기덕), 북, 징, 낮은 지속음, 은은한 배경음(꿈 장면)
//  - 잔향: 합성한 공간 울림(ConvolverNode)
// 곡은 장면마다 고른다. 배경음·효과음은 설정에서 따로 끈다.
// 시조 가락(G.audio.song): 음보마다 가야금 가락을 지어 음보 끊기·노래 부르기에 쓴다. 이 가락은 게임을 위해 새로 지은 것이다.
(function () {
  const MUSIC_VOL = 0.5, SFX_VOL = 0.8;
  let ctx = null, comp, musicBus, sfxBus, revIn;
  let ksCache = {}, noiseBuf = null;
  const A = (G.audio = { track: null });
  const S = () => G.save.state;
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  // 소리 길(버스) 만들기: 실제 재생과 미리 듣기(오프라인 렌더)에 함께 쓴다
  function buildGraph(c) {
    const cp = c.createDynamicsCompressor();
    cp.threshold.value = -14; cp.knee.value = 12; cp.ratio.value = 3; cp.attack.value = 0.01; cp.release.value = 0.25;
    const master = c.createGain(); master.gain.value = 1;
    cp.connect(master); master.connect(c.destination);
    const mb = c.createGain(); mb.gain.value = MUSIC_VOL; mb.connect(cp);
    const sb = c.createGain(); sb.gain.value = SFX_VOL; sb.connect(cp);
    const rev = c.createConvolver();
    const len = Math.floor(c.sampleRate * 2.6), ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) { const k = i / len; d[i] = (Math.random() * 2 - 1) * Math.pow(1 - k, 2.4) * (i < 400 ? i / 400 : 1); }
    }
    rev.buffer = ir;
    const ri = c.createGain(); ri.gain.value = 1;
    const ro = c.createGain(); ro.gain.value = 0.3;
    const rl = c.createBiquadFilter(); rl.type = 'lowpass'; rl.frequency.value = 5000;
    ri.connect(rev); rev.connect(rl); rl.connect(ro); ro.connect(cp);
    return { comp: cp, musicBus: mb, sfxBus: sb, revIn: ri };
  }

  function init() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch (e) { return null; }
    ({ comp, musicBus, sfxBus, revIn } = buildGraph(ctx));
    musicBus.gain.value = S().music ? MUSIC_VOL : 0;
    // 다른 탭으로 가면 소리를 멈춘다(교실에서 여러 기기가 동시에 울리지 않게)
    document.addEventListener('visibilitychange', () => {
      if (!ctx) return;
      if (document.hidden) ctx.suspend(); else ctx.resume();
    });
    A.ctx = ctx;
    return ctx;
  }

  function noise() {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; return s;
  }
  function gainNode(v) { const g = ctx.createGain(); g.gain.value = v; return g; }
  function filt(type, f, q) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q !== undefined) b.Q.value = q; return b; }
  function send(node, out, wet) { node.connect(out); if (wet > 0) { const s = gainNode(wet); node.connect(s); s.connect(revIn); } }

  // ───────── 가야금 (Karplus-Strong)
  function ksBuffer(midi) {
    if (ksCache[midi]) return ksCache[midi];
    const sr = ctx.sampleRate, f = mtof(midi);
    const N = Math.max(2, Math.round(sr / f));
    const len = Math.floor(sr * (midi < 60 ? 3.2 : 2.4));
    const buf = ctx.createBuffer(1, len, sr), d = buf.getChannelData(0);
    const ring = new Float32Array(N);
    for (let i = 0; i < N; i++) ring[i] = Math.random() * 2 - 1;
    for (let pass = 0; pass < 2; pass++) for (let i = 1; i < N; i++) ring[i] = (ring[i] + ring[i - 1]) * 0.5; // 명주실처럼 부드러운 소리
    const decay = 0.9955 + 0.003 * Math.min(1, Math.max(0, (midi - 45) / 40));
    let idx = 0;
    for (let i = 0; i < len; i++) {
      const a = ring[idx], b = ring[(idx + 1) % N];
      ring[idx] = (a + b) * 0.5 * decay;
      d[i] = a;
      idx = (idx + 1) % N;
    }
    return (ksCache[midi] = buf);
  }
  function gayageum(t, midi, dur, vel, orn, out, wet = 0.28) {
    const src = ctx.createBufferSource();
    src.buffer = ksBuffer(Math.round(midi));
    const r = src.playbackRate;
    r.setValueAtTime(orn.includes('<') ? 0.945 : 1, t);
    if (orn.includes('<')) r.linearRampToValueAtTime(1, t + 0.09);
    if (orn.includes('~') && dur > 0.35) { // 농현: 줄을 눌렀다 놓았다
      for (let k = 0, tt = t + 0.18; tt < t + dur; k++, tt += 0.11) r.linearRampToValueAtTime(k % 2 ? 1 : 1.022, tt);
      r.linearRampToValueAtTime(1, t + dur);
    }
    if (orn.includes('>')) { r.setValueAtTime(1, t + Math.max(0.05, dur - 0.18)); r.linearRampToValueAtTime(0.95, t + dur); }
    const lp = filt('lowpass', 3800), body = filt('peaking', 900, 1); body.gain.value = 3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vel * 0.55, t);
    g.gain.setTargetAtTime(0.0001, t + dur + 0.05, 0.35);
    src.connect(body); body.connect(lp); lp.connect(g); send(g, out, wet);
    src.start(t); src.stop(t + dur + 2.2);
  }

  // ───────── 대금
  function daegeum(t, midi, dur, vel, orn, out, prev, wet = 0.36) {
    const f = mtof(midi);
    const o1 = ctx.createOscillator(); o1.type = 'sine';
    const o2 = ctx.createOscillator(); o2.type = 'triangle';
    const o3 = ctx.createOscillator(); o3.type = 'sine';
    const set = (fq, at) => { o1.frequency.setValueAtTime(fq, at); o2.frequency.setValueAtTime(fq, at); o3.frequency.setValueAtTime(fq * 2, at); };
    const ramp = (fq, at) => { o1.frequency.linearRampToValueAtTime(fq, at); o2.frequency.linearRampToValueAtTime(fq, at); o3.frequency.linearRampToValueAtTime(fq * 2, at); };
    if (prev) { set(mtof(prev), t); ramp(f, t + 0.07); }
    else if (orn.includes('<')) { set(f * 0.94, t); ramp(f, t + 0.1); }
    else set(f, t);
    if (orn.includes('>')) { const s = t + Math.max(0.1, dur - 0.2); set(f, s); ramp(f * 0.955, t + dur); }
    const lfo = ctx.createOscillator(); lfo.frequency.value = 5.3;
    const lg = ctx.createGain(); lg.gain.setValueAtTime(0, t);
    const vs = t + Math.min(0.45, dur * 0.4), depth = f * (orn.includes('~') ? 0.016 : 0.006);
    lg.gain.linearRampToValueAtTime(0, vs); lg.gain.linearRampToValueAtTime(depth, Math.min(t + dur, vs + 0.4));
    lfo.connect(lg); lg.connect(o1.frequency); lg.connect(o2.frequency);
    const mix = ctx.createGain(); mix.gain.value = 1;
    const g2 = gainNode(0.14), g3 = gainNode(0.05);
    o1.connect(mix); o2.connect(g2); g2.connect(mix); o3.connect(g3); g3.connect(mix);
    const n = noise(), bp = filt('bandpass', f * 1.6, 0.9), ng = gainNode(0.035 * vel); // 숨소리
    n.connect(bp); bp.connect(ng); ng.connect(mix);
    const ch = noise(), hp = filt('highpass', 2500), cg = ctx.createGain(); // 첫소리의 바람 잡음
    cg.gain.setValueAtTime(0.0001, t); cg.gain.exponentialRampToValueAtTime(0.06 * vel, t + 0.01); cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    ch.connect(hp); hp.connect(cg); cg.connect(mix);
    const env = ctx.createGain(), peak = 0.2 * vel;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(peak, t + (prev ? 0.03 : 0.08));
    env.gain.setValueAtTime(peak, t + Math.max(0.09, dur - 0.06));
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.16);
    const lp = filt('lowpass', 4200);
    mix.connect(lp); lp.connect(env); send(env, out, wet);
    const end = t + dur + 0.3;
    [o1, o2, o3, lfo, n, ch].forEach((s) => { s.start(t); s.stop(end); });
  }

  // ───────── 해금
  function haegeum(t, midi, dur, vel, orn, out, prev, wet = 0.3) {
    const f = mtof(midi);
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth';
    const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.detune.value = 7;
    const setF = (fq, at) => { o1.frequency.setValueAtTime(fq, at); o2.frequency.setValueAtTime(fq, at); };
    const rampF = (fq, at) => { o1.frequency.linearRampToValueAtTime(fq, at); o2.frequency.linearRampToValueAtTime(fq, at); };
    if (prev) { setF(mtof(prev), t); rampF(f, t + 0.06); }
    else if (orn.includes('<')) { setF(f * 0.9, t); rampF(f, t + 0.12); }
    else setF(f, t);
    if (orn.includes('>')) { const s = t + Math.max(0.08, dur - 0.18); setF(f, s); rampF(f * 0.95, t + dur); }
    const lfo = ctx.createOscillator(); lfo.frequency.value = 6.2;
    const lg = ctx.createGain(); lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * (orn.includes('~') ? 0.02 : 0.009), t + Math.min(dur, 0.35));
    lfo.connect(lg); lg.connect(o1.frequency); lg.connect(o2.frequency);
    const bp = filt('bandpass', 1100, 0.8), pk = filt('peaking', 2500, 1.4); pk.gain.value = 6;
    const lp = filt('lowpass', 3600);
    const env = ctx.createGain(), peak = 0.11 * vel;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(peak, t + (prev ? 0.04 : 0.1));
    env.gain.setValueAtTime(peak, t + Math.max(0.1, dur - 0.05));
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.14);
    o1.connect(bp); o2.connect(bp); bp.connect(pk); pk.connect(lp); lp.connect(env); send(env, out, wet);
    const end = t + dur + 0.25;
    [o1, o2, lfo].forEach((s) => { s.start(t); s.stop(end); });
  }

  // ───────── 지속음·배경음
  function drone(t, midi, dur, vel, out) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(midi);
    const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = mtof(midi) * 1.5; o2.detune.value = -4;
    const lp = filt('lowpass', 480, 0.7);
    const g = ctx.createGain(), g2 = gainNode(0.3);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.04 * vel, t + 0.9);
    g.gain.setValueAtTime(0.04 * vel, t + Math.max(1, dur - 0.9)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); send(g, out, 0.2);
    o.start(t); o2.start(t); o.stop(t + dur + 0.1); o2.stop(t + dur + 0.1);
  }
  function pad(t, midi, dur, vel, out) {
    const lp = filt('lowpass', 1800);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05 * vel, t + 1.2);
    g.gain.setValueAtTime(0.05 * vel, t + Math.max(1.3, dur - 1)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 1.2);
    for (const dt of [-7, 0, 7]) {
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = mtof(midi); o.detune.value = dt;
      o.connect(lp); o.start(t); o.stop(t + dur + 1.3);
    }
    lp.connect(g); send(g, out, 0.5);
  }

  // ───────── 타악: 장구·북·징
  function hit(t, kind, vel, out) {
    const kung = (tt, v) => {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(96, tt); o.frequency.exponentialRampToValueAtTime(56, tt + 0.2);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(0.6 * v, tt + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.38);
      o.connect(g); send(g, out, 0.12); o.start(tt); o.stop(tt + 0.42);
      const n = noise(), lp = filt('lowpass', 380), ng = ctx.createGain();
      ng.gain.setValueAtTime(0.2 * v, tt); ng.gain.exponentialRampToValueAtTime(0.0001, tt + 0.06);
      n.connect(lp); lp.connect(ng); ng.connect(out); n.start(tt); n.stop(tt + 0.08);
    };
    const deok = (tt, v) => {
      const n = noise(), bp = filt('bandpass', 2700, 2.5), g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(0.42 * v, tt + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.07);
      n.connect(bp); bp.connect(g); send(g, out, 0.15); n.start(tt); n.stop(tt + 0.09);
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(820, tt); o.frequency.exponentialRampToValueAtTime(560, tt + 0.04);
      const og = ctx.createGain(); og.gain.setValueAtTime(0.12 * v, tt); og.gain.exponentialRampToValueAtTime(0.0001, tt + 0.05);
      o.connect(og); og.connect(out); o.start(tt); o.stop(tt + 0.06);
    };
    if (kind === 'kung') kung(t, vel);
    else if (kind === 'deok') deok(t, vel);
    else if (kind === 'deong') { kung(t, vel); deok(t, vel * 0.9); }
    else if (kind === 'gideok') { deok(t - 0.07, vel * 0.45); deok(t, vel); }
    else if (kind === 'buk') {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(74, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.45);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.75 * vel, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      o.connect(g); send(g, out, 0.2); o.start(t); o.stop(t + 0.65);
      const n = noise(), lp = filt('lowpass', 260), ng = ctx.createGain();
      ng.gain.setValueAtTime(0.3 * vel, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
      n.connect(lp); lp.connect(ng); ng.connect(out); n.start(t); n.stop(t + 0.12);
    } else if (kind === 'jing') {
      const f0 = 108;
      [[1, 1], [2.02, 0.55], [2.74, 0.4], [3.46, 0.28], [4.22, 0.18], [5.4, 0.1]].forEach(([m, a], i) => {
        const o = ctx.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(f0 * m * 1.012, t); o.frequency.exponentialRampToValueAtTime(f0 * m, t + 1.2);
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16 * a * vel, t + 0.03 + i * 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 4.2 - i * 0.4);
        o.connect(g); send(g, out, 0.45); o.start(t); o.stop(t + 4.3);
      });
    }
  }

  // ───────── 악보 읽기
  // 표기: 음(1~5, 0=쉼) + 옥타브(^ 위, v 아래) : 길이(단위 수) + 꾸밈(~ 떨기, < 밀어 올리기, > 꺾어 내리기)
  // 예) "1:4 2:2 3:2 | 4:6~ 1^:2" — | 는 마디 구분(보기 편하게)
  // 선법: 평조(밝고 너그러움) = 솔라도레미 꼴, 계면조(슬프고 애절함) = 라도레미솔 꼴
  const MODES = { pyeong: [0, 2, 5, 7, 9], gyemyeon: [0, 3, 5, 7, 10] };
  function parse(str, mode, tonic) {
    const out = [];
    let pos = 0;
    for (const tok of str.split(/\s+/)) {
      if (!tok || tok === '|') continue;
      const m = tok.match(/^([0-5])([\^v]*):(\d+(?:\.\d+)?)([~<>]*)$/);
      if (!m) { console.warn('악보 오류', tok); continue; }
      const deg = +m[1], dur = +m[3];
      if (deg > 0) {
        let oct = 0; for (const c of m[2]) oct += c === '^' ? 1 : -1;
        out.push({ pos, dur, midi: tonic + MODES[mode][deg - 1] + 12 * oct, orn: m[4] || '' });
      }
      pos += dur;
    }
    return { notes: out, len: pos };
  }
  const snap = (midi, mode, tonic) => { // 선법 밖의 음을 가장 가까운 선법 음으로
    const pcs = MODES[mode].map((x) => (x + tonic) % 12);
    for (let d = 0; d < 6; d++) for (const s of [0, -1, 1]) { const m = midi + d * s; if (pcs.includes(((m % 12) + 12) % 12)) return m; }
    return midi;
  };

  // 장단(마디 안의 위치, 소리, 세기)
  const JANGDAN = {
    jungmori8: [[0, 'deong', 0.55], [4, 'kung', 0.4], [6, 'deok', 0.25]],
    gutgeori12: [[0, 'deong', 0.9], [3, 'gideok', 0.6], [5, 'deok', 0.4], [6, 'kung', 0.8], [8, 'deok', 0.5], [9, 'kung', 0.7], [11, 'deok', 0.4]],
    jungjung12: [[0, 'deong', 0.6], [3, 'deok', 0.3], [6, 'kung', 0.55], [9, 'deok', 0.35], [10, 'deok', 0.22]],
    semachi9: [[0, 'deong', 0.9], [3, 'deok', 0.5], [5, 'deok', 0.35], [6, 'kung', 0.8], [7, 'deok', 0.4]],
    jajin12: [[0, 'deong', 1], [0, 'buk', 0.9], [2, 'deok', 0.55], [3, 'kung', 0.8], [5, 'deok', 0.55], [6, 'kung', 0.9], [6, 'buk', 0.7], [8, 'deok', 0.55], [9, 'kung', 0.8], [11, 'gideok', 0.65]],
    sneak12: [[0, 'kung', 0.5], [3, 'deok', 0.22], [6, 'kung', 0.35], [9, 'deok', 0.22], [11, 'deok', 0.14]],
    night12: [[0, 'kung', 0.45], [9, 'deok', 0.2]],
  };

  // ───────── 곡 (도산십이곡을 위해 새로 지음). gain = 곡끼리 음량 맞춤, drum = 장단 세기 배율(글을 읽는 장면은 작게)
  // 모두 평조(밝고 너그러움) 중심: 발문의 '온유돈후(溫柔敦厚)'에 맞춰 차분하게. 곁길(10곡)만 계면조로 기운다
  const TRACKS = {
    // 타이틀·도산 지도: 중모리에 대금이 길게, 가야금이 받친다
    dosan: {
      mode: 'pyeong', tonic: 67, gain: 0.55, unit: 60 / 112, bar: 8, jangdan: 'jungmori8', drum: 0.45, jing: [0], drone: 43,
      lead: { inst: 'daegeum', vel: 0.85, mel: '1:4 2:2 3:2 | 5:6~ 3:2 | 2:3 3:1 2:2 1:2 | 2:8~ | 3:2 5:2 1^:4 | 2^:6~ 1^:2 | 5:3 4:1 3:2 5:2 | 3:8~ | 5:4 1^:2 2^:2 | 1^:6~ 5:2 | 3:2 5:2 3:2 2:2 | 1:8~ | 2:4 3:2 5:2 | 3:4 2:2 1:2 | 5v:3 1:1 2:2 3:2 | 1:8~' },
      acc: { inst: 'gayageum', style: 'beats', beat: 4, oct: -12, vel: 0.42 },
    },
    // 1부 언지(병풍 속 풍경): 장단 없이 가야금이 물처럼 흐르고 낮은 소리가 깔린다
    eonji: {
      mode: 'pyeong', tonic: 69, gain: 2.0, unit: 60 / 132, bar: 12, jangdan: null, drone: 45,
      lead: { inst: 'gayageum', vel: 0.7, mel: '5v:3 1:3 2:3 3:3 | 5:9~ 3:3 | 2:3 3:3 2:3 1:3 | 2:12~ | 3:3 5:3 1^:3 5:3 | 3:9~ 2:3 | 1:3 2:3 3:3 5:3 | 5:12~ | 1^:3 2^:3 1^:3 5:3 | 1^:9~ 5:3 | 3:3 2:3 3:3 5v:3 | 1:12~' },
      acc: { inst: 'gayageum', style: 'arp', beat: 3, oct: -12, vel: 0.22 },
    },
    // 마음의 눈(이치 읽기): 높은 가야금과 은은한 배경음, 장단 없음
    ri: {
      mode: 'pyeong', tonic: 72, gain: 1.2, unit: 60 / 84, bar: 8, jangdan: null, drone: null,
      lead: { inst: 'gayageum', vel: 0.6, mel: '1^:4 5:4 | 3:6~ 5:2 | 1^:2 2^:2 3^:4 | 2^:8~ | 1^:4 3^:2 2^:2 | 1^:6~ 5:2 | 3:2 5:2 2:4 | 1:8~' },
      acc: { inst: 'pad', style: 'chord', oct: -12, vel: 0.8 },
    },
    // 2부 언학(배움의 길): 세마치로 걸음을 옮기듯
    eonhak: {
      mode: 'pyeong', tonic: 67, gain: 1.3, unit: 60 / 150, bar: 9, jangdan: 'semachi9', drum: 0.4, drone: 43,
      lead: { inst: 'gayageum', vel: 0.8, mel: '1:3 2:3 3:3 | 5:6~ 3:3 | 2:3 3:3 5:3 | 3:9~ | 5:3 1^:3 2^:3 | 1^:6~ 5:3 | 3:3 5:3 3:3 | 2:9~ | 3:3 5:3 1^:3 | 2^:6~ 3^:3 | 2^:3 1^:3 5:3 | 1^:9~ | 5:3 3:3 2:3 | 3:6~ 5:3 | 2:3 1:3 5v:3 | 1:9~' },
      second: { inst: 'daegeum', style: 'long', min: 6, oct: 0, vel: 0.38 },
      acc: { inst: 'gayageum', style: 'bass', beat: 3, oct: -12, vel: 0.36 },
    },
    // 8곡(우레와 해): 북과 징이 크게, 해금이 낮게 버틴다
    thunder: {
      mode: 'pyeong', tonic: 62, gain: 1.2, unit: 60 / 96, bar: 12, jangdan: 'jajin12', drum: 0.55, jing: [0, 2], drone: 38,
      lead: { inst: 'haegeum', vel: 0.8, mel: '1:6 2:3 3:3 | 5:12~ | 3:6 2:3 1:3 | 2:12~ | 3:6 5:3 1^:3 | 2^:12~ | 1^:6 5:3 3:3 | 1:12~' },
      acc: { inst: 'gayageum', style: 'bass', beat: 6, oct: -12, vel: 0.4 },
    },
    // 10곡 곁길: 계면조로 기울며 헤매는 느낌
    stray: {
      mode: 'gyemyeon', tonic: 69, gain: 1.3, unit: 60 / 140, bar: 12, jangdan: 'sneak12', drum: 0.6, drone: 45,
      lead: { inst: 'haegeum', vel: 0.8, mel: '1:6 2:3 3:3 | 4:6~ 3:3 2:3> | 1:3 2:3 1:3 5v:3 | 1:12~ | 3:3 4:3 5:6 | 4:6~ 3:3 2:3 | 3:3 2:3 1:3 2:3 | 1:12~' },
      acc: { inst: 'gayageum', style: 'ostinato', vel: 0.36, mel: '1v:3 5vv:3 1v:3 2v:3' },
    },
    // 결과(병풍·두루마리 완성): 밝은 굿거리
    finale: {
      mode: 'pyeong', tonic: 72, gain: 1.13, unit: 60 / 180, bar: 12, jangdan: 'gutgeori12', drum: 0.6, jing: [0], drone: 48,
      lead: { inst: 'gayageum', vel: 0.9, mel: '1:3 2:3 3:3 5:3 | 3:6~ 2:3 1:3 | 2:3 3:3 5:3 1^:3 | 5:12~ | 1^:3 2^:3 3^:3 2^:3 | 1^:6~ 5:3 3:3 | 5:3 3:3 2:3 3:3 | 2:12~ | 3:3 5:3 1^:3 2^:3 | 3^:6~ 2^:3 1^:3 | 5:3 1^:3 5:3 3:3 | 5:12~ | 3:3 2:3 3:3 5:3 | 2:6 1:3 2:3 | 3:3 2:3 5v:3 5v:3 | 1:12~' },
      second: { inst: 'daegeum', style: 'long', min: 6, oct: 0, vel: 0.42 },
      acc: { inst: 'gayageum', style: 'bass', beat: 6, oct: -12, vel: 0.42 },
    },
  };

  // ───────── 녹음 배경음(국립국악원 「국악기 디지털 음원」, 공공누리 제1유형)
  // 악구 녹음을 이어 붙여 반복되게 편집한 파일(tools/bgm_build.py). 불러오지 못하면 위의 합성 곡으로 대신한다.
  //  len: 반복 길이(초, tools/bgm_build.py가 적은 assets/bgm/bgm.json). MP3 끝의 빈 틈은 반복에서 뺀다
  //  pair: 같은 길이·같은 장단의 짝 곡. 서로 넘어갈 때 같은 자리에서 이어 간다(1부 거문고 ↔ 마음의 눈 양금)
  const REC = {
    dosan: { file: 'assets/bgm/dosan.mp3', len: 78.86, gain: 0.55, src: '대금 「청성곡」' },
    eonji: { file: 'assets/bgm/eonji.mp3', len: 99.311, gain: 1.6, pair: 'ri', src: '거문고 「윗도드리」' },
    ri: { file: 'assets/bgm/ri.mp3', len: 99.31, gain: 1.15, pair: 'eonji', src: '양금 「윗도드리」' },
    eonhak: { file: 'assets/bgm/eonhak.mp3', len: 68.385, gain: 0.88, src: '대금 「염불도드리」' },
    thunder: { file: 'assets/bgm/thunder.mp3', len: 119.576, gain: 1.07, src: '피리 「수제천」' },
    stray: { file: 'assets/bgm/stray.mp3', len: 17.44, gain: 1.08, src: '피리 경기대풍류 「당악」' },
    finale: { file: 'assets/bgm/finale.mp3', len: 65.435, gain: 0.93, src: '대금 「군악」' },
  };
  const bytes = {};   // 내려받은 파일(압축된 채로 모두 둔다, 모두 합쳐 약 4MB)
  const decoded = []; // 풀어 둔 소리(메모리를 아끼려고 최근 셋만): { name, buf, start, len }
  const failed = {};
  const pos = {};     // 곡마다 멈춘 자리(다시 들어오면 이어서)
  function fetchRec(name) {
    if (!bytes[name]) bytes[name] = fetch(REC[name].file).then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); });
    return bytes[name];
  }
  async function loadRec(name) {
    const hit = decoded.find((d) => d.name === name);
    if (hit) { decoded.splice(decoded.indexOf(hit), 1); decoded.push(hit); return hit; }
    const ab = await fetchRec(name);
    const buf = await new Promise((res, rej) => ctx.decodeAudioData(ab.slice(0), res, rej));
    // 크롬·파이어폭스는 MP3 앞뒤의 빈 틈(인코더 지연)을 떼고 풀어 준다. 떼지 않은 브라우저에서만 앞 틈을 건너뛴다
    const len = REC[name].len || buf.duration;
    const extra = Math.max(0, buf.duration - len);
    let start = 0;
    if (extra > 0.005) {
      const d = buf.getChannelData(0), lim = Math.floor(Math.min(extra, 0.08) * buf.sampleRate);
      let i = 0; while (i < lim && Math.abs(d[i]) < 1e-4) i++;
      start = i / buf.sampleRate;
    }
    const item = { name, buf, start, len: Math.min(len, buf.duration - start) };
    decoded.push(item);
    while (decoded.length > 3) decoded.shift();
    return item;
  }
  A.prefetch = function (...names) { for (const n of names) if (REC[n] && !failed[n]) fetchRec(n).catch(() => { failed[n] = true; }); };

  function buildTrack(def) {
    const u = def.unit, ev = [];
    const L = parse(def.lead.mel, def.mode, def.tonic);
    const total = L.len;
    let prevEnd = -1, prevMidi = null;
    for (const n of L.notes) {
      const legato = def.lead.inst !== 'gayageum' && Math.abs(n.pos - prevEnd) < 0.01;
      ev.push({ t: n.pos * u, inst: def.lead.inst, midi: n.midi, dur: n.dur * u * (def.lead.inst === 'gayageum' ? 1 : 0.97), vel: def.lead.vel, orn: n.orn, prev: legato ? prevMidi : null });
      prevEnd = n.pos + n.dur; prevMidi = n.midi;
    }
    // 둘째 소리(헤테로포니: 같은 선율을 길게 따라 부른다)
    const S2 = def.second;
    if (S2) for (const n of L.notes) if (n.dur >= S2.min) ev.push({ t: n.pos * u, inst: S2.inst, midi: n.midi + S2.oct, dur: n.dur * u * 0.95, vel: S2.vel, orn: n.orn.replace('<', '') });
    // 반주
    const C = def.acc;
    if (C) {
      if (C.style === 'beats' || C.style === 'bass') {
        for (const n of L.notes) {
          if (n.pos % C.beat !== 0) continue;
          const m = C.style === 'bass' ? snap(n.midi + C.oct - (n.midi - def.tonic >= 12 ? 12 : 0), def.mode, def.tonic) : n.midi + C.oct;
          ev.push({ t: n.pos * u, inst: C.inst, midi: m, dur: Math.min(n.dur, C.beat * 2) * u, vel: C.vel, orn: n.dur >= C.beat * 2 ? '~' : '' });
        }
      } else if (C.style === 'arp') {
        for (let b = 0; b * def.bar < total; b++) {
          const first = L.notes.find((n) => n.pos >= b * def.bar) || L.notes[0];
          const root = first.midi + C.oct - 12 * Math.max(0, Math.floor((first.midi - def.tonic) / 12));
          const tones = [root, snap(root + 7, def.mode, def.tonic), root + 12, snap(root + 7, def.mode, def.tonic)];
          for (let k = 0; k * C.beat < def.bar; k++) ev.push({ t: (b * def.bar + k * C.beat) * u, inst: C.inst, midi: tones[k % 4], dur: C.beat * u * 1.5, vel: C.vel * (k === 0 ? 1.15 : 0.85), orn: '' });
        }
      } else if (C.style === 'ostinato') {
        const O = parse(C.mel, def.mode, def.tonic);
        for (let b = 0; b * def.bar < total; b++) for (const n of O.notes) ev.push({ t: (b * def.bar + n.pos) * u, inst: C.inst, midi: n.midi, dur: n.dur * u, vel: C.vel, orn: '' });
      } else if (C.style === 'chord') {
        for (let b = 0; b * def.bar < total; b++) {
          const first = L.notes.find((n) => n.pos >= b * def.bar) || L.notes[0];
          const root = def.tonic + C.oct + ((first.midi - def.tonic) % 12 + 12) % 12;
          for (const m of [root - 12, snap(root - 5, def.mode, def.tonic), root]) ev.push({ t: b * def.bar * u, inst: 'pad', midi: m, dur: def.bar * u, vel: C.vel, orn: '' });
        }
      }
    }
    // 장단·징·지속음
    const bars = Math.round(total / def.bar), dv = def.drum == null ? 1 : def.drum;
    for (let b = 0; b < bars; b++) {
      if (def.jangdan) for (const [p, k, v] of JANGDAN[def.jangdan]) ev.push({ t: (b * def.bar + p) * u, drum: k, vel: v * dv });
      if (def.jing && def.jing.includes(b)) ev.push({ t: b * def.bar * u + 0.01, drum: 'jing', vel: 0.8 });
      if (def.drone && b % 2 === 0) ev.push({ t: b * def.bar * u, inst: 'drone', midi: def.drone, dur: def.bar * 2 * u, vel: 1 });
    }
    ev.sort((a, b) => a.t - b.t);
    return { notes: ev, length: total * u };
  }

  function playEvent(n, t, out) {
    if (n.drum) return hit(t, n.drum, n.vel, out);
    if (n.inst === 'gayageum') gayageum(t, n.midi, n.dur, n.vel, n.orn, out);
    else if (n.inst === 'daegeum') daegeum(t, n.midi, n.dur, n.vel, n.orn, out, n.prev);
    else if (n.inst === 'haegeum') haegeum(t, n.midi, n.dur, n.vel, n.orn, out, n.prev);
    else if (n.inst === 'drone') drone(t, n.midi, n.dur, n.vel, out);
    else if (n.inst === 'pad') pad(t, n.midi, n.dur, n.vel, out);
  }

  // ───────── 재생(앞질러 예약하기: 0.3초 앞의 음까지 미리 예약)
  const built = {};
  const trackOf = (name) => built[name] || (built[name] = buildTrack(TRACKS[name]));
  let sched = null, cur = null;
  function startTrack(name) {
    const from = cur && cur.rec ? { name: cur.name, at: recAt(cur) } : null;
    stopTrack(true);
    if (!TRACKS[name]) return;
    if (REC[name] && !failed[name]) return startRec(name, from);
    startSynth(name);
  }
  // 지금 녹음이 흐르는 자리(초)
  function recAt(c) { return ((ctx.currentTime - c.t0) + c.offset) % c.len; }
  function startRec(name, from) {
    const bus = ctx.createGain(); bus.gain.value = 0.0001; bus.connect(musicBus);
    const me = (cur = { name, bus, rec: true, t0: 0, offset: 0, len: 1, src: null });
    loadRec(name).then((r) => {
      if (cur !== me) return;
      // 짝 곡에서 넘어오면 같은 자리에서, 아니면 멈췄던 자리에서
      const offset = from && REC[name].pair === from.name ? from.at % r.len : (pos[name] || 0) % r.len;
      const src = ctx.createBufferSource();
      src.buffer = r.buf; src.loop = true; src.loopStart = r.start; src.loopEnd = r.start + r.len;
      src.connect(bus);
      const t = ctx.currentTime + 0.05;
      src.start(t, r.start + offset);
      Object.assign(me, { src, t0: t, offset, len: r.len });
      bus.gain.setValueAtTime(0.0001, t);
      bus.gain.exponentialRampToValueAtTime(REC[name].gain || 1, t + (from ? 1.2 : 1.8));
    }).catch(() => {
      failed[name] = true;
      if (cur === me) { cur = null; bus.disconnect(); startSynth(name); }
    });
  }
  function startSynth(name) {
    const tr = trackOf(name);
    const bus = ctx.createGain(); bus.gain.value = 0.0001; bus.connect(musicBus);
    bus.gain.exponentialRampToValueAtTime(TRACKS[name].gain || 1, ctx.currentTime + 1.2);
    cur = { name, bus, notes: tr.notes, length: tr.length, idx: 0, loopStart: ctx.currentTime + 0.15 };
    const me = cur;
    const tick = () => {
      if (cur !== me) return;
      const ahead = ctx.currentTime + 0.3;
      for (let guard = 0; guard < 400; guard++) {
        const n = me.notes[me.idx];
        const t = me.loopStart + n.t;
        if (t > ahead) break;
        if (t >= ctx.currentTime - 0.05) { try { playEvent(n, t, me.bus); } catch (e) { /* 무시 */ } }
        me.idx++;
        if (me.idx >= me.notes.length) { me.idx = 0; me.loopStart += me.length + 0.6; } // 한 바퀴 뒤 잠깐 숨
      }
    };
    tick();
    sched = setInterval(tick, 80);
  }
  function stopTrack(fast) {
    if (sched) { clearInterval(sched); sched = null; }
    if (cur && ctx) {
      const b = cur.bus, now = ctx.currentTime, end = now + (fast ? 0.8 : 1.5);
      if (cur.rec && cur.src) { pos[cur.name] = recAt(cur); try { cur.src.stop(end + 0.1); } catch (e) { /* 무시 */ } }
      b.gain.cancelScheduledValues(now);
      b.gain.setValueAtTime(Math.max(0.0001, b.gain.value), now);
      b.gain.exponentialRampToValueAtTime(0.0001, end);
      setTimeout(() => b.disconnect(), 3000);
    }
    cur = null;
  }
  // 지금 들려야 할 곡을 맞춘다(배경음을 끄면 예약도 멈춘다)
  function sync() {
    if (!ctx) return;
    const want = S().music && A.track && TRACKS[A.track] ? A.track : null;
    if (!want) { if (cur) stopTrack(false); return; }
    if (!cur || cur.name !== want) startTrack(want);
  }

  A.unlock = function () {
    A.unlocked = true;
    if (!init()) return;
    if (ctx.state === 'suspended' && !document.hidden) ctx.resume();
    sync();
  };
  // 장면의 곡 정하기(같은 곡이면 그대로 이어서)
  A.play = function (name) {
    A.track = name || null;
    sync();
  };
  // 배경음 켜기/끄기(설정)
  A.music = function (want) {
    if (!A.unlocked || !init()) return;
    const now = ctx.currentTime;
    musicBus.gain.cancelScheduledValues(now);
    musicBus.gain.setValueAtTime(musicBus.gain.value, now);
    musicBus.gain.linearRampToValueAtTime(want ? MUSIC_VOL : 0, now + 0.8);
    if (want && ctx.state === 'suspended') ctx.resume();
    sync();
  };

  // ───────── 효과음(가야금·장구·종이 소리)
  const sfxOn = () => A.unlocked && S().sound && init() && ctx.state !== 'closed'; // 첫 터치 전에는 소리를 만들지 않는다
  function tone(type, f0, f1, dur, vol, t0 = 0) {
    const t = ctx.currentTime + t0;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + dur + 0.05);
  }
  function hiss(dur, vol, f0, f1, type = 'bandpass', t0 = 0, q = 1) {
    const t = ctx.currentTime + t0;
    const n = noise(), f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(f); f.connect(g); g.connect(sfxBus); n.start(t, Math.random() * 1.5); n.stop(t + dur + 0.05);
  }
  const pl = (m, dt = 0, v = 0.8, dur = 0.5, orn = '') => gayageum(ctx.currentTime + dt, m, dur, v, orn, sfxBus, 0.25);
  const SFX = {
    tap: () => hiss(0.03, 0.1, 2600, 1800, 'bandpass', 0, 3),                                           // 누르기: 얇은 나무 소리
    pick: () => pl(81, 0, 0.4, 0.25),                                                                   // 시어 카드 고르기·놓기
    brush: () => { hiss(0.22, 0.07, 1400, 3800, 'bandpass', 0, 0.8); },                                 // 붓질
    page: () => { hiss(0.24, 0.1, 700, 2800, 'bandpass', 0, 0.7); hiss(0.12, 0.05, 3000, 6500, 'highpass', 0.06); }, // 종이 넘기기
    stamp: () => { hit(ctx.currentTime, 'kung', 0.8, sfxBus); hiss(0.09, 0.16, 800, 200, 'lowpass'); }, // 낙관
    ok: () => { [74, 79, 81, 86].forEach((m, i) => pl(m, i * 0.07, 0.8, 0.7)); hit(ctx.currentTime + 0.02, 'deok', 0.45, sfxBus); }, // 맞음
    no: () => { pl(64, 0, 0.6, 0.45, '>'); pl(62, 0.16, 0.55, 0.6, '>'); },                          // 틀림: 가야금을 꺾어 내린다
    hint: () => daegeum(ctx.currentTime, 81, 0.7, 0.6, '~', sfxBus, null, 0.4),                       // 여백의 메모
    found: () => { pl(79, 0, 0.6, 0.4); pl(86, 0.08, 0.6, 0.7, '~'); hiss(0.5, 0.05, 900, 2400, 'bandpass', 0.02, 0.6); }, // 풍경 속 시어를 찾음
    cut: () => hit(ctx.currentTime, 'deok', 0.55, sfxBus),                                              // 음보 빗금
    lens: () => { pad(ctx.currentTime, 72, 1.6, 0.9, sfxBus); pl(84, 0.1, 0.4, 0.9, '~'); },            // 마음의 눈
    wash: () => { hiss(1.6, 0.08, 300, 1400, 'bandpass', 0, 0.5); [67, 72, 76, 79, 84].forEach((m, i) => pl(m, 0.2 + i * 0.13, 0.6, 1.2, i === 4 ? '~' : '')); }, // 풍경이 씻김
    chapter: () => { hit(ctx.currentTime, 'jing', 0.55, sfxBus); hit(ctx.currentTime, 'buk', 0.6, sfxBus); }, // 곡 펼치기
    thunder: () => { hit(ctx.currentTime, 'buk', 1, sfxBus); hit(ctx.currentTime + 0.12, 'buk', 0.8, sfxBus); hiss(1.8, 0.2, 180, 60, 'lowpass'); }, // 우레
    fanfare: () => { [67, 69, 72, 74, 76, 79, 81].forEach((m, i) => pl(m, i * 0.08, 0.75, 0.9)); hit(ctx.currentTime + 0.6, 'jing', 0.8, sfxBus); hit(ctx.currentTime + 0.6, 'buk', 0.7, sfxBus); }, // 곡 완성
  };
  for (const k of Object.keys(SFX)) A[k] = () => { if (!sfxOn()) return; try { SFX[k](); } catch (e) { /* 무시 */ } };


  // ───────── 시조 가락: 열두 곡이 모두 같은 가락(틀)을 쓴다
  // 같은 가락을 되풀이해야 노랫말을 외우는 데 도움이 된다(곡마다 다른 가락은 오히려 방해: Wallace 1994).
  // 틀: 장·음보 자리마다 [시작음, 끝음]을 정해 두고, 음보의 글자 수만큼 그 사이를 고르게 잇는다.
  // 한 글자 = 한 박, 음보 끝 글자는 2박, 장 끝 글자는 4박으로 길게 떨어 준다(농현).
  // 종장 첫 음보(세 글자)는 높게 질러 내고(징), 종장 끝은 으뜸음으로 내려와 마친다.
  const SONG_UNIT = 0.34, SONG_TONIC = 67;
  // 음 번호: 평조 음계 위의 자리(0 = 으뜸음, 1 = 둘째 음 …, 5 = 한 옥타브 위 으뜸음)
  const TUNE = [
    [[2, 3], [3, 1], [2, 4], [3, 2]],   // 초장: 잔잔히 열고 제자리로
    [[3, 4], [5, 3], [4, 6], [5, 3]],   // 중장: 한 단 올라 넓게
    [[6, 7], [7, 4], [4, 2], [2, 0]],   // 종장: 첫 음보를 높이 → 으뜸음으로 내려와 마침
  ];
  A.songPlan = function (feet) {
    const scale = [];
    for (let o = -1; o <= 2; o++) for (const d of MODES.pyeong) scale.push(SONG_TONIC + d + 12 * o);
    const T = 5; // scale[5] = 으뜸음
    return feet.map((line, li) => line.map((n, fi) => {
      const shape = TUNE[li][Math.min(fi, 3)];
      const [from, to] = fi === line.length - 1 && li === 2 ? [shape[0], 0] : shape;
      const notes = [];
      let t = 0;
      for (let k = 0; k < n; k++) {
        const last = k === n - 1;
        let deg = n === 1 ? to : Math.round(from + (to - from) * (k / (n - 1)));
        if (!last && n >= 4 && k === n - 2) deg = to + 1; // 끝음 바로 앞에서 한 음 위로 걸쳤다 내려온다
        const endLine = last && fi === line.length - 1;
        const dur = endLine ? 4 : last ? 2 : 1;
        notes.push({ t: t * SONG_UNIT, midi: scale[T + deg], dur: dur * SONG_UNIT, orn: endLine || (li === 2 && fi === 0 && last) ? '~' : k === 0 && fi > 0 ? '<' : '' });
        t += dur;
      }
      return { notes, len: t * SONG_UNIT };
    }));
  };
  // 음보 하나 부르기(장구 한 번 + 가야금 가락). 걸리는 시간(초)을 돌려준다
  A.foot = function (plan, li, fi, opt = {}) {
    if (!A.unlocked || !S().sound || !init()) return plan[li][fi].len;
    if (ctx.state === 'suspended') ctx.resume();
    const f = plan[li][fi], t0 = ctx.currentTime + 0.03;
    try {
      hit(t0, fi === 0 ? 'deong' : fi === 2 ? 'kung' : 'deok', fi === 0 ? 0.7 : 0.45, sfxBus);
      for (const n of f.notes) gayageum(t0 + n.t, n.midi, n.dur, opt.vel || 0.85, n.orn, sfxBus, 0.3);
      if (li === 2 && fi === 0) hit(t0, 'jing', 0.35, sfxBus);
    } catch (e) { /* 무시 */ }
    return f.len;
  };
  // 한 곡 전체 부르기. onFoot(li, fi)가 음보마다 불린다. stop()으로 멈춘다
  let singing = null;
  A.sing = function (plan, onFoot) {
    A.hush();
    const timers = [];
    let stopped = false;
    const me = { stop() { stopped = true; timers.forEach(clearTimeout); duck(false); if (singing === me) singing = null; } };
    singing = me;
    duck(true);
    let t = 0.2;
    plan.forEach((L, li) => L.forEach((f, fi) => {
      timers.push(setTimeout(() => { if (stopped) return; A.foot(plan, li, fi); onFoot && onFoot(li, fi); }, t * 1000));
      t += f.len + (fi === L.length - 1 ? 0.5 : 0.08);
    }));
    me.done = new Promise((res) => timers.push(setTimeout(() => { if (!stopped) { onFoot && onFoot(-1, -1); me.stop(); } res(); }, (t + 0.8) * 1000)));
    return me;
  };
  A.hush = function () { if (singing) singing.stop(); };
  // 노래하는 동안 배경음을 줄인다
  function duck(on) {
    if (!ctx) return;
    const now = ctx.currentTime, v = on ? MUSIC_VOL * 0.15 : (S().music ? MUSIC_VOL : 0);
    musicBus.gain.cancelScheduledValues(now);
    musicBus.gain.setValueAtTime(musicBus.gain.value, now);
    musicBus.gain.linearRampToValueAtTime(v, now + 0.4);
  }

  // ───────── 미리 듣기·점검용: 곡을 오프라인으로 렌더해 AudioBuffer로 돌려준다
  A.render = async function (name, seconds = 20, rate = 44100, opt = {}) {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const off = new OAC(2, Math.ceil(seconds * rate), rate);
    if (REC[name] && opt.synth !== true) {
      // 녹음 곡: 게임과 같은 길(곡 음량 → 배경음 버스 → 압축기)로 흘린다
      const ab = await fetchRec(name);
      const buf = await off.decodeAudioData(ab.slice(0));
      const g = buildGraph(off);
      const tb = off.createGain(); tb.gain.value = REC[name].gain || 1; tb.connect(g.musicBus);
      const src = off.createBufferSource(); src.buffer = buf; src.loop = true; src.connect(tb); src.start(0, Math.min(10, buf.duration / 3));
      return off.startRendering();
    }
    const saved = [ctx, comp, musicBus, sfxBus, revIn, ksCache, noiseBuf];
    try {
      ctx = off; ksCache = {}; noiseBuf = null;
      ({ comp, musicBus, sfxBus, revIn } = buildGraph(off));
      const tr = buildTrack(TRACKS[name]);
      const tb = off.createGain(); tb.gain.value = TRACKS[name].gain || 1; tb.connect(musicBus);
      for (let loop = 0; loop * tr.length < seconds; loop++) {
        for (const n of tr.notes) { const t = loop * (tr.length + 0.6) + n.t + 0.05; if (t < seconds) playEvent(n, t, tb); }
      }
    } finally {
      [ctx, comp, musicBus, sfxBus, revIn, ksCache, noiseBuf] = saved;
    }
    return off.startRendering();
  };
  A.now = () => (cur ? cur.name : null); // 지금 실제로 흐르는 곡(점검용)
  A.nowRec = () => !!(cur && cur.rec && cur.src); // 녹음이 흐르고 있는지(점검용)
  A.where = () => (cur && cur.rec && cur.src ? { name: cur.name, at: recAt(cur) } : null); // 녹음의 지금 자리(점검용)
  A.REC = REC;
  A.TRACKS = TRACKS;
  A._parse = parse;
})();
