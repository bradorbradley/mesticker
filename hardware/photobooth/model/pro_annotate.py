import os, sys
from PIL import Image, ImageDraw
sys.argv = sys.argv[:3]
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "annot_lib.py")).read())

def drawing(view, title, sub, dims, extra=None):
    im = Image.open(os.path.join(D, f"{view}.png")).convert("RGBA")
    W, H = im.size
    bg = Image.new("RGBA", (W, H), (246, 244, 251, 255))
    g = ImageDraw.Draw(bg)
    for x in range(0, W, 40):
        g.line([(x, 0), (x, H)], fill=(234, 230, 245), width=1)
    for y in range(0, H, 40):
        g.line([(0, y), (W, y)], fill=(234, 230, 245), width=1)
    bg.alpha_composite(im)
    d = ImageDraw.Draw(bg)
    f = font(FB, 28)
    P = meta[view]["dims"]
    for a, b, txt, ax, off in dims(P):
        dim_line(d, a, b, txt, f, ax, off)
    if extra:
        extra(d, P)
    d.text((40, 36), title, font=font(FB, 34), fill=INK)
    d.text((40, 80), sub, font=font(FR, 25), fill=(110, 104, 140))
    bg.convert("RGB").save(os.path.join(OUT, f"{view}.jpg"), quality=90)

P0 = lambda P, k: tuple(P[k])
drawing("pro_front", "FRONT", "Curtain entry on the right, attract screen + pickup on the left",
    lambda P: [(P0(P, "fl"), P0(P, "fr"), "180 cm", "y", 55),
               ((P["fl"][0], P["top"][1]), P0(P, "fl"), "231 cm", "x", -75),
               ((P["fr"][0], P["body"][1]), P0(P, "fr"), "200 cm", "x", 75),
               ((P["o0"][0], P["otop"][1]), (P["o1"][0], P["otop"][1]), "100 cm opening", "y", -40)])
drawing("pro_side", "END", "Printed wrap and stickers on the end wall",
    lambda P: [(P0(P, "sb"), P0(P, "sk"), "110 cm", "y", 55),
               ((P["sk"][0], P["stop"][1]), P0(P, "sk"), "231 cm", "x", 75)])
def plan_labels(d, P):
    fx = font(FB, 26)
    mx = (P["p00"][0] + P["pm"][0]) / 2
    bx = (P["pm"][0] + P["p10"][0]) / 2
    cy = (P["p00"][1] + P["p01"][1]) / 2
    for x, t in ((mx, "MACHINE"), (bx, "GUEST BAY")):
        tw = fx.getlength(t) + 24
        d.rounded_rectangle((x - tw / 2, cy - 22, x + tw / 2, cy + 22), 10, fill=(255, 255, 255), outline=ACC, width=2)
        d.text((x, cy), t, font=fx, fill=INK, anchor="mm")
drawing("pro_plan", "PLAN", "Seen from above with the roof off. The front (curtain side) is at the bottom",
    lambda P: [(P0(P, "p00"), P0(P, "p10"), "180 cm", "y", 60),
               (P0(P, "p00"), P0(P, "pm"), "60", "y", 120),
               (P0(P, "pm"), P0(P, "p10"), "120", "y", 120),
               (P0(P, "p01"), P0(P, "p00"), "110 cm", "x", -70)], plan_labels)
xray("pro_xray", "pro_xray.jpg")
for v in ("pro_hero", "pro_inside"):
    Image.open(os.path.join(D, f"{v}.png")).convert("RGB").save(os.path.join(OUT, f"{v}.jpg"), quality=88)
print("ok")
