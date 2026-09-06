import { pool } from '../db/pool';
import Decimal from 'decimal.js';
import { fetchLedgerIntegrityPayload } from './ledgerEvents';


export interface ProfitLossReport {
  from: string | null;
  to: string | null;
  income: Array<{
    accountId: number;
    accountName: string;
    total: string;
  }>;
  expenses: Array<{
    accountId: number;
    accountName: string;
    type: string;
    total: string;
  }>;
  totalIncome: string;
  totalExpenses: string;
  netProfit: string;
}

export interface BalanceSheetReport {
  asOf: string;
  assets: Array<{
    accountId: number;
    accountName: string;
    type: string;
    balance: string;
  }>;
  liabilities: Array<{
    accountId: number;
    accountName: string;
    type: string;
    balance: string;
  }>;
  capital: Array<{
    accountId: number;
    accountName: string;
    type: string;
    balance: string;
  }>;
  currentPeriodProfit: string;
  totalAssets: string;
  totalLiabilities: string;
  totalCapital: string;
  totalEquity: string;
  isBalanced: boolean;
}

export interface VerificationResult {
  totalDebit: string;
  totalCredit: string;
  difference: string;
  entryCount?: number;
  lineCount?: number;
  lastEntry?: {
    number: string;
    date: string;
    time?: string;
    journal: string;
  } | null;
}


export class ReportService {
  /**
   * Profit & Loss statement BETWEEN two dates.
   * Income (credit - debit) minus Expenses (debit - credit).
   * Only reads from posted journal entry lines.
   */
  static async getProfitAndLoss(from?: string, to?: string): Promise<ProfitLossReport> {
    const query = `
      SELECT 
        a.id AS account_id,
        a.name AS account_name,
        a.type AS account_type,
        COALESCE(SUM(jel.debit), 0)::text AS total_debit,
        COALESCE(SUM(jel.credit), 0)::text AS total_credit
      FROM accounts a
      LEFT JOIN (
        SELECT jel.account_id, jel.debit, jel.credit
        FROM journal_entry_lines jel
        JOIN journal_entries je ON je.id = jel.entry_id
        WHERE je.status = 'posted'
          AND ($1::date IS NULL OR je.entry_date >= $1::date)
          AND ($2::date IS NULL OR je.entry_date <= $2::date)
      ) jel ON jel.account_id = a.id
      WHERE a.type IN ('income', 'expense', 'other_expense')
        AND a.is_archived = false
      GROUP BY a.id, a.name, a.type
      ORDER BY a.type, a.name;
    `;

    const res = await pool.query(query, [from || null, to || null]);

    const income: ProfitLossReport['income'] = [];
    const expenses: ProfitLossReport['expenses'] = [];

    let totalIncome = new Decimal(0);
    let totalExpenses = new Decimal(0);

    for (const row of res.rows) {
      const debit = new Decimal(row.total_debit);
      const credit = new Decimal(row.total_credit);

      if (row.account_type === 'income') {
        const netIncome = credit.minus(debit);
        income.push({
          accountId: row.account_id,
          accountName: row.account_name,
          total: netIncome.toFixed(2),
        });
        totalIncome = totalIncome.plus(netIncome);
      } else {
        const netExpense = debit.minus(credit);
        expenses.push({
          accountId: row.account_id,
          accountName: row.account_name,
          type: row.account_type,
          total: netExpense.toFixed(2),
        });
        totalExpenses = totalExpenses.plus(netExpense);
      }
    }

    const netProfit = totalIncome.minus(totalExpenses);

    return {
      from: from || null,
      to: to || null,
      income,
      expenses,
      totalIncome: totalIncome.toFixed(2),
      totalExpenses: totalExpenses.toFixed(2),
      netProfit: netProfit.toFixed(2),
    };
  }

