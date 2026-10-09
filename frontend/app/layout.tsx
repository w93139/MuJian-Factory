import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import { AuthProvider } from "@/components/AuthProvider";
import "./globals.css";
import "../concepts/styles.css";
import "../concepts/visual-v3.css";
import { ConceptRoot } from "@/concepts/App";
import type { Variant } from "@/concepts/data";

export const metadata: Metadata = {
  title: "幕间",
  description: "AI视频生成工具",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className="antialiased"
      >
        {process.env.NEXT_PUBLIC_MUJIAN_CONCEPT ? <ConceptRoot variant={process.env.NEXT_PUBLIC_MUJIAN_CONCEPT as Variant}>{children}</ConceptRoot> : <AuthProvider><AppShell>{children}</AppShell></AuthProvider>}
      </body>
    </html>
  );
}
