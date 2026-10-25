# ================================================================ MESTICKER PHOTO BOOTH (walk-in)
# Two modules on one plinth: a machine cabinet (camera wall + electronics) and a curtained bay.
# Long axis = X. Front (aisle side, curtain + attract screen) faces -Y.
L, DP = 1.80, 1.10            # footprint
X0, XM, X1 = -0.90, -0.30, 0.90
Y0, Y1 = -DP / 2, DP / 2
ZP = 0.08                     # plinth (glow strip + casters/levelers hidden inside)
ZT = 2.00                     # top of body
PT = 0.025                    # skin panel thickness (ACM over steel tube)
OPEN_X0, OPEN_X1, OPEN_Z1 = XM + 0.02, 0.72, 1.90
SIGN_H = 0.28

def mat_velvet(name, color):
    m = new_mat(name)
    b = bsdf_of(m)
    setp(b, color=color, rough=0.85)
    try:
        b.inputs["Sheen Weight"].default_value = 1.0
        b.inputs["Sheen Tint"].default_value = hex_rgba("#FFB3D1")
    except Exception:
        pass
    return m

WHITE = mat_basic("Booth gloss white", "#F7F5FB", rough=0.25, coat=0.7, coat_rough=0.08)
PLUM = mat_basic("Booth gloss plum", "#2A1B5E", rough=0.22, coat=0.8, coat_rough=0.06)
WRAP = mat_image("Vinyl wrap", os.path.join(TEX, "wrap.png"), rough=0.3, coat=0.5)
BACKDROP = mat_image("Backdrop print", os.path.join(TEX, "backdrop.png"), rough=0.6, emit=0.08)
ATTRACT = mat_image("Attract screen", os.path.join(TEX, "attract.png"), rough=0.1, emit=1.1)
INSIDE = mat_image("Inside screen", os.path.join(TEX, "inside.png"), rough=0.1, emit=0.9)
STRIP = mat_image("Sticker strip", os.path.join(TEX, "strip.png"), rough=0.3, coat=0.5)
VELVET = mat_velvet("Curtain velvet", "#B0175A")
FELT = mat_basic("Acoustic felt", "#CFC4F2", rough=0.95)
CUSHION = mat_velvet("Bench cushion", "#7C5CFC")
FLOORMAT = mat_basic("Rubber floor", "#2A2733", rough=0.8)
GOLD = mat_basic("Brushed gold", "#D9A54A", rough=0.25, metal=1.0)
BULB = mat_emit("Marquee bulbs", "#FFD9A0", 30.0)
SIGN_FACE = mat_basic("Sign face", "#1B1433", rough=0.35, coat=0.6)
SOFT = mat_emit("LED softbox", "#FFF3EA", 3.5)
STEEL_TUBE = mat_basic("Powder-coat steel tube", "#2E2F36", rough=0.4, metal=0.6)
K = C_KIOSK

def slab(name, x0, x1, y0, y1, z0, z1, mat=PLUM, c=None, bevel=0.004, parent=None):
    return box(name, (x1 - x0, y1 - y0, z1 - z0), ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2),
               c=c or K, mat=mat, bevel=bevel, segs=3, parent=parent)

# ---------------------------------------------------------------- shell
slab("Plinth", X0 + 0.03, X1 - 0.03, Y0 + 0.03, Y1 - 0.03, 0.0, ZP, mat=M["rubber"])
slab("Plinth glow", X0 + 0.035, X1 - 0.035, Y0 + 0.035, Y1 - 0.035, 0.012, 0.022, mat=M["glow"], bevel=None)
machine = slab("Machine cabinet", X0, XM, Y0, Y1, ZP, ZT, bevel=0.02)
slab("Bay back wall", XM, X1, Y1 - PT, Y1, ZP, ZT)
slab("Bay end wall", X1 - PT, X1, Y0, Y1, ZP, ZT)
slab("Front pillar", OPEN_X1, X1, Y0, Y0 + PT, ZP, ZT)
slab("Front header", XM, X1, Y0, Y0 + PT, OPEN_Z1, ZT)
slab("Roof", X0 - 0.01, X1 + 0.01, Y0 - 0.01, Y1 + 0.01, ZT, ZT + 0.03, bevel=0.01)
slab("Bay floor", XM, X1 - PT, Y0 + PT * 0, Y1 - PT, ZP - 0.01, ZP + 0.012, mat=FLOORMAT, bevel=0.003)
slab("Entry step edge", OPEN_X0, OPEN_X1, Y0 - 0.006, Y0 + 0.02, ZP - 0.01, ZP + 0.014, mat=GOLD, bevel=0.003)

