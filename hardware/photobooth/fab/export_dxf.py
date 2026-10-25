"""Panel DXFs (one per panel, mm, outline + cutouts on separate layers) and CSV cut lists."""
import os, sys, csv
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from spec import *
import ezdxf
OUT = sys.argv[1]
os.makedirs(os.path.join(OUT, "dxf"), exist_ok=True)
for p in panels():
    doc = ezdxf.new("R2010", setup=True)
    doc.units = ezdxf.units.MM
    doc.layers.add("OUTLINE", color=7)
    doc.layers.add("CUTOUT", color=1)
    doc.layers.add("TEXT", color=5)
    msp = doc.modelspace()
    msp.add_lwpolyline([(0, 0), (p["w"], 0), (p["w"], p["h"]), (0, p["h"])], close=True, dxfattribs={"layer": "OUTLINE"})
    for kind, cx, cy, cw, ch in p["cutouts"]:
        if kind == "rect":
            x0, y0 = cx - cw / 2, cy - ch / 2
            msp.add_lwpolyline([(x0, y0), (x0 + cw, y0), (x0 + cw, y0 + ch), (x0, y0 + ch)], close=True, dxfattribs={"layer": "CUTOUT"})
        else:
            msp.add_circle((cx, cy), cw / 2, dxfattribs={"layer": "CUTOUT"})
    msp.add_text(f"{p['code']} {p['name']} | {p['mat']} | qty {p['qty']}", height=18, dxfattribs={"layer": "TEXT"}).set_placement((10, -40))
    doc.saveas(os.path.join(OUT, "dxf", f"{p['code']}_{p['name'].split(' (')[0].replace(' ', '_').replace(',', '')}.dxf"))
with open(os.path.join(OUT, "tube_cut_list.csv"), "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["sub_frame", "part", "cut_length_mm", "qty", "tube"])
    for r in cut_list():
        w.writerow([r["module"], r["part"], r["length_mm"], r["qty"], '1.5" sq steel tube, 16 ga'])
with open(os.path.join(OUT, "panel_schedule.csv"), "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["code", "panel", "width_mm", "height_mm", "qty", "material", "cutouts", "note"])
    for p in panels():
        cuts = "; ".join(f"{k} {cw:g}x{ch:g} @ center ({cx:g},{cy:g})" for k, cx, cy, cw, ch in p["cutouts"])
        w.writerow([p["code"], p["name"], p["w"], p["h"], p["qty"], p["mat"], cuts, p["note"]])
print("ok", len(os.listdir(os.path.join(OUT, "dxf"))), "dxf")
