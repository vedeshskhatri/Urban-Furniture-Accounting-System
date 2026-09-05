import { PoolClient } from 'pg';
import { pool } from '../db/pool';
import { withTransaction } from '../db/withTransaction';
import { SequenceService } from './sequenceService';
import { PostingService } from './postingService';
import { Decimal } from 'decimal.js';

export interface InvoiceLineInput {
  productId: number;
  accountId?: number;
  analyticAccountId?: number | null;
  qty: string | number;
  unitPrice: string | number;
  taxRate?: string | number;
}

export interface CreateInvoiceInput {
  soId?: number | null;
  customerId: number;
  invoiceDate?: string;
  dueDate?: string;
  lines: InvoiceLineInput[];
}

export interface InvoiceLineDTO {
  id: number;
  invoiceId: number;
  lineNo: number;
  productId: number;
  productName?: string;
  productSku?: string;
  accountId: number;
  accountName?: string;
  analyticAccountId?: number | null;
  analyticAccountName?: string | null;
  qty: string;
  unitPrice: string;
  taxRate: string;
  subtotal: string;
  taxAmount: string;
  total: string;
}

export interface CustomerInvoiceDTO {
  id: number;
  number: string;
  soId?: number | null;
  soNumber?: string | null;
  customerId: number;
  customerName?: string;
  customerEmail?: string;
  invoiceDate: string;
  dueDate: string;
  status: 'draft' | 'confirmed' | 'cancelled';
  subtotal: string;
  taxTotal: string;
  total: string;
  journalEntryId?: number | null;
  journalEntryNumber?: string | null;
  amountPaid: string;
  amountDue: string;
  paymentStatus: 'not_paid' | 'partial' | 'paid' | 'draft' | 'cancelled';
  paidViaCash?: string;
  paidViaBank?: string;
  lines: InvoiceLineDTO[];
  createdAt: string;
}

