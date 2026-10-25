"""
MeSticker Booth — countertop sticker kiosk, procedural Blender model.

Run:  python kiosk.py <outdir> [--views hero,detail,xray,side,front] [--res 0.5] [--samples 96]
Builds the full scene from scratch, saves kiosk.blend + kiosk.glb, renders views.
All units are metres. Kiosk faces -Y, counter top is z = 0.
"""
import bpy, bmesh, math, os, sys, json
from mathutils import Vector, Matrix
from bpy_extras.object_utils import world_to_camera_view

HERE = os.path.dirname(os.path.abspath(__file__))
TEX = os.path.join(HERE, "tex")

args = sys.argv[1:]
OUT = args[0] if args and not args[0].startswith("--") else os.path.join(HERE, "out")
def arg(name, default):
    if name in args:
        return args[args.index(name) + 1]
    return default
VIEWS = arg("--views", "pro_hero,pro_inside,pro_xray,pro_front,pro_side,pro_plan").split(",")
RES = float(arg("--res", "1.0"))
SAMPLES = int(arg("--samples", "96"))
os.makedirs(OUT, exist_ok=True)

# ---------------------------------------------------------------- dimensions
W = 0.36          # width
D = 0.34          # depth
Z0 = 0.012        # plinth height (RGB glow strip)
YF, YB = -D / 2, D / 2
# side profile (y, z): front-bottom, back-bottom, back-top, head-front-top,
# screen-bottom, ledge-front
PROFILE = [(YF, Z0), (YB, Z0), (YB, 0.532), (0.06, 0.532), (-0.02, 0.272), (YF, 0.252)]
P3, P4, P5 = Vector(PROFILE[3]), Vector(PROFILE[4]), Vector(PROFILE[5])

# ---------------------------------------------------------------- reset
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

def coll(name):
    c = bpy.data.collections.new(name)
    scene.collection.children.link(c)
    return c

C_KIOSK, C_DECAL, C_INT, C_BAR, C_STUDIO = (coll(n) for n in
    ("kiosk", "decals", "internals", "bar", "studio"))

def link(obj, c):
    for uc in obj.users_collection:
        uc.objects.unlink(obj)
    c.objects.link(obj)
    return obj

# ---------------------------------------------------------------- materials
def new_mat(name):
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    return m

def bsdf_of(m):
    return next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")

def setp(b, **kw):
    names = {"color": "Base Color", "rough": "Roughness", "metal": "Metallic",
             "alpha": "Alpha", "trans": "Transmission Weight", "ior": "IOR",
             "coat": "Coat Weight", "coat_rough": "Coat Roughness",
             "emit": "Emission Color", "emit_str": "Emission Strength",
             "spec": "Specular IOR Level"}
    for k, v in kw.items():
        sock = b.inputs[names[k]]
        if isinstance(v, str):
            v = hex_rgba(v)
        sock.default_value = v

def hex_rgba(h, a=1.0):
    h = h.lstrip("#")
    srgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]
    return (*lin, a)

def mat_basic(name, color, rough=0.5, metal=0.0, **kw):
    m = new_mat(name)
    b = bsdf_of(m)
    setp(b, color=color, rough=rough, metal=metal, **kw)
    m.diffuse_color = hex_rgba(color)
    return m

def mat_emit(name, color, strength):
    m = new_mat(name)
    b = bsdf_of(m)
    setp(b, color="#000000", emit=color, emit_str=strength, rough=0.4)
    return m

def mat_image(name, path, rough=0.35, emit=0.0, coat=0.0):
    m = new_mat(name)
    nt = m.node_tree
    b = bsdf_of(m)
    img = nt.nodes.new("ShaderNodeTexImage")
    img.image = bpy.data.images.load(path)
    img.interpolation = "Cubic"
    nt.links.new(img.outputs["Color"], b.inputs["Base Color"])
    nt.links.new(img.outputs["Alpha"], b.inputs["Alpha"])
    setp(b, rough=rough, coat=coat)
    if emit:
        nt.links.new(img.outputs["Color"], b.inputs["Emission Color"])
        setp(b, emit_str=emit)
    try:
        m.blend_method = "HASHED"
    except Exception:
        pass
    return m

