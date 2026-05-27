import { NextRequest, NextResponse } from "next/server";
import redis from "../../../../../lib/redis";
import { confirmReservation } from "../../../../../lib/confirmReservation";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const { id } = await params;
  const idempotencyKey = request.headers.get("idempotency-key");

  try {
    // 1. IDEMPOTENCY CHECK
    if (idempotencyKey) {
      const cached = await redis.get<{ status: number; body: unknown }>(`idem:${idempotencyKey}`);
      if (cached) {
        return NextResponse.json(cached.body, { status: cached.status });
      }
    }

    // 2. RUN REUSABLE CONFIRMATION LOGIC
    const result = await confirmReservation(id);

    if (!result.success) {
      const errorResponse = {
        error: result.error,
        code: (result as any).code || undefined,
      };
      return NextResponse.json(errorResponse, { status: result.status });
    }

    // 3. SAVE IDEMPOTENCY KEY (Success)
    if (idempotencyKey) {
      await redis.set(
        `idem:${idempotencyKey}`,
        { status: 200, body: result.data },
        { ex: 3600 }
      );
    }

    // Return 200 with updated reservation
    return NextResponse.json(result.data, { status: 200 });

  } catch (error: any) {
    console.error("Confirm reservation handler error:", error);
    const errorResponse = {
      error: error.message || "An unexpected error occurred",
      code: "INTERNAL_SERVER_ERROR",
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
