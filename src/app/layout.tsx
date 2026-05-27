import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Navbar from "../components/Navbar";
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
  title: "Tally | Precision Stock Reservation",
  description: "Concurrency-safe, multi-warehouse stock reservation system built for real-time inventory management.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans relative">
        {/* Subtle noise texture layer for premium depth */}
        <div className="absolute inset-0 bg-noise pointer-events-none opacity-45 z-50" />

        {/* Sticky warehouse terminal navbar */}
        <Navbar />

        {/* Generous spacing main container */}
        <main className="flex-1 flex flex-col mx-auto max-w-7xl w-full px-6 py-10 relative z-10">
          {children}
        </main>
      </body>
    </html>
  );
}
