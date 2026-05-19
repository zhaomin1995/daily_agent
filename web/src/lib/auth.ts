import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";

// Comma-separated list of allowed emails from env, e.g. "alice@ucsd.edu,bob@pitt.edu"
const allowedEmails = (process.env.AUTH_ALLOWED_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

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
  callbacks: {
    // Block sign-in if the email is not on the allowlist
    async signIn({ user }) {
      // Skip check for credentials provider (password-based)
      if (user.email === "admin@localhost") return true;

      // If no allowlist is set, allow everyone
      if (allowedEmails.length === 0) return true;

      const email = (user.email || "").toLowerCase();
      if (allowedEmails.includes(email)) return true;

      // Rejected — redirect to login with error
      return "/login?error=not-allowed";
    },
  },
});
