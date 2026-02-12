# MeSticker — Product Requirements Document

## Overview

MeSticker is a mobile-optimized web app that lets users take or upload a photo, transform it into a cartoon/artistic style using AI, and order the result as a physical kiss-cut sticker shipped to their door.

The product is designed to be fun, joyful, and dead-simple. The target audience is everyone — but especially children, parents, teachers, and coaches who'd get a kick out of turning themselves (or their kids/students) into a cartoon and holding a real sticker of it.

---

## Core User Flow

The entire app lives on a single page. The user moves through 3 steps, tracked by a progress indicator at the top:

```
[ 1. Capture ] → [ 2. Style ] → [ 3. Order ]
```

### Step 1: Capture

- The screen opens with a **live camera viewfinder** (rear-facing by default, toggle to selfie).
- A large **shutter button** at the bottom center to take a photo.
- A **gallery thumbnail** at the bottom-left to upload an existing photo from the camera roll (mimicking the native iOS camera app UX).
- After capture/upload, the image is shown as a preview with a **"Use This Photo"** confirmation button and a **"Retake"** option.
- The feel should be **photobooth-like** — playful, centered, full-bleed camera.

### Step 2: Style

- A **horizontal carousel** of style preset cards, swipeable left/right (Tinder-style browsing, not yes/no — just browsing).
- Each card shows:
  - A preview image of that style applied to a sample face.
  - The style name (e.g., "Spongebob", "The Simpsons").
- Tapping a card selects it (highlighted border + checkmark).
- Below the carousel: a **"Create My Sticker"** button.
- Pressing "Create" triggers the AI generation pipeline:
  1. Remove background via remove.bg.
  2. Send photo + style prompt to Gemini for image generation.
  3. Show a **loading state** with playful animated messaging (e.g., "Sprinkling cartoon dust...", "Drawing your features...").
- On completion, transition to the **Reveal** — the generated image is hidden behind a scratch-off / slider reveal interaction so the user gets a moment of delight discovering their cartoon self.

### Step 3: Order

- After reveal, user sees their generated sticker image on a clean white background.
- **Sticker quantity selector** with preset options:
  - 3 stickers — $X.XX
  - 5 stickers — $X.XX
  - 10 stickers — $X.XX
- **Shipping address form** (name, street, city, state, zip, country).
- **Pay with Stripe** button (Stripe Checkout or Stripe Elements).
- On successful payment:
  - Order submitted to Printful API.
  - User sees confirmation screen with order summary and estimated delivery.
- User can also:
  - **Save the image** to their device (download button).
  - **Create another** (returns to Step 1).

---

## Style Presets

Each preset is a saved prompt template that gets combined with the user's photo. Initial set:

| Style | Prompt Description |
|-------|-------------------|
| Spongebob | Stephen Hillenburg's SpongeBob SquarePants animation style, nautical underwater color palette |
| Family Guy | Seth MacFarlane's Family Guy animation style, bold outlines, exaggerated features |
| The Simpsons | Matt Groening's Simpsons style, yellow skin, overbite, bulging eyes |
| Rick and Morty | Dan Harmon/Justin Roiland style, wobbly lines, sci-fi color palette |
| Hey Arnold | 90s Nickelodeon style, football-shaped head proportions, Craig Bartlett's aesthetic |
| Renaissance Painting | Classical oil painting style, dramatic lighting, rich warm tones, museum-worthy portrait |
| Anime | Japanese anime style, large expressive eyes, clean linework, vibrant colors |
| Custom (v2) | User types their own style prompt (future feature) |

Each preset has a reference preview image stored in `/public/presets/`.

---

## Technical Architecture

### Stack

| Layer | Technology |
|-------|-----------|
| Framework | **Next.js 15** (App Router) |
| Language | **TypeScript** |
| UI Components | **shadcn/ui** + **Radix UI** primitives |
| Icons | **Lucide React** |
| Styling | **Tailwind CSS v4** |
| Animations | **Framer Motion** |
| Image Generation | **Google Gemini API** (gemini-2.5-flash-preview-image-generation or latest equivalent) |
| Background Removal | **remove.bg API** |
| Sticker Fulfillment | **Printful API** (kiss-cut stickers, on-demand) |
| Payments | **Stripe** (Checkout or Payment Intents) |
| Hosting | **Vercel** |
| Image Storage | **Vercel Blob** or **Cloudflare R2** (for storing generated images to pass URLs to Printful) |

### API Routes

All server-side logic lives in Next.js API routes under `/app/api/`:

