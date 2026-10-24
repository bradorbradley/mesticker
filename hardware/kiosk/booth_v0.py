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
VIEWS = arg("--views", "booth_hero,booth_inside,booth_front,booth_side").split(",")
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

# ================================================================ CRUDE BOOTH v0
# Plywood box around a Lenovo Yoga (stand mode) + Liene PixCut S1 print-and-cut printer.
BW, BD, BH, T = 0.40, 0.45, 0.16, 0.012      # outer box, 12 mm (1/2") plywood
YF0, YB0 = -BD / 2, BD / 2
ZD = BH                                       # top of deck
WIN_W, WIN_Z0, WIN_Z1 = 0.20, 0.055, 0.095    # sticker exit window in the front panel
HOOD_H = 0.27

def wood_mat(name, c0, c1, scale=(1.0, 9.0, 1.0)):
    m = new_mat(name)
    nt = m.node_tree
    b = bsdf_of(m)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = scale
    wave = nt.nodes.new("ShaderNodeTexWave")
    wave.inputs["Scale"].default_value = 6.0
    wave.inputs["Distortion"].default_value = 4.0
    wave.inputs["Detail"].default_value = 3.0
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = hex_rgba(c0)
    ramp.color_ramp.elements[1].color = hex_rgba(c1)
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    nt.links.new(mp.outputs["Vector"], wave.inputs["Vector"])
    nt.links.new(wave.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], b.inputs["Base Color"])
    setp(b, rough=0.55)
    m.diffuse_color = hex_rgba(c1)
    return m

PLY = wood_mat("Birch plywood", "#C9A57A", "#E2C9A3")
PLY_V = wood_mat("Birch plywood vertical", "#C9A57A", "#E2C9A3", scale=(9.0, 1.0, 1.0))
PAINT = mat_basic("Painted violet", "#7656F2", rough=0.45)
PAINT_PINK = mat_basic("Painted pink", "#FF6B9D", rough=0.45)
ALU = mat_basic("Laptop aluminium", "#5B5E68", rough=0.3, metal=0.9)
PRINTER = mat_basic("PixCut white", "#F2F2F0", rough=0.35, coat=0.4)
PRINTER_DARK = mat_basic("PixCut grey", "#3A3C44", rough=0.4)
ACRYLIC = new_mat("Clear acrylic")
setp(bsdf_of(ACRYLIC), color="#FFFFFF", rough=0.02, trans=1.0, ior=1.49)
SCREEN_L = mat_image("Laptop screen UI", os.path.join(TEX, "screen_land.png"), rough=0.12, emit=0.6)
SHEET = mat_image("Sticker sheet", os.path.join(TEX, "sheet.png"), rough=0.3, coat=0.5)
PAYSIGN = mat_image("Pay sign", os.path.join(TEX, "paysign.png"), rough=0.4)
HEADER = mat_image("Header lettering", os.path.join(TEX, "header.png"), rough=0.5)
STEEL = M["chrome"]

K = C_KIOSK
def board(name, size, loc, mat=PLY, rot=(0, 0, 0), parent=None):
    return box(name, size, loc, rot, c=K, mat=mat, bevel=0.0012, segs=2, parent=parent)

iw = BW - 2 * T
ih = BH - 2 * T
board("Bottom", (BW, BD, T), (0, 0, T / 2))
board("Deck", (BW, BD, T), (0, 0, BH - T / 2))
for sx in (-1, 1):
    board(f"Side {'L' if sx < 0 else 'R'}", (T, BD, ih), (sx * (BW / 2 - T / 2), 0, BH / 2), mat=PLY_V)
# front panel = 4 pieces around the exit window, painted
fy = YF0 + T / 2
board("Front lower", (iw, T, WIN_Z0 - T), (0, fy, T + (WIN_Z0 - T) / 2), mat=PAINT)
board("Front upper", (iw, T, BH - T - WIN_Z1), (0, fy, WIN_Z1 + (BH - T - WIN_Z1) / 2), mat=PAINT)
pw = (iw - WIN_W) / 2
for sx in (-1, 1):
    board(f"Front pillar {sx}", (pw, T, WIN_Z1 - WIN_Z0), (sx * (WIN_W / 2 + pw / 2), fy, (WIN_Z0 + WIN_Z1) / 2), mat=PAINT)
