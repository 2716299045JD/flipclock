import os
from PIL import Image, ImageDraw, ImageFont, ImageChops

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'icons')
OUT = os.path.normpath(OUT)
os.makedirs(OUT, exist_ok=True)

FONT_CANDIDATES = [
    'C:/Windows/Fonts/arialbd.ttf',
    'C:/Windows/Fonts/Arial Bold.ttf',
    'C:/Windows/Fonts/segoeuib.ttf',
]


def load_font(size):
    for p in FONT_CANDIDATES:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                pass
    return ImageFont.load_default()


def build(size, path, safe_pad=0.0):
    W = size
    img = Image.new('RGB', (W, W), '#0a0a0c')

    scale = 1.0 - safe_pad
    cw = W * 0.60 * scale
    ch = W * 0.74 * scale
    x0 = (W - cw) / 2.0
    y0 = (W - ch) / 2.0
    x1 = x0 + cw
    y1 = y0 + ch
    r = W * 0.085
    mid = (y0 + y1) / 2.0
    gap = max(1.0, W * 0.007)

    card = Image.new('L', (W, W), 0)
    ImageDraw.Draw(card).rounded_rectangle([x0, y0, x1, y1], radius=r, fill=255)

    top_m = Image.new('L', (W, W), 0)
    ImageDraw.Draw(top_m).rectangle([0, 0, W, mid - gap], fill=255)
    top_m = ImageChops.multiply(card, top_m)

    bot_m = Image.new('L', (W, W), 0)
    ImageDraw.Draw(bot_m).rectangle([0, mid + gap, W, W], fill=255)
    bot_m = ImageChops.multiply(card, bot_m)

    img.paste('#f4f4f7', (0, 0), top_m)
    img.paste('#b9b9c4', (0, 0), bot_m)

    f = load_font(int(ch * 0.58))
    tt = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    ImageDraw.Draw(tt).text((W / 2.0, mid), '12', font=f, fill=(14, 14, 18, 255), anchor='mm')

    a = tt.split()[3]
    img.paste(tt, (0, 0), ImageChops.multiply(a, top_m))
    img.paste(tt, (0, 0), ImageChops.multiply(a, bot_m))

    img.save(path, 'PNG')
    print('wrote', path, size)


build(192, os.path.join(OUT, 'icon-192.png'))
build(512, os.path.join(OUT, 'icon-512.png'))
build(512, os.path.join(OUT, 'icon-maskable-512.png'), safe_pad=0.22)
build(180, os.path.join(OUT, 'apple-touch-icon.png'))
print('done')
