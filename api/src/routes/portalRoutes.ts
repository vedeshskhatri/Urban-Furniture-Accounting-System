import fs from 'fs';
import path from 'path';
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { PortalService } from '../services/portalService';
import { requireAuth, requireInternalUser, requirePortalContact, AuthenticatedRequest } from '../middleware/auth';
import { sendSuccess, sendError } from '../utils/response';
import { pool } from '../db/pool';
import { scopeFor } from '../services/scope';
import { resolveProductImage, resolveProductModel, autoEnrichDatabaseProducts } from '../services/productMediaService';

export const portalRouter = Router();

const isSecure = process.env.COOKIE_SECURE === 'true';

const InviteContactSchema = z.object({
  contactId: z.number().int().positive('Contact is required'),
  email: z.string().email('Valid email is required'),
  fullName: z.string().min(2, 'Full name is required'),
  loginId: z.string().min(6).max(12, 'Login ID must be between 6 and 12 characters'),
  password: z.string().min(8, 'Password must be at least 8 characters long').optional(),
});

const AcceptInviteSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
});

const PortalLoginSchema = z.object({
  login_id: z.string().optional(),
  loginId: z.string().optional(),
  password: z.string().min(1, 'Password is required'),
}).refine(d => (d.login_id && d.login_id.trim().length > 0) || (d.loginId && d.loginId.trim().length > 0), {
  message: 'Login ID or Email is required',
}).transform(d => ({
  login_id: (d.login_id || d.loginId)!.trim(),
  password: d.password,
}));

const RecordPaymentSchema = z.object({
  method: z.enum(['cash', 'bank']),
  amount: z.string().or(z.number()),
});

// 1. POST /api/portal/invite - Accountant/admin invites a customer contact
portalRouter.post('/invite', requireAuth, requireInternalUser, async (req: Request, res: Response) => {
  try {
    const parse = InviteContactSchema.safeParse(req.body);
    if (!parse.success) {
      return sendError(res, 'VALIDATION_ERROR', parse.error.issues[0].message, 400);
    }

    const invite = await PortalService.inviteContact(parse.data);
    return sendSuccess(res, invite, 201);
  } catch (err: any) {
    return sendError(res, 'INVITE_ERROR', err.message || 'Failed to generate contact invite', 400);
  }
});

// 2. POST /api/portal/accept-invite - Contact sets password from invite token
portalRouter.post('/accept-invite', async (req: Request, res: Response) => {
  try {
    const parse = AcceptInviteSchema.safeParse(req.body);
    if (!parse.success) {
      return sendError(res, 'VALIDATION_ERROR', parse.error.issues[0].message, 400);
    }

    const result = await PortalService.acceptInvite(parse.data.token, parse.data.password);
    return sendSuccess(res, result);
  } catch (err: any) {
    return sendError(res, 'ACCEPT_ERROR', err.message || 'Failed to accept invite', 400);
  }
});

// 3. POST /api/portal/login - Contact login, returns JWT in httpOnly cookie
portalRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const parse = PortalLoginSchema.safeParse(req.body);
    if (!parse.success) {
      return sendError(res, 'INVALID_CREDENTIALS', 'Invalid Login Id or Password', 401);
    }

    const result = await PortalService.portalLogin(parse.data.login_id, parse.data.password);

    res.cookie('token', result.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isSecure,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return sendSuccess(res, { user: result.user, token: result.token });
  } catch (err: any) {
    const status = err.message.includes('restricted') ? 403 : 401;
    return sendError(res, 'AUTH_ERROR', err.message || 'Invalid Login Id or Password', status);
  }
});

// 4. GET /api/portal/me - Current contact user
portalRouter.get('/me', requireAuth, requirePortalContact, (req: AuthenticatedRequest, res: Response) => {
  return sendSuccess(res, { user: req.user });
});

