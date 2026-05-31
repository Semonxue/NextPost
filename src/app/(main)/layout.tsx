"use client";

import { SessionProvider } from "next-auth/react";
import { Sidebar } from "@/components/Sidebar";
import { ToastContainer } from "@/components/ui/Toast";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <Sidebar />
      <main className="min-h-screen lg:ml-64 bg-gray-50 dark:bg-gray-900">
        <div className="p-4 lg:p-8 pt-16 lg:pt-8">
          {children}
        </div>
      </main>
      <ToastContainer />
    </SessionProvider>
  );
}