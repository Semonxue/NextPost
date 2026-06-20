// @ts-nocheck
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb, user } from "./db";

// NEXTAUTH_URL 优先读环境变量，未设置时自动从 NEXT_PUBLIC_BASE_URL 推导
// 这样 Cloudflare Workers 部署时只需配置 NEXT_PUBLIC_BASE_URL（同一个值）
if (!process.env.NEXTAUTH_URL && process.env.NEXT_PUBLIC_BASE_URL) {
  process.env.NEXTAUTH_URL = process.env.NEXT_PUBLIC_BASE_URL;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        username: { label: "用户名", type: "text" },
        password: { label: "密码", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;
        const db = await getDb();
        const found = await db.select().from(user).where(eq(user.username, credentials.username as string)).get();
        if (!found) return null;
        const valid = await bcrypt.compare(credentials.password as string, found.password);
        if (!valid) return null;
        return { id: found.id, name: found.username, email: found.email };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user) session.user.id = token.id as string;
      return session;
    },
  },
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
});
