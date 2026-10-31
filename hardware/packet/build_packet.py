"""Build the MeSticker pilot packet for Patrick: intro pages (HTML) + booth drawing set (SVG) -> one HTML for PDF."""
import base64, os, json, html
S = "/tmp/claude-0/-home-user-mesticker/febe8a44-5f9a-532b-9874-b06153d8b779/scratchpad"
OUT = os.path.join(S, "packet")
KIMG = os.path.join(S, "kiosk/site/img")
PIMG = os.path.join(S, "kiosk/pro/fab/img")
SHEETS = os.path.join(S, "kiosk/pro/fab/sheets")

def b64(path):
    ext = "png" if path.endswith(".png") else "jpeg"
    return f"data:image/{ext};base64," + base64.b64encode(open(path, "rb").read()).decode()

INK, MUTED, VIO, PINK, LINE, SOFT = "#1F1B2E", "#6E6888", "#5B3FD6", "#E8457E", "#E3DEF2", "#F5F3FB"
CSS = f"""
@page {{ size: 17in 11in; margin: 0 }}
* {{ box-sizing: border-box; margin: 0 }}
body {{ font-family: Inter, 'Helvetica Neue', Arial, sans-serif; color: {INK}; }}
.page {{ width: 1632px; height: 1056px; position: relative; overflow: hidden; page-break-after: always; padding: 56px 64px 90px; background: #fff; }}
.foot {{ position: absolute; left: 64px; right: 64px; bottom: 28px; display: flex; justify-content: space-between; font-size: 13px; color: {MUTED}; border-top: 1px solid {LINE}; padding-top: 12px; }}
.eyebrow {{ font-size: 13px; letter-spacing: .1em; text-transform: uppercase; color: {VIO}; font-weight: 700; }}
h1 {{ font-size: 64px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.02; }}
h2 {{ font-size: 36px; font-weight: 800; letter-spacing: -0.01em; margin: 8px 0 18px; }}
h3 {{ font-size: 19px; font-weight: 800; margin-bottom: 6px; }}
p, li {{ font-size: 16.5px; line-height: 1.5; }}
.muted {{ color: {MUTED}; }}
.grid2 {{ display: grid; grid-template-columns: 1fr 1fr; gap: 36px; }}
.grid3 {{ display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 28px; }}
img.r {{ width: 100%; border-radius: 14px; display: block; border: 1px solid {LINE}; }}
.card {{ border: 1px solid {LINE}; border-radius: 14px; padding: 18px 20px; background: #fff; }}
.soft {{ background: {SOFT}; border: none; }}
table {{ border-collapse: collapse; width: 100%; font-size: 15px; }}
th {{ text-align: left; font-size: 12px; letter-spacing: .06em; text-transform: uppercase; color: {MUTED}; padding: 9px 12px; background: {SOFT}; }}
td {{ padding: 9px 12px; border-bottom: 1px solid {LINE}; vertical-align: top; }}
td.n {{ text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }}
tr.total td {{ font-weight: 800; background: {SOFT}; }}
ul {{ padding-left: 20px; display: grid; gap: 6px; }}
.pill {{ display: inline-block; background: {VIO}; color: #fff; font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 999px; letter-spacing: .04em; }}
.drawing {{ width: 1632px; height: 1056px; page-break-after: always; }}
.drawing svg {{ width: 1632px; height: 1056px; display: block; }}
"""

def foot(n):
    return f'<div class="foot"><span>MeSticker · physical experience pilot packet · Rev B · Oct 27 2026</span><span>Prepared for Patrick · page {n}</span></div>'

pages = []

