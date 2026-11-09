"""Generate viri.ge social post HTML files (1080x1080). Run render.js afterwards."""
import os, json

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "html")
os.makedirs(OUT, exist_ok=True)

BASE_CSS = """
@font-face{font-family:G;font-weight:500;src:url(../assets/georgian-500.ttf)}
@font-face{font-family:G;font-weight:700;src:url(../assets/georgian-700.ttf)}
@font-face{font-family:G;font-weight:800;src:url(../assets/georgian-800.ttf)}
@font-face{font-family:G;font-weight:900;src:url(../assets/georgian-900.ttf)}
@font-face{font-family:L;font-weight:700;src:url(../assets/inter-700.ttf)}
@font-face{font-family:L;font-weight:800;src:url(../assets/inter-800.ttf)}
@font-face{font-family:L;font-weight:900;src:url(../assets/inter-900.ttf)}
:root{--y:#F2BE48;--w:#FFFDFC;--bg:#0B0405;--red:#8E1622}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1080px;overflow:hidden;background:var(--bg)}
body{font-family:L,G,'Noto Color Emoji',sans-serif;color:var(--w);position:relative}
.bg{position:absolute;inset:0;background-size:cover;background-repeat:no-repeat}
.shade{position:absolute;inset:0;
  background:linear-gradient(to top,rgba(11,4,5,.97) 0%,rgba(11,4,5,.88) 30%,rgba(11,4,5,.25) 62%,rgba(11,4,5,.35) 100%),
  radial-gradient(ellipse at 50% 40%,transparent 40%,rgba(11,4,5,.6) 100%)}
.frame{position:absolute;inset:24px;border:1.5px solid rgba(242,190,72,.32);border-radius:30px;pointer-events:none}
.logo{position:absolute;left:58px;top:56px;display:flex;align-items:center;gap:16px}
.logo img{width:74px;height:74px;border-radius:50%;box-shadow:0 0 0 2px rgba(242,190,72,.25)}
.logo b{display:block;font:900 46px/1 G;letter-spacing:.5px}
.logo i{display:block;font:800 16px/1 G;font-style:normal;color:var(--y);margin-top:6px;letter-spacing:1px}
.pill{position:absolute;right:58px;top:66px;padding:14px 26px;border-radius:40px;background:rgba(11,4,5,.72);
  border:1.5px solid rgba(255,255,255,.14);font:800 28px/1 L}
.copy{position:absolute;left:66px;right:66px;bottom:200px}
.kicker{font:800 28px/1.2 G;color:var(--y);margin-bottom:20px;letter-spacing:.3px}
h1{font:900 82px/1.13 G;letter-spacing:-.5px;text-shadow:0 4px 30px rgba(0,0,0,.5)}
h1 .y{color:var(--y)}
.sub{font:700 30px/1.35 G;color:rgba(255,253,252,.82);margin-top:22px}
.cta{position:absolute;left:66px;bottom:76px;display:flex;align-items:center;gap:30px}
.cta span{background:var(--y);color:#1A0B05;font:800 27px/1 G;padding:26px 40px;border-radius:50px}
.cta em{font:800 36px/1 L;font-style:normal}
.circ{position:relative;display:inline-block;padding:0 14px}
.circ::after{content:"";position:absolute;inset:-8px -6px -4px -6px;border:5px solid var(--y);border-radius:50%;transform:rotate(-4deg)}
"""

HEADER = """<div class="logo"><img src="../assets/emblem.png"><div><b>ვირი</b><i>SEO სააგენტო</i></div></div>
<div class="pill">🫏 viri.ge</div>"""


def page(body, css=""):
    return f"<!doctype html><html><head><meta charset='utf-8'><style>{BASE_CSS}{css}</style></head><body>{body}<div class='frame'></div></body></html>"


def photo_post(img, pos, size, headline, cta, kicker="", sub="", extra_css="", flip=False, h1size=None):
    flip_css = ".bg{transform:scaleX(-1)}" if flip else ""
    h = f"style='font-size:{h1size}px'" if h1size else ""
    body = f"""<div class="bg" style="background-image:url(../assets/{img});background-position:{pos};background-size:{size}"></div>
<div class="shade"></div>{HEADER}
<div class="copy">{f'<div class="kicker">{kicker}</div>' if kicker else ''}<h1 {h}>{headline}</h1>{f'<div class="sub">{sub}</div>' if sub else ''}</div>
<div class="cta"><span>{cta}</span><em>viri.ge</em></div>"""
    return page(body, flip_css + extra_css)


