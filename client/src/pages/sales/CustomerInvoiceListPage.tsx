import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { StatusBadge } from '../../components/StatusBadge';
import { CustomerInvoiceDTO } from '@shared/schemas/invoice';
import { Mic, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

export interface CustomerInvoiceListPageProps {
  onSelectInvoice?: (id: number) => void;
  onNewInvoice?: () => void;
}

type SortField = 'number' | 'customer' | 'invoiceDate' | 'paymentStatus' | 'amountDue' | 'total';

export const CustomerInvoiceListPage: React.FC<CustomerInvoiceListPageProps> = ({ onSelectInvoice, onNewInvoice }) => {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<CustomerInvoiceDTO[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('invoiceDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetch('/api/invoices')
      .then(res => res.json())
      .then(json => {
        if (json.data) setInvoices(json.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const filtered = useMemo(() => {
    return invoices.filter(inv => {
      if (filterStatus === 'all') return true;
      return inv.status === filterStatus || inv.paymentStatus === filterStatus;
    });
  }, [invoices, filterStatus]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'invoiceDate') {
        const timeA = a.invoiceDate ? new Date(a.invoiceDate).getTime() : 0;
        const timeB = b.invoiceDate ? new Date(b.invoiceDate).getTime() : 0;
        cmp = timeA - timeB;
      } else if (sortField === 'number') {
        cmp = (a.number || '').localeCompare(b.number || '');
      } else if (sortField === 'customer') {
        const nameA = a.customerName || `Customer #${a.customerId}`;
        const nameB = b.customerName || `Customer #${b.customerId}`;
        cmp = nameA.localeCompare(nameB);
      } else if (sortField === 'paymentStatus') {
        const statusA = a.paymentStatus || a.status || '';
        const statusB = b.paymentStatus || b.status || '';
        cmp = statusA.localeCompare(statusB);
      } else if (sortField === 'amountDue') {
        cmp = parseFloat(a.amountDue || '0') - parseFloat(b.amountDue || '0');
      } else if (sortField === 'total') {
        cmp = parseFloat(a.total || '0') - parseFloat(b.total || '0');
      }

      if (cmp === 0) {
        return b.id - a.id;
      }
      return sortDirection === 'desc' ? -cmp : cmp;
    });
  }, [filtered, sortField, sortDirection]);

  const renderSortHeader = (label: string, field: SortField, alignRight = false) => {
    const isCurrent = sortField === field;
    return (
      <th
        onClick={() => handleSort(field)}
        className={`p-3.5 cursor-pointer hover:bg-brown-200/70 transition-colors select-none group ${
          alignRight ? 'text-right' : 'text-left'
        }`}
      >
        <div className={`inline-flex items-center gap-1.5 ${alignRight ? 'justify-end' : 'justify-start'}`}>
          <span>{label}</span>
          {isCurrent ? (
            sortDirection === 'desc' ? (
              <ArrowDown className="w-3.5 h-3.5 text-brown-900 shrink-0" />
            ) : (
              <ArrowUp className="w-3.5 h-3.5 text-brown-900 shrink-0" />
            )
          ) : (
            <ArrowUpDown className="w-3.5 h-3.5 text-brown-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          )}
        </div>
      </th>
    );
  };

  return (
    <div className="w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold font-display text-brown-900">Customer Invoices</h1>
          <p className="text-sm text-brown-700">Official receivables recognized on the double-entry ledger</p>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="bg-surface border border-brown-300 rounded-[6px] px-3 py-1.5 text-sm text-brown-900 focus:ring-2 focus:ring-brown-700 outline-none shadow-sm"
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="confirmed">Confirmed</option>
            <option value="not_paid">Not Paid</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
          </select>
          <button
            onClick={() => navigate('/sales/voice-bill')}
            className="inline-flex items-center gap-1.5 bg-cream border border-brown-300 hover:bg-brown-100 text-brown-900 px-3.5 py-2 rounded-[6px] text-sm font-semibold transition-colors shadow-sm cursor-pointer"
            title="Create customer invoice with conversational voice dictation"
          >
            <Mic className="w-4 h-4 text-rose-600" />
            <span>Voice e-Bill</span>
          </button>
          <button
            onClick={() => onNewInvoice ? onNewInvoice() : navigate('/sales/invoices/new')}
            className="bg-brown-900 text-cream px-4 py-2 rounded-[6px] text-sm font-semibold hover:bg-brown-700 transition-colors shadow-sm"
          >
            + New Invoice
          </button>
        </div>
      </div>

      <div className="bg-surface border border-brown-300 rounded-[10px] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-brown-100 text-brown-900 font-semibold border-b border-brown-300">
                {renderSortHeader('Invoice Number', 'number')}
                {renderSortHeader('Customer', 'customer')}
                {renderSortHeader('Invoice Date', 'invoiceDate')}
                {renderSortHeader('Payment Status', 'paymentStatus')}
                {renderSortHeader('Amount Due', 'amountDue', true)}
                {renderSortHeader('Total Amount', 'total', true)}
              </tr>
            </thead>
            <tbody className="divide-y divide-brown-100/70">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-brown-500">
                    Loading customer invoices...
                  </td>
                </tr>
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-brown-500">
                    No invoices found. Click <strong>+ New Invoice</strong> or convert from a Sales Order.
                  </td>
                </tr>
              ) : (
                sorted.map(inv => (
                  <tr
                    key={inv.id}
                    onClick={() => onSelectInvoice ? onSelectInvoice(inv.id) : navigate(`/sales/invoices/${inv.id}`)}
                    className="hover:bg-brown-100/40 cursor-pointer transition-colors"
                  >
                    <td className="p-3.5 font-semibold text-brown-900">
                      {inv.number}
                      {inv.soNumber && (
                        <span className="block text-[10px] text-brown-500 font-normal">From {inv.soNumber}</span>
                      )}
                    </td>
                    <td className="p-3.5 text-brown-700">{inv.customerName || `Customer #${inv.customerId}`}</td>
                    <td className="p-3.5 text-brown-600 font-mono text-xs">{inv.invoiceDate}</td>
                    <td className="p-3.5">
                      <StatusBadge status={((inv.paymentStatus || inv.status) as any) || 'draft'} />
                    </td>
                    <td className="p-3.5 text-right font-mono-num text-danger font-medium">₹{inv.amountDue}</td>
                    <td className="p-3.5 text-right font-mono-num font-bold text-brown-900">₹{inv.total}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
export default CustomerInvoiceListPage;
