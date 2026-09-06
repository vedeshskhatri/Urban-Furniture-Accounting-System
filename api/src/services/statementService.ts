import Decimal from 'decimal.js';
import { pool } from '../db/pool';

export interface StatementLineItem {
  id: number;
  date: string;
  type: 'invoice' | 'payment';
  ref: string;
  description: string;
  debit: string;
  credit: string;
  runningBalance: string;
}

export interface CustomerStatement {
  customerId: number;
  customerName: string;
  customerEmail: string | null;
  customerMobile: string | null;
  totalInvoiced: string;
  totalPaid: string;
  currentBalance: string;
  lines: StatementLineItem[];
}

export interface CustomerAgingBucket {
  customerId: number;
  customerName: string;
  customerEmail: string | null;
  current: string;
  days1_30: string;
  days31_60: string;
  days61_90: string;
  days90Plus: string;
  totalOutstanding: string;
}

export interface AgingReport {
  asOfDate: string;
  customers: CustomerAgingBucket[];
  totals: {
    current: string;
    days1_30: string;
    days31_60: string;
    days61_90: string;
    days90Plus: string;
    totalOutstanding: string;
  };
}

export interface OverdueSummary {
  overdueCount: number;
  overdueAmount: string;
  invoices: {
    invoiceId: number;
    invoiceNumber: string;
    customerId: number;
    customerName: string;
    invoiceDate: string;
    dueDate: string;
    daysOverdue: number;
    total: string;
    amountPaid: string;
    amountDue: string;
  }[];
}

