"""Post-process renders: x-ray callouts, dimensioned orthographic drawings, web JPEGs."""
import json, os, sys
from PIL import Image, ImageDraw, ImageFont

D = sys.argv[1]
OUT = sys.argv[2]
os.makedirs(OUT, exist_ok=True)
meta = json.load(open(os.path.join(D, "meta.json")))
FB = "/usr/share/fonts/opentype/inter/Inter-SemiBold.otf"
FR = "/usr/share/fonts/opentype/inter/Inter-Medium.otf"


def font(path, size):
    return ImageFont.truetype(path, size)


# ---------------------------------------------------------------- x-ray callouts
def xray(view="xray", out="xray.jpg", bgc=(16, 14, 24), fgc=(240, 236, 255)):
    im = Image.open(os.path.join(D, f"{view}.png")).convert("RGB")
    W, H = im.size
    k = H / 1200
    pad = int(520 * k)
    canvas = Image.new("RGB", (W + 2 * pad, H), bgc)
    canvas.paste(im, (pad, 0))
    d = ImageDraw.Draw(canvas)
    f = font(FB, int(29 * k))
    pts = [(lab, x + pad, y) for lab, x, y in meta[view]["callouts"]]
    cx = pad + W / 2
    left = sorted([p for p in pts if p[1] < cx], key=lambda p: p[2])
    right = sorted([p for p in pts if p[1] >= cx], key=lambda p: p[2])

    def column(items, side):
        if not items:
            return
        top, bot = 70 * k, H - 70 * k
        step = (bot - top) / max(len(items) - 1, 1)
        for i, (lab, x, y) in enumerate(items):
            ty = top + i * step if len(items) > 1 else (top + bot) / 2
            tx = pad - 40 * k if side == "L" else pad + W + 40 * k
            elbow = tx + (-0 if side == "L" else 0)
            d.line([(x, y), (elbow, ty), (tx, ty)], fill=(167, 139, 255), width=3)
            d.ellipse((x - 9, y - 9, x + 9, y + 9), fill=(255, 107, 157), outline=(255, 255, 255), width=3)
            anchor = "rm" if side == "L" else "lm"
            gx = tx - 14 * k if side == "L" else tx + 14 * k
            lines = wrap(lab, f, pad - 80)
            lh = 37 * k
            y0 = ty - (len(lines) - 1) * lh / 2
            for li, ln in enumerate(lines):
                d.text((gx, y0 + li * lh), ln, font=f, fill=fgc, anchor=anchor)

    column(left, "L")
    column(right, "R")
    canvas.save(os.path.join(OUT, out), quality=88)


def wrap(text, f, maxw):
    words, lines, cur = text.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if f.getlength(t) > maxw and cur:
            lines.append(cur)
            cur = w
        else:
            cur = t
    lines.append(cur)
    return lines


# ---------------------------------------------------------------- dimensioned drawings
INK = (58, 52, 84)
ACC = (124, 92, 252)


def dim_line(d, a, b, text, f, offset_axis, offset):
    """Dimension between points a and b, pushed out by offset along x or y."""
    ax, ay = a
    bx, by = b
    if offset_axis == "x":
        ax += offset; bx += offset
        ext = [((a[0], a[1]), (ax + 12 * sign(offset), ay)), ((b[0], b[1]), (bx + 12 * sign(offset), by))]
    else:
        ay += offset; by += offset
        ext = [((a[0], a[1]), (ax, ay + 12 * sign(offset))), ((b[0], b[1]), (bx, by + 12 * sign(offset)))]
    for p, q in ext:
        d.line([p, q], fill=(170, 164, 196), width=2)
    d.line([(ax, ay), (bx, by)], fill=ACC, width=3)
    for (px, py), (qx, qy) in (((ax, ay), (bx, by)), ((bx, by), (ax, ay))):
        arrow(d, (px, py), (qx, qy))
    mx, my = (ax + bx) / 2, (ay + by) / 2
    tw = f.getlength(text) + 28
    if offset_axis == "x":
        d.rounded_rectangle((mx - tw / 2, my - 24, mx + tw / 2, my + 24), 12, fill=(255, 255, 255), outline=ACC, width=2)
    else:
        d.rounded_rectangle((mx - tw / 2, my - 24, mx + tw / 2, my + 24), 12, fill=(255, 255, 255), outline=ACC, width=2)
    d.text((mx, my), text, font=f, fill=INK, anchor="mm")


def sign(v):
    return 1 if v >= 0 else -1


def arrow(d, p, q, size=14):
    import math
    ang = math.atan2(q[1] - p[1], q[0] - p[0])
    for da in (0.45, -0.45):
        d.line([p, (p[0] + size * math.cos(ang + da), p[1] + size * math.sin(ang + da))], fill=ACC, width=3)


def drawing(view):
    im = Image.open(os.path.join(D, f"{view}.png")).convert("RGBA")
    W, H = im.size
    bg = Image.new("RGBA", (W, H), (246, 244, 251, 255))
    # faint grid
    g = ImageDraw.Draw(bg)
    for x in range(0, W, 40):
        g.line([(x, 0), (x, H)], fill=(234, 230, 245), width=1)
    for y in range(0, H, 40):
        g.line([(0, y), (W, y)], fill=(234, 230, 245), width=1)
    bg.alpha_composite(im)
    d = ImageDraw.Draw(bg)
    f = font(FB, 30)
    P = meta[view]["dims"]
    floor_y = P["bottom"][1]
    if view == "side":
        # height at the back, depth under the floor, ledge height at front
        back_x = P["back"][0]
        dim_line(d, (back_x, P["top"][1]), (back_x, floor_y), "53 cm", f, "x", 70)
        dim_line(d, (P["front"][0], floor_y), (P["back"][0], floor_y), "34 cm", f, "y", 60)
        dim_line(d, (P["front"][0], P["ledge"][1]), (P["front"][0], floor_y), "25 cm", f, "x", -70)
        d.text((40, 40), "SIDE", font=font(FB, 34), fill=INK)
        d.text((40, 84), "Screen tilted 17° back for standing eye-line", font=font(FR, 26), fill=(110, 104, 140))
    else:
        dim_line(d, (P["left"][0], floor_y), (P["right"][0], floor_y), "36 cm", f, "y", 60)
        dim_line(d, (P["left"][0], P["top"][1]), (P["left"][0], floor_y), "53 cm", f, "x", -70)
        d.text((40, 40), "FRONT", font=font(FB, 34), fill=INK)
        d.text((40, 84), 'Footprint of a home espresso machine', font=font(FR, 26), fill=(110, 104, 140))
    bg.convert("RGB").save(os.path.join(OUT, f"{view}.jpg"), quality=90)