# ---------------------------------------------------------------- 1 cover
pages.append(f"""<div class="page" style="padding:0">
<img src="{b64(os.path.join(PIMG,'pro_hero.jpg'))}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">
<div style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(14,10,24,.92) 0%,rgba(14,10,24,.75) 38%,rgba(14,10,24,0) 62%)"></div>
<div style="position:absolute;left:72px;top:90px;width:640px;color:#fff">
  <div class="eyebrow" style="color:#C9B8FF">Physical experience · pilot packet</div>
  <h1 style="margin-top:18px;color:#fff">MeSticker<br>Photo Booth<br>&amp; Kiosk</h1>
  <p style="font-size:22px;margin-top:26px;color:#E9E4FA">A walk-up machine that turns a group selfie into cut-around AI cartoon stickers in about two minutes. Pay, snap, and a printed sticker strip comes out.</p>
  <div style="margin-top:40px;display:grid;gap:10px;font-size:17px;color:#D8D1F2">
    <div><b style="color:#fff">Two formats:</b> a countertop kiosk and a walk-in booth with a curtain</div>
    <div><b style="color:#fff">One shared stack:</b> touchscreen laptop, print-and-cut sticker printer, tap-to-pay reader</div>
    <div><b style="color:#fff">The ask:</b> scope and build pilot unit #1 together, then pilot in NYC</div>
  </div>
  <p style="margin-top:56px;font-size:15px;color:#B9B1D8">Prepared for Patrick by Bradley · Rev B · October 27, 2026<br>All renders and drawings are design intent; dimensions get confirmed against real parts before cutting.</p>
</div></div>""")

# ---------------------------------------------------------------- 2 the idea + flow
flow = [("1", "Walk up", "Attract screen loops tonight's best stickers and the price"),
        ("2", "Tap to pay", "Card, Apple Pay or Google Pay on the reader. $20 a session"),
        ("3", "Pick a style", "Cartoon, chibi, anime and more, on the touchscreen"),
        ("4", "Snap", "Countdown with lights on; booth takes 4 poses"),
        ("5", "Peel", "Printer prints and cuts the strip; it drops into the tray")]
boxes = ""
for i, (n, t, d) in enumerate(flow):
    x = 24 + i * 300
    boxes += f"""<g><rect x="{x}" y="40" width="252" height="150" rx="14" fill="{'#EFEBFF' if i in (1,4) else '#fff'}" stroke="{VIO if i in (1,4) else '#CFC8E6'}" stroke-width="{2 if i in (1,4) else 1.2}"/>
<circle cx="{x+30}" cy="74" r="16" fill="{VIO}"/><text x="{x+30}" y="80" text-anchor="middle" font-size="16" font-weight="800" fill="#fff">{n}</text>
<text x="{x+56}" y="81" font-size="21" font-weight="800" fill="{INK}">{t}</text>
<foreignObject x="{x+18}" y="100" width="220" height="84"><div xmlns="http://www.w3.org/1999/xhtml" style="font-size:15px;line-height:1.45;color:{MUTED}">{d}</div></foreignObject></g>"""
    if i < 4:
        boxes += f'<path d="M{x+258} 115 H{x+294}" stroke="#9A93B8" stroke-width="2" marker-end="url(#a)"/>'
pages.append(f"""<div class="page">
<div class="eyebrow">The idea</div><h2>Photo booths, but you walk out with stickers of your crew</h2>
<div class="grid2" style="grid-template-columns:1.25fr 1fr;align-items:start">
<div><p style="font-size:19px">People already pay for photo booths at bars and events (the median US rental is $681 per event). MeSticker keeps that format and changes the take-home. Guests get a strip of <b>cut-around AI cartoon stickers</b> that ends up on phones, laptops and water bottles. No attendant needed. We launch in <b>New York City at $20 a session</b>.</p></div>
<div class="card soft"><h3>What already exists</h3><ul>
<li>The MeSticker app: AI cartoon styles, working today</li>
<li>Full booth design with a 10-sheet fabrication drawing set, panel cut files (DXF) and a tube cut list</li>
<li>Countertop kiosk concept design</li>
<li>Parts list and pilot plan (this packet)</li></ul></div></div>
<h3 style="margin-top:34px">Guest flow · about 2 minutes</h3>
<svg viewBox="0 0 1504 210" width="1504" height="210"><defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#9A93B8"/></marker></defs>{boxes}</svg>
<div class="grid3" style="margin-top:22px">
<div class="card"><h3>Better take-home</h3><p class="muted">A sticker stays in view for months. A paper strip goes in a drawer.</p></div>
<div class="card"><h3>Runs itself</h3><p class="muted">Tap to pay, auto-print and auto-cut. The venue does nothing but plug it in.</p></div>
<div class="card"><h3>Two markets</h3><p class="muted">Placements in bars and venues, plus event rentals: weddings, corporate parties, brand activations.</p></div></div>
{foot(2)}</div>""")

