# Urban Furniture — Accounting & Management ERP

> **Odoo India Hackathon 2026 Finale — Grand Finale Submission**  
> An integrated, showroom-grade Enterprise Resource Planning (ERP) platform and double-entry accounting engine engineered for furniture manufacturing and retail enterprises. Completely self-contained, offline-first, and strictly balanced down to the paisa.

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)]()
[![Database](https://img.shields.io/badge/PostgreSQL-16--Alpine-blue.svg)]()
[![Frontend](https://img.shields.io/badge/React-18%20%7C%20TailwindCSS-38bdf8.svg)]()
[![Backend](https://img.shields.io/badge/Node.js-Express%20REST-green.svg)]()
[![Accounting](https://img.shields.io/badge/Double--Entry-Strict%20Enforcement-gold.svg)]()
[![3D Graphics](https://img.shields.io/badge/Three.js-WebGL%203D%20Studio-orange.svg)]()
[![AI Copilot](https://img.shields.io/badge/AI-Ollama%20CFO%20%26%20Voice--to--Bill-purple.svg)]()
[![GST Compliance](https://img.shields.io/badge/GST-E--Invoice%20%7C%20E--Way%20%7C%20Returns-red.svg)]()
[![License](https://img.shields.io/badge/license-MIT-blueviolet.svg)]()

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
            Users[Staff Users: Admin, Accountant, Sales, Warehouse<br/>Client Portal Users: Customers & Interior Designers]
        end

        subgraph GatewayCluster [Frontend Client Tier - Port 5173 / 80]
            Gateway[React 18 Single Page App<br/>TailwindCSS & Showroom Design Tokens<br/>Dual Portal: Admin ERP & Client Portal<br/>3D Room Studio Three.js & R3F]
        end

        subgraph AppCluster [Application Core - Docker Port 5002]
            WebApp[Express REST API Server Node.js 20<br/>Double-Entry Posting Engine<br/>Pre-Commitment Budget Engine<br/>Data Scoping & RBAC Gateway]
            AICFO[AI CFO Copilot Engine<br/>Local Ollama qwen2.5:7b Context<br/>Real-Time Ledger Anomaly Analyzer]
            VoiceBill[Voice-to-Bill Transcription<br/>Whisper Audio & NLP Entity Parser<br/>Conversational Sales Billing]
            GSTEngine[Indian GST Compliance Engine<br/>64-Char SHA-256 IRN & NIC QR<br/>E-Way Bill & GSTR-1/3B/2B Ledgers]
        end

        subgraph PaymentCluster [Payment Gateway]
            Razorpay[Razorpay Payment Gateway<br/>Online UPI, Cards & NetBanking Modal<br/>HMAC-SHA256 Signatures]
        end

        subgraph StorageCluster [Storage Layer - Docker Port 5432]
            direction TB
            PostgresDB[(PostgreSQL 16 DB<br/>General Ledger: journal_entries & lines<br/>Commercial: PO, SO, Bills, Invoices<br/>Analytic Budgets, Stock Moves & Audit<br/>Trigger: check_entry_balanced)]
            IndexedDB[(Client-Side IndexedDB<br/>Custom .glb 3D Furniture Models<br/>Persisted Room Layout Coordinates)]
        end

        subgraph DeliveryCluster [PDF and Email Delivery Pipeline]
            direction TB
            PdfEngine[Puppeteer Chromium<br/>Deterministic A4 Signed PDF Receipts<br/>B2B Tax Invoices with NIC QR Seal]
            EmailService[Resend Transactional Email API<br/>Dispatches PDF to Client Inbox]
        end

        subgraph ObservabilityCluster [Audit and Invariant Verification]
            direction LR
            Verifier[Zero-Delta Verifier<br/>GET /api/verify<br/>Total Dr ≡ Total Cr = 0.00]
            AuditChatter[Enterprise Chatter & Audit Trail<br/>Document Mutation Diff Stream<br/>Team Collaboration Notes]
            HealthProbes[Health Probes<br/>GET /api/health<br/>Container Readiness]
        end

        Users <-->|HTTP/2 / HTTPS| Gateway
        Gateway <-->|JSON REST over HTTP| WebApp
        Gateway <-->|Offline Fast Caching| IndexedDB

        WebApp <--> AICFO
        WebApp <--> VoiceBill
        WebApp <--> GSTEngine

        Razorpay -->|Order Token & HMAC Verification| WebApp

        WebApp <-->|pg / SQL Connection Pool| PostgresDB
        WebApp -->|Render Document Event| PdfEngine
        PdfEngine -->|A4 PDF Binary Stream| EmailService
        EmailService -.->|Email Receipt Delivery| Users

        WebApp -.->|Invariant Check| Verifier
        WebApp -.->|Activity Stream| AuditChatter
        WebApp -.->|Readiness Check| HealthProbes
    end
```

</details>

### Architecture Subsystems at a Glance

| Subsystem | Key Components | Protocols & Ports | Role in Urban Furniture ERP |
| :--- | :--- | :--- | :--- |
| **Actors / Users** | Staff (Admin, Accountant, Sales, Warehouse) & Customer Portal Clients | Browser / HTTPS | Operational ERP enterprise management and external customer self-service showroom & billing. |
| **Frontend Client** | React 18, Vite Bundler, TailwindCSS, Three.js 3D Studio, IndexedDB | `HTTP/2` (`:5173`, `:80`) | Responsive user interface, interactive 3D spatial room configurator, double-entry modals, budget warning banners. |
| **Core Web App & API** | Node.js 20, Express 5, TypeScript, Zod, Decimal.js | `HTTP/1.1 REST` (`:5000` / `:5002`) | Commercial workflows, double-entry posting engine, pre-commitment budget checks, and data scoping. |
| **AI CFO Copilot** | Local Ollama (`qwen2.5:7b`), Snapshot Aggregator, Heuristic Analyzer | Internal REST (`/api/cfo-copilot`) | Real-time financial advisory, runway forecasting, overdue debt risk analysis, and executive decision checklists. |
| **Conversational Voice Billing** | Whisper Speech Transcription, NLP Entity Parser, Draft Session Grid | Internal REST (`/api/voice-bill`) | Voice-to-Invoice generation, spoken product SKU & customer matching, conversational billing. |
| **Indian GST Compliance** | SHA-256 IRN Hasher, NIC SVG QR Seal, E-Way Bill Tracker, Return Engine | Internal REST (`/api/gst`) | Official B2B e-invoicing, printable digital verification QR codes, E-Way bills, and GSTR-1, GSTR-3B, GSTR-2B filing ledgers. |
| **Payment Gateway** | Razorpay Payment Gateway API & Test Sandbox | HTTPS REST / Webhooks | Online checkout, card/UPI tokenization, and deterministic HMAC-SHA256 signature verification. |
| **Storage Subsystem** | PostgreSQL 16 Alpine, Local Browser IndexedDB | Postgres Wire (`:5432`), IndexedDB | Transactional ACID ledger, immutable audit trail, gapless numbering sequences, and cached 3D `.glb` assets. |
| **Email & PDF Pipeline** | Headless Chromium (Puppeteer) + Resend API (`api.resend.com`) | Native REST | Deterministic A4 payment receipt PDF generation and direct delivery to client Gmail. |
| **Observability & Chatter** | Zero-Delta Invariant Verifier, Enterprise Chatter Drawer, Health Probes | `/api/verify`, `/api/health`, `/api/audit` | Live verification of $\sum 	ext{Debit} \equiv \sum 	ext{Credit} = 0.00$ down to the paisa, team audit timeline. |

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
26. [AI CFO Copilot & Financial Anomaly Analyzer](#26-ai-cfo-copilot--financial-anomaly-analyzer)
27. [Conversational AI Voice-to-Bill Billing Engine](#27-conversational-ai-voice-to-bill-billing-engine)
28. [Indian GST & Tax Compliance Engine](#28-indian-gst--tax-compliance-engine)
29. [Interactive 3D Room Studio & Space Configurator](#29-interactive-3d-room-studio--space-configurator)
30. [Client Customer Portal, Razorpay Gateway & PDF Receipts](#30-client-customer-portal-razorpay-gateway--pdf-receipts)
31. [Accounts Receivable (A/R) Aging & Overdue Settlement Hub](#31-accounts-receivable-ar-aging--overdue-settlement-hub)
32. [Enterprise Document Chatter & Audit Activity Stream](#32-enterprise-document-chatter--audit-activity-stream)
33. [Vector Print & PDF Document Architecture](#33-vector-print--pdf-document-architecture)
34. [Database Schema & Data Architecture](#34-database-schema--data-architecture)
35. [Entity Relationship (ER) Diagram](#35-entity-relationship-er-diagram)
36. [RESTful API Architecture](#36-restful-api-architecture)
37. [Authoritative Validation Architecture](#37-authoritative-validation-architecture)
38. [Security, Privacy & Isolation Architecture](#38-security-privacy--isolation-architecture)
39. [UI/UX Design Philosophy & Visual Tokens](#39-uiux-design-philosophy--visual-tokens)
40. [Screen-by-Screen ERP Specification](#40-screen-by-screen-erp-specification)
41. [End-to-End Enterprise Scenario](#41-end-to-end-enterprise-scenario)
42. [Visual Workflow Diagram Gallery](#42-visual-workflow-diagram-gallery)
43. [Live Hackathon Judging & Demo Walkthrough](#43-live-hackathon-judging--demo-walkthrough)
44. [Architectural Differentiators](#44-architectural-differentiators)
45. [Future Roadmap](#45-future-roadmap)
46. [Project Directory Topology](#46-project-directory-topology)
47. [Core Development Principles](#47-core-development-principles)
48. [Installation, Setup & Verification](#48-installation-setup--verification)
49. [Conclusion](#49-conclusion)

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

Urban Furniture ERP couples enterprise accounting rigor with next-generation spatial computing and artificial intelligence:

### A. Admin Portal Innovations
* **Strict Double-Entry General Ledger**: Mathematical invariant $\sum 	ext{Debit} \equiv \sum 	ext{Credit} = 0.00$ enforced at the software layer and guarded by PostgreSQL triggers. No unbalanced entry can be committed.
* **AI CFO Copilot & Financial Anomaly Analyzer**: Real-time executive financial advisor powered by local Ollama (`qwen2.5:7b`) with deterministic heuristics fallback. Answers questions on liquidity runway, working capital health, top overdue accounts, budget burn rates, and executive decision checklists.
* **Conversational Voice-to-Bill Billing Engine**: Speak or type natural language invoices (e.g., *"Sell 2 Teak Dining Tables and 6 Walnut Chairs to Neha Desai with a 10% discount"*). Transcribed via Whisper, parsed into structured items, catalog-matched, and confirmed with automatic double-entry posting.
* **Complete Indian GST Compliance Suite**: Built-in 64-character SHA-256 IRN generation for B2B e-invoicing, printable digital NIC QR verification seal, automated E-Way Bill generation for consignments $\ge 	ext{₹}50,000$, and tax return filing ledgers (GSTR-1, GSTR-3B, GSTR-2B inward ITC reconciliation).
* **Accounts Receivable Aging & Overdue Settlement Hub**: Real-time overdue alert banner with expandable bills schedule, 1-click `[Settle Due]` actions, aging bucket schedules (Current, 1-30, 31-60, 61-90, 90+ days), and `Decimal.js` FIFO payment allocations.
* **Pre-Commitment Analytic Budget Enforcement**: Evaluates department budgets before Purchase Orders can be confirmed, presenting non-blocking warning banners at 80% and blocking overruns.
* **Enterprise Document Chatter & Audit Diff Stream**: Slide-out collaboration drawer on commercial documents tracking timestamps, role-badged internal notes, and field-level mutation diffs with CSV export.
* **Professional Vector Print & PDF Reporting Engine**: Tailored `@media print` stylesheets and PDF export for B2B Tax Invoices, Purchase Orders, Vendor Bills, Customer Statements, and General Ledger reports.

### B. Client Customer Portal Innovations
* **Interactive 3D Room Studio & Space Configurator**: Real-time 3D spatial room planner powered by Three.js & React Three Fiber across 4 room archetypes (Executive Office, Luxury Living Room, Modern Bedroom, Modular Kitchen).
* **Custom `.glb` 3D Model Import with IndexedDB Persistence**: Upload custom 3D furniture models from disk. Uploaded models and custom room coordinates are cached in browser IndexedDB, persisting across visits with zero cloud latency.
* **360-Degree Orbital 3D Product Viewer**: Dedicated interactive 3D inspection screen for catalog products with studio lighting, wireframe mode, and dimension inspection.
* **Curated Showroom Product Catalogue**: High-resolution furniture catalog with real-time stock levels, finish swatches, and dimension specs.
* **Integrated Razorpay Digital Payment Gateway**: Seamless client checkout modal supporting UPI (Google Pay, PhonePe, Paytm), Credit/Debit Cards, and NetBanking with HMAC-SHA256 signature verification.
* **Autogenerated PDF Payment Receipts & Resend Email Delivery**: Deterministic A4 vector PDF payment vouchers generated via Puppeteer, available for 1-click download and automatically dispatched to the customer's email via Resend API (`api.resend.com`).

---

## 6. Technology Stack

Urban Furniture ERP runs as a single, multi-container Docker Compose application:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                             CLIENT LAYER                                 │
│  React 18.3  ·  TypeScript 5.7  ·  Tailwind CSS 3.4  ·  Vite 6.1 Bundler │
│  Three.js 0.185  ·  React Three Fiber  ·  Lucide Icons  ·  IndexedDB     │
│  Self-Hosted Fonts (@fontsource Montserrat, DM Sans, IBM Plex Mono)      │
└──────────────────────────────────────────────────────────────────────────┘
                                     │
                           REST API (JSON over HTTP)
                           HttpOnly Secure Cookies
                                     │
┌──────────────────────────────────────────────────────────────────────────┐
│                             SERVER LAYER                                 │
│  Node.js v20  ·  Express.js 5  ·  TypeScript Strict  ·  Zod 3.23 Schemas │
│  Argon2id Cryptography  ·  JWT Stateless Tokens  ·  Decimal.js Math      │
│  Puppeteer 25 Headless Chromium  ·  Resend Email API  ·  Local Ollama    │
└──────────────────────────────────────────────────────────────────────────┘
                                     │
                          Parameterized SQL via pg 8.23
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
| **Language** | TypeScript | `5.7.3` / `5.9.3` | End-to-end type safety across client and server |
| **Styling** | Tailwind CSS | `3.4.17` | Utility-first design token implementation (`Design.md`) |
| **3D Graphics Engine** | Three.js & Draco WASM | `0.185.1` | High-performance WebGL 3D Room Studio and orbital product inspection |
| **Build Tooling** | Vite | `6.1.0` | Hot-module replacement and minified production bundling |
| **Backend Runtime** | Node.js | `20.x` | High-throughput asynchronous server runtime |
| **API Framework** | Express.js | `5.2.1` | REST route orchestration, parsing, and middleware |
| **Database Engine** | PostgreSQL | `16-alpine`| ACID-compliant transactional relational storage |
| **Schema Validation** | Zod | `3.23.8` / `4.5.4`| Shared schemas for runtime payload validation |
| **Precision Math** | Decimal.js | `10.6.0` | IEEE 754 floating point error prevention |
| **Password Security** | Argon2id | `0.45.1` | Memory-hard cryptographic credential hashing |
| **Document Rendering** | Puppeteer Headless | `25.10.0` | Deterministic A4 vector PDF receipt and invoice generation |
| **QR Code Engine** | QRCode (Vector SVG) | `1.5.4` | Official NIC cryptographic GST verification seals |
| **Notification Pipeline**| Resend Email REST | `api.resend.com` | Automated transactional dispatch of payment receipts to client inbox |
| **Local AI Integration**| Local Ollama & Whisper | `qwen2.5:7b` | Offline CFO Copilot financial advisory & voice speech transcription |
| **Payment Processing** | Razorpay Node SDK | `v2.9` | Online UPI, Card & NetBanking customer checkout modal |
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

## 26. AI CFO Copilot & Financial Anomaly Analyzer

Urban Furniture ERP features an embedded **AI CFO Copilot** designed to provide executive-level financial intelligence, instant ledger diagnostics, and strategic advisory directly from the PostgreSQL General Ledger.

```mermaid
flowchart TD
    subgraph DataEngine [PostgreSQL Ledger Aggregator]
        GL[(General Ledger Lines)] --> SNAP[Snapshot Aggregator]
        AGING[A/R & A/P Aging] --> SNAP
        BUDGET[Analytic Budgets] --> SNAP
        GST[GST Liability Ledger] --> SNAP
    end

    subgraph ContextEngine [Context Grounding & Prompt Builder]
        SNAP --> CONTEXT[Structured Financial Context JSON<br/>- Liquidity & Cash-to-Payable<br/>- Net Working Capital<br/>- Overdue Invoices & Days Past Due<br/>- Budget Overrun Risk<br/>- Zero-Delta Invariant Status]
    end

    subgraph LLMExecution [Dual Execution Pipeline]
        CONTEXT --> CHECK{Ollama Service Available?}
        CHECK -->|Yes| OLLAMA[Local Ollama qwen2.5:7b<br/>Temperature: 0.2]
        CHECK -->|No / Timeout| HEURISTIC[Deterministic CFO Rule Engine<br/>Exact Formulaic Diagnostics]
    end

    subgraph OutputView [Executive Frontend Drawer]
        OLLAMA --> UI[CFO Copilot Modal / Drawer<br/>- Conversational Financial Advice<br/>- Anomaly Highlighting<br/>- Executive Checklist<br/>- Direct Navigation Deep-Links]
        HEURISTIC --> UI
    end
```

### Core Capabilities of the CFO Copilot

1. **Real-Time Financial Snapshot Aggregation (`GET /api/cfo-copilot/snapshot`)**:
   * **Liquidity Analysis**: Calculates Cash on Hand, Bank balances, Total Liquid Funds, Current Payables, Current Receivables, and the critical **Cash-to-Payable Ratio** ($	ext{Cash} / 	ext{A/P}$).
   * **Net Working Capital**: Live computation of $(	ext{Liquid Assets} + 	ext{Receivables}) - 	ext{Payables}$.
   * **P&L Velocity**: Aggregates revenue, operational expenses, and net profit for the current month.
   * **Overdue Debt Exposure**: Counts overdue invoices and bills, categorizing them by aging buckets and identifying top delinquent debtors.
   * **Budget Burn Rate**: Tracks department analytic budget utilization, highlighting cost centers that have crossed 80% soft warning or 100% hard limit.
   * **Zero-Delta Ledger Health**: Inspects the General Ledger invariant to ensure zero imbalance exists.

2. **Conversational Advisory Queries (`POST /api/cfo-copilot/query`)**:
   * Executives can ask natural language questions such as:
     * *"What is our current cash runway and liquidity health?"*
     * *"Which customer invoices are overdue and pose the highest collection risk?"*
     * *"Are any timber procurement budgets at risk of overrun?"*
     * *"What is our net GST liability for this filing period?"*
   * Grounded in exact ledger figures; never hallucinates balances or transactions.

3. **Executive Action Checklist**:
   * Generates prioritized, actionable recommendations (e.g., *"Follow up with Neha Desai on invoice INV/2026/0014 (18 days overdue, ₹42,000)"*, *"Timber Procurement budget at 88% capacity; consider budget revision"*).
   * Includes one-click deep links that navigate staff directly to the relevant screen in the ERP.

---

## 27. Conversational AI Voice-to-Bill Billing Engine

To eliminate tedious manual line-item entry during busy showroom hours, Urban Furniture ERP introduces an **AI Voice-to-Bill** billing system (`/sales/voice-bill`).

```mermaid
sequenceDiagram
    autonumber
    actor SalesAgent as Sales Representative
    participant Mic as Web Audio API
    participant API as Express Voice-Bill API
    participant Whisper as Whisper Transcription
    participant NLP as Entity & Catalog Parser
    participant DB as PostgreSQL Catalog
    participant Posting as Posting Service

    SalesAgent->>Mic: Spoken Order: "Sell 2 Teak Dining Tables and 6 Walnut Chairs to Neha Desai with 10% discount"
    Mic->>API: Audio Stream / Base64 Payload
    API->>Whisper: Speech-to-Text Transcription
    Whisper-->>API: Transcribed Text String
    API->>NLP: Extract: Quantities, Product Names, Customer, Discounts
    NLP->>DB: Fuzzy SKU Match & Contact ID Lookup
    DB-->>NLP: Matched Products & Active Price List
    NLP-->>API: Structured Draft Session State
    API-->>SalesAgent: Real-Time Editable Grid on Screen
    SalesAgent->>API: Click [Confirm & Create Invoice]
    API->>Posting: Validate & Create Customer Invoice
    Posting->>DB: Balanced Double-Entry Journal Posted
    API-->>SalesAgent: Confirmed Invoice Inv/2026/XXXX Generated
```

### Key Technical Highlights of Voice Billing

1. **Dual Voice & Conversational Text Mode**:
   * Staff can dictate orders via microphone using the Web Audio API or type conversational prompts into the chat box.
2. **Audio Transcription Pipeline**:
   * Audio payloads are transcribed using local Whisper models without sending customer or pricing data to external cloud services.
3. **Fuzzy Entity Resolution**:
   * Resolves informal product names (e.g., *"Teak Dining Table"*) against the `products` table using token similarity, resolving the exact SKU, unit sales price, and default revenue account.
   * Identifies the customer contact from the `contacts` table.
4. **Interactive Draft Session**:
   * Orders are held in an in-memory draft session where staff can adjust quantities, modify unit prices, toggle discounts, or add/remove line items in an interactive table before finalizing.
5. **One-Click Invoice Confirmation**:
   * With a single click on `[Confirm & Create Invoice]`, the system calls `CustomerInvoiceService.create()` and `PostingService.postDocument()`, committing an immutable, balanced entry to the General Ledger.

---

## 28. Indian GST & Tax Compliance Engine

Urban Furniture ERP features a complete, self-contained Indian Goods & Services Tax (GST) compliance suite built directly into the ERP core (`/report/gst`).

```mermaid
flowchart LR
    subgraph Documents [Commercial Documents]
        INV[Confirmed Customer Invoices]
        BILL[Confirmed Vendor Bills]
    end

    subgraph ComplianceEngine [GST Compliance Service Layer]
        IRNGen[SHA-256 IRN Hasher<br/>Supplier GSTIN + Inv No + FY]
        QRGen[Official NIC Vector SVG QR<br/>Embedded Digital Seal]
        EWayGen[E-Way Bill Processor<br/>Auto-trigger on >= ₹50,000]
        GSTR1Gen[GSTR-1 Aggregator<br/>Table 4, 5/7, 12 HSN, 13 Docs]
        GSTR3BGen[GSTR-3B Aggregator<br/>Outward Tax, Reverse Charge, ITC Offset]
        GSTR2BGen[GSTR-2B Inward ITC Ledger<br/>Supplier Inward Reconciliation]
    end

    subgraph Outputs [Filing & Verification Views]
        IRNGen --> EInvView[B2B E-Invoice Printout]
        QRGen --> EInvView
        EWayGen --> EWayView[E-Way Bill Manifest & Expiry Tracker]
        GSTR1Gen --> GSTR1View[GSTR-1 Return Filing View]
        GSTR3BGen --> GSTR3BView[GSTR-3B Net Tax Payable View]
        GSTR2BGen --> GSTR2BView[GSTR-2B Input Tax Credit Ledger]
    end

    INV --> IRNGen
    INV --> QRGen
    INV --> EWayGen
    INV --> GSTR1Gen
    INV --> GSTR3BGen
    BILL --> GSTR2BGen
```

### Comprehensive GST Modules

#### 1. B2B E-Invoicing & Cryptographic IRN
* Computes an authoritative 64-character hexadecimal **Invoice Reference Number (IRN)** using SHA-256:
  $$	ext{IRN} = 	ext{SHA-256}(	ext{SupplierGSTIN} + 	ext{InvoiceNumber} + 	ext{FiscalYear} + 	ext{DocType})$$
* Generates an official, offline-computed **NIC Vector SVG QR Code** embedded directly on the invoice. The QR code encodes:
  * Seller GSTIN & Buyer GSTIN
  * Invoice Number & Date
  * Total Invoice Value & Total Tax Amount
  * HSN Code of primary line item
  * Digital signature token verifying document authenticity.

#### 2. E-Way Bill Generation & Consignment Tracking
* **Automatic Threshold Detection**: Commercial invoices with taxable totals $\ge 	ext{₹}50,000$ automatically flag the requirement for an E-Way Bill.
* **Consignment Metadata**: Captures Transporter ID, Transporter Name, Distance in kilometers, Vehicle Registration Number, and Transport Mode (Road/Rail/Air/Ship).
* **Validity Period Calculator**: Computes e-way bill validity based on statutory distance formulas (1 day per 200 km for normal cargo).
* **Period Filtering**: Filter e-way bills by Fiscal Year and Month for seamless audit reporting.

#### 3. GSTR-1 Outward Supplies Return
Aggregates outward furniture sales into official statutory tables:
* **Table 4**: Taxable outward supplies to registered persons (B2B).
* **Table 5 & 7**: Taxable outward supplies to unregistered persons (B2C Large & Small).
* **Table 12**: HSN-wise summary of outward supplies showing quantity, total value, taxable value, CGST, SGST, and IGST.
* **Table 13**: Document issued register (Serial numbers of invoices issued, cancelled, and net active).

#### 4. GSTR-3B Monthly Return & Net Tax Payable
* Summarizes total outward taxable value and output tax liability.
* Incorporates eligible **Input Tax Credit (ITC)** from confirmed vendor bills.
* Dynamically computes **Net Tax Payable** after deducting eligible ITC:
  $$	ext{Net Tax Payable} = 	ext{Output GST Liability} - 	ext{Eligible Input Tax Credit}$$

#### 5. GSTR-2B Inward ITC Ledger
* Reconciles inward supplier bills to calculate total available Input Tax Credit.
* Categorizes ITC by supplier GSTIN, invoice date, and raw material category (e.g., Timber, Hardware, Upholstery).

---

## 29. Interactive 3D Room Studio & Space Configurator

The **3D Room Studio** (`/portal/studio`) is a showroom-grade WebGL spatial configurator designed for homeowners and commercial interior designers to furnish rooms in real-time 3D space.

```mermaid
graph TD
    subgraph ThreeJS_Scene [Three.js / React Three Fiber Scene]
        CANVAS[WebGL Canvas Renderer]
        LIGHTS[Ambient & Directional Studio Lighting]
        ROOM[Room Archetype Boundary Meshes<br/>Floor, Walls, Baseboards]
        FURNITURE[Interactive 3D Furniture Meshes<br/>Draco Compressed GLB Models]
        CONTROLS[OrbitControls & DragControls<br/>X, Y, Z Coordinate Tracking & Rotation]
    end

    subgraph StateAndStorage [Local Persistence Tier]
        IDB[(Browser IndexedDB<br/>Persisted GLB Models & Custom Layouts)]
        STYLES[Room Style Presets<br/>Executive Office, Luxury Living, Modern Bedroom]
        CUSTOM_UPLOAD[Custom .glb File Picker]
    end

    subgraph CommerceIntegration [ERP Commerce Bridge]
        CART[1-Click Quotation / Cart Addition]
        PRICING[Live Itemized Furniture Price Calculation]
    end

    CUSTOM_UPLOAD -->|Store Blob| IDB
    IDB -->|Load Model| FURNITURE
    STYLES -->|Restore Layout| ROOM
    STYLES -->|Restore Coordinates| FURNITURE

    FURNITURE --> CONTROLS
    CONTROLS --> CANVAS
    ROOM --> CANVAS
    LIGHTS --> CANVAS

    FURNITURE --> PRICING
    PRICING --> CART
```

### Key Technical Features of the 3D Studio

1. **4 Realistic Room Archetypes**:
   * **Executive Office**: Corporate boardroom and private executive suite layouts.
   * **Luxury Living Room**: Spacious open-concept living area with hardwood floors.
   * **Modern Bedroom**: Bedroom suites with bed frames, nightstands, and dressers.
   * **Modular Kitchen & Dining**: Dining tables, ergonomic seating, and credenzas.
2. **Interactive 3D Furniture Placement**:
   * Furniture items can be dragged across the floor plane with real-time $(X, Y, Z)$ spatial coordinate feedback.
   * Dedicated rotation handles allow $360^\circ$ yaw adjustment to align furniture against walls or room centerpieces.
3. **Custom `.glb` Model Import**:
   * Users can upload custom 3D model files (`.glb`) directly from their local filesystem.
   * The model is parsed via Three.js `GLTFLoader` with Draco mesh decompression and immediately positioned within the active scene.
4. **Zero-Latency IndexedDB Persistence**:
   * Uploaded `.glb` models and room layouts are automatically stored in the browser's **IndexedDB**.
   * When the customer navigates away or returns in a new session, their customized room layout and imported models restore in `0ms` without re-uploading or cloud server dependency.
5. **"Save to Room Styles" Preset Gallery**:
   * Users can save multiple custom room configurations with descriptive names and auto-generated canvas snapshot thumbnails.
   * Clicking a saved style instantly restores furniture positions, orientations, and finish swatches.
6. **Material & Texture Customization**:
   * Interactive swatches allow live switching of wood finishes (Teak Wood, Rich Walnut, Natural White Oak) and upholstery materials (Boucle Fabric, Genuine Brown Leather, Carrera Marble).
7. **One-Click Quotation & Cart Addition**:
   * Users can click `[Add Room Items to Cart]`, which aggregates every furniture piece placed in the 3D scene, retrieves live master data pricing, and creates a commercial quotation.
8. **360-Degree Orbital Product Viewer (`/portal/viewer/:id`)**:
   * Dedicated standalone product viewer featuring orbital camera controls, studio shadows, wireframe mode, and dimension annotations.

---

## 30. Client Customer Portal, Razorpay Gateway & PDF Receipts

The **Customer Portal** (`/portal`) provides furniture clients with a secure, self-service digital experience for reviewing orders, inspecting B2B tax invoices, making online payments, and downloading receipts.

```mermaid
sequenceDiagram
    autonumber
    actor Client as Customer (Neha Desai)
    participant Portal as Customer Portal UI
    participant API as Express Portal API
    participant Razorpay as Razorpay Gateway
    participant PDF as Puppeteer Engine
    participant Resend as Resend Email API
    participant DB as PostgreSQL Ledger

    Client->>Portal: Login with client credentials (clientuf)
    Portal->>API: POST /api/portal/login
    API-->>Portal: Scoped Session Cookie (WHERE customer_id = user.contact_id)
    Client->>Portal: Inspect Open Invoice Inv/2026/0014 (₹42,000)
    Client->>Portal: Click [Pay Now via Razorpay]
    Portal->>API: POST /api/portal/payments/create-order
    API->>Razorpay: Create Payment Order (Amount in Paise)
    Razorpay-->>API: order_id & Transaction Token
    API-->>Portal: Return Razorpay Order Configuration
    Portal->>Client: Open Razorpay Checkout Modal (UPI, Cards, NetBanking)
    Client->>Razorpay: Authorize Payment (₹42,000 via UPI)
    Razorpay-->>Portal: Success Payload (payment_id, order_id, signature)
    Portal->>API: POST /api/portal/payments/verify
    API->>API: Verify HMAC-SHA256 Signature
    API->>DB: Record Payment & Create Balanced Journal Entry
    API->>PDF: Generate Signed A4 Payment Voucher PDF
    PDF-->>API: Binary PDF Buffer
    API->>Resend: POST api.resend.com/emails with PDF Attachment
    Resend-->>Client: Deliver Receipt to Client Gmail Inbox
    API-->>Portal: Payment Verified & Instant Download URL
    Portal-->>Client: Show Payment Success Badge & [Download Receipt PDF]
```

### Technical Highlights of Customer Portal & Payments

1. **Strict Data Isolation (`scopeFor(user, resource)`)**:
   * Customer sessions are strictly scoped to their `contact_id`. Attempting to access an invoice, bill, or journal entry belonging to another customer returns an HTTP `403 Forbidden` error.
2. **Razorpay Checkout Modal**:
   * Embeds the official Razorpay checkout modal supporting UPI QR, Google Pay, PhonePe, credit/debit cards, and major Indian net banking portals.
   * Supports both full settlement and partial installment payments.
3. **Deterministic HMAC-SHA256 Verification**:
   * The backend validates the cryptographic signature returned by Razorpay:
     $$	ext{Signature} \equiv 	ext{HMAC-SHA256}(	ext{order\_id} + "|" + 	ext{payment\_id}, 	ext{RAZORPAY\_SECRET})$$
   * Prevents fraudulent payment injections before any journal entry is posted.
4. **Deterministic A4 PDF Payment Vouchers**:
   * Uses Puppeteer to render a high-fidelity, printable A4 payment receipt complete with company details, GSTIN, payment method, allocated invoice numbers, transaction ID, and digital signature seal.
5. **Automated Transactional Email Delivery (Resend API)**:
   * When an online payment is confirmed, the system immediately dispatches an email via the Resend API (`api.resend.com`) with the signed receipt attached as a PDF directly to the client's email address.

---

## 31. Accounts Receivable (A/R) Aging & Overdue Settlement Hub

Managing customer credit terms and overdue bills is central to furniture manufacturing cash flow. Urban Furniture ERP provides a dedicated **Accounts Receivable Hub** (`/sales/receivables`).

```mermaid
flowchart TD
    INV[(Open Customer Invoices)] --> AGING[Aging Classification Engine]
    AGING --> B0[Current: 0-30 Days Past Due]
    AGING --> B1[Bucket 1: 31-60 Days Past Due]
    AGING --> B2[Bucket 2: 61-90 Days Past Due]
    AGING --> B3[Bucket 3: 90+ Days Past Due]

    AGING --> ALERT{Any Overdue Invoices?}
    ALERT -->|Yes| BANNER[Collapsible Overdue Alert Banner<br/>Total Overdue Amount & Invoice Count]
    BANNER --> OVERDUE_GRID[Overdue Invoices Table<br/>Customer, Invoice Date, Due Date, Days Past Due]
    OVERDUE_GRID --> SETTLE_BTN[1-Click Settle Due Button]

    SETTLE_BTN --> REG_PAY[Register Payment Screen<br/>Auto-populates Customer & Due Amount]
    REG_PAY --> FIFO[Decimal.js Strict FIFO Allocation<br/>Oldest Overdue Invoices Settled First]
    FIFO --> POST_PAY[Post Payment to General Ledger]
    POST_PAY --> RETURN[Auto-Return to Receivables Hub]
```

### Highlights of the Receivables Engine

1. **Collapsible Overdue Alert Banner**:
   * Automatically detects and tallies all customer invoices past their `due_date`.
   * Displays an alert banner with the total overdue sum and an expandable interactive table listing invoice numbers, customer names, due dates, and exact days past due.
2. **Multi-Bucket Aging Schedule**:
   * Classifies outstanding balances into standard accounting aging buckets: **Current (0-30 days)**, **31-60 days**, **61-90 days**, and **90+ days**.
   * Provides quick filtering and customer-by-customer balance drilldowns.
3. **Seamless Navigation & One-Click Return**:
   * Includes a prominent `[← Back to Bills to be Settled (Customer Summary)]` button so accountants can seamlessly transition between detailed aging schedules and customer summary cards.
4. **Exact Decimal FIFO Settlement**:
   * Utilizes `Decimal.js` across payment allocation calculations, eliminating floating-point pennies drift.
   * Features a `[Settle All Open Invoices]` action that sorts open invoices by `dueDate ASC` and allocates payments strictly against the oldest overdue invoices first.
5. **Instant Cache Invalidation**:
   * Upon payment confirmation, the client cache is immediately refreshed, updating receivables totals, customer balances, and aging charts with zero stale data.

---

## 32. Enterprise Document Chatter & Audit Activity Stream

Urban Furniture ERP includes an enterprise **Chatter & Activity Stream** drawer embedded across all primary transaction documents (Sales Orders, Invoices, Purchase Orders, Vendor Bills).

```mermaid
flowchart LR
    DOC[Document: Invoice / Bill / Order] --> CHATTER_TRIGGER[Click Chatter Icon / Activity Tab]
    CHATTER_TRIGGER --> DRAWER[Slide-Out Activity Drawer]

    subgraph DrawerFeatures [Chatter Capabilities]
        TIMELINE[Chronological Audit Timeline<br/>Status Transitions & Confirmations]
        DIFFS[Field-Level Mutation Diffs<br/>Before and After Value Inspection]
        NOTES[Team Collaboration Notes<br/>Internal Staff Comments]
        BADGES[Role Badges<br/>Admin, Accountant, Sales]
        EXPORT[1-Click CSV Export of Audit Trail]
    end

    DRAWER --> TIMELINE
    DRAWER --> DIFFS
    DRAWER --> NOTES
    DRAWER --> BADGES
    DRAWER --> EXPORT
```

### Technical Highlights of Document Chatter

1. **Immutable Mutation Tracking**:
   * Every document update, confirmation, or status change automatically writes an audit record to the `audit_log` table with user ID, timestamp, and action metadata.
2. **Field-Level Diff Inspection**:
   * Displays exact before-and-after diffs for modified fields (e.g., status changes from `draft` to `confirmed`, or price adjustments).
3. **Internal Team Collaboration Notes**:
   * Staff can post internal commentary directly on documents (e.g., *"Customer requested delivery delay until Friday"*, *"Approved by Senior Accountant"*).
   * Author comments are visually branded with role badges (`Admin`, `Accountant`, `Sales`).
4. **Searchable Audit Feed & CSV Export**:
   * The enterprise audit trail supports full-text search, action filtering (Creation, Modification, Confirmation, Deletion), and one-click export to CSV for external auditors.

---

## 33. Vector Print & PDF Document Architecture

All commercial and financial documents in Urban Furniture ERP are equipped with professional vector print stylesheets (`@media print`) and PDF export engines adhering to `docs/Design.md`.

### Printable Documents

| Document | Key Print Elements | Standard Compliance |
|---|---|---|
| **B2B Tax Invoice** | Company Header, GSTIN, Customer GSTIN, HSN Summary, Tax Breakdown (CGST/SGST/IGST), **NIC Vector QR Seal**, Bank Details | Official Indian GST E-Invoice Standard |
| **Purchase Order** | Vendor Address, Delivery Address, Itemized Specifications, Analytic Account Tags, Terms & Conditions | Commercial Procurement Standard |
| **Vendor Bill** | Supplier Bill Reference, Matched PO Number, Payment Terms, Due Date, Tax Lines | Accounts Payable Audit Standard |
| **Payment Receipt** | Receipt Number, Payment Method, Transaction Reference, Invoices Settled, Signature Seal | General Ledger Cash Voucher Standard |
| **Customer Statement** | Account Summary, Opening Balance, Invoices Issued, Payments Received, Aging Analysis | Client Account Reconciliation |
| **P&L & Balance Sheet** | Categorized General Ledger Balances, Metric Summaries, Date Ranges | GAAP / Ind AS Financial Reporting |

---

## 34. Database Schema & Data Architecture

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

## 35. Entity Relationship (ER) Diagram

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

## 36. RESTful API Architecture

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
| `/api/cfo-copilot/snapshot` | `GET` | Aggregates real-time financial ledger snapshot | Internal Staff |
| `/api/cfo-copilot/query` | `POST` | Executes AI CFO copilot query with local Ollama | Internal Staff |
| `/api/voice-bill/message` | `POST` | Processes natural language sales order prompt | Internal Staff |
| `/api/voice-bill/confirm` | `POST` | Finalizes voice session draft into Customer Invoice | Internal Staff |
| `/api/gst/invoice/:id` | `GET` | Computes B2B e-Invoice metadata, IRN hash & QR | Internal Staff |
| `/api/gst/invoice/:id/qr-svg`| `GET`| Renders official vector SVG QR seal | Internal Staff |
| `/api/gst/gstr-1` | `GET` | Aggregates GSTR-1 outward return summary | Internal Staff |
| `/api/gst/gstr-3b` | `GET` | Aggregates GSTR-3B monthly return and net tax | Internal Staff |
| `/api/gst/gstr-2b` | `GET` | Reconciles inward bills into eligible ITC ledger | Internal Staff |
| `/api/gst/eway-bills` | `GET` | Lists consignments exceeding ₹50,000 threshold | Internal Staff |
| `/api/portal/payments/create-order`| `POST`| Creates Razorpay checkout order | Portal Contact |
| `/api/portal/payments/verify`| `POST`| Verifies Razorpay HMAC signature & posts payment | Portal Contact |
| `/api/receivables` | `GET` | Returns A/R aging schedule and overdue invoices | Internal Staff |
| `/api/audit/timeline` | `GET` | Fetches document mutation history and chatter | Internal Staff |


---

## 37. Authoritative Validation Architecture

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

## 38. Security, Privacy & Isolation Architecture

* **Stateless JWT in HttpOnly Cookies**: Session tokens are signed via cryptographic secrets and transmitted inside `HttpOnly`, `SameSite=Lax` cookies, neutralizing Cross-Site Scripting (XSS) token exfiltration.
* **Argon2id Password Hashing**: Passwords are hashed with memory-hard Argon2id parameters (`m=65536, t=3, p=4`), offering protection against GPU-based rainbow table attacks.
* **SQL Injection Immunity**: Zero dynamic string concatenation. All PostgreSQL interactions use parameterized queries with numeric variables (`$1, $2, $3`).
* **Tenant Scoping & IDOR Defense**: The Customer Portal isolates clients at the query layer. Invoices and payment routes enforce `WHERE customer_id = user.contact_id`.
* **Strict API Isolation (Razorpay Only)**: Zero third-party tracking scripts, cloud AI models, or external CDNs. The **Razorpay Payment Gateway API** is the sole external API integrated across the system, strictly isolated to customer digital payment checkout.

---

## 39. UI/UX Design Philosophy & Visual Tokens

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

## 40. Screen-by-Screen ERP Specification

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
| **Voice-to-Bill Studio** | `/sales/voice-bill` | Natural language conversational sales invoice generation with Whisper transcription. | Sales, Admin |
| **GST Return Centre** | `/report/gst` | GSTR-1, GSTR-3B, GSTR-2B filing ledgers and E-Way Bill consignment tracking. | Accountant, Admin |
| **Receivables & Aging Hub** | `/sales/receivables` | Overdue invoice alerts, aging bucket tables, and one-click FIFO payment settlement. | Accountant, Admin |
| **Customer Portal Home** | `/portal` | Scoped client dashboard showing outstanding dues, recent orders, and invoice links. | Customer Contact |
| **3D Room Studio** | `/portal/studio` | Interactive 3D room configurator with .glb model upload, drag-and-drop, and cart add. | Customer Contact, Public |
| **3D Product Viewer** | `/portal/viewer/:id` | 360-degree orbital 3D model inspector with lighting controls and dimensions. | Customer Contact, Public |
| **Showroom Catalogue** | `/portal/catalogue` | Curated product catalog with finish swatches, specifications, and real-time stock. | Customer Contact, Public |
| **Portal Invoice Detail** | `/portal/invoices/:id` | Invoice inspection with Razorpay online checkout and instant signed PDF receipt download. | Customer Contact |


---

## 41. End-to-End Enterprise Scenario

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

## 42. Visual Workflow Diagram Gallery

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

## 43. Live Hackathon Judging & Demo Walkthrough

Judges can verify the platform end-to-end in **under 5 minutes** following this structured sequence:

| Step | Action to Perform | What to Inspect on Screen | Technical Verification Point |
|---|---|---|---|
| **1** | Open `http://localhost:5173` | Portal chooser (Admin ERP vs Customer Portal) | Route `/` cleanly redirects to `/login` |
| **2** | Click **Admin Portal** and enter `adminuf` / `Admin@12345` | Dashboard loads with live status counts & working capital | HttpOnly JWT session cookie set; working capital dynamically computed |
| **3** | Click the **AI CFO Copilot** icon in top navigation | Ask: *"What is our liquidity runway and overdue debt risk?"* | Live snapshot context queried from Postgres; response generated via Ollama |
| **4** | Navigate to **Sales $	o$ Voice Billing** (`/sales/voice-bill`) | Speak or type: *"Sell 2 Teak Dining Tables to Neha Desai with 10% discount"* | NLP resolves product SKU, customer contact ID, discount; click **Confirm** to generate invoice |
| **5** | Navigate to **Reports $	o$ GST Returns** (`/report/gst`) | Inspect GSTR-1, GSTR-3B and E-Way Bills | B2B e-invoice with 64-char SHA-256 IRN and printable NIC QR seal rendered |
| **6** | Navigate to **Sales $	o$ Receivables** (`/sales/receivables`) | Inspect the **Overdue Invoices Alert Banner** | Expand overdue invoices; click **[Settle Due]** to test FIFO `Decimal.js` allocation |
| **7** | Open **Customer Portal** at `http://localhost:5173/portal` | Log in as `clientuf` / `Client@12345` | Tenant-scoped dashboard displays only Neha Desai's records |
| **8** | Open **3D Room Studio** (`/portal/studio`) | Drag furniture into scene; test custom `.glb` upload | Three.js WebGL canvas renders room; coordinates persist to IndexedDB |
| **9** | Open Customer Invoice and click **Pay Now** | Test Razorpay Checkout modal | HMAC-SHA256 signature verified; instant signed PDF receipt downloaded & emailed via Resend |
| **10**| Open `http://localhost:5173/report/profit-loss` & `balance-sheet` | Review P&L and Balance Sheet statements | Total Debit $\equiv$ Total Credit; zero discrepancy $\Delta = 0.00$ |

---

## 44. Architectural Differentiators

1. **Inviolable Trigger Guard**: Ledger balance is protected by PostgreSQL triggers. Even direct SQL scripts cannot post an unbalanced journal entry.
2. **Zero Commercial Contamination**: Purchase and sales orders remain commercial documents, preventing false revenue recognition before fulfillment.
3. **Progressive Installment Architecture**: Native allocation records prevent data destruction when handling partial payments.
4. **Live Relational Reporting**: P&L and Balance Sheet reports query normalized ledger lines dynamically, eliminating sync delays.
5. **Dual-Surface Security**: Administrative ERP tools are separated from client-facing invoice portals, enforcing tenant privacy.
6. **No External APIs Except Razorpay**: Operates as a self-contained local stack with zero cloud AI or CDN dependencies, utilizing only the Razorpay Payment API for digital customer checkout.

---

## 45. Future Roadmap

The following enhancements represent potential roadmap extensions, intentionally separated from current functionality:

* **Local E-Way Bill & E-Invoicing Formats**: Self-contained generation of JSON structures for compliance printing without external API calls.
* **Barcode & RFID Scanning**: Hardware scanner support for tracking lumber batches and assembly dispatch.
* **Multi-Warehouse Stock Balancing**: Inter-warehouse transfer manifests across multiple factory and showroom sites.
* **Automated Bank Reconciliation**: MT940 and OFX bank statement parsing with rule-based reconciliation heuristics.
* **Multi-Currency Procurement**: Foreign exchange tracking for imported timber and specialized hardware.

---

## 46. Project Directory Topology

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

## 47. Core Development Principles

1. **Database Authority**: `db/schema.sql` is the sole source of truth for tables, columns, and types.
2. **Backend Financial Authority**: The frontend is treated as untrusted presentation; calculations are verified by the backend.
3. **Exact Decimal Precision**: Currency values use `DECIMAL(14,2)` in PostgreSQL and `decimal.js` in Node.js, never floating-point arithmetic.
4. **Single Posting Gate**: Only `PostingService.postDocument()` writes to `journal_entries` and `journal_entry_lines`.
5. **Idempotent Confirmations**: Confirmation actions use status checks to prevent duplicate journal posting.
6. **Non-Destructive Financial History**: Financial records are archived rather than deleted to preserve audit trails.

---

## 48. Installation, Setup & Verification

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

## 49. Conclusion

**Urban Furniture ERP** balances accounting rigor with an approachable, showroom-ready user experience. By enforcing double-entry invariants at the database layer, decoupling commercial orders from financial entries, and supporting staged installment workflows, it addresses the core operational challenges faced by furniture businesses.

Built with clean architecture, strict TypeScript types, and a self-contained local stack with only Razorpay Payment API integration, it provides an enterprise-ready foundation for the **Odoo India Hackathon 2026 Finale**.
