"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2, RefreshCw, Zap } from "lucide-react";

interface Combo {
  stockId: string;
  productId: string;
  productName: string;
  sku: string;
  warehouseId: string;
  warehouseName: string;
  warehouseLocation: string;
  availableUnits: number;
}

interface DemoClientProps {
  combos: Combo[];
}

export default function DemoClient({ combos }: DemoClientProps) {
  const router = useRouter();
  const [selectedStockId, setSelectedStockId] = useState<string>(combos[0]?.stockId || "");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);

  const selectedCombo = combos.find((c) => c.stockId === selectedStockId);

  const handleFire = async () => {
    if (!selectedCombo) return;
    setLoading(true);
    setResults([
      { status: "pending" },
      { status: "pending" },
    ]);

    // Unique keys for each mock customer
    const req1Key = crypto.randomUUID();
    const req2Key = crypto.randomUUID();

    const requestPayload = {
      productId: selectedCombo.productId,
      warehouseId: selectedCombo.warehouseId,
      quantity: 1,
    };

    // Simultaneously dispatch both fetch requests
    const [res1, res2] = await Promise.allSettled([
      fetch("/api/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "idempotency-key": req1Key,
        },
        body: JSON.stringify(requestPayload),
      }).then(async (res) => {
        const body = await res.json();
        return { ok: res.ok, status: res.status, body };
      }),
      fetch("/api/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "idempotency-key": req2Key,
        },
        body: JSON.stringify(requestPayload),
      }).then(async (res) => {
        const body = await res.json();
        return { ok: res.ok, status: res.status, body };
      }),
    ]);

    // Parse the settlements
    const mappedResults = [res1, res2].map((result) => {
      if (result.status === "rejected") {
        return {
          status: "rejected",
          error: "Network execution failed",
        };
      }

      const { ok, status, body } = result.value;
      if (ok) {
        return {
          status: "fulfilled",
          success: true,
          reservationId: body.id,
        };
      } else {
        return {
          status: "fulfilled",
          success: false,
          errorCode: status,
          errorMsg: body.error || "Not enough stock available",
        };
      }
    });

    setResults(mappedResults);
    setLoading(false);
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      
      {/* Header */}
      <div className="border-b border-border pb-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-zinc-100 flex items-center gap-3">
          <Zap className="w-8 h-8 text-primary animate-pulse" />
          <span>Race Condition Demo</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
          Simulate a real-time race condition. Fire two simultaneous checkout requests for the last available unit of stock.
        </p>
      </div>

      {combos.length === 0 ? (
        <div className="border border-border rounded-lg bg-card p-12 text-center text-zinc-500">
          <AlertCircle className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
          <p className="text-sm font-semibold">No low stock combinations found.</p>
          <p className="text-xs text-zinc-600 mt-1 max-w-sm mx-auto">
            All inventory combinations have 0 available units or more than 1 unit. Run the seed script to reset stock.
          </p>
          <button
            onClick={() => router.refresh()}
            className="mt-4 inline-flex items-center gap-2 border border-zinc-800 bg-zinc-900 hover:bg-zinc-850 px-4 py-2 rounded-lg text-xs font-semibold text-zinc-300 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Check Stock Again</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          
          {/* CONTROL SECTION (md:span-5) */}
          <div className="md:col-span-5 border border-border rounded-lg bg-card p-6 space-y-6">
            
            {/* Step 1: Select Dropdown */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wide block">
                Step 1: Pick product-warehouse combo
              </label>
              <select
                value={selectedStockId}
                onChange={(e) => {
                  setSelectedStockId(e.target.value);
                  setResults(null);
                }}
                disabled={loading}
                className="w-full rounded-lg border border-border bg-zinc-950 px-3.5 py-3 text-xs text-zinc-200 outline-none focus:border-primary/50 transition-colors cursor-pointer"
              >
                {combos.map((c) => (
                  <option key={c.stockId} value={c.stockId}>
                    {c.productName} ({c.sku}) — {c.warehouseName} [Avail: {c.availableUnits}]
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-zinc-500 leading-normal">
                Default listings prioritize products seeded with exactly **1 available unit** for demonstration.
              </p>
            </div>

            {/* Step 2: Trigger Button */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wide block">
                Step 2: Fire Simultaneous Requests
              </label>
              <button
                type="button"
                onClick={handleFire}
                disabled={loading || !selectedCombo}
                className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-emerald-600 disabled:opacity-50 text-zinc-950 font-bold py-3.5 rounded-lg transition-colors cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Firing Requests...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    <span>Fire Simultaneous Requests</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* OUTCOME CARDS (md:span-7) */}
          <div className="md:col-span-7 space-y-6">
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wide">
              Concurrent Execution Results
            </h4>

            {results ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {results.map((res, idx) => {
                  const isPending = res.status === "pending";
                  const isSuccess = res.success;

                  return (
                    <div
                      key={idx}
                      className={`border rounded-lg p-5 flex flex-col justify-between h-40 transition-all duration-300 ${
                        isPending
                          ? "border-zinc-800 bg-zinc-900/40"
                          : isSuccess
                          ? "border-primary/20 bg-primary/5 text-primary"
                          : "border-danger/20 bg-danger/5 text-danger"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                            Request #{idx + 1}
                          </span>
                          {isPending && <Loader2 className="w-3.5 h-3.5 text-zinc-500 animate-spin" />}
                        </div>

                        <div className="mt-3">
                          {isPending ? (
                            <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest animate-pulse">
                              Pending response...
                            </p>
                          ) : isSuccess ? (
                            <div className="space-y-1">
                              <p className="text-sm font-bold flex items-center gap-1.5 text-primary">
                                <CheckCircle2 className="w-4 h-4" />
                                <span>✓ Reserved</span>
                              </p>
                              <p className="text-[10px] font-mono text-zinc-300 truncate mt-1">
                                ID: {res.reservationId}
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <p className="text-sm font-bold flex items-center gap-1.5 text-danger">
                                <AlertCircle className="w-4 h-4" />
                                <span>✗ 409 Rejected</span>
                              </p>
                              <p className="text-[10px] text-zinc-400 mt-1 leading-relaxed">
                                {res.errorMsg}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Bottom badge */}
                      {!isPending && isSuccess && (
                        <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded border border-primary/20 bg-primary/10 self-start text-primary">
                          201 Created
                        </span>
                      )}
                      {!isPending && !isSuccess && (
                        <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded border border-danger/20 bg-danger/10 self-start text-danger">
                          409 Conflict
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="border border-zinc-850 rounded-lg p-10 text-center text-zinc-600 bg-zinc-900/20">
                <Zap className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                <p className="text-xs">Pending execution trigger. Choose a stock target and press Fire.</p>
              </div>
            )}

            {/* Explanation section */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-5 leading-relaxed">
              <h5 className="text-xs font-bold text-zinc-300 uppercase tracking-wider mb-2">
                Under the Hood: Database-level Locking
              </h5>
              <p className="text-xs text-zinc-400">
                Both HTTP requests hit the Node/Postgres server in the exact same millisecond. 
                Using standard select-then-write code would result in a double-reservation race condition. 
                Tally avoids this entirely by running an **atomic PostgreSQL raw UPDATE** protected inside a transaction:
              </p>
              <pre className="text-[10px] font-mono bg-zinc-950/70 p-3 rounded border border-zinc-850 text-zinc-500 my-3 overflow-x-auto">
{`UPDATE "Stock"
SET "reservedUnits" = "reservedUnits" + 1
WHERE id = $1
AND ("totalUnits" - "reservedUnits") >= 1`}
              </pre>
              <p className="text-xs text-zinc-400">
                PostgreSQL forces serialize-order row locks. The first transaction decreases availability atomically and succeeds. The second transaction checks availability, sees it is now <code className="font-mono text-zinc-300">0</code>, returns a count of <code className="font-mono text-zinc-300">0</code> rows updated, rolls back instantly, and responds with a standard <code className="font-mono text-zinc-300">409 Conflict</code>. **Result: 100% data consistency.**
              </p>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
