'use strict';
// 곡 한 편의 단계: 景 보기(시어 되살리기) → 理 읽기(곡마다 다른 기믹, gimmicks.js) → 음보 끊기 → 노래 → 곡 완성
// 단계 함수는 모두 async이고, 끝나면 돌아온다. 화면 부품(kit)은 기믹에서도 같이 쓴다.
(function () {
  const { h, $, $$, wait, yet, shuffleNot } = G.util;
  const S = () => G.save.state;
  const review = () => S().mode === 'review';
  const kit = (G.kit = {});
  const steps = (G.steps = {});

  // ───────── 공용 부품 ─────────

  // 안내 한 줄(무엇을 하면 되는지)
  kit.say = function (box, text, cls = '') {
    const el = h('p.ask' + (cls ? '.' + cls : ''), G.util.boldNodes(yet(text)));
    box.appendChild(el);
    return el;
  };
  // 인물 말풍선. who: 'toegye' | 'child' | 'doctor' …(notes.js의 VOICES)
  kit.voice = function (box, who, text) {
    const v = VOICES[who] || { name: who };
    const el = h('div.voice' + (v.fiction ? '.fic' : ''),
      v.img ? h('img', { src: 'assets/pt/' + v.img + '.webp', alt: '' }) : h('span.face', v.name[0]),
      h('div.bubble', h('b', v.name, v.fiction ? h('span.tag.fiction', '게임 설정') : v.real ? h('span.tag.real', '실존 인물') : null), h('span', G.util.boldNodes(yet(text)))));
    box.appendChild(el);
    return el;
  };
  // 버튼 하나를 누를 때까지 기다린다
  kit.next = function (box, label = '다음 ▶', cls = 'primary') {
    return new Promise((res) => {
      const b = h('button.btn.' + cls, { type: 'button', on: { click: () => { G.audio.tap(); b.remove(); res(); } } }, label);
      box.appendChild(h('div.next-row', b));
      setTimeout(() => b.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 60);
    });
  };
  // 알림 카드를 넣고(게임 설정 카드는 한 번만) 확인을 기다린다
  kit.card = async function (box, c, opt = {}) {
    if (c.kind === 'fiction' && c.id && S().seenFiction[c.id] && !opt.always) return;
    const el = G.ui.card(c);
    box.appendChild(el);
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    if (c.kind === 'fiction' && c.id) { S().seenFiction[c.id] = true; G.save.write(); }
    if (opt.wait !== false) await kit.next(box, opt.label || '알겠어요');
    return el;
  };

  // 시어 카드(원문 표기 + 한글 읽기 + 풀이)
  kit.wordCard = function (song, id, opt = {}) {
    const w = song.words[id];
    const el = h('button.wcard', { type: 'button', dataset: { id } },
      h('span.han', G.text.render(w.orig, { hanja: S().hanja, words: song.words })),
      opt.gloss === false ? null : h('span.gl', yet(w.gloss)));
    return el;
  };

  // 끌어다 놓기 + 눌러서 고르기/놓기를 함께 쓰는 판
  //  pool: 카드 요소들, targets: 놓을 칸 요소들(data-accept에 맞는 카드 id)
  //  onDrop(card, target) → true면 놓음(카드를 치움), false면 되돌림
  kit.dnd = function (root, onDrop) {
    let sel = null, drag = null;
    const clear = () => { if (sel) sel.classList.remove('sel'); sel = null; root.classList.remove('picking'); };
    const pick = (card) => { if (sel === card) return clear(); clear(); sel = card; card.classList.add('sel'); root.classList.add('picking'); G.audio.pick(); };
    const drop = (card, target) => { const ok = onDrop(card, target); clear(); return ok; };
    root.addEventListener('click', (e) => {
      const card = e.target.closest('.wcard, .chip');
      const target = e.target.closest('.drop');
      if (card && !card.disabled && !target) { pick(card); return; }
      if (target && sel) { drop(sel, target); }
    });
    // 끌기(손가락·마우스). 조금 움직여야 끌기로 본다(누르기와 구분)
    root.addEventListener('pointerdown', (e) => {
      const card = e.target.closest('.wcard, .chip');
      if (!card || card.disabled || e.button > 0) return;
      const sx = e.clientX, sy = e.clientY;
      let ghost = null;
      const move = (ev) => {
        if (!ghost && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 8) return;
        if (!ghost) {
          ghost = card.cloneNode(true); ghost.classList.add('drag-ghost');
          const r = card.getBoundingClientRect();
          Object.assign(ghost.style, { width: r.width + 'px', left: r.left + 'px', top: r.top + 'px' });
          ghost.dataset.dx = sx - r.left; ghost.dataset.dy = sy - r.top;
          document.body.appendChild(ghost); card.classList.add('lifted');
          drag = card;
        }
        ghost.style.left = ev.clientX - ghost.dataset.dx + 'px';
        ghost.style.top = ev.clientY - ghost.dataset.dy + 'px';
        // 판 가장자리로 끌면 판을 굴려 가려진 칸까지 닿게 한다
        const rr = root.getBoundingClientRect();
        if (root.scrollHeight > root.clientHeight) {
          if (ev.clientY < rr.top + 48) root.scrollTop -= 14;
          else if (ev.clientY > rr.bottom - 48) root.scrollTop += 14;
        }
        $$('.drop.over', root).forEach((d) => d.classList.remove('over'));
        const under = document.elementFromPoint(ev.clientX, ev.clientY);
        const t = under && under.closest('.drop');
        if (t && root.contains(t)) t.classList.add('over');
      };
      const up = (ev) => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
        if (!ghost) return;
        ghost.remove(); card.classList.remove('lifted');
        $$('.drop.over', root).forEach((d) => d.classList.remove('over'));
        const under = document.elementFromPoint(ev.clientX, ev.clientY);
        const t = under && under.closest('.drop');
        if (t && root.contains(t)) drop(card, t);
        drag = null;
        // 끌기 뒤에 따라오는 click을 한 번 막는다
        const stop = (ce) => { ce.stopPropagation(); ce.preventDefault(); };
        card.addEventListener('click', stop, { capture: true, once: true });
        setTimeout(() => card.removeEventListener('click', stop, { capture: true }), 50);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    });
    return { clear, get selected() { return sel; } };
  };

  // 묶음 확정(Obra Dinn 방식): 칸을 모두 채운 뒤 [확정]. 몇 개가 맞았는지만 알려 주고,
  // 두 번 틀리면 틀린 칸을 표시한다. 세 번째부터는 [정답 보기]가 생긴다.
  //  rows: [{ head: 요소|문자열, slots:[{ id, answer, label? }] }], pool: [{ id, text, sub? }]
  //  opt: { song, kind, title, confirm }
  kit.batch = function (box, rows, pool, opt = {}) {
    return new Promise((resolve) => {
      const wrap = h('div.batch');
      const board = h('div.rows');
      const placed = {};
      const slotEls = {};
      for (const r of rows) {
        const row = h('div.brow');
        if (r.head) row.appendChild(typeof r.head === 'string' ? h('span.head', G.util.boldNodes(yet(r.head))) : r.head);
        for (const s of r.slots) {
          if (s.pre) row.appendChild(h('span.arrow', yet(s.pre)));
          const el = h('button.drop.slot', { type: 'button', dataset: { slot: s.id }, 'aria-label': s.label || '빈칸' }, s.label ? h('span.ph', yet(s.label)) : '');
          slotEls[s.id] = el;
          row.appendChild(el);
        }
        board.appendChild(row);
      }
      const chips = h('div.pool');
      const chipOf = {};
      for (const c of shuffleNot(pool, opt.seed)) {
        const el = h('button.chip', { type: 'button', dataset: { id: c.id } }, h('span', G.util.boldNodes(yet(c.text))), c.sub ? h('small', yet(c.sub)) : null);
        chipOf[c.id] = el;
        chips.appendChild(el);
      }
      const msg = h('p.msg');
      const confirm = h('button.btn.seal', { type: 'button', disabled: true }, opt.confirm || '확정하기');
      const reveal = h('button.btn.ghost.small', { type: 'button', hidden: true }, '정답 보기');
      wrap.append(board, h('div.pool-label', '카드'), chips, msg, h('div.next-row', reveal, confirm));
      box.appendChild(wrap);
      const allFull = () => Object.keys(slotEls).every((k) => placed[k]);
      const put = (chip, slot) => {
        const id = slot.dataset.slot;
        if (placed[id]) { chipOf[placed[id]].hidden = false; }
        // 같은 카드가 다른 칸에 있었으면 빼 온다
        for (const k in placed) if (placed[k] === chip.dataset.id) { delete placed[k]; slotEls[k].classList.remove('full'); slotEls[k].innerHTML = ''; }
        placed[id] = chip.dataset.id;
        slot.classList.add('full'); slot.classList.remove('bad');
        slot.innerHTML = '';
        slot.appendChild(h('span.in', G.util.boldNodes(yet(pool.find((p) => p.id === chip.dataset.id).text))));
        chip.hidden = true;
        G.audio.brush();
        confirm.disabled = !allFull();
        msg.textContent = '';
        opt.onChange && opt.onChange(placed);
        return true;
      };
      // 채운 칸을 누르면 카드를 되돌린다
      board.addEventListener('click', (e) => {
        const slot = e.target.closest('.slot.full');
        if (!slot || dnd.selected) return;
        const id = slot.dataset.slot;
        chipOf[placed[id]].hidden = false;
        delete placed[id]; slot.classList.remove('full', 'bad'); slot.innerHTML = '';
        const s = rows.flatMap((r) => r.slots).find((x) => x.id === id);
        if (s && s.label) slot.appendChild(h('span.ph', yet(s.label)));
        confirm.disabled = true;
        opt.onChange && opt.onChange(placed);
      });
      const dnd = kit.dnd(wrap, (card, target) => target.classList.contains('slot') ? put(card, target) : false);
      let tries = 0;
      const answers = rows.flatMap((r) => r.slots);
      confirm.addEventListener('click', async () => {
        tries++;
        const bad = answers.filter((s) => placed[s.id] !== s.answer && !(s.alt || []).includes(placed[s.id]));
        if (opt.song) { if (tries === 1) G.save.stat(opt.song.n, opt.kind || 'ri', bad.length === 0); }
        if (!bad.length) {
          G.audio.ok();
          $$('.slot', board).forEach((s) => { s.classList.add('good'); s.disabled = true; });
          chips.remove(); confirm.remove(); reveal.remove(); msg.remove();
          G.save.write();
          resolve({ tries, placed });
          return;
        }
        G.audio.no();
        G.ui.shake(board);
        const ok = answers.length - bad.length;
        if (opt.song && tries === 1) G.save.wrong(opt.song.n, opt.kind || 'ri', opt.wrongNote || (opt.title || '이치 잇기') + ` (${opt.song.n}곡)`);
        if (tries >= 2) {
          bad.forEach((s) => slotEls[s.id].classList.add('bad'));
          msg.textContent = `${answers.length}칸 가운데 ${ok}칸이 맞아요. 붉게 번진 칸을 다시 생각해 보세요.`;
        } else msg.textContent = `${answers.length}칸 가운데 ${ok}칸이 맞아요. 어느 칸이 틀렸는지는 아직 알려 주지 않아요.`;
        if (tries >= 3 || S().teacher) reveal.hidden = false;
        G.save.state.helped += tries >= 2 ? 1 : 0;
      });
      reveal.addEventListener('click', () => {
        for (const s of answers) { const c = chipOf[s.answer]; if (c) put(c, slotEls[s.id]); }
        G.save.state.helped++;
        confirm.disabled = false;
        confirm.click();
      });
      if (S().teacher) reveal.hidden = false;
    });
  };

  // 하나 고르기. options: [{ t, ok?, why? }]. 채점하지 않는 질문은 opt.free = true
  kit.choose = function (box, q, options, opt = {}) {
    return new Promise((resolve) => {
      const wrap = h('div.choose');
      if (q) wrap.appendChild(h('p.q', G.util.boldNodes(yet(q))));
      const list = h('div.opts');
      const why = h('p.why');
      let tries = 0;
      const order = opt.keepOrder ? options : shuffleNot(options, opt.seed);
      for (const o of order) {
        const b = h('button.opt', { type: 'button' }, G.util.boldNodes(yet(o.t)));
        b.addEventListener('click', async () => {
          if (wrap.classList.contains('done')) return;
          tries++;
          if (opt.free) {
            G.audio.pick();
            $$('.opt', list).forEach((x) => x.classList.remove('picked'));
            b.classList.add('picked');
            wrap.classList.add('done');
            if (o.why) { why.innerHTML = ''; why.appendChild(G.util.boldNodes(yet(o.why))); }
            resolve({ picked: o, tries });
            return;
          }
          if (opt.song && tries === 1) G.save.stat(opt.song.n, opt.kind || 'ri', !!o.ok);
          if (o.ok) {
            G.audio.ok();
            b.classList.add('good');
            wrap.classList.add('done');
            $$('.opt', list).forEach((x) => { x.disabled = true; });
            why.innerHTML = '';
            if (o.why) why.appendChild(G.util.boldNodes(yet(o.why)));
            G.save.write();
            resolve({ picked: o, tries });
          } else {
            G.audio.no();
            b.classList.add('bad'); b.disabled = true;
            G.ui.shake(b);
            why.innerHTML = '';
            if (o.why) why.appendChild(G.util.boldNodes(yet(o.why)));
            if (opt.song && tries === 1) G.save.wrong(opt.song.n, opt.kind || 'ri', opt.wrongNote || yet(q || '') + ` (${opt.song.n}곡)`);
          }
        });
        list.appendChild(b);
      }
      wrap.append(list, why);
      box.appendChild(wrap);
      wrap.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  };

  // ───────── 원문 판(시) ─────────
  // 곡 원문을 초·중·종장으로 그린다. 시어 칸은 아직 되살리지 않았으면 먹 번짐(.blank)
  kit.poem = function (song, opt = {}) {
    const leaf = h('div.leaf.poem');
    const aid = () => (S().mode === 'review' ? 'none' : S().aid || 'gloss'); // 원문 아래 한 줄: 풀이 / 현대 표기 / 없음
    const aidBtn = h('button.aid-btn', { type: 'button', title: '원문 아래 줄 바꾸기' });
    const setAid = () => {
      const a = aid();
      aidBtn.textContent = a === 'gloss' ? '풀이' : a === 'modern' ? '현대 표기' : '원문만';
      $$('.gloss', leaf).forEach((g) => { g.hidden = a !== 'gloss'; });
      $$('.modern', leaf).forEach((g) => { g.hidden = a !== 'modern'; });
    };
    aidBtn.addEventListener('click', () => {
      const order = ['gloss', 'modern', 'none'];
      S().aid = order[(order.indexOf(aid()) + 1) % 3]; G.save.write(); G.audio.tap(); setAid();
    });
    leaf.appendChild(h('div.poem-head', h('span.seal-mark', '原文'), h('span.num', yet(song.title)), h('span.kind', song.part === 1 ? '언지(言志)' : '언학(言學)'), S().mode === 'review' ? null : aidBtn));
    const lines = [];
    const slots = {};
    song.text.forEach((line, li) => {
      const row = h('div.jang', { dataset: { li } }, h('span.jl', ['초장', '중장', '종장'][li]));
      const body = G.text.render(line, {
        hanja: S().hanja, words: song.words,
        slot: (id) => {
          const filled = opt.filled && opt.filled(id);
          const riWord = song.words[id].ri;
          const el = h('span.drop.blank' + (filled ? '.filled' : '') + (riWord ? '.ri' : ''), { dataset: { accept: id }, role: 'button', tabindex: filled || riWord ? -1 : 0, 'aria-label': filled ? '' : '먹이 번진 칸' },
            filled ? G.text.render(song.words[id].orig, { hanja: S().hanja, words: song.words }) : h('span.inkblot', '　'.repeat(Math.min(4, G.text.syllables(G.text.reading(song.words[id].orig, song.words)).length))));
          (slots[id] = slots[id] || []).push(el);
          return el;
        },
      });
      row.appendChild(h('span.jt', body));
      if (song.gloss && song.gloss[li]) {
        const g = h('span.gloss');
        g.innerHTML = G.util.bold(yet(song.gloss[li])).replace(/_(.+?)_/g, '<u>$1</u>');
        row.appendChild(g);
      }
      if (song.modern && song.modern[li]) row.appendChild(h('span.modern', song.modern[li]));
      leaf.appendChild(row);
      lines.push(row);
    });
    setAid();
    leaf.fill = function (id) {
      for (const el of slots[id] || []) {
        el.classList.add('filled', 'just');
        el.innerHTML = '';
        el.appendChild(G.text.render(song.words[id].orig, { hanja: S().hanja, words: song.words }));
        el.removeAttribute('aria-label'); el.tabIndex = -1;
        setTimeout(() => el.classList.remove('just'), 1400);
      }
    };
    leaf.slots = slots;
    leaf.lines = lines;
    return leaf;
  };

  // ───────── 景 보기: 풍경 속 시어 찾기 → 원문 빈칸에 넣기 ─────────
  steps.kyeong = async function (c) {
    const { song, scene, poem, task } = c;
    const ids = Object.keys(song.words).filter((id) => song.words[id].spot && !song.words[id].ri);
    const key = (id) => song.n + '-' + id;
    const found = new Set(ids.filter((id) => S().found[key(id)] === 'found' || S().found[key(id)] === 'placed'));
    const placed = new Set(ids.filter((id) => S().found[key(id)] === 'placed'));
    task.innerHTML = '';
    kit.say(task, song.kyeong || `풍경에서 노래에 나오는 것을 찾아 눌러 보세요. 찾은 시어 카드를 원문의 **먹 번진 칸**에 넣으면 색이 돌아와요.`);
    const count = h('p.count');
    const tray = h('div.tray');
    task.append(count, tray);
    const upd = () => { count.textContent = `찾은 것 ${found.size} / ${ids.length} · 넣은 것 ${placed.size} / ${ids.length}`; };
    const cardEls = {};
    const addCard = (id, fly) => {
      const el = kit.wordCard(song, id, { gloss: !review() });
      cardEls[id] = el;
      tray.appendChild(el);
      if (fly) {
        const [x, y] = scene.pointOf(id), r = el.getBoundingClientRect();
        el.animate([{ transform: `translate(${x - r.left - r.width / 2}px, ${y - r.top - r.height / 2}px) scale(.4)`, opacity: 0.2 }, { transform: 'none', opacity: 1 }], { duration: 520, easing: 'cubic-bezier(.2,.8,.2,1)' });
      }
    };
    for (const id of found) if (!placed.has(id)) addCard(id);
    scene.revealNow([...found]);
    scene.setSpots(ids.map((id) => Object.assign({ id, label: '풍경 속 한 곳', season: song.words[id].season }, song.words[id].spot)));
    for (const s of scene.spots) if (found.has(s.id)) s.btn.classList.add('got');
    upd();
    // 계절 바퀴: 같은 구도의 봄·가을밤 그림을 오가며 찾는다
    const seasons = song.scene.seasons;
    let season = null;
    const setSeason = async (k) => {
      if (season === k) return;
      season = k;
      G.audio.page();
      wheel && $$('.sw', wheel).forEach((b) => b.classList.toggle('on', b.dataset.k === k));
      wheel && wheel.style.setProperty('--rot', k === 'spring' ? '0deg' : '180deg');
      await scene.setImages(`assets/sc/${seasons[k]}.webp`, `assets/sc/${seasons[k]}_f.webp`);
      scene.filterSpots((sp) => !sp.season || sp.season === k);
    };
    let wheel = null;
    if (seasons) {
      wheel = h('div.season-wheel', h('div.dial'),
        h('button.sw', { type: 'button', dataset: { k: 'spring' }, on: { click: (e) => { e.stopPropagation(); setSeason('spring'); } } }, '봄'),
        h('button.sw', { type: 'button', dataset: { k: 'autumn' }, on: { click: (e) => { e.stopPropagation(); setSeason('autumn'); } } }, '가을밤'));
      scene.root.appendChild(wheel);
      await setSeason('spring');
    }
    let misses = 0, sinceFind = Date.now();

    return new Promise((resolve) => {
      const finish = async () => {
        c.helpFn = null;
        await wait(500);
        if (wheel) { wheel.remove(); if (season !== 'spring') { season = null; await setSeason('spring'); } scene.filterSpots(null); }
        resolve();
      };
      const tryDone = () => { if (placed.size === ids.length) finish(); };
      c.onSpot = (sp) => {
        if (found.has(sp.id)) { G.ui.pop(sp.btn, `<b>${G.util.esc(yet(G.text.reading(song.words[sp.id].orig, song.words)))}</b> — 이미 찾았어요`); return; }
        found.add(sp.id);
        S().found[key(sp.id)] = 'found'; G.save.write();
        sp.btn.classList.add('got');
        scene.reveal(sp.id);
        G.audio.found();
        addCard(sp.id, true);
        sinceFind = Date.now();
        upd();
        if (found.size === 1 && placed.size === 0) G.ui.toast('시어 카드를 원문의 빈칸으로 옮기세요', 2600);
      };
      c.onMiss = () => {
        misses++;
        if (misses === 4 && found.size < ids.length) G.ui.toast('막히면 오른쪽 위 「여백 메모」를 눌러 보세요', 2600);
      };
      const tryWrong = {};
      kit.dnd(c.panel, (card, target) => {
        if (!target.classList.contains('blank') || target.classList.contains('filled')) return false;
        const id = card.dataset.id, want = target.dataset.accept;
        const first = !tryWrong[id];
        if (id === want) {
          if (first) G.save.stat(song.n, 'word', true);
          placed.add(id);
          S().found[key(id)] = 'placed'; G.save.write();
          poem.fill(id);
          card.remove();
          G.audio.ok();
          upd();
          tryDone();
          return true;
        }
        tryWrong[id] = (tryWrong[id] || 0) + 1;
        if (first) { G.save.stat(song.n, 'word', false); G.save.wrong(song.n, 'word', `${yet(G.text.reading(song.words[id].orig, song.words))}(${song.words[id].gloss})의 자리 (${song.n}곡)`); }
        G.audio.no();
        G.ui.shake(target);
        target.classList.add('smudge');
        setTimeout(() => target.classList.remove('smudge'), 900);
        if (tryWrong[id] >= 2) {
          const w = song.words[id];
          G.ui.pop(card, `<b>${G.util.esc(yet(G.text.reading(w.orig, song.words)))}</b>는 「${G.util.esc(yet(w.gloss))}」라는 뜻이에요.${review() ? '' : ' 원문 아래 풀이에서 같은 뜻을 찾아보세요.'}`);
        }
        return false;
      });
      // 여백 메모(도움): 못 찾은 곳 → 먹 파문, 다 찾았으면 → 들어갈 칸을 깜빡임
      c.helpFn = () => {
        S().helped++; G.save.write();
        const left = ids.filter((id) => !found.has(id));
        if (left.length) {
          const s = scene.spots.find((p) => p.id === left[0]);
          if (seasons && s.season && s.season !== season) { setSeason(s.season); }
          scene.panTo(s.x, s.y);
          s.btn.classList.add('hinted');
          setTimeout(() => s.btn.classList.remove('hinted'), 3200);
          return `풍경 속 반짝이는 곳을 눌러 보세요. (${song.words[left[0]].hint || '노래에 나오는 자연물이 숨어 있어요'})`;
        }
        const id = ids.find((x) => !placed.has(x));
        if (id) {
          for (const el of poem.slots[id]) { el.classList.add('hinted'); setTimeout(() => el.classList.remove('hinted'), 3200); }
          return `깜빡이는 칸에 들어갈 시어를 찾아보세요.`;
        }
        return '';
      };
      if (S().teacher) {
        const tb = h('button.btn.ghost.small', { type: 'button', on: { click: () => {
          for (const id of ids) { if (!found.has(id)) c.onSpot(scene.spots.find((p) => p.id === id)); }
          for (const id of ids) if (!placed.has(id)) { placed.add(id); S().found[key(id)] = 'placed'; poem.fill(id); if (cardEls[id]) cardEls[id].remove(); }
          G.save.write(); upd(); tryDone();
        } } }, '선생님용: 정답 채우기');
        task.appendChild(h('div.next-row', tb));
      }
      if (placed.size === ids.length) finish();
    });
  };

  // ───────── 음보 끊기 → 노래 ─────────
  // song.feet: 장마다 음보 표기, song.cutLines: 학생이 끊을 장 번호(나머지는 미리 끊어 둔다)
  steps.foot = async function (c) {
    const { song, task } = c;
    task.innerHTML = '';
    const specs = song.feet.map((f, li) => {
      const sp = G.text.feet(f);
      // 원문의 띄어쓰기로 '낱말 가운데'를 가린다(틀린 곳을 누를 때 알려 주는 말이 달라진다)
      const plain = G.text.reading(song.text[li], song.words);
      const ends = G.text.wordEnds(plain);
      sp.inWord = new Set();
      for (let i = 0; i < sp.syl.length - 1; i++) if (!ends.has(i)) sp.inWord.add(i);
      if (G.text.syllables(plain).join('') !== sp.syl.join('')) console.warn('음보 표기와 원문이 달라요', song.n, li, plain, f);
      return sp;
    });
    const plan = G.audio.songPlan(specs.map((s) => s.feet));
    const todo = review() ? [0, 1, 2] : song.cutLines;
    const first = !S().steps['foot-intro'];
    kit.say(task, song.footAsk || (todo.length === 3
      ? '옛 판본에는 띄어쓰기가 없어요. 소리 내어 읽으며 **한 호흡(음보)이 끝나는 곳**의 틈을 눌러 빗금(/)을 그으세요. 맞게 끊을 때마다 그 마디가 노래가 돼요.'
      : '이번에는 **종장**만 끊어 보세요. 초장·중장은 미리 끊어 두었어요.'));
    const board = h('div.footboard');
    task.appendChild(board);
    const lineEls = [];
    let totalWrong = 0;
    const lineDone = specs.map((sp, li) => !todo.includes(li) || !!S().cut[song.n + '-' + li]);
    const on = {}; // 아래 Promise 안에서 채운다(틈 단추가 먼저 만들어지므로)

    specs.forEach((sp, li) => {
      const row = h('div.fline' + (lineDone[li] ? '.done' : ''), { dataset: { li } }, h('span.jl', ['초장', '중장', '종장'][li]));
      const syls = h('div.syls');
      const cutNow = new Set(lineDone[li] ? sp.cuts : []);
      let wrongHere = 0;
      sp.syl.forEach((s, i) => {
        syls.appendChild(h('span.syl', { dataset: { i } }, s));
        if (i < sp.syl.length - 1) {
          const gap = h('button.gap' + (cutNow.has(i) ? '.cut' : ''), { type: 'button', dataset: { i }, 'aria-label': `${i + 1}번째 글자 뒤`, disabled: lineDone[li] });
          gap.addEventListener('click', () => on.gap && on.gap(li, i, gap));
          syls.appendChild(gap);
        }
      });
      row.appendChild(syls);
      board.appendChild(row);
      lineEls.push({ row, syls, sp, cutNow, get wrong() { return wrongHere; }, addWrong() { wrongHere++; totalWrong++; } });
    });

    // 음보 번호: i번째 음절 뒤를 끊었을 때 막 끝난 음보
    const footIndex = (sp, i) => [...sp.cuts].filter((x) => x < i).length;
    const bounce = (L, fi) => {
      const sp = L.sp; let start = 0;
      const cuts = [...sp.cuts].sort((a, b) => a - b);
      for (let k = 0; k < fi; k++) start = cuts[k] + 1;
      const end = fi < cuts.length ? cuts[fi] : sp.syl.length - 1;
      const els = $$('.syl', L.syls).slice(start, end + 1);
      els.forEach((el, k) => setTimeout(() => { el.classList.remove('beat'); void el.offsetWidth; el.classList.add('beat'); }, k * 110));
    };

    return new Promise((resolve) => {
      on.gap = onGap;
      async function onGap(li, i, gap) {
        const L = lineEls[li];
        if (lineDone[li]) return;
        if (L.sp.cuts.has(i)) {
          if (L.cutNow.has(i)) return;
          L.cutNow.add(i);
          gap.classList.add('cut'); gap.disabled = true;
          G.audio.cut();
          const fi = footIndex(L.sp, i);
          G.audio.foot(plan, li, fi);
          bounce(L, fi);
          if (L.cutNow.size === L.sp.cuts.size) {
            lineDone[li] = true;
            L.row.classList.add('done');
            $$('.gap', L.syls).forEach((g) => { g.disabled = true; });
            G.save.stat(song.n, 'foot', L.wrong === 0);
            S().cut[song.n + '-' + li] = true; G.save.write();
            // 마지막 음보도 이어서 부른다
            setTimeout(() => { G.audio.foot(plan, li, L.sp.cuts.size); bounce(L, L.sp.cuts.size); }, Math.max(350, plan[li][fi].len * 1000));
            if (li === 2 && !S().steps['jong-rule']) {
              S().steps['jong-rule'] = true; G.save.write();
              await wait(1400);
              await kit.card(task, NOTES.jongRule);
            }
            if (lineDone.every(Boolean)) { await wait(900); done(); }
          }
        } else if (L.sp.opt.has(i)) {
          gap.classList.toggle('soft');
          G.audio.tap();
          G.ui.pop(gap, '여기는 끊어 읽어도, 이어 읽어도 괜찮은 곳이에요. 이 게임에서는 채점하지 않아요.');
        } else {
          L.addWrong();
          if (L.wrong === 1) G.save.wrong(song.n, 'foot', `${['초장', '중장', '종장'][li]}의 음보 나누기 (${song.n}곡)`);
          G.audio.no();
          gap.classList.add('miss');
          setTimeout(() => gap.classList.remove('miss'), 800);
          const inWord = isInsideWord(L.sp, i);
          G.ui.pop(gap, inWord ? '여기서 끊으면 낱말이 둘로 갈라져요. 조사·어미는 앞말에 붙여 한 마디로 불러요.' : '이 두 말은 한 마디로 붙여 불러요. 소리 내어 읽으며 숨을 쉬는 곳을 찾아보세요.');
          if (L.wrong >= 3) hintGap(L);
        }
      }
      function hintGap(L) {
        const nextCut = [...L.sp.cuts].sort((a, b) => a - b).find((x) => !L.cutNow.has(x));
        const g = $$('.gap', L.syls).find((x) => +x.dataset.i === nextCut);
        if (g) { g.classList.add('hinted'); setTimeout(() => g.classList.remove('hinted'), 3000); }
      }
      c.helpFn = () => {
        S().helped++; G.save.write();
        const L = lineEls.find((x, li) => !lineDone[li]);
        if (!L) return '';
        hintGap(L);
        return `이 장은 ${L.sp.cuts.size + 1}음보예요. 깜빡이는 틈을 눌러 보세요.`;
      };
      function done() {
        S().steps['foot-intro'] = true;
        c.helpFn = null;
        G.save.write();
        resolve({ plan, specs });
      }
      if (S().teacher) {
        task.appendChild(h('div.next-row', h('button.btn.ghost.small', { type: 'button', on: { click: () => {
          lineEls.forEach((L, li) => { if (lineDone[li]) return; for (const i of L.sp.cuts) { L.cutNow.add(i); const g = $$('.gap', L.syls).find((x) => +x.dataset.i === i); if (g) g.classList.add('cut'); } lineDone[li] = true; L.row.classList.add('done'); S().cut[song.n + '-' + li] = true; });
          done();
        } } }, '선생님용: 정답 채우기')));
      }
      if (lineDone.every(Boolean)) done();
    });
  };
  // i번째 음절 뒤가 낱말 가운데인지(원문 띄어쓰기로 판단)
  function isInsideWord(sp, i) {
    return !!sp.inWord && sp.inWord.has(i);
  }

  // 노래 부르기: 음보마다 글자가 번지며 가락이 흐른다(건너뛸 수 있음)
  steps.sing = async function (c, fp) {
    const { song, task } = c;
    task.innerHTML = '';
    kit.say(task, '끊은 음보대로 노래해 볼까요? 장구가 치는 곳이 음보의 시작이에요.');
    const board = h('div.footboard.singing');
    fp.specs.forEach((sp, li) => {
      const row = h('div.fline.done', h('span.jl', ['초장', '중장', '종장'][li]));
      const syls = h('div.syls');
      const cuts = [...sp.cuts].sort((a, b) => a - b);
      let fi = 0, foot = h('span.foot', { dataset: { li, fi } });
      sp.syl.forEach((s, i) => {
        foot.appendChild(h('span.syl', s));
        if (cuts.includes(i)) { syls.appendChild(foot); syls.appendChild(h('span.bar', '/')); fi++; foot = h('span.foot', { dataset: { li, fi } }); }
      });
      syls.appendChild(foot);
      if (li === 2) $('.foot', syls).classList.add('jong1');
      row.appendChild(syls);
      board.appendChild(row);
    });
    task.appendChild(board);
    const soundOff = !S().sound;
    if (soundOff) kit.say(task, '소리가 꺼져 있어요. 글자가 번지는 박을 눈으로 따라가 보세요.', 'muted');
    const skip = h('button.btn.ghost.small', { type: 'button' }, '건너뛰기');
    task.appendChild(h('div.next-row', skip));
    let singer;
    const light = (li, fi) => {
      $$('.foot.on', board).forEach((x) => x.classList.remove('on'));
      if (li < 0) return;
      const el = $(`.foot[data-li="${li}"][data-fi="${fi}"]`, board);
      if (el) { el.classList.add('on', 'sung'); }
    };
    if (soundOff) {
      // 소리 없이: 같은 박으로 글자만 번진다
      let t = 200;
      const timers = [];
      fp.plan.forEach((L, li) => L.forEach((f, fi) => { timers.push(setTimeout(() => light(li, fi), t)); t += f.len * 1000 + (fi === L.length - 1 ? 500 : 80); }));
      singer = { stop() { timers.forEach(clearTimeout); }, done: wait(t + 400) };
    } else singer = G.audio.sing(fp.plan, light);
    await Promise.race([singer.done, new Promise((r) => skip.addEventListener('click', r, { once: true }))]);
    singer.stop();
    light(-1);
    skip.remove();
  };
})();
