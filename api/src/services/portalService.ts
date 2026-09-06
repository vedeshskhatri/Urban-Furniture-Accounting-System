import crypto from 'crypto';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import Decimal from 'decimal.js';
import { pool } from '../db/pool';
import { scopeFor, UserPayload } from './scope';
import { PaymentService } from './paymentService';

if (!process.env.JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable is required');
}
const JWT_SECRET: string = process.env.JWT_SECRET;

export interface InviteContactInput {
  contactId: number;
  email: string;
  fullName: string;
  loginId: string;
  password?: string;
}

export class PortalService {
  /**
   * Fetch contact user details if already invited/created
   */
  static async getContactUser(contactId: number) {
    const res = await pool.query(
      `SELECT id, login_id, email, full_name, role, invite_token, invite_token_expires_at, (password_hash IS NOT NULL) AS has_password
       FROM users
       WHERE contact_id = $1`,
      [contactId]
    );
    return res.rows[0] || null;
  }

  /**
   * Generates a secure invite token (or direct password user) for a contact.
   * Only admin/accountant can invite contacts. Contacts cannot self-signup.
   */
  static async inviteContact(input: InviteContactInput) {
    // 1. Validate contact exists
    const contactRes = await pool.query('SELECT id, name, type FROM contacts WHERE id = $1', [input.contactId]);
    if (contactRes.rows.length === 0) {
      throw new Error(`Contact #${input.contactId} not found`);
    }

    // 2. Validate loginId format (6-12 chars per DB constraint)
    if (input.loginId.length < 6 || input.loginId.length > 12) {
      throw new Error('Login ID must be between 6 and 12 characters long');
    }

    // Optional direct password hash
    let passwordHash: string | null = null;
    if (input.password && input.password.length >= 8) {
      passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    }

    // 3. Generate secure token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // 4. Check if user already exists for this contact
    const existing = await pool.query(
      'SELECT id, password_hash FROM users WHERE contact_id = $1 OR login_id = $2 OR email = $3',
      [input.contactId, input.loginId, input.email]
    );

    let userId: number;
    if (existing.rows.length > 0) {
      // Update existing record with new token
      userId = existing.rows[0].id;
      const finalHash = passwordHash || existing.rows[0].password_hash;
      await pool.query(
        `UPDATE users
         SET invite_token = $1,
             invite_token_expires_at = $2,
             role = 'contact',
             contact_id = $3,
             password_hash = $4
         WHERE id = $5`,
        [token, expiresAt, input.contactId, finalHash, userId]
      );
    } else {
      // Insert new contact user
      const userRes = await pool.query<{ id: number }>(
        `INSERT INTO users (login_id, email, full_name, password_hash, role, contact_id, invite_token, invite_token_expires_at)
         VALUES ($1, $2, $3, $4, 'contact', $5, $6, $7)
         RETURNING id`,
        [input.loginId, input.email, input.fullName, passwordHash, input.contactId, token, expiresAt]
      );
      userId = userRes.rows[0].id;
    }

    return {
      userId,
      contactId: input.contactId,
      loginId: input.loginId,
      email: input.email,
      inviteToken: token,
      inviteUrl: `/portal/accept-invite?token=${token}`,
      expiresAt: expiresAt.toISOString(),
      hasPassword: Boolean(passwordHash),
    };
  }

