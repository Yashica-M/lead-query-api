# Lead Filter Query API

A multi-tenant CRM **Lead Query Microservice** built with **Express + TypeScript + PostgreSQL + Knex**.

Implements `POST /api/v1/leads/query` with:
- Header-based auth simulation
- Role-based lead visibility
- AND/OR filter logic with system + custom EAV fields
- Free-text search
- Pagination & sorting
- Batch custom field hydration (no N+1)
- Request correlation ID on every response (`X-Request-ID`)

---

## Quick Reference — Fixed UUIDs

> Copy these directly into your curl commands — no lookup needed.

| Entity | UUID |
|--------|------|
| **Tenant A** | `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa` |
| **Tenant B** | `bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb` |
| **Admin A** | `00000000-0000-0000-0000-000000000001` |
| **Agent A1** | `11111111-1111-1111-1111-111111111111` |
| **Agent A2** | `22222222-2222-2222-2222-222222222222` |
| **City custom field** | `cccccccc-cccc-cccc-cccc-cccccccccccc` |

### Tenant A Leads

| Lead | Name | Phone | Assigned | Follow-up | City |
|------|------|-------|----------|-----------|------|
| L1 | Ram Kumar | 9000000001 | Agent A1 | 2026-08-10 | Chennai |
| L2 | Ramesh | 9000000002 | Agent A1 | 2026-07-01 | Madurai |
| L3 | Priya | 9000000003 | Agent A2 | — | Chennai |
| L4 | Anand | 9000000004 | — | 2026-08-15 | Coimbatore |
| L5 | Sita | 9000000005 | Agent A2 | 2026-08-01 | Chennai |

---

## Setup & Run

### Prerequisites

- **Node 20+**
- **PostgreSQL** (or Docker)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your DATABASE_URL if needed
```

Default `.env` works with Docker Compose (see below).

### 3a. Start PostgreSQL with Docker (recommended)

```bash
docker compose up -d
```

This starts PostgreSQL on port 5432 with:
- User: `crm_user`
- Password: `crm_password`
- Database: `crm_leads`

### 3b. Or use local PostgreSQL

Create a database and user:
```sql
CREATE DATABASE crm_leads;
CREATE USER crm_user WITH PASSWORD 'crm_password';
GRANT ALL PRIVILEGES ON DATABASE crm_leads TO crm_user;
```

Update `DATABASE_URL` in `.env` to match your setup.

### 4. Run migrations (creates tables)

```bash
npm run migrate
```

### 5. Seed sample data

```bash
npm run seed
```

### 6. Start the server

```bash
# Development (auto-reload on file changes)
npm run dev

# Production
npm run build && npm start

# Run unit tests
npm test
```

Server starts at: **http://localhost:3000**

Health check: `GET http://localhost:3000/health`

---

## Example curl Commands

### 1. Admin: All Tenant A leads (empty filters)

```bash
curl -s -X POST 'http://localhost:3000/api/v1/leads/query?page=1&limit=20' \
  -H 'content-type: application/json' \
  -H 'x-tenant-id: aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' \
  -H 'x-user-id: 00000000-0000-0000-0000-000000000001' \
  -H 'x-user-role: admin' \
  -d '{}' | jq .
# Expected: all 5 Tenant A leads
```

### 2. Agent A1: Only their leads (L1, L2)

```bash
curl -s -X POST 'http://localhost:3000/api/v1/leads/query?page=1&limit=20' \
  -H 'content-type: application/json' \
  -H 'x-tenant-id: aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' \
  -H 'x-user-id: 11111111-1111-1111-1111-111111111111' \
  -H 'x-user-role: agent' \
  -d '{}' | jq .
# Expected: L1 (Ram Kumar), L2 (Ramesh)
```

### 3. Admin: City contains Chennai AND assignedTo is Agent A2 → L3, L5

```bash
curl -s -X POST 'http://localhost:3000/api/v1/leads/query' \
  -H 'content-type: application/json' \
  -H 'x-tenant-id: aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' \
  -H 'x-user-id: 00000000-0000-0000-0000-000000000001' \
  -H 'x-user-role: admin' \
  -d '{
    "logic": "AND",
    "filters": [
      {
        "fieldId": "cccccccc-cccc-cccc-cccc-cccccccccccc",
        "fieldType": "string",
        "condition": "contain",
        "value": "Chennai"
      },
      {
        "fieldId": "assignedTo",
        "fieldType": "string",
        "condition": "is",
        "value": "22222222-2222-2222-2222-222222222222",
        "inputType": "multiselect"
      }
    ]
  }' | jq .
# Expected: Priya (L3), Sita (L5)
```

