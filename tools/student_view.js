// 학생이 보는 순서 그대로 게임의 글을 뽑는다(검토·블라인드 풀이용).
//   node tools/student_view.js   → design/review/student_view.md(정답 없음), design/review/answer_key.md
// 보기·카드의 순서는 게임과 같은 방식(G.util.shuffleNot, 같은 seed)으로 섞는다.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const ctx = { console };
ctx.window = ctx;
ctx.document = { createElement: () => ({}), createTextNode: () => ({}), documentElement: { classList: { contains: () => false } } };
vm.createContext(ctx);
for (const f of ['js/core/util.js', 'js/core/text.js', 'js/data/songs.js', 'js/data/notes.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
const { G, SONGS, INTRO, RECALL } = ctx;
const U = G.util;
// 화면 글: 옛한글 조합, {漢字|한글} → 漢字(한글), **굵게** 유지
const T = (s) => U.yet(String(s || '')).replace(/\{([^|}]+)\|([^}]+)\}/g, '$1($2)').replace(/_(.+?)_/g, '__$1__');
const N = '①②③④⑤⑥⑦⑧';
const view = [], key = [];
let q = 0;
const Q = (song) => `Q${++q}` + (song ? `(${song}곡)` : '');

function beats(list, song) {
  const seed = song ? song.n : 1;
  for (const b of list || []) {
    if (b.do === 'voice') view.push(`> **${ctx.VOICES[b.who].name}**${ctx.VOICES[b.who].fiction ? '(게임 설정)' : ''}: ${T(b.text)}`);
    else if (b.do === 'say') view.push(`_안내_: ${T(b.text)}`);
    else if (b.do === 'card') view.push(`[카드 · ${b.title}] ${T(b.body).replace(/\n/g, ' / ')}${b.real ? ' / 실제로는 → ' + T(b.real) : ''}`);
    else if (b.do === 'img') view.push(`(그림) ${T(b.cap)}`);
    else if (b.do === 'lens') view.push(`[마음의 눈 이름표] ${b.text ? T(b.text) + ' — ' : ''}${(b.labels || []).map((l) => T(l.t) + (l.sub ? '(' + T(l.sub) + ')' : '')).join(' · ')}`);
    else if (b.do === 'sil') view.push(`(장면) ${T(b.text)}`);
    else if (b.do === 'fill') view.push(`(원문의 빈칸이 채워짐: ${T(song.words[b.id].orig)})`);
    else if (b.do === 'fx') view.push(`(효과: ${b.name})`);
    else if (b.do === 'choose') {
      const id = Q(song && song.n);
      const opts = b.keepOrder ? b.options : U.shuffleNot(b.options, seed);
      view.push(`**${id}** ${b.free ? '(채점 안 함) ' : ''}${T(b.q)}`);
      opts.forEach((o, i) => view.push(`  ${N[i]} ${T(o.t)}`));
      key.push(`${id} ${b.free ? '채점 안 함' : N[opts.findIndex((o) => o.ok)] + ' ' + T(opts.find((o) => o.ok).t)}`);
      if (b.after) view.push(`  (답한 뒤 나오는 설명) [${T(b.after.title)}] ${T(b.after.body).replace(/\n/g, ' / ')}`);
    } else if (b.do === 'batch' || b.do === 'scales') {
      const id = Q(song && song.n);
      let rows = b.rows, pool = b.pool;
      if (b.do === 'scales') {
        const items = b.items.map((it, i) => ({ id: 'i' + i, text: it.t, side: it.side }));
        const side = (sd, p) => items.filter((x) => x.side === sd).map((x, k) => ({ id: p + k, answer: x.id, label: '구절' }));
        rows = [{ head: b.left, slots: side('L', 'l') }, { head: b.right, slots: side('R', 'r') }];
        pool = items;
        view.push(`_안내_: ${T(b.q)}`);
      }
      if (b.text) view.push(`_안내_: ${T(b.text)}`);
      const sp = U.shuffleNot(pool, b.do === 'scales' ? 12 : seed);
      view.push(`**${id}** [잇기 — 칸을 모두 채워야 확정] ${b.title || ''}${b.veil === 'aid' ? ' (이 문항 동안 원문 아래 풀이·현대 표기가 가려짐. 원문만 보임)' : ''}${b.do === 'scales' ? ' (같은 접시 안의 칸 순서는 상관없음)' : ''}`);
      const letters = 'ㄱㄴㄷㄹㅁㅂㅅㅇ';
      rows.forEach((r) => view.push(`  - ${T(r.head)} ${r.slots.map((s) => `→ [${T(s.label || '빈칸')}]`).join(' ')}`));
      view.push(`  카드: ${sp.map((p, i) => `(${letters[i]}) ${T(p.text)}`).join('  ')}`);
      key.push(`${id} ` + rows.map((r) => `${T(r.head)} → ` + r.slots.map((s) => `(${letters[sp.findIndex((p) => p.id === s.answer)]}) ${T(pool.find((p) => p.id === s.answer).text)}`).join(' / ')).join(' ; '));
      if (b.after) view.push(`  (답한 뒤 나오는 설명) [${T(b.after.title)}] ${T(b.after.body).replace(/\n/g, ' / ')}`);
    } else if (b.do === 'sort') {
      const id = Q(song && song.n);
      const items = b.keepOrder ? b.items : U.shuffleNot(b.items, song ? song.n : 3);
      view.push(`**${id}** [가르기 — 모두 골라야 확정] ${T(b.q)} (고를 칸: ${b.bins.map((x) => T(x.t)).join(' / ')})`);
      if (b.legend) b.legend.forEach((t) => view.push(`  · ${T(t)}`));
      items.forEach((it, i) => view.push(`  ${N[i]} ${T(it.t)}`));
      key.push(`${id} ` + items.map((it, i) => `${N[i]} ${T(b.bins.find((x) => x.id === it.bin).t)}`).join(' · '));
      if (b.after) view.push(`  (답한 뒤 나오는 설명) [${T(b.after.title)}] ${T(b.after.body).replace(/\n/g, ' / ')}`);
    } else if (b.do === 'order') {
      const id = Q(song && song.n);
      const items = b.items.map((t, i) => ({ t, i }));
      const sh = U.shuffleNot(items, 5);
      view.push(`**${id}** [차례 세우기${b.veil ? ' — 원문은 가려져 있음' : ''}] ${T(b.q)}`);
      sh.forEach((it, i) => view.push(`  ${N[i]} ${T(it.t)}`));
      key.push(`${id} ` + items.map((it) => N[sh.findIndex((x) => x.i === it.i)]).join(' → '));
      if (b.after) view.push(`  (답한 뒤 나오는 설명) [${T(b.after.title)}] ${T(b.after.body).replace(/\n/g, ' / ')}`);
    } else if (b.do === 'fork') {
      view.push(`**${Q(song && song.n)}** (채점 안 함) ${T(b.q)} ① ${T(b.shiny)} ② ${T(b.humble)}`);
      key.push(`Q${q} 채점 안 함(반짝이는 길을 고르면 한 바퀴 돌아 제자리)`);
    } else if (b.do === 'recall') {
      const id = Q();
      const sp = U.shuffleNot(RECALL.map((r) => ({ id: 'k' + r.n, text: G.text.reading(r.tail, {}) })), 6);
      view.push(`**${id}** [잇기] 1부 되짚기: 초장을 보고 그 곡의 종장 머리(첫 두 음보)를 고르세요.`);
      RECALL.forEach((r) => view.push(`  - ${r.n}곡 · ${G.text.reading(r.head, {})} → [종장 머리]`));
      view.push(`  카드: ${sp.map((p, i) => `(${'ㄱㄴㄷㄹㅁㅂ'[i]}) ${p.text}`).join('  ')}`);
      key.push(`${id} ` + RECALL.map((r) => `${r.n}곡 (${'ㄱㄴㄷㄹㅁㅂ'[sp.findIndex((p) => p.id === 'k' + r.n)]})`).join(' '));
    }
  }
}

