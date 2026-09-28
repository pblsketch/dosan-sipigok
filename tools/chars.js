// 게임에 쓰인 모든 글자(옛한글은 조합한 뒤)를 뽑는다. build_fonts.py가 부른다.
//   node tools/chars.js        → 표준 출력으로 글자들
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const ctx = { console: { log() {}, warn() {} } };
ctx.window = ctx;
ctx.document = { createElement: () => ({}), createTextNode: () => ({}) };
vm.createContext(ctx);
for (const f of ['js/core/util.js', 'js/core/text.js', 'js/data/songs.js', 'js/data/notes.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
}
const G = ctx.G;
const chars = new Set();
const add = (s) => { for (const c of s) chars.add(c); };
const walk = (v) => {
  if (typeof v === 'string') { add(v); add(G.util.yet(v)); add(G.text.reading(v, {})); }
  else if (Array.isArray(v)) v.forEach(walk);
  else if (v && typeof v === 'object') Object.values(v).forEach(walk);
};
for (const k of ['SONGS', 'NOTES', 'VOICES', 'BALMUN', 'VARIANTS', 'ABOUT', 'INTRO']) if (ctx[k]) walk(ctx[k]);
// 코드 속 한국어 문자열도
for (const f of fs.readdirSync(path.join(root, 'js'), { recursive: true })) {
  if (!f.endsWith('.js')) continue;
  const src = fs.readFileSync(path.join(root, 'js', f), 'utf8');
  for (const m of src.matchAll(/'([^'\n]*)'|"([^"\n]*)"|`([^`]*)`/g)) { const s = m[1] || m[2] || m[3] || ''; add(s); add(G.util.yet(s)); }
}
add(fs.readFileSync(path.join(root, 'index.html'), 'utf8'));
process.stdout.write([...chars].filter((c) => c.codePointAt(0) >= 0x20).join(''));
