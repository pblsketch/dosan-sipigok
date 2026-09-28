'use strict';
// 화면 부품: 알림, 풍선 도움말, 아래 판(시트), 낙관 효과, 알림 카드
(function () {
  const { h, $, $$ } = G.util;
  const ui = (G.ui = {});

  ui.toast = function (text, ms = 1800) {
    const el = h('div.toast', text);
    document.body.appendChild(el);
    setTimeout(() => el.remove(), ms);
  };

  // 풍선 도움말: 요소 가까이에 뜬다. 아무 곳이나 누르면 닫힌다
  let popEl = null;
  ui.pop = function (anchor, html) {
    ui.unpop();
    popEl = h('div.pop', { html });
    document.body.appendChild(popEl);
    const r = anchor.getBoundingClientRect(), pr = popEl.getBoundingClientRect();
    let x = r.left + r.width / 2 - pr.width / 2, y = r.top - pr.height - 8;
    if (y < 60) y = r.bottom + 8;
    x = G.util.clamp(x, 8, window.innerWidth - pr.width - 8);
    popEl.style.left = x + 'px'; popEl.style.top = y + 'px';
    setTimeout(() => document.addEventListener('pointerdown', ui.unpop, { once: true }), 0);
  };
  ui.unpop = function () { if (popEl) { popEl.remove(); popEl = null; } };

  // 아래에서 올라오는 판. 버튼을 누르면 닫히고 그 값을 돌려준다
  ui.sheet = function (content, buttons = [{ label: '닫기', value: true, cls: 'primary' }], opt = {}) {
    return new Promise((resolve) => {
      const back = h('div.sheet-back');
      const box = h('div.sheet', content);
      const acts = h('div.actions');
      for (const b of buttons) {
        acts.appendChild(h('button.btn' + (b.cls ? '.' + b.cls : ''), { on: { click: () => { G.audio.tap(); close(b.value); } } }, b.label));
      }
      box.appendChild(acts);
      back.appendChild(box);
      if (opt.dismiss !== false) back.addEventListener('click', (e) => { if (e.target === back) close(null); });
      // Esc로 닫기(고르지 않고 닫으면 안 되는 판은 제외)
      const onKey = (e) => { if (e.key === 'Escape' && opt.dismiss !== false && back.isConnected) { e.preventDefault(); close(null); } };
      document.addEventListener('keydown', onKey);
      document.body.appendChild(back);
      const first = acts.querySelector('.btn.primary, .btn.seal') || acts.querySelector('.btn');
      if (first) setTimeout(() => first.focus(), 50);
      function close(v) { document.removeEventListener('keydown', onKey); back.remove(); resolve(v); }
    });
  };

  ui.stamp = async function (text = '陶山') {
    G.audio.stamp();
    const el = h('div.stampfx', text);
    document.body.appendChild(el);
    ui.inkBurst(window.innerWidth / 2, window.innerHeight * 0.42);
    await G.util.wait(900);
    el.classList.add('out');
    setTimeout(() => el.remove(), 600);
  };
  ui.inkBurst = function (x, y, n = 12) {
    for (let i = 0; i < n; i++) {
      const d = h('div.ink');
      const a = Math.random() * Math.PI * 2, r = 30 + Math.random() * 60, s = 4 + Math.random() * 9;
      Object.assign(d.style, { left: x + 'px', top: y + 'px', width: s + 'px', height: s + 'px', opacity: .8, transition: 'transform .6s ease-out, opacity .7s' });
      document.body.appendChild(d);
      requestAnimationFrame(() => { d.style.transform = `translate(${Math.cos(a) * r}px, ${Math.sin(a) * r}px)`; d.style.opacity = 0; });
      setTimeout(() => d.remove(), 800);
    }
  };
  ui.shake = function (el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); };

  // 알림 카드(게임 설정·이본 노트·해설·해석)
  const KIND = { fiction: '게임 설정 · 虛', variant: '이본 노트', note: '알아 두기', interp: '해석', orig: '原文', balmun: '발문 · 實' };
  ui.card = function (c) {
    const el = h('div.card.' + (c.kind || 'note'),
      h('span.kind', KIND[c.kind] || ''),
      h('h3', G.util.yet(c.title)),
      ...String(c.body || '').split('\n').map((line) => h('p', G.util.boldNodes(G.util.yet(line)))));
    if (c.real) el.appendChild(h('div.real', h('p', h('strong', '실제로는 → '), G.util.boldNodes(G.util.yet(c.real)))));
    if (c.src) el.appendChild(h('p.src', '출처: ' + c.src));
    return el;
  };

})();
