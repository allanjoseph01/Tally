"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, RefreshCw } from "lucide-react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorBoundary({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log the error globally for backend logging integration
    console.error("Global UI Error Boundary triggered:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 max-w-md mx-auto space-y-6">
      
      {/* Red bordered card */}
      <div className="w-full border border-danger/20 bg-danger/5 rounded-lg p-6 text-center space-y-4 shadow-xl">
        <AlertCircle className="w-12 h-12 text-danger mx-auto" />
        <div>
          <h2 className="text-lg font-bold text-zinc-100 uppercase tracking-wide">
            System Error Encountered
          </h2>
          <p className="text-xs text-zinc-400 mt-2 font-mono leading-relaxed break-words bg-zinc-950/60 p-3 rounded border border-zinc-800/60">
            {error.message || "An unexpected system error occurred while processing inventory."}
          </p>
        </div>

        <div className="pt-2">
          <button
            onClick={() => reset()}
            className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-emerald-600 text-zinc-950 font-bold py-3.5 rounded-lg transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Try Again</span>
          </button>
        </div>
      </div>

      {/* Navigation recovery link */}
      <Link
        href="/"
        className="text-xs font-semibold text-zinc-500 hover:text-zinc-300 transition-colors uppercase tracking-widest"
      >
        Back to Products
      </Link>
    </div>
  );
}
