import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pegasus — Agency Command",
  description: "The operating system for performance marketing agencies",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-zinc-950 text-zinc-100 antialiased">
        {children}
      </body>
    </html>
  );
}
