"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X, Check } from "lucide-react";

interface ReserveModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: {
    id: string;
    name: string;
    sku: string;
  };
  warehouse: {
    id: string;
    name: string;
    location: string;
    availableUnits: number;
  };
}

export default function ReserveModal({
  isOpen,
  onClose,
  product,
  warehouse,
}: ReserveModalProps) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [reservationId, setReservationId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  // Enforce max limit of min(10, availableUnits)
  const maxLimit = Math.min(10, warehouse.availableUnits);

  const increment = () => {
    if (quantity < maxLimit) {
      setQuantity((prev) => prev + 1);
    }
  };

  const decrement = () => {
    if (quantity > 1) {
      setQuantity((prev) => prev - 1);
    }
  };

  // 1. Success progress bar fill (0 to 100 over 1.5 seconds)
  useEffect(() => {
    if (isSuccess) {
      const interval = setInterval(() => {
        setProgress((p) => {
          if (p >= 100) {
            clearInterval(interval);
            return 100;
          }
          return p + 8;
        });
      }, 100);
      return () => clearInterval(interval);
    }
  }, [isSuccess]);

  // 2. Redirect timer (1.5 seconds)
  useEffect(() => {
    if (isSuccess && reservationId) {
      const timer = setTimeout(() => {
        router.push(`/reservation/${reservationId}`);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isSuccess, reservationId, router]);

  if (!isOpen) return null;

  const handleReserve = async () => {
    setLoading(true);
    setErrorMsg(null);
    setErrorCode(null);

    const idempotencyKey = crypto.randomUUID();

    try {
      const response = await fetch("/api/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "idempotency-key": idempotencyKey,
        },
        body: JSON.stringify({
          productId: product.id,
          warehouseId: warehouse.id,
          quantity,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          setErrorMsg("Someone just grabbed the last unit. Try another warehouse.");
          setErrorCode("INSUFFICIENT_STOCK");
        } else {
          setErrorMsg(data.error || "An error occurred while reserving stock.");
          setErrorCode(data.code || null);
        }
        setLoading(false);
        return;
      }

      try {
        const existing = localStorage.getItem("tally_reservations");
        const reservations = existing ? JSON.parse(existing) : [];
        const filtered = reservations.filter((r: any) => r.id !== data.id);
        filtered.push({
          id: data.id,
          productId: product.id,
          warehouseId: warehouse.id,
          expiresAt: data.expiresAt,
          status: "PENDING",
        });
        localStorage.setItem("tally_reservations", JSON.stringify(filtered));
      } catch (err) {
        console.error("Failed to save reservation to localStorage", err);
      }

      setReservationId(data.id);
      setIsSuccess(true);
    } catch (err: any) {
      setErrorMsg("Failed to connect to the reservation engine. Please try again.");
      setErrorCode("NETWORK_ERROR");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop blur overlay */}
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-[6px] transition-opacity"
        onClick={loading || isSuccess ? undefined : onClose}
      />

      {/* Modal Card container: Sleek rounded card */}
      <div className="relative w-full max-w-md bg-[var(--bg-surface)]/95 border border-[var(--border-default)] p-6 shadow-2xl z-10 rounded-xl backdrop-blur-xl">
        
        {/* Close Button */}
        {!isSuccess && (
          <button
            onClick={onClose}
            disabled={loading}
            className="absolute top-4 right-4 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors bg-transparent border-0 cursor-pointer p-1.5 hover:bg-white/[0.04] rounded-full"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* -------------------------------------------------------------
           SUCCESS STATE VIEW
           ------------------------------------------------------------- */}
        {isSuccess ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            
            {/* Pulsing glow check */}
            <div className="w-12 h-12 rounded-full bg-[var(--success-muted)] border border-[var(--success)] flex items-center justify-center mb-4 text-[var(--success)] shadow-[0_0_15px_rgba(16,185,129,0.2)]">
              <Check className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-[var(--text-primary)] uppercase tracking-wider mb-1.5 font-sans">
              HOLD CONFIRMED
            </h3>
            <p className="text-[10px] font-mono text-[var(--text-secondary)] uppercase tracking-[0.15em] mb-5">
              REDIRECTING TO CHECKOUT...
            </p>

            {/* Custom Monospace Progress Bar */}
            <div className="w-full max-w-[240px] bg-white/[0.04] h-1.5 rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-[var(--success)] transition-all duration-100 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>

            <span className="text-[9px] font-mono text-[var(--text-tertiary)] uppercase tracking-wider">
              Securing row locks...
            </span>
          </div>
        ) : (
          /* -------------------------------------------------------------
             RESERVATION INPUT VIEW
             ------------------------------------------------------------- */
          <>
            {/* Header */}
            <div>
              <span className="text-[10px] uppercase font-bold text-[var(--accent-primary)] tracking-[0.15em] font-sans">
                SECURE RESERVATION
              </span>
              
              <h2 className="text-base font-bold text-[var(--text-primary)] uppercase tracking-wide leading-tight mt-1.5">
                {product.name}
              </h2>
              <span className="text-[10px] font-mono text-[var(--accent-primary)] bg-[var(--accent-muted)] px-1.5 py-0.5 mt-2 inline-block rounded select-all uppercase">
                SKU: {product.sku}
              </span>
            </div>

            {/* Manifest style shipping labels block */}
            <div className="p-4 border border-[var(--border-default)] bg-[var(--bg-elevated)] text-[11px] leading-relaxed my-5 space-y-2.5 rounded-lg select-none">
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)] font-bold uppercase tracking-wider">WAREHOUSE</span>
                <span className="text-[var(--text-primary)] font-semibold uppercase">{warehouse.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)] font-bold uppercase tracking-wider">LOCATION</span>
                <span className="text-[var(--text-primary)] truncate max-w-[180px] uppercase font-semibold text-right">
                  {warehouse.location}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)] font-bold uppercase tracking-wider">AVAILABILITY</span>
                <span className="text-[var(--text-primary)] font-bold font-mono text-xs">{warehouse.availableUnits} UNITS</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)] font-bold uppercase tracking-wider">HOLD WINDOW</span>
                <span className="text-[var(--accent-primary)] font-bold font-mono text-xs">10:00 MINS</span>
              </div>
            </div>

            {/* Premium Qty Selector */}
            <div className="flex items-center gap-4 my-6">
              <span className="text-xs font-bold text-[var(--text-secondary)] tracking-wider uppercase">QTY</span>
              <div className="flex items-center border border-[var(--border-default)] bg-[var(--bg-base)] rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={decrement}
                  disabled={quantity <= 1 || loading}
                  className="w-10 h-10 flex items-center justify-center font-bold text-lg border-r border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.02] disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer bg-transparent"
                >
                  -
                </button>
                <span className="w-12 text-center text-sm font-bold font-mono text-[var(--text-primary)] select-none">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={increment}
                  disabled={quantity >= maxLimit || loading}
                  className="w-10 h-10 flex items-center justify-center font-bold text-lg border-l border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.02] disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer bg-transparent"
                >
                  +
                </button>
              </div>
              <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider font-semibold">
                (MAX: {maxLimit} UNITS)
              </span>
            </div>

            {/* Action Footer */}
            <div>
              <button
                type="button"
                onClick={handleReserve}
                disabled={loading}
                className="w-full flex items-center justify-center bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-black font-extrabold text-xs tracking-[0.15em] uppercase h-[48px] rounded-lg transition-colors cursor-pointer border-0 shadow-lg shadow-[var(--accent-primary)]/10"
              >
                {loading ? "Securing Lock..." : "Lock Hold →"}
              </button>

              <span className="text-[10px] text-[var(--text-tertiary)] text-center mt-3 uppercase tracking-wider block leading-normal select-none font-semibold">
                Hold locks for 10 minutes. No payment required.
              </span>
            </div>

            {/* Error messaging */}
            {errorMsg && (
              <div className="mt-4 text-xs font-mono font-semibold text-[var(--danger)] text-center uppercase tracking-wide select-none leading-normal">
                {errorCode === "INSUFFICIENT_STOCK" || errorMsg.includes("took the last unit") ? (
                  <span>⚠ INSUFFICIENT STOCK — Another user just took the last unit.</span>
                ) : (
                  <span>⚠ ERROR: {errorMsg}</span>
                )}
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
