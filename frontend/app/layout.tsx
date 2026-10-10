import { Suspense } from "react";
import type { Metadata } from "next";
import LiveShell from "@/live/Shell";
import AppShell from "@/components/AppShell";
import { AuthProvider } from "@/components/AuthProvider";
import "../live/styles.css";
import "./globals.css";
import "../ui/cinematic.css";

export const metadata: Metadata = {
  title: "幕间",
  description: "AI视频生成工具",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        <AuthProvider>
          {process.env.NEXT_PUBLIC_MUJIAN_LEGACY === "1" ? <AppShell>{children}</AppShell> : (
            <Suspense fallback={<p>正在打开幕间</p>}><LiveShell>{children}</LiveShell></Suspense>
          )}
        </AuthProvider>
      </body>
    </html>
  );
}
