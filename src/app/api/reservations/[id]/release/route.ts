import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/db";
import { ReservationResponseSchema } from "../../../../../lib/schemas";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const { id } = await params;

  try {
    // 1. FIND RESERVATION BY ID
    const reservation = await prisma.reservation.findUnique({
      where: { id },
    });

    if (!reservation) {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    }

    // 2. CHECK STATUS (MUST BE PENDING)
    if (reservation.status !== "PENDING") {
      return NextResponse.json(
        { error: "Reservation is not in a releasable state" },
        { status: 409 }
      );
    }

    // 3. ATOMIC RELEASE TRANSACTION
    const responseData = await prisma.$transaction(async (tx) => {
      // a. Update reservation status to RELEASED
      await tx.reservation.update({
        where: { id },
        data: { status: "RELEASED" },
      });

      // b. Decrement Stock.reservedUnits by reservation.quantity
      await tx.stock.update({
        where: { id: reservation.stockId },
        data: {
          reservedUnits: { decrement: reservation.quantity },
        },
      });

      // Fetch relation data to format exact schema response
      const fullReservation = await tx.reservation.findUnique({
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
        throw new Error("FAILED_TO_LOAD_RELEASED_RESERVATION");
      }

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

      // Validate structure at runtime
      return ReservationResponseSchema.parse(data);
    });

    // 4. Return 200 with updated reservation
    return NextResponse.json(responseData, { status: 200 });

  } catch (error: any) {
    console.error("Release reservation handler error:", error);
    const errorResponse = {
      error: error.message || "An unexpected error occurred",
      code: "INTERNAL_SERVER_ERROR",
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
