import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Decimal from 'decimal.js';
import { BlockingWarning } from './components/Warnings';
import api from '../../lib/axios';

export interface OpenInvoiceItem {
  id: number;
  number: string;
  invoiceDate: string;
  dueDate: string;
  total: string;
  amountPaid: string;
  amountDue: string;
  paymentStatus: string;
}

export const RegisterPaymentPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const invoiceIdParam = searchParams.get('invoiceId');
  const customerIdParam = searchParams.get('customerId');
  const fromParam = searchParams.get('from');
  const isFromReceivables = fromParam === 'receivables';

  const initialInvoiceId = invoiceIdParam ? parseInt(invoiceIdParam, 10) : null;
  const initialCustomerId = customerIdParam ? parseInt(customerIdParam, 10) : 0;

  const [contacts, setContacts] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number>(initialCustomerId);
  const [method, setMethod] = useState<'bank' | 'cash'>('bank');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState<string>('0.00');

  const [openInvoices, setOpenInvoices] = useState<OpenInvoiceItem[]>([]);
  const [allocations, setAllocations] = useState<Record<number, string>>({});

  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Load customer list
  useEffect(() => {
    api.get('/api/contacts?type=customer')
      .then(res => {
        if (res.data?.data) setContacts(res.data.data);
      })
      .catch(() => {});
  }, []);

  // If initialInvoiceId provided, load that invoice to find its customer
  useEffect(() => {
    if (initialInvoiceId) {
      setLoading(true);
      api.get(`/api/invoices/${initialInvoiceId}`)
        .then(res => {
          if (res.data?.data) {
            setSelectedCustomerId(res.data.data.customerId);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [initialInvoiceId]);

  // When selectedCustomerId changes, fetch their open invoices
  useEffect(() => {
    if (!selectedCustomerId) {
      setOpenInvoices([]);
      setAllocations({});
      return;
    }

    setLoading(true);
    api.get(`/api/invoices/open?partner_id=${selectedCustomerId}`)
      .then(res => {
        if (res.data?.data) {
          const invs: OpenInvoiceItem[] = res.data.data;
          setOpenInvoices(invs);

          // If initialInvoiceId matches, auto-allocate full amount_due of that invoice
          if (initialInvoiceId) {
            const target = invs.find(i => i.id === initialInvoiceId);
            if (target) {
              setAmount(target.amountDue);
              setAllocations({ [target.id]: target.amountDue });
              return;
            }
          }

          // Otherwise calculate sum of open dues
          const totalDue = invs.reduce((acc, i) => acc.plus(i.amountDue), new Decimal(0));
          setAmount(totalDue.toFixed(2));
          // Auto-allocate all open invoices to match totalDue by default
          const initAlloc: Record<number, string> = {};
          for (const inv of invs) {
            initAlloc[inv.id] = new Decimal(inv.amountDue).toFixed(2);
          }
          setAllocations(initAlloc);
        }
      })
      .catch((err: any) => setError(err?.response?.data?.error?.message || err.message))
      .finally(() => setLoading(false));
  }, [selectedCustomerId, initialInvoiceId]);

  const handleAllocationChange = (invId: number, val: string) => {
    setAllocations(prev => ({
      ...prev,
      [invId]: val,
    }));
  };

  const handleAutoDistribute = (customAmount?: string) => {
    let rem: Decimal;
    try {
      rem = new Decimal(customAmount !== undefined ? customAmount || '0' : amount || '0');
    } catch {
      rem = new Decimal(0);
    }
    const newAlloc: Record<number, string> = {};

    for (const inv of openInvoices) {
      if (rem.lessThanOrEqualTo(0)) {
        newAlloc[inv.id] = '0.00';
        continue;
      }
      const due = new Decimal(inv.amountDue);
      if (rem.greaterThanOrEqualTo(due)) {
        newAlloc[inv.id] = due.toFixed(2);
        rem = rem.minus(due);
      } else {
        newAlloc[inv.id] = rem.toFixed(2);
        rem = new Decimal(0);
      }
    }
    setAllocations(newAlloc);
  };

  const handleAmountChange = (newVal: string) => {
    setAmount(newVal);
    setError(null);
    try {
      const parsed = new Decimal(newVal || '0');
      if (parsed.greaterThan(0)) {
        handleAutoDistribute(newVal);
      }
    } catch {
      // ignore formatting while user is typing
    }
  };

  const allocatedSum = Object.values(allocations).reduce(
    (acc, v) => acc.plus(Number(v) || 0),
    new Decimal(0)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      setError('Please select a customer.');
      return;
    }
    const payAmt = new Decimal(amount || '0');
    if (payAmt.lessThanOrEqualTo(0)) {
      setError('Payment amount must be greater than zero.');
      return;
    }

    if (!allocatedSum.equals(payAmt)) {
      setError(
        `Total allocated sum (₹${allocatedSum.toFixed(2)}) must exactly match payment amount (₹${payAmt.toFixed(2)}).`
      );
      return;
    }

    const cleanAllocations = Object.entries(allocations)
      .filter(([_, val]) => Number(val) > 0)
      .map(([invoiceId, allocAmt]) => ({
        invoiceId: Number(invoiceId),
        amount: new Decimal(allocAmt).toFixed(2),
      }));

    // Standard Bank / Cash customer receipt registration
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post('/api/payments', {
        partnerId: selectedCustomerId,
        method,
        paymentDate,
        amount: payAmt.toFixed(2),
        direction: 'inbound',
        allocations: cleanAllocations,
      });

      if (res.data?.data) {
        setSuccessMsg(
          `Payment ${res.data.data.number || 'receipt recorded'} successfully! ₹${payAmt.toFixed(2)} received and posted to General Ledger (DR ${method === 'bank' ? 'Bank' : 'Cash'}, CR Debtors).`
        );
        // Clear open invoices state so amount due immediately reflects cleared
        setOpenInvoices([]);
        setAllocations({});
        setAmount('0.00');

        // Automatically return after 2.5 seconds based on origin
        setTimeout(() => {
          if (isFromReceivables) {
            navigate('/sales/receivables?refreshed=' + Date.now());
          } else {
            navigate('/sales/invoices?payment=success&settled=true');
          }
        }, 2500);
      } else {
        setError(res.data?.error?.message || 'Failed to record customer payment');
      }
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-16">
      {/* Action Bar */}
      <div className="flex items-center justify-between py-3 mb-6 border-b border-brown-300">
        <div>
          <h1 className="text-2xl font-bold font-display text-brown-900">
            Customer Receipt
          </h1>
          <p className="text-xs text-brown-700">
            Inward cash/bank receipt settling outstanding receivables
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isFromReceivables ? (
            <button
              type="button"
              onClick={() => navigate('/sales/receivables')}
              className="px-3 py-1.5 text-xs font-semibold bg-surface border border-brown-300 rounded-[6px] text-brown-800 hover:bg-brown-100 transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
            >
              ← Back to Settle More Bills (Receivables)
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => navigate('/sales/receivables')}
                className="px-3 py-1.5 text-xs font-semibold bg-surface border border-brown-300 rounded-[6px] text-brown-800 hover:bg-brown-100 transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
              >
                ← Settle More Bills (Receivables)
              </button>
              <button
                type="button"
                onClick={() => navigate('/sales/invoices')}
                className="px-3 py-1.5 text-xs font-semibold bg-surface border border-brown-300 rounded-[6px] text-brown-700 hover:bg-brown-100 transition-colors cursor-pointer"
              >
                ← Invoices
              </button>
            </>
          )}
        </div>
      </div>

      {error && <BlockingWarning message={error} />}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-950 rounded-[8px] mb-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-xs shrink-0">
              ✓
            </span>
            <div className="text-sm font-medium text-emerald-900">{successMsg}</div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => navigate('/sales/receivables?refreshed=' + Date.now())}
              className="px-4 py-2 text-xs font-bold bg-brown-900 hover:bg-brown-800 text-cream rounded-[6px] transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <span>← Settle More Bills (Receivables)</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/sales/invoices?payment=success&settled=true')}
              className="px-3.5 py-2 text-xs font-semibold bg-surface border border-brown-300 hover:bg-brown-100 text-brown-800 rounded-[6px] transition-colors cursor-pointer"
            >
              View Invoices →
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Payment Details Header Card */}
        <div className="bg-surface border border-brown-300 rounded-[10px] p-6 shadow-sm">
          {/* Wireframe 10: Payment Type Radio Switcher */}
          <div className="mb-4 pb-3 border-b border-brown-200/60 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <span className="text-xs font-bold uppercase tracking-wider text-brown-800">
                Payment Type:
              </span>
              <label className="inline-flex items-center gap-2 text-sm text-brown-600 cursor-not-allowed opacity-60">
                <input type="radio" name="pagePaymentType" disabled />
                <span>Send (Pay Bill)</span>
              </label>
              <label className="inline-flex items-center gap-2 text-sm font-semibold text-brown-900 cursor-pointer">
                <input type="radio" name="pagePaymentType" checked readOnly className="text-brown-900 focus:ring-brown-600" />
                <span>Receive (Customer Receipt)</span>
              </label>
            </div>
            <span className="text-[11px] font-mono font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Inbound Receipt
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Customer */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-brown-700 mb-1.5">
                Customer *
              </label>
              <select
                value={selectedCustomerId}
                onChange={e => setSelectedCustomerId(Number(e.target.value))}
                className="w-full bg-surface border border-brown-300 rounded-[6px] px-3 py-2 text-brown-900 focus:ring-2 focus:ring-brown-700 outline-none text-sm"
              >
                <option value={0} disabled>Select Customer...</option>
                {contacts.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-brown-700 mb-1.5">
                Payment Journal / Method *
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMethod('bank')}
                  className={`py-2 px-3 text-xs font-bold rounded-[6px] border transition-all ${
                    method === 'bank'
                      ? 'bg-brown-900 text-cream border-brown-900 shadow-sm'
                      : 'bg-surface text-brown-700 border-brown-300 hover:bg-brown-100'
                  }`}
                >
                  🏦 Bank Transfer / Cheque
                </button>
                <button
                  type="button"
                  onClick={() => setMethod('cash')}
                  className={`py-2 px-3 text-xs font-bold rounded-[6px] border transition-all ${
                    method === 'cash'
                      ? 'bg-brown-900 text-cream border-brown-900 shadow-sm'
                      : 'bg-surface text-brown-700 border-brown-300 hover:bg-brown-100'
                  }`}
                >
                  💵 Cash Drawer
                </button>
              </div>
            </div>

            {/* Payment Date */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-brown-700 mb-1.5">
                Payment Date *
              </label>
              <input
                type="date"
                value={paymentDate}
                onChange={e => setPaymentDate(e.target.value)}
                className="w-full bg-surface border border-brown-300 rounded-[6px] px-3 py-2 text-brown-900 focus:ring-2 focus:ring-brown-700 outline-none text-sm font-mono"
              />
            </div>

            {/* Total Amount Received */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-brown-700 mb-1.5">
                Received Amount (₹) *
              </label>
              <input
                type="text"
                value={amount}
                onChange={e => handleAmountChange(e.target.value)}
                className="w-full bg-surface border border-brown-300 rounded-[6px] px-3 py-2 text-brown-900 focus:ring-2 focus:ring-brown-700 outline-none text-base font-bold font-mono"
                placeholder="0.00"
              />
              <span className="text-[11px] text-brown-500 mt-1 block">
                Partial payment supported. Revenue is unchanged.
              </span>
            </div>
          </div>

          {/* General Ledger Posting Preview */}
          <div className="mt-4 pt-4 border-t border-brown-200/60 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-brown-50/50 p-3 rounded-[8px]">
            <div>
              <span className="text-brown-600 font-medium block">Debit (Receiving Account):</span>
              <span className="font-mono font-bold text-brown-900">
                {method === 'bank' ? '1020 - Bank Accounts' : '1010 - Cash Drawer'}
              </span>
            </div>
            <div>
              <span className="text-brown-600 font-medium block">Credit (Customer Asset):</span>
              <span className="font-mono font-bold text-brown-900">
                1200 - Accounts Receivable / Sundry Debtors
              </span>
            </div>
          </div>
        </div>

        {/* Invoice Allocation Grid */}
        <div className="bg-surface border border-brown-300 rounded-[10px] p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-brown-200 mb-4 gap-2">
            <div>
              <h3 className="text-base font-bold font-display text-brown-900">
                Invoice Settlement Allocation
              </h3>
              <p className="text-xs text-brown-500">
                Select open customer invoices to settle with this payment
              </p>
            </div>
            {openInvoices.length > 0 && (
              <button
                type="button"
                onClick={() => handleAutoDistribute()}
                className="text-xs font-semibold text-brown-700 bg-brown-100 hover:bg-brown-200 px-3 py-1.5 rounded-[6px] transition-colors"
              >
                Auto-Distribute Oldest First
              </button>
            )}
          </div>

          {loading ? (
            <div className="py-8 text-center text-brown-500 text-sm">
              Loading open invoices for this customer...
            </div>
          ) : openInvoices.length === 0 ? (
            <div className="py-8 text-center text-brown-500 text-sm">
              {selectedCustomerId
                ? 'This customer has no open unpaid invoices.'
                : 'Select a customer above to load open invoices.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-brown-100 text-brown-900 font-semibold border-b border-brown-300">
                    <th className="p-2.5">Invoice #</th>
                    <th className="p-2.5">Invoice Date</th>
                    <th className="p-2.5">Due Date</th>
                    <th className="p-2.5 text-right font-mono-num">Total Amount</th>
                    <th className="p-2.5 text-right font-mono-num">Current Due</th>
                    <th className="p-2.5 text-right font-mono-num w-44">Allocate (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brown-100">
                  {openInvoices.map(inv => {
                    const currentAlloc = allocations[inv.id] || '';
                    return (
                      <tr key={inv.id} className="hover:bg-brown-50/70">
                        <td className="p-2.5 font-mono font-bold text-brown-900">
                          {inv.number}
                        </td>
                        <td className="p-2.5 text-brown-600 font-mono">{inv.invoiceDate}</td>
                        <td className="p-2.5 text-brown-600 font-mono">{inv.dueDate || '—'}</td>
                        <td className="p-2.5 text-right font-mono text-brown-700">
                          ₹{Number(inv.total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-2.5 text-right font-mono text-danger font-semibold">
                          ₹{Number(inv.amountDue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-2.5 text-right">
                          <div className="flex items-center gap-1.5 justify-end">
                            <input
                              type="text"
                              value={currentAlloc}
                              onChange={e => handleAllocationChange(inv.id, e.target.value)}
                              placeholder="0.00"
                              className="w-28 text-right bg-surface border border-brown-300 rounded px-2 py-1 font-mono font-bold text-brown-900 focus:ring-2 focus:ring-brown-700 outline-none text-xs"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                handleAllocationChange(inv.id, new Decimal(inv.amountDue).toFixed(2));
                              }}
                              className="px-2 py-1 text-[10px] font-bold text-brown-800 bg-brown-200/70 hover:bg-brown-300 rounded transition-colors"
                              title="Allocate full amount due"
                            >
                              Full
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Allocation Reconciliation Footer */}
              <div className="mt-4 p-4 bg-brown-50 rounded-[8px] border border-brown-200 flex items-center justify-between text-xs">
                <div>
                  <span className="text-brown-700 block">
                    Payment Amount: <strong className="font-mono text-brown-900">₹{amount || '0.00'}</strong>
                  </span>
                  <span className="text-brown-700 block">
                    Total Allocated: <strong className="font-mono text-posted">₹{allocatedSum.toFixed(2)}</strong>
                  </span>
                </div>
                <div>
                  {allocatedSum.equals(Number(amount) || 0) ? (
                    <span className="px-3 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-full">
                      ✓ Perfectly Balanced
                    </span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 bg-amber-100 text-amber-900 font-bold rounded-full">
                        Difference: ₹{new Decimal(amount || '0').minus(allocatedSum).toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setAmount(allocatedSum.toFixed(2))}
                        className="px-2.5 py-1 text-xs font-semibold bg-brown-200 hover:bg-brown-300 text-brown-900 rounded transition-colors"
                        title="Adjust payment amount to match allocated sum"
                      >
                        Match Amount to Allocated
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={() => navigate(isFromReceivables ? '/sales/receivables' : '/sales/invoices')}
            className="px-4 py-2 text-sm font-semibold text-brown-700 hover:text-brown-900 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || openInvoices.length === 0}
            className="px-6 py-2 text-sm font-bold rounded-[6px] transition-all shadow-md active:scale-[0.99] disabled:bg-brown-300 bg-brown-900 text-cream hover:bg-brown-800"
          >
            {submitting ? 'Recording Receipt...' : 'Confirm & Register Customer Payment'}
          </button>
        </div>
      </form>
    </div>
  );
};
export default RegisterPaymentPage;
