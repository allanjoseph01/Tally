import { NextResponse } from "next/server";
import { prisma } from "../../../lib/db";

export async function GET() {
  try {
    // Retrieve all warehouses from the database ordered by name
    const warehouses = await prisma.warehouse.findMany({
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        location: true,
        createdAt: true,
      },
    });

    return NextResponse.json(warehouses, { status: 200 });
  } catch (error: any) {
    console.error("Failed to fetch warehouses:", error);
    return NextResponse.json(
      { error: error.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
