import { PoolClient } from 'pg';
import { pool } from '../db/pool';
import { Decimal } from 'decimal.js';
import { SELLER_GSTIN, SELLER_LEGAL_NAME, DEFAULT_FURNITURE_HSN, GstService } from './gstService';

export interface Gstr1B2BRecord {
  invoiceId: number;
  invoiceNumber: string;
  invoiceDate: string;
  buyerGstin: string;
  buyerName: string;
  placeOfSupply: string;
  supplyType: 'INTRA_STATE' | 'INTER_STATE';
  invoiceValue: string;
  taxableValue: string;
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
  reverseCharge: 'N';
}

export interface Gstr1B2CRecord {
  invoiceId: number;
  invoiceNumber: string;
  invoiceDate: string;
  buyerName: string;
  placeOfSupply: string;
  invoiceValue: string;
  taxableValue: string;
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
}

export interface Gstr1HsnRecord {
  hsnCode: string;
  description: string;
  totalQty: string;
  taxableValue: string;
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
  totalTax: string;
}

export interface Gstr1Summary {
  period: string;
  sellerGstin: string;
  sellerName: string;
  b2bCount: number;
  b2cCount: number;
  totalInvoices: number;
  totalTaxableValue: string;
  totalCgst: string;
  totalSgst: string;
  totalIgst: string;
  totalTax: string;
  totalInvoiceValue: string;
  b2bRecords: Gstr1B2BRecord[];
  b2cRecords: Gstr1B2CRecord[];
  hsnSummary: Gstr1HsnRecord[];
  docSummary: {
    docType: string;
    fromSerial: string;
    toSerial: string;
    totalCount: number;
    cancelledCount: number;
    netIssued: number;
  };
}

export interface Gstr3BTable {
  taxableValue: string;
  igst: string;
  cgst: string;
  sgst: string;
  cess: string;
}

export interface Gstr3BSummary {
  period: string;
  sellerGstin: string;
  sellerName: string;
  outwardSupplies: Gstr3BTable; // 3.1(a) Outward Taxable supplies
  itcAvailable: Gstr3BTable;    // 4(A)(5) All other ITC from purchases
  netTaxPayable: Gstr3BTable;   // 6.1 Net Tax Payable in Cash
}

export interface Gstr2BRecord {
  billId: number;
  billNumber: string;
  billReference: string | null;
  billDate: string;
  vendorName: string;
  vendorGstin: string;
  placeOfSupply: string;
  supplyType: 'INTRA_STATE' | 'INTER_STATE';
  taxableValue: string;
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
  totalTax: string;
  invoiceValue: string;
  itcEligible: boolean;
}

export interface Gstr2BSummary {
  period: string;
  sellerGstin: string;
  sellerName: string;
  billCount: number;
  registeredVendorCount: number;
  totalTaxableValue: string;
  totalCgst: string;
  totalSgst: string;
  totalIgst: string;
  totalItc: string;
  totalInvoiceValue: string;
  records: Gstr2BRecord[];
}

/** Furniture-trade HSN mapping keyed by product category (CBIC chapter headings). */
const CATEGORY_HSN: Record<string, { hsn: string; label: string }> = {
  Seating: { hsn: '9401', label: 'Seats (chairs, sofas, benches) and parts thereof' },
  Beds: { hsn: '9403', label: 'Other furniture — bedroom (beds, headboards)' },
  Tables: { hsn: '9403', label: 'Other furniture — tables and desks' },
  Storage: { hsn: '9403', label: 'Other furniture — wardrobes, cabinets, shelving' },
  Furniture: { hsn: '9403', label: 'Other furniture and parts thereof' },
  Decor: { hsn: '9403', label: 'Other furniture and decorative fittings' },
  Lighting: { hsn: '9405', label: 'Luminaires and lighting fittings' },
  Electronics: { hsn: '8543', label: 'Electrical machines and apparatus' },
};

