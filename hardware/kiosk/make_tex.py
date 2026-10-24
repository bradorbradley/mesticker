import sys
from PIL import Image, ImageFilter, ImageChops, ImageDraw
src = sys.argv[1]; out = sys.argv[2]
im = Image.open(src).convert("RGB")
bg = im.getpixel((2,2))
diff = ImageChops.difference(im, Image.new("RGB", im.size, bg)).convert("L")
mask = diff.point(lambda v: 255 if v > 28 else 0)
# flood from corners to keep interior whites (eyes, shirt) opaque
inv = Image.new("L", im.size, 0)
ff = mask.copy().convert("RGB")
for c in [(0,0),(im.size[0]-1,0),(0,im.size[1]-1),(im.size[0]-1,im.size[1]-1)]:
    ImageDraw.floodfill(ff, c, (128,0,0), thresh=0)
mask = ff.convert("RGB").split()[0].point(lambda v: 0 if v == 128 else 255)
# fill holes: largest-ish blob via close
mask = mask.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5))
border = mask.filter(ImageFilter.MaxFilter(41)).filter(ImageFilter.GaussianBlur(2)).point(lambda v: 255 if v > 128 else 0)
W,H = im.size; pad = 40
canvas = Image.new("RGBA",(W+2*pad,H+2*pad),(0,0,0,0))
white = Image.new("RGBA",(W,H),(255,255,255,255))
canvas.paste(white,(pad,pad),border)
art = im.convert("RGBA"); art.putalpha(mask)
canvas.alpha_composite(art,(pad,pad))
canvas.save(out)
print(canvas.size)
