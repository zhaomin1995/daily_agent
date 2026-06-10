import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import MobileHeader from "@/components/MobileHeader";
import LoadingBar from "@/components/LoadingBar";
import ScrollToTop from "@/components/ScrollToTop";
import KeyboardShortcuts from "@/components/KeyboardShortcuts";
import { ToastProvider } from "@/components/Toast";
import { PreferencesProvider } from "@/components/PreferencesProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Display font for headings (paired with Geist for body text).
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Daily Agent",
  description: "Automation tools dashboard",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Daily Agent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col md:flex-row">
        <PreferencesProvider>
          <ToastProvider>
            <LoadingBar />
            <KeyboardShortcuts />
            <ScrollToTop />
            <MobileHeader />
            <Sidebar />
            <main className="flex-1 overflow-auto pb-16 md:pb-0">{children}</main>
          </ToastProvider>
        </PreferencesProvider>
      </body>
    </html>
  );
}
