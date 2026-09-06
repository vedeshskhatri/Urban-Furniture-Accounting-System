# Urban Furniture — Accounting System

> **A production-grade, double-entry accounting platform built for a furniture business.** Modelled on the Odoo accounting module architecture — without using Odoo. Runs entirely offline inside Docker Compose.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Feature Set](#2-feature-set)
3. [Tech Stack](#3-tech-stack)
4. [System Architecture](#4-system-architecture)
5. [Data Flow](#5-data-flow)
6. [Double-Entry Posting Mechanics](#6-double-entry-posting-mechanics)
7. [Authorisation Model](#7-authorisation-model)
8. [Module Breakdown](#8-module-breakdown)
9. [Database Schema](#9-database-schema-key-tables)
10. [API Reference](#10-api-reference)
11. [Design System](#11-design-system)
12. [Getting Started](#12-getting-started)
13. [Environment Variables](#13-environment-variables)
14. [Accounting Correctness Rules](#14-accounting-correctness-rules)
15. [Team & Module Ownership](#15-team--module-ownership)

---

## 1. Project Overview

Urban Furniture is a full-stack accounting information system implementing:

- **Double-entry bookkeeping** — every transaction creates balanced journal entries (∑ Debits = ∑ Credits), enforced by a PostgreSQL deferred constraint trigger at the database level.
- **Full purchase-to-payment cycle** — Purchase Orders → Vendor Bills → Payments, with automatic ledger posting.
- **Full sales-to-receipt cycle** — Sales Orders → Customer Invoices → Receipts, with tax recognition and ledger posting.
- **Three financial reports** — Balance Sheet (cumulative as-of date), Profit & Loss (date range), Budget Report (period-bound).
- **Customer self-service portal** — contacts log in, view their invoices and bills, and make online payments via Razorpay.
- **AI CFO Copilot** — a local Ollama-backed LLM that answers accounting questions about live ledger data.
- **Room Studio** — an interactive 3D room visualiser for the furniture catalogue, built entirely in the browser.

**Key constraint:** the system runs 100% offline. No CDNs, no external APIs (except Razorpay for payment gateway and Ollama running locally), no hosted fonts. Everything runs with the network cable pulled out.

---

## 2. Feature Set

### Master Data

| Entity | Key Fields |
|---|---|
| **Contact** | Name, Type (Customer / Vendor / Both), Email, Mobile, Address, City, State, Pincode, Profile Image, GSTIN |
| **Product** | Name, Type (Goods / Service / Combo), Sales Price, Cost, Category, Images (multi-angle 360° viewer) |
| **Chart of Accounts** | Name, Type (Asset / Liability / Bank / Cash / Capital / Income / Expenses / Other Expenses) |
| **Journal** | Name, Type, Default Debit Account, Default Credit Account |
| **Journal Entry** | Journal, Date, Reference, Lines (Account + Partner + Debit + Credit), Status (Draft / Posted) |
| **Analytic Account** | Name, Type (Income / Expense) — used for budget tracking |
| **Budget** | Name, Period (Start–End), Responsible Person, Lines (Analytic Account + Committed Amount) |

### Transactions

| Document | Trigger for Journal Entry |
|---|---|
| **Purchase Order** | ❌ No entry on confirm |
| **Vendor Bill** | ✅ Entry posted on Bill confirm |
| **Sales Order** | ❌ No entry on confirm |
| **Customer Invoice** | ✅ Entry posted on Invoice confirm |
| **Payment** | ✅ Entry posted immediately |

### Reports

- **Balance Sheet** — real-time Assets, Liabilities, Equity (Capital + retained earnings). Takes a single as-of date.
- **Profit & Loss** — Revenue minus Expenses, net profit. Takes a date range (BETWEEN start and end).
- **Budget Report** — Committed vs Achieved amounts per analytic account, with drill-down to source documents.
- **Analytics Dashboard** — Receivable ageing, payable ageing, cash flow, top customers/vendors.
- **GST Report** — GSTR-1 / GSTR-3B style output tax and input tax reconciliation.
- **Audit Feed** — chronological log of every mutation with actor, timestamp, and diff.
- **Ledger Drill-down** — Report line → account ledger → journal entries → source document (4-level chain).

### Roles

| Role | Capabilities |
|---|---|
| **Admin** | Full access — create/modify/archive master data, post transactions, view all reports |
| **Accountant** | Same as Admin except cannot manage users |
| **Contact (Portal User)** | View own invoices/bills only. Make payments online. Cannot see other contacts' documents. |
| **System** | Validates data, enforces balance, computes payment status from views |

### Auth Rules (from mockup spec)

- Login ID: unique, 6–12 characters
- Password: >8 chars, one lowercase, one uppercase, one special character
- Email: unique across the system
- Login error text exactly: `Invalid Login Id or Password`
- Signup creates **Accountants only** (not admins)
- Forgot Password flow supported

---

## 3. Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| **Frontend** | React 18 + Vite + Tailwind CSS | Fast HMR, team proficiency |
| **Backend** | Node 20 + Express + TypeScript | TypeScript is non-negotiable for money code |
| **Database** | PostgreSQL 16 | Reviewers specifically care about PostgreSQL |
| **ORM** | Prisma (migrations) + raw `pg` (transactions) | Prisma for schema management; raw `pg` for deferred-trigger transactions |
| **Auth** | Self-built JWT in httpOnly cookies + Argon2id | No BaaS. SHA-256 or plaintext = disqualification |
| **Validation** | Zod — schemas shared client + server | Single source of truth via `shared/schemas/` |
| **Money** | `DECIMAL(14,2)` in PostgreSQL + `decimal.js` in JS | Floats produce ₹0.01 drift and kill the correctness demo |
| **Forms** | React Hook Form + Zod resolver | |
| **Server state** | React Query (TanStack Query) | Cache invalidation after mutations |
| **Charts** | Recharts | Budget pie, dashboard trends |
| **PDF** | Puppeteer HTML→PDF, server-side | Deterministic output; never a browser print dialog |
| **Real-time** | Socket.IO | Live report updates; ledger flash on post |
| **Search** | PostgreSQL `tsvector` full-text search | No Elasticsearch needed at this scale |
| **AI Copilot** | Ollama (local) + `qwen2.5:7b` model | Fully offline LLM, no external API |
| **Payments** | Razorpay (payment gateway) | Online payments from the customer portal |
| **Containers** | Docker Compose: `api`, `web`, `db`, `ollama` | Containerisation is evaluated |

### Pinned Versions

```
node 20.x · postgres 16 · react 18.3 · vite 5 · tailwind 3.4
prisma 5.x · zod 3.23 · decimal.js 10.4 · socket.io 4.7 · puppeteer 22
```

### Deliberately Not Used

| Rejected | Reason |
|---|---|
| Odoo itself | Using their engine means we configured, not built |
| Any LLM API (Gemini, OpenAI) | External API, violates offline constraint |
| Redis | Cannot name the query it fixes at demo scale |
| Auth0 / Clerk / Firebase | BaaS — instant disqualification |
| Google Fonts CDN | External network call — fonts are self-hosted as `.woff2` |
| Floats for money | Non-negotiable correctness requirement |
| Elasticsearch | PostgreSQL FTS is sufficient and more impressive here |

---

## 4. System Architecture

```
┌──────────────────────────── Docker Compose ────────────────────────────┐
│                                                                         │
│  web (React + Vite)                      api (Express + TypeScript)     │
│  ┌─────────────────────┐                ┌──────────────────────────┐   │
│  │  Admin App          │                │  routes/      (thin)     │   │
│  │  (/dashboard, /sales│ ──httpOnly──▶  │  middleware/  (auth/role) │   │
│  │   /purchase, etc.)  │   cookie JWT   │  services/   (all logic) │   │
│  │                     │                │  db/          (Prisma+pg) │   │
│  │  Contact Portal     │                └──────────┬───────────────┘   │
│  │  (/portal/...)      │                           │                   │
│  └────────┬────────────┘                           ▼                   │
│           │                              db (PostgreSQL 16)             │
│           │◀──── Socket.IO (real-time ledger events) ──────────────────│
│                                                                         │
│  ollama (qwen2.5:7b) ◀── CFO Copilot queries ── api                   │
└─────────────────────────────────────────────────────────────────────────┘
                  No outbound network. Runs offline.
```

### Backend Layer Contract

```
routes/          Parse request → call service → shape { data, error } response
    ↓
middleware/      authenticate (JWT) → check role → apply scope
    ↓
services/        ALL business logic lives here. No logic in routes.
    ↓
db/              Prisma (migrations, simple queries) + raw pg (transactions)
```

**The critical invariant:** `postingService.ts` is the **only** module that writes to `journal_entries` and `journal_entry_lines`. Vendor bill and invoice services call `postDocument()`. Nobody else inserts ledger rows.

---

## 5. Data Flow

### Request Lifecycle

Every API call goes through this exact sequence:

```
Browser
  → Cookie parsed → JWT verified → user object loaded
  → Role check    (can this role access this resource type at all?)
  → Scope applied (which specific rows can this user see?)
  → Zod validates request body
  → Service runs inside a pg transaction
  → audit_log written (every mutation)
  → { data: T, error: null } or { data: null, error: { code, message, severity, fields? } }
  → Response returned to browser
```

**API Contract — uniform envelope:**

```ts
// Success
{ data: T, error: null }

// Failure
{ data: null, error: {
    code: string,
    message: string,
    severity: 'blocking' | 'warning',  // drives which UI component renders
    fields?: Record<string, string>     // per-field validation errors
}}
```

`severity: 'blocking'` → action button is disabled, red bar shown.
`severity: 'warning'` → dashed yellow border shown, action button stays enabled.

**Money across the wire is always a string:** `"5000.00"`. Parsed with `decimal.js` on both sides.

---

### Vendor Bill → Journal Entry Flow

```
User: Confirm Bill
        │
        ▼
POST /api/bills/:id/confirm
        │
        ▼
  ┌─── BEGIN TRANSACTION ───────────────────────────────────────────────┐
  │                                                                      │
  │  1. SELECT bill + lines FOR UPDATE (assert status = 'draft')        │
  │                                                                      │
  │  2. Budget check per line's analytic account                         │
  │     → if committed amount exceeded: attach NON-BLOCKING warning      │
  │       (do NOT stop the transaction)                                  │
  │                                                                      │
  │  3. Assign document number                                           │
  │     SequenceService.nextDocNumber('BILL')  ← row-lock on sequences  │
  │     → Bill/2026/0001 (gapless, race-safe)                           │
  │                                                                      │
  │  4. Create journal_entry row (status = 'draft', journal = Purchase)  │
  │                                                                      │
  │  5. Create journal_entry_lines:                                      │
  │     DR  Purchase Expense  (per line, with analytic_account_id)      │
  │     DR  Input Tax Credit  (if tax > 0)                              │
  │     CR  Creditors         (partner = vendor, grand total)           │
  │                                                                      │
  │  6. Set journal_entry.status = 'posted'                             │
  │     → PostgreSQL deferred trigger trg_lines_balanced fires           │
  │       on COMMIT: asserts ∑ debits = ∑ credits                       │
  │                                                                      │
  │  7. vendor_bill.status = 'confirmed'                                 │
  │     vendor_bill.journal_entry_id = entry.id                         │
  │                                                                      │
  │  8. stock_moves: +qty per goods line                                 │
  │                                                                      │
  │  9. audit_log: actor, action, timestamp, diff                       │
  │                                                                      │
  └─── COMMIT (trigger validates balance; rolls back if unbalanced) ───┘
        │
        ▼
  Response: { data: { billId, entryId }, error: null }
  (with optional NON-BLOCKING warning if budget was overrun)
```

> **Idempotent:** If the bill already has `journal_entry_id`, `postDocument()` returns immediately. Double-clicking confirm never creates two entries.

---

### Customer Invoice → Journal Entry Flow

Mirror image of the bill flow — same service, same guarantees.

```
User: Confirm Invoice
        │
        ▼
POST /api/invoices/:id/confirm
        │
        ▼
  ┌─── BEGIN TRANSACTION ────────────────────────────────────────────────┐
  │                                                                       │
  │  1. SELECT invoice + lines FOR UPDATE (assert status = 'draft')      │
  │                                                                       │
  │  2. Assign document number                                            │
  │     SequenceService.nextDocNumber('INV') → INV/2026/0001             │
  │                                                                       │
  │  3. Create journal_entry row (journal = Sales)                        │
  │                                                                       │
  │  4. Create journal_entry_lines:                                       │
  │     DR  Debtors         (partner = customer, grand total)            │
  │     CR  Sales Income    (per line, with analytic_account_id)         │
  │     CR  Output Tax      (partner = customer, if tax > 0)             │
  │                                                                       │
  │     ⚠  Revenue is recognised HERE — not at payment.                  │
  │        Payment entry NEVER touches Income accounts.                  │
  │                                                                       │
  │  5. Set journal_entry.status = 'posted'                              │
  │     → trg_lines_balanced fires on COMMIT                             │
  │                                                                       │
  │  6. customer_invoice.status = 'confirmed'                             │
  │  7. stock_moves: -qty per goods line                                  │
  │  8. audit_log                                                         │
  │                                                                       │
  └─── COMMIT ────────────────────────────────────────────────────────────┘
```

---

### Payment Flow

```
User: Register Payment (amount, method: Cash|Bank, allocations)
        │
        ▼
POST /api/payments
        │
        ▼
  ┌─── BEGIN TRANSACTION ────────────────────────────────────────────────┐
  │                                                                       │
  │  1. Validate allocations: SUM(allocations) = payment.amount          │
  │                                                                       │
  │  2. Per target document, assert:                                      │
  │     allocation ≤ amount_due  (computed from v_invoice_status view)   │
  │     ← status is NEVER stored; always computed on read                 │
  │                                                                       │
  │  3. Create payment record + payment_allocations rows                  │
  │                                                                       │
  │  4. Create journal_entry_lines:                                       │
  │                                                                       │
  │     Inbound (Customer pays us):                                       │
  │       DR  Cash | Bank                                                 │
  │       CR  Debtors (partner = customer)                               │
  │       ← NEVER touches Income account                                  │
  │                                                                       │
  │     Outbound (We pay vendor):                                         │
  │       DR  Creditors (partner = vendor)                               │
  │       CR  Cash | Bank                                                 │
  │       ← NEVER touches Expense account                                 │
  │                                                                       │
  │  5. audit_log                                                         │
  │                                                                       │
  └─── COMMIT ────────────────────────────────────────────────────────────┘
        │
        ▼
  Payment status recomputed on every read from v_invoice_status:
  Paid (due = 0) | Partial (0 < due < total) | Not Paid (due = total)
```

> **One payment can settle multiple invoices/bills.** Partial payment leaves a residual that the view recalculates automatically.

---

### Report Computation Flow

All three reports read **exclusively** from `journal_entry_lines` joined to posted `journal_entries`. They never read from document tables.

```
GET /api/reports/balance-sheet?asOf=2026-09-06
        │
        ▼
  SELECT account type, SUM(debit - credit)
  FROM journal_entry_lines jl
  JOIN journal_entries je ON je.id = jl.journal_entry_id
  WHERE je.status = 'posted'
    AND je.date <= $asOf          ← cumulative up to date
  GROUP BY account type
        │
        ▼
  Assets  = Σ (Asset + Bank + Cash accounts)
  Liab    = Σ (Liability + Creditors)
  Capital = Σ (Capital) + Net Income (Income - Expenses this period)

  Assets = Liabilities + Capital. PostgreSQL trigger enforces it at rest.
```

| Report | Date Semantics |
|---|---|
| Profit & Loss | `BETWEEN start AND end` — period income/expense only |
| Balance Sheet | `<= asOf` — cumulative from inception |
| Budget Report | Within budget period — matched by analytic_account_id |

**Drill-down chain:** Report line → Account Ledger → Journal Entries → Source Document (4 levels, filtered via `v_ledger_detail`)

---

## 6. Double-Entry Posting Mechanics

### Vendor Bill Confirm

```
DR  Purchase Expense   [line subtotal excl. tax]  (analytic: budget line, partner: vendor)
DR  Input Tax Credit   [tax total]                (partner: vendor, skipped if tax = 0)
CR  Creditors          [grand total]              (partner: vendor)
```

### Customer Invoice Confirm

```
DR  Debtors            [grand total]              (partner: customer)
CR  Sales Income       [line subtotal excl. tax]  (analytic: budget line, partner: customer)
CR  Output Tax Payable [tax total]                (partner: customer, skipped if tax = 0)
```

### Payment — Inbound (Customer pays us)

```
DR  Cash | Bank
CR  Debtors            (partner: customer)
← Revenue already recognised at invoice. This is purely a settlement entry.
```

### Payment — Outbound (We pay vendor)

```
DR  Creditors          (partner: vendor)
CR  Cash | Bank
← Expense already recognised at bill. This is purely a settlement entry.
```

### Balance Invariant

A PostgreSQL `DEFERRABLE INITIALLY DEFERRED` trigger (`trg_lines_balanced`) fires on `COMMIT`. It asserts:

```sql
SELECT SUM(debit) = SUM(credit)
FROM journal_entry_lines
WHERE journal_entry_id = $entry_id
```

If this assertion fails, PostgreSQL rolls back the entire transaction. The application cannot produce an unbalanced entry — it is structurally impossible.

---

## 7. Authorisation Model

Route guards fail when someone forgets to add one endpoint. That is exactly how portal IDOR vulnerabilities happen.

Instead, a single scoping function is applied at the **data layer** on every query:

```ts
// scopeFor rewrites the WHERE clause, not the route
scopeFor(user, 'invoice')
  admin | accountant  →  {}                           // no restriction
  contact             →  { customerId: user.contactId }  // only their rows
```

This is modelled directly on Odoo's record rules. URL parameter tampering (`/portal/invoices/123` → `/portal/invoices/999`) becomes structurally impossible rather than defensively patched.

**Reviewers will log in as a contact and change the invoice ID in the URL. The response must be 403, not someone else's invoice.**

---

## 8. Module Breakdown

### Sales Module

**Pages:** `SalesOrderFormPage`, `SalesOrderListPage`, `CustomerInvoiceFormPage`, `CustomerInvoiceListPage`, `ReceivablesPage`, `RegisterPaymentPage`

**Flow:**

```
Sales Order (draft)
    → Confirm SO        [no journal entry]
    → Create Invoice    [invoice generated from SO lines]
    → Confirm Invoice   [DR Debtors / CR Sales Income + Tax]
    → Register Payment  [DR Cash|Bank / CR Debtors]
```

**Key fields on Invoice:**
- Customer, Invoice Date, Due Date, Lines (Product, Qty, Unit Price, Tax %)
- Bill Reference (free text — customer's PO number)
- Payment status: `Not Paid` / `Partial` / `Paid` — computed from view, never stored
- Footer: Paid Via Cash, Paid Via Bank, Amount Due

**Numbering:** Sales Order: `SO/2026/0001` · Invoice: `INV/2026/0001`

---

### Purchase Module

**Pages:** `POFormPage`, `POListPage`, `VendorBillFormPage`, `VendorBillListPage`

**Flow:**

```
Purchase Order (draft)
    → Confirm PO        [no journal entry; optional NON-BLOCKING budget warning]
    → Create Bill       [bill generated from PO lines]
    → Confirm Bill      [DR Purchase Expense + Tax / CR Creditors]
    → Register Payment  [DR Creditors / CR Cash|Bank]
```

**Key fields on Bill:**
- Vendor, Bill Date, Due Date, Bill Reference (vendor's invoice number — separate from system number)
- Lines: Product, Chart of Account (defaults to Purchase Expense), Budget Analytics, Qty, Unit Price
- Smart Buttons:
  - **PO button** — visible only if bill originated from a PO
  - **Budget button** — opens the analytic/budget report for this bill's analytic

**Numbering:** Purchase Order: `P00001` · Vendor Bill: `Bill/2026/0001`

**Budget warning on PO confirm:** If the committed amount for a budget line is exceeded, a `NON-BLOCKING` warning is shown. The user can dismiss it and confirm anyway.

---

### Accounting Master Data

**Pages:** `AccountListPage/Form`, `ContactListPage/Form`, `ProductListPage/Form`, `JournalListPage/Form`, `JournalEntryListPage/Form`, `AnalyticListPage/Form`

#### Chart of Accounts

Eight account types in two groups:

| Group | Types |
|---|---|
| **Balance Sheet** | Asset, Liability, Bank, Capital, Cash |
| **Profit & Loss** | Income, Expenses, Other Expenses |

Group headings are display-only labels — not selectable. Account type drives placement in Balance Sheet vs P&L.

**Pre-seeded accounts:** Bank, Purchase Expense, Debtors/Receivables, Creditors/Payables, Sales Income, Cash, Other Expense, Capital

#### Journals

Pre-seeded with defaults:
- Sales Journal → Sales Income (default credit account)
- Purchase Journal → Purchase Expense (default debit account)
- Bank Journal → Bank account
- Cash Journal → Cash account

#### Journal Entries (Manual)

- Partner is on the **line**, not the entry header
- Status: Draft / Posted
- `BLOCKING` warning when debit ≠ credit (action disabled)
- A manual journal entry with no source document **moves the P&L directly**
- Posted entries are **immutable** — corrections via reversal only

#### Contacts

- Type: Customer, Vendor, or Both
- GSTIN field for GST compliance
- Profile image upload
- Vendor Statement page (AP ledger per vendor)

#### Products

- Type: Goods, Service, Combo
- Multi-angle product images (360° viewer in portal)
- Cost price + Sales price

---

### Budget Module

**Pages:** `BudgetFormPage`, `BudgetListPage`

**Stages:**

```
New → Draft → Confirmed → (Revise) → Revised
                        → Cancel   → Cancelled
```

- **Revise** button is visible only at `Confirmed` stage
- Revising creates a **new** budget record; old moves to `Revised`
- Both directions are linked: original ↔ revision (bidirectional FK)
- Name convention: original name + `" Revised"`

**Budget Lines:**

| Field | Description |
|---|---|
| Analytic Account | The cost/revenue centre |
| Committed Amount | The planned budget |
| Achieved Amount | Computed: matching analytic lines in period |
| Achieved % | `(Achieved / Committed) × 100` |
| Amount to Achieve | `Committed − Achieved` |

**Achieved Amount is clickable** — opens a filtered list of Invoices/Bills that have this analytic account in this budget period.

**Computation:**
- Income analytic → sum of confirmed invoice lines with that analytic in the period
- Expense analytic → sum of confirmed bill lines with that analytic in the period

---

### Reports

**Pages:** `BalanceSheetPage`, `ProfitLossPage`, `BudgetReportPage`, `AnalyticsPage`, `GstReportPage`, `AuditFeedPage`

#### Balance Sheet
- Takes a single as-of date
- `Assets = Liabilities + Capital + (Income − Expenses)`
- Net profit flows into equity — the sheet must balance
- PDF export via Puppeteer

#### Profit & Loss
- Takes a start date and end date (BETWEEN)
- Income accounts minus Expense accounts = net profit
- PDF export

#### Budget Report
- Committed vs Achieved vs Remaining per budget line
- Achieved is clickable → drill-down to source documents

#### Analytics Dashboard
- Receivable ageing buckets (current, 1–30 days, 31–60, 60+ overdue)
- Payable ageing buckets
- Cash flow trend (rolling 6 months)
- Top customers by revenue, top vendors by spend
- Charts via Recharts

#### GST Report
- GSTR-1 style output tax summary
- GSTR-3B style input tax credit summary
- Reconciliation of output vs input tax

#### Integrity / Verify Page
- `GET /api/verify` — asserts ∑ debits = ∑ credits across all posted entries
- Returns `difference: "0.00"` if the ledger is balanced

---

### Customer Portal

**Pages:** `PortalLogin`, `PortalDashboardPage`, `PortalInvoiceList`, `PortalInvoiceDetail`, `PortalBillList`, `PortalBillDetail`, `PortalPaymentList`, `PortalCataloguePage`, `PortalProductViewerPage`, `PortalRoomStudioPage`

**Access:** Contacts receive an invite email → set their own password → log in at `/portal`

**Capabilities:**
- View their own invoices (IDOR-protected by `scopeFor`)
- View their own bills (if they are also a vendor)
- Make online payments via Razorpay integration
- Browse the furniture catalogue (product images, specs)
- 360° product viewer (multi-angle image sequence)
- **Room Studio** — drag and drop furniture into a room canvas, visualise configurations

**Security:** Changing the invoice ID in the URL returns 403. The scope is applied at the data layer, not the route layer.

---

### AI / CFO Copilot

**Service:** `cfoCopilotService.ts` + `cfoCopilotRoutes.ts`

- Backed by a local Ollama instance running `qwen2.5:7b`
- The CFO Copilot has read access to the live ledger via a set of tool functions
- Answers natural-language questions: *"What is our net income this month?"*, *"Which vendor do we owe the most?"*, *"Is our budget on track?"*
- No data leaves the machine — fully air-gapped

**Voice Bill Scanner:** `voiceBillService.ts` + `billScannerService.ts`
- Parses voice/text descriptions of bills into structured line items using the local LLM
- NER (Named Entity Recognition) pipeline in `ner/` for entity extraction

---

## 9. Database Schema (Key Tables)

```sql
-- Core accounting tables
journal_entries          (id, journal_id, date, reference, status, source_type, source_id, ...)
journal_entry_lines      (id, entry_id, account_id, partner_id, analytic_id, debit, credit, ...)

-- Documents
purchase_orders          (id, vendor_id, number, status, ...)
vendor_bills             (id, po_id, vendor_id, number, bill_reference, status, journal_entry_id, ...)
sales_orders             (id, customer_id, number, status, ...)
customer_invoices        (id, so_id, customer_id, number, status, journal_entry_id, ...)
payments                 (id, contact_id, amount, method, journal_entry_id, ...)
payment_allocations      (id, payment_id, invoice_id, bill_id, amount, ...)

-- Master data
accounts                 (id, name, type, ...)
journals                 (id, name, type, default_debit_account_id, default_credit_account_id, ...)
contacts                 (id, name, type, email, gstin, ...)
products                 (id, name, type, sales_price, cost, ...)
analytic_accounts        (id, name, type, ...)
budgets                  (id, name, period_start, period_end, status, revised_from_id, ...)
budget_lines             (id, budget_id, analytic_account_id, committed_amount, ...)

-- Supporting tables
doc_sequences            (prefix, next_val)   -- row-locked for gapless numbers
audit_log                (id, actor_id, action, resource_type, resource_id, diff, created_at)
stock_moves              (id, product_id, qty, direction, source_type, source_id, ...)
users                    (id, login_id, email, password_hash, role, contact_id, ...)

-- Views (computed, never written)
v_invoice_status         → Paid / Partial / Not Paid per document
v_ledger_detail          → denormalised ledger for drill-down
```

**Money rule:** All monetary columns are `DECIMAL(14,2)`. No `FLOAT` or `NUMERIC` without precision, anywhere.

---

## 10. API Reference

### Auth

```
POST /api/auth/login
POST /api/auth/signup
POST /api/auth/logout
POST /api/auth/forgot-password
POST /api/auth/reset-password
GET  /api/auth/me
```

### Dashboard

```
GET /api/dashboard/stats
  → { sales: { all, confirmed, draft }, purchase: { all, confirmed, draft }, budget: { achieved, budget, committed } }

GET /api/dashboard/kpi
  → { cash, bank, receivable, payable, netIncomeThisMonth }   (all strings: "5000.00")
```

### Purchase

```
GET    /api/purchase-orders
POST   /api/purchase-orders
GET    /api/purchase-orders/:id
PATCH  /api/purchase-orders/:id
POST   /api/purchase-orders/:id/confirm
POST   /api/purchase-orders/:id/cancel
POST   /api/purchase-orders/:id/create-bill

GET    /api/vendor-bills
POST   /api/vendor-bills
GET    /api/vendor-bills/:id
PATCH  /api/vendor-bills/:id
POST   /api/vendor-bills/:id/confirm    ← creates journal entry
POST   /api/vendor-bills/:id/cancel
```

### Sales

```
GET    /api/sales-orders
POST   /api/sales-orders
GET    /api/sales-orders/:id
PATCH  /api/sales-orders/:id
POST   /api/sales-orders/:id/confirm
POST   /api/sales-orders/:id/create-invoice

GET    /api/invoices
POST   /api/invoices
GET    /api/invoices/:id
PATCH  /api/invoices/:id
POST   /api/invoices/:id/confirm    ← creates journal entry
POST   /api/invoices/:id/cancel
POST   /api/invoices/:id/pdf       → application/pdf blob
```

### Payments

```
POST /api/payments
GET  /api/payments
GET  /api/payments/:id
```

### Master Data

```
GET/POST/PATCH   /api/contacts/:id
GET/POST/PATCH   /api/products/:id
GET/POST/PATCH   /api/accounts/:id
GET/POST/PATCH   /api/journals/:id
GET/POST/PATCH   /api/journal-entries/:id
POST             /api/journal-entries/:id/post
GET/POST/PATCH   /api/analytic-accounts/:id
GET/POST/PATCH   /api/budgets/:id
POST             /api/budgets/:id/confirm
POST             /api/budgets/:id/revise
POST             /api/budgets/:id/cancel
```

### Reports

```
GET  /api/reports/balance-sheet?asOf=YYYY-MM-DD
GET  /api/reports/profit-loss?start=YYYY-MM-DD&end=YYYY-MM-DD
GET  /api/reports/budget?budgetId=X
POST /api/reports/balance-sheet/pdf
POST /api/reports/profit-loss/pdf
POST /api/reports/budget/pdf

GET  /api/reports/gst?period=YYYY-MM
GET  /api/reports/aging/receivables
GET  /api/reports/aging/payables
GET  /api/analytics/*
```

### Portal (Contact-scoped)

```
POST /api/portal/login
GET  /api/portal/me
GET  /api/portal/invoices           ← scoped to contact's own invoices
GET  /api/portal/invoices/:id       ← 403 if not theirs
GET  /api/portal/bills
GET  /api/portal/bills/:id
GET  /api/portal/payments
POST /api/portal/payments/razorpay/create-order
POST /api/portal/payments/razorpay/verify
GET  /api/portal/products           ← public catalogue
```

### System

```
GET /api/verify    → { difference: "0.00" } if ledger balances
GET /api/integrity → detailed integrity check results
GET /api/audit     → audit feed
```

---

## 11. Design System

**Direction:** Warm, tactile, showroom-grade. Furniture is a material business — the interface reads warm and crafted rather than cold and corporate.

### Typography (self-hosted `.woff2`)

| Role | Font | Used For |
|---|---|---|
| Display | **Montserrat** 600/700 | Page titles, KPI numbers, section headers |
| Body | **DM Sans** 400/500 | All body text |
| Figures | **IBM Plex Mono** 400/500 | Ledger columns, debit/credit, all amounts in tables |

Money is always mono, always right-aligned, always `font-variant-numeric: tabular-nums`.

### Colour Palette

```css
/* Neutrals — walnut scale */
--brown-900: #4A3A34   /* primary text, headers */
--brown-700: #77574A   /* secondary text, active nav */
--brown-500: #A8836C   /* borders on dark, muted icons */
--brown-300: #D0AE92   /* dividers, disabled */
--brown-100: #EBD7BE   /* hover fills, table stripes */
--cream:     #F9F2E4   /* app background */
--surface:   #FFFFFF   /* cards, forms, tables */

/* Semantic */
--posted:    #5F7052   /* posted, confirmed, paid, success */
--posted-bg: #EDF1E8
--warning:   #C08A3E   /* NON-blocking: budget overrun */
--warning-bg:#FBF1DF
--danger:    #9E4A38   /* BLOCKING: unbalanced entry, overdue */
--danger-bg: #F8EAE6
--draft:     #A8836C   /* draft, unpaid, neutral */
```

### Status Badges

| Status | Text Colour | Fill |
|---|---|---|
| Draft / Not Paid | `--brown-700` | `--brown-100` |
| Posted / Confirmed / Paid | `--posted` | `--posted-bg` |
| Partial | `--warning` | `--warning-bg` |
| Cancelled / Overdue | `--danger` | `--danger-bg` |
| Revised | `--brown-500` | `--surface` + border |

### Two Warning Components

**`<BlockingWarning>`** — solid `--danger` left bar (4px), `--danger-bg` fill, action button **disabled** while shown.
> Debit and credit amounts do not match. Entry cannot be posted.

**`<NonBlockingWarning>`** — dashed `--warning` border, `--warning-bg` fill, **dismissible**, action stays enabled.
> ⚠️ Exceeds Approved Budget — The entered amount is higher than the remaining budget for this line.

### Navigation

Top nav, four items: **Sales · Purchase · Account · Report**. Active item: `--brown-700` with a 2px bottom underline.

Sub-menus:
- **Sales:** Sales Orders, Customer Invoices, Receivables
- **Purchase:** Purchase Orders, Vendor Bills, Payments
- **Account:** Contacts, Products, Analytic Accounts, Budgets, Chart of Accounts, Journals, Journal Entries
- **Report:** Balance Sheet, Profit & Loss, Budget Report, Analytics, GST Report

### Indian Number Formatting

`Intl.NumberFormat('en-IN')` silently falls back to Western grouping inside Docker (Node ships `small-icu`). Hand-rolled formatter used instead:

```ts
import Decimal from 'decimal.js';
export function formatINR(value: string): string {
  const d = new Decimal(value);
  const neg = d.isNegative();
  const [int, dec] = d.abs().toFixed(2).split('.');
  const last3 = int.slice(-3);
  const rest = int.slice(0, -3);
  const grouped = rest
    ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3
    : last3;
  return `${neg ? '-' : ''}₹${grouped}.${dec}`;
}
```

---

## 12. Getting Started

### Prerequisites

- Docker & Docker Compose v2
- (Optional for local dev) Node 20, PostgreSQL 16

### Docker Compose (Recommended)

```bash
git clone https://github.com/vedeshskhatri/Urban-Furniture-Accounting-System.git
cd Urban-Furniture-Accounting-System

# Start all services (db, api, web, ollama)
docker compose up --build

# In a separate terminal — seed the database
docker compose exec api npm run db:migrate
docker compose exec api npm run db:seed
```

Services available at:
- **Frontend (Admin):** http://localhost:5173
- **API:** http://localhost:5002
- **PostgreSQL:** localhost:5432
- **Ollama:** http://localhost:11434

### Local Development (without Docker)

```bash
# 1. Start PostgreSQL 16 locally

# 2. API
cd api
cp .env.example .env          # edit DATABASE_URL, JWT_SECRET
npm install
npm run db:migrate
npm run db:seed
npm run dev                   # starts on :5000

# 3. Client (new terminal)
cd client
npm install
npm run dev                   # starts on :5173
```

### Database Seed

The seed populates:
- Chart of Accounts (8 types: Bank, Cash, Debtors, Creditors, Sales Income, Purchase Expense, Capital, Other Expense)
- Pre-configured Journals (Sales, Purchase, Bank, Cash)
- Opening capital journal entry (answers "where did the money come from?")
- Sample contacts, products, and transactions for demo

---

## 13. Environment Variables

### API (`api/.env`)

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/urban
JWT_SECRET=<random 32 bytes hex>
NODE_ENV=development
COOKIE_SECURE=false
CORS_ORIGIN=http://localhost:5173
PORT=5000
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RESEND_API_KEY=<optional, for invite emails>
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:7b
```

### Client (`client/.env`)

```env
VITE_API_URL=                   # empty = same origin (proxied by Vite)
VITE_RAZORPAY_KEY_ID=rzp_test_...
```

> **Note:** `credentials: true` must be set on both the CORS config (API side) and the fetch client (frontend side). Missing either breaks auth across the Docker network boundary.

---

## 14. Accounting Correctness Rules

These rules are the grading criteria. Violating any one of them fails the demo.

| Rule | Detail |
|---|---|
| **No entry on PO/SO confirm** | Journal entries are created only when Bills/Invoices are confirmed, or Payments are registered |
| **Revenue at invoice, not payment** | `CR Sales Income` happens at invoice confirm. Payment entries only move Cash/Bank vs Debtors |
| **Payment never touches Income/Expense** | Payment: DR Cash / CR Debtors. Never CR Sales Income |
| **Balance Sheet must balance** | Assets = Liabilities + Capital + Net Profit. Enforced by PostgreSQL trigger |
| **Payment status from view** | `v_invoice_status` computes Paid/Partial/Not Paid on read. Never stored on the document |
| **Posted entries are immutable** | Correction = reversal only. No editing a posted entry |
| **Money is DECIMAL everywhere** | `DECIMAL(14,2)` in PG, `decimal.js` in JS, `"5000.00"` string across the wire |
| **Double-confirm is idempotent** | `postDocument()` checks for existing `journal_entry_id` before creating |
| **Archive, never delete** | Delete of a referenced record is blocked. Archive flag used instead |
| **Portal IDOR protection** | `scopeFor()` at data layer — URL tampering returns 403 |
| **Tax posts to its own account** | Output Tax to Tax Payable, not Sales Income |
| **Two warning severities** | Debit ≠ Credit is BLOCKING (action disabled). Budget overrun is NON-BLOCKING (warn, allow) |
| **Gapless document numbers** | Sequences use row-level locks (`FOR UPDATE`) — no gaps under concurrent confirms |
| **No partial failure orphans** | Bill confirm steps 3–8 are one atomic transaction; partial failure leaves no orphan entry |

---

## 15. Team & Module Ownership

| Owner | Writes To |
|---|---|
| **Vedesh** (Backend Spine) | `users`, `journal_entries`, `journal_entry_lines`, `payments`, `payment_allocations`, `doc_sequences`, all report queries, `postingService.ts` |
| **Aman** (Purchase + Master) | `contacts`, `products`, `accounts`, `journals`, `analytic_accounts`, `purchase_orders`, `vendor_bills` |
| **Aryan** (Sales + Portal) | `sales_orders`, `customer_invoices`, portal routes |
| **Swapnil** (Frontend) | No database tables — frontend only |

**Critical rule:** Aman and Aryan **call** `PostingService.postDocument()`. They never insert into ledger tables directly. `postingService.ts` is owned exclusively by Vedesh.

---

## Appendix: Key Architectural Decisions

1. **Raw `pg` over Prisma for posting transactions** — PostgreSQL's `DEFERRABLE INITIALLY DEFERRED` trigger requires a raw `pg` `PoolClient` transaction. Prisma's `$transaction()` does not guarantee trigger timing.

2. **Scope at data layer, not route layer** — `scopeFor()` rewrites the SQL WHERE clause. URL tampering is structurally impossible, not defensively patched.

3. **Deferred balance trigger** — `trg_lines_balanced` fires on `COMMIT`, not on each `INSERT`. This allows the service to insert all lines before the balance is checked.

4. **Payment status from views** — Status is never written to the document row. `v_invoice_status` recomputes it from `payment_allocations` on every read. This eliminates stale status bugs entirely.

5. **Indian number formatting** — Docker's Node ships `small-icu` (English only). `Intl.NumberFormat('en-IN')` silently falls back to Western grouping. Hand-rolled formatter is the only safe approach.

6. **Combo product type** — Defined in the spec. Decision: deferred from core accounting scope. Combo products behave as bundles in the catalogue but post as individual line items on invoices.

7. **Five PDF account types vs eight in mockup** — The mockup's eight types (with Bank and Cash as distinct types) is the correct real-world chart of accounts. We follow the mockup, not the PDF spec.

---

*Built for Urban Furniture by Vedesh · Aman · Aryan · Swapnil*