view.push('# 학생 화면 대본 (처음 읽기)', '', '게임 화면에 나오는 글을 나오는 순서대로 옮겼다. 보기 순서는 게임과 같다. **(답한 뒤 나오는 설명)**은 그 문항에 답한 다음에야 보인다.', '');
key.push('# 정답표', '');
view.push('## 1부 도입'); beats(INTRO[1], null); view.push('');
for (const s of SONGS) {
  if (s.n === 7) { view.push('## 2부 도입'); beats(INTRO[2], null); view.push(''); }
  view.push(`## ${s.title} (${s.part === 1 ? '언지' : '언학'}) — 장소: ${s.place ? s.place.t : ''}`);
  view.push('**원문**(먹 번진 칸 = ▢, 아래 줄은 풀이. (  ?  )는 아직 되살리지 않은 시어의 뜻 — 시어를 넣으면 드러남)');
  s.text.forEach((line, li) => {
    const shown = line.replace(/@([a-z0-9_]+)/g, '▢');
    view.push(`- ${['초장', '중장', '종장'][li]}: ${T(shown)}`);
    // 게임에서는 시어를 되살리기 전까지 풀이의 밑줄 친 뜻이 가려진다
    view.push(`  - 풀이: ${T(s.gloss[li].replace(/_(.+?)_/g, '(  ?  )'))}`);
  });
  const ids = Object.keys(s.words).filter((id) => !s.words[id].ri);
  view.push(`**景 보기**: 풍경에서 찾으면 나오는 시어 카드 — ${ids.map((id) => `${T(s.words[id].orig)}: ${T(s.words[id].gloss)}`).join(' / ')}`);
  const id = Q(s.n);
  view.push(`**${id}** 위 카드를 원문의 ▢에 넣기(▢가 여러 개면 알맞은 칸에).`);
  key.push(`${id} ` + ids.map((w) => T(s.words[w].orig)).join(', ') + ' — 원문 차례대로');
  view.push('(시어를 칸에 넣으면 풀이의 (  ?  )가 드러남: ' + s.gloss.map((g) => T(g)).join(' / ') + ')');
  view.push('**理 읽기**');
  beats(s.ri, s);
  const specs = s.feet.map((f) => G.text.feet(f));
  const lines = s.cutLines;
  const fid = Q(s.n);
  view.push(`**${fid}** [음보 끊기] 띄어쓰기 없는 ${lines.length === 3 ? '세 장' : '종장'}에 음보 빗금(/)을 넣으세요. 화면의 규칙 띠: 한 장은 네 마디(4음보) · 한 마디는 대개 3~4글자 · 조사·어미는 앞말에 붙여요 · 종장: 첫 마디 3글자 · 둘째 마디 5글자 이상. (틀린 틈을 누르면 "낱말이 둘로 갈라져요" 또는 "이 두 말은 한 마디로 붙여 불러요"라고 알려 줌)`);
  lines.forEach((li) => view.push(`  - ${['초장', '중장', '종장'][li]}: ${specs[li].syl.join('')}`));
  key.push(`${fid} ` + lines.map((li) => s.feet[li].replace(/\|/g, '(|)').replace(/\{([^|}]+)\|([^}]+)\}/g, '$2')).map((x) => U.yet(x)).join(' ; ') + '   ((|)는 끊어도 안 끊어도 됨)');
  const mid = Q(s.n);
  const mo = U.shuffleNot(s.mind.options, s.n);
  view.push(`**${mid}** 이 노래에 담긴 화자의 마음을 한마디로 고른다면? 다른 곡의 마음도 섞여 있으니 종장까지 떠올려 보세요. ${mo.map((o, i) => `${N[i]} ${T(o.t)}`).join('  ')}`);
  key.push(`${mid} ${N[mo.findIndex((o) => o.ok)]} ${mo.find((o) => o.ok).t}`);
  view.push(`(곡 완성 요약) ${T(s.summary)}`, '');
}
const out = path.join(root, 'design', 'review');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'student_view.md'), view.join('\n') + '\n');
fs.writeFileSync(path.join(out, 'answer_key.md'), key.join('\n') + '\n');
console.log('문항', q, '개');