// 5. GET /api/portal/invoices - Contact's OWN invoices only (scoped at data layer)
portalRouter.get('/invoices', requireAuth, requirePortalContact, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const invoices = await PortalService.getPortalInvoices(req.user!);
    return sendSuccess(res, invoices);
  } catch (err: any) {
    return sendError(res, 'SERVER_ERROR', err.message, 500);
  }
});

// 6. GET /api/portal/invoices/:id - Specific invoice with lines & payment history (scoped at data layer)
portalRouter.get('/invoices/:id', requireAuth, requirePortalContact, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const invId = parseInt(String(req.params.id), 10);
    if (isNaN(invId)) {
      return sendError(res, 'INVALID_ID', 'Invoice ID must be a number', 400);
    }

    const invoice = await PortalService.getPortalInvoiceById(invId, req.user!);
    if (!invoice) {
      return sendError(res, 'NOT_FOUND', `Invoice #${invId} not found or unauthorized`, 404);
    }

    return sendSuccess(res, invoice);
  } catch (err: any) {
    return sendError(res, 'SERVER_ERROR', err.message, 500);
  }
});

// 6b. GET /api/portal/invoices/:id/pdf - Scoped invoice PDF export (server-side Puppeteer with HTML fallback)
portalRouter.get('/invoices/:id/pdf', requireAuth, requirePortalContact, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const invId = parseInt(String(req.params.id), 10);
    if (isNaN(invId)) {
      return sendError(res, 'INVALID_ID', 'Invoice ID must be a number', 400);
    }

    // Scoped check at data layer: throws / returns null if not contact's invoice
    const scopedInvoice = await PortalService.getPortalInvoiceById(invId, req.user!);
    if (!scopedInvoice) {
      return sendError(res, 'NOT_FOUND', `Invoice #${invId} not found or unauthorized`, 404);
    }

    const { InvoiceService } = await import('../services/invoiceService');
    const fullInvoice = await InvoiceService.getInvoiceById(invId);
    if (!fullInvoice) {
      return sendError(res, 'NOT_FOUND', `Invoice #${invId} not found`, 404);
    }

    const { PdfService } = await import('../services/pdfService');
    if (req.query.format === 'html') {
      const html = PdfService.generateInvoiceHtml(fullInvoice);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    }

    try {
      const pdfBuffer = await PdfService.generateInvoicePdf(fullInvoice);
      const filename = `Invoice-${fullInvoice.number.replace(/\//g, '_')}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      return res.send(pdfBuffer);
    } catch (pdfErr: any) {
      console.warn('Puppeteer launch fallback to printable HTML:', pdfErr.message);
      const html = PdfService.generateInvoiceHtml(fullInvoice);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    }
  } catch (err: any) {
    return sendError(res, 'SERVER_ERROR', err.message, 500);
  }
});

// 7. POST /api/portal/invoices/:id/payments & /pay - Record manual payment (Cash / Bank)
portalRouter.post(['/invoices/:id/payments', '/invoices/:id/pay'], requireAuth, requirePortalContact, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const invId = parseInt(String(req.params.id), 10);
    if (isNaN(invId)) {
      return sendError(res, 'INVALID_ID', 'Invoice ID must be a number', 400);
    }

    const parse = RecordPaymentSchema.safeParse(req.body);
    if (!parse.success) {
      return sendError(res, 'VALIDATION_ERROR', 'Method (cash|bank) and positive amount required', 400);
    }

    const payment = await PortalService.recordPortalPayment(
      invId,
      req.user!,
      parse.data.method,
      parse.data.amount
    );

    return sendSuccess(res, payment, 201);
  } catch (err: any) {
    return sendError(res, 'PAYMENT_ERROR', err.message || 'Failed to record payment', 400);
  }
});

// 7b. POST /api/portal/invoices/:id/razorpay/create-order - Create Razorpay order for portal customer
portalRouter.post('/invoices/:id/razorpay/create-order', requireAuth, requirePortalContact, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const invId = parseInt(String(req.params.id), 10);
    if (isNaN(invId)) {
      return sendError(res, 'INVALID_ID', 'Invoice ID must be a number', 400);
    }

    const invoice = await PortalService.getPortalInvoiceById(invId, req.user!);
    if (!invoice) {
      return sendError(res, 'NOT_FOUND', 'Invoice not found or unauthorized', 404);
    }

    const amount = req.body.amount || invoice.amountDue;
    const { RazorpayService } = await import('../services/razorpayService');
    const order = await RazorpayService.createOrder(amount, `port_inv_${invoice.id}_${Date.now()}`, {
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      customerId: req.user!.contact_id,
    });

    return sendSuccess(res, order);
  } catch (err: any) {
    return sendError(res, 'RAZORPAY_ERROR', err.message, 400);
  }
});

// 7c. POST /api/portal/invoices/:id/razorpay/verify-payment - Verify signature & record customer payment
portalRouter.post('/invoices/:id/razorpay/verify-payment', requireAuth, requirePortalContact, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const invId = parseInt(String(req.params.id), 10);
    if (isNaN(invId)) {
      return sendError(res, 'INVALID_ID', 'Invoice ID must be a number', 400);
    }

    const invoice = await PortalService.getPortalInvoiceById(invId, req.user!);
    if (!invoice) {
      return sendError(res, 'NOT_FOUND', 'Invoice not found or unauthorized', 404);
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body;
    const { RazorpayService } = await import('../services/razorpayService');
    const isValid = RazorpayService.verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
    if (!isValid) {
      return sendError(res, 'INVALID_SIGNATURE', 'Razorpay payment signature verification failed', 400);
    }

    const paymentAmount = amount || invoice.amountDue;
    const payment = await PortalService.recordPortalPayment(
      invId,
      req.user!,
      'bank',
      paymentAmount
    );

    // Refresh invoice and dispatch email with PDF receipt via Resend
    let emailResult = null;
    try {
      const { InvoiceService } = await import('../services/invoiceService');
      const updatedInvoice = await InvoiceService.getInvoiceById(invId);
      if (updatedInvoice) {
        const { EmailService } = await import('../services/emailService');
        emailResult = await EmailService.sendPaymentReceiptEmail({
          invoice: updatedInvoice,
          paymentAmount,
          paymentMethod: 'Razorpay Online Gateway',
          paymentRef: razorpay_payment_id,
          recipientEmail: req.user?.email || updatedInvoice.customerEmail,
        });
      }
    } catch (eErr: any) {
      console.warn('[PortalRoutes] Resend email dispatch notice:', eErr.message);
    }


    return sendSuccess(res, {
      success: true,
      payment,
      razorpayPaymentId: razorpay_payment_id,
      email: emailResult,
    });
  } catch (err: any) {
    return sendError(res, 'PAYMENT_ERROR', err.message, 400);
  }
});

// 8. GET /api/portal/contact-user/:contactId - Check if contact has portal user
portalRouter.get('/contact-user/:contactId', requireAuth, requireInternalUser, async (req: Request, res: Response) => {
  try {
    const contactId = parseInt(String(req.params.contactId), 10);
    if (isNaN(contactId)) {
      return sendError(res, 'INVALID_ID', 'Contact ID must be a number', 400);
    }
    const user = await PortalService.getContactUser(contactId);
    return sendSuccess(res, user);
  } catch (err: any) {
    return sendError(res, 'SERVER_ERROR', err.message, 500);
  }
});

// 8b. GET /api/portal/payments - Contact's OWN payments / transaction logs (scoped at data layer)
portalRouter.get('/payments', requireAuth, requirePortalContact, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const payments = await PortalService.getPortalPayments(req.user!);
    return sendSuccess(res, payments);
  } catch (err: any) {
    return sendError(res, 'SERVER_ERROR', err.message, 500);
  }
});

// 9. GET /api/portal/bills - Contact's OWN vendor bills only
portalRouter.get('/bills', requireAuth, requirePortalContact, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const bills = await PortalService.getPortalBills(req.user!);
    return sendSuccess(res, bills);
  } catch (err: any) {
    return sendError(res, 'SERVER_ERROR', err.message, 500);
  }
});

// 10. GET /api/portal/bills/:id - Specific vendor bill with lines & payments
portalRouter.get('/bills/:id', requireAuth, requirePortalContact, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const billId = parseInt(String(req.params.id), 10);
    if (isNaN(billId)) {
      return sendError(res, 'INVALID_ID', 'Bill ID must be a number', 400);
    }

    const bill = await PortalService.getPortalBillById(billId, req.user!);
    if (!bill) {
      return sendError(res, 'NOT_FOUND', `Bill #${billId} not found or unauthorized`, 404);
    }

    return sendSuccess(res, bill);
  } catch (err: any) {
    return sendError(res, 'SERVER_ERROR', err.message, 500);
  }
});

