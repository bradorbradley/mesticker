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
VIEWS = arg("--views", "hero,detail,xray,side,front").split(",")
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

# ---------------------------------------------------------------- shell
def build_shell():
    me = bpy.data.meshes.new("Shell")
    bm = bmesh.new()
    L = [bm.verts.new((-W / 2, y, z)) for y, z in PROFILE]
    R = [bm.verts.new((W / 2, y, z)) for y, z in PROFILE]
    bm.faces.new(list(reversed(L)))
    bm.faces.new(R)
    n = len(PROFILE)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((L[i], L[j], R[j], R[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new("Shell", me)
    obj.data.materials.append(M["shell"])
    obj.data.materials.append(M["side"])
    for p in obj.data.polygons:
        if abs(p.normal.x) > 0.9:
            p.material_index = 1
    return finish(obj, C_KIOSK, None, bevel=0.018, segs=6)

shell = build_shell()

# plinth + glow strip
box("Plinth", (W - 0.024, D - 0.024, Z0 - 0.002), (0, 0, (Z0 - 0.002) / 2), mat=M["rubber"], bevel=0.004)
box("Glow strip", (W - 0.03, D - 0.03, 0.004), (0, 0, Z0 * 0.55), mat=M["glow"])

# --- screen face frame (local +Z = outward normal, local +Y = up the face)
face_dir = (P3 - P4).normalized()
face_len = (P3 - P4).length
n_y, n_z = -face_dir.y, face_dir.x  # outward normal in (y, z)
theta = math.atan2(-n_y, n_z)
mid = (P3 + P4) / 2
F_SCREEN = frame("Screen frame", (0, mid.x, mid.y), (theta, 0, 0))

bezel_len = face_len - 0.03
box("Bezel glass", (0.27, bezel_len, 0.006), (0, 0, 0.002), mat=M["glass_black"], bevel=0.008, parent=F_SCREEN)
SCR_W, SCR_H = 0.136, 0.217     # 10.1" 16:10 portrait
SCR_Y = -0.014
plane("Display", SCR_W, SCR_H, (0, SCR_Y, 0.0052), mat=M["screen"], parent=F_SCREEN)
cam_y = SCR_Y + SCR_H / 2 + 0.019
cyl("Camera lens", 0.0065, 0.004, (0, cam_y, 0.0055), mat=M["lens"], parent=F_SCREEN)
torus("Camera ring light", 0.0115, 0.0018, (0, cam_y, 0.0055), mat=M["ring"], parent=F_SCREEN)
for sx in (-1, 1):
    box(f"Selfie light {'L' if sx < 0 else 'R'}", (0.012, 0.19, 0.003),
        (sx * 0.1, SCR_Y, 0.0055), mat=M["lightbar"], bevel=0.0045, parent=F_SCREEN)

# --- ledge frame
ledge_dir = (P4 - P5).normalized()
ln_y, ln_z = -ledge_dir.y, ledge_dir.x
lmid = (P4 + P5) / 2
F_LEDGE = frame("Ledge frame", (0, lmid.x, lmid.y), (math.atan2(-ln_y, ln_z), 0, 0))
ledge_len = (P4 - P5).length
box("Ledge pad", (W - 0.03, ledge_len - 0.02, 0.006), (0, -0.002, 0.001), mat=M["rubber"], bevel=0.003, parent=F_LEDGE)
plane("Tap to pay", 0.075, 0.075, (0.09, 0.0, 0.0045), mat=M["nfc"], parent=F_LEDGE)
plane("Ledge logo", 0.12, 0.026, (-0.075, 0.0, 0.0045), mat=M["logo_w"], parent=F_LEDGE)

# --- front face frame (local +Z = -Y world, local +Y = world up)
F_FRONT = frame("Front frame", (0, YF, 0), (math.pi / 2, 0, 0))
SLOT_Z = 0.17
box("Exit slot", (0.135, 0.011, 0.01), (0, SLOT_Z, -0.004), mat=M["slot"], bevel=0.003, parent=F_FRONT)
box("Slot lip", (0.15, 0.004, 0.022), (0, SLOT_Z - 0.0085, 0.009), mat=M["chrome"], bevel=0.0018, parent=F_FRONT)
plane("Slot label", 0.13, 0.015, (0, SLOT_Z + 0.022, 0.0004), mat=M["slot_label"], parent=F_FRONT)
plane("Front logo", 0.2, 0.043, (0, 0.085, 0.0004), mat=M["logo_g"], parent=F_FRONT)

# sticker emerging from the slot: liner + art, hinged at the slot and drooping
hinge = frame("Sticker hinge", (0, YF + 0.004, SLOT_Z), (math.radians(32), 0, 0))
liner = box("Sticker liner", (0.092, 0.078, 0.0006), (0, -0.039, 0), mat=M["liner"], parent=hinge)
st = plane("Printed sticker", 0.08, 0.08, (0, -0.04, 0.0005), mat=M["st1"], parent=hinge)

# --- side decals (sticker-bomb on the +X gradient side) + logo
F_SIDE = frame("Side frame", (W / 2 + 0.0006, 0, 0), (math.pi / 2, 0, math.pi / 2))
plane("Side logo", 0.2, 0.043, (0.0, 0.07, 0), (0, 0, 0), c=C_DECAL, mat=M["logo_w"], parent=F_SIDE)
for name, m, x, z, s, r in [
    ("Side sticker A", "st2", -0.095, 0.17, 0.085, 8),
    ("Side sticker B", "st3", 0.005, 0.175, 0.07, -10),
    ("Side sticker C", "st5", 0.11, 0.33, 0.08, 6),
    ("Side sticker D", "st6", 0.085, 0.165, 0.062, 14),
    ("Side sticker E", "st1", 0.12, 0.45, 0.07, -8),
]:
    plane(name, s * (0.786 if m == "st2" else 1.0), s, (x, z, 0.0003 * (1 + "ABCDE".index(name[-1]))),
          (0, 0, math.radians(r)), c=C_DECAL, mat=M[m], parent=F_SIDE)
F_SIDE_L = frame("Side frame L", (-W / 2 - 0.0006, 0, 0), (math.pi / 2, 0, -math.pi / 2))
plane("Side logo L", 0.2, 0.043, (0.0, 0.07, 0), c=C_DECAL, mat=M["logo_w"], parent=F_SIDE_L)

# --- back: service door, vents, lock, power + security cable
F_BACK = frame("Back frame", (0, YB, 0), (math.pi / 2, 0, math.pi))
box("Service door seam", (0.3, 0.42, 0.002), (0, 0.255, 0.0), mat=M["rubber"], bevel=0.006, parent=F_BACK)
for i in range(9):
    box(f"Vent {i}", (0.15, 0.006, 0.003), (0, 0.39 + i * 0.012, 0.0015), mat=M["slot"], bevel=0.0025, parent=F_BACK)
cyl("Door lock", 0.008, 0.006, (0.12, 0.27, 0.003), mat=M["chrome"], parent=F_BACK)

# ---------------------------------------------------------------- internals (x-ray only)
I = C_INT
box("Steel base plate", (W - 0.04, D - 0.04, 0.005), (0, 0, Z0 + 0.003), c=I, mat=M["chrome"])
PR = box("Label printer", (0.30, 0.27, 0.185), (0, 0.02, Z0 + 0.006 + 0.0925), c=I, mat=M["printer"], bevel=0.01)
cyl("Sticker roll", 0.06, 0.112, (0, 0.085, Z0 + 0.075), (0, math.pi / 2, 0), c=I, mat=M["roll"])
cyl("Roll core", 0.02, 0.114, (0, 0.085, Z0 + 0.075), (0, math.pi / 2, 0), c=I, mat=M["chrome"])
box("Print head + cutter", (0.13, 0.04, 0.02), (0, -0.118, SLOT_Z), c=I, mat=M["chrome"], bevel=0.003)
box("Paper path", (0.105, 0.2, 0.0012), (0, -0.02, SLOT_Z - 0.004), (math.radians(8), 0, 0), c=I, mat=M["roll"])
box("Mini PC", (0.115, 0.04, 0.115), (0, 0.13, 0.39), c=I, mat=M["pc"], bevel=0.006)
box("Display driver board", (0.12, 0.004, 0.08), (0, 0.095, 0.39), c=I, mat=M["pcb"])
box("Display panel", (0.15, 0.23, 0.007), (0, -0.002, -0.009), c=I, mat=M["pc"], parent=F_SCREEN)
box("Camera module", (0.03, 0.02, 0.012), (0, cam_y, -0.008), c=I, mat=M["pcb"], parent=F_SCREEN)
box("Power supply", (0.14, 0.08, 0.042), (-0.08, 0.1, 0.236), c=I, mat=M["psu"], bevel=0.003)
box("Tap-to-pay reader", (0.085, 0.095, 0.02), (0.09, -0.09, 0.242), (math.atan2(-ln_y, ln_z), 0, 0), c=I, mat=M["reader"], bevel=0.004)
cyl("Exhaust fan", 0.032, 0.012, (0, YB - 0.012, 0.44), (math.pi / 2, 0, 0), c=I, mat=M["fan"])
box("LED controller", (0.05, 0.03, 0.012), (0.12, 0.13, 0.026), c=I, mat=M["pcb"])
# power cable + security cable out the back (visible in all views)
cyl("Power cable", 0.004, 0.5, (0.09, YB + 0.25, 0.006), (math.pi / 2, 0, 0), mat=M["rubber"], verts=16)
cyl("Security cable", 0.0035, 0.5, (-0.11, YB + 0.25, 0.005), (math.pi / 2, 0, 0.15), mat=M["chrome"], verts=16)

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
gx, gy = 0.37, 0.12
cyl("Coaster", 0.05, 0.004, (gx, gy, 0.002), c=B, mat=mat_basic("Coaster", "#E9DCC6", rough=0.9))
cyl("Pint", 0.034, 0.152, (gx, gy, 0.004 + 0.076), c=B, mat=glass, r2=0.043)
cyl("Beer", 0.032, 0.125, (gx, gy, 0.009 + 0.0625), c=B, mat=beer, r2=0.039)
cyl("Head", 0.0392, 0.014, (gx, gy, 0.009 + 0.125 + 0.007), c=B, mat=foam, r2=0.0405)

# printed stickers lying on the counter (on liner)
for name, m, x, y, s, r in [("Loose sticker 1", "st2", 0.2, -0.3, 0.07, 18),
                            ("Loose sticker 2", "st3", 0.29, -0.22, 0.065, -24),
                            ("Loose sticker 3", "st5", -0.26, -0.29, 0.07, 12)]:
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
area("Bar rim pink", (0.9, 0.9, 0.9), (0, 0, 0.3), 90, 0.6, "#FF6B9D", c=B)
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

CAMS = {
    "hero": (camera("Cam hero", (0.66, -0.9, 0.43), (0.0, -0.02, 0.25), 45, 2.2), (1600, 1200), "bar"),
    "detail": (camera("Cam detail", (0.3, -0.5, 0.4), (0.01, -0.14, 0.22), 50, 3.2), (1600, 1200), "bar"),
    "xray": (camera("Cam xray", (-0.72, -0.82, 0.62), (0.0, 0.02, 0.24), 42), (1600, 1200), "xray"),
    "side": (camera("Cam side", (2.0, 0.0, 0.27), (0.0, 0.0, 0.27), ortho=0.82), (1400, 1200), "studio"),
    "front": (camera("Cam front", (0.0, -2.0, 0.27), (0.0, 0.0, 0.27), ortho=0.82), (1400, 1200), "studio"),
}

def set_mode(mode):
    bar = mode == "bar"
    C_BAR.hide_render = not bar
    C_STUDIO.hide_render = bar
    C_INT.hide_render = mode != "xray"
    C_DECAL.hide_render = mode == "xray"
    xr = mode == "xray"
    shell.data.materials[0] = M["xray"] if xr else M["shell"]
    shell.data.materials[1] = M["xray"] if xr else M["side"]
    for name in ("Plinth", "Ledge pad", "Front logo", "Slot label", "Ledge logo", "Service door seam"):
        o = bpy.data.objects[name]
        o.hide_render = xr and name != "Plinth"
    for name in ("Studio floor", "Studio wall"):
        bpy.data.objects[name].hide_render = mode == "studio"
    edge = bpy.data.objects.get("Shell edges")
    if edge:
        edge.hide_render = not xr
    scene.render.film_transparent = mode == "studio"
    studio.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = hex_rgba("#17141F" if xr else "#ECE9F3")
    if xr:
        bg.inputs["Color"].default_value = hex_rgba("#100E18")
        bg.inputs["Strength"].default_value = 0.3
    elif bar:
        bg.inputs["Color"].default_value = hex_rgba("#120C10")
        bg.inputs["Strength"].default_value = 0.4
    else:
        bg.inputs["Color"].default_value = hex_rgba("#EEEAF6")
        bg.inputs["Strength"].default_value = 0.7

# outline copy of the shell for the x-ray render
edges = shell.copy()
edges.data = shell.data.copy()
edges.name = "Shell edges"
edges.modifiers.clear()
edges.data.materials.clear()
edges.data.materials.append(M["xray_line"])
for p in edges.data.polygons:
    p.material_index = 0
C_KIOSK.objects.link(edges)
wf = edges.modifiers.new("Wire", "WIREFRAME")
wf.thickness = 0.0028
wf.use_replace = True
edges.hide_render = True

# ---------------------------------------------------------------- callouts (projected to pixels)
CALLOUTS = {
    "xray": [
        ("Display", (0, 0, 0), '10.1" portrait touchscreen'),
        ("Camera lens", (0, 0, 0), "1080p camera + ring light"),
        ("Selfie light L", (0, 0.05, 0), "Selfie light bars"),
        ("Mini PC", (0, 0, 0.03), "Mini PC (kiosk app)"),
        ("Exhaust fan", (0, 0, 0), "Exhaust fan + vents"),
        ("Power supply", (0, 0, 0), "Power supply"),
        ("Tap-to-pay reader", (0, 0, 0), "Tap-to-pay card reader"),
        ("Label printer", (0.06, 0, 0.06), "Color label printer + cutter"),
        ("Sticker roll", (0, 0, 0), "Die-cut sticker roll"),
        ("Exit slot", (0, 0, 0), "Sticker exit slot"),
        ("Glow strip", (0.17, -0.16, 0), "RGB attract glow"),
        ("Steel base plate", (-0.15, 0.1, 0), "Steel base + cable lock"),
    ]
}

def project(obj_name, offset):
    o = bpy.data.objects[obj_name]
    p = o.matrix_world @ Vector((0, 0, 0)) + Vector(offset)
    cam = scene.camera
    v = world_to_camera_view(scene, cam, p)
    rx = scene.render.resolution_x
    ry = scene.render.resolution_y
    return [v.x * rx, (1 - v.y) * ry]

def dims_points():
    pts = {}
    for k, p in {
        "top": (0, 0, 0.532), "bottom": (0, 0, 0.0), "front": (0, YF, 0), "back": (0, YB, 0),
        "left": (-W / 2, 0, 0), "right": (W / 2, 0, 0), "ledge": (0, YF, 0.252),
        "front_top": (0, YF, 0.532), "side_top_back": (0, YB, 0.532),
    }.items():
        v = world_to_camera_view(scene, scene.camera, Vector(p))
        pts[k] = [v.x * scene.render.resolution_x, (1 - v.y) * scene.render.resolution_y]
    return pts

meta = {}
bpy.context.view_layer.update()
for view in VIEWS:
    cam, (rx, ry), mode = CAMS[view]
    scene.camera = cam
    scene.render.resolution_x = int(rx * RES)
    scene.render.resolution_y = int(ry * RES)
    scene.render.resolution_percentage = 100
    set_mode(mode)
    bpy.context.view_layer.update()
    entry = {"size": [scene.render.resolution_x, scene.render.resolution_y]}
    if view in CALLOUTS:
        entry["callouts"] = [[label, *project(n, off)] for n, off, label in CALLOUTS[view]]
    if view in ("side", "front"):
        entry["dims"] = dims_points()
    meta[view] = entry
    scene.render.filepath = os.path.join(OUT, f"{view}.png")
    print(f"--- rendering {view} at {scene.render.resolution_x}x{scene.render.resolution_y}", flush=True)
    bpy.ops.render.render(write_still=True)

with open(os.path.join(OUT, "meta.json"), "w") as f:
    json.dump(meta, f, indent=1)

set_mode("bar")
scene.camera = CAMS["hero"][0]
scene.render.resolution_x, scene.render.resolution_y = 1600, 1200
try:
    bpy.ops.file.pack_all()
except Exception as e:
    print("pack failed", e)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "mesticker_kiosk.blend"))

if "--glb" in args:
    # glTF can't carry the procedural gradient: bake to a flat brand colour
    nt = M["side"].node_tree
    b = bsdf_of(M["side"])
    for l in list(b.inputs["Base Color"].links):
        nt.links.remove(l)
    b.inputs["Base Color"].default_value = hex_rgba("#A562F0")
    for o in list(C_BAR.objects) + list(C_STUDIO.objects) + list(C_INT.objects) + [edges]:
        o.hide_set(True)
        o.select_set(False)
    for o in list(C_KIOSK.objects) + list(C_DECAL.objects):
        if o.name != "Shell edges" and not o.name.startswith(("Power cable", "Security cable")):
            o.hide_set(False)
            o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, "mesticker_kiosk.glb"),
                              use_selection=True, export_apply=True, export_lights=False,
                              export_cameras=False)
print("DONE", flush=True)
