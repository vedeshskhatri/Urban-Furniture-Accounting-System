import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
} from 'recharts';
import { StatusBadge } from '../../components/StatusBadge';
import { CustomerInvoiceDTO } from '@shared/schemas/invoice';
import {
  Mic,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  BarChart3,
  PieChart as PieIcon,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  CreditCard,
} from 'lucide-react';

export interface CustomerInvoiceListPageProps {
  onSelectInvoice?: (id: number) => void;
  onNewInvoice?: () => void;
}

type SortField = 'number' | 'customer' | 'invoiceDate' | 'paymentStatus' | 'amountDue' | 'total';

const STATUS_COLORS: Record<string, string> = {
  paid: '#5F7052', // Olive
  partial: '#C08A3E', // Amber
  not_paid: '#9E4A38', // Terracotta
  draft: '#A8836C', // Sand brown
  confirmed: '#77574A', // Walnut
};

function formatDisplayINR(num: number): string {
  if (Math.abs(num) >= 10000000) {
    return `₹${(num / 10000000).toFixed(2)} Cr`;
  }
  if (Math.abs(num) >= 100000) {
    return `₹${(num / 100000).toFixed(2)} L`;
  }
  return `₹${num.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export const CustomerInvoiceListPage: React.FC<CustomerInvoiceListPageProps> = ({ onSelectInvoice, onNewInvoice }) => {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<CustomerInvoiceDTO[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('invoiceDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [showVisualAnalytics, setShowVisualAnalytics] = useState<boolean>(true);

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

  // Aggregate Metrics for KPIs
  const { totalBilled, totalPaid, totalDue, realizationPct } = useMemo(() => {
    let billed = 0;
    let due = 0;
    for (const inv of invoices) {
      billed += parseFloat(inv.total || '0');
      due += parseFloat(inv.amountDue || '0');
    }
    const paid = Math.max(0, billed - due);
    const pct = billed > 0 ? ((paid / billed) * 100).toFixed(1) : '0.0';
    return {
      totalBilled: billed,
      totalPaid: paid,
      totalDue: due,
      realizationPct: pct,
    };
  }, [invoices]);

  // Monthly Billing Trajectory (Bar Chart)
  const monthlyData = useMemo(() => {
    const map = new Map<string, { month: string; billed: number; due: number }>();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Process in chronological order
    const sortedByDate = [...invoices].sort((a, b) => {
      return (a.invoiceDate || '').localeCompare(b.invoiceDate || '');
    });

    for (const inv of sortedByDate) {
      if (!inv.invoiceDate) continue;
      const d = new Date(inv.invoiceDate);
      if (isNaN(d.getTime())) continue;
      const key = `${monthNames[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
      const existing = map.get(key) || { month: key, billed: 0, due: 0 };
      existing.billed += parseFloat(inv.total || '0');
      existing.due += parseFloat(inv.amountDue || '0');
      map.set(key, existing);
    }
    return Array.from(map.values()).slice(-6);
  }, [invoices]);

  // Payment Status Distribution (Donut Chart)
  const statusPieData = useMemo(() => {
    const map = new Map<string, number>();
    for (const inv of invoices) {
      const st = inv.paymentStatus || inv.status || 'draft';
      map.set(st, (map.get(st) || 0) + parseFloat(inv.total || '0'));
    }
    return Array.from(map.entries()).map(([status, val]) => ({
      name: status === 'not_paid' ? 'Not Paid' : status === 'paid' ? 'Paid' : status === 'partial' ? 'Partial' : status.charAt(0).toUpperCase() + status.slice(1),
      rawStatus: status,
      value: val,
      color: STATUS_COLORS[status] || '#77574A',
    }));
  }, [invoices]);

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
    <div className="w-full flex flex-col gap-5">
      {/* Top Header & Actions Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-brown-900">Customer Invoices</h1>
          <p className="text-sm text-brown-700">Official receivables recognized on the double-entry ledger</p>
        </div>
        <div className="flex items-center space-x-2.5 flex-wrap">
          <button
            onClick={() => setShowVisualAnalytics(prev => !prev)}
            className="inline-flex items-center gap-1.5 bg-surface border border-brown-300 hover:bg-brown-100 text-brown-900 px-3 py-1.5 rounded-[6px] text-xs font-semibold transition-colors shadow-xs"
          >
            <BarChart3 className="w-3.5 h-3.5 text-brown-700" />
            <span>{showVisualAnalytics ? 'Hide Analytics' : 'Visual Analytics'}</span>
            {showVisualAnalytics ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="bg-surface border border-brown-300 rounded-[6px] px-3 py-1.5 text-xs text-brown-900 focus:ring-2 focus:ring-brown-700 outline-none shadow-xs font-medium"
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
            className="inline-flex items-center gap-1.5 bg-cream border border-brown-300 hover:bg-brown-100 text-brown-900 px-3 py-1.5 rounded-[6px] text-xs font-semibold transition-colors shadow-xs cursor-pointer"
            title="Create customer invoice with conversational voice dictation"
          >
            <Mic className="w-3.5 h-3.5 text-rose-600" />
            <span>Voice e-Bill</span>
          </button>
          <button
            onClick={() => onNewInvoice ? onNewInvoice() : navigate('/sales/invoices/new')}
            className="bg-brown-900 text-cream px-3.5 py-1.5 rounded-[6px] text-xs font-semibold hover:bg-brown-800 transition-colors shadow-xs"
          >
            + New Invoice
          </button>
        </div>
      </div>

      {/* ── Executive Invoicing & Settlement Analytics Panel ── */}
      {showVisualAnalytics && (
        <div className="bg-surface border border-brown-300/70 rounded-[10px] p-5 shadow-xs flex flex-col gap-4">
          {/* Real-time KPI Ribbon */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pb-3 border-b border-brown-200">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-brown-500">Total Billed Volume</span>
              <span className="text-xl font-bold font-mono text-brown-900 mt-0.5">
                ₹{totalBilled.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-[11px] text-brown-600">Total {invoices.length} invoices issued</span>
            </div>

            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-brown-500">Collected Cash</span>
              <span className="text-xl font-bold font-mono text-posted mt-0.5">
                ₹{totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-[11px] text-brown-600">Settled receipts applied</span>
            </div>

            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-brown-500">Outstanding Receivables</span>
              <span className="text-xl font-bold font-mono text-danger mt-0.5">
                ₹{totalDue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-[11px] text-brown-600">Awaiting customer clearance</span>
            </div>

            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-brown-500">Collection Velocity</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-xl font-bold font-mono text-brown-900">{realizationPct}%</span>
                <TrendingUp className="w-4 h-4 text-posted" />
              </div>
              <span className="text-[11px] text-brown-600">Cash realization ratio</span>
            </div>
          </div>

          {/* Interactive Recharts Visualizations */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-1">
            {/* Chart 1: Monthly Invoicing Trajectory */}
            <div className="bg-brown-50/40 border border-brown-200/80 rounded-[8px] p-3.5 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-brown-700" />
                  <span className="text-xs font-bold text-brown-900">Invoicing & Due Trajectory</span>
                </div>
                <span className="text-[11px] font-mono text-brown-600">Monthly Volume</span>
              </div>
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                    <XAxis
                      dataKey="month"
                      tick={{ fill: '#77574A', fontSize: 10 }}
                      axisLine={{ stroke: 'rgba(208, 174, 146, 0.5)' }}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={formatDisplayINR}
                      tick={{ fill: '#77574A', fontSize: 9, fontFamily: 'monospace' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <RechartsTooltip
                      formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, '']}
                      contentStyle={{
                        background: '#FFF',
                        borderRadius: 6,
                        border: '1px solid rgba(208, 174, 146, 0.5)',
                        fontSize: 11,
                        fontFamily: 'monospace',
                      }}
                    />
                    <Bar dataKey="billed" name="Billed" fill="#5F7052" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="due" name="Pending Due" fill="#9E4A38" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Payment Realization Donut */}
            <div className="bg-brown-50/40 border border-brown-200/80 rounded-[8px] p-3.5 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <PieIcon className="w-4 h-4 text-brown-700" />
                  <span className="text-xs font-bold text-brown-900">Payment Status Allocation</span>
                </div>
                <span className="text-[11px] font-mono text-brown-600">Click to filter table</span>
              </div>

              <div className="flex items-center h-44">
                <div className="w-1/2 h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusPieData}
                        innerRadius={40}
                        outerRadius={65}
                        paddingAngle={3}
                        dataKey="value"
                        onClick={(data) => {
                          if (data?.rawStatus) setFilterStatus(data.rawStatus);
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        {statusPieData.map((entry, idx) => (
                          <Cell key={`status-cell-${idx}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 'Total']}
                        contentStyle={{
                          background: '#FFF',
                          borderRadius: 6,
                          border: '1px solid rgba(208, 174, 146, 0.5)',
                          fontSize: 11,
                          fontFamily: 'monospace',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="w-1/2 flex flex-col gap-1.5 pl-2 overflow-y-auto max-h-40">
                  {statusPieData.map((item) => (
                    <button
                      key={item.rawStatus}
                      type="button"
                      onClick={() => setFilterStatus(item.rawStatus)}
                      className={`flex items-center justify-between gap-1 text-[11px] px-2 py-1 rounded transition-colors text-left ${
                        filterStatus === item.rawStatus ? 'bg-brown-200 font-bold' : 'hover:bg-brown-100'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="truncate text-brown-800">{item.name}</span>
                      </div>
                      <span className="font-mono font-semibold text-brown-900 shrink-0">
                        {formatDisplayINR(item.value)}
                      </span>
                    </button>
                  ))}
                  {filterStatus !== 'all' && (
                    <button
                      type="button"
                      onClick={() => setFilterStatus('all')}
                      className="text-[10px] text-brown-600 hover:text-brown-900 underline text-left mt-0.5"
                    >
                      Reset status filter
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Table Card */}
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