POSTS = {}

POSTS["01-top1-ert-kviraSi"] = photo_post(
    "portrait.jpg", "50% 0%", "1080px auto",
    "<span class='circ'>TOP-1</span> ერთ კვირაში?<br><span class='y'>ამას ვირიც არ დაიჯერებს.</span>",
    "რეალური SEO გეგმა", h1size=78)

POSTS["02-sanam-konkurents-sZinavs"] = photo_post(
    "desk.jpg", "38% 0%", "auto 1080px",
    "სანამ კონკურენტს სძინავს,<br><span class='y'>ვირი მუშაობს.</span>",
    "დაგვიკავშირდი", kicker="ტექნიკური SEO · კონტენტი · ლინკები")

POSTS["03-jiutoba-superZala"] = photo_post(
    "holding.jpg", "50% 30%", "1080px auto",
    "სიჯიუტე ჩვენი<br><span class='y'>სუპერძალაა.</span>",
    "უფასო აუდიტი", kicker="Google-იც კი დაგვნებდება 😏",
    extra_css=".shade{background:linear-gradient(to top,rgba(11,4,5,.97) 0%,rgba(11,4,5,.85) 28%,rgba(11,4,5,0) 55%),radial-gradient(ellipse at 50% 40%,transparent 45%,rgba(11,4,5,.55) 100%)}")

# --- 04: checklist ---
items = [
    ("საიტი 3 წამზე მეტხანს იტვირთება", "სიჩქარე"),
    ("მობილურზე ღილაკებს თითით ვერ იჭერ", "მობილური"),
    ("საკუთარი ბრენდის სახელით Google-ში ვერ გპოულობენ", "ინდექსაცია"),
    ("გვერდებს ერთნაირი Title და Description აქვს", "მეტა"),
    ("ბლოგზე ბოლო სტატია შარშან დაიწერა", "კონტენტი"),
]
li = "".join(f"<li><b>{i+1}</b><div><p>{t}</p><small>{tag}</small></div></li>" for i, (t, tag) in enumerate(items))
POSTS["04-5-niSani-saiti-koWlobs"] = page(f"""
<div class="bg" style="background-image:url(../assets/portrait.jpg);background-size:620px auto;background-position:right -150px top 40px;opacity:.55"></div>
<div class="shade" style="background:linear-gradient(90deg,rgba(11,4,5,1) 45%,rgba(11,4,5,.55) 75%,rgba(11,4,5,.2) 100%),linear-gradient(to top,rgba(11,4,5,1) 10%,transparent 40%)"></div>
{HEADER}
<div class="list">
  <h1 style="font-size:56px">5 ნიშანი, რომ შენი<br>საიტი <span class="y">კოჭლობს</span></h1>
  <ol>{li}</ol>
</div>
<div class="cta"><span>უფასო აუდიტი</span><em>viri.ge</em></div>
""", """
.list{position:absolute;left:66px;right:66px;top:176px}
ol{list-style:none;margin-top:26px;display:flex;flex-direction:column;gap:12px}
li{display:flex;align-items:center;gap:22px;background:rgba(255,255,255,.05);border:1.5px solid rgba(255,255,255,.08);border-radius:22px;padding:12px 22px;width:800px;backdrop-filter:blur(6px)}
li b{flex:none;width:46px;height:46px;border-radius:50%;background:var(--y);color:#1A0B05;font:900 25px/46px L;text-align:center}
li p{font:700 24px/1.25 G}
li small{display:block;font:700 16px/1 G;color:var(--y);margin-top:7px;opacity:.85;letter-spacing:.5px}
""")

