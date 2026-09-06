<div align="center">

<img src="https://readme-typing-svg.demolab.com?font=Montserrat&weight=700&size=36&pause=1000&color=4A3A34&center=true&vCenter=true&width=600&lines=Urban+Furniture;Accounting+System" alt="Urban Furniture" />

<br/>

<!-- Badges -->
<img src="https://img.shields.io/badge/PostgreSQL-16-336791?style=for-the-badge&logo=postgresql&logoColor=white"/>
<img src="https://img.shields.io/badge/Node.js-20-339933?style=for-the-badge&logo=node.js&logoColor=white"/>
<img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black"/>
<img src="https://img.shields.io/badge/TypeScript-Strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white"/>
<img src="https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white"/>

<br/><br/>

<img src="https://img.shields.io/badge/Runs-100%25%20Offline-5F7052?style=flat-square"/>
<img src="https://img.shields.io/badge/Money-DECIMAL%20end--to--end-C08A3E?style=flat-square"/>
<img src="https://img.shields.io/badge/Double--Entry-PostgreSQL%20Enforced-4A3A34?style=flat-square"/>
<img src="https://img.shields.io/badge/AI%20CFO-Local%20Ollama-77574A?style=flat-square"/>

<br/><br/>

> **A production-grade, double-entry accounting platform built for a furniture business.**
> Modelled on the Odoo accounting module architecture — without using Odoo.
> Runs entirely offline inside Docker Compose.

<br/>

---

</div>

## 📋 Table of Contents

