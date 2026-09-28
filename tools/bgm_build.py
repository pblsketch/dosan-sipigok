# 국립국악원 악구(assets/raw/bgm)를 이어 붙여 게임 배경음(assets/bgm/*.mp3)을 만든다.
#   python tools/bgm_build.py
# - 이어지는 악구는 5ms만 겹쳐 잇는다(원래 연주를 그대로 되살림). 떨어진 대목끼리는 장단 경계에서 잇는다.
# - 장단이 일정한 곡은 길이를 그대로 두고(반복해도 박이 밀리지 않게) 끝·처음만 살짝 줄였다 키운다.
#   장단이 자유로운 곡(청성곡·수제천)은 끝부분을 처음에 겹쳐(크로스페이드) 이음새 없이 돈다.
# - 음량을 같은 크기(-20 LUFS)로 맞추고 모노 64kbps MP3로 줄인다.
# 출처: 국립국악원 '국악기 디지털 음원'(공공누리 제1유형). tools/gugak_fetch.py가 내려받는다.
import os, subprocess, shutil, json, io, re, sys
import numpy as np
sys.stdout.reconfigure(encoding='utf-8')
BIN = os.path.dirname(shutil.which('ffmpeg') or os.path.expanduser('~/ffmpeg/bin/ffmpeg.exe'))
FFMPEG = os.path.join(BIN, 'ffmpeg')
ROOT = os.path.join(os.path.dirname(__file__), '..')
RAW = os.path.join(ROOT, 'assets', 'raw', 'bgm')
OUT = os.path.join(ROOT, 'assets', 'bgm')
os.makedirs(OUT, exist_ok=True)
SR = 44100
TARGET = -20.0

# kind: 'metric'(장단 일정: 길이 유지) | 'free'(끝을 처음에 겹침)   join: 'cont'(이어지는 악구) | 'bar'(떨어진 대목)
TRACKS = {
    'dosan':   {'files': ['w3-190-010', 'w3-190-020', 'w3-190-030', 'w3-190-040', 'w3-190-050'], 'join': 'cont', 'kind': 'free', 'x': 2.5,
                'src': '대금 풍류 「청성곡」 1장 1~2장단'},
    'eonji':   {'files': ['s2-122-010g', 's2-122-020g', 's2-122-030g', 's2-122-040g'], 'join': 'bar', 'kind': 'metric',
                'src': '거문고 풍류 「윗도드리」 1장·3장·6장·7장 가운데 4장단씩'},
    'ri':      {'files': ['s5-122-010-Yangum', 's5-122-020-Yangum', 's5-122-025-Yangum', 's5-122-040-Yangum'], 'join': 'bar', 'kind': 'metric',
                'src': '양금 풍류 「윗도드리」 1장·3장·5장·7장 가운데 4장단씩'},
    'eonhak':  {'files': ['w3-147-010', 'w3-147-020', 'w3-147-030', 'w3-147-040'], 'join': 'cont', 'kind': 'metric',
                'src': '대금 관악영산회상 「염불도드리」 초장'},
    'thunder': {'files': ['w1-440-020', 'w1-440-030', 'w1-440-040'], 'join': 'cont', 'kind': 'free', 'x': 3.0,
                'src': '피리 연례악 「수제천」 초장 4~6장단'},
    'stray':   {'files': ['w1-719-001', 'w1-719-002', 'w1-719-003', 'w1-719-004'], 'join': 'cont', 'kind': 'metric',
                'src': '피리 경기대풍류 「당악」 1~8장단'},
    'finale':  {'files': ['w3-149-010', 'w3-149-020', 'w3-149-030', 'w3-149-040', 'w3-149-050'], 'join': 'cont', 'kind': 'metric',
                'src': '대금 관악영산회상 「군악」 초장 1~10장단'},
}


def read(name):
    f = next(x for x in os.listdir(RAW) if x.lower().startswith(name.lower()))
    raw = subprocess.run([FFMPEG, '-v', 'error', '-i', os.path.join(RAW, f), '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def ramp(n, up=True):
    t = np.linspace(0, 1, n) if n > 1 else np.ones(n)
    return np.sin(t * np.pi / 2) if up else np.cos(t * np.pi / 2)


def xfade(a, b, sec):
    n = min(int(sec * SR), len(a), len(b))
    if n <= 0: return np.concatenate([a, b])
    mid = a[-n:] * ramp(n, False) + b[:n] * ramp(n, True)
    return np.concatenate([a[:-n], mid, b[n:]])


def edge(x, fin=0.015, fout=0.08):
    x = x.copy()
    a, b = int(fin * SR), int(fout * SR)
    x[:a] *= ramp(a, True); x[-b:] *= ramp(b, False)
    return x


def lufs(x):
    p = subprocess.run([FFMPEG, '-hide_banner', '-nostats', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-', '-af', 'ebur128', '-f', 'null', '-'],
                       input=x.astype(np.float32).tobytes(), capture_output=True).stderr.decode('utf-8', 'replace')
    return float(re.findall(r'I:\s+(-?[\d.]+) LUFS', p)[-1])


info = {}
for name, t in TRACKS.items():
    parts = [read(f) for f in t['files']]
    if t['join'] == 'cont':
        y = parts[0]
        for p in parts[1:]: y = xfade(y, p, 0.005)
    else:
        y = np.concatenate([edge(p, 0.01, 0.06) for p in parts])
    if t['kind'] == 'free':
        # 끝 x초를 처음 x초에 겹쳐, 반복할 때 이음새가 들리지 않게
        n = int(t['x'] * SR)
        head, tail = y[:n], y[-n:]
        y = np.concatenate([tail * ramp(n, False) + head * ramp(n, True), y[n:-n]])
    else:
        y = edge(y, 0.015, 0.08)
    g = 10 ** ((TARGET - lufs(y)) / 20)
    y = y * g
    peak = np.max(np.abs(y))
    if peak > 0.89: y *= 0.89 / peak  # -1 dBFS
    out = os.path.join(OUT, name + '.mp3')
    subprocess.run([FFMPEG, '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-', '-c:a', 'libmp3lame', '-b:a', '64k', out],
                   input=y.astype(np.float32).tobytes(), check=True)
    info[name] = {'sec': round(len(y) / SR, 3), 'lufs': round(lufs(y), 1), 'peak_db': round(20 * np.log10(np.max(np.abs(y))), 1), 'kb': os.path.getsize(out) // 1024, 'src': t['src'], 'files': t['files']}
    print(name, info[name])
json.dump(info, io.open(os.path.join(OUT, 'bgm.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
