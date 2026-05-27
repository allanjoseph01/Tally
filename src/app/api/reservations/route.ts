import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/db";
import redis from "../../../lib/redis";
import { ReservationRequestSchema, ReservationResponseSchema } from "../../../lib/schemas";

export async function POST(request: NextRequest) {
  // Read "idempotency-key" from request headers (HTTP headers are case-insensitive)
  const idempotencyKey = request.headers.get("idempotency-key");

  try {
    // 1. IDEMPOTENCY CHECK
    if (idempotencyKey) {
      const cached = await redis.get<{ status: number; body: unknown }>(`idem:${idempotencyKey}`);
      if (cached) {
        return NextResponse.json(cached.body, { status: cached.status });
      }
    }

    // 2. VALIDATE INPUT
    const body = await request.json().catch(() => ({}));
    const validation = ReservationRequestSchema.safeParse(body);
    if (!validation.success) {
      const errorMsg = validation.error.issues[0]?.message || "Invalid validation error";
      const errorResponse = { error: errorMsg };
      
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
        await redis.set(
          `idem:${idempotencyKey}`,
          { status: 201, body: responseData },
          { ex: 3600 }
        );
      }

      // 6. Return 201
      return NextResponse.json(responseData, { status: 201 });

    } catch (txError: any) {
      if (txError.message === "INSUFFICIENT_STOCK") {
        const errorResponse = {
          error: "Not enough stock available",
          code: "INSUFFICIENT_STOCK",
        };
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



// GET Handler to return the last 50 reservations ordered by createdAt desc
export async function GET() {
  try {
    const reservations = await prisma.reservation.findMany({
      take: 50,
      orderBy: {
        createdAt: "desc",
      },
      include: {
        stock: {
          include: {
            product: true,
            warehouse: true,
          },
        },
      },
    });

    const formatted = reservations.map((res) => ({
      id: res.id,
      stockId: res.stockId,
      quantity: res.quantity,
      status: res.status,
      expiresAt: res.expiresAt.toISOString(),
      createdAt: res.createdAt.toISOString(),
      updatedAt: res.updatedAt.toISOString(),
      product: {
        id: res.stock.product.id,
        name: res.stock.product.name,
        sku: res.stock.product.sku,
      },
      warehouse: {
        id: res.stock.warehouse.id,
        name: res.stock.warehouse.name,
        location: res.stock.warehouse.location,
      },
    }));

    return NextResponse.json(formatted, { status: 200 });
  } catch (error: any) {
    console.error("GET reservations list failed:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch reservations" },
      { status: 500 }
    );
  }
}
