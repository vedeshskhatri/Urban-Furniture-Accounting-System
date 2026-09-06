import { PoolClient } from 'pg';
import { pool } from '../db/pool';
import { withTransaction } from '../db/withTransaction';
import { SequenceService } from './sequenceService';
import { AuditService } from './auditService';
import Decimal from 'decimal.js';

export interface POLineInput {
  productId: number;
  analyticAccountId?: number | null;
  qty: string | number;
  unitPrice: string | number;
  taxRate?: string | number;
}

export interface CreatePOInput {
  vendorId: number;
  poDate?: string;
  lines: POLineInput[];
}

export interface POLineDTO {
  id: number;
  poId: number;
  lineNo: number;
  productId: number;
  productName?: string;
  productSku?: string;
  analyticAccountId?: number | null;
  analyticAccountName?: string | null;
  qty: string;
  unitPrice: string;
  total: string;
}

export interface PurchaseOrderDTO {
  id: number;
  number: string;
  vendorId: number;
  vendorName?: string;
  poDate: string;
  status: 'draft' | 'confirmed' | 'cancelled';
  total: string;
  lines: POLineDTO[];
  createdAt: string;
}

export class PurchaseOrderService {
  static async getAll(): Promise<PurchaseOrderDTO[]> {
    const res = await pool.query(`
      SELECT po.id, po.number, po.vendor_id, po.order_date, po.status, po.total, po.created_at,
             c.name AS vendor_name
      FROM purchase_orders po
      JOIN contacts c ON po.vendor_id = c.id
      ORDER BY po.id DESC
    `);

    const pos = res.rows;
    if (pos.length === 0) return [];

    const poIds = pos.map(p => p.id);
    const linesRes = await pool.query(`
      SELECT pol.id, pol.po_id, pol.line_no, pol.product_id, pol.analytic_account_id,
             pol.qty, pol.unit_price, pol.total,
             p.name AS product_name, p.sku AS product_sku,
             aa.name AS analytic_account_name
      FROM purchase_order_lines pol
      JOIN products p ON pol.product_id = p.id
      LEFT JOIN analytic_accounts aa ON pol.analytic_account_id = aa.id
      WHERE pol.po_id = ANY($1)
      ORDER BY pol.line_no ASC
    `, [poIds]);

    const linesByPo: Record<number, POLineDTO[]> = {};
    for (const l of linesRes.rows) {
      if (!linesByPo[l.po_id]) linesByPo[l.po_id] = [];
      linesByPo[l.po_id].push({
        id: l.id,
        poId: l.po_id,
        lineNo: l.line_no,
        productId: l.product_id,
        productName: l.product_name,
        productSku: l.product_sku,
        analyticAccountId: l.analytic_account_id,
        analyticAccountName: l.analytic_account_name,
        qty: String(l.qty),
        unitPrice: String(l.unit_price),
        total: String(l.total),
      });
    }

    return pos.map(p => {
      const poDate = p.order_date instanceof Date ? p.order_date.toISOString().split('T')[0] : String(p.order_date);
      return {
        id: p.id,
        number: p.number,
        vendorId: p.vendor_id,
        vendorName: p.vendor_name,
        vendor_id: p.vendor_id,
        vendor_name: p.vendor_name,
        poDate,
        po_date: poDate,
        status: p.status,
        total: String(p.total),
        total_amount: String(p.total),
        lines: linesByPo[p.id] || [],
        createdAt: p.created_at,
        created_at: p.created_at,
      };
    }) as any;
  }

