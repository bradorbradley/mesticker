"""
MeSticker Photo Booth: single source of truth for fabrication (all units mm).

Origin: front-left-bottom corner of the booth body, on the floor.
  x = along the length (machine module on the left, 0..600; guest bay 600..1800)
  y = depth (front/aisle face y = 0, back y = 1100)
  z = up (floor = 0)
"""

L, D, H = 1800, 1100, 2000          # body
XM = 600                            # machine | bay split
PLINTH = 80                         # caster skirt height
TUBE = 38.1                         # 1.5" sq steel tube, 16 ga (1.65 mm wall)
ACM = 3                             # aluminum composite panel thickness
ROOF_T = 30
SIGN = dict(x0=40, x1=1760, y0=-30, y1=100, z0=H + ROOF_T, z1=H + ROOF_T + 280, bulbs_per_row=26, bulb_dia=22)
TOTAL_H = SIGN["z1"]                # 2310

OPENING = dict(x0=620, x1=1620, z0=PLINTH, z1=1900)            # curtain entry (front face of bay)
PILLAR = dict(x0=1620, x1=1800)
HEADER = dict(z0=1900, z1=2000)

# ---- machine module, front (aisle) face, y = 0
ATTRACT = dict(name='43" portrait display', cx=300, cz=1370, active=(535, 951), bezel=(575, 995), cutout=(545, 961))
PICKUP = dict(x0=150, x1=450, z0=620, z1=760, depth=120, lip_z=600)
# ---- machine module, camera wall (inside face at x = 600, faces +x into the bay); coordinates in y
TOUCH = dict(name='27" portrait touchscreen', cy=550, cz=1170, active=(336, 597), bezel=(370, 640), cutout=(346, 607))
CAMERA = dict(cy=550, cz=1580, hole=60, ring=140)
SOFTBOX = [dict(cy=170, cz=1220, w=120, h=1050), dict(cy=930, cz=1220, w=120, h=1050)]
PAY_SHELF = dict(cy=550, z=790, w=500, depth=130)
READER = dict(cy=700, cz=850, name="Stripe Reader S710")
SPEAKER = dict(cy=430, cz=656, w=160, h=84)
SERVICE_DOOR = dict(y0=300, y1=800, z0=250, z1=1650)            # machine end wall, x = 0
FAN = dict(cx=300, cy=800, dia=120)                             # machine roof
# ---- guest bay
BENCH = dict(x0=1395, x1=1775, y0=80, y1=1075, seat_z=480, cushion=60)
CEILING_LIGHT = dict(x0=700, x1=1680, y0=150, y1=950)
CURTAIN = dict(rod_z=1885, rod_dia=22, width=OPENING["x1"] - OPENING["x0"] + 60, drop=1780, fullness=2.0)

# ---- equipment inside the machine module (x 0..600)
EQUIP = [
    dict(name="Primera LX610 printer", x=128, y=50, z=450, w=345, d=432, h=242),
    dict(name="Printer shelf (5 mm aluminum plate)", x=19, y=19, z=432, w=562, d=1062, h=5),
    dict(name="Mini PC", x=200, y=450, z=90, w=200, d=200, h=60),
    dict(name="UPS + power distribution", x=105, y=700, z=90, w=150, d=350, h=220),
    dict(name="Spare roll storage", x=330, y=200, z=90, w=250, d=200, h=150),
    dict(name="LED / sign controller", x=420, y=470, z=170, w=120, d=120, h=40),
]