# ---------------------------------------------------------------- 3 two formats
pages.append(f"""<div class="page">
<div class="eyebrow">Two formats, one stack</div><h2>Countertop kiosk or walk-in booth</h2>
<div class="grid2">
<div><img class="r" src="{b64(os.path.join(KIMG,'hero.jpg'))}" style="height:400px;object-fit:cover"><h3 style="margin-top:14px">A · Countertop kiosk <span class="pill">pilot first</span></h3>
<p class="muted">Sits on a bar counter. One person at a time, or small groups. Fast to build and easy to move between venues. It proves the whole stack.</p></div>
<div><img class="r" src="{b64(os.path.join(PIMG,'pro_hero.jpg'))}" style="height:400px;object-fit:cover"><h3 style="margin-top:14px">B · Walk-in booth</h3>
<p class="muted">The full photo booth with a velvet curtain, a marquee sign and a bench for 2–4 people. The bigger draw for events and busy venues. Fully drawn, ready to quote.</p></div></div>
<table style="margin-top:22px"><tr><th></th><th>A · Countertop kiosk</th><th>B · Walk-in booth</th></tr>
<tr><td><b>Size (approx.)</b></td><td>≈ 45 W × 55 D × 60 H cm. To be redrawn around the real printer (34.5 × 43 × 24 cm) and laptop</td><td>180 × 110 × 200 cm body, 231 cm with sign (drawn, F-02)</td></tr>
<tr><td><b>Construction</b></td><td>Small welded or folded frame + ACM or acrylic panels, or a mostly 3D-printed shell</td><td>1.5″ steel tube frame (≈ 47 m) + 3 mm ACM skins (8 sheets), 2 modules</td></tr>
<tr><td><b>Guests</b></td><td>1–2 at a time</td><td>2–4 per session, private behind the curtain</td></tr>
<tr><td><b>Best for</b></td><td>Bar counters, pop-ups, testing venues</td><td>Events, rentals, flagship venues</td></tr>
<tr><td><b>Build effort</b></td><td>Days to a couple of weeks</td><td>Several weeks</td></tr>
<tr><td><b>Parts cost</b></td><td>≈ $3.5–4K (stack) + enclosure materials</td><td>≈ $7.7–11.6K all-in prototype estimate</td></tr></table>
<p class="muted" style="margin-top:12px">Proposal: build A first to prove the printer, payment and software in a real bar. Then build B with the same stack inside it.</p>
{foot(3)}</div>""")

