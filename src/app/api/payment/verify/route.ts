import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { confirmReservation } from "../../../../lib/confirmReservation";

export async function POST(request: NextRequest) {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      reservationId,
    } = await request.json();

    // 1. Validate inputs presence
    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature ||
      !reservationId
    ) {
      return NextResponse.json(
        { error: "Missing required signature verification properties" },
        { status: 400 }
      );
    }

    // 2. Verify payment signature using HMAC SHA256
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return NextResponse.json(
        { error: "Invalid payment signature", code: "SIGNATURE_MISMATCH" },
        { status: 400 }
      );
    }

    // 3. Confirm reservation using the shared helper logic
    const confirmResult = await confirmReservation(reservationId);

    if (!confirmResult.success) {
      return NextResponse.json(
        {
          error: confirmResult.error,
          code: (confirmResult as any).code || undefined,
        },
        { status: confirmResult.status }
      );
    }

    // 4. Return 200 with confirmed reservation data and payment reference
    return NextResponse.json(
      {
        reservation: confirmResult.data,
        paymentId: razorpay_payment_id,
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error("Razorpay verification route error:", error);
    return NextResponse.json(
      { error: error.message || "Internal signature verification error" },
      { status: 500 }
    );
  }
}
