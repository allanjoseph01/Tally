"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
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
  createdAt: Date;
  stocks: Stock[];
}

interface ProductGridProps {
  products: Product[];
}

export default function ProductGrid({ products }: ProductGridProps) {
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeReservations, setActiveReservations] = useState<any[]>([]);

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

  const openReserveModal = (product: any, warehouse: any) => {
    setSelectedProduct(product);
    setSelectedWarehouse(warehouse);
    setIsModalOpen(true);
  };

  const closeReserveModal = () => {
    setIsModalOpen(false);
    setSelectedProduct(null);
    setSelectedWarehouse(null);
  };

  // Consistent Booking.com viewing metrics seeded by product ID
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {products.map((product) => {
        const viewingCount = getViewingCount(product.id);

        return (
          <div
            key={product.id}
            className="flex flex-col border border-border rounded-lg bg-card text-zinc-100 shadow-md p-6 justify-between transition-all duration-300 hover:border-zinc-700/80 hover:shadow-emerald-500/5 hover:-translate-y-0.5"
          >
            <div>
              {/* Product Header */}
              <h2 className="text-lg font-bold text-zinc-100 leading-tight">
                {product.name}
              </h2>
              <p className="text-xs font-mono text-zinc-500 mt-1 uppercase tracking-wider">
                SKU: {product.sku}
              </p>

              {product.description && (
                <p className="text-xs text-zinc-400 mt-3 leading-relaxed font-sans">
                  {product.description}
                </p>
              )}

              {/* Divider */}
              <div className="w-full h-px bg-zinc-800/80 my-5" />

              {/* Stock Levels Section */}
              <div className="space-y-4">
                <h4 className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                  Warehouse Stock
                </h4>
                {product.stocks.map((stock) => {
                  const isLowStock = stock.availableUnits >= 1 && stock.availableUnits <= 4;
                  const isOutOfStock = stock.availableUnits === 0;
                  const activeRes = activeReservations.find(
                    (r) => r.productId === product.id && r.warehouseId === stock.warehouseId
                  );

                  return (
                    <div
                      key={stock.warehouseId}
                      className="flex items-center justify-between py-2 border-b border-zinc-800/40 last:border-b-0 gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-zinc-300 truncate">
                          {stock.warehouseName}
                        </p>
                        <p className="text-[9px] text-zinc-500 font-medium truncate mt-0.5">
                          {stock.warehouseLocation}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        {/* Units Monospace count */}
                        <span className="text-sm font-semibold font-mono text-zinc-200 w-6 text-right">
                          {stock.availableUnits}
                        </span>

                        {/* Status Badge */}
                        {isOutOfStock ? (
                          <span className="text-[9px] font-bold text-danger px-2.5 py-0.5 rounded border border-danger/20 bg-danger/5 uppercase tracking-wider">
                            Out of Stock
                          </span>
                        ) : isLowStock ? (
                          <span className="text-[9px] font-bold text-warning px-2.5 py-0.5 rounded border border-warning/20 bg-warning/5 uppercase tracking-wider animate-pulse-soft">
                            Low Stock
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold text-primary px-2.5 py-0.5 rounded border border-primary/20 bg-primary/5 uppercase tracking-wider">
                            In Stock
                          </span>
                        )}

                        {/* Action Reserve Button */}
                        {activeRes ? (
                          <Link
                            href={`/reservation/${activeRes.id}`}
                            className="text-[10px] font-bold py-1.5 px-3 rounded border border-warning/20 bg-warning/5 text-warning hover:bg-warning/15 hover:text-warning transition-colors cursor-pointer inline-block text-center whitespace-nowrap"
                          >
                            Resume Hold →
                          </Link>
                        ) : (
                          <button
                            type="button"
                            disabled={isOutOfStock}
                            onClick={() => openReserveModal(product, {
                              id: stock.warehouseId,
                              name: stock.warehouseName,
                              location: stock.warehouseLocation,
                              availableUnits: stock.availableUnits
                            })}
                            className="text-[10px] font-bold py-1.5 px-3 rounded border bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-35 disabled:hover:bg-zinc-900 disabled:hover:text-zinc-500 transition-colors cursor-pointer"
                          >
                            Reserve
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom urgent booking watching indicator */}
            <div className="pt-4 mt-6 border-t border-zinc-800/60 flex items-center gap-2 text-[10px] font-medium text-zinc-500 font-sans">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span>{viewingCount} people viewing this item</span>
            </div>
          </div>
        );
      })}

      {/* Render Modal */}
      {selectedProduct && selectedWarehouse && (
        <ReserveModal
          isOpen={isModalOpen}
          onClose={closeReserveModal}
          product={selectedProduct}
          warehouse={selectedWarehouse}
        />
      )}
    </div>
  );
}