  /**
   * Balance Sheet report CUMULATIVE UP TO asOf date.
   * Assets (asset, bank, cash) = debit - credit.
   * Liabilities (liability) = credit - debit.
   * Capital (capital) = credit - debit PLUS currentPeriodProfit.
   * If profit does not flow into equity the sheet will not balance.
   */
  static async getBalanceSheet(asOf?: string): Promise<BalanceSheetReport> {
    const targetDate = asOf || new Date().toISOString().split('T')[0];

    const query = `
      SELECT 
        a.id AS account_id,
        a.name AS account_name,
        a.type AS account_type,
        COALESCE(SUM(jel.debit), 0)::text AS total_debit,
        COALESCE(SUM(jel.credit), 0)::text AS total_credit
      FROM accounts a
      LEFT JOIN (
        SELECT jel.account_id, jel.debit, jel.credit
        FROM journal_entry_lines jel
        JOIN journal_entries je ON je.id = jel.entry_id
        WHERE je.status = 'posted'
          AND je.entry_date <= $1::date
      ) jel ON jel.account_id = a.id
      WHERE a.is_archived = false
      GROUP BY a.id, a.name, a.type
      ORDER BY a.type, a.name;
    `;

    const res = await pool.query(query, [targetDate]);

    const assets: BalanceSheetReport['assets'] = [];
    const liabilities: BalanceSheetReport['liabilities'] = [];
    const capital: BalanceSheetReport['capital'] = [];

    let totalAssets = new Decimal(0);
    let totalLiabilities = new Decimal(0);
    let totalCapitalAccounts = new Decimal(0);
    let cumulativeIncome = new Decimal(0);
    let cumulativeExpense = new Decimal(0);

    for (const row of res.rows) {
      const debit = new Decimal(row.total_debit);
      const credit = new Decimal(row.total_credit);

      switch (row.account_type) {
        case 'asset':
        case 'bank':
        case 'cash': {
          const bal = debit.minus(credit);
          assets.push({
            accountId: row.account_id,
            accountName: row.account_name,
            type: row.account_type,
            balance: bal.toFixed(2),
          });
          totalAssets = totalAssets.plus(bal);
          break;
        }
        case 'liability': {
          const bal = credit.minus(debit);
          liabilities.push({
            accountId: row.account_id,
            accountName: row.account_name,
            type: row.account_type,
            balance: bal.toFixed(2),
          });
          totalLiabilities = totalLiabilities.plus(bal);
          break;
        }
        case 'capital': {
          const bal = credit.minus(debit);
          capital.push({
            accountId: row.account_id,
            accountName: row.account_name,
            type: row.account_type,
            balance: bal.toFixed(2),
          });
          totalCapitalAccounts = totalCapitalAccounts.plus(bal);
          break;
        }
        case 'income': {
          cumulativeIncome = cumulativeIncome.plus(credit.minus(debit));
          break;
        }
        case 'expense':
        case 'other_expense': {
          cumulativeExpense = cumulativeExpense.plus(debit.minus(credit));
          break;
        }
      }
    }

    // Profit flow to equity: Net Profit = Income - Expenses
    const currentPeriodProfit = cumulativeIncome.minus(cumulativeExpense);
    const totalEquity = totalCapitalAccounts.plus(currentPeriodProfit);
    const totalLiabilitiesAndEquity = totalLiabilities.plus(totalEquity);
    const isBalanced = totalAssets.equals(totalLiabilitiesAndEquity);

    return {
      asOf: targetDate,
      assets,
      liabilities,
      capital,
      currentPeriodProfit: currentPeriodProfit.toFixed(2),
      totalAssets: totalAssets.toFixed(2),
      totalLiabilities: totalLiabilities.toFixed(2),
      totalCapital: totalCapitalAccounts.toFixed(2),
      totalEquity: totalEquity.toFixed(2),
      isBalanced,
    };
  }

  /**
   * Budget progress from v_budget_line_progress
   */
  static async getBudgetProgress(budgetId?: number) {
    const query = `
      SELECT 
        budget_line_id,
        budget_id,
        budget_name,
        period_start,
        period_end,
        analytic_account_id,
        analytic_account_name,
        analytic_type,
        committed_amount::text,
        achieved_amount::text,
        achieved_pct::text,
        amount_to_achieve::text
      FROM v_budget_line_progress
      WHERE ($1::int IS NULL OR budget_id = $1::int)
      ORDER BY budget_id, budget_line_id;
    `;

    const res = await pool.query(query, [budgetId || null]);
    return res.rows;
  }