```
/api/generate        — orchestrates the full pipeline (remove bg → gemini → return image)
/api/order            — creates Printful order + Stripe payment intent
/api/order/confirm    — Stripe webhook to confirm payment and submit Printful order
/api/presets          — returns available style presets (optional, could be static)
```

### Image Generation Pipeline

```
User Photo (JPEG/PNG)
  │
  ▼
[1] remove.bg API
    - Input: base64-encoded image
    - Output: base64-encoded PNG with transparent background
    - Use `removeBackgroundFromImageBase64()` from the `remove.bg` npm package
    - This avoids the file format conversion headaches from v1
  │
  ▼
[2] Gemini API (gemini-2.5-flash-preview-image-generation)
    - Input: transparent PNG (as bytes) + style prompt from preset
    - Output: generated image (PNG)
    - Use Google GenAI SDK: `@google/genai`
    - Send image as `Part.fromBytes()` with the style prompt
    - Extract generated image from response `parts[].inline_data`
  │
  ▼
[3] Store generated image
    - Upload to Vercel Blob / R2 to get a public URL
    - Printful needs a URL to the image file (not base64)
    - Return URL + base64 preview to frontend
```

**Important technical notes:**
- Gemini 2.5 Flash Image is fast (~3-8 seconds) and cheap (~$0.04/image).
- All image data should stay as base64 in memory between pipeline steps — no unnecessary disk I/O or format conversions.
- The remove.bg npm package handles base64 in → base64 out natively, which solves the format conversion pain from v1.
- For Printful, the image MUST be uploaded to a publicly accessible URL (Vercel Blob works well for this).
- Sticker images should be **300 DPI, PNG with transparent background**. Ensure the final generated image meets this spec.

### Order & Payment Flow

```
User selects quantity + enters shipping address
  │
  ▼
[1] Frontend calls /api/order with:
    - image_url (from Vercel Blob)
    - quantity
    - shipping address
  │
  ▼
[2] /api/order does:
    a. Calls Printful /orders/estimate-costs to get item + shipping cost
    b. Creates a Stripe Payment Intent for the total amount
    c. Returns client_secret to frontend
  │
  ▼
[3] Frontend completes Stripe payment using Payment Element
  │
  ▼
[4] Stripe webhook hits /api/order/confirm:
    a. Verifies payment succeeded
    b. Calls Printful POST /orders with confirm: true
    c. Stores order record
  │
  ▼
[5] User sees confirmation with estimated delivery
```

### Printful Integration Details

- **Auth**: OAuth 2.0 Bearer token.
- **Store**: Create a Manual/API store in Printful dashboard.
- **Product**: Use **kiss-cut stickers** — query `GET /products` to find the correct `variant_id` for desired sticker sizes.
- **Order method**: Direct catalog ordering (Method B — no need to pre-create sync products). Pass `variant_id` + `files[].url` + `recipient` in one call.
- **Image requirements**: PNG, transparent background, 300 DPI, RGB color space.
- **Rate limits**: 120 calls/minute.

### Stripe Integration Details

- Use **Stripe Payment Intents** with the **Payment Element** for a clean embedded checkout.
- Price = Printful item cost + Printful shipping cost + our margin.
- Handle webhooks for `payment_intent.succeeded` to trigger Printful order.
- No subscriptions needed — simple one-time payments.

---

## UI/UX Specifications

### Design Principles

- **One page, vertical scroll** — user progresses down the page through steps.
- **Mobile-first** — designed for phones, works on desktop.
- **Playful & joyful** — rounded corners, bright colors, smooth animations, delightful micro-interactions.
- **Simple** — minimal text, big buttons, obvious next actions.
- **Physical feel** — the sticker preview should look like a real sticker (drop shadow, slight rotation, kiss-cut edge visible).

### Component Library

Use **shadcn/ui** components as the foundation:

- `Button` — primary actions ("Use This Photo", "Create My Sticker", "Order Stickers")
- `Card` — style preset cards in the carousel
- `Dialog` / `Sheet` — shipping address form (bottom sheet on mobile)
- `Input` / `Select` — form fields
- `Carousel` — style browsing (shadcn carousel or custom with Framer Motion for swipe physics)
- `Progress` — step indicator at the top
- `Skeleton` — loading states
- `Badge` — labels on style cards

### Animations (Framer Motion)

- **Page transitions** — smooth vertical scroll-snap between steps.
- **Carousel** — spring physics on swipe, scale-down on non-active cards.
- **Shutter button** — press animation (scale down + haptic feedback via `navigator.vibrate`).
- **Loading state** — pulsing/bouncing dots, rotating messages, optional mini-game.
- **Reveal** — the generated image appears via a slider reveal (before/after) or scratch-off effect. Reuse and polish the existing `ImageRevealSlider` component from v1.
- **Sticker preview** — gentle floating/wobble animation on the final sticker image.
- **Confetti** — on successful order placement.

