import React from "react";
import Link from "next/link";
import { HelpCircle } from "lucide-react";

export default function ReservationNotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 max-w-md mx-auto space-y-6 text-center">
      
      {/* Not found message card */}
      <div className="border border-zinc-800 bg-zinc-900/40 rounded-lg p-8 space-y-4 shadow-xl">
        <HelpCircle className="w-12 h-12 text-zinc-500 mx-auto" />
        <div>
          <h2 className="text-xl font-bold text-zinc-200">Reservation Not Found</h2>
          <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
            This reservation may have expired, been released back to stock, or never existed in the inventory database.
          </p>
        </div>
        
        <div className="pt-4">
          <Link
            href="/"
            className="w-full inline-block bg-primary hover:bg-emerald-600 text-zinc-950 font-bold py-3.5 rounded-lg transition-colors cursor-pointer"
          >
            Go back to Product Listing
          </Link>
        </div>
      </div>

    </div>
  );
}
