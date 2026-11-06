#!/usr/bin/env python3
"""10xSEO welcome box: print dielines + 3D textures, three design variants.

Size follows the AirPods Max retail box: 243 x 239 x 80 mm (L x W x H).
Construction: rigid two-piece telescoping box (lid + base).

Variants:  A = pyramid hero,  B = typographic,  C = minimal gold
Run:  python3 build.py && node render.js
"""
import base64
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
FACES = os.path.join(OUT, "faces")
os.makedirs(FACES, exist_ok=True)

# ---- Brand (sampled from the 10xSEO banner + logo) ------------------------
NAVY = "#111729"      # background
GLOW = "#1E44C8"      # blue halo behind the pyramid
GOLD = "#F1C744"      # gold (printed as gold foil -> rendered as gradient)
GOLD_HI = "#FBE38A"   # glowing pyramid edges
WHITE = "#FFFFFF"


def mtav(s):
    """Mkhedruli -> Mtavruli (Georgian capitals), as in the brand banner."""
    return "".join(chr(ord(c) - 0x10D0 + 0x1C90) if "ა" <= c <= "ჰ" else c for c in s)


TAG_1, TAG_2 = mtav("იყავი"), mtav("პირველი")
Q_1, Q_2, Q_3 = mtav("მზად ხარ"), mtav("იყო"), mtav("პირველი?")
WELCOME = mtav("კეთილი იყოს შენი მობრძანება")
URL = "10XSEO.GE"

# ---- Geometry (mm) -------------------------------------------------------
TURN_IN, FLAP, BLEED = 15, 14, 3
LID = dict(L=243.0, W=239.0, H=80.0)
BASE = dict(L=238.0, W=234.0, H=78.0)    # 2 mm board + wrap inside the lid
INSERT = dict(L=230.0, W=226.0)          # welcome card on top of the contents


def font_face(family, path, weight):
    data = base64.b64encode(open(path, "rb").read()).decode()
    return (f"@font-face{{font-family:'{family}';font-weight:{weight};"
            f"src:url(data:font/ttf;base64,{data}) format('truetype');}}")


FONTS_CSS = (font_face("Brand", os.path.join(HERE, "fonts", "Poppins-ExtraBold.ttf"), 800)
             + font_face("Geo", os.path.join(HERE, "fonts", "NotoSansGeorgian-Black.ttf"), 900))

# ---- Render modes --------------------------------------------------------
# art  = what gets printed
# mask = 3D material map: G = roughness, B = metalness (foil)
# foil = 3D foil-only layer (emissive shine)
MODE = "art"
MASK_BASE, MASK_FOIL = "#00B400", "#0048FF"


def ink(color, foil=False):
    if MODE == "art":
        return "url(#goldfoil)" if foil and color == GOLD else color
    if MODE == "foil":
        return "url(#goldfoil)" if foil else "#000000"
    return MASK_FOIL if foil else MASK_BASE


def defs():
    return f"""<defs>
<linearGradient id="goldfoil" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#FFF0B3"/><stop offset=".22" stop-color="#E9C766"/><stop offset=".45" stop-color="#C08F2E"/>
<stop offset=".62" stop-color="#F6DC8C"/><stop offset=".82" stop-color="#B98428"/><stop offset="1" stop-color="#E7C46A"/></linearGradient>
<radialGradient id="halo"><stop offset="0" stop-color="{GLOW}" stop-opacity=".95"/>
<stop offset=".45" stop-color="{GLOW}" stop-opacity=".45"/><stop offset="1" stop-color="{GLOW}" stop-opacity="0"/></radialGradient>
<radialGradient id="flare"><stop offset="0" stop-color="#FFF8D0"/><stop offset=".3" stop-color="{GOLD_HI}" stop-opacity=".7"/>
<stop offset="1" stop-color="{GOLD}" stop-opacity="0"/></radialGradient>
<linearGradient id="faceL" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E0A63C"/><stop offset=".55" stop-color="#7A4A17"/><stop offset="1" stop-color="#2B1A0E"/></linearGradient>
<linearGradient id="faceR" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#B07A2A"/><stop offset=".55" stop-color="#4D2F12"/><stop offset="1" stop-color="#1C120B"/></linearGradient>
<filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation=".9" result="b"/>
<feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>"""


def _pyr_pts(cx, top, h):
    P = lambda u, v: (cx + u * h, top + v * h)
    return P(0, 0), P(-0.55, 0.80), P(0.03, 1.0), P(0.58, 0.79)