// 11. POST /api/portal/bills/:id/payments & /pay - Record payment on vendor bill from portal
portalRouter.post(['/bills/:id/payments', '/bills/:id/pay'], requireAuth, requirePortalContact, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const billId = parseInt(String(req.params.id), 10);
    if (isNaN(billId)) {
      return sendError(res, 'INVALID_ID', 'Bill ID must be a number', 400);
    }

    const parse = RecordPaymentSchema.safeParse(req.body);
    if (!parse.success) {
      return sendError(res, 'VALIDATION_ERROR', 'Method (cash|bank) and positive amount required', 400);
    }

    const payment = await PortalService.recordPortalBillPayment(
      billId,
      req.user!,
      parse.data.method,
      parse.data.amount
    );

    return sendSuccess(res, payment, 201);
  } catch (err: any) {
    return sendError(res, 'PAYMENT_ERROR', err.message || 'Failed to record bill payment', 400);
  }
});

// 12. GET /api/portal/catalogue - Public route to browse furniture products (goods)
portalRouter.get('/catalogue', async (_req: Request, res: Response) => {
  try {
    const query = `
      SELECT 
        id,
        name,
        sku,
        category,
        sales_price::text,
        mrp::text,
        tax_rate::text,
        stock_qty::text,
        model_url,
        image_url
      FROM products
      WHERE is_archived = false AND type = 'goods'
      ORDER BY category ASC, name ASC, id ASC
    `;
    const result = await pool.query(query);

    // Guarantee every product returns authentic image & 3D model regardless of DB seed state
    const enrichedProducts = result.rows.map((row) => ({
      ...row,
      image_url: resolveProductImage(row),
      model_url: row.model_url || resolveProductModel(row),
    }));

    // Trigger non-blocking database self-healing so PostgreSQL is permanently updated
    autoEnrichDatabaseProducts().catch(() => {});

    return sendSuccess(res, enrichedProducts);
  } catch (err: any) {
    return sendError(res, 'FETCH_FAILED', err.message || 'Failed to fetch catalogue', 500);
  }
});