plane("Front logo", 0.14, 0.03, (0, YF0 - 0.0004, 0.031), (math.pi / 2, 0, 0), c=K, mat=M["logo_w"])

# rear door on two hinges (opened in the "inside" view)
DOOR_HINGE = frame("Door hinge", (-iw / 2, YB0, T), (0, 0, 0))
DOOR_HINGE.parent = None
door = board("Rear door", (iw, T, ih), (iw / 2, -T / 2, ih / 2), parent=DOOR_HINGE)
for i in range(6):
    cyl(f"Vent hole {i}", 0.009, T + 0.002, (iw / 2 - 0.1 + i * 0.04, -T / 2, ih * 0.62), (math.pi / 2, 0, 0), c=K, mat=M["slot"], parent=DOOR_HINGE, verts=20)
cyl("Door knob", 0.008, 0.016, (iw - 0.03, 0.006, ih / 2), (math.pi / 2, 0, 0), c=K, mat=STEEL, parent=DOOR_HINGE)
for hz in (0.03, ih - 0.03):
    cyl(f"Hinge {hz:.2f}", 0.004, 0.035, (0, 0.003, hz), c=K, mat=STEEL, parent=DOOR_HINGE, verts=16)
cyl("Cable notch grommet", 0.008, 0.004, (iw / 2 - 0.13, -T / 2, 0.02), (math.pi / 2, 0, 0), c=K, mat=M["rubber"], parent=DOOR_HINGE, verts=20)

