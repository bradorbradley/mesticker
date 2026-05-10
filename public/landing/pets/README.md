# /pets landing page assets

Replace these three files via GitHub web UI (or git locally) and the page picks them up automatically:

| Filename | What it is | Recommended specs |
| --- | --- | --- |
| `photo.jpg` | Real photo of someone with their pet | 1080×1080 (square), JPG |
| `cartoon.png` | Chibi-style cartoon (transparent PNG) | 1024×1024, transparent PNG |
| `sheet.png` | Sticker sheet preview (6-up composed) | 1750×2480 (portrait), PNG |

## How to swap them in via GitHub web UI

1. Go to https://github.com/bradorbradley/mesticker
2. Navigate to `public/landing/pets/`
3. Click the existing `photo.jpg` → click the pencil icon → ... → wait no, GitHub uses **Add file → Upload files** for replacements:
   - Click **Add file** dropdown → **Upload files**
   - Drag the two real images in (named exactly `photo.jpg` and `cartoon.png`)
   - It'll overwrite the placeholders
   - Add a commit message → **Commit changes**
4. Vercel rebuilds within ~2 minutes
5. `/pets` now shows your real images
