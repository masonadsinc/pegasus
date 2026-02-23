import type { Metadata, Viewport } from "next";
import { ToastProvider } from "@/components/toast";
import { ScrollToTop } from "@/components/scroll-to-top";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agency Command — Ads.Inc",
  description: "Performance marketing operations platform",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Agency Command" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#f8f8fa",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body><ToastProvider>{children}<ScrollToTop /></ToastProvider></body>
    </html>
  );
}
