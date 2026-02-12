# MeSticker

A mobile-optimized web app to turn photos into cartoon-style kiss-cut stickers.

## Quick Start

```bash
cp .env.example .env.local   # Fill in API keys
npm install
npm run dev                   # http://localhost:3000
```

## Architecture

- **Framework**: Next.js 15 (App Router), TypeScript, Tailwind CSS
- **UI**: shadcn/ui components, Lucide icons, Framer Motion animations
- **Image Pipeline**: remove.bg (background removal) → Gemini API (style transfer) → Vercel Blob (storage)
- **Payments**: Stripe (Payment Intents + Payment Element)
- **Fulfillment**: Printful API (kiss-cut stickers, direct catalog ordering)

## Project Structure

```
src/
  app/
    page.tsx              # Main single-page app with step management
    layout.tsx            # Root layout with metadata
    globals.css           # Tailwind + custom styles
    api/
      generate/route.ts   # Image generation pipeline
      order/route.ts      # Create order + Stripe payment intent
      order/confirm/route.ts  # Stripe webhook → Printful order
      images/[id]/route.ts    # Dev fallback image serving
  components/
    ui/                   # shadcn/ui components
    camera-capture.tsx    # Camera viewfinder + shutter + gallery upload
    style-carousel.tsx    # Swipeable style preset cards
    image-reveal.tsx      # Before/after reveal slider (ported from v1)
    loading-state.tsx     # Generation loading animation
    order-form.tsx        # Quantity + shipping address form
    payment-form.tsx      # Stripe Payment Element
    order-confirmation.tsx # Success screen
    progress-steps.tsx    # 3-step progress indicator
    gallery.tsx           # Past creations gallery
  lib/
    utils.ts              # cn() utility
    presets.ts            # Style preset definitions + prompts
    removebg.ts           # remove.bg API client
    gemini.ts             # Gemini API client
    printful.ts           # Printful API client
    stripe.ts             # Stripe server-side helpers
    storage.ts            # Image upload/storage
  hooks/
    use-creations.ts      # localStorage gallery hook
  types/
    index.ts              # Shared TypeScript types
```

## Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run typecheck    # TypeScript type checking
npm run lint         # ESLint
```

## Key Patterns

- All API keys are read from environment variables (see .env.example)
- Image data flows as base64 strings between pipeline steps to avoid format conversion headaches
- The only time we need a URL (not base64) is for Printful, which needs a public image URL for printing
- shadcn components: install with `npx shadcn@latest add <component-name>`
- Use the `cn()` utility from `@/lib/utils` for conditional class names
- Mobile-first: design for 375px width, max-w-md container
- The app is a single page — state machine with 3 steps: capture → style → order

## Codebase Patterns

(This section gets updated as the codebase evolves)