function hsnForCategory(category: string | null): { hsn: string; label: string } {
  if (category && CATEGORY_HSN[category]) return CATEGORY_HSN[category];
  return { hsn: DEFAULT_FURNITURE_HSN, label: 'Wooden, steel & modular furniture' };
}

function periodLabel(filters?: { year?: number; month?: number }): string {
  if (filters?.year && filters?.month) {
    const d = new Date(filters.year, filters.month - 1, 1);
    return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  }
  if (filters?.year) return `FY ${filters.year}`;
  return 'All Recorded Financial Periods';
}

export class GstReturnService {
  /**
   * Aggregate GSTR-1 Outward Supplies return
   */
  static async getGstr1Summary(filters?: { year?: number; month?: number }, clientOrPool: PoolClient | typeof pool = pool): Promise<Gstr1Summary> {
    let whereClause = `WHERE ci.status IN ('confirmed')`;
    const params: any[] = [];

    if (filters?.year) {
      params.push(filters.year);
      whereClause += ` AND EXTRACT(YEAR FROM ci.invoice_date) = $${params.length}`;
    }
    if (filters?.month) {
      params.push(filters.month);
      whereClause += ` AND EXTRACT(MONTH FROM ci.invoice_date) = $${params.length}`;
    }

    const invoicesRes = await clientOrPool.query(
      `SELECT 
        ci.id,
        ci.number,
        ci.invoice_date,
        ci.subtotal,
        ci.tax_total,
        ci.total,
        ci.status,
        c.name as customer_name,
        c.gstin as customer_gstin,
        c.state as customer_state
       FROM customer_invoices ci
       JOIN contacts c ON c.id = ci.customer_id
       ${whereClause}
       ORDER BY ci.invoice_date ASC, ci.id ASC`,
      params
    );

    const b2bRecords: Gstr1B2BRecord[] = [];
    const b2cRecords: Gstr1B2CRecord[] = [];

    let totalTaxable = new Decimal(0);
    let totalCgst = new Decimal(0);
    let totalSgst = new Decimal(0);
    let totalIgst = new Decimal(0);
    let totalVal = new Decimal(0);

    let totalFurnitureQty = new Decimal(0);

    for (const inv of invoicesRes.rows) {
      const invDate = inv.invoice_date ? new Date(inv.invoice_date).toISOString().split('T')[0] : '';
      const buyerGstin = (inv.customer_gstin || '').trim();
      const buyerState = (inv.customer_state || '').trim();
      const isMaha = 
        buyerState.toLowerCase().includes('maha') ||
        buyerState.toLowerCase() === 'mh' ||
        buyerGstin.startsWith('27') ||
        (!buyerState && !buyerGstin);

      const supplyType = isMaha ? 'INTRA_STATE' : 'INTER_STATE';
      const pos = isMaha ? '27-Maharashtra' : (buyerState || 'Inter-State');

      const subtotalDec = new Decimal(inv.subtotal || 0);
      const taxTotalDec = new Decimal(inv.tax_total || 0);
      const totalDec = new Decimal(inv.total || 0);

      totalTaxable = totalTaxable.plus(subtotalDec);
      totalVal = totalVal.plus(totalDec);

      let cgst = new Decimal(0);
      let sgst = new Decimal(0);
      let igst = new Decimal(0);

      if (supplyType === 'INTRA_STATE') {
        const half = taxTotalDec.dividedBy(2);
        cgst = half;
        sgst = half;
        totalCgst = totalCgst.plus(half);
        totalSgst = totalSgst.plus(half);
      } else {
        igst = taxTotalDec;
        totalIgst = totalIgst.plus(taxTotalDec);
      }

      if (buyerGstin && buyerGstin.length >= 5) {
        // Table 4: B2B
        b2bRecords.push({
          invoiceId: inv.id,
          invoiceNumber: inv.number,
          invoiceDate: invDate,
          buyerGstin: buyerGstin,
          buyerName: inv.customer_name,
          placeOfSupply: pos,
          supplyType,
          invoiceValue: totalDec.toFixed(2),
          taxableValue: subtotalDec.toFixed(2),
          cgstAmount: cgst.toFixed(2),
          sgstAmount: sgst.toFixed(2),
          igstAmount: igst.toFixed(2),
          reverseCharge: 'N',
        });
      } else {
        // Table 5/7: B2C
        b2cRecords.push({
          invoiceId: inv.id,
          invoiceNumber: inv.number,
          invoiceDate: invDate,
          buyerName: inv.customer_name,
          placeOfSupply: pos,
          invoiceValue: totalDec.toFixed(2),
          taxableValue: subtotalDec.toFixed(2),
          cgstAmount: cgst.toFixed(2),
          sgstAmount: sgst.toFixed(2),
          igstAmount: igst.toFixed(2),
        });
      }
    }

    // Table 12: real HSN-wise breakdown by product category + rate, split
    // intra/inter-state from the buyer's state (Maharashtra = intra).
    const hsnRes = await clientOrPool.query(
      `SELECT
         p.category,
         cil.tax_rate,
         (lower(coalesce(c.state,'')) LIKE '%maha%'
          OR lower(coalesce(c.state,'')) = 'mh'
          OR left(coalesce(c.gstin,''), 2) = '27'
          OR (coalesce(c.state,'') = '' AND coalesce(c.gstin,'') = '')) AS is_intra,
         COALESCE(SUM(cil.qty), 0)      AS qty,
         COALESCE(SUM(cil.subtotal), 0) AS taxable,
         COALESCE(SUM(cil.tax_amount), 0) AS tax
       FROM customer_invoice_lines cil
       JOIN customer_invoices ci ON ci.id = cil.invoice_id
       JOIN contacts c ON c.id = ci.customer_id
       LEFT JOIN products p ON p.id = cil.product_id
       ${whereClause}
       GROUP BY p.category, cil.tax_rate, is_intra
       ORDER BY p.category NULLS LAST, cil.tax_rate`,
      params
    );

    const hsnMap = new Map<string, Gstr1HsnRecord & { _qty: Decimal; _taxable: Decimal; _cgst: Decimal; _sgst: Decimal; _igst: Decimal }>();
    for (const row of hsnRes.rows) {
      const { hsn, label } = hsnForCategory(row.category);
      const rate = new Decimal(row.tax_rate || 0);
      const key = `${hsn}|${rate.toFixed(2)}`;
      if (!hsnMap.has(key)) {
        hsnMap.set(key, {
          hsnCode: hsn,
          description: `${label} @ ${rate.toFixed(rate.isInteger() ? 0 : 2)}% GST`,
          totalQty: '0', taxableValue: '0', cgstAmount: '0', sgstAmount: '0', igstAmount: '0', totalTax: '0',
          _qty: new Decimal(0), _taxable: new Decimal(0), _cgst: new Decimal(0), _sgst: new Decimal(0), _igst: new Decimal(0),
        });
      }
      const rec = hsnMap.get(key)!;
      const tax = new Decimal(row.tax || 0);
      rec._qty = rec._qty.plus(row.qty || 0);
      rec._taxable = rec._taxable.plus(row.taxable || 0);
      if (row.is_intra) {
        rec._cgst = rec._cgst.plus(tax.dividedBy(2));
        rec._sgst = rec._sgst.plus(tax.dividedBy(2));
      } else {
        rec._igst = rec._igst.plus(tax);
      }
      totalFurnitureQty = totalFurnitureQty.plus(row.qty || 0);
    }

    const hsnSummary: Gstr1HsnRecord[] = Array.from(hsnMap.values())
      .map((r) => ({
        hsnCode: r.hsnCode,
        description: r.description,
        totalQty: r._qty.toFixed(2),
        taxableValue: r._taxable.toFixed(2),
        cgstAmount: r._cgst.toFixed(2),
        sgstAmount: r._sgst.toFixed(2),
        igstAmount: r._igst.toFixed(2),
        totalTax: r._cgst.plus(r._sgst).plus(r._igst).toFixed(2),
      }))
      .sort((a, b) => Number(b.taxableValue) - Number(a.taxableValue));

    if (hsnSummary.length === 0) {
      hsnSummary.push({
        hsnCode: DEFAULT_FURNITURE_HSN,
        description: 'Wooden, Steel & Modular Furniture for Offices & Homes',
        totalQty: '0.00', taxableValue: '0.00', cgstAmount: '0.00', sgstAmount: '0.00', igstAmount: '0.00', totalTax: '0.00',
      });
    }

    // Document series summary (Table 13)
    const firstDoc = invoicesRes.rows[0]?.number || 'None';
    const lastDoc = invoicesRes.rows[invoicesRes.rows.length - 1]?.number || 'None';

    const periodStr = periodLabel(filters);

    return {
      period: periodStr,
      sellerGstin: SELLER_GSTIN,
      sellerName: SELLER_LEGAL_NAME,
      b2bCount: b2bRecords.length,
      b2cCount: b2cRecords.length,
      totalInvoices: invoicesRes.rows.length,
      totalTaxableValue: totalTaxable.toFixed(2),
      totalCgst: totalCgst.toFixed(2),
      totalSgst: totalSgst.toFixed(2),
      totalIgst: totalIgst.toFixed(2),
      totalTax: totalCgst.plus(totalSgst).plus(totalIgst).toFixed(2),
      totalInvoiceValue: totalVal.toFixed(2),
      b2bRecords,
      b2cRecords,
      hsnSummary,
      docSummary: {
        docType: 'Tax Invoices for Outward Supply',
        fromSerial: firstDoc,
        toSerial: lastDoc,
        totalCount: invoicesRes.rows.length,
        cancelledCount: 0,
        netIssued: invoicesRes.rows.length,
      },
    };
  }

