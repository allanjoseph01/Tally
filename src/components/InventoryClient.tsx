"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { RotateCw, ShieldCheck, Database, Box } from "lucide-react";
import ReserveModal from "./ReserveModal";

interface Stock {
  warehouseId: string;
  warehouseName: string;
  warehouseLocation: string;
  totalUnits: number;
  reservedUnits: number;
  availableUnits: number;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  imageUrl: string | null;
  createdAt: string;
  stocks: Stock[];
}

interface Warehouse {
  id: string;
  name: string;
  location: string;
}

interface InventoryClientProps {
  products: Product[];
  warehouses: Warehouse[];
  activeHolds: number;
  totalProducts: number;
  totalWarehouses: number;
}

export default function InventoryClient({
  products,
  warehouses,
  activeHolds,
  totalProducts,
  totalWarehouses,
}: InventoryClientProps) {
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("all");
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [selectedWarehouseStock, setSelectedWarehouseStock] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeReservations, setActiveReservations] = useState<any[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [secondsSinceUpdate, setSecondsSinceUpdate] = useState(0);

  // 1. Live counter for relative timestamp
  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsSinceUpdate((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const getRelativeTime = () => {
    if (secondsSinceUpdate < 5) return "JUST NOW";
    if (secondsSinceUpdate < 60) return `${secondsSinceUpdate}S AGO`;
    const mins = Math.floor(secondsSinceUpdate / 60);
    const secs = secondsSinceUpdate % 60;
    return `${mins}M ${secs}S AGO`;
  };

  // 2. Load active holds from localStorage to identify "RESUME HOLD" states
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const existing = localStorage.getItem("tally_reservations");
      if (existing) {
        const parsed = JSON.parse(existing);
        const now = new Date();
        const active = parsed.filter((r: any) => {
          return r.status === "PENDING" && new Date(r.expiresAt) > now;
        });
        setActiveReservations(active);
        if (active.length !== parsed.length) {
          localStorage.setItem("tally_reservations", JSON.stringify(active));
        }
      }
    } catch (err) {
      console.error("Failed to load active reservations", err);
    }
  }, []);

  // 3. Trigger premium refresh rotate animation and reload page
  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      window.location.reload();
    }, 600);
  };

  // 4. Modal Open/Close handlers
  const openReserveModal = (product: any, warehouseStock: any) => {
    setSelectedProduct(product);
    setSelectedWarehouseStock({
      id: warehouseStock.warehouseId,
      name: warehouseStock.warehouseName,
      location: warehouseStock.warehouseLocation,
      availableUnits: warehouseStock.availableUnits,
    });
    setIsModalOpen(true);
  };

  const closeReserveModal = () => {
    setIsModalOpen(false);
    setSelectedProduct(null);
    setSelectedWarehouseStock(null);
  };

  // 5. Calculate stock counts per warehouse dynamically based on passed products
  const getWarehouseStockCount = (whId: string) => {
    return products.reduce((sum, p) => {
      const whStock = p.stocks.find((s) => s.warehouseId === whId);
      return sum + (whStock ? whStock.availableUnits : 0);
    }, 0);
  };

  const getTotalAvailableAcrossAll = () => {
    return products.reduce((sum, p) => {
      return sum + p.stocks.reduce((sSum, s) => sSum + s.availableUnits, 0);
    }, 0);
  };

  // 6. Consistent viewing metrics seeded by product ID
  const getViewingCount = (productId: string): number => {
    let hash = 0;
    for (let i = 0; i < productId.length; i++) {
      hash = productId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const min = 3;
    const max = 12;
    return min + (Math.abs(hash) % (max - min + 1));
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 items-start w-full font-sans">
      {/* -------------------------------------------------------------
         SIDEBAR: Filters and Stats (Sticky)
         ------------------------------------------------------------- */}
      <aside className="w-full lg:w-[240px] flex flex-col gap-6 lg:sticky lg:top-[72px] shrink-0 select-none">
        
        {/* Warehouse List */}
        <div>
          <h3 className="text-[10px] uppercase font-bold text-[var(--text-secondary)] tracking-[0.15em] mb-3 font-sans">
            WAREHOUSE STATIONS
          </h3>

          <div className="flex flex-row lg:flex-col flex-wrap lg:flex-nowrap gap-1 w-full border-b lg:border-b-0 border-[var(--border-default)] pb-4 lg:pb-0">
            {/* ALL LOCATIONS filter */}
            <button
              onClick={() => setSelectedWarehouseId("all")}
              className={`w-auto lg:w-full flex items-center justify-between text-left px-3 py-2.5 text-xs font-semibold transition-all border-l-2 cursor-pointer ${
                selectedWarehouseId === "all"
                  ? "border-[var(--accent-primary)] text-[var(--accent-primary)] bg-[var(--accent-muted)] font-bold"
                  : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.02]"
              }`}
            >
              <span>ALL LOCATIONS</span>
              <span className="text-[10px] font-mono opacity-70 bg-white/[0.04] px-1.5 py-0.5 ml-2">
                {getTotalAvailableAcrossAll()}
              </span>
            </button>

            {/* Individual warehouses */}
            {warehouses.map((wh) => {
              const whCount = getWarehouseStockCount(wh.id);
              const isSelected = selectedWarehouseId === wh.id;

              return (
                <button
                  key={wh.id}
                  onClick={() => setSelectedWarehouseId(wh.id)}
                  className={`w-auto lg:w-full flex items-center justify-between text-left px-3 py-2.5 text-xs font-semibold transition-all border-l-2 cursor-pointer ${
                    isSelected
                      ? "border-[var(--accent-primary)] text-[var(--accent-primary)] bg-[var(--accent-muted)] font-bold"
                      : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.02]"
                  }`}
                >
                  <span className="truncate uppercase">{wh.name}</span>
                  <span className="text-[10px] font-mono opacity-70 bg-white/[0.04] px-1.5 py-0.5 ml-2">
                    {whCount}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* HIGH-FIDELITY DEV PANEL STATS BOX (No box-drawing characters!) */}
        <div className="hidden lg:flex flex-col gap-3 w-full p-4 bg-[var(--bg-surface)] border border-[var(--border-default)]">
          <span className="text-[10px] font-bold text-[var(--text-secondary)] tracking-wider uppercase select-none flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)] animate-pulse" />
            SYSTEM STATUS
          </span>

          <div className="space-y-3.5 pt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                <Box className="w-3.5 h-3.5 opacity-60" />
                <span>ACTIVE HOLDS</span>
              </div>
              <span className="text-xs font-bold font-mono text-[var(--accent-primary)]">
                {activeHolds}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                <Database className="w-3.5 h-3.5 opacity-60" />
                <span>TOTAL PRODUCTS</span>
              </div>
              <span className="text-xs font-bold font-mono text-[var(--text-primary)]">
                {totalProducts}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                <ShieldCheck className="w-3.5 h-3.5 opacity-60" />
                <span>WAREHOUSES</span>
              </div>
              <span className="text-xs font-bold font-mono text-[var(--text-primary)]">
                {totalWarehouses}
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* -------------------------------------------------------------
         MAIN AREA: Products Grid
         ------------------------------------------------------------- */}
      <section className="flex-1 w-full flex flex-col gap-6">
        {/* Header toolbar */}
        <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-4">
          <div className="flex flex-col">
            <h1 className="text-lg font-extrabold tracking-tight uppercase text-[var(--text-primary)]">
              INVENTORY CATALOG
            </h1>
            <span className="text-[10px] md:text-xs font-mono text-[var(--text-secondary)] mt-0.5 uppercase tracking-wider">
              {totalProducts} PRODUCTS · UPDATED {getRelativeTime()}
            </span>
          </div>

          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 text-xs font-bold text-[var(--accent-primary)] hover:text-[var(--accent-hover)] transition-colors bg-transparent border-0 cursor-pointer uppercase tracking-widest select-none"
          >
            <RotateCw
              className={`w-3.5 h-3.5 ${
                isRefreshing ? "animate-spin" : "transition-transform hover:rotate-45"
              }`}
            />
            REFRESH
          </button>
        </div>

        {/* Mobile Stat Bar */}
        <div className="flex lg:hidden flex-row flex-wrap justify-between items-center gap-4 p-3 bg-[var(--bg-surface)] border border-[var(--border-default)] mb-2 select-none w-full">
          <span className="text-[10px] font-bold text-[var(--text-secondary)] tracking-wider uppercase">
            STATUS: ACTIVE
          </span>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 text-xs">
              <span className="text-[var(--text-secondary)] font-medium">HOLDS:</span>
              <span className="font-mono font-bold text-[var(--accent-primary)]">{activeHolds}</span>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <span className="text-[var(--text-secondary)] font-medium">STOCK:</span>
              <span className="font-mono font-bold text-[var(--text-primary)]">{totalProducts}</span>
            </div>
          </div>
        </div>

        {/* Products Grid list */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 w-full">
          {products.map((product) => {
            const viewingCount = getViewingCount(product.id);

            // Filter stocks to display inside this card
            const displayedStocks =
              selectedWarehouseId === "all"
                ? product.stocks
                : product.stocks.filter((s) => s.warehouseId === selectedWarehouseId);

            return (
              <article
                key={product.id}
                className="glow-card flex flex-col bg-[var(--bg-surface)] border border-[var(--border-default)] hover:border-[var(--border-active)] transition-all duration-300 relative rounded-lg overflow-hidden"
              >
                {/* 1. CARD TOP BAR: High-Fidelity header */}
                <div className="flex items-center justify-between bg-[var(--bg-elevated)] px-4 py-2.5 border-b border-[var(--border-default)] w-full">
                  <span className="text-[var(--accent-primary)] font-mono text-xs font-bold uppercase tracking-wider">
                    {product.sku}
                  </span>
                  <span className="text-[var(--text-secondary)] bg-white/[0.04] font-mono text-[9px] px-1.5 py-0.5 select-none rounded">
                    #{product.id.slice(0, 6)}
                  </span>
                </div>

                {/* 2. CARD BODY */}
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wide line-clamp-2 leading-tight">
                      {product.name}
                    </h2>

                    {/* Description if present */}
                    {product.description && (
                      <p className="text-[11px] text-[var(--text-secondary)] line-clamp-2 mt-2 leading-relaxed font-sans">
                        {product.description}
                      </p>
                    )}

                    {/* Tear-line dashed border */}
                    <div className="w-full border-b border-dashed border-[var(--border-default)] my-4 opacity-50" />

                    {/* Stock listing */}
                    <div className="space-y-4">
                      {displayedStocks.length > 0 ? (
                        displayedStocks.map((stock) => {
                          const isLowStock = stock.availableUnits >= 1 && stock.availableUnits <= 4;
                          const isOutOfStock = stock.availableUnits === 0;
                          
                          // Determine stock bar width percent
                          const total = stock.totalUnits || 1;
                          const percent = Math.min(100, Math.max(0, (stock.availableUnits / total) * 100));

                          // Color based on unit limits
                          const barColor = isOutOfStock
                            ? "bg-[var(--danger)]"
                            : isLowStock
                            ? "bg-[var(--warning)]"
                            : "bg-[var(--success)]";

                          // Active hold check
                          const activeRes = activeReservations.find(
                            (r) => r.productId === product.id && r.warehouseId === stock.warehouseId
                          );

                          return (
                            <div key={stock.warehouseId} className="flex flex-col gap-1.5">
                              {/* Warehouse title & units */}
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-[var(--text-secondary)] font-bold tracking-wider uppercase truncate max-w-[65%] font-sans">
                                  {stock.warehouseName}
                                </span>
                                <span
                                  className={`font-semibold tracking-wide font-mono ${
                                    isLowStock ? "blink text-[var(--warning)] font-bold" : "text-[var(--text-primary)]"
                                  }`}
                                >
                                  {stock.availableUnits} UNITS
                                </span>
                              </div>

                              {/* Progress bar container */}
                              <div className="w-full h-1 bg-white/[0.04] overflow-hidden rounded-full">
                                <div
                                  className={`h-full ${barColor} transition-all duration-300 rounded-full`}
                                  style={{ width: `${percent}%` }}
                                />
                              </div>

                              {/* Action row (Hold button / Resume button / Depleted state) */}
                              <div className="flex justify-end pt-1">
                                {activeRes ? (
                                  <Link
                                    href={`/reservation/${activeRes.id}`}
                                    className="text-[10px] font-bold font-sans py-1.5 px-3 bg-transparent border border-[var(--warning)] text-[var(--warning)] hover:bg-[var(--warning-muted)] transition-colors tracking-wide select-none rounded"
                                  >
                                    Resume Hold →
                                  </Link>
                                ) : isOutOfStock ? (
                                  <span className="text-[10px] font-bold font-sans text-[var(--text-tertiary)] uppercase tracking-wider py-1.5 select-none font-semibold">
                                    Depleted
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => openReserveModal(product, stock)}
                                    className="text-[10px] font-bold font-sans py-1.5 px-3 border border-[var(--accent-primary)] text-[var(--accent-primary)] bg-transparent hover:bg-[var(--accent-muted)] transition-all tracking-wide cursor-pointer rounded"
                                  >
                                    Reserve Hold →
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-center py-4">
                          <span className="text-[10px] font-sans text-[var(--text-tertiary)] uppercase tracking-wider">
                            NO WAREHOUSE RECORD
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 3. CARD FOOTER: Watching and status lights */}
                <div className="px-4 py-2 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center justify-between w-full select-none">
                  <div className="flex items-center gap-1.5 text-[9px] font-bold font-sans text-[var(--text-secondary)] tracking-wider uppercase">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--danger)] animate-pulse shadow-[0_0_6px_rgba(239,68,68,0.4)]" />
                    <span>{viewingCount} WATCHING</span>
                  </div>
                  <span className="text-[9px] font-bold font-sans text-[var(--text-secondary)] tracking-wider uppercase">
                    Active Reserve
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Reserve holds Modal binder */}
      {selectedProduct && selectedWarehouseStock && (
        <ReserveModal
          isOpen={isModalOpen}
          onClose={closeReserveModal}
          product={selectedProduct}
          warehouse={selectedWarehouseStock}
        />
      )}
    </div>
  );
}
