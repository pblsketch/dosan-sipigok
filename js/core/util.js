'use strict';
// 공용 도구: DOM 만들기, 글 속 표시 풀기, 섞기 등
window.G = window.G || {};
(function () {
  const U = (G.util = {});

  // h('div.cls#id', {attrs}, children...) — 간단한 요소 생성기
  U.h = function (sel, attrs, ...kids) {
    const m = sel.match(/^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i);
    const el = document.createElement((m && m[1]) || 'div');
    if (m && m[2]) for (const part of m[2].match(/[.#][\w-]+/g)) {
      if (part[0] === '.') el.classList.add(part.slice(1)); else el.id = part.slice(1);
    }
    if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) { kids.unshift(attrs); attrs = null; }
    for (const k in attrs || {}) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'on') for (const ev in v) el.addEventListener(ev, v[ev]);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    U.append(el, kids);
    return el;
  };
  U.append = function (el, kids) {
    for (const k of kids.flat(Infinity)) {
      if (k == null || k === false) continue;
      el.appendChild(k instanceof Node ? k : document.createTextNode(String(k)));
    }
    return el;
  };
  U.$ = (s, r = document) => r.querySelector(s);
  U.$$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  U.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  U.shuffle = function (a, seed) {
    a = a.slice();
    let s = seed == null ? Math.random() * 1e9 : seed;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  // 섞되 원래 순서와 같지 않게
  U.shuffleNot = function (a, seed) {
    if (a.length < 2) return a.slice();
    let r, n = 0;
    do { r = U.shuffle(a, seed == null ? null : seed + n); n++; } while (n < 20 && r.every((x, i) => x === a[i]));
    return r;
  };
  U.wait = (ms) => new Promise((r) => setTimeout(r, ms));
  // 휴대폰 진동(안드로이드만, 없으면 조용히 넘어감)
  U.buzz = () => { try { if (navigator.vibrate && G.save.state.sound) navigator.vibrate(8); } catch (e) { /* 무시 */ } };
  U.clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // 글 속 표시 → HTML: **굵게** → <b>, {漢字|한글} → 루비(한자 끄기면 한글만), [ㅎㆍ] → 옛한글
  const noHanja = () => document.documentElement && document.documentElement.classList && document.documentElement.classList.contains('no-hanja');
  U.bold = (s) => U.esc(U.yet ? U.yet(String(s)) : String(s))
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\{([^|}]+)\|([^}]+)\}/g, (m, a, b) => (noHanja() ? b : `<ruby>${a}<rt>${b}</rt></ruby>`));
  U.boldNodes = function (s) {
    const span = document.createElement('span');
    span.innerHTML = U.bold(s).replace(/\n/g, '<br>');
    return span;
  };

  // 글 속 표시를 조각으로 나눈다.
  //  [호칭|id] → {k:'tag', t, id}   {호칭|id} → {k:'auto', t, id}   **x** → {k:'b', t}   나머지 → {k:'t', t}
  U.parse = function (s) {
    const out = [];
    const re = /\[([^\]|]+)\|([a-z]+)\]|\{([^}|]+)\|([a-z]+)\}|\*\*(.+?)\*\*/g;
    let last = 0, m;
    while ((m = re.exec(s))) {
      if (m.index > last) out.push({ k: 't', t: s.slice(last, m.index) });
      if (m[1]) out.push({ k: 'tag', t: m[1], id: m[2] });
      else if (m[3]) out.push({ k: 'auto', t: m[3], id: m[4] });
      else out.push({ k: 'b', t: m[5] });
      last = re.lastIndex;
    }
    if (last < s.length) out.push({ k: 't', t: s.slice(last) });
    return out;
  };
  // 표시를 걷어 낸 맨글
  U.plain = (s) => s.replace(/\[([^\]|]+)\|[a-z]+\]|\{([^}|]+)\|[a-z]+\}/g, '$1$2').replace(/\*\*(.+?)\*\*/g, '$1');

  // 낱말 뒤 조사를 받침에 맞춘다: josa('부인', '가 시킨') → '이 시킨'
  //  이/가, 은/는, 을/를, 과/와, 으로/로(ㄹ 받침은 '로')만 바꾸고 나머지는 그대로 둔다
  U.josa = function (word, rest) {
    const m = /^(으로|로|이|가|은|는|을|를|과|와)(?=[\s,.!?]|$)/.exec(rest || '');
    if (!m) return rest;
    const c = String(word).charCodeAt(String(word).length - 1);
    if (!(c >= 0xac00 && c <= 0xd7a3)) return rest;
    const jong = (c - 0xac00) % 28;
    const pairs = { 이: ['이', '가'], 가: ['이', '가'], 은: ['은', '는'], 는: ['은', '는'], 을: ['을', '를'], 를: ['을', '를'], 과: ['과', '와'], 와: ['과', '와'], 으로: ['으로', '로'], 로: ['으로', '로'] };
    const useFirst = m[1] === '으로' || m[1] === '로' ? jong > 0 && jong !== 8 : jong > 0;
    return pairs[m[1]][useFirst ? 0 : 1] + rest.slice(m[1].length);
  };

})();

