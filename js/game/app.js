'use strict';
// 화면 흐름: 타이틀 → (부 도입) → 병풍/길 → 곡(景·理·音) → 결과
(function () {
  const { h, $, $$, wait, yet } = G.util;
  const S = () => G.save.state;
  const app = (G.app = {});
  const root = () => document.getElementById('app');
  const partOf = (n) => (n <= 6 ? 1 : 2);
  const songsOf = (p) => SONGS.filter((s) => s.part === p);
  const stepKey = (n, st) => n + '-' + st;
  const done = (n, st) => !!S().steps[stepKey(n, st)];
  const mark = (n, st) => { S().steps[stepKey(n, st)] = true; G.save.write(); };
  let current = null; // 지금 곡의 단계 상태(도움 버튼용)
  app.cur = () => current; // 점검(테스트)용
  // 주소에 지금 화면을 적어 둔다(새로 고침하면 같은 화면·같은 단계로 돌아온다)
  const at = (q) => { try { history.replaceState(null, '', location.pathname + (q ? '?' + q : '')); } catch (e) { /* 파일로 열기 등 */ } };

  function clear() {
    G.audio.hush();
    G.ui.unpop();
    if (current && current.scene) current.scene.destroy();
    current = null;
    $$('.sheet-back').forEach((x) => x.remove());
    const r = root();
    r.innerHTML = '';
    r.className = '';
    window.scrollTo(0, 0);
    return r;
  }

  app.applySettings = function () {
    document.documentElement.style.setProperty('--fs', S().font);
    document.documentElement.classList.toggle('no-hanja', !S().hanja);
  };

  const ICON = {
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    fold: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3 5l4.5 2v12L3 17zM7.5 7l4.5-2v12l-4.5 2zM12 5l4.5 2v12L12 17zM16.5 7L21 5v12l-4.5 2z"/></svg>',
    note: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 19c3-1 4-4 5-7s3-6 9-7c-1 6-4 8-7 9s-6 2-7 5z"/><path d="M9 15l3-3"/></svg>',
    sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 10v4h4l5 4V6L8 10z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/></svg>',
    mute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 10v4h4l5 4V6L8 10z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
  };
  const iconBtn = (name, label, fn, cls = '') => h('button.icon-btn' + cls, { type: 'button', 'aria-label': label, title: label, html: ICON[name], on: { click: (e) => { e.stopPropagation(); G.audio.tap(); fn(e); } } });

  // ───────── 타이틀 ─────────
  app.title = function () {
    const r = clear();
    at('');
    G.audio.play('dosan');
    const p1 = songsOf(1).filter((s) => S().done[s.n]).length, p2 = songsOf(2).filter((s) => S().done[s.n]).length;
    const musicBtn = iconBtn(S().music ? 'sound' : 'mute', '배경음 켜기/끄기', () => {
      S().music = !S().music; G.save.write(); G.audio.music(S().music);
      musicBtn.innerHTML = ICON[S().music ? 'sound' : 'mute'];
      musicBtn.classList.toggle('off', !S().music);
    }, '.music-toggle' + (S().music ? '' : '.off'));
    r.appendChild(h('div.title-screen',
      h('div.art', { style: { backgroundImage: 'url(assets/ui/title_art.webp)' } }),
      musicBtn,
      h('div.logo',
        h('div.pre', '퇴계 이황 · 1565'),
        h('h1', '도산십이곡'),
        h('div.sub', '마음을 씻는 노래')),
      h('div.menu',
        h('button.btn.part', { type: 'button', on: { click: () => { G.audio.tap(); app.part(1); } } },
          h('span.pn', '1부'), h('span.pt', h('b', '언지(言志)'), h('small', '1~6곡 · 병풍에 풍경 되살리기')), h('span.pp', p1 + '/6')),
        h('button.btn.part', { type: 'button', on: { click: () => { G.audio.tap(); app.part(2); } } },
          h('span.pn', '2부'), h('span.pt', h('b', '언학(言學)'), h('small', '7~12곡 · 배움의 길 걷기')), h('span.pp', p2 + '/6')),
        h('div.row-btns',
          h('button.btn.small', { type: 'button', on: { click: () => { G.audio.tap(); app.modeSheet(); } } }, S().mode === 'review' ? '다시 읽기(복습) 중' : '처음 읽기 중'),
          h('button.btn.small', { type: 'button', on: { click: () => { G.audio.tap(); app.settings(); } } }, '설정'),
          h('button.btn.small', { type: 'button', on: { click: () => { G.audio.tap(); app.about(); } } }, '선생님께'))),
      h('p.credit', '원문: 퇴계 이황 「도산십이곡」(1565) · 게임 속 아이와 몇몇 장면은 지어낸 설정이에요'),
      h('p.credit', '배경음: 국립국악원 「국악기 디지털 음원」 악구(공공누리 제1유형)를 이어 붙여 편집 · 노래 가락과 효과음은 합성'),
      h('p.credit.maker', '만든 사람: 박준일(온양여자고등학교 국어 교사)')));
  };

  app.modeSheet = async function () {
    const v = await G.ui.sheet(h('div',
      h('h3', '어떻게 읽을까요?'),
      h('p', h('b', '처음 읽기'), ' — 작품을 처음 만날 때. 시어 풀이와 도움말이 곁에 있어요.'),
      h('p', h('b', '다시 읽기(복습)'), ' — 수업 뒤에. 풀이를 가리고, 세 장을 모두 직접 끊고, 떠올려서 풀어요.')),
    [{ label: '처음 읽기', value: 'first', cls: S().mode === 'first' ? 'primary' : '' }, { label: '다시 읽기', value: 'review', cls: S().mode === 'review' ? 'primary' : '' }]);
    if (v) { S().mode = v; G.save.write(); app.title(); }
  };

  // ───────── 부 시작 ─────────
  app.part = async function (p) {
    if (!S().startedAt[p]) { S().startedAt[p] = Date.now(); G.save.write(); }
    if (!S().intro[p]) return app.intro(p);
    app.map(p);
  };

  // 부 도입: 1부는 발문 이야기, 2부는 지난 시간 되짚기
  app.intro = async function (p) {
    const r = clear();
    at('part=' + p);
    G.audio.play('dosan');
    const box = h('div.main-inner');
    r.appendChild(h('div.page.intro', topbar({ title: p === 1 ? '1부 · 언지(言志)' : '2부 · 언학(言學)', sub: '도산서당, 1565년' }), h('main.main', box)));
    await G.gimmicks.intro(p, box);
    S().intro[p] = true; G.save.write();
    app.map(p);
  };

  // ───────── 병풍(1부) · 길(2부) ─────────
  app.map = function (p, opt = {}) {
    const r = clear();
    at('part=' + p);
    G.audio.play(p === 1 ? 'dosan' : 'eonhak');
    const list = songsOf(p);
    const nextSong = list.find((s) => !S().done[s.n]);
    const box = h('div.main-inner');
    const panels = h('div.' + (p === 1 ? 'byeongpung' : 'gil'));
    const sealOf = (s) => (G.save.mastered(s.n) ? h('span.tong' + (S().gold[s.n] ? '.gold' : ''), { title: S().gold[s.n] ? '다시 해서 되찾은 通' : '첫 시도에 모두 맞히고 도움 없이 끝낸 곡' }, '通') : S().done[s.n] ? h('span.tong.xi', { title: '익힌 곡' }, '習') : null);
    list.forEach((s, i) => {
      const open = S().teacher || S().done[s.n] || s === nextSong || (i > 0 && S().done[list[i - 1].n]);
      const hang = opt.hang === s.n;
      const el = h('button.pane' + (S().done[s.n] ? '.done' : '') + (s === nextSong ? '.next' : '') + (hang ? '.hang' : ''), { type: 'button', disabled: !open, 'aria-label': s.title + (S().done[s.n] ? ' (완성)' : '') },
        h('span.img', { style: { backgroundImage: `url(assets/sc/${s.scene.img}${S().done[s.n] ? '' : '_f'}.webp)`, backgroundPosition: (s.scene.thumb || '50% 50%') } }),
        // 방금 마친 폭: 바랜 그림이 걷히며 색이 드러난다
        hang ? h('span.img.fade', { style: { backgroundImage: `url(assets/sc/${s.scene.img}_f.webp)`, backgroundPosition: (s.scene.thumb || '50% 50%') } }) : null,
        h('span.lbl', h('b', yet(s.title)), h('small', S().done[s.n] ? yet(s.key) : open ? '펼치기' : '　')),
        sealOf(s));
      el.addEventListener('click', () => { G.audio.page(); app.song(s.n); });
      panels.appendChild(el);
    });
    const done = list.filter((s) => S().done[s.n]).length;
    const all = done === list.length;
    const tong = list.filter((s) => G.save.mastered(s.n)).length;
    // 通이 없는 폭은 '도움 없이 다시'로 되찾을 수 있다
    const retryable = list.filter((s) => S().done[s.n] && !G.save.mastered(s.n));
    box.append(
      h('p.lead', p === 1 ? '먹빛으로 바랜 여섯 폭 병풍이에요. 한 폭에 노래 한 곡씩, 시어를 되살리면 풍경에 색이 돌아와요.' : '배움의 길 여섯 구간이에요. 한 구간에 노래 한 곡씩, 노래를 익히며 길을 걸어요.'),
      h('p.small.muted.tong-lead', G.util.boldNodes(`첫 시도에 모두 맞히고 도움 없이 끝낸 곡에는 붉은 **通** 낙관이, 나머지 곡에는 먹빛 **習**(익힘) 낙관이 찍혀요. (通 ${tong} / ${list.length})`)),
      panels,
      h('div.next-row',
        !all && done >= 4 ? h('button.btn', { type: 'button', on: { click: () => { G.audio.tap(); app.result(p); } } }, '지금까지 결과 보기(제출)') : null,
        all ? h('button.btn.seal', { type: 'button', on: { click: () => { G.audio.tap(); app.result(p); } } }, p === 1 ? '완성한 병풍 보기' : '완성한 길 보기') :
          nextSong ? h('button.btn.primary' + (opt.hang ? '.pulse' : ''), { type: 'button', on: { click: () => { G.audio.page(); app.song(nextSong.n); } } }, yet(nextSong.title) + ' 펼치기 ▶') : null),
      retryable.length ? h('div.retry-row', h('span.small.muted', '通을 되찾으려면 도움 없이 다시:'),
        ...retryable.map((s) => h('button.btn.small.ghost', { type: 'button', on: { click: () => app.retry(s.n) } }, yet(s.title)))) : null);
    r.appendChild(h('div.page.map', topbar({ title: p === 1 ? '1부 · 언지(言志)' : '2부 · 언학(言學)', sub: p === 1 ? '자연에 머무는 뜻' : '배움으로 나아가는 길', home: true }), h('main.main', box)));
    if (opt.hang) { G.audio.page(); setTimeout(() => G.audio.stamp(), 1300); }
  };

  // 도움 없이 다시: 그 곡만 처음부터 '다시 읽기' 규칙(풀이 숨김, 세 장 끊기)으로. 通을 받으면 금빛 通
  app.retry = async function (n) {
    const song = SONGS.find((s) => s.n === n);
    const ok = await G.ui.sheet(h('div', h('h3', yet(song.title) + '을 도움 없이 다시 할까요?'),
      h('p', G.util.boldNodes('처음부터 다시 해요. 이번에는 **풀이를 가리고 세 장을 모두 직접 끊어요**(다시 읽기 규칙). 첫 시도에 모두 맞히고 도움 없이 끝내면 **금빛 通**을 받아요.')),
      h('p.small.muted', '오답 노트와 지금까지의 기록은 그대로 남아요.')),
    [{ label: '그만두기', value: false }, { label: '다시 하기', value: true, cls: 'seal' }]);
    if (!ok) return;
    G.save.resetSong(n);
    app.song(n);
  };

  // ───────── 상단 막대 ─────────
  function topbar(o) {
    const bar = h('header.topbar',
      iconBtn('menu', '메뉴', () => app.menu()),
      h('div.where', o.sub ? h('small', o.sub) : null, h('strong', yet(o.title))),
      o.steps ? h('div.stepdots', ...['景', '理', '音', '完'].map((t, i) => h('span.d', { dataset: { i } }, t))) : null,
      o.help ? iconBtn('note', '여백 메모(도움)', (e) => app.help(e.currentTarget), '.help-btn') : null,
      iconBtn('fold', '병풍 접기(잠깐 멈춤)', () => app.fold()));
    return bar;
  }
  const STEP_CLS = ['st-kyeong', 'st-ri', 'st-foot', 'st-done'];
  function setStep(i) {
    $$('.stepdots .d').forEach((d, k) => { d.classList.toggle('on', k === i); d.classList.toggle('past', k < i); });
    const play = $('.play');
    if (play) { play.classList.remove(...STEP_CLS); if (i >= 0) play.classList.add(STEP_CLS[i]); }
    const panel = $('.play .panel');
    if (panel) panel.scrollTo({ top: 0, behavior: 'smooth' });
    // 단계가 바뀌면 풍경 위에 붓글씨 한 자를 잠깐 찍는다(景 → 理 → 音)
    const wrap = $('.play .scene-wrap');
    if (wrap && i >= 0 && i <= 2) {
      $$('.step-stamp', wrap).forEach((x) => x.remove());
      const st = h('div.step-stamp', ['景', '理', '音'][i]);
      wrap.appendChild(st);
      setTimeout(() => st.remove(), 1500);
    }
  }

  app.help = async function (btn) {
    const c = current;
    const can = c && c.helpFn && (!c.canHelp || c.canHelp());
    if (!can) {
      G.audio.hint();
      G.ui.pop(btn, '지금은 천천히 읽어 보세요. 막히는 문제가 나오면 여기서 도움을 받을 수 있어요. (지금 누른 것은 도움으로 세지 않아요)');
      return;
    }
    const n = c.song.n;
    if (!S().helpAsked[n] && !S().teacher && !G.save.state.helpSong[n]) {
      const ok = await G.ui.sheet(h('div', h('h3', '여백 메모를 볼까요?'),
        h('p', G.util.boldNodes('도움을 보면 이 곡에는 **通** 낙관 대신 **習** 낙관이 찍혀요. 곡을 마친 뒤 병풍에서 **도움 없이 다시**로 通을 되찾을 수 있어요.'))),
      [{ label: '혼자 더 해 볼게요', value: false }, { label: '도움 보기', value: true, cls: 'primary' }]);
      if (!ok || current !== c) return;
      S().helpAsked[n] = true; G.save.write();
    }
    const msg = c.helpFn ? c.helpFn() : '';
    G.audio.hint();
    G.ui.pop(btn, msg ? G.util.bold(yet(msg)) : '지금은 천천히 읽어 보세요.');
  };

  // 병풍 접기: 교사가 "화면 접으세요" 하면 한 번에 멈춘다(소리도 멈춤)
  app.fold = function () {
    G.audio.hush();
    const was = S().music;
    if (was) G.audio.music(false);
    const ov = h('div.fold-ov', { role: 'dialog', 'aria-label': '잠깐 멈춤' },
      h('div.fold-art', ...[0, 1, 2, 3, 4, 5].map(() => h('i'))),
      h('p', '병풍을 접었어요. 선생님 말씀을 들어요.'),
      h('button.btn.primary', { type: 'button', on: { click: () => { ov.remove(); if (was) G.audio.music(true); } } }, '다시 펼치기'));
    document.body.appendChild(ov);
  };

  app.menu = async function () {
    const c = current;
    const v = await G.ui.sheet(h('div', h('h3', '메뉴')), [
      { label: '처음 화면', value: 'home' },
      c ? { label: (c.song.part === 1 ? '병풍' : '길') + '으로', value: 'map' } : null,
      { label: '시어 사전', value: 'dict' },
      { label: '발문 읽기', value: 'balmun' },
      { label: '이본 노트', value: 'variants' },
      { label: '설정', value: 'settings' },
      { label: '닫기', value: null, cls: 'primary' },
    ].filter(Boolean));
    if (v === 'home') app.title();
    else if (v === 'map') app.map(c.song.part);
    else if (v === 'dict') app.dict();
    else if (v === 'balmun') app.balmun();
    else if (v === 'variants') app.variants();
    else if (v === 'settings') app.settings();
  };

  app.settings = async function () {
    const s = S();
    const row = (label, key, on, off) => h('label.setrow', h('span', label), (() => {
      const b = h('button.btn.small' + (s[key] ? '.primary' : ''), { type: 'button' }, s[key] ? on : off);
      b.addEventListener('click', () => { s[key] = !s[key]; G.save.write(); b.textContent = s[key] ? on : off; b.classList.toggle('primary', s[key]); if (key === 'music') G.audio.music(s.music); app.applySettings(); });
      return b;
    })());
    const fontRow = h('label.setrow', h('span', '글자 크기'), h('span.row-btns', ...[[0.9, '작게'], [1, '보통'], [1.15, '크게']].map(([v, t]) => h('button.btn.small' + (s.font === v ? '.primary' : ''), { type: 'button', on: { click: (e) => { s.font = v; G.save.write(); app.applySettings(); $$('.btn', e.target.parentNode).forEach((x) => x.classList.remove('primary')); e.target.classList.add('primary'); } } }, t))));
    const v = await G.ui.sheet(h('div', h('h3', '설정'),
      row('효과음·노래', 'sound', '켜짐', '꺼짐'),
      row('배경음', 'music', '켜짐', '꺼짐'),
      row('원문에 한자 함께 보기', 'hanja', '보임', '숨김'),
      fontRow,
      h('p.small.muted', '저장은 이 기기의 브라우저에만 돼요(서버로 보내지 않아요).')),
    [{ label: '1부 기록 지우기', value: 'r1' }, { label: '2부 기록 지우기', value: 'r2' }, { label: '닫기', value: null, cls: 'primary' }]);
    if (v === 'r1' || v === 'r2') {
      const ok = await G.ui.sheet(h('div', h('h3', (v === 'r1' ? '1부' : '2부') + ' 기록을 지울까요?'), h('p', '그 부의 곡 진행과 기록이 모두 지워져요.')), [{ label: '그대로 두기', value: false, cls: 'primary' }, { label: '지우기', value: true, cls: 'seal' }]);
      if (ok) { G.save.resetPart(v === 'r1' ? 1 : 2); app.title(); }
    } else if (current) { /* 곡 화면 글자 다시 그리기는 다음 화면부터 */ }
  };

  app.about = function () {
    G.ui.sheet(h('div', h('h3', '선생님께'), ...ABOUT.map((p) => h('p', G.util.boldNodes(p)))));
  };

  // ───────── 곡 ─────────
  app.song = async function (n) {
    const song = SONGS.find((s) => s.n === n);
    const r = clear();
    at('song=' + n);
    const task = h('div.task');
    const poem = G.kit.poem(song, { filled: (id) => S().found[n + '-' + id] === 'placed' || (!song.words[id].ri && done(n, 'kyeong')) || done(n, 'ri') });
    const panel = h('div.panel', poem, task);
    const c = (current = { song, poem, task, panel, helpFn: null, onSpot: null, onMiss: null });
    const scene = (c.scene = G.scene({
      src: `assets/sc/${song.scene.img}.webp`, faded: `assets/sc/${song.scene.img}_f.webp`, focus: song.scene.focus,
      onSpot: (sp, btn) => c.onSpot && c.onSpot(sp, btn), onMiss: (x, y) => c.onMiss && c.onMiss(x, y),
    }));
    const wrap = h('div.scene-wrap', scene.root);
    if (song.place) {
      const cap = h('button.scene-caption', { type: 'button' }, song.place.t, h('span.tag.fiction', '장소 설정'));
      cap.addEventListener('click', (e) => { e.stopPropagation(); G.ui.pop(cap, G.util.bold(yet(song.place.note || ''))); });
      wrap.appendChild(cap);
    }
    r.appendChild(h('div.page.play.part' + song.part, topbar({ title: song.title, sub: song.part === 1 ? '1부 · 언지' : '2부 · 언학', steps: true, help: true }), h('div.stage', wrap, panel)));
    G.audio.chapter();
    await scene.ready;
    if (current !== c) return;
    // 풍경 그림을 먼저 받고 나서 곡을 바꾼다(느린 망에서 그림이 늦지 않게). 곧 쓸 녹음도 미리 받아 둔다
    G.audio.play(song.music || (song.part === 1 ? 'eonji' : 'eonhak'));
    G.audio.prefetch('ri', song.n === 10 ? 'stray' : null, song.n === 6 || song.n === 12 ? 'finale' : null);

    // 곡 열기
    if (!done(n, 'open')) {
      setStep(-1);
      if (song.open) await G.gimmicks.open(c);
      mark(n, 'open');
    }
    // 景 보기
    setStep(0);
    if (!done(n, 'kyeong')) { await G.steps.kyeong(c); mark(n, 'kyeong'); }
    else scene.revealNow(Object.keys(song.words).filter((id) => song.words[id].spot));
    if (current !== c) return;
    // 理 읽기(곡마다 다른 기믹)
    setStep(1);
    if (!done(n, 'ri')) {
      task.innerHTML = '';
      await G.gimmicks.run(c);
      if (current !== c) return;
      mark(n, 'ri');
    }
    // 음보 끊기 → 노래
    setStep(2);
    scene.root.classList.remove('lens');
    const fp = await G.steps.foot(c);
    if (current !== c) return;
    mark(n, 'foot');
    await G.steps.sing(c, fp);
    if (current !== c) return;
    // 곡 완성
    setStep(3);
    await finish(c);
  };

  async function finish(c) {
    const { song, scene, task } = c;
    task.innerHTML = '';
    scene.root.classList.remove('lens');
    // 마음 고르기를 먼저(씻김이 곡의 마지막 큰 순간이 되게)
    if (!S().mind[song.n]) {
      G.kit.say(task, '노래를 마쳤어요. 이 노래에 담긴 **화자의 마음**을 한마디로 고른다면? 다른 곡의 마음도 섞여 있으니 **종장**까지 떠올려 보세요.');
      const res = await G.kit.choose(task, null, song.mind.options, { song, kind: 'mind', seed: song.n, wrongNote: `화자의 마음 고르기 (${song.n}곡)` });
      if (current !== c) return;
      // 마음 지도에는 처음 고른 것을 남긴다(틀렸으면 결과 화면에 → 바른 마음이 함께 나온다)
      S().mind[song.n] = res.first.t; G.save.write();
      await wait(1100);
      if (current !== c) return;
    }
    task.innerHTML = '';
    if (song.noAid && c.poem.showAid) c.poem.showAid();
    // 씻김
    scene.wash();
    G.audio.wash();
    await wait(1200);
    G.audio.fanfare();
    S().done[song.n] = true;
    const f = S().first[song.n] || [0, 0], helps = (S().helpSong || {})[song.n] || 0;
    const clean = f[1] > 0 && f[0] === f[1] && !helps;
    const retried = S().retry && S().retry[song.n];
    if (retried) { if (clean) S().gold[song.n] = true; delete S().retry[song.n]; }
    const list = songsOf(song.part);
    if (list.every((s) => S().done[s.n])) S().finishedAt[song.part] = S().finishedAt[song.part] || Date.now();
    G.save.write();
    await wait(1500);
    if (current !== c) return;
    // 풍경 위에 낙관: 通(첫 시도 모두 맞힘 + 도움 없음) 또는 習(익힘)
    const m = G.save.mastered(song.n), gold = !!S().gold[song.n];
    scene.root.appendChild(h('div.scene-seal' + (m ? '.tong' : '.xi') + (gold ? '.gold' : ''), m ? '通' : '習'));
    G.audio.stamp();
    G.util.buzz();
    task.appendChild(h('div.tong-note' + (m ? '.on' : ''), h('span.tong' + (m ? (gold ? '.gold' : '') : '.xi'), m ? '通' : '習'),
      h('span', G.util.boldNodes(m ? (gold ? `**다시 해서 通을 되찾았어요!** 금빛 通 낙관을 찍었어요.` : `**막힘없이 통했어요!** 첫 시도 ${f[0]} / ${f[1]} · 도움 0번.`)
        : `첫 시도 ${f[0]} / ${f[1]}` + (helps ? ` · 도움 ${helps}번` : '') + '. 익힘(習) 낙관을 찍었어요. 병풍에서 **도움 없이 다시**로 通을 되찾을 수 있어요.'))));
    task.appendChild(G.ui.card({ kind: 'note', title: song.title + ' 한눈에', body: song.summary }));
    const next = list.find((s) => !S().done[s.n]);
    const row = h('div.next-row',
      next ? h('button.btn.ghost.small', { type: 'button', on: { click: () => { G.audio.page(); app.song(next.n); } } }, '바로 ' + yet(next.title) + ' ▶') : null,
      h('button.btn.primary', { type: 'button', on: { click: () => { G.audio.tap(); app.map(song.part, { hang: song.n }); } } }, song.part === 1 ? '병풍에 걸기 ▶' : '길에 새기기 ▶'));
    task.appendChild(row);
    row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  // ───────── 사전·발문·이본 ─────────
  app.dict = function () {
    const items = [];
    for (const s of SONGS) for (const id in s.words) {
      const got = S().found[s.n + '-' + id] === 'placed' || S().done[s.n];
      items.push(h('div.dict-item' + (got ? '' : '.locked'),
        h('span.num', s.n + '곡'),
        got ? h('span.w', G.text.render(s.words[id].orig, { hanja: true, words: s.words })) : h('span.w', '？'),
        h('span.g', got ? yet(s.words[id].gloss) : '아직 되살리지 않았어요')));
    }
    G.ui.sheet(h('div', h('h3', '시어 사전'), h('p.small.muted', '풍경에서 되살린 시어가 모여요.'), h('div.dict', items)));
  };
  app.balmun = function () {
    G.ui.sheet(h('div', h('h3', BALMUN.title), ...BALMUN.body.map((p) => h('p', G.util.boldNodes(yet(p)))), h('p.small.muted', BALMUN.src)));
  };
  app.variants = function () {
    G.ui.sheet(h('div', h('h3', '이본 노트'), h('p.small.muted', '판본이나 풀이가 갈리는 곳이에요. 게임은 이런 곳을 채점하지 않아요.'),
      ...VARIANTS.map((v) => G.ui.card(Object.assign({ kind: v.kind || 'variant' }, v)))));
  };

  // ───────── 결과 ─────────
  app.result = async function (p) {
    const r = clear();
    at('result=' + p);
    G.audio.play('finale');
    const list = songsOf(p);
    const box = h('div.main-inner');
    r.appendChild(h('div.page.result', topbar({ title: p === 1 ? '완성한 병풍' : '완성한 배움의 길', sub: p === 1 ? '1부 · 언지' : '2부 · 언학', home: true }), h('main.main', box)));
    await G.gimmicks.result(p, box);
  };
})();
