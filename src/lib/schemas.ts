import { z } from "zod";

// Export Reservation TTL Constant (10 minutes)
export const RESERVATION_TTL_MS = 10 * 60 * 1000;

// 1. ReservationRequestSchema
export const ReservationRequestSchema = z.object({
  productId: z.string().min(1, "Product ID must not be empty"),
  warehouseId: z.string().min(1, "Warehouse ID must not be empty"),
  quantity: z
    .number()
    .int("Quantity must be an integer")
    .min(1, "Quantity must be at least 1")
    .max(10, "Quantity cannot exceed 10"),
});

// Inferred TypeScript Type
export type ReservationRequest = z.infer<typeof ReservationRequestSchema>;

// 2. ReservationResponseSchema
export const ReservationResponseSchema = z.object({
  id: z.string().cuid(),
  stockId: z.string().cuid(),
  quantity: z.number().int().min(1),
  status: z.enum(["PENDING", "CONFIRMED", "RELEASED"]),
  expiresAt: z.string().datetime({ message: "expiresAt must be a valid ISO datetime string" }),
  createdAt: z.string().datetime({ message: "createdAt must be a valid ISO datetime string" }),
  product: z.object({
    id: z.string().cuid(),
    name: z.string(),
    sku: z.string(),
  }),
  warehouse: z.object({
    id: z.string().cuid(),
    name: z.string(),
    location: z.string(),
  }),
  stock: z.object({
    totalUnits: z.number().int(),
    reservedUnits: z.number().int(),
  }),
});

// Inferred TypeScript Type
export type ReservationResponse = z.infer<typeof ReservationResponseSchema>;

// 3. ApiErrorSchema
export const ApiErrorSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
});

// Inferred TypeScript Type
export type ApiError = z.infer<typeof ApiErrorSchema>;
