"""Build the fabrication model (frame tubes + panels + equipment) from spec.py, render frame + exploded views, export OBJ/STL/glTF.
Run: bvenv/bin/python fab3d.py <outdir> [--samples 48]"""
import bpy, bmesh, math, os, sys, json
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from spec import *

OUT = sys.argv[1]
SAMPLES = int(sys.argv[sys.argv.index("--samples") + 1]) if "--samples" in sys.argv else 48
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
MM = 0.001

def srgb(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple((v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4) for v in c) + (1.0,)

_mats = {}
def mat(name, color, rough=0.5, metal=0.0, alpha=1.0, emit=0.0):
    if name in _mats:
        return _mats[name]
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = srgb(color)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    b.inputs["Alpha"].default_value = alpha
    if emit:
        b.inputs["Emission Color"].default_value = srgb(color)
        b.inputs["Emission Strength"].default_value = emit
    m.diffuse_color = srgb(color)
    _mats[name] = m
    return m

colls = {}
def coll(name):
    if name not in colls:
        c = bpy.data.collections.new(name)
        scene.collection.children.link(c)
        colls[name] = c
    return colls[name]

objs = []
def boxmm(name, x, y, z, w, d, h, m, c, group):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector((w * MM, d * MM, h * MM)), verts=bm.verts)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    o.location = ((x + w / 2) * MM, (y + d / 2) * MM, (z + h / 2) * MM)
    o.data.materials.append(m)
    coll(c).objects.link(o)
    o["group"] = group
    objs.append(o)
    return o

FRAME_COL = {"M": "#7C5CFC", "B-end": "#FF6B9D", "B-back": "#FF9F43", "B-front": "#2BB5D6", "B-floor": "#6DBE6A", "B-roof": "#9B8FB8"}
for i, f in enumerate(frame_members()):
    x, y, z = f["start"]
    w = f["length"] if f["axis"] == "x" else TUBE
    d = f["length"] if f["axis"] == "y" else TUBE
    h = f["length"] if f["axis"] == "z" else TUBE
    boxmm(f"{f['module']} {f['label']} {i}", x, y, z, w, d, h, mat("tube " + f["module"], FRAME_COL[f["module"]], 0.4, 0.3), "frame", f["module"])

PL = mat("panel plum", "#4A3A8C", 0.3)
PW = mat("panel white", "#DCD6EA", 0.3)
PB = mat("panel black", "#26232E", 0.4)
FELT = mat("felt", "#CFC4F2", 0.9)
PLY = mat("plywood deck", "#C9A57A", 0.6)
t = TUBE
panel_pos = {   # code: (x, y, z, w, d, h, material, explode vector mm)
    "M1": (0, -ACM, PLINTH, XM, ACM, H - PLINTH, PW, (0, -350, 0)),
    "M2": (-ACM, 0, PLINTH, ACM, D, H - PLINTH, PL, (-350, 0, 0)),
    "M3": (0, D, PLINTH, XM, ACM, H - PLINTH, PL, (0, 350, 0)),
    "M4": (XM, 0, PLINTH, ACM, D, H - PLINTH, PW, (250, 0, 0)),
    "M5": (-5, -10, H, XM + 10, D + 20, ACM, PL, (0, 0, 350)),
    "B1": (XM, D, PLINTH, L - XM, ACM, H - PLINTH, PL, (0, 350, 0)),
    "B2": (L, 0, PLINTH, ACM, D, H - PLINTH, PL, (350, 0, 0)),
    "B3": (PILLAR["x0"], -ACM, PLINTH, L - PILLAR["x0"], ACM, H - PLINTH, PL, (0, -350, 0)),
    "B4": (XM, -ACM, HEADER["z0"], PILLAR["x0"] - XM, ACM, HEADER["z1"] - HEADER["z0"], PL, (0, -350, 0)),
    "B5": (XM, -10, H, L - XM + 10, D + 20, ACM, PL, (0, 0, 350)),
    "B6": (L - t - ACM, ACM, PLINTH + 15, ACM, D - 2 * ACM, H - PLINTH - 30, mat("backdrop", "#FFD3E6", 0.6), (-250, 0, 0)),
    "B7": (XM + ACM, D - t - 9, PLINTH + 15, L - XM - 2 * ACM, 9, H - PLINTH - 30, FELT, (0, -250, 0)),
    "B8": (XM, t, PLINTH + t, L - XM - t, D - 2 * t, 21, PLY, (0, 0, -150)),
    "S1": (SIGN["x0"], SIGN["y0"], SIGN["z0"], SIGN["x1"] - SIGN["x0"], SIGN["y1"] - SIGN["y0"], SIGN["z1"] - SIGN["z0"], mat("sign", "#1B1433", 0.35), (0, 0, 650)),
}
for p in panels():
    if p["code"] in panel_pos:
        x, y, z, w, d, h, m, ex = panel_pos[p["code"]]
        o = boxmm(f"{p['code']} {p['name']}", x, y, z, w, d, h, m, "panels", p["code"])
        o["explode"] = ex
for i, (y0, x0, w, d) in enumerate(((30, 30, L - 60, ACM), (D - 30 - ACM, 30, L - 60, ACM))):
    o = boxmm(f"P1 Plinth skirt long {i}", x0, y0, 0, w, d, PLINTH - 10, PB, "panels", "P1")
    o["explode"] = (0, -200 if i == 0 else 200, 0)
