import { PoolClient } from 'pg';
import { pool } from '../db/pool';
import { withTransaction } from '../db/withTransaction';
import { SequenceService } from './sequenceService';
import { PostingService } from './postingService';
import { AuditService } from './auditService';
import Decimal from 'decimal.js';

export interface BillLineInput {
  productId: number;
  accountId?: number;
  analyticAccountId?: number | null;
  qty: string | number;
  unitPrice: string | number;
  taxRate?: string | number;
}

export interface CreateBillInput {
  vendorId: number;
  billReference?: string;
  poId?: number | null;
  billDate?: string;
  dueDate?: string;
  lines: BillLineInput[];
}

export interface BillLineDTO {
  id: number;
  billId: number;
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

export interface VendorBillDTO {
  id: number;
  number: string;
  billReference: string | null;
  poId: number | null;
  vendorId: number;
  vendorName?: string;
  billDate: string;
  dueDate: string | null;
  status: 'draft' | 'confirmed' | 'cancelled';
  subtotal: string;
  taxTotal: string;
  total: string;
  amountPaid: string;
  amountDue: string;
  paymentStatus: 'paid' | 'partial' | 'not_paid';
  journalEntryId: number | null;
  lines: BillLineDTO[];
  createdAt: string;
}

export class VendorBillService {
  static async getAll(): Promise<VendorBillDTO[]> {
    const res = await pool.query(`
      SELECT vb.id, vb.number, vb.bill_reference, vb.po_id, vb.vendor_id, vb.bill_date, vb.due_date,
             vb.status, vb.subtotal, vb.tax_total, vb.total, vb.journal_entry_id, vb.created_at,
             c.name AS vendor_name,
             COALESCE(vbs.amount_paid, 0)::TEXT AS amount_paid,
             COALESCE(vbs.amount_due, vb.total)::TEXT AS amount_due,
             COALESCE(vbs.payment_status, 'not_paid') AS payment_status
      FROM vendor_bills vb
      JOIN contacts c ON vb.vendor_id = c.id
      LEFT JOIN v_bill_status vbs ON vb.id = vbs.bill_id
      ORDER BY vb.bill_date DESC, vb.id DESC
    `);

    const bills = res.rows;
    if (bills.length === 0) return [];

    const billIds = bills.map(b => b.id);
    const linesRes = await pool.query(`
      SELECT vbl.id, vbl.bill_id, vbl.line_no, vbl.product_id, vbl.account_id, vbl.analytic_account_id,
             vbl.qty, vbl.unit_price, vbl.tax_rate, vbl.subtotal, vbl.tax_amount, vbl.total,
             p.name AS product_name, p.sku AS product_sku,
             a.name AS account_name,
             aa.name AS analytic_account_name
      FROM vendor_bill_lines vbl
      JOIN products p ON vbl.product_id = p.id
      JOIN accounts a ON vbl.account_id = a.id
      LEFT JOIN analytic_accounts aa ON vbl.analytic_account_id = aa.id
      WHERE vbl.bill_id = ANY($1)
      ORDER BY vbl.line_no ASC
    `, [billIds]);

    const linesByBill: Record<number, BillLineDTO[]> = {};
    for (const l of linesRes.rows) {
      if (!linesByBill[l.bill_id]) linesByBill[l.bill_id] = [];
      linesByBill[l.bill_id].push({
        id: l.id,
        billId: l.bill_id,
        bill_id: l.bill_id,
        lineNo: l.line_no,
        sr_no: l.line_no,
        productId: l.product_id,
        product_id: l.product_id,
        productName: l.product_name,
        product_name: l.product_name,
        productSku: l.product_sku,
        accountId: l.account_id,
        account_id: l.account_id,
        accountName: l.account_name,
        account_name: l.account_name,
        analyticAccountId: l.analytic_account_id,
        analytic_account_id: l.analytic_account_id,
        analyticAccountName: l.analytic_account_name,
        analytic_account_name: l.analytic_account_name,
        qty: String(l.qty),
        unitPrice: String(l.unit_price),
        unit_price: String(l.unit_price),
        taxRate: String(l.tax_rate),
        tax_rate: String(l.tax_rate),
        subtotal: String(l.subtotal),
        taxAmount: String(l.tax_amount),
        tax_amount: String(l.tax_amount),
        total: String(l.total),
      } as any);
    }

    return bills.map(b => {
      const billDate = b.bill_date instanceof Date ? b.bill_date.toISOString().split('T')[0] : String(b.bill_date);
      const dueDate = b.due_date instanceof Date ? b.due_date.toISOString().split('T')[0] : (b.due_date ? String(b.due_date) : null);
      return {
        id: b.id,
        number: b.number,
        billReference: b.bill_reference,
        bill_reference: b.bill_reference,
        poId: b.po_id,
        po_id: b.po_id,
        vendorId: b.vendor_id,
        vendor_id: b.vendor_id,
        vendorName: b.vendor_name,
        vendor_name: b.vendor_name,
        billDate,
        bill_date: billDate,
        dueDate,
        due_date: dueDate,
        status: b.status,
        subtotal: String(b.subtotal),
        taxTotal: String(b.tax_total),
        tax_total: String(b.tax_total),
        total: String(b.total),
        total_amount: String(b.total),
        grand_total: String(b.total),
        amountPaid: String(b.amount_paid),
        amount_paid: String(b.amount_paid),
        amountDue: String(b.amount_due),
        amount_due: String(b.amount_due),
        paymentStatus: b.payment_status,
        payment_status: b.payment_status,
        journalEntryId: b.journal_entry_id,
        journal_entry_id: b.journal_entry_id,
        lines: linesByBill[b.id] || [],
        createdAt: b.created_at,
        created_at: b.created_at,
      };
    }) as any;
  }