# --- 05: page 2 joke ---
POSTS["05-meore-gverdi"] = page(f"""
<div class="glow"></div>{HEADER}
<div class="serp">
  <div class="gbar"><span>შენი საიტი</span><svg width="30" height="30" viewBox="0 0 24 24"><circle cx="10" cy="10" r="7" stroke="#9aa0a6" stroke-width="2.5" fill="none"/><path d="M15 15l6 6" stroke="#9aa0a6" stroke-width="2.5" stroke-linecap="round"/></svg></div>
  <div class="pages"><i>‹</i><span>1</span><span class="on">2</span><span>3</span><span>4</span><span>5</span><i>›</i><div class="note">↑ შენ აქ ხარ</div></div>
</div>
<div class="copy">
  <h1 style="font-size:62px">Google-ის <span class="circ">მე-2</span> გვერდი<br><span class="y">საიდუმლოს დასამალად<br>საუკეთესო ადგილია.</span></h1>
  <div class="sub">შენი საიტი იქ რას აკეთებს? 🫏</div>
</div>
<div class="cta"><span>პირველ გვერდზე ამოსვლა</span><em>viri.ge</em></div>
""", """
body{background:radial-gradient(ellipse at 70% 0%,#4a0d14 0%,#1a0608 45%,#0B0405 75%)}
.glow{position:absolute;width:700px;height:700px;right:-200px;top:-200px;background:radial-gradient(circle,rgba(242,190,72,.12),transparent 65%)}
.serp{position:absolute;left:66px;right:66px;top:190px;padding:34px 38px;border-radius:28px;background:rgba(255,255,255,.06);border:1.5px solid rgba(255,255,255,.12);box-shadow:0 30px 80px rgba(0,0,0,.4)}
.gbar{display:flex;justify-content:space-between;align-items:center;background:#fff;border-radius:40px;padding:18px 30px;color:#202124;font:500 28px/1 G}
.pages{display:flex;gap:16px;align-items:center;margin-top:30px;font:800 34px/1 L;color:rgba(255,255,255,.45)}
.pages span,.pages i{width:62px;height:62px;display:grid;place-items:center;border-radius:16px;font-style:normal}
.pages .on{background:var(--y);color:#1A0B05;box-shadow:0 0 40px rgba(242,190,72,.5)}
.pages{position:relative;padding-bottom:44px}.note{position:absolute;left:146px;top:78px;font:800 24px/1 G;color:var(--y)}
""")

POSTS["06-balaxs-bevri-Wams"] = photo_post(
    "holding.jpg", "50% 8%", "1180px auto",
    "ბალახს ბევრი ჭამს.<br><span class='y'>ვირივით შრომა<br>ცოტას შეუძლია.</span>",
    "1 თვე სცადე", h1size=78,
    extra_css=".shade{background:linear-gradient(to top,rgba(11,4,5,.98) 0%,rgba(11,4,5,.9) 36%,rgba(11,4,5,.1) 64%,rgba(11,4,5,.3) 100%)}")

POSTS["07-erti-tve-scade"] = photo_post(
    "desk.jpg", "100% 10%", "auto 1240px",
    "ერთი თვე სცადე.<br><span class='y'>დანარჩენს შედეგი<br>იტყვის.</span>",
    "დაიწყე ახლა")

POSTS["08-beqlinkebi"] = photo_post(
    "portrait.jpg", "50% 0%", "1080px auto",
    "ბექლინკებს კილოობით<br>არ ვყიდულობთ.<br><span class='y'>ვიმსახურებთ.</span>",
    "ლინკბილდინგი", flip=True, h1size=76,
    extra_css=".shade{background:linear-gradient(to top,rgba(11,4,5,.98) 0%,rgba(11,4,5,.9) 38%,rgba(11,4,5,.2) 66%,rgba(11,4,5,.3) 100%)}")

POSTS["09-fumfula-maskotebi"] = photo_post(
    "desk.jpg", "30% 0%", "auto 1320px",
    "ფუმფულა მასკოტები სხვებს.<br><span class='y'>ჩვენ შედეგი<br>გვიყვარს.</span>",
    "უფასო აუდიტი", h1size=76)

for name, html in POSTS.items():
    with open(os.path.join(OUT, name + ".html"), "w", encoding="utf-8") as f:
        f.write(html)
json.dump(list(POSTS), open(os.path.join(OUT, "index.json"), "w"))
print("built", len(POSTS))
