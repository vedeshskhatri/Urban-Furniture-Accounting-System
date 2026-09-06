-- Urban Furniture Accounting System — schema.sql
-- Authority: this file is the only truth about tables, columns, types (AGENTS.md #1).
-- Owner: Vedesh. Do not modify without approval; see docs/schema.md for the reasoning.
--
-- AMBIGUITY FLAGGED (not silently resolved — see docs/requirements.md §D):
-- The seed spec (AGENT_vedesh.md Phase 1) says "8 accounts ONLY". The posting
-- rules (docs/schema.md) require tax to post to its own account, never to
-- Sales Income / Purchase Expense (a stated correctness trap in requirements.md §C).
-- Those two instructions conflict. Resolution taken here: two extra accounts,
-- "Input Tax Credit" (asset) and "Output Tax Payable" (liability), are seeded
-- in db/seed.sql alongside the 8. They still fit inside the 8 documented
-- account TYPES, so no new account type was invented — just two more rows.

-- ============================================================
-- Extensions
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- Master data
-- ============================================================

CREATE TABLE contacts (
  id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('customer', 'vendor', 'both')),
  email         TEXT,
  mobile        TEXT,
  address       TEXT,
  city          TEXT,
  state         TEXT,
  pincode       TEXT,
  image_path    TEXT,
  gstin         TEXT,
  is_archived   BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE products (
  id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sku           TEXT UNIQUE,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('goods', 'service', 'combo')),
  category      TEXT,
  sales_price   DECIMAL(14,2) NOT NULL DEFAULT 0,
  cost_price    DECIMAL(14,2) NOT NULL DEFAULT 0,
  mrp           DECIMAL(14,2),
  tax_rate      DECIMAL(5,2) NOT NULL DEFAULT 0,
  stock_qty     DECIMAL(12,2) NOT NULL DEFAULT 0, -- cache only; v_stock_on_hand is the truth
  model_url     TEXT,
  image_url     TEXT,
  lead_time_days INT NOT NULL DEFAULT 14,
  safety_stock  DECIMAL(14,3) NOT NULL DEFAULT 0,
  is_archived   BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE accounts (
  id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL CHECK (type IN
                  ('asset', 'liability', 'bank', 'capital', 'cash',
                   'income', 'expense', 'other_expense')),
  is_archived   BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE journals (
  id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name                TEXT NOT NULL,
  type                TEXT NOT NULL CHECK (type IN ('sales', 'purchase', 'bank', 'cash')),
  default_account_id  INTEGER NOT NULL REFERENCES accounts(id),
  is_archived         BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE analytic_accounts (
  id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  is_archived   BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- role scoping: scopeFor(user, resource) reads this table. contact_id is set
-- only for role='contact' and is what { customerId: user.contactId } resolves to.
CREATE TABLE users (
  id                      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  login_id                TEXT UNIQUE NOT NULL CHECK (char_length(login_id) BETWEEN 6 AND 12),
  email                   TEXT UNIQUE NOT NULL,
  full_name               TEXT NOT NULL,
  password_hash           TEXT, -- nullable: a contact user has none until their invite token is redeemed
  role                    TEXT NOT NULL CHECK (role IN ('admin', 'accountant', 'manager', 'contact')),
  contact_id              INTEGER REFERENCES contacts(id),
  invite_token            TEXT UNIQUE,
  invite_token_expires_at TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (role <> 'contact' OR contact_id IS NOT NULL)
);

-- ============================================================
-- Sequences (gapless document numbering)
-- ============================================================

CREATE TABLE doc_sequences (
  code            TEXT PRIMARY KEY,
  prefix          TEXT NOT NULL,
  use_year        BOOLEAN NOT NULL DEFAULT true,
  padding         INTEGER NOT NULL DEFAULT 4,
  current_number  INTEGER NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION next_doc_number(p_code TEXT) RETURNS TEXT AS $$
DECLARE
  v_prefix   TEXT;
  v_use_year BOOLEAN;
  v_padding  INTEGER;
  v_next     INTEGER;
BEGIN
  SELECT prefix, use_year, padding, current_number + 1
    INTO v_prefix, v_use_year, v_padding, v_next
    FROM doc_sequences
    WHERE code = p_code
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown document sequence code: %', p_code;
  END IF;

  UPDATE doc_sequences SET current_number = v_next WHERE code = p_code;

  IF v_use_year THEN
    RETURN v_prefix || '/' || to_char(now(), 'YYYY') || '/' || lpad(v_next::TEXT, v_padding, '0');
  ELSE
    RETURN v_prefix || lpad(v_next::TEXT, v_padding, '0');
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Ledger — the only source of financial truth
-- ============================================================

CREATE TABLE journal_entries (
  id             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  number         TEXT NOT NULL UNIQUE,
  journal_id     INTEGER NOT NULL REFERENCES journals(id),
  entry_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  reference      TEXT,
  status         TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted')),
  source_type    TEXT CHECK (source_type IN ('bill', 'invoice', 'payment')), -- NULL = manual entry, must still hit the P&L
  source_id      INTEGER, -- polymorphic; no FK (type varies with source_type)
  reversal_of    INTEGER REFERENCES journal_entries(id),
  created_by     INTEGER REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE journal_entry_lines (
  id                    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entry_id              INTEGER NOT NULL REFERENCES journal_entries(id),
  account_id            INTEGER NOT NULL REFERENCES accounts(id),
  partner_id            INTEGER REFERENCES contacts(id), -- partner lives on the LINE, not the entry
  analytic_account_id   INTEGER REFERENCES analytic_accounts(id),
  debit                 DECIMAL(14,2) NOT NULL DEFAULT 0,
  credit                DECIMAL(14,2) NOT NULL DEFAULT 0,
  description           TEXT,
  CHECK ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0))
);

CREATE INDEX idx_jel_entry_id ON journal_entry_lines(entry_id);
CREATE INDEX idx_jel_account_id ON journal_entry_lines(account_id);
CREATE INDEX idx_je_status ON journal_entries(status);
CREATE INDEX idx_je_entry_date ON journal_entries(entry_date);
CREATE INDEX idx_je_source ON journal_entries(source_type, source_id);
-- idx_jel_report is deliberately NOT created here — Phase 7 measures
-- p50/p95 before and after adding it, so it must not already exist.

-- ============================================================
-- Purchase
-- ============================================================

CREATE TABLE purchase_orders (
  id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  number       TEXT NOT NULL UNIQUE,
  vendor_id    INTEGER NOT NULL REFERENCES contacts(id),
  order_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'cancelled')),
  total        DECIMAL(14,2) NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE purchase_order_lines (
  id                    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  po_id                 INTEGER NOT NULL REFERENCES purchase_orders(id),
  line_no               INTEGER NOT NULL,
  product_id            INTEGER NOT NULL REFERENCES products(id),
  analytic_account_id   INTEGER REFERENCES analytic_accounts(id),
  qty                   DECIMAL(12,2) NOT NULL,
  unit_price            DECIMAL(14,2) NOT NULL,
  total                 DECIMAL(14,2) NOT NULL
);

CREATE TABLE vendor_bills (
  id                 INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  number             TEXT NOT NULL UNIQUE,       -- ours, sequenced: Bill/2026/0001
  bill_reference     TEXT,                       -- the vendor's own free-text number
  po_id              INTEGER REFERENCES purchase_orders(id), -- NULL -> PO smart button hides
  vendor_id          INTEGER NOT NULL REFERENCES contacts(id),
  bill_date          DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date           DATE,
  status             TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'cancelled')),
  subtotal           DECIMAL(14,2) NOT NULL DEFAULT 0,
  tax_total          DECIMAL(14,2) NOT NULL DEFAULT 0,
  total              DECIMAL(14,2) NOT NULL DEFAULT 0,
  journal_entry_id   INTEGER REFERENCES journal_entries(id), -- set on confirm; idempotency guard
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE vendor_bill_lines (
  id                    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bill_id               INTEGER NOT NULL REFERENCES vendor_bills(id),
  line_no               INTEGER NOT NULL,
  product_id            INTEGER NOT NULL REFERENCES products(id),
  account_id            INTEGER NOT NULL REFERENCES accounts(id), -- Purchase Expense by default
  analytic_account_id   INTEGER REFERENCES analytic_accounts(id),
  qty                   DECIMAL(12,2) NOT NULL,
  unit_price            DECIMAL(14,2) NOT NULL,
  tax_rate              DECIMAL(5,2) NOT NULL DEFAULT 0,
  subtotal              DECIMAL(14,2) NOT NULL,
  tax_amount            DECIMAL(14,2) NOT NULL DEFAULT 0,
  total                 DECIMAL(14,2) NOT NULL
);

-- ============================================================
-- Sales
-- ============================================================

CREATE TABLE sales_orders (
  id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  number       TEXT NOT NULL UNIQUE,
  customer_id  INTEGER NOT NULL REFERENCES contacts(id),
  order_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'cancelled')),
  subtotal     DECIMAL(14,2) NOT NULL DEFAULT 0,
  tax_total    DECIMAL(14,2) NOT NULL DEFAULT 0,
  total        DECIMAL(14,2) NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sales_order_lines (
  id                    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  so_id                 INTEGER NOT NULL REFERENCES sales_orders(id),
  line_no               INTEGER NOT NULL,
  product_id            INTEGER NOT NULL REFERENCES products(id),
  analytic_account_id   INTEGER REFERENCES analytic_accounts(id),
  qty                   DECIMAL(12,2) NOT NULL,
  unit_price            DECIMAL(14,2) NOT NULL,
  tax_rate              DECIMAL(5,2) NOT NULL DEFAULT 0,
  subtotal              DECIMAL(14,2) NOT NULL,
  tax_amount            DECIMAL(14,2) NOT NULL DEFAULT 0,
  total                 DECIMAL(14,2) NOT NULL
);

CREATE TABLE customer_invoices (
  id                 INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  number             TEXT NOT NULL UNIQUE,       -- Inv/2026/0001
  so_id              INTEGER REFERENCES sales_orders(id), -- NULL -> SO smart button hides
  customer_id        INTEGER NOT NULL REFERENCES contacts(id),
  invoice_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date           DATE,
  status             TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'cancelled')),
  subtotal           DECIMAL(14,2) NOT NULL DEFAULT 0,
  tax_total          DECIMAL(14,2) NOT NULL DEFAULT 0,
  total              DECIMAL(14,2) NOT NULL DEFAULT 0,
  journal_entry_id   INTEGER REFERENCES journal_entries(id), -- set on confirm; idempotency guard
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE customer_invoice_lines (
  id                    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  invoice_id            INTEGER NOT NULL REFERENCES customer_invoices(id),
  line_no               INTEGER NOT NULL,
  product_id            INTEGER NOT NULL REFERENCES products(id),
  account_id            INTEGER NOT NULL REFERENCES accounts(id), -- Sales Income by default
  analytic_account_id   INTEGER REFERENCES analytic_accounts(id),
  qty                   DECIMAL(12,2) NOT NULL,
  unit_price            DECIMAL(14,2) NOT NULL,
  tax_rate              DECIMAL(5,2) NOT NULL DEFAULT 0,
  subtotal              DECIMAL(14,2) NOT NULL,
  tax_amount            DECIMAL(14,2) NOT NULL DEFAULT 0,
  total                 DECIMAL(14,2) NOT NULL
);