  static async getById(id: number): Promise<VendorBillDTO | null> {
    const res = await pool.query(`
      SELECT vb.id, vb.number, vb.bill_reference, vb.po_id, vb.vendor_id, vb.bill_date, vb.due_date,
             vb.status, vb.subtotal, vb.tax_total, vb.total, vb.journal_entry_id, vb.created_at,
             c.name AS vendor_name,
             COALESCE(vbs.amount_paid, 0)::TEXT AS amount_paid,
             COALESCE(vbs.amount_due, vb.total)::TEXT AS amount_due,
             COALESCE(vbs.payment_status, 'not_paid') AS payment_status
      FROM vendor_bills vb
      JOIN contacts c ON vb.vendor_id = c.id
      LEFT JOIN v_bill_status vbs ON vb.id = vbs.bill_id
      WHERE vb.id = $1
    `, [id]);

    if (res.rows.length === 0) return null;
    const b = res.rows[0];

    const linesRes = await pool.query(`
      SELECT vbl.id, vbl.bill_id, vbl.line_no, vbl.product_id, vbl.account_id, vbl.analytic_account_id,
             vbl.qty, vbl.unit_price, vbl.tax_rate, vbl.subtotal, vbl.tax_amount, vbl.total,
             p.name AS product_name, p.sku AS product_sku,
             a.name AS account_name,
             aa.name AS analytic_account_name
      FROM vendor_bill_lines vbl
      JOIN products p ON vbl.product_id = p.id
      JOIN accounts a ON vbl.account_id = a.id
      LEFT JOIN analytic_accounts aa ON vbl.analytic_account_id = aa.id
      WHERE vbl.bill_id = $1
      ORDER BY vbl.line_no ASC
    `, [id]);

    const lines: BillLineDTO[] = linesRes.rows.map(l => ({
      id: l.id,
      billId: l.bill_id,
      bill_id: l.bill_id,
      lineNo: l.line_no,
      sr_no: l.line_no,
      productId: l.product_id,
      product_id: l.product_id,
      productName: l.product_name,
      product_name: l.product_name,
      productSku: l.product_sku,
      accountId: l.account_id,
      account_id: l.account_id,
      accountName: l.account_name,
      account_name: l.account_name,
      analyticAccountId: l.analytic_account_id,
      analytic_account_id: l.analytic_account_id,
      analyticAccountName: l.analytic_account_name,
      analytic_account_name: l.analytic_account_name,
      qty: String(l.qty),
      unitPrice: String(l.unit_price),
      unit_price: String(l.unit_price),
      taxRate: String(l.tax_rate),
      tax_rate: String(l.tax_rate),
      subtotal: String(l.subtotal),
      taxAmount: String(l.tax_amount),
      tax_amount: String(l.tax_amount),
      total: String(l.total),
    }) as any);

    const billDate = b.bill_date instanceof Date ? b.bill_date.toISOString().split('T')[0] : String(b.bill_date);
    const dueDate = b.due_date instanceof Date ? b.due_date.toISOString().split('T')[0] : (b.due_date ? String(b.due_date) : null);
    return {
      id: b.id,
      number: b.number,
      billReference: b.bill_reference,
      bill_reference: b.bill_reference,
      poId: b.po_id,
      po_id: b.po_id,
      vendorId: b.vendor_id,
      vendor_id: b.vendor_id,
      vendorName: b.vendor_name,
      vendor_name: b.vendor_name,
      billDate,
      bill_date: billDate,
      dueDate,
      due_date: dueDate,
      status: b.status,
      subtotal: String(b.subtotal),
      taxTotal: String(b.tax_total),
      tax_total: String(b.tax_total),
      total: String(b.total),
      total_amount: String(b.total),
      grand_total: String(b.total),
      amountPaid: String(b.amount_paid),
      amount_paid: String(b.amount_paid),
      amountDue: String(b.amount_due),
      amount_due: String(b.amount_due),
      paymentStatus: b.payment_status,
      payment_status: b.payment_status,
      journalEntryId: b.journal_entry_id,
      journal_entry_id: b.journal_entry_id,
      lines,
      createdAt: b.created_at,
      created_at: b.created_at,
    } as any;
  }

