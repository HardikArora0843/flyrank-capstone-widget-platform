# EVIDENCE.md — Definition of Done Verification

This document provides concrete, verifiable evidence for every single checkbox in the **Definition of Done (Section 6)** of the FlyRank Capstone specification.

---

## 1. WIDGET MANAGEMENT

### [x] Authenticated CRUD endpoints for widgets; requests without valid auth are rejected.
**Evidence (Automated Test & Status Codes):**
From `tests/auth.test.js` & `tests/widget.test.js`:
```text
✓ tests/auth.test.js (6 tests)
  ✓ should register a new tenant and user successfully
  ✓ should reject duplicate email registration with 409
  ✓ should login an existing user and return JWT
  ✓ should reject invalid login credentials with 401
  ✓ should allow access to /api/auth/me with valid Bearer token
  ✓ should reject unauthenticated requests with 401 (UNAUTHORIZED)

✓ tests/widget.test.js (6 tests)
  ✓ should create a new widget with generated embed snippet (201 Created)
  ✓ should list all widgets for the authenticated tenant (200 OK)
  ✓ should get widget details by ID (200 OK)
  ✓ should update widget properties (200 OK)
```

Unauthenticated request rejection proof:
```json
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication token required in Authorization header"
  }
}
```

---

### [x] Multi-tenant isolation proven: tenant A cannot read or modify tenant B's widgets or submissions.
**Evidence (Automated Test in `tests/tenantIsolation.test.js`):**
```text
✓ tests/tenantIsolation.test.js (4 tests)
  ✓ Tenant B cannot view Tenant A widget (404 NOT_FOUND)
  ✓ Tenant B cannot update Tenant A widget (404 NOT_FOUND)
  ✓ Tenant B cannot delete Tenant A widget (404 NOT_FOUND)
  ✓ Tenant B dashboard cannot see Tenant A submissions (Strict isolation)
```

SQL enforcement snippet (`src/services/widget.service.js` & `src/services/dashboard.service.js`):
```sql
SELECT * FROM widgets WHERE id = $1 AND tenant_id = $2;
SELECT * FROM submissions WHERE tenant_id = $1 ORDER BY created_at DESC;
```

---

### [x] Embed snippet generated per widget.
**Evidence:**
When creating or fetching a widget (`POST /api/widgets` or `GET /api/widgets/:id`), the API generates the embed snippet referencing the active widget ID:
```json
{
  "id": "66ee7055-c3bc-48de-aeff-beed31d73868",
  "name": "Newsletter Signup",
  "type": "signup",
  "embedSnippet": "<script src=\"http://localhost:3000/widget.v1.js?id=66ee7055-c3bc-48de-aeff-beed31d73868\" async defer></script>"
}
```

---

## 2. WIDGET DELIVERY

### [x] Public config endpoint serves a small payload with correct HTTP cache headers.
**Evidence (`GET /api/widgets/66ee7055-c3bc-48de-aeff-beed31d73868/config`):**
```http
HTTP/1.1 200 OK
Access-Control-Allow-Origin: *
Cache-Control: public, max-age=60, stale-while-revalidate=30
Content-Type: application/json; charset=utf-8

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
  "allowedOrigins": ["http://localhost:5500", "http://127.0.0.1:5500", "http://localhost:3000", "*"]
}
```

---

### [x] Widget JavaScript is served as a versioned bundle (new version = new URL or cache-bust).
**Evidence (`GET /widget.v1.js`):**
```http
HTTP/1.1 200 OK
Content-Type: application/javascript; charset=utf-8
Cache-Control: public, max-age=31536000, immutable
Access-Control-Allow-Origin: *
```
Served from `public/widget.v1.js` with immutable 1-year cache header.

---

### [x] The widget renders on a page served from a different origin than your API.
**Evidence:**
- Backend API origin: `http://localhost:3000`
- Customer test site origin: `http://localhost:5500` (served via `node scripts/serveCustomerSite.js`)
- Customer site embeds:
  ```html
  <script src="http://localhost:3000/widget.v1.js?id=66ee7055-c3bc-48de-aeff-beed31d73868"></script>
  ```
- Script dynamically requests `http://localhost:3000/api/widgets/66ee7055-c3bc-48de-aeff-beed31d73868/config` cross-origin, injects container `#flyrank-widget-66ee7055-c3bc-48de-aeff-beed31d73868`, styles DOM, binds submit event, and posts to `http://localhost:3000/api/submissions`.

---

## 3. PUBLIC SUBMISSION API

### [x] Cross-origin submissions work: CORS headers correct, preflight (OPTIONS) handled.
**Evidence (`tests/cors.test.js`):**
```text
✓ tests/cors.test.js (3 tests)
  ✓ should respond to OPTIONS preflight requests with correct CORS headers and 204
  ✓ should handle cross-origin GET on widget config
  ✓ should handle cross-origin POST submission from authorized customer site
```

Preflight transcript:
```http
OPTIONS /api/submissions HTTP/1.1
Host: localhost:3000
Origin: http://localhost:5500
Access-Control-Request-Method: POST
Access-Control-Request-Headers: Content-Type, Idempotency-Key

HTTP/1.1 204 No Content
Access-Control-Allow-Origin: http://localhost:5500
Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
Access-Control-Allow-Headers: Origin, X-Requested-With, Content-Type, Accept, Authorization, Idempotency-Key
Access-Control-Max-Age: 86400
```

---

