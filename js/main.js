'use strict';
// 시작점. 주소 뒤에 붙이는 바로가기:
//   ?song=7      그 곡으로 바로
//   ?part=2      그 부의 병풍/길로
//   ?teacher=1   선생님용(모든 곡 열기 + 정답 채우기 단추) 켜기, ?teacher=0 끄기
//   ?result=1    1부 결과 화면(2면 2부)
(function () {
  G.save.load();
  const q = new URLSearchParams(location.search);
  if (q.has('teacher')) { G.save.state.teacher = q.get('teacher') === '1'; G.save.write(); }
  G.app.applySettings();
  // 첫 터치에서 소리를 켤 수 있게(브라우저 정책)
  document.addEventListener('pointerdown', () => G.audio.unlock(), { once: true });
  document.addEventListener('keydown', () => G.audio.unlock(), { once: true });
  const song = +q.get('song');
  if (song && SONGS.some((s) => s.n === song)) return G.app.song(song);
  const part = +q.get('part');
  if (part === 1 || part === 2) return G.app.map(part);
  const res = +q.get('result');
  if (res === 1 || res === 2) return G.app.result(res);
  G.app.title();
})();