  static async create(input: CreateBillInput, userId?: number): Promise<VendorBillDTO> {
    const createdBillId = await withTransaction(async (tx: PoolClient) => {

      const billNumber = await SequenceService.nextDocNumber('BILL', tx);
      const billDate = input.billDate || new Date().toISOString().split('T')[0];
      const dueDate = input.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // Default Purchase Expense account
      const acctRes = await tx.query<{ id: number }>(
        "SELECT id FROM accounts WHERE name = 'Purchase Expense' AND is_archived = false LIMIT 1"
      );
      const defaultExpenseAcctId = acctRes.rows[0]?.id || 6;

      let subtotal = new Decimal(0);
      let taxTotal = new Decimal(0);
      let grandTotal = new Decimal(0);

      const computedLines = [];
      for (let i = 0; i < input.lines.length; i++) {
        const line = input.lines[i];
        const prodRes = await tx.query<{ tax_rate: string }>(
          'SELECT tax_rate FROM products WHERE id = $1',
          [line.productId]
        );
        const taxRate = new Decimal(line.taxRate !== undefined ? line.taxRate : (prodRes.rows[0]?.tax_rate || 0));
        const qty = new Decimal(line.qty);
        const unitPrice = new Decimal(line.unitPrice);
        const lineSubtotal = qty.times(unitPrice);
        const lineTax = lineSubtotal.times(taxRate).dividedBy(100);
        const lineTotal = lineSubtotal.plus(lineTax);

        subtotal = subtotal.plus(lineSubtotal);
        taxTotal = taxTotal.plus(lineTax);
        grandTotal = grandTotal.plus(lineTotal);

        computedLines.push({
          lineNo: i + 1,
          productId: line.productId,
          accountId: line.accountId || defaultExpenseAcctId,
          analyticAccountId: line.analyticAccountId || null,
          qty: qty.toFixed(2),
          unitPrice: unitPrice.toFixed(2),
          taxRate: taxRate.toFixed(2),
          subtotal: lineSubtotal.toFixed(2),
          taxAmount: lineTax.toFixed(2),
          total: lineTotal.toFixed(2),
        });
      }

      const billRes = await tx.query<{ id: number }>(
        `INSERT INTO vendor_bills 
          (number, bill_reference, po_id, vendor_id, bill_date, due_date, status, subtotal, tax_total, total)
         VALUES ($1, $2, $3, $4, $5, $6, 'draft', $7, $8, $9)
         RETURNING id`,
        [
          billNumber,
          input.billReference || null,
          input.poId || null,
          input.vendorId,
          billDate,
          dueDate,
          subtotal.toFixed(2),
          taxTotal.toFixed(2),
          grandTotal.toFixed(2),
        ]
      );

      const billId = billRes.rows[0].id;

      for (const line of computedLines) {
        await tx.query(
          `INSERT INTO vendor_bill_lines 
            (bill_id, line_no, product_id, account_id, analytic_account_id, qty, unit_price, tax_rate, subtotal, tax_amount, total)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            billId,
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
      await AuditService.log(
        { tableName: 'vendor_bills', recordId: billId, action: 'create', userId, afterData: { number: billNumber, vendorId: input.vendorId, total: grandTotal.toFixed(2) } },
        tx
      );
      return billId;
    });

    const created = await this.getById(createdBillId);

    return created!;
  }


  static async confirm(id: number, userId?: number): Promise<{ bill: VendorBillDTO; warning?: string }> {
    const warning = await withTransaction(async (tx: PoolClient) => {
      const bill = await this.getById(id);
      if (!bill) throw new Error(`Vendor bill ${id} not found`);
      if (bill.status !== 'draft') throw new Error(`Bill #${bill.number} is already ${bill.status}`);

      // Check budget overrun warning (non-blocking)
      let budgetWarning: string | undefined;
      for (const line of bill.lines) {
        if (line.analyticAccountId) {
          const budgetRes = await tx.query<{ committed_amount: string; achieved_amount: string }>(
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
              budgetWarning = `Budget warning: Analytic account #${line.analyticAccountId} exceeded (Committed: ₹${committed.toFixed(2)}, Projected: ₹${projected.toFixed(2)})`;
              break;
            }
          }
        }
      }

      // Post to ledger strictly via PostingService.postDocument('bill', id, tx)
      const postResult = await PostingService.postDocument('bill', id, tx);

      // Create stock moves for goods products (+qty on vendor bill)
      for (const line of bill.lines) {
        const prodRes = await tx.query<{ type: string }>(
          'SELECT type FROM products WHERE id = $1',
          [line.productId]
        );
        if (prodRes.rows[0]?.type === 'goods') {
          await tx.query(
            `INSERT INTO stock_moves 
              (product_id, qty_change, source_type, source_id)
             VALUES ($1, $2, 'bill', $3)`,
            [line.productId, line.qty, bill.id]
          );
          await tx.query(
            `UPDATE products SET stock_qty = stock_qty + $1 WHERE id = $2`,
            [line.qty, line.productId]
          );
        }
      }

      // Update bill status and journal_entry_id
      await tx.query(
        "UPDATE vendor_bills SET status = 'confirmed', journal_entry_id = $1 WHERE id = $2",
        [postResult.entryId, id]
      );

      await AuditService.log(
        { tableName: 'vendor_bills', recordId: id, action: 'confirm', userId, afterData: { number: bill.number, status: 'confirmed', journalEntryId: postResult.entryId } },
        tx
      );

      return budgetWarning;
    });

    const updated = await this.getById(id);
    return { bill: updated!, warning };
  }


  static async cancel(id: number, userId?: number): Promise<VendorBillDTO> {
    const bill = await this.getById(id);
    if (!bill) throw new Error(`Vendor bill ${id} not found`);
    if (bill.status === 'confirmed') {
      throw new Error(`Cannot cancel confirmed Vendor Bill #${bill.number}. Use an accounting reversal.`);
    }

    await withTransaction(async (tx) => {
      await tx.query("UPDATE vendor_bills SET status = 'cancelled' WHERE id = $1", [id]);
      await AuditService.log(
        { tableName: 'vendor_bills', recordId: id, action: 'cancel', userId, afterData: { number: bill.number, status: 'cancelled' } },
        tx
      );
    });

    const updated = await this.getById(id);
    return updated!;
  }
}
