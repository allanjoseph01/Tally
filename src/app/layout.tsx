import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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

        {/* Sticky blur header navbar */}
        <header className="sticky top-0 z-40 w-full border-b border-border bg-background/85 backdrop-blur-md">
          <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight text-primary">Tally</span>
              <span className="text-sm text-zinc-700 font-medium">/</span>
              <span className="text-[10px] text-zinc-500 font-semibold tracking-widest uppercase">inventory, held.</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-zinc-900/40">
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest">Active Reserve Engine</span>
              </div>
            </div>
          </div>
        </header>

        {/* Generous spacing main container */}
        <main className="flex-1 flex flex-col mx-auto max-w-7xl w-full px-6 py-10 relative z-10">
          {children}
        </main>
      </body>
    </html>
  );
}
