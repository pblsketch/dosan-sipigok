# DoRms 앱 공유용 미리보기 그림(16:10, 1600x1000): 왼쪽에 붓글씨 제목, 오른쪽에 도산서당 수묵담채
#   python tools/make_cover.py  → design/screens/dorms_cover.jpg
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter
ROOT = os.path.join(os.path.dirname(__file__), '..')
F = os.path.join(ROOT, 'tools', 'fonts_src')
W, H = 1600, 1000
PAPER = (239, 230, 210)
img = Image.new('RGB', (W, H), PAPER)

# 오른쪽 그림: 표지 그림을 높이에 맞춰 두고 왼쪽 가장자리를 종이색으로 녹인다
art = Image.open(os.path.join(ROOT, 'assets', 'ui', 'title_art.webp')).convert('RGB')
s = H / art.height * 1.08
art = art.resize((int(art.width * s), int(art.height * s)), Image.LANCZOS)
x0 = W - art.width + 60
y0 = -int(art.height * 0.02)
mask = Image.new('L', art.size, 255)
md = ImageDraw.Draw(mask)
fade = 360
for i in range(fade):
    md.line([(i, 0), (i, art.height)], fill=int(255 * (i / fade) ** 1.6))
img.paste(art, (x0, y0), mask)

d = ImageDraw.Draw(img)
brush = ImageFont.truetype(os.path.join(F, 'NanumBrushScript-Regular.ttf'), 210)
serif = ImageFont.truetype(os.path.join(F, 'NotoSerifKR-VF.ttf'), 64)
body = ImageFont.truetype(os.path.join(F, 'NotoSerifKR-VF.ttf'), 38)
small = ImageFont.truetype(os.path.join(F, 'NotoSerifKR-VF.ttf'), 32)
try:
    serif.set_variation_by_axes([600]); body.set_variation_by_axes([500]); small.set_variation_by_axes([400])
except Exception:
    pass
X = 110
d.text((X, 150), '퇴계 이황 · 1565', font=small, fill=(84, 74, 62))
d.text((X - 8, 205), '도산십이곡', font=brush, fill=(30, 26, 22))
d.text((X, 470), '마음을 씻는 노래', font=serif, fill=(179, 52, 42))
lines = ['바랜 풍경에 시어를 되살리고,', '자연에서 이치를 읽고,', '음보를 끊어 노래하는 연시조 학습 게임']
for k, t in enumerate(lines):
    d.text((X, 600 + k * 58), t, font=body, fill=(52, 46, 40))
d.text((X, 850), '1부 언지 · 2부 언학 · 두 차시', font=small, fill=(110, 98, 84))
d.text((X, 900), '박준일(온양여자고등학교 국어 교사)', font=small, fill=(110, 98, 84))
# 붉은 낙관
sx, sy, ss = X + 640, 480, 70
d.rectangle([sx, sy, sx + ss, sy + ss], outline=(179, 52, 42), width=5)
seal = ImageFont.truetype(os.path.join(F, 'NotoSerifKR-VF.ttf'), 44)
d.text((sx + ss / 2, sy + ss / 2 + 2), '通', font=seal, fill=(179, 52, 42), anchor='mm')
out = os.path.join(ROOT, 'design', 'screens')
os.makedirs(out, exist_ok=True)
img.save(os.path.join(out, 'dorms_cover.jpg'), quality=90)
print('ok', img.size)
