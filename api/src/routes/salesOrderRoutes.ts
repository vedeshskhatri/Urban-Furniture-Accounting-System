import { Router, Request, Response } from 'express';
import { SalesOrderService } from '../services/salesOrderService';
import { sendSuccess, sendError } from '../utils/response';
import { z } from 'zod';

export const salesOrderRouter = Router();

const SalesOrderLineSchema = z.object({
  productId: z.number().int().positive('Product is required'),
  analyticAccountId: z.number().int().positive().nullable().optional(),
  qty: z.string().or(z.number()),
  unitPrice: z.string().or(z.number()),
  taxRate: z.string().or(z.number()).optional(),
});

const CreateSalesOrderSchema = z.object({
  customerId: z.number().int().positive('Customer is required'),
  orderDate: z.string().optional(),
  lines: z.array(SalesOrderLineSchema).min(1, 'At least one line item is required'),
});

// 1. POST /api/sales-orders
salesOrderRouter.post('/', async (req: Request, res: Response) => {
  try {
    const parse = CreateSalesOrderSchema.safeParse(req.body);
    if (!parse.success) {
      const fields: Record<string, string> = {};
      parse.error.issues.forEach(err => {
        fields[err.path.join('.')] = err.message;
      });
      return sendError(res, 'VALIDATION_ERROR', 'Invalid Sales Order data', 400, 'blocking', fields);
    }

    const order = await SalesOrderService.createSalesOrder(parse.data, (req as any).user?.id);
    return sendSuccess(res, order, 201);
  } catch (err: any) {
    return sendError(res, 'SERVER_ERROR', err.message || 'Failed to create sales order', 500);
  }
});

// 2. GET /api/sales-orders
salesOrderRouter.get('/', async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const customerId = req.query.customerId ? parseInt(req.query.customerId as string, 10) : undefined;
    const orders = await SalesOrderService.listSalesOrders({ status, customerId });
    return sendSuccess(res, orders);
  } catch (err: any) {
    return sendError(res, 'SERVER_ERROR', err.message, 500);
  }
});

// 3. GET /api/sales-orders/:id
salesOrderRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const soId = parseInt(String(req.params.id), 10);
    if (isNaN(soId)) {
      return sendError(res, 'INVALID_ID', 'Sales order ID must be a number', 400);
    }

    const order = await SalesOrderService.getSalesOrderById(soId);
    if (!order) {
      return sendError(res, 'NOT_FOUND', `Sales order #${soId} not found`, 404);
    }

    return sendSuccess(res, order);
  } catch (err: any) {
    return sendError(res, 'SERVER_ERROR', err.message, 500);
  }
});

// 3b. PUT /api/sales-orders/:id - Update sales order (allowed if draft or confirmed without invoice)
salesOrderRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const soId = parseInt(String(req.params.id), 10);
    if (isNaN(soId)) {
      return sendError(res, 'INVALID_ID', 'Sales order ID must be a number', 400);
    }

    const parse = CreateSalesOrderSchema.safeParse(req.body);
    if (!parse.success) {
      const fields: Record<string, string> = {};
      parse.error.issues.forEach(err => {
        fields[err.path.join('.')] = err.message;
      });
      return sendError(res, 'VALIDATION_ERROR', 'Invalid Sales Order data', 400, 'blocking', fields);
    }

    const updated = await SalesOrderService.updateSalesOrder(soId, parse.data, (req as any).user?.id);
    return sendSuccess(res, updated);
  } catch (err: any) {
    return sendError(res, 'UPDATE_ERROR', err.message, 400);
  }
});

// 4. POST /api/sales-orders/:id/confirm
// INVARIANT: ABSOLUTELY NO JOURNAL ENTRY ON SO CONFIRM
salesOrderRouter.post('/:id/confirm', async (req: Request, res: Response) => {
  try {
    const soId = parseInt(String(req.params.id), 10);
    if (isNaN(soId)) {
      return sendError(res, 'INVALID_ID', 'Sales order ID must be a number', 400);
    }

    const confirmed = await SalesOrderService.confirmSalesOrder(soId, (req as any).user?.id);
    return sendSuccess(res, confirmed);
  } catch (err: any) {
    return sendError(res, 'CONFIRM_ERROR', err.message, 400);
  }
});

// 5. POST /api/sales-orders/:id/create-invoice
salesOrderRouter.post('/:id/create-invoice', async (req: Request, res: Response) => {
  try {
    const soId = parseInt(String(req.params.id), 10);
    if (isNaN(soId)) {
      return sendError(res, 'INVALID_ID', 'Sales order ID must be a number', 400);
    }

    const invoice = await SalesOrderService.createInvoiceFromSalesOrder(soId, (req as any).user?.id);
    return sendSuccess(res, invoice, 201);
  } catch (err: any) {
    return sendError(res, 'CREATE_INVOICE_ERROR', err.message, 400);
  }
});
