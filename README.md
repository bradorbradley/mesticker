# MeSticker

A web application that transforms selfies into artistic styles and allows users to order them as physical stickers with crypto payments.

## Features

- **Selfie Upload**: Upload your favorite selfie photo
- **Artistic Transformation**: Choose from various styles like Studio Ghibli, Simpsons, oil painting, etc.
- **Physical Stickers**: Order your transformed image as a physical sticker
- **Crypto Payments**: Pay securely with cryptocurrency

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

## Tech Stack

- **Frontend**: Next.js 15 with TypeScript
- **Styling**: Tailwind CSS
- **Image Processing**: Canvas API / Sharp
- **Payments**: Crypto integration (TBD)
- **AI Processing**: Image transformation APIs (TBD)

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Project Structure

```
src/
├── app/          # Next.js app router pages
├── components/   # Reusable React components
├── lib/          # Utility functions and configurations
├── types/        # TypeScript type definitions
└── styles/       # Additional CSS files
```