# ---------------------------------------------------------------- 4 the stack (system diagram + parts)
def node(x, y, w, h, title, sub, accent=False):
    return f"""<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="12" fill="{'#EFEBFF' if accent else '#fff'}" stroke="{VIO if accent else '#BFB8D9'}" stroke-width="{2 if accent else 1.3}"/>
<text x="{x+w/2}" y="{y+h/2-4}" text-anchor="middle" font-size="18" font-weight="800" fill="{INK}">{title}</text>
<text x="{x+w/2}" y="{y+h/2+18}" text-anchor="middle" font-size="13.5" fill="{MUTED}">{sub}</text>"""
def wire(x1, y1, x2, y2, label, color="#3A6FF2", dash=""):
    mx, my = (x1 + x2) / 2, (y1 + y2) / 2
    return f"""<path d="M{x1} {y1} L{x2} {y2}" stroke="{color}" stroke-width="2.2" {('stroke-dasharray="6 5"' if dash else '')} marker-end="url(#b)"/>
<rect x="{mx-len(label)*3.6-6}" y="{my-12}" width="{len(label)*7.2+12}" height="22" rx="6" fill="#fff"/><text x="{mx}" y="{my+4}" text-anchor="middle" font-size="12.5" font-weight="700" fill="{color}">{label}</text>"""
diag = f"""<svg viewBox="0 0 900 560" width="900" height="560"><defs><marker id="b" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="#7A74A0"/></marker></defs>
<text x="0" y="22" font-size="18" font-weight="800" fill="{INK}">How the parts connect</text>
{node(300, 210, 300, 100, 'Touchscreen laptop', 'Windows · runs the MeSticker booth app', True)}
{node(20, 60, 230, 80, 'Primera LX610', 'prints + cuts stickers from a roll')}
{node(650, 60, 230, 80, '4K USB webcam', 'eye level, beside the screen')}
{node(20, 420, 230, 80, 'LED lights', 'ring light / softbox bars')}
{node(650, 420, 230, 80, 'Stripe Reader S710', 'tap card or phone')}
{node(335, 440, 230, 80, 'Wi-Fi / LTE router', 'internet for AI + payments')}
{wire(300, 240, 250, 120, 'USB')}
{wire(600, 240, 650, 120, 'USB')}
{wire(300, 290, 250, 440, 'USB / switch')}
{wire(450, 310, 450, 440, 'Wi-Fi', '#2E9E5B')}
{wire(650, 460, 565, 475, 'Wi-Fi', '#2E9E5B', dash='1')}
<text x="450" y="548" text-anchor="middle" font-size="13" fill="{MUTED}">The internet link reaches the AI models and Stripe. The reader talks to Stripe directly. One wall plug feeds everything through a power strip.</text></svg>"""
pages.append(f"""<div class="page">
<div class="eyebrow">The stack · shared by both formats</div><h2>What runs inside the box</h2>
<div class="grid2" style="grid-template-columns:900px 1fr;gap:40px">
<div>{diag}</div>
<div><table><tr><th>Part</th><th>Pick</th><th class="n">Est. USD</th></tr>
<tr><td><b>Computer + screen</b></td><td>Bradley's touchscreen convertible laptop (Windows)</td><td class="n">have it</td></tr>
<tr><td><b>Sticker printer</b></td><td>Primera LX610 color label printer with built-in cutter + PTCreate Pro software</td><td class="n">≈ 2,850</td></tr>
<tr><td><b>Sticker media</b></td><td>White gloss label roll, 4″ wide</td><td class="n">confirm</td></tr>
<tr><td><b>Camera</b></td><td>4K USB webcam</td><td class="n">100–200</td></tr>
<tr><td><b>Payment</b></td><td>Stripe Reader S710</td><td class="n">≈ 300</td></tr>
<tr><td><b>Lighting</b></td><td>LED ring + light bars</td><td class="n">50–100</td></tr>
<tr><td><b>Power + network</b></td><td>Surge strip, LTE router backup</td><td class="n">100–200</td></tr>
<tr class="total"><td>Stack total</td><td></td><td class="n">≈ 3.4–3.65K</td></tr></table>
<div class="card soft" style="margin-top:20px"><h3>Fit-critical sizes to design around</h3><ul>
<li>Primera LX610 ≈ 345 × 432 × 242 mm, 5.7 kg (vendor listing). Paper exits the front</li>
<li>Laptop: measure open in tablet/stand mode; screen at eye level</li>
<li>Reader on a reachable shelf; webcam just above the screen</li>
<li>Airflow: intake low, exhaust high; service door for roll swaps</li></ul></div></div></div>
{foot(4)}</div>""")

