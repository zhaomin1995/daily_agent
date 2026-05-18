import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Daily Agent",
  description: "Automation tools dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col md:flex-row">
        {/* Mobile top header — hidden on desktop where sidebar shows the title */}
        <header className="md:hidden sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/90 px-4 py-3">
          <h1 className="text-base font-semibold tracking-tight">Daily Agent</h1>
        </header>

        <Sidebar />

        {/* Main content: bottom padding on mobile to clear the tab bar */}
        <main className="flex-1 overflow-auto pb-16 md:pb-0">{children}</main>
      </body>
    </html>
  );
}
