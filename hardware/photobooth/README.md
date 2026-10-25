# MeSticker Photo Booth (full-size, walk-in)

Walk-in AI sticker booth with a velvet curtain: machine module (screens, camera, Primera LX610 print+cut,
PC, Stripe S710 tap reader) + flat-pack guest bay. 1800 × 1100 × 2000 mm body, 2310 mm with the marquee sign.

## For the fabricator: `fab/`
- `MeSticker_PhotoBooth_Fabrication_Drawings_RevA.pdf`: 10 sheets (F-01 … F-10), 17×11 in
- `dxf/`: one DXF per panel, mm, layers OUTLINE / CUTOUT / TEXT
- `tube_cut_list.csv`, `panel_schedule.csv`
- `3d/`: OBJ/STL/GLB fabrication model + the rendered `.blend`
- `spec.py`: the single dimension spec that every drawing, DXF and 3D file is generated from

Regenerate after editing `spec.py`:
```bash
cd fab
python3 -I drawings.py sheets                    # SVG sheets
python -m pip install ezdxf && python export_dxf.py .
node build_pdf.js sheets img out.pdf              # needs playwright + the images in img/
bpy-python fab3d.py render                        # Blender (bpy) model, renders + OBJ/STL/GLB
```

## Concept renders: `model/`
`photobooth.py` (assembled from `../kiosk/_head.py` + `_pro.py` + `_env.py` + render settings + `_main.py`) builds the full
booth scene in Blender and renders hero / inside / x-ray / elevations.
