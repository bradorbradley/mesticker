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