# vinyl wrap on the back long wall (outside) and the end wall (outside)
plane("Wrap back", 1.78, 0.99, (0.0, Y1 + 0.0015, 1.05), (math.pi / 2, 0, math.pi), c=K, mat=WRAP)
plane("Wrap end", 1.08, 0.6, (X1 + 0.0015, 0.0, 1.05), (math.pi / 2, 0, math.pi / 2), c=K, mat=WRAP)
for name, m, y, z, s, r in [("End sticker A", "st1", -0.3, 1.62, 0.26, 8), ("End sticker B", "st2", 0.28, 1.6, 0.24, -7),
                            ("End sticker C", "st4", 0.02, 0.48, 0.2, 5)]:
    w = s * (0.786 if m == "st2" else (0.64 if m == "st4" else 1.0))
    plane(name, w, s, (X1 + 0.002, y, z), (math.pi / 2, math.radians(r), math.pi / 2), c=C_DECAL, mat=M[m])
# gradient band on the front of the machine cabinet base + header

# ---------------------------------------------------------------- front face of the machine (aisle side)
FX = (X0 + XM) / 2
plane("Machine front panel", XM - X0 - 0.06, ZT - ZP - 0.1, (FX, Y0 - 0.0008, (ZT + ZP) / 2 + 0.02), (math.pi / 2, 0, 0), c=K, mat=WHITE)
box("Attract bezel", (0.575, 0.012, 0.995), (FX, Y0 - 0.006, 1.37), c=K, mat=M["glass_black"], bevel=0.006)
plane("Attract display", 0.535, 0.951, (FX, Y0 - 0.0125, 1.37), (math.pi / 2, 0, 0), c=K, mat=ATTRACT)
# sticker pickup: recessed tray with a strip waiting in it
slab("Pickup recess", FX - 0.15, FX + 0.15, Y0 - 0.002, Y0 + 0.12, 0.62, 0.76, mat=M["slot"], bevel=0.006)
slab("Pickup lip", FX - 0.16, FX + 0.16, Y0 - 0.03, Y0 + 0.01, 0.6, 0.625, mat=GOLD, bevel=0.004)
plane("Pickup label", 0.3, 0.03, (FX, Y0 - 0.002, 0.8), (math.pi / 2, 0, 0), c=K, mat=M["slot_label"])
plane("Strip in tray", 0.05, 0.15, (FX + 0.01, Y0 - 0.012, 0.6265), (0, 0, math.radians(88)), c=K, mat=STRIP)

# ---------------------------------------------------------------- marquee sign
SX0, SX1 = X0 + 0.04, X1 - 0.04
slab("Sign box", SX0, SX1, Y0 - 0.03, Y0 + 0.1, ZT + 0.03, ZT + 0.03 + SIGN_H, mat=SIGN_FACE, bevel=0.02)
plane("Sign logo", 1.05, 0.225, (0, Y0 - 0.0315, ZT + 0.03 + SIGN_H / 2), (math.pi / 2, 0, 0), c=K, mat=M["logo_g"])
nb = 26
for i in range(nb):
    x = SX0 + 0.04 + i * (SX1 - SX0 - 0.08) / (nb - 1)
    for z in (ZT + 0.03 + 0.035, ZT + 0.03 + SIGN_H - 0.035):
        me_ = bpy.data.meshes.new("bulb")
        bmb = bmesh.new()
        bmesh.ops.create_uvsphere(bmb, u_segments=12, v_segments=8, radius=0.011)
        bmb.to_mesh(me_)
        bmb.free()
        o = bpy.data.objects.new(f"Marquee bulb {i}-{z:.2f}", me_)
        o.location = (x, Y0 - 0.035, z)
        finish(o, K, BULB)

