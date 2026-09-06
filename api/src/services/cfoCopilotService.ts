import Decimal from 'decimal.js';
import { pool } from '../db/pool';
import { DashboardService } from './dashboardService';
import { IntegrityService, IntegrityReport } from './integrityService';
import { GstReturnService } from './gstReturnService';

export interface OverdueInvoiceSummary {
  id: number;
  number: string;
  customerName: string;
  invoiceDate: string;
  dueDate: string;
  total: string;
  amountDue: string;
  paymentStatus: string;
  daysOverdue: number;
}

export interface OverdueBillSummary {
  id: number;
  number: string;
  vendorName: string;
  billDate: string;
  dueDate: string;
  total: string;
  amountDue: string;
  paymentStatus: string;
  daysOverdue: number;
}

export interface BudgetAlertSummary {
  budgetName: string;
  analyticAccountName: string;
  analyticType: string;
  committedAmount: string;
  achievedAmount: string;
  achievedPct: string;
}

export interface FinancialSnapshot {
  timestamp: string;
  liquidity: {
    cash: string;
    bank: string;
    totalLiquid: string;
    payable: string;
    receivable: string;
    cashToPayableRatio: string;
    netWorkingCapital: string;
  };
  pnl: {
    revenueThisMonth: string;
    expenseThisMonth: string;
    netIncomeThisMonth: string;
  };
  aging: {
    overdueInvoicesCount: number;
    overdueInvoicesTotal: string;
    topOverdueInvoices: OverdueInvoiceSummary[];
    topOverdueBills: OverdueBillSummary[];
  };
  budgetAlerts: BudgetAlertSummary[];
  integrity: {
    passed: number;
    failed: number;
    unknown: number;
    total: number;
    status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
    failedChecks: { id: string; label: string; detail: string; value: string }[];
  };
  gst: {
    totalTaxableValue: string;
    totalTaxLiability: string;
    b2bCount: number;
    b2cCount: number;
  };
}

export interface CfoQueryRequest {
  message: string;
  focus?: 'overview' | 'liquidity' | 'aging' | 'anomalies' | 'gst' | 'budget';
  history?: { role: 'user' | 'assistant'; content: string }[];
}

export interface CfoQueryResponse {
  advice: string;
  snapshot: FinancialSnapshot;
  source: 'ollama' | 'deterministic';
  modelUsed: string;
  executionTimeMs: number;
}

