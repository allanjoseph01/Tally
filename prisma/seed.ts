import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import "dotenv/config";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Starting database seeding...");

  // Data declarations
  const warehousesData = [
    { name: "Mumbai Central", location: "Dharavi, Mumbai" },
    { name: "Delhi North Hub", location: "Rohini, New Delhi" },
    { name: "Bangalore South", location: "Electronic City, Bengaluru" },
  ];

  const productsData = [
    {
      name: "Noise-Cancelling Headphones Pro",
      sku: "NCH-PRO-001",
      description: "Premium active noise-cancelling over-ear headphones with high-fidelity sound.",
      imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=60",
    },
    {
      name: "Mechanical Keyboard TKL",
      sku: "MKB-TKL-002",
      description: "Tenkeyless mechanical keyboard with hot-swappable tactile switches and RGB backlighting.",
      imageUrl: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500&auto=format&fit=crop&q=60",
    },
    {
      name: "USB-C Hub 7-in-1",
      sku: "UCH-7N1-003",
      description: "Aluminium multi-port adapter featuring 4K HDMI, USB-C Power Delivery, SD/TF card reader, and USB 3.0 ports.",
      imageUrl: "https://images.unsplash.com/photo-1468495244123-6c6c332eeece?w=500&auto=format&fit=crop&q=60",
    },
    {
      name: "Wireless Charging Pad",
      sku: "WCP-15W-004",
      description: "15W fast wireless charging pad with Qi certification and intelligent temperature control.",
      imageUrl: "https://images.unsplash.com/photo-1622445262465-2481c4574875?w=500&auto=format&fit=crop&q=60",
    },
    {
      name: "Laptop Stand Aluminium",
      sku: "LSA-ADJ-005",
      description: "Ergonomic adjustable aluminium laptop riser with non-slip silicone pads.",
      imageUrl: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=500&auto=format&fit=crop&q=60",
    },
  ];

  // Run all inserts and deletes in a single, safe transaction
  await prisma.$transaction(async (tx) => {
    console.log("Cleaning up existing data...");
    await tx.reservation.deleteMany();
    await tx.stock.deleteMany();
    await tx.product.deleteMany();
    await tx.warehouse.deleteMany();
    await tx.idempotencyKey.deleteMany();

    console.log("Inserting warehouses...");
    const warehouses = await Promise.all(
      warehousesData.map((w) => tx.warehouse.create({ data: w }))
    );

    console.log("Inserting products...");
    const products = await Promise.all(
      productsData.map((p) => tx.product.create({ data: p }))
    );

    // Map entities for precise identification in stock creations
    const mumbai = warehouses.find((w) => w.name === "Mumbai Central")!;
    const delhi = warehouses.find((w) => w.name === "Delhi North Hub")!;
    const bangalore = warehouses.find((w) => w.name === "Bangalore South")!;

    const headphones = products.find((p) => p.sku === "NCH-PRO-001")!;
    const keyboard = products.find((p) => p.sku === "MKB-TKL-002")!;
    const hub = products.find((p) => p.sku === "UCH-7N1-003")!;
    const pad = products.find((p) => p.sku === "WCP-15W-004")!;
    const stand = products.find((p) => p.sku === "LSA-ADJ-005")!;

    console.log("Creating stock entries with varied quantities...");
    
    // Product 1: Noise-Cancelling Headphones Pro
    // - Mumbai Central: exactly 1 unit (compelling race condition demo!)
    // - Delhi North Hub: 15 units
    // - Bangalore South: 20 units
    await tx.stock.create({
      data: { productId: headphones.id, warehouseId: mumbai.id, totalUnits: 1, reservedUnits: 0 },
    });
    await tx.stock.create({
      data: { productId: headphones.id, warehouseId: delhi.id, totalUnits: 15, reservedUnits: 0 },
    });
    await tx.stock.create({
      data: { productId: headphones.id, warehouseId: bangalore.id, totalUnits: 20, reservedUnits: 0 },
    });

    // Product 2: Mechanical Keyboard TKL
    // - Mumbai Central: 10 units
    // - Delhi North Hub: exactly 1 unit (second compelling race condition demo!)
    // - Bangalore South: 12 units
    await tx.stock.create({
      data: { productId: keyboard.id, warehouseId: mumbai.id, totalUnits: 10, reservedUnits: 0 },
    });
    await tx.stock.create({
      data: { productId: keyboard.id, warehouseId: delhi.id, totalUnits: 1, reservedUnits: 0 },
    });
    await tx.stock.create({
      data: { productId: keyboard.id, warehouseId: bangalore.id, totalUnits: 12, reservedUnits: 0 },
    });

    // Product 3: USB-C Hub 7-in-1
    // - Mumbai Central: 5 units
    // - Delhi North Hub: 8 units
    // - Bangalore South: 2 units (low stock demo)
    await tx.stock.create({
      data: { productId: hub.id, warehouseId: mumbai.id, totalUnits: 5, reservedUnits: 0 },
    });
    await tx.stock.create({
      data: { productId: hub.id, warehouseId: delhi.id, totalUnits: 8, reservedUnits: 0 },
    });
    await tx.stock.create({
      data: { productId: hub.id, warehouseId: bangalore.id, totalUnits: 2, reservedUnits: 0 },
    });

    // Product 4: Wireless Charging Pad
    // - Mumbai Central: 30 units
    // - Delhi North Hub: 2 units (low stock demo)
    // - Bangalore South: 25 units
    await tx.stock.create({
      data: { productId: pad.id, warehouseId: mumbai.id, totalUnits: 30, reservedUnits: 0 },
    });
    await tx.stock.create({
      data: { productId: pad.id, warehouseId: delhi.id, totalUnits: 2, reservedUnits: 0 },
    });
    await tx.stock.create({
      data: { productId: pad.id, warehouseId: bangalore.id, totalUnits: 25, reservedUnits: 0 },
    });

    // Product 5: Laptop Stand Aluminium
    // - Mumbai Central: 4 units
    // - Delhi North Hub: 50 units
    // - Bangalore South: 3 units (low stock demo)
    await tx.stock.create({
      data: { productId: stand.id, warehouseId: mumbai.id, totalUnits: 4, reservedUnits: 0 },
    });
    await tx.stock.create({
      data: { productId: stand.id, warehouseId: delhi.id, totalUnits: 50, reservedUnits: 0 },
    });
    await tx.stock.create({
      data: { productId: stand.id, warehouseId: bangalore.id, totalUnits: 3, reservedUnits: 0 },
    });

    console.log("Seeding transaction completed successfully.");
  });

  console.log("Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error("Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
