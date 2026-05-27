import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import Razorpay from "razorpay";
import { prisma } from "../../../../lib/db";

// 1. Define Request Body Validation Schema
const CreateOrderSchema = z.object({
  reservationId: z.string().min(1),
  amount: z.number().int().positive(), // in paise
});

export async function POST(request: NextRequest) {
  try {
    // 2. Validate request body
    const body = await request.json();
    const parseResult = CreateOrderSchema.safeParse(body);
    
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request payload", details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { reservationId, amount } = parseResult.data;

    // 3. Find the reservation in database
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
    });

    if (!reservation) {
      return NextResponse.json(
        { error: "Reservation not found" },
        { status: 404 }
      );
    }

    // 4. Validate active status
    if (reservation.status !== "PENDING") {
      return NextResponse.json(
        { error: "Reservation is not active" },
        { status: 409 }
      );
    }

    // 5. Validate expiration window
    if (reservation.expiresAt < new Date()) {
      // Clean up expired hold atomically if needed
      await prisma.$transaction(async (tx) => {
        await tx.reservation.update({
          where: { id: reservationId },
          data: { status: "RELEASED" },
        });

        await tx.stock.update({
          where: { id: reservation.stockId },
          data: {
            reservedUnits: { decrement: reservation.quantity },
          },
        });
      });

      return NextResponse.json(
        { error: "Reservation has expired", code: "RESERVATION_EXPIRED" },
        { status: 410 }
      );
    }

    // 6. Create Razorpay Order instance
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });

    const order = await razorpay.orders.create({
      amount: amount,
      currency: "INR",
      receipt: reservationId,
      notes: {
        reservationId: reservationId,
      },
    });

    // 7. Return 200 with order info
    return NextResponse.json(
      {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error("Create Razorpay order route error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create payment order" },
      { status: 500 }
    );
  }
}
