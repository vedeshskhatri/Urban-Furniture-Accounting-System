import puppeteer from 'puppeteer';
import fs from 'fs';
import { CustomerInvoiceDTO } from './invoiceService';
import { GstService, SELLER_GSTIN, SELLER_LEGAL_NAME, SELLER_STATE, DEFAULT_FURNITURE_HSN } from './gstService';
import { QrMatrixGenerator } from './qrMatrix';

export class PdfService {
  static generateInvoiceHtml(invoice: CustomerInvoiceDTO): string {
    const invoiceDate = invoice.invoiceDate || new Date().toISOString().split('T')[0];
    const finYear = GstService.getFinancialYear(invoiceDate);
    const irn = GstService.generateIrn(SELLER_GSTIN, finYear, 'INV', invoice.number);
    const ackNo = GstService.generateAckNumber(invoice.id, invoiceDate);
    const ackDate = `${invoiceDate} 10:00:00 IST`;
    const isEWayBill = parseFloat(invoice.total || '0') >= 50000;
    const ewbNo = isEWayBill ? GstService.generateEWayBillNumber(invoice.id, invoice.number) : null;

    // Offline Vector QR Code
    const qrPayload = {
      SellerGSTIN: SELLER_GSTIN,
      BuyerGSTIN: 'URP-CONSUMER',
      DocNo: invoice.number,
      DocTyp: 'INV',
      DocDt: invoiceDate,
      TotInvVal: parseFloat(invoice.total || '0'),
      ItemCnt: invoice.lines.length,
      MainHsnCode: DEFAULT_FURNITURE_HSN,
      Irn: irn,
      EwbNo: ewbNo,
    };
    const qrDataUrl = QrMatrixGenerator.renderDataUrl(JSON.stringify(qrPayload), {
      size: 160,
      margin: 2,
    });

    // CGST & SGST Split (Intra-state Maharashtra default)
    const taxTotalNum = parseFloat(invoice.taxTotal || '0');
    const cgstAmount = (taxTotalNum / 2).toFixed(2);
    const sgstAmount = (taxTotalNum / 2).toFixed(2);

    const linesHtml = invoice.lines
      .map(
        (line, index) => `
        <tr>
          <td style="padding: 10px 12px; border-bottom: 1px solid #E5DFD7; text-align: center; font-size: 13px;">${index + 1}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #E5DFD7; font-size: 13px;">
            <strong>${line.productName}</strong>
            <div style="font-size: 11px; color: #7B7267;">SKU: ${line.productSku || '-'}</div>
          </td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #E5DFD7; font-size: 12px; font-family: monospace; color: #574F45;">${DEFAULT_FURNITURE_HSN}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #E5DFD7; font-size: 12px; color: #574F45;">${line.analyticAccountName || 'General'}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #E5DFD7; text-align: right; font-family: monospace; font-size: 13px;">${line.qty}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #E5DFD7; text-align: right; font-family: monospace; font-size: 13px;">₹${parseFloat(line.unitPrice).toFixed(2)}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #E5DFD7; text-align: right; font-family: monospace; font-size: 13px;">${line.taxRate}%</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #E5DFD7; text-align: right; font-family: monospace; font-weight: 600; font-size: 13px;">₹${parseFloat(line.total).toFixed(2)}</td>
        </tr>
      `
      )
      .join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Invoice - ${invoice.number}</title>
        <style>
          @page {
            size: A4;
            margin: 12mm 15mm 15mm 15mm;
          }
          @media print {
            .no-print-bar {
              display: none !important;
            }
            body {
              padding: 0 !important;
              background: #FFFFFF !important;
            }
            .page-container {
              padding: 0 !important;
            }
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            color: #26211C;
            background: #FAF8F5;
            margin: 0;
            padding: 0;
            font-size: 13px;
            line-height: 1.5;
          }
          .no-print-bar {
            position: sticky;
            top: 0;
            background: #382A24;
            color: #FAF8F5;
            padding: 12px 24px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            box-shadow: 0 2px 10px rgba(0,0,0,0.18);
            z-index: 9999;
          }
          .print-btn {
            background: #EBD7BE;
            color: #382A24;
            border: 1px solid #D0AE92;
            font-weight: 700;
            padding: 8px 18px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 13px;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            transition: all 120ms ease;
          }
          .print-btn:hover {
            background: #DFCAAE;
          }
          .close-btn {
            background: transparent;
            color: #EBD7BE;
            border: 1px solid rgba(235, 215, 190, 0.4);
            padding: 8px 14px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 13px;
          }
          .close-btn:hover {
            background: rgba(235, 215, 190, 0.15);
          }
          .page-container {
            max-width: 800px;
            margin: 24px auto;
            background: #FFFFFF;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 12px rgba(74, 58, 52, 0.08);
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #26211C;
            padding-bottom: 16px;
            margin-bottom: 24px;
          }
          .brand {
            font-size: 22px;
            font-weight: 800;
            letter-spacing: -0.5px;
            color: #26211C;
          }
          .badge {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .badge-confirmed { background: #E6F4EA; color: #137333; }
          .badge-draft { background: #F1F3F4; color: #5F6368; }
          .badge-paid { background: #E6F4EA; color: #137333; }
          .badge-partial { background: #FEF7E0; color: #B06000; }
          .badge-not_paid { background: #FCE8E6; color: #C5221F; }
          .meta-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 24px;
            margin-bottom: 28px;
          }
          .meta-box {
            background: #FAF8F5;
            border: 1px solid #E5DFD7;
            border-radius: 8px;
            padding: 14px 16px;
          }
          .meta-title {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            color: #7B7267;
            margin-bottom: 6px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 24px;
          }
          th {
            background: #F2ECE4;
            padding: 10px 12px;
            border-bottom: 2px solid #D5CCC0;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #4A4237;
          }
          .totals-section {
            display: flex;
            justify-content: flex-end;
          }
          .totals-box {
            width: 300px;
            background: #FAF8F5;
            border: 1px solid #E5DFD7;
            border-radius: 8px;
            padding: 16px;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            padding: 6px 0;
            font-size: 13px;
            color: #574F45;
          }
          .total-row.grand-total {
            border-top: 2px solid #26211C;
            margin-top: 8px;
            padding-top: 10px;
            font-weight: 800;
            font-size: 15px;
            color: #26211C;
          }
          .footer {
            margin-top: 48px;
            padding-top: 16px;
            border-top: 1px solid #E5DFD7;
            font-size: 11px;
            color: #7B7267;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="no-print-bar">
          <div style="font-size: 13px; font-weight: 600;">
            <span style="color: #EBD7BE; font-weight: 800;">URBAN FURNITURE</span> &nbsp;•&nbsp; Official Invoice Document (${invoice.number})
          </div>
          <div style="display: flex; gap: 8px;">
            <button type="button" class="print-btn" onclick="window.print()">
              🖨️ Print / Save as PDF
            </button>
            <button type="button" class="close-btn" onclick="window.close()">
              ✕ Close
            </button>
          </div>
        </div>

        <div class="page-container">
          <!-- Official GST e-Invoice IRN & QR Header Seal -->
          <div style="background: #F5EFEB; border: 1.5px solid #D5CCC0; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
            <div style="flex: 1; padding-right: 16px;">
              <div style="font-size: 11px; font-weight: 800; color: #4A3A34; letter-spacing: 0.5px; text-transform: uppercase;">
                🇮🇳 TAX INVOICE • B2B e-INVOICE (NIC IRN VERIFIED)
              </div>
              <div style="font-size: 10px; font-family: monospace; color: #382A24; margin-top: 4px; word-break: break-all;">
                <strong>IRN:</strong> ${irn}
              </div>
              <div style="font-size: 11px; color: #665C54; margin-top: 4px; display: flex; gap: 16px; flex-wrap: wrap;">
                <span>Ack No: <strong style="font-family: monospace;">${ackNo}</strong></span>
                <span>Ack Date: <strong style="font-family: monospace;">${ackDate}</strong></span>
                <span>Principal HSN: <strong style="font-family: monospace;">${DEFAULT_FURNITURE_HSN}</strong></span>
              </div>
            </div>
            <div style="text-align: center; shrink: 0; background: #FFFFFF; padding: 6px 8px; border: 1px solid #D5CCC0; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
              <img src="${qrDataUrl}" width="80" height="80" style="display: block;" alt="GST e-Invoice QR Code" />
              <div style="font-size: 8px; font-weight: 800; color: #4A3A34; margin-top: 3px; letter-spacing: 0.5px;">OFFLINE QR</div>
            </div>
          </div>

          ${isEWayBill ? `
          <div style="background: #E8F0FE; border: 1.5px solid #AECBFA; color: #1967D2; padding: 8px 14px; border-radius: 6px; font-size: 12px; font-weight: 600; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
            <span>🚚 <strong>Statutory E-Way Bill Attached</strong> (Rule 138 - Value &gt; ₹50,000)</span>
            <span style="font-family: monospace; font-weight: 800; background: #FFFFFF; padding: 2px 8px; border-radius: 4px; border: 1px solid #AECBFA;">EWB No: ${ewbNo} (Valid 48h)</span>
          </div>` : ''}

          <div class="header">
            <div style="display: flex; align-items: center; gap: 12px;">
              <svg width="40" height="40" viewBox="0 0 1000 1000" fill="#4A3A34">
                <path d="M 252 637 L 254 637 L 255 638 L 259 638 L 260 637 L 262 637 L 263 638 L 291 638 L 293 637 L 295 638 L 295 642 L 294 643 L 294 654 L 293 655 L 293 673 L 292 674 L 292 688 L 291 689 L 291 697 L 290 698 L 290 717 L 289 718 L 289 732 L 288 733 L 288 742 L 287 743 L 287 758 L 286 759 L 286 773 L 285 774 L 285 784 L 284 785 L 284 803 L 283 804 L 283 818 L 282 819 L 282 828 L 281 829 L 281 848 L 280 849 L 280 858 L 279 859 L 271 859 L 270 860 L 268 860 L 266 857 L 266 846 L 265 845 L 265 837 L 264 836 L 264 814 L 263 813 L 263 805 L 262 804 L 262 793 L 261 792 L 261 773 L 260 772 L 260 757 L 259 756 L 259 750 L 258 749 L 258 731 L 257 730 L 257 716 L 256 715 L 256 705 L 255 704 L 255 685 L 254 684 L 254 672 L 253 671 L 253 664 L 252 663 L 252 648 L 251 647 L 251 644 L 252 643 L 251 642 L 251 638 L 252 637 Z" />
              </svg>
              <div>
                <div class="brand">URBAN FURNITURE</div>
                <div style="color: #574F45; font-size: 12px; font-weight: 600; margin-top: 2px;">${SELLER_LEGAL_NAME}</div>
                <div style="color: #7B7267; font-size: 11px;">GSTIN: <strong style="color: #382A24; font-family: monospace;">${SELLER_GSTIN}</strong> &nbsp;•&nbsp; State: <strong>${SELLER_STATE} (27)</strong></div>
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 20px; font-weight: 800; font-family: monospace;">${invoice.number}</div>
              <div style="margin-top: 6px;">
                <span class="badge badge-${invoice.status}">${invoice.status}</span>
                <span class="badge badge-${invoice.paymentStatus}" style="margin-left: 6px;">${invoice.paymentStatus.replace('_', ' ')}</span>
              </div>
            </div>
          </div>

          <div class="meta-grid">
            <div class="meta-box">
              <div class="meta-title">Billed To (Buyer)</div>
              <div style="font-size: 15px; font-weight: 700; color: #26211C;">${invoice.customerName}</div>
              <div style="color: #574F45; font-size: 12px; margin-top: 4px;">Customer ID: #${invoice.customerId}</div>
              <div style="color: #574F45; font-size: 12px; margin-top: 2px;">Place of Supply: <strong>Maharashtra (27)</strong></div>
              ${invoice.soNumber ? `<div style="color: #574F45; font-size: 12px; margin-top: 2px;">Originating SO: <strong>${invoice.soNumber}</strong></div>` : ''}
            </div>

            <div class="meta-box">
              <div class="meta-title">Invoice Details</div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span style="color: #574F45;">Invoice Date:</span>
                <strong style="font-family: monospace;">${invoice.invoiceDate}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span style="color: #574F45;">Due Date:</span>
                <strong style="font-family: monospace;">${invoice.dueDate || '-'}</strong>
              </div>
              ${invoice.journalEntryNumber ? `
              <div style="display: flex; justify-content: space-between;">
                <span style="color: #574F45;">Journal Entry:</span>
                <strong style="font-family: monospace;">${invoice.journalEntryNumber}</strong>
              </div>` : ''}
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 40px; text-align: center;">#</th>
                <th style="text-align: left;">Product / Item</th>
                <th style="width: 70px; text-align: left;">HSN</th>
                <th style="text-align: left;">Analytics</th>
                <th style="width: 60px; text-align: right;">Qty</th>
                <th style="width: 90px; text-align: right;">Unit Price</th>
                <th style="width: 60px; text-align: right;">Tax Rate</th>
                <th style="width: 100px; text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${linesHtml}
            </tbody>
          </table>

          <div class="totals-section">
            <div class="totals-box">
              <div class="total-row">
                <span>Taxable Amount:</span>
                <span style="font-family: monospace;">₹${parseFloat(invoice.subtotal).toFixed(2)}</span>
              </div>
              <div class="total-row">
                <span>CGST (Central Tax):</span>
                <span style="font-family: monospace;">₹${cgstAmount}</span>
              </div>
              <div class="total-row">
                <span>SGST (State Tax):</span>
                <span style="font-family: monospace;">₹${sgstAmount}</span>
              </div>
              <div class="total-row" style="border-top: 1px dashed #D5CCC0; padding-top: 6px; font-weight: 600;">
                <span>Total Tax (GST):</span>
                <span style="font-family: monospace;">₹${parseFloat(invoice.taxTotal).toFixed(2)}</span>
              </div>
              <div class="total-row grand-total">
                <span>Invoice Total:</span>
                <span style="font-family: monospace;">₹${parseFloat(invoice.total).toFixed(2)}</span>
              </div>
              <div class="total-row" style="margin-top: 8px; color: #137333;">
                <span>Amount Paid:</span>
                <span style="font-family: monospace;">- ₹${parseFloat(invoice.amountPaid).toFixed(2)}</span>
              </div>
              <div class="total-row" style="font-weight: 700; color: ${parseFloat(invoice.amountDue) > 0 ? '#C5221F' : '#137333'};">
                <span>Amount Due:</span>
                <span style="font-family: monospace;">₹${parseFloat(invoice.amountDue).toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div class="footer">
            Generated deterministically by Urban Furniture Accounting Engine · Strictly Offline &amp; Immutable
          </div>
        </div>

        <script>
          window.addEventListener('DOMContentLoaded', function() {
            setTimeout(function() {
              try { window.print(); } catch (e) {}
            }, 350);
          });
        </script>
      </body>
      </html>
    `;
  }

  /**
   * Generic HTML -> PDF renderer using the same server-side Puppeteer pipeline
   * that backs invoice export. Callers own the HTML (including <style>).
   */
  static async renderHtmlToPdf(html: string): Promise<Buffer> {
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH ||
      (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);

    const browser = await puppeteer.launch({
      headless: true,
      executablePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'domcontentloaded' });
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' },
      });
      return Buffer.from(pdfBuffer);
    } finally {
      await browser.close();
    }
  }

  static async generateInvoicePdf(invoice: CustomerInvoiceDTO): Promise<Buffer> {
    const html = this.generateInvoiceHtml(invoice);
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH ||
      (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);

    const browser = await puppeteer.launch({
      headless: true,
      executablePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'domcontentloaded' });
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '12mm',
          right: '12mm',
          bottom: '12mm',
          left: '12mm',
        },
      });
      return Buffer.from(pdfBuffer);
    } finally {
      await browser.close();
    }
  }
}
