"use client";

import React, { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { Check, Clipboard, Clock, Loader2, RefreshCw } from "lucide-react";

interface ReservationActivity {
  id: string;
  stockId: string;
  quantity: number;
  status: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  product: {
    id: string;
    name: string;
    sku: string;
  };
  warehouse: {
    id: string;
    name: string;
    location: string;
  };
}

export default function HistoryClient() {
  const [reservations, setReservations] = useState<ReservationActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchActivity = async (isInitial = false) => {
    if (isInitial) setLoading(true);
    else setPolling(true);

    try {
      const response = await fetch("/api/reservations");
      if (response.ok) {
        const data = await response.json();
        setReservations(data);
      }
    } catch (e) {
      console.error("Failed to poll activity log:", e);
    } finally {
      setLoading(false);
      setPolling(false);
    }
  };

  // Initial load + 10s polling interval
  useEffect(() => {
    fetchActivity(true);

    const interval = setInterval(() => {
      fetchActivity(false);
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, []);

  const handleCopy = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return (
          <span className="inline-flex items-center text-[9px] font-bold text-warning px-2.5 py-0.5 rounded border border-warning/20 bg-warning/5 uppercase tracking-wider">
            Pending Hold
          </span>
        );
      case "CONFIRMED":
        return (
          <span className="inline-flex items-center text-[9px] font-bold text-primary px-2.5 py-0.5 rounded border border-primary/20 bg-primary/5 uppercase tracking-wider">
            Confirmed ✓
          </span>
        );
      case "RELEASED":
      default:
        return (
          <span className="inline-flex items-center text-[9px] font-bold text-zinc-500 px-2.5 py-0.5 rounded border border-zinc-700 bg-zinc-800/10 uppercase tracking-wider">
            Released
          </span>
        );
    }
  };

  return (
    <div className="space-y-8">
      
      {/* Header section with live pulsing dot */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-100">Activity Ledger</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Real-time audit log of database transaction holds.
          </p>
        </div>
        <div className="flex items-center gap-3 self-start">
          {polling && <Loader2 className="w-3.5 h-3.5 text-zinc-500 animate-spin" />}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-primary/20 bg-primary/5">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">Live stream</span>
          </div>
          <button
            onClick={() => fetchActivity(false)}
            disabled={polling || loading}
            className="flex items-center justify-center p-2 rounded-lg border border-border bg-zinc-900/60 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-40 cursor-pointer"
            title="Force refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest">
            Loading activity log...
          </p>
        </div>
      ) : reservations.length === 0 ? (
        <div className="border border-border rounded-lg bg-card p-12 text-center text-zinc-500">
          <Clock className="w-12 h-12 text-zinc-650 mx-auto mb-3" />
          <p className="text-sm font-semibold">No recent activity detected.</p>
          <p className="text-xs text-zinc-600 mt-1">Holds will appear here as soon as orders start.</p>
        </div>
      ) : (
        /* Audit Table */
        <div className="overflow-x-auto border border-border rounded-lg bg-card">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-zinc-900/40 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                <th className="py-4 px-6">Holding ID</th>
                <th className="py-4 px-6">Product details</th>
                <th className="py-4 px-6">Warehouse</th>
                <th className="py-4 px-6 text-center">Qty</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6">Time elapsed</th>
                <th className="py-4 px-6 text-right">Hold timeline</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50 text-xs">
              {reservations.map((res) => {
                const isCopied = copiedId === res.id;

                return (
                  <tr
                    key={res.id}
                    className="hover:bg-zinc-900/20 transition-colors text-zinc-300"
                  >
                    {/* Copy-on-click truncated monospace ID */}
                    <td className="py-4.5 px-6 font-mono">
                      <button
                        onClick={() => handleCopy(res.id)}
                        className="group flex items-center gap-1.5 text-zinc-400 hover:text-zinc-100 transition-colors"
                        title="Copy Reservation ID"
                      >
                        <span className="text-[11px] uppercase tracking-wide">
                          {res.id.substring(0, 8)}...
                        </span>
                        {isCopied ? (
                          <Check className="w-3 h-3 text-primary shrink-0" />
                        ) : (
                          <Clipboard className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                      </button>
                    </td>

                    {/* Product name & SKU */}
                    <td className="py-4.5 px-6">
                      <div className="max-w-[200px]">
                        <p className="font-semibold text-zinc-200 truncate">{res.product.name}</p>
                        <p className="text-[10px] font-mono text-zinc-500 mt-0.5">
                          SKU: {res.product.sku}
                        </p>
                      </div>
                    </td>

                    {/* Warehouse name */}
                    <td className="py-4.5 px-6">
                      <div className="max-w-[180px]">
                        <p className="font-medium text-zinc-300 truncate">{res.warehouse.name}</p>
                        <p className="text-[9px] text-zinc-500 truncate mt-0.5">
                          {res.warehouse.location}
                        </p>
                      </div>
                    </td>

                    {/* Quantity */}
                    <td className="py-4.5 px-6 text-center font-mono font-bold text-zinc-200">
                      {res.quantity}
                    </td>

                    {/* Status Badge */}
                    <td className="py-4.5 px-6">{getStatusBadge(res.status)}</td>

                    {/* Time elapsed relative distance */}
                    <td className="py-4.5 px-6 text-zinc-400">
                      {formatDistanceToNow(new Date(res.createdAt), { addSuffix: true })}
                    </td>

                    {/* Hold Timeline details */}
                    <td className="py-4.5 px-6 text-right font-mono text-[10px] text-zinc-500 space-y-0.5">
                      <div>
                        <span className="text-zinc-600 font-sans uppercase text-[9px] tracking-wide pr-1">Expires:</span>
                        {new Date(res.expiresAt).toLocaleTimeString()}
                      </div>
                      {res.status === "CONFIRMED" && (
                        <div className="text-primary/70">
                          <span className="text-zinc-600 font-sans uppercase text-[9px] tracking-wide pr-1">Sold at:</span>
                          {new Date(res.updatedAt).toLocaleTimeString()}
                        </div>
                      )}
                      {res.status === "RELEASED" && (
                        <div className="text-zinc-600/80">
                          <span className="text-zinc-600 font-sans uppercase text-[9px] tracking-wide pr-1">Reset at:</span>
                          {new Date(res.updatedAt).toLocaleTimeString()}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