for i, x0 in enumerate((30, L - 30 - ACM)):
    o = boxmm(f"P2 Plinth skirt short {i}", x0, 30, 0, ACM, D - 60, PLINTH - 10, PB, "panels", "P2")
    o["explode"] = (-200 if i == 0 else 200, 0, 0)
EQ = mat("equipment", "#FFE2A8", 0.4)
for e in EQUIP:
    boxmm(e["name"], e["x"], e["y"], e["z"], e["w"], e["d"], e["h"], EQ if "shelf" not in e["name"] else mat("shelf", "#C9CBD6", 0.3, 0.8), "equipment", "equip")
SCR = mat("display", "#1C1C24", 0.2)
boxmm('43" attract display', ATTRACT["cx"] - ATTRACT["bezel"][0] / 2, 0, ATTRACT["cz"] - ATTRACT["bezel"][1] / 2, ATTRACT["bezel"][0], 60, ATTRACT["bezel"][1], SCR, "equipment", "equip")
boxmm('27" touchscreen', XM - 55, TOUCH["cy"] - TOUCH["bezel"][0] / 2, TOUCH["cz"] - TOUCH["bezel"][1] / 2, 55, TOUCH["bezel"][0], TOUCH["bezel"][1], SCR, "equipment", "equip")
boxmm("Bench", BENCH["x0"], BENCH["y0"], PLINTH + t + 21, BENCH["x1"] - BENCH["x0"], BENCH["y1"] - BENCH["y0"], BENCH["seat_z"] - (PLINTH + t + 21), mat("bench", "#7C5CFC", 0.7), "equipment", "equip")
for x in (60, XM - 60, L - 60):
    for y in (60, D - 60):
        boxmm(f"Caster {x},{y}", x - 40, y - 40, 0, 80, 80, PLINTH, mat("caster", "#2B2B33", 0.5), "equipment", "equip")

# ---------------------------------------------------------------- export (assembled, metres)
for o in objs:
    o.select_set(True)
bpy.context.view_layer.objects.active = objs[0]
try:
    bpy.ops.wm.obj_export(filepath=os.path.join(OUT, "mesticker_booth_fab.obj"), export_selected_objects=True, export_materials=True, forward_axis="NEGATIVE_Z", up_axis="Y")
except Exception as e:
    print("obj export failed", e)
for grp in ("frame", "panels"):
    for o in objs:
        o.select_set(o.name in colls[grp].objects)
    try:
        bpy.ops.wm.stl_export(filepath=os.path.join(OUT, f"mesticker_booth_{grp}.stl"), export_selected_objects=True, global_scale=1000.0)
    except Exception as e:
        print("stl export failed", e)
for o in objs:
    o.select_set(True)
try:
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, "mesticker_booth_fab.glb"), use_selection=True)
except Exception as e:
    print("gltf export failed", e)

# ---------------------------------------------------------------- render setup
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = True
scene.render.film_transparent = True
try:
    scene.view_settings.view_transform = "Standard"
except Exception:
    pass
world = bpy.data.worlds.new("W")
scene.world = world
try:
    world.use_nodes = True
except Exception:
    pass
bgn = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
bgn.inputs["Color"].default_value = srgb("#F2F0F7")
bgn.inputs["Strength"].default_value = 1.0
def light(loc, energy, size):
    ld = bpy.data.lights.new("L", "AREA")
    ld.energy, ld.size = energy, size
    o = bpy.data.objects.new("L", ld)
    o.location = loc
    o.rotation_euler = (Vector((0.9, 0.55, 1.0)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    scene.collection.objects.link(o)
light((-2.5, -3.5, 4.5), 900, 4)
light((4.0, -2.0, 3.0), 500, 3)
def cam(loc, target, lens):
    cd = bpy.data.cameras.new("C")
    cd.lens = lens
    o = bpy.data.objects.new("C", cd)
    o.location = loc
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    scene.collection.objects.link(o)
    return o
scene.render.resolution_x, scene.render.resolution_y = 1600, 1200

meta = {}
def render(name, camobj):
    scene.camera = camobj
    bpy.context.view_layer.update()
    scene.render.filepath = os.path.join(OUT, name + ".png")
    print("--- rendering", name, flush=True)
    bpy.ops.render.render(write_still=True)

# 1) frame + equipment only
colls["panels"].hide_render = True
c1 = cam((-2.6, -3.3, 3.0), (0.9, 0.55, 0.98), 46)
render("fab_frame", c1)
# 2) exploded assembly
colls["panels"].hide_render = False
for o in objs:
    if o.name in colls["frame"].objects and o["group"].startswith("B-"):
        o.location.x += 0.7
    ex = o.get("explode")
    if ex:
        o.location += Vector(ex) * MM * 2.2
        if o["group"].startswith("B") or o["group"] in ("P1", "P2", "S1"):
            if o["group"] not in ("P1", "P2", "S1") and not o["group"].startswith("M"):
                o.location.x += 0.7
c2 = cam((-3.9, -5.3, 4.2), (1.25, 0.5, 1.45), 36)
labels = []
for o in objs:
    if o.name in colls["panels"].objects and o["group"] in ("M1", "M2", "M4", "M5", "B1", "B2", "B3", "B4", "B5", "B6", "B8", "S1"):
        labels.append(o)
scene.camera = c2
bpy.context.view_layer.update()
meta["fab_exploded"] = [[o["group"]] + [v * r for v, r in zip(world_to_camera_view(scene, c2, o.matrix_world.translation)[:2], (1600, 1200))] for o in labels]
render("fab_exploded", c2)
json.dump(meta, open(os.path.join(OUT, "fab_meta.json"), "w"))
print("DONE", flush=True)
