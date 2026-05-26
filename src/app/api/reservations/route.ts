import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/db";
import { ReservationRequestSchema, ReservationResponseSchema } from "../../../lib/schemas";

export async function POST(request: NextRequest) {
  // Read "idempotency-key" from request headers (HTTP headers are case-insensitive)
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
          // Fallback if parsing ever fails for some reason
          return new NextResponse(existingKey.responseBody, {
            status: existingKey.responseStatus,
            headers: { "Content-Type": "application/json" },
          });
        }
      }
    }

    // 2. VALIDATE INPUT
    const body = await request.json().catch(() => ({}));
    const validation = ReservationRequestSchema.safeParse(body);
    if (!validation.success) {
      const errorMsg = validation.error.issues[0]?.message || "Invalid validation error";
      const errorResponse = { error: errorMsg };
      
      if (idempotencyKey) {
        await saveIdempotency(idempotencyKey, 400, errorResponse);
      }
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const { productId, warehouseId, quantity } = validation.data;

    // 3. FIND THE STOCK RECORD
    const stock = await prisma.stock.findUnique({
      where: {
        productId_warehouseId: { productId, warehouseId },
      },
    });

    if (!stock) {
      const errorResponse = { error: "Stock record not found" };
      if (idempotencyKey) {
        await saveIdempotency(idempotencyKey, 404, errorResponse);
      }
      return NextResponse.json(errorResponse, { status: 404 });
    }

    // 4. ATOMIC RESERVATION
    try {
      const responseData = await prisma.$transaction(async (tx) => {
        // Run atomic raw update to ensure we don't reserve more stock than is available
        // Quotation marks are required around "Stock" and "reservedUnits" in PostgreSQL due to mixed casing
        const count = await tx.$executeRaw`
          UPDATE "Stock"
          SET "reservedUnits" = "reservedUnits" + ${quantity}
          WHERE "id" = ${stock.id}
          AND ("totalUnits" - "reservedUnits") >= ${quantity}
        `;

        if (count === 0) {
          throw new Error("INSUFFICIENT_STOCK");
        }

        // Create the Reservation record
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
        const reservationRecord = await tx.reservation.create({
          data: {
            stockId: stock.id,
            quantity,
            status: "PENDING",
            expiresAt,
          },
        });

        // Fetch complete relation data to structure exact schema output
        const fullReservation = await tx.reservation.findUnique({
          where: { id: reservationRecord.id },
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
          throw new Error("FAILED_TO_LOAD_RESERVATION");
        }

        // Structure response to perfectly match Zod's ReservationResponseSchema
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

      // 5. IDEMPOTENCY SAVE (Success)
      if (idempotencyKey) {
        await saveIdempotency(idempotencyKey, 201, responseData);
      }

      // 6. Return 201
      return NextResponse.json(responseData, { status: 201 });

    } catch (txError: any) {
      if (txError.message === "INSUFFICIENT_STOCK") {
        const errorResponse = {
          error: "Not enough stock available",
          code: "INSUFFICIENT_STOCK",
        };
        if (idempotencyKey) {
          await saveIdempotency(idempotencyKey, 409, errorResponse);
        }
        return NextResponse.json(errorResponse, { status: 409 });
      }

      throw txError; // bubble up other query/syntax/network errors
    }

  } catch (error: any) {
    console.error("Reservation handler error:", error);
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
