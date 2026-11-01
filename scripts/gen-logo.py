#!/usr/bin/env python3
"""
REZAR GROUP wordmark -> pure SVG paths (no runtime font dependency).

  mark : rounded tile + an «R» cut from Fixel Display 500 (the site's display face)
  word : «REZAR» Fixel Display 500, tracking 0.12em (VELAR wordmark rhythm) · «GROUP» same face, 0.62 size,
         wider tracking, set at 72 % opacity so it reads as the descriptor

Outputs
  src/partials/logo.html   inline <svg> used by the header / menu / footer partials (colours from CSS:
                           .logo__tile / .logo__glyph / currentColor for the word)
  public/favicon.svg       standalone mark (graphite tile, white R, lime dot)

Needs: pip install fonttools brotli   (woff2 decoding). Run: python3 scripts/gen-logo.py
"""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

ROOT = Path(__file__).resolve().parent.parent
font = TTFont(ROOT / 'src/assets/fonts/FixelDisplay-Medium.woff2')
gs = font.getGlyphSet()
cmap = font.getBestCmap()
upm = font['head'].unitsPerEm
CAP = font['OS/2'].sCapHeight  # 700


def run(text, size, x, baseline, tracking=0.0):
    """path data for `text` at `size` px (cap height = size * CAP/upm), returns (d, advance)"""
    s = size / upm
    d = []
    cx = x
    for ch in text:
        if ch == ' ':
            cx += gs[cmap[ord(' ')]].width * s + tracking * size
            continue
        name = cmap[ord(ch)]
        pen = SVGPathPen(gs, ntos=lambda v: f'{v:.2f}'.rstrip('0').rstrip('.'))
        tpen = TransformPen(pen, (s, 0, 0, -s, cx, baseline))
        gs[name].draw(tpen)
        d.append(pen.getCommands())
        cx += gs[name].width * s + tracking * size
    return ''.join(d), cx - x - tracking * size


# ---- wordmark (viewBox height 32; caps 20px tall, baseline 26) ----
H = 32
TILE = 32
cap_px = 15.0                    # cap height of REZAR in viewBox units
size = cap_px * upm / CAP        # font size giving that cap height
base = (H + cap_px) / 2          # optical centre on the tile
gap = 10
x0 = TILE + gap
rezar, w1 = run('REZAR', size, x0, base, tracking=0.12)
g_size = size * 0.62
group_x = x0 + w1 + size * 0.42
group, w2 = run('GROUP', g_size, group_x, base, tracking=0.22)
W = group_x + w2 + 1

# tile «R»: centred, caps 16 tall
r_cap = 16.0
r_size = r_cap * upm / CAP
r_adv = gs[cmap[ord('R')]].width * r_size / upm
# measure the R ink box for optical centring
from fontTools.pens.boundsPen import BoundsPen
bp = BoundsPen(gs)
gs[cmap[ord('R')]].draw(bp)
xmin, _, xmax, _ = bp.bounds
ink_w = (xmax - xmin) * r_size / upm
r_x = (TILE - ink_w) / 2 - xmin * r_size / upm
r_glyph, _ = run('R', r_size, r_x, (TILE + r_cap) / 2)

logo = f'''<svg class="logo__svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W:.2f} {H}" aria-hidden="true" focusable="false">
  <rect class="logo__tile" width="{TILE}" height="{TILE}" rx="9"/>
  <path class="logo__glyph" d="{r_glyph}"/>
  <path class="logo__word" fill="currentColor" d="{rezar}"/>
  <path class="logo__sub" fill="currentColor" d="{group}"/>
</svg>
'''
(ROOT / 'src/partials/logo.html').write_text(logo)

# ---- favicon (64×64) ----
fs = 34.0
f_size = fs * upm / CAP
f_ink = (xmax - xmin) * f_size / upm
f_x = (64 - f_ink) / 2 - xmin * f_size / upm - 2
f_glyph, _ = run('R', f_size, f_x, (64 + fs) / 2)
fav = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#16191D"/><path fill="#F3F5F2" d="{f_glyph}"/><circle cx="50" cy="45" r="4.5" fill="#CFF6A2"/></svg>
'''
(ROOT / 'public/favicon.svg').write_text(fav)
print(f'logo {W:.1f}x{H}  ->  src/partials/logo.html, public/favicon.svg')
