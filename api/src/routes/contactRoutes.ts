import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../db/pool';
import { withTransaction } from '../db/withTransaction';
import { sendSuccess, sendError } from '../utils/response';
import { UserPayload } from '../services/scope';
import { AuthenticatedRequest } from '../middleware/auth';
import { AuditService } from '../services/auditService';
import Decimal from 'decimal.js';

const uid = (req: Request) => (req as AuthenticatedRequest).user?.id;

export const contactRouter = Router();
if (!process.env.JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable is required');
}
const JWT_SECRET: string = process.env.JWT_SECRET;

// Helper to check portal barrier
function checkPortalAccess(req: Request, res: Response): boolean {
  const token = req.cookies?.token || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as unknown as UserPayload;
      if (decoded.role === 'contact') {
        sendError(
          res,
          'FORBIDDEN',
          'Access denied: Customer portal contacts cannot access internal contacts directory',
          403
        );
        return false;
      }
    } catch {
      // Invalid token
    }
  }
  return true;
}

// GET /api/contacts - Lists contacts, strictly blocks portal contact users with 403
contactRouter.get('/', async (req: Request, res: Response) => {
  if (!checkPortalAccess(req, res)) return;

  try {
    const type = req.query.type as string | undefined;
    const includeArchived = req.query.includeArchived === 'true';

    let query = 'SELECT id, name, type, email, mobile, address, city, state, pincode, gstin, image_path, is_archived, created_at, updated_at FROM contacts WHERE 1=1';
    const params: any[] = [];

    if (!includeArchived) {
      query += ' AND is_archived = false';
    }
    if (type) {
      params.push(type);
      query += ` AND (type = $${params.length} OR type = 'both')`;
    }
    query += ' ORDER BY name ASC';

    const result = await pool.query(query, params);
    return sendSuccess(res, result.rows);
  } catch (err: any) {
    return sendError(res, 'SERVER_ERROR', err.message, 500);
  }
});

// GET /api/contacts/:id
contactRouter.get('/:id', async (req: Request, res: Response) => {
  if (!checkPortalAccess(req, res)) return;

  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return sendError(res, 'INVALID_ID', 'ID must be an integer');

    const result = await pool.query('SELECT * FROM contacts WHERE id = $1', [id]);
    if (result.rows.length === 0) return sendError(res, 'NOT_FOUND', 'Contact not found', 404);

    return sendSuccess(res, result.rows[0]);
  } catch (err: any) {
    return sendError(res, 'SERVER_ERROR', err.message, 500);
  }
});

