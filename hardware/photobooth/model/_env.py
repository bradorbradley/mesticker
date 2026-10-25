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