  static async getById(id: number): Promise<PurchaseOrderDTO | null> {
    const res = await pool.query(`
      SELECT po.id, po.number, po.vendor_id, po.order_date, po.status, po.total, po.created_at,
             c.name AS vendor_name
      FROM purchase_orders po
      JOIN contacts c ON po.vendor_id = c.id
      WHERE po.id = $1
    `, [id]);

    if (res.rows.length === 0) return null;
    const po = res.rows[0];

    const linesRes = await pool.query(`
      SELECT pol.id, pol.po_id, pol.line_no, pol.product_id, pol.analytic_account_id,
             pol.qty, pol.unit_price, pol.total,
             p.name AS product_name, p.sku AS product_sku,
             aa.name AS analytic_account_name
      FROM purchase_order_lines pol
      JOIN products p ON pol.product_id = p.id
      LEFT JOIN analytic_accounts aa ON pol.analytic_account_id = aa.id
      WHERE pol.po_id = $1
      ORDER BY pol.line_no ASC
    `, [id]);

    const lines: POLineDTO[] = linesRes.rows.map(l => ({
      id: l.id,
      poId: l.po_id,
      lineNo: l.line_no,
      productId: l.product_id,
      productName: l.product_name,
      productSku: l.product_sku,
      analyticAccountId: l.analytic_account_id,
      analyticAccountName: l.analytic_account_name,
      qty: String(l.qty),
      unitPrice: String(l.unit_price),
      total: String(l.total),
    }));

    const poDate = po.order_date instanceof Date ? po.order_date.toISOString().split('T')[0] : String(po.order_date);
    return {
      id: po.id,
      number: po.number,
      vendorId: po.vendor_id,
      vendorName: po.vendor_name,
      vendor_id: po.vendor_id,
      vendor_name: po.vendor_name,
      poDate,
      po_date: poDate,
      status: po.status,
      total: String(po.total),
      total_amount: String(po.total),
      lines,
      createdAt: po.created_at,
      created_at: po.created_at,
    } as any;
  }

