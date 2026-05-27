"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Clock, ShieldAlert, CheckCircle, XCircle } from "lucide-react";

interface ReservationClientProps {
  reservation: {
    id: string;
    stockId: string;
    quantity: number;
    status: string;
    expiresAt: string;
    createdAt: string;
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
    stock: {
      totalUnits: number;
      reservedUnits: number;
    };
  };
}

export default function ReservationClient({ reservation }: ReservationClientProps) {
  const router = useRouter();
  const expiresAt = new Date(reservation.expiresAt);

  // Core interactive states
  const [status, setStatus] = useState(reservation.status);
  const [loadingConfirm, setLoadingConfirm] = useState(false);
  const [loadingCancel, setLoadingCancel] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Calculate remaining seconds
  const getSecondsLeft = () => {
    return Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  };

  const [timeLeft, setTimeLeft] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setTimeLeft(getSecondsLeft());
  }, []);

  // Synchronize reservation status in localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const existing = localStorage.getItem("tally_reservations");
      const list = existing ? JSON.parse(existing) : [];
      const index = list.findIndex((r: any) => r.id === reservation.id);
      if (index > -1) {
        list[index].status = status;
        localStorage.setItem("tally_reservations", JSON.stringify(list));
      } else {
        list.push({
          id: reservation.id,
          productId: reservation.product.id,
          warehouseId: reservation.warehouse.id,
          expiresAt: reservation.expiresAt,
          status: status,
        });
        localStorage.setItem("tally_reservations", JSON.stringify(list));
      }
    } catch (err) {
      console.error("Failed to sync reservation in localStorage", err);
    }
  }, [reservation.id, status, reservation.expiresAt, reservation.product.id, reservation.warehouse.id]);

  // Countdown timer clock loop
  useEffect(() => {
    if (status !== "PENDING") return;

    setTimeLeft(getSecondsLeft());

    const interval = setInterval(() => {
      const seconds = getSecondsLeft();
      setTimeLeft(seconds);

      if (seconds <= 0) {
        clearInterval(interval);
        handleAutoRelease();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [status]);

  // Handle automatic timer expiration
  const handleAutoRelease = async () => {
    try {
      await fetch(`/api/reservations/${reservation.id}/release`, {
        method: "POST",
      });
    } catch (e) {
      console.error("Failed to release reservation hold automatically:", e);
    }
    setStatus("RELEASED");
  };

  // Confirm Purchase action
  const handleConfirm = async () => {
    setLoadingConfirm(true);
    setErrorMsg(null);
    setErrorCode(null);

    const idempotencyKey = crypto.randomUUID();

    try {
      const response = await fetch(`/api/reservations/${reservation.id}/confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "idempotency-key": idempotencyKey,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 410) {
          setErrorMsg("This reservation has expired.");
          setErrorCode("RESERVATION_EXPIRED");
          setStatus("RELEASED");
        } else {
          setErrorMsg(data.error || "Failed to confirm purchase.");
          setErrorCode(data.code || null);
        }
        setLoadingConfirm(false);
        return;
      }

      setStatus("CONFIRMED");
      setSuccessMsg("Purchase confirmed! 🎉");
    } catch (err: any) {
      setErrorMsg("Failed to connect to reservation confirmation engine.");
      setErrorCode("NETWORK_ERROR");
    } finally {
      setLoadingConfirm(false);
    }
  };

  // Cancel/Release action
  const handleCancel = async () => {
    setLoadingCancel(true);
    setErrorMsg(null);
    setErrorCode(null);

    try {
      const response = await fetch(`/api/reservations/${reservation.id}/release`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        setErrorMsg(data.error || "Failed to cancel reservation.");
        setErrorCode(data.code || null);
        setLoadingCancel(false);
        return;
      }

      setStatus("RELEASED");
      setSuccessMsg("Reservation cancelled successfully. Returning to catalog...");
      
      setTimeout(() => {
        router.push("/");
      }, 2000);
    } catch (err: any) {
      setErrorMsg("Failed to connect to cancellation engine.");
      setErrorCode("NETWORK_ERROR");
      setLoadingCancel(false);
    }
  };

  // Format seconds to standard MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Format date helper
  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  };

  // Timer configuration based on urgency states
  const getTimerStyles = (seconds: number) => {
    if (seconds > 180) {
      return {
        color: "text-[var(--text-primary)]",
        barColor: "bg-[var(--text-primary)]",
        glowColor: "rgba(255, 255, 255, 0.05)",
        label: "SECURE INVENTORY LOCK",
      };
    } else if (seconds >= 60) {
      return {
        color: "text-[var(--warning)]",
        barColor: "bg-[var(--warning)]",
        glowColor: "rgba(245, 158, 11, 0.15)",
        label: "EXPIRE ALERT SOON",
      };
    } else {
      return {
        color: "text-[var(--danger)] blink",
        barColor: "bg-[var(--danger)]",
        glowColor: "rgba(239, 68, 68, 0.25)",
        label: "RELEASE PENDING NOW",
      };
    }
  };

  const timerStyles = getTimerStyles(timeLeft);

  // Time elapsed progress bar percentage
  const totalWindow = 600;
  const elapsedSeconds = Math.max(0, totalWindow - timeLeft);
  const progressPercent = Math.min(100, (elapsedSeconds / totalWindow) * 100);

  return (
    <div className="w-full max-w-[900px] mx-auto pt-10 px-4 md:px-6 flex flex-col gap-6 font-sans">
      
      {/* 1. TOP BREADCRUMB */}
      <nav className="text-[10px] md:text-xs font-bold text-[var(--text-secondary)] uppercase tracking-[0.12em] select-none">
        <Link href="/" className="hover:text-[var(--accent-primary)] transition-colors">
          Catalog
        </Link>
        <span className="text-[var(--text-tertiary)] px-1"> / </span>
        <span className="text-[var(--text-secondary)]">Reservation</span>
        <span className="text-[var(--text-tertiary)] px-1"> / </span>
        <span className="text-[var(--text-primary)] font-mono text-[10px] md:text-xs font-bold bg-white/[0.04] px-1.5 py-0.5 rounded">
          {reservation.id.slice(0, 8)}
        </span>
      </nav>

      {/* 2. TWO COLUMN LAYOUT */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 w-full items-start">
        
        {/* LEFT COLUMN: Hold Manifest Card */}
        <section className="glow-card md:col-span-7 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl flex flex-col overflow-hidden">
          
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-default)] bg-[var(--bg-elevated)] select-none">
            <h2 className="text-xs font-extrabold tracking-wider text-[var(--text-primary)] uppercase">
              HOLD MANIFEST
            </h2>
            
            {/* Reactive Status Badge */}
            {status === "PENDING" && (
              <span className="px-2.5 py-0.5 text-[9px] font-bold tracking-widest border border-[var(--pending)] bg-[var(--pending-muted)] text-[var(--pending)] flex items-center gap-1.5 rounded-full select-none uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--pending)] blink" />
                PENDING
              </span>
            )}
            {status === "CONFIRMED" && (
              <span className="px-2.5 py-0.5 text-[9px] font-bold tracking-widest border border-[var(--success)] bg-[var(--success-muted)] text-[var(--success)] flex items-center gap-1 rounded-full select-none uppercase">
                ✓ CONFIRMED
              </span>
            )}
            {status === "RELEASED" && (
              <span className="px-2.5 py-0.5 text-[9px] font-bold tracking-widest border border-[var(--border-default)] bg-[var(--bg-base)] text-[var(--text-secondary)] flex items-center gap-1.5 rounded-full select-none uppercase">
                ○ RELEASED
              </span>
            )}
          </div>

          {/* Body manifest list */}
          <div className="p-5 flex flex-col gap-4 select-text">
            
            <div className="flex flex-col gap-1 pb-3 border-b border-white/[0.04]">
              <span className="text-[10px] uppercase font-bold text-[var(--text-secondary)] tracking-wider">
                HOLD ID
              </span>
              <span className="text-xs font-mono text-[var(--accent-primary)] font-bold select-all bg-white/[0.02] px-2 py-1 rounded inline-block w-fit">
                {reservation.id}
              </span>
            </div>

            <div className="flex flex-col gap-1 pb-3 border-b border-white/[0.04]">
              <span className="text-[10px] uppercase font-bold text-[var(--text-secondary)] tracking-wider">
                PRODUCT DETAILS
              </span>
              <span className="text-sm font-bold text-[var(--text-primary)] uppercase">
                {reservation.product.name}
              </span>
            </div>

            <div className="flex flex-col gap-1 pb-3 border-b border-white/[0.04]">
              <span className="text-[10px] uppercase font-bold text-[var(--text-secondary)] tracking-wider">
                SKU
              </span>
              <span className="text-xs font-mono text-[var(--text-primary)] font-semibold uppercase">
                {reservation.product.sku}
              </span>
            </div>

            <div className="flex flex-col gap-1 pb-3 border-b border-white/[0.04]">
              <span className="text-[10px] uppercase font-bold text-[var(--text-secondary)] tracking-wider">
                WAREHOUSE
              </span>
              <span className="text-xs font-bold text-[var(--text-primary)] uppercase">
                {reservation.warehouse.name}
              </span>
            </div>

            <div className="flex flex-col gap-1 pb-3 border-b border-white/[0.04]">
              <span className="text-[10px] uppercase font-bold text-[var(--text-secondary)] tracking-wider">
                LOCATION
              </span>
              <span className="text-xs font-bold text-[var(--text-primary)] uppercase">
                {reservation.warehouse.location}
              </span>
            </div>

            <div className="flex justify-between items-center pb-3 border-b border-white/[0.04]">
              <span className="text-[10px] uppercase font-bold text-[var(--text-secondary)] tracking-wider">
                QTY HELD
              </span>
              <span className="text-xs font-mono text-[var(--text-primary)] font-bold bg-white/[0.04] px-2 py-0.5 rounded">
                {reservation.quantity} UNITS
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-[10px] uppercase font-bold text-[var(--text-secondary)] tracking-wider">
                RESERVED AT
              </span>
              <span className="text-xs font-mono text-[var(--text-primary)]">
                {formatDateTime(reservation.createdAt)}
              </span>
            </div>

          </div>
        </section>

        {/* RIGHT COLUMN: Action Card */}
        <section className="md:col-span-5 flex flex-col gap-6 w-full shrink-0 select-none">
          
          {/* Active Pending view */}
          {status === "PENDING" && timeLeft > 0 && (
            <div className="glow-card bg-[var(--bg-surface)] border border-[var(--border-default)] p-6 flex flex-col w-full rounded-xl overflow-hidden">
              
              {/* COUNTDOWN TIMER STATEMENT PIECE */}
              <div className="flex flex-col items-center justify-center py-4 w-full">
                
                <span className="text-[10px] uppercase font-bold text-[var(--text-secondary)] tracking-[0.15em] mb-2.5 block text-center">
                  TIME REMAINING
                </span>

                {/* Highly-styled central time readout with shadow glow */}
                <div 
                  className={`text-6xl md:text-7xl font-extrabold font-mono text-center block mb-2 transition-colors duration-500`}
                  style={{ textShadow: `0 0 25px ${timerStyles.glowColor}` }}
                  suppressHydrationWarning
                >
                  {mounted ? formatTime(timeLeft) : "00:00"}
                </div>

                {/* Urgency status */}
                <span className={`text-[10px] font-bold tracking-[0.2em] mb-4 text-center block select-none ${timerStyles.color}`}>
                  {timerStyles.label}
                </span>

                {/* Thin progress bar */}
                <div className="w-full bg-white/[0.04] h-1.5 rounded-full overflow-hidden my-2">
                  <div
                    className={`h-full ${timerStyles.barColor} transition-all duration-1000 rounded-full`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-3 mt-4 w-full">
                
                {/* Confirm Purchase Button */}
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={loadingConfirm || loadingCancel}
                  className="w-full h-12 flex items-center justify-center bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-black font-extrabold text-xs tracking-[0.15em] uppercase rounded-lg transition-colors border-0 cursor-pointer shadow-lg shadow-[var(--accent-primary)]/10 animate-pulse-soft"
                >
                  {loadingConfirm ? "CONFIRMING..." : "Confirm Purchase"}
                </button>

                {/* Cancel Hold Button */}
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={loadingConfirm || loadingCancel}
                  className="w-full h-11 flex items-center justify-center bg-transparent border border-[var(--border-default)] hover:border-[var(--danger)] hover:text-[var(--danger)] disabled:opacity-50 text-[var(--text-secondary)] font-bold text-xs uppercase rounded-lg transition-all cursor-pointer"
                >
                  {loadingCancel ? "CANCELLING..." : "Cancel Reservation"}
                </button>

              </div>

              {/* Error messages display */}
              {errorMsg && (
                <div className="mt-4 text-xs font-mono font-semibold text-[var(--danger)] text-center uppercase tracking-wide leading-normal">
                  ⚠ ERROR: {errorMsg}
                </div>
              )}

            </div>
          )}

          {/* Confirm Success State Display */}
          {status === "CONFIRMED" && (
            <div className="glow-card bg-[var(--bg-surface)] border border-[var(--border-default)] p-6 text-center flex flex-col items-center justify-center w-full rounded-xl py-10">
              
              <div className="w-12 h-12 rounded-full bg-[var(--success-muted)] border border-[var(--success)] flex items-center justify-center mb-4 text-[var(--success)] shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                <CheckCircle className="w-6 h-6" />
              </div>

              <h3 className="text-base font-bold text-[var(--success)] uppercase tracking-wider mb-2 font-sans">
                PURCHASE CONFIRMED
              </h3>
              <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wider mb-6 max-w-[240px] leading-relaxed">
                Hold locks resolved. Stock levels permanently adjusted.
              </p>
              
              <button
                onClick={() => router.push("/")}
                className="w-full h-11 flex items-center justify-center bg-[var(--bg-elevated)] border border-[var(--border-default)] hover:bg-[var(--bg-base)] text-[var(--text-primary)] font-bold text-xs uppercase rounded-lg transition-colors cursor-pointer"
              >
                Return to catalog
              </button>
            </div>
          )}

          {/* Released State Display */}
          {status === "RELEASED" && timeLeft > 0 && (
            <div className="glow-card bg-[var(--bg-surface)] border border-[var(--border-default)] p-6 text-center flex flex-col items-center justify-center w-full rounded-xl py-10">
              
              <div className="w-12 h-12 rounded-full bg-white/[0.02] border border-[var(--border-default)] flex items-center justify-center mb-4 text-[var(--text-secondary)]">
                <XCircle className="w-6 h-6" />
              </div>

              <h3 className="text-base font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
                HOLD RELEASED
              </h3>
              <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-6 max-w-[240px] leading-normal">
                Inventory has been returned to stock. Redirecting to catalog...
              </p>

              <button
                onClick={() => router.push("/")}
                className="w-full h-11 flex items-center justify-center bg-[var(--bg-elevated)] border border-[var(--border-default)] text-[var(--text-tertiary)] font-bold text-xs uppercase rounded-lg cursor-default"
              >
                Redirecting...
              </button>
            </div>
          )}

          {/* Expired State Display (Timer hits 0) */}
          {(status === "RELEASED" || status === "PENDING") && timeLeft <= 0 && (
            <div className="glow-card bg-[var(--bg-surface)] border border-[var(--border-default)] p-6 text-center flex flex-col items-center justify-center w-full rounded-xl py-10">
              
              <div className="w-12 h-12 rounded-full bg-[var(--danger-muted)] border border-[var(--danger)] flex items-center justify-center mb-4 text-[var(--danger)] shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                <ShieldAlert className="w-6 h-6" />
              </div>

              <h3 className="text-base font-bold text-[var(--danger)] uppercase tracking-wider mb-2 blink">
                HOLD EXPIRED
              </h3>
              <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wider mb-6 max-w-[240px] leading-relaxed">
                This reservation has expired and units have been returned to available stock.
              </p>
              
              <button
                onClick={() => router.push("/")}
                className="w-full h-11 flex items-center justify-center bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-black font-bold text-xs uppercase rounded-lg transition-colors cursor-pointer border-0 shadow-lg shadow-[var(--accent-primary)]/10"
              >
                Browse catalog →
              </button>
            </div>
          )}

        </section>

      </div>
    </div>
  );
}