def mat_gradient(name, stops, axis="Z", lo=0.0, hi=0.53, rough=0.28, coat=0.6):
    """Brand gradient along an object axis (for the shell side panels)."""
    m = new_mat(name)
    nt = m.node_tree
    b = bsdf_of(m)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    mr = nt.nodes.new("ShaderNodeMapRange")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    nt.links.new(tc.outputs["Object"], sep.inputs[0])
    nt.links.new(sep.outputs[axis], mr.inputs["Value"])
    mr.inputs["From Min"].default_value = lo
    mr.inputs["From Max"].default_value = hi
    nt.links.new(mr.outputs["Result"], ramp.inputs["Fac"])
    els = ramp.color_ramp.elements
    els[0].position, els[0].color = stops[0][0], hex_rgba(stops[0][1])
    els[1].position, els[1].color = stops[-1][0], hex_rgba(stops[-1][1])
    for pos, col in stops[1:-1]:
        e = els.new(pos)
        e.color = hex_rgba(col)
    nt.links.new(ramp.outputs["Color"], b.inputs["Base Color"])
    setp(b, rough=rough, coat=coat, coat_rough=0.08)
    m["gltf_fallback"] = stops[len(stops) // 2][1]
    m.diffuse_color = hex_rgba(stops[len(stops) // 2][1])
    return m

M = {
    "shell": mat_basic("Shell white", "#F6F3FB", rough=0.32, coat=0.5, coat_rough=0.1),
    "side": mat_gradient("Shell gradient", [(0.0, "#7C5CFC"), (0.55, "#FF6B9D"), (1.0, "#FF9F43")]),
    "rubber": mat_basic("Charcoal soft-touch", "#24232B", rough=0.75),
    "glass_black": mat_basic("Black glass", "#050507", rough=0.04, coat=1.0, coat_rough=0.02),
    "slot": mat_basic("Slot", "#0B0B10", rough=0.6),
    "chrome": mat_basic("Brushed steel", "#C9CBD3", rough=0.22, metal=1.0),
    "lens": mat_basic("Lens", "#0A0F1E", rough=0.02, coat=1.0),
    "ring": mat_emit("Ring light", "#FFF4E8", 6.0),
    "lightbar": mat_emit("Selfie light bar", "#FFF1E6", 3.5),
    "glow": mat_emit("Plinth RGB glow", "#B35CFF", 18.0),
    "screen": mat_image("Screen UI", os.path.join(TEX, "screen.png"), rough=0.12, emit=0.55),
    "nfc": mat_image("Tap pad", os.path.join(TEX, "nfc.png"), rough=0.5, emit=0.9),
    "logo_w": mat_image("Logo white", os.path.join(TEX, "logo_white.png"), rough=0.3),
    "logo_g": mat_image("Logo gradient", os.path.join(TEX, "logo_grad.png"), rough=0.3),
    "slot_label": mat_image("Slot label", os.path.join(TEX, "slot_label.png"), rough=0.4),
    "liner": mat_basic("Sticker liner", "#FBFBF8", rough=0.45),
    # internals
    "pcb": mat_basic("PCB green", "#1E6B4A", rough=0.5),
    "printer": mat_basic("Printer body", "#4A4D5C", rough=0.45, alpha=0.55),
    "roll": mat_basic("Label roll", "#F5F5F0", rough=0.5),
    "psu": mat_basic("PSU", "#8B8E99", rough=0.35, metal=0.8),
    "pc": mat_basic("Mini PC", "#1F2026", rough=0.3, metal=0.4),
    "reader": mat_basic("Card reader", "#2B2D3A", rough=0.4),
    "fan": mat_basic("Fan", "#101015", rough=0.5),
    "xray": None,
}
for i in range(2, 7):
    M[f"st{i}"] = mat_image(f"Sticker {i}", os.path.join(TEX, f"sticker{i}.png"), rough=0.3, coat=0.6)
M["st1"] = mat_image("Sticker 1", os.path.join(TEX, "sticker.png"), rough=0.3, coat=0.6)

def xray_mat():
    m = new_mat("X-ray shell")
    b = bsdf_of(m)
    setp(b, color="#B9A8FF", rough=0.1, alpha=0.07, coat=0.3)
    try:
        m.blend_method = "BLEND"
    except Exception:
        pass
    return m
M["xray"] = xray_mat()
M["xray_line"] = mat_emit("X-ray edge", "#A78BFF", 5.0)

# ---------------------------------------------------------------- geometry helpers
def finish(obj, c, mat=None, bevel=None, segs=4, smooth=True):
    link(obj, c)
    if mat is not None:
        obj.data.materials.append(mat)
    if bevel:
        mod = obj.modifiers.new("Bevel", "BEVEL")
        mod.width = bevel
        mod.segments = segs
        mod.limit_method = "ANGLE"
        mod.harden_normals = True
    if smooth and obj.type == "MESH":
        for p in obj.data.polygons:
            p.use_smooth = True
    return obj

def box(name, size, loc=(0, 0, 0), rot=(0, 0, 0), c=None, mat=None, bevel=None, segs=4, parent=None):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    obj.location, obj.rotation_euler = loc, rot
    if parent:
        obj.parent = parent
    return finish(obj, c or C_KIOSK, mat, bevel, segs, smooth=bool(bevel))

def plane(name, w, h, loc=(0, 0, 0), rot=(0, 0, 0), c=None, mat=None, parent=None):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    v = [bm.verts.new((x * w / 2, y * h / 2, 0)) for x, y in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    f = bm.faces.new(v)
    uv = bm.loops.layers.uv.new("UVMap")
    for loop, co in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
        loop[uv].uv = co
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    obj.location, obj.rotation_euler = loc, rot
    if parent:
        obj.parent = parent
    return finish(obj, c or C_KIOSK, mat, smooth=False)

def cyl(name, r, depth, loc=(0, 0, 0), rot=(0, 0, 0), c=None, mat=None, verts=48, r2=None, bevel=None, parent=None):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=verts,
                          radius1=r, radius2=r if r2 is None else r2, depth=depth)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    obj.location, obj.rotation_euler = loc, rot
    if parent:
        obj.parent = parent
    return finish(obj, c or C_KIOSK, mat, bevel, smooth=True)

def torus(name, R, r, loc=(0, 0, 0), rot=(0, 0, 0), c=None, mat=None, parent=None):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    seg, ring = 64, 16
    rings = []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        row = []
        for j in range(ring):
            b = 2 * math.pi * j / ring
            row.append(bm.verts.new(((R + r * math.cos(b)) * math.cos(a),
                                     (R + r * math.cos(b)) * math.sin(a), r * math.sin(b))))
        rings.append(row)
    for i in range(seg):
        for j in range(ring):
            bm.faces.new((rings[i][j], rings[(i + 1) % seg][j],
                          rings[(i + 1) % seg][(j + 1) % ring], rings[i][(j + 1) % ring]))
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    obj.location, obj.rotation_euler = loc, rot
    if parent:
        obj.parent = parent
    return finish(obj, c or C_KIOSK, mat, smooth=True)

def frame(name, loc, rot):
    e = bpy.data.objects.new(name, None)
    e.location, e.rotation_euler = loc, rot
    C_KIOSK.objects.link(e)
    return e

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
# ---------------------------------------------------------------- venue (bar corner) + studio
import random
random.seed(11)
V = C_BAR
def area(name, loc, target, energy, size, color="#FFFFFF", c=None, shape="DISK", size_y=None):
    ld = bpy.data.lights.new(name, "AREA")
    ld.energy = energy
    ld.size = size
    ld.shape = shape
    if size_y:
        ld.size_y = size_y
    ld.color = hex_rgba(color)[:3]
    o = bpy.data.objects.new(name, ld)
    o.location = loc
    d = Vector(target) - Vector(loc)
    o.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    (c or scene.collection).objects.link(o)
    return o

floor = new_mat("Venue floor")
nt = floor.node_tree
fb = bsdf_of(floor)
tc = nt.nodes.new("ShaderNodeTexCoord")
mp = nt.nodes.new("ShaderNodeMapping")
mp.inputs["Scale"].default_value = (1.0, 0.12, 1.0)
wave = nt.nodes.new("ShaderNodeTexWave")
wave.inputs["Scale"].default_value = 2.0
wave.inputs["Distortion"].default_value = 5.0
brick = nt.nodes.new("ShaderNodeTexBrick")
brick.inputs["Scale"].default_value = 1.0
ramp = nt.nodes.new("ShaderNodeValToRGB")
ramp.color_ramp.elements[0].color = hex_rgba("#241510")
ramp.color_ramp.elements[1].color = hex_rgba("#4A2C1C")
nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
nt.links.new(mp.outputs["Vector"], wave.inputs["Vector"])
nt.links.new(wave.outputs["Fac"], ramp.inputs["Fac"])
nt.links.new(ramp.outputs["Color"], fb.inputs["Base Color"])
setp(fb, rough=0.28, coat=0.5, coat_rough=0.1)
plane("Venue floor", 14, 14, (0, 0, 0), c=V, mat=floor)
wallm = mat_basic("Venue wall", "#16202E", rough=0.85)
box("Venue back wall", (14, 0.1, 4), (0, Y1 + 0.45, 2), c=V, mat=wallm)
box("Venue side wall", (0.1, 14, 4), (-3.2, 0, 2), c=V, mat=wallm)
counter = mat_basic("Bar counter", "#3A2216", rough=0.35, coat=0.6)
box("Bar counter", (3.2, 0.7, 1.05), (3.6, 0.2, 0.525), c=V, mat=counter, bevel=0.02)
box("Bar top", (3.3, 0.78, 0.05), (3.6, 0.2, 1.075), c=V, mat=mat_basic("Bar top brass", "#B08440", rough=0.3, metal=1.0), bevel=0.01)
neon = mat_emit("Neon pink", "#FF4F9A", 25.0)
neon2 = mat_emit("Neon blue", "#5B7CFF", 25.0)
for i in range(3):
    torus(f"Neon ring {i}", 0.16 + i * 0.07, 0.008, (2.3, Y1 + 0.39, 2.4), (math.pi / 2, 0, 0), c=V, mat=neon if i % 2 == 0 else neon2)
bokeh = mat_emit("String lights", "#FFC27A", 40.0)
for i in range(34):
    x = -3.0 + i * 0.25
    me_ = bpy.data.meshes.new("bulb")
    bmb = bmesh.new()
    bmesh.ops.create_uvsphere(bmb, u_segments=10, v_segments=6, radius=0.025)
    bmb.to_mesh(me_)
    bmb.free()
    o = bpy.data.objects.new(f"String light {i}", me_)
    o.location = (x, Y1 + 0.35, 3.1 - 0.15 * math.sin(i * 0.6) ** 2)
    finish(o, V, bokeh)
stool_m = mat_basic("Stool", "#1E1E24", rough=0.4, metal=0.7)
for x in (2.6, 3.4, 4.2):
    cyl(f"Stool seat {x}", 0.19, 0.06, (x, -0.45, 0.76), c=V, mat=mat_velvet("Stool seat", "#2B2240"))
    cyl(f"Stool post {x}", 0.025, 0.73, (x, -0.45, 0.365), c=V, mat=stool_m)
    cyl(f"Stool foot {x}", 0.2, 0.02, (x, -0.45, 0.01), c=V, mat=stool_m)

S_ = C_STUDIO
studio = mat_basic("Studio sweep", "#ECE9F3", rough=0.7)
plane("Studio floor", 20, 20, (0, 0, 0), c=S_, mat=studio)
plane("Studio wall", 20, 8, (0, 4.0, 4), (math.pi / 2, 0, 0), c=S_, mat=studio)

area("Venue key", (-1.5, -3.5, 3.2), (0, 0, 1.0), 600, 2.5, "#FFD7A8", c=V)
area("Venue fill", (3.5, -2.5, 2.0), (0, 0, 1.0), 200, 2.0, "#C9B8FF", c=V)
area("Booth interior glow", (0.3, 0.0, 1.95), (0.3, 0.0, 0.0), 35, 0.8, "#FFF1E6", c=K)
area("Studio key", (-3.0, -4.0, 4.0), (0, 0, 1.0), 900, 4.0, "#FFFFFF", c=S_)
area("Studio fill", (4.0, -3.0, 2.5), (0, 0, 1.0), 350, 3.0, "#F2EEFF", c=S_)
area("Studio top", (0, 0, 5.0), (0, 0, 0), 500, 4.0, "#FFFFFF", c=S_)

world = bpy.data.worlds.new("World")
scene.world = world
try:
    world.use_nodes = True
except Exception:
    pass
bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
# ---------------------------------------------------------------- render settings
scene.render.engine = "CYCLES"
cy = scene.cycles
cy.device = "CPU"
cy.samples = SAMPLES
cy.use_adaptive_sampling = True
cy.use_denoising = True
try:
    cy.denoiser = "OPENIMAGEDENOISE"
except Exception:
    pass
cy.max_bounces = 8
cy.transmission_bounces = 8
cy.transparent_max_bounces = 16
scene.render.film_transparent = False
try:
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
except Exception:
    pass

def camera(name, loc, target, lens=50, fstop=None, ortho=None):
    cd = bpy.data.cameras.new(name)
    cd.lens = lens
    cd.sensor_width = 36
    if ortho:
        cd.type = "ORTHO"
        cd.ortho_scale = ortho
    if fstop:
        cd.dof.use_dof = True
        cd.dof.aperture_fstop = fstop
        cd.dof.focus_distance = (Vector(target) - Vector(loc)).length
    o = bpy.data.objects.new(name, cd)
    o.location = loc
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    scene.collection.objects.link(o)
    return o

# ---------------------------------------------------------------- cameras + modes
TOP = ZT + 0.03 + SIGN_H
CAMS = {
    "pro_hero": (camera("Cam pro hero", (2.45, -3.05, 1.55), (0.0, 0.0, 1.12), 30, 4.0), (1600, 1200), "bar"),
    "pro_inside": (camera("Cam pro inside", (0.66, 0.08, 1.12), (-0.3, -0.02, 1.22), 18), (1600, 1200), "bar"),
    "pro_xray": (camera("Cam pro xray", (-3.0, -3.3, 2.4), (0.0, 0.0, 1.0), 32), (1600, 1200), "xray"),
    "pro_front": (camera("Cam pro front", (0.0, -8.0, TOP / 2), (0.0, 0.0, TOP / 2), ortho=3.0), (1400, 1200), "studio"),
    "pro_side": (camera("Cam pro side", (8.0, 0.0, TOP / 2), (0.0, 0.0, TOP / 2), ortho=3.0), (1400, 1200), "studio"),
    "pro_plan": (camera("Cam pro plan", (0.0, 0.0, 8.0), (0.0, 0.0001, 0.0), ortho=2.6), (1400, 1100), "plan"),
}
CAMS["pro_plan"][0].rotation_euler = (0, 0, 0)

SHELL = ["Machine front panel", "Camera wall panel", "Machine cabinet", "Bay back wall", "Bay end wall", "Front pillar", "Front header", "Roof", "Sign box", "Bench base", "Pay shelf"]
orig = {n: list(bpy.data.objects[n].data.materials) for n in SHELL}
HIDE_XRAY = ["Curtain", "Wrap back", "Wrap end", "Backdrop", "Back wall felt", "Sign logo", "Pickup label"]
HIDE_PLAN = ["Roof", "Sign box", "Sign logo", "Ceiling softbox"] + [o.name for o in bpy.data.objects if o.name.startswith("Marquee bulb")]

def set_mode(mode):
    xr = mode == "xray"
    C_BAR.hide_render = mode != "bar"
    C_STUDIO.hide_render = mode == "bar"
    C_INT.hide_render = not xr
    C_DECAL.hide_render = xr
    scene.render.film_transparent = mode in ("studio", "plan")
    for n in ("Studio floor", "Studio wall"):
        bpy.data.objects[n].hide_render = mode in ("studio", "plan")
    studio.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = hex_rgba("#17141F" if xr else "#ECE9F3")
    for n in SHELL:
        o = bpy.data.objects[n]
        for i in range(len(o.data.materials)):
            o.data.materials[i] = M["xray"] if xr else orig[n][i]
    for n in HIDE_XRAY:
        bpy.data.objects[n].hide_render = xr
    for n in HIDE_PLAN:
        bpy.data.objects[n].hide_render = mode == "plan"
    if xr:
        bg.inputs["Color"].default_value = hex_rgba("#100E18"); bg.inputs["Strength"].default_value = 0.3
    elif mode == "bar":
        bg.inputs["Color"].default_value = hex_rgba("#0E0A10"); bg.inputs["Strength"].default_value = 0.3
    else:
        bg.inputs["Color"].default_value = hex_rgba("#EEEAF6"); bg.inputs["Strength"].default_value = 0.8

CALLOUTS = [
    ("Sign box", (0.55, 0, 0.0), "LED marquee sign"),
    ("Booth camera body", (0, 0, 0), "Camera + ring light"),
    ("Inside display back", (0, 0, 0), '27" touchscreen (inside)'),
    ("Softbox bar 1", (0, 0, 0), "LED softbox bars"),
    ("Tap reader (Stripe S710)", (0, 0, 0), "Tap to pay (Stripe S710)"),
    ("Attract display back", (0, 0, 0.2), '43" attract screen (outside)'),
    ("Primera LX610", (0, 0, 0), "Primera LX610: prints + cuts from a roll"),
    ("Output chute", (0, 0, 0), "Sticker pickup chute"),
    ("Mini PC", (0, 0, 0), "Mini PC (runs the booth)"),
    ("UPS + power distribution", (0, 0, 0), "UPS + power distribution"),
    ("Roof fan", (0, 0, 0), "Exhaust fan"),
    ("Bench cushion", (0, 0, 0), "Bench for 2–4 guests"),
    ("Post 0.88,0.53", (0, 0, 0.4), '1.5" steel tube frame'),
    ("Caster 0.78,-0.43", (0, 0, 0), "Locking casters + levelers"),
]

def proj(p):
    v = world_to_camera_view(scene, scene.camera, Vector(p))
    return [v.x * scene.render.resolution_x, (1 - v.y) * scene.render.resolution_y]

meta = {}
for view in VIEWS:
    cam, (rx, ry), mode = CAMS[view]
    scene.camera = cam
    scene.render.resolution_x = int(rx * RES)
    scene.render.resolution_y = int(ry * RES)
    set_mode(mode)
    bpy.context.view_layer.update()
    e = {"size": [scene.render.resolution_x, scene.render.resolution_y]}
    if mode == "xray":
        e["callouts"] = []
        for n, off, lab in CALLOUTS:
            o = bpy.data.objects.get(n)
            if o is None:
                print("missing callout", n); continue
            e["callouts"].append([lab, *proj(o.matrix_world @ Vector((0, 0, 0)) + Vector(off))])
    if mode in ("studio", "plan"):
        e["dims"] = {k: proj(p) for k, p in {
            "fl": (X0, Y0, 0), "fr": (X1, Y0, 0), "top": (X0, Y0, TOP), "body": (X1, Y0, ZT),
            "o0": (OPEN_X0, Y0, 0), "o1": (OPEN_X1, Y0, 0), "otop": (OPEN_X1, Y0, OPEN_Z1),
            "sb": (X1, Y0, 0), "sk": (X1, Y1, 0), "stop": (X1, Y1, TOP),
            "p00": (X0, Y0, 0), "p10": (X1, Y0, 0), "p01": (X0, Y1, 0), "pm": (XM, Y0, 0)}.items()}
    meta[view] = e
    scene.render.filepath = os.path.join(OUT, f"{view}.png")
    print(f"--- rendering {view}", flush=True)
    bpy.ops.render.render(write_still=True)
json.dump(meta, open(os.path.join(OUT, "meta.json"), "w"), indent=1)
set_mode("bar")
scene.camera = CAMS["pro_hero"][0]
scene.render.resolution_x, scene.render.resolution_y = 1600, 1200
try:
    bpy.ops.file.pack_all()
except Exception as e:
    print("pack failed", e)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "mesticker_photobooth.blend"))
print("DONE", flush=True)
