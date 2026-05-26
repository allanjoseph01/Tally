import { NextResponse } from "next/server";
import { prisma } from "../../../lib/db";

export async function GET() {
  try {
    // 1. Run lazy expiry cleanup of reservation holds atomically in the database
    // This guarantees that read operations always reflect the correct, current available stock counts.
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

    // 3. Retrieve all products ordered by name and include stock levels mapped to their warehouses
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

    // Format products and calculate available stock levels
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

    return NextResponse.json(formattedProducts, { status: 200 });
  } catch (error: any) {
    console.error("Failed to fetch products with stock levels:", error);
    return NextResponse.json(
      { error: error.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
