#!/usr/bin/env python3
"""10xSEO welcome box — print dielines + mockup generator.

Box (lid, outer): 243 x 80 x 39 mm  (L x W x H)
Construction: rigid two-piece telescoping box (lid + base), like AirPods Max.

Run:  python3 build.py           -> writes out/*.svg, then render.js makes PDF/PNG
"""
import base64
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
os.makedirs(OUT, exist_ok=True)

# ---- Brand ---------------------------------------------------------------
NAVY = "#13294B"       # Pantone 2767 C (approx.) — box wrap
ACCENT = "#4DA3FF"     # "x" in the placeholder logo
SILVER = "#C9D3E3"     # tagline (silver foil on press)
WHITE = "#FFFFFF"
TAGLINE = "იყავი პირველი"
URL = "10xseo.ge"

# ---- Geometry (mm) -------------------------------------------------------
TURN_IN = 15   # paper wrapped over the board edge to the inside
FLAP = 12      # corner flaps on the long sides
BLEED = 3
LID = dict(L=243.0, W=80.0, H=39.0)
# base sits inside the lid: 2 mm board + 0.5 mm wrap each side
BASE = dict(L=238.0, W=75.0, H=37.0)


def font_face(family, path, weight):
    data = base64.b64encode(open(path, "rb").read()).decode()
    fmt = "opentype" if path.endswith(".otf") else "truetype"
    return (f"@font-face{{font-family:'{family}';font-weight:{weight};"
            f"src:url(data:font/{fmt};base64,{data}) format('{fmt}');}}")


FONTS_CSS = (
    font_face("BoxLatin", "/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf", 800)
    + font_face("BoxGeo", os.path.join(HERE, "fonts", "NotoSansGeorgian-SemiBold.ttf"), 600)
)


def logo(cx, cy, size):
    """Placeholder wordmark. Replace this <g> with the real logo SVG."""
    return (
        f'<g id="LOGO_PLACEHOLDER" font-family="BoxLatin" font-weight="800" '
        f'font-size="{size}" text-anchor="middle" letter-spacing="-0.4">'
        f'<text x="{cx}" y="{cy}" fill="{WHITE}">10<tspan fill="{ACCENT}">x</tspan>SEO</text></g>'
    )


def outline(L, W, H, T):
    a = T + H
    F = FLAP
    pts = [
        (a + 2, 0), (a + L - 2, 0), (a + L, T),
        (a + L + F, T + 2), (a + L + F, a), (a + L + H, a),
        (a + L + H + T, a + 2), (a + L + H + T, a + W - 2), (a + L + H, a + W),
        (a + L + F, a + W), (a + L + F, a + W + H - 2), (a + L, a + W + H),
        (a + L - 2, a + W + H + T), (a + 2, a + W + H + T), (a, a + W + H),
        (a - F, a + W + H - 2), (a - F, a + W), (a - H, a + W),
        (a - H - T, a + W - 2), (a - H - T, a + 2), (a - H, a),
        (a - F, a), (a - F, T + 2), (a, T),
    ]
    d = "M" + " L".join(f"{x:g},{y:g}" for x, y in pts) + " Z"
    # slits between corner flaps and short-side panels
    slits = [
        ((a + L, a), (a + L + F, a)), ((a + L, a + W), (a + L + F, a + W)),
        ((a, a), (a - F, a)), ((a, a + W), (a - F, a + W)),
    ]
    for (x1, y1), (x2, y2) in slits:
        d += f" M{x1:g},{y1:g} L{x2:g},{y2:g}"
    return d


def folds(L, W, H, T):
    a = T + H
    lines = [
        # top panel
        (a, a, a + L, a), (a, a + W, a + L, a + W), (a, a, a, a + W), (a + L, a, a + L, a + W),
        # turn-ins
        (a, T, a + L, T), (a, a + W + H, a + L, a + W + H),
        (T, a, T, a + W), (a + L + H, a, a + L + H, a + W),
        # corner flaps
        (a + L, T, a + L, a), (a, T, a, a), (a + L, a + W, a + L, a + W + H), (a, a + W, a, a + W + H),
    ]
    return " ".join(f"M{x1:g},{y1:g} L{x2:g},{y2:g}" for x1, y1, x2, y2 in lines)