  /**
   * Aggregate GSTR-3B monthly return and compute Net Cash Tax Payable after ITC offset
   */
  static async getGstr3BSummary(filters?: { year?: number; month?: number }, clientOrPool: PoolClient | typeof pool = pool): Promise<Gstr3BSummary> {
    // 1. Outward taxable sales (from customer_invoices)
    const gstr1 = await this.getGstr1Summary(filters, clientOrPool);

    const outwardSupplies: Gstr3BTable = {
      taxableValue: gstr1.totalTaxableValue,
      igst: gstr1.totalIgst,
      cgst: gstr1.totalCgst,
      sgst: gstr1.totalSgst,
      cess: '0.00',
    };

    // 2. Inward supplies eligible for ITC (from vendor_bills)
    let billWhere = `WHERE vb.status IN ('confirmed')`;
    const billParams: any[] = [];

    if (filters?.year) {
      billParams.push(filters.year);
      billWhere += ` AND EXTRACT(YEAR FROM vb.bill_date) = $${billParams.length}`;
    }
    if (filters?.month) {
      billParams.push(filters.month);
      billWhere += ` AND EXTRACT(MONTH FROM vb.bill_date) = $${billParams.length}`;
    }

    const billsRes = await clientOrPool.query(
      `SELECT 
        vb.subtotal,
        vb.tax_total,
        c.state as vendor_state,
        c.gstin as vendor_gstin
       FROM vendor_bills vb
       JOIN contacts c ON c.id = vb.vendor_id
       ${billWhere}`,
      billParams
    );

    let itcTaxable = new Decimal(0);
    let itcCgst = new Decimal(0);
    let itcSgst = new Decimal(0);
    let itcIgst = new Decimal(0);

    for (const bill of billsRes.rows) {
      const sub = new Decimal(bill.subtotal || 0);
      const tax = new Decimal(bill.tax_total || 0);
      itcTaxable = itcTaxable.plus(sub);

      const vState = (bill.vendor_state || '').toLowerCase();
      const vGstin = (bill.vendor_gstin || '').trim();
      const isMaha = vState.includes('maha') || vState === 'mh' || vGstin.startsWith('27') || (!vState && !vGstin);

      if (isMaha) {
        const half = tax.dividedBy(2);
        itcCgst = itcCgst.plus(half);
        itcSgst = itcSgst.plus(half);
      } else {
        itcIgst = itcIgst.plus(tax);
      }
    }

    const itcAvailable: Gstr3BTable = {
      taxableValue: itcTaxable.toFixed(2),
      igst: itcIgst.toFixed(2),
      cgst: itcCgst.toFixed(2),
      sgst: itcSgst.toFixed(2),
      cess: '0.00',
    };

    // 3. Compute Net Tax Payable in Cash = Max(0, Outward - Inward ITC)
    const outCgst = new Decimal(outwardSupplies.cgst);
    const outSgst = new Decimal(outwardSupplies.sgst);
    const outIgst = new Decimal(outwardSupplies.igst);

    const netCgst = Decimal.max(0, outCgst.minus(itcCgst));
    const netSgst = Decimal.max(0, outSgst.minus(itcSgst));
    const netIgst = Decimal.max(0, outIgst.minus(itcIgst));

    const netTaxPayable: Gstr3BTable = {
      taxableValue: outwardSupplies.taxableValue,
      igst: netIgst.toFixed(2),
      cgst: netCgst.toFixed(2),
      sgst: netSgst.toFixed(2),
      cess: '0.00',
    };

    const periodStr = periodLabel(filters);

    return {
      period: periodStr,
      sellerGstin: SELLER_GSTIN,
      sellerName: SELLER_LEGAL_NAME,
      outwardSupplies,
      itcAvailable,
      netTaxPayable,
    };
  }

