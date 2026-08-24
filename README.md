# FlyRank AI Capstone — Embeddable Widget & Lead-Capture Platform

> **A production-minded, multi-tenant lead capture backend engineered for the open, untrusted internet.**  
> Create embeddable widgets, generate one-line `<script>` tags, safely ingest cross-origin submissions, filter bot spam, enrich visitor geolocation via resilient fallback chains, process background outbox jobs, and view tenant-isolated analytics.

---

## Table of Contents

1. [Quick Start (For Experienced Developers)](#1-quick-start-for-experienced-developers)
2. [Project Overview & Mission](#2-project-overview--mission)
3. [What This Project Does](#3-what-this-project-does)
4. [Key Features & Capabilities](#4-key-features--capabilities)
5. [Architecture & System Design](#5-architecture--system-design)
6. [Request Lifecycles & Data Flows](#6-request-lifecycles--data-flows)
7. [Technology Stack](#7-technology-stack)
8. [Project Structure](#8-project-structure)
9. [Prerequisites & System Requirements](#9-prerequisites--system-requirements)
10. [Windows Setup & Installation Guide](#10-windows-setup--installation-guide)
11. [Environment Variables Reference](#11-environment-variables-reference)
12. [Database Setup & Migrations](#12-database-setup--migrations)
13. [Starting the Application](#13-starting-the-application)
14. [Seeded Demo Credentials](#14-seeded-demo-credentials)
15. [Verification & Health Check](#15-verification--health-check)
16. [Recommended API Exploration Order](#16-recommended-api-exploration-order)
17. [Complete API Reference & Documentation](#17-complete-api-reference--documentation)
18. [Windows Terminal Testing Guide (PowerShell & CMD)](#18-windows-terminal-testing-guide-powershell--cmd)
19. [Complete Postman Testing Guide](#19-complete-postman-testing-guide)
20. [Testing the Embeddable Widget Cross-Origin](#20-testing-the-embeddable-widget-cross-origin)
21. [Testing Security, Abuse & Resilience Mechanisms](#21-testing-security-abuse--resilience-mechanisms)
    - [CORS & Preflight Handling](#211-cors--preflight-handling)
    - [Boundary Validation & Oversized Payloads](#212-boundary-validation--oversized-payload-protection)
    - [Rate Limiting (429 Abuse Defense)](#213-rate-limiting-429-burst-defense)
    - [Honeypot Bot Spam Filtering](#214-honeypot-spam-trap-protection)
    - [Multi-Tier Geo Fallback Chain](#215-multi-tier-geo-enrichment-fallback-chain)
    - [Safe Non-Critical Side-Effects & Outbox Worker](#216-safe-non-critical-side-effects--job-queue)
    - [Multi-Tenant Data Isolation](#217-multi-tenant-data-isolation)
22. [Running Automated Tests](#22-running-automated-tests)
23. [Docker & Container Management](#23-docker--container-management)
24. [Windows-Specific Development Guidance](#24-windows-specific-development-guidance)
25. [Troubleshooting Common Issues](#25-troubleshooting-common-issues)
26. [Recommended 6-Minute Evaluation Demo](#26-recommended-6-minute-evaluation-demo)
27. [Capstone Specification & Definition of Done Mapping](#27-capstone-specification--definition-of-done-mapping)
28. [Known Limitations & Future Roadmap](#28-known-limitations--future-roadmap)
29. [License](#29-license)

---

## 1. Quick Start (For Experienced Developers)

If you already have **Node.js (>= 18)** installed on Windows, follow these exact steps:

```powershell
# 1. Clone repository & install dependencies
git clone https://github.com/your-username/flyrank-capstone-widget-platform.git
cd flyrank-capstone-widget-platform
npm install

# 2. Configure environment file
Copy-Item .env.example .env

# 3. Run database migrations & seed demo tenant data
npm run migrate
npm run seed

# 4. Start the backend ingestion API server (Terminal 1)
npm start

# 5. Start the customer test website on a separate origin (Terminal 2)
npm run serve:customer

# 6. Run automated test suite (Terminal 3)
npm test
```

- **Backend API**: `http://localhost:3000`
- **Health Endpoint**: `http://localhost:3000/health`
- **Customer Test Page (Second Origin)**: `http://localhost:5500`
- **Demo Admin**: `admin@acme.com` / `password123`
- **Demo Widget ID**: `66ee7055-c3bc-48de-aeff-beed31d73868`

---

## 2. Project Overview & Mission

Most web applications serve requests only from trusted first-party frontend clients (e.g. your own React/Next.js single-page app).

An **Embeddable Widget & Lead-Capture Platform** is fundamentally different:
1. **Third-Party Origin**: You provide a one-line `<script>` tag to external website owners (e.g. `customer-blog.com`).
2. **Untrusted Internet Traffic**: Form submissions arrive directly at your API from browsers you do not control, across arbitrary network origins.
3. **Severe Attack Surface**: Malicious actors, spam bots, malformed payloads, denial-of-service floods, and failing external dependencies all hit the ingestion endpoint.

### The Core Lifecycle

```text
Tenant Owner creates a widget
            ↓
Backend generates embed snippet (<script src="http://localhost:3000/widget.v1.js?id=..."></script>)
            ↓
Customer pastes snippet into their external website (e.g. http://localhost:5500)
            ↓
Visitor browser fetches script & cached public config (/api/widgets/:id/config)
            ↓
Widget dynamically renders lead-capture form on the external page
            ↓
Visitor fills out form and submits
            ↓
Public Ingestion API (POST /api/submissions)
  ├── 1. Validates CORS & Preflight
  ├── 2. Rejects oversized payloads (>10kb -> 413)
  ├── 3. Validates boundary schemas via Zod (-> 400 on error)
  ├── 4. Detects bot spam via invisible honeypot (-> 400 SPAM_DETECTED)
  ├── 5. Enforces IP rate limiting (-> 429 Too Many Requests)
  ├── 6. Enriches IP location via Dual-Provider Fallback (ip-api.com -> ipapi.co -> null)
  ├── 7. Stores submission transactionally linked to tenant in PostgreSQL
  └── 8. Enqueues non-blocking notification job in Outbox queue
            ↓
Success 201 Response returns to visitor immediately
            ↓
Background Worker asynchronously delivers email/webhook (Retries on error; never breaks submission)
            ↓
Tenant views aggregated leads & geo analytics in authenticated Dashboard API
```

---

## 3. What This Project Does

This platform solves lead generation and embedded contact collection for multi-tenant SaaS businesses.

- **For SaaS Tenants (Widget Owners)**:
  - Create customized widgets (signup forms, contact widgets, CTAs, popovers) with custom fields, labels, buttons, and whitelisted origins.
  - Receive an instant, copy-pasteable `<script>` embed snippet.
  - Review all captured leads with IP-derived geographic locations, submission timelines, and aggregated analytics per widget.
- **For Website Visitors**:
  - Seamless, lightweight, and accessible form rendering without heavy framework overhead.
  - Fast feedback on validation or submission success.
- **For Backend Engineers & Evaluators**:
  - Demonstrates strict **CORS compliance**, **sliding-window rate limiting**, **honeypot spam defense**, **zero-downtime geo provider fallback**, **PostgreSQL-backed asynchronous job outbox**, and **ironclad tenant isolation**.

---

## 4. Key Features & Capabilities

| Feature Area | Implementation Detail | Purpose |
| :--- | :--- | :--- |
| **Multi-Tenancy** | Partitioned PostgreSQL database schema with foreign keys and query-level isolation (`WHERE tenant_id = $1`). | Guarantees Tenant A can never read, modify, or delete Tenant B's widgets or submissions. |
| **Authentication** | Token-based auth using **JWT** and **`bcryptjs`** salted password hashing. | Secures admin CRUD and dashboard analytics while keeping public widget delivery open. |
| **Embed Snippet Generator** | Dynamic generation of `<script src="http://localhost:3000/widget.v1.js?id=..."></script>`. | Single line of HTML for customers to paste on any website. |
| **Versioned Asset Delivery** | Vanilla JS bundle (`widget.v1.js`) served with immutable 1-year cache headers (`Cache-Control: public, max-age=31536000, immutable`). | High-speed, cacheable widget distribution mimicking enterprise CDNs. |
| **Cached Public Config** | Public endpoint (`GET /api/widgets/:id/config`) serving safe metadata with short-lived cache headers (`max-age=60`). | Eliminates database load while instantly propagating widget changes to visitors. |
| **CORS & Preflight** | Explicit CORS middleware supporting preflight `OPTIONS` (204 No Content), allowed methods, and cross-origin headers. | Allows external websites (`http://localhost:5500`) to communicate with API (`http://localhost:3000`). |
| **Boundary Validation** | Comprehensive **Zod** schemas for payloads, query params, email formats, and string limits. | Prevents malformed input from reaching domain logic; guarantees clean `400` errors, never `500`. |
| **Payload Size Guard** | Strict 10kb body parser limit. | Rejects oversized or memory-exhaustion payloads with clean `413 Payload Too Large`. |
| **Rate Limiting** | Sliding-window IP rate limiter using `express-rate-limit`. | Blocks flood attacks with `429 Too Many Requests` while keeping service available for legitimate users. |
| **Honeypot Spam Defense** | Hidden input trap (`_hp_website`) invisible to humans but populated by automated bot scrapers. | Traps bots and rejects spam submissions with `400 SPAM_DETECTED`. |
| **Resilient Geo Fallback** | 2-Tier Fallback Chain: **Provider A** (`ip-api.com`) $\rightarrow$ **Provider B** (`ipapi.co`) $\rightarrow$ **Graceful Degradation** (`null` geo). | Upstream geo outages never fail a lead submission. Submissions always succeed. |
| **Asynchronous Job Outbox** | PostgreSQL `background_jobs` table + worker loop with `FOR UPDATE SKIP LOCKED`, retries, and exponential backoff. | Decouples non-critical side effects (email, webhook) so external email crashes never block submissions. |
| **Idempotency Support** | Optional `Idempotency-Key` header or payload key. | Prevents duplicate form submissions upon network retries. |
| **Tenant Analytics** | Aggregated dashboard APIs (`/api/dashboard/stats`, `/api/dashboard/submissions`, `/api/dashboard/geo`). | Real-time counts, 14-day daily trends, per-widget conversions, and country distributions. |

---

## 5. Architecture & System Design

The application follows a **layered, decoupled backend architecture**:

```text
HTTP / Middleware Layer (CORS, RateLimiter, BodyLimit, Auth, ErrorHandler)
       │
       ▼
Controllers (Auth, Widget, Submission, Dashboard)
       │
       ▼
Services (Domain Logic, Boundary Validation, Geo Fallback Coordination, Outbox Dispatch)
       │
  ┌────┴──────────────────────────────┬─────────────────────────────┐
  ▼                                   ▼                             ▼
PostgreSQL Access Layer       Geo Providers (A/B)           Background Outbox Worker
  │                              (ip-api, ipapi.co)           (Retries + Atomic Locks)
  ▼                                                                 │
PostgreSQL Database                                                 ▼
(tenants, users, widgets, submissions, jobs)                  Notification / Email Adapter
```

### Why This Architecture?
- **Provider Interchangeability**: You can replace `ip-api.com` with MaxMind or AWS Location Service without modifying submission business logic.
- **Database Portability**: The data-access layer abstracts queries, enabling seamless switching between Docker PostgreSQL and zero-dependency standalone embedded PostgreSQL (PGlite).
- **Fault Containment**: Errors in third-party APIs or notification workers are isolated at service boundaries.

---

## 6. Request Lifecycles & Data Flows

### Flow A: Widget Creation & Embed Flow
```text
Tenant Admin -> POST /api/auth/login -> Receives JWT
Tenant Admin -> POST /api/widgets (with fields, title, origins)
Backend -> Validates schema -> Saves to 'widgets' table -> Generates snippet
Backend -> Returns 201 Created with <script src="http://localhost:3000/widget.v1.js?id=..."></script>
```

### Flow B: Client-Side Widget Loading Flow
```text
Visitor loads Customer Website (http://localhost:5500)
Visitor browser executes <script src="http://localhost:3000/widget.v1.js?id=...">
widget.v1.js -> GET http://localhost:3000/api/widgets/:id/config (CORS, Cached)
widget.v1.js -> Dynamically injects styled form, required fields, and hidden honeypot into DOM
```

### Flow C: Public Submission & Ingestion Pipeline
```text
Visitor submits form on http://localhost:5500
widget.v1.js -> POST http://localhost:3000/api/submissions
  ├── 1. CORS Preflight (OPTIONS) -> 204 No Content
  ├── 2. Body Parser -> Checks payload <= 10kb (Rejects with 413 if oversized)
  ├── 3. Zod Boundary Validation -> Rejects malformed payload with 400
  ├── 4. Honeypot Check -> If _hp_website populated -> Rejects with 400 SPAM_DETECTED
  ├── 5. Rate Limiter -> Checks client IP window (Rejects with 429 if burst exceeded)
  ├── 6. GeoService -> Queries ip-api.com (1.5s timeout)
  │                      └─ Failure? -> Queries ipapi.co (1.5s timeout)
  │                                       └─ Failure? -> Sets geo = null (Degrades gracefully)
  ├── 7. Transactional Insert -> Stores row in 'submissions' table
  └── 8. Outbox Enqueue -> Inserts 'PENDING' task in 'background_jobs' table
Backend -> Responds immediately with 201 Created { success: true, submissionId: "..." }
```

### Flow D: Background Job Worker Flow
```text
JobWorker loop -> SELECT ... FOR UPDATE SKIP LOCKED WHERE status = 'PENDING' AND run_at <= NOW()
Worker -> Dispatches NotificationService (Mailpit / Console)
  ├── Success -> Updates job status = 'COMPLETED'
  └── Failure -> Increments attempts -> Calculates 2^attempt backoff -> Updates run_at
                  └─ If attempts >= max_attempts (3) -> Sets status = 'FAILED' & logs alert
```

---

## 7. Technology Stack

| Layer | Technology | Purpose | Free / $0 Stack Notes |
| :--- | :--- | :--- | :--- |
| **Runtime** | Node.js (v18+) | Core JavaScript runtime | Free, open-source |
| **Web Framework** | Express.js (v4.21) | REST API & routing | Free, open-source |
| **Validation** | Zod (v3.24) | Schema declaration & boundary validation | Free, type-safe runtime validation |
| **Database** | PostgreSQL 16 | Relational persistence & JSONB storage | Free via Docker or embedded PGlite WASM |
| **Authentication** | JWT (`jsonwebtoken`) & `bcryptjs` | Token signing & salted password hashing | Free, secure authentication |
| **CORS** | `cors` middleware | Cross-origin resource sharing & preflights | Free |
| **Abuse Defense** | `express-rate-limit` | IP-based request throttling & 429 responses | Free |
| **Geo Provider A** | `ip-api.com` | Primary IP geolocation enrichment | Free JSON endpoint (45 req/min, no card) |
| **Geo Provider B** | `ipapi.co` | Fallback IP geolocation enrichment | Free tier (1,000 req/day, no card) |
| **Side Effects** | Console / Mailpit | Local notification & email catcher | Free local mail catcher |
| **Testing** | Vitest & Supertest | Deterministic automated unit/integration tests | Free, fast test runner |
| **Client Widget** | Vanilla JS / HTML5 | Cross-origin embed script (`widget.v1.js`) | Zero framework overhead (<10kb) |

---

## 8. Project Structure

```text
flyrank-capstone-widget-platform/
├── .env.example                # Safe environment configuration template
├── .gitignore                  # Git ignore rules (ignores .env, node_modules, logs)
├── BUILDLOG.md                 # Honest AI-usage log, design choices, and bug fixes
├── EVIDENCE.md                 # Verifiable test proofs for every Definition-of-Done item
├── LICENSE                     # MIT License
├── README.md                   # Comprehensive project documentation & user guide
├── capstone.yaml               # Machine-readable evaluator manifest (run, seed, test, probes)
├── docker-compose.yml          # PostgreSQL 16 & Mailpit container definitions
├── package.json                # Project dependencies, scripts, and metadata
├── vitest.config.js            # Vitest configuration for deterministic sequential execution
│
├── customer-site/              # External Customer Test Website (Second Origin: Port 5500)
│   └── index.html              # Demo webpage loading widget cross-origin from port 3000
│
├── migrations/                 # PostgreSQL Database Migrations (Pure SQL)
│   ├── 001_init_schema.sql     # Tables: tenants, users, widgets, submissions, background_jobs
│   └── 002_add_indexes.sql     # B-Tree performance indexes for tenant isolation & outbox
│
├── public/                     # Static Versioned Asset Delivery
│   ├── widget.v1.js            # Client-side embed runtime bundle (immutable cache)
│   └── widget.js               # Backward-compatible alias
│
├── scripts/                    # CLI Helper & Setup Scripts
│   ├── migrate.js              # Migration execution runner
│   ├── seed.js                 # Demo data seeder (Acme Corp, admin user, demo widget)
│   └── serveCustomerSite.js    # Lightweight HTTP server hosting customer-site on port 5500
│
├── src/                        # Main Application Source Code
│   ├── app.js                  # Express app setup, CORS, body limits, route mounting
│   ├── server.js               # Entry point: starts HTTP server & background job worker
│   │
│   ├── config/
│   │   └── env.js              # Centralized environment variable loader with safe defaults
│   │
│   ├── controllers/            # HTTP Request/Response Controllers
│   │   ├── auth.controller.js
│   │   ├── dashboard.controller.js
│   │   ├── submission.controller.js
│   │   └── widget.controller.js
│   │
│   ├── db/
│   │   └── pool.js             # Adaptive DB pool (PostgreSQL pg.Pool + embedded PGlite)
│   │
│   ├── jobs/                   # Background Queue & Outbox Worker
│   │   ├── jobQueue.js         # Enqueue logic into background_jobs table
│   │   └── jobWorker.js        # Polling worker with FOR UPDATE SKIP LOCKED & retries
│   │
│   ├── middleware/             # Express Middleware
│   │   ├── auth.js             # JWT Bearer token authentication guard
│   │   ├── cors.js             # Preflight OPTIONS & CORS headers
│   │   ├── errorHandler.js     # Centralized error handler (clean 4xx/500 JSON)
│   │   ├── rateLimit.js        # IP rate limiting for public submissions
│   │   └── validate.js         # Generic Zod request body & query validator
│   │
│   ├── routes/                 # Express Route Definitions
│   │   ├── auth.routes.js
│   │   ├── dashboard.routes.js
│   │   ├── health.routes.js
│   │   ├── submission.routes.js
│   │   └── widget.routes.js
│   │
│   ├── schemas/                # Zod Boundary Validation Schemas
│   │   ├── auth.schema.js
│   │   ├── submission.schema.js
│   │   └── widget.schema.js
│   │
│   └── services/               # Core Business Domain Logic
│       ├── auth.service.js
│       ├── dashboard.service.js
│       ├── submission.service.js
│       ├── widget.service.js
│       │
│       ├── geo/                # Resilient Geo Enrichment
│       │   ├── geo.service.js  # 2-Tier Fallback Chain & Graceful Degradation
│       │   ├── ipApiCoProvider.js # Provider B (ipapi.co)
│       │   └── ipApiProvider.js   # Provider A (ip-api.com)
│       │
│       └── notification/       # Non-Critical Side Effects
│           ├── emailAdapter.js # Console & Mailpit dispatcher with fault simulation
│           └── notification.service.js
│
└── tests/                      # Automated Vitest & Supertest Suite (100% Deterministic)
    ├── acceptanceProbes.test.js # Dedicated verification for Probes 1 through 6
    ├── auth.test.js            # Registration, login, token verification
    ├── cors.test.js            # OPTIONS preflight & cross-origin headers
    ├── dashboard.test.js       # Tenant stats, metrics, geo aggregation
    ├── geoFallback.test.js     # Provider A -> B -> Null fallback testing
    ├── payloadValidation.test.js # Schema validation & 10kb oversized protection
    ├── rateLimit.test.js       # Burst 429 Too Many Requests verification
    ├── sideEffectFailure.test.js # Side-effect outage isolation
    ├── spamHoneypot.test.js    # Bot honeypot trap rejection
    ├── tenantIsolation.test.js # Strict multi-tenant security verification
    └── widget.test.js          # Widget CRUD & embed snippet generation
```

---

## 9. Prerequisites & System Requirements

Before running the application on Windows, verify your installed tools:

### Required Software
1. **Node.js**: Version `18.0.0` or higher (Recommended: Node.js 20+ LTS).
2. **npm**: Version `9.0.0` or higher (bundled with Node.js).
3. **Git**: For cloning the repository.

### Optional (Recommended for Production Containers)
- **Docker Desktop for Windows**: For running containerized PostgreSQL 16 and Mailpit.
  > *Note: If Docker is not installed or not running, the application **automatically and transparently falls back to an embedded PostgreSQL WASM engine (`@electric-sql/pglite`)** storing data in `./data/postgres_db`. You can run, test, and seed the entire application without installing Docker!*

### Verify Installations in PowerShell
```powershell
node --version
npm --version
git --version
```
Expected output:
```text
v20.x.x (or v18.x.x)
10.x.x (or 9.x.x)
git version 2.x.x.windows.x
```

---

## 10. Windows Setup & Installation Guide

Follow these exact step-by-step instructions in **Windows PowerShell**:

### Step 1: Open PowerShell as Regular User
Press `Win + X` and select **Terminal** or **Windows PowerShell**.

### Step 2: Navigate to Your Workspace & Clone Repository
```powershell
cd D:\YourProjectsFolder
git clone https://github.com/your-username/flyrank-capstone-widget-platform.git
cd flyrank-capstone-widget-platform
```

### Step 3: Install Node Dependencies
```powershell
npm install
```
*(Installs Express, Zod, JWT, bcryptjs, pg, Vitest, Supertest, and PGlite).*

### Step 4: Configure Environment Variables
Copy the template `.env.example` file to create your active `.env`:
```powershell
Copy-Item .env.example .env
```
*(If using Command Prompt `cmd.exe`, run `copy .env.example .env`).*

### Step 5: Database Setup & Migrations
Run the migration script to construct the PostgreSQL database schema and indexes:
```powershell
npm run migrate
```
Expected output:
```text
--- Running Database Migrations ---
Applying migration: 001_init_schema.sql...
✓ Applied: 001_init_schema.sql
Applying migration: 002_add_indexes.sql...
✓ Applied: 002_add_indexes.sql
All migrations applied successfully!
```

### Step 6: Seed Demo Data
Populate demo tenants, admin users, widgets, and sample submissions:
```powershell
npm run seed
```
Expected output:
```text
--- Seeding Demo Database Data ---
Created Tenant: Acme Corp (be5c8af0-2361-447a-81d5-507207eb4f66)
Created User: admin@acme.com / password123 (75b743bd-c6b1-40fb-a6ac-0d9ac480d0f9)
Created Widget: 'Newsletter Signup' (66ee7055-c3bc-48de-aeff-beed31d73868)
Seeded 3 demo submissions.
Created Second Tenant 'Beta Industries' for isolation tests.
✓ Seeding completed successfully!
```

---

## 11. Environment Variables Reference

All configuration is managed through environment variables loaded via `dotenv`:

| Variable Name | Required | Default / Example Value | Description |
| :--- | :--- | :--- | :--- |
| `PORT` | Yes | `3000` | Port for the backend API server. |
| `BASE_URL` | Yes | `http://localhost:3000` | Canonical base URL used in generated embed snippets. |
| `NODE_ENV` | No | `development` | Environment mode (`development`, `production`, `test`). |
| `DATABASE_URL` | Yes | `postgres://postgres:postgres@localhost:5432/widget_platform` | PostgreSQL connection string. |
| `JWT_SECRET` | Yes | `super_secret_capstone_jwt_key_change_in_production` | Cryptographic secret for signing JWTs. |
| `JWT_EXPIRES_IN` | No | `7d` | Expiration window for authentication tokens. |
| `CORS_ALLOWED_ORIGINS` | Yes | `http://localhost:5500,http://127.0.0.1:5500,http://localhost:3000` | Comma-separated allowed web origins. |
| `RATE_LIMIT_WINDOW_MS`| No | `60000` | Rate limiting sliding window in milliseconds (60 seconds). |
| `RATE_LIMIT_MAX_PER_IP`| No | `30` | Max submissions allowed per IP within window before returning 429. |
| `GEO_PROVIDER_A_URL` | No | `http://ip-api.com/json` | Primary IP geolocation provider endpoint. |
| `GEO_PROVIDER_B_URL` | No | `https://ipapi.co` | Fallback IP geolocation provider endpoint. |
| `GEO_PROVIDER_A_TIMEOUT_MS`| No | `1500` | Abort timeout for primary geo provider in milliseconds. |
| `GEO_PROVIDER_B_TIMEOUT_MS`| No | `1500` | Abort timeout for fallback geo provider in milliseconds. |
| `EMAIL_MODE` | No | `console` | Side-effect delivery mode (`console`, `mailpit`). |
| `MAILPIT_HOST` | No | `localhost` | Mailpit host for local SMTP capture. |
| `MAILPIT_PORT` | No | `1025` | Mailpit SMTP port. |
| `JOB_POLL_INTERVAL_MS`| No | `3000` | Interval in ms between background job worker polling loops. |
| `JOB_MAX_ATTEMPTS` | No | `3` | Maximum retry attempts for failing background tasks. |

---

## 12. Database Setup & Migrations

### Automatic Engine Selection
`src/db/pool.js` contains an **adaptive PostgreSQL connection pool**:
1. It first attempts to connect to the PostgreSQL instance defined in `DATABASE_URL` (e.g. Docker PostgreSQL on port 5432).
2. If no external PostgreSQL instance is found, it **automatically initializes an embedded PostgreSQL 16 WebAssembly engine (`@electric-sql/pglite`)** storing relational tables in `./data/postgres_db`.

### Database Commands
- **Run Migrations**: `npm run migrate` (Creates tables, foreign keys, and indexes).
- **Seed Demo Data**: `npm run seed` (Idempotently inserts demo users, widgets, and sample submissions).
- **Reset Database**: Delete `./data/postgres_db` folder (if using embedded) and re-run `npm run migrate && npm run seed`.

---

## 13. Starting the Application

To explore the full end-to-end system including cross-origin widget delivery, keep two terminals open:

### Terminal 1: Backend API & Job Worker
```powershell
npm start
```
*You will see the startup banner:*
```text
====================================================
 FlyRank Widget & Lead-Capture Platform Running
 Mode: development
 Port: 3000
 Base URL: http://localhost:3000
 Health Check: http://localhost:3000/health
====================================================
[JobWorker] Background job worker started.
```

### Terminal 2: Customer Test Website (Separate Origin)
Open a new PowerShell window:
```powershell
npm run serve:customer
```
*You will see:*
```text
====================================================
 Customer Test Site (Second Origin) Running
 URL: http://localhost:5500
 Serving: D:\flyrank-capstone-widget-platform\customer-site
====================================================
```

---

## 14. Seeded Demo Credentials

| Tenant / Role | Email | Password | Pre-Configured Widget ID |
| :--- | :--- | :--- | :--- |
| **Acme Corp** (Admin) | `admin@acme.com` | `password123` | `66ee7055-c3bc-48de-aeff-beed31d73868` |
| **Beta Industries** (Tenant B) | `owner@beta.com` | `password123` | *(Used to verify tenant isolation)* |

---

## 15. Verification & Health Check

Verify the backend is live by opening a browser or running in PowerShell:

```powershell
curl.exe http://localhost:3000/health
```
Expected response (`200 OK`):
```json
{
  "status": "healthy",
  "timestamp": "2026-08-24T09:40:00.000Z",
  "database": "connected",
  "uptimeSeconds": 12.4
}
```

---

## 16. Recommended API Exploration Order

To systematically explore the platform as an evaluator or developer, execute requests in this order:

```text
Step 1: Login as Tenant Admin
        POST http://localhost:3000/api/auth/login
        -> Obtain JWT Bearer Token

Step 2: Inspect Active Session
        GET http://localhost:3000/api/auth/me (with Bearer Token)

Step 3: Create a Custom Lead Capture Widget
        POST http://localhost:3000/api/widgets
        -> Returns new Widget ID and copy-pasteable <script> embed snippet

Step 4: Fetch Public Cached Configuration
        GET http://localhost:3000/api/widgets/:id/config (Public, No Auth, Cached)

Step 5: Fetch Client JavaScript Bundle
        GET http://localhost:3000/widget.v1.js (Public, Immutable Cache)

Step 6: Open Customer Website in Browser
        Open http://localhost:5500 in Chrome/Firefox/Edge
        -> Observe cross-origin dynamic widget rendering

Step 7: Submit Lead from Visitor Site
        POST http://localhost:3000/api/submissions
        -> Ingests lead, filters bot honeypot, triggers geo fallback, enqueues outbox job

Step 8: Inspect Submissions in Tenant Dashboard
        GET http://localhost:3000/api/dashboard/submissions

Step 9: Inspect Analytics & Geo Breakdown
        GET http://localhost:3000/api/dashboard/stats
        GET http://localhost:3000/api/dashboard/geo

Step 10: Test Abuse & Resilience Attacks
        - Malformed/oversized payloads (400/413)
        - Bot honeypot submission (400 SPAM_DETECTED)
        - Rapid submission burst (429 Too Many Requests)
        - Tenant isolation boundary (404 Not Found)
```

---

## 17. Complete API Reference & Documentation

### Authentication Endpoints

#### 1. Register Tenant & Admin User
- **Method**: `POST`
- **URL**: `http://localhost:3000/api/auth/register`
- **Auth**: None (Public)
- **Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "email": "newtenant@example.com",
    "password": "SecurePassword123!",
    "name": "Alex Mercer",
    "tenantName": "Mercer Enterprises"
  }
  ```
- **Response**: `201 Created`
  ```json
  {
    "message": "Tenant registered successfully",
    "data": {
      "user": {
        "id": "7b8f9e0a-1234-4567-89ab-cdef01234567",
        "email": "newtenant@example.com",
        "name": "Alex Mercer",
        "tenantId": "1a2b3c4d-5678-90ab-cdef-1234567890ab",
        "tenantName": "Mercer Enterprises"
      },
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
  ```

#### 2. Login
- **Method**: `POST`
- **URL**: `http://localhost:3000/api/auth/login`
- **Auth**: None (Public)
- **Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "email": "admin@acme.com",
    "password": "password123"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "message": "Login successful",
    "data": {
      "user": {
        "id": "75b743bd-c6b1-40fb-a6ac-0d9ac480d0f9",
        "email": "admin@acme.com",
        "name": "Acme Admin",
        "tenantId": "be5c8af0-2361-447a-81d5-507207eb4f66",
        "tenantName": "Acme Corp"
      },
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
  ```

#### 3. Get Current User Profile
- **Method**: `GET`
- **URL**: `http://localhost:3000/api/auth/me`
- **Auth**: `Bearer <token>`
- **Response**: `200 OK`
  ```json
  {
    "user": {
      "id": "75b743bd-c6b1-40fb-a6ac-0d9ac480d0f9",
      "tenantId": "be5c8af0-2361-447a-81d5-507207eb4f66",
      "email": "admin@acme.com",
      "name": "Acme Admin"
    }
  }
  ```

---

### Widget Management Endpoints (Tenant-Isolated)

#### 4. Create Widget
- **Method**: `POST`
- **URL**: `http://localhost:3000/api/widgets`
- **Auth**: `Bearer <token>`
- **Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "name": "Developer Beta Form",
    "type": "signup",
    "title": "Join Developer Beta",
    "description": "Get early API access and SDK documentation.",
    "buttonText": "Request Access",
    "fields": [
      { "name": "name", "label": "Full Name", "type": "text", "required": true },
      { "name": "email", "label": "Work Email", "type": "email", "required": true },
      { "name": "company", "label": "Company", "type": "text", "required": false }
    ],
    "allowedOrigins": ["http://localhost:5500", "*"]
  }
  ```
- **Response**: `201 Created`
  ```json
  {
    "message": "Widget created successfully",
    "data": {
      "id": "c4d5e6f7-8901-2345-6789-abcdef012345",
      "name": "Developer Beta Form",
      "type": "signup",
      "title": "Join Developer Beta",
      "buttonText": "Request Access",
      "fields": [...],
      "allowedOrigins": ["http://localhost:5500", "*"],
      "isActive": true,
      "embedSnippet": "<script src=\"http://localhost:3000/widget.v1.js?id=c4d5e6f7-8901-2345-6789-abcdef012345\" async defer></script>"
    }
  }
  ```

#### 5. List Tenant Widgets
- **Method**: `GET`
- **URL**: `http://localhost:3000/api/widgets`
- **Auth**: `Bearer <token>`
- **Response**: `200 OK` (Returns array of widgets owned strictly by the authenticated tenant).

#### 6. Get Widget by ID
- **Method**: `GET`
- **URL**: `http://localhost:3000/api/widgets/:id`
- **Auth**: `Bearer <token>`
- **Response**: `200 OK` (or `404 Not Found` if the widget belongs to another tenant).

#### 7. Update Widget
- **Method**: `PATCH`
- **URL**: `http://localhost:3000/api/widgets/:id`
- **Auth**: `Bearer <token>`
- **Request Body**: `{ "title": "Updated Beta Title", "buttonText": "Get VIP Invite" }`
- **Response**: `200 OK` with updated widget record.

#### 8. Delete Widget
- **Method**: `DELETE`
- **URL**: `http://localhost:3000/api/widgets/:id`
- **Auth**: `Bearer <token>`
- **Response**: `200 OK` -> `{ "success": true, "message": "Widget deleted successfully" }`

---

### Public Delivery & Ingestion Endpoints

#### 9. Get Public Cached Widget Configuration
- **Method**: `GET`
- **URL**: `http://localhost:3000/api/widgets/66ee7055-c3bc-48de-aeff-beed31d73868/config`
- **Auth**: None (Public)
- **Headers Returned**: `Cache-Control: public, max-age=60, stale-while-revalidate=30`, `Access-Control-Allow-Origin: *`
- **Response**: `200 OK`
  ```json
  {
    "id": "66ee7055-c3bc-48de-aeff-beed31d73868",
    "type": "signup",
    "title": "Subscribe to our Product Newsletter",
    "description": "Get the latest developer updates and platform releases delivered weekly.",
    "buttonText": "Subscribe Now",
    "fields": [
      { "name": "name", "label": "Full Name", "type": "text", "required": true },
      { "name": "email", "label": "Work Email", "type": "email", "required": true }
    ],
    "allowedOrigins": ["http://localhost:5500", "*"]
  }
  ```

#### 10. Submit Lead (Public Ingestion Endpoint)
- **Method**: `POST`
- **URL**: `http://localhost:3000/api/submissions`
- **Auth**: None (Public, Cross-Origin)
- **Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "widgetId": "66ee7055-c3bc-48de-aeff-beed31d73868",
    "data": {
      "name": "Sarah Connor",
      "email": "sarah@cyberdyne.com"
    },
    "_hp_website": ""
  }
  ```
- **Response**: `201 Created`
  ```json
  {
    "success": true,
    "submissionId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "message": "Submission received successfully"
  }
  ```

---

### Owner Dashboard & Analytics Endpoints

#### 11. Get Submissions Log
- **Method**: `GET`
- **URL**: `http://localhost:3000/api/dashboard/submissions?limit=50&offset=0`
- **Auth**: `Bearer <token>`
- **Response**: `200 OK`
  ```json
  {
    "data": {
      "total": 4,
      "limit": 50,
      "offset": 0,
      "submissions": [
        {
          "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
          "widgetId": "66ee7055-c3bc-48de-aeff-beed31d73868",
          "widgetName": "Newsletter Signup",
          "data": { "name": "Sarah Connor", "email": "sarah@cyberdyne.com" },
          "ipAddress": "24.48.0.1",
          "country": "Canada",
          "countryCode": "CA",
          "city": "Montreal",
          "region": "Quebec",
          "geoProvider": "ip-api",
          "createdAt": "2026-08-24T09:45:00.000Z"
        }
      ]
    }
  }
  ```

#### 12. Get High-Level Metrics & Daily Trends
- **Method**: `GET`
- **URL**: `http://localhost:3000/api/dashboard/stats`
- **Auth**: `Bearer <token>`
- **Response**: `200 OK`
  ```json
  {
    "data": {
      "totalSubmissions": 4,
      "activeWidgets": 1,
      "submissionsLast24Hours": 4,
      "submissionsLast7Days": 4,
      "dailyTrends": [
        { "date": "2026-08-24", "count": 4 }
      ]
    }
  }
  ```

#### 13. Get Per-Widget Statistics
- **Method**: `GET`
- **URL**: `http://localhost:3000/api/dashboard/widgets/66ee7055-c3bc-48de-aeff-beed31d73868/stats`
- **Auth**: `Bearer <token>`
- **Response**: `200 OK` with conversion counts and geographic distribution for that widget.

#### 14. Get Geographic Distribution Breakdown
- **Method**: `GET`
- **URL**: `http://localhost:3000/api/dashboard/geo`
- **Auth**: `Bearer <token>`
- **Response**: `200 OK`
  ```json
  {
    "data": {
      "total": 4,
      "breakdown": [
        { "country": "Canada", "countryCode": "CA", "count": 2, "percentage": 50.0 },
        { "country": "United States", "countryCode": "US", "count": 1, "percentage": 25.0 },
        { "country": "United Kingdom", "countryCode": "GB", "count": 1, "percentage": 25.0 }
      ]
    }
  }
  ```

---

## 18. Windows Terminal Testing Guide (PowerShell & CMD)

On Windows, use `curl.exe` (built into Windows 10/11) to test all APIs directly from PowerShell or Command Prompt.

### Step 1: Login and Store JWT Token in PowerShell Variable
```powershell
$loginResponse = curl.exe -s -X POST http://localhost:3000/api/auth/login `
  -H "Content-Type: application/json" `
  -d '{\"email\":\"admin@acme.com\",\"password\":\"password123\"}' | ConvertFrom-Json

$TOKEN = $loginResponse.data.token
Write-Host "Obtained JWT Token: $TOKEN"
```

### Step 2: Verify Authentication (`/api/auth/me`)
```powershell
curl.exe -s -X GET http://localhost:3000/api/auth/me `
  -H "Authorization: Bearer $TOKEN"
```

### Step 3: Create a New Widget
```powershell
curl.exe -s -X POST http://localhost:3000/api/widgets `
  -H "Authorization: Bearer $TOKEN" `
  -H "Content-Type: application/json" `
  -d '{\"name\":\"Webinar Signups\",\"type\":\"signup\",\"title\":\"Register for Live Demo\",\"buttonText\":\"Save My Seat\",\"fields\":[{\"name\":\"email\",\"label\":\"Work Email\",\"type\":\"email\",\"required\":true}],\"allowedOrigins\":[\"*\"]}'
```

### Step 4: Submit a Public Lead (Simulating Visitor Submission)
```powershell
curl.exe -s -X POST http://localhost:3000/api/submissions `
  -H "Content-Type: application/json" `
  -H "Origin: http://localhost:5500" `
  -d '{\"widgetId\":\"66ee7055-c3bc-48de-aeff-beed31d73868\",\"data\":{\"name\":\"Terminal Tester\",\"email\":\"terminal@test.com\"},\"_hp_website\":\"\"}'
```

### Step 5: Check Dashboard Submissions
```powershell
curl.exe -s -X GET "http://localhost:3000/api/dashboard/submissions?limit=10" `
  -H "Authorization: Bearer $TOKEN"
```

### Step 6: Check Geographic Analytics
```powershell
curl.exe -s -X GET http://localhost:3000/api/dashboard/geo `
  -H "Authorization: Bearer $TOKEN"
```

---

## 19. Complete Postman Testing Guide

You can test all endpoints effortlessly using [Postman](https://www.postman.com/downloads/):

### Setup Postman Collection & Environment
1. Open Postman.
2. Click **New Collection** and name it `FlyRank Widget Platform`.
3. In the Collection settings, go to the **Variables** tab:
   - Variable: `base_url` | Initial Value: `http://localhost:3000`
   - Variable: `token` | Initial Value: *(Leave blank for now)*
   - Variable: `widget_id` | Initial Value: `66ee7055-c3bc-48de-aeff-beed31d73868`
4. Click **Save**.

### Postman Request 1: Login
- **Method**: `POST`
- **URL**: `{{base_url}}/api/auth/login`
- **Headers**: `Content-Type: application/json`
- **Body** (`raw` $\rightarrow$ `JSON`):
  ```json
  {
    "email": "admin@acme.com",
    "password": "password123"
  }
  ```
- **Postman Tests Script** *(Automatically saves token)*:
  ```javascript
  const res = pm.response.json();
  if (res.data && res.data.token) {
      pm.collectionVariables.set("token", res.data.token);
      console.log("Token saved to collection variable!");
  }
  ```
- Click **Send** $\rightarrow$ Status `200 OK`.

### Postman Request 2: Create Widget
- **Method**: `POST`
- **URL**: `{{base_url}}/api/widgets`
- **Authorization**: `Bearer Token` $\rightarrow$ `{{token}}`
- **Body** (`raw` $\rightarrow$ `JSON`):
  ```json
  {
    "name": "Postman Lead Form",
    "type": "signup",
    "title": "Subscribe via Postman",
    "buttonText": "Subscribe",
    "fields": [
      { "name": "name", "label": "Full Name", "type": "text", "required": true },
      { "name": "email", "label": "Email", "type": "email", "required": true }
    ],
    "allowedOrigins": ["*"]
  }
  ```
- Click **Send** $\rightarrow$ Status `201 Created`.

### Postman Request 3: Public Submission (Cross-Origin Ingestion)
- **Method**: `POST`
- **URL**: `{{base_url}}/api/submissions`
- **Authorization**: `No Auth`
- **Headers**:
  - `Content-Type`: `application/json`
  - `Origin`: `http://localhost:5500`
- **Body** (`raw` $\rightarrow$ `JSON`):
  ```json
  {
    "widgetId": "{{widget_id}}",
    "data": {
      "name": "Postman Explorer",
      "email": "postman@example.com"
    },
    "_hp_website": ""
  }
  ```
- Click **Send** $\rightarrow$ Status `201 Created`.

### Postman Request 4: View Dashboard Analytics
- **Method**: `GET`
- **URL**: `{{base_url}}/api/dashboard/stats`
- **Authorization**: `Bearer Token` $\rightarrow$ `{{token}}`
- Click **Send** $\rightarrow$ Status `200 OK`.

---

## 20. Testing the Embeddable Widget Cross-Origin

This test proves the core capstone requirement: **rendering a widget on a third-party domain and capturing submissions cross-origin**.

### Step 1: Ensure Both Servers are Running
- **Backend API**: Running on `http://localhost:3000` (`npm start`).
- **Customer Website**: Running on `http://localhost:5500` (`npm run serve:customer`).

### Step 2: Open Customer Site in Your Browser
Open: **`http://localhost:5500`** in Chrome, Firefox, or Edge.

### Step 3: Observe Automatic Widget Bootstrapping
1. The customer page includes:
   ```html
   <script src="http://localhost:3000/widget.v1.js?id=66ee7055-c3bc-48de-aeff-beed31d73868" async defer></script>
   ```
2. Open Browser DevTools (`F12` $\rightarrow$ **Network** tab).
3. Observe two requests:
   - `GET http://localhost:3000/widget.v1.js` (Status 200)
   - `GET http://localhost:3000/api/widgets/66ee7055-c3bc-48de-aeff-beed31d73868/config` (Status 200, CORS enabled)
4. The styled widget dynamically appears inside the page with inputs for **Full Name** and **Work Email**.

### Step 4: Submit the Form on the Customer Site
1. Type `Jane Doe` into Full Name.
2. Type `jane.doe@example.com` into Work Email.
3. Click **Subscribe Now**.
4. The button changes to `Submitting...` and displays:
   `✓ Thank you! Your submission has been received.`

### Step 5: Verify Persistence in Dashboard API
Run in PowerShell:
```powershell
curl.exe -s -X GET http://localhost:3000/api/dashboard/submissions -H "Authorization: Bearer $TOKEN"
```
*The submission `jane.doe@example.com` appears in the log, enriched with geographic metadata!*

---

## 21. Testing Security, Abuse & Resilience Mechanisms

### 21.1. CORS & Preflight Handling
Test that preflight `OPTIONS` requests receive correct CORS headers and `204 No Content`:
```powershell
curl.exe -i -X OPTIONS http://localhost:3000/api/submissions `
  -H "Origin: http://localhost:5500" `
  -H "Access-Control-Request-Method: POST" `
  -H "Access-Control-Request-Headers: Content-Type"
```
**Expected Response**:
```http
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: http://localhost:5500
Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
Access-Control-Allow-Headers: Origin, X-Requested-With, Content-Type, Accept, Authorization, Idempotency-Key
Access-Control-Max-Age: 86400
```

---

### 21.2. Boundary Validation & Oversized Payload Protection

#### Test A: Malformed JSON
```powershell
curl.exe -i -X POST http://localhost:3000/api/submissions `
  -H "Content-Type: application/json" `
  -d '{ "widgetId": "bad-json... '
```
**Expected Status**: `400 Bad Request` with `INVALID_JSON` (Never 500!).

#### Test B: Missing Required Fields
```powershell
curl.exe -i -X POST http://localhost:3000/api/submissions `
  -H "Content-Type: application/json" `
  -d '{\"widgetId\":\"66ee7055-c3bc-48de-aeff-beed31d73868\",\"data\":{\"wrongField\":\"value\"}}'
```
**Expected Status**: `400 Bad Request` with `FIELD_REQUIRED`.

#### Test C: Oversized Payload (> 10kb)
```powershell
# Send 15KB junk payload
$hugePayload = '{"widgetId":"66ee7055-c3bc-48de-aeff-beed31d73868","data":{"email":"a@b.com","junk":"' + ('X' * 15000) + '"}}'
curl.exe -i -X POST http://localhost:3000/api/submissions `
  -H "Content-Type: application/json" `
  -d $hugePayload
```
**Expected Status**: `413 Payload Too Large` with `PAYLOAD_TOO_LARGE`.

---

### 21.3. Rate Limiting (429 Burst Defense)
Simulate a flood attack in PowerShell:
```powershell
for ($i = 1; $i -le 35; $i++) {
  $status = curl.exe -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/submissions `
    -H "Content-Type: application/json" `
    -d '{\"widgetId\":\"66ee7055-c3bc-48de-aeff-beed31d73868\",\"data\":{\"name\":\"Spammer\",\"email\":\"spam@test.com\"}}'
  Write-Host "Request $i -> HTTP $status"
}
```
**Expected Behavior**:
- Initial requests succeed (`201 Created`).
- Once burst limit is exceeded, subsequent requests return `429 Too Many Requests`.
- Standard rate limit headers (`RateLimit-Remaining: 0`, `Retry-After: 60`) are returned.

---

### 21.4. Honeypot Spam Trap Protection
When an automated bot scraper scans the form HTML, it automatically fills the invisible `_hp_website` input field:
```powershell
curl.exe -i -X POST http://localhost:3000/api/submissions `
  -H "Content-Type: application/json" `
  -d '{\"widgetId\":\"66ee7055-c3bc-48de-aeff-beed31d73868\",\"data\":{\"name\":\"Scraper Bot\",\"email\":\"bot@spam.com\"},\"_hp_website\":\"http://buy-cheap-stuff-now.xyz\"}'
```
**Expected Status**: `400 Bad Request`
```json
{
  "error": {
    "code": "SPAM_DETECTED",
    "message": "Spam activity detected"
  }
}
```

---

### 21.5. Multi-Tier Geo-Enrichment Fallback Chain

The `GeoService` executes a multi-provider fallback chain:
1. **Provider A (`ip-api.com`)**: Primary lookup with 1.5s timeout.
2. **Provider B (`ipapi.co`)**: If Provider A fails, times out, or rate limits, Provider B is queried with 1.5s timeout.
3. **Graceful Degradation**: If both providers are unreachable, the submission is stored with `geo_country = null`.

To verify deterministically without internet flakiness, run the automated test:
```powershell
npx vitest run tests/geoFallback.test.js
```
Expected output:
```text
 ✓ tests/geoFallback.test.js (4 tests)
   ✓ Case 1: Primary provider succeeds -> uses Provider A data
   ✓ Case 2: Primary provider fails -> Fallback to Provider B succeeds
   ✓ Case 3: All geo providers fail -> Graceful degradation with null geo
   ✓ Integration: Submission persists successfully even when all geo providers are down
```

---

### 21.6. Safe Non-Critical Side-Effects & Job Queue

When a submission is received, sending an email alert or webhook notification is a **non-critical side effect**.

- **Rule**: *"A broken downstream email server or notification outage must NEVER fail the visitor submission."*
- **Mechanism**: Submissions are transactionally committed to PostgreSQL first. An outbox job is enqueued in `background_jobs`. The HTTP `201 Created` response returns immediately to the visitor.
- **Worker**: The `JobWorker` asynchronously processes notifications in the background, retrying on failure.

Verify with the automated test:
```powershell
npx vitest run tests/sideEffectFailure.test.js
```
Expected output:
```text
 ✓ tests/sideEffectFailure.test.js (2 tests)
   ✓ Submission succeeds and persists even when notification adapter throws an error
   ✓ Background job worker records failures and retries without breaking system integrity
```

---

### 21.7. Multi-Tenant Data Isolation

- **Rule**: Tenant A (`admin@acme.com`) and Tenant B (`owner@beta.com`) must never access or view each other's widgets or submissions.
- **Enforcement**: Every SQL query joins on `tenant_id = $1`.

Verify with the automated test:
```powershell
npx vitest run tests/tenantIsolation.test.js
```
Expected output:
```text
 ✓ tests/tenantIsolation.test.js (4 tests)
   ✓ Tenant B cannot view Tenant A widget (404 NOT_FOUND)
   ✓ Tenant B cannot update Tenant A widget (404 NOT_FOUND)
   ✓ Tenant B cannot delete Tenant A widget (404 NOT_FOUND)
   ✓ Tenant B dashboard cannot see Tenant A submissions
```

---

## 22. Running Automated Tests

The automated test suite runs via **Vitest & Supertest**. All 11 test suites are **100% deterministic** and do not depend on external live internet services.

Run the test suite in PowerShell:
```powershell
npm test
```
Expected output:
```text
 ✓ tests/geoFallback.test.js (4 tests)
 ✓ tests/auth.test.js (6 tests)
 ✓ tests/tenantIsolation.test.js (4 tests)
 ✓ tests/payloadValidation.test.js (5 tests)
 ✓ tests/sideEffectFailure.test.js (2 tests)
 ✓ tests/dashboard.test.js (4 tests)
 ✓ tests/cors.test.js (3 tests)
 ✓ tests/rateLimit.test.js (2 tests)
 ✓ tests/spamHoneypot.test.js (2 tests)
 ✓ tests/widget.test.js (6 tests)
 ✓ tests/acceptanceProbes.test.js (6 tests)

 Test Files  11 passed (11)
      Tests  44 passed (44)
   Duration  28.26s
```

---

## 23. Docker & Container Management

If you prefer to run PostgreSQL 16 and Mailpit in Docker containers:

### Start Containers
```powershell
docker compose up -d
```

### Check Container Health Status
```powershell
docker compose ps
```

### View Live Container Logs
```powershell
docker compose logs -f postgres
```

### Stop Containers
```powershell
docker compose down
```

### Stop & Clear Stored Container Data
```powershell
docker compose down -v
```

---

## 24. Windows-Specific Development Guidance

### PowerShell vs. Command Prompt
- In PowerShell, use backticks (`` ` ``) for multi-line commands and escape inner quotes in JSON payloads with backslashes (`{\"key\":\"value\"}`).
- In Command Prompt (`cmd.exe`), use carets (`^`) for multi-line continuation.

### Using `curl.exe` on Windows
Always specify `curl.exe` instead of `curl` in PowerShell to avoid invoking PowerShell's legacy `Invoke-WebRequest` alias.

---

## 25. Troubleshooting Common Issues

### 1. `Port 3000 or 5500 is already in use`
- **Cause**: An existing Node process or web server is already listening on port 3000 or 5500.
- **Solution**:
  ```powershell
  # Find the process ID listening on port 3000
  Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess
  # Terminate process if necessary
  Stop-Process -Id <PID> -Force
  ```
  Or change `PORT=3001` in `.env`.

### 2. `Docker not found / Docker daemon not running`
- **Resolution**: No action needed! The platform automatically activates its embedded WebAssembly PostgreSQL engine (`PGlite`) when Docker is absent. All database queries, migrations, and seeds work identically.

### 3. `401 Unauthorized on Dashboard or Widget APIs`
- **Cause**: Missing or expired Bearer token in the `Authorization` header.
- **Solution**: Re-authenticate via `POST /api/auth/login`, copy the `data.token`, and pass `Authorization: Bearer <TOKEN>`.

### 4. `429 Too Many Requests returned during manual testing`
- **Cause**: The IP sliding window limit was reached.
- **Solution**: Wait 60 seconds for the window to reset, or adjust `RATE_LIMIT_MAX_PER_IP=100` in `.env` for local testing.

### 5. `Widget does not appear on customer website`
- **Checks**:
  1. Verify the backend is running (`http://localhost:3000/health`).
  2. Ensure the widget ID in `customer-site/index.html` matches a valid seeded widget (`66ee7055-c3bc-48de-aeff-beed31d73868`).
  3. Check the Browser Console (`F12` $\rightarrow$ **Console**) for network errors.

---

## 26. Recommended 6-Minute Evaluation Demo

Follow this exact workflow during a live presentation:

1. **Minute 1 — Architecture & Health**:
   - Show `docker-compose.yml` and `.env.example`.
   - Run `curl.exe http://localhost:3000/health` (Show healthy status).
2. **Minute 2 — Authenticated Widget CRUD & Embed Generation**:
   - Login as `admin@acme.com` via Postman/Terminal.
   - Create a new widget; display the generated `<script>` embed snippet.
3. **Minute 3 — Cross-Origin Customer Site Rendering**:
   - Open `http://localhost:5500` in the browser.
   - Show Network DevTools: demonstrate the widget fetching `/widget.v1.js` and cached `/api/widgets/:id/config` cross-origin.
4. **Minute 4 — Form Submission & Geo Enrichment**:
   - Submit the form on `http://localhost:5500`.
   - Open `/api/dashboard/submissions` to show the newly stored row enriched with IP location data.
5. **Minute 5 — Active Defense Demonstration (Attack Yourself!)**:
   - **Honeypot**: Send a bot payload with `_hp_website` filled $\rightarrow$ Show instant `400 SPAM_DETECTED`.
   - **Rate Limiting**: Fire a burst of 35 submissions $\rightarrow$ Show `429 Too Many Requests`.
   - **Oversized Body**: Send 15KB body $\rightarrow$ Show `413 Payload Too Large`.
6. **Minute 6 — Resilience & Outbox Isolation**:
   - Run `npm test` to prove the 2-tier geo fallback chain and non-critical side-effect failure isolation.
   - Say the key sentence: *"Non-critical failures never break the main submission path."*

---

## 27. Capstone Specification & Definition of Done Mapping

| Section 6 Definition of Done Requirement | Implementation Location | Evidence Status |
| :--- | :--- | :--- |
| **Authenticated Widget CRUD & Auth Rejection** | `src/routes/widget.routes.js`, `src/middleware/auth.js` | Verified in `tests/auth.test.js` & `tests/widget.test.js` |
| **Multi-Tenant Isolation (Tenants cannot access other data)** | `src/services/widget.service.js`, `src/services/dashboard.service.js` | Verified in `tests/tenantIsolation.test.js` |
| **Embed Snippet Generation per Widget** | `src/services/widget.service.js` (`generateEmbedSnippet`) | Verified in `tests/widget.test.js` |
| **Public Config Endpoint with Cache Headers** | `src/controllers/widget.controller.js` (`getPublicConfig`) | Verified in `tests/widget.test.js` |
| **Versioned Script Delivery (`widget.v1.js`)** | `src/app.js` (`public/widget.v1.js`, 1y immutable cache) | Verified in `tests/widget.test.js` |
| **Cross-Origin Widget Rendering on Second Origin** | `customer-site/index.html` (Port 5500 $\rightarrow$ Port 3000) | Verified in `tests/cors.test.js` & manual browser demo |
| **CORS & Preflight Handling (`OPTIONS` -> 204)** | `src/middleware/cors.js` | Verified in `tests/cors.test.js` |
| **Boundary Validation & Oversized Body Protection** | `src/schemas/submission.schema.js`, `src/app.js` (`limit: 10kb`) | Verified in `tests/payloadValidation.test.js` |
| **Valid Submissions Linked to Tenant & Widget** | `src/services/submission.service.js` | Verified in `tests/acceptanceProbes.test.js` |
| **Rate Limiting per IP returning 429 under burst** | `src/middleware/rateLimit.js` | Verified in `tests/rateLimit.test.js` |
| **Honeypot Bot Spam Filtering** | `src/services/submission.service.js` (`_hp_website`) | Verified in `tests/spamHoneypot.test.js` |
| **IP $\rightarrow$ Geo Multi-Provider Fallback Chain** | `src/services/geo/geo.service.js` (`ip-api` $\rightarrow$ `ipapi.co`) | Verified in `tests/geoFallback.test.js` |
| **All Geo Providers Down Graceful Degradation** | `src/services/geo/geo.service.js` (Null geo fallback) | Verified in `tests/geoFallback.test.js` |
| **Safe Non-Critical Side Effects (Outage Isolation)** | `src/jobs/jobWorker.js`, `src/services/submission.service.js` | Verified in `tests/sideEffectFailure.test.js` |
| **Deterministic Automated Test Suite** | `tests/*.test.js` (44 tests, 11 files) | **100% Passing (0 Failures)** |
| **All 5 Required Submission Files Present** | `README.md`, `capstone.yaml`, `EVIDENCE.md`, `BUILDLOG.md`, `.env.example` | **All Present & Validated** |

---

## 28. Known Limitations & Future Roadmap

### Current Scope & Architectural Boundaries
- **Asset Delivery**: Static widget bundles are served directly via Express static middleware with cache headers. In a global multi-region cloud deployment, `widget.v1.js` would be fronted by Cloudflare CDN or AWS CloudFront.
- **Distributed Rate Limiting**: The rate limiter currently uses memory storage. In a distributed multi-node cluster, Redis-backed rate limiting would be utilized.
- **Frontend Scope**: Consistent with the backend capstone focus, the frontend UI is strictly vanilla HTML/JS without heavy frameworks.

### Future Roadmap
- **Real-Time Dashboard**: Push live submissions to the dashboard via Server-Sent Events (SSE) or WebSockets.
- **Targeting & Display Rules**: Trigger widgets based on scroll percentage, exit intent, or time-on-page.
- **Double Opt-In & GDPR Endpoints**: Consent record auditing and data deletion export endpoints.

---

## 29. License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.