### Color Palette

| Role | Color | Usage |
|------|-------|-------|
| Primary | `#6C63FF` (Purple) | Buttons, active states, progress indicator |
| Secondary | `#FF6B6B` (Coral) | Accents, highlights, badges |
| Background | `#FAFAFA` | Page background |
| Surface | `#FFFFFF` | Cards, sheets |
| Text Primary | `#1A1A2E` | Headings, body |
| Text Secondary | `#6B7280` | Captions, labels |
| Success | `#10B981` | Confirmation, completion |

### Typography

- **Headings**: Inter or system font, bold, tight letter-spacing.
- **Body**: Inter or system font, regular weight.
- Keep font loading minimal — system font stack is perfectly fine.

### Progress Indicator

Fixed at the top of the viewport:

```
●────────○────────○
Capture    Style    Order
```

- Filled circle = completed step.
- Current step highlighted with primary color.
- Clickable to navigate back (but not forward past current step).

---

## Data Model

### Order Record (for our DB — can start with simple JSON/KV store)

```typescript
interface Order {
  id: string;
  createdAt: Date;
  imageUrl: string;           // URL to generated sticker image
  originalImageUrl: string;   // URL to original photo
  stylePreset: string;        // which style was used
  quantity: number;
  shippingAddress: {
    name: string;
    address1: string;
    address2?: string;
    city: string;
    stateCode: string;
    countryCode: string;
    zip: string;
  };
  stripePaymentIntentId: string;
  printfulOrderId?: string;
  status: 'pending_payment' | 'paid' | 'submitted_to_printful' | 'in_production' | 'shipped' | 'delivered';
  totalAmount: number;        // cents
}
```

### Session/Gallery (v1 — localStorage, v2 — user accounts)

```typescript
interface Creation {
  id: string;
  createdAt: Date;
  originalImage: string;      // base64 or URL
  generatedImage: string;     // base64 or URL
  stylePreset: string;
  ordered: boolean;
}
```

For v1, store creations in `localStorage` so users can browse past results. No auth required initially.

---

## Environment Variables

```env
# Image Generation
GOOGLE_GENERATIVE_AI_API_KEY=        # Gemini API key from Google AI Studio

# Background Removal
REMOVEBG_API_KEY=                     # remove.bg API key

# Sticker Fulfillment
PRINTFUL_ACCESS_TOKEN=                # Printful OAuth token
PRINTFUL_STORE_ID=                    # Printful store ID

# Payments
STRIPE_SECRET_KEY=                    # Stripe secret key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=   # Stripe publishable key (client-side)
STRIPE_WEBHOOK_SECRET=                # Stripe webhook signing secret

# Image Storage
BLOB_READ_WRITE_TOKEN=                # Vercel Blob token (if using Vercel Blob)

# App
NEXT_PUBLIC_APP_URL=                  # Base URL (e.g., https://mesticker.com)
```

---

## Project Structure

```
mesticker/
├── src/
│   ├── app/
│   │   ├── layout.tsx                 # Root layout, fonts, metadata
│   │   ├── page.tsx                   # Main single-page app
│   │   ├── globals.css                # Tailwind + custom styles
│   │   └── api/
│   │       ├── generate/route.ts      # Image pipeline (remove bg → gemini)
│   │       ├── order/route.ts         # Create order + Stripe payment intent
│   │       ├── order/confirm/route.ts # Stripe webhook → Printful order
│   │       └── presets/route.ts       # Style presets (optional)
│   ├── components/
│   │   ├── ui/                        # shadcn/ui components
│   │   ├── camera-capture.tsx         # Camera viewfinder + shutter + gallery
│   │   ├── style-carousel.tsx         # Swipeable style preset cards
│   │   ├── image-reveal.tsx           # Before/after reveal slider
│   │   ├── order-form.tsx             # Quantity selector + address + payment
│   │   ├── progress-steps.tsx         # Top progress indicator
│   │   ├── sticker-preview.tsx        # Final sticker mockup display
│   │   └── loading-state.tsx          # Generation loading animation
│   ├── lib/
│   │   ├── gemini.ts                  # Gemini API client
│   │   ├── removebg.ts               # remove.bg API client
│   │   ├── printful.ts               # Printful API client
│   │   ├── stripe.ts                  # Stripe server-side helpers
│   │   ├── storage.ts                 # Image upload to Blob/R2
│   │   └── utils.ts                   # Shared utilities
│   ├── hooks/
│   │   ├── use-camera.ts              # Camera access + capture hook
│   │   └── use-creations.ts           # localStorage gallery hook
│   └── types/
│       └── index.ts                   # Shared TypeScript types
├── public/
│   └── presets/                       # Style preview images
│       ├── spongebob.png
│       ├── simpsons.png
│       ├── familyguy.png
│       ├── rickandmorty.png
│       ├── heyarnold.png
│       ├── renaissance.png
│       └── anime.png
├── .env.local                         # Local environment variables
├── .env.example                       # Template for env vars
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.ts
└── PRD.md                             # This document
```

