"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Loader2, TrendingUp, CheckCircle, XCircle } from "lucide-react";

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
  const [newReservationIds, setNewReservationIds] = useState<Set<string>>(new Set());

  const fetchActivity = async (isInitial = false) => {
    if (isInitial) setLoading(true);
    else setPolling(true);

    try {
      const response = await fetch("/api/reservations");
      if (response.ok) {
        const data = await response.json();
        
        // 1. If not initial, detect new reservations to trigger flash animation
        if (!isInitial && reservations.length > 0) {
          const existingIds = new Set(reservations.map((r) => r.id));
          const newlyAdded = data
            .filter((r: any) => !existingIds.has(r.id))
            .map((r: any) => r.id);

          if (newlyAdded.length > 0) {
            setNewReservationIds(new Set(newlyAdded));
            // Automatically clear flash highlight after 800ms
            setTimeout(() => {
              setNewReservationIds(new Set());
            }, 800);
          }
        }

        setReservations(data);
      }
    } catch (e) {
      console.error("Failed to poll activity log:", e);
    } finally {
      setLoading(false);
      setPolling(false);
    }
  };

  // 2. Initial load + 10s auto-refresh polling interval
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

  // 3. Status Badges
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[9px] font-bold tracking-widest border border-[var(--pending)] bg-[var(--pending-muted)] text-[var(--pending)] rounded-full uppercase select-none">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--pending)] blink" />
            PENDING
          </span>
        );
      case "CONFIRMED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[9px] font-bold tracking-widest border border-[var(--success)] bg-[var(--success-muted)] text-[var(--success)] rounded-full uppercase select-none">
            ✓ CONFIRMED
          </span>
        );
      case "RELEASED":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[9px] font-bold tracking-widest border border-[var(--border-default)] bg-[var(--bg-base)] text-[var(--text-secondary)] rounded-full uppercase select-none">
            ○ RELEASED
          </span>
        );
    }
  };

  // 4. Counts calculators
  const pendingCount = reservations.filter((r) => r.status === "PENDING").length;
  const confirmedCount = reservations.filter((r) => r.status === "CONFIRMED").length;
  const releasedCount = reservations.filter((r) => r.status === "RELEASED").length;
  const totalCount = reservations.length;

  return (
    <div className="w-full flex flex-col gap-6 font-sans">
      
      {/* -------------------------------------------------------------
         HEADER: Live Transaction Ledger
         ------------------------------------------------------------- */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[var(--border-default)] pb-4 select-none">
        <div className="flex flex-col">
          <h1 className="text-lg font-extrabold tracking-tight uppercase text-[var(--text-primary)]">
            ACTIVITY AUDIT STREAM
          </h1>
          <span className="text-[10px] md:text-xs font-mono text-[var(--text-secondary)] mt-0.5 uppercase tracking-wider">
            REAL-TIME INVENTORY AUDIT STREAM
          </span>
        </div>

        <div className="flex items-center gap-3 self-start">
          {polling && <Loader2 className="w-3.5 h-3.5 text-[var(--accent-primary)] animate-spin" />}
          
          <div className="flex items-center gap-2 px-3 py-1.5 border border-[var(--border-default)] bg-[var(--bg-surface)] rounded-lg">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--success)] blink shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
            <span className="text-[10px] font-bold tracking-widest text-[var(--text-secondary)] uppercase">
              LIVE
            </span>
          </div>

          <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
            AUTO-REFRESH 10S
          </span>
        </div>
      </div>

      {/* -------------------------------------------------------------
         STATS READOUT: 4 Premium Stat Boxes
         ------------------------------------------------------------- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full select-none">
        
        {/* PENDING Stat */}
        <div className="glow-card border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 flex flex-col items-center justify-center text-center rounded-xl">
          <span className="text-[10px] uppercase font-bold text-[var(--text-secondary)] tracking-wider mb-1.5">
            PENDING
          </span>
          <span className="text-3xl font-extrabold text-[var(--accent-primary)] font-mono">
            {pendingCount}
          </span>
        </div>

        {/* CONFIRMED Stat */}
        <div className="glow-card border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 flex flex-col items-center justify-center text-center rounded-xl">
          <span className="text-[10px] uppercase font-bold text-[var(--text-secondary)] tracking-wider mb-1.5">
            CONFIRMED
          </span>
          <span className="text-3xl font-extrabold text-[var(--success)] font-mono">
            {confirmedCount}
          </span>
        </div>

        {/* RELEASED Stat */}
        <div className="glow-card border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 flex flex-col items-center justify-center text-center rounded-xl">
          <span className="text-[10px] uppercase font-bold text-[var(--text-secondary)] tracking-wider mb-1.5">
            RELEASED
          </span>
          <span className="text-3xl font-extrabold text-[var(--text-secondary)] font-mono">
            {releasedCount}
          </span>
        </div>

        {/* TOTAL Stat */}
        <div className="glow-card border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 flex flex-col items-center justify-center text-center rounded-xl">
          <span className="text-[10px] uppercase font-bold text-[var(--text-secondary)] tracking-wider mb-1.5">
            TOTAL
          </span>
          <span className="text-3xl font-extrabold text-[var(--text-primary)] font-mono">
            {totalCount}
          </span>
        </div>

      </div>

      {/* -------------------------------------------------------------
         LEDGER AUDIT STREAM TABLE
         ------------------------------------------------------------- */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 select-none">
          <Loader2 className="w-8 h-8 text-[var(--accent-primary)] animate-spin" />
          <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest">
            LOADING ACTIVITY STREAM...
          </p>
        </div>
      ) : reservations.length === 0 ? (
        <div className="border border-[var(--border-default)] bg-[var(--bg-surface)] p-12 text-center text-[var(--text-secondary)] rounded-xl select-none">
          <p className="text-xs font-semibold uppercase tracking-widest">NO RECENT ACTIVITY RECORDED</p>
          <p className="text-[10px] text-zinc-500 mt-2 uppercase tracking-wide">
            Holds will sync here live as orders are established.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-[var(--border-default)] bg-[var(--bg-surface)] rounded-xl overflow-hidden shadow-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-default)] bg-[var(--bg-elevated)] text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider select-none font-sans">
                <th className="py-3.5 px-5">TIME</th>
                <th className="py-3.5 px-5">HOLD ID</th>
                <th className="py-3.5 px-5">PRODUCT</th>
                <th className="py-3.5 px-5">WAREHOUSE</th>
                <th className="py-3.5 px-5 text-center">QTY</th>
                <th className="py-3.5 px-5">STATUS</th>
                <th className="py-3.5 px-5 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)] text-xs font-sans">
              {reservations.map((res, index) => {
                const isCopied = copiedId === res.id;
                const isNew = newReservationIds.has(res.id);

                // Alternating backgrounds: base vs surface
                const rowBg = index % 2 === 0 ? "bg-[var(--bg-base)]" : "bg-[var(--bg-surface)]";
                
                // Urgency left border states on first cell (td)
                let borderStyle = "border-l-2 border-transparent";
                if (res.status === "PENDING") {
                  borderStyle = "border-l-2 border-[var(--pending)]";
                } else if (res.status === "CONFIRMED") {
                  borderStyle = "border-l-2 border-[var(--success)]";
                }

                return (
                  <tr
                    key={res.id}
                    className={`transition-colors text-[var(--text-primary)] hover:bg-white/[0.01] ${rowBg} ${
                      isNew ? "flash-orange" : ""
                    }`}
                  >
                    {/* 1. TIME */}
                    <td className={`py-4 px-5 ${borderStyle} text-[var(--text-secondary)] select-none`} suppressHydrationWarning>
                      {formatDistanceToNow(new Date(res.createdAt), { addSuffix: true })}
                    </td>

                    {/* 2. HOLD ID (Monospace truncated Copy Tooltip) */}
                    <td className="py-4 px-5">
                      <div className="relative inline-block">
                        <button
                          onClick={() => handleCopy(res.id)}
                          className="font-mono text-xs text-[var(--accent-primary)] hover:text-[var(--accent-hover)] bg-transparent border-0 cursor-pointer p-0 font-bold select-text"
                          title="Copy Reservation ID"
                        >
                          {res.id.slice(0, 8)}
                        </button>
                        
                        {isCopied && (
                          <span className="absolute left-1/2 -translate-x-1/2 -top-7 px-2.5 py-0.5 bg-black border border-[var(--border-default)] text-[9px] font-mono font-bold text-[var(--success)] tracking-wider uppercase whitespace-nowrap z-50 select-none rounded shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                            COPIED
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 3. PRODUCT */}
                    <td className="py-4 px-5 uppercase font-semibold">
                      <div className="flex flex-col">
                        <span className="truncate max-w-[200px] text-[var(--text-primary)]">{res.product.name}</span>
                        <span className="text-[9px] font-mono text-[var(--text-tertiary)] font-normal tracking-wide mt-0.5">
                          SKU: {res.product.sku}
                        </span>
                      </div>
                    </td>

                    {/* 4. WAREHOUSE */}
                    <td className="py-4 px-5 uppercase">
                      <div className="flex flex-col">
                        <span className="truncate max-w-[180px] text-[var(--text-primary)]">{res.warehouse.name}</span>
                        <span className="text-[9px] text-[var(--text-tertiary)] font-normal tracking-wide mt-0.5">
                          {res.warehouse.location}
                        </span>
                      </div>
                    </td>

                    {/* 5. QTY */}
                    <td className="py-4 px-5 text-center font-bold font-mono text-[var(--text-primary)]">
                      {res.quantity}
                    </td>

                    {/* 6. STATUS BADGE */}
                    <td className="py-4 px-5">
                      {getStatusBadge(res.status)}
                    </td>

                    {/* 7. ACTION */}
                    <td className="py-4 px-5 text-right">
                      {res.status === "PENDING" ? (
                        <Link
                          href={`/reservation/${res.id}`}
                          className="text-xs font-bold text-[var(--accent-primary)] hover:text-[var(--accent-hover)] transition-colors select-none"
                        >
                          Checkout →
                        </Link>
                      ) : (
                        <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider select-none font-bold">
                          AUDITED
                        </span>
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