// 12b. GET /api/portal/models - Public list of all 24 local 3D models with categories & dimensions for the 3D room studio
portalRouter.get('/models', async (_req: Request, res: Response) => {
  try {
    const modelsDir = path.resolve(__dirname, '../../../client/public/Models');
    if (!fs.existsSync(modelsDir)) {
      return sendSuccess(res, []);
    }

    const files = fs.readdirSync(modelsDir);
    const models = files
      .filter(f => (f.endsWith('.glb') || f.endsWith('.gltf')) && !f.toLowerCase().includes('room_blank'))
      .map(filename => {
        const fullPath = path.join(modelsDir, filename);
        const stat = fs.statSync(fullPath);
        const lower = filename.toLowerCase();

        let category = 'Other';
        let defaultScale = 1.0;
        let defaultY = 0;

        if (lower.includes('bed')) {
          category = 'Beds';
          defaultScale = 1.2;
        } else if (lower.includes('couch') || lower.includes('sofa') || lower.includes('chair')) {
          category = 'Seating';
          defaultScale = lower.includes('couch large') ? 1.4 : 1.0;
        } else if (lower.includes('desk') || lower.includes('table') || lower.includes('stand')) {
          category = 'Tables';
          defaultScale = lower.includes('desk') ? 1.1 : 0.9;
        } else if (lower.includes('book') || lower.includes('shelf') || lower.includes('drawer')) {
          category = 'Storage';
          defaultScale = 1.1;
        } else if (lower.includes('light') || lower.includes('lamp')) {
          category = 'Lighting';
          defaultScale = 1.0;
        }

        // Clean user-friendly display name
        const cleanName = filename
          .replace(/\.glb$/i, '')
          .replace(/\s*-\s*[A-Za-z0-9_-]{8,15}$/, '')
          .replace(/ by [A-Za-z0-9 ]+$/i, '');

        return {
          id: filename,
          filename,
          name: cleanName,
          category,
          defaultScale,
          defaultY,
          sizeBytes: stat.size,
          sizeKB: (stat.size / 1024).toFixed(1),
          url: `/Models/${filename}`,
        };
      })
      .sort((a, b) => {
        if (a.category !== b.category) return a.category.localeCompare(b.category);
        return a.name.localeCompare(b.name);
      });

    return sendSuccess(res, models);
  } catch (err: any) {
    return sendError(res, 'FETCH_MODELS_FAILED', err.message || 'Failed to list models', 500);
  }
});