# ---------------------------------------------------------------- curtain (pleated velvet, pulled to the right)
def curtain(name, xa, xb, y, z0, z1, gather=0.55, nu=220, nv=40, amp=0.035):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    grid = []
    for j in range(nv + 1):
        v = j / nv
        row = []
        for i in range(nu + 1):
            u = i / nu
            # open on the left: cloth bunches toward xb
            t = gather + (1 - gather) * u
            x = xa + (xb - xa) * t
            folds = 26
            ph = 2 * math.pi * folds * u
            sway = 0.012 * math.sin(3 * v + u * 4)
            yy = y - amp * (0.6 + 0.4 * v) * math.sin(ph) + sway
            z = z1 - (z1 - z0) * v
            row.append(bm.verts.new((x, yy, z)))
        grid.append(row)
    for j in range(nv):
        for i in range(nu):
            f = bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
            for loop, (a, b) in zip(f.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))):
                loop[uv].uv = (a / nu, 1 - b / nv)
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    finish(o, K, VELVET, smooth=True)
    sol = o.modifiers.new("Thickness", "SOLIDIFY")
    sol.thickness = 0.004
    return o

curtain("Curtain", OPEN_X0, OPEN_X1, Y0 - 0.03, ZP + 0.04, OPEN_Z1 - 0.03)
cyl("Curtain rod", 0.011, OPEN_X1 - OPEN_X0 + 0.06, ((OPEN_X0 + OPEN_X1) / 2, Y0 - 0.03, OPEN_Z1 - 0.015), (0, math.pi / 2, 0), c=K, mat=GOLD)
for x in (OPEN_X0 - 0.02, OPEN_X1 + 0.02):
    me_ = bpy.data.meshes.new("finial")
    bmf = bmesh.new()
    bmesh.ops.create_uvsphere(bmf, u_segments=16, v_segments=10, radius=0.02)
    bmf.to_mesh(me_)
    bmf.free()
    o = bpy.data.objects.new("Rod finial", me_)
    o.location = (x, Y0 - 0.03, OPEN_Z1 - 0.015)
    finish(o, K, GOLD)

# ---------------------------------------------------------------- interior
IX = XM + 0.0005                         # camera wall inner face (faces +X)
F_CAMWALL = frame("Camera wall", (XM, 0, 0), (math.pi / 2, 0, math.pi / 2))
# local axes: local Z -> +X (into the bay), local Y -> up, local X -> +Y (guest's right)
plane("Camera wall panel", 1.04, ZT - ZP - 0.02, (0, (ZT + ZP) / 2, 0.0008), c=K, mat=WHITE, parent=F_CAMWALL)
box("Inside bezel", (0.37, 0.64, 0.01), (0, 1.17, 0.005), c=K, mat=M["glass_black"], bevel=0.005, parent=F_CAMWALL)
plane("Inside display", 0.336, 0.597, (0, 1.17, 0.0105), c=K, mat=INSIDE, parent=F_CAMWALL)
cyl("Booth camera lens", 0.018, 0.03, (0, 1.58, 0.015), c=K, mat=M["lens"], parent=F_CAMWALL)
box("Booth camera body", (0.11, 0.07, 0.02), (0, 1.58, 0.0), c=K, mat=M["pc"], bevel=0.006, parent=F_CAMWALL)
torus("Booth ring light", 0.07, 0.008, (0, 1.58, 0.012), c=K, mat=M["ring"], parent=F_CAMWALL)
for sx in (-1, 1):
    box(f"Softbox bar {sx}", (0.12, 1.05, 0.02), (sx * 0.38, 1.22, 0.01), c=K, mat=SOFT, bevel=0.01, parent=F_CAMWALL)
box("Pay shelf", (0.5, 0.025, 0.13), (0, 0.79, 0.065), c=K, mat=WHITE, bevel=0.006, parent=F_CAMWALL)
box("Tap reader (Stripe S710)", (0.08, 0.16, 0.02), (0.15, 0.85, 0.07), (math.radians(-55), 0, 0), c=K, mat=M["reader"], bevel=0.008, parent=F_CAMWALL)
plane("Reader screen", 0.065, 0.1, (0.15, 0.858, 0.083), (math.radians(-55), 0, 0), c=K, mat=M["nfc"], parent=F_CAMWALL)
for i in range(7):
    box(f"Speaker slot {i}", (0.16, 0.006, 0.004), (-0.12, 0.62 + i * 0.012, 0.002), c=K, mat=M["slot"], parent=F_CAMWALL)