// ---------------------------------------------------------------------------
// 옛한글 조합기
// 원문 데이터에서 [ㅎㆍ]처럼 대괄호 안에 호환 자모를 적으면 옛한글 음절로 조합한다.
// 현대 음절로 쓸 수 있으면 완성형으로, 아니면 첫가끝(조합형) 자모열로 만든다.
// ---------------------------------------------------------------------------
(function () {
  const L = { 'ㄱ': 0x1100, 'ㄲ': 0x1101, 'ㄴ': 0x1102, 'ㄷ': 0x1103, 'ㄸ': 0x1104, 'ㄹ': 0x1105, 'ㅁ': 0x1106, 'ㅂ': 0x1107, 'ㅃ': 0x1108, 'ㅅ': 0x1109, 'ㅆ': 0x110A, 'ㅇ': 0x110B, 'ㅈ': 0x110C, 'ㅉ': 0x110D, 'ㅊ': 0x110E, 'ㅋ': 0x110F, 'ㅌ': 0x1110, 'ㅍ': 0x1111, 'ㅎ': 0x1112,
    'ㅿ': 0x1140, 'ㆁ': 0x114C, 'ㆆ': 0x1159, 'ㅸ': 0x112B, 'ㅂㅇ': 0x112B,
    'ㄴㄱ': 0x1113, 'ㄴㄴ': 0x1114, 'ㄴㄷ': 0x1115, 'ㄴㅂ': 0x1116, 'ㄷㄱ': 0x1117, 'ㄹㄴ': 0x1118, 'ㄹㄹ': 0x1119, 'ㄹㅎ': 0x111A, 'ㅁㅂ': 0x111C, 'ㅁㅇ': 0x111D,
    'ㅂㄱ': 0x111E, 'ㅂㄴ': 0x111F, 'ㅂㄷ': 0x1120, 'ㅂㅅ': 0x1121, 'ㅂㅅㄱ': 0x1122, 'ㅂㅅㄷ': 0x1123, 'ㅂㅅㅂ': 0x1124, 'ㅂㅅㅅ': 0x1125, 'ㅂㅅㅈ': 0x1126, 'ㅂㅈ': 0x1127, 'ㅂㅊ': 0x1128, 'ㅂㅌ': 0x1129, 'ㅂㅍ': 0x112A,
    'ㅅㄱ': 0x112D, 'ㅅㄴ': 0x112E, 'ㅅㄷ': 0x112F, 'ㅅㄹ': 0x1130, 'ㅅㅁ': 0x1131, 'ㅅㅂ': 0x1132, 'ㅅㅂㄱ': 0x1133, 'ㅅㅅㅅ': 0x1134, 'ㅅㅇ': 0x1135, 'ㅅㅈ': 0x1136, 'ㅅㅊ': 0x1137, 'ㅅㅋ': 0x1138, 'ㅅㅌ': 0x1139, 'ㅅㅍ': 0x113A, 'ㅅㅎ': 0x113B,
    'ㅇㅇ': 0x1147 };
  const V = { 'ㅏ': 0x1161, 'ㅐ': 0x1162, 'ㅑ': 0x1163, 'ㅒ': 0x1164, 'ㅓ': 0x1165, 'ㅔ': 0x1166, 'ㅕ': 0x1167, 'ㅖ': 0x1168, 'ㅗ': 0x1169, 'ㅘ': 0x116A, 'ㅙ': 0x116B, 'ㅚ': 0x116C, 'ㅛ': 0x116D, 'ㅜ': 0x116E, 'ㅝ': 0x116F, 'ㅞ': 0x1170, 'ㅟ': 0x1171, 'ㅠ': 0x1172, 'ㅡ': 0x1173, 'ㅢ': 0x1174, 'ㅣ': 0x1175,
    'ㅗㅏ': 0x116A, 'ㅗㅐ': 0x116B, 'ㅗㅣ': 0x116C, 'ㅜㅓ': 0x116F, 'ㅜㅔ': 0x1170, 'ㅜㅣ': 0x1171, 'ㅡㅣ': 0x1174,
    'ㆍ': 0x119E, 'ㆍㅣ': 0x11A1, 'ㆎ': 0x11A1, 'ㆍㅓ': 0x119F, 'ㆍㅜ': 0x11A0, 'ㆍㆍ': 0x11A2, 'ㅑㅗ': 0x1184, 'ㅕㅣ': 0x1168 };
  const T = { 'ㄱ': 0x11A8, 'ㄲ': 0x11A9, 'ㄱㅅ': 0x11AA, 'ㄴ': 0x11AB, 'ㄴㅈ': 0x11AC, 'ㄴㅎ': 0x11AD, 'ㄷ': 0x11AE, 'ㄹ': 0x11AF, 'ㄹㄱ': 0x11B0, 'ㄹㅁ': 0x11B1, 'ㄹㅂ': 0x11B2, 'ㄹㅅ': 0x11B3, 'ㄹㅌ': 0x11B4, 'ㄹㅍ': 0x11B5, 'ㄹㅎ': 0x11B6, 'ㅁ': 0x11B7, 'ㅂ': 0x11B8, 'ㅂㅅ': 0x11B9, 'ㅅ': 0x11BA, 'ㅆ': 0x11BB, 'ㅇ': 0x11BC, 'ㅈ': 0x11BD, 'ㅊ': 0x11BE, 'ㅋ': 0x11BF, 'ㅌ': 0x11C0, 'ㅍ': 0x11C1, 'ㅎ': 0x11C2,
    'ㅿ': 0x11EB, 'ㆁ': 0x11F0, 'ㆆ': 0x11F9, 'ㄹㆆ': 0x11D9, 'ㅁㅿ': 0x11E0, 'ㄹㅿ': 0x11D7, 'ㅅㄱ': 0x11E7, 'ㅅㄷ': 0x11E8, 'ㅂㅇ': 0x11E6, 'ㅸ': 0x11E6 };
  // 호환 자모 겹글자 → 낱자 풀기
  const SPLIT = { 'ㄳ': 'ㄱㅅ', 'ㄵ': 'ㄴㅈ', 'ㄶ': 'ㄴㅎ', 'ㄺ': 'ㄹㄱ', 'ㄻ': 'ㄹㅁ', 'ㄼ': 'ㄹㅂ', 'ㄽ': 'ㄹㅅ', 'ㄾ': 'ㄹㅌ', 'ㄿ': 'ㄹㅍ', 'ㅀ': 'ㄹㅎ', 'ㅄ': 'ㅂㅅ',
    'ㅺ': 'ㅅㄱ', 'ㅻ': 'ㅅㄴ', 'ㅼ': 'ㅅㄷ', 'ㅽ': 'ㅅㅂ', 'ㅾ': 'ㅅㅈ', 'ㅲ': 'ㅂㄱ', 'ㅳ': 'ㅂㄷ', 'ㅴ': 'ㅂㅅㄱ', 'ㅵ': 'ㅂㅅㄷ', 'ㅶ': 'ㅂㅈ', 'ㅷ': 'ㅂㅌ' };
  const MOD_L = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
  const MOD_V = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'];
  const MOD_T = ['', 'ㄱ', 'ㄲ', 'ㄱㅅ', 'ㄴ', 'ㄴㅈ', 'ㄴㅎ', 'ㄷ', 'ㄹ', 'ㄹㄱ', 'ㄹㅁ', 'ㄹㅂ', 'ㄹㅅ', 'ㄹㅌ', 'ㄹㅍ', 'ㄹㅎ', 'ㅁ', 'ㅂ', 'ㅂㅅ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
  const VOWELS = new Set('ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣㆍㆎ');
  const VCOMPOSE = { 'ㅗㅏ': 'ㅘ', 'ㅗㅐ': 'ㅙ', 'ㅗㅣ': 'ㅚ', 'ㅜㅓ': 'ㅝ', 'ㅜㅔ': 'ㅞ', 'ㅜㅣ': 'ㅟ', 'ㅡㅣ': 'ㅢ' };

  function syllable(group) {
    let s = '';
    for (const ch of group) s += SPLIT[ch] || ch;
    let i = 0, l = '', v = '', t = '';
    while (i < s.length && !VOWELS.has(s[i])) l += s[i++];
    while (i < s.length && VOWELS.has(s[i])) v += s[i++];
    t = s.slice(i);
    if (!l || !v) return null;
    const vm = VCOMPOSE[v] || v;
    const li = MOD_L.indexOf(l), vi = MOD_V.indexOf(vm), ti = MOD_T.indexOf(t);
    if (l.length === 1 && li >= 0 && vi >= 0 && ti >= 0) {
      return String.fromCharCode(0xAC00 + (li * 21 + vi) * 28 + ti);
    }
    const lc = L[l], vc = V[v] || V[vm], tc = t ? T[t] : 0;
    if (!lc || !vc || (t && !tc)) return null;
    return String.fromCharCode(lc, vc) + (tc ? String.fromCharCode(tc) : '');
  }

  // "[ㅎㆍ]다" → "ᄒᆞ다"
  G.util.yet = function (text) {
    if (!text || text.indexOf('[') < 0) return text || '';
    return text.replace(/\[([^\]\[]{1,8})\]/g, (m, g) => {
      const r = syllable(g);
      if (r === null) { console.warn('옛한글 조합 실패:', m); return g; }
      return r;
    });
  };
  // 한자 병기 제거: "강호(江湖)애" → "강호애"
  G.util.stripHanja = (text) => (text || '').replace(/\(([㐀-鿿豈-﫿·\s]+)\)/g, '');
  
})();