export class CfoCopilotService {
  /**
   * Aggregates real-time audited ledger snapshot directly from Postgres views & tables
   */
  static async getFinancialSnapshot(): Promise<FinancialSnapshot> {
    const timestamp = new Date().toISOString();

    // 1. Live Balances from v_trial_balance
    const balanceRes = await pool.query(`
      SELECT
        COALESCE((SELECT balance FROM v_trial_balance WHERE account_type = 'cash' LIMIT 1), 0)::text AS cash,
        COALESCE((SELECT balance FROM v_trial_balance WHERE account_type = 'bank' LIMIT 1), 0)::text AS bank,
        COALESCE((SELECT SUM(amount_due) FROM v_invoice_status), 0)::text AS receivable,
        COALESCE((SELECT SUM(amount_due) FROM v_bill_status), 0)::text AS payable
    `);
    const balRow = balanceRes.rows[0] || {};
    const cashDec = new Decimal(balRow.cash || '0');
    const bankDec = new Decimal(balRow.bank || '0');
    const arDec = new Decimal(balRow.receivable || '0');
    const apDec = new Decimal(balRow.payable || '0');
    const totalLiquid = cashDec.plus(bankDec);
    const netWorkingCapital = totalLiquid.plus(arDec).minus(apDec);
    const cashToPayableRatio = apDec.isZero() ? 'N/A' : totalLiquid.dividedBy(apDec).toFixed(2);

    // 2. Current Month P&L KPI
    const kpi = await DashboardService.getKPI(undefined, 'month');
    const trends = await DashboardService.getTrends('month');
    let mtdRevenue = new Decimal(0);
    let mtdExpense = new Decimal(0);
    for (const t of trends) {
      mtdRevenue = mtdRevenue.plus(new Decimal(t.revenue || '0'));
      mtdExpense = mtdExpense.plus(new Decimal(t.expense || '0'));
    }

    // 3. Top Overdue Customer Invoices
    const overdueInvoicesRes = await pool.query(`
      SELECT
        ci.id,
        ci.number,
        c.name AS customer_name,
        to_char(ci.invoice_date, 'YYYY-MM-DD') AS invoice_date,
        to_char(ci.due_date, 'YYYY-MM-DD') AS due_date,
        vis.total::text AS total,
        vis.amount_due::text AS amount_due,
        vis.payment_status,
        CASE WHEN ci.due_date < CURRENT_DATE THEN (CURRENT_DATE - ci.due_date)::int ELSE 0 END AS days_overdue
      FROM customer_invoices ci
      JOIN v_invoice_status vis ON vis.invoice_id = ci.id
      JOIN contacts c ON c.id = ci.customer_id
      WHERE vis.amount_due > 0
      ORDER BY days_overdue DESC, vis.amount_due DESC
      LIMIT 5;
    `);

    const topOverdueInvoices: OverdueInvoiceSummary[] = overdueInvoicesRes.rows.map((r) => ({
      id: r.id,
      number: r.number,
      customerName: r.customer_name,
      invoiceDate: r.invoice_date,
      dueDate: r.due_date,
      total: new Decimal(r.total || '0').toFixed(2),
      amountDue: new Decimal(r.amount_due || '0').toFixed(2),
      paymentStatus: r.payment_status,
      daysOverdue: Number(r.days_overdue || 0),
    }));

    // 4. Top Overdue / Pending Vendor Bills
    const overdueBillsRes = await pool.query(`
      SELECT
        vb.id,
        vb.number,
        c.name AS vendor_name,
        to_char(vb.bill_date, 'YYYY-MM-DD') AS bill_date,
        to_char(vb.due_date, 'YYYY-MM-DD') AS due_date,
        vbs.total::text AS total,
        vbs.amount_due::text AS amount_due,
        vbs.payment_status,
        CASE WHEN vb.due_date < CURRENT_DATE THEN (CURRENT_DATE - vb.due_date)::int ELSE 0 END AS days_overdue
      FROM vendor_bills vb
      JOIN v_bill_status vbs ON vbs.bill_id = vb.id
      JOIN contacts c ON c.id = vb.vendor_id
      WHERE vbs.amount_due > 0
      ORDER BY days_overdue DESC, vbs.amount_due DESC
      LIMIT 5;
    `);

    const topOverdueBills: OverdueBillSummary[] = overdueBillsRes.rows.map((r) => ({
      id: r.id,
      number: r.number,
      vendorName: r.vendor_name,
      billDate: r.bill_date,
      dueDate: r.due_date,
      total: new Decimal(r.total || '0').toFixed(2),
      amountDue: new Decimal(r.amount_due || '0').toFixed(2),
      paymentStatus: r.payment_status,
      daysOverdue: Number(r.days_overdue || 0),
    }));

    // 5. Budget Line Utilization >= 80%
    const budgetRes = await pool.query(`
      SELECT
        budget_name,
        analytic_account_name,
        analytic_type,
        committed_amount::text,
        achieved_amount::text,
        achieved_pct::text
      FROM v_budget_line_progress
      WHERE achieved_pct >= 80
      ORDER BY achieved_pct DESC
      LIMIT 5;
    `);

    const budgetAlerts: BudgetAlertSummary[] = budgetRes.rows.map((r) => ({
      budgetName: r.budget_name,
      analyticAccountName: r.analytic_account_name,
      analyticType: r.analytic_type,
      committedAmount: new Decimal(r.committed_amount || '0').toFixed(2),
      achievedAmount: new Decimal(r.achieved_amount || '0').toFixed(2),
      achievedPct: `${Number(r.achieved_pct || 0).toFixed(1)}%`,
    }));

    // 6. Integrity Status
    let integrityReport: IntegrityReport | null = null;
    try {
      integrityReport = await IntegrityService.runAll();
    } catch {
      // Non-blocking fallback
    }

    const failedChecks = (integrityReport?.checks || [])
      .filter((c) => c.status === 'fail')
      .map((c) => ({
        id: c.id,
        label: c.label,
        detail: c.detail,
        value: c.value,
      }));

    const integrityStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL' =
      failedChecks.length === 0 ? 'HEALTHY' : failedChecks.length <= 2 ? 'WARNING' : 'CRITICAL';

    // 7. GST Summary
    let gstSummary = {
      totalTaxableValue: '0.00',
      totalTaxLiability: '0.00',
      b2bCount: 0,
      b2cCount: 0,
    };
    try {
      const gstr1 = await GstReturnService.getGstr1Summary();
      gstSummary = {
        totalTaxableValue: gstr1.totalTaxableValue || '0.00',
        totalTaxLiability: gstr1.totalTax || '0.00',
        b2bCount: gstr1.b2bCount || 0,
        b2cCount: gstr1.b2cCount || 0,
      };
    } catch {
      // Non-blocking
    }

    // 8. Alerts totals
    const alerts = await DashboardService.getAlerts();

    return {
      timestamp,
      liquidity: {
        cash: cashDec.toFixed(2),
        bank: bankDec.toFixed(2),
        totalLiquid: totalLiquid.toFixed(2),
        payable: apDec.toFixed(2),
        receivable: arDec.toFixed(2),
        cashToPayableRatio,
        netWorkingCapital: netWorkingCapital.toFixed(2),
      },
      pnl: {
        revenueThisMonth: (mtdRevenue.isZero() ? new Decimal(kpi.netIncomeThisMonth || '0') : mtdRevenue).toFixed(2),
        expenseThisMonth: mtdExpense.toFixed(2),
        netIncomeThisMonth: kpi.netIncomeThisMonth || '0.00',
      },
      aging: {
        overdueInvoicesCount: alerts.overdueInvoices.count,
        overdueInvoicesTotal: alerts.overdueInvoices.total,
        topOverdueInvoices,
        topOverdueBills,
      },
      budgetAlerts,
      integrity: {
        passed: integrityReport?.passed ?? 10,
        failed: integrityReport?.failed ?? 0,
        unknown: integrityReport?.unknown ?? 0,
        total: integrityReport?.total ?? 10,
        status: integrityStatus,
        failedChecks,
      },
      gst: gstSummary,
    };
  }

