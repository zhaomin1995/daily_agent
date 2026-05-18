import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";

// Build the providers list based on which env vars are configured
const providers = [];

if (process.env.AUTH_GITHUB_ID) {
  providers.push(GitHub);
}

if (process.env.AUTH_GOOGLE_ID) {
  providers.push(Google);
}

// Fallback: credentials provider for local dev when no OAuth is configured
if (providers.length === 0) {
  providers.push(
    Credentials({
      name: "Local Access",
      credentials: {
        password: { label: "Password", type: "password", placeholder: "Enter password" },
      },
      async authorize(credentials) {
        // Default password is "admin" — change via AUTH_PASSWORD env var
        const expected = process.env.AUTH_PASSWORD || "admin";
        if (credentials?.password === expected) {
          return { id: "1", name: "Admin", email: "admin@localhost" };
        }
        return null;
      },
    })
  );
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers,
  pages: {
    signIn: "/login",
  },
});