---

## Implementation Plan

### Phase 1: Foundation (scaffold + camera + styles)

1. Initialize fresh Next.js 15 project with TypeScript, Tailwind, shadcn/ui.
2. Set up project structure (directories, configs, `.env.example`).
3. Install dependencies: `framer-motion`, `lucide-react`, `@google/genai`, `remove.bg`, `stripe`, `@stripe/stripe-js`.
4. Build the **progress indicator** component.
5. Build the **camera capture** component (viewfinder, shutter, gallery upload, preview).
6. Build the **style carousel** component (swipeable cards with preset data).

### Phase 2: Image Generation Pipeline

7. Implement the **remove.bg integration** (`/lib/removebg.ts`) — base64 in, base64 out.
8. Implement the **Gemini integration** (`/lib/gemini.ts`) — send image + prompt, receive generated image.
9. Build the **`/api/generate` route** — orchestrates remove bg → gemini → store image → return result.
10. Build the **loading state** component (animated messages, progress indication).
11. Build/port the **image reveal** component from v1 codebase.
12. Wire up the full flow: capture → select style → generate → reveal.

### Phase 3: Orders & Payment

13. Implement the **Printful integration** (`/lib/printful.ts`) — catalog lookup, cost estimation, order creation.
14. Implement the **Stripe integration** (`/lib/stripe.ts`) — payment intents, webhook verification.
15. Build the **order form** component (quantity selector, address form, Stripe Payment Element).
16. Build the **`/api/order` route** — estimate costs, create payment intent.
17. Build the **`/api/order/confirm` route** — Stripe webhook handler, Printful order submission.
18. Build the **confirmation screen** (order summary, estimated delivery, save image, create another).

### Phase 4: Polish & Ship

19. Add **Framer Motion animations** throughout (page transitions, carousel physics, reveal, confetti).
20. Implement **localStorage gallery** — save past creations, browse history.
21. Mobile optimization pass — touch targets, viewport handling, camera permissions UX.
22. Error handling pass — graceful failures for each API, user-friendly error messages.
23. Performance pass — image compression before upload, lazy loading, preloading.
24. Deploy to Vercel, configure environment variables, test end-to-end.

---

## Open Questions & Future Considerations

### For v1 (address during build)

- **Exact Printful variant IDs** — need to query their catalog API to find the right kiss-cut sticker product/variant IDs and sizes available.
- **Pricing strategy** — what's our margin on top of Printful cost + shipping? Need to determine retail prices for 3/5/10 sticker bundles.
- **Gemini model availability** — confirm which model ID is currently available and best for style transfer. Fall back to Imagen 3 if Gemini Flash image generation has limitations with likeness preservation.
- **Image resolution** — ensure the pipeline outputs 300 DPI images suitable for sticker printing. May need to upscale generated images.

### For v2 (future)

- **User accounts** — auth (email/social login) so users can access creations across devices.
- **Custom style prompts** — let users type their own style description.
- **USDC payments via Base** — crypto payment option using Coinbase/Base infrastructure.
- **Farcaster Mini App** — re-add Farcaster frame/mini-app support for social distribution.
- **Bulk/classroom orders** — special pricing for teachers ordering stickers for a whole class.
- **Sticker sheets** — option to get multiple designs on one sheet.
- **Order tracking page** — check Printful order status.
- **Referral/sharing** — share your cartoon on social media with a link back to MeSticker.

---

## Lessons Learned from v1

These are documented to prevent repeating past mistakes:

1. **Image format conversion was a nightmare.** Solution: use the `remove.bg` npm package which handles base64 natively. Keep everything as base64 between pipeline steps. Only convert to a URL when uploading to Vercel Blob for Printful.

2. **OpenAI image API was unreliable.** Solution: switching to Gemini which is faster, cheaper, and more consistent for image-to-image style transfer.

3. **Scope creep killed momentum.** Solution: this PRD defines a tight v1 scope. No auth, no social features, no crypto payments in v1. Just: photo → style → sticker → ship.

4. **The reveal component was great.** Keep it. Port the `ImageRevealSlider` from v1 and polish it with Framer Motion.