| # | Section |
|---|---|
| 1 | [🏢 Project Overview](#1--project-overview) |
| 2 | [✅ Feature Set](#2--feature-set) |
| 3 | [🛠 Tech Stack](#3--tech-stack) |
| 4 | [🏗 System Architecture](#4--system-architecture) |
| 5 | [🔄 Data Flow](#5--data-flow) |
| 6 | [⚖️ Double-Entry Mechanics](#6-️-double-entry-posting-mechanics) |
| 7 | [🔐 Authorisation Model](#7--authorisation-model) |
| 8 | [📦 Module Breakdown](#8--module-breakdown) |
| 9 | [🗄 Database Schema](#9--database-schema) |
| 10 | [🌐 API Reference](#10--api-reference) |
| 11 | [🎨 Design System](#11--design-system) |
| 12 | [🚀 Getting Started](#12--getting-started) |
| 13 | [⚙️ Environment Variables](#13-️-environment-variables) |
| 14 | [📐 Accounting Correctness Rules](#14--accounting-correctness-rules) |
| 15 | [👥 Team & Ownership](#15--team--module-ownership) |

---

## 1 🏢 Project Overview

<table>
<tr>
<td width="50%">

### What it is

Urban Furniture is a **full-stack, double-entry accounting information system** implementing the complete Odoo accounting module architecture — built from scratch.

**Core guarantees:**
- ∑ Debits = ∑ Credits, enforced by PostgreSQL constraint trigger at `COMMIT`
- No float arithmetic anywhere in the money pipeline
- Portal IDOR: structurally impossible, not defensively patched
- 100% air-gapped — no outbound network at demo time

</td>
<td width="50%">

### What it covers

| Cycle | Details |
|---|---|
| 🛒 **Purchase** | PO → Bill → Payment |
| 💰 **Sales** | SO → Invoice → Receipt |
| 📊 **Reports** | BS · P&L · Budget |
| 🌐 **Portal** | Customer self-service + Razorpay |
| 🤖 **AI Copilot** | Local Ollama CFO assistant |
| 🪑 **Room Studio** | 3D furniture visualiser |

</td>
</tr>
</table>

---

## 2 ✅ Feature Set

### 🗂 Master Data

| Entity | Key Fields |
|---|---|
| **Contact** | Name, Type (Customer / Vendor / Both), Email, Mobile, Address, GSTIN, Profile Image |
| **Product** | Name, Type (Goods / Service / **Combo**), Sales Price, Cost, Category, 360° Images |
| **Chart of Accounts** | Name, Type (Asset / Liability / Bank / Cash / Capital / Income / Expenses / Other Expenses) |
| **Journal** | Name, Type, Default Debit Account, Default Credit Account |
| **Journal Entry** | Journal, Date, Reference, Lines (Account + Partner + Debit + Credit), Status |
| **Analytic Account** | Name, Type (Income / Expense) — drives budget tracking |
| **Budget** | Name, Period, Responsible Person, Lines (Analytic + Committed Amount) |

### 💳 Transactions & Journal Entry Triggers

```
┌──────────────────────┬──────────────────────────────────────────────────┐
│ Document             │ Creates Journal Entry?                           │
├──────────────────────┼──────────────────────────────────────────────────┤
│ Purchase Order       │ ❌  No — confirm creates zero entries            │
│ Vendor Bill confirm  │ ✅  DR Purchase Expense + Tax  /  CR Creditors   │
│ Sales Order          │ ❌  No — confirm creates zero entries            │
│ Customer Invoice     │ ✅  DR Debtors  /  CR Sales Income + Tax         │
│ Payment              │ ✅  DR/CR Cash|Bank  ↔  DR/CR Debtors|Creditors  │
└──────────────────────┴──────────────────────────────────────────────────┘
```

### 📈 Reports

| Report | Date Semantics | Output |
|---|---|---|
| **Balance Sheet** | Cumulative `≤ asOf` date | Assets = Liabilities + Equity |
| **Profit & Loss** | `BETWEEN start AND end` | Income − Expenses = Net Profit |
| **Budget Report** | Within budget period | Committed vs Achieved vs Remaining |
| **Analytics Dashboard** | Rolling windows | Ageing, cash flow, top customers |
| **GST Report** | Monthly period | GSTR-1 / GSTR-3B reconciliation |
| **Audit Feed** | Chronological | Every mutation, actor, timestamp, diff |
| **Ledger Drill-down** | Per account | 4-level chain to source document |

### 👥 Roles

| Role | Can Do |
|---|---|
| 🔴 **Admin** | Full access — master data, transactions, reports, user management |
| 🟡 **Accountant** | Same as Admin except user management |
| 🟢 **Contact (Portal)** | Own invoices/bills only + online payments. 403 on any other ID. |
| ⚙️ **System** | Validates data, enforces balance, computes status from views |

---

## 3 🛠 Tech Stack

<div align="center">

| Layer | Choice | Why |
|---|---|---|
| ![React](https://img.shields.io/badge/-React_18-61DAFB?logo=react&logoColor=black&style=flat-square) | Vite + Tailwind CSS | Fast HMR, team proficiency |
| ![Node](https://img.shields.io/badge/-Node_20-339933?logo=node.js&logoColor=white&style=flat-square) | Express + **TypeScript** | TS is non-negotiable for money code |
| ![Postgres](https://img.shields.io/badge/-PostgreSQL_16-336791?logo=postgresql&logoColor=white&style=flat-square) | with DEFERRABLE triggers | Reviewers specifically care about PG |
| ![Prisma](https://img.shields.io/badge/-Prisma-2D3748?logo=prisma&logoColor=white&style=flat-square) | + raw `pg` for transactions | Deferred triggers need raw PoolClient |
| ![JWT](https://img.shields.io/badge/-JWT+Argon2id-000000?logo=jsonwebtokens&logoColor=white&style=flat-square) | httpOnly cookies | No BaaS. SHA-256 = disqualification |
| ![Zod](https://img.shields.io/badge/-Zod-3E67B1?style=flat-square) | Shared client + server | Single source of truth |
| ![decimal.js](https://img.shields.io/badge/-decimal.js-C08A3E?style=flat-square) | `DECIMAL(14,2)` in PG | Floats kill the correctness demo |
| ![TanStack](https://img.shields.io/badge/-React_Query-FF4154?logo=reactquery&logoColor=white&style=flat-square) | TanStack Query | Cache invalidation after mutations |
| ![Puppeteer](https://img.shields.io/badge/-Puppeteer-40B5A4?logo=puppeteer&logoColor=white&style=flat-square) | Server-side PDF | Deterministic, no browser dialog |
| ![Socket.IO](https://img.shields.io/badge/-Socket.IO-010101?logo=socket.io&logoColor=white&style=flat-square) | Real-time updates | Live ledger flash at post |
| ![Ollama](https://img.shields.io/badge/-Ollama_qwen2.5:7b-4A3A34?style=flat-square) | Local LLM | Fully air-gapped CFO Copilot |
| ![Razorpay](https://img.shields.io/badge/-Razorpay-02042B?logo=razorpay&logoColor=white&style=flat-square) | Payment gateway | Portal online payments |
| ![Docker](https://img.shields.io/badge/-Docker_Compose-2496ED?logo=docker&logoColor=white&style=flat-square) | 4 services | Containerisation is judged |

</div>

### ❌ Deliberately Not Used

| Rejected | Reason |
|---|---|
| Odoo itself | Using their engine = we configured, not built |
| Gemini / OpenAI / any LLM API | External API — violates offline constraint |
| Redis | Cannot name the query it fixes at demo scale |
| Auth0 / Clerk / Firebase | BaaS — instant disqualification |
| Google Fonts CDN | External network call — `.woff2` self-hosted |
| `float` for money | Non-negotiable |
| Elasticsearch | PostgreSQL FTS is sufficient and more impressive |

### 📌 Pinned Versions
```
node 20.x · postgres 16 · react 18.3 · vite 5 · tailwind 3.4
prisma 5.x · zod 3.23 · decimal.js 10.4 · socket.io 4.7 · puppeteer 22
```

---

## 4 🏗 System Architecture

```
┌──────────────────────────── Docker Compose ─────────────────────────────┐
│                                                                          │
│   web  (React 18 + Vite)                 api  (Express + TypeScript)    │
│  ┌──────────────────────────┐           ┌────────────────────────────┐  │
│  │  🖥  Admin App            │           │  routes/     thin layer    │  │
│  │  /dashboard              │           │      ↓                     │  │
│  │  /sales                  │──cookie──▶│  middleware/ auth·role·    │  │
│  │  /purchase               │   JWT     │              scope         │  │
│  │  /account                │           │      ↓                     │  │
│  │  /report                 │           │  services/   all logic     │  │
│  │                          │           │      ↓                     │  │
│  │  🌐  Contact Portal       │           │  db/         Prisma + pg   │  │
│  │  /portal/...             │           └──────────┬─────────────────┘  │
│  └──────────┬───────────────┘                      │                    │
│             │                            db  PostgreSQL 16              │
│             │◀───── Socket.IO (real-time ledger flash on post) ─────────│
│                                                                          │
│   🤖  ollama  (qwen2.5:7b)  ◀──── CFO Copilot tool calls ──── api      │
└──────────────────────────────────────────────────────────────────────────┘
                      ✈  No outbound network. Ever.
```

### Backend Layers

```
 routes/          Parse → call service → shape { data, error }
     ↓
 middleware/       authenticate (JWT) → check role → apply scope
     ↓
 services/         ALL business logic lives here. Zero logic in routes.
     ↓
 db/               Prisma (migrations) + raw pg (transactions + triggers)
```

> **The Critical Invariant:** `postingService.ts` is the **only** file that writes to `journal_entries` and `journal_entry_lines`. Everything else calls `postDocument()`. Nobody else inserts ledger rows.

---

## 5 🔄 Data Flow

### Request Lifecycle

```mermaid
flowchart LR
    B([Browser]) -->|httpOnly cookie| MW[middleware/auth]
    MW -->|JWT verified| R[Role Check]
    R -->|scopeFor| S[Scope Applied]
    S -->|Zod| V[Validate Body]
    V -->|pg transaction| SVC[Service]
    SVC -->|every mutation| AL[(audit_log)]
    SVC --> RS{Result}
    RS -->|success| OK["{ data: T, error: null }"]
    RS -->|failure| ERR["{ data: null, error: { code, message, severity } }"]

    style B fill:#F9F2E4,stroke:#4A3A34
    style OK fill:#EDF1E8,stroke:#5F7052
    style ERR fill:#F8EAE6,stroke:#9E4A38
    style AL fill:#EBD7BE,stroke:#A8836C
```

**Severity drives the UI component:**
- 🔴 `severity: 'blocking'` → `<BlockingWarning>` — action button disabled
- 🟡 `severity: 'warning'` → `<NonBlockingWarning>` — dismissible, action stays enabled

---

### 🧾 Vendor Bill → Journal Entry

```mermaid
sequenceDiagram
    participant U as 👤 User
    participant API as 🌐 API
    participant SVC as ⚙️ postingService
    participant DB as 🐘 PostgreSQL

    U->>API: POST /api/bills/:id/confirm
    API->>DB: BEGIN TRANSACTION
    DB-->>API: tx started

    API->>DB: SELECT bill + lines FOR UPDATE
    Note over API: Assert status = 'draft'

    API->>API: Budget check per analytic line
    Note over API: Over budget? → NON-BLOCKING warning<br/>(do not stop transaction)

    API->>DB: SequenceService.nextDocNumber('BILL')
    DB-->>API: Bill/2026/0001  ← row-locked, gapless

    API->>SVC: postDocument('bill', billId, tx)
    SVC->>DB: INSERT journal_entry (status='draft')
    SVC->>DB: INSERT lines:<br/>DR Purchase Expense (per line + analytic)<br/>DR Input Tax Credit (if tax > 0)<br/>CR Creditors (vendor, grand total)
    SVC->>DB: UPDATE journal_entry SET status='posted'

    Note over DB: trg_lines_balanced fires on COMMIT<br/>∑ debits = ∑ credits — or ROLLBACK

    API->>DB: UPDATE vendor_bill SET status='confirmed'
    API->>DB: INSERT stock_moves (goods lines)
    API->>DB: INSERT audit_log
    API->>DB: COMMIT

    DB-->>U: { data: { billId, entryId }, error: null }
```

> **Idempotent:** If `journal_entry_id` already exists, `postDocument()` returns immediately. Double-clicking Confirm never creates two entries.

---

### 🧾 Customer Invoice → Journal Entry

```mermaid
sequenceDiagram
    participant U as 👤 User
    participant API as 🌐 API
    participant SVC as ⚙️ postingService
    participant DB as 🐘 PostgreSQL

    U->>API: POST /api/invoices/:id/confirm
    API->>DB: BEGIN TRANSACTION
    API->>DB: SELECT invoice FOR UPDATE (assert draft)
    API->>DB: nextDocNumber('INV') → INV/2026/0001

    API->>SVC: postDocument('invoice', invoiceId, tx)
    SVC->>DB: INSERT journal_entry (journal=Sales)
    SVC->>DB: INSERT lines:<br/>DR Debtors (customer, grand total)<br/>CR Sales Income (per line + analytic)<br/>CR Output Tax (if tax > 0)

    Note over SVC: ⚠️ Revenue recognised HERE<br/>Payment NEVER touches Income

    SVC->>DB: SET status='posted'
    Note over DB: trg_lines_balanced on COMMIT

    API->>DB: UPDATE invoice SET status='confirmed'
    API->>DB: stock_moves (-qty) + audit_log
    API->>DB: COMMIT
    DB-->>U: { data: { invoiceId, entryId }, error: null }
```

---

### 💸 Payment Flow

```mermaid
flowchart TD
    A([Register Payment]) --> B{Validate allocations}
    B -->|SUM allocations ≠ amount| ERR1([🔴 BLOCKING Error])
    B -->|allocations > amount_due| ERR2([🔴 BLOCKING Error])
    B -->|valid| C[Create payment + payment_allocations]

    C --> D{Direction}

    D -->|Inbound - Customer pays us| E["DR Cash\|Bank
    CR Debtors ← partner: customer
    ⛔ NEVER touches Income"]

    D -->|Outbound - We pay vendor| F["DR Creditors ← partner: vendor
    CR Cash\|Bank
    ⛔ NEVER touches Expense"]

    E --> G[(journal_entry posted)]
    F --> G

    G --> H[audit_log]
    H --> I([COMMIT])

    I --> J["v_invoice_status recomputed on read:
    ✅ Paid  |  🟡 Partial  |  ⬜ Not Paid
    ← NEVER stored on document row"]

    style ERR1 fill:#F8EAE6,stroke:#9E4A38
    style ERR2 fill:#F8EAE6,stroke:#9E4A38
    style I fill:#EDF1E8,stroke:#5F7052
    style J fill:#FBF1DF,stroke:#C08A3E
```

---

### 📊 Report Computation Flow

```mermaid
flowchart LR
    Q([GET /api/reports/balance-sheet\nasOf=2026-09-06]) --> JEL[(journal_entry_lines)]
    JEL --> JE[(journal_entries\nstatus='posted'\ndate ≤ asOf)]
    JE --> AGG["GROUP BY account.type\nSUM debit - credit"]

    AGG --> BS["🏦 Assets = Σ Asset + Bank + Cash
    📋 Liabilities = Σ Liability + Creditors
    💼 Capital = Σ Capital + Net Income"]

    BS --> CHECK{Assets = Liab + Capital?}
    CHECK -->|✅ Yes| PDF([Export PDF via Puppeteer])
    CHECK -->|❌ No| ALERT([🔴 Integrity Alert])

    style BS fill:#F9F2E4,stroke:#4A3A34
    style CHECK fill:#EBD7BE,stroke:#A8836C
    style PDF fill:#EDF1E8,stroke:#5F7052
    style ALERT fill:#F8EAE6,stroke:#9E4A38
```

| Report | Reads From | Date Filter |
|---|---|---|
| Profit & Loss | `journal_entry_lines` | `BETWEEN start AND end` |
| Balance Sheet | `journal_entry_lines` | `<= asOf` (cumulative) |
| Budget Report | `journal_entry_lines` | Within budget period, by `analytic_account_id` |

**Drill-down chain:** Report Line → Account Ledger → Journal Entries → Source Document *(4 levels via `v_ledger_detail`)*

---

## 6 ⚖️ Double-Entry Posting Mechanics

```
╔══════════════════════════════════════════════════════════════╗
║                   VENDOR BILL CONFIRM                        ║
╠═══════════════════════════════╦══════════════════════════════╣
║  DR  Purchase Expense         ║  line subtotal excl. tax     ║
║      (analytic: budget line)  ║  partner: vendor             ║
╠═══════════════════════════════╬══════════════════════════════╣
║  DR  Input Tax Credit         ║  tax total                   ║
║      (skipped if tax = 0)     ║  partner: vendor             ║
╠═══════════════════════════════╬══════════════════════════════╣
║  CR  Creditors                ║  grand total                 ║
║                               ║  partner: vendor             ║
╚═══════════════════════════════╩══════════════════════════════╝

╔══════════════════════════════════════════════════════════════╗
║                CUSTOMER INVOICE CONFIRM                      ║
╠═══════════════════════════════╦══════════════════════════════╣
║  DR  Debtors                  ║  grand total                 ║
║                               ║  partner: customer           ║
╠═══════════════════════════════╬══════════════════════════════╣
║  CR  Sales Income             ║  line subtotal excl. tax     ║
║      (analytic: budget line)  ║  partner: customer           ║
╠═══════════════════════════════╬══════════════════════════════╣
║  CR  Output Tax Payable       ║  tax total                   ║
║      (skipped if tax = 0)     ║  partner: customer           ║
╚═══════════════════════════════╩══════════════════════════════╝

╔══════════════════════════════════════════════════════════════╗
║            PAYMENT — INBOUND (customer pays us)             ║
╠═══════════════════════════════╦══════════════════════════════╣
║  DR  Cash | Bank              ║  payment amount              ║
╠═══════════════════════════════╬══════════════════════════════╣
║  CR  Debtors                  ║  settlement only             ║
║      ⛔ NEVER touches Income  ║  partner: customer           ║
╚═══════════════════════════════╩══════════════════════════════╝

╔══════════════════════════════════════════════════════════════╗
║           PAYMENT — OUTBOUND (we pay vendor)                ║
╠═══════════════════════════════╦══════════════════════════════╣
║  DR  Creditors                ║  settlement only             ║
║      ⛔ NEVER touches Expense ║  partner: vendor             ║
╠═══════════════════════════════╬══════════════════════════════╣
║  CR  Cash | Bank              ║  payment amount              ║
╚═══════════════════════════════╩══════════════════════════════╝
```

### 🔒 Balance Invariant (PostgreSQL)

```sql
-- trg_lines_balanced — DEFERRABLE INITIALLY DEFERRED
-- Fires on COMMIT. If this fails, the entire transaction rolls back.
-- The application cannot produce an unbalanced entry. Structurally impossible.

SELECT SUM(debit) = SUM(credit)
FROM journal_entry_lines
WHERE journal_entry_id = $entry_id;
```

---

## 7 🔐 Authorisation Model

> Route guards fail when someone forgets one endpoint. That is how IDOR happens.

```ts
// scopeFor() rewrites the SQL WHERE clause at the data layer.
// URL tampering becomes structurally impossible.

scopeFor(user, 'invoice')
  admin | accountant  →  {}                              // unrestricted
  contact             →  { customerId: user.contactId }  // own rows only
```

```mermaid
flowchart LR
    URL["GET /portal/invoices/999"] --> MW[middleware]
    MW --> SC["scopeFor(contact, 'invoice')"]
    SC --> Q["SELECT * FROM customer_invoices
    WHERE id = 999
    AND customer_id = 42   ← scope injected"]
    Q -->|row found| RESP([200 ✅])
    Q -->|no row| ERR([403 🔴])

    style ERR fill:#F8EAE6,stroke:#9E4A38
    style RESP fill:#EDF1E8,stroke:#5F7052
```

> **Reviewers will log in as a contact and edit the invoice ID in the URL. The response must be 403 — not someone else's invoice.**

---

## 8 📦 Module Breakdown

### 🛒 Sales Module

<details>
<summary><b>Click to expand Sales flow & details</b></summary>

**Pages:** `SalesOrderFormPage` · `SalesOrderListPage` · `CustomerInvoiceFormPage` · `CustomerInvoiceListPage` · `ReceivablesPage` · `RegisterPaymentPage`

```
Sales Order (draft)
    │
    ├─→ Confirm SO ─────────── ⛔ No journal entry
    │
    ├─→ Create Invoice ──────── Invoice generated from SO lines
    │
    ├─→ Confirm Invoice ─────── ✅ DR Debtors / CR Sales Income + Tax
    │
    └─→ Register Payment ────── ✅ DR Cash|Bank / CR Debtors
```

**Key Invoice Features:**
- Payment status: `Not Paid` → `Partial` → `Paid` — computed from `v_invoice_status`, never stored
- Footer totals: Paid Via Cash · Paid Via Bank · Amount Due
- Smart button: PO origin (if applicable)
- Numbering: `SO/2026/0001` · `INV/2026/0001`

</details>

---

### 🏭 Purchase Module

<details>
<summary><b>Click to expand Purchase flow & details</b></summary>

**Pages:** `POFormPage` · `POListPage` · `VendorBillFormPage` · `VendorBillListPage`

```
Purchase Order (draft)
    │
    ├─→ Confirm PO ─────────── ⛔ No journal entry
    │                          🟡 NON-BLOCKING budget warning if overrun
    ├─→ Create Bill ─────────── Bill generated from PO lines
    │
    ├─→ Confirm Bill ────────── ✅ DR Purchase Expense + Tax / CR Creditors
    │
    └─→ Register Payment ────── ✅ DR Creditors / CR Cash|Bank
```

**Smart Buttons on Bill:**

```
┌──────────┐   ┌──────────┐
│    1     │   │ Budget   │
│  P.Order │   │  Report  │
└──────────┘   └──────────┘
  ↑ Only visible    ↑ Opens analytic
  if from a PO        report
```

**Numbering:** `P00001` (PO) · `Bill/2026/0001` (Bill)

</details>

---

### 📊 Budget Module

<details>
<summary><b>Click to expand Budget lifecycle</b></summary>

```mermaid
stateDiagram-v2
    [*] --> Draft : New
    Draft --> Confirmed : Confirm
    Confirmed --> Revised : Revise (creates new budget)
    Confirmed --> Cancelled : Cancel
    Revised --> [*]
    Cancelled --> [*]
```

**Budget Line Metrics:**

| Field | Formula |
|---|---|
| Committed Amount | Planned budget (user-set) |
| Achieved Amount | Σ matching analytic lines in period ← **clickable** |
| Achieved % | `(Achieved / Committed) × 100` |
| Amount to Achieve | `Committed − Achieved` |

**Revise** is visible only at `Confirmed`. Creates a new budget with name `"<original> Revised"`. Both directions linked: original ↔ revision.

</details>

---

### 🌐 Customer Portal

<details>
<summary><b>Click to expand Portal features</b></summary>

**Pages:** `PortalLogin` · `PortalDashboardPage` · `PortalInvoiceList` · `PortalInvoiceDetail` · `PortalBillList` · `PortalBillDetail` · `PortalPaymentList` · `PortalCataloguePage` · `PortalProductViewerPage` · `PortalRoomStudioPage`

**Contact onboarding:** Invite email → set password → log in at `/portal`

| Feature | Details |
|---|---|
| 📄 Own Invoices | IDOR-protected by `scopeFor` at data layer |
| 💳 Razorpay Payment | Create order → verify webhook → journal entry |
| 🪑 Catalogue | Product images, specs, pricing |
| 🔄 360° Viewer | Multi-angle image sequence |
| 🏠 Room Studio | Drag-and-drop furniture canvas, real-time visualisation |

</details>

---

### 🤖 AI / CFO Copilot

<details>
<summary><b>Click to expand AI features</b></summary>

**Service:** `cfoCopilotService.ts` — backed by local Ollama (`qwen2.5:7b`)

```
User: "What is our net income this month?"
              │
              ▼
      CFO Copilot tool calls → live ledger queries
              │
              ▼
      "₹4,23,500.00 net income for September 2026.
       Top revenue: Walnut Dining Table (₹1,85,000).
       Largest expense: Teak Purchases (₹92,000)."
```

**Voice Bill Scanner:** `voiceBillService.ts` — parses natural language bill descriptions into structured line items via local NER pipeline. Zero data leaves the machine.

</details>

---

## 9 🗄 Database Schema

```sql
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  CORE ACCOUNTING LEDGER  (owned exclusively by Vedesh)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

journal_entries
  id · journal_id · date · reference · status · source_type · source_id

journal_entry_lines
  id · entry_id · account_id · partner_id · analytic_id
  debit DECIMAL(14,2) · credit DECIMAL(14,2)        ← NEVER float

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  TRANSACTION DOCUMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

purchase_orders     (id · vendor_id · number · status)
vendor_bills        (id · po_id · vendor_id · number · bill_reference
                        · status · journal_entry_id)
sales_orders        (id · customer_id · number · status)
customer_invoices   (id · so_id · customer_id · number
                        · status · journal_entry_id)
payments            (id · contact_id · amount · method · journal_entry_id)
payment_allocations (id · payment_id · invoice_id · bill_id · amount)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  MASTER DATA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

accounts            (id · name · type [8 types])
journals            (id · name · type · default_debit · default_credit)
contacts            (id · name · type · email · gstin)
products            (id · name · type · sales_price · cost)
analytic_accounts   (id · name · type)
budgets             (id · name · period_start · period_end · status
                        · revised_from_id)
budget_lines        (id · budget_id · analytic_account_id · committed_amount)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SUPPORTING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

doc_sequences       (prefix · next_val)   ← FOR UPDATE row lock, gapless
audit_log           (actor_id · action · resource_type · resource_id · diff)
stock_moves         (product_id · qty · direction · source_type · source_id)
users               (login_id · email · password_hash [argon2id] · role)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  COMPUTED VIEWS  (never written to directly)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

v_invoice_status    → Paid | Partial | Not Paid (from payment_allocations)
v_ledger_detail     → denormalised ledger for 4-level drill-down
```

---

## 10 🌐 API Reference

<details>
<summary><b>🔑 Auth routes</b></summary>

```http
POST /api/auth/login
POST /api/auth/signup
POST /api/auth/logout
POST /api/auth/forgot-password
POST /api/auth/reset-password
GET  /api/auth/me
```
</details>

<details>
<summary><b>📊 Dashboard routes</b></summary>

```http
GET /api/dashboard/stats
→ { sales: { all, confirmed, draft },
    purchase: { all, confirmed, draft },
    budget: { achieved, budget, committed } }

GET /api/dashboard/kpi
→ { cash, bank, receivable, payable, netIncomeThisMonth }
  ↑ all monetary values are strings: "5000.00"
```
</details>

<details>
<summary><b>🏭 Purchase routes</b></summary>

```http
GET/POST       /api/purchase-orders
GET/PATCH      /api/purchase-orders/:id
POST           /api/purchase-orders/:id/confirm
POST           /api/purchase-orders/:id/cancel
POST           /api/purchase-orders/:id/create-bill

GET/POST       /api/vendor-bills
GET/PATCH      /api/vendor-bills/:id
POST           /api/vendor-bills/:id/confirm   ← ✅ creates journal entry
POST           /api/vendor-bills/:id/cancel
```
</details>

<details>
<summary><b>🛒 Sales routes</b></summary>

```http
GET/POST       /api/sales-orders
GET/PATCH      /api/sales-orders/:id
POST           /api/sales-orders/:id/confirm
POST           /api/sales-orders/:id/create-invoice

GET/POST       /api/invoices
GET/PATCH      /api/invoices/:id
POST           /api/invoices/:id/confirm        ← ✅ creates journal entry
POST           /api/invoices/:id/cancel
POST           /api/invoices/:id/pdf            → application/pdf blob
```
</details>

<details>
<summary><b>💸 Payment routes</b></summary>

```http
POST /api/payments
GET  /api/payments
GET  /api/payments/:id
```
</details>

<details>
<summary><b>📚 Master Data routes</b></summary>

```http
GET/POST/PATCH  /api/contacts/:id
GET/POST/PATCH  /api/products/:id
GET/POST/PATCH  /api/accounts/:id
GET/POST/PATCH  /api/journals/:id
GET/POST/PATCH  /api/journal-entries/:id
POST            /api/journal-entries/:id/post
GET/POST/PATCH  /api/analytic-accounts/:id
GET/POST/PATCH  /api/budgets/:id
POST            /api/budgets/:id/confirm | revise | cancel
```
</details>

<details>
<summary><b>📈 Report routes</b></summary>

```http
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
</details>

<details>
<summary><b>🌐 Portal routes (contact-scoped)</b></summary>

```http
POST /api/portal/login
GET  /api/portal/me
GET  /api/portal/invoices           ← scoped to contact's own rows
GET  /api/portal/invoices/:id       ← 403 if not theirs
GET  /api/portal/bills
GET  /api/portal/bills/:id
GET  /api/portal/payments
POST /api/portal/payments/razorpay/create-order
POST /api/portal/payments/razorpay/verify
GET  /api/portal/products
```
</details>

<details>
<summary><b>⚙️ System routes</b></summary>

```http
GET /api/verify     → { difference: "0.00" }  ← must be 0.00 for a passing demo
GET /api/integrity  → detailed ledger integrity checks
GET /api/audit      → full audit feed
```
</details>

---

## 11 🎨 Design System

> **Direction:** Warm · Tactile · Showroom-grade.
> Furniture is a material business — wood, leather, linen.
> The interface reads warm and crafted, not cold and corporate.

### 🔤 Typography (self-hosted `.woff2`)

| Role | Font | Usage |
|---|---|---|
| **Display** | Montserrat 600/700 | Page titles, KPI numbers, headers |
| **Body** | DM Sans 400/500 | All body text |
| **Figures** | IBM Plex Mono 400/500 | **All monetary amounts in tables** |

> Money is always mono · always right-aligned · always `font-variant-numeric: tabular-nums`
> Misaligned columns of figures read as amateur to an accountant.

### 🎨 Colour Palette

```
Walnut Scale
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ████  --brown-900: #4A3A34   Primary text, headers
  ████  --brown-700: #77574A   Secondary text, active nav
  ████  --brown-500: #A8836C   Borders on dark, muted icons
  ████  --brown-300: #D0AE92   Dividers, disabled
  ████  --brown-100: #EBD7BE   Hover fills, table stripes
  ████  --cream:     #F9F2E4   App background
  ████  --surface:   #FFFFFF   Cards, forms, tables

Semantic
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ████  --posted:    #5F7052   Posted / Confirmed / Paid
  ████  --warning:   #C08A3E   NON-BLOCKING — budget overrun
  ████  --danger:    #9E4A38   BLOCKING — unbalanced entry
  ████  --draft:     #A8836C   Draft / Unpaid / Neutral
```

### 🏷 Status Badges

| Status | Display | Badge Colour |
|---|---|---|
| Draft / Not Paid | `DRAFT` | `--brown-700` on `--brown-100` |
| Posted / Confirmed / Paid | `CONFIRMED` | `--posted` on `--posted-bg` |
| Partial | `PARTIAL` | `--warning` on `--warning-bg` |
| Cancelled / Overdue | `CANCELLED` | `--danger` on `--danger-bg` |
| Revised | `REVISED` | `--brown-500` on `--surface` + border |

### ⚠️ Two Warning Components

```
┌─────────────────────────────────────────────────────────┐
│  🔴 BlockingWarning  (4px solid danger left bar)        │
│                                                         │
│  Debit and credit amounts do not match.                 │
│  Entry cannot be posted.           [Action Disabled]    │
└─────────────────────────────────────────────────────────┘

┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
  🟡 NonBlockingWarning  (dashed warning border)
│                                                         │
  ⚠️ Exceeds Approved Budget. Consider adjusting
│  the value or revising the budget.    [✕ Dismiss]       │
│                                    [Action Enabled] ✓   │
└ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
```

### 🔢 Indian Number Formatting

`Intl.NumberFormat('en-IN')` silently falls back to Western grouping inside Docker (`small-icu`). Hand-rolled formatter:

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

// ₹12,34,567.89  ← Indian grouping, not ₹1,234,567.89
```

---

## 12 🚀 Getting Started

### Prerequisites

- **Docker Desktop** with Compose v2 — recommended
- (Local dev only) Node 20, PostgreSQL 16

### 🐳 Docker Compose (Recommended)

```bash
# Clone
git clone https://github.com/vedeshskhatri/Urban-Furniture-Accounting-System.git
cd Urban-Furniture-Accounting-System

# Start all 4 services: db, api, web, ollama
docker compose up --build

# Seed the database (first time only)
docker compose exec api npm run db:migrate
docker compose exec api npm run db:seed
```

| Service | URL |
|---|---|
| 🖥 **Admin Frontend** | http://localhost:5173 |
| 🌐 **API** | http://localhost:5002 |
| 🐘 **PostgreSQL** | localhost:5432 |
| 🤖 **Ollama** | http://localhost:11434 |

### 💻 Local Development (without Docker)

```bash
# Terminal 1 — API
cd api
cp .env.example .env     # fill DATABASE_URL and JWT_SECRET
npm install
npm run db:migrate
npm run db:seed
npm run dev              # → :5000

# Terminal 2 — Client
cd client
npm install
npm run dev              # → :5173
```

### 🌱 What the Seed Provides

| Seeded Data | Details |
|---|---|
| Chart of Accounts | 8 accounts: Bank, Cash, Debtors, Creditors, Sales Income, Purchase Expense, Capital, Other Expense |
| Journals | Sales, Purchase, Bank, Cash — all with defaults |
| Opening Capital Entry | Answers "where did the money come from?" |
| Sample Contacts | Customers and vendors for demo |
| Sample Products | Furniture items with images |
| Sample Transactions | POs, Bills, SOs, Invoices for demo walkthrough |

---

## 13 ⚙️ Environment Variables

### `api/.env`

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/urban
JWT_SECRET=<random 32-byte hex string>
NODE_ENV=development
COOKIE_SECURE=false
CORS_ORIGIN=http://localhost:5173
PORT=5000
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RESEND_API_KEY=<optional — invite emails>
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:7b
```

### `client/.env`

```env
VITE_API_URL=                      # empty = same origin (Vite proxy)
VITE_RAZORPAY_KEY_ID=rzp_test_...
```

> **⚠️ Critical:** `credentials: true` must be set on **both** the API CORS config and the frontend fetch client. Missing either side breaks auth across the Docker network boundary.

---

## 14 📐 Accounting Correctness Rules

> These are the grading criteria. Any violation fails the demo.

| # | Rule | Detail |
|---|---|---|
| 1 | **No entry on PO/SO confirm** | Only Bill/Invoice confirm and Payment register entries |
| 2 | **Revenue at invoice, not payment** | `CR Sales Income` at confirm. Payment = settlement only |
| 3 | **Payment never touches Income/Expense** | `DR Cash / CR Debtors` — never `CR Sales Income` |
| 4 | **Balance Sheet must balance** | Assets = Liabilities + Capital + Net Profit |
| 5 | **Payment status from view** | `v_invoice_status` computes on read. Never stored on the row |
| 6 | **Posted entries immutable** | Correction = reversal. No editing posted entries |
| 7 | **Money is DECIMAL everywhere** | `DECIMAL(14,2)` in PG · `decimal.js` in JS · `"5000.00"` on wire |
| 8 | **Double-confirm is idempotent** | `postDocument()` checks `journal_entry_id` — no duplicates |
| 9 | **Archive, never delete** | Delete of referenced record blocked. Archive flag used instead |
| 10 | **Portal IDOR protection** | `scopeFor()` at data layer — URL tampering returns 403 |
| 11 | **Tax posts to its own account** | Output Tax → Tax Payable account, not Sales Income |
| 12 | **Two warning severities** | Debit ≠ Credit is BLOCKING. Budget overrun is NON-BLOCKING |
| 13 | **Gapless document numbers** | Row-level `FOR UPDATE` on `doc_sequences` — race-safe |
| 14 | **No partial failure orphans** | Bill confirm steps 3–8 are one atomic transaction |

---

## 15 👥 Team & Module Ownership

```mermaid
graph TD
    PS[("🔒 postingService.ts<br/>Vedesh ONLY<br/>journal_entries<br/>journal_entry_lines")]

    Vedesh["👨‍💻 Vedesh<br/>Backend Spine"] -->|owns| PS
    Vedesh --> SEQ["doc_sequences<br/>payments<br/>payment_allocations<br/>report queries"]

    Aman["👨‍💻 Aman<br/>Purchase + Master"] -->|calls postDocument| PS
    Aman --> AMN["contacts · products · accounts<br/>journals · analytic_accounts<br/>purchase_orders · vendor_bills"]

    Aryan["👨‍💻 Aryan<br/>Sales + Portal"] -->|calls postDocument| PS
    Aryan --> ARY["sales_orders<br/>customer_invoices<br/>portal routes"]

    Swapnil["👨‍💻 Swapnil<br/>Frontend"] -->|no tables| FE["🖥 React Components<br/>Pages · Design System<br/>Portal UI · Room Studio"]

    style PS fill:#F8EAE6,stroke:#9E4A38,stroke-width:3px
    style Vedesh fill:#EBD7BE,stroke:#4A3A34
    style Aman fill:#EBD7BE,stroke:#4A3A34
    style Aryan fill:#EBD7BE,stroke:#4A3A34
    style Swapnil fill:#EBD7BE,stroke:#4A3A34
```

---

## 📎 Appendix: Key Architectural Decisions

<details>
<summary><b>1. Raw <code>pg</code> over Prisma for posting transactions</b></summary>

PostgreSQL's `DEFERRABLE INITIALLY DEFERRED` trigger requires a raw `pg PoolClient` transaction. Prisma's `$transaction()` does not guarantee correct trigger timing — the balance check would fire too early.

</details>

<details>
<summary><b>2. Scope at data layer, not route layer</b></summary>

Route guards create a false sense of security — one missed endpoint and IDOR is live. `scopeFor()` rewrites the SQL `WHERE` clause on every query. URL tampering is structurally impossible, not defensively patched.

</details>

<details>
<summary><b>3. Deferred balance trigger</b></summary>

`trg_lines_balanced` fires on `COMMIT`, not on each `INSERT`. This allows the service to insert all lines in a loop before the balance invariant is checked. If any line is missing, PostgreSQL rolls back the whole transaction.

</details>

<details>
<summary><b>4. Payment status from views (never stored)</b></summary>

`v_invoice_status` recomputes `Paid | Partial | Not Paid` from `payment_allocations` on every read. Storing status would require update logic on every payment mutation — a classic source of stale-data bugs.

</details>

<details>
<summary><b>5. Indian number formatting — hand-rolled</b></summary>

Docker's Node.js ships `small-icu` (English locale only). `Intl.NumberFormat('en-IN')` silently falls back to Western grouping (`1,234,567`) instead of Indian grouping (`12,34,567`). The hand-rolled formatter is the only reliable approach inside containers.

</details>

<details>
<summary><b>6. Combo product type — deferred</b></summary>

The spec defines Combo products. Decision: deferred from core accounting scope. Combo products behave as bundles in the catalogue and portal but post as individual line items on invoices (no special bundle accounting logic).

</details>

<details>
<summary><b>7. Eight account types (mockup) vs five (PDF spec)</b></summary>

The PDF spec lists five account types. The mockup lists eight, with Bank and Cash as distinct types. We follow the mockup — distinct Bank and Cash types match real-world charts of accounts and enable correct journal defaulting.

</details>

---

<div align="center">

---

**Built for Urban Furniture**

Vedesh &nbsp;·&nbsp; Aman &nbsp;·&nbsp; Aryan &nbsp;·&nbsp; Swapnil

<br/>

<img src="https://img.shields.io/badge/PostgreSQL-enforced%20balance-336791?style=flat-square&logo=postgresql&logoColor=white"/>
<img src="https://img.shields.io/badge/100%25-Offline-5F7052?style=flat-square"/>
<img src="https://img.shields.io/badge/decimal.js-no%20floats-C08A3E?style=flat-square"/>

</div>
