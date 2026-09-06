import { Router, Request, Response } from 'express';
import { GstService } from '../services/gstService';
import { GstReturnService } from '../services/gstReturnService';
import { sendSuccess, sendError } from '../utils/response';

export const gstRouter = Router();

/**
 * GET /api/gst/invoice/:id
 * Retrieve deterministic B2B e-Invoice metadata, IRN hash, E-Way Bill status, and vector QR code
 */
gstRouter.get('/invoice/:id', async (req: Request, res: Response) => {
  try {
    const invoiceId = parseInt(String(req.params.id), 10);
    if (isNaN(invoiceId)) {
      return sendError(res, 'INVALID_INPUT', 'Invoice ID must be an integer', 400);
    }

    const details = await GstService.getInvoiceGstDetails(invoiceId);
    if (!details) {
      return sendError(res, 'NOT_FOUND', `Invoice ${invoiceId} not found`, 404);
    }

    return sendSuccess(res, details);
  } catch (err: any) {
    console.error('Error fetching GST invoice details:', err);
    return sendError(res, 'GST_INVOICE_ERROR', err.message || 'Failed to generate GST details', 500);
  }
});

/**
 * GET /api/gst/invoice/:id/qr-svg
 * Directly render offline vector SVG QR code for printable documents
 */
gstRouter.get('/invoice/:id/qr-svg', async (req: Request, res: Response) => {
  try {
    const invoiceId = parseInt(String(req.params.id), 10);
    if (isNaN(invoiceId)) {
      return sendError(res, 'INVALID_INPUT', 'Invoice ID must be an integer', 400);
    }

    const details = await GstService.getInvoiceGstDetails(invoiceId);
    if (!details) {
      return sendError(res, 'NOT_FOUND', `Invoice ${invoiceId} not found`, 404);
    }

    res.setHeader('Content-Type', 'image/svg+xml');
    return res.send(details.qrCodeSvg);
  } catch (err: any) {
    return sendError(res, 'GST_QR_ERROR', err.message, 500);
  }
});

/**
 * GET /api/gst/gstr-1
 * Retrieve GSTR-1 outward supplies return summary (Table 4 B2B, Table 5/7 B2C, Table 12 HSN, Table 13 Docs)
 */
gstRouter.get('/gstr-1', async (req: Request, res: Response) => {
  try {
    const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;
    const month = req.query.month ? parseInt(req.query.month as string, 10) : undefined;

    const summary = await GstReturnService.getGstr1Summary({ year, month });
    return sendSuccess(res, summary);
  } catch (err: any) {
    console.error('Error computing GSTR-1 summary:', err);
    return sendError(res, 'GSTR1_COMPUTATION_ERROR', err.message, 500);
  }
});

/**
 * GET /api/gst/gstr-3b
 * Retrieve GSTR-3B monthly return and computed Net Tax Payable after ITC offset
 */
gstRouter.get('/gstr-3b', async (req: Request, res: Response) => {
  try {
    const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;
    const month = req.query.month ? parseInt(req.query.month as string, 10) : undefined;

    const summary = await GstReturnService.getGstr3BSummary({ year, month });
    return sendSuccess(res, summary);
  } catch (err: any) {
    console.error('Error computing GSTR-3B summary:', err);
    return sendError(res, 'GSTR3B_COMPUTATION_ERROR', err.message, 500);
  }
});

/**
 * GET /api/gst/eway-bills
 * Retrieve all E-Way Bill shipments exceeding the ₹50,000 threshold
 */
gstRouter.get('/eway-bills', async (req: Request, res: Response) => {
  try {
    const bills = await GstReturnService.listEWayBills();
    return sendSuccess(res, bills);
  } catch (err: any) {
    console.error('Error retrieving E-Way bills:', err);
    return sendError(res, 'EWAY_BILL_ERROR', err.message, 500);
  }
});
