'use strict';
// 풍경 그림: 먹빛으로 바랜 그림 위에서 찾은 곳부터 먹물이 번지듯 색이 돌아온다.
//  - 그림 두 장(색 그림, 바랜 그림)을 겹쳐 캔버스에 그린다. 바랜 그림에 '번짐 가면'으로 구멍을 내면 아래 색이 보인다.
//  - 픽셀을 읽지 않으므로(drawImage만 씀) 파일로 열어도 동작한다.
//  - 찾을 곳(spot)은 그림 좌표(0~1)로 적고, 그 위에 투명 단추를 얹어 누르기·키보드를 함께 받는다.
(function () {
  const { h } = G.util;
  const DPR = () => Math.min(2, window.devicePixelRatio || 1);
  const load = (src) => new Promise((res) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = src;
  });
  const ease = (t) => 1 - Math.pow(1 - t, 3);

  // opt: { src, faded, focus:[fx,fy], spots:[{id,x,y,r,label}], onSpot(spot, btn), onMiss(x,y) }
  G.scene = function (opt) {
    const root = h('div.scene');
    const cv = h('canvas.scene-cv', { 'aria-hidden': 'true' });
    const layer = h('div.scene-spots');
    root.append(cv, layer);
    const ctx = cv.getContext('2d');
    const mask = document.createElement('canvas'), mctx = mask.getContext('2d');
    const tmp = document.createElement('canvas'), tctx = tmp.getContext('2d');
    let color = null, faded = null, W = 0, H = 0, fit = null, raf = 0, dead = false;
    let focus = (opt.focus || [0.5, 0.5]).slice();
    const bar = h('div.scene-bar', { 'aria-hidden': 'true' });
    root.appendChild(bar);
    const blooms = [];   // { x, y, r (그림 좌표), t0, dur, jit:[[dx,dy,rr]] }
    const api = { root, spots: [], ready: null, washed: false };

    // 그림 좌표(0~1) ↔ 상자 좌표(px). 'cover'로 채우되 focus 쪽을 남긴다
    function computeFit() {
      if (!color) return;
      const iw = color.naturalWidth, ih = color.naturalHeight;
      const s = Math.max(W / iw, H / ih);
      const dw = iw * s, dh = ih * s;
        const [fx, fy] = focus;
      const ox = G.util.clamp(W / 2 - fx * dw, W - dw, 0), oy = G.util.clamp(H / 2 - fy * dh, H - dh, 0);
      fit = { s, dw, dh, ox, oy };
      focus = [(W / 2 - ox) / dw, (H / 2 - oy) / dh]; // 끝에 닿았으면 그 자리로(되돌아 끌 때 헛도는 구간이 없게)
      root.classList.toggle('pannable', dh > H + 6 || dw > W + 6);
      bar.style.display = dh > H + 6 ? '' : 'none';
      if (dh > H + 6) { const t = -oy / (dh - H); Object.assign(bar.style, { height: (H / dh) * 100 + '%', top: t * (1 - H / dh) * 100 + '%' }); }
    }
    const toBox = (x, y) => [fit.ox + x * fit.dw, fit.oy + y * fit.dh];
    const toImg = (px, py) => [(px - fit.ox) / fit.dw, (py - fit.oy) / fit.dh];

    function resize() {
      const r = root.getBoundingClientRect();
      if (!r.width || !r.height) return;
      W = r.width; H = r.height;
      const d = DPR();
      for (const c of [cv, mask, tmp]) { c.width = Math.round(W * d); c.height = Math.round(H * d); }
      for (const c of [ctx, mctx, tctx]) c.setTransform(d, 0, 0, d, 0, 0);
      computeFit();
      placeSpots();
      draw(performance.now());
    }

    function placeSpots() {
      if (!fit) return;
      for (const s of api.spots) {
        s.btn.hidden = !!(api.spotFilter && !api.spotFilter(s));
        const [x, y] = toBox(s.x, s.y), rr = Math.max(26, s.r * fit.dw);
        Object.assign(s.btn.style, { left: x - rr + 'px', top: y - rr + 'px', width: rr * 2 + 'px', height: rr * 2 + 'px' });
      }
    }

    function drawBloom(b, now) {
      // rAF 시각이 번짐을 시작한 시각보다 조금 이를 수 있다: 그때는 아직 기다리는 중
      const p = b.dur ? G.util.clamp((now - b.t0) / b.dur, 0, 1) : 1;
      if (p <= 0) return true;
      const e = ease(p);
      const [cx, cy] = toBox(b.x, b.y);
      const R = b.r * fit.dw * e;
      for (const [dx, dy, rr] of b.jit) {
        const x = cx + dx * R, y = cy + dy * R, r = Math.max(1, rr * R);
        const g = mctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(0,0,0,1)');
        g.addColorStop(0.62, 'rgba(0,0,0,0.92)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        mctx.fillStyle = g;
        mctx.beginPath(); mctx.arc(x, y, r, 0, Math.PI * 2); mctx.fill();
      }
      return p < 1;
    }

    function draw(now) {
      if (!fit || dead) return false;
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(color, fit.ox, fit.oy, fit.dw, fit.dh);
      if (api.washed && !blooms.some((b) => b.dur && now - b.t0 < b.dur)) return false; // 다 씻겼으면 색 그림만
      mctx.clearRect(0, 0, W, H);
      let busy = false;
      for (const b of blooms) busy = drawBloom(b, now) || busy;
      tctx.globalCompositeOperation = 'source-over';
      tctx.clearRect(0, 0, W, H);
      tctx.drawImage(faded || color, fit.ox, fit.oy, fit.dw, fit.dh);
      if (!faded) { tctx.globalCompositeOperation = 'saturation'; tctx.fillStyle = '#888'; tctx.fillRect(0, 0, W, H); }
      tctx.globalCompositeOperation = 'destination-out';
      tctx.drawImage(mask, 0, 0, W, H);
      tctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(tmp, 0, 0, W, H);
      return busy;
    }
    function loop() {
      cancelAnimationFrame(raf);
      const step = (now) => { if (draw(now)) raf = requestAnimationFrame(step); };
      raf = requestAnimationFrame(step);
    }

    // 먹물 번짐 하나: 가운데 큰 방울 + 둘레의 작은 방울들(모양이 매번 조금씩 다르다)
    function makeJit(n) {
      const j = [[0, 0, 0.78]];
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, d = 0.25 + Math.random() * 0.45;
        j.push([Math.cos(a) * d, Math.sin(a) * d, 0.28 + Math.random() * 0.36]);
      }
      return j;
    }
    api.bloom = function (x, y, r, dur = 1100) {
      blooms.push({ x, y, r, t0: performance.now(), dur, jit: makeJit(9) });
      loop();
    };
    api.reveal = function (id, dur) {
      const s = api.spots.find((p) => p.id === id);
      if (!s) return;
      api.bloom(s.x, s.y, (s.rr || s.r * 1.9), dur);
    };
    // 곡을 마치면 풍경 전체가 씻긴다
    api.wash = function (dur = 2600) {
      if (!fit) { api.washed = true; return; }
      const [cx, cy] = [0.5, 0.5];
      blooms.push({ x: cx, y: cy, r: 1.25 * Math.max(1, fit.dh / fit.dw), t0: performance.now(), dur, jit: makeJit(16) });
      api.washed = true;
      loop();
    };
    api.revealNow = function (ids) { for (const id of ids) { const s = api.spots.find((p) => p.id === id); if (s) blooms.push({ x: s.x, y: s.y, r: s.rr || s.r * 1.9, t0: 0, dur: 0, jit: makeJit(9) }); } loop(); };
    api.washNow = function () { api.washed = true; loop(); };
    api.pointOf = function (id) { // 화면 좌표(풍선 도움말·카드 날리기용)
      const s = api.spots.find((p) => p.id === id);
      const r = root.getBoundingClientRect();
      if (!s || !fit) return [r.left + r.width / 2, r.top + r.height / 2];
      const [x, y] = toBox(s.x, s.y);
      return [r.left + x, r.top + y];
    };
    api.pointOfImg = function (x, y) { return fit ? toBox(x, y) : [0, 0]; }; // 상자 안 좌표
    api.setSpots = function (spots) {
      layer.innerHTML = '';
      api.spots = (spots || []).map((s) => {
        const btn = h('button.spot', { type: 'button', 'aria-label': s.label || '풍경 속 한 곳' });
        btn.addEventListener('click', (e) => { e.stopPropagation(); opt.onSpot && opt.onSpot(sp, btn); });
        layer.appendChild(btn);
        const sp = Object.assign({}, s, { btn });
        return sp;
      });
      placeSpots();
      return api.spots;
    };
    // 봄/가을처럼 같은 구도의 다른 그림으로 바꾸기(번짐 가면은 그대로 둔다)
    api.setImages = async function (src, fadedSrc) {
      const [c, f] = await Promise.all([load(src), fadedSrc ? load(fadedSrc) : Promise.resolve(null)]);
      if (!c || dead) return;
      color = c; faded = f;
      computeFit(); placeSpots(); loop(); draw(performance.now());
    };
    api.filterSpots = function (fn) { api.spotFilter = fn; placeSpots(); };
    // 찾을 곳이 화면 밖이면 그쪽으로 훑어 준다
    api.panTo = function (x, y) {
      if (!fit) return;
      focus = [x, y];
      computeFit(); placeSpots(); draw(performance.now());
    };
    api.destroy = function () {
      dead = true; cancelAnimationFrame(raf); ro.disconnect(); root.remove();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
    };

    // 손가락·마우스로 위아래(좌우)를 끌면 병풍 폭을 훑는다. 조금이라도 끌었으면 누르기로 치지 않는다
    let drag = null, dragged = false;
    root.addEventListener('pointerdown', (e) => {
      if (!fit || !root.classList.contains('pannable') || e.button > 0) return;
      drag = { x: e.clientX, y: e.clientY, fx: focus[0], fy: focus[1], id: e.pointerId };
      dragged = false;
    });
    const onMove = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!dragged && Math.hypot(dx, dy) < 8) return;
      dragged = true;
      root.classList.add('panning');
      focus = [G.util.clamp(drag.fx - dx / fit.dw, 0, 1), G.util.clamp(drag.fy - dy / fit.dh, 0, 1)];
      computeFit(); placeSpots(); draw(performance.now());
    };
    const endDrag = () => { if (!drag) return; drag = null; root.classList.remove('panning'); setTimeout(() => { dragged = false; }, 30); };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
    root.addEventListener('click', (e) => { if (dragged) { e.stopPropagation(); e.preventDefault(); } }, true);

    // 빈 곳을 누르면 작은 먹 파문(아무 일도 일어나지 않는다는 표시)
    root.addEventListener('click', (e) => {
      if (!fit || e.target.closest('.spot')) return;
      const r = root.getBoundingClientRect();
      const px = e.clientX - r.left, py = e.clientY - r.top;
      const ring = h('div.ripple');
      Object.assign(ring.style, { left: px + 'px', top: py + 'px' });
      root.appendChild(ring);
      setTimeout(() => ring.remove(), 700);
      opt.onMiss && opt.onMiss(...toImg(px, py));
    });

    const ro = new ResizeObserver(() => resize());
    api.ready = Promise.all([load(opt.src), opt.faded ? load(opt.faded) : Promise.resolve(null)]).then(([c, f]) => {
      if (!c) { root.classList.add('noimg'); return; }
      color = c; faded = f;
      ro.observe(root);
      resize();
    });
    api.setSpots(opt.spots);
    return api;
  };
})();