// 13. GET /api/portal/catalogue/:id - Single product by ID plus customer's invoices containing it
portalRouter.get('/catalogue/:id', requireAuth, requirePortalContact, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const productId = parseInt(String(req.params.id), 10);
    if (isNaN(productId)) {
      return sendError(res, 'INVALID_ID', 'Product ID must be a number', 400);
    }

    const productRes = await pool.query(
      `SELECT 
         id,
         name,
         sku,
         category,
         sales_price::text,
         mrp::text,
         tax_rate::text,
         stock_qty::text,
         model_url,
         image_url
       FROM products
       WHERE id = $1 AND is_archived = false`,
      [productId]
    );

    if (productRes.rows.length === 0) {
      return sendError(res, 'NOT_FOUND', 'Product not found', 404);
    }

    const scope = scopeFor(req.user!, 'invoice');
    const invoicesRes = await pool.query(
      `SELECT 
         ci.id,
         ci.number,
         ci.invoice_date AS "invoiceDate",
         ci.status,
         cil.qty::text,
         cil.unit_price::text AS "unitPrice",
         cil.total::text AS "lineTotal",
         vis.total::text,
         vis.amount_paid::text AS "amountPaid",
         vis.amount_due::text AS "amountDue",
         vis.payment_status AS "paymentStatus"
       FROM customer_invoices ci
       JOIN customer_invoice_lines cil ON cil.invoice_id = ci.id
       LEFT JOIN v_invoice_status vis ON vis.invoice_id = ci.id
       WHERE cil.product_id = $1 AND ci.customer_id = $2
       ORDER BY ci.invoice_date DESC, ci.id DESC`,
      [productId, scope.customerId]
    );

    const product = productRes.rows[0];
    const invoices = invoicesRes.rows.map(r => ({
      ...r,
      invoiceDate: r.invoiceDate ? new Date(r.invoiceDate).toISOString().split('T')[0] : '',
    }));

    return sendSuccess(res, {
      ...product,
      product,
      invoices,
    });
  } catch (err: any) {
    return sendError(res, 'FETCH_FAILED', err.message || 'Failed to fetch catalogue item', 500);
  }
});

