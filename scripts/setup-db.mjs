/**
 * Database setup script for MeSticker.
 *
 * Creates all required tables in Neon Postgres.
 * Run with: node scripts/setup-db.mjs
 *
 * Requires DATABASE_URL to be set in .env.local or as an environment variable.
 */

import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local if present
try {
  const envFile = readFileSync(resolve(__dirname, "../.env.local"), "utf-8");
  for (const line of envFile.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
} catch {
  // .env.local not found, rely on env vars
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("Error: DATABASE_URL is not set.");
  console.error("Set it in .env.local or as an environment variable.");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function setup() {
  console.log("Setting up database tables...\n");

  // Users table (for NextAuth)
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT,
      email TEXT UNIQUE NOT NULL,
      email_verified TIMESTAMPTZ,
      image TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  console.log("  ✓ users");

  // Accounts table (for NextAuth OAuth providers)
  await sql`
    CREATE TABLE IF NOT EXISTS accounts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      provider TEXT NOT NULL,
      provider_account_id TEXT NOT NULL,
      refresh_token TEXT,
      access_token TEXT,
      expires_at BIGINT,
      token_type TEXT,
      scope TEXT,
      id_token TEXT,
      session_state TEXT,
      UNIQUE(provider, provider_account_id)
    )
  `;
  console.log("  ✓ accounts");

  // Creations table
  await sql`
    CREATE TABLE IF NOT EXISTS creations (
      id TEXT PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      original_image_url TEXT NOT NULL,
      generated_image_url TEXT NOT NULL,
      style_preset TEXT NOT NULL,
      ordered BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  console.log("  ✓ creations");

  // Orders table
  await sql`
    CREATE TABLE IF NOT EXISTS orders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      creation_id TEXT REFERENCES creations(id),
      stripe_payment_intent_id TEXT UNIQUE,
      printful_order_id TEXT,
      quantity INTEGER NOT NULL,
      amount_cents INTEGER NOT NULL,
      image_url TEXT NOT NULL,
      shipping_name TEXT NOT NULL,
      shipping_address1 TEXT NOT NULL,
      shipping_address2 TEXT,
      shipping_city TEXT NOT NULL,
      shipping_state TEXT NOT NULL,
      shipping_country TEXT NOT NULL DEFAULT 'US',
      shipping_zip TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  console.log("  ✓ orders");

  // Indexes
  await sql`CREATE INDEX IF NOT EXISTS idx_creations_user_id ON creations(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id)`;
  console.log("  ✓ indexes");

  console.log("\nDatabase setup complete!");
}

setup().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