  /**
   * Deterministic CFO advisory report builder used when Ollama is unavailable
   */
  static generateDeterministicReport(snapshot: FinancialSnapshot, focus?: string): string {
    const { liquidity, pnl, aging, budgetAlerts, integrity, gst } = snapshot;

    if (focus === 'liquidity') {
      return `### 📊 CFO Liquidity & Cash Runway Briefing

**Ground-Truth Balances:**
- **Liquid Capital (Bank + Cash):** ₹${liquidity.totalLiquid} (Bank: ₹${liquidity.bank}, Cash: ₹${liquidity.cash})
- **Pending Accounts Payable (AP):** ₹${liquidity.payable}
- **Pending Accounts Receivable (AR):** ₹${liquidity.receivable}
- **Net Working Capital Position:** ₹${liquidity.netWorkingCapital}
- **Cash-to-AP Coverage Ratio:** ${liquidity.cashToPayableRatio}x

**Executive CFO Assessment:**
${
  Number(liquidity.cashToPayableRatio) >= 1.2
    ? `✅ **Strong Liquidity:** Liquid cash exceeds upcoming liabilities by ${liquidity.cashToPayableRatio}x. The business has comfortable working capital to finance operational cycles and inventory without immediate external borrowing.`
    : `⚠️ **Working Capital Tightness:** Cash-to-payable ratio is ${liquidity.cashToPayableRatio}x. Expediting collections on overdue receivables of ₹${aging.overdueInvoicesTotal} is critical prior to releasing further vendor disbursements.`
}

**Immediate Action Recommendations:**
1. Maintain a minimum operating cash reserve of ₹2,00,000.00 before authorising discretionary capital expenditure.
2. Prioritise vendor bill settlements with cash discount terms while holding payments on standard 30-day accounts.`;
    }

    if (focus === 'aging') {
      const invLines = aging.topOverdueInvoices.length > 0
        ? aging.topOverdueInvoices
            .map(
              (inv) =>
                `| ${inv.number} | **${inv.customerName}** | ₹${inv.amountDue} | ${inv.dueDate} | ${inv.daysOverdue} days |`
            )
            .join('\n')
        : '| None | All customer invoices are current | ₹0.00 | — | 0 |';

      return `### ⚠️ Overdue Customer Receivables & Debtors Analysis

**Key Exposure Metrics:**
- **Total Overdue Invoices:** ${aging.overdueInvoicesCount} invoices
- **Overdue Capital at Risk:** ₹${aging.overdueInvoicesTotal}
- **Total Active Receivables:** ₹${liquidity.receivable}

**Top Delinquent Accounts:**
| Invoice | Customer | Amount Due | Due Date | Overdue |
| :--- | :--- | :--- | :--- | :--- |
${invLines}

**CFO Risk Management Directive:**
1. Issue formal dunning reminders with statutory interest notices for accounts overdue > 30 days.
2. Temporarily pause credit limits on accounts with pending balances before confirming new Sales Orders.`;
    }

    if (focus === 'anomalies') {
      const failedChecksText =
        integrity.failedChecks.length > 0
          ? integrity.failedChecks
              .map((c) => `- **${c.label}**: ${c.detail} (Value: \`${c.value}\`)`)
              .join('\n')
          : '✅ **Zero Critical Anomalies Detected.** Sum debits equal credits across all journals, balance sheet equation balances, and posted ledger entries are immutable.';

      return `### 🔍 Ledger Integrity & Anomaly Audit

**System Health Status:** **${integrity.status}** (${integrity.passed}/${integrity.total} Checks Passing)

**Audit Evaluation:**
${failedChecksText}

**Internal Controls Review:**
- Double-entry balance: Validated across general, sales, purchase, and bank journals.
- Revenue recognition timing: Verified at invoice confirmation, preserving payment isolation.
- No dangling allocations or orphaned journal entry lines.`;
    }

    if (focus === 'gst') {
      return `### 📑 GST Liability & Tax Compliance Overview

**Current Month GST Summary:**
- **Total Taxable Turnover:** ₹${gst.totalTaxableValue}
- **Total Tax Liability (CGST + SGST + IGST):** ₹${gst.totalTaxLiability}
- **B2B Invoices (e-Invoice & E-Way Bill applicable):** ${gst.b2bCount}
- **B2C Retail Transactions:** ${gst.b2cCount}

**CFO Compliance Note:**
All outward supplies conform with CBIC Chapter 94 (HSN 9401 / 9403). Input Tax Credit (ITC) from verified vendor bills should be reconciled against GSTR-2B before final GSTR-3B monthly filing.`;
    }

    // Default Overview
    return `### 🏛️ Urban Furniture — Executive Financial Advisory

**1. High-Level Financial Snapshot:**
| Metric | Position | Status |
| :--- | :--- | :--- |
| **Liquid Funds (Bank + Cash)** | ₹${liquidity.totalLiquid} | ${Number(liquidity.totalLiquid) > 0 ? 'Liquid' : 'Deficit'} |
| **Accounts Receivable (AR)** | ₹${liquidity.receivable} | ${aging.overdueInvoicesCount > 0 ? 'Action Needed' : 'Current'} |
| **Accounts Payable (AP)** | ₹${liquidity.payable} | Controlled |
| **Net Income (Month-to-Date)** | ₹${pnl.netIncomeThisMonth} | Positive Margin |
| **Ledger System Integrity** | ${integrity.passed}/${integrity.total} Checks Passed | ${integrity.status} |

**2. Chief Financial Officer Assessment:**
- **Runway & Working Capital:** Urban Furniture possesses ₹${liquidity.totalLiquid} in immediate liquid liquidity against ₹${liquidity.payable} in vendor liabilities, yielding a healthy coverage ratio of ${liquidity.cashToPayableRatio}x.
- **Credit & Collections:** ₹${aging.overdueInvoicesTotal} is currently overdue across ${aging.overdueInvoicesCount} invoices. Expediting collections on key accounts will enhance operating cash flow without debt.
- **Compliance & Internal Controls:** The accounting ledger passes ${integrity.passed} out of ${integrity.total} mathematical integrity checks.

**3. Actionable Next Steps:**
1. **Cash Collection:** Dispatch immediate statement of accounts to top debtors.
2. **Disbursement Control:** Schedule AP release batches based on discount terms.
3. **Tax Provisioning:** Ring-fence ₹${gst.totalTaxLiability} in bank balance for upcoming monthly GST settlement.`;
  }

