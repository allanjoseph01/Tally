## The Problem I'm Solving

When a customer hits checkout, payment can take several minutes.
During that window, two customers can pay for the same physical unit.

Decrementing at add-to-cart causes phantom stockouts (80% carts abandoned).
Decrementing at payment causes overselling.

The solution: a timed reservation — hold units at checkout start,
confirm on payment success, auto-release on timeout or failure.

## The Core Technical Challenge

Two simultaneous requests for the last unit of a SKU.
Exactly one must succeed. The other must get a 409.

My approach: a single atomic SQL UPDATE with a WHERE guard —
no explicit locks, no application-level race window.

UPDATE stock
SET reserved_units = reserved_units + qty
WHERE product_id = $pid
  AND (total_units - reserved_units) >= qty
RETURNING *;

If rowCount === 0 → 409. One round trip. Correct by construction.