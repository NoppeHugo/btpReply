import type { NextAuthConfig } from "next-auth";

// Config sans Prisma — utilisée dans le middleware (Edge runtime).
export const authConfig: NextAuthConfig = {
  // Derrière un reverse proxy / tunnel : faire confiance au Host.
  // Doit être ici (et pas seulement dans auth.ts) car le middleware edge
  // instancie NextAuth(authConfig) directement.
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const isDashboard = request.nextUrl.pathname.startsWith("/dashboard");
      if (isDashboard) return isLoggedIn;
      return true;
    },
  },
  providers: [],
};
