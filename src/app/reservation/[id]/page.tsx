import { notFound } from "next/navigation";
import { prisma } from "../../../lib/db";
import ReservationClient from "./ReservationClient";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }> | { id: string };
}

export default async function ReservationPage({ params }: PageProps) {
  const { id } = await params;

  // Query database server-side to load reservation details and map relationships
  const reservation = await prisma.reservation.findUnique({
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

  if (!reservation) {
    notFound();
  }

  // Map to clean serialize-friendly structure
  const formattedReservation = {
    id: reservation.id,
    stockId: reservation.stockId,
    quantity: reservation.quantity,
    status: reservation.status,
    expiresAt: reservation.expiresAt.toISOString(),
    createdAt: reservation.createdAt.toISOString(),
    product: {
      id: reservation.stock.product.id,
      name: reservation.stock.product.name,
      sku: reservation.stock.product.sku,
    },
    warehouse: {
      id: reservation.stock.warehouse.id,
      name: reservation.stock.warehouse.name,
      location: reservation.stock.warehouse.location,
    },
    stock: {
      totalUnits: reservation.stock.totalUnits,
      reservedUnits: reservation.stock.reservedUnits,
    },
  };

  return <ReservationClient reservation={formattedReservation} />;
}
