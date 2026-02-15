import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PostgresAdapter } from "./auth-adapter";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PostgresAdapter(),
  session: { strategy: "jwt" },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // On first sign-in, persist the DB user id into the JWT
      if (user?.id) {
        token.sub = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
