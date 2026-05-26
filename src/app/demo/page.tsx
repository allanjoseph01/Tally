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

  // Filter out completely sold-out combinations to ensure demonstration reliability
  const activeCombos = combos.filter((c) => c.availableUnits > 0);

  // Sort: Put combinations with exactly 1 unit available first in the list, followed by others
  const sortedCombos = activeCombos.sort((a, b) => {
    if (a.availableUnits === 1 && b.availableUnits !== 1) return -1;
    if (a.availableUnits !== 1 && b.availableUnits === 1) return 1;
    return a.availableUnits - b.availableUnits;
  });

  return <DemoClient combos={sortedCombos} />;
}