### 4. OR filter: name contains Ram OR name contains Sita → L1, L2, L5

```bash
curl -s -X POST 'http://localhost:3000/api/v1/leads/query' \
  -H 'content-type: application/json' \
  -H 'x-tenant-id: aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' \
  -H 'x-user-id: 00000000-0000-0000-0000-000000000001' \
  -H 'x-user-role: admin' \
  -d '{
    "logic": "OR",
    "filters": [
      { "fieldId": "name", "fieldType": "string", "condition": "contain", "value": "Ram" },
      { "fieldId": "name", "fieldType": "string", "condition": "contain", "value": "Sita" }
    ]
  }' | jq .
# Expected: Ram Kumar (L1), Ramesh (L2), Sita (L5)
```

### 5. Free-text search: q=9000000003 → finds Priya

```bash
curl -s -X POST 'http://localhost:3000/api/v1/leads/query' \
  -H 'content-type: application/json' \
  -H 'x-tenant-id: aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' \
  -H 'x-user-id: 00000000-0000-0000-0000-000000000001' \
  -H 'x-user-role: admin' \
  -d '{ "q": "9000000003" }' | jq .
# Expected: Priya (phone match)
```

### 6. Multiselect: both agents → L1, L2, L3, L5

```bash
curl -s -X POST 'http://localhost:3000/api/v1/leads/query' \
  -H 'content-type: application/json' \
  -H 'x-tenant-id: aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' \
  -H 'x-user-id: 00000000-0000-0000-0000-000000000001' \
  -H 'x-user-role: admin' \
  -d '{
    "filters": [{
      "fieldId": "assignedTo",
      "fieldType": "string",
      "condition": "is",
      "value": "11111111-1111-1111-1111-111111111111,22222222-2222-2222-2222-222222222222",
      "inputType": "multiselect"
    }]
  }' | jq .
# Expected: L1, L2, L3, L5 (Anand L4 is unassigned)
```

### 7. Pagination: page 2 of limit 2

```bash
curl -s -X POST 'http://localhost:3000/api/v1/leads/query?page=2&limit=2&sortBy=createdAt&sortDirection=asc' \
  -H 'content-type: application/json' \
  -H 'x-tenant-id: aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' \
  -H 'x-user-id: 00000000-0000-0000-0000-000000000001' \
  -H 'x-user-role: admin' \
  -d '{}' | jq .
# Expected: Priya (L3), Anand (L4); meta.totalRecords=5, meta.totalPages=3
```

### 8. Error: invalid operator → 400

```bash
curl -s -X POST 'http://localhost:3000/api/v1/leads/query' \
  -H 'content-type: application/json' \
  -H 'x-tenant-id: aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' \
  -H 'x-user-id: 00000000-0000-0000-0000-000000000001' \
  -H 'x-user-role: admin' \
  -d '{
    "filters": [{ "fieldId": "name", "fieldType": "string", "condition": "greater than", "value": "test" }]
  }' | jq .
# Expected: 400 { "message": "Condition \"greater than\" is not valid for field \"name\"...", "statusCode": 400 }
```

### 9. Error: missing headers → 401

```bash
curl -s -X POST 'http://localhost:3000/api/v1/leads/query' \
  -H 'content-type: application/json' \
  -d '{}' | jq .
# Expected: 401 { "message": "Missing required header: x-tenant-id", "statusCode": 401 }
```

---

## Design Decisions & Tradeoffs

### Query Builder: Knex over Prisma/Drizzle

This problem requires **dynamic SQL** — the WHERE clause changes on every request based on which filters are sent. Knex's `db.raw()` with parameterized bindings gives full SQL control while still preventing SQL injection. Prisma's query builder doesn't support the dynamic EXISTS subquery patterns needed for EAV filtering cleanly.

**Tradeoff:** More verbose than Prisma, but total control over query structure.

### EAV Custom Fields with EXISTS Subqueries

Custom field values are stored as text in a separate table (EAV pattern). Filters use `EXISTS (SELECT 1 FROM lead_custom_field_values WHERE lead_id = leads.id AND field_id = ? AND ...)` subqueries.

