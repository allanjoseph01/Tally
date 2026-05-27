import { prisma } from "./db";
import { ReservationResponseSchema } from "./schemas";

export async function confirmReservation(id: string) {
  // 1. FIND RESERVATION BY ID
  const reservation = await prisma.reservation.findUnique({
    where: { id },
  });

  if (!reservation) {
    return {
      success: false,
      status: 404,
      error: "Reservation not found",
    };
  }

  // 2. CHECK FOR EXPIRATION
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

    return {
      success: false,
      status: 410,
      error: "Reservation has expired",
      code: "RESERVATION_EXPIRED",
    };
  }

  // 3. CHECK STATUS (MUST BE PENDING)
  if (reservation.status !== "PENDING") {
    return {
      success: false,
      status: 409,
      error: "Reservation is not in a confirmable state",
    };
  }

  // 4. ATOMIC SALE TRANSACTION
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

  return {
    success: true,
    status: 200,
    data: responseData,
  };
}