// 14. POST /api/portal/quote - Generate official Sales Order Quote directly from 3D Room Studio or Product Viewer
portalRouter.post('/quote', requireAuth, requirePortalContact, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const scope = scopeFor(req.user!, 'sales_order');
    const customerId = scope.customerId;
    if (!customerId) {
      return sendError(res, 'UNAUTHORIZED', 'Customer contact profile required', 403);
    }

    const { items, roomName, notes } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return sendError(res, 'VALIDATION_ERROR', 'At least one product item is required', 400);
    }

    // Extract product IDs
    const productIds: number[] = items
      .map((i: any) => Number(i.productId || i.id))
      .filter((id: number) => !isNaN(id) && id > 0);

    if (productIds.length === 0) {
      return sendError(res, 'VALIDATION_ERROR', 'Valid product IDs required', 400);
    }

    const prodsRes = await pool.query(
      `SELECT id, name, sku, sales_price::text, tax_rate::text FROM products WHERE id = ANY($1)`,
      [productIds]
    );

    const prodMap = new Map(prodsRes.rows.map(p => [p.id, p]));

    const lines = items.map((item: any) => {
      const pId = Number(item.productId || item.id);
      const prod = prodMap.get(pId);
      const qty = item.qty ? String(item.qty) : '1';
      const unitPrice = prod ? prod.sales_price : (item.salesPrice ? String(item.salesPrice) : '0.00');
      const taxRate = prod ? prod.tax_rate : '18.00';

      return {
        productId: pId,
        qty,
        unitPrice,
        taxRate,
      };
    });

    const { SalesOrderService } = await import('../services/salesOrderService');
    const salesOrder = await SalesOrderService.createSalesOrder({
      customerId,
      lines,
    }, req.user!.id);

    return sendSuccess(res, {
      salesOrder,
      roomName: roomName || 'Custom 3D Architecture Proposal',
      notes: notes || 'Draft quotation generated directly from the 3D Room Studio.',
    }, 201);
  } catch (err: any) {
    return sendError(res, 'QUOTE_ERROR', err.message || 'Failed to generate quotation', 400);
  }
});

// 15. GET /api/portal/invoices/:id/certificate - Official Certificate of Handcrafted Authenticity & Provenance
portalRouter.get('/invoices/:id/certificate', requireAuth, requirePortalContact, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const invId = parseInt(String(req.params.id), 10);
    const scopedInvoice = await PortalService.getPortalInvoiceById(invId, req.user!);
    if (!scopedInvoice) {
      return sendError(res, 'NOT_FOUND', 'Invoice not found or unauthorized', 404);
    }

    const invoiceRes = await pool.query(`
      SELECT 
        ci.id, ci.number, ci.invoice_date,
        c.name AS customer_name, c.city, c.state,
        cil.product_id, p.name AS product_name, p.category, cil.qty,
        vis.payment_status
      FROM customer_invoices ci
      JOIN contacts c ON c.id = ci.customer_id
      JOIN customer_invoice_lines cil ON cil.invoice_id = ci.id
      JOIN products p ON p.id = cil.product_id
      LEFT JOIN v_invoice_status vis ON vis.invoice_id = ci.id
      WHERE ci.id = $1
    `, [invId]);

    if (invoiceRes.rows.length === 0) {
      return sendError(res, 'NOT_FOUND', 'Invoice items not found', 404);
    }

    const first = invoiceRes.rows[0];
    const items = invoiceRes.rows.map((r: any) => ({
      productName: r.product_name,
      category: r.category,
      qty: r.qty,
      woodSpecies: r.category === 'Beds' ? 'Japanese Hinoki & Teak' : r.category === 'Tables' ? 'French White Oak' : r.category === 'Storage' ? 'American Black Walnut' : 'Solid Natural Teak',
      serialNumber: `UF-${r.product_id}-${first.number.replace(/[^0-9]/g, '')}`,
      warranty: '10 Years Structural Guarantee',
    }));

    return sendSuccess(res, {
      certificateNumber: `CERT-${first.number.replace(/\//g, '-')}`,
      issuedTo: first.customer_name,
      cityState: [first.city, first.state].filter(Boolean).join(', '),
      issueDate: first.invoice_date,
      invoiceNumber: first.number,
      isSettled: first.payment_status === 'paid',
      items,
      seal: 'VERIFIED ARCHITECTURAL PROVENANCE',
    });
  } catch (err: any) {
    return sendError(res, 'SERVER_ERROR', err.message, 500);
  }
});



