# Tally
> An active inventory reservation platform that holds stock at checkout, confirms holds on payment, and auto-releases holds on expiration or cancellations. Built to handle massive concurrent traffic with absolute data consistency.

## Live Demo
**[Tally Live Deployment](https://tally-tool.netlify.app)**  
**[Tally End-to-End Demo Video](https://drive.google.com/file/d/1yz032tlt3wgABZu6u3MQAOlQpHCNuy3M/view?usp=sharing)**
*The platform is pre-loaded with seed data. You can test the end-to-end checkout reservation flow, view the real-time activity ledger, and run the concurrency demo to see the atomic UPDATE guarantee in action.*

---

## The Problem
In modern e-commerce systems, inventory management during high-traffic flash sales presents a classic concurrency challenge. When a customer initiates the checkout process, payment gateways typically take anywhere from 30 seconds to several minutes to process the transaction. If inventory is only decremented *after* payment succeeds, a high volume of concurrent shoppers can purchase the same remaining stock, leading to **overselling** (selling items you do not physically have), which ruins customer trust.

Conversely, decrementing stock the moment an item is added to the cart is highly susceptible to **phantom stockouts**. Since cart abandonment rates average around 70-80%, blocking stock for idle carts causes items to appear "Out of Stock" to serious buyers when they are actually sitting abandoned in carts. 

**Tally solves this with temporary inventory holds**. The moment a checkout starts, the system locks the requested quantity for exactly 10 minutes. If the payment succeeds, the hold is confirmed and stock is permanently reduced. If the hold expires or the customer cancels, the stock is immediately returned to the available pool.

---

## The Core Technical Decision

### Atomic SQL UPDATE with Conditional Guards
To ensure absolute data consistency under concurrent request spikes, Tally rejects application-level checks. Running a standard `SELECT` query in Node.js to check stock, evaluating it in Javascript, and then executing an `UPDATE` to reserve it creates a **race condition window** between the read and write operations.

Tally solves this by executing a single **atomic SQL UPDATE statement containing a conditional WHERE guard** directly inside a PostgreSQL transaction:

```sql
UPDATE "Stock"
SET "reservedUnits" = "reservedUnits" + ${quantity}
WHERE "id" = ${stockId}
AND ("totalUnits" - "reservedUnits") >= ${quantity}
```

### Why This is Correct Under Concurrency
1. **Database Row Locks**: When an `UPDATE` statement executes in PostgreSQL, the database engine automatically acquires an **exclusive row-level write lock** on the matching row.
2. **Immediate Evaluation**: If two concurrent checkouts hit the server at the exact same millisecond, PostgreSQL serializes their executions. The first transaction acquires the write lock, decrements availability, and updates the row.
3. **The WHERE Condition Guard**: When the second transaction gets its turn on the lock, it re-evaluates the `WHERE` condition. If the first transaction took the last unit, the condition `("totalUnits" - "reservedUnits") >= quantity` resolves to `false`.
4. **Guaranteed 409 Conflict**: Because the update criteria are no longer met, the query executes but modifies `0` rows. In Prisma, this returns an `executeRaw` count of `0`. The application detects this row count instantly, rolls back the transaction, and returns a `409 Conflict` to the user with no data corruption.

### Why this is superior to `SELECT ... FOR UPDATE`
While `SELECT ... FOR UPDATE` is a valid way to lock rows, it **blocks all read operations** on that row for the duration of the transaction. In a flash sale, thousands of users are continuously reading stock levels. Blocking those reads degrades read throughput and results in high latency.

Tally's atomic `UPDATE` approach performs a optimistic-like lock on writes while **allowing completely non-blocking, concurrent reads**. This maximizes system throughput while guaranteeing perfect data consistency.

---

## How Expiry Works in Production

Two-layer hybrid approach:

**Layer 1 — Lazy cleanup on read (immediate correctness)**  
Every call to GET /api/products runs a cleanup query first —
any PENDING reservation past its expiresAt is immediately 
set to RELEASED and its reservedUnits are returned to available stock.
This means stock counts are always accurate the moment a user 
loads the product page, with zero delay.

**Layer 2 — cron-job.org scheduled job (background janitor)**  
An external cron via cron-job.org hits 
GET /api/cron/expire-reservations every minute.
This cleans up expired reservations that no one ever reads —
for example, a user who reserved and then closed their browser.
The endpoint is protected with a Bearer token via the 
Authorization header so it cannot be triggered by anyone else.

Why not Vercel Cron?
Vercel's free tier does not support cron jobs. The app is deployed 
on Netlify. cron-job.org provides equivalent functionality 
for free with no infrastructure overhead.

---

## Idempotency
To prevent double-charging or duplicate reservations caused by network retries or users double-clicking submit buttons, Tally implements **Idempotency Protection** on all mutation endpoints (`/api/reservations`, `/api/reservations/[id]/confirm`).

### The Design
1. The client generates a unique UUID (an `Idempotency-Key`) in the browser and attaches it as an HTTP header.
2. The server checks Redis for the key (`idem:{key}`). If found, it instantly returns the cached status code and response payload without executing any database side effects. Keys are stored with a 1-hour TTL — Redis handles expiry automatically, no cleanup job needed.
3. If the key is new, the server processes the transaction, caches the resulting HTTP status and JSON response body, and serves the request.

### Example cURL Request
```bash
curl -X POST https://tally-tool.netlify.app/api/reservations \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: c81b3793-bc42-4fcf-b7d6-3e8df3cc4d10" \
  -d '{
    "productId": "cm1vwpx400000wb5tnzc36uq1",
    "warehouseId": "cm1vwpx400000wb5tnzc36uq2",
    "quantity": 1
  }'
```

---

## Running Locally

### Prerequisites
- Node.js (v20+ recommended)
- A PostgreSQL database instance (local or hosted, e.g., Neon)

### Step 1: Clone and Install
```bash
git clone https://github.com/allanjoseph01/Tally.git
cd Tally
npm install
```

### Step 2: Configure Environment
Create a `.env` file in the root directory:
```env
DATABASE_URL="postgresql://username:password@localhost:5432/tally?sslmode=require"
UPSTASH_REDIS_REST_URL="https://your-redis-url.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-redis-token"
CRON_SECRET="your-local-cron-secret-12345"
```

#### Environment Variables Reference

| Environment Variable | Description |
| :--- | :--- |
| **DATABASE_URL** | Connection string for your PostgreSQL database (e.g., Neon). |
| **UPSTASH_REDIS_REST_URL** | REST URL for the serverless Upstash Redis instance (for rate limiting). |
| **UPSTASH_REDIS_REST_TOKEN** | REST active token for Upstash Redis. |
| **CRON_SECRET** | Bearer token that protects the expiry endpoint. Must match the Authorization header configured in cron-job.org. |

### Step 3: Push Database Schema
Apply the schema directly to your Postgres database:
```bash
npx prisma db push
```

### Step 4: Seed the Database
Seed the PostgreSQL database with the required mock warehouses, products, and low stock counts (including the exact 1-unit race condition targets):
```bash
npx prisma db seed
```

### Step 5: Start Development Server
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser to view the application.

---

## Deploying to Netlify

To deploy Tally to Netlify:

1. **Configure Environment Variables** in the Netlify UI under **Site settings > Environment variables**:
   - `DATABASE_URL` — Connection string for your PostgreSQL database (e.g., Neon).
   - `UPSTASH_REDIS_REST_URL` — REST URL for serverless Upstash Redis instance (for idempotency key caching).
   - `UPSTASH_REDIS_REST_TOKEN` — REST token for serverless Redis.
   - `CRON_SECRET` — Bearer token that protects the expiry endpoint. Must match the Authorization header configured in cron-job.org.
2. Netlify will build and deploy the Next.js app using `@netlify/plugin-nextjs`.
3. Set up a cron job on [cron-job.org](https://cron-job.org) pointing to your deployment's `/api/cron/expire-reservations` route, running every minute, with an `Authorization` header set to `Bearer <your-cron-secret>`.

---

## Architecture Decisions & Trade-offs

If given more development time, the following production features would be prioritized:

*   **Distributed Locking with Redis (Redlock)**: While the atomic UPDATE approach guarantees correctness at the single-database level, a multi-region deployment with read replicas would require distributed coordination. Offloading this to an in-memory Redis cluster using the Redlock pattern would allow Tally to scale to millions of concurrent checkout requests across regions without relying solely on PostgreSQL row contention.
*   **WebSockets / SSE for Real-time Stock Pushes**: Currently, the homepage polls the server using Next.js router refreshes every 30 seconds. Implementing Server-Sent Events (SSE) or WebSockets would allow Tally to push stock updates and reservations immediately to all active clients, providing a truly live, interactive inventory map.
*   **Comprehensive Concurrency Integration Testing**: Writing automated integration tests using libraries like `artillery` or custom worker threads to fire 100+ concurrent requests at exactly the same millisecond to verify that database row counts never drop below 0.
*   **Webhook notifications**: Triggering webhooks on stock changes so external warehouse dispatch systems are notified the split-second a hold transitions to `CONFIRMED` or is `RELEASED`.

---

## Technical Stack

| Technology | Purpose |
| :--- | :--- |
| **Next.js 16** | Core application framework (React 19 App Router) |
| **Prisma v7** | WASM/TypeScript Object-Relational Mapper (ORM) |
| **PostgreSQL (Neon)** | Serverless Postgres database with row-level transaction controls |
| **Tailwind CSS v4** | Modern utility-first CSS design system |
| **Upstash Redis** | Serverless HTTP REST Redis client |
| **Zod** | Runtime schema validation and TypeScript type inference |
| **Lucide React** | Premium icon library |
| **Date-fns** | High-performance date and relative duration formatting |