  /**
   * Source documents backing a budget line's achieved amount
   */
  static async getBudgetLineDocuments(lineId: number) {
    const lineQuery = `
      SELECT 
        bl.id AS budget_line_id,
        bl.budget_id,
        b.name AS budget_name,
        b.period_start,
        b.period_end,
        bl.analytic_account_id,
        aa.name AS analytic_account_name,
        aa.type AS analytic_type
      FROM budget_lines bl
      JOIN budgets b ON b.id = bl.budget_id
      JOIN analytic_accounts aa ON aa.id = bl.analytic_account_id
      WHERE bl.id = $1;
    `;

    let lineRes = await pool.query(lineQuery, [lineId]);
    if (lineRes.rows.length === 0) {
      const fallbackQuery = `
        SELECT 
          bl.id AS budget_line_id,
          bl.budget_id,
          b.name AS budget_name,
          b.period_start,
          b.period_end,
          bl.analytic_account_id,
          aa.name AS analytic_account_name,
          aa.type AS analytic_type
        FROM budget_lines bl
        JOIN budgets b ON b.id = bl.budget_id
        JOIN analytic_accounts aa ON aa.id = bl.analytic_account_id
        WHERE bl.analytic_account_id = $1
        ORDER BY bl.id DESC LIMIT 1;
      `;
      lineRes = await pool.query(fallbackQuery, [lineId]);
      if (lineRes.rows.length === 0) {
        return null;
      }
    }

    const line = lineRes.rows[0];

    if (line.analytic_type === 'income') {
      const docQuery = `
        SELECT 
          ci.id AS document_id,
          'customer_invoice' AS document_type,
          ci.number,
          ci.invoice_date AS date,
          c.name AS partner_name,
          ci.total::text AS document_total,
          cil.total::text AS line_amount,
          cil.description
        FROM customer_invoice_lines cil
        JOIN customer_invoices ci ON ci.id = cil.invoice_id
        LEFT JOIN contacts c ON c.id = ci.customer_id
        WHERE cil.analytic_account_id = $1
          AND ci.status = 'confirmed'
          AND ci.invoice_date BETWEEN $2 AND $3
        ORDER BY ci.invoice_date DESC, ci.id DESC;
      `;
      const docs = await pool.query(docQuery, [line.analytic_account_id, line.period_start, line.period_end]);
      return { line, documents: docs.rows };
    } else {
      const docQuery = `
        SELECT 
          vb.id AS document_id,
          'vendor_bill' AS document_type,
          vb.number,
          vb.bill_date AS date,
          c.name AS partner_name,
          vb.total::text AS document_total,
          vbl.total::text AS line_amount,
          vbl.description
        FROM vendor_bill_lines vbl
        JOIN vendor_bills vb ON vb.id = vbl.bill_id
        LEFT JOIN contacts c ON c.id = vb.vendor_id
        WHERE vbl.analytic_account_id = $1
          AND vb.status = 'confirmed'
          AND vb.bill_date BETWEEN $2 AND $3
        ORDER BY vb.bill_date DESC, vb.id DESC;
      `;
      const docs = await pool.query(docQuery, [line.analytic_account_id, line.period_start, line.period_end]);
      return { line, documents: docs.rows };
    }
  }

  /**
   * Health endpoint: verify total debit vs total credit across all journal entry lines
   */
  /**
   * Health endpoint: verify total debit vs total credit across all journal entry lines
   */
  static async verifyLedger(): Promise<VerificationResult> {
    return await fetchLedgerIntegrityPayload();
  }


  /**
   * Multi-level ledger drill-down: Report -> Account -> Journal Entries
   */
  static async getLedgerDetail(accountId?: number, from?: string, to?: string) {
    const query = `
      SELECT 
        line_id,
        entry_id,
        entry_number,
        entry_date,
        journal_id,
        reference,
        source_type,
        source_id,
        status,
        account_id,
        account_name,
        account_type,
        partner_id,
        partner_name,
        analytic_account_id,
        debit::numeric(14,2)::text AS debit,
        credit::numeric(14,2)::text AS credit,
        description
      FROM v_ledger_detail
      WHERE ($1::int IS NULL OR account_id = $1::int)
        AND ($2::date IS NULL OR entry_date >= $2::date)
        AND ($3::date IS NULL OR entry_date <= $3::date)
      ORDER BY entry_date ASC, entry_id ASC, line_id ASC;
    `;
    const res = await pool.query(query, [accountId || null, from || null, to || null]);
    return res.rows;
  }
}
