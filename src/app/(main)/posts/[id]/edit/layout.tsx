import type { Metadata } from "next";

export const metadata: Metadata = { title: "编辑帖子" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
