# Development Guide

## Restart Procedure

To cleanly restart the development server:

```bash
pkill -f "next|node" || true
npm run dev
# Verify:
curl -s http://localhost:3000/api/env-check
curl -s http://localhost:3000/api/openai-ok
```

## Testing

Run the comprehensive test suite:

```bash
./test-api-endpoints.sh
```

## Environment Setup

1. Create `.env.local` with your OpenAI API key:
   ```
   OPENAI_API_KEY=sk-proj-your-actual-key-here
   NEXT_PUBLIC_TESTING_MODE=false
   ```

2. Restart the dev server to pick up changes.

## Troubleshooting

- If you get 401 errors, check that your OpenAI API key is valid
- Multiple Next.js processes can conflict - use the restart procedure above
- Check server logs for detailed error messages with request IDs