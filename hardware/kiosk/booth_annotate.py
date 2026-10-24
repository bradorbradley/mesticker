import os, sys
from PIL import Image, ImageDraw
sys.argv = sys.argv[:3]
exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "annot_lib.py")).read())

def booth_drawing(view, title, sub, dims):
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
    f = font(FB, 30)
    P = meta[view]["dims"]
    for a, b, txt, ax, off in dims(P):
        dim_line(d, a, b, txt, f, ax, off)
    d.text((40, 40), title, font=font(FB, 34), fill=INK)
    d.text((40, 84), sub, font=font(FR, 26), fill=(110, 104, 140))
    bg.convert("RGB").save(os.path.join(OUT, f"{view}.jpg"), quality=90)

fl = lambda P: P["bottom"][1]
booth_drawing("booth_front", "FRONT", "Box 40 cm wide; laptop sits between the hood cheeks",
    lambda P: [((P["left"][0], fl(P)), (P["right"][0], fl(P)), "40 cm", "y", 60),
               ((P["left"][0], P["top"][1]), (P["left"][0], fl(P)), "44 cm", "x", -70),
               ((P["right"][0], P["deck"][1]), (P["right"][0], fl(P)), "16 cm", "x", 70)])
booth_drawing("booth_side", "SIDE", "Hood tilts with the Yoga screen in stand mode",
    lambda P: [((P["front"][0], fl(P)), (P["back"][0], fl(P)), "45 cm", "y", 60),
               ((P["back"][0], P["top"][1]), (P["back"][0], fl(P)), "44 cm", "x", 70)])
xray("booth_inside", "booth_inside.jpg", bgc=(246, 244, 251), fgc=(40, 34, 64))
Image.open(os.path.join(D, "booth_hero.png")).convert("RGB").save(os.path.join(OUT, "booth_hero.jpg"), quality=88)
print("ok")
