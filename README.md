# Urban Furniture — Accounting & Management ERP

> **Odoo India Hackathon 2026 Finale — Grand Finale Submission**  
> An integrated, showroom-grade Enterprise Resource Planning (ERP) platform and double-entry accounting engine engineered for furniture manufacturing and retail enterprises. Completely self-contained, offline-first, and strictly balanced down to the paisa.

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)]()
[![Database](https://img.shields.io/badge/PostgreSQL-16--Alpine-blue.svg)]()
[![Frontend](https://img.shields.io/badge/React-18%20%7C%20TailwindCSS-38bdf8.svg)]()
[![Backend](https://img.shields.io/badge/Node.js-Express%20REST-green.svg)]()
[![Accounting](https://img.shields.io/badge/Double--Entry-Strict%20Enforcement-gold.svg)]()
[![License](https://img.shields.io/badge/license-MIT-purple.svg)]()

---

## 🏛️ System Architecture

<p align="center">
  <img src="docs/assets/system_architecture.png" alt="Urban Furniture System Architecture" width="100%" />
</p>

<details open>
<summary><b>🔍 View Component Flowchart (Mermaid)</b></summary>
<br/>

```mermaid
flowchart LR
    subgraph SysArch [SYSTEM ARCHITECTURE — URBAN FURNITURE ERP]
        direction LR

        subgraph ActorsCluster [Users and Clients]
            Users[Users and Clients<br/>Staff: Admin, Accountant, Sales<br/>Customer Portal Users]
        end

        subgraph GatewayCluster [Frontend Client Tier]
            Gateway[React 18 Web App<br/>Vite Server :5173 / :80<br/>TailwindCSS and AppShell]
        end

        subgraph AppCluster [Application Core - Docker]
            WebApp[Express REST API Server<br/>Node.js 20 - Port 5002<br/>Double-Entry Posting Engine<br/>Pre-Commitment Budgets and RBAC]
        end

        subgraph PaymentCluster [Payment Gateway]
            Razorpay[Razorpay Payment Gateway<br/>Online UPI and Cards Modal<br/>HMAC-SHA256 Signatures]
        end

        subgraph StorageCluster [Storage Layer - Docker]
            direction TB
            PostgresDB[PostgreSQL 16 DB - Port 5432<br/>General Ledger: journal_entries and lines<br/>Commercial: PO, SO, Bills, Invoices<br/>Analytic Budgets and Audit Log<br/>Trigger: check_entry_balanced]
            DocStorage[Document Storage<br/>Invoice PDFs and Payment Vouchers]
        end

        subgraph WorkerCluster [PDF and Email Delivery Engine]
            direction TB
            PdfEngine[Chromium Puppeteer<br/>Deterministic A4 PDF Receipts]
            EmailService[Resend Email API<br/>api.resend.com/emails<br/>Dispatches PDF to Client Gmail]
        end

        subgraph ObservabilityCluster [Audit and Invariant Verification]
            direction LR
            Verifier[Zero-Delta Verifier<br/>GET /api/verify<br/>Strict Total Dr = Total Cr = 0.00]
            AuditTrail[Immutable Audit Trail<br/>audit_log Table<br/>User, Timestamp, Diff]
            HealthProbes[Health Probes<br/>GET /api/health<br/>Docker Container Readiness]
        end

        Users <-->|http2 / HTTPS| Gateway
        Gateway <-->|http/1.1 REST| WebApp

        Razorpay -->|Order and Signature Verification| WebApp

        WebApp <-->|pg / SQL Wire| PostgresDB
        WebApp <-->|File I/O| DocStorage

        WebApp -->|Render Event| PdfEngine
        PdfEngine -->|Base64 Attachment| EmailService
        EmailService -.->|Email Receipt| Users

        WebApp -.->|Audit Check| Verifier
        WebApp -.->|Mutation Audit| AuditTrail
        WebApp -.->|Container Status| HealthProbes
    end
```

</details>

### Architecture Subsystems at a Glance

| Subsystem | Key Components | Protocols & Ports | Role in Urban Furniture ERP |
| :--- | :--- | :--- | :--- |
| **Actors / Users** | Staff (Admin, Accountant, Sales, Warehouse) & Customer Portal Clients | Browser / HTTPS | Operational ERP management and external customer self-service invoice settlement. |
| **Frontend Client** | React 18, Vite Bundler, TailwindCSS, AppShell | `HTTP/2` (`:5173`, `:80`) | Responsive user interface, double-entry modals, budget warning banners. |
| **Core Web App & API** | Node.js 20, Express 5, TypeScript, Zod, Decimal.js | `HTTP/1.1 REST` (`:5000` / `:5002`) | Commercial workflows, double-entry posting engine, pre-commitment budget checks, and data scoping. |
| **Payment Gateway** | Razorpay Payment Gateway API & Test Sandbox | HTTPS REST / Webhooks | Online checkout, card/UPI tokenization, and deterministic HMAC-SHA256 signature verification. |
| **Storage Subsystem** | PostgreSQL 16 Alpine, Local Document Storage | Postgres Wire (`:5432`), Docker Volumes | Transactional ACID ledger, immutable audit trail, gapless numbering sequences, and PDF documents. |
| **Email & PDF Pipeline** | Headless Chromium (Puppeteer) + Resend API (`api.resend.com`) | Native REST | Deterministic A4 payment receipt PDF generation and direct delivery to client Gmail. |
| **Observability** | Zero-Delta Invariant Verifier, Audit Trail, Health Probes | `/api/verify`, `/api/health` | Live verification of $\sum \text{Debit} \equiv \sum \text{Credit} = 0.00$ down to the paisa, container health checks. |


---

## Table of Contents

0. [System Architecture](#%EF%B8%8F-system-architecture)

1. [Project Overview](#1-project-overview)
2. [Problem Statement](#2-problem-statement)
3. [The Solution: Urban Furniture ERP](#3-the-solution-urban-furniture-erp)
4. [Target Users & Role-Based Access Control (RBAC)](#4-target-users--role-based-access-control-rbac)
5. [Key Product Capabilities](#5-key-product-capabilities)
6. [Technology Stack](#6-technology-stack)
7. [High-Level System Architecture](#7-high-level-system-architecture)
8. [Complete ERP Data Flow](#8-complete-erp-data-flow)
9. [Master Data Engine](#9-master-data-engine)
10. [Purchase Order Management](#10-purchase-order-management)
11. [Purchase Order Budget Validation](#11-purchase-order-budget-validation)
12. [Vendor Bill Module](#12-vendor-bill-module)
13. [Vendor Bill Double-Entry Accounting](#13-vendor-bill-double-entry-accounting)
14. [Vendor Payments & Installment Engine](#14-vendor-payments--installment-engine)
15. [Sales Order Management](#15-sales-order-management)
16. [Customer Invoice Module](#16-customer-invoice-module)
17. [Customer Invoice Accounting & Revenue Recognition](#17-customer-invoice-accounting--revenue-recognition)
18. [Customer Payments & Installment Allocations](#18-customer-payments--installment-allocations)
19. [Real-Time Inventory & Stock Engine](#19-real-time-inventory--stock-engine)
20. [Accounting Core & Double-Entry General Ledger](#20-accounting-core--double-entry-general-ledger)
21. [Analytic Budgeting & Budget Revision Engine](#21-analytic-budgeting--budget-revision-engine)
22. [Accounts Receivable (A/R) Management](#22-accounts-receivable-ar-management)
23. [Accounts Payable (A/P) Management](#23-accounts-payable-ap-management)
24. [Profit & Loss (P&L) Financial Statement](#24-profit--loss-pl-financial-statement)
25. [Balance Sheet Financial Statement](#25-balance-sheet-financial-statement)
26. [Database Schema & Data Architecture](#26-database-schema--data-architecture)
27. [Entity Relationship (ER) Diagram](#27-entity-relationship-er-diagram)
28. [RESTful API Architecture](#28-restful-api-architecture)
29. [Authoritative Validation Architecture](#29-authoritative-validation-architecture)
30. [Security, Privacy & Isolation Architecture](#30-security-privacy--isolation-architecture)
31. [UI/UX Design Philosophy & Visual Tokens](#31-uiux-design-philosophy--visual-tokens)
32. [Screen-by-Screen ERP Specification](#32-screen-by-screen-erp-specification)
33. [End-to-End Enterprise Scenario](#33-end-to-end-enterprise-scenario)
34. [Visual Workflow Diagram Gallery](#34-visual-workflow-diagram-gallery)
35. [Live Hackathon Judging & Demo Walkthrough](#35-live-hackathon-judging--demo-walkthrough)
36. [Architectural Differentiators](#36-architectural-differentiators)
37. [Future Roadmap](#37-future-roadmap)
38. [Project Directory Topology](#38-project-directory-topology)
39. [Core Development Principles](#39-core-development-principles)
40. [Installation, Setup & Verification](#40-installation-setup--verification)

---

## 1. Project Overview

**Urban Furniture ERP** is an integrated management and double-entry accounting ERP suite tailored to the specific operational rhythms of furniture manufacturing and retail showrooms. Furniture operations navigate unique operational bottlenecks: high unit values, raw material conversions (teakwood, fabrics, metals), multi-stage custom orders, milestone and installment payments, strict vendor credit cycles, and departmental material budgets.

Urban Furniture ERP unifies every operational touchpoint across the business:

```
Master Data → Purchase Orders → Vendor Bills → Vendor Payments (Installments)
     ↓
Inventory Updates (+ on Bill, - on Invoice)
     ↓
Sales Orders → Customer Invoices → Customer Payments (Installments)
     ↓
Analytic Cost-Center Budgets
     ↓
Strict Double-Entry General Ledger (Debit = Credit)
     ↓
Automated Financial Statements: Profit & Loss, Balance Sheet, A/R & A/P
```

### The Inviolable Core Principle

$$\sum \text{Debit} \equiv \sum \text{Credit}$$

> [!IMPORTANT]
> **Every confirmed financial event creates an immutable, balanced journal entry in PostgreSQL.**
> Financial reports (P&L, Balance Sheet, Trial Balance, Receivables, Payables) are computed live directly from ledger line records (`journal_entry_lines`). They are **never** maintained in denormalized snapshot tables, and never computed from unconfirmed draft records. If the ledger is not balanced, the database rejects the transaction at the database trigger level.

---

## 2. Problem Statement

Small, medium, and mid-market furniture manufacturers and showrooms in India struggle with disconnected tools:

* **Spreadsheet Disconnect**: Quotes and purchase requests live in spreadsheets, completely isolated from billing software and physical warehouse registers.
* **Installment Payment Blindspots**: Furniture orders frequently operate on staged advances (e.g., 40% deposit upon order, 40% on production dispatch, 20% on installation). Spreadsheets lose track of partial dues, creating leakage in receivables.
* **Premature Revenue Recognition**: Conventional accounting tools mistakenly recognize income when cash is received or orders are created, distorting GST liabilities and period-end statements.
* **Invisible Budget Overruns**: Purchasing agents order teakwood or premium hardware without visibility into department budgets, resulting in unchecked cost escalations.
* **Stock Divergence**: Inventory counts diverge because purchases and sales are recorded days after physical warehouse movements.
* **Unbalanced Financial Ledgers**: Entry-level systems allow asymmetric journal entries, leading to days of reconciliation effort before annual balance sheets can be closed.

### How Urban Furniture ERP Solves These Problems

Urban Furniture ERP replaces fractured tools with a single, transactionally consistent engine:

| Problem in Traditional Furniture Operations | Urban Furniture ERP Solution |
|---|---|
| Manual, error-prone bookkeeping | Automated double-entry journal posting upon document confirmation |
| Lost installment records | Dedicated allocation ledger preserving original invoices while tracking staged payments |
| Broken inventory registers | Real-time transactional stock moves incremented on bill confirm and decremented on invoice confirm |
| Uncontrolled procurement spend | Automated real-time budget checking at Purchase Order confirmation with blocking limits |
| Out-of-sync financial statements | Live SQL aggregation over journal entry lines for immediate P&L and Balance Sheet balance |
| Unsecured client access | Dual-portal architecture: Internal ERP surface for staff, and an isolated Customer Portal for buyers |

---

## 3. The Solution: Urban Furniture ERP

Urban Furniture ERP provides an end-to-end ERP backbone that enforces accounting integrity at the data layer rather than trusting UI validation:

```mermaid
graph TD
    classDef master fill:#EBD7BE,stroke:#77574A,stroke-width:2px,color:#4A3A34;
    classDef purchase fill:#FBF1DF,stroke:#C08A3E,stroke-width:2px,color:#4A3A34;
    classDef sales fill:#EDF1E8,stroke:#5F7052,stroke-width:2px,color:#4A3A34;
    classDef ledger fill:#F8EAE6,stroke:#9E4A38,stroke-width:2px,color:#4A3A34;
    classDef report fill:#FFFFFF,stroke:#77574A,stroke-width:2px,color:#4A3A34;

    M[Master Data: CoA, Contacts, Products, Journals]:::master --> PO[Purchase Orders]:::purchase
    M --> SO[Sales Orders]:::sales
    
    PO -->|Auto-Convert| VB[Vendor Bills]:::purchase
    SO -->|Auto-Convert| CI[Customer Invoices]:::sales
    
    VB -->|Confirm| JE1[Bill Journal Entry: Expense Dr / Creditor Cr]:::ledger
    CI -->|Confirm| JE2[Invoice Journal Entry: Debtor Dr / Income Cr]:::ledger
    
    VB -->|Staged Payments| VP[Vendor Payments: Send]:::purchase
    CI -->|Installment Dues| CP[Customer Payments: Receive]:::sales
    
    VP -->|Post| JE3[Payment Entry: Creditor Dr / Bank Cr]:::ledger
    CP -->|Post| JE4[Payment Entry: Bank Dr / Debtor Cr]:::ledger
    
    VB -.->|Stock Increase| INV[(Warehouse Inventory)]:::master
    CI -.->|Stock Decrease| INV
    
    JE1 --> GL[(General Ledger Lines)]:::ledger
    JE2 --> GL
    JE3 --> GL
    JE4 --> GL
    
    GL --> PL[Profit & Loss Statement]:::report
    GL --> BS[Balance Sheet]:::report
    GL --> AR[Accounts Receivable Aging]:::report
    GL --> AP[Accounts Payable Aging]:::report
```

---

## 4. Target Users & Role-Based Access Control (RBAC)

Urban Furniture ERP is engineered with granular data scoping (`scopeFor(user, resource)`) enforced at the database and service layer:

### User Personas

1. **Owner / Executive Admin**: Complete system ownership, chart of accounts control, audit inspection, and fiscal closing.
2. **Accountant**: Day-to-day ledger management, vendor bill verification, customer invoicing, payment registration, and tax auditing.
3. **Operations / Sales & Purchase Manager**: Quotation, purchase order processing, order tracking, and stock visibility without permission to alter journals or chart of accounts.
4. **Warehouse / Operational Staff**: Physical stock receipt, dispatch tracking, and document viewing.
5. **Customer Contact (Customer Portal)**: Restricted client access to inspect billed tax invoices, review statement history, and settle outstanding balances via Razorpay.

### Permissions Matrix

| Module / Operation | Owner | Accountant | Manager | Operational Staff | Customer (Portal) |
|---|:---:|:---:|:---:|:---:|:---:|
| **Executive Dashboard** | Full | Full | View | View | Denied |
| **Product & Inventory Master** | Full | Full | Manage | View | Denied |
| **Contact Master (Vendors/Clients)**| Full | Full | Manage | View | Denied |
| **Chart of Accounts & Journals** | Full | Full | View Only | Denied | Denied |
| **Purchase Orders (Draft/Confirm)** | Full | Full | Manage | View | Denied |
| **Vendor Bills (Draft/Confirm)** | Full | Full | View Only | Denied | Denied |
| **Sales Orders (Draft/Confirm)** | Full | Full | Manage | View | Denied |
| **Customer Invoices (Confirm)** | Full | Full | View Only | Denied | Denied |
| **Register Payments (Send/Receive)** | Full | Full | Denied | Denied | Self Invoices Only |
| **Post/Reverse Journal Entries** | Full | Full | Denied | Denied | Denied |
| **Analytic Budget Creation/Revision**| Full | Full | View Only | Denied | Denied |
| **Profit & Loss Statement** | Full | Full | Denied | Denied | Denied |
| **Balance Sheet** | Full | Full | Denied | Denied | Denied |
| **Audit Logs & Ledger Verification**| Full | Full | Denied | Denied | Denied |

> [!CAUTION]
> **Data Scoping Rule**: Role checks are never mere UI button toggles. Every route passes through `requireAuth` and `requireInternalUser` or `requirePortalContact`. If a customer contact tries to read a bill, journal entry, or another client's invoice, the SQL query strictly scopes to `WHERE customer_id = user.contact_id`, blocking cross-tenant access.

---

## 5. Key Product Capabilities

* **Strict Double-Entry Ledger Core**: Zero unbalanced entries permitted; mathematical validation checked in software and enforced by deferred PostgreSQL triggers.
* **Commercial Orders Separate from Accounting**: Purchase and Sales Orders represent commercial intent and do **not** write journal entries. Only confirmed Bills and Invoices post to the General Ledger.
* **Installment & Milestone Payment Engine**: High-ticket furniture invoices support progressive settlements across Bank and Cash without mutating original invoice totals.
* **Pre-Commitment Budget Enforcement**: Purchase orders validate departmental analytic account balances before confirmation, presenting non-blocking warning banners at 80% and blocking overruns.
* **Live Material Inventory Synchronization**: Stock on hand is driven by discrete `stock_moves` tables tied to physical fulfillment rather than manual edits.
* **Showroom-Grade Aesthetic**: Warm walnut and cream palette reflecting natural woods, leather, and tactile showroom craftsmanship.
* **Strict External API Policy (Razorpay Only)**: Operates without external CDNs, cloud AI services, or third-party web scrapers. The **Razorpay Payment Gateway API** is the sole external API integrated for secure online customer payment checkout.

---

## 6. Technology Stack

Urban Furniture ERP runs as a single, multi-container Docker Compose application:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                             CLIENT LAYER                                 │
│  React 18  ·  TypeScript Strict  ·  Tailwind CSS v3  ·  Vite Bundler     │
│  Self-Hosted Typography (@fontsource Montserrat, DM Sans, IBM Plex Mono) │
└──────────────────────────────────────────────────────────────────────────┘
                                     │
                           REST API (JSON over HTTP)
                           HttpOnly Secure Cookies
                                     │
┌──────────────────────────────────────────────────────────────────────────┐
│                             SERVER LAYER                                 │
│  Node.js v20  ·  Express.js 5  ·  TypeScript Strict  ·  Zod Schemas      │
│  Argon2id Password Hashing  ·  JWT Session Tokens  ·  Decimal.js Math    │
└──────────────────────────────────────────────────────────────────────────┘
                                     │
                          Parameterized SQL via pg
                                     │
┌──────────────────────────────────────────────────────────────────────────┐
│                            DATABASE LAYER                                │
│  PostgreSQL 16 Alpine  ·  DECIMAL(14,2) Exact Numerics                   │
│  Trigger-Enforced Invariants  ·  Gapless Document Sequences              │
└──────────────────────────────────────────────────────────────────────────┘
```

### Stack Component Details

| Layer | Technology | Version | Purpose in Urban Furniture ERP |
|---|---|---|---|
| **Frontend Framework** | React | `18.3.1` | Component-driven, responsive user interface |
| **Language** | TypeScript | `5.9.3` | End-to-end type safety across client and server |
| **Styling** | Tailwind CSS | `3.4.17` | Utility-first design token implementation (`Design.md`) |
| **Build Tooling** | Vite | `6.4.3` | Hot-module replacement and minified bundling |
| **Backend Runtime** | Node.js | `20.x` | High-throughput asynchronous server runtime |
| **API Framework** | Express.js | `5.2.1` | REST route orchestration, parsing, and middleware |
| **Database Engine** | PostgreSQL | `16-alpine`| ACID-compliant transactional relational storage |
| **Schema Validation** | Zod | `4.5.4` | Shared schemas for runtime payload validation |
| **Precision Math** | Decimal.js | `10.6.0` | IEEE 754 floating point error prevention |
| **Password Security** | Argon2id | `0.45.1` | Memory-hard cryptographic credential hashing |
| **Tokens** | JSON Web Tokens| `9.0.3` | Stateless authentication stored in `httpOnly` cookies |
| **Containerization** | Docker Compose | `v2` | Single-command deployment of DB, API, and Web |

---

## 7. High-Level System Architecture

```mermaid
graph TB
    subgraph Client_Tier ["Frontend Client Tier (Vite / React)"]
        UI_Admin["Admin ERP Portal<br/>(Dashboard, Sales, Purchase, Ledger)"]
        UI_Customer["Customer Portal Surface<br/>(Invoices, Statement, Pay Dues)"]
        UI_Components["Design System Components<br/>(Montserrat, DM Sans, IBM Plex Mono)"]
        Axios["API Client (withCredentials: true)"]
    end

    subgraph API_Tier ["Backend Application Tier (Node.js / Express)"]
        Auth_MW["Auth & RBAC Middleware<br/>(JWT in HttpOnly Cookie)"]
        Scope_MW["Data Scoping Engine<br/>scopeFor(user, resource)"]
        
        subgraph Services ["Core Business Logic Services"]
            Posting_Svc["Posting Service<br/>(Only writer to ledger)"]
            Doc_Svc["Document Numbering<br/>(next_doc_number sequence)"]
            Pay_Svc["Payment & Allocation Svc<br/>(Installment Tracker)"]
            Stock_Svc["Inventory Movement Svc<br/>(Transactional stock_moves)"]
            Budget_Svc["Budget Check Svc<br/>(Analytical Validation)"]
            Report_Svc["Financial Reporting Svc<br/>(Live SQL Aggregator)"]
        end
    end

    subgraph DB_Tier ["Persistence Tier (PostgreSQL 16)"]
        Tables_Master[(Master: Contacts, Products, CoA)]
        Tables_Doc[(Documents: PO, SO, Bills, Invoices)]
        Tables_Ledger[(Ledger: journal_entries, lines)]
        Tables_Ops[(Operations: stock_moves, audit_log)]
        Views[(Computed Views: v_receivables, v_payables, v_ledger_detail)]
        Triggers{"Database Triggers<br/>(check_entry_balanced)"}
    end

    UI_Admin --> Axios
    UI_Customer --> Axios
    Axios --> Auth_MW
    Auth_MW --> Scope_MW
    Scope_MW --> Services
    
    Posting_Svc --> Tables_Ledger
    Doc_Svc --> Tables_Doc
    Pay_Svc --> Tables_Doc
    Stock_Svc --> Tables_Ops
    Budget_Svc --> Tables_Master
    Report_Svc --> Views
    
    Tables_Ledger --> Triggers
```

---

## 8. Complete ERP Data Flow

The following sequence details how master data orchestrates both the purchase and sales lifecycles, ultimately flowing into the general ledger and financial reports:

```mermaid
flowchart TD
    classDef master fill:#EBD7BE,stroke:#77574A,stroke-width:2px;
    classDef purchase fill:#FBF1DF,stroke:#C08A3E,stroke-width:2px;
    classDef sales fill:#EDF1E8,stroke:#5F7052,stroke-width:2px;
    classDef finance fill:#F8EAE6,stroke:#9E4A38,stroke-width:2px;

    M1[Product Master]:::master
    M2[Contact Master]:::master
    M3[Chart of Accounts]:::master
    M4[Analytic Accounts]:::master

    %% Purchase Cycle
    M2 -->|Vendor| PO[Purchase Order P00001]:::purchase
    M1 -->|Lines & Qty| PO
    M4 -->|Expense Analytic| PO
    PO -->|Budget Check| B_VAL{Within Budget?}
    B_VAL -->|No| PO_WARN[Block / Overrun Warning]
    B_VAL -->|Yes| PO_CONF[PO Confirmed]:::purchase
    PO_CONF -->|Create Bill| VB[Vendor Bill Bill/2026/0001]:::purchase
    VB -->|Confirm Bill| JE_VB[Journal Entry: Dr Purchase Expense / Cr Creditors]:::finance
    VB -->|Receipt of Goods| SM_IN[+ Stock Move: Products Inward]:::purchase
    VB -->|Record Payment| PAY_V[Payment: Send via Bank/Cash]:::purchase
    PAY_V -->|Post Payment| JE_VP[Journal Entry: Dr Creditors / Cr Bank]:::finance

    %% Sales Cycle
    M2 -->|Customer| SO[Sales Order SO/2026/0001]:::sales
    M1 -->|Furniture Item| SO
    SO -->|Confirm| SO_CONF[SO Confirmed]:::sales
    SO_CONF -->|Create Invoice| CI[Customer Invoice Inv/2026/0001]:::sales
    CI -->|Confirm Invoice| JE_CI[Journal Entry: Dr Debtors / Cr Sales Income]:::finance
    CI -->|Goods Dispatch| SM_OUT[- Stock Move: Products Outward]:::sales
    CI -->|Record Payment| PAY_C[Payment: Receive via Bank/Cash]:::sales
    PAY_C -->|Post Payment| JE_CP[Journal Entry: Dr Bank / Cr Debtors]:::finance

    %% Financial Statements
    JE_VB --> GL[(General Ledger Lines)]:::finance
    JE_VP --> GL
    JE_CI --> GL
    JE_CP --> GL

    GL --> PL[Profit & Loss: Sales - Expenses]:::finance
    GL --> BS[Balance Sheet: Assets = Liabilities + Equity]:::finance
    GL --> AR[Accounts Receivable View]:::finance
    GL --> AP[Accounts Payable View]:::finance
```

---

## 9. Master Data Engine

Master data represents the foundation of truth across Urban Furniture ERP. No transaction can reference non-existent contacts, items, or accounts.

### A. Contacts Master (`contacts`)
Handles both upstream suppliers and downstream buyers under a single polymorphic table.
* **Fields**: `id`, `name`, `type ('customer' | 'vendor' | 'both')`, `email`, `mobile`, `address`, `city`, `state`, `pincode`, `gstin`, `image_path`, `is_archived`.
* **Validation**: Email validation regex, Indian GSTIN pattern verification, phone character constraints.
* **Behavior**: Archived contacts cannot be selected for new POs or SOs, but historical records remain intact.

### B. Products Master (`products`)
Encompasses raw materials, finished wooden goods, upholstery, and custom assembly services.
* **Fields**: `id`, `sku`, `name`, `type ('goods' | 'service' | 'combo')`, `category`, `sales_price`, `cost_price`, `mrp`, `tax_rate`, `stock_qty`, `is_archived`.
* **Precision**: All financial amounts are `DECIMAL(14,2)`; quantities are `DECIMAL(12,2)`.
* **Stock Source of Truth**: `stock_qty` is a cached denormalization; the authoritative quantity on hand is computed live by the database view `v_stock_on_hand` over physical `stock_moves`.

### C. Chart of Accounts (`accounts`)
Pre-seeded, standardized ledger accounts aligned with standard Indian accounting classifications:
1. **Bank** (`type: bank`) — Asset
2. **Cash** (`type: cash`) — Asset
3. **Debtors** (`type: asset`) — Accounts Receivable
4. **Creditors** (`type: liability`) — Accounts Payable
5. **Sales Income** (`type: income`) — Operating Revenue
6. **Purchase Expense** (`type: expense`) — Cost of Goods & Materials
7. **Other Expense** (`type: other_expense`) — Overheads, Utilities, Logistics
8. **Capital** (`type: capital`) — Owner's Equity
9. **Input Tax Credit** (`type: asset`) — GST paid on procurement
10. **Output Tax Payable** (`type: liability`) — GST collected on customer sales

### D. Financial Journals (`journals`)
Standard operational daybooks routing transactions to default debit/credit accounts:
* **Sales Journal** (`type: sales`) $\to$ Default Account: *Sales Income*
* **Purchase Journal** (`type: purchase`) $\to$ Default Account: *Purchase Expense*
* **Bank Journal** (`type: bank`) $\to$ Default Account: *Bank*
* **Cash Journal** (`type: cash`) $\to$ Default Account: *Cash*

### E. Analytic Accounts (`analytic_accounts`)
Dimension tags enabling cost-center accounting and departmental budget monitoring without cluttering the primary Chart of Accounts:
* **Analytic Types**: `income` | `expense`
* **Common Examples**: *Dining Room Line*, *Bedroom Furniture*, *Showroom Overheads*, *Timber Procurement*.

---

## 10. Purchase Order Management

The **Purchase Order (PO)** represents commercial procurement intent placed with raw material and hardware vendors.

```
┌────────────────────────────────────────────────────────────────────────┐
│ Purchase Order: P00001                                [ Status: DRAFT ] │
├────────────────────────────────────────────────────────────────────────┤
│ Vendor: Teakwood Traders Ltd.                 Date: 2026-09-05         │
├────────────────────────────────────────────────────────────────────────┤
│ Line | Product Description    | Analytic Code | Qty | Unit Price | Total│
│  1   | Grade-A Teak Planks    | Timber Budget | 10  |  ₹2,000.00 | ₹20k │
│  2   | Brass Handles (Pack 4) | Hardware Line | 25  |    ₹400.00 | ₹10k │
├────────────────────────────────────────────────────────────────────────┤
│ [ New ]  [ Confirm ]  [ Create Bill ]  [ Cancel ]            Total: ₹30,000│
└────────────────────────────────────────────────────────────────────────┘
```

* **Sequence Generation**: Evaluates `next_doc_number('PO')` producing zero-padded identifiers (e.g., `P00001`, `P00002`).
* **Line Calculations**: Performed using exact Decimal arithmetic:
  $$\text{Line Total} = \text{Quantity} \times \text{Unit Price}$$
* **Commercial Isolation**: **Confirming a Purchase Order creates NO journal entry.** It commits no ledger liabilities until goods are billed.

---

## 11. Purchase Order Budget Validation

When a user clicks **Confirm** on a Purchase Order, the backend automatically triggers the **Budget Validation Engine**:

```mermaid
flowchart TD
    PO_CLICK[User clicks Confirm on PO] --> LOAD_LINES[Extract PO Line Items & Analytic Accounts]
    LOAD_LINES --> QUERY_BUDGET[Query active Budget for Period & Analytic Account]
    
    QUERY_BUDGET --> CHECK_EXISTS{Active Budget Found?}
    CHECK_EXISTS -->|No| PROCEED[Allow Confirmation without Budget Lock]
    
    CHECK_EXISTS -->|Yes| CALC[Compute: Total Spent + Pending POs + Current PO]
    CALC --> COMP{Total > Committed Budget?}
    
    COMP -->|Yes| BLOCK[BLOCK CONFIRMATION<br/>Severity: BLOCKING<br/>Show Deficit Amount]
    COMP -->|No, but > 80%| WARN[ALLOW CONFIRMATION<br/>Severity: WARNING<br/>Display Non-Blocking Amber Banner]
    COMP -->|No, < 80%| OK[CONFIRM PO<br/>Update Status to Confirmed]
```

### Budget Formulas
$$\text{Available Budget} = \text{Committed Amount} - (\text{Actual Spent} + \text{Confirmed Pending POs})$$

* **Overrun (Blocking)**: If $\text{PO Total} > \text{Available Budget}$, confirmation is prevented at the service layer with an HTTP 400 response.
* **Soft Threshold Warning**: If total commitments reach 80% of approved budget lines, a non-blocking amber warning is displayed to prompt review.

---

## 12. Vendor Bill Module

A Vendor Bill represents the financial claim and tax document submitted by a supplier.

* **One-Click PO Conversion**: When a confirmed PO is converted to a Bill, all lines, product descriptions, quantities, unit prices, and analytic accounts are copied automatically into `vendor_bills` and `vendor_bill_lines`.
* **Idempotency Safeguard**: `vendor_bills.po_id` prevents duplicate billing for the same Purchase Order.
* **Sequencing**: Formatted with fiscal year stamps (e.g., `Bill/2026/0001`).

---

## 13. Vendor Bill Double-Entry Accounting

When an accountant confirms a Vendor Bill, the ERP calls `PostingService.postDocument()`.

### Example: Timber Procurement Bill of ₹10,000 (with 18% GST)

$$\begin{aligned}
\text{Subtotal} &= ₹10,000.00 \\
\text{Input Tax Credit (18\% GST)} &= ₹1,800.00 \\
\text{Total Creditor Obligation} &= ₹11,800.00
\end{aligned}$$

#### Balanced Journal Entry Written to General Ledger
| Account | Line Partner | Debit (₹) | Credit (₹) | Notes |
|---|---|:---:|:---:|---|
| **Purchase Expense** | Teakwood Traders | `10,000.00` | `0.00` | Recognizes material procurement cost |
| **Input Tax Credit** | Teakwood Traders | `1,800.00` | `0.00` | Recoverable GST input asset |
| **Creditors** | Teakwood Traders | `0.00` | `11,800.00` | Accounts Payable obligation |
| **TOTALS** | | **`11,800.00`** | **`11,800.00`** | **Balanced ($\Delta = 0.00$)** |

---

## 14. Vendor Payments & Installment Engine

Furniture procurement involves significant capital outlays, requiring progressive disbursements.

### Staged Settlement Lifecycle

```mermaid
sequenceDiagram
    autonumber
    actor Accountant
    participant Bill as Vendor Bill (₹2,00,000)
    participant Engine as Payment Engine
    participant Alloc as Payment Allocations
    participant Ledger as General Ledger

    Accountant->>Engine: Send Payment ₹50,000 via Bank
    Engine->>Alloc: Insert Allocation (Bill ID, ₹50,000)
    Engine->>Ledger: Write Journal: Dr Creditor ₹50k / Cr Bank ₹50k
    Note over Bill: Bill Status: PARTIAL (Remaining: ₹1,50,000)

    Accountant->>Engine: Send Payment ₹75,000 via Bank
    Engine->>Alloc: Insert Allocation (Bill ID, ₹75,000)
    Engine->>Ledger: Write Journal: Dr Creditor ₹75k / Cr Bank ₹75k
    Note over Bill: Bill Status: PARTIAL (Remaining: ₹75,000)

    Accountant->>Engine: Send Final Payment ₹75,000 via Cash
    Engine->>Alloc: Insert Allocation (Bill ID, ₹75,000)
    Engine->>Ledger: Write Journal: Dr Creditor ₹75k / Cr Cash ₹75k
    Note over Bill: Bill Status: PAID (Remaining: ₹0.00)
```

> [!IMPORTANT]
> **Non-Destructive Ledger Rule**: The original `vendor_bills` record is **never modified or overwritten** when installments are made. Payments are inserted as distinct records into `payments` and linked via `payment_allocations`. Paid amounts are computed dynamically from `v_vendor_bill_paid_amounts`.

---

## 15. Sales Order Management

Sales Orders capture showroom custom orders, commercial furnishings, or retail item orders.

* **Customer Linking**: Linked to verified customer records in `contacts`.
* **Pricing Precision**: Line totals and taxes are calculated automatically on change:
  $$\text{Subtotal} = \text{Quantity} \times \text{Sales Price}$$
  $$\text{Tax Amount} = \text{Subtotal} \times \frac{\text{Tax Rate}}{100}$$
  $$\text{Total} = \text{Subtotal} + \text{Tax Amount}$$
* **Status Pipeline**: Transitions from `draft` $\to$ `confirmed` $\to$ `cancelled`.

---

## 16. Customer Invoice Module

Customer Invoices represent tax-compliant commercial sales bills issued to clients.

* **Generation**: Converted with a single click from confirmed Sales Orders, importing all item descriptions, quantities, prices, and tax rates.
* **Document Sequencing**: Numbered consecutively as `Inv/2026/0001`, `Inv/2026/0002`.
* **State Engine**: Document status is derived from allocation views:
  * `Not Paid`: Zero allocations recorded against invoice.
  * `Partial`: Allocations $> 0$ but $< \text{Invoice Total}$.
  * `Paid`: Total allocations equal invoice total.

---

## 17. Customer Invoice Accounting & Revenue Recognition

> [!NOTE]
> **Accrual Revenue Recognition**: Revenue is recognized at the moment of invoice issuance, **never** at the time of payment. Customer payments settle accounts receivable, and never touch Income accounts.

### Example: Dining Room Set Sale of ₹6,000

$$\begin{aligned}
\text{Total Invoice Amount} &= ₹6,000.00
\end{aligned}$$

#### Balanced Journal Entry
| Account | Line Partner | Debit (₹) | Credit (₹) | Notes |
|---|---|:---:|:---:|---|
| **Debtors** | Neha Desai | `6,000.00` | `0.00` | Current Asset (Accounts Receivable) |
| **Sales Income** | Neha Desai | `0.00` | `6,000.00` | Operating Revenue Earned |
| **TOTALS** | | **`6,000.00`** | **`6,000.00`** | **Balanced ($\Delta = 0.00$)** |

---

## 18. Customer Payments & Installment Allocations

When a customer pays an advance or clears an invoice balance:

```mermaid
flowchart LR
    INV[Customer Invoice: ₹2,00,000] --> P1[Payment 1: ₹50,000]
    P1 --> R1[Remaining Due: ₹1,50,000<br/>Status: PARTIAL]
    R1 --> P2[Payment 2: ₹75,000]
    P2 --> R2[Remaining Due: ₹75,000<br/>Status: PARTIAL]
    R2 --> P3[Payment 3: ₹75,000]
    P3 --> R3[Remaining Due: ₹0.00<br/>Status: PAID]
```

### Payment Accounting Entry (e.g., ₹50,000 Bank Receipt)
* **Debit**: `Bank` ₹50,000.00 (Cash/Bank Asset Increases)
* **Credit**: `Debtors` ₹50,000.00 (Customer Receivable Decreases)
* **Net Revenue Impact**: ₹0.00 (Revenue was already recognized at invoice issuance).

---

## 19. Real-Time Inventory & Stock Engine

Physical warehouse inventory is updated transactionally alongside financial events:

```mermaid
flowchart TD
    subgraph Procurement ["Procurement Flow"]
        VB[Vendor Bill Confirmed] -->|Triggers| SM_IN[stock_moves Insert: +Qty]
        SM_IN --> UPD_ONHAND[(Warehouse Stock Increases)]
    end

    subgraph Sales ["Fulfillment Flow"]
        CI[Customer Invoice Confirmed] -->|Triggers| SM_OUT[stock_moves Insert: -Qty]
        SM_OUT --> RED_ONHAND[(Warehouse Stock Decreases)]
    end

    subgraph View ["Source of Truth"]
        UPD_ONHAND --> V_STOCK[v_stock_on_hand View<br/>SUM(qty_change)]
        RED_ONHAND --> V_STOCK
    end
```

* **Transactional Consistency**: If a database transaction aborts during billing, stock movements roll back automatically.
* **Negative Stock Prevention**: Dispatches are validated against physical availability.

---

## 20. Accounting Core & Double-Entry General Ledger

The General Ledger is the immutable source of financial truth.

```mermaid
flowchart TD
    TX[Financial Mutation Request] --> PS[PostingService.postDocument]
    PS --> BEGIN[BEGIN DB Transaction]
    BEGIN --> INSERT_JE[INSERT INTO journal_entries status='draft']
    INSERT_JE --> INSERT_LINES[INSERT INTO journal_entry_lines]
    INSERT_LINES --> FLIP[UPDATE journal_entries SET status='posted']
    FLIP --> TRIG{Deferred Trigger: check_entry_balanced}
    TRIG -->|SUM Debit == SUM Credit| COMMIT[COMMIT Transaction]
    TRIG -->|SUM Debit != SUM Credit| ROLLBACK[ROLLBACK & Raise Blocking Error]
```

### Ledger Invariants
1. **Immutability**: Posted journal entries and lines cannot be modified or deleted.
2. **Reversals for Corrections**: To correct a mistake, the user generates a mirrored reversal entry (`source_type = 'reversal'`).
3. **Trigger-Enforced Balance**: PostgreSQL trigger `check_entry_balanced()` runs on commit, guaranteeing no unbalanced ledger state can persist.

---

## 21. Analytic Budgeting & Budget Revision Engine

Budgets allow management to plan and track operational expenditure across departments and product lines:

* **Budget Lifecycle**: `draft` $\to$ `confirmed` $\to$ `revised` $\to$ `cancelled`.
* **Revision Tracking**: When a budget is revised, the original record remains preserved and the new budget links to it via `revised_of_id`.
* **Performance Formulas**:
  $$\text{Advised \%} = \left(\frac{\text{Advised Amount}}{\text{Committed Amount}}\right) \times 100$$
  $$\text{Amount to Advise} = \text{Committed Amount} - \text{Advised Amount}$$

---

## 22. Accounts Receivable (A/R) Management

Customer receivables are tracked dynamically via the `v_receivables` database view:

```mermaid
pie title Outstanding Receivables by Customer
    "Neha Desai (Overdue >30d)" : 45
    "Divya Bhatt (Current)" : 30
    "Aditya Pathak (Due This Week)" : 25
```

* **Dynamic Computation**:
  $$\text{Customer Balance Due} = \sum \text{Invoiced Amounts} - \sum \text{Payment Allocations}$$
* **Live Aging**: Categorized as *Current*, *Due this Week*, and *Overdue* based on document due dates.

---

## 23. Accounts Payable (A/P) Management

Vendor payables track procurement obligations through the `v_payables` view:

* **Bill Tracking**: Displays original bill amount, disbursements made, and net payable.
* **Vendor Statements**: Comprehensive statement views displaying every historical bill, credit adjustment, and bank payment.

---

## 24. Profit & Loss (P&L) Financial Statement

The Profit & Loss report measures operating performance across selected fiscal periods:

```
┌────────────────────────────────────────────────────────────────────────┐
│ Urban Furniture — Profit & Loss Statement            Period: FY 2026   │
├────────────────────────────────────────────────────────────────────────┤
│ OPERATING REVENUE                                                      │
│   Sales Income (4000)                                     ₹14,50,000.00│
│   Total Revenue                                           ₹14,50,000.00│
├────────────────────────────────────────────────────────────────────────┤
│ OPERATING EXPENSES                                                     │
│   Purchase Expense (5000)                     ₹8,20,000.00             │
│   Showroom & Logistics (5100)                 ₹1,10,000.00             │
│   Total Operating Expenses                                 ₹9,30,000.00│
├────────────────────────────────────────────────────────────────────────┤
│ NET OPERATING PROFIT                                       ₹5,20,000.00│
└────────────────────────────────────────────────────────────────────────┘
```

$$\text{Net Profit} = \sum \text{Credit}_{\text{Income}} - \sum \text{Debit}_{\text{Expense}}$$

* Generated directly from `journal_entry_lines` joined with account types `income`, `expense`, and `other_expense`.
* Zero manual data entry: reports update in real time as invoices and bills are confirmed.

---

## 25. Balance Sheet Financial Statement

The Balance Sheet provides an authoritative snapshot of financial position, satisfying the fundamental accounting equation:

$$\text{Assets} \equiv \text{Liabilities} + \text{Equity}$$

```
┌──────────────────────────────────┬──────────────────────────────────┐
│              ASSETS              │       LIABILITIES & EQUITY       │
├──────────────────────────────────┼──────────────────────────────────┤
│ Current Assets                   │ Current Liabilities              │
│   Bank Accounts      ₹4,50,000.00│   Creditors (A/P)    ₹3,20,000.00│
│   Cash on Hand         ₹70,000.00│   Output Tax Payable   ₹85,000.00│
│   Debtors (A/R)      ₹3,80,000.00│                                  │
│   Input Tax Credit     ₹65,000.00│ Total Liabilities    ₹4,05,000.00│
├──────────────────────────────────┼──────────────────────────────────┤
│                                  │ Equity                           │
│                                  │   Opening Capital    ₹5,00,000.00│
│                                  │   Current Retained   ₹60,000.00  │
├──────────────────────────────────┼──────────────────────────────────┤
│ TOTAL ASSETS         ₹9,65,000.00│ TOTAL LIAB & EQUITY  ₹9,65,000.00│
└──────────────────────────────────┴──────────────────────────────────┘
```

---

## 26. Database Schema & Data Architecture

The platform's relational foundation is organized into seven operational clusters in PostgreSQL:

| Table Name | Purpose | Primary Key | Foreign Keys & Relationships |
|---|---|---|---|
| `users` | System credentials & RBAC | `id` | `contact_id` $\to$ `contacts.id` |
| `contacts` | Suppliers & customers | `id` | Referenced by bills, invoices, POs, SOs |
| `products` | Inventory catalog & pricing | `id` | Referenced by all order and bill lines |
| `accounts` | Chart of Accounts | `id` | Referenced by journals and ledger lines |
| `journals` | Financial transaction daybooks | `id` | `default_account_id` $\to$ `accounts.id` |
| `analytic_accounts` | Cost center tags | `id` | Referenced by budget lines and order lines |
| `doc_sequences` | Gapless sequential numbering | `code` | Evaluated by `next_doc_number()` |
| `purchase_orders` | Vendor commercial commitments | `id` | `vendor_id` $\to$ `contacts.id` |
| `purchase_order_lines` | PO line items | `id` | `po_id`, `product_id`, `analytic_account_id` |
| `vendor_bills` | Supplier tax bills | `id` | `po_id`, `vendor_id`, `journal_entry_id` |
| `vendor_bill_lines` | Bill line items | `id` | `bill_id`, `product_id`, `account_id` |
| `sales_orders` | Customer order commitments | `id` | `customer_id` $\to$ `contacts.id` |
| `sales_order_lines` | SO line items | `id` | `so_id`, `product_id`, `analytic_account_id` |
| `customer_invoices` | Official customer bills | `id` | `so_id`, `customer_id`, `journal_entry_id` |
| `customer_invoice_lines`| Invoice line items | `id` | `invoice_id`, `product_id`, `account_id` |
| `payments` | Monetary receipts & disbursements| `id` | `partner_id`, `journal_entry_id` |
| `payment_allocations` | Staged payment links | `id` | `payment_id`, `invoice_id`, `bill_id` |
| `journal_entries` | General ledger header | `id` | `journal_id`, `reversal_of`, `created_by` |
| `journal_entry_lines` | General ledger debit/credit lines | `id` | `entry_id`, `account_id`, `partner_id` |
| `budgets` | Departmental budget plans | `id` | `responsible_user_id`, `revised_of_id` |
| `budget_lines` | Budget line amounts | `id` | `budget_id`, `analytic_account_id` |
| `stock_moves` | Warehouse inventory adjustments | `id` | `product_id`, polymorphic source |
| `audit_log` | Immutable compliance trail | `id` | `user_id` $\to$ `users.id` |

---

## 27. Entity Relationship (ER) Diagram

```mermaid
erDiagram
    USERS ||--o{ BUDGETS : "manages"
    USERS ||--o{ AUDIT_LOG : "records"
    CONTACTS ||--o{ USERS : "portal_user"
    CONTACTS ||--o{ PURCHASE_ORDERS : "vendor"
    CONTACTS ||--o{ VENDOR_BILLS : "vendor"
    CONTACTS ||--o{ SALES_ORDERS : "customer"
    CONTACTS ||--o{ CUSTOMER_INVOICES : "customer"
    CONTACTS ||--o{ PAYMENTS : "partner"

    ACCOUNTS ||--o{ JOURNALS : "default_account"
    ACCOUNTS ||--o{ JOURNAL_ENTRY_LINES : "categorizes"
    JOURNALS ||--o{ JOURNAL_ENTRIES : "groups"
    JOURNAL_ENTRIES ||--|{ JOURNAL_ENTRY_LINES : "contains"

    ANALYTIC_ACCOUNTS ||--o{ BUDGET_LINES : "budgeted_in"
    ANALYTIC_ACCOUNTS ||--o{ PURCHASE_ORDER_LINES : "tagged_in"
    ANALYTIC_ACCOUNTS ||--o{ SALES_ORDER_LINES : "tagged_in"
    ANALYTIC_ACCOUNTS ||--o{ JOURNAL_ENTRY_LINES : "cost_center"

    BUDGETS ||--|{ BUDGET_LINES : "specifies"
    BUDGETS ||--o{ BUDGETS : "revised_of"

    PRODUCTS ||--o{ PURCHASE_ORDER_LINES : "ordered"
    PRODUCTS ||--o{ VENDOR_BILL_LINES : "billed"
    PRODUCTS ||--o{ SALES_ORDER_LINES : "sold"
    PRODUCTS ||--o{ CUSTOMER_INVOICE_LINES : "invoiced"
    PRODUCTS ||--o{ STOCK_MOVES : "tracks"

    PURCHASE_ORDERS ||--|{ PURCHASE_ORDER_LINES : "contains"
    PURCHASE_ORDERS ||--o{ VENDOR_BILLS : "converted_to"
    VENDOR_BILLS ||--|{ VENDOR_BILL_LINES : "contains"
    VENDOR_BILLS ||--o| JOURNAL_ENTRIES : "posts"

    SALES_ORDERS ||--|{ SALES_ORDER_LINES : "contains"
    SALES_ORDERS ||--o{ CUSTOMER_INVOICES : "converted_to"
    CUSTOMER_INVOICES ||--|{ CUSTOMER_INVOICE_LINES : "contains"
    CUSTOMER_INVOICES ||--o| JOURNAL_ENTRIES : "posts"

    PAYMENTS ||--o| JOURNAL_ENTRIES : "posts"
    PAYMENTS ||--|{ PAYMENT_ALLOCATIONS : "allocates"
    VENDOR_BILLS ||--o{ PAYMENT_ALLOCATIONS : "settled_by"
    CUSTOMER_INVOICES ||--o{ PAYMENT_ALLOCATIONS : "settled_by"
```

---

## 28. RESTful API Architecture

All endpoints adhere strictly to a standardized response envelope:

```typescript
// Standard Success Envelope
{ "data": T, "error": null }

// Standard Error Envelope
{ "data": null, "error": { "code": "VALIDATION_ERROR", "message": "...", "severity": "blocking" | "warning", "fields": {} } }
```

### Core API Routing Groups

| Route Prefix | Method | Action Description | Security / Scope |
|---|---|---|---|
| `/api/auth/login` | `POST` | Internal staff authentication; issues HttpOnly cookie | Public |
| `/api/auth/logout` | `POST` | Invalidates token and clears cookie | Authenticated |
| `/api/auth/me` | `GET` | Returns active user session profile | Authenticated |
| `/api/portal/login` | `POST` | Customer portal contact authentication | Public |
| `/api/portal/invoices` | `GET` | Returns scoped invoices for logged-in customer | Portal Contact |
| `/api/portal/invoices/:id/pay`| `POST` | Customer records self-service invoice payment (Razorpay checkout & allocation) | Portal Contact |
| `/api/contacts` | `GET/POST` | List and create vendor and customer contacts | Internal Staff |
| `/api/products` | `GET/POST` | Catalog product definitions and cost prices | Internal Staff |
| `/api/accounts` | `GET` | Chart of Accounts ledger codes | Internal Staff |
| `/api/purchase-orders` | `GET/POST` | Draft, list, and update Purchase Orders | Internal Staff |
| `/api/purchase-orders/:id/confirm`| `POST`| Validates budget and confirms PO | Internal Staff |
| `/api/vendor-bills` | `GET/POST` | Draft and convert POs into Vendor Bills | Accountant/Admin |
| `/api/vendor-bills/:id/confirm` | `POST`| Validates and posts double-entry journal entry | Accountant/Admin |
| `/api/sales-orders` | `GET/POST` | Create and confirm Sales Orders | Internal Staff |
| `/api/customer-invoices` | `GET/POST` | Convert SOs to Invoices and confirm | Accountant/Admin |
| `/api/payments` | `POST` | Register send/receive payment with allocations | Accountant/Admin |
| `/api/journal-entries` | `GET/POST` | Inspect general ledger and create manual entries| Accountant/Admin |
| `/api/budgets` | `GET/POST` | Create, confirm, and revise department budgets | Accountant/Admin |
| `/api/reports/profit-loss` | `GET` | Aggregate period-specific P&L statement | Accountant/Admin |
| `/api/reports/balance-sheet` | `GET` | Compute live balance sheet statement | Accountant/Admin |
| `/api/verify` | `GET` | Audit check: $\sum \text{Debits} - \sum \text{Credits} \equiv 0$ | Accountant/Admin |

---

## 29. Authoritative Validation Architecture

Validation follows a strict two-tier pattern:

```
┌──────────────────────────────────────┐
│        FRONTEND VALIDATION           │
│  Fast, reactive user feedback        │
│  Zod schemas & interactive form lints│
└──────────────────────────────────────┘
                   │
                   ▼ (HTTP JSON Payload)
┌──────────────────────────────────────┐
│        BACKEND VALIDATION            │
│  AUTHORITATIVE & INVIOLABLE          │
│  1. Zod Body Parsing                 │
│  2. Business Logic Rule Verification │
│  3. Database Constraints & Triggers  │
└──────────────────────────────────────┘
```

### Comprehensive Validation Rules

1. **Quantities**: Must strictly satisfy $\text{qty} > 0$.
2. **Amounts & Prices**: Non-negative decimal constraint ($\text{price} \ge 0$).
3. **Double-Entry Balance (Blocking)**:
   $$\left|\sum \text{Debit} - \sum \text{Credit}\right| = 0.00$$
   Any entry where debits do not equal credits is blocked.
4. **Payment Cap**:
   $$\text{Allocated Payment} \le \text{Document Outstanding Due}$$
   Overpayments exceeding the unpaid balance are rejected.
5. **Pre-Commitment Budget Overrun**:
   POs exceeding available analytic budgets trigger blocking errors.
6. **Immutable Ledger Guard**:
   Journal entries with `status = 'posted'` reject any SQL `UPDATE` or `DELETE` mutations.
7. **Document Number Formatting**:
   Auto-generated identifiers (`PO00001`, `Bill/2026/0001`, `Inv/2026/0001`) cannot be overridden manually.

---

## 30. Security, Privacy & Isolation Architecture

* **Stateless JWT in HttpOnly Cookies**: Session tokens are signed via cryptographic secrets and transmitted inside `HttpOnly`, `SameSite=Lax` cookies, neutralizing Cross-Site Scripting (XSS) token exfiltration.
* **Argon2id Password Hashing**: Passwords are hashed with memory-hard Argon2id parameters (`m=65536, t=3, p=4`), offering protection against GPU-based rainbow table attacks.
* **SQL Injection Immunity**: Zero dynamic string concatenation. All PostgreSQL interactions use parameterized queries with numeric variables (`$1, $2, $3`).
* **Tenant Scoping & IDOR Defense**: The Customer Portal isolates clients at the query layer. Invoices and payment routes enforce `WHERE customer_id = user.contact_id`.
* **Strict API Isolation (Razorpay Only)**: Zero third-party tracking scripts, cloud AI models, or external CDNs. The **Razorpay Payment Gateway API** is the sole external API integrated across the system, strictly isolated to customer digital payment checkout.

---

## 31. UI/UX Design Philosophy & Visual Tokens

Urban Furniture ERP features a tailored design system inspired by bespoke furniture showrooms:

```css
/* Core Design Tokens (Design.md) */
--cream:      #F9F2E4;   /* Background ground */
--surface:    #FFFFFF;   /* Cards, forms, tables */
--brown-900:  #4A3A34;   /* Walnut ink / primary text */
--brown-700:  #77574A;   /* Secondary text & active links */
--brown-300:  #D0AE92;   /* Dividers, card borders */
--brown-100:  #EBD7BE;   /* Table header stripes & hover */
--posted:     #5F7052;   /* Confirmed / Posted / Paid green */
--posted-bg:  #EDF1E8;   /* Green pill background */
--warning:    #C08A3E;   /* Budget caution / Partial amber */
--warning-bg: #FBF1DF;   /* Amber pill background */
--danger:     #9E4A38;   /* Blocking error / Overdue red */
--danger-bg:  #F8EAE6;   /* Red alert background */

/* Typography */
--font-display: 'Montserrat', sans-serif;   /* Headings, KPI figures */
--font-body:    'DM Sans', sans-serif;       /* Form labels, body text */
--font-mono:    'IBM Plex Mono', monospace;  /* Tabular money figures */
```

### Key Navigation Structure
```mermaid
graph TD
    AppShell[Top Navigation Bar] --> Dashboard[Dashboard]
    AppShell --> Sales[Sales Module]
    AppShell --> Purchase[Purchase Module]
    AppShell --> Account[Account & Master Module]
    AppShell --> Reports[Reports Module]

    Sales --> SO_List[Sales Orders]
    Sales --> CI_List[Customer Invoices]
    Sales --> AR_View[Receivables Aging]

    Purchase --> PO_List[Purchase Orders]
    Purchase --> VB_List[Vendor Bills]
    Purchase --> AP_View[Payables Aging]

    Account --> COA_View[Chart of Accounts]
    Account --> Contacts_View[Contacts Master]
    Account --> Products_View[Products Master]
    Account --> Budget_View[Budgets & Analytics]
    Account --> JE_View[Journal Entries]

    Reports --> PL_Report[Profit & Loss]
    Reports --> BS_Report[Balance Sheet]
```

---

## 32. Screen-by-Screen ERP Specification

| Screen / View | Primary Purpose | Primary Inputs | System Outputs / Side Effects | Connected Modules |
|---|---|---|---|---|
| **Login Chooser** | Select dedicated portal | Click Admin vs Customer card | Sets portal context | Auth |
| **Admin Login** | Staff ERP authentication | `loginId`, `password` | Sets HttpOnly JWT cookie; navigates to `/dashboard` | Auth |
| **Customer Login** | Client portal authentication | `customerLoginId`, `password` | Sets scoped session; navigates to `/portal` | Customer Portal |
| **Dashboard** | KPI operational overview | Date filters | Sales, Purchase, and Cash position cards | Sales, Purchase, Ledger |
| **Contacts Master** | Customer & vendor registry | Name, GSTIN, type, contact details | Creates contact records; enables PO/SO selection | Purchase, Sales |
| **Product Master** | Catalog & stock registry | SKU, name, prices, tax rate | Registers inventory items; initial stock | Inventory, Sales, PO |
| **Purchase Order** | Procurement recording | Vendor, items, quantities, analytics | Computes lines; validates budget on confirm | Budget, Vendor Bills |
| **Vendor Bill** | Supplier tax claim | PO conversion, bill reference, dates | Posts balanced debit/credit entry; updates stock | Ledger, Inventory, Payables |
| **Vendor Payment**| Settle supplier dues | Method (Bank/Cash), amount | Creates installment allocation; clears A/P | Ledger, Payables, Bank |
| **Sales Order** | Customer order entry | Customer, items, quantities | Generates SO number; prepares dispatch | Invoices, Inventory |
| **Customer Invoice**| Client billing | SO conversion, tax dates | Posts revenue recognition journal entry | Ledger, Receivables |
| **Customer Payment**| Receive client money | Method (Bank/Cash), allocation | Allocates to invoice; settles A/R balance | Ledger, Receivables, Bank |
| **Journal Entries** | General ledger inspection | Manual entries or doc inspections | Immutable record with balanced line items | Accounting Engine |
| **Budget View** | Cost center allocations | Analytic account, committed amounts | Tracks planned vs actual expenditure | Analytics, PO Confirm |
| **Profit & Loss** | Operating performance | Fiscal year dropdown, Print CTA | Computes Net Income = Revenue - Expenses | General Ledger |
| **Balance Sheet** | Statement of position | Fiscal year dropdown, Print CTA | Displays Assets $\equiv$ Liabilities + Equity | General Ledger |
| **Customer Portal**| Client self-service | Invoice inspection, payment entry | Real-time invoice settlement from client side | Invoicing, Payments |

---

## 33. End-to-End Enterprise Scenario

### Scenario: Raw Material Procurement and Custom Dining Table Sale

```
                        URBAN FURNITURE OPERATIONS LIFECYCLE
════════════════════════════════════════════════════════════════════════════════
1. PROCUREMENT
   • PO P00001 created for Teakwood Traders: 3 Teak Planks @ ₹2,000 = ₹6,000.00.
   • Budget check passes: ₹6,000 committed against Timber Budget. PO Confirmed.
   • PO converted to Vendor Bill Bill/2026/0001.
   • Bill Confirmed:
       - Journal Entry JE/2026/0001 posted:
           Dr Purchase Expense: ₹6,000.00
           Cr Creditors:        ₹6,000.00
       - Inventory: +3 Teak Planks added to stock.
   • Installment 1: ₹2,000 paid via Bank. Outstanding Creditor balance: ₹4,000.
   • Installment 2: ₹4,000 paid via Bank. Outstanding Creditor balance: ₹0.00 (PAID).

2. MANUFACTURING & SALE
   • 3 Planks assembled into 1 Custom Teak Dining Table.
   • Sales Order SO/2026/0001 created for Neha Desai: 1 Dining Table @ ₹12,000.00.
   • SO Confirmed and converted to Customer Invoice Inv/2026/0001.
   • Invoice Confirmed:
       - Journal Entry JE/2026/0003 posted:
           Dr Debtors:      ₹12,000.00
           Cr Sales Income: ₹12,000.00
       - Inventory: -1 Finished Table decremented from warehouse.
   • Installment 1: Customer pays advance ₹5,000 via Bank. Remaining due: ₹7,000.
   • Installment 2: Customer settles final ₹7,000 via Cash. Remaining due: ₹0.00 (PAID).

3. FINANCIAL RESULT
   • Profit & Loss Statement:
       Operating Revenue (Sales Income):      ₹12,000.00
       Operating Expenses (Purchase Expense):   ₹6,000.00
       -------------------------------------------------
       Net Operating Profit:                    ₹6,000.00
   • Balance Sheet:
       Cash/Bank Assets: ₹6,000 (Net inflow)
       Equity / Retained Earnings: ₹6,000 (Net Profit)
       Assets (₹6,000) ≡ Liabilities (₹0) + Equity (₹6,000)
════════════════════════════════════════════════════════════════════════════════
```

---

## 34. Visual Workflow Diagram Gallery

### Diagram 1: Complete Payment Installment Lifecycle
```mermaid
stateDiagram-v2
    [*] --> Unpaid : Document Confirmed
    Unpaid --> Partial : Payment < Total Due
    Partial --> Partial : Staged Installment Recorded
    Partial --> Paid : Cumulative Payments = Total
    Unpaid --> Paid : Lump-Sum Full Payment
    Paid --> [*]
```

### Diagram 2: Purchase to Ledger Flowchart
```mermaid
flowchart LR
    PO[Purchase Order] -->|Validate Budget| PO_CONF[PO Confirmed]
    PO_CONF -->|Auto-Populate| VB[Vendor Bill]
    VB -->|Confirm| JE[Balanced Journal Entry]
    JE -->|Post| GL[General Ledger]
    VB -->|Stock Inflow| INV[Inventory Moves]
    VB -->|Staged Payments| PAY[Payments / Allocations]
    PAY -->|Post| GL
```

### Diagram 3: Sales to Ledger Flowchart
```mermaid
flowchart LR
    SO[Sales Order] -->|Confirm| SO_CONF[SO Confirmed]
    SO_CONF -->|Auto-Populate| CI[Customer Invoice]
    CI -->|Confirm| JE[Balanced Journal Entry]
    JE -->|Post| GL[General Ledger]
    CI -->|Stock Outflow| INV[Inventory Moves]
    CI -->|Staged Payments| PAY[Payments / Allocations]
    PAY -->|Post| GL
```

### Diagram 4: Budget vs Actual Analytic Verification
```mermaid
flowchart TD
    BUDGET[Approved Department Budget] --> COMMITTED[Committed Budget Line]
    PO_ATTEMPT[New Purchase Order Line] --> EVAL{Committed >= Spent + PO?}
    EVAL -->|Yes| APPROVE[Approve PO & Lock Commitment]
    EVAL -->|No| REJECT[Trigger Blocking Overrun Modal]
```

---

## 35. Live Hackathon Judging & Demo Walkthrough

Judges can verify the platform end-to-end in **under 5 minutes** following this structured sequence:

| Step | Action to Perform | What to Inspect on Screen | Technical Verification Point |
|---|---|---|---|
| **1** | Open `http://localhost:5173` | The two distinct portal chooser boxes (Admin vs Customer) | Route `/` cleanly redirects to `/login` |
| **2** | Click **Admin Portal** and enter `adminuf` / `Admin@12345` | Dashboard loads with live status counts | HttpOnly JWT session cookie set |
| **3** | Navigate to **Purchase $\to$ Orders $\to$ New** | Create PO for ₹30,000 against *Timber Procurement* | Line item calculations: $\text{Qty} \times \text{Price}$ |
| **4** | Click **Confirm** on PO | System validates budget; confirms order | Commercial intent recorded (no journal entry) |
| **5** | Click **Create Bill** | Bill is created with lines imported from PO | Foreign key `po_id` linked; no re-entry |
| **6** | Click **Confirm** on Bill | Status shifts to `confirmed`; JE number is linked | Balanced journal entry written to `journal_entries` |
| **7** | Click **Pay Bill** | Enter partial payment of ₹10,000 via Bank | Status transitions to `Partial`; remaining ₹20,000 |
| **8** | Navigate to **Sales $\to$ Orders $\to$ New** | Create SO for customer *Neha Desai* for ₹50,000 | Contact and product masters populated |
| **9** | Click **Confirm** $\to$ **Create Invoice** | Invoice generated; click **Confirm** | Revenue recognized: Dr Debtors / Cr Sales Income |
| **10**| Open `http://localhost:5173/report/profit-loss` | Net Profit updates to reflect ₹50k sales and ₹30k costs | Report computed live from `journal_entry_lines` |
| **11**| Open `http://localhost:5173/report/balance-sheet` | Assets cleanly equal Liabilities + Equity | Balanced to the paisa: $\Delta = 0.00$ |
| **12**| Open **Customer Portal** at `http://localhost:5173/login?portal=customer` | Log in as `clientuf` / `Client@12345` | Displays only Neha Desai's invoices |
| **13**| Click **Pay Now** inside Customer Portal | Record self-service balance settlement | Ledger settled live from the client portal |

---

## 36. Architectural Differentiators

1. **Inviolable Trigger Guard**: Ledger balance is protected by PostgreSQL triggers. Even direct SQL scripts cannot post an unbalanced journal entry.
2. **Zero Commercial Contamination**: Purchase and sales orders remain commercial documents, preventing false revenue recognition before fulfillment.
3. **Progressive Installment Architecture**: Native allocation records prevent data destruction when handling partial payments.
4. **Live Relational Reporting**: P&L and Balance Sheet reports query normalized ledger lines dynamically, eliminating sync delays.
5. **Dual-Surface Security**: Administrative ERP tools are separated from client-facing invoice portals, enforcing tenant privacy.
6. **No External APIs Except Razorpay**: Operates as a self-contained local stack with zero cloud AI or CDN dependencies, utilizing only the Razorpay Payment API for digital customer checkout.

---

## 37. Future Roadmap

The following enhancements represent potential roadmap extensions, intentionally separated from current functionality:

* **Local E-Way Bill & E-Invoicing Formats**: Self-contained generation of JSON structures for compliance printing without external API calls.
* **Barcode & RFID Scanning**: Hardware scanner support for tracking lumber batches and assembly dispatch.
* **Multi-Warehouse Stock Balancing**: Inter-warehouse transfer manifests across multiple factory and showroom sites.
* **Automated Bank Reconciliation**: MT940 and OFX bank statement parsing with rule-based reconciliation heuristics.
* **Multi-Currency Procurement**: Foreign exchange tracking for imported timber and specialized hardware.

---

## 38. Project Directory Topology

```
urban-furniture/
├── api/                             # Backend Service Layer
│   ├── src/
│   │   ├── db/                      # PostgreSQL connection pool
│   │   ├── middleware/              # Auth, RBAC & Scoping middleware
│   │   ├── routes/                  # REST endpoint definitions
│   │   ├── services/                # Business logic, postingService & ledger
│   │   ├── shared/                  # Shared Zod schemas & types
│   │   └── utils/                   # Exact decimal math & response helpers
│   ├── Dockerfile
│   └── package.json
│
├── client/                          # Frontend Application Layer
│   ├── src/
│   │   ├── components/              # UI widgets, warnings & smart buttons
│   │   │   ├── layout/              # AppShell, MegaMenu & Navigation
│   │   │   └── ui/                  # Money, StatusBadge, LineItemGrid
│   │   ├── pages/                   # Module route views
│   │   │   ├── sales/               # Sales Orders & Customer Invoices
│   │   │   ├── purchase/            # Purchase Orders & Vendor Bills
│   │   │   ├── master/              # Contacts, Products & Accounts
│   │   │   ├── budget/              # Budgets & Analytic Lines
│   │   │   ├── reports/             # P&L, Balance Sheet & Audit Views
│   │   │   └── portal/              # Customer Portal Surface
│   │   ├── lib/                     # Axios instance & decimal helpers
│   │   └── index.css                # Design tokens & @fontsource imports
│   ├── Dockerfile
│   └── package.json
│
├── db/                              # Relational Database Assets
│   ├── schema.sql                   # Single source of truth for DDL & triggers
│   └── seed.sql                     # Seed accounts, journals, sequences & users
│
├── docs/                            # Architectural Documentation
│   ├── requirements.md              # Functional specification checklist
│   ├── architecture_flow.md         # Request & posting sequence flows
│   └── Design.md                    # Visual tokens, palette & typography
│
├── docker-compose.yml               # Multi-container orchestration config
└── README.md                        # Master project documentation
```

---

## 39. Core Development Principles

1. **Database Authority**: `db/schema.sql` is the sole source of truth for tables, columns, and types.
2. **Backend Financial Authority**: The frontend is treated as untrusted presentation; calculations are verified by the backend.
3. **Exact Decimal Precision**: Currency values use `DECIMAL(14,2)` in PostgreSQL and `decimal.js` in Node.js, never floating-point arithmetic.
4. **Single Posting Gate**: Only `PostingService.postDocument()` writes to `journal_entries` and `journal_entry_lines`.
5. **Idempotent Confirmations**: Confirmation actions use status checks to prevent duplicate journal posting.
6. **Non-Destructive Financial History**: Financial records are archived rather than deleted to preserve audit trails.

---

## 40. Installation, Setup & Verification

### Prerequisites
* **Docker Engine** `v24+` & **Docker Compose** `v2+`
* **Node.js** `v20+` & **npm** `v10+` (for local non-docker development)
* **PostgreSQL** `v16+` (for local native development)

---

### Method A: One-Command Docker Setup (Recommended)

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/vedeshskhatri/Urban-Furniture-Accounting-System.git
   cd Urban-Furniture-Accounting-System
   ```

2. **Start the Stack**:
   ```bash
   docker compose up --build -d
   ```

3. **Initialize Database Schema & Seed Data**:
   ```bash
   docker exec -i odoofinale-db-1 psql -U postgres -d urban < db/schema.sql
   docker exec -i odoofinale-db-1 psql -U postgres -d urban < db/seed.sql
   ```

4. **Access the Portals**:
   * **Web Interface**: `http://localhost:5173`
   * **Backend REST API**: `http://localhost:5002` (or internal container `:5000`)
   * **PostgreSQL Database**: `localhost:5432` (`user: postgres`, `password: postgres`, `db: urban`)

---

### Method B: Manual Local Setup

```bash
# 1. Start PostgreSQL & initialize database
createdb urban
psql -d urban -f db/schema.sql
psql -d urban -f db/seed.sql

# 2. Configure environment
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/urban"
export JWT_SECRET="hackathon-dev-secret"
export PORT=5000

# 3. Start Backend API
cd api
npm install
npm run dev

# 4. Start Frontend Client (in a separate terminal)
cd ../client
npm install
npm run dev
```

---

### Default Login Credentials

| Role / Portal | Login ID | Plaintext Password | Access Permissions |
|---|---|---|---|
| **Admin / Executive** | `adminuf` | `Admin@12345` | Full access across all ERP modules |
| **Customer Contact** | `clientuf` | `Client@12345` | Scoped Customer Portal access for Neha Desai |

---

### Automated Ledger Balance Audit (`/api/verify`)

To verify ledger integrity, call the verification endpoint:

```bash
curl -s http://localhost:5002/api/verify | jq .
```

#### Expected Output
```json
{
  "data": {
    "totalDebits": "2480500.00",
    "totalCredits": "2480500.00",
    "delta": "0.00",
    "balanced": true,
    "totalJournalEntries": 42
  },
  "error": null
}
```

> [!TIP]
> **Audit Confirmation**: When `delta === "0.00"` and `balanced === true`, the General Ledger is verified as mathematically sound.

---

## 41. Conclusion

**Urban Furniture ERP** balances accounting rigor with an approachable, showroom-ready user experience. By enforcing double-entry invariants at the database layer, decoupling commercial orders from financial entries, and supporting staged installment workflows, it addresses the core operational challenges faced by furniture businesses.

Built with clean architecture, strict TypeScript types, and a self-contained local stack with only Razorpay Payment API integration, it provides an enterprise-ready foundation for the **Odoo India Hackathon 2026 Finale**.
