"""Generate the MeSticker Photo Booth fabrication drawing set (SVG sheets, 17x11 in) from spec.py."""
import math, os, sys, json, html, datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from spec import *

OUT = sys.argv[1] if len(sys.argv) > 1 else "sheets"
os.makedirs(OUT, exist_ok=True)
W, Hh = 1632, 1056
INK, DIM, MUTED, ACC = "#1F1B2E", "#5B3FD6", "#8A84A3", "#E8457E"
FILL = {"plum": "#E9E3F8", "white": "#FFFFFF", "screen": "#D7ECFF", "glass": "#2B2B33", "curtain": "#F6D3E2",
        "steel": "#C9CBD6", "equip": "#FFF1D6", "sign": "#3A3354", "floor": "#E4E1EA"}
DATE = "2026-10-24"
FONT = "Inter, 'Helvetica Neue', Arial, sans-serif"

def esc(s):
    return html.escape(str(s))

class Sheet:
    def __init__(self, num, title, subtitle=""):
        self.num, self.title, self.subtitle = num, title, subtitle
        self.el = []
    def add(self, s):
        self.el.append(s)
    def rect(self, x, y, w, h, fill="none", stroke=INK, sw=1.4, dash=None, rx=0, op=1):
        d = f' stroke-dasharray="{dash}"' if dash else ""
        self.add(f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{rx}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"{d} opacity="{op}"/>')
    def line(self, x1, y1, x2, y2, stroke=INK, sw=1.2, dash=None):
        d = f' stroke-dasharray="{dash}"' if dash else ""
        self.add(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{stroke}" stroke-width="{sw}"{d}/>')
    def poly(self, pts, fill="none", stroke=INK, sw=1.0, op=1):
        p = " ".join(f"{x:.1f},{y:.1f}" for x, y in pts)
        self.add(f'<polygon points="{p}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" stroke-linejoin="round" opacity="{op}"/>')
    def circle(self, x, y, r, fill="none", stroke=INK, sw=1.0):
        self.add(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>')
    def text(self, x, y, s, size=12, fill=INK, anchor="start", weight=500, italic=False, rot=0):
        st = ' font-style="italic"' if italic else ""
        tr = f' transform="rotate({rot} {x:.1f} {y:.1f})"' if rot else ""
        self.add(f'<text x="{x:.1f}" y="{y:.1f}" font-family="{FONT}" font-size="{size}" font-weight="{weight}" fill="{fill}" text-anchor="{anchor}"{st}{tr}>{esc(s)}</text>')
    def arrow(self, x, y, ang, size=7, color=DIM):
        a1, a2 = ang + 0.42, ang - 0.42
        self.poly([(x, y), (x - size * math.cos(a1), y - size * math.sin(a1)), (x - size * math.cos(a2), y - size * math.sin(a2))], fill=color, stroke=color, sw=0.5)
    def dim(self, p1, p2, off, label, size=12):
        """Aligned dimension between two px points; off = perpendicular offset in px (sign picks side)."""
        (x1, y1), (x2, y2) = p1, p2
        dx, dy = x2 - x1, y2 - y1
        L_ = math.hypot(dx, dy) or 1
        nx, ny = -dy / L_, dx / L_
        if abs(dy) > abs(dx):          # vertical: positive offset = left
            off = -off
        a = (x1 + nx * off, y1 + ny * off)
        b = (x2 + nx * off, y2 + ny * off)
        ext = 6 if off > 0 else -6
        self.line(x1 + nx * 3 * (1 if off > 0 else -1), y1 + ny * 3 * (1 if off > 0 else -1), a[0] + nx * ext, a[1] + ny * ext, stroke=MUTED, sw=0.8)
        self.line(x2 + nx * 3 * (1 if off > 0 else -1), y2 + ny * 3 * (1 if off > 0 else -1), b[0] + nx * ext, b[1] + ny * ext, stroke=MUTED, sw=0.8)
        self.line(*a, *b, stroke=DIM, sw=1.0)
        ang = math.atan2(b[1] - a[1], b[0] - a[0])
        self.arrow(*b, ang)
        self.arrow(*a, ang + math.pi)
        mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
        rot = math.degrees(ang)
        if rot > 90 or rot < -90:
            rot += 180
        tw = len(label) * size * 0.58 + 8
        self.add(f'<g transform="translate({mx:.1f} {my:.1f}) rotate({rot:.1f})"><rect x="{-tw/2:.1f}" y="{-size*0.75:.1f}" width="{tw:.1f}" height="{size*1.5:.1f}" fill="#fff" rx="3"/>'
                 f'<text x="0" y="{size*0.36:.1f}" font-family="{FONT}" font-size="{size}" font-weight="600" fill="{DIM}" text-anchor="middle">{esc(label)}</text></g>')
    def leader(self, x, y, tx, ty, label, size=11, anchor="start"):
        self.circle(x, y, 2.6, fill=ACC, stroke=ACC)
        self.line(x, y, tx, ty, stroke=ACC, sw=0.9)
        self.text(tx + (4 if anchor == "start" else -4), ty + 4, label, size=size, anchor=anchor, weight=600)
    def image(self, x, y, w, h, href):
        self.add(f'<image x="{x}" y="{y}" width="{w}" height="{h}" href="{href}" preserveAspectRatio="xMidYMid slice"/>')
    def table(self, x, y, cols, rows, widths, size=11, rh=18, head_fill="#EFEBFA", zebra="#FAF9FD"):
        tw = sum(widths)
        self.rect(x, y, tw, rh, fill=head_fill, stroke="none")
        cx = x
        for c, w in zip(cols, widths):
            self.text(cx + 6, y + rh - 5, c.upper(), size=size - 2, fill=MUTED, weight=700)
            cx += w
        for i, r in enumerate(rows):
            yy = y + rh * (i + 1)
            if i % 2:
                self.rect(x, yy, tw, rh, fill=zebra, stroke="none")
            cx = x
            for j, (c, w) in enumerate(zip(r, widths)):
                num = isinstance(c, (int, float))
                self.text(cx + (w - 6 if num else 6), yy + rh - 5, c, size=size, anchor="end" if num else "start", weight=600 if j == 0 else 500)
                cx += w
        self.rect(x, y, tw, rh * (len(rows) + 1), stroke="#D9D4E8", sw=0.8)
        return y + rh * (len(rows) + 1)
    def notes(self, x, y, title, lines, size=11.5, width=60):
        self.text(x, y, title.upper(), size=10.5, fill=MUTED, weight=700)
        yy = y + 18
        for ln in lines:
            words, cur = ln.split(), ""
            first = True
            for w_ in words:
                if len(cur + " " + w_) > width:
                    self.text(x + (0 if first else 12), yy, ("• " if first else "") + cur.strip(), size=size)
                    yy += size * 1.45; cur = w_; first = False
                else:
                    cur += " " + w_
            self.text(x + (0 if first else 12), yy, ("• " if first else "") + cur.strip(), size=size)
            yy += size * 1.45 + 3
        return yy
    def svg(self):
        tb = []
        tb.append(f'<rect x="12" y="12" width="{W-24}" height="{Hh-24}" fill="none" stroke="{INK}" stroke-width="1.6"/>')
        tb.append(f'<line x1="12" y1="{Hh-78}" x2="{W-12}" y2="{Hh-78}" stroke="{INK}" stroke-width="1.2"/>')
        tb.append(f'<text x="28" y="{Hh-50}" font-family="{FONT}" font-size="22" font-weight="800" fill="{INK}">MeSticker Photo Booth</text>')
        tb.append(f'<text x="28" y="{Hh-28}" font-family="{FONT}" font-size="12" fill="{MUTED}">Fabrication drawing set · units mm · do not scale drawings, use dimensions · tolerance ±2 mm unless noted</text>')
        x = W - 640
        for i, (k, v) in enumerate((("Sheet", self.num), ("Title", self.title), ("Rev", "A"), ("Date", DATE))):
            wcol = (90, 330, 70, 120)[i]
            tb.append(f'<line x1="{x}" y1="{Hh-78}" x2="{x}" y2="{Hh-12}" stroke="{INK}" stroke-width="1"/>')
            tb.append(f'<text x="{x+10}" y="{Hh-56}" font-family="{FONT}" font-size="10" font-weight="700" fill="{MUTED}">{k.upper()}</text>')
            tb.append(f'<text x="{x+10}" y="{Hh-30}" font-family="{FONT}" font-size="{20 if k=="Sheet" else 15}" font-weight="800" fill="{INK}">{esc(v)}</text>')
            x += wcol
        head = f'<text x="32" y="50" font-family="{FONT}" font-size="26" font-weight="800" fill="{INK}">{esc(self.num)} · {esc(self.title)}</text>'
        if self.subtitle:
            head += f'<text x="32" y="74" font-family="{FONT}" font-size="13" fill="{MUTED}">{esc(self.subtitle)}</text>'
        body = "\n".join(self.el)
        return (f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 {W} {Hh}" width="{W}" height="{Hh}">'
                f'<rect width="{W}" height="{Hh}" fill="#fff"/>{head}{body}{"".join(tb)}</svg>')

class View:
    """Maps drawing coords (u right, v up, mm) to sheet px."""
    def __init__(self, ox, oy, s):
        self.ox, self.oy, self.s = ox, oy, s
    def p(self, u, v):
        return (self.ox + u * self.s, self.oy - v * self.s)
    def r(self, sh, u0, v0, u1, v1, **kw):
        x0, y0 = self.p(min(u0, u1), max(v0, v1))
        sh.rect(x0, y0, abs(u1 - u0) * self.s, abs(v1 - v0) * self.s, **kw)

sheets = []

# ================================================================ F-01 general arrangement
s = Sheet("F-01", "General arrangement", "Walk-in AI sticker booth: machine module (screens, camera, printer) + curtained guest bay")
s.image(32, 92, 820, 615, "img/pro_hero.jpg")
s.rect(32, 92, 820, 615, stroke="#D9D4E8")
s.image(872, 92, 360, 270, "img/pro_inside.jpg")
s.rect(872, 92, 360, 270, stroke="#D9D4E8")
s.image(1252, 92, 348, 270, "img/pro_xray.jpg")
s.rect(1252, 92, 348, 270, stroke="#D9D4E8")
s.text(872, 380, "Inside: camera wall", 11, MUTED, weight=700)
s.text(1252, 380, "Frame + equipment (x-ray)", 11, MUTED, weight=700)
y = s.table(872, 400, ["Overall", "mm"], [
    ["Length (machine 600 + bay 1200)", L], ["Depth", D], ["Body height (incl. 80 plinth)", H],
    ["Height with sign", TOTAL_H], ["Curtain opening (w × h)", f"{OPENING['x1']-OPENING['x0']} × {OPENING['z1']-OPENING['z0']}"],
    ["Machine module (rolls in whole)", f"{XM} × {D} × {H}"], ["Guest bay (flat-pack)", f"{L-XM} × {D} × {H}"],
    ["Est. weight, all-in", "≈ 180–230 kg"]], [520, 208])
s.notes(872, y + 30, "Construction", [
    "Frame: 1.5\" (38.1 mm) square steel tube, 16 ga, MIG welded, powder-coated black. See F-05.",
    "Skins: 3 mm aluminum composite panel (ACM), riveted or VHB-bonded to the frame, gloss plum outside, gloss white on the camera wall. See F-06.",
    "The machine module is one welded frame on 4 locking casters. The bay is 5 bolt-together sub-frames (end, back, front, floor, roof), joined to the machine posts with M8 bolts. See F-09.",
    "All electronics live in the machine module, behind a locked service door on its end wall. One power cord goes to the wall. See F-04 and F-08.",
    "The marquee sign is a separate box that bolts to the roof frame and plugs in.",
], width=78)
s.notes(32, 740, "Sheet index", [
    "F-01 General arrangement   ·   F-02 Front + end elevations   ·   F-03 Plan + back elevation   ·   F-04 Inside elevations (camera wall, machine section)",
    "F-05 Steel frame + tube cut list   ·   F-06 Panel drawings   ·   F-07 Panel schedule + sheet nesting   ·   F-08 Electrical + data   ·   F-09 Details   ·   F-10 Assembly",
], width=170)
sheets.append(s)

# ================================================================ F-02 front + end elevations
s = Sheet("F-02", "Front + end elevations")
v = View(90, 820, 0.31)
# front elevation (looking at y = 0 face): u = x, v = z
v.r(s, 30, 0, L - 30, PLINTH, fill="#3A3646", stroke=INK)
v.r(s, 0, PLINTH, XM, H, fill=FILL["white"])
v.r(s, XM, PLINTH, L, H, fill=FILL["plum"])
v.r(s, OPENING["x0"], OPENING["z0"], OPENING["x1"], OPENING["z1"], fill="#FBFAFE", stroke=INK)
for i in range(16):                               # curtain, gathered to the right
    u = OPENING["x0"] + (OPENING["x1"] - OPENING["x0"]) * (0.55 + 0.45 * i / 15)
    s.line(*v.p(u, OPENING["z0"] + 30), *v.p(u, OPENING["z1"] - 20), stroke=ACC, sw=1.1)
s.line(*v.p(OPENING["x0"] - 30, CURTAIN["rod_z"]), *v.p(OPENING["x1"] + 30, CURTAIN["rod_z"]), stroke="#B08440", sw=3)
v.r(s, -10, H, L + 10, H + ROOF_T, fill=FILL["plum"])
v.r(s, SIGN["x0"], SIGN["z0"], SIGN["x1"], SIGN["z1"], fill=FILL["sign"])
for i in range(SIGN["bulbs_per_row"]):
    u = SIGN["x0"] + 40 + i * (SIGN["x1"] - SIGN["x0"] - 80) / (SIGN["bulbs_per_row"] - 1)
    for z in (SIGN["z0"] + 35, SIGN["z1"] - 35):
        s.circle(*v.p(u, z), SIGN["bulb_dia"] / 2 * v.s, fill="#FFD9A0", stroke="#B08440", sw=0.6)
s.text(*v.p(L / 2, (SIGN["z0"] + SIGN["z1"]) / 2 - 22), "MeSticker", 22, "#FFFFFF", "middle", 800)
bw, bh = ATTRACT["bezel"]
v.r(s, ATTRACT["cx"] - bw / 2, ATTRACT["cz"] - bh / 2, ATTRACT["cx"] + bw / 2, ATTRACT["cz"] + bh / 2, fill=FILL["glass"])
aw, ah = ATTRACT["active"]
v.r(s, ATTRACT["cx"] - aw / 2, ATTRACT["cz"] - ah / 2, ATTRACT["cx"] + aw / 2, ATTRACT["cz"] + ah / 2, fill=FILL["screen"], stroke="none")
s.text(*v.p(ATTRACT["cx"], ATTRACT["cz"]), '43" attract', 11, INK, "middle", 700)
v.r(s, PICKUP["x0"], PICKUP["z0"], PICKUP["x1"], PICKUP["z1"], fill="#2B2B33")
v.r(s, PICKUP["x0"] - 10, PICKUP["lip_z"], PICKUP["x1"] + 10, PICKUP["z0"], fill="#D9A54A")
s.line(*v.p(XM, PLINTH), *v.p(XM, H), stroke=INK, sw=1.6)
# dims
s.dim(v.p(0, 0), v.p(L, 0), 34, f"{L}")
s.dim(v.p(0, 0), v.p(XM, 0), 62, f"{XM} machine")
s.dim(v.p(XM, 0), v.p(L, 0), 62, f"{L-XM} guest bay")
s.dim(v.p(OPENING["x0"], OPENING["z1"]), v.p(OPENING["x1"], OPENING["z1"]), -16, f"{OPENING['x1']-OPENING['x0']} opening")
s.dim(v.p(0, 0), v.p(0, TOTAL_H), 70, f"{TOTAL_H}")
s.dim(v.p(0, 0), v.p(0, H), 40, f"{H}")
s.dim(v.p(L, 0), v.p(L, OPENING["z1"]), -40, f"{OPENING['z1']}")
s.dim(v.p(L, 0), v.p(L, PLINTH), -74, f"{PLINTH}")
s.dim(v.p(ATTRACT["cx"] + bw / 2, ATTRACT["cz"] - bh / 2), v.p(ATTRACT["cx"] + bw / 2, ATTRACT["cz"] + bh / 2), -26, f"{bh}")
s.dim(v.p(ATTRACT["cx"] - bw / 2, ATTRACT["cz"] + bh / 2), v.p(ATTRACT["cx"] + bw / 2, ATTRACT["cz"] + bh / 2), -16, f"{bw}")
s.dim(v.p(PICKUP["x0"], 0), v.p(PICKUP["x0"], PICKUP["z0"]), 24, f"{PICKUP['z0']}")
s.text(*v.p(L / 2, -255), "FRONT ELEVATION (aisle side)", 14, INK, "middle", 800)
# end elevation (looking at x = 1800 face from outside): u = y, v = z
v2 = View(880, 820, 0.31)
v2.r(s, 30, 0, D - 30, PLINTH, fill="#3A3646")
v2.r(s, 0, PLINTH, D, H, fill=FILL["plum"])
v2.r(s, 0, 750, D, 1350, fill="#CDBFF6", stroke=MUTED, dash="5 3")
s.text(*v2.p(D / 2, 1050), "printed wrap zone", 11, MUTED, "middle", 600)
v2.r(s, -10, H, D + 10, H + ROOF_T, fill=FILL["plum"])
v2.r(s, SIGN["y0"], SIGN["z0"], SIGN["y1"], SIGN["z1"], fill=FILL["sign"])
s.dim(v2.p(0, 0), v2.p(D, 0), 34, f"{D}")
s.dim(v2.p(D, 0), v2.p(D, TOTAL_H), -40, f"{TOTAL_H}")
s.dim(v2.p(SIGN["y0"], SIGN["z1"]), v2.p(SIGN["y1"], SIGN["z1"]), -16, f"{SIGN['y1']-SIGN['y0']}")
s.dim(v2.p(0, SIGN["z0"]), v2.p(0, SIGN["z1"]), 40, f"{SIGN['z1']-SIGN['z0']}")
s.text(*v2.p(0, -90), "front", 11, MUTED, "start", 600)
s.text(*v2.p(D, -90), "back", 11, MUTED, "end", 600)
s.text(*v2.p(D / 2, -255), "END ELEVATION (bay end)", 14, INK, "middle", 800)
s.notes(1340, 160, "Notes", [
    "The sign overhangs the front face by 30 mm.",
    "The curtain rod is at 1885 mm. The curtain clears the floor by 20 mm.",
    "The attract display mounts on VESA to the two display stiles (F-05). Its bezel overlaps the panel cutout by 15 mm on each side.",
    "The pickup tray is a 120 mm deep recess with a brushed brass lip at 600 mm.",
    "The plinth skirt is inset 30 mm all round and hides the casters and levelers.",
], width=34)
sheets.append(s)

# ================================================================ F-03 plan + back elevation
s = Sheet("F-03", "Plan + back elevation")
v = View(90, 560, 0.36)   # plan: u = x, v = y (front at bottom)
v.r(s, 0, 0, XM, D, fill="#F2EFF8")
s.text(*v.p(XM / 2, D / 2 + 20), "MACHINE", 13, INK, "middle", 800)
s.text(*v.p(XM / 2, D / 2 - 30), "MODULE", 13, INK, "middle", 800)
v.r(s, XM, 0, L, D, fill="#FFFFFF")
v.r(s, XM, D - 25, L, D, fill=FILL["plum"])
v.r(s, L - 25, 0, L, D, fill=FILL["plum"])
v.r(s, PILLAR["x0"], 0, L, 25, fill=FILL["plum"])
v.r(s, BENCH["x0"], BENCH["y0"], BENCH["x1"], BENCH["y1"], fill="#DCD3FB")
s.text(*v.p((BENCH["x0"] + BENCH["x1"]) / 2, D / 2), "BENCH", 12, INK, "middle", 800)
s.text(*v.p(1000, D / 2), "GUEST BAY", 13, INK, "middle", 800)
for i in range(12):
    u = OPENING["x0"] + (OPENING["x1"] - OPENING["x0"]) * (0.55 + 0.45 * i / 11)
    s.circle(*v.p(u, -30), 3, fill=ACC, stroke=ACC)
s.text(*v.p((OPENING["x0"] + OPENING["x1"]) / 2, -95), "curtain (2× fullness)", 11, ACC, "middle", 700)
# sight line camera -> bench
s.line(*v.p(XM, CAMERA["cy"]), *v.p(BENCH["x0"], 120), stroke=MUTED, dash="4 4")
s.line(*v.p(XM, CAMERA["cy"]), *v.p(BENCH["x0"], 980), stroke=MUTED, dash="4 4")
s.text(*v.p(1000, 860), "camera field of view", 10, MUTED, "middle", 600)
v.r(s, 0, SERVICE_DOOR["y0"], 25, SERVICE_DOOR["y1"], fill=ACC, stroke=ACC)
s.text(*v.p(-30, (SERVICE_DOOR["y0"] + SERVICE_DOOR["y1"]) / 2), "service door", 10, ACC, "middle", 700, rot=-90)
s.dim(v.p(0, D), v.p(L, D), -26, f"{L}")
s.dim(v.p(0, 0), v.p(XM, 0), 50, f"{XM}")
s.dim(v.p(XM, 0), v.p(L, 0), 50, f"{L-XM}")
s.dim(v.p(L, 0), v.p(L, D), -34, f"{D}")
s.dim(v.p(BENCH["x0"], D), v.p(BENCH["x1"], D), -56, f"{BENCH['x1']-BENCH['x0']} bench")
s.dim(v.p(XM, 0), v.p(BENCH["x0"], 0), 82, f"{BENCH['x0']-XM} lens to bench")
s.text(*v.p(L / 2, -310), "PLAN (roof off, front at bottom)", 14, INK, "middle", 800)
# back elevation (looking at y = 1100 face from behind): u = L - x
v2 = View(890, 820, 0.31)
v2.r(s, 30, 0, L - 30, PLINTH, fill="#3A3646")
v2.r(s, 0, PLINTH, L, H, fill=FILL["plum"])
v2.r(s, 0, 550, L, 1540, fill="#CDBFF6", stroke=MUTED, dash="5 3")
s.text(*v2.p(L / 2, 1040), "printed wrap: STICKER YOURSELF", 12, MUTED, "middle", 700)
s.line(*v2.p(L - XM, PLINTH), *v2.p(L - XM, H), stroke=INK, sw=1.4, dash="6 3")
v2.r(s, -10, H, L + 10, H + ROOF_T, fill=FILL["plum"])
v2.r(s, L - SIGN["x1"], SIGN["z0"], L - SIGN["x0"], SIGN["z1"], fill="#5B5470")
s.circle(*v2.p(L - 200, 120), 6, fill=INK)
s.leader(*v2.p(L - 200, 120), *v2.p(L - 900, 300), "power cord exit (machine end)")
s.dim(v2.p(0, 0), v2.p(L, 0), 34, f"{L}")
s.dim(v2.p(0, 0), v2.p(0, H), 40, f"{H}")
s.text(*v2.p(L / 2, -255), "BACK ELEVATION", 14, INK, "middle", 800)
s.notes(90, 740, "Notes", [
    "Leave 300 mm clear behind the booth for the power cord and airflow, and 600 mm at the machine end so the service door can open.",
    "The camera lens sits 795 mm from the bench front edge. With a 90°+ wide lens, that fits four people on the bench.",
    "The bay panels join the machine module along the seam at x = 600 (dashed).",
], width=110)
sheets.append(s)

# ================================================================ F-04 inside elevations
s = Sheet("F-04", "Inside elevations", "A: camera wall seen from the bench.  B: section through the machine module, looking at the end wall")
v = View(170, 880, 0.37)   # camera wall: u = y (guest's left = front y=0 ... right = back y=1100), v = z
v.r(s, 0, PLINTH, D, H, fill=FILL["white"])
v.r(s, 0, 0, D, PLINTH, fill="#3A3646")
for sb in SOFTBOX:
    v.r(s, sb["cy"] - sb["w"] / 2, sb["cz"] - sb["h"] / 2, sb["cy"] + sb["w"] / 2, sb["cz"] + sb["h"] / 2, fill="#FFF3EA", stroke="#D9A54A", rx=4)
tw_, th_ = TOUCH["bezel"]
v.r(s, TOUCH["cy"] - tw_ / 2, TOUCH["cz"] - th_ / 2, TOUCH["cy"] + tw_ / 2, TOUCH["cz"] + th_ / 2, fill=FILL["glass"])
aw, ah = TOUCH["active"]
v.r(s, TOUCH["cy"] - aw / 2, TOUCH["cz"] - ah / 2, TOUCH["cy"] + aw / 2, TOUCH["cz"] + ah / 2, fill=FILL["screen"], stroke="none")
s.text(*v.p(TOUCH["cy"], TOUCH["cz"]), '27" touch', 12, INK, "middle", 700)
s.circle(*v.p(CAMERA["cy"], CAMERA["cz"]), CAMERA["ring"] / 2 * v.s, fill="#FFF8EE", stroke="#D9A54A", sw=1.6)
s.circle(*v.p(CAMERA["cy"], CAMERA["cz"]), CAMERA["hole"] / 2 * v.s, fill=FILL["glass"])
v.r(s, PAY_SHELF["cy"] - PAY_SHELF["w"] / 2, PAY_SHELF["z"] - 12, PAY_SHELF["cy"] + PAY_SHELF["w"] / 2, PAY_SHELF["z"] + 12, fill="#EDE9F5")
v.r(s, READER["cy"] - 40, PAY_SHELF["z"] + 12, READER["cy"] + 40, PAY_SHELF["z"] + 50, fill="#2B2D3A", rx=6)
v.r(s, SPEAKER["cy"] - SPEAKER["w"] / 2, SPEAKER["cz"] - SPEAKER["h"] / 2, SPEAKER["cy"] + SPEAKER["w"] / 2, SPEAKER["cz"] + SPEAKER["h"] / 2, fill="#BDB8CC")
s.leader(*v.p(CAMERA["cy"] + 70, CAMERA["cz"]), *v.p(D + 120, CAMERA["cz"] + 120), "camera + ring light")
s.leader(*v.p(SOFTBOX[1]["cy"] + 60, 1500), *v.p(D + 120, 1500), "softbox LED bar (×2)")
s.leader(*v.p(TOUCH["cy"] + tw_ / 2, TOUCH["cz"]), *v.p(D + 120, 1170), '27" touchscreen, VESA to stiles')
s.leader(*v.p(READER["cy"] + 40, PAY_SHELF["z"] + 30), *v.p(D + 120, 880), "Stripe S710 tap reader (tilted 35° on shelf)")
s.leader(*v.p(SPEAKER["cy"], SPEAKER["cz"] - 30), *v.p(D + 120, 600), "speaker grille")
s.leader(*v.p(PAY_SHELF["cy"] - 200, PAY_SHELF["z"]), *v.p(D + 120, 450), "pay shelf, 130 deep")
s.dim(v.p(0, 0), v.p(0, CAMERA["cz"]), 44, f"{CAMERA['cz']}")
s.dim(v.p(0, 0), v.p(0, TOUCH["cz"]), 84, f"{TOUCH['cz']}")
s.dim(v.p(0, 0), v.p(0, PAY_SHELF["z"]), 124, f"{PAY_SHELF['z']}")
s.dim(v.p(0, 0), v.p(D, 0), 30, f"{D}")
s.dim(v.p(TOUCH["cy"] - tw_ / 2, TOUCH["cz"] + th_ / 2), v.p(TOUCH["cy"] + tw_ / 2, TOUCH["cz"] + th_ / 2), -14, f"{tw_}")
s.dim(v.p(SOFTBOX[0]["cy"], 0), v.p(SOFTBOX[1]["cy"], 0), 60, f"{SOFTBOX[1]['cy']-SOFTBOX[0]['cy']} bar centers")
s.text(*v.p(D / 2, -215), "A · CAMERA WALL (from the bench)", 14, INK, "middle", 800)
# B: machine section looking at end wall from inside (u = y, v = z), equipment
v2 = View(1010, 880, 0.37)
v2.r(s, 0, 0, D, PLINTH, fill="#3A3646")
v2.r(s, 0, PLINTH, D, H, fill="#FBFAFE")
for x in (0,):
    pass
# frame stubs
for y_ in (0, D - TUBE):
    v2.r(s, y_, PLINTH, y_ + TUBE, H, fill=FILL["steel"], stroke=MUTED, sw=0.8)
for z_ in (PLINTH, 432 - TUBE, 1000, H - TUBE):
    v2.r(s, 0, z_, D, z_ + TUBE, fill=FILL["steel"], stroke=MUTED, sw=0.8)
v2.r(s, 0, ATTRACT["cz"] - ATTRACT["bezel"][1] / 2, 70, ATTRACT["cz"] + ATTRACT["bezel"][1] / 2, fill=FILL["glass"])
s.leader(*v2.p(35, 1700), *v2.p(-90, 1820), '43" display (front)', anchor="end")
for e in EQUIP:
    v2.r(s, e["y"], e["z"], e["y"] + e["d"], e["z"] + e["h"], fill=FILL["equip"] if "shelf" not in e["name"] else FILL["steel"], stroke=INK, sw=1)
# chute
s.poly([v2.p(10, PICKUP["z1"]), v2.p(PICKUP["depth"], PICKUP["z1"]), v2.p(EQUIP[0]["y"] + 10, 560), v2.p(EQUIP[0]["y"] + 10, 540), v2.p(PICKUP["depth"], PICKUP["z0"]), v2.p(10, PICKUP["z0"])], fill="#2B2B33", stroke=INK)
s.leader(*v2.p(60, PICKUP["z0"] + 40), *v2.p(-130, 560), "pickup tray + chute", anchor="end")
s.leader(*v2.p(EQUIP[0]["y"] + 200, EQUIP[0]["z"] + 200), *v2.p(D + 110, 900), "Primera LX610 (output faces front)")
s.leader(*v2.p(EQUIP[2]["y"] + 100, EQUIP[2]["z"] + 30), *v2.p(D + 110, 330), "mini PC")
s.leader(*v2.p(EQUIP[3]["y"] + 300, EQUIP[3]["z"] + 150), *v2.p(D + 110, 230), "UPS + power distribution")
s.leader(*v2.p(EQUIP[4]["y"] + 100, EQUIP[4]["z"] + 75), *v2.p(-130, 330), "spare rolls", anchor="end")
v2.r(s, FAN["cy"] - 60, H - 40, FAN["cy"] + 60, H, fill="#2B2B33")
s.leader(*v2.p(FAN["cy"], H - 20), *v2.p(D + 110, 1880), "exhaust fan (roof)")
for k in range(3):
    yy = 150 + k * 300
    s.line(*v2.p(yy, 140), *v2.p(yy + 120, 380), stroke="#3AA0FF", sw=1.4, dash="5 4")
s.text(*v2.p(300, 1500), "warm air rises → roof fan", 11, "#3AA0FF", "middle", 700)
s.text(*v2.p(300, 1450), "intake: plinth vents", 11, "#3AA0FF", "middle", 700)
s.dim(v2.p(0, 0), v2.p(0, 432), 40, "432 shelf")
s.dim(v2.p(0, 0), v2.p(D, 0), 30, f"{D}")
s.text(*v2.p(D / 2, -215), "B · MACHINE SECTION (looking at the end wall)", 14, INK, "middle", 800)
sheets.append(s)

# ================================================================ F-05 frame (isometric) + cut list
s = Sheet("F-05", "Steel frame + tube cut list", '1.5" (38.1 mm) square tube, 16 ga. M = welded machine module. B-* = bolt-together bay sub-frames')
cos30, sin30 = math.cos(math.radians(30)), 0.5
def iso(x, y, z, ox=320, oy=900, k=0.205):
    return (ox + (x - y) * cos30 * k, oy - (z + (x + y) * sin30) * k)
mods_col = {"M": "#7C5CFC", "B-end": "#FF6B9D", "B-back": "#FF9F43", "B-front": "#2BB5D6", "B-floor": "#6DBE6A", "B-roof": "#9B8FB8"}
boxes = []
for f in frame_members():
    x, y, z = f["start"]
    dx = f["length"] if f["axis"] == "x" else TUBE
    dy = f["length"] if f["axis"] == "y" else TUBE
    dz = f["length"] if f["axis"] == "z" else TUBE
    boxes.append((x, y, z, dx, dy, dz, mods_col[f["module"]]))
# painter's sort: far first (viewer at -x, -y, +z)
boxes.sort(key=lambda b: (b[0] + b[3] / 2) + (b[1] + b[4] / 2) - (b[2] + b[5] / 2), reverse=True)
def shade(hexc, f):
    c = [int(hexc[i:i + 2], 16) for i in (1, 3, 5)]
    return "#%02x%02x%02x" % tuple(max(0, min(255, int(v * f))) for v in c)
for x, y, z, dx, dy, dz, col in boxes:
    P = lambda a, b, c: iso(x + a, y + b, z + c)
    s.poly([P(0, 0, dz), P(dx, 0, dz), P(dx, dy, dz), P(0, dy, dz)], fill=shade(col, 1.15), stroke=shade(col, 0.6), sw=0.4)
    s.poly([P(0, 0, 0), P(dx, 0, 0), P(dx, 0, dz), P(0, 0, dz)], fill=col, stroke=shade(col, 0.6), sw=0.4)
    s.poly([P(0, 0, 0), P(0, dy, 0), P(0, dy, dz), P(0, 0, dz)], fill=shade(col, 0.8), stroke=shade(col, 0.6), sw=0.4)
ly = 120
for mod, col in mods_col.items():
    s.rect(40, ly - 11, 14, 14, fill=col, stroke="none")
    s.text(62, ly, {"M": "M · machine module (welded, rolls in whole)", "B-end": "B-end · bay end wall frame", "B-back": "B-back · bay back wall frame",
                    "B-front": "B-front · pillar + header frame", "B-floor": "B-floor · threshold + floor joists", "B-roof": "B-roof · roof joists"}[mod], 12, weight=600)
    ly += 22
s.text(*iso(0, 0, -150), "front-left corner (origin)", 10, MUTED, "middle", 600)
rows = [[r["module"], r["part"], r["length_mm"], r["qty"]] for r in cut_list()]
total = sum(r["length_mm"] * r["qty"] for r in cut_list()) / 1000
yy = s.table(930, 100, ["Sub-frame", "Part", "Cut length", "Qty"], rows, [100, 260, 110, 50], size=11, rh=19)
s.text(930, yy + 24, f"Total {total:.1f} m of tube. Buy ≈ {math.ceil(total * 1.12 / 6.1)} × 20 ft (6.1 m) sticks incl. 12% waste.", 12, INK, weight=700)
s.notes(930, yy + 56, "Frame notes", [
    "Cut lengths are clear lengths between posts (butt joints). Add-ons not shown: caster plates, VESA mount plates, door sub-frame, sign mounting tabs.",
    "Bay sub-frames bolt to the machine posts with 6 mm steel tabs and M8 bolts into rivnuts (F-09). Every bay frame comes apart for doorways.",
    "Powder-coat after welding. Mask the rivnut faces.",
], width=78)
sheets.append(s)

# ================================================================ F-06 panel drawings
s = Sheet("F-06", "Panel drawings", "Flat panels as cut, viewed from outside. Cutouts dimensioned from the bottom-left corner of each panel")
pans = [p for p in panels() if p["code"] in ("M1", "M4", "M2", "B1", "B2", "B3", "M5", "B5")]
x0 = 70
k = 0.165
row_y = 450
cursor = x0
for p in pans:
    w_, h_ = p["w"], p["h"]
    if cursor + w_ * k > W - 60:
        cursor = x0; row_y += 1920 * k + 110
    v = View(cursor, row_y, k)
    v.r(s, 0, 0, w_, h_, fill=FILL["white"] if "white" in p["mat"] else FILL["plum"], stroke=INK, sw=1.2)
    for kind, cx, cy, cw, ch in p["cutouts"]:
        if kind == "rect":
            v.r(s, cx - cw / 2, cy - ch / 2, cx + cw / 2, cy + ch / 2, fill="#FFFFFF", stroke=ACC, sw=1)
        else:
            s.circle(*v.p(cx, cy), cw / 2 * k, fill="#FFFFFF", stroke=ACC, sw=1)
    s.text(cursor, row_y - h_ * k - 26, f"{p['code']} · {p['name'].split(' (')[0]}", 12, INK, weight=800)
    s.text(cursor, row_y - h_ * k - 11, p["mat"], 10, MUTED, weight=600)
    s.dim(v.p(0, 0), v.p(w_, 0), 18, f"{w_:g}", size=10)
    s.dim(v.p(w_, 0), v.p(w_, h_), -18, f"{h_:g}", size=10)
    big = [c for c in p["cutouts"] if c[3] > 100]
    for kind, cx, cy, cw, ch in big[:2]:
        s.text(*v.p(cx, cy + ch / 2 + 40), f"{cw:g}×{ch:g} @ ({cx - cw / 2:g}, {cy - ch / 2:g})", 9, ACC, "middle", 700)
    cursor += max(w_ * k + 70, 175)
s.notes(1320, 600, "Panel notes", [
    "Cut on a CNC router with a V-groove bit if folded returns are wanted. DXF files of every panel are in the package.",
    "Cutout sizes include 5 mm clearance. Displays overlap the panel face from behind.",
    "Small slots on M4 are cable pass-throughs for the softboxes and the reader.",
    "Orient the protective film so the gloss face is outside.",
], width=36)
sheets.append(s)

# ================================================================ F-07 panel schedule + nesting
s = Sheet("F-07", "Panel schedule + sheet nesting", "4×8 ft (1220 × 2440 mm) sheets. Simple guillotine layout with a 10 mm kerf allowance")
rows = [[p["code"], p["name"], p["w"], p["h"], p["qty"], p["mat"]] for p in panels()]
s.table(40, 100, ["Code", "Panel", "W", "H", "Qty", "Material"], rows, [60, 260, 70, 70, 50, 300], size=11, rh=20)
SW, SH = 1220, 2440
acm = []
for p in panels():
    if "ACM" in p["mat"]:
        for _ in range(p["qty"]):
            acm.append((p["code"], p["w"] + 10, p["h"] + 10))
acm.sort(key=lambda r: (-max(r[1], r[2]), -(r[1] * r[2])))
sheets_used = []      # each: dict(free=[(x,y,w,h)], parts=[...])
def try_place(sh_, code, w_, h_):
    best = None
    for i, (fx, fy, fw, fh) in enumerate(sh_["free"]):
        for (pw, ph, rot) in ((w_, h_, False), (h_, w_, True)):
            if pw <= fw and ph <= fh:
                score = min(fw - pw, fh - ph)
                if best is None or score < best[0]:
                    best = (score, i, pw, ph)
    if best is None:
        return False
    _, i, pw, ph = best
    fx, fy, fw, fh = sh_["free"].pop(i)
    sh_["parts"].append((code, fx, fy, pw, ph))
    # split along the shorter leftover
    if fw - pw < fh - ph:
        sh_["free"] += [(fx + pw, fy, fw - pw, ph), (fx, fy + ph, fw, fh - ph)]
    else:
        sh_["free"] += [(fx + pw, fy, fw - pw, fh), (fx, fy + ph, pw, fh - ph)]
    sh_["free"] = [f for f in sh_["free"] if f[2] > 20 and f[3] > 20]
    return True
for code, w_, h_ in acm:
    if not any(try_place(sh_, code, w_, h_) for sh_ in sheets_used):
        sh_ = dict(free=[(0, 0, SW, SH)], parts=[])
        sheets_used.append(sh_)
        assert try_place(sh_, code, w_, h_), code
k = 0.118
for i, sh_ in enumerate(sheets_used):
    ox = 850 + (i % 5) * 152
    oy = 470 + (i // 5) * 360
    v = View(ox, oy, k)
    v.r(s, 0, 0, SW, SH, fill="#F4F2F8", stroke=INK, sw=1)
    for code, x_, y_, w_, h_ in sh_["parts"]:
        v.r(s, x_, y_, x_ + w_ - 10, y_ + h_ - 10, fill="#DCD3FB", stroke=DIM, sw=0.8)
        s.text(*v.p(x_ + w_ / 2, y_ + h_ / 2 - 30), code, 9, INK, "middle", 800)
    s.text(ox, oy + 16, f"Sheet {i + 1}", 10, MUTED, weight=700)
s.text(860, 100, f"≈ {len(sheets_used)} sheets of 3 mm ACM", 18, INK, weight=800)
s.text(860, 124, "Buy one spare for mistakes. The felt liner (B7) and plywood deck (B8) are separate.", 12, MUTED)
sheets.append(s)

# ================================================================ F-08 electrical + data
s = Sheet("F-08", "Electrical + data", "One 120 V / 15 A outlet. Everything is fed from the UPS in the machine module")
def node(x, y, w, h, title, sub="", fill="#FFFFFF", stroke=INK):
    s.rect(x, y, w, h, fill=fill, stroke=stroke, sw=1.4, rx=8)
    s.text(x + w / 2, y + (h / 2 + (0 if sub else 5)) - (2 if sub else 0), title, 12.5, INK, "middle", 800)
    if sub:
        s.text(x + w / 2, y + h / 2 + 14, sub, 10, MUTED, "middle", 600)
    return (x, y, w, h)
def wire(a, b, color, label="", dash=None, side="r"):
    ax, ay, aw, ah = a; bx, by, bw, bh = b
    x1, y1 = (ax + aw, ay + ah / 2) if side == "r" else (ax + aw / 2, ay + ah)
    x2, y2 = (bx, by + bh / 2) if side == "r" else (bx + bw / 2, by)
    mx = (x1 + x2) / 2
    path = f"M{x1:.1f},{y1:.1f} C{mx:.1f},{y1:.1f} {mx:.1f},{y2:.1f} {x2:.1f},{y2:.1f}" if side == "r" else f"M{x1:.1f},{y1:.1f} C{x1:.1f},{(y1+y2)/2:.1f} {x2:.1f},{(y1+y2)/2:.1f} {x2:.1f},{y2:.1f}"
    d = f' stroke-dasharray="{dash}"' if dash else ""
    s.add(f'<path d="{path}" fill="none" stroke="{color}" stroke-width="2"{d}/>')
    if label:
        s.text(mx, (y1 + y2) / 2 - 5, label, 9.5, color, "middle", 700)
RED, BLU, GRN = "#D9423B", "#3A6FF2", "#2E9E5B"
wall = node(40, 430, 140, 56, "Wall outlet", "120 V · 15 A", "#FFF1F0", RED)
ups = node(250, 430, 160, 56, "UPS 1500 VA", "surge + 10 min ride-through", "#FFF1F0", RED)
pdu = node(470, 430, 150, 56, "Power strip / PDU", "8 outlets, switched", "#FFF1F0", RED)
wire(wall, ups, RED, "power cord, 3 m")
wire(ups, pdu, RED)
loads = [("Primera LX610", "check nameplate"), ("Mini PC", "~65 W"), ('43" attract display', "~100 W"), ('27" touchscreen', "~40 W"),
         ("24 V LED PSU", "softboxes, ring, ceiling ~150 W"), ("12 V LED PSU", "marquee + RGB plinth ~80 W"), ("Exhaust fan + amp", "~30 W"), ("Router / LTE", "~15 W")]
lo = []
for i, (t_, sub) in enumerate(loads):
    n = node(700, 110 + i * 62, 210, 48, t_, sub, "#FFFFFF", RED)
    wire(pdu, n, RED)
    lo.append(n)
pcx = node(1010, 150, 220, 70, "Mini PC", "booth app: kiosk browser + print agent", "#F0F4FF", BLU)
dev = [("Primera LX610", "USB"), ('27" touchscreen', "HDMI + USB touch"), ('43" attract display', "HDMI"), ("Camera", "USB 3"), ("LED controller", "USB → relays / PWM")]
for i, (t_, sub) in enumerate(dev):
    n = node(1340, 92 + i * 58, 230, 46, t_, sub, "#F0F4FF", BLU)
    wire(pcx, n, BLU)
router = node(1010, 420, 220, 56, "Router", "venue Wi-Fi or LTE backup", "#EEF9F2", GRN)
cloud = node(1340, 420, 230, 56, "Internet", "MeSticker app · Stripe · AI models", "#EEF9F2", GRN)
reader = node(1340, 520, 230, 56, "Stripe Reader S710", "own USB-C power, talks to Stripe", "#EEF9F2", GRN)
wire(pcx, router, GRN, "Ethernet", side="d")
wire(router, cloud, GRN, "WAN")
wire(router, reader, GRN, "Wi-Fi", dash="5 4")
s.text(1120, 120, "DATA", 10.5, MUTED, "middle", 700)
s.text(810, 92, "POWER", 10.5, MUTED, "middle", 700)
y = s.table(40, 640, ["Circuit", "Est. load"], [["Electronics", "~350 W"], ["Lighting", "~230 W"], ["Printer", "nameplate"], ["Total (est.)", "≈ 650–750 W ≈ 6 A"]], [220, 200], size=12, rh=22)
s.notes(500, 660, "Wiring notes", [
    "All mains wiring inside the machine module, on the PDU. Use UL-listed power supplies only, and strain-relieve the main cord where it exits.",
    "The low-voltage LED runs (24 V and 12 V) go through the frame tubes to the softboxes, ceiling panel, sign and plinth. The sign uses a quick-disconnect plug.",
    "The S710 reader talks to Stripe directly over Wi-Fi or Ethernet (server-driven integration). It needs no USB connection to the PC.",
    "Fit an LTE router as a backup for bad venue Wi-Fi. The booth should stop taking payment when it's offline.",
    "Leave a service loop on every cable so the printer shelf can slide out.",
], width=100)
s.text(40, 110, "LEGEND", 10.5, MUTED, weight=700)
for i, (c, t_) in enumerate(((RED, "mains power"), (BLU, "USB / HDMI data"), (GRN, "network"))):
    s.line(40, 130 + i * 20, 80, 130 + i * 20, stroke=c, sw=2.5)
    s.text(90, 134 + i * 20, t_, 11.5, INK, weight=600)
sheets.append(s)

# ================================================================ F-09 details
s = Sheet("F-09", "Details")
def panel(x, y, w, h, title):
    s.rect(x, y, w, h, fill="#FCFBFE", stroke="#D9D4E8", rx=10)
    s.text(x + 16, y + 26, title, 14, INK, weight=800)
# D1 module join
panel(32, 92, 500, 430, "D1 · Bay-to-machine joint")
v = View(120, 495, 2.2)
v.r(s, 0, 0, 38.1, 160, fill=FILL["steel"])          # machine post (section)
v.r(s, 38.1, 60, 150, 98.1, fill="#E1E3EA")         # bay rail
v.r(s, 38.1, 40, 44.1, 118, fill="#7C5CFC", stroke=INK)      # tab plate 6 mm
for zz in (55, 103):
    s.circle(*v.p(19, zz), 4 * 2.2, fill="#fff", stroke=INK)
s.leader(*v.p(19, 103), *v.p(60, 150), "M8 bolt + rivnut in post")
s.leader(*v.p(41, 40), *v.p(80, 10), "6 mm steel tab, welded to bay rail")
s.text(*v.p(19, -14), "machine post", 10, MUTED, "middle", 600)
s.text(*v.p(110, 50), "bay rail", 10, MUTED, "middle", 600)
s.dim(v.p(38.1, 40), v.p(38.1, 118), -40, "78")
# D2 caster + leveler
panel(552, 92, 500, 430, "D2 · Caster + leveler corner")
v = View(640, 460, 1.3)
v.r(s, 0, 80, 220, 118.1, fill=FILL["steel"])
v.r(s, 20, 72, 110, 80, fill="#7C5CFC")
s.circle(*v.p(65, 38), 34 * 1.6, fill="#2B2B33", stroke=INK)
v.r(s, 150, 12, 170, 80, fill="#C9CBD6")
v.r(s, 135, 0, 185, 12, fill="#2B2B33")
v.r(s, -20, 2, -17, 80, fill="#3A3646")
s.leader(*v.p(65, 38), *v.p(20, -22), '3" locking caster, 100 kg rated')
s.leader(*v.p(160, 40), *v.p(160, 150), "M12 screw-down leveler")
s.leader(*v.p(-18, 60), *v.p(-20, 175), "plinth skirt, 30 mm inset")
s.text(*v.p(110, 135), "bottom rail", 10, MUTED, "middle", 600)
s.dim(v.p(220, 0), v.p(220, 80), -30, "80 plinth")
# D3 pickup chute
panel(1072, 92, 528, 430, "D3 · Pickup chute (section)")
v = View(1200, 440, 0.55)
v.r(s, -20, 0, 0, 380, fill="#E9E3F8")
v.r(s, 0, 140, 120, 150, fill="#2B2B33")
v.r(s, 0, 280, 120, 290, fill="#2B2B33")
v.r(s, -30, 120, 10, 140, fill="#D9A54A")
s.poly([v.p(120, 150), v.p(380, 240), v.p(380, 255), v.p(120, 165)], fill="#C9CBD6", stroke=INK)
v.r(s, 380, 230, 600, 360, fill=FILL["equip"])
s.text(*v.p(490, 300), "LX610", 11, INK, "middle", 800)
s.leader(*v.p(250, 200), *v.p(250, 60), "2 mm aluminum chute, 20° slope, deburred edges")
s.leader(*v.p(-10, 130), *v.p(-60, 60), "brass lip stops the strip", anchor="end")
s.text(*v.p(-10, 400), "front panel", 10, MUTED, "middle", 600)
s.dim(v.p(0, 140), v.p(0, 290), 40, "140")
# D4 curtain rod
panel(32, 540, 500, 420, "D4 · Curtain rod")
v = View(90, 700, 0.36)
s.line(*v.p(0, 0), *v.p(1120, 0), stroke="#B08440", sw=6)
for xx in (0, 1120):
    s.circle(*v.p(xx, 0), 9, fill="#D9A54A", stroke="#8A6420")
for xx in (180, 560, 940):
    v.r(s, xx - 10, 0, xx + 10, 70, fill=FILL["steel"])
for i in range(30):
    xx = 520 + i * 20
    s.line(*v.p(xx, -10), *v.p(xx + 6, -460), stroke=ACC, sw=1.2)
s.text(*v.p(560, 200), "22 mm brass tube · 3 brackets to the header frame · finials", 11, INK, "middle", 700)
s.text(*v.p(560, -520), "velvet, 2× fullness, 1780 drop, weighted hem, 20 mm floor clearance", 11, INK, "middle", 700)
s.dim(v.p(0, 0), v.p(1120, 0), -40, f"{CURTAIN['width']} rod")
# D5 sign box
panel(552, 540, 500, 420, "D5 · Marquee sign (section)")
v = View(700, 900, 1.0)
v.r(s, 0, 0, 130, 280, fill=FILL["sign"])
v.r(s, 3, 3, 127, 277, fill="#4A4268", stroke="none")
for zz in (35, 245):
    s.circle(*v.p(-6, zz), 11, fill="#FFD9A0", stroke="#B08440")
v.r(s, 20, -40, 110, 0, fill=FILL["steel"])
s.leader(*v.p(-6, 245), *v.p(-60, 300), "Ø22 holes, LED bulbs (E12)", anchor="end")
s.leader(*v.p(130, 140), *v.p(215, 140), "channel box, rear lid")
s.leader(*v.p(65, -20), *v.p(200, -20), "4 × M8 to roof frame tabs")
s.dim(v.p(0, 280), v.p(130, 280), -20, "130")
s.dim(v.p(130, 0), v.p(130, 280), -60, "280")
# D6 service door
panel(1072, 540, 528, 420, "D6 · Service door (machine end)")
v = View(1210, 925, 0.17)
v.r(s, 0, 0, 1100, 1920, fill=FILL["plum"])
v.r(s, SERVICE_DOOR["y0"], SERVICE_DOOR["z0"] - PLINTH, SERVICE_DOOR["y1"], SERVICE_DOOR["z1"] - PLINTH, fill="#DCD3FB", stroke=INK)
s.line(*v.p(SERVICE_DOOR["y0"] + 8, SERVICE_DOOR["z0"]), *v.p(SERVICE_DOOR["y0"] + 8, SERVICE_DOOR["z1"] - 160), stroke=INK, sw=3)
s.circle(*v.p(SERVICE_DOOR["y1"] - 40, 900), 6, fill=INK)
s.leader(*v.p(SERVICE_DOOR["y0"] + 8, 800), *v.p(-80, 1500), "piano hinge", anchor="end")
s.leader(*v.p(SERVICE_DOOR["y1"] - 40, 900), *v.p(1250, 1300), "keyed cam lock")
s.dim(v.p(SERVICE_DOOR["y0"], 0), v.p(SERVICE_DOOR["y1"], 0), 20, f"{SERVICE_DOOR['y1']-SERVICE_DOOR['y0']}")
s.dim(v.p(SERVICE_DOOR["y1"], SERVICE_DOOR["z0"] - PLINTH), v.p(SERVICE_DOOR["y1"], SERVICE_DOOR["z1"] - PLINTH), -24, f"{SERVICE_DOOR['z1']-SERVICE_DOOR['z0']}")
sheets.append(s)

# ================================================================ F-10 assembly
s = Sheet("F-10", "Assembly sequence", "Exploded view: machine module (purple frame) stays whole. Bay sub-frames and panels bolt on at the venue")
s.image(32, 92, 900, 675, "img/fab_exploded_labeled.png")
s.rect(32, 92, 900, 675, stroke="#D9D4E8")
s.image(952, 92, 648, 486, "img/fab_frame_w.png")
s.rect(952, 92, 648, 486, stroke="#D9D4E8")
s.text(952, 596, "Frame + equipment, panels off", 11, MUTED, weight=700)
s.notes(952, 630, "Build order (shop)", [
    "Weld the machine frame (M). Fit the caster plates, VESA plates and the printer shelf. Powder-coat.",
    "Weld the 5 bay sub-frames. Test-fit them to M with M8 bolts, then mark and unbolt.",
    "Cut the panels from DXF (F-06, F-07). Dry-fit, then rivet or VHB-bond the M panels. Bay panels go on their sub-frames.",
    "Fit the electronics in M (F-04 B, F-08). Run the LED leads through the tubes. Bench-test the whole booth.",
], width=86)
s.notes(32, 800, "Install (venue)", [
    "Roll the machine module in. Bolt the bay end, back and front frames to it, then the floor and roof joists. Drop in the floor deck and bench.",
    "Hang the bay panels and liners, then the roof panels. Lift the sign on and plug it in. Hang the curtain. Level all corners with the levelers, then lock the casters.",
], width=150)
sheets.append(s)

for sh in sheets:
    open(os.path.join(OUT, f"{sh.num}.svg"), "w").write(sh.svg())
json.dump([dict(num=sh.num, title=sh.title) for sh in sheets], open(os.path.join(OUT, "index.json"), "w"))
print("sheets:", [sh.num for sh in sheets])
