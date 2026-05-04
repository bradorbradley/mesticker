# Apple Pay domain verification

To enable Apple Pay on `mesticker.fun`:

1. Go to **Stripe Dashboard → Settings → Payment Methods → Apple Pay**.
2. Click **Add new domain** and enter `mesticker.fun`.
3. Stripe will give you a verification file. Download it.
4. Save it to this directory as `apple-developer-merchantid-domain-association` (no extension).
5. Commit + push. Vercel will serve it at `https://mesticker.fun/.well-known/apple-developer-merchantid-domain-association`.
6. Click **Verify** in the Stripe Dashboard.

Once verified, Apple Pay buttons render automatically on Safari (iOS/macOS) anywhere we mount the Express Checkout Element.

The verification file is just a long token — no secrets in it. Safe to commit.