export class StatementService {
  /**
   * Generates chronological customer statement with running balance
   */
  static async getCustomerStatement(customerId: number): Promise<CustomerStatement> {
    // 1. Fetch customer details
    const custRes = await pool.query<{ id: number; name: string; email: string | null; mobile: string | null }>(
      'SELECT id, name, email, mobile FROM contacts WHERE id = $1',
      [customerId]
    );
    if (custRes.rows.length === 0) {
      throw new Error(`Customer #${customerId} not found`);
    }
    const customer = custRes.rows[0];

    // 2. Fetch confirmed invoices
    const invRes = await pool.query<{
      id: number;
      number: string;
      invoice_date: string;
      total: string;
    }>(
      `SELECT id, number, invoice_date, total
       FROM customer_invoices
       WHERE customer_id = $1 AND status = 'confirmed'
       ORDER BY invoice_date ASC, id ASC`,
      [customerId]
    );

    // 3. Fetch inbound payments allocated to this customer's invoices
    const payRes = await pool.query<{
      id: number;
      number: string;
      payment_date: string;
      method: string;
      amount: string;
      invoice_number: string;
    }>(
      `SELECT 
         pa.id,
         p.number,
         p.payment_date,
         p.method,
         pa.amount,
         ci.number AS invoice_number
       FROM payment_allocations pa
       JOIN payments p ON p.id = pa.payment_id
       JOIN customer_invoices ci ON ci.id = pa.invoice_id
       WHERE ci.customer_id = $1 AND p.direction = 'inbound'
       ORDER BY p.payment_date ASC, pa.id ASC`,
      [customerId]
    );

    // Merge transactions chronologically
    type RawTx = {
      id: number;
      date: string;
      type: 'invoice' | 'payment';
      ref: string;
      description: string;
      debit: Decimal;
      credit: Decimal;
    };

    const transactions: RawTx[] = [];

    for (const inv of invRes.rows) {
      const dateStr = inv.invoice_date ? new Date(inv.invoice_date).toISOString().split('T')[0] : '';
      transactions.push({
        id: inv.id,
        date: dateStr,
        type: 'invoice',
        ref: inv.number,
        description: `Customer Invoice ${inv.number}`,
        debit: new Decimal(inv.total),
        credit: new Decimal('0.00'),
      });
    }

    for (const pay of payRes.rows) {
      const dateStr = pay.payment_date ? new Date(pay.payment_date).toISOString().split('T')[0] : '';
      transactions.push({
        id: pay.id,
        date: dateStr,
        type: 'payment',
        ref: pay.number,
        description: `Payment ${pay.number} (${pay.method.toUpperCase()}) for ${pay.invoice_number}`,
        debit: new Decimal('0.00'),
        credit: new Decimal(pay.amount),
      });
    }

    // Sort transactions chronologically: Date asc, Invoices before payments if same date, then ID asc
    transactions.sort((a, b) => {
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date);
      }
      if (a.type !== b.type) {
        return a.type === 'invoice' ? -1 : 1;
      }
      return a.id - b.id;
    });

    let runningBalance = new Decimal('0.00');
    let totalInvoiced = new Decimal('0.00');
    let totalPaid = new Decimal('0.00');
    const statementLines: StatementLineItem[] = [];

    for (const tx of transactions) {
      if (tx.type === 'invoice') {
        runningBalance = runningBalance.plus(tx.debit);
        totalInvoiced = totalInvoiced.plus(tx.debit);
      } else {
        runningBalance = runningBalance.minus(tx.credit);
        totalPaid = totalPaid.plus(tx.credit);
      }

      statementLines.push({
        id: tx.id,
        date: tx.date,
        type: tx.type,
        ref: tx.ref,
        description: tx.description,
        debit: tx.debit.toFixed(2),
        credit: tx.credit.toFixed(2),
        runningBalance: runningBalance.toFixed(2),
      });
    }

    return {
      customerId: customer.id,
      customerName: customer.name,
      customerEmail: customer.email,
      customerMobile: customer.mobile,
      totalInvoiced: totalInvoiced.toFixed(2),
      totalPaid: totalPaid.toFixed(2),
      currentBalance: runningBalance.toFixed(2),
      lines: statementLines,
    };
  }

  /**
   * Computes Receivables Aging Report (0-30, 31-60, 61-90, 90+)
   */
  static async getReceivablesAgingReport(asOfDateStr?: string): Promise<AgingReport> {
    const asOf = asOfDateStr ? new Date(asOfDateStr) : new Date();
    asOf.setHours(0, 0, 0, 0);

    // Fetch all open confirmed customer invoices
    const query = `
      SELECT 
        c.id AS customer_id,
        c.name AS customer_name,
        c.email AS customer_email,
        ci.id AS invoice_id,
        ci.number AS invoice_number,
        ci.invoice_date,
        ci.due_date,
        vis.total,
        vis.amount_paid,
        vis.amount_due
      FROM customer_invoices ci
      JOIN contacts c ON c.id = ci.customer_id
      JOIN v_invoice_status vis ON vis.invoice_id = ci.id
      WHERE ci.status = 'confirmed' AND vis.amount_due > 0
      ORDER BY c.name ASC, ci.due_date ASC
    `;

    const res = await pool.query<{
      customer_id: number;
      customer_name: string;
      customer_email: string | null;
      invoice_id: number;
      invoice_number: string;
      invoice_date: string;
      due_date: string | null;
      total: string;
      amount_paid: string;
      amount_due: string;
    }>(query);

    // Map by customer
    type CustAccumulator = {
      customerId: number;
      customerName: string;
      customerEmail: string | null;
      current: Decimal;
      days1_30: Decimal;
      days31_60: Decimal;
      days61_90: Decimal;
      days90Plus: Decimal;
      totalOutstanding: Decimal;
    };

    const customerMap = new Map<number, CustAccumulator>();

    for (const row of res.rows) {
      if (!customerMap.has(row.customer_id)) {
        customerMap.set(row.customer_id, {
          customerId: row.customer_id,
          customerName: row.customer_name,
          customerEmail: row.customer_email,
          current: new Decimal('0.00'),
          days1_30: new Decimal('0.00'),
          days31_60: new Decimal('0.00'),
          days61_90: new Decimal('0.00'),
          days90Plus: new Decimal('0.00'),
          totalOutstanding: new Decimal('0.00'),
        });
      }

      const acc = customerMap.get(row.customer_id)!;
      const dueAmount = new Decimal(row.amount_due);
      acc.totalOutstanding = acc.totalOutstanding.plus(dueAmount);

      // Determine due date
      const dueDate = row.due_date ? new Date(row.due_date) : new Date(row.invoice_date);
      dueDate.setHours(0, 0, 0, 0);

      const diffTime = asOf.getTime() - dueDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 0) {
        acc.current = acc.current.plus(dueAmount);
      } else if (diffDays <= 30) {
        acc.days1_30 = acc.days1_30.plus(dueAmount);
      } else if (diffDays <= 60) {
        acc.days31_60 = acc.days31_60.plus(dueAmount);
      } else if (diffDays <= 90) {
        acc.days61_90 = acc.days61_90.plus(dueAmount);
      } else {
        acc.days90Plus = acc.days90Plus.plus(dueAmount);
      }
    }

    let totCurrent = new Decimal('0.00');
    let tot1_30 = new Decimal('0.00');
    let tot31_60 = new Decimal('0.00');
    let tot61_90 = new Decimal('0.00');
    let tot90Plus = new Decimal('0.00');
    let totOutstanding = new Decimal('0.00');

    const customerList: CustomerAgingBucket[] = [];

    for (const acc of customerMap.values()) {
      totCurrent = totCurrent.plus(acc.current);
      tot1_30 = tot1_30.plus(acc.days1_30);
      tot31_60 = tot31_60.plus(acc.days31_60);
      tot61_90 = tot61_90.plus(acc.days61_90);
      tot90Plus = tot90Plus.plus(acc.days90Plus);
      totOutstanding = totOutstanding.plus(acc.totalOutstanding);

      customerList.push({
        customerId: acc.customerId,
        customerName: acc.customerName,
        customerEmail: acc.customerEmail,
        current: acc.current.toFixed(2),
        days1_30: acc.days1_30.toFixed(2),
        days31_60: acc.days31_60.toFixed(2),
        days61_90: acc.days61_90.toFixed(2),
        days90Plus: acc.days90Plus.toFixed(2),
        totalOutstanding: acc.totalOutstanding.toFixed(2),
      });
    }

    return {
      asOfDate: asOf.toISOString().split('T')[0],
      customers: customerList,
      totals: {
        current: totCurrent.toFixed(2),
        days1_30: tot1_30.toFixed(2),
        days31_60: tot31_60.toFixed(2),
        days61_90: tot61_90.toFixed(2),
        days90Plus: tot90Plus.toFixed(2),
        totalOutstanding: totOutstanding.toFixed(2),
      },
    };
  }

  /**
   * Computes Payables (Vendor Creditors) Aging Report (Current, 1-30, 31-60, 61-90, 90+)
   */
  static async getPayablesAgingReport(asOfDateStr?: string): Promise<AgingReport> {
    const asOf = asOfDateStr ? new Date(asOfDateStr) : new Date();
    asOf.setHours(0, 0, 0, 0);

    const query = `
      SELECT 
        c.id AS vendor_id,
        c.name AS vendor_name,
        c.email AS vendor_email,
        vb.id AS bill_id,
        vb.number AS bill_number,
        vb.bill_date,
        vb.due_date,
        vbs.total,
        vbs.amount_paid,
        vbs.amount_due
      FROM vendor_bills vb
      JOIN contacts c ON c.id = vb.vendor_id
      JOIN v_bill_status vbs ON vbs.bill_id = vb.id
      WHERE vb.status = 'confirmed' AND vbs.amount_due > 0
      ORDER BY c.name ASC, vb.due_date ASC
    `;

    const res = await pool.query<{
      vendor_id: number;
      vendor_name: string;
      vendor_email: string | null;
      bill_id: number;
      bill_number: string;
      bill_date: string;
      due_date: string | null;
      total: string;
      amount_paid: string;
      amount_due: string;
    }>(query);

    type VendorAccumulator = {
      vendorId: number;
      vendorName: string;
      vendorEmail: string | null;
      current: Decimal;
      days1_30: Decimal;
      days31_60: Decimal;
      days61_90: Decimal;
      days90Plus: Decimal;
      totalOutstanding: Decimal;
    };

    const vendorMap = new Map<number, VendorAccumulator>();

    for (const row of res.rows) {
      if (!vendorMap.has(row.vendor_id)) {
        vendorMap.set(row.vendor_id, {
          vendorId: row.vendor_id,
          vendorName: row.vendor_name,
          vendorEmail: row.vendor_email,
          current: new Decimal('0.00'),
          days1_30: new Decimal('0.00'),
          days31_60: new Decimal('0.00'),
          days61_90: new Decimal('0.00'),
          days90Plus: new Decimal('0.00'),
          totalOutstanding: new Decimal('0.00'),
        });
      }

      const acc = vendorMap.get(row.vendor_id)!;
      const dueAmount = new Decimal(row.amount_due);
      acc.totalOutstanding = acc.totalOutstanding.plus(dueAmount);

      const dueDate = row.due_date ? new Date(row.due_date) : new Date(row.bill_date);
      dueDate.setHours(0, 0, 0, 0);

      const diffTime = asOf.getTime() - dueDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 0) {
        acc.current = acc.current.plus(dueAmount);
      } else if (diffDays <= 30) {
        acc.days1_30 = acc.days1_30.plus(dueAmount);
      } else if (diffDays <= 60) {
        acc.days31_60 = acc.days31_60.plus(dueAmount);
      } else if (diffDays <= 90) {
        acc.days61_90 = acc.days61_90.plus(dueAmount);
      } else {
        acc.days90Plus = acc.days90Plus.plus(dueAmount);
      }
    }

    let totCurrent = new Decimal('0.00');
    let tot1_30 = new Decimal('0.00');
    let tot31_60 = new Decimal('0.00');
    let tot61_90 = new Decimal('0.00');
    let tot90Plus = new Decimal('0.00');
    let totOutstanding = new Decimal('0.00');

    const vendorList: CustomerAgingBucket[] = [];

    for (const acc of vendorMap.values()) {
      totCurrent = totCurrent.plus(acc.current);
      tot1_30 = tot1_30.plus(acc.days1_30);
      tot31_60 = tot31_60.plus(acc.days31_60);
      tot61_90 = tot61_90.plus(acc.days61_90);
      tot90Plus = tot90Plus.plus(acc.days90Plus);
      totOutstanding = totOutstanding.plus(acc.totalOutstanding);

      vendorList.push({
        customerId: acc.vendorId,
        customerName: acc.vendorName,
        customerEmail: acc.vendorEmail,
        current: acc.current.toFixed(2),
        days1_30: acc.days1_30.toFixed(2),
        days31_60: acc.days31_60.toFixed(2),
        days61_90: acc.days61_90.toFixed(2),
        days90Plus: acc.days90Plus.toFixed(2),
        totalOutstanding: acc.totalOutstanding.toFixed(2),
      });
    }

    return {
      asOfDate: asOf.toISOString().split('T')[0],
      customers: vendorList,
      totals: {
        current: totCurrent.toFixed(2),
        days1_30: tot1_30.toFixed(2),
        days31_60: tot31_60.toFixed(2),
        days61_90: tot61_90.toFixed(2),
        days90Plus: tot90Plus.toFixed(2),
        totalOutstanding: totOutstanding.toFixed(2),
      },
    };
  }

  /**
   * Retrieves overdue invoices for the dashboard/alert banners
   */
  static async getOverdueInvoices(): Promise<OverdueSummary> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const res = await pool.query<{
      invoice_id: number;
      invoice_number: string;
      customer_id: number;
      customer_name: string;
      invoice_date: string;
      due_date: string;
      total: string;
      amount_paid: string;
      amount_due: string;
    }>(
      `SELECT 
         ci.id AS invoice_id,
         ci.number AS invoice_number,
         c.id AS customer_id,
         c.name AS customer_name,
         ci.invoice_date,
         ci.due_date,
         vis.total,
         vis.amount_paid,
         vis.amount_due
       FROM customer_invoices ci
       JOIN contacts c ON c.id = ci.customer_id
       JOIN v_invoice_status vis ON vis.invoice_id = ci.id
       WHERE ci.status = 'confirmed' 
         AND vis.amount_due > 0
         AND ci.due_date IS NOT NULL
         AND ci.due_date < CURRENT_DATE
       ORDER BY ci.due_date ASC, vis.amount_due DESC`
    );

    let totalOverdue = new Decimal('0.00');
    const invoices = res.rows.map(row => {
      const dueAmt = new Decimal(row.amount_due);
      totalOverdue = totalOverdue.plus(dueAmt);

      const dueDate = new Date(row.due_date);
      dueDate.setHours(0, 0, 0, 0);
      const diffTime = today.getTime() - dueDate.getTime();
      const daysOverdue = Math.max(1, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

      return {
        invoiceId: row.invoice_id,
        invoiceNumber: row.invoice_number,
        customerId: row.customer_id,
        customerName: row.customer_name,
        invoiceDate: row.invoice_date ? new Date(row.invoice_date).toISOString().split('T')[0] : '',
        dueDate: row.due_date ? new Date(row.due_date).toISOString().split('T')[0] : '',
        daysOverdue,
        daysPastDue: daysOverdue,
        total: new Decimal(row.total).toFixed(2),
        amountPaid: new Decimal(row.amount_paid).toFixed(2),
        amountDue: dueAmt.toFixed(2),
      };
    });

    return {
      overdueCount: invoices.length,
      overdueAmount: totalOverdue.toFixed(2),
      invoices,
    };
  }
}
