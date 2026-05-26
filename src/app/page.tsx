import { prisma } from "../lib/db";
import ProductGrid from "../components/ProductGrid";
import RefreshWrapper from "../components/RefreshWrapper";

// Ensure this page is rendered dynamically on every request so stock levels are always live
export const dynamic = "force-dynamic";

export default async function Home() {
  // 1. Run lazy expiry cleanup of reservation holds atomically in the database
  // This guarantees that stock counts are always correct when the page is read,
  // even if the vercel cron hasn't executed yet.
  const expiredRows = await prisma.$queryRaw<{ id: string }[]>`
    UPDATE "Stock" s
    SET "reservedUnits" = s."reservedUnits" - r.quantity
    FROM "Reservation" r  
    WHERE r."stockId" = s.id
    AND r.status = 'PENDING'
    AND r."expiresAt" < NOW()
    RETURNING r.id
  `;

  // 2. Mark those expired reservations as RELEASED in the database
  if (expiredRows && expiredRows.length > 0) {
    const expiredIds = expiredRows.map((row) => row.id);
    await prisma.reservation.updateMany({
      where: {
        id: { in: expiredIds },
      },
      data: {
        status: "RELEASED",
      },
    });
  }

  // 3. Fetch all products ordered by name and include stock levels mapped to their warehouses
  const products = await prisma.product.findMany({
    orderBy: {
      name: "asc",
    },
    include: {
      stocks: {
        include: {
          warehouse: true,
        },
        orderBy: {
          warehouse: {
            name: "asc",
          },
        },
      },
    },
  });

  // 4. Format products and calculate available stock levels
  const formattedProducts = products.map((product) => ({
    id: product.id,
    name: product.name,
    sku: product.sku,
    description: product.description,
    imageUrl: product.imageUrl,
    createdAt: product.createdAt,
    stocks: product.stocks.map((stock) => ({
      warehouseId: stock.warehouse.id,
      warehouseName: stock.warehouse.name,
      warehouseLocation: stock.warehouse.location,
      totalUnits: stock.totalUnits,
      reservedUnits: stock.reservedUnits,
      availableUnits: stock.totalUnits - stock.reservedUnits,
    })),
  }));

  return (
    <div className="space-y-10">
      {/* Auto-refresher client component */}
      <RefreshWrapper />

      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-100">Available Products</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Reserve items before checkout — holds last 10 minutes.
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-primary/20 bg-primary/5 self-start">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-xs font-semibold text-primary uppercase tracking-wider">Stock is live</span>
        </div>
      </div>

      {/* Product Grid (Client Wrapper for Interactive Modal bindings) */}
      <ProductGrid products={formattedProducts} />
    </div>
  );
}
