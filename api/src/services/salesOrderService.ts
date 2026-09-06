import { PoolClient } from 'pg';
import { pool } from '../db/pool';
import { withTransaction } from '../db/withTransaction';
import { SequenceService } from './sequenceService';
import { Decimal } from 'decimal.js';

export interface SalesOrderLineInput {
  productId: number;
  analyticAccountId?: number | null;
  qty: string | number;
  unitPrice: string | number;
  taxRate?: string | number;
}

export interface CreateSalesOrderInput {
  customerId: number;
  orderDate?: string;
  lines: SalesOrderLineInput[];
}

export interface SalesOrderLineDTO {
  id: number;
  soId: number;
  lineNo: number;
  productId: number;
  productName?: string;
  productSku?: string;
  analyticAccountId?: number | null;
  analyticAccountName?: string | null;
  qty: string;
  unitPrice: string;
  taxRate: string;
  subtotal: string;
  taxAmount: string;
  total: string;
}

export interface SalesOrderDTO {
  id: number;
  number: string;
  customerId: number;
  customerName?: string;
  orderDate: string;
  status: 'draft' | 'confirmed' | 'cancelled';
  subtotal: string;
  taxTotal: string;
  taxAmount: string;
  total: string;
  totalAmount: string;
  lines: SalesOrderLineDTO[];
  invoiceId?: number | null;
  invoiceNumber?: string | null;
  invoiceStatus?: string | null;
  isInvoiced?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export class SalesOrderService {
  /**
   * Create a new Sales Order in draft status.
   */
  static async createSalesOrder(input: CreateSalesOrderInput, userId?: number): Promise<SalesOrderDTO> {
    return await withTransaction(async (tx: PoolClient) => {
      // 1. Generate sequence number SO00001
      const soNumber = await SequenceService.nextDocNumber('SO', tx);

      // 2. Compute exact decimal totals
      let subtotalDec = new Decimal(0);
      let taxTotalDec = new Decimal(0);

      const computedLines = input.lines.map((line, idx) => {
        const qtyDec = new Decimal(line.qty || 0);
        const priceDec = new Decimal(line.unitPrice || 0);
        const taxRateDec = new Decimal(line.taxRate || 0);

        const lineSubtotal = qtyDec.times(priceDec);
        const lineTax = lineSubtotal.times(taxRateDec.dividedBy(100));
        const lineTotal = lineSubtotal.plus(lineTax);

        subtotalDec = subtotalDec.plus(lineSubtotal);
        taxTotalDec = taxTotalDec.plus(lineTax);

        return {
          lineNo: idx + 1,
          productId: line.productId,
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

      // 3. Insert into sales_orders
      const orderDate = input.orderDate || new Date().toISOString().split('T')[0];
      const soRes = await tx.query<{ id: number }>(
        `INSERT INTO sales_orders (number, customer_id, order_date, status, subtotal, tax_total, total)
         VALUES ($1, $2, $3, 'draft', $4, $5, $6)
         RETURNING id`,
        [
          soNumber,
          input.customerId,
          orderDate,
          subtotalDec.toFixed(2),
          taxTotalDec.toFixed(2),
          grandTotalDec.toFixed(2),
        ]
      );

      const soId = soRes.rows[0].id;

      // 4. Insert lines
      for (const line of computedLines) {
        await tx.query(
          `INSERT INTO sales_order_lines
             (so_id, line_no, product_id, analytic_account_id, qty, unit_price, tax_rate, subtotal, tax_amount, total)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            soId,
            line.lineNo,
            line.productId,
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

      // 5. Audit log
      await tx.query(
        `INSERT INTO audit_log (table_name, record_id, action, user_id, after_data)
         VALUES ('sales_orders', $1, 'create', $2, $3)`,
        [soId, userId || null, JSON.stringify({ number: soNumber, total: grandTotalDec.toFixed(2) })]
      );

      return (await SalesOrderService.getSalesOrderById(soId, tx))!;
    });
  }

  /**
   * Update an existing Sales Order.
   * Allowed while in draft, OR while confirmed as long as NO customer invoice has been generated yet.
   * If an invoice is already created, editing is blocked permanently.
   */
  static async updateSalesOrder(soId: number, input: CreateSalesOrderInput, userId?: number): Promise<SalesOrderDTO> {
    return await withTransaction(async (tx: PoolClient) => {
      const soRes = await tx.query<{ id: number; number: string; status: string; customer_id: number }>(
        `SELECT id, number, status, customer_id FROM sales_orders WHERE id = $1 FOR UPDATE`,
        [soId]
      );
      if (soRes.rows.length === 0) {
        throw new Error(`Sales Order #${soId} not found`);
      }
      const so = soRes.rows[0];

      // Block edit permanently if customer invoice already generated for this SO
      const invRes = await tx.query<{ id: number; number: string }>(
        `SELECT id, number FROM customer_invoices WHERE so_id = $1 LIMIT 1`,
        [soId]
      );
      if (invRes.rows.length > 0) {
        throw new Error(`Cannot edit Sales Order ${so.number}: Customer Invoice ${invRes.rows[0].number} has already been created`);
      }

      // Compute exact decimal totals
      let subtotalDec = new Decimal(0);
      let taxTotalDec = new Decimal(0);

      const computedLines = input.lines.map((line, idx) => {
        const qtyDec = new Decimal(line.qty || 0);
        const priceDec = new Decimal(line.unitPrice || 0);
        const taxRateDec = new Decimal(line.taxRate || 0);

        const lineSubtotal = qtyDec.times(priceDec);
        const lineTax = lineSubtotal.times(taxRateDec.dividedBy(100));
        const lineTotal = lineSubtotal.plus(lineTax);

        subtotalDec = subtotalDec.plus(lineSubtotal);
        taxTotalDec = taxTotalDec.plus(lineTax);

        return {
          lineNo: idx + 1,
          productId: line.productId,
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
      const orderDate = input.orderDate || new Date().toISOString().split('T')[0];

      // Update sales_orders record
      await tx.query(
        `UPDATE sales_orders
         SET customer_id = $1, order_date = $2, subtotal = $3, tax_total = $4, total = $5, updated_at = NOW()
         WHERE id = $6`,
        [
          input.customerId,
          orderDate,
          subtotalDec.toFixed(2),
          taxTotalDec.toFixed(2),
          grandTotalDec.toFixed(2),
          soId,
        ]
      );

      // Replace lines
      await tx.query(`DELETE FROM sales_order_lines WHERE so_id = $1`, [soId]);
      for (const line of computedLines) {
        await tx.query(
          `INSERT INTO sales_order_lines
             (so_id, line_no, product_id, analytic_account_id, qty, unit_price, tax_rate, subtotal, tax_amount, total)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            soId,
            line.lineNo,
            line.productId,
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

      // Audit log
      await tx.query(
        `INSERT INTO audit_log (table_name, record_id, action, user_id, after_data)
         VALUES ('sales_orders', $1, 'update', $2, $3)`,
        [soId, userId || null, JSON.stringify({ number: so.number, total: grandTotalDec.toFixed(2) })]
      );

      return (await SalesOrderService.getSalesOrderById(soId, tx))!;
    });
  }

  /**
   * Confirm Sales Order
   * CRITICAL INVARIANT: ABSOLUTELY NO JOURNAL ENTRY ON SO CONFIRM.
   * Zero calls to PostingService.postDocument.
   */
  static async confirmSalesOrder(soId: number, userId?: number): Promise<SalesOrderDTO> {
    return await withTransaction(async (tx: PoolClient) => {
      const soRes = await tx.query<{ id: number; number: string; status: string }>(
        `SELECT id, number, status FROM sales_orders WHERE id = $1 FOR UPDATE`,
        [soId]
      );

      if (soRes.rows.length === 0) {
        throw new Error(`Sales Order #${soId} not found`);
      }

      const so = soRes.rows[0];
      if (so.status === 'confirmed') {
        // Idempotent
        return (await SalesOrderService.getSalesOrderById(soId, tx))!;
      }

      if (so.status !== 'draft') {
        throw new Error(`Cannot confirm Sales Order in '${so.status}' status`);
      }

      // Update status to confirmed
      await tx.query(`UPDATE sales_orders SET status = 'confirmed' WHERE id = $1`, [soId]);

      // Audit log
      await tx.query(
        `INSERT INTO audit_log (table_name, record_id, action, user_id, after_data)
         VALUES ('sales_orders', $1, 'confirm', $2, $3)`,
        [soId, userId || null, JSON.stringify({ number: so.number, status: 'confirmed' })]
      );

      return (await SalesOrderService.getSalesOrderById(soId, tx))!;
    });
  }

  /**
   * Create Customer Invoice from Confirmed Sales Order
   * Copies customer, lines, prices, qty, sets invoice.so_id.
   */
  static async createInvoiceFromSalesOrder(soId: number, userId?: number): Promise<{ invoiceId: number; invoiceNumber: string }> {
    return await withTransaction(async (tx: PoolClient) => {
      // 1. Fetch SO
      const soRes = await tx.query<{
        id: number;
        number: string;
        customer_id: number;
        status: string;
        subtotal: string;
        tax_total: string;
        total: string;
      }>(
        `SELECT id, number, customer_id, status, subtotal, tax_total, total
         FROM sales_orders WHERE id = $1 FOR UPDATE`,
        [soId]
      );

      if (soRes.rows.length === 0) {
        throw new Error(`Sales Order #${soId} not found`);
      }

      const so = soRes.rows[0];
      if (so.status !== 'confirmed') {
        throw new Error(`Only confirmed Sales Orders can be converted to an invoice (current status: ${so.status})`);
      }

      // 2. Check if invoice already created
      const existing = await tx.query<{ id: number; number: string }>(
        `SELECT id, number FROM customer_invoices WHERE so_id = $1`,
        [soId]
      );
      if (existing.rows.length > 0) {
        return { invoiceId: existing.rows[0].id, invoiceNumber: existing.rows[0].number };
      }

      // 3. Generate invoice number Inv/YYYY/XXXX
      const invNumber = await SequenceService.nextDocNumber('INV', tx);

      // 4. Default Sales Income account
      const accRes = await tx.query<{ id: number }>(
        `SELECT id FROM accounts WHERE name = 'Sales Income' OR type = 'income' LIMIT 1`
      );
      const defaultAccountId = accRes.rows[0]?.id;
      if (!defaultAccountId) {
        throw new Error('Sales Income account not found in Chart of Accounts');
      }

      // 5. Create customer_invoices in draft status
      const invRes = await tx.query<{ id: number }>(
        `INSERT INTO customer_invoices
           (number, so_id, customer_id, invoice_date, due_date, status, subtotal, tax_total, total)
         VALUES ($1, $2, $3, CURRENT_DATE, CURRENT_DATE + 30, 'draft', $4, $5, $6)
         RETURNING id`,
        [invNumber, so.id, so.customer_id, so.subtotal, so.tax_total, so.total]
      );
      const invoiceId = invRes.rows[0].id;

      // 6. Copy lines
      const soLines = await tx.query<{
        line_no: number;
        product_id: number;
        analytic_account_id: number | null;
        qty: string;
        unit_price: string;
        tax_rate: string;
        subtotal: string;
        tax_amount: string;
        total: string;
      }>(
        `SELECT line_no, product_id, analytic_account_id, qty, unit_price, tax_rate, subtotal, tax_amount, total
         FROM sales_order_lines WHERE so_id = $1 ORDER BY line_no ASC`,
        [soId]
      );

      for (const line of soLines.rows) {
        await tx.query(
          `INSERT INTO customer_invoice_lines
             (invoice_id, line_no, product_id, account_id, analytic_account_id, qty, unit_price, tax_rate, subtotal, tax_amount, total)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            invoiceId,
            line.line_no,
            line.product_id,
            defaultAccountId,
            line.analytic_account_id,
            line.qty,
            line.unit_price,
            line.tax_rate,
            line.subtotal,
            line.tax_amount,
            line.total,
          ]
        );
      }

      // 7. Audit log
      await tx.query(
        `INSERT INTO audit_log (table_name, record_id, action, user_id, after_data)
         VALUES ('customer_invoices', $1, 'create', $2, $3)`,
        [invoiceId, userId || null, JSON.stringify({ soId: so.id, invoiceNumber: invNumber })]
      );

      const { InvoiceService } = await import('./invoiceService');
      const invData = await InvoiceService.getInvoiceById(invoiceId, tx);
      return {
        ...invData,
        id: invoiceId,
        number: invNumber,
        invoiceId,
        invoiceNumber: invNumber,
      };
    });
  }

  /**
   * Get Sales Order by ID with lines
   */
  static async getSalesOrderById(soId: number, clientOrPool: PoolClient | typeof pool = pool): Promise<SalesOrderDTO | null> {
    const soRes = await clientOrPool.query(
      `SELECT so.*, c.name as customer_name
       FROM sales_orders so
       JOIN contacts c ON c.id = so.customer_id
       WHERE so.id = $1`,
      [soId]
    );

    if (soRes.rows.length === 0) return null;
    const so = soRes.rows[0];

    const linesRes = await clientOrPool.query(
      `SELECT sol.*, p.name as product_name, p.sku as product_sku, aa.name as analytic_account_name
       FROM sales_order_lines sol
       JOIN products p ON p.id = sol.product_id
       LEFT JOIN analytic_accounts aa ON aa.id = sol.analytic_account_id
       WHERE sol.so_id = $1
       ORDER BY sol.line_no ASC`,
      [soId]
    );

    const subtotal = String(so.subtotal ?? '0.00');
    const taxTotal = String(so.tax_total ?? '0.00');
    const total = String(so.total ?? '0.00');

    // Check if an invoice has already been created for this sales order
    const invRes = await clientOrPool.query<{ id: number; number: string; status: string }>(
      `SELECT id, number, status FROM customer_invoices WHERE so_id = $1 LIMIT 1`,
      [soId]
    );
    const linkedInvoice = invRes.rows[0] || null;

    return {
      id: so.id,
      number: so.number,
      customerId: so.customer_id,
      customerName: so.customer_name,
      orderDate: so.order_date ? new Date(so.order_date).toISOString().split('T')[0] : '',
      status: so.status,
      subtotal,
      taxTotal,
      taxAmount: taxTotal,
      total,
      totalAmount: total,
      lines: linesRes.rows.map(r => ({
        id: r.id,
        soId: r.so_id,
        lineNo: r.line_no,
        productId: r.product_id,
        productName: r.product_name,
        productSku: r.product_sku,
        analyticAccountId: r.analytic_account_id,
        analyticAccountName: r.analytic_account_name,
        qty: String(r.qty),
        unitPrice: String(r.unit_price),
        taxRate: String(r.tax_rate),
        subtotal: String(r.subtotal),
        taxAmount: String(r.tax_amount),
        total: String(r.total),
      })),
      invoiceId: linkedInvoice ? linkedInvoice.id : null,
      invoiceNumber: linkedInvoice ? linkedInvoice.number : null,
      invoiceStatus: linkedInvoice ? linkedInvoice.status : null,
      isInvoiced: Boolean(linkedInvoice),
      createdAt: so.created_at ? new Date(so.created_at).toISOString() : '',
      updatedAt: so.updated_at ? new Date(so.updated_at).toISOString() : '',
    };
  }

  /**
   * List Sales Orders
   */
  static async listSalesOrders(filters?: { status?: string; customerId?: number }): Promise<SalesOrderDTO[]> {
    let q = `SELECT so.*, c.name as customer_name,
             COALESCE(NULLIF(so.subtotal, 0), (SELECT COALESCE(SUM(subtotal), 0) FROM sales_order_lines sol WHERE sol.so_id = so.id), 0) as computed_subtotal,
             COALESCE(NULLIF(so.tax_total, 0), (SELECT COALESCE(SUM(tax_amount), 0) FROM sales_order_lines sol WHERE sol.so_id = so.id), 0) as computed_tax_total,
             COALESCE(NULLIF(so.total, 0), (SELECT COALESCE(SUM(total), 0) FROM sales_order_lines sol WHERE sol.so_id = so.id), 0) as computed_total
             FROM sales_orders so
             JOIN contacts c ON c.id = so.customer_id
             WHERE 1=1`;
    const params: any[] = [];

    if (filters?.status) {
      params.push(filters.status);
      q += ` AND so.status = $${params.length}`;
    }
    if (filters?.customerId) {
      params.push(filters.customerId);
      q += ` AND so.customer_id = $${params.length}`;
    }

    q += ` ORDER BY so.id DESC`;

    const res = await pool.query(q, params);
    return res.rows.map(so => {
      const subtotal = String(so.computed_subtotal ?? so.subtotal ?? '0.00');
      const tax = String(so.computed_tax_total ?? so.tax_total ?? '0.00');
      const total = String(so.computed_total ?? so.total ?? '0.00');
      return {
        id: so.id,
        number: so.number,
        customerId: so.customer_id,
        customerName: so.customer_name,
        orderDate: so.order_date ? new Date(so.order_date).toISOString().split('T')[0] : '',
        status: so.status,
        subtotal,
        taxTotal: tax,
        taxAmount: tax,
        total,
        totalAmount: total,
        lines: [],
        createdAt: so.created_at ? new Date(so.created_at).toISOString() : '',
      };
    });
  }
}
