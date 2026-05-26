"use client";

import React from "react";
import { AlertTriangle, X } from "lucide-react";

interface ErrorBannerProps {
  message: string;
  code?: string;
  onDismiss?: () => void;
}

export default function ErrorBanner({ message, code, onDismiss }: ErrorBannerProps) {
  return (
    <div className="w-full animate-slide-in border-l-4 border-danger bg-danger/5 text-zinc-100 p-4 rounded-r-lg flex items-start justify-between gap-3 shadow-md">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-danger shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider">
            Transaction Conflict
          </h4>
          <p className="text-xs text-zinc-300 leading-relaxed">{message}</p>
          {code && (
            <div className="pt-1">
              <span className="text-[9px] font-mono font-bold bg-danger/10 text-danger border border-danger/20 px-2 py-0.5 rounded uppercase tracking-wider">
                Code: {code}
              </span>
            </div>
          )}
        </div>
      </div>

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-zinc-500 hover:text-zinc-300 p-0.5 rounded hover:bg-zinc-800/40 transition-all cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
