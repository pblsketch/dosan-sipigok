'use strict';
// 진행 저장: 이 브라우저(localStorage)에만 저장하고 서버로 보내지 않는다
(function () {
  const KEY = 'dosan-sipigok-v1';
  const fresh = () => ({
    v: 1,
    mode: 'first',          // first: 처음 읽기(도입) / review: 다시 읽기(복습)
    font: 1,                // 글자 크기 배율
    sound: true,
    music: true,
    hanja: true,            // 원문에 한자 함께 보이기
    teacher: false,
    name: '',
    sealed: {},             // 부(1·2)마다 이름 낙관을 찍었는지
    seenFiction: {},        // 본 게임 설정 카드
    intro: {},              // 본 도입(부마다)
    done: {},               // 끝낸 곡: 번호 → true
    steps: {},              // 끝낸 단계: '곡-단계' → true
    found: {},              // 찾은 시어: '곡-시어' → true
    cut: {},                // 음보 끊기 확정: '곡-장' → true
    choice: {},             // 해석 질문 등 고른 답: id → 값
    mind: {},               // 마음 지도: 곡 → 고른 태도
    stats: {},              // 영역별 첫 시도 { word:[맞음,전체], ri:[…], foot:[…] }
    first: {},              // 곡별 첫 시도: 곡 → [맞음, 전체]
    firstKind: {},          // 곡·영역별 첫 시도: '곡-영역' → [맞음, 전체]
    wrong: [],              // 오답 노트 [{song, kind, text}]
    helped: 0,              // 도움(여백 메모·정답 보기) 쓴 횟수
    helpSong: {},           // 곡별 도움 횟수(通 낙관 판정)
    helpAsked: {},          // 곡별로 "도움을 보면 通이 안 찍혀요"를 확인했는지
    retry: {},              // '도움 없이 다시' 중인 곡
    gold: {},               // 다시 해서 되찾은 通(금빛)
    startedAt: {},          // 부마다 시작 시각
    finishedAt: {},         // 부마다 마친 시각
  });
  let S = fresh();
  G.save = {
    get state() { return S; },
    load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) S = Object.assign(fresh(), JSON.parse(raw));
      } catch (e) { /* 저장소를 못 쓰는 환경: 새로 시작 */ }
      return S;
    },
    write() {
      try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* 무시 */ }
    },
    reset(keepSettings) {
      const keep = keepSettings ? { mode: S.mode, font: S.font, sound: S.sound, music: S.music, hanja: S.hanja, teacher: S.teacher, name: S.name } : {};
      S = Object.assign(fresh(), keep);
      this.write();
      return S;
    },
    // 한 부(1: 1~6곡, 2: 7~12곡)만 지우기
    resetPart(part) {
      const nums = part === 1 ? [1, 2, 3, 4, 5, 6] : [7, 8, 9, 10, 11, 12];
      const drop = (obj) => { for (const k of Object.keys(obj)) if (nums.includes(+String(k).split('-')[0])) delete obj[k]; };
      for (const o of [S.done, S.steps, S.found, S.cut, S.mind, S.first, S.firstKind, S.helpSong, S.helpAsked, S.retry, S.gold]) drop(o);
      S.wrong = S.wrong.filter((w) => !nums.includes(w.song));
      delete S.sealed[part]; delete S.startedAt[part]; delete S.finishedAt[part];
      this.write();
    },
    // 첫 시도 기록(같은 문제를 다시 풀면 세지 않는다)
    stat(song, kind, ok) {
      const s = (S.stats[kind] = S.stats[kind] || [0, 0]);
      const f = (S.first[song] = S.first[song] || [0, 0]);
      const k = (S.firstKind[song + '-' + kind] = S.firstKind[song + '-' + kind] || [0, 0]);
      if (ok) { s[0]++; f[0]++; k[0]++; }
      s[1]++; f[1]++; k[1]++;
    },
    // 곡 하나만 처음부터(도움 없이 다시). 오답 노트와 전체 기록은 남긴다
    resetSong(n) {
      const drop = (obj) => { for (const k of Object.keys(obj)) if (+String(k).split('-')[0] === n) delete obj[k]; };
      for (const o of [S.done, S.steps, S.found, S.cut, S.mind, S.first, S.firstKind, S.helpSong, S.helpAsked]) drop(o);
      S.retry[n] = true;
      this.write();
    },
    help(song) {
      S.helped++;
      if (song) S.helpSong[song] = (S.helpSong[song] || 0) + 1;
    },
    // 通 낙관: 곡의 모든 문제를 첫 시도에 맞히고 도움을 쓰지 않았다
    mastered(song) {
      const f = S.first[song];
      return !!(S.gold[song] || (S.done[song] && f && f[1] && f[0] === f[1] && !S.helpSong[song]));
    },
    wrong(song, kind, text) {
      if (!S.wrong.some((w) => w.text === text)) S.wrong.push({ song, kind, text });
    },
  };
})();
