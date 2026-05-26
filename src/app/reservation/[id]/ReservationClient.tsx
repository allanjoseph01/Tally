"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock, Loader2, ShieldAlert, XCircle } from "lucide-react";
import ErrorBanner from "../../../components/ErrorBanner";

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

  const [timeLeft, setTimeLeft] = useState(getSecondsLeft());

  // Countdown timer clock loop
  useEffect(() => {
    if (status !== "PENDING") return;

    // Tick every second
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
    setErrorMsg("Your inventory hold has expired.");
    setErrorCode("RESERVATION_EXPIRED");
  };

  // Confirm Purchase action
  const handleConfirm = async () => {
    setLoadingConfirm(true);
    setErrorMsg(null);
    setErrorCode(null);
    setSuccessMsg(null);

    // Concurrency prevention: supply a unique idempotency key
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
    setSuccessMsg(null);

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
      
      // Graceful delayed catalog redirect
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

  // Theme states matching remaining time
  const getCountdownConfig = (seconds: number) => {
    if (seconds > 180) {
      return {
        colorClass: "text-zinc-400",
        label: "Time remaining",
        bgClass: "border-zinc-800 bg-zinc-900/20",
        animateClass: "",
      };
    } else if (seconds >= 60) {
      return {
        colorClass: "text-warning",
        label: "Expiring soon",
        bgClass: "border-warning/10 bg-warning/5",
        animateClass: "",
      };
    } else {
      return {
        colorClass: "text-danger",
        label: "Expiring!",
        bgClass: "border-danger/10 bg-danger/5",
        animateClass: "animate-countdown-urgent",
      };
    }
  };

  const timerConfig = getCountdownConfig(timeLeft);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      
      {/* Return button */}
      <button
        onClick={() => router.push("/")}
        className="flex items-center gap-2 text-xs font-semibold text-zinc-500 hover:text-zinc-100 transition-colors uppercase tracking-widest cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Return to Catalog</span>
      </button>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: Reservation Details Card (lg:span-7) */}
        <div className="lg:col-span-7 border border-border rounded-lg bg-card p-6 md:p-8 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
            <div>
              <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                Holding ID
              </span>
              <p className="text-sm font-mono text-zinc-300 select-all mt-0.5">
                {reservation.id}
              </p>
            </div>

            {/* Reactive Status Badge */}
            {status === "PENDING" && (
              <span className="text-[10px] font-bold text-warning px-3 py-1 rounded-full border border-warning/20 bg-warning/5 uppercase tracking-widest">
                Pending Hold
              </span>
            )}
            {status === "CONFIRMED" && (
              <span className="text-[10px] font-bold text-primary px-3 py-1 rounded-full border border-primary/20 bg-primary/5 uppercase tracking-widest">
                Confirmed ✓
              </span>
            )}
            {status === "RELEASED" && (
              <span className="text-[10px] font-bold text-zinc-500 px-3 py-1 rounded-full border border-zinc-700/80 bg-zinc-800/20 uppercase tracking-widest">
                Released Hold
              </span>
            )}
          </div>

          {/* Details Body */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                Reserved Item
              </span>
              <p className="text-base font-bold text-zinc-200">{reservation.product.name}</p>
              <p className="text-xs font-mono text-zinc-500">SKU: {reservation.product.sku}</p>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                Hold Location
              </span>
              <p className="text-base font-bold text-zinc-200">{reservation.warehouse.name}</p>
              <p className="text-xs text-zinc-400">{reservation.warehouse.location}</p>
            </div>
          </div>

          <div className="w-full h-px bg-zinc-850" />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                Reserved Quantity
              </span>
              <p className="text-2xl font-bold font-mono text-zinc-200 mt-1">
                {reservation.quantity} <span className="text-sm font-sans font-normal text-zinc-500">units</span>
              </p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                Hold Created
              </span>
              <p className="text-sm font-mono text-zinc-300 mt-1">
                {new Date(reservation.createdAt).toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Action Card (lg:span-5) */}
        <div className="lg:col-span-5 flex flex-col justify-between border border-border rounded-lg bg-card p-6 md:p-8 space-y-6">
          
          {/* Active Pending Hold Timer */}
          {status === "PENDING" && (
            <div className={`flex flex-col items-center justify-center p-6 border rounded-lg transition-all duration-500 ${timerConfig.bgClass}`}>
              <Clock className={`w-5 h-5 mb-2 ${timerConfig.colorClass}`} />
              <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest">
                {timerConfig.label}
              </span>
              <span className={`text-4xl font-extrabold font-mono mt-1 ${timerConfig.colorClass} ${timerConfig.animateClass}`}>
                {formatTime(timeLeft)}
              </span>
            </div>
          )}

          {/* Success Banner */}
          {successMsg && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-primary uppercase tracking-wide">Success</h4>
                <p className="text-xs text-zinc-300 mt-1 leading-relaxed">{successMsg}</p>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {errorMsg && (
            <div className="my-1">
              <ErrorBanner
                message={errorMsg}
                code={errorCode || undefined}
                onDismiss={() => {
                  setErrorMsg(null);
                  setErrorCode(null);
                }}
              />
            </div>
          )}

          {/* Interactive States Details */}
          {status === "PENDING" && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={handleConfirm}
                disabled={loadingConfirm || loadingCancel}
                className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-emerald-600 disabled:opacity-50 text-zinc-950 font-bold py-4 rounded-lg transition-all duration-300 cursor-pointer"
              >
                {loadingConfirm ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Confirming...</span>
                  </>
                ) : (
                  <span>Confirm Purchase</span>
                )}
              </button>

              <button
                type="button"
                onClick={handleCancel}
                disabled={loadingConfirm || loadingCancel}
                className="w-full flex items-center justify-center gap-2 border border-zinc-800 hover:border-zinc-700 bg-zinc-900/60 hover:bg-zinc-900 hover:text-zinc-100 disabled:opacity-50 text-zinc-400 py-3.5 rounded-lg transition-colors cursor-pointer"
              >
                {loadingCancel ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <span>Cancel Reservation</span>
                )}
              </button>
            </div>
          )}

          {/* Confirmed Success State Display */}
          {status === "CONFIRMED" && (
            <div className="space-y-4 py-4 text-center">
              <CheckCircle2 className="w-12 h-12 text-primary mx-auto" />
              <div>
                <h3 className="text-lg font-bold text-zinc-100">Order Locked</h3>
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed max-w-xs mx-auto">
                  Hold resolved. Stock count permanently reduced from {reservation.warehouse.name}.
                </p>
              </div>
              <div className="w-full h-px bg-zinc-850 my-2" />
              <button
                onClick={() => router.push("/")}
                className="w-full bg-zinc-850 hover:bg-zinc-800 text-zinc-300 font-semibold py-3 rounded-lg transition-colors cursor-pointer"
              >
                Back to Products
              </button>
            </div>
          )}

          {/* Released Expiration State Display */}
          {status === "RELEASED" && (
            <div className="space-y-4 py-4 text-center">
              <XCircle className="w-12 h-12 text-zinc-600 mx-auto" />
              <div>
                <h3 className="text-lg font-bold text-zinc-400">Hold Released</h3>
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed max-w-xs mx-auto">
                  Inventory is returned to {reservation.warehouse.name} and available for other shoppers.
                </p>
              </div>
              <div className="w-full h-px bg-zinc-850 my-2" />
              <button
                onClick={() => router.push("/")}
                className="w-full bg-primary hover:bg-emerald-600 text-zinc-950 font-bold py-3.5 rounded-lg transition-colors cursor-pointer"
              >
                Browse Catalog
              </button>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
