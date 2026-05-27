"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();

  const navItems = [
    { name: "Products", path: "/" },
    { name: "Activity", path: "/history" },
    { name: "Demo", path: "/demo" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full h-[48px] border-b border-[var(--border-default)] bg-[var(--bg-base)]/80 backdrop-blur-md select-none">
      <div className="w-full h-full px-4 md:px-6 flex items-center justify-between">
        {/* Left Side: Brand Logo */}
        <div className="flex items-center gap-2 md:gap-3">
          <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
            <span 
              className="text-xs font-extrabold uppercase tracking-[0.25em] text-[var(--accent-primary)]"
              style={{ letterSpacing: "0.25em" }}
            >
              TALLY
            </span>
          </Link>
          <span className="text-[var(--text-tertiary)] font-light">/</span>
          <span className="text-[10px] md:text-xs uppercase tracking-[0.08em] text-[var(--text-secondary)] font-medium">
            INVENTORY OS
          </span>
        </div>

        {/* Right Side: Navigation and Live Indicator */}
        <div className="flex items-center gap-4 md:gap-6">
          <nav className="flex items-center gap-4 md:gap-6">
            {navItems.map((item) => {
              const isActive = pathname === item.path;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`text-xs font-semibold tracking-wide transition-colors ${
                    isActive 
                      ? "text-[var(--accent-primary)] font-bold" 
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Far Right: Glowing Live Indicator */}
          <div className="flex items-center gap-2 pl-3 border-l border-[var(--border-default)] h-4">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--success)] pulse-green shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            <span className="text-[10px] font-bold tracking-widest text-[var(--text-secondary)] uppercase">
              LIVE
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
