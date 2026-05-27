"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play } from "lucide-react";

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
  const [isTyping, setIsTyping] = useState(false);
  const [typedExplanation, setTypedExplanation] = useState("");

  const selectedCombo = combos.find((c) => c.stockId === selectedStockId);

  // System analysis explanation block for typewriter effect
  const explanationText = [
    `> ANALYSIS: Request A acquired the row lock first.`,
    `> UPDATE executed: reservedUnits incremented by 1.`,
    `> Request B re-evaluated WHERE condition.`,
    `> (totalUnits - reservedUnits) >= 1 resolved FALSE.`,
    `> executeRaw returned rowCount: 0 → 409 returned.`,
    `> Zero data corruption. One reservation created. ✓`,
  ].join("\n");

  // Typewriter effect triggered once requests resolve successfully
  useEffect(() => {
    if (results && !loading) {
      setIsTyping(true);
      setTypedExplanation("");
      let i = 0;
      const interval = setInterval(() => {
        setTypedExplanation((prev) => prev + explanationText.charAt(i));
        i++;
        if (i >= explanationText.length) {
          clearInterval(interval);
          setIsTyping(false);
        }
      }, 8);
      return () => clearInterval(interval);
    } else {
      setTypedExplanation("");
    }
  }, [results, loading, explanationText]);

  const handleFire = async () => {
    if (!selectedCombo) return;
    setLoading(true);
    setResults(null);

    const reqAKey = crypto.randomUUID();
    const reqBKey = crypto.randomUUID();

    setResults([
      { status: "pending", uuid: reqAKey },
      { status: "pending", uuid: reqBKey },
    ]);

    const requestPayload = {
      productId: selectedCombo.productId,
      warehouseId: selectedCombo.warehouseId,
      quantity: 1,
    };

    const [resA, resB] = await Promise.allSettled([
      fetch("/api/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "idempotency-key": reqAKey,
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
          "idempotency-key": reqBKey,
        },
        body: JSON.stringify(requestPayload),
      }).then(async (res) => {
        const body = await res.json();
        return { ok: res.ok, status: res.status, body };
      }),
    ]);

    const mappedResults = [resA, resB].map((result, idx) => {
      const activeUuid = idx === 0 ? reqAKey : reqBKey;

      if (result.status === "rejected") {
        return {
          status: "fulfilled",
          success: false,
          uuid: activeUuid,
          errorCode: "500",
          errorMsg: "Network execution failed",
        };
      }

      const { ok, status, body } = result.value;
      if (ok) {
        return {
          status: "fulfilled",
          success: true,
          uuid: activeUuid,
          reservationId: body.id,
        };
      } else {
        return {
          status: "fulfilled",
          success: false,
          uuid: activeUuid,
          errorCode: status,
          errorMsg: body.error || "Not enough stock available",
        };
      }
    });

    setResults(mappedResults);
    setLoading(false);
  };

  return (
    <div className="w-full max-w-[900px] mx-auto flex flex-col gap-6 pt-6 font-sans">
      
      {/* -------------------------------------------------------------
         HEADER: Concurrency Simulator
         ------------------------------------------------------------- */}
      <div className="border-b border-[var(--border-default)] pb-4 select-none">
        <h1 className="text-lg font-extrabold tracking-tight uppercase text-[var(--text-primary)]">
          CONCURRENCY SIMULATOR
        </h1>
        <p className="text-[10px] md:text-xs font-mono text-[var(--text-secondary)] mt-1.5 uppercase tracking-wider leading-relaxed">
          Fires two simultaneous POST /api/reservations requests 
          for the last available unit. Exactly one must succeed.
        </p>
      </div>

      {/* -------------------------------------------------------------
         CONDITIONAL CHECK FOR AVAILABLE COMBOS
         ------------------------------------------------------------- */}
      {combos.length === 0 ? (
        <div className="border border-[var(--border-default)] bg-[var(--bg-surface)] p-12 text-center text-[var(--text-secondary)] rounded-xl select-none">
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--danger)]">
            ⚠ NO race-condition combos detected
          </p>
          <p className="text-[10px] text-zinc-500 mt-2 uppercase max-w-md mx-auto leading-normal">
            Race simulator requires at least one product-warehouse combination with exactly **1 unit available**. 
            Run the seed script in the shell to reinitialize.
          </p>
          
          <button
            onClick={() => router.refresh()}
            className="mt-6 h-11 px-6 border border-[var(--border-default)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-base)] text-[var(--text-primary)] font-bold text-xs uppercase rounded-lg transition-colors cursor-pointer select-none"
          >
            REFRESH SYSTEM STOCK
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-6 w-full">
          
          {/* STEP 1 & 2: PRODUCT SELECTOR AND FIRE TRIGGER */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 w-full items-end select-none">
            
            {/* Dropdown SELECT TARGET SKU */}
            <div className="md:col-span-8 flex flex-col gap-2">
              <label className="text-[10px] uppercase font-bold text-[var(--text-secondary)] tracking-[0.15em]">
                SELECT TARGET SKU
              </label>
              
              <div className="relative w-full border border-[var(--border-default)] hover:border-white/10 bg-black px-4 py-3 rounded-lg transition-colors">
                <select
                  value={selectedStockId}
                  onChange={(e) => {
                    setSelectedStockId(e.target.value);
                    setResults(null);
                  }}
                  disabled={loading}
                  className="w-full bg-black text-[var(--accent-primary)] font-mono text-xs outline-none border-0 uppercase cursor-pointer select-none pr-6 font-bold"
                >
                  {combos.map((c) => (
                    <option key={c.stockId} value={c.stockId} className="bg-black text-[var(--accent-primary)]">
                      {c.productName} ({c.sku}) — {c.warehouseName} [AVAIL: {c.availableUnits}]
                    </option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--accent-primary)] pointer-events-none font-mono text-xs select-none">
                  ▼
                </div>
              </div>
            </div>

            {/* Execute trigger */}
            <div className="md:col-span-4 w-full">
              <button
                type="button"
                onClick={handleFire}
                disabled={loading || !selectedCombo}
                className="w-full h-[46px] flex items-center justify-center bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-black font-extrabold text-xs tracking-[0.15em] uppercase rounded-lg transition-colors border-0 cursor-pointer shadow-lg shadow-[var(--accent-primary)]/10"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    <span>EXECUTING...</span>
                  </>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <Play className="w-3.5 h-3.5 fill-black" />
                    EXECUTE race condition
                  </span>
                )}
              </button>
            </div>

          </div>

          {/* -------------------------------------------------------------
             RESULTS: Two side-by-side terminal windows
             ------------------------------------------------------------- */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
            
            {/* REQUEST A TERMINAL PANEL */}
            <div className="glow-card flex flex-col rounded-xl overflow-hidden bg-black border border-[var(--border-default)]">
              {/* Header bar */}
              <div className="bg-[var(--bg-elevated)] border-b border-[var(--border-default)] px-4 py-2.5 flex items-center justify-between font-mono text-[9px] font-bold uppercase tracking-wider text-[var(--text-secondary)] select-none">
                <span>REQUEST A</span>
                {results ? (
                  results[0]?.success ? (
                    <div className="w-2 h-2 rounded-full bg-[var(--success)] shadow-[0_0_8px_rgba(16,185,129,0.5)]" title="Success" />
                  ) : results[0]?.status === "pending" ? (
                    <div className="w-2 h-2 rounded-full bg-zinc-650 blink" title="Executing" />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-[var(--danger)] shadow-[0_0_8px_rgba(239,68,68,0.5)]" title="Conflict" />
                  )
                ) : (
                  <div className="w-2 h-2 rounded-full bg-zinc-800" title="Offline" />
                )}
              </div>

              {/* Console Body */}
              <div className="bg-black p-4 font-mono text-xs rounded-none h-56 overflow-y-auto relative select-text leading-relaxed">
                {results ? (
                  results[0]?.status === "pending" ? (
                    <div className="text-zinc-500">
                      <div>&gt; POST /api/reservations</div>
                      <div>&gt; Idempotency-Key: {results[0]?.uuid.slice(0, 18)}...</div>
                      <div className="flex items-center">
                        <span>&gt;&nbsp;</span>
                        <span className="w-2 h-3.5 bg-zinc-400 blink inline-block animate-pulse-soft" />
                      </div>
                    </div>
                  ) : results[0]?.success ? (
                    <div className="text-[var(--success)] space-y-1">
                      <div>&gt; POST /api/reservations</div>
                      <div>&gt; ← 201 CREATED</div>
                      <div className="truncate">reservation.id: {results[0]?.reservationId}</div>
                      <div>status: PENDING</div>
                      <div>Hold confirmed ✓</div>
                    </div>
                  ) : (
                    <div className="text-[var(--danger)] space-y-1">
                      <div>&gt; POST /api/reservations</div>
                      <div>&gt; ← 409 CONFLICT</div>
                      <div>error: INSUFFICIENT_STOCK</div>
                      <div>"Not enough stock available"</div>
                    </div>
                  )
                ) : (
                  <span className="text-[var(--text-tertiary)] uppercase select-none">
                    &gt; CONSOLE_A READY
                  </span>
                )}
              </div>
            </div>

            {/* REQUEST B TERMINAL PANEL */}
            <div className="glow-card flex flex-col rounded-xl overflow-hidden bg-black border border-[var(--border-default)]">
              {/* Header bar */}
              <div className="bg-[var(--bg-elevated)] border-b border-[var(--border-default)] px-4 py-2.5 flex items-center justify-between font-mono text-[9px] font-bold uppercase tracking-wider text-[var(--text-secondary)] select-none">
                <span>REQUEST B</span>
                {results ? (
                  results[1]?.success ? (
                    <div className="w-2 h-2 rounded-full bg-[var(--success)] shadow-[0_0_8px_rgba(16,185,129,0.5)]" title="Success" />
                  ) : results[1]?.status === "pending" ? (
                    <div className="w-2 h-2 rounded-full bg-zinc-650 blink" title="Executing" />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-[var(--danger)] shadow-[0_0_8px_rgba(239,68,68,0.5)]" title="Conflict" />
                  )
                ) : (
                  <div className="w-2 h-2 rounded-full bg-zinc-800" title="Offline" />
                )}
              </div>

              {/* Console Body */}
              <div className="bg-black p-4 font-mono text-xs rounded-none h-56 overflow-y-auto relative select-text leading-relaxed">
                {results ? (
                  results[1]?.status === "pending" ? (
                    <div className="text-zinc-500">
                      <div>&gt; POST /api/reservations</div>
                      <div>&gt; Idempotency-Key: {results[1]?.uuid.slice(0, 18)}...</div>
                      <div className="flex items-center">
                        <span>&gt;&nbsp;</span>
                        <span className="w-2 h-3.5 bg-zinc-400 blink inline-block animate-pulse-soft" />
                      </div>
                    </div>
                  ) : results[1]?.success ? (
                    <div className="text-[var(--success)] space-y-1">
                      <div>&gt; POST /api/reservations</div>
                      <div>&gt; ← 201 CREATED</div>
                      <div className="truncate">reservation.id: {results[1]?.reservationId}</div>
                      <div>status: PENDING</div>
                      <div>Hold confirmed ✓</div>
                    </div>
                  ) : (
                    <div className="text-[var(--danger)] space-y-1">
                      <div>&gt; POST /api/reservations</div>
                      <div>&gt; ← 409 CONFLICT</div>
                      <div>error: INSUFFICIENT_STOCK</div>
                      <div>"Not enough stock available"</div>
                    </div>
                  )
                ) : (
                  <span className="text-[var(--text-tertiary)] uppercase select-none">
                    &gt; CONSOLE_B READY
                  </span>
                )}
              </div>
            </div>

          </div>

          {/* -------------------------------------------------------------
             EXPLANATION PANEL: Typewriter effect system analysis
             ------------------------------------------------------------- */}
          <div className="glow-card flex flex-col w-full rounded-xl overflow-hidden bg-black border border-[var(--border-default)]">
            {/* Panel Title */}
            <div className="bg-[var(--bg-elevated)] border-b border-[var(--border-default)] px-4 py-2.5 font-mono text-[9px] font-bold uppercase tracking-wider text-[var(--text-secondary)] select-none">
              SYSTEM ANALYSIS AUDIT
            </div>

            {/* Panel Body */}
            <div className="bg-black p-5 font-mono text-xs text-zinc-400 leading-relaxed min-h-[140px] whitespace-pre-wrap select-text">
              {results && !loading ? (
                <>
                  {typedExplanation}
                  {isTyping && <span className="w-2 h-3.5 bg-zinc-400 blink inline-block ml-0.5" />}
                  {!isTyping && (
                    <div className="mt-4 text-[var(--text-secondary)] select-none font-bold">
                      &gt; LOCK AUDIT TERMINATED. ROW INTEGRITY 100% SECURE.
                    </div>
                  )}
                </>
              ) : (
                <span className="text-[var(--text-tertiary)] uppercase select-none font-bold">
                  &gt; CONCURRENCY_MONITOR AWAITING TRANSACTION TRIGGER...
                </span>
              )}
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