# backdrop + felt + bench + ceiling softbox
plane("Backdrop", DP - 2 * PT, ZT - ZP - 0.02, (X1 - PT - 0.0015, 0, (ZT + ZP) / 2), (math.pi / 2, 0, -math.pi / 2), c=K, mat=BACKDROP)
plane("Back wall felt", X1 - XM - PT, ZT - ZP - 0.02, ((XM + X1 - PT) / 2, Y1 - PT - 0.0015, (ZT + ZP) / 2), (math.pi / 2, 0, math.pi), c=K, mat=FELT)
slab("Bench base", X1 - PT - 0.38, X1 - PT, Y0 + 0.08, Y1 - PT - 0.02, ZP, 0.42, mat=WHITE)
slab("Bench cushion", X1 - PT - 0.4, X1 - PT, Y0 + 0.07, Y1 - PT - 0.01, 0.42, 0.48, mat=CUSHION, bevel=0.025)
slab("Ceiling softbox", XM + 0.1, X1 - 0.12, Y0 + 0.15, Y1 - 0.15, ZT - 0.02, ZT - 0.005, mat=SOFT, bevel=None)

# ---------------------------------------------------------------- internals (x-ray): steel frame + equipment
I = C_INT
t = 0.038   # 1.5" square tube
def tube(name, a, b):
    a, b = Vector(a), Vector(b)
    d = b - a
    size = (abs(d.x) + t, abs(d.y) + t, abs(d.z) + t)
    box(name, size, tuple((a + b) / 2), c=I, mat=STEEL_TUBE)
xs = (X0 + t / 2, XM, X1 - t / 2)
ys = (Y0 + t / 2, Y1 - t / 2)
for x in xs:
    for y in ys:
        tube(f"Post {x:.2f},{y:.2f}", (x, y, ZP), (x, y, ZT))
for z in (ZP + t / 2, 1.0, ZT - t / 2):
    for y in ys:
        tube(f"Rail X {z:.2f},{y:.2f}", (xs[0], y, z), (xs[2], y, z))
    for x in xs:
        tube(f"Rail Y {z:.2f},{x:.2f}", (x, ys[0], z), (x, ys[1], z))
PRX = (X0 + XM) / 2
box("Primera LX610", (0.345, 0.432, 0.242), (PRX, Y0 + 0.05 + 0.216, 0.45 + 0.121), c=I, mat=M["printer"], bevel=0.01)
box("Printer shelf", (0.56, 1.0, 0.012), (PRX, 0, 0.444), c=I, mat=STEEL_TUBE)
box("Output chute", (0.16, 0.1, 0.012), (PRX, Y0 + 0.06, 0.72), (math.radians(-20), 0, 0), c=I, mat=M["chrome"])
box("Mini PC", (0.2, 0.2, 0.06), (PRX, 0.3, 0.2), c=I, mat=M["pc"], bevel=0.006)
box("UPS + power distribution", (0.15, 0.35, 0.22), (PRX - 0.12, 0.25, 0.2), c=I, mat=M["psu"], bevel=0.006)
box("Spare roll storage", (0.25, 0.2, 0.15), (PRX + 0.1, -0.25, 0.18), c=I, mat=M["roll"], bevel=0.006)
box("Attract display back", (0.6, 0.06, 1.0), (FX, Y0 + 0.05, 1.37), c=I, mat=M["pc"], bevel=0.01)
box("Inside display back", (0.05, 0.4, 0.66), (XM - 0.035, 0, 1.17), c=I, mat=M["pc"], bevel=0.01)
cyl("Roof fan", 0.06, 0.03, (PRX, 0.25, ZT - 0.03), c=I, mat=M["fan"])
box("Camera mount", (0.04, 0.12, 0.08), (XM - 0.03, 0, 1.58), c=I, mat=STEEL_TUBE)
for x, y in ((X0 + 0.12, Y0 + 0.12), (X0 + 0.12, Y1 - 0.12), (X1 - 0.12, Y0 + 0.12), (X1 - 0.12, Y1 - 0.12), (XM, Y0 + 0.12), (XM, Y1 - 0.12)):
    cyl(f"Caster {x:.2f},{y:.2f}", 0.035, 0.03, (x, y, 0.04), (math.pi / 2, 0, 0), c=I, mat=M["rubber"])
cyl("Power cord", 0.005, 1.2, (X0 + 0.2, Y1 + 0.6, 0.008), (math.pi / 2, 0, 0), c=K, mat=M["rubber"], verts=16)