**Why EXISTS, not JOIN?**
A JOIN would multiply rows if a lead has multiple custom fields, making COUNT and distinct lead results incorrect. EXISTS is a correlated subquery that returns one boolean per lead — clean and correct.

**Tradeoff:** EXISTS subqueries are slightly slower than JOINs on small datasets but scale correctly and avoid row duplication bugs.

### "is empty" for Custom Fields

`is empty` means: **no EAV row exists for that field_id** (the lead has no value for this field) OR the value is an empty string. This is documented here so behavior is consistent.

### Batch Hydration (No N+1)

After fetching the page of leads, all custom field values are fetched in a **single query** using `WHERE lead_id = ANY(array_of_ids)`. Results are grouped by `lead_id` in JavaScript, then attached to each lead. This means **3 DB queries total** per request (COUNT, data, custom fields) regardless of page size.

### Null Handling for Sorting

When `sortBy=followUpDate&sortDirection=asc`, leads without a follow-up date (`null`) are pushed to the end using `ORDER BY follow_up_date ASC NULLS LAST`. PostgreSQL's default is `NULLS FIRST` for ASC, which would be confusing in a CRM context.

---

## Indexes for Production

The following indexes would be critical under real filter load:

```sql
-- Always filtered by tenant_id (most important)
CREATE INDEX idx_leads_tenant_id ON leads(tenant_id);

-- Role-based visibility (agents filter by assigned_to)
CREATE INDEX idx_leads_assigned_to ON leads(tenant_id, assigned_to);

-- Sort columns (common in pagination)
CREATE INDEX idx_leads_created_at ON leads(tenant_id, created_at DESC);
CREATE INDEX idx_leads_follow_up_date ON leads(tenant_id, follow_up_date ASC NULLS LAST);

-- EAV table: fast EXISTS subqueries
CREATE INDEX idx_lcfv_field_lead ON lead_custom_field_values(field_id, lead_id);

-- Free-text search (if high traffic): consider pg_trgm extension + GIN index
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_leads_name_trgm ON leads USING GIN (name gin_trgm_ops);
```

---

## Project Structure

```
lead-query-api/
├── api/
│   └── index.ts              # Vercel serverless entry point
├── src/
│   ├── index.ts              # Server startup (local dev)
│   ├── app.ts                # Express config
│   ├── errors.ts             # HTTP error classes
│   ├── middleware/
│   │   ├── auth.ts           # Header-based auth
│   │   ├── requestId.ts      # Correlation ID header
│   │   └── errorHandler.ts   # Global error formatter
│   ├── db/
│   │   ├── client.ts         # Knex singleton
│   │   ├── migrations/       # Table creation scripts
│   │   └── seeds/            # Sample data
│   ├── types/
│   │   ├── express.d.ts      # Extend req.currentUser
│   │   └── leadFilter.ts     # All domain types
│   ├── schemas/
│   │   └── queryLeads.ts     # Zod validation schemas
│   ├── routes/
│   │   └── leads.ts          # Route: POST /query
│   ├── controllers/
│   │   └── queryLeads.ts     # Thin request handler
│   └── services/
│       ├── visibility.ts     # Role-based SQL clause
│       ├── filters.ts        # Filter DSL → SQL compiler
│       └── leads.ts          # Query orchestrator
├── tests/
│   └── filters.test.ts       # Unit tests for filter DSL
├── knexfile.ts               # Knex CLI config
├── jest.config.json          # Jest config
├── vercel.json               # Vercel routing
├── docker-compose.yml        # PostgreSQL for local dev
├── .env.example              # Environment template
└── README.md
```

---

## What I'd Improve

1. **Full-text search index** — add `pg_trgm` GIN index on name/phone for production-scale search instead of ILIKE
2. ~~**Unit tests**~~ — done: `tests/filters.test.ts` covers the DSL compiler (10 tests, pure functions, no DB needed)
3. **OpenAPI spec** — auto-generate from Zod schemas using `zod-to-openapi`
4. **Request logging** — add `morgan` middleware to log method, path, status, duration
5. **Cursor-based pagination** — keyset pagination is more stable than OFFSET for large tables (OFFSET gets slower as page number increases)
6. **Custom field type validation** — validate that a custom field's declared type matches the operator before running the query