  static async create(input: CreatePOInput, userId?: number): Promise<PurchaseOrderDTO> {
    const createdPoId = await withTransaction(async (tx: PoolClient) => {

      const poNumber = await SequenceService.nextDocNumber('PO', tx);
      const poDate = input.poDate || new Date().toISOString().split('T')[0];

      let grandTotal = new Decimal(0);
      const computedLines = input.lines.map((line, idx) => {
        const qty = new Decimal(line.qty);
        const unitPrice = new Decimal(line.unitPrice);
        const lineTotal = qty.times(unitPrice);
        grandTotal = grandTotal.plus(lineTotal);

        return {
          lineNo: idx + 1,
          productId: line.productId,
          analyticAccountId: line.analyticAccountId || null,
          qty: qty.toFixed(2),
          unitPrice: unitPrice.toFixed(2),
          total: lineTotal.toFixed(2),
        };
      });

      const poRes = await tx.query<{ id: number; created_at: string }>(
        `INSERT INTO purchase_orders (number, vendor_id, order_date, status, total)
         VALUES ($1, $2, $3, 'draft', $4)
         RETURNING id, created_at`,
        [poNumber, input.vendorId, poDate, grandTotal.toFixed(2)]
      );

      const poId = poRes.rows[0].id;

      for (const line of computedLines) {
        await tx.query(
          `INSERT INTO purchase_order_lines
            (po_id, line_no, product_id, analytic_account_id, qty, unit_price, total)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [poId, line.lineNo, line.productId, line.analyticAccountId, line.qty, line.unitPrice, line.total]
        );
      }

      await AuditService.log(
        { tableName: 'purchase_orders', recordId: poId, action: 'create', userId, afterData: { number: poNumber, vendorId: input.vendorId, total: grandTotal.toFixed(2) } },
        tx
      );
      return poId;
    });

    const created = await this.getById(createdPoId);

    return created!;
  }


  static async confirm(id: number, userId?: number): Promise<{ po: PurchaseOrderDTO; warning?: string }> {
    const po = await this.getById(id);
    if (!po) throw new Error(`Purchase order ${id} not found`);
    if (po.status !== 'draft') throw new Error(`PO #${po.number} is already ${po.status}`);

    // Check budget warning for lines with analytic accounts
    let budgetWarning: string | undefined;
    for (const line of po.lines) {
      if (line.analyticAccountId) {
        const budgetRes = await pool.query(
          `SELECT committed_amount, achieved_amount 
           FROM v_budget_line_progress 
           WHERE analytic_account_id = $1`,
          [line.analyticAccountId]
        );
        if (budgetRes.rows.length > 0) {
          const row = budgetRes.rows[0];
          const committed = new Decimal(row.committed_amount || 0);
          const achieved = new Decimal(row.achieved_amount || 0);
          const projected = achieved.plus(new Decimal(line.total));
          if (projected.greaterThan(committed)) {
            budgetWarning = `Budget exceeded on analytic account #${line.analyticAccountId} (Committed: ₹${committed.toFixed(2)}, Projected: ₹${projected.toFixed(2)})`;
            break;
          }
        }
      }
    }

    // Confirm PO: No journal entry is created (AGENTS.md rule 4)
    await withTransaction(async (tx) => {
      await tx.query("UPDATE purchase_orders SET status = 'confirmed' WHERE id = $1", [id]);
      await AuditService.log(
        { tableName: 'purchase_orders', recordId: id, action: 'confirm', userId, afterData: { number: po.number, status: 'confirmed', budgetWarning: budgetWarning || null } },
        tx
      );
    });

    const updated = await this.getById(id);
    return { po: updated!, warning: budgetWarning };
  }

  static async cancel(id: number, userId?: number): Promise<PurchaseOrderDTO> {
    const po = await this.getById(id);
    if (!po) throw new Error(`Purchase order ${id} not found`);
    if (po.status === 'confirmed') {
      throw new Error(`Cannot cancel confirmed Purchase Order #${po.number}`);
    }

    await withTransaction(async (tx) => {
      await tx.query("UPDATE purchase_orders SET status = 'cancelled' WHERE id = $1", [id]);
      await AuditService.log(
        { tableName: 'purchase_orders', recordId: id, action: 'cancel', userId, afterData: { number: po.number, status: 'cancelled' } },
        tx
      );
    });

    const updated = await this.getById(id);
    return updated!;
  }

  static async createBillFromPO(poId: number): Promise<any> {
    return await withTransaction(async (tx: PoolClient) => {
      const po = await this.getById(poId);
      if (!po) throw new Error(`Purchase order ${poId} not found`);

      // Resolve sequence number for Bill
      const billNumber = await SequenceService.nextDocNumber('BILL', tx);

      // Default Purchase Expense account
      const acctRes = await tx.query<{ id: number }>(
        "SELECT id FROM accounts WHERE name = 'Purchase Expense' AND is_archived = false LIMIT 1"
      );
      const defaultExpenseAcctId = acctRes.rows[0]?.id || 6;

      let subtotal = new Decimal(0);
      let taxTotal = new Decimal(0);
      let grandTotal = new Decimal(0);

      const billLinesData = [];
      for (let i = 0; i < po.lines.length; i++) {
        const line = po.lines[i];
        // Fetch product tax rate
        const prodRes = await tx.query<{ tax_rate: string }>(
          'SELECT tax_rate FROM products WHERE id = $1',
          [line.productId]
        );
        const taxRate = new Decimal(prodRes.rows[0]?.tax_rate || 0);
        const qty = new Decimal(line.qty);
        const unitPrice = new Decimal(line.unitPrice);
        const lineSubtotal = qty.times(unitPrice);
        const lineTax = lineSubtotal.times(taxRate).dividedBy(100);
        const lineTotal = lineSubtotal.plus(lineTax);

        subtotal = subtotal.plus(lineSubtotal);
        taxTotal = taxTotal.plus(lineTax);
        grandTotal = grandTotal.plus(lineTotal);

        billLinesData.push({
          lineNo: i + 1,
          productId: line.productId,
          accountId: defaultExpenseAcctId,
          analyticAccountId: line.analyticAccountId || null,
          qty: qty.toFixed(2),
          unitPrice: unitPrice.toFixed(2),
          taxRate: taxRate.toFixed(2),
          subtotal: lineSubtotal.toFixed(2),
          taxAmount: lineTax.toFixed(2),
          total: lineTotal.toFixed(2),
        });
      }

      const today = new Date().toISOString().split('T')[0];
      const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const billRes = await tx.query<{ id: number }>(
        `INSERT INTO vendor_bills 
          (number, bill_reference, po_id, vendor_id, bill_date, due_date, status, subtotal, tax_total, total)
         VALUES ($1, $2, $3, $4, $5, $6, 'draft', $7, $8, $9)
         RETURNING id`,
        [
          billNumber,
          `PO Ref: ${po.number}`,
          po.id,
          po.vendorId,
          today,
          dueDate,
          subtotal.toFixed(2),
          taxTotal.toFixed(2),
          grandTotal.toFixed(2),
        ]
      );

      const billId = billRes.rows[0].id;

      for (const bLine of billLinesData) {
        await tx.query(
          `INSERT INTO vendor_bill_lines 
            (bill_id, line_no, product_id, account_id, analytic_account_id, qty, unit_price, tax_rate, subtotal, tax_amount, total)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            billId,
            bLine.lineNo,
            bLine.productId,
            bLine.accountId,
            bLine.analyticAccountId,
            bLine.qty,
            bLine.unitPrice,
            bLine.taxRate,
            bLine.subtotal,
            bLine.taxAmount,
            bLine.total,
          ]
        );
      }

      return { billId, billNumber };
    });
  }
}