def pyramid(cx, top, h, halo=0.95):
    """Glowing gold pyramid (brand mark), 3/4 view. Printed CMYK."""
    if MODE != "art":
        return ""
    A, Lf, F, R = _pyr_pts(cx, top, h)
    lerp = lambda p, q, t: (p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t)
    pt = lambda p: f"{p[0]:.2f},{p[1]:.2f}"
    sw = h / 120
    s = [f'<circle cx="{cx}" cy="{top + .55 * h}" r="{h * halo}" fill="url(#halo)"/>' if halo else "",
         f'<polygon points="{pt(A)} {pt(Lf)} {pt(F)}" fill="url(#faceL)"/>',
         f'<polygon points="{pt(A)} {pt(F)} {pt(R)}" fill="url(#faceR)"/>']
    for t in (0.36, 0.68):
        a, f, r = lerp(A, Lf, t), lerp(A, F, t), lerp(A, R, t)
        s.append(f'<polyline points="{pt(a)} {pt(f)} {pt(r)}" fill="none" stroke="{GOLD_HI}" '
                 f'stroke-width="{.6 * sw:.2f}" stroke-opacity=".75"/>')
    s.append(f'<g filter="url(#glow)" fill="none" stroke="{GOLD_HI}" stroke-width="{.9 * sw:.2f}" stroke-linejoin="round">'
             f'<polyline points="{pt(Lf)} {pt(A)} {pt(R)}"/><polyline points="{pt(Lf)} {pt(F)} {pt(R)}"/>'
             f'<line x1="{A[0]}" y1="{A[1]}" x2="{F[0]}" y2="{F[1]}" stroke-opacity=".8"/></g>')
    s.append(f'<circle cx="{A[0]}" cy="{A[1]}" r="{h * .09}" fill="url(#flare)"/>')
    return "".join(s)


def pyramid_line(cx, top, h, sw=0.7):
    """Pyramid as gold-foil line art (variant C)."""
    A, Lf, F, R = _pyr_pts(cx, top, h)
    pt = lambda p: f"{p[0]:.2f},{p[1]:.2f}"
    return (f'<g fill="none" stroke="{ink(GOLD, True)}" stroke-width="{sw}" stroke-linejoin="round">'
            f'<polygon points="{pt(A)} {pt(Lf)} {pt(F)} {pt(R)}"/>'
            f'<line x1="{A[0]}" y1="{A[1]}" x2="{F[0]}" y2="{F[1]}"/></g>')


def logo(x, baseline, size, anchor="middle"):
    """10xSEO wordmark: gold-foil "10x" + white "SEO"."""
    return (f'<text x="{x}" y="{baseline}" font-family="Brand" font-weight="800" font-size="{size}" '
            f'text-anchor="{anchor}" letter-spacing="-0.02em">'
            f'<tspan fill="{ink(GOLD, True)}">10x</tspan><tspan fill="{ink(WHITE)}">SEO</tspan></text>')


def geo(x, y, size, fill, text, foil=False, anchor="middle", ls="0.04em"):
    return (f'<text x="{x}" y="{y}" font-family="Geo" font-weight="900" font-size="{size}" '
            f'letter-spacing="{ls}" fill="{ink(fill, foil)}" text-anchor="{anchor}">{text}</text>')


def rule(x1, x2, y, w=0.45):
    return f'<line x1="{x1}" y1="{y}" x2="{x2}" y2="{y}" stroke="{ink("#D9B04F", True)}" stroke-width="{w}"/>'


def face(w, h, body, bg=NAVY, bg_foil=False):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w:g}mm" height="{h:g}mm" viewBox="0 0 {w:g} {h:g}">'
            f'<style>{FONTS_CSS}</style>{defs()}<rect width="{w}" height="{h}" fill="{ink(bg, bg_foil)}"/>{body}</svg>')


# ---- Lid designs ---------------------------------------------------------
L, W, H = LID["L"], LID["W"], LID["H"]
CX = L / 2


def top_a():   # Pyramid hero, like the product shot on Apple's box
    return face(L, W, pyramid(CX, 66, 118)
                + geo(CX, 36, 11, WHITE, TAG_1, ls=".12em")
                + geo(CX, 51, 11, WHITE, TAG_2, ls=".12em")
                + logo(CX, 220, 13))


