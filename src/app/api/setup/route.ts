import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * One-time database setup endpoint.
 * Visit /api/setup?secret=YOUR_AUTH_SECRET to create all tables.
 * Protected by AUTH_SECRET to prevent unauthorized access.
 */
export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");
  if (!secret || secret !== process.env.AUTH_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sql = getDb();
    const results: string[] = [];

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
    results.push("users");

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
    results.push("accounts");

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
    results.push("creations");

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
    results.push("orders");

    await sql`CREATE INDEX IF NOT EXISTS idx_creations_user_id ON creations(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id)`;
    results.push("indexes");

    return NextResponse.json({
      success: true,
      tables: results,
      message: "Database setup complete! You can now delete this endpoint.",
    });
  } catch (error) {
    console.error("Setup error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Setup failed" },
      { status: 500 }
    );
  }
}
