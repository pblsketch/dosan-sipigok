# 국립국악원 '국악기 디지털 음원'(악구)에서 배경음 재료를 내려받는다.
#   python tools/gugak_fetch.py      → assets/raw/bgm/ (git에 넣지 않음)
# 이용 조건: 공공누리 제1유형(출처표시). 내려받을 때 사이트 양식대로 사용 목적·기관명을 제출한다.
# 목록은 사이트의 목록 API(getInstrumentList/getGenreList/getFileList)로 찾는다.
import json, urllib.request, urllib.parse, http.cookiejar, io, os, sys, zipfile, time
sys.stdout.reconfigure(encoding='utf-8')
ROOT = os.path.join(os.path.dirname(__file__), '..')
OUT = os.path.join(ROOT, 'assets', 'raw', 'bgm')
os.makedirs(OUT, exist_ok=True)
B = 'https://www.gugak.go.kr/digitaleum/'
FORM = {'usePurposeGb': '비상업용', 'usePurpose': '교육용', 'usePurposeDtl': '', 'companyName': '온양여자고등학교'}

# (악기, 장르, 악곡 이름에 들어가는 말) — 곡마다 앞에서부터 이어지는 악구를 모두 받는다
WANT = {
    'dosan': [('대금', '풍류', '청성곡')],
    'eonji': [('거문고', '풍류', '염불도드리'), ('거문고', '풍류', '윗도드리'), ('거문고', '풍류', '상영산')],
    'ri': [('양금', '풍류', '염불도드리'), ('양금', '풍류', '윗도드리')],
    'eonhak': [('대금', '풍류', '염불도드리'), ('대금', '풍류', '상영산')],
    'thunder': [('피리', '연례악', '수제천')],
    'stray': [('피리', '민간풍류', '당악')],
    'finale': [('대금', '풍류', '군악'), ('대금', '연례악', '수룡음')],
}

cj = http.cookiejar.CookieJar()
op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
op.addheaders = [('User-Agent', 'Mozilla/5.0'), ('Referer', B + 'front/phrase/list.do')]
op.open(B + 'front/phrase/list.do').read()


def post(path, data=None):
    return op.open(B + path, urllib.parse.urlencode(data or {}).encode())


def api(path, data=None):
    return json.loads(post('front/phrase/' + path, data).read().decode('utf-8'))


instr = {x['instrName']: x['instrCd'] for x in api('getInstrumentList.do')['instrList']}
picks = []
for track, specs in WANT.items():
    for name, genre, comp in specs:
        gl = api('getGenreList.do', {'instrCd': instr[name]})['list']
        g = next(x for x in gl if x['genreName'] == genre)
        fl = api('getFileList.do', {'instrCd': instr[name], 'genreCd': g['genreCd']})['list']
        items = [x for x in fl if comp in (x.get('cmpstnNmKor') or '')]
        items.sort(key=lambda x: x.get('phrsNmKor') or '')
        for x in items:
            picks.append({'track': track, 'instr': name, 'genre': genre, 'comp': x.get('cmpstnNmKor'), 'name': x.get('phrsNmKor'), 'id': x['phraseCd']})
print('악구', len(picks))
json.dump(picks, io.open(os.path.join(OUT, 'picks.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

have = set(os.listdir(OUT))
todo = [p for p in picks if not any(f.lower().startswith(p['id'].lower()) for f in have)]
for k in range(0, len(todo), 30):
    chunk = todo[k:k + 30]
    data = dict(FORM, arrId=','.join(p['id'] for p in chunk), id='')
    path = 'cmmn/file/phrase/downloads.do' if len(chunk) > 1 else 'cmmn/file/phrase/download.do'
    if len(chunk) == 1: data['id'] = chunk[0]['id']
    r = post(path, data)
    body = r.read()
    ctype = r.headers.get('Content-Type', '')
    disp = r.headers.get('Content-Disposition', '')
    print('받음', len(body), ctype, disp[:120])
    if body[:2] == b'PK':
        z = zipfile.ZipFile(io.BytesIO(body))
        for n in z.namelist():
            base = os.path.basename(n)
            if not base: continue
            open(os.path.join(OUT, base), 'wb').write(z.read(n))
            print('  ', base, z.getinfo(n).file_size)
    else:
        fn = urllib.parse.unquote(disp.split('filename=')[-1].strip('"; ')) if 'filename=' in disp else chunk[0]['id'] + '.bin'
        open(os.path.join(OUT, os.path.basename(fn)), 'wb').write(body)
        print('  ', fn)
    time.sleep(1)
print('끝', sorted(os.listdir(OUT))[:5], len(os.listdir(OUT)))
