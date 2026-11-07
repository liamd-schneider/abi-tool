import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { connection } from "next/server";
import { AppToaster } from "@/components/toaster";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Abi-Tool", template: "%s · Abi-Tool" },
  description: "Termine, Schichten, Dienste und Abstimmungen für unseren Abi-Jahrgang",
  appleWebApp: { capable: true, title: "Abi-Tool", statusBarStyle: "default" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f9f9fc" },
    { media: "(prefers-color-scheme: dark)", color: "#16161f" },
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Immer pro Anfrage rendern: nur so bekommen alle Skripte den CSP-Nonce aus dem Proxy
  await connection();
  return (
    <html lang="de" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        {children}
        <AppToaster />
      </body>
    </html>
  );
}