  /**
   * Contact sets their own password using the invite token.
   */
  static async acceptInvite(token: string, password: string) {
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    const userRes = await pool.query<{ id: number; login_id: string; invite_token_expires_at: string }>(
      `SELECT id, login_id, invite_token_expires_at
       FROM users
       WHERE invite_token = $1`,
      [token]
    );

    if (userRes.rows.length === 0) {
      throw new Error('Invalid or expired invitation token');
    }

    const user = userRes.rows[0];
    if (new Date(user.invite_token_expires_at) < new Date()) {
      throw new Error('Invitation token has expired. Please ask for a new invite.');
    }

    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
    });

    await pool.query(
      `UPDATE users
       SET password_hash = $1,
           invite_token = NULL,
           invite_token_expires_at = NULL
       WHERE id = $2`,
      [passwordHash, user.id]
    );

    return {
      success: true,
      loginId: user.login_id,
      message: 'Password created successfully. You may now log in to the portal.',
    };
  }

  /**
   * Portal login: contact users ONLY.
   */
  static async portalLogin(loginId: string, password: string) {
    const raw = (loginId || '').trim();
    const effectiveLoginId = raw === 'client' ? 'clientuf' : raw;
    const userRes = await pool.query<{
      id: number;
      login_id: string;
      email: string;
      full_name: string;
      password_hash: string | null;
      role: string;
      contact_id: number | null;
    }>(
      `SELECT id, login_id, email, full_name, password_hash, role, contact_id
       FROM users
       WHERE LOWER(login_id) = LOWER($1) OR LOWER(email) = LOWER($1)`,
      [effectiveLoginId]
    );

    const user = userRes.rows[0];
    if (!user || !user.password_hash) {
      throw new Error('Invalid Login Id or Password');
    }

    // Role check: Contact users only
    if (user.role !== 'contact' || !user.contact_id) {
      throw new Error('This portal is restricted to customer contacts only (e.g. clientuf). Internal staff (admin/accountant) must use the main app at /login.');
    }

    const valid = await argon2.verify(user.password_hash, password);
    if (!valid) {
      throw new Error('Invalid Login Id or Password');
    }

    const payload: UserPayload = {
      id: user.id,
      login_id: user.login_id,
      email: user.email,
      full_name: user.full_name,
      role: 'contact',
      contact_id: user.contact_id,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

    return {
      user: payload,
      token,
    };
  }

  /**
   * Fetch customer's own invoices via scopeFor() data-layer scoping
   */
  static async getPortalInvoices(user: UserPayload) {
    const scope = scopeFor(user, 'invoice');

    const res = await pool.query(
      `SELECT 
         ci.id,
         ci.number,
         ci.invoice_date AS "invoiceDate",
         ci.due_date AS "dueDate",
         ci.status,
         ci.so_id AS "soId",
         so.number AS "soNumber",
         vis.total::text,
         vis.amount_paid::text AS "amountPaid",
         vis.amount_due::text AS "amountDue",
         vis.payment_status AS "paymentStatus"
       FROM customer_invoices ci
       LEFT JOIN sales_orders so ON so.id = ci.so_id
       JOIN v_invoice_status vis ON vis.invoice_id = ci.id
       WHERE ci.customer_id = $1 AND ci.status != 'cancelled'
       ORDER BY ci.invoice_date DESC, ci.id DESC`,
      [scope.customerId]
    );

    return res.rows.map(r => ({
      ...r,
      invoiceDate: r.invoiceDate ? new Date(r.invoiceDate).toISOString().split('T')[0] : '',
      dueDate: r.dueDate ? new Date(r.dueDate).toISOString().split('T')[0] : '',
    }));
  }

  /**
   * Fetch specific invoice detail.
   * INJECTS customerId AT DATA LAYER. If customerId does not match, query returns 0 rows (null).
   */
  static async getPortalInvoiceById(invoiceId: number, user: UserPayload) {
    const scope = scopeFor(user, 'invoice');

    const invRes = await pool.query(
      `SELECT 
         ci.id,
         ci.number,
         ci.invoice_date AS "invoiceDate",
         ci.due_date AS "dueDate",
         ci.status,
         ci.so_id AS "soId",
         so.number AS "soNumber",
         ci.subtotal::text,
         ci.tax_total::text AS "taxTotal",
         vis.total::text,
         vis.amount_paid::text AS "amountPaid",
         vis.amount_due::text AS "amountDue",
         vis.payment_status AS "paymentStatus"
       FROM customer_invoices ci
       LEFT JOIN sales_orders so ON so.id = ci.so_id
       JOIN v_invoice_status vis ON vis.invoice_id = ci.id
       WHERE ci.id = $1 AND ci.customer_id = $2`,
      [invoiceId, scope.customerId]
    );

    if (invRes.rows.length === 0) {
      // Data-layer isolation: Record does not exist for this customer
      return null;
    }

    const inv = invRes.rows[0];

    // Fetch lines
    const linesRes = await pool.query(
      `SELECT 
         cil.line_no AS "lineNo",
         p.name AS "productName",
         cil.qty::text,
         cil.unit_price::text AS "unitPrice",
         cil.tax_rate::text AS "taxRate",
         cil.total::text
       FROM customer_invoice_lines cil
       JOIN products p ON p.id = cil.product_id
       WHERE cil.invoice_id = $1
       ORDER BY cil.line_no ASC`,
      [invoiceId]
    );

    // Fetch payment history
    const payments = await PaymentService.getInvoicePaymentHistory(invoiceId);

    return {
      id: inv.id,
      number: inv.number,
      invoiceDate: inv.invoiceDate ? new Date(inv.invoiceDate).toISOString().split('T')[0] : '',
      dueDate: inv.dueDate ? new Date(inv.dueDate).toISOString().split('T')[0] : '',
      status: inv.status,
      soId: inv.soId,
      soNumber: inv.soNumber,
      subtotal: inv.subtotal,
      taxTotal: inv.taxTotal,
      total: inv.total,
      amountPaid: inv.amountPaid,
      amountDue: inv.amountDue,
      paymentStatus: inv.paymentStatus,
      lines: linesRes.rows,
      payments,
    };
  }

  /**
   * Fetch customer's own sales orders via scopeFor() data-layer scoping
   */
  static async getPortalOrders(user: UserPayload) {
    const scope = scopeFor(user, 'sales_order');

    const res = await pool.query(
      `SELECT 
         so.id,
         so.number,
         so.order_date AS "orderDate",
         so.status,
         so.subtotal::text,
         so.tax_total::text AS "taxTotal",
         so.total::text,
         ci.id AS "invoiceId",
         ci.number AS "invoiceNumber",
         ci.status AS "invoiceStatus",
         vis.payment_status AS "paymentStatus",
         vis.amount_due::text AS "amountDue",
         (
           SELECT json_agg(json_build_object(
             'id', sol.id,
             'productId', sol.product_id,
             'productName', p.name,
             'sku', p.sku,
             'qty', sol.qty::text,
             'unitPrice', sol.unit_price::text,
             'taxRate', sol.tax_rate::text,
             'total', sol.total::text
           ) ORDER BY sol.line_no)
           FROM sales_order_lines sol
           JOIN products p ON p.id = sol.product_id
           WHERE sol.so_id = so.id
         ) AS lines
       FROM sales_orders so
       LEFT JOIN customer_invoices ci ON ci.so_id = so.id AND ci.status != 'cancelled'
       LEFT JOIN v_invoice_status vis ON vis.invoice_id = ci.id
       WHERE so.customer_id = $1
       ORDER BY so.order_date DESC, so.id DESC`,
      [scope.customerId]
    );

    return res.rows.map(r => ({
      ...r,
      orderDate: r.orderDate ? new Date(r.orderDate).toISOString().split('T')[0] : '',
      lines: r.lines || [],
    }));
  }

  /**
   * Fetch specific sales order detail for portal customer
   */
  static async getPortalOrderById(orderId: number, user: UserPayload) {
    const scope = scopeFor(user, 'sales_order');

    const res = await pool.query(
      `SELECT 
         so.id,
         so.number,
         so.order_date AS "orderDate",
         so.status,
         so.subtotal::text,
         so.tax_total::text AS "taxTotal",
         so.total::text,
         ci.id AS "invoiceId",
         ci.number AS "invoiceNumber",
         ci.status AS "invoiceStatus",
         vis.payment_status AS "paymentStatus",
         vis.amount_due::text AS "amountDue",
         (
           SELECT json_agg(json_build_object(
             'id', sol.id,
             'productId', sol.product_id,
             'productName', p.name,
             'sku', p.sku,
             'qty', sol.qty::text,
             'unitPrice', sol.unit_price::text,
             'taxRate', sol.tax_rate::text,
             'total', sol.total::text
           ) ORDER BY sol.line_no)
           FROM sales_order_lines sol
           JOIN products p ON p.id = sol.product_id
           WHERE sol.so_id = so.id
         ) AS lines
       FROM sales_orders so
       LEFT JOIN customer_invoices ci ON ci.so_id = so.id AND ci.status != 'cancelled'
       LEFT JOIN v_invoice_status vis ON vis.invoice_id = ci.id
       WHERE so.id = $1 AND so.customer_id = $2`,
      [orderId, scope.customerId]
    );

    if (res.rows.length === 0) {
      return null;
    }

    const r = res.rows[0];
    return {
      ...r,
      orderDate: r.orderDate ? new Date(r.orderDate).toISOString().split('T')[0] : '',
      lines: r.lines || [],
    };
  }

  /**
   * Record manual payment against invoice from the customer portal
   */
  static async recordPortalPayment(
    invoiceId: number,
    user: UserPayload,
    method: 'cash' | 'bank',
    amount: string | number
  ) {
    const scope = scopeFor(user, 'invoice');

    // Verify invoice belongs to this contact at data layer
    const invRes = await pool.query<{ id: number; amount_due: string; status: string }>(
      `SELECT ci.id, vis.amount_due, ci.status
       FROM customer_invoices ci
       JOIN v_invoice_status vis ON vis.invoice_id = ci.id
       WHERE ci.id = $1 AND ci.customer_id = $2`,
      [invoiceId, scope.customerId]
    );

    if (invRes.rows.length === 0) {
      throw new Error('Invoice not found or unauthorized');
    }

    // If invoice is in draft, confirm and post it first so payment allocation succeeds cleanly
    if (invRes.rows[0].status === 'draft') {
      const { InvoiceService } = await import('./invoiceService');
      await InvoiceService.confirmInvoice(invoiceId, user.id);
    }

    const due = new Decimal(invRes.rows[0].amount_due);
    const payAmt = new Decimal(amount);

    if (payAmt.lte(0)) {
      throw new Error('Payment amount must be greater than zero');
    }

    if (payAmt.gt(due)) {
      throw new Error(`Cannot pay ${payAmt.toFixed(2)}. Current amount due is ${due.toFixed(2)}`);
    }

    return PaymentService.createPayment(
      {
        direction: 'inbound',
        partnerId: scope.customerId,
        method,
        amount: payAmt.toFixed(2),
        allocations: [
          {
            invoiceId,
            amount: payAmt.toFixed(2),
          },
        ],
      },
      user.id
    );
  }

  /**
   * Fetch vendor's own bills via contact_id
   */
  static async getPortalBills(user: UserPayload) {
    const contactId = user.contact_id || -1;

    const res = await pool.query(
      `SELECT 
         vb.id,
         vb.number,
         vb.bill_reference AS "billReference",
         vb.bill_date AS "billDate",
         vb.due_date AS "dueDate",
         vbs.total::text,
         vbs.amount_paid::text AS "amountPaid",
         vbs.amount_due::text AS "amountDue",
         vbs.payment_status AS "paymentStatus"
       FROM vendor_bills vb
       JOIN v_bill_status vbs ON vbs.bill_id = vb.id
       WHERE vb.vendor_id = $1 AND vb.status = 'confirmed'
       ORDER BY vb.bill_date DESC, vb.id DESC`,
      [contactId]
    );

    return res.rows.map(r => ({
      ...r,
      billDate: r.billDate ? new Date(r.billDate).toISOString().split('T')[0] : '',
      dueDate: r.dueDate ? new Date(r.dueDate).toISOString().split('T')[0] : '',
    }));
  }

  /**
   * Fetch specific vendor bill detail with lines and payment history
   */
  static async getPortalBillById(billId: number, user: UserPayload) {
    const contactId = user.contact_id || -1;

    const billRes = await pool.query(
      `SELECT 
         vb.id,
         vb.number,
         vb.bill_reference AS "billReference",
         vb.bill_date AS "billDate",
         vb.due_date AS "dueDate",
         vb.subtotal::text,
         vb.tax_total::text AS "taxTotal",
         vbs.total::text,
         vbs.amount_paid::text AS "amountPaid",
         vbs.amount_due::text AS "amountDue",
         vbs.payment_status AS "paymentStatus"
       FROM vendor_bills vb
       JOIN v_bill_status vbs ON vbs.bill_id = vb.id
       WHERE vb.id = $1 AND vb.vendor_id = $2`,
      [billId, contactId]
    );

    if (billRes.rows.length === 0) {
      return null;
    }

    const bill = billRes.rows[0];

    const linesRes = await pool.query(
      `SELECT 
         vbl.line_no AS "lineNo",
         p.name AS "productName",
         vbl.qty::text,
         vbl.unit_price::text AS "unitPrice",
         vbl.tax_rate::text AS "taxRate",
         vbl.total::text
       FROM vendor_bill_lines vbl
       JOIN products p ON p.id = vbl.product_id
       WHERE vbl.bill_id = $1
       ORDER BY vbl.line_no ASC`,
      [billId]
    );

    const paymentsRes = await pool.query(
      `SELECT 
         pa.id AS "allocationId",
         p.number AS "paymentNumber",
         p.payment_date AS "paymentDate",
         p.method,
         p.direction,
         pa.amount::text
       FROM payment_allocations pa
       JOIN payments p ON p.id = pa.payment_id
       WHERE pa.bill_id = $1
       ORDER BY p.payment_date DESC, pa.id DESC`,
      [billId]
    );

    const payments = paymentsRes.rows.map(p => ({
      ...p,
      paymentDate: p.paymentDate ? new Date(p.paymentDate).toISOString().split('T')[0] : '',
    }));

    return {
      id: bill.id,
      number: bill.number,
      billReference: bill.billReference,
      billDate: bill.billDate ? new Date(bill.billDate).toISOString().split('T')[0] : '',
      dueDate: bill.dueDate ? new Date(bill.dueDate).toISOString().split('T')[0] : '',
      subtotal: bill.subtotal,
      taxTotal: bill.taxTotal,
      total: bill.total,
      amountPaid: bill.amountPaid,
      amountDue: bill.amountDue,
      paymentStatus: bill.paymentStatus,
      lines: linesRes.rows,
      payments,
    };
  }

  /**
   * Record manual payment against vendor bill from portal
   */
  static async recordPortalBillPayment(
    billId: number,
    user: UserPayload,
    method: 'cash' | 'bank',
    amount: string | number
  ) {
    const contactId = user.contact_id || -1;

    const billRes = await pool.query(
      `SELECT vb.id, vbs.amount_due
       FROM vendor_bills vb
       JOIN v_bill_status vbs ON vbs.bill_id = vb.id
       WHERE vb.id = $1 AND vb.vendor_id = $2`,
      [billId, contactId]
    );

    if (billRes.rows.length === 0) {
      throw new Error('Bill not found or unauthorized');
    }

    const due = new Decimal(billRes.rows[0].amount_due);
    const payAmt = new Decimal(amount);

    if (payAmt.lte(0)) {
      throw new Error('Payment amount must be greater than zero');
    }

    if (payAmt.gt(due)) {
      throw new Error(`Cannot pay ${payAmt.toFixed(2)}. Current amount due is ${due.toFixed(2)}`);
    }

    return PaymentService.createPayment(
      {
        direction: 'outbound',
        partnerId: contactId,
        method,
        amount: payAmt.toFixed(2),
        allocations: [
          {
            billId,
            amount: payAmt.toFixed(2),
          },
        ],
      },
      user.id
    );
  }

  /**
   * Fetch customer's own payments / transaction logs via contact_id
   */
  static async getPortalPayments(user: UserPayload) {
    const contactId = user.contact_id || -1;

    const res = await pool.query(
      `SELECT 
         p.id,
         p.number,
         p.payment_date AS "paymentDate",
         p.method,
         p.direction,
         p.amount::text,
         p.created_at AS "createdAt",
         COALESCE(
           json_agg(
             json_build_object(
               'allocationId', pa.id,
               'invoiceId', pa.invoice_id,
               'invoiceNumber', ci.number,
               'billId', pa.bill_id,
               'billNumber', vb.number,
               'amount', pa.amount::text
             )
           ) FILTER (WHERE pa.id IS NOT NULL),
           '[]'::json
         ) AS allocations
       FROM payments p
       LEFT JOIN payment_allocations pa ON pa.payment_id = p.id
       LEFT JOIN customer_invoices ci ON ci.id = pa.invoice_id
       LEFT JOIN vendor_bills vb ON vb.id = pa.bill_id
       WHERE p.partner_id = $1
       GROUP BY p.id
       ORDER BY p.payment_date DESC, p.id DESC`,
      [contactId]
    );

    return res.rows.map(r => ({
      ...r,
      paymentDate: r.paymentDate ? new Date(r.paymentDate).toISOString().split('T')[0] : '',
    }));
  }
}
