import crypto from 'crypto';
import { PoolClient } from 'pg';
import { pool } from '../db/pool';
import { Decimal } from 'decimal.js';
import { QrMatrixGenerator } from './qrMatrix';

export const SELLER_GSTIN = '27AABCU9603R1ZM';
export const SELLER_LEGAL_NAME = 'Urban Furniture Pvt Ltd';
export const SELLER_TRADE_NAME = 'Urban Furniture';
export const SELLER_STATE = 'Maharashtra';
export const SELLER_STATE_CODE = '27';
export const SELLER_ADDRESS = 'Plot 42, Furniture Craft Park, Andheri East, Mumbai, Maharashtra 400069';
export const DEFAULT_FURNITURE_HSN = '9403';

export interface GstLineItem {
  lineNo: number;
  productId: number;
  productName: string;
  productSku?: string;
  hsnCode: string;
  qty: string;
  unitPrice: string;
  subtotal: string;
  taxRate: string;
  cgstRate: string;
  cgstAmount: string;
  sgstRate: string;
  sgstAmount: string;
  igstRate: string;
  igstAmount: string;
  total: string;
}

export interface EWayBillInfo {
  required: boolean;
  ewayBillNo?: string;
  generatedDate?: string;
  validUntil?: string;
  approxDistanceKm?: number;
  vehicleMode: string;
  vehicleNo?: string;
  status: 'ACTIVE' | 'NOT_REQUIRED';
}

export interface UpiPaymentDetails {
  vpa: string;
  payeeName: string;
  amount: string;
  invoiceNumber: string;
  upiUrl: string;
  qrDataUrl: string;
  qrCodeSvg: string;
  gateway?: string;
  razorpayKeyId?: string;
  razorpayUrl?: string;
  razorpayQrSvg?: string;
  razorpayQrDataUrl?: string;
}

export interface InvoiceGstDetails {
  invoiceId: number;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  status: string;
  financialYear: string;
  irn: string;
  ackNo: string;
  ackDate: string;
  sellerGstin: string;
  sellerLegalName: string;
  sellerTradeName: string;
  sellerState: string;
  sellerStateCode: string;
  sellerAddress: string;
  buyerGstin: string;
  buyerName: string;
  buyerEmail?: string;
  buyerAddress?: string;
  buyerCity?: string;
  buyerState?: string;
  buyerPincode?: string;
  supplyType: 'INTRA_STATE' | 'INTER_STATE';
  placeOfSupply: string;
  subtotal: string;
  taxTotal: string;
  total: string;
  cgstTotal: string;
  sgstTotal: string;
  igstTotal: string;
  ewayBill: EWayBillInfo;
  lines: GstLineItem[];
  qrPayloadJson: string;
  qrCodeSvg: string;
  qrDataUrl: string;
  upi: UpiPaymentDetails;
}

export class GstService {
  /**
   * Determine Indian Financial Year from date (e.g. 2026-03-15 -> 2025-26, 2026-04-10 -> 2026-27)
   */
  static getFinancialYear(dateStr: string): string {
    const d = new Date(dateStr);
    const year = d.getFullYear();
    const month = d.getMonth() + 1; // 1-12
    if (month >= 4) {
      const next = (year + 1).toString().slice(-2);
      return `${year}-${next}`;
    } else {
      const prev = year - 1;
      const cur = year.toString().slice(-2);
      return `${prev}-${cur}`;
    }
  }

  /**
   * Compute deterministic 64-char SHA-256 IRN Hash (Standard NIC e-Invoice formula)
   */
  static generateIrn(sellerGstin: string, finYear: string, docType: string, docNumber: string): string {
    const raw = `${sellerGstin}:${finYear}:${docType}:${docNumber}`;
    return crypto.createHash('sha256').update(raw).digest('hex').toUpperCase();
  }

