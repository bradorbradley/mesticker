# Dog landing page assets

Drop these three files in this folder. The `/dog-stickers` page picks them up automatically.

| Filename | What it is | Suggested specs |
| --- | --- | --- |
| `photo.jpg` | A real, expressive dog photo | 1080×1080 (square), JPG |
| `cartoon.png` | Chibi-style cartoon of that dog | 1024×1024, transparent PNG |
| `sheet.png` | Composed sticker sheet preview | 1750×2480, transparent PNG |

How to generate `cartoon.png` and `sheet.png`:
1. Visit the live site (with `?unlock=1` to bypass paywall) and upload `photo.jpg`
2. Let the Chibi flow generate
3. Right-click → Save image as → save the cartoon as `cartoon.png` in this folder
4. Tap the "Buy" preview to see the composed sheet, save that as `sheet.png`

The page falls back to placeholder images if these aren't present.