# ---------------------------------------------------------------- 5 pilot plan + asks for Patrick
steps = [("This week", "Decide + order", ["Bradley orders printer, reader, webcam", "Patrick: what his shop can make + materials on hand", "Pick kiosk or booth for unit #1"]),
         ("Weeks 1–2", "Bench test", ["All parts on a table, wired up", "Booth software: tap → snap → print", "Gate: hands-free strip in < 2 min"]),
         ("Weeks 2–4", "Build unit #1", ["Patrick measures the real parts", "Final drawings + cut files for his tools", "Fabricate, fit electronics, test"]),
         ("Weeks 4–8", "NYC pilot", ["1–2 venues at $20 a session", "Track sessions, jams, refills", "Decide: more kiosks or the booth"])]
cols = ""
for i, (when, what, items) in enumerate(steps):
    lis = "".join(f"<li>{x}</li>" for x in items)
    cols += f"""<div class="card" style="border-top:5px solid {[VIO,PINK,'#E9811F','#1F1B2E'][i]};border-radius:6px 6px 14px 14px"><div class="eyebrow" style="color:{MUTED}">{when}</div><h3 style="margin-top:6px;font-size:22px">{what}</h3><ul class="muted">{lis}</ul></div>"""
pages.append(f"""<div class="page">
<div class="eyebrow">Pilot plan</div><h2>From idea to a working unit in a bar in about 8 weeks</h2>
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:20px">{cols}</div>
<div class="grid2" style="margin-top:30px">
<div class="card soft"><h3>Questions for Patrick</h3><ul>
<li>What can the shop do in-house: welding, sheet metal bending, CNC router, laser, 3D printing, paint or powder coat?</li>
<li>Preferred materials: steel tube + ACM (as drawn), aluminum extrusion, plywood/MDF + laminate, or acrylic?</li>
<li>Which unit first, kiosk or booth, and a realistic timeline for it?</li>
<li>Rough cost to build unit #1, and how you'd like to structure the pilot together</li>
<li>Anything in the drawings that is hard or expensive to make? Please mark it up.</li></ul></div>
<div class="card"><h3>Who does what</h3><table>
<tr><th>Bradley</th><th>Patrick</th></tr>
<tr><td>Buys the electronics stack</td><td>Reviews the drawings and marks them up</td></tr>
<tr><td>Builds the booth software + payments</td><td>Picks materials and methods</td></tr>
<tr><td>Bench-tests the printer and stack</td><td>Builds the enclosure for unit #1</td></tr>
<tr><td>Lines up NYC pilot venues</td><td>Helps install and service during the pilot</td></tr></table></div></div>
{foot(5)}</div>""")

# ---------------------------------------------------------------- 6 kiosk concept
pages.append(f"""<div class="page">
<div class="eyebrow">Format A · countertop kiosk (concept)</div><h2>Countertop kiosk: what's inside, and its size</h2>
<div class="grid2" style="grid-template-columns:1.35fr 1fr">
<img class="r" src="{b64(os.path.join(KIMG,'xray.jpg'))}" style="height:560px;object-fit:contain;background:#100E18">
<div style="display:grid;gap:16px"><img class="r" src="{b64(os.path.join(KIMG,'side.jpg'))}" style="height:272px;object-fit:contain;background:#F6F4FB"><img class="r" src="{b64(os.path.join(KIMG,'front.jpg'))}" style="height:272px;object-fit:contain;background:#F6F4FB"></div></div>
<p class="muted" style="margin-top:16px;max-width:1200px">This concept was drawn around an earlier, smaller printer and a dedicated 10″ screen (36 × 34 × 53 cm). With the chosen stack (Primera LX610 + the laptop) the box grows to about 45 × 55 × 60 cm. The layout stays the same: screen and camera up top, printer below, the sticker slot on the front, tap-to-pay on the ledge, service door at the back. We'll redraw it once we've measured the real parts together.</p>
{foot(6)}</div>""")

