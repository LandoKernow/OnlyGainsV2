"""Builds every ONLYGAINS brand raster from the square lockup + the vector /// mark.

usage: python scripts/build_brand_assets.py Assets/brand-lockup-square.jpg public
(needs Pillow; crop boxes are measured from that exact source image)
"""
import os
import sys
from PIL import Image, ImageDraw

SRC, PUBLIC = sys.argv[1], sys.argv[2]
OBSIDIAN = (5, 5, 5)
WHITE = (255, 255, 255)

os.makedirs(os.path.join(PUBLIC, 'brand'), exist_ok=True)
os.makedirs(os.path.join(PUBLIC, 'icons'), exist_ok=True)

square = Image.open(SRC).convert('RGB')
lum = square.convert('L')


def white_on_alpha(box, lo=24, hi=230):
    crop = lum.crop(box)
    alpha = crop.point(lambda v: 0 if v <= lo else 255 if v >= hi else int((v - lo) * 255 / (hi - lo)))
    out = Image.new('RGBA', crop.size, WHITE + (0,))
    out.putalpha(alpha)
    return out


# Measured from the source: wordmark y449-546 x134-1119, tagline y597-621,
# mark y673-738. 6px breathing room so antialiased edges aren't clipped.
PAD = 6
white_on_alpha((134 - PAD, 449 - PAD, 1119 + PAD + 1, 546 + PAD + 1)).save(os.path.join(PUBLIC, 'brand', 'wordmark.png'), optimize=True)
white_on_alpha((134 - PAD, 449 - PAD, 1119 + PAD + 1, 738 + PAD + 1)).save(os.path.join(PUBLIC, 'brand', 'lockup.png'), optimize=True)

# The Effort Icon (///) in a 120x64 unit space — three parallelograms.
MARK_W, MARK_H = 120, 64


def stripes(scale, ox, oy):
    polys = []
    for i in range(3):
        dx = 29 * i
        pts = [(44 + dx, 0), (62 + dx, 0), (18 + dx, 64), (0 + dx, 64)]
        polys.append([(ox + x * scale, oy + y * scale) for x, y in pts])
    return polys


def draw_icon(size, mark_ratio, bg=OBSIDIAN, fg=WHITE, transparent=False, ss=4):
    big = size * ss
    mode = 'RGBA'
    img = Image.new(mode, (big, big), (0, 0, 0, 0) if transparent else bg + (255,))
    d = ImageDraw.Draw(img)
    scale = big * mark_ratio / MARK_W
    ox = (big - MARK_W * scale) / 2
    oy = (big - MARK_H * scale) / 2
    for poly in stripes(scale, ox, oy):
        d.polygon(poly, fill=fg + (255,))
    img = img.resize((size, size), Image.LANCZOS)
    return img if transparent else img.convert('RGB')


icons = os.path.join(PUBLIC, 'icons')
# "any": the mark carries the tile. "maskable": smaller so it survives any
# launcher mask (safe zone = centre circle, 40% radius).
draw_icon(192, 0.56).save(os.path.join(icons, 'icon-192.png'), optimize=True)
draw_icon(512, 0.56).save(os.path.join(icons, 'icon-512.png'), optimize=True)
draw_icon(192, 0.46).save(os.path.join(icons, 'maskable-icon-192.png'), optimize=True)
draw_icon(512, 0.46).save(os.path.join(icons, 'maskable-icon-512.png'), optimize=True)
# Android notification badge: alpha mask only, white on transparent.
draw_icon(96, 0.78, transparent=True).save(os.path.join(icons, 'badge-96.png'), optimize=True)
draw_icon(180, 0.54).save(os.path.join(PUBLIC, 'apple-touch-icon.png'), optimize=True)
draw_icon(512, 0.56).save(os.path.join(PUBLIC, 'favicon.png'), optimize=True)
draw_icon(32, 0.72).save(os.path.join(PUBLIC, 'favicon-32.png'), optimize=True)

# Open Graph card 1200x630: the lockup centred on obsidian (corner copy cropped out).
cy = (449 + 738) // 2
h = round(1254 * 630 / 1200)
og = square.crop((0, cy - h // 2, 1254, cy - h // 2 + h)).resize((1200, 630), Image.LANCZOS)
og.save(os.path.join(PUBLIC, 'og-image.png'), optimize=True)

print('ok')
