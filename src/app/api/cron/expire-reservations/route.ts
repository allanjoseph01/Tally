import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";

export async function GET(request: NextRequest) {
  // 1. VERIFY CRON AUTHORIZATION SECRET
  const authHeader = request.headers.get("authorization");
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET || authHeader !== expectedAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 2. FIND ALL EXPIRED PENDING RESERVATIONS
    const expiredReservations = await prisma.reservation.findMany({
      where: {
        status: "PENDING",
        expiresAt: { lt: new Date() },
      },
    });

    // 3. ATOMIC RELEASE TRANSACTION FOR EACH RECORD
    if (expiredReservations.length > 0) {
      await prisma.$transaction(async (tx) => {
        for (const res of expiredReservations) {
          // Set status to RELEASED
          await tx.reservation.update({
            where: { id: res.id },
            data: { status: "RELEASED" },
          });

          // Decrement Stock.reservedUnits by reservation.quantity
          await tx.stock.update({
            where: { id: res.stockId },
            data: {
              reservedUnits: { decrement: res.quantity },
            },
          });
        }
      });
    }

    // 4. RETURN SUCCESS STATS
    return NextResponse.json(
      {
        expired: expiredReservations.length,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Cron reservation expiry failed:", error);
    return NextResponse.json(
      { error: error.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
