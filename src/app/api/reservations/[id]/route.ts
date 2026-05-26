import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";
import { ReservationResponseSchema } from "../../../../lib/schemas";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const { id } = await params;

  try {
    // Find unique reservation and eagerly fetch nested product/warehouse metadata
    const fullReservation = await prisma.reservation.findUnique({
      where: { id },
      include: {
        stock: {
          include: {
            product: true,
            warehouse: true,
          },
        },
      },
    });

    if (!fullReservation) {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    }

    // Map database properties to exactly match the Zod Response Schema
    const data = {
      id: fullReservation.id,
      stockId: fullReservation.stockId,
      quantity: fullReservation.quantity,
      status: fullReservation.status,
      expiresAt: fullReservation.expiresAt.toISOString(),
      createdAt: fullReservation.createdAt.toISOString(),
      product: {
        id: fullReservation.stock.product.id,
        name: fullReservation.stock.product.name,
        sku: fullReservation.stock.product.sku,
      },
      warehouse: {
        id: fullReservation.stock.warehouse.id,
        name: fullReservation.stock.warehouse.name,
        location: fullReservation.stock.warehouse.location,
      },
      stock: {
        totalUnits: fullReservation.stock.totalUnits,
        reservedUnits: fullReservation.stock.reservedUnits,
      },
    };

    return NextResponse.json(ReservationResponseSchema.parse(data), { status: 200 });
  } catch (error: any) {
    console.error(`Failed to GET reservation ${id}:`, error);
    return NextResponse.json(
      { error: error.message || "Failed to retrieve reservation details" },
      { status: 500 }
    );
  }
}
