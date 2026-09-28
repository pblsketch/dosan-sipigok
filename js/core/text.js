'use strict';
// 원문 표기 읽기
//   {草野愚生|초야우생}  → 한자 위, 한글 읽기 아래(루비). 한자 끄기를 하면 한글만
//   [ㅎㆍ]              → 옛한글 음절(ᄒᆞ)
//   @choya             → 시어 칸(곡 데이터의 words.choya)
//   음보 표기: '/' = 음보 경계(꼭 끊을 곳), '|' = 끊어도 되고 안 끊어도 되는 곳
(function () {
  const { h, yet } = G.util;
  const T = (G.text = {});

  // 문자열 → 조각 [{k:'t', t}, {k:'r', han, rd}, {k:'w', id}]
  T.parse = function (s) {
    const out = [];
    const re = /\{([^|}]+)\|([^}]+)\}|@([a-z0-9_]+)/g;
    let last = 0, m;
    while ((m = re.exec(s))) {
      if (m.index > last) out.push({ k: 't', t: s.slice(last, m.index) });
      if (m[3]) out.push({ k: 'w', id: m[3] });
      else out.push({ k: 'r', han: m[1], rd: m[2] });
      last = re.lastIndex;
    }
    if (last < s.length) out.push({ k: 't', t: s.slice(last) });
    return out;
  };
  // 한글 읽기만(옛한글 조합 포함)
  T.reading = function (s, words) {
    return yet(T.parse(s).map((p) => p.k === 't' ? p.t : p.k === 'r' ? p.rd : words && words[p.id] ? T.reading(words[p.id].orig, words) : '').join(''));
  };
  // 한자 루비 요소
  T.ruby = function (han, rd, withHan) {
    if (!withHan) return h('span.rd', yet(rd));
    return h('ruby', yet(han), h('rt', yet(rd)));
  };
  // 조각들을 DOM으로. opt.slot(id) 이 있으면 시어 칸을 그 함수가 만든다
  T.render = function (s, opt = {}) {
    const withHan = opt.hanja !== false;
    const frag = h('span.orig-text');
    for (const p of T.parse(s)) {
      if (p.k === 't') frag.appendChild(document.createTextNode(yet(p.t)));
      else if (p.k === 'r') frag.appendChild(T.ruby(p.han, p.rd, withHan));
      else frag.appendChild(opt.slot ? opt.slot(p.id) : T.render(opt.words[p.id].orig, { hanja: withHan, words: opt.words }));
    }
    return frag;
  };

  // 음절 나누기: 첫가끝 자모열(옛한글)은 한 음절로 묶는다
  const isL = (c) => (c >= 0x1100 && c <= 0x115f) || (c >= 0xa960 && c <= 0xa97f);
  const isV = (c) => (c >= 0x1160 && c <= 0x11a7) || (c >= 0xd7b0 && c <= 0xd7c6);
  const isT = (c) => (c >= 0x11a8 && c <= 0x11ff) || (c >= 0xd7cb && c <= 0xd7fb);
  T.syllables = function (s) {
    const cps = Array.from(s), out = [];
    for (let i = 0; i < cps.length; i++) {
      const c = cps[i].codePointAt(0);
      if (isL(c)) {
        let syl = cps[i];
        while (i + 1 < cps.length && isL(cps[i + 1].codePointAt(0))) syl += cps[++i];
        while (i + 1 < cps.length && isV(cps[i + 1].codePointAt(0))) syl += cps[++i];
        while (i + 1 < cps.length && isT(cps[i + 1].codePointAt(0))) syl += cps[++i];
        out.push(syl);
      } else if (!/\s/.test(cps[i])) out.push(cps[i]);
    }
    return out;
  };

  // 띄어 쓴 글에서 낱말이 끝나는 음절 자리(그 뒤에 띄어쓰기가 있는 곳)
  T.wordEnds = function (s) {
    const ends = new Set();
    let n = 0;
    for (const w of s.trim().split(/\s+/)) { n += T.syllables(w).length; ends.add(n - 1); }
    return ends;
  };

  // 음보 표기 "이런들/엇더[ㅎㆍ]며/…" → { syl:[음절], cuts:Set(꼭 끊을 자리), opt:Set(끊어도 되는 자리), feet:[음보별 글자 수] }
  //  자리 번호 i = i번째 음절 뒤
  T.feet = function (spec) {
    const syl = [], cuts = new Set(), opt = new Set(), feet = [];
    let n = 0;
    for (const seg of spec.split(/(\/|\|)/)) {
      if (seg === '/') { cuts.add(syl.length - 1); feet.push(n); n = 0; continue; }
      if (seg === '|') { opt.add(syl.length - 1); continue; }
      const s = T.syllables(yet(G.util.stripHanja(seg)));
      syl.push(...s); n += s.length;
    }
    feet.push(n);
    return { syl, cuts, opt, feet };
  };
})();