### [x] All incoming input validated; malformed and oversized payloads rejected with appropriate 4xx codes and JSON errors.
**Evidence (`tests/payloadValidation.test.js`):**
```text
✓ tests/payloadValidation.test.js (5 tests)
  ✓ should reject malformed JSON with clean 400 error (INVALID_JSON)
  ✓ should reject invalid payload structure with 400 VALIDATION_ERROR
  ✓ should reject missing required form fields with clean 400 error (FIELD_REQUIRED)
  ✓ should reject invalid email format with clean 400 error (INVALID_EMAIL)
  ✓ should reject oversized payloads (>10kb) with 413 PAYLOAD_TOO_LARGE
```

Oversized payload response (15KB payload):
```json
HTTP/1.1 413 Payload Too Large
Content-Type: application/json

{
  "error": {
    "code": "PAYLOAD_TOO_LARGE",
    "message": "Request payload exceeds the maximum allowed size (10kb)"
  }
}
```

---

### [x] Valid submissions stored safely, linked to the right widget and tenant.
**Evidence:**
```json
HTTP/1.1 201 Created
Content-Type: application/json

{
  "success": true,
  "submissionId": "b1fa67cb-95a2-4a7b-a36c-2f3b9c7df620",
  "message": "Submission received successfully"
}
```
Database record query result:
```sql
SELECT id, tenant_id, widget_id, data, ip_address, geo_country FROM submissions WHERE id = 'b1fa67cb-95a2-4a7b-a36c-2f3b9c7df620';
-- Result: 1 row linked to correct tenant_id & widget_id
```

---

## 4. ABUSE PROTECTION

### [x] Rate limiting per IP and/or per widget returns 429 under a burst — and the API keeps serving legitimate traffic.
**Evidence (`tests/rateLimit.test.js`):**
```text
✓ tests/rateLimit.test.js (2 tests)
  ✓ should allow normal requests within rate limit
  ✓ should reject burst requests with 429 Too Many Requests once limit is exceeded
```

429 Response transcript:
```json
HTTP/1.1 429 Too Many Requests
Retry-After: 60
Content-Type: application/json

{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many submissions from this IP address, please try again later.",
    "retryAfterSeconds": 60
  }
}
```

---

### [x] At least one spam-prevention technique (honeypot field, token, or heuristic) demonstrably blocks a spam submission.
**Evidence (`tests/spamHoneypot.test.js`):**
```text
✓ tests/spamHoneypot.test.js (2 tests)
  ✓ should reject bot submissions when honeypot field is filled (400 SPAM_DETECTED)
  ✓ should accept legitimate user submissions when honeypot field is empty
```

Server log on bot submission:
```text
[SubmissionService] Spam submission detected via honeypot field (value: http://buy-cheap-stuff-now.xyz). Rejecting.
```

---

## 5. ENRICHMENT & SAFE SIDE EFFECTS

### [x] IP→geo enrichment uses a provider fallback chain: provider A down → provider B answers → submission enriched.
**Evidence (`tests/geoFallback.test.js`):**
```text
✓ tests/geoFallback.test.js > Case 2: Primary provider fails -> Fallback to Provider B succeeds
  Log: [GeoService] Provider ip-api failed: 503 Service Unavailable / Timeout. Trying next fallback...
  Result: { country: "Germany", city: "Berlin", provider: "ipapi.co" }
```

---

### [x] All providers down → submission still succeeds (without geo). Degrade, never fail.
**Evidence (`tests/geoFallback.test.js` & `tests/acceptanceProbes.test.js`):**
```text
✓ tests/geoFallback.test.js > Case 3: All geo providers fail -> Graceful degradation with null geo
✓ tests/geoFallback.test.js > Integration: Submission persists successfully even when all geo providers are down
  Log: [GeoService] All geo providers failed or timed out. Degraded to null geo info.
  Result: HTTP 201 Created, geo_country: null, persisted in PostgreSQL.
```

---

### [x] A failing confirmation email / webhook does not prevent the submission from being stored.
**Evidence (`tests/sideEffectFailure.test.js`):**
```text
✓ tests/sideEffectFailure.test.js > Submission succeeds and persists even when notification adapter throws an error
  Log: [NotificationService] Notification dispatch failed: Simulated email adapter network / SMTP outage
  Result: HTTP 201 Created, submission persisted in database.
```

---

## 6. TESTS & DOCUMENTATION

### [x] Automated tests cover: CORS preflight, invalid payload, oversized payload, rate limiting, spam control, provider fallback, and successful widget rendering.
**Evidence (`npm test`):**
```text
 ✓ tests/geoFallback.test.js (4 tests) 969ms
 ✓ tests/auth.test.js (6 tests) 1726ms
 ✓ tests/tenantIsolation.test.js (4 tests) 1483ms
 ✓ tests/payloadValidation.test.js (5 tests) 1071ms
 ✓ tests/sideEffectFailure.test.js (2 tests) 1889ms
 ✓ tests/dashboard.test.js (4 tests) 1169ms
 ✓ tests/cors.test.js (3 tests) 1722ms
 ✓ tests/rateLimit.test.js (2 tests) 115ms
 ✓ tests/spamHoneypot.test.js (2 tests) 1742ms
 ✓ tests/widget.test.js (6 tests) 1845ms
 ✓ tests/acceptanceProbes.test.js (6 tests) 2150ms

 Test Files  11 passed (11)
      Tests  44 passed (44)
   Duration  28.30s
```

---

### [x] README with architecture diagram, setup instructions, and API documentation; the five submission-pack files from § 11 present.
**Evidence:**
All five required submission files are present and verified:
1. `README.md`
2. `capstone.yaml`
3. `EVIDENCE.md`
4. `BUILDLOG.md`
5. `.env.example`
6. `LICENSE` (MIT)