def top_b():   # Typographic, the banner headline as the cover
    x = 24
    return face(L, W, geo(x, 72, 19, WHITE, Q_1, anchor="start")
                + geo(x, 99, 19, WHITE, Q_2, anchor="start")
                + geo(x, 134, 27, GOLD, Q_3, foil=True, anchor="start", ls=".02em")
                + pyramid(196, 150, 46, halo=1.2)
                + rule(x, x + 40, 198)
                + logo(x, 216, 11, anchor="start"))


def top_c():   # Minimal gold, foil only on navy
    return face(L, W, pyramid_line(CX, 70, 34)
                + logo(CX, 132, 24)
                + rule(CX - 22, CX + 22, 145, .4)
                + geo(CX, 160, 6.2, GOLD, f"{TAG_1} {TAG_2}", foil=True, ls=".32em"))


def front_a():
    return face(L, H, f'<text x="{CX}" y="{H / 2 + 3.2}" font-family="Geo" font-weight="900" font-size="9" '
                      f'letter-spacing=".04em" text-anchor="middle"><tspan fill="{ink(WHITE)}">{Q_1} {Q_2} </tspan>'
                      f'<tspan fill="{ink(GOLD, True)}">{Q_3}</tspan></text>')


def front_b():
    return face(L, H, logo(CX, H / 2 + 4.4, 13))


def front_c():
    return face(L, H, geo(CX, H / 2 + 2.2, 6.2, WHITE, f"{TAG_1} {TAG_2}", ls=".32em"))


def lid_back():
    return face(L, H, f'<text x="{CX}" y="{H / 2 + 2.2}" font-family="Brand" font-weight="800" font-size="6.4" '
                      f'letter-spacing=".14em" text-anchor="middle" fill="{ink(GOLD, True)}">{URL}</text>')


def lid_end():
    return face(W, H, logo(W / 2, H / 2 + 3.6, 11))


# ---- Base (gold reveal) + insert card ------------------------------------
def base_side(w, h):
    return face(w, h, "", bg=GOLD, bg_foil=True)


def base_bottom():
    bl, bw = BASE["L"], BASE["W"]
    return face(bl, bw, f'<g opacity="{1 if MODE == "art" else 0}">'
                        f'<text x="{bl / 2}" y="{bw / 2}" font-family="Brand" font-weight="800" font-size="14" '
                        f'text-anchor="middle" fill="{NAVY}">10xSEO</text>'
                        f'<text x="{bl / 2}" y="{bw / 2 + 12}" font-family="Brand" font-weight="800" font-size="5" '
                        f'letter-spacing=".14em" text-anchor="middle" fill="{NAVY}">{URL}</text></g>', bg=GOLD, bg_foil=True)


def insert_card():
    il, iw = INSERT["L"], INSERT["W"]
    return face(il, iw, pyramid(il / 2, 38, 82)
                + geo(il / 2, 158, 8.4, WHITE, WELCOME)
                + rule(il / 2 - 20, il / 2 + 20, 172)
                + logo(il / 2, 196, 14))


# ---- Dieline -------------------------------------------------------------
def outline(L, W, H, T):
    a, F = T + H, FLAP
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
    for (x1, y1), (x2, y2) in [((a + L, a), (a + L + F, a)), ((a + L, a + W), (a + L + F, a + W)),
                               ((a, a), (a - F, a)), ((a, a + W), (a - F, a + W))]:
        d += f" M{x1:g},{y1:g} L{x2:g},{y2:g}"
    return d


def folds(L, W, H, T):
    a = T + H
    lines = [(a, a, a + L, a), (a, a + W, a + L, a + W), (a, a, a, a + W), (a + L, a, a + L, a + W),
             (a, T, a + L, T), (a, a + W + H, a + L, a + W + H), (T, a, T, a + W), (a + L + H, a, a + L + H, a + W),
             (a + L, T, a + L, a), (a, T, a, a), (a + L, a + W, a + L, a + W + H), (a, a + W, a, a + W + H)]
    return " ".join(f"M{x1:g},{y1:g} L{x2:g},{y2:g}" for x1, y1, x2, y2 in lines)


def inner(svg):
    return svg[svg.index(">") + 1: svg.rindex("</svg>")].replace(f"<style>{FONTS_CSS}</style>", "")


def nest(svg, w, h, transform):
    return (f'<g transform="{transform}"><svg width="{w:g}" height="{h:g}" viewBox="0 0 {w:g} {h:g}" '
            f'overflow="hidden">{inner(svg)}</svg></g>')