export class InvoiceService {
  /**
   * Create a new customer invoice in draft status
   */
  static async createInvoice(input: CreateInvoiceInput, userId?: number): Promise<CustomerInvoiceDTO> {
    return await withTransaction(async (tx: PoolClient) => {
      // 1. Generate sequence Inv/YYYY/0001
      const invNumber = await SequenceService.nextDocNumber('INV', tx);

      // 2. Resolve default Sales Income account if not provided
      const defaultAccountRes = await tx.query<{ id: number }>(
        `SELECT id FROM accounts WHERE name = 'Sales Income' OR type = 'income' LIMIT 1`
      );
      const defaultAccountId = defaultAccountRes.rows[0]?.id;
      if (!defaultAccountId) {
        throw new Error('Sales Income account not found in Chart of Accounts');
      }

      // 3. Compute exact totals
      let subtotalDec = new Decimal(0);
      let taxTotalDec = new Decimal(0);

      const computedLines = input.lines.map((line, idx) => {
        const qtyDec = new Decimal(line.qty || 0);
        const priceDec = new Decimal(line.unitPrice || 0);
        const taxRateDec = new Decimal(line.taxRate !== undefined ? line.taxRate : 0);

        const lineSubtotal = qtyDec.times(priceDec);
        const lineTax = lineSubtotal.times(taxRateDec.dividedBy(100));
        const lineTotal = lineSubtotal.plus(lineTax);

        subtotalDec = subtotalDec.plus(lineSubtotal);
        taxTotalDec = taxTotalDec.plus(lineTax);

        return {
          lineNo: idx + 1,
          productId: line.productId,
          accountId: line.accountId || defaultAccountId,
          analyticAccountId: line.analyticAccountId || null,
          qty: qtyDec.toFixed(2),
          unitPrice: priceDec.toFixed(2),
          taxRate: taxRateDec.toFixed(2),
          subtotal: lineSubtotal.toFixed(2),
          taxAmount: lineTax.toFixed(2),
          total: lineTotal.toFixed(2),
        };
      });

      const grandTotalDec = subtotalDec.plus(taxTotalDec);
      const invoiceDate = input.invoiceDate || new Date().toISOString().split('T')[0];
      const dueDate = input.dueDate || null;

      // 4. Insert into customer_invoices
      const invRes = await tx.query<{ id: number }>(
        `INSERT INTO customer_invoices
           (number, so_id, customer_id, invoice_date, due_date, status, subtotal, tax_total, total)
         VALUES ($1, $2, $3, $4, COALESCE($5::date, $4::date + 30), 'draft', $6, $7, $8)
         RETURNING id`,
        [
          invNumber,
          input.soId || null,
          input.customerId,
          invoiceDate,
          dueDate,
          subtotalDec.toFixed(2),
          taxTotalDec.toFixed(2),
          grandTotalDec.toFixed(2),
        ]
      );

      const invoiceId = invRes.rows[0].id;

      // 5. Insert invoice lines
      for (const line of computedLines) {
        await tx.query(
          `INSERT INTO customer_invoice_lines
             (invoice_id, line_no, product_id, account_id, analytic_account_id, qty, unit_price, tax_rate, subtotal, tax_amount, total)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            invoiceId,
            line.lineNo,
            line.productId,
            line.accountId,
            line.analyticAccountId,
            line.qty,
            line.unitPrice,
            line.taxRate,
            line.subtotal,
            line.taxAmount,
            line.total,
          ]
        );
      }

      // 6. Write audit log
      await tx.query(
        `INSERT INTO audit_log (table_name, record_id, action, user_id, after_data)
         VALUES ('customer_invoices', $1, 'create', $2, $3)`,
        [invoiceId, userId || null, JSON.stringify({ number: invNumber, total: grandTotalDec.toFixed(2) })]
      );

      return (await InvoiceService.getInvoiceById(invoiceId, tx))!;
    });
  }

  /**
   * Confirm Customer Invoice inside ONE transaction:
   *   a. call postingService.postDocument('invoice', id, tx)
   *   b. create stock_moves: -qty for each goods line
   *   c. write audit_log
   *   d. status = 'confirmed'
   */
  static async confirmInvoice(invoiceId: number, userId?: number): Promise<CustomerInvoiceDTO> {
    return await withTransaction(async (tx: PoolClient) => {
      // 1. Fetch and lock invoice
      const invRes = await tx.query<{
        id: number;
        number: string;
        status: string;
        journal_entry_id: number | null;
      }>('SELECT id, number, status, journal_entry_id FROM customer_invoices WHERE id = $1 FOR UPDATE', [invoiceId]);

      if (invRes.rows.length === 0) {
        throw new Error(`Customer invoice #${invoiceId} not found`);
      }

      const invoice = invRes.rows[0];
      if (invoice.status === 'confirmed' && invoice.journal_entry_id) {
        // Idempotent
        return (await InvoiceService.getInvoiceById(invoiceId, tx))!;
      }

      if (invoice.status !== 'draft') {
        throw new Error(`Only draft invoices can be confirmed (current status: ${invoice.status})`);
      }

      // 2. Post to ledger via postingService (writes balanced journal entries & updates invoice.journal_entry_id + status)
      const { entryId } = await PostingService.postDocument('invoice', invoiceId, tx);

      // 3. Create stock_moves: -qty for each goods line
      const goodsLines = await tx.query<{
        product_id: number;
        qty: string;
      }>(
        `SELECT cil.product_id, cil.qty
         FROM customer_invoice_lines cil
         JOIN products p ON p.id = cil.product_id
         WHERE cil.invoice_id = $1 AND p.type = 'goods'`,
        [invoiceId]
      );

      for (const item of goodsLines.rows) {
        const negativeQty = new Decimal(item.qty).negated().toFixed(2);
        await tx.query(
          `INSERT INTO stock_moves (product_id, qty_change, move_date, source_type, source_id)
           VALUES ($1, $2, CURRENT_DATE, 'invoice', $3)`,
          [item.product_id, negativeQty, invoiceId]
        );
        await tx.query(
          `UPDATE products SET stock_qty = stock_qty + $1 WHERE id = $2`,
          [negativeQty, item.product_id]
        );
      }

      // 4. Ensure status confirmed
      await tx.query(
        "UPDATE customer_invoices SET status = 'confirmed' WHERE id = $1",
        [invoiceId]
      );

      // 5. Audit log
      await tx.query(
        `INSERT INTO audit_log (table_name, record_id, action, user_id, after_data)
         VALUES ('customer_invoices', $1, 'confirm', $2, $3)`,
        [invoiceId, userId || null, JSON.stringify({ number: invoice.number, journalEntryId: entryId })]
      );

      return (await InvoiceService.getInvoiceById(invoiceId, tx))!;
    });
  }

  /**
   * Get Customer Invoice by ID with lines, relations, and computed payment status from v_invoice_status
   */
  static async getInvoiceById(invoiceId: number, clientOrPool: PoolClient | typeof pool = pool): Promise<CustomerInvoiceDTO | null> {
    const invRes = await clientOrPool.query(
      `SELECT 
        ci.*,
        c.name as customer_name,
        c.email as customer_email,
        so.number as so_number,
        je.number as journal_entry_number,
        vis.amount_paid,
        vis.amount_due,
        vis.payment_status
       FROM customer_invoices ci
       JOIN contacts c ON c.id = ci.customer_id
       LEFT JOIN sales_orders so ON so.id = ci.so_id
       LEFT JOIN journal_entries je ON je.id = ci.journal_entry_id
       LEFT JOIN v_invoice_status vis ON vis.invoice_id = ci.id
       WHERE ci.id = $1`,
      [invoiceId]
    );

    if (invRes.rows.length === 0) return null;
    const inv = invRes.rows[0];

    // Query payment breakdown: Cash vs Bank
    const paymentBreakdown = await clientOrPool.query<{
      method: string;
      total_paid: string;
    }>(
      `SELECT p.method, COALESCE(SUM(pa.amount), 0) as total_paid
       FROM payment_allocations pa
       JOIN payments p ON p.id = pa.payment_id
       WHERE pa.invoice_id = $1
       GROUP BY p.method`,
      [invoiceId]
    );

    let paidCash = '0.00';
    let paidBank = '0.00';
    paymentBreakdown.rows.forEach(r => {
      if (r.method === 'cash') paidCash = String(r.total_paid);
      if (r.method === 'bank') paidBank = String(r.total_paid);
    });

    // Fetch lines
    const linesRes = await clientOrPool.query(
      `SELECT 
        cil.*,
        p.name as product_name,
        p.sku as product_sku,
        a.name as account_name,
        aa.name as analytic_account_name
       FROM customer_invoice_lines cil
       JOIN products p ON p.id = cil.product_id
       JOIN accounts a ON a.id = cil.account_id
       LEFT JOIN analytic_accounts aa ON aa.id = cil.analytic_account_id
       WHERE cil.invoice_id = $1
       ORDER BY cil.line_no ASC`,
      [invoiceId]
    );

    return {
      id: inv.id,
      number: inv.number,
      soId: inv.so_id,
      soNumber: inv.so_number,
      customerId: inv.customer_id,
      customerName: inv.customer_name,
      customerEmail: inv.customer_email || undefined,
      invoiceDate: inv.invoice_date ? new Date(inv.invoice_date).toISOString().split('T')[0] : '',
      dueDate: inv.due_date ? new Date(inv.due_date).toISOString().split('T')[0] : '',
      status: inv.status,
      subtotal: String(inv.subtotal),
      taxTotal: String(inv.tax_total),
      total: String(inv.total),
      journalEntryId: inv.journal_entry_id,
      journalEntryNumber: inv.journal_entry_number,
      amountPaid: String(inv.amount_paid || '0.00'),
      amountDue: String(inv.amount_due !== null && inv.amount_due !== undefined ? inv.amount_due : inv.total),
      paymentStatus: inv.payment_status || 'not_paid',
      paidViaCash: paidCash,
      paidViaBank: paidBank,
      lines: linesRes.rows.map(r => ({
        id: r.id,
        invoiceId: r.invoice_id,
        lineNo: r.line_no,
        productId: r.product_id,
        productName: r.product_name,
        productSku: r.product_sku,
        accountId: r.account_id,
        accountName: r.account_name,
        analyticAccountId: r.analytic_account_id,
        analyticAccountName: r.analytic_account_name,
        qty: String(r.qty),
        unitPrice: String(r.unit_price),
        taxRate: String(r.tax_rate),
        subtotal: String(r.subtotal),
        taxAmount: String(r.tax_amount),
        total: String(r.total),
      })),
      createdAt: inv.created_at ? new Date(inv.created_at).toISOString() : '',
    };
  }

  /**
   * List Customer Invoices with computed status from v_invoice_status
   */
  static async listInvoices(filters?: { status?: string; customerId?: number }): Promise<CustomerInvoiceDTO[]> {
    let q = `SELECT 
              ci.*,
              c.name as customer_name,
              so.number as so_number,
              vis.amount_paid,
              vis.amount_due,
              vis.payment_status
             FROM customer_invoices ci
             JOIN contacts c ON c.id = ci.customer_id
             LEFT JOIN sales_orders so ON so.id = ci.so_id
             LEFT JOIN v_invoice_status vis ON vis.invoice_id = ci.id
             WHERE 1=1`;
    const params: any[] = [];

    if (filters?.status) {
      params.push(filters.status);
      q += ` AND ci.status = $${params.length}`;
    }
    if (filters?.customerId) {
      params.push(filters.customerId);
      q += ` AND ci.customer_id = $${params.length}`;
    }

    q += ` ORDER BY ci.invoice_date DESC, ci.id DESC`;

    const res = await pool.query(q, params);
    return res.rows.map(inv => ({
      id: inv.id,
      number: inv.number,
      soId: inv.so_id,
      soNumber: inv.so_number,
      customerId: inv.customer_id,
      customerName: inv.customer_name,
      invoiceDate: inv.invoice_date ? new Date(inv.invoice_date).toISOString().split('T')[0] : '',
      dueDate: inv.due_date ? new Date(inv.due_date).toISOString().split('T')[0] : '',
      status: inv.status,
      subtotal: String(inv.subtotal),
      taxTotal: String(inv.tax_total),
      total: String(inv.total),
      journalEntryId: inv.journal_entry_id,
      amountPaid: String(inv.amount_paid || '0.00'),
      amountDue: String(inv.amount_due !== null && inv.amount_due !== undefined ? inv.amount_due : inv.total),
      paymentStatus: inv.payment_status || 'not_paid',
      lines: [],
      createdAt: inv.created_at ? new Date(inv.created_at).toISOString() : '',
    }));
  }

  /**
   * Get payment history for this invoice
   */
  static async getInvoicePayments(invoiceId: number) {
    const { PaymentService } = await import('./paymentService');
    return PaymentService.getInvoicePaymentHistory(invoiceId);
  }

  /**
   * Evaluates invoice lines against product MRP and Cost Price for non-blocking pricing warnings
   */
  static async validateMrpWarnings(lines: InvoiceLineInput[]): Promise<string[]> {
    const warnings: string[] = [];
    const productIds = lines.map(l => l.productId);
    if (productIds.length === 0) return warnings;

    const res = await pool.query(
      `SELECT id, name, cost_price::TEXT as cost_price, mrp::TEXT as mrp FROM products WHERE id = ANY($1)`,
      [productIds]
    );

    const productMap = new Map(res.rows.map(r => [r.id, r]));

    for (const line of lines) {
      const p = productMap.get(line.productId);
      if (!p) continue;
      const unitPrice = new Decimal(line.unitPrice || '0');
      const mrp = new Decimal(p.mrp || '0');
      const cost = new Decimal(p.cost_price || '0');

      if (mrp.greaterThan(0) && unitPrice.greaterThan(mrp)) {
        warnings.push(`⚠️ MRP Ceiling Warning: Line for "${p.name}" unit price (₹${unitPrice.toFixed(2)}) exceeds Maximum Retail Price (₹${mrp.toFixed(2)}).`);
      }
      if (cost.greaterThan(0) && unitPrice.lessThan(cost)) {
        warnings.push(`⚠️ Below-Cost Warning: Line for "${p.name}" unit price (₹${unitPrice.toFixed(2)}) is below purchase cost (₹${cost.toFixed(2)}).`);
      }
    }

    return warnings;
  }

  /**
   * Calculates gross profit and COGS analytics across confirmed customer invoice lines
   */
  static async getMarginAnalytics(): Promise<{
    summary: {
      totalRevenue: string;
      totalCogs: string;
      totalGrossProfit: string;
      overallMarginPct: string;
      topMarginProduct: any | null;
      lowestMarginProduct: any | null;
    };
    products: any[];
  }> {
    const res = await pool.query(`
      SELECT 
        cil.product_id,
        p.name AS product_name,
        p.sku,
        COALESCE(p.cost_price, 0)::TEXT AS cost_price,
        COALESCE(p.mrp, 0)::TEXT AS mrp,
        SUM(cil.qty)::TEXT AS total_qty_sold,
        SUM(cil.subtotal)::TEXT AS total_revenue,
        SUM(cil.qty * COALESCE(p.cost_price, 0))::TEXT AS total_cogs,
        (SUM(cil.subtotal) - SUM(cil.qty * COALESCE(p.cost_price, 0)))::TEXT AS gross_profit,
        CASE WHEN SUM(cil.subtotal) > 0 
          THEN ROUND(((SUM(cil.subtotal) - SUM(cil.qty * COALESCE(p.cost_price, 0))) / SUM(cil.subtotal) * 100), 2)::TEXT
          ELSE '0.00'
        END AS margin_pct
      FROM customer_invoice_lines cil
      JOIN customer_invoices ci ON ci.id = cil.invoice_id
      JOIN products p ON p.id = cil.product_id
      WHERE ci.status = 'confirmed'
      GROUP BY cil.product_id, p.name, p.sku, p.cost_price, p.mrp
      ORDER BY (SUM(cil.subtotal) - SUM(cil.qty * COALESCE(p.cost_price, 0))) DESC;
    `);

    let totalRev = new Decimal(0);
    let totalCogs = new Decimal(0);
    let totalProfit = new Decimal(0);

    const items = res.rows.map(r => {
      const rev = new Decimal(r.total_revenue || '0');
      const cogs = new Decimal(r.total_cogs || '0');
      const profit = new Decimal(r.gross_profit || '0');
      totalRev = totalRev.plus(rev);
      totalCogs = totalCogs.plus(cogs);
      totalProfit = totalProfit.plus(profit);

      return {
        productId: r.product_id,
        productName: r.product_name,
        sku: r.sku,
        costPrice: r.cost_price,
        mrp: r.mrp,
        totalQtySold: Math.round(Number(r.total_qty_sold || 0)),
        totalRevenue: rev.toFixed(2),
        totalCogs: cogs.toFixed(2),
        grossProfit: profit.toFixed(2),
        marginPct: r.margin_pct,
      };
    });

    const overallMarginPct = totalRev.greaterThan(0)
      ? totalProfit.dividedBy(totalRev).times(100).toFixed(2)
      : '0.00';

    return {
      summary: {
        totalRevenue: totalRev.toFixed(2),
        totalCogs: totalCogs.toFixed(2),
        totalGrossProfit: totalProfit.toFixed(2),
        overallMarginPct,
        topMarginProduct: items.length > 0 ? items[0] : null,
        lowestMarginProduct: items.length > 0 ? items[items.length - 1] : null,
      },
      products: items,
    };
  }
}