# hood cheeks (wedge profile) + header board, all on the deck
def cheek(name, x):
    prof = [(-0.08, 0.0), (YB0, 0.0), (YB0, HOOD_H), (0.055, HOOD_H)]
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    L = [bm.verts.new((x - T / 2, y, ZD + z)) for y, z in prof]
    R = [bm.verts.new((x + T / 2, y, ZD + z)) for y, z in prof]
    bm.faces.new(list(reversed(L)))
    bm.faces.new(R)
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new((L[i], L[j], R[j], R[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    return finish(o, K, PLY_V, bevel=0.0012, segs=2, smooth=False)

for sx in (-1, 1):
    cheek(f"Hood cheek {sx}", sx * (BW / 2 - T / 2))
board("Hood header", (iw, T, 0.075), (0, 0.06, ZD + HOOD_H - 0.0375), mat=PAINT_PINK)
plane("Header lettering", 0.33, 0.062, (0, 0.06 - T / 2 - 0.0004, ZD + HOOD_H - 0.0375), (math.pi / 2, 0, 0), c=K, mat=HEADER)
board("Hood top", (BW, YB0 - 0.055, T), (0, (0.055 + YB0) / 2, ZD + HOOD_H + T / 2))

# Lenovo Yoga 14" in stand mode: base keyboard-down behind, screen facing the guest
LID_W, LID_H = 0.32, 0.21
hinge_y = -0.015
yb = board("Yoga base (keyboard down)", (LID_W, 0.22, 0.016), (0, hinge_y + 0.11, ZD + 0.008), mat=ALU)
F_LID = frame("Yoga lid frame", (0, hinge_y, ZD + 0.004), (math.radians(78), 0, 0))
box("Yoga lid", (LID_W, LID_H, 0.007), (0, LID_H / 2, -0.0035), c=K, mat=ALU, bevel=0.003, parent=F_LID)
box("Yoga bezel", (LID_W - 0.004, LID_H - 0.004, 0.0012), (0, LID_H / 2, 0.0002), c=K, mat=M["glass_black"], bevel=0.002, parent=F_LID)
plane("Yoga display", 0.296, 0.1665, (0, LID_H / 2 - 0.006, 0.0009), c=K, mat=SCREEN_L, parent=F_LID)
cyl("Yoga webcam", 0.0022, 0.001, (0, LID_H - 0.009, 0.001), c=K, mat=M["lens"], parent=F_LID, verts=16)
# 3D-printed / L-bracket clips holding the laptop
for sx in (-1, 1):
    box(f"Laptop clip {sx}", (0.012, 0.03, 0.03), (sx * (LID_W / 2 + 0.006), hinge_y + 0.02, ZD + 0.015), c=K, mat=PRINTER_DARK, bevel=0.002)

# pay sign in a clear acrylic stand
F_SIGN = frame("Sign frame", (0.135, -0.2, ZD + 0.004), (math.radians(38), 0, math.radians(-10)))
plane("Pay sign", 0.06, 0.087, (0, 0.046, 0.0012), c=K, mat=PAYSIGN, parent=F_SIGN)
box("Sign acrylic", (0.068, 0.098, 0.002), (0, 0.049, 0), c=K, mat=ACRYLIC, bevel=0.0008, parent=F_SIGN)
box("Sign foot", (0.07, 0.05, 0.003), (0.135, -0.19, ZD + 0.0015), (0, 0, math.radians(-10)), c=K, mat=ACRYLIC, bevel=0.0008)

# ---------------------------------------------------------------- inside: printer, power strip
PW_, PD_, PH_ = 0.281, 0.196, 0.1045
py = YF0 + T + 0.004 + PD_ / 2
pr = box("PixCut S1 printer", (PW_, PD_, PH_), (0, py, T + PH_ / 2), c=K, mat=PRINTER, bevel=0.014, segs=5)
box("PixCut top panel", (PW_ - 0.03, PD_ - 0.05, 0.003), (0, py + 0.01, T + PH_ + 0.0005), c=K, mat=PRINTER_DARK, bevel=0.0015)
box("PixCut output slot", (0.12, 0.004, 0.006), (0, py - PD_ / 2 - 0.0005, T + 0.062), c=K, mat=M["slot"], bevel=0.001)
box("Paper cassette", (0.12, 0.2, 0.025), (0, py + PD_ / 2 + 0.07, T + 0.03), c=K, mat=PRINTER, bevel=0.004)
box("Power strip", (0.26, 0.05, 0.035), (0.0, YB0 - T - 0.045, T + 0.0175), c=K, mat=mat_basic("Power strip", "#ECECEC", rough=0.4), bevel=0.006)
cyl("Power cord", 0.0035, 0.6, (0.07, YB0 + 0.3, 0.006), (math.pi / 2, 0, 0), c=K, mat=M["rubber"], verts=16)
cyl("Laptop charger cable", 0.003, 0.16, (0.15, 0.17, ZD - 0.02), c=K, mat=M["rubber"], verts=12)

# sticker sheet coming out of the exit window, drooping toward the guest
SH = frame("Sheet hinge", (0, YF0 + 0.01, T + 0.062), (math.radians(14), 0, 0))
SHEET_L = 0.178
plane("Sticker sheet", 0.1016, SHEET_L, (0, -SHEET_L / 2 + 0.03, 0.0006), (0, 0, math.pi), c=K, mat=SHEET, parent=SH)

# decals: sticker-bomb on the right side + right cheek
F_RS = frame("Right side decals", (BW / 2 + 0.0006, 0, 0), (math.pi / 2, 0, math.pi / 2))
for name, m, x, z, s, r in [("Box sticker A", "st2", -0.14, 0.08, 0.075, 8), ("Box sticker B", "st3", -0.03, 0.085, 0.07, -9),
                            ("Box sticker C", "st6", 0.08, 0.08, 0.068, 12), ("Box sticker D", "st5", 0.17, 0.085, 0.06, -6),
                            ("Cheek sticker A", "st1", 0.12, ZD + 0.12, 0.08, -7), ("Cheek sticker B", "st4", 0.03, ZD + 0.06, 0.05, 10)]:
    w = s * (0.786 if m == "st2" else (0.64 if m == "st4" else 1.0))
    plane(name, w, s, (x, z, 0.0002 * (1 + len(name) % 5)), (0, 0, math.radians(r)), c=C_DECAL, mat=M[m], parent=F_RS)

# remove the big kiosk-only materials' objects: none were built; keep collections tidy
# ---------------------------------------------------------------- bar set
B = C_BAR
wood = new_mat("Walnut bar top")
nt = wood.node_tree
wb = bsdf_of(wood)
tc = nt.nodes.new("ShaderNodeTexCoord")
mp = nt.nodes.new("ShaderNodeMapping")
mp.inputs["Scale"].default_value = (1.0, 14.0, 1.0)
wave = nt.nodes.new("ShaderNodeTexWave")
wave.inputs["Scale"].default_value = 3.0
wave.inputs["Distortion"].default_value = 3.0
wave.inputs["Detail"].default_value = 4.0
ramp = nt.nodes.new("ShaderNodeValToRGB")
ramp.color_ramp.elements[0].color = hex_rgba("#311B0F")
ramp.color_ramp.elements[1].color = hex_rgba("#4A2A17")
nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
nt.links.new(mp.outputs["Vector"], wave.inputs["Vector"])
nt.links.new(wave.outputs["Fac"], ramp.inputs["Fac"])
nt.links.new(ramp.outputs["Color"], wb.inputs["Base Color"])
setp(wb, rough=0.22, coat=0.8, coat_rough=0.05)

box("Bar counter", (4.0, 1.1, 0.06), (0, 0.1, -0.03), c=B, mat=wood)
box("Counter edge", (4.0, 0.06, 0.06), (0, -0.47, -0.03), c=B, mat=wood, bevel=0.02)
wall = mat_basic("Back bar wall", "#1A1216", rough=0.8)
box("Back wall", (6, 0.05, 3), (0, 2.6, 1.0), c=B, mat=wall)
shelf_mat = mat_basic("Shelf", "#3B2418", rough=0.4)
glow_warm = mat_emit("Shelf backlight", "#FFB36B", 6.0)
bottle_cols = ["#2F6B3A", "#8A4B17", "#B9C6D0", "#5E1F2B", "#C78F2E", "#284E6B"]
bottle_mats = []
for i, col in enumerate(bottle_cols):
    bm_ = new_mat(f"Bottle glass {i}")
    bb = bsdf_of(bm_)
    setp(bb, color=col, rough=0.05, trans=0.9, ior=1.45)
    bottle_mats.append(bm_)
import random
random.seed(7)
for row, z in enumerate((0.25, 0.65, 1.05)):
    box(f"Shelf {row}", (3.0, 0.22, 0.025), (0, 2.45, z), c=B, mat=shelf_mat)
    box(f"Shelf light {row}", (3.0, 0.01, 0.01), (0, 2.56, z + 0.02), c=B, mat=glow_warm)
    x = -1.4
    while x < 1.4:
        h = random.uniform(0.22, 0.32)
        r = random.uniform(0.032, 0.045)
        m = random.choice(bottle_mats)
        cyl(f"Bottle {row}-{x:.2f}", r, h * 0.7, (x, 2.45, z + 0.0125 + h * 0.35), c=B, mat=m, verts=24)
        cyl(f"Neck {row}-{x:.2f}", r * 0.32, h * 0.3, (x, 2.45, z + 0.0125 + h * 0.85), c=B, mat=m, verts=16, r2=r * 0.28)
        x += random.uniform(0.1, 0.16)
bokeh = mat_emit("Bokeh bulbs", "#FFC27A", 40.0)
for i in range(14):
    a = random.uniform(-2.2, 2.2)
    me_ = bpy.data.meshes.new("bulb")
    bmb = bmesh.new()
    bmesh.ops.create_uvsphere(bmb, u_segments=16, v_segments=8, radius=0.025)
    bmb.to_mesh(me_)
    bmb.free()
    o = bpy.data.objects.new(f"Bulb {i}", me_)
    o.location = (a, random.uniform(1.8, 2.4), random.uniform(1.1, 1.7))
    finish(o, B, bokeh)

# pint glass with beer, coaster
glass = new_mat("Pint glass")
setp(bsdf_of(glass), color="#FFFFFF", rough=0.02, trans=1.0, ior=1.5)
beer = new_mat("Beer")
setp(bsdf_of(beer), color="#D8901E", rough=0.05, trans=0.95, ior=1.34)
foam = mat_basic("Foam", "#FFF6E2", rough=0.9)
gx, gy = 0.44, 0.1
cyl("Coaster", 0.05, 0.004, (gx, gy, 0.002), c=B, mat=mat_basic("Coaster", "#E9DCC6", rough=0.9))
cyl("Pint", 0.034, 0.152, (gx, gy, 0.004 + 0.076), c=B, mat=glass, r2=0.043)
cyl("Beer", 0.032, 0.125, (gx, gy, 0.009 + 0.0625), c=B, mat=beer, r2=0.039)
cyl("Head", 0.0392, 0.014, (gx, gy, 0.009 + 0.125 + 0.007), c=B, mat=foam, r2=0.0405)

# printed stickers lying on the counter (on liner)
for name, m, x, y, s, r in [("Loose sticker 1", "st2", 0.26, -0.33, 0.07, 18),
                            ("Loose sticker 2", "st3", 0.36, -0.25, 0.065, -24),
                            ("Loose sticker 3", "st5", -0.3, -0.32, 0.07, 12)]:
    box(name + " liner", (s * 1.12, s * 1.12, 0.0006), (x, y, 0.0003), (0, 0, math.radians(r)), c=B, mat=M["liner"], bevel=0.0002)
    plane(name, s, s, (x, y, 0.0012), (0, 0, math.radians(r)), c=B, mat=M[m])

# ---------------------------------------------------------------- studio set
S_ = C_STUDIO
studio = mat_basic("Studio sweep", "#ECE9F3", rough=0.7)
plane("Studio floor", 8, 8, (0, 0, 0), c=S_, mat=studio)
plane("Studio wall", 8, 4, (0, 2.5, 2), (math.pi / 2, 0, 0), c=S_, mat=studio)

# ---------------------------------------------------------------- lights
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

area("Bar key", (-0.9, -1.0, 1.3), (0, 0, 0.25), 55, 1.0, "#FFD7A8", c=B)
area("Bar rim pink", (0.9, 0.9, 0.9), (0, 0, 0.3), 45, 0.6, "#FF6B9D", c=B)
area("Bar rim blue", (-0.8, 0.8, 0.7), (0, 0, 0.3), 50, 0.6, "#5B7CFF", c=B)
area("Bar top", (0, 0, 2.0), (0, 0, 0), 25, 1.5, "#FFE2C0", c=B)
area("Studio key", (-1.2, -1.4, 1.6), (0, 0, 0.25), 120, 1.6, "#FFFFFF", c=S_)
area("Studio fill", (1.4, -0.9, 0.8), (0, 0, 0.25), 45, 1.4, "#F2EEFF", c=S_)
area("Studio top", (0, 0.4, 2.2), (0, 0, 0.2), 80, 2.0, "#FFFFFF", c=S_)
area("Studio rim", (0.6, 1.4, 1.2), (0, 0, 0.3), 60, 1.0, "#FFE0EE", c=S_)

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

# ---------------------------------------------------------------- cameras + render (crude booth)
CAMS = {
    "booth_hero": (camera("Cam booth hero", (0.68, -0.95, 0.52), (0.0, -0.02, 0.2), 45, 2.4), (1600, 1200), "bar"),
    "booth_inside": (camera("Cam booth inside", (-0.12, 0.95, 0.42), (0.02, 0.0, 0.1), 40), (1600, 1200), "inside"),
    "booth_front": (camera("Cam booth front", (0.0, -2.0, 0.23), (0.0, 0.0, 0.23), ortho=0.62), (1300, 1200), "studio"),
    "booth_side": (camera("Cam booth side", (2.0, 0.0, 0.23), (0.0, 0.0, 0.23), ortho=0.62), (1300, 1200), "studio"),
}
door_closed = DOOR_HINGE.rotation_euler.copy()

def set_mode(mode):
    bar = mode == "bar"
    C_BAR.hide_render = not bar
    C_STUDIO.hide_render = bar
    C_INT.hide_render = True
    scene.render.film_transparent = mode == "studio"
    for name in ("Studio floor", "Studio wall"):
        bpy.data.objects[name].hide_render = mode == "studio"
    DOOR_HINGE.rotation_euler = (0, 0, math.radians(105)) if mode == "inside" else door_closed
    bpy.data.objects["Paper cassette"].location.y = (py + PD_ / 2 + 0.07)
    if bar:
        bg.inputs["Color"].default_value = hex_rgba("#120C10")
        bg.inputs["Strength"].default_value = 0.4
    else:
        bg.inputs["Color"].default_value = hex_rgba("#EEEAF6")
        bg.inputs["Strength"].default_value = 0.7

def dims_points():
    pts = {}
    for k, p in {"top": (0, 0, ZD + HOOD_H + T), "bottom": (0, 0, 0), "deck": (0, YF0, ZD),
                 "front": (0, YF0, 0), "back": (0, YB0, 0), "left": (-BW / 2, 0, 0), "right": (BW / 2, 0, 0)}.items():
        v = world_to_camera_view(scene, scene.camera, Vector(p))
        pts[k] = [v.x * scene.render.resolution_x, (1 - v.y) * scene.render.resolution_y]
    return pts

INSIDE_CALLOUTS = [
    ("PixCut S1 printer", (-0.06, 0.06, 0.04), "Liene PixCut S1: prints + kiss-cuts"),
    ("Paper cassette", (0, 0.04, 0.0), "Paper cassette (36 sheets)"),
    ("Power strip", (0.08, 0, 0.0), "Power strip: printer + laptop"),
    ("Rear door", (0.05, 0, 0.03), "Hinged rear door for refills"),
    ("Yoga base (keyboard down)", (0.1, 0.05, 0.0), "Yoga base, keyboard down"),
    ("Power cord", (0, -0.15, 0), "One cord to the wall"),
    ("Laptop charger cable", (0, 0, 0), "Laptop charger through the deck"),
]
meta = {}
for view in VIEWS:
    cam, (rx, ry), mode = CAMS[view]
    scene.camera = cam
    scene.render.resolution_x = int(rx * RES)
    scene.render.resolution_y = int(ry * RES)
    set_mode(mode)
    bpy.context.view_layer.update()
    meta[view] = {"size": [scene.render.resolution_x, scene.render.resolution_y]}
    if view == "booth_inside":
        meta[view]["callouts"] = []
        for n, off, lab in INSIDE_CALLOUTS:
            o = bpy.data.objects[n]
            v = world_to_camera_view(scene, cam, o.matrix_world @ Vector((0, 0, 0)) + Vector(off))
            meta[view]["callouts"].append([lab, v.x * scene.render.resolution_x, (1 - v.y) * scene.render.resolution_y])
    if mode == "studio":
        meta[view]["dims"] = dims_points()
    scene.render.filepath = os.path.join(OUT, f"{view}.png")
    print(f"--- rendering {view}", flush=True)
    bpy.ops.render.render(write_still=True)
json.dump(meta, open(os.path.join(OUT, "meta.json"), "w"), indent=1)
set_mode("bar")
scene.camera = CAMS["booth_hero"][0]
try:
    bpy.ops.file.pack_all()
except Exception as e:
    print("pack failed", e)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "mesticker_booth_v0.blend"))
print("DONE", flush=True)