def sheet(box, artwork=True, labels=False):
    L, W, H, T, B = box["L"], box["W"], box["H"], TURN_IN, BLEED
    a = T + H
    SW, SH = 2 * a + L, 2 * a + W
    pad = 22 if labels else 0
    vx, vy = -B - pad, -B - pad
    vw, vh = SW + 2 * (B + pad), SH + 2 * (B + pad)
    g = []
    if labels:
        g.append(f'<rect x="{vx}" y="{vy}" width="{vw}" height="{vh}" fill="#fff"/>')
    g.append(f'<g id="artwork"><rect x="{-B}" y="{-B}" width="{SW + 2 * B}" height="{SH + 2 * B}" fill="{NAVY}"/>')
    if artwork:
        cx, cy = a + L / 2, a + W / 2
        g.append(logo(cx, cy + 3, 17))
        g.append(f'<text x="{cx}" y="{cy + 19}" font-family="BoxGeo" font-weight="600" font-size="5.6" '
                 f'letter-spacing="0.9" fill="{SILVER}" text-anchor="middle">{TAGLINE}</text>')
        # front side panel (folds down, reads upright)
        g.append(f'<text x="{cx}" y="{a + W + H / 2 + 1.4}" font-family="BoxLatin" font-weight="800" '
                 f'font-size="4" letter-spacing="0.6" fill="{SILVER}" fill-opacity=".75" '
                 f'text-anchor="middle">{URL}</text>')
    g.append("</g>")
    g.append(f'<g id="dieline" fill="none" stroke-width="0.25">'
             f'<path d="{outline(L, W, H, T)}" stroke="#EC008C"/>'
             f'<path d="{folds(L, W, H, T)}" stroke="#00AEEF" stroke-dasharray="2 1.2"/></g>')
    if labels:
        s = 'font-family="BoxLatin" font-size="4" fill="#333"'
        dim = lambda x1, y1, x2, y2: f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="#333" stroke-width=".2"/>'
        y0 = -B - 8
        g.append(dim(a, y0, a + L, y0) + f'<text x="{a + L / 2}" y="{y0 - 1.5}" {s} text-anchor="middle">{L:g} mm</text>')
        g.append(dim(0, y0 - 8, SW, y0 - 8) + f'<text x="{SW / 2}" y="{y0 - 9.5}" {s} text-anchor="middle">{SW:g} mm (ტრიმი)</text>')
        x0 = SW + B + 8
        g.append(dim(x0, a, x0, a + W) + f'<text x="{x0 + 2}" y="{a + W / 2}" {s} text-anchor="start">{W:g}</text>')
        g.append(dim(x0, a + W, x0, a + W + H) + f'<text x="{x0 + 2}" y="{a + W + H / 2}" {s} text-anchor="start">{H:g}</text>')
        g.append(dim(x0, a + W + H, x0, SH) + f'<text x="{x0 + 2}" y="{a + W + H + T / 2}" {s} text-anchor="start">{T:g}</text>')
        g.append(f'<text x="{-B}" y="{SH + B + 9}" font-family="BoxLatin" fill="#333" text-anchor="start" font-size="3.4">'
                 f'<tspan fill="#EC008C">━ ჭრა (cut)</tspan>   <tspan fill="#00AEEF">┅ კეცვა (fold)</tspan>   '
                 f'ბლიდი {B} mm   ·   turn-in {T} mm</text>')
    body = "".join(g)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{vw:g}mm" height="{vh:g}mm" '
            f'viewBox="{vx:g} {vy:g} {vw:g} {vh:g}"><style>{FONTS_CSS}</style>{body}</svg>')


def top_face(box):
    """Top panel only (for the mockup)."""
    L, W = box["L"], box["W"]
    cx, cy = L / 2, W / 2
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {L:g} {W:g}"><style>{FONTS_CSS}</style>'
            f'<rect width="{L}" height="{W}" fill="{NAVY}"/>{logo(cx, cy + 3, 17)}'
            f'<text x="{cx}" y="{cy + 19}" font-family="BoxGeo" font-weight="600" font-size="5.6" '
            f'letter-spacing="0.9" fill="{SILVER}" text-anchor="middle">{TAGLINE}</text></svg>')


def front_face(box):
    L, H = box["L"], box["H"]
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {L:g} {H:g}"><style>{FONTS_CSS}</style>'
            f'<rect width="{L}" height="{H}" fill="{NAVY}"/>'
            f'<text x="{L / 2}" y="{H / 2 + 1.4}" font-family="BoxLatin" font-weight="800" font-size="4" '
            f'letter-spacing="0.6" fill="{SILVER}" fill-opacity=".75" text-anchor="middle">{URL}</text></svg>')


files = {
    "lid-dieline.svg": sheet(LID),
    "base-dieline.svg": sheet(BASE, artwork=False),
    "lid-dieline-annotated.svg": sheet(LID, labels=True),
    "_top.svg": top_face(LID),
    "_front.svg": front_face(LID),
}
for name, svg in files.items():
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as f:
        f.write(svg)
print("wrote", ", ".join(files))