# ---------------------------------------------------------------- 7 booth intro (before the drawing set)
pages.append(f"""<div class="page">
<div class="eyebrow">Format B · walk-in booth</div><h2>The walk-in booth, inside and out</h2>
<div class="grid3" style="grid-template-columns:1.2fr 1fr 1fr">
<img class="r" src="{b64(os.path.join(PIMG,'pro_hero.jpg'))}" style="height:480px;object-fit:cover">
<img class="r" src="{b64(os.path.join(PIMG,'pro_inside.jpg'))}" style="height:480px;object-fit:cover">
<img class="r" src="{b64(os.path.join(PIMG,'fab_exploded_labeled.png'))}" style="height:480px;object-fit:contain;background:#fff"></div>
<div class="grid3" style="grid-template-columns:1.2fr 1fr 1fr;margin-top:12px">
<p class="muted">Outside: 43″ attract screen, sticker pickup tray, velvet curtain, marquee sign, printed vinyl wrap.</p>
<p class="muted">Inside the camera wall: 27″ touchscreen, camera with ring light, softbox bars, tap-to-pay shelf.</p>
<p class="muted">The machine module stays welded and rolls through a door. The bay is five bolt-together frames plus panels.</p></div>
<div class="card soft" style="margin-top:22px"><p><b>Next 10 pages: drawing set Rev A (F-01 to F-10).</b> Elevations, plan, inside walls, steel frame and tube cut list (≈ 47 m of 1.5″ tube), panel drawings and nesting (8 sheets of 4×8 ACM), wiring, details and assembly order. Units are mm. The separate file package has the DXF cut files for all 17 panels, CSV cut lists and 3D models (OBJ, STL, GLB, Blender). The drawings show a dedicated PC and screens; the laptop can stand in for the pilot.</p></div>
{foot(7)}</div>""")

# ---------------------------------------------------------------- drawing sheets
idx = json.load(open(os.path.join(SHEETS, "index.json")))
draws = []
import re
for s in idx:
    svg = open(os.path.join(SHEETS, s["num"] + ".svg")).read()
    def rep(m):
        p = os.path.join(PIMG, m.group(1))
        return f'href="{b64(p)}"' if os.path.exists(p) else m.group(0)
    svg = re.sub(r'href="img/([^"]+)"', rep, svg)
    draws.append(f'<div class="drawing">{svg}</div>')

# ---------------------------------------------------------------- last page: files
pages_end = f"""<div class="page">
<div class="eyebrow">What's in the file package</div><h2>Files for the shop</h2>
<table style="max-width:1100px"><tr><th>File</th><th>What it is</th></tr>
<tr><td><b>MeSticker_PhotoBooth_Fabrication_Drawings_RevA.pdf</b></td><td>The 10-sheet booth drawing set (also in this packet)</td></tr>
<tr><td><b>dxf/ (17 files)</b></td><td>One DXF per panel, in mm. Layers: OUTLINE, CUTOUT, TEXT. Ready for a CNC router or laser</td></tr>
<tr><td><b>tube_cut_list.csv</b></td><td>Steel tube cut list by sub-frame (length × quantity)</td></tr>
<tr><td><b>panel_schedule.csv</b></td><td>Every panel: size, material, cutout positions</td></tr>
<tr><td><b>3d/</b></td><td>Fabrication model as OBJ, STL (frame and panels) and GLB, plus the rendered Blender file</td></tr>
<tr><td><b>spec.py</b></td><td>The one dimension file every drawing, DXF and model is generated from. Change it and everything regenerates</td></tr></table>
<div class="card soft" style="margin-top:26px;max-width:1100px"><h3>Before cutting anything</h3><ul>
<li>Measure the real printer's paper exit height and the screens' VESA mounting patterns</li>
<li>The bay floor sits about 14 cm above the ground (one step). Keep it, or lower the floor frame</li>
<li>Confirm doorways and stairs at the first pilot venue</li></ul></div>
<p class="muted" style="margin-top:30px">Questions or mark-ups: Bradley. Send photos of marked-up pages, or reply with notes and the drawings will be revised to Rev B.</p>
{foot(18)}</div>"""

doc = f"<html><head><meta charset='utf-8'><style>{CSS}</style></head><body>{''.join(pages)}{''.join(draws)}{pages_end}</body></html>"
open(os.path.join(OUT, "packet.html"), "w").write(doc)
print("pages:", len(pages) + len(draws) + 1)
