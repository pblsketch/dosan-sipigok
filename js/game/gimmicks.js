'use strict';
// 理 읽기: 곡마다 다른 기믹. 곡 데이터(songs.js)의 ri 배열을 '장면 조각(beat)' 차례대로 실행한다.
//  { do:'voice', who, text }            말풍선
//  { do:'say', text }                    안내 한 줄
//  { do:'card', kind, title, body, … }   알림 카드(확인을 기다림)
//  { do:'lens', text?, labels:[{ at:'시어id'|[x,y], t, sub? }] }  마음의 눈: 풍경에 속성 이름표
//  { do:'unlens' }
//  { do:'batch', title, rows, pool }     묶음 확정(모두 맞아야 넘어감)
//  { do:'choose', q, options:[{t, ok, why}] }  하나 고르기(free: true면 채점 안 함)
//  { do:'sort', q, bins:[{id,t}], items:[{t, bin, why?}] }  참/거짓 같은 가르기(묶음 확정)
//  { do:'order', q, items:[문장…(바른 차례)] }  차례 맞추기(묶음 확정)
//  { do:'sil', at:[x,y], text }          먼 곳의 실루엣
//  { do:'fx', name:'thunder'|'sun' }     풍경 효과
//  { do:'music', track }
//  그 밖: 'wheel'(6곡 계절), 'scales'(12곡 저울), 'fork'(10곡 갈림길), 'hunt'(8곡 가장 큰 것)
(function () {
  const { h, $, $$, wait, yet, shuffle, shuffleNot } = G.util;
  const S = () => G.save.state;
  const kit = G.kit;
  const gm = (G.gimmicks = {});

  // ───────── 장면 조각 실행기 ─────────
  gm.play = async function (beats, c, box) {
    for (const b of beats || []) {
      if (b.review === false && S().mode === 'review') continue;
      if (b.first === false && S().mode !== 'review') continue;
      const fn = BEAT[b.do];
      if (!fn) { console.warn('모르는 장면 조각', b.do); continue; }
      await fn(b, c, box);
      if (G.app && c && c.song && document.querySelector('.play') == null) return; // 화면을 떠남
    }
  };
  gm.run = async function (c) {
    c.helpFn = () => c.riHint || '이치 읽기는 원문의 말을 근거로 생각해요. 원문과 풀이를 다시 읽어 보세요.';
    await gm.play(c.song.ri, c, c.task);
    c.helpFn = null;
  };
  gm.open = async function (c) {
    c.task.innerHTML = '';
    await gm.play(c.song.open, c, c.task);
    c.task.innerHTML = '';
  };
  gm.intro = async function (p, box) {
    await gm.play(INTRO[p], { song: null, task: box }, box);
  };

  const BEAT = {
    async voice(b, c, box) { kit.voice(box, b.who, b.text); await wait(b.pause || 350); if (b.next) await kit.next(box, b.next); },
    async recallCard(b, c, box) { await kit.card(box, b); },
    async say(b, c, box) { kit.say(box, b.text); },
    async card(b, c, box) { await kit.card(box, b, { label: b.label }); },
    async next(b, c, box) { await kit.next(box, b.label || '다음 ▶'); },
    async clear(b, c, box) { box.innerHTML = ''; },
    async music(b) { G.audio.play(b.track); },
    async img(b, c, box) {
      box.appendChild(h('figure.fig', h('img', { src: b.src, alt: b.alt || '' }), b.cap ? h('figcaption', G.util.boldNodes(yet(b.cap))) : null));
    },
    async lens(b, c, box) {
      const sc = c.scene;
      sc.root.classList.add('lens');
      G.audio.lens();
      G.audio.play('ri');
      $$('.attr', sc.root).forEach((x) => x.remove());
      // 이름표가 붙을 곳이 한 화면에 들어오게 가운데로 훑어 준다(휴대폰 세로 화면)
      const pts = (b.labels || []).map((l) => (typeof l.at === 'string' ? sc.spots.find((s) => s.id === l.at) : { x: l.at[0], y: l.at[1] })).filter(Boolean);
      if (pts.length) sc.panTo(pts.reduce((a, q) => a + q.x, 0) / pts.length, pts.reduce((a, q) => a + q.y, 0) / pts.length);
      if (b.text) kit.say(box, b.text);
      (b.labels || []).forEach((l, i) => setTimeout(() => addLabel(c, l), 300 + i * 450));
      await wait(300 + (b.labels || []).length * 450);
    },
    async unlens(b, c) {
      c.scene.root.classList.remove('lens');
      $$('.attr', c.scene.root).forEach((x) => x.remove());
      $$('.sil-fig', c.scene.root).forEach((x) => { x.classList.remove('on'); setTimeout(() => x.remove(), 1300); });
      G.audio.play(c.song.music || (c.song.part === 1 ? 'eonji' : 'eonhak'));
    },
    async batch(b, c, box) {
      if (b.text) kit.say(box, b.text);
      c.riHint = b.hint || c.riHint;
      await kit.batch(box, b.rows, b.pool, { song: c.song, kind: 'ri', title: b.title, confirm: b.confirm, seed: c.song ? c.song.n : 1, wrongNote: b.wrong });
      if (b.after) await kit.card(box, b.after, { label: b.after.label });
    },
    async choose(b, c, box) {
      c.riHint = b.hint || c.riHint;
      await kit.choose(box, b.q, b.options, { song: c.song, kind: b.kind || 'ri', free: b.free, seed: c.song ? c.song.n : 1, keepOrder: b.keepOrder, wrongNote: b.wrong });
      if (b.after) await kit.card(box, b.after, { label: b.after.label });
      else if (b.pauseAfter !== false) await kit.next(box, '다음 ▶');
    },
    async sort(b, c, box) {
      c.riHint = b.hint || c.riHint;
      await sortBoard(box, b, c);
      if (b.after) await kit.card(box, b.after, { label: b.after.label });
    },
    async order(b, c, box) {
      c.riHint = b.hint || c.riHint;
      if (b.veil && c.poem) c.poem.classList.add('veiled');
      await orderBoard(box, b, c);
      if (c.poem) c.poem.classList.remove('veiled');
      if (b.after) await kit.card(box, b.after, { label: b.after.label });
    },
    async sil(b, c, box) {
      const sc = c.scene;
      const [px, py] = sc.pointOfImg(b.at[0], b.at[1]);
      const el = h('div.sil-fig', { style: { left: px + 'px', top: py + 'px' } }, h('span.sil-body'));
      sc.root.appendChild(el);
      requestAnimationFrame(() => el.classList.add('on'));
      if (b.text) kit.say(box, b.text);
      await wait(900);
    },
    // 理 읽기에서 알아낸 시어를 원문 칸에 채운다(4곡 彼美一人)
    async fill(b, c) {
      c.poem.fill(b.id);
      S().found[c.song.n + '-' + b.id] = 'placed'; G.save.write();
      G.audio.ok();
      await wait(700);
    },
    // 10곡 갈림길: 반짝이는 길은 한 바퀴 돌아 제자리(채점하지 않는다)
    async fork(b, c, box) {
      kit.say(box, b.q);
      const row = h('div.fork');
      const shiny = h('button.fork-btn.shiny', { type: 'button' }, yet(b.shiny));
      const humble = h('button.fork-btn.humble', { type: 'button' }, yet(b.humble));
      row.append(shiny, humble);
      box.appendChild(row);
      await new Promise((resolve) => {
        shiny.addEventListener('click', async () => {
          if (shiny.disabled) return;
          shiny.disabled = true;
          G.audio.play('stray');
          c.scene.root.classList.add('stray');
          G.audio.page();
          await wait(1600);
          c.scene.root.classList.remove('stray');
          G.audio.play('eonhak');
          kit.say(box, b.loop);
          c.poem.lines[1].classList.add('glow');
          setTimeout(() => c.poem.lines[1].classList.remove('glow'), 3000);
          humble.classList.add('pulse');
        });
        humble.addEventListener('click', async () => {
          shiny.disabled = true; humble.disabled = true; humble.classList.remove('pulse');
          G.audio.ok();
          if (!shiny.classList.contains('went') && !box.querySelector('.fork ~ .ask')) kit.say(box, b.back);
          await kit.next(box, '다음 ▶');
          resolve();
        });
      });
    },
    // 12곡 저울: 두 구절을 쉽다/어렵다 접시에 올리면 저울이 수평이 된다(둘 다 참)
    async scales(b, c, box) {
      kit.say(box, b.q);
      const NS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', '0 0 200 92'); svg.setAttribute('class', 'scales');
      svg.innerHTML = '<g class="stand"><path d="M100 20 V84 M76 86 H124" /></g>' +
        '<g class="beam"><path d="M30 24 H170" /><circle cx="100" cy="24" r="3" />' +
        '<g class="pan l"><path d="M30 24 L16 56 M30 24 L44 56" /><path d="M10 56 H50 Q30 70 10 56 Z" /><text x="30" y="80">' + G.util.esc(b.left) + '</text></g>' +
        '<g class="pan r"><path d="M170 24 L156 56 M170 24 L184 56" /><path d="M150 56 H190 Q170 70 150 56 Z" /><text x="170" y="80">' + G.util.esc(b.right) + '</text></g></g>';
      box.appendChild(h('div.scales-wrap', svg));
      const beam = svg.querySelector('.beam');
      const tilt = (placed) => {
        const l = !!placed.l, r = !!placed.r;
        const deg = l && !r ? -12 : r && !l ? 12 : 0;
        beam.style.transform = `rotate(${deg}deg)`;
      };
      const items = b.items.map((it, i) => ({ id: 'i' + i, text: it.t, side: it.side }));
      await kit.batch(box, [
        { head: '⚖ ' + b.left, slots: [{ id: 'l', answer: items.find((x) => x.side === 'L').id, label: '구절을 올리세요' }] },
        { head: '⚖ ' + b.right, slots: [{ id: 'r', answer: items.find((x) => x.side === 'R').id, label: '구절을 올리세요' }] },
      ], items, { song: c.song, kind: 'ri', title: '쉬움·어려움 저울', seed: 12, onChange: tilt });
      svg.classList.add('level');
      G.audio.found();
      if (b.after) await kit.card(box, b.after, { label: b.after.label });
    },
    // 2부 도입: 1부 되짚기(1부를 마쳤으면 떠올려 잇기, 아니면 요약)
    async recall(b, c, box) {
      const done1 = SONGS.filter((x) => x.part === 1).every((x) => S().done[x.n]);
      if (!done1) {
        await kit.card(box, { kind: 'note', title: '1부(언지) 요약', body: RECALL.map((r) => `**${r.n}곡** — ${r.key}`).join(String.fromCharCode(10)) }, { label: '다음 ▶' });
        return;
      }
      kit.say(box, '지난 시간의 병풍을 떠올려 보세요. **초장**을 보고 그 곡의 **종장 머리**(첫 두 음보)를 이어 확정하세요. 여섯 칸 모두 맞아야 해요. 이 듕에, [ㅎㆍ][ㅁㆍㄹ]며로 시작하는 곡이 둘씩 있으니 둘째 음보까지 보세요!');
      const R = (s) => (G.text ? G.text.reading(s, {}) : s);
      await kit.batch(box, RECALL.map((r) => ({ head: r.n + '곡 · ' + R(r.head), slots: [{ id: 'r' + r.n, answer: 'k' + r.n, label: '종장 머리', pre: '…' }] })),
        RECALL.map((r) => ({ id: 'k' + r.n, text: R(r.tail) })), { kind: 'recall', title: '1부 되짚기', seed: 6 });
      await kit.next(box, '다음 ▶');
    },
    async fx(b, c) {
      const sc = c.scene;
      if (b.name === 'thunder') { G.audio.thunder(); sc.root.classList.add('flash'); await wait(700); sc.root.classList.remove('flash'); }
      if (b.name === 'sun') { sc.root.classList.add('sunglow'); G.audio.found(); await wait(900); }
      if (b.name === 'wash') { sc.wash(); G.audio.wash(); await wait(1600); }
    },
  };

  // 마음의 눈 이름표
  function addLabel(c, l) {
    const sc = c.scene;
    let x, y;
    if (typeof l.at === 'string') {
      const sp = sc.spots.find((s) => s.id === l.at);
      if (!sp) return;
      const r = sc.root.getBoundingClientRect(), b = sp.btn.getBoundingClientRect();
      x = b.left - r.left + b.width / 2; y = b.top - r.top + b.height * 0.3;
    } else {
      const [px, py] = sc.pointOfImg ? sc.pointOfImg(l.at[0], l.at[1]) : [0, 0];
      x = px; y = py;
    }
    const el = h('div.attr', { style: { left: x + 'px', top: y + 'px' } }, yet(l.t), l.sub ? h('small', yet(l.sub)) : null);
    sc.root.appendChild(el);
  }

  // 가르기 판: 항목마다 칸 단추(예: 참/거짓)를 누르고 [확정]
  function sortBoard(box, b, c) {
    return new Promise((resolve) => {
      if (b.q) kit.say(box, b.q);
      const wrap = h('div.sortb');
      const pick = {};
      const items = b.keepOrder ? b.items : shuffleNot(b.items, c.song ? c.song.n : 3);
      const rows = items.map((it, i) => {
        const btns = b.bins.map((bin) => {
          const bt = h('button.bin', { type: 'button' }, yet(bin.t));
          bt.addEventListener('click', () => {
            pick[i] = bin.id; G.audio.pick();
            $$('.bin', row).forEach((x) => x.classList.toggle('on', x === bt));
            row.classList.remove('bad');
            confirm.disabled = items.some((_, k) => !pick[k]);
          });
          return bt;
        });
        const row = h('div.srow', h('span.it', G.util.boldNodes(yet(it.t))), h('span.bins', btns));
        wrap.appendChild(row);
        return row;
      });
      const msg = h('p.msg');
      const confirm = h('button.btn.seal', { type: 'button', disabled: true }, b.confirm || '확정하기');
      const reveal = h('button.btn.ghost.small', { type: 'button', hidden: !S().teacher }, '정답 보기');
      box.append(wrap, msg, h('div.next-row', reveal, confirm));
      let tries = 0;
      confirm.addEventListener('click', () => {
        tries++;
        const bad = items.map((it, i) => (pick[i] === it.bin ? -1 : i)).filter((i) => i >= 0);
        if (c.song && tries === 1) { G.save.stat(c.song.n, 'ri', !bad.length); if (bad.length) G.save.wrong(c.song.n, 'ri', (b.title || '가르기') + ` (${c.song.n}곡)`); }
        if (!bad.length) {
          G.audio.ok();
          rows.forEach((r, i) => { r.classList.add('good'); $$('.bin', r).forEach((x) => { x.disabled = true; }); if (items[i].why) r.appendChild(h('span.why', G.util.boldNodes(yet(items[i].why)))); });
          confirm.remove(); reveal.remove(); msg.remove();
          resolve(); return;
        }
        G.audio.no(); G.ui.shake(wrap);
        if (tries >= 2) bad.forEach((i) => rows[i].classList.add('bad'));
        msg.textContent = `${items.length}개 가운데 ${items.length - bad.length}개가 맞아요.` + (tries >= 2 ? ' 붉게 번진 줄을 다시 보세요.' : '');
        if (tries >= 3) reveal.hidden = false;
      });
      reveal.addEventListener('click', () => {
        items.forEach((it, i) => { pick[i] = it.bin; $$('.bin', rows[i]).forEach((x, k) => x.classList.toggle('on', b.bins[k].id === it.bin)); });
        S().helped++; confirm.disabled = false; confirm.click();
      });
    });
  }

  // 차례 맞추기: 섞인 조각을 차례로 눌러 줄 세운다. [확정] 하면 맞은 개수만 알려 준다
  function orderBoard(box, b, c) {
    return new Promise((resolve) => {
      if (b.q) kit.say(box, b.q);
      const wrap = h('div.orderb');
      const line = h('ol.oline');
      const pool = h('div.pool');
      const seq = [];
      const items = b.items.map((t, i) => ({ t, i }));
      const redraw = () => {
        line.innerHTML = '';
        seq.forEach((it, k) => line.appendChild(h('li', h('button.ochip.in', { type: 'button', on: { click: () => { seq.splice(k, 1); G.audio.tap(); redraw(); } } }, G.util.boldNodes(yet(it.t))))));
        for (let k = seq.length; k < items.length; k++) line.appendChild(h('li.empty', '　'));
        pool.innerHTML = '';
        for (const it of shuffleNot(items, 5)) if (!seq.includes(it)) pool.appendChild(h('button.ochip', { type: 'button', on: { click: () => { seq.push(it); G.audio.pick(); redraw(); } } }, G.util.boldNodes(yet(it.t))));
        confirm.disabled = seq.length < items.length;
      };
      const msg = h('p.msg');
      const confirm = h('button.btn.seal', { type: 'button', disabled: true }, b.confirm || '확정하기');
      const reveal = h('button.btn.ghost.small', { type: 'button', hidden: !S().teacher }, '정답 보기');
      wrap.append(line, h('div.pool-label', '조각'), pool);
      box.append(wrap, msg, h('div.next-row', reveal, confirm));
      redraw();
      let tries = 0;
      confirm.addEventListener('click', () => {
        tries++;
        const ok = seq.filter((it, k) => it.i === k).length;
        if (c.song && tries === 1) { G.save.stat(c.song.n, 'ri', ok === items.length); if (ok < items.length) G.save.wrong(c.song.n, 'ri', (b.title || '차례 맞추기') + ` (${c.song.n}곡)`); }
        if (ok === items.length) {
          G.audio.ok(); wrap.classList.add('good'); pool.remove(); confirm.remove(); reveal.remove(); msg.remove();
          $$('.ochip', line).forEach((x) => { x.disabled = true; });
          resolve(); return;
        }
        G.audio.no(); G.ui.shake(line);
        msg.textContent = `${items.length}자리 가운데 ${ok}자리가 맞아요.` + (b.hint2 && tries >= 2 ? ' ' + yet(b.hint2) : '');
        if (tries >= 3) reveal.hidden = false;
      });
      reveal.addEventListener('click', () => { seq.length = 0; seq.push(...items); redraw(); S().helped++; confirm.click(); });
    });
  }

  // ───────── 부 결과: 완성한 병풍(길) + 이름 낙관 + 마음 지도 + 기록 ─────────
  // 낙관에 새길 글자: 입력한 문자열에서 마지막 한글 이름(1~4자). 세 글자면 옛 인장처럼 '印'을 붙인다
  gm.sealText = function (name) {
    const words = String(name || '').match(/[가-힣]{1,4}/g);
    let t = words ? words[words.length - 1] : '';
    if (t.length === 3) t += '印';
    return t;
  };
  const partSongs = (p) => SONGS.filter((x) => x.part === p);
  const pct = (a) => (a && a[1] ? Math.round((a[0] / a[1]) * 100) + '%' : '—');
  const sumKind = (p, kind) => partSongs(p).reduce((acc, x) => { const k = S().firstKind[x.n + '-' + kind]; if (k) { acc[0] += k[0]; acc[1] += k[1]; } return acc; }, [0, 0]);
  gm.stats = function (p) {
    const st = S();
    const mins = st.startedAt[p] && st.finishedAt[p] ? Math.max(1, Math.round((st.finishedAt[p] - st.startedAt[p]) / 60000)) : null;
    return [
      ['시어 넣기 첫 시도', pct(sumKind(p, 'word'))],
      ['이치 잇기 첫 시도', pct(sumKind(p, 'ri'))],
      ['음보 끊기 첫 시도', pct(sumKind(p, 'foot'))],
      ['화자의 마음 첫 시도', pct(sumKind(p, 'mind'))],
      ['도움(여백 메모·정답 보기)', st.helped + '번'],
      ['읽기 방식 · 걸린 시간', (st.mode === 'review' ? '다시 읽기' : '처음 읽기') + (mins ? ` · ${mins}분` : '')],
    ];
  };

  gm.result = async function (p, box) {
    const st = S();
    const list = partSongs(p);
    box.appendChild(h('p.lead', p === 1 ? '여섯 폭 병풍이 모두 색을 되찾았어요. 마지막 폭에 이름 낙관을 찍어 마무리하세요.' : '배움의 길 여섯 구간을 모두 걸었어요. 길 끝에 이름 낙관을 찍어 마무리하세요.'));
    // 완성한 그림
    const art = h('div.final.' + (p === 1 ? 'byeongpung' : 'gil'));
    list.forEach((x) => art.appendChild(h('div.pane.done', h('span.img', { style: { backgroundImage: `url(assets/sc/${x.scene.img}.webp)`, backgroundPosition: x.scene.thumb || '50% 50%' } }), h('span.lbl', h('b', yet(x.title)), h('small', yet(x.key))))));
    const seal = h('div.name-seal' + (st.sealed[p] ? '.on' : ''), h('span', gm.sealText(st.name)));
    const sealLen = () => { seal.dataset.len = Math.min(3, gm.sealText(st.name).length || 1); seal.firstChild.textContent = gm.sealText(st.name); };
    sealLen();
    art.appendChild(seal);
    const nameIn = h('input.name-input', { type: 'text', placeholder: '반 번호 이름 (예: 1-3 12 김지은)', value: st.name || '', maxlength: 24, 'aria-label': '이름' });
    const stampBtn = h('button.btn.seal', { type: 'button' }, st.sealed[p] ? '낙관 다시 찍기' : '이름 낙관 찍기');
    nameIn.addEventListener('input', () => { st.name = nameIn.value; st.sealed[p] = false; G.save.write(); sealLen(); seal.classList.remove('on'); stampBtn.textContent = '이름 낙관 찍기'; });
    stampBtn.addEventListener('click', () => {
      if (!gm.sealText(st.name)) { G.ui.toast('낙관에 새길 이름(한글)을 먼저 적어 주세요'); nameIn.focus(); return; }
      st.sealed[p] = true; G.save.write();
      seal.classList.remove('on'); void seal.offsetWidth; seal.classList.add('on');
      G.audio.stamp();
      const r = seal.getBoundingClientRect(); G.ui.inkBurst(r.left + r.width / 2, r.top + r.height / 2, 10);
      stampBtn.textContent = '낙관 다시 찍기';
    });
    box.append(art, h('div.row-btns.name-row', nameIn, stampBtn));

    // 마음 지도(2부에서 1부까지 마쳤으면 열두 곡)
    const mindSongs = p === 2 && partSongs(1).every((x) => st.done[x.n]) ? SONGS : list;
    const map = h('div.mindmap');
    mindSongs.forEach((x) => {
      const pick = st.mind[x.n];
      const right = x.mind.options.find((o) => o.ok).t;
      map.appendChild(h('div.mrow' + (x.part === 1 ? '.p1' : '.p2'), h('span.mn', x.n + '곡'), h('span.mk', yet(x.key)), h('span.mm', pick || '—', pick && pick !== right ? h('small', ' → ' + right) : null)));
    });
    box.appendChild(h('div.card.note', h('span.kind', '마음 지도'), h('h3', mindSongs.length === 12 ? '열두 곡의 마음' : '여섯 곡의 마음'), map,
      h('p.small.muted', p === 1 ? '언지: 자연 속에서 뜻을 세우는 마음 — 만족 → 겸허 → 확신 → 연군 → 안타까움 → 감탄' : '언학: 배움으로 나아가는 마음 — 즐거움 → 깨달음 → 결의 → 전념 → 의지 → 몰두')));

    // 기록
    box.appendChild(h('div.ledger', h('div.lh', '공부 기록'), h('div.stats', ...gm.stats(p).map(([k, v]) => h('div.stat', h('b', v), h('span', k))))));
    // 오답 노트
    const wrong = st.wrong.filter((w) => list.some((x) => x.n === w.song));
    if (wrong.length) box.appendChild(h('div.card.note', h('span.kind', '오답 노트'), h('h3', '헷갈렸던 것'), ...wrong.slice(0, 10).map((w) => h('p.small', '· ' + yet(w.text)))));
    // 생각 나누기
    box.appendChild(h('div.card.interp', h('span.kind', '생각 나누기'), h('h3', '친구와 이야기해 보세요'), ...(DEBRIEF[p] || []).map((q) => h('p', '· ' + q))));
    if (p === 2) box.appendChild(G.ui.card({ kind: 'balmun', title: '상자에 넣어 둔 노래', body: '퇴계는 이 노래가 말썽의 빌미가 될까 조심스러워, **한 부만 써서 상자에 넣어 두고** 때때로 꺼내 스스로를 돌아보았다고 발문에 적었어요.\n그 노래를 오늘 우리가 이렇게 불러 보았어요.', src: '「도산십이곡발」 姑寫一件 藏之篋笥' }));
    box.appendChild(h('div.card.note', h('h3', '제출하기'),
      h('p.small', '낙관을 찍은 그림과 공부 기록이 보이게 화면을 캡처하거나, 아래 단추로 그림 파일을 저장해 제출하세요. 윈도: Win + Shift + S · 크롬북: Ctrl + 창 전환 키 · 아이폰: 전원 + 볼륨 올리기 · 안드로이드: 전원 + 볼륨 내리기'),
      h('div.row-btns',
        h('button.btn.primary', { type: 'button', on: { click: () => gm.saveImage(p) } }, '그림 파일로 저장'),
        h('button.btn', { type: 'button', on: { click: () => G.app.title() } }, '처음 화면'),
        p === 1 ? h('button.btn.seal', { type: 'button', on: { click: () => G.app.part(2) } }, '2부 언학으로 ▶') : null)));
    G.audio.fanfare();
  };

  // 결과를 그림 파일로(병풍·낙관·기록·마음 지도를 캔버스에 그린다)
  gm.saveImage = async function (p) {
    const st = S(), list = partSongs(p);
    const W = 1080, H = 1500, cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    const serif = getComputedStyle(document.documentElement).getPropertyValue('--serif');
    g.fillStyle = '#efe6d2'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#26221d'; g.textAlign = 'center'; g.font = `700 44px ${serif}`;
    g.fillText(p === 1 ? '도산십이곡 · 언지 병풍' : '도산십이곡 · 언학의 길', W / 2, 70);
    const imgs = await Promise.all(list.map((x) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = `assets/sc/${x.scene.img}.webp`; })));
    // 병풍 틀
    const px = 60, py = 110, pw = (W - 120) / 6, ph = 560;
    g.fillStyle = '#5a3a22'; g.fillRect(px - 8, py - 8, W - 120 + 16, ph + 16);
    imgs.forEach((im, i) => {
      const x = px + i * pw;
      g.fillStyle = '#f8f2e4'; g.fillRect(x + 2, py, pw - 4, ph);
      if (im) {
        const s = Math.max((pw - 12) / im.width, (ph - 50) / im.height), dw = im.width * s, dh = im.height * s;
        g.save(); g.beginPath(); g.rect(x + 6, py + 6, pw - 12, ph - 50); g.clip();
        g.drawImage(im, x + 6 + (pw - 12 - dw) / 2, py + 6 + (ph - 50 - dh) / 2, dw, dh); g.restore();
      }
      g.fillStyle = '#26221d'; g.font = `700 22px ${serif}`; g.fillText(list[i].title, x + pw / 2, py + ph - 16);
    });
    // 낙관
    const sealT = st.sealed[p] ? gm.sealText(st.name) : '';
    if (sealT) {
      const s = 92, sx = px + 5 * pw + pw / 2 - s / 2, sy = py + ph - 170;
      g.fillStyle = 'rgba(248,242,228,.85)'; g.fillRect(sx, sy, s, s);
      g.strokeStyle = '#b3342a'; g.lineWidth = 6; g.strokeRect(sx, sy, s, s);
      g.fillStyle = '#b3342a'; g.font = `700 ${sealT.length > 2 ? 32 : sealT.length === 2 ? 38 : 56}px ${serif}`; g.textBaseline = 'middle';
      const ch = [...sealT];
      if (ch.length === 1) g.fillText(ch[0], sx + s / 2, sy + s / 2);
      else if (ch.length === 2) { g.fillText(ch[0], sx + s / 2, sy + s * 0.3); g.fillText(ch[1], sx + s / 2, sy + s * 0.72); }
      else ch.forEach((c2, i) => g.fillText(c2, sx + (i < 2 ? s * 0.72 : s * 0.28), sy + (i % 2 === 0 ? s * 0.3 : s * 0.72)));
      g.textBaseline = 'alphabetic';
    }
    g.fillStyle = '#26221d'; g.font = `700 28px ${serif}`; g.fillText(st.name || '(이름)', W / 2, py + ph + 56);
    // 마음 지도와 기록
    let y = py + ph + 110;
    g.textAlign = 'left'; g.font = `700 26px ${serif}`; g.fillStyle = '#1f7474'; g.fillText('마음 지도', 70, y); y += 12;
    g.font = `22px ${serif}`;
    list.forEach((x) => { y += 36; g.fillStyle = '#544a3e'; g.fillText(`${x.n}곡 ${x.key}`, 70, y); g.fillStyle = '#26221d'; g.fillText(st.mind[x.n] || '—', 400, y); });
    y += 60; g.font = `700 26px ${serif}`; g.fillStyle = '#1f7474'; g.fillText('공부 기록', 70, y); y += 12;
    g.font = `22px ${serif}`;
    gm.stats(p).forEach(([k, v]) => { y += 36; g.fillStyle = '#544a3e'; g.fillText(k, 70, y); g.fillStyle = '#26221d'; g.textAlign = 'right'; g.fillText(v, W - 70, y); g.textAlign = 'left'; });
    cv.toBlob((blob) => {
      if (!blob) { G.ui.toast('이 기기에서는 저장이 안 돼요. 화면을 캡처해 주세요.'); return; }
      const a = h('a', { href: URL.createObjectURL(blob), download: `도산십이곡_${p}부_${st.name || '이름'}.png` });
      document.body.appendChild(a); a.click(); a.remove();
    }, 'image/png');
  };
})();
