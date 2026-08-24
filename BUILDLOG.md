# BUILDLOG.md — AI Usage & Engineering Decision Log

This log documents the iterative engineering workflow, AI-assisted design choices, discovered bugs, corrections, and architecture rationale for the **FlyRank Embeddable Widget & Lead-Capture Platform**.

---

## 1. Project Initialization & Architecture Design
- **AI Recommendation**: Proposed a layered architecture: `HTTP Routes -> Controllers -> Services -> Repositories -> PostgreSQL`.
- **Decision Taken**: Accepted. Kept infrastructure layers (PostgreSQL access, Geo APIs, Notification adapters) abstracted behind services to allow swapping providers without modifying core domain logic.
- **Explicit Non-Goal**: Building a complex frontend SaaS dashboard or a visual drag-and-drop form builder. This is strictly a hardened backend capstone.

---

## 2. Multi-Tenant Schema & PostgreSQL Migrations
- **AI Recommendation**: Suggested using UUIDs for all primary keys with SQL migration scripts (`001_init_schema.sql`, `002_add_indexes.sql`).
- **Discovery / Issue**: Initial migration script included `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`. In modern PostgreSQL (and embedded PGlite WASM), `gen_random_uuid()` is built-in natively, whereas loading `uuid-ossp` raised an extension not found error.
- **Correction Applied**: Removed `uuid-ossp` extension dependency and used core PostgreSQL native `gen_random_uuid()` directly.
- **Discovered Issue with Path Ampersands**: On Windows, paths containing `&` caused native build failures in `bcrypt`. Switched to `bcryptjs` (pure JS, 100% API compatible) which builds and runs anywhere with zero native build dependencies.

---

## 3. Database Layer: Real Postgres + Embedded Fallback
- **Engineering Decision**: To allow anyone to clone the repo on any clean machine (even without a running Docker engine or PostgreSQL daemon), created an adaptive connection pool in `src/db/pool.js`:
  - When `DATABASE_URL` connects to real PostgreSQL, it uses standard `pg.Pool`.
  - When external Postgres is unreachable, it automatically and transparently boots `@electric-sql/pglite` (true PostgreSQL 16 compiled to WebAssembly) persisting to `./data/postgres_db`.
  - Added multi-statement `.exec(sql)` support for seamless migration execution.

---

## 4. Public Ingest Hardening & Security
- **Boundary Validation**: Implemented strict Zod schemas (`src/schemas/submission.schema.js`, `src/schemas/widget.schema.js`, `src/schemas/auth.schema.js`) returning standardized 400 JSON errors.
- **Oversized Request Protection**: Express body parser configured with `limit: '10kb'` to immediately return `413 Payload Too Large`.
- **Honeypot Spam Defense**: Embedded an invisible form field `_hp_website` in `widget.v1.js`. Legitimate users leave it empty; automated bot scrapers fill it out. When non-empty, the backend immediately rejects with `400 SPAM_DETECTED`.
- **Rate Limiting**: Configured `express-rate-limit` with IP-based sliding windows returning `429 Too Many Requests` with `Retry-After` headers.

---

## 5. Geo-Enrichment Fallback Chain & Graceful Degradation
- **Design Pattern**:
  1. Primary Provider: `ip-api.com` (1.5s timeout via `AbortController`).
  2. Fallback Provider: `ipapi.co` (1.5s timeout via `AbortController`).
  3. If both fail or time out: Degrades gracefully, logs warning, and persists the submission with `geo_country = null`.
- **Rule**: *"Non-critical failures must never break the main path."*
- **Testing**: Built deterministic mock providers in `tests/geoFallback.test.js` to simulate Provider A failure, Provider B success, and all-provider downtime without depending on real internet flaky connections.

---

## 6. Background Job Queue & Outbox Worker
- **Pattern**: Implemented PostgreSQL-backed background job queue in `background_jobs` table.
- **Asynchronous Decoupling**: When a lead arrives, the submission is stored in the database transaction and a job is enqueued with status `PENDING`. The HTTP request returns `201 Created` immediately.
- **Worker Behavior**:
  - Worker atomically claims pending jobs with `FOR UPDATE SKIP LOCKED`.
  - Dispatches `NotificationService` (Mailpit / Console).
  - Handles retries with exponential backoff on transient errors.
  - Marks `FAILED` after reaching `max_attempts` (3) and alerts via log.
  - Failures in notifications **never** rollback or break stored submissions.

---

## 7. Testing Strategy & Concurrency Discovery
- **Vitest Concurrency Issue**: When Vitest ran 11 test files concurrently across multiple worker processes, parallel processes attempted to acquire file locks on the same embedded database directory.
- **Correction Applied**: Created `vitest.config.js` with `fileParallelism: false` to ensure test suites run sequentially in a single process.
- **Result**: 11 test files, 44 unit and integration tests passing with 100% green status.

---

## 8. Summary of AI Contributions & Human Verification
| Feature Area | AI Proposed | Mistakes / Adjustments Made | Final Verified State |
| :--- | :--- | :--- | :--- |
| **Auth & Tenancy** | JWT + bcrypt | `bcrypt` build issue on paths with `&` -> replaced with `bcryptjs` | Fully isolated multi-tenant CRUD + auth |
| **Migrations** | SQL migration runner | `uuid-ossp` extension error -> replaced with native `gen_random_uuid()` | 100% automated migrations |
| **Database Pool** | `pg.Pool` only | Added zero-dependency PGlite fallback for clean machine testing | Adaptive Docker PG + standalone PGlite |
| **Geo Fallback** | 2-tier fallback | Added strict 1500ms abort timeouts and graceful null degradation | Deterministic mockable geo chain |
| **Job Queue** | In-memory queue | Upgraded to PostgreSQL outbox with atomic locks and retries | Reliable database-backed queue |
| **Test Suite** | Vitest parallel tests | Process lock conflicts -> configured single-worker sequential tests | 44/44 tests green covering all 6 probes |