# ---------------------------------------------------------------- steel frame
def frame_members():
    """Every tube as (module, label, axis, length_mm, (x, y, z) start). Butt-welded between posts."""
    t = TUBE
    m = []
    def add(mod, label, axis, length, start, qty=1):
        m.append(dict(module=mod, label=label, axis=axis, length=round(length, 1), start=start, qty=qty))
    zb, zt = PLINTH, H - t                     # bottom rail z, top rail z (bottom of tube)
    post = H - PLINTH                          # 1920
    # Machine module M: posts at x 0 / 600-t, y 0 / 1100-t
    for x in (0, XM - t):
        for y in (0, D - t):
            add("M", "Post", "z", post, (x, y, zb))
    for z, lvl in ((zb, "bottom"), (1000, "mid"), (zt, "top")):
        for y in ((D - t,) if lvl == "mid" else (0, D - t)):   # no front mid rail: the attract display sits there
            add("M", f"X rail {lvl}", "x", XM - 2 * t, (t, y, z))
        for x in (0, XM - t):
            add("M", f"Y rail {lvl}", "y", D - 2 * t, (x, t, z))
    for x in (0, XM - t):
        add("M", "Printer shelf rail", "y", D - 2 * t, (x, t, 432 - t))
    for z in (830, 1500):
        add("M", "Camera wall rail", "y", D - 2 * t, (XM - t, t, z))
    for y in (400, 700 - t):
        add("M", "Touchscreen mount stile", "z", 1500 - 830 - t, (XM - t, y, 830 + t))
    for z in (560, 860):
        add("M", "Front face rail", "x", XM - 2 * t, (t, 0, z))
    for x in (200 - t / 2, 400 - t / 2):
        add("M", "Display mount stile", "z", zt - 860 - t, (x, 0, 860 + t))
    # Bay B: knock-down sub-frames bolted to M posts at x = 600
    for y in (0, D - t):
        add("B-end", "Post", "z", post, (L - t, y, zb))
    for z, lvl in ((zb, "bottom"), (1000, "mid"), (zt, "top")):
        add("B-end", f"Y rail {lvl}", "y", D - 2 * t, (L - t, t, z))
    for z, lvl in ((zb, "bottom"), (1000, "mid"), (zt, "top")):
        add("B-back", f"X rail {lvl}", "x", L - XM - 2 * t + t, (XM, D - t, z))
    add("B-back", "Center stile", "z", zt - zb - t, (1200 - t / 2, D - t, zb + t))
    add("B-front", "Pillar post", "z", post, (PILLAR["x0"], 0, zb))
    add("B-front", "Header top rail", "x", L - XM - 2 * t + t, (XM, 0, zt))
    add("B-front", "Header lower rail", "x", PILLAR["x0"] - XM, (XM, 0, HEADER["z0"] - t))
    for z in (zb, 1000):
        add("B-front", "Pillar rail", "x", L - PILLAR["x0"] - 2 * t, (PILLAR["x0"] + t, 0, z))
    add("B-floor", "Threshold rail", "x", PILLAR["x0"] - XM, (XM, 0, zb))
    for x in (1000, 1400):
        add("B-floor", "Floor joist", "y", D - 2 * t, (x, t, zb))
        add("B-roof", "Roof joist", "y", D - 2 * t, (x, t, zt))
    return m

def cut_list():
    rows = {}
    for f in frame_members():
        k = (f["module"], f["label"], f["length"])
        rows[k] = rows.get(k, 0) + f["qty"]
    out = [dict(module=k[0], part=k[1], length_mm=k[2], qty=q) for k, q in rows.items()]
    return sorted(out, key=lambda r: (r["module"], -r["length_mm"]))

