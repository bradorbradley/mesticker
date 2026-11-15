# Print station on Windows (Lenovo touchscreen + PixCut S1)

The Mac station (see README.md) uses StixCut, which is a Mac app. This is how to move the station
to a Windows laptop. Everything except the print-software step is plain Node and works as is.

## 1. Set up the laptop (you, ~10 minutes)

1. Install **Git** (git-scm.com), **Node.js 22 LTS** (nodejs.org) and **Claude Code** (desktop app).
2. Turn off sleep while plugged in: Settings → System → Power → Screen and sleep → *Never*.
3. Clone and install (PowerShell):

   ```powershell
   git clone -b feature/booth-chibi-sheets https://github.com/bradorbradley/mesticker.git $HOME\mesticker
   cd $HOME\mesticker
   npm install
   ```

4. Station key. Create `%USERPROFILE%\.mesticker-station\env` (no extension) with:

   ```
   MCP_SECRET=<same value as Vercel's MCP_SECRET>
   ```

   Get the value from Vercel → mesticker-main → Settings → Environment Variables → MCP_SECRET, or
   copy the Mac's `~/.mesticker-station/env` over on a USB stick. Until PR 29 is merged to
   production, also copy `RECOVER_URL` and `VERCEL_SHARE_COOKIE` from the Mac's file (they point the
   station at the preview deployment). Don't paste any of these into a chat.

5. **Stop the Mac station before the laptop goes live.** Two stations would both recover the same
   Stripe payment and print it twice.

6. Open Claude Code in `%USERPROFILE%\mesticker`, start a session, and paste the prompt below.

## 2. Prompt for the station session

```text
You are the MeSticker print station on this Windows laptop. A PixCut S1 sticker printer (Liene,
4×7" print-and-cut sheets) is connected over USB. Your job: the moment a guest pays at the booth,
their sticker sheet starts printing and cutting here, with no human chasing it. Make this
production ready and fast, then run it.

How the product works (read these files first):
- The booth (src/components/booth/booth-app.tsx) makes a chibi sticker from the guest's photo plus
  pose/expression variants, the guest picks 1–3 sheets and pays with Stripe Checkout, often on
  their own phone. Before payment the booth already sends the order to the print queue
  (/api/booth/kit → Neon table booth_queue); the queue re-checks Stripe and only releases paid
  orders (src/lib/booth-queue.ts, src/lib/booth-payment.ts, src/app/api/booth/queue/route.ts).
- hardware/station/README.md is the Mac playbook. hardware/station/autopilot.mjs is the loop: every
  5s it claims the next paid order (station.mjs next), or rebuilds a paid Stripe checkout that never
  reached the queue (recover.mjs, via /api/booth/recover), then cleans → heals missing stickers
  (heal.mjs) → builds the sheet layout → prints READY {id, sheets} and exits. It remembers handled
  checkouts in ~/MeSticker Orders/.handled so nothing prints twice.
- Each order lands in %USERPROFILE%\MeSticker Orders\<id>\ : stickers\*.png (transparent, already
  with a white die-cut border), sheet-N-guide.png (the sheet as the guest saw it), and order.json
  with every placement in inches on the 3.9×6.7" printable area.
- Config is %USERPROFILE%\.mesticker-station\env. Never print, echo or commit its values.

Do this, in order, and tell me in one line each time a step is done:

1. Check the setup: node -v (22+), npm install done, sharp loads, the env file exists (check the key
   names only), and `node hardware/station/station.mjs list` reaches the queue.
2. Find the fastest reliable way to print AND contour-cut a sheet on this PC. StixCut (what the
   Mac uses) is Mac-only. Look at what is installed and what Liene offers for Windows for the
   PixCut S1, check the printer shows up and is ready, and pick the path that can be driven without
   a person: a command line or file the software opens, a print-ready file plus cut path it
   accepts, or UI automation (computer use, or PowerShell UI Automation if computer use is not
   available). Show me what you found and what you picked before buying or installing anything.
3. Port the last step of autopilot.mjs for Windows: produce whatever that software needs from
   order.json (exact positions and sizes, 12 stickers per sheet, kiss cut just outside each white
   border, ≥2.5 mm between cut lines, nothing off the printable area) and open/send it. Keep the
   Mac path working. Then do one real test sheet with an order I give you (or a free-mode order via
   --include-unverified) and check the print and the cuts line up.
4. Make it hands-off: the station loop prints without waiting for me (QC against
   sheet-N-guide.png is automatic: right sticker count, hero is the main sticker, no blank or
   broken images; if QC fails, mark the order failed with the reason and alert me instead of
   printing). Marks the order done (station.mjs done <id>) after the job is sent, handles a
   multi-sheet order sheet by sheet, and goes straight back to waiting. Run it so it survives
   crashes and reboots (Task Scheduler at log-on or pm2), with a log file, and keep the laptop
   awake.
5. Speed: measure from Stripe payment to the printer starting, for an order that came through the
   queue and one recovered from Stripe. Target under 60s for the queue path. Show me the numbers
   and cut anything slow.
6. Failure handling: the OpenAI account can run out of credits (429 "no credits remaining"). Then
   new guests can't make stickers and heal.mjs can't fill missing ones; the station prints with the
   stickers it has. Surface that loudly to me instead of failing quietly. Same for printer offline,
   out of paper, or the queue unreachable.
7. Commit the work to the feature/booth-chibi-sheets branch with clear messages and push it. Don't
   merge PR 29 (github.com/bradorbradley/mesticker/pull/29) or deploy to production without
   asking me first.

Rules: real guests pay real money. Never print an unpaid order, never print one twice, never skip a
paid one. Ask before anything that spends money or changes production. Keep me posted in short
plain lines.
```