  /**
   * Generate deterministic 15-digit e-Invoice Acknowledgment Number
   */
  static generateAckNumber(invoiceId: number, invoiceDate: string): string {
    const year = invoiceDate ? invoiceDate.replace(/-/g, '').slice(0, 6) : '202601';
    const idPad = String(invoiceId).padStart(9, '0');
    return `${year}${idPad}`;
  }

  /**
   * Generate 12-digit E-Way bill number for consignments exceeding ₹50,000 threshold
   */
  static generateEWayBillNumber(invoiceId: number, invoiceNumber: string): string {
    const hash = crypto.createHash('sha256').update(`EWB:${invoiceId}:${invoiceNumber}`).digest('hex');
    const numPart = (parseInt(hash.slice(0, 8), 16) % 90000000 + 10000000).toString();
    return `3410${numPart}`; // 12 digits total
  }

  /**
   * Retrieve full GST e-Invoice, IRN verification seal, and vector QR code
   */
  static async getInvoiceGstDetails(invoiceId: number, clientOrPool: PoolClient | typeof pool = pool): Promise<InvoiceGstDetails | null> {
    const invRes = await clientOrPool.query(
      `SELECT 
        ci.*,
        c.name as customer_name,
        c.email as customer_email,
        c.gstin as customer_gstin,
        c.address as customer_address,
        c.city as customer_city,
        c.state as customer_state,
        c.pincode as customer_pincode,
        vis.amount_due,
        vis.amount_paid,
        vis.payment_status
       FROM customer_invoices ci
       JOIN contacts c ON c.id = ci.customer_id
       LEFT JOIN v_invoice_status vis ON vis.invoice_id = ci.id
       WHERE ci.id = $1`,
      [invoiceId]
    );

    if (invRes.rows.length === 0) return null;
    const inv = invRes.rows[0];

    const linesRes = await clientOrPool.query(
      `SELECT 
        cil.*,
        p.name as product_name,
        p.sku as product_sku,
        p.category as product_category
       FROM customer_invoice_lines cil
       JOIN products p ON p.id = cil.product_id
       WHERE cil.invoice_id = $1
       ORDER BY cil.line_no ASC`,
      [invoiceId]
    );

    const invoiceDate = inv.invoice_date ? new Date(inv.invoice_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    const dueDate = inv.due_date ? new Date(inv.due_date).toISOString().split('T')[0] : '';
    const finYear = this.getFinancialYear(invoiceDate);

    // IRN and Ack details
    const irn = this.generateIrn(SELLER_GSTIN, finYear, 'INV', inv.number);
    const ackNo = this.generateAckNumber(inv.id, invoiceDate);
    const ackDate = `${invoiceDate}T10:00:00+05:30`;

    // Intra-State vs Inter-State supply classification
    const buyerState = (inv.customer_state || '').trim();
    const buyerGstin = (inv.customer_gstin || '').trim();
    const isMaharashtra = 
      buyerState.toLowerCase().includes('maha') ||
      buyerState.toLowerCase() === 'mh' ||
      buyerGstin.startsWith('27') ||
      (!buyerState && !buyerGstin); // Default intra-state for local store walk-ins

    const supplyType: 'INTRA_STATE' | 'INTER_STATE' = isMaharashtra ? 'INTRA_STATE' : 'INTER_STATE';
    const placeOfSupply = isMaharashtra ? '27-Maharashtra' : (buyerState ? `${buyerState}` : 'Other State');

    let totalCgst = new Decimal(0);
    let totalSgst = new Decimal(0);
    let totalIgst = new Decimal(0);

    const lines: GstLineItem[] = linesRes.rows.map(r => {
      const subtotal = new Decimal(r.subtotal || 0);
      const taxRate = new Decimal(r.tax_rate || 0);
      const taxAmount = new Decimal(r.tax_amount || 0);
      const lineTotal = new Decimal(r.total || 0);

      let cgstRate = '0.00';
      let cgstAmount = '0.00';
      let sgstRate = '0.00';
      let sgstAmount = '0.00';
      let igstRate = '0.00';
      let igstAmount = '0.00';

      if (supplyType === 'INTRA_STATE') {
        const halfRate = taxRate.dividedBy(2);
        const halfTax = taxAmount.dividedBy(2);
        cgstRate = halfRate.toFixed(2);
        cgstAmount = halfTax.toFixed(2);
        sgstRate = halfRate.toFixed(2);
        sgstAmount = halfTax.toFixed(2);
        totalCgst = totalCgst.plus(halfTax);
        totalSgst = totalSgst.plus(halfTax);
      } else {
        igstRate = taxRate.toFixed(2);
        igstAmount = taxAmount.toFixed(2);
        totalIgst = totalIgst.plus(taxAmount);
      }

      return {
        lineNo: r.line_no,
        productId: r.product_id,
        productName: r.product_name,
        productSku: r.product_sku || '',
        hsnCode: DEFAULT_FURNITURE_HSN,
        qty: String(r.qty),
        unitPrice: new Decimal(r.unit_price || 0).toFixed(2),
        subtotal: subtotal.toFixed(2),
        taxRate: taxRate.toFixed(2),
        cgstRate,
        cgstAmount,
        sgstRate,
        sgstAmount,
        igstRate,
        igstAmount,
        total: lineTotal.toFixed(2),
      };
    });

    // E-Way Bill evaluation (Statutory ₹50,000 threshold under Rule 138)
    const invoiceTotalDec = new Decimal(inv.total || 0);
    const isEWayBillRequired = invoiceTotalDec.greaterThanOrEqualTo(50000);

    let ewayBill: EWayBillInfo;
    if (isEWayBillRequired) {
      const ewbNo = this.generateEWayBillNumber(inv.id, inv.number);
      const validUntilDate = new Date(new Date(invoiceDate).getTime() + 48 * 60 * 60 * 1000).toISOString().split('T')[0];
      ewayBill = {
        required: true,
        ewayBillNo: ewbNo,
        generatedDate: invoiceDate,
        validUntil: validUntilDate,
        approxDistanceKm: isMaharashtra ? 120 : 650,
        vehicleMode: 'Road / Registered Logistics Carrier',
        vehicleNo: 'MH-02-CE-8821',
        status: 'ACTIVE',
      };
    } else {
      ewayBill = {
        required: false,
        vehicleMode: 'Local Store Delivery',
        status: 'NOT_REQUIRED',
      };
    }

    // Official B2B QR Code Payload JSON
    const qrPayload = {
      SellerGSTIN: SELLER_GSTIN,
      BuyerGSTIN: buyerGstin || 'URP-CONSUMER',
      DocNo: inv.number,
      DocTyp: 'INV',
      DocDt: invoiceDate,
      TotInvVal: Number(invoiceTotalDec.toFixed(2)),
      ItemCnt: lines.length,
      MainHsnCode: DEFAULT_FURNITURE_HSN,
      Irn: irn,
      EwbNo: ewayBill.ewayBillNo || null,
      SignedQrVer: '1.1',
    };
    const qrPayloadJson = JSON.stringify(qrPayload);

    // Render offline Vector SVG and high-resolution PNG Data URL
    const qrCodeSvg = QrMatrixGenerator.renderSvg(qrPayloadJson, {
      size: 260,
      margin: 2,
      foregroundColor: '#26211C',
      backgroundColor: '#FFFFFF',
    });
    const qrDataUrl = await QrMatrixGenerator.renderPngDataUrl(qrPayloadJson, {
      size: 260,
      margin: 2,
    });

    // 1-Click NPCI Bharat QR / UPI Payment Link
    const payableAmount = (inv.amount_due !== null && inv.amount_due !== undefined) 
      ? new Decimal(inv.amount_due).toFixed(2)
      : invoiceTotalDec.toFixed(2);

    const upiVpa = process.env.UPI_VPA || 'urbanfurniture@icici';
    const upiPayee = SELLER_LEGAL_NAME;
    const upiUrl = `upi://pay?pa=${upiVpa}&pn=${encodeURIComponent(upiPayee)}&am=${payableAmount}&cu=INR&tn=${encodeURIComponent('Invoice ' + inv.number)}`;
    
    const upiQrSvg = QrMatrixGenerator.renderSvg(upiUrl, {
      size: 260,
      margin: 2,
      foregroundColor: '#26211C',
      backgroundColor: '#FFFFFF',
    });
    const upiQrDataUrl = await QrMatrixGenerator.renderPngDataUrl(upiUrl, {
      size: 260,
      margin: 2,
    });

    // Dynamic Razorpay Payment Gateway Link & Universal Checkout QR
    let razorpayUrl: string | undefined = undefined;
    let razorpayQrSvg: string | undefined = undefined;
    let razorpayQrDataUrl: string | undefined = undefined;

    if (new Decimal(payableAmount).greaterThan(0)) {
      try {
        const { RazorpayService } = await import('./razorpayService');
        const rzpLink = await RazorpayService.createPaymentLink(
          payableAmount,
          inv.number,
          inv.customer_name,
          inv.customer_email,
          { invoiceId: inv.id, invoiceNumber: inv.number, customerId: inv.customer_id }
        );
        if (rzpLink?.shortUrl) {
          razorpayUrl = rzpLink.shortUrl;
          razorpayQrSvg = QrMatrixGenerator.renderSvg(razorpayUrl, {
            size: 260,
            margin: 2,
            foregroundColor: '#26211C',
            backgroundColor: '#FFFFFF',
          });
          razorpayQrDataUrl = await QrMatrixGenerator.renderPngDataUrl(razorpayUrl, {
            size: 260,
            margin: 2,
          });
        }
      } catch (rzpErr: any) {
        console.warn('[gstService] Razorpay payment link notice (using fallback UPI):', rzpErr.message);
      }
    }

    const upi: UpiPaymentDetails = {
      vpa: upiVpa,
      payeeName: upiPayee,
      amount: payableAmount,
      invoiceNumber: inv.number,
      upiUrl,
      qrDataUrl: upiQrDataUrl,
      qrCodeSvg: upiQrSvg,
      gateway: 'razorpay',
      razorpayKeyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_TYL9FJAZxMYoFc',
      razorpayUrl,
      razorpayQrSvg,
      razorpayQrDataUrl,
    };

    return {
      invoiceId: inv.id,
      invoiceNumber: inv.number,
      invoiceDate,
      dueDate,
      status: inv.status,
      financialYear: finYear,
      irn,
      ackNo,
      ackDate,
      sellerGstin: SELLER_GSTIN,
      sellerLegalName: SELLER_LEGAL_NAME,
      sellerTradeName: SELLER_TRADE_NAME,
      sellerState: SELLER_STATE,
      sellerStateCode: SELLER_STATE_CODE,
      sellerAddress: SELLER_ADDRESS,
      buyerGstin: buyerGstin || 'URP-UNREGISTERED',
      buyerName: inv.customer_name,
      buyerEmail: inv.customer_email || undefined,
      buyerAddress: inv.customer_address || '',
      buyerCity: inv.customer_city || '',
      buyerState: inv.customer_state || (isMaharashtra ? 'Maharashtra' : ''),
      buyerPincode: inv.customer_pincode || '',
      supplyType,
      placeOfSupply,
      subtotal: new Decimal(inv.subtotal || 0).toFixed(2),
      taxTotal: new Decimal(inv.tax_total || 0).toFixed(2),
      total: invoiceTotalDec.toFixed(2),
      cgstTotal: totalCgst.toFixed(2),
      sgstTotal: totalSgst.toFixed(2),
      igstTotal: totalIgst.toFixed(2),
      ewayBill,
      lines,
      qrPayloadJson,
      qrCodeSvg,
      qrDataUrl,
      upi,
    };
  }
}
