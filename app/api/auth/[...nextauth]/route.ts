import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { supabase } from "@/lib/supabase";

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: "Username",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        const { data } = await supabase
          .from("credentials_users")
          .select("username, password_hash")
          .eq("username", credentials.username.trim())
          .single();

        if (!data) return null;

        const valid = await bcrypt.compare(credentials.password, data.password_hash);
        if (!valid) return null;

        // Use username as the email field so the rest of the app works unchanged
        return { id: data.username, email: data.username, name: data.username };
      },
    }),
  ],
  pages: {
    signIn: "/",
  },
  session: {
    strategy: "jwt",
  },
});

export { handler as GET, handler as POST };
