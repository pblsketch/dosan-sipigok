# -*- coding: utf-8 -*-
"""게임에 쓰인 글자만 남긴 부분 글꼴(woff2)을 만든다.

    python tools/build_fonts.py

원본 글꼴(모두 SIL Open Font License 1.1)은 tools/fonts_src/에 둔다(저장소에는 올리지 않음).
  - NotoSerifKR-Regular.otf    https://github.com/notofonts/noto-cjk/raw/main/Serif/SubsetOTF/KR/NotoSerifKR-Regular.otf
                               (옛한글 조합 기능 ljmo·vjmo·tjmo가 있는 판. 원문 글꼴 DosanYet)
  - NotoSerifKR-VF.ttf         https://github.com/google/fonts/tree/main/ofl/notoserifkr  (본문 명조 DosanMyeongjo)
  - NanumBrushScript-Regular.ttf https://github.com/google/fonts/tree/main/ofl/nanumbrushscript  (제목 붓글씨 DosanBrush)
글이나 데이터를 고쳐 새 글자가 생겼다면 이 스크립트를 다시 돌리세요(node가 필요해요).
OFL은 수정본(부분 글꼴 포함)이 원래의 예약 이름을 쓰지 못하게 하므로 글꼴 이름을 Dosan…으로 바꾼다.
"""
import os, subprocess, urllib.request
from fontTools.ttLib import TTFont
from fontTools import subset
from fontTools.varLib import instancer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'tools', 'fonts_src')
OUT = os.path.join(ROOT, 'assets', 'fonts')
os.makedirs(SRC, exist_ok=True)
os.makedirs(OUT, exist_ok=True)
URLS = {
    'NotoSerifKR-Regular.otf': 'https://github.com/notofonts/noto-cjk/raw/main/Serif/SubsetOTF/KR/NotoSerifKR-Regular.otf',
    'NotoSerifKR-VF.ttf': 'https://github.com/google/fonts/raw/main/ofl/notoserifkr/NotoSerifKR%5Bwght%5D.ttf',
    'NanumBrushScript-Regular.ttf': 'https://github.com/google/fonts/raw/main/ofl/nanumbrushscript/NanumBrushScript-Regular.ttf',
    'OFL-NotoCJK.txt': 'https://raw.githubusercontent.com/notofonts/noto-cjk/main/Serif/LICENSE',
    'OFL-NotoSerifKR.txt': 'https://raw.githubusercontent.com/google/fonts/main/ofl/notoserifkr/OFL.txt',
    'OFL-NanumBrushScript.txt': 'https://raw.githubusercontent.com/google/fonts/main/ofl/nanumbrushscript/OFL.txt',
}
for name, url in URLS.items():
    p = os.path.join(SRC, name)
    if not os.path.exists(p):
        print('내려받는 중', name)
        urllib.request.urlretrieve(url, p)

# 옛한글 자모(첫가끝), 확장 A·B, 호환 자모, 기본 문장 부호
JAMO = [(0x1100, 0x11FF), (0xA960, 0xA97F), (0xD7B0, 0xD7FF), (0x3130, 0x318F)]


def used_chars():
    out = subprocess.run(['node', os.path.join(ROOT, 'tools', 'chars.js')], capture_output=True, check=True).stdout.decode('utf-8')
    chars = set(out) | set(chr(c) for c in range(0x20, 0x7F)) | set('「」『』·…—–→←↑↓▶▼✎✕“”‘’〈〉《》○●◎△')
    return chars


def rename(font, family):
    for rec in font['name'].names:
        if rec.nameID in (1, 4, 16, 21):
            rec.string = family
        elif rec.nameID == 6:
            rec.string = family.replace(' ', '')
        elif rec.nameID == 3:
            rec.string = family.replace(' ', '') + ';subset'


def build(src, out, unicodes, family, weight=None, features=None):
    font = TTFont(src)
    if 'fvar' in font:
        font = instancer.instantiateVariableFont(font, {'wght': weight or 400})
    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.layout_features = features or ['*']
    opts.name_IDs = ['*']
    opts.name_languages = ['*']
    opts.notdef_outline = True
    opts.hinting = False
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=sorted(unicodes))
    sub.subset(font)
    rename(font, family)
    font.flavor = 'woff2'
    font.save(out)
    print(os.path.basename(out), os.path.getsize(out) // 1024, 'KB')


chars = used_chars()
cps = {ord(c) for c in chars}
yet = set(cps)
for a, b in JAMO:
    yet.update(range(a, b + 1))
build(os.path.join(SRC, 'NotoSerifKR-Regular.otf'), os.path.join(OUT, 'yet.woff2'), yet, 'DosanYet',
      features=['ccmp', 'ljmo', 'vjmo', 'tjmo', 'locl', 'kern', 'palt', 'ruby'])
build(os.path.join(SRC, 'NotoSerifKR-VF.ttf'), os.path.join(OUT, 'myeongjo.woff2'), cps, 'DosanMyeongjo', 400)
build(os.path.join(SRC, 'NotoSerifKR-VF.ttf'), os.path.join(OUT, 'myeongjo-bold.woff2'), cps, 'DosanMyeongjo Bold', 700)
build(os.path.join(SRC, 'NanumBrushScript-Regular.ttf'), os.path.join(OUT, 'brush.woff2'), {ord(c) for c in '도산십이곡마음을씻는노래1부2부언지학완성병풍길 /'}, 'DosanBrush')
with open(os.path.join(OUT, 'OFL.txt'), 'w', encoding='utf-8', newline='\n') as f:
    f.write('assets/fonts의 글꼴은 SIL Open Font License 1.1을 따른다.\n'
            '- yet.woff2: Noto Serif CJK KR (Copyright 2017 Adobe, Google)의 부분 글꼴(옛한글 조합 기능 포함), 이름을 DosanYet으로 바꿈\n'
            '- myeongjo*.woff2: Noto Serif KR (Copyright 2012 Google Inc.)의 부분 글꼴, 이름을 DosanMyeongjo로 바꿈\n'
            '- brush.woff2: Nanum Brush Script (Copyright (c) 2010, NHN Corporation)의 부분 글꼴, 이름을 DosanBrush로 바꿈\n'
            '라이선스 전문: https://openfontlicense.org/open-font-license-official-text/ — 아래에 원 글꼴의 저작권 표시와 전문을 그대로 붙인다.\n')
    for name, title in [('OFL-NotoCJK.txt', 'Noto Serif CJK'), ('OFL-NotoSerifKR.txt', 'Noto Serif KR'), ('OFL-NanumBrushScript.txt', 'Nanum Brush Script')]:
        with open(os.path.join(SRC, name), encoding='utf-8') as lic:
            f.write('\n' + '=' * 72 + '\n' + title + '\n' + '=' * 72 + '\n' + lic.read().replace('\r\n', '\n').rstrip() + '\n')
print('OFL.txt')