-- ============================================================
-- Money
-- ============================================================

CREATE TABLE payments (
  id                 INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  number             TEXT NOT NULL UNIQUE,
  direction          TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  partner_id         INTEGER NOT NULL REFERENCES contacts(id),
  method             TEXT NOT NULL CHECK (method IN ('cash', 'bank')),
  payment_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  amount             DECIMAL(14,2) NOT NULL,
  journal_entry_id   INTEGER REFERENCES journal_entries(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE payment_allocations (
  id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  payment_id   INTEGER NOT NULL REFERENCES payments(id),
  invoice_id   INTEGER REFERENCES customer_invoices(id),
  bill_id      INTEGER REFERENCES vendor_bills(id),
  amount       DECIMAL(14,2) NOT NULL,
  CHECK (num_nonnulls(invoice_id, bill_id) = 1)
);

-- ============================================================
-- Budget
-- ============================================================

CREATE TABLE budgets (
  id                    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name                  TEXT NOT NULL,
  period_start          DATE NOT NULL,
  period_end            DATE NOT NULL,
  responsible_user_id   INTEGER REFERENCES users(id),
  status                TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'revised', 'cancelled')),
  revised_of_id         INTEGER REFERENCES budgets(id), -- self-FK; both directions navigable
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE budget_lines (
  id                    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  budget_id             INTEGER NOT NULL REFERENCES budgets(id),
  analytic_account_id   INTEGER NOT NULL REFERENCES analytic_accounts(id),
  committed_amount      DECIMAL(14,2) NOT NULL
);

-- ============================================================
-- Ops
-- ============================================================

CREATE TABLE stock_moves (
  id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id   INTEGER NOT NULL REFERENCES products(id),
  qty_change   DECIMAL(12,2) NOT NULL, -- +on bill confirm, -on invoice confirm
  move_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  source_type  TEXT NOT NULL CHECK (source_type IN ('bill', 'invoice')),
  source_id    INTEGER NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Chatter / audit trail. 2026-09-06: action CHECK extended (human-approved) with
-- 'revise' (budget lifecycle), 'delete' (draft journal-entry deletion), and
-- 'login'/'login_failed' (auth events, table_name='users') to cover the Audit
-- Log UI spec. before_data/after_data hold { } blobs; password_hash is stripped
-- in AuditService before any row is written.
CREATE TABLE audit_log (
  id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  table_name   TEXT NOT NULL,
  record_id    INTEGER NOT NULL,
  action       TEXT NOT NULL CHECK (action IN ('create', 'update', 'confirm', 'post', 'reverse', 'cancel', 'pay', 'archive', 'revise', 'delete', 'login', 'login_failed')),
  user_id      INTEGER REFERENCES users(id),
  before_data  JSONB,
  after_data   JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Invariant triggers — the ledger cannot be corrupted even by direct SQL
-- ============================================================

-- Balance check: only enforced once an entry is 'posted'. Deferred to COMMIT
-- so postingService can insert lines one at a time, then flip status last.
CREATE OR REPLACE FUNCTION check_entry_balanced(p_entry_id INTEGER) RETURNS VOID AS $$
DECLARE
  v_status TEXT;
  v_diff   DECIMAL(14,2);
BEGIN
  SELECT status INTO v_status FROM journal_entries WHERE id = p_entry_id;
  IF v_status IS DISTINCT FROM 'posted' THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(debit), 0) - COALESCE(SUM(credit), 0)
    INTO v_diff
    FROM journal_entry_lines
    WHERE entry_id = p_entry_id;

  IF v_diff <> 0 THEN
    RAISE EXCEPTION 'Journal entry % is unbalanced: debit - credit = %', p_entry_id, v_diff;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_fn_lines_balanced() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM check_entry_balanced(OLD.entry_id);
    RETURN OLD;
  ELSE
    PERFORM check_entry_balanced(NEW.entry_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Fires when lines change (covers postDocument: insert lines, then flip status)
CREATE CONSTRAINT TRIGGER trg_lines_balanced
  AFTER INSERT OR UPDATE OR DELETE ON journal_entry_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION trg_fn_lines_balanced();

CREATE OR REPLACE FUNCTION trg_fn_entry_status_balanced() RETURNS TRIGGER AS $$
BEGIN
  PERFORM check_entry_balanced(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fires when a manual entry (lines already exist) is posted via
-- POST /journal-entries/:id/post with no line changes in that transaction.
CREATE CONSTRAINT TRIGGER trg_entry_status_balanced
  AFTER UPDATE OF status ON journal_entries
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  WHEN (NEW.status = 'posted')
  EXECUTE FUNCTION trg_fn_entry_status_balanced();

-- Immutability: a posted entry cannot be edited or deleted. Corrections are reversals.
CREATE OR REPLACE FUNCTION trg_fn_je_immutable() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'posted' THEN
    RAISE EXCEPTION 'Posted journal entry % cannot be modified or deleted. Use a reversal.', OLD.id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_je_immutable
  BEFORE UPDATE OR DELETE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION trg_fn_je_immutable();

CREATE OR REPLACE FUNCTION trg_fn_jel_immutable() RETURNS TRIGGER AS $$
DECLARE
  v_status  TEXT;
  v_entry_id INTEGER;
BEGIN
  v_entry_id := COALESCE(OLD.entry_id, NEW.entry_id);
  SELECT status INTO v_status FROM journal_entries WHERE id = v_entry_id;
  IF v_status = 'posted' THEN
    RAISE EXCEPTION 'Lines of posted journal entry % cannot be modified or deleted.', v_entry_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_jel_immutable
  BEFORE UPDATE OR DELETE ON journal_entry_lines
  FOR EACH ROW EXECUTE FUNCTION trg_fn_jel_immutable();

-- ============================================================
-- Views — reports read ONLY through these, never sum document tables
-- ============================================================

CREATE VIEW v_account_section AS
SELECT
  id AS account_id,
  name,
  type,
  CASE WHEN type IN ('asset', 'liability', 'bank', 'capital', 'cash')
       THEN 'balance_sheet' ELSE 'profit_loss' END AS section
FROM accounts;

CREATE VIEW v_trial_balance AS
SELECT
  a.id AS account_id,
  a.name AS account_name,
  a.type AS account_type,
  COALESCE(SUM(l.debit), 0) AS total_debit,
  COALESCE(SUM(l.credit), 0) AS total_credit,
  COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0) AS balance
FROM accounts a
LEFT JOIN (
  SELECT jel.account_id, jel.debit, jel.credit
  FROM journal_entry_lines jel
  JOIN journal_entries je ON je.id = jel.entry_id
  WHERE je.status = 'posted'
) l ON l.account_id = a.id
GROUP BY a.id, a.name, a.type;

CREATE VIEW v_ledger_detail AS
SELECT
  jel.id AS line_id,
  je.id AS entry_id,
  je.number AS entry_number,
  je.entry_date,
  je.journal_id,
  je.reference,
  je.source_type,
  je.source_id,
  je.status,
  jel.account_id,
  a.name AS account_name,
  a.type AS account_type,
  jel.partner_id,
  c.name AS partner_name,
  jel.analytic_account_id,
  jel.debit,
  jel.credit,
  jel.description
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.entry_id
JOIN accounts a ON a.id = jel.account_id
LEFT JOIN contacts c ON c.id = jel.partner_id
WHERE je.status = 'posted';

CREATE VIEW v_invoice_status AS
SELECT
  ci.id AS invoice_id,
  ci.number,
  ci.customer_id,
  ci.total,
  COALESCE(pa.amount_paid, 0) AS amount_paid,
  ci.total - COALESCE(pa.amount_paid, 0) AS amount_due,
  CASE
    WHEN COALESCE(pa.amount_paid, 0) = 0 THEN 'not_paid'
    WHEN COALESCE(pa.amount_paid, 0) < ci.total THEN 'partial'
    ELSE 'paid'
  END AS payment_status
FROM customer_invoices ci
LEFT JOIN (
  SELECT invoice_id, SUM(amount) AS amount_paid
  FROM payment_allocations
  WHERE invoice_id IS NOT NULL
  GROUP BY invoice_id
) pa ON pa.invoice_id = ci.id;

CREATE VIEW v_bill_status AS
SELECT
  vb.id AS bill_id,
  vb.number,
  vb.vendor_id,
  vb.total,
  COALESCE(pa.amount_paid, 0) AS amount_paid,
  vb.total - COALESCE(pa.amount_paid, 0) AS amount_due,
  CASE
    WHEN COALESCE(pa.amount_paid, 0) = 0 THEN 'not_paid'
    WHEN COALESCE(pa.amount_paid, 0) < vb.total THEN 'partial'
    ELSE 'paid'
  END AS payment_status
FROM vendor_bills vb
LEFT JOIN (
  SELECT bill_id, SUM(amount) AS amount_paid
  FROM payment_allocations
  WHERE bill_id IS NOT NULL
  GROUP BY bill_id
) pa ON pa.bill_id = vb.id;

CREATE VIEW v_budget_line_progress AS
SELECT
  bl.id AS budget_line_id,
  bl.budget_id,
  b.name AS budget_name,
  b.period_start,
  b.period_end,
  bl.analytic_account_id,
  aa.name AS analytic_account_name,
  aa.type AS analytic_type,
  bl.committed_amount,
  COALESCE(achieved.amount, 0) AS achieved_amount,
  CASE WHEN bl.committed_amount = 0 THEN 0
       ELSE ROUND(COALESCE(achieved.amount, 0) / bl.committed_amount * 100, 2)
  END AS achieved_pct,
  bl.committed_amount - COALESCE(achieved.amount, 0) AS amount_to_achieve
FROM budget_lines bl
JOIN budgets b ON b.id = bl.budget_id
JOIN analytic_accounts aa ON aa.id = bl.analytic_account_id
LEFT JOIN LATERAL (
  SELECT
    CASE WHEN aa.type = 'income' THEN (
      SELECT COALESCE(SUM(cil.total), 0)
      FROM customer_invoice_lines cil
      JOIN customer_invoices ci ON ci.id = cil.invoice_id
      WHERE cil.analytic_account_id = bl.analytic_account_id
        AND ci.status = 'confirmed'
        AND ci.invoice_date BETWEEN b.period_start AND b.period_end
    ) ELSE (
      SELECT COALESCE(SUM(vbl.total), 0)
      FROM vendor_bill_lines vbl
      JOIN vendor_bills vb ON vb.id = vbl.bill_id
      WHERE vbl.analytic_account_id = bl.analytic_account_id
        AND vb.status = 'confirmed'
        AND vb.bill_date BETWEEN b.period_start AND b.period_end
    ) END AS amount
) achieved ON true;

CREATE VIEW v_stock_on_hand AS
SELECT product_id, COALESCE(SUM(qty_change), 0) AS stock_qty
FROM stock_moves
GROUP BY product_id;

-- ============================================================
-- Payment Gateway Intents (Razorpay adapter)
-- ============================================================

CREATE TABLE payment_intents (
  id                  SERIAL PRIMARY KEY,
  invoice_id          INT NOT NULL REFERENCES customer_invoices(id),
  contact_id          INT NOT NULL REFERENCES contacts(id),
  amount              DECIMAL(14,2) NOT NULL CHECK (amount > 0),
  gateway             TEXT NOT NULL DEFAULT 'razorpay',
  gateway_order_id    TEXT NOT NULL UNIQUE,
  gateway_payment_id  TEXT UNIQUE,
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','success','failed','abandoned')),
  payment_id          INT REFERENCES payments(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at         TIMESTAMPTZ
);
CREATE INDEX idx_pi_invoice ON payment_intents(invoice_id);
CREATE INDEX idx_pi_status  ON payment_intents(status);

-- ============================================================
-- Business Template Library
-- ============================================================

CREATE TABLE template_categories (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  slug        TEXT NOT NULL UNIQUE,
  icon        TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE templates (
  id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name                TEXT NOT NULL,
  slug                TEXT NOT NULL UNIQUE,
  category_id         INTEGER NOT NULL REFERENCES template_categories(id),
  profession          TEXT NOT NULL,
  description         TEXT NOT NULL,
  file_type           TEXT NOT NULL DEFAULT 'XLSX / CSV / PDF',
  version             TEXT NOT NULL DEFAULT '1.0.0',
  source_type         TEXT NOT NULL DEFAULT 'Urban Furniture ERP — Original Template',
  license_note        TEXT NOT NULL DEFAULT 'Open Business Format — Free for commercial & operational use',
  is_active           BOOLEAN NOT NULL DEFAULT true,
  fields_json         JSONB NOT NULL DEFAULT '[]',
  structure_json      JSONB NOT NULL DEFAULT '{}',
  preview_data_json   JSONB NOT NULL DEFAULT '{}',
  formula_notes       TEXT,
  erp_data_source     TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_templates (
  id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id             INTEGER NOT NULL REFERENCES users(id),
  template_id         INTEGER NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  configuration_json  JSONB NOT NULL DEFAULT '{}',
  custom_data_json    JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_templates_cat ON templates(category_id);
CREATE INDEX idx_templates_slug ON templates(slug);
CREATE INDEX idx_user_templates_user ON user_templates(user_id);

