import { prisma } from "../lib/db";
import InventoryClient from "../components/InventoryClient";
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

  // 3. Query system-wide stats counts
  const activeHolds = await prisma.reservation.count({
    where: {
      status: "PENDING",
      expiresAt: {
        gt: new Date(),
      },
    },
  });

  const totalProducts = await prisma.product.count();
  const totalWarehouses = await prisma.warehouse.count();

  // 4. Fetch all warehouses ordered by name
  const warehouses = await prisma.warehouse.findMany({
    orderBy: {
      name: "asc",
    },
  });

  // 5. Fetch all products ordered by name and include stock levels mapped to their warehouses
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

  // 6. Format products and calculate available stock levels
  const formattedProducts = products.map((product) => ({
    id: product.id,
    name: product.name,
    sku: product.sku,
    description: product.description,
    imageUrl: product.imageUrl,
    createdAt: product.createdAt.toISOString(),
    stocks: product.stocks.map((stock) => ({
      warehouseId: stock.warehouse.id,
      warehouseName: stock.warehouse.name,
      warehouseLocation: stock.warehouse.location,
      totalUnits: stock.totalUnits,
      reservedUnits: stock.reservedUnits,
      availableUnits: stock.totalUnits - stock.reservedUnits,
    })),
  }));

  // 7. Format warehouses list
  const formattedWarehouses = warehouses.map((wh) => ({
    id: wh.id,
    name: wh.name,
    location: wh.location,
  }));

  return (
    <div className="w-full">
      {/* Auto-refresher client component (refreshes in background silently) */}
      <RefreshWrapper />

      {/* Main Interactive Inventory Dashboard */}
      <InventoryClient
        products={formattedProducts}
        warehouses={formattedWarehouses}
        activeHolds={activeHolds}
        totalProducts={totalProducts}
        totalWarehouses={totalWarehouses}
      />
    </div>
  );
}
