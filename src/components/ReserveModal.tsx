"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Minus, Plus, X } from "lucide-react";
import ErrorBanner from "./ErrorBanner";

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

  if (!isOpen) return null;

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

  const handleReserve = async () => {
    setLoading(true);
    setErrorMsg(null);
    setErrorCode(null);

    // Generate a unique idempotency key for this transaction to prevent double holds
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

      // Success: redirect to the reservation confirm/release page
      router.push(`/reservation/${data.id}`);
    } catch (err: any) {
      setErrorMsg("Failed to connect to the reservation engine. Please try again.");
      setErrorCode("NETWORK_ERROR");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop blur overlay */}
      <div
        className="absolute inset-0 bg-zinc-950/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Card container */}
      <div className="relative w-full max-w-md transform overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 p-6 text-left shadow-xl transition-all z-10">
        
        {/* Header */}
        <div className="flex items-start justify-between pb-4">
          <div>
            <h3 className="text-lg font-bold text-zinc-100">Secure Stock Reservation</h3>
            <p className="text-xs text-zinc-500 font-mono mt-0.5 uppercase tracking-wider">
              SKU: {product.sku}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md border border-zinc-800 bg-zinc-900/60 p-1 text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Product Details info block */}
        <div className="space-y-3.5 my-4 p-4 rounded-lg bg-zinc-950/50 border border-zinc-800/80">
          <div>
            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Product</span>
            <p className="text-sm font-semibold text-zinc-200">{product.name}</p>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Warehouse</span>
            <p className="text-sm font-semibold text-zinc-200">
              {warehouse.name} <span className="text-zinc-500 font-normal">({warehouse.location})</span>
            </p>
          </div>
          <div className="flex justify-between items-center pt-1">
            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Live Stock Available</span>
            <span className="text-xs font-mono font-semibold text-primary px-2.5 py-0.5 rounded-full border border-primary/20 bg-primary/5">
              {warehouse.availableUnits} units
            </span>
          </div>
        </div>

        {/* Errors display */}
        {errorMsg && (
          <div className="my-3">
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

        {/* Quantity selector with premium counter interface */}
        <div className="my-6">
          <label className="text-xs font-bold text-zinc-400 block mb-2.5">
            Select Quantity <span className="text-zinc-600 font-normal">(Max {maxLimit} holds)</span>
          </label>
          <div className="flex items-center gap-4">
            <div className="flex items-center border border-zinc-800 rounded-lg bg-zinc-950">
              <button
                type="button"
                onClick={decrement}
                disabled={quantity <= 1 || loading}
                className="flex items-center justify-center w-11 h-11 text-zinc-400 hover:text-zinc-100 disabled:opacity-30 disabled:hover:text-zinc-400 transition-colors"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-12 text-center text-sm font-semibold font-mono text-zinc-100 select-none">
                {quantity}
              </span>
              <button
                type="button"
                onClick={increment}
                disabled={quantity >= maxLimit || loading}
                className="flex items-center justify-center w-11 h-11 text-zinc-400 hover:text-zinc-100 disabled:opacity-30 disabled:hover:text-zinc-400 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="text-xs text-zinc-500 leading-tight">
              Quantity will be locked for checkout completion.
            </div>
          </div>
        </div>

        {/* Checkout Hold Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleReserve}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-emerald-600 disabled:opacity-50 text-zinc-950 font-bold py-3.5 px-4 rounded-lg transition-all duration-300 shadow-lg shadow-emerald-500/10 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Securing Inventory...</span>
              </>
            ) : (
              <span>Hold for 10 minutes</span>
            )}
          </button>
          <p className="text-[10px] text-zinc-600 text-center mt-3 tracking-wide">
            Locks selected items on Neon PostgreSQL. Uncompleted orders auto-release.
          </p>
        </div>

      </div>
    </div>
  );
}
