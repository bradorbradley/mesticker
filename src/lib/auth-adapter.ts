import type { Adapter, AdapterUser, AdapterAccount } from "next-auth/adapters";
import { getDb } from "./db";

function toAdapterUser(row: Record<string, unknown>): AdapterUser {
  return {
    id: String(row.id),
    name: (row.name as string) ?? null,
    email: row.email as string,
    emailVerified: row.email_verified
      ? new Date(row.email_verified as string)
      : null,
    image: (row.image as string) ?? null,
  };
}

export function PostgresAdapter(): Adapter {
  return {
    async createUser(user) {
      const sql = getDb();
      const rows = await sql`
        INSERT INTO users (name, email, email_verified, image)
        VALUES (${user.name ?? null}, ${user.email}, ${user.emailVerified?.toISOString() ?? null}, ${user.image ?? null})
        RETURNING id, name, email, email_verified, image
      `;
      return toAdapterUser(rows[0]);
    },

    async getUser(id) {
      const sql = getDb();
      const rows = await sql`SELECT * FROM users WHERE id = ${id}`;
      return rows[0] ? toAdapterUser(rows[0]) : null;
    },

    async getUserByEmail(email) {
      const sql = getDb();
      const rows = await sql`SELECT * FROM users WHERE email = ${email}`;
      return rows[0] ? toAdapterUser(rows[0]) : null;
    },

    async getUserByAccount({ provider, providerAccountId }) {
      const sql = getDb();
      const rows = await sql`
        SELECT u.* FROM users u
        JOIN accounts a ON u.id = a.user_id
        WHERE a.provider = ${provider}
          AND a.provider_account_id = ${providerAccountId}
      `;
      return rows[0] ? toAdapterUser(rows[0]) : null;
    },

    async updateUser(user) {
      const sql = getDb();
      const rows = await sql`
        UPDATE users SET
          name = COALESCE(${user.name ?? null}, name),
          email = COALESCE(${user.email ?? null}, email),
          email_verified = COALESCE(${user.emailVerified?.toISOString() ?? null}, email_verified),
          image = COALESCE(${user.image ?? null}, image)
        WHERE id = ${user.id}
        RETURNING id, name, email, email_verified, image
      `;
      return toAdapterUser(rows[0]);
    },

    async linkAccount(account) {
      const sql = getDb();
      await sql`
        INSERT INTO accounts (
          user_id, type, provider, provider_account_id,
          refresh_token, access_token, expires_at,
          token_type, scope, id_token, session_state
        ) VALUES (
          ${account.userId}, ${account.type}, ${account.provider}, ${account.providerAccountId},
          ${account.refresh_token ?? null}, ${account.access_token ?? null}, ${account.expires_at ?? null},
          ${account.token_type ?? null}, ${account.scope ?? null}, ${account.id_token ?? null}, ${account.session_state ?? null}
        )
      `;
      return account as AdapterAccount;
    },

    async unlinkAccount({ provider, providerAccountId }) {
      const sql = getDb();
      await sql`
        DELETE FROM accounts
        WHERE provider = ${provider}
          AND provider_account_id = ${providerAccountId}
      `;
    },
  };
}
