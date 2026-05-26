import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/db";
import { ReservationResponseSchema } from "../../../../../lib/schemas";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const { id } = await params;
  const idempotencyKey = request.headers.get("idempotency-key");

  try {
    // 1. IDEMPOTENCY CHECK
    if (idempotencyKey) {
      const existingKey = await prisma.idempotencyKey.findUnique({
        where: { key: idempotencyKey },
      });

      if (existingKey) {
        try {
          const body = JSON.parse(existingKey.responseBody);
          return NextResponse.json(body, { status: existingKey.responseStatus });
        } catch (e) {
          return new NextResponse(existingKey.responseBody, {
            status: existingKey.responseStatus,
            headers: { "Content-Type": "application/json" },
          });
        }
      }
    }

    // 2. FIND RESERVATION BY ID
    const reservation = await prisma.reservation.findUnique({
      where: { id },
    });

    if (!reservation) {
      const errorResponse = { error: "Reservation not found" };
      if (idempotencyKey) {
        await saveIdempotency(idempotencyKey, 404, errorResponse);
      }
      return NextResponse.json(errorResponse, { status: 404 });
    }

    // 3. CHECK FOR EXPIRATION
    if (reservation.expiresAt < new Date()) {
      // If status is still PENDING, atomically release the stock hold
      if (reservation.status === "PENDING") {
        await prisma.$transaction(async (tx) => {
          await tx.reservation.update({
            where: { id },
            data: { status: "RELEASED" },
          });

          await tx.stock.update({
            where: { id: reservation.stockId },
            data: {
              reservedUnits: { decrement: reservation.quantity },
            },
          });
        });
      }

      const errorResponse = {
        error: "Reservation has expired",
        code: "RESERVATION_EXPIRED",
      };
      
      if (idempotencyKey) {
        await saveIdempotency(idempotencyKey, 410, errorResponse);
      }
      return NextResponse.json(errorResponse, { status: 410 });
    }

    // 4. CHECK STATS (MUST BE PENDING)
    if (reservation.status !== "PENDING") {
      const errorResponse = { error: "Reservation is not in a confirmable state" };
      if (idempotencyKey) {
        await saveIdempotency(idempotencyKey, 409, errorResponse);
      }
      return NextResponse.json(errorResponse, { status: 409 });
    }

    // 5. ATOMIC SALE TRANSACTION
    const responseData = await prisma.$transaction(async (tx) => {
      // a. Update reservation status to CONFIRMED
      await tx.reservation.update({
        where: { id },
        data: { status: "CONFIRMED" },
      });

      // b. Decrement Stock.reservedUnits by reservation.quantity
      // c. Update Stock.totalUnits -= quantity to reflect permanent sale
      await tx.stock.update({
        where: { id: reservation.stockId },
        data: {
          reservedUnits: { decrement: reservation.quantity },
          totalUnits: { decrement: reservation.quantity },
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
        throw new Error("FAILED_TO_LOAD_CONFIRMED_RESERVATION");
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

    // 6. SAVE IDEMPOTENCY KEY (Success)
    if (idempotencyKey) {
      await saveIdempotency(idempotencyKey, 200, responseData);
    }

    // Return 200 with updated reservation
    return NextResponse.json(responseData, { status: 200 });

  } catch (error: any) {
    console.error("Confirm reservation handler error:", error);
    const errorResponse = {
      error: error.message || "An unexpected error occurred",
      code: "INTERNAL_SERVER_ERROR",
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

// Graceful save idempotency helper
async function saveIdempotency(key: string, status: number, body: any) {
  try {
    await prisma.idempotencyKey.create({
      data: {
        key,
        responseStatus: status,
        responseBody: JSON.stringify(body),
      },
    });
  } catch (err) {
    console.error("Failed to save idempotency key:", err);
  }
}