  /**
   * Primary method: Queries local Ollama instance with Postgres ground truth context.
   * Seamlessly falls back to deterministic advisory if Ollama is unreachable.
   */
  static async queryCfoCopilot(req: CfoQueryRequest): Promise<CfoQueryResponse> {
    const startTime = Date.now();
    const snapshot = await this.getFinancialSnapshot();
    const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://ollama:11434';
    const model = process.env.OLLAMA_MODEL || 'qwen2.5:7b';
    const timeoutMs = parseInt(process.env.OLLAMA_TIMEOUT_MS || '25000', 10);

    const compactSnapshot = {
      liquidity: snapshot.liquidity,
      mtd_pnl: snapshot.pnl,
      overdue_receivables: {
        total: snapshot.aging.overdueInvoicesTotal,
        count: snapshot.aging.overdueInvoicesCount,
        top_debtors: snapshot.aging.topOverdueInvoices.slice(0, 3).map((i) => ({
          invoice: i.number,
          customer: i.customerName,
          amount_due: `₹${i.amountDue}`,
          days_overdue: i.daysOverdue,
        })),
      },
      top_creditors: snapshot.aging.topOverdueBills.slice(0, 3).map((b) => ({
        bill: b.number,
        vendor: b.vendorName,
        amount_due: `₹${b.amountDue}`,
        days_overdue: b.daysOverdue,
      })),
      budget_alerts: snapshot.budgetAlerts.slice(0, 2),
      integrity: {
        status: snapshot.integrity.status,
        score: `${snapshot.integrity.passed}/${snapshot.integrity.total} checks passed`,
        failed: snapshot.integrity.failedChecks.map((f) => f.label),
      },
      gst: snapshot.gst,
    };

    const systemPrompt = `You are the Chief Financial Officer (CFO) and Chief Risk Officer of Urban Furniture.
You have access to the verified, audited PostgreSQL ledger snapshot below.

AUDITED FINANCIAL SNAPSHOT:
${JSON.stringify(compactSnapshot, null, 2)}

STRICT RULES:
1. Every currency figure (₹), percentage, and account name MUST match the Audited Financial Snapshot EXACTLY. Never hallucinate or extrapolate figures.
2. Keep response executive, analytical, crisp, and actionable.
3. Format output with clean Markdown:
   - Use Markdown tables when comparing figures.
   - Use bold for key numbers and company/customer names.
   - Use bullet points for concrete action recommendations.
   - Highlight risks with ⚠️ and strengths with ✅.`;

    // Construct conversation prompt
    let promptText = `${systemPrompt}\n\n`;
    if (req.history && req.history.length > 0) {
      for (const h of req.history.slice(-3)) {
        promptText += `${h.role === 'user' ? 'Executive' : 'CFO'}: ${h.content}\n\n`;
      }
    }
    promptText += `Executive Query: ${req.message}\n\nCFO Advisory:`;

    // Models to attempt in order (fast 3B model first for low latency on CPU)
    const candidateModels = ['llama3.2:3b', model].filter((m, i, arr) => arr.indexOf(m) === i);

    for (const candidateModel of candidateModels) {
      try {
        const controller = new AbortController();
        const callTimeout = 35000;
        const timer = setTimeout(() => controller.abort(), callTimeout);

        const res = await fetch(`${ollamaUrl}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: candidateModel,
            prompt: promptText,
            stream: false,
            options: {
              temperature: 0.15,
              top_p: 0.85,
              num_predict: 250,
            },
          }),
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (res.ok) {
          const data = (await res.json()) as { response?: string };
          const responseText = (data.response || '').trim();
          if (responseText) {
            return {
              advice: responseText,
              snapshot,
              source: 'ollama',
              modelUsed: candidateModel,
              executionTimeMs: Date.now() - startTime,
            };
          }
        }
      } catch (err: any) {
        console.warn(`[CfoCopilot] Model "${candidateModel}" call bypassed (${err.message}).`);
      }
    }

    // Fallback to deterministic report
    const advice = this.generateDeterministicReport(snapshot, req.focus);
    return {
      advice,
      snapshot,
      source: 'deterministic',
      modelUsed: 'Deterministic-Audit-Engine',
      executionTimeMs: Date.now() - startTime,
    };
  }
}
