import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { db } from "@/lib/db";
import { authConfig } from "@/auth.config";

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

        const user = await db.user.findUnique({
          where: { email: credentials.email as string },
          select: {
            id: true,
            email: true,
            role: true,
            clientId: true,
            passwordHash: true,
          },
        });

        if (!user?.passwordHash) return null;

        const valid = await compare(credentials.password as string, user.passwordHash);
        if (!valid) return null;

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
