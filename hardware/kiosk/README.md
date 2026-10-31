# MeSticker Booth — countertop kiosk concept

A bar-top box: selfie → cartoon style → tap to pay → die-cut sticker out the front in ~60 s.
36 × 34 × 53 cm, ~10 kg, one wall outlet.

## Files

| File | What |
| --- | --- |
| `kiosk.py` | Procedural Blender model. Builds enclosure, internals, bar + studio scenes, cameras, and renders every view. |
| `annotate.py` | Adds x-ray callouts and dimension lines to the renders. |
| `tex/` | Screen UI, stickers, logo and tap-pad textures used by the model. |
| `mesticker_kiosk.blend` | Saved scene (textures packed). Open in Blender 4.2+. |
| `mesticker_kiosk.glb` | glTF export of the kiosk for web / AR viewers. |
| `renders/` | Hero, detail, x-ray, side and front drawings. |

## Rebuild

```bash
python -m venv bvenv && ./bvenv/bin/pip install bpy==5.2.3   # Blender as a Python module (Py 3.13)
./bvenv/bin/python kiosk.py out --views hero,detail,xray,side,front --samples 128 --glb
python annotate.py out renders
```

Quick preview: `--res 0.35 --samples 12` renders all views in ~15 s on 4 CPU cores.

## Key dimensions (metres, in `kiosk.py`)

- Body `W = 0.36`, `D = 0.34`; side profile in `PROFILE` (ledge 0.252, top 0.532)
- Screen face tilted 17° back; 10.1" 16:10 portrait panel (`SCR_W`, `SCR_H`)
- Front ledge tilted 7° toward the guest (spill run-off)
- Exit slot at `SLOT_Z = 0.17`

## Booth v0 (crude weekend build)

Plywood box around a Lenovo Yoga (stand mode) + Liene PixCut S1 print-and-cut sticker printer.
40 × 45 cm footprint, 44 cm tall, ½" plywood. `booth_v0.py` builds it (reuses the helpers and bar scene
from `kiosk.py`); `booth_annotate.py` adds dimensions and callouts. Renders: `renders/booth_*.jpg`.

```bash
./bvenv/bin/python booth_v0.py out --samples 128
python booth_annotate.py out renders
```
