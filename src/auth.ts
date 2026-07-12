import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { db } from "@/lib/db";
import { authConfig } from "@/auth.config";
import { rateLimit, resetRateLimit } from "@/lib/rate-limit";

// Force brute : 10 tentatives ratées max par email sur 15 minutes.
const LOGIN_MAX_FAILURES = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = (credentials.email as string).toLowerCase();
        const throttleKey = `login:${email}`;
        if (!rateLimit(throttleKey, LOGIN_MAX_FAILURES, LOGIN_WINDOW_MS)) {
          return null;
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email as string },
          select: {
            id: true,
            email: true,
            role: true,
            clientId: true,
            passwordHash: true,
            active: true,
          },
        });

        if (!user?.passwordHash || !user.active) return null;

        const valid = await compare(credentials.password as string, user.passwordHash);
        if (!valid) return null;

        // Login réussi : on ne pénalise pas les connexions légitimes suivantes.
        resetRateLimit(throttleKey);

        return {
          id: user.id,
          email: user.email,
          role: user.role as string,
          clientId: user.clientId,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.role = (user as { role: string }).role;
        token.clientId = (user as { clientId: string }).clientId;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.userId as string;
      session.user.role = token.role as string;
      session.user.clientId = token.clientId as string;
      return session;
    },
  },
});