def sheet(box, top, front, back, end, bg, labels=False):
    L, W, H, T, B = box["L"], box["W"], box["H"], TURN_IN, BLEED
    a = T + H
    SW, SH = 2 * a + L, 2 * a + W
    pad = 26 if labels else 0
    vx, vy, vw, vh = -B - pad, -B - pad, SW + 2 * (B + pad), SH + 2 * (B + pad)
    g = []
    if labels:
        g.append(f'<rect x="{vx}" y="{vy}" width="{vw}" height="{vh}" fill="#fff"/>')
    g.append(f'<g id="artwork"><rect x="{-B}" y="{-B}" width="{SW + 2 * B}" height="{SH + 2 * B}" fill="{bg}"/>')
    g.append(nest(top, L, W, f"translate({a},{a})"))
    g.append(nest(front, L, H, f"translate({a},{a + W})"))
    g.append(nest(back, L, H, f"translate({a + L},{a}) rotate(180)"))
    g.append(nest(end, W, H, f"translate({T + H},{a}) rotate(90)"))
    g.append(nest(end, W, H, f"translate({a + L},{a + W}) rotate(-90)"))
    g.append("</g>")
    g.append(f'<g id="dieline" fill="none" stroke-width="0.3">'
             f'<path d="{outline(L, W, H, T)}" stroke="#EC008C"/>'
             f'<path d="{folds(L, W, H, T)}" stroke="#00AEEF" stroke-dasharray="2.5 1.5"/></g>')
    if labels:
        s = 'font-family="Brand" font-size="5" fill="#333"'
        dim = lambda x1, y1, x2, y2: f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="#333" stroke-width=".25"/>'
        y0 = -B - 9
        g.append(dim(a, y0, a + L, y0) + f'<text x="{a + L / 2}" y="{y0 - 2}" {s} text-anchor="middle">{L:g} mm</text>')
        g.append(dim(0, y0 - 10, SW, y0 - 10) + f'<text x="{SW / 2}" y="{y0 - 12}" {s} text-anchor="middle">{SW:g} mm trim</text>')
        x0 = SW + B + 8
        for y1, y2, v in [(a, a + W, W), (a + W, a + W + H, H), (a + W + H, SH, T)]:
            g.append(dim(x0, y1, x0, y2) + f'<text x="{x0 + 2}" y="{(y1 + y2) / 2 + 1.8}" {s} text-anchor="start">{v:g}</text>')
        g.append(f'<text x="{-B}" y="{SH + B + 11}" font-family="Brand" font-size="4.4" fill="#333">'
                 f'<tspan fill="#EC008C">cut</tspan>  ·  <tspan fill="#00AEEF">fold</tspan>  ·  bleed {B} mm  ·  turn-in {T} mm</text>')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{vw:g}mm" height="{vh:g}mm" '
            f'viewBox="{vx:g} {vy:g} {vw:g} {vh:g}"><style>{FONTS_CSS}</style>{"".join(g)}</svg>')


def write(path, svg):
    with open(path, "w", encoding="utf-8") as f:
        f.write(svg)


VARIANTS = {"a": (top_a, front_a), "b": (top_b, front_b), "c": (top_c, front_c)}


def build():
    global MODE
    for old in os.listdir(FACES):
        os.remove(os.path.join(FACES, old))
    art = {}
    for MODE in ("art", "mask", "foil"):
        sfx = "" if MODE == "art" else "-" + MODE
        f = {"lid-back": lid_back(), "lid-end": lid_end(),
             "base-side-long": base_side(BASE["L"], BASE["H"]), "base-side-short": base_side(BASE["W"], BASE["H"]),
             "base-bottom": base_bottom(), "insert-card": insert_card()}
        for v, (top, front) in VARIANTS.items():
            f[f"{v}-lid-top"], f[f"{v}-lid-front"] = top(), front()
        for k, svg in f.items():
            write(os.path.join(FACES, f"{k}{sfx}.svg"), svg)
        if MODE == "art":
            art = f
    MODE = "art"
    for v in VARIANTS:
        args = (LID, art[f"{v}-lid-top"], art[f"{v}-lid-front"], art["lid-back"], art["lid-end"], NAVY)
        write(os.path.join(OUT, f"lid-dieline-{v}.svg"), sheet(*args))
        write(os.path.join(OUT, f"lid-dieline-{v}-annotated.svg"), sheet(*args, labels=True))
    write(os.path.join(OUT, "base-dieline.svg"),
          sheet(BASE, art["base-bottom"], art["base-side-long"], art["base-side-long"], art["base-side-short"], "#D9B04F"))
    write(os.path.join(OUT, "insert-card.svg"), art["insert-card"])
    print("ok")


if __name__ == "__main__":
    build()
