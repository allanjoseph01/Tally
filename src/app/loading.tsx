import React from "react";

export default function Loading() {
  // Generate a list of 6 skeleton cards to display
  const skeletonCards = Array.from({ length: 6 });

  return (
    <div className="space-y-10">
      
      {/* Header section skeleton */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border pb-6">
        <div className="space-y-2 w-full max-w-sm">
          <div className="h-8 bg-zinc-800 rounded animate-pulse w-2/3" />
          <div className="h-4 bg-zinc-800/60 rounded animate-pulse w-full" />
        </div>
        <div className="h-8 bg-zinc-800/70 rounded animate-pulse w-32 shrink-0 self-start" />
      </div>

      {/* Grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {skeletonCards.map((_, i) => (
          <div
            key={i}
            className="flex flex-col border border-border rounded-lg bg-card p-6 justify-between h-[360px]"
          >
            <div>
              {/* Product Header skeleton */}
              <div className="h-6 bg-zinc-800 rounded animate-pulse w-3/4" />
              <div className="h-3.5 bg-zinc-850 rounded animate-pulse w-1/3 mt-2" />

              {/* Description skeleton */}
              <div className="space-y-1.5 mt-4">
                <div className="h-3.5 bg-zinc-850 rounded animate-pulse w-full" />
                <div className="h-3.5 bg-zinc-850 rounded animate-pulse w-5/6" />
              </div>

              {/* Divider */}
              <div className="w-full h-px bg-zinc-800/80 my-5" />

              {/* Stock Levels Section skeleton */}
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="flex items-center justify-between py-1.5 gap-3">
                    <div className="space-y-1.5 flex-1">
                      <div className="h-3.5 bg-zinc-800 rounded animate-pulse w-1/2" />
                      <div className="h-2.5 bg-zinc-850 rounded animate-pulse w-1/3" />
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Monospace count loader */}
                      <div className="h-4 bg-zinc-850 rounded animate-pulse w-4" />
                      
                      {/* Status Badge loader */}
                      <div className="h-5 bg-zinc-850 rounded animate-pulse w-16" />

                      {/* Button loader */}
                      <div className="h-7 bg-zinc-800 rounded animate-pulse w-14" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Urgency watcher skeleton */}
            <div className="pt-4 mt-6 border-t border-zinc-800/60 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-zinc-850 animate-pulse" />
              <div className="h-3 bg-zinc-850 rounded animate-pulse w-1/2" />
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