  /**
   * GSTR-2B — auto-drafted inward supplies / Input Tax Credit ledger.
   * One row per confirmed vendor bill, split intra/inter-state; ITC is
   * eligible only when the vendor carries a valid 15-char GSTIN.
   */
  static async getGstr2BSummary(
    filters?: { year?: number; month?: number },
    clientOrPool: PoolClient | typeof pool = pool
  ): Promise<Gstr2BSummary> {
    let where = `WHERE vb.status = 'confirmed'`;
    const params: any[] = [];
    if (filters?.year) {
      params.push(filters.year);
      where += ` AND EXTRACT(YEAR FROM vb.bill_date) = $${params.length}`;
    }
    if (filters?.month) {
      params.push(filters.month);
      where += ` AND EXTRACT(MONTH FROM vb.bill_date) = $${params.length}`;
    }

    const res = await clientOrPool.query(
      `SELECT vb.id, vb.number, vb.bill_reference, vb.bill_date, vb.subtotal, vb.tax_total, vb.total,
              c.name AS vendor_name, c.gstin AS vendor_gstin, c.state AS vendor_state
       FROM vendor_bills vb
       JOIN contacts c ON c.id = vb.vendor_id
       ${where}
       ORDER BY vb.bill_date ASC, vb.id ASC`,
      params
    );

    let tTaxable = new Decimal(0);
    let tCgst = new Decimal(0);
    let tSgst = new Decimal(0);
    let tIgst = new Decimal(0);
    let tVal = new Decimal(0);
    const registeredVendors = new Set<string>();

    const records: Gstr2BRecord[] = res.rows.map((b) => {
      const gstin = (b.vendor_gstin || '').trim();
      const state = (b.vendor_state || '').trim();
      const isIntra =
        state.toLowerCase().includes('maha') ||
        state.toLowerCase() === 'mh' ||
        gstin.startsWith('27') ||
        (!state && !gstin);
      const itcEligible = gstin.length >= 15;
      if (itcEligible) registeredVendors.add(gstin);

      const taxable = new Decimal(b.subtotal || 0);
      const tax = new Decimal(b.tax_total || 0);
      const value = new Decimal(b.total || 0);
      let cgst = new Decimal(0);
      let sgst = new Decimal(0);
      let igst = new Decimal(0);
      if (isIntra) {
        cgst = tax.dividedBy(2);
        sgst = tax.dividedBy(2);
      } else {
        igst = tax;
      }

      tTaxable = tTaxable.plus(taxable);
      tVal = tVal.plus(value);
      if (itcEligible) {
        tCgst = tCgst.plus(cgst);
        tSgst = tSgst.plus(sgst);
        tIgst = tIgst.plus(igst);
      }

      return {
        billId: b.id,
        billNumber: b.number,
        billReference: b.bill_reference || null,
        billDate: b.bill_date ? new Date(b.bill_date).toISOString().split('T')[0] : '',
        vendorName: b.vendor_name,
        vendorGstin: gstin || 'UNREGISTERED',
        placeOfSupply: isIntra ? '27-Maharashtra' : state || 'Inter-State',
        supplyType: isIntra ? 'INTRA_STATE' : 'INTER_STATE',
        taxableValue: taxable.toFixed(2),
        cgstAmount: cgst.toFixed(2),
        sgstAmount: sgst.toFixed(2),
        igstAmount: igst.toFixed(2),
        totalTax: cgst.plus(sgst).plus(igst).toFixed(2),
        invoiceValue: value.toFixed(2),
        itcEligible,
      };
    });

    return {
      period: periodLabel(filters),
      sellerGstin: SELLER_GSTIN,
      sellerName: SELLER_LEGAL_NAME,
      billCount: records.length,
      registeredVendorCount: registeredVendors.size,
      totalTaxableValue: tTaxable.toFixed(2),
      totalCgst: tCgst.toFixed(2),
      totalSgst: tSgst.toFixed(2),
      totalIgst: tIgst.toFixed(2),
      totalItc: tCgst.plus(tSgst).plus(tIgst).toFixed(2),
      totalInvoiceValue: tVal.toFixed(2),
      records,
    };
  }