# ---------------------------------------------------------------- panels (ACM skins + liners)
def panels():
    """Flat panels: name, w x h (as cut), material, qty, cutouts [(kind, cx, cy, w, h)] in panel coords (origin bottom-left)."""
    ph = H - PLINTH                          # 1920 skin height (plinth skirt separate)
    P = []
    def add(code, name, w, h, mat="3 mm ACM, gloss plum", qty=1, cutouts=(), note=""):
        P.append(dict(code=code, name=name, w=w, h=h, mat=mat, qty=qty, cutouts=list(cutouts), note=note))
    z0 = PLINTH
    add("M1", "Machine front (aisle face)", XM, ph, "3 mm ACM, gloss white", cutouts=[
        ("rect", ATTRACT["cx"], ATTRACT["cz"] - z0, *ATTRACT["cutout"]),
        ("rect", (PICKUP["x0"] + PICKUP["x1"]) / 2, (PICKUP["z0"] + PICKUP["z1"]) / 2 - z0, PICKUP["x1"] - PICKUP["x0"], PICKUP["z1"] - PICKUP["z0"])],
        note="Display bezel overlaps cutout by 15 mm each side")
    add("M2", "Machine end wall", D, ph, cutouts=[
        ("rect", (SERVICE_DOOR["y0"] + SERVICE_DOOR["y1"]) / 2, (SERVICE_DOOR["z0"] + SERVICE_DOOR["z1"]) / 2 - z0,
         SERVICE_DOOR["y1"] - SERVICE_DOOR["y0"], SERVICE_DOOR["z1"] - SERVICE_DOOR["z0"])], note="Cut-out becomes the service door (M2D)")
    add("M2D", "Service door", SERVICE_DOOR["y1"] - SERVICE_DOOR["y0"] + 30, SERVICE_DOOR["z1"] - SERVICE_DOOR["z0"] + 30,
        "3 mm ACM on 1\" tube sub-frame", note="Piano hinge one side, cam lock other side")
    add("M3", "Machine back", XM, ph, "3 mm ACM, gloss plum (wrapped)")
    add("M4", "Camera wall (inside)", D, ph, "3 mm ACM, gloss white", cutouts=[
        ("rect", TOUCH["cy"], TOUCH["cz"] - z0, *TOUCH["cutout"]),
        ("circle", CAMERA["cy"], CAMERA["cz"] - z0, CAMERA["hole"], CAMERA["hole"]),
        ("rect", SPEAKER["cy"], SPEAKER["cz"] - z0, SPEAKER["w"], SPEAKER["h"]),
        ("rect", SOFTBOX[0]["cy"], SOFTBOX[0]["cz"] - z0, 40, 20), ("rect", SOFTBOX[1]["cy"], SOFTBOX[1]["cz"] - z0, 40, 20),
        ("rect", READER["cy"], READER["cz"] - z0, 30, 20)], note="Small slots are cable pass-throughs")
    add("M5", "Machine roof", XM + 10, D + 20, cutouts=[("circle", FAN["cx"] + 10, FAN["cy"] + 10, FAN["dia"], FAN["dia"])])
    add("B1", "Bay back wall (outside)", L - XM, ph, "3 mm ACM, gloss plum (wrapped)")
    add("B2", "Bay end wall (outside)", D, ph, "3 mm ACM, gloss plum (wrapped)")
    add("B3", "Front pillar", L - PILLAR["x0"], ph)
    add("B4", "Front header", PILLAR["x0"] - XM, HEADER["z1"] - HEADER["z0"])
    add("B5", "Bay roof", L - XM + 10, D + 20, cutouts=[], note="Ceiling softbox hangs below; feed cable at back corner")
    add("B6", "Backdrop liner (end wall, inside)", D - 2 * ACM, ph - 30, "3 mm ACM, printed backdrop vinyl")
    add("B7", "Back wall liner (inside)", L - XM - 2 * ACM, ph - 30, "9 mm acoustic felt panel")
    add("B8", "Bay floor deck", L - XM - TUBE, D - 2 * TUBE, "18 mm plywood + 3 mm rubber", note="Sits on floor joists")
    add("P1", "Plinth skirt, long", L - 60, PLINTH - 10, "3 mm ACM, black", qty=2)
    add("P2", "Plinth skirt, short", D - 60, PLINTH - 10, "3 mm ACM, black", qty=2)
    add("S1", "Sign face", SIGN["x1"] - SIGN["x0"], SIGN["z1"] - SIGN["z0"], "3 mm ACM, gloss black + printed logo",
        cutouts=[("circle", 40 + i * (SIGN["x1"] - SIGN["x0"] - 80) / (SIGN["bulbs_per_row"] - 1), y, SIGN["bulb_dia"], SIGN["bulb_dia"])
                 for i in range(SIGN["bulbs_per_row"]) for y in (35, SIGN["z1"] - SIGN["z0"] - 35)])
    return P

if __name__ == "__main__":
    import json
    print(json.dumps(cut_list(), indent=1))
    print(sum(r["length_mm"] * r["qty"] for r in cut_list()) / 1000, "m of tube")
    print(len(panels()), "panel types")
