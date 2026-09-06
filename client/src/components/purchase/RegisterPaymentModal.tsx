import React, { useState } from 'react';
import Decimal from 'decimal.js';
import { VendorBillsApi } from '../../api/vendorBills.api';
import { CustomerInvoicesApi } from '../../api/customerInvoices.api';
import { VendorBill } from '@shared/schemas/vendorBill.schema';
import { CustomerInvoiceDTO } from '@shared/schemas/invoice';
import { X, CheckCircle2, AlertTriangle, DollarSign, CreditCard, Building2, Printer, Send } from 'lucide-react';

export interface RegisterPaymentModalProps {
  bill?: VendorBill | null;
  invoice?: CustomerInvoiceDTO | null;
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess: (payment: any) => void;
}

export const RegisterPaymentModal: React.FC<RegisterPaymentModalProps> = ({
  bill,
  invoice,
  isOpen,
  onClose,
  onPaymentSuccess,
}) => {
  if (!isOpen) return null;

  const isInvoice = !!invoice;
  const docNumber = isInvoice ? invoice!.number : (bill?.number || '');
  const partnerName = isInvoice ? (invoice!.customerName || `Customer #${invoice!.customerId}`) : (bill?.vendor_name || `Vendor #${bill?.vendor_id}`);

  const totalAmount = isInvoice
    ? (invoice!.total || invoice!.totalAmount || '0.00')
    : (bill?.total || bill?.grand_total || bill?.total_amount || '0.00');

  const maxDue = isInvoice
    ? (invoice!.amountDue !== undefined && invoice!.amountDue !== null ? String(invoice!.amountDue) : String(totalAmount))
    : (bill?.amount_due ? String(bill.amount_due) : String(totalAmount));

  const [paymentType, setPaymentType] = useState<'send' | 'receive'>(
    isInvoice ? 'receive' : 'send'
  );
  const [amount, setAmount] = useState<string>(maxDue);
  const [method, setMethod] = useState<'cash' | 'bank'>('bank');
  const [paymentDate, setPaymentDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [memo, setMemo] = useState<string>(
    isInvoice ? `Payment received for ${docNumber}` : `Payment for ${docNumber}`
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Dedicated Printable Voucher Handler
  const handlePrint = () => {
    const html = `<!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Payment Voucher - ${docNumber}</title>
      <style>
        @page { size: A4; margin: 15mm; }
        @media print {
          .no-print-bar { display: none !important; }
          body { background: #FFFFFF !important; padding: 0 !important; }
          .voucher { box-shadow: none !important; margin: 0 !important; border: 1.5px solid #26211C !important; }
        }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #26211C; background: #FAF8F5; margin: 0; padding: 0; font-size: 13px; line-height: 1.5; }
        .no-print-bar { position: sticky; top: 0; background: #382A24; color: #FAF8F5; padding: 12px 24px; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 2px 10px rgba(0,0,0,0.18); z-index: 9999; }
        .print-btn { background: #EBD7BE; color: #382A24; border: 1px solid #D0AE92; font-weight: 700; padding: 8px 18px; border-radius: 6px; cursor: pointer; font-size: 13px; }
        .close-btn { background: transparent; color: #EBD7BE; border: 1px solid rgba(235, 215, 190, 0.4); padding: 8px 14px; border-radius: 6px; cursor: pointer; font-size: 13px; }
        .voucher { max-width: 760px; margin: 24px auto; background: #FFFFFF; padding: 40px; border-radius: 8px; box-shadow: 0 2px 12px rgba(74, 58, 52, 0.08); border: 1.5px solid #26211C; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #26211C; padding-bottom: 16px; margin-bottom: 24px; }
        .brand { font-size: 20px; font-weight: 800; color: #26211C; }
        .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #E5DFD7; }
        .label { color: #574F45; font-size: 12px; font-weight: 600; text-transform: uppercase; }
        .val { font-weight: 700; color: #26211C; }
        .amount-box { margin: 24px 0; padding: 16px; background: #FAF8F5; border: 1.5px solid #D0AE92; border-radius: 6px; text-align: center; }
        .amount-val { font-size: 28px; font-weight: 800; font-family: monospace; color: #26211C; }
        .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 60px; }
        .sign-line { border-top: 1px solid #26211C; padding-top: 8px; text-align: center; font-size: 11px; font-weight: 600; text-transform: uppercase; color: #574F45; }
      </style>
    </head>
    <body>
      <div class="no-print-bar">
        <div style="font-size: 13px; font-weight: 600;">
          <span style="color: #EBD7BE; font-weight: 800;">URBAN FURNITURE</span> &nbsp;•&nbsp; Official Payment Voucher (${docNumber})
        </div>
        <div style="display: flex; gap: 8px;">
          <button type="button" class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
          <button type="button" class="close-btn" onclick="window.close()">✕ Close</button>
        </div>
      </div>

      <div class="voucher">
        <div class="header">
          <div>
            <div class="brand">URBAN FURNITURE</div>
            <div style="color: #7B7267; font-size: 12px; margin-top: 2px;">Enterprise Ledger &amp; Double-Entry Accounting</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 18px; font-weight: 800; color: #26211C;">OFFICIAL PAYMENT VOUCHER</div>
            <div style="font-size: 12px; color: #7B7267; margin-top: 4px;">Date: ${paymentDate}</div>
          </div>
        </div>

        <div class="row">
          <span class="label">Document Ref</span>
          <span class="val" style="font-family: monospace;">${docNumber}</span>
        </div>
        <div class="row">
          <span class="label">Party / Partner</span>
          <span class="val">${partnerName}</span>
        </div>
        <div class="row">
          <span class="label">Payment Type</span>
          <span class="val" style="text-transform: uppercase;">${isInvoice ? 'Customer Receipt (Inflow)' : 'Vendor Payment (Outflow)'}</span>
        </div>
        <div class="row">
          <span class="label">Payment Method</span>
          <span class="val" style="text-transform: uppercase;">${method === 'bank' ? 'Bank Transfer' : 'Cash on Hand'}</span>
        </div>
        <div class="row">
          <span class="label">Debit Account</span>
          <span class="val" style="font-family: monospace;">${isInvoice ? (method === 'bank' ? 'Bank Accounts (1020)' : 'Cash on Hand (1010)') : 'Accounts Payable / Sundry Creditors (2000)'}</span>
        </div>
        <div class="row">
          <span class="label">Credit Account</span>
          <span class="val" style="font-family: monospace;">${isInvoice ? 'Accounts Receivable / Sundry Debtors (1200)' : (method === 'bank' ? 'Bank Accounts (1020)' : 'Cash on Hand (1010)')}</span>
        </div>
        <div class="row">
          <span class="label">Memo / Description</span>
          <span class="val">${memo || '—'}</span>
        </div>

        <div class="amount-box">
          <div class="label" style="margin-bottom: 6px;">Total Amount Paid</div>
          <div class="amount-val">₹${amount}</div>
        </div>

        <div class="signatures">
          <div class="sign-line">Prepared By (Cashier / Accountant)</div>
          <div class="sign-line">Authorized Signatory / Seal</div>
        </div>

        <div style="margin-top: 40px; text-align: center; font-size: 10.5px; color: #7B7267; border-top: 1px solid #E5DFD7; padding-top: 12px;">
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
    </html>`;

    const printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.write(html);
      printWin.document.close();
      printWin.focus();
    }
  };

  // Compute remaining balance if this payment is submitted
  let projectedRemaining = '0.00';
  let isOverpayment = false;
  let isInvalidAmount = false;

  try {
    const dueDec = new Decimal(maxDue || '0');
    const payDec = new Decimal(amount || '0');

    if (payDec.lte(0)) {
      isInvalidAmount = true;
    } else if (payDec.gt(dueDec)) {
      isOverpayment = true;
    } else {
      projectedRemaining = dueDec.minus(payDec).toFixed(2);
    }
  } catch {
    isInvalidAmount = true;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isInvalidAmount || isOverpayment) return;

    try {
      setLoading(true);
      setError(null);

      let payment: any;
      if (isInvoice) {
        payment = await CustomerInvoicesApi.registerPayment(invoice!.id, {
          amount: new Decimal(amount).toFixed(2),
          method,
          paymentDate,
        });
      } else {
        payment = await VendorBillsApi.registerPayment(bill!.id!, {
          amount: new Decimal(amount).toFixed(2),
          method,
          paymentDate,
        });
      }

      onPaymentSuccess(payment);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Payment processing failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brown-900/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface rounded-2xl border border-brown-200 shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-brown-800 text-cream flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-cream/10 rounded-lg">
              <DollarSign className="w-5 h-5 text-cream" />
            </div>
            <div>
              <h3 className="font-heading font-semibold text-lg leading-tight">
                {isInvoice ? 'Register Customer Payment' : 'Register Bill Payment'}
              </h3>
              <p className="text-xs text-cream/70 font-mono">
                {docNumber} • {partnerName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-cream/70 hover:text-cream hover:bg-cream/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Wireframe 9 & 10: Payment Type & Partner Row */}
          <div className="p-3.5 bg-brown-50/80 rounded-xl border border-brown-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <label className="block text-[11px] font-bold text-brown-800 uppercase tracking-wider mb-1.5">
                  Payment Type *
                </label>
                <div className="flex items-center gap-5 text-sm font-medium text-brown-900">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="paymentType"
                      value="send"
                      checked={paymentType === 'send'}
                      onChange={() => setPaymentType('send')}
                      className="text-brown-900 focus:ring-brown-600"
                    />
                    <span>Send (Outbound / Vendor)</span>
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="paymentType"
                      value="receive"
                      checked={paymentType === 'receive'}
                      onChange={() => setPaymentType('receive')}
                      className="text-brown-900 focus:ring-brown-600"
                    />
                    <span>Receive (Inbound / Customer)</span>
                  </label>
                </div>
              </div>

              <div>
                <span className="block text-[11px] font-bold text-brown-800 uppercase tracking-wider mb-1">
                  Partner
                </span>
                <span className="text-sm font-semibold text-brown-900 bg-surface px-3 py-1 rounded-md border border-brown-200 inline-block">
                  {partnerName}
                </span>
              </div>
            </div>
          </div>

          {/* Amount Overview Cards */}
          <div className="grid grid-cols-3 gap-3 p-3.5 bg-brown-50/60 rounded-xl border border-brown-100">
            <div>
              <span className="block text-[11px] font-medium text-brown-600 uppercase tracking-wider">
                {isInvoice ? 'Total Invoice' : 'Total Bill'}
              </span>
              <span className="text-sm font-semibold font-mono text-brown-900">
                ₹{Number(totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div>
              <span className="block text-[11px] font-medium text-brown-600 uppercase tracking-wider">
                Current Due
              </span>
              <span className="text-sm font-bold font-mono text-amber-700">
                ₹{Number(maxDue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div>
              <span className="block text-[11px] font-medium text-brown-600 uppercase tracking-wider">
                Post-Pay Due
              </span>
              <span className="text-sm font-bold font-mono text-emerald-700">
                ₹{Number(projectedRemaining).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Payment Amount Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-brown-800 uppercase tracking-wider">
                Payment Amount (₹) *
              </label>
              <button
                type="button"
                onClick={() => setAmount(maxDue)}
                className="text-[11px] font-semibold text-brown-700 hover:text-brown-900 underline"
              >
                Pay Full Balance
              </button>
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-brown-500 text-sm">
                ₹
              </span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={maxDue}
                value={amount}
                onChange={e => setAmount(e.target.value)}
                required
                className="w-full pl-8 pr-4 py-2.5 bg-surface border border-brown-300 rounded-xl text-base font-mono font-bold text-brown-900 focus:outline-none focus:ring-2 focus:ring-brown-600 focus:border-brown-600 shadow-sm"
                placeholder="0.00"
              />
            </div>
            {isOverpayment && (
              <p className="mt-1 text-xs text-red-600 font-medium">
                Payment amount cannot exceed current due balance of ₹{maxDue}.
              </p>
            )}
            {!isOverpayment && Number(amount) < Number(maxDue) && Number(amount) > 0 && (
              <p className="mt-1 text-xs text-amber-700 font-medium">
                ⚡ Partial Payment: ₹{projectedRemaining} will remain outstanding.
              </p>
            )}
          </div>

          {/* Payment Method Selector */}
          <div>
            <label className="block text-xs font-semibold text-brown-800 uppercase tracking-wider mb-2">
              Payment Method *
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMethod('bank')}
                className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border font-medium text-sm transition-all ${
                  method === 'bank'
                    ? 'border-brown-700 bg-brown-50 text-brown-900 font-semibold shadow-sm ring-1 ring-brown-600'
                    : 'border-brown-200 bg-surface text-brown-600 hover:bg-brown-50/50'
                }`}
              >
                <Building2 className="w-4 h-4 text-brown-700" />
                <span>Bank Transfer</span>
              </button>
              <button
                type="button"
                onClick={() => setMethod('cash')}
                className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border font-medium text-sm transition-all ${
                  method === 'cash'
                    ? 'border-brown-700 bg-brown-50 text-brown-900 font-semibold shadow-sm ring-1 ring-brown-600'
                    : 'border-brown-200 bg-surface text-brown-600 hover:bg-brown-50/50'
                }`}
              >
                <CreditCard className="w-4 h-4 text-brown-700" />
                <span>Cash Payment</span>
              </button>
            </div>
          </div>

          {/* Payment Date & Memo */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-brown-800 uppercase tracking-wider mb-1.5">
                Payment Date
              </label>
              <input
                type="date"
                value={paymentDate}
                onChange={e => setPaymentDate(e.target.value)}
                className="w-full px-3 py-2 bg-surface border border-brown-200 rounded-xl text-xs font-medium text-brown-900 focus:outline-none focus:ring-2 focus:ring-brown-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-brown-800 uppercase tracking-wider mb-1.5">
                Memo / Reference
              </label>
              <input
                type="text"
                value={memo}
                onChange={e => setMemo(e.target.value)}
                className="w-full px-3 py-2 bg-surface border border-brown-200 rounded-xl text-xs text-brown-900 focus:outline-none focus:ring-2 focus:ring-brown-600"
              />
            </div>
          </div>

          {/* Account Posting Info */}
          <div className="p-3 bg-brown-100/50 rounded-xl text-xs text-brown-700 space-y-1">
            <div className="flex justify-between">
              <span className="font-medium">Debit Account:</span>
              <span className="font-mono">
                {isInvoice
                  ? method === 'bank'
                    ? 'Bank Accounts (1020)'
                    : 'Cash on Hand (1010)'
                  : 'Sundry Creditors (2010)'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Credit Account:</span>
              <span className="font-mono">
                {isInvoice
                  ? 'Accounts Receivable / Sundry Debtors (1200)'
                  : method === 'bank'
                  ? 'Bank Accounts (1020)'
                  : 'Cash on Hand (1010)'}
              </span>
            </div>
          </div>

          {/* Action Buttons — Matching Wireframes 9 & 10 (Provide option: 1. Print, 2. Send) */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-brown-800 bg-brown-100 hover:bg-brown-200 border border-brown-300 rounded-xl transition-colors shadow-sm"
              title="Print Payment Voucher"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Voucher</span>
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-brown-700 hover:bg-brown-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || isOverpayment || isInvalidAmount}
                className="inline-flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-cream px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle2 className="w-4 h-4" />
                {loading ? 'Posting Payment...' : 'Confirm & Post Payment'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