  /**
   * List all E-Way Bill eligible shipments (> ₹50,000 threshold)
   */
  static async listEWayBills(clientOrPool: PoolClient | typeof pool = pool) {
    const res = await clientOrPool.query(
      `SELECT 
        ci.id,
        ci.number,
        ci.invoice_date,
        ci.total,
        ci.status,
        c.name as customer_name,
        c.gstin as customer_gstin,
        c.city as customer_city,
        c.state as customer_state,
        c.pincode as customer_pincode
       FROM customer_invoices ci
       JOIN contacts c ON c.id = ci.customer_id
       WHERE ci.total >= 50000 AND ci.status IN ('confirmed')
       ORDER BY ci.invoice_date DESC, ci.id DESC`
    );

    return res.rows.map(r => {
      const invDate = r.invoice_date ? new Date(r.invoice_date).toISOString().split('T')[0] : '';
      const ewbNo = GstService.generateEWayBillNumber(r.id, r.number);
      const validUntil = new Date(new Date(invDate).getTime() + 48 * 60 * 60 * 1000).toISOString().split('T')[0];

      return {
        invoiceId: r.id,
        invoiceNumber: r.number,
        invoiceDate: invDate,
        customerName: r.customer_name,
        customerGstin: r.customer_gstin || 'URP-UNREGISTERED',
        destination: `${r.customer_city || ''}, ${r.customer_state || 'Maharashtra'} - ${r.customer_pincode || ''}`.trim(),
        totalValue: new Decimal(r.total).toFixed(2),
        ewayBillNo: ewbNo,
        validUntil,
        status: 'VALID',
        vehicleNo: 'MH-02-CE-8821',
        transporter: 'Apex Furniture Logistics Pvt Ltd',
      };
    });
  }
}
