# -*- coding: utf-8 -*-
"""assets/raw/*.png(Codex 생성 원본)를 게임용 webp로 줄인다.

    python tools/process_assets.py

- sNN      → assets/sc/sNN.webp(색 그림, 가로 1024) + assets/sc/sNN_f.webp(먹빛으로 바랜 그림)
- sNN_*    → assets/sc/…(곡의 덧그림: 계절 바뀐 그림 등) + _f
- pt_*     → assets/pt/<이름>.webp  (정사각 256px, 얼굴)
- title_art → assets/ui/title_art.webp
- 종이 질감(assets/ui/paper.webp), 아이콘(icon-192/512.png)은 여기서 직접 만든다.
"""
import os, glob
import numpy as np
from PIL import Image, ImageEnhance, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'assets', 'raw')
OUT = {k: os.path.join(ROOT, 'assets', k) for k in ('pt', 'sc', 'ui')}
for d in OUT.values():
    os.makedirs(d, exist_ok=True)


def fit_width(im, w):
    if im.width <= w:
        return im
    return im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)


def save_webp(im, path, q=80):
    im.convert('RGB').save(path, 'WEBP', quality=q, method=6)


def faded(im):
    """먹빛으로 바랜 그림: 흑백 + 대비를 낮추고 한지 빛을 섞는다(사물 모양은 알아볼 수 있게)."""
    g = ImageOps.grayscale(im).convert('RGB')
    g = ImageEnhance.Contrast(g).enhance(0.58)
    g = ImageEnhance.Brightness(g).enhance(1.08)
    return Image.blend(g, Image.new('RGB', g.size, (236, 228, 210)), 0.26)


def scenes():
    for f in sorted(glob.glob(os.path.join(RAW, 's[0-9][0-9]*.png'))):
        name = os.path.splitext(os.path.basename(f))[0]
        im = fit_width(Image.open(f).convert('RGB'), 1024)
        save_webp(im, os.path.join(OUT['sc'], name + '.webp'), 80)
        save_webp(faded(im), os.path.join(OUT['sc'], name + '_f.webp'), 70)
        print('sc', name)


def portraits():
    for f in sorted(glob.glob(os.path.join(RAW, 'pt_*.png'))):
        name = os.path.splitext(os.path.basename(f))[0]
        im = Image.open(f).convert('RGB')
        s = min(im.size)
        im = im.crop(((im.width - s) // 2, 0, (im.width - s) // 2 + s, s))
        save_webp(im.resize((256, 256), Image.LANCZOS), os.path.join(OUT['pt'], name + '.webp'), 84)
        print('pt', name)


def title():
    src = os.path.join(RAW, 'title_art.png')
    if not os.path.exists(src):
        src = os.path.join(RAW, 'style_a_damchae.png')
        print('title_art (임시: 화풍 시안 A)')
    im = Image.open(src).convert('RGB')
    save_webp(fit_width(im, 1100), os.path.join(OUT['ui'], 'title_art.webp'), 80)
    return im


def paper():
    """한지 질감: 잔잔한 얼룩 + 가는 섬유. 이어 붙여도 이음새가 보이지 않게 만든다."""
    rng = np.random.default_rng(11)
    n = 512
    base = np.array([239, 230, 210], dtype=np.float32)

    def tile_noise(scale, amp):
        small = rng.normal(0, 1, (n // scale, n // scale))
        small = np.tile(small, (3, 3))
        im = Image.fromarray(((small - small.min()) / (np.ptp(small) + 1e-6) * 255).astype(np.uint8))
        im = im.resize((n * 3, n * 3), Image.BICUBIC).crop((n, n, 2 * n, 2 * n))
        return (np.asarray(im, dtype=np.float32) / 255 - 0.5) * amp

    mottle = tile_noise(32, 9) + tile_noise(8, 5) + tile_noise(2, 4)
    img = np.clip(base[None, None, :] + mottle[..., None] * np.array([1, 1, 1.15]), 0, 255)
    # 섬유: 짧고 가는 밝은/어두운 선
    for _ in range(900):
        x, y = rng.integers(0, n, 2)
        L = rng.integers(6, 26)
        ang = rng.uniform(0, np.pi)
        d = rng.choice([-9, 7])
        for t in range(L):
            xx, yy = int(x + np.cos(ang) * t) % n, int(y + np.sin(ang) * t) % n
            img[yy, xx] = np.clip(img[yy, xx] + d * 0.6, 0, 255)
    save_webp(Image.fromarray(img.astype(np.uint8), 'RGB'), os.path.join(OUT['ui'], 'paper.webp'), 82)
    print('ui paper')


def icons(title_im):
    s = min(title_im.size)
    sq = title_im.crop(((title_im.width - s) // 2, (title_im.height - s) // 3, (title_im.width - s) // 2 + s, (title_im.height - s) // 3 + s))
    for n in (192, 512):
        sq.resize((n, n), Image.LANCZOS).save(os.path.join(OUT['ui'], f'icon-{n}.png'))
    print('ui icons')


if __name__ == '__main__':
    scenes()
    portraits()
    t = title()
    paper()
    icons(t)
