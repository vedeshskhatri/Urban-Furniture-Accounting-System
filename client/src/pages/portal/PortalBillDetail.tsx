import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Decimal from 'decimal.js';
import api from '../../lib/axios';

interface BillLine {
  lineNo: number;
  productName: string;
  qty: string;
  unitPrice: string;
  taxRate: string;
  total: string;
}

interface PaymentHistoryItem {
  allocationId: number;
  paymentNumber: string;
  paymentDate: string;
  method: 'cash' | 'bank';
  direction: 'inbound' | 'outbound';
  amount: string;
}

interface BillDetail {
  id: number;
  number: string;
  billReference?: string;
  billDate: string;
  dueDate: string;
  subtotal: string;
  taxTotal: string;
  total: string;
  amountPaid: string;
  amountDue: string;
  paymentStatus: string;
  lines: BillLine[];
  payments: PaymentHistoryItem[];
}


export const PortalBillDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const billId = Number(id);
  const [bill, setBill] = useState<BillDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Manual payment modal state
  const [showPayModal, setShowPayModal] = useState(false);
  const [payMethod, setPayMethod] = useState<'bank' | 'cash'>('bank');
  const [payAmount, setPayAmount] = useState('');
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [paySuccess, setPaySuccess] = useState<string | null>(null);

  const fetchBill = () => {
    setLoading(true);
    api.get(`/api/portal/bills/${billId}`)
      .then(res => {
        if (res.data?.data) {
          setBill(res.data.data);
          setPayAmount(res.data.data.amountDue || '0.00');
        } else if (res.data?.error) {
          setError(res.data.error.message);
        }
      })
      .catch(err => setError(err?.response?.data?.error?.message || err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchBill();
  }, [billId]);

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setPayError(null);
    setPaySuccess(null);

    const amt = new Decimal(payAmount || '0');
    if (amt.lessThanOrEqualTo(0)) {
      setPayError('Payment amount must be greater than zero');
      return;
    }

    if (bill && amt.greaterThan(new Decimal(bill.amountDue))) {
      setPayError(
        `Payment cannot exceed total amount due of ₹${bill.amountDue}`
      );
      return;
    }

    setPaySubmitting(true);
    try {
      const res = await api.post(`/api/portal/bills/${billId}/pay`, {
        amount: amt.toFixed(2),
        method: payMethod,
      });

      if (res.data?.error) {
        throw new Error(res.data.error.message || 'Payment processing failed');
      }

      setPaySuccess(
        `Payment of ₹${amt.toFixed(2)} recorded! The bill was successfully settled.`
      );
      setTimeout(() => {
        setShowPayModal(false);
        setPaySuccess(null);
        fetchBill();
      }, 1200);
    } catch (err: any) {
      setPayError(err.message || 'Payment submission failed');
    } finally {
      setPaySubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-16 text-center text-brown-600 font-body text-sm">
        Loading vendor bill details...
      </div>
    );
  }

  if (error || !bill) {
    return (
      <div className="py-8 font-body">
        <div className="bg-danger-bg border border-danger text-danger p-6 rounded-xl">
          <h2 className="font-bold text-base mb-1 font-display">Access Error</h2>
          <p className="text-sm">{error || 'Vendor bill not found or unauthorized'}</p>
          <button
            onClick={() => navigate('/portal/bills')}
            className="mt-4 px-4 py-1.5 bg-surface hover:bg-brown-100 text-brown-900 border border-brown-300 rounded-[8px] text-xs font-semibold cursor-pointer"
          >
            ← Back to Bills
          </button>
        </div>
      </div>
    );
  }

  const isFullyPaid = Number(bill.amountDue) <= 0;

  return (
    <div className="space-y-6 font-body">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 no-print print:hidden">
        <button
          onClick={() => navigate('/portal/bills')}
          className="text-xs font-semibold text-brown-700 hover:text-brown-900 flex items-center gap-1 transition-colors font-body cursor-pointer"
        >
          ← Return to Bills
        </button>

        <div className="flex items-center space-x-3">
          {!isFullyPaid && (
            <button
              onClick={() => setShowPayModal(true)}
              className="px-4 py-2 bg-brown-900 hover:bg-brown-800 text-cream font-bold font-display text-xs uppercase tracking-wider rounded-[8px] transition-colors shadow-sm active:scale-[0.99] cursor-pointer"
            >
              💳 Register Payment (₹{bill.amountDue})
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="px-3.5 py-2 bg-surface border border-brown-300 hover:bg-brown-100/50 text-brown-800 font-semibold text-xs rounded-[8px] transition-colors shadow-xs font-body cursor-pointer flex items-center gap-1.5"
          >
            <span>🖨️ Print / Save as PDF</span>
          </button>
        </div>
      </div>

      {/* Main Bill Card */}
      <div className="printable-sheet bg-surface border border-brown-300 rounded-[14px] p-8 shadow-sm print:border-none print:shadow-none print:p-0">
        {/* Document Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-brown-200/60 gap-4">
          <div>
            <span className="text-[11px] font-semibold text-brown-500 uppercase tracking-widest block font-mono">
              Official Vendor Bill
            </span>
            <h1 className="text-3xl font-bold font-display text-brown-900 mt-1">
              {bill.number}
            </h1>
            {bill.billReference && (
              <span className="text-xs text-brown-600 font-mono mt-0.5 block">
                Ref: {bill.billReference}
              </span>
            )}
          </div>
          <div className="text-right">
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                bill.paymentStatus === 'paid'
                  ? 'bg-posted-bg text-posted border-posted/30'
                  : bill.paymentStatus === 'partial'
                  ? 'bg-warning-bg text-warning border-warning/30'
                  : 'bg-danger-bg text-danger border-danger/30'
              }`}
            >
              {bill.paymentStatus.replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* Dates Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 py-6 border-b border-brown-200/60 text-xs">
          <div>
            <span className="text-brown-600 block mb-1 font-body">Bill Date</span>
            <span className="font-mono font-semibold text-brown-900 text-sm">
              {bill.billDate}
            </span>
          </div>
          <div>
            <span className="text-brown-600 block mb-1 font-body">Due Date</span>
            <span className="font-mono font-semibold text-brown-900 text-sm">
              {bill.dueDate || '—'}
            </span>
          </div>
          <div>
            <span className="text-brown-600 block mb-1 font-body">Payment Terms</span>
            <span className="font-semibold text-brown-900 text-sm font-body">
              30 Days Net
            </span>
          </div>
          <div>
            <span className="text-brown-600 block mb-1 font-body">Currency</span>
            <span className="font-semibold text-brown-900 text-sm font-mono">
              INR (₹)
            </span>
          </div>
        </div>

        {/* Lines Table */}
        <div className="py-6 border-b border-brown-200/60 overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-brown-300/40 text-brown-600 text-xs uppercase tracking-wider font-body">
                <th className="pb-3 w-12 font-semibold">#</th>
                <th className="pb-3 font-semibold">Product / Description</th>
                <th className="pb-3 text-right font-semibold">Qty</th>
                <th className="pb-3 text-right font-semibold">Unit Price</th>
                <th className="pb-3 text-right font-semibold">Tax</th>
                <th className="pb-3 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brown-200/40">
              {bill.lines.map(line => (
                <tr key={line.lineNo}>
                  <td className="py-3 text-brown-600 text-xs font-mono">{line.lineNo}</td>
                  <td className="py-3 font-semibold text-brown-900">{line.productName}</td>
                  <td className="py-3 text-right font-mono text-brown-700">{line.qty}</td>
                  <td className="py-3 text-right font-mono text-brown-700">
                    ₹{Number(line.unitPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 text-right font-mono text-brown-600 text-xs">
                    {line.taxRate}%
                  </td>
                  <td className="py-3 text-right font-mono font-bold text-brown-900">
                    ₹{Number(line.total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary Breakdown */}
        <div className="pt-6 flex justify-end">
          <div className="w-full sm:w-72 space-y-2.5 text-xs">
            <div className="flex justify-between text-brown-600 font-body">
              <span>Subtotal:</span>
              <span className="font-mono font-medium text-brown-900">
                ₹{Number(bill.subtotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between text-brown-600 font-body">
              <span>Tax Total:</span>
              <span className="font-mono font-medium text-brown-900">
                ₹{Number(bill.taxTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between text-sm font-bold text-brown-900 border-t border-brown-300 pt-2 font-display">
              <span>Total Bill:</span>
              <span className="font-mono">
                ₹{Number(bill.total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between text-posted font-semibold font-body">
              <span>Amount Paid:</span>
              <span className="font-mono">
                ₹{Number(bill.amountPaid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between text-base font-bold text-brown-900 border-t-2 border-brown-900 pt-2 font-display">
              <span>Remaining Due:</span>
              <span className="font-mono text-brown-900">
                ₹{Number(bill.amountDue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Payment History */}
      {bill.payments && bill.payments.length > 0 && (
        <div className="bg-surface border border-brown-300 rounded-[14px] p-6 shadow-sm">
          <h2 className="text-base font-bold font-display text-brown-900 mb-4">
            Payment History
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-brown-300 text-brown-700 font-semibold uppercase tracking-wider font-body">
                  <th className="pb-2">Payment #</th>
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Method</th>
                  <th className="pb-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brown-200">
                {bill.payments.map(p => (
                  <tr key={p.allocationId}>
                    <td className="py-2.5 font-mono font-semibold text-brown-900">
                      {p.paymentNumber}
                    </td>
                    <td className="py-2.5 font-mono text-brown-700">{p.paymentDate}</td>
                    <td className="py-2.5 uppercase text-[11px] font-semibold text-brown-700">
                      {p.method}
                    </td>
                    <td className="py-2.5 text-right font-mono font-bold text-posted">
                      ₹{Number(p.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Settle Payment Modal */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 bg-brown-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-brown-300 rounded-[16px] max-w-md w-full p-6 shadow-xl font-body">
            <h3 className="text-lg font-bold font-display text-brown-900 mb-1">
              Settle Vendor Bill
            </h3>
            <p className="text-xs text-brown-600 mb-4 font-body">
              Record a manual settlement via Cash or Bank transfer.
            </p>

            {payError && (
              <div className="mb-4 p-3 bg-danger-bg border border-danger text-danger text-xs rounded-md font-body">
                {payError}
              </div>
            )}
            {paySuccess && (
              <div className="mb-4 p-3 bg-posted-bg border border-posted text-posted text-xs rounded-md font-body">
                {paySuccess}
              </div>
            )}

            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-brown-800 mb-1">
                  Payment Method
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPayMethod('bank')}
                    className={`py-2 text-xs font-bold rounded-[8px] border transition-colors cursor-pointer ${
                      payMethod === 'bank'
                        ? 'bg-brown-900 text-cream border-brown-900'
                        : 'bg-cream text-brown-800 border-brown-300 hover:bg-brown-100'
                    }`}
                  >
                    🏦 Bank Transfer
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayMethod('cash')}
                    className={`py-2 text-xs font-bold rounded-[8px] border transition-colors cursor-pointer ${
                      payMethod === 'cash'
                        ? 'bg-brown-900 text-cream border-brown-900'
                        : 'bg-cream text-brown-800 border-brown-300 hover:bg-brown-100'
                    }`}
                  >
                    💵 Cash Receipt
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-brown-800 mb-1">
                  Amount to Settle (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={bill.amountDue}
                  required
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  className="w-full bg-cream border border-brown-400 rounded-[8px] p-2.5 text-sm font-mono font-bold text-brown-900 focus:outline-none focus:ring-2 focus:ring-brown-700"
                />
                <span className="text-[11px] text-brown-500 block mt-1">
                  Total outstanding: ₹{bill.amountDue}
                </span>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-brown-200">
                <button
                  type="button"
                  onClick={() => setShowPayModal(false)}
                  disabled={paySubmitting}
                  className="px-4 py-2 text-xs font-semibold text-brown-700 hover:text-brown-900 font-body cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={paySubmitting}
                  className="px-4 py-2 bg-brown-900 hover:bg-brown-800 text-cream text-xs font-bold font-display uppercase tracking-wider rounded-[8px] shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  {paySubmitting ? 'Recording...' : 'Confirm Settlement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
