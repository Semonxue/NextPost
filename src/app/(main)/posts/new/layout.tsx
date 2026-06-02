import type { Metadata } from "next";

export const metadata: Metadata = { title: "新建帖子" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
