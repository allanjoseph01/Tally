import { prisma } from "../../lib/db";
import DemoClient from "../../components/DemoClient";

export const dynamic = "force-dynamic";

export default async function DemoPage() {
  // Query all stock records from the database
  const stocks = await prisma.stock.findMany({
    include: {
      product: true,
      warehouse: true,
    },
  });

  // Map database structures to serializable UI records
  const combos = stocks.map((s) => ({
    stockId: s.id,
    productId: s.productId,
    productName: s.product.name,
    sku: s.product.sku,
    warehouseId: s.warehouseId,
    warehouseName: s.warehouse.name,
    warehouseLocation: s.warehouse.location,
    availableUnits: s.totalUnits - s.reservedUnits,
  }));

  // Filter only product-warehouse combinations with exactly 1 unit available
  const activeCombos = combos.filter((c) => c.availableUnits === 1);

  return <DemoClient combos={activeCombos} />;
}
