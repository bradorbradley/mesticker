# MeSticker MCP — let Claude art-direct sticker sheets

`https://mesticker.fun/api/mcp` is an MCP server that gives an AI agent (Claude Desktop, Claude Code,
claude.ai) the app's own sticker pipeline:

| Tool | What it does |
|---|---|
| `mesticker_guide` | Printer specs (PixCut S1, 3.9×6.7" printable, 2.5mm cut gap), styles, layouts, workflow, tips |
| `upload_photo` | base64 photo → `photo_url` |
| `create_sticker` | photo + style (or custom style) + optional pose + quality → transparent sticker + preview |
| `suggest_poses` | poses designed for this specific person (the web app's variations engine) |
| `compose_sheet` | stickers + layout (`hero5`, `collage8`, `grid6`, `big1`, or custom slots in inches) → print-ready PNG + preview + spacing check |

Every tool returns a preview image, so the agent can look, judge and redo.

## 1. Turn it on (once)

In Vercel → mesticker-main → Settings → Environment Variables add `MCP_SECRET` = a long random string
(e.g. from a password manager), then redeploy. Without it the endpoint answers 503.

## 2. Connect Claude on the laptop

**Claude Desktop / claude.ai:** Settings → Connectors → *Add custom connector* →
URL `https://mesticker.fun/api/mcp?key=YOUR_MCP_SECRET`.

**Claude Code:**

```bash
claude mcp add --transport http mesticker https://mesticker.fun/api/mcp \
  --header "Authorization: Bearer YOUR_MCP_SECRET"
```

Photos on disk (Claude Code):
`curl -F file=@me.jpg "https://mesticker.fun/api/mcp-upload?key=YOUR_MCP_SECRET"` → `{ "photo_url": … }`.

## 3. Ask for something magical

> Here's a photo of me (photo_url …). Read the MeSticker guide, then design the best possible sheet:
> a high-quality hero sticker in Pixar style, plus 4 smaller ones that each change pose and style
> using poses designed for me. Check every preview, redo anything that doesn't look like me, and
> give me the print-ready sheet.

Print: open the `sheet_url` PNG in the Liene app → 4×7 sticker paper → Print & Cut.

Cost: each `create_sticker` is one AI image (~1¢ low, ~4¢ medium, ~17¢ high). Composing is free.