// POST /api/contacts
contactRouter.post('/', async (req: Request, res: Response) => {
  if (!checkPortalAccess(req, res)) return;

  try {
    const b = req.body;
    const row = await withTransaction(async (tx) => {
      const result = await tx.query(
        `INSERT INTO contacts
          (name, type, email, mobile, address, city, state, pincode, gstin, image_path)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          b.name,
          b.type || 'customer',
          b.email || null,
          b.mobile || null,
          b.address || null,
          b.city || null,
          b.state || null,
          b.pincode || null,
          b.gstin || null,
          b.image_path || null,
        ]
      );
      await AuditService.log(
        { tableName: 'contacts', recordId: result.rows[0].id, action: 'create', userId: uid(req), afterData: result.rows[0] },
        tx
      );
      return result.rows[0];
    });
    return sendSuccess(res, row, 201);
  } catch (err: any) {
    return sendError(res, 'CREATE_FAILED', err.message, 400);
  }
});

// POST /api/contacts/:id/image
contactRouter.post('/:id/image', async (req: Request, res: Response) => {
  if (!checkPortalAccess(req, res)) return;

  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return sendError(res, 'INVALID_ID', 'ID must be an integer');

    const imagePath = req.body.image_path || req.body.image || null;
    const row = await withTransaction(async (tx) => {
      const result = await tx.query(
        'UPDATE contacts SET image_path = $1, updated_at = now() WHERE id = $2 RETURNING *',
        [imagePath, id]
      );
      if (result.rows.length === 0) return null;
      await AuditService.log(
        { tableName: 'contacts', recordId: id, action: 'update', userId: uid(req), afterData: { image_path: imagePath } },
        tx
      );
      return result.rows[0];
    });

    if (!row) return sendError(res, 'NOT_FOUND', 'Contact not found', 404);
    return sendSuccess(res, row);
  } catch (err: any) {
    return sendError(res, 'IMAGE_UPLOAD_FAILED', err.message, 500);
  }
});

// PUT /api/contacts/:id
contactRouter.put('/:id', async (req: Request, res: Response) => {
  if (!checkPortalAccess(req, res)) return;

  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return sendError(res, 'INVALID_ID', 'ID must be an integer');

    const b = req.body;
    const fields: string[] = [];
    const values: any[] = [];

    const keys = ['name', 'type', 'email', 'mobile', 'address', 'city', 'state', 'pincode', 'gstin', 'image_path'];
    for (const k of keys) {
      if (b[k] !== undefined) {
        values.push(b[k]);
        fields.push(`${k} = $${values.length}`);
      }
    }

    if (fields.length === 0) {
      const existing = await pool.query('SELECT * FROM contacts WHERE id = $1', [id]);
      return sendSuccess(res, existing.rows[0] || null);
    }

    fields.push('updated_at = now()');
    values.push(id);

    const row = await withTransaction(async (tx) => {
      const before = (await tx.query('SELECT * FROM contacts WHERE id = $1', [id])).rows[0] || null;
      const result = await tx.query(
        `UPDATE contacts SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`,
        values
      );
      if (result.rows.length === 0) return null;
      await AuditService.log(
        { tableName: 'contacts', recordId: id, action: 'update', userId: uid(req), beforeData: before, afterData: result.rows[0] },
        tx
      );
      return result.rows[0];
    });

    if (!row) return sendError(res, 'NOT_FOUND', 'Contact not found', 404);
    return sendSuccess(res, row);
  } catch (err: any) {
    return sendError(res, 'UPDATE_FAILED', err.message, 400);
  }
});

// PATCH /api/contacts/:id/archive
contactRouter.patch('/:id/archive', async (req: Request, res: Response) => {
  if (!checkPortalAccess(req, res)) return;

  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return sendError(res, 'INVALID_ID', 'ID must be an integer');

    const isArchived = req.body.is_archived !== undefined ? Boolean(req.body.is_archived) : true;
    const row = await withTransaction(async (tx) => {
      const result = await tx.query(
        'UPDATE contacts SET is_archived = $1, updated_at = now() WHERE id = $2 RETURNING *',
        [isArchived, id]
      );
      if (result.rows.length === 0) return null;
      await AuditService.log(
        { tableName: 'contacts', recordId: id, action: 'archive', userId: uid(req), afterData: { is_archived: isArchived } },
        tx
      );
      return result.rows[0];
    });

    if (!row) return sendError(res, 'NOT_FOUND', 'Contact not found', 404);
    return sendSuccess(res, row);
  } catch (err: any) {
    return sendError(res, 'ARCHIVE_FAILED', err.message, 500);
  }
});

// GET /api/contacts/:id/smart-counts
contactRouter.get('/:id/smart-counts', async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return sendError(res, 'INVALID_ID', 'ID must be an integer');

    const poRes = await pool.query('SELECT COUNT(*) FROM purchase_orders WHERE vendor_id = $1', [id]);
    const billRes = await pool.query('SELECT COUNT(*) FROM vendor_bills WHERE vendor_id = $1', [id]);
    const soRes = await pool.query('SELECT COUNT(*) FROM sales_orders WHERE customer_id = $1', [id]);
    const invRes = await pool.query('SELECT COUNT(*) FROM customer_invoices WHERE customer_id = $1', [id]);

    return sendSuccess(res, {
      poCount: parseInt(poRes.rows[0].count, 10),
      billCount: parseInt(billRes.rows[0].count, 10),
      soCount: parseInt(soRes.rows[0].count, 10),
      invoiceCount: parseInt(invRes.rows[0].count, 10),
    });
  } catch (err: any) {
    return sendError(res, 'FETCH_FAILED', err.message, 500);
  }
});

// GET /api/contacts/:id/statement
contactRouter.get('/:id/statement', async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) return sendError(res, 'INVALID_ID', 'ID must be an integer');

    const contactRes = await pool.query('SELECT * FROM contacts WHERE id = $1', [id]);
    if (contactRes.rows.length === 0) return sendError(res, 'NOT_FOUND', 'Contact not found', 404);
    const contact = contactRes.rows[0];

    // For vendors: vendor bills (debit/payable) and payments (credit)
    const billsRes = await pool.query(
      `SELECT id, number, bill_date AS date, total, status 
       FROM vendor_bills 
       WHERE vendor_id = $1 AND status = 'confirmed' 
       ORDER BY bill_date ASC`,
      [id]
    );

    const paymentsRes = await pool.query(
      `SELECT id, number, payment_date AS date, amount 
       FROM payments 
       WHERE partner_id = $1 AND direction = 'outbound' 
       ORDER BY payment_date ASC`,
      [id]
    );

    interface StatementRow {
      date: string;
      doc_number: string;
      type: 'bill' | 'payment';
      debit: string;
      credit: string;
      running_balance: string;
    }

    const events: Array<{ date: string; docNumber: string; type: 'bill' | 'payment'; amount: string }> = [];
    for (const b of billsRes.rows) {
      events.push({
        date: b.date instanceof Date ? b.date.toISOString().split('T')[0] : String(b.date),
        docNumber: b.number,
        type: 'bill',
        amount: String(b.total),
      });
    }
    for (const p of paymentsRes.rows) {
      events.push({
        date: p.date instanceof Date ? p.date.toISOString().split('T')[0] : String(p.date),
        docNumber: p.number,
        type: 'payment',
        amount: String(p.amount),
      });
    }

    events.sort((a, b) => a.date.localeCompare(b.date));

    let running = new Decimal(0);
    let totalBilled = new Decimal(0);
    let totalPaid = new Decimal(0);

    const statementLines: StatementRow[] = [];
    for (const ev of events) {
      const amt = new Decimal(ev.amount);
      let debit = '0.00';
      let credit = '0.00';

      if (ev.type === 'bill') {
        debit = amt.toFixed(2);
        running = running.plus(amt);
        totalBilled = totalBilled.plus(amt);
      } else {
        credit = amt.toFixed(2);
        running = running.minus(amt);
        totalPaid = totalPaid.plus(amt);
      }

      statementLines.push({
        date: ev.date,
        doc_number: ev.docNumber,
        type: ev.type,
        debit,
        credit,
        running_balance: running.toFixed(2),
      });
    }

    return sendSuccess(res, {
      contact: {
        id: contact.id,
        name: contact.name,
        email: contact.email,
        mobile: contact.mobile,
      },
      total_billed: totalBilled.toFixed(2),
      total_paid: totalPaid.toFixed(2),
      closing_balance: running.toFixed(2),
      lines: statementLines,
    });
  } catch (err: any) {
    return sendError(res, 'FETCH_FAILED', err.message, 500);
  }
});
